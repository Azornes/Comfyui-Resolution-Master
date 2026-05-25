import { createModuleLogger } from "../log_system/log_funcs.js";
import { DEFAULT_NODE_PROPERTIES } from "./default_node_properties.js";

const log = createModuleLogger('resolution_master_node_lifecycle');

export const nodeLifecycleMethods = {
    initializeProperties() {
        Object.entries(DEFAULT_NODE_PROPERTIES).forEach(([key, defaultValue]) => {
            this.node.properties[key] = this.node.properties[key] ?? defaultValue;
        });
    },

    ensureMinimumSize() {
        if (this.node.size[0] < 330) {
            this.node.size[0] = 330;
        }
        const neededHeight = this.calculateNeededHeight();
        const preferredHeight = this.userPreferredHeight ?? this.getStoredPreferredHeight() ?? 0;
        const targetHeight = Math.max(neededHeight, preferredHeight, this.node.min_size[1]);

        if (Math.abs(this.node.size[1] - targetHeight) > 1) {
            this._isApplyingAutoSize = true;
            this.node.size[1] = targetHeight;
            this._isApplyingAutoSize = false;
        }
    },

    calculateNeededHeight() {
        const props = this.node.properties;
        if (!props || props.mode !== "Manual") return 0;

        let currentY = this.getManualContentStartY();
        const spacing = this.getManualSpacing();
        const canvasHeight = this.getManualCanvasHeight(currentY, false);
        currentY += canvasHeight + this.getCanvasInfoGap();
        currentY += 15 + spacing;
        if (this.collapsedSections?.extraControls) {
            return currentY + 20;
        }
        const sectionHeights = {
            actions: this.collapsedSections?.actions ? 25 : 55,
            scaling: this.collapsedSections?.scaling ? 25 : 130,
            autoDetect: this.collapsedSections?.autoDetect ? 25 : 135,
            presets: this.collapsedSections?.presets ? 25 : 55
        };
        Object.values(sectionHeights).forEach(height => {
            currentY += height + spacing;
        });
        if (props.showCalcInfo && props.selectedCategory) {
            currentY += this.measureCalcInfoMessage().boxHeight + spacing;
        }

        return currentY + 20;
    },

    getManualContentStartY() {
        return this.collapsedSections?.extraControls ? 2 : LiteGraph.NODE_TITLE_HEIGHT + 2;
    },

    getManualSpacing() {
        return this.collapsedSections?.extraControls ? 4 : 8;
    },

    getCanvasInfoGap() {
        return this.collapsedSections?.extraControls ? 4 : this.getManualSpacing();
    },

    getManualBottomPadding() {
        return this.collapsedSections?.extraControls ? 8 : 20;
    },

    getManualCanvasHeight(currentY = this.getManualContentStartY(), useAvailableHeight = true) {
        if (!this.collapsedSections?.extraControls) {
            return 200;
        }

        if (!useAvailableHeight) {
            return 200;
        }

        const spacing = this.getManualSpacing();
        const bottomContentHeight = this.collapsedSections?.extraControls
            ? 15 + this.getManualBottomPadding()
            : this.getCanvasInfoGap() + 15 + spacing + this.getManualBottomPadding();
        const availableHeight = this.node.size[1] - currentY - bottomContentHeight;
        return Math.max(200, availableHeight);
    },

    normalizeInputSlots() {
        if (!Array.isArray(this.node.inputs) || this.node.inputs.length <= 1) {
            return;
        }

        const inputCount = this.node.inputs.length;
        const keepIndex = this.node.inputs.findIndex(input => input?.link != null);
        const canonicalInput = this.node.inputs[keepIndex >= 0 ? keepIndex : 0];
        canonicalInput.name = canonicalInput.localized_name = "input_image";
        canonicalInput.hidden = false;
        this.node.inputs = [canonicalInput];

        const nodeId = this.node.id ?? null;
        if (nodeId !== -1 && !this.node._resolutionMasterLoggedInputSlotNormalization) {
            this.node._resolutionMasterLoggedInputSlotNormalization = true;
            log.debug('Normalized duplicate ResolutionMaster input slots', {
                nodeId,
                inputCount,
                keptIndex: keepIndex >= 0 ? keepIndex : 0
            });
        }
    },

    applyCompactSlotLabels() {
        this.normalizeInputSlots();
        const isCompact = this.collapsedSections?.extraControls || false;

        this.node.inputs?.forEach(input => {
            input.name = "input_image";
            input.hidden = false;

            if (isCompact) {
                input.label = " ";
                input.localized_name = " ";
                input.displayName = " ";
            } else {
                input.label = "input_image";
                input.localized_name = "input_image";
                input.displayName = "input_image";
            }
        });

        if (!this.node._resolutionMasterHasStoredGetInputLabel) {
            this.node._resolutionMasterOriginalGetInputLabel = this.node.getInputLabel;
            this.node._resolutionMasterHasStoredGetInputLabel = true;
        }
        if (isCompact) {
            this.node.getInputLabel = function(slot) {
                if (slot === 0) return " ";
                return this._resolutionMasterOriginalGetInputLabel
                    ? this._resolutionMasterOriginalGetInputLabel.call(this, slot)
                    : this.inputs?.[slot]?.localized_name || this.inputs?.[slot]?.name || " ";
            };
        } else if (this.node._resolutionMasterHasStoredGetInputLabel) {
            this.node.getInputLabel = function(slot) {
                if (slot === 0) return "input_image";
                return this._resolutionMasterOriginalGetInputLabel
                    ? this._resolutionMasterOriginalGetInputLabel.call(this, slot)
                    : this.inputs?.[slot]?.localized_name || this.inputs?.[slot]?.name || "";
            };
        }

        this.node.outputs?.forEach(output => {
            output.hidden = false;
            output.name = output.localized_name = "";
        });
    },

    setupNode() {
        const node = this.node;
        const self = this;
        node.resolutionMaster = this;
        this.installCanvasDragZoomBypass();
        node.size = [330, 400];
        node.min_size = [330, 200];
        this.applyCompactSlotLabels();
        if (node.outputs) {
            node.outputs.forEach(output => {
                output.hidden = false;
                output.name = output.localized_name = "";
            });
        }
        const widthWidget = node.widgets?.find(w => w.name === 'width');
        const heightWidget = node.widgets?.find(w => w.name === 'height');
        const modeWidget = node.widgets?.find(w => w.name === 'mode');
        const latentTypeWidget = node.widgets?.find(w => w.name === 'latent_type');
        const autoDetectWidget = node.widgets?.find(w => w.name === 'auto_detect');
        const autoDetectSourceWidget = node.widgets?.find(w => w.name === 'auto_detect_source');
        const autoDetectWidthWidget = node.widgets?.find(w => w.name === 'auto_detect_width');
        const autoDetectHeightWidget = node.widgets?.find(w => w.name === 'auto_detect_height');
        const autoFitOnChangeWidget = node.widgets?.find(w => w.name === 'auto_fit_on_change');
        const autoResizeOnChangeWidget = node.widgets?.find(w => w.name === 'auto_resize_on_change');
        const autoSnapOnChangeWidget = node.widgets?.find(w => w.name === 'auto_snap_on_change');
        const smartFitWidget = node.widgets?.find(w => w.name === 'smart_fit');
        const useCustomCalcWidget = node.widgets?.find(w => w.name === 'use_custom_calc');
        const preserveScalingRatioWidget = node.widgets?.find(w => w.name === 'preserve_scaling_ratio');
        const selectedCategoryWidget = node.widgets?.find(w => w.name === 'selected_category');
        const snapValueWidget = node.widgets?.find(w => w.name === 'snap_value');
        const upscaleValueWidget = node.widgets?.find(w => w.name === 'upscale_value');
        const targetResolutionWidget = node.widgets?.find(w => w.name === 'target_resolution');
        const targetMegapixelsWidget = node.widgets?.find(w => w.name === 'target_megapixels');
        const autoDetectPresetsJSONWidget = node.widgets?.find(w => w.name === 'auto_detect_presets_json');
        const rescaleModeWidget = node.widgets?.find(w => w.name === 'rescale_mode');
        const rescaleValueWidget = node.widgets?.find(w => w.name === 'rescale_value');
        const batchSizeWidget = node.widgets?.find(w => w.name === 'batch_size');
        if (!widthWidget || !heightWidget) {
            log.error('ResolutionMaster required dimension widgets were not found', {
                nodeId: node.id ?? null,
                hasWidthWidget: !!widthWidget,
                hasHeightWidget: !!heightWidget,
                widgetNames: node.widgets?.map(widget => widget.name) || []
            });
        }
        if (rescaleModeWidget) {
            rescaleModeWidget.value = node.properties.rescaleMode;
        }
        if (rescaleValueWidget) {
            const rescaleValue = Math.max(0, Math.min(100, Number(node.properties.rescaleValue) || 1));
            node.properties.rescaleValue = rescaleValue;
            rescaleValueWidget.value = rescaleValue;
        }
        if (autoDetectSourceWidget) {
            autoDetectSourceWidget.value = node.properties.autoDetectSource || "backend";
        }
        if (autoDetectWidthWidget) {
            autoDetectWidthWidget.value = node.properties.autoDetectWidth || 0;
        }
        if (autoDetectHeightWidget) {
            autoDetectHeightWidget.value = node.properties.autoDetectHeight || 0;
        }
        if (widthWidget && heightWidget) {
            node.properties.valueX = widthWidget.value;
            node.properties.valueY = heightWidget.value;
            node.intpos.x = (widthWidget.value - node.properties.canvas_min_x) / (node.properties.canvas_max_x - node.properties.canvas_min_x);
            node.intpos.y = (heightWidget.value - node.properties.canvas_min_y) / (node.properties.canvas_max_y - node.properties.canvas_min_y);
        }
        if (batchSizeWidget) {
            node.properties.batch_size = batchSizeWidget.value;
        }
        this.widthWidget = widthWidget;
        this.heightWidget = heightWidget;
        this.latentTypeWidget = latentTypeWidget;
        this.autoDetectSourceWidget = autoDetectSourceWidget;
        this.autoDetectWidthWidget = autoDetectWidthWidget;
        this.autoDetectHeightWidget = autoDetectHeightWidget;
        this.backendFallbackWidgets = {
            autoFitOnChange: autoFitOnChangeWidget,
            autoResizeOnChange: autoResizeOnChangeWidget,
            autoSnapOnChange: autoSnapOnChangeWidget,
            smartFit: smartFitWidget,
            useCustomCalc: useCustomCalcWidget,
            preserveScalingRatio: preserveScalingRatioWidget,
            selectedCategory: selectedCategoryWidget,
            snapValue: snapValueWidget,
            upscaleValue: upscaleValueWidget,
            targetResolution: targetResolutionWidget,
            targetMegapixels: targetMegapixelsWidget,
            autoDetectPresetsJSON: autoDetectPresetsJSONWidget
        };
        this.rescaleModeWidget = rescaleModeWidget;
        this.rescaleValueWidget = rescaleValueWidget;
        this.batchSizeWidget = batchSizeWidget;
        // Latent type is manually controlled via LAT selector.
        node.onDrawForeground = function(ctx) {
            if (this.flags.collapsed) return;
            self.ensureMinimumSize();
            self.drawInterface(ctx);
        };
        node.onMouseDown = function(e, pos, canvas) {
            const relX = e.canvasX - this.pos[0];
            const relY = e.canvasY - this.pos[1];
            if (self.controls.compactHelpBtn && self.isPointInControl(relX, relY, self.controls.compactHelpBtn)) {
                self.showHelpDialog();
                return true;
            }
            if (self.controls.compactToggleBtn && self.isPointInControl(relX, relY, self.controls.compactToggleBtn)) {
                self.handleSectionHeaderClick('extraControlsHeader');
                return true;
            }
            if (relY < 0) return false;
            return self.handleMouseDown(e, pos, canvas);
        };

        node.onMouseMove = function(e, pos, canvas) {
            if (!this.capture) {
                self.handleMouseHover(e, pos, canvas);
                return false;
            }
            return self.handleMouseMove(e, pos, canvas);
        };

        node.onMouseUp = function(e) {
            if (!this.capture) return false;
            return self.handleMouseUp(e);
        };

        node.onPropertyChanged = function(property) {
            self.handlePropertyChange(property);
        };
        const origOnConnectionsChange = node.onConnectionsChange;
        node.onConnectionsChange = function() {
            const result = origOnConnectionsChange?.apply(this, arguments);
            self.applyCompactSlotLabels();
            if (self.node.properties.autoDetect) {
                self.markLivePreviewPending('connection changed');
                self.refreshLivePreviewWatcher();
                self.scheduleAutoDetectCheck('connection changed', 0);
            } else {
                self.teardownLivePreviewWatcher();
            }
            return result;
        };
        const origOnSerialize = node.onSerialize;
        node.onSerialize = function() {
            self.syncAutoDetectSourceState();
            self.syncBackendFallbackWidgets();
            if (origOnSerialize) return origOnSerialize.apply(this, arguments);
        };
        node.onResize = function() {
            if (!self._isApplyingAutoSize) {
                self.storePreferredHeight(this.size[1]);
            }
            self.ensureMinimumSize();
            self.requestCanvasUpdate(true);
        };
        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            self.stopAutoDetect();
            if (self.tooltipTimer) {
                clearTimeout(self.tooltipTimer);
                self.tooltipTimer = null;
            }
            if (self.customValueDialogManager.customInputDialog) {
                self.customValueDialogManager.closeCustomInputDialog();
            }
            if (origOnRemoved) origOnRemoved.apply(this, arguments);
        };
        node.onGraphConfigured = function() {
            this.configured = true;

            // Defer initialization to next frame to avoid interfering with ComfyUI's graph setup.
            requestAnimationFrame(() => {
                if (!this.graph) return;

                self.customPresetsManager.loadCustomPresets();
                log.debug('Reloaded custom presets after graph configured');

                self.collapsedSections = {
                    actions: this.properties.section_actions_collapsed,
                    scaling: this.properties.section_scaling_collapsed,
                    autoDetect: this.properties.section_autoDetect_collapsed,
                    presets: this.properties.section_presets_collapsed,
                    extraControls: this.properties.section_extraControls_collapsed
                };
                self.userPreferredHeight = self.getStoredPreferredHeight();
                self.applyCompactSlotLabels();

                // Update internal position from saved properties.
                self.updateCanvasFromWidgets();
                self.updateRescaleValue();

                // Start auto-detect after everything is initialized.
                if (this.properties.autoDetect) {
                    self.startAutoDetect();
                }
            });
        };
        [
            widthWidget,
            heightWidget,
            modeWidget,
            latentTypeWidget,
            autoDetectWidget,
            autoDetectSourceWidget,
            autoDetectWidthWidget,
            autoDetectHeightWidget,
            ...Object.values(this.backendFallbackWidgets),
            rescaleModeWidget,
            rescaleValueWidget,
            batchSizeWidget
        ].forEach(widget => {
            if (widget) {
                widget.hidden = true;
                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
            }
        });
        this.syncBackendFallbackWidgets();
        log.debug('ResolutionMaster node lifecycle hooks installed', {
            nodeId: node.id ?? null,
            hasAutoDetectWidget: !!autoDetectWidget,
            hasLatentTypeWidget: !!latentTypeWidget,
            hiddenWidgetCount: node.widgets?.filter(widget => widget.hidden).length || 0
        });
    },

    getPreferredHeightPropertyKey(isCompact = this.collapsedSections?.extraControls) {
        return isCompact ? 'preferred_compact_height' : 'preferred_expanded_height';
    },

    getStoredPreferredHeight(isCompact = this.collapsedSections?.extraControls) {
        const value = Number(this.node.properties?.[this.getPreferredHeightPropertyKey(isCompact)]);
        return Number.isFinite(value) && value > 0 ? value : null;
    },

    storePreferredHeight(height = this.node.size?.[1], isCompact = this.collapsedSections?.extraControls) {
        const value = Math.max(Number(height) || 0, this.node.min_size?.[1] || 0);
        if (value > 0) {
            this.node.properties[this.getPreferredHeightPropertyKey(isCompact)] = value;
        }
        this.userPreferredHeight = value || null;
    }
};
