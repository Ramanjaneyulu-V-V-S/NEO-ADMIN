import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// component
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

// react from hook
import { useForm, Controller, useWatch } from "react-hook-form";

// kendo react
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";

// react icons
import { FaLayerGroup } from "react-icons/fa";
import { IoArrowBack } from "react-icons/io5";
import { RiResetLeftLine } from "react-icons/ri";
import { FaClipboardList, FaCopy } from "react-icons/fa6";

// sweet alert
import Swal from "sweetalert2";

// utils
import { formatDateTimeParam } from "../../../utils/Utils";
import { digidakStatusOptions, digidakCategoryOptions, caseLanguageOptions, natureOfCaseOptions } from "../../data/DropdownData";

import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import GroupLetterGridDialog from "./GroupLetterGridDialog";
import EndorsementDialog from "./EndorsementDialog";
import { useDDMContext } from "../../../hooks/useDDMContext";
import { useDigidakGroups } from "../../../hooks/useDigidakGroups";
import { dashboardService } from "../../../services/dashboard/dashboardService";
import DigidakExportButton from "../../../components/digidak/DigidakExportButton";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import { fetchDigidakOutboxV2, DEFAULT_PAGE_SIZE, resetDigidakOutboxPagination } from "../../../redux/digidak/outbox/digidakOutboxSlice";
import { mapOutboxItem } from "./outboxDataMapper";
import { FILTER_FIELD_MAP, TEXT_FILTER_FIELDS, DATE_FILTER_FIELDS, stripFilterParams, defaultValues } from "./outboxConstants";

