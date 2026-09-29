/**
 * ViewerEventBus.js
 *
 * @module ViewerEventBus
 */

import { VIEWER_EVENTS, getNativeEventName } from "./ViewerEventTypes";
import { log } from "./logger";

/**
 * List of native Brava events to intercept
 * These events are fired by the OpenText Brava viewer library
 */
const NATIVE_EVENTS_TO_INTERCEPT = [
  VIEWER_EVENTS.MARKUPS_LOADED,
  VIEWER_EVENTS.MARKUP_ADDED,
  VIEWER_EVENTS.MARKUPS_SAVED,
  VIEWER_EVENTS.MARKUP_SELECTED,
  VIEWER_EVENTS.MARKUP_CLICKED,
  VIEWER_EVENTS.MARKUP_ACTIVATED,
  VIEWER_EVENTS.MARKUPS_DIRTY,
  VIEWER_EVENTS.TOOL_ACTIVATED,
  VIEWER_EVENTS.PUBLICATION_LOADED,
  VIEWER_EVENTS.PAGE_RENDER,
  VIEWER_EVENTS.SAVE,
  VIEWER_EVENTS.SAVE_COMPLETE,
];

/**
 * ViewerEventBus class
 * Singleton that manages all viewer events with instance isolation
 */
class ViewerEventBus {
  constructor() {
    // Singleton pattern
    if (ViewerEventBus.instance) {
      return ViewerEventBus.instance;
    }
    ViewerEventBus.instance = this;

    /**
     * Registry of viewer instances
     * Map<instanceId, { api, viewerName, paneId, config, registeredAt }>
     */
    this.instances = new Map();

    /**
     * Event subscriptions
     * Map<eventType, Map<instanceId, Set<callback>>>
     */
    this.subscriptions = new Map();

    /**
     * Global listeners (for all instances, using "*" instanceId)
     * Map<eventType, Set<callback>>
     */
    this.globalListeners = new Map();

    /**
     * Native event listeners cleanup registry
     * Map<instanceId, Array<{ event: string, handler: Function }>>
     */
    this.nativeListeners = new Map();

    /**
     * Debug mode flag
     */
    this.debugMode = typeof localStorage !== "undefined" && localStorage.getItem("VIEWER_EVENT_BUS_DEBUG") === "true";

    this._log("ViewerEventBus initialized");
  }

