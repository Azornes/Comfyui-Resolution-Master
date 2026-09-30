import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../js/utils/icon_utils.js", {
    namedExports: { inlineSvgIcons: {} }
});
const { interactionMethods } = await import("../../js/interaction/resolution_master_interaction_methods.js");

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

test("manual scaling retains its existing one-decimal rounding", () => {
    const context = {
        node: { properties: { scaling_slider_min: 0.1, scaling_slider_max: 4, scaling_slider_step: 0.01 } },
        updateRescaleValue() {}, handlePropertyChange() {}, requestCanvasUpdate() {}
    };
    interactionMethods.updateSliderValue.call(context, "scaleSlider", (1.23 - 0.1) / 3.9 * 100, 100);
    assert.equal(context.node.properties.upscaleValue, 1.2);
});
