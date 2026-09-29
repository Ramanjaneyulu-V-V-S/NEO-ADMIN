import React, { useState } from "react";
import PropTypes from "prop-types";

//kendo components
import { Button } from "@progress/kendo-react-buttons";
import { TextArea } from "@progress/kendo-react-inputs";
import { Dialog } from "@progress/kendo-react-dialogs";
import { Label } from "@progress/kendo-react-labels";

//redux
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { caseInboxService } from "../../services/caseManagement/caseInbox/caseInboxService";
import { chunkByUtf8Bytes } from "../../utils/chunkByUtf8Bytes";

// Sweet Alert
import { showSweetAlert } from "../sweetAlert/SweetAlert";

//date and time
import { fetchInboxCases } from "../../redux/caseManagement/caseInbox/caseInboxSlice";

const PushbackPopup = ({ visible, folderId, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state?.login);

  const { object_name } = userProfile?.properties || {};

  const [comments, setComments] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmPushBack = async () => {
    const splitComments = chunkByUtf8Bytes(comments);

    const payload1 = {
      "run-stateless": "true",
      data: {
        variables: {
          assigned_user: object_name,
          decision: "Get Performer",
        },
        packages: {
          Case: {
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

      const res = await caseInboxService.pushBackCase(payload1);

      if (res?.data?.variables?.performer) {
        const payload2 = {
          "run-stateless": "true",
          data: {
            variables: {
              decision: "Push Back",
              assigned_user: object_name,
              performer: res?.data?.variables?.performer,
              push_back_comments: splitComments,
              message_to_notify: "Case Pushed Back",
            },
            packages: {
              Case: {
                properties: {
                  id: folderId,
                },
                href: `folders/cms_case_folder/${folderId}`,
              },
            },
          },
        };

        await caseInboxService.pushBackCase(payload2);
        onClose();
        setComments("");
        localStorage.removeItem("case_comments_latest");
        navigate("/inbox");
        dispatch(fetchInboxCases({ input_task_name: "FYA" }));
      } else {
        onClose();
        setComments("");
        setIsLoading(false);
        showSweetAlert({
          title: "Error",
          text: "Failed to fetch the Performer",
          icon: "error",
        });
      }
    } catch (error) {
      onClose();
      setComments("");
      setIsLoading(false);
      showSweetAlert({
        title: "Error",
        text: error.message || "Push Back Failed",
        icon: "error",
      });
    }
  };

  return (
    visible && (
      <Dialog title="Are you sure you want Pushback?" onClose={onClose} className="pushBack-dialog-wh">
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <Label className="case-form-label">Comments</Label>
        <TextArea rows={4} className="mt-1 mb-2" value={comments} onChange={(e) => setComments(e.value)} />
        <div className="d-flex justify-content-end">
          <Button type="button" className="common-btn-css cancel-button me-2" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="common-btn-css submit-button" onClick={isLoading ? undefined : handleConfirmPushBack} disabled={!comments?.trim() || isLoading}>
            {isLoading ? "Pushing back..." : "Push Back"}
          </Button>
        </div>
      </Dialog>
    )
  );
};

PushbackPopup.propTypes = {
  visible: PropTypes.bool,
  folderId: PropTypes.string,
  onClose: PropTypes.func,
};

export default PushbackPopup;
