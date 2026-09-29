import { useEffect, useState } from "react";

// Kendo components
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";
import { Checkbox } from "@progress/kendo-react-inputs";

// Sweet Alert
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";

// Redux & Router
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

// Services
import axiosInstance from "../../../../services/axiosConfig";
import ChooseUserGroup from "../../../../components/chooseUserGroup/ChooseUserGroup";
import { viewCaseService } from "../../../../services/caseManagement/viewCase/ViewCaseService";
import { createCaseService } from "../../../../services/caseManagement/createCase/createCaseService";
import { chunkByUtf8Bytes } from "../../../../utils/chunkByUtf8Bytes";

const options = [{ label: "Initiator", value: "Initiator" }];

const ApproveCase = ({ visible, comments, taskDetails, workflowLinks, commentsDocId, caseDetailsData, onClose }) => {
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, location, object_name, designation } = userProfile?.properties || {};

  const performer = taskDetails?.properties?.performer;
  const rCreatorName = caseDetailsData?.r_creator_name;
  const workflowLink = taskDetails?.data?.packages?.WFParam?.href;
  const workflowId = typeof workflowLink === "string" ? workflowLink.split("/").pop() : null;

  const [departmentGroup, setDepartmentGroup] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCGMDept, setSelectedCGMDept] = useState(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [markSelector, setMarkSelector] = useState(false);

  const [initiatorName, setInitiatorName] = useState("");

  const [clearAll, setClearAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTypeOfficeChange = async (event) => {
    setMarkSelector(event.value);

    // Reset everything else
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedCGMDept(null);
    setErrorMsg("");
    setIsLoading(false);
    setInitiatorName("");
    setClearAll(true);
    setTimeout(() => setClearAll(false), 100);

    try {
      setIsLoading(true);

      const response = await viewCaseService.getUserData({
        input_name: rCreatorName,
      });

      const userData =
        response?.entries?.map((entry) => ({
          uin: entry?.content?.properties?.uin,
          designation: entry?.content?.properties?.designation,
          object_name: entry?.content?.properties?.object_name,
        })) || [];

      setIsLoading(false);
      setSelectedUser(userData);
      setInitiatorName(userData);
    } catch {
      setIsLoading(false);
    }
  };

  const handleSelectionChange = (selectionData) => {
    setSelectedUser(selectionData.selectedUser);
    setSelectedGroup(selectionData.selectedGroup);
    setSelectedCGMDept(selectionData.selectedCGMDept);
  };

  const handleSubmit = async () => {
    setErrorMsg("");
    setIsLoading(true);

    const splitComments = chunkByUtf8Bytes(comments);

    const payload = {
      complete: {
        data: {
          packages: {
            WFParam: {
              properties: {
                action: "Approved",
                id: workflowId,
                performer: performer,
                comments: splitComments,
                ho_ro: "",
                department: "",
                comments_doc_id: commentsDocId || "",
                cgm_sec_group_name: "",
                assigned_performer: selectedUser ? selectedUser?.value : rCreatorName,
                is_other_dept_selected: false,
              },
              href: workflowLink,
            },
          },
          attachments: [],
          variables: { in_login_user: object_name }, //new key
        },
      },
    };

    try {
      const cleanedWorkflowLink = workflowLinks.replace("processes/", "");
      const url = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      await axiosInstance.post(url, payload, {
        baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
      });

      onClose();
      localStorage.removeItem("case_comments_latest");
      setIsLoading(false);
      navigate(`/sent-case`, {
        state: {
          dataLoading: true,
        },
      });
    } catch (error) {
      onClose();
      setIsLoading(false);
      showSweetAlert({
        title: "Error",
        text: error.message || "Something went wrong",
        icon: "error",
      });
    }
  };

  const handleClear = async () => {
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedCGMDept(null);
    setMarkSelector(false);
    setErrorMsg("");
    setIsLoading(false);
    setInitiatorName("");
    setClearAll(true);
    setTimeout(() => setClearAll(false), 100);
  };

  //For CGM Choose Department
  useEffect(() => {
    const fetchDepartment = async () => {
      let input_folder = office_type === "HO" ? `/ECM CONFIG/Office Type/${office_type}` : `/ECM CONFIG/Office Type/${office_type}/${location}`;

      try {
        const response = await createCaseService.getVerticalCaseType({
          input_folder,
        });
        const group =
          response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.title,
          })) || [];
        setDepartmentGroup(group);
      } catch (err) {
        console.error(err);
      }
    };

    if (visible) {
      fetchDepartment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setSelectedUser(null);
      setSelectedGroup(null);
      setSelectedCGMDept(null);
      setMarkSelector(false);
      setDepartmentGroup([]);
      setErrorMsg("");
      setIsLoading(false);
      setInitiatorName("");
      setClearAll(false);
    }
  }, [visible]);

  return (
    visible && (
      <Dialog title="Approve Task" onClose={onClose} className="pushBack-dialog-wh">
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <p className="mb-0">Mark to Initiator</p>
          <Checkbox
            data={options}
            size={"medium"}
            value={markSelector}
            layout={"horizontal"}
            className="outlined-checkbox"
            disabled={selectedCGMDept || selectedGroup}
            onChange={handleTypeOfficeChange}
          />
        </div>

        <ChooseUserGroup
          clearAll={clearAll}
          approveCase="approveCase"
          markSelector={markSelector}
          rCreatorName={rCreatorName}
          initiatorName={initiatorName}
          departmentGroup={departmentGroup}
          onSelectionChange={handleSelectionChange}
        />

        {errorMsg && (
          <div className="border rounded p-2 mt-2">
            <p className="required-asterisk font-size-12 mb-0 text-center">{errorMsg}</p>
          </div>
        )}

        <div className="d-flex justify-content-end mt-4">
          <Button className="common-btn-css cancel-button me-2" onClick={handleClear}>
            Clear
          </Button>
          <Button className="common-btn-css cancel-button me-2" onClick={onClose}>
            No
          </Button>
          <Button className="common-btn-css submit-button" onClick={handleSubmit} disabled={designation === "CGM" ? selectedUser === null && markSelector == "" : false}>
            {isLoading ? "Approving..." : "Approve"}
          </Button>
        </div>
      </Dialog>
    )
  );
};

export default ApproveCase;
