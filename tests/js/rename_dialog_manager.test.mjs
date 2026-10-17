import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("../../js/utils/icon_utils.js", {
    namedExports: {
        getIconHtml: () => "",
        inlineSvgIcons: {}
    }
});
mock.module("../../js/utils/dialog_helper.js", {
    namedExports: {
        createModalWrapper: () => ({ overlay: {}, dialog: {}, close: () => {} })
    }
});

const { RenameDialogManager } = await import("../../js/presets/preset_manager/rename_dialog_manager.js");

function createMockElement(tag, text = "") {
    const listeners = {};
    const element = {
        tagName: tag.toUpperCase(),
        textContent: text,
        value: text,
        className: "",
        type: "text",
        parentNode: {
            replaceChild: mock.fn()
        },
        focus: mock.fn(),
        select: mock.fn(),
        replaceWith: mock.fn((newElement) => {
            element.replacedWith = newElement;
        }),
        addEventListener: mock.fn((event, handler) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(handler);
        }),
        dispatchEvent: (event, payload = {}) => {
            const handlers = listeners[event] || [];
            handlers.forEach(h => h({ ...payload, preventDefault: () => {} }));
        }
    };
    return element;
}

function setupTestEnvironment() {
    globalThis.document = {
        createElement: (tag) => createMockElement(tag)
    };
    globalThis.alert = mock.fn();
}

test("startRenamingCategory renames category and triggers dialog render on Enter", () => {
    setupTestEnvironment();
    const renamed = [];
    const renders = [];
    const parentDialog = {
        manager: {
            getCustomPresets: () => ({}),
            renameCategory: (oldName, newName) => {
                renamed.push({ oldName, newName });
                return true;
            }
        },
        renderDialog: () => { renders.push("render"); }
    };
    const manager = new RenameDialogManager(parentDialog);
    const titleElement = createMockElement("div", "OldCategory");

    manager.startRenamingCategory(titleElement, "OldCategory");
    const input = titleElement.replacedWith;
    assert.ok(input);
    assert.equal(input.value, "OldCategory");

    input.value = "NewCategory";
    input.dispatchEvent("keydown", { key: "Enter" });

    assert.deepEqual(renamed, [{ oldName: "OldCategory", newName: "NewCategory" }]);
    assert.deepEqual(renders, ["render"]);
});

test("startRenamingCategory restores element on Escape without renaming", () => {
    setupTestEnvironment();
    const renamed = [];
    const parentDialog = {
        manager: {
            getCustomPresets: () => ({}),
            renameCategory: (oldName, newName) => {
                renamed.push({ oldName, newName });
                return true;
            }
        },
        renderDialog: mock.fn()
    };
    const manager = new RenameDialogManager(parentDialog);
    const titleElement = createMockElement("div", "MyCategory");

    manager.startRenamingCategory(titleElement, "MyCategory");
    const input = titleElement.replacedWith;
    input.value = "Changed";
    input.dispatchEvent("keydown", { key: "Escape" });

    assert.equal(renamed.length, 0);
    assert.ok(input.replacedWith);
    assert.equal(input.replacedWith.textContent, "MyCategory");
});

test("startRenamingPreset renames preset and triggers dialog render on Enter", () => {
    setupTestEnvironment();
    const updated = [];
    const renders = [];
    const parentDialog = {
        manager: {
            getCustomPresets: () => ({ Portraits: {} }),
            updatePreset: (category, oldName, newName, width, height) => {
                updated.push({ category, oldName, newName, width, height });
                return true;
            }
        },
        renderDialog: () => { renders.push("render"); }
    };
    const manager = new RenameDialogManager(parentDialog);
    const nameElement = createMockElement("strong", "OldPreset");

    manager.startRenamingPreset(nameElement, "Portraits", "OldPreset", { width: 512, height: 768 });
    const input = nameElement.replacedWith;
    assert.ok(input);
    assert.equal(input.value, "OldPreset");

    input.value = "NewPreset";
    input.dispatchEvent("keydown", { key: "Enter" });

    assert.deepEqual(updated, [{
        category: "Portraits",
        oldName: "OldPreset",
        newName: "NewPreset",
        width: 512,
        height: 768
    }]);
    assert.deepEqual(renders, ["render"]);
});

test("startRenamingPreset restores element on Escape without updating", () => {
    setupTestEnvironment();
    const updated = [];
    const parentDialog = {
        manager: {
            getCustomPresets: () => ({ Portraits: {} }),
            updatePreset: (category, oldName, newName, width, height) => {
                updated.push({ category, oldName, newName, width, height });
                return true;
            }
        },
        renderDialog: mock.fn()
    };
    const manager = new RenameDialogManager(parentDialog);
    const nameElement = createMockElement("strong", "MyPreset");

    manager.startRenamingPreset(nameElement, "Portraits", "MyPreset", { width: 512, height: 768 });
    const input = nameElement.replacedWith;
    input.value = "Aborted";
    input.dispatchEvent("keydown", { key: "Escape" });

    assert.equal(updated.length, 0);
    assert.ok(input.replacedWith);
    assert.equal(input.replacedWith.textContent, "MyPreset");
});
