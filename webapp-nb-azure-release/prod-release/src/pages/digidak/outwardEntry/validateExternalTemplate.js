import * as XLSX from "xlsx";

export default async function validateExternalTemplate(
  file,
  templatePath = `${import.meta.env.VITE_BASE_PATH || ""}/templates/External_Bulk_Template.xlsx`,
  allowedFileNames = ["External_Template.xlsx", "External_Bulk_Template.xlsx"],
) {
  try {
    // 1. Extension check
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "xlsx") {
      return {
        valid: false,
        title: "Invalid File",
        message: "Please upload the official Excel (.xlsx) only.",
      };
    }

    // 2. Read uploaded file
    const uploadedArrayBuffer = await file.arrayBuffer();
    const uploadedWb = XLSX.read(new Uint8Array(uploadedArrayBuffer), { type: "array" });

    // 3. Fetch and read master template
    const res = await fetch(templatePath);
    if (!res.ok) {
      return {
        valid: false,
        title: "Validation Error",
        message: "Unable to fetch master template for validation.",
      };
    }

    const tplBuf = await res.arrayBuffer();
    const tplWb = XLSX.read(new Uint8Array(tplBuf), { type: "array" });

    /**
     * Helper to get all rows including empty cells
     */
    const getAllRows = (wb) => {
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // defval: "" ensures we get empty strings for empty cells instead of skipping them
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    };

    const uploadedRows = getAllRows(uploadedWb);
    const templateRows = getAllRows(tplWb);

    // 4. Locate the Header Row
    // We find the first row that actually has text content
    const headerIndex = uploadedRows.findIndex((row) => row.some((cell) => String(cell || "").trim() !== ""));

    if (headerIndex === -1) {
      return {
        valid: false,
        title: "Invalid Excel",
        message: "The uploaded file appears to be empty.",
      };
    }

    const uploadedHeader = uploadedRows[headerIndex].map((c) => String(c || "").trim());

    // Find template header (usually index 0, but we find it dynamically for safety)
    const tplHeaderRow = templateRows.find((row) => row.some((c) => String(c || "").trim() !== ""));
    const templateHeader = (tplHeaderRow || []).map((c) => String(c || "").trim());

    // 5. Strict Header Validation
    if (uploadedHeader.length !== templateHeader.length) {
      return { valid: false, title: "Invalid Excel", message: "Excel does not match the official template." };
    }

    const hasHeaderMismatch = templateHeader.some((expected, idx) => expected.toLowerCase() !== uploadedHeader[idx].toLowerCase());

    if (hasHeaderMismatch) {
      return { valid: false, title: "Invalid Excel", message: "Excel does not match the official template." };
    }

    // 6. CHECK FOR EMPTY DATA
    // We look at all rows AFTER the header row
    const dataRows = uploadedRows.slice(headerIndex + 1);

    // A row is "valid data" if at least one cell in it is not empty
    const hasActualData = dataRows.some((row) => row.some((cell) => String(cell || "").trim() !== ""));

    if (!hasActualData) {
      return {
        valid: false,
        title: "Empty Data",
        message: "No data records were found.",
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      title: "Validation Error",
      message: err?.message || "Unable to validate file.",
    };
  }
}
