import { useState, useRef, useEffect, useCallback } from "react";

// styled-components
import * as S from "./header.styles";

// router
import { useNavigate } from "react-router-dom";

// Kendo components
import { AppBar, AppBarSection, AppBarSpacer } from "@progress/kendo-react-layout";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { RadioGroup } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";

// Custom components
import ViewProfile from "../viewProfile/ViewProfile";
import ProfilePopup from "../profilePopup/ProfilePopup";
import NotificationPopup from "../notificationPopup/NotificationPopup";
import NotificationPreferences from "../notificationPreferences/NotificationPreferences";

// Icons
import { FaUserClock } from "react-icons/fa";
import { GiHamburgerMenu } from "react-icons/gi";
import { RiNotification2Fill } from "react-icons/ri";
import { IoBookOutline } from "react-icons/io5";

//services
import { notificationService } from "../../services/caseManagement/notification/notificationService";
import { loginService } from "../../services/login/loginService";
import { useDispatch } from "react-redux";
import { LOGOUT_ACTION, persistor } from "../../redux/store";
import { broadcastLogout } from "../../hooks/useSessionSync";
import { clearAuthSession } from "../../services/sessionCleanup";

// Constants
const ACTIONS = {
  PROFILE: "profile",
  NOTIFICATION_SETTINGS: "notificationSettings",
  LOGOUT: "logout",
};

const Header = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const [notificationData, setNotificationData] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [selectedManual, setSelectedManual] = useState("");

  const USER_MANUALS = [
    { label: "User Manual For Case Management", value: "user-manual-cms.pdf" },
    { label: "User Manual For Digidak", value: "user-manual-digidak.pdf" },
    { label: "User Manual For DDMs and CPD Users", value: "user-manual-cpd-ddm.pdf" },
  ];

  const [popupVisibility, setPopupVisibility] = useState({
    profile: false,
    notification: false,
    viewProfile: false,
    notificationSettings: false,
    userManual: false,
  });

  const togglePopup = useCallback((key) => {
    setPopupVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const closePopup = useCallback((key) => {
    setPopupVisibility((prev) => ({ ...prev, [key]: false }));
  }, []);

  const handleMenuAction = async (action) => {
    switch (action) {
      case ACTIONS.PROFILE:
        togglePopup("viewProfile");
        break;
      case ACTIONS.NOTIFICATION_SETTINGS:
        togglePopup("notificationSettings");
        break;
      case ACTIONS.LOGOUT:
        setIsLoggingOut(true);
        closePopup("profile");
        try {
          // Destroy server session, clear cookies & tokens
          await loginService.logout();
          // Broadcast logout to all other tabs before logging out
          broadcastLogout();
          dispatch({ type: LOGOUT_ACTION });
          await persistor.purge();
          clearAuthSession();
          navigate("/", { replace: true });
        } finally {
          setIsLoggingOut(false);
        }
        break;
      default:
        break;
    }
  };

  const handleClickOutside = useCallback(
    (event) => {
      if (popupVisibility.notification && notificationRef.current && !notificationRef.current.contains(event.target) && !event.target.closest(".notification-icon")) {
        closePopup("notification");
      }

      if (popupVisibility.profile && profileRef.current && !profileRef.current.contains(event.target) && !event.target.closest(".profile-icon")) {
        closePopup("profile");
      }
    },
    [popupVisibility, closePopup],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  // Note: Session timeout with warning is now handled by useSessionTimeout hook in App.jsx

  const fetchNotifications = useCallback(async () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    try {
      setNotificationLoading(true);
      const response = await notificationService.getNotification({
        input_created_on: thirtyDaysAgo.toISOString()?.slice(0, 10),
        input_created_on_: today.toISOString()?.slice(0, 10),
        page: 1,
        start: 0,
        "items-per-page": 50,
      });
      const notifications = response?.entries || [];
      setNotificationData(notifications);
    } catch (error) {
      console.error(error);
      setNotificationData([]);
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <>
      {isLoggingOut && (
        <div className="k-loading-mask" style={{ position: "fixed", inset: 0, zIndex: 10000 }} role="status" aria-live="polite" aria-label="Signing out">
          <span className="k-loading-text">Signing out…</span>
          <div className="k-loading-image"></div>
          <div className="k-loading-color"></div>
        </div>
      )}
      <S.HeaderContainer as={AppBar} className="px-0 py-2 mb-2">
      <AppBarSection>
        <GiHamburgerMenu
          className="pointer header-icons"
          onClick={() => {
            onMenuClick();
          }}
        />
      </AppBarSection>

      <AppBarSpacer />

      <div className="position-relative ms-1">
        <IoBookOutline
          title="User Manual"
          className="header-icons user-manual-icon"
          onClick={() => {
            setSelectedManual("");
            togglePopup("userManual");
          }}
        />
      </div>

      {popupVisibility.userManual && (
        <Dialog title="Download User Manual" onClose={() => closePopup("userManual")} width={400}>
          <div className="py-2">
            <RadioGroup data={USER_MANUALS} layout="vertical" value={selectedManual} onChange={(e) => setSelectedManual(e.value)} />
          </div>

          <DialogActionsBar>
            <div className="d-flex justify-content-end mt-1 gap-2">
              <Button
                disabled={!selectedManual}
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = `${import.meta.env.BASE_URL}templates/${selectedManual}`;
                  link.download = selectedManual;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  closePopup("userManual");
                }}
                className="common-btn-css submit-button me-2 mb-2"
              >
                Download
              </Button>
            </div>
          </DialogActionsBar>
        </Dialog>
      )}

      {/* Notification Icon */}
      <div className="position-relative ms-1">
        <RiNotification2Fill
          title="Notification"
          className="header-icons notification-icon"
          onClick={(e) => {
            e.stopPropagation();
            togglePopup("notification");
          }}
        />
        <span className="notification-count">{notificationLoading ? "..." : notificationData?.filter((item) => !item.content.properties.isread)?.length || 0}</span>
        {popupVisibility.notification && (
          <div className="popup-wrapper position-fixed" ref={notificationRef}>
            <NotificationPopup onClose={() => closePopup("notification")} notificationData={notificationData} onRefresh={fetchNotifications} />
          </div>
        )}
      </div>

      {/* Profile Icon */}
      <div className="position-relative ms-1">
        <FaUserClock
          title="User Profile"
          className="header-icons profile-icon"
          onClick={(e) => {
            e.stopPropagation();
            togglePopup("profile");
          }}
        />
        {popupVisibility.profile && (
          <div className="profile-popup-wrapper position-fixed" ref={profileRef}>
            <ProfilePopup onClose={() => closePopup("profile")} handleMenuClick={handleMenuAction} />
          </div>
        )}
      </div>

      <ViewProfile visible={popupVisibility.viewProfile} onClose={() => togglePopup("viewProfile")} />
      <NotificationPreferences visible={popupVisibility.notificationSettings} onClose={() => togglePopup("notificationSettings")} />
      </S.HeaderContainer>
    </>
  );
};

export default Header;
