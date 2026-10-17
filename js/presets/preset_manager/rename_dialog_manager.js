// rename_dialog_manager.js - Rename dialogs for categories and presets

import { getIconHtml } from "../../utils/icon_utils.js";
import { createModalWrapper } from "../../utils/dialog_helper.js";

/**
 * Manager for rename dialogs (categories and presets)
 */
export class RenameDialogManager {
    constructor(parentDialog) {
        this.parentDialog = parentDialog;
    }

    /**
     * Shows a dialog to rename the category
     * @param {string} currentCategoryName - Current category name
     */
    showRenameCategoryDialog(currentCategoryName) {
        // Create overlay and dialog container via dialog_helper
        const wrapper = createModalWrapper({
            className: 'resolution-master-rename-dialog',
            overlayClassName: 'resolution-master-rename-dialog-overlay'
        });
        const overlay = wrapper.overlay;
        const dialog = wrapper.dialog;
        
        // Create dialog content
        dialog.innerHTML = `
            <div class="resolution-master-rename-dialog-title">Rename Category</div>
            <div class="resolution-master-rename-dialog-input-group">
                <label class="resolution-master-rename-dialog-label">Current: ${currentCategoryName}</label>
                <input type="text" id="renameCategoryInput" value="${currentCategoryName}" class="resolution-master-rename-dialog-input">
            </div>
            <div id="renameValidationMessage" class="resolution-master-rename-dialog-validation"></div>
            <div class="resolution-master-rename-dialog-buttons">
                <button id="renameCancelBtn" class="resolution-master-rename-dialog-cancel-btn">Cancel</button>
                <button id="renameApplyBtn" class="resolution-master-rename-dialog-apply-btn">Apply</button>
            </div>
        `;
        
        // Get elements
        const input = dialog.querySelector('#renameCategoryInput');
        const validationMsg = dialog.querySelector('#renameValidationMessage');
        const cancelBtn = dialog.querySelector('#renameCancelBtn');
        const applyBtn = dialog.querySelector('#renameApplyBtn');
        
        // Focus and select input
        setTimeout(() => { 
            input.focus(); 
            input.select(); 
        }, 50);
        
        // Real-time validation
        const validateInput = () => {
            const newName = input.value.trim();
            
            if (!newName) {
                validationMsg.textContent = 'Category name cannot be empty';
                applyBtn.disabled = true;
                applyBtn.style.opacity = '0.5';
                applyBtn.style.cursor = 'not-allowed';
                return false;
            }
            
            if (newName === currentCategoryName) {
                validationMsg.textContent = '';
                applyBtn.disabled = true;
                applyBtn.style.opacity = '0.5';
                applyBtn.style.cursor = 'not-allowed';
                return false;
            }
            
            // Check if category already exists
            const customPresets = this.parentDialog.manager.getCustomPresets();
            if (customPresets[newName]) {
                validationMsg.textContent = `Category "${newName}" already exists`;
                applyBtn.disabled = true;
                applyBtn.style.opacity = '0.5';
                applyBtn.style.cursor = 'not-allowed';
                return false;
            }
            
            validationMsg.textContent = '';
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
            applyBtn.style.cursor = 'pointer';
            return true;
        };
        
        // Apply rename function
        const applyRename = () => {
            if (!validateInput()) return;
            
            const trimmedNewName = input.value.trim();
            
            // Try to rename
            const success = this.parentDialog.manager.renameCategory(currentCategoryName, trimmedNewName);
            
            if (success) {
                // Success - update selected category and refresh dialog
                this.parentDialog.selectedCategory = trimmedNewName;
                wrapper.close();
                this.parentDialog.renderDialog();
            } else {
                // Failed - show error in validation message
                validationMsg.textContent = `Failed to rename category. Check browser console for details.`;
            }
        };
        
        // Event listeners
        input.addEventListener('input', validateInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && validateInput()) {
                applyRename();
            } else if (e.key === 'Escape') {
                wrapper.close();
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            wrapper.close();
        });
        
        applyBtn.addEventListener('click', applyRename);
        
