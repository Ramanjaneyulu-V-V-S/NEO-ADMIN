/**
 * Event-Driven Architecture Exports
 *
 * Central export file for all event-driven architecture modules.
 * This provides a single import point for components that need to interact
 * with the ViewerEventBus system.
 *
 * Usage:
 *   import {
 *     viewerEventBus,
 *     VIEWER_EVENTS,
 *     INSTANCE_IDS,
 *     useViewerEvent,
 *     featureFlags
 *   } from '../utils/eventDriven';
 *
 * @module eventDriven
 */

// Core event bus
export { viewerEventBus, default as ViewerEventBus } from "../ViewerEventBus";

// Event types and constants
export {
  VIEWER_EVENTS,
  INSTANCE_IDS,
  PANE_IDS,
  getNativeEventName,
  getInstanceIdFromPane,
  getPaneIdFromInstance,
} from "../ViewerEventTypes";

// React hooks
export {
  useViewerEvent,
  useGlobalViewerEvent,
  useViewerEmit,
  useViewerBroadcast,
  useViewerInstance,
  useViewerEventStats,
  useHasViewerInstance,
} from "../useViewerEvent";

// Feature flags
export {
  featureFlags,
  isFeatureEnabled,
  FLAGS,
  withFeatureFlag,
} from "../featureFlags";
