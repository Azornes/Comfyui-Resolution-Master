// PresetUIComponents.js - UI component creation helpers for PresetManagerDialog

/**
 * Helper class for creating UI components used in PresetManagerDialog
 */
export class PresetUIComponents {
    /**
     * Adds hover effects to a button element
     * @param {HTMLElement} button - The button element
     * @param {string} hoverBg - Background color on hover
     * @param {string} normalBg - Normal background color
     * @param {string} hoverBorder - Border color on hover (optional)
     * @param {string} normalBorder - Normal border color (optional)
     */
    static addButtonHoverEffects(button, hoverBg, normalBg, hoverBorder = null, normalBorder = null) {
        button.addEventListener('mouseenter', () => {
            button.style.background = hoverBg;
            if (hoverBorder) button.style.borderColor = hoverBorder;
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = normalBg;
            if (normalBorder) button.style.borderColor = normalBorder;
        });
    }

    /**
     * Creates a form group (label + input)
     * @param {string} label - Label text
     * @param {string} id - Input ID
     * @param {string} type - Input type
     * @param {string} placeholder - Placeholder text
     * @param {string} value - Initial value
     * @returns {HTMLElement} The form group element
     */
    static createFormGroup(label, id, type, placeholder, value = '') {
        const group = document.createElement('div');
        group.className = 'resolution-master-preset-ui-form-group';

        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        labelEl.className = 'resolution-master-preset-ui-form-label';

        const input = document.createElement('input');
        input.id = id;
        input.type = type;
        input.placeholder = placeholder;
        input.value = value;
        input.className = 'resolution-master-preset-ui-form-input';
        
        if (type === 'number') {
            input.min = '64';
            input.step = '1';
        }

        group.appendChild(labelEl);
        group.appendChild(input);

        return group;
    }

    /**
     * Creates an action button for preset items
     * @param {string} icon - Icon (text or HTML)
     * @param {string} tooltip - Tooltip text
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} The button element
     */
    static createActionButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        btn.className = 'resolution-master-preset-ui-action-btn';
        
        // Support both text icons and HTML (for SVG icons)
        if (icon.includes('<img')) {
            btn.innerHTML = icon;
        } else {
            btn.textContent = icon;
        }
        // Tooltip handled by TooltipManager (tooltip parameter kept for compatibility)

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });

        return btn;
    }

    /**
     * Creates a footer button
     * @param {string} text - Button text (can include HTML for icons)
     * @param {string} style - Button style ('primary' or 'secondary')
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} The button element
     */
    static createFooterButton(text, style, onClick) {
        const btn = document.createElement('button');
        btn.className = `preset-ui-footer-btn preset-ui-footer-btn-${style}`;
        
        // Support both text and HTML (for SVG icons)
        if (text.includes('<img')) {
            btn.innerHTML = text;
        } else {
            btn.textContent = text;
        }

        btn.addEventListener('click', onClick);

        return btn;
    }

    /**
     * Creates a preset card for the preview
     * @param {string} name - Preset name
     * @param {Object} dims - Dimensions {width, height}
     * @param {Object} deleteIcon - Delete icon object
     * @param {Function} onDelete - Delete callback
     * @returns {HTMLElement} The card element
     */
    static createPresetCard(name, dims, deleteIcon, onDelete) {
        const card = document.createElement('div');
        card.className = 'resolution-master-preset-ui-card';

        // Preset name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'resolution-master-preset-ui-card-name';
        nameDiv.textContent = name;
        // Tooltip handled by TooltipManager

        // Dimensions
        const dimsDiv = document.createElement('div');
        dimsDiv.className = 'resolution-master-preset-ui-card-dims';
        dimsDiv.textContent = `${dims.width}×${dims.height}`;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'resolution-master-preset-ui-card-delete-btn';
        // Tooltip handled by TooltipManager
        
        if (deleteIcon) {
            deleteBtn.innerHTML = `<img src="${deleteIcon.src}" class="resolution-master-preset-ui-card-delete-icon">`;
        } else {
            deleteBtn.textContent = '🗑️';
        }

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete();
        });

        card.appendChild(nameDiv);
        card.appendChild(dimsDiv);
        card.appendChild(deleteBtn);

        return card;
    }
}
