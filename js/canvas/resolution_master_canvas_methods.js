import { createAspectLock, getAspectLockedDimensions } from "./aspect_ratio_math.js";
import { createModuleLogger } from "../log_system/log_funcs.js";
import { performanceDiagnostics } from "../utils/performance_diagnostics.js";

const log = createModuleLogger('resolution_master_canvas_methods');

export const canvasMethods = {
    /**
     * Safely request a canvas update - prevents multiple rapid updates during initialization
     * and graph configuration that can cause ComfyUI freezing issues.
     */
    requestCanvasUpdate(force = false) {
        const diagnosticsToken = performanceDiagnostics.start("requestCanvasUpdate");
        try {
            if (this._isInitializing && !force) {
                this._pendingCanvasUpdate = true;
                return;
            }

            const graph = this.app?.graph;
            if (!graph) {
                this._pendingCanvasUpdate = true;
                return;
            }

            if (!this._canvasUpdateScheduled) {
                const scheduledAt = performanceDiagnostics.isEnabled() ? performanceDiagnostics.now() : null;
                this._canvasUpdateScheduled = true;
                requestAnimationFrame(() => {
                    performanceDiagnostics.recordSince("requestCanvasUpdate.frameDelay", scheduledAt);
                    const dirtyToken = performanceDiagnostics.start("requestCanvasUpdate.setDirtyCanvas");
                    try {
                        this._canvasUpdateScheduled = false;
                        this._pendingCanvasUpdate = false;
                        this.app?.graph?.setDirtyCanvas(true);
                    } finally {
                        performanceDiagnostics.end(dirtyToken);
                    }
                });
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    validateWidgets() {
        return this.widthWidget && this.heightWidget;
    },

    reportMissingDimensionWidgets(context) {
        if (this._loggedMissingDimensionWidgets) return;
        this._loggedMissingDimensionWidgets = true;
        log.warn(`${context}: width/height widgets are unavailable`, {
            nodeId: this.node?.id ?? null,
            hasWidthWidget: !!this.widthWidget,
            hasHeightWidget: !!this.heightWidget
        });
    },

    syncCanvasPositionFromDimensions(width = this.node.properties.valueX, height = this.node.properties.valueY) {
        const props = this.node.properties;
        const rangeX = props.canvas_max_x - props.canvas_min_x;
        const rangeY = props.canvas_max_y - props.canvas_min_y;

        if (rangeX > 0) {
            this.node.intpos.x = (width - props.canvas_min_x) / rangeX;
            this.node.intpos.x = Math.max(0, Math.min(1, this.node.intpos.x));
        }
        if (rangeY > 0) {
            this.node.intpos.y = (height - props.canvas_min_y) / rangeY;
            this.node.intpos.y = Math.max(0, Math.min(1, this.node.intpos.y));
        }
    },

    setDimensions(width, height, options = {}) {
        const diagnosticsToken = performanceDiagnostics.start("setDimensions");
        try {
            if (!this.validateWidgets()) {
                this.reportMissingDimensionWidgets('setDimensions');
                return;
            }
            this.node.properties.valueX = width;
            this.node.properties.valueY = height;
            this.widthWidget.value = width;
            this.heightWidget.value = height;
            if (options.syncPosition !== false) {
                this.syncCanvasPositionFromDimensions(width, height);
            }
            if (options.updateBackend !== false) {
                this.updateRescaleValue();
            }

            if (options.updateCanvas !== false) {
                this.requestCanvasUpdate();
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    updateCanvasFromWidgets(options = {}) {
        const diagnosticsToken = performanceDiagnostics.start("updateCanvasFromWidgets");
        try {
            if (!this.validateWidgets()) {
                this.reportMissingDimensionWidgets('updateCanvasFromWidgets');
                return;
            }

            const node = this.node;
            const props = node.properties;
            props.valueX = this.widthWidget.value;
            props.valueY = this.heightWidget.value;
            this.syncCanvasPositionFromDimensions(this.widthWidget.value, this.heightWidget.value);
            if (options.updateBackend !== false) {
                this.updateRescaleValue();
            }
            this.requestCanvasUpdate();
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    updateCanvasValue(x, y, w, h, shiftKey, ctrlKey) {
        const diagnosticsToken = performanceDiagnostics.start("updateCanvasValue");
        try {
            const node = this.node;
            const props = node.properties;

            let vX = Math.max(0, Math.min(1, x / w));
            let vY = Math.max(0, Math.min(1, 1 - y / h));
            if (ctrlKey && shiftKey) {
                let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
                let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
                const lockedDimensions = this.getAspectLockedDimensions(newX, newY);
                newX = lockedDimensions.width;
                newY = lockedDimensions.height;
                vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
                vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
            } else if (shiftKey && !ctrlKey) {
                let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
                let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
                const lockedDimensions = this.getAspectLockedDimensions(newX, newY, true);
                newX = lockedDimensions.width;
                newY = lockedDimensions.height;
                vX = (newX - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
                vY = (newY - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);
            } else if (ctrlKey && !shiftKey) {
            } else {
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
                this.setDimensions(newX, newY, { syncPosition: false });
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    createAspectLock() {
        const width = Math.max(1, Math.round(Number(this.widthWidget?.value) || this.node.properties.valueX || 1));
        const height = Math.max(1, Math.round(Number(this.heightWidget?.value) || this.node.properties.valueY || 1));
        return createAspectLock(width, height);
    },

    getCanvasAspectLock() {
        if (!this.canvasDragAspectLock) {
            this.canvasDragAspectLock = this.createAspectLock();
        }
        return this.canvasDragAspectLock;
    },

    getAspectLockedDimensions(targetWidth, targetHeight, snapToGrid = false) {
        return getAspectLockedDimensions(
            targetWidth,
            targetHeight,
            this.node.properties,
            this.getCanvasAspectLock(),
            snapToGrid
        );
    },

    updateCanvasValueWidth(x, w, ctrlKey) {
        const diagnosticsToken = performanceDiagnostics.start("updateCanvasValueWidth");
        try {
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
            if (props.valueX !== newX) {
                this.setDimensions(newX, this.heightWidget.value, { syncPosition: false });
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    updateCanvasValueHeight(y, h, ctrlKey) {
        const diagnosticsToken = performanceDiagnostics.start("updateCanvasValueHeight");
        try {
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
            if (props.valueY !== newY) {
                this.setDimensions(this.widthWidget.value, newY, { syncPosition: false });
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    isPointInControl(x, y, control) {
        if (!control) return false;
        return x >= control.x && x <= control.x + control.w &&
               y >= control.y && y <= control.y + control.h;
    }
};
