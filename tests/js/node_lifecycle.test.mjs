import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../js/utils/icon_utils.js", {
    namedExports: { inlineSvgIcons: {} }
});

import { nodeLifecycleMethods } from "../../js/node/resolution_master_node_lifecycle.js";
const { interactionMethods } = await import("../../js/interaction/resolution_master_interaction_methods.js");


function withLiteGraph(value, callback) {
    const previous = globalThis.LiteGraph;
    globalThis.LiteGraph = value;
    try {
        return callback();
    } finally {
        if (previous === undefined) {
            delete globalThis.LiteGraph;
        } else {
            globalThis.LiteGraph = previous;
        }
    }
}


function createLifecycleController(nodeOverrides = {}) {
    const node = {
        id: 5,
        properties: {},
        size: [300, 100],
        min_size: [330, 200],
        pos: [100, 200],
        intpos: { x: 0.5, y: 0.5 },
        widgets: [],
        outputs: [],
        flags: {},
        inputs: [],
        setSize(size) {
            this.size = [...size];
        },
        ...nodeOverrides
    };
    const controller = {
        node,
        collapsedSections: { extraControls: false },
        requestCanvasUpdate() {},
        syncBackendFallbackWidgets() {},
        installCanvasDragZoomBypass() {}
    };
    Object.assign(controller, nodeLifecycleMethods, interactionMethods);
    controller.calculateNeededHeight = () => 240;
    return controller;
}


test("initialization preserves saved properties and adds canonical package metadata", () => {
    const controller = createLifecycleController({ properties: { valueX: 900 } });

    controller.initializeProperties();

    assert.equal(controller.node.properties.valueX, 900);
    assert.equal(controller.node.properties.valueY, 512);
    assert.equal(controller.node.properties.aux_id, "Azornes/Comfyui-Resolution-Master");
});


test("canonical metadata does not overwrite registry-managed cnr metadata", () => {
    const controller = createLifecycleController({ properties: { cnr_id: "registry-node" } });
    const serialized = { properties: { cnr_id: "serialized-registry-node" } };

    controller.ensureCanonicalPackageMetadata(serialized);

    assert.equal(controller.node.properties.aux_id, undefined);
    assert.equal(serialized.properties.aux_id, undefined);
});


test("Vue auto-sizing enforces minimum width and restores its internal guard", () => {
    const sizes = [];
    const controller = createLifecycleController({
        setSize(size) {
            sizes.push([...size]);
            this.size = [...size];
        }
    });

    withLiteGraph({ vueNodesMode: true }, () => controller.applyVueCompatAutoSize(260));

    assert.deepEqual(sizes, [[330, 260]]);
    assert.deepEqual(controller.node.size, [330, 260]);
    assert.equal(controller._isApplyingAutoSize, false);
});


test("Vue auto-sizing restores minimum width after height was already synchronized", () => {
    const sizes = [];
    const controller = createLifecycleController({
        size: [200, 260],
        setSize(size) {
            sizes.push([...size]);
            this.size = [...size];
        }
    });
    controller._vueCompatAutoSizedContentHeight = 260;

    withLiteGraph({ vueNodesMode: true }, () => controller.applyVueCompatAutoSize(260));

    assert.deepEqual(sizes, [[330, 260]]);
    assert.deepEqual(controller.node.size, [330, 260]);
});


test("classic LiteGraph mode does not apply Vue-specific auto-sizing", () => {
    const controller = createLifecycleController();

    withLiteGraph({ vueNodesMode: false }, () => controller.applyVueCompatAutoSize(260));

    assert.deepEqual(controller.node.size, [300, 100]);
});


test("temporary Vue widget dimensions are restored even when drawing throws", () => {
    const controller = createLifecycleController();
    controller.node.size = [400, 500];
    controller._vueCompatWidgetWidth = 350;
    controller._vueCompatWidgetHeight = 275;

    withLiteGraph({ vueNodesMode: true }, () => {
        assert.throws(
            () => controller.withVueCompatWidgetSize(() => {
                assert.deepEqual(controller.node.size, [350, 275]);
                throw new Error("draw failed");
            }),
            /draw failed/
        );
    });

    assert.deepEqual(controller.node.size, [400, 500]);
});


