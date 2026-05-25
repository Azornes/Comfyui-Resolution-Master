import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger('auto_detect_methods');

export const autoDetectMethods = {
    startAutoDetect() {
        if (this.dimensionCheckInterval) return;
        log.info('Auto-detect started', {
            nodeId: this.node?.id ?? null,
            source: this.node?.properties?.autoDetectSource || 'backend'
        });
        this.checkForImageDimensions();
        this.dimensionCheckInterval = setInterval(() => this.checkForImageDimensions(), 1000);
    },

    stopAutoDetect() {
        if (this.dimensionCheckInterval) {
            clearInterval(this.dimensionCheckInterval);
            this.dimensionCheckInterval = null;
            log.info('Auto-detect stopped', {
                nodeId: this.node?.id ?? null
            });
        }
    },

    setAutoDetectSource(source) {
        const normalizedSource = source === 'frontend' ? 'frontend' : 'backend';
        this.node.properties.autoDetectSource = normalizedSource;
        if (this.autoDetectSourceWidget) {
            this.autoDetectSourceWidget.value = normalizedSource;
        }
    },

    setRawAutoDetectDimensions(dimensions) {
        const width = dimensions ? Math.round(Number(dimensions.width) || 0) : 0;
        const height = dimensions ? Math.round(Number(dimensions.height) || 0) : 0;
        this.node.properties.autoDetectWidth = width;
        this.node.properties.autoDetectHeight = height;
        if (this.autoDetectWidthWidget) {
            this.autoDetectWidthWidget.value = width;
        }
        if (this.autoDetectHeightWidget) {
            this.autoDetectHeightWidget.value = height;
        }
    },

    setBackendFallbackWidgetValue(propertyName, value) {
        this.node.properties[propertyName] = value;
        const widget = this.backendFallbackWidgets?.[propertyName];
        if (widget) {
            widget.value = value;
        }
    },

    syncBackendFallbackWidgets() {
        if (!this.backendFallbackWidgets) return;

        const props = this.node.properties;
        const presetsJSON = this.getCategoryPresetsJSON(props.selectedCategory);

        this.setBackendFallbackWidgetValue('autoFitOnChange', !!props.autoFitOnChange);
        this.setBackendFallbackWidgetValue('autoResizeOnChange', !!props.autoResizeOnChange);
        this.setBackendFallbackWidgetValue('autoSnapOnChange', !!props.autoSnapOnChange);
        this.setBackendFallbackWidgetValue('smartFit', !!props.smartFit);
        this.setBackendFallbackWidgetValue('useCustomCalc', !!props.useCustomCalc);
        this.setBackendFallbackWidgetValue('preserveScalingRatio', !!props.preserveScalingRatio);
        this.setBackendFallbackWidgetValue('selectedCategory', props.selectedCategory || "");
        this.setBackendFallbackWidgetValue('snapValue', Math.max(1, Math.round(Number(props.snapValue) || 64)));
        this.setBackendFallbackWidgetValue('upscaleValue', Math.max(0, Number(props.upscaleValue) || 0));
        this.setBackendFallbackWidgetValue('targetResolution', Math.max(1, Math.round(Number(props.targetResolution) || 1080)));
        this.setBackendFallbackWidgetValue('targetMegapixels', Math.max(0, Number(props.targetMegapixels) || 0));
        this.setBackendFallbackWidgetValue('autoDetectPresetsJSON', presetsJSON);
    },

    getAutoDetectLiveStatus() {
        if (!this.node.inputs?.[0]?.link) {
            return {
                text: "Live: no input",
                color: [150, 150, 150],
                textColor: "#999"
            };
        }

        const previewDimensions = this.getConnectedPreviewDimensions();
        if (previewDimensions?.liveChangeTracking) {
            return {
                text: "Live: supported",
                color: [95, 255, 95],
                textColor: "#5f5"
            };
        }
        if (previewDimensions) {
            return {
                text: "Live: size only",
                color: [255, 205, 95],
                textColor: "#fc5"
            };
        }
        if (this.detectedDimensions?.source === "backend") {
            return {
                text: "Live: backend cache",
                color: [120, 190, 255],
                textColor: "#8cf"
            };
        }
        return {
            text: "Live: after run",
            color: [150, 150, 150],
            textColor: "#aaa"
        };
    },

    async checkForImageDimensions() {
        const node = this.node;
        try {
            const previewDimensions = this.getConnectedPreviewDimensions();
            const backendDimensions = previewDimensions ? null : await this.getBackendDetectedDimensions();
            const dimensions = previewDimensions || backendDimensions;
            if (!dimensions) {
                if (this.detectedDimensions) {
                    log.debug('Auto-detect dimensions cleared', {
                        nodeId: node.id ?? null
                    });
                }
                this.detectedDimensions = null;
                this.setAutoDetectSource('backend');
                this.setRawAutoDetectDimensions(null);
                return;
            }

            this.setAutoDetectSource(previewDimensions ? 'frontend' : 'backend');
            this.setRawAutoDetectDimensions(dimensions);

            const previousSignature = this.detectedDimensions?.signature || null;
            const nextSignature = dimensions.signature || null;
            const hasNewDimensions =
                !this.detectedDimensions ||
                this.detectedDimensions.width !== dimensions.width ||
                this.detectedDimensions.height !== dimensions.height ||
                (nextSignature && previousSignature !== nextSignature);

            if (hasNewDimensions) {
                this.detectedDimensions = dimensions;
                this.manuallySetByAutoFit = false;
                log.info('Auto-detected image dimensions changed', {
                    nodeId: node.id ?? null,
                    source: dimensions.source,
                    width: dimensions.width,
                    height: dimensions.height,
                    liveChangeTracking: !!dimensions.liveChangeTracking
                });

                const props = node.properties;
                const result = await this.requestBackendCalculation('auto_detect', {
                    width: this.detectedDimensions.width,
                    height: this.detectedDimensions.height
                });
                if (result) {
                    this.applyBackendCalculationResult(result);
                } else if (props.autoDetect && this.widthWidget && this.heightWidget) {
                    this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
                }

                this.app?.graph?.setDirtyCanvas(true);
            }
        } catch (error) {
            log.error('Error checking for image dimensions:', error);
        }
    },

    getConnectedSourceNode() {
        const inputLink = this.node.inputs?.[0]?.link;
        if (!inputLink || !this.app?.graph?.links) return null;

        const link = this.app.graph.links[inputLink];
        if (!link) return null;

        return this.app.graph.getNodeById(link.origin_id) || null;
    },

    getPreviewSourceSignatureInfo(sourceNode, preview, width, height) {
        const nodeId = sourceNode?.id ?? "unknown";
        const relevantWidgetNames = new Set([
            "image",
            "upload",
            "file",
            "filename",
            "path",
            "url",
            "image_path"
        ]);
        const widgetParts = (sourceNode?.widgets || [])
            .filter(widget => {
                const name = String(widget?.name || "").toLowerCase();
                const value = widget?.value;
                return relevantWidgetNames.has(name) || typeof value === "string";
            })
            .map(widget => `${widget?.name || ""}:${String(widget?.value ?? "")}`)
            .join("|");
        const previewParts = [
            preview?.currentSrc,
            preview?.src,
            preview?.dataset?.filename,
            preview?.dataset?.name,
            preview?.alt,
            preview?.title
        ].filter(Boolean).join("|");

        return {
            signature: `frontend:${nodeId}:${widgetParts}:${previewParts}:${Math.round(width)}x${Math.round(height)}`,
            hasChangeSignal: !!(widgetParts || previewParts)
        };
    },

    getConnectedPreviewDimensions() {
        const sourceNode = this.getConnectedSourceNode();
        if (!sourceNode) return null;
        // Best-effort live UI hint: ComfyUI exposes preview images on many source nodes,
        // but the backend tensor remains the source of truth when the workflow executes.
        const preview = sourceNode?.imgs?.[0];
        const width = Number(preview?.naturalWidth || preview?.width || preview?.videoWidth);
        const height = Number(preview?.naturalHeight || preview?.height || preview?.videoHeight);

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return null;
        }

        const signatureInfo = this.getPreviewSourceSignatureInfo(sourceNode, preview, width, height);
        return {
            width: Math.round(width),
            height: Math.round(height),
            source: "frontend",
            signature: signatureInfo.signature,
            liveChangeTracking: signatureInfo.hasChangeSignal
        };
    },

    async getBackendDetectedDimensions() {
        if (this.node.id == null) return null;

        try {
            const response = await fetch(`/resolutionmaster/dimensions/${encodeURIComponent(this.node.id)}`, {
                cache: 'no-store'
            });
            if (!response.ok) return null;

            const data = await response.json();
            if (!data?.found) return null;

            const width = Number(data.width);
            const height = Number(data.height);
            const timestamp = Number(data.timestamp);
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                return null;
            }

            if (Number.isFinite(timestamp)) {
                this.lastBackendDimensionsTimestamp = timestamp;
            }

            return {
                width: Math.round(width),
                height: Math.round(height),
                source: "backend",
                timestamp: Number.isFinite(timestamp) ? timestamp : null,
                signature: `backend:${this.node.id}:${Number.isFinite(timestamp) ? timestamp : "no-ts"}:${Math.round(width)}x${Math.round(height)}`
            };
        } catch (error) {
            const message = error?.message || String(error);
            if (this._lastBackendDimensionError !== message) {
                this._lastBackendDimensionError = message;
                log.debug('Backend dimensions unavailable:', error);
            }
            return null;
        }
    }
};