        // Initial validation
        validateInput();
    }

    /**
     * Sets up inline input editing for an element.
     * @private
     * @param {HTMLElement} element - Target element to replace
     * @param {Object} options
     * @param {string} options.initialValue - Initial text value
     * @param {string} options.inputClassName - CSS class for input
     * @param {function(string): (boolean|void)} options.onSave - Callback returning true if saved, false if retry/keep editing
     * @param {function(): HTMLElement} options.onRestore - Callback returning original element to restore
     */
    _setupInlineEdit(element, { initialValue, inputClassName, onSave, onRestore }) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = initialValue;
        input.className = inputClassName;

        element.replaceWith(input);
        input.focus();
        input.select();

        let isSaving = false;

        const handleSave = () => {
            if (isSaving) return;
            isSaving = true;

            const trimmedValue = input.value.trim();

            if (!trimmedValue || trimmedValue === initialValue) {
                input.replaceWith(onRestore());
                return;
            }

            const success = onSave(trimmedValue);
            if (success) {
                this.parentDialog.renderDialog();
            } else {
                isSaving = false;
                input.focus();
                input.select();
            }
        };

        const handleCancel = () => {
            input.replaceWith(onRestore());
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });

        input.addEventListener('blur', () => {
            handleSave();
        });
    }

    /**
     * Starts renaming a category by converting title to input
     * @param {HTMLElement} titleElement - The category title element
     * @param {string} categoryName - Current category name
     */
    startRenamingCategory(titleElement, categoryName) {
        const originalText = titleElement.textContent;
        const categoryNameOnly = categoryName; // Without the count

        this._setupInlineEdit(titleElement, {
            initialValue: categoryNameOnly,
            inputClassName: 'resolution-master-rename-inline-category-input',
            onRestore: () => this.recreateCategoryTitleElement(originalText, categoryNameOnly),
            onSave: (newName) => {
                let finalNewName = newName;
                const customPresets = this.parentDialog.manager.getCustomPresets();

                // If category name already exists (and it's not the same category), add suffix
                if (customPresets[finalNewName] && finalNewName !== categoryNameOnly) {
                    let counter = 1;
                    while (customPresets[`${newName} (${counter})`]) {
                        counter++;
                    }
                    finalNewName = `${newName} (${counter})`;
                }

                // Try to rename with the final unique name
                const success = this.parentDialog.manager.renameCategory(categoryNameOnly, finalNewName);
                if (!success) {
                    alert(`Cannot rename category to "${finalNewName}".\n\nOld name: "${categoryNameOnly}"\nCheck browser console for details.`);
                }
                return success;
            }
        });
    }

    /**
     * Recreates category title element
     * @param {string} text - Title text
     * @param {string} categoryName - Category name
     * @returns {HTMLElement} The title element
     */
    recreateCategoryTitleElement(text, categoryName) {
        const newTitle = document.createElement('div');
        newTitle.className = 'resolution-master-rename-category-title';
        newTitle.textContent = text;
        // Tooltip handled by tooltip_manager
        newTitle.addEventListener('dblclick', () => {
            this.startRenamingCategory(newTitle, categoryName);
        });
        return newTitle;
    }

    /**
     * Starts renaming a preset by converting name to input
     * @param {HTMLElement} nameElement - The preset name element
     * @param {string} category - Category name
     * @param {string} presetName - Current preset name
     * @param {Object} dims - Dimensions {width, height}
     */
    startRenamingPreset(nameElement, category, presetName, dims) {
        const originalText = nameElement.textContent;

        this._setupInlineEdit(nameElement, {
            initialValue: presetName,
            inputClassName: 'resolution-master-rename-inline-preset-input',
            onRestore: () => this.recreatePresetNameElement(originalText, category, presetName, dims),
            onSave: (newName) => {
                // Check if new name already exists in category
                const customPresets = this.parentDialog.manager.getCustomPresets();
                const categoryPresets = customPresets[category] || {};
                if (Object.keys(categoryPresets).includes(newName)) {
                    // Name exists - show error and keep editing
                    alert(`Preset "${newName}" already exists in category "${category}".\n\nPlease choose a different name.`);
                    return false;
                }

                // Try to rename using updatePreset
                const success = this.parentDialog.manager.updatePreset(category, presetName, newName, dims.width, dims.height);
                if (!success) {
                    // Failed - show error and keep editing
                    alert(`Cannot rename preset to "${newName}".\n\nOld name: "${presetName}"\nCheck browser console for details.`);
                }
                return success;
            }
        });
    }

    /**
     * Recreates preset name element
     * @param {string} text - Name text
     * @param {string} category - Category name
     * @param {string} presetName - Preset name
     * @param {Object} dims - Dimensions
     * @returns {HTMLElement} The name element
     */
    recreatePresetNameElement(text, category, presetName, dims) {
        const newNameElement = document.createElement('strong');
        newNameElement.className = 'resolution-master-rename-preset-name';
        newNameElement.textContent = text;
        // Tooltip handled by tooltip_manager
        newNameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startRenamingPreset(newNameElement, category, presetName, dims);
        });
        return newNameElement;
    }
}
