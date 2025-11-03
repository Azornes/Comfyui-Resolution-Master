// DialogManager.js - Manages custom input dialogs for ResolutionMaster
import { createModuleLogger } from "./utils/LoggerUtils.js";
import { app } from "../../scripts/app.js";

const log = createModuleLogger('DialogManager');

export class DialogManager {
    constructor(resolutionMasterInstance) {
        this.rm = resolutionMasterInstance;
        this.customInputDialog = null;
        this.customInputOverlay = null;
        this.inputDialogActive = false;
    }
    
    /**
     * Shows a custom value input dialog
     * @param {string} valueAreaKey - The control key that was clicked
     * @param {Event} e - The mouse event
     */
    showCustomValueDialog(valueAreaKey, e) {
        if (this.inputDialogActive) return;
        
        log.debug(`Clicked on value area: ${valueAreaKey}`);
        
        // Determine the type and current value based on the control key
        let valueType, currentValue, propertyName, minValue = 0.01;
        
        if (valueAreaKey === 'scaleValueArea') {
            valueType = 'Scale Factor';
            currentValue = this.rm.node.properties.upscaleValue;
            propertyName = 'upscaleValue';
        } else if (valueAreaKey === 'resolutionValueArea') {
            valueType = 'Resolution Scale';
            currentValue = this.rm.calculateResolutionScale(this.rm.node.properties.targetResolution);
            propertyName = 'targetResolution';
        } else if (valueAreaKey === 'megapixelsValueArea') {
            valueType = 'Megapixels';
            currentValue = this.rm.node.properties.targetMegapixels;
            propertyName = 'targetMegapixels';
        } else if (valueAreaKey === 'snapValueArea') {
            valueType = 'Snap Value';
            currentValue = this.rm.node.properties.snapValue;
            propertyName = 'snapValue';
            minValue = 1;
        } else if (valueAreaKey === 'widthValueArea') {
            valueType = 'Width';
            currentValue = this.rm.widthWidget ? this.rm.widthWidget.value : this.rm.node.properties.valueX;
            propertyName = 'width';
            minValue = 64;
        } else if (valueAreaKey === 'heightValueArea') {
            valueType = 'Height';
            currentValue = this.rm.heightWidget ? this.rm.heightWidget.value : this.rm.node.properties.valueY;
            propertyName = 'height';
            minValue = 64;
        } else {
            log.debug(`Unknown value area key: ${valueAreaKey}`);
            return;
        }
        
        log.debug(`Opening dialog for ${valueType} with current value: ${currentValue}`);
        this.createCustomInputDialog(valueType, currentValue, propertyName, minValue, e);
    }
    
