import { createModuleLogger } from "../log_system/log_funcs.js";
import { inlineSvgIcons } from "../utils/icon_utils.js";
import { performanceDiagnostics } from "../utils/performance_diagnostics.js";

const log = createModuleLogger('resolution_master_interaction_methods');
const DRAG_ZOOM_BYPASS_PATCH_FLAG = '__resolutionMasterDragZoomBypassInstalled';
const DRAG_ZOOM_CAPTURE_PATCH_FLAG = '__resolutionMasterDragZoomCaptureInstalled';
const ORIGINAL_MOUSE_MODIFIERS_PROP = '__resolutionMasterOriginalMouseModifiers';
const BYPASSED_DRAG_ZOOM_EVENT_PROP = '__resolutionMasterBypassedDragZoom';
const HELP_DIALOG_SCALE = 0.7;

function getMouseModifiers(e) {
    return {
        ctrlKey: e?.[ORIGINAL_MOUSE_MODIFIERS_PROP]?.ctrlKey ?? !!e?.ctrlKey,
        shiftKey: e?.[ORIGINAL_MOUSE_MODIFIERS_PROP]?.shiftKey ?? !!e?.shiftKey,
        altKey: e?.[ORIGINAL_MOUSE_MODIFIERS_PROP]?.altKey ?? !!e?.altKey,
        metaKey: e?.[ORIGINAL_MOUSE_MODIFIERS_PROP]?.metaKey ?? !!e?.metaKey
    };
}

function isCtrlPrimaryMouseDown(e) {
    const modifiers = getMouseModifiers(e);
    return e?.button === 0 && modifiers.ctrlKey && !modifiers.altKey;
}

function getNodeUnderPointer(canvas, e) {
    if (typeof e.canvasX !== "number" || typeof e.canvasY !== "number") {
        canvas.adjustMouseEvent?.(e);
    }
    const nodes = canvas.visible_nodes?.length ? canvas.visible_nodes : canvas.graph?._nodes;
    return canvas.graph?.getNodeOnPos?.(e.canvasX, e.canvasY, nodes) || null;
}

function isOverResolutionMasterCanvas(canvas, e) {
    try {
        const node = getNodeUnderPointer(canvas, e);
        const rm = node?.resolutionMaster;
        if (!rm || node.flags?.collapsed || node.properties?.mode !== "Manual") {
            return false;
        }

        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];
        return [
            rm.controls?.canvas2d,
            rm.controls?.canvas2dRightHandle,
            rm.controls?.canvas2dTopHandle
        ].some(control => control && rm.isPointInControl(relX, relY, control));
    } catch (error) {
        log.debug('Could not test ResolutionMaster canvas shortcut target:', error);
        return false;
    }
}

function getKnownGraphCanvases(app) {
    const canvases = new Set();
    const addCanvas = (graphCanvas) => {
        if (graphCanvas?.canvas) {
            canvases.add(graphCanvas);
        }
    };

    addCanvas(app?.canvas);
    addCanvas(globalThis.LGraphCanvas?.active_canvas);

    const graphs = [
        app?.graph,
        app?.canvas?.graph,
        globalThis.LGraphCanvas?.active_canvas?.graph
    ];
    for (const graph of graphs) {
        graph?.list_of_graphcanvas?.forEach(addCanvas);
    }

    return [...canvases];
}

function isPointInsideElement(element, e) {
    if (!element?.getBoundingClientRect) return false;

    const rect = element.getBoundingClientRect();
    return e.clientX >= rect.left
        && e.clientX <= rect.right
        && e.clientY >= rect.top
        && e.clientY <= rect.bottom;
}

