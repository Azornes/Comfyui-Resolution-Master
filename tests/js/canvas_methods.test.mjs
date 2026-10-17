import assert from "node:assert/strict";
import test from "node:test";
import { canvasMethods, calculateCanvasAxisValue } from "../../js/canvas/resolution_master_canvas_methods.js";

// Mock minimal performance diagnostics
globalThis.performanceDiagnostics = {
    start: () => "token",
    end: () => {}
};

test("updateCanvasValueWidth maps, snaps, and calls setDimensions", () => {
    const dimensions = [];
    const context = {
        node: {
            properties: {
                canvas_min_x: 320,
                canvas_max_x: 2560,
                canvas_step_x: 64,
                canvas_decimals_x: 0,
                valueX: 512,
                valueY: 512
            },
            intpos: { x: 0 }
        },
        heightWidget: { value: 512 }
    };
    Object.assign(context, canvasMethods);
    context.setDimensions = (w, h, opts) => {
        dimensions.push({ w, h, opts });
    };

    // Coordinate half way through w
    context.updateCanvasValueWidth(100, 200, false); // x/w = 0.5 (snapped value should be 1472)

    assert.equal(context.node.intpos.x, 18 * (64 / 2240));
    assert.deepEqual(dimensions, [{ w: 1472, h: 512, opts: { syncPosition: false } }]);
});

test("updateCanvasValueHeight maps, snaps, and calls setDimensions", () => {
    const dimensions = [];
    const context = {
        node: {
            properties: {
                canvas_min_y: 320,
                canvas_max_y: 2560,
                canvas_step_y: 64,
                canvas_decimals_y: 0,
                valueX: 512,
                valueY: 512
            },
            intpos: { y: 0 }
        },
        widthWidget: { value: 512 }
    };
    Object.assign(context, canvasMethods);
    context.setDimensions = (w, h, opts) => {
        dimensions.push({ w, h, opts });
    };

    // Coordinate half way through h
    // Note: Y coordinate maps to 1 - y/h, so y=100 with h=200 maps to 1 - 0.5 = 0.5
    context.updateCanvasValueHeight(100, 200, false);

    assert.equal(context.node.intpos.y, 18 * (64 / 2240));
    assert.deepEqual(dimensions, [{ w: 512, h: 1472, opts: { syncPosition: false } }]);
});

test("updateCanvasValueWidth maps without snap when ctrlKey is true", () => {
    const dimensions = [];
    const context = {
        node: {
            properties: {
                canvas_min_x: 320,
                canvas_max_x: 2560,
                canvas_step_x: 64,
                canvas_decimals_x: 0,
                valueX: 512,
                valueY: 512
            },
            intpos: { x: 0 }
        },
        heightWidget: { value: 512 }
    };
    Object.assign(context, canvasMethods);
    context.setDimensions = (w, h, opts) => {
        dimensions.push({ w, h, opts });
    };

    // Half way coordinate, bypass snap
    context.updateCanvasValueWidth(100, 200, true);

    assert.equal(context.node.intpos.x, 0.5);
    // min + range * 0.5 = 320 + 2240 * 0.5 = 1440
    assert.deepEqual(dimensions, [{ w: 1440, h: 512, opts: { syncPosition: false } }]);
});

test("updateCanvasValue maps and snaps both 2D axes when ctrlKey is false", () => {
    const dimensions = [];
    const context = {
        node: {
            properties: {
                canvas_min_x: 320,
                canvas_max_x: 2560,
                canvas_step_x: 64,
                canvas_decimals_x: 0,
                canvas_min_y: 320,
                canvas_max_y: 2560,
                canvas_step_y: 64,
                canvas_decimals_y: 0,
                valueX: 512,
                valueY: 512
            },
            intpos: { x: 0, y: 0 }
        }
    };
    Object.assign(context, canvasMethods);
    context.setDimensions = (w, h, opts) => {
        dimensions.push({ w, h, opts });
    };

    context.updateCanvasValue(100, 100, 200, 200, false, false);

    assert.equal(context.node.intpos.x, 18 * (64 / 2240));
    assert.equal(context.node.intpos.y, 18 * (64 / 2240));
    assert.deepEqual(dimensions, [{ w: 1472, h: 1472, opts: { syncPosition: false } }]);
});

test("updateCanvasValue maps without snap when ctrlKey is true and shiftKey is false", () => {
    const dimensions = [];
    const context = {
        node: {
            properties: {
                canvas_min_x: 320,
                canvas_max_x: 2560,
                canvas_step_x: 64,
                canvas_decimals_x: 0,
                canvas_min_y: 320,
                canvas_max_y: 2560,
                canvas_step_y: 64,
                canvas_decimals_y: 0,
                valueX: 512,
                valueY: 512
            },
            intpos: { x: 0, y: 0 }
        }
    };
    Object.assign(context, canvasMethods);
    context.setDimensions = (w, h, opts) => {
        dimensions.push({ w, h, opts });
    };

    context.updateCanvasValue(100, 100, 200, 200, false, true);

    assert.equal(context.node.intpos.x, 0.5);
    assert.equal(context.node.intpos.y, 0.5);
    assert.deepEqual(dimensions, [{ w: 1440, h: 1440, opts: { syncPosition: false } }]);
});

test("calculateCanvasAxisValue maps coordinate with inversion and step snap", () => {
    // Y-axis scenario: coord 50 in size 200, inverted (1 - 50/200 = 0.75)
    // min: 100, max: 900 (range: 800), step: 100
    // stepScale = 100 / 800 = 0.125
    // normPos = Math.round(0.75 / 0.125) * 0.125 = 6 * 0.125 = 0.75
    // value = 100 + 800 * 0.75 = 700
    const res = calculateCanvasAxisValue({
        coord: 50,
        size: 200,
        isInverse: true,
        min: 100,
        max: 900,
        step: 100,
        decimals: 0,
        shouldSnap: true
    });

    assert.equal(res.normalizedPos, 0.75);
    assert.equal(res.value, 700);
});

test("calculateCanvasAxisValue supports normalizedPos input and decimal rounding without snap", () => {
    const res = calculateCanvasAxisValue({
        normalizedPos: 0.333333,
        min: 0,
        max: 10,
        step: 1,
        decimals: 2,
        shouldSnap: false
    });

    assert.equal(res.normalizedPos, 0.333333);
    assert.equal(res.value, 3.33);
});

test("calculateCanvasAxisValue clamps out-of-bounds coordinates to [0, 1]", () => {
    const resLow = calculateCanvasAxisValue({
        coord: -50,
        size: 100,
        isInverse: false,
        min: 0,
        max: 100,
        step: 10,
        shouldSnap: true
    });
    assert.equal(resLow.normalizedPos, 0);
    assert.equal(resLow.value, 0);

    const resHigh = calculateCanvasAxisValue({
        coord: 150,
        size: 100,
        isInverse: false,
        min: 0,
        max: 100,
        step: 10,
        shouldSnap: true
    });
    assert.equal(resHigh.normalizedPos, 1);
    assert.equal(resHigh.value, 100);
});
