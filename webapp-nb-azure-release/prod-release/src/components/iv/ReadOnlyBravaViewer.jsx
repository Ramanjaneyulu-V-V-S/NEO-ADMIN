import React, { useCallback } from "react";
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
    right: [
      { component: "SearchTextInput" },
      { component: "SearchToggleButton", style: { ...TOOLBAR_BTN_BASE, marginLeft: "4px" } },
    ],
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

// Readonly viewer with conditional copy link button based on case status
const ReadOnlyBravaViewer = ({
  publicationId,
  ivTitle,
  instanceId = "readonly",
  page = null,
  caseStatus = null,
  caseId = null,
  onPublicationIdUpdate = null,
  onStatusChange = null,
  onNotFound = null,
  onFailed = null,
}) => {
  const createReadonlyLayout = useCallback(() => {
    const readonlyLayout = {
      ...READONLY_LAYOUT_CONFIG,
      readonlyToolbar: {
        ...READONLY_LAYOUT_CONFIG.readonlyToolbar,
        right: buildRightToolbar(shouldShowCopyLinkButton(ivTitle, caseStatus)),
      },
    };
    return readonlyLayout;
  }, [ivTitle, caseStatus]);

  return (
    <BaseReadOnlyViewer
      publicationId={publicationId}
      ivTitle={ivTitle}
      instanceId={instanceId}
      page={page}
      caseStatus={caseStatus}
      caseId={caseId}
      onPublicationIdUpdate={onPublicationIdUpdate}
      onStatusChange={onStatusChange}
      onNotFound={onNotFound}
      onFailed={onFailed}
      createLayout={createReadonlyLayout}
      enableScriptRetry={true}
      maxRetryAttempts={3}
      retryDelayMs={500}
      viewerName="ReadOnly Brava Viewer"
    />
  );
};

export default ReadOnlyBravaViewer;
