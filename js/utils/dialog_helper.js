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

    const close = () => {
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
