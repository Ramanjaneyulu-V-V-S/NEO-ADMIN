import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { dashboardService } from "../services/dashboard/dashboardService";
import { digidakOutboxService } from "../services/digidak/outbox/digidakOutboxService";
import { formatDate, formatEndOfDay, fromAndToDateFormat } from "../utils/Utils";
import { useDigidakGroups } from "./useDigidakGroups";
import { setDashboardDeptNames } from "../redux/digidak/inbox/digidakInboxSlice";
import { DMD_DESIGNATION } from "../pages/data/DropdownData";

export const useDigidakDashboardData = (fromDate, toDate, options = { autoFetch: false, enabled: true }) => {
  // -------------------- Redux --------------------
  const dispatch = useDispatch();
  const { userProfile, isCGMUser } = useSelector((state) => state.login);

  const { object_name, office_type, department_short_code, department_name, ro_short_code } = userProfile?.properties || {};

  // -------------------- Roles --------------------
  const { isDMDChairman } = useSelector((state) => state.digidakInbox);
  const isChairmanUser = isDMDChairman && !DMD_DESIGNATION.includes(department_name);
  const isDMDUser = isDMDChairman && DMD_DESIGNATION.includes(department_name);

  // -------------------- Groups (Redux Cached) --------------------
  const groupsArray = useDigidakGroups(object_name);

  const backendGroups = useMemo(() => groupsArray.filter((name) => name !== object_name), [groupsArray, object_name]);

  const [dashboardCounts, setDashboardCounts] = useState({});
  const [dashboardGridData, setDashboardGridData] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchInProgressRef = useRef(false);

  // -------------------- Category Filter --------------------
  const categories = useMemo(
    () => [
      { text: "ALL NABARD", value: "ALL NABARD" },
      { text: "ALL HO", value: "ALL HO" },
      { text: "ALL RO", value: "ALL RO" },
      ...(department_name !== "DMD S2" ? [{ text: "ALL TE", value: "ALL TE" }] : []),
      { text: "HO", value: "HO" },
      { text: "RO", value: "RO" },
      ...(department_name !== "DMD S2" ? [{ text: "TE", value: "TE" }] : []),
    ],
    [department_name],
  );

  const [selectedCategory, setSelectedCategory] = useState(
    options.initialCategory ||
      categories.find((cat) => cat.text === "ALL NABARD") ||
      categories.find((cat) => cat.text === `ALL ${office_type}`) ||
      categories.find((cat) => cat.text === office_type) ||
      categories[0],
  );

  // -------------------- Recipient Filter --------------------
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientValue, setSelectedRecipientValue] = useState(options.initialRecipient ?? null);

  // -------------------- Fetch Recipients (Dept / Region based) --------------------
  useEffect(() => {
    if (!options?.enabled) return;
    const fetchRecipients = async () => {
      try {
        const dmdOfficeType = `${department_name}${selectedCategory?.text}`.replace(/\s+/g, "");

        const response = await digidakOutboxService.getGroups({
          "run-stateless": "true",
          data: {
            variables: {
              flag: "dept_location",
              in_office_type: isChairmanUser ? selectedCategory?.value : dmdOfficeType,
              in_login_user: object_name,
            },
          },
        });

        const variables = response?.data?.variables || {};
        const displayNames = variables.group_display_name || [];
        const names = variables.group_names || [];

        const options = displayNames
          .map((text, idx) => ({
            text: text || names[idx],
            value: names[idx],
          }))
          .filter((opt) => opt.text && opt.value);

        setRecipients(options);
      } catch (err) {
        console.error(err);
        setRecipients([]);
        setSelectedRecipientValue(null);
      }
    };

    if (object_name && selectedCategory?.value && !selectedCategory.value.startsWith("ALL")) {
      fetchRecipients();
    } else if (selectedCategory?.value?.startsWith("ALL")) {
      setRecipients([]);
      setSelectedRecipientValue(null);
    }
  }, [object_name, department_name, isChairmanUser, selectedCategory?.text, selectedCategory?.value, options?.enabled]);

  // -------------------- Unified Fetch --------------------
  const triggerUnifiedFetch = useCallback(async () => {
    if (!object_name) return;
    if (fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;
    setLoading(true);
    try {
      const effectiveToDate = toDate || new Date();
      const nextDayDate = new Date(effectiveToDate);
      nextDayDate.setDate(nextDayDate.getDate() + 1);

      const pendingDate = new Date(effectiveToDate);
      pendingDate.setMonth(pendingDate.getMonth() - 1); // 1 month prior

      const isAllCategory = selectedCategory?.text?.startsWith("ALL");
      let payloadVariables = {
        fromdate: formatDate(fromDate || new Date("2025-01-01")),
        todate: formatDate(nextDayDate), // The backend expects this way only
        pendingdate: formatDate(pendingDate),
        in_from_date: fromAndToDateFormat(fromDate || new Date("2025-11-01")),
        in_to_date: formatEndOfDay(toDate || new Date()),
      };

      if (isAllCategory) {
        // ALL Selection Payload
        let officeType;

        if (selectedCategory.text === "ALL NABARD") {
          officeType = ["HO", "RO", "TE"];

          if (department_name === "DMD S2") {
            officeType = ["HO", "RO"];
          }

          if (isDMDUser) {
            const dmdPrefix = department_name.replace(/\s+/g, "");
            officeType = officeType.map((type) => `${dmdPrefix}${type}`);
          }
        } else {
          officeType = selectedCategory.text.replace("ALL ", "");
          if (isDMDUser) {
            const dmdPrefix = department_name.replace(/\s+/g, "");
            officeType = `${dmdPrefix}${officeType}`;
          }
          officeType = [officeType];
        }

        payloadVariables = {
          ...payloadVariables,
          in_login_cgm_group: "",
          in_selected_region: "",
          inp_office_type: officeType,
          in_source_vertical: [""],
          in_workflow_groups: [""],
        };
      } else {
        // Normal Selection Payload
        const cgmGroupName =
          office_type === "HO"
            ? `ecm_digidak_${office_type.toLowerCase()}_${department_short_code?.toLowerCase()}_cgm`
            : `ecm_digidak_${office_type.toLowerCase()}_${ro_short_code?.toLowerCase()}_cgm`;

        const chairmanGroupName = `ecm_digidak_${selectedCategory?.text?.toLowerCase()}_${(selectedRecipientValue?.value || department_short_code)?.toLowerCase()}_cgm`;

        payloadVariables = {
          ...payloadVariables,
          in_workflow_groups: isChairmanUser || isDMDUser ? [""] : backendGroups,
          in_source_vertical: isCGMUser || isChairmanUser || isDMDUser ? [""] : backendGroups,
          inp_office_type: [selectedCategory?.text],
          in_selected_region: selectedRecipientValue?.text || "",

          ...(isCGMUser && { in_login_cgm_group: cgmGroupName }),
          ...((isChairmanUser || isDMDUser) && {
            in_login_cgm_group: chairmanGroupName,
          }),
        };
      }

      const payload = {
        "run-stateless": "true",
        data: {
          variables: payloadVariables,
        },
      };

      const response = await dashboardService.getDigidakDashboardGridData(payload);

      if (response?.data?.variables) {
        setDashboardCounts(response.data.variables);
        setDashboardGridData(response.data.variables);
        dispatch(setDashboardDeptNames(response.data.variables?.out_dashboard_dept_names || []));
      } else {
        setDashboardCounts({});
        setDashboardGridData({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [
    object_name,
    toDate,
    selectedCategory.text,
    fromDate,
    department_name,
    isDMDUser,
    office_type,
    department_short_code,
    ro_short_code,
    selectedRecipientValue?.value,
    selectedRecipientValue?.text,
    isChairmanUser,
    backendGroups,
    isCGMUser,
    dispatch,
  ]);

  // -------------------- Auto Fetch on Filter Change --------------------
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!options?.enabled) return;
    if (!object_name || !selectedCategory) return;

    // Always fetch on initial load to get initial counts
    if (isInitialLoadRef.current) {
      triggerUnifiedFetch();
      isInitialLoadRef.current = false;
      return;
    }

    if (options?.autoFetch) {
      triggerUnifiedFetch();
    }
  }, [object_name, selectedCategory, selectedRecipientValue, triggerUnifiedFetch, options?.autoFetch, options?.enabled]);

  // -------------------- Reset Logic --------------------
  const resetFilters = useCallback(() => {
    const defaultCategory =
      categories.find((cat) => cat.text === "ALL NABARD") ||
      categories.find((cat) => cat.text === `ALL ${office_type}`) ||
      categories.find((cat) => cat.text === office_type) ||
      categories[0];

    // Reset Category to default based on office_type
    setSelectedCategory(defaultCategory);
    // Reset Recipient
    setSelectedRecipientValue(null);

    // Clear Data
    setDashboardCounts({});
    setDashboardGridData({});

    // allow initial fetch again
    isInitialLoadRef.current = true;
  }, [categories, office_type]);

  // -------------------- Exports --------------------
  return {
    // data
    dashboardCounts,
    dashboardGridData,
    loading,

    // actions
    triggerUnifiedFetch,

    // filters
    categories,
    selectedCategory,
    setSelectedCategory,

    recipients,
    selectedRecipientValue,
    setSelectedRecipientValue,

    // role flags
    isChairmanUser,
    isDMDUser,
    isCGMUser,
    resetFilters,
  };
};
