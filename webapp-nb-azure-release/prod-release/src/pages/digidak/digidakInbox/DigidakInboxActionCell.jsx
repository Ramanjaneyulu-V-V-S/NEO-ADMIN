import React from "react";
import { FaFolderOpen, FaReply, FaCopy, FaChevronRight, FaClipboardList } from "react-icons/fa6";

const handleClick = (handler, isDisabled, event) => {
  if (isDisabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  handler();
};

export default function DigidakInboxActionCell({ props, isDDM, isDMDChairman, pathNameUrl, onMovementRegister, onInitiateCase, onResponseToLetter, onCopy, onForwardLetter }) {
  const dataItem = props.dataItem;

  const isInitiateCaseDisabled = !(
    dataItem?.category === "Actionable" &&
    !dataItem?.case_number &&
    (dataItem?.status === "Assigned Head" || dataItem?.status === "Reassign Head" || dataItem?.status === "Assigned" || dataItem?.status === "Reassigned")
  );

  const isResponseToLetterDisabled = !(dataItem?.category === "Actionable" && dataItem?.status !== "Closed");
  const isForwardLetterDisabled = dataItem?.status === "Closed";

  return (
    <td className="sticky-action-cell">
      <div className="d-flex align-items-center justify-content-start gap-1">
        {/* Movement Register - Always Enabled */}
        <button className="icon-wrapper icon-clickable border-0" onClick={() => onMovementRegister(props)} title="Movement Register">
          <FaClipboardList size="14px" color="#5e9bf7" />
        </button>

        {/* Initiate Case - Hide for DDM */}
        {!isDDM && pathNameUrl !== "/digidak-letterbox" && (
          <button
            className={`icon-wrapper border-0 ${isInitiateCaseDisabled ? "icon-disabled" : "icon-clickable"}`}
            onClick={(e) => handleClick(() => onInitiateCase(dataItem), isInitiateCaseDisabled, e)}
            title={isInitiateCaseDisabled ? "Conditions not met to Initiate Case" : "Initiate Case on ECM"}
          >
            <FaFolderOpen color="#0078d4" size={13} />
          </button>
        )}

        {/* Response to Letter - Hide for DDM */}
        {!isDDM && pathNameUrl === "/digidak-inbox" && (
          <button
            className={`icon-wrapper border-0 ${isResponseToLetterDisabled ? "icon-disabled" : "icon-clickable"}`}
            onClick={(e) => handleClick(() => onResponseToLetter(dataItem), isResponseToLetterDisabled, e)}
            title={isResponseToLetterDisabled ? "Conditions not met for Response to Letter" : "Response to Letter"}
          >
            <FaReply color="#107c10" size={13} />
          </button>
        )}

        {/* Copy - Always Enabled */}
        <button className="icon-wrapper icon-clickable border-0" onClick={() => onCopy(dataItem)} title="Copy">
          <FaCopy color="#d13438" size={13} />
        </button>

        {/* Forward Letter - For DMD And Chairman */}
        {isDMDChairman && (
          <button
            className={`icon-wrapper border-0 ${isForwardLetterDisabled ? "icon-disabled" : "icon-clickable"}`}
            onClick={(e) => handleClick(() => onForwardLetter(dataItem), isForwardLetterDisabled, e)}
            title={isForwardLetterDisabled ? "Letter has been closed" : "Forward Letter"}
          >
            <FaChevronRight color="#0078d4" size={13} />
          </button>
        )}
      </div>
    </td>
  );
}
