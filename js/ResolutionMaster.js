import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./utils/LoggerUtils.js";
import { loadIcons } from "./utils/IconUtils.js";
import { tooltips, presetCategories } from "./utils/ResolutionMasterConfig.js";
import { DialogManager } from "./DialogManager.js";
import { SearchableDropdown } from "./SearchableDropdown.js";
import { AspectRatioSelector } from "./AspectRatioSelector.js";
import { CustomPresetsManager } from "./utils/CustomPresetsManager.js";
import { PresetManagerDialog } from "./utils/PresetManagerDialog.js";
const log = createModuleLogger('ResolutionMaster');

class ResolutionMasterCanvas {    
    constructor(node) {
        this.node = node;
        this.node.properties = this.node.properties || {};
        this.initializeProperties();
        this.node.intpos = { x: 0.5, y: 0.5 };
        this.node.capture = false;
        this.node.configured = false;
        this._isInitializing = true; // Flag to prevent setDirtyCanvas during init
        this._pendingCanvasUpdate = false;
        this.hoverElement = null;
        this.scrollOffset = 0;
        this.dropdownOpen = null;
        this.collapsedSections = {};
        this.dialogManager = new DialogManager(this);
        this.searchableDropdown = new SearchableDropdown();
        this.aspectRatioSelector = new AspectRatioSelector();
        this.customPresetsManager = new CustomPresetsManager(this);
        this.presetManagerDialog = new PresetManagerDialog(this.customPresetsManager);
        this.tooltipElement = null;
        this.tooltipTimer = null;
        this.tooltipDelay = 500; 
        this.showTooltip = false;
        this.tooltipMousePos = null; 
        this.detectedDimensions = null;
        this.dimensionCheckInterval = null;
        this.manuallySetByAutoFit = false;
        this.controls = {};
        this.resolutions = ['144p', '240p', '360p', '480p', '720p', '820p', '1080p', '1440p', '2160p', '4320p'];

        this.icons = {};
        loadIcons(this.icons);
        this.tooltips = tooltips;
        this.presetCategories = presetCategories;
        
        this.setupNode();
        import('./css-loader.js').then(module => {
            module.loadStylesWhenNeeded();
        }).catch(error => {
            log.error('Failed to load CSS:', error);
        });
        
        // Mark initialization complete after a short delay to allow ComfyUI to finish setup
        requestAnimationFrame(() => {
            this._isInitializing = false;
        });
    }
    
    /**
     * Safely request a canvas update - prevents multiple rapid updates during initialization
     * and graph configuration that can cause ComfyUI freezing issues
     */
    requestCanvasUpdate(force = false) {
        // Skip updates during initialization unless forced
        if (this._isInitializing && !force) {
            this._pendingCanvasUpdate = true;
            return;
        }
        
        // Ensure graph exists and is ready
        if (!app.graph) {
            this._pendingCanvasUpdate = true;
            return;
        }
        
        // Use requestAnimationFrame to batch updates and avoid conflicts
        if (!this._canvasUpdateScheduled) {
            this._canvasUpdateScheduled = true;
            requestAnimationFrame(() => {
                this._canvasUpdateScheduled = false;
                this._pendingCanvasUpdate = false;
                if (app.graph) {
                    app.graph.setDirtyCanvas(true);
                }
            });
        }
    }
    
    ensureMinimumSize() {
        if (this.node.size[0] < 330) {
            this.node.size[0] = 330;
        }
        const neededHeight = this.calculateNeededHeight();
        if (neededHeight > 0) {
            this.node.size[1] = Math.max(neededHeight, this.node.min_size[1]);
        } else {
            if (this.node.size[1] < this.node.min_size[1]) {
                this.node.size[1] = this.node.min_size[1];
            }
        }
    }
    
    calculateNeededHeight() {
        const props = this.node.properties;
        if (!props || props.mode !== "Manual") return 0;
        
        let currentY = LiteGraph.NODE_TITLE_HEIGHT + 2;
        const spacing = 8;
        const canvasHeight = 200;
        currentY += canvasHeight + spacing;
        currentY += 15 + spacing;
        const sectionHeights = {
            actions: this.collapsedSections?.actions ? 25 : 55,      
            scaling: this.collapsedSections?.scaling ? 25 : 130,    
            autoDetect: this.collapsedSections?.autoDetect ? 25 : 125, 
            presets: this.collapsedSections?.presets ? 25 : 90       
        };
        Object.values(sectionHeights).forEach(height => {
            currentY += height + spacing;
        });
        if (props.useCustomCalc && props.selectedCategory) {
            currentY += 40; 
        }
        
        return currentY + 20; 
    }
    
