import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { createDigidakOutward } from "../../../redux/digidak/outward/digidakOutwardSlice";
import { digidakOutwardService } from "../../../services/digidak/outward/digidakOutwardService";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { getFinancialYear } from "../../../utils/Utils";

/**
 * Builds the API payload for External outward type.
 */
const buildExternalPayload = (formValues, userName, financialYear, formattedDate, office_type, isDDM) => ({
  in_response_uid: formValues?.responseToDigidakId?.value ? [formValues?.responseToDigidakId?.value] : [],
  in_source_vertical: formValues.srcVerticalId?.map?.((i) => i.text) ?? [],
  in_source_vertical_group_name: formValues.srcVerticalId?.map?.((i) => i.value) ?? [],
  in_decision: formValues.sendingBulkLetter ? "excel" : "Outward External",
  in_is_bulk_letter: formValues.sendingBulkLetter ? "true" : "false",
  in_address_of_sender: formValues.recipientAddress || "",
  in_state_of_sender: formValues.stateOfRecipient || "",
  in_file_number: formValues.fileNumber?.value || "",
  in_nature_of_correspondence: formValues.subtype,
  in_mode_of_receipt: formValues.modeOfDispatch,
  in_received_from: formValues.categoryExternal,
  in_is_group: formValues.sendingBulkLetter,
  is_excel: formValues.sendingBulkLetter,
  in_email_id: formValues.recipientEmail,
  in_letter_subject: formValues.subject,
  in_languages: formValues.language,
  in_financial_year: financialYear,
  in_priority: formValues.priority,
  in_secrecy: formValues.secrecy,
  in_office_type: office_type,
  in_due_date: formattedDate,
  in_login_user: userName,

  ...(formValues.sendingBulkLetter && {
    in_excel_final_row_index: 1,
  }),

  ...(isDDM && {
    is_ddm: true,
    in_ddm_vertical: formValues?.toDepartmentId?.text || "",
  }),
});

/**
 * Builds the API payload for Internal outward type.
 */
const buildInternalPayload = (formValues, userName, office_type, financialYear, formattedDate, { subtype, sendEndorsementsData, isDDM }) => {
  const selectedType = formValues?.ro?.value;

  const isDOLetterOrOfficeOrder = subtype === "DO Letter" || subtype === "Office Order";
  const inHoRoTe = selectedType === "Users" || selectedType === "Verticals" ? office_type || "" : selectedType || "";

  let inDraftOfficeType = "";
  let inDraftSelectedRecipients = "";

  if (selectedType === "HO" || selectedType === "RO" || selectedType === "TE") {
    inDraftOfficeType = selectedType;
    const dept = formValues.department || "";
    if (subtype === "DO Letter") {
      const parts = dept.split(",");
      inDraftSelectedRecipients = parts.length > 1 ? parts[1].trim() : dept.trim();
    } else {
      inDraftSelectedRecipients = dept;
    }
  }

  if (selectedType === "DDM") {
    inDraftOfficeType = selectedType;
    inDraftSelectedRecipients = formValues.in_ddm_users?.value || "";
  }

  if (selectedType === "Users") {
    inDraftOfficeType = selectedType;
    inDraftSelectedRecipients = formValues.in_hrmd_users?.value || "";
  }

  if (selectedType === "Verticals") {
    inDraftOfficeType = selectedType;
    inDraftSelectedRecipients = formValues.in_outward_vertical?.value || "";
  }

  return {
    in_draft_selected_recipients: [inDraftSelectedRecipients],
    in_decision: isDOLetterOrOfficeOrder ? "hrmd" : "Outward",

    in_selected_recipients_single: isDOLetterOrOfficeOrder ? "" : formValues.department || "",
    in_hrmd_users: subtype === "DO Letter" || selectedType === "Users" ? [inDraftSelectedRecipients] : [""],

    in_response_uid: formValues?.responseToDigidakId?.value ? [formValues?.responseToDigidakId?.value] : [],
    in_outward_vertical: formValues?.in_outward_vertical?.value ?? formValues?.in_outward_vertical ?? "",
    in_source_vertical: formValues.srcVerticalId?.map?.((i) => i.text) ?? [],
    in_source_vertical_group_name: formValues.srcVerticalId?.map?.((i) => i.value) ?? [],
    in_is_bulk_letter: formValues.sendingBulkLetter ? "true" : "false",
    in_is_office_order: subtype === "Office Order" || subtype === "Office Order - HO/RO/TE" ? true : false,
    in_is_endorse: sendEndorsementsData === "Yes" ? true : false,
    in_address_of_sender: formValues.recipientAddress || "",
    in_state_of_sender: formValues.stateOfRecipient || "",
    in_file_number: formValues.fileNumber?.value || "",
    in_nature_of_correspondence: formValues.subtype,
    in_mode_of_receipt: formValues.modeOfDispatch,
    in_type_category: formValues.taskCategory,
    in_is_group: formValues.sendingBulkLetter,
    in_draft_office_type: [inDraftOfficeType],
    in_letter_subject: formValues.subject,
    in_languages: formValues.language,
    in_priority: formValues.priority,
    in_financial_year: financialYear,
    in_secrecy: formValues.secrecy,
    in_office_type: office_type,
    in_due_date: formattedDate,
    in_login_user: userName,
    in_entry_type: "Internal",
    in_ho_ro_te: [inHoRoTe],
    in_received_from: "",
    in_endorse_uid: "",
    is_endorsed_letter: false,

    ...(isDDM && {
      is_ddm: true,
      in_ddm_vertical: formValues?.toDepartmentId?.text || "",
      in_ddm_vertical_value: formValues?.toDepartmentId?.value || "",
    }),

    in_ddm_users: selectedType === "DDM" ? [formValues?.in_ddm_users?.value || ""] : [""],
  };
};

