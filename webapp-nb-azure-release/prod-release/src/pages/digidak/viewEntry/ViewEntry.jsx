import React, { useEffect, useState, useMemo } from "react";

// router
import { useLocation, useNavigate } from "react-router-dom";

// constants
import { DIGIDAK_STATUS, CATEGORY } from "../../../constants/statusConstants";

// components
import Layout from "../../../components/layout/Layout";
import ViewRespondedActions from "./ViewRespondedActions";
import Skeleton from "../../../components/Loader/Skeleton";
import DigidakSplitViewer from "../splitViewer/DigidakSplitViewer";
import ActionButton from "../../../components/actionButton/ActionButton";

//kendo component
import { process } from "@progress/kendo-data-query";
import { Label } from "@progress/kendo-react-labels";
import { DropDownList, MultiSelect } from "@progress/kendo-react-dropdowns";

// Redux
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { fetchDigidakVerticalHeadGroups, provideDigidakPermission, fetchDigidakVerticalUsers } from "../../../redux/digidak/correspondence/digidakCorrespondenceSlice";

// kendo
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { PanelBar, PanelBarItem } from "@progress/kendo-react-layout";
import { Dialog } from "@progress/kendo-react-dialogs";

//icons
import { MdCompare } from "react-icons/md";
import { FaEye, FaDownload } from "react-icons/fa6";

//motion
import { motion } from "framer-motion";

// styles
import "./ViewEntry.css";
import * as S from "../../caseManagement/viewCase/viewCases.styles";

//redux
import { useDispatch, useSelector } from "react-redux";
import { usePublishIv } from "../../../hooks/usePublishIv";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

// Axios
import axiosInstance from "../../../services/axiosConfig";

// Service
import { ServiceUrl } from "../../../services/serviceUrl";
import ViewEntryLettersGrid from "./ViewEntryLettersGrid";
import { pushbackDigidak } from "../../../redux/digidak/inbox/digidakInboxSlice";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import useGroupPermissionCheck from "./useGroupPermissionCheck";
import buildDigidakFields from "./buildDigidakFields";
import CommentDialog from "./CommentDialog";
import getViewEntryFlags from "./getViewEntryFlags";
import DigidakFieldValue from "./DigidakFieldValue";

