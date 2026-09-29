import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

//component
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

//react form hook
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller, useWatch } from "react-hook-form";

//kendo react
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

//react icons
import { RiResetLeftLine } from "react-icons/ri";
import { IoArrowBack } from "react-icons/io5";

// sweet alert
import Swal from "sweetalert2";

// utils
import { formatDateTimeParam } from "../../../utils/Utils";
import { mapInboxEntry } from "./digidakInboxUtils";
import DigidakInboxActionCell from "./DigidakInboxActionCell";

import { useDispatch, useSelector } from "react-redux";
import { useDDMContext } from "../../../hooks/useDDMContext";
import { useDigidakGroups } from "../../../hooks/useDigidakGroups";
import DigidakExportButton from "../../../components/digidak/DigidakExportButton";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import { fetchDigidakInboxV2, fetchDigidakLetterbox, DEFAULT_PAGE_SIZE, resetDigidakInboxPagination } from "../../../redux/digidak/inbox/digidakInboxSlice";
import { dashboardService } from "../../../services/dashboard/dashboardService";
import { digidakStatusOptions, digidakCategoryOptions, caseLanguageOptions, natureOfCaseOptions } from "../../data/DropdownData";

const endorsedFilterOptions = ["Endorsement", "Main Letter"];

const INBOX_FILTER_FIELD_MAP = {
  digidak_uid: "uid_number",
  subject: "subject",
  date: "completion_date",
  due_date: "due_date",
  inward_ref_date: "inward_ref_number",
  from: ["received_from", "login_region"],
  status: "inp_status",
  category: "type_category",
  language: "languages",
  is_endorsed_letter: "is_endorsed_letter",
  vertical_head_display_name: "vertical_head_display_name",
  secrecy: "secrecy",
  assign_to: "vertical_users",
  initiator: "initiator",
};

const LETTERBOX_FILTER_FIELD_MAP = {
  digidak_uid: "input_uid_number__",
  subject: "input_letter_subject",
  due_date: "input_due_date",
  status: "input_status",
  category: "input_type_category",
  language: "input_languages",
  is_endorsed_letter: "input_is_endorsed_letter",
  secrecy: "input_secrecy",
  assign_to: "input_vertical_users",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["digidak_uid", "subject", "inward_ref_date", "from", "initiator", "vertical_head_display_name"]);
const DATE_FILTER_FIELDS = new Set(["date", "due_date"]);

// Strip column-filter API keys from a payload so they can be replaced
const ALL_FILTER_API_KEYS = new Set([...Object.values(INBOX_FILTER_FIELD_MAP).flat(), ...Object.values(LETTERBOX_FILTER_FIELD_MAP).flat()]);
const stripFilterParams = (payload) => {
  if (!payload) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !ALL_FILTER_API_KEYS.has(key)));
};

const defaultValues = {
  digidakUID: "",
  subject: "",
  fromDate: null,
  toDate: null,
  assignTo: "",
  status: "",
  category: "",
  from: "",
  language: "",
};

