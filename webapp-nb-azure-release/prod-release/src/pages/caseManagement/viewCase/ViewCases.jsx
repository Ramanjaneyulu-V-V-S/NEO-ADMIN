import { useEffect, useState, useCallback, useRef } from "react";

// Styled components
import * as S from "./viewCases.styles";

// Custom components
import WorkFlow from "./workFlow/WorkFlow";
import FBDCases from "./sendCases/SendCase";
import Circulars from "./circulars/Circulars";
import CaseClosure from "./caseClosure/CaseClosure";
import Layout from "../../../components/layout/Layout";
import SplitViewer from "./splitViewer/SplitViewer.jsx";
import AddComments from "./addComments/AddComments.jsx";
import DocumentTable from "./documentTable/DocumentTable";
import ReferenceCases from "./referenceCases/ReferenceCases";
import MovementRegister from "./movementRegister/MovementRegister";
import CaseCancellation from "./caseCancellation/CaseCancellation.jsx";
import AcquirePopup from "../../../components/acquirePopup/AcquirePopup";
import { getSrcdocIframeTargetOrigin } from "../../../components/iv/utils/postMessageTargets";
import { formatLanguage, formatDateOnly } from "../../../utils/Utils";
import CaseInformationDialog from "./caseInformation/CaseInformationDialog";
import PushBackPopup from "../../../components/pushBackPopup/PushbackPopup";
import ErrorBoundary from "../../../components/errorBoundary/ErrorBoundary";
import { CASE_STATUS, DECISION } from "../../../constants/statusConstants";

// Icons
import { MdInfoOutline } from "react-icons/md";
import { FaClipboardList } from "react-icons/fa6";

// Kendo UI components
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";

// Alerts
import Swal from "sweetalert2";

// Animation
import { motion } from "framer-motion";

// Routing
import { useLocation, useNavigate } from "react-router-dom";

// HTTP client
import axiosInstance from "../../../services/axiosConfig";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { sentCaseService } from "../../../services/caseManagement/sentCases/sentCaseService";
import { getDisposalLevels, casePriority, natureOfCase, languages, approveDesignation } from "../../data/DropdownData.jsx";
import { fetchFileNumbers } from "../../../redux/caseManagement/createCase/createCaseSlice";
import { clearCaseDetails, fetchCaseDetails, updateCaseDetails } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";

// Custom hooks
import { usePublishIv } from "../../../hooks/usePublishIv";

// Brava IV config and token management
import HyperlinkHandler from "../../../components/hyperlinkHandler/HyperlinkHandler.jsx";
import { viewCaseService } from "../../../services/caseManagement/viewCase/ViewCaseService";
import { caseDetailsService } from "../../../services/caseManagement/caseDetails/caseDetailsService";
import { fetchDraftDocuments, fetchSupportingDocuments } from "../../../redux/caseManagement/documents/documentSlice.js";

