import { createModuleLogger } from "../log_system/log_funcs.js";
import { DEFAULT_NODE_PROPERTIES } from "./default_node_properties.js";

const log = createModuleLogger('resolution_master_node_lifecycle');
const RESOLUTION_MASTER_AUX_ID = "Azornes/Comfyui-Resolution-Master";
const VUE_COMPAT_WIDGET_NAME = "resolution_master_ui";

export const nodeLifecycleMethods = {
    initializeProperties() {
        Object.entries(DEFAULT_NODE_PROPERTIES).forEach(([key, defaultValue]) => {
            this.node.properties[key] = this.node.properties[key] ?? defaultValue;
        });
        this.ensureCanonicalPackageMetadata();
    },

    ensureCanonicalPackageMetadata(serializedNode = null) {
        const applyAuxId = properties => {
            if (!properties || typeof properties !== "object" || properties.cnr_id) return;
            properties.aux_id = RESOLUTION_MASTER_AUX_ID;
        };

        this.node.properties = this.node.properties || {};
        applyAuxId(this.node.properties);

        if (serializedNode && typeof serializedNode === "object") {
            serializedNode.properties = serializedNode.properties || {};
            applyAuxId(serializedNode.properties);
        }
    },

    isVueNodesMode() {
        return globalThis.LiteGraph?.vueNodesMode === true;
    },

    getVueCompatWidgetHeight() {
        const neededHeight = Math.ceil(Number(this.calculateNeededHeight()) || 0);
        return Math.max(neededHeight, this.node.min_size?.[1] || 200);
    },

    getVueCompatRenderedWidgetHeight() {
        const minimumHeight = this.getVueCompatWidgetHeight();
        if (!this.collapsedSections?.extraControls) return minimumHeight;

        const computedHeight = Number(this.vueCompatWidget?.computedHeight);
        return Number.isFinite(computedHeight) && computedHeight > 0
            ? Math.max(minimumHeight, computedHeight)
            : minimumHeight;
    },

    getVueCompatBottomBadgeClearance() {
        return this.isVueNodesMode() && this.collapsedSections?.extraControls ? -23 : 0;
    },

    scheduleVueCompatHeightRedraw() {
        if (this._vueCompatHeightRedrawFrame != null) return;

        const redraw = () => {
            this._vueCompatHeightRedrawFrame = null;
            this.vueCompatWidget?.triggerDraw?.();
        };
        if (typeof requestAnimationFrame === 'function') {
            this._vueCompatHeightRedrawFrame = requestAnimationFrame(redraw);
        } else {
            this._vueCompatHeightRedrawFrame = setTimeout(redraw, 0);
        }
    },

    applyVueCompatAutoSize(widgetHeight = this.getVueCompatWidgetHeight()) {
        if (!this.isVueNodesMode()) return;

        const targetHeight = Math.max(
            Math.ceil(Number(widgetHeight) || 0),
            this.node.min_size?.[1] || 200
        );
        if (this._vueCompatAutoSizedContentHeight === targetHeight) return;

        this._vueCompatAutoSizedContentHeight = targetHeight;
        const targetWidth = Math.max(Number(this.node.size?.[0]) || 0, 330);
        if (Math.abs((Number(this.node.size?.[1]) || 0) - targetHeight) <= 1) return;

        this._isApplyingAutoSize = true;
        try {
            if (typeof this.node.setSize === 'function') {
                this.node.setSize([targetWidth, targetHeight]);
            } else {
                this.node.size = [targetWidth, targetHeight];
            }
        } finally {
            this._isApplyingAutoSize = false;
        }
    },

    withVueCompatWidgetSize(callback) {
        if (!this.isVueNodesMode() || !Array.isArray(this.node.size)) {
            return callback();
        }

        const originalWidth = this.node.size[0];
        const originalHeight = this.node.size[1];
        const widgetWidth = Number(this._vueCompatWidgetWidth) || originalWidth;
        const widgetHeight = Number(this._vueCompatWidgetHeight) || originalHeight;

        this.node.size[0] = widgetWidth;
        this.node.size[1] = widgetHeight;
        try {
            return callback();
        } finally {
            this.node.size[0] = originalWidth;
            this.node.size[1] = originalHeight;
        }
    },

    requestVueCompatWidgetDraw(updateHeight = false) {
        const widget = this.vueCompatWidget;
        if (!widget || !this.isVueNodesMode()) return;

        if (updateHeight) {
            const height = this.getVueCompatRenderedWidgetHeight();
            this._vueCompatWidgetHeight = height;
            if (this.collapsedSections?.extraControls) {
                this._vueCompatAutoSizedContentHeight = null;
            } else {
                this.applyVueCompatAutoSize(height);
            }
        }
        widget.triggerDraw?.();
    },

    prepareVueCompatCanvasDraw(ctx, width, height, widget) {
        if (!this.isVueNodesMode() || !this.collapsedSections?.extraControls) {
            return { ctx, height };
        }

        const canvasElement = ctx?.canvas;
        const canvasHost = canvasElement?.parentElement;
        if (!canvasElement || !canvasHost) return { ctx, height };

        const releaseHostMinimum = () => {
            if (canvasHost.isConnected !== false) {
                canvasHost.style.minHeight = "0px";
            }
        };
        releaseHostMinimum();
        if (typeof queueMicrotask === "function") {
            queueMicrotask(releaseHostMinimum);
        }

        const minimumHeight = this.getVueCompatWidgetHeight();
        const hostHeight = Math.floor(Number(canvasHost.clientHeight) || 0);
        const targetHeight = Math.max(
            minimumHeight,
            hostHeight - this.getVueCompatBottomBadgeClearance()
        );
        const currentHeight = Number(height) || minimumHeight;
        if (!Number.isFinite(targetHeight) || Math.abs(targetHeight - currentHeight) <= 1) {
            return { ctx, height: currentHeight };
        }

        widget.computedHeight = targetHeight;
        const pixelRatio = Math.max(
            1,
            Number(canvasElement.width) / Math.max(1, Number(width) || canvasElement.clientWidth || 1)
        );
        canvasElement.height = Math.max(1, Math.ceil((targetHeight + 2) * pixelRatio));
        const resizedContext = canvasElement.getContext?.("2d");
        if (!resizedContext) return { ctx, height: currentHeight };

        resizedContext.scale(pixelRatio, pixelRatio);
        this.scheduleVueCompatHeightRedraw();
        return { ctx: resizedContext, height: targetHeight };
    },

    normalizeVueCompatPointerEvent(e, pos = null) {
        if (!e || !this.isVueNodesMode()) return e;

        const localX = Number.isFinite(e.offsetX) ? e.offsetX : pos?.[0];
        const localY = Number.isFinite(e.offsetY) ? e.offsetY : pos?.[1];
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) return e;

        const values = {
            canvasX: this.node.pos[0] + localX,
            canvasY: this.node.pos[1] + localY
        };
        for (const [key, value] of Object.entries(values)) {
            try {
                Object.defineProperty(e, key, { value, configurable: true });
            } catch {
                try {
                    e[key] = value;
                } catch {
                    // Ignore read-only event implementations.
                }
            }
        }
        return e;
    },

    forwardVueCompatNodePointerEvent(e) {
        if (!this.isVueNodesMode() || !e?.type) return false;

        const nodeElement = this._vueCompatCanvasElement?.closest?.('[data-node-id]');
        const EventConstructor = e.type.startsWith('pointer')
            ? globalThis.PointerEvent
            : globalThis.MouseEvent;
        if (!nodeElement?.dispatchEvent || typeof EventConstructor !== 'function') return false;

        const forwardedEvent = new EventConstructor(e.type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: globalThis.window,
            detail: e.detail ?? 0,
            screenX: e.screenX ?? 0,
            screenY: e.screenY ?? 0,
            clientX: e.clientX ?? 0,
            clientY: e.clientY ?? 0,
            ctrlKey: Boolean(e.ctrlKey),
            shiftKey: Boolean(e.shiftKey),
            altKey: Boolean(e.altKey),
            metaKey: Boolean(e.metaKey),
            button: e.button ?? 0,
            buttons: e.buttons ?? 0,
            relatedTarget: e.relatedTarget ?? null,
            pointerId: e.pointerId ?? 1,
            width: e.width ?? 1,
            height: e.height ?? 1,
            pressure: e.pressure ?? 0,
            tangentialPressure: e.tangentialPressure ?? 0,
            tiltX: e.tiltX ?? 0,
            tiltY: e.tiltY ?? 0,
            twist: e.twist ?? 0,
            pointerType: e.pointerType || 'mouse',
            isPrimary: e.isPrimary ?? true
        });
        nodeElement.dispatchEvent(forwardedEvent);
        return true;
    },

    updateVueCompatCanvasLayout(canvasElement) {
        const widgetsGrid = canvasElement?.closest?.('[data-testid="node-widgets"]');
        const slotsElement = widgetsGrid?.previousElementSibling;
        const bodyElement = widgetsGrid?.parentElement;
        if (!widgetsGrid || !slotsElement || !bodyElement) return;

        if (this._vueCompatLayout?.widgetsGrid !== widgetsGrid) {
            this.teardownVueCompatCanvasLayout();
            const canvasHost = canvasElement.parentElement;
            this._vueCompatLayout = {
                bodyElement,
                widgetsGrid,
                slotsElement,
                canvasHost,
                bodyPosition: bodyElement.style.position,
                canvasHostMinHeight: canvasHost?.style.minHeight ?? '',
                gridMarginTop: widgetsGrid.style.marginTop,
                gridPosition: widgetsGrid.style.position,
                gridZIndex: widgetsGrid.style.zIndex,
                slotsPosition: slotsElement.style.position,
                slotsTop: slotsElement.style.top,
                slotsLeft: slotsElement.style.left,
                slotsRight: slotsElement.style.right,
                slotsWidth: slotsElement.style.width,
                slotsZIndex: slotsElement.style.zIndex,
                slotsPointerEvents: slotsElement.style.pointerEvents,
                slotDotPointerEvents: new Map()
            };
        }

        const slotHeight = Math.max(0, Number(slotsElement.offsetHeight) || 0);
        bodyElement.style.position = "relative";
        widgetsGrid.style.marginTop = "";
        widgetsGrid.style.position = "relative";
        widgetsGrid.style.zIndex = "1";
        slotsElement.style.position = "absolute";
        slotsElement.style.top = "0";
        slotsElement.style.left = "0";
        slotsElement.style.right = "0";
        slotsElement.style.width = "100%";
        slotsElement.style.zIndex = "2";
        slotsElement.style.pointerEvents = "none";
        for (const slotDot of slotsElement.querySelectorAll?.('[data-testid="slot-connection-dot"]') || []) {
            if (!this._vueCompatLayout.slotDotPointerEvents.has(slotDot)) {
                this._vueCompatLayout.slotDotPointerEvents.set(slotDot, slotDot.style.pointerEvents);
            }
            slotDot.style.pointerEvents = "auto";
        }
        this.ensureVueCompatHeaderControls(widgetsGrid);
        this._vueCompatSlotOffset = slotHeight;
    },

    ensureVueCompatHeaderControls(widgetsGrid) {
        if (typeof document === "undefined") return;

        const nodeElement = widgetsGrid?.closest?.('.lg-node');
        const headerElement = nodeElement?.querySelector?.('.lg-node-header');
        if (!headerElement) return;

        if (this._vueCompatHeaderControls?.headerElement === headerElement) {
            this.syncVueCompatHeaderControls();
            return;
        }

        this.teardownVueCompatHeaderControls();

        const container = document.createElement('div');
        container.dataset.resolutionMasterHeaderControls = 'true';
        container.style.cssText = [
            'position:absolute',
            'top:50%',
            'right:9px',
            'transform:translateY(-50%)',
            'display:flex',
            'align-items:center',
            'gap:6px',
            'z-index:20',
            'pointer-events:auto'
        ].join(';');

        const createButton = (name, label, title) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.resolutionMasterControl = name;
            button.textContent = label;
            button.title = title;
            button.setAttribute('aria-label', title);
            button.style.cssText = [
                'width:18px',
                'height:18px',
                'min-width:18px',
                'padding:0',
                'border-radius:5px',
                'border:1px solid rgba(255,255,255,0.25)',
                'background:rgba(255,255,255,0.08)',
                'color:#cfcfcf',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'box-sizing:border-box',
                'font-family:Arial,sans-serif',
                'font-size:13px',
                'font-weight:700',
                'line-height:1',
                'cursor:pointer',
                'pointer-events:auto'
            ].join(';');
            button.addEventListener('pointerdown', event => event.stopPropagation());
            button.addEventListener('dblclick', event => event.stopPropagation());
            button.addEventListener('pointerenter', () => {
                button.style.borderColor = 'rgba(255,255,255,0.65)';
                button.style.color = '#fff';
            });
            button.addEventListener('pointerleave', () => this.syncVueCompatHeaderControls());
            return button;
        };

        const helpButton = createButton('help', '?', 'Resolution Master help');
        const toggleButton = createButton('toggle', '−', 'Minimize Resolution Master controls');
        helpButton.addEventListener('click', event => {
            event.stopPropagation();
            this.showHelpDialog();
        });
        toggleButton.addEventListener('click', event => {
            event.stopPropagation();
            this.handleSectionHeaderClick('extraControlsHeader');
            this.syncVueCompatHeaderControls();
        });

        container.append(helpButton, toggleButton);
        this._vueCompatHeaderControls = {
            container,
            headerElement,
            headerPosition: headerElement.style.position,
            headerPaddingRight: headerElement.style.paddingRight,
            helpButton,
            toggleButton
        };
        headerElement.style.position = 'relative';
        headerElement.style.paddingRight = '62px';
        headerElement.append(container);
        this.syncVueCompatHeaderControls();
    },

    syncVueCompatHeaderControls() {
        const controls = this._vueCompatHeaderControls;
        if (!controls) return;

        const isCompact = Boolean(this.collapsedSections?.extraControls);
        controls.helpButton.style.background = 'rgba(255,255,255,0.08)';
        controls.helpButton.style.borderColor = 'rgba(255,255,255,0.25)';
        controls.helpButton.style.color = '#cfcfcf';
        controls.toggleButton.textContent = isCompact ? '+' : '−';
        controls.toggleButton.title = isCompact
            ? 'Expand Resolution Master controls'
            : 'Minimize Resolution Master controls';
        controls.toggleButton.setAttribute('aria-label', controls.toggleButton.title);
        controls.toggleButton.style.background = isCompact
            ? 'rgba(90,170,255,0.45)'
            : 'rgba(255,255,255,0.08)';
        controls.toggleButton.style.borderColor = isCompact
            ? 'rgba(120,190,255,0.85)'
            : 'rgba(255,255,255,0.25)';
        controls.toggleButton.style.color = isCompact ? '#fff' : '#cfcfcf';
    },

    teardownVueCompatHeaderControls() {
        const controls = this._vueCompatHeaderControls;
        if (!controls) return;

        controls.container.remove();
        controls.headerElement.style.position = controls.headerPosition;
        controls.headerElement.style.paddingRight = controls.headerPaddingRight;
        this._vueCompatHeaderControls = null;
    },

    teardownVueCompatCanvasLayout() {
        const layout = this._vueCompatLayout;
        if (layout) {
            if (layout.bodyElement) {
                layout.bodyElement.style.position = layout.bodyPosition ?? "";
            }
            if (layout.canvasHost) {
                layout.canvasHost.style.minHeight = layout.canvasHostMinHeight ?? "";
            }
            layout.widgetsGrid.style.marginTop = layout.gridMarginTop;
            layout.widgetsGrid.style.position = layout.gridPosition;
            layout.widgetsGrid.style.zIndex = layout.gridZIndex;
            layout.slotsElement.style.position = layout.slotsPosition;
            layout.slotsElement.style.top = layout.slotsTop ?? "";
            layout.slotsElement.style.left = layout.slotsLeft ?? "";
            layout.slotsElement.style.right = layout.slotsRight ?? "";
            layout.slotsElement.style.width = layout.slotsWidth ?? "";
            layout.slotsElement.style.zIndex = layout.slotsZIndex;
            layout.slotsElement.style.pointerEvents = layout.slotsPointerEvents;
            for (const [slotDot, pointerEvents] of layout.slotDotPointerEvents) {
                slotDot.style.pointerEvents = pointerEvents;
            }
        }
        this.teardownVueCompatHeaderControls();
        this._vueCompatLayout = null;
        this._vueCompatSlotOffset = 0;
        this._vueCompatAutoSizedContentHeight = null;
    },

    bindVueCompatCanvasEvents(canvasElement) {
        if (!canvasElement?.addEventListener || this._vueCompatCanvasElement === canvasElement) return;
        this.teardownVueCompatCanvasEvents();

        const handlePointerMove = (e) => {
            if (this.node.capture) return;
            this.normalizeVueCompatPointerEvent(e);
            this.withVueCompatWidgetSize(() => this.handleMouseHover(e, null, this.app?.canvas));
        };
        const handlePointerLeave = () => {
            if (this.tooltipTimer) {
                clearTimeout(this.tooltipTimer);
                this.tooltipTimer = null;
            }
            this.hoverElement = null;
            this.tooltipElement = null;
            this.showTooltip = false;
            this.requestCanvasUpdate(true);
        };

        canvasElement.addEventListener("pointermove", handlePointerMove);
        canvasElement.addEventListener("pointerleave", handlePointerLeave);
        this._vueCompatCanvasElement = canvasElement;
        this._vueCompatCanvasHandlers = { handlePointerMove, handlePointerLeave };
    },

    teardownVueCompatCanvasEvents() {
        if (this._vueCompatHeightRedrawFrame != null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this._vueCompatHeightRedrawFrame);
            } else {
                clearTimeout(this._vueCompatHeightRedrawFrame);
            }
            this._vueCompatHeightRedrawFrame = null;
        }
        const element = this._vueCompatCanvasElement;
        const handlers = this._vueCompatCanvasHandlers;
        if (element && handlers) {
            element.removeEventListener("pointermove", handlers.handlePointerMove);
            element.removeEventListener("pointerleave", handlers.handlePointerLeave);
        }
        this._vueCompatCanvasElement = null;
        this._vueCompatCanvasHandlers = null;
        this._vueCompatForwardingNodePointer = false;
        this.teardownVueCompatCanvasLayout();
    },

    installVueNodesCompatibilityWidget() {
        if (this.vueCompatWidget || !this.node.addCustomWidget) return;

        const self = this;
        const widget = {
            name: VUE_COMPAT_WIDGET_NAME,
            type: VUE_COMPAT_WIDGET_NAME,
            value: null,
            serialize: false,
            options: {},
            computeLayoutSize() {
                if (!self.isVueNodesMode()) {
                    return { minWidth: 0, minHeight: 0, maxHeight: 0 };
                }
                const height = self.getVueCompatWidgetHeight();
                return {
                    minWidth: 330,
                    minHeight: height,
                    maxHeight: self.collapsedSections?.extraControls ? 100000 : height
                };
            },
            draw(ctx, _node, width, y, height) {
                if (!self.isVueNodesMode()) return;

                self._vueCompatWidgetWidth = width;
                self.bindVueCompatCanvasEvents(ctx.canvas);
                self.updateVueCompatCanvasLayout(ctx.canvas);
                const preparedDraw = self.prepareVueCompatCanvasDraw(ctx, width, height, widget);
                ctx = preparedDraw.ctx;
                height = preparedDraw.height;
                const minimumHeight = self.getVueCompatWidgetHeight();
                const renderedCanvasHeight = Number(height)
                    || Number(widget.computedHeight)
                    || minimumHeight;
                const contentHeight = self.collapsedSections?.extraControls
                    ? Math.max(minimumHeight, renderedCanvasHeight)
                    : minimumHeight;
                self._vueCompatWidgetHeight = contentHeight;
                if (self.collapsedSections?.extraControls) {
                    self._vueCompatAutoSizedContentHeight = null;
                } else {
                    self.applyVueCompatAutoSize(minimumHeight);
                }
                self.withVueCompatWidgetSize(() => {
                    ctx.save();
                    ctx.translate(0, 1 - y);
                    self.drawInterface(ctx);
                    ctx.restore();
                });
            },
            mouse(e, pos, node) {
                if (!self.isVueNodesMode()) return false;

                self.normalizeVueCompatPointerEvent(e, pos);

                const isPointerDown = e.type === "pointerdown" || e.type === "mousedown";
                const isPointerEnd = e.type === "pointerup"
                    || e.type === "mouseup"
                    || e.type === "pointercancel"
                    || e.buttons === 0;
                if (isPointerDown && self._vueCompatForwardingNodePointer) {
                    self._vueCompatForwardingNodePointer = false;
                }
                if (self._vueCompatForwardingNodePointer) {
                    const forwarded = self.forwardVueCompatNodePointerEvent(e);
                    if (isPointerEnd) self._vueCompatForwardingNodePointer = false;
                    return forwarded;
                }

                const canvas = self.app?.canvas
                    || node.graph?.list_of_graphcanvas?.[0]
                    || globalThis.LGraphCanvas?.active_canvas
                    || null;

                try {
                    return self.withVueCompatWidgetSize(() => {
                        if (node.capture && isPointerDown) {
                            self.handleMouseUp(e);
                        }
                        if (node.capture && (e.type === "pointerup" || e.type === "mouseup" || e.buttons === 0)) {
                            return self.handleMouseUp(e);
                        }
                        if (node.capture) {
                            return self.handleMouseMove(e, null, canvas);
                        }
                        if (isPointerDown) {
                            const handled = node.onMouseDown?.(e, pos, canvas) ?? false;
                            if (handled) return handled;
                            self._vueCompatForwardingNodePointer = true;
                            const forwarded = self.forwardVueCompatNodePointerEvent(e);
                            if (!forwarded) self._vueCompatForwardingNodePointer = false;
                            return forwarded;
                        }
                        return false;
                    });
                } finally {
                    self.requestVueCompatWidgetDraw(true);
                }
            }
        };

        this.vueCompatWidget = this.node.addCustomWidget(widget) || widget;
        log.debug('Installed ResolutionMaster Nodes 2.0 compatibility widget', {
            nodeId: this.node.id ?? null
        });
    },

    ensureMinimumSize() {
        if (this.node.size[0] < 330) {
            this.node.size[0] = 330;
        }
        const neededHeight = this.calculateNeededHeight();
        const preferredHeight = this.userPreferredHeight ?? this.getStoredPreferredHeight() ?? 0;
        const targetHeight = Math.max(neededHeight, preferredHeight, this.node.min_size[1]);

        if (Math.abs(this.node.size[1] - targetHeight) > 1) {
            this._isApplyingAutoSize = true;
            this.node.size[1] = targetHeight;
            this._isApplyingAutoSize = false;
        }
    },

    calculateNeededHeight() {
        const props = this.node.properties;
        if (!props || props.mode !== "Manual") return 0;

        let currentY = this.getManualContentStartY();
        const spacing = this.getManualSpacing();
        const canvasHeight = this.getManualCanvasHeight(currentY, false);
        currentY += canvasHeight + this.getCanvasInfoGap();
        currentY += 15 + spacing;
        if (this.collapsedSections?.extraControls) {
            return currentY + 20;
        }
        const sectionHeights = {
            actions: this.collapsedSections?.actions ? 25 : 55,
            scaling: this.collapsedSections?.scaling ? 25 : 155,
            autoDetect: this.collapsedSections?.autoDetect ? 25 : 135,
            presets: this.collapsedSections?.presets ? 25 : 55
        };
        Object.values(sectionHeights).forEach(height => {
            currentY += height + spacing;
        });
        if (props.showCalcInfo && props.selectedCategory) {
            currentY += this.measureCalcInfoMessage().boxHeight + spacing;
        }

        return currentY + 20;
    },

    getManualContentStartY() {
        return this.collapsedSections?.extraControls ? 2 : LiteGraph.NODE_TITLE_HEIGHT + 2;
    },

    getManualSpacing() {
        return this.collapsedSections?.extraControls ? 4 : 8;
    },

    getCanvasInfoGap() {
        return this.collapsedSections?.extraControls ? 4 : this.getManualSpacing();
    },

    getManualBottomPadding() {
        return this.collapsedSections?.extraControls ? 8 : 20;
    },

    getVueCompatBottomOverlayClearance() {
        return this.isVueNodesMode() && this.collapsedSections?.extraControls ? 25 : 0;
    },

    getManualCanvasHeight(currentY = this.getManualContentStartY(), useAvailableHeight = true) {
        if (!this.collapsedSections?.extraControls) {
            return 200;
        }

        if (!useAvailableHeight) {
            return 200;
        }

        const spacing = this.getManualSpacing();
        const bottomContentHeight = this.collapsedSections?.extraControls
            ? 15 + this.getManualBottomPadding() + this.getVueCompatBottomOverlayClearance()
            : this.getCanvasInfoGap() + 15 + spacing + this.getManualBottomPadding();
        const availableHeight = this.node.size[1] - currentY - bottomContentHeight;
        return Math.max(200, availableHeight);
    },

    normalizeInputSlots() {
        if (!Array.isArray(this.node.inputs) || this.node.inputs.length <= 1) {
            return;
        }

        const inputCount = this.node.inputs.length;
        const keepIndex = this.node.inputs.findIndex(input => input?.link != null);
        const canonicalInput = this.node.inputs[keepIndex >= 0 ? keepIndex : 0];
        canonicalInput.name = canonicalInput.localized_name = "input_image";
        canonicalInput.hidden = false;
        this.node.inputs = [canonicalInput];

        const nodeId = this.node.id ?? null;
        if (nodeId !== -1 && !this.node._resolutionMasterLoggedInputSlotNormalization) {
            this.node._resolutionMasterLoggedInputSlotNormalization = true;
            log.debug('Normalized duplicate ResolutionMaster input slots', {
                nodeId,
                inputCount,
                keptIndex: keepIndex >= 0 ? keepIndex : 0
            });
        }
    },

    applyCompactSlotLabels() {
        this.normalizeInputSlots();
        const isCompact = this.collapsedSections?.extraControls || false;

        this.node.inputs?.forEach(input => {
            input.name = "input_image";
            input.hidden = false;

            if (isCompact) {
                input.label = " ";
                input.localized_name = " ";
                input.displayName = " ";
            } else {
                input.label = "input_image";
                input.localized_name = "input_image";
                input.displayName = "input_image";
            }
        });

        if (!this.node._resolutionMasterHasStoredGetInputLabel) {
            this.node._resolutionMasterOriginalGetInputLabel = this.node.getInputLabel;
            this.node._resolutionMasterHasStoredGetInputLabel = true;
        }
        if (isCompact) {
            this.node.getInputLabel = function(slot) {
                if (slot === 0) return " ";
                return this._resolutionMasterOriginalGetInputLabel
                    ? this._resolutionMasterOriginalGetInputLabel.call(this, slot)
                    : this.inputs?.[slot]?.localized_name || this.inputs?.[slot]?.name || " ";
            };
        } else if (this.node._resolutionMasterHasStoredGetInputLabel) {
            this.node.getInputLabel = function(slot) {
                if (slot === 0) return "input_image";
                return this._resolutionMasterOriginalGetInputLabel
                    ? this._resolutionMasterOriginalGetInputLabel.call(this, slot)
                    : this.inputs?.[slot]?.localized_name || this.inputs?.[slot]?.name || "";
            };
        }

        this.node.outputs?.forEach(output => {
            output.hidden = false;
            output.name = output.localized_name = "";
        });
    },

    setupNode() {
        const node = this.node;
        const self = this;
        node.resolutionMaster = this;
        this.installCanvasDragZoomBypass();
        node.size = [330, 400];
        node.min_size = [330, 200];
        this.applyCompactSlotLabels();
        this.installVueNodesCompatibilityWidget();
        if (node.outputs) {
            node.outputs.forEach(output => {
                output.hidden = false;
                output.name = output.localized_name = "";
            });
        }
        const widthWidget = node.widgets?.find(w => w.name === 'width');
        const heightWidget = node.widgets?.find(w => w.name === 'height');
        const modeWidget = node.widgets?.find(w => w.name === 'mode');
        const latentTypeWidget = node.widgets?.find(w => w.name === 'latent_type');
        const autoDetectWidget = node.widgets?.find(w => w.name === 'auto_detect');
        const autoDetectSourceWidget = node.widgets?.find(w => w.name === 'auto_detect_source');
        const autoDetectWidthWidget = node.widgets?.find(w => w.name === 'auto_detect_width');
        const autoDetectHeightWidget = node.widgets?.find(w => w.name === 'auto_detect_height');
        const autoFitOnChangeWidget = node.widgets?.find(w => w.name === 'auto_fit_on_change');
        const autoResizeOnChangeWidget = node.widgets?.find(w => w.name === 'auto_resize_on_change');
        const autoSnapOnChangeWidget = node.widgets?.find(w => w.name === 'auto_snap_on_change');
        const smartFitWidget = node.widgets?.find(w => w.name === 'smart_fit');
        const useCustomCalcWidget = node.widgets?.find(w => w.name === 'use_custom_calc');
        const preserveScalingRatioWidget = node.widgets?.find(w => w.name === 'preserve_scaling_ratio');
        const selectedCategoryWidget = node.widgets?.find(w => w.name === 'selected_category');
        const snapValueWidget = node.widgets?.find(w => w.name === 'snap_value');
        const upscaleValueWidget = node.widgets?.find(w => w.name === 'upscale_value');
        const targetResolutionWidget = node.widgets?.find(w => w.name === 'target_resolution');
        const targetMegapixelsWidget = node.widgets?.find(w => w.name === 'target_megapixels');
        const autoDetectPresetsJSONWidget = node.widgets?.find(w => w.name === 'auto_detect_presets_json');
        const rescaleModeWidget = node.widgets?.find(w => w.name === 'rescale_mode');
        const rescaleValueWidget = node.widgets?.find(w => w.name === 'rescale_value');
        const batchSizeWidget = node.widgets?.find(w => w.name === 'batch_size');
        if (!widthWidget || !heightWidget) {
            log.error('ResolutionMaster required dimension widgets were not found', {
                nodeId: node.id ?? null,
                hasWidthWidget: !!widthWidget,
                hasHeightWidget: !!heightWidget,
                widgetNames: node.widgets?.map(widget => widget.name) || []
            });
        }
        if (rescaleModeWidget) {
            rescaleModeWidget.value = node.properties.rescaleMode;
        }
        if (rescaleValueWidget) {
            const rescaleValue = Math.max(0, Math.min(100, Number(node.properties.rescaleValue) || 1));
            node.properties.rescaleValue = rescaleValue;
            rescaleValueWidget.value = rescaleValue;
        }
        if (autoDetectSourceWidget) {
            autoDetectSourceWidget.value = node.properties.autoDetectSource || "backend";
        }
        if (autoDetectWidthWidget) {
            autoDetectWidthWidget.value = node.properties.autoDetectWidth || 0;
        }
        if (autoDetectHeightWidget) {
            autoDetectHeightWidget.value = node.properties.autoDetectHeight || 0;
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
        this.autoDetectSourceWidget = autoDetectSourceWidget;
        this.autoDetectWidthWidget = autoDetectWidthWidget;
        this.autoDetectHeightWidget = autoDetectHeightWidget;
        this.backendFallbackWidgets = {
            autoFitOnChange: autoFitOnChangeWidget,
            autoResizeOnChange: autoResizeOnChangeWidget,
            autoSnapOnChange: autoSnapOnChangeWidget,
            smartFit: smartFitWidget,
            useCustomCalc: useCustomCalcWidget,
            preserveScalingRatio: preserveScalingRatioWidget,
            selectedCategory: selectedCategoryWidget,
            snapValue: snapValueWidget,
            upscaleValue: upscaleValueWidget,
            targetResolution: targetResolutionWidget,
            targetMegapixels: targetMegapixelsWidget,
            autoDetectPresetsJSON: autoDetectPresetsJSONWidget
        };
        this.rescaleModeWidget = rescaleModeWidget;
        this.rescaleValueWidget = rescaleValueWidget;
        this.batchSizeWidget = batchSizeWidget;
        // Latent type is manually controlled via LAT selector.
        node.onDrawForeground = function(ctx) {
            if (this.flags.collapsed || self.isVueNodesMode()) return;
            self.ensureMinimumSize();
            self.drawInterface(ctx);
        };
        node.onMouseDown = function(e, pos, canvas) {
            const relX = e.canvasX - this.pos[0];
            const relY = e.canvasY - this.pos[1];
            if (self.controls.compactHelpBtn && self.isPointInControl(relX, relY, self.controls.compactHelpBtn)) {
                self.showHelpDialog();
                return true;
            }
            if (self.controls.compactToggleBtn && self.isPointInControl(relX, relY, self.controls.compactToggleBtn)) {
                self.handleSectionHeaderClick('extraControlsHeader');
                return true;
            }
            if (relY < 0) return false;
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
        const origOnConnectionsChange = node.onConnectionsChange;
        node.onConnectionsChange = function() {
            const result = origOnConnectionsChange?.apply(this, arguments);
            self.applyCompactSlotLabels();
            if (self.node.properties.autoDetect) {
                self.markLivePreviewPending('connection changed');
                self.refreshLivePreviewWatcher();
                self.scheduleAutoDetectCheck('connection changed', 0);
            } else {
                self.teardownLivePreviewWatcher();
            }
            return result;
        };
        const origOnSerialize = node.onSerialize;
        node.onSerialize = function() {
            self.syncAutoDetectSourceState();
            self.syncBackendFallbackWidgets();
            const result = origOnSerialize?.apply(this, arguments);
            self.ensureCanonicalPackageMetadata(arguments[0]);
            return result;
        };
        node.onResize = function() {
            if (!self._isApplyingAutoSize && !self.isVueNodesMode()) {
                self.storePreferredHeight(this.size[1]);
            }
            if (!self.isVueNodesMode()) {
                self.ensureMinimumSize();
            }
            self.requestVueCompatWidgetDraw(true);
            self.requestCanvasUpdate(true);
        };
        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            self.stopAutoDetect();
            self.teardownVueCompatCanvasEvents();
            if (self.tooltipTimer) {
                clearTimeout(self.tooltipTimer);
                self.tooltipTimer = null;
            }
            if (self.customValueDialogManager.customInputDialog) {
                self.customValueDialogManager.closeCustomInputDialog();
            }
            if (origOnRemoved) origOnRemoved.apply(this, arguments);
        };
        node.onGraphConfigured = function() {
            this.configured = true;

            // Defer initialization to next frame to avoid interfering with ComfyUI's graph setup.
            requestAnimationFrame(() => {
                if (!this.graph) return;

                self.customPresetsManager.loadCustomPresets();
                log.debug('Reloaded custom presets after graph configured');

                self.collapsedSections = {
                    actions: this.properties.section_actions_collapsed,
                    scaling: this.properties.section_scaling_collapsed,
                    autoDetect: this.properties.section_autoDetect_collapsed,
                    presets: this.properties.section_presets_collapsed,
                    extraControls: this.properties.section_extraControls_collapsed
                };
                self.userPreferredHeight = self.getStoredPreferredHeight();
                self.applyCompactSlotLabels();

                // Update internal position from saved properties.
                self.updateCanvasFromWidgets();
                self.updateRescaleValue();

                // Start auto-detect after everything is initialized.
                if (this.properties.autoDetect) {
                    self.startAutoDetect();
                }
            });
        };
        [
            widthWidget,
            heightWidget,
            modeWidget,
            latentTypeWidget,
            autoDetectWidget,
            autoDetectSourceWidget,
            autoDetectWidthWidget,
            autoDetectHeightWidget,
            ...Object.values(this.backendFallbackWidgets),
            rescaleModeWidget,
            rescaleValueWidget,
            batchSizeWidget
        ].forEach(widget => {
            if (widget) {
                widget.hidden = true;
                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
                widget.options = widget.options || {};
                widget.options.canvasOnly = true;
            }
        });
        this.syncBackendFallbackWidgets();
        log.debug('ResolutionMaster node lifecycle hooks installed', {
            nodeId: node.id ?? null,
            hasAutoDetectWidget: !!autoDetectWidget,
            hasLatentTypeWidget: !!latentTypeWidget,
            hiddenWidgetCount: node.widgets?.filter(widget => widget.hidden).length || 0
        });
    },

    getPreferredHeightPropertyKey(isCompact = this.collapsedSections?.extraControls) {
        return isCompact ? 'preferred_compact_height' : 'preferred_expanded_height';
    },

    getStoredPreferredHeight(isCompact = this.collapsedSections?.extraControls) {
        const value = Number(this.node.properties?.[this.getPreferredHeightPropertyKey(isCompact)]);
        return Number.isFinite(value) && value > 0 ? value : null;
    },

    storePreferredHeight(height = this.node.size?.[1], isCompact = this.collapsedSections?.extraControls) {
        const value = Math.max(Number(height) || 0, this.node.min_size?.[1] || 0);
        if (value > 0) {
            this.node.properties[this.getPreferredHeightPropertyKey(isCompact)] = value;
        }
        this.userPreferredHeight = value || null;
    }
};
