import React, { useCallback, useRef } from "react";
import BaseReadOnlyViewer from "./BaseReadOnlyViewer";
import {
  pdfExport,
  pdfExportActions,
  pdfExportDefaults,
  pageSizeOptions,
  isoOptions,
  orientationOptions,
  layerOptions,
  coloringOptions,
  fontOptions,
  compressionOptions,
  colorConversionOptions,
  colorDepthOptions,
  pageOutputOptions,
} from "./layoutDependencies.jsx";
import { sentCaseService } from "../../services/caseManagement/sentCases/sentCaseService";
import { TOOLBAR_BTN_BASE, TITLE_TEXT_STYLE, TAB_PANE_STYLE, PAGE_LINK_CONFIG, shouldShowCopyLinkButton, buildRightToolbar } from "./utils/bravaConstants";

const READONLY_LAYOUT_CONFIG = {
  topToolbar: "readonlyToolbar",
  readonlyToolbar: {
    height: 48,
    defaultIconSize: 20,
    left: [
      { component: "ToggleSidebarButton", side: "tabContainerWithMarkups", style: { ...TOOLBAR_BTN_BASE, marginRight: "8px" } },
      { component: "ZoomInButton", style: { ...TOOLBAR_BTN_BASE, marginRight: "4px" } },
      { component: "ZoomOutButton", style: { ...TOOLBAR_BTN_BASE, marginRight: "8px" } },
      { component: "ExportButton", format: "pdf", style: { ...TOOLBAR_BTN_BASE, marginRight: "8px" } },
    ],
    center: [{ component: "TitleText", style: TITLE_TEXT_STYLE }],
    right: [],
  },
  container: { component: "FullSizeSplitPane", layoutKey: "mainContainer" },
  mainContainer: [{ component: "TabContainer", layoutKey: "tabContainerWithMarkups" }, { component: "PageContainer" }],
  tabContainerWithMarkups: {
    sidebarName: "tabContainerWithMarkups",
    primary: "primary",
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    width: 0,
    minWidth: 0,
    maxWidth: 300,
    tabs: [
      { component: "ThumbnailPane", title: "tab.thumbnails", style: TAB_PANE_STYLE },
      { component: "MarkupPane", title: "tab.tools", layoutKey: "markupTools", style: TAB_PANE_STYLE },
      { component: "SearchResultsPane", title: "tab.searchResults", style: TAB_PANE_STYLE },
    ],
  },
  markupTools: [
    {
      title: "Selection Tools",
      style: { backgroundColor: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "6px", padding: "8px" },
      tools: [
        {
          label: "select markup",
          tool: "select",
          icon: "Select",
          style: { backgroundColor: "#0d6efd", color: "#ffffff", border: "none", borderRadius: "4px", padding: "6px 10px", fontSize: "12px" },
        },
      ],
    },
  ],
  pageLink: PAGE_LINK_CONFIG,
  // PDF Export configuration
  pdfExport,
  pdfExportActions,
  pdfExportDefaults,
  exportDialogs: ["pdf"],
  pageSizeOptions,
  isoOptions,
  orientationOptions,
  layerOptions,
  coloringOptions,
  fontOptions,
  compressionOptions,
  colorConversionOptions,
  colorDepthOptions,
  pageOutputOptions,
};

// Digidak viewer with refetch capability for publication updates
const DigidakViewer = ({ publicationId, ivTitle, instanceId = "default", caseId = null, onPublicationIdUpdate = null, page = null, caseStatus = null, isOld = false }) => {
  const refetchAttempted = useRef(false);
  const lastCaseIdRef = useRef(caseId);

  if (lastCaseIdRef.current !== caseId) {
    refetchAttempted.current = false;
    lastCaseIdRef.current = caseId;
  }

  const createModifiedLayout = useCallback(() => {
    const readonlyLayout = {
      ...READONLY_LAYOUT_CONFIG,
      readonlyToolbar: {
        ...READONLY_LAYOUT_CONFIG.readonlyToolbar,
        right: buildRightToolbar(shouldShowCopyLinkButton(ivTitle, caseStatus)),
      },
    };

    return readonlyLayout;
  }, [ivTitle, caseStatus]);

  // Refetch notesheet publication ID from case service when needed
  const refetchPublicationId = useCallback(async () => {
    if (!caseId || refetchAttempted.current) return null;

    try {
      refetchAttempted.current = true;
      const folderPathPrefix = isOld ? "/CMS Legacy" : "/Case";

      const response = await sentCaseService.getNotesheetId({
        input_folder_path: `${folderPathPrefix}/${caseId}`,
      });

      const pubId = response?.entries?.[0]?.content?.properties?.publishing_id;

      if (pubId && pubId !== publicationId && onPublicationIdUpdate) {
        onPublicationIdUpdate(pubId);
      }

      return pubId;
    } catch {
      return null;
    }
  }, [caseId, publicationId, onPublicationIdUpdate]);

  return (
    <BaseReadOnlyViewer
      publicationId={publicationId}
      ivTitle={ivTitle}
      instanceId={instanceId}
      caseId={caseId}
      onPublicationIdUpdate={onPublicationIdUpdate}
      page={page}
      caseStatus={caseStatus}
      createLayout={createModifiedLayout}
      enableScriptRetry={true}
      maxRetryAttempts={3}
      retryDelayMs={500}
      refetchPublicationId={refetchPublicationId}
      viewerName="Digidak Viewer"
    />
  );
};

export default DigidakViewer;
