import { createModuleLogger } from "../log_system/log_funcs.js";
import { isLivePreviewWidget } from "./source_detectors/shared.js";
import {
    attachSourceDetectorWatchers,
    detachSourceDetectorWatchers,
    getSourceDimensions,
    shouldSuppressBackendFallback
} from "./source_detectors/detector_registry.js";

const log = createModuleLogger('auto_detect_methods');
const AUTO_DETECT_FALLBACK_POLL_INTERVAL_MS = 1000;
const AUTO_DETECT_DEBOUNCE_MS = 30;
const AUTO_DETECT_FRONTEND_PREVIEW_WAIT_MS = 1000;
const AUTO_DETECT_FRONTEND_PREVIEW_RETRY_MS = 150;
const AUTO_DETECT_WIDGET_WATCHERS_PROP = "__resolutionMasterAutoDetectWatchers";
const AUTO_DETECT_WIDGET_ORIGINAL_CALLBACK_PROP = "__resolutionMasterAutoDetectOriginalCallback";
const AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP = "__resolutionMasterAutoDetectPatchedCallback";

export const autoDetectMethods = {
    startAutoDetect() {
        if (this.dimensionCheckInterval) {
            this.refreshLivePreviewWatcher();
            this.scheduleAutoDetectCheck('auto-detect already running', 0);
            return;
        }
        log.info('Auto-detect started', {
            nodeId: this.node?.id ?? null,
            source: this.node?.properties?.autoDetectSource || 'backend'
        });
        this.autoDetectStartedAtMs = Date.now();
        this.refreshLivePreviewWatcher();
        this.scheduleAutoDetectCheck('auto-detect started', 0);
        this.dimensionCheckInterval = setInterval(() => {
            this.refreshLivePreviewWatcher();
            this.scheduleAutoDetectCheck('fallback poll', 0);
        }, AUTO_DETECT_FALLBACK_POLL_INTERVAL_MS);
    },

    stopAutoDetect() {
        const wasRunning = !!this.dimensionCheckInterval;
        if (this.dimensionCheckInterval) {
            clearInterval(this.dimensionCheckInterval);
            this.dimensionCheckInterval = null;
        }
        this.clearScheduledAutoDetectCheck();
        this.teardownLivePreviewWatcher();
        this.autoDetectStartedAtMs = null;
        if (wasRunning) {
            log.info('Auto-detect stopped', {
                nodeId: this.node?.id ?? null
            });
        }
    },

    clearScheduledAutoDetectCheck() {
        if (this.autoDetectCheckTimeout) {
            clearTimeout(this.autoDetectCheckTimeout);
            this.autoDetectCheckTimeout = null;
        }
    },

    scheduleAutoDetectCheck(reason = 'scheduled', delay = AUTO_DETECT_DEBOUNCE_MS) {
        if (!this.node?.properties?.autoDetect) return;

        this.clearScheduledAutoDetectCheck();
        this.lastAutoDetectCheckReason = reason;
        this.autoDetectCheckTimeout = setTimeout(() => {
            this.autoDetectCheckTimeout = null;
            this.refreshLivePreviewWatcher(false);
            this.checkForImageDimensions();
        }, Math.max(0, delay));
    },

    markLivePreviewPending(reason = 'frontend source changed') {
        this.lastLivePreviewChangeAtMs = Date.now();
        this.awaitingLivePreviewUntilMs = this.lastLivePreviewChangeAtMs + AUTO_DETECT_FRONTEND_PREVIEW_WAIT_MS;
        this.awaitingLivePreviewReason = reason;
    },

    clearLivePreviewPending() {
        this.awaitingLivePreviewUntilMs = null;
        this.awaitingLivePreviewReason = null;
    },

    isAwaitingLivePreview() {
        return Number.isFinite(this.awaitingLivePreviewUntilMs) && Date.now() < this.awaitingLivePreviewUntilMs;
    },

    isBackendCacheStaleForLivePreviewChange(dimensions) {
        if (!dimensions || !Number.isFinite(this.lastLivePreviewChangeAtMs)) return false;

        const backendTimestampMs = Number(dimensions.timestamp) * 1000;
        if (!Number.isFinite(backendTimestampMs)) return true;

        return backendTimestampMs < this.lastLivePreviewChangeAtMs;
    },

    haveDifferentDimensions(first, second) {
        if (!first || !second) return false;
        return Math.round(Number(first.width) || 0) !== Math.round(Number(second.width) || 0)
            || Math.round(Number(first.height) || 0) !== Math.round(Number(second.height) || 0);
    },

    shouldPreferBackendDimensions(frontendDimensions, backendDimensions, previousBackendTimestamp) {
        if (!frontendDimensions || !backendDimensions) return false;
        if (!this.haveDifferentDimensions(frontendDimensions, backendDimensions)) return false;
        if (this.isBackendCacheStaleForLivePreviewChange(backendDimensions)) return false;

        const backendTimestampMs = Number(backendDimensions.timestamp) * 1000;
        if (!Number.isFinite(backendTimestampMs)) return false;

        const previousBackendTimestampMs = Number(previousBackendTimestamp) * 1000;
        if (Number.isFinite(previousBackendTimestampMs)) {
            return backendTimestampMs > previousBackendTimestampMs;
        }

        return Number.isFinite(this.autoDetectStartedAtMs)
            && backendTimestampMs >= this.autoDetectStartedAtMs;
    },

    refreshLivePreviewWatcher(scheduleOnChange = true) {
        if (!this.node?.properties?.autoDetect) {
            this.teardownLivePreviewWatcher();
            return;
        }

        const sourceNode = this.getConnectedSourceNode();
        if (sourceNode !== this.watchedLivePreviewSourceNode) {
            this.teardownLivePreviewWatcher();
            this.watchedLivePreviewSourceNode = sourceNode;
            this.lastLivePreviewSignature = null;
        }

        if (!sourceNode) {
            this.detachLivePreviewElementWatcher();
            this.detachLivePreviewWidgetWatchers();
            detachSourceDetectorWatchers(this);
            return;
        }

        this.attachLivePreviewWidgetWatchers(sourceNode);
        this.attachLivePreviewElementWatcher(sourceNode?.imgs?.[0]);
        attachSourceDetectorWatchers(this, sourceNode);

        const dimensions = this.getConnectedPreviewDimensions();
        const nextSignature = dimensions?.signature || null;
        if (nextSignature !== this.lastLivePreviewSignature) {
            this.lastLivePreviewSignature = nextSignature;
            if (nextSignature) {
                this.clearLivePreviewPending();
            } else {
                this.markLivePreviewPending('frontend preview cleared');
            }
            if (scheduleOnChange) {
                this.scheduleAutoDetectCheck(nextSignature ? 'frontend preview changed' : 'frontend preview cleared', 0);
            }
        }
    },

    teardownLivePreviewWatcher() {
        this.detachLivePreviewElementWatcher();
        this.detachLivePreviewWidgetWatchers();
        detachSourceDetectorWatchers(this);
        this.watchedLivePreviewSourceNode = null;
        this.lastLivePreviewSignature = null;
        this.clearLivePreviewPending();
    },

    detachLivePreviewElementWatcher() {
        if (this.watchedLivePreviewElement && this.livePreviewElementChangeHandler) {
            this.watchedLivePreviewElement.removeEventListener?.('load', this.livePreviewElementChangeHandler);
            this.watchedLivePreviewElement.removeEventListener?.('error', this.livePreviewElementChangeHandler);
        }
        this.watchedLivePreviewElement = null;
    },

    attachLivePreviewElementWatcher(preview) {
        if (preview === this.watchedLivePreviewElement) return;

        this.detachLivePreviewElementWatcher();
        this.watchedLivePreviewElement = preview || null;

        if (!preview?.addEventListener) return;

        if (!this.livePreviewElementChangeHandler) {
            this.livePreviewElementChangeHandler = () => {
                this.markLivePreviewPending('preview image event');
                this.scheduleAutoDetectCheck('preview image event', 0);
            };
        }

        preview.addEventListener('load', this.livePreviewElementChangeHandler);
        preview.addEventListener('error', this.livePreviewElementChangeHandler);
    },

    detachLivePreviewWidgetWatchers() {
        if (!this.watchedLivePreviewWidgets?.size || !this.livePreviewWidgetChangeHandler) {
            this.watchedLivePreviewWidgets = new Set();
            return;
        }

        for (const widget of this.watchedLivePreviewWidgets) {
            widget?.[AUTO_DETECT_WIDGET_WATCHERS_PROP]?.delete(this.livePreviewWidgetChangeHandler);
            if (
                widget?.[AUTO_DETECT_WIDGET_WATCHERS_PROP]?.size === 0 &&
                widget.callback === widget[AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP]
            ) {
                widget.callback = widget[AUTO_DETECT_WIDGET_ORIGINAL_CALLBACK_PROP];
                delete widget[AUTO_DETECT_WIDGET_WATCHERS_PROP];
                delete widget[AUTO_DETECT_WIDGET_ORIGINAL_CALLBACK_PROP];
                delete widget[AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP];
            }
        }

        this.watchedLivePreviewWidgets = new Set();
    },

    attachLivePreviewWidgetWatchers(sourceNode) {
        const nextWidgets = new Set((sourceNode?.widgets || []).filter(isLivePreviewWidget));
        const currentWidgets = this.watchedLivePreviewWidgets || new Set();
        let changed = currentWidgets.size !== nextWidgets.size;
        if (!changed) {
            for (const widget of nextWidgets) {
                if (
                    !currentWidgets.has(widget) ||
                    widget.callback !== widget[AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP]
                ) {
                    changed = true;
                    break;
                }
            }
        }
        if (!changed) return;

        this.detachLivePreviewWidgetWatchers();
        this.watchedLivePreviewWidgets = nextWidgets;

        if (!this.livePreviewWidgetChangeHandler) {
            this.livePreviewWidgetChangeHandler = () => {
                this.markLivePreviewPending('source widget changed');
                this.scheduleAutoDetectCheck('source widget changed', 0);
                globalThis.requestAnimationFrame?.(() => this.scheduleAutoDetectCheck('source widget changed after frame', 0));
            };
        }

        for (const widget of nextWidgets) {
            if (
                !widget[AUTO_DETECT_WIDGET_WATCHERS_PROP] ||
                widget.callback !== widget[AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP]
            ) {
                const originalCallback = widget.callback;
                const watchers = widget[AUTO_DETECT_WIDGET_WATCHERS_PROP] || new Set();
                const patchedCallback = function(...args) {
                    const notifyWatchers = () => {
                        try {
                            widget[AUTO_DETECT_WIDGET_WATCHERS_PROP]?.forEach(watcher => watcher());
                        } catch (error) {
                            log.debug('Live preview widget watcher failed:', error);
                        }
                    };

                    let result;
                    try {
                        result = originalCallback?.apply(this, args);
                    } catch (error) {
                        notifyWatchers();
                        throw error;
                    }

                    if (typeof result?.then === "function") {
                        result.then(notifyWatchers, notifyWatchers);
                    } else {
                        notifyWatchers();
                    }
                    return result;
                };

                widget[AUTO_DETECT_WIDGET_WATCHERS_PROP] = watchers;
                widget[AUTO_DETECT_WIDGET_ORIGINAL_CALLBACK_PROP] = originalCallback;
                widget[AUTO_DETECT_WIDGET_PATCHED_CALLBACK_PROP] = patchedCallback;
                widget.callback = patchedCallback;
            }

            widget[AUTO_DETECT_WIDGET_WATCHERS_PROP].add(this.livePreviewWidgetChangeHandler);
        }
    },

    setAutoDetectSource(source) {
        const normalizedSource = ['frontend', 'frontend-empty'].includes(source) ? source : 'backend';
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

    syncAutoDetectSourceState() {
        if (!this.node?.properties?.autoDetect) return;

        const sourceNode = this.getConnectedSourceNode();
        if (shouldSuppressBackendFallback(sourceNode)) {
            this.setAutoDetectSource('frontend-empty');
            this.setRawAutoDetectDimensions(null);
        } else if (this.node.properties.autoDetectSource === 'frontend-empty') {
            this.setAutoDetectSource('backend');
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

        const sourceNode = this.getConnectedSourceNode();
        const previewDimensions = getSourceDimensions(sourceNode);
        if (shouldSuppressBackendFallback(sourceNode)) {
            return {
                text: "Live: no selection",
                color: [150, 150, 150],
                textColor: "#aaa"
            };
        }
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
        if (this._isCheckingDimensions) {
            this._pendingDimensionCheck = true;
            return;
        }

        const node = this.node;
        this._isCheckingDimensions = true;
        try {
            this.refreshLivePreviewWatcher(false);
            if (!node.inputs?.[0]?.link) {
                if (this.detectedDimensions) {
                    log.debug('Auto-detect dimensions cleared because input is disconnected', {
                        nodeId: node.id ?? null
                    });
                }
                this.detectedDimensions = null;
                this.setAutoDetectSource('backend');
                this.setRawAutoDetectDimensions(null);
                return;
            }

            const sourceNode = this.getConnectedSourceNode();
            const previewDimensions = getSourceDimensions(sourceNode);
            const suppressBackendFallback = shouldSuppressBackendFallback(sourceNode);
            if (previewDimensions) {
                this.clearLivePreviewPending();
            } else if (suppressBackendFallback) {
                if (this.detectedDimensions) {
                    log.debug('Auto-detect dimensions cleared because frontend source has no active selection', {
                        nodeId: node.id ?? null
                    });
                }
                this.clearLivePreviewPending();
                this.detectedDimensions = null;
                this.setAutoDetectSource('frontend-empty');
                this.setRawAutoDetectDimensions(null);
                return;
            } else if (this.isAwaitingLivePreview()) {
                this.scheduleAutoDetectCheck('waiting for frontend preview', AUTO_DETECT_FRONTEND_PREVIEW_RETRY_MS);
                return;
            }

            const previousBackendTimestamp = this.lastBackendDimensionsTimestamp;
            const backendDimensions = await this.getBackendDetectedDimensions();
            const backendCacheIsStale = this.isBackendCacheStaleForLivePreviewChange(backendDimensions);
            if (!previewDimensions && backendCacheIsStale) {
                log.debug('Ignoring stale backend dimensions after frontend source change', {
                    nodeId: node.id ?? null,
                    width: backendDimensions.width,
                    height: backendDimensions.height,
                    backendTimestamp: backendDimensions.timestamp,
                    livePreviewChangeAt: this.lastLivePreviewChangeAtMs
                });
                this.scheduleAutoDetectCheck('stale backend cache ignored', AUTO_DETECT_FALLBACK_POLL_INTERVAL_MS);
                return;
            }

            let dimensions = previewDimensions || backendDimensions;
            if (this.shouldPreferBackendDimensions(previewDimensions, backendDimensions, previousBackendTimestamp)) {
                log.debug('Backend dimensions corrected frontend auto-detect result', {
                    nodeId: node.id ?? null,
                    frontendWidth: previewDimensions.width,
                    frontendHeight: previewDimensions.height,
                    backendWidth: backendDimensions.width,
                    backendHeight: backendDimensions.height,
                    backendTimestamp: backendDimensions.timestamp
                });
                dimensions = backendDimensions;
            }
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

            this.setAutoDetectSource(dimensions.source === 'frontend' ? 'frontend' : 'backend');
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
        } finally {
            this._isCheckingDimensions = false;
            if (this._pendingDimensionCheck) {
                this._pendingDimensionCheck = false;
                this.scheduleAutoDetectCheck('pending dimensions check', 0);
            }
        }
    },

    getConnectedSourceNode() {
        const inputLink = this.node.inputs?.[0]?.link;
        if (!inputLink || !this.app?.graph?.links) return null;

        const link = this.app.graph.links[inputLink];
        if (!link) return null;

        return this.app.graph.getNodeById(link.origin_id) || null;
    },

    getConnectedPreviewDimensions() {
        const sourceNode = this.getConnectedSourceNode();
        return getSourceDimensions(sourceNode);
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
