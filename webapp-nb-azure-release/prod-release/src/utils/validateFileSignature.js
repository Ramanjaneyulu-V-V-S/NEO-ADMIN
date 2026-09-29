/**
 * Validates that a file's binary signature (magic bytes) matches its claimed extension.
 * Detects renamed files (e.g., a .java file renamed to .docx).
 *
 * @param {File} file - The File object from the input element
 * @returns {Promise<{ valid: boolean, message?: string }>}
 */

// Magic byte signatures for allowed document formats
// Each entry: { offset, bytes } — checked against the file header
const SIGNATURES = {
  // PDF: starts with %PDF
  pdf: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],

  // OOXML (.docx, .pptx, .xlsx) and legacy ZIP-based: starts with PK (ZIP)
  docx: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  pptx: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  xlsx: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],

  // Legacy OLE2 Compound Document (.doc, .ppt, .xls): starts with D0 CF 11 E0
  doc: [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
    // Some .doc files are actually OOXML renamed — also accept PK
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  ppt: [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  xls: [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],

  // Images
  png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }], // .PNG
  jpg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  jpeg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],

  // EML files start with common email headers
  // Note: .eml and .txt are plain-text formats — we skip signature validation
  // for them since any file can be valid plain text. They are excluded from SIGNATURES.
};

/**
 * Reads the first N bytes of a file.
 */
function readFileHeader(file, size = 8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file.slice(0, size));
  });
}

/**
 * Checks if the header bytes match any of the expected signatures.
 */
function matchesSignature(header, signatures) {
  return signatures.some(({ offset, bytes }) => bytes.every((byte, i) => header[offset + i] === byte));
}

/**
 * Validates file content against its extension.
 * @param {File} file
 * @returns {Promise<{ valid: boolean, message?: string }>}
 */
export async function validateFileSignature(file) {
  const ext = file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase();
  const expectedSignatures = SIGNATURES[ext];

  // If we don't have a signature for this extension, skip deep validation
  if (!expectedSignatures) {
    return { valid: true };
  }

  try {
    const header = await readFileHeader(file);

    // A very small file (< 4 bytes) cannot be a valid document
    if (header.length < 4) {
      return {
        valid: false,
        message: "The file appears to be corrupted or is not a valid document.",
      };
    }

    if (!matchesSignature(header, expectedSignatures)) {
      return {
        valid: false,
        message: `The file content does not match the .${ext} format. It may have been renamed from another file type.`,
      };
    }

    return { valid: true };
  } catch {
    // If we can't read the file, let the upload proceed — server will reject if invalid
    return { valid: true };
  }
}
