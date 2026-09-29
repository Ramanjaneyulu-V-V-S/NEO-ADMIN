/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { mapCopiedDataToOutwardForm } from "./outwardFormMapper";
import { mapResponseToLetterFields } from "./responseToLetterMapper";
import { digidakDraftService } from "../../../services/digidak/draft/digidakDraftService";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { getSecureRandomNumber } from "../../../utils/Utils";

/**
 * Handles all draft/copy/response prefill logic for OutwardEntry.
 *
 * @param {Object} params
 * @param {Object} params.copiedData - location.state?.copiedData
 * @param {Object} params.responseToLetterData - location.state?.responseToLetterData
 * @param {boolean} params.isResponseFlow
 * @param {Array} params.inboxList
 * @param {Object} params.dropdownData
 * @param {Array} params.sourceVerticalData
 * @param {Function} params.reset - react-hook-form reset
 * @param {Function} params.setSelectedFileNumber
 * @param {Function} params.setSelectedResponseId
 * @param {Function} params.setLoader
 * @param {Function} params.setProcessedGridData
 * @param {Function} params.setEndorsementGridData
 * @param {Function} params.setEndorsementRows
 * @param {Function} params.setEndorsementDocuments
 * @param {Function} params.setDocumentList
 * @param {Function} params.setGeneratedNumber
 * @param {Function} params.setIsGenerated
 */
