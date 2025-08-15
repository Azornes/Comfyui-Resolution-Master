// ComfyUI.azToolkit.ResolutionMaster v.8.0.0 - 2025 - Fixed with separate canvas
import { app } from "../../scripts/app.js";
import { addStylesheet, getUrl } from "./utils/ResourceManager.js";

addStylesheet(getUrl('./css/resolution_master.css'));

app.registerExtension({
    name: "azResolutionMaster",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "ResolutionMaster") {
            // Set default widget options in nodeData to match properties
            nodeData.input.required.width[1].min = 64;
            nodeData.input.required.width[1].max = 4096;
            nodeData.input.required.width[1].step = 128;

            nodeData.input.required.height[1].min = 64;
            nodeData.input.required.height[1].max = 4096;
            nodeData.input.required.height[1].step = 128;

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, []);

                // Initialize properties like original Slider2D
                this.properties = this.properties || {};
                this.properties.mode = this.properties.mode ?? "Manual";
                this.properties.valueX = this.properties.valueX ?? 512;
                this.properties.valueY = this.properties.valueY ?? 512;
                this.properties.minX = this.properties.minX ?? 64;
                this.properties.maxX = this.properties.maxX ?? 4096;
                this.properties.stepX = this.properties.stepX ?? 128;
                this.properties.minY = this.properties.minY ?? 64;
                this.properties.maxY = this.properties.maxY ?? 4096;
                this.properties.stepY = this.properties.stepY ?? 128;
                this.properties.decimalsX = this.properties.decimalsX ?? 0;
                this.properties.decimalsY = this.properties.decimalsY ?? 0;
                this.properties.snap = this.properties.snap ?? true;
                this.properties.dots = this.properties.dots ?? true;
                this.properties.frame = this.properties.frame ?? true;
                // Manual Sliders mode properties
                this.properties.w_min = this.properties.w_min ?? 64;
                this.properties.w_max = this.properties.w_max ?? 4096;
                this.properties.w_step = this.properties.w_step ?? 64;
                this.properties.h_min = this.properties.h_min ?? 64;
                this.properties.h_max = this.properties.h_max ?? 4096;
                this.properties.h_step = this.properties.h_step ?? 64;

                // Internal state
                this.intpos = { x: 0.5, y: 0.5 };
                this.capture = false;
                this.configured = false;

                const node = this;
                const fontsize = LiteGraph.NODE_SUBTEXT_SIZE;
                const shiftLeft = 10;
                const shiftRight = 60;

                const widthWidget = this.widgets.find(w => w.name === 'width');
                const heightWidget = this.widgets.find(w => w.name === 'height');

                // Set widget options to prevent undefined errors
                widthWidget.options = {
                    min: this.properties.minX,
                    max: this.properties.maxX,
                    step: this.properties.stepX,
                    precision: this.properties.decimalsX
                };

                heightWidget.options = {
                    min: this.properties.minY,
                    max: this.properties.maxY,
                    step: this.properties.stepY,
                    precision: this.properties.decimalsY
                };

                // Add hidden widgets for rescale mode and value
                if (!this.widgets.find(w => w.name === 'rescale_mode')) {
                    this.addWidget("text", "rescale_mode", "resolution", null, { serialize: true });
                    const rescaleModeWidget = this.widgets.find(w => w.name === 'rescale_mode');
                    if (rescaleModeWidget) {
                        rescaleModeWidget.type = "hidden";
                        rescaleModeWidget.computeSize = () => [0, -4];
                    }
                }

                if (!this.widgets.find(w => w.name === 'rescale_value')) {
                    this.addWidget("number", "rescale_value", 1.0, null, { serialize: true });
                    const rescaleValueWidget = this.widgets.find(w => w.name === 'rescale_value');
                    if (rescaleValueWidget) {
                        rescaleValueWidget.type = "hidden";
                        rescaleValueWidget.computeSize = () => [0, -4];
                    }
                }

                const rescaleModeWidget = this.widgets.find(w => w.name === 'rescale_mode');
                const rescaleValueWidget = this.widgets.find(w => w.name === 'rescale_value');

                // Update intpos based on current values
                this.intpos.x = (widthWidget.value - this.properties.minX) / (this.properties.maxX - this.properties.minX);
                this.intpos.y = (heightWidget.value - this.properties.minY) / (this.properties.maxY - this.properties.minY);

                // Create container for centering
                const container = document.createElement('div');
                container.className = 'uar-container';

                const baseWidth = 400;
                const scalingContainer = document.createElement('div');
                scalingContainer.style.width = `${baseWidth}px`;
                scalingContainer.style.transformOrigin = 'top left';
                container.appendChild(scalingContainer);

                // Create HTML canvas element
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.className = 'uar-canvas';

                scalingContainer.appendChild(canvas);

                const swapButton = document.createElement('button');
                swapButton.textContent = '⇄ Swap';
                swapButton.className = 'uar-button';
                swapButton.title = 'Swap width and height dimensions';
                // Visibility is now controlled by the primaryControls container

                // Swap dimensions on click
                swapButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Swap the widget values
                    const tempValue = widthWidget.value;
                    widthWidget.value = heightWidget.value;
                    heightWidget.value = tempValue;

                    updateWidgetValues();
                    updateAllScaleLabels();
                    updateCanvas();
                });

                // Create primary controls row
                const primaryControls = document.createElement('div');
                primaryControls.className = 'uar-flex-row';

                primaryControls.appendChild(swapButton);

                const snapButton = document.createElement('button');
                snapButton.textContent = '⊞ Snap';
                snapButton.className = 'uar-button';
                snapButton.title = 'Snap dimensions to nearest multiple of snap value';

                const snapSlider = document.createElement('input');
                snapSlider.type = 'range';
                snapSlider.min = '16';
                snapSlider.max = '256';
                snapSlider.step = '16';
                snapSlider.value = '64';
                snapSlider.className = 'uar-slider';
                snapSlider.title = 'Snap step size';

                // Create snap value label
                const snapLabel = document.createElement('span');
                snapLabel.textContent = '64';
                snapLabel.className = 'uar-label';

                // Update label when slider changes
                snapSlider.addEventListener('input', (e) => {
                    snapLabel.textContent = e.target.value;
                });

                // Snap values on click
                snapButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const selectedCategory = categoryDropdown.value;
                    const useCustomCalc = customCalcCheckbox.checked;
                    
                    // Use 32px for Flux with custom calc, otherwise use slider value
                    const snapValue = (selectedCategory === 'Flux' && useCustomCalc) ? 32 : parseInt(snapSlider.value);

                    // Round width to nearest snap value
                    widthWidget.value = Math.round(widthWidget.value / snapValue) * snapValue;
                    heightWidget.value = Math.round(heightWidget.value / snapValue) * snapValue;
                    
                    // Apply Flux limits if custom calc is enabled
                    if (selectedCategory === 'Flux' && useCustomCalc) {
                        const fluxMin = 320;
                        const fluxMax = 2560;
                        
                        widthWidget.value = Math.max(fluxMin, Math.min(fluxMax, widthWidget.value));
                        heightWidget.value = Math.max(fluxMin, Math.min(fluxMax, heightWidget.value));
                    }

                    ensureValuesWithinBounds();
                    updateWidgetValues();
                    updateAllScaleLabels();
                    updateCanvas();
                });

                primaryControls.appendChild(snapButton);
                primaryControls.appendChild(snapSlider);
                primaryControls.appendChild(snapLabel);

                scalingContainer.appendChild(primaryControls);

                // Create scaling grid container
                const scalingGrid = document.createElement('div');
                scalingGrid.className = 'uar-grid-container';

                // --- Upscale Row ---
                const upscaleButton = document.createElement('button');
                upscaleButton.textContent = '⬆ Scale';
                upscaleButton.className = 'uar-button';
                upscaleButton.title = 'Apply upscale factor to dimensions';

                const upscaleSlider = document.createElement('input');
                upscaleSlider.type = 'range';
                upscaleSlider.min = '0.1';
                upscaleSlider.max = '4';
                upscaleSlider.step = '0.1';
                upscaleSlider.value = '1.0';
                upscaleSlider.className = 'uar-slider';
                upscaleSlider.style.width = '100%'; // Make slider flexible
                upscaleSlider.title = 'Upscale factor';

                const upscaleLabel = document.createElement('span');
                upscaleLabel.textContent = '1.0x';
                upscaleLabel.className = 'uar-label-value';

                const upscalePreviewLabel = document.createElement('span');
                upscalePreviewLabel.textContent = '';
                upscalePreviewLabel.className = 'uar-preview';

                const upscaleCheckbox = document.createElement('input');
                upscaleCheckbox.type = 'radio';
                upscaleCheckbox.name = 'rescale_mode_' + node.id;
                upscaleCheckbox.value = 'manual';
                upscaleCheckbox.className = 'uar-radio';
                upscaleCheckbox.title = 'Use manual scale for rescale_factor';

                // Update label when slider changes
                upscaleSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    upscaleLabel.textContent = value.toFixed(1) + 'x';

                    // Update preview with calculated resolution
                    const newWidth = Math.round(widthWidget.value * value);
                    const newHeight = Math.round(heightWidget.value * value);
                    upscalePreviewLabel.textContent = `${newWidth}×${newHeight}`;

                    // Update hidden widget if manual mode is selected
                    if (upscaleCheckbox.checked && rescaleValueWidget) {
                        rescaleValueWidget.value = value;
                    }
                });

                // Scale values on click
                upscaleButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const scaleFactor = parseFloat(upscaleSlider.value);
                    const selectedCategory = categoryDropdown.value;
                    const useCustomCalc = customCalcCheckbox.checked;
                    
                    // Scale width and height
                    let newWidth = Math.round(widthWidget.value * scaleFactor);
                    let newHeight = Math.round(heightWidget.value * scaleFactor);
                    
                    // Apply custom calculation if enabled
                    if (selectedCategory === 'Flux' && useCustomCalc) {
                        const fluxResult = applyFluxCustomCalculation(newWidth, newHeight);
                        newWidth = fluxResult.width;
                        newHeight = fluxResult.height;
                    } else if (selectedCategory === 'WAN' && useCustomCalc) {
                        const wanResult = applyWANCustomCalculation(newWidth, newHeight);
                        newWidth = wanResult.width;
                        newHeight = wanResult.height;
                    }
                    
                    widthWidget.value = newWidth;
                    heightWidget.value = newHeight;

                    ensureValuesWithinBounds();
                    updateWidgetValues();
                    updateCanvas();

                    // Reset slider to 1.0 after use
                    upscaleSlider.value = '1.0';
                    upscaleLabel.textContent = '1.0x';
                });

                const emptyCell = () => document.createElement('div'); // Helper for placeholders
                
                // Helper function for Flux custom calculation
                const applyFluxCustomCalculation = (width, height) => {
                    // Round to 32px increments
                    let newWidth = Math.round(width / 32) * 32;
                    let newHeight = Math.round(height / 32) * 32;
                    
                    // Flux practical limits based on community testing
                    const fluxMin = 320; // ~0.1 MP minimum
                    const fluxMaxPractical = 2560; // Practical max before quality degrades
                    
                    // Calculate megapixels
                    const currentMP = (newWidth * newHeight) / 1000000;
                    
                    // If over 4.0 MP (practical limit), scale down
                    if (currentMP > 4.0) {
                        const scaleFactor = Math.sqrt(4.0 / currentMP);
                        newWidth = Math.round((newWidth * scaleFactor) / 32) * 32;
                        newHeight = Math.round((newHeight * scaleFactor) / 32) * 32;
                    }
                    
                    // If any dimension exceeds practical max, scale to fit
                    if (newWidth > fluxMaxPractical || newHeight > fluxMaxPractical) {
                        const scaleDown = Math.min(fluxMaxPractical / newWidth, fluxMaxPractical / newHeight);
                        newWidth = Math.round((newWidth * scaleDown) / 32) * 32;
                        newHeight = Math.round((newHeight * scaleDown) / 32) * 32;
                    }
                    
                    // Ensure minimum dimensions (0.1 MP = ~316x316)
                    if (newWidth < fluxMin || newHeight < fluxMin) {
                        const scaleUp = Math.max(fluxMin / newWidth, fluxMin / newHeight);
                        newWidth = Math.round((newWidth * scaleUp) / 32) * 32;
                        newHeight = Math.round((newHeight * scaleUp) / 32) * 32;
                    }
                    
                    // Final clamp to ensure within practical limits
                    newWidth = Math.max(fluxMin, Math.min(fluxMaxPractical, newWidth));
                    newHeight = Math.max(fluxMin, Math.min(fluxMaxPractical, newHeight));
                    
                    return { width: newWidth, height: newHeight };
                };

                // Helper function for WAN custom calculation
                const applyWANCustomCalculation = (width, height) => {
                    // WAN flexible resolution range: 320p to 820p
                    // "p" resolution is based on total pixel count, not just height
                    // 320p at 16:9 = 569x320 = 182,080 pixels
                    // 480p at 16:9 = 853x480 = 409,440 pixels  
                    // 720p at 16:9 = 1280x720 = 921,600 pixels
                    // 820p at 16:9 = 1458x820 = 1,195,560 pixels
                    
                    const minPixels = 182080;  // 320p equivalent
                    const maxPixels = 1195560; // 820p equivalent
                    
                    // Calculate current aspect ratio
                    const currentAspectRatio = width / height;
                    const currentPixels = width * height;
                    
                    // Determine target pixel count within WAN range
                    let targetPixels = Math.max(minPixels, Math.min(maxPixels, currentPixels));
                    
                    // Calculate dimensions maintaining aspect ratio
                    let targetWidth, targetHeight;
                    
                    if (currentAspectRatio >= 1) {
                        // Landscape or square
                        targetHeight = Math.sqrt(targetPixels / currentAspectRatio);
                        targetWidth = targetHeight * currentAspectRatio;
                    } else {
                        // Portrait
                        targetWidth = Math.sqrt(targetPixels * currentAspectRatio);
                        targetHeight = targetWidth / currentAspectRatio;
                    }
                    
                    // Round to 16px increments (common for video encoding)
                    targetWidth = Math.round(targetWidth / 16) * 16;
                    targetHeight = Math.round(targetHeight / 16) * 16;
                    
                    // Recalculate actual pixels after rounding
                    const actualPixels = targetWidth * targetHeight;
                    
                    // If rounding pushed us too far out of range, adjust
                    if (actualPixels > maxPixels * 1.1) {
                        // Scale down to fit within range
                        const scaleFactor = Math.sqrt(maxPixels / actualPixels);
                        targetWidth = Math.round((targetWidth * scaleFactor) / 16) * 16;
                        targetHeight = Math.round((targetHeight * scaleFactor) / 16) * 16;
                    } else if (actualPixels < minPixels * 0.9) {
                        // Scale up to fit within range
                        const scaleFactor = Math.sqrt(minPixels / actualPixels);
                        targetWidth = Math.round((targetWidth * scaleFactor) / 16) * 16;
                        targetHeight = Math.round((targetHeight * scaleFactor) / 16) * 16;
                    }
                    
                    // Final safety clamps
                    targetWidth = Math.max(320, Math.min(2048, targetWidth));
                    targetHeight = Math.max(320, Math.min(2048, targetHeight));
                    
                    // Determine recommended model based on final resolution
                    const pixels480p = 409440; // 480p at 16:9
                    const pixels720p = 921600; // 720p at 16:9
                    const finalPixels = targetWidth * targetHeight;
                    
                    // Calculate which resolution is closer
                    const dist480p = Math.abs(finalPixels - pixels480p);
                    const dist720p = Math.abs(finalPixels - pixels720p);
                    
                    const recommendedModel = dist480p < dist720p ? "480p" : "720p";
                    
                    // Calculate equivalent "p" value for logging
                    const equivalentP = Math.round(Math.sqrt(finalPixels * 9 / 16));
                    
                    return { 
                        width: targetWidth, 
                        height: targetHeight,
                        recommendedModel: recommendedModel,
                        equivalentP: equivalentP
                    };
                };

                // Helper function to ensure values are within bounds
                const ensureValuesWithinBounds = () => {
                    widthWidget.value = Math.max(node.properties.minX,
                        Math.min(node.properties.maxX, widthWidget.value));
                    heightWidget.value = Math.max(node.properties.minY,
                        Math.min(node.properties.maxY, heightWidget.value));
                };

                // Helper function to update widget values and internal state
                const updateWidgetValues = () => {
                    // Update intpos based on new values
                    node.intpos.x = (widthWidget.value - node.properties.minX) /
                        (node.properties.maxX - node.properties.minX);
                    node.intpos.y = (heightWidget.value - node.properties.minY) /
                        (node.properties.maxY - node.properties.minY);

                    node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
                    node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));

                    // Update node properties
                    node.properties.valueX = widthWidget.value;
                    node.properties.valueY = heightWidget.value;

                    // Trigger property change handlers
                    node.onPropertyChanged('valueX');
                    node.onPropertyChanged('valueY');

                    // Force widget UI update
                    if (widthWidget.inputEl) {
                        widthWidget.inputEl.value = widthWidget.value;
                    }
                    if (heightWidget.inputEl) {
                        heightWidget.inputEl.value = heightWidget.value;
                    }
                    
                    // Update WAN mode info message with current recommended model
                    const selectedCategory = categoryDropdown.value;
                    const useCustomCalc = customCalcCheckbox.checked;
                    if (selectedCategory === 'WAN' && useCustomCalc) {
                        // Calculate which model is recommended for current resolution
                        const pixels480p = 832 * 480; // 399,360
                        const pixels720p = 1280 * 720; // 921,600
                        const currentPixels = widthWidget.value * heightWidget.value;
                        
                        // Calculate which resolution is closer
                        const dist480p = Math.abs(currentPixels - pixels480p);
                        const dist720p = Math.abs(currentPixels - pixels720p);
                        
                        const recommendedModel = dist480p < dist720p ? "480p" : "720p";
                        const currentResolution = `${widthWidget.value}×${heightWidget.value}`;
                        
                        // Update info message with current recommendation
                        infoMessage.innerHTML = `💡 WAN Mode: Current ${currentResolution} → <strong>Use ${recommendedModel} model</strong> • 320p-820p flexible range • 16px increments`;
                        infoMessage.style.display = 'block';
                    }
                };

                // Helper function to update all scale labels
                const updateAllScaleLabels = () => {
                    updateResolutionScaleLabel();
                    updateMegapixelsScaleLabel();
                    updateUpscalePreview();
                };

                // Helper function to render and update canvas
                const updateCanvas = () => {
                    renderCanvas();
                    app.graph.setDirtyCanvas(true);
                };

                scalingGrid.appendChild(upscaleButton);
                scalingGrid.appendChild(upscaleSlider);
                scalingGrid.appendChild(upscaleLabel);
                scalingGrid.appendChild(emptyCell()); // Placeholder for scale
                scalingGrid.appendChild(upscalePreviewLabel);
                scalingGrid.appendChild(upscaleCheckbox);

                // --- Resolution Row ---
                const resolutionButton = document.createElement('button');
                resolutionButton.textContent = '📺 Res';
                resolutionButton.className = 'uar-button';
                resolutionButton.title = 'Scale to target resolution height';

                const resolutionDropdown = document.createElement('select');
                resolutionDropdown.className = 'uar-dropdown uar-dropdown-small';
                resolutionDropdown.title = 'Target resolution';

                const resolutions = [
                    { label: '480p', value: 480 }, { label: '720p', value: 720 }, { label: '820p', value: 820 },
                    { label: '1080p', value: 1080 }, { label: '1440p', value: 1440 },
                    { label: '2160p', value: 2160 }, { label: '4320p', value: 4320 }
                ];

                resolutions.forEach(res => {
                    const option = document.createElement('option');
                    option.value = res.value;
                    option.textContent = res.label;
                    resolutionDropdown.appendChild(option);
                });
                resolutionDropdown.value = '1080';

                const resolutionScaleLabel = document.createElement('span');
                resolutionScaleLabel.textContent = '';
                resolutionScaleLabel.className = 'uar-label-small';

                const resolutionPreviewLabel = document.createElement('span');
                resolutionPreviewLabel.textContent = '';
                resolutionPreviewLabel.className = 'uar-preview';

                const resolutionCheckbox = document.createElement('input');
                resolutionCheckbox.type = 'radio';
                resolutionCheckbox.name = 'rescale_mode_' + node.id;
                resolutionCheckbox.value = 'resolution';
                resolutionCheckbox.checked = true;
                resolutionCheckbox.className = 'uar-radio';
                resolutionCheckbox.title = 'Use resolution scale for rescale_factor';

                const calculateResolutionScale = (targetP, currentWidth, currentHeight) => {
                    const targetPixels = (targetP * (16 / 9)) * targetP;
                    const currentPixels = currentWidth * currentHeight;
                    return Math.sqrt(targetPixels / currentPixels);
                };

                const updateResolutionScaleLabel = () => {
                    const targetP = parseInt(resolutionDropdown.value);
                    const scaleFactor = calculateResolutionScale(targetP, widthWidget.value, heightWidget.value);
                    resolutionScaleLabel.textContent = `×${scaleFactor.toFixed(2)}`;

                    const newWidth = Math.round(widthWidget.value * scaleFactor);
                    const newHeight = Math.round(heightWidget.value * scaleFactor);
                    resolutionPreviewLabel.textContent = `${newWidth}×${newHeight}`;

                    if (resolutionCheckbox.checked && rescaleValueWidget) {
                        rescaleValueWidget.value = scaleFactor;
                    }
                };

                resolutionDropdown.addEventListener('change', updateResolutionScaleLabel);

                resolutionButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const targetP = parseInt(resolutionDropdown.value);
                    const scaleFactor = calculateResolutionScale(targetP, widthWidget.value, heightWidget.value);
                    const selectedCategory = categoryDropdown.value;
                    const useCustomCalc = customCalcCheckbox.checked;

                    let newWidth = Math.round(widthWidget.value * scaleFactor);
                    let newHeight = Math.round(heightWidget.value * scaleFactor);
                    
                    // Apply custom calculation if enabled
                    if (selectedCategory === 'Flux' && useCustomCalc) {
                        const fluxResult = applyFluxCustomCalculation(newWidth, newHeight);
                        newWidth = fluxResult.width;
                        newHeight = fluxResult.height;
                    } else if (selectedCategory === 'WAN' && useCustomCalc) {
                        const wanResult = applyWANCustomCalculation(newWidth, newHeight);
                        newWidth = wanResult.width;
                        newHeight = wanResult.height;
                    }
                    
                    widthWidget.value = newWidth;
                    heightWidget.value = newHeight;

                    ensureValuesWithinBounds();
                    updateWidgetValues();
                    updateCanvas();
                    updateAllScaleLabels();
                });

                scalingGrid.appendChild(resolutionButton);
                scalingGrid.appendChild(resolutionDropdown);
                scalingGrid.appendChild(emptyCell()); // Placeholder for value
                scalingGrid.appendChild(resolutionScaleLabel);
                scalingGrid.appendChild(resolutionPreviewLabel);
                scalingGrid.appendChild(resolutionCheckbox);

                // --- Megapixels Row ---
                const megapixelsButton = document.createElement('button');
                megapixelsButton.textContent = '📷 MP';
                megapixelsButton.className = 'uar-button';
                megapixelsButton.title = 'Scale to target megapixels';

                const megapixelsSlider = document.createElement('input');
                megapixelsSlider.type = 'range';
                megapixelsSlider.min = '0.5';
                megapixelsSlider.max = '12';
                megapixelsSlider.step = '0.1';
                megapixelsSlider.value = '2';
                megapixelsSlider.className = 'uar-slider';
                megapixelsSlider.style.width = '100%'; // Make slider flexible
                megapixelsSlider.title = 'Target megapixels';

                const megapixelsLabel = document.createElement('span');
                megapixelsLabel.textContent = '2.0 MP';
                megapixelsLabel.className = 'uar-label-small';

                const megapixelsScaleLabel = document.createElement('span');
                megapixelsScaleLabel.textContent = '';
                megapixelsScaleLabel.className = 'uar-label-small';

                const megapixelsPreviewLabel = document.createElement('span');
                megapixelsPreviewLabel.textContent = '';
                megapixelsPreviewLabel.className = 'uar-preview';

                const megapixelsCheckbox = document.createElement('input');
                megapixelsCheckbox.type = 'radio';
                megapixelsCheckbox.name = 'rescale_mode_' + node.id;
                megapixelsCheckbox.value = 'megapixels';
                megapixelsCheckbox.className = 'uar-radio';
                megapixelsCheckbox.title = 'Use megapixels scale for rescale_factor';

                const calculateMegapixelsScale = (targetMP, currentWidth, currentHeight) => {
                    const targetPixels = targetMP * 1000000;
                    const currentPixels = currentWidth * currentHeight;
                    return Math.sqrt(targetPixels / currentPixels);
                };

                const updateMegapixelsScaleLabel = () => {
                    const targetMP = parseFloat(megapixelsSlider.value);
                    const scaleFactor = calculateMegapixelsScale(targetMP, widthWidget.value, heightWidget.value);
                    megapixelsScaleLabel.textContent = `×${scaleFactor.toFixed(2)}`;

                    const newWidth = Math.round(widthWidget.value * scaleFactor);
                    const newHeight = Math.round(heightWidget.value * scaleFactor);
                    megapixelsPreviewLabel.textContent = `${newWidth}×${newHeight}`;

                    if (megapixelsCheckbox.checked && rescaleValueWidget) {
                        rescaleValueWidget.value = scaleFactor;
                    }
                };

                megapixelsSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    megapixelsLabel.textContent = value.toFixed(1) + ' MP';
                    updateMegapixelsScaleLabel();

                    if (megapixelsCheckbox.checked && rescaleValueWidget) {
                        const scaleFactor = calculateMegapixelsScale(value, widthWidget.value, heightWidget.value);
                        rescaleValueWidget.value = scaleFactor;
                    }
                });

                megapixelsButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const targetMP = parseFloat(megapixelsSlider.value);
                    const scaleFactor = calculateMegapixelsScale(targetMP, widthWidget.value, heightWidget.value);
                    const selectedCategory = categoryDropdown.value;
                    const useCustomCalc = customCalcCheckbox.checked;

                    let newWidth = Math.round(widthWidget.value * scaleFactor);
                    let newHeight = Math.round(heightWidget.value * scaleFactor);
                    
                    // Apply custom calculation if enabled
                    if (selectedCategory === 'Flux' && useCustomCalc) {
                        const fluxResult = applyFluxCustomCalculation(newWidth, newHeight);
                        newWidth = fluxResult.width;
                        newHeight = fluxResult.height;
                    } else if (selectedCategory === 'WAN' && useCustomCalc) {
                        const wanResult = applyWANCustomCalculation(newWidth, newHeight);
                        newWidth = wanResult.width;
                        newHeight = wanResult.height;
                    }
                    
                    widthWidget.value = newWidth;
                    heightWidget.value = newHeight;

                    ensureValuesWithinBounds();
                    updateWidgetValues();
                    updateCanvas();
                    updateAllScaleLabels();
                });

                scalingGrid.appendChild(megapixelsButton);
                scalingGrid.appendChild(megapixelsSlider);
                scalingGrid.appendChild(megapixelsLabel);
                scalingGrid.appendChild(megapixelsScaleLabel);
                scalingGrid.appendChild(megapixelsPreviewLabel);
                scalingGrid.appendChild(megapixelsCheckbox);

                scalingContainer.appendChild(scalingGrid);

                const updateUpscalePreview = () => {
                    const value = parseFloat(upscaleSlider.value);
                    const newWidth = Math.round(widthWidget.value * value);
                    const newHeight = Math.round(heightWidget.value * value);
                    upscalePreviewLabel.textContent = `${newWidth}×${newHeight}`;
                };

                const updateScaleModeVisuals = () => {
                    if (upscaleCheckbox.checked) {
                        upscaleLabel.style.opacity = '1';
                        resolutionScaleLabel.style.opacity = '0.5';
                        megapixelsScaleLabel.style.opacity = '0.5';
                        if (rescaleModeWidget) rescaleModeWidget.value = 'manual';
                        if (rescaleValueWidget) rescaleValueWidget.value = parseFloat(upscaleSlider.value);
                    } else if (resolutionCheckbox.checked) {
                        upscaleLabel.style.opacity = '0.5';
                        resolutionScaleLabel.style.opacity = '1';
                        megapixelsScaleLabel.style.opacity = '0.5';
                        if (rescaleModeWidget) rescaleModeWidget.value = 'resolution';
                        const targetP = parseInt(resolutionDropdown.value);
                        const scaleFactor = calculateResolutionScale(targetP, widthWidget.value, heightWidget.value);
                        if (rescaleValueWidget) rescaleValueWidget.value = scaleFactor;
                    } else if (megapixelsCheckbox.checked) {
                        upscaleLabel.style.opacity = '0.5';
                        resolutionScaleLabel.style.opacity = '0.5';
                        megapixelsScaleLabel.style.opacity = '1';
                        if (rescaleModeWidget) rescaleModeWidget.value = 'megapixels';
                        const targetMP = parseFloat(megapixelsSlider.value);
                        const scaleFactor = calculateMegapixelsScale(targetMP, widthWidget.value, heightWidget.value);
                        if (rescaleValueWidget) rescaleValueWidget.value = scaleFactor;
                    }
                };

                upscaleCheckbox.addEventListener('change', updateScaleModeVisuals);
                resolutionCheckbox.addEventListener('change', updateScaleModeVisuals);
                megapixelsCheckbox.addEventListener('change', updateScaleModeVisuals);

                // Initial scale label updates
                setTimeout(() => {
                    updateResolutionScaleLabel();
                    updateMegapixelsScaleLabel();
                    updateUpscalePreview();
                    // Set initial opacity
                    megapixelsScaleLabel.style.opacity = '0.5';
                }, 100);

                // Create auto-detect controls
                const autoDetectContainer = document.createElement('div');
                autoDetectContainer.className = 'uar-flex-row';
                autoDetectContainer.style.marginTop = '5px';
                autoDetectContainer.style.alignItems = 'center';
                autoDetectContainer.style.gap = '10px';

                // Auto-detect checkbox
                const autoDetectCheckbox = document.createElement('input');
                autoDetectCheckbox.type = 'checkbox';
                autoDetectCheckbox.className = 'uar-checkbox';
                autoDetectCheckbox.id = 'auto-detect-' + node.id;
                autoDetectCheckbox.title = 'Automatically detect dimensions from input image';

                const autoDetectLabel = document.createElement('label');
                autoDetectLabel.textContent = 'Auto-detect from input';
                autoDetectLabel.className = 'uar-label';
                autoDetectLabel.htmlFor = 'auto-detect-' + node.id;
                autoDetectLabel.style.cursor = 'pointer';
                autoDetectLabel.title = 'Automatically detect dimensions from input image';

                // Auto-fit to preset button
                const autoFitButton = document.createElement('button');
                autoFitButton.textContent = '🎯 Auto-fit to preset';
                autoFitButton.className = 'uar-button';
                autoFitButton.title = 'Automatically find closest resolution in selected preset category';
                autoFitButton.style.display = 'none'; // Hidden by default

                // Auto-fit on image change checkbox
                const autoFitOnChangeCheckbox = document.createElement('input');
                autoFitOnChangeCheckbox.type = 'checkbox';
                autoFitOnChangeCheckbox.className = 'uar-checkbox';
                autoFitOnChangeCheckbox.id = 'auto-fit-change-' + node.id;
                autoFitOnChangeCheckbox.title = 'Automatically run auto-fit when new image is detected';
                autoFitOnChangeCheckbox.style.display = 'none'; // Hidden by default

                const autoFitOnChangeLabel = document.createElement('label');
                autoFitOnChangeLabel.textContent = 'Auto-fit on change';
                autoFitOnChangeLabel.className = 'uar-label';
                autoFitOnChangeLabel.htmlFor = 'auto-fit-change-' + node.id;
                autoFitOnChangeLabel.style.cursor = 'pointer';
                autoFitOnChangeLabel.title = 'Automatically run auto-fit when new image is detected';
                autoFitOnChangeLabel.style.display = 'none'; // Hidden by default

                // Variables to track detected dimensions
                let detectedDimensions = null;
                let dimensionCheckInterval = null;
                let manuallySetByAutoFit = false; // Track if dimensions were set by auto-fit

                // Function to check for image dimensions from connected input
                const checkForImageDimensions = async () => {
                    try {
                        // Check if there's an input image connected
                        if (!node.inputs || !node.inputs[0] || !node.inputs[0].link) {
                            // No image input connected
                            detectedDimensions = null;
                            if (autoDetectCheckbox.checked) {
                                // Reset to default values when no image is connected
                                widthWidget.value = 512;
                                heightWidget.value = 512;
                                updateWidgetValues();
                                updateAllScaleLabels();
                                updateCanvas();
                            }
                            return;
                        }

                        // Get the link ID to check if image has changed
                        const linkId = node.inputs[0].link;
                        const graph = app.graph;
                        
                        if (graph) {
                            const link = graph.links[linkId];
                            if (link) {
                                const sourceNode = graph.getNodeById(link.origin_id);
                                if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                    // Get dimensions from the first image
                                    const img = sourceNode.imgs[0];
                                    
                                    // Check if dimensions have changed
                                    if (!detectedDimensions || 
                                        detectedDimensions.width !== img.naturalWidth || 
                                        detectedDimensions.height !== img.naturalHeight) {
                                        
                                        detectedDimensions = {
                                            width: img.naturalWidth,
                                            height: img.naturalHeight
                                        };

                                        // Reset auto-fit flag when image changes - allow auto-detect to work again
                                        manuallySetByAutoFit = false;

                        // If auto-detect is enabled and dimensions weren't manually set by auto-fit, update the dimensions
                        if (autoDetectCheckbox.checked && !manuallySetByAutoFit) {
                            widthWidget.value = detectedDimensions.width;
                            heightWidget.value = detectedDimensions.height;
                            
                            // Update UI
                            updateWidgetValues();
                            updateAllScaleLabels();
                            updateCanvas();
                            
                            console.log(`[ResolutionMaster] Auto-detected dimensions: ${detectedDimensions.width}x${detectedDimensions.height}`);
                        }

                                        // Show auto-fit button and checkbox when we have detected dimensions
                                        autoFitButton.style.display = detectedDimensions ? 'block' : 'none';
                                        autoFitOnChangeCheckbox.style.display = detectedDimensions && categoryDropdown.value ? 'inline-block' : 'none';
                                        autoFitOnChangeLabel.style.display = detectedDimensions && categoryDropdown.value ? 'inline-block' : 'none';

                                        // If auto-fit on change is enabled and we have a category selected, automatically run auto-fit
                                        if (autoFitOnChangeCheckbox.checked && categoryDropdown.value && detectedDimensions) {
                                            // Trigger auto-fit automatically
                                            autoFitButton.click();
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('[ResolutionMaster] Error checking for image dimensions:', error);
                    }
                };

                // Initialize auto-detect checkbox state from widget
                const autoDetectWidget = node.widgets.find(w => w.name === 'auto_detect');
                if (autoDetectWidget) {
                    autoDetectCheckbox.checked = autoDetectWidget.value;
                    
                    // If auto-detect is initially enabled, start checking
                    if (autoDetectWidget.value) {
                        checkForImageDimensions();
                        dimensionCheckInterval = setInterval(checkForImageDimensions, 1000);
                        widthWidget.disabled = true;
                        heightWidget.disabled = true;
                    }
                }

                // Auto-detect checkbox change handler
                autoDetectCheckbox.addEventListener('change', (e) => {
                    const autoDetectWidget = node.widgets.find(w => w.name === 'auto_detect');
                    if (autoDetectWidget) {
                        autoDetectWidget.value = e.target.checked;
                    }

                    if (e.target.checked) {
                        // Start checking for dimensions every second
                        checkForImageDimensions();
                        dimensionCheckInterval = setInterval(checkForImageDimensions, 1000);
                        
                        // Disable manual controls
                        widthWidget.disabled = true;
                        heightWidget.disabled = true;
                    } else {
                        // Stop checking for dimensions
                        if (dimensionCheckInterval) {
                            clearInterval(dimensionCheckInterval);
                            dimensionCheckInterval = null;
                        }
                        
                        // Enable manual controls
                        widthWidget.disabled = false;
                        heightWidget.disabled = false;
                    }
                });

                // Auto-fit button click handler
                autoFitButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!detectedDimensions) {
                        console.warn('[ResolutionMaster] No detected dimensions available');
                        return;
                    }

                    const selectedCategory = categoryDropdown.value;
                    if (!selectedCategory) {
                        alert('Please select a preset category first');
                        return;
                    }

                    const presets = presetCategories[selectedCategory];
                    if (!presets) {
                        console.warn('[ResolutionMaster] Invalid category selected');
                        return;
                    }

                    // Find the closest preset to the detected dimensions
                    let closestPreset = null;
                    let closestDistance = Infinity;
                    const detectedAspect = detectedDimensions.width / detectedDimensions.height;
                    const detectedPixels = detectedDimensions.width * detectedDimensions.height;

                    Object.keys(presets).forEach(presetName => {
                        const preset = presets[presetName];
                        
                        // Check both original and flipped orientations
                        const orientations = [
                            { width: preset.width, height: preset.height, flipped: false },
                            { width: preset.height, height: preset.width, flipped: true }
                        ];
                        
                        orientations.forEach(orientation => {
                            const presetAspect = orientation.width / orientation.height;
                            const presetPixels = orientation.width * orientation.height;
                            
                            // Calculate distance based on aspect ratio and total pixels
                            const aspectDiff = Math.abs(detectedAspect - presetAspect);
                            const pixelDiff = Math.abs(Math.log(detectedPixels / presetPixels));
                            const distance = aspectDiff + pixelDiff * 0.5;
                            
                            if (distance < closestDistance) {
                                closestDistance = distance;
                                const orientationSuffix = orientation.flipped ? ' (flipped)' : '';
                                closestPreset = { 
                                    name: presetName + orientationSuffix, 
                                    width: orientation.width, 
                                    height: orientation.height,
                                    originalName: presetName
                                };
                            }
                        });
                    });

                    if (closestPreset) {
                        // Apply the closest preset
                        let finalWidth = closestPreset.width;
                        let finalHeight = closestPreset.height;
                        
                        // Apply category-specific scaling if custom calc is enabled
                        const useCustomCalc = customCalcCheckbox.checked;
                        if (useCustomCalc) {
                            if (selectedCategory === 'WAN') {
                                // For WAN mode, scale to optimal "p" resolution based on detected dimensions
                                const wanResult = applyWANCustomCalculation(detectedDimensions.width, detectedDimensions.height);
                                finalWidth = wanResult.width;
                                finalHeight = wanResult.height;
                                console.log(`[ResolutionMaster] WAN scaling applied: ${detectedDimensions.width}x${detectedDimensions.height} → ${finalWidth}x${finalHeight} (${wanResult.recommendedModel} model)`);
                            } else if (selectedCategory === 'Flux') {
                                // For Flux mode, apply constraints while maintaining aspect ratio
                                const fluxResult = applyFluxCustomCalculation(closestPreset.width, closestPreset.height);
                                finalWidth = fluxResult.width;
                                finalHeight = fluxResult.height;
                                console.log(`[ResolutionMaster] Flux constraints applied: ${closestPreset.width}x${closestPreset.height} → ${finalWidth}x${finalHeight}`);
                            }
                            // For other categories with custom calc, use the preset as-is
                        }
                        
                        // Apply the final dimensions
                        widthWidget.value = finalWidth;
                        heightWidget.value = finalHeight;
                        
                        // Mark that dimensions were manually set by auto-fit
                        manuallySetByAutoFit = true;
                        
                        // Update the preset dropdown - use original name for dropdown selection
                        presetDropdown.value = closestPreset.originalName;
                        
                        // Update UI
                        updateWidgetValues();
                        updateAllScaleLabels();
                        updateCanvas();
                        
                        console.log(`[ResolutionMaster] Auto-fitted to preset: ${closestPreset.name} with final resolution: ${finalWidth}x${finalHeight}`);
                    }
                });

                // Add controls to container
                autoDetectContainer.appendChild(autoDetectCheckbox);
                autoDetectContainer.appendChild(autoDetectLabel);
                autoDetectContainer.appendChild(autoFitButton);
                autoDetectContainer.appendChild(autoFitOnChangeCheckbox);
                autoDetectContainer.appendChild(autoFitOnChangeLabel);
                
                scalingContainer.appendChild(autoDetectContainer);

                // Create preset aspect ratio controls
                const presetContainer = document.createElement('div');
                presetContainer.className = 'uar-flex-row'; // Use flex-row for side-by-side layout
                presetContainer.style.marginTop = '5px';
                presetContainer.style.alignItems = 'center'; // Ensure vertical alignment

                // Preset categories
                const presetCategories = {
                    'Standard': {
                        '1:1 Square': { width: 512, height: 512 },
                        '1:2 Tall': { width: 512, height: 1024 },
                        '1:3 Ultra Tall': { width: 512, height: 1536 },
                        '2:3 Portrait': { width: 512, height: 768 },
                        '3:4 Portrait': { width: 576, height: 768 },
                        '4:5 Portrait': { width: 512, height: 640 },
                        '4:7 Phone': { width: 512, height: 896 },
                        '5:12 Banner': { width: 512, height: 1228 },
                        '7:9 Vertical': { width: 512, height: 658 },
                        '9:16 Mobile': { width: 576, height: 1024 },
                        '9:21 Ultra Mobile': { width: 512, height: 1194 },
                        '10:16 Monitor': { width: 640, height: 1024 },
                        '13:19 Tall Screen': { width: 512, height: 748 },
                        '3:2 Landscape': { width: 768, height: 512 },
                        '4:3 Classic': { width: 512, height: 384 },
                        '16:9 Widescreen': { width: 768, height: 432 },
                        '21:9 Ultrawide': { width: 1024, height: 439 }
                    },
                    'SDXL': {
                        '1:1 Square': { width: 1024, height: 1024 },
                        '3:4 Portrait': { width: 768, height: 1024 },
                        '4:5 Portrait': { width: 915, height: 1144 },
                        '5:12 Portrait': { width: 640, height: 1536 },
                        '7:9 Portrait': { width: 896, height: 1152 },
                        '9:16 Portrait': { width: 768, height: 1344 },
                        '13:19 Portrait': { width: 832, height: 1216 },
                        '3:2 Landscape': { width: 1254, height: 836 }
                    },
                    'Flux': {
                        '1:1 Square': { width: 1024, height: 1024 },
                        '2:3 Portrait': { width: 832, height: 1248 },
                        '3:4 Portrait': { width: 896, height: 1184 },
                        '4:5 Portrait': { width: 928, height: 1152 },
                        '9:16 Portrait': { width: 768, height: 1344 },
                        '9:21 Portrait': { width: 672, height: 1440 },
                    },
                    'WAN': {
                        '1:1 Square': { width: 720, height: 720 },
                        '2:3 Portrait': { width: 588, height: 882 },
                        '3:4 Portrait': { width: 624, height: 832 },
                        '9:16 Portrait': { width: 720, height: 1280 },
                        '9:21 Portrait': { width: 549, height: 1280 },
                        '3:2 Landscape': { width: 1080, height: 720 },
                        '4:3 Landscape': { width: 960, height: 720 },
                        '16:9 Landscape': { width: 1280, height: 720 },
                        '21:9 Landscape': { width: 1680, height: 720 }
                    },
                    'Social Media': {
                        'Instagram Square': { width: 1080, height: 1080 },
                        'Instagram Portrait': { width: 1080, height: 1350 },
                        'Twitter Post': { width: 1200, height: 675 },
                        'Facebook Cover': { width: 1200, height: 630 },
                        'YouTube Thumbnail': { width: 1280, height: 720 }
                    },
                    'Print': {
                        'A4 Portrait': { width: 2480, height: 3508 },
                        'A4 Landscape': { width: 3508, height: 2480 },
                        'Letter Portrait': { width: 2550, height: 3300 },
                        '4x6 Photo': { width: 1200, height: 1800 },
                        '8x10 Photo': { width: 2400, height: 3000 }
                    },
                    'Cinema': {
                        '2.39:1 Anamorphic': { width: 2048, height: 858 },
                        '1.85:1 Standard': { width: 1998, height: 1080 },
                        '2:1 Univisium': { width: 2048, height: 1024 },
                        '4:3 Academy': { width: 1440, height: 1080 },
                        '1.33:1 Classic': { width: 1436, height: 1080 }
                    }
                };

                const categoryDropdown = document.createElement('select');
                categoryDropdown.className = 'uar-dropdown uar-dropdown-medium';
                categoryDropdown.title = 'Select preset category';

                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select Category...';
                categoryDropdown.appendChild(defaultOption);

                // Add category options
                Object.keys(presetCategories).forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categoryDropdown.appendChild(option);
                });

                const presetDropdown = document.createElement('select');
                presetDropdown.className = 'uar-dropdown uar-dropdown-medium';
                presetDropdown.style.display = 'none';
                presetDropdown.title = 'Select aspect ratio preset';

                // Create custom calculation checkbox
                const customCalcCheckbox = document.createElement('input');
                customCalcCheckbox.type = 'checkbox';
                customCalcCheckbox.className = 'uar-checkbox';
                customCalcCheckbox.style.display = 'none';
                customCalcCheckbox.style.marginLeft = '5px';
                customCalcCheckbox.title = 'Enable custom resolution calculation for this category';
                
                const customCalcLabel = document.createElement('label');
                customCalcLabel.textContent = 'Custom Calc';
                customCalcLabel.className = 'uar-label';
                customCalcLabel.style.display = 'none';
                customCalcLabel.style.marginLeft = '5px';
                customCalcLabel.style.cursor = 'pointer';
                customCalcLabel.title = 'Enable custom resolution calculation for this category';
                
                // Store custom calculation settings per category
                const categoryCustomCalc = {};
                
                // Create info message element
                const infoMessage = document.createElement('div');
                infoMessage.className = 'uar-info-message';
                infoMessage.style.display = 'none';

                // Category change handler
                categoryDropdown.addEventListener('change', (e) => {
                    const selectedCategory = e.target.value;

                    // Clear preset dropdown
                    presetDropdown.innerHTML = '';

                    if (selectedCategory) {
                        // Show preset dropdown and custom calc checkbox
                        presetDropdown.style.display = 'block';
                        customCalcCheckbox.style.display = 'inline-block';
                        customCalcLabel.style.display = 'inline-block';
                        
                        // Restore checkbox state for this category
                        customCalcCheckbox.checked = categoryCustomCalc[selectedCategory] || false;

                        // Add default option
                        const defaultPreset = document.createElement('option');
                        defaultPreset.value = '';
                        defaultPreset.textContent = 'Select Preset...';
                        presetDropdown.appendChild(defaultPreset);

                        // Add presets for selected category
                        const presets = presetCategories[selectedCategory];
                        Object.keys(presets).forEach(presetName => {
                            const option = document.createElement('option');
                            option.value = presetName;
                            const preset = presets[presetName];
                            option.textContent = `${presetName} (${preset.width}x${preset.height})`;
                            presetDropdown.appendChild(option);
                        });

                        // Update button states and info message based on new category and checkbox state
                        const useCustomCalc = customCalcCheckbox.checked;
                        if (selectedCategory === 'SDXL' && useCustomCalc) {
                            // Disable scale buttons and snap button for SDXL
                            upscaleButton.disabled = true;
                            resolutionButton.disabled = true;
                            megapixelsButton.disabled = true;
                            snapButton.disabled = true;
                            
                            // Show info message for SDXL
                            infoMessage.innerHTML = '💡 SDXL Mode: Only officially supported resolutions shown • Fixed dimensions';
                            infoMessage.style.display = 'block';
                        } else if (selectedCategory === 'Flux' && useCustomCalc) {
                            // Keep buttons enabled for Flux but show info
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Show info message for Flux
                            infoMessage.innerHTML = '💡 Flux Mode: 32px increments • 320-2560px limits • Max 4.0 MP • Sweet spot: 1920×1080';
                            infoMessage.style.display = 'block';
                        } else if (selectedCategory === 'WAN' && useCustomCalc) {
                            // Keep buttons enabled for WAN but show info
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Calculate which model is recommended for current resolution
                            const pixels480p = 832 * 480; // 399,360
                            const pixels720p = 1280 * 720; // 921,600
                            const currentPixels = widthWidget.value * heightWidget.value;
                            
                            // Calculate which resolution is closer
                            const dist480p = Math.abs(currentPixels - pixels480p);
                            const dist720p = Math.abs(currentPixels - pixels720p);
                            
                            const recommendedModel = dist480p < dist720p ? "480p" : "720p";
                            const currentResolution = `${widthWidget.value}×${heightWidget.value}`;
                            
                            // Show info message for WAN with current recommendation
                            infoMessage.innerHTML = `💡 WAN Mode: Current ${currentResolution} → <strong>Use ${recommendedModel} model</strong> • 320p-820p flexible range • 16px increments`;
                            infoMessage.style.display = 'block';
                        } else {
                            // Re-enable scale buttons and snap button for other categories or when custom calc is off
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Hide info message
                            infoMessage.style.display = 'none';
                        }
                    } else {
                        // Hide preset dropdown and custom calc checkbox
                        presetDropdown.style.display = 'none';
                        customCalcCheckbox.style.display = 'none';
                        customCalcLabel.style.display = 'none';
                        
                        // Re-enable all buttons when no category is selected
                        upscaleButton.disabled = false;
                        resolutionButton.disabled = false;
                        megapixelsButton.disabled = false;
                        snapButton.disabled = false;
                        
                        // Hide info message
                        infoMessage.style.display = 'none';
                    }
                });

                // Custom calculation checkbox handler
                customCalcCheckbox.addEventListener('change', (e) => {
                    const selectedCategory = categoryDropdown.value;
                    if (selectedCategory) {
                        categoryCustomCalc[selectedCategory] = e.target.checked;
                        
                        // Log the state for debugging
                        console.log(`Custom calculation for ${selectedCategory}: ${e.target.checked}`);
                        
                        // Handle category-specific custom calculation modes
                        if (selectedCategory === 'SDXL' && e.target.checked) {
                            // Disable scale buttons and snap button for SDXL
                            upscaleButton.disabled = true;
                            resolutionButton.disabled = true;
                            megapixelsButton.disabled = true;
                            snapButton.disabled = true;
                            
                            // Show info message for SDXL
                            infoMessage.innerHTML = '💡 SDXL Mode: Only officially supported resolutions shown • Fixed dimensions';
                            infoMessage.style.display = 'block';
                        } else if (selectedCategory === 'Flux' && e.target.checked) {
                            // Keep buttons enabled for Flux but show info
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Show info message for Flux
                            infoMessage.innerHTML = '💡 Flux Mode: 32px increments • 320-2560px limits • Max 4.0 MP • Sweet spot: 1920×1080';
                            infoMessage.style.display = 'block';
                        } else if (selectedCategory === 'WAN' && e.target.checked) {
                            // Keep buttons enabled for WAN but show info
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Calculate which model is recommended for current resolution
                            const pixels480p = 832 * 480; // 399,360
                            const pixels720p = 1280 * 720; // 921,600
                            const currentPixels = widthWidget.value * heightWidget.value;
                            
                            // Calculate which resolution is closer
                            const dist480p = Math.abs(currentPixels - pixels480p);
                            const dist720p = Math.abs(currentPixels - pixels720p);
                            
                            const recommendedModel = dist480p < dist720p ? "480p" : "720p";
                            const currentResolution = `${widthWidget.value}×${heightWidget.value}`;
                            
                            // Show info message for WAN with current recommendation
                            infoMessage.innerHTML = `💡 WAN Mode: Current ${currentResolution} → <strong>Use ${recommendedModel} model</strong> • 320p-820p flexible range • 16px increments`;
                            infoMessage.style.display = 'block';
                        } else {
                            // Re-enable scale buttons and snap button
                            upscaleButton.disabled = false;
                            resolutionButton.disabled = false;
                            megapixelsButton.disabled = false;
                            snapButton.disabled = false;
                            
                            // Hide info message
                            infoMessage.style.display = 'none';
                        }
                        
                        // Don't reapply preset when toggling checkbox - just control button states
                        // Custom calculation will only be applied when using Scale/Res/MP buttons in the future
                    }
                });

                // Make label clickable
                customCalcLabel.addEventListener('click', () => {
                    customCalcCheckbox.checked = !customCalcCheckbox.checked;
                    customCalcCheckbox.dispatchEvent(new Event('change'));
                });

                // Function to apply preset with optional custom calculation
                const applyPreset = (category, presetName, useCustomCalc) => {
                    if (!category || !presetName) return;
                    
                    const preset = presetCategories[category][presetName];
                    let finalWidth = preset.width;
                    let finalHeight = preset.height;
                    
                    if (useCustomCalc) {
                        // Custom calculation logic based on category
                        switch(category) {
                            case 'SDXL':
                                break;                                
                            case 'Flux':
                                break;                                
                            case 'Social Media':
                                break;
                                
                            case 'Print':
                                break;
                                
                            case 'Cinema':
                                break;
                                
                            default:
                                break;
                        }
                        
                        // Ensure values are within bounds
                        finalWidth = Math.max(node.properties.minX, Math.min(node.properties.maxX, finalWidth));
                        finalHeight = Math.max(node.properties.minY, Math.min(node.properties.maxY, finalHeight));
                    }
                    
                    // Apply calculated values
                    widthWidget.value = finalWidth;
                    heightWidget.value = finalHeight;

                    // Update node properties
                    node.properties.valueX = finalWidth;
                    node.properties.valueY = finalHeight;

                    // Update intpos based on new values
                    node.intpos.x = (widthWidget.value - node.properties.minX) /
                        (node.properties.maxX - node.properties.minX);
                    node.intpos.y = (heightWidget.value - node.properties.minY) /
                        (node.properties.maxY - node.properties.minY);

                    node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
                    node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));

                    // Force widget UI update
                    if (widthWidget.inputEl) {
                        widthWidget.inputEl.value = widthWidget.value;
                    }
                    if (heightWidget.inputEl) {
                        heightWidget.inputEl.value = heightWidget.value;
                    }

                    // Update all scale labels
                    updateResolutionScaleLabel();
                    updateMegapixelsScaleLabel();
                    updateUpscalePreview();

                    // Re-render canvas
                    renderCanvas();
                    app.graph.setDirtyCanvas(true);
                };

                // Preset change handler
                presetDropdown.addEventListener('change', (e) => {
                    const selectedCategory = categoryDropdown.value;
                    const selectedPreset = e.target.value;
                    const useCustomCalc = customCalcCheckbox.checked;

                    if (selectedCategory && selectedPreset) {
                        applyPreset(selectedCategory, selectedPreset, useCustomCalc);
                    }
                });

                // Add dropdowns and checkbox to container
                presetContainer.appendChild(categoryDropdown);
                presetContainer.appendChild(presetDropdown);
                presetContainer.appendChild(customCalcCheckbox);
                presetContainer.appendChild(customCalcLabel);

                scalingContainer.appendChild(presetContainer);
                
                // Add info message after preset container
                scalingContainer.appendChild(infoMessage);

                // Store button references
                this.swapButton = swapButton;
                this.snapSlider = snapSlider;
                this.snapLabel = snapLabel;
                this.upscaleSlider = upscaleSlider;
                this.upscaleLabel = upscaleLabel;
                this.resolutionDropdown = resolutionDropdown;
                this.resolutionScaleLabel = resolutionScaleLabel;
                this.megapixelsSlider = megapixelsSlider;
                this.megapixelsScaleLabel = megapixelsScaleLabel;
                this.megapixelsCheckbox = megapixelsCheckbox;
                this.upscaleCheckbox = upscaleCheckbox;
                this.resolutionCheckbox = resolutionCheckbox;
                this.presetContainer = presetContainer;
                this.categoryDropdown = categoryDropdown;
                this.presetDropdown = presetDropdown;
                this.customCalcCheckbox = customCalcCheckbox;
                this.customCalcLabel = customCalcLabel;

                // Store canvas reference
                this.sliderCanvas = canvas;
                this.sliderCtx = ctx;

                // Function to update canvas size based on mode
                const updateCanvasSize = () => {
                    const nodeWidth = (node.size && node.size[0]) || baseWidth;

                    let scale = 1;
                    if (nodeWidth < baseWidth) {
                        scale = nodeWidth / baseWidth;
                        container.style.alignItems = 'flex-start'; // Align left for correct scaling
                    } else {
                        container.style.alignItems = 'center'; // Center when there is enough space
                    }
                    scalingContainer.style.transform = `scale(${scale})`;

                    // Show/hide controls based on mode
                    const isManual = node.properties.mode === 'Manual';
                    primaryControls.style.display = isManual ? 'flex' : 'none';
                    scalingGrid.style.display = isManual ? 'grid' : 'none';
                    if (node.presetContainer) {
                        node.presetContainer.style.display = isManual ? 'flex' : 'none';
                    }

                    let canvasWidth = baseWidth;
                    let canvasHeight = 0;
                    let unscaledHeight = 0;

                    if (node.properties.mode === 'Manual Sliders') {
                        canvasHeight = 80;
                        unscaledHeight = canvasHeight;
                    } else if (node.properties.mode === 'Manual') {
                        const rangeX = node.properties.maxX - node.properties.minX;
                        const rangeY = node.properties.maxY - node.properties.minY;
                        const aspectRatio = rangeX / rangeY;

                        const internalBaseSize = baseWidth - 70 - 20;

                        let tempCanvasWidth, tempCanvasHeight;
                        if (aspectRatio > 1) {
                            tempCanvasWidth = internalBaseSize;
                            tempCanvasHeight = tempCanvasWidth / aspectRatio;
                        } else {
                            tempCanvasHeight = internalBaseSize;
                            tempCanvasWidth = tempCanvasHeight * aspectRatio;
                        }

                        canvasWidth = tempCanvasWidth + 70;
                        canvasHeight = tempCanvasHeight + 20;

                        unscaledHeight = canvasHeight + 190;
                    }

                    // Set internal canvas resolution
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    // Set display size (unscaled, as it's inside the scaling container)
                    canvas.style.width = canvasWidth + 'px';
                    canvas.style.height = canvasHeight + 'px';
                    canvas.style.maxWidth = '100%';
                    canvas.style.margin = '0 auto';
                    canvas.style.display = 'block';

                    const finalScaledHeight = unscaledHeight * scale;
                    container.style.height = finalScaledHeight + 'px';

                    if (node.canvasWidget) {
                        node.canvasWidget.computeSize = () => [nodeWidth, finalScaledHeight];
                    }
                    app.graph.setDirtyCanvas(true, true);

                    renderCanvas();
                };

                // Render function for the canvas
                const renderCanvas = () => {
                    if (!ctx) return;

                    const props = node.properties;
                    const width = canvas.width;
                    const height = canvas.height;

                    // Clear canvas
                    ctx.clearRect(0, 0, width, height);

                    if (props.mode === 'Manual') {
                        // Draw 2D Slider
                        const panelWidth = width - shiftRight - shiftLeft;
                        const panelHeight = height - 20;

                        // Background panel
                        ctx.fillStyle = "rgba(20,20,20,0.8)";
                        ctx.beginPath();
                        ctx.roundRect(shiftLeft - 4, shiftLeft - 4, panelWidth + 8, panelHeight + 8, 4);
                        ctx.fill();

                        // Dots
                        if (props.dots) {
                            ctx.fillStyle = "rgba(200,200,200,0.7)";
                            ctx.beginPath();
                            let stX = (panelWidth * props.stepX / (props.maxX - props.minX));
                            let stY = (panelHeight * props.stepY / (props.maxY - props.minY));
                            for (let ix = 0; ix < panelWidth + stX / 2; ix += stX) {
                                for (let iy = 0; iy < panelHeight + stY / 2; iy += stY) {
                                    ctx.rect(shiftLeft + ix - 0.5, shiftLeft + iy - 0.5, 1, 1);
                                }
                            }
                            ctx.fill();
                        }

                        // Frame
                        if (props.frame) {
                            ctx.fillStyle = "rgba(200,200,200,0.1)";
                            ctx.strokeStyle = "rgba(200,200,200,0.7)";
                            ctx.beginPath();
                            ctx.rect(shiftLeft, shiftLeft + panelHeight * (1 - node.intpos.y),
                                panelWidth * node.intpos.x, panelHeight * node.intpos.y);
                            ctx.fill();
                            ctx.stroke();
                        }

                        // Knob
                        ctx.fillStyle = "#aeaeae"; // LiteGraph.NODE_TEXT_COLOR equivalent
                        ctx.beginPath();
                        ctx.arc(shiftLeft + panelWidth * node.intpos.x,
                            shiftLeft + panelHeight * (1 - node.intpos.y), 7, 0, 2 * Math.PI);
                        ctx.fill();

                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = node.bgcolor || "#2e3440"; // LiteGraph.NODE_DEFAULT_BGCOLOR equivalent
                        ctx.beginPath();
                        ctx.arc(shiftLeft + panelWidth * node.intpos.x,
                            shiftLeft + panelHeight * (1 - node.intpos.y), 5, 0, 2 * Math.PI);
                        ctx.stroke();

                        // Values on the right
                        ctx.fillStyle = "#aeaeae";
                        ctx.font = fontsize + "px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText(widthWidget.value.toFixed(props.decimalsX),
                            width - shiftRight + 24, fontsize * 1.5);
                        ctx.fillText(heightWidget.value.toFixed(props.decimalsY),
                            width - shiftRight + 24, fontsize * 1.5 + LiteGraph.NODE_SLOT_HEIGHT);

                    } else if (props.mode === 'Manual Sliders') {
                        // Draw two separate sliders
                        const drawSlider = (sliderY, value, min, max, label) => {
                            const panelWidth = width - shiftRight - shiftLeft;
                            const intpos = (value - min) / (max - min);

                            // Track background
                            ctx.fillStyle = "rgba(20,20,20,0.5)";
                            ctx.beginPath();
                            ctx.roundRect(shiftLeft, sliderY - 1, panelWidth, 4, 2);
                            ctx.fill();

                            // Knob
                            ctx.fillStyle = "#aeaeae";
                            ctx.beginPath();
                            ctx.arc(shiftLeft + panelWidth * intpos, sliderY + 1, 7, 0, 2 * Math.PI);
                            ctx.fill();

                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = node.bgcolor || "#2e3440";
                            ctx.beginPath();
                            ctx.arc(shiftLeft + panelWidth * intpos, sliderY + 1, 5, 0, 2 * Math.PI);
                            ctx.stroke();

                            // Value
                            ctx.fillStyle = "#aeaeae";
                            ctx.font = fontsize + "px Arial";
                            ctx.textAlign = "center";
                            ctx.fillText(value, width - shiftRight + 24, sliderY + 5);
                        };

                        const sliderSpacing = 40;
                        drawSlider(20, widthWidget.value, props.w_min, props.w_max, "Width");
                        drawSlider(20 + sliderSpacing, heightWidget.value, props.h_min, props.h_max, "Height");
                    }
                };

                // Mouse event handlers for the canvas element
                const getInternalCoordinates = (e) => {
                    // Prefer offsetX/offsetY for precise coordinates relative to the canvas box
                    const cw = canvas.clientWidth || canvas.offsetWidth || 1;
                    const ch = canvas.clientHeight || canvas.offsetHeight || 1;
                    const scaleX = canvas.width / cw;
                    const scaleY = canvas.height / ch;

                    // Some browsers always provide offsetX/offsetY on canvas events
                    let x = (typeof e.offsetX === "number") ? e.offsetX : 0;
                    let y = (typeof e.offsetY === "number") ? e.offsetY : 0;

                    // Fallback if offsetX/offsetY are not available (rare)
                    if (x === 0 && y === 0 && e.clientX !== undefined) {
                        const rect = canvas.getBoundingClientRect();
                        x = (e.clientX - rect.left) * (cw / rect.width);
                        y = (e.clientY - rect.top) * (ch / rect.height);
                    }

                    return { x: x * scaleX, y: y * scaleY };
                };

                const handleMouseDown = (e) => {
                    const coords = getInternalCoordinates(e);
                    if (!coords) return;

                    const { x, y } = coords;

                    let shouldCapture = false;
                    if (node.properties.mode === 'Manual') {
                        if (x >= shiftLeft - 5 && x <= canvas.width - shiftRight + 5 &&
                            y >= shiftLeft - 5 && y <= canvas.height - shiftLeft + 5) {
                            node.capture = true;
                            shouldCapture = true;
                        }
                    } else if (node.properties.mode === 'Manual Sliders') {
                        const sliderY1 = 20;
                        const sliderY2 = 60;
                        if (Math.abs(y - sliderY1) < 10) {
                            node.capture = 'width';
                            shouldCapture = true;
                        } else if (Math.abs(y - sliderY2) < 10) {
                            node.capture = 'height';
                            shouldCapture = true;
                        }
                    }

                    if (shouldCapture) {
                        updateValue(x, y, e.shiftKey);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };

                const handleMouseMove = (e) => {
                    if (!node.capture) return;
                    const coords = getInternalCoordinates(e);
                    if (!coords) return;
                    const { x, y } = coords;
                    updateValue(x, y, e.shiftKey);
                    e.preventDefault();
                    e.stopPropagation();
                };

                const handleMouseUp = (e) => {
                    if (!node.capture) return;
                    node.capture = false;
                    e.preventDefault();
                    e.stopPropagation();
                };

                const handleMouseLeave = (e) => {
                    if (!node.capture) return;
                    // Keep capture on leave for better usability
                };

                const updateValue = (internalX, internalY, shiftKey) => {
                    if (node.properties.mode === 'Manual' && node.capture === true) {
                        const panelWidth = canvas.width - shiftRight - shiftLeft;
                        const panelHeight = canvas.height - 20;

                        let vX = (internalX - shiftLeft) / panelWidth;
                        let vY = 1 - (internalY - shiftLeft) / panelHeight;

                        if (shiftKey !== node.properties.snap) {
                            let sX = node.properties.stepX / (node.properties.maxX - node.properties.minX);
                            let sY = node.properties.stepY / (node.properties.maxY - node.properties.minY);
                            vX = Math.round(vX / sX) * sX;
                            vY = Math.round(vY / sY) * sY;
                        }

                        vX = Math.max(0, Math.min(1, vX));
                        vY = Math.max(0, Math.min(1, vY));

                        node.intpos.x = vX;
                        node.intpos.y = vY;

                        let newX = node.properties.minX + (node.properties.maxX - node.properties.minX) * vX;
                        let newY = node.properties.minY + (node.properties.maxY - node.properties.minY) * vY;

                        const rnX = Math.pow(10, node.properties.decimalsX);
                        const rnY = Math.pow(10, node.properties.decimalsY);
                        newX = Math.round(rnX * newX) / rnX;
                        newY = Math.round(rnY * newY) / rnY;

                        widthWidget.value = newX;
                        heightWidget.value = newY;

                        // Update all scale labels when dragging in canvas
                        if (updateResolutionScaleLabel) {
                            updateResolutionScaleLabel();
                        }
                        if (updateMegapixelsScaleLabel) {
                            updateMegapixelsScaleLabel();
                        }
                        if (updateUpscalePreview) {
                            updateUpscalePreview();
                        }

                    } else if (node.properties.mode === 'Manual Sliders') {
                        const panelWidth = canvas.width - shiftRight - shiftLeft;
                        let vX = (internalX - shiftLeft) / panelWidth;
                        vX = Math.max(0, Math.min(1, vX));

                        if (node.capture === 'width') {
                            if (shiftKey !== node.properties.snap) {
                                let step = node.properties.w_step / (node.properties.w_max - node.properties.w_min);
                                vX = Math.round(vX / step) * step;
                            }
                            widthWidget.value = Math.round(node.properties.w_min +
                                (node.properties.w_max - node.properties.w_min) * vX);
                        } else if (node.capture === 'height') {
                            if (shiftKey !== node.properties.snap) {
                                let step = node.properties.h_step / (node.properties.h_max - node.properties.h_min);
                                vX = Math.round(vX / step) * step;
                            }
                            heightWidget.value = Math.round(node.properties.h_min +
                                (node.properties.h_max - node.properties.h_min) * vX);
                        }

                        // Update all scale labels when using sliders mode
                        if (updateResolutionScaleLabel) {
                            updateResolutionScaleLabel();
                        }
                        if (updateMegapixelsScaleLabel) {
                            updateMegapixelsScaleLabel();
                        }
                        if (updateUpscalePreview) {
                            updateUpscalePreview();
                        }
                    }

                    renderCanvas();
                    app.graph.setDirtyCanvas(true);
                };

                // Attach event listeners to canvas
                canvas.addEventListener('mousedown', handleMouseDown);
                canvas.addEventListener('mousemove', handleMouseMove);
                canvas.addEventListener('mouseup', handleMouseUp);
                canvas.addEventListener('mouseleave', handleMouseLeave);

                // Also handle mouseup on document to catch releases outside canvas
                document.addEventListener('mouseup', handleMouseUp);

                // Create the widget with the container element
                const canvasWidget = this.addDOMWidget(
                    'aspect_ratio_canvas',
                    'custom',
                    container,
                    {
                        getValue() {
                            return {
                                width: widthWidget.value,
                                height: heightWidget.value
                            };
                        },
                        setValue(v) {
                            if (v.width !== undefined) widthWidget.value = v.width;
                            if (v.height !== undefined) heightWidget.value = v.height;
                            renderCanvas();
                        },
                        serialize: false
                    }
                );

                // Store widget reference
                this.canvasWidget = canvasWidget;

                // Mode widget callback
                const modeWidget = this.widgets.find(w => w.name === 'mode');
                if (modeWidget) {
                    const origCallback = modeWidget.callback;
                    modeWidget.callback = (value) => {
                        node.properties.mode = value;
                        if (origCallback) origCallback(value);
                        updateCanvasSize();
                        app.graph.setDirtyCanvas(true, true);
                    };
                }

                // Update canvas on property changes
                this.onPropertyChanged = function (propName) {
                    if (!this.configured) return;

                    // Update intpos based on current values
                    this.intpos.x = (widthWidget.value - this.properties.minX) /
                        (this.properties.maxX - this.properties.minX);
                    this.intpos.y = (heightWidget.value - this.properties.minY) /
                        (this.properties.maxY - this.properties.minY);

                    this.intpos.x = Math.max(0, Math.min(1, this.intpos.x));
                    this.intpos.y = Math.max(0, Math.min(1, this.intpos.y));

                    // If min/max values changed, update canvas size to reflect new aspect ratio
                    if (propName === 'minX' || propName === 'maxX' || propName === 'minY' || propName === 'maxY') {
                        updateCanvasSize();
                    } else {
                        renderCanvas();
                    }
                };

                this.onGraphConfigured = function () {
                    this.configured = true;
                    this.onPropertyChanged();
                };

                // Watch for widget value changes
                const origWidthCallback = widthWidget.callback;
                widthWidget.callback = function (value) {
                    // Update node properties
                    node.properties.valueX = value;

                    // Update intpos based on new value
                    node.intpos.x = (value - node.properties.minX) /
                        (node.properties.maxX - node.properties.minX);
                    node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));

                    // Re-render canvas immediately
                    renderCanvas();
                    app.graph.setDirtyCanvas(true);

                    // Update all scale labels
                    if (updateResolutionScaleLabel) {
                        updateResolutionScaleLabel();
                    }
                    if (updateMegapixelsScaleLabel) {
                        updateMegapixelsScaleLabel();
                    }
                    if (updateUpscalePreview) {
                        updateUpscalePreview();
                    }

                    // Call original callback if exists with proper context
                    if (origWidthCallback) {
                        return origWidthCallback.call(this, value);
                    }
                };

                const origHeightCallback = heightWidget.callback;
                heightWidget.callback = function (value) {
                    // Update node properties
                    node.properties.valueY = value;

                    // Update intpos based on new value
                    node.intpos.y = (value - node.properties.minY) /
                        (node.properties.maxY - node.properties.minY);
                    node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));

                    // Re-render canvas immediately
                    renderCanvas();
                    app.graph.setDirtyCanvas(true);

                    // Update all scale labels
                    if (updateResolutionScaleLabel) {
                        updateResolutionScaleLabel();
                    }
                    if (updateMegapixelsScaleLabel) {
                        updateMegapixelsScaleLabel();
                    }
                    if (updateUpscalePreview) {
                        updateUpscalePreview();
                    }

                    // Call original callback if exists with proper context
                    if (origHeightCallback) {
                        return origHeightCallback.call(this, value);
                    }
                };

                // Handle resize
                this.onResize = function () {
                    setTimeout(() => {
                        updateCanvasSize();
                    }, 10);
                };

                // Cleanup on node removal
                const origOnRemoved = this.onRemoved;
                this.onRemoved = function () {
                    document.removeEventListener('mouseup', handleMouseUp);
                    
                    // Clean up dimension check interval
                    if (dimensionCheckInterval) {
                        clearInterval(dimensionCheckInterval);
                        dimensionCheckInterval = null;
                    }
                    
                    if (origOnRemoved) origOnRemoved.apply(this, arguments);
                };

                // Initial setup
                setTimeout(() => {
                    updateCanvasSize();
                }, 100);
            };
        }
    },
});