test("Vue compatibility widget advertises deterministic layout and is not serialized", () => {
    let installedWidget;
    const controller = createLifecycleController({
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });

    controller.installVueNodesCompatibilityWidget();

    assert.equal(installedWidget.name, "resolution_master_ui");
    assert.equal(installedWidget.serialize, false);
    assert.deepEqual(
        withLiteGraph({ vueNodesMode: false }, () => installedWidget.computeLayoutSize()),
        { minWidth: 0, minHeight: 0, maxHeight: 0 }
    );
    assert.deepEqual(
        withLiteGraph({ vueNodesMode: true }, () => installedWidget.computeLayoutSize()),
        { minWidth: 330, minHeight: 240, maxHeight: 240 }
    );
});


test("Vue Parameters panel draws as an isolated secondary surface", () => {
    let installedWidget;
    let primaryBindCalls = 0;
    let primaryLayoutCalls = 0;
    let secondaryDrawCalls = 0;
    const controller = createLifecycleController({
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });
    const primaryControls = { primary: { x: 1, y: 1, w: 1, h: 1 } };
    const primaryKnobs = { primarySlider: { x: 1, y: 1, w: 1, h: 1 } };
    controller.controls = primaryControls;
    controller.sliderKnobAreas = primaryKnobs;
    controller._vueCompatWidgetWidth = 330;
    controller._vueCompatWidgetHeight = 240;
    controller.bindVueCompatCanvasEvents = () => primaryBindCalls++;
    controller.updateVueCompatCanvasLayout = () => primaryLayoutCalls++;
    controller.drawInterface = () => {
        secondaryDrawCalls++;
        assert.deepEqual(controller.node.size, [500, 240]);
        controller.controls = { secondary: { x: 2, y: 2, w: 2, h: 2 } };
        controller.sliderKnobAreas = { secondarySlider: { x: 2, y: 2, w: 2, h: 2 } };
    };
    controller.installVueNodesCompatibilityWidget();

    const canvasListeners = new Map();
    const secondaryCanvas = {
        isConnected: true,
        closest() {
            return null;
        },
        addEventListener(type, handler, capture) {
            canvasListeners.set(type, { handler, capture });
        },
        removeEventListener() {
        }
    };
    const ctx = {
        canvas: secondaryCanvas,
        save() {},
        restore() {},
        translate() {}
    };

    withLiteGraph({ vueNodesMode: true }, () => {
        installedWidget.draw(ctx, controller.node, 500, 10, 600);
    });

    assert.equal(primaryBindCalls, 0);
    assert.equal(primaryLayoutCalls, 0);
    assert.equal(controller._vueCompatWidgetWidth, 330);
    assert.equal(controller._vueCompatWidgetHeight, 240);
    assert.equal(controller.controls, primaryControls);
    assert.equal(controller.sliderKnobAreas, primaryKnobs);
    const secondarySurface = controller._vueCompatSecondarySurfaces.get(secondaryCanvas);
    assert.deepEqual(secondarySurface.controls, { secondary: { x: 2, y: 2, w: 2, h: 2 } });
    assert.deepEqual(secondarySurface.sliderKnobAreas, { secondarySlider: { x: 2, y: 2, w: 2, h: 2 } });
    assert.equal(secondarySurface.width, 500);
    assert.equal(secondarySurface.height, 240);
    assert.equal(typeof secondarySurface.redraw, "function");

    withLiteGraph({ vueNodesMode: true }, () => secondarySurface.redraw());
    assert.equal(secondaryDrawCalls, 2);

    let hoverCalls = 0;
    controller.handleMouseHover = () => {
        hoverCalls++;
        assert.deepEqual(controller.controls, { secondary: { x: 2, y: 2, w: 2, h: 2 } });
    };
    withLiteGraph({ vueNodesMode: true }, () => {
        canvasListeners.get("pointermove").handler({ offsetX: 2, offsetY: 2 });
    });
    assert.equal(hoverCalls, 1);
    assert.equal(controller.controls, primaryControls);
    assert.equal(controller.sliderKnobAreas, primaryKnobs);

    controller.node.onMouseDown = () => {
        assert.deepEqual(controller.controls, { secondary: { x: 2, y: 2, w: 2, h: 2 } });
        return true;
    };
    controller.requestVueCompatWidgetDraw = () => {};
    canvasListeners.get("pointerdown").handler();
    const handled = withLiteGraph({ vueNodesMode: true }, () => installedWidget.mouse({
        type: "pointerdown",
        offsetX: 2,
        offsetY: 2,
        buttons: 1,
        currentTarget: null,
        target: null
    }, [2, 2], controller.node));

    assert.equal(handled, true);
    assert.equal(controller.controls, primaryControls);
    assert.equal(controller.sliderKnobAreas, primaryKnobs);
    assert.equal(controller._vueCompatForwardingNodePointer, false);

    controller.node.onMouseDown = () => false;
    const unhandled = withLiteGraph({ vueNodesMode: true }, () => installedWidget.mouse({
        type: "pointerdown",
        offsetX: 2,
        offsetY: 2,
        buttons: 1,
        currentTarget: null,
        target: null
    }, [2, 2], controller.node));

    assert.equal(unhandled, false);
    assert.equal(controller._vueCompatForwardingNodePointer, false);

    secondaryCanvas.isConnected = false;
    assert.equal(controller.resolveVueCompatEventCanvas({}), null);
    assert.equal(controller._vueCompatActiveEventCanvas, null);
});


