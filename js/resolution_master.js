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
import { interactionMethods } from "./interaction/resolution_master_interaction_methods.js";
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

Object.assign(ResolutionMasterCanvas.prototype, drawingMethods, autoDetectMethods, interactionMethods);

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
