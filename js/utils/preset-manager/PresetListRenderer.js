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
        statsDiv.className = 'resolution-master-preset-list-stats';
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
        emptyState.className = 'resolution-master-preset-list-empty';
        emptyState.innerHTML = `
            <div class="resolution-master-preset-list-empty-icon">📦</div>
            <div class="resolution-master-preset-list-empty-title">No custom presets yet</div>
            <div class="resolution-master-preset-list-empty-subtitle">Click "Add Preset" to create your first custom preset</div>
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
        categorySection.className = 'resolution-master-preset-list-category-section';
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
        categoryHeader.className = 'resolution-master-preset-list-category-header';
        
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
        categoryTitle.className = 'resolution-master-preset-list-category-title';
        
        // Create clickable name element (like preset names)
        const nameElement = document.createElement('strong');
        nameElement.className = 'resolution-master-preset-list-category-name';
        nameElement.textContent = category;
        nameElement.style.cursor = 'pointer';
        
        // Add double-click handler only to the name
        nameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.parentDialog.renameDialogManager.startRenamingCategory(nameElement, category);
        });
        
        categoryTitle.appendChild(nameElement);
        
        // Add preset count
        const countSpan = document.createElement('span');
        countSpan.textContent = ` (${Object.keys(presets).length})`;
        categoryTitle.appendChild(countSpan);
        
        // Add custom icon if needed
        const builtInPresets = this.parentDialog.manager.rm.presetCategories;
        const isTrulyCustomCategory = !builtInPresets.hasOwnProperty(category);
        if (isTrulyCustomCategory) {
            const customIcon = getIconHtml(this.parentDialog.customPresetIcon, '', 14, 'margin-left: 6px; vertical-align: middle;');
            if (customIcon) {
                const iconSpan = document.createElement('span');
                iconSpan.innerHTML = customIcon;
                categoryTitle.appendChild(iconSpan);
            }
        }
        
        return categoryTitle;
    }

    /**
     * Creates edit category button
     */
    createEditCategoryButton(category) {
        const editCategoryBtn = document.createElement('button');
        editCategoryBtn.className = 'resolution-master-preset-list-edit-category-btn';
        editCategoryBtn.innerHTML = getIconHtml(this.parentDialog.editIcon, '✏️');
        // Tooltip handled by TooltipManager
        
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
        item.className = 'resolution-master-preset-list-item';
        item.dataset.presetName = name;
        item.dataset.presetIndex = presetIndex;
        item.dataset.category = category;

        // Drag & drop handlers for MOVE mode
        this.attachPresetDragHandlers(item, category, name, presetIndex);

        // Checkbox for bulk deletion
        const checkbox = this.createBulkDeleteCheckbox(category, name);
        
        // Preset info
        const info = this.createPresetInfo(category, name, dims);

        // Action buttons (includes clone handle, edit, and delete)
        const actions = this.createActionButtons(category, name, dims, presetIndex);

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
                
                // Set drop effect based on mode
                if (this.parentDialog.isDuplicateMode) {
                    e.dataTransfer.dropEffect = 'copy';
                } else {
                    e.dataTransfer.dropEffect = 'move';
                }
                
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                let color;
                if (this.parentDialog.isDuplicateMode) {
                    // Clone mode - use green/cyan to indicate copy
                    color = '#0f0'; // Green for clone
                } else if (this.parentDialog.draggedPresetCategory === category) {
                    // Same category reorder - blue
                    color = '#5af';
                } else {
                    // Different category move - orange or red if name exists
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
                
                // Check if in duplicate mode
                if (this.parentDialog.isDuplicateMode) {
                    // CLONE MODE: Duplicate the preset
                    const sourceName = this.parentDialog.draggedPresetName;
                    const sourceCategory = this.parentDialog.draggedPresetCategory;
                    
                    // Generate unique name for the duplicate
                    let targetName = sourceName;
                    const customPresets = this.parentDialog.manager.getCustomPresets();
                    const targetCategoryPresets = customPresets[category] || {};
                    
                    // If name exists in target category, add a suffix
                    if (Object.keys(targetCategoryPresets).includes(targetName)) {
                        let counter = 1;
                        while (Object.keys(targetCategoryPresets).includes(`${sourceName} (${counter})`)) {
                            counter++;
                        }
                        targetName = `${sourceName} (${counter})`;
                    }
                    
                    // Get built-in presets for duplicatePreset method
                    const builtInPresets = this.parentDialog.manager.rm.presetCategories;
                    
                    // Duplicate the preset
                    const success = this.parentDialog.manager.duplicatePreset(
                        sourceCategory,
                        sourceName,
                        category,
                        targetName,
                        builtInPresets
                    );
                    
                    if (success) {
                        // If duplicated to same category, reorder it to the target position
                        if (sourceCategory === category) {
                            this.parentDialog.manager.reorderPresets(category, targetName, targetIndex);
                        }
                    }
                } else {
                    // MOVE MODE: Move or reorder the preset
                    if (this.parentDialog.draggedPresetCategory === category) {
                        this.parentDialog.manager.reorderPresets(category, this.parentDialog.draggedPresetName, targetIndex);
                    } else {
                        this.parentDialog.manager.movePreset(this.parentDialog.draggedPresetCategory, this.parentDialog.draggedPresetName, category, targetIndex);
                    }
                }
                
                this.parentDialog.renderDialog();
            }
        });
    }

    /**
     * Creates clone handle for duplicate drag & drop
     */
    createCloneHandle(category, name, dims, presetIndex) {
        const cloneHandle = document.createElement('div');
        cloneHandle.className = 'resolution-master-preset-list-clone-handle';
        cloneHandle.draggable = true;
        cloneHandle.innerHTML = getIconHtml(this.parentDialog.dragAndDuplicateIcon, '⊕', 16);
        
        // Prevent the clone handle from being selected as text
        cloneHandle.style.userSelect = 'none';
        cloneHandle.style.cursor = 'grab';
        
        // Clone-specific drag handlers
        cloneHandle.addEventListener('dragstart', (e) => {
            // Set clone/duplicate mode
            this.parentDialog.isDuplicateMode = true;
            this.parentDialog.draggedPresetName = name;
            this.parentDialog.draggedPresetCategory = category;
            this.parentDialog.draggedPresetDims = dims;
            
            // Visual feedback
            const item = cloneHandle.closest('.resolution-master-preset-list-item');
            if (item) {
                item.style.opacity = '0.5';
            }
            
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/html', cloneHandle.innerHTML);
            e.stopPropagation(); // Prevent parent item drag
        });
        
        cloneHandle.addEventListener('dragend', (e) => {
            // Reset clone mode
            this.parentDialog.isDuplicateMode = false;
            
            // Reset visual feedback
            const item = cloneHandle.closest('.resolution-master-preset-list-item');
            if (item) {
                item.style.opacity = '1';
            }
            
            DragDropHandler.clearDropIndicator(item);
            this.parentDialog.draggedPresetName = null;
            this.parentDialog.draggedPresetCategory = null;
            this.parentDialog.draggedPresetDims = null;
            e.stopPropagation();
        });
        
        // Prevent click from bubbling
        cloneHandle.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Prevent double-click from bubbling
        cloneHandle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
        });
        
        return cloneHandle;
    }

    /**
     * Creates checkbox for bulk deletion
     */
    createBulkDeleteCheckbox(category, name) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'resolution-master-preset-list-checkbox';
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
        info.className = 'resolution-master-preset-list-info';

        const nameContainer = document.createElement('span');
        nameContainer.className = 'resolution-master-preset-list-name-container';

        const nameElement = document.createElement('strong');
        nameElement.className = 'resolution-master-preset-list-name';
        nameElement.textContent = name;
        // Tooltip handled by TooltipManager

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
        dimsSpan.className = 'resolution-master-preset-list-dims';
        dimsSpan.textContent = `(${dims.width}×${dims.height})`;

        info.appendChild(nameContainer);
        info.appendChild(dimsSpan);

        return info;
    }

    /**
     * Creates action buttons for preset item
     */
    createActionButtons(category, name, dims, presetIndex) {
        const actions = document.createElement('div');
        actions.className = 'resolution-master-preset-list-actions';

        // Clone handle (first button)
        const cloneHandle = this.createCloneHandle(category, name, dims, presetIndex);
        actions.appendChild(cloneHandle);

        // Edit button
        const editIconHtml = getIconHtml(this.parentDialog.editIcon, '✏️');
        const editBtn = PresetUIComponents.createActionButton(editIconHtml, 'Edit', () => {
            this.parentDialog.editPreset(category, name, dims);
        });
        editBtn.classList.add('resolution-master-preset-list-edit-btn');
        actions.appendChild(editBtn);

        // Delete button
        const deleteIcon = getIconHtml(this.parentDialog.deleteIcon, '🗑️');
        const deleteBtn = PresetUIComponents.createActionButton(deleteIcon, 'Delete', () => {
            this.parentDialog.deletePreset(category, name);
        });
        deleteBtn.classList.add('resolution-master-preset-list-delete-btn');
        actions.appendChild(deleteBtn);

        return actions;
    }
}