test("Vue widget updates explicitly redraw the primary node surface", () => {
    let installedWidget;
    let drawCalls = 0;
    let scheduledDraw = null;
    const controller = createLifecycleController({
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });
    controller.bindVueCompatCanvasEvents = () => {};
    controller.updateVueCompatCanvasLayout = () => {};
    controller.drawInterface = () => drawCalls++;
    controller.installVueNodesCompatibilityWidget();

    const primaryCanvas = {
        isConnected: true,
        closest(selector) {
            return selector === ".lg-node" ? { dataset: { nodeId: "5" } } : null;
        }
    };
    const ctx = {
        canvas: primaryCanvas,
        save() {},
        restore() {},
        translate() {}
    };

    withLiteGraph({ vueNodesMode: true }, () => {
        installedWidget.draw(ctx, controller.node, 330, 10, 240);
    });
    assert.equal(drawCalls, 1);
    assert.equal(controller._vueCompatPrimarySurface.canvasElement, primaryCanvas);

    const previousAnimationFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = callback => {
        scheduledDraw = callback;
        return 1;
    };
    try {
        withLiteGraph({ vueNodesMode: true }, () => {
            controller.requestVueCompatWidgetDraw();
            assert.equal(typeof scheduledDraw, "function");
            scheduledDraw();
        });
    } finally {
        if (previousAnimationFrame === undefined) {
            delete globalThis.requestAnimationFrame;
        } else {
            globalThis.requestAnimationFrame = previousAnimationFrame;
        }
    }

    assert.equal(drawCalls, 2);
});


test("Vue pointer normalization converts widget-local coordinates to node coordinates", () => {
    const controller = createLifecycleController();
    const event = { offsetX: 15, offsetY: 25 };

    withLiteGraph({ vueNodesMode: true }, () => controller.normalizeVueCompatPointerEvent(event));

    assert.equal(event.canvasX, 115);
    assert.equal(event.canvasY, 225);
});


