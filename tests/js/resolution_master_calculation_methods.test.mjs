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
