// PresetManagerDialog.js - Dialog for managing custom presets
import { createModuleLogger } from "./LoggerUtils.js";
import { SearchableDropdown } from "../SearchableDropdown.js";
import { AspectRatioUtils } from "./AspectRatioUtils.js";
import { loadIcons, getIconHtml } from "./IconUtils.js";

const log = createModuleLogger('PresetManagerDialog');

export class PresetManagerDialog {
    constructor(customPresetsManager) {
        this.manager = customPresetsManager;
        this.overlay = null;
        this.container = null;
        this.isActive = false;
        this.currentView = 'list'; // 'list' or 'add'
        this.editingPreset = null; // { category, name } when editing
        this.selectedCategory = null; // Currently selected category in add view
        this.searchableDropdown = new SearchableDropdown(); // Instance for category selection
        this.presetPreviewContainer = null; // Container for preset preview
        this.editingPresetName = null; // Name of preset being edited in quick edit mode
        this.editingPresetData = null; // Full data of preset being edited { name, width, height }
        this.selectedPresetsForDeletion = new Set(); // Set of "category|name" for bulk deletion
        this.lastClickedPresetKey = null; // Last clicked checkbox for shift-click range selection
        
        // Drag & drop state
        this.draggedCategoryName = null; // Category being dragged
        this.draggedPresetName = null; // Preset being dragged
        this.draggedPresetCategory = null; // Category of preset being dragged
        
        // Load custom preset icon, delete icon, and edit icon
        this.customPresetIcon = null;
        this.deleteIcon = null;
        this.editIcon = null;
        this.exportIcon = null;
        this.importIcon = null;
        const icons = {};
        loadIcons(icons, "#ffffffff"); // White color for icons
        this.customPresetIcon = icons.customPreset;
        this.deleteIcon = icons.delete;
        this.editIcon = icons.edit;
        this.exportIcon = icons.export;
        this.importIcon = icons.import;
    }

    /**
     * Sets a drop indicator line at the top of an element
     * @param {HTMLElement} element - The element to show the indicator on
     * @param {string} color - Color of the indicator (default: #5af for reorder, #fa0 for move)
     */
    setDropIndicatorTop(element, color = '#5af') {
        if (element) {
            element.style.transition = 'none';
            element.style.boxShadow = `inset 0 2px 0 0 ${color}`;
        }
    }

    /**
     * Sets a drop indicator line at the bottom of an element
     * @param {HTMLElement} element - The element to show the indicator on
     * @param {string} color - Color of the indicator (default: #5af for reorder, #fa0 for move)
     */
    setDropIndicatorBottom(element, color = '#5af') {
        if (element) {
            element.style.transition = 'none';
            element.style.boxShadow = `inset 0 -2px 0 0 ${color}`;
        }
    }

    /**
     * Clears the drop indicator from an element
     * @param {HTMLElement} element - The element to clear the indicator from
     */
    clearDropIndicator(element) {
        if (element) {
            element.style.boxShadow = '';
            // Restore transition after a brief delay to allow box-shadow to clear
            requestAnimationFrame(() => {
                if (element) {
                    element.style.transition = '';
                }
            });
        }
    }

    /**
     * Gets the first category header element
     * @param {HTMLElement} container - The container to search in
     * @returns {HTMLElement|null} The first category header or null
     */
    getFirstCategoryHeader(container) {
        const firstCategorySection = container.querySelector('[data-category-index="0"]');
        if (firstCategorySection) {
            return firstCategorySection.querySelector('div[draggable="true"]');
        }
        return null;
    }

    /**
     * Gets the next category header element
     * @param {HTMLElement} container - The container to search in
     * @param {number} currentIndex - The current category index
     * @returns {HTMLElement|null} The next category header or null
     */
    getNextCategoryHeader(container, currentIndex) {
        const nextCategorySection = container.querySelector(`[data-category-index="${currentIndex + 1}"]`);
        if (nextCategorySection) {
            return nextCategorySection.querySelector('div[draggable="true"]');
        }
        return null;
    }

    /**
     * Adds hover effects to a button element
     * @param {HTMLElement} button - The button element
     * @param {string} hoverBg - Background color on hover
     * @param {string} normalBg - Normal background color
     * @param {string} hoverBorder - Border color on hover (optional)
     * @param {string} normalBorder - Normal border color (optional)
     */
    addButtonHoverEffects(button, hoverBg, normalBg, hoverBorder = null, normalBorder = null) {
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
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 9998;
        `;
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) this.hide();
        });
        document.body.appendChild(this.overlay);

        // Create container
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
            border: 2px solid #555;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            z-index: 9999;
            font-family: Arial, sans-serif;
            width: 800px;
            max-width: 95vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        `;
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
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 2px solid #444;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'color: #fff; font-size: 18px; font-weight: bold;';
        title.textContent = '⚙ Custom Presets Manager';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #aaa;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            line-height: 32px;
            text-align: center;
            border-radius: 4px;
            transition: all 0.2s;
        `;
        closeBtn.addEventListener('click', () => this.hide());
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.1)';
            closeBtn.style.color = '#fff';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = '#aaa';
        });

        header.appendChild(title);
        header.appendChild(closeBtn);
        this.container.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        `;

        if (this.currentView === 'list') {
            this.renderListView(content);
        } else if (this.currentView === 'add') {
            this.renderAddView(content);
        }

        this.container.appendChild(content);

        // Footer with action buttons
        this.renderFooter();
    }

    /**
     * Renders the list view showing all custom presets
     */
    renderListView(container) {
        const customPresets = this.manager.getCustomPresets();
        const stats = this.manager.getStatistics();

        // Stats header
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = `
            background: rgba(90, 170, 255, 0.1);
            border: 1px solid rgba(90, 170, 255, 0.3);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 20px;
            color: #5af;
            font-size: 13px;
        `;
        statsDiv.innerHTML = `
            📊 <strong>${stats.categories}</strong> categories, 
            <strong>${stats.presets}</strong> custom presets total
        `;
        
        // Add drag & drop handlers to statsDiv to allow dropping at top (index 0)
        statsDiv.addEventListener('dragover', (e) => {
            if (this.draggedCategoryName) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Find first category header and show indicator above it
                const firstCategoryHeader = this.getFirstCategoryHeader(container);
                this.setDropIndicatorTop(firstCategoryHeader);
            }
        });
        
        statsDiv.addEventListener('dragleave', (e) => {
            if (this.draggedCategoryName && !statsDiv.contains(e.relatedTarget)) {
                // Reset indicator only if leaving the entire statsDiv (not just moving between children)
                const firstCategoryHeader = this.getFirstCategoryHeader(container);
                this.clearDropIndicator(firstCategoryHeader);
            }
        });
        
        statsDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // Save draggedCategoryName before dragend might reset it
            const draggedCategory = this.draggedCategoryName;
            
            if (draggedCategory) {
                // Move to top (index 0)
                this.manager.reorderCategories(draggedCategory, 0);
                this.renderDialog();
            }
        });
        
        container.appendChild(statsDiv);
        
        // Add drag handlers to container to handle drops on margins/empty space
        container.addEventListener('dragover', (e) => {
            if (this.draggedCategoryName) {
                // Check if we're over statsDiv or any category
                const isOverStatsDiv = statsDiv.contains(e.target) || e.target === statsDiv;
                const isOverCategory = e.target.closest('[data-category-name]');
                
                // If NOT over any specific element (e.g., over margin/empty space)
                if (!isOverStatsDiv && !isOverCategory) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    
                    // Show indicator above first category
                    const firstCategoryHeader = this.getFirstCategoryHeader(container);
                    this.setDropIndicatorTop(firstCategoryHeader);
                }
            }
        });
        
        container.addEventListener('dragleave', (e) => {
            if (this.draggedCategoryName) {
                // Check if we're leaving the container entirely
                if (!container.contains(e.relatedTarget)) {
                    // Reset indicator
                    const firstCategoryHeader = this.getFirstCategoryHeader(container);
                    this.clearDropIndicator(firstCategoryHeader);
                }
            }
        });
        
        container.addEventListener('drop', (e) => {
            if (this.draggedCategoryName) {
                const isOverStatsDiv = statsDiv.contains(e.target) || e.target === statsDiv;
                const isOverCategory = e.target.closest('[data-category-name]');
                
                // If NOT over any specific element (e.g., over margin/empty space)
                if (!isOverStatsDiv && !isOverCategory) {
                    e.preventDefault();
                    
                    // Save draggedCategoryName before dragend might reset it
                    const draggedCategory = this.draggedCategoryName;
                    
                    // Move to top (index 0)
                    this.manager.reorderCategories(draggedCategory, 0);
                    this.renderDialog();
                }
            }
        });

        // If no presets, show empty state
        if (stats.presets === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                text-align: center;
                padding: 40px 20px;
                color: #888;
            `;
            emptyState.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                <div style="font-size: 16px; margin-bottom: 8px;">No custom presets yet</div>
                <div style="font-size: 13px;">Click "Add Preset" to create your first custom preset</div>
            `;
            container.appendChild(emptyState);
            return;
        }

        // List presets grouped by category
        Object.entries(customPresets).forEach(([category, presets], categoryIndex) => {
            const categorySection = document.createElement('div');
            categorySection.style.cssText = 'padding-bottom: 24px;';
            categorySection.dataset.categoryName = category;
            categorySection.dataset.categoryIndex = categoryIndex;

            // Category header with edit button
            const categoryHeader = document.createElement('div');
            categoryHeader.draggable = true;
            categoryHeader.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #444;
                cursor: move;
                transition: all 0.2s;
            `;
            
            // Drag & drop handlers for category reordering
            categoryHeader.addEventListener('dragstart', (e) => {
                this.draggedCategoryName = category;
                categoryHeader.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', categoryHeader.innerHTML);
            });
            
            categoryHeader.addEventListener('dragend', () => {
                categoryHeader.style.opacity = '1';
                this.clearDropIndicator(categoryHeader);
                this.draggedCategoryName = null;
            });
            
            categoryHeader.addEventListener('dragover', (e) => {
                // Handle category being dragged
                if (this.draggedCategoryName && this.draggedCategoryName !== category) {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent bubbling to categorySection
                    e.dataTransfer.dropEffect = 'move';
                    
                    // Clear indicator from next category (if it was set by categorySection dragover)
                    const nextCategoryHeader = this.getNextCategoryHeader(container, categoryIndex);
                    this.clearDropIndicator(nextCategoryHeader);
                    
                    // Show BLUE indicator ABOVE this category (category reordering)
                    this.setDropIndicatorTop(categoryHeader, '#5af');
                }
            });
            
            categoryHeader.addEventListener('dragleave', () => {
                this.clearDropIndicator(categoryHeader);
            });
            
            categoryHeader.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Handle category being dropped
                if (this.draggedCategoryName && this.draggedCategoryName !== category) {
                    // Always insert BEFORE this category (since indicator is always above)
                    const targetIndex = categoryIndex;
                    
                    // Reorder categories
                    this.manager.reorderCategories(this.draggedCategoryName, targetIndex);
                    
                    // Refresh view
                    this.renderDialog();
                }
                
                this.clearDropIndicator(categoryHeader);
            });
            
            // Category title with custom icon (only for truly custom categories)
            const categoryTitle = document.createElement('div');
            categoryTitle.style.cssText = `
                color: #5af;
                font-size: 14px;
                font-weight: bold;
                user-select: none;
                flex: 1;
            `;
            // Check if category is truly custom (not in built-in categories)
            const builtInPresets = this.manager.rm.presetCategories;
            const isTrulyCustomCategory = !builtInPresets.hasOwnProperty(category);
            const customIcon = isTrulyCustomCategory ? getIconHtml(this.customPresetIcon, '', 14, 'margin-left: 6px; vertical-align: middle;') : '';
            categoryTitle.innerHTML = `${category} (${Object.keys(presets).length})${customIcon || ''}`;
            categoryTitle.title = 'Double-click to rename category, drag to reorder';
            
            // Double-click to rename category
            categoryTitle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startRenamingCategory(categoryTitle, category);
            });
            
            // Edit category button
            const editCategoryBtn = document.createElement('button');
            editCategoryBtn.innerHTML = getIconHtml(this.editIcon, '✏️');
            editCategoryBtn.title = `Edit ${category} category`;
            editCategoryBtn.style.cssText = `
                background: rgba(90, 170, 255, 0.1);
                border: 1px solid rgba(90, 170, 255, 0.3);
                border-radius: 4px;
                color: #5af;
                cursor: pointer;
                padding: 4px 8px;
                font-size: 14px;
                transition: all 0.2s;
            `;
            
            editCategoryBtn.addEventListener('click', () => {
                // Switch to add view with this category pre-selected
                this.currentView = 'add';
                this.selectedCategory = category;
                this.editingPreset = null;
                this.editingPresetName = null;
                this.editingPresetData = null;
                this.renderDialog();
            });
            
            editCategoryBtn.addEventListener('mouseenter', () => {
                editCategoryBtn.style.background = 'rgba(90, 170, 255, 0.2)';
                editCategoryBtn.style.borderColor = 'rgba(90, 170, 255, 0.5)';
            });
            
            editCategoryBtn.addEventListener('mouseleave', () => {
                editCategoryBtn.style.background = 'rgba(90, 170, 255, 0.1)';
                editCategoryBtn.style.borderColor = 'rgba(90, 170, 255, 0.3)';
            });
            
            categoryHeader.appendChild(categoryTitle);
            categoryHeader.appendChild(editCategoryBtn);
            categorySection.appendChild(categoryHeader);
            
            // Drag & drop handlers for category section (to show indicator when dragging over presets)
            categorySection.addEventListener('dragover', (e) => {
                // Handle category being dragged
                if (this.draggedCategoryName && this.draggedCategoryName !== category) {
                    // Only handle if we're NOT over category header (but preset items are OK)
                    const draggableElement = e.target.closest('div[draggable="true"]');
                    const isOverCategoryHeader = draggableElement && !draggableElement.dataset.presetName;
                    
                    if (!isOverCategoryHeader) {
                        e.preventDefault();
                        
                        // Clear current category header indicator to avoid double indicators
                        this.clearDropIndicator(categoryHeader);
                        
                        // Show BLUE indicator ABOVE next category (or below this one if it's the last)
                        const nextCategorySection = container.querySelector(`[data-category-index="${categoryIndex + 1}"]`);
                        if (nextCategorySection) {
                            // Check if next category is the one being dragged
                            const nextCategoryName = nextCategorySection.dataset.categoryName;
                            if (nextCategoryName !== this.draggedCategoryName) {
                                const nextCategoryHeader = nextCategorySection.querySelector('div[draggable="true"]');
                                if (nextCategoryHeader) {
                                    // Check if cursor is too close to next header (within 10px)
                                    const headerRect = nextCategoryHeader.getBoundingClientRect();
                                    const distanceToHeader = headerRect.top - e.clientY;
                                    
                                    // Only show indicator if cursor is NOT too close to header
                                    // (if it's close, header's own dragover will handle it)
                                    if (distanceToHeader > 10) {
                                        this.setDropIndicatorTop(nextCategoryHeader, '#5af');
                                    }
                                }
                            }
                        } else {
                            // This is the last category - show indicator below entire section
                            this.setDropIndicatorBottom(categorySection, '#5af');
                        }
                    }
                }
            });
            
            categorySection.addEventListener('dragleave', (e) => {
                // Reset only if we're leaving the entire section
                if (this.draggedCategoryName && !categorySection.contains(e.relatedTarget)) {
                    // Reset current category header
                    this.clearDropIndicator(categoryHeader);
                    
                    // Reset current category section border (for last category case)
                    this.clearDropIndicator(categorySection);
                    
                    // Reset next category header if it exists
                    const nextCategoryHeader = this.getNextCategoryHeader(container, categoryIndex);
                    this.clearDropIndicator(nextCategoryHeader);
                }
            });
            
            categorySection.addEventListener('drop', (e) => {
                // Save drag state before dragend might reset it
                const draggedCategory = this.draggedCategoryName;
                
                // Reset visual indicators immediately
                this.clearDropIndicator(categoryHeader);
                this.clearDropIndicator(categorySection);
                const nextCategoryHeader = this.getNextCategoryHeader(container, categoryIndex);
                this.clearDropIndicator(nextCategoryHeader);
                
                // Handle category being dropped
                if (draggedCategory && draggedCategory !== category) {
                    // Only handle if we're NOT over the header itself
                    if (e.target !== categoryHeader && !categoryHeader.contains(e.target)) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Insert AFTER this category (since we're dropping over presets)
                        const targetIndex = categoryIndex + 1;
                        this.manager.reorderCategories(draggedCategory, targetIndex);
                        this.renderDialog();
                    }
                }
            });

            // Presets list
            Object.entries(presets).forEach(([name, dims], presetIndex) => {
                const presetItem = this.createPresetItem(category, name, dims, presetIndex);
                categorySection.appendChild(presetItem);
            });

            container.appendChild(categorySection);
        });
    }

    /**
     * Creates a preset item element for the list
     */
    createPresetItem(category, name, dims, presetIndex) {
        const item = document.createElement('div');
        item.draggable = true;
        item.dataset.presetName = name;
        item.dataset.presetIndex = presetIndex;
        item.dataset.category = category;
        item.style.cssText = `
            background: rgba(255,255,255,0.05);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 4px 8px;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s;
            cursor: move;
        `;

        // Drag & drop handlers for preset reordering
        item.addEventListener('dragstart', (e) => {
            this.draggedPresetName = name;
            this.draggedPresetCategory = category;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            this.clearDropIndicator(item);
            this.draggedPresetName = null;
            this.draggedPresetCategory = null;
        });

        item.addEventListener('dragover', (e) => {
            if (this.draggedPresetName && this.draggedPresetName !== name) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Visual indicator - show where it will be dropped
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                // Determine color based on context
                let color;
                if (this.draggedPresetCategory === category) {
                    // Same category - blue
                    color = '#5af';
                } else {
                    // Cross-category - check if preset name already exists in target category
                    const customPresets = this.manager.getCustomPresets();
                    const targetCategoryPresets = customPresets[category] || {};
                    const nameExists = Object.keys(targetCategoryPresets).includes(this.draggedPresetName);
                    
                    // Red if name exists (can't drop), yellow if name is available
                    color = nameExists ? '#f00' : '#fa0';
                }
                
                if (e.clientY < midpoint) {
                    this.setDropIndicatorTop(item, color);
                } else {
                    this.setDropIndicatorBottom(item, color);
                }
            }
        });

        item.addEventListener('dragleave', () => {
            this.clearDropIndicator(item);
        });

        item.addEventListener('drop', (e) => {
            // Reset visual indicator
            this.clearDropIndicator(item);
            
            if (this.draggedPresetName && this.draggedPresetName !== name) {
                // We're dropping a preset - handle it here
                e.preventDefault();
                e.stopPropagation();
                
                // Determine drop position
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                let targetIndex = presetIndex;
                
                if (e.clientY >= midpoint) {
                    targetIndex = presetIndex + 1;
                }
                
                // Check if same category or cross-category move
                if (this.draggedPresetCategory === category) {
                    // Reorder presets within same category
                    this.manager.reorderPresets(category, this.draggedPresetName, targetIndex);
                } else {
                    // Move preset from different category
                    this.manager.movePreset(this.draggedPresetCategory, this.draggedPresetName, category, targetIndex);
                }
                
                // Refresh view
                this.renderDialog();
            }
            // If not dragging a preset (e.g., dragging a category), let the event bubble to categorySection
        });

        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(255,255,255,0.08)';
            item.style.borderColor = '#666';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.borderColor = '#444';
        });

        // Checkbox for bulk deletion
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = `
            width: 16px;
            height: 16px;
            cursor: pointer;
            margin-right: 8px;
        `;
        const presetKey = `${category}|${name}`;
        checkbox.dataset.presetKey = presetKey; // For shift-click range selection
        checkbox.checked = this.selectedPresetsForDeletion.has(presetKey);
        checkbox.addEventListener('click', (e) => {
            if (e.shiftKey && this.lastClickedPresetKey) {
                // Shift-click: select range
                // The checkbox was already toggled by the click, use its new state
                this.handleShiftClickSelection(presetKey, checkbox.checked);
            } else {
                // Normal click - update selection based on checkbox state
                if (checkbox.checked) {
                    this.selectedPresetsForDeletion.add(presetKey);
                } else {
                    this.selectedPresetsForDeletion.delete(presetKey);
                }
                this.lastClickedPresetKey = presetKey;
            }
            
            // Update delete button in footer
            this.updateDeleteSelectedButton();
            
            e.stopPropagation();
        });

        // Preset info - single line layout with custom preset icon on the right
        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 6px;';

        // Preset name with custom icon
        const nameContainer = document.createElement('span');
        nameContainer.style.cssText = 'color: #fff; font-size: 13px;';

        const nameElement = document.createElement('strong');
        nameElement.textContent = name;
        nameElement.title = 'Double-click to rename preset';
        nameElement.style.cssText = 'cursor: pointer; user-select: none;';

        // Add double-click listener for renaming
        nameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startRenamingPreset(nameElement, category, name, dims);
        });

        nameContainer.appendChild(nameElement);

        // Add custom icon if available
        const customIcon = getIconHtml(this.customPresetIcon, '', 14, 'margin-left: 6px; vertical-align: middle;');
        if (customIcon) {
            const iconSpan = document.createElement('span');
            iconSpan.innerHTML = customIcon;
            nameContainer.appendChild(iconSpan);
        }

        // Dimensions
        const dimsSpan = document.createElement('span');
        dimsSpan.style.cssText = 'color: #888; font-size: 12px;';
        dimsSpan.textContent = `(${dims.width}×${dims.height})`;

        info.appendChild(nameContainer);
        info.appendChild(dimsSpan);

        // Action buttons
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 3px;';

        const editIconHtml = getIconHtml(this.editIcon, '✏️');
        const editBtn = this.createActionButton(editIconHtml, 'Edit', () => {
            this.editPreset(category, name, dims);
        });

        const deleteIcon = getIconHtml(this.deleteIcon, '🗑️');
        const deleteBtn = this.createActionButton(deleteIcon, 'Delete', () => {
            this.deletePreset(category, name);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(checkbox);
        item.appendChild(info);
        item.appendChild(actions);

        return item;
    }

    /**
     * Creates an action button for preset items
     */
    createActionButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        // Support both text icons and HTML (for SVG icons)
        if (icon.includes('<img')) {
            btn.innerHTML = icon;
        } else {
            btn.textContent = icon;
        }
        btn.title = tooltip;
        btn.style.cssText = `
            background: rgba(255,255,255,0.1);
            border: 1px solid #666;
            border-radius: 3px;
            color: #ddd;
            cursor: pointer;
            padding: 3px 6px;
            font-size: 13px;
            transition: all 0.2s;
        `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255,255,255,0.2)';
            btn.style.borderColor = '#888';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.borderColor = '#666';
        });

        return btn;
    }

    /**
     * Renders the add/edit preset view with category selection and preview
     */
    renderAddView(container) {
        // Title
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            color: #fff;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
        `;
        titleDiv.textContent = 'Add Presets to Category';
        container.appendChild(titleDiv);

        // Category selection section
        const categorySection = document.createElement('div');
        categorySection.style.cssText = 'margin-bottom: 12px;';

        const categoryLabel = document.createElement('div');
        categoryLabel.textContent = 'Category';
        categoryLabel.style.cssText = 'color: #ccc; font-size: 13px; font-weight: bold; margin-bottom: 4px;';
        categorySection.appendChild(categoryLabel);

        // Container for category button and rename button
        const categoryButtonContainer = document.createElement('div');
        categoryButtonContainer.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        const categoryButton = document.createElement('button');
        categoryButton.id = 'category-select-btn';
        categoryButton.textContent = this.selectedCategory || 'Click to select category...';
        categoryButton.style.cssText = `
            flex: 1;
            padding: 8px 10px;
            border: 1px solid #555;
            border-radius: 6px;
            background: #333;
            color: ${this.selectedCategory ? '#fff' : '#888'};
            font-size: 14px;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        `;

        categoryButton.addEventListener('click', (e) => {
            this.showCategoryDropdown(e);
        });

        categoryButton.addEventListener('mouseenter', () => {
            categoryButton.style.borderColor = '#5af';
            categoryButton.style.background = '#3a3a3a';
        });

        categoryButton.addEventListener('mouseleave', () => {
            categoryButton.style.borderColor = '#555';
            categoryButton.style.background = '#333';
        });

        categoryButtonContainer.appendChild(categoryButton);

        // Rename category button (only shown when category is selected)
        if (this.selectedCategory) {
            const renameCategoryBtn = document.createElement('button');
            renameCategoryBtn.innerHTML = getIconHtml(this.editIcon, '✏️');
            renameCategoryBtn.title = `Rename "${this.selectedCategory}" category`;
            renameCategoryBtn.style.cssText = `
                padding: 8px 12px;
                border: 1px solid #555;
                border-radius: 6px;
                background: #333;
                color: #5af;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            `;

            renameCategoryBtn.addEventListener('click', () => {
                this.showRenameCategoryDialog(this.selectedCategory);
            });

            renameCategoryBtn.addEventListener('mouseenter', () => {
                renameCategoryBtn.style.borderColor = '#5af';
                renameCategoryBtn.style.background = '#3a3a3a';
            });

            renameCategoryBtn.addEventListener('mouseleave', () => {
                renameCategoryBtn.style.borderColor = '#555';
                renameCategoryBtn.style.background = '#333';
            });

            categoryButtonContainer.appendChild(renameCategoryBtn);
        }

        categorySection.appendChild(categoryButtonContainer);
        container.appendChild(categorySection);

        // Quick add form (shown only when category is selected)
        if (this.selectedCategory) {
            // Determine colors based on edit mode
            const isEditMode = this.editingPresetData !== null;
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
            quickAddTitle.textContent = this.editingPresetData ? `Quick Edit Preset: ${this.editingPresetData.name}` : 'Quick Add Preset';
            quickAddTitle.style.cssText = `color: ${titleColor}; font-size: 13px; font-weight: bold; margin-bottom: 6px;`;
            quickAddSection.appendChild(quickAddTitle);

            const quickAddForm = document.createElement('div');
            quickAddForm.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

            // Name input with error message
            const nameGroup = document.createElement('div');
            nameGroup.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Name';
            nameLabel.style.cssText = 'color: #ccc; font-size: 11px; font-weight: bold;';
            const nameInput = document.createElement('input');
            nameInput.id = 'quick-name-input';
            nameInput.type = 'text';
            nameInput.placeholder = 'Preset name';
            nameInput.value = this.editingPresetData ? this.editingPresetData.name : '';
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

            // Width and Height in a row
            const dimensionsRow = document.createElement('div');
            dimensionsRow.style.cssText = 'display: flex; gap: 6px;';

            // Width input with error message
            const widthGroup = document.createElement('div');
            widthGroup.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';
            const widthLabel = document.createElement('label');
            widthLabel.textContent = 'Width';
            widthLabel.style.cssText = 'color: #ccc; font-size: 11px; font-weight: bold;';
            const widthInput = document.createElement('input');
            widthInput.id = 'quick-width-input';
            widthInput.type = 'number';
            widthInput.placeholder = '512';
            widthInput.min = '64';
            widthInput.step = '1';
            widthInput.value = this.editingPresetData ? this.editingPresetData.width : '';
            widthInput.style.cssText = `
                padding: 6px;
                border: 1px solid #555;
                border-radius: 4px;
                background: #333;
                color: #fff;
                font-size: 13px;
                outline: none;
            `;
            const widthErrorMsg = document.createElement('div');
            widthErrorMsg.id = 'width-error-msg';
            widthErrorMsg.style.cssText = `
                color: #f55;
                font-size: 11px;
                margin-top: 2px;
                min-height: 14px;
            `;
            widthGroup.appendChild(widthLabel);
            widthGroup.appendChild(widthInput);
            widthGroup.appendChild(widthErrorMsg);

            // Height input with error message
            const heightGroup = document.createElement('div');
            heightGroup.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px;';
            const heightLabel = document.createElement('label');
            heightLabel.textContent = 'Height';
            heightLabel.style.cssText = 'color: #ccc; font-size: 11px; font-weight: bold;';
            const heightInput = document.createElement('input');
            heightInput.id = 'quick-height-input';
            heightInput.type = 'number';
            heightInput.placeholder = '512';
            heightInput.min = '64';
            heightInput.step = '1';
            heightInput.value = this.editingPresetData ? this.editingPresetData.height : '';
            heightInput.style.cssText = `
                padding: 6px;
                border: 1px solid #555;
                border-radius: 4px;
                background: #333;
                color: #fff;
                font-size: 13px;
                outline: none;
            `;
            const heightErrorMsg = document.createElement('div');
            heightErrorMsg.id = 'height-error-msg';
            heightErrorMsg.style.cssText = `
                color: #f55;
                font-size: 11px;
                margin-top: 2px;
                min-height: 14px;
            `;
            heightGroup.appendChild(heightLabel);
            heightGroup.appendChild(heightInput);
            heightGroup.appendChild(heightErrorMsg);

            dimensionsRow.appendChild(widthGroup);
            dimensionsRow.appendChild(heightGroup);

            // Preview container for shape visualization
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
            const labelColor = this.editingPresetData ? '#5f5' : '#5af';
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

            // Function to update preview shape
            const updatePreviewShape = () => {
                const width = parseInt(widthInput.value) || 0;
                const height = parseInt(heightInput.value) || 0;
                
                if (width > 0 && height > 0) {
                    // Calculate scale to fit in 160x120 container
                    const maxWidth = 145;
                    const maxHeight = 105;
                    const scale = Math.min(maxWidth / width, maxHeight / height);
                    
                    const scaledWidth = width * scale;
                    const scaledHeight = height * scale;
                    
                    previewShape.style.width = `${scaledWidth}px`;
                    previewShape.style.height = `${scaledHeight}px`;
                    
                    // Determine colors based on edit mode
                    const isEditMode = this.editingPresetData !== null;
                    const borderColor = isEditMode ? '#5f5' : '#5af';
                    const bgColor = isEditMode ? 'rgba(80, 255, 80, 0.1)' : 'rgba(90, 170, 255, 0.1)';
                    const textColor = isEditMode ? '#5f5' : '#5af';
                    
                    previewShape.style.border = `2px solid ${borderColor}`;
                    previewShape.style.background = bgColor;
                    
                    // Calculate aspect ratio
                    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                    const divisor = gcd(width, height);
                    const ratioW = width / divisor;
                    const ratioH = height / divisor;
                    
                    previewText.innerHTML = `
                        <div style="color: ${textColor};">${width}×${height}</div>
                        <div style="font-size: 10px; color: #888;">${ratioW}:${ratioH}</div>
                    `;
                    
                    previewContainer.style.display = 'flex';
                } else {
                    previewContainer.style.display = 'none';
                }
            };

            // Validation function to check form and enable/disable button
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
                    // Check if name exists
                    const customPresets = this.manager.getCustomPresets();
                    const categoryPresets = customPresets[this.selectedCategory] || {};
                    const nameExists = Object.keys(categoryPresets).includes(enteredName);
                    
                    // If editing, allow the current preset name
                    if (this.editingPresetName) {
                        if (enteredName !== this.editingPresetName && nameExists) {
                            nameInput.style.borderColor = '#f55';
                            nameErrorMsg.textContent = `⚠️ Preset "${enteredName}" already exists`;
                            isValid = false;
                        }
                    } else {
                        // Not editing - just check if exists
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
            
            // Add event listeners to all inputs
            nameInput.addEventListener('input', validateForm);
            widthInput.addEventListener('input', () => {
                validateForm();
                updatePreviewShape();
            });
            heightInput.addEventListener('input', () => {
                validateForm();
                updatePreviewShape();
            });

            // Button container for + and X buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; flex-direction: row; gap: 4px;';

            // Add button
            const addButton = document.createElement('button');
            addButton.id = 'quick-add-button';
            
            // Determine button content based on edit mode (isEditMode already declared above)
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
            addButton.addEventListener('click', () => this.quickAddPreset());
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
            if (this.editingPresetName) {
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
                cancelButton.addEventListener('click', () => this.cancelEdit());
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

            quickAddForm.appendChild(nameGroup);
            quickAddForm.appendChild(dimensionsRow);
            quickAddForm.appendChild(previewContainer);
            quickAddForm.appendChild(buttonContainer);

            quickAddSection.appendChild(quickAddForm);
            container.appendChild(quickAddSection);
            
            // Initial validation and preview (after all elements are created and in DOM)
            validateForm();
            updatePreviewShape();

            // Validation message - directly under the form
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
            this.presetPreviewContainer = document.createElement('div');
            this.presetPreviewContainer.id = 'preset-preview';
            this.presetPreviewContainer.style.cssText = `
                margin-top: 12px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid #444;
                border-radius: 6px;
                max-height: 300px;
                overflow-y: auto;
            `;

            const previewTitle = document.createElement('div');
            previewTitle.textContent = `Presets in "${this.selectedCategory}"`;
            previewTitle.style.cssText = `
                color: #5af;
                font-size: 13px;
                font-weight: bold;
                margin-bottom: 8px;
                padding-bottom: 6px;
                border-bottom: 1px solid #444;
            `;
            this.presetPreviewContainer.appendChild(previewTitle);

            const presetsGrid = document.createElement('div');
            presetsGrid.id = 'presets-grid';
            presetsGrid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            `;
            this.presetPreviewContainer.appendChild(presetsGrid);
            
            // Store reference for updatePresetPreview
            this.presetsGrid = presetsGrid;

            container.appendChild(this.presetPreviewContainer);

            // Update preview
            this.updatePresetPreview();
        }
    }

    /**
     * Creates a form group (label + input)
     */
    createFormGroup(label, id, type, placeholder, value = '') {
        const group = document.createElement('div');
        group.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        labelEl.style.cssText = 'color: #ccc; font-size: 13px; font-weight: bold;';

        const input = document.createElement('input');
        input.id = id;
        input.type = type;
        input.placeholder = placeholder;
        input.value = value;
        if (type === 'number') {
            input.min = '64';
            input.step = '1';
        }
        input.style.cssText = `
            padding: 10px 12px;
            border: 1px solid #555;
            border-radius: 6px;
            background: #333;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = '#5af';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#555';
        });

        group.appendChild(labelEl);
        group.appendChild(input);

        return group;
    }

    /**
     * Renders the footer with action buttons
     */
    renderFooter() {
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 20px;
            border-top: 2px solid #444;
            display: flex;
            gap: 12px;
            justify-content: space-between;
        `;

        // Left side buttons
        const leftButtons = document.createElement('div');
        leftButtons.style.cssText = 'display: flex; gap: 12px;';

        if (this.currentView === 'list') {
            const addBtn = this.createFooterButton('➕ Add Preset', 'primary', () => {
                this.currentView = 'add';
                this.editingPreset = null;
                this.renderDialog();
            });
            leftButtons.appendChild(addBtn);

            // Delete selected button (only shown when there are selected items)
            const deleteSelectedBtn = document.createElement('button');
            deleteSelectedBtn.id = 'delete-selected-btn';
            const selectedCount = this.selectedPresetsForDeletion.size;
            const deleteIconHtml = this.deleteIcon ? `<img src="${this.deleteIcon.src}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">` : '🗑️ ';
            const btnText = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
            deleteSelectedBtn.innerHTML = deleteIconHtml + btnText;
            deleteSelectedBtn.style.cssText = `
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                background: ${selectedCount > 0 ? '#f55' : '#666'};
                color: ${selectedCount > 0 ? '#fff' : '#999'};
                opacity: ${selectedCount > 0 ? '1' : '0.5'};
            `;
            deleteSelectedBtn.disabled = selectedCount === 0;
            deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedPresets());
            deleteSelectedBtn.addEventListener('mouseenter', () => {
                if (selectedCount > 0) {
                    deleteSelectedBtn.style.background = '#f77';
                }
            });
            deleteSelectedBtn.addEventListener('mouseleave', () => {
                if (selectedCount > 0) {
                    deleteSelectedBtn.style.background = '#f55';
                }
            });
            leftButtons.appendChild(deleteSelectedBtn);

            const importIconHtml = getIconHtml(this.importIcon, '📥', 18, 'vertical-align: middle; margin-right: 4px;');
            const importBtn = this.createFooterButton(importIconHtml + ' Import', 'secondary', () => {
                this.importPresets();
            });
            leftButtons.appendChild(importBtn);

            const exportIconHtml = getIconHtml(this.exportIcon, '📤', 18, 'vertical-align: middle; margin-right: 4px;');
            const exportBtn = this.createFooterButton(exportIconHtml + ' Export', 'secondary', () => {
                this.exportPresets();
            });
            leftButtons.appendChild(exportBtn);
        } else if (this.currentView === 'add') {
            const backBtn = this.createFooterButton('← Back to List', 'secondary', () => {
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

        // Right side button
        const rightButtons = document.createElement('div');
        const closeBtn = this.createFooterButton('Close', 'secondary', () => {
            this.hide();
        });
        rightButtons.appendChild(closeBtn);

        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);
        this.container.appendChild(footer);
    }

    /**
     * Creates a footer button
     */
    createFooterButton(text, style, onClick) {
        const btn = document.createElement('button');
        // Support both text and HTML (for SVG icons)
        if (text.includes('<img')) {
            btn.innerHTML = text;
        } else {
            btn.textContent = text;
        }
        btn.style.cssText = `
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;

        if (style === 'primary') {
            btn.style.background = '#5af';
            btn.style.color = '#000';
        } else {
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.border = '1px solid #666';
            btn.style.color = '#ddd';
        }

        btn.addEventListener('click', onClick);

        btn.addEventListener('mouseenter', () => {
            if (style === 'primary') {
                btn.style.background = '#7cf';
            } else {
                btn.style.background = 'rgba(255,255,255,0.15)';
            }
        });

        btn.addEventListener('mouseleave', () => {
            if (style === 'primary') {
                btn.style.background = '#5af';
            } else {
                btn.style.background = 'rgba(255,255,255,0.1)';
            }
        });

        return btn;
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
        const customPresets = this.manager.getCustomPresets();
        const json = JSON.stringify(customPresets, null, 2);

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
     * Creates a column for one aspect ratio
     */
    createRatioColumn(ratio, presetList) {
        const column = document.createElement('div');
        column.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 0 0 auto;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 3px;
        `;

        // Icon at the top
        const firstPreset = presetList[0];
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
            color: #5af;
            margin-bottom: 2px;
        `;
        iconContainer.innerHTML = AspectRatioUtils.getAspectRatioIcon(firstPreset.width, firstPreset.height);
        column.appendChild(iconContainer);

        // Ratio text below icon
        const ratioText = document.createElement('div');
        ratioText.textContent = ratio;
        ratioText.style.cssText = `
            color: #5af;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 3px;
            padding-bottom: 2px;
            border-bottom: 1px solid #444;
            width: 100%;
            text-align: center;
        `;
        column.appendChild(ratioText);

        // Preset list (vertical)
        const presetListContainer = document.createElement('div');
        presetListContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 100%;
            max-height: 200px;
            overflow-y: auto;
            flex-shrink: 0;
        `;

        presetList.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.style.cssText = `
                padding: 3px 4px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid #444;
                border-radius: 2px;
                cursor: pointer;
                transition: background 0.2s, border-color 0.2s;
                text-align: center;
                display: flex;
                flex-direction: column;
                position: relative;
                height: 38px;
                box-sizing: border-box;
                overflow: hidden;
                flex-shrink: 0;
            `;

            // Preset name with custom icon if applicable
            const nameDiv = document.createElement('div');
            const customIcon = preset.isCustom && this.customPresetIcon ? 
                `<img src="${this.customPresetIcon.src}" style="width: 12px; height: 12px; margin-left: 3px; vertical-align: middle;">` : '';
            nameDiv.innerHTML = `${preset.name}${customIcon}`;
            nameDiv.style.cssText = `
                color: #ddd;
                font-size: 13px;
                font-weight: normal;
                margin-bottom: 1px;
                word-wrap: break-word;
                word-break: break-word;
                max-width: 100px;
            `;
            
            // Dimensions below name
            const dimensionsDiv = document.createElement('div');
            dimensionsDiv.textContent = `${preset.width}×${preset.height}`;
            dimensionsDiv.style.cssText = `
                color: #888;
                font-size: 11px;
            `;

            // Delete button (appears on hover)
            const deleteBtn = document.createElement('button');
            const deleteIconHtml = this.deleteIcon ? `<img src="${this.deleteIcon.src}" style="width: 12px; height: 12px; display: block;">` : '🗑️';
            if (this.deleteIcon) {
                deleteBtn.innerHTML = deleteIconHtml;
            } else {
                deleteBtn.textContent = '🗑️';
            }
            deleteBtn.title = 'Delete';
            deleteBtn.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                padding: 2px 4px;
                border: none;
                border-radius: 2px;
                background: rgba(255,0,0,0.8);
                color: #fff;
                font-size: 10px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s;
            `;

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete preset "${preset.name}"?`)) {
                    this.manager.deletePreset(this.selectedCategory, preset.name);
                    this.updatePresetPreview();
                    log.debug(`Deleted preset: ${this.selectedCategory}/${preset.name}`);
                }
            });

            presetItem.appendChild(nameDiv);
            presetItem.appendChild(dimensionsDiv);
            presetItem.appendChild(deleteBtn);

            // Click to load preset values into quick add form
            presetItem.addEventListener('click', () => {
                if (preset.isCustom) {
                    // Custom preset - enter edit mode
                    this.editingPresetName = preset.name;
                    this.editingPresetData = {
                        name: preset.name,
                        width: preset.width,
                        height: preset.height
                    };
                } else {
                    // Built-in preset - use as template (no edit mode)
                    this.editingPresetName = null;
                    this.editingPresetData = {
                        name: preset.name,
                        width: preset.width,
                        height: preset.height
                    };
                }
                
                // Re-render to show form with values
                this.renderDialog();
            });

            presetItem.addEventListener('mouseenter', () => {
                presetItem.style.background = 'rgba(255, 255, 255, 0.15)';
                presetItem.style.borderColor = '#666';
                deleteBtn.style.opacity = '1';
            });

            presetItem.addEventListener('mouseleave', () => {
                presetItem.style.background = 'rgba(255, 255, 255, 0.05)';
                presetItem.style.borderColor = '#444';
                deleteBtn.style.opacity = '0';
            });

            presetListContainer.appendChild(presetItem);
        });

        column.appendChild(presetListContainer);
        return column;
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
        
        // Change to flex layout for columns
        presetsGrid.style.cssText = `
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding: 4px;
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

        // Create a column for each aspect ratio
        for (const [ratio, presetList] of Object.entries(groupedPresets)) {
            const column = this.createRatioColumn(ratio, presetList);
            presetsGrid.appendChild(column);
        }
    }

    /**
     * Creates a preset card for the preview
     */
    createPresetCard(name, dims) {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(255,255,255,0.05);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 8px;
            transition: all 0.2s;
            cursor: pointer;
        `;

        card.addEventListener('mouseenter', () => {
            card.style.background = 'rgba(255,255,255,0.1)';
            card.style.borderColor = '#666';
        });

        card.addEventListener('mouseleave', () => {
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.borderColor = '#444';
        });

        // Preset name
        const nameDiv = document.createElement('div');
        nameDiv.textContent = name;
        nameDiv.style.cssText = `
            color: #fff;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        nameDiv.title = name; // Tooltip for long names

        // Dimensions
        const dimsDiv = document.createElement('div');
        dimsDiv.textContent = `${dims.width}×${dims.height}`;
        dimsDiv.style.cssText = `
            color: #888;
            font-size: 12px;
            margin-bottom: 6px;
        `;

        // Delete button
        const deleteBtn = document.createElement('button');
        const deleteIconHtml = this.deleteIcon ? `<img src="${this.deleteIcon.src}" style="width: 12px; height: 12px; display: block; margin: 0 auto;">` : '🗑️';
        if (this.deleteIcon) {
            deleteBtn.innerHTML = deleteIconHtml;
        } else {
            deleteBtn.textContent = '🗑️';
        }
        deleteBtn.title = 'Delete';
        deleteBtn.style.cssText = `
            width: 100%;
            padding: 4px;
            border: 1px solid #666;
            border-radius: 3px;
            background: rgba(255,0,0,0.1);
            color: #f55;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        `;

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete preset "${name}"?`)) {
                this.manager.deletePreset(this.selectedCategory, name);
                this.updatePresetPreview(); // Refresh preview
                log.debug(`Deleted preset: ${this.selectedCategory}/${name}`);
            }
        });

        deleteBtn.addEventListener('mouseenter', () => {
            deleteBtn.style.background = 'rgba(255,0,0,0.2)';
        });

        deleteBtn.addEventListener('mouseleave', () => {
            deleteBtn.style.background = 'rgba(255,0,0,0.1)';
        });

        card.appendChild(nameDiv);
        card.appendChild(dimsDiv);
        card.appendChild(deleteBtn);

        return card;
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
     * Shows a dialog to rename the category
     * @param {string} currentCategoryName - Current category name
     */
    showRenameCategoryDialog(currentCategoryName) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
        `;
        overlay.addEventListener('mousedown', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        document.body.appendChild(overlay);

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent clicks inside from closing
        dialog.style.cssText = `
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
            border: 2px solid #555;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            z-index: 10001;
            font-family: Arial, sans-serif;
            min-width: 320px;
        `;
        
        // Create dialog content
        dialog.innerHTML = `
            <div style="color: #fff; font-size: 16px; font-weight: bold; margin-bottom: 15px; text-align: center;">Rename Category</div>
            <div style="margin-bottom: 10px;">
                <label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 5px;">Current: ${currentCategoryName}</label>
                <input type="text" id="renameCategoryInput" value="${currentCategoryName}"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px; background: #333; color: #fff; font-size: 14px; box-sizing: border-box; outline: none;">
            </div>
            <div id="renameValidationMessage" style="color: #f55; font-size: 11px; margin-bottom: 10px; min-height: 15px;"></div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="renameCancelBtn" style="padding: 8px 16px; border: 1px solid #555; border-radius: 4px; background: #444; color: #ccc; cursor: pointer; font-size: 12px; transition: all 0.2s;">Cancel</button>
                <button id="renameApplyBtn" style="padding: 8px 16px; border: 1px solid #5af; border-radius: 4px; background: #5af; color: #000; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.2s;">Apply</button>
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
        
        // Hover effects
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#555';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = '#444';
        });
        
        applyBtn.addEventListener('mouseenter', () => {
            if (!applyBtn.disabled) {
                applyBtn.style.background = '#7cf';
            }
        });
        applyBtn.addEventListener('mouseleave', () => {
            if (!applyBtn.disabled) {
                applyBtn.style.background = '#5af';
            }
        });
        
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
            const customPresets = this.manager.getCustomPresets();
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
            
            // Debug logging
            console.log('[PresetManagerDialog] Attempting to rename category:');
            console.log('  Old name:', currentCategoryName);
            console.log('  New name:', trimmedNewName);
            console.log('  Current categories:', Object.keys(this.manager.getCustomPresets()));
            
            // Try to rename
            const success = this.manager.renameCategory(currentCategoryName, trimmedNewName);
            
            if (success) {
                // Success - update selected category and refresh dialog
                this.selectedCategory = trimmedNewName;
                document.body.removeChild(overlay);
                document.body.removeChild(dialog);
                this.renderDialog();
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
        input.style.cssText = `
            color: #5af;
            font-size: 14px;
            font-weight: bold;
            background: #333;
            border: 2px solid #5af;
            border-radius: 4px;
            padding: 2px 6px;
            outline: none;
            width: 200px;
        `;
        
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
                const newTitle = recreateTitleElement(originalText);
                input.replaceWith(newTitle);
                return;
            }
            
            if (newName === categoryNameOnly) {
                // No change - restore original
                const newTitle = recreateTitleElement(originalText);
                input.replaceWith(newTitle);
                return;
            }
            
            // Debug logging
            console.log('[PresetManagerDialog] Attempting to rename category:');
            console.log('  Old name:', categoryNameOnly);
            console.log('  New name:', newName);
            console.log('  Current categories:', Object.keys(this.manager.getCustomPresets()));
            
            // Try to rename
            const success = this.manager.renameCategory(categoryNameOnly, newName);
            
            if (success) {
                // Success - refresh dialog
                this.renderDialog();
            } else {
                // Failed - show error and keep editing
                alert(`Cannot rename category to "${newName}". It may already exist or be invalid.\n\nOld name: "${categoryNameOnly}"\nCheck browser console for details.`);
                input.focus();
                input.select();
            }
        };
        
        // Recreate title element function
        const recreateTitleElement = (text) => {
            const newTitle = document.createElement('div');
            newTitle.style.cssText = `
                color: #5af;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                user-select: none;
            `;
            newTitle.textContent = text;
            newTitle.title = 'Double-click to rename category';
            newTitle.addEventListener('dblclick', () => {
                this.startRenamingCategory(newTitle, categoryNameOnly);
            });
            return newTitle;
        };
        
        // Handle Escape key - cancel
        const handleCancel = () => {
            const newTitle = recreateTitleElement(originalText);
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
        input.style.cssText = `
            color: #fff;
            font-size: 13px;
            font-weight: bold;
            background: #333;
            border: 2px solid #5af;
            border-radius: 4px;
            padding: 2px 6px;
            outline: none;
            width: 120px;
        `;
        
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
                const newNameElement = recreateNameElement(originalText);
                input.replaceWith(newNameElement);
                return;
            }
            
            if (newName === presetName) {
                // No change - restore original
                const newNameElement = recreateNameElement(originalText);
                input.replaceWith(newNameElement);
                return;
            }
            
            // Check if new name already exists in category
            const customPresets = this.manager.getCustomPresets();
            const categoryPresets = customPresets[category] || {};
            if (Object.keys(categoryPresets).includes(newName)) {
                // Name exists - show error and keep editing
                alert(`Preset "${newName}" already exists in category "${category}".\n\nPlease choose a different name.`);
                isSaving = false; // Reset flag to allow retry
                input.focus();
                input.select();
                return;
            }
            
            // Debug logging
            console.log('[PresetManagerDialog] Attempting to rename preset:');
            console.log('  Category:', category);
            console.log('  Old name:', presetName);
            console.log('  New name:', newName);
            console.log('  Dimensions:', dims);
            
            // Try to rename using updatePreset
            const success = this.manager.updatePreset(category, presetName, newName, dims.width, dims.height);
            
            if (success) {
                // Success - refresh dialog
                this.renderDialog();
            } else {
                // Failed - show error and keep editing
                alert(`Cannot rename preset to "${newName}".\n\nOld name: "${presetName}"\nCheck browser console for details.`);
                isSaving = false; // Reset flag to allow retry
                input.focus();
                input.select();
            }
        };
        
        // Recreate name element function
        const recreateNameElement = (text) => {
            const newNameElement = document.createElement('strong');
            newNameElement.textContent = text;
            newNameElement.title = 'Double-click to rename preset';
            newNameElement.style.cssText = 'cursor: pointer; user-select: none;';
            newNameElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startRenamingPreset(newNameElement, category, presetName, dims);
            });
            return newNameElement;
        };
        
        // Handle Escape key - cancel
        const handleCancel = () => {
            const newNameElement = recreateNameElement(originalText);
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
     * Hides and cleans up the dialog
     */
    hide() {
        // Close SearchableDropdown if it's open
        if (this.searchableDropdown) {
            this.searchableDropdown.hide();
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
