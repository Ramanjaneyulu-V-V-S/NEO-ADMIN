import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Custom components
import Skeleton from "../../../../components/Loader/Skeleton";

//sweet alert
import { showSweetAlert } from "../../../../components/sweetAlert/SweetAlert";

// Kendo components
import { Dialog } from "@progress/kendo-react-dialogs";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { Checkbox } from "@progress/kendo-react-inputs";

// Custom components
import { referenceCaseStatusOptions } from "../../../data/DropdownData";
import { DropdownFilterCell } from "../../../../components/dropDownFilterCell/DropdownFilterCell";
import { DatePickerFilterCell } from "../../../../components/datePickerFilterCell/DatePickerFilterCell";

//utils
import { formatDateCell } from "../../../../utils/Utils";

// Redux
import { useDispatch, useSelector } from "react-redux";
import {
  addReferenceCases,
  fetchCaseDetails,
  fetchReferenceCases,
  fetchSelectReferenceCases,
  removeReferenceCases,
  DEFAULT_REF_PAGE_SIZE,
  resetReferencePagination,
  resetSelectRefPagination,
} from "../../../../redux/caseManagement/caseDetails/caseDetailsSlice";

// Services
import { sentCaseService } from "../../../../services/caseManagement/sentCases/sentCaseService";