    /**
     * Creates and displays a custom input dialog
     * @param {string} valueType - The type of value being edited
     * @param {number} currentValue - The current value
     * @param {string} propertyName - The property name to update
     * @param {number} minValue - Minimum allowed value
     * @param {Event} e - The mouse event for positioning
     */
    createCustomInputDialog(valueType, currentValue, propertyName, minValue, e) {
        this.inputDialogActive = true;
        log.debug(`Creating dialog for ${valueType}, current: ${currentValue}`);
        
        // Create overlay
        const overlay = document.createElement('div');
        this.customInputOverlay = overlay;
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 9999;
        `;
        overlay.addEventListener('mousedown', () => this.closeCustomInputDialog());
        document.body.appendChild(overlay);

        // Create dialog container
        const dialog = document.createElement('div');
        this.customInputDialog = dialog;
        dialog.className = 'litegraph-custom-input-dialog';
        dialog.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent clicks inside from closing
        dialog.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
            border: 2px solid #555; border-radius: 8px; padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8); z-index: 10000;
            font-family: Arial, sans-serif; min-width: 280px;
        `;
        
        // Position dialog
        const x = e.clientX ? e.clientX + 20 : (window.innerWidth - 280) / 2;
        const y = e.clientY ? e.clientY + 20 : (window.innerHeight - 200) / 2;
        dialog.style.left = `${Math.max(10, Math.min(x, window.innerWidth - 300))}px`;
        dialog.style.top = `${Math.max(10, Math.min(y, window.innerHeight - 200))}px`;
        
        // Create dialog content
        dialog.innerHTML = `
            <div style="color: #fff; font-size: 16px; font-weight: bold; margin-bottom: 15px; text-align: center;">Set Custom ${valueType}</div>
            <div style="margin-bottom: 10px;">
                <label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 5px;">Current: ${this.formatValueForDisplay(currentValue, valueType)}</label>
            <input type="${valueType === 'Scale Factor' ? 'text' : 'number'}" id="customValueInput" value="${currentValue}" step="${valueType === 'Width' || valueType === 'Height' ? '1' : '0.01'}" min="${minValue}"
                       style="width: 100%; padding: 8px; border: 1px solid #555; border-radius: 4px; background: #333; color: #fff; font-size: 14px; box-sizing: border-box;">
            </div>
            <div id="validationMessage" style="color: #f55; font-size: 11px; margin-bottom: 5px; min-height: 15px;"></div>
            <div id="infoMessage" style="color: #999; font-size: 11px; margin-bottom: 10px; min-height: 15px; text-align: center;"></div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #555; border-radius: 4px; background: #444; color: #ccc; cursor: pointer; font-size: 12px;">Cancel</button>
                <button id="applyBtn" style="padding: 8px 16px; border: 1px solid #5af; border-radius: 4px; background: #5af; color: #fff; cursor: pointer; font-size: 12px;">Apply</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Get elements
        const input = dialog.querySelector('#customValueInput');
        const validationMsg = dialog.querySelector('#validationMessage');
        const infoMsg = dialog.querySelector('#infoMessage');
        const cancelBtn = dialog.querySelector('#cancelBtn');
        const applyBtn = dialog.querySelector('#applyBtn');
        
        if (valueType === 'Scale Factor') {
            infoMsg.textContent = 'Tip: Use /2 for 0.5x, /4 for 0.25x, etc.';
        }
        
        // Focus and select input
        setTimeout(() => { input.focus(); input.select(); }, 50);
        
        // Real-time validation
        const validateInput = () => {
            const value = this.parseCustomInputValue(input.value, valueType);
            if (isNaN(value) || value < minValue) {
                let errorMsg = `Value must be ≥ ${minValue}`;
                if (typeof input.value === 'string' && input.value.startsWith('/')) {
                    const divisor = parseFloat(input.value.substring(1));
                    if (isNaN(divisor) || divisor === 0) errorMsg = 'Invalid divisor after /';
                }
                validationMsg.textContent = errorMsg;
                applyBtn.disabled = true; applyBtn.style.opacity = '0.5';
                return false;
            } else {
                validationMsg.textContent = '';
                applyBtn.disabled = false; applyBtn.style.opacity = '1';
                return true;
            }
        };
        
        // Event listeners
        input.addEventListener('input', validateInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && validateInput()) {
                this.applyCustomValue(propertyName, this.parseCustomInputValue(input.value, valueType), valueType);
            } else if (e.key === 'Escape') {
                this.closeCustomInputDialog();
            }
        });
        cancelBtn.addEventListener('click', () => this.closeCustomInputDialog());
        applyBtn.addEventListener('click', () => {
            if (validateInput()) {
                this.applyCustomValue(propertyName, this.parseCustomInputValue(input.value, valueType), valueType);
            }
        });
        
        validateInput();
    }
    
    /**
     * Closes and cleans up the custom input dialog
     */
    closeCustomInputDialog() {
        if (this.customInputDialog) {
            document.body.removeChild(this.customInputDialog);
            this.customInputDialog = null;
        }
        if (this.customInputOverlay) {
            document.body.removeChild(this.customInputOverlay);
            this.customInputOverlay = null;
        }
        this.inputDialogActive = false;
    }
    
    /**
     * Parses custom input value, handling special syntax like /2 for division
     * @param {string|number} rawValue - The raw input value
     * @param {string} valueType - The type of value being parsed
     * @returns {number} The parsed numeric value
     */
    parseCustomInputValue(rawValue, valueType) {
        if (valueType === 'Scale Factor' && typeof rawValue === 'string' && rawValue.startsWith('/')) {
            const divisor = parseFloat(rawValue.substring(1));
            if (!isNaN(divisor) && divisor !== 0) {
                return 1 / divisor;
            }
        }
        return parseFloat(rawValue);
    }
    
    /**
     * Applies a custom value to the appropriate property
     * @param {string} propertyName - The property to update
     * @param {number} value - The value to apply
     * @param {string} valueType - The type of value
     */
    applyCustomValue(propertyName, value, valueType) {
        const props = this.rm.node.properties;
        
        if (propertyName === 'upscaleValue') {
            props.upscaleValue = value;
            if (props.rescaleMode === 'manual') {
                this.rm.updateRescaleValue();
            }
        } else if (propertyName === 'targetResolution') {
            // For resolution, we need to reverse-calculate the target resolution from the scale factor
            if (this.rm.validateWidgets()) {
                const currentPixels = this.rm.widthWidget.value * this.rm.heightWidget.value;
                const targetPixels = currentPixels * (value * value);
                const targetP = Math.sqrt(targetPixels / (16/9));
                props.targetResolution = Math.round(targetP);
                if (props.rescaleMode === 'resolution') {
                    this.rm.updateRescaleValue();
                }
            }
        } else if (propertyName === 'targetMegapixels') {
            props.targetMegapixels = value;
            if (props.rescaleMode === 'megapixels') {
                this.rm.updateRescaleValue();
            }
        } else if (propertyName === 'snapValue') {
            props.snapValue = Math.round(value);
        } else if (propertyName === 'width') {
            const newWidth = Math.round(value);
            const currentHeight = this.rm.heightWidget ? this.rm.heightWidget.value : props.valueY;
            this.rm.setDimensions(newWidth, currentHeight);
        } else if (propertyName === 'height') {
            const newHeight = Math.round(value);
            const currentWidth = this.rm.widthWidget ? this.rm.widthWidget.value : props.valueX;
            this.rm.setDimensions(currentWidth, newHeight);
        }
        
        this.closeCustomInputDialog();
        app.graph.setDirtyCanvas(true);
        
        log.debug(`Applied custom ${valueType}: ${value}`);
    }
    
    /**
     * Formats a value for display with appropriate units
     * @param {number} value - The value to format
     * @param {string} valueType - The type of value
     * @returns {string} Formatted value with units
     */
    formatValueForDisplay(value, valueType) {
        if (valueType === 'Scale Factor') {
            return value.toFixed(1) + 'x';
        } else if (valueType === 'Resolution Scale') {
            return '×' + value.toFixed(2);
        } else if (valueType === 'Megapixels') {
            return value.toFixed(1) + 'MP';
        } else if (valueType === 'Width' || valueType === 'Height') {
            return value.toString() + 'px';
        } else {
            return value.toString();
        }
    }
}
