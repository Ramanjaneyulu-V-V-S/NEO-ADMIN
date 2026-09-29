/**
 * Derives all visibility flags for ViewEntry buttons, dropdowns, and sections.
 * Pure function — no side effects, no state mutations.
 *
 * @param {object} params
 * @param {object|null} params.digidakItem - the digidak entry data
 * @param {string} params.screenName - current screen ("viewInward" | "viewOutward")
 * @param {string} params.userName - logged-in user's object_name
 * @param {boolean} params.isUserAllowed - from useGroupPermissionCheck (vertical_head with mergeUsers)
 * @param {boolean} params.selectedVerticalHeadName - from useGroupPermissionCheck (vertical_head)
 * @param {boolean} params.selectedCGMGroupName - from useGroupPermissionCheck (selected_cgm_group)
 * @param {boolean} params.navigatedFromDDMCommunication - whether navigated from DDM listing
 * @param {boolean} params.isClickFromViewEntry - from location state
 * @param {string} params.pathname - from location state
 * @returns {object} all derived visibility flags
 */
const getViewEntryFlags = ({
  digidakItem,
  screenName,
  userName,
  isUserAllowed,
  selectedVerticalHeadName,
  selectedCGMGroupName,
  navigatedFromDDMCommunication,
  isClickFromViewEntry,
  pathname,
}) => {
  // Core derived values
  const isDDM = digidakItem?.is_ddm === true;
  const isDDMOutward = digidakItem?.is_ddm === true && digidakItem?.decision === "Outward";
  const isDDMUserAllowed = digidakItem?.ddm_users?.includes(userName);
  const isROTODDMLetter = digidakItem?.is_ro_to_ddm;
  const isGroupLetter = isClickFromViewEntry
    ? false
    : (digidakItem?.is_bulk_letter === "true" || digidakItem?.uid_number?.startsWith("G")) && pathname !== "/digidak-letterbox";

  // DDM-specific flags
  const canShowPushback =
    screenName === "viewInward" && isDDMOutward && digidakItem?.status !== "Pushback" && digidakItem?.status !== "Closed" && isUserAllowed;

  const canShowDDMAssignToDropdownDDM =
    screenName === "viewOutward" &&
    isDDMOutward &&
    (digidakItem?.status === "Assigned Head" ||
      digidakItem?.status === "Assigned" ||
      digidakItem?.status === "Reassigned" ||
      digidakItem?.status === "Reassign Head" ||
      digidakItem?.status === "Pushback");

  const canShowReassignButtonDDM =
    screenName === "viewOutward" &&
    isDDMOutward &&
    (digidakItem?.status === "Assigned Head" ||
      digidakItem?.status === "Assigned" ||
      digidakItem?.status === "Reassigned" ||
      digidakItem?.status === "Reassign Head" ||
      digidakItem?.status === "Pushback");

  const canShowAcknowledgeAndCloseButtonDDM =
    digidakItem?.status !== "Closed" && digidakItem?.status !== "Unread" && digidakItem?.type_category === "Information";

  const canShowCloseButtonDDM =
    digidakItem?.status !== "Closed" && digidakItem?.status !== "Unread" && digidakItem?.type_category === "Actionable";

  const canShowAssignUserDropdownDDM =
    screenName === "viewInward" &&
    (((digidakItem?.status === "Assigned Head" || digidakItem?.status === "Reassign Head") && isUserAllowed) ||
      ((digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned") && selectedVerticalHeadName));

  const canShowAssignUserButtonDDM =
    screenName === "viewInward" &&
    (digidakItem?.status !== "Responded" || digidakItem?.status !== "Unread") &&
    (digidakItem?.status === "Assigned Head" || digidakItem?.status === "Reassign Head") &&
    isUserAllowed;

  const canShowReassignUserButtonDDM =
    screenName === "viewInward" &&
    (digidakItem?.status !== "Responded" || digidakItem?.status !== "Unread") &&
    (digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned") &&
    selectedVerticalHeadName;

  const canShowRespondedActionsDDM = isDDMOutward && digidakItem?.status === "Responded";

  const canShowInitiateCaseButtonDDM =
    digidakItem?.type_category === "Actionable" &&
    !digidakItem?.case_number &&
    (digidakItem?.status === "Assigned Head" || digidakItem?.status === "Reassign Head" || digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned") &&
    !isROTODDMLetter &&
    isUserAllowed;

  // Non-DDM (normal flow) flags
  const showOpenButton = digidakItem?.status === "Unread" && screenName !== "viewOutward" && !navigatedFromDDMCommunication;

  const showInitiateCaseButton =
    digidakItem?.type_category === "Actionable" &&
    !digidakItem?.case_number &&
    (digidakItem?.status === "Assigned Head" || digidakItem?.status === "Reassign Head" || digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned") &&
    !isROTODDMLetter;

  const viewUserButton =
    (digidakItem?.status === "Opened" ||
      digidakItem?.status === "Reassign Head" ||
      digidakItem?.status === "Reassigned" ||
      digidakItem?.status === "Assigned Head" ||
      digidakItem?.status === "Assigned") &&
    selectedCGMGroupName;

  const viewReassignCorrespondenceButton =
    (digidakItem?.status === "Assigned Head" || digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned" || digidakItem?.status === "Reassign Head") &&
    selectedCGMGroupName;

  const AcknowledgeCloseBtnCondition =
    digidakItem?.type_category === "Information" &&
    digidakItem?.status !== "Closed" &&
    digidakItem?.status !== "Unread" &&
    (digidakItem?.status === "Opened" ||
      digidakItem?.status === "Assigned Head" ||
      digidakItem?.status === "Reassign Head" ||
      selectedCGMGroupName ||
      selectedVerticalHeadName ||
      ((digidakItem?.status === "Assigned" || digidakItem?.status === "Reassigned") && (isUserAllowed || isDDMUserAllowed)));

  const AcknowledgeCloseBtnCondition2 =
    digidakItem?.type_category === "Actionable" &&
    digidakItem?.status !== "Closed" &&
    digidakItem?.status !== "Unread" &&
    (selectedCGMGroupName || selectedVerticalHeadName || isDDMUserAllowed);

  return {
    // Core derived values
    isDDM,
    isDDMOutward,
    isDDMUserAllowed,
    isROTODDMLetter,
    isGroupLetter,
    // DDM flags
    canShowPushback,
    canShowDDMAssignToDropdownDDM,
    canShowReassignButtonDDM,
    canShowAcknowledgeAndCloseButtonDDM,
    canShowCloseButtonDDM,
    canShowAssignUserDropdownDDM,
    canShowAssignUserButtonDDM,
    canShowReassignUserButtonDDM,
    canShowRespondedActionsDDM,
    canShowInitiateCaseButtonDDM,
    // Normal flow flags
    showOpenButton,
    showInitiateCaseButton,
    viewUserButton,
    viewReassignCorrespondenceButton,
    AcknowledgeCloseBtnCondition,
    AcknowledgeCloseBtnCondition2,
  };
};

export default getViewEntryFlags;