const ReferenceCases = ({ visible, folderId, caseDetailsData, isSameWorkflowUser, screenName, caseStatus, isAcquired, onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, department_short_code, ro_short_code } = userProfile?.properties || {};

  const { referenceCases, selectReferenceCases, referenceLoading, selectRefLoading, referencePagination, selectRefPagination } = useSelector((state) => state?.caseDetails);

  const referenceCaseIds = caseDetailsData?.reference_cases;

  const [addButtonClicked, setAddButtonClicked] = useState(false);

  const [processedData, setProcessedData] = useState([]);
  const [processedSelectRef, setProcessedSelectRef] = useState([]);
  const [selectedState, setSelectedState] = useState([]);

  const [selectedStateTrue, setSelectedStateTrue] = useState([]);
  const [removeRefCases, setRemoveRefCases] = useState([]);
  const [copiedLinks, setCopiedLinks] = useState(new Set());
  const [errorMessages, setErrorMessages] = useState(new Map());
  const [isLoading, setIsLoading] = useState(new Map());

  const actualRemoveId = Array.isArray(selectedState) ? selectedState?.filter((item) => !removeRefCases.includes(item))?.map((item) => item) : [];

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Filter field mappings for the Add Reference Cases grid
  // Note: case_year and r_creator_name use different API keys based on is_migrated value
  const SELECT_REF_FILTER_FIELD_MAP = {
    object_name: "input_name",
    description: "input_description",
    status: "input_status",
    is_migrated: "input_is_migrated",
  };

  const SELECT_REF_TEXT_FIELDS = new Set(["object_name", "description"]);

  // Server-side pagination states
  const [refCurrentPage, setRefCurrentPage] = useState(1);
  const [selectRefCurrentPage, setSelectRefCurrentPage] = useState(1);
  const [selectRefFetchParams, setSelectRefFetchParams] = useState(null);
  const [selectRefFilterParams, setSelectRefFilterParams] = useState(null);
  const selectRefFilterDebounceRef = useRef(null);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: DEFAULT_REF_PAGE_SIZE,
    filter: null,
  });

  const [selectDataState, setSelectDataState] = useState({
    // Default sort: new cases (is_migrated=No) first, then newest creation date, then by case number descending
    sort: [
      { field: "is_migrated", dir: "asc" },
      { field: "case_year", dir: "desc" },
      { field: "object_name", dir: "desc" },
    ],
    skip: 0,
    take: DEFAULT_REF_PAGE_SIZE,
    filter: null,
  });

  const buildSelectRefActiveFilters = (filter) => {
    if (!filter?.filters) return null;
    const result = {};

    // Determine if migrated filter is set to "Yes"
    const migratedFilter = filter.filters.find((f) => f.field === "is_migrated");
    const isMigrated = migratedFilter?.value === "Yes";

    filter.filters.forEach((f) => {
      const apiKey = SELECT_REF_FILTER_FIELD_MAP[f.field];

      if (f.field === "case_year" && f.value) {
        const d = new Date(f.value);
        const pad = (n) => String(n).padStart(2, "0");
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (isMigrated) {
          result["input_old_from"] = formatted;
          result["input_old_to"] = formatted;
        } else {
          result["input_created_on"] = formatted;
          result["input_created_on_"] = formatted;
        }
      } else if (f.field === "r_creator_name" && f.value) {
        result[isMigrated ? "input_created_by_old" : "input_created_by"] = f.value;
      } else if (apiKey && f.value) {
        if (f.field === "is_migrated") {
          result[apiKey] = false;
        } else {
          result[apiKey] = f.value;
        }
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const handleDataStateChange = (e) => {
    const newDataState = e.dataState;
    setDataState(newDataState);

    const newPage = Math.floor(newDataState.skip / DEFAULT_REF_PAGE_SIZE) + 1;

    if (newPage !== refCurrentPage) {
      setRefCurrentPage(newPage);
      const hasReferenceCaseIds = Array.isArray(referenceCaseIds) ? referenceCaseIds.length > 0 : !!referenceCaseIds;
      const inputObjectId = hasReferenceCaseIds ? referenceCaseIds : "000000000000";
      dispatch(fetchReferenceCases({ input_object_id: inputObjectId, page: newPage }));
    }
  };

  const handleSelectDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;

      // When is_migrated filter changes, reset case_year and r_creator_name filters
      const prevMigrated = selectDataState.filter?.filters?.find((f) => f.field === "is_migrated")?.value;
      const newMigrated = newDataState.filter?.filters?.find((f) => f.field === "is_migrated")?.value;
      if (prevMigrated !== newMigrated && newDataState.filter?.filters) {
        newDataState.filter = {
          ...newDataState.filter,
          filters: newDataState.filter.filters.filter((f) => f.field !== "case_year" && f.field !== "r_creator_name"),
        };
      }

      setSelectDataState(newDataState);

      const newPage = Math.floor(newDataState.skip / DEFAULT_REF_PAGE_SIZE) + 1;

      // Detect filter changes across all mapped fields
      const newActiveFilters = buildSelectRefActiveFilters(newDataState.filter);
      const prevActiveFilters = buildSelectRefActiveFilters(selectDataState.filter);
      const filtersChanged = JSON.stringify(newActiveFilters) !== JSON.stringify(prevActiveFilters);

      if (filtersChanged && selectRefFetchParams) {
        const newFilters = newDataState.filter?.filters || [];
        const prevFilters = selectDataState.filter?.filters || [];
        const hasTextFilterChange = newFilters.some((f) => {
          if (!SELECT_REF_TEXT_FIELDS.has(f.field)) return false;
          const prev = prevFilters.find((p) => p.field === f.field);
          return !prev || String(prev.value) !== String(f.value);
        });

        const executeSearch = () => {
          setSelectRefFilterParams(newActiveFilters);
          setSelectRefCurrentPage(1);
          setSelectDataState((prev) => ({ ...prev, skip: 0 }));
          dispatch(resetSelectRefPagination());
          dispatch(
            fetchSelectReferenceCases({
              ...selectRefFetchParams,
              ...(newActiveFilters || {}),
              page: 1,
            }),
          );
        };

        if (selectRefFilterDebounceRef.current) clearTimeout(selectRefFilterDebounceRef.current);

        if (hasTextFilterChange) {
          selectRefFilterDebounceRef.current = setTimeout(executeSearch, 1000);
        } else {
          executeSearch();
        }
        return;
      }

      // Handle page change
      if (newPage !== selectRefCurrentPage && selectRefFetchParams) {
        setSelectRefCurrentPage(newPage);
        dispatch(
          fetchSelectReferenceCases({
            ...selectRefFetchParams,
            ...(selectRefFilterParams || {}),
            page: newPage,
          }),
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectRefCurrentPage, selectRefFetchParams, selectRefFilterParams, selectDataState.filter, dispatch],
  );

  const onSelectionChange = (folderId) => {
    setSelectedState((prevState) => {
      if (prevState.includes(folderId)) {
        return prevState?.filter((id) => id !== folderId);
      } else {
        return [...prevState, folderId];
      }
    });
    setSelectedStateTrue((prevState) => {
      if (prevState.includes(folderId)) {
        return prevState?.filter((id) => id !== folderId);
      } else {
        return [...prevState, folderId];
      }
    });
  };

  const getCaseYearCell = (props) => <td>{formatDateCell(props.dataItem.case_year)}</td>;
  const DateCell = (props) => <td>{formatDateCell(props.dataItem.case_year)}</td>;
  const MigratedCell = (props) => {
    const isMigrated = props.dataItem.is_migrated === "Yes";
    return (
      <td className="text-center">
        <span className={`migrated-badge ${isMigrated ? "migrated-badge-yes" : "migrated-badge-no"}`}>{isMigrated ? "Yes" : "No"}</span>
      </td>
    );
  };
  const handleSelectRefCases = (props) => {
    const isChecked = selectedState.includes(props.dataItem.object_id);

    return (
      <td>
        <Checkbox checked={isChecked} onChange={() => onSelectionChange(props.dataItem.object_id)} />
      </td>
    );
  };
  const onRemovingChange = (folderId) => {
    setRemoveRefCases((prevState) => {
      if (prevState.includes(folderId)) {
        return prevState.filter((id) => id !== folderId);
      } else {
        return [...prevState, folderId];
      }
    });
  };
  const handleRemoveRefCases = (props) => {
    const isChecked = removeRefCases.includes(props.dataItem.object_id);

    return (
      <td>
        <Checkbox checked={isChecked} onChange={() => onRemovingChange(props.dataItem.object_id)} />
      </td>
    );
  };

  const handleShowAddReference = () => {
    setAddButtonClicked((prev) => !prev);
    setSelectedStateTrue([]);
    setSelectRefCurrentPage(1);
    setSelectRefFilterParams(null);
    dispatch(resetSelectRefPagination());
    setSelectDataState({
      sort: [
        { field: "is_migrated", dir: "asc" },
        { field: "case_year", dir: "desc" },
        { field: "object_name", dir: "desc" },
      ],
      skip: 0,
      take: DEFAULT_REF_PAGE_SIZE,
      filter: null,
    });

    const params = {
      input_ho_ro: office_type,
      input_object_id: folderId,
      input_status: ["Closed", "Approved"],
      input_is_migrated: false,
      ...(office_type === "HO" ? { input_department_short_co: department_short_code } : { input_ro_short_code: ro_short_code }),
    };
    setSelectRefFetchParams(params);
    dispatch(fetchSelectReferenceCases({ ...params, page: 1 }));
  };

  const handleRemoveReference = async () => {
    const payload = {
      properties: {
        reference_cases: actualRemoveId?.length > 0 ? actualRemoveId : ["0000000000"],
      },
      type: "cms_case_folder", // need to pass dynamically
    };

    try {
      const response = await dispatch(
        removeReferenceCases({
          folderId: folderId,
          payload: payload,
        }),
      );

      if (response?.payload?.properties?.reference_cases) {
        setSelectedState([]);
        setRemoveRefCases([]);
        setAddButtonClicked(false);
        dispatch(
          fetchReferenceCases({
            input_object_id: response?.payload?.properties?.reference_cases,
          }),
        );
        dispatch(fetchCaseDetails({ folderId }));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddReference = async () => {
    const payload = {
      properties: { reference_cases: selectedState },
      type: "cms_case_folder", // need to pass dynamically
    };

    try {
      const response = await dispatch(
        addReferenceCases({
          folderId: folderId,
          payload: payload,
        }),
      );

      if (response?.payload?.properties?.reference_cases) {
        setSelectedState([]);
        setAddButtonClicked(false);
        dispatch(
          fetchReferenceCases({
            input_object_id: response?.payload?.properties?.reference_cases,
          }),
        );
        dispatch(fetchCaseDetails({ folderId }));
      } else {
        onClose();
        setAddButtonClicked(false);
        showSweetAlert({
          title: "Error",
          text: response.payload,
          icon: "error",
        });
      }
    } catch (error) {
      onClose();
      console.error(error);
      setAddButtonClicked(false);
      showSweetAlert({
        title: "Error",
        text: "Failed to add reference cases",
        icon: "error",
      });
    }
  };

  const CaseNumberCell = (props) => (
    <td>
      <button className="case-number-span cursor-pointer border-0 bg-transparent text-start" onClick={() => handleViewCase(props)}>
        {props.dataItem.object_name}
      </button>
    </td>
  );

  const CopyLinkCell = (props) => {
    const caseId = props.dataItem.object_id;
    const caseStatus = props.dataItem.status?.toLowerCase();
    const isCopied = copiedLinks.has(caseId);
    const isLoadingState = isLoading.has(caseId);
    const errorMsg = errorMessages.get(caseId);

    // Don't show copy link button for approved status
    if (caseStatus === "approved") {
      return <td className="text-center p-2"></td>;
    }

    return (
      <td className="text-center p-2">
        <div className="d-flex flex-column align-items-center gap-1 min-h-40">
          <button
            onClick={() => handleCopyLink(props)}
            disabled={isLoadingState}
            className={`btn p-1 rounded-1 d-flex align-items-center justify-content-center copy-link-btn ${isLoadingState ? "opacity-75" : "opacity-100"} ${errorMsg ? "text-danger" : isCopied ? "text-success" : "text-primary"}`}
            title={errorMsg ? errorMsg : isCopied ? "Copied!" : "Copy link to this case"}
          >
            {isLoadingState ? "⏳" : errorMsg ? "✗" : isCopied ? "✓" : "🔗"}
          </button>
          {isCopied && !errorMsg && <span className="copy-link-success">Copied</span>}
          {errorMsg && <span className="copy-link-error">{errorMsg}</span>}
        </div>
      </td>
    );
  };

  const handleViewCase = (item) => {
    const state = {
      screenName: "referenceScreen",
      folderId: item?.dataItem?.object_id,
      caseStatus: item?.dataItem?.status,
      autoNumOutput: item?.dataItem?.object_name,
      isInitiateWorkflow: true,
      isMigrated: item?.dataItem?.is_migrated === "Yes",
    };

    // Fix: localStorage.removeItem only takes one argument (the key)
    localStorage.removeItem("newTabState");
    localStorage.setItem("newTabState", JSON.stringify(state));

    // Get the base path from environment (same as BrowserRouter basename)
    const basePath = import.meta.env.VITE_BASE_PATH || "";
    const url = `${basePath}/reference-case/${item?.dataItem?.object_id}`;

    // Try to open in new tab, with fallback for popup blockers
    const newWindow = window.open(url, "_blank");

    // If popup was blocked, navigate in the same window
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      console.warn("Popup blocked! Navigating in same window...");
      navigate(url);
    }
  };

  const handleCopyLink = async (props) => {
    const caseId = props.dataItem.object_id;
    const caseName = props.dataItem.object_name;
    const isCaseMigrated = props.dataItem.is_migrated === true || props.dataItem.is_migrated === "Yes";

    if (isLoading.has(caseId)) return;

    setIsLoading((prev) => new Map(prev).set(caseId, true));

    setErrorMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(caseId);
      return newMap;
    });

    try {
      const folderPath = isCaseMigrated ? `/CMS Legacy/${caseName}` : `/Case/${caseName}`;
      const response = await sentCaseService.getNotesheetId({
        input_folder_path: folderPath,
        ...(isCaseMigrated && { input_object_name: "%- Note Sheet.docx" }),
      });

      const publicationId = response?.entries?.[0]?.content?.properties?.publishing_id;

      if (!publicationId) {
        throw new Error("Publication ID not found for this case");
      }

      // Set page number to 1 for reference case links
      const pageNumber = 1;

      // Copy plain URL to clipboard
      const linkQuery = `?type=page&pid=${encodeURIComponent(publicationId)}&pageNumber=${pageNumber}`;
      const fullLink = `${window.location.protocol}//${window.location.host}${window.location.pathname}${linkQuery}`;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          // Copy plain URL
          await navigator.clipboard.writeText(fullLink);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = fullLink;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (!successful) {
            throw new Error("Copy command failed");
          }
        }

        setCopiedLinks((prev) => new Map([...prev, [caseId, true]]));

        setTimeout(() => {
          setCopiedLinks((prev) => {
            const newMap = new Map(prev);
            newMap.delete(caseId);
            return newMap;
          });
        }, 3000);
      } catch (err) {
        console.error(err);
      }
    } catch (error) {
      const errorMsg = error.message || "Failed to generate link";
      setErrorMessages((prev) => new Map(prev).set(caseId, errorMsg));

      setTimeout(() => {
        setErrorMessages((prev) => {
          const newMap = new Map(prev);
          newMap.delete(caseId);
          return newMap;
        });
      }, 3000);
    } finally {
      setIsLoading((prev) => {
        const newMap = new Map(prev);
        newMap.delete(caseId);
        return newMap;
      });
    }
  };

  const skeletonRows = Array.from({ length: 20 })?.map((_, index) => ({
    id: index,
    object_name: "",
    description: "",
    department: "",
    case_year: "",
    case_nature: "",
    status: "",
  }));

  useEffect(() => {
    if (visible) {
      setRefCurrentPage(1);
      dispatch(resetReferencePagination());
      const hasReferenceCaseIds = Array.isArray(referenceCaseIds) ? referenceCaseIds.length > 0 : !!referenceCaseIds;
      const inputObjectId = hasReferenceCaseIds ? referenceCaseIds : "000000000000";

      dispatch(
        fetchReferenceCases({
          input_object_id: inputObjectId,
          page: 1,
        }),
      );
    }
  }, [visible]);

  useEffect(() => {
    const mappedData = Array.isArray(referenceCases)
      ? referenceCases?.map((caseItem) => ({
          object_name: caseItem?.content?.properties?.object_name,
          department: caseItem?.content?.properties?.functions,
          description: caseItem?.content?.properties?.description,
          case_year: caseItem?.content?.properties?.r_creation_date,
          r_creator_name: caseItem?.content?.properties?.r_creator_name,
          status: caseItem?.content?.properties?.status,
          object_id: caseItem?.content?.properties?.id,
          is_migrated: caseItem?.content?.properties?.is_migrated === true ? "Yes" : "No",
        }))
      : [];

    const selectedObjectIds = mappedData?.map((caseItem) => caseItem?.object_id);

    setSelectedState(selectedObjectIds);

    const clientSideState = {
      sort: dataState.sort,
      filter: dataState.filter,
    };
    const processed = process(mappedData, clientSideState);
    processed.total = referencePagination.total;
    setProcessedData(processed);
  }, [referenceCases, dataState.sort, dataState.filter, referencePagination.total]);

  useEffect(() => {
    const mappedSelectCases = Array.isArray(selectReferenceCases)
      ? selectReferenceCases?.map((caseItem) => ({
          object_name: caseItem?.content?.properties?.object_name,
          department: caseItem?.content?.properties?.functions,
          case_nature: caseItem?.content?.properties?.case_nature,
          case_type: caseItem?.content?.properties?.r_object_type,
          case_priority: caseItem?.content?.properties?.status,
          case_year: caseItem?.content?.properties?.is_migrated ? caseItem?.content?.properties?.created_on : caseItem?.content?.properties?.r_creation_date,
          description: caseItem?.content?.properties?.description,
          status: caseItem?.content?.properties?.status,
          object_id: caseItem?.content?.properties?.id,
          r_creator_name: caseItem?.content?.properties?.is_migrated ? caseItem?.content?.properties?.created_by : caseItem?.content?.properties?.r_creator_name,
          is_migrated: caseItem?.content?.properties?.is_migrated === true ? "Yes" : "No",
        }))
      : [];

    const clientSideState = { sort: selectDataState.sort };
    const processed = process(mappedSelectCases, clientSideState);
    processed.total = selectRefPagination.total;
    setProcessedSelectRef(processed);
  }, [selectReferenceCases, selectDataState.sort, selectRefPagination.total]);

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

  return (
    visible && (
      <>
        <style>
          {`
            @keyframes fadeInOut {
              0% { opacity: 0; }
              20% { opacity: 1; }
              80% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}
        </style>

        <Dialog title={addButtonClicked ? "Add Reference Cases" : "Get Reference Cases"} onClose={onClose} className="reference-dialog-wh">
          {addButtonClicked ? (
            <>
              {selectedStateTrue?.length > 0 && (
                <div className="mb-2">
                  <span className="font-size-12 fw-medium text-muted">{selectedStateTrue.length} case(s) selected</span>
                </div>
              )}
              <div className="add-reference-data-grid">
                <Grid
                  {...selectDataState}
                  data={selectRefLoading ? skeletonRows : processedSelectRef}
                  sortable={true}
                  resizable={true}
                  filterable={true}
                  pageable={{
                    info: true,
                    buttonCount: 10,
                    pageSizes: false,
                  }}
                  onDataStateChange={handleSelectDataStateChange}
                >
                  <GridColumn width="60px" title="Select" filterable={false} sortable={false} cells={{ data: handleSelectRefCases }} />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "150px"}
                    minResizableWidth={100}
                    field="object_name"
                    title="Case No."
                    cells={{
                      data: selectRefLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "150px"}
                    minResizableWidth={100}
                    field="description"
                    title="Case Subject"
                    cells={{
                      data: selectRefLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "160px"}
                    minResizableWidth={100}
                    field="case_year"
                    title="Created On"
                    cells={{
                      filterCell: (props) => (
                        <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                          <DatePickerFilterCell {...props} />
                        </HeaderTdElement>
                      ),
                      data: selectRefLoading ? Skeleton : DateCell,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "160px"}
                    minResizableWidth={100}
                    field="r_creator_name"
                    title="Created By"
                    cells={{
                      data: selectRefLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "110px"}
                    minResizableWidth={100}
                    field="status"
                    title="Status"
                    cells={{
                      filterCell: (props) => (
                        <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                          <DropdownFilterCell {...props} data={referenceCaseStatusOptions} />
                        </HeaderTdElement>
                      ),
                      data: selectRefLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width="120px"
                    field="is_migrated"
                    title="Migrated"
                    cells={{
                      filterCell: (props) => (
                        <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                          <DropdownFilterCell {...props} data={["Yes", "No"]} />
                        </HeaderTdElement>
                      ),
                      data: selectRefLoading ? Skeleton : MigratedCell,
                    }}
                  />
                </Grid>
              </div>
              <div className="d-flex justify-content-end mt-3">
                <Button className="common-btn-css cancel-button me-2" onClick={handleShowAddReference}>
                  Back
                </Button>
                <Button className="common-btn-css submit-button" disabled={selectedStateTrue?.length === 0} onClick={handleAddReference}>
                  Add
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={removeRefCases?.length === 0 ? "view-reference-data-grid" : "add-reference-data-grid"}>
                <Grid
                  {...dataState}
                  data={referenceLoading ? skeletonRows : processedData}
                  sortable={true}
                  resizable={true}
                  pageable={{
                    info: true,
                    buttonCount: 10,
                    pageSizes: false,
                  }}
                  onDataStateChange={handleDataStateChange}
                >
                  <GridColumn width="60px" title="Select" cells={{ data: handleRemoveRefCases }} />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "150px"}
                    minResizableWidth={100}
                    field="object_name"
                    title="Case No."
                    cells={{ data: referenceLoading ? Skeleton : CaseNumberCell }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "150px"}
                    minResizableWidth={100}
                    field="description"
                    title="Case Subject"
                    cells={{
                      data: referenceLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "160px"}
                    minResizableWidth={100}
                    field="case_year"
                    title="Created On"
                    cells={{
                      data: referenceLoading ? Skeleton : getCaseYearCell,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "160px"}
                    minResizableWidth={100}
                    field="r_creator_name"
                    title="Created By"
                    cells={{
                      data: referenceLoading ? Skeleton : undefined,
                    }}
                  />
                  <GridColumn
                    width={windowSize?.width > 668 ? "" : "110px"}
                    minResizableWidth={100}
                    field="status"
                    title="Status"
                    cells={{ data: referenceLoading ? Skeleton : undefined }}
                  />
                  <GridColumn width={"80px"} minResizableWidth={80} title="Link" cells={{ data: referenceLoading ? Skeleton : CopyLinkCell }} />
                </Grid>
              </div>

              <div className="d-flex justify-content-end mt-3">
                <Button className={`common-btn-css cancel-button ${removeRefCases?.length === 0 && "close-btn-pad"}`} onClick={onClose}>
                  Close
                </Button>
                {removeRefCases?.length !== 0 && (
                  <Button className="common-btn-css cancel-button ms-2" onClick={handleRemoveReference}>
                    Remove
                  </Button>
                )}
              </div>
            </>
          )}

          {screenName === "inboxScreen" && isAcquired !== 0 ? (
            <>
              {removeRefCases?.length === 0 && (
                <>
                  {!addButtonClicked && (
                    <button className="add-btn-clicked d-flex justify-content-end border-0 bg-transparent" onClick={handleShowAddReference}>
                      <span className="btn width-50 rounded-circle">+</span>
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {caseStatus === "Draft" && isSameWorkflowUser && (
                <>
                  {removeRefCases?.length === 0 && (
                    <>
                      {!addButtonClicked && (
                        <button className="add-btn-clicked d-flex justify-content-end border-0 bg-transparent" onClick={handleShowAddReference}>
                          <span className="btn width-50 rounded-circle">+</span>
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Dialog>
      </>
    )
  );
};

export default ReferenceCases;
