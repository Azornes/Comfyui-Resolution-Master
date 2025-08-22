// ComfyUI.azToolkit.ResolutionMaster v.10.1.0 - Canvas version with single view (no tabs)
// All controls visible at once like in original DOM version
import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./utils/LoggerUtils.js";
import { loadIcons } from "./utils/IconUtils.js";

// Initialize logger for this module
const log = createModuleLogger('ResolutionMaster');

class ResolutionMasterCanvas {
    constructor(node) {
        this.node = node;
        
        // Initialize properties
        this.node.properties = this.node.properties || {};
        this.initializeProperties();
        
        // Internal state
        this.node.intpos = { x: 0.5, y: 0.5 };
        this.node.capture = false;
        this.node.configured = false;
        
        // UI state
        this.hoverElement = null;
        this.scrollOffset = 0;
        this.dropdownOpen = null;
        
        // Custom input dialog state
        this.customInputDialog = null;
        this.inputDialogActive = false;
        
        // Tooltip state
        this.tooltipElement = null;
        this.tooltipTimer = null;
        this.tooltipDelay = 500; // ms - reduced for faster response
        this.showTooltip = false;
        this.tooltipMousePos = null; // Current mouse position
        
        // Auto-detect state
        this.detectedDimensions = null;
        this.dimensionCheckInterval = null;
        this.manuallySetByAutoFit = false;
        
        // Control positions (will be calculated dynamically)
        this.controls = {};
        this.resolutions = ['144p', '240p', '360p', '480p', '720p', '820p', '1080p', '1440p', '2160p', '4320p'];

        this.icons = {};
        loadIcons(this.icons);
        
        // Tooltip definitions
        this.tooltips = {
            // Primary controls (excluding sliders and 2D canvas)
            swapBtn: "Swap width and height values",
            snapBtn: "Snap current resolution to the nearest snap value",
            snapValueArea: "Click to set custom snap value",
            
            // Output value areas (editable)
            widthValueArea: "Click to set custom width value",
            heightValueArea: "Click to set custom height value",
            
            // Scaling controls (buttons and dropdowns only)
            scaleBtn: "Apply manual scaling factor and reset to 1.0x",
            upscaleRadio: "Use manual scaling mode for rescale output",
            scaleValueArea: "Click to set custom scale value (e.g., 2.5x)",
            
            resolutionBtn: "Scale to target resolution (e.g., 1080p)",
            resolutionDropdown: "Select target resolution for scaling",
            resolutionRadio: "Use resolution-based scaling for rescale output",
            resolutionValueArea: "Click to set custom resolution scale factor",
            
            megapixelsBtn: "Scale to target megapixel count",
            megapixelsRadio: "Use megapixel-based scaling for rescale output",
            megapixelsValueArea: "Click to set custom megapixel value (e.g., 3.5MP)",
            
            // Auto-detect controls
            autoDetectToggle: "Automatically detect resolution from connected image input",
            autoFitBtn: "Find and apply best preset match for current resolution",
            autoFitCheckbox: "Automatically find and apply the best preset for the new detected image resolution",
            detectedInfo: "Click to apply detected image resolution directly",
            
            // Preset controls
            categoryDropdown: "Select preset category (Standard, SDXL, Flux, HiDream Dev, Qwen-Image, etc.)",
            presetDropdown: "Choose specific preset from selected category",
            customCalcCheckbox: "Automatically apply model-specific optimizations for the new detected image resolution (read orange information below)",
            autoCalcBtn: "Apply model-specific optimizations for current resolution (read orange information below)"
        };
        
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
               // Community Presets
               '16:9 Landscape': { width: 1280, height: 720 },
               '16:9 Landscape': { width: 832, height: 480 },
               '1:1 Square': { width: 512, height: 512 },
               '1:1 Square': { width: 768, height: 768 },
               // Original Presets
               '1:1 Square': { width: 720, height: 720 },
               '2:3 Portrait': { width: 588, height: 882 },
               '3:4 Portrait': { width: 624, height: 832 },
               '9:21 Portrait': { width: 549, height: 1280 },
               '3:2 Landscape': { width: 1080, height: 720 },
               '4:3 Landscape': { width: 960, height: 720 },
               '21:9 Landscape': { width: 1680, height: 720 }
            },
            'HiDream Dev': {
                '1:1 Square': { width: 1024, height: 1024 },
                '1:1 Square Large': { width: 1280, height: 1280 },
                '1:1 Square XL': { width: 1536, height: 1536 },
                '16:9 Landscape': { width: 1360, height: 768 },
                '3:2 Landscape': { width: 1248, height: 832 },
                '4:3 Landscape': { width: 1168, height: 880 },
            },
            'Qwen-Image': {
                '1:1 Square (Default)': { width: 1328, height: 1328 },
                '16:9 Landscape': { width: 1664, height: 928 },
                '4:3 Landscape': { width: 1472, height: 1140 },
                '3:2 Landscape': { width: 1584, height: 1056 },
                '1:1 Test': { width: 1024, height: 1024 },
                '4:3 Test': { width: 768, height: 1024 }
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
    
    ensureMinimumSize() {
        if (this.node.size[0] < 330) {
            this.node.size[0] = 330;
        }
        if (this.node.size[1] < 620) {
            this.node.size[1] = 620;
        }
    }
    
    initializeProperties() {
        const defaultProperties = {
            mode: "Manual",
            valueX: 512,
            valueY: 512,
            canvas_min_x: 0,
            canvas_max_x: 2048,
            canvas_step_x: 64,
            canvas_min_y: 0,
            canvas_max_y: 2048,
            canvas_step_y: 64,
            canvas_decimals_x: 0,
            canvas_decimals_y: 0,
            canvas_snap: true,
            canvas_dots: true,
            canvas_frame: true,
            action_slider_snap_min: 16,
            action_slider_snap_max: 256,
            action_slider_snap_step: 16,
            scaling_slider_min: 0.1,
            scaling_slider_max: 4.0,
            scaling_slider_step: 0.1,
            megapixels_slider_min: 0.5,
            megapixels_slider_max: 6.0,
            megapixels_slider_step: 0.1,
            snapValue: 64,
            upscaleValue: 1.0,
            targetResolution: 1080,
            targetMegapixels: 2.0,
            rescaleMode: "resolution",
            rescaleValue: 1.0,
            autoDetect: false,
            autoFitOnChange: false,
            selectedCategory: "Standard",
            selectedPreset: null,
            useCustomCalc: false,
            manual_slider_min_w: 64,
            manual_slider_max_w: 2048,
            manual_slider_step_w: 64,
            manual_slider_min_h: 64,
            manual_slider_max_h: 2048,
            manual_slider_step_h: 64,
        };

        Object.entries(defaultProperties).forEach(([key, defaultValue]) => {
            this.node.properties[key] = this.node.properties[key] ?? defaultValue;
        });
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
    
        
        // Initialize values from widgets
        if (widthWidget && heightWidget) {
            node.properties.valueX = widthWidget.value;
            node.properties.valueY = heightWidget.value;
            
            // Initialize intpos based on current values
            node.intpos.x = (widthWidget.value - node.properties.canvas_min_x) / (node.properties.canvas_max_x - node.properties.canvas_min_x);
            node.intpos.y = (heightWidget.value - node.properties.canvas_min_y) / (node.properties.canvas_max_y - node.properties.canvas_min_y);
        }
        
        
        // Store widget references
        this.widthWidget = widthWidget;
        this.heightWidget = heightWidget;
        this.rescaleModeWidget = rescaleModeWidget;
        this.rescaleValueWidget = rescaleValueWidget;
        
        
        // Override onDrawForeground
        node.onDrawForeground = function(ctx) {
            if (this.flags.collapsed) return;
            self.ensureMinimumSize();
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
            self.ensureMinimumSize();
            app.graph.setDirtyCanvas(true);
        };
        
        // Cleanup
        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            if (self.dimensionCheckInterval) {
                clearInterval(self.dimensionCheckInterval);
                self.dimensionCheckInterval = null;
            }
            if (self.tooltipTimer) {
                clearTimeout(self.tooltipTimer);
                self.tooltipTimer = null;
            }
            if (self.customInputDialog) {
                self.closeCustomInputDialog();
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

                // Hide all backend widgets
        [widthWidget, heightWidget, modeWidget, autoDetectWidget, rescaleModeWidget, rescaleValueWidget].forEach(widget => {
            if (widget) {
                widget.hidden = true;
                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
            }
        });
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
            
            // Draw info message outside of any section background
            if (props.useCustomCalc && props.selectedCategory) {
                const messageHeight = this.drawInfoMessage(ctx, currentY);
                if (messageHeight > 0) {
                    currentY += messageHeight + spacing;
                }
            }

        } else if (props.mode === "Manual Sliders") {
            this.drawSliderMode(ctx, currentY);
        }
        
        const neededHeight = currentY + 20;
        if (node.size[1] < neededHeight) {
            node.size[1] = neededHeight;
        }
        
        // Draw tooltip last so it appears on top
        if (this.showTooltip && this.tooltipElement && this.tooltips[this.tooltipElement]) {
            this.drawTooltip(ctx);
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
        ctx.textAlign = "center";
        ctx.fillText(title, x + w / 2, y + 10);
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

            // Calculate clickable area dimensions
            const valueAreaWidth = 60; // Wider area for better clicking
            const valueAreaHeight = 20;
            const valueAreaX = node.size[0] - valueAreaWidth - 5;

            // Width value area
            this.controls.widthValueArea = {
                x: valueAreaX,
                y: y_offset_1 - valueAreaHeight/2,
                w: valueAreaWidth,
                h: valueAreaHeight
            };
            
            // Draw background for width value area if hovered
            if (this.hoverElement === 'widthValueArea') {
                ctx.fillStyle = "rgba(136, 153, 255, 0.2)";
                ctx.strokeStyle = "rgba(136, 153, 255, 0.5)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(valueAreaX, y_offset_1 - valueAreaHeight/2, valueAreaWidth, valueAreaHeight, 4);
                ctx.fill();
                ctx.stroke();
            }

            ctx.fillStyle = this.hoverElement === 'widthValueArea' ? "#89F" : "#89F";
            ctx.fillText(this.widthWidget.value.toString(), node.size[0] - 20, y_offset_1);
            
            // Height value area
            this.controls.heightValueArea = {
                x: valueAreaX,
                y: y_offset_2 - valueAreaHeight/2,
                w: valueAreaWidth,
                h: valueAreaHeight
            };
            
            // Draw background for height value area if hovered
            if (this.hoverElement === 'heightValueArea') {
                ctx.fillStyle = "rgba(248, 136, 153, 0.2)";
                ctx.strokeStyle = "rgba(248, 136, 153, 0.5)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(valueAreaX, y_offset_2 - valueAreaHeight/2, valueAreaWidth, valueAreaHeight, 4);
                ctx.fill();
                ctx.stroke();
            }
            
            ctx.fillStyle = this.hoverElement === 'heightValueArea' ? "#F89" : "#F89";
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
        this.drawSlider(ctx, sliderX, y, sliderWidth, 28, props.snapValue, props.action_slider_snap_min, props.action_slider_snap_max, props.action_slider_snap_step);

        // Draw clickable snap value area
        const snapValueX = sliderX + sliderWidth + gap;
        this.controls.snapValueArea = { x: snapValueX, y, w: valueWidth, h: 28 };
        
        // Draw background for snap value area if hovered
        if (this.hoverElement === 'snapValueArea') {
            ctx.fillStyle = "rgba(100, 150, 255, 0.2)";
            ctx.strokeStyle = "rgba(100, 150, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(snapValueX, y, valueWidth, 28, 4);
            ctx.fill();
            ctx.stroke();
        }

        ctx.fillStyle = this.hoverElement === 'snapValueArea' ? "#5af" : "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(props.snapValue.toString(), snapValueX, y + 14);
    }
    
    draw2DCanvas(ctx, x, y, w, h) {
        const node = this.node;
        const props = node.properties;
        
        this.controls.canvas2d = { x, y, w, h };
        
        const rangeX = props.canvas_max_x - props.canvas_min_x;
        const rangeY = props.canvas_max_y - props.canvas_min_y;
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
        
        if (props.canvas_dots) {
            ctx.fillStyle = "rgba(200,200,200,0.5)";
            ctx.beginPath();
            let stX = canvasW * props.canvas_step_x / rangeX;
            let stY = canvasH * props.canvas_step_y / rangeY;
            for (let ix = stX; ix < canvasW; ix += stX) {
                for (let iy = stY; iy < canvasH; iy += stY) {
                    ctx.rect(offsetX + ix - 0.5, offsetY + iy - 0.5, 1, 1);
                }
            }
            ctx.fill();
        }
        
        if (props.canvas_frame) {
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
    
    getScalingRowLayout() {
        const margin = 20;
        const availableWidth = this.node.size[0] - margin * 2;
        const gap = 8;
        const btnWidth = 50;
        const valueWidth = 45;
        const previewWidth = 70;
        const radioWidth = 18;
        
        return {
            margin,
            availableWidth,
            gap,
            btnWidth,
            valueWidth,
            previewWidth,
            radioWidth,
            sliderWidth: availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4),
            dropdownWidth: availableWidth - btnWidth - valueWidth - previewWidth - radioWidth - (gap * 4)
        };
    }

    drawScalingGrid(ctx, y) {
        const margin = 20;
        this.drawScaleRow(ctx, margin, y);
        this.drawResolutionRow(ctx, margin, y + 35);
        this.drawMegapixelsRow(ctx, margin, y + 70);
        return 105;
    }
    
    drawScaleRow(ctx, x, y) {
        const props = this.node.properties;
        this.drawScalingRowBase(ctx, x, y, {
            buttonControl: 'scaleBtn',
            mainControl: 'scaleSlider',
            radioControl: 'upscaleRadio',
            controlType: 'slider',
            icon: this.icons.upscale,
            valueProperty: 'upscaleValue',
            min: props.scaling_slider_min,
            max: props.scaling_slider_max,
            step: props.scaling_slider_step,
            displayValue: props.upscaleValue.toFixed(1) + "x",
            scaleFactor: props.upscaleValue,
            rescaleMode: 'manual'
        });
    }
    
    drawResolutionRow(ctx, x, y) {
        const props = this.node.properties;
        const selectedText = this.resolutions.find(r => parseInt(r) === props.targetResolution) || '1080p';
        const scaleFactor = this.calculateResolutionScale(props.targetResolution);
        
        this.drawScalingRowBase(ctx, x, y, {
            buttonControl: 'resolutionBtn',
            mainControl: 'resolutionDropdown',
            radioControl: 'resolutionRadio',
            controlType: 'dropdown',
            icon: this.icons.resolution,
            selectedText: selectedText,
            displayValue: `×${scaleFactor.toFixed(2)}`,
            scaleFactor: scaleFactor,
            rescaleMode: 'resolution'
        });
    }
    
    drawMegapixelsRow(ctx, x, y) {
        const props = this.node.properties;
        const scaleFactor = this.calculateMegapixelsScale(props.targetMegapixels);
        
        this.drawScalingRowBase(ctx, x, y, {
            buttonControl: 'megapixelsBtn',
            mainControl: 'megapixelsSlider',
            radioControl: 'megapixelsRadio',
            controlType: 'slider',
            icon: this.icons.megapixels,
            valueProperty: 'targetMegapixels',
            min: props.megapixels_slider_min,
            max: props.megapixels_slider_max,
            step: props.megapixels_slider_step,
            displayValue: `${props.targetMegapixels.toFixed(1)}MP`,
            scaleFactor: scaleFactor,
            rescaleMode: 'megapixels'
        });
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
        let currentY = y;

        // Pierwszy rząd: Auto-detect toggle + Auto-fit button + Auto checkbox
        this.controls.autoDetectToggle = { x: currentX, y: currentY, w: toggleWidth, h: 28 };
        this.drawToggle(ctx, currentX, currentY, toggleWidth, 28, props.autoDetect,
                       props.autoDetect ? "Auto-detect ON" : "Auto-detect OFF",
                       this.hoverElement === 'autoDetectToggle');
        
        const autoFitStartX = currentX + toggleWidth + gap;
        this.controls.autoFitBtn = { x: autoFitStartX, y: currentY, w: autoFitWidth, h: 28 };
        const btnEnabled = props.selectedCategory; // Tylko wymaga wybranej kategorii, nie wykrytych wymiarów
        this.drawButton(ctx, autoFitStartX, currentY, autoFitWidth, 28, "🎯 Auto-fit", this.hoverElement === 'autoFitBtn', !btnEnabled);
        
        const autoCheckboxX = autoFitStartX + autoFitWidth + gap;
        this.controls.autoFitCheckbox = { x: autoCheckboxX, y: currentY + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, autoCheckboxX, currentY + 5, checkboxWidth, props.autoFitOnChange, this.hoverElement === 'autoFitCheckbox', !btnEnabled);
        
        ctx.fillStyle = btnEnabled ? "#ddd" : "#777";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Auto", autoCheckboxX + checkboxWidth + 4, currentY + 14);
        
        // Drugi rząd: Detected info (po lewej) + Auto-calc button + Calc checkbox (idealnie pod Auto-fit)
        currentY += 35;
        
        // Klikalny napis "Detected" wycentrowany pod switchem Auto-detect
        if (props.autoDetect && this.detectedDimensions) {
            const detectedText = `Detected: ${this.detectedDimensions.width}×${this.detectedDimensions.height}`;
            ctx.font = "12px Arial";
            const textWidth = ctx.measureText(detectedText).width;
            
            // Wycentruj tekst pod switchem Auto-detect (toggleWidth = 140)
            const toggleCenterX = margin + (toggleWidth / 2);
            const textX = toggleCenterX - (textWidth / 2);
            
            // Definiuj obszar klikalny dla napisu "Detected" (wycentrowany pod switchem)
            this.controls.detectedInfo = { x: textX - 5, y: currentY + 2, w: textWidth + 10, h: 24 };
            
            // Rysuj tło jeśli hover
            if (this.hoverElement === 'detectedInfo') {
                ctx.fillStyle = "rgba(95, 255, 95, 0.2)";
                ctx.strokeStyle = "rgba(95, 255, 95, 0.5)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(textX - 5, currentY + 2, textWidth + 10, 20, 4);
                ctx.fill();
                ctx.stroke();
            }
            
            ctx.fillStyle = this.hoverElement === 'detectedInfo' ? "#7f7" : "#5f5";
            ctx.textAlign = "left";
            ctx.fillText(detectedText, textX, currentY + 14);
        }
        
        // Auto-calc button idealnie pod Auto-fit button
        this.controls.autoCalcBtn = { x: autoFitStartX, y: currentY, w: autoFitWidth, h: 28 };
        const calcEnabled = props.useCustomCalc && props.selectedCategory;
        this.drawButton(ctx, autoFitStartX, currentY, autoFitWidth, 28, "⚡ Auto-calc", this.hoverElement === 'autoCalcBtn', !calcEnabled);
        
        // Calc checkbox idealnie pod Auto checkbox
        this.controls.customCalcCheckbox = { x: autoCheckboxX, y: currentY + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, autoCheckboxX, currentY + 5, checkboxWidth, props.useCustomCalc, this.hoverElement === 'customCalcCheckbox');
        
        ctx.fillStyle = "#ddd";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Calc", autoCheckboxX + checkboxWidth + 4, currentY + 14);
        
        return 65;
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
            // Tylko dropdowny kategorii i presetów
            const categoryDDWidth = availableWidth * 0.45;
            const presetDDWidth = availableWidth * 0.55 - gap;

            this.controls.categoryDropdown = { x: currentX, y, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, y, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
            currentX += categoryDDWidth + gap;

            this.controls.presetDropdown = { x: currentX, y, w: presetDDWidth, h: 28 };
            const presetText = props.selectedPreset || "Select Preset...";
            this.drawDropdown(ctx, currentX, y, presetDDWidth, 28, presetText, this.hoverElement === 'presetDropdown');
        } else {
            // Category dropdown takes full width
            this.controls.categoryDropdown = { x: currentX, y, w: availableWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, y, availableWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
        }

        return currentHeight;
    }
    
    drawInfoMessage(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const category = props.selectedCategory;
        
        let message = "";
        if (category === "SDXL" && props.useCustomCalc) {
            message = "💡 SDXL Mode: Only using presets!";
        } else if (category === "Flux" && props.useCustomCalc) {
            message = "💡 Flux Mode: Round to: 32px | Edge range: 320-2560px | Max resolution: 4.0 MP";
        } else if (category === "WAN" && props.useCustomCalc && this.widthWidget && this.heightWidget) {
            const pixels = this.widthWidget.value * this.heightWidget.value;
            const model = pixels < 600000 ? "480p" : "720p";
            message = `💡 WAN Mode: Suggesting ${model} model | Round to: 16px | Resolution range: 320p-820p`;
        } else if (category === "HiDream Dev" && props.useCustomCalc) {
            message = "💡 HiDream Dev: Only using presets!";
        } else if (category === "Qwen-Image" && props.useCustomCalc) {
            message = "💡 Qwen-Image: Resolution range: ~0.6MP-4.2MP. If input is already in this range, it remains unchanged.";
        } else if (['Standard', 'Social Media', 'Print', 'Cinema'].includes(category) && props.useCustomCalc) {
            message = "💡 Calc Mode: Scales the selected preset to the closest current resolution, maintaining the preset's aspect ratio.";
        }
        
        if (message) {
           const paddingX = 10;
           const paddingTop = 8;
           const paddingBottom = 8;
           const lineHeight = 14;
           const maxWidth = node.size[0] - 40 - (paddingX * 2);

           // Word wrap logic
           ctx.font = "11px Arial";
           const words = message.split(' ');
           const lines = [];
           let currentLine = '';
           for (const word of words) {
               const testLine = currentLine ? `${currentLine} ${word}` : word;
               if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                   lines.push(currentLine);
                   currentLine = word;
               } else {
                   currentLine = testLine;
               }
           }
           if (currentLine) lines.push(currentLine);

           const textHeight = lines.length * lineHeight - (lineHeight - ctx.measureText("M").width);
           const boxHeight = textHeight + paddingTop + paddingBottom;

           // Draw background with dynamic height
           ctx.fillStyle = "rgba(250, 165, 90, 0.15)";
           ctx.strokeStyle = "rgba(250, 165, 90, 0.5)";
           ctx.beginPath();
           ctx.roundRect(20, y, node.size[0] - 40, boxHeight, 4);
           ctx.fill();
           ctx.stroke();

           // Draw multi-line text
           ctx.fillStyle = "#fa5";
           ctx.textAlign = "center";
           ctx.textBaseline = "top";
           lines.forEach((line, index) => {
               ctx.fillText(line, node.size[0] / 2, y + paddingTop + (index * lineHeight));
           });
           
           return boxHeight;
        }
        return 0;
    }
    
    drawSliderMode(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 10;
        const w = node.size[0] - margin * 2;
        
        if (!this.widthWidget || !this.heightWidget) return;
        
        // Draw width slider
        y = this.drawDimensionSlider(ctx, y, margin, w, "Width:", "widthSlider", 
            this.widthWidget.value, props.manual_slider_min_w, props.manual_slider_max_w, props.manual_slider_step_w);
        
        // Draw height slider
        this.drawDimensionSlider(ctx, y, margin, w, "Height:", "heightSlider", 
            this.heightWidget.value, props.manual_slider_min_h, props.manual_slider_max_h, props.manual_slider_step_h);
    }
    
    drawDimensionSlider(ctx, y, margin, w, label, controlName, value, min, max, step) {
        const node = this.node;
        
        ctx.fillStyle = "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(label, margin, y);
        
        this.controls[controlName] = { x: margin, y: y + 10, w, h: 25 };
        this.drawSlider(ctx, margin, y + 10, w, 25, value, min, max, step);
        
        ctx.textAlign = "right";
        ctx.fillText(value.toString(), node.size[0] - margin, y + 25);
        
        return y + 45;
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
    
    drawTooltip(ctx) {
        if (!this.tooltipMousePos || !this.tooltips[this.tooltipElement]) {
            log.debug("Tooltip draw failed: missing mouse pos or tooltip text");
            return;
        }
        
        const tooltipText = this.tooltips[this.tooltipElement];
        const paddingX = 8;
        const paddingTop = 8;
        const paddingBottom = 4; // Zmniejszony dolny padding
        const maxWidth = 250;
        const lineHeight = 16;
        
        // log.debug(`Drawing tooltip for ${this.tooltipElement}: "${tooltipText}"`);
        
        // Set font for measuring
        ctx.font = "12px Arial";
        
        // Word wrap the text
        const words = tooltipText.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Calculate tooltip dimensions
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const tooltipWidth = Math.min(textWidth + paddingX * 2, maxWidth + paddingX * 2);
        const tooltipHeight = lines.length * lineHeight + paddingTop + paddingBottom;
        
        // Position tooltip relative to current mouse position - can extend beyond node bounds
        const mouseRelX = this.tooltipMousePos.x - this.node.pos[0];
        const mouseRelY = this.tooltipMousePos.y - this.node.pos[1];
        
        let tooltipX = mouseRelX + 15;
        let tooltipY = mouseRelY - tooltipHeight - 10;
        
        // Simple positioning logic - prefer right and above mouse
        if (tooltipX + tooltipWidth > this.node.size[0] + 50) {
            tooltipX = mouseRelX - tooltipWidth - 15;
        }
        if (tooltipY < -50) {
            tooltipY = mouseRelY + 20;
        }
        
        // Draw tooltip background with shadow
        ctx.save();
        
        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.roundRect(tooltipX + 2, tooltipY + 2, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        
        // Background
        const bgGrad = ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
        bgGrad.addColorStop(0, "rgba(45, 45, 45, 0.95)");
        bgGrad.addColorStop(1, "rgba(35, 35, 35, 0.95)");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw text
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        lines.forEach((line, index) => {
            ctx.fillText(line, tooltipX + paddingX, tooltipY + paddingTop + index * lineHeight);
        });
        
        ctx.restore();
        
        //log.debug(`Tooltip drawn at ${tooltipX}, ${tooltipY} with size ${tooltipWidth}x${tooltipHeight}`);
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
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey, e.ctrlKey);
                return true;
            }
        }
        
        for (const key in this.controls) {
            if (this.isPointInControl(relX, relY, this.controls[key])) {
                log.debug(`Mouse down on control: ${key} at (${relX}, ${relY})`);
                
                if (key.endsWith('Btn') || key === 'detectedInfo') {
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
                if (key.endsWith('ValueArea')) {
                    // Open dialog immediately on mousedown
                    log.debug(`Detected ValueArea click: ${key}`);
                    this.showCustomValueDialog(key, e);
                    return true;
                }
            }
        }
        
        log.debug(`No control found at (${relX}, ${relY}). Available controls:`, Object.keys(this.controls));
        
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
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, e.shiftKey, e.ctrlKey);
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
        
        // Always update mouse position for tooltips
        this.tooltipMousePos = { x: e.canvasX, y: e.canvasY };
        
        // If tooltip is showing, update canvas to follow mouse
        if (this.showTooltip && this.tooltipElement) {
            app.graph.setDirtyCanvas(true);
        }
        
        if (newHover !== this.hoverElement) {
            this.hoverElement = newHover;
            this.handleTooltipHover(newHover, e);
            app.graph.setDirtyCanvas(true);
        }
    }
    
    handleTooltipHover(element, e) {
        // Clear existing tooltip timer
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        
        // Hide tooltip immediately when hover changes
        if (this.showTooltip) {
            this.showTooltip = false;
            this.tooltipElement = null;
            app.graph.setDirtyCanvas(true);
        }
        
        // Start new tooltip timer if hovering over an element with tooltip
        if (element && this.tooltips[element]) {
            //log.debug(`Starting tooltip timer for element: ${element}`);
            // Store the initial mouse position when timer starts
            const initialMousePos = { x: e.canvasX, y: e.canvasY };
            this.tooltipTimer = setTimeout(() => {
                //log.debug(`Showing tooltip for element: ${element}`);
                this.tooltipElement = element;
                this.showTooltip = true;
                this.tooltipFixedPos = initialMousePos; // Use the stored initial position
                app.graph.setDirtyCanvas(true);
            }, this.tooltipDelay);
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
        
        node.intpos.x = (node.properties.valueX - node.properties.canvas_min_x) / 
                       (node.properties.canvas_max_x - node.properties.canvas_min_x);
        node.intpos.y = (node.properties.valueY - node.properties.canvas_min_y) / 
                       (node.properties.canvas_max_y - node.properties.canvas_min_y);
        
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
            autoFitBtn: () => this.handleAutoFit(),
            autoCalcBtn: () => this.handleAutoCalc(),
            detectedInfo: () => this.handleDetectedClick()
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
        if (checkboxName === 'autoFitCheckbox' && props.selectedCategory) {
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
    
    // Helper methods
    validateWidgets() {
        return this.widthWidget && this.heightWidget;
    }
    
    setDimensions(width, height) {
        if (!this.validateWidgets()) return;
        
        // Update properties
        this.node.properties.valueX = width;
        this.node.properties.valueY = height;
        
        // Then update widgets
        this.widthWidget.value = width;
        this.heightWidget.value = height;
        
        // Update UI
        this.handlePropertyChange();
        this.updateRescaleValue();

        this.updateCanvasFromWidgets();
        
        // Force canvas redraw to update 2D slider position
        app.graph.setDirtyCanvas(true);
    }
    
    updateCanvasFromWidgets() {
        // Aktualizuj pozycję canvas 2D na podstawie wartości widgetów
        if (!this.validateWidgets()) return;
        
        const node = this.node;
        const props = node.properties;
        
        // Aktualizuj properties na podstawie widgetów
        props.valueX = this.widthWidget.value;
        props.valueY = this.heightWidget.value;
        
        // Przelicz pozycję intpos dla canvas 2D
        node.intpos.x = (this.widthWidget.value - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
        node.intpos.y = (this.heightWidget.value - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        
        // Ogranicz do zakresu 0-1
        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));
        
        // Aktualizuj rescale value
        this.updateRescaleValue();
        
        // Wymuś przerysowanie canvas
        app.graph.setDirtyCanvas(true);
    }
    
    setCanvasTextStyle(ctx, style = {}) {
        const defaults = {
            fillStyle: "#ccc",
            font: "12px Arial",
            textAlign: "center",
            textBaseline: "middle"
        };
        const finalStyle = { ...defaults, ...style };
        
        Object.entries(finalStyle).forEach(([key, value]) => {
            ctx[key] = value;
        });
    }
    
    drawScalingRowBase(ctx, x, y, config) {
        const props = this.node.properties;
        const layout = this.getScalingRowLayout();
        let currentX = x;

        // Draw button
        this.controls[config.buttonControl] = { x: currentX, y, w: layout.btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, layout.btnWidth, 28, config.icon, this.hoverElement === config.buttonControl);
        currentX += layout.btnWidth + layout.gap;
        
        // Draw main control (slider or dropdown)
        if (config.controlType === 'slider') {
            this.controls[config.mainControl] = { x: currentX, y, w: layout.sliderWidth, h: 28 };
            this.drawSlider(ctx, currentX, y, layout.sliderWidth, 28,
                          props[config.valueProperty], config.min, config.max, config.step);
            currentX += layout.sliderWidth + layout.gap;
        } else if (config.controlType === 'dropdown') {
            this.controls[config.mainControl] = { x: currentX, y, w: layout.dropdownWidth, h: 28 };
            this.drawDropdown(ctx, currentX, y, layout.dropdownWidth, 28, config.selectedText, this.hoverElement === config.mainControl);
            currentX += layout.dropdownWidth + layout.gap;
        }
        
        // Draw clickable value display with hover effect
        const valueAreaControl = config.buttonControl.replace('Btn', 'ValueArea');
        this.controls[valueAreaControl] = { x: currentX, y, w: layout.valueWidth, h: 28 };
        
        // Draw background for value area if hovered
        if (this.hoverElement === valueAreaControl) {
            ctx.fillStyle = "rgba(100, 150, 255, 0.2)";
            ctx.strokeStyle = "rgba(100, 150, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(currentX, y, layout.valueWidth, 28, 4);
            ctx.fill();
            ctx.stroke();
        }
        
        // Draw value text
        this.setCanvasTextStyle(ctx, {
            fillStyle: this.hoverElement === valueAreaControl ? "#5af" : "#ccc",
            textAlign: "center"
        });
        ctx.fillText(config.displayValue, currentX + layout.valueWidth / 2, y + 14);
        currentX += layout.valueWidth + layout.gap;
        
        // Draw preview
        if (this.validateWidgets() && config.scaleFactor) {
            const newW = Math.round(this.widthWidget.value * config.scaleFactor);
            const newH = Math.round(this.heightWidget.value * config.scaleFactor);
            this.setCanvasTextStyle(ctx, { fillStyle: "#888", font: "11px Arial", textAlign: "left" });
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += layout.previewWidth + layout.gap;
        
        // Draw radio button
        this.controls[config.radioControl] = { x: currentX, y: y + 5, w: layout.radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, layout.radioWidth,
                           props.rescaleMode === config.rescaleMode, this.hoverElement === config.radioControl);
    }

    // Value update methods
    updateCanvasValue(x, y, w, h, shiftKey, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        
        // Ctrl+Shift: zmiana rozmiaru po 1px z zachowaniem proporcji
        if (ctrlKey && shiftKey) {
            // Zachowaj obecne proporcje
            const currentAspect = this.widthWidget.value / this.heightWidget.value;
            
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            
            // Zaokrąglij do 1px
            newX = Math.round(newX);
            newY = Math.round(newY);
            
            // Zachowaj proporcje - dostosuj Y na podstawie X
            newY = Math.round(newX / currentAspect);
            
            // Przelicz z powrotem na pozycje vX, vY
            vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        // Shift: przeciąganie z zachowaniem proporcji
        else if (shiftKey && !ctrlKey) {
            // Zachowaj obecne proporcje
            const currentAspect = this.widthWidget.value / this.heightWidget.value;
            
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            
            // Zastosuj snap
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vX = Math.round(vX / sX) * sX;
            
            // Przelicz newX po snap
            newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            
            // Zachowaj proporcje - dostosuj Y na podstawie X
            newY = newX / currentAspect;
            
            // Przelicz z powrotem na pozycję vY
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        // Ctrl: zmiana rozmiaru bez snap (poprzednia funkcjonalność Shift)
        else if (ctrlKey && !shiftKey) {
            // Nie stosuj snap - pozostaw vX i vY bez zmian
        }
        // Domyślnie: zastosuj snap
        else {
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vX = Math.round(vX / sX) * sX;
            vY = Math.round(vY / sY) * sY;
        }
        
        node.intpos.x = vX;
        node.intpos.y = vY;
        
        let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
        let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
        
        const rnX = Math.pow(10, props.canvas_decimals_x);
        const rnY = Math.pow(10, props.canvas_decimals_y);
        newX = Math.round(rnX * newX) / rnX;
        newY = Math.round(rnY * newY) / rnY;
        
        this.setDimensions(newX, newY);
        app.graph.setDirtyCanvas(true);
    }
    
    updateSliderValue(sliderName, x, w) {
        const props = this.node.properties;
        let value = Math.max(0, Math.min(1, x / w));
        
        const sliderConfig = {
            snapSlider: { prop: 'snapValue', min: props.action_slider_snap_min, max: props.action_slider_snap_max, step: props.action_slider_snap_step },
            scaleSlider: { prop: 'upscaleValue', min: props.scaling_slider_min, max: props.scaling_slider_max, step: props.scaling_slider_step, updateOn: 'manual' },
            megapixelsSlider: { prop: 'targetMegapixels', min: props.megapixels_slider_min, max: props.megapixels_slider_max, step: props.megapixels_slider_step, updateOn: 'megapixels' },
            widthSlider: { prop: 'valueX', min: props.manual_slider_min_w, max: props.manual_slider_max_w, step: props.manual_slider_step_w },
            heightSlider: { prop: 'valueY', min: props.manual_slider_min_h, max: props.manual_slider_max_h, step: props.manual_slider_step_h }
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

            if (sliderName === 'widthSlider') {
                this.setDimensions(props.valueX, this.heightWidget.value);
            } else if (sliderName === 'heightSlider') {
                this.setDimensions(this.widthWidget.value, props.valueY);
            } else if (sliderName.includes('Slider')) {
                this.handlePropertyChange();
            }
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
            callback = (value) => {
               // Handle preset names that may contain parentheses by removing the last part with dimensions
               const lastParenIndex = value.lastIndexOf(' (');
               const presetName = value.substring(0, lastParenIndex);
               this.applyPreset(props.selectedCategory, presetName);
            };
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
    
    showCustomValueDialog(valueAreaKey, e) {
        if (this.inputDialogActive) return;
        
        log.debug(`Clicked on value area: ${valueAreaKey}`);
        
        // Determine the type and current value based on the control key
        let valueType, currentValue, propertyName, minValue = 0.01;
        
        if (valueAreaKey === 'scaleValueArea') {
            valueType = 'Scale Factor';
            currentValue = this.node.properties.upscaleValue;
            propertyName = 'upscaleValue';
        } else if (valueAreaKey === 'resolutionValueArea') {
            valueType = 'Resolution Scale';
            currentValue = this.calculateResolutionScale(this.node.properties.targetResolution);
            propertyName = 'targetResolution';
        } else if (valueAreaKey === 'megapixelsValueArea') {
            valueType = 'Megapixels';
            currentValue = this.node.properties.targetMegapixels;
            propertyName = 'targetMegapixels';
        } else if (valueAreaKey === 'snapValueArea') {
            valueType = 'Snap Value';
            currentValue = this.node.properties.snapValue;
            propertyName = 'snapValue';
            minValue = 1;
        } else if (valueAreaKey === 'widthValueArea') {
            valueType = 'Width';
            currentValue = this.widthWidget ? this.widthWidget.value : this.node.properties.valueX;
            propertyName = 'width';
            minValue = 64;
        } else if (valueAreaKey === 'heightValueArea') {
            valueType = 'Height';
            currentValue = this.heightWidget ? this.heightWidget.value : this.node.properties.valueY;
            propertyName = 'height';
            minValue = 64;
        } else {
            log.debug(`Unknown value area key: ${valueAreaKey}`);
            return;
        }
        
        log.debug(`Opening dialog for ${valueType} with current value: ${currentValue}`);
        this.createCustomInputDialog(valueType, currentValue, propertyName, minValue, e);
    }
    
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
                <input type="${valueType === 'Scale Factor' ? 'text' : 'number'}" id="customValueInput" value="${currentValue}" step="0.01" min="${minValue}"
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
            if (e.key === 'Enter' && validateInput()) this.applyCustomValue(propertyName, this.parseCustomInputValue(input.value, valueType), valueType);
            else if (e.key === 'Escape') this.closeCustomInputDialog();
        });
        cancelBtn.addEventListener('click', () => this.closeCustomInputDialog());
        applyBtn.addEventListener('click', () => {
            if (validateInput()) this.applyCustomValue(propertyName, this.parseCustomInputValue(input.value, valueType), valueType);
        });
        
        validateInput();
    }
    
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
    
    applyCustomValue(propertyName, value, valueType) {
        const props = this.node.properties;
        
        if (propertyName === 'upscaleValue') {
            props.upscaleValue = value;
            if (props.rescaleMode === 'manual') {
                this.updateRescaleValue();
            }
        } else if (propertyName === 'targetResolution') {
            // For resolution, we need to reverse-calculate the target resolution from the scale factor
            if (this.validateWidgets()) {
                const currentPixels = this.widthWidget.value * this.heightWidget.value;
                const targetPixels = currentPixels * (value * value);
                const targetP = Math.sqrt(targetPixels / (16/9));
                props.targetResolution = Math.round(targetP);
                if (props.rescaleMode === 'resolution') {
                    this.updateRescaleValue();
                }
            }
        } else if (propertyName === 'targetMegapixels') {
            props.targetMegapixels = value;
            if (props.rescaleMode === 'megapixels') {
                this.updateRescaleValue();
            }
        } else if (propertyName === 'snapValue') {
            props.snapValue = Math.round(value);
        } else if (propertyName === 'width') {
            const newWidth = Math.round(value);
            const currentHeight = this.heightWidget ? this.heightWidget.value : props.valueY;
            this.setDimensions(newWidth, currentHeight);
        } else if (propertyName === 'height') {
            const newHeight = Math.round(value);
            const currentWidth = this.widthWidget ? this.widthWidget.value : props.valueX;
            this.setDimensions(currentWidth, newHeight);
        }
        
        this.closeCustomInputDialog();
        app.graph.setDirtyCanvas(true);
        
        log.debug(`Applied custom ${valueType}: ${value}`);
    }
    
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

    parseCustomInputValue(rawValue, valueType) {
        if (valueType === 'Scale Factor' && typeof rawValue === 'string' && rawValue.startsWith('/')) {
            const divisor = parseFloat(rawValue.substring(1));
            if (!isNaN(divisor) && divisor !== 0) {
                return 1 / divisor;
            }
        }
        return parseFloat(rawValue);
    }
    
    // Action handlers
    handleSwap() {
        if (!this.validateWidgets()) return;
        
        const newWidth = this.heightWidget.value;
        const newHeight = this.widthWidget.value;
        this.setDimensions(newWidth, newHeight);
    }
    
    handleSnap() {
        if (!this.validateWidgets()) return;
        
        const snap = this.node.properties.snapValue;
        const newWidth = Math.round(this.widthWidget.value / snap) * snap;
        const newHeight = Math.round(this.heightWidget.value / snap) * snap;
        this.setDimensions(newWidth, newHeight);
    }
    
    applyScaling(scaleCalculator, resetValue = null) {
        if (!this.validateWidgets()) return;
        
        const scale = scaleCalculator();
        const newWidth = Math.round(this.widthWidget.value * scale);
        const newHeight = Math.round(this.heightWidget.value * scale);
        
        // Reset value if provided
        if (resetValue) {
            resetValue();
        }
        
        this.setDimensions(newWidth, newHeight);
    }

    handleScale() {
        this.applyScaling(
            () => this.node.properties.upscaleValue,
            () => { this.node.properties.upscaleValue = 1.0; }
        );
    }

    handleResolutionScale() {
        this.applyScaling(() => this.calculateResolutionScale(this.node.properties.targetResolution));
    }

    handleMegapixelsScale() {
        this.applyScaling(() => this.calculateMegapixelsScale(this.node.properties.targetMegapixels));
    }
    
    handleAutoFit() {
        const props = this.node.properties;
        const category = props.selectedCategory;
        if (!category) return;
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-fit: Width or height widget not found");
            return;
        }
        
        // Pobierz obecne wymiary z widgetów (nie z wykrytego zdjęcia)
        const currentWidth = this.widthWidget.value;
        const currentHeight = this.heightWidget.value;
        
        // Użyj zunifikowanej funkcji
        this.applyAutoFit(currentWidth, currentHeight, props.useCustomCalc, category, 'current');
    }
    
    // Zunifikowana funkcja AutoFit
    applyAutoFit(width, height, useCalc, category, source = 'detected') {
        const props = this.node.properties;
        
        if (!this.widthWidget || !this.heightWidget) return;
        
        const closestPreset = this.findClosestPreset(width, height, category);
        
        if (!closestPreset) return;
        
        let finalWidth, finalHeight;
        
        if (useCalc) {
            // Z kalkulacjami - sprawdź czy aspect ratio się zgadza
            const presetAspect = closestPreset.width / closestPreset.height;
            const currentAspect = width / height;
            
            // Jeśli aspect ratio jest prawie identyczny (różnica < 0.01)
            if (Math.abs(currentAspect - presetAspect) < 0.01) {
                // Zachowaj obecny rozmiar lub zastosuj specyficzne kalkulacje dla kategorii
                const result = this.applyCustomCalculation(width, height, category);
                finalWidth = result.width;
                finalHeight = result.height;
                log.debug(`Auto-fit with calc (${source}): ${closestPreset.name} has matching aspect ratio. Using ${finalWidth}x${finalHeight} (from ${width}x${height})`);
            } else {
                // Aspect ratio się różni - skaluj do presetu i zastosuj kalkulacje
                const scaledDimensions = this.scaleToPresetAspectRatio(width, height, presetAspect);
                const result = this.applyCustomCalculation(scaledDimensions.width, scaledDimensions.height, category);
                finalWidth = result.width;
                finalHeight = result.height;
                log.debug(`Auto-fit with calc (${source}): ${closestPreset.name} different aspect. Scaled to ${finalWidth}x${finalHeight} (from ${width}x${height})`);
            }
        } else {
            // Bez kalkulacji - użyj presetu bezpośrednio
            finalWidth = closestPreset.width;
            finalHeight = closestPreset.height;
            log.debug(`Auto-fit preset only (${source}): ${closestPreset.name} (${finalWidth}x${finalHeight}) for input ${width}x${height}`);
        }
        
        props.selectedPreset = closestPreset.name;
        this.setDimensions(finalWidth, finalHeight);
    }
    
    handleAutoCalc() {
        // Funkcja Auto-calc - ręczne zastosowanie kalkulacji bez użycia Auto-fit
        const props = this.node.properties;
        
        if (!props.useCustomCalc || !props.selectedCategory) {
            log.debug("Auto-calc: Calc checkbox or category not selected");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-calc: Width or height widget not found");
            return;
        }
        
        // Pobierz obecne wymiary z widgetów
        const currentWidth = this.widthWidget.value;
        const currentHeight = this.heightWidget.value;
        
        // Zastosuj kalkulacje specyficzne dla kategorii
        const result = this.applyCustomCalculation(currentWidth, currentHeight, props.selectedCategory);
        
        // Ustaw nowe wymiary
        this.setDimensions(result.width, result.height);
        
        log.debug(`Auto-calc applied: ${currentWidth}x${currentHeight} → ${result.width}x${result.height} (${props.selectedCategory})`);
    }
    
    handleDetectedClick() {
        // Funkcja obsługująca kliknięcie na napis "Detected" - nakłada oryginalne wymiary wykrytego zdjęcia
        if (!this.detectedDimensions) {
            log.debug("Detected click: No detected dimensions available");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Detected click: Width or height widget not found");
            return;
        }
        
        // Ustaw oryginalne wymiary wykrytego zdjęcia
        this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
        
        log.debug(`Detected click applied: Set dimensions to ${this.detectedDimensions.width}x${this.detectedDimensions.height}`);
    }
    
    applyDimensionChange() {
        const props = this.node.properties;
        let { value: width } = this.widthWidget;
        let { value: height } = this.heightWidget;

        if (props.useCustomCalc && props.selectedCategory) {
            ({ width, height } = this.applyCustomCalculation(width, height, props.selectedCategory));
        }

        const newWidth = Math.max(props.canvas_min_x, Math.min(props.canvas_max_x, width));
        const newHeight = Math.max(props.canvas_min_y, Math.min(props.canvas_max_y, height));
        
        this.setDimensions(newWidth, newHeight);
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
            this.updateCanvasFromWidgets();
        }
    }
    
    // Calculation methods
    applyCustomCalculation(width, height, category) {
        const calculations = {
            Flux: () => this.applyFluxCalculation(width, height),
            WAN: () => this.applyWANCalculation(width, height),
            'Qwen-Image': () => this.applyQwenCalculation(width, height),
            // SDXL and HiDream Dev zachowują się jak auto-fit - znajdą najbliższy preset
            'SDXL': () => this.findBestPresetForCategory(width, height, 'SDXL'),
            'HiDream Dev': () => this.findBestPresetForCategory(width, height, 'HiDream Dev'),
            'Standard': () => this.scaleToNearestPresetAspectRatio(width, height, 'Standard'),
            'Social Media': () => this.scaleToNearestPresetAspectRatio(width, height, 'Social Media'),
            'Print': () => this.scaleToNearestPresetAspectRatio(width, height, 'Print'),
            'Cinema': () => this.scaleToNearestPresetAspectRatio(width, height, 'Cinema')
        };
        return calculations[category] ? calculations[category]() : { width, height };
    }
    
    findBestPresetForCategory(width, height, category) {
        // Znajdź najbliższy preset dla SDXL lub HiDream Dev
        const closestPreset = this.findClosestPreset(width, height, category);
        
        if (closestPreset) {
            log.debug(`${category} Calc: Found best preset ${closestPreset.name} (${closestPreset.width}x${closestPreset.height}) for input ${width}x${height}`);
            return { width: closestPreset.width, height: closestPreset.height };
        }
        
        return { width, height };
    }

    scaleToNearestPresetAspectRatio(width, height, category) {
        const closestPreset = this.findClosestPreset(width, height, category);

        if (closestPreset) {
            const presetAspect = closestPreset.width / closestPreset.height;
            const currentAspect = width / height;
            
            // Jeśli aspect ratio jest prawie identyczny (różnica < 0.01), zachowaj obecny rozmiar
            if (Math.abs(currentAspect - presetAspect) < 0.01) {
                log.debug(`Calc for ${category}: Preset ${closestPreset.name} has matching aspect ratio (${presetAspect.toFixed(2)}). Keeping current size ${width}x${height}`);
                return { width, height };
            }
            
            // W przeciwnym razie skaluj do aspect ratio presetu
            const result = this.scaleToPresetAspectRatio(width, height, presetAspect);
            
            log.debug(`Calc for ${category}: Found preset ${closestPreset.name}. Scaling ${width}x${height} -> ${result.width}x${result.height} with aspect ${presetAspect.toFixed(2)}`);
            return result;
        }
        
        return { width, height };
    }

    // Unified preset finding logic
    findClosestPreset(width, height, category, options = {}) {
        const presets = this.presetCategories[category];
        if (!presets) return null;

        let closestPreset = null;
        let closestAspectDiff = Infinity;
        let closestPixelDiff = Infinity;
        
        const inputAspect = width / height;
        const inputPixels = width * height;
        
        Object.entries(presets).forEach(([presetName, preset]) => {
            // Check both original and flipped orientations
            const orientations = [
                { width: preset.width, height: preset.height, flipped: false },
                { width: preset.height, height: preset.width, flipped: true }
            ];
            
            orientations.forEach(orientation => {
                const presetAspect = orientation.width / orientation.height;
                const presetPixels = orientation.width * orientation.height;
                
                // NAJPIERW porównaj aspect ratio
                const aspectDiff = Math.abs(inputAspect - presetAspect);
                
                // Jeśli aspect ratio jest bliższy lub bardzo podobny (różnica < 0.01)
                if (aspectDiff < closestAspectDiff || (Math.abs(aspectDiff - closestAspectDiff) < 0.01)) {
                    // Jeśli aspect ratio jest identyczny lub prawie identyczny
                    if (aspectDiff < 0.01 || aspectDiff < closestAspectDiff) {
                        // Wtedy sprawdź różnicę w pikselach
                        const pixelDiff = Math.abs(Math.log(inputPixels / presetPixels));
                        
                        // Wybierz preset tylko jeśli ma lepszy aspect ratio
                        // LUB ma ten sam aspect ratio ale bliższy rozmiar
                        if (aspectDiff < closestAspectDiff ||
                            (Math.abs(aspectDiff - closestAspectDiff) < 0.01 && pixelDiff < closestPixelDiff)) {
                            closestAspectDiff = aspectDiff;
                            closestPixelDiff = pixelDiff;
                            closestPreset = {
                                name: presetName,
                                width: orientation.width,
                                height: orientation.height,
                                originalPreset: preset
                            };
                        }
                    }
                }
            });
        });
        
        log.debug(`findClosestPreset: Input ${width}x${height} (aspect ${inputAspect.toFixed(2)}) → Selected "${closestPreset?.name}" ${closestPreset?.width}x${closestPreset?.height} (aspect ${(closestPreset?.width/closestPreset?.height)?.toFixed(2)})`);
        
        return closestPreset;
    }

    // Unified logic for choosing best scaling option based on pixel difference
    chooseBestScalingOption(currentPixels, option1Pixels, option2Pixels, option1Dims, option2Dims) {
        const option1Diff = Math.abs(option1Pixels - currentPixels);
        const option2Diff = Math.abs(option2Pixels - currentPixels);
        
        if (option1Diff <= option2Diff) {
            return option1Dims;
        } else {
            return option2Dims;
        }
    }

    // Unified logic for scaling to preset aspect ratio
    scaleToPresetAspectRatio(currentWidth, currentHeight, presetAspect) {
        const currentPixels = currentWidth * currentHeight;
        
        // Option 1: base on current width
        const option1Width = currentWidth;
        const option1Height = Math.round(currentWidth / presetAspect);
        const option1Pixels = option1Width * option1Height;
        
        // Option 2: base on current height
        const option2Height = currentHeight;
        const option2Width = Math.round(currentHeight * presetAspect);
        const option2Pixels = option2Width * option2Height;
        
        return this.chooseBestScalingOption(
            currentPixels,
            option1Pixels,
            option2Pixels,
            { width: option1Width, height: option1Height },
            { width: option2Width, height: option2Height }
        );
    }

    getClosestPResolution(width, height) {
        const pValue = Math.sqrt(width * height * 9 / 16);
        return `(${Math.round(pValue)}p)`;
    }
    
    applyFluxCalculation(width, height) {
        // Najpierw sprawdź czy trzeba skalować ze względu na MP (zachowując proporcje)
        const currentMP = (width * height) / 1000000;
        let scaledWidth = width;
        let scaledHeight = height;
        
        if (currentMP > 4.0) {
            // Skaluj zachowując dokładnie proporcje
            const scale = Math.sqrt(4.0 / currentMP);
            scaledWidth = width * scale;
            scaledHeight = height * scale;
        }
        
        // Ogranicz do zakresu 320-2560px zachowując proporcje
        const maxDimension = Math.max(scaledWidth, scaledHeight);
        if (maxDimension > 2560) {
            const limitScale = 2560 / maxDimension;
            scaledWidth *= limitScale;
            scaledHeight *= limitScale;
        }
        
        const minDimension = Math.min(scaledWidth, scaledHeight);
        if (minDimension < 320) {
            const limitScale = 320 / minDimension;
            scaledWidth *= limitScale;
            scaledHeight *= limitScale;
        }
        
        // DOPIERO NA KOŃCU zaokrąglij do 32px (to może nieznacznie zmienić proporcje)
        const finalWidth = Math.round(scaledWidth / 32) * 32;
        const finalHeight = Math.round(scaledHeight / 32) * 32;
        
        return {
            width: Math.max(320, Math.min(2560, finalWidth)),
            height: Math.max(320, Math.min(2560, finalHeight))
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
    
    applyQwenCalculation(width, height) {
        const currentPixels = width * height;
        const minPixels = 589824;  // ~0.6MP
        const maxPixels = 4194304; // ~4.2MP

        // Explicitly check if dimensions are already within the target range
        if (currentPixels >= minPixels && currentPixels <= maxPixels) {
            // Input is already in the desired range, return unchanged
            return { width, height };
        } else {
            // Input is outside the range, scale to fit
            let targetPixels;
            
            if (currentPixels < minPixels) {
                // Too small, scale up to minimum
                targetPixels = minPixels;
            } else {
                // Too large, scale down to maximum
                targetPixels = maxPixels;
            }
            
            // Calculate new dimensions maintaining aspect ratio
            const aspect = width / height;
            let targetHeight = Math.sqrt(targetPixels / aspect);
            let targetWidth = targetHeight * aspect;
            
            return {
                width: Math.round(targetWidth),
                height: Math.round(targetHeight)
            };
        }
    }
    
    calculateResolutionScale(targetP) {
        const targetPixels = (targetP * (16 / 9)) * targetP;
        return this.calculateScaleFromPixels(targetPixels);
    }
    
    calculateMegapixelsScale(targetMP) {
        const targetPixels = targetMP * 1000000;
        return this.calculateScaleFromPixels(targetPixels);
    }
    
    calculateScaleFromPixels(targetPixels) {
        if (!this.widthWidget || !this.heightWidget) return 1.0;
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
                    
                    const props = node.properties;
                    
                    // Scenariusz 1: TYLKO autoDetect = ON (bez autoFit i bez Calc)
                    if (props.autoDetect && !props.autoFitOnChange && !props.useCustomCalc) {
                        if (this.widthWidget && this.heightWidget) {
                            this.widthWidget.value = this.detectedDimensions.width;
                            this.heightWidget.value = this.detectedDimensions.height;
                            this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
                        }
                    }
                    // Scenariusz 2: autoFitOnChange = ON + useCustomCalc = OFF (może być z autoDetect lub bez)
                    else if (props.autoFitOnChange && !props.useCustomCalc && props.selectedCategory) {
                        this.applyAutoFit(this.detectedDimensions.width, this.detectedDimensions.height, false, props.selectedCategory, 'detected');
                    }
                    // Scenariusz 3: autoFitOnChange = ON + useCustomCalc = ON (może być z autoDetect lub bez)
                    else if (props.autoFitOnChange && props.useCustomCalc && props.selectedCategory) {
                        this.applyAutoFit(this.detectedDimensions.width, this.detectedDimensions.height, true, props.selectedCategory, 'detected');
                    }
                    // Scenariusz 4: autoDetect = ON + useCustomCalc = ON + autoFitOnChange = OFF
                    else if (props.autoDetect && !props.autoFitOnChange && props.useCustomCalc && props.selectedCategory) {
                        if (this.widthWidget && this.heightWidget) {
                            this.widthWidget.value = this.detectedDimensions.width;
                            this.heightWidget.value = this.detectedDimensions.height;
                            this.applyDimensionChange(); // Zastosuje kalkulacje na oryginalnych wymiarach
                        }
                    }
                    // Fallback: tylko autoDetect bez innych opcji
                    else if (props.autoDetect && this.widthWidget && this.heightWidget) {
                        this.widthWidget.value = this.detectedDimensions.width;
                        this.heightWidget.value = this.detectedDimensions.height;
                        this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
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
