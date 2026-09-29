import { useState } from "react";
import { Checkbox } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";
import { Label } from "@progress/kendo-react-labels";

const ViewRespondedActions = ({ digidakItem, onFollowUp, onClose, username, handleBackToScreen }) => {
  const [checked, setChecked] = useState(false);
  const shouldRender = digidakItem?.status === "Responded";

  if (!shouldRender) return null;

  return (
    <>
      <div className="btn-area position-absolute rounded bottom-0 start-0 end-0 bg-white px-3 pt-1 pb-3">
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="d-flex align-items-center gap-2">
            <Checkbox checked={checked} onChange={(e) => setChecked(e.value)} />
            <Label className="case-form-label mb-0 mt-0">
              Is Satisfactory <span className="required-asterisk">*</span>
            </Label>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Button className="common-btn-css submit-button" onClick={() => onFollowUp(checked)} disabled={checked} title="Follow Up">
              Follow Up
            </Button>
            <Button className="common-btn-css submit-button bg-red-500" onClick={() => onClose(checked)} disabled={!checked} title="Close">
              Close
            </Button>
            <Button className="common-btn-css save-button" onClick={handleBackToScreen} title="Back">
              Back
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViewRespondedActions;
