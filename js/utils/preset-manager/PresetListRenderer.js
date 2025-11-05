// PresetListRenderer.js - Renders the preset list view

import { AspectRatioUtils } from "../AspectRatioUtils.js";
import { getIconHtml } from "../IconUtils.js";
import { DragDropHandler } from "./DragDropHandler.js";
import { PresetUIComponents } from "./PresetUIComponents.js";

/**
 * Renderer for the preset list view
 */
export class PresetListRenderer {
    constructor(parentDialog) {
        this.parentDialog = parentDialog;
    }

    /**
     * Renders the list view showing all custom presets
     * @param {HTMLElement} container - Container to render into
     */
    render(container) {
        const customPresets = this.parentDialog.manager.getCustomPresets();
        const stats = this.parentDialog.manager.getStatistics();

        // Stats header
        const statsDiv = this.createStatsHeader(stats, container);
        container.appendChild(statsDiv);

        // If no presets, show empty state
        if (stats.presets === 0) {
            const emptyState = this.createEmptyState();
            container.appendChild(emptyState);
            return;
        }

        // List presets grouped by category
        Object.entries(customPresets).forEach(([category, presets], categoryIndex) => {
            const categorySection = this.createCategorySection(category, presets, categoryIndex, container);
            container.appendChild(categorySection);
        });
    }

    /**
     * Creates the stats header
     * @param {Object} stats - Statistics object
     * @param {HTMLElement} container - Parent container
     * @returns {HTMLElement} Stats div
     */
    createStatsHeader(stats, container) {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'preset-list-stats';
        statsDiv.innerHTML = `
            📊 <strong>${stats.categories}</strong> categories, 
            <strong>${stats.presets}</strong> custom presets total
        `;
        
        // Add drag & drop handlers to statsDiv to allow dropping at top (index 0)
        statsDiv.addEventListener('dragover', (e) => {
            if (this.parentDialog.draggedCategoryName) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Find first category header and show indicator above it
                const firstCategoryHeader = DragDropHandler.getFirstCategoryHeader(container);
                DragDropHandler.setDropIndicatorTop(firstCategoryHeader);
            }
        });
        
        statsDiv.addEventListener('dragleave', (e) => {
            if (this.parentDialog.draggedCategoryName && !statsDiv.contains(e.relatedTarget)) {
                // Reset indicator only if leaving the entire statsDiv
                const firstCategoryHeader = DragDropHandler.getFirstCategoryHeader(container);
                DragDropHandler.clearDropIndicator(firstCategoryHeader);
            }
        });
        
        statsDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // Save draggedCategoryName before dragend might reset it
            const draggedCategory = this.parentDialog.draggedCategoryName;
            
