import React from "react";

const getPriorityClass = (priority) => {
  switch (priority) {
    case "Urgent":
      return "priority-urgent";
    case "Immediate":
      return "priority-immediate";
    default:
      return "priority-default";
  }
};

const DigidakFieldValue = ({ label, value, screenName, isEndorsedLetter, onRespondingUIDClick, onCaseNumberClick, onEndorsementUIDClick }) => {
  switch (label) {
    case "Priority":
      return (
        <>
          :&nbsp;
          <span className={`priority-btn ${getPriorityClass(value)}`}>{value}</span>
        </>
      );

    case "Responding UID":
      return (
        <>
          :&nbsp;
          <span className="cursor-pointer text-primary text-decoration-underline" onClick={onRespondingUIDClick}>
            {value}
          </span>
        </>
      );

    case "Case Number":
      return (
        <>
          :&nbsp;
          <span
            className={screenName === "viewOutward" ? "" : "cursor-pointer text-primary text-decoration-underline"}
            onClick={screenName === "viewOutward" ? undefined : onCaseNumberClick}
          >
            {value}
          </span>
        </>
      );

    case "Endorsement UID":
      return (
        <>
          :&nbsp;
          {!isEndorsedLetter ? (
            <span className="cursor-pointer text-primary text-decoration-underline" onClick={onEndorsementUIDClick}>
              {value}
            </span>
          ) : (
            <span>{value}</span>
          )}
        </>
      );

    case "Push back comments":
    case "Closed Comments":
    case "Forwarded Remarks":
      return (
        <span className="pushback-wrapper">
          <span className="pushback-colon">:</span>
          <span className="pushback-span">{value}</span>
        </span>
      );

    default:
      if (Array.isArray(value)) {
        return <span>:&nbsp;{value.join(", ")}</span>;
      }
      return <span>:&nbsp;{value}</span>;
  }
};

export default DigidakFieldValue;
