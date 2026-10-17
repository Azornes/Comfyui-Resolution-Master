import { createAspectLock, getAspectLockedDimensions } from "./aspect_ratio_math.js";
import { createModuleLogger } from "../log_system/log_funcs.js";
import { performanceDiagnostics } from "../utils/performance_diagnostics.js";

const log = createModuleLogger('resolution_master_canvas_methods');

/**
 * Maps a coordinate or normalized position to a value along a canvas axis,
 * applying optional step snapping and decimal rounding.
 *
 * @param {Object} params
 * @param {number} [params.coord] - Raw coordinate on the axis
 * @param {number} [params.size] - Axis dimension size
 * @param {number} [params.normalizedPos] - Pre-calculated normalized position [0..1]
 * @param {boolean} [params.isInverse=false] - Whether coordinate is inverted (e.g., Y axis)
 * @param {number} params.min - Minimum value for the axis
 * @param {number} params.max - Maximum value for the axis
 * @param {number} params.step - Step snapping interval
 * @param {number} [params.decimals=0] - Number of decimal places
 * @param {boolean} [params.shouldSnap=true] - Whether to snap to step
 * @returns {{ normalizedPos: number, value: number }}
 */
export function calculateCanvasAxisValue({
    coord,
    size,
    normalizedPos,
    isInverse = false,
    min,
    max,
    step,
    decimals = 0,
    shouldSnap = true
}) {
    let normPos = normalizedPos !== undefined
        ? normalizedPos
        : (isInverse ? 1 - coord / size : coord / size);
    normPos = Math.max(0, Math.min(1, normPos));

    const range = max - min;
    if (shouldSnap && range > 0 && step > 0) {
        const stepScale = step / range;
        normPos = Math.round(normPos / stepScale) * stepScale;
    }

    let value = min + range * normPos;
    const rn = Math.pow(10, decimals);
    value = Math.round(rn * value) / rn;

    return { normalizedPos: normPos, value };
}

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
                        this.requestVueCompatWidgetDraw(true);
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

            let resX;
            let resY;

            if (shiftKey) {
                let vX = Math.max(0, Math.min(1, x / w));
                let vY = Math.max(0, Math.min(1, 1 - y / h));
                let newX = props.canvas_min_x + (props.canvas_max_x - props.canvas_min_x) * vX;
                let newY = props.canvas_min_y + (props.canvas_max_y - props.canvas_min_y) * vY;
                const snapToGrid = !ctrlKey;
                const lockedDimensions = this.getAspectLockedDimensions(newX, newY, snapToGrid);
                vX = (lockedDimensions.width - props.canvas_min_x) / (props.canvas_max_x - props.canvas_min_x);
                vY = (lockedDimensions.height - props.canvas_min_y) / (props.canvas_max_y - props.canvas_min_y);

                resX = calculateCanvasAxisValue({
                    normalizedPos: vX,
                    min: props.canvas_min_x,
                    max: props.canvas_max_x,
                    step: props.canvas_step_x,
                    decimals: props.canvas_decimals_x,
                    shouldSnap: false
                });
                resY = calculateCanvasAxisValue({
                    normalizedPos: vY,
                    min: props.canvas_min_y,
                    max: props.canvas_max_y,
                    step: props.canvas_step_y,
                    decimals: props.canvas_decimals_y,
                    shouldSnap: false
                });
            } else {
                resX = calculateCanvasAxisValue({
                    coord: x,
                    size: w,
                    isInverse: false,
                    min: props.canvas_min_x,
                    max: props.canvas_max_x,
                    step: props.canvas_step_x,
                    decimals: props.canvas_decimals_x,
                    shouldSnap: !ctrlKey
                });
                resY = calculateCanvasAxisValue({
                    coord: y,
                    size: h,
                    isInverse: true,
                    min: props.canvas_min_y,
                    max: props.canvas_max_y,
                    step: props.canvas_step_y,
                    decimals: props.canvas_decimals_y,
                    shouldSnap: !ctrlKey
                });
            }

            node.intpos.x = resX.normalizedPos;
            node.intpos.y = resY.normalizedPos;

            if (props.valueX !== resX.value || props.valueY !== resY.value) {
                this.setDimensions(resX.value, resY.value, { syncPosition: false });
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

    updateCanvasValueDimension(axis, coord, size, ctrlKey) {
        const axisUpper = axis.toUpperCase();
        const diagnosticsToken = performanceDiagnostics.start(`updateCanvasValueDimension${axisUpper}`);
        try {
            const node = this.node;
            const props = node.properties;
            const isX = axis === 'x';

            const res = calculateCanvasAxisValue({
                coord,
                size,
                isInverse: !isX,
                min: props[`canvas_min_${axis}`],
                max: props[`canvas_max_${axis}`],
                step: props[`canvas_step_${axis}`],
                decimals: props[`canvas_decimals_${axis}`],
                shouldSnap: !ctrlKey
            });

            node.intpos[axis] = res.normalizedPos;

            const propName = isX ? 'valueX' : 'valueY';
            if (props[propName] !== res.value) {
                if (isX) {
                    this.setDimensions(res.value, this.heightWidget.value, { syncPosition: false });
                } else {
                    this.setDimensions(this.widthWidget.value, res.value, { syncPosition: false });
                }
            }
        } finally {
            performanceDiagnostics.end(diagnosticsToken);
        }
    },

    updateCanvasValueWidth(x, w, ctrlKey) {
        this.updateCanvasValueDimension('x', x, w, ctrlKey);
    },

    updateCanvasValueHeight(y, h, ctrlKey) {
        this.updateCanvasValueDimension('y', y, h, ctrlKey);
    },

    isPointInControl(x, y, control) {
        if (!control) return false;
        return x >= control.x && x <= control.x + control.w &&
               y >= control.y && y <= control.y + control.h;
    }
};
