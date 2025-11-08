// SearchableDropdown.js - A searchable dropdown component for better UX with large lists
import { createModuleLogger } from "./utils/LoggerUtils.js";
import { loadIcons } from "./utils/IconUtils.js";

const log = createModuleLogger('SearchableDropdown');

export class SearchableDropdown {
    constructor() {
        this.overlay = null;
        this.container = null;
        this.searchInput = null;
        this.itemsContainer = null;
        this.isActive = false;
        this.items = [];
        this.filteredItems = [];
        this.selectedIndex = -1;
        this.callback = null;
        this.isExpanded = false;
        
        // Constants for layout calculations
        this.ITEM_HEIGHT = 28; // Height per item in pixels (padding + line-height)
        this.DEFAULT_MAX_HEIGHT = 300; // Default max-height of itemsContainer
        this.EXPANDED_BOTTOM_MARGIN = 0; // Bottom margin when expanded
        
        // Load custom preset icon
        this.customPresetIcon = null;
        const icons = {};
        loadIcons(icons, "#ffffffff"); // Gold color for custom preset icon
        this.customPresetIcon = icons.customPreset;
    }

    /**
     * Shows a searchable dropdown menu
     * @param {Array<string>} items - Array of items to display
     * @param {Object} options - Configuration options
     * @param {Event} options.event - Mouse event for positioning
     * @param {Function} options.callback - Callback function when item is selected
     * @param {string} options.title - Optional title for the dropdown
     * @param {boolean} options.allowCustomValues - Whether to allow custom values via Enter key (default: false)
     * @param {boolean} options.initialExpanded - Initial expanded state (default: false)
     * @param {Function} options.onExpandedChange - Callback when expanded state changes
     */
    show(items, options = {}) {
        // Always ensure we're fully cleaned up before showing
        if (this.isActive || this.container) {
            this.hide();
        }

        this.items = items || [];
        this.filteredItems = [...this.items];
        this.callback = options.callback;
        this.allowCustomValues = options.allowCustomValues || false;
        this.onExpandedChange = options.onExpandedChange;
        this.isActive = true;
        this.selectedIndex = -1;
        this.isExpanded = options.initialExpanded || false;

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'searchable-dropdown-overlay';
        this.overlay.addEventListener('mousedown', () => this.hide());
        document.body.appendChild(this.overlay);

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'searchable-dropdown';
        this.container.addEventListener('mousedown', (e) => e.stopPropagation());

        // Position container
        const event = options.event;
        let x = 100;
        let y = 100;
        
        if (event) {
            x = event.clientX || event.pageX || 100;
            y = event.clientY || event.pageY || 100;
        }
        
        const initialTop = Math.max(10, Math.min(y, window.innerHeight - 400));
        this.container.style.left = `${Math.max(10, Math.min(x, window.innerWidth - 300))}px`;
        this.container.style.top = `${initialTop}px`;
        this.originalTop = initialTop; // Store original position for later restoration

        // Create mode toggle (at the very top) if onModeChange is provided
        if (options.onModeChange) {
            const modeToggleContainer = document.createElement('div');
            modeToggleContainer.style.cssText = `
                padding: 6px 8px;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 1px solid #444;
                background: rgba(0, 0, 0, 0.2);
            `;
            
            const modeLabel = document.createElement('span');
            modeLabel.textContent = 'View:';
            modeLabel.style.cssText = `
                color: #aaa;
                font-size: 11px;
                font-weight: bold;
            `;
            
            const modeToggle = document.createElement('button');
            const useListMode = options.currentMode === 'list';
            modeToggle.textContent = useListMode ? '📝 List' : '🎨 Visual';
            modeToggle.style.cssText = `
                padding: 4px 12px;
                background: ${useListMode ? 'rgba(90, 170, 255, 0.2)' : 'rgba(100, 100, 100, 0.3)'};
                border: 1px solid ${useListMode ? '#5af' : '#666'};
                border-radius: 4px;
                color: ${useListMode ? '#5af' : '#aaa'};
                font-size: 11px;
                cursor: pointer;
                outline: none;
                transition: all 0.2s;
            `;
            
            modeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const newMode = useListMode ? 'visual' : 'list';
                
                const callback = this.callback;
                const items = this.items;
                this.hide();
                
                if (options.onModeChange) {
                    options.onModeChange(newMode, items, { callback, event: options.event });
                }
            });
            
            modeToggle.addEventListener('mouseenter', () => {
                modeToggle.style.background = useListMode ? 'rgba(90, 170, 255, 0.3)' : 'rgba(120, 120, 120, 0.4)';
            });
            