const ViewCases = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const {
    path,
    itemId,
    redirect,
    digidak_uid,
    i_folder_id,
    folderId,
    rCreatorName,
    screenName,
    caseStatus,
    autoNumOutput,
    acquireStatus,
    workflowLinks,
    param_department,
    isInitiateWorkflow,
  } = location.state || {};

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, id, designation, user_grade, object_name, ro_short_code, department_short_code, department_short_code_multi } = userProfile?.properties || {};

  const { caseDetails } = useSelector((state) => state?.caseDetails) || {};
  const { caseTypes, fileNumbers, fileNumbersPagination, loading: fileNumbersLoading } = useSelector((state) => state.createCase);

  const caseOfficeType = caseDetails?.properties?.ho_ro;
  const createdUser = caseDetails?.properties?.r_creator_name;
  const caseDepartment = caseDetails?.properties?.department_short_code;
  const showApproveBtn = approveDesignation?.map((d) => d?.toLowerCase())?.includes(user_grade?.toLowerCase());
  const disposalLevel = caseDetails?.properties?.disposal_level;
  const isSameDesignation = designation?.toLowerCase() === disposalLevel?.toLowerCase();
  const showPushbackBtn = object_name === rCreatorName;
  const isSameWorkflowUser = object_name === createdUser;
  const isSameOfficeType = office_type?.toLowerCase() === caseOfficeType?.toLowerCase();
  const isSameDepartment = Array.isArray(department_short_code_multi) && department_short_code_multi.map((dep) => dep?.toLowerCase()).includes(caseDepartment?.toLowerCase());
  const [tabInfoView, setTabInfoView] = useState("supporting");
  const [isAcquired, setIsAcquired] = useState(acquireStatus);

  const [popups, setPopups] = useState({
    fbd: false,
    movement: false,
    reference: false,
    acquire: false,
    pushBack: false,
    approveCase: false,
    workflow: false,
    caseClosure: false,
    caseCancellation: false,
    caseInfo: false,
    allCirculars: false,
  });
  // Custom hook for IV publishing
  const { publish: publishIv } = usePublishIv();
  const [loading, setLoading] = useState(false);
  const [collapseLeft, setCollapseLeft] = useState(false);
  const [collapseRight, setCollapseRight] = useState(false);
  const [isUserExistData, setIsUserExistData] = useState(false);
  const [approveSendPop, setApproveSendPop] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [taskDetails, setTaskDetails] = useState([]);
  const [publishingId, setPublishingId] = useState(null);
  const [notesheetId, setNotesheetId] = useState(null);
  const [notesheetObjectName, setNotesheetObjectName] = useState(null);
  const [selectedPublicationId, setSelectedPublicationId] = useState(null);
  const [hyperlinkPage, setHyperlinkPage] = useState(null); // Page number to jump to when a hyperlink opens the split viewer
  const [previousPerformer, setPreviousPerformer] = useState([]); // List of users who previously acted on this case (for inbox forward)
  const [isFetchingNotesheet, setIsFetchingNotesheet] = useState(true); // Prevents a blank viewer flash before the notesheet publication ID is ready
  const [movementRegisterData, setMovementRegisterData] = useState([]); // Movement register entries for the current case
  const [comments, setComments] = useState("");
  const [ivTitleName, setIvTitleName] = useState("");
  const [selectedFile1, setSelectedFile1] = useState(null);
  const [commentsDocId, setCommentsDocId] = useState(selectedFile1 ? selectedFile1?.id : null);
  const [notesheetUpdate, setNotesheetUpdate] = useState(false);
  const [movementRegLoader, setMovementRegLoader] = useState(false);

  const isOldCase = location.pathname.includes("view-old-case");

  // Tab configuration for the right panel. Repository and Reference Cases are hidden for old
  const tabOptions = [
    {
      key: "supporting",
      label: "Supporting Document",
    },
    {
      key: "drafts",
      label: "Draft Documents",
    },
    ...(!isOldCase
      ? [
          {
            key: "circulars",
            label: "Repository",
          },
        ]
      : []),

    // Reference Cases tab is hidden for old cases and un acquired inbox cases
    ...((screenName !== "inboxScreen" || isAcquired !== 0) && !isOldCase ? [{ key: "reference", label: "Reference Cases" }] : []),
  ];

  const dropdownOptionsMap = {
    disposallevel: getDisposalLevels(office_type),
    fileno: fileNumbers,
    casetype: caseTypes,
    casepriority: casePriority,
    natureofcase: natureOfCase,
    language: languages,
  };

  const caseFields = [
    ["Subject", caseDetails?.properties?.description],
    ["Case Priority", caseDetails?.properties?.task_priority],
    ["Case Type", caseDetails?.properties?.types],
    ["Nature of Case", caseDetails?.properties?.case_nature],
    ...(caseDetails?.properties?.disposal_level ? [["Disposal Level", caseDetails.properties.disposal_level]] : []),
    ["Case Status", caseDetails?.properties?.status],
    ...(caseDetails?.properties?.status?.toLowerCase() === "cancelled"
      ? [
          [
            "Reason for Cancellation",
            caseDetails?.properties?.reason_for_cancellation
              ? `${caseDetails.properties.reason_for_cancellation.substring(0, 20)}${caseDetails?.properties?.reason_for_cancellation?.length > 20 ? "..." : ""}`
              : "Not provided",
          ],
        ]
      : []),
    ["Department", caseDetails?.properties?.department_name],
    ...(office_type === "HO" ? [["Vertical", caseDetails?.properties?.functions]] : []),
    ["Case Year", caseDetails?.properties?.years],
    ["File No", caseDetails?.properties?.file_number],
    ["Language", isOldCase ? formatLanguage(caseDetails?.properties?.language_type) : caseDetails?.properties?.language_type],
    ["Created By", isOldCase ? caseDetails?.properties?.created_by : caseDetails?.properties?.r_creator_name],
    ...(caseDetails?.properties?.fams_clmas_serial_number ? [["FAMS CLMAS Serial Number", caseDetails.properties.fams_clmas_serial_number]] : []),
    ...(caseDetails?.properties?.fams_clmas_date ? [["FAMS CLMAS Date", formatDateOnly(caseDetails.properties.fams_clmas_date)]] : []),
  ];

  const toCamelCase = (str) => {
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  };

  const handleFieldChange = (label, selectedItem) => {
    const camelLabel = toCamelCase(label);

    setEditValues((prevValues) => ({
      ...prevValues,
      [camelLabel]: selectedItem,
    }));
  };

  // Uses setTimeout so it does not block the calling function's execution.
  const triggerSaveButtonInViewer = useCallback(() => {
    setTimeout(() => {
      try {
        const iframe = document.querySelector('iframe[title*="Brava Viewer"]');

        if (!iframe) {
          return;
        }

        iframe.contentWindow.postMessage(
          {
            type: "TRIGGER_SAVE_BUTTON_CLICK",
            timestamp: Date.now(),
          },
          getSrcdocIframeTargetOrigin(),
        );
      } catch (error) {
        console.error(error);
      }
    }, 0);
  }, []);

  const togglePopup = useCallback(
    (key) => {
      if (key === "fbd") {
        // If the logged-in user is the disposal-level approving authority, prompt them to
        // approve-and-send or just send. Skip this prompt if they created the case themselves.
        if (isSameDesignation && caseStatus !== CASE_STATUS.APPROVED && !isSameWorkflowUser) {
          setApproveSendPop(true);
          Swal.fire({
            icon: "info",
            text: "As per Disposal Level of Case, you are the approving authority",
            showDenyButton: true,
            confirmButtonText: "Approve & Send",
            denyButtonText: "Send",
            customClass: {
              icon: "custom-swal-icons",
              popup: "custom-swal-popup",
              title: "custom-swal-title",
              htmlContainer: "custom-swal-text",
              confirmButton: "common-btn-css save-button",
              denyButton: "common-btn-css save-button",
            },
          }).then((result) => {
            if (result.isConfirmed) {
              setPopups((prev) => ({
                ...prev,
                approveCase: true,
              }));
            } else if (result.isDenied) {
              setPopups((prev) => ({
                ...prev,
                fbd: true,
              }));
            }
          });
        } else {
          setPopups((prev) => ({ ...prev, [key]: !prev[key] }));
        }
      } else {
        setPopups((prev) => ({ ...prev, [key]: !prev[key] }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSameDesignation, triggerSaveButtonInViewer],
  );

  const handleApproveClick = useCallback(() => {
    if (!isSameDesignation) {
      Swal.fire({
        icon: "info",
        text: `As per the case details, the approving authority is ${disposalLevel || "the designated role"}. Please verify before proceeding.`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Approve & Send",
        denyButtonText: "Send without Approval",
        cancelButtonText: "Cancel",
        customClass: {
          icon: "custom-swal-icons",
          popup: "custom-swal-popup",
          title: "custom-swal-title",
          htmlContainer: "custom-swal-text",
          confirmButton: "common-btn-css save-button",
          denyButton: "common-btn-css save-button",
          cancelButton: "common-btn-css cancel-button",
        },
      }).then((result) => {
        if (result.isConfirmed) {
          setPopups((prev) => ({ ...prev, approveCase: true }));
        } else if (result.isDenied) {
          setPopups((prev) => ({ ...prev, fbd: true }));
        }
      });
    } else {
      setPopups((prev) => ({ ...prev, approveCase: true }));
    }
  }, [isSameDesignation, disposalLevel]);

  const handleBackToScreen = () => {
    if (path === "digidakViewEntry") {
      navigate("/dashboard");
      navigate(`/digidak-view/${folderId}`, { state: { digidakObjectId: folderId, screenName: redirect, digidak_uid, i_folder_id } });
      return;
    }
    const routeWithState = { inboxCase: "/inbox", outboxCase: "/outbox", searchCase: "/search-case" };
    const routeNoState = { dashboard: "/dashboard", oldCases: "/old-cases" };
    if (routeWithState[path]) navigate(routeWithState[path], { state: { fromViewCase: true } });
    else if (routeNoState[path]) navigate(routeNoState[path]);
    else navigate("/cases", { state: { fromViewCase: true } });
  };

  const handleSplitView = async (publicationId) => {
    if (publicationId) {
      setSelectedPublicationId(publicationId);
      // Always open (never toggle) when a publicationId is provided so that clicking a
      // hyperlink while the right pane is already open replaces its content rather than closing it
      setSplitView(true);
    } else {
      // No publicationId means this is a close action from the user
      setSplitView((prev) => !prev);
    }
    // Delay clearing hyperlinkPage to give the right pane time to read it on mount
    setTimeout(() => {
      setHyperlinkPage(null);
    }, 1000);
  };
  const handleNotesheetCollapse = () => {
    setCollapseLeft((prev) => !prev); // toggle left pane collapse
    setCollapseRight(false); // ensure right pane is not also collapsed
  };

  const handleSplitViewCollapse = () => {
    setCollapseRight((prev) => !prev); // toggle right pane collapse
    setCollapseLeft(false); // ensure left pane is not also collapsed
  };

  const handleSplitViewClose = () => {
    setSplitView((prev) => !prev); // close/reopen split view
    setCollapseRight(false); // reset right pane collapse state on close
  };

  const handleSaveEditData = async () => {
    // Trigger save button before saving
    triggerSaveButtonInViewer();
    const caseObjectName = caseDetails?.properties?.object_name;
    const folderPath = isOldCase ? `/CMS Legacy/${caseObjectName}` : `/Case/${caseObjectName}`;

    setNotesheetUpdate(false);
    setLoading(true);

    const payload = {
      properties: {
        file_number: editValues?.fileNo?.value,
        disposal_level: editValues?.disposalLevel?.text,
        types: editValues?.caseType?.text,
        task_priority: editValues?.casePriority?.text,
        task_priority_value: editValues?.casePriority?.value,
        case_nature: editValues?.natureOfCase?.text,
        language_type: editValues?.language?.text,
        description: editValues?.subject,
      },
      type: "cms_case_folder",
    };

    try {
      const response = await dispatch(
        updateCaseDetails({
          folderId: caseDetails?.properties?.r_object_id,
          payload: payload,
        }),
      ).unwrap();

      if (response && (response.name || response.status === "success")) {
        await sentCaseService.refreshNotesheet({
          "run-stateless": "true",
          data: {
            variables: {
              case_id: folderId,
            },
          },
        });

        // Use the cached notesheet ID if available; otherwise fetch it from the API
        let noteDocIdToPublish = notesheetId;
        if (!noteDocIdToPublish) {
          try {
            const notesheetResponse = await sentCaseService.getNotesheetId({
              input_folder_path: folderPath,
              ...(isOldCase && { input_object_name: "%- Note Sheet.docx" }),
            });
            noteDocIdToPublish = notesheetResponse?.entries?.[0]?.content?.properties?.id;
          } catch (error) {
            console.error(error);
          }
        }

        // publishIv returns the publication ID directly in its response — no status polling needed here
        if (noteDocIdToPublish) {
          try {
            const newPublicationId = await publishIv(noteDocIdToPublish);

            // noteDocIdToPublish is already the notesheet ID — no second API call needed
            setPublishingId(newPublicationId);
            setNotesheetId(noteDocIdToPublish);

            // Trigger viewer refresh with new publication ID
            setNotesheetUpdate(true);
          } catch {
            // Publish failed — fall back to reading the publishing_id directly from the notesheet API
            try {
              const fallbackResponse = await sentCaseService.getNotesheetId({
                input_folder_path: folderPath,
                ...(isOldCase && { input_object_name: "%- Note Sheet.docx" }),
              });
              const fallbackPubId = fallbackResponse?.entries?.[0]?.content?.properties?.publishing_id;
              const fallbackNoteId = fallbackResponse?.entries?.[0]?.content?.properties?.id;

              if (fallbackPubId) {
                setPublishingId(fallbackPubId);
                if (fallbackNoteId) {
                  setNotesheetId(fallbackNoteId);
                }
                setNotesheetUpdate(true);
              } else {
                // Publication not ready yet — trigger a viewer refresh and let the viewer retry
                setNotesheetUpdate(true);
              }
            } catch (fallbackError) {
              console.error(fallbackError);
              // Fallback also failed — viewer will display its own error state
              setNotesheetUpdate(true);
            }
          }
        } else {
          // No notesheet ID available — trigger a refresh so the viewer shows its empty state
          setNotesheetUpdate(true);
        }

        setLoading(false);
        return true;
      }
      setLoading(false);
      return false;
    } catch (err) {
      console.error(err);
      setLoading(false);
      Swal.fire({ title: "Failed to save case data. Please try again.", icon: "error", confirmButtonColor: "#004B87" });
      return false; // Return failure indicator
    }
  };

  const handleDeleteCase = async () => {
    const result = await Swal.fire({
      icon: "warning",
      text: "Are you sure you want to delete this case?",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      customClass: {
        icon: "custom-swal-icons",
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css cancel-button",
        cancelButton: "common-btn-css save-button",
      },
    });

    if (!result.isConfirmed) return;

    try {
      await viewCaseService.deleteCase(folderId);
      Swal.fire({ icon: "success", text: "Case deleted successfully.", confirmButtonColor: "#004B87" }).then(() => {
        handleBackToScreen();
      });
    } catch {
      Swal.fire({ icon: "error", text: "Failed to delete case. Please try again.", confirmButtonColor: "#004B87" });
    }
  };

  const handleSelectionChange = (selectionData) => {
    setComments(selectionData.comments);
    setCommentsDocId(selectionData?.selectedFile?.id ? selectionData?.selectedFile?.id : selectionData?.commentsDocId);
    setSelectedFile1(selectionData.selectedFile);
  };

  useEffect(() => {
    dispatch(clearCaseDetails());
    dispatch(fetchCaseDetails({ folderId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  // Keyed maps for tracking in-flight polling timeouts and retry counts per publication ID
  const retryAttempts = useRef(new Map());
  const publicationTimeouts = useRef(new Map());
  const isMountedRef = useRef(true);
  // Stable ref so handlePublicationFailed can access notesheetId without a stale closure
  const notesheetIdRef = useRef(null);
  useEffect(() => {
    notesheetIdRef.current = notesheetId;
  }, [notesheetId]);

  // One-shot guard: bound republishes to a single attempt per case load to match the
  // pre-refactor behavior (old code only ran one delayed status-check + republish).
  // Without this, a consistently-failing publish could loop: FAILED → republish → new pubId
  // → viewer remounts → FAILED → republish → ... ad infinitum.
  const republishAttemptedRef = useRef(false);
  useEffect(() => {
    // Reset when the user opens a different case
    republishAttemptedRef.current = false;
  }, [autoNumOutput]);

  // Republish the notesheet when the viewer reports a terminal publication failure.
  // The viewer (Integrated/ReadOnlyBravaViewer) is the single source of truth for status —
  // it polls until COMPLETE/FAILED/ERROR and invokes onFailed only for terminal failures,
  // so we no longer fetch publication status ourselves.
  const handlePublicationFailed = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (republishAttemptedRef.current) return;
    const noteId = notesheetIdRef.current;
    if (!noteId) return;
    republishAttemptedRef.current = true; // set BEFORE await to block concurrent calls
    try {
      const newPublicationId = await publishIv(noteId);
      if (newPublicationId && isMountedRef.current) {
        setPublishingId(newPublicationId);
      }
    } catch (err) {
      console.error("[ViewCases] Republication after failure failed", err);
    }
  }, [publishIv]);

  const [isRequestingNotesheetIvId, setIsRequestingNotesheetIvId] = useState(false);
  const handleRequestNotesheetIvId = useCallback(async () => {
    const folderPath = isOldCase ? `/CMS Legacy/${autoNumOutput}` : `/Case/${autoNumOutput}`;
    let noteId = notesheetId;
    if (!noteId) {
      try {
        const response = await sentCaseService.getNotesheetId({
          input_folder_path: folderPath,
          ...(isOldCase && { input_object_name: "%- Note Sheet.docx" }),
        });
        const props = response?.entries?.[0]?.content?.properties;
        noteId = props?.id ?? props?.r_object_id;
        if (noteId) setNotesheetId(noteId);
      } catch (err) {
        console.error(err);
      }
    }
    if (!noteId) return;
    setIsRequestingNotesheetIvId(true);
    try {
      const newPublicationId = await publishIv(noteId);
      if (newPublicationId && isMountedRef.current) {
        setPublishingId(newPublicationId);
        // Viewer takes over status polling; failure surfaces via handlePublicationFailed.
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMountedRef.current) setIsRequestingNotesheetIvId(false);
    }
  }, [notesheetId, autoNumOutput, isOldCase, publishIv]);

  // On mount, fetches the notesheet document and its Brava publication ID.
  // If no publication ID exists yet (common for old migrated cases), triggers a publish and
  // then starts polling until the document is ready to render in the viewer.
  useEffect(() => {
    const initializePublication = async () => {
      if (!autoNumOutput) {
        return;
      }
      const folderPath = isOldCase ? `/CMS Legacy/${autoNumOutput}` : `/Case/${autoNumOutput}`;

      if (isMountedRef.current) setIsFetchingNotesheet(true);

      try {
        let response = await sentCaseService.getNotesheetId({
          input_folder_path: folderPath,
          ...(isOldCase && { input_object_name: "%- Note Sheet.docx" }),
        });

        // API sometimes returns entries: [] - retry once after a short delay
        const entries = response?.entries ?? [];
        if (entries.length === 0) {
          await new Promise((r) => setTimeout(r, 500));
          if (!isMountedRef.current) return;
          response = await sentCaseService.getNotesheetId({
            input_folder_path: folderPath,
            ...(isOldCase && { input_object_name: "%- Note Sheet.docx" }),
          });
        }

        const props = response?.entries?.[0]?.content?.properties;
        const pubId = props?.publishing_id ?? props?.iv_id;
        const noteId = props?.id ?? props?.r_object_id;

        setPublishingId(pubId);
        setNotesheetId(noteId);
        setNotesheetObjectName(autoNumOutput);

        // API may not have iv_id/publishing_id at all - then we need to publish to get it
        if (!pubId && noteId) {
          try {
            const newPublicationId = await publishIv(noteId);
            if (newPublicationId && isMountedRef.current) {
              setPublishingId(newPublicationId);
              // Viewer polls status itself; terminal failure surfaces via handlePublicationFailed.
            }
          } catch (err) {
            console.error(err);
            // Publish failed — viewer will display its own error state
          }
          return;
        }
        // Existing publication: viewer takes over polling. No pre-flight status fetch needed.
      } catch (error) {
        console.error(error);
      } finally {
        // Always clear the loading state, even on error, to unblock the viewer UI
        if (isMountedRef.current) setIsFetchingNotesheet(false);
      }
    };

    if (autoNumOutput) {
      initializePublication();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNumOutput, isOldCase]);

  useEffect(() => {
    if (!isOldCase) {
      const isHO = office_type === "HO";
      const params = {
        input_ho_ro: office_type,
        ...(isHO ? { input_dept_short_code: department_short_code } : { input_ro_short_code: ro_short_code }),
      };

      dispatch(fetchFileNumbers(params));
    }
  }, [office_type]);

  useEffect(() => {
    if (screenName === "inboxScreen" && workflowLinks) {
      const updateWorkflow = async () => {
        try {
          const response = await axiosInstance.get(`${workflowLinks}?id=${workflowLinks}`);
          if (isMountedRef.current) {
            setTaskDetails(response?.data);
          }
        } catch (error) {
          console.error(error);
        }
      };

      updateWorkflow();
    }
  }, []);

  // Loads movement register entries for the current case to determine previous performers
  // and whether the last action was a push-back.
  useEffect(() => {
    setMovementRegLoader(true);
    const fetchDepartment = async () => {
      try {
        const response = await caseDetailsService.getMovementRegister({
          input_parent_folders: folderId,
        });

        if (isMountedRef.current) {
          const previousUser =
            response?.entries?.map((entry) => ({
              text: entry?.content?.properties?.performer,
              value: entry?.content?.properties?.performer,
            })) || [];

          setMovementRegisterData(response?.entries);
          setPreviousPerformer(previousUser);
          setMovementRegLoader(false);
        }
      } catch (err) {
        console.error(err);
        if (isMountedRef.current) setMovementRegLoader(false);
      }
    };

    fetchDepartment();
  }, [folderId]);

  useEffect(() => {
    const fetchDocs = async () => {
      const folderPath = isOldCase ? `/CMS Legacy/${autoNumOutput}` : `/Case/${autoNumOutput}`;
      try {
        if (path === "digidakViewEntry" || path === "digidakInitiateCase") {
          await dispatch(
            fetchSupportingDocuments({
              input_category: "Supporting",
              input_folder_path: folderPath,
            }),
          );
        } else {
          await dispatch(
            fetchDraftDocuments({
              input_category: CASE_STATUS.DRAFT,
              input_folder_path: folderPath,
            }),
          );
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isOldCase, autoNumOutput]);

  const isMovementPushBack =
    Array.isArray(movementRegisterData) &&
    movementRegisterData.length > 0 &&
    movementRegisterData[movementRegisterData.length - 1]?.content?.properties?.decision === DECISION.PUSH_BACK;

  // Checks whether the logged-in user belongs to the same vertical/department as the case.
  // Not applicable for old migrated cases.
  useEffect(() => {
    const fetchApi = async () => {
      if (isOldCase) return;

      try {
        const response = await viewCaseService.isUserVerticalDepartmentPart({
          "run-stateless": "true",
          data: {
            variables: {
              case_id: folderId,
              profile_id: id,
            },
          },
        });
        if (isMountedRef.current) {
          setIsUserExistData(response?.data?.variables?.is_same_user);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchApi();
  }, []);

  // Clears all pending publication polling timeouts on unmount to prevent state updates
  // on an unmounted component and to avoid memory leaks.
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      publicationTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
      publicationTimeouts.current.clear();
      retryAttempts.current.clear();
    };
  }, []);

  // Derived values for deduplicating AddComments + action button rendering
  const showAddComments = !isOldCase && (screenName === "inboxScreen" ? isAcquired !== 0 : isSameWorkflowUser && caseStatus === CASE_STATUS.DRAFT);
  const isFinishedOrClosed = caseStatus === CASE_STATUS.FINISHED || caseStatus === CASE_STATUS.CLOSED;

  const addCommentsProps = {
    folderId,
    selectedFile1,
    caseId: caseDetails?.properties?.object_name,
    onSelectionChange: handleSelectionChange,
    splitView: handleSplitView,
    ivTitleName: setIvTitleName,
    onPublicationIdSelect: setSelectedPublicationId,
  };

  const renderCaseActionButtons = () => (
    <>
      {!isOldCase && (
        <>
          {(screenName === "createCaseScreen" || screenName === "caseScreen") &&
            !isFinishedOrClosed &&
            isSameWorkflowUser &&
            !isInitiateWorkflow &&
            caseStatus === CASE_STATUS.DRAFT && (
              <Button className="common-btn-css approve-button" onClick={() => togglePopup("workflow")}>
                Initiate Workflow
              </Button>
            )}
            
          {(screenName === "inboxScreen" || screenName === "caseScreen") &&
            isSameWorkflowUser &&
            caseStatus === CASE_STATUS.DRAFT && (
              <Button className="common-btn-css cancel-button" onClick={handleDeleteCase}>
                Delete Case
              </Button>
            )}

          {screenName === "inboxScreen" && isAcquired !== 0 && caseStatus !== CASE_STATUS.APPROVED && isSameDepartment && isSameOfficeType && (
            <Button className="common-btn-css cancel-button" onClick={() => togglePopup("caseCancellation")}>
              Case Cancel
            </Button>
          )}
          {screenName === "inboxScreen" && !isFinishedOrClosed && (
            <>
              {isAcquired !== 0 ? (
                <>
                  {caseStatus === CASE_STATUS.APPROVED
                    ? isUserExistData && (
                        <Button className="common-btn-css approve-button" onClick={() => togglePopup("caseClosure")}>
                          Case Closure
                        </Button>
                      )
                    : showApproveBtn &&
                      !isSameWorkflowUser && (
                        <Button className="common-btn-css save-button" onClick={handleApproveClick}>
                          Approve
                        </Button>
                      )}
                  <Button className="common-btn-css save-button" onClick={() => togglePopup("fbd")}>
                    Send
                  </Button>
                </>
              ) : (
                <>
                  <Button className="common-btn-css approve-button" onClick={() => togglePopup("acquire")}>
                    Acquire
                  </Button>
                  {!showPushbackBtn && !isAcquired && !isMovementPushBack && caseStatus !== CASE_STATUS.APPROVED && (
                    <Button className="common-btn-css save-button" onClick={() => togglePopup("pushBack")}>
                      Push Back
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      <Button className="common-btn-css save-button" onClick={handleBackToScreen}>
        {path === "digidakViewEntry" ? "Back to Digidak" : "Back"}
      </Button>
    </>
  );

  const fbdCommonProps = {
    itemId,
    folderId,
    comments,
    taskDetails,
    caseDetails,
    selectedFile1,
    commentsDocId,
    workflowLinks,
    isUserExistData,
    previousPerformer,
    movementRegisterData,
    param_department: param_department || caseDepartment,
  };

  return (
    <Layout
      screenName="viewCaseScreen"
      approveSendPop={approveSendPop}
      movementPop={popups?.movement}
      caseInfoPop={popups?.caseInfo}
      acquirePopup={popups?.acquire}
      fbdPopup={popups?.fbd}
      referencePop={popups?.reference}
      approvePop={popups?.approveCase}
      workflowPopup={popups?.workflow}
      caseClosurePop={popups?.caseClosure}
      caseCancelPop={popups?.caseCancellation}
      allCircularsPop={popups?.allCirculars}
    >
      {/* Global Hyperlink Handler */}
      <HyperlinkHandler handleSplitView={handleSplitView} onPublicationIdSelect={setSelectedPublicationId} setIvTitleName={setIvTitleName} onHyperlinkPage={setHyperlinkPage} />

      <S.ViewCaseContainer>
        <div className="row g-2">
          <div className={`transition-width ${collapseLeft ? "col-md-12" : "col-md-6"} ${collapseRight ? "d-none" : ""}`}>
            <SplitViewer
              paneId="left" // Left pane: primary notesheet viewer
              ivTitle="Notesheet"
              folderId={folderId}
              screenName={screenName}
              isAcquired={isAcquired}
              caseStatus={caseStatus}
              title="Notesheet Viewer"
              notesheetId={notesheetId}
              collapseLeft={collapseLeft}
              publicationId={publishingId}
              notesheetUpdate={notesheetUpdate}
              previousPerformer={previousPerformer}
              isSameWorkflowUser={isSameWorkflowUser}
              notesheetObjectName={notesheetObjectName}
              caseId={caseDetails?.properties?.object_name}
              handleNotesheetCollapse={handleNotesheetCollapse}
              isResubmitted={caseDetails?.properties?.is_resubmitted}
              onPublicationIdUpdate={setPublishingId}
              onPublicationFailed={handlePublicationFailed}
              isOldCase={isOldCase}
              onRequestIvId={handleRequestNotesheetIvId}
              isRequestingIvId={isRequestingNotesheetIvId}
              isFetchingNotesheet={isFetchingNotesheet} // Prevents a blank viewer flash before the publication ID is ready
            />
          </div>

          <div className={`transition-width ${collapseRight ? "col-md-12" : "col-md-6"} ${collapseLeft ? "d-none" : ""}`}>
            {splitView ? (
              <SplitViewer
                key={`splitviewer-${isAcquired}-${caseStatus}-${isSameWorkflowUser}`}
                paneId="right" // Right pane: opens when user clicks a hyperlink or supporting document
                splitView={splitView}
                ivTitle={ivTitleName}
                screenName={screenName}
                caseStatus={caseStatus}
                collapseRight={collapseRight}
                publicationId={selectedPublicationId}
                hyperlinkPage={hyperlinkPage} // Page number to navigate to when opened from a hyperlink
                handleSplitView={handleSplitViewClose}
                handleSplitViewCollapse={handleSplitViewCollapse}
                title={`Case: ${caseDetails?.properties?.object_name}`}
                isSameWorkflowUser={isSameWorkflowUser}
                isAcquired={isAcquired}
                isResubmitted={caseDetails?.properties?.is_resubmitted ?? false}
                isOldCase={isOldCase}
              />
            ) : (
              <div className="card-container position-relative rounded">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="case-info-label">Case: {caseDetails?.properties?.object_name}</h6>
                  <div>
                    <span
                      className="icon-wrapper icon-clickable me-2"
                      title="Case Information"
                      onClick={() => {
                        togglePopup("caseInfo");
                      }}
                    >
                      <MdInfoOutline cursor="pointer" title="Case Information" />
                    </span>
                    {caseStatus !== CASE_STATUS.DRAFT && (
                      <span
                        className="icon-wrapper icon-clickable me-2"
                        title="Movement Register"
                        onClick={() => {
                          togglePopup("movement");
                        }}
                      >
                        <FaClipboardList size="14px" color="#5e9bf7" />
                      </span>
                    )}
                  </div>
                </div>

                <hr className="hr" />

                <div className="tab-container">
                  <header>
                    <div className="inbox-tabs" role="tablist">
                      {tabOptions?.map(({ key, label }) => (
                        <div key={key} className={`inbox-tab-item ${key === tabInfoView ? "active" : ""}`}>
                          <button
                            type="button"
                            role="tab"
                            title={label}
                            aria-selected={key === tabInfoView}
                            className="inbox-tab-btn"
                            onClick={() => {
                              if (key === "reference") {
                                togglePopup("reference");
                              } else {
                                setTabInfoView(key);
                              }
                            }}
                          >
                            {key === tabInfoView && (
                              <motion.div
                                className="active-highlight"
                                layoutId="highlight"
                                transition={{
                                  layout: {
                                    duration: 0.3,
                                    ease: "easeInOut",
                                  },
                                }}
                              />
                            )}
                            {key !== tabInfoView && <div className="passive-highlight"></div>}
                            <span>{label}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </header>

                  <div>
                    {movementRegLoader && (
                      <div className="k-loading-mask">
                        <div className="k-loading-image"></div>
                      </div>
                    )}

                    {(tabInfoView === "supporting" || tabInfoView === "drafts") && (
                      <DocumentTable
                        screenName={screenName}
                        caseStatus={caseStatus}
                        isAcquired={isAcquired}
                        tabInfoView={tabInfoView}
                        showApproveBtn={showApproveBtn}
                        isSameWorkflowUser={isSameWorkflowUser}
                        isInitiateWorkflow={isInitiateWorkflow}
                        splitView={handleSplitView}
                        caseDetailsData={caseDetails?.properties}
                        ivTitleName={setIvTitleName}
                        onPublicationIdSelect={setSelectedPublicationId}
                        isOldCase={isOldCase}
                      />
                    )}

                    {tabInfoView === "circulars" && (
                      <Circulars caseDetailsData={caseDetails?.properties} onAllCircularsDialogToggle={(isOpen) => setPopups((prev) => ({ ...prev, allCirculars: isOpen }))} />
                    )}
                  </div>
                </div>
                <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                  {showAddComments && <AddComments {...addCommentsProps} />}
                  <div className="d-flex justify-content-end gap-2 mt-2">{renderCaseActionButtons()}</div>
                </div>
              </div>
            )}
          </div>

          {splitView && (
            <>
              {showAddComments && <AddComments {...addCommentsProps} />}
              <div className="d-flex justify-content-end gap-2 mb-2">{renderCaseActionButtons()}</div>
            </>
          )}
        </div>
        <ErrorBoundary>
          <AcquirePopup
            screen="viewCase"
            folderId={folderId}
            visible={popups.acquire}
            caseName={autoNumOutput}
            workflowLinks={workflowLinks}
            onClose={() => togglePopup("acquire")}
            onAcquired={() => setIsAcquired(1)}
          />
          <PushBackPopup itemId={itemId} screen="viewCase" folderId={folderId} rCreatorName={rCreatorName} visible={popups.pushBack} onClose={() => togglePopup("pushBack")} />
          <MovementRegister folderId={folderId} visible={popups?.movement} movementRegisterData={movementRegisterData} onClose={() => togglePopup("movement")} />
          <CaseInformationDialog
            loading={loading}
            caseStatus={caseStatus}
            caseFields={caseFields}
            editValues={editValues}
            isAcquired={isAcquired}
            toCamelCase={toCamelCase}
            caseDetails={caseDetails}
            visible={popups.caseInfo}
            fileNumbers={fileNumbers}
            setEditValues={setEditValues}
            handleFieldChange={handleFieldChange}
            movementRegLoader={movementRegLoader}
            onClose={() => togglePopup("caseInfo")}
            dropdownOptionsMap={dropdownOptionsMap}
            handleSaveEditData={handleSaveEditData}
            isSameWorkflowUser={isSameWorkflowUser}
            isInitiateWorkflow={isInitiateWorkflow}
            movementRegisterData={movementRegisterData}
            fileNumbersLoading={fileNumbersLoading}
            fileNumbersPagination={fileNumbersPagination}
            onFileNumbersFetch={(page, filters) => {
              const params = {
                input_ho_ro: office_type,
                input_dept_short_code: department_short_code,
                ...(office_type !== "HO" && { input_ro_short_code: ro_short_code }),
                page,
                "items-per-page": fileNumbersPagination.itemsPerPage,
                ...filters,
              };
              dispatch(fetchFileNumbers(params));
            }}
          />
          <ReferenceCases
            folderId={folderId}
            screenName={screenName}
            caseStatus={caseStatus}
            visible={popups.reference}
            isAcquired={isAcquired}
            isSameWorkflowUser={isSameWorkflowUser}
            caseDetailsData={caseDetails?.properties}
            onClose={() => togglePopup("reference")}
          />
          <WorkFlow
            comments={comments}
            folderId={folderId}
            screenName={screenName}
            visible={popups.workflow}
            selectedFile1={selectedFile1}
            commentsDocId={commentsDocId}
            onClose={() => togglePopup("workflow")}
          />

          <FBDCases {...fbdCommonProps} tagName="fbd" visible={popups.fbd} onClose={() => setPopups((prev) => ({ ...prev, fbd: false }))} />
          <FBDCases {...fbdCommonProps} tagName="approveCase" visible={popups.approveCase} onClose={() => togglePopup("approveCase")} />
          <CaseClosure
            comments={comments}
            caseName={autoNumOutput}
            taskDetails={taskDetails}
            visible={popups.caseClosure}
            workflowLinks={workflowLinks}
            selectedFile1={selectedFile1}
            commentsDocId={commentsDocId}
            onClose={() => togglePopup("caseClosure")}
          />
          <CaseCancellation
            folderId={folderId}
            taskDetails={taskDetails}
            workflowLinks={workflowLinks}
            visible={popups.caseCancellation}
            previousPerformer={previousPerformer}
            onClose={() => togglePopup("caseCancellation")}
            caseNumber={caseDetails?.properties?.object_name || "N/A"}
          />
        </ErrorBoundary>
      </S.ViewCaseContainer>
    </Layout>
  );
};

export default ViewCases;
