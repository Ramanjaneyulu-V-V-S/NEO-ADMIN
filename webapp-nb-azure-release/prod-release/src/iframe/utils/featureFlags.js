/**
 * featureFlags.js
 *
 * Feature flag configuration for the event-driven architecture.
 * All features are enabled by default as the event-driven approach
 * is now the primary implementation.
 *
 * Usage:
 *   import { featureFlags, isFeatureEnabled } from './featureFlags';
 *
 *   // Check if feature is enabled
 *   if (isFeatureEnabled('USE_EVENT_BUS')) {
 *     viewerEventBus.emit(eventType, instanceId, data);
 *   }
 *
 *   // Enable feature at runtime (for testing)
 *   featureFlags.enableFeature('USE_EVENT_BUS');
 *
 * @module featureFlags
 */

import { log } from "./logger";

/**
 * Feature flag definitions
 * Each flag controls a specific aspect of the event-driven architecture
 */
const FLAG_DEFINITIONS = {
  /**
   * Master switch for event bus functionality
   * When disabled, all event bus features are bypassed
   */
  USE_EVENT_BUS: {
    defaultValue: true,
    description: "Enable ViewerEventBus for event routing",
  },

  /**
   * Enable event bus for markup events
   * Controls: markupsLoaded, markupAdded, markupsSaved, etc.
   */
  EVENT_BUS_MARKUPS: {
    defaultValue: true,
    description: "Route markup events through event bus",
  },

  /**
   * Enable event bus for save events
   * Controls: save, saveComplete
   */
  EVENT_BUS_SAVE: {
    defaultValue: true,
    description: "Route save events through event bus",
  },

  /**
   * Enable event bus for navigation events
   * Controls: navigateToPage, hyperlinkClick
   */
  EVENT_BUS_NAVIGATION: {
    defaultValue: true,
    description: "Route navigation events through event bus",
  },

  /**
   * Enable event bus for viewer lifecycle events
   * Controls: publicationLoaded, pageRender, viewerInitialized
   */
  EVENT_BUS_LIFECYCLE: {
    defaultValue: true,
    description: "Route viewer lifecycle events through event bus",
  },

  /**
   * Enable detailed event bus logging
   * Useful for debugging
   */
  EVENT_BUS_DEBUG: {
    defaultValue: false,
    description: "Enable detailed event bus logging",
  },

  /**
   * Enable instance isolation validation
   * Logs warnings if events are received by wrong instance
   */
  VALIDATE_INSTANCE_ISOLATION: {
    defaultValue: true,
    description: "Validate that events are routed to correct viewer instance",
  },
};

/**
 * Storage key prefix for persisted flags
 */
const STORAGE_KEY_PREFIX = "VIEWER_FEATURE_";

/**
 * FeatureFlags class
 * Manages feature flag state with localStorage persistence
 */
class FeatureFlags {
  constructor() {
    this.flags = new Map();
    this._initializeFlags();
  }

  /**
   * Initialize flags from defaults and localStorage
   * @private
   */
  _initializeFlags() {
    Object.entries(FLAG_DEFINITIONS).forEach(([flagName, config]) => {
      // Check sessionStorage first
      const storedValue = this._getStoredValue(flagName);
      const value = storedValue !== null ? storedValue : config.defaultValue;
      this.flags.set(flagName, value);
    });
  }

  /**
   * Get stored value from localStorage
   * @param {string} flagName - Flag name
   * @returns {boolean|null} Stored value or null if not set
   * @private
   */
  _getStoredValue(flagName) {
    if (typeof sessionStorage === "undefined") return null;

    const key = STORAGE_KEY_PREFIX + flagName;
    const stored = sessionStorage.getItem(key);

    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  }

  /**
   * Save flag value to localStorage
   * @param {string} flagName - Flag name
   * @param {boolean} value - Flag value
   * @private
   */
  _setStoredValue(flagName, value) {
    if (typeof sessionStorage === "undefined") return;

    const key = STORAGE_KEY_PREFIX + flagName;
    sessionStorage.setItem(key, String(value));
  }

