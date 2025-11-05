// PresetAddViewRenderer.js - Renders the add/edit preset view

import { AspectRatioUtils } from "../AspectRatioUtils.js";
import { getIconHtml } from "../IconUtils.js";

/**
 * Renderer for the add/edit preset view
 */
export class PresetAddViewRenderer {
    constructor(parentDialog) {
        this.parentDialog = parentDialog;
    }

    /**
     * Renders the add/edit preset view with category selection and preview
     * @param {HTMLElement} container - Container to render into
     */
    render(container) {
        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'preset-add-title';
        titleDiv.textContent = 'Add Presets to Category';
        container.appendChild(titleDiv);

        // Category selection section
        const categorySection = this.createCategorySection();
        container.appendChild(categorySection);

        // Quick add form (shown only when category is selected)
        if (this.parentDialog.selectedCategory) {
            this.renderQuickAddForm(container);
            
            // Validation message
            const validationMsg = document.createElement('div');
            validationMsg.id = 'validation-msg';
            validationMsg.style.cssText = `
                color: #f55;
                font-size: 12px;
                margin-top: 4px;
                margin-bottom: 8px;
                min-height: 14px;
            `;
            container.appendChild(validationMsg);

            // Preset preview section
            this.renderPresetPreview(container);
        }
    }

    /**
     * Creates the category selection section
     * @returns {HTMLElement} Category section
     */
    createCategorySection() {
        const categorySection = document.createElement('div');
        categorySection.className = 'preset-add-category-section';

        const categoryLabel = document.createElement('div');
        categoryLabel.className = 'preset-add-category-label';
        categoryLabel.textContent = 'Category';
        categorySection.appendChild(categoryLabel);

        // Container for category button and rename button
        const categoryButtonContainer = document.createElement('div');
        categoryButtonContainer.className = 'preset-add-category-btn-container';

        const categoryButton = this.createCategoryButton();
        categoryButtonContainer.appendChild(categoryButton);

        // Rename category button (only shown when category is selected)
        if (this.parentDialog.selectedCategory) {
            const renameCategoryBtn = this.createRenameCategoryButton();
            categoryButtonContainer.appendChild(renameCategoryBtn);
        }

        categorySection.appendChild(categoryButtonContainer);
        return categorySection;
    }

    /**
     * Creates the category selection button
     * @returns {HTMLElement} Category button
     */
    createCategoryButton() {
        const categoryButton = document.createElement('button');
        categoryButton.id = 'category-select-btn';
        categoryButton.className = 'preset-add-category-btn';
        if (!this.parentDialog.selectedCategory) {
            categoryButton.classList.add('placeholder');
        }
        categoryButton.textContent = this.parentDialog.selectedCategory || 'Click to select category...';

        categoryButton.addEventListener('click', (e) => {
            this.parentDialog.showCategoryDropdown(e);
        });

        return categoryButton;
    }

    /**
     * Creates the rename category button
     * @returns {HTMLElement} Rename button
     */
    createRenameCategoryButton() {
        const renameCategoryBtn = document.createElement('button');
        renameCategoryBtn.className = 'preset-add-rename-category-btn';
        renameCategoryBtn.innerHTML = getIconHtml(this.parentDialog.editIcon, '✏️');
        renameCategoryBtn.title = `Rename "${this.parentDialog.selectedCategory}" category`;

        renameCategoryBtn.addEventListener('click', () => {
            this.parentDialog.renameDialogManager.showRenameCategoryDialog(this.parentDialog.selectedCategory);
        });

        return renameCategoryBtn;
    }

    /**
     * Renders the quick add form
     * @param {HTMLElement} container - Container to render into
     */
    renderQuickAddForm(container) {
        const isEditMode = this.parentDialog.editingPresetData !== null;
        const sectionBorderColor = isEditMode ? 'rgba(80, 255, 80, 0.5)' : 'rgba(90, 170, 255, 0.3)';
        const sectionBgColor = isEditMode ? 'rgba(80, 255, 80, 0.1)' : 'rgba(90, 170, 255, 0.1)';
        const titleColor = isEditMode ? '#5f5' : '#5af';
        
        const quickAddSection = document.createElement('div');
        quickAddSection.style.cssText = `
            margin-bottom: 12px;
            padding: 10px;
            background: ${sectionBgColor};
            border: 1px solid ${sectionBorderColor};
            border-radius: 6px;
        `;

        const quickAddTitle = document.createElement('div');
        quickAddTitle.id = 'quick-add-title';
        quickAddTitle.textContent = this.parentDialog.editingPresetData ? `Quick Edit Preset: ${this.parentDialog.editingPresetData.name}` : 'Quick Add Preset';
        quickAddTitle.style.cssText = `color: ${titleColor}; font-size: 13px; font-weight: bold; margin-bottom: 6px;`;
        quickAddSection.appendChild(quickAddTitle);

        const quickAddForm = this.createQuickAddForm();
        quickAddSection.appendChild(quickAddForm);

        container.appendChild(quickAddSection);
    }