test("Vue output slot centers are measured relative to the widget canvas", () => {
    const controller = createLifecycleController({ outputs: Array.from({ length: 5 }, () => ({})) });
    const canvasElement = {
        clientWidth: 330,
        clientHeight: 200,
        getBoundingClientRect() {
            return { left: 100, top: 200, width: 660, height: 400 };
        }
    };
    const createDot = (left, top) => ({
        getBoundingClientRect() {
            return { left, top, width: 10, height: 10 };
        }
    });
    const slotDots = [
        createDot(90, 220),
        createDot(740, 220),
        createDot(740, 264),
        createDot(740, 308),
        createDot(740, 352),
        createDot(740, 396)
    ];

    controller.updateVueCompatOutputSlotCenters(canvasElement, slotDots, 110);

    assert.deepEqual(controller._vueCompatOutputSlotCenters, [12.5, 34.5, 56.5, 78.5, 100.5]);
});


test("Vue canvas layout enforces and restores the legacy node minimum width", () => {
    const controller = createLifecycleController();
    const nodeElement = { style: { minWidth: "120px" } };
    const slotsElement = {
        style: {},
        offsetHeight: 0,
        querySelectorAll() {
            return [];
        }
    };
    const bodyElement = { style: {} };
    const widgetsGrid = {
        style: {},
        previousElementSibling: slotsElement,
        parentElement: bodyElement,
        closest() {
            return nodeElement;
        }
    };
    const canvasElement = {
        clientWidth: 330,
        clientHeight: 200,
        parentElement: { style: {} },
        closest() {
            return widgetsGrid;
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 330, height: 200 };
        }
    };
    controller.ensureVueCompatHeaderControls = () => {};

    controller.updateVueCompatCanvasLayout(canvasElement);
    assert.equal(nodeElement.style.minWidth, "330px");

    controller.teardownVueCompatCanvasLayout();
    assert.equal(nodeElement.style.minWidth, "120px");
});


