// ComfyUI.azToolkit.ResolutionMaster v.10.1.0 - Canvas version with single view (no tabs)
// All controls visible at once like in original DOM version
import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./utils/LoggerUtils.js";

// Initialize logger for this module
const log = createModuleLogger('ResolutionMaster');

class ResolutionMasterCanvas {
    constructor(node) {
        this.node = node;
        
        // Initialize properties
        this.node.properties = this.node.properties || {};
        this.node.properties.mode = this.node.properties.mode ?? "Manual";
        this.node.properties.valueX = this.node.properties.valueX ?? 512;
        this.node.properties.valueY = this.node.properties.valueY ?? 512;
        this.node.properties.minX = this.node.properties.minX ?? 0;
        this.node.properties.maxX = this.node.properties.maxX ?? 2048;
        this.node.properties.stepX = this.node.properties.stepX ?? 64;
        this.node.properties.minY = this.node.properties.minY ?? 0;
        this.node.properties.maxY = this.node.properties.maxY ?? 2048;
        this.node.properties.stepY = this.node.properties.stepY ?? 64;
        this.node.properties.decimalsX = this.node.properties.decimalsX ?? 0;
        this.node.properties.decimalsY = this.node.properties.decimalsY ?? 0;
        this.node.properties.snap = this.node.properties.snap ?? true;
        this.node.properties.dots = this.node.properties.dots ?? true;
        this.node.properties.frame = this.node.properties.frame ?? true;
        
        // Manual Sliders mode properties
        this.node.properties.w_min = this.node.properties.w_min ?? 64;
        this.node.properties.w_max = this.node.properties.w_max ?? 4096;
        this.node.properties.w_step = this.node.properties.w_step ?? 64;
        this.node.properties.h_min = this.node.properties.h_min ?? 64;
        this.node.properties.h_max = this.node.properties.h_max ?? 4096;
        this.node.properties.h_step = this.node.properties.h_step ?? 64;
        
        // Custom sliders properties
        this.node.properties.snap_min = this.node.properties.snap_min ?? 16;
        this.node.properties.snap_max = this.node.properties.snap_max ?? 256;
        this.node.properties.snap_step = this.node.properties.snap_step ?? 16;
        this.node.properties.s_min = this.node.properties.s_min ?? 0.1;
        this.node.properties.s_max = this.node.properties.s_max ?? 4.0;
        this.node.properties.s_step = this.node.properties.s_step ?? 0.1;
        this.node.properties.mp_min = this.node.properties.mp_min ?? 0.5;
        this.node.properties.mp_max = this.node.properties.mp_max ?? 6.0;
        this.node.properties.mp_step = this.node.properties.mp_step ?? 0.1;

        // Additional properties for full functionality
        this.node.properties.snapValue = this.node.properties.snapValue ?? 64;
        this.node.properties.upscaleValue = this.node.properties.upscaleValue ?? 1.0;
        this.node.properties.targetResolution = this.node.properties.targetResolution ?? 1080;
        this.node.properties.targetMegapixels = this.node.properties.targetMegapixels ?? 2.0;
        this.node.properties.rescaleMode = this.node.properties.rescaleMode ?? "resolution";
        this.node.properties.rescaleValue = this.node.properties.rescaleValue ?? 1.0;
        this.node.properties.autoDetect = this.node.properties.autoDetect ?? false;
        this.node.properties.autoFitOnChange = this.node.properties.autoFitOnChange ?? false;
        this.node.properties.selectedCategory = this.node.properties.selectedCategory ?? null;
        this.node.properties.selectedPreset = this.node.properties.selectedPreset ?? null;
        this.node.properties.useCustomCalc = this.node.properties.useCustomCalc ?? false;
        
        // Internal state
        this.node.intpos = { x: 0.5, y: 0.5 };
        this.node.capture = false;
        this.node.configured = false;
        
        // UI state
        this.hoverElement = null;
        this.scrollOffset = 0;
        this.dropdownOpen = null;
        
        // Auto-detect state
        this.detectedDimensions = null;
        this.dimensionCheckInterval = null;
        this.manuallySetByAutoFit = false;
        
        // Control positions (will be calculated dynamically)
        this.controls = {};
        this.resolutions = ['144p', '240p', '360p', '480p', '720p', '820p', '1080p', '1440p', '2160p', '4320p'];

        this.icons = {};
        this.loadIcons();
        
        // Full preset categories
        this.presetCategories = {
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
        
        this.setupNode();
    }
    
    loadIcons() {
        const iconColor = "#dddddd";
        const svgs = {
            upscale: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
            resolution: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
            megapixels: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
        };

        for (const name in svgs) {
            const img = new Image();
            img.onload = () => app.graph.setDirtyCanvas(true);
            img.src = `data:image/svg+xml;base64,${btoa(svgs[name])}`;
            this.icons[name] = img;
        }
    }
    
    setupNode() {
        const node = this.node;
        const self = this;
        
        // Set minimum size to accommodate all controls
        node.size = [330, 620]; // Taller to fit all controls
        node.min_size = [330, 620];
        
        // Clear output names for cleaner display
        if (node.outputs) {
            node.outputs.forEach(output => {
                output.name = output.localized_name = "";
            });
        }
        
        // Get widgets
        const widthWidget = node.widgets?.find(w => w.name === 'width');
        const heightWidget = node.widgets?.find(w => w.name === 'height');
        const modeWidget = node.widgets?.find(w => w.name === 'mode');
        const autoDetectWidget = node.widgets?.find(w => w.name === 'auto_detect');
        const rescaleModeWidget = node.widgets?.find(w => w.name === 'rescale_mode');
        const rescaleValueWidget = node.widgets?.find(w => w.name === 'rescale_value');
        
        // Initialize rescale widgets with proper values
        if (rescaleModeWidget) {
            rescaleModeWidget.value = node.properties.rescaleMode;
        }
        if (rescaleValueWidget) {
            rescaleValueWidget.value = node.properties.rescaleValue;
        }
        
        // Hide all backend widgets
        [widthWidget, heightWidget, modeWidget, autoDetectWidget, rescaleModeWidget, rescaleValueWidget].forEach(widget => {
            if (widget) {
                widget.hidden = true;
                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
            }
        });
        
        // Initialize values from widgets
        if (widthWidget && heightWidget) {
            node.properties.valueX = widthWidget.value;
            node.properties.valueY = heightWidget.value;
            
            // Initialize intpos based on current values
            node.intpos.x = (widthWidget.value - node.properties.minX) / (node.properties.maxX - node.properties.minX);
            node.intpos.y = (heightWidget.value - node.properties.minY) / (node.properties.maxY - node.properties.minY);
        }
        
        
        // Store widget references
        this.widthWidget = widthWidget;
        this.heightWidget = heightWidget;
        this.rescaleModeWidget = rescaleModeWidget;
        this.rescaleValueWidget = rescaleValueWidget;
        
        // Override onDrawForeground
        node.onDrawForeground = function(ctx) {
            if (this.flags.collapsed) return;
            if (this.size[0] < 330) {
                this.size[0] = 330;
            }
            if (this.size[1] < 620) {
                this.size[1] = 620;
            }
            self.drawInterface(ctx);
        };
        
        // Override mouse handlers
        node.onMouseDown = function(e, pos, canvas) {
            if (e.canvasY - this.pos[1] < 0) return false;
            return self.handleMouseDown(e, pos, canvas);
        };
        
        node.onMouseMove = function(e, pos, canvas) {
            if (!this.capture) {
                self.handleMouseHover(e, pos, canvas);
                return false;
            }
            return self.handleMouseMove(e, pos, canvas);
        };
        
        node.onMouseUp = function(e) {
            if (!this.capture) return false;
            return self.handleMouseUp(e);
        };
        
        node.onPropertyChanged = function(property) {
            self.handlePropertyChange(property);
        };
        
        // Handle resize
        node.onResize = function() {
            if (this.size[0] < 330) {
                this.size[0] = 330;
            }
            if (this.size[1] < 620) {
                this.size[1] = 620;
            }
            app.graph.setDirtyCanvas(true);
        };
        
        // Cleanup
        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            if (self.dimensionCheckInterval) {
                clearInterval(self.dimensionCheckInterval);
                self.dimensionCheckInterval = null;
            }
            if (origOnRemoved) origOnRemoved.apply(this, arguments);
        };
        
        // Initial configuration
        node.onGraphConfigured = function() {
            this.configured = true;
            this.onPropertyChanged();
            if (this.properties.autoDetect) {
                self.startAutoDetect();
            }
            // Calculate initial rescale value
            self.updateRescaleValue();
        };
    }
    