    /**
     * Creates the quick add form
     * @returns {HTMLElement} Form element
     */
    createQuickAddForm() {
        const quickAddForm = document.createElement('div');
        quickAddForm.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        // Name input with error message
        const nameGroup = this.createNameInput();
        quickAddForm.appendChild(nameGroup);

        // Width and Height in a row
        const dimensionsRow = this.createDimensionsRow();
        quickAddForm.appendChild(dimensionsRow);

        // Preview container for shape visualization
        const previewContainer = this.createPreviewContainer();
        quickAddForm.appendChild(previewContainer);

        // Button container for + and X buttons
        const buttonContainer = this.createButtonContainer();
        quickAddForm.appendChild(buttonContainer);

        return quickAddForm;
    }

    /**
     * Creates the name input group
     * @returns {HTMLElement} Name group
     */
    createNameInput() {
        const nameGroup = document.createElement('div');
        nameGroup.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name';
        nameLabel.style.cssText = 'color: #ccc; font-size: 11px; font-weight: bold;';
        
        const nameInput = document.createElement('input');
        nameInput.id = 'quick-name-input';
        nameInput.type = 'text';
        nameInput.placeholder = 'Preset name';
        nameInput.value = this.parentDialog.editingPresetData ? this.parentDialog.editingPresetData.name : '';
        nameInput.style.cssText = `
            padding: 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 13px;
            outline: none;
        `;
        
        const nameErrorMsg = document.createElement('div');
        nameErrorMsg.id = 'name-error-msg';
        nameErrorMsg.style.cssText = `
            color: #f55;
            font-size: 11px;
            margin-top: 2px;
            min-height: 14px;
        `;
        
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        nameGroup.appendChild(nameErrorMsg);
        
        return nameGroup;
    }

    /**
     * Creates the dimensions row (width + height)
     * @returns {HTMLElement} Dimensions row
     */
    createDimensionsRow() {
        const dimensionsRow = document.createElement('div');
        dimensionsRow.style.cssText = 'display: flex; gap: 6px;';

        // Width input
        const widthGroup = this.createDimensionInput('Width', 'quick-width-input', 'width-error-msg', 
            this.parentDialog.editingPresetData ? this.parentDialog.editingPresetData.width : '');
        dimensionsRow.appendChild(widthGroup);

        // Height input
        const heightGroup = this.createDimensionInput('Height', 'quick-height-input', 'height-error-msg',
            this.parentDialog.editingPresetData ? this.parentDialog.editingPresetData.height : '');
        dimensionsRow.appendChild(heightGroup);

        return dimensionsRow;
    }

    /**
     * Creates a dimension input group (width or height)
     */
    createDimensionInput(label, inputId, errorId, value) {
        const group = document.createElement('div');
        group.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = 'color: #ccc; font-size: 11px; font-weight: bold;';
        
        const input = document.createElement('input');
        input.id = inputId;
        input.type = 'number';
        input.placeholder = '512';
        input.min = '64';
        input.step = '1';
        input.value = value;
        input.style.cssText = `
            padding: 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 13px;
            outline: none;
        `;
        
        const errorMsg = document.createElement('div');
        errorMsg.id = errorId;
        errorMsg.style.cssText = `
            color: #f55;
            font-size: 11px;
            margin-top: 2px;
            min-height: 14px;
        `;
        
        group.appendChild(labelEl);
        group.appendChild(input);
        group.appendChild(errorMsg);
        
        return group;
    }

