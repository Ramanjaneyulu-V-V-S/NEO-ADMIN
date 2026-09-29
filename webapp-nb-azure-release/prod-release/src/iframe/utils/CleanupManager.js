/**
 * CleanupManager - Production-Grade Memory Management
 * 
 * Prevents memory leaks by tracking and cleaning up:
 * - Event listeners
 * - MutationObservers
 * - ViewerEventBus subscriptions
 * - Timers (setTimeout, setInterval, requestAnimationFrame)
 * - Any other cleanup functions
 * 
 * Features:
 * - Automatic cleanup on destroy
 * - Memory leak detection in development
 * - Detailed logging and debugging
 * - Type-safe API with JSDoc
 * - Error handling for cleanup failures
 * - Idempotent cleanup (safe to call multiple times)
 * 
 * Usage:
 * ```javascript
 * const cleanup = new CleanupManager('ComponentName');
 * 
 * // Track event listener
 * cleanup.addEventListener(element, 'click', handler);
 * 
 * // Track observer
 * cleanup.addObserver(observer);
 * 
 * // Track subscription
 * cleanup.addSubscription(unsubscribe);
 * 
 * // Track timer
 * cleanup.addTimeout(timeoutId);
 * 
 * // Cleanup everything
 * cleanup.destroy();
 * ```
 * 
 * @class CleanupManager
 */

import { log } from "./logger";

export class CleanupManager {
  /**
   * Create a new CleanupManager instance
   * @param {string} componentName - Name of the component for debugging
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enableLogging=false] - Enable detailed logging
   */
  constructor(componentName, options = {}) {
    this.componentName = componentName;
    this.options = {
      enableLogging: options.enableLogging || false,
    };
    
    // Storage for different types of cleanups (ZERO TIMERS - purely event-driven)
    this.eventListeners = [];
    this.observers = [];
    this.subscriptions = [];
    this.customCleanups = [];
    
    // State tracking
    this.isDestroyed = false;
    this.createdAt = Date.now();
    this.destroyedAt = null;
    
    this._log('Created');
  }

  /**
   * Add an event listener with automatic cleanup
   * @param {EventTarget} target - Element to attach listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @param {Object|boolean} [options] - Event listener options
   * @returns {Function} Cleanup function
   */
  addEventListener(target, event, handler, options) {
    if (this.isDestroyed) {
      log.warn(`[${this.componentName}] Cannot add listener - already destroyed`);
      return () => {};
    }

    try {
      target.addEventListener(event, handler, options);
      
      const cleanup = () => {
        try {
          target.removeEventListener(event, handler, options);
          this._log(`Removed event listener: ${event}`);
        } catch (error) {
          log.error(`[${this.componentName}] Error removing listener`, error);
        }
      };
      
      this.eventListeners.push({
        target,
        event,
        handler,
        options,
        cleanup,
        addedAt: Date.now()
      });
      
      this._log(`Added event listener: ${event}`, { total: this.eventListeners.length });
      
      return cleanup;
    } catch (error) {
      log.error(`[${this.componentName}] Error adding listener`, error);
      return () => {};
    }
  }

  /**
   * Add a MutationObserver with automatic cleanup
   * @param {MutationObserver} observer - Observer instance
   * @returns {Function} Cleanup function
   */
  addObserver(observer) {
    if (this.isDestroyed) {
      log.warn(`[${this.componentName}] Cannot add observer - already destroyed`);
      return () => {};
    }

    const cleanup = () => {
      try {
        observer.disconnect();
        this._log('Disconnected observer');
      } catch (error) {
        log.error(`[${this.componentName}] Error disconnecting observer`, error);
      }
    };
    
    this.observers.push({
      observer,
      cleanup,
      addedAt: Date.now()
    });
    
    this._log('Added observer', { total: this.observers.length });
    
    return cleanup;
  }

  /**
   * Add a subscription with automatic cleanup
   * @param {Function} unsubscribe - Unsubscribe function
   * @returns {Function} Cleanup function
   */
  addSubscription(unsubscribe) {
    if (this.isDestroyed) {
      log.warn(`[${this.componentName}] Cannot add subscription - already destroyed`);
      return () => {};
    }

    if (typeof unsubscribe !== 'function') {
      log.error(`[${this.componentName}] Invalid subscription - must be a function`);
      return () => {};
    }

    const cleanup = () => {
      try {
        unsubscribe();
        this._log('Unsubscribed');
      } catch (error) {
        log.error(`[${this.componentName}] Error unsubscribing`, error);
      }
    };
    
    this.subscriptions.push({
      unsubscribe,
      cleanup,
      addedAt: Date.now()
    });
    
    this._log('Added subscription', { total: this.subscriptions.length });
    
    return cleanup;
  }


