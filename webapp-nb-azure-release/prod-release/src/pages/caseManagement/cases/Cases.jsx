import { useCallback, useEffect, useMemo, useRef, useState } from "react";

//constants
import { CASE_STATUS } from "../../../constants/statusConstants";
import { buildActiveFilters as buildActiveFiltersUtil } from "../../../utils/filterUtils";

//custom components
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import MovementRegister from "../viewCase/movementRegister/MovementRegister";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";

//router-dom
import { useNavigate, useLocation } from "react-router-dom";

//kendo components
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { ComboBox } from "@progress/kendo-react-dropdowns";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { RadioGroup } from "@progress/kendo-react-inputs";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

//inline svg icons
const SitemapIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 640 512" fill="currentColor">
    <path d="M128 352H160V464c0 26.5 21.5 48 48 48h96V400h64v112h96c26.5 0 48-21.5 48-48V352h32c17.7 0 32-14.3 32-32V256c0-17.7-14.3-32-32-32H416V160h32c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H192C174.3 0 160 14.3 160 32v96c0 17.7 14.3 32 32 32h32v64H96c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32z" />
  </svg>
);
const EmailIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor">
    <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
  </svg>
);
const RefreshIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor">
    <path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z" />
  </svg>
);
const BadgeCheckIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.8 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.34z" />
  </svg>
);
const CancelIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z" />
  </svg>
);
const SearchIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor">
    <path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" />
  </svg>
);
const ResetIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor">
    <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z" />
  </svg>
);
const ExportIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 576 512" fill="currentColor">
    <path d="M384 121.9c0-6.3-2.5-12.4-7-16.9L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1zM192 336v-32c0-8.8 7.2-16 16-16h176V160H248c-13.2 0-24-10.8-24-24V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V352H208c-8.8 0-16-7.2-16-16zm379.3-20.7l-112-112c-4.7-4.7-12.3-4.7-17 0l-7.1 7.1c-4.7 4.7-4.7 12.3 0 17L500.7 293H208c-6.6 0-12 5.4-12 12v10c0 6.6 5.4 12 12 12h292.7l-65.5 65.6c-4.7 4.7-4.7 12.3 0 17l7.1 7.1c4.7 4.7 12.3 4.7 17 0l112-112c4.7-4.8 4.7-12.4 0-17.1z" />
  </svg>
);
const ClipboardIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 384 512" fill="currentColor">
    <path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm144 418c0 3.3-2.7 6-6 6H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h42v36c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-36h42c3.3 0 6 2.7 6 6z M150 268l-38 38 76 76 114-114-38-38-76 76z" />
  </svg>
);
const ClosedIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor">
    <path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z" />
  </svg>
);

//utils
import { formatDateCell, formatDateTimeParam, formatDateOnly } from "../../../utils/Utils";
import {
  caseLanguageOptions,
  caseStatusOptions,
  natureOfCaseOptions,
  casePriorityOptions,
  sixGroups,
  teDataList,
  performerNameByDepartment,
  DMD_DESIGNATION,
  teOptions,
} from "../../data/DropdownData";

// sweet alert
import Swal from "sweetalert2";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";

//redux slice
import { useDispatch, useSelector } from "react-redux";
import { dashboardService } from "../../../services/dashboard/dashboardService";
import { viewCaseService } from "../../../services/caseManagement/viewCase/ViewCaseService";
import { digidakOutboxService } from "../../../services/digidak/outbox/digidakOutboxService";
import { fetchOutboxCasesV2 } from "../../../redux/caseManagement/caseOutbox/caseOutboxSlice";
import { fetchMovementRegister } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";
import { fetchViewCases, DEFAULT_PAGE_SIZE, resetViewCasesPagination } from "../../../redux/caseManagement/viewCase/viewCaseSlice";

const FILTER_FIELD_MAP = {
  case_name: "input_name",
  case_subject: "input_description",
  nature_of_case: "input_case_nature",
  created_on: "input_created_on",
  created_by: "input_created_by",
  case_status: "input_status",
  case_priority: "input_task_priority",
  language_type: "input_language_type",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["case_name", "case_subject"]);

// Date filter fields need special formatting
const DATE_FILTER_FIELDS = new Set(["created_on"]);

// Static card configuration (counts are injected at render time via cardCountValues)
const STATUS_CARD_CONFIG = [
  { key: "total", label: "Total", icon: SitemapIcon, cardClass: "bg-total", iconClass: "icon-total" },
  { key: "draft", label: "Draft", icon: EmailIcon, cardClass: "bg-draft", iconClass: "icon-draft" },
  { key: "inProgress", label: "In Progress", icon: RefreshIcon, cardClass: "bg-progress", iconClass: "icon-progress" },
  { key: "approved", label: "Approved", icon: BadgeCheckIcon, cardClass: "bg-approved", iconClass: "icon-approved" },
  { key: "closed", label: "Closed", icon: ClosedIcon, cardClass: "bg-closed", iconClass: "icon-closed" },
  { key: "cancelled", label: "Cancelled", icon: CancelIcon, cardClass: "bg-cancelled", iconClass: "icon-cancelled" },
];

