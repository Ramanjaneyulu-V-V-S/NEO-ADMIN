import { getValidDueDateForPrefill } from "../../../utils/Utils";

export const mapCopiedDataToOutwardForm = (data, sourceVerticalData) => {
  let dateOnly = data?.due_date.split(",")[0];

  const isBulk = data?.group_uid || data?.sending_bulk_letter;
  const officeTypes = data?.draft_office_type || [];
  const recipients = data?.draft_selected_recipients || [];

  const officeType = !isBulk ? officeTypes[0] : "";
  const recipient = !isBulk ? recipients[0] : "";

  const matchedVertical = officeType === "Verticals" && recipient ? sourceVerticalData.find((opt) => opt.value === recipient || opt.text === recipient) : null;

  const matchedSourceVertical =
    Array.isArray(data?.src_vertical) && sourceVerticalData?.length
      ? data.src_vertical.map((v) => sourceVerticalData.find((opt) => opt.text === v || opt.value === v)).filter(Boolean)
      : [];

  const responseUid = Array.isArray(data?.responding_uid) ? data.responding_uid[0] : data?.responding_uid || "";

  const mappedHrmdUser = !isBulk && officeType === "Users" && recipient ? { text: recipient, value: recipient } : "";

  const mappedDDMVertical =
    data?.ddm_vertical && sourceVerticalData?.length ? sourceVerticalData.find((opt) => opt.value === data.ddm_vertical || opt.text === data.ddm_vertical) : "";

  const mappedDDMUser = officeType === "DDM" && recipient ? { text: recipient, value: recipient } : "";

  return {
    type: data?.entry_type || "Internal",
    subtype: data?.natureOfCorrespondence || "",
    modeOfDispatch: data?.modeOfReceipt || "",
    subject: data?.subject || "",
    taskCategory: data?.category || "",
    priority: data?.priority || "",
    secrecy: data?.secrecy || "",
    language: data?.language || "",

    srcVerticalId: matchedSourceVertical,
    sendingBulkLetter: isBulk ? true : false,

    fileNumber: data?.fileNumber ? { value: data.fileNumber, text: data.fileNumber } : "",

    responseToDigidakId: responseUid ? { value: responseUid, text: responseUid } : "",

    // dueDate: getValidDueDateForPrefill(data?.due_date),
    dueDate: getValidDueDateForPrefill(dateOnly),

    documentType: data?.document_type || "upload",

    ro: !isBulk && officeType ? { text: officeType, value: officeType } : "",
    department: !isBulk && ["HO", "RO", "TE"].includes(officeType) ? recipient : "",
    in_hrmd_users: mappedHrmdUser,
    in_outward_vertical: !isBulk && officeType === "Verticals" ? matchedVertical : "",
    // DDM users selection
    in_ddm_users: mappedDDMUser,

    ros: isBulk ? officeTypes : [],
    departments: isBulk ? recipients : [],

    categoryExternal: data?.receivedFrom || "",
    recipientAddress: data?.addressOfSender || "",
    stateOfRecipient: data?.stateOfSender || "",
    externalFile: data?.external_file || null,

    toDepartmentId: mappedDDMVertical,
  };
};