    drawInterface(ctx) {
        const node = this.node;
        const props = node.properties;
        const margin = 10;
        const spacing = 8;
        
        this.drawOutputValues(ctx);
        
        let currentY = LiteGraph.NODE_TITLE_HEIGHT + 2;
        
        if (props.mode === "Manual") {
            const section = (title, drawContent) => {
                const contentHeight = drawContent(ctx, currentY + 20, true);
                this.drawSection(ctx, title, margin, currentY, node.size[0] - margin * 2, contentHeight + 25);
                currentY += contentHeight + 25 + spacing;
            };

            const canvasHeight = 200;
            this.draw2DCanvas(ctx, margin, currentY, node.size[0] - margin * 2, canvasHeight);
            currentY += canvasHeight + spacing;
            
            this.drawInfoText(ctx, currentY);
            currentY += 15 + spacing;

            section("Actions", (ctx, y) => {
                this.drawPrimaryControls(ctx, y);
                return 30;
            });
            
            section("Scaling", (ctx, y) => this.drawScalingGrid(ctx, y));
            section("Auto-Detect", (ctx, y) => this.drawAutoDetectSection(ctx, y));
            section("Presets", (ctx, y) => this.drawPresetSection(ctx, y));

        } else if (props.mode === "Manual Sliders") {
            this.drawSliderMode(ctx, currentY);
        }
        
        const neededHeight = currentY + 20;
        if (node.size[1] < neededHeight) {
            node.size[1] = neededHeight;
        }
    }

