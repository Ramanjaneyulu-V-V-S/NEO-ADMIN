/**
 * Custom Button Handlers
 *
 * Handles custom toolbar button clicks and interactions.
 *
 * Features:
 * - Copy page link: Copies current page URL to clipboard
 * - Select tool: Activates the select tool (deactivates other tools)
 * - Highlighter tool: Activates highlighter tool
 * - Text tool: Activates text annotation tool
 * - Notifications: Shows success/error notifications for user actions
 * - Error handling: All event handlers wrapped with try-catch to prevent single errors from breaking viewer
 */

import { wrapHandler } from "./errorHandling";
import { log } from "./logger";

/**
 * Handle copy page link button click
 * Copies current page link to clipboard
 * @param {Object} api - Brava viewer API instance
 * @param {Object} config - Viewer configuration
 */
export const handleCopyPageLink = async (api, config) => {
  try {
    const pid = config?.publicationDetails?.id;
    if (!pid) {
      throw new Error("Publication ID not found");
    }

    let pageNumber = 1;
    if (typeof api.getViewstate === "function") {
      const viewstate = await api.getViewstate();
      if (viewstate && viewstate.page !== undefined) {
        pageNumber = viewstate.page + 1;
      }
    }

    // Copy plain URL to clipboard
    const linkQuery = `?type=page&pid=${pid}&pageNumber=${pageNumber}`;
    const fullLink = `${window.parent.location.protocol}//${window.parent.location.host}${window.parent.location.pathname}${linkQuery}`;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullLink);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = fullLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      // Show success notification
      showNotification("Link copied!", "success");
    } catch {
      showNotification("Failed to copy page reference", "error");
    }
  } catch (error) {
    showNotification(`${error.message}`, "error");
  }
};

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Type of notification ('success' or 'error')
 */
const showNotification = (message, type) => {
  const notification = document.createElement("div");
  notification.textContent = message;
  const isError = type === "error";
  notification.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    background: ${isError ? "#fff0f0" : "white"};
    color: ${isError ? "#d32f2f" : "#333"};
    padding: 8px 14px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 11px;
    font-weight: 400;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  // Event-driven animation: Use animationend event instead of setTimeout
  const handleAnimationEnd = (e) => {
    if (e.animationName === "slideOut") {
      notification.removeEventListener("animationend", handleAnimationEnd);
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }
  };

  notification.addEventListener("animationend", handleAnimationEnd);

  // Start slideOut animation after slideIn completes
  const handleSlideInEnd = (e) => {
    if (e.animationName === "slideIn") {
      notification.removeEventListener("animationend", handleSlideInEnd);
      // Wait for notification to be visible (2.5s), then trigger slideOut
      // Use transition delay via CSS animation-delay instead of setTimeout
      notification.style.animation = "slideOut 0.3s ease-out 2.5s";
    }
  };

  notification.addEventListener("animationend", handleSlideInEnd);
};

/**
 * Handle select tool button click
 * @param {Object} api - Brava viewer API instance
 */
export const handleSelectTool = (api) => {
  const currentApi = api || window.viewerApi || (window.viewerName && window[window.viewerName]);

  if (currentApi && typeof currentApi.activateTool === "function") {
    try {
      currentApi.activateTool(); // No parameters = select tool
    } catch (error) {
      log.error("[CustomButtonHandlers] Error activating select tool", error);
    }
  }
};

/**
 * Handle highlighter tool button click
 * @param {Object} api - Brava viewer API instance
 */
export const handleHighlighter = (api) => {
  const currentApi = api || window.viewerApi || (window.viewerName && window[window.viewerName]);

  if (currentApi) {
    try {
      if (typeof currentApi.enableToolbarButtons === "function") {
        currentApi.enableToolbarButtons(true);
      }

      if (typeof currentApi.activateTool === "function") {
        const highlightToolData = {
          label: "Highlight",
          tool: "highlight",
          icon: "Highlight",
          props: {
            strokeWidth: 0.2,
          },
        };
        currentApi.activateTool(highlightToolData);
      }
    } catch (error) {
      log.error("[CustomButtonHandlers] Error activating highlight tool", error);
    }
  }
};

