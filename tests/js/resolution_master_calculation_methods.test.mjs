import assert from "node:assert/strict";
import test from "node:test";

import { calculationMethods } from "../../js/calculations/resolution_master_calculation_methods.js";
import {
    CALCULATION_CONFIG_KEYS,
    CALCULATION_CONFIG_VERSION
} from "../../js/calculations/model_profiles.js";


test("calculation preset JSON excludes hidden presets and retains custom overrides", () => {
    const context = {
        node: { properties: { selectedCategory: "Standard" } },
        getAllPresets() {
            return {
                Standard: {
                    Hidden: { width: 1024, height: 1024, isHidden: true },
                    Visible: { width: 1280, height: 720, isHidden: false },
                    Custom: { width: 2048, height: 2048, isCustom: true, isHidden: false }
                }
            };
        }
    };

    const config = JSON.parse(calculationMethods.getCategoryPresetsJSON.call(context));
    const presets = config[CALCULATION_CONFIG_KEYS.presets];

    assert.equal(config[CALCULATION_CONFIG_KEYS.version], CALCULATION_CONFIG_VERSION);
    assert.equal(config[CALCULATION_CONFIG_KEYS.profile].strategy, "closest_aspect");
    assert.deepEqual(Object.keys(presets), ["Visible", "Custom"]);
    assert.equal(presets.Custom.isCustom, true);
});


test("applyPreset rejects a hidden preset referenced by stale UI state", async () => {
    const context = {
        node: {
            id: 7,
            properties: { selectedPreset: "Visible" }
        },
        widthWidget: { value: 640 },
        heightWidget: { value: 480 },
        getAllPresets() {
            return {
                Standard: {
                    Hidden: { width: 1024, height: 1024, isHidden: true }
                }
            };
        },
        async applyDimensionChange() {
            assert.fail("hidden preset must not trigger dimension calculation");
        },
        updateCanvasFromWidgets() {
            assert.fail("hidden preset must not update the canvas");
        }
    };

    await calculationMethods.applyPreset.call(context, "Standard", "Hidden");

    assert.equal(context.widthWidget.value, 640);
    assert.equal(context.heightWidget.value, 480);
    assert.equal(context.node.properties.selectedPreset, "Visible");
});


test("handleScale, handleResolutionScale, handleMegapixelsScale request backend and update rescale value", async () => {
    const requests = [];
    let rescaleValueUpdated = 0;
    const context = {
        node: {
            id: 7,
            properties: {
                rescaleMode: "resolution"
            }
        },
        handleScaleMode: calculationMethods.handleScaleMode,
        async requestBackendCalculation(action, payload) {
            requests.push({ action, payload });
            return { ok: true, width: 960, height: 540, rescale_factor: 1.5 };
        },
        applyBackendCalculationResult(result, options) {
            assert.deepEqual(options, { updatePreset: false, applyRescale: false });
            return true;
        },
        updateRescaleValue() {
            rescaleValueUpdated += 1;
        }
    };

    await calculationMethods.handleScale.call(context);
    await calculationMethods.handleResolutionScale.call(context);
    await calculationMethods.handleMegapixelsScale.call(context);

    assert.equal(requests.length, 3);
    assert.equal(requests[0].payload.rescale_mode, "manual");
    assert.equal(requests[1].payload.rescale_mode, "resolution");
    assert.equal(requests[2].payload.rescale_mode, "megapixels");
    assert.equal(rescaleValueUpdated, 3);
});


test("buildCalculationPayload normalizes properties, clamp values, and applies snake and camel overrides", () => {
    const context = {
        node: {
            properties: {
                selectedCategory: "Flux",
                snapValue: 32,
                upscaleValue: 2.5,
                targetResolution: 720,
                targetMegapixels: 1.5,
                rescaleMode: "megapixels",
                autoFitOnChange: true,
                autoResizeOnChange: false,
                autoSnapOnChange: true,
                smartFit: true,
                useCustomCalc: false,
                preserveScalingRatio: true,
                preserveScalingSnap: true,
                valueX: 800,
                valueY: 600
            }
        },
        widthWidget: { value: 1200 },
        heightWidget: { value: 900 },
        getCategoryPresetsJSON(cat) {
            return JSON.stringify({ category: cat });
        }
    };

    const payloadDefault = calculationMethods.buildCalculationPayload.call(context, "custom_calc");
    assert.equal(payloadDefault.action, "custom_calc");
    assert.equal(payloadDefault.width, 1200);
    assert.equal(payloadDefault.height, 900);
    assert.equal(payloadDefault.selected_category, "Flux");
    assert.equal(payloadDefault.snap_value, 32);
    assert.equal(payloadDefault.upscale_value, 2.5);
    assert.equal(payloadDefault.target_resolution, 720);
    assert.equal(payloadDefault.target_megapixels, 1.5);
    assert.equal(payloadDefault.rescale_mode, "megapixels");
    assert.equal(payloadDefault.auto_fit_on_change, true);
    assert.equal(payloadDefault.auto_resize_on_change, false);
    assert.equal(payloadDefault.auto_snap_on_change, true);
    assert.equal(payloadDefault.smart_fit, true);
    assert.equal(payloadDefault.use_custom_calc, false);
    assert.equal(payloadDefault.preserve_scaling_ratio, true);
    assert.equal(payloadDefault.preserve_scaling_snap, true);
    assert.equal(payloadDefault.presets_json, JSON.stringify({ category: "Flux" }));

    // Overrides test with invalid/clamped values and mixed casing
    const payloadOverrides = calculationMethods.buildCalculationPayload.call(context, "auto_resize", {
        width: "640",
        height: 480,
        snap_value: -10, // clamped to min 1
        upscaleValue: -5, // clamped to min 0
        target_resolution: 0, // clamped to min 1
        targetMegapixels: -1, // clamped to min 0
        rescale_mode: "manual",
        selectedCategory: "SDXL",
        presetsJSON: '{"override":true}'
    });
    assert.equal(payloadOverrides.action, "auto_resize");
    assert.equal(payloadOverrides.width, 640);
    assert.equal(payloadOverrides.height, 480);
    assert.equal(payloadOverrides.selected_category, "SDXL");
    assert.equal(payloadOverrides.snap_value, 1);
    assert.equal(payloadOverrides.upscale_value, 0);
    assert.equal(payloadOverrides.target_resolution, 1080);
    assert.equal(payloadOverrides.target_megapixels, 0);
    assert.equal(payloadOverrides.rescale_mode, "manual");
    assert.equal(payloadOverrides.presets_json, '{"override":true}');
});

