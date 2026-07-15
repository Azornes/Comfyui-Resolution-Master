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
