/**
 * PdfExportModal – PDF export options dialog for Brava viewer.
 *
 * Lets the user choose pages, size, orientation, color, layers, and watermark,
 * then calls onExport with the built options. Progress and errors are shown
 * via exportProgress and exportError; clearError dismisses the error.
 */
import React, { useState } from "react";
import { IoMdClose } from "react-icons/io";
import "./PdfExportModal.css";

/**
 * @param {Object} props
 * @param {boolean} [props.isOpen] - Whether the modal is visible
 * @param {function} [props.onClose] - Called when the modal should close
 * @param {function} [props.onExport] - Called with pdf options when user confirms export
 * @param {boolean} [props.isExporting] - Whether an export is in progress
 * @param {string|number} [props.exportProgress] - Progress message or value
 * @param {string} [props.exportError] - Error message to display
 * @param {function} [props.clearError] - Called to clear the export error
 */
const PdfExportModal = ({ isOpen, onClose, onExport, isExporting, exportProgress, exportError, clearError }) => {
  /** Form state: pages, size, orientation, color, layers, watermark, page range. */
  const [exportOptions, setExportOptions] = useState({
    pagesToExport: "all",
    pageSizeName: "",
    rotateToOrientation: "original",
    colorConversion: "original",
    includeLayers: "all",
    isoConformance: "none",
    includeWatermark: true,
    watermarkText: "SEDIN",
    pageRange: "",
  });

  const handleOptionChange = (key, value) => {
    setExportOptions((prev) => ({ ...prev, [key]: value }));
  };

  /** Build pdf options from form state and call onExport (includes watermark banner when enabled). */
  const handleExport = () => {
    const pdfOptions = {
      pagesToExport: exportOptions.pagesToExport,
      pageSizeName: exportOptions.pageSizeName,
      rotateToOrientation: exportOptions.rotateToOrientation,
      colorConversion: exportOptions.colorConversion,
      includeLayers: exportOptions.includeLayers,
      isoConformance: exportOptions.isoConformance,
      successAction: "download",
      markupBurnin: "burn",
      banner: {
        Watermark: {
          disabled: !exportOptions.includeWatermark,
          text: exportOptions.watermarkText,
          size: 72,
          font: "monospace",
          opacity: 0.25,
          color: "#FF0000",
          italic: true,
          bold: true,
          underline: true,
        },
      },
    };
    if (exportOptions.pagesToExport === "range" && exportOptions.pageRange) {
      pdfOptions.pageRange = exportOptions.pageRange;
    }

    onExport(pdfOptions);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay pdf-export-overlay"
    >
      <div
        className="modal-content bg-white rounded p-4 pdf-export-modal-content"
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Export to PDF</h5>
          <button onClick={onClose} disabled={isExporting} className="btn btn-outline-secondary">
            <IoMdClose size={16} />
          </button>
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="pdf-export-pages">
              Pages to Export:
            </label>
            <select
              id="pdf-export-pages"
              className="form-select form-select-sm"
              value={exportOptions.pagesToExport}
              onChange={(e) => handleOptionChange("pagesToExport", e.target.value)}
              disabled={isExporting}
            >
              <option value="all">All Pages</option>
              <option value="current">Current Page</option>
              <option value="markup">Pages with Markup</option>
              <option value="range">Page Range</option>
            </select>
          </div>

          {/* Page Range (if range is selected) */}
          {exportOptions.pagesToExport === "range" && (
            <div className="col-md-6 mb-3">
              <label className="form-label" htmlFor="pdf-export-range">
                Page Range:
              </label>
              <input
                id="pdf-export-range"
                type="text"
                className="form-control form-control-sm"
                value={exportOptions.pageRange}
                onChange={(e) => handleOptionChange("pageRange", e.target.value)}
                placeholder="e.g., 1-5, 8, 10-12"
                disabled={isExporting}
              />
            </div>
          )}
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="pdf-export-size">
              Page Size:
            </label>
            <select
              id="pdf-export-size"
              className="form-select form-select-sm"
              value={exportOptions.pageSizeName}
              onChange={(e) => handleOptionChange("pageSizeName", e.target.value)}
              disabled={isExporting}
            >
              <option value="">Default</option>
              <option value="Letter">Letter (8.5&quot; x 11&quot;)</option>
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="Legal">Legal (8.5&quot; x 14&quot;)</option>
              <option value="A3">A3 (297 x 420 mm)</option>
              <option value="Tabloid">Tabloid (11&quot; x 17&quot;)</option>
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="pdf-export-orientation">
              Orientation:
            </label>
            <select
              id="pdf-export-orientation"
              className="form-select form-select-sm"
              value={exportOptions.rotateToOrientation}
              onChange={(e) => handleOptionChange("rotateToOrientation", e.target.value)}
              disabled={isExporting}
            >
              <option value="original">Original</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          {/* Color Conversion */}
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="pdf-export-color">
              Color Conversion:
            </label>
            <select
              id="pdf-export-color"
              className="form-select form-select-sm"
              value={exportOptions.colorConversion}
              onChange={(e) => handleOptionChange("colorConversion", e.target.value)}
              disabled={isExporting}
            >
              <option value="original">Original</option>
              <option value="convertMonochrome">Monochrome</option>
              <option value="convertGrayscale">Grayscale</option>
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label" htmlFor="pdf-export-layers">
              Include Layers:
            </label>
            <select
              id="pdf-export-layers"
              className="form-select form-select-sm"
              value={exportOptions.includeLayers}
              onChange={(e) => handleOptionChange("includeLayers", e.target.value)}
              disabled={isExporting}
            >
              <option value="all">All Layers</option>
              <option value="visible">Visible Only</option>
              <option value="none">No Layers</option>
            </select>
          </div>
          <div className="col-12 mb-3">
            <div className="form-check">
              <input
                id="pdf-export-watermark"
                className="form-check-input"
                type="checkbox"
                checked={exportOptions.includeWatermark}
                onChange={(e) => handleOptionChange("includeWatermark", e.target.checked)}
                disabled={isExporting}
              />
              <label className="form-check-label" htmlFor="pdf-export-watermark">
                Include Watermark
              </label>
            </div>
            {exportOptions.includeWatermark && (
              <input
                id="pdf-export-watermark-text"
                type="text"
                className="form-control form-control-sm mt-2"
                value={exportOptions.watermarkText}
                onChange={(e) => handleOptionChange("watermarkText", e.target.value)}
                placeholder="Watermark text"
                disabled={isExporting}
              />
            )}
          </div>
        </div>

        {exportProgress && (
          <div className="alert alert-info py-2 mb-3">
            <small>{exportProgress}</small>
          </div>
        )}

        {exportError && (
          <div className="alert alert-danger py-2 mb-3">
            <small>{exportError}</small>
            <button onClick={clearError} className="btn btn-outline-danger ms-2">
              Dismiss
            </button>
          </div>
        )}

        <div className="d-flex justify-content-end gap-2">
          <button onClick={onClose} disabled={isExporting} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleExport} disabled={isExporting} className="btn btn-primary">
            {isExporting ? "Exporting..." : "Export & Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfExportModal;