    initializeProperties() {
        const defaultProperties = {
            mode: "Manual",
            valueX: 512,
            valueY: 512,
            batch_size: 1,
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
            autoResizeOnChange: false,
            selectedCategory: "Standard",
            selectedPreset: null,
            useCustomCalc: false,
            manual_slider_min_w: 64,
            manual_slider_max_w: 2048,
            manual_slider_step_w: 64,
            manual_slider_min_h: 64,
            manual_slider_max_h: 2048,
            manual_slider_step_h: 64,
            section_actions_collapsed: false,
            section_scaling_collapsed: false,
            section_autoDetect_collapsed: false,
            section_presets_collapsed: false,
            dropdown_resolution_expanded: false,
            dropdown_category_expanded: false,
            dropdown_preset_expanded: false,
            preset_selector_mode: 'visual', 
            customPresetsJSON: '',
        };

        Object.entries(defaultProperties).forEach(([key, defaultValue]) => {
            this.node.properties[key] = this.node.properties[key] ?? defaultValue;
        });
    }
    
    
    setupNode() {
        const node = this.node;
        const self = this;
        node.size = [330, 400]; 
        node.min_size = [330, 200]; 
        if (node.outputs) {
            node.outputs.forEach(output => {
                output.name = output.localized_name = "";
            });
        }
        const widthWidget = node.widgets?.find(w => w.name === 'width');
        const heightWidget = node.widgets?.find(w => w.name === 'height');
        const modeWidget = node.widgets?.find(w => w.name === 'mode');
        const latentTypeWidget = node.widgets?.find(w => w.name === 'latent_type');
        const autoDetectWidget = node.widgets?.find(w => w.name === 'auto_detect');
        const rescaleModeWidget = node.widgets?.find(w => w.name === 'rescale_mode');
        const rescaleValueWidget = node.widgets?.find(w => w.name === 'rescale_value');
        const batchSizeWidget = node.widgets?.find(w => w.name === 'batch_size');
        if (rescaleModeWidget) {
            rescaleModeWidget.value = node.properties.rescaleMode;
        }
        if (rescaleValueWidget) {
            rescaleValueWidget.value = node.properties.rescaleValue;
        }
        if (widthWidget && heightWidget) {
            node.properties.valueX = widthWidget.value;
            node.properties.valueY = heightWidget.value;
            node.intpos.x = (widthWidget.value - node.properties.canvas_min_x) / (node.properties.canvas_max_x - node.properties.canvas_min_x);
            node.intpos.y = (heightWidget.value - node.properties.canvas_min_y) / (node.properties.canvas_max_y - node.properties.canvas_min_y);
        }
        if (batchSizeWidget) {
            node.properties.batch_size = batchSizeWidget.value;
        }
        this.widthWidget = widthWidget;
        this.heightWidget = heightWidget;
        this.latentTypeWidget = latentTypeWidget;
        this.rescaleModeWidget = rescaleModeWidget;
        this.rescaleValueWidget = rescaleValueWidget;
        this.batchSizeWidget = batchSizeWidget;
        // Latent type is now manually controlled via LAT selector - no automatic initialization based on category
        node.onDrawForeground = function(ctx) {
            if (this.flags.collapsed) return;
            self.ensureMinimumSize();
            self.drawInterface(ctx);
        };
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
        node.onResize = function() {
            self.ensureMinimumSize();
            app.graph.setDirtyCanvas(true);
        };
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
            if (self.dialogManager.customInputDialog) {
                self.dialogManager.closeCustomInputDialog();
            }
            if (origOnRemoved) origOnRemoved.apply(this, arguments);
        };
        node.onGraphConfigured = function() {
            this.configured = true;
            
            // Defer initialization to next frame to avoid interfering with ComfyUI's graph setup
            requestAnimationFrame(() => {
                if (!this.graph) return; // Node was removed
                
                self.customPresetsManager.loadCustomPresets();
                log.debug('Reloaded custom presets after graph configured');
                
                self.collapsedSections = {
                    actions: this.properties.section_actions_collapsed,
                    scaling: this.properties.section_scaling_collapsed,
                    autoDetect: this.properties.section_autoDetect_collapsed,
                    presets: this.properties.section_presets_collapsed
                };
                
                // Update internal position from saved properties
                self.updateCanvasFromWidgets();
                self.updateRescaleValue();
                
                // Start auto-detect after everything is initialized
                if (this.properties.autoDetect) {
                    self.startAutoDetect();
                }
            });
        };
        [widthWidget, heightWidget, modeWidget, latentTypeWidget, autoDetectWidget, rescaleModeWidget, rescaleValueWidget, batchSizeWidget].forEach(widget => {
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
        
        let currentY = LiteGraph.NODE_TITLE_HEIGHT + 2;
        
        if (props.mode === "Manual") {
            this.controls = {};
            
            const collapsibleSection = (title, sectionKey, drawContent) => {
                const contentHeight = drawContent(ctx, currentY + 25, true);
                const sectionInfo = this.drawCollapsibleSection(ctx, title, sectionKey, margin, currentY, node.size[0] - margin * 2, contentHeight);
                
                if (!sectionInfo.isCollapsed) {
                    drawContent(ctx, sectionInfo.contentStartY, false);
                }
                
                currentY += sectionInfo.totalHeight + spacing;
            };

            const canvasHeight = 200;
            this.draw2DCanvas(ctx, margin, currentY, node.size[0] - margin * 2, canvasHeight);
            currentY += canvasHeight + spacing;
            
            this.drawInfoText(ctx, currentY);
            currentY += 15 + spacing;

            collapsibleSection("Actions", "actions", (ctx, y, preview) => {
                if (!preview) this.drawPrimaryControls(ctx, y);
                return 30;
            });
            
            collapsibleSection("Scaling", "scaling", (ctx, y, preview) => {
                if (!preview) return this.drawScalingGrid(ctx, y);
                return 105;
            });
            
            collapsibleSection("Auto-Detect", "autoDetect", (ctx, y, preview) => {
                if (!preview) return this.drawAutoDetectSection(ctx, y);
                return 100;
            });
            
            collapsibleSection("Presets", "presets", (ctx, y, preview) => {
                if (!preview) return this.drawPresetSection(ctx, y);
                return 30;
            });
            if (props.useCustomCalc && props.selectedCategory) {
                const messageHeight = this.drawInfoMessage(ctx, currentY);
                if (messageHeight > 0) {
                    currentY += messageHeight + spacing;
                }
            }
            this.drawOutputValues(ctx);

        } else if (props.mode === "Manual Sliders") {
            this.drawSliderMode(ctx, currentY);
        }
        
        const neededHeight = currentY + 20;
        const heightDiff = Math.abs(node.size[1] - neededHeight);
        if (heightDiff > 1) {
            node.size[1] = Math.max(neededHeight, node.min_size[1]);
        }
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
    
    drawCollapsibleSection(ctx, title, sectionKey, x, y, w, contentHeight) {
        const isCollapsed = this.collapsedSections[sectionKey] || false;
        const headerHeight = 25;
        const totalHeight = isCollapsed ? headerHeight : headerHeight + contentHeight;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, totalHeight, 6);
        ctx.fill();
        ctx.stroke();
        const headerControl = `${sectionKey}Header`;
        this.controls[headerControl] = { x, y, w, h: headerHeight };
        
        if (this.hoverElement === headerControl) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.beginPath();
            ctx.roundRect(x, y, w, headerHeight, 6);
            ctx.fill();
        }
        const arrow = isCollapsed ? "▶" : "▼";
        const titleText = `${arrow} ${title}`;
        
        ctx.fillStyle = this.hoverElement === headerControl ? "#fff" : "#ccc";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.fillText(titleText, x + w / 2, y + headerHeight / 2);
        
        return { totalHeight, isCollapsed, contentStartY: y + headerHeight };
    }
    
