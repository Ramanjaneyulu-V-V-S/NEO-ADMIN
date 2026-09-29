/**
 * Builds the digidak fields array used to render the "Digidak Information" panel.
 * Pure data transformation — no UI or side effects.
 *
 * @param {object|null} digidakItem - the digidak entry data
 * @param {object} context
 * @param {string} context.screenName - current screen ("viewInward" | "viewOutward")
 * @param {boolean} context.isGroupLetter - whether the entry is a group/bulk letter
 * @returns {Array<[string, any]>} array of [label, value] pairs
 */
const buildDigidakFields = (digidakItem, { screenName, isGroupLetter }) => {
  if (!digidakItem) return [];

  const isDDM = digidakItem?.is_ddm === true;
  const isROTODDMLetter = digidakItem?.is_ro_to_ddm;

  if (isGroupLetter) {
    return [
      ["DigiDak Number", digidakItem?.uid_number || ""],
      ["Initiator", digidakItem?.initiator || ""],
      ...(digidakItem?.is_endorsed_letter ? [["Is Endorsed Letter", "Endrosement"]] : [["Is Endorsed Letter", "Main Letter"]]),
      ...(digidakItem?.endorse_uid ? [["Endorsement UID", digidakItem.endorse_uid]] : []),
    ];
  }

  const outwardExternal = digidakItem?.entry_type === "External" && digidakItem?.decision === "Outward";

  const receiver_value = digidakItem?.office_order_no
    ? digidakItem?.hrmd_users?.[0]
    : outwardExternal
      ? digidakItem?.received_from
      : isROTODDMLetter
        ? digidakItem?.ddm_users?.[0]
        : isDDM
          ? digidakItem?.ddm_vertical
          : digidakItem?.selected_region;

  const sender_value = digidakItem?.decision === "Inward" ? digidakItem?.received_from : digidakItem?.login_region;

  const office_region_value = digidakItem?.entry_type === "Internal" ? digidakItem?.region : digidakItem?.state_of_sender;

  return [
    ["DigiDak Number", digidakItem?.uid_number || ""],
    ...(digidakItem?.forward_group_uid ? [["Forwarded UID", digidakItem.forward_group_uid]] : []),

    // Office Order
    ...(digidakItem?.office_order_no ? [["Office Order No.", digidakItem?.office_order_no]] : []),

    ["Status", digidakItem?.status],
    ...(digidakItem?.nature_of_correspondence === "DO Letter" ? [["Username", digidakItem.hrmd_users]] : receiver_value ? [["Receiver", receiver_value]] : []),
    ["Type", digidakItem?.entry_type],
    ["Mode of Dispatch", digidakItem?.mode_of_receipt],
    ["Letter of Subject", digidakItem?.letter_subject],
    ...(digidakItem?.is_endorsed_letter ? [["Is Endorsed Letter", "Yes"]] : [["Is Endorsed Letter", "Main Letter"]]),
    ...(digidakItem?.endorse_uid ? [["Endorsement UID", digidakItem.endorse_uid]] : []),
    ["Category", digidakItem?.type_category],
    ["Language", digidakItem?.languages],
    ["Sensitivity", digidakItem?.secrecy],
    ["Priority", digidakItem?.priority],
    ["Sender", sender_value],

    ...(digidakItem?.decision === "Inward" ? [["Reference Number", digidakItem?.inward_ref_number]] : []),
    ...(digidakItem?.responding_uid ? [["Responding UID", digidakItem.responding_uid]] : []),
    ...(digidakItem?.status === "Closed" && digidakItem?.user_comments ? [["Closed Comments", digidakItem?.user_comments]] : []),
    ...(digidakItem?.pushback_comments ? [["Push back comments", digidakItem?.pushback_comments]] : []),
    ...(digidakItem?.decision === "Inward"
      ? [
          ["Address of Sender", digidakItem?.address_of_sender],
          ["State of Sender", digidakItem?.state_of_sender],
        ]
      : []),
    ...(digidakItem?.decision === "Outward"
      ? [
          ["File Number", digidakItem?.file_number],
          ["Nature of Correspondence", digidakItem?.nature_of_correspondence],
          ...(!isDDM ? [["Source Vertical", digidakItem?.source_vertical]] : []),
        ]
      : []),
    ...(screenName === "viewOutward" ? [["Is Bulk", digidakItem?.group_uid ? "Yes" : "No"], ...(office_region_value ? [["Office Region", office_region_value]] : [])] : []),
    ...(digidakItem?.case_number ? [["Case Number", digidakItem?.case_number]] : []),
    ...(digidakItem?.remarks ? [["Forwarded Remarks", digidakItem?.remarks]] : []),
  ];
};

export default buildDigidakFields;
