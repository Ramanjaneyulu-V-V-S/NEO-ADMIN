// API helpers for hyperlink interception and URL validation


import { log } from "../../../iframe/utils/logger";

const DANGEROUS_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "about:"];

const hasDangerousScheme = (trimmedUrl) =>
  DANGEROUS_SCHEMES.some((scheme) => trimmedUrl.toLowerCase().startsWith(scheme));

// Parse a URL or detect a relative path.
// Returns `{ urlObj, isRelative }` or `{ blocked: true }` when invalid.
const parseUrlOrRelative = (trimmedUrl) => {
  try {
    return { urlObj: new URL(trimmedUrl, globalThis.location.origin), isRelative: false };
  } catch {
    if (trimmedUrl.startsWith("/") || trimmedUrl.startsWith("./") || trimmedUrl.startsWith("../")) {
      return { isRelative: true };
    }
    return { blocked: true };
  }
};

const isAllowedExternalScheme = (urlObj) => {
  const scheme = urlObj.protocol.toLowerCase();
  return scheme === "http:" || scheme === "https:";
};

// Extract `{ publicationId, pageNumber }` from a link, or `null` when missing/invalid.
const getPublicationLinkParams = (urlObj, trimmedUrl) => {
  let search = "";
  if (urlObj) {
    search = urlObj.search;
  } else if (trimmedUrl.includes("?")) {
    search = trimmedUrl.split("?")[1];
  }
  const params = new URLSearchParams(search || "");
  const publicationId = params.get("pid") || params.get("publicationId") || params.get("publishing_id");
  const page = params.get("pageNumber") || params.get("page");
  let pageNumber = page ? Number.parseInt(page, 10) : null;
  if (pageNumber !== null && (Number.isNaN(pageNumber) || pageNumber < 1)) pageNumber = null;
  if (!publicationId || publicationId.length > 200) return null;
  return { publicationId, pageNumber };
};

let originalWindowOpen = null;

// Intercept window.open to route document links through viewer
export const setupHyperlinkInterceptor = () => {
  if (globalThis.__documentHyperlinkInterceptor) return;

  originalWindowOpen = globalThis.open;

  globalThis.open = function (url, target, features) {
    try {
      if (typeof url !== "string" || !url.trim()) {
        return originalWindowOpen.call(globalThis, url, target, features);
      }
      const trimmedUrl = url.trim();
      if (hasDangerousScheme(trimmedUrl)) {
        log.warn("[BravaApiHelpers] Blocked dangerous URL scheme", { url: trimmedUrl.substring(0, 100) });
        return null;
      }
      const parseResult = parseUrlOrRelative(trimmedUrl);
      if (parseResult.blocked) {
        log.warn("[BravaApiHelpers] Blocked invalid URL", { url: trimmedUrl.substring(0, 100) });
        return null;
      }
      const urlObj = parseResult.urlObj;
      const sameOrigin = urlObj ? urlObj.origin === globalThis.location.origin : parseResult.isRelative;
      if (!sameOrigin) {
        if (urlObj && !isAllowedExternalScheme(urlObj)) {
          log.warn("[BravaApiHelpers] Blocked non-HTTP(S) external URL", {
            url: trimmedUrl.substring(0, 100),
            scheme: urlObj.protocol,
          });
          return null;
        }
        return originalWindowOpen.call(globalThis, trimmedUrl, target, features);
      }
      const linkParams = getPublicationLinkParams(urlObj || { search: "" }, trimmedUrl);
      if (linkParams?.publicationId && linkParams.pageNumber != null) {
        return null;
      }
      return originalWindowOpen.call(globalThis, trimmedUrl, target, features);
    } catch (err) {
      log.error("[BravaApiHelpers] Hyperlink interceptor error", err);
    }
    return originalWindowOpen.call(globalThis, url, target, features);
  };

  try {
    // Use != per S3403; preserves reference comparison for Window objects.
    if (globalThis.parent != null && globalThis.parent != globalThis && typeof globalThis.parent.open === "function") {
      globalThis.parent.open = globalThis.open;
    }
  } catch (e) {
    log.warn("[BravaApiHelpers] Failed to attach interceptor to parent", e);
  }
  try {
    if (globalThis.top != null && globalThis.top != globalThis && typeof globalThis.top.open === "function") {
      globalThis.top.open = globalThis.open;
    }
  } catch (e) {
    log.warn("[BravaApiHelpers] Failed to attach interceptor to top", e);
  }

  globalThis.__documentHyperlinkInterceptor = true;
};
