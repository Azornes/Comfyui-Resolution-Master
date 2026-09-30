import assert from "node:assert/strict";
import test from "node:test";

import { drawingMethods } from "../../js/drawing/resolution_master_draw_methods.js";

test("scaling priority checkboxes share one row and have distinct hit areas", () => {
    const labels = [];
    const checkboxes = [];
    const ctx = {
        measureText(text) { return { width: text.length * 6 }; },
        fillText(text) { labels.push(text); }
    };
    const context = {
        node: { size: [330, 400], properties: { preserveScalingRatio: true, preserveScalingSnap: true, upscaleValue: 1, targetMegapixels: 2 } },
        icons: {}, controls: {},
        drawScalingRowBase() {}, calculateScaleFactor() { return 1; }, calculateScalingPreview() {},
        drawCheckbox(ctx, x, y, size, checked) { checkboxes.push({ x, y, size, checked }); }
    };
    assert.equal(drawingMethods.drawScalingGrid.call(context, ctx, 0), 130);
    assert.deepEqual(labels, ["Prioritize ratio", "Prioritize snap"]);
    assert.equal(checkboxes.length, 2);
    assert.ok(checkboxes.every(box => box.checked && box.x >= 20 && box.x + box.size <= 310));
    assert.equal(checkboxes[0].y, checkboxes[1].y);
    assert.ok(context.controls.preserveScalingRatioCheckbox.x < context.controls.preserveScalingSnapCheckbox.x);
});

test("canvas information shows actual megapixels with two to three decimal places", () => {
    for (const [width, height, expected] of [
        [2000, 1000, "2.00 MP"],
        [3091, 1000, "3.091 MP"],
        [1359, 1472, "2.00 MP"],
        [1234, 1001, "1.235 MP"]
    ]) {
        const context = { widthWidget: { value: width }, heightWidget: { value: height } };
        assert.ok(drawingMethods.getInfoText.call(context).includes(`|  ${expected} `));
    }
});


test("ZImageTurbo calculation info describes active preset matching", () => {
    const context = {
        node: { properties: { selectedCategory: "ZImageTurbo" } }
    };

    assert.equal(
        drawingMethods.getCalcInfoMessage.call(context),
        "💡 ZImageTurbo Mode: Uses the closest active preset size while preserving orientation. Built-in presets use official resolutions."
    );
});
