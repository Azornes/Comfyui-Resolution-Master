import assert from "node:assert/strict";
import test from "node:test";

import { autoDetectMethods } from "../../js/auto_detect/auto_detect_methods.js";


function createController(sourceNode = null) {
    const schedules = [];
    const requests = [];
    const appliedResults = [];
    const dimensionsSetLocally = [];
    let canvasUpdates = 0;

    const node = {
        id: 7,
        inputs: [{ link: sourceNode ? 1 : null }],
        properties: {
            autoDetect: true,
            autoDetectSource: "backend",
            autoDetectWidth: 0,
            autoDetectHeight: 0
        }
    };
    const controller = {
        node,
        app: {
            graph: {
                links: sourceNode ? { 1: { origin_id: 9 } } : {},
                getNodeById: id => id === 9 ? sourceNode : null
            }
        },
        detectedDimensions: null,
        lastBackendDimensionsTimestamp: null,
        lastLivePreviewChangeAtMs: null,
        awaitingLivePreviewUntilMs: null,
        autoDetectStartedAtMs: 1_000,
        watchedLivePreviewWidgets: new Set(),
        widthWidget: { value: 512 },
        heightWidget: { value: 512 },
        autoDetectSourceWidget: { value: "backend" },
        autoDetectWidthWidget: { value: 0 },
        autoDetectHeightWidget: { value: 0 }
    };
    Object.assign(controller, autoDetectMethods);

    controller.refreshLivePreviewWatcher = () => {};
    controller.scheduleAutoDetectCheck = (reason, delay) => schedules.push({ reason, delay });
    controller.getBackendDetectedDimensions = async () => null;
    controller.requestBackendCalculation = async (action, payload) => {
        requests.push({ action, payload });
        return { ok: true, width: payload.width, height: payload.height, rescale_factor: 1 };
    };
    controller.applyBackendCalculationResult = result => appliedResults.push(result);
    controller.setDimensions = (width, height) => dimensionsSetLocally.push({ width, height });
    controller.requestCanvasUpdate = () => {
        canvasUpdates += 1;
    };

    return {
        controller,
        schedules,
        requests,
        appliedResults,
        dimensionsSetLocally,
        get canvasUpdates() {
            return canvasUpdates;
        }
    };
}


test("fresh backend dimensions correct a different frontend preview", async () => {
    const sourceNode = {
        id: 9,
        imgs: [{ naturalWidth: 640, naturalHeight: 480, src: "preview-a.png" }],
        widgets: []
    };
    const state = createController(sourceNode);
    state.controller.getBackendDetectedDimensions = async () => ({
        width: 800,
        height: 600,
        source: "backend",
        timestamp: 2,
        signature: "backend:7:2:800x600"
    });

    await state.controller.checkForImageDimensions();

    assert.deepEqual(state.requests, [{
        action: "auto_detect",
        payload: { width: 800, height: 600 }
    }]);
    assert.equal(state.controller.node.properties.autoDetectSource, "backend");
    assert.equal(state.controller.node.properties.autoDetectWidth, 800);
    assert.equal(state.controller.node.properties.autoDetectHeight, 600);
    assert.equal(state.appliedResults.length, 1);
});


test("stale backend cache is ignored after a frontend source change", async () => {
    const sourceNode = { id: 9, imgs: [], widgets: [] };
    const state = createController(sourceNode);
    state.controller.lastLivePreviewChangeAtMs = 5_000;
    state.controller.getBackendDetectedDimensions = async () => ({
        width: 320,
        height: 240,
        source: "backend",
        timestamp: 4,
        signature: "backend:7:4:320x240"
    });

    await state.controller.checkForImageDimensions();

    assert.equal(state.requests.length, 0);
    assert.equal(state.controller.detectedDimensions, null);
    assert.deepEqual(state.schedules, [{
        reason: "stale backend cache ignored",
        delay: 1_000
    }]);
});


test("overlapping dimension checks are serialized and schedule one follow-up", async () => {
    const sourceNode = { id: 9, imgs: [], widgets: [] };
    const state = createController(sourceNode);
    let resolveBackend;
    let backendCalls = 0;
    state.controller.getBackendDetectedDimensions = () => {
        backendCalls += 1;
        return new Promise(resolve => {
            resolveBackend = resolve;
        });
    };

    const firstCheck = state.controller.checkForImageDimensions();
    await Promise.resolve();
    await state.controller.checkForImageDimensions();

    assert.equal(backendCalls, 1);
    assert.equal(state.controller._pendingDimensionCheck, true);

    resolveBackend(null);
    await firstCheck;

    assert.equal(state.controller._isCheckingDimensions, false);
    assert.equal(state.controller._pendingDimensionCheck, false);
    assert.deepEqual(state.schedules, [{ reason: "pending dimensions check", delay: 0 }]);
});