export const useOutwardPrefill = ({
  copiedData,
  responseToLetterData,
  isResponseFlow,
  inboxList,
  dropdownData,
  sourceVerticalData,
  reset,
  setSelectedFileNumber,
  setSelectedResponseId,
  setLoader,
  setProcessedGridData,
  setEndorsementGridData,
  setEndorsementRows,
  setEndorsementDocuments,
  setDocumentList,
  setGeneratedNumber,
  setIsGenerated,
}) => {
  const [newValue, setNewValue] = useState(null);
  const [responsePrefilled, setResponsePrefilled] = useState(false);

  // Response to letter flow prefill
  useEffect(() => {
    if (!isResponseFlow || !responseToLetterData) return;
    const responseUid = responseToLetterData?.digidak_uid;
    const matched = inboxList?.find((item) => {
      const props = item?.content ? item.content.properties : item;
      return props?.uid_number === responseUid;
    });
    if (!matched) return;
    const matchedProps = matched?.content ? matched.content.properties : matched;
    const mapped = mapResponseToLetterFields(matchedProps, dropdownData);

    reset((prev) => ({
      ...prev,
      ...mapped,
    }));

    setSelectedResponseId(mapped.responseToDigidakId);
    setResponsePrefilled(true);
  }, [isResponseFlow, responseToLetterData, inboxList, dropdownData]);

  // Prefill form from copied data
  useEffect(() => {
    if (!copiedData) return;

    const mappedData = mapCopiedDataToOutwardForm(copiedData, sourceVerticalData);

    if (copiedData?.is_endorsed === true || newValue) {
      mappedData.sendEndorsements = "Yes";
    } else {
      mappedData.sendEndorsements = "No";
    }

    reset(mappedData);

    if (mappedData.fileNumber) {
      setSelectedFileNumber(mappedData.fileNumber);
    }

    if (mappedData.responseToDigidakId) {
      setSelectedResponseId(mappedData.responseToDigidakId);
    }
  }, [copiedData, reset, sourceVerticalData, newValue]);

  // Fetch endorse_uid when coming from draft
  useEffect(() => {
    const folderId = copiedData?.group_uid ? copiedData?.i_folder_id?.[0] : copiedData?.id;

    if (!folderId) return;

    const fetchFolderData = async () => {
      try {
        const response = await digidakDraftService.getDigidakOneFolder(folderId);
        setNewValue(response?.properties?.endorse_uid);
      } catch (error) {
        console.error(error);
      }
    };

    fetchFolderData();
  }, [copiedData]);

  // Fetch endorsement data when coming from draft
  useEffect(() => {
    if (!newValue) return;

    const fetchEndorsementData = async () => {
      try {
        setLoader(true);

        const response = await digidakInwardService.getDigidakInwardGridData({
          input_endorse_uid: newValue ? newValue : copiedData?.endorse_uid,
          "items-per-page": 300,
        });

        const mainLetterUid = copiedData?.uid_number;

        const filter = (response?.entries || []).filter((item) => {
          const props = item?.content?.properties ?? {};
          return props.uid_number !== mainLetterUid;
        });

        const filteredEndorsementEntries = (filter || []).filter((item) => {
          const objectName = item?.content?.properties?.object_name || "";
          const groupUid = item?.content?.properties?.group_uid || "";

          return !objectName.startsWith("G") && !groupUid.startsWith("G");
        });

        setEndorsementGridData(filteredEndorsementEntries);
        setProcessedGridData((prev) => [...prev, ...filteredEndorsementEntries]);

        const mappedEndorsementRows = filteredEndorsementEntries.map((item, index) => {
          const props = item?.content?.properties ?? {};

          return {
            id: Date.now() + getSecureRandomNumber() + index,
            type: "Internal",
            type_category: props.type_category || "",
            login_office_type: props.login_office_type || "",
            selected_region: props.selected_region || "",
            isInitial: false,
          };
        });

        if (mappedEndorsementRows.length > 0) {
          setEndorsementRows(mappedEndorsementRows);
        }

        // Fetch documents for each endorsement entry when coming from draft screen
        if (copiedData?.fromProps === "draft-screen" && filteredEndorsementEntries.length > 0) {
          const documentsMap = {};

          for (const entry of filteredEndorsementEntries) {
            const objectId = entry?.content?.properties?.id;
            if (!objectId) continue;

            try {
              const documentsResponse = await digidakInwardService.getInwardDocuments({
                input_parent_folders: objectId,
              });

              documentsMap[objectId] = documentsResponse?.entries || [];
            } catch (error) {
              console.error(error);
              documentsMap[objectId] = [];
            }
          }

          setEndorsementDocuments(documentsMap);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoader(false);
      }
    };

    fetchEndorsementData();
  }, [newValue]);

  // Fetch grid data and documents when coming from draft
  useEffect(() => {
    if (!copiedData?.id) return;

    const isFromGroupUID = copiedData?.navigationSource === "GROUP_UID";
    const groupUid = copiedData?.group_uid;
    const objectId = copiedData?.id;

    const outwardSourceId = isFromGroupUID ? groupUid : objectId;
    const objectIdToUse = isFromGroupUID && groupUid && copiedData?.i_folder_id?.length > 0 ? copiedData?.i_folder_id[0] : objectId;

    if (!outwardSourceId) return;

    const fetchDigidakInwardGridData = async () => {
      try {
        setLoader(true);

        let response;

        if (isFromGroupUID && groupUid) {
          response = await digidakInwardService.getDigidakInwardGridData({
            input_group_uid: groupUid,
            "items-per-page": 300,
          });
        } else {
          response = await digidakInwardService.getDigidakInwardGridData({
            input_object_id: objectId,
            "items-per-page": 300,
          });
        }
        setProcessedGridData((prev) => [...prev, ...(response?.entries || [])]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoader(false);
      }
    };

    const fetchInwardDocuments = async () => {
      try {
        const isBulk = copiedData?.sending_bulk_letter === true || copiedData?.group_uid;
        const hasGroupUID = !!groupUid;

        const parentFolderToUse = isBulk && hasGroupUID && copiedData?.i_folder_id?.length > 0 ? copiedData?.i_folder_id[0] : objectId;

        if (!parentFolderToUse) return;

        const response = await digidakInwardService.getInwardDocuments({
          input_parent_folders: parentFolderToUse,
        });

        setDocumentList(response?.entries);
      } catch (error) {
        console.error(error);
      }
    };

    if (copiedData?.fromProps == "draft-screen") {
      fetchDigidakInwardGridData();
      fetchInwardDocuments();
    }

    if (copiedData?.id || copiedData?.uid_number || copiedData?.r_folder_path) {
      const baseFolderPath = copiedData?.r_folder_path?.[0]?.split("/").slice(0, 3).join("/");
      setGeneratedNumber((prev) => ({
        ...prev,
        objectId: objectIdToUse,
        uidNumber: copiedData?.uid_number || "",
        folderPath: copiedData?.group_uid ? baseFolderPath : copiedData?.r_folder_path?.[0] || "",
        iFolderId: copiedData?.i_folder_id?.[0] || "",
      }));
    }

    if (copiedData?.uid_number) {
      setIsGenerated(true);
    }
  }, [copiedData]);

  return { responsePrefilled, setResponsePrefilled };
};
