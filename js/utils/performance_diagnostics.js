import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger("performance_diagnostics");

const GLOBAL_API_KEY = "ResolutionMasterPerformanceDiagnostics";
const STORAGE_KEY = "ResolutionMaster.performanceDiagnostics";
const REPORT_INTERVAL_MS = 5000;
const SLOW_SAMPLE_MS = 16;
const MAX_RECENT_SAMPLES = 20;
const MAX_LONG_TASKS = 100;
const MAX_FRAME_GAPS = 100;
const FRAME_GAP_THRESHOLD_MS = 50;
const LITEGRAPH_CANVAS_METHODS = [
    ["draw", "litegraph.draw"],
    ["drawBackCanvas", "litegraph.drawBackCanvas"],
    ["drawFrontCanvas", "litegraph.drawFrontCanvas"],
    ["processMouseMove", "litegraph.processMouseMove"]
];

const operations = new Map();
const longTasks = [];
const frameGaps = [];
const liteGraphOriginalMethods = new Map();

let enabled = false;
let autoReport = false;
let reportTimer = null;
let longTaskObserver = null;
let longTaskSupportLogged = false;
let frameGapMonitorId = null;
let lastFrameAt = null;
let liteGraphProfilerInstalled = false;
let liteGraphProfilerUnavailableLogged = false;

function getNow() {
    return globalThis.performance?.now?.() ?? Date.now();
}

