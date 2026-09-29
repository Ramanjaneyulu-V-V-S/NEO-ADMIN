// Layout configuration for annotation tools and toolbar
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
import { PAGE_LINK_CONFIG } from "./utils/bravaConstants";

export const AnnotationsLayout = {
  topToolbar: "nabardToolbar",
  nabardToolbar: {
    height: 45,
    defaultIconSize: 15,
    left: [
      {
        component: "ToggleSidebarButton",
        side: "tabContainerWithMarkups",
        style: {
          border: "none",
          borderRadius: "6px",
        },
      },

      {
        component: "SaveButton",
        style: {
          border: "none",
          borderRadius: "6px",
        },
      },
      {
        component: "ZoomInButton",
        style: {
          border: "none",
          borderRadius: "6px",
        },
      },
      {
        component: "ZoomOutButton",
        style: {
          border: "none",
          borderRadius: "6px",
        },
      },
      {
        component: "ExportButton",
        format: "pdf",
        style: {
          border: "none",
          borderRadius: "6px",
        },
      },
    ],
    center: [
      {
        component: "TitleText",
        style: {
          marginLeft: "1em",
          fontSize: "14px",
          fontWeight: "600",
        },
      },
    ],
    right: [
      {
        component: "SearchTextInput",
      },
      {
        component: "SearchToggleButton",
        style: {
          border: "none",
          borderRadius: "6px",

          marginLeft: "4px",
        },
      },
      {
        component: "CustomButton",
        layoutKey: "pageLink",
        eventKey: "copyPageLinkButton",
        buttonClasses: "ot-iv-hoverButtonFilledLight",
        style: {
          border: "none",
          borderRadius: "6px",

          marginLeft: "4px",
          color: "white",
        },
      },
      {
        component: "CustomButton",
        layoutKey: "highlighterButton",
        eventKey: "highlighter",
        style: {
          color: "#ffffff",
        },
      },
      {
        component: "CustomButton",
        layoutKey: "textToolButton",
        eventKey: "textTool",
        style: {
          color: "#ffffff",
        },
      },
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
    tabs: [
      {
        component: "ThumbnailPane",
        title: "tab.thumbnails",
        style: {
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
        },
      },
      {
        component: "MarkupPane",
        title: "tab.tools",
        layoutKey: "markupTools",
        style: {
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
        },
      },

      {
        component: "SearchResultsPane",
        title: "tab.searchResults",
        style: {
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
        },
      },
    ],
  },
  markupTools: [
    {
      title: "Selection Tools",
      style: {
        backgroundColor: "#f8f9fa",
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        padding: "8px",
      },
      tools: [
        {
          label: "select markup",
          tool: "select",
          icon: "Select",
          style: {
            backgroundColor: "#0d6efd",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
      ],
    },
    {
      title: "toolPalette.annotations",
      style: {
        backgroundColor: "#f8f9fa",
        border: "1px solid #e0e0e0",
        borderRadius: "6px",
        padding: "8px",
      },
      tools: [
        {
          label: "openSketch",
          tool: "openSketch",
          icon: "OpenSketch",
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
          },
        },
        {
          label: "text",
          tool: "text",
          icon: "Text",
          props: {
            backgroundColor: "#ffffff00",
            foregroundColor: "#000000ff",
            strokeWidth: 0.2,
            size: 0.16,
            text: " ",
          },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        {
          label: "arrow",
          tool: "arrow",
          icon: "Arrow",
          props: { strokeWidth: 0.2 },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        {
          label: "ellipse",
          tool: "ellipse",
          icon: "Ellipse",
          props: { strokeWidth: 0.2 },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        {
          label: "Scratch Out",
          tool: "scratchout",
          icon: "Scratchout",
          props: { strokeWidth: 0.2 },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        {
          label: "rectangle",
          tool: "rectangle",
          icon: "Rectangle",
          props: { strokeWidth: 0.2 },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        {
          label: "Highlight ",
          tool: "highlight",
          icon: "Highlight",
          props: {
            strokeWidth: 0.2,
          },
          style: {
            backgroundColor: "#ffc107",
            color: "#000000",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },

        {
          label: "line",
          tool: "line",
          icon: "Line",
          props: { strokeWidth: 0.2 },
          style: {
            backgroundColor: "#17a2b8",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
        // {
        //   label: "Cross Out",
        //   tool: "crossout",
        //   icon: "Crossout",
        //   props: { strokeWidth: 0.2 },
        //   style: {
        //     backgroundColor: "#17a2b8",
        //     color: "#ffffff",
        //     border: "none",
        //     borderRadius: "4px",
        //     padding: "6px 10px",
        //     fontSize: "12px",
        //   },
        // },
        {
          label: "changemark",
          tool: "changemark",
          icon: "Changemark",
          props: { strokeWidth: 0.2 },
          style: {
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "12px",
          },
        },
      ],
    },
  ],

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
  pageLink: PAGE_LINK_CONFIG,
  highlighterButton: {
    svg: '<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M4 13l6-6 3 3-6 6H4v-3z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 4l2-2 5 5-2 2" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/></svg>',
    toolTip: "Activate highlighter tool",
    disabled: false,
    eventKey: "highlighter",
  },
  textToolButton: {
    svg: '<svg viewBox="0 0 20 20" style="width: 20px; height: 20px;"><path fill="white" stroke="none" d="M23 22.9h-9.9v-1.5c.6 0 1.2 0 1.8-.2.4-.1.6-.5.6-.9 0-.3-.1-.7-.2-1l-1-2.5H7.4l-.5 1.4c-.2.5-.4 1.1-.4 1.7-.1.5.2 1 .7 1.2.5.2 1.1.3 1.7.3v1.5H1.6v-1.5c.5 0 1-.1 1.5-.3.5-.3.9-.7 1.2-1.3.5-.8.9-1.7 1.2-2.6l6-16.2H13l6.4 16.7c.5 1.2.8 2 1 2.4.2.4.5.7.9 1 .5.3 1.1.4 1.6.3l.1 1.5zm-9.3-7.6l-2.9-7.5L8 15.3h5.7z"></path></svg>',
    toolTip: "Activate text tool",
    disabled: false,
    eventKey: "textTool",
  },
};