            if (draggedCategory) {
                // Move to top (index 0)
                this.parentDialog.manager.reorderCategories(draggedCategory, 0);
                this.parentDialog.renderDialog();
            }
        });
        
        return statsDiv;
    }

    /**
     * Creates the empty state message
     * @returns {HTMLElement} Empty state div
     */
    createEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'preset-list-empty';
        emptyState.innerHTML = `
            <div class="preset-list-empty-icon">📦</div>
            <div class="preset-list-empty-title">No custom presets yet</div>
            <div class="preset-list-empty-subtitle">Click "Add Preset" to create your first custom preset</div>
        `;
        return emptyState;
    }

    /**
     * Creates a category section
     * @param {string} category - Category name
     * @param {Object} presets - Presets in category
     * @param {number} categoryIndex - Category index
     * @param {HTMLElement} container - Parent container
     * @returns {HTMLElement} Category section
     */
    createCategorySection(category, presets, categoryIndex, container) {
        const categorySection = document.createElement('div');
        categorySection.className = 'preset-list-category-section';
        categorySection.dataset.categoryName = category;
        categorySection.dataset.categoryIndex = categoryIndex;

        // Category header with edit button
        const categoryHeader = this.createCategoryHeader(category, presets, categoryIndex, container, categorySection);
        categorySection.appendChild(categoryHeader);

        // Presets list
        Object.entries(presets).forEach(([name, dims], presetIndex) => {
            const presetItem = this.createPresetItem(category, name, dims, presetIndex);
            categorySection.appendChild(presetItem);
        });

        return categorySection;
    }

    /**
     * Creates a category header
     * @param {string} category - Category name
     * @param {Object} presets - Presets in category
     * @param {number} categoryIndex - Category index
     * @param {HTMLElement} container - Parent container
     * @param {HTMLElement} categorySection - Category section element
     * @returns {HTMLElement} Category header
     */
    createCategoryHeader(category, presets, categoryIndex, container, categorySection) {
        const categoryHeader = document.createElement('div');
        categoryHeader.draggable = true;
        categoryHeader.className = 'preset-list-category-header';
        
        // Drag & drop handlers for category reordering
        this.attachCategoryDragHandlers(categoryHeader, category, categoryIndex, container, categorySection);
        
        // Category title with custom icon (only for truly custom categories)
        const categoryTitle = this.createCategoryTitle(category, presets);
        
        // Edit category button
        const editCategoryBtn = this.createEditCategoryButton(category);
        
        categoryHeader.appendChild(categoryTitle);
        categoryHeader.appendChild(editCategoryBtn);
        
        return categoryHeader;
    }

    /**
     * Attaches drag & drop handlers to category header
     */
    attachCategoryDragHandlers(categoryHeader, category, categoryIndex, container, categorySection) {
        categoryHeader.addEventListener('dragstart', (e) => {
            this.parentDialog.draggedCategoryName = category;
            categoryHeader.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', categoryHeader.innerHTML);
        });
        
        categoryHeader.addEventListener('dragend', () => {
            categoryHeader.style.opacity = '1';
            DragDropHandler.clearDropIndicator(categoryHeader);
            this.parentDialog.draggedCategoryName = null;
        });
        
        categoryHeader.addEventListener('dragover', (e) => {
            if (this.parentDialog.draggedCategoryName && this.parentDialog.draggedCategoryName !== category) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                
                const nextCategoryHeader = DragDropHandler.getNextCategoryHeader(container, categoryIndex);
                DragDropHandler.clearDropIndicator(nextCategoryHeader);
                
                DragDropHandler.setDropIndicatorTop(categoryHeader, '#5af');
            }
        });
        
        categoryHeader.addEventListener('dragleave', () => {
            DragDropHandler.clearDropIndicator(categoryHeader);
        });
        
        categoryHeader.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.parentDialog.draggedCategoryName && this.parentDialog.draggedCategoryName !== category) {
                const targetIndex = categoryIndex;
                this.parentDialog.manager.reorderCategories(this.parentDialog.draggedCategoryName, targetIndex);
                this.parentDialog.renderDialog();
            }
            
            DragDropHandler.clearDropIndicator(categoryHeader);
        });
        
        // Category section drag handlers
        this.attachCategorySectionDragHandlers(categorySection, category, categoryIndex, container, categoryHeader);
    }

    /**
     * Attaches drag & drop handlers to category section
     */
    attachCategorySectionDragHandlers(categorySection, category, categoryIndex, container, categoryHeader) {
        categorySection.addEventListener('dragover', (e) => {
            if (this.parentDialog.draggedCategoryName && this.parentDialog.draggedCategoryName !== category) {
                const draggableElement = e.target.closest('div[draggable="true"]');
                const isOverCategoryHeader = draggableElement && !draggableElement.dataset.presetName;
                
                if (!isOverCategoryHeader) {
                    e.preventDefault();
                    
                    DragDropHandler.clearDropIndicator(categoryHeader);
                    
                    const nextCategorySection = container.querySelector(`[data-category-index="${categoryIndex + 1}"]`);
                    if (nextCategorySection) {
                        const nextCategoryName = nextCategorySection.dataset.categoryName;
                        if (nextCategoryName !== this.parentDialog.draggedCategoryName) {
                            const nextCategoryHeader = nextCategorySection.querySelector('div[draggable="true"]');
                            if (nextCategoryHeader) {
                                const headerRect = nextCategoryHeader.getBoundingClientRect();
                                const distanceToHeader = headerRect.top - e.clientY;
                                
                                if (distanceToHeader > 10) {
                                    DragDropHandler.setDropIndicatorTop(nextCategoryHeader, '#5af');
                                }
                            }
                        }
                    } else {
                        DragDropHandler.setDropIndicatorBottom(categorySection, '#5af');
                    }
                }
            }
        });
        
        categorySection.addEventListener('dragleave', (e) => {
            if (this.parentDialog.draggedCategoryName && !categorySection.contains(e.relatedTarget)) {
                DragDropHandler.clearDropIndicator(categoryHeader);
                DragDropHandler.clearDropIndicator(categorySection);
                const nextCategoryHeader = DragDropHandler.getNextCategoryHeader(container, categoryIndex);
                DragDropHandler.clearDropIndicator(nextCategoryHeader);
            }
        });
        
        categorySection.addEventListener('drop', (e) => {
            const draggedCategory = this.parentDialog.draggedCategoryName;
            
            DragDropHandler.clearDropIndicator(categoryHeader);
            DragDropHandler.clearDropIndicator(categorySection);
            const nextCategoryHeader = DragDropHandler.getNextCategoryHeader(container, categoryIndex);
            DragDropHandler.clearDropIndicator(nextCategoryHeader);
            
            if (draggedCategory && draggedCategory !== category) {
                if (e.target !== categoryHeader && !categoryHeader.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const targetIndex = categoryIndex + 1;
                    this.parentDialog.manager.reorderCategories(draggedCategory, targetIndex);
                    this.parentDialog.renderDialog();
                }
            }
        });
    }

    /**
     * Creates category title element
     */
    createCategoryTitle(category, presets) {
        const categoryTitle = document.createElement('div');
        categoryTitle.className = 'preset-list-category-title';
        
        const builtInPresets = this.parentDialog.manager.rm.presetCategories;
        const isTrulyCustomCategory = !builtInPresets.hasOwnProperty(category);
        const customIcon = isTrulyCustomCategory ? getIconHtml(this.parentDialog.customPresetIcon, '', 14, 'margin-left: 6px; vertical-align: middle;') : '';
        categoryTitle.innerHTML = `${category} (${Object.keys(presets).length})${customIcon || ''}`;
        categoryTitle.title = 'Double-click to rename category, drag to reorder';
        
        categoryTitle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.parentDialog.renameDialogManager.startRenamingCategory(categoryTitle, category);
        });
        
        return categoryTitle;
    }

    /**
     * Creates edit category button
     */
    createEditCategoryButton(category) {
        const editCategoryBtn = document.createElement('button');
        editCategoryBtn.className = 'preset-list-edit-category-btn';
        editCategoryBtn.innerHTML = getIconHtml(this.parentDialog.editIcon, '✏️');
        editCategoryBtn.title = `Edit ${category} category`;
        
        editCategoryBtn.addEventListener('click', () => {
            this.parentDialog.currentView = 'add';
            this.parentDialog.selectedCategory = category;
            this.parentDialog.editingPreset = null;
            this.parentDialog.editingPresetName = null;
            this.parentDialog.editingPresetData = null;
            this.parentDialog.renderDialog();
        });
        
        return editCategoryBtn;
    }

    /**
     * Creates a preset item element for the list
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @param {Object} dims - Dimensions {width, height}
     * @param {number} presetIndex - Preset index
     * @returns {HTMLElement} Preset item
     */
    createPresetItem(category, name, dims, presetIndex) {
        const item = document.createElement('div');
        item.draggable = true;
        item.className = 'preset-list-item';
        item.dataset.presetName = name;
        item.dataset.presetIndex = presetIndex;
        item.dataset.category = category;

        // Drag & drop handlers
        this.attachPresetDragHandlers(item, category, name, presetIndex);

        // Checkbox for bulk deletion
        const checkbox = this.createBulkDeleteCheckbox(category, name);
        
        // Preset info
        const info = this.createPresetInfo(category, name, dims);

        // Action buttons
        const actions = this.createActionButtons(category, name, dims);

        item.appendChild(checkbox);
        item.appendChild(info);
        item.appendChild(actions);

        return item;
    }

    /**
     * Attaches drag & drop handlers to preset item
     */
    attachPresetDragHandlers(item, category, name, presetIndex) {
        item.addEventListener('dragstart', (e) => {
            this.parentDialog.draggedPresetName = name;
            this.parentDialog.draggedPresetCategory = category;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            DragDropHandler.clearDropIndicator(item);
            this.parentDialog.draggedPresetName = null;
            this.parentDialog.draggedPresetCategory = null;
        });

        item.addEventListener('dragover', (e) => {
            if (this.parentDialog.draggedPresetName && this.parentDialog.draggedPresetName !== name) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                let color;
                if (this.parentDialog.draggedPresetCategory === category) {
                    color = '#5af';
                } else {
                    const customPresets = this.parentDialog.manager.getCustomPresets();
                    const targetCategoryPresets = customPresets[category] || {};
                    const nameExists = Object.keys(targetCategoryPresets).includes(this.parentDialog.draggedPresetName);
                    color = nameExists ? '#f00' : '#fa0';
                }
                
                if (e.clientY < midpoint) {
                    DragDropHandler.setDropIndicatorTop(item, color);
                } else {
                    DragDropHandler.setDropIndicatorBottom(item, color);
                }
            }
        });

        item.addEventListener('dragleave', () => {
            DragDropHandler.clearDropIndicator(item);
        });

        item.addEventListener('drop', (e) => {
            DragDropHandler.clearDropIndicator(item);
            
            if (this.parentDialog.draggedPresetName && this.parentDialog.draggedPresetName !== name) {
                e.preventDefault();
                e.stopPropagation();
                
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                let targetIndex = presetIndex;
                
                if (e.clientY >= midpoint) {
                    targetIndex = presetIndex + 1;
                }
                
                if (this.parentDialog.draggedPresetCategory === category) {
                    this.parentDialog.manager.reorderPresets(category, this.parentDialog.draggedPresetName, targetIndex);
                } else {
                    this.parentDialog.manager.movePreset(this.parentDialog.draggedPresetCategory, this.parentDialog.draggedPresetName, category, targetIndex);
                }
                
                this.parentDialog.renderDialog();
            }
        });
    }

    /**
     * Creates checkbox for bulk deletion
     */
    createBulkDeleteCheckbox(category, name) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'preset-list-checkbox';
        const presetKey = `${category}|${name}`;
        checkbox.dataset.presetKey = presetKey;
        checkbox.checked = this.parentDialog.selectedPresetsForDeletion.has(presetKey);
        checkbox.addEventListener('click', (e) => {
            if (e.shiftKey && this.parentDialog.lastClickedPresetKey) {
                this.parentDialog.handleShiftClickSelection(presetKey, checkbox.checked);
            } else {
                if (checkbox.checked) {
                    this.parentDialog.selectedPresetsForDeletion.add(presetKey);
                } else {
                    this.parentDialog.selectedPresetsForDeletion.delete(presetKey);
                }
                this.parentDialog.lastClickedPresetKey = presetKey;
            }
            
            this.parentDialog.updateDeleteSelectedButton();
            e.stopPropagation();
        });
        
        return checkbox;
    }

    /**
     * Creates preset info section
     */
    createPresetInfo(category, name, dims) {
        const info = document.createElement('div');
        info.className = 'preset-list-info';

        const nameContainer = document.createElement('span');
        nameContainer.className = 'preset-list-name-container';

        const nameElement = document.createElement('strong');
        nameElement.className = 'preset-list-name';
        nameElement.textContent = name;
        nameElement.title = 'Double-click to rename preset';

        nameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.parentDialog.renameDialogManager.startRenamingPreset(nameElement, category, name, dims);
        });

        nameContainer.appendChild(nameElement);

        const customIcon = getIconHtml(this.parentDialog.customPresetIcon, '', 14, 'margin-left: 6px; vertical-align: middle;');
        if (customIcon) {
            const iconSpan = document.createElement('span');
            iconSpan.innerHTML = customIcon;
            nameContainer.appendChild(iconSpan);
        }

        const dimsSpan = document.createElement('span');
        dimsSpan.className = 'preset-list-dims';
        dimsSpan.textContent = `(${dims.width}×${dims.height})`;

        info.appendChild(nameContainer);
        info.appendChild(dimsSpan);

        return info;
    }

    /**
     * Creates action buttons for preset item
     */
    createActionButtons(category, name, dims) {
        const actions = document.createElement('div');
        actions.className = 'preset-list-actions';

        const editIconHtml = getIconHtml(this.parentDialog.editIcon, '✏️');
        const editBtn = PresetUIComponents.createActionButton(editIconHtml, 'Edit', () => {
            this.parentDialog.editPreset(category, name, dims);
        });

        const deleteIcon = getIconHtml(this.parentDialog.deleteIcon, '🗑️');
        const deleteBtn = PresetUIComponents.createActionButton(deleteIcon, 'Delete', () => {
            this.parentDialog.deletePreset(category, name);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        return actions;
    }
}