  /**
   * Check if a feature is enabled
   * @param {string} flagName - Feature flag name
   * @returns {boolean} Whether feature is enabled
   */
  isEnabled(flagName) {
    // If master switch is off, all features are disabled
    if (flagName !== "USE_EVENT_BUS" && !this.flags.get("USE_EVENT_BUS")) {
      return false;
    }

    return this.flags.get(flagName) ?? false;
  }

  /**
   * Enable a feature
   * @param {string} flagName - Feature flag name
   */
  enableFeature(flagName) {
    if (!FLAG_DEFINITIONS[flagName]) {
      log.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
      return;
    }

    this.flags.set(flagName, true);
    this._setStoredValue(flagName, true);
  }

  /**
   * Disable a feature
   * @param {string} flagName - Feature flag name
   */
  disableFeature(flagName) {
    if (!FLAG_DEFINITIONS[flagName]) {
      log.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
      return;
    }

    this.flags.set(flagName, false);
    this._setStoredValue(flagName, false);
  }

  /**
   * Toggle a feature
   * @param {string} flagName - Feature flag name
   * @returns {boolean} New value
   */
  toggleFeature(flagName) {
    const current = this.isEnabled(flagName);
    if (current) {
      this.disableFeature(flagName);
    } else {
      this.enableFeature(flagName);
    }
    return !current;
  }

  /**
   * Reset a flag to its default value
   * @param {string} flagName - Feature flag name
   */
  resetFeature(flagName) {
    if (!FLAG_DEFINITIONS[flagName]) {
      log.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
      return;
    }

    const defaultValue = FLAG_DEFINITIONS[flagName].defaultValue;
    this.flags.set(flagName, defaultValue);

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY_PREFIX + flagName);
    }
  }

  /**
   * Reset all flags to defaults
   */
  resetAll() {
    Object.keys(FLAG_DEFINITIONS).forEach((flagName) => {
      this.resetFeature(flagName);
    });
  }

  /**
   * Get all flag values and descriptions
   * @returns {Object} All flags with their current values and descriptions
   */
  getAll() {
    const result = {};
    Object.entries(FLAG_DEFINITIONS).forEach(([flagName, config]) => {
      result[flagName] = {
        enabled: this.isEnabled(flagName),
        description: config.description,
        defaultValue: config.defaultValue,
      };
    });
    return result;
  }

  /**
   * Print all flags to console (for debugging)
   */
  printStatus() {
    console.table(this.getAll());
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlags();

/**
 * Convenience function to check if a feature is enabled
 * @param {string} flagName - Feature flag name
 * @returns {boolean} Whether feature is enabled
 */
export function isFeatureEnabled(flagName) {
  return featureFlags.isEnabled(flagName);
}

/**
 * Feature flag names as constants
 */
export const FLAGS = {
  USE_EVENT_BUS: "USE_EVENT_BUS",
  EVENT_BUS_MARKUPS: "EVENT_BUS_MARKUPS",
  EVENT_BUS_SAVE: "EVENT_BUS_SAVE",
  EVENT_BUS_NAVIGATION: "EVENT_BUS_NAVIGATION",
  EVENT_BUS_LIFECYCLE: "EVENT_BUS_LIFECYCLE",
  EVENT_BUS_DEBUG: "EVENT_BUS_DEBUG",
  VALIDATE_INSTANCE_ISOLATION: "VALIDATE_INSTANCE_ISOLATION",
};

/**
 * Helper to execute code conditionally based on feature flag
 * @param {string} flagName - Feature flag name
 * @param {Function} codePath - Code to execute if feature is enabled
 * @returns {*} Result of executed code path
 */
export function withFeatureFlag(flagName, codePath) {
  const isEnabled = featureFlags.isEnabled(flagName);

  if (isEnabled) {
    return codePath();
  }
}

export default featureFlags;
