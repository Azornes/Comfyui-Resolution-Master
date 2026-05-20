/**
 * error_handler - Centralized error handling
 * Removes repetitive error handling patterns across the project
 */
import { createModuleLogger } from "../log_system/log_funcs.js";
const log = createModuleLogger('error_handler');
/**
 * Application error types
 */
export const ErrorTypes = {
    VALIDATION: 'VALIDATION_ERROR',
    NETWORK: 'NETWORK_ERROR',
    FILE_IO: 'FILE_IO_ERROR',
    CANVAS: 'CANVAS_ERROR',
    IMAGE_PROCESSING: 'IMAGE_PROCESSING_ERROR',
    STATE_MANAGEMENT: 'STATE_MANAGEMENT_ERROR',
    USER_INPUT: 'USER_INPUT_ERROR',
    SYSTEM: 'SYSTEM_ERROR'
};
/**
 * Application error class with additional information
 */
export class AppError extends Error {
    constructor(message, type = ErrorTypes.SYSTEM, details = null, originalError = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}
/**
 * Error handler with automatic logging and categorization
 */
export class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.errorHistory = [];
        this.maxHistorySize = 100;
    }
    /**
     * Handles an error with automatic logging
     * @param {Error | AppError | string} error - Error to handle
     * @param {string} context - Error occurrence context
     * @param {object} additionalInfo - Additional information
     * @returns {AppError} Normalized error
     */
    handle(error, context = 'Unknown', additionalInfo = {}) {
        const normalizedError = this.normalizeError(error, context, additionalInfo);
        this.logError(normalizedError, context);
        this.recordError(normalizedError);
        this.incrementErrorCount(normalizedError.type);
        return normalizedError;
    }
    /**
     * Normalizes an error to the standard format
     * @param {Error | AppError | string} error - Error to normalize
     * @param {string} context - Context
     * @param {object} additionalInfo - Additional information
     * @returns {AppError} Normalized error
     */
    normalizeError(error, context, additionalInfo) {
        if (error instanceof AppError) {
            return error;
        }
        if (error instanceof Error) {
            const type = this.categorizeError(error, context);
            return new AppError(error.message, type, { context, ...additionalInfo }, error);
        }
        if (typeof error === 'string') {
            return new AppError(error, ErrorTypes.SYSTEM, { context, ...additionalInfo });
        }
        return new AppError('Unknown error occurred', ErrorTypes.SYSTEM, { context, originalError: error, ...additionalInfo });
    }
    /**
     * Categorizes an error based on the message and context
     * @param {Error} error - Error to categorize
     * @param {string} context - Context
     * @returns {ErrorType} Error type
     */
    categorizeError(error, context) {
        const message = error.message.toLowerCase();
        if (message.includes('fetch') || message.includes('network') ||
            message.includes('connection') || message.includes('timeout')) {
            return ErrorTypes.NETWORK;
        }
        if (message.includes('file') || message.includes('read') ||
            message.includes('write') || message.includes('path')) {
            return ErrorTypes.FILE_IO;
        }
        if (message.includes('invalid') || message.includes('required') ||
            message.includes('validation') || message.includes('format')) {
            return ErrorTypes.VALIDATION;
        }
        if (message.includes('image') || message.includes('canvas') ||
            message.includes('blob') || message.includes('tensor')) {
            return ErrorTypes.IMAGE_PROCESSING;
        }
        if (message.includes('state') || message.includes('cache') ||
            message.includes('storage')) {
            return ErrorTypes.STATE_MANAGEMENT;
        }
        if (context.toLowerCase().includes('canvas')) {
            return ErrorTypes.CANVAS;
        }
        return ErrorTypes.SYSTEM;
    }
    /**
     * Logs an error with the appropriate level
     * @param {AppError} error - Error to log
     * @param {string} context - Context
     */
    logError(error, context) {
        const logMessage = `[${error.type}] ${error.message}`;
        const logDetails = {
            context,
            timestamp: error.timestamp,
            details: error.details,
            stack: error.stack
        };
        switch (error.type) {
            case ErrorTypes.VALIDATION:
            case ErrorTypes.USER_INPUT:
                log.warn(logMessage, logDetails);
                break;
            case ErrorTypes.NETWORK:
                log.error(logMessage, logDetails);
                break;
            default:
                log.error(logMessage, logDetails);
        }
    }
    /**
     * Records an error in history
     * @param {AppError} error - Error to record
     */
    recordError(error) {
        this.errorHistory.push({
            timestamp: error.timestamp,
            type: error.type,
            message: error.message,
            context: error.details?.context
        });
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    /**
     * Increments the error count for the given type
     * @param {ErrorType} errorType - Error type
     */
    incrementErrorCount(errorType) {
        const current = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, current + 1);
    }
    /**
     * Returns error statistics
     * @returns {ErrorStats} Error statistics
     */
    getErrorStats() {
        const errorCountsObj = {};
        for (const [key, value] of this.errorCounts.entries()) {
            errorCountsObj[key] = value;
        }
        return {
            totalErrors: this.errorHistory.length,
            errorCounts: errorCountsObj,
            recentErrors: this.errorHistory.slice(-10),
            errorsByType: this.groupErrorsByType()
        };
    }
    /**
     * Groups errors by type
     * @returns {{ [key: string]: ErrorHistoryEntry[] }} Errors grouped by type
     */
    groupErrorsByType() {
        const grouped = {};
        this.errorHistory.forEach((error) => {
            if (!grouped[error.type]) {
                grouped[error.type] = [];
            }
            grouped[error.type].push(error);
        });
        return grouped;
    }
    /**
     * Clears the error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.errorCounts.clear();
        log.info('Error history cleared');
    }
}
const errorHandler = new ErrorHandler();
/**
 * Function wrapper with automatic error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Execution context
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context) {
    return async function (...args) {
        try {
            return await fn.apply(this, args);
        }
        catch (error) {
            const handledError = errorHandler.handle(error, context, {
                functionName: fn.name,
                arguments: args.length
            });
            throw handledError;
        }
    };
}
/**
 * Decorator for class methods with automatic error handling
 * @param {string} context - Execution context
 */
