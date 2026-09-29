/**
 * Sidebar Handlers
 *
 * Handles sidebar width management for Brava viewer.
 *
 * Features:
 * - Automatic width setting: Sets sidebar width to 200px when it opens
 * - ResizeObserver: Efficiently monitors sidebar width changes (replaces interval polling)
 * - Event-based detection: Listens for sidebar visibility change events
 * - Fallback detection: Checks actual width if events don't provide visibility flag
 *
 * Performance: Uses ResizeObserver instead of setInterval for better performance.
 */

import { SIDEBAR, SIDEBAR_SELECTORS, TIMING } from "./constants";
import { CleanupManager } from "./CleanupManager";
import { log } from "./logger";

/**
 * Setup sidebar width management
 * Monitors sidebar visibility changes and sets width to 200px when it opens
 * Uses ResizeObserver instead of interval polling for better performance
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 * @returns {Function|null} Cleanup function or null
 */
export const setupSidebarWidthManagement = (viewerName, api) => {
  if (!viewerName || !api) return null;

  // Set sidebar width function with multiple fallback sidebar names
  const setSidebarWidth = (width) => {
    try {
      if (typeof api.setSidebarWidth === "function") {
        // Try custom layout sidebar name first
        api.setSidebarWidth(width, "tabContainerWithMarkups", true);
      }
    } catch {
      try {
        // Fallback to default sidebar name
        if (typeof api.setSidebarWidth === "function") {
          api.setSidebarWidth(width, "leftTabContainer", true);
        }
      } catch {
        try {
          // Last fallback - try without side parameter
          if (typeof api.setSidebarWidth === "function") {
            api.setSidebarWidth(width, undefined, true);
          }
        } catch (e3) {
          log.warn("[SidebarHandlers] Failed to set sidebar width", { error: e3 });
        }
      }
    }
  };

  // Handle sidebar visibility change
  const handleSidebarVisibilityChange = (isVisible) => {
    if (isVisible) {
      // Event-driven: Sidebar visibility change detected via ResizeObserver
      // Set width immediately when sidebar becomes visible (no delay needed)
      setSidebarWidth(SIDEBAR.DEFAULT_WIDTH);
    }
  };

  // Find sidebar element using selectors
  const findSidebarElement = () => {
    for (const selector of SIDEBAR_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  };

  // Listen for sidebar visibility changes and set width when it opens
  const sidebarEvents = [
    `${viewerName}-sidebarVisibilityChanged`,
    "sidebarVisibilityChanged",
    `${viewerName}-sidebarToggle`,
    "sidebarToggle",
  ];

  const eventHandlers = [];
  sidebarEvents.forEach((eventName) => {
    const handleEvent = (e) => {
      // Check if event detail has isVisible flag
      if (e.detail && e.detail.isVisible !== undefined) {
        handleSidebarVisibilityChange(e.detail.isVisible);
      } else if (e.detail && e.detail.sidebarName) {
        // Check if this is our sidebar
        const isOurSidebar = SIDEBAR.SIDEBAR_NAMES.includes(
          e.detail.sidebarName
        );
        if (isOurSidebar && e.detail.isVisible) {
          handleSidebarVisibilityChange(true);
        }
      } else {
        // Event-driven: Check sidebar width immediately when toggle event fires
        // No delay needed - ResizeObserver will catch any subsequent changes
        const sidebarElement = findSidebarElement();
        if (sidebarElement) {
          const currentWidth = parseFloat(
            window.getComputedStyle(sidebarElement).width
          );
          if (currentWidth > SIDEBAR.MIN_VISIBLE_WIDTH) {
            handleSidebarVisibilityChange(true);
          }
        }
      }
    };
    window.addEventListener(eventName, handleEvent);
    eventHandlers.push({ eventName, handler: handleEvent });
  });

  // Use ResizeObserver for efficient width monitoring (replaces interval polling)
  // CleanupManager for automatic memory management
  const cleanup = new CleanupManager('SidebarHandlers');

  let lastSidebarWidth = 0;
  let resizeObserver = null;

  // Simple debounce utility
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const setupResizeObserver = () => {
    const sidebarElement = findSidebarElement();

    if (sidebarElement && window.ResizeObserver) {
      // Debounce the observer callback to prevent rapid firing during animations
      const debouncedResizeHandler = debounce((entries) => {
        for (const entry of entries) {
          const currentWidth = entry.contentRect.width;

          // If sidebar just opened (was closed, now has width)
          if (
            lastSidebarWidth < SIDEBAR.MIN_VISIBLE_WIDTH &&
            currentWidth > SIDEBAR.MIN_VISIBLE_WIDTH
          ) {
            handleSidebarVisibilityChange(true);
          }

          lastSidebarWidth = currentWidth;
        }
      }, 50); // 50ms debounce

      resizeObserver = new ResizeObserver(debouncedResizeHandler);

      resizeObserver.observe(sidebarElement);

      // Track observer for automatic cleanup
      cleanup.addObserver(resizeObserver);
    } else if (!window.ResizeObserver) {
      log.warn("[SidebarHandlers] ResizeObserver not supported, falling back to event-based detection only");
    }
  };

  // Try to set up ResizeObserver immediately, or wait for sidebar to appear
  const sidebarElement = findSidebarElement();
  if (sidebarElement) {
    setupResizeObserver();
  } else {
    // Event-driven: Use MutationObserver to watch for sidebar element to be added to DOM
    // This is more efficient than polling with setInterval
    const observer = new MutationObserver(() => {
      const element = findSidebarElement();
      if (element) {
        observer.disconnect();
        setupResizeObserver();
      }
    });
    
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Track observer for automatic cleanup on component destroy
    cleanup.addObserver(observer);
  }

  // Return cleanup function - military-grade cleanup
  return () => {
    // Remove event listeners (still manual for now, can be migrated to CleanupManager if needed)
    eventHandlers.forEach(({ eventName, handler }) => {
      try {
        window.removeEventListener(eventName, handler);
      } catch {
        // Ignore errors during cleanup
      }
    });

    // Destroy all tracked resources (observers)
    cleanup.destroy();
    
    resizeObserver = null;
  };
};
