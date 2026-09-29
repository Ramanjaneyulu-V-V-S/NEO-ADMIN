import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

//components
import Endorsement from "./Endorsement";
import Layout from "../../../components/layout/Layout";
import BulkEndorsementDialog from "./BulkEndorsementDialog";
import DigidakAction from "../../../components/digidakAction/DigidakAction";
import RichTextEditor from "../../../components/richTextEditor/RichTextEditor";
import SelectItemDialog from "../../../components/selectItemDialog/SelectItemDialog";
import FileNumberDialog from "../../../components/fileNumberDialog/FileNumberDialog";

// Kendo UI
import { process } from "@progress/kendo-data-query";
import { Label } from "@progress/kendo-react-labels";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { Checkbox, Input } from "@progress/kendo-react-inputs";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

// react-hook-form
import { Controller, useForm, useWatch } from "react-hook-form";

//import default dropdown data
import { typeData } from "../../data/DropdownData";

// React Icons
import { IoIosClose } from "react-icons/io";
import { FaDownload, FaTrash } from "react-icons/fa6";
import { IoFileTrayFull, IoLinkOutline } from "react-icons/io5";

//react-router-dom
import { useLocation } from "react-router-dom";

//redux
import { useDispatch, useSelector } from "react-redux";

//slice
import { useDigidakGroups } from "../../../hooks/useDigidakGroups";
import { fetchDigidakInboxV2 } from "../../../redux/digidak/inbox/digidakInboxSlice";
import { fetchFileNumbers } from "../../../redux/caseManagement/createCase/createCaseSlice";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import RecipientSelector from "../../../components/OutwardRecipientSelector/RecipientSelector";
//hooks
import ExternalBulkUpload from "./ExternalBulkUpload";
import { useDDMContext } from "../../../hooks/useDDMContext";
import { mapResponseToLetterFields } from "./responseToLetterMapper";
import { useResponseRecipientDisable } from "../../../hooks/useResponseRecipientDisable";
import { useOutwardSubmit } from "./useOutwardSubmit";
import { useOutwardGenerate } from "./useOutwardGenerate";
import { useOutwardPrefill } from "./useOutwardPrefill";
import { useOutwardDocuments } from "./useOutwardDocuments";
import { FormDropdownField as FormDropdownFieldBase, FormInputField as FormInputFieldBase } from "./OutwardFormFields";
import { fetchDOLetterSelectedRecipients, fetchHRMDDoUsers } from "../../../redux/digidak/dropdowns/digidakDropdownSlice";
import { useDigidakDocumentActions } from "../../../hooks/useDigidakDocumentActions";
import ActionButton from "../../../components/actionButton/ActionButton";

