/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useMemo, useState } from "react";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import { validateFileSignature } from "../../../utils/validateFileSignature";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { createCaseService } from "../../../services/caseManagement/createCase/createCaseService";
import { usePublishIv } from "../../../hooks/usePublishIv";

/**
 * Hook that encapsulates all document management logic for OutwardEntry.
 */
export const useOutwardDocuments = ({
  generatedNumber,
  isGenerated,
  sendEndorsementsData,
  endorsementRows,
  endorsementGridData,
  outwardObjectIds,
  sendingBulkLetter,
  subtype,
  setLoader,
  setEndorsementDocuments,
  documentList,
  setDocumentList,
}) => {
  const { publish: publishIv } = usePublishIv();

  const [spinner, setSpinner] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [editorContent, setEditorContent] = useState("");
  const [selectedAction, setSelectedAction] = useState("upload");
  const [isNotesheetDialogOpen, setNotesheetDialogOpen] = useState(false);
  const [createdNotesheet, setCreatedNotesheet] = useState(false);
  const [previewNotePop, setPreviewNotePop] = useState(false);
  const [showUploadPop, setShowUploadPop] = useState(false);

  const isCorrespondenceAdded = documentList?.[0]?.content?.properties?.object_name === "correspondence.docx";

  const handleOpenNotesheetEditor = () => {
    setNotesheetDialogOpen(true);
  };

  const handleSelectTab = (tab) => {
    setSelectedAction(tab);
    if (tab === "notesheet") {
      setSelectedFile(null);
    } else {
      setEditorContent("");
      setCreatedNotesheet(false);
    }
  };

  const hasValidEditorContent = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent.trim()?.length > 0;
  };

  const onEditorChange = (event) => {
    setEditorContent(event.html);
  };

  const handleSaveNotesheet = async () => {
    setSpinner(true);

    try {
      const notesheetData = {
        "run-stateless": "true",
        data: {
          variables: {
            in_contentType: "msw12",
            in_path: `${generatedNumber?.folderPath}`,
            in_docName: "correspondence.docx",
            in_docType: "cms_digidak_document",
            in_editorContenet: editorContent,
          },
        },
      };

      await createCaseService.createNotesheet(notesheetData);

      const response = await digidakInwardService.getInwardDocuments({
        input_parent_folders: generatedNumber?.objectId,
      });

      setDocumentList(response?.entries || []);

      const correspondencetData = response?.entries?.[0]?.content?.properties;

      const data = await digidakInwardService.updateDocumentsType({
        docId: correspondencetData.id,
        document_type: "Main Letter",
        object_name: correspondencetData.object_name,
        uid_number: correspondencetData.uid_number,
      });

      if (data?.properties?.document_type === "Main Letter") {
        if (data?.properties?.r_object_id) {
          try {
            await publishIv(String(data.properties.r_object_id));
          } catch (error) {
            console.error(error);
          }
        }

        const res = await digidakInwardService.getInwardDocuments({
          input_parent_folders: generatedNumber?.objectId,
        });

        setDocumentList(res?.entries || []);

        setSpinner(false);
        setCreatedNotesheet(true);
        setNotesheetDialogOpen(false);

        showSweetAlert({
          title: "Upload Successful",
          text: "Correspondence added successfully!",
          icon: "success",
        });
      }
    } catch (error) {
      console.error(error);
      setSpinner(false);
      showSweetAlert({
        title: "Upload Failed",
        text: error.message || "Failed to upload file(s). Please try again.",
        icon: "error",
      });
      return;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = [".doc", ".docx"];
    const fileExtension = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      showSweetAlert({ title: "Invalid Format", text: `Only the following formats are allowed: ${allowedExtensions.join(", ")}`, icon: "warning" });
      e.target.value = "";
      return;
    }

    const signatureResult = await validateFileSignature(file);
    if (!signatureResult.valid) {
      showSweetAlert({ title: "Invalid File", text: signatureResult.message, icon: "warning" });
      e.target.value = "";
      return;
    }

    if (!isGenerated) {
      showSweetAlert({ title: "Action Required", text: "Please generate an Inward Number before adding documents.", icon: "warning" });
      e.target.value = "";
      return;
    }

    const newFile = {
      id: Date.now(),
      fileName: file.name,
      fileObj: file,
      document_type: "File Upload",
    };

    setUploadedFiles((prev) => [newFile, ...prev]);
    setSelectedFile(file);
    e.target.value = "";
  };

  const handleUpdateDocumentList = (newList) => {
    setDocumentList(newList);
  };

  const handleFilesAddedToGrid = useCallback(
    async (filesWithTypes, documentType = undefined) => {
      setShowUploadPop(true);
      setLoader(true);

      try {
        const hasMultipleOutwards = outwardObjectIds.length > 1;
        const isEndorsementFlow = sendEndorsementsData === "Yes" && endorsementRows.length > 0;
        const shouldUploadToAllOutwards = isEndorsementFlow && hasMultipleOutwards && isGenerated;

        if (shouldUploadToAllOutwards) {
          const uploaded = [];

          for (const item of filesWithTypes) {
            const file = item.file;

            const mainObjectId = sendingBulkLetter && endorsementGridData.length > 0 && subtype === "Office Order" ? generatedNumber?.iFolderId : generatedNumber?.objectId;

            let targetObjectIds = [mainObjectId];

            if (sendingBulkLetter && endorsementGridData.length > 0) {
              const endorsementObjectIds = endorsementGridData.map((item) => item?.content?.properties?.id).filter((id) => id);
              targetObjectIds = [mainObjectId, ...endorsementObjectIds];
            } else {
              targetObjectIds = outwardObjectIds;
            }

            for (const objectId of targetObjectIds) {
              const uploadRes = await documentService.getFilePath(file);

              const fileSrc = uploadRes?.entries?.[0]?.content?.src;
              if (!fileSrc) throw new Error(`File upload failed for ${file.name}`);

              const uploadPayload = {
                properties: {
                  a_content_type: "msw12",
                  r_object_type: "cms_digidak_document",
                  object_name: file.name,
                  folder_id: objectId,
                },
                type: "cms_digidak_document",
                source: fileSrc,
              };

              await documentService.uploadDocument(uploadPayload);

              const response = await digidakInwardService.getInwardDocuments({
                input_parent_folders: objectId,
              });

              const uploadedDoc = response?.entries?.find((doc) => doc?.content?.properties?.object_name === file.name);

              if (uploadedDoc) {
                const docId = uploadedDoc?.content?.properties?.id;
                const uidNumber = uploadedDoc?.content?.properties?.uid_number;

                if (documentType && documentType !== "Select document type") {
                  await digidakInwardService.updateDocumentsType({
                    docId: docId,
                    document_type: documentType,
                    object_name: file.name,
                    uid_number: uidNumber,
                  });
                }

                if (docId) {
                  try {
                    await publishIv(String(docId));
                  } catch (error) {
                    console.error(error);
                  }
                }

                if (objectId !== mainObjectId) {
                  setEndorsementDocuments((prev) => {
                    const updated = { ...prev };
                    if (!updated[objectId]) {
                      updated[objectId] = [];
                    }
                    const exists = updated[objectId].some((doc) => doc?.content?.properties?.id === docId);
                    if (!exists) {
                      updated[objectId] = [...updated[objectId], uploadedDoc];
                    }
                    return updated;
                  });
                }
              }
            }

            uploaded.push({
              id: Date.now(),
              fileName: file.name,
              fileObj: file,
              document_type: documentType,
            });
          }

          const mainResponse = await digidakInwardService.getInwardDocuments({
            input_parent_folders: sendingBulkLetter && endorsementGridData.length > 0 && subtype === "Office Order" ? generatedNumber?.iFolderId : generatedNumber?.objectId,
          });

          setLoader(false);
          setDocumentList(mainResponse?.entries || []);
        } else {
          const uploaded = [];

          const isofficeOrderBulk = sendingBulkLetter && subtype === "Office Order";

          for (const item of filesWithTypes) {
            const file = item.file;

            const uploadRes = await documentService.getFilePath(file);

            const fileSrc = uploadRes?.entries?.[0]?.content?.src;
            if (!fileSrc) throw new Error(`File upload failed for ${file.name}`);

            const uploadPayload = {
              properties: {
                a_content_type: "msw12",
                r_object_type: "cms_digidak_document",
                object_name: file.name,
                folder_id: isofficeOrderBulk ? generatedNumber?.iFolderId : generatedNumber?.objectId,
              },
              type: "cms_digidak_document",
              source: fileSrc,
            };

            await documentService.uploadDocument(uploadPayload);

            const response = await digidakInwardService.getInwardDocuments({
              input_parent_folders: isofficeOrderBulk ? generatedNumber?.iFolderId : generatedNumber?.objectId,
            });

            setDocumentList(response?.entries);
          }

          setLoader(false);

          if (uploaded.length > 0) {
            setUploadedFiles((prev) => [...prev, ...uploaded]);
          }
        }
      } catch (error) {
        console.error(error);
        setLoader(false);
        showSweetAlert({
          title: "Upload Failed",
          text: error.message || "Failed to upload file(s). Please try again.",
          icon: "error",
        });
        return;
      }
    },
    [generatedNumber?.objectId, sendEndorsementsData, endorsementRows.length, outwardObjectIds, isGenerated, sendingBulkLetter, endorsementGridData],
  );

  const handleModifyEndorsementDocument = useCallback(async (objectId, docId, newFile, name) => {
    try {
      setLoader(true);

      if (name === "modify") {
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
      }

      const uploadRes = await documentService.getFilePath(newFile);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;
      if (!fileSrc) throw new Error(`File upload failed for ${newFile.name}`);

      const uploadPayload = {
        properties: {
          a_content_type: "msw12",
          r_object_type: "cms_digidak_document",
          object_name: newFile.name,
          folder_id: objectId,
        },
        type: "cms_digidak_document",
        source: fileSrc,
      };

      await documentService.uploadDocument(uploadPayload);

      const response = await digidakInwardService.getInwardDocuments({
        input_parent_folders: objectId,
      });

      const uploadedDoc = response?.entries?.find((doc) => doc?.content?.properties?.object_name === newFile.name);

      if (uploadedDoc) {
        const newDocId = uploadedDoc?.content?.properties?.id;
        const uidNumber = uploadedDoc?.content?.properties?.uid_number;

        await digidakInwardService.updateDocumentsType({
          docId: newDocId,
          document_type: "Main Letter",
          object_name: newFile.name,
          uid_number: uidNumber,
        });

        if (newDocId) {
          try {
            await publishIv(String(newDocId));
          } catch (error) {
            console.error(error);
          }
        }

        setEndorsementDocuments((prev) => {
          const updated = { ...prev };
          if (!updated[objectId]) {
            updated[objectId] = [];
          }
          updated[objectId] = updated[objectId].filter((doc) => doc?.content?.properties?.id !== docId);
          updated[objectId] = [...updated[objectId], uploadedDoc];
          return updated;
        });

        showSweetAlert({
          title: "Document Modified",
          text: `${newFile.name} has been successfully replaced.`,
          icon: "success",
        });
      }
    } catch (error) {
      showSweetAlert({
        title: "Modify Failed",
        text: error.message || "Failed to modify document. Please try again.",
        icon: "error",
      });
    } finally {
      setLoader(false);
    }
  }, []);

  const handleUpdateEndorsementDocuments = useCallback((objectId, documents) => {
    setEndorsementDocuments((prev) => {
      const updated = { ...prev };
      updated[objectId] = documents || [];
      return updated;
    });
  }, []);

  const handleUpdateEndorsementDocumentTypes = useCallback(
    async (documentName, documentType) => {
      const isEndorsementFlow = sendEndorsementsData === "Yes" && endorsementRows.length > 0;
      const hasMultipleOutwards = outwardObjectIds.length > 1;

      if (!isEndorsementFlow || !hasMultipleOutwards) return;

      const mainObjectId = generatedNumber?.objectId;
      const endorsementObjectIds = outwardObjectIds.filter((id) => id !== mainObjectId);

      for (const objectId of endorsementObjectIds) {
        try {
          const response = await digidakInwardService.getInwardDocuments({
            input_parent_folders: objectId,
          });

          const doc = response?.entries?.find((d) => d?.content?.properties?.object_name === documentName);

          if (doc) {
            const endorsementDocId = doc?.content?.properties?.id;
            const uidNumber = doc?.content?.properties?.uid_number;

            await digidakInwardService.updateDocumentsType({
              docId: endorsementDocId,
              document_type: documentType,
              object_name: documentName,
              uid_number: uidNumber,
            });

            if (endorsementDocId) {
              try {
                await publishIv(String(endorsementDocId));
              } catch (error) {
                console.error(error);
              }
            }

            const updatedResponse = await digidakInwardService.getInwardDocuments({
              input_parent_folders: objectId,
            });

            setEndorsementDocuments((prev) => {
              const updated = { ...prev };
              updated[objectId] = updatedResponse?.entries || [];
              return updated;
            });
          }
        } catch (error) {
          console.error(error);
        }
      }
    },
    [sendEndorsementsData, endorsementRows.length, outwardObjectIds, generatedNumber?.objectId],
  );

  // Mapped document grid data
  const docMappedData = useMemo(() => {
    return (
      documentList?.map((item) => {
        const { id, object_name, owner_name, document_type, r_creator_name, r_creation_date } = item?.content?.properties ?? {};

        return {
          doc_id: id,
          doc_name: object_name,
          owner_name: owner_name,
          document_type: document_type,
          r_creator_name: r_creator_name,
          r_creation_date: r_creation_date,
        };
      }) ?? []
    );
  }, [documentList, sendEndorsementsData, endorsementRows.length, outwardObjectIds.length]);

  return {
    // State
    spinner,
    selectedFile,
    uploadedFiles,
    editorContent,
    selectedAction,
    isNotesheetDialogOpen,
    createdNotesheet,
    previewNotePop,
    showUploadPop,
    isCorrespondenceAdded,
    docMappedData,

    // State setters (needed by JSX)
    setNotesheetDialogOpen,
    setPreviewNotePop,
    setCreatedNotesheet,
    setEditorContent,

    // Handlers
    handleOpenNotesheetEditor,
    handleSelectTab,
    hasValidEditorContent,
    onEditorChange,
    handleSaveNotesheet,
    handleFileUpload,
    handleUpdateDocumentList,
    handleFilesAddedToGrid,
    handleModifyEndorsementDocument,
    handleUpdateEndorsementDocuments,
    handleUpdateEndorsementDocumentTypes,
  };
};