/**
 * Handle text tool button click
 * @param {Object} api - Brava viewer API instance
 */
export const handleTextTool = (api) => {
  const currentApi = api || window.viewerApi || (window.viewerName && window[window.viewerName]);

  if (currentApi && typeof currentApi.activateTool === "function") {
    try {
      // First set the default properties for text tool
      if (typeof currentApi.updateToolProperties === "function") {
        const textToolDefaults = {
          backgroundColor: "#ffffff00",
          foregroundColor: "#000000ff",
          strokeWidth: 0.2,
          size: 0.16,
          text: " ",
        };
        currentApi.updateToolProperties(textToolDefaults);
      }

      // Then activate the text tool
      const textToolData = {
        label: "text",
        tool: "text",
        icon: "Text",
        props: {
          backgroundColor: "#ffffff00",
          foregroundColor: "#000000ff",
          strokeWidth: 0.2,
          size: 0.16,
          text: " ",
        },
      };

      currentApi.activateTool(textToolData);
    } catch (error) {
      log.error("[CustomButtonHandlers] Error activating text tool", error);
    }
  }
};

/**
 * Handle custom button click
 * Routes to appropriate handler based on eventKey
 * @param {string} eventKey - Button event key
 * @param {Object} api - Brava viewer API instance
 * @param {Object} config - Viewer configuration
 */
export const handleCustomButtonClick = async (eventKey, api, config) => {
  switch (eventKey) {
    case "copyPageLinkButton":
      await handleCopyPageLink(api, config);
      break;
    case "selectTool":
      handleSelectTool(api);
      break;
    case "highlighter":
      handleHighlighter(api);
      break;
    case "textTool":
      handleTextTool(api);
      break;
    default:
    // Unknown button event
  }
};

/**
 * Setup custom button click detection via DOM event listeners
 * @param {Object} api - Brava viewer API instance
 * @param {Object} config - Viewer configuration
 * @param {string} viewerName - Name of the viewer
 */
export const setupCustomButtonClickDetection = (api, config, viewerName) => {
  const handleDocumentClickUnsafe = (e) => {
    // Check for data-event-key on the clicked element or its parents
    let eventKeyElement = e.target.closest("[data-event-key]");

    if (eventKeyElement) {
      const eventKey = eventKeyElement.getAttribute("data-event-key");
      if (eventKey) {
        handleCustomButtonClick(eventKey, api, config);
      }
      return;
    }

    // Check for custom buttons by data-testid and aria-label
    const buttonElement = e.target.closest("button");
    if (buttonElement) {
      const testId = buttonElement.getAttribute("data-testid");
      const ariaLabel = buttonElement.getAttribute("aria-label");

      if (testId === "customButton") {
        if (ariaLabel === "Copy page reference") {
          handleCustomButtonClick("copyPageLinkButton", api, config);
          return;
        }
        if (ariaLabel === "Activate highlighter tool") {
          handleCustomButtonClick("highlighter", api, config);
          return;
        }
        if (ariaLabel === "Activate select tool") {
          handleCustomButtonClick("selectTool", api, config);
          return;
        }
        if (ariaLabel === "Activate text tool") {
          handleCustomButtonClick("textTool", api, config);
          return;
        }
      }
    }
  };

  // Wrap handler with error handling
  const handleDocumentClick = wrapHandler(handleDocumentClickUnsafe, "CustomButtonHandlers", "handleDocumentClick");

  // Listen for custom button events from viewer
  const customButtonEvents = [viewerName + "-customButtonClick", "customButtonClick"];

  customButtonEvents.forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      if (e.detail && e.detail.eventKey) {
        handleCustomButtonClick(e.detail.eventKey, api, config);
      }
    });
  });

  // Also listen for direct clicks
  document.addEventListener("click", handleDocumentClick, true);

  // Return cleanup function
  return () => {
    document.removeEventListener("click", handleDocumentClick, true);
    customButtonEvents.forEach((eventName) => {
      window.removeEventListener(eventName, handleDocumentClick);
    });
  };
};
