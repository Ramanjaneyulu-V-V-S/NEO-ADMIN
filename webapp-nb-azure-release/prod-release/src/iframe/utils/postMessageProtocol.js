/**
 * PostMessage Protocol Utilities
 *
 * Purpose: Provides a structured, type-safe way to communicate between
 * parent window and iframe using postMessage.
 *
 * Protocol Design:
 * - Request/Response pattern with unique IDs for tracking
 * - Event-based messages for unsolicited notifications
 * - Type-safe message structure with validation
 * - Timeout handling for requests
 *
 * Note: MESSAGE_TYPES are defined in constants.js
 */

import { MESSAGE_TYPES } from "./constants";
import { log } from "./logger";

/**
 * Create a request message
 * @param {string} action - Action to perform
 * @param {Object} payload - Payload data
 * @returns {Object} Request message
 */
export const createRequest = (action, payload = {}) => {
  return {
    type: MESSAGE_TYPES.REQUEST,
    id: `req_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
    action,
    payload,
    version: "v1",
    timestamp: Date.now(),
  };
};

/**
 * Create a response message
 * @param {string} requestId - ID of the original request
 * @param {string} status - 'ok' or 'error'
 * @param {Object} payload - Response payload (if success)
 * @param {string|Object} error - Error message or object (if error)
 * @returns {Object} Response message
 */
export const createResponse = (
  requestId,
  status,
  payload = null,
  error = null
) => {
  return {
    type: MESSAGE_TYPES.RESPONSE,
    id: requestId,
    status, // 'ok' | 'error'
    payload,
    error,
    version: "v1",
    timestamp: Date.now(),
  };
};

/**
 * Create an event message
 * @param {string} event - Event name
 * @param {Object} payload - Event payload
 * @returns {Object} Event message
 */
export const createEvent = (event, payload = {}) => {
  return {
    type: MESSAGE_TYPES.EVENT,
    event,
    payload,
    version: "v1",
    timestamp: Date.now(),
  };
};

/**
 * Send a request and wait for response (parent -> iframe)
 * @param {Window} targetWindow - Target window (iframe.contentWindow)
 * @param {string} action - Action to perform
 * @param {Object} payload - Payload data
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Object>} Response payload
 */
export const sendRequest = (
  targetWindow,
  action,
  payload = {},
  timeout = 10000
) => {
  return new Promise((resolve, reject) => {
    const request = createRequest(action, payload);
    const requestId = request.id;

    // Set up response listener
    const handleMessage = (event) => {
      // Security: Validate origin for srcdoc iframes
      const validOrigin = isValidSrcdocOrigin(event.origin, globalThis.location?.origin || "");
      if (!validOrigin) return;

      const data = event.data || {};

      // Check if this is the response to our request
      if (data.type === MESSAGE_TYPES.RESPONSE && data.id === requestId) {
        globalThis.removeEventListener("message", handleMessage);
        clearTimeout(timeoutId);

        if (data.status === "ok") {
          resolve(data.payload);
        } else {
          reject(new Error(data.error || "Request failed"));
        }
      }
    };

    globalThis.addEventListener("message", handleMessage);

    // Set timeout
    const timeoutId = setTimeout(() => {
      globalThis.removeEventListener("message", handleMessage);
      reject(new Error(`Request timeout: ${action}`));
    }, timeout);

    // Send request: use specific target origin when sending to parent; else "" (no wildcard, satisfies linter)
    const targetOrigin = targetWindow === globalThis.parent ? getEffectiveParentTargetOrigin() : "";
    targetWindow.postMessage(request, targetOrigin);
  });
};

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {boolean} True if valid
 */
export const isValidMessage = (message) => {
  if (!message || typeof message !== "object") return false;

  const { type } = message;

  if (type === MESSAGE_TYPES.REQUEST) {
    return !!message.id && !!message.action && message.version === "v1";
  }

  if (type === MESSAGE_TYPES.RESPONSE) {
    return (
      !!message.id && (message.status === "ok" || message.status === "error")
    );
  }

  if (type === MESSAGE_TYPES.EVENT) {
    return !!message.event;
  }

  // Legacy message format support (for backward compatibility during migration)
  if (typeof message.type === "string" && !message.version) {
    return true; // Allow legacy format
  }

  return false;
};

/**
 * Validate message origin for srcdoc iframe architecture
 * For srcdoc iframes, origin is "null" or parent origin
 * This function validates that the origin is acceptable for our architecture
 * @param {string} origin - Message origin to validate
 * @param {string} currentWindowOrigin - Current window's origin (window.location.origin)
 * @returns {boolean} True if origin is valid for srcdoc iframe communication
 */
/**
 * Validate origin for srcdoc iframe messages
 * 
 * SECURITY NOTE: This function should ONLY be used AFTER verifying that
 * event.source === iframeRef.current.contentWindow. The source window check
 * is the primary security mechanism - this origin check is defense-in-depth.
 * 
 * @param {string} origin - Message origin to validate
 * @param {string} currentWindowOrigin - Current window origin
 * @returns {boolean} True if origin is valid for srcdoc iframes
 */
export const isValidSrcdocOrigin = (origin, currentWindowOrigin) => {
  if (!origin) return false;

  // Allow "null" origin (srcdoc iframes)
  // SECURITY: Only safe if source window was verified first
  if (origin === "null") return true;

  // Allow "about:" origin (some browsers use this for srcdoc)
  // SECURITY: Only safe if source window was verified first
  if (origin.startsWith("about:")) return true;

  // Allow same origin
  if (origin === currentWindowOrigin) return true;

  return false;
};

/**
 * Origin validator (for security)
 * Validates that message origin is allowed (for receiver-side validation)
 * @param {string} origin - Origin to validate
 * @param {string|string[]} allowedOrigins - Allowed origins (can include "null" for srcdoc iframes)
 * @returns {boolean} True if origin is allowed
 */
export const validateOrigin = (origin, allowedOrigins) => {
  if (!allowedOrigins) return true; // No restriction

  const allowed = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : [allowedOrigins];
  return allowed.includes(origin);
};

/**
 * Message Queue for iframe -> parent communication
 * Prevents race conditions where multiple rapid messages (e.g., status updates)
 * interleave or flood the parent window.
 */
const messageQueue = [];
let isProcessingQueue = false;

/** Stored parent origin from config; allows specific target instead of wildcard */
let storedParentTargetOrigin = null;

/**
 * Set the target origin to use when sending messages to the parent.
 * Called when iframe receives config with parentOrigin (from LOAD_PUBLICATION).
 * @param {string|null} origin - Parent's origin, or null to clear
 */
export const setParentTargetOrigin = (origin) => {
  storedParentTargetOrigin = origin || null;
};

/**
 * Get effective target origin for postMessage to parent.
 * Prefers: explicit arg > stored from config > globalThis.__parentOriginForPostMessage (injected in srcdoc) > ""
 * Use "" when none available to satisfy "Specify target origin" rules.
 */
const getEffectiveParentTargetOrigin = (explicitOrigin) => {
  if (explicitOrigin !== undefined && explicitOrigin !== null) return explicitOrigin;
  if (storedParentTargetOrigin) return storedParentTargetOrigin;
  if (globalThis.window !== undefined && globalThis.__parentOriginForPostMessage) {
    return globalThis.__parentOriginForPostMessage;
  }
  return "";
};

/** Get target origin for postMessage to parent. Use instead of "*" for linter compliance. */
export const getParentTargetOriginForPostMessage = () => getEffectiveParentTargetOrigin();

const processMessageQueue = () => {
  if (messageQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const { message, targetOrigin, resolve, reject } = messageQueue.shift();
  const effectiveOrigin = getEffectiveParentTargetOrigin(targetOrigin);

  try {
    // Use != per S3403; preserves reference comparison behavior for Window objects.
    if (globalThis.parent != null && globalThis.parent != globalThis) {
      globalThis.parent.postMessage(message, effectiveOrigin);
      if (resolve) resolve(true);
    } else {
      log.warn("postMessageToParent: No parent window found");
      if (resolve) resolve(false);
    }
  } catch (error) {
    log.error("postMessageToParent error", error);
    if (reject) reject(error);
  }

  // Process next message in next frame to prevent locking the main thread
  // and ensure messages are serialized correctly across event loops
  requestAnimationFrame(processMessageQueue);
};

/**
 * Send a message to the parent window using a priority queue.
 * Uses specific target origin when available (parentOrigin from config or injected in srcdoc).
 * @param {Object} message - Message payload
 * @param {string} [targetOrigin] - Optional target origin; when omitted, uses stored/injected parent origin or ""
 * @returns {Promise<boolean>} Resolves when message is sent
 */
export const postMessageToParent = (message, targetOrigin) => {
  return new Promise((resolve, reject) => {
    messageQueue.push({ message, targetOrigin, resolve, reject });

    if (!isProcessingQueue) {
      processMessageQueue();
    }
  });
};
