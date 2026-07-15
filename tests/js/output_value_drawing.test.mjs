import assert from "node:assert/strict";
import test from "node:test";
import { drawingMethods } from "../../js/drawing/resolution_master_draw_methods.js";

function createCanvasContext() {
    const stateStack = [];
    const rectangles = [];
    const text = [];
    let currentRect = null;

    return {
        rectangles,
        text,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        save() {
            stateStack.push({
                fillStyle: this.fillStyle,
                strokeStyle: this.strokeStyle,
                lineWidth: this.lineWidth,
                font: this.font,
                textAlign: this.textAlign,
                textBaseline: this.textBaseline
            });
        },
        restore() {
            Object.assign(this, stateStack.pop());
        },
        beginPath() {
            currentRect = null;
        },
        roundRect(x, y, w, h, radius) {
            currentRect = { x, y, w, h, radius };
        },
        fill() {
            if (currentRect) currentRect.fillStyle = this.fillStyle;
        },
        stroke() {
            if (!currentRect) return;
            rectangles.push({
                ...currentRect,
                strokeStyle: this.strokeStyle,
                lineWidth: this.lineWidth
            });
        },
        fillText(value, x, y) {
            text.push({ value, x, y, fillStyle: this.fillStyle });
        },
        measureText() {
            if (this.textBaseline !== "alphabetic") {
                return {
                    actualBoundingBoxAscent: 6,
                    actualBoundingBoxDescent: 6
                };
            }
            return {
                actualBoundingBoxAscent: 10,
                actualBoundingBoxDescent: 2
            };
        }
    };
}

function createController(hoverElement = null) {
    const controller = {
        node: {
            size: [330, 400],
            properties: { rescaleValue: 1.43 }
        },
        controls: {},
        hoverElement,
        widthWidget: { value: 1216 },
        heightWidget: { value: 832 },
        batchSizeWidget: { value: 1 },
        latentTypeWidget: { value: "latent_4x8" }
    };
    Object.assign(controller, drawingMethods);
    return controller;
}

test("editable outputs have persistent pills while rescale factor remains plain text", () => {
    const originalLiteGraph = globalThis.LiteGraph;
    globalThis.LiteGraph = { NODE_SLOT_HEIGHT: 20 };

    try {
        const controller = createController();
        const ctx = createCanvasContext();
        controller.drawOutputValues(ctx);

        assert.equal(ctx.rectangles.length, 4);
        assert.ok(ctx.rectangles.every(rect => rect.fillStyle === "rgba(0,0,0,0)"));
        assert.ok(ctx.rectangles.every(rect => rect.strokeStyle === "rgba(205, 210, 220, 0.18)"));
        assert.deepEqual(Object.keys(controller.controls), [
            "widthValueArea",
            "heightValueArea",
            "batchSizeValueArea",
            "latValueArea"
        ]);
        assert.equal(controller.controls.rescaleValueArea, undefined);
        assert.ok(ctx.text.some(entry => entry.value === "1.43"));

        for (const rect of ctx.rectangles) {
            assert.equal(rect.x + rect.w, 327);
            assert.equal(rect.w, 60);
        }
        assert.equal(ctx.rectangles[0].h, 16);
        assert.equal(ctx.rectangles[1].y - (ctx.rectangles[0].y + ctx.rectangles[0].h), 4);
        for (const control of Object.values(controller.controls)) {
            assert.equal(control.x + control.w, 318);
        }
        for (const entry of ctx.text) {
            assert.equal(entry.x, 297);
        }
        const widthText = ctx.text.find(entry => entry.value === "1216");
        const widthRect = ctx.rectangles[0];
        const glyphTop = widthText.y - 10;
        const glyphBottom = widthText.y + 2;
        assert.equal(glyphTop - widthRect.y, widthRect.y + widthRect.h - glyphBottom);
    } finally {
        globalThis.LiteGraph = originalLiteGraph;
    }
});

