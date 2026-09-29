import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { provideDigidakPermission } from "../../../redux/digidak/outward/digidakOutwardSlice";
import { fetchDigidakGroups as fetchDigidakGroupsOutward } from "../../../redux/digidak/inward/digidakInwardSlice";

/**
 * Handles the "Send" submission flow for OutwardEntry.
 *
 * @param {Object} params
 * @param {boolean} params.isDDM
 * @param {Function} params.watch - react-hook-form watch
 * @param {Function} params.getValues - react-hook-form getValues
 * @param {Array} params.mappedData - processed grid rows
 * @param {Object} params.generatedNumber - { objectId, uidNumber, ... }
 * @param {Array} params.endorsementGridData
 * @param {Object} params.userProfile
 * @param {Function} params.setLoader
 */
export const useOutwardSubmit = ({ isDDM, watch, getValues, mappedData, generatedNumber, endorsementGridData, userProfile, setLoader }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const sendSingleOutward = useCallback(
    async (folderId, formValues, loginUser, endorsementGridDataParam) => {
      const isExternal = formValues.type === "External";

      const isSubTypeTrue = watch("subtype");
      const isBulk = watch("sendingBulkLetter");
      const selectedType = formValues?.ro?.value;
      const selectedTypes = formValues?.ros || [];
      const isAllDDMSelected = selectedTypes?.includes("All DDM");

      const dept = formValues.department || "";
      const parts = dept.split(",");
      const departmentsAfterComma = parts.length > 1 ? parts[1].trim() : dept.trim();

      const dispatchPermission = (permFolderId, payload) =>
        dispatch(provideDigidakPermission({ folderId: permFolderId, payload }));

      // --- External ---
      if (isExternal) {
        const normalPayload = {
          in_flag: "Closed",
          in_login_user: loginUser,
          in_all_uids: formValues?.responseToDigidakId?.value ? [formValues.responseToDigidakId.value] : [],
          is_excel: formValues.sendingBulkLetter,
          ...(isDDM && { is_ddm: true }),
          ...(!isDDM && {
            in_src_verticals: formValues.srcVerticalId?.map((v) => v.value) || [],
          }),
        };

        return await dispatchPermission(folderId, normalPayload);
      }

      // --- DDM ---
      if (isDDM) {
        const groupName = formValues?.toDepartmentId?.value;
        if (!groupName) throw new Error("DDM department group mapping not found.");

        const groupRes = await dispatch(
          fetchDigidakGroupsOutward({ loginUser, groupName, flag: "inwardvertical" }),
        );
        const groupVars = groupRes?.payload?.data?.variables;
        if (!groupVars) throw new Error("Failed to fetch DDM group details.");

        const verticalHeadDisplay = groupVars.group_display_name?.[0] || "";
        const verticalHeadGroupName = groupVars.group_names?.[0] || "";
        if (!verticalHeadDisplay || !verticalHeadGroupName) throw new Error("DDM group mapping not found.");

        return await dispatchPermission(folderId, {
          in_flag: "Assigned Head",
          in_vertical_head_display_name: verticalHeadDisplay,
          in_vertical_head_group_name: verticalHeadGroupName,
          in_login_user: loginUser,
          in_all_uids: formValues?.responseToDigidakId?.value ? [formValues.responseToDigidakId.value] : [],
        });
      }

      // --- Verticals ---
      if (selectedType === "Verticals") {
        const groupName = formValues?.in_outward_vertical?.value || "";
        if (!groupName) throw new Error("Vertical group not selected.");

        const groupRes = await dispatch(
          fetchDigidakGroupsOutward({ loginUser, groupName, flag: "inwardvertical" }),
        );
        const groupVars = groupRes?.payload?.data?.variables;
        if (!groupVars) throw new Error("Failed to fetch vertical group details.");

        const verticalHeadDisplay = groupVars.group_display_name?.[0] || "";
        const verticalHeadGroupName = groupVars.group_names?.[0] || "";
        if (!verticalHeadDisplay || !verticalHeadGroupName) throw new Error("Vertical Head group mapping not found.");

        return await dispatchPermission(folderId, {
          in_flag: "Assigned Head",
          in_vertical_head_display_name: verticalHeadDisplay,
          in_vertical_head_group_name: verticalHeadGroupName,
          in_login_user: loginUser,
        });
      }

      // --- DDM users / All DDM ---
      if (selectedType === "DDM" || isAllDDMSelected) {
        return await dispatchPermission(folderId, {
          in_flag: "Assigned",
          in_is_group: formValues.sendingBulkLetter,
          in_all_uids: formValues?.responseToDigidakId?.value ? [formValues.responseToDigidakId.value] : [],
          in_src_verticals: formValues.srcVerticalId?.map((v) => v.value) || [],
          in_vertical_users: [formValues.in_ddm_users?.value || ""],
          in_login_user: loginUser,
        });
      }

      // --- DO Letter ---
      if (isSubTypeTrue === "DO Letter") {
        return await dispatchPermission(folderId, {
          in_flag: "Assigned",
          is_hrmd_flow: true,
          in_vertical_users: [departmentsAfterComma],
          in_login_user: loginUser,
        });
      }

      // --- Office Order ---
      if (isSubTypeTrue === "Office Order") {
        return await handleOfficeOrderSubmit({
          folderId,
          formValues,
          loginUser,
          endorsementGridDataParam,
          isBulk,
          mappedData,
          dispatchPermission,
        });
      }

      // --- Default Internal (not Office Order) ---
      return await handleDefaultInternalSubmit({
        folderId,
        formValues,
        endorsementGridDataParam,
        isBulk,
        mappedData,
        dispatchPermission,
      });
    },
    [dispatch, mappedData, isDDM, watch],
  );

  const onSubmit = useCallback(async () => {
    try {
      setLoader(true);

      if (!generatedNumber?.objectId) return;

      const formValues = getValues();
      const loginUser = userProfile?.properties?.object_name;

      const folderId = generatedNumber.objectId;
      const response = await sendSingleOutward(folderId, formValues, loginUser, endorsementGridData);

      if (response?.payload?.name === "process") {
        navigate("/digidak-outbox");
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Unexpected error occurred.",
      });
    } finally {
      setLoader(false);
    }
  }, [sendSingleOutward, generatedNumber, getValues, userProfile, endorsementGridData, setLoader, navigate]);

  return { onSubmit };
};

