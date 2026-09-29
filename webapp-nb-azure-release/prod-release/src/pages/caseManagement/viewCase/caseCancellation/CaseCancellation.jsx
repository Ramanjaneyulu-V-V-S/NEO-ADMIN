import { useState } from "react";

//kendo-react
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";
import { MultiSelect } from "@progress/kendo-react-dropdowns";
import { RadioButton, TextArea } from "@progress/kendo-react-inputs";

// Icons
import { FaExclamationTriangle } from "react-icons/fa";

// Sweet Alert
import Swal from "sweetalert2";
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";

//axios
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axiosInstance from "../../../../services/axiosConfig";
import { fetchNotification } from "../../../../redux/notification/notificationSlice";
import { fetchInboxCases } from "../../../../redux/caseManagement/caseInbox/caseInboxSlice";
import { viewCaseService } from "../../../../services/caseManagement/viewCase/ViewCaseService";

const CaseCancellation = ({ visible, workflowLinks, taskDetails, folderId, caseNumber, previousPerformer, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state?.login);

  const performer = taskDetails?.properties?.performer;
  const workflowLink = taskDetails?.data?.packages?.WFParam?.href;
  const workflowId = typeof workflowLink === "string" ? workflowLink.split("/").pop() : null;

  const [loader, setLoader] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [selectedUser, setSelectedUser] = useState([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [reasonForCancellation, setReasonForCancellation] = useState("");

  const handleClose = () => {
    setSelectedValue("");
    setReasonForCancellation("");
    setSelectedUser([]);
    setShowConfirmation(false);
    setLoader(false);
    onClose();
  };

  const handleProceedToConfirmation = () => {
    if (!reasonForCancellation.trim()) {
      showSweetAlert({
        title: "Required Field",
        text: "Please provide a reason for cancellation",
        icon: "warning",
      });
      return;
    }
    setShowConfirmation(true);
  };

  const handleCaseCancellation = async () => {
    if (!reasonForCancellation.trim()) {
      showSweetAlert({
        title: "Required Field",
        text: "Please provide a reason for cancellation",
        icon: "warning",
      });
      setShowConfirmation(false);
      return;
    }

    if (!selectedValue) {
      showSweetAlert({
        title: "Required Field",
        text: "Please select notification option",
        icon: "warning",
      });
      setShowConfirmation(false);
      return;
    }

    if (selectedValue === "selected" && (!selectedUser || selectedUser?.length === 0)) {
      showSweetAlert({
        title: "Required Field",
        text: "Please select at least one user to notify",
        icon: "warning",
      });
      setShowConfirmation(false);
      return;
    }

    setLoader(true);

    try {
      const payload = {
        complete: {
          data: {
            variables: {
              reason_for_cancellation: reasonForCancellation,
            },
            packages: {
              WFParam: {
                properties: {
                  action: "cancelled",
                  id: workflowId,
                  performer: performer,
                },
                href: workflowLink,
              },
            },
          },
        },
      };

      const cleanedWorkflowLink = workflowLinks.replace("processes/", "");
      const url = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
      await axiosInstance.post(url, payload, {
        baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
      });

      if (selectedValue === "all") {
        await viewCaseService.getSelectedUserForCaseCancel({
          data: {
            variables: {
              notify_all_case_wf_users: true,
              users: [],
              in_login_user: userProfile?.properties?.object_name,
              message_to_notify: "Case Cancelled..!",
            },
            packages: {
              case_folder: {
                properties: { id: folderId },
                href: `folders/cms_case_folder/${folderId}`,
              },
            },
          },
        });
      } else {
        await viewCaseService.getSelectedUserForCaseCancel({
          data: {
            variables: {
              notify_all_case_wf_users: false,
              users: selectedUser?.map((u) => u.value) || [],
              in_login_user: userProfile?.properties?.object_name,
              message_to_notify: "Case Cancelled..!",
            },
            packages: {
              case_folder: {
                properties: { id: folderId },
                href: `folders/cms_case_folder/${folderId}`,
              },
            },
          },
        });
      }

      // keep loader for 5 seconds before showing success
      setTimeout(() => {
        setShowConfirmation(false);

        Swal.fire({
          icon: "success",
          html: `Your case <strong>${caseNumber}</strong> has been successfully cancelled.`,
          customClass: {
            popup: "custom-swal-popup",
            title: "custom-swal-title",
            htmlContainer: "custom-swal-text",
            confirmButton: "common-btn-css submit-button",
          },
        });

        handleClose();
        navigate("/inbox");
      }, 6000);

      dispatch(fetchInboxCases({ input_task_name: "FYA" }));
      dispatch(fetchNotification({}));
    } catch (error) {
      setLoader(false);
      setShowConfirmation(false);
      showSweetAlert({
        title: "Error",
        html: error.message || "Case could not be cancelled. Please try again.",
        icon: "error",
      });
    }
  };

  return (
    visible && (
      <Dialog title="Cancel Case" onClose={handleClose} className="pushBack-dialog-wh">
        {!showConfirmation ? (
          <>
            <div className="mb-3">
              <div className="mb-2 fw">
                {" "}
                Reason for Cancellation <span className="required-asterisk">*</span>
              </div>
              <TextArea
                rows={3}
                value={reasonForCancellation}
                onChange={(e) => setReasonForCancellation(e.value)}
                placeholder="Please provide a reason for cancelling this case..."
                className="font-size-12"
              />
            </div>

            <div className="mb-2 fw">Please select an option</div>

            <div className="d-flex align-items-center gap-4 mb-2">
              <div>
                <RadioButton value="all" label="All Users" name="userSelection" checked={selectedValue === "all"} onChange={(e) => setSelectedValue(e.value)} />
              </div>
              <div>
                <RadioButton
                  name="userSelection"
                  value="selected"
                  checked={selectedValue === "selected"}
                  onChange={(e) => setSelectedValue(e.value)}
                  className="font-size-11"
                  label="Selected Users"
                />
              </div>
            </div>

            {selectedValue === "selected" && (
              <MultiSelect
                data={Array.from(new Map(previousPerformer?.filter((item) => item && item.text && item.value)?.map((item) => [item.text, item])).values())}
                textField="text"
                dataItemKey="value"
                value={selectedUser}
                className="case-form-dropdown mt-2"
                onChange={(e) => setSelectedUser(e.value)}
              />
            )}

            <div className="d-flex justify-content-end mt-4">
              <Button className="common-btn-css cancel-button me-2" onClick={handleClose} disabled={loader}>
                Cancel
              </Button>
              <Button
                className="common-btn-css submit-button"
                disabled={loader || !selectedValue || (selectedValue === "selected" && !selectedUser) || !reasonForCancellation.trim()}
                onClick={handleProceedToConfirmation}
              >
                OK
              </Button>
            </div>
          </>
        ) : (
          <>
            {loader && (
              <div className="k-loading-mask">
                <div className="k-loading-image"></div>
              </div>
            )}
            <div className="text-center mb-4">
              <div className="mb-3">
                <FaExclamationTriangle className="text-warning font-48" />
              </div>
              <h5 className="fw-bold">Are you sure you want to cancel this case?</h5>
              <p className="text-muted">This action cannot be undone.</p>
              <p className="fw-bold">{caseNumber}</p>
            </div>
            <div className="d-flex justify-content-center my-3">
              <Button className="common-btn-css cancel-button me-2" onClick={() => setShowConfirmation(false)} disabled={loader}>
                Cancel
              </Button>
              <Button className="common-btn-css submit-button" disabled={loader} onClick={handleCaseCancellation}>
                {loader ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    )
  );
};

export default CaseCancellation;
