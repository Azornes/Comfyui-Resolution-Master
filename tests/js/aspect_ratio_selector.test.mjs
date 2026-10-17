import { mock } from "node:test";

// Mock the icon_utils.js module to prevent it from importing scripts/app.js
mock.module("../../js/utils/icon_utils.js", {
    namedExports: {
        loadIcons: () => {},
        getIconHtml: () => ""
    }
});

import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {
    innerHeight: 800,
    innerWidth: 600,
    addEventListener: () => {},
    removeEventListener: () => {}
};

class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.style = {};
        this.children = [];
        this.listeners = {};
        this.attributes = {};
        this.parentNode = null;
        this.value = "";
        this.scrollHeight = 100;
        this.clientHeight = 100;
        this.scrollWidth = 100;
        this.clientWidth = 100;
        this.scrollLeft = 0;
        this.classList = {
            classes: new Set(),
            add: (c) => this.classList.classes.add(c),
            remove: (c) => this.classList.classes.delete(c),
            toggle: (c, force) => {
                if (force ?? !this.classList.classes.has(c)) {
                    this.classList.classes.add(c);
                } else {
                    this.classList.classes.delete(c);
                }
            },
            contains: (c) => this.classList.classes.has(c)
        };
    }
    appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
    }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentNode = null;
        }
        return child;
    }
    addEventListener(name, handler) {
        this.listeners[name] = this.listeners[name] || [];
        this.listeners[name].push(handler);
    }
    removeEventListener(name, handler) {
        const list = this.listeners[name];
        if (list) {
            const idx = list.indexOf(handler);
            if (idx !== -1) list.splice(idx, 1);
        }
    }
    setAttribute(name, val) {
        this.attributes[name] = String(val);
    }
    getAttribute(name) {
        return this.attributes[name] || null;
    }
    getBoundingClientRect() {
        return {
            top: 50,
            left: 50,
            width: 300,
            height: 400
        };
    }
    focus() {}
    select() {}
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
        const results = [];
        const traverse = (el) => {
            if (selector === '[data-preset-item]' && el.getAttribute && el.getAttribute('data-preset-item')) {
                results.push(el);
            }
            for (const child of el.children) {
                traverse(child);
            }
        };
        traverse(this);
        return results;
    }
    click() {
        const handlers = this.listeners['click'] || [];
        const event = { stopPropagation: () => {} };
        for (const h of handlers) h(event);
    }
    mousedown() {
        const handlers = this.listeners['mousedown'] || [];
        const event = { stopPropagation: () => {} };
        for (const h of handlers) h(event);
    }
}

globalThis.document = {
    createElement(tagName) {
        return new MockElement(tagName);
    },
    head: new MockElement('head'),
    body: new MockElement('body')
};

test("AspectRatioSelector mode toggle switches mode and hides selector", async () => {
    const { AspectRatioSelector } = await import("../../js/components/aspect_ratio_selector.js");
    const selector = new AspectRatioSelector();
    const presets = {
        "1024x1024": { width: 1024, height: 1024 },
        "1920x1080": { width: 1920, height: 1080 }
    };
    let switchedMode = null;
    let switchedPresets = null;

    selector.show(presets, {
        currentMode: 'visual',
        onModeChange: (newMode, p) => {
            switchedMode = newMode;
            switchedPresets = p;
        }
    });

    assert.equal(selector.isActive, true);
    // Container children: [0]: modeToggleContainer, [1]: searchContainer, [2]: scrollWrapper
    const modeToggleContainer = selector.container.children[0];
    const modeToggleButton = modeToggleContainer.children[1];
    assert.ok(modeToggleButton.textContent.includes("Visual"));

    modeToggleButton.click();
    assert.equal(switchedMode, "list");
    assert.deepEqual(switchedPresets, presets);
    assert.equal(selector.isActive, false);
});

test("AspectRatioSelector preset selection invokes callback and hides selector", async () => {
    const { AspectRatioSelector } = await import("../../js/components/aspect_ratio_selector.js");
    const selector = new AspectRatioSelector();
    const presets = {
        "1024x1024": { width: 1024, height: 1024 }
    };
    let selected = null;

    selector.show(presets, {
        currentMode: 'visual',
        callback: (name) => {
            selected = name;
        }
    });

    assert.equal(selector.isActive, true);
    selector.selectPreset("1024x1024");

    assert.equal(selected, "1024x1024");
    assert.equal(selector.isActive, false);
    assert.equal(selector.container, null);
    assert.equal(selector.overlay, null);
});

test("AspectRatioSelector mousedown on overlay hides selector", async () => {
    const { AspectRatioSelector } = await import("../../js/components/aspect_ratio_selector.js");
    const selector = new AspectRatioSelector();
    const presets = {
        "1024x1024": { width: 1024, height: 1024 }
    };

    selector.show(presets, {
        currentMode: 'visual'
    });

    assert.equal(selector.isActive, true);
    assert.ok(selector.overlay);

    selector.overlay.mousedown();
    assert.equal(selector.isActive, false);
    assert.equal(selector.container, null);
    assert.equal(selector.overlay, null);
});
