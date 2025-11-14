// AspectRatioUtils.js - Shared utilities for aspect ratio calculations and rendering

/**
 * Utility class for aspect ratio calculations and icon generation
 * Used by AspectRatioSelector and PresetManagerDialog
 */
export class AspectRatioUtils {
    /**
     * Calculate aspect ratio from width and height
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @returns {string} Aspect ratio string (e.g., "16:9")
     */
    static calculateAspectRatio(width, height) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        const w = width / divisor;
        const h = height / divisor;
        
        // Round to common aspect ratios
        const ratio = w / h;
        const commonRatios = {
            '21:9': 21/9,
            '16:9': 16/9,
            '3:2': 3/2,
            '4:3': 4/3,
            '5:4': 5/4,
            '1:1': 1,
            '4:5': 4/5,
            '3:4': 3/4,
            '2:3': 2/3,
            '9:16': 9/16,
            '9:21': 9/21
        };
        
        // Find closest common ratio (within 2% tolerance)
        let closestRatio = `${w}:${h}`;
        let minDiff = Infinity;
        
        for (const [name, value] of Object.entries(commonRatios)) {
            const diff = Math.abs(ratio - value);
            if (diff < minDiff && diff < 0.02) {
                minDiff = diff;
                closestRatio = name;
            }
        }
        
