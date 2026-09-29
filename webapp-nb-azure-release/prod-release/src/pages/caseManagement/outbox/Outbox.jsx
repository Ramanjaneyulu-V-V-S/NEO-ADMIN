import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// Custom components
import Layout from "../../../components/layout/Layout";
import PullBackPopup from "../../../components/pullBackPopup/PullbackPopup";

// Kendo components
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

// React icons
import { FiInfo } from "react-icons/fi";
import { TbReload } from "react-icons/tb";
import { IoCloseOutline } from "react-icons/io5";
import { FaFileExport } from "react-icons/fa";

// sweet alert
import Swal from "sweetalert2";

//dropdowndata
import { caseStatusOptions } from "../../data/DropdownData";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";
import { fetchOutboxCasesV2, silentFetchOutboxCasesV2, resetOutboxPagination, DEFAULT_PAGE_SIZE } from "../../../redux/caseManagement/caseOutbox/caseOutboxSlice";

const FILTER_FIELD_MAP = {
  case_name: "case_name",
  case_subject: "case_subject",
  case_status: "case_status",
  task_sender: "sent_to",
  current_performer: "case_with",
  task_date_sent: "sentDate",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["case_name", "case_subject"]);

// Date filter fields need special formatting
const DATE_FILTER_FIELDS = new Set(["task_date_sent"]);

const padTwo = (n) => String(n).padStart(2, "0");

