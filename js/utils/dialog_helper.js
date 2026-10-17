// dialog_helper.js - Shared utilities for creating modals and overlays in ResolutionMaster
import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger('dialog_helper');

/**
 * Creates a standard modal overlay and dialog container.
 * Handles append/remove from document.body and standard click-away/propagation behavior.
 * 
 * @param {Object} options
 * @param {string} options.className - CSS class name for the dialog container
 * @param {string} options.overlayClassName - CSS class name for the overlay background
 * @param {string} [options.overlayStyle] - Optional inline style string for the overlay
 * @param {string} [options.dialogStyle] - Optional inline style string for the dialog container
 * @param {Function} [options.onClose] - Optional cleanup callback when the modal is closed
 * @param {boolean} [options.clickAwayToClose=true] - Whether clicking on the overlay closes the dialog
 * @returns {Object} Object containing the overlay element, dialog element, and a close function
 */
export function createModalWrapper({ className, overlayClassName, overlayStyle, dialogStyle, onClose, clickAwayToClose = true }) {
    log.debug(`Creating modal wrapper for ${className}`);

    // Create overlay
    const overlay = document.createElement('div');
    if (overlayClassName) {
        overlay.className = overlayClassName;
    }
    if (overlayStyle) {
        overlay.style.cssText = overlayStyle;
    }
    
    // Create dialog container
    const dialog = document.createElement('div');
    if (className) {
        dialog.className = className;
    }
    if (dialogStyle) {
        dialog.style.cssText = dialogStyle;
    }

    let isClosed = false;
    const close = () => {
        if (isClosed) return;
        isClosed = true;
        log.debug(`Closing modal wrapper for ${className}`);
        if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
        }
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        if (onClose) {
            onClose();
        }
    };

    if (clickAwayToClose) {
        overlay.addEventListener('mousedown', close);
    }
    dialog.addEventListener('mousedown', (e) => e.stopPropagation());

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    return { overlay, dialog, close };
}

/**
 * Creates a unified view mode toggle bar (e.g. List vs Visual mode) for dropdown / selector dialogs.
 * 
 * @param {Object} options
 * @param {string} [options.currentMode='list'] - 'list' or 'visual'
 * @param {Function} options.onToggle - Callback invoked with the new mode ('list' | 'visual')
 * @returns {HTMLElement} The created toggle bar container
 */
export function createViewModeToggleBar({ currentMode = 'list', onToggle }) {
    const isList = currentMode === 'list';
    const container = document.createElement('div');
    container.className = 'resolution-master-view-mode-toggle-bar';
    container.style.cssText = `
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
    modeToggle.className = 'resolution-master-view-mode-toggle-btn';
    modeToggle.textContent = isList ? '📝 List' : '🎨 Visual';
    modeToggle.style.cssText = `
        padding: 4px 12px;
        background: rgba(90, 170, 255, 0.2);
        border: 1px solid #5af;
        border-radius: 4px;
        color: #5af;
        font-size: 11px;
        cursor: pointer;
        outline: none;
        transition: all 0.2s;
    `;

    modeToggle.addEventListener('mouseenter', () => {
        modeToggle.style.background = 'rgba(90, 170, 255, 0.3)';
    });

    modeToggle.addEventListener('mouseleave', () => {
        modeToggle.style.background = 'rgba(90, 170, 255, 0.2)';
    });

    modeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const newMode = isList ? 'visual' : 'list';
        if (onToggle) {
            onToggle(newMode);
        }
    });

    container.appendChild(modeLabel);
    container.appendChild(modeToggle);
    return container;
}