            modeToggle.addEventListener('mouseleave', () => {
                modeToggle.style.background = useListMode ? 'rgba(90, 170, 255, 0.2)' : 'rgba(100, 100, 100, 0.3)';
            });
            
            modeToggleContainer.appendChild(modeLabel);
            modeToggleContainer.appendChild(modeToggle);
            this.container.appendChild(modeToggleContainer);
        }
        
        // Create title if provided
        if (options.title) {
            const titleContainer = document.createElement('div');
            titleContainer.className = 'searchable-dropdown-title-container';
            
            const title = document.createElement('div');
            title.className = 'searchable-dropdown-title';
            title.textContent = options.title;
            
            // Add close button (X)
            const closeButton = document.createElement('button');
            closeButton.className = 'searchable-dropdown-close-btn';
            closeButton.textContent = '×';
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
            });
            
            titleContainer.appendChild(title);
            titleContainer.appendChild(closeButton);
            this.container.appendChild(titleContainer);
        }

        // Create search input
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search...';
        this.searchInput.className = 'searchable-dropdown-search';
        this.searchInput.addEventListener('input', () => this.filterItems());
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.container.appendChild(this.searchInput);

        // Create items container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'searchable-dropdown-items';
        this.container.appendChild(this.itemsContainer);

        // Add expand button
        this.expandButton = document.createElement('button');
        this.expandButton.className = 'searchable-dropdown-expand-btn';
        this.expandButton.textContent = 'Show All';
        this.expandButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand();
        });
        this.container.appendChild(this.expandButton);

        // Add items count indicator
        this.countIndicator = document.createElement('div');
        this.countIndicator.className = 'searchable-dropdown-count';
        this.container.appendChild(this.countIndicator);

        document.body.appendChild(this.container);

        // Render items
        this.renderItems();
        
        // Apply initial expanded state if needed
        if (this.isExpanded) {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                // Check if expand button is visible (only expand if needed)
                if (this.expandButton && this.expandButton.style.display !== 'none') {
                    this.applyExpandedState();
                }
            }, 0);
        }

        // Focus search input
        setTimeout(() => this.searchInput.focus(), 50);
    }

    /**
     * Renders the filtered items list
     */
    renderItems() {
        this.itemsContainer.innerHTML = '';

        if (this.filteredItems.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'searchable-dropdown-no-results';
            
            // Show hint about custom values if allowed and search has text
            if (this.allowCustomValues && this.searchInput.value.trim()) {
                // Create "No results found" text
                const noResultsText = document.createElement('div');
                noResultsText.textContent = 'No results found';
                noResults.appendChild(noResultsText);
                
                // Add button that acts like Enter key - ABOVE the hint text
                const useCustomButton = document.createElement('button');
                useCustomButton.className = 'searchable-dropdown-use-custom-btn';
                useCustomButton.textContent = 'Use Custom Value';
                useCustomButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectItem(this.searchInput.value.trim());
                });
                noResults.appendChild(useCustomButton);
                
                // Add hint text below the button
                const hintText = document.createElement('div');
                hintText.className = 'searchable-dropdown-hint';
                hintText.textContent = 'Press Enter to use custom value';
                noResults.appendChild(hintText);
            } else {
                noResults.textContent = 'No results found';
            }
            
            this.itemsContainer.appendChild(noResults);
            this.updateCountIndicator();
            return;
        }

        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredItems.forEach((item, index) => {
            // Support both string items and object items with { text, isCustom } structure
            const itemText = typeof item === 'string' ? item : item.text;
            const isCustom = typeof item === 'object' && item.isCustom;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'searchable-dropdown-item';

            // Add custom preset indicator (SVG icon) if this is a custom preset - on the RIGHT side
            const customIndicator = isCustom && this.customPresetIcon ? 
                `<img src="${this.customPresetIcon.src}" style="width: 14px; height: 14px; margin-left: 6px; vertical-align: middle;">` : '';

            // Highlight matching text
            if (searchTerm) {
                const lowerItem = itemText.toLowerCase();
                const matchIndex = lowerItem.indexOf(searchTerm);
                
                if (matchIndex !== -1) {
                    const before = itemText.substring(0, matchIndex);
                    const match = itemText.substring(matchIndex, matchIndex + searchTerm.length);
                    const after = itemText.substring(matchIndex + searchTerm.length);
                    
                    itemElement.innerHTML = `${this.escapeHtml(before)}<span class="searchable-dropdown-highlight">${this.escapeHtml(match)}</span>${this.escapeHtml(after)}${customIndicator}`;
                } else {
                    itemElement.innerHTML = `${this.escapeHtml(itemText)}${customIndicator}`;
                }
            } else {
                itemElement.innerHTML = `${this.escapeHtml(itemText)}${customIndicator}`;
            }

            // Hover effect
            itemElement.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            itemElement.addEventListener('mouseleave', () => {
                if (this.selectedIndex === index) {
                    this.selectedIndex = -1;
                    this.updateSelection();
                }
            });

            // Click handler - return the text value, not the object
            itemElement.addEventListener('click', () => {
                this.selectItem(itemText);
            });

            this.itemsContainer.appendChild(itemElement);
        });

        this.updateSelection();
        this.updateCountIndicator();
    }

    /**
     * Filters items based on search input
     */
    filterItems() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item => {
                const itemText = typeof item === 'string' ? item : item.text;
                return itemText.toLowerCase().includes(searchTerm);
            });
        }

        this.selectedIndex = -1;
        this.renderItems();
    }

    /**
     * Updates visual selection highlighting
     */
    updateSelection() {
        const items = this.itemsContainer.querySelectorAll('.searchable-dropdown-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                // Scroll into view if needed
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Updates the count indicator at the bottom
     */
    updateCountIndicator() {
        const total = this.items.length;
        const shown = this.filteredItems.length;
        
        if (shown === total) {
            this.countIndicator.textContent = `${total} item${total !== 1 ? 's' : ''}`;
        } else {
            this.countIndicator.textContent = `${shown} of ${total} item${total !== 1 ? 's' : ''}`;
        }
        
        // Show/hide expand button based on whether all items fit in default height
        if (this.expandButton) {
            const neededHeight = this.filteredItems.length * this.ITEM_HEIGHT;
            
            if (neededHeight > this.DEFAULT_MAX_HEIGHT) {
                this.expandButton.style.display = 'block';
            } else {
                this.expandButton.style.display = 'none';
                // Also reset to collapsed state if button is hidden
                if (this.isExpanded) {
                    this.isExpanded = false;
                    this.itemsContainer.style.maxHeight = `${this.DEFAULT_MAX_HEIGHT}px`;
                    this.container.style.maxHeight = '400px';
                }
            }
        }
    }

    /**
     * Handles keyboard navigation
     */
    handleKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (this.filteredItems.length > 0) {
                    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
                    this.updateSelection();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (this.filteredItems.length > 0) {
                    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                    this.updateSelection();
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
                    const selectedItem = this.filteredItems[this.selectedIndex];
                    const itemText = typeof selectedItem === 'string' ? selectedItem : selectedItem.text;
                    this.selectItem(itemText);
                } else if (this.filteredItems.length === 1) {
                    // Auto-select if only one item
                    const singleItem = this.filteredItems[0];
                    const itemText = typeof singleItem === 'string' ? singleItem : singleItem.text;
                    this.selectItem(itemText);
                } else if (this.allowCustomValues && this.searchInput.value.trim()) {
                    // Allow custom value only if allowCustomValues is true
                    this.selectItem(this.searchInput.value.trim());
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.hide();
                break;

            case 'Home':
                e.preventDefault();
                if (this.filteredItems.length > 0) {
                    this.selectedIndex = 0;
                    this.updateSelection();
                }
                break;

            case 'End':
                e.preventDefault();
                if (this.filteredItems.length > 0) {
                    this.selectedIndex = this.filteredItems.length - 1;
                    this.updateSelection();
                }
                break;
        }
    }

    /**
     * Applies the expanded state without toggling
     */
    applyExpandedState() {
        if (!this.isExpanded) return;
        
        // Get current dimensions BEFORE making any changes
        const currentRect = this.container.getBoundingClientRect();
        const currentItemsHeight = this.itemsContainer.getBoundingClientRect().height;
        
        // Calculate overhead (everything except the items container)
        const overhead = currentRect.height - currentItemsHeight;
        
        // Calculate how much height we need for all items (no extra padding)
        const neededHeight = this.filteredItems.length * this.ITEM_HEIGHT;
        
        // Determine the actual expanded height we'll use for items
        const maxAllowedItemsHeight = window.innerHeight - this.EXPANDED_BOTTOM_MARGIN - overhead;
        const expandedItemsHeight = Math.min(neededHeight, maxAllowedItemsHeight);
        
        // Calculate the total container height (items + overhead)
        const totalContainerHeight = expandedItemsHeight + overhead;
        
        // Use viewport-relative position (getBoundingClientRect gives us position relative to viewport)
        const currentViewportTop = currentRect.top;
        
        // Calculate what the bottom would be if we expand from current viewport position
        const potentialBottom = currentViewportTop + totalContainerHeight;
        
        // If it would overflow viewport, calculate new position BEFORE setting heights
        if (potentialBottom > window.innerHeight - this.EXPANDED_BOTTOM_MARGIN) {
            // Calculate new viewport-relative top position
            let newViewportTop = window.innerHeight - totalContainerHeight - this.EXPANDED_BOTTOM_MARGIN;
            // Ensure it doesn't go above screen top
            newViewportTop = Math.max(10, newViewportTop);
            
            // Convert viewport-relative position to document-relative position
            const newDocumentTop = newViewportTop + window.pageYOffset;
            this.container.style.top = `${newDocumentTop}px`;
        }
        
        // Now apply the expanded heights
        this.itemsContainer.style.maxHeight = `${expandedItemsHeight}px`;
        this.container.style.maxHeight = `${totalContainerHeight}px`;
        this.expandButton.textContent = 'Show Less';
    }

    /**
     * Toggles the expanded state of the dropdown list
     */
    toggleExpand() {
        this.isExpanded = !this.isExpanded;
        
        // Notify about state change
        if (this.onExpandedChange) {
            this.onExpandedChange(this.isExpanded);
        }
        
        if (this.isExpanded) {
            // Get current dimensions BEFORE making any changes
            const currentRect = this.container.getBoundingClientRect();
            const currentItemsHeight = this.itemsContainer.getBoundingClientRect().height;
            
            // Calculate overhead (everything except the items container)
            const overhead = currentRect.height - currentItemsHeight;
            
            // Calculate how much height we need for all items (no extra padding)
            const neededHeight = this.filteredItems.length * this.ITEM_HEIGHT;
            
            // Determine the actual expanded height we'll use for items
            const maxAllowedItemsHeight = window.innerHeight - this.EXPANDED_BOTTOM_MARGIN - overhead;
            const expandedItemsHeight = Math.min(neededHeight, maxAllowedItemsHeight);
            
            // Calculate the total container height (items + overhead)
            const totalContainerHeight = expandedItemsHeight + overhead;
            
            // Use viewport-relative position (getBoundingClientRect gives us position relative to viewport)
            const currentViewportTop = currentRect.top;
            
            // Calculate what the bottom would be if we expand from current viewport position
            const potentialBottom = currentViewportTop + totalContainerHeight;
            
            // If it would overflow viewport, calculate new position BEFORE setting heights
            if (potentialBottom > window.innerHeight - this.EXPANDED_BOTTOM_MARGIN) {
                // Calculate new viewport-relative top position
                let newViewportTop = window.innerHeight - totalContainerHeight - this.EXPANDED_BOTTOM_MARGIN;
                // Ensure it doesn't go above screen top
                newViewportTop = Math.max(10, newViewportTop);
                
                // Convert viewport-relative position to document-relative position
                const newDocumentTop = newViewportTop + window.pageYOffset;
                this.container.style.top = `${newDocumentTop}px`;
            }
            
            // Now apply the expanded heights
            this.itemsContainer.style.maxHeight = `${expandedItemsHeight}px`;
            this.container.style.maxHeight = `${totalContainerHeight}px`;
            this.expandButton.textContent = 'Show Less';
        } else {
            // Collapse back to default
            this.itemsContainer.style.maxHeight = `${this.DEFAULT_MAX_HEIGHT}px`;
            this.container.style.maxHeight = '400px';
            this.expandButton.textContent = 'Show All';
            
            // Restore original position
            this.container.style.top = `${this.originalTop}px`;
        }
    }

    /**
     * Selects an item and triggers the callback
     */
    selectItem(item) {
        log.debug(`Item selected: ${item}`);
        
        if (this.callback) {
            this.callback(item);
        }
        
        this.hide();
    }

    /**
     * Hides and cleans up the dropdown
     */
    hide() {
        if (this.container && this.container.parentNode) {
            document.body.removeChild(this.container);
        }
        if (this.overlay && this.overlay.parentNode) {
            document.body.removeChild(this.overlay);
        }
        
        this.container = null;
        this.overlay = null;
        this.searchInput = null;
        this.itemsContainer = null;
        this.isActive = false;
        this.items = [];
        this.filteredItems = [];
        this.selectedIndex = -1;
        this.callback = null;
    }

    /**
     * Escapes HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
