import { mock } from "node:test";

// Mock the icon_utils.js module to prevent it from importing scripts/app.js
mock.module("../../js/utils/icon_utils.js", {
    namedExports: {
        loadIcons: () => {}
    }
});

import assert from "node:assert/strict";
import test from "node:test";

// Mock minimal DOM environment
globalThis.window = {
    innerHeight: 800,
    innerWidth: 600,
    pageYOffset: 0
};

class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.style = {};
        this.children = [];
        this.listeners = {};
        this.parentNode = null;
        this.value = "";
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
    getBoundingClientRect() {
        return {
            top: 100,
            left: 50,
            width: 250,
            height: 350
        };
    }
    focus() {}
    select() {}
    querySelector(selector) {
        return new MockElement('div');
    }
    querySelectorAll(selector) {
        return [];
    }
}

globalThis.document = {
    createElement(tagName) {
        return new MockElement(tagName);
    },
    head: new MockElement('head'),
    body: new MockElement('body')
};

test("SearchableDropdown toggleExpand and applyExpandedState updates maxHeight", async () => {
    const { SearchableDropdown } = await import("../../js/components/searchable_dropdown.js");
    const dropdown = new SearchableDropdown();
    const mockItems = ["Item A", "Item B", "Item C"];
    
    dropdown.show(mockItems, {
        event: { clientX: 100, clientY: 200 }
    });
    
    assert.equal(dropdown.isExpanded, false);
    
    // Trigger expand
    dropdown.toggleExpand();
    assert.equal(dropdown.isExpanded, true);
    
    // Check that expanded height styles are applied
    assert.ok(dropdown.itemsContainer.style.maxHeight);
    assert.ok(dropdown.container.style.maxHeight);
    assert.equal(dropdown.expandButton.textContent, "Show Less");
    
    // Toggle collapse
    dropdown.toggleExpand();
    assert.equal(dropdown.isExpanded, false);
    assert.equal(dropdown.itemsContainer.style.maxHeight, `${dropdown.DEFAULT_MAX_HEIGHT}px`);
    assert.equal(dropdown.container.style.maxHeight, "400px");
    assert.equal(dropdown.expandButton.textContent, "Show All");
    
    // Wait for the setTimeout focus to fire before hiding
    await new Promise(resolve => setTimeout(resolve, 100));
    
    dropdown.hide();
});
