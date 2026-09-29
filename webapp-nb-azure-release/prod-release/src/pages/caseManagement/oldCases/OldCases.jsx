import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Custom components
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import MovementRegister from "../viewCase/movementRegister/MovementRegister";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../components/datePickerFilterCell/DatePickerFilterCell";

// Routing
import { useNavigate } from "react-router-dom";

//kendo components
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { RadioGroup } from "@progress/kendo-react-inputs";
import { ComboBox } from "@progress/kendo-react-dropdowns";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

// Icons
import { RiResetLeftLine } from "react-icons/ri";
import { FaFileExport, FaSearch, FaClipboardList } from "react-icons/fa";

//utils
import { formatLanguage, formatDateTimeParam, formatDateCell } from "../../../utils/Utils";

// Alerts
import Swal from "sweetalert2";

//dropdown data
import { caseLanguageOptions, casePriorityOptions, caseStatusOptions, natureOfCaseOptions, options, sixGroups, teDataList, teOptions } from "../../data/DropdownData";

//redux slice
import { useDispatch, useSelector } from "react-redux";
import { dashboardService } from "../../../services/dashboard/dashboardService";
import { viewCaseService } from "../../../services/caseManagement/viewCase/ViewCaseService";
import { fetchMovementRegister } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";
import { fetchViewCases, DEFAULT_PAGE_SIZE, resetViewCasesPagination } from "../../../redux/caseManagement/viewCase/viewCaseSlice";
import ivTokenManager from "../../../services/iv/tokenManager";

const FILTER_FIELD_MAP = {
  case_name: "input_name",
  case_subject: "input_description",
  nature_of_case: "input_case_nature",
  created_on: "input_old_created_after",
  created_by: "input_old_created_by",
  case_status: "input_status",
  case_priority: "input_task_priority",
  language_type: "input_language_type",
};

// Text fields use a debounce to avoid firing on every keystroke; dropdowns fire immediately
const TEXT_FILTER_FIELDS = new Set(["case_name", "case_subject"]);

// Date fields require ISO string formatting before being sent to the API
const DATE_FILTER_FIELDS = new Set(["created_on"]);

