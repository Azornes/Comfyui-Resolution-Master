/**
 * PresetManagerDialog.js
 * Main dialog coordinator for managing custom presets
 */

// Load CSS styles
import "../css-loader.js";

import { createModuleLogger } from "./LoggerUtils.js";
import { SearchableDropdown } from "../SearchableDropdown.js";
import { AspectRatioUtils } from "./AspectRatioUtils.js";
import { loadIcons, getIconHtml } from "./IconUtils.js";
import { presetManagerTooltips } from "./ResolutionMasterConfig.js";
import { PresetUIComponents } from './preset-manager/PresetUIComponents.js';
import { DragDropHandler } from './preset-manager/DragDropHandler.js';
import { RenameDialogManager } from './preset-manager/RenameDialogManager.js';
import { JSONEditorDialog } from './preset-manager/JSONEditorDialog.js';
import { PresetListRenderer } from './preset-manager/PresetListRenderer.js';
import { PresetAddViewRenderer } from './preset-manager/PresetAddViewRenderer.js';
import { TooltipManager } from './preset-manager/TooltipManager.js';

// Import Prism.js for syntax highlighting (global object)
const prismScriptLoaded = await import('../lib/prism.js');

const log = createModuleLogger('PresetManagerDialog');

export class PresetManagerDialog {
    constructor(customPresetsManager) {
        this.manager = customPresetsManager;
        this.dialog = null;
        this.currentView = 'list'; // 'list' or 'add'
        this.editingPresetId = null;
        this.editingCategoryId = null;
        this.quickAddShape = 'landscape';
        this.quickAddCategory = null;
        this.columnMode = 'aspect_ratio'; // or 'simple'
        this.selectedPresets = new Set(); // For multi-selection with Shift
        this.lastSelectedIndex = -1; // For Shift-click range selection
        this.selectedBulkCategory = null;
        
        // Dialog state
        this.isActive = false;
        this.container = null;
        this.overlay = null;
        
        // Bulk deletion
        this.selectedPresetsForDeletion = new Set();
        this.lastClickedPresetKey = null;
        
        // Add/Edit view state
        this.selectedCategory = null;
        this.editingPresetName = null;
        this.editingPresetData = null;
        this.presetsGrid = null;
        this.presetPreviewContainer = null;
        this.presetPreviewResizeHandler = null;
        
        // SearchableDropdown instance
        this.searchableDropdown = new SearchableDropdown();
        
        // Icons container
        const iconContainer = {};
        
        // Load icons into container
        loadIcons(iconContainer, "#ffffffff");
        
        // Assign icons to properties with correct names
        this.deleteIcon = iconContainer.delete;
        this.importIcon = iconContainer.import;
        this.exportIcon = iconContainer.export;
        this.editIcon = iconContainer.edit;
        this.customPresetIcon = iconContainer.customPreset;
        
        // Initialize helper modules
        this.uiComponents = new PresetUIComponents(this);
        this.dragDropHandler = new DragDropHandler(this);
        this.renameDialogManager = new RenameDialogManager(this);
        this.jsonEditor = new JSONEditorDialog(this);
        this.listRenderer = new PresetListRenderer(this);
        this.addViewRenderer = new PresetAddViewRenderer(this);
        
        // Initialize tooltip manager
        this.tooltipManager = new TooltipManager({
            delay: 500,
            maxWidth: 300
        });
        
        // Register tooltips for common elements
        this.registerTooltips();
    }

    /**
     * Registers all tooltips for the dialog
     */
    registerTooltips() {
        // Use tooltips from ResolutionMasterConfig.js
        this.tooltipManager.registerTooltips(presetManagerTooltips);
    }

