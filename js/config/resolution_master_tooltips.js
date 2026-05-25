// Tooltip configuration for ResolutionMaster
// Contains tooltip text for ResolutionMaster and the preset manager

export const tooltips = {
    // Primary controls (excluding sliders and 2D canvas)
    swapBtn: "Swap width and height.",
    snapBtn: "Round the current size to the selected snap step.",
    snapValueArea: "Click to enter a custom snap step.",
    
    // Output value areas (editable)
    widthValueArea: "Click to enter width manually.",
    heightValueArea: "Click to enter height manually.",
    batchSizeValueArea: "Click to set how many images to create in one batch.",
    latValueArea: "Choose the latent type. Use 4x8 for most models, or 128x16 for Flux.2.",
    
    // Scaling controls (buttons and dropdowns only)
    scaleBtn: "Scale the current size by the selected multiplier.",
    upscaleRadio: "Use this multiplier for the Rescale Factor output.",
    scaleValueArea: "Click to enter a scale multiplier, for example 2 or /2.",
    
    resolutionBtn: "Scale the current size to match the selected p-resolution.",
    resolutionDropdown: "Choose the target p-resolution.",
    resolutionRadio: "Use the selected p-resolution for the Rescale Factor output.",
    resolutionValueArea: "Click to enter a scale value. Resolution Master will convert it to a p-resolution.",
    
    megapixelsBtn: "Scale the current size to the selected megapixel target.",
    megapixelsRadio: "Use the megapixel target for the Rescale Factor output.",
    megapixelsValueArea: "Click to enter the target megapixels.",
    preserveScalingRatioCheckbox: "Keep an exact aspect ratio when resizing. Also affects Smart Fit.",
    
    // Auto-detect controls
    autoDetectToggle: "Detect the size from the connected input image.",
    autoFitBtn: "Fit the current size to the closest preset now.",
    autoFitCheckbox: "When a new image is detected, fit it to the closest preset automatically.",
    smartFitToggle: "Fit to the closest preset aspect ratio while keeping the size close to the current resolution.",
    autoResizeBtn: "Resize the current size using the selected scaling mode now.",
    autoResizeCheckbox: "When a new image is detected, resize it automatically using the selected scaling mode.",
    autoSnapBtn: "Round the current size to the selected snap step now.",
    autoSnapCheckbox: "When a new image is detected, round its size to the selected snap step.",
    detectedInfo: "Click to use the detected image size directly.",
    autoDetectLiveStatus: "Shows whether size updates immediately or only after running the workflow.",
    
    // Preset controls
    categoryDropdown: "Choose a preset category.",
    presetDropdown: "Choose a resolution preset.",
    managePresetsBtn: "Open the preset manager to add, edit, hide, or delete presets.",
    customCalcCheckbox: "When a new image is detected, apply the selected model or category size rules automatically.",
    autoCalcBtn: "Apply the selected model or category size rules now.",
    calcInfoToggle: "Show or hide information about the selected Calc rules.",
    compactToggleBtn: "Show or hide the extra sections below the 2D canvas.",
    compactHelpBtn: "Open shortcuts and the project link.",
    
    // Section headers
    extraControlsHeader: "Show or hide the extra sections.",
    actionsHeader: "Show or hide the Actions section.",
    scalingHeader: "Show or hide the Scaling section.",
    autoDetectHeader: "Show or hide the Auto-Detect section.",
    presetsHeader: "Show or hide the Presets section."
};

// Tooltips for Preset Manager Dialog
export const presetManagerTooltips = {
    // Footer buttons
    'add-preset-btn': 'Add a custom resolution preset.',
    'delete-selected-btn': 'Delete the selected custom presets. Use Shift+Click to select a range.',
    'import-btn': 'Import presets from a JSON file and merge them with your current presets.',
    'export-btn': 'Export your custom presets and hidden built-in presets to a JSON file.',
    'edit-json-btn': 'Edit the full preset configuration as JSON.',
    'close-btn': 'Close the Preset Manager dialog.',
    'back-btn': 'Return to the preset list.',
    
    // Add/Edit view
    'category-select-btn': 'Choose an existing category or type a new one.',
    'resolution-master-preset-add-rename-category-btn': 'Rename the selected category.',
    'quick-add-button': 'Add this preset or save the current preset changes.',
    
    // List view
    'manage-presets-btn': 'Open the preset manager to add, edit, hide, or delete presets.',
    'resolution-master-preset-list-edit-btn': 'Edit this preset.',
    'resolution-master-preset-list-delete-btn': 'Delete this custom preset.',
    'resolution-master-preset-toggle-btn': 'Toggle visibility of this built-in preset.',
    'resolution-master-preset-list-edit-category-btn': 'Open this category for adding or editing presets.',
    'resolution-master-preset-list-category-header': 'Drag to reorder categories.',
    'resolution-master-preset-list-category-name': 'Double-click to rename this category.',
    'resolution-master-preset-list-name': 'Double-click to rename this preset.',
    'resolution-master-preset-list-checkbox': 'Select this preset for bulk deletion.',
    'resolution-master-preset-list-clone-handle': 'Drag to duplicate this preset.',
    'resolution-master-aspect-ratio-preset-action-btn': {
        'delete': 'Delete this custom preset.',
        'hide': 'Hide this built-in preset from the main preset list.',
        'unhide': 'Show this built-in preset in the main preset list again.'
    },
    
    // JSON Editor Dialog
    'json-editor-close-btn': 'Close the JSON editor without saving.',
    'json-editor-format-btn': 'Auto-format JSON with proper indentation (Ctrl+Shift+F).',
    'json-editor-cancel-btn': 'Discard changes and close the editor.',
    'json-editor-apply-btn': 'Apply this JSON and replace the current preset configuration.'
};
