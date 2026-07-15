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
