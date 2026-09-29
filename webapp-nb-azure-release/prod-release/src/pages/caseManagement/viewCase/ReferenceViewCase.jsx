import React, { useEffect, useRef, useState, useCallback } from "react";

//styled components
import * as S from "./viewCases.styles";

//custom components
import Layout from "../../../components/layout/Layout";
import SplitViewer from "./splitViewer/SplitViewer.jsx";
import DocumentTable from "./documentTable/DocumentTable";
import MovementRegister from "./movementRegister/MovementRegister";

//Kendo components
import { Button } from "@progress/kendo-react-buttons";

//react Icons
import { MdInfoOutline } from "react-icons/md";
import { FaClipboardList } from "react-icons/fa6";

//Router
import { useNavigate } from "react-router-dom";

//redux
import { useDispatch, useSelector } from "react-redux";
import CaseInformationDialog from "./caseInformation/CaseInformationDialog.jsx";
import HyperlinkHandler from "../../../components/hyperlinkHandler/HyperlinkHandler.jsx";
import { sentCaseService } from "../../../services/caseManagement/sentCases/sentCaseService";
import { caseDetailsService } from "../../../services/caseManagement/caseDetails/caseDetailsService";
import { clearCaseDetails, fetchCaseDetails } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";
import { motion } from "framer-motion";

