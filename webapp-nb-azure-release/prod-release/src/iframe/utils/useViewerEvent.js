/**
 * useViewerEvent.js
 *
 * React hooks for subscribing to viewer events through the ViewerEventBus.
 * These hooks provide a clean React interface for event-driven communication
 * between viewer instances.
 *
 * Features:
 * - Automatic subscription/unsubscription on mount/unmount
 * - Instance-specific event handling
 * - Global event subscriptions
 * - Memoized callbacks for performance
 *
 * Usage:
 *   import { useViewerEvent, useGlobalViewerEvent } from './useViewerEvent';
 *
 *   // Subscribe to instance-specific event
 *
 *   // Subscribe to all instances
 *
 * @module useViewerEvent
 */

import { useEffect, useCallback, useRef } from "react";
import { viewerEventBus } from "./ViewerEventBus";
import { VIEWER_EVENTS, INSTANCE_IDS } from "./ViewerEventTypes";
import { log } from "./logger";

/**
 * Hook to subscribe to a viewer event for a specific instance
 *
 * @param {string} eventType - Event type from VIEWER_EVENTS
 * @param {string} instanceId - Instance ID to subscribe to
 * @param {Function} callback - Event handler callback
 * @param {Array} [deps=[]] - Additional dependencies for the callback
 *
 * @example
 */
export function useViewerEvent(eventType, instanceId, callback, deps = []) {
  // Store callback in ref to avoid recreating subscription on every render
  const callbackRef = useRef(callback);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  useEffect(() => {
    if (!eventType || !instanceId) {
      log.warn("[useViewerEvent] Missing eventType or instanceId", { eventType, instanceId });
      return;
    }

    // Create stable handler that calls the latest callback
    const handler = (event) => {
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    };

    // Subscribe to the event
    const unsubscribe = viewerEventBus.subscribe(eventType, instanceId, handler);

    // Cleanup on unmount or when dependencies change
    return () => {
      unsubscribe();
    };
  }, [eventType, instanceId]);
}

/**
 * Hook to subscribe to a viewer event for ALL instances (global/broadcast)
 *
 * @param {string} eventType - Event type from VIEWER_EVENTS
 * @param {Function} callback - Event handler callback
 * @param {Array} [deps=[]] - Additional dependencies for the callback
 *
 * @example
 */
export function useGlobalViewerEvent(eventType, callback, deps = []) {
  return useViewerEvent(eventType, INSTANCE_IDS.BROADCAST, callback, deps);
}

/**
 * Hook to emit events to a specific viewer instance
 *
 * @param {string} instanceId - Target instance ID
 * @returns {Function} Emit function: (eventType, data) => void
 *
 * @example
 * const emit = useViewerEmit('left-viewer');
 * emit(VIEWER_EVENTS.NAVIGATE_TO_PAGE, { page: 5 });
 */
export function useViewerEmit(instanceId) {
  const emit = useCallback(
    (eventType, data = {}) => {
      if (!instanceId) {
        log.warn("[useViewerEmit] No instanceId provided");
        return;
      }
      viewerEventBus.emit(eventType, instanceId, data);
    },
    [instanceId],
  );

  return emit;
}

/**
 * Hook to emit events to all viewer instances (broadcast)
 *
 * @returns {Function} Broadcast function: (eventType, data) => void
 *
 * @example
 * const broadcast = useViewerBroadcast();
 * broadcast(VIEWER_EVENTS.SAVE_COMPLETE, { success: true });
 */
export function useViewerBroadcast() {
  return useViewerEmit(INSTANCE_IDS.BROADCAST);
}

/**
 * Hook to register a viewer instance on mount and unregister on unmount
 *
 * @param {string} instanceId - Unique instance ID
 * @param {Object} config - Instance configuration
 * @param {Object} config.api - Brava viewer API object
 * @param {string} config.viewerName - Brava viewer name
 * @param {string} [config.paneId] - Pane ID ("left" or "right")
 *
 * @example
 * useViewerInstance('left-viewer', {
 *   api: bravaApi,
 *   viewerName: 'BravaViewer',
 *   paneId: 'left'
 * });
 */
export function useViewerInstance(instanceId, config) {
  const configRef = useRef(config);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (!instanceId) {
      log.warn("[useViewerInstance] No instanceId provided");
      return;
    }

    // Register instance
    viewerEventBus.registerInstance(instanceId, configRef.current);

    // Unregister on unmount
    return () => {
      viewerEventBus.unregisterInstance(instanceId);
    };
  }, [instanceId]);
}

/**
 * Hook to get current event bus stats (for debugging)
 *
 * @returns {Object} Event bus statistics
 */
export function useViewerEventStats() {
  return viewerEventBus.getStats();
}

/**
 * Hook to check if an instance is registered
 *
 * @param {string} instanceId - Instance ID to check
 * @returns {boolean} Whether instance is registered
 */
export function useHasViewerInstance(instanceId) {
  return viewerEventBus.hasInstance(instanceId);
}

// Re-export constants for convenience
export { VIEWER_EVENTS, INSTANCE_IDS };

export default {
  useViewerEvent,
  useGlobalViewerEvent,
  useViewerEmit,
  useViewerBroadcast,
  useViewerInstance,
  useViewerEventStats,
  useHasViewerInstance,
};
