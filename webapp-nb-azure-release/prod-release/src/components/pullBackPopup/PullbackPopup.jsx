import React, { useState } from "react";
import PropTypes from "prop-types";

//kendo components
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";

//redux
import { useNavigate } from "react-router-dom";
import { sentCaseService } from "../../services/caseManagement/sentCases/sentCaseService";

// Sweet Alert
import { showSweetAlert } from "../sweetAlert/SweetAlert";

//redux
import { useSelector } from "react-redux";
import axiosInstance from "../../services/axiosConfig";

const PullBackPopup = ({ visible, selectedCase, onClose }) => {
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { object_name } = userProfile?.properties || {};
  const { folder_id, case_name } = selectedCase || {};
  const [isDownload, setIsDownload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownloadNotesheet = async () => {
    setIsDownload(true);
    try {
      const response = await sentCaseService.getNotesheetId({
        input_folder_path: `/Case/${case_name}`,
      });
      const note_sheet_id = response?.entries?.[0]?.content?.properties?.id;

      if (!note_sheet_id) {
        setIsDownload(false);
        throw new Error("Notesheet ID not found.");
      }

      const blob = await sentCaseService.downloadNotesheet(note_sheet_id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${case_name}.docx`);
      document.body.appendChild(link);
      link.click();

      setIsDownload(false);

      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setIsDownload(false);
      showSweetAlert({
        title: "Error",
        text: "Download failed, please check the document id",
        icon: "error",
      });
    }
  };

  const handleConfirmPullBack = async () => {
    setIsLoading(true);

    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          decision: "Pull Back",
          performer: object_name,
          message_to_notify: "Case Pulled Back",
        },
        packages: {
          Case: {
            properties: {
              id: folder_id,
            },
            href: `folders/cms_case_folder/${folder_id}`,
          },
        },
      },
    };

    try {
      await sentCaseService.pullBackCase(payload);

      const payload1 = {
        "run-stateless": "true",
        data: {
          variables: {
            for_acquire: true,
          },
          packages: {
            case_folder: {
              properties: {
                id: folder_id,
              },
              href: `folders/cms_case_folder/${folder_id}`,
            },
          },
        },
      };
      await axiosInstance.post(`/processes/cms_set_task_name`, payload1);

      onClose();
      navigate("/inbox");
      localStorage.removeItem("case_comments_latest");
    } catch (error) {
      onClose();
      setIsLoading(false);
      showSweetAlert({
        title: "Error",
        text: error.message || "Pull Back Failed, Please try again.",
        icon: "error",
      });
    }
  };

  return (
    visible && (
      <Dialog title="Confirmation Pull Back" onClose={onClose} className="pushBack-dialog-wh">
        {(isLoading || isDownload) && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}
        <p>The immediate comment given by you will be erased if you pull back the case. Kindly download the note sheet before proceeding.</p>
        <Button className="font-size-11" onClick={handleDownloadNotesheet}>
          Download Notesheet
        </Button>
        <div className="d-flex justify-content-end mt-5">
          <Button className="common-btn-css cancel-button me-2" onClick={onClose}>
            Cancel
          </Button>
          <Button className="common-btn-css submit-button" onClick={isLoading ? undefined : handleConfirmPullBack} disabled={isLoading}>
            {isLoading ? "Pulling back..." : "Pull Back"}
          </Button>
        </div>
      </Dialog>
    )
  );
};

PullBackPopup.propTypes = {
  visible: PropTypes.bool,
  selectedCase: PropTypes.object,
  onClose: PropTypes.func,
};

export default PullBackPopup;
