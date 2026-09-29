import { useState, useEffect, useMemo, useCallback } from "react";

//styled component
import * as S from "../viewCases.styles";

//react router dom
import { useNavigate } from "react-router-dom";

//kendo react
import { IoClose } from "react-icons/io5";
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";
import { TabStrip, TabStripTab } from "@progress/kendo-react-layout";

// Sweet Alert
import Swal from "sweetalert2";

//redux
import { useSelector } from "react-redux";
import axiosInstance from "../../../../services/axiosConfig";

//components
import ChooseUserGroup from "../../../../components/chooseUserGroup/ChooseUserGroup";
import { createCaseService } from "../../../../services/caseManagement/createCase/createCaseService";
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";
import { chunkByUtf8Bytes } from "../../../../utils/chunkByUtf8Bytes";
import { documentService } from "../../../../services/caseManagement/documents/documentsService";
import { fromAndToDateFormat } from "../../../../utils/Utils";
import { GROUPS_MAIN } from "../../../data/DropdownData";

const SendCase = ({
  itemId,
  visible,
  onClose,
  tagName,
  folderId,
  comments,
  caseDetails,
  taskDetails,
  commentsDocId,
  workflowLinks,
  isUserExistData,
  previousPerformer,
  param_department,
  movementRegisterData,
}) => {
  const navigate = useNavigate();

  const { userProfile, dmdChairmanCondition } = useSelector((state) => state?.login);
  const { office_type, location, object_name } = userProfile?.properties || {};
  const { draftDocs } = useSelector((state) => state.documents);

  const loginPerformer = object_name;
  const performer = taskDetails?.properties?.performer;
  const caseNature = caseDetails?.properties?.case_nature;
  const rCreatorName = caseDetails?.properties?.r_creator_name;
  const workflowLink = taskDetails?.data?.packages?.WFParam?.href;
  const workflowId = typeof workflowLink === "string" ? workflowLink.split("/").pop() : null;
  const lastItemDecision = movementRegisterData?.at(-1)?.content?.properties?.decision;

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedSubTab, setSelectedSubTab] = useState(0);
  const [verticalGroup, setVerticalGroup] = useState([]); //choose vertical
  const [departmentGroup, setDepartmentGroup] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTOTE, setSelectedTOTE] = useState(null);
  const [famsClmasSerialNo, setFamsClmasSerialNo] = useState("");
  const [famsClmasDate, setFamsClmasDate] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedVertical, setSelectedVertical] = useState(null);
  const [selectedCGMDept, setSelectedCGMDept] = useState(null);

  const [selectedOfficeType, setSelectedOfficeType] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [CGMGroup, setCGMGroup] = useState("");
  const [clearAll, setClearAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [markSelector, setMarkSelector] = useState(false);

  const isDMDChairmanConditionMatch = GROUPS_MAIN.includes(dmdChairmanCondition);
  // Handler to receive selected values from ChooseUserGroup
  const handleSelectionChange = useCallback((selectionData) => {
    setSelectedGroup(selectionData.selectedGroup);
    setSelectedUser(selectionData.selectedUser);
    setSelectedVertical(selectionData.selectedVertical);
    setCGMGroup(selectionData.CGMGroup);
    setSelectedTOTE(selectionData.selectedTOTE);
    setSelectedOfficeType(selectionData.selectedOfficeType);
    setFamsClmasSerialNo(selectionData.famsClmasSerialNo);
    setFamsClmasDate(selectionData.famsClmasDate);
    setMarkSelector(selectionData.markSelector);
    setSelectedCGMDept(selectionData.selectedCGMDept);
  }, []);

  const handleSelectTab = (e) => setSelectedTab(e.selected);
  const handleSelectSubTab = (e) => setSelectedSubTab(e.selected);

  const handleClear = () => {
    setClearAll(true);
    setTimeout(() => setClearAll(false), 100);
  };

  // Extracted: submit workflow API call and navigate to sent-case
  const submitAndNavigate = async (method, apiUrl, payload, config) => {
    setIsLoading(true);
    try {
      if (typeof axiosInstance[method] !== "function") {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }
      await axiosInstance[method](apiUrl, payload, config);
      localStorage.removeItem("case_comments_latest");
      setIsLoading(false);
      navigate("/sent-case", { state: { dataLoading: true } });
    } catch (error) {
      onClose();
      setIsLoading(false);
      showSweetAlert({ title: "Error", text: error.message, icon: "error" });
    }
  };

  // Extracted: move draft docs to final, then submit
  const moveDraftsAndSubmit = async (docIds, method, apiUrl, payload, config) => {
    await documentService.moveToFinalDocument({
      "run-stateless": "true",
      data: { variables: { in_category: "Final", in_r_object_id: docIds } },
    });
    await submitAndNavigate(method, apiUrl, payload, config);
  };

  const handleConfirm = async () => {
    const mainTab = TAB_CONFIG[selectedTab];
    const action = mainTab.title;

    let selectedTabTitle = action;

    if (action === "Forward") {
      const subTab = mainTab.subTabs[selectedSubTab];
      selectedTabTitle = subTab.title;
    }

    const processedComments = chunkByUtf8Bytes(comments);

    const cleanedWorkflowLink = workflowLinks?.replace("processes/", "") || "";
    const workflowBaseURL = (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", "");

    let payload = {};
    let apiUrl = "";
    let method = "";
    let config = {};

    // Shared helper to build the workflow payload structure
    const buildWorkflowPayload = (properties, extraVariables = {}) => ({
      complete: {
        data: {
          packages: {
            WFParam: {
              properties: {
                id: workflowId,
                comments: processedComments,
                ho_ro: "",
                comments_doc_id: commentsDocId || "",
                ...properties,
              },
              href: workflowLink,
            },
          },
          attachments: [],
          variables: { in_login_user: object_name, ...extraVariables },
        },
      },
    });

    if (selectedTabTitle === "Internal") {
      // Extract nested ternary for cgm_sec_group_name (As part of 257 jira)
      let internalCgmSecGroupName = "";
      if (tagName !== "approveCase") {
        internalCgmSecGroupName = lastItemDecision === "Routing" ? selectedUser?.value || "" : selectedGroup?.value;
      }

      // Extract nested ternary for is_other_dept_selected (As part of 257 jira)
      let internalIsOtherDeptSelected = false;
      if (tagName !== "approveCase") {
        internalIsOtherDeptSelected = !selectedUser?.value;
      }

      payload = buildWorkflowPayload({
        action: tagName === "approveCase" ? "Approved" : "Forward",
        performer: tagName === "approveCase" ? performer : loginPerformer,
        department: markSelector ? caseDetails?.properties?.department_short_code : tagName === "approveCase" ? selectedCGMDept?.value : param_department,
        assigned_performer: selectedUser?.value || rCreatorName,
        cgm_sec_group_name: internalCgmSecGroupName,
        is_other_dept_selected: internalIsOtherDeptSelected,
      });

      apiUrl = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      method = "post";
      config = { baseURL: workflowBaseURL };
    }

    if (selectedTabTitle === "Inter Departmental" || selectedTabTitle === "Initiating Department") {
      const isConfidential = caseNature === "Confidential" && office_type === "HO";

      const cgmSecGroupName = tagName === "approveCase" ? CGMGroup?.[0]?.value : isConfidential ? "" : office_type === "HO" ? `ecm_ho_${selectedVertical?.value}_cgm_sec` : "";

      // If Attention To is not selected and it's not mandatory, use cgm_sec_group_name in uppercase
      const assignedPerformer = (!isConfidential && cgmSecGroupName ? cgmSecGroupName.toUpperCase() : "") || selectedUser?.value;

      // Extract nested ternary for is_other_dept_selected
      let isOtherDeptSelectedValue = false;
      if (selectedTabTitle !== "Initiating Department") {
        if (tagName === "approveCase" || (!isConfidential && office_type === "HO")) {
          isOtherDeptSelectedValue = true;
        }
      }

      payload = buildWorkflowPayload(
        {
          action: tagName === "approveCase" ? "Approved" : isConfidential ? "Forward" : "Routing",
          performer: tagName === "approveCase" ? performer : loginPerformer,
          department: markSelector ? caseDetails?.properties?.department_short_code : selectedVertical?.value || "",
          assigned_performer: selectedTabTitle === "Initiating Department" ? selectedUser?.[0]?.object_name || selectedUser?.text : assignedPerformer,
          cgm_sec_group_name: selectedTabTitle === "Initiating Department" ? "" : cgmSecGroupName,
          is_other_dept_selected: isOtherDeptSelectedValue,
        },
        {
          choosen_user: selectedUser?.text, //NR 234 changes
          in_fams_clmas_date: fromAndToDateFormat(famsClmasDate) || "",
          in_fams_clmas_no: famsClmasSerialNo || "",
        },
      );

      apiUrl = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      method = "post";
      config = { baseURL: workflowBaseURL };
    }

    if (selectedTabTitle === "Inter Office") {
      const isConfidentialRO = caseNature === "Confidential";

      const cgmSecGroupName = selectedOfficeType === "HO" ? `ecm_ho_${selectedVertical?.value}_cgm_sec` : isConfidentialRO ? "" : `ecm_${selectedTOTE?.value}_cgm_sec`;

      // If Attention To is not selected and it's not mandatory, use cgm_sec_group_name in uppercase
      const assignedPerformer = selectedUser?.value || (!isConfidentialRO && cgmSecGroupName ? cgmSecGroupName.toUpperCase() : "");
      const isOtherDeptSelected = tagName === "approveCase" ? true : !isConfidentialRO;

      payload = buildWorkflowPayload(
        {
          action: tagName === "approveCase" ? "Approved" : "Routing", // change the action name because of Jira NR 234
          performer: tagName === "approveCase" ? performer : loginPerformer,
          department: selectedVertical?.value || "",
          cgm_sec_group_name: cgmSecGroupName,
          assigned_performer: assignedPerformer,
          is_other_dept_selected: isOtherDeptSelected,
        },
        { choosen_user: selectedUser?.text },
      );

      apiUrl = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      method = "post";
      config = { baseURL: workflowBaseURL };
    }

    if (selectedTabTitle === "Backward") {
      payload = buildWorkflowPayload({
        action: "Backward",
        performer: loginPerformer,
        department: "",
        cgm_sec_group_name: "",
        assigned_performer: selectedUser?.value,
        is_other_dept_selected: false,
      });

      apiUrl = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      method = "post";
      config = { baseURL: workflowBaseURL };
    }

    if (selectedTabTitle === "Delegate") {
      payload = {
        "run-stateless": "true",
        data: {
          variables: {
            decision: "Delegate",
            assigned_user: loginPerformer,
            performer: selectedUser?.value,
            qitem_id: [itemId],
            message_to_notify: "Case Delegated",
          },
          packages: {
            Case: {
              properties: {
                id: caseDetails?.properties?.r_object_id,
              },
              href: `folders/cms_case_folder/${caseDetails?.properties?.r_object_id}`,
            },
          },
        },
      };
      apiUrl = `/processes/cms_push_back_pull_back`;
      method = "post";
    }

    if (tagName === "approveCase") {
      if (draftDocs?.length === 0) {
        await submitAndNavigate(method, apiUrl, payload, config);
      } else if (draftDocs?.length === 1) {
        try {
          setIsLoading(true);
          await moveDraftsAndSubmit([draftDocs[0]?.content?.properties?.id], method, apiUrl, payload, config);
        } catch (error) {
          onClose();
          setIsLoading(false);
          showSweetAlert({ title: "Error", text: error.message, icon: "error" });
        }
      } else if (draftDocs?.length > 1) {
        const rowsHtml = draftDocs
          .map((doc, index) => {
            const fileName = doc.content.properties.object_name;
            const versionRaw = doc.content.properties.r_version_label;
            const versionLabels = Array.isArray(versionRaw) ? versionRaw : versionRaw ? [versionRaw] : [];

            // Auto-select the latest (CURRENT) version of each document. If a draft
            // has 2 versions, CURRENT remains pre-checked; for multiple drafts with
            // different names, each one's CURRENT version is pre-checked.
            const isCurrent = versionLabels.includes("CURRENT");
            // Extract version number — prefer numeric label if available, else show first item
            const version = versionLabels.find((v) => /^\d+(\.\d+)?$/.test(v)) || versionLabels[0] || "N/A";
            return `
            <tr>
              <td><input type="checkbox" class="doc-checkbox" data-index="${index}"${isCurrent ? " checked" : ""}></td>
              <td>${fileName}</td>
              <td>${version}</td>
            </tr>
          `;
          })
          .join("");

        Swal.fire({
          title: "Select the final draft document(s)",
          html: `
          <p>Please select the version of the document that may be moved to the final document tab?</p>
          <table id="checkbox-table" style="width:100%; border-collapse:collapse;">
            <thead  style="font-size: 13px">
              <tr>
                <th>Select</th>
                <th>File Name</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px">
              ${rowsHtml}
            </tbody>
          </table>
        `,
          showCancelButton: true,
          confirmButtonText: "Move to Final",
          cancelButtonText: "No",
          showLoaderOnConfirm: true,
          allowOutsideClick: () => !Swal.isLoading(),
          customClass: {
            popup: "custom-swal-popup",
            title: "custom-swal-title",
            htmlContainer: "custom-swal-text",
            confirmButton: "common-btn-css submit-button",
            cancelButton: "common-btn-css cancel-button",
          },
          didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            const checkboxes = document.querySelectorAll(".doc-checkbox");

            // Reflect the pre-checked CURRENT versions in the button state.
            const syncConfirm = () => {
              confirmBtn.disabled = !Array.from(checkboxes).some((cb) => cb.checked);
            };
            syncConfirm();

            checkboxes.forEach((checkbox) => {
              checkbox.addEventListener("change", syncConfirm);
            });
          },
          preConfirm: async () => {
            const checkboxes = document.querySelectorAll(".doc-checkbox:checked");
            const selectedDocs = Array.from(checkboxes)
              .map((cb) => draftDocs[cb.getAttribute("data-index")]?.content?.properties?.id)
              .filter(Boolean);

            try {
              setIsLoading(true);
              await moveDraftsAndSubmit(selectedDocs, method, apiUrl, payload, config);
            } catch (error) {
              Swal.hideLoading();
              console.error(error);
            }
          },
        }).then((result) => {
          // If user cancels, still proceed with the axios call
          if (result.dismiss === Swal.DismissReason.cancel) {
            submitAndNavigate(method, apiUrl, payload, config);
          }
        });
      }
    } else {
      await submitAndNavigate(method, apiUrl, payload, config);
    }
  };

  const TAB_CONFIG = useMemo(() => {
    const config = [
      {
        title: "Forward",
        subTabs: [
          { title: "Internal", internal: true },
          {
            title: isDMDChairmanConditionMatch && tagName === "approveCase" ? "Initiating Department" : "Inter Departmental",
            interDepartmental: true,
          },
          { title: "Inter Office", interOffice: true },
        ],
      },
    ];

    // Only add Backward if not approveCase
    if (
      tagName !== "approveCase" &&
      Array.isArray(previousPerformer) &&
      previousPerformer.length > 0 &&
      !(movementRegisterData?.[1]?.content?.properties?.decision === "Push Back" && !movementRegisterData?.[2])
    ) {
      config.push({ title: "Backward", backward: true });
    }

    // Only add Delegate if not approveCase
    if (tagName !== "approveCase") {
      config.push({ title: "Delegate", delegate: true });
    }

    return config;
  }, [tagName, isDMDChairmanConditionMatch, previousPerformer, movementRegisterData]);

  // Clear error message on tab change or when popup closes
  useEffect(() => {
    if (!visible || selectedTab || selectedSubTab) {
      setErrorMsg("");
    }
  }, [selectedTab, selectedSubTab, visible]);

  // Call API only if it's Internal and CGM
  useEffect(() => {
    const fetchDepartment = async () => {
      let input_folder = office_type === "HO" ? `/ECM CONFIG/Office Type/${office_type}` : `/ECM CONFIG/Office Type/${office_type}/${location}`;

      setIsLoading(true);

      try {
        const response = await createCaseService.getVerticalCaseType({
          input_folder,
        });
        const verticalGroup =
          response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.title,
          })) || [];

        setIsLoading(false);
        setDepartmentGroup(verticalGroup);
        setVerticalGroup(verticalGroup);
      } catch (err) {
        console.error("Error fetching vertical case type:", err);
        setIsLoading(false);
      }
    };

    if (visible) {
      fetchDepartment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  let isButtonDisabled = false;
  const selectedUserCondition = selectedUser == null || selectedUser?.text == null;

  if (isLoading) {
    isButtonDisabled = true;
  } else if (selectedTab === 1) {
    // Tab 1: Disable if no selected user or missing text
    if (selectedUserCondition) {
      isButtonDisabled = true;
    }
  } else if (selectedTab === 2) {
    // Tab 2: Disable if no selected group
    if (selectedGroup == null) {
      isButtonDisabled = true;
    }
  } else if (selectedSubTab === 0) {
    // SubTab 0
    if (tagName === "approveCase") {
      if (selectedUser == null) {
        isButtonDisabled = true;
      }
    } else {
      if (selectedUserCondition || selectedGroup == null) {
        isButtonDisabled = true;
      }
    }
  } else if (selectedSubTab === 1) {
    // SubTab 1

    if (isDMDChairmanConditionMatch && tagName === "approveCase") {
      if (selectedUser == null) {
        isButtonDisabled = true;
      }
    } else if (selectedVertical == null || (office_type === "HO" && caseNature === "Confidential" && selectedUserCondition) || (office_type !== "HO" && selectedUserCondition)) {
      isButtonDisabled = true;
    }
  } else if (selectedSubTab === 2) {
    // SubTab 2
    if (selectedOfficeType === "HO") {
      if (selectedVertical == null) {
        isButtonDisabled = true;
      }
    } else {
      if (selectedTOTE == null || (caseNature === "Confidential" && selectedUserCondition)) {
        isButtonDisabled = true;
      }
    }
  }

  // Shared props passed to every ChooseUserGroup instance
  const sharedUserGroupProps = {
    tagName,
    clearAll,
    folderId,
    caseNature,
    rCreatorName,
    isUserExistData,
    param_department,
    onSelectionChange: handleSelectionChange,
    movementRegisterData,
    caseId: caseDetails?.properties?.object_name,
    functionShortCode: caseDetails?.properties?.function_short_code,
    departmentShortCode: caseDetails?.properties?.department_short_code,
  };

  const renderSubTabs = (subTabs) => (
    <TabStrip selected={selectedSubTab} onSelect={handleSelectSubTab} className="tab-strip-class">
      {subTabs.map((subTab) => (
        <TabStripTab key={subTab.title} title={subTab.title}>
          <ChooseUserGroup
            {...sharedUserGroupProps}
            internal={subTab.internal}
            verticalGroup={verticalGroup}
            interOffice={subTab.interOffice}
            departmentGroup={departmentGroup}
            interDepartmental={subTab.interDepartmental}
          />
        </TabStripTab>
      ))}
    </TabStrip>
  );

  return (
    visible && (
      <Dialog title={tagName !== "approveCase" ? `${TAB_CONFIG[selectedTab].title} Case` : "Approve Task"} onClose={onClose} className="fbd-dialog-wh">
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <S.ViewCaseContainer>
          <TabStrip selected={selectedTab} onSelect={handleSelectTab} className="tab-strip-class">
            {TAB_CONFIG.map((tab) => {
              if (tab.title === "Forward" && tab.subTabs) {
                const subTabs =
                  caseDetails?.properties?.case_nature === "Secret" ? tab.subTabs.filter((sub) => sub.title !== "Inter Departmental" && sub.title !== "Inter Office") : tab.subTabs;

                return (
                  <TabStripTab key={tab.title} title={tab.title}>
                    {renderSubTabs(subTabs)}
                  </TabStripTab>
                );
              }

              // Non-forward tabs (Backward, Delegate)
              return (
                <TabStripTab key={tab.title} title={tab.title}>
                  <ChooseUserGroup {...sharedUserGroupProps} delegate={tab.delegate} backward={tab.backward} interOffice={tab.interOffice} previousPerformer={previousPerformer} />
                </TabStripTab>
              );
            })}
          </TabStrip>

          {errorMsg && (
            <div className="border rounded p-2 mt-1">
              <p className="required-asterisk font-size-12 mb-0 text-center">{errorMsg}</p>
            </div>
          )}

          <div className="mt-3 d-flex justify-content-end gap-2">
            <Button className="common-btn-css cancel-button" onClick={handleClear}>
              Clear
            </Button>
            <Button className="common-btn-css cancel-button" onClick={onClose}>
              Cancel
            </Button>
            <Button className="common-btn-css approve-button" onClick={isLoading ? "" : handleConfirm} disabled={isButtonDisabled}>
              {isLoading ? "Initiating" : " Confirm"}
            </Button>
          </div>
        </S.ViewCaseContainer>
      </Dialog>
    )
  );
};

export default SendCase;
