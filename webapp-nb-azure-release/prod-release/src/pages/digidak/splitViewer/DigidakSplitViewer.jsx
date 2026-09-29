import { useEffect, useRef, useState, useCallback } from "react";

//react icons
import { IoMdClose } from "react-icons/io";
import { MdPictureAsPdf } from "react-icons/md";
import { TbLayoutSidebarLeftCollapseFilled, TbLayoutSidebarRightCollapseFilled, TbReload } from "react-icons/tb";

//iv
import DigidakViewer from "../../../components/iv/DigidakViewer.jsx";
import CustomTooltip from "../../../components/customTooltip/CustomTooltip.jsx";
import { handlePdfDownload, handlePdfDownloadFailure } from "../../../components/iv/utils/pdfDownloadHandler";
import { getSrcdocIframeTargetOrigin } from "../../../components/iv/utils/postMessageTargets";

// Sweet Alert
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert.jsx";

// Make showSweetAlert available globally for pdfDownloadHandler
if (typeof window !== "undefined") {
  window.showSweetAlert = showSweetAlert;
}

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  const executedFunction = (...args) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  executedFunction.cancel = () => clearTimeout(timeout);
  return executedFunction;
};

const DigidakSplitViewer = ({
  title,
  ivTitle,
  splitView,
  collapseRight,
  publicationId,
  handleSplitView,
  handleSplitViewCollapse,
  onPublicationIdUpdate,
  page = null,
  digidakStatus = null,
  isOld = false,
  isRepublishing = false,
}) => {
  const [publishingId, setPublishingId] = useState(publicationId);
  const [isExporting, setIsExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isViewerLoading, setIsViewerLoading] = useState(true);

  // Refs for cleanup and performance optimization
  const isMountedRef = useRef(true);
  const iframeCheckIntervalRef = useRef(null);
  const exportTimeoutRef = useRef(null);

  // Handle publication ID updates from the viewer component
  const handlePublicationIdUpdateFromViewer = useCallback(
    (newPublicationId) => {
      // CRITICAL FIX: Prevent redundant remounts if ID hasn't changed
      if (!newPublicationId || newPublicationId === publishingId) {
        return;
      }

      setPublishingId(newPublicationId);

      // Notify parent component if callback provided
      if (onPublicationIdUpdate) {
        onPublicationIdUpdate(newPublicationId);
      }

      // Force viewer refresh with new publication ID
      setIsViewerLoading(true);
      setRefreshKey((prev) => prev + 1);
    },
    [publishingId, onPublicationIdUpdate],
  );

  const handleRefreshViewer = () => {
    setIsViewerLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const handlePdfExport = useCallback(() => {
    // Simple check - only prevent if already exporting
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    // Enhanced approach with dropdown fallback
    setTimeout(() => {
      try {
        const iframe = document.querySelector('iframe[title*="Digidak Viewer"]') || document.querySelector('iframe[title*="Brava Viewer"]');

        if (!iframe) {
          setIsExporting(false);
          return;
        }

        // Send enhanced message with dropdown fallback logic
        iframe.contentWindow.postMessage(
          {
            type: "TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK",
          },
          getSrcdocIframeTargetOrigin(),
        );

        // Reset exporting state after 8 seconds (longer for dropdown interaction)
        setTimeout(() => {
          setIsExporting(false);
        }, 8000);
      } catch (error) {
        console.error(error);
        setIsExporting(false);
      }
    }, 1000);
  }, [isExporting]);

  // Update publication ID when prop changes
  useEffect(() => {
    const newPublicationId = publicationId;

    // Only trigger refresh if publication actually changed
    if (newPublicationId !== publishingId) {
      setPublishingId(newPublicationId);
      setIsViewerLoading(true);
      setRefreshKey((prev) => prev + 1);
    }
  }, [publicationId, publishingId]);

  // Reset loading state when refresh key changes (when refresh is triggered)
  useEffect(() => {
    if (refreshKey > 0) {
      setIsViewerLoading(true);
    }
  }, [refreshKey]);

  // Listen for iframe messages (PDF export events and viewer status)
  useEffect(() => {
    const handleIframeMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "viewerInitialized") {
        setIsViewerLoading(false);
      } else if (event.data?.type === "viewerLoading") {
        setIsViewerLoading(true);
      } else if (event.data?.type === "viewerError") {
        setIsViewerLoading(false); // Enable refresh button on error
      } else if (event.data?.type === "viewerRetry") {
        handleRefreshViewer(); // Handle retry from viewer
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

    window.addEventListener("message", handleIframeMessage);

    // Fallback timeout to enable refresh button after 8 seconds
    const timeout = setTimeout(() => {
      setIsViewerLoading(false);
    }, 8000);

    return () => {
      window.removeEventListener("message", handleIframeMessage);
      clearTimeout(timeout);
    };
  }, [refreshKey, publishingId]);

  // Optimized iframe detection with proper cleanup
  useEffect(() => {
    if (!isMountedRef.current) return;

    let attempts = 0;
    const maxAttempts = 10;

    const findBravaIframe = () => {
      if (!isMountedRef.current || attempts >= maxAttempts) {
        if (iframeCheckIntervalRef.current) {
          clearInterval(iframeCheckIntervalRef.current);
          iframeCheckIntervalRef.current = null;
        }
        return;
      }

      // Try to find Digidak Viewer iframe first, fallback to Brava Viewer for compatibility
      const iframe = document.querySelector('iframe[title*="Digidak Viewer"]') || document.querySelector('iframe[title*="Brava Viewer"]');

      if (iframe) {
        const handleIframeLoad = () => {
          if (isMountedRef.current) {
            setTimeout(() => {
              if (isMountedRef.current) {
                setIsViewerLoading(false);
              }
            }, 2000);
          }
        };

        if (iframe.complete || iframe.readyState === "complete") {
          handleIframeLoad();
        } else {
          iframe.addEventListener("load", handleIframeLoad, { once: true });
        }

        // Clear interval once iframe is found
        if (iframeCheckIntervalRef.current) {
          clearInterval(iframeCheckIntervalRef.current);
          iframeCheckIntervalRef.current = null;
        }
      }

      attempts++;
    };

    // Start checking immediately and then every second
    findBravaIframe();
    iframeCheckIntervalRef.current = setInterval(findBravaIframe, 1000);

    return () => {
      if (iframeCheckIntervalRef.current) {
        clearInterval(iframeCheckIntervalRef.current);
        iframeCheckIntervalRef.current = null;
      }
    };
  }, [refreshKey, publishingId]);

  // Handle page navigation from URL parameters and hyperlink clicks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Support new deep linking format
    const pid = urlParams.get("pid");
    const pageNumber = urlParams.get("pageNumber");

    // Support old format for backward compatibility
    const pageParam = urlParams.get("page") || pageNumber;
    const urlPublishingId = urlParams.get("publishing_id") || pid;

    // If URL has publishing_id/pid and it matches current publishingId, navigate to page
    if (publishingId && urlPublishingId === publishingId) {
      if (pageParam) {
        // Navigate to specified page from hyperlink
        const targetPage = parseInt(pageParam, 10);
        if (!isNaN(targetPage) && targetPage > 0) {
          navigateToPageInViewer(targetPage);
        }
      }
    }
  }, [publishingId]);

  // Debounced navigation function to prevent multiple rapid calls
  const navigateToPageInViewerRef = useRef(
    debounce((pageNumber) => {
      if (!isMountedRef.current) return;

      // Try to find Digidak Viewer iframe first, fallback to Brava Viewer for compatibility
      const iframe = document.querySelector('iframe[title*="Digidak Viewer"]') || document.querySelector('iframe[title*="Brava Viewer"]');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: "NAVIGATE_TO_PAGE",
            page: pageNumber,
          },
          getSrcdocIframeTargetOrigin(),
        );
      }
    }, 300),
  );
  const navigateToPageInViewer = navigateToPageInViewerRef.current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => navigateToPageInViewerRef.current.cancel();
  }, []);

  // Handle messages from iframe (including hyperlink navigation)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "NAVIGATE_TO_PAGE") {
        const { page, publicationId, source } = event.data;

        if (source === "hyperlink") {
          // Update URL to reflect the new page
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("page", page);
          if (publicationId) {
            currentUrl.searchParams.set("publicationId", publicationId);
          }

          // Update browser URL without page reload
          window.history.pushState({}, "", currentUrl.toString());

          // Navigate to the page in the viewer
          navigateToPageInViewer(page);
        }
      } else if (event.data?.type === "HYPERLINK_CLICK") {
        // Handle hyperlink clicks - could open in split view if needed
        const { publicationId: linkPublicationId, page: linkPage } = event.data;
        if (linkPublicationId && linkPublicationId !== publishingId) {
          // Update publication ID and refresh viewer
          setPublishingId(linkPublicationId);
          setIsViewerLoading(true);
          setRefreshKey((prev) => prev + 1);

          // Navigate to page if specified
          if (linkPage) {
            setTimeout(() => {
              navigateToPageInViewer(linkPage);
            }, 2000);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigateToPageInViewer, publishingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Clear all timeouts and intervals
      if (iframeCheckIntervalRef.current) {
        clearInterval(iframeCheckIntervalRef.current);
      }
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="card-container position-relative rounded">
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="case-info-label">{title}</h6>

        <div className="d-flex align-items-center">
          {/* Refresh Button */}
          <div className={`note-btn-container me-2 ${isViewerLoading ? "opacity-50 pe-none" : "opacity-100 cursor-pointer"}`}>
            <CustomTooltip tooltip={isViewerLoading ? "Viewer is loading..." : "Refresh"}>
              <TbReload size={16} onClick={isViewerLoading ? undefined : handleRefreshViewer} className={`${isViewerLoading ? "pe-none spin" : "pe-auto"}`} />
            </CustomTooltip>
          </div>

          {/* PDF Export Button */}
          <div
            className={`note-btn-container me-2 ${isExporting || isViewerLoading ? "opacity-50 pe-none" : "opacity-100 cursor-pointer"}`}
            onClick={isExporting || isViewerLoading ? undefined : handlePdfExport}
          >
            <CustomTooltip tooltip={isExporting ? "Exporting PDF..." : isViewerLoading ? "Viewer is loading..." : "Export to PDF"}>
              <MdPictureAsPdf size={16} />
            </CustomTooltip>
          </div>

          {/* Split View Controls */}
          {splitView && (
            <>
              <div className="note-btn-container me-2">
                <CustomTooltip tooltip="Collapse">
                  {collapseRight ? (
                    <TbLayoutSidebarRightCollapseFilled size={18} onClick={handleSplitViewCollapse} />
                  ) : (
                    <TbLayoutSidebarLeftCollapseFilled size={18} onClick={handleSplitViewCollapse} />
                  )}
                </CustomTooltip>
              </div>
              <div onClick={handleSplitView} className="back-btn-container">
                <CustomTooltip tooltip="Close">
                  <IoMdClose size={14} />
                </CustomTooltip>
              </div>
            </>
          )}
        </div>
      </div>

      <hr className="hr" />

      {(() => {
        // Common viewer props
        const urlParams = new URLSearchParams(window.location.search);
        const pageNumber = urlParams.get("pageNumber");
        const pageParam = urlParams.get("page") || pageNumber;

        const viewerProps = {
          publicationId: publishingId,
          ivTitle: ivTitle || "Digidak Document Viewer",
          instanceId: `digidak-${splitView ? "split" : "main"}-${refreshKey}`,
          onPublicationIdUpdate: handlePublicationIdUpdateFromViewer,
          page: pageParam ? parseInt(pageParam, 10) : page,
          caseStatus: digidakStatus,
          isOld: isOld,
        };

        // Show loader while background republishing is in-flight (prevents premature error)
        if (!publishingId && isRepublishing) {
          return (
            <div className="d-flex justify-content-center align-items-center viewer-placeholder-height">
              <div className="text-center">
                <div className="k-loading-image mb-3"></div>
                <p className="text-muted">Publishing document, please wait…</p>
              </div>
            </div>
          );
        }

        // Use DigidakViewer directly without publicationId checks
        return <DigidakViewer key={refreshKey} {...viewerProps} />;
      })()}
    </div>
  );
};

export default DigidakSplitViewer;
