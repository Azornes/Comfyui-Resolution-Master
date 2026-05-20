import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger('resolution_master_interaction_methods');

export const interactionMethods = {
    getCanvasPointer(canvas) {
        return canvas?.pointer
            || this._capturedPointerCanvas?.pointer
            || this.node?.graph?.canvas?.pointer
            || this.app?.canvas?.pointer
            || null;
    },

    captureNodePointer(canvas) {
        const pointer = this.getCanvasPointer(canvas);
        if (pointer && "capture" in pointer) {
            pointer.capture = this.node;
            this._capturedPointerCanvas = canvas || this.node?.graph?.canvas || this.app?.canvas || null;
            return;
        }

        if (!this._loggedLegacyCaptureFallback) {
            this._loggedLegacyCaptureFallback = true;
            log.warn('Canvas pointer API unavailable; falling back to deprecated captureInput', {
                nodeId: this.node?.id ?? null
            });
        }
        this.node.captureInput?.(true);
    },

    releaseNodePointer(canvas) {
        const pointer = this.getCanvasPointer(canvas);
        if (pointer && "capture" in pointer) {
            if (pointer.capture === this.node) {
                pointer.capture = null;
            }
            this._capturedPointerCanvas = null;
            return;
        }

        if (!this._loggedLegacyCaptureFallback) {
            this._loggedLegacyCaptureFallback = true;
            log.warn('Canvas pointer API unavailable; falling back to deprecated captureInput', {
                nodeId: this.node?.id ?? null
            });
        }
        this.node.captureInput?.(false);
        this._capturedPointerCanvas = null;
    },

    handleMouseDown(e, pos, canvas) {
        const node = this.node;
        const props = node.properties;

        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];

        if (props.mode === "Manual") {
            if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
                node.capture = 'canvas2dRightHandle';
                this.captureNodePointer(canvas);
                return true;
            }

            if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
                node.capture = 'canvas2dTopHandle';
                this.captureNodePointer(canvas);
                return true;
            }
            const c2d = this.controls.canvas2d;
            if (c2d && this.isPointInControl(relX, relY, c2d)) {
                node.capture = 'canvas2d';
                this.canvasDragAspectLock = this.createAspectLock();
                this.captureNodePointer(canvas);
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
                    this.captureNodePointer(canvas);
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
    },

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
    },

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
            this.app?.graph?.setDirtyCanvas(true);
        }
    },

    handleTooltipHover(element, e) {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.showTooltip) {
            this.showTooltip = false;
            this.tooltipElement = null;
            this.app?.graph?.setDirtyCanvas(true);
        }
        if (element && this.tooltips[element]) {
            const initialMousePos = { x: e.canvasX, y: e.canvasY };
            this.tooltipTimer = setTimeout(() => {
                this.tooltipElement = element;
                this.showTooltip = true;
                this.tooltipFixedPos = initialMousePos;
                this.app?.graph?.setDirtyCanvas(true);
            }, this.tooltipDelay);
        }
    },

    handleMouseUp(e) {
        const node = this.node;

        if (!node.capture) return false;

        node.capture = false;
        this.canvasDragAspectLock = null;
        this.releaseNodePointer();

        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = node.properties.valueX;
            this.heightWidget.value = node.properties.valueY;
        }

        this.updateRescaleValue();
        this.requestCanvasUpdate();

        return true;
    },

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
    },

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
    },

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
                <button type="button" data-close style="width:28px; height:28px; border-radius:5px; border:1px solid #555; background:#333; color:#ddd; cursor:pointer; font-size:16px; line-height:1;">&times;</button>
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
    },

    closeHelpDialog() {
        if (this.helpDialogOverlay?.parentNode) {
            this.helpDialogOverlay.parentNode.removeChild(this.helpDialogOverlay);
        }
        this.helpDialogOverlay = null;
        this.helpDialog = null;
    },

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
            this.app?.graph?.setDirtyCanvas(true);
        } else if (toggleName === 'calcInfoToggle' && props.selectedCategory) {
            props.showCalcInfo = !props.showCalcInfo;
            this.app?.graph?.setDirtyCanvas(true);
        }
    },

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
        this.app?.graph?.setDirtyCanvas(true);
    },

    handleRadioClick(radioName) {
        const props = this.node.properties;
        const radioMap = {
            upscaleRadio: 'manual',
            resolutionRadio: 'resolution',
            megapixelsRadio: 'megapixels'
        };
        props.rescaleMode = radioMap[radioName];
        this.updateRescaleValue();
        this.app?.graph?.setDirtyCanvas(true);
    },

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
        this.app?.graph?.setDirtyCanvas(true, true);

        log.debug(`Section ${sectionKey} ${this.collapsedSections[sectionKey] ? 'collapsed' : 'expanded'}`);
    },

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

        this.app?.graph?.setDirtyCanvas(true);
    },

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
                        text: `${name} (${dims.width}\u00d7${dims.height})`,
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
    },

    showLatentTypeSelector(e) {
        if (!this.latentTypeWidget) {
            log.debug("Latent type selector: latent_type widget not found");
            return;
        }

        const currentValue = this.latentTypeWidget.value || 'latent_4x8';

        const latentTypes = [
            { text: '4x8 (Standard SD/SDXL/Flux)', value: 'latent_4x8' },
            { text: '128x16 (Flux.2)', value: 'latent_128x16' }
        ];

        const items = latentTypes.map(type => ({
            text: type.text,
            value: type.value,
            isCustom: type.value === currentValue
        }));

        this.searchableDropdown.show(items, {
            event: e,
            title: 'Select Latent Type',
            callback: (selectedText) => {
                const selectedType = latentTypes.find(t => t.text === selectedText);
                if (selectedType && this.latentTypeWidget) {
                    this.latentTypeWidget.value = selectedType.value;
                    log.debug(`Latent type manually changed to: ${selectedType.value}`);
                    this.app?.graph?.setDirtyCanvas(true);
                }
            }
        });
    },

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
                this.syncBackendFallbackWidgets();
                this.updateRescaleValue();
                this.app?.graph?.setDirtyCanvas(true);
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
                this.app?.graph?.setDirtyCanvas(true);
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
    },

    handleSwap() {
        if (!this.validateWidgets()) return;

        const newWidth = this.heightWidget.value;
        const newHeight = this.widthWidget.value;
        this.setDimensions(newWidth, newHeight);
    },

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
    },

    handleManagePresets() {
        log.debug("Manage Presets button clicked - opening dialog");
        this.presetManagerDialog.show();
    }
};