export function handleErrors(context) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                const handledError = errorHandler.handle(error, `${context}.${propertyKey}`, {
                    className: target.constructor.name,
                    methodName: propertyKey,
                    arguments: args.length
                });
                throw handledError;
            }
        };
        return descriptor;
    };
}
/**
 * Helper function for creating validation errors
 * @param {string} message - Error message
 * @param {object} details - Validation details
 * @returns {AppError} Validation error
 */
export function createValidationError(message, details = {}) {
    return new AppError(message, ErrorTypes.VALIDATION, details);
}
/**
 * Helper function for creating network errors
 * @param {string} message - Error message
 * @param {object} details - Network details
 * @returns {AppError} Network error
 */
export function createNetworkError(message, details = {}) {
    return new AppError(message, ErrorTypes.NETWORK, details);
}
/**
 * Helper function for creating file errors
 * @param {string} message - Error message
 * @param {object} details - File details
 * @returns {AppError} File error
 */
export function createFileError(message, details = {}) {
    return new AppError(message, ErrorTypes.FILE_IO, details);
}
/**
 * Helper function for safely executing an operation
 * @param {() => Promise<T>} operation - Operation to execute
 * @param {T} fallbackValue - Fallback value in case of error
 * @param {string} context - Operation context
 * @returns {Promise<T>} Operation result or fallback value
 */
export async function safeExecute(operation, fallbackValue, context = 'SafeExecute') {
    try {
        return await operation();
    }
    catch (error) {
        errorHandler.handle(error, context);
        return fallbackValue;
    }
}
/**
 * Retries an operation with exponential backoff
 * @param {() => Promise<T>} operation - Operation to retry
 * @param {number} maxRetries - Maximum number of attempts
 * @param {number} baseDelay - Base delay in ms
 * @param {string} context - Operation context
 * @returns {Promise<T>} Operation result
 */
export async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000, context = 'RetryOperation') {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                break;
            }
            const delay = baseDelay * Math.pow(2, attempt);
            log.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, { error: lastError.message, context });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw errorHandler.handle(lastError, context, { attempts: maxRetries + 1 });
}
export { errorHandler };
export default errorHandler;
