import assert from "node:assert/strict";
import test from "node:test";

import { nodeLifecycleMethods } from "../../js/node/resolution_master_node_lifecycle.js";


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
        ...nodeOverrides
    };
    const controller = {
        node,
        collapsedSections: { extraControls: false }
    };
    Object.assign(controller, nodeLifecycleMethods);
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