  /**
   * Internal logging helper
   * @param {string} message - Log message
   * @param {Object} [data] - Optional data to log
   */
  _log(message, data) {
    if (this.debugMode) {
      // Debug logging is disabled in production - use log.debug for development
      // log.debug(`[ViewerEventBus] ${message}`, data || {});
    }
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("VIEWER_EVENT_BUS_DEBUG", String(enabled));
    }
    this._log(`Debug mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Register a viewer instance
   * @param {string} instanceId - Unique instance ID (e.g., "left-viewer", "right-viewer")
   * @param {Object} config - Instance configuration
   * @param {Object} config.api - Brava viewer API object
   * @param {string} config.viewerName - Brava viewer name (e.g., "BravaViewer")
   * @param {string} [config.paneId] - Pane ID ("left" or "right")
   */
  registerInstance(instanceId, config) {
    if (!instanceId) {
      log.warn("[ViewerEventBus] Cannot register instance without instanceId");
      return;
    }

    // Check if already registered
    if (this.instances.has(instanceId)) {
      this._log(`Instance ${instanceId} already registered, updating config`);
      // Update existing instance
      const existing = this.instances.get(instanceId);
      this.instances.set(instanceId, {
        ...existing,
        ...config,
        updatedAt: Date.now(),
      });
      return;
    }

    // Register new instance
    this.instances.set(instanceId, {
      ...config,
      registeredAt: Date.now(),
    });

    // Setup native Brava event listeners for this instance
    if (config.viewerName) {
      this._setupNativeListeners(instanceId, config.viewerName);
    }

    this._log(`Registered instance: ${instanceId}`, {
      viewerName: config.viewerName,
      paneId: config.paneId,
    });
  }

  /**
   * Unregister a viewer instance and cleanup all subscriptions
   * @param {string} instanceId - Instance to unregister
   */
  unregisterInstance(instanceId) {
    if (!instanceId || !this.instances.has(instanceId)) {
      this._log(`Instance ${instanceId} not found, nothing to unregister`);
      return;
    }

    // Remove all subscriptions for this instance
    this.subscriptions.forEach((instanceMap, eventType) => {
      if (instanceMap.has(instanceId)) {
        const callbacks = instanceMap.get(instanceId);
        this._log(`Removing ${callbacks.size} subscriptions for ${eventType}:${instanceId}`);
        instanceMap.delete(instanceId);
      }
    });

    // Cleanup native listeners
    this._cleanupNativeListeners(instanceId);

    // Remove from registry
    this.instances.delete(instanceId);

    this._log(`Unregistered instance: ${instanceId}`);
  }

  /**
   * Subscribe to an event for a specific instance
   * @param {string} eventType - Event type (e.g., "markupsLoaded", "pageRender")
   * @param {string} instanceId - Instance to subscribe for (or "*" for all)
   * @param {Function} callback - Event handler function
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, instanceId, callback) {
    if (!eventType || typeof callback !== "function") {
      log.warn("[ViewerEventBus] Invalid subscription parameters");
      return () => {};
    }

    // Global subscription (broadcast)
    if (instanceId === "*") {
      if (!this.globalListeners.has(eventType)) {
        this.globalListeners.set(eventType, new Set());
      }
      this.globalListeners.get(eventType).add(callback);

      this._log(`Added global subscription for ${eventType}`);

      // Return unsubscribe function
      return () => {
        const listeners = this.globalListeners.get(eventType);
        if (listeners) {
          listeners.delete(callback);
          this._log(`Removed global subscription for ${eventType}`);
        }
      };
    }

    // Instance-specific subscription
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Map());
    }

    const instanceMap = this.subscriptions.get(eventType);
    if (!instanceMap.has(instanceId)) {
      instanceMap.set(instanceId, new Set());
    }

    instanceMap.get(instanceId).add(callback);

    this._log(`Added subscription for ${eventType}:${instanceId}`);

    // Return unsubscribe function
    return () => {
      const map = this.subscriptions.get(eventType);
      if (map && map.has(instanceId)) {
        map.get(instanceId).delete(callback);
        this._log(`Removed subscription for ${eventType}:${instanceId}`);
      }
    };
  }

  /**
   * Emit an event to a specific instance or all instances
   * @param {string} eventType - Event type
   * @param {string} instanceId - Target instance (or "*" for broadcast)
   * @param {Object} [data={}] - Event data
   */
  emit(eventType, instanceId, data = {}) {
    const eventData = {
      type: eventType,
      instanceId,
      timestamp: Date.now(),
      ...data,
    };

    this._log(`Emitting ${eventType} for ${instanceId}`, eventData);

    // Notify instance-specific subscribers
    if (instanceId && instanceId !== "*") {
      const instanceMap = this.subscriptions.get(eventType);
      if (instanceMap && instanceMap.has(instanceId)) {
        const callbacks = instanceMap.get(instanceId);
        callbacks.forEach((callback) => {
          try {
            callback(eventData);
          } catch (error) {
            log.error(`[ViewerEventBus] Error in callback for ${eventType}:${instanceId}`, error);
          }
        });
      }
    }

    // Notify global subscribers (always, regardless of instanceId)
    if (this.globalListeners.has(eventType)) {
      const globalCallbacks = this.globalListeners.get(eventType);
      globalCallbacks.forEach((callback) => {
        try {
          callback(eventData);
        } catch (error) {
          log.error(`[ViewerEventBus] Error in global callback for ${eventType}`, error);
        }
      });
    }

    // If broadcasting, also notify all instance-specific subscribers
    if (instanceId === "*") {
      const instanceMap = this.subscriptions.get(eventType);
      if (instanceMap) {
        instanceMap.forEach((callbacks, instId) => {
          callbacks.forEach((callback) => {
            try {
              callback({ ...eventData, instanceId: instId });
            } catch (error) {
              log.error(`[ViewerEventBus] Error in broadcast callback for ${eventType}:${instId}`, error);
            }
          });
        });
      }
    }
  }

  /**
   * Setup native Brava event listeners and route them through the bus
   * @param {string} instanceId - Instance ID
   * @param {string} viewerName - Brava viewer name (e.g., "BravaViewer")
   * @private
   */
  _setupNativeListeners(instanceId, viewerName) {
    if (!viewerName) {
      this._log(`Cannot setup native listeners without viewerName for ${instanceId}`);
      return;
    }

    const listeners = [];

    NATIVE_EVENTS_TO_INTERCEPT.forEach((eventType) => {
      const nativeEventName = getNativeEventName(viewerName, eventType);

      const handler = (e) => {
        // Route native event through the bus with instanceId
        this.emit(eventType, instanceId, {
          originalEvent: e,
          detail: e.detail,
          viewerName,
          nativeEventName,
        });
      };

      window.addEventListener(nativeEventName, handler);
      listeners.push({ event: nativeEventName, handler });

      this._log(`Setup native listener: ${nativeEventName} -> ${instanceId}`);
    });

    this.nativeListeners.set(instanceId, listeners);
  }

  /**
   * Cleanup native event listeners for an instance
   * @param {string} instanceId - Instance ID
   * @private
   */
  _cleanupNativeListeners(instanceId) {
    const listeners = this.nativeListeners.get(instanceId);
    if (listeners) {
      listeners.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler);
        this._log(`Removed native listener: ${event}`);
      });
      this.nativeListeners.delete(instanceId);
    }
  }

  /**
   * Get instance info
   * @param {string} instanceId - Instance ID
   * @returns {Object|undefined} Instance config
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId);
  }

  /**
   * Get all registered instances
   * @returns {Map} All instances
   */
  getAllInstances() {
    return new Map(this.instances);
  }

  /**
   * Check if an instance is registered
   * @param {string} instanceId - Instance ID
   * @returns {boolean} Whether instance is registered
   */
  hasInstance(instanceId) {
    return this.instances.has(instanceId);
  }

  /**
   * Get subscription count for debugging
   * @returns {Object} Subscription statistics
   */
  getStats() {
    const stats = {
      instances: this.instances.size,
      subscriptions: {},
      globalListeners: {},
      nativeListeners: {},
    };

    this.subscriptions.forEach((instanceMap, eventType) => {
      let count = 0;
      instanceMap.forEach((callbacks) => {
        count += callbacks.size;
      });
      if (count > 0) {
        stats.subscriptions[eventType] = count;
      }
    });

    this.globalListeners.forEach((callbacks, eventType) => {
      if (callbacks.size > 0) {
        stats.globalListeners[eventType] = callbacks.size;
      }
    });

    this.nativeListeners.forEach((listeners, instanceId) => {
      stats.nativeListeners[instanceId] = listeners.length;
    });

    return stats;
  }

  /**
   * Clear all subscriptions and instances (for testing/cleanup)
   */
  reset() {
    // Cleanup all native listeners
    this.instances.forEach((_, instanceId) => {
      this._cleanupNativeListeners(instanceId);
    });

    // Clear all data
    this.instances.clear();
    this.subscriptions.clear();
    this.globalListeners.clear();
    this.nativeListeners.clear();

    this._log("ViewerEventBus reset complete");
  }
}

// Export singleton instance
export const viewerEventBus = new ViewerEventBus();

// Export class for testing
export default ViewerEventBus;