// --- Helpers (not exported — internal to this module) ---

async function sendEndorsementPermissions({ endorsementGridDataParam, formValues, dispatchPermission }) {
  let lastResponse;
  for (const item of endorsementGridDataParam) {
    const props = item?.content?.properties ?? {};
    lastResponse = await dispatchPermission(props.id, {
      in_flag: "Unread",
      in_is_group: false,
      in_all_uids: [],
      in_src_verticals: formValues.srcVerticalId?.map((v) => v.value) || [],
    });
  }
  return lastResponse;
}

async function handleOfficeOrderSubmit({ folderId, formValues, loginUser, endorsementGridDataParam, isBulk, mappedData, dispatchPermission }) {
  if (endorsementGridDataParam.length > 0) {
    let lastResponse;

    if (!isBulk) {
      lastResponse = await dispatchPermission(folderId, {
        in_flag: "Assigned",
        is_hrmd_flow: true,
        in_vertical_users: [formValues.in_hrmd_users?.value],
        in_login_user: loginUser,
      });
    } else {
      const endorsementIds = new Set(endorsementGridDataParam.map((e) => e?.content?.properties?.id));
      const bulkOnlyData = mappedData.filter((item) => !endorsementIds.has(item.id));
      for (const item of bulkOnlyData) {
        lastResponse = await dispatchPermission(item.id, {
          in_flag: "Assigned",
          is_hrmd_flow: true,
          is_hrmd_bulk: true,
          in_vertical_users: [item.hrmd_users],
          in_login_user: loginUser,
        });
      }
    }

    lastResponse = await sendEndorsementPermissions({ endorsementGridDataParam, formValues, dispatchPermission });
    return lastResponse;
  }

  // No endorsements
  if (!isBulk) {
    return await dispatchPermission(folderId, {
      in_flag: "Assigned",
      is_hrmd_flow: true,
      in_vertical_users: [formValues.in_hrmd_users?.value],
      in_login_user: loginUser,
    });
  }

  let lastResponse;
  for (const item of mappedData) {
    lastResponse = await dispatchPermission(item.id, {
      in_flag: "Assigned",
      is_hrmd_flow: true,
      is_hrmd_bulk: true,
      in_vertical_users: [item.hrmd_users],
      in_login_user: loginUser,
    });
  }
  return lastResponse;
}

async function handleDefaultInternalSubmit({ folderId, formValues, endorsementGridDataParam, isBulk, mappedData, dispatchPermission }) {
  const basePayload = {
    in_flag: "Unread",
    in_is_group: formValues.sendingBulkLetter,
    in_all_uids: formValues?.responseToDigidakId?.value ? [formValues.responseToDigidakId.value] : [],
    in_src_verticals: formValues.srcVerticalId?.map((v) => v.value) || [],
  };

  if (endorsementGridDataParam.length > 0) {
    let lastResponse;

    const targetFolderId = isBulk ? mappedData?.[0]?.i_folder_id : folderId;
    lastResponse = await dispatchPermission(targetFolderId, basePayload);
    lastResponse = await sendEndorsementPermissions({ endorsementGridDataParam, formValues, dispatchPermission });
    return lastResponse;
  }

  // No endorsements
  const targetFolderId = isBulk ? mappedData?.[0]?.i_folder_id : folderId;
  return await dispatchPermission(targetFolderId, basePayload);
}
