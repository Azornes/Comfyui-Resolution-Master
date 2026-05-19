/**
author: Azornes
title: AzLogs
version: 1.5.1
description: Logging Setup - Central logging system

Features:
logger - Central logging system for ResolutionMaster
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Ability to enable/disable logging globally or per module
- Colorful logs in the console
- Ability to save logs to localStorage
- Ability to export logs
*/

import { DEFAULT_LOGGER_NAME, LOG_MODULE_NAME, USE_COLORS } from './config.js';

function padStart(str, targetLength, padString) {
    targetLength = targetLength >> 0;
    padString = String(padString || ' ');
    if (str.length > targetLength) {
        return String(str);
    }
    else {
        targetLength = targetLength - str.length;
        if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length);
        }
        return padString.slice(0, targetLength) + String(str);
    }
}
function sanitizeKeyPart(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}
function toPascalCase(value) {
    return String(value)
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
const LOGGER_NAME = LOG_MODULE_NAME || DEFAULT_LOGGER_NAME;
const STORAGE_PREFIX = sanitizeKeyPart(LOGGER_NAME);
const LOGGER_CONFIG_KEY = `${STORAGE_PREFIX}_logger_config`;
const LOGGER_STORAGE_KEY = `${STORAGE_PREFIX}_logs`;
const LOGGER_EXPORT_PREFIX = STORAGE_PREFIX;
const WINDOW_LOGGER_KEY = `${toPascalCase(LOGGER_NAME)}Logger`;
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};
const DEFAULT_CONFIG = {
    globalLevel: LogLevel.INFO,
    moduleSettings: {},
    useColors: USE_COLORS,
    saveToStorage: false,
    maxStoredLogs: 1000,
    timestampFormat: 'HH:mm:ss.SSS',
    storageKey: LOGGER_STORAGE_KEY
};
const COLORS = {
    [LogLevel.DEBUG]: '#9B59B6',
    [LogLevel.INFO]: '#2ECC71',
    [LogLevel.WARN]: '#F39C12',
    [LogLevel.ERROR]: '#C0392B',
};
const LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};
const CONSOLE_METHODS = {
    [LogLevel.DEBUG]: 'debug',
    [LogLevel.INFO]: 'info',
    [LogLevel.WARN]: 'warn',
    [LogLevel.ERROR]: 'error',
};
const TIME_BG = '#263f4c';
const LEVEL_WIDTH = 5;

