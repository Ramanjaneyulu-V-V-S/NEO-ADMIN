/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling and logging for event handlers.
 * Prevents single errors from breaking entire viewer functionality.
 * 
 * Usage:
 * - wrapHandler: Wraps any function with try-catch
 * - safeExecute: Executes a function safely with error handling
 * - logError: Logs errors with consistent format
 */

import { log } from "./logger";
import { getParentTargetOriginForPostMessage } from "./postMessageProtocol";

/**
 * Log error with consistent format
 * @param {string} component - Component name (e.g., 'MarkupHandlers')
 * @param {string} handler - Handler name (e.g., 'handleDocumentClick')
 * @param {Error} error - The error object
 * @param {Object} context - Additional context information
 */
export const logError = (component, handler, error, context = {}) => {
  log.error(`[${component}] Error in ${handler}`, error, context);
  
  // Optional: Send to parent for monitoring
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: 'VIEWER_ERROR_CAUGHT',
        component,
        handler,
        error: error?.message || String(error),
        context,
        timestamp: Date.now()
      }, getParentTargetOriginForPostMessage());
    } catch {
      // Ignore postMessage errors
    }
  }
};

/**
 * Wrap a synchronous event handler with try-catch
 * @param {Function} handler - The handler function to wrap
 * @param {string} component - Component name for logging
 * @param {string} handlerName - Handler name for logging
 * @returns {Function} Wrapped handler function
 */
export const wrapHandler = (handler, component, handlerName) => {
  return (...args) => {
    try {
      return handler(...args);
    } catch (error) {
      logError(component, handlerName, error, {
        args: args.length > 0 ? `${args.length} arguments` : 'no arguments',
        eventType: args[0]?.type || 'unknown'
      });
      return undefined; // Safe fallback
    }
  };
};

/**
 * Wrap an async event handler with try-catch
 * @param {Function} handler - The async handler function to wrap
 * @param {string} component - Component name for logging
 * @param {string} handlerName - Handler name for logging
 * @returns {Function} Wrapped async handler function
 */
export const wrapAsyncHandler = (handler, component, handlerName) => {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(component, handlerName, error, {
        args: args.length > 0 ? `${args.length} arguments` : 'no arguments',
        eventType: args[0]?.type || 'unknown'
      });
      return undefined; // Safe fallback
    }
  };
};

/**
 * Safely execute a function with error handling
 * @param {Function} fn - Function to execute
 * @param {string} component - Component name for logging
 * @param {string} operation - Operation name for logging
 * @param {*} fallbackValue - Value to return on error
 * @returns {*} Result of function or fallback value
 */
export const safeExecute = (fn, component, operation, fallbackValue = null) => {
  try {
    return fn();
  } catch (error) {
    logError(component, operation, error);
    return fallbackValue;
  }
};

/**
 * Safely execute an async function with error handling
 * @param {Function} fn - Async function to execute
 * @param {string} component - Component name for logging
 * @param {string} operation - Operation name for logging
 * @param {*} fallbackValue - Value to return on error
 * @returns {Promise<*>} Result of function or fallback value
 */
export const safeExecuteAsync = async (fn, component, operation, fallbackValue = null) => {
  try {
    return await fn();
  } catch (error) {
    logError(component, operation, error);
    return fallbackValue;
  }
};

/**
 * Create a safe event listener wrapper
 * Ensures event listener errors don't prevent future events
 * @param {EventTarget} target - Element to attach listener to
 * @param {string} eventName - Event name
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 * @param {string} component - Component name for logging
 * @returns {Function} Cleanup function to remove listener
 */
export const addSafeEventListener = (target, eventName, handler, options, component) => {
  const safeHandler = wrapHandler(handler, component, `${eventName}Handler`);
  target.addEventListener(eventName, safeHandler, options);
  
  return () => {
    target.removeEventListener(eventName, safeHandler, options);
  };
};

/**
 * Wrap MutationObserver callback with error handling
 * @param {Function} callback - MutationObserver callback
 * @param {string} component - Component name for logging
 * @returns {Function} Wrapped callback
 */
export const wrapMutationObserver = (callback, component) => {
  return (mutations, observer) => {
    try {
      callback(mutations, observer);
    } catch (error) {
      logError(component, 'MutationObserver', error, {
        mutationCount: mutations.length
      });
    }
  };
};

export default {
  logError,
  wrapHandler,
  wrapAsyncHandler,
  safeExecute,
  safeExecuteAsync,
  addSafeEventListener,
  wrapMutationObserver
};

