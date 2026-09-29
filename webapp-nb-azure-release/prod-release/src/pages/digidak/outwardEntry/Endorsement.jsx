import { useEffect, useMemo, useState, useRef } from "react";

//inline svg icons
const PlusCircleIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM232 344V280H168c-13.3 0-24-10.7-24-24s10.7-24 24-24h64V168c0-13.3 10.7-24 24-24s24 10.7 24 24v64h64c13.3 0 24 10.7 24 24s-10.7 24-24 24H280v64c0 13.3-10.7 24-24 24s-24-10.7-24-24z" />
  </svg>
);

// Minus Circle Icon
const MinusCircleIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM168 232h176c13.3 0 24 10.7 24 24s-10.7 24-24 24H168c-13.3 0-24-10.7-24-24s10.7-24 24-24z" />
  </svg>
);

// Edit (Pencil) Icon
const EditIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
  </svg>
);

import { Dialog } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import Skeleton from "../../../components/Loader/Skeleton";
import { validateFileSignature } from "../../../utils/validateFileSignature";

export default function Endorsement({
  isLoader,
  endorsementNo,
  dropdownData,
  typeCategoryOptions = [],
  isGenerated,
  onValidityChange,
  onRowsChange,
  endorsementRowsWithDocuments = [],
  endorsementDocuments = {},
  onModifyDocument,
  onUpdateEndorsementDocuments,
  initialRows = null,
}) {
  const fileInputRef = useRef(null);
  const fileUploadRef = useRef(null);

  // State to manage endorsement rows
  const [endorsementRows, setEndorsementRows] = useState([]);
  const fileInputRefs = useRef({}); // Store file input refs per row
  const hasInitializedRef = useRef(false); // Track if we've initialized from parent

  const [loader, setLoader] = useState(false);
  const [uploadLoader, setUploadLoader] = useState(false);
  const [deleteLoader, setDeleteLoader] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [selectedRowForModify, setSelectedRowForModify] = useState(null);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(0);

  const filteredData = endorsementNo?.filter((item) => !item?.content?.properties?.group_uid);

  const gridDataItems = filteredData?.map((item) => ({
    endorse_uid: item?.content?.properties?.endorse_uid,
    digidak_uid: item?.content?.properties?.uid_number,
  }));

  // Build a blank row with optional overrides
  const createRow = (overrides = {}) => ({
    id: crypto.randomUUID(),
    // Type is always Internal for endorsements
    type: "Internal",
    type_category: "",
    login_office_type: "",
    selected_region: "",
    isInitial: false,
    ...overrides,
  });

  // Sync rows from parent when initialRows prop changes (for bulk upload)
  useEffect(() => {
    if (initialRows && Array.isArray(initialRows) && initialRows.length > 0) {
      setEndorsementRows(initialRows);
      hasInitializedRef.current = true;
    }
  }, [initialRows]);

  // Initialize first empty row when the grid mounts (only once, without default values)
  useEffect(() => {
    // Skip if we've already initialized (from parent bulk upload or previous initialization)
    if (hasInitializedRef.current) return;

    // Only initialize once with empty values when rows are empty
    setEndorsementRows((prev) => {
      // Double-check: if rows already exist, don't initialize
      if (prev.length > 0) {
        hasInitializedRef.current = true;
        return prev;
      }
      // Mark as initialized and create first empty row
      hasInitializedRef.current = true;
      return [createRow()];
    });
  }, []);

  // Inform parent about endorsement rows validity
  useEffect(() => {
    if (typeof onValidityChange !== "function") return;
    if (!endorsementRows || endorsementRows.length === 0) {
      onValidityChange(false);
      return;
    }

    const allValid = endorsementRows.every((row) => row.type === "Internal" && row.type_category && row.login_office_type && row.selected_region);

    onValidityChange(allValid);
  }, [endorsementRows, onValidityChange]);

  // Notify parent about current endorsement rows for generate loop
  useEffect(() => {
    if (typeof onRowsChange === "function") {
      onRowsChange(endorsementRows);
    }
  }, [endorsementRows, onRowsChange]);

  // HO/RO/TE dropdown options
  const hoRoTeOptions = useMemo(
    () => [
      { text: "HO", value: "HO" },
      { text: "RO", value: "RO" },
      { text: "TE", value: "TE" },
    ],
    [],
  );

  const resolveValue = (options, value) => {
    if (!value) return null;
    const isObject = options?.length && typeof options[0] === "object";
    if (!isObject) return value;
    return options.find((opt) => opt.value === value || opt.text === value) || { text: value, value };
  };

  const getRecipientOptions = (hoRoTeValue) => {
    if (hoRoTeValue === "HO") return dropdownData?.HO || [];
    if (hoRoTeValue === "RO") return dropdownData?.RO || [];
    if (hoRoTeValue === "TE") return dropdownData?.TE || [];
    return [];
  };

  const mergeTypeCell = (props) => {
    const rowData = props?.dataItem;
    const rowId = rowData?.id;
    const typeOptions = [{ text: "Internal", value: "Internal" }];
    const currentValue = { text: "Internal", value: "Internal" };

    return (
      <td>
        <DropDownList
          className="case-form-dropdown"
          data={typeOptions}
          value={currentValue}
          textField="text"
          dataItemKey="value"
          //   disabled={true}
          onChange={() => {
            // Type is fixed as Internal; no-op to keep it disabled logically as well
            if (!rowId) return;
          }}
        />
      </td>
    );
  };

  const mergeCategoryCell = (props) => {
    const rowData = props?.dataItem;
    const rowId = rowData?.id;
    const rawCategoryValue = rowData?.type_category !== undefined && rowData?.type_category !== null ? rowData.type_category : "";
    const currentValue = resolveValue(typeCategoryOptions, rawCategoryValue);

    return (
      <td>
        <DropDownList
          className="case-form-dropdown"
          data={typeCategoryOptions}
          value={currentValue}
          textField={"text"}
          dataItemKey={"value"}
          disabled={isGenerated}
          onChange={(e) => {
            if (rowId) {
              setEndorsementRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, type_category: e.value?.value || e.value } : row)));
            }
          }}
        />
      </td>
    );
  };

  const mergeHOROTECell = (props) => {
    const rowData = props?.dataItem;
    const rowId = rowData?.id;
    const hoRoTeRaw = rowData?.login_office_type ?? "";
    const currentValue = resolveValue(hoRoTeOptions, hoRoTeRaw);

    return (
      <td>
        <DropDownList
          className="case-form-dropdown"
          data={hoRoTeOptions}
          value={currentValue}
          textField={"text"}
          dataItemKey={"value"}
          disabled={isGenerated}
          onChange={(e) => {
            if (rowId) {
              const newHOROTE = e.value?.value || e.value;
              setEndorsementRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, login_office_type: newHOROTE, selected_region: "" } : row)));
            }
          }}
        />
      </td>
    );
  };

  const mergeRecipientCell = (props) => {
    const rowData = props?.dataItem;
    const rowId = rowData?.id;
    const rowHoRoTe = rowData?.login_office_type || "";
    const recipientOptions = getRecipientOptions(rowHoRoTe);
    const isObjectData = recipientOptions?.length && typeof recipientOptions[0] === "object";
    const rawRecipientValue = rowData?.selected_region ?? "";
    const currentValue = resolveValue(recipientOptions, rawRecipientValue);

    return (
      <td>
        <DropDownList
          className="case-form-dropdown"
          data={recipientOptions}
          value={currentValue}
          textField={isObjectData ? "text" : undefined}
          dataItemKey={isObjectData ? "value" : undefined}
          disabled={isGenerated || !rowHoRoTe}
          onChange={(e) => {
            if (rowId) {
              const newValue = isObjectData ? e.value?.value || e.value : e.value;
              setEndorsementRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, selected_region: newValue } : row)));
            }
          }}
        />
      </td>
    );
  };

  // Use endorsementRowsWithDocuments if available, otherwise use endorsementRows
  const gridData = endorsementRowsWithDocuments.length > 0 ? endorsementRowsWithDocuments : endorsementRows;

  const mergedGridData = gridData?.map((item, index) => ({
    ...item,
    endorse_uid: gridDataItems[index]?.endorse_uid || "-",
    digidak_uid: gridDataItems[index]?.digidak_uid || "-",
  }));

  const endorsementActionCell = (props) => {
    const rowData = props.dataItem;
    const rowId = rowData?.id;
    const rowIndex = endorsementRows.findIndex((row) => row.id === rowId);
    const maxRows = 30;
    const isMaxRowsReached = endorsementRows.length >= maxRows;
    const isActionsDisabled = isGenerated;

    // Handle adding duplicate row
    const handleAddEndorsementRow = () => {
      if (!rowData || isMaxRowsReached || isActionsDisabled) return;

      setEndorsementRows((prev) => {
        const newRows = [...prev];
        newRows.splice(rowIndex + 1, 0, createRow());
        return newRows;
      });
    };

    // Handle removing row
    const handleRemoveEndorsementRow = () => {
      if (isActionsDisabled) return;
      setEndorsementRows((prev) => prev.filter((row) => row.id !== rowId));
    };

    return (
      <td className="d-flex">
        <button
          onClick={!isMaxRowsReached && !isActionsDisabled ? handleAddEndorsementRow : undefined}
          title={isActionsDisabled ? "Actions disabled after generating outward number" : isMaxRowsReached ? "Maximum 30 rows allowed" : "Duplicate row"}
          className={`icon-wrapper icon-clickable border-0 bg-transparent ${isMaxRowsReached || isActionsDisabled ? "opacity-50 pe-none" : "opacity-100 cursor-pointer"}`}
        >
          <PlusCircleIcon style={{ width: 14, height: 14 }} />
        </button>
        <button
          onClick={!isActionsDisabled ? handleRemoveEndorsementRow : undefined}
          title={isActionsDisabled ? "Actions disabled after generating outward number" : "Remove row"}
          className={`icon-wrapper icon-clickable border-0 bg-transparent ${isMaxRowsReached || isActionsDisabled ? "opacity-50 pe-none" : "opacity-100 cursor-pointer"}`}
        >
          <MinusCircleIcon style={{ width: 14, height: 14 }} />
        </button>
      </td>
    );
  };

  const mergeDocumentNameCell = (props) => {
    const rowData = props?.dataItem;
    const documentName = rowData?.document_name || "-";

    return (
      <td className="text-wrap text-break">
        <span title={documentName}>{documentName}</span>
      </td>
    );
  };

  const mergeModifyCell = (props) => {
    const rowData = props?.dataItem;
    const rowId = rowData?.id;
    const objectId = rowData?.objectId;
    const documentName = rowData?.document_name || "-";
    const hasDocument = documentName !== "-" && objectId;

    // Get the first document ID for this objectId
    const documents = objectId ? endorsementDocuments[objectId] || [] : [];
    const firstDoc = documents[0];
    const docId = firstDoc?.content?.properties?.id;

    const hasMultipleDocuments = documents.length > 0;

    const handleModifyClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!hasDocument || !docId || !objectId) {
        return;
      }

      // If multiple documents, show dialog for selection
      if (hasMultipleDocuments) {
        setSelectedRowForModify({ rowId, objectId, documents });
        setSelectedDocumentIndex(0);
        setShowDocumentDialog(true);
      } else {
        // Single document - proceed directly
        const fileInput = fileInputRefs.current[rowId];
        if (fileInput) {
          fileInput.click();
        }
      }
    };

    const handleFileChange = async (e) => {
      const file = e.target.files[0];

      if (!file || !docId || !objectId || !onModifyDocument) return;

      // Validate file extension
      const allowedExtensions = [".doc", ".docx"];
      const fileExtension = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        showSweetAlert({ title: `Only the following formats are allowed: ${allowedExtensions.join(", ")}`, icon: "warning" });
        e.target.value = "";
        return;
      }

      // Validate file content matches its extension (detect renamed files)
      const signatureResult = await validateFileSignature(file);
      if (!signatureResult.valid) {
        showSweetAlert({ title: signatureResult.message, icon: "warning" });
        e.target.value = "";
        return;
      }

      // Call modify handler
      await onModifyDocument(objectId, docId, file);

      // Reset file input
      e.target.value = "";
    };

    const canModify = hasDocument && docId && objectId;

    return (
      <td onClick={(e) => e.stopPropagation()}>
        {canModify ? (
          <>
            <input
              type="file"
              ref={(el) => {
                if (el) {
                  fileInputRefs.current[rowId] = el;
                }
              }}
              className="d-none"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <button className="icon-wrapper icon-clickable cursor-pointer d-inline-block bg-transparent border-0" onClick={handleModifyClick} title="Modify document">
              <EditIcon style={{ width: 14, height: 14 }} />
            </button>
          </>
        ) : (
          <span className="text-secondary">-</span>
        )}
      </td>
    );
  };

  const handleMultiDocumentSelect = () => {
    fileInputRef.current?.click(); // opens file picker
  };

  const handleUploadDocumentSelect = () => {
    fileUploadRef.current?.click(); // opens file picker
  };

  // Handle document selection from dialog
  const handleDocumentSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedRowForModify) return;

    const { documents } = selectedRowForModify;

    const selectedDoc = documents[selectedDocumentIndex];
    const docId = selectedDoc?.content?.properties?.id;
    const objectId = selectedRowForModify?.objectId;
    const name = "modify";

    setLoader(true);

    await onModifyDocument(objectId, docId, file, name);

    // cleanup
    setLoader(false);
    e.target.value = null; // allow re-selecting same file
    setShowDocumentDialog(false);
    setSelectedRowForModify(null);
    setSelectedDocumentIndex(0);
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedRowForModify) return;

    const objectId = selectedRowForModify?.objectId;
    const docId = null;
    const name = "upload";

    setUploadLoader(true);

    await onModifyDocument(objectId, docId, file, name);

    // cleanup
    setUploadLoader(false);
    setShowDocumentDialog(false);
    setSelectedRowForModify(null);
    setSelectedDocumentIndex(0);
  };

  const handleDialogClose = () => {
    setShowDocumentDialog(false);
    setSelectedRowForModify(null);
    setSelectedDocumentIndex(0);
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

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", docName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showSweetAlert({
        title: "Download Failed",
        text: error.message || "Failed to download document. Please try again.",
        icon: "error",
      });
    }
  };

  // Handle delete document for endorsement
  const handleDeleteDocument = async (doc) => {
    if (!selectedRowForModify) return;

    try {
      const docId = doc?.content?.properties?.id;
      const objectId = selectedRowForModify?.objectId;

      if (!docId || !objectId) {
        showSweetAlert({
          title: "Error",
          text: "Document or object information is missing.",
          icon: "error",
        });
        return;
      }

      setDeleteLoader(true);

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

      // Refetch documents for this objectId
      const refetchResponse = await digidakInwardService.getInwardDocuments({
        input_parent_folders: objectId,
      });

      const updatedDocuments = refetchResponse?.entries || [];

      // Update endorsementDocuments in parent
      if (onUpdateEndorsementDocuments && typeof onUpdateEndorsementDocuments === "function") {
        onUpdateEndorsementDocuments(objectId, updatedDocuments);
      }

      // Update local documents list in dialog - use refetched documents for consistency
      // If no documents left, close dialog; otherwise update selected row
      if (updatedDocuments.length === 0) {
        setShowDocumentDialog(false);
        setSelectedRowForModify(null);
        setSelectedDocumentIndex(0);
      } else {
        setSelectedRowForModify({
          ...selectedRowForModify,
          documents: updatedDocuments,
        });
        // Reset selected index if it's out of bounds
        if (selectedDocumentIndex >= updatedDocuments.length) {
          setSelectedDocumentIndex(0);
        }
      }

      showSweetAlert({
        title: "Document Deleted",
        text: "Document has been successfully deleted.",
        icon: "success",
      });
    } catch (error) {
      showSweetAlert({
        title: "Delete Failed",
        text: error.message || "Failed to delete document. Please try again.",
        icon: "error",
      });
    } finally {
      setDeleteLoader(false);
    }
  };

  const skeletonRows = Array.from({ length: 25 })?.map((_, index) => ({
    id: index,
    case_name: " ",
    case_subject: " ",
    task_date_sent: " ",
    case_priority: " ",
    case_status: " ",
  }));

  return (
    <>
      <div className="endorsement-table-container bg-white">
        <Grid data={isLoader ? skeletonRows : mergedGridData}>
          {isGenerated && <GridColumn title="Digidak UID" field="digidak_uid" width="100px" cells={{ data: isLoader ? Skeleton : undefined }} />}
          {isGenerated && <GridColumn title="Endorsement UID" field="endorse_uid" width="100px" cells={{ data: isLoader ? Skeleton : undefined }} />}
          <GridColumn title="Type" field="type" cells={{ data: isLoader ? Skeleton : mergeTypeCell }} />
          <GridColumn title="Task Category" field="type_category" cells={{ data: isLoader ? Skeleton : mergeCategoryCell }} />
          <GridColumn title="HO/RO/TE" field="login_office_type" cells={{ data: isLoader ? Skeleton : mergeHOROTECell }} />
          <GridColumn title="Recipients" field="selected_region" cells={{ data: isLoader ? Skeleton : mergeRecipientCell }} />
          <GridColumn title="Document Name" field="document_name" cells={{ data: isLoader ? Skeleton : mergeDocumentNameCell }} />
          <GridColumn width="80px" title="Modify" cells={{ data: isLoader ? Skeleton : mergeModifyCell }} />
          <GridColumn width="80px" title="Action" cells={{ data: isLoader ? Skeleton : endorsementActionCell }} />
        </Grid>
      </div>

      {/* Document Selection Dialog */}
      {showDocumentDialog && selectedRowForModify && (
        <Dialog title="Select Document to Modify" onClose={handleDialogClose} className="document-selection-dialog">
          {(loader || uploadLoader || deleteLoader) && (
            <div className="k-loading-mask">
              <div className="k-loading-image"></div>
            </div>
          )}

          <div className="mb-3">
            <p className="mb-3">Multiple documents found, select one to modify</p>
            <div className="document-list max-h-300 overflow-auto">
              {selectedRowForModify.documents.map((doc, index) => {
                const docName = doc?.content?.properties?.object_name || `Document ${index + 1}`;
                const docId = doc?.content?.properties?.id;
                return (
                  <div
                    key={docId || index}
                    className={`p-2 mb-2 font-size-12 rounded cursor-pointer border ${
                      selectedDocumentIndex === index ? "border-primary bg-primary bg-opacity-10" : "border-secondary bg-white"
                    }`}
                    onClick={() => setSelectedDocumentIndex(index)}
                  >
                    {docName}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button className="common-btn-css cancel-button" onClick={handleDialogClose}>
              Close
            </Button>

            <Button
              className="common-btn-css cancel-button"
              onClick={() => handleDeleteDocument(selectedRowForModify.documents[selectedDocumentIndex])}
              disabled={selectedRowForModify?.documents?.length <= 1}
            >
              {deleteLoader ? "Deleting..." : "Delete"}
            </Button>

            <Button className="common-btn-css save-button" onClick={() => handleDownloadDocument(selectedRowForModify.documents[selectedDocumentIndex])}>
              Download
            </Button>

            <input type="file" ref={fileInputRef} className="d-none" onChange={handleDocumentSelect} />
            <Button className="common-btn-css submit-button" onClick={!loader && handleMultiDocumentSelect}>
              {loader ? "Modifying..." : "Modify"}
            </Button>

            <input type="file" ref={fileUploadRef} className="d-none" onChange={handleUploadDocument} />
            <Button className="common-btn-css submit-button" onClick={!uploadLoader && handleUploadDocumentSelect}>
              {uploadLoader ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
