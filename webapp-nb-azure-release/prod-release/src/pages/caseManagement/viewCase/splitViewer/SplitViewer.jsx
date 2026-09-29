import React, { useEffect, useRef, useState, useCallback } from "react";

// Inline SVG icons
const MdPictureAsPdf = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
  </svg>
);
const FaCloudUploadAlt = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
  </svg>
);
const IoMdClose = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M405 136.798L375.202 107 256 226.202 136.798 107 107 136.798 226.202 256 107 375.202 136.798 405 256 285.798 375.202 405 405 375.202 285.798 256z" />
  </svg>
);
const IoMdCloudDownload = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M409.6 230.4c-2.5-42.6-37.8-76.4-80.9-76.4-7.1 0-14 .9-20.6 2.7C289.3 130.8 259.9 112 226.3 112c-50 0-90.7 40.6-90.7 90.7v4.4C98 219.8 64 261.7 64 312c0 57.3 46.7 104 104 104h232c48.6 0 88-39.4 88-88 0-43.2-31.2-79.2-72.4-86.6l-6-11zM296 336v72h-80v-72h-64l104-120 104 120h-64z" />
  </svg>
);
const TbReload = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.93 13a8 8 0 1 1-1.19-4.38" />
    <polyline points="20 4 20 9 15 9" />
  </svg>
);
const TbLayoutSidebarRightCollapseFilled = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-12a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12zm-3 2h-9a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9V5zm-3.293 4.293a1 1 0 0 1 .083 1.32l-.083.094L10.414 12l1.293 1.293a1 1 0 0 1 .083 1.32l-.083.094a1 1 0 0 1-1.32.083l-.094-.083-2-2a1 1 0 0 1-.083-1.32l.083-.094 2-2a1 1 0 0 1 1.414 0z" />
  </svg>
);
const TbLayoutSidebarLeftCollapseFilled = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-12a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12zm-3 2h-9a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9V5zm-4.387 4.21l.094.083 2 2a1 1 0 0 1 .083 1.32l-.083.094-2 2a1 1 0 0 1-1.497-1.32l.083-.094L10.586 12 9.293 10.707a1 1 0 0 1-.083-1.32l.083-.094a1 1 0 0 1 1.32-.083z" />
  </svg>
);

// Styles
import "./SplitViewer.css";

// Integrated viewer (IV)
import IntegratedBravaViewer from "../../../../components/iv/IntegratedBravaViewer.jsx";
import ReadOnlyBravaViewer from "../../../../components/iv/ReadOnlyBravaViewer.jsx";
import bravaconfig from "../../../../components/iv/bravaconfig";
import { ivTokenManager } from "../../../../services/iv/tokenManager";

// Redux and services
import { useSelector } from "react-redux";
import { documentService } from "../../../../services/caseManagement/documents/documentsService.js";

// Hooks
import { usePublishIv } from "../../../../hooks/usePublishIv";

// UI and PDF download
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert.jsx";
import { validateFileSignature } from "../../../../utils/validateFileSignature";
import CustomTooltip from "../../../../components/customTooltip/CustomTooltip.jsx";
import { handlePdfDownload, handlePdfDownloadFailure } from "../../../../components/iv/utils/pdfDownloadHandler";
import { getSrcdocIframeTargetOrigin } from "../../../../components/iv/utils/postMessageTargets";

// Expose showSweetAlert globally for pdfDownloadHandler (iframe context)
if (typeof globalThis !== "undefined") {
  globalThis.showSweetAlert = showSweetAlert;
}
import { createCaseService } from "../../../../services/caseManagement/createCase/createCaseService";
import { sentCaseService } from "../../../../services/caseManagement/sentCases/sentCaseService";
import { log } from "../../../../iframe/utils/logger";

/**
 * Debounce helper with cancel for cleanup (e.g. navigation).
 * @param {function} func - Function to debounce
 * @param {number} wait - Delay in ms
 * @returns {function} Debounced function with .cancel()
 */