test("hover strengthens the editable output pill", () => {
    const originalLiteGraph = globalThis.LiteGraph;
    globalThis.LiteGraph = { NODE_SLOT_HEIGHT: 20 };

    try {
        const controller = createController("widthValueArea");
        const ctx = createCanvasContext();
        controller.drawOutputValues(ctx);

        assert.equal(ctx.rectangles[0].fillStyle, "rgba(0,0,0,0)");
        assert.equal(ctx.rectangles[0].strokeStyle, "rgba(136, 153, 255, 0.9)");
        assert.equal(ctx.rectangles[0].lineWidth, 1.4);
    } finally {
        globalThis.LiteGraph = originalLiteGraph;
    }
});

test("Nodes 2.0 output pills follow the measured DOM slot centers", () => {
    const originalLiteGraph = globalThis.LiteGraph;
    globalThis.LiteGraph = { NODE_SLOT_HEIGHT: 20, vueNodesMode: true };

    try {
        const controller = createController();
        controller.isVueNodesMode = () => true;
        controller._vueCompatOutputSlotCenters = [8, 31, 54, 77, 100];
        const ctx = createCanvasContext();
        controller.drawOutputValues(ctx);

        assert.equal(ctx.rectangles[0].y, 1);
        assert.equal(ctx.rectangles[0].h, 14);
        assert.equal(ctx.rectangles[0].y + ctx.rectangles[0].h / 2, 8);
        assert.equal(ctx.rectangles[1].y + ctx.rectangles[1].h / 2, 31);
        assert.equal(ctx.rectangles[2].y + ctx.rectangles[2].h / 2, 77);
        assert.equal(ctx.text.find(entry => entry.value === "LAT")?.y, 100);
    } finally {
        globalThis.LiteGraph = originalLiteGraph;
    }
});

test("custom snap step uses the persistent editable value background", () => {
    const controller = createController();
    controller.node.properties = {
        snapValue: 176,
        action_slider_snap_min: 1,
        action_slider_snap_max: 256,
        action_slider_snap_step: 1
    };
    controller.node.size = [330, 400];
    controller.icons = { swap: {}, snap: {} };
    controller.drawButton = () => {};
    controller.drawSlider = () => {};
    const ctx = createCanvasContext();

    controller.drawPrimaryControls(ctx, 0);

    assert.equal(ctx.rectangles.length, 1);
    assert.equal(ctx.rectangles[0].fillStyle, "rgba(0,0,0,0)");
    assert.equal(ctx.rectangles[0].strokeStyle, "rgba(205, 210, 220, 0.18)");
    assert.equal(ctx.text.find(entry => entry.value === "176")?.x, 297.5);
});

test("scaling numeric values use the persistent editable value background", () => {
    const controller = createController();
    controller.node.properties = { upscaleValue: 1.25, rescaleMode: "manual" };
    controller.getScalingRowLayout = () => ({
        btnWidth: 70,
        sliderWidth: 90,
        dropdownWidth: 90,
        valueWidth: 45,
        previewWidth: 0,
        radioWidth: 18,
        gap: 5
    });
    controller.drawButton = () => {};
    controller.drawSlider = () => {};
    controller.drawRadioButton = () => {};
    controller.validateWidgets = () => false;
    const ctx = createCanvasContext();

    controller.drawScalingRowBase(ctx, 10, 20, {
        buttonControl: "scaleBtn",
        mainControl: "scaleSlider",
        controlType: "slider",
        valueProperty: "upscaleValue",
        min: 0.1,
        max: 4,
        step: 0.05,
        displayValue: "1.25",
        rescaleMode: "manual"
    });

    assert.equal(controller.controls.scaleValueArea.w, 45);
    assert.equal(ctx.rectangles[0].fillStyle, "rgba(0,0,0,0)");
    assert.equal(ctx.rectangles[0].strokeStyle, "rgba(205, 210, 220, 0.18)");
});
