/**
 * Navigation & Hyperlink Handlers
 *
 * Handles hyperlink navigation and deep linking within the viewer.
 *
 * Features:
 * - Hyperlink clicks: Intercepts hyperlink clicks in markups and comment panes
 * - Document navigation: Parses document links and sends to parent for handling
 * - External links: Opens external links in new window
 * - Deep linking: Handles navigation to bookmarks, rectangles, and pages from URL
 * - MutationObserver: Watches for dynamically added hyperlinks
 * - ViewerEventBus integration: Deep linking uses PAGE_RENDER event subscription
 * - Error handling: All event handlers wrapped with try-catch to prevent single errors from breaking viewer
 */

import { viewerEventBus } from "./ViewerEventBus";
import { VIEWER_EVENTS } from "./ViewerEventTypes";
import { wrapHandler, wrapMutationObserver, logError } from "./errorHandling";
import { log } from "./logger";
import { getParentTargetOriginForPostMessage } from "./postMessageProtocol";

/**
 * Parse URL to extract publication ID and page number
 * Supports multiple formats: pid, publicationId, publishing_id
 * @param {string} url - URL string
 * @returns {Object|null} Parsed URL data or null
 */
export const parseDocumentLink = (url) => {
  try {
    if (!url || typeof url !== 'string') return null;

    // Handle both global URLs and local URLs (including hash-based URLs like #?pid=123)
    // Extract query string from URL - works with both ? and #? formats
    let queryString = '';
    if (url.includes('?')) {
      // Get the query string part after the last ? (handles both ?pid=123 and #?pid=123)
      const parts = url.split('?');
      queryString = parts[parts.length - 1];
      // Remove hash if present at the start (for #?pid=123 format)
      if (queryString.startsWith('#')) {
        queryString = queryString.substring(1);
      }
    }

    // If no query string found but URL contains =, try parsing the whole URL
    if (!queryString && url.includes('=')) {
      queryString = url.replace(/^[^=]*#/, ''); // Remove hash prefix if present
    }

    if (!queryString) return null;

    const urlParams = new URLSearchParams(queryString);
    const publicationId = urlParams.get('pid') ||
      urlParams.get('publicationId') ||
      urlParams.get('publishing_id');
    const page = urlParams.get('pageNumber') || urlParams.get('page');
    const linkType = urlParams.get('type');

    if (publicationId) {
      return {
        publicationId,
        page: page ? parseInt(page, 10) : null,
        linkType: linkType || 'page',
        url
      };
    }

    return null;
  } catch (error) {
    log.error('[HyperlinkHandlers] Error parsing document link', error);
    return null;
  }
};

/**
 * Handle hyperlink click
 * Sends HYPERLINK_CLICK message to parent or opens external link
 * @param {string} href - Hyperlink URL
 * @param {string} source - Source of the click (e.g., 'hyperlink', 'markup')
 */
export const handleHyperlinkClick = (href, source = 'hyperlink') => {
  try {
    const linkData = parseDocumentLink(href);

    if (linkData) {
      // This is a document link - send to parent for handling
      window.parent.postMessage({
        type: 'HYPERLINK_CLICK',
        url: href,
        page: linkData.page,
        publicationId: linkData.publicationId,
        linkType: linkData.linkType,
        source: source
      }, getParentTargetOriginForPostMessage());
    } else {
      // This is an external link - open in new window
      // Validate protocol to prevent javascript: / data: URI injection
      try {
        const url = new URL(href, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          log.warn('[HyperlinkHandlers] Blocked opening URL with unsafe protocol', { protocol: url.protocol, href });
        }
      } catch (urlError) {
        log.warn('[HyperlinkHandlers] Invalid URL, not opening', { href, error: urlError });
      }
    }
  } catch (error) {
    logError('HyperlinkHandlers', 'handleHyperlinkClick', error, { href, source });
  }
};

/**
 * Setup hyperlink click detection via DOM event listeners
 * @param {Object} api - Brava viewer API instance
 */
export const setupHyperlinkClickDetection = () => {
  const handleDocumentClickUnsafe = (e) => {
    // Intercept native document hyperlinks rendered as anchors:
    // If link contains publicationId + page, route to split-view (parent) and prevent new tab.
    const anyAnchor = e.target.closest && e.target.closest('a[href]');
    if (anyAnchor) {
      const href = anyAnchor.getAttribute('href') || anyAnchor.href;
      const linkData = parseDocumentLink(href);
      if (linkData && linkData.publicationId && linkData.page !== null && linkData.page !== undefined) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        window.parent.postMessage({
          type: 'HYPERLINK_CLICK',
          url: href,
          page: linkData.page,
          publicationId: linkData.publicationId,
          linkType: linkData.linkType || 'page',
          source: 'anchor'
        }, getParentTargetOriginForPostMessage());

        return false;
      }
    }

    // Check for hyperlink with our target class (markup comment pane hyperlinks)
    const hyperlinkElement = e.target.closest('a.ot-iv-MarkupCommentPane-hyperlink');
    if (hyperlinkElement) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const href = hyperlinkElement.href;

      handleHyperlinkClick(href, 'hyperlink');
      return false;
    }
  };

  // Wrap handler with error handling to prevent errors from breaking hyperlink functionality
  const handleDocumentClick = wrapHandler(handleDocumentClickUnsafe, 'HyperlinkHandlers', 'handleDocumentClick');

  // Use capture phase to catch before other handlers
  document.addEventListener('click', handleDocumentClick, true);
  window.addEventListener('click', handleDocumentClick, true);

  // MutationObserver for dynamically created hyperlinks
  const mutationCallback = wrapMutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node is a hyperlink with our target class
          if (node.classList && node.classList.contains('ot-iv-MarkupCommentPane-hyperlink')) {
            const clickHandler = wrapHandler((e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              const href = node.href;
              handleHyperlinkClick(href, 'hyperlink');
              return false;
            }, 'HyperlinkHandlers', 'dynamicHyperlinkClick');

            node.addEventListener('click', clickHandler, true);
          }

          // Also check for hyperlinks within the added node
          const hyperlinks = node.querySelectorAll && node.querySelectorAll('a.ot-iv-MarkupCommentPane-hyperlink');
          if (hyperlinks) {
            hyperlinks.forEach((link) => {
              const clickHandler = wrapHandler((e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const href = link.href;
                handleHyperlinkClick(href, 'hyperlink');
                return false;
              }, 'HyperlinkHandlers', 'dynamicNestedHyperlinkClick');

              link.addEventListener('click', clickHandler, true);
            });
          }
        }
      });
    });
  }, 'HyperlinkHandlers');

  const observer = new MutationObserver(mutationCallback);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Return cleanup function
  return () => {
    document.removeEventListener('click', handleDocumentClick, true);
    window.removeEventListener('click', handleDocumentClick, true);
    observer.disconnect();
  };
};