    /**
     * Attaches tooltips to rendered elements
     */
    attachTooltips() {
        // Attach tooltips to footer buttons
        const footerButtons = this.container.querySelectorAll('.preset-manager-footer button');
        footerButtons.forEach(btn => {
            if (btn.id) {
                this.tooltipManager.attach(btn);
            }
        });
        
        // Attach tooltips to action buttons in list view
        const editButtons = this.container.querySelectorAll('.preset-list-edit-btn, .preset-add-rename-category-btn');
        editButtons.forEach(btn => {
            this.tooltipManager.attach(btn, 'Edit this item');
        });
        
        const deleteButtons = this.container.querySelectorAll('.aspect-ratio-preset-action-btn.delete');
        deleteButtons.forEach(btn => {
            this.tooltipManager.attach(btn, 'Delete this custom preset');
        });
        
        const toggleButtons = this.container.querySelectorAll('.aspect-ratio-preset-action-btn.hide');
        toggleButtons.forEach(btn => {
            this.tooltipManager.attach(btn, 'Hide this built-in preset from the main selector');
        });
        
        const unhideButtons = this.container.querySelectorAll('.aspect-ratio-preset-action-btn.unhide');
        unhideButtons.forEach(btn => {
            this.tooltipManager.attach(btn, 'Show this hidden preset in the main selector');
        });
        
        // Attach to category headers
        const categoryHeaders = this.container.querySelectorAll('.preset-list-category-header');
        categoryHeaders.forEach(header => {
            this.tooltipManager.attach(header, 'Double-click to rename, drag to reorder this category');
        });
        
        // Attach to preset names
        const presetNames = this.container.querySelectorAll('.preset-list-name');
        presetNames.forEach(name => {
            this.tooltipManager.attach(name, 'Double-click to rename this preset');
        });
        
        // Attach to checkboxes
        const checkboxes = this.container.querySelectorAll('.preset-list-checkbox');
        checkboxes.forEach(cb => {
            this.tooltipManager.attach(cb, 'Select for bulk deletion (use Shift+Click to select a range)');
        });
        
        // Attach to category select button in add view
        const categoryBtn = this.container.querySelector('#category-select-btn');
        if (categoryBtn) {
            this.tooltipManager.attach(categoryBtn, 'Select or create a category for your presets');
        }
        
        // Attach to rename category button in add view
        const renameCategoryBtn = this.container.querySelector('.preset-add-rename-category-btn');
        if (renameCategoryBtn) {
            this.tooltipManager.attach(renameCategoryBtn, 'Rename this category');
        }
        
        // Attach to quick add button
        const quickAddBtn = this.container.querySelector('#quick-add-button');
        if (quickAddBtn) {
            const isEditing = this.editingPresetName !== null;
            this.tooltipManager.attach(quickAddBtn, isEditing ? 'Save changes to this preset' : 'Add this preset to the selected category');
        }
    }

