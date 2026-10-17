/**
 * calculation_settings.js - Centralized normalization for calculation and backend fallback settings.
 */

/**
 * Normalizes backend fallback and calculation settings from node properties or overrides.
 *
 * @param {Object} props - Node properties (camelCase)
 * @param {Object} [overrides={}] - Optional overrides supporting snake_case or camelCase keys
 * @param {Function} [presetsJsonProvider=null] - Optional function receiving selectedCategory and returning presets JSON string
 * @returns {Object} Normalized settings in camelCase
 */
export function normalizeCalculationSettings(props = {}, overrides = {}, presetsJsonProvider = null) {
    const get = (snakeName, camelName, fallback) =>
        overrides[snakeName] ?? overrides[camelName] ?? props[camelName] ?? fallback;

    const selectedCategory = get('selected_category', 'selectedCategory', "");
    const presetsJson = overrides.presets_json ?? overrides.presetsJSON ??
        (typeof presetsJsonProvider === "function" ? presetsJsonProvider(selectedCategory) : (props.autoDetectPresetsJSON || "{}"));

    return {
        autoFitOnChange: !!get('auto_fit_on_change', 'autoFitOnChange', false),
        autoResizeOnChange: !!get('auto_resize_on_change', 'autoResizeOnChange', false),
        autoSnapOnChange: !!get('auto_snap_on_change', 'autoSnapOnChange', false),
        smartFit: !!get('smart_fit', 'smartFit', false),
        useCustomCalc: !!get('use_custom_calc', 'useCustomCalc', false),
        preserveScalingRatio: !!get('preserve_scaling_ratio', 'preserveScalingRatio', false),
        preserveScalingSnap: !!get('preserve_scaling_snap', 'preserveScalingSnap', false),
        selectedCategory,
        snapValue: Math.max(1, Math.round(Number(get('snap_value', 'snapValue', 64)) || 64)),
        upscaleValue: Math.max(0, Number(get('upscale_value', 'upscaleValue', 1.0)) || 0),
        targetResolution: Math.max(1, Math.round(Number(get('target_resolution', 'targetResolution', 1080)) || 1080)),
        targetMegapixels: Math.max(0, Number(get('target_megapixels', 'targetMegapixels', 2.0)) || 0),
        rescaleMode: get('rescale_mode', 'rescaleMode', props.rescaleMode || "resolution"),
        presetsJson
    };
}