/**
 * Handle pageRender event for deep linking navigation
 * @param {Object} viewerLink - Viewer link object from URL search string
 * @param {Object} api - Brava viewer API instance
 */
export const handlePageRenderForDeepLink = (viewerLink, api) => {
  if (!viewerLink || !api) return;

  if (
    viewerLink.type &&
    (viewerLink.type === 'rectangle' || viewerLink.type === 'page')
  ) {
    try {
      if (typeof api.setCurrentLocation === 'function') {
        api.setCurrentLocation(viewerLink);
      }
    } catch (error) {
      log.error('[NavigationHandlers] Error handling pageRender for deep link', error);
    }
  }
};

/**
 * Setup deep linking navigation
 * Listens for pageRender event and applies deep link
 *
 * Uses ViewerEventBus PAGE_RENDER subscription for event-driven navigation.
 *
 * @param {Object} viewerLinkRef - Ref object containing viewer link from URL search string
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 * @param {string} [instanceId] - Optional instance ID for dual-viewer support
 */
export const setupDeepLinkingNavigation = (viewerLinkRef, viewerName, api, instanceId) => {
  if (!viewerLinkRef || !viewerLinkRef.current || !viewerName || !api) return null;

  let handled = false;
  let unsubscribe = null;

  const handlePageRender = () => {
    if (handled || !viewerLinkRef.current) return;
    handled = true;

    handlePageRenderForDeepLink(viewerLinkRef.current, api);
    // Clear the link after navigation to prevent repeated navigation
    viewerLinkRef.current = null;

    // Cleanup subscription
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  // Event-driven approach using ViewerEventBus
  const effectiveInstanceId = instanceId || viewerName || "default";

  unsubscribe = viewerEventBus.subscribe(
    VIEWER_EVENTS.PAGE_RENDER,
    effectiveInstanceId,
    handlePageRender
  );

  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
};

/**
 * Register a hyperlink resolver with the viewer API to centrally intercept hyperlink clicks.
 * If URL has publication_id/pid and page number, opens in split view (like markup hyperlinks).
 * Otherwise, allows default new-tab behavior.
 *
 * @param {Object} api - Brava viewer API instance
 * @param {string} [instanceId="default"] - Viewer instance id
 * @returns {Function|null} Cleanup (no-op; resolver does not support unregistration)
 */
export const setupViewerHyperlinkResolver = (api, instanceId = "default") => {
  if (!api || typeof api.setHyperlinkResolver !== "function") {
    return null;
  }

  try {
    api.setHyperlinkResolver((url) => {
      try {
        // Parse URL to check if it's a document link (has publication ID)
        const linkData = parseDocumentLink(url);

        if (linkData && linkData.publicationId && linkData.page !== null && linkData.page !== undefined) {
          // This is a document link - send to parent to open in split view
          window.parent.postMessage({
            type: 'HYPERLINK_CLICK',
            url: url,
            page: linkData.page,
            publicationId: linkData.publicationId,
            linkType: linkData.linkType,
            source: 'resolver'
          }, getParentTargetOriginForPostMessage());

          // Return rejected promise to prevent viewer's default new-tab behavior
          // Some viewers interpret null/resolved promise as "allow default", so reject to be explicit
          return Promise.reject(new Error("Document hyperlink handled via postMessage - preventing default navigation"));
        } else {
          // External link - allow default new-tab behavior
          window.parent.postMessage(
            { type: "EXTERNAL_LINK_OPEN", url, source: "resolver", instanceId },
            getParentTargetOriginForPostMessage()
          );

          // Return URL to allow viewer's default behavior (open new tab)
          return Promise.resolve(url);
        }
      } catch (err) {
        log.error("[DOC HYPERLINK] Error in resolver", err, { url });
        // On error, allow default behavior
        return Promise.resolve(url);
      }
    });
  } catch (e) {
    log.error("[DOC HYPERLINK] Error setting up resolver", e);
  }

  return () => { };
};