test("Vue tooltip is rendered in the document overlay and constrained to the viewport", () => {
    const previousDocument = globalThis.document;
    const tooltip = {
        dataset: {},
        style: {},
        textContent: "",
        removed: false,
        getBoundingClientRect() {
            return { width: 120, height: 40 };
        },
        remove() {
            this.removed = true;
        }
    };
    globalThis.document = {
        documentElement: { clientWidth: 300, clientHeight: 200 },
        createElement() {
            return tooltip;
        },
        body: {
            appendChild() {}
        }
    };

    try {
        const controller = createLifecycleController();
        controller.tooltips = { widthValueArea: "Click to enter width manually." };

        controller.showVueCompatTooltip("widthValueArea", { clientX: 280, clientY: 20 });

        assert.equal(tooltip.textContent, "Click to enter width manually.");
        assert.equal(tooltip.style.left, "145px");
        assert.equal(tooltip.style.top, "40px");
        assert.equal(tooltip.style.visibility, "visible");

        controller.positionVueCompatTooltip({ clientX: 20, clientY: 150 });
        assert.equal(tooltip.style.left, "35px");
        assert.equal(tooltip.style.top, "100px");

        controller.hideVueCompatTooltip();
        assert.equal(tooltip.style.display, "none");

        controller.teardownVueCompatTooltip();
        assert.equal(tooltip.removed, true);
        assert.equal(controller._vueCompatTooltip, null);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
});


test("LiteGraph lifecycle hooks synchronize serialization and clean up on removal", () => {
    const events = [];
    const widthWidget = { name: "width", value: 640 };
    const heightWidget = { name: "height", value: 480 };
    const node = {
        properties: {},
        widgets: [widthWidget, heightWidget],
        outputs: [{ hidden: true, name: "width", localized_name: "Width" }],
        flags: {},
        inputs: [],
        pos: [0, 0],
        intpos: { x: 0.5, y: 0.5 },
        onSerialize(serialized) {
            events.push("original-serialize");
            serialized.originalCalled = true;
        },
        onConfigure() {
            events.push("original-configure");
        },
        onRemoved() {
            events.push("original-remove");
        }
    };
    const controller = createLifecycleController(node);
    controller.controls = {};
    controller.installCanvasDragZoomBypass = () => {};
    controller.applyCompactSlotLabels = () => {};
    controller.installVueNodesCompatibilityWidget = () => {};
    controller.prepareAutoDetectWorkflowRestore = () => events.push("prepare-restore");
    controller.syncAutoDetectSourceState = () => events.push("sync-source");
    controller.syncBackendFallbackWidgets = () => events.push("sync-widgets");
    controller.stopAutoDetect = () => events.push("stop-auto-detect");
    controller.teardownVueCompatCanvasEvents = () => events.push("teardown-vue");
    controller.requestVueCompatWidgetDraw = () => {};
    controller.requestCanvasUpdate = () => {};
    controller.customValueDialogManager = { customInputDialog: null };
    controller.initializeProperties();

    controller.setupNode();
    controller.node.onConfigure({});
    const serialized = {};
    controller.node.onSerialize(serialized);
    controller.node.onRemoved();

    assert.equal(widthWidget.hidden, true);
    assert.equal(heightWidget.hidden, true);
    assert.equal(serialized.originalCalled, true);
    assert.equal(serialized.properties.aux_id, "Azornes/Comfyui-Resolution-Master");
    const configureEventIndex = events.indexOf("original-configure");
    assert.notEqual(configureEventIndex, -1);
    assert.equal(events[configureEventIndex + 1], "prepare-restore");
    assert.deepEqual(events.slice(-6), [
        "sync-source",
        "sync-widgets",
        "original-serialize",
        "stop-auto-detect",
        "teardown-vue",
        "original-remove"
    ]);
});


test("Nodes 2.0 zoom scaling prevents node inflation, locks CSS dimensions, and normalizes coordinates", () => {
    let installedWidget;
    const drawnSizes = [];
    const transforms = [];
    const controller = createLifecycleController({
        pos: [50, 80],
        size: [330, 560],
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });
    controller.calculateNeededHeight = () => 560;
    controller.bindVueCompatCanvasEvents = () => {};
    controller.updateVueCompatCanvasLayout = () => {};
    controller.drawInterface = () => {
        drawnSizes.push([...controller.node.size]);
    };
    controller.installVueNodesCompatibilityWidget();

    const canvasHost = {
        clientWidth: 330,
        clientHeight: 560,
        style: {}
    };
    const primaryCanvas = {
        parentElement: canvasHost,
        clientWidth: 330,
        clientHeight: 560,
        width: 6600,
        height: 1124,
        style: {},
        closest(selector) {
            return selector === ".lg-node" ? { dataset: { nodeId: "5" } } : null;
        },
        getBoundingClientRect() {
            return { left: 100, top: 100, width: 3300, height: 5600 };
        }
    };
    const ctx = {
        canvas: primaryCanvas,
        save() {},
        restore() {},
        translate() {},
        setTransform(...args) {
            transforms.push(args);
        }
    };

    withLiteGraph({ vueNodesMode: true }, () => {
        // Simulates WidgetLegacy at 10x zoom passing screen width 3300.
        installedWidget.draw(ctx, controller.node, 3300, 1, 560);
    });

    // 1. Assert node size was not inflated during drawInterface or after.
    assert.deepEqual(drawnSizes, [[330, 560]]);
    assert.deepEqual(controller.node.size, [330, 560]);
    assert.equal(controller._vueCompatWidgetWidth, 330);
    assert.equal(installedWidget.width, 330);

    // 2. Assert canvas element and host styles lock graph dimensions and span node full width.
    assert.equal(primaryCanvas.style.width, "100%");
    assert.equal(primaryCanvas.style.height, "560px");
    assert.equal(canvasHost.style.width, "calc(100% + 24px)");
    assert.equal(canvasHost.style.minHeight, "560px");
    assert.equal(canvasHost.style.height, "560px");

    // 3. Assert buffer was resized to crisp, capped backing scale (3x) rather than screen pixels.
    assert.equal(primaryCanvas.width, 990);
    assert.equal(primaryCanvas.height, 1686);
    assert.deepEqual(transforms.at(-1), [3, 0, 0, 3, 0, 0]);

    // 4. Assert pointer coordinates at 10x zoom normalize accurately to graph space.
    controller._vueCompatCanvasElement = primaryCanvas;
    const pointerEvent = {
        clientX: 1100,
        clientY: 2900,
        offsetX: 1000,
        offsetY: 2800
    };
    withLiteGraph({ vueNodesMode: true }, () => controller.normalizeVueCompatPointerEvent(pointerEvent));
    // localX = (1100 - 100) * (330 / 3300) = 100
    // localY = (2900 - 100) * (560 / 5600) = 280
    // canvasX = 50 + 100 = 150
    // canvasY = 80 + 280 = 360
    assert.equal(pointerEvent.canvasX, 150);
    assert.equal(pointerEvent.canvasY, 360);
});


test("Nodes 2.0 zoom out maintains minimum graph dimensions and context scale", () => {
    let installedWidget;
    const drawnSizes = [];
    const transforms = [];
    const controller = createLifecycleController({
        pos: [0, 0],
        size: [330, 560],
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });
    controller.calculateNeededHeight = () => 560;
    controller.bindVueCompatCanvasEvents = () => {};
    controller.updateVueCompatCanvasLayout = () => {};
    controller.drawInterface = () => {
        drawnSizes.push([...controller.node.size]);
    };
    controller.installVueNodesCompatibilityWidget();

    const canvasHost = {
        clientWidth: 330,
        clientHeight: 560,
        style: {}
    };
    const primaryCanvas = {
        parentElement: canvasHost,
        clientWidth: 330,
        clientHeight: 560,
        width: 330,
        height: 562,
        style: {},
        closest(selector) {
            return selector === ".lg-node" ? { dataset: { nodeId: "5" } } : null;
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 165, height: 280 };
        }
    };
    const ctx = {
        canvas: primaryCanvas,
        save() {},
        restore() {},
        translate() {},
        setTransform(...args) {
            transforms.push(args);
        }
    };

    withLiteGraph({ vueNodesMode: true }, () => {
        // Simulates WidgetLegacy at 0.5x zoom passing screen width 165.
        installedWidget.draw(ctx, controller.node, 165, 1, 560);
    });

    assert.deepEqual(drawnSizes, [[330, 560]]);
    assert.deepEqual(controller.node.size, [330, 560]);
    assert.equal(controller._vueCompatWidgetWidth, 330);
    assert.equal(primaryCanvas.style.height, "560px");
    assert.equal(primaryCanvas.width, 330);
    assert.equal(primaryCanvas.height, 562);
    assert.deepEqual(transforms.at(-1), [1, 0, 0, 1, 0, 0]);
});


