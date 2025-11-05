// AspectRatioSelector.js - Visual aspect ratio selector for presets
import { createModuleLogger } from "./utils/LoggerUtils.js";
import { AspectRatioUtils } from "./utils/AspectRatioUtils.js";
import { loadIcons, getIconHtml } from "./utils/IconUtils.js";

const log = createModuleLogger('AspectRatioSelector');

export class AspectRatioSelector {
    constructor() {
        this.overlay = null;
        this.container = null;
        this.isActive = false;
        this.presets = {};
        this.groupedPresets = {};
        this.selectedPreset = null;
        this.callback = null;
        this.horizontalScrollIndicator = null;
        this.resizeHandler = null;
        
        // Load custom preset icon
        this.customPresetIcon = null;
        const icons = {};
        loadIcons(icons, "#ffffffff");
        this.customPresetIcon = icons.customPreset;
    }

    /**
     * Shows the aspect ratio selector
     */
    show(presets, options = {}) {
        // Always ensure we're fully cleaned up before showing
        if (this.isActive || this.container) {
            this.hide();
        }

        this.presets = presets || {};
        this.callback = options.callback;
        this.selectedPreset = options.selectedPreset;
        this.isActive = true;
        
        // Group presets by aspect ratio
        this.groupedPresets = AspectRatioUtils.groupPresetsByAspectRatio(this.presets);
        
        // Filter out hidden built-in presets from grouped presets
        for (const ratio in this.groupedPresets) {
            this.groupedPresets[ratio] = this.groupedPresets[ratio].filter(preset => !preset.isHidden);
            
            // Remove empty ratios (if all presets were hidden)
            if (this.groupedPresets[ratio].length === 0) {
                delete this.groupedPresets[ratio];
            }
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9998;
        `;
        this.overlay.addEventListener('mousedown', () => this.hide());
        document.body.appendChild(this.overlay);

        // Create container (no overflow here)
        this.container = document.createElement('div');
        this.container.className = 'aspect-ratio-selector';
        this.container.addEventListener('mousedown', (e) => e.stopPropagation());
        this.container.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
            border: 2px solid #555;
            border-radius: 4px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            z-index: 9999;
            font-family: Arial, sans-serif;
            max-width: calc(100vw - 20px);
            max-height: calc(100vh - 20px);
            display: flex;
            flex-direction: column;
        `;
        
        // Add custom scrollbar styling for better visibility
        const style = document.createElement('style');
        style.textContent = `
            .aspect-ratio-selector::-webkit-scrollbar {
                height: 12px;
                width: 12px;
            }
            .aspect-ratio-selector::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }
            .aspect-ratio-selector::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 6px;
                border: 2px solid rgba(0, 0, 0, 0.3);
            }
            .aspect-ratio-selector::-webkit-scrollbar-thumb:hover {
                background: #888;
            }
        `;
        document.head.appendChild(style);

        // Initially position at top-left (will be adjusted after measuring)
        this.container.style.left = '0px';
        this.container.style.top = '0px';

        // Create mode toggle (at the very top)
        const modeToggleContainer = document.createElement('div');
        modeToggleContainer.style.cssText = `
            flex-shrink: 0;
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
        const useVisualMode = options.currentMode !== 'list';
        modeToggle.textContent = useVisualMode ? '🎨 Visual' : '📝 List';
        modeToggle.style.cssText = `
            padding: 4px 12px;
            background: ${useVisualMode ? 'rgba(90, 170, 255, 0.2)' : 'rgba(100, 100, 100, 0.3)'};
            border: 1px solid ${useVisualMode ? '#5af' : '#666'};
            border-radius: 4px;
            color: ${useVisualMode ? '#5af' : '#aaa'};
            font-size: 11px;
            cursor: pointer;
            outline: none;
            transition: all 0.2s;
        `;
        
        modeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const newMode = useVisualMode ? 'list' : 'visual';
            
            // Close current selector and reopen with new mode
            const callback = this.callback;
            const selectedPreset = this.selectedPreset;
            const presets = this.presets;
            this.hide();
            
            if (options.onModeChange) {
                options.onModeChange(newMode, presets, { callback, selectedPreset });
            }
        });
        
        modeToggle.addEventListener('mouseenter', () => {
            modeToggle.style.background = useVisualMode ? 'rgba(90, 170, 255, 0.3)' : 'rgba(120, 120, 120, 0.4)';
        });
        
        modeToggle.addEventListener('mouseleave', () => {
            modeToggle.style.background = useVisualMode ? 'rgba(90, 170, 255, 0.2)' : 'rgba(100, 100, 100, 0.3)';
        });
        
        modeToggleContainer.appendChild(modeLabel);
        modeToggleContainer.appendChild(modeToggle);
        this.container.appendChild(modeToggleContainer);
        
        // Create search bar (fixed at top, outside scroll area)
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `
            flex-shrink:  0;
            padding: 4px;
            border-bottom: 1px solid #444;
        `;

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search presets...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 6px 8px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #555;
            border-radius: 3px;
            color: #ddd;
            font-size: 13px;
            font-family: Arial, sans-serif;
            outline: none;
        `;

        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = '#5af';
            searchInput.style.background = 'rgba(0, 0, 0, 0.4)';
        });

        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = '#555';
            searchInput.style.background = 'rgba(0, 0, 0, 0.3)';
        });

        searchContainer.appendChild(searchInput);
        this.container.appendChild(searchContainer);

        // Create scrollable content wrapper
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'aspect-ratio-selector-scroll';
        scrollWrapper.style.cssText = `
            flex: 1;
            overflow-x: auto;
            overflow-y: auto;
            padding: 4px;
        `;

        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.style.cssText = `
            display: flex;
            gap: 4px;
            min-width: min-content;
        `;

        // Create a column for each aspect ratio
        const columns = [];
        for (const [ratio, presetList] of Object.entries(this.groupedPresets)) {
            const column = this.createRatioColumn(ratio, presetList);
            columnsContainer.appendChild(column);
            columns.push(column);
        }

        scrollWrapper.appendChild(columnsContainer);
        this.container.appendChild(scrollWrapper);

        // Add search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            columns.forEach(column => {
                const presetItems = column.querySelectorAll('[data-preset-item]');
                let hasVisibleItems = false;
                
                presetItems.forEach(item => {
                    const presetName = item.getAttribute('data-preset-name').toLowerCase();
                    const presetDimensions = item.getAttribute('data-preset-dimensions').toLowerCase();
                    
                    if (searchTerm === '' || 
                        presetName.includes(searchTerm) || 
                        presetDimensions.includes(searchTerm)) {
                        item.style.display = 'flex';
                        hasVisibleItems = true;
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Hide column if no visible items
                column.style.display = hasVisibleItems ? 'flex' : 'none';
            });
            
            // Update scroll indicators after filtering
            AspectRatioUtils.updateColumnScrollIndicators(columns);
            updateHorizontalScrollIndicator();
            
            // Reposition container to center after size change
            setTimeout(() => repositionContainer(), 0);
        });
        document.body.appendChild(this.container);
        
        // Update scrollbar styles to apply to scroll wrapper
        style.textContent = `
            .aspect-ratio-selector-scroll::-webkit-scrollbar {
                height: 12px;
                width: 12px;
            }
            .aspect-ratio-selector-scroll::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }
            .aspect-ratio-selector-scroll::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 6px;
                border: 2px solid rgba(0, 0, 0, 0.3);
            }
            .aspect-ratio-selector-scroll::-webkit-scrollbar-thumb:hover {
                background: #888;
            }
        `;

        // Use unified scroll indicators from AspectRatioUtils
        AspectRatioUtils.updateColumnScrollIndicators(columns);

        // Function to reposition container (center on screen)
        const repositionContainer = () => {
            const rect = this.container.getBoundingClientRect();
            
            // Calculate centered position, ensuring it fits on screen with 10px margins
            let x = Math.max(10, Math.min((window.innerWidth - rect.width) / 2, window.innerWidth - rect.width - 10));
            let y = Math.max(10, Math.min((window.innerHeight - rect.height) / 2, window.innerHeight - rect.height - 10));
            
            // If container is wider than screen, align to left with margin
            if (rect.width >= window.innerWidth - 20) {
                x = 10;
            }
            
            // If container is taller than screen, align to top with margin
            if (rect.height >= window.innerHeight - 20) {
                y = 10;
            }
            
            // Set final position
            this.container.style.left = `${x}px`;
            this.container.style.top = `${y}px`;
        };
        
        // Initial positioning
        repositionContainer();

        // Use unified horizontal scroll manager from AspectRatioUtils
        const horizontalScrollState = { indicator: null };
        const updateHorizontalScrollIndicator = AspectRatioUtils.createHorizontalScrollManager(
            scrollWrapper, 
            this.container, 
            horizontalScrollState
        );
        
        // Store reference to indicator state for cleanup
        this.horizontalScrollIndicator = horizontalScrollState;
        
        // Initial check after positioning
        updateHorizontalScrollIndicator();
        
        // Listen for window resize to update both indicators dynamically
        this.resizeHandler = () => {
            updateHorizontalScrollIndicator();
            AspectRatioUtils.updateColumnScrollIndicators(columns);
        };
        window.addEventListener('resize', this.resizeHandler);

        // Auto-focus search input for immediate typing
        // Use setTimeout to ensure DOM is fully rendered and focus works
        setTimeout(() => {
            searchInput.focus();
        }, 0);
    }

    /**
     * Create a column for one aspect ratio (using unified AspectRatioUtils method)
     */
    createRatioColumn(ratio, presetList) {
        // Use unified method from AspectRatioUtils with AspectRatioSelector-specific options
        return AspectRatioUtils.createPresetColumn(ratio, presetList, {
            selectedPreset: this.selectedPreset,
            customPresetIcon: this.customPresetIcon,
            onPresetClick: (presetName) => this.selectPreset(presetName)
        });
    }

    /**
     * DEPRECATED: Old implementation kept for reference
     * This code has been moved to AspectRatioUtils.createPresetColumn()
     */
    _oldCreateRatioColumn_DEPRECATED(ratio, presetList) {
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
            max-height: 400px;
            overflow-y: auto;
            scrollbar-gutter: stable;
        `;

        presetList.forEach(preset => {
            const presetItem = document.createElement('div');
            const isSelected = this.selectedPreset === preset.name;
            
            // Add data attributes for search functionality
            presetItem.setAttribute('data-preset-item', 'true');
            presetItem.setAttribute('data-preset-name', preset.name);
            presetItem.setAttribute('data-preset-dimensions', `${preset.width}×${preset.height}`);
            
            presetItem.style.cssText = `
                padding: 3px 4px;
                background: ${isSelected ? 'rgba(90, 170, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
                border: 1px solid ${isSelected ? '#5af' : '#444'};
                border-radius: 2px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                display: flex;
                flex-direction: column;
            `;

            // Preset name with custom icon if applicable
            const nameDiv = document.createElement('div');
            const customIcon = preset.isCustom && this.customPresetIcon ? 
                `<img src="${this.customPresetIcon.src}" style="width: 14px; height: 14px; margin-left: 3px; vertical-align: middle;">` : '';
            nameDiv.innerHTML = `${preset.name}${customIcon}`;
            nameDiv.style.cssText = `
                color: ${isSelected ? '#fff' : '#ddd'};
                font-size: 15px;
                font-weight: ${isSelected ? 'bold' : 'normal'};
                margin-bottom: 1px;
                word-wrap: break-word;
                word-break: break-word;
                max-width: 100px;
            `;
            
            // Dimensions below name
            const dimensionsDiv = document.createElement('div');
            dimensionsDiv.textContent = `${preset.width}×${preset.height}`;
            dimensionsDiv.style.cssText = `
                color: ${isSelected ? '#5af' : '#888'};
                font-size: 13px;
            `;

            presetItem.appendChild(nameDiv);
            presetItem.appendChild(dimensionsDiv);

            presetItem.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    presetItem.style.background = 'rgba(255, 255, 255, 0.15)';
                    presetItem.style.borderColor = '#666';
                }
            });

            presetItem.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    presetItem.style.background = 'rgba(255, 255, 255, 0.05)';
                    presetItem.style.borderColor = '#444';
                }
            });

            presetItem.addEventListener('click', () => {
                this.selectPreset(preset.name);
            });

            presetListContainer.appendChild(presetItem);
        });

        column.appendChild(presetListContainer);
        return column;
    }

    /**
     * Select a preset
     */
    selectPreset(presetName) {
        log.debug(`Preset selected: ${presetName}`);
        
        if (this.callback) {
            this.callback(presetName);
        }
        
        this.hide();
    }

    /**
     * Hide and clean up
     */
    hide() {
        // Remove resize event listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        if (this.container && this.container.parentNode) {
            document.body.removeChild(this.container);
        }
        if (this.overlay && this.overlay.parentNode) {
            document.body.removeChild(this.overlay);
        }
        
        this.container = null;
        this.overlay = null;
        this.horizontalScrollIndicator = null;
        this.isActive = false;
        this.presets = {};
        this.groupedPresets = {};
        this.selectedPreset = null;
        this.callback = null;
    }
}