function isTruthy(value) {
    return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function getStoredEnabled() {
    try {
        return isTruthy(globalThis.localStorage?.getItem(STORAGE_KEY));
    } catch {
        return false;
    }
}

function getUrlEnabled() {
    try {
        const params = new URLSearchParams(globalThis.location?.search || "");
        return isTruthy(params.get("resolutionMasterPerf")) || isTruthy(params.get("rmPerf"));
    } catch {
        return false;
    }
}

function setStoredEnabled(nextEnabled) {
    try {
        if (nextEnabled) {
            globalThis.localStorage?.setItem(STORAGE_KEY, "1");
        } else {
            globalThis.localStorage?.removeItem(STORAGE_KEY);
        }
    } catch {
        // localStorage can be unavailable in restricted browser contexts.
    }
}

function getOperationStats(operationName) {
    if (!operations.has(operationName)) {
        operations.set(operationName, {
            operation: operationName,
            count: 0,
            totalMs: 0,
            minMs: Number.POSITIVE_INFINITY,
            maxMs: 0,
            slowCount: 0,
            lastMs: 0,
            recent: []
        });
    }
    return operations.get(operationName);
}

function round(value) {
    return Math.round(value * 1000) / 1000;
}

function snapshot() {
    return [...operations.values()]
        .filter(stats => stats.count > 0)
        .map(stats => ({
            operation: stats.operation,
            count: stats.count,
            avgMs: round(stats.totalMs / stats.count),
            minMs: round(stats.minMs),
            maxMs: round(stats.maxMs),
            lastMs: round(stats.lastMs),
            slowCount: stats.slowCount,
            recentMs: stats.recent.map(round).join(", ")
        }))
        .sort((a, b) => b.maxMs - a.maxMs);
}

function normalizeAttribution(entry) {
    const attribution = Array.from(entry.attribution || []);
    if (!attribution.length) return "";

    return attribution
        .map(item => {
            const parts = [
                item.name,
                item.containerType,
                item.containerName,
                item.containerId,
                item.containerSrc
            ].filter(Boolean);
            return parts.join(" | ");
        })
        .filter(Boolean)
        .join("; ");
}

function longTaskSnapshot() {
    return longTasks
        .map(entry => ({
            startMs: round(entry.startTime),
            durationMs: round(entry.duration),
            name: entry.name || "",
            attribution: entry.attribution || ""
        }))
        .sort((a, b) => b.durationMs - a.durationMs);
}

function recordLongTask(entry) {
    longTasks.push({
        startTime: entry.startTime,
        duration: entry.duration,
        name: entry.name,
        attribution: normalizeAttribution(entry)
    });
    if (longTasks.length > MAX_LONG_TASKS) {
        longTasks.shift();
    }
}

function supportsLongTaskObserver() {
    const observer = globalThis.PerformanceObserver;
    return typeof observer === "function"
        && Array.isArray(observer.supportedEntryTypes)
        && observer.supportedEntryTypes.includes("longtask");
}

function startLongTaskObserver() {
    if (longTaskObserver || !enabled) return;
    if (!supportsLongTaskObserver()) {
        if (!longTaskSupportLogged) {
            longTaskSupportLogged = true;
            log.info("Long task diagnostics unavailable in this browser");
        }
        return;
    }

    try {
        const Observer = globalThis.PerformanceObserver;
        longTaskObserver = new Observer((list) => {
            list.getEntries().forEach(recordLongTask);
        });
        try {
            longTaskObserver.observe({ type: "longtask", buffered: true });
        } catch {
            longTaskObserver.observe({ entryTypes: ["longtask"] });
        }
        log.info("Long task diagnostics enabled");
    } catch (error) {
        longTaskObserver = null;
        log.warn("Failed to enable long task diagnostics", error);
    }
}

function stopLongTaskObserver() {
    if (!longTaskObserver) return;

    try {
        longTaskObserver.disconnect();
    } catch {
        // Some browser implementations can throw during teardown.
    }
    longTaskObserver = null;
}

function getPageState() {
    const documentRef = globalThis.document;
    let hasFocus = null;
    try {
        hasFocus = typeof documentRef?.hasFocus === "function" ? documentRef.hasFocus() : null;
    } catch {
        hasFocus = null;
    }

    return {
        visibilityState: documentRef?.visibilityState || "",
        hidden: typeof documentRef?.hidden === "boolean" ? documentRef.hidden : null,
        hasFocus
    };
}

function recordFrameGap(startTime, endTime) {
    const duration = endTime - startTime;
    if (duration < FRAME_GAP_THRESHOLD_MS) return;

    frameGaps.push({
        startTime,
        endTime,
        duration,
        ...getPageState()
    });
    if (frameGaps.length > MAX_FRAME_GAPS) {
        frameGaps.shift();
    }
}

function frameGapSnapshot() {
    return frameGaps
        .map(entry => ({
            startMs: round(entry.startTime),
            endMs: round(entry.endTime),
            durationMs: round(entry.duration),
            visibilityState: entry.visibilityState,
            hidden: entry.hidden,
            hasFocus: entry.hasFocus
        }))
        .sort((a, b) => b.durationMs - a.durationMs);
}

function startFrameGapMonitor() {
    if (frameGapMonitorId !== null || !enabled) return;
    const requestFrame = globalThis.requestAnimationFrame;
    if (typeof requestFrame !== "function") return;

    lastFrameAt = null;
    const tick = (timestamp) => {
        frameGapMonitorId = null;
        if (!enabled) return;

        const now = Number.isFinite(timestamp) ? timestamp : getNow();
        if (lastFrameAt !== null) {
            recordFrameGap(lastFrameAt, now);
        }
        lastFrameAt = now;
        frameGapMonitorId = requestFrame(tick);
    };
    frameGapMonitorId = requestFrame(tick);
}

function stopFrameGapMonitor() {
    if (frameGapMonitorId !== null) {
        globalThis.cancelAnimationFrame?.(frameGapMonitorId);
    }
    frameGapMonitorId = null;
    lastFrameAt = null;
}

function getLiteGraphCanvasPrototype() {
    return globalThis.LGraphCanvas?.prototype || globalThis.LiteGraph?.LGraphCanvas?.prototype || null;
}

function installLiteGraphProfiler() {
    if (liteGraphProfilerInstalled || !enabled) return;

    const prototype = getLiteGraphCanvasPrototype();
    if (!prototype) {
        if (!liteGraphProfilerUnavailableLogged) {
            liteGraphProfilerUnavailableLogged = true;
            log.info("LiteGraph canvas profiler unavailable");
        }
        return;
    }

    const installedMethods = [];
    LITEGRAPH_CANVAS_METHODS.forEach(([methodName, operationName]) => {
        const original = prototype[methodName];
        if (typeof original !== "function" || original.__resolutionMasterPerfWrapped) return;

        const wrapped = function(...args) {
            const token = start(operationName);
            try {
                return original.apply(this, args);
            } finally {
                end(token);
            }
        };
        Object.defineProperty(wrapped, "__resolutionMasterPerfWrapped", { value: true });
        Object.defineProperty(wrapped, "__resolutionMasterPerfOriginal", { value: original });
        liteGraphOriginalMethods.set(methodName, original);
        prototype[methodName] = wrapped;
        installedMethods.push(methodName);
    });

    liteGraphProfilerInstalled = installedMethods.length > 0 || liteGraphOriginalMethods.size > 0;
    if (installedMethods.length) {
        log.info("LiteGraph canvas profiler enabled", { methods: installedMethods });
    }
}

function diagnosticsState() {
    return {
        enabled,
        autoReport,
        longTaskSupported: supportsLongTaskObserver(),
        longTaskObserverActive: !!longTaskObserver,
        frameGapMonitorActive: frameGapMonitorId !== null,
        liteGraphProfilerActive: liteGraphProfilerInstalled,
        liteGraphProfiledMethods: [...liteGraphOriginalMethods.keys()],
        ...getPageState()
    };
}

function scheduleReport() {
    if (!enabled || !autoReport || reportTimer) return;

    reportTimer = globalThis.setTimeout?.(() => {
        reportTimer = null;
        report("periodic");
    }, REPORT_INTERVAL_MS) ?? null;
}

function report(reason = "manual") {
    const data = snapshot();
    const longTaskData = longTaskSnapshot();
    const frameGapData = frameGapSnapshot();
    const state = diagnosticsState();
    if (!data.length && !longTaskData.length && !frameGapData.length) {
        log.info("Performance diagnostics: no samples collected yet", { reason });
        return { operations: data, longTasks: longTaskData, frameGaps: frameGapData, state };
    }

    log.info("Performance diagnostics report", {
        reason,
        samples: data.length,
        longTasks: longTaskData.length,
        frameGaps: frameGapData.length,
        ...state
    });
    if (typeof console.table === "function") {
        if (data.length) {
            console.table(data);
        }
        if (longTaskData.length) {
            console.table(longTaskData);
        }
        if (frameGapData.length) {
            console.table(frameGapData);
        }
    } else {
        console.log({ operations: data, longTasks: longTaskData, frameGaps: frameGapData, state });
    }
    return { operations: data, longTasks: longTaskData, frameGaps: frameGapData, state };
}

function reset() {
    operations.clear();
    longTasks.length = 0;
    frameGaps.length = 0;
    lastFrameAt = null;
    log.info("Performance diagnostics reset");
}

function record(operationName, durationMs) {
    if (!enabled || !Number.isFinite(durationMs)) return;

    const stats = getOperationStats(operationName);
    stats.count += 1;
    stats.totalMs += durationMs;
    stats.minMs = Math.min(stats.minMs, durationMs);
    stats.maxMs = Math.max(stats.maxMs, durationMs);
    stats.lastMs = durationMs;
    if (durationMs >= SLOW_SAMPLE_MS) {
        stats.slowCount += 1;
    }
    stats.recent.push(durationMs);
    if (stats.recent.length > MAX_RECENT_SAMPLES) {
        stats.recent.shift();
    }

    scheduleReport();
}

function start(operationName) {
    if (!enabled) return null;
    return {
        operationName,
        startedAt: getNow()
    };
}

function end(token) {
    if (!token) return;
    record(token.operationName, getNow() - token.startedAt);
}

function recordSince(operationName, startedAt) {
    if (!enabled || !Number.isFinite(startedAt)) return;
    record(operationName, getNow() - startedAt);
}

function measure(operationName, callback) {
    if (!enabled) return callback();

    const token = start(operationName);
    try {
        return callback();
    } finally {
        end(token);
    }
}

function enable(options = {}) {
    enabled = true;
    autoReport = !!options.autoReport;
    startLongTaskObserver();
    startFrameGapMonitor();
    installLiteGraphProfiler();
    if (options.persist !== false) {
        setStoredEnabled(true);
    }
    log.info("Performance diagnostics enabled", {
        storageKey: STORAGE_KEY,
        api: GLOBAL_API_KEY,
        autoReport
    });
}

function disable(options = {}) {
    if (enabled && options.report !== false) {
        report("disabled");
    }
    enabled = false;
    autoReport = false;
    stopLongTaskObserver();
    stopFrameGapMonitor();
    if (options.persist !== false) {
        setStoredEnabled(false);
    }
    if (reportTimer) {
        globalThis.clearTimeout?.(reportTimer);
        reportTimer = null;
    }
    log.info("Performance diagnostics disabled");
}

function isEnabled() {
    return enabled;
}

function setAutoReport(nextAutoReport = true) {
    autoReport = !!nextAutoReport;
    if (!autoReport && reportTimer) {
        globalThis.clearTimeout?.(reportTimer);
        reportTimer = null;
    }
    scheduleReport();
    return autoReport;
}

export const performanceDiagnostics = {
    enable,
    disable,
    end,
    frameGaps: frameGapSnapshot,
    isEnabled,
    longTasks: longTaskSnapshot,
    measure,
    now: getNow,
    record,
    recordSince,
    report,
    reset,
    setAutoReport,
    snapshot,
    start
};

globalThis[GLOBAL_API_KEY] = performanceDiagnostics;

if (getStoredEnabled() || getUrlEnabled()) {
    enable({ persist: false });
}
