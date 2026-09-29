import React, { useCallback } from "react";
import BaseReadOnlyViewer from "./BaseReadOnlyViewer";
import { TOOLBAR_BTN_BASE, TITLE_TEXT_STYLE, PAGE_LINK_CONFIG, buildRightToolbar } from "./utils/bravaConstants";

const READONLY_LAYOUT_CONFIG = {
  topToolbar: "readonlyToolbar",
  readonlyToolbar: {
    height: 48,
    defaultIconSize: 20,
    left: [
      { component: "ZoomInButton", style: { ...TOOLBAR_BTN_BASE, marginRight: "4px" } },
      { component: "ZoomOutButton", style: { ...TOOLBAR_BTN_BASE, marginRight: "8px" } },
    ],
    center: [{ component: "TitleText", style: TITLE_TEXT_STYLE }],
    right: [],
  },
  container: { component: "FullSizeSplitPane", layoutKey: "mainContainer" },
  mainContainer: [{ component: "TabContainer", layoutKey: "tabContainerWithMarkups" }, { component: "PageContainer" }],
  pageLink: PAGE_LINK_CONFIG,
};

// Simplified readonly viewer - always shows copy link button
const CircularViewer = ({ publicationId, ivTitle, instanceId = "readonly", page = null }) => {
  const createReadonlyLayout = useCallback(() => {
    const readonlyLayout = {
      ...READONLY_LAYOUT_CONFIG,
      readonlyToolbar: {
        ...READONLY_LAYOUT_CONFIG.readonlyToolbar,
        right: buildRightToolbar(true),
      },
    };
    return readonlyLayout;
  }, []);

  return (
    <BaseReadOnlyViewer
      publicationId={publicationId}
      ivTitle={ivTitle}
      instanceId={instanceId}
      page={page}
      createLayout={createReadonlyLayout}
      enableScriptRetry={true}
      maxRetryAttempts={3}
      retryDelayMs={500}
      viewerName="Circular Viewer"
    />
  );
};

export default CircularViewer;
