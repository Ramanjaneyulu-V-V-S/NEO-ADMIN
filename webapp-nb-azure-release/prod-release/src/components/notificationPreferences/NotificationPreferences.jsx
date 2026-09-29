import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";

//styled-components
import * as S from "./notificationPreferences.styles";

//kendo component
import { Dialog } from "@progress/kendo-react-dialogs";

//react-icons
import { MdNotifications } from "react-icons/md";

//services
import { loginService } from "../../services/login/loginService";

//sweetalert
import { showSweetAlert } from "../sweetAlert/SweetAlert";
import { Button } from "@progress/kendo-react-buttons";

const NotificationPreferences = ({ visible, onClose }) => {
  const userProfile = useSelector((state) => state.login.userProfile);

  const [isLoading, setIsLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  const [preferences, setPreferences] = useState({
    receiveAll: true,
    approvedCases: true,
    cancelledCases: true,
    delegatedCases: true,
    pushedBackCases: true,
    forwardedCases: true,
  });

  const handleMasterCheckboxChange = (checked) => {
    setPreferences({
      receiveAll: checked,
      approvedCases: checked,
      cancelledCases: checked,
      delegatedCases: checked,
      pushedBackCases: checked,
      forwardedCases: checked,
    });
  };

  const handleIndividualCheckboxChange = (key, checked) => {
    const newPreferences = {
      ...preferences,
      [key]: checked,
    };

    if (!checked) {
      newPreferences.receiveAll = false;
    } else {
      // If all individual checkboxes are checked, check "receive all"
      const allChecked = Object.keys(newPreferences)
        ?.filter((k) => k !== "receiveAll")
        ?.every((k) => newPreferences[k]);
      newPreferences.receiveAll = allChecked;
    }

    setPreferences(newPreferences);
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Convert preferences state to API format array
      const notificationArray = [];

      // If "receive all" is checked, send all individual values instead of just "All"
      if (preferences.receiveAll) {
        notificationArray?.push("Approved");
        notificationArray?.push("cancelled");
        notificationArray?.push("Delegate");
        notificationArray.push("Push Back");
        notificationArray.push("Forward");
      } else {
        // Only send the individually selected ones
        if (preferences.approvedCases) notificationArray.push("Approved");
        if (preferences.cancelledCases) notificationArray.push("cancelled");
        if (preferences.delegatedCases) notificationArray.push("Delegate");
        if (preferences.pushedBackCases) notificationArray.push("Push Back");
        if (preferences.forwardedCases) notificationArray.push("Forward");
      }

      const payload = {
        "run-stateless": "true",
        data: {
          variables: {
            flag: true,
            in_receive_notify: notificationArray,
            inp_object_id: userProfile?.properties?.id,
          },
        },
      };

      // Get the user's object name from userProfile
      const id = userProfile?.properties?.id;
      if (!id) {
        throw new Error("User id not found");
      }

      await loginService.updateUserProfile(payload, id);

      setIsLoading(false);

      // Show success message
      showSweetAlert({
        title: "Success!",
        text: "Notification preferences saved successfully.",
        icon: "success",
      });

      // Close the popup on success
      onClose();
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      // Show error message
      showSweetAlert({
        title: "Error!",
        text: "Failed to save notification preferences. Please try again.",
        icon: "error",
      });
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!userProfile?.properties?.object_name) {
        return;
      }

      setIsLoading(true);
      setNoData(false);

      try {
        const params = {
          inline: true,
          page: 1,
          start: 0,
          "items-per-page": 50,
          input_name: userProfile?.properties?.object_name,
        };
        const res = await loginService.getUserProfile(params);
        const data = res?.entries?.[0]?.content?.properties?.receive_email_notification_;

        // Map API response to preferences state
        if (data && Array.isArray(data)) {
          const hasAll = data?.includes("All");

          // Check if all individual types are present (which means "receive all" should be true)
          const allIndividualTypes = ["Approved", "cancelled", "Delegate", "Push Back", "Forward"];
          const hasAllIndividualTypes = allIndividualTypes?.every((type) => data?.includes(type));

          const newPreferences = {
            receiveAll: hasAll || hasAllIndividualTypes,
            approvedCases: hasAll || data?.includes("Approved"),
            cancelledCases: hasAll || data?.includes("cancelled"),
            delegatedCases: hasAll || data?.includes("Delegate"),
            pushedBackCases: hasAll || data?.includes("Push Back"),
            forwardedCases: hasAll || data?.includes("Forward"),
          };
          setIsLoading(false);
          setPreferences(newPreferences);
        } else {
          setIsLoading(false);
          setNoData(true);
        }
      } catch (error) {
        console.error(error);
        setIsLoading(false);
        setNoData(true);
      }
    };

    if (visible) {
      fetchPreferences();
    }
  }, [visible, userProfile]);

  return (
    visible && (
      <Dialog title="Email Notification Preferences" onClose={onClose} className="notification-preferences-popup" width={450}>
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <div className="p-2">
          {noData && !isLoading && (
            <div className="d-flex flex-column justify-content-center align-items-center text-center text-secondary py-4 px-3">
              <MdNotifications className="notif-empty-icon" />
              <p className="mb-0 font-size-12 fw-medium">No notification preferences data available.</p>
              <p className="mt-1 mb-0 font-size-12 notif-empty-subtitle">Please contact your administrator if this issue persists.</p>
            </div>
          )}
          {!noData && (
            <>
              {/* Master Checkbox */}
              <div className="mb-3">
                <S.CheckboxContainer>
                  <S.CheckboxInput type="checkbox" id="receiveAll" checked={preferences.receiveAll} onChange={(e) => handleMasterCheckboxChange(e.target.checked)} />
                  <S.CheckboxLabel htmlFor="receiveAll">
                    <S.CheckboxIcon>
                      <MdNotifications />
                    </S.CheckboxIcon>
                    <S.CheckboxText>
                      <strong>Receive all Types of Notifications</strong>
                    </S.CheckboxText>
                  </S.CheckboxLabel>
                </S.CheckboxContainer>
              </div>

              <S.Divider />

              {/* Individual Checkboxes */}
              <div className="mb-3">
                <S.SectionTitle>Receive notifications Only for:</S.SectionTitle>

                <div className="ps-4">
                  <S.CheckboxContainer>
                    <S.CheckboxInput
                      type="checkbox"
                      id="approvedCases"
                      checked={preferences.approvedCases}
                      onChange={(e) => handleIndividualCheckboxChange("approvedCases", e.target.checked)}
                    />
                    <S.CheckboxLabel htmlFor="approvedCases">
                      <S.CheckboxText>Approved Cases</S.CheckboxText>
                    </S.CheckboxLabel>
                  </S.CheckboxContainer>

                  <S.CheckboxContainer>
                    <S.CheckboxInput
                      type="checkbox"
                      id="cancelledCases"
                      checked={preferences.cancelledCases}
                      onChange={(e) => handleIndividualCheckboxChange("cancelledCases", e.target.checked)}
                    />
                    <S.CheckboxLabel htmlFor="cancelledCases">
                      <S.CheckboxText>Cancelled Cases</S.CheckboxText>
                    </S.CheckboxLabel>
                  </S.CheckboxContainer>

                  <S.CheckboxContainer>
                    <S.CheckboxInput
                      type="checkbox"
                      id="delegatedCases"
                      checked={preferences.delegatedCases}
                      onChange={(e) => handleIndividualCheckboxChange("delegatedCases", e.target.checked)}
                    />
                    <S.CheckboxLabel htmlFor="delegatedCases">
                      <S.CheckboxText>Delegated Cases</S.CheckboxText>
                    </S.CheckboxLabel>
                  </S.CheckboxContainer>

                  <S.CheckboxContainer>
                    <S.CheckboxInput
                      type="checkbox"
                      id="pushedBackCases"
                      checked={preferences.pushedBackCases}
                      onChange={(e) => handleIndividualCheckboxChange("pushedBackCases", e.target.checked)}
                    />
                    <S.CheckboxLabel htmlFor="pushedBackCases">
                      <S.CheckboxText>Pushed Back Cases</S.CheckboxText>
                    </S.CheckboxLabel>
                  </S.CheckboxContainer>

                  <S.CheckboxContainer>
                    <S.CheckboxInput
                      type="checkbox"
                      id="forwardedCases"
                      checked={preferences.forwardedCases}
                      onChange={(e) => handleIndividualCheckboxChange("forwardedCases", e.target.checked)}
                    />
                    <S.CheckboxLabel htmlFor="forwardedCases">
                      <S.CheckboxText>Forwarded Cases</S.CheckboxText>
                    </S.CheckboxLabel>
                  </S.CheckboxContainer>
                </div>
              </div>

              <hr />
            </>
          )}

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-2">
            <Button className="common-btn-css cancel-button" onClick={handleCancel}>
              {noData ? "Close" : "Cancel"}
            </Button>
            {!noData && (
              <Button className="common-btn-css submit-button" onClick={handleSave}>
                Save Preferences
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    )
  );
};

export default NotificationPreferences;