// Skeleton rows reused for all loading states — stable reference
const SKELETON_ROWS = Array.from({ length: 25 }).map((_, index) => ({
  id: index,
  case_name: " ",
  case_subject: " ",
  nature_of_case: " ",
  case_priority: " ",
  created_on: " ",
  created_by: " ",
  case_status: " ",
  current_performer: " ",
  task_sender: " ",
}));

const PRIORITY_CLASS_MAP = { Urgent: "priority-urgent", Secret: "priority-immediate" };
const NATURE_CLASS_MAP = { Regular: "natureOfCase-regular", Confidential: "natureOfCase-confidential", Secret: "natureOfCase-secret" };

// Pure presentational cells (no closures on component state)
const CaseSubjectCell = (props) => {
  const caseSubject = props?.dataItem?.case_subject;
  return (
    <td title={caseSubject}>
      <p className="text-truncate mb-0">{caseSubject}</p>
    </td>
  );
};

const DateCell = (props) => <td>{formatDateCell(props.dataItem.created_on)}</td>;

// Badge-cell factory: renders a colored pill based on a value -> class map
const makeBadgeCell = (field, classMap, fallbackClass = "") => {
  const BadgeCell = (props) => {
    const value = props?.dataItem?.[field];
    const klass = classMap[value] || fallbackClass;
    return (
      <td>
        <div className={`case-priority-td ${klass}`}>{value}</div>
      </td>
    );
  };
  BadgeCell.displayName = `BadgeCell(${field})`;
  return BadgeCell;
};

const CasePriorityCell = makeBadgeCell("case_priority", PRIORITY_CLASS_MAP, "priority-default");
const NatureOfCaseCell = makeBadgeCell("nature_of_case", NATURE_CLASS_MAP);

// Kendo grid filter-cell wrappers
const dropdownFilterCell = (data) => {
  const DropdownFilter = (props) => (
    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
      <DropdownFilterCell {...props} data={data} />
    </HeaderTdElement>
  );
  DropdownFilter.displayName = "DropdownFilterWrapper";
  return DropdownFilter;
};

const datePickerFilterCell = (props) => (
  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
    <DatePickerFilterCell {...props} />
  </HeaderTdElement>
);

const buildActiveFilters = (filter) => buildActiveFiltersUtil(filter, FILTER_FIELD_MAP, DATE_FILTER_FIELDS);

// Unified case-list mapper — handles both view cases and outbox cases
const mapCaseItem = (caseItem, isOutbox) => {
  const props = isOutbox && caseItem?.r_object_id ? caseItem : (caseItem?.content?.properties ?? {});
  const base = {
    case_name: props.object_name,
    case_subject: props.description,
    nature_of_case: props.nature_of_case || props.case_nature,
    case_priority: props.task_priority || props.case_priority,
    created_on: props.date_sent || props.r_creation_date,
    created_by: props.lastperformer || props.r_creator_name || props.assigned_user,
    case_status: props.status,
    folder_id: props.r_object_id || props.id,
    is_resubmitted: props.is_resubmitted,
    in_workflow: props.in_workflow,
    language_type: props.language_type,
    ho_ro: props.ho_ro,
    department_short_code: props.department_short_code,
  };
  if (isOutbox) {
    base.task_sender = props.assigned_user;
    base.current_performer = props.currentperformer;
  }
  return base;
};

const mapCaseList = (cases, isOutbox) => cases?.map((c) => mapCaseItem(c, isOutbox)) ?? [];

// Default 30-day date range used by reset and initial fetch
const getDefaultDateRange = () => {
  const today = new Date();
  const priorDate = new Date();
  priorDate.setDate(today.getDate() - 30);
  const fmt = (d) => d.toISOString().split("T")[0];
  return { from: fmt(priorDate), to: fmt(today) };
};

/**
 * Build fetch params for fetchViewCases. Consolidates the three duplicated
 * param-construction blocks in handleReset, handleSearch, and the initial-fetch effect.
 * When fromDate/toDate are provided (handleSearch), they are formatted via formatDateTimeParam;
 * otherwise a 30-day default range is used.
 */