    /**
     * Creates the preview container
     * @returns {HTMLElement} Preview container
     */
    createPreviewContainer() {
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            margin-top: 6px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid #444;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
        `;

        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'Preview:';
        const labelColor = this.parentDialog.editingPresetData ? '#5f5' : '#5af';
        previewLabel.style.cssText = `color: ${labelColor}; font-size: 11px; font-weight: bold;`;

        const previewCanvas = document.createElement('div');
        previewCanvas.id = 'preview-canvas';
        previewCanvas.style.cssText = `
            width: 160px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `;

        const previewShape = document.createElement('div');
        previewShape.id = 'preview-shape';
        previewShape.style.cssText = `
            border: 2px solid #5af;
            background: rgba(90, 170, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;

        const previewText = document.createElement('div');
        previewText.id = 'preview-text';
        previewText.style.cssText = `
            color: #5af;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            line-height: 1.4;
        `;

        previewShape.appendChild(previewText);
        previewCanvas.appendChild(previewShape);
        previewContainer.appendChild(previewLabel);
        previewContainer.appendChild(previewCanvas);

        // Set up event listeners after adding to DOM
        setTimeout(() => this.setupFormValidation(), 0);

        return previewContainer;
    }

    /**
     * Sets up form validation and preview updates
     */
    setupFormValidation() {
        const nameInput = document.getElementById('quick-name-input');
        const widthInput = document.getElementById('quick-width-input');
        const heightInput = document.getElementById('quick-height-input');
        
        if (!nameInput || !widthInput || !heightInput) return;

        // Function to update preview shape
        const updatePreviewShape = () => {
            const width = parseInt(widthInput.value) || 0;
            const height = parseInt(heightInput.value) || 0;
            const previewShape = document.getElementById('preview-shape');
            const previewText = document.getElementById('preview-text');
            const previewCanvas = document.getElementById('preview-canvas');
            
            if (!previewShape || !previewText) return;
            
            if (width > 0 && height > 0) {
                const maxWidth = 145;
                const maxHeight = 105;
                const scale = Math.min(maxWidth / width, maxHeight / height);
                
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                previewShape.style.width = `${scaledWidth}px`;
                previewShape.style.height = `${scaledHeight}px`;
                
                const isEditMode = this.parentDialog.editingPresetData !== null;
                const borderColor = isEditMode ? '#5f5' : '#5af';
                const bgColor = isEditMode ? 'rgba(80, 255, 80, 0.1)' : 'rgba(90, 170, 255, 0.1)';
                const textColor = isEditMode ? '#5f5' : '#5af';
                
                previewShape.style.border = `2px solid ${borderColor}`;
                previewShape.style.background = bgColor;
                
                const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                const divisor = gcd(width, height);
                const ratioW = width / divisor;
                const ratioH = height / divisor;
                
                previewText.innerHTML = `
                    <div style="color: ${textColor};">${width}×${height}</div>
                    <div style="font-size: 10px; color: #888;">${ratioW}:${ratioH}</div>
                `;
                
                if (previewCanvas.parentElement) {
                    previewCanvas.parentElement.style.display = 'flex';
                }
            } else {
                if (previewCanvas.parentElement) {
                    previewCanvas.parentElement.style.display = 'none';
                }
            }
        };

        // Validation function
        const validateForm = () => {
            const nameErrorMsg = document.getElementById('name-error-msg');
            const widthErrorMsg = document.getElementById('width-error-msg');
            const heightErrorMsg = document.getElementById('height-error-msg');
            const addButton = document.getElementById('quick-add-button');
            
            if (!nameErrorMsg || !widthErrorMsg || !heightErrorMsg || !addButton) return;
            
            const enteredName = nameInput.value.trim();
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            let isValid = true;
            
            // Reset all borders and error messages
            nameInput.style.borderColor = '#555';
            widthInput.style.borderColor = '#555';
            heightInput.style.borderColor = '#555';
            nameErrorMsg.textContent = '';
            widthErrorMsg.textContent = '';
            heightErrorMsg.textContent = '';
            
            // Check if name is empty
            if (!enteredName) {
                nameInput.style.borderColor = '#f55';
                nameErrorMsg.textContent = '⚠️ Name is required';
                isValid = false;
            } else {
                const customPresets = this.parentDialog.manager.getCustomPresets();
                const categoryPresets = customPresets[this.parentDialog.selectedCategory] || {};
                const nameExists = Object.keys(categoryPresets).includes(enteredName);
                
                if (this.parentDialog.editingPresetName) {
                    if (enteredName !== this.parentDialog.editingPresetName && nameExists) {
                        nameInput.style.borderColor = '#f55';
                        nameErrorMsg.textContent = `⚠️ Preset "${enteredName}" already exists`;
                        isValid = false;
                    }
                } else {
                    if (nameExists) {
                        nameInput.style.borderColor = '#f55';
                        nameErrorMsg.textContent = `⚠️ Preset "${enteredName}" already exists`;
                        isValid = false;
                    }
                }
            }
            
            // Check width
            if (!width || width < 64) {
                widthInput.style.borderColor = '#f55';
                widthErrorMsg.textContent = '⚠️ Width must be at least 64px';
                isValid = false;
            }
            
            // Check height
            if (!height || height < 64) {
                heightInput.style.borderColor = '#f55';
                heightErrorMsg.textContent = '⚠️ Height must be at least 64px';
                isValid = false;
            }
            
            // Update button state
            if (isValid) {
                addButton.disabled = false;
                addButton.style.background = '#5af';
                addButton.style.color = '#000';
                addButton.style.cursor = 'pointer';
                addButton.style.opacity = '1';
            } else {
                addButton.disabled = true;
                addButton.style.background = '#666';
                addButton.style.color = '#999';
                addButton.style.cursor = 'not-allowed';
                addButton.style.opacity = '0.5';
            }
        };
        
        // Add event listeners
        nameInput.addEventListener('input', validateForm);
        widthInput.addEventListener('input', () => {
            validateForm();
            updatePreviewShape();
        });
        heightInput.addEventListener('input', () => {
            validateForm();
            updatePreviewShape();
        });

        // Initial validation and preview
        validateForm();
        updatePreviewShape();
    }

    /**
     * Creates the button container (add/OK and cancel buttons)
     * @returns {HTMLElement} Button container
     */
    createButtonContainer() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; flex-direction: row; gap: 4px;';

        const isEditMode = this.parentDialog.editingPresetData !== null;
        
        // Add/OK button
        const addButton = document.createElement('button');
        addButton.id = 'quick-add-button';
        addButton.textContent = isEditMode ? 'OK' : '+';
        addButton.title = isEditMode ? 'Save changes' : 'Add preset';
        const buttonFontSize = isEditMode ? '14px' : '20px';
        
        addButton.style.cssText = `
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: #5af;
            color: #000;
            font-size: ${buttonFontSize};
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;
        addButton.addEventListener('click', () => this.parentDialog.quickAddPreset());
        addButton.addEventListener('mouseenter', () => {
            if (!addButton.disabled) {
                addButton.style.background = '#7cf';
            }
        });
        addButton.addEventListener('mouseleave', () => {
            if (!addButton.disabled) {
                addButton.style.background = '#5af';
            }
        });
        buttonContainer.appendChild(addButton);

        // Cancel button (only visible when editing)
        if (this.parentDialog.editingPresetName) {
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '✕';
            cancelButton.title = 'Cancel editing';
            cancelButton.style.cssText = `
                padding: 4px 12px;
                border: 1px solid #666;
                border-radius: 4px;
                background: rgba(255,255,255,0.1);
                color: #ddd;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            `;
            cancelButton.addEventListener('click', () => this.parentDialog.cancelEdit());
            cancelButton.addEventListener('mouseenter', () => {
                cancelButton.style.background = 'rgba(255,255,255,0.2)';
                cancelButton.style.borderColor = '#888';
            });
            cancelButton.addEventListener('mouseleave', () => {
                cancelButton.style.background = 'rgba(255,255,255,0.1)';
                cancelButton.style.borderColor = '#666';
            });
            buttonContainer.appendChild(cancelButton);
        }

