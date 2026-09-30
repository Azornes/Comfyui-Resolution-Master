import assert from "node:assert/strict";
import test from "node:test";
import { getSliderStepDecimals, roundSliderValue, formatMegapixels, formatScaling } from "../../js/utils/slider_precision.js";

test("megapixels precision follows decimal and scientific notation steps", () => {
    for (const [step, decimals, value, label] of [
        [0.1, 1, 1.2, "1.2MP"],
        [0.01, 2, 1.23, "1.23MP"],
        [0.001, 3, 1.234, "1.234MP"],
        [0.025, 3, 1.225, "1.225MP"],
        [1, 0, 2, "2.0MP"]
    ]) {
        assert.equal(getSliderStepDecimals(step), decimals);
        const snapped = Math.round(value / step) * step;
        assert.equal(roundSliderValue(snapped, step), value);
        assert.equal(formatMegapixels(value, step), label);
        assert.equal(formatScaling(value, step), label.replace("MP", "x"));
    }
});

test("megapixels values and labels are limited to three decimal places", () => {
    for (const step of [0.0001, 1e-7, 2.5e-7]) {
        assert.equal(getSliderStepDecimals(step), 3);
        assert.equal(roundSliderValue(3.0912345, step), 3.091);
        assert.equal(formatMegapixels(3.0912345, step), "3.091MP");
        assert.equal(formatScaling(3.0912345, step), "3.091x");
    }
});

test("invalid steps use the default display precision", () => {
    for (const step of [undefined, NaN, Infinity, 0, -0.01]) {
        assert.equal(getSliderStepDecimals(step), 1);
        assert.equal(formatMegapixels(1.2, step), "1.2MP");
    }
});
