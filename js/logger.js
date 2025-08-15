/**
 * Logger - Centralny system logowania dla ComfyUI-ResolutionMaster
 *
 * Funkcje:
 * - Różne poziomy logowania (DEBUG, INFO, WARN, ERROR)
 * - Możliwość włączania/wyłączania logów globalnie lub per moduł
 * - Kolorowe logi w konsoli
 * - Możliwość zapisywania logów do localStorage
 * - Możliwość eksportu logów
 */
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
    useColors: true,
    saveToStorage: false,
    maxStoredLogs: 1000,
    timestampFormat: 'HH:mm:ss',
    storageKey: 'ResolutionMaster_logs'
};
const COLORS = {
    [LogLevel.DEBUG]: '#9e9e9e',
    [LogLevel.INFO]: '#2196f3',
    [LogLevel.WARN]: '#ff9800',
    [LogLevel.ERROR]: '#f44336',
};
const LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};
class Logger {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.logs = [];
        this.enabled = true;
        this.loadConfig();
    }
    /**
     * Konfiguracja loggera
     * @param {Partial<LoggerConfig>} config - Obiekt konfiguracyjny
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        this.saveConfig();
        return this;
    }
    /**
     * Włącz/wyłącz logger globalnie
     * @param {boolean} enabled - Czy logger ma być włączony
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        return this;
    }
    /**
     * Ustaw globalny poziom logowania
     * @param {LogLevels} level - Poziom logowania
     */
    setGlobalLevel(level) {
        this.config.globalLevel = level;
        this.saveConfig();
        return this;
    }
    /**
     * Ustaw poziom logowania dla konkretnego modułu
     * @param {string} module - Nazwa modułu
     * @param {LogLevels} level - Poziom logowania
     */
    setModuleLevel(module, level) {
        this.config.moduleSettings[module] = level;
        this.saveConfig();
        return this;
    }
    /**
     * Sprawdź, czy dany poziom logowania jest aktywny dla modułu
     * @param {string} module - Nazwa modułu
     * @param {LogLevels} level - Poziom logowania do sprawdzenia
     * @returns {boolean} - Czy poziom jest aktywny
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
     * Formatuj znacznik czasu
     * @returns {string} - Sformatowany znacznik czasu
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
     * Zapisz log
     * @param {string} module - Nazwa modułu
     * @param {LogLevels} level - Poziom logowania
     * @param {any[]} args - Argumenty do zalogowania
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
     * Wyświetl log w konsoli
     * @param {LogData} logData - Dane logu
     */
    printToConsole(logData) {
        const { timestamp, module, level, levelName, args } = logData;
        const prefix = `[${timestamp}] [${module}] [${levelName}]`;
        if (this.config.useColors && typeof console.log === 'function') {
            const color = COLORS[level] || '#000000';
            console.log(`%c${prefix}`, `color: ${color}; font-weight: bold;`, ...args);
            return;
        }
        console.log(prefix, ...args);
    }
    /**
     * Zapisz logi do localStorage
     */
    saveLogs() {
        if (typeof localStorage !== 'undefined' && this.config.saveToStorage) {
            try {
                const simplifiedLogs = this.logs.map((log) => ({
                    t: log.timestamp,
                    m: log.module,
                    l: log.level,
                    a: log.args.map((arg) => {
                        if (typeof arg === 'object') {
                            try {
                                return JSON.stringify(arg);
                            }
                            catch (e) {
                                return String(arg);
                            }
                        }
                        return arg;
                    })
                }));
                localStorage.setItem(this.config.storageKey, JSON.stringify(simplifiedLogs));
            }
            catch (e) {
                console.error('Failed to save logs to localStorage:', e);
            }
        }
    }
    /**
     * Załaduj logi z localStorage
     */
    loadLogs() {
        if (typeof localStorage !== 'undefined' && this.config.saveToStorage) {
            try {
                const storedLogs = localStorage.getItem(this.config.storageKey);
                if (storedLogs) {
                    this.logs = JSON.parse(storedLogs);
                }
            }
            catch (e) {
                console.error('Failed to load logs from localStorage:', e);
            }
        }
    }
    /**
     * Zapisz konfigurację do localStorage
     */
    saveConfig() {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('ResolutionMaster_logger_config', JSON.stringify(this.config));
            }
            catch (e) {
                console.error('Failed to save logger config to localStorage:', e);
            }
        }
    }
    /**
     * Załaduj konfigurację z localStorage
     */
    loadConfig() {
        if (typeof localStorage !== 'undefined') {
            try {
                const storedConfig = localStorage.getItem('ResolutionMaster_logger_config');
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
     * Wyczyść wszystkie logi
     */
    clearLogs() {
        this.logs = [];
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.storageKey);
        }
        return this;
    }
    /**
     * Eksportuj logi do pliku
     * @param {'json' | 'txt'} format - Format eksportu
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
            content = this.logs.map((log) => `[${log.timestamp}] [${log.module}] [${log.levelName}] ${log.args.join(' ')}`).join('\n');
            mimeType = 'text/plain';
            extension = 'txt';
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ResolutionMaster_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    /**
     * Log na poziomie DEBUG
     * @param {string} module - Nazwa modułu
     * @param {any[]} args - Argumenty do zalogowania
     */
    debug(module, ...args) {
        this.log(module, LogLevel.DEBUG, ...args);
    }
    /**
     * Log na poziomie INFO
     * @param {string} module - Nazwa modułu
     * @param {any[]} args - Argumenty do zalogowania
     */
    info(module, ...args) {
        this.log(module, LogLevel.INFO, ...args);
    }
    /**
     * Log na poziomie WARN
     * @param {string} module - Nazwa modułu
     * @param {any[]} args - Argumenty do zalogowania
     */
    warn(module, ...args) {
        this.log(module, LogLevel.WARN, ...args);
    }
    /**
     * Log na poziomie ERROR
     * @param {string} module - Nazwa modułu
     * @param {any[]} args - Argumenty do zalogowania
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
    window.ResolutionMasterLogger = logger;
}
export default logger;
