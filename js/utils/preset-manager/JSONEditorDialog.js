// JSONEditorDialog.js - JSON editor using JSONEditor library

import { TooltipManager } from './TooltipManager.js';
import { presetManagerTooltips } from '../ResolutionMasterConfig.js';

/**
 * JSON Editor Dialog with JSONEditor library
 */
export class JSONEditorDialog {
    constructor(parentDialog) {
        this.parentDialog = parentDialog;
        this.editor = null;
    }

    /**
     * Shows JSON editor dialog for direct JSON editing
     */
    async show() {
        // Get current JSON
        const currentJSON = this.parentDialog.manager.exportToJSON();
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'resolution-master-json-editor-overlay';
        
        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'resolution-master-json-editor-dialog';
        
        // Create tooltip manager
        const tooltipManager = new TooltipManager({
            delay: 500,
            maxWidth: 300
        });
        
        // Register tooltips
        tooltipManager.registerTooltips(presetManagerTooltips);
        
        // Header
        const header = this.createHeader(() => {
            // Cleanup editor and tooltips before closing
            if (this.editor) {
                this.editor.destroy();
                this.editor = null;
            }
            tooltipManager.destroy();
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        dialog.appendChild(header);
        
        // Info message
        const infoDiv = this.createInfoMessage();
        dialog.appendChild(infoDiv);
        
        // Content area with JSONEditor
        const content = document.createElement('div');
        content.className = 'resolution-master-json-editor-content';
        
        // Load JSONEditor CSS dynamically
        if (!document.getElementById('jsoneditor-css-link')) {
            const jsoneditorCSS = document.createElement('link');
            jsoneditorCSS.id = 'jsoneditor-css-link';
            jsoneditorCSS.rel = 'stylesheet';
            jsoneditorCSS.href = new URL('../../lib/jsoneditor.min.css', import.meta.url).href;
            document.head.appendChild(jsoneditorCSS);
        }
        
        // Load JSONEditor VS Dark+ Theme
        if (!document.getElementById('jsoneditor-dark-theme-link')) {
            const jsoneditorDarkTheme = document.createElement('link');
            jsoneditorDarkTheme.id = 'jsoneditor-dark-theme-link';
            jsoneditorDarkTheme.rel = 'stylesheet';
            jsoneditorDarkTheme.href = new URL('../../lib/jsoneditor.theme_twilight.css', import.meta.url).href;
            document.head.appendChild(jsoneditorDarkTheme);
        }
        
        // Load JSONEditor JS dynamically
        if (!window.JSONEditor) {
            await this.loadJSONEditorScript();
        }
        
        // Editor container
        const editorContainer = document.createElement('div');
        editorContainer.id = 'json-editor-container';
        editorContainer.className = 'resolution-master-json-editor-container';
        // Height and width are controlled by CSS flex properties
        
        // Validation message
        const validationMsg = document.createElement('div');
        validationMsg.className = 'resolution-master-json-editor-validation';
        validationMsg.style.color = '#5f5';
        validationMsg.textContent = '✓ Valid JSON';
        
        // Initialize JSONEditor with full functionality
        const options = {
            mode: 'code',
            modes: ['code', 'tree', 'form', 'text', 'view', 'preview'], // All available modes
            enableSort: true,
            enableTransform: true,
            onError: (err) => {
                validationMsg.style.color = '#f55';
                validationMsg.textContent = `❌ ${err.toString()}`;
            },
            onChangeText: (jsonText) => {
                try {
                    JSON.parse(jsonText);
                    validationMsg.style.color = '#5f5';
                    validationMsg.textContent = '✓ Valid JSON';
                } catch (e) {
                    validationMsg.style.color = '#f55';
                    validationMsg.textContent = `❌ ${e.message}`;
                }
            }
        };
        
        this.editor = new JSONEditor(editorContainer, options);
        
        // Set the initial JSON content
        try {
            this.editor.set(JSON.parse(currentJSON));
        } catch (e) {
            // If parsing fails, set as text
            this.editor.setText(currentJSON);
        }
        
        // Add drag-and-drop functionality for JSON files
        this.setupDragAndDrop(editorContainer, validationMsg);
        
        content.appendChild(editorContainer);
        dialog.appendChild(content);
        dialog.appendChild(validationMsg);
        
        // Footer with buttons
        const footer = this.createFooter(validationMsg, () => {
            // Cleanup editor and tooltips before closing
            if (this.editor) {
                this.editor.destroy();
                this.editor = null;
            }
            tooltipManager.destroy();
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        dialog.appendChild(footer);
        
        // Add to DOM
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        // Attach tooltips to buttons (after adding to DOM)
        const closeBtn = dialog.querySelector('#json-editor-close-btn');
        const cancelBtn = dialog.querySelector('#json-editor-cancel-btn');
        const applyBtn = dialog.querySelector('#json-editor-apply-btn');
        
        if (closeBtn) tooltipManager.attach(closeBtn);
        if (cancelBtn) tooltipManager.attach(cancelBtn);
        if (applyBtn) tooltipManager.attach(applyBtn);
    }

    /**
     * Loads the JSONEditor script dynamically
     * @returns {Promise} Promise that resolves when script is loaded
     */
    loadJSONEditorScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = new URL('../../lib/jsoneditor.min.js', import.meta.url).href;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Sets up drag-and-drop functionality for JSON files
     * @param {HTMLElement} container - Container element to attach drag-and-drop
     * @param {HTMLElement} validationMsg - Validation message element
     */
    setupDragAndDrop(container, validationMsg) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        container.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            
            if (files.length === 0) {
                return;
            }

            const file = files[0];
            
            // Check if it's a JSON file
            if (!file.name.endsWith('.json')) {
                validationMsg.style.color = '#f55';
                validationMsg.textContent = '❌ Please drop a .json file';
                return;
            }

            // Read the file
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const jsonText = event.target.result;
                    const jsonObject = JSON.parse(jsonText);
                    
                    // Update editor with the new JSON
                    this.editor.set(jsonObject);
                    
                    validationMsg.style.color = '#5f5';
                    validationMsg.textContent = `✓ Loaded: ${file.name}`;
                } catch (error) {
                    validationMsg.style.color = '#f55';
                    validationMsg.textContent = `❌ Invalid JSON in ${file.name}: ${error.message}`;
                }
            };
            
            reader.onerror = () => {
                validationMsg.style.color = '#f55';
                validationMsg.textContent = `❌ Error reading file: ${file.name}`;
            };
            
            reader.readAsText(file);
        }, false);
    }

    /**
     * Creates the header with title and close button
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Header element
     */
    createHeader(onClose) {
        const header = document.createElement('div');
        header.className = 'resolution-master-json-editor-header';
        
        const title = document.createElement('div');
        title.className = 'resolution-master-json-editor-title';
        title.textContent = '{ } JSON Editor';
        
        const closeBtn = document.createElement('button');
        closeBtn.id = 'json-editor-close-btn';
        closeBtn.className = 'resolution-master-json-editor-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', onClose);
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        return header;
    }

    /**
     * Creates the info message
     * @returns {HTMLElement} Info element
     */
    createInfoMessage() {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'resolution-master-json-editor-info';
        infoDiv.innerHTML = `
            💡 <strong>Direct JSON editing</strong><br>
            Edit the JSON below to modify custom presets and hidden built-in presets.<br>
            You can also drag & drop a .json file onto the editor to load it.<br>
            Changes will replace current configuration when you click "Apply Changes".
        `;
        
        return infoDiv;
    }

    /**
     * Creates the footer with action buttons
     * @param {HTMLElement} validationMsg - Validation message element
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Footer element
     */
    createFooter(validationMsg, onClose) {
        const footer = document.createElement('div');
        footer.className = 'resolution-master-json-editor-footer';
        
        const rightBtns = document.createElement('div');
        rightBtns.className = 'resolution-master-json-editor-footer-right';
        
        // Cancel button
        const cancelBtn = this.createCancelButton(onClose);
        rightBtns.appendChild(cancelBtn);
        
        // Apply button
        const applyBtn = this.createApplyButton(validationMsg, onClose);
        rightBtns.appendChild(applyBtn);
        
        footer.appendChild(rightBtns);
        
        return footer;
    }

    /**
     * Creates the cancel button
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Cancel button
     */
    createCancelButton(onClose) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'json-editor-cancel-btn';
        cancelBtn.className = 'resolution-master-json-editor-cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', onClose);
        
        return cancelBtn;
    }

    /**
     * Creates the apply changes button
     * @param {HTMLElement} validationMsg - Validation message element
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Apply button
     */
    createApplyButton(validationMsg, onClose) {
        const applyBtn = document.createElement('button');
        applyBtn.id = 'json-editor-apply-btn';
        applyBtn.className = 'resolution-master-json-editor-apply-btn';
        applyBtn.textContent = 'Apply Changes';
        applyBtn.addEventListener('click', () => {
            try {
                // Get JSON from editor
                const jsonObject = this.editor.get();
                const jsonString = JSON.stringify(jsonObject, null, 2);
                
                // Import with replace mode
                const success = this.parentDialog.manager.importFromJSON(jsonString, false);
                
                if (success) {
                    validationMsg.style.color = '#5f5';
                    validationMsg.textContent = '✓ Changes applied successfully!';
                    
                    // Close dialog immediately and refresh main dialog
                    onClose();
                    this.parentDialog.renderDialog();
                } else {
                    validationMsg.style.color = '#f55';
                    validationMsg.textContent = '❌ Failed to apply changes. Check console for details.';
                }
            } catch (error) {
                validationMsg.style.color = '#f55';
                validationMsg.textContent = `❌ Invalid JSON: ${error.message}`;
            }
        });
        
        return applyBtn;
    }
}
