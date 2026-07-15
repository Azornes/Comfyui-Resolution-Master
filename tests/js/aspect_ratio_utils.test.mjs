import assert from "node:assert/strict";
import test from "node:test";

import { AspectRatioUtils } from "../../js/presets/aspect_ratio_utils.js";

test("AspectRatioUtils.calculateAspectRatio returns correct rounded strings", () => {
    assert.equal(AspectRatioUtils.calculateAspectRatio(1920, 1080), "16:9");
    assert.equal(AspectRatioUtils.calculateAspectRatio(1024, 1024), "1:1");
    assert.equal(AspectRatioUtils.calculateAspectRatio(1200, 800), "3:2");
    assert.equal(AspectRatioUtils.calculateAspectRatio(1280, 720), "16:9");
    // AspectRatioUtils has a 2% tolerance to match common ratios
    assert.equal(AspectRatioUtils.calculateAspectRatio(1000, 560), "16:9"); 
});
