import { useState, useRef, useEffect, useMemo } from "react";

// Kendo components
import { Label } from "@progress/kendo-react-labels";
import { Button } from "@progress/kendo-react-buttons";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

// Icons
import { FaCloudUploadAlt, FaRegFileAlt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

// styled-components
import * as S from "../../pages/caseManagement/createCase/createCase.styles";

//services
import { digidakInwardService } from "../../services/digidak/inward/digidakInwardService";
import { documentService } from "../../services/caseManagement/documents/documentsService";
//hooks
import { usePublishIv } from "../../hooks/usePublishIv";
import { showSweetAlert } from "../sweetAlert/SweetAlert";
import { validateFileSignature } from "../../utils/validateFileSignature";

const DigidakAction = ({
  tab,
  subtype,
  loader,
  setTab,
  objectId,
  iFolderId,
  uidNumber,
  inEndrose,
  screenName,
  openEditor,
  isGenerated,
  uploadedFiles,
  processedDocData,
  createdNotesheet,
  documentListData,
  sendingBulkLetter,
  isEndorsementTrue,
  onDocumentListUpdate,
  handleFilesAddedToGrid,
  onUpdateEndorsementDocumentTypes,
}) => {
  const fileInputRef = useRef(null);
  const fileRefs = useRef([]); // For storing file refs
  const { publish: publishIv } = usePublishIv();

  const isofficeOrderBulk = sendingBulkLetter && subtype === "Office Order";

  const [loading, setLoading] = useState(loader);
  const [showDialog, setShowDialog] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const [assignedDocuments, setAssignedDocuments] = useState([]);
  const [documentList, setDocumentList] = useState(documentListData);

  const handleFileUpload = async (e) => {
    fileRefs.current = [];

    setActiveFileIndex(0);
    fileRefs.current[0]?.focus();

    const files = Array.from(e.target.files);
    const file = e.target.files[0];

    if (!files.length) return;

    const allowedExtensions = [".doc", ".docx", ".pdf", ".ppt", ".pptx", ".xlsx"];

    // Get file extension in lowercase
    const fileExtension = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

    // Validate file extension
    if (!allowedExtensions?.includes(fileExtension)) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Format",
        text: `Only the following formats are allowed: ${allowedExtensions?.join(", ")}`,
      });
      e.target.value = ""; // Reset file input
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

    const newFiles = files.map((file) => ({
      file,
      content: {
        properties: {
          object_name: file.name,
          document_type: "Select document type",
        },
      },
    }));

    // For all flows, upload files first and show dialog
    // Dialog will be shown automatically via useEffect when documentListData updates
    if (handleFilesAddedToGrid) {
      handleFilesAddedToGrid(newFiles);
    }
    e.target.value = null;
  };

  const handleDocumentTypeChange = (index, value) => {
    const updatedDocs = [...documentList];

    if (!updatedDocs[index]?.content?.properties) return;
    updatedDocs[index].content.properties.document_type = value;

    const selectedDoc = updatedDocs[index];
    const { id } = selectedDoc.content.properties;
    const name = selectedDoc.content.properties.object_name;

    // Update assignedDocuments
    setAssignedDocuments((prev) => {
      const existingIndex = prev.findIndex((doc) => doc.id === id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].category = value;
        return updated;
      } else {
        return [...prev, { id, name, category: value }];
      }
    });

    // Focus on next file if Document Type is added
    if (value !== "Select document type" && index < documentList.length - 1) {
      setActiveFileIndex(index + 1);
      fileRefs.current[index + 1]?.focus(); // Move focus to next file
    }
  };

  const allFilesHaveType =
    documentList?.length > 0 && documentList?.every((f) => f?.content?.properties?.document_type && f?.content?.properties?.document_type !== "Select document type");

  // Check if Main Letter already exists in documentListData or in current dialog session
  // Note: documentList contains only newly uploaded files without document_type,
  // while documentListData contains all documents including those with Main Letter already assigned
  const availableDocumentTypes = useMemo(() => {
    // Check if Main Letter already exists in documentListData (already saved documents)
    const hasMainLetterInSaved = documentListData.some((doc) => doc?.content?.properties?.document_type === "Main Letter");

    // Check if Main Letter is already assigned in current dialog session (excluding current file)
    const currentFileIndex = activeFileIndex;
    const hasMainLetterInDialog = documentList.some((doc, index) => index !== currentFileIndex && doc?.content?.properties?.document_type === "Main Letter");

    // If Main Letter already exists (either saved or in current dialog), only allow Attachment
    if (hasMainLetterInSaved || hasMainLetterInDialog) {
      return ["Attachment"];
    }

    // If no Main Letter exists, allow both options
    return ["Main Letter", "Attachment"];
  }, [documentListData, documentList, activeFileIndex]);

  const handleOk = async () => {
    try {
      setLoading(true);

      if (!assignedDocuments.length) {
        setLoading(false);
        return;
      }

      // Loop through documents one-by-one
      for (const doc of assignedDocuments) {
        // Update category for main outward
        await digidakInwardService.updateDocumentsType({
          docId: doc.id,
          document_type: doc.category,
          object_name: doc.name,
          uid_number: uidNumber,
        });

        // Publish to IV
        if (doc.id) {
          try {
            await publishIv(String(doc.id));
          } catch (error) {
            console.error(error);
          }
        }

        if (isEndorsementTrue && onUpdateEndorsementDocumentTypes) {
          await onUpdateEndorsementDocumentTypes(doc.name, doc.category, doc.id);
        }
      }

      // Refresh final list
      const res = await digidakInwardService.getInwardDocuments({
        input_parent_folders: isofficeOrderBulk ? iFolderId : objectId,
      });

      setDocumentList(res?.entries || []);

      // Update parent
      onDocumentListUpdate(res?.entries);

      setShowDialog(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);

      if (documentList.length > 0) {
        // Delete each document
        for (const doc of documentList) {
          const docId = doc?.content?.properties?.id;
          if (docId) {
            try {
              const deletePayload = {
                "run-stateless": "true",
                data: {
                  variables: {
                    inp_object_type: "cms_digidak_document",
                    inp_object_id: docId,
                  },
                },
              };

              await documentService.deleteDocument(deletePayload);
            } catch (error) {
              console.error(error);
            }
          }
        }

        // Refresh document list after deletion
        if (objectId) {
          const res = await digidakInwardService.getInwardDocuments({
            input_parent_folders: objectId,
          });
          setDocumentList(res?.entries || []);
          onDocumentListUpdate(res?.entries || []);
        }
      }

      // Clear assigned documents
      setAssignedDocuments([]);
      setShowDialog(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabs = () => (
    <S.Tabs>
      {[
        { id: "upload", label: "Upload File", icon: <FaCloudUploadAlt /> },
        ...(screenName !== "inwardEntry" && !inEndrose
          ? [
              {
                id: "notesheet",
                label: screenName === "outwardEntry" ? "Quick Correspondence" : "Create Notesheet",
                icon: <FaRegFileAlt />,
              },
            ]
          : []),
      ].map(({ id, label, icon }) => (
        <button
          type="button"
          key={id}
          className={`border-0 bg-transparent ${tab === id ? "active" : ""}`}
          onClick={createdNotesheet || processedDocData?.data?.length > 0 ? "" : () => setTab(id)}
        >
          {icon} {label}
        </button>
      ))}
    </S.Tabs>
  );

  const renderUploadSection = () => (
    <div className="section">
      {uploadedFiles && uploadedFiles.length > 0 ? (
        <div className="success">
          <FaCheckCircle /> {uploadedFiles.length} file(s) added
        </div>
      ) : (
        <span className="fw-semibold">Upload a document</span>
      )}

      <div>
        <input
          type="file"
          ref={fileInputRef}
          className="d-none"
          accept=".doc,.docx,.pdf,.ppt,.pptx,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple={true} // Allow multiple files for all flows including endorsement
          onChange={handleFileUpload}
          disabled={!isGenerated}
        />
        <Button type="button" className="notesheet-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={!isGenerated}>
          Add
        </Button>
      </div>
    </div>
  );

  const renderNotesheetSection = () => (
    <div className="section">
      {createdNotesheet ? (
        <div className="success">
          <FaCheckCircle /> Notesheet added
        </div>
      ) : (
        <span className="fw-semibold">{screenName === "outwardEntry" ? "Quick Correspondence" : "Create Notesheet"}</span>
      )}
      <div>
        <Button type="button" onClick={openEditor} className="notesheet-upload-btn" disabled={!isGenerated}>
          {createdNotesheet ? "Preview" : "Editor"}
        </Button>
      </div>
    </div>
  );

  useEffect(() => {
    setLoading(loader);
  }, [loader]);

  useEffect(() => {
    setAssignedDocuments((prev) => prev.filter((doc) => documentList.some((f) => f?.content?.properties?.id === doc.id)));
  }, [documentList]);

  useEffect(() => {
    // Filter out files that have a document_type
    const filteredDocuments = documentListData.filter((f) => !f.content.properties.document_type || f.content.properties.document_type === "Select document type");

    // For Quick Correspondence (notesheet tab), skip showing dialog for correspondence.docx
    // The document type will be set automatically in handleSaveNotesheet
    const isNotesheetTab = tab === "notesheet";
    const isNotesheetDocument = filteredDocuments.some((f) => f.content.properties.object_name === "correspondence.docx");

    // If it's notesheet tab and notesheet document, don't show dialog
    if (isNotesheetTab && isNotesheetDocument) {
      setDocumentList([]);
      return;
    }

    setDocumentList(filteredDocuments);

    // Show dialog when new files are added (for all flows including endorsement)
    // But skip for notesheet documents in notesheet tab
    if (filteredDocuments.length > 0 && !showDialog && !(isNotesheetTab && isNotesheetDocument)) {
      setShowDialog(true);
    }
  }, [documentListData, showDialog, tab]);

  // Switch to upload tab if Quick Correspondence tab is hidden due to endorsement
  useEffect(() => {
    if (inEndrose && tab === "notesheet") {
      setTab("upload");
    }
  }, [inEndrose, tab, setTab]);

  return (
    <>
      <S.Wrapper>
        {renderTabs()}
        <S.Content>{tab === "upload" ? renderUploadSection() : renderNotesheetSection()}</S.Content>
      </S.Wrapper>

      {showDialog && (
        <Dialog title="Import Documents" onClose={allFilesHaveType && handleCancel} className={`inward-preview-dialog-wh ${!allFilesHaveType ? "cursor-not-allowed" : ""}`}>
          {loading && (
            <div className="k-loading-mask">
              <div className="k-loading-image"></div>
            </div>
          )}
          <div className="row">
            <div className="col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Label className="fw-semibold">Files({documentList.length})</Label>
              </div>
              <ul className="list-unstyled mb-0">
                {documentList.map((f, i) => {
                  const docType = f.content.properties.document_type || "";
                  const isAssigned = docType && docType !== "Select document type";

                  const isActive = i === activeFileIndex;

                  return (
                    <li
                      key={i}
                      ref={(el) => (fileRefs.current[i] = el)}
                      className={`p-2 cursor-pointer rounded d-flex align-items-center justify-content-between ${isActive ? "bg-light border" : ""}`}
                      onClick={() => setActiveFileIndex(i)}
                    >
                      <span className={`text-truncate font-size-12 ${isActive ? "fw-bold text-dark" : "text-secondary"}`}>{f.content.properties.object_name}</span>
                      {isAssigned ? <FaCheckCircle className="text-success" size={12} /> : <FaExclamationTriangle className="text-warning" size={12} />}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="col-md-6">
              <Label className="fw-semibold mb-1">Name:</Label>
              <p className="p-2 border rounded bg-light small text-truncate mb-3">{documentList[activeFileIndex]?.content?.properties?.object_name || "-"}</p>

              <Label className="fw-semibold mb-1">Document Type:</Label>
              <DropDownList
                id="docType"
                className="case-form-dropdown"
                data={availableDocumentTypes}
                value={documentList[activeFileIndex]?.content?.properties?.document_type || "Select document type"}
                onChange={(e) => handleDocumentTypeChange(activeFileIndex, e.target.value)}
                defaultItem="Select document type"
              />
            </div>
          </div>

          <DialogActionsBar>
            <div className="d-flex justify-content-end mt-1 gap-2">
              <Button className="common-btn-css cancel-button" onClick={handleCancel}>
                Cancel
              </Button>
              <Button className="common-btn-css submit-button" disabled={!allFilesHaveType} onClick={handleOk}>
                Save Preferences
              </Button>
            </div>
          </DialogActionsBar>
        </Dialog>
      )}
    </>
  );
};

export default DigidakAction;
