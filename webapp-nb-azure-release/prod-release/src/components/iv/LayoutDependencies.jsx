// PDF export and layout options configuration
export const pageOutputOptions = [{ value: "all" }, { value: "current" }, { value: "markup" }, { value: "designated" }];
export const pageSizeOptions = [
  { value: "", label: "Original page size" },
  { value: "Letter", label: "Letter (8.5 X 11 in)" },
  { value: "Legal", label: "Legal (8.5 X 14 in.)" },
  { value: "Ledger", label: "Ledger (17 X 11 in.)" },
  { value: "Tabloid", label: "Tabloid (11 X 17 in.)" },
  { value: "Executive", label: "Executive (7.25 x 10.55 in.)" },
  { value: "Arch C Size Sheet", label: "Arch C Size Sheet (24 X 18 in.)" },
  { value: "Arch D Size Sheet", label: "Arch D Size Sheet (36 X 24 in.)" },
  { value: "Arch E Size Sheet", label: "Arch E Size Sheet (48 X 36 in.)" },
  { value: "Ansi C Size Sheet", label: "Ansi C Size Sheet (22 X 17 in.)" },
  { value: "Ansi D Size Sheet", label: "Ansi D Size Sheet (34 X 22 in.)" },
  { value: "Ansi E Size Sheet", label: "Ansi E Size Sheet (44 X 34 in.)" },
  { value: "ISO A0 Landscape", label: "ISO A0 Landscape (1189 X 841 mm)" },
  { value: "ISO A1 Landscape", label: "ISO A1 Landscape (841 X 594 mm)" },
  { value: "ISO A2 Landscape", label: "ISO A2 Landscape (594 X 420 mm)" },
  { value: "ISO A3 Landscape", label: "ISO A3 Landscape (420 X 297 mm)" },
  { value: "ISO A4 Landscape", label: "ISO A4 Landscape (297 X 210 mm)" },
  { value: "ISO A5 Landscape", label: "ISO A5 Landscape (210 X 148 mm)" },
  { value: "ISO A6 Landscape", label: "ISO A6 Landscape (148 X 105 mm)" },
  { value: "ISO A7 Landscape", label: "ISO A7 Landscape (105 X 74 mm)" },
  { value: "ISO A0 Portrait", label: "ISO A0 Portrait (841 X 1189 mm)" },
  { value: "ISO A1 Portrait", label: "ISO A1 Portrait (594 X 841 mm)" },
  { value: "ISO A2 Portrait", label: "ISO A2 Portrait (420 X 594 mm)" },
  { value: "ISO A3 Portrait", label: "ISO A3 Portrait (297 X 420 mm)" },
  { value: "ISO A4 Portrait", label: "ISO A4 Portrait (210 X 297 mm)" },
  { value: "ISO A5 Portrait", label: "ISO A5 Portrait (148 X 210 mm)" },
  { value: "ISO A6 Portrait", label: "ISO A6 Portrait (105 X 148 mm)" },
  { value: "ISO A7 Portrait", label: "ISO A7 Portrait (74 X 105 mm)" },
  { value: "ISO B0 Landscape", label: "ISO B0 Landscape (1414 X 1000 mm)" },
  { value: "ISO B1 Landscape", label: "ISO B1 Landscape (1000 X 707 mm)" },
  { value: "ISO B2 Landscape", label: "ISO B2 Landscape (707 X 500 mm)" },
  { value: "ISO B3 Landscape", label: "ISO B3 Landscape (500 X 353 mm)" },
  { value: "ISO B4 Landscape", label: "ISO B4 Landscape (353 X 250 mm)" },
  { value: "ISO B5 Landscape", label: "ISO B5 Landscape (250 X 176 mm)" },
  { value: "ISO B6 Landscape", label: "ISO B6 Landscape (176 X 125 mm)" },
  { value: "ISO B7 Landscape", label: "ISO B7 Landscape (125 X 88 mm)" },
  { value: "ISO B0 Portrait", label: "ISO B0 Portrait (1000 X 1414 mm)" },
  { value: "ISO B1 Portrait", label: "ISO B1 Portrait (707 X 1000 mm)" },
  { value: "ISO B2 Portrait", label: "ISO B2 Portrait (500 X 707 mm)" },
  { value: "ISO B3 Portrait", label: "ISO B3 Portrait (353 X 500 mm)" },
  { value: "ISO B4 Portrait", label: "ISO B4 Portrait (250 X 353 mm)" },
  { value: "ISO B5 Portrait", label: "ISO B5 Portrait (176 X 250 mm)" },
  { value: "ISO B6 Portrait", label: "ISO B6 Portrait (125 X 176 mm)" },
  { value: "ISO B7 Portrait", label: "ISO B7 Portrait (88 X 125 mm)" },
  { value: "JIS B4", label: "JIS B4 (364 X 257 mm)" },
  { value: "JIS B5", label: "JIS B5 (182 X 257 mm)" },
];
export const isoOptions = [
  { label: "PDF Standard", value: "none" },
  { label: "PDF/A-1a compatible", value: "a1a" },
  { label: "PDF/A-1b compatible", value: "a1b" },
  { label: "PDF/A-2b compatible", value: "a2b" },
  { label: "PDF/A-2u compatible", value: "a2u" },
  { label: "PDF/A-3a compatible", value: "a3a" },
  { label: "PDF/A-3b compatible", value: "a3b" },
  { label: "PDF/A-3u compatible", value: "a3u" },
  { label: "PDF/E compatible", value: "e" },
];
export const orientationOptions = [{ value: "original" }, { value: "portrait" }, { value: "landscape" }, { value: "outputsize" }];
export const layerOptions = [{ value: "all" }, { value: "visible" }, { value: "none" }];
export const coloringOptions = [{ value: "original" }, { value: "convertMonochrome" }, { value: "convertGrayscale" }];
export const fontOptions = [
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-Serif" },
  { value: "cursive", label: "Cursive" },
  { value: "monospace", label: "Monospace" },
];
export const compressionOptions = [{ value: "jpg" }, { value: "lzw" }, { value: "packbits" }, { value: "ccitt" }];
export const colorConversionOptions = [{ value: "original" }, { value: "convertMonochrome" }, { value: "convertGrayscale" }];
export const colorDepthOptions = [
  { value: "force1bpp" },
  { value: "max4bpp" },
  { value: "force4bpp" },
  { value: "max8bpp" },
  { value: "force8bpp" },
  { value: "max24bpp" },
  { value: "force24bpp" },
];
export const pdfExportActions = [
  // { id: "newFile", message: "Back to Content Server as a new file" },
  // {
  //   id: "newVersion",
  //   message: "Back to Content Server as a new version of the current file",
  // },
  // {
  //   id: "newRendition",
  //   message: "Back to Content Server as a rendition of the current version",
  // },
  { id: "download", default: true, message: "Download to my browser" },
];
export const pdfExportDefaults = {
  pageSizeName: "",
  pagesToExport: "all",
  markupBurnin: "burn",
  colorConversion: "original",
  isoConformance: "none",
  successAction: "download",
  includeLayers: "all",
  rotateToOrientation: "original",
  includeMarkups: true,
  BurninMarkups: "burn",
  AppendComments: false,
  AppendReasons: false,
  banner: {
    Watermark: {
      disabled: true,
      text: "",
      size: 72,
      font: "monospace",
      opacity: 0.25,
      color: "#FF0000",
      italic: true,
      bold: true,
      underline: true,
    },
    TopLeft: { text: "", size: 48, font: "cursive" },
    TopCenter: { text: "", size: 48, font: "cursive" },
    TopRight: { text: "", size: 48, font: "cursive" },
    BottomLeft: { text: "", size: 48, font: "cursive" },
    BottomCenter: { text: "", size: 48, font: "cursive" },
    BottomRight: { text: "", size: 48, font: "cursive" },
    LeftTop: { text: "", size: 48, font: "cursive" },
    LeftCenter: { text: "", size: 48, font: "cursive" },
    LeftBottom: { text: "", size: 48, font: "cursive" },
    RightTop: { text: "", size: 48, font: "cursive" },
    RightCenter: { text: "", size: 48, font: "cursive" },
    RightBottom: { text: "", size: 48, font: "cursive" },
  },
};
export const pdfExport = {
  submitButtonLabel: "Export to PDF",
  tabs: [
    {
      title: "tab.exportGeneral",
      layout: [
        // {
        //   component: "FormColumns",
        //   fields: ["PageOutput", "PageSize", "Orientation", "OutputIso"],
        // },
        // {
        //   component: "FieldSet",
        //   title: "coloring",
        //   layout: [
        //     {
        //       component: "FormColumns",
        //       fields: ["ColorConversion", "ApplyLineWeights", "null", "ForceThinLines"],
        //     },
        //   ],
        // },
        {
          component: "FieldSet",
          title: "markup",
          toggle: "includeMarkups",
          layout: [
            {
              component: "FormColumns",
              fields: ["BurninMarkups", "MarkupsAsComments"],
            },
          ],
        },
      ],
    },
    // {
    //   title: "tab.exportSecurity",
    //   layout: [
    //     {
    //       component: "FormSection",
    //       fields: ["SecurityPassword", "PermissionsPassword"],
    //     },
    //   ],
    // },
    // {
    //   title: "tab.exportBannerWatermark",
    //   layout: [{ component: "BannerWatermark" }],
    // },
    {
      title: "tab.exportAction",
      layout: [{ component: "FormSection", fields: ["SuccessAction"] }],
    },
  ],
};
export const markupTools = [
  {
    title: "Tools",
    tools: [{ label: "select markup", tool: "select", icon: "Select" }],
  },
  {
    title: "toolPalette.annotations",
    tools: [
      { label: "text", tool: "text", icon: "Text", props: {} },
      { label: "arrow", tool: "arrow", icon: "Arrow", props: {} },
      { label: "ellipse", tool: "ellipse", icon: "Ellipse", props: {} },
      { label: "arc", tool: "arc", icon: "Arc", props: {} },
      {
        label: "scratchout",
        tool: "scratchout",
        icon: "Scratchout",
        props: {},
      },
      {
        label: "cloudRectangle",
        tool: "cloudRectangle",
        icon: "CloudRectangle",
        props: {},
      },
      {
        label: "cloudPolygon",
        tool: "cloudPolygon",
        icon: "CloudPolygon",
        props: {},
      },
      { label: "openSketch", tool: "openSketch", icon: "OpenSketch" },
      { label: "closedSketch", tool: "closedSketch", icon: "ClosedSketch" },
      { label: "line", tool: "line", icon: "Line", props: {} },
      {
        label: "polyline",
        tool: "polyline",
        icon: "Polyline",
        props: { closed: false },
      },
      { label: "crossout", tool: "crossout", icon: "Crossout", props: {} },
      { label: "rectangle", tool: "rectangle", icon: "Rectangle", props: {} },
      {
        label: "polygon",
        tool: "polygon",
        icon: "Polygon",
        props: { closed: true },
      },
      { label: "highlight", tool: "highlight", icon: "Highlight" },
      {
        label: "roundedRectangle",
        tool: "roundedRectangle",
        icon: "RoundedRectangle",
      },
      {
        label: "changemark",
        tool: "changemark",
        icon: "Changemark",
        props: { fill: "#f05822dd" },
      },
    ],
  },
];
export const tabContainerWithMarkups = {
  sidebarName: "tabContainerWithMarkups",
  primary: "primary",
  tabs: [
    { component: "ThumbnailPane", title: "tab.thumbnails" },
    { component: "MarkupPane", title: "tab.tools", layoutKey: "markupTools" },
    { component: "MarkupDetails", title: "tab.markups" },
    { component: "SearchResultsPane", title: "tab.searchResults" },
  ],
};
