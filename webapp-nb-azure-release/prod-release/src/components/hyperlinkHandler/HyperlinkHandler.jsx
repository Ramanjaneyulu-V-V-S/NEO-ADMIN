import React, { useEffect, useCallback } from "react";
import "./HyperlinkHandler.css";

const HyperlinkHandler = ({ handleSplitView, onPublicationIdSelect, setIvTitleName, onHyperlinkPage }) => {
  // Parse hyperlink to extract publishing ID and page number (supports both old and new formats)
  const parseHyperlink = useCallback((url) => {
    try {
      const urlObj = new URL(url);

      // Support new deep linking format: ?type=page&pid=...&pageNumber=...
      const linkType = urlObj.searchParams.get("type");
      const pid = urlObj.searchParams.get("pid");
      const pageNumber = urlObj.searchParams.get("pageNumber");

      // Support old format: ?publishing_id=...&page=... or ?publicationId=...&page=...
      const publishingId = urlObj.searchParams.get("publishing_id") || urlObj.searchParams.get("publicationId") || pid;
      const page = urlObj.searchParams.get("page") || pageNumber;

      return {
        publishingId,
        page: page ? parseInt(page, 10) : 1, // Default to page 1 if no page specified
        isDocumentLink: !!publishingId,
        linkType: linkType || "page", // Default to 'page' type
        originalUrl: url,
      };
    } catch {
      return {
        publishingId: null,
        page: 1,
        isDocumentLink: false,
        linkType: "page",
        originalUrl: url,
      };
    }
  }, []);

  // Handle opening document in split view (right container)
  // Note: No URL parameter updates - navigation handled via internal state
  const handleDocumentLink = useCallback(
    (parsedLink) => {
      if (handleSplitView && onPublicationIdSelect) {
        // Extract document title
        const title = parsedLink.originalUrl.includes("title=") ? decodeURIComponent(new URL(parsedLink.originalUrl).searchParams.get("title") || "Document") : "Document";

        // Store page number in parent component state (for RIGHT pane to access)
        if (onHyperlinkPage && parsedLink.page) {
          onHyperlinkPage(parsedLink.page);
        }

        // Set publishing ID and open split view
        onPublicationIdSelect(parsedLink.publishingId);
        handleSplitView(parsedLink.publishingId);

        // Set document title
        if (setIvTitleName) {
          setIvTitleName(title);
        }

        // Send a message to notify SplitViewer about hyperlink navigation with page info
        // This ensures page information is preserved when opening from DOM hyperlinks
        if (parsedLink.publishingId && parsedLink.page) {
          const navMessage = {
            type: "NAVIGATE_TO_PAGE",
            page: parsedLink.page,
            publicationId: parsedLink.publishingId,
            source: "hyperlink",
            targetPane: "right", // Always target right pane for split view
          };

          const targetOrigin = typeof window !== "undefined" && window.location ? window.location.origin : "";
          window.postMessage(navMessage, targetOrigin);
        }

        // No URL parameter updates - using internal state only
      }
    },
    [handleSplitView, onPublicationIdSelect, setIvTitleName, onHyperlinkPage],
  );

  // Handle opening external link in new window
  const handleExternalLink = useCallback((url) => {
    try {
      // Validate URL before opening
      const parsedUrl = new URL(url); // This will throw if URL is invalid

      // Block dangerous protocols
      if (parsedUrl.protocol === "javascript:" || parsedUrl.protocol === "vbscript:" || parsedUrl.protocol === "data:") {
        return;
      }

      // Open in new window/tab
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      if (!newWindow) {
        // Fallback: copy link to clipboard and notify user
        navigator.clipboard.writeText(url).catch(() => {});
        console.warn("Popup blocked. Link copied to clipboard:", url);
      }
    } catch {
      // Invalid URL - silently ignore
    }
  }, []);

  // Main hyperlink click handler - only handle markup hyperlinks
  const handleHyperlinkClick = useCallback(
    (event) => {
      const linkElement = event.target.closest("a[href]");
      if (!linkElement) return;

      const className = linkElement.getAttribute("class") || "";
      const isMarkupHyperlink = className.includes("ot-iv-MarkupCommentPane-hyperlink");

      if (isMarkupHyperlink) {
        event.preventDefault();
        event.stopPropagation();

        const parsedLink = parseHyperlink(linkElement.href);

        if (parsedLink.isDocumentLink) {
          handleDocumentLink(parsedLink);
        } else {
          handleExternalLink(linkElement.href);
        }
      }
    },
    [parseHyperlink, handleDocumentLink, handleExternalLink],
  );

  // Handle messages from iframe
  const handleIframeMessage = useCallback(
    (event) => {
      // Validate message origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "HYPERLINK_CLICK") {
        const { url, page, publicationId } = event.data;

        if (publicationId) {
          // Document link - open in split view
          const parsedLink = parseHyperlink(url);

          handleDocumentLink({
            ...parsedLink,
            publishingId: publicationId,
            page: page || parsedLink.page || 1,
            isDocumentLink: true,
          });
        } else {
          // External link - open in new window
          handleExternalLink(url);
        }
      }
    },
    [handleDocumentLink, handleExternalLink, parseHyperlink],
  );

  // Set up event listeners
  useEffect(() => {
    document.addEventListener("click", handleHyperlinkClick, true);
    window.addEventListener("message", handleIframeMessage);

    return () => {
      document.removeEventListener("click", handleHyperlinkClick, true);
      window.removeEventListener("message", handleIframeMessage);
    };
  }, [handleHyperlinkClick, handleIframeMessage]);

  // This component doesn't render anything - it's just for event handling
  return null;
};

export default HyperlinkHandler;
