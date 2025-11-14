// DragDropHandler.js - Drag & Drop handling for PresetManagerDialog

/**
 * Helper class for handling drag & drop operations
 */
export class DragDropHandler {
    /**
     * Sets a drop indicator line at the top of an element
     * @param {HTMLElement} element - The element to show the indicator on
     * @param {string} color - Color of the indicator (default: #5af for reorder, #fa0 for move, #f00 for error, #0f0 for clone)
     */
    static setDropIndicatorTop(element, color = '#5af') {
        if (!element) return;
        
        // Remove all indicator classes first
        element.classList.remove('resolution-master-drag-drop-indicator-top', 'drag-drop-indicator-top-move', 'drag-drop-indicator-top-error', 'drag-drop-indicator-top-clone');
        
        // Add appropriate class based on color
        if (color === '#fa0') {
            element.classList.add('resolution-master-drag-drop-indicator-top-move');
        } else if (color === '#f00') {
            element.classList.add('resolution-master-drag-drop-indicator-top-error');
        } else if (color === '#0f0') {
            element.classList.add('resolution-master-drag-drop-indicator-top-clone');
        } else {
            element.classList.add('resolution-master-drag-drop-indicator-top');
        }
    }

    /**
     * Sets a drop indicator line at the bottom of an element
     * @param {HTMLElement} element - The element to show the indicator on
     * @param {string} color - Color of the indicator (default: #5af for reorder, #fa0 for move, #f00 for error, #0f0 for clone)
     */
    static setDropIndicatorBottom(element, color = '#5af') {
        if (!element) return;
        
        // Remove all indicator classes first
        element.classList.remove('resolution-master-drag-drop-indicator-bottom', 'drag-drop-indicator-bottom-move', 'drag-drop-indicator-bottom-error', 'drag-drop-indicator-bottom-clone');
        
        // Add appropriate class based on color
        if (color === '#fa0') {
            element.classList.add('resolution-master-drag-drop-indicator-bottom-move');
        } else if (color === '#f00') {
            element.classList.add('resolution-master-drag-drop-indicator-bottom-error');
        } else if (color === '#0f0') {
            element.classList.add('resolution-master-drag-drop-indicator-bottom-clone');
        } else {
            element.classList.add('resolution-master-drag-drop-indicator-bottom');
        }
    }

    /**
     * Clears the drop indicator from an element
     * @param {HTMLElement} element - The element to clear the indicator from
     */
    static clearDropIndicator(element) {
        if (!element) return;
        
        // Remove all indicator classes
        element.classList.remove(
            'drag-drop-indicator-top',
            'drag-drop-indicator-top-move',
            'drag-drop-indicator-top-error',
            'drag-drop-indicator-top-clone',
            'drag-drop-indicator-bottom',
            'drag-drop-indicator-bottom-move',
            'drag-drop-indicator-bottom-error',
            'drag-drop-indicator-bottom-clone'
        );
    }

    /**
     * Gets the first category header element
     * @param {HTMLElement} container - The container to search in
     * @returns {HTMLElement|null} The first category header or null
     */
    static getFirstCategoryHeader(container) {
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
    static getNextCategoryHeader(container, currentIndex) {
        const nextCategorySection = container.querySelector(`[data-category-index="${currentIndex + 1}"]`);
        if (nextCategorySection) {
            return nextCategorySection.querySelector('div[draggable="true"]');
        }
        return null;
    }
}
