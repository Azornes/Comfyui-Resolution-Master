import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger("performance_diagnostics");

const GLOBAL_API_KEY = "ResolutionMasterPerformanceDiagnostics";
const STORAGE_KEY = "ResolutionMaster.performanceDiagnostics";
const REPORT_INTERVAL_MS = 5000;
const SLOW_SAMPLE_MS = 16;
const MAX_RECENT_SAMPLES = 20;

const operations = new Map();

let enabled = false;
let reportTimer = null;

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

function scheduleReport() {
    if (!enabled || reportTimer) return;

    reportTimer = globalThis.setTimeout?.(() => {
        reportTimer = null;
        report("periodic");
    }, REPORT_INTERVAL_MS) ?? null;
}

function report(reason = "manual") {
    const data = snapshot();
    if (!data.length) {
        log.info("Performance diagnostics: no samples collected yet", { reason });
        return data;
    }

    log.info("Performance diagnostics report", { reason, samples: data.length });
    if (typeof console.table === "function") {
        console.table(data);
    } else {
        console.log(data);
    }
    return data;
}

function reset() {
    operations.clear();
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
    if (options.persist !== false) {
        setStoredEnabled(true);
    }
    log.info("Performance diagnostics enabled", {
        storageKey: STORAGE_KEY,
        api: GLOBAL_API_KEY
    });
}

function disable(options = {}) {
    if (enabled && options.report !== false) {
        report("disabled");
    }
    enabled = false;
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

export const performanceDiagnostics = {
    enable,
    disable,
    end,
    isEnabled,
    measure,
    now: getNow,
    record,
    recordSince,
    report,
    reset,
    snapshot,
    start
};

globalThis[GLOBAL_API_KEY] = performanceDiagnostics;

if (getStoredEnabled() || getUrlEnabled()) {
    enable({ persist: false });
}
