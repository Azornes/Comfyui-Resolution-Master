// TooltipManager.js - DOM-based tooltip system adapted from ResolutionMaster.js

/**
 * Manager for displaying tooltips on DOM elements
 * Adapted from the canvas-based tooltip system in ResolutionMaster.js
 */
export class TooltipManager {
    constructor(options = {}) {
        this.tooltipDelay = options.delay || 500; // ms - delay before showing tooltip
        this.maxWidth = options.maxWidth || 250; // Maximum tooltip width
        this.tooltipElement = null; // The DOM element for the tooltip
        this.tooltipTimer = null; // Timer for tooltip delay
        this.currentTarget = null; // Currently hovered element
        this.tooltips = options.tooltips || {}; // Map of element IDs/classes to tooltip text
        
        // Create tooltip DOM element
        this.createTooltipElement();
        
        // Bind methods
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Creates the tooltip DOM element
     */
    createTooltipElement() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'tooltip-manager-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            z-index: 100000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            max-width: ${this.maxWidth}px;
            padding: 8px;
            background: linear-gradient(to bottom, rgba(45, 45, 45, 0.95), rgba(35, 35, 35, 0.95));
            border: 1px solid rgba(200, 200, 200, 0.3);
            border-radius: 6px;
            box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
            color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 16px;
            word-wrap: break-word;
            white-space: normal;
        `;
        document.body.appendChild(this.tooltipElement);
    }

    /**
     * Registers tooltip text for an element
     * @param {string} elementId - Element identifier (ID, class, or data attribute)
     * @param {string} tooltipText - Tooltip text to display
     */
    registerTooltip(elementId, tooltipText) {
        this.tooltips[elementId] = tooltipText;
    }

    /**
     * Registers multiple tooltips at once
     * @param {Object} tooltips - Map of element IDs to tooltip texts
     */
    registerTooltips(tooltips) {
        Object.assign(this.tooltips, tooltips);
    }

    /**
     * Attaches tooltip handlers to an element
     * @param {HTMLElement} element - Element to attach tooltip to
     * @param {string} tooltipText - Tooltip text (optional if already registered)
     */
    attach(element, tooltipText = null) {
        if (!element) return;
        
        // Register tooltip text if provided
        if (tooltipText) {
            const elementId = element.id || element.className || element.dataset.tooltipId;
            if (elementId) {
                this.registerTooltip(elementId, tooltipText);
            }
            // Store directly on element as fallback
            element.dataset.tooltipText = tooltipText;
        }
        
        element.addEventListener('mouseenter', this.handleMouseEnter);
        element.addEventListener('mouseleave', this.handleMouseLeave);
        element.addEventListener('mousemove', this.handleMouseMove);
        element.addEventListener('click', this.handleClick); // Hide tooltip on click without clearing state
    }

    /**
     * Detaches tooltip handlers from an element
     * @param {HTMLElement} element - Element to detach from
     */
    detach(element) {
        if (!element) return;
        
        element.removeEventListener('mouseenter', this.handleMouseEnter);
        element.removeEventListener('mouseleave', this.handleMouseLeave);
        element.removeEventListener('mousemove', this.handleMouseMove);
        element.removeEventListener('click', this.handleClick);
    }

    /**
     * Handles mouse enter event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseEnter(e) {
        const element = e.currentTarget;
        this.currentTarget = element;
        
        // Get tooltip text
        const tooltipText = this.getTooltipText(element);
        if (!tooltipText) return;
        
        // Clear any existing timer
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
        }
        
        // Start new timer
        this.tooltipTimer = setTimeout(() => {
            this.showTooltip(element, tooltipText, e);
        }, this.tooltipDelay);
    }

    /**
     * Handles mouse leave event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseLeave(e) {
        // Clear timer
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        
        // Hide tooltip
        this.hideTooltip();
        this.currentTarget = null;
    }

    /**
     * Handles mouse move event
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        // Update tooltip position if visible
        if (this.tooltipElement.style.opacity === '1') {
            this.positionTooltip(e);
        }
    }

    /**
     * Handles click event - hides tooltip without clearing currentTarget
     * @param {MouseEvent} e - Mouse event
     */
    handleClick(e) {
        // Clear timer
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        
        // Hide tooltip but don't clear currentTarget
        // This allows tooltips to work on subsequent elements
        this.hideTooltip();
    }

    /**
     * Gets tooltip text for an element
     * @param {HTMLElement} element - Element to get tooltip for
     * @returns {string|null} Tooltip text
     */
    getTooltipText(element) {
        // Try data attribute first
        if (element.dataset.tooltipText) {
            return element.dataset.tooltipText;
        }
        
        // Try registered tooltips by ID
        if (element.id && this.tooltips[element.id]) {
            const tooltip = this.tooltips[element.id];
            // Check if it's a nested object (for action-specific tooltips)
            if (typeof tooltip === 'object' && tooltip !== null && !Array.isArray(tooltip)) {
                return this.resolveNestedTooltip(element, tooltip);
            }
            return tooltip;
        }
        
        // Try registered tooltips by individual classes
        if (element.classList && element.classList.length > 0) {
            for (const cls of element.classList) {
                if (this.tooltips[cls]) {
                    const tooltip = this.tooltips[cls];
                    // Check if it's a nested object (for action-specific tooltips)
                    if (typeof tooltip === 'object' && tooltip !== null && !Array.isArray(tooltip)) {
                        return this.resolveNestedTooltip(element, tooltip);
                    }
                    return tooltip;
                }
            }
        }
        
        // Try data-tooltip-id attribute
        if (element.dataset.tooltipId && this.tooltips[element.dataset.tooltipId]) {
            const tooltip = this.tooltips[element.dataset.tooltipId];
            // Check if it's a nested object (for action-specific tooltips)
            if (typeof tooltip === 'object' && tooltip !== null && !Array.isArray(tooltip)) {
                return this.resolveNestedTooltip(element, tooltip);
            }
            return tooltip;
        }
        
        return null;
    }
    
    /**
     * Resolves a nested tooltip object by checking element classes
     * @param {HTMLElement} element - Element to check
     * @param {Object} tooltipObj - Nested tooltip object
     * @returns {string|null} Resolved tooltip text
     */
    resolveNestedTooltip(element, tooltipObj) {
        // Check other classes for action type (delete, hide, unhide, etc.)
        if (element.classList && element.classList.length > 0) {
            for (const actionCls of element.classList) {
                if (tooltipObj[actionCls]) {
                    return tooltipObj[actionCls];
                }
            }
        }
        return null;
    }

    /**
     * Shows the tooltip
     * @param {HTMLElement} element - Element being hovered
     * @param {string} text - Tooltip text
     * @param {MouseEvent} e - Mouse event
     */
    showTooltip(element, text, e) {
        this.tooltipElement.textContent = text;
        this.positionTooltip(e);
        this.tooltipElement.style.opacity = '1';
    }

    /**
     * Hides the tooltip
     */
    hideTooltip() {
        if (!this.tooltipElement) return;
        this.tooltipElement.style.opacity = '0';
    }

    /**
     * Positions the tooltip relative to mouse
     * @param {MouseEvent} e - Mouse event
     */
    positionTooltip(e) {
        const tooltip = this.tooltipElement;
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Get tooltip dimensions
        const rect = tooltip.getBoundingClientRect();
        const tooltipWidth = rect.width;
        const tooltipHeight = rect.height;
        
        // Default position: right and above mouse
        let tooltipX = mouseX + 15;
        let tooltipY = mouseY - tooltipHeight - 10;
        
        // Adjust if tooltip would go off screen
        if (tooltipX + tooltipWidth > window.innerWidth) {
            tooltipX = mouseX - tooltipWidth - 15;
        }
        
        if (tooltipY < 0) {
            tooltipY = mouseY + 20;
        }
        
        // Ensure tooltip stays within viewport
        tooltipX = Math.max(5, Math.min(tooltipX, window.innerWidth - tooltipWidth - 5));
        tooltipY = Math.max(5, Math.min(tooltipY, window.innerHeight - tooltipHeight - 5));
        
        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
    }

    /**
     * Cleans up the tooltip manager
     */
    destroy() {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }
        
        this.tooltipElement = null;
        this.currentTarget = null;
        this.tooltips = {};
    }
}
