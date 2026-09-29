import { useEffect } from "react";

// Sweet Alert
import Swal from "sweetalert2";

//axios
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../../services/axiosConfig";
import { useSelector } from "react-redux";
import { chunkByUtf8Bytes } from "../../../../utils/chunkByUtf8Bytes";

const CaseClosure = ({ visible, workflowLinks, caseName, taskDetails, comments, commentsDocId }) => {
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { object_name } = userProfile?.properties || {};

  const performer = taskDetails?.properties?.performer;
  const workflowLink = taskDetails?.data?.packages?.WFParam?.href;
  const workflowId = typeof workflowLink === "string" ? workflowLink.split("/").pop() : null;

  useEffect(() => {
    if (!visible || !workflowLinks) return;

    const splitComments = chunkByUtf8Bytes(comments);

    Swal.fire({
      title: "Case Closure",
      html: `Are you sure you want to close this case <strong>${caseName}</strong>?`,
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
        if (!comments?.trim() && !commentsDocId?.trim()) {
          Swal.showValidationMessage("Please enter comment before closing the case.");
          return false;
        }

        try {
          const payload = {
            complete: {
              data: {
                packages: {
                  WFParam: {
                    properties: {
                      action: "Finished",
                      id: workflowId,
                      performer,
                      comments: splitComments,
                      ho_ro: "",
                      department: "",
                      comments_doc_id: commentsDocId || "",
                      cgm_sec_group_name: "",
                      assigned_performer: "",
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

          const cleanedWorkflowLink = workflowLinks.replace("processes/", "");
          const url = `/Integration/api/documents/process-status/${cleanedWorkflowLink}/status`;
          await axiosInstance.post(url, payload, {
            baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
          });

          navigate("/inbox");
        } catch (error) {
          Swal.hideLoading();
          Swal.showValidationMessage(error.message || "Case not closed successfully");
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, workflowLinks]);

  return null;
};

export default CaseClosure;
