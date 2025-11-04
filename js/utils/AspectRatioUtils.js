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
                pixels: dimensions.width * dimensions.height
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
}