const buildFetchParams = ({
  foundConditionMatch,
  selectedValue,
  office_type,
  department_short_code,
  location,
  selectRadioDropData,
  isDMDUser,
  regionDeptName,
  fromDate,
  toDate,
}) => {
  const params = {};

  if (fromDate && toDate) {
    params.input_created_on = formatDateTimeParam(fromDate);
    params.input_created_on_ = formatDateTimeParam(toDate, true);
  } else {
    const range = getDefaultDateRange();
    params.input_created_on = range.from;
    params.input_created_on_ = range.to;
  }

  if (foundConditionMatch) {
    params.input_ho_ro = selectedValue === "allCase" ? "" : selectedValue === "hoDept" ? office_type : teDataList.includes(selectRadioDropData?.text) ? "TE" : "RO";

    if (selectedValue === "allCase") {
      params.input_department_short_co = department_short_code;
    } else if (selectedValue === "hoDept") {
      params.input_department_short_co = selectRadioDropData?.value || (isDMDUser ? regionDeptName.map((i) => i.value) : "");
    } else if (selectedValue === "roteDept") {
      params.input_location = isDMDUser ? selectRadioDropData?.text || regionDeptName.map((i) => i.text) : selectRadioDropData?.text;
    }
  } else {
    params.input_ho_ro = office_type;
    if (office_type === "HO") {
      params.input_department_short_co = department_short_code;
    } else {
      params.input_location = location;
    }
  }

  return params;
};

