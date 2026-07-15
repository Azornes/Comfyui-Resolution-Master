import assert from "node:assert/strict";
import test from "node:test";

import { drawingMethods } from "../../js/drawing/resolution_master_draw_methods.js";


test("ZImageTurbo calculation info describes active preset matching", () => {
    const context = {
        node: { properties: { selectedCategory: "ZImageTurbo" } }
    };

    assert.equal(
        drawingMethods.getCalcInfoMessage.call(context),
        "💡 ZImageTurbo Mode: Uses the closest active preset size while preserving orientation. Built-in presets use official resolutions."
    );
});