    drawOutputValues(ctx) {
        const node = this.node;
        const props = node.properties;
        
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        if (this.widthWidget && this.heightWidget && this.batchSizeWidget) {
            const y_offset_1 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 0.5);
            const y_offset_2 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 1.5);
            const y_offset_3 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 2.5);
            const y_offset_4 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 3.5);
            const valueAreaWidth = 60; 
            const batchSizeAreaWidth = 35; 
            const valueAreaHeight = 20;
            const valueAreaX = node.size[0] - valueAreaWidth - 5;
            const batchSizeAreaX = node.size[0] - batchSizeAreaWidth - 5;
            this.controls.widthValueArea = {
                x: valueAreaX,
                y: y_offset_1 - valueAreaHeight/2,
                w: valueAreaWidth,
                h: valueAreaHeight
            };
            
            this.drawValueAreaHoverBackground(ctx, 'widthValueArea', valueAreaX, y_offset_1 - valueAreaHeight/2, valueAreaWidth, valueAreaHeight, [136, 153, 255]);

            ctx.fillStyle = this.hoverElement === 'widthValueArea' ? "#89F" : "#89F";
            ctx.fillText(this.widthWidget.value.toString(), node.size[0] - 20, y_offset_1);
            this.controls.heightValueArea = {
                x: valueAreaX,
                y: y_offset_2 - valueAreaHeight/2,
                w: valueAreaWidth,
                h: valueAreaHeight
            };
            
            this.drawValueAreaHoverBackground(ctx, 'heightValueArea', valueAreaX, y_offset_2 - valueAreaHeight/2, valueAreaWidth, valueAreaHeight, [248, 136, 153]);
            
            ctx.fillStyle = this.hoverElement === 'heightValueArea' ? "#F89" : "#F89";
            ctx.fillText(this.heightWidget.value.toString(), node.size[0] - 20, y_offset_2);
            ctx.fillStyle = "#9F8";
            ctx.fillText(props.rescaleValue.toFixed(2), node.size[0] - 20, y_offset_3);
            this.controls.batchSizeValueArea = {
                x: batchSizeAreaX,
                y: y_offset_4 - valueAreaHeight/2,
                w: batchSizeAreaWidth,
                h: valueAreaHeight
            };
            
            this.drawValueAreaHoverBackground(ctx, 'batchSizeValueArea', batchSizeAreaX, y_offset_4 - valueAreaHeight/2, batchSizeAreaWidth, valueAreaHeight, [255, 136, 187]);
            
            ctx.fillStyle = this.hoverElement === 'batchSizeValueArea' ? "#FAB" : "#F8B";
            ctx.fillText(this.batchSizeWidget.value.toString(), node.size[0] - 20, y_offset_4);
            const y_offset_5 = 5 + (LiteGraph.NODE_SLOT_HEIGHT * 4.5);
            
            // Create clickable area for LAT selector
            const latAreaWidth = 50;
            const latAreaHeight = 28;
            const latAreaX = node.size[0] - latAreaWidth - 5;
            
            this.controls.latValueArea = {
                x: latAreaX,
                y: y_offset_5 - 10,
                w: latAreaWidth,
                h: latAreaHeight
            };
            
            this.drawValueAreaHoverBackground(ctx, 'latValueArea', latAreaX, y_offset_5 - 10, latAreaWidth, latAreaHeight, [248, 136, 187]);
            
            ctx.fillStyle = this.hoverElement === 'latValueArea' ? "#FAB" : "#F8B"; 
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "right";
            ctx.fillText("LAT", node.size[0] - 20, y_offset_5);
            
            // Draw latent type info in smaller gray font below LAT
            if (this.latentTypeWidget) {
                const latentType = this.latentTypeWidget.value || 'latent_4x8';
                const shortType = String(latentType).replace('latent_', '');
                ctx.fillStyle = this.hoverElement === 'latValueArea' ? "#999" : "#777"; 
                ctx.font = "9px Arial";
                ctx.textAlign = "right";
                ctx.fillText(shortType, node.size[0] - 20, y_offset_5 + 12);
            }
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
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.swap, this.hoverElement === 'swapBtn', false, "Swap", true);
        x += buttonWidth + gap;

        this.controls.snapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.snap, this.hoverElement === 'snapBtn', false, "Snap", true);
        x += buttonWidth + gap;

        const sliderX = x;
        const valueWidth = 35;
        const sliderWidth = node.size[0] - sliderX - valueWidth - margin;

        this.controls.snapSlider = { x: sliderX, y, w: sliderWidth, h: 28 };
        this.drawSlider(ctx, sliderX, y, sliderWidth, 28, props.snapValue, props.action_slider_snap_min, props.action_slider_snap_max, props.action_slider_snap_step);
        const snapValueX = sliderX + sliderWidth + gap;
        this.controls.snapValueArea = { x: snapValueX, y, w: valueWidth, h: 28 };
        
        this.drawValueAreaHoverBackground(ctx, 'snapValueArea', snapValueX, y, valueWidth, 28, [100, 150, 255]);

        ctx.fillStyle = this.hoverElement === 'snapValueArea' ? "#5af" : "#ccc";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(props.snapValue.toString(), snapValueX + 10, y + 14);
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
        const rightEdgeX = offsetX + canvasW * node.intpos.x;
        const rightEdgeY = offsetY + canvasH * (1 - node.intpos.y / 2);
        const topEdgeX = offsetX + canvasW * node.intpos.x / 2;
        const topEdgeY = offsetY + canvasH * (1 - node.intpos.y);
        this.controls.canvas2dRightHandle = { 
            x: rightEdgeX - 10, 
            y: rightEdgeY - 10, 
            w: 20, 
            h: 20 
        };
        this.controls.canvas2dTopHandle = { 
            x: topEdgeX - 10, 
            y: topEdgeY - 10, 
            w: 20, 
            h: 20 
        };
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const isHoveringRight = this.hoverElement === 'canvas2dRightHandle';
        ctx.fillStyle = isHoveringRight ? "#5AF" : "#89F";
        ctx.strokeStyle = isHoveringRight ? "#FFF" : "#000";
        ctx.lineWidth = isHoveringRight ? 3 : 2;
        ctx.beginPath();
        ctx.arc(rightEdgeX, rightEdgeY, isHoveringRight ? 7 : 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const isHoveringTop = this.hoverElement === 'canvas2dTopHandle';
        ctx.fillStyle = isHoveringTop ? "#FAB" : "#F89";
        ctx.strokeStyle = isHoveringTop ? "#FFF" : "#000";
        ctx.lineWidth = isHoveringTop ? 3 : 2;
        ctx.beginPath();
        ctx.arc(topEdgeX, topEdgeY, isHoveringTop ? 7 : 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    
    drawInfoText(ctx, y) {
        const node = this.node;
        if (this.widthWidget && this.heightWidget) {
            const width = this.widthWidget.value;
            const height = this.heightWidget.value;
            const mp = ((width * height) / 1000000).toFixed(2);
            const pResolution = this.getClosestPResolution(width, height);

            function gcd(a, b) {
                while (b !== 0) {
                    const t = a % b;
                    a = b;
                    b = t;
                }
                return a;
            }

            function aspectRatioString(w, h) {
                const g = gcd(w, h);
                return `${w / g}:${h / g}`;
            }

            const aspectRatio = aspectRatioString(width, height);
            
            ctx.fillStyle = "#bbb";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${width} × ${height}  |  ${mp} MP ${pResolution}  |  ${aspectRatio}`,
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
        const props = this.node.properties;
        this.drawScalingRowBase(ctx, margin, y, {
            buttonControl: 'scaleBtn', mainControl: 'scaleSlider', radioControl: 'upscaleRadio',
            controlType: 'slider', icon: this.icons.upscale, valueProperty: 'upscaleValue',
            min: props.scaling_slider_min, max: props.scaling_slider_max, step: props.scaling_slider_step,
            displayValue: props.upscaleValue.toFixed(1) + "x", scaleFactor: props.upscaleValue, rescaleMode: 'manual'
        });
        const resScale = this.calculateResolutionScale(props.targetResolution);
        this.drawScalingRowBase(ctx, margin, y + 35, {
            buttonControl: 'resolutionBtn', mainControl: 'resolutionDropdown', radioControl: 'resolutionRadio',
            controlType: 'dropdown', icon: this.icons.resolution, selectedText: `${props.targetResolution}p`,
            displayValue: `×${resScale.toFixed(2)}`, scaleFactor: resScale, rescaleMode: 'resolution'
        });
        const mpScale = this.calculateMegapixelsScale(props.targetMegapixels);
        this.drawScalingRowBase(ctx, margin, y + 70, {
            buttonControl: 'megapixelsBtn', mainControl: 'megapixelsSlider', radioControl: 'megapixelsRadio',
            controlType: 'slider', icon: this.icons.megapixels, valueProperty: 'targetMegapixels',
            min: props.megapixels_slider_min, max: props.megapixels_slider_max, step: props.megapixels_slider_step,
            displayValue: `${props.targetMegapixels.toFixed(1)}MP`, scaleFactor: mpScale, rescaleMode: 'megapixels'
        });
        
        return 105;
    }

    drawAutoDetectSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 8;
        
        const toggleWidth = 110;
        const checkboxWidth = 18;
        const checkboxLabelWidth = 30;
        const autoFitWidth = availableWidth - toggleWidth - checkboxWidth - checkboxLabelWidth - (gap * 2);

        let currentX = margin;
        let currentY = y;
        this.controls.autoDetectToggle = { x: currentX, y: currentY, w: toggleWidth, h: 28 };
        this.drawToggle(ctx, currentX, currentY, toggleWidth, 28, props.autoDetect,
                       props.autoDetect ? "Auto-detect ON" : "Auto-detect OFF",
                       this.hoverElement === 'autoDetectToggle');
        
        const autoFitStartX = currentX + toggleWidth + gap;
        this.controls.autoFitBtn = { x: autoFitStartX, y: currentY, w: autoFitWidth, h: 28 };
        const btnEnabled = props.selectedCategory; 
        this.drawButton(ctx, autoFitStartX, currentY, autoFitWidth, 28, this.icons.autoFit, this.hoverElement === 'autoFitBtn', !btnEnabled, "Auto-fit");
        
        const autoCheckboxX = autoFitStartX + autoFitWidth + gap;
        this.controls.autoFitCheckbox = { x: autoCheckboxX, y: currentY + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, autoCheckboxX, currentY + 5, checkboxWidth, props.autoFitOnChange, this.hoverElement === 'autoFitCheckbox', !btnEnabled);
        
        ctx.fillStyle = btnEnabled ? "#ddd" : "#777";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Auto", autoCheckboxX + checkboxWidth + 4, currentY + 14);
        currentY += 35;
        if (props.autoDetect && this.detectedDimensions) {
            const detectedText = `Detected: ${this.detectedDimensions.width}×${this.detectedDimensions.height}`;
            ctx.font = "12px Arial";
            const textWidth = ctx.measureText(detectedText).width;
            const toggleCenterX = margin + (toggleWidth / 2);
            const textX = toggleCenterX - (textWidth / 2);
            this.controls.detectedInfo = { x: textX - 5, y: currentY + 2, w: textWidth + 10, h: 24 };
            
            this.drawValueAreaHoverBackground(ctx, 'detectedInfo', textX - 5, currentY + 2, textWidth + 10, 20, [95, 255, 95]);
            
            ctx.fillStyle = this.hoverElement === 'detectedInfo' ? "#7f7" : "#5f5";
            ctx.textAlign = "left";
            ctx.fillText(detectedText, textX, currentY + 14);
        }
        this.controls.autoResizeBtn = { x: autoFitStartX, y: currentY, w: autoFitWidth, h: 28 };
        this.drawButton(ctx, autoFitStartX, currentY, autoFitWidth, 28, this.icons.autoResize, this.hoverElement === 'autoResizeBtn', false, "Auto-Resize");
        this.controls.autoResizeCheckbox = { x: autoCheckboxX, y: currentY + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, autoCheckboxX, currentY + 5, checkboxWidth, props.autoResizeOnChange, this.hoverElement === 'autoResizeCheckbox');
        
        ctx.fillStyle = "#ddd";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Auto", autoCheckboxX + checkboxWidth + 4, currentY + 14);
        currentY += 35;
        
        this.controls.autoCalcBtn = { x: autoFitStartX, y: currentY, w: autoFitWidth, h: 28 };
        const calcEnabled = props.useCustomCalc && props.selectedCategory;
        this.drawButton(ctx, autoFitStartX, currentY, autoFitWidth, 28, this.icons.autoCalculate, this.hoverElement === 'autoCalcBtn', !calcEnabled, "Auto-calc");
        this.controls.customCalcCheckbox = { x: autoCheckboxX, y: currentY + 5, w: checkboxWidth, h: 18 };
        this.drawCheckbox(ctx, autoCheckboxX, currentY + 5, checkboxWidth, props.useCustomCalc, this.hoverElement === 'customCalcCheckbox');
        
        ctx.fillStyle = "#ddd";
        ctx.font = "11px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Calc", autoCheckboxX + checkboxWidth + 4, currentY + 14);
        
        return 100;
    }
    
    drawPresetSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        let currentHeight = 30; 
        const gap = 8;
        let currentX = margin;
        let currentY = y;
        const iconBtnWidth = 28;
        const settingsBtnX = node.size[0] - margin - iconBtnWidth;
        if (props.selectedCategory) {
            const dropdownsWidth = availableWidth - iconBtnWidth - gap;
            const categoryDDWidth = dropdownsWidth * 0.4;
            const presetDDWidth = dropdownsWidth - categoryDDWidth - gap;

            this.controls.categoryDropdown = { x: currentX, y: currentY, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, currentY, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
            currentX += categoryDDWidth + gap;

            this.controls.presetDropdown = { x: currentX, y: currentY, w: presetDDWidth, h: 28 };
            const presetText = props.selectedPreset || "Select Preset...";
            this.drawDropdown(ctx, currentX, currentY, presetDDWidth, 28, presetText, this.hoverElement === 'presetDropdown');
        } else {
            const categoryDDWidth = availableWidth - iconBtnWidth - gap;
            this.controls.categoryDropdown = { x: currentX, y: currentY, w: categoryDDWidth, h: 28 };
            const categoryText = props.selectedCategory || "Category...";
            this.drawDropdown(ctx, currentX, currentY, categoryDDWidth, 28, categoryText, this.hoverElement === 'categoryDropdown');
        }
        this.controls.managePresetsBtn = { x: settingsBtnX, y: currentY, w: iconBtnWidth, h: 28 };
        this.drawButton(ctx, settingsBtnX, currentY, iconBtnWidth, 28, this.icons.settings, this.hoverElement === 'managePresetsBtn');

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
            message = "💡 FLUX Mode: Round to: 32px | Edge range: 320-2560px | Max resolution: 4.0 MP";
        } else if (category === "Flux.2" && props.useCustomCalc) {
            message = "💡 FLUX.2 Mode: Round to: 16px | Edge range: 320-3840px | Max resolution: 6.0 MP";
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
        } else if (props.useCustomCalc) {
            message = "⚠️ Calc Mode: Custom calculation not available for this category)";
        }
        
        if (message) {
           const paddingX = 10;
           const paddingTop = 8;
           const paddingBottom = 8;
           const lineHeight = 14;
           const maxWidth = node.size[0] - 40 - (paddingX * 2);
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
           ctx.fillStyle = "rgba(250, 165, 90, 0.15)";
           ctx.strokeStyle = "rgba(250, 165, 90, 0.5)";
           ctx.beginPath();
           ctx.roundRect(20, y, node.size[0] - 40, boxHeight, 4);
           ctx.fill();
           ctx.stroke();
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
        y = this.drawDimensionSlider(ctx, y, margin, w, "Width:", "widthSlider", 
            this.widthWidget.value, props.manual_slider_min_w, props.manual_slider_max_w, props.manual_slider_step_w);
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
    drawButton(ctx, x, y, w, h, content, hover = false, disabled = false, text = null, centerIconAndText = false) {
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
            let iconX, iconY;
            if (text) {
                if (centerIconAndText) {
                    ctx.font = "12px Arial";
                    const textWidth = ctx.measureText(text).width;
                    const gap = 4; 
                    const totalWidth = iconSize + gap + textWidth;
                    const startX = x + (w - totalWidth) / 2;
                    
                    iconX = startX;
                    iconY = y + (h - iconSize) / 2;
                } else {
                    const iconPadding = 4;
                    iconX = x + iconPadding;
                    iconY = y + (h - iconSize) / 2;
                }
            } else {
                iconX = x + (w - iconSize) / 2;
                iconY = y + (h - iconSize) / 2;
            }
            
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
            if (text) {
                ctx.fillStyle = disabled ? "#888" : "#ddd";
                ctx.font = "12px Arial";
                ctx.textBaseline = "middle";
                
                if (centerIconAndText) {
                    ctx.textAlign = "left";
                    const textWidth = ctx.measureText(text).width;
                    const gap = 4;
                    const totalWidth = iconSize + gap + textWidth;
                    const startX = x + (w - totalWidth) / 2;
                    const textX = startX + iconSize + gap;
                    ctx.fillText(text, textX, y + h / 2 + 1);
                } else {
                    ctx.textAlign = "center";
                    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
                }
            }
        }
    }
    
    drawSlider(ctx, x, y, w, h, value, min, max, step) {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.roundRect(x, y + h / 2 - 3, w, 6, 3);
        ctx.fill();
        const pos = Math.max(0, Math.min(1, (value - min) / (max - min)));
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
    
    drawValueAreaHoverBackground(ctx, controlName, x, y, w, h, color, borderRadius = 4) {
        if (this.hoverElement === controlName) {
            ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`;
            ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, borderRadius);
            ctx.fill();
            ctx.stroke();
        }
    }
    
    drawTooltip(ctx) {
        if (!this.tooltipMousePos || !this.tooltips[this.tooltipElement]) {
            log.debug("Tooltip draw failed: missing mouse pos or tooltip text");
            return;
        }
        
        const tooltipText = this.tooltips[this.tooltipElement];
        const paddingX = 8;
        const paddingTop = 8;
        const paddingBottom = 4; 
        const maxWidth = 250;
        const lineHeight = 16;
        ctx.font = "12px Arial";
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
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const tooltipWidth = Math.min(textWidth + paddingX * 2, maxWidth + paddingX * 2);
        const tooltipHeight = lines.length * lineHeight + paddingTop + paddingBottom;
        const mouseRelX = this.tooltipMousePos.x - this.node.pos[0];
        const mouseRelY = this.tooltipMousePos.y - this.node.pos[1];
        
        let tooltipX = mouseRelX + 15;
        let tooltipY = mouseRelY - tooltipHeight - 10;
        if (tooltipX + tooltipWidth > this.node.size[0] + 50) {
            tooltipX = mouseRelX - tooltipWidth - 15;
        }
        if (tooltipY < -50) {
            tooltipY = mouseRelY + 20;
        }
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.roundRect(tooltipX + 2, tooltipY + 2, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        const bgGrad = ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
        bgGrad.addColorStop(0, "rgba(45, 45, 45, 0.95)");
        bgGrad.addColorStop(1, "rgba(35, 35, 35, 0.95)");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        lines.forEach((line, index) => {
            ctx.fillText(line, tooltipX + paddingX, tooltipY + paddingTop + index * lineHeight);
        });
        
        ctx.restore();
    }
    handleMouseDown(e, pos, canvas) {
        const node = this.node;
        const props = node.properties;
        
        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        
        if (props.mode === "Manual") {
            if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
                node.capture = 'canvas2dRightHandle';
                node.captureInput(true);
                return true;
            }
            
            if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
                node.capture = 'canvas2dTopHandle';
                node.captureInput(true);
                return true;
            }
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
                    log.debug(`Detected ValueArea click: ${key}`);
                    if (key === 'latValueArea') {
                        this.showLatentTypeSelector(e);
                    } else {
                        this.dialogManager.showCustomValueDialog(key, e);
                    }
                    return true;
                }
                if (key.endsWith('Header')) {
                    this.handleSectionHeaderClick(key);
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
        
        if (node.capture === 'canvas2dRightHandle') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValueWidth(relX - c2d.x, c2d.w, e.ctrlKey);
            }
            return true;
        }
        
        if (node.capture === 'canvas2dTopHandle') {
            const c2d = this.controls.canvas2d;
            if (c2d) {
                this.updateCanvasValueHeight(relY - c2d.y, c2d.h, e.ctrlKey);
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
        if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
            newHover = 'canvas2dRightHandle';
        } else if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
            newHover = 'canvas2dTopHandle';
        } else {
            for (const element in this.controls) {
                if (element !== 'canvas2dRightHandle' && element !== 'canvas2dTopHandle' && 
                    this.isPointInControl(relX, relY, this.controls[element])) {
                    newHover = element;
                    break;
                }
            }
        }
        this.tooltipMousePos = { x: e.canvasX, y: e.canvasY };
        if (newHover !== this.hoverElement) {
            this.hoverElement = newHover;
            this.handleTooltipHover(newHover, e);
            app.graph.setDirtyCanvas(true);
        }
    }
    
    handleTooltipHover(element, e) {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.showTooltip) {
            this.showTooltip = false;
            this.tooltipElement = null;
            app.graph.setDirtyCanvas(true);
        }
        if (element && this.tooltips[element]) {
            const initialMousePos = { x: e.canvasX, y: e.canvasY };
            this.tooltipTimer = setTimeout(() => {
                this.tooltipElement = element;
                this.showTooltip = true;
                this.tooltipFixedPos = initialMousePos; 
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
            autoResizeBtn: () => this.handleAutoResize(),
            autoCalcBtn: () => this.handleAutoCalc(),
            detectedInfo: () => this.handleDetectedClick(),
            managePresetsBtn: () => this.handleManagePresets()
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
        } else if (checkboxName === 'autoResizeCheckbox') {
            props.autoResizeOnChange = !props.autoResizeOnChange;
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
    
    handleSectionHeaderClick(headerKey) {
        const sectionKey = headerKey.replace('Header', '');
        this.collapsedSections[sectionKey] = !this.collapsedSections[sectionKey];
        const propertyKey = `section_${sectionKey}_collapsed`;
        this.node.properties[propertyKey] = this.collapsedSections[sectionKey];
        app.graph.setDirtyCanvas(true, true);
        
        log.debug(`Section ${sectionKey} ${this.collapsedSections[sectionKey] ? 'collapsed' : 'expanded'}`);
    }
    getAllPresets() {
        return this.customPresetsManager.getMergedPresets(this.presetCategories);
    }
    
    validateWidgets() {
        return this.widthWidget && this.heightWidget;
    }
    
    setDimensions(width, height) {
        if (!this.validateWidgets()) return;
        this.node.properties.valueX = width;
        this.node.properties.valueY = height;
        this.widthWidget.value = width;
        this.heightWidget.value = height;
        this.handlePropertyChange();
        this.updateRescaleValue();

        this.updateCanvasFromWidgets();
        app.graph.setDirtyCanvas(true);
    }
    
    updateCanvasFromWidgets() {
        if (!this.validateWidgets()) return;
        
        const node = this.node;
        const props = node.properties;
        props.valueX = this.widthWidget.value;
        props.valueY = this.heightWidget.value;
        node.intpos.x = (this.widthWidget.value - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
        node.intpos.y = (this.heightWidget.value - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));
        this.updateRescaleValue();
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
        this.controls[config.buttonControl] = { x: currentX, y, w: layout.btnWidth, h: 28 };
        this.drawButton(ctx, currentX, y, layout.btnWidth, 28, config.icon, this.hoverElement === config.buttonControl);
        currentX += layout.btnWidth + layout.gap;
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
        const valueAreaControl = config.buttonControl.replace('Btn', 'ValueArea');
        this.controls[valueAreaControl] = { x: currentX, y, w: layout.valueWidth, h: 28 };
        
        this.drawValueAreaHoverBackground(ctx, valueAreaControl, currentX, y, layout.valueWidth, 28, [100, 150, 255]);
        this.setCanvasTextStyle(ctx, {
            fillStyle: this.hoverElement === valueAreaControl ? "#5af" : "#ccc",
            textAlign: "center"
        });
        ctx.fillText(config.displayValue, currentX + layout.valueWidth / 2, y + 14);
        currentX += layout.valueWidth + layout.gap;
        if (this.validateWidgets() && config.scaleFactor) {
            const newW = Math.round(this.widthWidget.value * config.scaleFactor);
            const newH = Math.round(this.heightWidget.value * config.scaleFactor);
            this.setCanvasTextStyle(ctx, { fillStyle: "#888", font: "11px Arial", textAlign: "left" });
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += layout.previewWidth + layout.gap;
        this.controls[config.radioControl] = { x: currentX, y: y + 5, w: layout.radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, layout.radioWidth,
                           props.rescaleMode === config.rescaleMode, this.hoverElement === config.radioControl);
    }
    updateCanvasValue(x, y, w, h, shiftKey, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        if (ctrlKey && shiftKey) {
            const currentAspect = this.widthWidget.value / this.heightWidget.value;
            
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            newX = Math.round(newX);
            newY = Math.round(newY);
            newY = Math.round(newX / currentAspect);
            vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        else if (shiftKey && !ctrlKey) {
            const currentAspect = this.widthWidget.value / this.heightWidget.value;
            
            let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vX = Math.round(vX / sX) * sX;
            newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
            newY = newX / currentAspect;
            vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
        }
        else if (ctrlKey && !shiftKey) {
        }
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
        if (props.valueX !== newX || props.valueY !== newY) {
            this.setDimensions(newX, newY);
        }
    }
    
    updateCanvasValueWidth(x, w, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vX = Math.max(0, Math.min(1, x / w));
        if (!ctrlKey) {
            let sX = props.canvas_step_x / (props.canvas_max_x - props.canvas_min_x);
            vX = Math.round(vX / sX) * sX;
        }
        
        node.intpos.x = vX;
        
        let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
        
        const rnX = Math.pow(10, props.canvas_decimals_x);
        newX = Math.round(rnX * newX) / rnX;
        this.setDimensions(newX, this.heightWidget.value);
        app.graph.setDirtyCanvas(true);
    }
    
    updateCanvasValueHeight(y, h, ctrlKey) {
        const node = this.node;
        const props = node.properties;
        
        let vY = Math.max(0, Math.min(1, 1 - y / h));
        if (!ctrlKey) {
            let sY = props.canvas_step_y / (props.canvas_max_y - props.canvas_min_y);
            vY = Math.round(vY / sY) * sY;
        }
        
        node.intpos.y = vY;
        
        let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
        
        const rnY = Math.pow(10, props.canvas_decimals_y);
        newY = Math.round(rnY * newY) / rnY;
        this.setDimensions(this.widthWidget.value, newY);
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
    
    showPresetSelector(e, mode) {
        const props = this.node.properties;
        const allPresets = this.getAllPresets();
        const presets = allPresets[props.selectedCategory];
        if (!presets) return;
        
        const commonCallback = (presetName) => {
            this.applyPreset(props.selectedCategory, presetName);
        };
        
        const commonModeChange = (newMode) => {
            props.preset_selector_mode = newMode;
            this.showPresetSelector(e, newMode);
        };
        
        if (mode === 'list') {
            const presetItems = Object.entries(presets)
                .filter(([name, dims]) => !dims.isHidden)  
                .map(([name, dims]) => {
                    const isCustom = this.customPresetsManager.isCustomPreset(props.selectedCategory, name);
                    return {
                        text: `${name} (${dims.width}×${dims.height})`,
                        isCustom: isCustom
                    };
                });
            
            this.searchableDropdown.show(presetItems, {
                event: e,
                title: 'Select Preset',
                currentMode: 'list',
                initialExpanded: props.dropdown_preset_expanded || false,
                onExpandedChange: (isExpanded) => {
                    props.dropdown_preset_expanded = isExpanded;
                },
                callback: (selectedItem) => {
                    const presetName = selectedItem.replace(/\s*\([^)]*\)$/, '');
                    commonCallback(presetName);
                },
                onModeChange: () => commonModeChange('visual')
            });
        } else {
            this.aspectRatioSelector.show(presets, {
                event: e,
                selectedPreset: props.selectedPreset,
                currentMode: 'visual',
                callback: commonCallback,
                onModeChange: () => commonModeChange('list')
            });
        }
    }
    
    showLatentTypeSelector(e) {
        if (!this.latentTypeWidget) {
            log.debug("Latent type selector: latent_type widget not found");
            return;
        }
        
        const currentValue = this.latentTypeWidget.value || 'latent_4x8';
        
        // Available latent types with descriptive names
        const latentTypes = [
            { text: '4x8 (Standard SD/SDXL/Flux)', value: 'latent_4x8' },
            { text: '128x16 (Flux.2)', value: 'latent_128x16' }
        ];
        
        const items = latentTypes.map(type => ({
            text: type.text,
            value: type.value,
            isCustom: type.value === currentValue // Highlight current selection
        }));
        
        this.searchableDropdown.show(items, {
            event: e,
            title: 'Select Latent Type',
            callback: (selectedText) => {
                // Find the selected type by its display text
                const selectedType = latentTypes.find(t => t.text === selectedText);
                if (selectedType && this.latentTypeWidget) {
                    this.latentTypeWidget.value = selectedType.value;
                    log.debug(`Latent type manually changed to: ${selectedType.value}`);
                    app.graph.setDirtyCanvas(true);
                }
            }
        });
    }
    
    showDropdownMenu(dropdownName, e) {
        const props = this.node.properties;
        let items, callback, title, propertyKey;
        
        if (dropdownName === 'categoryDropdown') {
            const allPresets = this.getAllPresets();
            items = Object.keys(allPresets)
                .filter(categoryName => {
                    const categoryPresets = allPresets[categoryName];
                    const hasVisiblePresets = Object.values(categoryPresets).some(preset => !preset.isHidden);
                    
                    return hasVisiblePresets;
                })
                .map(categoryName => {
                    const isCustomCategory = this.customPresetsManager.categoryExists(categoryName);
                    return {
                        text: categoryName,
                        isCustom: isCustomCategory
                    };
                });
            
            title = 'Select Category';
            propertyKey = 'dropdown_category_expanded';
            callback = (value) => {
                props.selectedCategory = value;
                props.selectedPreset = null;
                // Latent type is now manually controlled via LAT selector - no automatic change
                app.graph.setDirtyCanvas(true);
            };
        } else if (dropdownName === 'presetDropdown' && props.selectedCategory) {
            const selectorMode = props.preset_selector_mode || 'visual';
            this.showPresetSelector(e, selectorMode);
            return;
        } else if (dropdownName === 'resolutionDropdown') {
            items = this.resolutions;
            title = 'Select Resolution';
            propertyKey = 'dropdown_resolution_expanded';
            callback = (value) => {
                let resolutionValue = value.trim();
                if (!resolutionValue.endsWith('p')) {
                    resolutionValue = resolutionValue + 'p';
                }
                props.targetResolution = parseInt(resolutionValue);
                if (props.rescaleMode === 'resolution') this.updateRescaleValue();
                app.graph.setDirtyCanvas(true);
            };
        }
        
        if (items?.length && propertyKey) {
            this.searchableDropdown.show(items, { 
                event: e, 
                callback, 
                title,
                allowCustomValues: dropdownName === 'resolutionDropdown',
                initialExpanded: props[propertyKey] || false,
                onExpandedChange: (isExpanded) => {
                    props[propertyKey] = isExpanded;
                }
            });
        }
    }
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
        if (resetValue) {
            resetValue();
        }
        
        this.setDimensions(newWidth, newHeight);
    }

    handleScale() {
        this.applyScaling(() => this.node.properties.upscaleValue);
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
        const currentWidth = this.widthWidget.value;
        const currentHeight = this.heightWidget.value;
        this.applyAutoFit(currentWidth, currentHeight, props.useCustomCalc, category, 'current');
    }
    applyAutoFit(width, height, useCalc, category, source = 'detected') {
        const props = this.node.properties;
        
        if (!this.widthWidget || !this.heightWidget) return;
        
        const closestPreset = this.findClosestPreset(width, height, category);
        
        if (!closestPreset) return;
        
        let finalWidth, finalHeight;
        
        if (useCalc) {
            const presetAspect = closestPreset.width / closestPreset.height;
            const currentAspect = width / height;
            if (Math.abs(currentAspect - presetAspect) < 0.01) {
                const result = this.applyCustomCalculation(width, height, category);
                finalWidth = result.width;
                finalHeight = result.height;
                log.debug(`Auto-fit with calc (${source}): ${closestPreset.name} has matching aspect ratio. Using ${finalWidth}x${finalHeight} (from ${width}x${height})`);
            } else {
                const scaledDimensions = this.scaleToPresetAspectRatio(width, height, presetAspect);
                const result = this.applyCustomCalculation(scaledDimensions.width, scaledDimensions.height, category);
                finalWidth = result.width;
                finalHeight = result.height;
                log.debug(`Auto-fit with calc (${source}): ${closestPreset.name} different aspect. Scaled to ${finalWidth}x${finalHeight} (from ${width}x${height})`);
            }
        } else {
            finalWidth = closestPreset.width;
            finalHeight = closestPreset.height;
            log.debug(`Auto-fit preset only (${source}): ${closestPreset.name} (${finalWidth}x${finalHeight}) for input ${width}x${height}`);
        }
        
        props.selectedPreset = closestPreset.name;
        this.setDimensions(finalWidth, finalHeight);
    }
    
    handleAutoCalc() {
        const props = this.node.properties;
        
        if (!props.useCustomCalc || !props.selectedCategory) {
            log.debug("Auto-calc: Calc checkbox or category not selected");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-calc: Width or height widget not found");
            return;
        }
        const currentWidth = this.widthWidget.value;
        const currentHeight = this.heightWidget.value;
        const result = this.applyCustomCalculation(currentWidth, currentHeight, props.selectedCategory);
        this.setDimensions(result.width, result.height);
        
        log.debug(`Auto-calc applied: ${currentWidth}x${currentHeight} → ${result.width}x${result.height} (${props.selectedCategory})`);
    }
    
    handleAutoResize() {
        const props = this.node.properties;
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Auto-Resize: Width or height widget not found");
            return;
        }
        if (props.rescaleMode === 'manual') {
            this.handleScale();
            log.debug(`Auto-Resize: Applied manual scaling with factor ${props.upscaleValue}`);
        } else if (props.rescaleMode === 'resolution') {
            this.handleResolutionScale();
            log.debug(`Auto-Resize: Applied resolution scaling to ${props.targetResolution}p`);
        } else if (props.rescaleMode === 'megapixels') {
            this.handleMegapixelsScale();
            log.debug(`Auto-Resize: Applied megapixels scaling to ${props.targetMegapixels}MP`);
        }
    }
    
    handleDetectedClick() {
        if (!this.detectedDimensions) {
            log.debug("Detected click: No detected dimensions available");
            return;
        }
        
        if (!this.widthWidget || !this.heightWidget) {
            log.debug("Detected click: Width or height widget not found");
            return;
        }
        this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
        
        log.debug(`Detected click applied: Set dimensions to ${this.detectedDimensions.width}x${this.detectedDimensions.height}`);
    }
    
    handleManagePresets() {
        log.debug("Manage Presets button clicked - opening dialog");
        this.presetManagerDialog.show();
    }
    
    applyDimensionChange() {
        const props = this.node.properties;
        let { value: width } = this.widthWidget;
        let { value: height } = this.heightWidget;

        if (props.useCustomCalc && props.selectedCategory) {
            ({ width, height } = this.applyCustomCalculation(width, height, props.selectedCategory));
        }

        // Removed canvas min/max clamping - allow presets to set any resolution
        this.setDimensions(width, height);
    }

    applyPreset(category, presetName) {
        const props = this.node.properties;
        const allPresets = this.getAllPresets();
        const preset = allPresets[category]?.[presetName];
        if (!preset) return;
        
        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = preset.width;
            this.heightWidget.value = preset.height;
            props.selectedPreset = presetName;
            this.applyDimensionChange();
            this.updateCanvasFromWidgets();
        }
    }
    applyCustomCalculation(width, height, category) {
        const calculations = {
            Flux: () => this.applyFluxCalculation(width, height),
            'Flux.2': () => this.applyFlux2Calculation(width, height),
            WAN: () => this.applyWANCalculation(width, height),
            'Qwen-Image': () => this.applyQwenCalculation(width, height),
            'SDXL': () => this.findBestPresetForCategory(width, height, 'SDXL'),
            'HiDream Dev': () => this.findBestPresetForCategory(width, height, 'HiDream Dev'),
            'Standard': () => this.scaleToNearestPresetAspectRatio(width, height, 'Standard'),
            'Social Media': () => this.scaleToNearestPresetAspectRatio(width, height, 'Social Media'),
            'Print': () => this.scaleToNearestPresetAspectRatio(width, height, 'Print'),
            'Cinema': () => this.scaleToNearestPresetAspectRatio(width, height, 'Cinema'),
            'Display Resolutions': () => this.scaleToNearestPresetAspectRatio(width, height, 'Display Resolutions')
        };
        return calculations[category] ? calculations[category]() : { width, height };
    }
    
    findBestPresetForCategory(width, height, category) {
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
            if (Math.abs(currentAspect - presetAspect) < 0.01) {
                log.debug(`Calc for ${category}: Preset ${closestPreset.name} has matching aspect ratio (${presetAspect.toFixed(2)}). Keeping current size ${width}x${height}`);
                return { width, height };
            }
            const result = this.scaleToPresetAspectRatio(width, height, presetAspect);
            
            log.debug(`Calc for ${category}: Found preset ${closestPreset.name}. Scaling ${width}x${height} -> ${result.width}x${result.height} with aspect ${presetAspect.toFixed(2)}`);
            return result;
        }
        
        return { width, height };
    }
    findClosestPreset(width, height, category, options = {}) {
        const allPresets = this.getAllPresets();
        const presets = allPresets[category];
        if (!presets) return null;

        let closestPreset = null;
        let closestAspectDiff = Infinity;
        let closestPixelDiff = Infinity;
        
        const inputAspect = width / height;
        const inputPixels = width * height;
        
        Object.entries(presets).forEach(([presetName, preset]) => {
            const orientations = [
                { width: preset.width, height: preset.height, flipped: false },
                { width: preset.height, height: preset.width, flipped: true }
            ];
            
            orientations.forEach(orientation => {
                const presetAspect = orientation.width / orientation.height;
                const presetPixels = orientation.width * orientation.height;
                const aspectDiff = Math.abs(inputAspect - presetAspect);
                if (aspectDiff < closestAspectDiff || (Math.abs(aspectDiff - closestAspectDiff) < 0.01)) {
                    if (aspectDiff < 0.01 || aspectDiff < closestAspectDiff) {
                        const pixelDiff = Math.abs(Math.log(inputPixels / presetPixels));
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
    chooseBestScalingOption(currentPixels, option1Pixels, option2Pixels, option1Dims, option2Dims) {
        const option1Diff = Math.abs(option1Pixels - currentPixels);
        const option2Diff = Math.abs(option2Pixels - currentPixels);
        
        if (option1Diff <= option2Diff) {
            return option1Dims;
        } else {
            return option2Dims;
        }
    }

    scaleToPresetAspectRatio(currentWidth, currentHeight, presetAspect) {
        const currentPixels = currentWidth * currentHeight;
        const option1Width = currentWidth;
        const option1Height = Math.round(currentWidth / presetAspect);
        const option1Pixels = option1Width * option1Height;
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
    applyFluxLikeCalculation(width, height, maxMP, maxDim, minDim, multiple) {
        const currentMP = (width * height) / 1000000;
        let w = width, h = height;
        if (currentMP > maxMP) {
            const scale = Math.sqrt(maxMP / currentMP);
            w *= scale; h *= scale;
        }
        const maxD = Math.max(w, h);
        if (maxD > maxDim) { const s = maxDim / maxD; w *= s; h *= s; }
        
        const minD = Math.min(w, h);
        if (minD < minDim) { const s = minDim / minD; w *= s; h *= s; }
        return {
            width: Math.max(minDim, Math.min(maxDim, Math.round(w / multiple) * multiple)),
            height: Math.max(minDim, Math.min(maxDim, Math.round(h / multiple) * multiple))
        };
    }
    
    applyFluxCalculation(width, height) {
        return this.applyFluxLikeCalculation(width, height, 4.0, 2560, 320, 32);
    }
    
    applyFlux2Calculation(width, height) {
        return this.applyFluxLikeCalculation(width, height, 6.0, 3840, 320, 16);
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
        const minPixels = 589824;  
        const maxPixels = 4194304; 
        if (currentPixels >= minPixels && currentPixels <= maxPixels) {
            return { width, height };
        } else {
            let targetPixels;
            
            if (currentPixels < minPixels) {
                targetPixels = minPixels;
            } else {
                targetPixels = maxPixels;
            }
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
        const rescaleValueWidget = this.node.widgets?.find(w => w.name === 'rescale_value');
        if (rescaleValueWidget) {
            rescaleValueWidget.value = value;
        }
        const rescaleModeWidget = this.node.widgets?.find(w => w.name === 'rescale_mode');
        if (rescaleModeWidget) {
            rescaleModeWidget.value = props.rescaleMode;
        }
    }
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
                    if (props.autoDetect && !props.autoFitOnChange && !props.useCustomCalc) {
                        if (this.widthWidget && this.heightWidget) {
                            this.widthWidget.value = this.detectedDimensions.width;
                            this.heightWidget.value = this.detectedDimensions.height;
                            this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
                        }
                    }
                    else if (props.autoFitOnChange && !props.useCustomCalc && props.selectedCategory) {
                        this.applyAutoFit(this.detectedDimensions.width, this.detectedDimensions.height, false, props.selectedCategory, 'detected');
                    }
                    else if (props.autoFitOnChange && props.useCustomCalc && props.selectedCategory) {
                        this.applyAutoFit(this.detectedDimensions.width, this.detectedDimensions.height, true, props.selectedCategory, 'detected');
                    }
                    else if (props.autoDetect && !props.autoFitOnChange && props.useCustomCalc && props.selectedCategory) {
                        if (this.widthWidget && this.heightWidget) {
                            this.widthWidget.value = this.detectedDimensions.width;
                            this.heightWidget.value = this.detectedDimensions.height;
                            this.applyDimensionChange(); 
                        }
                    }
                    else if (props.autoDetect && this.widthWidget && this.heightWidget) {
                        this.widthWidget.value = this.detectedDimensions.width;
                        this.heightWidget.value = this.detectedDimensions.height;
                        this.setDimensions(this.detectedDimensions.width, this.detectedDimensions.height);
                    }
                    if (props.autoResizeOnChange) {
                        this.handleAutoResize();
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
