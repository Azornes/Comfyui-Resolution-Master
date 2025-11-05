# TooltipManager Usage Guide

The `TooltipManager` is a DOM-based tooltip system adapted from the canvas-based tooltip implementation in `ResolutionMaster.js`.

## Basic Usage

### 1. Import and Initialize

```javascript
import { TooltipManager } from './TooltipManager.js';

// Create a tooltip manager instance
const tooltipManager = new TooltipManager({
    delay: 500,        // Optional: delay before showing tooltip (default: 500ms)
    maxWidth: 250,     // Optional: maximum tooltip width (default: 250px)
    tooltips: {}       // Optional: initial tooltip mappings
});
```

### 2. Attach Tooltips to Elements

#### Method 1: Inline Tooltip Text
```javascript
const button = document.createElement('button');
button.textContent = 'Click me';

// Attach tooltip with text directly
tooltipManager.attach(button, 'This button does something amazing!');
```

#### Method 2: Register Tooltips by Element ID
```javascript
// Register tooltip text
tooltipManager.registerTooltip('my-button-id', 'Tooltip text for this button');

// Attach to element (tooltip text looked up by ID)
const button = document.getElementById('my-button-id');
tooltipManager.attach(button);
```

#### Method 3: Using Data Attributes
```javascript
const button = document.createElement('button');
button.dataset.tooltipText = 'This is the tooltip text';

// Attach without providing text (will use data-tooltipText)
tooltipManager.attach(button);
```

#### Method 4: Register Multiple Tooltips at Once
```javascript
tooltipManager.registerTooltips({
    'button1': 'Tooltip for button 1',
    'button2': 'Tooltip for button 2',
    'setting-toggle': 'Toggle this setting on or off'
});
```

### 3. Detach Tooltips

```javascript
// Remove tooltip handlers from an element
tooltipManager.detach(button);
```

### 4. Cleanup

```javascript
// When done with the tooltip manager (e.g., when closing a dialog)
tooltipManager.destroy();
```

## Integration Example with PresetManagerDialog

Here's how you might integrate TooltipManager into the PresetManagerDialog:

```javascript
import { TooltipManager } from './preset-manager/TooltipManager.js';

class PresetManagerDialog {
    constructor(manager) {
        this.manager = manager;
        
        // Initialize tooltip manager
        this.tooltipManager = new TooltipManager({
            delay: 500,
            maxWidth: 300
        });
        
        // Register common tooltips
        this.tooltipManager.registerTooltips({
            'add-preset-btn': 'Add a new custom preset to the selected category',
            'edit-preset-btn': 'Edit the selected preset dimensions',
            'delete-preset-btn': 'Delete this custom preset',
            'manage-categories-btn': 'Manage categories and their order',
            'export-json-btn': 'Export all custom presets as JSON',
            'import-json-btn': 'Import custom presets from JSON file'
        });
    }
    
    renderDialog() {
        // ... existing code ...
        
        // Attach tooltips to buttons
        const addBtn = dialog.querySelector('#add-preset-btn');
        if (addBtn) {
            this.tooltipManager.attach(addBtn);
        }
        
        // Attach with inline text (overrides registered tooltip)
        const specialBtn = dialog.querySelector('.special-button');
        if (specialBtn) {
            this.tooltipManager.attach(specialBtn, 'This button has a special function');
        }
    }
    
    close() {
        // Clean up tooltips when closing dialog
        this.tooltipManager.destroy();
    }
}
```

## Features

- **Delayed Display**: Tooltips appear after a configurable delay (default 500ms)
- **Smart Positioning**: Automatically adjusts position to stay within viewport
- **Flexible Registration**: Multiple ways to associate tooltips with elements
- **Clean Styling**: Pre-styled with dark background and smooth transitions
- **Easy Cleanup**: Simple destroy() method for proper cleanup

## Styling

The tooltip uses inline styles but can be customized by modifying the `createTooltipElement()` method in `TooltipManager.js`. The default style includes:

- Dark semi-transparent background with gradient
- White text
- Rounded corners
- Drop shadow
- Smooth fade-in/out transition
- Automatic word wrapping

## Notes

- The tooltip element is positioned with `position: fixed` and `z-index: 100000` to ensure it appears above all other content
- Tooltips are non-interactive (`pointer-events: none`)
- The tooltip follows the mouse cursor while visible
- Multiple tooltip managers can coexist for different parts of the UI
