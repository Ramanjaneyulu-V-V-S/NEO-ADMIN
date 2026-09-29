import { useState, useCallback } from "react";
import { handlePdfDownload, handlePdfDownloadFailure } from "../components/iv/utils/pdfDownloadHandler";
import { getSrcdocIframeTargetOrigin } from "../components/iv/utils/postMessageTargets";
import { ivTokenManager } from "../services/iv/tokenManager";

export const usePdfExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Handle export success and download - use centralized handler
  const handleExportSuccess = useCallback(async (event) => {
    try {
      const loadSourcesProp = Object.keys(event.detail._embedded["otc:get_configs_id"].features).filter((property) =>
        property.startsWith("opentext.publishing.sources@LoadSources@"),
      );

      const loadSources = Object.values(event.detail._embedded["otc:get_configs_id"].features[loadSourcesProp].documents);
      const sourceDocName = loadSources[0].filenameHint;
      const artifact = event.detail._embedded["pa:get_publication_artifacts"]?.find((e) => e._embedded["ac:get_artifact_content"].urlTemplate)?._embedded[
        "ac:get_artifact_content"
      ];
      const exportType = artifact.acceptHint === "application/pdf" ? "pdf" : "tiff";
      const urlTemplate = artifact.urlTemplate;
      const content = artifact.contentLinks[0];

      const url = urlTemplate.replace("{id}", content.id).replace("{name}", content.name).replace("{type}", content.type).replace("{file}", content.file);
      const filename = content.file || `${sourceDocName}.${exportType}`;

      // Fetch the file and convert to base64 for centralized handler
      try {
        const token = await ivTokenManager.getToken();
        const response = await fetch(url, {
          method: "GET",
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Convert to base64 in chunks to avoid call stack issues
        const chunkSize = 8192;
        let base64String = "";
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64String += String.fromCharCode.apply(null, chunk);
        }
        base64String = btoa(base64String);

        // Use centralized handler
        const downloaded = await handlePdfDownload(
          {
            filename,
            fileData: base64String,
            mimeType: exportType === "pdf" ? "application/pdf" : "image/tiff",
            downloadUrl: url,
          },
          {
            showSuccessAlert: false,
            showErrorAlert: false,
            onSuccess: () => {
              setIsExporting(false);
              setExportProgress("Download completed successfully!");
              setTimeout(() => setExportProgress(null), 3000);
            },
            onError: (error) => {
              setExportError("Failed to download the exported file: " + error.message);
              setIsExporting(false);
            },
          },
        );

        if (!downloaded) {
          setIsExporting(false);
          setExportError("Download was skipped (duplicate or already in progress)");
        }
      } catch (error) {
        setExportError("Failed to download the exported file: " + error.message);
        setIsExporting(false);
      }
    } catch (error) {
      setExportError("Failed to process export data: " + error.message);
      setIsExporting(false);
    }
  }, []);

  // Handle export failure - use centralized handler
  const handleExportFailure = useCallback((event) => {
    const errorMessage = event.detail?.message || event.detail?.error || "Unknown error";
    handlePdfDownloadFailure(
      { error: errorMessage },
      {
        showErrorAlert: false,
        onError: (error) => {
          setExportError("PDF export failed: " + error.message);
          setIsExporting(false);
        },
      },
    );
  }, []);

  // Export to PDF function
  const exportToPdf = useCallback(async (customOptions = {}, iframeElement) => {
    if (!iframeElement?.contentWindow) {
      setExportError("Viewer not available");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportProgress("Starting PDF export...");

    try {
      const exportOptions = {
        pagesToExport: "all",
        pageSizeName: "",
        rotateToOrientation: "original",
        colorConversion: "original",
        includeLayers: "all",
        isoConformance: "none",
        successAction: "download",
        markupBurnin: "burn",
        ...customOptions,
      };

      // Send export command to iframe
      iframeElement.contentWindow.postMessage(
        {
          type: "EXPORT_TO_PDF",
          options: exportOptions,
        },
        getSrcdocIframeTargetOrigin(),
      );

      setExportProgress("PDF export initiated...");
    } catch (error) {
      setExportError("Failed to start PDF export: " + error.message);
      setIsExporting(false);
    }
  }, []);

  return {
    exportToPdf,
    isExporting,
    exportProgress,
    exportError,
    handleExportSuccess,
    handleExportFailure,
    clearError: () => setExportError(null),
  };
};
