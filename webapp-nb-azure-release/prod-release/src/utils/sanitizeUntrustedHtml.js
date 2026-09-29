import DOMPurify from "dompurify";

/**
 * Sanitizes untrusted HTML content from external document management systems
 * before rendering via dangerouslySetInnerHTML.
 */
export function sanitizeUntrustedHtml(inputHtml) {
  if (typeof inputHtml !== "string" || inputHtml.length === 0) {
    return "";
  }

  return DOMPurify.sanitize(inputHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "math"],
    FORBID_ATTR: ["style"],
  });
}

export default sanitizeUntrustedHtml;