const debounce = (func, wait) => {
  let timeout;
  const executedFunction = function (...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  executedFunction.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return executedFunction;
};

const SplitViewer = ({
  title,
  caseId,
  ivTitle,
  folderId,
  splitView,
  screenName,
  caseStatus,
  isAcquired,
  collapseLeft,
  notesheetId,
  collapseRight,
  publicationId,
  hyperlinkPage = null, // Page number from hyperlink (passed from parent)
  handleSplitView,
  notesheetUpdate,
  previousPerformer,
  isSameWorkflowUser,
  notesheetObjectName,
  handleNotesheetCollapse,
  handleSplitViewCollapse,
  onPublicationIdUpdate, // New prop to handle publication ID updates from viewer
  onPublicationFailed, // Optional: parent handler invoked when viewer reports terminal publication failure
  paneId = null, // "left" or "right" - identifies which pane this viewer is in
  isOldCase, // from ViewCases: true when path includes "view-old-case" — used for Legacy vs Case folder path
  isRequestingIvId = false, // Loading state for IV ID request
  isFetchingNotesheet = false, // Loading state for initial notesheet fetch
}) => {
  // Refs and hooks
  const fileReuploadRef = useRef(null);
  const { publish: publishIv } = usePublishIv();
  const { userProfile } = useSelector((state) => state?.login);
  const { office_type } = userProfile?.properties || {};

  // Local state
  const [isUploading, setIsUploading] = useState(false);
  const [publishingId, setPublishingId] = useState(publicationId);
  const [notesheetIds, setNotesheetIds] = useState(notesheetId);
  const [isExporting, setIsExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isViewerLoading, setIsViewerLoading] = useState(true);
  const [previousAcquiredStatus, setPreviousAcquiredStatus] = useState(isAcquired);

  // Internal state for hyperlink navigation (instead of URL parameters)
  const hyperlinkPageRef = useRef(null); // Track target page when opening from hyperlink
  const isHyperlinkNavigationRef = useRef(false); // Track if publication change is from hyperlink (internal) vs prop (external)
  const [documentNotFound, setDocumentNotFound] = useState(false);

  const folderPath = isOldCase ? `/CMS Legacy/${caseId}` : `/Case/${caseId}`;

  // Refs to always hold latest values (prevents stale closures in async handlers)
  const publishingIdRef = useRef(publishingId);
  const notesheetIdsRef = useRef(notesheetIds);

  useEffect(() => {
    publishingIdRef.current = publishingId;
  }, [publishingId]);

  useEffect(() => {
    notesheetIdsRef.current = notesheetIds;
  }, [notesheetIds]);

  // Use hyperlinkPage prop if provided (from parent component state)
  // This is a fallback if the postMessage doesn't arrive in time
  useEffect(() => {
    if (hyperlinkPage && hyperlinkPage > 0 && paneId === "right") {
      // Only set if ref is not already set (message-based ref takes priority)
      if (!hyperlinkPageRef.current) {
        hyperlinkPageRef.current = hyperlinkPage;
      }
    }
  }, [hyperlinkPage, paneId]);

  // FIX: Reset viewer loading state when notesheet fetch completes without a publication
  // This prevents buttons from sticking in loading state when "No Notesheet" message is shown
  useEffect(() => {
    if (!isFetchingNotesheet && !publishingId) {
      setIsViewerLoading(false);
    }
  }, [isFetchingNotesheet, publishingId]);

  // FIX: Force viewer loading state when publication ID changes (Masking Approach)
  // This ensures the "Loading Document..." overlay appears immediately,
  // hiding the internal viewer's initialization steps ("React bundle", "Preparing...", etc.)
  useEffect(() => {
    // Skip if publication was updated internally (re-upload/refresh) or via hyperlink
    // These flows manage their own loading state and publication ID
    if (isInternalUpdateRef.current || isHyperlinkNavigationRef.current) {
      return;
    }
    if (publicationId !== publishingId) {
      setIsViewerLoading(true);
      setPublishingId(publicationId);
    }
  }, [publicationId, publishingId]);

  // Refs for lifecycle and cleanup
  const isMountedRef = useRef(true);
  const exportTimeoutRef = useRef(null);
  const isInternalUpdateRef = useRef(false); // Track if publicationId was updated internally (re-upload)
  const oldPublicationIdRef = useRef(null); // Old publication ID to delete after viewer loads new one

  // --- Viewer commands and callbacks ---
  // Send postMessage command to this pane's iframe (by instanceId).
  const sendViewerCommand = useCallback(
    (command) => {
      // Find iframe by instanceId to target the correct pane
      const expectedInstanceId = `${paneId}-viewer`;
      const iframe = document.querySelector(`iframe[title="Brava Viewer ${expectedInstanceId}"]`);

      if (!iframe?.contentWindow) {
        return false;
      }

      iframe.contentWindow.postMessage(command, getSrcdocIframeTargetOrigin());
      return true;
    },
    [paneId],
  );

  /** Called when the viewer reports a new publication ID (e.g. after re-upload). */
  const handlePublicationIdUpdateFromViewer = useCallback(
    (newPublicationId) => {
      setPublishingId(newPublicationId);

      // Notify parent component if callback provided
      if (onPublicationIdUpdate) {
        onPublicationIdUpdate(newPublicationId);
      }

      // Force viewer refresh with new publication ID
      // Viewer will send viewerLoading event when it starts loading
      setRefreshKey((prev) => prev + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publishingId, onPublicationIdUpdate],
  );

  // --- Handlers: file upload, download, refresh, export ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = [".doc", ".docx"];

    // Get file extension in lowercase
    const fileExtension = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

    // Validate file extension
    if (!allowedExtensions.includes(fileExtension)) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Format",
        text: `Only the following formats are allowed: ${allowedExtensions.join(", ")}`,
      });
      e.target.value = ""; // Reset file input
      return;
    }

    // Validate file content matches its extension (detect renamed files)
    const signatureResult = await validateFileSignature(file);
    if (!signatureResult.valid) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Content",
        text: signatureResult.message,
      });
      e.target.value = "";
      return;
    }

    await handleReUploadNotesheet(file);
  };

  /** Replace notesheet: delete old doc, upload new file, publish to IV, then refresh viewer. */
  const handleReUploadNotesheet = async (file) => {
    // Prevent multiple concurrent uploads
    if (isUploading) {
      return;
    }

    setIsUploading(true);

    try {
      // Delete old document first (read from ref for latest value)
      const currentNotesheetId = notesheetIdsRef.current;
      const payload = {
        "run-stateless": "true",
        data: {
          variables: {
            inp_object_type: "cms_supporting_document",
            inp_object_id: currentNotesheetId,
            is_notesheet_delete: true,
          },
        },
      };

      if (currentNotesheetId) {
        await documentService.deleteDocument(payload);
      }

      // Check if component is still mounted
      if (!isMountedRef.current) {
        setIsUploading(false);
        return;
      }

      // Upload new file
      const uploadRes = await documentService.getFilePath(file);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;

      if (!fileSrc) throw new Error("File upload failed");

      const uploadPayload = {
        properties: {
          a_content_type: "msw12",
          r_object_type: "cms_note_document",
          object_name: file.name,
          case_number: caseId,
          folder_id: folderId,
        },
        type: "cms_note_document",
        source: fileSrc,
      };

      const docRes = await createCaseService.uploadDocument(uploadPayload);
      if (!isMountedRef.current) {
        setIsUploading(false);
        return;
      }

      if (docRes?.properties?.object_name) {
        const r_object_id = docRes?.properties?.r_object_id;

        try {
          const newPublicationId = await publishIv(r_object_id);
          if (!isMountedRef.current) {
            setIsUploading(false);
            return;
          }

          isInternalUpdateRef.current = true;

          const currentPublishingId = publishingIdRef.current;
          if (currentPublishingId && currentPublishingId !== newPublicationId) {
            oldPublicationIdRef.current = currentPublishingId;
          }

          setPublishingId(newPublicationId);
          setNotesheetIds(r_object_id);
          onPublicationIdUpdate?.(newPublicationId);
          setRefreshKey((prev) => prev + 1);
        } catch (publishError) {
          log.error("[SplitViewer] Error publishing notesheet", publishError);
          if (!isMountedRef.current) {
            setIsUploading(false);
            return;
          }

          try {
            const fallbackResponse = await sentCaseService.getNotesheetId({ input_folder_path: folderPath });
            if (!isMountedRef.current) {
              setIsUploading(false);
              return;
            }

            const fallbackPubId = fallbackResponse?.entries?.[0]?.content?.properties?.publishing_id;
            const fallbackNoteId = fallbackResponse?.entries?.[0]?.content?.properties?.id;

            if (fallbackPubId) {
              isInternalUpdateRef.current = true;
              setPublishingId(fallbackPubId);
              if (fallbackNoteId) setNotesheetIds(fallbackNoteId);
              onPublicationIdUpdate?.(fallbackPubId);
              setRefreshKey((prev) => prev + 1);
            }
          } catch (fallbackError) {
            log.error("[SplitViewer] Fallback notesheet ID fetch failed", fallbackError);
          }
        }
      }

      setIsUploading(false);
    } catch (error) {
      if (isMountedRef.current) {
        setIsUploading(false);
        showSweetAlert({ title: "Error", text: error.message, icon: "error" });
      }
    }
  };

  const handleDownloadNotesheet = async () => {
    try {
      const blob = await documentService.downloadDocument(notesheetIds);
      const url = globalThis.URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${notesheetObjectName}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
    } catch (error) {
      log.error("[SplitViewer] Error downloading notesheet", error);
      showSweetAlert({ title: "Error", text: "Download failed, please check the document id", icon: "error" });
    }
  };

  const handleRefreshNotesheet = async () => {
    try {
      const response = await sentCaseService.getNotesheetId({
        input_folder_path: folderPath,
      });

      // Check if component is still mounted before state updates
      if (!isMountedRef.current) {
        setIsViewerLoading(false);
        return;
      }

      const latestPublishingId = response?.entries?.[0]?.content?.properties?.publishing_id;
      const latestNotesheetId = response?.entries?.[0]?.content?.properties?.id;

      // Mark as internal update to prevent useEffect from overwriting
      isInternalUpdateRef.current = true;

      // Update state with latest values from API
      if (latestPublishingId) {
        setPublishingId(latestPublishingId);
      }
      if (latestNotesheetId) {
        setNotesheetIds(latestNotesheetId);
      }

      // Trigger refresh - viewer will now use the updated publication ID from state
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      log.error("[SplitViewer] Error refreshing notesheet", error);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handlePdfExport = useCallback(() => {
    if (isExporting || isViewerLoading) return;

    setIsExporting(true);
    const commandSent = sendViewerCommand({ type: "TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK" });
    if (!commandSent) setIsExporting(false);
    // setIsExporting(false) is handled by PDF_EXPORT_DOWNLOAD_SUCCESS/FAILURE events
  }, [isExporting, isViewerLoading, sendViewerCommand]);

  // When acquisition status changes, remount viewer (editable vs readonly).
  useEffect(() => {
    if (previousAcquiredStatus !== isAcquired) {
      // Determine what viewer should be shown now
      const wasEditable = previousAcquiredStatus !== 0;
      const isNowEditable = isAcquired !== 0;
      const viewerChanged = wasEditable !== isNowEditable;

      if (viewerChanged) {
        // Viewer will send viewerLoading event when it starts loading
        setRefreshKey((prev) => prev + 1);
      }

      setPreviousAcquiredStatus(isAcquired);
    }
  }, [isAcquired, caseStatus, isSameWorkflowUser, screenName, previousAcquiredStatus]);

  useEffect(() => {
    if (notesheetUpdate) {
      // Viewer will send viewerLoading event when it starts loading
      setRefreshKey((prev) => prev + 1);
    }
  }, [notesheetUpdate]);

  // Sync publicationId/notesheetId from parent props; skip when update came from re-upload or hyperlink.
  useEffect(() => {
    // CRITICAL FIX: Skip if publication change came from hyperlink navigation
    // Hyperlink navigation is handled by handleOpenViewerFromHyperlink which already sets loading state
    if (isHyperlinkNavigationRef.current) {
      isHyperlinkNavigationRef.current = false; // Reset flag
      return;
    }

    // CRITICAL: Skip if this is an internal update (re-upload or manual refresh)
    // Internal updates set the flag, so we don't overwrite them with old prop values
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false; // Reset flag
      return;
    }

    // Only update state and trigger refresh if prop changed from parent (external update)
    // This allows parent to update publicationId, but won't overwrite internal updates (re-upload)
    if (publicationId && publicationId !== publishingId) {
      // Update state only when prop actually changed from parent
      setPublishingId(publicationId);
      setNotesheetIds(notesheetId);
      // Viewer will send viewerLoading event when it starts loading
      setRefreshKey((prev) => prev + 1);
    }
  }, [publicationId, notesheetId, publishingId, paneId]);

  // documentNotFound is now driven by the viewer's onNotFound / onFailed callbacks
  // (see viewerProps below). Reset whenever publishingId changes so a new publication
  // starts from a clean slate.
  useEffect(() => {
    setDocumentNotFound(false);
  }, [publishingId]);

  // Viewer lifecycle (viewerLoading, viewerInitialized, viewerError) and PDF export events.
  useEffect(() => {
    const handleIframeMessage = (event) => {
      // Filter messages by instanceId to prevent cross-pane interference
      const expectedInstanceId = `${paneId}-viewer`;
      const messageInstanceId = event.data?.instanceId;

      // FIX: Stricter message filtering to prevent cross-pane interference
      // For viewer lifecycle events (viewerInitialized, viewerLoading, viewerError),
      // only accept messages that explicitly match this pane's instanceId
      const isLifecycleEvent = ["viewerInitialized", "viewerLoading", "viewerError", "viewerRetry"].includes(event.data?.type);

      if (isLifecycleEvent) {
        // For lifecycle events, require exact instanceId match
        // This prevents right pane's loading state from affecting left pane's refresh icon
        if (messageInstanceId !== expectedInstanceId) {
          return; // Ignore lifecycle messages from other pane
        }
      } else {
        // For other messages (PDF export, etc.), use looser matching for backwards compatibility
        const isInitialState = !messageInstanceId || messageInstanceId === "default";
        const isMatchingInstance = messageInstanceId === expectedInstanceId;

        if (!isInitialState && !isMatchingInstance) {
          return; // Ignore messages from other pane (but allow initial state messages)
        }
      }

      // PHASE 1: Event-driven viewer lifecycle - ONLY these events control isViewerLoading
      // No timeouts, no guessing - spinner stays until viewer explicitly signals state
      if (event.data?.type === "viewerInitialized") {
        // Viewer is fully ready - stop spinner
        setIsViewerLoading(false);

        setDocumentNotFound(false); // Clear error if viewer initializes successfully

        // Delete old publication after viewer successfully loaded the new one
        if (oldPublicationIdRef.current) {
          const oldPubId = oldPublicationIdRef.current;
          oldPublicationIdRef.current = null;
          // Fire-and-forget: don't block viewer on old publication cleanup
          (async () => {
            try {
              const token = await ivTokenManager.getToken();
              await fetch(`${bravaconfig.publicationAuthority}/publication/api/v1/publications/${oldPubId}?embed=page_links`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch (err) {
              log.warn("[SplitViewer] Failed to delete old publication", oldPubId, err);
            }
          })();
        }

        // Clear hyperlink page ref after viewer has initialized (page should be set via initialPage prop)
        if (hyperlinkPageRef.current) {
          hyperlinkPageRef.current = null;
        }
      } else if (event.data?.type === "viewerLoading") {
        // Viewer is loading - show spinner
        setIsViewerLoading(true);
      } else if (event.data?.type === "viewerError") {
        // Viewer encountered error - stop spinner, enable refresh button
        setIsViewerLoading(false);
        // Check if error message indicates document not found
        if (event.data?.error?.includes("Document not found") || event.data?.error?.includes("404")) {
          setDocumentNotFound(true);
        }
      } else if (event.data?.type === "viewerRetry") {
        // Viewer is retrying - trigger refresh
        handleRefreshNotesheet(); // Handle retry from viewer
        setDocumentNotFound(false); // Clear error on retry
      } else if (event.data?.type === "PDF_EXPORT_DOWNLOAD_SUCCESS") {
        // Use centralized PDF download handler
        setIsExporting(false);
        handlePdfDownload(event.data, {
          showSuccessAlert: true,
          showErrorAlert: true,
        });
      } else if (event.data?.type === "PDF_EXPORT_DOWNLOAD_FAILURE") {
        // Use centralized PDF download failure handler
        setIsExporting(false);
        handlePdfDownloadFailure(event.data, {
          showErrorAlert: true,
        });
      }
    };

    globalThis.addEventListener("message", handleIframeMessage);

    return () => {
      globalThis.removeEventListener("message", handleIframeMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId]);

  const navigateToPageInViewerRef = useRef(null);
  const navigateToPageInViewer = useCallback(
    (pageNumber) => {
      if (!isMountedRef.current) return;

      // Cancel any pending debounced call
      if (navigateToPageInViewerRef.current?.cancel) {
        navigateToPageInViewerRef.current.cancel();
      }

      // Create debounced function if not exists or paneId changed
      if (!navigateToPageInViewerRef.current) {
        navigateToPageInViewerRef.current = debounce((page) => {
          if (!isMountedRef.current) return;

          // CRITICAL FIX: Use instanceId to target the correct iframe
          // This prevents cross-pane navigation when hyperlinks are clicked
          const expectedInstanceId = `${paneId}-viewer`;

          // Find iframe by instanceId in title (format: "Brava Viewer {instanceId}")
          // This ensures we only target the iframe for this specific pane
          const iframe = document.querySelector(`iframe[title="Brava Viewer ${expectedInstanceId}"]`);

          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: "NAVIGATE_TO_PAGE",
                page: page,
                instanceId: expectedInstanceId, // Include instanceId so iframe can filter
              },
              getSrcdocIframeTargetOrigin(),
            );
          }
        }, 300);
      }

      navigateToPageInViewerRef.current(pageNumber);
    },
    [paneId],
  );

  // Fallback: navigate to hyperlink page after viewer mounts (if initialPage didn’t apply).
  useEffect(() => {
    if (paneId !== "right") {
      return;
    }

    // If we have a target page from hyperlink, use it as fallback navigation
    // Note: The page prop should handle initial navigation, but this ensures it works
    if (hyperlinkPageRef.current && publishingId) {
      const targetPage = hyperlinkPageRef.current;

      // Clear the ref after a delay to allow the viewer to use it for initialPage prop
      // The viewer should navigate using initialPage, but we keep this as fallback
      setTimeout(() => {
        // Only navigate if ref still has value (wasn't used by initialPage prop)
        // This prevents redundant navigation
        if (hyperlinkPageRef.current === targetPage) {
          navigateToPageInViewer(targetPage);
        }
        // Clear ref after navigation attempt
        hyperlinkPageRef.current = null;
      }, 2000); // Longer delay to ensure initialPage has been processed
    }
  }, [publishingId, paneId, splitView, navigateToPageInViewer]);

  /** Open another publication from hyperlink; set page ref and refresh viewer (right pane only). */
  const handleOpenViewerFromHyperlink = useCallback(
    ({ publicationId, page }) => {
      // Only process hyperlink navigation for right pane
      if (paneId !== "right" && !splitView) {
        return; // Left viewer should not process hyperlink navigation
      }

      if (publicationId) {
        // CRITICAL: Store target page in ref BEFORE updating publication ID
        // This ensures the page is available when the viewer remounts
        // The ref must be set synchronously before state updates
        if (page && page > 0) {
          hyperlinkPageRef.current = page;
        } else {
          hyperlinkPageRef.current = null; // Clear any previous target page
        }
        // CRITICAL: Mark this as hyperlink navigation to prevent useEffect from double-triggering
        // The useEffect at lines 325-345 watches publicationId prop changes
        // We're updating publishingId state here, which will make the prop !== state
        // The flag tells the useEffect to skip this change since we're handling it here
        isHyperlinkNavigationRef.current = true;

        // Update the current publication ID
        // This will trigger the useEffect that increments refreshKey, causing viewer to remount
        // The remount will use hyperlinkPageRef.current as the initialPage prop
        setPublishingId(publicationId);
        // Viewer will send viewerLoading event when it starts loading
        // Increment refreshKey to force viewer remount with new publication and page
        // This ensures the viewer component remounts and reads hyperlinkPageRef.current
        setRefreshKey((prev) => prev + 1);
      }
    },
    [paneId, splitView],
  );

  // Listen for NAVIGATE_TO_PAGE from parent/iframe; route by targetPane and source (hyperlink vs scroll).
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === "NAVIGATE_TO_PAGE") {
        const { page, publicationId, source, targetPane } = event.data;

        // Scope navigation ONLY to right viewer
        // Check 1: If targetPane is specified and doesn't match this pane, ignore
        // FIX: Allow RIGHT pane to receive messages even if splitView is undefined initially
        if (targetPane && targetPane !== paneId) {
          if (!(targetPane === "right" && paneId === "right")) {
            return; // This message is not for this viewer
          }
        }

        // Check 2: If this is a hyperlink and we're the left pane, ALWAYS ignore
        if (source === "hyperlink" && paneId === "left") {
          return; // Left viewer should not react to hyperlink navigation
        }

        if (source === "hyperlink") {
          // For hyperlink clicks that open a new document:
          // Check if this is a different publication first (before the general publicationId check)
          if (publicationId && publicationId !== publishingId) {
            // CRITICAL: Set ref BEFORE calling handleOpenViewerFromHyperlink
            // This ensures the ref is set synchronously before any state updates
            if (page && page > 0) {
              hyperlinkPageRef.current = page;
            }
            // Trigger publication change
            handleOpenViewerFromHyperlink({ publicationId, page, source: "hyperlink" });
            return;
          }

          // Same document hyperlink - just navigate to page in RIGHT pane only
          // CRITICAL FIX: Removed "|| splitView" to prevent left pane from navigating
          // When splitView is true, BOTH panes receive this message, but only right pane should navigate
          if (paneId === "right") {
            navigateToPageInViewer(page);
          }
        } else {
          // Non-hyperlink navigation (e.g., user scrolling) - allow for both panes
          // But only if publicationId matches (if provided)
          if (!publicationId || publicationId === publishingId) {
            navigateToPageInViewer(page);
          }
        }
      }
    };

    globalThis.addEventListener("message", handleMessage);
    return () => globalThis.removeEventListener("message", handleMessage);
  }, [paneId, splitView, navigateToPageInViewer, publishingId, handleOpenViewerFromHyperlink]);

  // Cleanup on unmount: refs and debounce cancel
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Clear all timeouts
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }

      // Cancel any pending debounced navigation calls
      if (navigateToPageInViewerRef.current?.cancel) {
        navigateToPageInViewerRef.current.cancel();
      }
    };
  }, []);

  return (
    <>
      {isUploading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="card-container position-relative rounded">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="case-info-label">{title}</h6>
          {title === "Notesheet Viewer" && (
            <div className="d-flex align-items-center">
              <div className={`note-btn-container me-2 ${isViewerLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <CustomTooltip tooltip={isViewerLoading ? "Viewer is loading..." : "Refresh"}>
                  <TbReload
                    style={{ width: 16, height: 16 }}
                    role="button"
                    tabIndex={isViewerLoading ? -1 : 0}
                    onClick={isViewerLoading ? undefined : handleRefreshNotesheet}
                    onKeyDown={(e) => {
                      if (!isViewerLoading && (e.key === "Enter" || e.key === " ")) {
                        handleRefreshNotesheet();
                      }
                    }}
                    className={isViewerLoading ? "refresh-icon-loading" : ""}
                  />
                </CustomTooltip>
              </div>

              <input type="file" ref={fileReuploadRef} accept={".doc,.docx"} className="display-none" onChange={(e) => handleFileUpload(e)} />

              {(() => {
                const dashCount = (caseId?.match(/-/g) || []).length;
                const maxDashes = office_type === "HO" ? 5 : 6;
                const canReupload = isSameWorkflowUser && dashCount <= maxDashes;

                const showUpload =
                  screenName === "inboxScreen"
                    ? caseStatus === "In-Progress" && canReupload && previousPerformer.length === 0 && isAcquired !== 0
                    : caseStatus === "Draft" && canReupload;

                return showUpload ? (
                  <div
                    className="note-btn-container me-2"
                    tabIndex={0}
                    onClick={() => fileReuploadRef.current.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileReuploadRef.current.click()}
                  >
                    <CustomTooltip tooltip="Replace Notesheet">
                      <FaCloudUploadAlt style={{ width: 16, height: 16 }} />
                    </CustomTooltip>
                  </div>
                ) : null;
              })()}

              {caseStatus !== "Closed" && (
                <div
                  onClick={handleDownloadNotesheet}
                  className="note-btn-container me-2"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleDownloadNotesheet();
                    }
                  }}
                >
                  <CustomTooltip tooltip="Download as Docx">
                    <IoMdCloudDownload style={{ width: 16, height: 16 }} />
                  </CustomTooltip>
                </div>
              )}

              <div
                className={`note-btn-container me-2 ${isExporting || isViewerLoading ? "disabled" : ""}`}
                tabIndex={isExporting || isViewerLoading ? -1 : 0}
                onClick={isExporting || isViewerLoading ? undefined : handlePdfExport}
                onKeyDown={(e) => {
                  if (!isExporting && !isViewerLoading && (e.key === "Enter" || e.key === " ")) {
                    handlePdfExport();
                  }
                }}
              >
                <CustomTooltip tooltip={isExporting ? "Exporting PDF..." : isViewerLoading ? "Viewer is loading..." : "Export to PDF"}>
                  <MdPictureAsPdf style={{ width: 16, height: 16 }} />
                </CustomTooltip>
              </div>

              <div
                className="note-btn-container"
                onClick={handleNotesheetCollapse}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleNotesheetCollapse();
                  }
                }}
              >
                <CustomTooltip tooltip={collapseLeft ? "Collapse" : "Expand"}>
                  {collapseLeft ? (
                    <TbLayoutSidebarRightCollapseFilled style={{ width: 18, height: 18 }} />
                  ) : (
                    <TbLayoutSidebarLeftCollapseFilled style={{ width: 18, height: 18 }} />
                  )}
                </CustomTooltip>
              </div>
            </div>
          )}

          {splitView && (
            <div>
              <div className="d-flex align-items-center">
                <div
                  className="note-btn-container me-2"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSplitViewCollapse();
                    }
                  }}
                >
                  <CustomTooltip tooltip={collapseRight ? "Collapse" : "Expand"}>
                    {collapseRight ? (
                      <TbLayoutSidebarLeftCollapseFilled style={{ width: 18, height: 18 }} onClick={handleSplitViewCollapse} />
                    ) : (
                      <TbLayoutSidebarRightCollapseFilled style={{ width: 18, height: 18 }} onClick={handleSplitViewCollapse} />
                    )}
                  </CustomTooltip>
                </div>
                <div
                  onClick={handleSplitView}
                  className="back-btn-container"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSplitView();
                    }
                  }}
                >
                  <CustomTooltip tooltip="Close">
                    <IoMdClose style={{ width: 14, height: 14 }} />
                  </CustomTooltip>
                </div>
              </div>
            </div>
          )}
        </div>

        <hr className="hr" />

        {/* Viewer body: document not found / loading / Brava viewer by case status */}
        {(() => {
          if (documentNotFound && publishingId) {
            return (
              <div className="d-flex justify-content-center align-items-center split-viewer-status-container">
                <div className="text-center">
                  <h5 className="text-danger mb-3">Document not found</h5>
                  <p className="text-muted">The requested document could not be found.</p>
                  <small className="text-muted">Publication ID: {publishingId}</small>
                </div>
              </div>
            );
          }
          if (!publishingId) {
            // FIX: Prevent flicker by showing loading state during initial fetch
            if (isFetchingNotesheet || isRequestingIvId) {
              return (
                <div className="d-flex justify-content-center align-items-center split-viewer-status-container">
                  <div className="text-center">
                    <div className="k-loading-image mb-3"></div>
                    <p className="text-muted">{isFetchingNotesheet ? "Loading notesheet details..." : "Publishing document, please wait…"}</p>
                  </div>
                </div>
              );
            }

            // FIX: Show clear differentiated message based on scenario
            const hasNotesheet = notesheetIds; // notesheetId indicates document exists but no IV ID
            return (
              <div className="d-flex justify-content-center align-items-center split-viewer-status-container">
                <div className="text-center">
                  {hasNotesheet ? (
                    <>
                      <h5 className="text-muted mb-3">Processing Document</h5>
                      <p className="text-muted mb-2">The notesheet is being published to the viewer.</p>
                      <small className="text-muted">This may take a few moments.</small>
                    </>
                  ) : (
                    <h5 className="text-muted mb-3">No Notesheet Available</h5>
                  )}
                </div>
              </div>
            );
          }

          // Build viewer props: publishingId from state, initialPage from hyperlink ref or prop.
          const initialPage = hyperlinkPageRef.current && hyperlinkPageRef.current > 0 ? hyperlinkPageRef.current : hyperlinkPage && hyperlinkPage > 0 ? hyperlinkPage : null;
          const viewerProps = {
            publicationId: publishingId,
            ivTitle,
            instanceId: `${paneId}-viewer`, // Unique instanceId per pane for proper isolation
            caseId, // Pass caseId to enable publication ID refetch
            onPublicationIdUpdate: handlePublicationIdUpdateFromViewer, // Callback for publication updates
            page: initialPage, // Use hyperlink page if available, otherwise start at page 1
            caseStatus, // Pass case status to control copy link button visibility
            onNotFound: () => setDocumentNotFound(true),
            onFailed: (info) => {
              setDocumentNotFound(true);
              if (typeof onPublicationFailed === "function") {
                try { onPublicationFailed(info); } catch (e) { console.error("[SplitViewer] onPublicationFailed handler threw", e); }
              }
            },
          };
          const viewerKey = publishingId ? `${publishingId}-${refreshKey}` : `no-pub-${refreshKey}`;
          const readonlyStatuses = ["Closed", "Cancelled", "Finished", "Approved"];

          const renderViewer = (ViewerComponent) => (
            <div className="split-viewer-wrapper">
              {ViewerComponent}
              {isViewerLoading && (
                <div className="loading-overlay split-viewer-loading-overlay">
                  <div className="k-loading-image mb-3"></div>
                  <p className="text-muted">Loading Document...</p>
                </div>
              )}
            </div>
          );

          // Determine if viewer should be editable
          const canEdit =
            caseStatus === "Draft"
              ? isSameWorkflowUser
              : (caseStatus === "In-Progress" || caseStatus === "InProgress") && screenName === "inboxScreen" && (isAcquired === 1 || isAcquired == true);

          const isReadonly = (screenName === "caseScreen" && caseStatus !== "Draft") || screenName === "referenceScreen" || readonlyStatuses.includes(caseStatus) || !canEdit;
          return renderViewer(isReadonly ? <ReadOnlyBravaViewer key={viewerKey} {...viewerProps} /> : <IntegratedBravaViewer key={viewerKey} {...viewerProps} />);
        })()}
      </div>
    </>
  );
};

export default SplitViewer;