function getGraphCanvasFromMouseEvent(app, e) {
    const path = e.composedPath?.() || [];
    const target = e.target;
    const isNodeTarget = globalThis.Node && target instanceof globalThis.Node;
    const elementAtPoint = globalThis.document?.elementFromPoint?.(e.clientX, e.clientY);

    return getKnownGraphCanvases(app).find((graphCanvas) => {
        const element = graphCanvas.canvas;
        return element === target
            || element === elementAtPoint
            || path.includes(element)
            || (isNodeTarget && element?.contains?.(target))
            || isPointInsideElement(element, e);
    }) || null;
}

function temporarilyDisableDragZoom(canvas) {
    if (!canvas?.dragZoomEnabled) return;

    const previousDragZoomEnabled = canvas.dragZoomEnabled;
    canvas.dragZoomEnabled = false;
    globalThis.setTimeout?.(() => {
        canvas.dragZoomEnabled = previousDragZoomEnabled;
    }, 0);
}

function defineEventValue(e, key, value) {
    try {
        Object.defineProperty(e, key, {
            value,
            configurable: true
        });
        return true;
    } catch {
        return false;
    }
}

function suppressComfyCanvasShortcutModifiers(e) {
    if (!e || e[BYPASSED_DRAG_ZOOM_EVENT_PROP]) return;

    const originalModifiers = getMouseModifiers(e);
    defineEventValue(e, ORIGINAL_MOUSE_MODIFIERS_PROP, originalModifiers);
    defineEventValue(e, BYPASSED_DRAG_ZOOM_EVENT_PROP, true);

    const ctrlSuppressed = defineEventValue(e, 'ctrlKey', false);
    const shiftSuppressed = defineEventValue(e, 'shiftKey', false);
    const originalGetModifierState = typeof e.getModifierState === 'function'
        ? e.getModifierState.bind(e)
        : null;
    if (originalGetModifierState) {
        defineEventValue(e, 'getModifierState', (key) => {
            if (key === 'Control' || key === 'Ctrl' || key === 'Shift') {
                return false;
            }
            return originalGetModifierState(key);
        });
    }

    if (!ctrlSuppressed || !shiftSuppressed) {
        log.debug('Could not suppress canvas shortcut modifier on mouse event', {
            ctrlSuppressed,
            shiftSuppressed
        });
    }
}

