import React, { useState, useEffect } from "react";

// kendo component
import { Dialog } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { DropDownList } from "@progress/kendo-react-dropdowns";

// Sweet Alert
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";

//redux slice
import { useNavigate } from "react-router-dom";

// redux
import { useSelector } from "react-redux";

// dummy service
import { viewCaseService } from "../../../../services/caseManagement/viewCase/ViewCaseService";
import { chunkByUtf8Bytes } from "../../../../utils/chunkByUtf8Bytes";

const WorkFlow = ({ visible, folderId, comments, commentsDocId, onClose }) => {
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { department_short_code, ro_short_code, office_type, object_name, user_grade } = userProfile?.properties || {};

  const [isLoading, setIsLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [userNames, setUserNames] = useState([]);
  const [groupNames, setGroupNames] = useState([]);

  const [userData, setUserData] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const isInitiateDisabled = !selectedGroup || !selectedUser;

  const handleSelectGroup = async (e) => {
    const selectedValue = e.value?.value || "";
    const isECMGroup = selectedValue?.toLowerCase()?.startsWith("ecm_");

    setSelectedGroup(e.value);

    // Reset user dropdown and user info
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);
    setIsLoading(true);

    try {
      const response = await viewCaseService.getUserNames({
        "run-stateless": "true",
        data: {
          variables: {
            is_group: isECMGroup,
            office_type: office_type,
            remove_user_name: object_name,
            ro_short_code: office_type !== "HO" ? ro_short_code : "",
            dept_short_code_multi: [department_short_code],
            group_name: isECMGroup ? selectedValue : "",
            user_grade: isECMGroup ? "" : selectedValue,
          },
        },
      });

      setIsLoading(false);

      const userData =
        response?.data?.variables?.op_user_name?.map((entry) => ({
          text: entry,
          value: entry,
        })) || [];

      setUserNames(userData);
    } catch {
      setIsLoading(false);
    }
  };

  const handleSelectUser = async (e) => {
    const userLoginName = e?.value?.value;
    setSelectedUser(e.target.value);
    setIsLoading(true);
    try {
      const response = await viewCaseService.getUserData({
        input_name: userLoginName,
      });

      const userData =
        response?.entries?.map((entry) => ({
          uin: entry?.content?.properties?.uin,
          designation: entry?.content?.properties?.designation,
        })) || [];

      setIsLoading(false);
      setUserData(userData);
    } catch {
      setIsLoading(false);
    }
  };

  const handleInitiate = async () => {
    setErrorMsg("");
    const splitComments = chunkByUtf8Bytes(comments);

    const payload = {
      data: {
        variables: {
          performer: selectedUser?.text,
          comments: splitComments || "",
          comments_doc_id: commentsDocId || "",
          message_to_notify: "Case Initiated",
          selected_group_at_initate: selectedGroup?.value,
          in_login_user: object_name, //new key
        },
        packages: {
          CASE: {
            properties: {
              id: folderId,
            },
            href: `folders/cms_case_folder/${folderId}`,
          },
        },
      },
    };

    try {
      setIsLoading(true);
      const response = await viewCaseService.initiateLinearProcess(payload);

      if (response?.properties?.process_id) {
        localStorage.removeItem("case_comments_latest");

        setIsLoading(false);
        navigate(`/sent-case`, {
          state: {
            dataLoading: true,
          },
        });
      } else {
        onClose();
        setIsLoading(false);
        setSelectedGroup(null);
        setSelectedUser(null);
        showSweetAlert({
          title: "Error",
          text: "Failed to Initiate Workflow",
          icon: "error",
        });
      }
    } catch (error) {
      onClose();
      setIsLoading(false);
      showSweetAlert({
        title: "Error",
        text: error.message || "Push Back Failed",
        icon: "error",
      });
    }
  };

  useEffect(() => {
    if (!visible) {
      setSelectedUser(null);
      setErrorMsg("");
      setIsLoading(false);
    }
  }, [visible]);

  //For Get Grades
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await viewCaseService.getGrade({
          "run-stateless": "true",
          data: { variables: { in_user_grade: user_grade } },
        });

        const groups =
          response?.data?.variables?.out_list_of_grades?.map((displayName) => ({
            text: displayName,
            value: displayName,
          })) || [];

        setGroupNames(groups);
      } catch (err) {
        console.error(err);
      }
    };

    if (visible) {
      fetchGroups();
    }
  }, [visible]);

  return (
    visible && (
      <Dialog title="Initiate WorkFlow" onClose={onClose} className="work-flow-dialog-wh">
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <p className="mb-0">
            Choose Grade: <span className="required-asterisk">*</span>
          </p>
          <DropDownList
            data={groupNames
              ?.map((item) => ({
                ...item,
                text: item.text.toUpperCase(),
              }))
              ?.sort((a, b) => {
                // Identify categories
                const getCategory = (value) => {
                  if (value.toLowerCase().startsWith("group")) return 0; // Group = priority 0
                  if (value.toLowerCase().startsWith("grade")) return 1; // Grade = priority 1
                  if (value.toLowerCase().includes("ecm")) return 2; // ECM = priority 2
                  return 3; // Others, if any
                };

                const categoryA = getCategory(a.value);
                const categoryB = getCategory(b.value);

                // First sort by category
                if (categoryA !== categoryB) {
                  return categoryA - categoryB;
                }

                // If same category, sort alphabetically by text
                return a.text.localeCompare(b.text);
              })}
            textField="text"
            dataItemKey="value"
            value={selectedGroup}
            className="w-50 case-form-dropdown"
            onChange={(e) => handleSelectGroup(e)}
          />
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <p className="mb-0">
            Choose User: <span className="required-asterisk">*</span>
          </p>
          <DropDownList
            data={userNames.filter((item) => item && item.text && item.value)}
            textField="text"
            dataItemKey="value"
            value={selectedUser}
            className="w-50 case-form-dropdown"
            onChange={(e) => handleSelectUser(e)}
            disabled={!selectedGroup}
          />
        </div>

        <div className="mt-4">
          <div className="mb-2">
            <strong>UIN:</strong> {userData?.[0]?.uin || "-"}
          </div>
          <div>
            <strong>Designation:</strong> {userData?.[0]?.designation || "-"}
          </div>
        </div>

        {errorMsg && (
          <div className="border rounded p-2 mt-2">
            <p className="required-asterisk font-size-12 mb-0 text-center">{errorMsg}</p>
          </div>
        )}

        <div className="mt-4 d-flex justify-content-end gap-2">
          <Button className="common-btn-css approve-button" onClick={handleInitiate} disabled={isInitiateDisabled}>
            {isLoading ? "Initiating..." : "Initiate"}
          </Button>
          <Button className="common-btn-css cancel-button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Dialog>
    )
  );
};

export default WorkFlow;