export default function DigidakInbox() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const excelExportRef = useRef(null);
  const filterDebounceRef = useRef(null);
  const skipNextInitialFetchRef = useRef(false);
  const pathNameUrl = location?.pathname;

  const { tabName, pieChartData, dashboardParams, fromDate: initialFromDate, toDate: initialToDate, fromViewCase: fromViewCaseNavigation } = location.state || {};
  const { isDDM } = useDDMContext(); // DDM Context
  const { isDMDChairman, groups, inboxList, loading, pagination } = useSelector((state) => state.digidakInbox);

  const { userProfile } = useSelector((state) => state.login);
  const { object_name } = userProfile?.properties || {};

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      ...defaultValues,
      fromDate: initialFromDate || null,
      toDate: initialToDate || null,
    },
  });
  const [hasSearched, setHasSearched] = useState(false);
  const { fromDate, toDate } = useWatch({ control });
  const [popups, setPopups] = useState({ movementRegister: false });
  const [movementRegisterData, setMovementRegisterData] = useState([]);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [lastFetchPayload, setLastFetchPayload] = useState(null);
  const [filterSearchParams, setFilterSearchParams] = useState(null);

  const DASHBOARD_PAGE_SIZE = DEFAULT_PAGE_SIZE;
  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "dec" }],
    skip: 0,
    take: dashboardParams ? DASHBOARD_PAGE_SIZE : DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const getStorageKey = () => `digidakInboxState_${pathNameUrl}_${object_name}`;
  const clearStateFromStorage = () => localStorage.removeItem(getStorageKey());

  // Ref always holds latest state — avoids stale closure in handleViewDigidak useCallback
  const currentStateRef = useRef({});
  currentStateRef.current = { dataState, filterSearchParams, currentPage, lastFetchPayload, formFromDate: fromDate, formToDate: toDate };

  const saveStateToStorage = () => {
    const state = currentStateRef.current;
    localStorage.setItem(getStorageKey(), JSON.stringify({ ...state, fromViewCase: true, timestamp: Date.now() }));
  };

  const [usePieChartData] = useState(!!pieChartData);
  const isDashboardNavigation = !!dashboardParams;
  const [dashboardData, setDashboardData] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardPagination, setDashboardPagination] = useState({ total: 0, page: 1, itemsPerPage: DEFAULT_PAGE_SIZE });
  const [localFilterDates, setLocalFilterDates] = useState({
    from: initialFromDate || null,
    to: initialToDate || null,
  });

  const isLoading = isDashboardNavigation ? dashboardLoading : loading;

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const fetchDashboardData = useCallback(
    async (page = 1) => {
      if (!dashboardParams) return;
      try {
        setDashboardLoading(true);
        const res = await dashboardService.getDashboardBarClickDataInboxOutboxV2({
          ...dashboardParams,
          page,
          itemsPerPage: DASHBOARD_PAGE_SIZE,
        });
        setDashboardData(res?.entries || []);
        setDashboardPagination({ total: res?.total || 0, page: res?.page || 1, itemsPerPage: res?.itemsPerPage || DEFAULT_PAGE_SIZE });
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setDashboardLoading(false);
      }
    },
    [dashboardParams],
  );

  const FILTER_FIELD_MAP = pathNameUrl === "/digidak-letterbox" ? LETTERBOX_FILTER_FIELD_MAP : INBOX_FILTER_FIELD_MAP;

  const buildActiveFilters = useCallback(
    (filter) => {
      if (!filter?.filters) return null;
      const result = {};
      filter.filters.forEach((f) => {
        const apiKey = FILTER_FIELD_MAP[f.field];
        if (apiKey && f.value) {
          if (DATE_FILTER_FIELDS.has(f.field)) {
            const d = new Date(f.value);
            const formatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
            if (Array.isArray(apiKey)) {
              apiKey.forEach((k) => {
                result[k] = formatted;
              });
            } else {
              result[apiKey] = formatted;
            }
          } else if (f.field === "is_endorsed_letter") {
            result[apiKey] = f.value === "Endorsement" ? true : false;
          } else if (Array.isArray(apiKey)) {
            apiKey.forEach((k) => {
              result[k] = f.value;
            });
          } else {
            result[apiKey] = f.value;
          }
        }
      });
      return Object.keys(result).length > 0 ? result : null;
    },
    [FILTER_FIELD_MAP],
  );

  const handleDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);

      const pageSize = isDashboardNavigation ? DASHBOARD_PAGE_SIZE : DEFAULT_PAGE_SIZE;
      const newPage = Math.floor(newDataState.skip / pageSize) + 1;

      // Dashboard and pie chart modes — no server-side filter search
      if (isDashboardNavigation) {
        if (newPage !== currentPage) {
          setCurrentPage(newPage);
          fetchDashboardData(newPage);
        }
        return;
      }
      if (usePieChartData) return;

      // Server-side column filter search — inbox and letterbox paths
      if ((pathNameUrl === "/digidak-inbox" || pathNameUrl === "/digidak-letterbox") && lastFetchPayload) {
        const newActiveFilters = buildActiveFilters(newDataState.filter);
        const prevActiveFilters = buildActiveFilters(dataState.filter);
        const filtersChanged = JSON.stringify(newActiveFilters) !== JSON.stringify(prevActiveFilters);

        if (filtersChanged) {
          const newFilters = newDataState.filter?.filters || [];
          const prevFilters = dataState.filter?.filters || [];
          const hasTextFilterChange = newFilters.some((f) => {
            if (!TEXT_FILTER_FIELDS.has(f.field)) return false;
            const prev = prevFilters.find((p) => p.field === f.field);
            return !prev || prev.value !== f.value;
          });

          const basePayload = stripFilterParams(lastFetchPayload);
          const newPayload = { ...basePayload, ...(newActiveFilters || {}) };

          const executeSearch = () => {
            setLastFetchPayload(newPayload);
            setFilterSearchParams(newActiveFilters);
            setCurrentPage(1);
            dispatch(resetDigidakInboxPagination());
            if (pathNameUrl === "/digidak-letterbox") {
              dispatch(fetchDigidakLetterbox({ ...newPayload, page: 1 }));
            } else {
              dispatch(fetchDigidakInboxV2({ ...newPayload, page: 1 }));
            }
          };

          if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

          if (hasTextFilterChange) {
            filterDebounceRef.current = setTimeout(executeSearch, 1000);
          } else {
            executeSearch();
          }
          return;
        }
      }

      // Handle page change
      if (newPage !== currentPage && lastFetchPayload) {
        setCurrentPage(newPage);
        if (pathNameUrl === "/digidak-inbox") {
          dispatch(fetchDigidakInboxV2({ ...lastFetchPayload, page: newPage }));
        } else if (pathNameUrl === "/digidak-letterbox") {
          dispatch(fetchDigidakLetterbox({ ...lastFetchPayload, page: newPage }));
        }
      }
    },
    [currentPage, lastFetchPayload, pathNameUrl, dispatch, isDashboardNavigation, fetchDashboardData, DASHBOARD_PAGE_SIZE, usePieChartData, buildActiveFilters, dataState.filter],
  );
  const handleViewDigidak = useCallback(
    (item) => {
      if (item?.dataItem?.id) {
        saveStateToStorage();
        navigate(`/digidak-view/${item?.dataItem?.id}`, {
          state: {
            digidakObjectId: item?.dataItem?.id,
            screenName: "viewInward",
            pathname: pathNameUrl,
            digidak_uid: item?.dataItem?.digidak_uid,
            i_folder_id: item?.dataItem?.i_folder_id,
          },
        });
      }
    },
    [navigate],
  );
  const handleMovementRegister = useCallback(
    async (props) => {
      const data = props?.dataItem;

      if (data?.id) {
        const response = await dispatch(
          fetchDigidakMovementRegister({
            input_parent_folders: data.id,
          }),
        );

        if (response.type === "getDigidakMovementRegister/fulfilled") {
          setMovementRegisterData(response.payload || []);
          setPopups((prev) => ({ ...prev, movementRegister: true }));
        }
      }
    },
    [dispatch],
  );
  const handleInitiateCase = useCallback((dataItem) => {
    Swal.fire({
      icon: "info",
      title: "Initiate Case on ECM",
      text: `Initiating case for ${dataItem.digidak_uid}`,
    }).then((result) => {
      if (result.isConfirmed) {
        // navigate to InitiateCase and pass the digidak id
        navigate("/create-case", {
          state: {
            path: "digidakInitiateCase",
            digidakObjectId: dataItem?.id,
          },
        });
      } else {
        Swal.close();
      }
    });
  }, []);
  const handleResponseToLetter = useCallback((dataItem) => {
    Swal.fire({
      icon: "info",
      title: "Response to Letter",
      text: `Responding to letter ${dataItem.digidak_uid}`,
    });

    Swal.fire({
      title: "Response to Letter",
      html: `Do you want to Respond to letter <strong>${dataItem.digidak_uid}</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        navigate("/outward-entry", {
          state: { responseToLetterData: dataItem },
        });
      } else {
        Swal.close();
      }
    });
  }, []);
  const handleCopy = useCallback((dataItem) => {
    let dataItemToParams = { ...dataItem, id: "" };

    Swal.fire({
      title: "Copy data?",
      html: `Do you want to copy the data for <strong>${dataItem.digidak_uid}</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
    }).then((result) => {
      if (!result.isConfirmed) {
        Swal.close();
        return;
      }

      // Outward copy
      if (dataItem?.decision === "Outward") {
        navigate("/outward-entry", {
          state: { copiedData: dataItemToParams },
        });
        return;
      }

      // Inward copy
      navigate("/inward-entry", {
        state: { copiedData: dataItemToParams },
      });
    });
  }, []);
  // Forward Letter
  const handleForwardLetter = useCallback((dataItem) => {
    navigate("/forward-digidak", {
      state: { digidakObjectId: dataItem?.id },
    });
  }, []);
  const DigidakUIDCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent" onClick={() => handleViewDigidak(props)}>
        {props.dataItem.digidak_uid}
      </button>
    </td>
  );

  const isEndorsedLetterCell = (props) => (
    <td>
      <span className="text-break">{props.dataItem.is_endorsed_letter == 1 ? "Endrosement" : "Main letter"}</span>
    </td>
  );
  const AssignedVerticalCell = (props) => (
    <td>
      <span className="text-break">{props.dataItem.vertical_head_short_name}</span>
    </td>
  );
  // Grid Action Cell
  const ActionCell = (props) => (
    <DigidakInboxActionCell
      props={props}
      isDDM={isDDM}
      isDMDChairman={isDMDChairman}
      pathNameUrl={pathNameUrl}
      onMovementRegister={handleMovementRegister}
      onInitiateCase={handleInitiateCase}
      onResponseToLetter={handleResponseToLetter}
      onCopy={handleCopy}
      onForwardLetter={handleForwardLetter}
    />
  );
  const formatDate = formatDateTimeParam;
  // Fetch inbox data with optional date filters
  const fetchInboxData = useCallback(
    (fromDateFilter = null, toDateFilter = null) => {
      const userGroups = groups?.variables?.out_groups_user || [];

      const payload = {
        object_name,
        groups: userGroups,
      };

      // Add date filters only if provided
      if (fromDateFilter) {
        const fromDate = new Date(fromDateFilter);
        fromDate.setHours(0, 0, 0, 0);
        payload.from_date = formatDate(fromDate);
      }
      if (toDateFilter) {
        const toDate = new Date(toDateFilter);
        toDate.setHours(23, 59, 59, 0);
        payload.to_date = formatDate(toDate, true);
      }

      // Reset pagination and column filters on new fetch
      setCurrentPage(1);
      setFilterSearchParams(null);
      setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE, filter: null }));
      dispatch(resetDigidakInboxPagination());

      // Call appropriate API based on pathNameUrl
      if (pathNameUrl === "/digidak-inbox") {
        setLastFetchPayload(payload);
        dispatch(fetchDigidakInboxV2({ ...payload, page: 1 }));
      } else if (pathNameUrl === "/digidak-letterbox") {
        const letterboxPayload = { mode: "letterBox", ...payload };
        setLastFetchPayload(letterboxPayload);
        dispatch(fetchDigidakLetterbox({ ...letterboxPayload, page: 1 }));
      }
    },
    [dispatch, object_name, groups, pathNameUrl],
  );
  const onSubmit = (data) => {
    if (usePieChartData) {
      setLocalFilterDates({ from: data.fromDate, to: data.toDate });
    } else {
      fetchInboxData(data.fromDate, data.toDate);
    }
    setHasSearched(true);
  };

  const isGoDisabled = !fromDate || !toDate;

  const skeletonRows = Array.from({ length: 25 })?.map((_, index) => ({
    id: index,
    case_name: " ",
    case_subject: " ",
    task_date_sent: " ",
    case_priority: " ",
    case_status: " ",
  }));

  const mappedInboxData = useMemo(() => {
    const mapCases = (letters) => letters?.map(mapInboxEntry) ?? [];

    if (isDashboardNavigation) {
      return mapCases(dashboardData);
    }
    return usePieChartData
      ? mapCases(
          pieChartData?.filter((item) => {
            if (!localFilterDates.from || !localFilterDates.to) return true;
            const itemDate = new Date(item?.content?.properties?.completion_date);
            const from = new Date(localFilterDates.from);
            const to = new Date(localFilterDates.to);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            return itemDate >= from && itemDate <= to;
          }),
        )
      : mapCases(inboxList);
  }, [isDashboardNavigation, dashboardData, usePieChartData, pieChartData, inboxList, localFilterDates]);

  // For server-side pagination, only apply sorting and filtering on client
  const processedData = useMemo(() => {
    if (usePieChartData) {
      // PieChart data is local, use full client-side processing
      return process(mappedInboxData, dataState);
    }
    const clientSideState = {
      sort: dataState.sort,
    };
    const result = process(mappedInboxData, clientSideState);
    result.total = isDashboardNavigation ? dashboardPagination.total : pagination.total;
    return result;
  }, [mappedInboxData, dataState, pagination.total, usePieChartData, isDashboardNavigation, dashboardPagination.total]);

  const assignedUserOptions = Array.from(
    new Set(
      (Array.isArray(mappedInboxData) ? mappedInboxData : [])
        .flatMap((item) => (Array.isArray(item.assign_to) ? item.assign_to : [item.assign_to]))
        .filter((v) => v && typeof v === "string"),
    ),
  ).toSorted();

  // Fetch dashboard data on mount when navigating from dashboard
  useEffect(() => {
    if (isDashboardNavigation) {
      fetchDashboardData(1);
    }
  }, [isDashboardNavigation, fetchDashboardData]);

  // State restoration effect - check for saved state on mount
  useEffect(() => {
    if (!fromViewCaseNavigation) return;
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved.fromViewCase || Date.now() - saved.timestamp >= 30 * 60 * 1000) return;

      skipNextInitialFetchRef.current = true;
      setDataState(saved.dataState || { sort: [{ field: "id", dir: "dec" }], skip: 0, take: DEFAULT_PAGE_SIZE, filter: null });
      setFilterSearchParams(saved.filterSearchParams || null);
      setCurrentPage(saved.currentPage || 1);

      if (saved.formFromDate || saved.formToDate) {
        reset({
          ...defaultValues,
          fromDate: saved.formFromDate ? new Date(saved.formFromDate) : null,
          toDate: saved.formToDate ? new Date(saved.formToDate) : null,
        });
        setHasSearched(true);
      }

      if (saved.lastFetchPayload) {
        setLastFetchPayload(saved.lastFetchPayload);
        dispatch(resetDigidakInboxPagination());
        const restoreAction = pathNameUrl === "/digidak-letterbox" ? fetchDigidakLetterbox : fetchDigidakInboxV2;
        dispatch(restoreAction({ ...saved.lastFetchPayload, page: saved.currentPage || 1 }));
      }

      clearStateFromStorage();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch groups using the hook
  useDigidakGroups(object_name);
  useEffect(() => {
    if (!object_name) return;

    if (pathNameUrl === "/digidak-inbox" && groups && !usePieChartData && !isDashboardNavigation) {
      if (skipNextInitialFetchRef.current) {
        skipNextInitialFetchRef.current = false;
        return;
      }
      const userGroups = groups?.variables?.out_groups_user || [];

      const payload = { object_name, groups: userGroups };
      setLastFetchPayload(payload);
      setCurrentPage(1);
      dispatch(resetDigidakInboxPagination());
      dispatch(fetchDigidakInboxV2({ ...payload, page: 1 }));
    }
  }, [dispatch, pathNameUrl, object_name, groups, usePieChartData]);
  useEffect(() => {
    if (!object_name) return;

    if (pathNameUrl === "/digidak-letterbox") {
      if (skipNextInitialFetchRef.current) {
        skipNextInitialFetchRef.current = false;
        return;
      }
      const payload = { mode: "letterBox", object_name };
      setLastFetchPayload(payload);
      setCurrentPage(1);
      dispatch(resetDigidakInboxPagination());
      dispatch(fetchDigidakLetterbox({ ...payload, page: 1 }));
    }
  }, [dispatch, pathNameUrl, object_name]);
  useEffect(() => {
    if (usePieChartData) {
      reset({
        ...defaultValues,
        fromDate: initialFromDate || null,
        toDate: initialToDate || null,
      });
    } else {
      reset(defaultValues);
    }
  }, [pathNameUrl, usePieChartData, initialFromDate, initialToDate]);
  // Handle reset
  const handleReset = () => {
    reset(defaultValues);
    setHasSearched(false);
    setFilterSearchParams(null);
    if (usePieChartData) {
      setLocalFilterDates({ from: null, to: null });
    } else {
      fetchInboxData();
    }
  };
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    // run once at mount
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  return (
    <Layout movementPop={popups.movementRegister}>
      <h6 className="case-title-h6 mb-2">
        {tabName === "viewLettersTab" && (
          <button className="border-0 bg-transparent me-2 cursor-pointer" onClick={() => navigate(-1)}>
            <IoArrowBack size="18px" color="white" />
          </button>
        )}
        {pathNameUrl === "/digidak-letterbox" ? "Digidak Letterbox" : "Digidak Inbox"}
        {location.state?.headerContext ? ` of ${location.state.headerContext}` : ""}
      </h6>
      <div className="main-container-filter">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row g-3">
            <div className="col-xs-12 col-sm-3 col-md-3">
              <Controller
                name="fromDate"
                control={control}
                render={({ field }) => <DatePicker {...field} format="dd/MM/yyyy" placeholder="From Date" onChange={(e) => field.onChange(e.value)} max={new Date()} />}
              />
            </div>
            <div className="col-xs-12 col-sm-3 col-md-3">
              <Controller
                name="toDate"
                control={control}
                render={({ field }) => (
                  <DatePicker {...field} format="dd/MM/yyyy" placeholder="To Date" onChange={(e) => field.onChange(e.value)} min={fromDate || undefined} max={new Date()} />
                )}
              />
            </div>
            <div className="col-xs-12 col-sm-6 col-md-6 d-flex align-items-center justify-content-between">
              <div>
                {hasSearched && (fromDate || toDate) && (
                  <Button className="common-btn-css min-width-50 cancel-button me-2 " onClick={handleReset}>
                    <RiResetLeftLine size="14px" />
                  </Button>
                )}

                <Button className="common-btn-css min-width-50 submit-button" onClick={handleSubmit(onSubmit)} disabled={isGoDisabled}>
                  GO
                </Button>
              </div>
              <DigidakExportButton excelExportRef={excelExportRef} data={processedData?.data} />
            </div>
          </div>
        </form>

        <div className="digidak-inbox-outbox-grid mt-3">
          <ExcelExport data={processedData} fileName={pathNameUrl === "/digidak-letterbox" ? "Digidak_Letterbox.xlsx" : "Digidak_Inbox.xlsx"} ref={excelExportRef}>
            <Grid
              {...dataState}
              data={loading ? { data: skeletonRows, total: processedData.total } : processedData}
              sortable={true}
              resizable={true}
              filterable={true}
              pageable={{
                info: true,
                buttonCount: 10,
                pageSizes: false,
              }}
              onDataStateChange={handleDataStateChange}
            >
              <GridColumn
                field="digidak_uid"
                title="Digidak UID"
                width="130px"
                minResizableWidth={130}
                cells={{ data: isLoading ? Skeleton : tabName === "viewLettersTab" ? undefined : DigidakUIDCell }}
              />

              <GridColumn
                field="subject"
                title="Subject"
                minResizableWidth={200}
                cells={{ data: isLoading ? Skeleton : undefined }}
                width={windowSize?.width > 1440 && pathNameUrl === "/digidak-letterbox" ? "270px" : "200px"}
              />

              {pathNameUrl !== "/digidak-letterbox" && (
                <GridColumn
                  field="date"
                  title="Date"
                  width="140px"
                  minResizableWidth={100}
                  filterable={true}
                  cells={{
                    filterCell: (props) => (
                      <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                        <DatePickerFilterCell {...props} />
                      </HeaderTdElement>
                    ),
                    data: isLoading ? Skeleton : undefined,
                  }}
                />
              )}
              <GridColumn
                field="due_date"
                title="Due Date"
                width="140px"
                minResizableWidth={100}
                filterable={true}
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DatePickerFilterCell {...props} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              {pathNameUrl !== "/digidak-letterbox" && (
                <GridColumn field="inward_ref_date" title="Inward Ref Date" width="145px" minResizableWidth={145} cells={{ data: isLoading ? Skeleton : undefined }} />
              )}
              {pathNameUrl !== "/digidak-letterbox" && (
                <GridColumn field="from" title="From" width="130px" minResizableWidth={130} cells={{ data: isLoading ? Skeleton : undefined }} />
              )}
              {pathNameUrl === "/digidak-letterbox" && (
                <GridColumn field="initiator" title="From" width="230px" minResizableWidth={130} cells={{ data: isLoading ? Skeleton : undefined }} />
              )}
              <GridColumn
                field="status"
                title="Status"
                width="110px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={digidakStatusOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              <GridColumn
                field="category"
                title="Category"
                width="110px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={digidakCategoryOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              <GridColumn
                field="language"
                title="Language"
                width="110px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={caseLanguageOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              <GridColumn
                field="is_endorsed_letter"
                title="Is Endorsed"
                width="110px"
                filterable={true}
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={endorsedFilterOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : isEndorsedLetterCell,
                }}
              />

              {pathNameUrl !== "/digidak-letterbox" && (
                <GridColumn field="vertical_head_display_name" title="Assigned Vertical" width="180px" cells={{ data: isLoading ? Skeleton : AssignedVerticalCell }} />
              )}
              <GridColumn
                field="assign_to"
                title="Assigned User"
                width="180px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={assignedUserOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              <GridColumn
                field="secrecy"
                title="Secrecy"
                width="110px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={natureOfCaseOptions} />
                    </HeaderTdElement>
                  ),
                  data: isLoading ? Skeleton : undefined,
                }}
              />
              {tabName !== "viewLettersTab" && (
                <GridColumn
                  title="Actions"
                  cells={{ data: isLoading ? Skeleton : ActionCell }}
                  width={isDMDChairman ? "165" : isDDM ? "90px" : pathNameUrl === "/digidak-letterbox" ? "80px" : "150px"}
                  filterable={false}
                  sortable={false}
                  locked={true}
                />
              )}
            </Grid>
          </ExcelExport>
        </div>
      </div>

      <MovementRegister
        visible={popups.movementRegister}
        movementRegisterData={movementRegisterData}
        onClose={() => {
          setPopups((prev) => ({ ...prev, movementRegister: false }));
          setMovementRegisterData([]);
        }}
      />
    </Layout>
  );
}