const OldCases = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const excelExportRef = useRef(null);
  const filterDebounceRef = useRef(null);

  const { viewCases, loading, pagination } = useSelector((state) => state?.viewCases);

  const { userProfile, dmdChairmanCondition } = useSelector((state) => state?.login);
  const { dashboardVerticals } = useSelector((state) => state.dashboard);
  const { office_type, department_short_code, ro_short_code, department_short_code_multi } = userProfile?.properties || {};
  const foundConditionMatch = sixGroups?.some((group) => dmdChairmanCondition?.includes(group));

  const sortedDashboardVerticals = useMemo(
    () => [...(dashboardVerticals || [])].sort((a, b) => a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" })),
    [dashboardVerticals],
  );

  const verticalNames = useMemo(() => sortedDashboardVerticals?.filter((item) => item.text !== "Assigned Verticals")?.map((item) => item.value), [sortedDashboardVerticals]);

  const [selectedValue, setSelectedValue] = useState("allCase");
  const [selectRadioDropData, setSelectRadioDropData] = useState("");
  const [popups, setPopups] = useState({ movementRegister: false });
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [regionDeptName, setRegionDeptName] = useState([]);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [createdByOptions, setCreatedByOptions] = useState([]);

  // Current page number for server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchParams, setFetchParams] = useState(null);

  // Active column filter params — merged with fetchParams on each paginated request
  const [filterSearchParams, setFilterSearchParams] = useState(null);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

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
          result["input_old_created_before"] = `${dateStr}T23:59:59`;
        } else if (f.field === "language_type") {
          result[apiKey] = f.value.charAt(0).toUpperCase();
        } else {
          result[apiKey] = f.value;
        }
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

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

      // No filter change — handle page navigation
      if (newPage !== currentPage && fetchParams) {
        setCurrentPage(newPage);
        dispatch(fetchViewCases({ ...fetchParams, ...(filterSearchParams || {}), page: newPage, "items-per-page": DEFAULT_PAGE_SIZE }));
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage, fetchParams, dispatch, dataState.filter, filterSearchParams],
  );

  // Builds search params from the date pickers and office/region selectors, then fetches page 1
  const handleSearch = () => {
    const params = {
      input_old_created_after: formatDateTimeParam(fromDate),
      input_old_created_before: formatDateTimeParam(toDate, true),
      input_is_migrated: true,
    };

    let hoRoValue = "";
    let departmentCode;

    if (foundConditionMatch) {
      // DMD/Chairman users can scope by all cases, a specific HO dept, or an RO/TE region
      if (selectedValue === "allCase") {
        departmentCode = "";
      } else if (selectedValue === "hoDept") {
        hoRoValue = office_type;
        departmentCode = selectRadioDropData?.value;
      } else if (teDataList.includes(selectRadioDropData?.text)) {
        hoRoValue = "TE";
      } else {
        hoRoValue = "RO";
      }

      params.input_ho_ro = hoRoValue;

      if (departmentCode) {
        params.input_department_short_co = departmentCode;
      }

      if (selectedValue === "roteDept") {
        params.input_location = selectRadioDropData?.text;
      }
    } else {
      params.input_ho_ro = office_type;

      if (office_type === "HO") {
        params.input_department_short_co = department_short_code;
        params.input_function_short_code = verticalNames;
      } else {
        params.input_title = ro_short_code;
      }
    }

    setFetchParams(params);
    setCurrentPage(1);
    setFilterSearchParams(null);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE, filter: null }));
    dispatch(resetViewCasesPagination());
    dispatch(fetchViewCases({ ...params, page: 1, "items-per-page": DEFAULT_PAGE_SIZE }));
  };

  // Navigates to the old case viewer. Pre-warms the IV token to reduce viewer load time.
  const handleViewCase = useCallback(
    (item) => {
      if (item?.dataItem?.folder_id) {
        // Pre-warm the IV token so it is cached by the time the viewer mounts.
        // init() is fire-and-forget and safe to call multiple times.
        ivTokenManager.init();
        navigate(`/view-old-case/${item?.dataItem?.folder_id}`, {
          state: {
            path: "oldCases",
            screenName: "caseScreen",
            folderId: item?.dataItem?.folder_id,
            caseStatus: item?.dataItem?.case_status,
            autoNumOutput: item?.dataItem?.case_name,
            isInitiateWorkflow: item?.dataItem?.in_workflow,
          },
        });
      }
    },
    [navigate],
  );

  // Renders the case number as a clickable link that opens the case viewer
  const CaseNumberCell = (props) => {
    const caseNumber = props?.dataItem?.case_name;
    return (
      <td className="case-number-span cursor-pointer mb-0 fw-bold" onClick={() => handleViewCase(props)}>
        {caseNumber}
      </td>
    );
  };

  const CasePriorityCell = (props) => {
    const priority = props?.dataItem?.case_priority;

    if (!priority) {
      return <td />;
    }

    const classMap = {
      Urgent: "priority-urgent",
      Secret: "priority-immediate",
    };

    const priorityClass = classMap[priority] || "priority-default";

    return (
      <td>
        <div className={`case-priority-td ${priorityClass}`}>{priority}</div>
      </td>
    );
  };

  const NatureOfCaseCell = (props) => {
    const natureOfCase = props.dataItem.nature_of_case;

    const classMap = {
      Regular: "natureOfCase-regular",
      Confidential: "natureOfCase-confidential",
      Secret: "natureOfCase-secret",
    };
    const priorityClass = classMap[natureOfCase];

    return (
      <td>
        <div className={`case-priority-td ${priorityClass}`}>{natureOfCase}</div>
      </td>
    );
  };

  const handleMovementRegister = useCallback(
    async (props) => {
      const caseData = props?.dataItem;

      if (caseData?.folder_id) {
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

  const MovementRegisterCell = (props) => {
    return (
      <td>
        <div className="d-flex align-items-center justify-content-center">
          <button className="icon-wrapper icon-clickable border-0" onClick={() => handleMovementRegister(props)} title="Movement Register">
            <FaClipboardList size="14px" color="#5e9bf7" />
          </button>
        </div>
      </td>
    );
  };

  const DateCell = (props) => <td>{formatDateCell(props.dataItem.created_on)}</td>;

  const handleExport = () => {
    if (excelExportRef.current && processedData?.data?.length > 0) {
      excelExportRef.current.save(processedData);
    } else {
      Swal.fire({
        icon: "warning",
        title: "Nothing to export",
        text: "There is no data available to export right now.",
      });
    }
  };

  const skeletonRows = Array.from({ length: 25 })?.map((_, index) => ({
    id: index,
    case_name: " ",
    case_subject: " ",
    nature_of_case: " ",
    case_priority: " ",
    created_on: " ",
    created_by: " ",
    case_status: " ",
  }));

  const mappedData = useMemo(() => {
    const mapCases = (cases) =>
      cases?.map((caseItem) => {
        const {
          object_name,
          description,
          case_nature,
          task_priority,
          created_on,
          created_by,
          status,
          id,
          is_resubmitted,
          in_workflow,
          language_type,
          ho_ro,
          department_short_code,
        } = caseItem?.content?.properties ?? {};

        return {
          case_name: object_name,
          case_subject: description,
          nature_of_case: case_nature,
          case_priority: task_priority,
          created_on: created_on,
          created_by: created_by,
          case_status: status,
          folder_id: id,
          is_resubmitted,
          in_workflow,
          language_type: formatLanguage(language_type),
          ho_ro,
          department_short_code,
        };
      }) ?? [];

    return mapCases(viewCases);
  }, [viewCases]);

  const processedData = useMemo(() => {
    const result = process(mappedData, { sort: dataState.sort });
    result.total = pagination.total;
    return result;
  }, [mappedData, dataState.sort, pagination.total]);

  // Fetches old cases whenever the user's office context or radio/dropdown selection changes.
  useEffect(() => {
    const today = new Date();
    const priorDate = new Date();
    priorDate.setDate(today.getDate() - 30);

    // Extracted logic (fixes S3358)
    let inputHoRo = office_type;

    if (foundConditionMatch) {
      if (selectedValue === "allCase") {
        inputHoRo = "";
      } else if (selectedValue === "hoDept") {
        inputHoRo = office_type;
      } else if (teDataList.includes(selectRadioDropData?.text)) {
        inputHoRo = "TE";
      } else {
        inputHoRo = "RO";
      }
    }

    const params = {
      input_ho_ro: inputHoRo,
      input_is_migrated: true,

      ...(foundConditionMatch && {
        ...(selectedValue === "allCase" && {
          input_department_short_co: "",
        }),

        ...(selectedValue === "hoDept" && {
          input_department_short_co: selectRadioDropData?.value,
        }),

        ...(selectedValue === "roteDept" && {
          input_location: selectRadioDropData?.text,
        }),
      }),

      ...(!foundConditionMatch &&
        (office_type === "HO"
          ? { input_department_short_co: department_short_code, input_function_short_code: verticalNames }
          : { input_department_short_co: department_short_code_multi, input_title: ro_short_code })),
    };

    setFetchParams(params);
    setCurrentPage(1);
    setFilterSearchParams(null);
    setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE, filter: null }));
    dispatch(resetViewCasesPagination());
    dispatch(fetchViewCases({ ...params, page: 1, "items-per-page": DEFAULT_PAGE_SIZE }));
  }, [office_type, department_short_code, department_short_code_multi, ro_short_code, selectedValue, selectRadioDropData, dispatch, foundConditionMatch, verticalNames]);

  useEffect(() => {
    const fetchDepartments = async () => {
      setSelectRadioDropData("");

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
        console.error("Failed to fetch region: ", err);
      }
    };

    if (selectedValue === "roteDept" || selectedValue === "hoDept") {
      fetchDepartments();
    }
  }, [selectedValue]);

  useEffect(() => {
    if (!fetchParams) return;
    const fetchCreatedByOptions = async () => {
      const data = await viewCaseService.getOldCasesCreatedBy({
        input_ho_ro: fetchParams.input_ho_ro ?? "",
        input_department_short_co: department_short_code_multi.join(",") ?? "",
      });
      const options = Array.from(new Set(data.map((item) => item.created_by).filter(Boolean)));
      setCreatedByOptions(options);
    };
    fetchCreatedByOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchParams]);

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

  return (
    <Layout movementPop={popups?.movementRegister}>
      <div className="d-flex align-items-center justify-content-between my-2">
        {foundConditionMatch ? (
          <div className="d-flex align-items-center justify-content-between">
            <RadioGroup className="radio-btn-text" layout="horizontal" data={options} value={selectedValue} onChange={(e) => setSelectedValue(e.value)} />
            {selectedValue !== "allCase" && (
              <ComboBox
                data={regionDeptName.filter((item) => item?.text && item?.value)}
                textField="text"
                dataItemKey="value"
                value={selectRadioDropData}
                placeholder=" select ..."
                onChange={(e) => setSelectRadioDropData(e.value)}
                className="width-150 ms-2"
              />
            )}
          </div>
        ) : (
          <h6 className="case-title-h6">Old Cases</h6>
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
            <FaSearch size="14px" />
          </Button>

          {(fromDate || toDate) && (
            <Button
              type="button"
              className="master-search-btn"
              aria-label="Clear dates"
              onClick={() => {
                setFromDate(null);
                setToDate(null);
              }}
            >
              <RiResetLeftLine size="14px" />
            </Button>
          )}

          <Button className="export-to-excel" onClick={handleExport}>
            <div className="d-flex align-items-center font-size-12">
              <FaFileExport className="me-1" /> Export
            </div>
          </Button>
        </div>
      </div>

      <div className="old-case-grid">
        <ExcelExport data={processedData} fileName="Old_Cases_List.xlsx" ref={excelExportRef}>
          <Grid
            {...dataState}
            data={loading ? skeletonRows : processedData}
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
              width={windowSize?.width > 1440 ? "210px" : "130px"}
              minResizableWidth={100}
              field="case_name"
              title="Case Number"
              filterable={true}
              cells={{ data: loading ? Skeleton : CaseNumberCell }}
            />
            <GridColumn
              width={windowSize?.width > 1024 ? "" : "130px"}
              minResizableWidth={100}
              field="case_subject"
              title="Case Subject"
              filterable={true}
              cells={{ data: loading ? Skeleton : undefined }}
            />
            <GridColumn
              width={windowSize?.width > 1440 ? "150px" : "130px"}
              minResizableWidth={100}
              field="nature_of_case"
              title="Nature of Case"
              filterable={true}
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={natureOfCaseOptions} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : NatureOfCaseCell,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1440 ? "160px" : "200px"}
              minResizableWidth={100}
              field="created_on"
              title="Created On"
              filterable={true}
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
              width={windowSize?.width > 1440 ? "160px" : "100px"}
              minResizableWidth={100}
              field="created_by"
              title="Created By"
              filterable={true}
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={createdByOptions} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : undefined,
              }}
            />
            <GridColumn
              width={windowSize?.width > 1440 ? "140px" : "100px"}
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
              width={windowSize?.width > 1367 ? "120px" : "110px"}
              minResizableWidth={120}
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
              width={windowSize?.width > 1367 ? "100px" : "80px"}
              minResizableWidth={120}
              field="language_type"
              title="Language"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={caseLanguageOptions} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : undefined,
              }}
            />
            <GridColumn
              width="45px"
              title="MR"
              headerCell={() => <span title="Movement Register">MR</span>}
              sortable={false}
              resizable={false}
              filterable={false}
              cells={{ data: loading ? Skeleton : MovementRegisterCell }}
            />
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
};

export default OldCases;