export const interactionMethods = {
    installCanvasDragZoomBypass() {
        this.installCanvasDragZoomCaptureBypass();
        this.installProcessMouseDownDragZoomBypass();
    },

    installCanvasDragZoomCaptureBypass() {
        const win = globalThis.window;
        if (!win || win[DRAG_ZOOM_CAPTURE_PATCH_FLAG]) return;

        Object.defineProperty(win, DRAG_ZOOM_CAPTURE_PATCH_FLAG, {
            value: true,
            configurable: false
        });

        const handlePotentialCanvasShortcut = (e) => {
            if (!isCtrlPrimaryMouseDown(e)) return;

            const canvas = getGraphCanvasFromMouseEvent(this.app, e);
            if (!canvas || !isOverResolutionMasterCanvas(canvas, e)) return;

            temporarilyDisableDragZoom(canvas);
            suppressComfyCanvasShortcutModifiers(e);
        };

        win.addEventListener('pointerdown', handlePotentialCanvasShortcut, { capture: true });
        win.addEventListener('mousedown', handlePotentialCanvasShortcut, { capture: true });

        log.debug('Installed ResolutionMaster early canvas drag-zoom bypass');
    },

    installProcessMouseDownDragZoomBypass() {
        const prototype = globalThis.LGraphCanvas?.prototype;
        if (!prototype || prototype[DRAG_ZOOM_BYPASS_PATCH_FLAG]) return;

        const originalProcessMouseDown = prototype.processMouseDown;
        if (typeof originalProcessMouseDown !== "function") return;

        Object.defineProperty(prototype, DRAG_ZOOM_BYPASS_PATCH_FLAG, {
            value: true,
            configurable: false
        });

        prototype.processMouseDown = function(e) {
            if (this.dragZoomEnabled && isCtrlPrimaryMouseDown(e) && isOverResolutionMasterCanvas(this, e)) {
                const previousDragZoomEnabled = this.dragZoomEnabled;
                this.dragZoomEnabled = false;
                try {
                    return originalProcessMouseDown.apply(this, arguments);
                } finally {
                    this.dragZoomEnabled = previousDragZoomEnabled;
                }
            }

            return originalProcessMouseDown.apply(this, arguments);
        };

        log.debug('Installed ResolutionMaster canvas drag-zoom bypass');
    },

    getCanvasPointer(canvas) {
        return canvas?.pointer
            || this._capturedPointerCanvas?.pointer
            || this.node?.graph?.list_of_graphcanvas?.find((graphCanvas) => graphCanvas?.pointer)?.pointer
            || this.node?.graph?.canvas?.pointer
            || this.app?.canvas?.pointer
            || globalThis.LGraphCanvas?.active_canvas?.pointer
            || null;
    },

    scheduleCanvasPointerDrag(eMove, activeCanvas) {
        this._pendingCanvasPointerDragEvent = eMove;
        this._pendingCanvasPointerDragCanvas = activeCanvas;
        if (this._pendingCanvasPointerDragFrame !== null) return;

        const runPendingDrag = () => {
            this._pendingCanvasPointerDragFrame = null;
            this._pendingCanvasPointerDragCancel = null;
            const pendingEvent = this._pendingCanvasPointerDragEvent;
            const pendingCanvas = this._pendingCanvasPointerDragCanvas;
            this._pendingCanvasPointerDragEvent = null;
            this._pendingCanvasPointerDragCanvas = null;

            if (!pendingEvent || !this.node?.capture) return;
            this.handleMouseMove(pendingEvent, null, pendingCanvas);
        };

        if (globalThis.requestAnimationFrame) {
            this._pendingCanvasPointerDragFrame = globalThis.requestAnimationFrame(runPendingDrag);
            this._pendingCanvasPointerDragCancel = globalThis.cancelAnimationFrame?.bind(globalThis) || null;
            return;
        }

        if (globalThis.setTimeout) {
            this._pendingCanvasPointerDragFrame = globalThis.setTimeout(runPendingDrag, 16);
            this._pendingCanvasPointerDragCancel = globalThis.clearTimeout?.bind(globalThis) || null;
            return;
        }

        runPendingDrag();
    },

    cancelPendingCanvasPointerDragFrame() {
        if (this._pendingCanvasPointerDragFrame === null) return;
        this._pendingCanvasPointerDragCancel?.(this._pendingCanvasPointerDragFrame);
        this._pendingCanvasPointerDragFrame = null;
        this._pendingCanvasPointerDragCancel = null;
    },

    flushCanvasPointerDrag() {
        const pendingEvent = this._pendingCanvasPointerDragEvent;
        const pendingCanvas = this._pendingCanvasPointerDragCanvas;
        this.cancelPendingCanvasPointerDragFrame();
        this._pendingCanvasPointerDragEvent = null;
        this._pendingCanvasPointerDragCanvas = null;

        if (!pendingEvent || !this.node?.capture) return;
        this.handleMouseMove(pendingEvent, null, pendingCanvas);
    },

    clearCanvasPointerDrag() {
        this.cancelPendingCanvasPointerDragFrame();
        this._pendingCanvasPointerDragEvent = null;
        this._pendingCanvasPointerDragCanvas = null;
    },

    captureNodePointer(canvas) {
        const pointer = this.getCanvasPointer(canvas);
        if (pointer && ("onDrag" in pointer || "finally" in pointer)) {
            const activeCanvas = canvas
                || this._capturedPointerCanvas
                || this.node?.graph?.list_of_graphcanvas?.find((graphCanvas) => graphCanvas?.pointer === pointer)
                || this.node?.graph?.canvas
                || this.app?.canvas
                || globalThis.LGraphCanvas?.active_canvas
                || null;

            pointer.onDrag = (eMove) => {
                this.scheduleCanvasPointerDrag(eMove, activeCanvas);
            };
            pointer.finally = () => {
                this.flushCanvasPointerDrag();
                if (this.node?.capture) {
                    this.handleMouseUp(pointer.eUp || pointer.eMove || pointer.eDown);
                }
                this._usingCanvasPointerCallbacks = false;
                this._capturedPointerCanvas = null;
            };

            this._usingCanvasPointerCallbacks = true;
            this._capturedPointerCanvas = activeCanvas;
            return;
        }

        const legacyCanvas = canvas || this.node?.graph?.list_of_graphcanvas?.[0] || null;
        if (legacyCanvas && "node_capturing_input" in legacyCanvas) {
            legacyCanvas.node_capturing_input = this.node;
            this._capturedPointerCanvas = legacyCanvas;
            return;
        }

        if (!this._loggedLegacyCaptureFallback) {
            this._loggedLegacyCaptureFallback = true;
            log.warn('Canvas pointer API unavailable; falling back to deprecated captureInput', {
                nodeId: this.node?.id ?? null
            });
        }
        this.node.captureInput?.(true);
    },

    releaseNodePointer(canvas) {
        const pointer = this.getCanvasPointer(canvas);
        if (pointer && ("onDrag" in pointer || "finally" in pointer)) {
            this.clearCanvasPointerDrag();
            this._usingCanvasPointerCallbacks = false;
            this._capturedPointerCanvas = null;
            return;
        }

        const legacyCanvas = canvas || this._capturedPointerCanvas || this.node?.graph?.list_of_graphcanvas?.[0] || null;
        if (legacyCanvas?.node_capturing_input === this.node) {
            legacyCanvas.node_capturing_input = null;
            this._capturedPointerCanvas = null;
            return;
        }

        if (!this._loggedLegacyCaptureFallback) {
            this._loggedLegacyCaptureFallback = true;
            log.warn('Canvas pointer API unavailable; falling back to deprecated captureInput', {
                nodeId: this.node?.id ?? null
            });
        }
        this.node.captureInput?.(false);
        this.clearCanvasPointerDrag();
        this._usingCanvasPointerCallbacks = false;
        this._capturedPointerCanvas = null;
    },

    handleMouseDown(e, pos, canvas) {
        const node = this.node;
        const props = node.properties;

        const relX = e.canvasX - node.pos[0];
        const relY = e.canvasY - node.pos[1];

        if (props.mode === "Manual") {
            if (this.controls.canvas2dRightHandle && this.isPointInControl(relX, relY, this.controls.canvas2dRightHandle)) {
                node.capture = 'canvas2dRightHandle';
                this.captureNodePointer(canvas);
                return true;
            }

            if (this.controls.canvas2dTopHandle && this.isPointInControl(relX, relY, this.controls.canvas2dTopHandle)) {
                node.capture = 'canvas2dTopHandle';
                this.captureNodePointer(canvas);
                return true;
            }
            const c2d = this.controls.canvas2d;
            if (c2d && this.isPointInControl(relX, relY, c2d)) {
                node.capture = 'canvas2d';
                this.canvasDragAspectLock = this.createAspectLock();
                this.captureNodePointer(canvas);
                const modifiers = getMouseModifiers(e);
                this.updateCanvasValue(relX - c2d.x, relY - c2d.y, c2d.w, c2d.h, modifiers.shiftKey, modifiers.ctrlKey);
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
                    this.captureNodePointer(canvas);
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
                        this.customValueDialogManager.showCustomValueDialog(key, e);
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
    },

    handleMouseMove(e, pos, canvas) {
        const diagnosticsToken = performanceDiagnostics.start("handleMouseMove");
        try {
            const node = this.node;

            if (!node.capture) return false;
            if (this._usingCanvasPointerCallbacks && pos !== null) return true;
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
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

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
            this.app?.graph?.setDirtyCanvas(true);
        }
    },

    handleTooltipHover(element, e) {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.showTooltip) {
            this.showTooltip = false;
            this.tooltipElement = null;
            this.app?.graph?.setDirtyCanvas(true);
        }
        if (element && this.tooltips[element]) {
            const initialMousePos = { x: e.canvasX, y: e.canvasY };
            this.tooltipTimer = setTimeout(() => {
                this.tooltipElement = element;
                this.showTooltip = true;
                this.tooltipFixedPos = initialMousePos;
                this.app?.graph?.setDirtyCanvas(true);
            }, this.tooltipDelay);
        }
    },

    handleMouseUp(e) {
        const node = this.node;

        if (!node.capture) return false;

        node.capture = false;
        this.canvasDragAspectLock = null;
        this.releaseNodePointer();

        if (this.widthWidget && this.heightWidget) {
            this.widthWidget.value = node.properties.valueX;
            this.heightWidget.value = node.properties.valueY;
        }

        this.updateRescaleValue();
        this.requestCanvasUpdate();

        return true;
    },

    handlePropertyChange(property) {
        const node = this.node;
        if (property?.startsWith('section_') && property.endsWith('_collapsed')) {
            const sectionKey = property.replace(/^section_/, '').replace(/_collapsed$/, '');
            this.collapsedSections[sectionKey] = node.properties[property];
            if (sectionKey === 'extraControls') {
                this.userPreferredHeight = this.getStoredPreferredHeight(this.collapsedSections.extraControls);
                this.applyCompactSlotLabels();
            }
        }
        if (!node.configured) return;

        node.intpos.x = (node.properties.valueX - node.properties.canvas_min_x) /
                       (node.properties.canvas_max_x - node.properties.canvas_min_x);
        node.intpos.y = (node.properties.valueY - node.properties.canvas_min_y) /
                       (node.properties.canvas_max_y - node.properties.canvas_min_y);

        node.intpos.x = Math.max(0, Math.min(1, node.intpos.x));
        node.intpos.y = Math.max(0, Math.min(1, node.intpos.y));

        this.requestCanvasUpdate();
    },

    handleButtonClick(buttonName) {
        const actions = {
            swapBtn: () => this.handleSwap(),
            snapBtn: () => this.handleSnap(),
            scaleBtn: () => this.handleScale(),
            resolutionBtn: () => this.handleResolutionScale(),
            megapixelsBtn: () => this.handleMegapixelsScale(),
            autoFitBtn: () => this.handleAutoFit(),
            autoResizeBtn: () => this.handleAutoResize(),
            autoSnapBtn: () => this.handleSnap(),
            autoCalcBtn: () => this.handleAutoCalc(),
            detectedInfo: () => this.handleDetectedClick(),
            managePresetsBtn: () => this.handleManagePresets(),
            compactHelpBtn: () => this.showHelpDialog()
        };
        actions[buttonName]?.();
    },

    showHelpDialog() {
        this.closeHelpDialog();

        const overlay = document.createElement('div');
        this.helpDialogOverlay = overlay;
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.62);
            z-index: 9999; display: flex; align-items: center; justify-content: center;
            padding: 24px; box-sizing: border-box; backdrop-filter: blur(2px);
        `;
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) this.closeHelpDialog();
        });

        const dialog = document.createElement('div');
        this.helpDialog = dialog;
        dialog.addEventListener('mousedown', (e) => e.stopPropagation());
        dialog.style.cssText = `
            width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 40px);
            overflow: auto; box-sizing: border-box;
            background: linear-gradient(135deg, rgba(37,37,37,0.98) 0%, rgba(20,20,20,0.98) 100%);
            border: 1px solid rgba(210, 220, 235, 0.28);
            border-radius: 14px; box-shadow: 0 24px 70px rgba(0,0,0,0.82), inset 0 1px 0 rgba(255,255,255,0.05);
            color: #ddd; font-family: Arial, sans-serif; padding: 0;
            transform: scale(${HELP_DIALOG_SCALE}); transform-origin: center center;
        `;

        dialog.innerHTML = `
            <div style="padding:28px 40px 22px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:30px;">
                    <div style="font-size:36px; line-height:1.1; font-weight:800; color:#e9e9e9; letter-spacing:0; text-shadow:0 2px 18px rgba(255,255,255,0.13);">Resolution Master Help</div>
                    <button type="button" data-close aria-label="Close" style="width:50px; height:50px; border-radius:9px; border:1px solid rgba(210,220,235,0.25); background:linear-gradient(180deg, rgba(80,80,80,0.85), rgba(45,45,45,0.9)); color:#eee; cursor:pointer; font-size:28px; line-height:1; box-shadow:inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.35);">&times;</button>
                </div>

                <section style="margin-bottom:30px;">
                    <div style="display:grid; grid-template-columns:26px minmax(0, 1fr); align-items:center; column-gap:10px; margin-bottom:14px; color:#d9d9d9;">
                        <span style="display:flex; align-items:center; justify-content:center; width:26px; color:#bfc3c7;">${inlineSvgIcons.keyboard}</span>
                        <div style="font-size:24px; line-height:1.2; font-weight:800; color:#e4e4e4;">2D Canvas Shortcuts</div>
                    </div>
                    <div style="border:1px solid rgba(210,220,235,0.16); border-radius:8px; overflow:hidden; background:rgba(10,10,10,0.17);">
                        <div style="display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.15fr); align-items:center; min-height:60px; border-bottom:1px solid rgba(210,220,235,0.12);">
                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; padding:10px 24px;">
                                <span style="display:inline-flex; align-items:center; gap:8px; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">${inlineSvgIcons.mouse}<span>Drag</span></span>
                            </div>
                            <div style="padding:10px 22px; color:#e2e2e2; font-size:18px; line-height:1.35; border-left:1px solid rgba(210,220,235,0.08);">Set width and height</div>
                        </div>
                        <div style="display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.15fr); align-items:center; min-height:60px; border-bottom:1px solid rgba(210,220,235,0.12);">
                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; padding:10px 24px;">
                                <span style="display:inline-flex; align-items:center; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">Shift</span>
                                <span style="color:#f0f0f0; font-weight:700;">+</span>
                                <span style="display:inline-flex; align-items:center; gap:8px; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">${inlineSvgIcons.mouse}<span>Drag</span></span>
                            </div>
                            <div style="padding:10px 22px; color:#e2e2e2; font-size:18px; line-height:1.35; border-left:1px solid rgba(210,220,235,0.08);">Keep aspect ratio</div>
                        </div>
                        <div style="display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.15fr); align-items:center; min-height:60px; border-bottom:1px solid rgba(210,220,235,0.12);">
                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; padding:10px 24px;">
                                <span style="display:inline-flex; align-items:center; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">Ctrl</span>
                                <span style="color:#f0f0f0; font-weight:700;">+</span>
                                <span style="display:inline-flex; align-items:center; gap:8px; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">${inlineSvgIcons.mouse}<span>Drag</span></span>
                            </div>
                            <div style="padding:10px 22px; color:#e2e2e2; font-size:18px; line-height:1.35; border-left:1px solid rgba(210,220,235,0.08);">Disable canvas snap</div>
                        </div>
                        <div style="display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1.15fr); align-items:center; min-height:60px;">
                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; padding:10px 24px;">
                                <span style="display:inline-flex; align-items:center; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">Ctrl</span>
                                <span style="color:#f0f0f0; font-weight:700;">+</span>
                                <span style="display:inline-flex; align-items:center; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">Shift</span>
                                <span style="color:#f0f0f0; font-weight:700;">+</span>
                                <span style="display:inline-flex; align-items:center; gap:8px; min-height:36px; padding:0 13px; border:1px solid rgba(210,220,235,0.17); border-radius:6px; background:linear-gradient(180deg, rgba(78,78,78,0.78), rgba(40,40,40,0.8)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); color:#f0f0f0; font-size:18px; white-space:nowrap;">${inlineSvgIcons.mouse}<span>Drag</span></span>
                            </div>
                            <div style="padding:10px 22px; color:#e2e2e2; font-size:18px; line-height:1.35; border-left:1px solid rgba(210,220,235,0.08);">Keep aspect ratio with canvas snap disabled</div>
                        </div>
                    </div>
                </section>

                <section>
                    <div style="display:grid; grid-template-columns:26px minmax(0, 1fr); align-items:center; column-gap:10px; color:#d9d9d9;">
                        <span style="display:flex; align-items:center; justify-content:center; width:26px; color:#bfc3c7;">${inlineSvgIcons.tip}</span>
                        <div style="font-size:24px; line-height:1.2; font-weight:800; color:#e4e4e4;">Tip</div>
                    </div>
                    <div style="margin:13px 0 0 36px; color:#b9b9b9; font-size:18px; line-height:1.45;">Click most numeric values to enter a custom value.</div>
                </section>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; padding:20px 40px 24px; border-top:1px solid rgba(210,220,235,0.18); background:rgba(255,255,255,0.02);">
                <div style="display:flex; align-items:center; gap:14px; min-width:0; color:#bdbdbd; font-size:18px; line-height:1.4;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; color:#f2cc60; background:rgba(242,204,96,0.14); border:1px solid rgba(242,204,96,0.42); box-shadow:0 0 20px rgba(242,204,96,0.12);">${inlineSvgIcons.star}</span>
                    <span>If this node helps you, please consider <span style="color:#f2cc60; font-weight:700;">starring</span> the repository.</span>
                </div>
                <a href="https://github.com/Azornes/Comfyui-Resolution-Master" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:44px; padding:0 18px; border:1px solid rgba(210,220,235,0.18); border-radius:7px; color:#f2f2f2; background:linear-gradient(180deg, rgba(48,48,48,0.72), rgba(26,26,26,0.88)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 16px rgba(0,0,0,0.25); text-decoration:none; font-size:18px; white-space:nowrap;">
                    <span style="color:#f2f2f2;">${inlineSvgIcons.github}</span>
                    <span>Go to GitHub</span>
                </a>
            </div>
        `;

        dialog.querySelector('[data-close]')?.addEventListener('click', () => this.closeHelpDialog());
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    },

    closeHelpDialog() {
        if (this.helpDialogOverlay?.parentNode) {
            this.helpDialogOverlay.parentNode.removeChild(this.helpDialogOverlay);
        }
        this.helpDialogOverlay = null;
        this.helpDialog = null;
    },

    handleToggleClick(toggleName) {
        const props = this.node.properties;
        if (toggleName === 'autoDetectToggle') {
            props.autoDetect = !props.autoDetect;
            this.setAutoDetectSource('backend');
            if (props.autoDetect) this.startAutoDetect();
            else this.stopAutoDetect();
            const widget = this.node.widgets?.find(w => w.name === 'auto_detect');
            if (widget) widget.value = props.autoDetect;
            this.syncBackendFallbackWidgets();
            this.app?.graph?.setDirtyCanvas(true);
        } else if (toggleName === 'smartFitToggle' && props.selectedCategory) {
            props.smartFit = !props.smartFit;
            this.syncBackendFallbackWidgets();
            this.app?.graph?.setDirtyCanvas(true);
        } else if (toggleName === 'calcInfoToggle' && props.selectedCategory) {
            props.showCalcInfo = !props.showCalcInfo;
            this.app?.graph?.setDirtyCanvas(true);
        }
    },

    handleCheckboxClick(checkboxName) {
        const props = this.node.properties;
        if (checkboxName === 'autoFitCheckbox' && props.selectedCategory) {
            props.autoFitOnChange = !props.autoFitOnChange;
        } else if (checkboxName === 'autoResizeCheckbox') {
            props.autoResizeOnChange = !props.autoResizeOnChange;
        } else if (checkboxName === 'autoSnapCheckbox') {
            props.autoSnapOnChange = !props.autoSnapOnChange;
        } else if (checkboxName === 'customCalcCheckbox') {
            props.useCustomCalc = !props.useCustomCalc;
        } else if (checkboxName === 'preserveScalingRatioCheckbox') {
            props.preserveScalingRatio = !props.preserveScalingRatio;
        }
        this.syncBackendFallbackWidgets();
        this.updateRescaleValue();
        this.app?.graph?.setDirtyCanvas(true);
    },

    handleRadioClick(radioName) {
        const props = this.node.properties;
        const radioMap = {
            upscaleRadio: 'manual',
            resolutionRadio: 'resolution',
            megapixelsRadio: 'megapixels'
        };
        props.rescaleMode = radioMap[radioName];
        this.updateRescaleValue();
        this.app?.graph?.setDirtyCanvas(true);
    },

    handleSectionHeaderClick(headerKey) {
        const sectionKey = headerKey.replace('Header', '');
        if (sectionKey === 'extraControls') {
            this.storePreferredHeight(this.node.size[1], this.collapsedSections.extraControls);
        }
        this.collapsedSections[sectionKey] = !this.collapsedSections[sectionKey];
        const propertyKey = `section_${sectionKey}_collapsed`;
        this.node.properties[propertyKey] = this.collapsedSections[sectionKey];
        if (sectionKey === 'extraControls') {
            this.userPreferredHeight = this.getStoredPreferredHeight(this.collapsedSections.extraControls);
            this.applyCompactSlotLabels();
        }
        this.app?.graph?.setDirtyCanvas(true, true);

        log.debug(`Section ${sectionKey} ${this.collapsedSections[sectionKey] ? 'collapsed' : 'expanded'}`);
    },

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

            if (config.updateOn) {
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

        this.app?.graph?.setDirtyCanvas(true);
    },

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
                        text: `${name} (${dims.width}\u00d7${dims.height})`,
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
    },

    showLatentTypeSelector(e) {
        if (!this.latentTypeWidget) {
            log.debug("Latent type selector: latent_type widget not found");
            return;
        }

        const currentValue = this.latentTypeWidget.value || 'latent_4x8';

        const latentTypes = [
            { text: '4x8 (Standard SD/SDXL/Flux)', value: 'latent_4x8' },
            { text: '128x16 (Flux.2)', value: 'latent_128x16' }
        ];

        const items = latentTypes.map(type => ({
            text: type.text,
            value: type.value,
            isCustom: type.value === currentValue
        }));

        this.searchableDropdown.show(items, {
            event: e,
            title: 'Select Latent Type',
            callback: (selectedText) => {
                const selectedType = latentTypes.find(t => t.text === selectedText);
                if (selectedType && this.latentTypeWidget) {
                    this.latentTypeWidget.value = selectedType.value;
                    log.debug(`Latent type manually changed to: ${selectedType.value}`);
                    this.app?.graph?.setDirtyCanvas(true);
                }
            }
        });
    },

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
                this.syncBackendFallbackWidgets();
                this.updateRescaleValue();
                this.app?.graph?.setDirtyCanvas(true);
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
                this.updateRescaleValue();
                this.app?.graph?.setDirtyCanvas(true);
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
    },

    handleSwap() {
        if (!this.validateWidgets()) return;

        const newWidth = this.heightWidget.value;
        const newHeight = this.widthWidget.value;
        this.setDimensions(newWidth, newHeight);
    },

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
    },

    handleManagePresets() {
        log.debug("Manage Presets button clicked - opening dialog");
        this.presetManagerDialog.show();
    }
};