/**
 * Hook that encapsulates the "Generate Outward Number" flow.
 *
 * @param {Object} params
 * @param {boolean} params.isDDM
 * @param {string} params.userName
 * @param {string} params.office_type
 * @param {string} params.subtype - watched subtype value
 * @param {string} params.sendEndorsementsData - watched sendEndorsements value
 * @param {Array} params.endorsementRows
 * @param {Function} params.getValues - react-hook-form getValues
 * @param {Function} params.setIsGenerated
 * @param {Function} params.setLoader
 * @param {Function} params.setShowDialog
 * @param {Function} params.setProcessedGridData
 * @param {Function} params.setEndorsementGridData
 * @param {Function} params.setGeneratedNumber
 */
export const useOutwardGenerate = ({
  isDDM,
  userName,
  office_type,
  subtype,
  sendEndorsementsData,
  endorsementRows,
  getValues,
  setIsGenerated,
  setLoader,
  setShowDialog,
  setProcessedGridData,
  setEndorsementGridData,
  setGeneratedNumber,
}) => {
  const dispatch = useDispatch();

  const handleGenerate = useCallback(async () => {
    const payloadContext = { subtype, sendEndorsementsData, isDDM };
    const formValues = getValues();
    setIsGenerated(true);

    const formattedDate = formValues.dueDate ? new Date(formValues.dueDate).toISOString() : new Date().toISOString();

    const financialYear = getFinancialYear();

    let endorseUid = "";

    // If endorsement is Yes, call getEndorseSequence before generating
    if (sendEndorsementsData === "Yes" && formValues.type === "Internal") {
      try {
        setLoader(true);
        const endorseResponse = await digidakOutwardService.getEndorseSequence({
          "run-stateless": "true",
        });

        if (endorseResponse?.data?.variables?.seq_no) {
          endorseUid = endorseResponse.data.variables.seq_no;
        }
      } catch (error) {
        console.error(error);
        setLoader(false);
        setIsGenerated(false);
        return;
      } finally {
        setLoader(false);
      }
    }

    let formData =
      formValues.type === "External"
        ? buildExternalPayload(formValues, userName, financialYear, formattedDate, office_type, isDDM)
        : buildInternalPayload(formValues, userName, office_type, financialYear, formattedDate, payloadContext);

    if (formValues.sendingBulkLetter && formValues.type !== "External") {
      const mappedDepartments = formValues?.departments?.map((item) => (item?.value ? item.value : item));

      formData = {
        ...formData,
        in_decision: subtype === "Office Order" ? "hrmd bulk" : "Outward Bulk",
        in_ho_ro_te: formValues.ros,
        in_draft_office_type: formValues.ros,
        in_selected_recipients_multi: mappedDepartments,
        in_draft_selected_recipients: mappedDepartments,
      };
    }

    // Add endorseUid to main formData if endorsement is enabled
    if (sendEndorsementsData === "Yes" && formValues.type === "Internal") {
      formData = { ...formData, in_endorse_uid: endorseUid };
    }

    // 1. Generate main outward
    const result = await dispatch(createDigidakOutward(formData));

    const data = result.payload.data.packages.digidak_folder.href;
    const objectId = data.substring(data.lastIndexOf("/") + 1);

    if (createDigidakOutward.fulfilled.match(result)) {
      setLoader(true);
      setShowDialog(false);

      // First call: always by objectId
      const firstResponse = await digidakInwardService.getDigidakInwardGridData({
        input_object_id: objectId,
        "items-per-page": 300,
      });

      const firstEntry = firstResponse?.entries?.[0]?.content?.properties || {};
      const groupUid = formValues.sendingBulkLetter ? (subtype === "Office Order" ? firstEntry?.group_uid : (firstEntry?.uid_number ?? null)) : null;
      const isExternalExcel = formValues.type === "External" && formValues.sendingBulkLetter && firstEntry?.is_external_excel === true;
      const excelSequenceId = isExternalExcel ? firstEntry?.uid_number : null;

      let finalResponse = firstResponse;

      // Second call decision
      if (formValues.sendingBulkLetter) {
        if (isExternalExcel && excelSequenceId) {
          finalResponse = await digidakInwardService.getDigidakInwardGridData({
            input_excel_sequence_id: excelSequenceId,
            input_group_uid: undefined,
            input_object_id: undefined,
            "items-per-page": 300,
          });
        } else if (groupUid) {
          finalResponse = await digidakInwardService.getDigidakInwardGridData({
            input_group_uid: groupUid,
            input_object_id: undefined,
            "items-per-page": 300,
          });
        }
      }

      let aggregatedEntries = finalResponse?.entries || [];
      const entriesBeforeEndorsements = aggregatedEntries.length;

      // 2. If endorsements are enabled, generate additional outwards per grid row
      if (formValues.type === "Internal" && sendEndorsementsData === "Yes" && endorsementRows.length > 0) {
        for (const row of endorsementRows) {
          if (!row.type_category || !row.login_office_type || !row.selected_region) continue;

          const endorsementFormValues = {
            ...formValues,
            taskCategory: row.type_category || formValues.taskCategory,
            ro: { value: row.login_office_type, text: row.login_office_type },
            department: row.selected_region,
            sendingBulkLetter: false,
          };

          let endorsementPayload = buildInternalPayload(endorsementFormValues, userName, office_type, financialYear, formattedDate, payloadContext);

          endorsementPayload = {
            ...endorsementPayload,
            in_endorse_uid: endorseUid,
            is_endorsed_letter: true,
            in_selected_recipients_single: endorsementFormValues.department,
            in_decision: endorsementFormValues.sendingBulkLetter ? "Outward Bulk" : "Outward",
          };

          try {
            const result = await dispatch(createDigidakOutward(endorsementPayload));

            const data = result.payload.data.packages.digidak_folder.href;
            const objectId = data.substring(data.lastIndexOf("/") + 1);

            const endorseResponse = await digidakInwardService.getDigidakInwardGridData({
              input_object_id: objectId,
              "items-per-page": 300,
            });

            if (endorseResponse?.entries?.length) {
              aggregatedEntries = [...aggregatedEntries, ...endorseResponse.entries];
            }
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        setLoader(false);
        setProcessedGridData(finalResponse?.entries);
      }

      // Update grid with all generated entries (main + bulk + endorsements)
      setProcessedGridData(aggregatedEntries);

      // Extract ONLY endorsement entries (exclude main + bulk)
      if (formValues.type === "Internal" && sendEndorsementsData === "Yes" && aggregatedEntries.length > entriesBeforeEndorsements) {
        const endorsementEntries = aggregatedEntries.slice(entriesBeforeEndorsements);
        setEndorsementGridData(endorsementEntries);
      } else {
        setEndorsementGridData([]);
      }

      setGeneratedNumber({
        objectId: firstEntry?.id,
        uidNumber: firstEntry?.uid_number,
        folderPath: firstEntry?.r_folder_path?.[0],
        iFolderId: firstEntry?.i_folder_id?.[0] || "",
      });

      setLoader(false);
      setShowDialog(false);
    }
  }, [dispatch, getValues, userName, office_type, subtype, sendEndorsementsData, isDDM, endorsementRows, setIsGenerated, setLoader, setShowDialog, setProcessedGridData, setEndorsementGridData, setGeneratedNumber]);

  return { handleGenerate };
};