test("Nodes 2.0 compact mode toggle automatically shrinks node height and allows resizing down", () => {
    let installedWidget;
    const controller = createLifecycleController({
        pos: [0, 0],
        size: [330, 560],
        min_size: [330, 200],
        widgets: [{ name: "width", value: 512 }, { name: "height", value: 512 }],
        addCustomWidget(widget) {
            installedWidget = widget;
            return widget;
        }
    });

    controller.calculateNeededHeight = () => (controller.collapsedSections.extraControls ? 240 : 560);
    controller.bindVueCompatCanvasEvents = () => {};
    controller.updateVueCompatCanvasLayout = () => {};
    controller.drawInterface = () => {};
    controller.setupNode();
    controller.installVueNodesCompatibilityWidget();

    // 1. Initially auto-sized at 560px
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.applyVueCompatAutoSize(560);
    });
    assert.deepEqual(controller.node.size, [330, 560]);

    // 2. Click toggle button to minimize
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader");
    });

    assert.equal(controller.collapsedSections.extraControls, true);
    // Node height immediately shrunk to compact height 240px!
    assert.deepEqual(controller.node.size, [330, 240]);
    assert.equal(installedWidget.computedHeight, 240);
    assert.equal(controller.node.properties.preferred_expanded_height, 560);

    // 3. Draw in compact mode: canvasHost minHeight is locked to minimumHeight (240px), not inflated
    const canvasHost = { clientWidth: 330, clientHeight: 240, style: {} };
    const primaryCanvas = {
        parentElement: canvasHost,
        clientWidth: 330,
        clientHeight: 240,
        width: 330,
        height: 263,
        style: {},
        closest(selector) {
            return selector === ".lg-node" ? { dataset: { nodeId: "5" } } : null;
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 330, height: 240 };
        }
    };
    const ctx = {
        canvas: primaryCanvas,
        save() {},
        restore() {},
        translate() {},
        setTransform() {}
    };

    withLiteGraph({ vueNodesMode: true }, () => {
        installedWidget.draw(ctx, controller.node, 330, 1, 240);
    });

    // drawingHeight = 240px (no inflation offset)
    assert.equal(canvasHost.style.minHeight, "240px");
    assert.equal(canvasHost.style.height, "");
    assert.equal(primaryCanvas.style.height, "100%");

    // 4. User manually resizes taller (to 400px)
    controller.node.size = [330, 400];
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.node.onResize();
        installedWidget.draw(ctx, controller.node, 330, 1, 400);
    });
    assert.equal(installedWidget.computedHeight, 240);
    assert.equal(controller.node.properties.preferred_compact_height, 400);
    assert.equal(canvasHost.style.minHeight, "240px");
    assert.equal(canvasHost.style.height, "");

    // 5. User manually resizes back down (to 270px)
    controller.node.size = [330, 270];
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.node.onResize();
        installedWidget.draw(ctx, controller.node, 330, 1, 270);
    });
    assert.equal(installedWidget.computedHeight, 240);
    assert.equal(controller.node.properties.preferred_compact_height, 270);
    assert.equal(canvasHost.style.minHeight, "240px");
    assert.equal(canvasHost.style.height, "");

    // 6. User attempts to resize smaller than minimum (150px) -> clamped to 240px
    controller.node.size = [330, 150];
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.node.onResize();
    });
    assert.deepEqual(controller.node.size, [330, 240]);
    assert.equal(installedWidget.computedHeight, 240);

    // 7. Click toggle to expand back -> restores stored expanded height (560px)
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader");
    });
    assert.equal(controller.collapsedSections.extraControls, false);
    assert.deepEqual(controller.node.size, [330, 560]);
    assert.equal(installedWidget.computedHeight, 560);

    // 8. Click toggle to minimize again -> restores stored compact height (240px)
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader");
    });
    assert.equal(controller.collapsedSections.extraControls, true);
    assert.deepEqual(controller.node.size, [330, 240]);
    assert.equal(installedWidget.computedHeight, 240);

    // 9. If user resizes to 270px in compact mode, toggling expand and minimize restores 270px
    controller.node.size = [330, 270];
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.node.onResize();
        controller.handleSectionHeaderClick("extraControlsHeader"); // expand
    });
    assert.deepEqual(controller.node.size, [330, 560]);
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader"); // minimize
    });
    assert.deepEqual(controller.node.size, [330, 270]);

    // 10. If stored compact height is corrupted/too large (e.g. >= 560), toggle resets it to minHeight
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader"); // expand
    });
    controller.node.properties.preferred_compact_height = 800;
    withLiteGraph({ vueNodesMode: true }, () => {
        controller.handleSectionHeaderClick("extraControlsHeader"); // collapse
    });
    assert.equal(controller.collapsedSections.extraControls, true);
    assert.deepEqual(controller.node.size, [330, 240]);
    assert.equal(installedWidget.computedHeight, 240);
    assert.equal(controller.node.properties.preferred_compact_height, undefined);
});

