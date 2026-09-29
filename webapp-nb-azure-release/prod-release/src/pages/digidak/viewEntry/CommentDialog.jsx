import React, { useRef, useState } from "react";
import { Button } from "@progress/kendo-react-buttons";
import { TextArea } from "@progress/kendo-react-inputs";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

const CommentDialog = ({ commentAction, loader, onSave, onClose }) => {
  const fileInputRef = useRef(null);
  const [userComment, setUserComment] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleClose = () => {
    setUserComment("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSave = () => {
    onSave({ userComment: userComment.trim(), selectedFile });
  };

  return (
    <Dialog onClose={handleClose} title={"Add Comment"} className="comments-dialog">
      <div className="p-1">
        <div className="mb-3">
          <TextArea
            value={userComment}
            className="font-size-13"
            onChange={(e) => setUserComment(e.target.value)}
            placeholder="Enter your comment..."
            rows={3}
            maxLength={1000}
          />

          {commentAction !== "PUSHBACK" && (
            <div className="mt-3">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="form-control" accept=".doc,.docx,.xls,.xlsx,.txt" />
            </div>
          )}
        </div>
      </div>

      <DialogActionsBar>
        <div className="d-flex justify-content-end gap-2">
          <Button type="button" onClick={handleClose} className="common-btn-css cancel-button">
            Cancel
          </Button>

          <Button type="button" onClick={handleSave} disabled={loader || !userComment?.trim()} className="common-btn-css submit-button">
            Save
          </Button>
        </div>
      </DialogActionsBar>
    </Dialog>
  );
};

export default CommentDialog;
