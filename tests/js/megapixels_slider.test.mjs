import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../js/utils/icon_utils.js", {
    namedExports: { inlineSvgIcons: {} }
});
const { interactionMethods } = await import("../../js/interaction/resolution_master_interaction_methods.js");

test("snap priority checkbox toggles independently and synchronizes the workflow", () => {
    const calls = [];
    const context = {
        node: { properties: { preserveScalingRatio: true, preserveScalingSnap: false } },
        syncBackendFallbackWidgets() { calls.push("sync"); },
        updateRescaleValue() { calls.push("rescale"); },
        requestCanvasUpdate() { calls.push("canvas"); }
    };
    interactionMethods.handleCheckboxClick.call(context, "preserveScalingSnapCheckbox");
    assert.equal(context.node.properties.preserveScalingSnap, true);
    assert.equal(context.node.properties.preserveScalingRatio, true);
    assert.deepEqual(calls, ["sync", "rescale", "canvas"]);
    interactionMethods.handleCheckboxClick.call(context, "preserveScalingSnapCheckbox");
    assert.equal(context.node.properties.preserveScalingSnap, false);
});

test("dragging the megapixels slider preserves configured precision and notifies consumers", () => {
    for (const [step, target] of [[0.1, 1.2], [0.01, 1.23], [0.001, 1.234], [0.025, 1.225], [0.0001, 3.0912]]) {
        const calls = [];
        const context = {
            node: { properties: {
                megapixels_slider_min: 0.5, megapixels_slider_max: 6,
                megapixels_slider_step: step
            } },
            updateRescaleValue() { calls.push("rescale"); },
            handlePropertyChange() { calls.push("properties"); },
            requestCanvasUpdate() { calls.push("canvas"); }
        };
        interactionMethods.updateSliderValue.call(context, "megapixelsSlider", (target - 0.5) / 5.5 * 100, 100);
        assert.equal(context.node.properties.targetMegapixels, Number(target.toFixed(3)));
        assert.deepEqual(calls, ["rescale", "properties", "canvas"]);
    }
});

test("manual scaling follows configured precision up to three decimal places", () => {
    for (const [step, target, expected] of [[0.1, 1.2, 1.2], [0.01, 1.23, 1.23], [0.001, 1.234, 1.234], [0.025, 1.225, 1.225], [0.0001, 3.0912, 3.091]]) {
    const context = {
        node: { properties: { scaling_slider_min: 0.1, scaling_slider_max: 4, scaling_slider_step: step } },
        updateRescaleValue() {}, handlePropertyChange() {}, requestCanvasUpdate() {}
    };
    interactionMethods.updateSliderValue.call(context, "scaleSlider", (target - 0.1) / 3.9 * 100, 100);
    assert.equal(context.node.properties.upscaleValue, expected);
    }
});
