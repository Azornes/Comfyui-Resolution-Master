import { aspectRatioString } from "../canvas/aspect_ratio_math.js";
import { formatClosestPResolution } from "../scaling/scaling_math.js";
import { createModuleLogger } from "../log_system/log_funcs.js";
import { performanceDiagnostics } from "../utils/performance_diagnostics.js";

const log = createModuleLogger("resolution_master_draw_methods");

export const drawingMethods = {
    drawInterface(ctx) {
        const diagnosticsToken = performanceDiagnostics.start("drawInterface");
        try {
            const node = this.node;
            const props = node.properties;
            const margin = 10;
            const spacing = this.getManualSpacing();

            let currentY = this.getManualContentStartY();

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

                const canvasHeight = this.getManualCanvasHeight(currentY);
                const canvasPadding = this.collapsedSections.extraControls ? 8 : 20;
                this.draw2DCanvas(ctx, margin, currentY, node.size[0] - margin * 2, canvasHeight, canvasPadding);
                currentY += canvasHeight + this.getCanvasInfoGap();

                const infoY = this.lastCanvasBounds
                    ? this.lastCanvasBounds.y + this.lastCanvasBounds.h + 18
                    : currentY;
                this.drawInfoText(ctx, infoY);
                currentY += 15 + spacing;

                if (this.collapsedSections.extraControls) {
                } else {
                    collapsibleSection("Actions", "actions", (ctx, y, preview) => {
                        if (!preview) this.drawPrimaryControls(ctx, y);
                        return 30;
                    });

                    collapsibleSection("Scaling", "scaling", (ctx, y, preview) => {
                        if (!preview) return this.drawScalingGrid(ctx, y);
                        return 130;
                    });

                    collapsibleSection("Auto-Detect", "autoDetect", (ctx, y, preview) => {
                        if (!preview) return this.drawAutoDetectSection(ctx, y);
                        return 110;
                    });

                    collapsibleSection("Presets", "presets", (ctx, y, preview) => {
                        if (!preview) return this.drawPresetSection(ctx, y);
                        return 30;
                    });
                    if (props.showCalcInfo && props.selectedCategory) {
                        const messageHeight = this.drawInfoMessage(ctx, currentY);
                        if (messageHeight > 0) {
                            currentY += messageHeight + spacing;
                        }
                    }
                    this.drawOutputValues(ctx);
                }
                this.drawCompactToggleButton(ctx);

            } else if (props.mode === "Manual Sliders") {
                this.drawSliderMode(ctx, currentY);
            }

            if (this.showTooltip && this.tooltipElement && this.tooltips[this.tooltipElement]) {
                this.drawTooltip(ctx);
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

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
    },

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
    },

    drawCompactToggleButton(ctx) {
        const isActive = this.collapsedSections.extraControls || false;
        const buttonSize = 18;
        const x = this.node.size[0] - buttonSize - 9;
        const y = -LiteGraph.NODE_TITLE_HEIGHT + 5;
        const helpX = x - buttonSize - 6;
        this.controls.compactHelpBtn = { x: helpX, y, w: buttonSize, h: buttonSize };
        this.controls.compactToggleBtn = { x, y, w: buttonSize, h: buttonSize };

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = this.hoverElement === 'compactHelpBtn'
            ? "rgba(255,255,255,0.65)"
            : "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(helpX, y, buttonSize, buttonSize, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.hoverElement === 'compactHelpBtn' ? "#fff" : "#cfcfcf";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", helpX + buttonSize / 2, y + buttonSize / 2 + 0.5);

        ctx.fillStyle = isActive ? "rgba(90, 170, 255, 0.45)" : "rgba(255,255,255,0.08)";
        ctx.strokeStyle = this.hoverElement === 'compactToggleBtn'
            ? "rgba(255,255,255,0.65)"
            : isActive ? "rgba(120, 190, 255, 0.85)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, buttonSize, buttonSize, 5);
        ctx.fill();
        ctx.stroke();

        const label = isActive ? "+" : "-";
        ctx.fillStyle = this.hoverElement === 'compactToggleBtn' || isActive ? "#fff" : "#cfcfcf";
        ctx.font = isActive ? "bold 13px Arial" : "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const metrics = ctx.measureText(label);
        const minusOffsetY = isActive ? 0 : 0.4;
        const textY = y + buttonSize / 2 - (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / 2 + metrics.actualBoundingBoxAscent + minusOffsetY;
        ctx.fillText(label, x + buttonSize / 2, textY);
    },

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
            this.drawOutputValueArea(ctx, 'widthValueArea', valueAreaX, y_offset_1 - valueAreaHeight/2,
                valueAreaWidth, valueAreaHeight, this.widthWidget.value.toString(), y_offset_1,
                [136, 153, 255], "#89F", "#89F");
            this.drawOutputValueArea(ctx, 'heightValueArea', valueAreaX, y_offset_2 - valueAreaHeight/2,
                valueAreaWidth, valueAreaHeight, this.heightWidget.value.toString(), y_offset_2,
                [248, 136, 153], "#F89", "#F89");
            ctx.fillStyle = "#9F8";
            ctx.fillText(props.rescaleValue.toFixed(2), node.size[0] - 20, y_offset_3);
            this.drawOutputValueArea(ctx, 'batchSizeValueArea', batchSizeAreaX, y_offset_4 - valueAreaHeight/2,
                batchSizeAreaWidth, valueAreaHeight, this.batchSizeWidget.value.toString(), y_offset_4,
                [255, 136, 187], "#FAB", "#F8B");
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
    },

    drawOutputValueArea(ctx, controlName, x, y, w, h, text, textY, hoverColor, activeTextColor, textColor) {
        const node = this.node;
        this.controls[controlName] = { x, y, w, h };
        this.drawValueAreaHoverBackground(ctx, controlName, x, y, w, h, hoverColor);
        ctx.fillStyle = this.hoverElement === controlName ? activeTextColor : textColor;
        ctx.fillText(text, node.size[0] - 20, textY);
    },

    drawPrimaryControls(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const buttonWidth = 70;
        const gap = 5;
        const snapSliderGap = 14;
        let x = margin;

        this.controls.swapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.swap, this.hoverElement === 'swapBtn', false, "Swap", true);
        x += buttonWidth + gap;

        this.controls.snapBtn = { x, y, w: buttonWidth, h: 28 };
        this.drawButton(ctx, x, y, buttonWidth, 28, this.icons.snap, this.hoverElement === 'snapBtn', false, "Snap", true);
        x += buttonWidth + snapSliderGap;

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
    },

    draw2DCanvas(ctx, x, y, w, h, padding = 20) {
        const diagnosticsToken = performanceDiagnostics.start("draw2DCanvas");
        try {
            const node = this.node;
            const props = node.properties;

            this.controls.canvas2d = { x, y, w, h };

            const rangeX = Math.max(1, props.canvas_max_x - props.canvas_min_x);
            const rangeY = Math.max(1, props.canvas_max_y - props.canvas_min_y);
            const aspectRatio = rangeX / rangeY;

            let canvasW = w - padding;
            let canvasH = h - padding;

            if (aspectRatio > canvasW / canvasH) {
                canvasH = canvasW / aspectRatio;
            } else {
                canvasW = canvasH * aspectRatio;
            }

            const offsetX = x + (w - canvasW) / 2;
            const offsetY = y + (h - canvasH) / 2;

            this.controls.canvas2d = { x: offsetX, y: offsetY, w: canvasW, h: canvasH };
            this.lastCanvasBounds = this.controls.canvas2d;

            ctx.fillStyle = "rgba(20,20,20,0.8)";
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(offsetX - 4, offsetY - 4, canvasW + 8, canvasH + 8, 6);
            ctx.fill();
            ctx.stroke();

            if (props.canvas_dots) {
                this.drawCachedCanvasDots(ctx, offsetX, offsetY, canvasW, canvasH, rangeX, rangeY);
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
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    drawCachedCanvasDots(ctx, offsetX, offsetY, canvasW, canvasH, rangeX, rangeY) {
        const cache = this.getCanvasDotsCache(canvasW, canvasH, rangeX, rangeY);
        if (!cache?.path) return;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fill(cache.path);
        ctx.restore();
    },

    getCanvasDotsCache(canvasW, canvasH, rangeX, rangeY) {
        const props = this.node.properties;
        if (![canvasW, canvasH, rangeX, rangeY].every(value => Number.isFinite(value) && value > 0)) {
            return null;
        }

        const cacheW = Math.max(1, canvasW);
        const cacheH = Math.max(1, canvasH);
        const stepX = Math.max(Number(props.canvas_step_x) || 1, 1);
        const stepY = Math.max(Number(props.canvas_step_y) || 1, 1);
        const signature = [
            cacheW.toFixed(3),
            cacheH.toFixed(3),
            props.canvas_min_x,
            props.canvas_max_x,
            props.canvas_min_y,
            props.canvas_max_y,
            stepX,
            stepY
        ].join("|");

        if (this.canvasDotsCache?.signature === signature) {
            return this.canvasDotsCache;
        }

        if (typeof Path2D === "undefined") {
            return null;
        }

        const gridXs = [];
        const gridYs = [];
        const addUniqueGridPoint = (points, point) => {
            const previousPoint = points[points.length - 1];
            if (previousPoint === undefined || Math.abs(previousPoint - point) >= 0.5) {
                points.push(point);
            }
        };

        for (let valueX = props.canvas_min_x; valueX <= props.canvas_max_x; valueX += stepX) {
            const ratioX = (valueX - props.canvas_min_x) / rangeX;
            addUniqueGridPoint(gridXs, cacheW * ratioX);
        }

        for (let valueY = props.canvas_min_y; valueY <= props.canvas_max_y; valueY += stepY) {
            const ratioY = (valueY - props.canvas_min_y) / rangeY;
            addUniqueGridPoint(gridYs, cacheH * (1 - ratioY));
        }

        const dotPath = new Path2D();
        for (const dotX of gridXs) {
            for (const dotY of gridYs) {
                dotPath.rect(dotX - 0.5, dotY - 0.5, 1, 1);
            }
        }

        this.canvasDotsCache = { signature, path: dotPath };
        return this.canvasDotsCache;
    },

    drawInfoText(ctx, y) {
        const node = this.node;
        if (this.widthWidget && this.heightWidget) {
            const width = this.widthWidget.value;
            const height = this.heightWidget.value;
            const mp = ((width * height) / 1000000).toFixed(2);
            const pResolution = formatClosestPResolution(width, height);

            const aspectRatio = aspectRatioString(width, height);

            ctx.fillStyle = "#bbb";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${width} × ${height}  |  ${mp} MP ${pResolution}  |  ${aspectRatio}`,
                        node.size[0] / 2, y);
        }
    },

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
    },

    drawScalingGrid(ctx, y) {
        const margin = 20;
        const props = this.node.properties;
        this.drawScalingRowBase(ctx, margin, y, {
            buttonControl: 'scaleBtn', mainControl: 'scaleSlider', radioControl: 'upscaleRadio',
            controlType: 'slider', icon: this.icons.upscale, valueProperty: 'upscaleValue',
            min: props.scaling_slider_min, max: props.scaling_slider_max, step: props.scaling_slider_step,
            displayValue: props.upscaleValue.toFixed(1) + "x",
            previewDimensions: this.calculateScalingPreview('manual'),
            rescaleMode: 'manual'
        });
        const resScale = this.calculateScaleFactor('resolution');
        this.drawScalingRowBase(ctx, margin, y + 35, {
            buttonControl: 'resolutionBtn', mainControl: 'resolutionDropdown', radioControl: 'resolutionRadio',
            controlType: 'dropdown', icon: this.icons.resolution, selectedText: `${props.targetResolution}p`,
            displayValue: `×${resScale.toFixed(2)}`,
            previewDimensions: this.calculateScalingPreview('resolution'),
            rescaleMode: 'resolution'
        });
        const mpScale = this.calculateScaleFactor('megapixels');
        this.drawScalingRowBase(ctx, margin, y + 70, {
            buttonControl: 'megapixelsBtn', mainControl: 'megapixelsSlider', radioControl: 'megapixelsRadio',
            controlType: 'slider', icon: this.icons.megapixels, valueProperty: 'targetMegapixels',
            min: props.megapixels_slider_min, max: props.megapixels_slider_max, step: props.megapixels_slider_step,
            displayValue: `${props.targetMegapixels.toFixed(1)}MP`,
            previewDimensions: this.calculateScalingPreview('megapixels'),
            rescaleMode: 'megapixels'
        });

        const checkboxSize = 18;
        const ratioY = y + 105;
        const checkboxLabel = "Prioritize ratio";
        ctx.font = "12px Arial";
        const labelWidth = ctx.measureText(checkboxLabel).width;
        const checkboxGap = 6;
        const groupWidth = checkboxSize + checkboxGap + labelWidth;
        const checkboxX = margin + (this.node.size[0] - margin * 2 - groupWidth) / 2;
        this.controls.preserveScalingRatioCheckbox = { x: checkboxX, y: ratioY + 3, w: checkboxSize, h: checkboxSize };
        this.drawCheckbox(ctx, checkboxX, ratioY + 3, checkboxSize, props.preserveScalingRatio, this.hoverElement === 'preserveScalingRatioCheckbox');
        ctx.fillStyle = this.hoverElement === 'preserveScalingRatioCheckbox' ? "#5af" : "#ccc";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(checkboxLabel, checkboxX + checkboxSize + checkboxGap, ratioY + 12);

        return 130;
    },

    drawAutoDetectSection(ctx, y) {
        const node = this.node;
        const props = node.properties;
        const margin = 20;
        const availableWidth = node.size[0] - margin * 2;
        const gap = 6;
        const toggleWidth = 140;
        const checkboxWidth = 18;

        let currentY = y;
        this.controls.autoDetectToggle = { x: margin, y: currentY, w: toggleWidth, h: 28 };
        this.drawToggle(ctx, margin, currentY, toggleWidth, 28, props.autoDetect,
                       props.autoDetect ? "Auto-detect ON" : "Auto-detect OFF",
                       this.hoverElement === 'autoDetectToggle');

        const liveStatus = this.getAutoDetectLiveStatus();
        const infoX = margin + toggleWidth + gap;
        const infoWidth = availableWidth - toggleWidth - gap;
        const statusOnly = !(props.autoDetect && this.detectedDimensions);
        this.controls.autoDetectLiveStatus = {
            x: infoX,
            y: currentY + 2,
            w: infoWidth,
            h: statusOnly ? 24 : 11
        };
        ctx.fillStyle = liveStatus.textColor;
        ctx.font = statusOnly ? "11px Arial" : "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(liveStatus.text, infoX + infoWidth / 2, currentY + (statusOnly ? 14 : 8));

        if (props.autoDetect && this.detectedDimensions) {
            const detectedText = `Detected: ${this.detectedDimensions.width}x${this.detectedDimensions.height}`;
            const detectedX = infoX;
            const detectedWidth = infoWidth;
            this.controls.detectedInfo = { x: detectedX, y: currentY + 13, w: detectedWidth, h: 13 };

            this.drawValueAreaHoverBackground(ctx, 'detectedInfo', detectedX, currentY + 13, detectedWidth, 12, [95, 255, 95], 3);

            ctx.fillStyle = this.hoverElement === 'detectedInfo' ? "#7f7" : "#5f5";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(detectedText, detectedX + detectedWidth / 2, currentY + 21);
        }

        currentY += 35;

        const actionGap = 8;
        const rowGap = 6;
        const actionWidth = (availableWidth - actionGap) / 2;
        const actionButtonWidth = actionWidth - checkboxWidth - 4;
        const smartToggleWidth = 56;
        const showToggleWidth = 56;
        const actionTextOffset = 8;
        const calcEnabled = !!props.selectedCategory;
        const actions = [
            { button: 'autoFitBtn', checkbox: 'autoFitCheckbox', icon: this.icons.autoFit, label: 'Fit', checked: props.autoFitOnChange, disabled: !props.selectedCategory, col: 0, row: 0, showSmartToggle: true },
            { button: 'autoResizeBtn', checkbox: 'autoResizeCheckbox', icon: this.icons.autoResize, label: 'Resize', checked: props.autoResizeOnChange, disabled: false, col: 0, row: 1 },
            { button: 'autoSnapBtn', checkbox: 'autoSnapCheckbox', icon: this.icons.snap, label: 'Snap', checked: props.autoSnapOnChange, disabled: false, col: 1, row: 0 },
            { button: 'autoCalcBtn', checkbox: 'customCalcCheckbox', icon: this.icons.autoCalculate, label: 'Calc', checked: props.useCustomCalc, disabled: !calcEnabled, col: 1, row: 1, showInfoToggle: true }
        ];

        actions.forEach((action) => {
            const x = margin + action.col * (actionWidth + actionGap);
            const actionY = currentY + action.row * (28 + rowGap);
            const buttonWidth = action.showInfoToggle
                ? actionWidth - checkboxWidth - showToggleWidth - 8
                : action.showSmartToggle
                    ? actionWidth - checkboxWidth - smartToggleWidth - 8
                    : actionButtonWidth;
            this.controls[action.button] = { x, y: actionY, w: buttonWidth, h: 28 };
            this.drawButton(ctx, x, actionY, buttonWidth, 28, action.icon, this.hoverElement === action.button, action.disabled, action.label, false, actionTextOffset);

            if (action.showSmartToggle) {
                const toggleX = x + buttonWidth + 4;
                this.controls.smartFitToggle = { x: toggleX, y: actionY + 3, w: smartToggleWidth, h: 22 };
                const previousAlpha = ctx.globalAlpha;
                if (action.disabled) ctx.globalAlpha = 0.5;
                this.drawToggle(ctx, toggleX, actionY + 3, smartToggleWidth, 22, props.smartFit, "Smart", this.hoverElement === 'smartFitToggle');
                ctx.globalAlpha = previousAlpha;

                this.drawAutoDetectActionCheckbox(ctx, action, toggleX + smartToggleWidth + 4, actionY, checkboxWidth);
            } else if (action.showInfoToggle) {
                const toggleX = x + buttonWidth + 4;
                this.controls.calcInfoToggle = { x: toggleX, y: actionY + 3, w: showToggleWidth, h: 22 };
                const previousAlpha = ctx.globalAlpha;
                if (action.disabled) ctx.globalAlpha = 0.5;
                this.drawToggle(ctx, toggleX, actionY + 3, showToggleWidth, 22, props.showCalcInfo, "Show", this.hoverElement === 'calcInfoToggle');
                ctx.globalAlpha = previousAlpha;

                this.drawAutoDetectActionCheckbox(ctx, action, toggleX + showToggleWidth + 4, actionY, checkboxWidth);
            } else {
                this.drawAutoDetectActionCheckbox(ctx, action, x + buttonWidth + 4, actionY, checkboxWidth);
            }
        });

        return 110;
    },

    drawAutoDetectActionCheckbox(ctx, action, x, y, size) {
        this.controls[action.checkbox] = { x, y: y + 5, w: size, h: 18 };
        this.drawCheckbox(ctx, x, y + 5, size, action.checked, this.hoverElement === action.checkbox, action.disabled);
    },

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
    },

    getCalcInfoMessage() {
        const props = this.node.properties;
        const category = props.selectedCategory;

        if (category === "SDXL") {
            return "💡 SDXL Mode: Uses the closest SDXL preset size.";
        } else if (category === "Flux") {
            return "💡 FLUX Mode: Round to: 32px | Edge range: 320-2560px | Max resolution: 4.0 MP";
        } else if (category === "Flux.2") {
            return "💡 FLUX.2 Mode: Round to: 16px | Edge range: 320-3840px | Max resolution: 6.0 MP";
        } else if (category === "WAN" && this.widthWidget && this.heightWidget) {
            const pixels = this.widthWidget.value * this.heightWidget.value;
            const model = pixels < 600000 ? "480p" : "720p";
            return `💡 WAN Mode: Suggesting ${model} model | Round to: 16px | Resolution range: 320p-820p`;
        } else if (category === "HiDream Dev") {
            return "💡 HiDream Dev: Uses the closest HiDream Dev preset size.";
        } else if (category === "Qwen-Image") {
            return "💡 Qwen-Image: Resolution range: ~0.6MP-4.2MP. If input is already in this range, it remains unchanged.";
        } else if (['Standard', 'Social Media', 'Print', 'Cinema', 'Display Resolutions'].includes(category)) {
            return "💡 Calc Mode: Uses the closest preset aspect ratio while keeping the size close to your current resolution.";
        }
        return "⚠️ Calc Mode: Custom calculation not available for this category)";
    },

    getMeasureContext() {
        if (!this.measureContext && typeof document !== "undefined") {
            this.measureContext = document.createElement("canvas").getContext("2d");
        }
        return this.measureContext;
    },

    measureCalcInfoMessage(ctx = null) {
        const message = this.getCalcInfoMessage();
        if (!message) return { boxHeight: 0 };

        const measureCtx = ctx || this.getMeasureContext();
        const paddingX = 10;
        const paddingTop = 8;
        const paddingBottom = 8;
        const lineHeight = 14;
        const maxWidth = this.node.size[0] - 40 - (paddingX * 2);
        const words = message.split(' ');
        const lines = [];
        let currentLine = '';

        if (measureCtx) measureCtx.font = "11px Arial";
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = measureCtx ? measureCtx.measureText(testLine).width : testLine.length * 6;
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        return { boxHeight: lines.length * lineHeight + paddingTop + paddingBottom, lines, paddingTop, lineHeight };
    },

    drawInfoMessage(ctx, y) {
        const node = this.node;
        const { boxHeight, lines = [], paddingTop = 8, lineHeight = 14 } = this.measureCalcInfoMessage(ctx);
        if (boxHeight > 0) {
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
    },

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
    },

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
    },

    drawButton(ctx, x, y, w, h, content, hover = false, disabled = false, text = null, centerIconAndText = false, textOffset = 0) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (disabled) {
            grad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
            grad.addColorStop(1, "rgba(255, 255, 255, 0.08)");
        } else if (hover) {
            grad.addColorStop(0, "rgba(255, 255, 255, 0.30)");
            grad.addColorStop(1, "rgba(255, 255, 255, 0.24)");
        } else {
            grad.addColorStop(0, "rgba(255, 255, 255, 0.24)");
            grad.addColorStop(1, "rgba(255, 255, 255, 0.18)");
        }
        ctx.fillStyle = grad;
        ctx.strokeStyle = disabled
            ? "rgba(0, 0, 0, 0.28)"
            : hover
                ? "rgba(255, 255, 255, 0.28)"
                : "rgba(0, 0, 0, 0.36)";
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
                    ctx.fillText(text, x + w / 2 + textOffset, y + h / 2 + 1);
                }
            }
        }
    },

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
    },

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
    },

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
    },

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
    },

    drawToggle(ctx, x, y, w, h, isOn, text, hover = false) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);

        const grad = ctx.createLinearGradient(x, y, x + w, y);
        if (isOn) {
            grad.addColorStop(0, hover ? "rgba(72, 140, 255, 0.94)" : "rgba(58, 118, 214, 0.90)");
            grad.addColorStop(1, hover ? "rgba(104, 166, 255, 0.94)" : "rgba(90, 150, 246, 0.90)");
        } else {
            grad.addColorStop(0, hover ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.16)");
            grad.addColorStop(1, hover ? "rgba(255, 255, 255, 0.30)" : "rgba(255, 255, 255, 0.24)");
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = hover ? "rgba(255, 255, 255, 0.32)" : "rgba(0, 0, 0, 0.36)";
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
        const textOffset = isOn ? -(h * 0.25) : (h * 0.25);
        ctx.fillText(text, x + w / 2 + textOffset, y + h / 2 + 1);
    },

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
    },

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
    },

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
    },

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
        if (this.validateWidgets() && config.previewDimensions) {
            const newW = Math.round(Number(config.previewDimensions.width) || 0);
            const newH = Math.round(Number(config.previewDimensions.height) || 0);
            this.setCanvasTextStyle(ctx, { fillStyle: "#888", font: "11px Arial", textAlign: "left" });
            ctx.fillText(`${newW}×${newH}`, currentX, y + 14);
        }
        currentX += layout.previewWidth + layout.gap;
        this.controls[config.radioControl] = { x: currentX, y: y + 5, w: layout.radioWidth, h: 18 };
        this.drawRadioButton(ctx, currentX, y + 5, layout.radioWidth,
                           props.rescaleMode === config.rescaleMode, this.hoverElement === config.radioControl);
    }
};
