import { useEffect, useRef, useState } from "react";

// react icons
import { FaCheckCircle, FaCloudUploadAlt, FaEdit } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// Kendo components
import { Button } from "@progress/kendo-react-buttons";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Dialog } from "@progress/kendo-react-dialogs";

// Rich Text Editor
import RichTextEditor from "../../../../components/richTextEditor/RichTextEditor";

// imports
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";
import { createCaseService } from "../../../../services/caseManagement/createCase/createCaseService";
import { documentService } from "../../../../services/caseManagement/documents/documentsService";
import { validateFileSignature } from "../../../../utils/validateFileSignature";
//hooks
import { usePublishIv } from "../../../../hooks/usePublishIv";
import { Editor } from "@progress/kendo-react-editor";

const STORAGE_KEY = "case_comments_latest";

const AddComments = ({ caseId, selectedFile1, folderId, onSelectionChange, splitView, ivTitleName, onPublicationIdSelect = () => {} }) => {
  const fileInputRef = useRef(null);
  const contentEditableRef = useRef(null);

  // Custom hook for IV publishing
  const { publish: publishIv } = usePublishIv();

  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [comments, setComments] = useState("");
  const [selectedFile, setSelectedFile] = useState(selectedFile1 || null);
  const [commentsDocId, setCommentsDocId] = useState(null);
  const [selectedComments, setSelectedComments] = useState(null);
  const [isRichEditorOpen, setIsRichEditorOpen] = useState(false);
  const [richEditorContent, setRichEditorContent] = useState("");
  const [defaultComments, setDefaultComments] = useState([]);

  const parseStorageComments = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  };

  // Save comments for a specific caseId
  const saveToStorage = (caseId, comment) => {
    const allComments = parseStorageComments();
    allComments[caseId] = comment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allComments));
  };

  // Load comment for a specific caseId
  const loadFromStorage = (caseId) => {
    const allComments = parseStorageComments();
    return allComments[caseId] || "";
  };

  // Remove comment for a specific caseId
  const resetStorage = (caseId) => {
    const allComments = parseStorageComments();
    delete allComments[caseId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allComments));
    resetStates();
  };

  const resetStates = () => {
    setComments("");
    setCommentsDocId(null);
    setSelectedFile(null);
    setSelectedComments(null);
    setIsRichEditorOpen(false);
    setRichEditorContent("");
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = [".doc", ".docx"];
    const ext = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Format",
        text: `Only ${allowedExtensions.join(", ")} are allowed`,
      });
      e.target.value = "";
      return;
    }

    // Validate file content matches its extension (detect renamed files)
    const signatureResult = await validateFileSignature(file);
    if (!signatureResult.valid) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Content",
        text: signatureResult.message,
      });
      e.target.value = "";
      return;
    }

    setComments("");
    setIsLoading(true);

    try {
      const uploadRes = await documentService.getFilePath(file);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;

      if (!fileSrc) throw new Error("File upload failed");

      const uploadPayload = {
        properties: {
          a_content_type: "msw12",
          case_number: caseId,
          r_object_type: "cms_supporting_document",
          object_name: file.name,
          folder_id: folderId,
          category: "Comment",
        },
        type: "cms_supporting_document",
        source: fileSrc,
      };

      const docId = await createCaseService.uploadDocument(uploadPayload);

      if (!docId) throw new Error("Upload failed");

      if (docId?.properties?.object_name) {
        const uploadedDocId = docId?.properties?.r_object_id;
        await publishIv(uploadedDocId);

        const response = await documentService.getSupportingDocuments({
          input_category: "Comment",
          input_folder_path: `/Case/${caseId}`,
        });

        setSelectedFile(response?.entries?.[0]?.content?.properties);
        setCommentsDocId(response?.entries?.[0]?.content?.properties?.id);
      } else {
        throw new Error(docId?.message || "Upload failed");
      }

      showSweetAlert({
        title: "Success",
        text: "Document uploaded successfully",
        icon: "success",
      });
    } catch (err) {
      showSweetAlert({
        title: "Error",
        text: err.message || "Upload failed, please try again",
        icon: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardCommentChange = (e) => {
    if (!e.value?.value) return; // Ignore default item
    setSelectedFile(null);
    setCommentsDocId(null);
    setSelectedComments(e.value);

    const userText = comments.replace(selectedComments?.label || "", "").trim();
    setComments(userText ? `${userText}\n${e.value.label}` : e.value.label);
  };

  // Rich editor handler for advanced editing (HTML with formatting)
  const handleRichEditorChange = (event) => {
    setRichEditorContent(event.html);
  };

  // Rich editor dialog handlers
  const handleOpenRichEditor = () => {
    setRichEditorContent(comments); // Load current comments into rich editor
    setIsRichEditorOpen(true);
  };

  const handleCloseRichEditor = () => {
    setIsRichEditorOpen(false);
  };

  const handleSaveRichEditor = () => {
    setComments(richEditorContent); // Save rich editor content to main comments
    setIsRichEditorOpen(false);
  };

  const handleReset = () => {
    resetStorage(caseId);
  };

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await createCaseService.getVerticalCaseType({
          input_folder: "/ECM CONFIG/Hindi Comments",
        });
        const comments =
          response?.entries?.map((entry) => ({
            value: entry?.content?.properties?.id,
            label: entry?.content?.properties?.object_name,
          })) || [];
        setDefaultComments(comments);
      } catch {
        // fallback to empty list
      }
    };
    if (!defaultComments?.length) {
      fetchComments();
    }
  }, [defaultComments?.length]);

  useEffect(() => {
    if (!caseId) return;

    const savedComment = loadFromStorage(caseId);
    setComments(savedComment);
    setHasLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    if (!caseId || !hasLoaded) return;

    // Debounce localStorage saves to avoid excessive writes
    const timeout = setTimeout(() => {
      saveToStorage(caseId, comments);
    }, 1000);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, caseId, hasLoaded]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({
        comments,
        commentsDocId,
        selectedFile,
      });
    }
  }, [comments, commentsDocId, onSelectionChange, selectedFile]);


  return (
    <div className="bg-white px-3 py-2 mt-1 border rounded-3">
      <h6 className="case-info-label mb-2">Approve / Forward Comments</h6>

      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2 mb-2 w-100">
          <input
            type="file"
            ref={fileInputRef}
            className="d-none"
            onChange={handleFileUpload}
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />

          <Button size="small" className="case-info-buttons" onClick={() => fileInputRef.current.click()} disabled={!!selectedFile}>
            <span className="d-flex align-items-center">
              <FaCloudUploadAlt className="me-1" />
              {isLoading ? "Importing..." : "Import"}
            </span>
          </Button>

          <Button size="small" className="case-info-buttons" onClick={handleOpenRichEditor} disabled={!!selectedFile}>
            <span className="d-flex align-items-center">
              <FaEdit className="me-1" />
              Edit
            </span>
          </Button>

          <DropDownList
            textField="label"
            dataItemKey="value"
            data={defaultComments}
            value={selectedComments}
            className="comment-dropdown-height"
            onChange={handleStandardCommentChange}
            defaultItem={{ label: "Choose a standard comment" }}
            disabled={!!selectedFile}
          />
        </div>
      </div>

      {/* Inline comment editor */}
      {selectedFile ? (
        <div className="section font-size-12 d-flex align-items-center justify-content-between">
          <button
            className="success text-decoration-underline cursor-pointer border-0"
            onClick={() => {
              const publicationId = selectedFile?.iv_id;

              if (publicationId) {
                const ivTitle = selectedFile?.object_name;

                if (onPublicationIdSelect && typeof onPublicationIdSelect === "function") {
                  onPublicationIdSelect(publicationId);
                }
                splitView(publicationId);
                ivTitleName(ivTitle);
              } else {
                showSweetAlert({
                  title: "No Publication Available",
                  text: "This document hasn't been published yet. Please upload a new document to view it in the Brava viewer.",
                  icon: "info",
                });
              }
            }}
          >
            <FaCheckCircle /> {selectedFile?.object_name}
          </button>

          <IoMdClose cursor="pointer" color="red" onClick={handleReset} />
        </div>
      ) : (
        <Editor
            ref={contentEditableRef}
            value={comments}
            onChange={(event) => setComments(event.html)}
            className="add-comment-editor"
          />
      )}

      {/* Rich Text Editor Dialog */}
      {isRichEditorOpen && (
        <Dialog title="Rich Text Comments Editor" className="notesheet-window-editor" onClose={handleCloseRichEditor}>
          <RichTextEditor value={richEditorContent} onChange={handleRichEditorChange} />
          <div className="d-flex justify-content-end mt-3 gap-2">
            <Button className="common-btn-css cancel-button" onClick={handleCloseRichEditor}>
              Cancel
            </Button>
            <Button className="common-btn-css submit-button" onClick={handleSaveRichEditor}>
              Save Comments
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default AddComments;
