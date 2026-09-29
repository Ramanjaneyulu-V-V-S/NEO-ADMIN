import { useState, useEffect, useCallback } from "react";

// router
import { useNavigate, useLocation } from "react-router-dom";

//react icons
import { FaClipboardList } from "react-icons/fa6";
import { IoFileTrayFull } from "react-icons/io5";

// components
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import MovementRegister from "../viewCase/movementRegister/MovementRegister";
import FileNumberDialog from "../../../components/fileNumberDialog/FileNumberDialog";

// kendo
import { process } from "@progress/kendo-data-query";
import { Label } from "@progress/kendo-react-labels";
import { Avatar } from "@progress/kendo-react-layout";
import { Input } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Grid, GridColumn } from "@progress/kendo-react-grid";

//utils
import { fromAndToDateFormat, getPriorityClass, themeColor, formatDateCell } from "../../../utils/Utils";

// redux
import { useDispatch, useSelector } from "react-redux";
import { fetchDepartments } from "../../../redux/dashboard/dashboardSlice";
import { searchCase, searchInDoc, DEFAULT_PAGE_SIZE, resetSearchPagination } from "../../../redux/caseManagement/searchCase/searchCaseSlice";
import { fetchMovementRegister } from "../../../redux/caseManagement/caseDetails/caseDetailsSlice";
import { fetchFileNumbers, fetchVertical } from "../../../redux/caseManagement/createCase/createCaseSlice";

// axios
import { dashboardService } from "../../../services/dashboard/dashboardService";

