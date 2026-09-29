/**
 * Maps a single raw outbox API item to the grid row shape.
 * Handles both new API (flat object) and old API (nested content.properties).
 */
export function mapOutboxItem(item) {
  const props = item?.content ? (item?.content?.properties ?? {}) : (item ?? {});
  const {
    id,
    r_object_id,
    responding_object_id,
    uid_number,
    status,
    entry_type,
    mode_of_receipt,
    letter_subject,
    type_category,
    languages,
    secrecy,
    priority,
    inward_ref_number,
    address_of_sender,
    state_of_sender,
    file_number,
    nature_of_correspondence,
    source_vertical,
    due_date,
    completion_date,
    received_from,
    selected_region,
    vertical_users,
    is_bulk_letter,
    endorsed_to,
    forward_group_uid,
    region,
    letter_no,
    hrmd_users,
    group_uid,
    responding_uid,
    i_folder_id,
    user_comments,
    login_office_type,
    login_region,
    draft_office_type,
    is_endorsed,
    endorse_uid,
    draft_selected_recipients,
    ddm_vertical,
    office_order_no,
  } = props;
  const isHrmdUser = hrmd_users?.[0];

  return {
    id: id || r_object_id,
    responding_object_id: responding_object_id?.[0],
    screenName: "viewOutward",
    decision: "",
    digidak_uid: uid_number || "",
    is_bulk_letter: is_bulk_letter === "true" ? true : false,
    group_id: group_uid || "",
    status: status || "",
    entry_type: entry_type || "",
    modeOfReceipt: mode_of_receipt || "",
    subject: letter_subject || "",
    category: type_category || "",
    language: languages || "",
    secrecy: secrecy || "",
    priority: priority || "",
    receivedFrom: received_from || "",
    referenceNumber: inward_ref_number || "",
    fileNumber: file_number || "",
    natureOfCorrespondence: nature_of_correspondence || "",
    src_vertical: source_vertical || [],
    letter_no: letter_no || "",
    stateOfSender: state_of_sender || "",
    addressOfSender: address_of_sender || "",
    region: region || "",
    login_region: login_region || "",
    login_office_type: login_office_type || "",
    to: isHrmdUser || (entry_type === "Internal" ? region : received_from),
    selectedHOROTE: region?.split("-")[0] || "",
    selected_region: selected_region || "",
    assigned_user: vertical_users || [],
    due_date: due_date || "",
    responding_uid: responding_uid || "",
    completion_date: completion_date || "",
    endorsed_to: endorsed_to || "",
    group_uid: group_uid || "",
    i_folder_id: i_folder_id || [],
    user_comments: user_comments || "",
    draft_office_type: draft_office_type || [],
    draft_selected_recipients: draft_selected_recipients || [],
    is_endorsed: is_endorsed,
    endorse_uid: endorse_uid || "",
    ddm_vertical: ddm_vertical || "",
    isForwardLetter: forward_group_uid ? "YES" : "NO",
    office_order_no: office_order_no || "",
  };
}

/**
 * Maps a single raw endorsement API item to the endorsement grid row shape.
 */
export function mapEndorsementItem(item) {
  const { id, i_folder_id, endorse_uid, decision, initiator, uid_number, selected_region, status } = item?.content?.properties ?? {};

  return {
    id: id,
    i_folder_id: i_folder_id?.[0],
    endorse_uid: endorse_uid,
    screenName: "",
    decision: decision,
    initiator: initiator,
    uid_number: uid_number || "-",
    selected_region: selected_region,
    status: status || "-",
  };
}
