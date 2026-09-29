import { useEffect } from "react";

// Sweet Alert
import Swal from "sweetalert2";
import { showSweetAlert } from "../sweetAlert/SweetAlert";

// Router
import { useNavigate } from "react-router-dom";

//axios
import axiosInstance from "../../services/axiosConfig";

const AcquirePopup = ({ visible, screen, folderId, workflowLinks, onAcquired, caseName, gridData }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!visible || !workflowLinks) return;

    Swal.fire({
      title: "Acquire Case",
      html: `Are you sure you want to acquire <strong>${caseName ? caseName.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]) : ""}</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
      showLoaderOnConfirm: true,
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
      preConfirm: async () => {
        try {
          const payload = {
            acquire: {
              data: {
                variables: {},
              },
            },
          };

          const cleanedWorkflowLink = workflowLinks.replace("processes/", "");
          const url = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
          const putResponse = await axiosInstance.post(url, payload, {
            baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
          });

          if (!putResponse) {
            throw new Error("Failed to update status");
          }

          const payload1 = {
            "run-stateless": "true",
            data: {
              variables: {
                for_acquire: true,
              },
              packages: {
                case_folder: {
                  properties: {
                    id: folderId,
                  },
                  href: `folders/cms_case_folder/${folderId}`,
                },
              },
            },
          };

          await axiosInstance.post(`/processes/cms_set_task_name`, payload1);

          if (screen === "inbox") {
            navigate(`/view-case/${gridData?.folder_id}`, {
              state: {
                screenName: "inboxScreen",
                caseStatus: gridData?.case_status,
                acquireStatus: 1,
                workflowLinks: gridData?.links,
                folderId: gridData?.folder_id,
                itemId: gridData?.item_id,
                taskPerformer: gridData?.task_performer,
                rModifier: gridData?.r_modifier,
                autoNumOutput: gridData?.case_name,
                isInitiateWorkflow: true,
              },
            });
          } else {
            onAcquired?.();
          }

          showSweetAlert({
            title: "Success",
            text: "Case acquired successfully!",
            icon: "success",
          });
        } catch (error) {
          Swal.hideLoading();
          showSweetAlert({
            title: "Error",
            text: error.message || "Case not acquired",
            icon: "error",
          });
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });
  }, [visible, workflowLinks]);

  return null;
};

export default AcquirePopup;
