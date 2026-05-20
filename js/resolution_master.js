import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./log_system/log_funcs.js";
import { loadIcons } from "./utils/icon_utils.js";
import { tooltips, presetCategories } from "./utils/resolution_master_config.js";
import { DialogManager } from "./dialog_manager.js";
import { SearchableDropdown } from "./searchable_dropdown.js";
import { AspectRatioSelector } from "./aspect_ratio_selector.js";
import { CustomPresetsManager } from "./utils/custom_presets_manager.js";
import { PresetManagerDialog } from "./utils/preset_manager_dialog.js";
const log = createModuleLogger('resolution_master');

class ResolutionMasterCanvas {    
    constructor(node) {
        this.node = node;
        this.node.properties = this.node.properties || {};
        this.initializeProperties();
        this.collapsedSections = {
            actions: this.node.properties.section_actions_collapsed,
            scaling: this.node.properties.section_scaling_collapsed,
            autoDetect: this.node.properties.section_autoDetect_collapsed,
            presets: this.node.properties.section_presets_collapsed,
            extraControls: this.node.properties.section_extraControls_collapsed
        };
        this.node.intpos = { x: 0.5, y: 0.5 };
        this.node.capture = false;
        this.node.configured = false;
        this._isInitializing = true; // Flag to prevent setDirtyCanvas during init
        this._pendingCanvasUpdate = false;
        this._isApplyingAutoSize = false;
        this.userPreferredHeight = this.getStoredPreferredHeight();
        this.hoverElement = null;
        this.scrollOffset = 0;
        this.dropdownOpen = null;
        this.dialogManager = new DialogManager(this);
        this.searchableDropdown = new SearchableDropdown();
        this.aspectRatioSelector = new AspectRatioSelector();
        this.customPresetsManager = new CustomPresetsManager(this);
        this.presetManagerDialog = new PresetManagerDialog(this.customPresetsManager);
        this.tooltipElement = null;
        this.tooltipTimer = null;
        this.tooltipDelay = 500; 
        this.showTooltip = false;
        this.tooltipMousePos = null; 
        this.detectedDimensions = null;
        this.lastBackendDimensionsTimestamp = null;
        this.dimensionCheckInterval = null;
        this.manuallySetByAutoFit = false;
        this.canvasDragAspectLock = null;
        this.canvasDotsCache = null;
        this.controls = {};
        this.resolutions = ['144p', '240p', '360p', '480p', '720p', '820p', '1080p', '1440p', '2160p', '4320p'];

        this.icons = {};
        loadIcons(this.icons);
        this.tooltips = tooltips;
        this.presetCategories = presetCategories;
        
        this.setupNode();
        import('./css_loader.js').then(module => {
            module.loadStylesWhenNeeded();
        }).catch(error => {
            log.error('Failed to load CSS:', error);
        });
        
        // Mark initialization complete after a short delay to allow ComfyUI to finish setup
        requestAnimationFrame(() => {
            this._isInitializing = false;
        });
    }
    