        return closestRatio;
    }

    /**
     * Dynamically generate SVG icon for aspect ratio
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @returns {string} SVG markup as string
     */
    static getAspectRatioIcon(width, height) {
        const iconSize = 20;
        const padding = 2;
        const maxDim = iconSize - padding * 2;
        
        const aspect = width / height;
        
        let rectWidth, rectHeight;
        
        if (aspect > 1) {
            rectWidth = maxDim;
            rectHeight = maxDim / aspect;
        } else {
            rectHeight = maxDim;
            rectWidth = maxDim * aspect;
        }
        
        const x = (iconSize - rectWidth) / 2;
        const y = (iconSize - rectHeight) / 2;
        const radius = Math.min(2, rectWidth / 4, rectHeight / 4);
        
        return `<svg width="20" height="20" viewBox="0 0 ${iconSize} ${iconSize}" fill="none">
            <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rectWidth.toFixed(2)}" height="${rectHeight.toFixed(2)}" 
                  rx="${radius.toFixed(2)}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.9"/>
        </svg>`;
    }

    /**
     * Group presets by aspect ratio
     * @param {Object} presets - Object with preset names as keys and {width, height} as values
     * @returns {Object} Grouped presets by aspect ratio, sorted
     */
    static groupPresetsByAspectRatio(presets) {
        const grouped = {};
        
        for (const [name, dimensions] of Object.entries(presets)) {
            const ratio = this.calculateAspectRatio(dimensions.width, dimensions.height);
            
            if (!grouped[ratio]) {
                grouped[ratio] = [];
            }
            
            grouped[ratio].push({
                name,
                width: dimensions.width,
                height: dimensions.height,
                pixels: dimensions.width * dimensions.height,
                isCustom: dimensions.isCustom || false,
                isHidden: dimensions.isHidden || false
            });
        }
        
        // Sort presets within each group by pixel count (descending)
        for (const ratio in grouped) {
            grouped[ratio].sort((a, b) => b.pixels - a.pixels);
        }
        
        // Sort aspect ratios by their numeric value (landscape to portrait)
        const sortedGrouped = {};
        const sortedRatios = Object.keys(grouped).sort((a, b) => {
            const [aw, ah] = a.split(':').map(Number);
            const [bw, bh] = b.split(':').map(Number);
            return (bw / bh) - (aw / ah);
        });
        
        for (const ratio of sortedRatios) {
            sortedGrouped[ratio] = grouped[ratio];
        }
        
        return sortedGrouped;
    }

    /**
     * Creates a preset column with list of presets for a given aspect ratio
     * Unified method used by both AspectRatioSelector and PresetAddViewRenderer
     * @param {string} ratio - Aspect ratio string (e.g., "16:9")
     * @param {Array} presetList - Array of preset objects
     * @param {Object} options - Configuration options
     * @param {Function} options.renderPresetItem - Function to render individual preset item
     * @returns {HTMLElement} Column element
     */
    static createPresetColumn(ratio, presetList, options = {}) {
        const column = document.createElement('div');
        column.className = 'resolution-master-aspect-ratio-column';

        // Icon at the top
        const firstPreset = presetList[0];
        const iconContainer = document.createElement('div');
        iconContainer.className = 'resolution-master-aspect-ratio-column-icon';
        iconContainer.innerHTML = this.getAspectRatioIcon(firstPreset.width, firstPreset.height);
        column.appendChild(iconContainer);

        // Ratio text below icon
        const ratioText = document.createElement('div');
        ratioText.className = 'resolution-master-aspect-ratio-column-title';
        ratioText.textContent = ratio;
        column.appendChild(ratioText);

        // Preset list (vertical scrollable)
        const presetListContainer = document.createElement('div');
        presetListContainer.className = 'resolution-master-aspect-ratio-column-list';

        // Render each preset using provided function
        presetList.forEach(preset => {
            const presetItem = options.renderPresetItem 
                ? options.renderPresetItem(preset)
                : this.createDefaultPresetItem(preset, options);
            presetListContainer.appendChild(presetItem);
        });

        column.appendChild(presetListContainer);
        return column;
    }

    /**
     * Creates a default preset item (used by AspectRatioSelector)
     * @param {Object} preset - Preset object
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} Preset item element
     */
    static createDefaultPresetItem(preset, options = {}) {
        const { selectedPreset, customPresetIcon, onPresetClick } = options;
        const isSelected = selectedPreset === preset.name;
        
        const presetItem = document.createElement('div');
        presetItem.className = 'resolution-master-aspect-ratio-preset-item' + (isSelected ? ' selected' : '');
        presetItem.setAttribute('data-preset-item', 'true');
        presetItem.setAttribute('data-preset-name', preset.name);
        presetItem.setAttribute('data-preset-dimensions', `${preset.width}×${preset.height}`);

        // Preset name with custom icon if applicable
        const nameDiv = document.createElement('div');
        nameDiv.className = 'resolution-master-aspect-ratio-preset-item-name';
        const customIcon = preset.isCustom && customPresetIcon ? 
            `<img src="${customPresetIcon.src}" class="resolution-master-aspect-ratio-preset-custom-icon">` : '';
        nameDiv.innerHTML = `${preset.name}${customIcon}`;
        
        // Dimensions below name
        const dimensionsDiv = document.createElement('div');
        dimensionsDiv.className = 'resolution-master-aspect-ratio-preset-item-dims';
        dimensionsDiv.textContent = `${preset.width}×${preset.height}`;

        presetItem.appendChild(nameDiv);
        presetItem.appendChild(dimensionsDiv);

        // Click handler
        if (onPresetClick) {
            presetItem.addEventListener('click', () => onPresetClick(preset.name));
        }

        return presetItem;
    }

    /**
     * Updates scroll indicators for columns (adds "↓ Scroll for more" if needed)
     * @param {Array} columns - Array of column elements
     */
    static updateColumnScrollIndicators(columns) {
        columns.forEach(column => {
            // Preset list container is the 3rd child (after icon and ratio text)
            const presetListContainer = column.children[2];
            let scrollIndicator = column.children[3];
            
            const needsIndicator = presetListContainer && 
                                  presetListContainer.scrollHeight > presetListContainer.clientHeight;
            
            if (needsIndicator && !scrollIndicator) {
                scrollIndicator = document.createElement('div');
                scrollIndicator.className = 'resolution-master-aspect-ratio-column-scroll-indicator';
                scrollIndicator.textContent = '↓ Scroll for more';
                column.appendChild(scrollIndicator);
            } else if (!needsIndicator && scrollIndicator) {
                column.removeChild(scrollIndicator);
            }
        });
    }

    /**
     * Creates and manages horizontal scroll indicator ("→ Scroll right for more")
     * @param {HTMLElement} scrollWrapper - The scrollable wrapper element
     * @param {HTMLElement} container - The parent container to append indicator to
     * @param {Object} state - Object to store indicator reference {indicator: null}
     * @returns {Function} Update function to call when checking if indicator is needed
     */
    static createHorizontalScrollManager(scrollWrapper, container, state) {
        const updateIndicator = () => {
            const needsIndicator = scrollWrapper.scrollWidth > scrollWrapper.clientWidth;
            
            if (needsIndicator && !state.indicator) {
                // Create and add indicator
                state.indicator = document.createElement('div');
                state.indicator.className = 'resolution-master-aspect-ratio-horizontal-scroll-indicator';
                state.indicator.textContent = '→ Scroll right for more';
                
                // Enable horizontal scrolling with mouse wheel over the indicator
                state.indicator.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    scrollWrapper.scrollLeft += e.deltaY;
                }, { passive: false });
                
                container.appendChild(state.indicator);
            } else if (!needsIndicator && state.indicator) {
                // Remove indicator (with safety check to prevent errors)
                if (state.indicator.parentNode === container) {
                    container.removeChild(state.indicator);
                }
                state.indicator = null;
            }
        };
        
        return updateIndicator;
    }
}
