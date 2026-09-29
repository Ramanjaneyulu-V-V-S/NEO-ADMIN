import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

//components
import ActionButton from "../../../../components/actionButton/ActionButton";

//react icons
import { FaDownload } from "react-icons/fa6";
import { CgDetailsMore } from "react-icons/cg";
import { FaCloudUploadAlt } from "react-icons/fa";
import { MdAutoDelete, MdCompare, MdOutlineMoveDown } from "react-icons/md";

//kendo component
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";

//utils
import { formatDateCellWithSec } from "../../../../utils/Utils";
import JSZip from "jszip";

//sweet alert
import Swal from "sweetalert2";
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";
import { validateFileSignature } from "../../../../utils/validateFileSignature";

//redux
import { useDispatch, useSelector } from "react-redux";
import { documentService } from "../../../../services/caseManagement/documents/documentsService";
import { fetchDraftDocuments, fetchSupportingDocuments, deleteDocument, fetchFinalDocuments } from "../../../../redux/caseManagement/documents/documentSlice";

//hooks
import { usePublishIv } from "../../../../hooks/usePublishIv";

//brava config and token manager
import bravaconfig from "../../../../components/iv/bravaconfig";
import { ivTokenManager } from "../../../../services/iv/tokenManager";

const DocumentTable = ({
  splitView,
  screenName,
  isAcquired,
  caseStatus,
  ivTitleName,
  tabInfoView,
  caseDetailsData,
  isSameWorkflowUser,
  isInitiateWorkflow,
  onPublicationIdSelect = () => {},
  isOldCase,
}) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const fileReuploadRef = useRef(null);

  const hasRenderedIV = useRef(false); // Simple flag to track if IV rendering has been attempted

  const { supportingDocs, draftDocs, finalDocs } = useSelector((state) => state.documents);
  const { userProfile } = useSelector((state) => state?.login);
  const { object_name, r_object_id } = caseDetailsData || {};
  const folderPath = isOldCase ? `/CMS Legacy/${object_name || ""}` : `/Case/${object_name || ""}`;

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadAllState, setDownloadAllState] = useState({ active: false, current: 0, total: 0, currentName: "" });
  const [reuploadDocId, setReuploadDocId] = useState(null); // Store docId for reupload

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [isPublishingForView, setIsPublishingForView] = useState(false);

  const { publish: publishIv } = usePublishIv();

  // Consolidated refresh: fetches documents based on current tab
  const refreshDocuments = async ({ unwrap = false } = {}) => {
    if (tabInfoView === "drafts") {
      const fetches = [dispatch(fetchDraftDocuments({ input_category: "Draft", input_folder_path: folderPath }))];
      if (caseStatus === "Approved" || caseStatus === "Closed" || isOldCase) {
        fetches.push(dispatch(fetchFinalDocuments({ input_category: "Final", input_folder_path: folderPath })));
      }
      await Promise.all(unwrap ? fetches.map((f) => f.unwrap()) : fetches);
    } else {
      const action = dispatch(fetchSupportingDocuments({ input_category: "Supporting", input_folder_path: folderPath }));
      await (unwrap ? action.unwrap() : action);
    }
  };

  const checkPublicationStatus = async (publicationId) => {
    try {
      const token = await ivTokenManager.getToken();
      const response = await fetch(`${bravaconfig.publicationAuthority}/publication/api/v1/publications/${publicationId}?embed=page_links`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return { status: "error", message: `API response not ok: ${response.status}` };
      }

      const details = await response.json();
      const status = details.status?.toLowerCase();

      if (status === "complete") {
        return { status: "complete", message: "Publication is ready" };
      } else if (["failed", "error"].includes(status)) {
        return { status: "failed", message: `Publication failed: ${details.failureMessage || details.error || "Unknown error"}` };
      } else if (["pending", "active", "processing"].includes(status)) {
        return { status: "processing", message: `Publication is ${status}, checking again in 5 seconds...` };
      } else {
        return { status: "unknown", message: `Unknown status: ${status}` };
      }
    } catch (error) {
      // Error checking publication status handled silently
      return { status: "error", message: `Error: ${error.message}` };
    }
  };

  const handlePublishIv = async (docId) => {
    try {
      const publicationId = await publishIv(docId);
      if (publicationId) await checkPublicationStatus(publicationId);
      return publicationId;
    } catch (error) {
      console.error(error);
    }
  };

  // Split View: open with existing publication, or publish document then open
  const handleSplitViewClick = async (doc) => {
    const publicationId = doc?.content?.properties?.iv_id;
    if (publicationId) {
      if (onPublicationIdSelect && typeof onPublicationIdSelect === "function") {
        onPublicationIdSelect(publicationId);
      }
      splitView(publicationId);
      ivTitleName(doc.title);
      return;
    }
    const docId = doc?.content?.properties?.id;
    if (!docId) {
      showSweetAlert({
        title: "Error",
        text: "Document ID is missing. Cannot publish for viewing.",
        icon: "error",
      });
      return;
    }
    setIsPublishingForView(true);
    let newPublicationId;
    try {
      newPublicationId = await handlePublishIv(docId);
    } catch (err) {
      showSweetAlert({
        title: "Publish Failed",
        text: err?.message || "Could not publish the document. Please try again.",
        icon: "error",
      });
      setIsPublishingForView(false);
      return;
    } finally {
      setIsPublishingForView(false);
    }
    if (newPublicationId) {
      if (onPublicationIdSelect && typeof onPublicationIdSelect === "function") {
        onPublicationIdSelect(newPublicationId);
      }
      splitView(newPublicationId);
      ivTitleName(doc.title);
      try {
        await refreshDocuments();
      } catch (err) {
        console.error("Failed to refresh document list:", err);
      }
    } else {
      showSweetAlert({
        title: "Publish Failed",
        text: "Could not publish the document for viewing. Please try again.",
        icon: "error",
      });
    }
  };

  // For drafts tab, we'll show both draft and final documents (final only when approved)
  const documents = tabInfoView === "drafts" ? (Array.isArray(draftDocs) ? draftDocs : []) : Array.isArray(supportingDocs) ? supportingDocs : [];
  const showBothSections = tabInfoView === "drafts";

  const safeDraftDocs = Array.isArray(draftDocs) ? draftDocs : [];
  const safeFinalDocs = Array.isArray(finalDocs) ? finalDocs : [];

  const allDraftFinalDoc = caseStatus === "Approved" || caseStatus === "Closed" || isOldCase ? [...safeDraftDocs, ...safeFinalDocs] : [...safeDraftDocs];

  // Draft Documents tab — split CURRENT versions from earlier ones.
  const isCurrentVersion = (doc) => {
    const v = doc?.content?.properties?.r_version_label;
    return Array.isArray(v) ? v.includes("CURRENT") : v === "CURRENT";
  };
  const latestDraftDocs = safeDraftDocs.filter(isCurrentVersion);
  const earlierDraftDocs = safeDraftDocs.filter((d) => !isCurrentVersion(d));
  const showFinalsSection = (caseStatus === "Approved" || caseStatus === "Closed" || isOldCase) && safeFinalDocs.length > 0;

  const truncateFileName = (title, maxLength = 30) => {
    if (!title) return "";
    const lastDotIndex = title.lastIndexOf(".");
    const name = lastDotIndex !== -1 ? title.substring(0, lastDotIndex) : title;
    const ext = lastDotIndex !== -1 ? title.substring(lastDotIndex) : "";
    return (name?.length > maxLength ? name.substring(0, maxLength) + "..." : name) + ext;
  };

  const handleFileDetails = (document) => {
    setSelectedDocument(document);
    setShowFileDetails((prev) => !prev);
  };

  const handleFileSelection = async (event, isReupload = false, docId = null) => {
    // For reupload, use the stored docId if provided, otherwise use the passed docId
    const actualDocId = isReupload && reuploadDocId ? reuploadDocId : docId;

    const files = Array.from(event.target.files || []);
    if (!files.length || !caseDetailsData) return;

    // Per-tab upload cap. Reupload swaps an existing doc and doesn't change the
    // count, so it's exempt. Matches the API's items-per-page=75 page size so
    // the user can never have a list that doesn't all fit on one fetch.
    const MAX_DOCUMENTS = 75;
    if (!isReupload) {
      const currentCount = Array.isArray(documents) ? documents.length : 0;
      if (currentCount + files.length > MAX_DOCUMENTS) {
        const remaining = Math.max(0, MAX_DOCUMENTS - currentCount);
        showSweetAlert({
          icon: "warning",
          title: "Upload limit reached",
          text:
            remaining > 0
              ? `You can have up to ${MAX_DOCUMENTS} documents in this section. You already have ${currentCount}; only ${remaining} more can be uploaded.`
              : `You already have ${currentCount} documents. Maximum of ${MAX_DOCUMENTS} reached — delete some before uploading more.`,
        });
        event.target.value = "";
        return;
      }
    }

    if (isUploading) {
      showSweetAlert({
        icon: "warning",
        title: "Upload in Progress",
        text: "Please wait for the current upload to complete.",
      });
      event.target.value = "";
      return;
    }

    const allowedExtensions =
      tabInfoView === "drafts"
        ? [".doc", ".docx", ".xls", ".xlsx", ".txt", ".ppt", ".pptx"]
        : [".doc", ".docx", ".pdf", ".xls", ".xlsx", ".txt", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".eml"];

    const MAX_FILE_SIZE = 50 * 1024 * 1024;

    setIsUploading(true);

    try {
      for (const file of files) {
        const lastDotIndex = file.name.lastIndexOf(".");
        const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex).toLowerCase() : "";

        // Validate extension
        if (!allowedExtensions.includes(ext)) {
          showSweetAlert({
            icon: "error",
            title: "Invalid File Format",
            text: `${file.name} has an invalid format.`,
          });
          continue;
        }

        // Validate file content matches its extension (detect renamed files)
        const signatureResult = await validateFileSignature(file);
        if (!signatureResult.valid) {
          showSweetAlert({
            icon: "error",
            title: "Invalid File Content",
            text: `${file.name}: ${signatureResult.message}`,
          });
          continue;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
          showSweetAlert({
            icon: "error",
            title: "File Too Large",
            text: `${file.name} exceeds 50MB limit.`,
          });
          continue;
        }

        // Upload single file
        if (isReupload) {
          if (!actualDocId) {
            showSweetAlert({
              icon: "error",
              title: "Error",
              text: "Document ID is missing. Please try again.",
            });
            continue;
          }
          await handleImportVersion(file, actualDocId);
        } else {
          const isDraft = tabInfoView === "drafts";
          await handleSingleDocumentUpload(file, isDraft);
        }
      }

      await refreshDocuments({ unwrap: true });
    } catch (error) {
      showSweetAlert({
        title: "Upload Failed",
        text: error.message || "Some files could not be uploaded.",
        icon: "error",
      });
    } finally {
      setIsUploading(false);
      setReuploadDocId(null); // Clear the stored docId after upload
      event.target.value = "";
    }
  };

  const handleSingleDocumentUpload = async (file, isDraft) => {
    try {
      const uploadRes = await documentService.getFilePath(file);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;

      if (!fileSrc) {
        throw new Error("File upload failed");
      }

      const uploadPayload = {
        properties: {
          a_content_type: "msw12",
          case_number: object_name,
          r_object_type: "cms_supporting_document",
          object_name: file.name,
          folder_id: r_object_id,
          category: isDraft ? "Draft" : "Supporting",
        },
        type: "cms_supporting_document",
        source: fileSrc,
      };

      const docRes = await documentService.uploadDocument(uploadPayload);

      if (docRes?.properties?.object_name) {
        const uploadedDocId = docRes?.properties?.r_object_id;
        await handlePublishIv(uploadedDocId);
      } else {
        throw new Error(docRes?.message || "Upload failed");
      }
    } catch (error) {
      showSweetAlert({
        title: "Upload Failed",
        text: error.message || "Failed to upload file. Please try again.",
        icon: "error",
      });
    }
  };

  // Drag and Drop Event Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items?.length > 0) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleFileSelection({ target: { files } }); // pass all files
    }
  };

  const handleImportVersion = async (file, docId) => {
    setIsUploading(true);

    try {
      const uploadRes = await documentService.getFilePath(file);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;

      if (!fileSrc) throw new Error("File upload failed");

      const uploadPayload = {
        properties: {
          r_version_label: ["CURRENT"],
          r_object_type: "cms_supporting_document",
          "retain-lock": "false",
          checkin_version: 0,
          checkin_label: "",
        },
        type: "cms_supporting_document",
        source: fileSrc,
      };

      const docRes = await documentService.addVersionDraftDoc(docId, uploadPayload);

      if (docRes?.properties?.object_name) {
        const versionedDocId = docRes?.properties?.r_object_id;

        // Publish IV for the document
        await handlePublishIv(versionedDocId);

        await refreshDocuments({ unwrap: true });

        showSweetAlert({
          title: "Success",
          text: "New version uploaded successfully!",
          icon: "success",
        });
      } else {
        throw new Error(docRes?.message || "Version upload failed");
      }
    } catch (error) {
      showSweetAlert({
        title: "Upload Failed",
        text: error.message || "Failed to upload new version. Please try again.",
        icon: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deletePublication = async (publicationId) => {
    try {
      if (!publicationId) return;

      const token = await ivTokenManager.getToken();
      await fetch(`${bravaconfig.publicationAuthority}/publication/api/v1/publications/${publicationId}?embed=page_links`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error(error);
    }
  };

  const onHandleDelete = async (document) => {
    await Swal.fire({
      title: "Delete Doc",
      html: `Are you sure you want to delete <strong>${document.object_name}</strong>?`,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "No",
      confirmButtonText: "Yes",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
      preConfirm: async () => {
        try {
          Swal.showLoading(); // Spinner inside "Yes" button

          const payload = {
            "run-stateless": "true",
            data: {
              variables: {
                inp_object_type: "cms_supporting_document",
                inp_object_id: document?.id,
              },
            },
          };

          // Delete document from Documentum first
          await dispatch(deleteDocument(payload)).unwrap();

          // Only delete publication if document deletion was successful
          if (document?.iv_id) {
            await deletePublication(document.iv_id);
          }

          await refreshDocuments({ unwrap: true });
        } catch (error) {
          Swal.hideLoading();
          showSweetAlert({
            title: "Error",
            text: error.message || "Failed to delete the document.",
            icon: "error",
          });
        }
      },
    });
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const docId = doc?.content?.properties?.id;
      const docName = doc?.content?.properties?.object_name;

      if (!docId || !docName) {
        showSweetAlert({
          title: "Error",
          text: "Document information is missing.",
          icon: "error",
        });
        return;
      }

      const blob = await documentService.downloadDocument(docId);

      // Empty / wrong-type body means the server didn't return a real file.
      if (!blob || blob.size === 0) {
        showSweetAlert({
          title: "Empty Response",
          text: `The server returned no content for ${docName}. The file may be missing on the backend.`,
          icon: "warning",
        });
        return;
      }
      // If the server returned a JSON error masquerading as 200, surface it.
      if (blob.type && blob.type.includes("application/json")) {
        const text = await blob.text();
        console.error(`[download] ${docName} got JSON instead of binary:`, text);
        showSweetAlert({
          title: "Download Failed",
          text: "The server returned an error instead of the file. See console for details.",
          icon: "error",
        });
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", docName);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      // Defer cleanup so the browser has a tick to start writing the file.
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("[download] failed", error);
      showSweetAlert({
        title: "Download Failed",
        text: error.message || "Failed to download document. Please try again.",
        icon: "error",
      });
    }
  };

  const handleMoveToFinal = async (doc) => {
    await Swal.fire({
      title: "Move to Final",
      html: `Are you sure you want to move <strong>${doc.content.properties.object_name}</strong> to Final?`,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "No",
      confirmButtonText: "Yes",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
      preConfirm: async () => {
        try {
          Swal.showLoading(); // show spinner inside "Yes" button

          await documentService.moveToFinalDocument({
            "run-stateless": "true",
            data: {
              variables: {
                in_category: "Final",
                in_r_object_id: [doc.content.properties.id],
              },
            },
          });

          await refreshDocuments({ unwrap: true });
        } catch (error) {
          Swal.showValidationMessage(`Error: ${error}`);
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    const fetchDocs = async () => {
      if (!caseDetailsData?.object_name) return;
      setIsLoading(true);

      try {
        await refreshDocuments({ unwrap: true });
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabInfoView, caseDetailsData?.object_name, caseStatus, dispatch]);

  // Reset IV rendering flag when case changes
  useEffect(() => {
    hasRenderedIV.current = false;
  }, [object_name]);

  // Auto-render IV for documents missing iv_id (for resubmitted cases)
  useEffect(() => {
    // Guard conditions: must have docs, not be uploading, not already processed
    if (!object_name || isUploading || hasRenderedIV.current) {
      return;
    }

    // For drafts tab, check draft and final documents (final only if approved)
    const docsToCheck =
      tabInfoView === "drafts"
        ? [...(Array.isArray(draftDocs) ? draftDocs : []), ...((caseStatus === "Approved" || isOldCase) && Array.isArray(finalDocs) ? finalDocs : [])]
        : documents;

    if (!docsToCheck?.length) {
      return;
    }

    // Find documents that need IV rendering
    const docsNeedingIV = docsToCheck
      .filter((doc) => {
        const docId = doc?.content?.properties?.id;
        const hasIvId = doc?.content?.properties?.iv_id;
        return docId && !hasIvId;
      })
      .map((doc) => doc?.content?.properties?.id)
      .filter((docId, index, self) => self.indexOf(docId) === index); // Remove duplicates

    // If no documents need IV, mark as done and return
    if (docsNeedingIV.length === 0) {
      hasRenderedIV.current = true;
      return;
    }

    // Mark as processing to prevent duplicate runs
    hasRenderedIV.current = true;

    // Publish IV for all documents in parallel
    const publishAllIVs = async () => {
      try {
        const publishPromises = docsNeedingIV.map((docId) => handlePublishIv(docId));

        // Wait for all publish requests to complete (even if some fail)
        await Promise.allSettled(publishPromises);

        setTimeout(() => {
          refreshDocuments({ unwrap: true }).catch((error) => console.error("Failed to refresh documents:", error));
        }, 2000);
      } catch (error) {
        console.error(error);
        hasRenderedIV.current = false;
      }
    };

    publishAllIVs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, draftDocs, finalDocs, tabInfoView, object_name, isUploading, dispatch, caseStatus]);

  // Bundle every document into a single ZIP and download once. Triggering N
  // separate `link.click()` downloads in parallel hits the browser's
  // concurrent-download cap (~10 in Chrome) and silently drops the rest, which
  // is why "Download All" only delivered the first few files for 64 docs.
  const handleDownloadAllDocuments = async (documents) => {
    if (!Array.isArray(documents) || documents.length === 0) return;

    const total = documents.length;
    const zip = new JSZip();
    const failed = [];
    // De-dup file names that appear more than once in the same list.
    const usedNames = new Map();
    const uniqueName = (name) => {
      const base = name || "document";
      const seen = usedNames.get(base) || 0;
      usedNames.set(base, seen + 1);
      if (seen === 0) return base;
      const dot = base.lastIndexOf(".");
      return dot > 0 ? `${base.slice(0, dot)} (${seen})${base.slice(dot)}` : `${base} (${seen})`;
    };

    setDownloadAllState({ active: true, current: 0, total, currentName: "" });

    try {
      for (let i = 0; i < total; i++) {
        const doc = documents[i];
        const docId = doc?.content?.properties?.id;
        const name = doc?.content?.properties?.object_name || `document-${i + 1}`;
        setDownloadAllState((s) => ({ ...s, current: i, currentName: name }));

        if (!docId) {
          failed.push(name);
          continue;
        }
        try {
          const blob = await documentService.downloadDocument(docId);
          // Convert to ArrayBuffer — JSZip's Blob path is async-internally and has
          // surprised us with empty entries when the source blob lacked a MIME type.
          // ArrayBuffer is the canonical, fully-synchronous input.
          const buf = await blob.arrayBuffer();
          if (!buf || buf.byteLength === 0) {
            console.warn(`[downloadAll] ${name} returned 0 bytes — skipping`);
            failed.push(name);
            continue;
          }
          zip.file(uniqueName(name), buf);
        } catch (err) {
          console.error(`[downloadAll] Failed to fetch ${name}`, err);
          failed.push(name);
        }
      }

      // If every fetch failed we won't have anything to package — bail with a clear error.
      const added = total - failed.length;
      if (added === 0) {
        throw new Error(`All ${total} document(s) failed to download. Check the console for details.`);
      }

      setDownloadAllState((s) => ({ ...s, current: total, currentName: "Packaging…" }));
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

      if (!zipBlob || zipBlob.size === 0) {
        throw new Error("Packaged ZIP is empty. The documents could not be bundled.");
      }
      console.info(`[downloadAll] Packaged ${added}/${total} files into ${(zipBlob.size / 1024).toFixed(1)} kB ZIP`);

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `documents-${Date.now()}.zip`);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      // Defer cleanup so the browser has a tick to start the download before the
      // anchor and ObjectURL are torn down.
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 1000);

      if (failed.length) {
        showSweetAlert({
          title: "Some documents could not be downloaded",
          text: `${failed.length} of ${total} files failed: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`,
          icon: "warning",
        });
      }
    } catch (error) {
      console.error(error);
      showSweetAlert({
        title: "Download Failed",
        text: error.message || "Failed to package documents. Please try again.",
        icon: "error",
      });
    } finally {
      setDownloadAllState({ active: false, current: 0, total: 0, currentName: "" });
    }
  };

  // Render document table section. `docsList` defaults to the full draft+final
  // collection for backward compatibility; pass an explicit list (latest /
  // earlier / finals) to render a sub-grouped section.
  const renderDocumentSection = (sectionType, showVersion = false, docsList = allDraftFinalDoc) => {
    return (
      <div key={sectionType} className="mb-1">
        <div className={isAcquired !== 0 || isInitiateWorkflow === false ? "table document-table document-table-in-active" : "document-table document-table-active"}>
          <table className="table">
            <thead>
              <tr className="case-info-table-row">
                <th>#</th>
                <th>File Name</th>
                <th>Version</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {docsList?.map((doc, index) => (
                <tr key={doc?.id || index} className="case-info-table-row">
                  <td>{index + 1}</td>
                  <td title={doc.title}>{truncateFileName(doc.title, showVersion ? 20 : 30)}</td>

                  {doc?.content?.properties?.category === "Draft" ? (
                    <td>
                      {Array.isArray(doc?.content?.properties?.r_version_label) ? doc.content.properties.r_version_label.join(" ") : doc?.content?.properties?.r_version_label}
                    </td>
                  ) : (
                    <td>
                      <p className="final-doc-text">Final Document</p>
                    </td>
                  )}

                  <td className="text-end">
                    {doc?.content?.properties?.category === "Draft" && (
                      <>
                        {(Array.isArray(doc?.content?.properties?.r_version_label)
                          ? doc.content.properties.r_version_label.includes("CURRENT")
                          : doc?.content?.properties?.r_version_label === "CURRENT") && (
                          <>
                            <input
                              type="file"
                              ref={fileReuploadRef}
                              className="d-none"
                              onChange={(e) => {
                                handleFileSelection(e, true, reuploadDocId || doc?.content?.properties?.id);
                              }}
                            />
                            {/* {isAcquired !== 0 && ( */}
                            {((screenName === "inboxScreen" && isAcquired !== 0) || (caseStatus === "Draft" && isSameWorkflowUser)) && (
                              <ActionButton
                                icon={FaCloudUploadAlt}
                                tooltip="Import New"
                                onClick={() => {
                                  setReuploadDocId(doc?.content?.properties?.id); // Store docId before triggering file input
                                  fileReuploadRef.current.click();
                                }}
                              />
                            )}
                          </>
                        )}
                      </>
                    )}

                    <ActionButton icon={MdCompare} tooltip="Split View" onClick={() => handleSplitViewClick(doc)} />
                    <ActionButton icon={CgDetailsMore} tooltip="File Details" onClick={() => handleFileDetails(doc)} />
                    <ActionButton icon={FaDownload} tooltip="Download" onClick={() => handleDownloadDocument(doc)} />

                    {doc?.content?.properties?.category === "Draft" && (
                      <>
                        {screenName === "inboxScreen" && isAcquired !== 0 && caseStatus === "Approved" && (
                          <ActionButton icon={MdOutlineMoveDown} tooltip="Move to Final" onClick={() => handleMoveToFinal(doc)} />
                        )}

                        {screenName === "inboxScreen" &&
                        isAcquired !== 0 &&
                        doc?.content?.properties?.r_creator_name === userProfile?.properties?.object_name &&
                        caseStatus !== "Approved" ? (
                          <ActionButton icon={MdAutoDelete} tooltip="Delete" onClick={() => onHandleDelete(doc?.content?.properties)} />
                        ) : (
                          <>{caseStatus === "Draft" && <ActionButton icon={MdAutoDelete} tooltip="Delete" onClick={() => onHandleDelete(doc?.content?.properties)} />}</>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      {(isLoading || isUploading || isPublishingForView) && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      {downloadAllState.active &&
        (() => {
          const pct = downloadAllState.total > 0 ? Math.round((downloadAllState.current / downloadAllState.total) * 100) : 0;
          // Portal to body so the overlay escapes any ancestor with transform/filter,
          // which would otherwise constrain `position: fixed` to that ancestor's box.
          return createPortal(
            <div
              role="status"
              aria-live="polite"
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}
            >
              <div style={{ background: "#fff", borderRadius: 8, padding: "20px 24px", minWidth: 320, maxWidth: 420, boxShadow: "0 6px 24px rgba(0,0,0,0.2)" }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Preparing download… {pct}%</div>
                <div
                  style={{ fontSize: 12, color: "#555", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  title={downloadAllState.currentName}
                >
                  {downloadAllState.current} of {downloadAllState.total} · {downloadAllState.currentName || "—"}
                </div>
                <div style={{ height: 8, background: "#eef0f3", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#0d6efd", transition: "width 120ms ease" }} />
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      <div className={`table-container ${showBothSections ? "table-container-scrollable" : ""}`}>
        {showBothSections ? (
          // Show both Draft and Final sections when tabInfoView is "drafts"
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <p className="table-title mb-0">Documents</p>
              <div>
                <input type="file" ref={fileInputRef} className="d-none" onChange={(e) => handleFileSelection(e, false)} multiple />

                {screenName !== "referenceScreen" && !isOldCase && (
                  <div className="d-flex justify-content-end align-items-center gap-2 mb-2">
                    {((screenName === "inboxScreen" && isAcquired !== 0) || (caseStatus === "Draft" && isSameWorkflowUser)) && (
                      <Button className="add-btn-design" onClick={() => fileInputRef.current.click()}>
                        + Add
                      </Button>
                    )}

                    {allDraftFinalDoc?.length > 0 && (
                      <Button className="add-btn-design" onClick={() => handleDownloadAllDocuments(allDraftFinalDoc)}>
                        ⤓ Download All
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Final Documents (only when approved/closed/old case) */}
            {showFinalsSection && (
              <>
                <p className="font-size-11 mb-0 fw-bold">Final Documents:</p>
                {renderDocumentSection("draft-finals", true, safeFinalDocs)}
              </>
            )}

            {/* Latest Version of Draft Documents */}
            {latestDraftDocs.length > 0 && (
              <>
                <p className="font-size-11 mb-0 fw-bold">Latest Version of Draft Documents:</p>
                {renderDocumentSection("draft-latest", true, latestDraftDocs)}
              </>
            )}

            {/* Earlier version of Draft Documents */}
            {earlierDraftDocs.length > 0 && (
              <>
                <p className="font-size-11 mb-0 fw-bold">Earlier version of Draft Documents:</p>
                {renderDocumentSection("draft-earlier", true, earlierDraftDocs)}
              </>
            )}

            {/* Empty state */}
            {latestDraftDocs.length === 0 && earlierDraftDocs.length === 0 && !showFinalsSection && (
              <p className="text-muted text-center py-3 mb-0 font-size-12">No draft documents yet.</p>
            )}

            {/* Drag and Drop Upload Zone - only for draft section */}
            {screenName !== "referenceScreen" && !isOldCase && (
              <>
                {((screenName === "inboxScreen" && isAcquired !== 0) || (caseStatus === "Draft" && isSameWorkflowUser)) && (
                  <div
                    className={`document-upload-zone ${isDragOver ? "drag-over" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="d-flex align-items-center justify-content-center upload-content">
                      <span className="upload-text">{isDragOver ? "Drop file here" : "Drag & drop file here"}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Final Documents Section - appears below drag and drop, only when case is approved */}
          </>
        ) : (
          // Original single section view for supporting documents tab
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <p className="table-title mb-0">Supporting Documents</p>
              <div>
                <input type="file" ref={fileInputRef} className="d-none" onChange={(e) => handleFileSelection(e, false)} multiple />

                {screenName !== "referenceScreen" && !isOldCase && (
                  <div className="d-flex justify-content-end align-items-center gap-2 mb-2">
                    {((screenName === "inboxScreen" && isAcquired !== 0) || (caseStatus === "Draft" && isSameWorkflowUser)) && (
                      <Button className="add-btn-design" onClick={() => fileInputRef.current.click()}>
                        + Add
                      </Button>
                    )}

                    {documents?.length > 0 && (
                      <Button className="add-btn-design" onClick={() => handleDownloadAllDocuments(documents)}>
                        ⤓ Download All
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={isAcquired !== 0 || isInitiateWorkflow === false ? "table document-table document-table-in-active" : "document-table document-table-active"}>
              <table className="table">
                <thead>
                  <tr className="case-info-table-row">
                    <th>#</th>
                    <th>File Name</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(documents) &&
                    documents?.map((doc, index) => (
                      <tr key={doc.id} className="case-info-table-row">
                        <td>{index + 1}</td>
                        <td title={doc.title}>{truncateFileName(doc.title)}</td>

                        <td className="text-end">
                          <ActionButton icon={MdCompare} tooltip="Split View" onClick={() => handleSplitViewClick(doc)} />
                          <ActionButton icon={CgDetailsMore} tooltip="File Details" onClick={() => handleFileDetails(doc)} />
                          <ActionButton icon={FaDownload} tooltip="Download" onClick={() => handleDownloadDocument(doc)} />

                          {tabInfoView === "supporting" && (
                            <>
                              {screenName === "inboxScreen" &&
                              isAcquired !== 0 &&
                              doc?.content?.properties?.r_creator_name === userProfile?.properties?.object_name &&
                              caseStatus !== "Approved" ? (
                                <ActionButton icon={MdAutoDelete} tooltip="Delete" onClick={() => onHandleDelete(doc?.content?.properties)} />
                              ) : (
                                <>{caseStatus === "Draft" && <ActionButton icon={MdAutoDelete} tooltip="Delete" onClick={() => onHandleDelete(doc?.content?.properties)} />}</>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Drag and Drop Upload Zone */}
            {screenName !== "referenceScreen" && !isOldCase && (
              <>
                {((screenName === "inboxScreen" && isAcquired !== 0) || (caseStatus === "Draft" && isSameWorkflowUser)) && (
                  <div
                    className={`document-upload-zone ${isDragOver ? "drag-over" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="d-flex align-items-center justify-content-center upload-content">
                      <span className="upload-text">{isDragOver ? "Drop file here" : "Drag & drop file here"}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showFileDetails && selectedDocument?.content?.properties && (
        <Dialog title="File Details" onClose={handleFileDetails} width="350px">
          <div className="p-3">
            {[
              {
                label: "Category",
                value: selectedDocument.content.properties.category || "N/A",
              },
              {
                label: "File Name",
                value: selectedDocument.content.properties.object_name || "N/A",
              },
              {
                label: "Uploaded By",
                value: selectedDocument.content.properties.r_creator_name || "N/A",
              },
              {
                label: "Upload Time",
                value: selectedDocument.updated ? formatDateCellWithSec(selectedDocument.updated) : "N/A",
              },
            ]?.map(({ label, value }) => (
              <div key={label} className="mb-3">
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
};

export default DocumentTable;