    /**
     * Shows the preset manager dialog
     */
    show() {
        if (this.isActive) return;

        this.isActive = true;
        this.currentView = 'list';
        this.editingPreset = null;
        this.selectedPresetsForDeletion.clear(); // Clear selection when opening dialog
        this.lastClickedPresetKey = null; // Reset last clicked for shift-click

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'preset-manager-overlay';
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) this.hide();
        });
        document.body.appendChild(this.overlay);

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'preset-manager-dialog';
        document.body.appendChild(this.container);

        this.renderDialog();
    }

    /**
     * Renders the dialog content based on current view
     */
    renderDialog() {
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'preset-manager-header';

        const title = document.createElement('div');
        title.className = 'preset-manager-title';
        title.textContent = '⚙ Custom Presets Manager';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'preset-manager-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.hide());

        header.appendChild(title);
        header.appendChild(closeBtn);
        this.container.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.className = 'preset-manager-content';

        if (this.currentView === 'list') {
            this.listRenderer.render(content);
        } else if (this.currentView === 'add') {
            this.addViewRenderer.render(content);
        }

        this.container.appendChild(content);

        // Footer with action buttons
        this.renderFooter();
        
        // Attach tooltips to rendered elements
        this.attachTooltips();
    }

    /**
     * Renders the footer with action buttons
     */
    renderFooter() {
        const footer = document.createElement('div');
        footer.className = 'preset-manager-footer';

        // Left side buttons
        const leftButtons = document.createElement('div');
        leftButtons.className = 'preset-manager-footer-left';

        if (this.currentView === 'list') {
            const addBtn = PresetUIComponents.createFooterButton('➕ Add Preset', 'primary', () => {
                this.currentView = 'add';
                this.editingPreset = null;
                this.renderDialog();
            });
            leftButtons.appendChild(addBtn);

            // Delete selected button (only shown when there are selected items)
            const selectedCount = this.selectedPresetsForDeletion.size;
            const deleteIconHtml = this.deleteIcon ? `<img src="${this.deleteIcon.src}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">` : '🗑️ ';
            const btnText = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
            const deleteSelectedBtn = PresetUIComponents.createFooterButton(deleteIconHtml + btnText, 'secondary', () => {
                this.deleteSelectedPresets();
            });
            deleteSelectedBtn.id = 'delete-selected-btn';
            
            // Apply danger styling when items are selected
            if (selectedCount > 0) {
                deleteSelectedBtn.style.background = '#f55';
                deleteSelectedBtn.style.color = '#fff';
                deleteSelectedBtn.style.opacity = '1';
                deleteSelectedBtn.style.borderColor = '#f55';
            } else {
                deleteSelectedBtn.disabled = true;
                deleteSelectedBtn.style.opacity = '0.5';
                deleteSelectedBtn.style.cursor = 'not-allowed';
            }
            
            // Add hover effects for danger state
            deleteSelectedBtn.addEventListener('mouseenter', () => {
                if (selectedCount > 0) {
                    deleteSelectedBtn.style.background = '#f77';
                    deleteSelectedBtn.style.borderColor = '#f77';
                }
            });
            deleteSelectedBtn.addEventListener('mouseleave', () => {
                if (selectedCount > 0) {
                    deleteSelectedBtn.style.background = '#f55';
                    deleteSelectedBtn.style.borderColor = '#f55';
                }
            });
            
            leftButtons.appendChild(deleteSelectedBtn);

            const importIconHtml = getIconHtml(this.importIcon, '📥', 18, 'vertical-align: middle; margin-right: 4px;');
            const importBtn = PresetUIComponents.createFooterButton(importIconHtml + ' Import', 'secondary', () => {
                this.importPresets();
            });
            leftButtons.appendChild(importBtn);

            const exportIconHtml = getIconHtml(this.exportIcon, '📤', 18, 'vertical-align: middle; margin-right: 4px;');
            const exportBtn = PresetUIComponents.createFooterButton(exportIconHtml + ' Export', 'secondary', () => {
                this.exportPresets();
            });
            leftButtons.appendChild(exportBtn);

            const editJsonBtn = PresetUIComponents.createFooterButton('{ } Edit JSON', 'secondary', () => {
                this.showJSONEditor();
            });
            leftButtons.appendChild(editJsonBtn);
        } else if (this.currentView === 'add') {
            const backBtn = PresetUIComponents.createFooterButton('← Back to List', 'secondary', () => {
                // Close SearchableDropdown if it's open
                if (this.searchableDropdown) {
                    this.searchableDropdown.hide();
                }
                
                this.currentView = 'list';
                this.editingPreset = null;
                this.selectedCategory = null; // Reset selected category
                this.renderDialog();
            });
            leftButtons.appendChild(backBtn);
        }

        footer.appendChild(leftButtons);
        this.container.appendChild(footer);
    }

    /**
     * Edits an existing preset
     */
    editPreset(category, name, dims) {
        // Use new editing system
        this.selectedCategory = category;
        this.editingPresetName = name;
        this.editingPresetData = {
            name: name,
            width: dims.width,
            height: dims.height
        };
        this.currentView = 'add';
        this.renderDialog();
    }

    /**
     * Deletes a preset after confirmation
     */
    deletePreset(category, name) {
        if (confirm(`Delete preset "${name}" from category "${category}"?`)) {
            this.manager.deletePreset(category, name);
            this.renderDialog(); // Refresh view
            log.debug(`Deleted preset: ${category}/${name}`);
        }
    }

    /**
     * Saves the preset (add or edit)
     */
    savePreset() {
        const categoryInput = document.getElementById('category-input');
        const nameInput = document.getElementById('name-input');
        const widthInput = document.getElementById('width-input');
        const heightInput = document.getElementById('height-input');
        const validationMsg = document.getElementById('validation-msg');

        const category = categoryInput.value.trim();
        const name = nameInput.value.trim();
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        // Validation
        if (!category) {
            validationMsg.textContent = 'Category is required';
            categoryInput.focus();
            return;
        }

        if (!name) {
            validationMsg.textContent = 'Preset name is required';
            nameInput.focus();
            return;
        }

        if (!width || width < 64) {
            validationMsg.textContent = 'Width must be at least 64px';
            widthInput.focus();
            return;
        }

        if (!height || height < 64) {
            validationMsg.textContent = 'Height must be at least 64px';
            heightInput.focus();
            return;
        }

        // If editing, delete the old preset first (in case category or name changed)
        if (this.editingPreset) {
            this.manager.deletePreset(this.editingPreset.category, this.editingPreset.name);
        }

        // Add/update preset
        this.manager.addPreset(category, name, width, height);

        log.debug(`Saved preset: ${category}/${name} (${width}×${height})`);

        // Return to list view
        this.currentView = 'list';
        this.editingPreset = null;
        this.renderDialog();
    }

    /**
     * Imports presets from JSON
     */
    importPresets() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    // Use importFromJSON which expects a JSON string and merge=true
                    const success = this.manager.importFromJSON(event.target.result, true);
                    if (success) {
                        this.renderDialog(); // Refresh view
                        log.debug('Presets imported successfully');
                        alert('Presets imported successfully!');
                    } else {
                        throw new Error('Import failed');
                    }
                } catch (error) {
                    alert('Error importing presets: ' + error.message);
                    log.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        });

        input.click();
    }

    /**
     * Exports presets to JSON file
     */
    exportPresets() {
        const json = this.manager.exportToJSON();

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'custom-presets.json';
        a.click();

        URL.revokeObjectURL(url);
        log.debug('Presets exported');
    }

    /**
     * Shows the category dropdown for selection
     */
    showCategoryDropdown(event) {
        // Get ALL categories (built-in + custom)
        const builtInPresets = this.manager.rm.presetCategories; // Access built-in presets
        const mergedPresets = this.manager.getMergedPresets(builtInPresets);
        
        // Create category objects with isCustom flag
        const categoryObjects = Object.keys(mergedPresets).map(categoryName => {
            // A category is truly custom if it does NOT exist in built-in categories
            const isTrulyCustom = !builtInPresets.hasOwnProperty(categoryName);
            return {
                text: categoryName,
                isCustom: isTrulyCustom
            };
        });
        
        this.searchableDropdown.show(categoryObjects, {
            event: event,
            title: 'Select or Create Category',
            allowCustomValues: true,
            callback: (selectedCategory) => {
                this.selectedCategory = selectedCategory;
                this.editingPresetName = null; // Reset editing mode when category changes
                this.editingPresetData = null; // Reset editing data
                // Update button text and re-render to show quick add form and preview
                const categoryBtn = document.getElementById('category-select-btn');
                if (categoryBtn) {
                    categoryBtn.textContent = selectedCategory;
                    categoryBtn.style.color = '#fff';
                }
                // Re-render the add view to show quick add form and preview
                this.renderDialog();
            }
        });
    }

    /**
     * Updates the preset preview for the selected category (using AspectRatioSelector style columns)
     * Shows ALL presets (built-in + custom) for the selected category
     */
    updatePresetPreview() {
        // Use stored reference instead of getElementById (element may not be in DOM yet)
        const presetsGrid = this.presetsGrid;
        if (!presetsGrid || !this.selectedCategory) return;

        presetsGrid.innerHTML = '';
        
        // Change to flex layout for columns (matching AspectRatioSelector structure)
        presetsGrid.style.cssText = `
            display: flex;
            gap: 4px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 4px;
            flex: 1;
        `;

        // Get ALL presets (built-in + custom) for this category
        const builtInPresets = this.manager.rm.presetCategories;
        const mergedPresets = this.manager.getMergedPresets(builtInPresets);
        const categoryPresets = mergedPresets[this.selectedCategory] || {};

        if (Object.keys(categoryPresets).length === 0) {
            presetsGrid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            `;
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No presets in this category yet. Add some above!';
            emptyMsg.style.cssText = `
                grid-column: 1 / -1;
                text-align: center;
                padding: 20px;
                color: #888;
                font-size: 13px;
            `;
            presetsGrid.appendChild(emptyMsg);
            return;
        }

        // Group presets by aspect ratio
        const groupedPresets = AspectRatioUtils.groupPresetsByAspectRatio(categoryPresets);

        // Add custom scrollbar styling for better visibility (matching AspectRatioSelector)
        if (!document.getElementById('presets-grid-scrollbar-style')) {
            const style = document.createElement('style');
            style.id = 'presets-grid-scrollbar-style';
            style.textContent = `
                #presets-grid::-webkit-scrollbar {
                    height: 12px;
                    width: 12px;
                }
                #presets-grid::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 4px;
                }
                #presets-grid::-webkit-scrollbar-thumb {
                    background: #666;
                    border-radius: 6px;
                    border: 2px solid rgba(0, 0, 0, 0.3);
                }
                #presets-grid::-webkit-scrollbar-thumb:hover {
                    background: #888;
                }
            `;
            document.head.appendChild(style);
        }

        // Create a column for each aspect ratio
        const columns = [];
        for (const [ratio, presetList] of Object.entries(groupedPresets)) {
            const column = this.addViewRenderer.createRatioColumn(ratio, presetList);
            presetsGrid.appendChild(column);
            columns.push(column);
        }

        // Remove previous resize handler if it exists
        if (this.presetPreviewResizeHandler) {
            window.removeEventListener('resize', this.presetPreviewResizeHandler);
            this.presetPreviewResizeHandler = null;
        }

        // Update scroll indicators after DOM renders (using setTimeout to ensure layout is complete)
        setTimeout(() => {
            // Update column scroll indicators
            AspectRatioUtils.updateColumnScrollIndicators(columns);
            
            // Add horizontal scroll indicator
            const horizontalScrollState = { indicator: null };
            const updateHorizontalScrollIndicator = AspectRatioUtils.createHorizontalScrollManager(
                presetsGrid,
                this.presetPreviewContainer,
                horizontalScrollState
            );
            updateHorizontalScrollIndicator();

            // Add resize listener to update indicators dynamically (matching AspectRatioSelector)
            this.presetPreviewResizeHandler = () => {
                updateHorizontalScrollIndicator();
                AspectRatioUtils.updateColumnScrollIndicators(columns);
            };
            window.addEventListener('resize', this.presetPreviewResizeHandler);
        }, 0);
    }

    /**
     * Cancels the current edit operation
     */
    cancelEdit() {
        // Clear editing mode
        this.editingPresetName = null;
        this.editingPresetData = null;

        // Re-render to hide cancel button and clear form
        this.renderDialog();
    }

    /**
     * Quickly adds a preset from the inline form
     */
    quickAddPreset() {
        const nameInput = document.getElementById('quick-name-input');
        const widthInput = document.getElementById('quick-width-input');
        const heightInput = document.getElementById('quick-height-input');
        const validationMsg = document.getElementById('validation-msg');
        const quickAddTitle = document.getElementById('quick-add-title');

        if (!this.selectedCategory) {
            validationMsg.textContent = 'Please select a category first';
            return;
        }

        const name = nameInput.value.trim();
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        // Validation
        if (!name) {
            validationMsg.textContent = 'Preset name is required';
            nameInput.focus();
            return;
        }

        if (!width || width < 64) {
            validationMsg.textContent = 'Width must be at least 64px';
            widthInput.focus();
            return;
        }

        if (!height || height < 64) {
            validationMsg.textContent = 'Height must be at least 64px';
            heightInput.focus();
            return;
        }

        // If editing, use updatePreset to preserve position
        if (this.editingPresetName) {
            const success = this.manager.updatePreset(
                this.selectedCategory, 
                this.editingPresetName, 
                name, 
                width, 
                height
            );
            
            if (!success) {
                validationMsg.textContent = 'Failed to update preset. It may already exist.';
                return;
            }
            
            log.debug(`Updated preset: ${this.selectedCategory}/${this.editingPresetName} -> ${name} (${width}×${height})`);
        } else {
            // Add new preset
            this.manager.addPreset(this.selectedCategory, name, width, height);
            log.debug(`Added preset: ${this.selectedCategory}/${name} (${width}×${height})`);
        }

        // Clear editing mode
        this.editingPresetName = null;
        this.editingPresetData = null;

        // Clear form
        nameInput.value = '';
        widthInput.value = '';
        heightInput.value = '';
        validationMsg.textContent = '';

        // Update preview and re-render to hide cancel button
        this.updatePresetPreview();
        
        // Re-render to hide cancel button
        this.renderDialog();
    }

    /**
     * Handles shift-click range selection of checkboxes
     */
    handleShiftClickSelection(currentKey, checked) {
        // Get all checkboxes in DOM order
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-preset-key]'));
        
        // Find indices
        const lastIndex = allCheckboxes.findIndex(cb => cb.dataset.presetKey === this.lastClickedPresetKey);
        const currentIndex = allCheckboxes.findIndex(cb => cb.dataset.presetKey === currentKey);
        
        if (lastIndex === -1 || currentIndex === -1) {
            // Fallback to normal behavior
            if (checked) {
                this.selectedPresetsForDeletion.add(currentKey);
            } else {
                this.selectedPresetsForDeletion.delete(currentKey);
            }
            this.lastClickedPresetKey = currentKey;
            return;
        }
        
        // Select/deselect range
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        for (let i = start; i <= end; i++) {
            const cb = allCheckboxes[i];
            const key = cb.dataset.presetKey;
            
            if (checked) {
                this.selectedPresetsForDeletion.add(key);
                cb.checked = true;
            } else {
                this.selectedPresetsForDeletion.delete(key);
                cb.checked = false;
            }
        }
        
        this.lastClickedPresetKey = currentKey;
    }

    /**
     * Updates the delete selected button state
     */
    updateDeleteSelectedButton() {
        const deleteBtn = document.getElementById('delete-selected-btn');
        if (!deleteBtn) return;

        const selectedCount = this.selectedPresetsForDeletion.size;
        const deleteIconHtml = this.deleteIcon ? `<img src="${this.deleteIcon.src}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">` : '🗑️ ';
        const btnText = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
        deleteBtn.innerHTML = deleteIconHtml + btnText;
        deleteBtn.disabled = selectedCount === 0;
        deleteBtn.style.background = selectedCount > 0 ? '#f55' : '#666';
        deleteBtn.style.color = selectedCount > 0 ? '#fff' : '#999';
        deleteBtn.style.opacity = selectedCount > 0 ? '1' : '0.5';
        deleteBtn.style.cursor = selectedCount > 0 ? 'pointer' : 'not-allowed';
    }

    /**
     * Deletes all selected presets after confirmation
     */
    deleteSelectedPresets() {
        const selectedCount = this.selectedPresetsForDeletion.size;
        if (selectedCount === 0) return;

        if (confirm(`Delete ${selectedCount} selected preset(s)?`)) {
            // Delete all selected presets
            this.selectedPresetsForDeletion.forEach(presetKey => {
                const [category, name] = presetKey.split('|');
                this.manager.deletePreset(category, name);
                log.debug(`Deleted preset: ${category}/${name}`);
            });

            // Clear selection and refresh view
            this.selectedPresetsForDeletion.clear();
            this.renderDialog();
        }
    }

    /**
     * Shows a dialog to rename the category (delegated to RenameDialogManager)
     */
    showRenameCategoryDialog(currentCategoryName) {
        this.renameDialogManager.showRenameCategoryDialog(currentCategoryName);
    }

    /**
     * Starts renaming a category (delegated to RenameDialogManager)
     */
    startRenamingCategory(titleElement, categoryName) {
        this.renameDialogManager.startRenamingCategory(titleElement, categoryName);
    }

    /**
     * Starts renaming a preset (delegated to RenameDialogManager)
     */
    startRenamingPreset(nameElement, category, presetName, dims) {
        this.renameDialogManager.startRenamingPreset(nameElement, category, presetName, dims);
    }

    /**
     * Shows JSON editor dialog (delegated to JSONEditorDialog)
     */
    showJSONEditor() {
        this.jsonEditor.show();
    }

    /**
     * Hides and cleans up the dialog
     */
    hide() {
        // Remove resize event listener if it exists
        if (this.presetPreviewResizeHandler) {
            window.removeEventListener('resize', this.presetPreviewResizeHandler);
            this.presetPreviewResizeHandler = null;
        }

        // Close SearchableDropdown if it's open
        if (this.searchableDropdown) {
            this.searchableDropdown.hide();
        }
        
        // Clean up tooltips
        if (this.tooltipManager) {
            this.tooltipManager.destroy();
            // Recreate for next use
            this.tooltipManager = new TooltipManager({
                delay: 500,
                maxWidth: 300
            });
            this.registerTooltips();
        }

        if (this.container && this.container.parentNode) {
            document.body.removeChild(this.container);
        }
        if (this.overlay && this.overlay.parentNode) {
            document.body.removeChild(this.overlay);
        }

        this.container = null;
        this.overlay = null;
        this.isActive = false;
        this.currentView = 'list';
        this.editingPreset = null;
        this.selectedPresetsForDeletion.clear();
        this.lastClickedPresetKey = null; // Reset last clicked for shift-click
    }
}