    /**
     * Safely request a canvas update - prevents multiple rapid updates during initialization
     * and graph configuration that can cause ComfyUI freezing issues
     */
    requestCanvasUpdate(force = false) {
        // Skip updates during initialization unless forced
        if (this._isInitializing && !force) {
            this._pendingCanvasUpdate = true;
            return;
        }
        
        // Ensure graph exists and is ready
        if (!app.graph) {
            this._pendingCanvasUpdate = true;
            return;
        }
        
        // Use requestAnimationFrame to batch updates and avoid conflicts
        if (!this._canvasUpdateScheduled) {
            this._canvasUpdateScheduled = true;
            requestAnimationFrame(() => {
                this._canvasUpdateScheduled = false;
                this._pendingCanvasUpdate = false;
                if (app.graph) {
                    app.graph.setDirtyCanvas(true);
                }
            });
        }
    }
    
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
    }
    
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
    }
    
    initializeProperties() {
        const defaultProperties = {
            mode: "Manual",
            valueX: 512,
            valueY: 512,
            batch_size: 1,
            canvas_min_x: 0,
            canvas_max_x: 2048,
            canvas_step_x: 64,
            canvas_min_y: 0,
            canvas_max_y: 2048,
            canvas_step_y: 64,
            canvas_decimals_x: 0,
            canvas_decimals_y: 0,
            canvas_snap: true,
            canvas_dots: true,
            canvas_frame: true,
            action_slider_snap_min: 16,
            action_slider_snap_max: 256,
            action_slider_snap_step: 16,
            scaling_slider_min: 0.1,
            scaling_slider_max: 4.0,
            scaling_slider_step: 0.1,
            megapixels_slider_min: 0.5,
            megapixels_slider_max: 6.0,
            megapixels_slider_step: 0.1,
            snapValue: 64,
            upscaleValue: 1.0,
            targetResolution: 1080,
            targetMegapixels: 2.0,
            rescaleMode: "resolution",
            rescaleValue: 1.0,
            preserveScalingRatio: false,
            autoDetect: false,
            autoDetectSource: "backend",
            autoDetectWidth: 0,
            autoDetectHeight: 0,
            autoDetectPresetsJSON: "{}",
            autoFitOnChange: false,
            autoResizeOnChange: false,
            autoSnapOnChange: false,
            selectedCategory: "Standard",
            selectedPreset: null,
            useCustomCalc: false,
            showCalcInfo: false,
            manual_slider_min_w: 64,
            manual_slider_max_w: 2048,
            manual_slider_step_w: 64,
            manual_slider_min_h: 64,
            manual_slider_max_h: 2048,
            manual_slider_step_h: 64,
            section_actions_collapsed: false,
            section_scaling_collapsed: false,
            section_autoDetect_collapsed: false,
            section_presets_collapsed: false,
            section_extraControls_collapsed: false,
            preferred_compact_height: null,
            preferred_expanded_height: null,
            dropdown_resolution_expanded: false,
            dropdown_category_expanded: false,
            dropdown_preset_expanded: false,
            preset_selector_mode: 'visual', 
            customPresetsJSON: '',
        };

        Object.entries(defaultProperties).forEach(([key, defaultValue]) => {
            this.node.properties[key] = this.node.properties[key] ?? defaultValue;
        });
    }

    getManualContentStartY() {
        return this.collapsedSections?.extraControls ? 2 : LiteGraph.NODE_TITLE_HEIGHT + 2;
    }

    getManualSpacing() {
        return this.collapsedSections?.extraControls ? 4 : 8;
    }

    getCanvasInfoGap() {
        return this.collapsedSections?.extraControls ? 4 : this.getManualSpacing();
    }

    getManualBottomPadding() {
        return this.collapsedSections?.extraControls ? 8 : 20;
    }

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
    }

    normalizeInputSlots() {
        if (!Array.isArray(this.node.inputs) || this.node.inputs.length <= 1) {
            return;
        }

        const keepIndex = this.node.inputs.findIndex(input => input?.link != null);
        const canonicalInput = this.node.inputs[keepIndex >= 0 ? keepIndex : 0];
        canonicalInput.name = canonicalInput.localized_name = "input_image";
        canonicalInput.hidden = false;
        this.node.inputs = [canonicalInput];
    }

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
    }
    
    
    setupNode() {
        const node = this.node;
        const self = this;
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
        if (rescaleModeWidget) {
            rescaleModeWidget.value = node.properties.rescaleMode;
        }
        if (rescaleValueWidget) {
            rescaleValueWidget.value = node.properties.rescaleValue;
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
        // Latent type is now manually controlled via LAT selector - no automatic initialization based on category
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
            return result;
        };
        const origOnSerialize = node.onSerialize;
        node.onSerialize = function() {
            self.syncBackendFallbackWidgets();
            if (origOnSerialize) return origOnSerialize.apply(this, arguments);
        };
        node.onResize = function() {
            if (!self._isApplyingAutoSize) {
                self.storePreferredHeight(this.size[1]);
            }
            self.ensureMinimumSize();
            app.graph.setDirtyCanvas(true);
        };
        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            if (self.dimensionCheckInterval) {
                clearInterval(self.dimensionCheckInterval);
                self.dimensionCheckInterval = null;
            }
            if (self.tooltipTimer) {
                clearTimeout(self.tooltipTimer);
                self.tooltipTimer = null;
            }
            if (self.dialogManager.customInputDialog) {
                self.dialogManager.closeCustomInputDialog();
            }
            if (origOnRemoved) origOnRemoved.apply(this, arguments);
        };
        node.onGraphConfigured = function() {
            this.configured = true;
            
            // Defer initialization to next frame to avoid interfering with ComfyUI's graph setup
            requestAnimationFrame(() => {
                if (!this.graph) return; // Node was removed
                
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
                
                // Update internal position from saved properties
                self.updateCanvasFromWidgets();
                self.updateRescaleValue();
                
                // Start auto-detect after everything is initialized
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
    }
    
    drawInterface(ctx) {
        const node = this.node;
        const props = node.properties;
        const margin = 10;
        const spacing = this.getManualSpacing();
        
        let currentY = this.getManualContentStartY();
        
        if (props.mode === "Manual") {
            this.controls = {};
            
            const collapsibleSection = (title, sectionKey, drawContent) => {
                const contentHeight = drawContent(ctx, currentY + 25, true);
                const sectionInfo = this.drawCollapsibleSection(ctx, title, sectionKey, margin, currentY, node.size[0] - margin * 2, contentHeight);
                
                if (!sectionInfo.isCollapsed) {
                    drawContent(ctx, sectionInfo.contentStartY, false);
                }
                
                currentY += sectionInfo.totalHeight + spacing;
            };

            const canvasHeight = this.getManualCanvasHeight(currentY);
            const canvasPadding = this.collapsedSections.extraControls ? 8 : 20;
            this.draw2DCanvas(ctx, margin, currentY, node.size[0] - margin * 2, canvasHeight, canvasPadding);
            currentY += canvasHeight + this.getCanvasInfoGap();

            const infoY = this.lastCanvasBounds
                ? this.lastCanvasBounds.y + this.lastCanvasBounds.h + 18
                : currentY;
            this.drawInfoText(ctx, infoY);
            currentY += 15 + spacing;

            if (this.collapsedSections.extraControls) {
            } else {
                collapsibleSection("Actions", "actions", (ctx, y, preview) => {
                    if (!preview) this.drawPrimaryControls(ctx, y);
                    return 30;
                });
                
                collapsibleSection("Scaling", "scaling", (ctx, y, preview) => {
                    if (!preview) return this.drawScalingGrid(ctx, y);
                    return 130;
                });
                
                collapsibleSection("Auto-Detect", "autoDetect", (ctx, y, preview) => {
                    if (!preview) return this.drawAutoDetectSection(ctx, y);
                    return 110;
                });
                
                collapsibleSection("Presets", "presets", (ctx, y, preview) => {
                    if (!preview) return this.drawPresetSection(ctx, y);
                    return 30;
                });
                if (props.showCalcInfo && props.selectedCategory) {
                    const messageHeight = this.drawInfoMessage(ctx, currentY);
                    if (messageHeight > 0) {
                        currentY += messageHeight + spacing;
                    }
                }
                this.drawOutputValues(ctx);
            }
            this.drawCompactToggleButton(ctx);

        } else if (props.mode === "Manual Sliders") {
            this.drawSliderMode(ctx, currentY);
        }
        
        if (this.showTooltip && this.tooltipElement && this.tooltips[this.tooltipElement]) {
            this.drawTooltip(ctx);
        }
    }

    drawSection(ctx, title, x, y, w, h) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ccc";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(title, x + w / 2, y + 10);
    }
    
    drawCollapsibleSection(ctx, title, sectionKey, x, y, w, contentHeight) {
        const isCollapsed = this.collapsedSections[sectionKey] || false;
        const headerHeight = 25;
        const totalHeight = isCollapsed ? headerHeight : headerHeight + contentHeight;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, totalHeight, 6);
        ctx.fill();
        ctx.stroke();
        const headerControl = `${sectionKey}Header`;
        this.controls[headerControl] = { x, y, w, h: headerHeight };
        
        if (this.hoverElement === headerControl) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.beginPath();
            ctx.roundRect(x, y, w, headerHeight, 6);
            ctx.fill();
        }
        const arrow = isCollapsed ? "▶" : "▼";
        const titleText = `${arrow} ${title}`;
        
        ctx.fillStyle = this.hoverElement === headerControl ? "#fff" : "#ccc";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.fillText(titleText, x + w / 2, y + headerHeight / 2);
        
        return { totalHeight, isCollapsed, contentStartY: y + headerHeight };
    }

    drawCompactToggleButton(ctx) {
        const isActive = this.collapsedSections.extraControls || false;
        const buttonSize = 18;
        const x = this.node.size[0] - buttonSize - 9;
        const y = -LiteGraph.NODE_TITLE_HEIGHT + 5;
        const helpX = x - buttonSize - 6;
        this.controls.compactHelpBtn = { x: helpX, y, w: buttonSize, h: buttonSize };
        this.controls.compactToggleBtn = { x, y, w: buttonSize, h: buttonSize };

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = this.hoverElement === 'compactHelpBtn'
            ? "rgba(255,255,255,0.65)"
            : "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(helpX, y, buttonSize, buttonSize, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.hoverElement === 'compactHelpBtn' ? "#fff" : "#cfcfcf";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", helpX + buttonSize / 2, y + buttonSize / 2 + 0.5);

        ctx.fillStyle = isActive ? "rgba(90, 170, 255, 0.45)" : "rgba(255,255,255,0.08)";
        ctx.strokeStyle = this.hoverElement === 'compactToggleBtn'
            ? "rgba(255,255,255,0.65)"
            : isActive ? "rgba(120, 190, 255, 0.85)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, buttonSize, buttonSize, 5);
        ctx.fill();
        ctx.stroke();

        const label = isActive ? "+" : "-";
        ctx.fillStyle = this.hoverElement === 'compactToggleBtn' || isActive ? "#fff" : "#cfcfcf";
        ctx.font = isActive ? "bold 13px Arial" : "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const metrics = ctx.measureText(label);
        const minusOffsetY = isActive ? 0 : 0.4;
        const textY = y + buttonSize / 2 - (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / 2 + metrics.actualBoundingBoxAscent + minusOffsetY;
        ctx.fillText(label, x + buttonSize / 2, textY);
    }

    drawOutputValues(ctx) {
        const node = this.node;
        const props = node.properties;
        
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        if (this.widthWidget && this.heightWidget && this.batchSizeWidget) {
            const y_offset_1 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 0.5);
            const y_offset_2 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 1.5);
            const y_offset_3 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 2.5);
            const y_offset_4 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 3.5);
            const valueAreaWidth = 60; 
            const batchSizeAreaWidth = 35; 
            const valueAreaHeight = 20;
            const valueAreaX = node.size[0] - valueAreaWidth - 5;
            const batchSizeAreaX = node.size[0] - batchSizeAreaWidth - 5;
            this.drawOutputValueArea(ctx, 'widthValueArea', valueAreaX, y_offset_1 - valueAreaHeight/2,
                valueAreaWidth, valueAreaHeight, this.widthWidget.value.toString(), y_offset_1,
                [136, 153, 255], "#89F", "#89F");
            this.drawOutputValueArea(ctx, 'heightValueArea', valueAreaX, y_offset_2 - valueAreaHeight/2,
                valueAreaWidth, valueAreaHeight, this.heightWidget.value.toString(), y_offset_2,
                [248, 136, 153], "#F89", "#F89");
            ctx.fillStyle = "#9F8";
            ctx.fillText(props.rescaleValue.toFixed(2), node.size[0] - 20, y_offset_3);
            this.drawOutputValueArea(ctx, 'batchSizeValueArea', batchSizeAreaX, y_offset_4 - valueAreaHeight/2,
                batchSizeAreaWidth, valueAreaHeight, this.batchSizeWidget.value.toString(), y_offset_4,
                [255, 136, 187], "#FAB", "#F8B");
            const y_offset_5 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 4.5);
            
            // Create clickable area for LAT selector
            const latAreaWidth = 50;
            const latAreaHeight = 28;
            const latAreaX = node.size[0] - latAreaWidth - 5;
            
            this.controls.latValueArea = {
                x: latAreaX,
                y: y_offset_5 - 10,
                w: latAreaWidth,
                h: latAreaHeight
            };
            
            this.drawValueAreaHoverBackground(ctx, 'latValueArea', latAreaX, y_offset_5 - 10, latAreaWidth, latAreaHeight, [248, 136, 187]);
            
            ctx.fillStyle = this.hoverElement === 'latValueArea' ? "#FAB" : "#F8B"; 
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "right";
            ctx.fillText("LAT", node.size[0] - 20, y_offset_5);
            
            // Draw latent type info in smaller gray font below LAT
            if (this.latentTypeWidget) {
                const latentType = this.latentTypeWidget.value || 'latent_4x8';
                const shortType = String(latentType).replace('latent_', '');
                ctx.fillStyle = this.hoverElement === 'latValueArea' ? "#999" : "#777"; 
                ctx.font = "9px Arial";
                ctx.textAlign = "right";
                ctx.fillText(shortType, node.size[0] - 20, y_offset_5 + 12);
            }
        }
    }

    getPreferredHeightPropertyKey(isCompact = this.collapsedSections?.extraControls) {
        return isCompact ? 'preferred_compact_height' : 'preferred_expanded_height';
    }

    getStoredPreferredHeight(isCompact = this.collapsedSections?.extraControls) {
        const value = Number(this.node.properties?.[this.getPreferredHeightPropertyKey(isCompact)]);
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    storePreferredHeight(height = this.node.size?.[1], isCompact = this.collapsedSections?.extraControls) {
        const value = Math.max(Number(height) || 0, this.node.min_size?.[1] || 0);
        if (value > 0) {
            this.node.properties[this.getPreferredHeightPropertyKey(isCompact)] = value;
        }
        this.userPreferredHeight = value || null;
    }

    drawOutputValueArea(ctx, controlName, x, y, w, h, text, textY, hoverColor, activeTextColor, textColor) {
        const node = this.node;
        this.controls[controlName] = { x, y, w, h };
        this.drawValueAreaHoverBackground(ctx, controlName, x, y, w, h, hoverColor);
        ctx.fillStyle = this.hoverElement === controlName ? activeTextColor : textColor;
        ctx.fillText(text, node.size[0] - 20, textY);
    }
    
    drawPrimaryControls(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const buttonWidth = 70;
        const gap = 5;
        let x = margin;

        this.controls.swapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.swap, this.hoverElement === 'swapBtn', false, "Swap", true);
        x += buttonWidth + gap;

        this.controls.snapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.snap, this.hoverElement === 'snapBtn', false, "Snap", true);
        x += buttonWidth + gap;

        const sliderX = x;
        const valueWidth = 35;
        const sliderWidth = node.size[0] - sliderX - valueWidth - margin;

        this.controls.snapSlider = { x: sliderX, y, w: sliderWidth, h: 28 };
        this.drawSlider(ctx, sliderX, y, sliderWidth, 28, props.snapValue, props.action_slider_snap_min, props.action_slider_snap_max, props.action_slider_snap_step);
        const snapValueX = sliderX + sliderWidth + gap;
        this.controls.snapValueArea = { x: snapValueX, y, w: valueWidth, h: 28 };
        
        this.drawValueAreaHoverBackground(ctx, 'snapValueArea', snapValueX, y, valueWidth, 28, [100, 150, 255]);

        ctx.fillStyle = this.hoverElement === 'snapValueArea' ? "#5af" : "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(props.snapValue.toString(), snapValueX + 10, y + 14);
    }
    
    draw2DCanvas(ctx, x, y, w, h, padding = 20) {
        const node = this.node;
        const props = node.properties;
        
        this.controls.canvas2d = { x, y, w, h };
        
        const rangeX = Math.max(1, props.canvas_max_x - props.canvas_min_x);
        const rangeY = Math.max(1, props.canvas_max_y - props.canvas_min_y);
        const aspectRatio = rangeX / rangeY;
        
        let canvasW = w - padding;
        let canvasH = h - padding;
        
        if (aspectRatio > canvasW / canvasH) {
            canvasH = canvasW / aspectRatio;
        } else {
            canvasW = canvasH * aspectRatio;
        }
        
        const offsetX = x + (w - canvasW) / 2;
        const offsetY = y + (h - canvasH) / 2;
        
        this.controls.canvas2d = { x: offsetX, y: offsetY, w: canvasW, h: canvasH };
        this.lastCanvasBounds = this.controls.canvas2d;
        
        ctx.fillStyle = "rgba(20,20,20,0.8)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(offsetX - 4, offsetY - 4, canvasW + 8, canvasH + 8, 6);
        ctx.fill();
        ctx.stroke();
        
        if (props.canvas_dots) {
            this.drawCachedCanvasDots(ctx, offsetX, offsetY, canvasW, canvasH, rangeX, rangeY);
        }
        
        if (props.canvas_frame) {
            ctx.fillStyle = "rgba(150,150,250,0.1)";
            ctx.strokeStyle = "rgba(150,150,250,0.7)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(offsetX, offsetY + canvasH * (1 - node.intpos.y), 
                    canvasW * node.intpos.x, canvasH * node.intpos.y);
            ctx.fill();
            ctx.stroke();
        }
        
        const knobX = offsetX + canvasW * node.intpos.x;
        const knobY = offsetY + canvasH * (1 - node.intpos.y);
        const rightEdgeX = offsetX + canvasW * node.intpos.x;
        const rightEdgeY = offsetY + canvasH * (1 - node.intpos.y / 2);
        const topEdgeX = offsetX + canvasW * node.intpos.x / 2;
        const topEdgeY = offsetY + canvasH * (1 - node.intpos.y);
        this.controls.canvas2dRightHandle = { 
            x: rightEdgeX - 10, 
            y: rightEdgeY - 10, 
            w: 20, 
            h: 20 
        };
        this.controls.canvas2dTopHandle = { 
            x: topEdgeX - 10, 
            y: topEdgeY - 10, 
            w: 20, 
            h: 20 
        };
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const isHoveringRight = this.hoverElement === 'canvas2dRightHandle';
        ctx.fillStyle = isHoveringRight ? "#5AF" : "#89F";
        ctx.strokeStyle = isHoveringRight ? "#FFF" : "#000";
        ctx.lineWidth = isHoveringRight ? 3 : 2;
        ctx.beginPath();
        ctx.arc(rightEdgeX, rightEdgeY, isHoveringRight ? 7 : 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const isHoveringTop = this.hoverElement === 'canvas2dTopHandle';
        ctx.fillStyle = isHoveringTop ? "#FAB" : "#F89";
        ctx.strokeStyle = isHoveringTop ? "#FFF" : "#000";
        ctx.lineWidth = isHoveringTop ? 3 : 2;
        ctx.beginPath();
        ctx.arc(topEdgeX, topEdgeY, isHoveringTop ? 7 : 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

    drawCachedCanvasDots(ctx, offsetX, offsetY, canvasW, canvasH, rangeX, rangeY) {
        const cache = this.getCanvasDotsCache(canvasW, canvasH, rangeX, rangeY);
        if (!cache?.path) return;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fill(cache.path);
        ctx.restore();
    }

    getCanvasDotsCache(canvasW, canvasH, rangeX, rangeY) {
        const props = this.node.properties;
        if (![canvasW, canvasH, rangeX, rangeY].every(value => Number.isFinite(value) && value > 0)) {
            return null;
        }

        const cacheW = Math.max(1, canvasW);
        const cacheH = Math.max(1, canvasH);
        const stepX = Math.max(Number(props.canvas_step_x) || 1, 1);
        const stepY = Math.max(Number(props.canvas_step_y) || 1, 1);
        const signature = [
            cacheW.toFixed(3),
            cacheH.toFixed(3),
            props.canvas_min_x,
            props.canvas_max_x,
            props.canvas_min_y,
            props.canvas_max_y,
            stepX,
            stepY
        ].join("|");

        if (this.canvasDotsCache?.signature === signature) {
            return this.canvasDotsCache;
        }

        if (typeof Path2D === "undefined") {
            return null;
        }

        const gridXs = [];
        const gridYs = [];
        const addUniqueGridPoint = (points, point) => {
            const previousPoint = points[points.length - 1];
            if (previousPoint === undefined || Math.abs(previousPoint - point) >= 0.5) {
                points.push(point);
            }
        };

        for (let valueX = props.canvas_min_x; valueX <= props.canvas_max_x; valueX += stepX) {
            const ratioX = (valueX - props.canvas_min_x) / rangeX;
            addUniqueGridPoint(gridXs, cacheW * ratioX);
        }

        for (let valueY = props.canvas_min_y; valueY <= props.canvas_max_y; valueY += stepY) {
            const ratioY = (valueY - props.canvas_min_y) / rangeY;
            addUniqueGridPoint(gridYs, cacheH * (1 - ratioY));
        }

        const dotPath = new Path2D();
        for (const dotX of gridXs) {
            for (const dotY of gridYs) {
                dotPath.rect(dotX - 0.5, dotY - 0.5, 1, 1);
            }
        }

        this.canvasDotsCache = { signature, path: dotPath };
        return this.canvasDotsCache;
    }
    
    static gcd(a, b) {
        a = Math.abs(Math.floor(Number(a))) || 1;
        b = Math.abs(Math.floor(Number(b))) || 1;
        
        while (b !== 0) {
            const t = a % b;
            a = b;
            b = t;
        }
        return a;
    }

    static aspectRatioString(w, h) {
        const g = ResolutionMasterCanvas.gcd(w, h);
        return `${w / g}:${h / g}`;
    }

    drawInfoText(ctx, y) {
        const node = this.node;
        if (this.widthWidget && this.heightWidget) {
            const width = this.widthWidget.value;
            const height = this.heightWidget.value;
            const mp = ((width * height) / 1000000).toFixed(2);
            const pResolution = this.getClosestPResolution(width, height);

            const aspectRatio = ResolutionMasterCanvas.aspectRatioString(width, height);
            
            ctx.fillStyle = "#bbb";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${width} × ${height}  |  ${mp} MP ${pResolution}  |  ${aspectRatio}`,
                        node.size[0] / 2, y);
        }
    }
    
    getScalingRowLayout() {
        const margin = 20;
        const availableWidth = this.node.size[0] - margin * 2;
        const gap = 8;
        const btnWidth = 50;
        const valueWidth = 45;
        const previewWidth = 70;
        const radioWidth = 18;
        
        return {
            margin,
            availableWidth,
            gap,
            btnWidth,
            valueWidth,
            previewWidth,
            radioWidth,
            sliderWidth: availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4),
            dropdownWidth: availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4)
        };
    }

    drawScalingGrid(ctx, y) {
        const margin = 20;
        const props = this.node.properties;
        this.drawScalingRowBase(ctx, margin, y, {
            buttonControl: 'scaleBtn', mainControl: 'scaleSlider', radioControl: 'upscaleRadio',
            controlType: 'slider', icon: this.icons.upscale, valueProperty: 'upscaleValue',
            min: props.scaling_slider_min, max: props.scaling_slider_max, step: props.scaling_slider_step,
            displayValue: props.upscaleValue.toFixed(1) + "x",
            previewDimensions: this.calculateScalingPreview('manual'),
            rescaleMode: 'manual'
        });
        const resScale = this.calculateScaleFactor('resolution');
        this.drawScalingRowBase(ctx, margin, y + 35, {
            buttonControl: 'resolutionBtn', mainControl: 'resolutionDropdown', radioControl: 'resolutionRadio',
            controlType: 'dropdown', icon: this.icons.resolution, selectedText: `${props.targetResolution}p`,
            displayValue: `×${resScale.toFixed(2)}`,
            previewDimensions: this.calculateScalingPreview('resolution'),
            rescaleMode: 'resolution'
        });
        const mpScale = this.calculateScaleFactor('megapixels');
        this.drawScalingRowBase(ctx, margin, y + 70, {
            buttonControl: 'megapixelsBtn', mainControl: 'megapixelsSlider', radioControl: 'megapixelsRadio',
            controlType: 'slider', icon: this.icons.megapixels, valueProperty: 'targetMegapixels',
            min: props.megapixels_slider_min, max: props.megapixels_slider_max, step: props.megapixels_slider_step,
            displayValue: `${props.targetMegapixels.toFixed(1)}MP`,
            previewDimensions: this.calculateScalingPreview('megapixels'),
            rescaleMode: 'megapixels'
        });

        const checkboxSize = 18;
        const ratioY = y + 105;
        const checkboxLabel = "Prioritize ratio";
        ctx.font = "12px Arial";
        const labelWidth = ctx.measureText(checkboxLabel).width;
        const checkboxGap = 6;
        const groupWidth = checkboxSize + checkboxGap + labelWidth;
        const checkboxX = margin + (this.node.size[0] - margin * 2 - groupWidth) / 2;
        this.controls.preserveScalingRatioCheckbox = { x: checkboxX, y: ratioY + 3, w: checkboxSize, h: checkboxSize };
        this.drawCheckbox(ctx, checkboxX, ratioY + 3, checkboxSize, props.preserveScalingRatio, this.hoverElement === 'preserveScalingRatioCheckbox');
        ctx.fillStyle = this.hoverElement === 'preserveScalingRatioCheckbox' ? "#5af" : "#ccc";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(checkboxLabel, checkboxX + checkboxSize + checkboxGap, ratioY + 12);
        
        return 130;
    }

    drawAutoDetectSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 6;
        const toggleWidth = 140;
        const checkboxWidth = 18;

        let currentY = y;
        this.controls.autoDetectToggle = { x: margin, y: currentY, w: toggleWidth, h: 28 };
        this.drawToggle(ctx, margin, currentY, toggleWidth, 28, props.autoDetect,
                       props.autoDetect ? "Auto-detect ON" : "Auto-detect OFF",
                       this.hoverElement === 'autoDetectToggle');

        const liveStatus = this.getAutoDetectLiveStatus();
        const infoX = margin + toggleWidth + gap;
        const infoWidth = availableWidth - toggleWidth - gap;
        const statusOnly = !(props.autoDetect && this.detectedDimensions);
        this.controls.autoDetectLiveStatus = {
            x: infoX,
            y: currentY + 2,
            w: infoWidth,
            h: statusOnly ? 24 : 11
        };
        ctx.fillStyle = liveStatus.textColor;
        ctx.font = statusOnly ? "11px Arial" : "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(liveStatus.text, infoX + infoWidth / 2, currentY + (statusOnly ? 14 : 8));

        if (props.autoDetect && this.detectedDimensions) {
            const detectedText = `Detected: ${this.detectedDimensions.width}x${this.detectedDimensions.height}`;
            const detectedX = infoX;
            const detectedWidth = infoWidth;
            this.controls.detectedInfo = { x: detectedX, y: currentY + 13, w: detectedWidth, h: 13 };

            this.drawValueAreaHoverBackground(ctx, 'detectedInfo', detectedX, currentY + 13, detectedWidth, 12, [95, 255, 95], 3);

            ctx.fillStyle = this.hoverElement === 'detectedInfo' ? "#7f7" : "#5f5";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(detectedText, detectedX + detectedWidth / 2, currentY + 21);
        }

        currentY += 35;

        const actionGap = 8;
        const rowGap = 6;
        const actionWidth = (availableWidth - actionGap) / 2;
        const actionButtonWidth = actionWidth - checkboxWidth - 4;
        const showToggleWidth = 56;
        const calcEnabled = !!props.selectedCategory;
        const actions = [
            { button: 'autoFitBtn', checkbox: 'autoFitCheckbox', icon: this.icons.autoFit, label: 'Fit', checked: props.autoFitOnChange, disabled: !props.selectedCategory, col: 0, row: 0 },
            { button: 'autoResizeBtn', checkbox: 'autoResizeCheckbox', icon: this.icons.autoResize, label: 'Resize', checked: props.autoResizeOnChange, disabled: false, col: 0, row: 1 },
            { button: 'autoSnapBtn', checkbox: 'autoSnapCheckbox', icon: this.icons.snap, label: 'Snap', checked: props.autoSnapOnChange, disabled: false, col: 1, row: 0 },
            { button: 'autoCalcBtn', checkbox: 'customCalcCheckbox', icon: this.icons.autoCalculate, label: 'Calc', checked: props.useCustomCalc, disabled: !calcEnabled, col: 1, row: 1, showInfoToggle: true, textOffset: 8 }
        ];

        actions.forEach((action) => {
            const x = margin + action.col * (actionWidth + actionGap);
            const actionY = currentY + action.row * (28 + rowGap);
            const buttonWidth = action.showInfoToggle ? actionWidth - checkboxWidth - showToggleWidth - 8 : actionButtonWidth;
            this.controls[action.button] = { x, y: actionY, w: buttonWidth, h: 28 };
            this.drawButton(ctx, x, actionY, buttonWidth, 28, action.icon, this.hoverElement === action.button, action.disabled, action.label, false, action.textOffset || 0);

            if (action.showInfoToggle) {
                const toggleX = x + buttonWidth + 4;
                this.controls.calcInfoToggle = { x: toggleX, y: actionY + 3, w: showToggleWidth, h: 22 };
                const previousAlpha = ctx.globalAlpha;
                if (action.disabled) ctx.globalAlpha = 0.5;
                this.drawToggle(ctx, toggleX, actionY + 3, showToggleWidth, 22, props.showCalcInfo, "Show", this.hoverElement === 'calcInfoToggle');
                ctx.globalAlpha = previousAlpha;

                this.drawAutoDetectActionCheckbox(ctx, action, toggleX + showToggleWidth + 4, actionY, checkboxWidth);
            } else {
                this.drawAutoDetectActionCheckbox(ctx, action, x + buttonWidth + 4, actionY, checkboxWidth);
            }
        });

        return 110;
    }

    drawAutoDetectActionCheckbox(ctx, action, x, y, size) {
        this.controls[action.checkbox] = { x, y: y + 5, w: size, h: 18 };
        this.drawCheckbox(ctx, x, y + 5, size, action.checked, this.hoverElement === action.checkbox, action.disabled);
    }
    
    drawPresetSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        let currentHeight = 30; 
        const gap = 8;
        let currentX = margin;
        let currentY = y;
        const iconBtnWidth = 28;
        const settingsBtnX = node.size[0] - margin - iconBtnWidth;
        if (props.selectedCategory) {
            const dropdownsWidth = availableWidth - iconBtnWidth - gap;
            const categoryDDWidth = dropdownsWidth * 0.4;
            const presetDDWidth = dropdownsWidth - categoryDDWidth - gap;

            this.controls.categoryDropdown = { x: currentX, y: currentY, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, currentY, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
            currentX += categoryDDWidth + gap;

            this.controls.presetDropdown = { x: currentX, y: currentY, w: presetDDWidth, h: 28 };
            const presetText = props.selectedPreset || "Select Preset...";
            this.drawDropdown(ctx, currentX, currentY, presetDDWidth, 28, presetText, this.hoverElement === 'presetDropdown');
        } else {
            const categoryDDWidth = availableWidth - iconBtnWidth - gap;
            this.controls.categoryDropdown = { x: currentX, y: currentY, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, currentY, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
        }
        this.controls.managePresetsBtn = { x: settingsBtnX, y: currentY, w: iconBtnWidth, h: 28 };
        this.drawButton(ctx, settingsBtnX, currentY, iconBtnWidth, 28, this.icons.settings, this.hoverElement === 'managePresetsBtn');

        return currentHeight;
    }
    
    getCalcInfoMessage() {
        const props = this.node.properties;
        const category = props.selectedCategory;

        if (category === "SDXL") {
            return "💡 SDXL Mode: Uses the closest SDXL preset size.";
        } else if (category === "Flux") {
            return "💡 FLUX Mode: Round to: 32px | Edge range: 320-2560px | Max resolution: 4.0 MP";
        } else if (category === "Flux.2") {
            return "💡 FLUX.2 Mode: Round to: 16px | Edge range: 320-3840px | Max resolution: 6.0 MP";
        } else if (category === "WAN" && this.widthWidget && this.heightWidget) {
            const pixels = this.widthWidget.value * this.heightWidget.value;
            const model = pixels < 600000 ? "480p" : "720p";
            return `💡 WAN Mode: Suggesting ${model} model | Round to: 16px | Resolution range: 320p-820p`;
        } else if (category === "HiDream Dev") {
            return "💡 HiDream Dev: Uses the closest HiDream Dev preset size.";
        } else if (category === "Qwen-Image") {
            return "💡 Qwen-Image: Resolution range: ~0.6MP-4.2MP. If input is already in this range, it remains unchanged.";
        } else if (['Standard', 'Social Media', 'Print', 'Cinema', 'Display Resolutions'].includes(category)) {
            return "💡 Calc Mode: Uses the closest preset aspect ratio while keeping the size close to your current resolution.";
        }
        return "⚠️ Calc Mode: Custom calculation not available for this category)";
    }

    getMeasureContext() {
        if (!this.measureContext && typeof document !== "undefined") {
            this.measureContext = document.createElement("canvas").getContext("2d");
        }
        return this.measureContext;
    }

    measureCalcInfoMessage(ctx = null) {
        const message = this.getCalcInfoMessage();
        if (!message) return { boxHeight: 0 };

        const measureCtx = ctx || this.getMeasureContext();
        const paddingX = 10;
        const paddingTop = 8;
        const paddingBottom = 8;
        const lineHeight = 14;
        const maxWidth = this.node.size[0] - 40 - (paddingX * 2);
        const words = message.split(' ');
        const lines = [];
        let currentLine = '';

        if (measureCtx) measureCtx.font = "11px Arial";
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = measureCtx ? measureCtx.measureText(testLine).width : testLine.length * 6;
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        return { boxHeight: lines.length * lineHeight + paddingTop + paddingBottom, lines, paddingTop, lineHeight };
    }

    drawInfoMessage(ctx, y) {
        const node = this.node;
        const { boxHeight, lines = [], paddingTop = 8, lineHeight = 14 } = this.measureCalcInfoMessage(ctx);
        if (boxHeight > 0) {
           ctx.fillStyle = "rgba(250, 165, 90, 0.15)";
           ctx.strokeStyle = "rgba(250, 165, 90, 0.5)";
           ctx.beginPath();
           ctx.roundRect(20, y, node.size[0] - 40, boxHeight, 4);
           ctx.fill();
           ctx.stroke();
           ctx.fillStyle = "#fa5";
           ctx.textAlign = "center";
           ctx.textBaseline = "top";
           lines.forEach((line, index) => {
               ctx.fillText(line, node.size[0] / 2, y + paddingTop + (index * lineHeight));
           });
           
           return boxHeight;
        }
        return 0;
    }
    
    drawSliderMode(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 10;
        const w = node.size[0] - margin * 2;
        
        if (!this.widthWidget || !this.heightWidget) return;
        y = this.drawDimensionSlider(ctx, y, margin, w, "Width:", "widthSlider", 
            this.widthWidget.value, props.manual_slider_min_w, props.manual_slider_max_w, props.manual_slider_step_w);
        this.drawDimensionSlider(ctx, y, margin, w, "Height:", "heightSlider", 
            this.heightWidget.value, props.manual_slider_min_h, props.manual_slider_max_h, props.manual_slider_step_h);
    }
    
    drawDimensionSlider(ctx, y, margin, w, label, controlName, value, min, max, step) {
        const node = this.node;
        
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(label, margin, y);
        
        this.controls[controlName] = { x: margin, y: y + 10, w, h: 25 };
        this.drawSlider(ctx, margin, y + 10, w, 25, value, min, max, step);
        
        ctx.textAlign = "right";
        ctx.fillText(value.toString(), node.size[0] - margin, y + 25);
        
        return y + 45;
    }
    drawButton(ctx, x, y, w, h, content, hover = false, disabled = false, text = null, centerIconAndText = false, textOffset = 0) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (disabled) {
            grad.addColorStop(0, "#4a4a4a");
            grad.addColorStop(1, "#404040");
        } else if (hover) {
            grad.addColorStop(0, "#6a6a6a");
            grad.addColorStop(1, "#606060");
        } else {
            grad.addColorStop(0, "#5a5a5a");
            grad.addColorStop(1, "#505050");
        }
        ctx.fillStyle = grad;
        ctx.strokeStyle = disabled ? "#333" : hover ? "#777" : "#222";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.fill();
        ctx.stroke();
        
        if (typeof content === 'string') {
            ctx.fillStyle = disabled ? "#888" : "#ddd";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(content, x + w / 2, y + h / 2 + 1);
        } else if (content instanceof Image) {
            const iconSize = Math.min(w, h) - 12;
            let iconX, iconY;
            if (text) {
                if (centerIconAndText) {
                    ctx.font = "12px Arial";
                    const textWidth = ctx.measureText(text).width;
                    const gap = 4; 
                    const totalWidth = iconSize + gap + textWidth;
                    const startX = x + (w - totalWidth) / 2;
                    
                    iconX = startX;
                    iconY = y + (h - iconSize) / 2;
                } else {
                    const iconPadding = 4;
                    iconX = x + iconPadding;
                    iconY = y + (h - iconSize) / 2;
                }
            } else {
                iconX = x + (w - iconSize) / 2;
                iconY = y + (h - iconSize) / 2;
            }
            
            if (content.complete) {
                try {
                    if (disabled) ctx.globalAlpha = 0.5;
                    ctx.drawImage(content, iconX, iconY, iconSize, iconSize);
                    if (disabled) ctx.globalAlpha = 1.0;
                } catch (e) {
                    log.error("Error drawing SVG icon:", e);
                    ctx.fillStyle = "#f55";
                    ctx.font = "bold 14px Arial";
                    ctx.fillText("?", x + w / 2, y + h / 2 + 1);
                }
            }
            if (text) {
                ctx.fillStyle = disabled ? "#888" : "#ddd";
                ctx.font = "12px Arial";
                ctx.textBaseline = "middle";
                
                if (centerIconAndText) {
                    ctx.textAlign = "left";
                    const textWidth = ctx.measureText(text).width;
                    const gap = 4;
                    const totalWidth = iconSize + gap + textWidth;
                    const startX = x + (w - totalWidth) / 2;
                    const textX = startX + iconSize + gap;
                    ctx.fillText(text, textX, y + h / 2 + 1);
                } else {
                    ctx.textAlign = "center";
                    ctx.fillText(text, x + w / 2 + textOffset, y + h / 2 + 1);
                }
            }
        }
    }
    
    drawSlider(ctx, x, y, w, h, value, min, max, step) {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.roundRect(x, y + h / 2 - 3, w, 6, 3);
        ctx.fill();
        const pos = Math.max(0, Math.min(1, (value - min) / (max - min)));
        const knobX = x + w * pos;
        const knobY = y + h / 2;

        const grad = ctx.createLinearGradient(knobX - 7, knobY - 7, knobX + 7, knobY + 7);
        grad.addColorStop(0, "#e0e0e0");
        grad.addColorStop(1, "#c0c0c0");
        ctx.fillStyle = grad;
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    
    drawDropdown(ctx, x, y, w, h, text, hover = false) {
        this.drawButton(ctx, x, y, w, h, "", hover);

        ctx.fillStyle = "#ddd";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 5, y, w - 25, h);
        ctx.clip();
        ctx.fillText(text, x + 8, y + h / 2 + 1);
        ctx.restore();
        
        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(x + w - 18, y + h / 2 - 3);
        ctx.lineTo(x + w - 10, y + h / 2 + 3);
        ctx.lineTo(x + w - 2, y + h / 2 - 3);
        ctx.fill();
    }
    
    drawRadioButton(ctx, x, y, size, checked, hover = false) {
        ctx.strokeStyle = hover ? "#ccc" : "#999";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, 2 * Math.PI);
        ctx.stroke();
        
        if (checked) {
            ctx.fillStyle = "#5af";
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2 - 6, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    drawCheckbox(ctx, x, y, size, checked, hover = false, disabled = false) {
        ctx.strokeStyle = disabled ? "#555" : hover ? "#ccc" : "#999";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 4);
        ctx.stroke();
        
        if (checked) {
            ctx.fillStyle = disabled ? "#666" : "#5af";
            ctx.beginPath();
            ctx.moveTo(x + 4, y + size / 2);
            ctx.lineTo(x + size / 2 - 1, y + size - 4);
            ctx.lineTo(x + size - 4, y + 4);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    drawToggle(ctx, x, y, w, h, isOn, text, hover = false) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        if (isOn) {
            grad.addColorStop(0, "#3a76d6");
            grad.addColorStop(1, "#5a96f6");
        } else {
            grad.addColorStop(0, "#555");
            grad.addColorStop(1, "#666");
        }
        ctx.fillStyle = grad;
        ctx.fill();
        
        ctx.strokeStyle = hover ? "#888" : "#222";
        ctx.stroke();
        
        const knobX = isOn ? x + w - h + 2 : x + 2;
        const knobGrad = ctx.createLinearGradient(knobX, y, knobX, y + h - 4);
        knobGrad.addColorStop(0, "#f0f0f0");
        knobGrad.addColorStop(1, "#d0d0d0");
        ctx.fillStyle = knobGrad;
        
        ctx.beginPath();
        ctx.arc(knobX + (h-4)/2, y + h/2, (h-6)/2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const textOffset = isOn ? -(h * 0.25) : (h * 0.25);
        ctx.fillText(text, x + w / 2 + textOffset, y + h / 2 + 1);
    }
    
    drawValueAreaHoverBackground(ctx, controlName, x, y, w, h, color, borderRadius = 4) {
        if (this.hoverElement === controlName) {
            ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`;
            ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, borderRadius);
            ctx.fill();
            ctx.stroke();
        }
    }
    
    drawTooltip(ctx) {
        if (!this.tooltipMousePos || !this.tooltips[this.tooltipElement]) {
            log.debug("Tooltip draw failed: missing mouse pos or tooltip text");
            return;
        }
        
        const tooltipText = this.tooltips[this.tooltipElement];
        const paddingX = 8;
        const paddingTop = 8;
        const paddingBottom = 4; 
        const maxWidth = 250;
        const lineHeight = 16;
        ctx.font = "12px Arial";
        const words = tooltipText.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const tooltipWidth = Math.min(textWidth + paddingX * 2, maxWidth + paddingX * 2);
        const tooltipHeight = lines.length * lineHeight + paddingTop + paddingBottom;
        const mouseRelX = this.tooltipMousePos.x - this.node.pos[0];
        const mouseRelY = this.tooltipMousePos.y - this.node.pos[1];
        
        let tooltipX = mouseRelX + 15;
        let tooltipY = mouseRelY - tooltipHeight - 10;
        if (tooltipX + tooltipWidth > this.node.size[0] + 50) {
            tooltipX = mouseRelX - tooltipWidth - 15;
        }
        if (tooltipY < -50) {
            tooltipY = mouseRelY + 20;
        }
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.roundRect(tooltipX + 2, tooltipY + 2, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        const bgGrad = ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
        bgGrad.addColorStop(0, "rgba(45, 45, 45, 0.95)");
        bgGrad.addColorStop(1, "rgba(35, 35, 35, 0.95)");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        lines.forEach((line, index) => {
            ctx.fillText(line, tooltipX + paddingX, tooltipY + paddingTop + index * lineHeight);
        });
        
        ctx.restore();
    }
    handleMouseDown(e, pos, canvas) {
        const node = this.node;
        const props = node.properties;
        
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        if (props.mode === "Manual") {
            if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
                node.capture = 'canvas2dRightHandle';
                node.captureInput(true);
                return true;
            }
            
            if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
                node.capture = 'canvas2dTopHandle';
                node.captureInput(true);
                return true;
            }
            const c2d = this.controls.canvas2d;
            if (c2d && this.isPointInControl(relX, relY, c2d)) {
                node.capture = 'canvas2d';
                this.canvasDragAspectLock = this.createAspectLock();
                node.captureInput(true);
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey, e.ctrlKey);
                return true;
            }
        }
        
        for (const key in this.controls) {
            if (this.isPointInControl(relX, relY, this.controls[key])) {
                log.debug(`Mouse down on control: ${key} at (${relX}, ${relY})`);
                
                if (key.endsWith('Btn') || key === 'detectedInfo') {
                    this.handleButtonClick(key);
                    return true;
                }
                if (key.endsWith('Slider')) {
                    node.capture = key;
                    node.captureInput(true);
                    this.updateSliderValue(key, relX - this.controls[key].x, this.controls[key].w);
                    return true;
                }
                if (key.endsWith('Dropdown')) {
                    this.showDropdownMenu(key, e);
                    return true;
                }
                if (key.endsWith('Toggle')) {
                    this.handleToggleClick(key);
                    return true;
                }
                if (key.endsWith('Checkbox')) {
                    this.handleCheckboxClick(key);
                    return true;
                }
                if (key.endsWith('Radio')) {
                    this.handleRadioClick(key);
                    return true;
                }
                if (key.endsWith('ValueArea')) {
                    log.debug(`Detected ValueArea click: ${key}`);
                    if (key === 'latValueArea') {
                        this.showLatentTypeSelector(e);
                    } else {
                        this.dialogManager.showCustomValueDialog(key, e);
                    }
                    return true;
                }
                if (key.endsWith('Header')) {
                    this.handleSectionHeaderClick(key);
                    return true;
                }
            }
        }
        
        log.debug(`No control found at (${relX}, ${relY}). Available controls:`, Object.keys(this.controls));
        
        return false;
    }
    
    handleMouseMove(e, pos, canvas) {
        const node = this.node;
        
        if (!node.capture) return false;
        if (e.buttons === 0) {
            this.handleMouseUp(e);
            return true;
        }
        
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        if (node.capture === 'canvas2d') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey, e.ctrlKey);
            }
            return true;
        }
        
        if (node.capture === 'canvas2dRightHandle') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValueWidth(relX - c2d.x, c2d.w, e.ctrlKey);
            }
            return true;
        }
        
        if (node.capture === 'canvas2dTopHandle') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValueHeight(relY - c2d.y, c2d.h, e.ctrlKey);
            }
            return true;
        }
        
        if (node.capture.endsWith('Slider')) {
            const control = this.controls[node.capture];
            if (control) {
                this.updateSliderValue(node.capture, relX - control.x, control.w);
            }
            return true;
        }
        
        return false;
    }
    
    handleMouseHover(e, pos, canvas) {
        const node = this.node;
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        let newHover = null;
        if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
            newHover = 'canvas2dRightHandle';
        } else if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
            newHover = 'canvas2dTopHandle';
        } else {
            for (const element in this.controls) {
                if (element !== 'canvas2dRightHandle' && element !== 'canvas2dTopHandle' && 
                    this.isPointInControl(relX, relY, this.controls[element])) {
                    newHover = element;
                    break;
                }
            }
        }
        this.tooltipMousePos = { x: e.canvasX, y: e.canvasY };
        if (newHover !== this.hoverElement) {
            this.hoverElement = newHover;
            this.handleTooltipHover(newHover, e);
            app.graph.setDirtyCanvas(true);
        }
    }
    
    handleTooltipHover(element, e) {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.showTooltip) {
            this.showTooltip = false;
            this.tooltipElement = null;
            app.graph.setDirtyCanvas(true);
        }
        if (element && this.tooltips[element]) {
            const initialMousePos = { x: e.canvasX, y: e.canvasY };
            this.tooltipTimer = setTimeout(() => {
                this.tooltipElement = element;
                this.showTooltip = true;
                this.tooltipFixedPos = initialMousePos; 
                app.graph.setDirtyCanvas(true);
            }, this.tooltipDelay);
        }
    }
    
    handleMouseUp(e) {
        const node = this.node;
        
        if (!node.capture) return false;
        
        node.capture = false;
        this.canvasDragAspectLock = null;
        node.captureInput(false);
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = node.properties.valueX;
            this.heightWidget.value = node.properties.valueY;
        }
        
        this.updateRescaleValue();
        
        return true;
    }
    
    handlePropertyChange(property) {
        const node = this.node;
        if (property?.startsWith('section_') && property.endsWith('_collapsed')) {
            const sectionKey = property.replace(/^section_/, '').replace(/_collapsed$/, '');
            this.collapsedSections[sectionKey] = node.properties[property];
            if (sectionKey === 'extraControls') {
                this.userPreferredHeight = this.getStoredPreferredHeight(this.collapsedSections.extraControls);
                this.applyCompactSlotLabels();
            }
        }
        if (!node.configured) return;
        
        node.intpos.x = (node.properties.valueX - node.properties.canvas_min_x) / 
                       (node.properties.canvas_max_x - node.properties.canvas_min_x);
        node.intpos.y = (node.properties.valueY - node.properties.canvas_min_y) / 
                       (node.properties.canvas_max_y - node.properties.canvas_min_y);
        
        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));
        
        app.graph.setDirtyCanvas(true);
    }
    
    handleButtonClick(buttonName) {
        const actions = {
            swapBtn: () => this.handleSwap(),
            snapBtn: () => this.handleSnap(),
            scaleBtn: () => this.handleScale(),
            resolutionBtn: () => this.handleResolutionScale(),
            megapixelsBtn: () => this.handleMegapixelsScale(),
            autoFitBtn: () => this.handleAutoFit(),
            autoResizeBtn: () => this.handleAutoResize(),
            autoSnapBtn: () => this.handleSnap(),
            autoCalcBtn: () => this.handleAutoCalc(),
            detectedInfo: () => this.handleDetectedClick(),
            managePresetsBtn: () => this.handleManagePresets(),
            compactHelpBtn: () => this.showHelpDialog()
        };
        actions[buttonName]?.();
    }

    showHelpDialog() {
        this.closeHelpDialog();

        const overlay = document.createElement('div');
        this.helpDialogOverlay = overlay;
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.45);
            z-index: 9999; display: flex; align-items: center; justify-content: center;
        `;
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) this.closeHelpDialog();
        });

        const dialog = document.createElement('div');
        this.helpDialog = dialog;
        dialog.addEventListener('mousedown', (e) => e.stopPropagation());
        dialog.style.cssText = `
            width: min(420px, calc(100vw - 40px));
            background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
            border: 1px solid rgba(160, 190, 255, 0.45);
            border-radius: 8px; box-shadow: 0 12px 36px rgba(0,0,0,0.75);
            color: #ddd; font-family: Arial, sans-serif; padding: 18px;
        `;

        dialog.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
                <div style="font-size:16px; font-weight:700; color:#fff;">Resolution Master Help</div>
                <button type="button" data-close style="width:28px; height:28px; border-radius:5px; border:1px solid #555; background:#333; color:#ddd; cursor:pointer; font-size:16px; line-height:1;">×</button>
            </div>
            <div style="font-size:12px; line-height:1.55; color:#cfcfcf;">
                <div style="font-weight:700; color:#fff; margin-bottom:4px;">2D Canvas shortcuts</div>
                <div>Drag: set width and height</div>
                <div>Shift + drag: keep aspect ratio</div>
                <div>Ctrl + drag: disable canvas snap</div>
                <div>Ctrl + Shift + drag: keep exact aspect ratio</div>
                <div style="font-weight:700; color:#fff; margin:14px 0 4px;">Project</div>
                <a href="https://github.com/Azornes/Comfyui-Resolution-Master" target="_blank" rel="noopener noreferrer" style="color:#8fc7ff; text-decoration:none;">Azornes/Comfyui-Resolution-Master</a>
                <div style="margin-top:10px; color:#aaa;">If this node helps you, please consider starring the repository.</div>
            </div>
        `;

        dialog.querySelector('[data-close]')?.addEventListener('click', () => this.closeHelpDialog());
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    closeHelpDialog() {
        if (this.helpDialogOverlay?.parentNode) {
            this.helpDialogOverlay.parentNode.removeChild(this.helpDialogOverlay);
        }
        this.helpDialogOverlay = null;
        this.helpDialog = null;
    }

    handleToggleClick(toggleName) {
        const props = this.node.properties;
        if (toggleName === 'autoDetectToggle') {
            props.autoDetect = !props.autoDetect;
            this.setAutoDetectSource('backend');
            if (props.autoDetect) this.startAutoDetect();
            else this.stopAutoDetect();
            const widget = this.node.widgets?.find(w => w.name === 'auto_detect');
            if (widget) widget.value = props.autoDetect;
            this.syncBackendFallbackWidgets();
            app.graph.setDirtyCanvas(true);
        } else if (toggleName === 'calcInfoToggle' && props.selectedCategory) {
            props.showCalcInfo = !props.showCalcInfo;
            app.graph.setDirtyCanvas(true);
        }
    }

    handleCheckboxClick(checkboxName) {
        const props = this.node.properties;
        if (checkboxName === 'autoFitCheckbox' && props.selectedCategory) {
            props.autoFitOnChange = !props.autoFitOnChange;
        } else if (checkboxName === 'autoResizeCheckbox') {
            props.autoResizeOnChange = !props.autoResizeOnChange;
        } else if (checkboxName === 'autoSnapCheckbox') {
            props.autoSnapOnChange = !props.autoSnapOnChange;
        } else if (checkboxName === 'customCalcCheckbox') {
            props.useCustomCalc = !props.useCustomCalc;
        } else if (checkboxName === 'preserveScalingRatioCheckbox') {
            props.preserveScalingRatio = !props.preserveScalingRatio;
        }
        this.syncBackendFallbackWidgets();
        this.updateRescaleValue();
        app.graph.setDirtyCanvas(true);
    }

    handleRadioClick(radioName) {
        const props = this.node.properties;
        const radioMap = {
            upscaleRadio: 'manual',
            resolutionRadio: 'resolution',
            megapixelsRadio: 'megapixels'
        };
        props.rescaleMode = radioMap[radioName];
        this.updateRescaleValue();
        app.graph.setDirtyCanvas(true);
    }
    
    handleSectionHeaderClick(headerKey) {
        const sectionKey = headerKey.replace('Header', '');
        if (sectionKey === 'extraControls') {
            this.storePreferredHeight(this.node.size[1], this.collapsedSections.extraControls);
        }
        this.collapsedSections[sectionKey] = !this.collapsedSections[sectionKey];
        const propertyKey = `section_${sectionKey}_collapsed`;
        this.node.properties[propertyKey] = this.collapsedSections[sectionKey];
        if (sectionKey === 'extraControls') {
            this.userPreferredHeight = this.getStoredPreferredHeight(this.collapsedSections.extraControls);
            this.applyCompactSlotLabels();
        }
        app.graph.setDirtyCanvas(true, true);
        
        log.debug(`Section ${sectionKey} ${this.collapsedSections[sectionKey] ? 'collapsed' : 'expanded'}`);
    }
    getAllPresets() {
        return this.customPresetsManager.getMergedPresets(this.presetCategories);
    }

    getCategoryPresetsJSON(category = this.node.properties.selectedCategory) {
        const categoryPresets = category ? (this.getAllPresets()[category] || {}) : {};
        try {
            return JSON.stringify(categoryPresets);
        } catch (error) {
            log.warn('Failed to serialize calculation presets:', error);
            return "{}";
        }
    }

    buildCalculationPayload(action, overrides = {}) {
        const props = this.node.properties;
        const get = (snakeName, camelName, fallback) =>
            overrides[snakeName] ?? overrides[camelName] ?? fallback;
        const selectedCategory = get('selected_category', 'selectedCategory', props.selectedCategory || "");

        return {
            action,
            width: Math.max(1, Math.round(Number(get('width', 'width', this.widthWidget?.value ?? props.valueX ?? 512)) || 1)),
            height: Math.max(1, Math.round(Number(get('height', 'height', this.heightWidget?.value ?? props.valueY ?? 512)) || 1)),
            auto_fit_on_change: !!get('auto_fit_on_change', 'autoFitOnChange', props.autoFitOnChange),
            auto_resize_on_change: !!get('auto_resize_on_change', 'autoResizeOnChange', props.autoResizeOnChange),
            auto_snap_on_change: !!get('auto_snap_on_change', 'autoSnapOnChange', props.autoSnapOnChange),
            use_custom_calc: !!get('use_custom_calc', 'useCustomCalc', props.useCustomCalc),
            preserve_scaling_ratio: !!get('preserve_scaling_ratio', 'preserveScalingRatio', props.preserveScalingRatio),
            selected_category: selectedCategory,
            snap_value: Math.max(1, Math.round(Number(get('snap_value', 'snapValue', props.snapValue)) || 64)),
            upscale_value: Math.max(0, Number(get('upscale_value', 'upscaleValue', props.upscaleValue)) || 0),
            target_resolution: Math.max(1, Math.round(Number(get('target_resolution', 'targetResolution', props.targetResolution)) || 1080)),
            target_megapixels: Math.max(0, Number(get('target_megapixels', 'targetMegapixels', props.targetMegapixels)) || 0),
            rescale_mode: get('rescale_mode', 'rescaleMode', props.rescaleMode || "resolution"),
            presets_json: get('presets_json', 'presetsJSON', this.getCategoryPresetsJSON(selectedCategory))
        };
    }

    async requestBackendCalculation(action, overrides = {}, options = {}) {
        try {
            const response = await fetch('/resolutionmaster/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.buildCalculationPayload(action, overrides)),
                cache: 'no-store'
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.ok) {
                throw new Error(data?.error || `Calculation request failed with HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            if (!options.silent) {
                log.error(`Backend calculation failed for ${action}:`, error);
            }
            return null;
        }
    }

    applyRescaleResult(result) {
        const value = Number(result?.rescale_factor);
        if (!Number.isFinite(value)) return;

        const props = this.node.properties;
        props.rescaleValue = value;
        if (this.rescaleValueWidget) {
            this.rescaleValueWidget.value = value;
        }
        if (this.rescaleModeWidget) {
            this.rescaleModeWidget.value = props.rescaleMode;
        }
    }

    getScaleFactor(mode) {
        return this.calculateScaleFactor(mode);
    }

    calculateScaleFactor(mode = this.node.properties.rescaleMode) {
        const props = this.node.properties;
        const width = Math.max(1, Number(this.widthWidget?.value ?? props.valueX) || 1);
        const height = Math.max(1, Number(this.heightWidget?.value ?? props.valueY) || 1);
        const currentPixels = Math.max(1, width * height);

        if (mode === 'manual') {
            return Math.max(0, Number(props.upscaleValue) || 0);
        }
        if (mode === 'megapixels') {
            return Math.sqrt(Math.max(0, Number(props.targetMegapixels) || 0) * 1000000 / currentPixels);
        }

        const targetResolution = Math.max(1, Number(props.targetResolution) || 1080);
        const targetPixels = (targetResolution * (16 / 9)) * targetResolution;
        return Math.sqrt(targetPixels / currentPixels);
    }

    calculateScalingPreview(mode) {
        return this.calculateLocalScaledDimensions(this.calculateScaleFactor(mode));
    }

    calculateLocalScaledDimensions(scale) {
        const props = this.node.properties;
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value ?? props.valueX) || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value ?? props.valueY) || 1));

        if (!props.preserveScalingRatio) {
            return {
                width: Math.max(1, Math.round(width * scale)),
                height: Math.max(1, Math.round(height * scale))
            };
        }

        const divisor = ResolutionMasterCanvas.gcd(width, height);
        const ratioX = width / divisor;
        const ratioY = height / divisor;
        const targetPixels = width * height * scale * scale;
        const ratioPixels = ratioX * ratioY;
        const ratioScale = Math.max(1, Math.round(Math.sqrt(targetPixels / ratioPixels)));

        return {
            width: ratioX * ratioScale,
            height: ratioY * ratioScale
        };
    }

    applyBackendCalculationResult(result, options = {}) {
        if (!result) return false;

        const width = Number(result.width);
        const height = Number(result.height);
        if (options.updatePreset !== false && result.selected_preset) {
            this.node.properties.selectedPreset = result.selected_preset;
        }
        if (options.applyDimensions !== false && Number.isFinite(width) && Number.isFinite(height)) {
            this.setDimensions(Math.round(width), Math.round(height), { updateBackend: false });
        }
        if (options.applyRescale !== false) {
            this.applyRescaleResult(result);
        }
        this.syncBackendFallbackWidgets();
        this.requestCanvasUpdate();
        return true;
    }
    
    validateWidgets() {
        return this.widthWidget && this.heightWidget;
    }
    
    setDimensions(width, height, options = {}) {
        if (!this.validateWidgets()) return;
        this.node.properties.valueX = width;
        this.node.properties.valueY = height;
        this.widthWidget.value = width;
        this.heightWidget.value = height;
        this.handlePropertyChange();
        if (options.updateBackend !== false) {
            this.updateRescaleValue();
        }

        this.updateCanvasFromWidgets({ updateBackend: options.updateBackend });
        app.graph.setDirtyCanvas(true);
    }
    
    updateCanvasFromWidgets(options = {}) {
        if (!this.validateWidgets()) return;
        
        const node = this.node;
        const props = node.properties;
        props.valueX = this.widthWidget.value;
        props.valueY = this.heightWidget.value;
        node.intpos.x = (this.widthWidget.value - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
        node.intpos.y = (this.heightWidget.value - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));
        if (options.updateBackend !== false) {
            this.updateRescaleValue();
        }
        app.graph.setDirtyCanvas(true);
    }
    
    setCanvasTextStyle(ctx, style = {}) {
        const defaults = {
            fillStyle: "#ccc",
            font: "12px Arial",
            textAlign: "center",
            textBaseline: "middle"
        };
        const finalStyle = { ...defaults, ...style };
        
        Object.entries(finalStyle).forEach(([key, value]) => {
            ctx[key] = value;
        });
    }
    
    drawScalingRowBase(ctx, x, y, config) {
        const props = this.node.properties;
        const layout = this.getScalingRowLayout();
        let currentX = x;
        this.controls[config.buttonControl] = { x: currentX, y, w: layout.btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, layout.btnWidth, 28, config.icon, this.hoverElement === config.buttonControl);
        currentX += layout.btnWidth + layout.gap;
        if (config.controlType === 'slider') {
            this.controls[config.mainControl] = { x: currentX, y, w: layout.sliderWidth, h: 28 };
            this.drawSlider(ctx, currentX, y, layout.sliderWidth, 28,
                          props[config.valueProperty], config.min, config.max, config.step);
            currentX += layout.sliderWidth + layout.gap;
        } else if (config.controlType === 'dropdown') {
            this.controls[config.mainControl] = { x: currentX, y, w: layout.dropdownWidth, h: 28 };
            this.drawDropdown(ctx, currentX, y, layout.dropdownWidth, 28, config.selectedText, this.hoverElement === config.mainControl);
            currentX += layout.dropdownWidth + layout.gap;
        }
        const valueAreaControl = config.buttonControl.replace('Btn', 'ValueArea');
        this.controls[valueAreaControl] = { x: currentX, y, w: layout.valueWidth, h: 28 };
        
        this.drawValueAreaHoverBackground(ctx, valueAreaControl, currentX, y, layout.valueWidth, 28, [100, 150, 255]);
        this.setCanvasTextStyle(ctx, {
            fillStyle: this.hoverElement === valueAreaControl ? "#5af" : "#ccc",
            textAlign: "center"
        });
        ctx.fillText(config.displayValue, currentX + layout.valueWidth / 2, y + 14);
        currentX += layout.valueWidth + layout.gap;
        if (this.validateWidgets() && config.previewDimensions) {
            const newW = Math.round(Number(config.previewDimensions.width) || 0);
            const newH = Math.round(Number(config.previewDimensions.height) || 0);
            this.setCanvasTextStyle(ctx, { fillStyle: "#888", font: "11px Arial", textAlign: "left" });
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += layout.previewWidth + layout.gap;
        this.controls[config.radioControl] = { x: currentX, y: y + 5, w: layout.radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, layout.radioWidth,
                           props.rescaleMode === config.rescaleMode, this.hoverElement === config.radioControl);
    }
    updateCanvasValue(x, y, w, h, shiftKey, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        if (ctrlKey && shiftKey) {
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            const lockedDimensions = this.getAspectLockedDimensions(newX, newY);
            newX = lockedDimensions.width;
            newY = lockedDimensions.height;
            vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        else if (shiftKey && !ctrlKey) {
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            const lockedDimensions = this.getAspectLockedDimensions(newX, newY, true);
            newX = lockedDimensions.width;
            newY = lockedDimensions.height;
            vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        else if (ctrlKey && !shiftKey) {
        }
        else {
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vX = Math.round(vX / sX) * sX;
            vY = Math.round(vY / sY) * sY;
        }
        
        node.intpos.x = vX;
        node.intpos.y = vY;
        
        let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
        let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
        
        const rnX = Math.pow(10, props.canvas_decimals_x);
        const rnY = Math.pow(10, props.canvas_decimals_y);
        newX = Math.round(rnX * newX) / rnX;
        newY = Math.round(rnY * newY) / rnY;
        if (props.valueX !== newX || props.valueY !== newY) {
            this.setDimensions(newX, newY);
        }
    }

    createAspectLock() {
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value) || this.node.properties.valueX || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value) || this.node.properties.valueY || 1));
        const divisor = ResolutionMasterCanvas.gcd(width, height);
        const ratioX = width / divisor;
        const ratioY = height / divisor;

        return {
            aspect: width / height,
            ratioX,
            ratioY
        };
    }

    getCanvasAspectLock() {
        if (!this.canvasDragAspectLock) {
            this.canvasDragAspectLock = this.createAspectLock();
        }
        return this.canvasDragAspectLock;
    }

    getAspectLockedDimensions(targetWidth, targetHeight, snapToGrid = false) {
        const props = this.node.properties;
        const lock = this.getCanvasAspectLock();
        const minScale = Math.max(
            1,
            Math.ceil(props.canvas_min_x / lock.ratioX),
            Math.ceil(props.canvas_min_y / lock.ratioY)
        );
        const maxScale = Math.max(minScale, Math.min(
            Math.floor(props.canvas_max_x / lock.ratioX),
            Math.floor(props.canvas_max_y / lock.ratioY)
        ));

        if (snapToGrid) {
            return this.createGridAspectCandidate(targetWidth, targetHeight, lock);
        }

        const rangeX = Math.max(1, props.canvas_max_x - props.canvas_min_x);
        const rangeY = Math.max(1, props.canvas_max_y - props.canvas_min_y);
        const candidates = [
            this.createAspectCandidate(targetWidth / lock.ratioX, minScale, maxScale, 1, lock),
            this.createAspectCandidate(targetHeight / lock.ratioY, minScale, maxScale, 1, lock)
        ];

        return candidates.reduce((best, candidate) => {
            const distance = Math.hypot(
                (candidate.width - targetWidth) / rangeX,
                (candidate.height - targetHeight) / rangeY
            );
            if (!best || distance < best.distance) {
                return { ...candidate, distance };
            }
            return best;
        }, null);
    }

    createGridAspectCandidate(targetWidth, targetHeight, lock) {
        const props = this.node.properties;
        const stepX = Math.max(1, Math.round(Number(props.canvas_step_x) || 1));
        const stepY = Math.max(1, Math.round(Number(props.canvas_step_y) || 1));
        const targetAspect = targetWidth / Math.max(1, targetHeight);
        const widthControls = targetAspect <= lock.aspect;
        const minScale = Math.max(
            1,
            Math.ceil(props.canvas_min_x / lock.ratioX),
            Math.ceil(props.canvas_min_y / lock.ratioY)
        );
        const maxScale = Math.max(minScale, Math.min(
            Math.floor(props.canvas_max_x / lock.ratioX),
            Math.floor(props.canvas_max_y / lock.ratioY)
        ));

        const targetScale = widthControls
            ? targetWidth / lock.ratioX
            : targetHeight / lock.ratioY;
        const desiredStep = widthControls ? stepX / lock.ratioX : stepY / lock.ratioY;
        const scaleStep = Math.max(1, Math.round(desiredStep));

        return this.createAspectCandidate(targetScale, minScale, maxScale, scaleStep, lock);
    }

    createAspectCandidate(targetScale, minScale, maxScale, scaleStep, lock) {
        const snappedScale = Math.round(targetScale / scaleStep) * scaleStep;
        const scale = Math.max(minScale, Math.min(maxScale, snappedScale));

        return {
            width: lock.ratioX * scale,
            height: lock.ratioY * scale
        };
    }
    
    updateCanvasValueWidth(x, w, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        if (!ctrlKey) {
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            vX = Math.round(vX / sX) * sX;
        }
        
        node.intpos.x = vX;
        
        let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
        
        const rnX = Math.pow(10, props.canvas_decimals_x);
        newX = Math.round(rnX * newX) / rnX;
        this.setDimensions(newX, this.heightWidget.value);
        app.graph.setDirtyCanvas(true);
    }
    
    updateCanvasValueHeight(y, h, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        if (!ctrlKey) {
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vY = Math.round(vY / sY) * sY;
        }
        
        node.intpos.y = vY;
        
        let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
        
        const rnY = Math.pow(10, props.canvas_decimals_y);
        newY = Math.round(rnY * newY) / rnY;
        this.setDimensions(this.widthWidget.value, newY);
        app.graph.setDirtyCanvas(true);
    }
    
    updateSliderValue(sliderName, x, w) {
        const props = this.node.properties;
        let value = Math.max(0, Math.min(1, x / w));
        
        const sliderConfig = {
            snapSlider: { prop: 'snapValue', min: props.action_slider_snap_min, max: props.action_slider_snap_max, step: props.action_slider_snap_step },
            scaleSlider: { prop: 'upscaleValue', min: props.scaling_slider_min, max: props.scaling_slider_max, step: props.scaling_slider_step, updateOn: 'manual' },
            megapixelsSlider: { prop: 'targetMegapixels', min: props.megapixels_slider_min, max: props.megapixels_slider_max, step: props.megapixels_slider_step, updateOn: 'megapixels' },
            widthSlider: { prop: 'valueX', min: props.manual_slider_min_w, max: props.manual_slider_max_w, step: props.manual_slider_step_w },
            heightSlider: { prop: 'valueY', min: props.manual_slider_min_h, max: props.manual_slider_max_h, step: props.manual_slider_step_h }
        };

        const config = sliderConfig[sliderName];
        if (config) {
            let newValue = config.min + value * (config.max - config.min);
            props[config.prop] = Math.round(newValue / config.step) * config.step;
            
            if (sliderName === 'scaleSlider' || sliderName === 'megapixelsSlider') {
                 props[config.prop] = parseFloat(props[config.prop].toFixed(1));
            }

            if (config.updateOn) {
                this.updateRescaleValue();
            }

            if (sliderName === 'widthSlider') {
                this.setDimensions(props.valueX, this.heightWidget.value);
            } else if (sliderName === 'heightSlider') {
                this.setDimensions(this.widthWidget.value, props.valueY);
            } else if (sliderName.includes('Slider')) {
                this.handlePropertyChange();
            }
        }
        
        app.graph.setDirtyCanvas(true);
    }
    
    showPresetSelector(e, mode) {
        const props = this.node.properties;
        const allPresets = this.getAllPresets();
        const presets = allPresets[props.selectedCategory];
        if (!presets) return;
        
        const commonCallback = (presetName) => {
            this.applyPreset(props.selectedCategory, presetName);
        };
        
        const commonModeChange = (newMode) => {
            props.preset_selector_mode = newMode;
            this.showPresetSelector(e, newMode);
        };
        
        if (mode === 'list') {
            const presetItems = Object.entries(presets)
                .filter(([name, dims]) => !dims.isHidden)  
                .map(([name, dims]) => {
                    const isCustom = this.customPresetsManager.isCustomPreset(props.selectedCategory, name);
                    return {
                        text: `${name} (${dims.width}×${dims.height})`,
                        isCustom: isCustom
                    };
                });
            
            this.searchableDropdown.show(presetItems, {
                event: e,
                title: 'Select Preset',
                currentMode: 'list',
                initialExpanded: props.dropdown_preset_expanded || false,
                onExpandedChange: (isExpanded) => {
                    props.dropdown_preset_expanded = isExpanded;
                },
                callback: (selectedItem) => {
                    const presetName = selectedItem.replace(/\s*\([^)]*\)$/, '');
                    commonCallback(presetName);
                },
                onModeChange: () => commonModeChange('visual')
            });
        } else {
            this.aspectRatioSelector.show(presets, {
                event: e,
                selectedPreset: props.selectedPreset,
                currentMode: 'visual',
                callback: commonCallback,
                onModeChange: () => commonModeChange('list')
            });
        }
    }
    
    showLatentTypeSelector(e) {
        if (!this.latentTypeWidget) {
            log.debug("Latent type selector: latent_type widget not found");
            return;
        }
        
        const currentValue = this.latentTypeWidget.value || 'latent_4x8';
        
        // Available latent types with descriptive names
        const latentTypes = [
            { text: '4x8 (Standard SD/SDXL/Flux)', value: 'latent_4x8' },
            { text: '128x16 (Flux.2)', value: 'latent_128x16' }
        ];
        
        const items = latentTypes.map(type => ({
            text: type.text,
            value: type.value,
            isCustom: type.value === currentValue // Highlight current selection
        }));
        
        this.searchableDropdown.show(items, {
            event: e,
            title: 'Select Latent Type',
            callback: (selectedText) => {
                // Find the selected type by its display text
                const selectedType = latentTypes.find(t => t.text === selectedText);
                if (selectedType && this.latentTypeWidget) {
                    this.latentTypeWidget.value = selectedType.value;
                    log.debug(`Latent type manually changed to: ${selectedType.value}`);
                    app.graph.setDirtyCanvas(true);
                }
            }
        });
    }
    
    showDropdownMenu(dropdownName, e) {
        const props = this.node.properties;
        let items, callback, title, propertyKey;
        
        if (dropdownName === 'categoryDropdown') {
            const allPresets = this.getAllPresets();
            items = Object.keys(allPresets)
                .filter(categoryName => {
                    const categoryPresets = allPresets[categoryName];
                    const hasVisiblePresets = Object.values(categoryPresets).some(preset => !preset.isHidden);
                    
                    return hasVisiblePresets;
                })
                .map(categoryName => {
                    const isCustomCategory = this.customPresetsManager.categoryExists(categoryName);
                    return {
                        text: categoryName,
                        isCustom: isCustomCategory
                    };
                });
            
            title = 'Select Category';
            propertyKey = 'dropdown_category_expanded';
            callback = (value) => {
                props.selectedCategory = value;
                props.selectedPreset = null;
                // Latent type is now manually controlled via LAT selector - no automatic change
                this.syncBackendFallbackWidgets();
                this.updateRescaleValue();
                app.graph.setDirtyCanvas(true);
            };
        } else if (dropdownName === 'presetDropdown' && props.selectedCategory) {
            const selectorMode = props.preset_selector_mode || 'visual';
            this.showPresetSelector(e, selectorMode);
            return;
        } else if (dropdownName === 'resolutionDropdown') {
            items = this.resolutions;
            title = 'Select Resolution';
            propertyKey = 'dropdown_resolution_expanded';
            callback = (value) => {
                let resolutionValue = value.trim();
                if (!resolutionValue.endsWith('p')) {
                    resolutionValue = resolutionValue + 'p';
                }
                props.targetResolution = parseInt(resolutionValue);
                this.updateRescaleValue();
                app.graph.setDirtyCanvas(true);
            };
        }
        
        if (items?.length && propertyKey) {
            this.searchableDropdown.show(items, { 
                event: e, 
                callback, 
                title,
                allowCustomValues: dropdownName === 'resolutionDropdown',
                initialExpanded: props[propertyKey] || false,
                onExpandedChange: (isExpanded) => {
                    props[propertyKey] = isExpanded;
                }
            });
        }
    }
    handleSwap() {
        if (!this.validateWidgets()) return;
        
        const newWidth = this.heightWidget.value;
        const newHeight = this.widthWidget.value;
        this.setDimensions(newWidth, newHeight);
    }
    
    async handleSnap() {
        if (!this.validateWidgets()) return;
        const result = await this.requestBackendCalculation('auto_snap');
        this.applyBackendCalculationResult(result, { updatePreset: false });
    }

    async handleScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'manual' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    }

    async handleResolutionScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'resolution' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    }

    async handleMegapixelsScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'megapixels' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    }
    
    async handleAutoFit() {
        const props = this.node.properties;
        const category = props.selectedCategory;
        if (!category) return;
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-fit: Width or height widget not found");
            return;
        }
        const result = await this.requestBackendCalculation('auto_fit', {
            width: this.widthWidget.value,
            height: this.heightWidget.value,
            selected_category: category,
            use_custom_calc: props.useCustomCalc
        });
        this.applyBackendCalculationResult(result);
    }
    async handleAutoCalc() {
        const props = this.node.properties;
        
        if (!props.selectedCategory) {
            log.debug("Auto-calc: Category not selected");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-calc: Width or height widget not found");
            return;
        }
        const result = await this.requestBackendCalculation('custom_calc', {
            width: this.widthWidget.value,
            height: this.heightWidget.value,
            selected_category: props.selectedCategory
        });
        this.applyBackendCalculationResult(result, { updatePreset: false });
        
    }
    
    async handleAutoResize() {
        const props = this.node.properties;
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-Resize: Width or height widget not found");
            return;
        }
        const result = await this.requestBackendCalculation('auto_resize', {
            rescale_mode: props.rescaleMode
        });
        this.applyBackendCalculationResult(result, { updatePreset: false });
    }
    
    handleDetectedClick() {
        if (!this.detectedDimensions) {
            log.debug("Detected click: No detected dimensions available");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Detected click: Width or height widget not found");
            return;
        }
        this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
        
        log.debug(`Detected click applied: Set dimensions to ${this.detectedDimensions.width}x${this.detectedDimensions.height}`);
    }
    
    handleManagePresets() {
        log.debug("Manage Presets button clicked - opening dialog");
        this.presetManagerDialog.show();
    }
    
    async applyDimensionChange() {
        const props = this.node.properties;
        let { value: width } = this.widthWidget;
        let { value: height } = this.heightWidget;

        if (props.useCustomCalc && props.selectedCategory) {
            const result = await this.requestBackendCalculation('custom_calc', {
                width,
                height,
                selected_category: props.selectedCategory
            });
            if (result) {
                ({ width, height } = result);
                this.applyRescaleResult(result);
            }
        }

        // Removed canvas min/max clamping - allow presets to set any resolution
        this.setDimensions(width, height);
    }

    async applyPreset(category, presetName) {
        const props = this.node.properties;
        const allPresets = this.getAllPresets();
        const preset = allPresets[category]?.[presetName];
        if (!preset) return;
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = preset.width;
            this.heightWidget.value = preset.height;
            props.selectedPreset = presetName;
            await this.applyDimensionChange();
            this.updateCanvasFromWidgets();
        }
    }
    getClosestPResolution(width, height) {
        const pValue = Math.sqrt(width * height * 9 / 16);
        return `(${Math.round(pValue)}p)`;
    }
    updateRescaleValue() {
        const props = this.node.properties;
        const cachedValue = this.getScaleFactor(props.rescaleMode);
        if (Number.isFinite(cachedValue)) {
            props.rescaleValue = cachedValue;
            if (this.rescaleValueWidget) {
                this.rescaleValueWidget.value = cachedValue;
            }
        }
        if (this.rescaleModeWidget) {
            this.rescaleModeWidget.value = props.rescaleMode;
        }
    }
    startAutoDetect() {
        if (this.dimensionCheckInterval) return;
        this.checkForImageDimensions();
        this.dimensionCheckInterval = setInterval(() => this.checkForImageDimensions(), 1000);
    }
    
    stopAutoDetect() {
        if (this.dimensionCheckInterval) {
            clearInterval(this.dimensionCheckInterval);
            this.dimensionCheckInterval = null;
        }
    }

    setAutoDetectSource(source) {
        const normalizedSource = source === 'frontend' ? 'frontend' : 'backend';
        this.node.properties.autoDetectSource = normalizedSource;
        if (this.autoDetectSourceWidget) {
            this.autoDetectSourceWidget.value = normalizedSource;
        }
    }

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
    }

    setBackendFallbackWidgetValue(propertyName, value) {
        this.node.properties[propertyName] = value;
        const widget = this.backendFallbackWidgets?.[propertyName];
        if (widget) {
            widget.value = value;
        }
    }

    syncBackendFallbackWidgets() {
        if (!this.backendFallbackWidgets) return;

        const props = this.node.properties;
        const presetsJSON = this.getCategoryPresetsJSON(props.selectedCategory);

        this.setBackendFallbackWidgetValue('autoFitOnChange', !!props.autoFitOnChange);
        this.setBackendFallbackWidgetValue('autoResizeOnChange', !!props.autoResizeOnChange);
        this.setBackendFallbackWidgetValue('autoSnapOnChange', !!props.autoSnapOnChange);
        this.setBackendFallbackWidgetValue('useCustomCalc', !!props.useCustomCalc);
        this.setBackendFallbackWidgetValue('preserveScalingRatio', !!props.preserveScalingRatio);
        this.setBackendFallbackWidgetValue('selectedCategory', props.selectedCategory || "");
        this.setBackendFallbackWidgetValue('snapValue', Math.max(1, Math.round(Number(props.snapValue) || 64)));
        this.setBackendFallbackWidgetValue('upscaleValue', Math.max(0, Number(props.upscaleValue) || 0));
        this.setBackendFallbackWidgetValue('targetResolution', Math.max(1, Math.round(Number(props.targetResolution) || 1080)));
        this.setBackendFallbackWidgetValue('targetMegapixels', Math.max(0, Number(props.targetMegapixels) || 0));
        this.setBackendFallbackWidgetValue('autoDetectPresetsJSON', presetsJSON);
    }

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
    }
    
    async checkForImageDimensions() {
        const node = this.node;
        try {
            const previewDimensions = this.getConnectedPreviewDimensions();
            const backendDimensions = previewDimensions ? null : await this.getBackendDetectedDimensions();
            const dimensions = previewDimensions || backendDimensions;
            if (!dimensions) {
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
                
                app.graph.setDirtyCanvas(true);
            }
        } catch (error) {
            log.error('Error checking for image dimensions:', error);
        }
    }

    getConnectedSourceNode() {
        const inputLink = this.node.inputs?.[0]?.link;
        if (!inputLink || !app.graph?.links) return null;

        const link = app.graph.links[inputLink];
        if (!link) return null;

        return app.graph.getNodeById(link.origin_id) || null;
    }

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
    }

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
    }

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
            log.debug('Backend dimensions unavailable:', error);
            return null;
        }
    }
    
    isPointInControl(x, y, control) {
        if (!control) return false;
        return x >= control.x && x <= control.x + control.w &&
               y >= control.y && y <= control.y + control.h;
    }
}
app.registerExtension({
    name: "azResolutionMaster",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "ResolutionMaster") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                onNodeCreated?.apply(this, []);
                this.resolutionMaster = new ResolutionMasterCanvas(this);
            };
        }
    }
});