    drawSection(ctx, title, x, y, w, h) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ccc";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(title, x + 10, y + 15);
    }
    
    drawOutputValues(ctx) {
        const node = this.node;
        const props = node.properties;
        
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        if (this.widthWidget && this.heightWidget) {
            // Shift values up slightly to better match visual center of slots
            const y_offset_1 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 0.5);
            const y_offset_2 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 1.5);
            const y_offset_3 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 2.5);

            ctx.fillStyle = "#89F";
            ctx.fillText(this.widthWidget.value.toString(), node.size[0] - 20, y_offset_1);
            
            ctx.fillStyle = "#F89";
            ctx.fillText(this.heightWidget.value.toString(), node.size[0] - 20, y_offset_2);
            
            ctx.fillStyle = "#9F8";
            ctx.fillText(props.rescaleValue.toFixed(2), node.size[0] - 20, y_offset_3);
        }
    }
    
    drawPrimaryControls(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const buttonWidth = 70;
        const gap = 5;
        let x = margin;

        this.controls.swapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, "⇄ Swap", this.hoverElement === 'swapBtn');
        x += buttonWidth + gap;

        this.controls.snapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, "⊞ Snap", this.hoverElement === 'snapBtn');
        x += buttonWidth + gap;

        const sliderX = x;
        const valueWidth = 35;
        const sliderWidth = node.size[0] - sliderX - valueWidth - margin;

        this.controls.snapSlider = { x: sliderX, y, w: sliderWidth, h: 28 };
        this.drawSlider(ctx, sliderX, y, sliderWidth, 28, props.snapValue, props.snap_min, props.snap_max, props.snap_step);

        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(props.snapValue.toString(), sliderX + sliderWidth + gap, y + 14);
    }
    
    draw2DCanvas(ctx, x, y, w, h) {
        const node = this.node;
        const props = node.properties;
        
        this.controls.canvas2d = { x, y, w, h };
        
        const rangeX = props.maxX - props.minX;
        const rangeY = props.maxY - props.minY;
        const aspectRatio = rangeX / rangeY;
        
        let canvasW = w - 20;
        let canvasH = h - 20;
        
        if (aspectRatio > canvasW / canvasH) {
            canvasH = canvasW / aspectRatio;
        } else {
            canvasW = canvasH * aspectRatio;
        }
        
        const offsetX = x + (w - canvasW) / 2;
        const offsetY = y + (h - canvasH) / 2;
        
        this.controls.canvas2d = { x: offsetX, y: offsetY, w: canvasW, h: canvasH };
        
        ctx.fillStyle = "rgba(20,20,20,0.8)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(offsetX - 4, offsetY - 4, canvasW + 8, canvasH + 8, 6);
        ctx.fill();
        ctx.stroke();
        
        if (props.dots) {
            ctx.fillStyle = "rgba(200,200,200,0.5)";
            ctx.beginPath();
            let stX = canvasW * props.stepX / rangeX;
            let stY = canvasH * props.stepY / rangeY;
            for (let ix = stX; ix < canvasW; ix += stX) {
                for (let iy = stY; iy < canvasH; iy += stY) {
                    ctx.rect(offsetX + ix - 0.5, offsetY + iy - 0.5, 1, 1);
                }
            }
            ctx.fill();
        }
        
        if (props.frame) {
            ctx.fillStyle = "rgba(150,150,250,0.1)";
            ctx.strokeStyle = "rgba(150,150,250,0.7)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(offsetX, offsetY + canvasH * (1 - node.intpos.y), 
                    canvasW * node.intpos.x, canvasH * node.intpos.y);
            ctx.fill();
            ctx.stroke();
        }
        
        const knobX = offsetX + canvasW * node.intpos.x;
        const knobY = offsetY + canvasH * (1 - node.intpos.y);
        
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    
    drawInfoText(ctx, y) {
        const node = this.node;
        if (this.widthWidget && this.heightWidget) {
            const width = this.widthWidget.value;
            const height = this.heightWidget.value;
            const mp = ((width * height) / 1000000).toFixed(2);
            const aspectRatio = (width / height).toFixed(2);
            const pResolution = this.getClosestPResolution(width, height);
            
            ctx.fillStyle = "#bbb";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${width} × ${height}  |  ${mp} MP ${pResolution}  |  ${aspectRatio}:1`,
                        node.size[0] / 2, y);
        }
    }
    
    drawScalingGrid(ctx, y) {
        const margin = 20;
        this.drawScaleRow(ctx, margin, y);
        this.drawResolutionRow(ctx, margin, y + 35);
        this.drawMegapixelsRow(ctx, margin, y + 70);
        return 105;
    }
    
    drawScaleRow(ctx, x, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 8;
        
        const btnWidth = 50;
        const valueWidth = 45;
        const previewWidth = 70;
        const radioWidth = 18;
        const sliderWidth = availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4);

        let currentX = x;

        this.controls.scaleBtn = { x: currentX, y, w: btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, btnWidth, 28, this.icons.upscale, this.hoverElement === 'scaleBtn');
        currentX += btnWidth + gap;
        
        this.controls.scaleSlider = { x: currentX, y, w: sliderWidth, h: 28 };
        this.drawSlider(ctx, currentX, y, sliderWidth, 28, props.upscaleValue, props.s_min, props.s_max, props.s_step);
        currentX += sliderWidth + gap;
        
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(props.upscaleValue.toFixed(1) + "x", currentX + valueWidth / 2, y + 14);
        currentX += valueWidth + gap;
        
        if (this.widthWidget && this.heightWidget) {
            const newW = Math.round(this.widthWidget.value * props.upscaleValue);
            const newH = Math.round(this.heightWidget.value * props.upscaleValue);
            ctx.fillStyle = "#888";
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += previewWidth + gap;
        
        this.controls.upscaleRadio = { x: currentX, y: y + 5, w: radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, radioWidth, props.rescaleMode === "manual", this.hoverElement === 'upscaleRadio');
    }
    
    drawResolutionRow(ctx, x, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 8;
        
        const btnWidth = 50;
        const valueWidth = 45;
        const previewWidth = 70;
        const radioWidth = 18;
        const dropdownWidth = availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4);
        
        let currentX = x;

        this.controls.resolutionBtn = { x: currentX, y, w: btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, btnWidth, 28, this.icons.resolution, this.hoverElement === 'resolutionBtn');
        currentX += btnWidth + gap;

        this.controls.resolutionDropdown = { x: currentX, y, w: dropdownWidth, h: 28 };
        const selectedText = this.resolutions.find(r => parseInt(r) === props.targetResolution) || '1080p';
        this.drawDropdown(ctx, currentX, y, dropdownWidth, 28, selectedText, this.hoverElement === 'resolutionDropdown');
        currentX += dropdownWidth + gap;
        
        const scaleFactor = this.calculateResolutionScale(props.targetResolution);
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`×${scaleFactor.toFixed(2)}`, currentX + valueWidth / 2, y + 14);
        currentX += valueWidth + gap;
        
        if (this.widthWidget && this.heightWidget) {
            const newW = Math.round(this.widthWidget.value * scaleFactor);
            const newH = Math.round(this.heightWidget.value * scaleFactor);
            ctx.fillStyle = "#888";
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += previewWidth + gap;
        
        this.controls.resolutionRadio = { x: currentX, y: y + 5, w: radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, radioWidth, props.rescaleMode === "resolution", this.hoverElement === 'resolutionRadio');
    }
    
    drawMegapixelsRow(ctx, x, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 8;
        
        const btnWidth = 50;
        const valueWidth = 45;
        const previewWidth = 70;
        const radioWidth = 18;
        const sliderWidth = availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4);

        let currentX = x;

        this.controls.megapixelsBtn = { x: currentX, y, w: btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, btnWidth, 28, this.icons.megapixels, this.hoverElement === 'megapixelsBtn');
        currentX += btnWidth + gap;
        
        this.controls.megapixelsSlider = { x: currentX, y, w: sliderWidth, h: 28 };
        this.drawSlider(ctx, currentX, y, sliderWidth, 28, props.targetMegapixels, props.mp_min, props.mp_max, props.mp_step);
        currentX += sliderWidth + gap;
        
        const scaleFactor = this.calculateMegapixelsScale(props.targetMegapixels);
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${props.targetMegapixels.toFixed(1)}MP`, currentX + valueWidth / 2, y + 14);
        currentX += valueWidth + gap;
        
        if (this.widthWidget && this.heightWidget) {
            const newW = Math.round(this.widthWidget.value * scaleFactor);
            const newH = Math.round(this.heightWidget.value * scaleFactor);
            ctx.fillStyle = "#888";
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += previewWidth + gap;
        
        this.controls.megapixelsRadio = { x: currentX, y: y + 5, w: radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, 18, props.rescaleMode === "megapixels", this.hoverElement === 'megapixelsRadio');
    }

    drawAutoDetectSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 8;
        
        const toggleWidth = 140;
        const checkboxWidth = 18;
        const checkboxLabelWidth = 30;
        const autoFitWidth = availableWidth - toggleWidth - checkboxWidth - checkboxLabelWidth - (gap * 2);

        let currentX = margin;

        this.controls.autoDetectToggle = { x: currentX, y, w: toggleWidth, h: 28 };
        this.drawToggle(ctx, currentX, y, toggleWidth, 28, props.autoDetect, 
                       props.autoDetect ? "Auto-detect ON" : "Auto-detect OFF",
                       this.hoverElement === 'autoDetectToggle');
        currentX += toggleWidth + gap;
        
        this.controls.autoFitBtn = { x: currentX, y, w: autoFitWidth, h: 28 };
        const btnEnabled = this.detectedDimensions && props.selectedCategory;
        this.drawButton(ctx, currentX, y, autoFitWidth, 28, "🎯 Auto-fit", this.hoverElement === 'autoFitBtn', !btnEnabled);
        currentX += autoFitWidth + gap;
        
        this.controls.autoFitCheckbox = { x: currentX, y: y + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, currentX, y + 5, checkboxWidth, props.autoFitOnChange, this.hoverElement === 'autoFitCheckbox', !btnEnabled);
        
        ctx.fillStyle = btnEnabled ? "#ddd" : "#777";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Auto", currentX + checkboxWidth + 4, y + 14);
        
        if (props.autoDetect && this.detectedDimensions) {
            ctx.fillStyle = "#5f5";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`Detected: ${this.detectedDimensions.width}×${this.detectedDimensions.height}`,
                        node.size[0] / 2, y + 45);
            return 60;
        }
        return 30;
    }
    
    drawPresetSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        let currentHeight = 30;
        const gap = 8;
        let currentX = margin;

        if (props.selectedCategory) {
            const checkboxWidth = 18;
            const checkboxLabelWidth = 30;
            const checkboxTotalWidth = checkboxWidth + checkboxLabelWidth + gap;

            const dropdownsWidth = availableWidth - checkboxTotalWidth;
            const categoryDDWidth = dropdownsWidth * 0.45;
            const presetDDWidth = dropdownsWidth * 0.55;

            this.controls.categoryDropdown = { x: currentX, y, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, y, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
            currentX += categoryDDWidth + gap;

            this.controls.presetDropdown = { x: currentX, y, w: presetDDWidth, h: 28 };
            const presetText = props.selectedPreset || "Select Preset...";
            this.drawDropdown(ctx, currentX, y, presetDDWidth, 28, presetText, this.hoverElement === 'presetDropdown');
            currentX += presetDDWidth + gap;
            
            this.controls.customCalcCheckbox = { x: currentX, y: y + 5, w: checkboxWidth, h: 18 };
            this.drawCheckbox(ctx, currentX, y + 5, checkboxWidth, props.useCustomCalc, this.hoverElement === 'customCalcCheckbox');
            
            ctx.fillStyle = "#ddd";
            ctx.font = "11px Arial";
            ctx.fillText("Calc", currentX + checkboxWidth + 4, y + 14);
        } else {
            // Category dropdown takes full width
            this.controls.categoryDropdown = { x: currentX, y, w: availableWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, y, availableWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
        }

        if (props.useCustomCalc && props.selectedCategory) {
            const messageY = y + 40;
            this.drawInfoMessage(ctx, messageY);
            currentHeight += 25;
        }

        return currentHeight;
    }
    
    drawInfoMessage(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const category = props.selectedCategory;
        
        let message = "";
        if (category === "SDXL" && props.useCustomCalc) {
            message = "💡 SDXL Mode: Using officially supported resolutions";
        } else if (category === "Flux" && props.useCustomCalc) {
            message = "💡 Flux Mode: 32px increments, 320-2560px, max 4.0 MP";
        } else if (category === "WAN" && props.useCustomCalc && this.widthWidget && this.heightWidget) {
            const pixels = this.widthWidget.value * this.heightWidget.value;
            const model = pixels < 600000 ? "480p" : "720p";
            message = `💡 WAN Mode: Suggesting ${model} model, 320p-820p range`;
        }
        
        if (message) {
            ctx.fillStyle = "rgba(250, 165, 90, 0.15)";
            ctx.strokeStyle = "rgba(250, 165, 90, 0.5)";
            ctx.beginPath();
            ctx.roundRect(20, y - 10, node.size[0] - 40, 20, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#fa5";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(message, node.size[0] / 2, y);
        }
    }
    
    drawSliderMode(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 10;
        const w = node.size[0] - margin * 2;
        
        if (!this.widthWidget || !this.heightWidget) return;
        
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Width:", margin, y);
        
        this.controls.widthSlider = { x: margin, y: y + 10, w, h: 25 };
        this.drawSlider(ctx, margin, y + 10, w, 25, this.widthWidget.value, props.w_min, props.w_max, props.w_step);
        
        ctx.textAlign = "right";
        ctx.fillText(this.widthWidget.value.toString(), node.size[0] - margin, y + 25);
        
        y += 45;
        ctx.textAlign = "left";
        ctx.fillText("Height:", margin, y);
        
        this.controls.heightSlider = { x: margin, y: y + 10, w, h: 25 };
        this.drawSlider(ctx, margin, y + 10, w, 25, this.heightWidget.value, props.h_min, props.h_max, props.h_step);
        
        ctx.textAlign = "right";
        ctx.fillText(this.heightWidget.value.toString(), node.size[0] - margin, y + 25);
    }
    
    // Drawing primitives
    drawButton(ctx, x, y, w, h, content, hover = false, disabled = false) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (disabled) {
            grad.addColorStop(0, "#4a4a4a");
            grad.addColorStop(1, "#404040");
        } else if (hover) {
            grad.addColorStop(0, "#6a6a6a");
            grad.addColorStop(1, "#606060");
        } else {
            grad.addColorStop(0, "#5a5a5a");
            grad.addColorStop(1, "#505050");
        }
        ctx.fillStyle = grad;
        ctx.strokeStyle = disabled ? "#333" : hover ? "#777" : "#222";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.fill();
        ctx.stroke();
        
        if (typeof content === 'string') {
            ctx.fillStyle = disabled ? "#888" : "#ddd";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(content, x + w / 2, y + h / 2 + 1);
        } else if (content instanceof Image) {
            const iconSize = Math.min(w, h) - 12;
            const iconX = x + (w - iconSize) / 2;
            const iconY = y + (h - iconSize) / 2;
            if (content.complete) {
                try {
                    if (disabled) ctx.globalAlpha = 0.5;
                    ctx.drawImage(content, iconX, iconY, iconSize, iconSize);
                    if (disabled) ctx.globalAlpha = 1.0;
                } catch (e) {
                    log.error("Error drawing SVG icon:", e);
                    ctx.fillStyle = "#f55";
                    ctx.font = "bold 14px Arial";
                    ctx.fillText("?", x + w / 2, y + h / 2 + 1);
                }
            }
        }
    }
    
    drawSlider(ctx, x, y, w, h, value, min, max, step) {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.roundRect(x, y + h / 2 - 3, w, 6, 3);
        ctx.fill();
        
        const pos = (value - min) / (max - min);
        const knobX = x + w * pos;
        const knobY = y + h / 2;

        const grad = ctx.createLinearGradient(knobX - 7, knobY - 7, knobX + 7, knobY + 7);
        grad.addColorStop(0, "#e0e0e0");
        grad.addColorStop(1, "#c0c0c0");
        ctx.fillStyle = grad;
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    
    drawDropdown(ctx, x, y, w, h, text, hover = false) {
        this.drawButton(ctx, x, y, w, h, "", hover);

        ctx.fillStyle = "#ddd";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 5, y, w - 25, h);
        ctx.clip();
        ctx.fillText(text, x + 8, y + h / 2 + 1);
        ctx.restore();
        
        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(x + w - 18, y + h / 2 - 3);
        ctx.lineTo(x + w - 10, y + h / 2 + 3);
        ctx.lineTo(x + w - 2, y + h / 2 - 3);
        ctx.fill();
    }
    
    drawRadioButton(ctx, x, y, size, checked, hover = false) {
        ctx.strokeStyle = hover ? "#ccc" : "#999";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, 2 * Math.PI);
        ctx.stroke();
        
        if (checked) {
            ctx.fillStyle = "#5af";
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2 - 6, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    drawCheckbox(ctx, x, y, size, checked, hover = false, disabled = false) {
        ctx.strokeStyle = disabled ? "#555" : hover ? "#ccc" : "#999";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 4);
        ctx.stroke();
        
        if (checked) {
            ctx.fillStyle = disabled ? "#666" : "#5af";
            ctx.beginPath();
            ctx.moveTo(x + 4, y + size / 2);
            ctx.lineTo(x + size / 2 - 1, y + size - 4);
            ctx.lineTo(x + size - 4, y + 4);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    drawToggle(ctx, x, y, w, h, isOn, text, hover = false) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        if (isOn) {
            grad.addColorStop(0, "#3a76d6");
            grad.addColorStop(1, "#5a96f6");
        } else {
            grad.addColorStop(0, "#555");
            grad.addColorStop(1, "#666");
        }
        ctx.fillStyle = grad;
        ctx.fill();
        
        ctx.strokeStyle = hover ? "#888" : "#222";
        ctx.stroke();
        
        const knobX = isOn ? x + w - h + 2 : x + 2;
        const knobGrad = ctx.createLinearGradient(knobX, y, knobX, y + h - 4);
        knobGrad.addColorStop(0, "#f0f0f0");
        knobGrad.addColorStop(1, "#d0d0d0");
        ctx.fillStyle = knobGrad;
        
        ctx.beginPath();
        ctx.arc(knobX + (h-4)/2, y + h/2, (h-6)/2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    }
    
    // Mouse handling methods
    handleMouseDown(e, pos, canvas) {
        const node = this.node;
        const props = node.properties;
        
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        if (props.mode === "Manual") {
            const c2d = this.controls.canvas2d;
            if (c2d && this.isPointInControl(relX, relY, c2d)) {
                node.capture = 'canvas2d';
                node.captureInput(true);
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey);
                return true;
            }
        }
        
        for (const key in this.controls) {
            if (this.isPointInControl(relX, relY, this.controls[key])) {
                if (key.endsWith('Btn')) {
                    this.handleButtonClick(key);
                    return true;
                }
                if (key.endsWith('Slider')) {
                    node.capture = key;
                    node.captureInput(true);
                    this.updateSliderValue(key, relX - this.controls[key].x, this.controls[key].w);
                    return true;
                }
                if (key.endsWith('Dropdown')) {
                    this.showDropdownMenu(key, e);
                    return true;
                }
                if (key.endsWith('Toggle')) {
                    this.handleToggleClick(key);
                    return true;
                }
                if (key.endsWith('Checkbox')) {
                    this.handleCheckboxClick(key);
                    return true;
                }
                if (key.endsWith('Radio')) {
                    this.handleRadioClick(key);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    handleMouseMove(e, pos, canvas) {
        const node = this.node;
        
        if (!node.capture) return false;
        
        // If the mouse button is released, but we are still capturing, handle it as a mouse up event
        if (e.buttons === 0) {
            this.handleMouseUp(e);
            return true;
        }
        
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        if (node.capture === 'canvas2d') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey);
            }
            return true;
        }
        
        if (node.capture.endsWith('Slider')) {
            const control = this.controls[node.capture];
            if (control) {
                this.updateSliderValue(node.capture, relX - control.x, control.w);
            }
            return true;
        }
        
        return false;
    }
    
    handleMouseHover(e, pos, canvas) {
        const node = this.node;
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        let newHover = null;
        
        for (const element in this.controls) {
            if (this.isPointInControl(relX, relY, this.controls[element])) {
                newHover = element;
                break;
            }
        }
        
        if (newHover !== this.hoverElement) {
            this.hoverElement = newHover;
            app.graph.setDirtyCanvas(true);
        }
    }
    
    handleMouseUp(e) {
        const node = this.node;
        
        if (!node.capture) return false;
        
        node.capture = false;
        node.captureInput(false);
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = node.properties.valueX;
            this.heightWidget.value = node.properties.valueY;
        }
        
        this.updateRescaleValue();
        
        return true;
    }
    
    handlePropertyChange(property) {
        const node = this.node;
        if (!node.configured) return;
        
        node.intpos.x = (node.properties.valueX - node.properties.minX) / 
                       (node.properties.maxX - node.properties.minX);
        node.intpos.y = (node.properties.valueY - node.properties.minY) / 
                       (node.properties.maxY - node.properties.minY);
        
        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));
        
        app.graph.setDirtyCanvas(true);
    }
    
    handleButtonClick(buttonName) {
        const actions = {
            swapBtn: () => this.handleSwap(),
            snapBtn: () => this.handleSnap(),
            scaleBtn: () => this.handleScale(),
            resolutionBtn: () => this.handleResolutionScale(),
            megapixelsBtn: () => this.handleMegapixelsScale(),
            autoFitBtn: () => this.handleAutoFit()
        };
        actions[buttonName]?.();
    }

    handleToggleClick(toggleName) {
        const props = this.node.properties;
        if (toggleName === 'autoDetectToggle') {
            props.autoDetect = !props.autoDetect;
            if (props.autoDetect) this.startAutoDetect();
            else this.stopAutoDetect();
            const widget = this.node.widgets?.find(w => w.name === 'auto_detect');
            if (widget) widget.value = props.autoDetect;
            app.graph.setDirtyCanvas(true);
        }
    }

    handleCheckboxClick(checkboxName) {
        const props = this.node.properties;
        if (checkboxName === 'autoFitCheckbox' && this.detectedDimensions && props.selectedCategory) {
            props.autoFitOnChange = !props.autoFitOnChange;
        } else if (checkboxName === 'customCalcCheckbox') {
            props.useCustomCalc = !props.useCustomCalc;
        }
        app.graph.setDirtyCanvas(true);
    }

    handleRadioClick(radioName) {
        const props = this.node.properties;
        const radioMap = {
            upscaleRadio: 'manual',
            resolutionRadio: 'resolution',
            megapixelsRadio: 'megapixels'
        };
        props.rescaleMode = radioMap[radioName];
        this.updateRescaleValue();
        app.graph.setDirtyCanvas(true);
    }
    
    // Value update methods
    updateCanvasValue(x, y, w, h, shiftKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        
        if (shiftKey !== props.snap) {
            let sX = props.stepX / (props.maxX - props.minX);
            let sY = props.stepY / (props.maxY - props.minY);
            vX = Math.round(vX / sX) * sX;
            vY = Math.round(vY / sY) * sY;
        }
        
        node.intpos.x = vX;
        node.intpos.y = vY;
        
        let newX = props.minX + (props.maxX - props.minX) * vX;
        let newY = props.minY + (props.maxY - props.minY) * vY;
        
        const rnX = Math.pow(10, props.decimalsX);
        const rnY = Math.pow(10, props.decimalsY);
        newX = Math.round(rnX * newX) / rnX;
        newY = Math.round(rnY * newY) / rnY;
        
        props.valueX = newX;
        props.valueY = newY;
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = newX;
            this.heightWidget.value = newY;
        }
        
        this.updateRescaleValue();
        app.graph.setDirtyCanvas(true);
    }
    
    updateSliderValue(sliderName, x, w) {
        const props = this.node.properties;
        let value = Math.max(0, Math.min(1, x / w));
        
        const sliderConfig = {
            snapSlider: { prop: 'snapValue', min: props.snap_min, max: props.snap_max, step: props.snap_step },
            scaleSlider: { prop: 'upscaleValue', min: props.s_min, max: props.s_max, step: props.s_step, updateOn: 'manual' },
            megapixelsSlider: { prop: 'targetMegapixels', min: props.mp_min, max: props.mp_max, step: props.mp_step, updateOn: 'megapixels' },
            widthSlider: { prop: 'valueX', min: props.w_min, max: props.w_max, step: props.w_step },
            heightSlider: { prop: 'valueY', min: props.h_min, max: props.h_max, step: props.h_step }
        };

        const config = sliderConfig[sliderName];
        if (config) {
            let newValue = config.min + value * (config.max - config.min);
            props[config.prop] = Math.round(newValue / config.step) * config.step;
            
            if (sliderName === 'scaleSlider' || sliderName === 'megapixelsSlider') {
                 props[config.prop] = parseFloat(props[config.prop].toFixed(1));
            }

            if (config.updateOn && props.rescaleMode === config.updateOn) {
                this.updateRescaleValue();
            }

            if(sliderName === 'widthSlider' && this.widthWidget) this.widthWidget.value = props.valueX;
            if(sliderName === 'heightSlider' && this.heightWidget) this.heightWidget.value = props.valueY;

            if(sliderName.includes('Slider')) this.handlePropertyChange();
        }
        
        app.graph.setDirtyCanvas(true);
    }
    
    showDropdownMenu(dropdownName, e) {
        const props = this.node.properties;
        let items, callback;
        
        if (dropdownName === 'categoryDropdown') {
            items = Object.keys(this.presetCategories);
            callback = (value) => {
                props.selectedCategory = value;
                props.selectedPreset = null;
                app.graph.setDirtyCanvas(true);
            };
        } else if (dropdownName === 'presetDropdown' && props.selectedCategory) {
            const presets = this.presetCategories[props.selectedCategory];
            items = Object.keys(presets).map(name => `${name} (${presets[name].width}×${presets[name].height})`);
            callback = (value) => this.applyPreset(props.selectedCategory, value.split(' (')[0]);
        } else if (dropdownName === 'resolutionDropdown') {
            items = this.resolutions;
            callback = (value) => {
                props.targetResolution = parseInt(value);
                if (props.rescaleMode === 'resolution') this.updateRescaleValue();
                app.graph.setDirtyCanvas(true);
            };
        }
        
        if (items?.length) {
            new LiteGraph.ContextMenu(items, { event: e.originalEvent || e, callback });
        }
    }
    
    // Action handlers
    handleSwap() {
        if (this.widthWidget && this.heightWidget) {
            [this.widthWidget.value, this.heightWidget.value] = [this.heightWidget.value, this.widthWidget.value];
            this.node.properties.valueX = this.widthWidget.value;
            this.node.properties.valueY = this.heightWidget.value;
            this.handlePropertyChange();
            this.updateRescaleValue();
        }
    }
    
    handleSnap() {
        if (this.widthWidget && this.heightWidget) {
            const snap = this.node.properties.snapValue;
            this.widthWidget.value = Math.round(this.widthWidget.value / snap) * snap;
            this.heightWidget.value = Math.round(this.heightWidget.value / snap) * snap;
            this.applyDimensionChange();
        }
    }
    
    handleScale() {
        if (this.widthWidget && this.heightWidget) {
            const scale = this.node.properties.upscaleValue;
            this.widthWidget.value = Math.round(this.widthWidget.value * scale);
            this.heightWidget.value = Math.round(this.heightWidget.value * scale);
            this.node.properties.upscaleValue = 1.0;
            this.applyDimensionChange();
        }
    }

    handleResolutionScale() {
        if (this.widthWidget && this.heightWidget) {
            const scale = this.calculateResolutionScale(this.node.properties.targetResolution);
            this.widthWidget.value = Math.round(this.widthWidget.value * scale);
            this.heightWidget.value = Math.round(this.heightWidget.value * scale);
            this.applyDimensionChange();
        }
    }

    handleMegapixelsScale() {
        if (this.widthWidget && this.heightWidget) {
            const scale = this.calculateMegapixelsScale(this.node.properties.targetMegapixels);
            this.widthWidget.value = Math.round(this.widthWidget.value * scale);
            this.heightWidget.value = Math.round(this.heightWidget.value * scale);
            this.applyDimensionChange();
        }
    }
    
    handleAutoFit() {
        if (!this.detectedDimensions) return;
        
        const props = this.node.properties;
        const category = props.selectedCategory;
        if (!category) return;
        
        const presets = this.presetCategories[category];
        let closestPreset = null;
        let closestDistance = Infinity;
        
        const detectedAspect = this.detectedDimensions.width / this.detectedDimensions.height;
        const detectedPixels = this.detectedDimensions.width * this.detectedDimensions.height;
        
        Object.entries(presets).forEach(([presetName, preset]) => {
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
            if (props.useCustomCalc) {
                if (category === 'WAN') {
                    // For WAN mode, scale to optimal "p" resolution based on detected dimensions
                    const wanResult = this.applyWANCalculation(this.detectedDimensions.width, this.detectedDimensions.height);
                    finalWidth = wanResult.width;
                    finalHeight = wanResult.height;
                    log.debug(`WAN scaling applied: ${this.detectedDimensions.width}x${this.detectedDimensions.height} → ${finalWidth}x${finalHeight}`);
                } else if (category === 'Flux') {
                    // For Flux mode, apply constraints while maintaining aspect ratio
                    const fluxResult = this.applyFluxCalculation(closestPreset.width, closestPreset.height);
                    finalWidth = fluxResult.width;
                    finalHeight = fluxResult.height;
                    log.debug(`Flux constraints applied: ${closestPreset.width}x${closestPreset.height} → ${finalWidth}x${finalHeight}`);
                }
                // For other categories with custom calc, use the preset as-is
            }
            
            // Apply the final dimensions
            if (this.widthWidget && this.heightWidget) {
                this.widthWidget.value = finalWidth;
                this.heightWidget.value = finalHeight;
                
                // Mark that dimensions were manually set by auto-fit
                this.manuallySetByAutoFit = true;
                
                // Update the preset dropdown - use original name for dropdown selection
                props.selectedPreset = closestPreset.originalName;
                
                // Update node properties
                props.valueX = finalWidth;
                props.valueY = finalHeight;
                
                // Update UI
                this.handlePropertyChange();
                this.updateRescaleValue();
                
                log.debug(`Auto-fitted to preset: ${closestPreset.name} with final resolution: ${finalWidth}x${finalHeight}`);
            }
        }
    }
    
    applyDimensionChange() {
        const props = this.node.properties;
        let { value: width } = this.widthWidget;
        let { value: height } = this.heightWidget;

        if (props.useCustomCalc && props.selectedCategory) {
            ({ width, height } = this.applyCustomCalculation(width, height, props.selectedCategory));
        }

        this.widthWidget.value = Math.max(props.minX, Math.min(props.maxX, width));
        this.heightWidget.value = Math.max(props.minY, Math.min(props.maxY, height));

        props.valueX = this.widthWidget.value;
        props.valueY = this.heightWidget.value;
        
        this.handlePropertyChange();
        this.updateRescaleValue();
    }

    applyPreset(category, presetName) {
        const props = this.node.properties;
        const preset = this.presetCategories[category]?.[presetName];
        if (!preset) return;
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = preset.width;
            this.heightWidget.value = preset.height;
            props.selectedPreset = presetName;
            this.applyDimensionChange();
        }
    }
    
    // Calculation methods
    applyCustomCalculation(width, height, category) {
        const calculations = {
            Flux: () => this.applyFluxCalculation(width, height),
            WAN: () => this.applyWANCalculation(width, height),
        };
        return calculations[category] ? calculations[category]() : { width, height };
    }

    getClosestPResolution(width, height) {
        const pValue = Math.sqrt(width * height * 9 / 16);
        return `(${Math.round(pValue)}p)`;
    }
    
    applyFluxCalculation(width, height) {
        let newWidth = Math.round(width / 32) * 32;
        let newHeight = Math.round(height / 32) * 32;
        
        const currentMP = (newWidth * newHeight) / 1000000;
        if (currentMP > 4.0) {
            const scale = Math.sqrt(4.0 / currentMP);
            newWidth = Math.round((newWidth * scale) / 32) * 32;
            newHeight = Math.round((newHeight * scale) / 32) * 32;
        }
        
        return { 
            width: Math.max(320, Math.min(2560, newWidth)),
            height: Math.max(320, Math.min(2560, newHeight))
        };
    }
    
    applyWANCalculation(width, height) {
        const targetPixels = Math.max(182080, Math.min(1195560, width * height));
        const aspect = width / height;
        let targetHeight = Math.sqrt(targetPixels / aspect);
        let targetWidth = targetHeight * aspect;
        
        return { 
            width: Math.round(targetWidth / 16) * 16,
            height: Math.round(targetHeight / 16) * 16
        };
    }
    
    calculateResolutionScale(targetP) {
        if (!this.widthWidget || !this.heightWidget) return 1.0;
        const targetPixels = (targetP * (16 / 9)) * targetP;
        const currentPixels = this.widthWidget.value * this.heightWidget.value;
        return Math.sqrt(targetPixels / currentPixels);
    }
    
    calculateMegapixelsScale(targetMP) {
        if (!this.widthWidget || !this.heightWidget) return 1.0;
        const targetPixels = targetMP * 1000000;
        const currentPixels = this.widthWidget.value * this.heightWidget.value;
        return Math.sqrt(targetPixels / currentPixels);
    }
    
    updateRescaleValue() {
        const props = this.node.properties;
        const modeCalculations = {
            manual: () => props.upscaleValue,
            resolution: () => this.calculateResolutionScale(props.targetResolution),
            megapixels: () => this.calculateMegapixelsScale(props.targetMegapixels),
        };
        const value = modeCalculations[props.rescaleMode]?.() || 1.0;
        
        props.rescaleValue = value;
        
        // Find and update the rescale_value widget
        const rescaleValueWidget = this.node.widgets?.find(w => w.name === 'rescale_value');
        if (rescaleValueWidget) {
            rescaleValueWidget.value = value;
        }
        
        // Find and update the rescale_mode widget
        const rescaleModeWidget = this.node.widgets?.find(w => w.name === 'rescale_mode');
        if (rescaleModeWidget) {
            rescaleModeWidget.value = props.rescaleMode;
        }
    }
    
    // Auto-detect methods
    startAutoDetect() {
        if (this.dimensionCheckInterval) return;
        this.checkForImageDimensions();
        this.dimensionCheckInterval = setInterval(() => this.checkForImageDimensions(), 1000);
    }
    
    stopAutoDetect() {
        if (this.dimensionCheckInterval) {
            clearInterval(this.dimensionCheckInterval);
            this.dimensionCheckInterval = null;
        }
    }
    
    async checkForImageDimensions() {
        const node = this.node;
        try {
            const inputLink = node.inputs?.[0]?.link;
            if (!inputLink) {
                this.detectedDimensions = null;
                return;
            }
            
            const link = app.graph.links[inputLink];
            if (link) {
                const sourceNode = app.graph.getNodeById(link.origin_id);
                const img = sourceNode?.imgs?.[0];
                if (img && (!this.detectedDimensions || this.detectedDimensions.width !== img.naturalWidth || this.detectedDimensions.height !== img.naturalHeight)) {
                    this.detectedDimensions = { width: img.naturalWidth, height: img.naturalHeight };
                    this.manuallySetByAutoFit = false;
                    
                    if (node.properties.autoDetect && this.widthWidget && this.heightWidget) {
                        this.widthWidget.value = this.detectedDimensions.width;
                        this.heightWidget.value = this.detectedDimensions.height;
                        this.applyDimensionChange();
                    }
                    
                    if (node.properties.autoFitOnChange && node.properties.selectedCategory) {
                        this.handleAutoFit();
                    }
                    app.graph.setDirtyCanvas(true);
                }
            }
        } catch (error) {
            log.error('Error checking for image dimensions:', error);
        }
    }
    
    isPointInControl(x, y, control) {
        if (!control) return false;
        return x >= control.x && x <= control.x + control.w &&
               y >= control.y && y <= control.y + control.h;
    }
}

// Register the extension
app.registerExtension({
    name: "azResolutionMaster",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "ResolutionMaster") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                onNodeCreated?.apply(this, []);
                this.resolutionMaster = new ResolutionMasterCanvas(this);
            };
        }
    }
});