export default function DigidakOutbox() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDDM } = useDDMContext();
  const excelExportRef = useRef(null);
  const filterDebounceRef = useRef(null);
  const skipNextInitialFetchRef = useRef(false);

  const { tabName, pieChartData, dashboardParams, fromDate: initialFromDate, toDate: initialToDate, fromViewCase: fromViewCaseNavigation } = location.state || {};

  const { isDMDChairman } = useSelector((state) => state.digidakInbox);
  const { outboxList, loading, pagination } = useSelector((state) => state.digidakOutbox);
  const { userProfile, isCGMUser } = useSelector((state) => state.login);

  const { object_name, office_type, department_name, department_short_code, ro_short_code } = userProfile?.properties || {};

  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [popups, setPopups] = useState({ movementRegister: false });

  // Group letter grid dialog
  const [showGroupGridDialog, setShowGroupGridDialog] = useState(false);
  const [groupUidForGrid, setGroupUidForGrid] = useState(null);

  const [loader, setLoader] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [usePieChartData] = useState(!!pieChartData);
  const isDashboardNavigation = !!dashboardParams;
  const [dashboardData, setDashboardData] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardPagination, setDashboardPagination] = useState({ total: 0, page: 1, itemsPerPage: DEFAULT_PAGE_SIZE });
  const [localFilterDates, setLocalFilterDates] = useState({
    from: initialFromDate || null,
    to: initialToDate || null,
  });
  const [endorseUidForDialog, setEndorseUidForDialog] = useState(null);

  // Fetch user groups
  const groupsArray = useDigidakGroups(object_name);

  // CGM group names -> used in payload
  const HOCgmGroupName = office_type && department_short_code ? `ecm_digidak_${office_type.toLowerCase()}_${department_short_code.toLowerCase()}_cgm` : "";
  const ROTECgmGroupName = office_type && ro_short_code ? `ecm_digidak_${office_type.toLowerCase()}_${ro_short_code.toLowerCase()}_cgm` : "";
  const DDMGroupName = office_type && ro_short_code ? `ecm_digidak_${office_type.toLowerCase()}_${ro_short_code.toLowerCase()}_ddm` : "";

  const getStorageKey = () => `digidakOutboxState_${object_name}`;
  const clearStateFromStorage = () => localStorage.removeItem(getStorageKey());

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

  // Ref always holds latest state — avoids stale closure in handleViewDigidak useCallback
  const currentStateRef = useRef({});
  currentStateRef.current = { dataState, filterSearchParams, currentPage, lastFetchPayload };

  const saveStateToStorage = () => {
    const state = currentStateRef.current;
    localStorage.setItem(getStorageKey(), JSON.stringify({ ...state, fromViewCase: true, timestamp: Date.now() }));
  };

  const isLoading = isDashboardNavigation ? dashboardLoading : loading;

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      ...defaultValues,
      fromDate: initialFromDate || null,
      toDate: initialToDate || null,
    },
  });
  const { fromDate, toDate } = useWatch({ control });

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

  const buildActiveFilters = useCallback((filter) => {
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
  }, []);

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

      // Server-side column filter search
      if (lastFetchPayload) {
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
            dispatch(resetDigidakOutboxPagination());
            dispatch(fetchDigidakOutboxV2({ ...newPayload, page: 1 }));
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
        dispatch(fetchDigidakOutboxV2({ ...lastFetchPayload, page: newPage }));
      }
    },
    [currentPage, lastFetchPayload, dispatch, isDashboardNavigation, fetchDashboardData, DASHBOARD_PAGE_SIZE, usePieChartData, buildActiveFilters, dataState.filter],
  );

  const handleViewDigidak = useCallback(
    (item) => {
      if (item?.dataItem?.id) {
        saveStateToStorage();
        navigate(`/digidak-view/${item?.dataItem?.id}`, {
          state: {
            digidakObjectId: item?.dataItem?.id,
            screenName: "viewOutward",
            digidak_uid: item?.dataItem?.digidak_uid,
            i_folder_id: item?.dataItem?.i_folder_id,
          },
        });
      }
    },
    [navigate],
  );
  const handleViewDigidakResponded = (props) => {
    const responding_uid = props?.dataItem?.responding_uid?.[0];
    const result = processedData?.data?.find((item) => item.digidak_uid === responding_uid);

    saveStateToStorage();
    navigate(`/digidak-view/${props?.dataItem?.responding_object_id}`, {
      state: {
        digidakObjectId: result?.responding_object_id,
        screenName: "viewOutward",
        digidak_uid: responding_uid,
      },
    });
  };
  // Handle click on Endorsement UID
  const handleEndorsementUIDClick = (props) => {
    const endorsementUID = props?.dataItem?.endorse_uid;
    if (!endorsementUID) return;
    setEndorseUidForDialog(endorsementUID);
  };
  const handleCopy = useCallback((dataItem) => {
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
      if (result.isConfirmed) {
        navigate("/outward-entry", { state: { copiedData: dataItem } });
      } else {
        Swal.close();
      }
    });
  }, []);
  const DigidakUIDCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent" onClick={() => handleViewDigidak(props)}>
        {props.dataItem.digidak_uid}
      </button>
    </td>
  );
  const DigidakRespondedCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent" onClick={() => handleViewDigidakResponded(props)}>
        {props.dataItem.responding_uid}
      </button>
    </td>
  );
  const EndorsementUIDClick = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent" onClick={() => handleEndorsementUIDClick(props)}>
        {props.dataItem.endorse_uid}
      </button>
    </td>
  );
  const formatDate = formatDateTimeParam;
  const formatGroupName = (grp) => {
    if (!grp || typeof grp !== "string") return null;

    // Already formatted? avoid formatting again.
    if (grp.includes("-")) return grp;

    return grp.replace(/_/g, "-").toUpperCase();
  };
  const fetchOutboxData = useCallback(
    (fromDateFilter = null, toDateFilter = null) => {
      // Guard: CGM check not resolved yet
      if (isCGMUser === null) return;

      // Guard: groups not ready for non-CGM users
      if (!isCGMUser && groupsArray.length === 0) return;

      const formattedVerticals = groupsArray.map(formatGroupName).filter(Boolean);

      const input_vertical = isCGMUser ? "" : formattedVerticals[0] || "";
      const input_source_vertical = isCGMUser ? "" : formattedVerticals;
      const input_login_dept_ro_te = isCGMUser ? (office_type === "HO" ? HOCgmGroupName : ROTECgmGroupName) : "";

      const payload = {
        is_ddm: isDDM,
        input_vertical,
        input_source_vertical,
        input_login_dept_ro_te: isDDM ? DDMGroupName : input_login_dept_ro_te,
      };

      // Apply date filters
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

      setLastFetchPayload(payload);
      setCurrentPage(1);
      setFilterSearchParams(null);
      setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE, filter: null }));
      dispatch(resetDigidakOutboxPagination());
      dispatch(fetchDigidakOutboxV2({ ...payload, page: 1 }));
    },
    [dispatch, isCGMUser, groupsArray, office_type, isDDM],
  );
  const onSubmit = (data) => {
    if (usePieChartData) {
      setLocalFilterDates({ from: data.fromDate, to: data.toDate });
    } else {
      fetchOutboxData(data.fromDate, data.toDate);
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
    office_order_no: " ",
  }));

  // Map the data for grid
  const mappedOutboxData = useMemo(() => {
    const mapCases = (letters) => letters?.map(mapOutboxItem) ?? [];

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
      : mapCases(outboxList);
  }, [isDashboardNavigation, dashboardData, usePieChartData, pieChartData, outboxList, localFilterDates]);

  // For server-side pagination, only apply sorting and filtering on client
  const processedData = useMemo(() => {
    if (usePieChartData) {
      return process(mappedOutboxData, dataState);
    }
    const clientSideState = {
      sort: dataState.sort,
    };
    const result = process(mappedOutboxData, clientSideState);
    result.total = isDashboardNavigation ? dashboardPagination.total : pagination.total;
    return result;
  }, [mappedOutboxData, dataState, pagination.total, usePieChartData, isDashboardNavigation, dashboardPagination.total]);

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

      if (saved.lastFetchPayload) {
        setLastFetchPayload(saved.lastFetchPayload);
        dispatch(resetDigidakOutboxPagination());
        dispatch(fetchDigidakOutboxV2({ ...saved.lastFetchPayload, page: saved.currentPage || 1 }));
      }

      clearStateFromStorage();
    } catch (e) {
      console.error(e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch outbox data (performant)
  useEffect(() => {
    if (!object_name || !office_type || !department_short_code || !department_name) return;

    // Wait until CGM check is resolved
    if (isCGMUser === null) return;

    // Groups might still be loading for non-CGM users
    if (!isCGMUser && groupsArray.length === 0) return;

    if (usePieChartData || isDashboardNavigation) return;

    if (skipNextInitialFetchRef.current) {
      skipNextInitialFetchRef.current = false;
      return;
    }

    setLoader(true);

    try {
      const formattedVerticals = groupsArray.map(formatGroupName).filter(Boolean);

      const input_vertical = isCGMUser ? "" : formattedVerticals[0] || "";
      const input_source_vertical = isCGMUser ? "" : formattedVerticals;
      const input_login_dept_ro_te = isCGMUser ? (office_type === "HO" ? HOCgmGroupName : ROTECgmGroupName) : "";

      const payload = {
        is_ddm: isDDM,
        input_vertical,
        input_source_vertical,
        input_login_dept_ro_te: isDDM ? DDMGroupName : input_login_dept_ro_te,
      };
      setLastFetchPayload(payload);
      setCurrentPage(1);
      setFilterSearchParams(null);
      dispatch(resetDigidakOutboxPagination());
      dispatch(fetchDigidakOutboxV2({ ...payload, page: 1 }));
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to fetch outbox data.",
      });
    } finally {
      setLoader(false);
    }
  }, [dispatch, object_name, office_type, department_short_code, department_name, isCGMUser, groupsArray, isDDM, usePieChartData]);

  useEffect(() => {
    if (usePieChartData) {
      reset({
        ...defaultValues,
        fromDate: initialFromDate || null,
        toDate: initialToDate || null,
      });
    }
  }, [usePieChartData, initialFromDate, initialToDate]);

  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  // Handle reset
  const handleReset = () => {
    reset(defaultValues);
    setHasSearched(false);
    setFilterSearchParams(null);
    if (usePieChartData) {
      setLocalFilterDates({ from: null, to: null });
    } else {
      fetchOutboxData();
    }
  };
  // Handle MR
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
  const ActionCell = (props) => {
    const dataItem = props.dataItem;
    const isGroupLetter = dataItem?.is_bulk_letter === true || dataItem.digidak_uid.startsWith("G");

    return (
      <td className="sticky-action-cell">
        <div className="d-flex align-items-center justify-content-center gap-1">
          {/* Movement Register */}
          {!isGroupLetter && (
            <button className="icon-wrapper icon-clickable border-0" onClick={() => handleMovementRegister(props)} title="Movement Register">
              <FaClipboardList size="14px" color="#5e9bf7" />
            </button>
          )}

          {isGroupLetter && (
            <button className="icon-wrapper icon-clickable border-0" onClick={() => openGroupGridDialog(dataItem)} title="View Group Letters">
              <FaLayerGroup size={14} />
            </button>
          )}

          {/* Copy (disabled for bulk) */}
          <button
            className={`icon-wrapper border-0 ${isGroupLetter ? "icon-disabled" : "icon-clickable"}`}
            title={isGroupLetter ? "Copy is not available for bulk letters" : "Copy"}
            onClick={isGroupLetter ? undefined : () => handleCopy(props.dataItem)}
          >
            <FaCopy color="#d13438" size={13} />
          </button>
        </div>
      </td>
    );
  };
  const openGroupGridDialog = (dataItem) => {
    setGroupUidForGrid(dataItem.digidak_uid);
    setShowGroupGridDialog(true);
  };
  const closeGroupGridDialog = () => {
    setShowGroupGridDialog(false);
    setGroupUidForGrid(null);
  };

  return (
    <Layout movementPop={popups.movementRegister}>
      <h6 className="case-title-h6 mb-2">
        {tabName === "viewLettersTab" && (
          <button className="border-0 bg-transparent me-2 cursor-pointer" onClick={() => navigate(-1)}>
            <IoArrowBack size="18px" color="white" />
          </button>
        )}
        Digidak Outbox
        {location.state?.headerContext ? ` of ${location.state.headerContext}` : ""}
      </h6>
      <div className="main-container-filter">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row g-3">
            <div className="col-xs-12 col-sm-3 col-md-3">
              <Controller
                name="fromDate"
                control={control}
                render={({ field }) => <DatePicker {...field} format="dd/MM/yyyy" placeholder="Form Date" onChange={(e) => field.onChange(e.value)} max={new Date()} />}
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
          <ExcelExport data={processedData} fileName="Digidak_Outbox.xlsx" ref={excelExportRef}>
            <Grid
              {...dataState}
              data={isLoading || loader ? { data: skeletonRows, total: processedData.total } : processedData}
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
                cells={{ data: isLoading || loader ? Skeleton : tabName === "viewLettersTab" ? undefined : DigidakUIDCell }}
              />
              <GridColumn field="subject" title="Subject" width="200px" minResizableWidth={200} cells={{ data: isLoading || loader ? Skeleton : undefined }} />
              {isDMDChairman && (
                <GridColumn
                  field="isForwardLetter"
                  title="Forwarded"
                  width="100px"
                  minResizableWidth={100}
                  cells={{
                    filterCell: (props) => (
                      <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                        <DropdownFilterCell {...props} data={["NO", "YES"]} />
                      </HeaderTdElement>
                    ),
                    data: isLoading || loader ? Skeleton : undefined,
                  }}
                />
              )}
              <GridColumn
                field="completion_date"
                title="Date & Time"
                width="140px"
                minResizableWidth={100}
                filterable={true}
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DatePickerFilterCell {...props} />
                    </HeaderTdElement>
                  ),
                  data: isLoading || loader ? Skeleton : undefined,
                }}
              />
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
                  data: isLoading || loader ? Skeleton : undefined,
                }}
              />
              <GridColumn field="to" title="Sent To" width="130px" minResizableWidth={130} cells={{ data: isLoading || loader ? Skeleton : undefined }} />
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
                  data: isLoading || loader ? Skeleton : undefined,
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
                  data: isLoading || loader ? Skeleton : undefined,
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
                  data: isLoading || loader ? Skeleton : undefined,
                }}
              />
              <GridColumn field="login_region" title="From" width="130px" cells={{ data: isLoading || loader ? Skeleton : undefined }} />
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
                  data: isLoading || loader ? Skeleton : undefined,
                }}
              />
              <GridColumn field="endorse_uid" title="Endorsed To" width="110px" cells={{ data: isLoading || loader ? Skeleton : EndorsementUIDClick }} />
              <GridColumn
                field="office_order_no"
                title="Office Order No."
                width="130px"
                minResizableWidth={130}
                cells={{ data: isLoading || loader ? Skeleton : undefined }}
              />
              <GridColumn
                field="responding_uid"
                title="Responded UID"
                width="110px"
                cells={{
                  data: isLoading || loader ? Skeleton : DigidakRespondedCell,
                }}
              />
              {tabName !== "viewLettersTab" && (
                <GridColumn title="Actions" cells={{ data: isLoading || loader ? Skeleton : ActionCell }} width="80px" filterable={false} sortable={false} locked={true} />
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

      <GroupLetterGridDialog open={showGroupGridDialog} onClose={closeGroupGridDialog} groupUid={groupUidForGrid} />

      <EndorsementDialog open={!!endorseUidForDialog} onClose={() => setEndorseUidForDialog(null)} endorseUid={endorseUidForDialog} />
    </Layout>
  );
}