const SearchCase = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { fromViewCase: fromViewCaseNavigation } = routerLocation.state || {};
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state?.login);
  const { department_short_code, ro_short_code, office_type, department_name, location } = userProfile?.properties || {};

  const { caseTypes, fileNumbers, fileNumbersPagination, loading: fileNumbersLoading } = useSelector((state) => state.createCase);
  const { searchResult, pagination } = useSelector((state) => state.searchCases);

  const DEFAULT_FORM_DATA = {
    department: null,
    vertical: "",
    caseLanguage: "",
    caseType: "",
    casePriority: "",
    natureOfCase: "",
    disposalLevel: "",
    subject: "",
    fileNumber: "",
    fromDate: null,
    r_creator_name: null,
    toDate: null,
    caseNumber: "",
    notesheetSearch: "",
    roTe: null,
  };

  const STORAGE_KEY = "searchCaseFilters";

  const IsStorageKeyTrue = localStorage.getItem(STORAGE_KEY);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const teDropdownNames = formData?.roTe?.value === "nc" || formData?.roTe?.value === "bm" || formData?.roTe?.value === "bl" || formData?.roTe?.value === "bk";

  const [selectedFileNumber, setSelectedFileNumber] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [processedDataCount, setProcessedDataCount] = useState();

  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileNoPop, setFileNoPop] = useState(false);
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [popups, setPopups] = useState({ movementRegister: false });

  //search dropdown filter
  const [filteredCaseTypes, setFilteredCaseTypes] = useState([]);
  const [filteredCreatedBy, setFilteredCreatedBy] = useState([]);
  const [roTeOptions, setRoTeOptions] = useState([]);
  const [getAllDept, setGetAllDept] = useState([]);

  const [filteredRoTeOptions, setFilteredRoTeOptions] = useState([]);
  const [filteredDepartmentOptions, setFilteredDepartmentOptions] = useState([]);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSearchParams, setLastSearchParams] = useState(null);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fetchRoTeOptions = useCallback(async () => {
    try {
      const response = await dashboardService.getDepartments({
        input_folder: `/ECM CONFIG/Office Type/RO`,
      });

      const roOptions =
        response?.entries?.map((entry) => ({
          text: entry?.content?.properties?.object_name,
          value: entry?.content?.properties?.title,
        })) || [];

      const teResponse = await dashboardService.getDepartments({
        input_folder: `/ECM CONFIG/Office Type/TE`,
      });

      const teOptions =
        teResponse?.entries?.map((entry) => ({
          text: entry?.content?.properties?.object_name,
          value: entry?.content?.properties?.title,
        })) || [];

      setRoTeOptions([...roOptions, ...teOptions]);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const getThemeColor = (name = "") => themeColor[(name.length - 1) % themeColor?.length] || "inverse";

  const CaseNumberCell = (props) => (
    <td>
      <button className="case-number-span cursor-pointer border-0 bg-transparent text-start" onClick={() => handleViewCase(props)}>
        {props?.dataItem?.case_name}
      </button>
    </td>
  );

  const handleViewCase = useCallback(
    (props) => {
      if (props?.dataItem?.folder_id) {
        navigate(`/view-case/${props?.dataItem.folder_id}`, {
          state: {
            path: "searchCase",
            screenName: "caseScreen",
            folderId: props?.dataItem.folder_id,
            caseStatus: props?.dataItem?.case_status,
            autoNumOutput: props?.dataItem?.case_name,
            isInitiateWorkflow: props?.dataItem?.in_workflow,
          },
        });
      }
    },
    [navigate],
  );

  const CreatedByCell = (props) => {
    const { r_creator_name, r_creation_date } = props.dataItem;
    return (
      <td>
        <div className="d-flex align-items-center gap-2">
          <Avatar themeColor={getThemeColor(r_creator_name)} type="text">
            {r_creator_name?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <p className="mb-0">{r_creator_name}</p>
            <span className="mb-0">{formatDateCell(r_creation_date)}</span>
          </div>
        </div>
      </td>
    );
  };

  const CasePriorityCell = (props) => {
    const priority = props.dataItem.case_priority;
    const priorityClass = getPriorityClass(priority);

    return (
      <td>
        <div className={`case-priority-td ${priorityClass}`}>{priority}</div>
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
        <button className="icon-wrapper icon-clickable border-0" onClick={() => handleMovementRegister(props)} title="Movement Register">
          <FaClipboardList size="14px" color="#5e9bf7" />
        </button>
      </td>
    );
  };

  const handleDataStateChange = useCallback(
    async (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);

      // Calculate page number from skip/take for server-side pagination
      const newPage = Math.floor(newDataState.skip / DEFAULT_PAGE_SIZE) + 1;

      // Only fetch from server if page changed and we have search params
      if (newPage !== currentPage && lastSearchParams) {
        setCurrentPage(newPage);
        const res = await dispatch(
          searchCase({
            ...lastSearchParams,
            page: newPage,
            "items-per-page": DEFAULT_PAGE_SIZE,
          }),
        );
        setSearchResults(res?.payload?.entries || []);
      }
    },
    [currentPage, lastSearchParams, dispatch],
  );

  const fetchCases = useCallback(
    async (params) => {
      setIsLoading(true);
      setLastSearchParams(params);

      try {
        const res = await dispatch(searchCase(params));
        setSearchResults(res?.payload?.entries || []);
        setIsLoading(false);
      } catch (e) {
        console.error(e);
        setIsLoading(false);
      }
    },
    [dispatch],
  );

  const getInitialSearchParams = useCallback(() => {
    return {
      inline: true,
      input_ho_ro: formData?.department ? "HO" : formData?.roTe ? (teDropdownNames ? "TE" : "RO") : "",
      input_created_on: null,
      input_created_on_: null,
      input_function_short_code: null,
      input_department_short_co: "",
      input_name: null,
      input_type: null,
      input_file_number: null,
      input_description: "",
      input_created_by: "",
      input_status: "",
      page: 1,
      start: 0,
      "items-per-page": DEFAULT_PAGE_SIZE,
    };
  }, [office_type, department_short_code]);

  const handleSearch = async (isSearchClicked = false) => {
    if (isSearchClicked) {
      setIsLoading(true);
      setHasSearched(true);
      // Reset pagination on new search
      setCurrentPage(1);
      setDataState((prev) => ({ ...prev, skip: 0, take: DEFAULT_PAGE_SIZE }));
      dispatch(resetSearchPagination());
    }

    const { caseNumber, fromDate, toDate, subject, caseType, vertical, r_creator_name, fileNumber, department, notesheetSearch, roTe } = formData;

    try {
      let folderIds = [];

      // If notesheet search has value, first call searchInDoc API
      if (notesheetSearch && notesheetSearch.trim() !== "") {
        const searchInDocParams = {
          inline: true,
          input_fulltextkey1: notesheetSearch.trim(),
          input_fulltextkey2: notesheetSearch.trim(),
          page: 1,
          start: 0,
          "items-per-page": 50,
        };

        const docSearchRes = await dispatch(searchInDoc(searchInDocParams));

        if (docSearchRes?.payload?.entries && docSearchRes.payload.entries.length > 0) {
          // Extract folder IDs from the response
          folderIds = docSearchRes.payload.entries
            .map((entry) => {
              const parentId = entry?.content?.properties?.i_folder_id;
              const docId = entry?.content?.properties?.id;
              return parentId || docId; // Use parent folder ID if available, otherwise document ID
            })
            .filter(Boolean);

          // Remove duplicates
          folderIds = [...new Set(folderIds)];

          // If no IDs found, return empty results
          if (folderIds.length === 0) {
            setSearchResults([]);
            if (isSearchClicked) setIsLoading(false);
            return;
          }
        } else {
          // No documents found matching the notesheet search
          setSearchResults([]);

          if (isSearchClicked) setIsLoading(false);
          return;
        }
      }

      let res;

      if (folderIds.length > 0) {
        // Build URL with multiple input_object_id_ params
        const params = new URLSearchParams({
          inline: true,
          input_ho_ro: formData?.department ? "HO" : formData?.roTe ? (teDropdownNames ? "TE" : "RO") : "",
          input_location: roTe?.text || "",
          input_created_on: fromAndToDateFormat(fromDate) || "",
          input_created_on_: fromAndToDateFormat(toDate) || "",
          input_function_short_code: vertical?.value || "",
          input_department_short_co: department?.value || "",
          input_name: caseNumber || "",
          input_type: caseType?.text || "",
          input_file_number: selectedFileNumber?.value ?? fileNumber?.value ?? "",
          input_description: subject ?? "",
          input_created_by: r_creator_name?.text ?? "",
          input_status: "",
          page: 1,
          start: 0,
          "items-per-page": DEFAULT_PAGE_SIZE,
        });

        // Add multiple input_object_id_ params
        folderIds.forEach((id) => params.append("input_object_id_", id));
        setLastSearchParams(Object.fromEntries(params));
        const response = await dispatch(searchCase(params));
        res = { payload: response.data };
      } else {
        // Normal search without notesheet filter
        const searchParams = {
          inline: true,
          input_ho_ro: formData?.department ? "HO" : formData?.roTe ? (teDropdownNames ? "TE" : "RO") : "",
          input_location: roTe?.text || "",
          input_created_on: fromAndToDateFormat(fromDate),
          input_created_on_: fromAndToDateFormat(toDate),
          input_function_short_code: vertical?.value,
          input_department_short_co: department?.value || "",
          input_name: caseNumber || null,
          input_type: caseType?.text || null,
          input_file_number: selectedFileNumber?.value ?? fileNumber?.value ?? null,
          input_description: subject ?? "",
          input_created_by: r_creator_name?.text ?? "",
          input_status: "",
          page: 1,
          start: 0,
          "items-per-page": DEFAULT_PAGE_SIZE,
        };

        setLastSearchParams(searchParams);
        res = await dispatch(searchCase(searchParams));
      }

      setSearchResults(res?.payload?.entries || []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      if (isSearchClicked) setIsLoading(false);
    }
  };

  const handleRoTeFilterChange = useCallback(
    (e) => {
      const filterValue = e.filter?.value?.toLowerCase() || "";

      const filtered = roTeOptions.filter((item) => item.text.toLowerCase().includes(filterValue));

      setFilteredRoTeOptions(filtered);
    },
    [roTeOptions],
  );

  const handleDepartmentFilterChange = useCallback(
    (e) => {
      const filterValue = e.filter?.value?.toLowerCase() || "";

      const filtered = getAllDept.filter((item) => item.text.toLowerCase().includes(filterValue));

      setFilteredDepartmentOptions(filtered);
    },
    [getAllDept],
  );

  const handleReset = () => {
    setFormData(DEFAULT_FORM_DATA);
    setProcessedData([]);
    setHasSearched(false);
    setSelectedFileNumber(null);
    setCurrentPage(1);
    setLastSearchParams(null);
    setDataState({
      sort: [{ field: "id", dir: "asc" }],
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      filter: null,
    });
    dispatch(resetSearchPagination());
    // Trigger initial fetch again
    if (office_type && department_short_code) {
      fetchCases(getInitialSearchParams());
    }
  };

  const skeletonRows = Array.from({ length: 25 })?.map((_, index) => ({
    id: index,
    case_name: " ",
    case_subject: " ",
    task_date_sent: " ",
    case_priority: " ",
    task_sender: " ",
    case_status: " ",
  }));


  useEffect(() => {
    setFilteredRoTeOptions(roTeOptions);
  }, [roTeOptions]);

  useEffect(() => {
    setFilteredDepartmentOptions(getAllDept);
  }, [getAllDept]);

  useEffect(() => {
    fetchRoTeOptions();
  }, [fetchRoTeOptions]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await dashboardService.getDepartments({
          input_folder: `/ECM CONFIG/Office Type/HO`,
        });

        const regionGroup =
          response?.entries
            ?.map((entry) => ({
              text: entry?.content?.properties?.object_name,
              value: entry?.content?.properties?.title,
            }))
            .sort((a, b) => a.text?.localeCompare(b.text)) || [];

        setGetAllDept(regionGroup);
      } catch (error) {
        console.error(error);
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    setFilteredCaseTypes(caseTypes || []);
  }, [caseTypes]);

  useEffect(() => {
    const isHO = office_type === "HO";
    const params = {
      input_ho_ro: office_type,
      ...(isHO ? { input_dept_short_code: department_short_code } : { input_ro_short_code: ro_short_code }),
    };

    dispatch(fetchFileNumbers(params));
  }, [office_type]);

  useEffect(() => {
    if (office_type === "HO") {
      dispatch(
        fetchVertical({
          input_folder: `/ECM CONFIG/Office Type/HO/${department_name}`,
        }),
      );
    }
  }, [office_type]);

  useEffect(() => {
    setFilteredCreatedBy(
      [...new Set(searchResults?.map((item) => item.content?.properties?.r_creator_name).filter(Boolean))].sort().map((name) => ({
        text: name,
        value: name,
      })),
    );
  }, [searchResults]);

  useEffect(() => {
    const sourceData = searchResults?.length > 0 ? searchResults : IsStorageKeyTrue !== null && IsStorageKeyTrue !== undefined ? searchResult : searchResults;

    const formatted =
      sourceData?.map(({ content }) => ({
        folder_id: content?.properties?.id,
        case_name: content?.properties?.object_name,
        file_number: content?.properties?.file_number,
        case_type: content?.properties?.types,
        case_subject: content?.properties?.description,
        case_priority: content?.properties?.task_priority,
        case_status: content?.properties?.status,
        case_year: content?.properties?.years,
        task_performer: content?.properties?.owner_name,
        r_creator_name: content?.properties?.r_creator_name,
        r_creation_date: content?.properties?.r_creation_date,
        vertical: content?.properties?.functions,
        department: content?.properties?.department_name,
        disposal_level: content?.properties?.disposal_level,
        in_workflow: content?.properties?.in_workflow,
      })) ?? [];

    // For server-side pagination, only apply sorting and filtering on client
    const clientSideState = {
      sort: dataState.sort,
      filter: dataState.filter,
    };
    const processed = process(formatted, clientSideState);

    setProcessedData(processed.data);
    setProcessedDataCount(pagination.total);
  }, [searchResults, searchResult, dataState.sort, dataState.filter, pagination.total]);

  useEffect(() => {
    if (IsStorageKeyTrue != null || !office_type || !department_short_code) return; // eslint-disable-line eqeqeq -- intentional null/undefined check
    fetchCases(getInitialSearchParams());
  }, [office_type, IsStorageKeyTrue, department_short_code, fetchCases, getInitialSearchParams]);

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

  //for RO-TE
  useEffect(() => {
    if (office_type !== "HO") {
      dispatch(
        fetchDepartments({
          input_folder: `/ECM CONFIG/Office Type/${office_type}/${location}`,
        }),
      );
    }
  }, []);

  // Save filters when they change
  useEffect(() => {
    if (hasSearched) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          formData,
          dataState,
          selectedFileNumber,
          lastSearchParams,
          currentPage,
        }),
      );
    }
  }, [formData, dataState, selectedFileNumber, hasSearched, lastSearchParams, currentPage]);

  // Load filters on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { formData, selectedFileNumber, lastSearchParams: savedLastSearchParams, currentPage: savedCurrentPage, dataState: savedDataState } = JSON.parse(saved);
        setFormData({
          ...formData,
          fromDate: formData?.fromDate ? new Date(formData.fromDate) : null,
          toDate: formData?.toDate ? new Date(formData.toDate) : null,
        });
        setSelectedFileNumber(selectedFileNumber || null);

        if (fromViewCaseNavigation && savedLastSearchParams) {
          if (savedDataState) setDataState(savedDataState);
          setCurrentPage(savedCurrentPage || 1);
          setLastSearchParams(savedLastSearchParams);
          setHasSearched(true);
          dispatch(searchCase({ ...savedLastSearchParams, page: savedCurrentPage || 1 }));
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  // Clear filters when leaving this module (except going to view-case)
  useEffect(() => {
    return () => {
      if (!window.location.pathname.includes("/view-case")) {
        localStorage.removeItem(STORAGE_KEY);
      }
    };
  }, []);

  return (
    <Layout>
      <h6 className="case-title-h6 mb-2">Search Case</h6>
      <div className="main-container">
        <div className="row">
          {[
            { label: "Case Number", field: "caseNumber", comp: Input },
            {
              label: "Received from HO Department",
              field: "department",
              comp: DropDownList,
              data: filteredDepartmentOptions,
              textField: "text",
              dataItemKey: "value",
              filterable: true,
              disabled: formData?.roTe,
              onFilterChange: handleDepartmentFilterChange,
              ariaLabel: "Received from HO Department",
            },
            {
              label: "Received from RO/TE",
              field: "roTe",
              comp: DropDownList,
              data: filteredRoTeOptions,
              textField: "text",
              dataItemKey: "value",
              filterable: true,
              onFilterChange: handleRoTeFilterChange,
              disabled: formData?.department,
              ariaLabel: "Received from RO/TE",
            },
            {
              label: "Case Type",
              field: "caseType",
              comp: DropDownList,
              data: filteredCaseTypes,
              textField: "text",
              dataItemKey: "value",
              filterable: true,
              ariaLabel: "Case Type",
              onFilterChange: (e) => {
                const filterValue = e.filter?.value?.toLowerCase() ?? "";
                if (!filterValue) {
                  setFilteredCaseTypes(caseTypes || []);
                } else {
                  const source = caseTypes || [];
                  setFilteredCaseTypes(source.filter((item) => (item?.text || "")?.toLowerCase().includes(filterValue)));
                }
              },
            },
            {
              label: "File Number",
              field: "fileNumber",
              comp: ({ id }) => (
                <div className="input-group">
                  <Input id={id} readOnly value={selectedFileNumber?.value || ""} className="custom-input input-border" />
                  <div className="border input-group-append" onClick={() => setFileNoPop((prev) => !prev)}>
                    <IoFileTrayFull size={20} cursor="pointer" />
                  </div>
                </div>
              ),
            },
            {
              label: "From Date",
              field: "fromDate",
              comp: DatePicker,
              format: "dd/MM/yyyy",
              placeholder: "dd/mm/yyyy",
            },
            {
              label: "To Date",
              field: "toDate",
              comp: DatePicker,
              format: "dd/MM/yyyy",
              placeholder: "dd/mm/yyyy",
              min: formData.fromDate || undefined,
            },
            {
              label: "Created By",
              field: "r_creator_name",
              comp: DropDownList,
              data: filteredCreatedBy,
              textField: "text",
              dataItemKey: "value",
              filterable: true,
              ariaLabel: "Created By",
              onFilterChange: (e) => {
                const filterValue = e.filter?.value?.toLowerCase() ?? "";
                if (!filterValue) {
                  setFilteredCreatedBy(filteredCreatedBy || []);
                } else {
                  const source = filteredCreatedBy || [];
                  setFilteredCreatedBy(source.filter((item) => (item?.text || "")?.toLowerCase().includes(filterValue)));
                }
              },
            },
            { label: "Subject", field: "subject", comp: Input, rows: 1 },
            {
              label: "Search Text",
              field: "notesheetSearch",
              comp: Input,
              rows: 2,
              placeholder: "Search Text in Note sheet / Draft Documents / Supporting Documents",
              colSize: "col-md-6",
            },
          ]?.map(({ label, field, comp: Component, colSize, ...props }) => (
            <div key={field} className={`${colSize || "col-md-3"} col-sm-6 col-xm-12`}>
              <Label className="case-form-label" editorId={`search-${field}`}>
                {label}
              </Label>
              <Component
                {...props}
                id={`search-${field}`}
                value={props.comp === DatePicker ? (formData[field] instanceof Date ? formData[field] : null) : (formData[field] ?? "")}
                onChange={(e) => handleFormChange(field, e.value ?? e.target?.value ?? "")}
                className="case-form-dropdown"
              />
            </div>
          ))}

          <div className="col-md-3">
            <div className="d-flex justify-content-end mt-4 gap-2">
              <Button disabled={isLoading} className="common-btn-css cancel-button" onClick={handleReset}>
                RESET
              </Button>
              <Button disabled={isLoading} className="common-btn-css submit-button" onClick={() => handleSearch(true)}>
                SEARCH
              </Button>
            </div>
          </div>
        </div>

        <Grid
          {...dataState}
          data={isLoading ? skeletonRows : processedData}
          sortable={true}
          resizable={true}
          pageable={{
            info: true,
            buttonCount: 10,
            pageSizes: false,
          }}
          total={processedDataCount}
          className="search-table-grid mt-3"
          onDataStateChange={handleDataStateChange}
        >
          <GridColumn
            width={windowSize?.width > 1440 ? "180px" : "130px"}
            minResizableWidth={100}
            field="case_name"
            title="Case Number"
            cells={{ data: isLoading ? Skeleton : CaseNumberCell }}
          />
          <GridColumn
            width={windowSize?.width > 1024 ? "" : "130px"}
            minResizableWidth={100}
            field="case_subject"
            title="Subject"
            cells={{ data: isLoading ? Skeleton : undefined }}
          />
          <GridColumn
            width={windowSize?.width > 1367 ? "150px" : "100px"}
            minResizableWidth={100}
            field="case_type"
            title="Case Type"
            cells={{ data: isLoading ? Skeleton : undefined }}
          />
          <GridColumn
            width={windowSize?.width > 1440 ? "130px" : windowSize?.width > 1367 ? "130px" : "100px"}
            minResizableWidth={100}
            field="file_number"
            title="File Number"
            cells={{ data: isLoading ? Skeleton : undefined }}
          />
          <GridColumn
            width={windowSize?.width > 1440 ? "200px" : "180px"}
            minResizableWidth={100}
            field="r_creator_name"
            title="Created By"
            cells={{ data: isLoading ? Skeleton : CreatedByCell }}
          />
          <GridColumn width="130px" minResizableWidth={100} field="department" title="Department" cells={{ data: isLoading ? Skeleton : undefined }} />
          <GridColumn width="120px" field="case_priority" title="Case Priority" cells={{ data: isLoading ? Skeleton : CasePriorityCell }} />
          <GridColumn width="50px" title={<span title="Movement Register">MR</span>} cells={{ data: isLoading ? Skeleton : MovementRegisterCell }} />
        </Grid>

        {fileNoPop && (
          <FileNumberDialog
            open={fileNoPop}
            fileNumbers={fileNumbers}
            onClose={() => setFileNoPop(false)}
            selectedFileNumber={selectedFileNumber}
            onSelectFileNumber={(fileNumber) => {
              setSelectedFileNumber(fileNumber);
              setFormData((prev) => ({ ...prev, fileNumber }));
            }}
            isLoading={fileNumbersLoading}
            paginationTotal={fileNumbersPagination.total}
            onFetch={(page, filters) => {
              const isHO = office_type === "HO";
              const params = {
                input_ho_ro: office_type,
                ...(isHO ? { input_dept_short_code: department_short_code } : { input_ro_short_code: ro_short_code }),
                page,
                "items-per-page": fileNumbersPagination.itemsPerPage,
                ...filters,
              };
              dispatch(fetchFileNumbers(params));
            }}
          />
        )}
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

export default SearchCase;
