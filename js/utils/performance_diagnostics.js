import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger("performance_diagnostics");

const GLOBAL_API_KEY = "ResolutionMasterPerformanceDiagnostics";
const STORAGE_KEY = "ResolutionMaster.performanceDiagnostics";
const REPORT_INTERVAL_MS = 5000;
const SLOW_SAMPLE_MS = 16;
const MAX_RECENT_SAMPLES = 20;
const MAX_LONG_TASKS = 100;
const MAX_LONG_ANIMATION_FRAMES = 100;
const MAX_EVENT_TIMINGS = 100;
const MAX_FRAME_GAPS = 100;
const FRAME_GAP_THRESHOLD_MS = 50;
const MAX_EVENT_LOOP_GAPS = 100;
const EVENT_LOOP_INTERVAL_MS = 100;
const EVENT_LOOP_DELAY_THRESHOLD_MS = 100;
const EVENT_TIMING_THRESHOLD_MS = 16;
const LITEGRAPH_CANVAS_METHODS = [
    ["draw", "litegraph.draw"],
    ["drawBackCanvas", "litegraph.drawBackCanvas"],
    ["drawFrontCanvas", "litegraph.drawFrontCanvas"],
    ["processMouseMove", "litegraph.processMouseMove"]
];
const GRAPH_CANVAS_HANDLER_EVENTS = [
    "pointermove",
    "mousemove",
    "pointerdown",
    "pointerup",
    "pointercancel",
    "wheel"
];

const operations = new Map();
const longTasks = [];
const longAnimationFrames = [];
const eventTimings = [];
const frameGaps = [];
const eventLoopGaps = [];
const liteGraphOriginalMethods = new Map();
const graphCanvasProfiledHandlers = new Set();

let enabled = false;
let autoReport = false;
let reportTimer = null;
let longTaskObserver = null;
let longTaskSupportLogged = false;
let longAnimationFrameObserver = null;
let longAnimationFrameSupportLogged = false;
let eventTimingObserver = null;
let eventTimingSupportLogged = false;
let frameGapMonitorId = null;
let lastFrameAt = null;
let eventLoopMonitorId = null;
let lastEventLoopAt = null;
let liteGraphProfilerInstalled = false;
let liteGraphProfilerUnavailableLogged = false;
let graphCanvasHandlerProfilerInstalled = false;
let graphCanvasHandlerProfilerUnavailableLogged = false;

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

function getProfilerFunctionName(operationName) {
    return `resolutionMasterPerf_${operationName.replace(/[^a-zA-Z0-9_$]+/g, "_")}`;
}

