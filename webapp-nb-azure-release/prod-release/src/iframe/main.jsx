import React from "react";
import ReactDOM from "react-dom/client";
import BravaViewerIframe from "./components/BravaViewerIframe";
import { log } from "./utils/logger";

// Get configuration from window (set by iframeContent.html or parent)
const viewerConfig = window.viewerConfig || {};

// Check if root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  log.error("[IFRAME MAIN] Root element not found in iframe");
  throw new Error("Root element not found in iframe");
}

// Render the viewer iframe component
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BravaViewerIframe config={viewerConfig} />
  </React.StrictMode>,
);
