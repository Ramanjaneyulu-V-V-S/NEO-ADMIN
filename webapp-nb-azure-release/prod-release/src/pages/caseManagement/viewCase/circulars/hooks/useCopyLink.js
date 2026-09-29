import { useState, useCallback } from "react";
import { usePublishIv } from "../../../../../hooks/usePublishIv";

export function useCopyLink({ onPublishingIdUpdate }) {
  const { publish: publishIv } = usePublishIv();
  const [copiedLinks, setCopiedLinks] = useState(new Set());
  const [errorMessages, setErrorMessages] = useState(new Map());
  const [copyLinkLoading, setCopyLinkLoading] = useState(new Map());

  const handleCopyLink = useCallback(
    async (dataItem) => {
      const circularId = dataItem.id;
      let publicationId = dataItem.publishing_id;

      if (copyLinkLoading.has(circularId)) return;

      setCopyLinkLoading((prev) => new Map(prev).set(circularId, true));
      setErrorMessages((prev) => {
        const m = new Map(prev);
        m.delete(circularId);
        return m;
      });

      try {
        if (!publicationId) {
          try {
            publicationId = await publishIv(String(circularId));
            if (publicationId) onPublishingIdUpdate(circularId, publicationId);
          } catch (err) {
            console.error("Republish failed for copy link:", err);
          }
          if (!publicationId) throw new Error("This document doesn't have a publishing ID");
        }

        const linkQuery = `?type=page&pid=${encodeURIComponent(publicationId)}&pageNumber=1`;
        const fullLink = `${window.location.protocol}//${window.location.host}${window.location.pathname}${linkQuery}`;

        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(fullLink);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = fullLink;
          textArea.style.cssText = "position:fixed;left:-999999px;top:-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (!ok) throw new Error("Copy command failed");
        }

        setCopiedLinks((prev) => new Set([...prev, circularId]));
        setTimeout(() => {
          setCopiedLinks((prev) => {
            const s = new Set(prev);
            s.delete(circularId);
            return s;
          });
        }, 3000);
      } catch (error) {
        const msg = error.message || "Failed to generate link";
        setErrorMessages((prev) => new Map(prev).set(circularId, msg));
        setTimeout(() => {
          setErrorMessages((prev) => {
            const m = new Map(prev);
            m.delete(circularId);
            return m;
          });
        }, 3000);
      } finally {
        setCopyLinkLoading((prev) => {
          const m = new Map(prev);
          m.delete(circularId);
          return m;
        });
      }
    },
    [copyLinkLoading, publishIv, onPublishingIdUpdate],
  );

  return { copiedLinks, errorMessages, copyLinkLoading, handleCopyLink };
}
