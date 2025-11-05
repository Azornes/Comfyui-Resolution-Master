// RenameDialogManager.js - Rename dialogs for categories and presets

import { getIconHtml } from "../IconUtils.js";

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
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'rename-dialog-overlay';
        overlay.addEventListener('mousedown', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        document.body.appendChild(overlay);

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'rename-dialog';
        dialog.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent clicks inside from closing
        
        // Create dialog content
        dialog.innerHTML = `
            <div class="rename-dialog-title">Rename Category</div>
            <div class="rename-dialog-input-group">
                <label class="rename-dialog-label">Current: ${currentCategoryName}</label>
                <input type="text" id="renameCategoryInput" value="${currentCategoryName}" class="rename-dialog-input">
            </div>
            <div id="renameValidationMessage" class="rename-dialog-validation"></div>
            <div class="rename-dialog-buttons">
                <button id="renameCancelBtn" class="rename-dialog-cancel-btn">Cancel</button>
                <button id="renameApplyBtn" class="rename-dialog-apply-btn">Apply</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
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
                document.body.removeChild(overlay);
                document.body.removeChild(dialog);
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
                document.body.removeChild(overlay);
                document.body.removeChild(dialog);
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        
        applyBtn.addEventListener('click', applyRename);
        
        // Initial validation
        validateInput();
    }

    /**
     * Starts renaming a category by converting title to input
     * @param {HTMLElement} titleElement - The category title element
     * @param {string} categoryName - Current category name
     */
    startRenamingCategory(titleElement, categoryName) {
        const originalText = titleElement.textContent;
        const categoryNameOnly = categoryName; // Without the count
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = categoryNameOnly;
        input.className = 'rename-inline-category-input';
        
        // Replace title with input
        titleElement.replaceWith(input);
        input.focus();
        input.select();
        
        // Flag to prevent multiple saves
        let isSaving = false;
        
        // Handle Enter key - save
        const handleSave = () => {
            // Prevent multiple calls
            if (isSaving) return;
            isSaving = true;
            
            const newName = input.value.trim();
            
            if (!newName) {
                // Empty name - restore original
                const newTitle = this.recreateCategoryTitleElement(originalText, categoryNameOnly);
                input.replaceWith(newTitle);
                return;
            }
            
            if (newName === categoryNameOnly) {
                // No change - restore original
                const newTitle = this.recreateCategoryTitleElement(originalText, categoryNameOnly);
                input.replaceWith(newTitle);
                return;
            }
            
            // Try to rename
            const success = this.parentDialog.manager.renameCategory(categoryNameOnly, newName);
            
            if (success) {
                // Success - refresh dialog
                this.parentDialog.renderDialog();
            } else {
                // Failed - show error and keep editing
                alert(`Cannot rename category to "${newName}". It may already exist or be invalid.\n\nOld name: "${categoryNameOnly}"\nCheck browser console for details.`);
                input.focus();
                input.select();
            }
        };
        
        // Handle Escape key - cancel
        const handleCancel = () => {
            const newTitle = this.recreateCategoryTitleElement(originalText, categoryNameOnly);
            input.replaceWith(newTitle);
        };
        
        // Event listeners
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
            // Save on blur
            handleSave();
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
        newTitle.className = 'rename-category-title';
        newTitle.textContent = text;
        
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
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = presetName;
        input.className = 'rename-inline-preset-input';
        
        // Replace name with input
        nameElement.replaceWith(input);
        input.focus();
        input.select();
        
        // Flag to prevent multiple saves
        let isSaving = false;
        
        // Handle Enter key - save
        const handleSave = () => {
            // Prevent multiple calls
            if (isSaving) return;
            isSaving = true;
            
            const newName = input.value.trim();
            
            if (!newName) {
                // Empty name - restore original
                const newNameElement = this.recreatePresetNameElement(originalText, category, presetName, dims);
                input.replaceWith(newNameElement);
                return;
            }
            
            if (newName === presetName) {
                // No change - restore original
                const newNameElement = this.recreatePresetNameElement(originalText, category, presetName, dims);
                input.replaceWith(newNameElement);
                return;
            }
            
            // Check if new name already exists in category
            const customPresets = this.parentDialog.manager.getCustomPresets();
            const categoryPresets = customPresets[category] || {};
            if (Object.keys(categoryPresets).includes(newName)) {
                // Name exists - show error and keep editing
                alert(`Preset "${newName}" already exists in category "${category}".\n\nPlease choose a different name.`);
                isSaving = false; // Reset flag to allow retry
                input.focus();
                input.select();
                return;
            }
            
            // Try to rename using updatePreset
            const success = this.parentDialog.manager.updatePreset(category, presetName, newName, dims.width, dims.height);
            
            if (success) {
                // Success - refresh dialog
                this.parentDialog.renderDialog();
            } else {
                // Failed - show error and keep editing
                alert(`Cannot rename preset to "${newName}".\n\nOld name: "${presetName}"\nCheck browser console for details.`);
                isSaving = false; // Reset flag to allow retry
                input.focus();
                input.select();
            }
        };
        
        // Handle Escape key - cancel
        const handleCancel = () => {
            const newNameElement = this.recreatePresetNameElement(originalText, category, presetName, dims);
            input.replaceWith(newNameElement);
        };
        
        // Event listeners
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
            // Save on blur
            handleSave();
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
        newNameElement.className = 'rename-preset-name';
        newNameElement.textContent = text;
        
        newNameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startRenamingPreset(newNameElement, category, presetName, dims);
        });
        return newNameElement;
    }
}