const ReferenceViewCase = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, object_name } = userProfile?.properties || {};

  const { caseDetails } = useSelector((state) => state?.caseDetails) || {};

  const createdUser = caseDetails?.properties?.r_creator_name;
  const isSameWorkflowUser = object_name === createdUser;

  const [refSessionData, setRefSessionData] = useState("");

  const folderId = refSessionData?.folderId;
  const screenName = refSessionData?.screenName;
  const caseStatus = refSessionData?.caseStatus;
  const autoNumOutput = refSessionData?.autoNumOutput;
  const isInitiateWorkflow = refSessionData?.isInitiateWorkflow;
  const isMigrated = refSessionData?.isMigrated;

  const [tabInfoView, setTabInfoView] = useState("supporting");

  const [popups, setPopups] = useState({ movement: false });

  const [collapseLeft, setCollapseLeft] = useState(false);
  const [collapseRight, setCollapseRight] = useState(false);

  const [splitView, setSplitView] = useState(false);

  const [publishingId, setPublishingId] = useState(null);
  const [notesheetId, setNotesheetId] = useState(null);
  const [notesheetObjectName, setNotesheetObjectName] = useState(null);
  const [selectedPublicationId, setSelectedPublicationId] = useState(null);
  const [ivTitleName, setIvTitleName] = useState("");

  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const [movementRegLoader, setMovementRegLoader] = useState(false);
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Responsive tab labels
  const tabOptions = [
    {
      key: "supporting",
      label: "Supporting Document",
    },
    {
      key: "drafts",
      label: "Draft Documents",
    },
  ];

  const caseFields = [
    ["Subject", caseDetails?.properties?.description],
    ["Case Priority", caseDetails?.properties?.task_priority],
    ["Case Type", caseDetails?.properties?.types],
    ["Nature of Case", caseDetails?.properties?.case_nature],
    ["Disposal Level", caseDetails?.properties?.disposal_level],
    ["Case Status", caseDetails?.properties?.status],
    ...(caseDetails?.properties?.status?.toLowerCase() === "cancelled"
      ? [
          [
            "Reason for Cancellation",
            caseDetails?.properties?.reason_for_cancellation
              ? `${caseDetails.properties.reason_for_cancellation.substring(0, 20)}${caseDetails.properties.reason_for_cancellation?.length > 20 ? "..." : ""}`
              : "Not provided",
          ],
        ]
      : []),
    ["Department", caseDetails?.properties?.department_name],
    ...(office_type === "HO" ? [["Vertical", caseDetails?.properties?.functions]] : []),
    ["Case Year", caseDetails?.properties?.years],
    ["File No", caseDetails?.properties?.file_number],
    ["Language", caseDetails?.properties?.language_type],
    ["Created By", caseDetails?.properties?.r_creator_name],
  ];

  const togglePopup = useCallback((key) => {
    setPopups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSplitView = async (publicationId) => {
    if (publicationId) {
      setSelectedPublicationId(publicationId);
    }
    setSplitView((prev) => !prev);
  };

  const handleIvTitleName = async (name) => {
    setIvTitleName(name);
  };

  const handleNotesheetCollapse = () => {
    setCollapseLeft((prev) => !prev); // toggle left
    setCollapseRight(false); // always close right
  };

  const handleBackToScreen = () => {
    navigate("/cases");
  };

  const handleSplitViewCollapse = () => {
    setCollapseRight((prev) => !prev); // toggle right
    setCollapseLeft(false); // always close left
  };

  const handleSplitViewClose = () => {
    setSplitView((prev) => !prev);
    setCollapseRight(false); // toggle right
  };

  const handlePublicationIdSelect = (publicationId) => {
    setSelectedPublicationId(publicationId);
  };

  useEffect(() => {
    const storedState = localStorage.getItem("newTabState");
    if (storedState) {
      const parsed = JSON.parse(storedState);
      setRefSessionData(parsed);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (folderId) {
      dispatch(clearCaseDetails());
      dispatch(fetchCaseDetails({ folderId }));
    }
  }, [folderId]);

  useEffect(() => {
    if (autoNumOutput) {
      const fetchNoteSheetId = async () => {
        try {
          const folderPath = isMigrated ? `/CMS Legacy/${autoNumOutput}` : `/Case/${autoNumOutput}`;
          const response = await sentCaseService.getNotesheetId({
            input_folder_path: folderPath,
            ...(isMigrated && { input_object_name: "%- Note Sheet.docx" }),
          });
          if (isMountedRef.current) {
            setPublishingId(response?.entries?.[0]?.content?.properties?.publishing_id);
            setNotesheetId(response?.entries?.[0]?.content?.properties?.id);
            setNotesheetObjectName(autoNumOutput);
          }
        } catch (error) {
          console.error(error);
        }
      };

      fetchNoteSheetId();
    }
  }, [autoNumOutput, isMigrated]);

  useEffect(() => {
    setMovementRegLoader(true);
    const fetchDepartment = async () => {
      try {
        const response = await caseDetailsService.getMovementRegister({
          input_parent_folders: folderId,
        });

        if (isMountedRef.current) {
          setMovementRegisterData(response?.entries);
          setMovementRegLoader(false);
        }
      } catch (err) {
        console.error(err);
        if (isMountedRef.current) setMovementRegLoader(false);
      }
    };

    fetchDepartment();
  }, [folderId]);

  return (
    <Layout screenName="viewCaseScreen">
      {/* Global Hyperlink Handler */}
      <HyperlinkHandler handleSplitView={handleSplitView} onPublicationIdSelect={setSelectedPublicationId} setIvTitleName={setIvTitleName} />

      <S.ViewCaseContainer>
        <div className="row g-2">
          {!collapseRight && (
            <div className={`transition-width ${collapseLeft ? "col-md-12" : "col-md-6"}`}>
              <SplitViewer
                paneId="left"
                ivTitle="Notesheet"
                folderId={folderId}
                screenName="referenceScreen"
                caseStatus={caseStatus}
                title="Notesheet Viewer"
                collapseLeft={collapseLeft}
                notesheetId={notesheetId}
                publicationId={publishingId}
                notesheetObjectName={notesheetObjectName}
                isSameWorkflowUser={isSameWorkflowUser}
                isAcquired={0}
                isOldCase={isMigrated}
                caseId={caseDetails?.properties?.object_name}
                handleNotesheetCollapse={handleNotesheetCollapse}
              />
            </div>
          )}

          {!collapseLeft && (
            <div className={`transition-width ${collapseRight ? "col-md-12" : "col-md-6"}`}>
              {splitView ? (
                <SplitViewer
                  paneId="right"
                  key={`splitviewer-reference-${caseStatus}`}
                  collapseRight={collapseRight}
                  splitView={splitView}
                  ivTitle={ivTitleName}
                  screenName="referenceScreen"
                  caseStatus={caseStatus}
                  publicationId={selectedPublicationId}
                  title={`Case: ${caseDetails?.properties?.object_name}`}
                  isSameWorkflowUser={isSameWorkflowUser}
                  isAcquired={0}
                  handleSplitViewCollapse={handleSplitViewCollapse}
                  handleSplitView={handleSplitViewClose}
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
                      {caseStatus !== "Draft" && (
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
                      <ul className="tabs">
                        {tabOptions?.map(({ key, label }) => (
                          <li
                            key={key}
                            title={label}
                            className={key === tabInfoView ? "active" : undefined}
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
                          </li>
                        ))}
                      </ul>
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
                          tabInfoView={tabInfoView}
                          isSameWorkflowUser={isSameWorkflowUser}
                          isInitiateWorkflow={isInitiateWorkflow}
                          isOldCase={isMigrated}
                          splitView={(id) => handleSplitView(id)}
                          caseDetailsData={caseDetails?.properties}
                          ivTitleName={(name) => handleIvTitleName(name)}
                          onPublicationIdSelect={handlePublicationIdSelect}
                        />
                      )}
                    </div>
                  </div>

                  <div className="position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
                    <div className="d-flex justify-content-end gap-2 mt-2">
                      <Button className="common-btn-css save-button" onClick={handleBackToScreen}>
                        Back
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <CaseInformationDialog visible={popups.caseInfo} caseFields={caseFields} caseDetails={caseDetails} onClose={() => togglePopup("caseInfo")} />

        <MovementRegister folderId={folderId} visible={popups.movement} movementRegisterData={movementRegisterData} onClose={() => togglePopup("movement")} />
      </S.ViewCaseContainer>
    </Layout>
  );
};

export default ReferenceViewCase;
