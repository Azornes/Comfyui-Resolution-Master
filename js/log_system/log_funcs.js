/**
author: Azornes
title: AzLogs
version: 1.5.5
description: Logging Initializator

Features:
log_funcs - Centralization of logger initialization
Eliminates repetitive logger initialization code in each module
*/

import { logger, LogLevel } from "./logger.js";
import { LOG_LEVEL } from './config.js';
/**
 * Creates a logger object for a module with predefined methods
 * @param {string} moduleName - Module name
 * @returns {Logger} Object with logging methods
 */
export function createModuleLogger(moduleName) {
    logger.setModuleLevel(moduleName, LogLevel[LOG_LEVEL]);
    return {
        debug: (...args) => logger.debug(moduleName, ...args),
        info: (...args) => logger.info(moduleName, ...args),
        warn: (...args) => logger.warn(moduleName, ...args),
        error: (...args) => logger.error(moduleName, ...args)
    };
}
/**
 * Creates a logger with automatic module name detection from URL
 * @returns {Logger} Object with logging methods
 */
export function createAutoLogger() {
    const stack = new Error().stack;
    const match = stack?.match(/\/([^\/]+)\.js/);
    const moduleName = match ? match[1] : 'Unknown';
    return createModuleLogger(moduleName);
}
/**
 * Wrapper for operations with automatic error logging
 * @param {Function} operation - Operation to execute
 * @param {Logger} log - Logger object
 * @param {string} operationName - Operation name (for logs)
 * @returns {Function} Wrapped function
 */
export function withErrorLogging(operation, log, operationName) {
    return async function (...args) {
        try {
            log.debug(`Starting ${operationName}`);
            const result = await operation.apply(this, args);
            log.debug(`Completed ${operationName}`);
            return result;
        }
        catch (error) {
            log.error(`Error in ${operationName}:`, error);
            throw error;
        }
    };
}
/**
 * Decorator for class methods with automatic logging
 * @param {Logger} log - Logger object
 * @param {string} methodName - Method name
 */
export function logMethod(log, methodName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                log.debug(`${methodName || propertyKey} started`);
                const result = await originalMethod.apply(this, args);
                log.debug(`${methodName || propertyKey} completed`);
                return result;
            }
            catch (error) {
                log.error(`${methodName || propertyKey} failed:`, error);
                throw error;
            }
        };
        return descriptor;
    };
}
