import assert from "node:assert/strict";
import test from "node:test";

import { JSONEditorDialog } from "../../js/presets/preset_manager/json_editor_dialog.js";

class MockElement {
    constructor(title = null) {
        this.attributes = new Map();
        this.children = [];
        this.dataset = {};
        if (title) this.attributes.set("title", title);
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    appendChild(child) {
        this.children.push(child);
    }

    querySelectorAll(selector) {
        assert.equal(selector, "[title]");
        return this.children.flatMap((child) => [
            ...(child.getAttribute("title") ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
}

test("JSON editor routes native and dynamically created title tooltips through one manager", () => {
    const originalMutationObserver = globalThis.MutationObserver;
    let observerInstance;

    class MockMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.disconnected = false;
            observerInstance = this;
        }

        observe(target, options) {
            this.target = target;
            this.options = options;
        }

        disconnect() {
            this.disconnected = true;
        }
    }

    globalThis.MutationObserver = MockMutationObserver;

    try {
        const container = new MockElement();
        const foldControl = new MockElement("Fold code");
        container.appendChild(foldControl);

        const attached = [];
        const tooltipManager = {
            attach(element) {
                attached.push(element);
            }
        };

        const dialog = new JSONEditorDialog(null);
        const cleanup = dialog.replaceNativeEditorTooltips(container, tooltipManager);

        assert.equal(foldControl.getAttribute("title"), null);
        assert.equal(foldControl.dataset.tooltipText, "Fold code");
        assert.deepEqual(attached, [foldControl]);
        assert.deepEqual(observerInstance.options.attributeFilter, ["title"]);

        foldControl.setAttribute("title", "Unfold code");
        observerInstance.callback([{ type: "attributes", target: foldControl }]);

        assert.equal(foldControl.getAttribute("title"), null);
        assert.equal(foldControl.dataset.tooltipText, "Unfold code");
        assert.deepEqual(attached, [foldControl]);

        const dynamicControl = new MockElement("Compact data");
        container.appendChild(dynamicControl);
        observerInstance.callback([{ type: "childList", addedNodes: [dynamicControl] }]);

        assert.equal(dynamicControl.getAttribute("title"), null);
        assert.equal(dynamicControl.dataset.tooltipText, "Compact data");
        assert.deepEqual(attached, [foldControl, dynamicControl]);

        cleanup();
        assert.equal(observerInstance.disconnected, true);
    } finally {
        globalThis.MutationObserver = originalMutationObserver;
    }
});