        return buttonContainer;
    }

    /**
     * Renders the preset preview section
     * @param {HTMLElement} container - Container to render into
     */
    renderPresetPreview(container) {
        this.parentDialog.presetPreviewContainer = document.createElement('div');
        this.parentDialog.presetPreviewContainer.id = 'preset-preview';
        this.parentDialog.presetPreviewContainer.style.cssText = `
            margin-top: 12px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid #444;
            border-radius: 6px;
            max-height: 550px;
            display: flex;
            flex-direction: column;
        `;

        const previewTitle = document.createElement('div');
        previewTitle.textContent = `Presets in "${this.parentDialog.selectedCategory}"`;
        previewTitle.style.cssText = `
            color: #5af;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid #444;
        `;
        this.parentDialog.presetPreviewContainer.appendChild(previewTitle);

        const presetsGrid = document.createElement('div');
        presetsGrid.id = 'presets-grid';
        presetsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 8px;
        `;
        this.parentDialog.presetPreviewContainer.appendChild(presetsGrid);
        
        // Store reference
        this.parentDialog.presetsGrid = presetsGrid;

        container.appendChild(this.parentDialog.presetPreviewContainer);

        // Update preview
        this.parentDialog.updatePresetPreview();
    }

    /**
     * Creates a column for one aspect ratio (using unified AspectRatioUtils method)
     * @param {string} ratio - Aspect ratio string
     * @param {Array} presetList - List of presets for this ratio
     * @returns {HTMLElement} Column element
     */
    createRatioColumn(ratio, presetList) {
        // Use unified method from AspectRatioUtils with custom preset item renderer
        return AspectRatioUtils.createPresetColumn(ratio, presetList, {
            renderPresetItem: (preset) => this.createPresetItemForColumn(preset)
        });
    }

    /**
     * Creates a preset item for the column view
     */
    createPresetItemForColumn(preset) {
        const presetItem = document.createElement('div');
        presetItem.className = 'aspect-ratio-preset-item aspect-ratio-preset-item-column' + (preset.isHidden ? ' hidden' : '');

        // Preset name with custom icon if applicable
        const nameDiv = document.createElement('div');
        nameDiv.className = 'aspect-ratio-preset-item-name';
        const customIcon = preset.isCustom && this.parentDialog.customPresetIcon ? 
            `<img src="${this.parentDialog.customPresetIcon.src}" class="aspect-ratio-preset-custom-icon">` : '';
        nameDiv.innerHTML = `${preset.name}${customIcon}`;
        
        // Dimensions below name
        const dimensionsDiv = document.createElement('div');
        dimensionsDiv.className = 'aspect-ratio-preset-item-dims';
        dimensionsDiv.textContent = `${preset.width}×${preset.height}`;

        // Action button
        if (preset.isCustom) {
            const deleteBtn = this.createDeleteButton(preset);
            presetItem.appendChild(deleteBtn);
        } else {
            const toggleBtn = this.createToggleButton(preset);
            presetItem.appendChild(toggleBtn);
        }

        presetItem.appendChild(nameDiv);
        presetItem.appendChild(dimensionsDiv);

        // Click to load preset values into quick add form
        presetItem.addEventListener('click', () => {
            if (preset.isCustom) {
                this.parentDialog.editingPresetName = preset.name;
                this.parentDialog.editingPresetData = {
                    name: preset.name,
                    width: preset.width,
                    height: preset.height
                };
            } else {
                this.parentDialog.editingPresetName = null;
                this.parentDialog.editingPresetData = {
                    name: preset.name,
                    width: preset.width,
                    height: preset.height
                };
            }
            
            this.parentDialog.renderDialog();
        });

        return presetItem;
    }

    /**
     * Creates delete button for custom preset
     */
    createDeleteButton(preset) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'aspect-ratio-preset-action-btn delete';
        deleteBtn.title = 'Delete preset';
        
        if (this.parentDialog.deleteIcon) {
            deleteBtn.innerHTML = `<img src="${this.parentDialog.deleteIcon.src}" class="aspect-ratio-preset-action-icon">`;
        } else {
            deleteBtn.textContent = '🗑️';
        }

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete custom preset "${preset.name}"?`)) {
                this.parentDialog.manager.deletePreset(this.parentDialog.selectedCategory, preset.name);
                this.parentDialog.updatePresetPreview();
            }
        });
        
        return deleteBtn;
    }

    /**
     * Creates toggle button for built-in preset
     */
    createToggleButton(preset) {
        const isHidden = this.parentDialog.manager.isBuiltInPresetHidden(this.parentDialog.selectedCategory, preset.name);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'aspect-ratio-preset-action-btn' + (isHidden ? ' unhide' : ' hide');
        toggleBtn.title = isHidden ? 'Unhide preset' : 'Hide preset';
        
        if (this.parentDialog.deleteIcon) {
            toggleBtn.innerHTML = `<img src="${this.parentDialog.deleteIcon.src}" class="aspect-ratio-preset-action-icon">`;
        } else {
            toggleBtn.textContent = '🗑️';
        }

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.parentDialog.manager.toggleBuiltInPresetVisibility(this.parentDialog.selectedCategory, preset.name);
            this.parentDialog.updatePresetPreview();
        });
        
        return toggleBtn;
    }
}
