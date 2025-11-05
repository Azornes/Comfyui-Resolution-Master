// JSONEditorDialog.js - JSON editor with syntax highlighting and Undo/Redo

/**
 * JSON Editor Dialog with advanced features
 */
export class JSONEditorDialog {
    constructor(parentDialog) {
        this.parentDialog = parentDialog;
    }

    /**
     * Shows JSON editor dialog for direct JSON editing
     */
    async show() {
        // Get current JSON
        const currentJSON = this.parentDialog.manager.exportToJSON();
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'json-editor-overlay';
        
        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'json-editor-dialog';
        
        // Header
        const header = this.createHeader(() => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        dialog.appendChild(header);
        
        // Info message
        const infoDiv = this.createInfoMessage();
        dialog.appendChild(infoDiv);
        
        // Content area with line numbers and code editor
        const content = document.createElement('div');
        content.className = 'json-editor-content';
        
        // Load Prism CSS dynamically
        if (!document.getElementById('prism-css-link')) {
            const prismCSS = document.createElement('link');
            prismCSS.id = 'prism-css-link';
            prismCSS.rel = 'stylesheet';
            prismCSS.href = new URL('../../lib/prism.css', import.meta.url).href;
            document.head.appendChild(prismCSS);
        }
        
        // Editor container (line numbers + code editor)
        const editorContainer = document.createElement('div');
        editorContainer.className = 'json-editor-container';
        
        // Line numbers container
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'json-editor-line-numbers';
        
        // Scrollable editor wrapper
        const editorWrapper = document.createElement('div');
        editorWrapper.className = 'json-editor-wrapper';
        
        // Code container (pre + code with contenteditable)
        const pre = document.createElement('pre');
        pre.className = 'json-editor-pre';
        
        const code = document.createElement('code');
        code.className = 'language-json json-editor-code';
        code.contentEditable = 'true';
        code.spellcheck = false;
        code.textContent = currentJSON;
        
        // Undo/Redo history management
        let undoStack = [currentJSON];
        let redoStack = [];
        let isUndoRedoOperation = false;
        
        pre.appendChild(code);
        editorWrapper.appendChild(pre);
        
        // Function to update line numbers
        const updateLineNumbers = () => {
            const lines = code.textContent.split('\n').length;
            lineNumbers.innerHTML = '';
            for (let i = 1; i <= lines; i++) {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = i;
                lineDiv.className = 'json-editor-line-number';
                lineNumbers.appendChild(lineDiv);
            }
        };
        
        // Function to apply syntax highlighting
        const applySyntaxHighlighting = () => {
            // Save cursor position
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            const cursorOffset = range ? range.startOffset : 0;
            const cursorNode = range ? range.startContainer : null;
            
            // Get text content
            const text = code.textContent;
            
            // Apply Prism highlighting
            if (window.Prism) {
                code.innerHTML = window.Prism.highlight(text, window.Prism.languages.json, 'json');
            }
            
            // Update line numbers
            updateLineNumbers();
            
            // Restore cursor position (approximate)
            try {
                if (cursorNode && code.childNodes.length > 0) {
                    const newRange = document.createRange();
                    const newSelection = window.getSelection();
                    
                    // Try to restore cursor to similar position
                    let textNode = code.firstChild;
                    let currentOffset = 0;
                    
                    // Find the text node that contains our cursor position
                    while (textNode) {
                        if (textNode.nodeType === Node.TEXT_NODE) {
                            if (currentOffset + textNode.length >= cursorOffset) {
                                newRange.setStart(textNode, Math.min(cursorOffset - currentOffset, textNode.length));
                                newRange.collapse(true);
                                newSelection.removeAllRanges();
                                newSelection.addRange(newRange);
                                break;
                            }
                            currentOffset += textNode.length;
                        }
                        textNode = textNode.nextSibling;
                    }
                }
            } catch (e) {
                // Cursor restoration failed, that's okay
                console.warn('Could not restore cursor position:', e);
            }
        };
        
        // Validation message
        const validationMsg = document.createElement('div');
        validationMsg.className = 'json-editor-validation';
        
        // Initial highlighting
        applySyntaxHighlighting();
        
        // Handle input with debouncing for performance and live validation
        let highlightTimeout;
        code.addEventListener('input', () => {
            // Save to undo history if not an undo/redo operation
            if (!isUndoRedoOperation) {
                const currentText = code.textContent;
                // Add to undo stack if text changed
                if (undoStack[undoStack.length - 1] !== currentText) {
                    undoStack.push(currentText);
                    redoStack = []; // Clear redo stack on new input
                }
            }
            isUndoRedoOperation = false;
            
            clearTimeout(highlightTimeout);
            highlightTimeout = setTimeout(() => {
                applySyntaxHighlighting();
                
                // Live JSON validation
                try {
                    JSON.parse(code.textContent);
                    // Valid JSON - clear error message and show success
                    validationMsg.style.color = '#5f5';
                    validationMsg.textContent = '✓ Valid JSON';
                    editorContainer.style.borderColor = '#5f5';
                } catch (error) {
                    // Invalid JSON - show error message
                    validationMsg.style.color = '#f55';
                    validationMsg.textContent = `❌ ${error.message}`;
                    editorContainer.style.borderColor = '#f55';
                }
            }, 300); // Debounce 300ms
        });
        
        // Handle Undo/Redo keyboard shortcuts
        code.addEventListener('keydown', (e) => {
            // Ctrl+Z or Cmd+Z - Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (undoStack.length > 1) {
                    // Save current state to redo stack
                    const currentText = code.textContent;
                    redoStack.push(currentText);
                    
                    // Remove current state from undo stack
                    undoStack.pop();
                    
                    // Restore previous state
                    const previousText = undoStack[undoStack.length - 1];
                    isUndoRedoOperation = true;
                    code.textContent = previousText;
                    applySyntaxHighlighting();
                    
                    // Try to validate
                    try {
                        JSON.parse(code.textContent);
                        validationMsg.style.color = '#5f5';
                        validationMsg.textContent = '✓ Valid JSON';
                        editorContainer.style.borderColor = '#5f5';
                    } catch (error) {
                        validationMsg.style.color = '#f55';
                        validationMsg.textContent = `❌ ${error.message}`;
                        editorContainer.style.borderColor = '#f55';
                    }
                }
                return;
            }
            
            // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z - Redo
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                if (redoStack.length > 0) {
                    // Get state from redo stack
                    const nextText = redoStack.pop();
                    
                    // Add current state to undo stack
                    undoStack.push(nextText);
                    
                    // Restore next state
                    isUndoRedoOperation = true;
                    code.textContent = nextText;
                    applySyntaxHighlighting();
                    
                    // Try to validate
                    try {
                        JSON.parse(code.textContent);
                        validationMsg.style.color = '#5f5';
                        validationMsg.textContent = '✓ Valid JSON';
                        editorContainer.style.borderColor = '#5f5';
                    } catch (error) {
                        validationMsg.style.color = '#f55';
                        validationMsg.textContent = `❌ ${error.message}`;
                        editorContainer.style.borderColor = '#f55';
                    }
                }
                return;
            }
            
            // Handle Tab key
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
        });
        
        // Handle copy event - copy plain text instead of HTML
        code.addEventListener('copy', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            const selectedText = selection.toString();
            if (selectedText) {
                e.clipboardData.setData('text/plain', selectedText);
            }
        });
        
        // Handle cut event - cut plain text instead of HTML
        code.addEventListener('cut', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            const selectedText = selection.toString();
            if (selectedText) {
                e.clipboardData.setData('text/plain', selectedText);
                document.execCommand('delete');
            }
        });
        
        // Synchronize scroll between code editor and line numbers
        editorWrapper.addEventListener('scroll', () => {
            lineNumbers.scrollTop = editorWrapper.scrollTop;
        });
        
        // Focus/blur border effects
        code.addEventListener('focus', () => {
            editorContainer.style.borderColor = '#5af';
        });
        
        code.addEventListener('blur', () => {
            editorContainer.style.borderColor = '#555';
            // Apply final highlighting on blur
            applySyntaxHighlighting();
        });
        
        editorContainer.appendChild(lineNumbers);
        editorContainer.appendChild(editorWrapper);
        content.appendChild(editorContainer);
        dialog.appendChild(content);
        dialog.appendChild(validationMsg);
        
        // Footer with buttons
        const footer = this.createFooter(code, editorContainer, validationMsg, () => {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
        });
        dialog.appendChild(footer);
        
        // Add to DOM
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
    }

    /**
     * Creates the header with title and close button
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Header element
     */
    createHeader(onClose) {
        const header = document.createElement('div');
        header.className = 'json-editor-header';
        
        const title = document.createElement('div');
        title.className = 'json-editor-title';
        title.textContent = '{ } JSON Editor';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'json-editor-close-btn';
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
        infoDiv.className = 'json-editor-info';
        infoDiv.innerHTML = `
            💡 <strong>Direct JSON editing</strong><br>
            Edit the JSON below to modify custom presets and hidden built-in presets.<br>
            Changes will replace current configuration when you click "Apply Changes".
        `;
        
        return infoDiv;
    }

    /**
     * Creates the footer with action buttons
     * @param {HTMLElement} code - Code element
     * @param {HTMLElement} editorContainer - Editor container
     * @param {HTMLElement} validationMsg - Validation message element
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Footer element
     */
    createFooter(code, editorContainer, validationMsg, onClose) {
        const footer = document.createElement('div');
        footer.className = 'json-editor-footer';
        
        const leftBtns = document.createElement('div');
        leftBtns.className = 'json-editor-footer-left';
        
        // Format button
        const formatBtn = this.createFormatButton(code, validationMsg, editorContainer);
        leftBtns.appendChild(formatBtn);
        
        const rightBtns = document.createElement('div');
        rightBtns.className = 'json-editor-footer-right';
        
        // Cancel button
        const cancelBtn = this.createCancelButton(onClose);
        rightBtns.appendChild(cancelBtn);
        
        // Apply button
        const applyBtn = this.createApplyButton(code, validationMsg, onClose);
        rightBtns.appendChild(applyBtn);
        
        footer.appendChild(leftBtns);
        footer.appendChild(rightBtns);
        
        return footer;
    }

    /**
     * Creates the format JSON button
     * @param {HTMLElement} code - Code element
     * @param {HTMLElement} validationMsg - Validation message element
     * @param {HTMLElement} editorContainer - Editor container
     * @returns {HTMLElement} Format button
     */
    createFormatButton(code, validationMsg, editorContainer) {
        const formatBtn = document.createElement('button');
        formatBtn.className = 'json-editor-format-btn';
        formatBtn.textContent = '{ } Format JSON';
        formatBtn.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(code.textContent);
                code.textContent = JSON.stringify(parsed, null, 2);
                
                // Reapply syntax highlighting
                if (window.Prism) {
                    code.innerHTML = window.Prism.highlight(code.textContent, window.Prism.languages.json, 'json');
                }
                
                validationMsg.textContent = '';
                validationMsg.style.color = '#5f5';
                validationMsg.textContent = '✓ JSON formatted successfully';
                editorContainer.style.borderColor = '#5f5';
                setTimeout(() => {
                    validationMsg.textContent = '';
                }, 2000);
            } catch (error) {
                validationMsg.style.color = '#f55';
                validationMsg.textContent = `❌ Invalid JSON: ${error.message}`;
                editorContainer.style.borderColor = '#f55';
            }
        });
        
        return formatBtn;
    }

    /**
     * Creates the cancel button
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Cancel button
     */
    createCancelButton(onClose) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'json-editor-cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', onClose);
        
        return cancelBtn;
    }

    /**
     * Creates the apply changes button
     * @param {HTMLElement} code - Code element
     * @param {HTMLElement} validationMsg - Validation message element
     * @param {Function} onClose - Close callback
     * @returns {HTMLElement} Apply button
     */
    createApplyButton(code, validationMsg, onClose) {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'json-editor-apply-btn';
        applyBtn.textContent = 'Apply Changes';
        applyBtn.addEventListener('click', () => {
            try {
                // Validate and parse JSON
                const parsed = JSON.parse(code.textContent);
                
                // Import with replace mode
                const success = this.parentDialog.manager.importFromJSON(code.textContent, false);
                
                if (success) {
                    validationMsg.style.color = '#5f5';
                    validationMsg.textContent = '✓ Changes applied successfully!';
                    
                    // Close dialog after short delay
                    setTimeout(() => {
                        onClose();
                        // Refresh main dialog
                        this.parentDialog.renderDialog();
                    }, 1000);
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
