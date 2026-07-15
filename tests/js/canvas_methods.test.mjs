import assert from "node:assert/strict";
import test from "node:test";
import { canvasMethods } from "../../js/canvas/resolution_master_canvas_methods.js";

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
