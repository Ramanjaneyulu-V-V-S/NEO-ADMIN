import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Custom Components
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import AcquirePopup from "../../../components/acquirePopup/AcquirePopup";
import PushBackPopup from "../../../components/pushBackPopup/PushbackPopup";
import MovementRegister from "../viewCase/movementRegister/MovementRegister";

// Router
import { useNavigate, useLocation } from "react-router-dom";

//motion
import { motion } from "framer-motion";

// sweet alert
import Swal from "sweetalert2";

// Kendo Components
import { process } from "@progress/kendo-data-query";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

// Icons
import { GrRevert } from "react-icons/gr";
import { FaUserCheck, FaClipboardList } from "react-icons/fa";

// Utils
import { formatDateCell, getPriorityClass } from "../../../utils/Utils";

//dropdowndata
import { caseStatusOptions, casePriorityOptions, taskNameOptions, GROUPS_EA, GROUPS_MAIN } from "../../data/DropdownData";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { fetchMovementRegister } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";
import { fetchInboxCases, DEFAULT_PAGE_SIZE, resetPagination } from "../../../redux/caseManagement/caseInbox/caseInboxSlice";

const FILTER_FIELD_MAP = {
  case_name: "input_name",
  case_subject: "input_description",
  task_date_sent: "input_task_received_after",
  r_modifier: "input_created_by",
  case_status: "input_status",
  case_priority: "input_task_priority",
  task_name: "input_task_name_",
  task_sender: "input_task_sent_by",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["case_name", "case_subject", "task_sender"]);

// Date filter fields need special formatting
const DATE_FILTER_FIELDS = new Set(["task_date_sent"]);

const FYA_ONLY = [{ key: "fya", label: "For Your Action" }];
const FYA_EA = [
  { key: "fya", label: "For Your Action" },
  { key: "eat", label: "EA Tasks" },
];
const FYA_TBV = [
  { key: "fya", label: "For Your Action" },
  { key: "tbv", label: "To be Verified" },
];

const getTabOptions = (condition) => {
  if (!condition) return FYA_ONLY;
  const matchValue = condition.toUpperCase();
  if (GROUPS_EA.some((g) => g.toUpperCase() === matchValue)) return FYA_EA;
  if (GROUPS_MAIN.some((g) => g.toUpperCase() === matchValue)) return FYA_TBV;
  return FYA_ONLY;
};

const SKELETON_ROWS = Array.from({ length: 25 }, (_, index) => ({
  id: index,
  case_name: " ",
  case_subject: " ",
  task_date_sent: " ",
  case_priority: " ",
  case_status: " ",
}));

const pad = (n) => String(n).padStart(2, "0");