export default function Cases() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const excelExportRef = useRef(null);
  const filterDebounceRef = useRef(null);

  const { fromPieChart, pieChartStatus, pieChartCaseParams } = location.state || {};
  const { viewCases, loading, pagination } = useSelector((state) => state?.viewCases);
  const { dashboardVerticals } = useSelector((state) => state.dashboard);
  const { outboxCases, loading: outboxLoading, pagination: outboxPagination } = useSelector((state) => state?.caseOutbox || {});

  const { userProfile, dmdChairmanCondition } = useSelector((state) => state?.login);
  const { office_type, department_short_code, department_short_code_multi, ro_short_code, object_name, department_name, location: userLocation } = userProfile?.properties || {};
  const isDMDUser = DMD_DESIGNATION.includes(department_name);

  const verticalNames = dashboardVerticals?.map((item) => item.value);

  const { fromViewCase: fromViewCaseNavigation } = location.state || {};
  const options = [
    { label: `${(department_short_code || "").toUpperCase()} Sent Cases`, value: "dmdChairmanSentCase" },
    { label: "View Secretariat Cases", value: "allCase" },
    { label: "Select RO/TE", value: "roteDept" },
    { label: "Select HO Dept", value: "hoDept" },
  ];

  const performerName = performerNameByDepartment[department_short_code] || "";

  const foundConditionMatch = sixGroups?.some((group) => dmdChairmanCondition?.includes(group));

  const [searchText, setSearchText] = useState("");
  const [selectedValue, setSelectedValue] = useState(fromPieChart ? "allCase" : foundConditionMatch ? "dmdChairmanSentCase" : "allCase");
  const [selectRadioDropData, setSelectRadioDropData] = useState("");
  const isRestoredRef = useRef(false);
  const [popups, setPopups] = useState({ movementRegister: false });
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [regionDeptName, setRegionDeptName] = useState([]);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [cardCounts, setCardCounts] = useState([]);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Fetch card counts using the count API (same as dashboard ECM chart)
  useEffect(() => {
    const fetchCardCounts = async () => {
      const today = new Date();
      const priorDate = new Date();
      priorDate.setDate(today.getDate() - 30);

      const payload = {
        ho_ro: office_type,
        from_date: formatDateOnly(priorDate),
        to_date: formatDateOnly(today),
        queryName: office_type === "HO" ? "dashboard.count.ho" : "dashboard.count.ro",

        ...(foundConditionMatch
          ? {
              ...(selectedValue === "allCase" && {
                department_short_code: department_short_code_multi.join(","),
              }),
              ...(selectedValue === "hoDept" && {
                ho_ro: "HO",
                queryName: "dashboard.count.ho",
                department_short_code: selectRadioDropData?.value || (isDMDUser ? regionDeptName.map((i) => i.value).join(",") : ""),
                function_short_code: verticalNames.join(","),
              }),
              ...(selectedValue === "roteDept" && {
                ho_ro: teDataList.includes(selectRadioDropData?.text) ? "TE" : "RO",
                queryName: "dashboard.count.ro",
                department_short_code: department_short_code_multi.join(","),
                ro_short_code: selectRadioDropData?.value || (isDMDUser ? regionDeptName.map((i) => i.value).join(",") : ""),
              }),
            }
          : {
              ...(office_type === "HO"
                ? { department_short_code: department_short_code_multi.join(","), function_short_code: verticalNames.join(",") }
                : { department_short_code: department_short_code_multi.join(","), ro_short_code: ro_short_code }),
            }),
      };

      try {
        const response = await dashboardService.getDashboardCountV2(payload);
        setCardCounts(response);
      } catch (error) {
        console.error("Failed to fetch card counts:", error);
      }
    };

    fetchCardCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office_type, department_short_code_multi, ro_short_code, foundConditionMatch, selectedValue, selectRadioDropData, isDMDUser, regionDeptName]);

  // Derive card count values from count API response
  const getCountByStatus = (status) => {
    const item = cardCounts?.find((c) => {
      const s = c?.status;
      if (Array.isArray(status)) return status.includes(s);
      return s === status;
    });
    return parseInt(item?.count_total || 0, 10);
  };

  const cardCountValues = {
    total: cardCounts?.reduce((sum, item) => sum + parseInt(item?.count_total || 0, 10), 0) || 0,
    draft: getCountByStatus([CASE_STATUS.DRAFT, CASE_STATUS.OPEN]) || 0,
    inProgress: getCountByStatus(["In Progress", CASE_STATUS.IN_PROGRESS]) || 0,
    approved: getCountByStatus(CASE_STATUS.APPROVED) || 0,
    closed: getCountByStatus([CASE_STATUS.CLOSED, CASE_STATUS.FINISHED]) || 0,
    cancelled: getCountByStatus(CASE_STATUS.CANCELLED) || 0,
  };

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchParams, setFetchParams] = useState(null);

  // Tracks active column filter params for use during pagination
  const [filterSearchParams, setFilterSearchParams] = useState(null);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });
  // State retention functions — ref always holds latest state to avoid stale closures
  const getStorageKey = () => `casesState_${office_type}_${department_short_code}`;
  const currentStateRef = useRef({});
  currentStateRef.current = {
    dataState,
    filterSearchParams,
    currentPage,
    fetchParams,
    searchText,
    selectedValue,
    selectRadioDropData,
    fromDate: fromDate?.toISOString() ?? null,
    toDate: toDate?.toISOString() ?? null,
  };

  const saveStateToStorage = () => {
    const state = currentStateRef.current;
    localStorage.setItem(getStorageKey(), JSON.stringify({ ...state, fromViewCase: true, timestamp: Date.now() }));
  };
  const clearStateFromStorage = () => localStorage.removeItem(getStorageKey());

  const handleDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);

      const newPage = Math.floor(newDataState.skip / DEFAULT_PAGE_SIZE) + 1;

      // Detect filter changes across all mapped fields
      const newActiveFilters = buildActiveFilters(newDataState.filter);
      const prevActiveFilters = buildActiveFilters(dataState.filter);
      const filtersChanged = JSON.stringify(newActiveFilters) !== JSON.stringify(prevActiveFilters);

      if (filtersChanged) {
        // Check if any changed filter is a text field (needs debounce)
        const newFilters = newDataState.filter?.filters || [];
        const prevFilters = dataState.filter?.filters || [];
        const hasTextFilterChange = newFilters.some((f) => {
          if (!TEXT_FILTER_FIELDS.has(f.field)) return false;
          const prev = prevFilters.find((p) => p.field === f.field);
          return !prev || String(prev.value) !== String(f.value);
        });

        const executeSearch = () => {
          setFilterSearchParams(newActiveFilters);
          setCurrentPage(1);
          setDataState((prev) => ({ ...prev, skip: 0 }));
          dispatch(resetViewCasesPagination());
          if (fetchParams) {
            dispatch(fetchViewCases({ ...fetchParams, ...(newActiveFilters || {}), page: 1, "items-per-page": DEFAULT_PAGE_SIZE }));
          }
        };

        // Clear any pending debounce
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

        if (hasTextFilterChange) {
          // Debounce text input — wait for user to stop typing
          filterDebounceRef.current = setTimeout(executeSearch, 1000);
        } else {
          // Dropdown selection — fire immediately
          executeSearch();
        }
        return;
      }

      // Handle page change
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
        if (fetchParams && selectedValue !== "dmdChairmanSentCase") {
          dispatch(fetchViewCases({ ...fetchParams, ...(filterSearchParams || {}), page: newPage, "items-per-page": DEFAULT_PAGE_SIZE }));
        } else if (selectedValue === "dmdChairmanSentCase") {
          dispatch(
            fetchOutboxCasesV2({
              queryName: "sent.task",
              performer: performerName,
              page: newPage,
              itemsPerPage: DEFAULT_PAGE_SIZE,
            }),
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage, fetchParams, dispatch, selectedValue, dataState.filter, filterSearchParams],
  );

  const handleReset = () => {
    // Clear restored flag and saved state
    isRestoredRef.current = false;
    clearStateFromStorage();

    // Reset all filter/form state to defaults
    setFromDate(null);
    setToDate(null);
    setSearchText("");
    const defaultSelection = foundConditionMatch ? "dmdChairmanSentCase" : "allCase";
    setSelectedValue(defaultSelection);
    setSelectRadioDropData("");
    setFilterSearchParams(null);
    setCurrentPage(1);
    setDataState({ sort: [{ field: "id", dir: "asc" }], skip: 0, take: DEFAULT_PAGE_SIZE, filter: null });
    dispatch(resetViewCasesPagination());

    if (defaultSelection === "dmdChairmanSentCase") {
      setFetchParams(null);
      dispatch(
        fetchOutboxCasesV2({
          queryName: "sent.task",
          performer: performerName,
          page: 1,
          itemsPerPage: DEFAULT_PAGE_SIZE,
        }),
      );
    } else {
      const params = buildFetchParams({
        foundConditionMatch,
        selectedValue: "allCase",
        office_type,
        department_short_code,
        location: userLocation,
        selectRadioDropData: "",
        isDMDUser,
        regionDeptName,
      });

      setFetchParams(params);
      dispatch(fetchViewCases({ ...params, page: 1, "items-per-page": DEFAULT_PAGE_SIZE }));
    }
  };

  const handleSearch = () => {
    const params = buildFetchParams({
      foundConditionMatch,
      selectedValue,
      office_type,
      department_short_code,
      location: userLocation,
      selectRadioDropData,
      isDMDUser,
      regionDeptName,
      fromDate,
      toDate,
    });

    // Save params for pagination re-fetches and reset pagination
    setFetchParams(params);
    setCurrentPage(1);
    setFilterSearchParams(null);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE, filter: null }));
    dispatch(resetViewCasesPagination());

    if (selectedValue === "dmdChairmanSentCase") {
      dispatch(
        fetchOutboxCasesV2({
          queryName: "sent.task",
          performer: performerName,
          page: 1,
          itemsPerPage: DEFAULT_PAGE_SIZE,
        }),
      );
    } else {
      dispatch(
        fetchViewCases({
          ...params,
          page: 1,
          "items-per-page": DEFAULT_PAGE_SIZE,
        }),
      );
    }
  };

  const isCaseClickDisabled = selectedValue === "roteDept" || selectedValue === "hoDept";

  const CaseNumberCell = (props) => {
    const caseNumber = props?.dataItem?.case_name;
    return (
      <td className={isCaseClickDisabled ? "mb-0" : "case-number-span cursor-pointer mb-0 fw-bold"} onClick={isCaseClickDisabled ? undefined : () => handleViewCase(props)}>
        {caseNumber}
      </td>
    );
  };

  const handleViewCase = useCallback(
    (item) => {
      if (item?.dataItem?.folder_id) {
        saveStateToStorage();

        navigate(`/view-case/${item?.dataItem?.folder_id}`, {
          state: {
            path: "viewCase",
            screenName: "caseScreen",
            folderId: item?.dataItem?.folder_id,
            caseStatus: item?.dataItem?.case_status,
            autoNumOutput: item?.dataItem?.case_name,
            isInitiateWorkflow: item?.dataItem?.in_workflow,
          },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  const CaseActionCell = (props) => {
    const { case_status, is_resubmitted } = props?.dataItem || {};
    const isClosed = case_status?.toLowerCase() === "closed" || case_status?.toLowerCase() === "finished";

    return (
      <td>
        <Button
          className={is_resubmitted === true || isClosed === false ? "pull-back-btn pull-back-disable" : "pull-back-btn pull-back-enable"}
          disabled={is_resubmitted === true || isClosed === false}
          onClick={() => handleReSubmit(props)}
        >
          Resubmit
        </Button>
      </td>
    );
  };

  const handleMovementRegister = useCallback(
    async (props) => {
      const caseData = props?.dataItem?.folder_id;

      if (caseData) {
        const response = await dispatch(
          fetchMovementRegister({
            input_parent_folders: caseData,
          }),
        );

        if (response.type === "viewCases/fetchMovementRegister/fulfilled") {
          setMovementRegisterData(response.payload || []);
          setPopups((prev) => ({ ...prev, movementRegister: true }));
        }
      }
    },
    [dispatch],
  );

  const MovementRegisterCell = (props) => {
    return (
      <td>
        <div className="d-flex align-items-center justify-content-center">
          <button className="icon-wrapper icon-clickable border-0" onClick={() => handleMovementRegister(props)} title="Movement Register">
            <ClipboardIcon style={{ width: 14, height: 14, color: "#5e9bf7" }} />
          </button>
        </div>
      </td>
    );
  };

  const handleReSubmit = async (props) => {
    await Swal.fire({
      title: "Re Submit",
      html: `Are you sure you want to Re Submit <strong>${props?.dataItem?.case_name}</strong>?`,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "No",
      confirmButtonText: "Yes",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },

      preConfirm: async () => {
        try {
          Swal.showLoading(); // show spinner inside "Yes" button

          const response = await viewCaseService.resubmitCase({
            inp_case_objectid: props?.dataItem?.folder_id,
            login_user: object_name,
          });

          const folder_id = response?.data?.variables?.out_resubmit_id?.[0];
          const case_name = response?.data?.variables?.out_case_number;

          navigate(`/view-case/${folder_id}`, {
            state: {
              path: "viewCase",
              screenName: "caseScreen",
              folderId: folder_id,
              caseStatus: CASE_STATUS.DRAFT,
              autoNumOutput: case_name,
              isInitiateWorkflow: false,
            },
          });
        } catch (error) {
          Swal.hideLoading();
          showSweetAlert({
            title: "Error",
            text: error.message || "Resubmission failed. Please try again",
            icon: "error",
          });
        }
      },
    });
  };

  const handleExport = () => {
    if (excelExportRef.current && processedData.data.length > 0) {
      excelExportRef.current.save(processedData);
    } else {
      Swal.fire({
        icon: "warning",
        title: "Nothing to export",
        text: "There is no data available to export right now.",
      });
    }
  };

  const mappedData = useMemo(() => {
    const isOutbox = selectedValue === "dmdChairmanSentCase";
    return mapCaseList(isOutbox ? outboxCases : viewCases, isOutbox);
  }, [viewCases, selectedValue, outboxCases]);

  // For server-side pagination, only apply sorting on client; exclude server-side filtered fields
  const currentPagination = selectedValue === "dmdChairmanSentCase" ? outboxPagination : pagination;

  const processedData = useMemo(() => {
    // Remove server-side filtered fields from client-side filtering to avoid double filtering
    const clientFilter = dataState.filter
      ? {
          ...dataState.filter,
          filters: (dataState.filter.filters || []).filter((f) => !FILTER_FIELD_MAP[f.field]),
        }
      : null;
    const hasClientFilters = clientFilter?.filters?.length > 0;
    const clientSideState = {
      sort: dataState.sort,
      filter: hasClientFilters ? clientFilter : null,
    };
    const result = process(mappedData, clientSideState);
    result.total = currentPagination?.total || 0;
    return result;
  }, [mappedData, dataState.sort, dataState.filter, currentPagination]);

  const createdByOptions = Array.from(new Set((Array.isArray(mappedData) ? mappedData : [])?.map((item) => item.created_by)))
    ?.filter(Boolean)
    .sort();

  const sortedRegionDeptOptions = useMemo(() => regionDeptName.filter((item) => item?.text && item?.value).sort((a, b) => a.text.localeCompare(b.text)), [regionDeptName]);

  // State restoration effect - check for saved state on mount
  useEffect(() => {
    if (!fromViewCaseNavigation) return;
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved.fromViewCase || Date.now() - saved.timestamp >= 30 * 60 * 1000) return;

      // Prevent initial-fetch effect from overwriting the restored data
      isRestoredRef.current = true;

      const restoredPage = saved.currentPage || 1;
      const restoredSkip = (restoredPage - 1) * DEFAULT_PAGE_SIZE;

      setSearchText(saved.searchText || "");
      setDataState({
        ...(saved.dataState || { sort: [{ field: "id", dir: "asc" }], take: DEFAULT_PAGE_SIZE, filter: null }),
        skip: restoredSkip,
      });
      setFilterSearchParams(saved.filterSearchParams || null);
      setCurrentPage(restoredPage);

      if (saved.fetchParams) {
        const restoredParams = {
          ...saved.fetchParams,
          input_created_on: saved.fromDate ? formatDateTimeParam(new Date(saved.fromDate)) : saved.fetchParams.input_created_on,
          input_created_on_: saved.toDate ? formatDateTimeParam(new Date(saved.toDate), true) : saved.fetchParams.input_created_on_,
        };
        setFetchParams(restoredParams);
        dispatch(resetViewCasesPagination());
        dispatch(
          fetchViewCases({
            ...restoredParams,
            ...(saved.filterSearchParams || {}),
            page: restoredPage,
            "items-per-page": DEFAULT_PAGE_SIZE,
          }),
        );
      }

      // Restore dropdown and date selections
      if (saved.selectedValue) setSelectedValue(saved.selectedValue);
      if (saved.selectRadioDropData) setSelectRadioDropData(saved.selectRadioDropData);
      if (saved.fromDate) setFromDate(new Date(saved.fromDate));
      if (saved.toDate) setToDate(new Date(saved.toDate));

      clearStateFromStorage();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Pie chart navigation: fetch cases with filters from ECM chart
  useEffect(() => {
    if (!fromPieChart || !pieChartCaseParams) return;

    setFetchParams(pieChartCaseParams);
    setCurrentPage(1);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE }));
    dispatch(resetViewCasesPagination());

    dispatch(
      fetchViewCases({
        ...pieChartCaseParams,
        page: 1,
        "items-per-page": DEFAULT_PAGE_SIZE,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPieChart, pieChartCaseParams]);

  // Initial data fetch - only if not restoring state
  useEffect(() => {
    if (isRestoredRef.current) return;
    if (fromPieChart) return;

    // Prevent redundant call for DMD users before departments are fetched
    if ((selectedValue === "hoDept" || selectedValue === "roteDept") && regionDeptName.length === 0) {
      return;
    }

    const params = buildFetchParams({
      foundConditionMatch,
      selectedValue,
      office_type,
      department_short_code,
      location: userLocation,
      selectRadioDropData,
      isDMDUser,
      regionDeptName,
    });

    // Save params for pagination re-fetches and reset pagination
    setFetchParams(params);
    setCurrentPage(1);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE }));
    dispatch(resetViewCasesPagination());

    if (selectedValue === "dmdChairmanSentCase") {
      dispatch(
        fetchOutboxCasesV2({
          queryName: "sent.task",
          performer: performerName,
          page: 1,
          itemsPerPage: DEFAULT_PAGE_SIZE,
        }),
      );
    } else {
      dispatch(
        fetchViewCases({
          ...params,
          page: 1,
          "items-per-page": DEFAULT_PAGE_SIZE,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office_type, department_short_code, userLocation, selectedValue, selectRadioDropData, dispatch, isDMDUser, regionDeptName, userProfile]);

  useEffect(() => {
    const fetchDepartments = async () => {
      setRegionDeptName([]);

      if (isDMDUser) {
        try {
          const fetchForCategory = async (cat) => {
            const dmdOfficeType = `${department_name}${cat}`.replace(/\s+/g, "");
            const response = await digidakOutboxService.getGroups({
              "run-stateless": "true",
              data: {
                variables: {
                  flag: "dept_location",
                  in_office_type: dmdOfficeType,
                  in_login_user: object_name,
                },
              },
            });
            const variables = response?.data?.variables || {};
            const displayNames = variables.group_display_name || [];
            const names = variables.group_names || [];

            return displayNames
              .map((text, idx) => ({
                text: text || names[idx],
                value: names[idx],
              }))
              .filter((opt) => opt.text && opt.value);
          };

          if (selectedValue === "hoDept") {
            const options = await fetchForCategory("HO");
            setRegionDeptName(options);
          } else if (selectedValue === "roteDept") {
            const roOptions = await fetchForCategory("RO");
            let teOptionsData = [];
            if (department_name !== "DMD S2") {
              teOptionsData = await fetchForCategory("TE");
            }
            setRegionDeptName([...roOptions, ...teOptionsData]);
          }
        } catch (err) {
          console.error(err);
          setRegionDeptName([]);
        }
        return;
      }

      const type = selectedValue === "hoDept" ? "HO" : "RO";
      try {
        const response = await dashboardService.getDepartments({
          input_folder: `/ECM CONFIG/Office Type/${type}`,
        });

        const regionGroup = [
          ...(response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.title,
          })) || []),

          ...teOptions.map((item) => ({
            text: item.text,
            value: item.value,
          })),
        ];

        const regionGroup1 =
          response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.title,
          })) || [];

        setRegionDeptName(selectedValue === "roteDept" ? regionGroup : regionGroup1);
      } catch (err) {
        console.error(err);
      }
    };

    if (selectedValue === "roteDept" || selectedValue === "hoDept") {
      fetchDepartments();
    }
  }, [selectedValue, isDMDUser, department_name, object_name]);

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

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentLoading = selectedValue === "dmdChairmanSentCase" ? outboxLoading : loading;

  return (
    <Layout movementPop={popups?.movementRegister}>
      <p className="font-size-12 text-light mb-1">{fromPieChart ? `Showing "${pieChartStatus}" cases from ECM Dashboard` : "Cases processed in last 30 days"}</p>
      <div className="row g-2">
        {STATUS_CARD_CONFIG.map(({ key, label, icon: Icon, cardClass, iconClass }) => (
          <div key={key} className="col">
            <div className={`card-bg ${cardClass}`}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="card-count">{cardCountValues[key]}</span>
                  <p className="count-card-name mb-0">{label}</p>
                </div>
                <Icon className={`card-icon ${iconClass}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center justify-content-between my-2">
        {foundConditionMatch ? (
          <div className="d-flex align-items-center justify-content-between">
            <RadioGroup
              className="radio-btn-text"
              layout="horizontal"
              data={options}
              value={selectedValue}
              onChange={(e) => {
                isRestoredRef.current = false;
                setSelectedValue(e.value);
                setSelectRadioDropData("");
                setRegionDeptName([]);
              }}
            />
            {selectedValue !== "allCase" && selectedValue !== "dmdChairmanSentCase" && (
              <ComboBox
                data={sortedRegionDeptOptions}
                textField="text"
                dataItemKey="value"
                value={selectRadioDropData}
                placeholder=" select ..."
                onChange={(e) => {
                  isRestoredRef.current = false;
                  setSelectRadioDropData(e.value);
                }}
                className="width-150 ms-2"
              />
            )}
          </div>
        ) : (
          <h6 className="case-title-h6">Cases</h6>
        )}

        <div className="d-flex align-items-center gap-2">
          <DatePicker
            format="dd/MM/yyyy"
            value={fromDate}
            placeholder="From Date"
            className="font-size-12 width-150"
            max={new Date()}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <DatePicker format="dd/MM/yyyy" value={toDate} placeholder="To Date" className="font-size-12 width-150" max={new Date()} onChange={(e) => setToDate(e.target.value)} />

          <Button type="button" onClick={handleSearch} className="master-search-btn" aria-label="Search">
            <SearchIcon style={{ width: 14, height: 14 }} />
          </Button>

          <Button type="button" className="master-search-btn" aria-label="Reset" onClick={handleReset}>
            <ResetIcon style={{ width: 14, height: 14 }} />
          </Button>

          <Button className="export-to-excel" onClick={handleExport}>
            <div className="d-flex align-items-center font-size-12">
              <ExportIcon className="me-1" /> Export
            </div>
          </Button>
        </div>
      </div>

      <div className="view-case-grid">
        <ExcelExport data={processedData} fileName="Cases_List.xlsx" ref={excelExportRef}>
          <Grid
            {...dataState}
            data={currentLoading ? { data: SKELETON_ROWS, total: processedData.total } : processedData}
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
              width={windowSize?.width > 1440 ? "210px" : "120px"}
              minResizableWidth={100}
              field="case_name"
              title="Case Number"
              filterable={true}
              cells={{ data: currentLoading ? Skeleton : CaseNumberCell }}
            />
            <GridColumn
              width={windowSize?.width > 1024 ? "" : "160px"}
              minResizableWidth={100}
              field="case_subject"
              title="Case Subject"
              filterable={true}
              cells={{ data: currentLoading ? Skeleton : CaseSubjectCell }}
            />

            {selectedValue !== "dmdChairmanSentCase" && (
              <GridColumn
                width={windowSize?.width > 1440 ? "120px" : "110px"}
                minResizableWidth={100}
                field="nature_of_case"
                title="Nature of Case"
                filterable={true}
                cells={{
                  filterCell: dropdownFilterCell(natureOfCaseOptions),
                  data: currentLoading ? Skeleton : NatureOfCaseCell,
                }}
              />
            )}

            {selectedValue === "dmdChairmanSentCase" && (
              <GridColumn
                width={windowSize?.width > 1024 ? "" : "180px"}
                minResizableWidth={100}
                field="current_performer"
                title="Case With"
                cells={{ data: currentLoading ? Skeleton : undefined }}
              />
            )}

            {selectedValue === "dmdChairmanSentCase" && (
              <GridColumn width="160px" minResizableWidth={100} field="task_sender" title="Sent To" cells={{ data: currentLoading ? Skeleton : undefined }} />
            )}

            <GridColumn
              width="140px"
              minResizableWidth={100}
              field="created_on"
              title="Created On"
              filterable={true}
              cells={{
                filterCell: datePickerFilterCell,
                data: currentLoading ? Skeleton : DateCell,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1440 ? "140px" : "120px"}
              minResizableWidth={100}
              field="created_by"
              title="Created By"
              filterable={true}
              cells={{
                filterCell: dropdownFilterCell(createdByOptions),
                data: currentLoading ? Skeleton : undefined,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1440 ? "110px" : "100px"}
              minResizableWidth={100}
              field="case_status"
              title="Case Status"
              cells={{
                filterCell: dropdownFilterCell(caseStatusOptions),
                data: currentLoading ? Skeleton : undefined,
              }}
            />

            {selectedValue !== "dmdChairmanSentCase" && (
              <GridColumn
                width={windowSize?.width > 1367 ? "110px" : "100px"}
                minResizableWidth={90}
                field="case_priority"
                title="Case Priority"
                cells={{
                  filterCell: dropdownFilterCell(casePriorityOptions),
                  data: currentLoading ? Skeleton : CasePriorityCell,
                }}
              />
            )}

            {selectedValue !== "dmdChairmanSentCase" && (
              <GridColumn
                width="80px"
                minResizableWidth={80}
                field="language_type"
                title="Language"
                cells={{
                  filterCell: dropdownFilterCell(caseLanguageOptions),
                  data: currentLoading ? Skeleton : undefined,
                }}
              />
            )}

            {selectedValue !== "dmdChairmanSentCase" && (
              <GridColumn
                width="45px"
                title="MR"
                headerCell={() => <span title="Movement Register">MR</span>}
                sortable={false}
                resizable={false}
                filterable={false}
                cells={{ data: currentLoading ? Skeleton : MovementRegisterCell }}
              />
            )}

            {!foundConditionMatch && selectedValue !== "dmdChairmanSentCase" && (
              <GridColumn width="90px" title="Action" sortable={false} resizable={false} filterable={false} cells={{ data: currentLoading ? Skeleton : CaseActionCell }} />
            )}
          </Grid>
        </ExcelExport>
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
