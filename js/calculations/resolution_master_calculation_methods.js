import { createModuleLogger } from "../log_system/log_funcs.js";
import {
    calculateScaleFactor as calculateScaleFactorForDimensions,
    calculateScaledDimensions
} from "../scaling/scaling_math.js";

const log = createModuleLogger('resolution_master_calculation_methods');

export const calculationMethods = {
    getAllPresets() {
        return this.customPresetsManager.getMergedPresets(this.presetCategories);
    },

    getCategoryPresetsJSON(category = this.node.properties.selectedCategory) {
        const categoryPresets = category ? (this.getAllPresets()[category] || {}) : {};
        try {
            return JSON.stringify(categoryPresets);
        } catch (error) {
            log.warn('Failed to serialize calculation presets:', error);
            return "{}";
        }
    },

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
    },

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
    },

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
    },

    getScaleFactor(mode) {
        return this.calculateScaleFactor(mode);
    },

    calculateScaleFactor(mode = this.node.properties.rescaleMode) {
        const props = this.node.properties;
        const width = Math.max(1, Number(this.widthWidget?.value ?? props.valueX) || 1);
        const height = Math.max(1, Number(this.heightWidget?.value ?? props.valueY) || 1);
        return calculateScaleFactorForDimensions(width, height, props, mode);
    },

    calculateScalingPreview(mode) {
        return this.calculateLocalScaledDimensions(this.calculateScaleFactor(mode));
    },

    calculateLocalScaledDimensions(scale) {
        const props = this.node.properties;
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value ?? props.valueX) || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value ?? props.valueY) || 1));
        return calculateScaledDimensions(width, height, scale, props.preserveScalingRatio);
    },

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
    },

    async handleSnap() {
        if (!this.validateWidgets()) return;
        const result = await this.requestBackendCalculation('auto_snap');
        this.applyBackendCalculationResult(result, { updatePreset: false });
    },

    async handleScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'manual' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    },

    async handleResolutionScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'resolution' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    },

    async handleMegapixelsScale() {
        const result = await this.requestBackendCalculation('auto_resize', { rescale_mode: 'megapixels' });
        if (this.applyBackendCalculationResult(result, { updatePreset: false, applyRescale: false })) {
            this.updateRescaleValue();
        }
    },

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
    },

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
    },

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
    },

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

        this.setDimensions(width, height);
    },

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
    },

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
};