const buildActiveFilters = (filter) => {
  if (!filter?.filters) return null;
  const result = {};
  filter.filters.forEach((f) => {
    const apiKey = FILTER_FIELD_MAP[f.field];
    if (apiKey && f.value) {
      if (DATE_FILTER_FIELDS.has(f.field)) {
        const d = new Date(f.value);
        const formatted = `${padTwo(d.getDate())}/${padTwo(d.getMonth() + 1)}/${d.getFullYear()}`;
        result[apiKey] = formatted;
      } else {
        result[apiKey] = f.value;
      }
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

// Cell components defined outside to maintain stable references
const CaseNumberCell = (props) => (
  <td>
    <span className="fw-medium">{props.dataItem.case_name}</span>
  </td>
);

const SentToCells = ({ dataItem }) => {
  let performer = dataItem.task_sender;

  if (performer?.startsWith("ecm_")) {
    performer = performer.toUpperCase();
    performer = performer.replace(/_4D[A-Z0-9]*$/i, "");
  }

  return <td>{performer}</td>;
};

export default function Outbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const excelExportRef = useRef(null);

  const { dataLoading = false } = location.state || {};
  const { userProfile } = useSelector((state) => state?.login);
  const { object_name } = userProfile?.properties || {};

  const { outboxCases, loading, pagination } = useSelector((state) => state?.caseOutbox);

  const [selectedCase, setSelectedCase] = useState(null);
  const [showInfoBanner, setShowInfoBanner] = useState(dataLoading);

  const [popups, setPopups] = useState({ pullBack: false });

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const filterDebounceRef = useRef(null);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const [filterSearchParams, setFilterSearchParams] = useState(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  const togglePopup = useCallback((key, props = null) => {
    setPopups((prev) => ({ ...prev, [key]: !prev[key] }));
    if (props) setSelectedCase(props?.dataItem);
  }, []);

  // V2 params for the new sent.task API
  const getOutboxParamsV2 = useCallback(
    (page = 1) => ({
      queryName: "sent.task",
      performer: userProfile?.properties?.object_name,
      decisions: "Push Back,Finished",
      page,
      itemsPerPage: DEFAULT_PAGE_SIZE,
    }),
    [userProfile],
  );

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
          dispatch(resetOutboxPagination());
          dispatch(
            fetchOutboxCasesV2({
              ...getOutboxParamsV2(1),
              ...(newActiveFilters || {}),
            }),
          );
        };

        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

        if (hasTextFilterChange) {
          filterDebounceRef.current = setTimeout(executeSearch, 1000);
        } else {
          executeSearch();
        }
        return;
      }

      // Handle page change
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
        dispatch(
          fetchOutboxCasesV2({
            ...getOutboxParamsV2(newPage),
            ...(filterSearchParams || {}),
          }),
        );
      }
    },
    [currentPage, dispatch, getOutboxParamsV2, dataState.filter, filterSearchParams],
  );

  const CaseActionCell = useCallback(
    (props) => {
      const taskPerformer = props?.dataItem?.last_performer;
      const isDisabled = taskPerformer !== object_name;

      return (
        <td>
          <Button
            onClick={() => togglePopup("pullBack", props)}
            className={isDisabled ? "pull-back-btn pull-back-disable" : "pull-back-btn pull-back-enable"}
            disabled={isDisabled}
          >
            Pull Back
          </Button>
        </td>
      );
    },
    [object_name, togglePopup],
  );

  const mappedData = useMemo(() => {
    return (
      outboxCases?.map((item) => {
        // New API returns flat objects; old API nested under content.properties
        const props = item?.r_object_id ? item : (item?.content?.properties ?? {});
        const { object_name: objName, performer, date_sent, assigned_user, description, r_object_id, id, status, queue_id, currentperformer, lastperformer } = props;

        return {
          case_name: objName,
          task_performer: performer,
          task_date_sent: date_sent,
          task_sender: assigned_user,
          case_subject: description,
          folder_id: r_object_id ?? id,
          case_status: status,
          item_id: queue_id,
          last_performer: lastperformer,
          current_performer: currentperformer,
        };
      }) ?? []
    );
  }, [outboxCases]);

  // For server-side pagination, only apply sorting and filtering on client
  const processedData = useMemo(() => {
    const clientSideState = { sort: dataState.sort };
    const result = process(mappedData, clientSideState);
    result.total = pagination.total;
    return result;
  }, [mappedData, dataState.sort, pagination.total]);

  const sentToOptions = useMemo(
    () =>
      Array.from(new Set((Array.isArray(mappedData) ? mappedData : []).map((item) => item.task_sender)))
        .filter(Boolean)
        .toSorted(),
    [mappedData],
  );

  const handleDownload = useCallback(() => {
    if (excelExportRef.current && processedData?.data?.length > 0) {
      excelExportRef.current.save(processedData);
    } else {
      Swal.fire({
        icon: "warning",
        title: "Nothing to export",
        text: "There is no data available to export right now.",
      });
    }
  }, [processedData]);

  const initialCountRef = useRef(null);
  const bgSyncActiveRef = useRef(false);

  // Initial data fetch
  useEffect(() => {
    dispatch(fetchOutboxCasesV2(getOutboxParamsV2(1)));
  }, [userProfile, dispatch, getOutboxParamsV2]);

  // Background sync — silently polls when dataLoading is true until new data appears
  useEffect(() => {
    if (!dataLoading) return;

    // Clear dataLoading from location state so it doesn't re-trigger on back navigation
    navigate(location.pathname, { replace: true, state: {} });

    bgSyncActiveRef.current = true;
    initialCountRef.current = null;
    let pollCount = 0;
    const MAX_POLLS = 20;
    const POLL_INTERVAL = 10000;

    const intervalId = setInterval(async () => {
      if (!bgSyncActiveRef.current) {
        clearInterval(intervalId);
        return;
      }

      pollCount += 1;

      try {
        const result = await dispatch(silentFetchOutboxCasesV2(getOutboxParamsV2(1))).unwrap();
        const currentCount = result?.entries?.length || 0;

        // Capture count from first silent poll
        if (initialCountRef.current === null) {
          initialCountRef.current = currentCount;
          return;
        }

        // New data detected — stop syncing and dismiss banner
        if (currentCount > initialCountRef.current) {
          bgSyncActiveRef.current = false;
          setShowInfoBanner(false);
          clearInterval(intervalId);
        }
      } catch {
        // Silent fail — don't disrupt the user
      }

      // Stop after max attempts
      if (pollCount >= MAX_POLLS) {
        bgSyncActiveRef.current = false;
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL);

    return () => {
      bgSyncActiveRef.current = false;
      clearInterval(intervalId);
    };
  }, [dataLoading, navigate, location.pathname, dispatch, getOutboxParamsV2]);

  const handleRefreshData = useCallback(() => {
    dispatch(fetchOutboxCasesV2(getOutboxParamsV2(currentPage)));
    setShowInfoBanner(false);
    bgSyncActiveRef.current = false;
  }, [dispatch, getOutboxParamsV2, currentPage]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClosePullBack = useCallback(() => togglePopup("pullBack"), [togglePopup]);
  const handleDismissBanner = useCallback(() => setShowInfoBanner(false), []);

  return (
    <Layout>
      {loading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      {showInfoBanner && (
        <div className="info-banner d-flex align-items-center justify-content-between mb-2 rounded-1 font-size-12">
          <div className="d-flex align-items-center gap-2">
            <FiInfo size={16} />
            <span>Your case has been sent successfully. It may take a moment to appear in the list.</span>
            <Button onClick={handleRefreshData} className="master-search-btn font-size-11 ms-1">
              <TbReload size="12px" className="me-1" /> Refresh
            </Button>
          </div>
          <button aria-label="Dismiss notification" className="btn-close flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer" onClick={handleDismissBanner}>
            {/* <IoCloseOutline size={18} /> */}
          </button>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between my-2">
        <h6 className="case-title-h6">Sent Cases</h6>
        <div className="d-flex align-items-center gap-2">
          <Button className="export-to-excel" onClick={handleDownload}>
            <div className="d-flex align-items-center font-size-12">
              <FaFileExport className="me-1" /> Export
            </div>
          </Button>
        </div>
      </div>

      <div className="inbox-sent-draft-grid">
        <ExcelExport data={processedData} fileName="Sent_Cases_List.xlsx" ref={excelExportRef}>
          <Grid
            data={processedData}
            {...dataState}
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
            <GridColumn width={windowSize?.width > 1367 ? "210px" : "200px"} minResizableWidth={100} field="case_name" title="Case Number" cells={{ data: CaseNumberCell }} />
            <GridColumn width={windowSize?.width > 1024 ? "" : "225px"} minResizableWidth={100} field="case_subject" title="Case Subject" />
            <GridColumn width={windowSize?.width > 1024 ? "" : "180px"} minResizableWidth={100} field="current_performer" title="Case With" />
            <GridColumn
              width="160px"
              minResizableWidth={100}
              field="task_sender"
              title="Sent To"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={sentToOptions} ariaLabel="Filter by Sent To" />
                  </HeaderTdElement>
                ),
                data: SentToCells,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1367 ? "200px" : "160px"}
              minResizableWidth={100}
              field="task_date_sent"
              title="Sent Date"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DatePickerFilterCell {...props} />
                  </HeaderTdElement>
                ),
                data: undefined,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1367 ? "200px" : "140px"}
              minResizableWidth={100}
              field="case_status"
              title="Case Status"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={caseStatusOptions} ariaLabel="Filter by Case Status" />
                  </HeaderTdElement>
                ),
              }}
            />
            <GridColumn width="120px" title="Action" sortable={false} resizable={false} filterable={false} cells={{ data: CaseActionCell }} />
          </Grid>
        </ExcelExport>
      </div>

      <PullBackPopup visible={popups.pullBack} selectedCase={selectedCase} onClose={handleClosePullBack} />
    </Layout>
  );
}
