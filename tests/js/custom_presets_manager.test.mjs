import assert from "node:assert/strict";
import test from "node:test";

import { CustomPresetsManager } from "../../js/presets/custom_presets_manager.js";


function createManager(customPresetsJSON = "") {
    const rm = { node: { properties: { customPresetsJSON } } };
    return { rm, manager: new CustomPresetsManager(rm) };
}


test("legacy workflow preset JSON is loaded and migrated on save", () => {
    const legacy = JSON.stringify({
        Portraits: { Tall: { width: 768, height: 1024 } }
    });
    const { rm, manager } = createManager(legacy);

    assert.deepEqual(manager.getCustomPresets(), {
        Portraits: { Tall: { width: 768, height: 1024 } }
    });
    assert.deepEqual(manager.getHiddenBuiltInPresets(), {});

    manager.saveCustomPresets();
    const persisted = JSON.parse(rm.node.properties.customPresetsJSON);
    assert.deepEqual(persisted.customPresets, manager.getCustomPresets());
    assert.deepEqual(persisted.hiddenBuiltInPresets, {});
});


test("export and replace-import preserve custom and hidden presets", () => {
    const first = createManager().manager;
    first.addPreset("Custom", "Wide", 1280, 720);
    first.toggleBuiltInPresetVisibility("Standard", "1:1 Square");
    const exported = first.exportToJSON();

    const secondState = createManager();
    assert.equal(secondState.manager.importFromJSON(exported, false), true);

    assert.deepEqual(secondState.manager.getCustomPresets(), first.getCustomPresets());
    assert.deepEqual(secondState.manager.getHiddenBuiltInPresets(), first.getHiddenBuiltInPresets());
    assert.deepEqual(
        JSON.parse(secondState.rm.node.properties.customPresetsJSON),
        JSON.parse(exported)
    );
});


test("merge import overrides matching presets and deduplicates hidden names", () => {
    const initial = JSON.stringify({
        customPresets: {
            Standard: { Existing: { width: 512, height: 512 } }
        },
        hiddenBuiltInPresets: { Standard: ["Square"] }
    });
    const { manager } = createManager(initial);
    const incoming = JSON.stringify({
        customPresets: {
            Standard: {
                Existing: { width: 1024, height: 1024 },
                New: { width: 768, height: 512 }
            }
        },
        hiddenBuiltInPresets: { Standard: ["Square", "Portrait"] }
    });

    assert.equal(manager.importFromJSON(incoming, true), true);

    assert.deepEqual(manager.getCustomPresets().Standard, {
        Existing: { width: 1024, height: 1024 },
        New: { width: 768, height: 512 }
    });
    assert.deepEqual(manager.getHiddenBuiltInPresets().Standard, ["Square", "Portrait"]);
});


test("invalid import is rejected atomically", () => {
    const { rm, manager } = createManager();
    manager.addPreset("Safe", "Original", 640, 480);
    const before = rm.node.properties.customPresetsJSON;
    const invalid = JSON.stringify({
        customPresets: {
            Safe: {
                Valid: { width: 800, height: 600 },
                Invalid: { width: "wide", height: 600 }
            }
        }
    });

    assert.equal(manager.importFromJSON(invalid, true), false);
    assert.equal(rm.node.properties.customPresetsJSON, before);
    assert.deepEqual(manager.getCustomPresets(), {
        Safe: { Original: { width: 640, height: 480 } }
    });
    assert.equal(manager.importFromJSON("not-json", true), false);
    assert.equal(manager.importFromJSON("null", true), false);
});


test("reorder and move operations preserve object order in persisted JSON", () => {
    const { rm, manager } = createManager();
    manager.addPreset("Source", "First", 512, 512);
    manager.addPreset("Source", "Second", 768, 512);
    manager.addPreset("Source", "Third", 1024, 512);

    assert.equal(manager.reorderPresets("Source", "Third", 0), true);
    assert.deepEqual(Object.keys(manager.getCustomPresets().Source), ["Third", "First", "Second"]);
    assert.equal(manager.movePreset("Source", "First", "Target", 0), true);

    const persisted = JSON.parse(rm.node.properties.customPresetsJSON);
    assert.deepEqual(Object.keys(persisted.customPresets.Source), ["Third", "Second"]);
    assert.deepEqual(persisted.customPresets.Target, {
        First: { width: 512, height: 512 }
    });
});


test("merged presets mark hidden built-ins and let custom presets override them", () => {
    const { manager } = createManager();
    manager.toggleBuiltInPresetVisibility("Standard", "Square");
    manager.addPreset("Standard", "Wide", 1200, 600);
    manager.addPreset("Standard", "Square", 2048, 2048);
    const builtIns = {
        Standard: {
            Square: { width: 512, height: 512 },
            Wide: { width: 1024, height: 512 },
            Portrait: { width: 512, height: 768 }
        }
    };

    const merged = manager.getMergedPresets(builtIns);

    assert.deepEqual(merged.Standard.Square, {
        width: 2048,
        height: 2048,
        isCustom: true,
        isHidden: false,
        originalCategory: "Standard"
    });
    assert.equal(merged.Standard.Wide.isCustom, true);
    assert.equal(merged.Standard.Portrait.isCustom, false);
    assert.equal(merged.Standard.Portrait.isHidden, false);
});


test("hiding the selected built-in clears selection without changing dimensions", () => {
    const { rm, manager } = createManager();
    Object.assign(rm.node.properties, {
        selectedCategory: "Standard",
        selectedPreset: "Square",
        valueX: 1024,
        valueY: 1024
    });
    let syncCount = 0;
    let canvasUpdateCount = 0;
    rm.syncBackendFallbackWidgets = () => { syncCount += 1; };
    rm.requestCanvasUpdate = () => { canvasUpdateCount += 1; };

    assert.equal(manager.toggleBuiltInPresetVisibility("Standard", "Square"), true);

    assert.equal(rm.node.properties.selectedPreset, null);
    assert.equal(rm.node.properties.valueX, 1024);
    assert.equal(rm.node.properties.valueY, 1024);
    assert.equal(syncCount, 1);
    assert.equal(canvasUpdateCount, 1);
});


test("hiding a built-in keeps an active custom override selected", () => {
    const { rm, manager } = createManager();
    manager.addPreset("Standard", "Square", 2048, 2048);
    Object.assign(rm.node.properties, {
        selectedCategory: "Standard",
        selectedPreset: "Square"
    });

    assert.equal(manager.toggleBuiltInPresetVisibility("Standard", "Square"), true);

    assert.equal(rm.node.properties.selectedPreset, "Square");
});
