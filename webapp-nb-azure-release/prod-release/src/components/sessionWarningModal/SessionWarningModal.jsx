import React from "react";
import { Dialog } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import PropTypes from "prop-types";
import "./sessionWarningModal.css";

/**
 * Session Warning Modal
 * Displays when user's session is about to expire
 * Allows user to extend session or logout immediately
 */
const SessionWarningModal = ({ visible, remainingSeconds, onExtend, onLogout }) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Determine urgency level for styling
  const isUrgent = remainingSeconds <= 30;

  return (
    visible && (
      <Dialog title="Session Expiring" onClose={onExtend} className="session-warning-dialog-wh">
        <div className="session-warning-content">
          <div className={`session-warning-timer ${isUrgent ? "urgent" : ""}`}>{timeDisplay}</div>
          <p className="session-warning-message">Your session will expire due to inactivity.</p>
          <p className="session-warning-submessage">
            Click <strong>"Stay Logged In"</strong> to continue working, or <strong>"Logout"</strong> to end your session now.
          </p>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button onClick={onLogout} className="common-btn-css cancel-button">
            Logout
          </Button>
          <Button onClick={onExtend} className="common-btn-css submit-button">
            Stay Logged In
          </Button>
        </div>
      </Dialog>
    )
  );
};

SessionWarningModal.propTypes = {
  visible: PropTypes.bool,
  remainingSeconds: PropTypes.number.isRequired,
  onExtend: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default SessionWarningModal;