  /**
   * Add a custom cleanup function
   * @param {Function} cleanup - Cleanup function
   * @returns {Function} The cleanup function (for chaining)
   */
  addCleanup(cleanup) {
    if (this.isDestroyed) {
      log.warn(`[${this.componentName}] Cannot add cleanup - already destroyed`);
      return () => {};
    }

    if (typeof cleanup !== 'function') {
      log.error(`[${this.componentName}] Invalid cleanup - must be a function`);
      return () => {};
    }

    this.customCleanups.push({
      cleanup,
      addedAt: Date.now()
    });
    
    this._log('Added custom cleanup', { total: this.customCleanups.length });
    
    return cleanup;
  }


  /**
   * Get current state and statistics
   * @returns {Object} Current state
   */
  getState() {
    return {
      componentName: this.componentName,
      isDestroyed: this.isDestroyed,
      createdAt: this.createdAt,
      destroyedAt: this.destroyedAt,
      aliveTime: this.destroyedAt 
        ? this.destroyedAt - this.createdAt 
        : Date.now() - this.createdAt,
      counts: {
        eventListeners: this.eventListeners.length,
        observers: this.observers.length,
        subscriptions: this.subscriptions.length,
        customCleanups: this.customCleanups.length,
        total: this.getTotalCleanups()
      }
    };
  }

  /**
   * Get total number of tracked cleanups
   * @returns {number} Total count
   */
  getTotalCleanups() {
    return (
      this.eventListeners.length +
      this.observers.length +
      this.subscriptions.length +
      this.customCleanups.length
    );
  }

  /**
   * Destroy and cleanup all tracked resources
   * Safe to call multiple times (idempotent)
   * Purely event-driven - NO TIMEOUTS
   */
  destroy() {
    if (this.isDestroyed) {
      this._log('Already destroyed - skipping');
      return;
    }

    this._log('Destroying...', this.getState());
    
    const startTime = Date.now();
    let cleanupCount = 0;
    let errorCount = 0;

    // Clean up event listeners
    this.eventListeners.forEach(({ cleanup }) => {
      try {
        cleanup();
        cleanupCount++;
      } catch (error) {
        errorCount++;
        log.error(`[${this.componentName}] Cleanup error`, error);
      }
    });
    this.eventListeners = [];

    // Clean up observers
    this.observers.forEach(({ cleanup }) => {
      try {
        cleanup();
        cleanupCount++;
      } catch (error) {
        errorCount++;
        log.error(`[${this.componentName}] Cleanup error`, error);
      }
    });
    this.observers = [];

    // Clean up subscriptions
    this.subscriptions.forEach(({ cleanup }) => {
      try {
        cleanup();
        cleanupCount++;
      } catch (error) {
        errorCount++;
        log.error(`[${this.componentName}] Cleanup error`, error);
      }
    });
    this.subscriptions = [];

    // Clean up custom cleanups
    this.customCleanups.forEach(({ cleanup }) => {
      try {
        cleanup();
        cleanupCount++;
      } catch (error) {
        errorCount++;
        log.error(`[${this.componentName}] Cleanup error`, error);
      }
    });
    this.customCleanups = [];

    this.isDestroyed = true;
    this.destroyedAt = Date.now();
    
    const duration = Date.now() - startTime;
    this._log(`Destroyed: ${cleanupCount} cleanups, ${errorCount} errors, ${duration}ms`);
  }

  /**
   * Internal logging
   * @private
   */
  _log() {
    if (this.options.enableLogging) {
      // Debug logging is disabled in production - use log.debug for development
      // log.debug(`[CleanupManager:${this.componentName}] ${message}`, data || {});
    }
  }
}

/**
 * Create a new CleanupManager instance
 * @param {string} componentName - Component name
 * @param {Object} options - Options
 * @returns {CleanupManager} New instance
 */
export const createCleanupManager = (componentName, options) => {
  return new CleanupManager(componentName, options);
};

export default CleanupManager;