test("empty Local Image Gallery selection suppresses backend fallback", async () => {
    const sourceNode = {
        id: 9,
        type: "LocalImageGallery",
        properties: { selected_image: "none" },
        widgets: []
    };
    const state = createController(sourceNode);
    let backendCalls = 0;
    state.controller.getBackendDetectedDimensions = async () => {
        backendCalls += 1;
        return null;
    };

    await state.controller.checkForImageDimensions();

    assert.equal(backendCalls, 0);
    assert.equal(state.controller.node.properties.autoDetectSource, "frontend-empty");
    assert.equal(state.controller.node.properties.autoDetectWidth, 0);
    assert.equal(state.controller.node.properties.autoDetectHeight, 0);
    assert.equal(state.requests.length, 0);
});


test("saved detected dimensions are restored without recalculating the workflow", async () => {
    const sourceNode = {
        id: 9,
        imgs: [{ naturalWidth: 640, naturalHeight: 480, src: "saved-preview.png" }],
        widgets: []
    };
    const state = createController(sourceNode);
    state.controller.node.properties.autoDetectWidth = 640;
    state.controller.node.properties.autoDetectHeight = 480;

    await state.controller.checkForImageDimensions();

    assert.equal(state.requests.length, 0);
    assert.equal(state.controller.detectedDimensions.width, 640);
    assert.equal(state.controller.detectedDimensions.height, 480);
    assert.equal(state.controller.node.properties.autoDetectSource, "frontend");
    assert.equal(state.canvasUpdates, 1);
});


test("loading a workflow preserves saved output even when technical detected dimensions are stale", async () => {
    const sourceNode = {
        id: 9,
        imgs: [{ naturalWidth: 640, naturalHeight: 480, src: "workflow-preview.png" }],
        widgets: []
    };
    const state = createController(sourceNode);
    state.controller.node.properties.autoDetectWidth = 320;
    state.controller.node.properties.autoDetectHeight = 240;
    state.controller.widthWidget.value = 1024;
    state.controller.heightWidget.value = 768;
    state.controller.prepareAutoDetectWorkflowRestore();

    await state.controller.checkForImageDimensions();

    assert.equal(state.requests.length, 0);
    assert.equal(state.controller.widthWidget.value, 1024);
    assert.equal(state.controller.heightWidget.value, 768);
    assert.equal(state.controller.node.properties.autoDetectWidth, 640);
    assert.equal(state.controller.node.properties.autoDetectHeight, 480);
    assert.equal(state.controller.autoDetectWorkflowRestorePending, false);
    assert.deepEqual(state.controller.restoredAutoDetectDimensions, {
        width: 640,
        height: 480
    });
});


test("restored output settings survive same-size signature and source changes", async () => {
    const preview = {
        naturalWidth: 640,
        naturalHeight: 480,
        src: "saved-preview.png"
    };
    const sourceNode = {
        id: 9,
        imgs: [preview],
        widgets: []
    };
    const state = createController(sourceNode);
    state.controller.node.properties.autoDetectWidth = 640;
    state.controller.node.properties.autoDetectHeight = 480;

    await state.controller.checkForImageDimensions();
    preview.src = "reloaded-preview.png";
    await state.controller.checkForImageDimensions();

    assert.equal(state.requests.length, 0);
    assert.equal(state.controller.detectedDimensions.width, 640);
    assert.equal(state.controller.detectedDimensions.height, 480);
    assert.match(state.controller.detectedDimensions.signature, /reloaded-preview\.png/);

    sourceNode.imgs = [];
    state.controller.getBackendDetectedDimensions = async () => ({
        width: 640,
        height: 480,
        source: "backend",
        timestamp: 2,
        signature: "backend:7:2:640x480"
    });
    await state.controller.checkForImageDimensions();

    assert.equal(state.requests.length, 0);
    assert.equal(state.controller.node.properties.autoDetectSource, "backend");

    state.controller.getBackendDetectedDimensions = async () => ({
        width: 800,
        height: 600,
        source: "backend",
        timestamp: 3,
        signature: "backend:7:3:800x600"
    });
    await state.controller.checkForImageDimensions();

    assert.deepEqual(state.requests, [{
        action: "auto_detect",
        payload: { width: 800, height: 600 }
    }]);
    assert.equal(state.controller.restoredAutoDetectDimensions, null);
});


test("async source widget callbacks notify watchers and are restored on teardown", async () => {
    const state = createController();
    const originalCallback = async value => `loaded:${value}`;
    const widget = { name: "image", value: "a.png", callback: originalCallback };

    state.controller.attachLivePreviewWidgetWatchers({ widgets: [widget] });
    const result = await widget.callback("b.png");

    assert.equal(result, "loaded:b.png");
    assert.equal(state.schedules[0].reason, "source widget changed");
    assert.notEqual(widget.callback, originalCallback);

    state.controller.detachLivePreviewWidgetWatchers();

    assert.equal(widget.callback, originalCallback);
    assert.equal(state.controller.watchedLivePreviewWidgets.size, 0);
});
