import React, { useEffect, useState, useMemo } from "react";

// router
import { useLocation, useNavigate, useParams } from "react-router-dom";

// components
import Layout from "../../../components/layout/Layout";
import { usePublishIv } from "../../../hooks/usePublishIv";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import DigidakSplitViewer from "../splitViewer/DigidakSplitViewer";

//kendo component
import { process } from "@progress/kendo-data-query";

// Redux
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";

// kendo
import { Button } from "@progress/kendo-react-buttons";
import { Skeleton } from "@progress/kendo-react-indicators";
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
import { useDispatch } from "react-redux";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

// Axios
import axiosInstance from "../../../services/axiosConfig";

// Service
import { ServiceUrl } from "../../../services/serviceUrl";
import ViewEntryLettersGrid from "./ViewEntryLettersGrid";
import ActionButton from "../../../components/actionButton/ActionButton";

const ViewOldEntry = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { publish: publishIv } = usePublishIv();

  const { id } = useParams();
  const { screenName, digidak_uid, i_folder_id, pathname, isClickFromViewEntry, digidakObjectId: stateObjectId } = location.state || {};
  const digidakObjectId = stateObjectId || id;

  // Navigation source — if coming from DDM listing, we should hide action buttons and show only Back
  const navigatedFromDDMCommunication = (pathname || "").includes("/ddm-inward") || (pathname || "").includes("/ddm-outward");

  const [digidakItem, setDigidakItem] = useState(null);

  // DDM related conditions
  const isDDM = digidakItem?.is_ddm === true;
  const isROTODDMLetter = digidakItem?.is_ro_to_ddm;

  const isGroupLetter = digidakItem?.uid_number?.startsWith("G");

  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [loader, setLoader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callMovementRegAPI, setCallMovementRegAPI] = useState(false);

  const [showEndorsementGridDialog, setShowEndorsementGridDialog] = useState(false);
  const [showEndorsementGridData, setShowEndorsementGridData] = useState([]);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "dec" }],
    skip: 0,
    take: 50,
    filter: null,
  });

  const [popups, setPopups] = useState({
    movement: false,
  });

  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isPublishingForView, setIsPublishingForView] = useState(false);
  const [viewDoc, setViewDoc] = useState([]);
  const [activeTab, setActiveTab] = useState("document");

  const [splitView, setSplitView] = useState(false); // New state for split view
  const [collapseLeft, setCollapseLeft] = useState(false);
  const [collapseRight, setCollapseRight] = useState(false);
  // true until the initial fetch (+ optional republish) completes — prevents viewer mounting with no ID
  const [isViewerLoading, setIsViewerLoading] = useState(true);

  const getPriorityClass = (priority) => {
    switch (priority) {
      case "Urgent":
        return "priority-urgent";
      case "Immediate":
        return "priority-immediate";
      default:
        return "priority-default";
    }
  };

  // digidak fields conditional values
  const office_region_value = digidakItem?.entry_type === "Internal" ? digidakItem?.region : digidakItem?.state_of_sender;
  const outwardExternal = digidakItem?.entry_type === "External" && digidakItem?.decision === "Outward";

  const receiver_value = outwardExternal
    ? digidakItem?.received_from
    : isROTODDMLetter
      ? digidakItem?.ddm_users?.[0]
      : isDDM
        ? digidakItem?.ddm_vertical
        : digidakItem?.selected_region;

  const sender_value = digidakItem?.decision === "Inward" ? digidakItem?.received_from : digidakItem?.login_region;

  const digidakFields = isGroupLetter
    ? [
        ["DigiDak Number", digidakItem?.uid_number || ""],
        ["Initiator", digidakItem?.initiator || ""],
        ...(digidakItem?.is_endorsed_letter ? [["Is Endorsed Letter", "Endrosement"]] : [["Is Endorsed Letter", "Main Letter"]]),
        ...(digidakItem?.endorse_uid ? [["Endorsement UID", digidakItem.endorse_uid]] : []),
      ]
    : [
        ["DigiDak Number", digidakItem?.uid_number || ""],
        ...(digidakItem?.forward_group_uid ? [["Forwarded UID", digidakItem.forward_group_uid]] : []),

        // Office Order
        ...(digidakItem?.office_order_no ? [["Office Order No.", digidakItem?.office_order_no]] : []),

        ["Status", digidakItem?.status],
        ...(digidakItem?.nature_of_correspondence === "DO Letter" ? [["Username", digidakItem.hrmd_users]] : receiver_value ? [["Receiver", receiver_value]] : []),
        ["Type", digidakItem?.entry_type],
        ["Mode of Dispatch", digidakItem?.mode_of_receipt],
        ["Letter of Subject", digidakItem?.letter_subject],
        ...(digidakItem?.is_endorsed_letter ? [["Is Endorsed Letter", "Yes"]] : [["Is Endorsed Letter", "Main Letter"]]),
        ...(digidakItem?.endorse_uid ? [["Endorsement UID", digidakItem.endorse_uid]] : []),
        ["Category", digidakItem?.type_category],
        ["Language", digidakItem?.languages],
        ["Sensitivity", digidakItem?.secrecy],
        ["Priority", digidakItem?.priority],
        ["Sender", sender_value],

        ...(digidakItem?.decision === "Inward" ? [["Reference Number", digidakItem?.inward_ref_number]] : []),
        ...(digidakItem?.responding_uid ? [["Responding UID", digidakItem.responding_uid]] : []),
        ...(digidakItem?.status === "Closed" && digidakItem?.user_comments ? [["Closed Comments", digidakItem?.user_comments]] : []),
        ...(digidakItem?.pushback_comments ? [["Push back comments", digidakItem?.pushback_comments]] : []),
        ...(digidakItem?.decision === "Inward"
          ? [
              ["Address of Sender", digidakItem?.address_of_sender],
              ["State of Sender", digidakItem?.state_of_sender],
            ]
          : []),
        ...(digidakItem?.decision === "Outward"
          ? [
              ["File Number", digidakItem?.file_number],
              ["Nature of Correspondence", digidakItem?.nature_of_correspondence],
              ...(!isDDM ? [["Source Vertical", digidakItem?.source_vertical]] : []),
            ]
          : []),
        ...(screenName === "viewOutward" ? [["Is Bulk", digidakItem?.group_uid ? "Yes" : "No"], ...(office_region_value ? [["Office Region", office_region_value]] : [])] : []),
        ...(digidakItem?.case_number ? [["Case Number", digidakItem?.case_number]] : []),
        ...(digidakItem?.remarks ? [["Forwarded Remarks", digidakItem?.remarks]] : []),
      ];

  // Open split view for a document
  const handlePublishIv = async (docId) => {
    try {
      const newPublicationId = await publishIv(docId);
      return newPublicationId;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleSplitView = async (doc) => {
    let publicationId = doc?.publicationId;
    const docId = doc?.id;

    if (!publicationId && docId) {
      setIsPublishingForView(true);
      try {
        publicationId = await handlePublishIv(docId);
        if (publicationId) {
          doc.publicationId = publicationId; // Update local doc object
        }
      } catch (err) {
        showSweetAlert({
          title: "Publish Failed",
          text: "Failed to publish document for viewing.",
          icon: "error",
        });
        return;
      } finally {
        setIsPublishingForView(false);
      }
    }

    if (publicationId) {
      setSelectedDocument({ ...doc, publicationId });
      setSplitView(true);
      setCollapseLeft(false);
      setCollapseRight(false);
    }
  };

  const handleDocumentView = async (doc) => {
    let publicationId = doc?.publicationId;
    const docId = doc?.id;

    if (!publicationId && docId) {
      setIsPublishingForView(true);
      try {
        publicationId = await handlePublishIv(docId);
        if (publicationId) {
          doc.publicationId = publicationId; // Update local doc object
        }
      } catch (err) {
        showSweetAlert({
          title: "Publish Failed",
          text: "Failed to publish document for viewing.",
          icon: "error",
        });
        return;
      } finally {
        setIsPublishingForView(false);
      }
    }

    if (publicationId) {
      setViewDoc({ ...doc, publicationId });
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
    if (screenName === "OldLetters") {
      navigate(pathname || "/old-letters", { state: { fromViewCase: true } });
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
                isOld={true}
                caseId={digidakObjectId}
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
                  isOld={true}
                  caseId={digidakObjectId}
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
                  {loader || isPublishingForView ? (
                    <div className="k-loading-mask">
                      <div className="k-loading-image"></div>
                    </div>
                  ) : null}

                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="case-info-label">DigiDak: {digidakItem?.uid_number}</h6>
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
                              <motion.div className="active-highlight" layoutId="highlight" transition={{ layout: { duration: 0.3, ease: "easeInOut" } }} />
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
                            {activeTab === "case" && <motion.div className="active-highlight" layoutId="highlight" transition={{ layout: { duration: 0.3, ease: "easeInOut" } }} />}
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
                                <motion.div className="active-highlight" layoutId="highlight" transition={{ layout: { duration: 0.3, ease: "easeInOut" } }} />
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
                                        {label === "Priority" ? (
                                          <>
                                            :&nbsp;
                                            <span className={`priority-btn ${getPriorityClass(value)}`}>{value}</span>
                                          </>
                                        ) : label === "Responding UID" ? (
                                          <>
                                            :&nbsp;
                                            <span className="cursor-pointer text-primary text-decoration-underline" onClick={handleRespondingUIDClick}>
                                              {value}
                                            </span>
                                          </>
                                        ) : label === "Case Number" ? (
                                          <>
                                            :&nbsp;
                                            <span
                                              className={screenName === "viewOutward" ? "" : "cursor-pointer text-primary text-decoration-underline"}
                                              onClick={screenName === "viewOutward" ? undefined : handleCaseNumberClick}
                                            >
                                              {value}
                                            </span>
                                          </>
                                        ) : label === "Endorsement UID" ? (
                                          <>
                                            :&nbsp;
                                            {!digidakItem?.is_endorsed_letter ? (
                                              <span className="cursor-pointer text-primary text-decoration-underline" onClick={handleEndorsementUIDClick}>
                                                {value}
                                              </span>
                                            ) : (
                                              <span>{value}</span>
                                            )}
                                          </>
                                        ) : label === "Push back comments" ? (
                                          <span className="pushback-wrapper">
                                            <span className="pushback-colon">:</span>
                                            <span className="pushback-span">{value}</span>
                                          </span>
                                        ) : label === "Closed Comments" ? (
                                          <span className="pushback-wrapper">
                                            <span className="pushback-colon">:</span>
                                            <span className="pushback-span">{value}</span>
                                          </span>
                                        ) : label === "Forwarded Remarks" ? (
                                          <span className="pushback-wrapper">
                                            <span className="pushback-colon">:</span>
                                            <span className="pushback-span">{value}</span>
                                          </span>
                                        ) : Array.isArray(value) ? (
                                          <span>:&nbsp;{value.join(", ")}</span>
                                        ) : (
                                          <span>:&nbsp;{value}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </PanelBarItem>
                          </PanelBar>

                          {/* Group Letter Grid */}
                          {isGroupLetter && <ViewEntryLettersGrid digidakUid={digidakItem?.uid_number} isOldLetter />}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3 overflow-hidden">
                    <div className="d-flex justify-content-end gap-2 mt-2">
                      <Button className="common-btn-css save-button float-end" onClick={handleBackToScreen} title="Back">
                        Back
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <MovementRegister folderId={digidakItem?.id} visible={popups.movement} movementRegisterData={movementRegisterData || []} onClose={() => togglePopup("movement")} />

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

export default ViewOldEntry;