const buildActiveFilters = (filter) => {
  if (!filter?.filters) return null;
  const result = {};

  filter.filters.forEach((f) => {
    const apiKey = FILTER_FIELD_MAP[f.field];

    if (apiKey && f.value) {
      if (DATE_FILTER_FIELDS.has(f.field)) {
        const d = new Date(f.value);
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        result[apiKey] = `${dateStr}T00:00:00`;
        result["input_task_received_befor"] = `${dateStr}T23:59:59`;
      } else {
        result[apiKey] = f.value;
      }
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

// Cell components defined outside to maintain stable references
const CaseSubjectCell = (props) => (
  <td title={props.dataItem.case_subject}>
    <div className="text-truncate">{props.dataItem.case_subject}</div>
  </td>
);

const CasePriorityCell = (props) => {
  const priority = props.dataItem.case_priority;
  const priorityClass = getPriorityClass(priority);
  return (
    <td>
      <div className={`case-priority-td ${priorityClass}`}>{priority}</div>
    </td>
  );
};

export default function Inbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const filterDebounceRef = useRef(null);
  const isRestoringStateRef = useRef(false);

  const { userProfile, dmdChairmanCondition } = useSelector((state) => state?.login);
  const { object_name, department_short_code } = userProfile?.properties || {};

  const { fromViewCase: fromViewCaseNavigation } = location.state || {};

  const getStorageKey = () => `inboxState_${department_short_code}`;
  const clearStateFromStorage = () => localStorage.removeItem(getStorageKey());

  const { inboxCases, loading, pagination } = useSelector((state) => state?.caseInbox);

  const tabOptions = useMemo(() => getTabOptions(dmdChairmanCondition), [dmdChairmanCondition]);

  const [tabInfoView, setTabInfoView] = useState(() => sessionStorage.getItem("tabInfoView") || "fya");
  const [selectedCase, setSelectedCase] = useState(null);

  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [popups, setPopups] = useState({ acquire: false, pushBack: false, movementRegister: false });

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [inputTaskName, setInputTaskName] = useState("FYA");

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const [filterSearchParams, setFilterSearchParams] = useState(null);

  // Ref always holds the latest state values — avoids stale closure in handleViewCase useCallback
  const currentStateRef = useRef({});
  currentStateRef.current = { tabInfoView, dataState, filterSearchParams, currentPage, inputTaskName };

  const saveStateToStorage = () => {
    const state = currentStateRef.current;
    localStorage.setItem(getStorageKey(), JSON.stringify({ ...state, fromViewCase: true, timestamp: Date.now() }));
  };

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

  const handleMovementRegister = useCallback(
    async (props) => {
      const caseData = props?.dataItem;

      if (caseData?.folder_id) {
        setSelectedCase(caseData);

        const response = await dispatch(
          fetchMovementRegister({
            input_parent_folders: caseData.folder_id,
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
          dispatch(resetPagination());
          dispatch(
            fetchInboxCases({
              input_task_name: inputTaskName,
              ...(newActiveFilters || {}),
              page: 1,
              "items-per-page": DEFAULT_PAGE_SIZE,
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
          fetchInboxCases({
            input_task_name: inputTaskName,
            ...(filterSearchParams || {}),
            page: newPage,
            "items-per-page": DEFAULT_PAGE_SIZE,
          }),
        );
      }
    },
    [currentPage, inputTaskName, dispatch, dataState.filter, filterSearchParams],
  );

  const handleViewCase = useCallback(
    (item) => {
      if (item?.dataItem?.folder_id) {
        saveStateToStorage();
        navigate(`/view-case/${item?.dataItem?.folder_id}`, {
          state: {
            path: "inboxCase",
            screenName: "inboxScreen",
            itemId: item?.dataItem?.item_id,
            workflowLinks: item?.dataItem?.links,
            isInitiateWorkflow: true,
            acquireStatus: item?.dataItem?.acquire_status,
            folderId: item?.dataItem?.folder_id,
            caseStatus: item?.dataItem?.case_status,
            rModifier: item?.dataItem?.r_modifier,
            autoNumOutput: item?.dataItem?.case_name,
            rCreatorName: item?.dataItem?.r_creator_name,
            param_department: item?.dataItem?.param_department,
          },
        });
      }
    },
    [navigate],
  );

  const CaseNumberCell = useCallback(
    (props) => (
      <td>
        <button
          className="case-number-span cursor-pointer border-0 bg-transparent text-start"
          onClick={() => handleViewCase(props)}
          aria-label={`View case ${props.dataItem.case_name}`}
        >
          {props.dataItem.case_name}
        </button>
      </td>
    ),
    [handleViewCase],
  );

  const DateCell = (props) => <td>{formatDateCell(props.dataItem.task_date_sent)}</td>;

  const handlePushback = useCallback(
    async (props) => {
      const caseData = props?.dataItem;

      if (caseData?.folder_id) {
        setSelectedCase(caseData);

        const response = await dispatch(
          fetchMovementRegister({
            input_parent_folders: caseData.folder_id,
          }),
        );

        if (response.type === "viewCases/fetchMovementRegister/fulfilled") {
          const registerData = response.payload;

          const isPushBack = Array.isArray(registerData) && registerData.length > 0 && registerData[registerData.length - 1]?.content?.properties?.decision === "Push Back";

          if (!isPushBack) {
            setPopups((prev) => ({ ...prev, pushBack: true }));
          } else {
            Swal.fire({
              icon: "warning",
              text: "Case is already being pushed back, hence further pushback is not allowed",
            });
          }
        }
      }
    },
    [dispatch],
  );

  const CaseActionCell = useCallback(
    (props) => {
      const acquireStatus = props.dataItem.acquire_status;
      const isAcquired = acquireStatus !== 0;
      const iconColor = isAcquired ? "red" : "#0d6efd";
      const showPushbackBtn = object_name === props.dataItem.r_creator_name;
      const isApproved = props.dataItem.case_status?.toLowerCase() === "approved";
      const isPushbackDisabled = isAcquired || isApproved || showPushbackBtn;

      return (
        <td>
          <div className="d-flex align-items-center">
            <button className="icon-wrapper icon-clickable me-1 border-0" onClick={() => handleMovementRegister(props)} title="Movement Register" aria-label="Movement Register">
              <FaClipboardList size="14px" color="#5e9bf7" />
            </button>

            <button
              className={`icon-wrapper me-1 border-0 ${isAcquired ? "acquire-icon-disabled" : "acquire-icon-clickable"}`}
              onClick={!isAcquired ? () => togglePopup("acquire", props) : undefined}
              title={isAcquired ? "Already Acquired" : "Acquire"}
              aria-label={isAcquired ? "Already Acquired" : "Acquire"}
            >
              <FaUserCheck size="12px" color={isAcquired ? "#f08c92" : "#0d6efd"} />
            </button>

            {!isPushbackDisabled && (
              <button className="icon-wrapper border-0 icon-clickable" onClick={() => handlePushback(props)} title="Push Back" aria-label="Push Back">
                <GrRevert size="14px" color={iconColor} />
              </button>
            )}
          </div>
        </td>
      );
    },
    [object_name, handleMovementRegister, togglePopup, handlePushback],
  );

  const mappedData = useMemo(() => {
    return (
      inboxCases?.map((caseItem) => {
        const {
          task_name,
          packagesworkflow_paramtask_received,
          id,
          task_sent_by,
          task_state,
          packagescase_folderr_creator_name,
          process_system_name,
          packagescase_folderid,
          packagescase_folderobject_name,
          packagescase_folderstatus,
          packagescase_folderdescription,
          packagescase_department_name,
          packagescase_foldertask_priority,
          packagesworkflow_paramdepartment,
        } = caseItem?.content?.properties ?? {};

        const links = caseItem?.content?.links ?? [];
        const selfLink = links.find((link) => link.rel === "self")?.href;

        return {
          task_name,
          task_date_sent: packagesworkflow_paramtask_received,
          item_id: id,
          task_sender: task_sent_by,
          acquire_status: task_state,
          links: selfLink,
          r_modifier: packagescase_folderr_creator_name,
          process_name: process_system_name,
          folder_id: packagescase_folderid,
          case_name: packagescase_folderobject_name,
          case_status: packagescase_folderstatus,
          case_subject: packagescase_folderdescription,
          department: packagescase_department_name,
          case_priority: packagescase_foldertask_priority,
          r_creator_name: packagescase_folderr_creator_name,
          param_department: packagesworkflow_paramdepartment,
        };
      }) ?? []
    );
  }, [inboxCases]);

  // For server-side pagination, we don't process skip/take on client
  const processedData = useMemo(() => {
    const clientSideState = { sort: dataState.sort };
    const result = process(mappedData, clientSideState);
    result.total = pagination.total;
    return result;
  }, [mappedData, dataState.sort, pagination.total]);

  // const taskPerformerOptions = useMemo(
  //   () =>
  //     Array.from(new Set((Array.isArray(mappedData) ? mappedData : []).map((item) => item.r_modifier)))
  //       .filter(Boolean)
  //       .toSorted(),
  //   [mappedData],
  // );

  useEffect(() => {
    if (isRestoringStateRef.current) return;

    let input_task_name = "";

    if (tabInfoView === "fya") {
      input_task_name = "FYA";
    } else {
      if (department_short_code === "dmds1") {
        input_task_name = "To be Verified DMDS1";
      } else if (department_short_code === "dmds2") {
        input_task_name = "To be Verified DMDS2";
      } else if (department_short_code === "chmns") {
        input_task_name = "To be Verified Chairman";
      } else {
        input_task_name = "FYA";
      }
    }

    // Reset pagination when tab changes
    setInputTaskName(input_task_name);
    setCurrentPage(1);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE }));
    dispatch(resetPagination());

    dispatch(
      fetchInboxCases({
        input_task_name,
        page: 1,
        "items-per-page": DEFAULT_PAGE_SIZE,
      }),
    );
  }, [department_short_code, tabInfoView, dispatch]);

  // State restoration effect - check for saved state on mount
  useEffect(() => {
    if (!fromViewCaseNavigation) return;
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved.fromViewCase || Date.now() - saved.timestamp >= 30 * 60 * 1000) return;

      isRestoringStateRef.current = true;
      setTabInfoView(saved.tabInfoView || "fya");
      setDataState(saved.dataState || { sort: [{ field: "id", dir: "asc" }], skip: 0, take: DEFAULT_PAGE_SIZE, filter: null });
      setFilterSearchParams(saved.filterSearchParams || null);
      setCurrentPage(saved.currentPage || 1);
      setInputTaskName(saved.inputTaskName || "FYA");

      dispatch(resetPagination());
      dispatch(
        fetchInboxCases({
          input_task_name: saved.inputTaskName || "FYA",
          ...(saved.filterSearchParams || {}),
          page: saved.currentPage || 1,
          "items-per-page": DEFAULT_PAGE_SIZE,
        }),
      );

      clearStateFromStorage();
      // Reset after React has committed the state updates and re-run effects (runs before this macrotask)
      setTimeout(() => {
        isRestoringStateRef.current = false;
      }, 100);
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    sessionStorage.setItem("tabInfoView", tabInfoView);
  }, [tabInfoView]);

  const handleCloseMovementRegister = useCallback(() => {
    setPopups((prev) => ({ ...prev, movementRegister: false }));
    setMovementRegisterData([]);
  }, []);

  const handleCloseAcquire = useCallback(() => togglePopup("acquire"), [togglePopup]);
  const handleClosePushBack = useCallback(() => togglePopup("pushBack"), [togglePopup]);

  return (
    <Layout movementPop={popups?.movementRegister}>
      <div className="d-flex align-items-center justify-content-between">
        <div className="inbox-tab-container">
          <header className="inbox-header">
            <div className="inbox-tabs" role="tablist">
              {tabOptions?.map(({ key, label }) => (
                <div key={key} className={`inbox-tab-item ${key === tabInfoView ? "active" : ""}`}>
                  <button type="button" role="tab" title={label} aria-selected={key === tabInfoView} className="inbox-tab-btn" onClick={() => setTabInfoView(key)}>
                    {key === tabInfoView && (
                      <motion.div
                        className="active-highlight"
                        layoutId="highlight"
                        transition={{
                          layout: {
                            duration: 0.3,
                            ease: "easeInOut",
                          },
                        }}
                      />
                    )}
                    {key !== tabInfoView && <div className="passive-highlight"></div>}
                    <span>{label}</span>
                  </button>
                </div>
              ))}
            </div>
          </header>
        </div>
      </div>

      <div className="inbox-sent-draft-grid">
        <Grid
          {...dataState}
          data={loading ? { data: SKELETON_ROWS, total: processedData.total } : processedData}
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
            width={windowSize?.width > 1440 ? "200px" : "130px"}
            minResizableWidth={100}
            field="case_name"
            title="Case Number"
            cells={{ data: loading ? Skeleton : CaseNumberCell }}
          />
          <GridColumn
            width={windowSize?.width > 1024 ? "" : "160px"}
            minResizableWidth={100}
            field="case_subject"
            title="Case Subject"
            cells={{ data: loading ? Skeleton : CaseSubjectCell }}
          />
          <GridColumn
            width={windowSize?.width > 1440 ? "160px" : "140px"}
            minResizableWidth={100}
            field="task_date_sent"
            title="Sent Date"
            cells={{
              filterCell: (props) => (
                <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                  <DatePickerFilterCell {...props} />
                </HeaderTdElement>
              ),
              data: loading ? Skeleton : DateCell,
            }}
          />
          <GridColumn
            width={windowSize?.width > 1440 ? "140px" : "120px"}
            minResizableWidth={100}
            field="task_sender"
            title="Received from/ Sent By"
            cells={{ data: loading ? Skeleton : undefined }}
          />
          <GridColumn
            width="120px"
            minResizableWidth={100}
            field="case_status"
            title="Case Status"
            cells={{
              filterCell: (props) => (
                <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                  <DropdownFilterCell {...props} data={caseStatusOptions} />
                </HeaderTdElement>
              ),
              data: loading ? Skeleton : undefined,
            }}
          />
          <GridColumn
            width="120px"
            minResizableWidth={90}
            field="case_priority"
            title="Case Priority"
            cells={{
              filterCell: (props) => (
                <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                  <DropdownFilterCell {...props} data={casePriorityOptions} />
                </HeaderTdElement>
              ),
              data: loading ? Skeleton : CasePriorityCell,
            }}
          />
          <GridColumn
            width={windowSize?.width > 1440 ? "130px" : "110px"}
            minResizableWidth={100}
            field="task_name"
            title="Task Name"
            cells={{
              filterCell: (props) => (
                <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                  <DropdownFilterCell {...props} data={taskNameOptions} />
                </HeaderTdElement>
              ),
              data: loading ? Skeleton : undefined,
            }}
          />
          <GridColumn width="100px" title="Action" sortable={false} resizable={false} filterable={false} cells={{ data: loading ? Skeleton : CaseActionCell }} />
        </Grid>
      </div>

      <AcquirePopup
        screen="inbox"
        folderId={selectedCase?.folder_id}
        gridData={selectedCase}
        visible={popups.acquire}
        caseName={selectedCase?.case_name}
        workflowLinks={selectedCase?.links}
        onClose={handleCloseAcquire}
      />

      <PushBackPopup
        screen="inbox"
        visible={popups.pushBack}
        itemId={selectedCase?.item_id}
        folderId={selectedCase?.folder_id}
        rCreatorName={selectedCase?.r_creator_name}
        onClose={handleClosePushBack}
      />

      <MovementRegister visible={popups.movementRegister} movementRegisterData={movementRegisterData} onClose={handleCloseMovementRegister} />
    </Layout>
  );
}
