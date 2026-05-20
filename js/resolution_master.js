import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./log_system/log_funcs.js";
import { loadIcons } from "./utils/icon_utils.js";
import { tooltips } from "./config/resolution_master_tooltips.js";
import { presetCategories } from "./presets/preset_categories.js";
import { CustomValueDialogManager } from "./dialogs/custom_value_dialog_manager.js";
import { SearchableDropdown } from "./components/searchable_dropdown.js";
import { AspectRatioSelector } from "./components/aspect_ratio_selector.js";
import { CustomPresetsManager } from "./presets/custom_presets_manager.js";
import { PresetManagerDialog } from "./presets/preset_manager/preset_manager_dialog.js";
import { DEFAULT_NODE_PROPERTIES, RESOLUTION_OPTIONS } from "./node/default_node_properties.js";
import { createAspectLock, getAspectLockedDimensions } from "./canvas/aspect_ratio_math.js";
import {
    calculateScaleFactor as calculateScaleFactorForDimensions,
    calculateScaledDimensions
} from "./scaling/scaling_math.js";
import { autoDetectMethods } from "./auto_detect/auto_detect_methods.js";
import { drawingMethods } from "./drawing/resolution_master_draw_methods.js";
const log = createModuleLogger('resolution_master');

class ResolutionMasterCanvas {    
    constructor(node) {
        this.node = node;
        this.app = app;
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
        this.customValueDialogManager = new CustomValueDialogManager(this, app);
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
        this.resolutions = [...RESOLUTION_OPTIONS];

        this.icons = {};
        loadIcons(this.icons);
        this.tooltips = tooltips;
        this.presetCategories = presetCategories;
        
        this.setupNode();
        import('./styles/stylesheet_loader.js').then(module => {
            module.loadStylesWhenNeeded();
        }).catch(error => {
            log.error('Failed to load CSS:', error);
        });
        
        // Mark initialization complete after a short delay to allow ComfyUI to finish setup
        requestAnimationFrame(() => {
            this._isInitializing = false;
            if (this._pendingCanvasUpdate) {
                this.requestCanvasUpdate(true);
            }
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
        Object.entries(DEFAULT_NODE_PROPERTIES).forEach(([key, defaultValue]) => {
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
            if (self.customValueDialogManager.customInputDialog) {
                self.customValueDialogManager.closeCustomInputDialog();
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
                        this.customValueDialogManager.showCustomValueDialog(key, e);
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
        this.requestCanvasUpdate();
        
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
        
        this.requestCanvasUpdate();
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
        return calculateScaleFactorForDimensions(width, height, props, mode);
    }

    calculateScalingPreview(mode) {
        return this.calculateLocalScaledDimensions(this.calculateScaleFactor(mode));
    }

    calculateLocalScaledDimensions(scale) {
        const props = this.node.properties;
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value ?? props.valueX) || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value ?? props.valueY) || 1));
        return calculateScaledDimensions(width, height, scale, props.preserveScalingRatio);
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

    syncCanvasPositionFromDimensions(width = this.node.properties.valueX, height = this.node.properties.valueY) {
        const props = this.node.properties;
        const rangeX = props.canvas_max_x - props.canvas_min_x;
        const rangeY = props.canvas_max_y - props.canvas_min_y;

        if (rangeX > 0) {
            this.node.intpos.x = (width - props.canvas_min_x) / rangeX;
            this.node.intpos.x = Math.max(0, Math.min(1, this.node.intpos.x));
        }
        if (rangeY > 0) {
            this.node.intpos.y = (height - props.canvas_min_y) / rangeY;
            this.node.intpos.y = Math.max(0, Math.min(1, this.node.intpos.y));
        }
    }
    
    setDimensions(width, height, options = {}) {
        if (!this.validateWidgets()) return;
        this.node.properties.valueX = width;
        this.node.properties.valueY = height;
        this.widthWidget.value = width;
        this.heightWidget.value = height;
        if (options.syncPosition !== false) {
            this.syncCanvasPositionFromDimensions(width, height);
        }
        if (options.updateBackend !== false) {
            this.updateRescaleValue();
        }

        if (options.updateCanvas !== false) {
            this.requestCanvasUpdate();
        }
    }
    
    updateCanvasFromWidgets(options = {}) {
        if (!this.validateWidgets()) return;
        
        const node = this.node;
        const props = node.properties;
        props.valueX = this.widthWidget.value;
        props.valueY = this.heightWidget.value;
        this.syncCanvasPositionFromDimensions(this.widthWidget.value, this.heightWidget.value);
        if (options.updateBackend !== false) {
            this.updateRescaleValue();
        }
        this.requestCanvasUpdate();
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
            this.setDimensions(newX, newY, { syncPosition: false });
        }
    }

    createAspectLock() {
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value) || this.node.properties.valueX || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value) || this.node.properties.valueY || 1));
        return createAspectLock(width, height);
    }

    getCanvasAspectLock() {
        if (!this.canvasDragAspectLock) {
            this.canvasDragAspectLock = this.createAspectLock();
        }
        return this.canvasDragAspectLock;
    }

    getAspectLockedDimensions(targetWidth, targetHeight, snapToGrid = false) {
        return getAspectLockedDimensions(
            targetWidth,
            targetHeight,
            this.node.properties,
            this.getCanvasAspectLock(),
            snapToGrid
        );
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
        if (props.valueX !== newX) {
            this.setDimensions(newX, this.heightWidget.value, { syncPosition: false });
        }
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
        if (props.valueY !== newY) {
            this.setDimensions(this.widthWidget.value, newY, { syncPosition: false });
        }
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
    isPointInControl(x, y, control) {
        if (!control) return false;
        return x >= control.x && x <= control.x + control.w &&
               y >= control.y && y <= control.y + control.h;
    }
}

Object.assign(ResolutionMasterCanvas.prototype, drawingMethods, autoDetectMethods);

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