function tagProfilerWrapper(wrapper, original, operationName) {
    Object.defineProperty(wrapper, "__resolutionMasterPerfWrapped", { value: true });
    Object.defineProperty(wrapper, "__resolutionMasterPerfOriginal", { value: original });
    Object.defineProperty(wrapper, "__resolutionMasterPerfOperation", { value: operationName });
    try {
        Object.defineProperty(wrapper, "name", {
            configurable: true,
            value: getProfilerFunctionName(operationName)
        });
    } catch {
        // Function names are only a diagnostic hint; older runtimes may keep them read-only.
    }
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

function supportsPerformanceEntry(entryType) {
    const observer = globalThis.PerformanceObserver;
    return typeof observer === "function"
        && Array.isArray(observer.supportedEntryTypes)
        && observer.supportedEntryTypes.includes(entryType);
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

function normalizeScriptTimings(entry) {
    const scripts = Array.from(entry.scripts || []);
    if (!scripts.length) return "";

    return scripts
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map(script => {
            const duration = `${round(script.duration)}ms`;
            const source = script.sourceURL || script.invoker || script.sourceFunctionName || script.name || "unknown";
            const details = [
                script.sourceFunctionName,
                script.invokerType,
                script.invoker
            ].filter(Boolean);
            return [duration, source, ...details].join(" | ");
        })
        .join("; ");
}

function longAnimationFrameSnapshot() {
    return longAnimationFrames
        .map(entry => ({
            startMs: round(entry.startTime),
            durationMs: round(entry.duration),
            blockingMs: round(entry.blockingDuration),
            scriptCount: entry.scriptCount,
            scriptTotalMs: round(entry.scriptTotalDuration),
            forcedStyleLayoutMs: round(entry.forcedStyleLayoutDuration),
            pauseMs: round(entry.pauseDuration),
            renderStartMs: entry.renderStart === null ? null : round(entry.renderStart),
            styleLayoutStartMs: entry.styleAndLayoutStart === null ? null : round(entry.styleAndLayoutStart),
            scripts: entry.scripts
        }))
        .sort((a, b) => b.durationMs - a.durationMs);
}

function recordLongAnimationFrame(entry) {
    const scripts = Array.from(entry.scripts || []);
    longAnimationFrames.push({
        startTime: entry.startTime,
        duration: entry.duration,
        blockingDuration: entry.blockingDuration || 0,
        scriptCount: scripts.length,
        scriptTotalDuration: scripts.reduce((total, script) => total + (script.duration || 0), 0),
        forcedStyleLayoutDuration: scripts.reduce((total, script) => total + (script.forcedStyleAndLayoutDuration || 0), 0),
        pauseDuration: scripts.reduce((total, script) => total + (script.pauseDuration || 0), 0),
        renderStart: Number.isFinite(entry.renderStart) ? entry.renderStart : null,
        styleAndLayoutStart: Number.isFinite(entry.styleAndLayoutStart) ? entry.styleAndLayoutStart : null,
        scripts: normalizeScriptTimings(entry)
    });
    if (longAnimationFrames.length > MAX_LONG_ANIMATION_FRAMES) {
        longAnimationFrames.shift();
    }
}

function startLongAnimationFrameObserver() {
    if (longAnimationFrameObserver || !enabled) return;
    if (!supportsPerformanceEntry("long-animation-frame")) {
        if (!longAnimationFrameSupportLogged) {
            longAnimationFrameSupportLogged = true;
            log.info("Long animation frame diagnostics unavailable in this browser");
        }
        return;
    }

    try {
        const Observer = globalThis.PerformanceObserver;
        longAnimationFrameObserver = new Observer((list) => {
            list.getEntries().forEach(recordLongAnimationFrame);
        });
        longAnimationFrameObserver.observe({ type: "long-animation-frame", buffered: true });
        log.info("Long animation frame diagnostics enabled");
    } catch (error) {
        longAnimationFrameObserver = null;
        log.warn("Failed to enable long animation frame diagnostics", error);
    }
}

function stopLongAnimationFrameObserver() {
    if (!longAnimationFrameObserver) return;

    try {
        longAnimationFrameObserver.disconnect();
    } catch {
        // Some browser implementations can throw during teardown.
    }
    longAnimationFrameObserver = null;
}

function describeEventTarget(target) {
    if (!target) return "";

    const tagName = target.tagName ? String(target.tagName).toLowerCase() : "";
    const id = target.id ? `#${target.id}` : "";
    let className = "";
    if (typeof target.className === "string" && target.className.trim()) {
        className = `.${target.className.trim().split(/\s+/).slice(0, 3).join(".")}`;
    }
    return `${tagName}${id}${className}`;
}

function eventTimingSnapshot() {
    return eventTimings
        .map(entry => ({
            startMs: round(entry.startTime),
            durationMs: round(entry.duration),
            inputDelayMs: round(entry.inputDelay),
            processingMs: round(entry.processing),
            presentationDelayMs: round(entry.presentationDelay),
            name: entry.name,
            interactionId: entry.interactionId,
            target: entry.target,
            cancelable: entry.cancelable
        }))
        .sort((a, b) => b.durationMs - a.durationMs);
}

function recordEventTiming(entry) {
    const processing = Math.max(0, entry.processingEnd - entry.processingStart);
    const inputDelay = Math.max(0, entry.processingStart - entry.startTime);
    const presentationDelay = Math.max(0, entry.duration - inputDelay - processing);

    eventTimings.push({
        startTime: entry.startTime,
        duration: entry.duration,
        inputDelay,
        processing,
        presentationDelay,
        name: entry.name || "",
        interactionId: entry.interactionId || 0,
        target: describeEventTarget(entry.target),
        cancelable: typeof entry.cancelable === "boolean" ? entry.cancelable : null
    });
    if (eventTimings.length > MAX_EVENT_TIMINGS) {
        eventTimings.shift();
    }
}

function startEventTimingObserver() {
    if (eventTimingObserver || !enabled) return;
    if (!supportsPerformanceEntry("event")) {
        if (!eventTimingSupportLogged) {
            eventTimingSupportLogged = true;
            log.info("Event timing diagnostics unavailable in this browser");
        }
        return;
    }

    try {
        const Observer = globalThis.PerformanceObserver;
        eventTimingObserver = new Observer((list) => {
            list.getEntries().forEach(recordEventTiming);
        });
        eventTimingObserver.observe({
            type: "event",
            buffered: true,
            durationThreshold: EVENT_TIMING_THRESHOLD_MS
        });
        log.info("Event timing diagnostics enabled");
    } catch (error) {
        eventTimingObserver = null;
        log.warn("Failed to enable event timing diagnostics", error);
    }
}

function stopEventTimingObserver() {
    if (!eventTimingObserver) return;

    try {
        eventTimingObserver.disconnect();
    } catch {
        // Some browser implementations can throw during teardown.
    }
    eventTimingObserver = null;
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

function bytesToMb(value) {
    return Number.isFinite(value) ? round(value / (1024 * 1024)) : null;
}

function getMemoryState() {
    const memory = globalThis.performance?.memory;
    if (!memory) {
        return {
            usedJsHeapMb: null,
            totalJsHeapMb: null,
            jsHeapLimitMb: null
        };
    }

    return {
        usedJsHeapMb: bytesToMb(memory.usedJSHeapSize),
        totalJsHeapMb: bytesToMb(memory.totalJSHeapSize),
        jsHeapLimitMb: bytesToMb(memory.jsHeapSizeLimit)
    };
}

function getRuntimeState() {
    return {
        ...getPageState(),
        ...getMemoryState()
    };
}

function recordFrameGap(startTime, endTime) {
    const duration = endTime - startTime;
    if (duration < FRAME_GAP_THRESHOLD_MS) return;

    frameGaps.push({
        startTime,
        endTime,
        duration,
        ...getRuntimeState()
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
            hasFocus: entry.hasFocus,
            usedJsHeapMb: entry.usedJsHeapMb,
            totalJsHeapMb: entry.totalJsHeapMb,
            jsHeapLimitMb: entry.jsHeapLimitMb
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

function recordEventLoopGap(startTime, endTime) {
    const duration = endTime - startTime;
    const delay = duration - EVENT_LOOP_INTERVAL_MS;
    if (delay < EVENT_LOOP_DELAY_THRESHOLD_MS) return;

    eventLoopGaps.push({
        startTime,
        endTime,
        duration,
        delay,
        ...getRuntimeState()
    });
    if (eventLoopGaps.length > MAX_EVENT_LOOP_GAPS) {
        eventLoopGaps.shift();
    }
}

function eventLoopGapSnapshot() {
    return eventLoopGaps
        .map(entry => ({
            startMs: round(entry.startTime),
            endMs: round(entry.endTime),
            durationMs: round(entry.duration),
            delayMs: round(entry.delay),
            visibilityState: entry.visibilityState,
            hidden: entry.hidden,
            hasFocus: entry.hasFocus,
            usedJsHeapMb: entry.usedJsHeapMb,
            totalJsHeapMb: entry.totalJsHeapMb,
            jsHeapLimitMb: entry.jsHeapLimitMb
        }))
        .sort((a, b) => b.delayMs - a.delayMs);
}

function startEventLoopMonitor() {
    if (eventLoopMonitorId !== null || !enabled) return;
    const setTimer = globalThis.setTimeout;
    if (typeof setTimer !== "function") return;

    lastEventLoopAt = getNow();
    const tick = () => {
        eventLoopMonitorId = null;
        if (!enabled) return;

        const now = getNow();
        if (lastEventLoopAt !== null) {
            recordEventLoopGap(lastEventLoopAt, now);
        }
        lastEventLoopAt = now;
        eventLoopMonitorId = setTimer(tick, EVENT_LOOP_INTERVAL_MS);
    };
    eventLoopMonitorId = setTimer(tick, EVENT_LOOP_INTERVAL_MS);
}

function stopEventLoopMonitor() {
    if (eventLoopMonitorId !== null) {
        globalThis.clearTimeout?.(eventLoopMonitorId);
    }
    eventLoopMonitorId = null;
    lastEventLoopAt = null;
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
        tagProfilerWrapper(wrapped, original, operationName);
        liteGraphOriginalMethods.set(methodName, original);
        prototype[methodName] = wrapped;
        installedMethods.push(methodName);
    });

    liteGraphProfilerInstalled = installedMethods.length > 0 || liteGraphOriginalMethods.size > 0;
    if (installedMethods.length) {
        log.info("LiteGraph canvas profiler enabled", { methods: installedMethods });
    }
}

function getGraphCanvasElement() {
    return globalThis.document?.getElementById?.("graph-canvas")
        || globalThis.LGraphCanvas?.active_canvas?.canvas
        || globalThis.document?.querySelector?.("canvas#graph-canvas")
        || null;
}

function installGraphCanvasHandlerProfiler() {
    if (graphCanvasHandlerProfilerInstalled || !enabled) return;

    const canvas = getGraphCanvasElement();
    if (!canvas) {
        if (!graphCanvasHandlerProfilerUnavailableLogged) {
            graphCanvasHandlerProfilerUnavailableLogged = true;
            log.info("Graph canvas handler profiler unavailable");
        }
        return;
    }

    const installedHandlers = [];
    GRAPH_CANVAS_HANDLER_EVENTS.forEach(eventName => {
        const propertyName = `on${eventName}`;
        const original = canvas[propertyName];
        if (typeof original !== "function" || original.__resolutionMasterPerfWrapped) return;

        const operationName = `dom.graphCanvas.${propertyName}`;
        const wrapped = function(...args) {
            const token = start(operationName);
            try {
                return original.apply(this, args);
            } finally {
                end(token);
            }
        };
        tagProfilerWrapper(wrapped, original, operationName);
        canvas[propertyName] = wrapped;
        graphCanvasProfiledHandlers.add(propertyName);
        installedHandlers.push(propertyName);
    });

    graphCanvasHandlerProfilerInstalled = installedHandlers.length > 0 || graphCanvasProfiledHandlers.size > 0;
    if (installedHandlers.length) {
        log.info("Graph canvas handler profiler enabled", { handlers: installedHandlers });
    }
}

function diagnosticsState() {
    return {
        enabled,
        autoReport,
        longTaskSupported: supportsLongTaskObserver(),
        longTaskObserverActive: !!longTaskObserver,
        longAnimationFrameSupported: supportsPerformanceEntry("long-animation-frame"),
        longAnimationFrameObserverActive: !!longAnimationFrameObserver,
        eventTimingSupported: supportsPerformanceEntry("event"),
        eventTimingObserverActive: !!eventTimingObserver,
        frameGapMonitorActive: frameGapMonitorId !== null,
        eventLoopMonitorActive: eventLoopMonitorId !== null,
        liteGraphProfilerActive: liteGraphProfilerInstalled,
        liteGraphProfiledMethods: [...liteGraphOriginalMethods.keys()],
        graphCanvasHandlerProfilerActive: graphCanvasHandlerProfilerInstalled,
        graphCanvasProfiledHandlers: [...graphCanvasProfiledHandlers],
        ...getRuntimeState()
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
    installGraphCanvasHandlerProfiler();
    const data = snapshot();
    const longTaskData = longTaskSnapshot();
    const longAnimationFrameData = longAnimationFrameSnapshot();
    const eventTimingData = eventTimingSnapshot();
    const frameGapData = frameGapSnapshot();
    const eventLoopGapData = eventLoopGapSnapshot();
    const state = diagnosticsState();
    if (!data.length && !longTaskData.length && !longAnimationFrameData.length && !eventTimingData.length && !frameGapData.length && !eventLoopGapData.length) {
        log.info("Performance diagnostics: no samples collected yet", { reason });
        return { operations: data, longTasks: longTaskData, longAnimationFrames: longAnimationFrameData, eventTimings: eventTimingData, frameGaps: frameGapData, eventLoopGaps: eventLoopGapData, state };
    }

    log.info("Performance diagnostics report", {
        reason,
        samples: data.length,
        longTasks: longTaskData.length,
        longAnimationFrames: longAnimationFrameData.length,
        eventTimings: eventTimingData.length,
        frameGaps: frameGapData.length,
        eventLoopGaps: eventLoopGapData.length,
        ...state
    });
    if (typeof console.table === "function") {
        if (data.length) {
            console.table(data);
        }
        if (longTaskData.length) {
            console.table(longTaskData);
        }
        if (longAnimationFrameData.length) {
            console.table(longAnimationFrameData);
        }
        if (eventTimingData.length) {
            console.table(eventTimingData);
        }
        if (frameGapData.length) {
            console.table(frameGapData);
        }
        if (eventLoopGapData.length) {
            console.table(eventLoopGapData);
        }
    } else {
        console.log({ operations: data, longTasks: longTaskData, longAnimationFrames: longAnimationFrameData, eventTimings: eventTimingData, frameGaps: frameGapData, eventLoopGaps: eventLoopGapData, state });
    }
    return { operations: data, longTasks: longTaskData, longAnimationFrames: longAnimationFrameData, eventTimings: eventTimingData, frameGaps: frameGapData, eventLoopGaps: eventLoopGapData, state };
}

function reset() {
    operations.clear();
    longTasks.length = 0;
    longAnimationFrames.length = 0;
    eventTimings.length = 0;
    frameGaps.length = 0;
    eventLoopGaps.length = 0;
    lastFrameAt = null;
    lastEventLoopAt = null;
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
    startLongAnimationFrameObserver();
    startEventTimingObserver();
    startFrameGapMonitor();
    startEventLoopMonitor();
    installLiteGraphProfiler();
    installGraphCanvasHandlerProfiler();
    globalThis.requestAnimationFrame?.(() => installGraphCanvasHandlerProfiler());
    globalThis.setTimeout?.(() => installGraphCanvasHandlerProfiler(), 1000);
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
    stopLongAnimationFrameObserver();
    stopEventTimingObserver();
    stopFrameGapMonitor();
    stopEventLoopMonitor();
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
    eventLoopGaps: eventLoopGapSnapshot,
    eventTimings: eventTimingSnapshot,
    frameGaps: frameGapSnapshot,
    isEnabled,
    longAnimationFrames: longAnimationFrameSnapshot,
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