const ViewEntry = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { publish: publishIv } = usePublishIv();

  const { screenName, digidak_uid, i_folder_id, pathname, isClickFromViewEntry } = location.state || {};

  // Navigation source — if coming from DDM listing, we should hide action buttons and show only Back
  const navigatedFromDDMCommunication = (pathname || "").includes("/ddm-inward") || (pathname || "").includes("/ddm-outward");

  const { userProfile } = useSelector((state) => state.login);
  const userName = userProfile?.properties?.object_name;

  const { verticalHeadGroups, verticalUsers = [] } = useSelector((state) => state.digidakCorrespondence);

  const [digidakItem, setDigidakItem] = useState(null);

  const isUserAllowed = useGroupPermissionCheck(userName, digidakItem?.vertical_head, {
    includeLoginUser: true,
    mergeUsers: digidakItem?.vertical_users || "-",
  });
  const selectedVerticalHeadName = useGroupPermissionCheck(userName, digidakItem?.vertical_head);
  const selectedCGMGroupNameBase = useGroupPermissionCheck(userName, digidakItem?.selected_cgm_group);
  const selectedCGMGroupNamePs = useGroupPermissionCheck(userName, digidakItem?.selected_cgm_group ? `${digidakItem.selected_cgm_group}_ps` : undefined);
  const selectedCGMGroupName = selectedCGMGroupNameBase || selectedCGMGroupNamePs;

  const isLetterbox = pathname === "/digidak-letterbox" && digidakItem?.status !== DIGIDAK_STATUS.UNREAD;

  const {
    isDDM,
    isGroupLetter,
    canShowPushback,
    canShowDDMAssignToDropdownDDM,
    canShowReassignButtonDDM,
    canShowAcknowledgeAndCloseButtonDDM,
    canShowCloseButtonDDM,
    canShowAssignUserDropdownDDM,
    canShowAssignUserButtonDDM,
    canShowReassignUserButtonDDM,
    canShowRespondedActionsDDM,
    canShowInitiateCaseButtonDDM,
    showOpenButton,
    showInitiateCaseButton,
    viewUserButton,
    viewReassignCorrespondenceButton,
    AcknowledgeCloseBtnCondition,
    AcknowledgeCloseBtnCondition2,
  } = getViewEntryFlags({
    digidakItem,
    screenName,
    userName,
    isUserAllowed,
    selectedVerticalHeadName,
    selectedCGMGroupName,
    navigatedFromDDMCommunication,
    isClickFromViewEntry,
    pathname,
  });

  const [selectedVerticalHead, setSelectedVerticalHead] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [loader, setLoader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callMovementRegAPI, setCallMovementRegAPI] = useState(false);
  const [visible, setVisible] = useState(false);
  const [vitualUsersData, setVitualUsersData] = useState([]);

  // Comment Popup
  const [commentAction, setCommentAction] = useState(null); // "CLOSE" | "PUSHBACK"
  const [showCommentPopup, setShowCommentPopup] = useState(false);
  const [showEndorsementGridDialog, setShowEndorsementGridDialog] = useState(false);
  const [showEndorsementGridData, setShowEndorsementGridData] = useState([]);

  const dataState = useMemo(
    () => ({
      sort: [{ field: "id", dir: "dec" }],
      skip: 0,
      take: 50,
      filter: null,
    }),
    [],
  );

  const handleViewUser = async () => {
    setVitualUsersData([]);
    let viewGroupName = selectedVerticalHead.value.replace("_vertical_head", "");

    const payloadData = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "vertical_head_group",
          in_group_name: viewGroupName,
        },
      },
    };

    try {
      const response = await axiosInstance.post(ServiceUrl.getDigidakSourceVertical, payloadData);

      const names = response?.data?.data?.variables?.out_groups_user || [];
      const displayNames = response?.data?.data?.variables?.group_display_name || [];

      const usersList = names.map((user, index) => ({
        verticalName: displayNames[index],
        userNames: user,
      }));

      setVitualUsersData(usersList);
    } catch (error) {
      console.error(error);
      setVisible(false);
      setVitualUsersData([]);
    }

    setVisible(true);
  };

  const closeViewUserDialog = () => {
    setVisible(false);
    setVitualUsersData([]);
  };

  const [popups, setPopups] = useState({
    movement: false,
  });

  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState([]);
  const [viewDoc, setViewDoc] = useState([]);
  const [activeTab, setActiveTab] = useState("document");

  const [splitView, setSplitView] = useState(false); // New state for split view
  const [collapseLeft, setCollapseLeft] = useState(false);
  const [collapseRight, setCollapseRight] = useState(false);
  // true until the initial fetch (+ optional republish) completes — prevents viewer mounting with no ID
  const [isViewerLoading, setIsViewerLoading] = useState(true);

  const digidakFields = buildDigidakFields(digidakItem, { screenName, isGroupLetter });

  // Open split view for a document
  const handleSplitView = (doc) => {
    const publicationId = doc?.publicationId;
    if (publicationId) {
      setSelectedDocument(doc);
      setSplitView(true);
      setCollapseLeft(false);
      setCollapseRight(false);
    }
  };

  // Initiate Case handler
  const handleInitiateCase = (id) => {
    navigate(`/create-case`, {
      state: {
        path: "digidakInitiateCase",
        digidakObjectId: id,
      },
    });
  };

  const handleDocumentView = (doc) => {
    const publicationId = doc?.publicationId;
    if (publicationId) {
      setViewDoc(doc);
    }
  };

  // Close split view
  const handleSplitViewClose = () => {
    setSplitView(false);
    setCollapseLeft(false);
    setCollapseRight(false);
  };

  // Collapse/expand right panel in split view
  const handleSplitViewCollapse = () => {
    setCollapseRight((prev) => !prev); // toggle right
    setCollapseLeft(false); // always close left
  };

  // Reusable function (API call)
  const triggerAction = async (actionType, extra = {}) => {
    const folderId = digidakItem?.id;

    if (!folderId) {
      return;
    }

    setLoader(true);

    const res = await dispatch(
      provideDigidakPermission({
        folderId,
        actionType,
        loginUser: userName,
        extra,
      }),
    );

    if (provideDigidakPermission.fulfilled.match(res)) {
      if (actionType === DIGIDAK_STATUS.OPENED) {
        // Update local UI status for Open
        setDigidakItem((prev) => ({
          ...prev,
          status: DIGIDAK_STATUS.OPENED,
        }));

        setLoader(false);
        setCallMovementRegAPI(true);
        return;
      }

      // DDM-specific navigation
      if (isDDM) {
        if (screenName === "viewInward") {
          navigate("/digidak-inbox", { state: { fromViewCase: true } });
        } else if (screenName === "viewOutward") {
          navigate("/digidak-outbox", { state: { fromViewCase: true } });
        }
      } else if (isLetterbox) {
        navigate("/digidak-letterbox", { state: { fromViewCase: true } });
      } else if (actionType === DIGIDAK_STATUS.FOLLOW_UP || actionType === DIGIDAK_STATUS.RESPONSE_CLOSE) {
        // navigate to Outbox after responded actions
        navigate("/digidak-outbox", { state: { fromViewCase: true } });
      } else if (actionType !== "Opened") {
        navigate("/digidak-inbox", { state: { fromViewCase: true } });
      }

      setLoader(false);
      setCallMovementRegAPI(true);
    } else {
      setLoader(false);
    }
  };

  const handleOpenFolder = () => {
    triggerAction(DIGIDAK_STATUS.OPENED);
  };

  // Fetch Vertical Head Groups
  useEffect(() => {
    if (userProfile?.properties?.object_name) {
      dispatch(fetchDigidakVerticalHeadGroups(userProfile.properties.object_name));
    }
  }, [dispatch, userProfile]);

  useEffect(() => {
    if (digidakItem?.id && userProfile?.properties?.object_name) {
      dispatch(
        fetchDigidakVerticalUsers({
          folderId: digidakItem.id,
          loginUser: userProfile.properties.object_name,
        }),
      );
    }
  }, [dispatch, digidakItem?.id, userProfile?.properties?.object_name]);

  const handleVerticalHeadSubmit = () => {
    if (!selectedVerticalHead?.value && !selectedVerticalHead?.text) {
      return;
    }

    triggerAction(DIGIDAK_STATUS.ASSIGNED_HEAD, {
      in_vertical_head_display_name: selectedVerticalHead.text,
      in_vertical_head_group_name: selectedVerticalHead.value, // newly added
    });
  };

  const handleVerticalReAssignHeadSubmit = () => {
    if (!selectedVerticalHead?.value && !selectedVerticalHead?.text) {
      return;
    }

    triggerAction(DIGIDAK_STATUS.REASSIGN_HEAD, {
      in_vertical_head_display_name: selectedVerticalHead.text,
      in_vertical_head_group_name: selectedVerticalHead.value, // newly added
    });
  };

  const handleReAssignUser = () => {
    if (!selectedUsers?.length) {
      return;
    }
    triggerAction("Reassign User", {
      in_vertical_users: selectedUsers.map((u) => u.value),
    });
  };

  const handleAssignUser = () => {
    if (!selectedUsers?.length) {
      return;
    }
    triggerAction(DIGIDAK_STATUS.ASSIGNED, {
      in_vertical_users: selectedUsers.map((u) => u.value),
    });
  };

  // Acknowledged and close
  const handleAcknowledge = () => {
    triggerAction(DIGIDAK_STATUS.CLOSED);
  };

  //  Fetch Documents — and republish any that are missing a publicationId before showing the viewer
  useEffect(() => {
    const folderId = digidakItem?.id;
    const groupUid = digidakItem?.group_uid;
    const iFolderId = digidakItem?.i_folder_id?.length > 0 ? digidakItem.i_folder_id[0] : i_folder_id?.[0];

    if (!folderId) return;

    const mapDocs = (entries) =>
      (entries || []).map((entry) => {
        const props = entry?.content?.properties;
        return {
          id: props?.id,
          documentName: props?.object_name,
          documentType: props?.document_type,
          digidakUid: props?.uid_number,
          publicationId: props?.publishing_id,
        };
      });

    const run = async () => {
      try {
        const parentFolderToUse = groupUid && iFolderId ? iFolderId : folderId;
        const res = await digidakInwardService.getInwardDocuments({ input_parent_folders: parentFolderToUse });
        const docs = mapDocs(res?.entries);

        const missingIds = docs.filter((doc) => doc.id && !doc.publicationId).map((doc) => doc.id);

        if (missingIds.length > 0) {
          // Publish all missing IVs, then re-fetch to get updated publicationIds
          await Promise.allSettled(missingIds.map((id) => publishIv(String(id)).catch(() => null)));
          const refreshed = await digidakInwardService.getInwardDocuments({ input_parent_folders: parentFolderToUse });
          const updatedDocs = mapDocs(refreshed?.entries);
          setDocuments(updatedDocs);
          setViewDoc(updatedDocs[0]);
        } else {
          setDocuments(docs);
          setViewDoc(docs[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsViewerLoading(false);
      }
    };

    run();
  }, [digidakItem?.id, digidakItem?.group_uid, digidakItem?.i_folder_id?.[0], i_folder_id?.[0]]);

  // document download and delete
  const handleDownloadDocument = async (doc) => {
    try {
      const blob = await documentService.downloadDocument(doc.id);

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", doc.documentName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const handleBackToScreen = () => {
    if (screenName === "viewInward") {
      navigate(pathname || "/digidak-inbox", { state: { fromViewCase: true } });
    } else if (screenName === "viewOutward") {
      navigate("/digidak-outbox", { state: { fromViewCase: true } });
    } else {
      navigate(-1);
    }
  };

  const togglePopup = (key) => {
    setPopups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Fetch Movement Register Data
  useEffect(() => {
    const fetchMovementRegister = async () => {
      if (!digidakItem?.id) return;

      const response = await dispatch(
        fetchDigidakMovementRegister({
          input_parent_folders: digidakItem?.id,
        }),
      );

      if (response.type === "getDigidakMovementRegister/fulfilled") {
        setMovementRegisterData(response.payload || []);
        setPopups((prev) => ({ ...prev, movementRegister: true }));
      }
    };

    fetchMovementRegister();
  }, [digidakItem?.id, callMovementRegAPI, dispatch]);

  // Fetch View Entry Data
  useEffect(() => {
    const fetchViewEntryData = async () => {
      if (!digidak_uid) return;

      setLoader(true);

      const response = await digidakInwardService.getDigidakInwardGridData({
        input_uid_number: digidak_uid,
      });

      setDigidakItem(response?.entries?.[0]?.content?.properties);
      setLoader(false);
    };

    fetchViewEntryData();
  }, [digidak_uid]);

  const handleSaveComment = async ({ userComment, selectedFile }) => {
    setShowCommentPopup(false);
    setLoader(true);

    try {
      if (commentAction === "PUSHBACK") {
        await dispatch(
          pushbackDigidak({
            folderId: digidakItem?.id,
            loginUser: userName,
            extra: {
              in_pushback_comments: userComment,
            },
          }),
        ).unwrap();

        navigate("/digidak-inbox");
      } else {
        if (selectedFile) {
          try {
            const folderId = digidakItem?.id;
            const groupUid = digidakItem?.group_uid;
            const iFolderId = digidakItem?.i_folder_id?.length > 0 ? digidakItem.i_folder_id[0] : i_folder_id?.[0];

            const parentFolderToUse = groupUid && iFolderId ? iFolderId : folderId;

            // Step 1: Get upload path
            const uploadRes = await documentService.getFilePath(selectedFile);

            const fileSrc = uploadRes?.entries?.[0]?.content?.src;
            if (!fileSrc) throw new Error("File upload failed");

            // Step 2: Prepare upload payload
            const uploadPayload = {
              properties: {
                a_content_type: "msw12",
                r_object_type: "cms_digidak_document",
                object_name: selectedFile.name,
                folder_id: parentFolderToUse,
              },
              type: "cms_digidak_document",
              source: fileSrc,
            };

            // Step 3: Upload + update + render
            const response = await documentService.uploadDocument(uploadPayload);

            // Publish to IV
            if (response?.properties?.r_object_id) {
              try {
                await publishIv(String(response.properties.r_object_id));
              } catch (error) {
                console.error(error);
              }
            }

            await digidakInwardService.updateDocumentsType({
              docId: response?.properties?.r_object_id,
              document_type: "Attachment",
              object_name: response?.properties?.object_name,
              uid_number: digidak_uid,
            });

            await digidakInwardService.getInwardDocuments({
              input_parent_folders: parentFolderToUse,
            });
          } catch (error) {
            showSweetAlert({
              title: "Upload Failed",
              text: error.message || "Failed to upload file(s). Please try again.",
              icon: "error",
            });
            return;
          }
        }

        triggerAction("Closed", {
          in_user_comments: userComment,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoader(false);
      setCommentAction(null);
    }
  };

  // Follow up and close for responded letters
  const handleFollowUp = () => {
    triggerAction(DIGIDAK_STATUS.FOLLOW_UP);
  };

  const handleRespondedClose = () => {
    triggerAction(DIGIDAK_STATUS.RESPONSE_CLOSE);
  };

  // Handle click on Responding UID
  const handleRespondingUIDClick = async () => {
    setLoading(true);

    try {
      const respondingUID = digidakItem?.responding_uid?.[0];

      if (!respondingUID) {
        throw new Error("Responding UID not found");
      }

      const response = await digidakInwardService.getDigidakInwardGridData({
        input_uid_number: respondingUID,
      });

      const data = response?.entries?.[0]?.content?.properties || {};

      navigate(`/digidak-view/${data?.id}`, {
        state: {
          digidakObjectId: data?.id,
          screenName: "viewOutward",
          digidak_uid: data?.uid_number,
          i_folder_id: data?.i_folder_id?.[0],
        },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Handle click on Endorsement UID
  const handleEndorsementUIDClick = async () => {
    setLoading(true);
    setShowEndorsementGridDialog(true);

    try {
      const endorsementUID = digidakItem?.endorse_uid;

      if (!endorsementUID) {
        throw new Error("Endorsement UID not found");
      }

      const response = await digidakInwardService.getDigidakInwardGridData({
        input_endorse_uid: endorsementUID,
        input_is_endorsed_letter: true,
      });

      setShowEndorsementGridData(response?.entries || []);
      setLoading(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const EndorsementNumberCell = (props) => (
    <td>
      <span className="digidak-uid-span cursor-pointer" onClick={() => handleNavigateEndorsementUID(props)}>
        {props.dataItem.uid_number}
      </span>
    </td>
  );

  const handleNavigateEndorsementUID = async (props) => {
    const data = props.dataItem;

    navigate(`/digidak-view/${data?.id}`, {
      state: {
        digidakObjectId: data?.id,
        screenName: "viewOutward",
        digidak_uid: data?.uid_number,
        i_folder_id: data?.i_folder_id?.[0],
      },
    });

    setShowEndorsementGridDialog(false);
  };

  // Handle click on Case Number
  const handleCaseNumberClick = async () => {
    const caseNumber = digidakItem?.case_number;

    if (!caseNumber) return;

    try {
      // Search for case by case_number
      const searchParams = {
        inline: true,
        input_name: caseNumber,
        page: 1,
        start: 0,
        "items-per-page": 50,
      };

      const response = await axiosInstance.get(ServiceUrl.getAllCases, {
        params: searchParams,
      });

      const caseData = response?.data?.entries?.[0];
      const folderId = caseData?.content?.properties?.packagescase_folderid || caseData?.content?.properties?.id;

      if (folderId) {
        navigate(`/view-case/${folderId}`, {
          state: {
            path: "digidakViewEntry",
            screenName: "caseScreen",
            redirect: screenName,
            digidak_uid: digidak_uid,
            i_folder_id: i_folder_id,
            folderId: folderId,
            caseStatus: caseData?.content?.properties?.packagescase_folderstatus,
            autoNumOutput: caseNumber,
            isInitiateWorkflow: caseData?.content?.properties?.in_workflow,
          },
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const mappedInboxData = useMemo(() => {
    return (
      showEndorsementGridData?.map((item) => {
        const props = item?.content?.properties ?? {};

        return {
          id: props.id,
          i_folder_id: props.i_folder_id?.[0],
          endorse_uid: props.endorse_uid,
          screenName: "",
          decision: props.decision,
          initiator: props.initiator,
          uid_number: props.uid_number || "-",
          status: props.status || "-",
          selected_region: props.selected_region,
        };
      }) ?? []
    );
  }, [showEndorsementGridData]);

  const processedData = useMemo(() => process(mappedInboxData, dataState), [mappedInboxData, dataState]);

  const skeletonRows = Array.from({ length: 5 })?.map((_, index) => ({
    id: index,
    uid_number: " ",
    endorse_uid: " ",
    decision: " ",
    initiator: " ",
    selected_region: " ",
    status: " ",
  }));

  return (
    <Layout screenName="viewCaseScreen">
      <S.ViewCaseContainer>
        <div className="row g-2">
          {!collapseRight && (
            <div className={`transition-width col-md-6`}>
              <DigidakSplitViewer
                ivTitle="Document Viewer"
                title="Document Viewer"
                digidakStatus={digidakItem?.status}
                publicationId={viewDoc?.publicationId}
                isRepublishing={isViewerLoading}
              />
            </div>
          )}

          {!collapseLeft && (
            <div className={`transition-width ${collapseRight ? "col-md-12" : "col-md-6"}`}>
              {splitView ? (
                <DigidakSplitViewer
                  key={selectedDocument?.publicationId || selectedDocument?.id || "splitviewer-test"}
                  splitView={splitView}
                  ivTitle={selectedDocument?.documentName || "Digidak Document Viewer"}
                  collapseRight={collapseRight}
                  collapseLeft={collapseLeft}
                  publicationId={selectedDocument?.publicationId}
                  handleSplitView={handleSplitViewClose}
                  handleSplitViewCollapse={handleSplitViewCollapse}
                  title={`Digidak: ${digidakItem?.uid_number || "Document Viewer"}`}
                  digidakStatus={digidakItem?.status}
                />
              ) : (
                <div className="card-container position-relative rounded">
                  {loader && (
                    <div className="k-loading-mask">
                      <div className="k-loading-image"></div>
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="case-info-label">DigiDak: {digidakItem?.uid_number}</h6>

                    {showOpenButton && (
                      <Button onClick={handleOpenFolder} className="common-btn-css submit-button" disabled={digidakItem?.status !== DIGIDAK_STATUS.UNREAD}>
                        Open
                      </Button>
                    )}
                  </div>

                  <hr className="hr" />

                  <div className="tab-container">
                    <header>
                      <div className="inbox-tabs" role="tablist">
                        <div className={`inbox-tab-item ${activeTab === "document" ? "active" : ""}`}>
                          <button
                            type="button"
                            role="tab"
                            title="Documents"
                            aria-selected={activeTab === "document"}
                            className="inbox-tab-btn"
                            onClick={() => setActiveTab("document")}
                          >
                            {activeTab === "document" && (
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
                            {activeTab !== "document" && <div className="passive-highlight"></div>}
                            <span>Documents</span>
                          </button>
                        </div>

                        <div className={`inbox-tab-item ${activeTab === "case" ? "active" : ""}`}>
                          <button
                            type="button"
                            role="tab"
                            title="Digidak Information"
                            aria-selected={activeTab === "case"}
                            className="inbox-tab-btn"
                            onClick={() => setActiveTab("case")}
                          >
                            {activeTab === "case" && (
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
                            {activeTab !== "case" && <div className="passive-highlight"></div>}
                            <span>Digidak Information</span>
                          </button>
                        </div>

                        {/* Hide Movement Register tab for group letters */}
                        {!isGroupLetter && (
                          <div className={`inbox-tab-item ${activeTab === "movementRegister" ? "active" : ""}`}>
                            <button
                              type="button"
                              role="tab"
                              title="Movement Register"
                              aria-selected={activeTab === "movementRegister"}
                              className="inbox-tab-btn"
                              onClick={() => togglePopup("movement")}
                            >
                              {activeTab === "movementRegister" && (
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
                              {activeTab !== "movementRegister" && <div className="passive-highlight"></div>}
                              <span>Movement Register</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </header>

                    <div>
                      {activeTab === "document" && (
                        <div className="table-container case-info-container">
                          <table className="table">
                            <thead>
                              <tr className="case-info-table-row">
                                <th>Document Name</th>
                                <th>Type</th>
                                <th>UID</th>
                                <th className="text-end">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.isArray(documents) &&
                                documents?.map((doc) => (
                                  <tr key={doc.id} className="case-info-table-row">
                                    <td>{doc.documentName}</td>
                                    <td>{doc.documentType}</td>
                                    <td>{doc.digidakUid || digidakItem?.uid_number}</td>
                                    <td className="text-end width-100">
                                      {viewDoc?.id !== doc.id && <ActionButton icon={FaEye} tooltip="Document View" onClick={() => handleDocumentView(doc)} />}
                                      <ActionButton icon={MdCompare} tooltip="Split View" onClick={() => handleSplitView(doc)} />
                                      <ActionButton icon={FaDownload} tooltip="Download" onClick={() => handleDownloadDocument(doc)} />
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeTab === "case" && (
                        <>
                          <PanelBar expandMode="multiple">
                            <PanelBarItem title="Digidak Information" expanded={true}>
                              <div className="case-info-container case-info-container-in-active">
                                {digidakFields?.map(([label, value]) => {
                                  return (
                                    <div key={label} className="row case-info-row d-flex align-items-center mb-1">
                                      <div className="case-information-label col-5">
                                        <strong>{label}</strong>
                                      </div>

                                      <div className="case-information-value col-7">
                                        <DigidakFieldValue
                                          label={label}
                                          value={value}
                                          screenName={screenName}
                                          isEndorsedLetter={digidakItem?.is_endorsed_letter}
                                          onRespondingUIDClick={handleRespondingUIDClick}
                                          onCaseNumberClick={handleCaseNumberClick}
                                          onEndorsementUIDClick={handleEndorsementUIDClick}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </PanelBarItem>
                          </PanelBar>

                          {/* Group Letter Grid */}
                          {isGroupLetter && <ViewEntryLettersGrid digidakUid={digidakItem?.uid_number} />}
                        </>
                      )}
                    </div>
                  </div>

                  {isLetterbox ? (
                    <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3 overflow-hidden">
                      <div className="d-flex justify-content-end gap-2 mt-2">
                        {digidakItem?.type_category == CATEGORY.INFORMATION && digidakItem?.status === DIGIDAK_STATUS.ASSIGNED && (
                          <Button className="common-btn-css submit-button" title="Acknowledge & Close" onClick={handleAcknowledge} disabled={loader}>
                            Acknowledge & Close
                          </Button>
                        )}

                        {digidakItem?.type_category == CATEGORY.ACTIONABLE && digidakItem?.status !== DIGIDAK_STATUS.CLOSED && (
                          <Button className="common-btn-css submit-button" onClick={() => setShowCommentPopup(true)} title="Close">
                            Close
                          </Button>
                        )}

                        <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                          Back
                        </Button>
                      </div>
                    </div>
                  ) : isDDM && !navigatedFromDDMCommunication ? (
                    <>
                      {/* Dropdowns */}
                      {canShowDDMAssignToDropdownDDM && (
                        <div className="table-container">
                          <Label className="case-form-label">Assign To</Label>
                          <DropDownList
                            data={verticalHeadGroups}
                            textField="text"
                            dataItemKey="value"
                            value={selectedVerticalHead}
                            onChange={(e) => setSelectedVerticalHead(e.value)}
                          />
                        </div>
                      )}

                      {/* Assign User */}
                      {canShowAssignUserDropdownDDM && (
                        <div className="table-container">
                          <Label className="case-form-label">Assign User</Label>
                          <MultiSelect
                            data={verticalUsers}
                            textField="text"
                            dataItemKey="value"
                            value={selectedUsers}
                            onChange={(e) => setSelectedUsers(e.value)}
                            placeholder="Select Users"
                          />
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3 overflow-hidden">
                        <div className="d-flex justify-content-end gap-2 mt-2">
                          {canShowReassignButtonDDM && (
                            <Button
                              title="Reassign Correspondence"
                              className="common-btn-css submit-button"
                              onClick={handleVerticalReAssignHeadSubmit}
                              disabled={loader || !selectedVerticalHead}
                            >
                              Reassign Correspondence
                            </Button>
                          )}

                          {canShowAssignUserButtonDDM && (
                            <Button className="common-btn-css submit-button" onClick={handleAssignUser} disabled={loader || !selectedUsers?.length} title="Assign User">
                              Assign User
                            </Button>
                          )}

                          {canShowReassignUserButtonDDM && (
                            <Button className="common-btn-css submit-button" onClick={handleReAssignUser} disabled={loader || !selectedUsers?.length} title="Reassign User">
                              Reassign User
                            </Button>
                          )}

                          {canShowInitiateCaseButtonDDM && (
                            <Button className="common-btn-css submit-button" onClick={() => handleInitiateCase(digidakItem?.id)} title="Initiate Case">
                              Initiate Case
                            </Button>
                          )}

                          {canShowPushback && (
                            <Button
                              className="common-btn-css cancel-button"
                              onClick={() => {
                                setCommentAction("PUSHBACK");
                                setShowCommentPopup(true);
                              }}
                              title="Pushback"
                            >
                              Pushback
                            </Button>
                          )}

                          {canShowAcknowledgeAndCloseButtonDDM && (
                            <Button
                              className="common-btn-css submit-button"
                              onClick={handleAcknowledge}
                              title="Acknowledge & Close"
                              disabled={loader || digidakItem?.status === DIGIDAK_STATUS.CLOSED}
                            >
                              Acknowledge & Close
                            </Button>
                          )}

                          {/* Responded letters */}
                          {canShowRespondedActionsDDM && (
                            <ViewRespondedActions
                              digidakItem={digidakItem}
                              screenName={screenName}
                              onFollowUp={handleFollowUp}
                              onClose={handleRespondedClose}
                              handleBackToScreen={handleBackToScreen}
                              username={userProfile?.properties?.object_name}
                            />
                          )}

                          {canShowCloseButtonDDM && (
                            <Button
                              className="common-btn-css submit-button"
                              onClick={() => {
                                setCommentAction("CLOSE");
                                setShowCommentPopup(true);
                              }}
                              title="Close"
                              disabled={loader || digidakItem?.status === DIGIDAK_STATUS.CLOSED}
                            >
                              Close
                            </Button>
                          )}

                          <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                            Back
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {screenName !== "viewOutward" && !navigatedFromDDMCommunication ? (
                        <>
                          {digidakItem?.status !== DIGIDAK_STATUS.RESPONDED ? (
                            <>
                              {digidakItem?.status !== DIGIDAK_STATUS.UNREAD ? (
                                <>
                                  {digidakItem?.secrecy === CATEGORY.SECRET || digidakItem?.status === DIGIDAK_STATUS.PUSHBACK ? (
                                    <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                                      <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                                        Back
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      {(digidakItem?.status === DIGIDAK_STATUS.OPENED || viewReassignCorrespondenceButton) && (
                                        <div className="table-container">
                                          <Label className="case-form-label">Assign To</Label>
                                          <DropDownList
                                            data={verticalHeadGroups}
                                            textField="text"
                                            dataItemKey="value"
                                            value={selectedVerticalHead}
                                            onChange={(e) => setSelectedVerticalHead(e.value)}
                                          />
                                        </div>
                                      )}

                                      {(((digidakItem?.status === DIGIDAK_STATUS.ASSIGNED_HEAD || digidakItem?.status === DIGIDAK_STATUS.REASSIGN_HEAD) && isUserAllowed) ||
                                        ((digidakItem?.status === DIGIDAK_STATUS.ASSIGNED || digidakItem?.status === DIGIDAK_STATUS.REASSIGNED) && selectedVerticalHeadName)) && (
                                        <div className="table-container">
                                          <Label className="case-form-label">Assign User</Label>
                                          <MultiSelect
                                            data={verticalUsers}
                                            textField="text"
                                            dataItemKey="value"
                                            value={selectedUsers}
                                            onChange={(e) => setSelectedUsers(e.value)}
                                            placeholder="Select Users"
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}

                                  <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3 overflow-hidden">
                                    <div className="d-flex justify-content-end gap-2 mt-2">
                                      {digidakItem?.secrecy === CATEGORY.SECRET || digidakItem?.status === DIGIDAK_STATUS.PUSHBACK ? (
                                        <>
                                          <Button
                                            className="common-btn-css submit-button"
                                            title={digidakItem?.type_category == CATEGORY.ACTIONABLE ? "Close" : "Acknowledge & Close"}
                                            onClick={digidakItem?.type_category === "Actionable" ? () => setShowCommentPopup(true) : handleAcknowledge}
                                            disabled={loader || digidakItem?.status === DIGIDAK_STATUS.CLOSED}
                                          >
                                            {digidakItem?.type_category == CATEGORY.ACTIONABLE ? "Close" : "Acknowledge & Close"}
                                          </Button>
                                          <Button className="common-btn-css save-button" onClick={handleBackToScreen} title="Back">
                                            Back
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          {showInitiateCaseButton && (
                                            <Button className="common-btn-css submit-button" onClick={() => handleInitiateCase(digidakItem?.id)} title="Initiate Case">
                                              Initiate Case
                                            </Button>
                                          )}

                                          {viewUserButton && (
                                            <Button
                                              className="common-btn-css submit-button bg-red-500"
                                              onClick={handleViewUser}
                                              disabled={!selectedVerticalHead}
                                              title="View Users"
                                            >
                                              View Users
                                            </Button>
                                          )}

                                          {viewReassignCorrespondenceButton && (
                                            <Button
                                              title="Reassign Correspondence"
                                              className="common-btn-css submit-button"
                                              onClick={handleVerticalReAssignHeadSubmit}
                                              disabled={loader || !selectedVerticalHead}
                                            >
                                              Reassign Correspondence
                                            </Button>
                                          )}

                                          {digidakItem?.status === DIGIDAK_STATUS.OPENED && (
                                            <Button
                                              className="common-btn-css submit-button"
                                              onClick={handleVerticalHeadSubmit}
                                              disabled={loader || !selectedVerticalHead}
                                              title="Assign Correspondence"
                                            >
                                              Assign Correspondence
                                            </Button>
                                          )}

                                          {(digidakItem?.status === DIGIDAK_STATUS.ASSIGNED || digidakItem?.status === DIGIDAK_STATUS.REASSIGNED) && selectedVerticalHeadName && (
                                            <Button
                                              className="common-btn-css submit-button"
                                              onClick={handleReAssignUser}
                                              disabled={loader || !selectedUsers?.length}
                                              title="Reassign User"
                                            >
                                              Reassign User
                                            </Button>
                                          )}

                                          {(digidakItem?.status === DIGIDAK_STATUS.ASSIGNED_HEAD || digidakItem?.status === DIGIDAK_STATUS.REASSIGN_HEAD) && isUserAllowed && (
                                            <Button
                                              className="common-btn-css submit-button"
                                              onClick={handleAssignUser}
                                              disabled={loader || !selectedUsers?.length}
                                              title="Assign User"
                                            >
                                              Assign User
                                            </Button>
                                          )}

                                          {(AcknowledgeCloseBtnCondition || AcknowledgeCloseBtnCondition2) && (
                                            <Button
                                              title={digidakItem?.type_category == CATEGORY.ACTIONABLE ? "Close" : "Acknowledge & Close"}
                                              className="common-btn-css submit-button"
                                              onClick={digidakItem?.type_category === "Actionable" ? () => setShowCommentPopup(true) : handleAcknowledge}
                                              disabled={loader || digidakItem?.status === DIGIDAK_STATUS.CLOSED}
                                            >
                                              {digidakItem?.type_category == CATEGORY.ACTIONABLE ? "Close" : "Acknowledge & Close"}
                                            </Button>
                                          )}

                                          <Button className="common-btn-css save-button" onClick={handleBackToScreen} title="Back">
                                            Back
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                                  <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                                    Back
                                  </Button>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {digidakItem?.decision === "Inward" ? (
                                <ViewRespondedActions
                                  digidakItem={digidakItem}
                                  screenName={screenName}
                                  onFollowUp={handleFollowUp}
                                  onClose={handleRespondedClose}
                                  handleBackToScreen={handleBackToScreen}
                                  username={userProfile?.properties?.object_name}
                                />
                              ) : (
                                <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                                  <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                                    Back
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {!navigatedFromDDMCommunication && (
                            <ViewRespondedActions
                              digidakItem={digidakItem}
                              screenName={screenName}
                              onFollowUp={handleFollowUp}
                              onClose={handleRespondedClose}
                              handleBackToScreen={handleBackToScreen}
                              username={userProfile?.properties?.object_name}
                            />
                          )}

                          {digidakItem?.status !== DIGIDAK_STATUS.RESPONDED && (
                            <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                              <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                                Back
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <MovementRegister folderId={digidakItem?.id} visible={popups.movement} movementRegisterData={movementRegisterData || []} onClose={() => togglePopup("movement")} />

        {visible && (
          <Dialog title={"Vertical Users List"} onClose={closeViewUserDialog} className="view-users-dialog">
            <Grid data={vitualUsersData}>
              <GridColumn field="verticalName" title="Vertical Name" />
              <GridColumn field="userNames" title="User Names" />
            </Grid>
            <div className="float-end mt-2">
              <Button onClick={closeViewUserDialog} className="common-btn-css submit-button">
                Close
              </Button>
            </div>
          </Dialog>
        )}

        {/* Comment Popup */}
        {showCommentPopup && <CommentDialog commentAction={commentAction} loader={loader} onSave={handleSaveComment} onClose={() => setShowCommentPopup(false)} />}

        {showEndorsementGridDialog && (
          <Dialog title={"Endorsement List"} onClose={() => setShowEndorsementGridDialog(false)} className="endorse-dialog-wh">
            <Grid data={loading ? skeletonRows : processedData}>
              <GridColumn field="uid_number" title="UID Number" cells={{ data: loading ? Skeleton : EndorsementNumberCell }} />
              <GridColumn field="endorse_uid" title="Endorse UID" cells={{ data: loading ? Skeleton : undefined }} />
              <GridColumn field="decision" title="Decision" cells={{ data: loading ? Skeleton : undefined }} />
              <GridColumn field="initiator" title="Initiator" cells={{ data: loading ? Skeleton : undefined }} />
              <GridColumn field="selected_region" title="Dept/RO/TE" cells={{ data: loading ? Skeleton : undefined }} />
              <GridColumn field="status" title="Status" cells={{ data: loading ? Skeleton : undefined }} />
            </Grid>
            <div className="float-end mt-2">
              <Button onClick={() => setShowEndorsementGridDialog(false)} className="common-btn-css submit-button">
                Close
              </Button>
            </div>
          </Dialog>
        )}
      </S.ViewCaseContainer>
    </Layout>
  );
};

export default ViewEntry;