const OutwardEntry = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isDDM } = useDDMContext(); // DDM role-based access flags
  const { userProfile } = useSelector((state) => state?.login);
  const userName = userProfile?.properties?.object_name;
  const { fileNumbers: fileNumbersStore, fileNumbersPagination, loading: fileNumbersLoading } = useSelector((state) => state.createCase);
  const { office_type, ro_short_code, department_short_code, department_short_code_multi } = userProfile?.properties || {};

  // Dropdown options for outward form fields (nature, priority, secrecy, etc.)
  const { dropdownData, sourceVerticalData, hrmdDoUsers, loading: dropdownDataLoading } = useSelector((state) => state.digidakDropdown);

  const { loading: outwardLoading } = useSelector((state) => state.digidakOutward);
  // Inbox entries used for "Response to Digidak" lookup — may be flat (v2) or nested (v1)
  const { inboxList } = useSelector((state) => state.digidakInbox);

  // Fetches user's digidak groups for recipient selection
  const groups = useDigidakGroups(userName);
  const isHRMDUser = department_short_code_multi?.includes("hrmd"); // check for hrmd

  const {
    type_category = [],
    priority = [],
    secrecy = [],
    languages = [],
    state_of_sender: state_of_recipient = [],
    received_from: category_external = [],
    mode_of_receipt: mode_of_dispatch = [],
    nature_of_correspondence_internal = [],
    nature_of_correspondence_external = [],
  } = dropdownData || {};

  const secrecyOptions = isDDM ? secrecy.filter((item) => item.text === "Regular") : secrecy;

  const updatedNatureOfCorrespondence = [
    ...nature_of_correspondence_internal,
    {
      text: "Office Order - HO/RO/TE",
      value: "Office Order - HO/RO/TE",
    },
    {
      text: "Office Order",
      value: "Office Order",
    },
  ];

  const send_endorsements = [
    { text: "Yes", value: "Yes" },
    { text: "No", value: "No" },
  ];

  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState({
    objectId: "",
    uidNumber: "",
    folderPath: "",
    iFolderId: "",
  });

  // File Number
  const [isFileNumberDialogOpen, setIsFileNumberDialogOpen] = useState(false);
  const [selectedFileNumber, setSelectedFileNumber] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Response to digidak id
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState(null);
  const [endorsementDocuments, setEndorsementDocuments] = useState({}); // Store documents per outward objectId
  const [documentList, setDocumentList] = useState([]);
  const [processedGridData, setProcessedGridData] = useState([]);
  const [endorsementRows, setEndorsementRows] = useState([]);
  const [endorsementGridData, setEndorsementGridData] = useState([]); // Filtered endorsement entries (excluding main letter)

  // Bulk endorsement dialog state
  const [showBulkEndorsementDialog, setShowBulkEndorsementDialog] = useState(false);

  // Response to letter data from inbox (added for responded flow)
  const responseToLetterData = location.state?.responseToLetterData || null;
  const isResponseFlow = Boolean(responseToLetterData);
  const [isEndorsementValid, setIsEndorsementValid] = useState(true);
  // Shared download/delete handlers for digidak documents
  const { handleDownload, handleDelete } = useDigidakDocumentActions();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
    getValues,
    register,
  } = useForm({
    mode: "onChange",
    defaultValues: {
      type: "Internal",
      subtype: "",
      modeOfDispatch: "",
      subject: "",
      taskCategory: "",
      priority: "",
      secrecy: "Regular",
      language: "Bilingual",
      srcVerticalId: "",
      sendingBulkLetter: false,
      fileNumber: "",
      responseToDigidakId: "",
      dueDate: "",
      documentType: "upload",
      uploadedFile: null,
      department: "",
      ro: "",
      departments: [],
      ros: [],
      categoryExternal: "",
      recipientAddress: "",
      stateOfRecipient: "",
      externalFile: null,
      recipientEmail: "", // for type external only
      in_hrmd_users: [],
      in_outward_vertical: "",
      in_ddm_users: [],
    },
  });

  const copiedData = location.state?.copiedData || null;

  const { responsePrefilled, setResponsePrefilled } = useOutwardPrefill({
    copiedData,
    responseToLetterData,
    isResponseFlow,
    inboxList,
    dropdownData,
    sourceVerticalData,
    reset,
    setSelectedFileNumber,
    setSelectedResponseId,
    setLoader: setLoading,
    setProcessedGridData,
    setEndorsementGridData,
    setEndorsementRows,
    setEndorsementDocuments,
    setDocumentList,
    setGeneratedNumber,
    setIsGenerated,
  });

  const selectedRo = watch("ro");
  const subtype = watch("subtype");
  const selectedDepartment = watch("department");
  const sendEndorsementsData = watch("sendEndorsements");
  const selectBulkEndorsements = watch("bulkEndorsements");

  const prevSubtypeRef = useRef(subtype);

  const type = useWatch({ control, name: "type" });
  const selectedRos = useWatch({ control, name: "ros" });
  const selectedDate = useWatch({ control, name: "dueDate" });
  const selectedCategory = useWatch({ control, name: "taskCategory" });
  const selectedDepartments = useWatch({ control, name: "departments" });
  const sendingBulkLetter = useWatch({ control, name: "sendingBulkLetter" });
  const responseToDigidakId = useWatch({ control, name: "responseToDigidakId" });

  // Disables recipient/RO fields when responding to a non-DDM letter
  const { disableRecipientSelector, disableRO } = useResponseRecipientDisable({
    responseToDigidakId,
    inboxList,
  });

  // shouldShowEndorsement
  const shouldShowEndorsement = type === "Internal" && !isDDM && !(selectedRo?.value === "DDM" || selectedRos?.includes("All DDM"));

  // Auto-set Send Endorsements to "Yes" when subtype is "Office Order"
  useEffect(() => {
    if (subtype === "Office Order" && type === "Internal" && !isGenerated) {
      setValue("sendEndorsements", "Yes", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [subtype, type, isGenerated, setValue]);

  // Auto-set Send Endorsements to "No" when subtype is "DO Letter"
  useEffect(() => {
    if (subtype === "DO Letter" && type === "Internal" && !isGenerated) {
      setValue("sendEndorsements", "No", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [subtype, type, isGenerated, setValue]);

  // Show bulk endorsement dialog when Send Endorsements is set to "Yes"
  useEffect(() => {
    if (sendEndorsementsData == "Yes" && type === "Internal" && selectBulkEndorsements) {
      setShowBulkEndorsementDialog(true);
    }
  }, [sendEndorsementsData, type, selectBulkEndorsements]);

  // Reset Nature of Correspondence when type changes
  useEffect(() => {
    if (!copiedData?.natureOfCorrespondence) {
      setValue("subtype", "");
    }
  }, [type, setValue, copiedData?.natureOfCorrespondence]);

  // Reset HO/RO/TE and related fields when Nature of Correspondence changes
  useEffect(() => {
    if (isResponseFlow || responseToDigidakId) return;
    // Skip reset if form is generated
    if (isGenerated) return;
    // Skip reset if coming from copied data (to preserve pre-filled values)
    if (copiedData?.natureOfCorrespondence) return;
    // Skip on initial mount (when prevSubtypeRef is not yet set)
    if (prevSubtypeRef.current === undefined) {
      prevSubtypeRef.current = subtype;
      return;
    }
    // Only reset if subtype actually changed
    if (prevSubtypeRef.current === subtype) return;

    // Reset single mode fields
    setValue("ro", "");
    setValue("department", "");
    setValue("in_hrmd_users", "");
    setValue("in_outward_vertical", "");
    setValue("in_ddm_users", "");
    setValue("sendingBulkLetter", false);

    // Reset bulk mode fields
    setValue("ros", []);
    setValue("departments", []);

    // Update ref to track current subtype
    prevSubtypeRef.current = subtype;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtype, isResponseFlow, isGenerated, setValue, copiedData?.natureOfCorrespondence]);

  // Correspondence Data based on Type
  const correspondenceData = type === "External" ? nature_of_correspondence_external : isHRMDUser ? updatedNatureOfCorrespondence : nature_of_correspondence_internal;
  const correspondenceResponseFlowData = nature_of_correspondence_internal?.filter((item) => item.value !== "DO Letter");

  // Maps inboxList to dropdown options for "Response to Digidak ID" popup
  const digidakIds = useMemo(() => {
    if (!inboxList) return [];

    return inboxList?.map((item) => {
      const props = item?.content ? (item?.content?.properties ?? {}) : (item ?? {});

      return {
        value: props.uid_number,
        uid: props.uid_number,
        subject: props.letter_subject || "",
        from: props.login_region || "",
        department: props.source_vertical?.[0] || "",
      };
    });
  }, [inboxList]);

  const dropdownFields = [
    { name: "type", label: "Type", data: typeData?.map((item) => item.text) },

    {
      name: "subtype",
      label: "Nature of Correspondence",
      data: isResponseFlow || responseToDigidakId || isDDM ? correspondenceResponseFlowData?.map((item) => item.text) : correspondenceData?.map((item) => item.text),
    },
    {
      name: "modeOfDispatch",
      label: "Mode of Dispatch",
      data: mode_of_dispatch.map((item) => item.text),
    },
    {
      name: "taskCategory",
      label: "Task Category",
      data: type_category.map((item) => item.text),
    },
    {
      name: "priority",
      label: "Priority",
      data: priority.map((item) => item.text),
    },
    {
      name: "secrecy",
      label: "Secrecy",
      data: secrecyOptions.map((item) => item.text),
    },
    {
      name: "language",
      label: "Language",
      data: languages.map((item) => item.text),
    },
    {
      name: "srcVerticalId",
      label: office_type === "RO" ? "Source Department" : "Source Vertical",
      data: sourceVerticalData,
    },
    {
      name: "categoryExternal",
      label: "Category External",
      data: category_external.map((item) => item.text),
    },
    {
      name: "stateOfRecipient",
      label: "State of Recipient",
      data: state_of_recipient.map((item) => item.text),
    },
    {
      name: "sendEndorsements",
      label: "Send Endorsements",
      data: send_endorsements.map((item) => item.text),
    },
    // isDDM
    {
      name: "toDepartmentId",
      label: "To Department",
      data: sourceVerticalData,
    },
  ];

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: 50,
    filter: null,
  });

  const handleDataStateChange = useCallback((e) => {
    setDataState(e.dataState);
  }, []);

  // Collects objectIds from grid data for document fetching
  const outwardObjectIds = useMemo(() => {
    if (!processedGridData || processedGridData.length === 0) return [];
    return processedGridData.map((item) => item?.content?.properties?.id).filter((id) => id);
  }, [processedGridData]);

  const {
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
    setNotesheetDialogOpen,
    setPreviewNotePop,
    setCreatedNotesheet,
    setEditorContent,
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
  } = useOutwardDocuments({
    // Manages file uploads, notesheet editor, and endorsement documents
    generatedNumber,
    isGenerated,
    sendEndorsementsData,
    endorsementRows,
    endorsementGridData,
    outwardObjectIds,
    sendingBulkLetter,
    subtype,
    setLoader: setLoading,
    setEndorsementDocuments,
    documentList,
    setDocumentList,
  });

  // Generates outward UID number and creates folder structure in backend
  const { handleGenerate } = useOutwardGenerate({
    isDDM,
    userName,
    office_type,
    subtype,
    sendEndorsementsData,
    endorsementRows,
    getValues,
    setIsGenerated,
    setLoader: setLoading,
    setShowDialog,
    setProcessedGridData,
    setEndorsementGridData,
    setGeneratedNumber,
  });

  const formFieldProps = useMemo(() => ({ control, errors, isGenerated }), [control, errors, isGenerated]);
  const FormDropdownField = useCallback((props) => <FormDropdownFieldBase {...props} {...formFieldProps} />, [formFieldProps]);
  const FormInputField = useCallback((props) => <FormInputFieldBase {...props} {...formFieldProps} />, [formFieldProps]);

  const fileActionCell = (props) => {
    const data = props.dataItem;

    const onSuccess = async () => {
      try {
        const refetchResponse = await digidakInwardService.getInwardDocuments({
          input_parent_folders: generatedNumber?.objectId,
        });
        setDocumentList(refetchResponse?.entries || []);
        setCreatedNotesheet(false);
        setEditorContent("");
      } catch (error) {
        console.error(error);
      }
    };

    return (
      <td className="d-flex gap-2">
        <ActionButton onClick={() => handleDownload(data)} icon={FaDownload} title="Download" />
        <ActionButton onClick={() => handleDelete(data, onSuccess)} icon={FaTrash} title="Delete" />
      </td>
    );
  };

  const prevDepartmentsRef = useRef(selectedDepartments);

  // Handle bulk endorsement file uploaded callback
  const handleBulkEndorsementFileUploaded = (parsedRows) => {
    setEndorsementRows(parsedRows);
    setShowBulkEndorsementDialog(false);
  };

  // Handle normal flow (No button clicked)
  const handleBulkEndorsementNormalFlow = () => {
    setShowBulkEndorsementDialog(false);
    // Reset bulkEndorsements checkbox to false when "No" is clicked
    setValue("bulkEndorsements", false, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  useEffect(() => {
    const prev = prevDepartmentsRef.current || [];
    const curr = selectedDepartments || [];
    const parentValues = watch("ros") || [];

    // Check if parent has "All" selections
    const isAllSelection = parentValues.includes("All Departments") || parentValues.includes("All RO") || parentValues.includes("All TE") || parentValues.includes("All DDM");
    // Check if parent has only HO/RO/TE (single normal selections)
    const isSingleSelection = parentValues.includes("HO") || parentValues.includes("RO") || parentValues.includes("TE");
    // Condition: user cleared all children
    const childCleared = prev.length > 0 && curr.length === 0;

    if (childCleared) {
      if (isAllSelection) {
        // Clear parent ONLY when "All" options were selected
        setValue("ros", [], { shouldValidate: true });
      }

      if (isSingleSelection) {
        // Do NOT clear parent if HO/RO/TE was selected
        // (just skip clearing)
        return;
      }
    }

    // Update previous state
    prevDepartmentsRef.current = curr;
  }, [selectedDepartments, setValue, watch]);

  useEffect(() => {
    // Coming from response flow OR user manually selects a response letter
    if (isResponseFlow || responseToDigidakId) {
      setValue("taskCategory", "Information");
      return;
    }

    if (type === "External") {
      setValue("taskCategory", "Information");
    } else {
      if (copiedData?.category) {
        setValue("taskCategory", copiedData?.category);
      } else {
        setValue("taskCategory", "");
      }
    }
  }, [type, setValue, copiedData, isResponseFlow, responseToDigidakId]);

  // New Implementation for response to letter manual selection of letter
  useEffect(() => {
    if (isDDM) return;
    if (!responseToDigidakId && responsePrefilled) {
      setValue("ro", "");
      setValue("department", "");
      setValue("in_ddm_users", "");
      setValue("categoryExternal", "");
      setValue("recipientAddress", "");
      setValue("stateOfRecipient", "");
      setSelectedResponseId(null);
      setResponsePrefilled(false);

      return;
    }

    if (responseToDigidakId && !responsePrefilled) {
      const uid = responseToDigidakId?.value ?? responseToDigidakId;

      const matched = inboxList?.find((item) => {
        const props = item?.content ? item.content.properties : item;
        return props?.uid_number === uid;
      });

      if (!matched) return;
      const matchedProps = matched?.content ? matched.content.properties : matched;
      const mapped = mapResponseToLetterFields(matchedProps, dropdownData);

      if (mapped.type) {
        setValue("type", mapped.type, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      const isExternal = getValues("type") === "External";

      if (mapped.ro) {
        setValue("ro", mapped.ro, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      if (mapped.department !== undefined) {
        setValue("department", mapped.department, {
          shouldValidate: false,
          shouldDirty: true,
        });
      }

      if (isExternal) {
        setValue("categoryExternal", mapped.categoryExternal || "", { shouldDirty: true });
        setValue("recipientAddress", mapped.recipientAddress || "", { shouldDirty: true });
        setValue("stateOfRecipient", mapped.stateOfRecipient || "", { shouldDirty: true });
      }

      setSelectedResponseId(mapped.responseToDigidakId || responseToDigidakId);
      setValue("taskCategory", mapped.taskCategory || "Information");
      setResponsePrefilled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseToDigidakId, responsePrefilled, inboxList, dropdownData, setValue, getValues]);

  // Prefill TO Department when Response to digidak is selected for DDM users
  useEffect(() => {
    if (copiedData?.fromProps === "draft-screen") return;
    if (!responseToDigidakId) {
      setValue("toDepartmentId", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
      setResponsePrefilled(false);
      return;
    }
    if (!isDDM) return;
    if (!responseToDigidakId || responsePrefilled) return;

    const uid = responseToDigidakId?.value ?? responseToDigidakId;

    const matched = inboxList?.find((item) => {
      const props = item?.content ? item.content.properties : item;
      return props?.uid_number === uid;
    });

    if (!matched) return;
    const matchedProps = matched?.content ? matched.content.properties : matched;
    const sourceVertical = matchedProps?.source_vertical?.[0];

    if (!sourceVertical) return;

    const mappedSrcVertical = sourceVerticalData?.find((opt) => opt.value === sourceVertical || opt.text === sourceVertical);

    if (mappedSrcVertical) {
      setValue("toDepartmentId", mappedSrcVertical, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    setValue("taskCategory", "Information");
    setResponsePrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDDM, responseToDigidakId, responsePrefilled, inboxList, sourceVerticalData, setValue, copiedData]);

  // Fetch file numbers
  useEffect(() => {
    if (!department_short_code) return;

    const isHO = office_type !== "HO";
    const params = {
      input_ho_ro: office_type,
      input_dept_short_code: department_short_code,

      ...(isHO && { input_ro_short_code: ro_short_code }),
    };

    dispatch(fetchFileNumbers(params));
  }, [department_short_code, dispatch, office_type, ro_short_code]);

  // Fetch inbox data for response to digidak popup
  useEffect(() => {
    if (!userName || !groups.length) return;

    dispatch(
      fetchDigidakInboxV2({
        userName,
        groups,
        mode: "response",
      }),
    );
  }, [dispatch, userName, groups]);

  // Transforms raw grid entries into flat row objects for the Kendo Grid
  const mappedData = useMemo(() => {
    return (
      processedGridData?.map((item) => {
        const { id, i_folder_id, endorse_uid, group_uid, uid_number, r_creator_name, received_from, selected_region, status, letter_no, hrmd_users, office_order_no } =
          item?.content?.properties ?? {};

        return {
          id: id,
          i_folder_id: i_folder_id?.[0],
          endorse_uid: endorse_uid,
          group_uid: group_uid,
          digidak_uid: uid_number,
          sender: r_creator_name,
          recipient: received_from,
          selected_region: hrmd_users?.[0] || selected_region,
          status: status,
          letter_no: letter_no,
          hrmd_users: hrmd_users?.[0],
          office_order_no: office_order_no,
        };
      }) ?? []
    );
  }, [processedGridData]);

  // Handles final form submission (save/send outward letter)
  const { onSubmit } = useOutwardSubmit({
    isDDM,
    watch,
    getValues,
    mappedData,
    generatedNumber,
    endorsementGridData,
    userProfile,
    setLoader: setLoading,
  });

  // Merges endorsement rows with their fetched documents for display
  const endorsementRowsWithDocuments = useMemo(() => {
    if (!isGenerated) return endorsementRows;

    // When coming from draft screen, use objectIds from endorsementGridData
    // Otherwise, use objectIds from outwardObjectIds (skip first one which is main)
    const isFromDraft = copiedData?.fromProps === "draft-screen";

    if (isFromDraft) {
      // For draft screen, use endorsementGridData to get objectIds
      const endorsementObjectIds = endorsementGridData.map((item) => item?.content?.properties?.id).filter((id) => id);

      if (endorsementObjectIds.length === 0) return endorsementRows;

      return endorsementRows.map((row, index) => {
        const objectId = endorsementObjectIds[index];
        const documents = objectId ? endorsementDocuments[objectId] || [] : [];
        const documentNames = documents
          .map((doc) => doc?.content?.properties?.object_name)
          .filter(Boolean)
          .join(", ");

        return {
          ...row,
          document_name: documentNames || "-",
          objectId: objectId,
        };
      });
    } else {
      // For non-draft flow, use outwardObjectIds (skip first one which is main outward)
      if (outwardObjectIds.length <= 1) return endorsementRows;

      const endorsementIds = endorsementGridData.map((item) => item.content?.properties?.id);

      // Skip first one which is main outward
      // const endorsementObjectIds = outwardObjectIds.slice(1);

      // match only those ids which exist in endorsementGridData
      const endorsementObjectIds = outwardObjectIds.filter((id) => endorsementIds.includes(id));

      return endorsementRows.map((row, index) => {
        const objectId = endorsementObjectIds[index];
        const documents = objectId ? endorsementDocuments[objectId] || [] : [];
        const documentNames = documents
          .map((doc) => doc?.content?.properties?.object_name)
          .filter(Boolean)
          .join(", ");

        return {
          ...row,
          document_name: documentNames || "-",
          objectId: objectId,
        };
      });
    }
  }, [endorsementRows, endorsementDocuments, outwardObjectIds, isGenerated, endorsementGridData, copiedData?.fromProps]);

  const processedData = useMemo(() => process(mappedData, dataState), [mappedData, dataState]);
  const processedDocData = useMemo(() => process(docMappedData, dataState), [docMappedData, dataState]);

  // added for responded flow
  // [NOTE] UI-only derived UID (does NOT affect APIs)

  const displayUID = React.useMemo(() => {
    if (copiedData?.navigationSource === "GROUP_UID") {
      return copiedData?.group_uid || "";
    } else if (subtype === "Office Order" && sendingBulkLetter && processedGridData?.length > 0) {
      return processedGridData?.[0]?.content?.properties?.group_uid || "";
    }
    return generatedNumber?.uidNumber || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copiedData, generatedNumber?.uidNumber]);

  const isGenerateDisabled =
    !isValid || isGenerated || (selectedCategory === "Actionable" && selectedDate === "") || (!isDDM && sendEndorsementsData === "Yes" && !isEndorsementValid);

  // Clear external file when type changes
  useEffect(() => {
    if (!(type === "External" && sendingBulkLetter)) {
      setValue("externalFile", null, {
        shouldValidate: true,
      });
    }
  }, [type, sendingBulkLetter, setValue]);

  // Fetch DO users to display in users dropdown in selected recipients component
  useEffect(() => {
    if (type !== "Internal") return;
    if (subtype !== "DO Letter") return;
    if (!isHRMDUser) return;
    if (hrmdDoUsers?.length > 0) return;

    dispatch(fetchHRMDDoUsers({ office_type }));
  }, [type, subtype, isHRMDUser, hrmdDoUsers?.length, office_type, dispatch]);

  useEffect(() => {
    if (subtype !== "DO Letter") return;

    dispatch(fetchDOLetterSelectedRecipients({ office_type: "HO" }));
    dispatch(fetchDOLetterSelectedRecipients({ office_type: "RO" }));
    dispatch(fetchDOLetterSelectedRecipients({ office_type: "TE" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtype]);

  return (
    <Layout screenName={"outwardEntry"} showUploadPop={showUploadPop}>
      {(loading || dropdownDataLoading) && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between my-2">
        <h6 className="case-title-h6">Add New Outward</h6>
        <div className="d-flex align-items-center gap-2">{displayUID && <h6 className="case-title-h7"> UID :{displayUID}</h6>}</div>
      </div>

      <div className="main-container">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <FormDropdownField {...dropdownFields.find((f) => f.name === "type")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "taskCategory")} disabled={Boolean(responseToDigidakId) || type === "External"} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "subtype")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "modeOfDispatch")} />
            <div className="col-xs-12 col-sm-12 col-md-6">
              <Label className="case-form-label">
                Subject of Letter <span className="required-asterisk">*</span>
              </Label>
              <Controller
                name="subject"
                control={control}
                render={({ field }) => <Input autoComplete="off" className="input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />}
              />
            </div>

            <FormDropdownField {...dropdownFields.find((f) => f.name === "priority")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "secrecy")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "language")} />
            <div className="col-xs-12 col-sm-4 col-md-3">
              <Label className="case-form-label">Due Date {selectedCategory === "Actionable" && <span className="required-asterisk">*</span>}</Label>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <DatePicker className="input-border" format="dd/MM/yyyy" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} min={new Date()} />
                )}
              />
            </div>
            <div className="col-xs-12 col-sm-4 col-md-3">
              <div>
                <Label className="case-form-label">
                  File Number <span className="required-asterisk">*</span>
                </Label>
                <Controller
                  name="fileNumber"
                  control={control}
                  rules={{ required: "Please select a file number." }}
                  render={({ field }) => (
                    <div className="input-group">
                      <Input readOnly value={field.value?.value || ""} className="custom-input input-border" disabled={isGenerated} />
                      <div className="border input-group-append" onClick={!isGenerated ? () => setIsFileNumberDialogOpen(true) : undefined}>
                        <IoFileTrayFull size={20} cursor="pointer" />
                      </div>
                    </div>
                  )}
                />
                {errors.fileNumber && <div className="form-error">{errors.fileNumber.message}</div>}
              </div>
            </div>
            <div className="col-xs-12 col-sm-4 col-md-3">
              <div>
                <Label className="case-form-label">Response To DigiDak ID </Label>
                <Controller
                  name="responseToDigidakId"
                  control={control}
                  render={({ field }) => (
                    <div className="input-group">
                      <Input readOnly value={field.value ? field.value.value : ""} className="custom-input" disabled={isGenerated} />
                      {field.value && !isGenerated && (
                        <div
                          className="border input-group-append"
                          onClick={() => {
                            field.onChange(null);
                            setSelectedResponseId(null);
                          }}
                        >
                          <IoIosClose size={20} cursor="pointer" />
                        </div>
                      )}

                      <div className="border input-group-append" onClick={!isGenerated ? () => setIsResponseDialogOpen(true) : undefined}>
                        <IoLinkOutline size={20} cursor="pointer" />
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
            {isDDM ? (
              <FormDropdownField {...dropdownFields.find((f) => f.name === "toDepartmentId")} />
            ) : (
              <FormDropdownField {...dropdownFields.find((f) => f.name === "srcVerticalId")} />
            )}

            {type === "External" && (
              <div className="col-xs-12 col-sm-4 col-md-3">
                <div className="d-flex align-items-center mt-4 bulk-radio-btn">
                  <Controller
                    name="sendingBulkLetter"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Checkbox
                          id="sendingBulkLetter"
                          size="medium"
                          checked={!!field.value}
                          onChange={(e) => {
                            field.onChange(e.value);

                            // Reset dependent fields
                            setValue("ro", "");
                            setValue("department", "");
                            setValue("ros", []);
                            setValue("departments", []);
                          }}
                          disabled={isGenerated}
                        />
                        <label htmlFor="sendingBulkLetter" className="case-form-label ms-2 mb-0 mt-0">
                          Sending Bulk Letter
                        </label>
                      </>
                    )}
                  />
                </div>

                {errors.sendingBulkLetter && <div className="form-error">{errors.sendingBulkLetter.message}</div>}
              </div>
            )}

            {type === "External" && sendingBulkLetter && <ExternalBulkUpload setValue={setValue} isGenerated={isGenerated} />}

            <input
              type="hidden"
              {...register("externalFile", {
                validate: (value) => {
                  const type = watch("type");
                  const isBulk = watch("sendingBulkLetter");

                  if (type === "External" && isBulk && !copiedData?.is_external_excel) {
                    return value ? true : "External bulk Excel file is required";
                  }
                  return true;
                },
              })}
            />

            {/* Additional fields for type external */}
            {type === "External" && !sendingBulkLetter && (
              <>
                <FormDropdownField {...dropdownFields.find((f) => f.name === "categoryExternal")} />
                <FormInputField name="recipientAddress" label="Address Of Recipient" />
                <FormDropdownField {...dropdownFields.find((f) => f.name === "stateOfRecipient")} />
              </>
            )}

            {type === "Internal" && !isDDM && (
              <RecipientSelector
                control={control}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
                disableRO={disableRO}
                isGenerated={isGenerated}
                dropdownData={dropdownData}
                verticalOptions={sourceVerticalData}
                disabled={disableRecipientSelector}
                responseToDigidakId={watch("responseToDigidakId")}
              />
            )}

            {shouldShowEndorsement && <FormDropdownField {...dropdownFields.find((f) => f.name === "sendEndorsements")} disabled={subtype === "DO Letter"} />}

            {sendEndorsementsData == "Yes" && (
              <div className="col-xs-12 col-sm-4 col-md-3">
                <div className="d-flex align-items-center mt-4 bulk-radio-btn">
                  <Controller
                    name="bulkEndorsements"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Checkbox
                          id="bulkEndorsements"
                          size="medium"
                          checked={!!field.value}
                          onChange={(e) => {
                            field.onChange(e.value);
                          }}
                          disabled={isGenerated}
                        />
                        <label htmlFor="bulkEndorsements" className="case-form-label ms-2 mb-0 mt-0">
                          Bulk Endorsement
                        </label>
                      </>
                    )}
                  />
                </div>

                {errors.sendingBulkLetter && <div className="form-error">{errors.sendingBulkLetter.message}</div>}
              </div>
            )}

            {/* Force new row for DigidakAction */}
            <div className="w-100"></div>

            {sendEndorsementsData == "Yes" && type === "Internal" && (
              <div className="col-xs-12 col-sm-12 col-md-12 mt-2">
                <Endorsement
                  isLoader={loading}
                  isGenerated={isGenerated}
                  defaultHoRoTe={selectedRo}
                  dropdownData={dropdownData}
                  onRowsChange={setEndorsementRows}
                  defaultCategory={selectedCategory}
                  typeCategoryOptions={type_category}
                  defaultRecipient={selectedDepartment}
                  onValidityChange={setIsEndorsementValid}
                  endorsementDocuments={endorsementDocuments}
                  onModifyDocument={handleModifyEndorsementDocument}
                  onUpdateEndorsementDocuments={handleUpdateEndorsementDocuments}
                  endorsementRowsWithDocuments={endorsementRowsWithDocuments}
                  initialRows={endorsementRows.length > 0 ? endorsementRows : null}
                  endorsementNo={endorsementGridData.length > 0 ? endorsementGridData : processedGridData}
                />
              </div>
            )}

            {/* CaseAction */}
            <div className="col-md-6">
              <DigidakAction
                loader={loading}
                subtype={subtype}
                tab={selectedAction}
                screenName="outwardEntry"
                setTab={handleSelectTab}
                isGenerated={isGenerated}
                selectedFile={selectedFile}
                uploadedFiles={uploadedFiles}
                documentListData={documentList}
                previewNotesheet={previewNotePop}
                processedDocData={processedDocData}
                handleFileUpload={handleFileUpload}
                createdNotesheet={createdNotesheet}
                sendingBulkLetter={sendingBulkLetter}
                objectId={generatedNumber?.objectId}
                iFolderId={generatedNumber?.iFolderId}
                uidNumber={generatedNumber?.uidNumber}
                openEditor={handleOpenNotesheetEditor}
                onDocumentListUpdate={handleUpdateDocumentList}
                handleFilesAddedToGrid={handleFilesAddedToGrid}
                inEndrose={sendEndorsementsData == "Yes"}
                onUpdateEndorsementDocumentTypes={handleUpdateEndorsementDocumentTypes}
                isEndorsementTrue={sendEndorsementsData == "Yes" && endorsementRows.length > 0}
              />
            </div>

            {/* Buttons */}
            <div className="col-md-6 d-flex flex-column min-height-100 mt-2 mt-md-0">
              <div className="d-flex justify-content-end mt-auto gap-2">
                <Button onClick={() => setShowDialog(true)} className="common-btn-css approve-button" disabled={isGenerateDisabled}>
                  Generate Outward Number
                </Button>
                <Button className="common-btn-css submit-button" type="submit" disabled={!isGenerated || documentList?.length === 0}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* File Number Dialog */}
        {isFileNumberDialogOpen && (
          <FileNumberDialog
            open={isFileNumberDialogOpen}
            fileNumbers={fileNumbersStore}
            onClose={() => setIsFileNumberDialogOpen(false)}
            selectedFileNumber={selectedFileNumber}
            onSelectFileNumber={(fileNumber) => {
              setSelectedFileNumber(fileNumber);
              setValue("fileNumber", fileNumber, {
                shouldDirty: true,
                shouldValidate: true,
                shouldTouch: true,
              });
            }}
            showGroupDropdown={true}
            selectedGroup={selectedGroup}
            onGroupSelect={(selectedGroupValue) => {
              setSelectedGroup(selectedGroupValue);
              const isRO = office_type !== "HO";
              const params = {
                input_ho_ro: office_type,
                input_dept_short_code: selectedGroupValue,
                ...(isRO && { input_ro_short_code: ro_short_code }),
              };
              dispatch(fetchFileNumbers(params));
            }}
            isLoading={fileNumbersLoading}
            paginationTotal={fileNumbersPagination.total}
            onFetch={(page, filters) => {
              const isRO = office_type !== "HO";
              const params = {
                input_ho_ro: office_type,
                input_dept_short_code: selectedGroup || department_short_code,
                ...(isRO && { input_ro_short_code: ro_short_code }),
                page,
                "items-per-page": fileNumbersPagination.itemsPerPage,
                ...filters,
              };
              dispatch(fetchFileNumbers(params));
            }}
          />
        )}

        {isResponseDialogOpen && (
          <SelectItemDialog
            open={isResponseDialogOpen}
            title="Select Letter UID Number"
            items={digidakIds}
            selectedItem={selectedResponseId}
            onSelectItem={(item) => {
              setSelectedResponseId(item);
              setValue("responseToDigidakId", item, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            onClose={() => setIsResponseDialogOpen(false)}
            columns={[
              { field: "uid", title: "UID Number" },
              { field: "subject", title: "Subject" },
              { field: "from", title: "From" },
              ...(isDDM ? [{ field: "department", title: "Department" }] : []),
            ]}
          />
        )}

        {isNotesheetDialogOpen && (
          <Dialog title="Notesheet" className="notesheet-window-editor" onClose={() => setNotesheetDialogOpen(false)}>
            <RichTextEditor value={editorContent} onChange={!isCorrespondenceAdded && onEditorChange} />
            <div className="d-flex justify-content-end mt-3 gap-2">
              <Button className="common-btn-css cancel-button" onClick={() => setNotesheetDialogOpen(false)}>
                CLOSE
              </Button>
              <Button onClick={handleSaveNotesheet} className="common-btn-css submit-button" disabled={!hasValidEditorContent(editorContent) || isCorrespondenceAdded}>
                SAVE
              </Button>
            </div>
          </Dialog>
        )}

        {showDialog && (
          <Dialog title="Letter Confirmation Message" onClose={() => setShowDialog(false)} className="custom-dialog-width">
            <p>You will not be able to modify the entered data after generating the Outward number</p>
            <DialogActionsBar>
              <div className="d-flex justify-content-end gap-2">
                <Button onClick={() => setShowDialog(false)} className="common-btn-css cancel-button">
                  Cancel
                </Button>

                <Button onClick={handleGenerate} className="common-btn-css submit-button" disabled={outwardLoading}>
                  {outwardLoading ? "Generating..." : "Generate"}
                </Button>
              </div>
            </DialogActionsBar>
          </Dialog>
        )}

        <BulkEndorsementDialog
          setLoader={setLoading}
          dropdownData={dropdownData}
          open={showBulkEndorsementDialog}
          onClose={() => {
            setShowBulkEndorsementDialog(false);
            // Reset bulkEndorsements checkbox to false when dialog is closed
            setValue("bulkEndorsements", false, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          onFileUploaded={handleBulkEndorsementFileUploaded}
          onNormalFlow={handleBulkEndorsementNormalFlow}
        />

        <div className="row mt-3 g-1">
          <div className="col-md-6">
            <div className="outward-table-container bg-white">
              <Grid {...dataState} data={processedDocData} sortable={true} resizable={true} onDataStateChange={handleDataStateChange}>
                <GridColumn field="doc_name" title="File Name" />
                <GridColumn field="document_type" title="Document Type" />
                <GridColumn width="100px" title="Action" cells={{ data: fileActionCell }} />
              </Grid>
            </div>
          </div>

          <div className="col-md-6">
            <div className="outward-table-container bg-white">
              <Grid
                {...dataState}
                data={
                  sendEndorsementsData == "Yes" && isGenerated && processedData?.data?.length > 0
                    ? (() => {
                        // Filter to show only items that have group_uid
                        const itemsWithGroupUid = processedData.data.filter((item) => item.group_uid);
                        // If any items have group_uid, show only those; otherwise show only first item
                        return itemsWithGroupUid.length > 0
                          ? {
                              ...processedData,
                              data: itemsWithGroupUid,
                              total: itemsWithGroupUid.length,
                            }
                          : {
                              ...processedData,
                              data: [processedData.data[0]],
                              total: 1,
                            };
                      })()
                    : processedData
                }
                sortable={true}
                resizable={true}
                onDataStateChange={handleDataStateChange}
              >
                {(subtype === "Office Order" || subtype === "Office Order - HO/RO/TE") && <GridColumn title="Office Order No." field="office_order_no" width="110px" />}
                <GridColumn field="digidak_uid" title="Digidak UID" width="90px" />
                <GridColumn field="sender" title="Sender" />
                <GridColumn field="letter_no" title="Letter Number" />
                <GridColumn field="selected_region" title="Dept/RO/TE" />
                <GridColumn field="status" title="Status" />
              </Grid>
            </div>
          </div>
        </div>
        {previewNotePop && (
          <Dialog title="Notesheet Preview" className="notesheet-window-editor" onClose={() => setPreviewNotePop(false)}>
            <RichTextEditor value={editorContent} />
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default OutwardEntry;