class Logger {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.logs = [];
        this.enabled = true;
        this.loadConfig();
        this.loadLogs();
    }
    /**
     * Configure the logger
     * @param {Partial<LoggerConfig>} config - Configuration object
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        this.saveConfig();
        return this;
    }
    /**
     * Enable/disable logger globally
     * @param {boolean} enabled - Whether the logger should be enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        return this;
    }
    /**
     * Set global logging level
     * @param {LogLevels} level - Logging level
     */
    setGlobalLevel(level) {
        this.config.globalLevel = level;
        this.saveConfig();
        return this;
    }
    /**
     * Set logging level for a specific module
     * @param {string} module - Module name
     * @param {LogLevels} level - Logging level
     */
    setModuleLevel(module, level) {
        this.config.moduleSettings[module] = level;
        this.saveConfig();
        return this;
    }
    /**
     * Check if a given logging level is active for a module
     * @param {string} module - Module name
     * @param {LogLevels} level - Logging level to check
     * @returns {boolean} - Whether the level is active
     */
    isLevelEnabled(module, level) {
        if (!this.enabled)
            return false;
        if (this.config.moduleSettings[module] !== undefined) {
            return level >= this.config.moduleSettings[module];
        }
        return level >= this.config.globalLevel;
    }
    /**
     * Format timestamp
     * @returns {string} - Formatted timestamp
     */
    formatTimestamp() {
        const now = new Date();
        const format = this.config.timestampFormat;
        return format
            .replace('HH', padStart(String(now.getHours()), 2, '0'))
            .replace('mm', padStart(String(now.getMinutes()), 2, '0'))
            .replace('ss', padStart(String(now.getSeconds()), 2, '0'))
            .replace('SSS', padStart(String(now.getMilliseconds()), 3, '0'));
    }
    /**
     * Save log
     * @param {string} module - Module name
     * @param {LogLevels} level - Logging level
     * @param {any[]} args - Arguments to log
     */
    log(module, level, ...args) {
        if (!this.isLevelEnabled(module, level))
            return;
        const timestamp = this.formatTimestamp();
        const levelName = LEVEL_NAMES[level];
        const logData = {
            timestamp,
            module,
            level,
            levelName,
            args,
            time: new Date()
        };
        if (this.config.saveToStorage) {
            this.logs.push(logData);
            if (this.logs.length > this.config.maxStoredLogs) {
                this.logs.shift();
            }
            this.saveLogs();
        }
        this.printToConsole(logData);
    }
    /**
     * Display log to console
     * @param {LogData} logData - Log data
     */
    printToConsole(logData) {
        const { timestamp, module, level, levelName, args } = logData;
        const consoleMethod = CONSOLE_METHODS[level] || 'log';
        const consoleFn = typeof console[consoleMethod] === 'function'
            ? console[consoleMethod].bind(console)
            : console.log.bind(console);
        if (this.config.useColors && typeof consoleFn === 'function') {
            const color = COLORS[level] || '#000000';
            const { root, detail } = this.splitModuleName(module);
            const message = this.stringifyArgs(args);
            const suffix = detail ? ` (${detail})` : '';
            consoleFn(
                `%c ${levelName.padEnd(LEVEL_WIDTH, ' ')} %c ${timestamp} %c %c ${root} %c %c ${message}%c${suffix}`,
                `background:${color};color:#fff;font-weight:bold;`,
                `background:${TIME_BG};color:#fff;font-weight:bold;`,
                `background:${color};color:${color};`,
                `background:${TIME_BG};color:#fff;font-weight:bold;`,
                `background:${color};color:${color};`,
                `color:${color};font-weight:bold;`,
                '',
            );
            return;
        }
        const { root, detail } = this.splitModuleName(module);
        const suffix = detail ? ` (${detail})` : '';
        consoleFn(`${levelName.padEnd(LEVEL_WIDTH, ' ')} ${timestamp} ${root} ${this.stringifyArgs(args)}${suffix}`);
    }

    splitModuleName(module) {
        const value = String(module || LOGGER_NAME);
        const parts = value.split('.');
        if (parts.length === 1 && value !== LOGGER_NAME) {
            return {
                root: LOGGER_NAME,
                detail: value
            };
        }
        const root = parts.shift() || LOGGER_NAME;
        return {
            root,
            detail: parts.join('.')
        };
    }

    stringifyArgs(args = []) {
        return args.map((arg) => {
            if (typeof arg === 'string') {
                return arg;
            }
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                }
                catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }
    serializeLogEntry(log) {
        return {
            timestamp: log.timestamp,
            module: log.module,
            level: log.level,
            levelName: log.levelName,
            args: log.args.map((arg) => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.parse(JSON.stringify(arg));
                    }
                    catch (e) {
                        return String(arg);
                    }
                }
                return arg;
            }),
            time: log.time instanceof Date ? log.time.toISOString() : log.time
        };
    }
    deserializeLogEntry(log) {
        if (!log || typeof log !== 'object') {
            return null;
        }
        if ('timestamp' in log && 'module' in log && 'level' in log) {
            return {
                timestamp: log.timestamp,
                module: log.module,
                level: log.level,
                levelName: log.levelName || LEVEL_NAMES[log.level] || 'INFO',
                args: Array.isArray(log.args) ? log.args : [],
                time: log.time ? new Date(log.time) : new Date()
            };
        }
        if ('t' in log && 'm' in log && 'l' in log) {
            return {
                timestamp: log.t,
                module: log.m,
                level: log.l,
                levelName: LEVEL_NAMES[log.l] || 'INFO',
                args: Array.isArray(log.a) ? log.a : [],
                time: new Date()
            };
        }
        return null;
    }
    /**
     * Save logs to localStorage
     */
    saveLogs() {
        if (typeof localStorage !== 'undefined' && this.config.saveToStorage) {
            try {
                const storedLogs = this.logs.map((log) => this.serializeLogEntry(log));
                localStorage.setItem(this.config.storageKey, JSON.stringify(storedLogs));
            }
            catch (e) {
                console.error('Failed to save logs to localStorage:', e);
            }
        }
    }
    /**
     * Load logs from localStorage
     */
    loadLogs() {
        if (typeof localStorage !== 'undefined' && this.config.saveToStorage) {
            try {
                const storedLogs = localStorage.getItem(this.config.storageKey);
                if (storedLogs) {
                    this.logs = JSON.parse(storedLogs)
                        .map((log) => this.deserializeLogEntry(log))
                        .filter(Boolean);
                }
            }
            catch (e) {
                console.error('Failed to load logs from localStorage:', e);
            }
        }
    }
    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(LOGGER_CONFIG_KEY, JSON.stringify(this.config));
            }
            catch (e) {
                console.error('Failed to save logger config to localStorage:', e);
            }
        }
    }
    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        if (typeof localStorage !== 'undefined') {
            try {
                const storedConfig = localStorage.getItem(LOGGER_CONFIG_KEY);
                if (storedConfig) {
                    this.config = { ...this.config, ...JSON.parse(storedConfig) };
                }
            }
            catch (e) {
                console.error('Failed to load logger config from localStorage:', e);
            }
        }
    }
    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.storageKey);
        }
        return this;
    }
    /**
     * Export logs to file
     * @param {'json' | 'txt'} format - Export format
     */
    exportLogs(format = 'json') {
        if (this.logs.length === 0) {
            console.warn('No logs to export');
            return;
        }
        let content;
        let mimeType;
        let extension;
        if (format === 'json') {
            content = JSON.stringify(this.logs, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        }
        else {
            content = this.logs.map((log) => `${log.levelName.padEnd(LEVEL_WIDTH, ' ')} ${log.timestamp} ${log.module} ${this.stringifyArgs(log.args)}`).join('\n');
            mimeType = 'text/plain';
            extension = 'txt';
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${LOGGER_EXPORT_PREFIX}_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    /**
     * Log at DEBUG level
     * @param {string} module - Module name
     * @param {any[]} args - Arguments to log
     */
    debug(module, ...args) {
        this.log(module, LogLevel.DEBUG, ...args);
    }
    /**
     * Log at INFO level
     * @param {string} module - Module name
     * @param {any[]} args - Arguments to log
     */
    info(module, ...args) {
        this.log(module, LogLevel.INFO, ...args);
    }
    /**
     * Log at WARN level
     * @param {string} module - Module name
     * @param {any[]} args - Arguments to log
     */
    warn(module, ...args) {
        this.log(module, LogLevel.WARN, ...args);
    }
    /**
     * Log at ERROR level
     * @param {string} module - Module name
     * @param {any[]} args - Arguments to log
     */
    error(module, ...args) {
        this.log(module, LogLevel.ERROR, ...args);
    }
}
export const logger = new Logger();
export const debug = (module, ...args) => logger.debug(module, ...args);
export const info = (module, ...args) => logger.info(module, ...args);
export const warn = (module, ...args) => logger.warn(module, ...args);
export const error = (module, ...args) => logger.error(module, ...args);
if (typeof window !== 'undefined') {
    window[WINDOW_LOGGER_KEY] = logger;
}
export default logger;
