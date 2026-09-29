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
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

//react icons
import { RiResetLeftLine } from "react-icons/ri";
import { FaClipboardList } from "react-icons/fa6";

import { useDispatch, useSelector } from "react-redux";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import { fetchDDMDigidakGridData, resetDDMDigidakState, DEFAULT_PAGE_SIZE, resetDDMPagination } from "../../../redux/digidak/ddm/digidakDDMSlice";
import { digidakStatusOptions, digidakCategoryOptions, caseLanguageOptions, natureOfCaseOptions } from "../../data/DropdownData";
import { fromAndToDateFormat } from "../../../utils/Utils";
import DigidakExportButton from "../../../components/digidak/DigidakExportButton";
import useServerSideGrid from "../../../hooks/useServerSideGrid";

const FILTER_FIELD_MAP = {
  digidak_uid: "input_uid_number__",
  subject: "input_letter_subject",
  status: "input_status",
  type_category: "input_type_category",
  mode_of_receipt: "input_mode_of_receipt",
  secrecy: "input_secrecy",
  language: "input_languages",
  sender: "input_login_region",
  recipient: ["input_ddm_vertical"],
  due_date: "input_due_date",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["digidak_uid", "subject", "sender", "recipient", "mode_of_receipt"]);

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

// Hook owns grid state (dataState, currentPage, filterSearchParams) under this key.
// Screen owns form state (hasSearched, dates) under FORM_STORAGE_KEY.
const GRID_STORAGE_KEY = "ddmLetters_grid";
const FORM_STORAGE_KEY = "ddmLetters_form";

const DDMLetters = ({ mode }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const decision = mode;

  const excelExportRef = useRef(null);

  // Read and consume saved form state once on mount (written by handleViewDigidak before navigating away)
  const [savedFormState] = useState(() => {
    try {
      const key = `${FORM_STORAGE_KEY}_${mode}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        sessionStorage.removeItem(key);
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  });

  const { ddmList, loading, pagination } = useSelector((state) => state.digidakDDM);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: savedFormState
      ? {
          ...defaultValues,
          fromDate: savedFormState.fromDate ? new Date(savedFormState.fromDate) : null,
          toDate: savedFormState.toDate ? new Date(savedFormState.toDate) : null,
        }
      : defaultValues,
  });
  const [hasSearched, setHasSearched] = useState(savedFormState?.hasSearched ?? false);
  const { fromDate, toDate } = useWatch({ control });
  const [popups, setPopups] = useState({ movementRegister: false });
  const [movementRegisterData, setMovementRegisterData] = useState([]);

  const mappedInboxData = useMemo(() => {
    return (
      ddmList?.map((item) => {
        const {
          id,
          uid_number,
          i_folder_id,
          is_ddm,
          decision,
          status,
          type_category,
          letter_subject,
          entry_type,
          received_from,
          mode_of_receipt,
          priority,
          secrecy,
          languages,
          address_of_sender,
          state_of_sender,
          region,
          selected_region,
          login_region,
          selected_cgm_group,
          due_date,
          ddm_vertical,
        } = item?.content?.properties ?? {};

        const isInternal = entry_type === "Internal";

        return {
          // 🔑 Identifiers
          id,
          digidak_uid: uid_number || "",
          folder_id: i_folder_id?.[0] || "",

          // DDM metadata
          is_ddm: is_ddm === true,
          decision: decision || "",
          status: status || "",
          type_category: type_category || "",

          // Letter details
          subject: letter_subject || "",
          entry_type: entry_type || "",
          received_from: received_from || "",
          mode_of_receipt: mode_of_receipt || "",

          // Classification
          priority: priority || "",
          secrecy: secrecy || "",
          language: languages || "",

          // Sender info (Inward-specific but safe)
          sender_address: address_of_sender || "",
          state_of_sender: state_of_sender || "",

          // Region & workflow
          region: region || "",
          selected_region: selected_region || "",
          login_region: login_region || "",
          selected_cgm_group: selected_cgm_group || "",

          // Dates
          due_date: due_date ? new Date(due_date).toLocaleDateString("en-IN") : "",

          sender: login_region || "",
          recipient: isInternal ? ddm_vertical || "" : received_from || "",
        };
      }) ?? []
    );
  }, [ddmList]);

  const onFetch = useCallback(
    (page, activeFilters) => {
      const payload = { decision, page, ...(activeFilters || {}) };
      if (hasSearched && fromDate) payload.input_created_on_ = fromAndToDateFormat(fromDate);
      if (hasSearched && toDate) payload.input_created_on = fromAndToDateFormat(toDate);
      if (payload.input_due_date instanceof Date) payload.input_due_date = fromAndToDateFormat(payload.input_due_date);
      dispatch(fetchDDMDigidakGridData(payload));
    },
    [dispatch, decision, hasSearched, fromDate, toDate],
  );

  const onResetPagination = useCallback(() => dispatch(resetDDMPagination()), [dispatch]);

  const { dataState, handleDataStateChange, processedData, resetGridState, currentPage, filterSearchParams, isStateRestored } = useServerSideGrid({
    filterFieldMap: FILTER_FIELD_MAP,
    textFilterFields: TEXT_FILTER_FIELDS,
    pageSize: DEFAULT_PAGE_SIZE,
    onFetch,
    onResetPagination,
    data: mappedInboxData,
    paginationTotal: pagination.total,
    initialSort: [{ field: "id", dir: "dec" }],
    storageKey: `${GRID_STORAGE_KEY}_${decision}`,
  });

  const initialMountRef = useRef(true);

  useEffect(() => {
    if (isStateRestored) {
      // Restore: re-fetch the page and filters the user was on before navigating away
      const payload = {
        decision,
        page: currentPage,
        ...(filterSearchParams || {}),
      };
      if (savedFormState?.hasSearched && savedFormState?.fromDate) {
        payload.input_created_on_ = fromAndToDateFormat(new Date(savedFormState.fromDate));
      }
      if (savedFormState?.hasSearched && savedFormState?.toDate) {
        payload.input_created_on = fromAndToDateFormat(new Date(savedFormState.toDate));
      }
      if (payload.input_due_date) {
        const d = new Date(payload.input_due_date);
        if (!isNaN(d)) payload.input_due_date = fromAndToDateFormat(d);
      }
      dispatch(fetchDDMDigidakGridData(payload));
    } else {
      dispatch(fetchDDMDigidakGridData({ decision, page: 1 }));
    }
    return () => {
      dispatch(resetDDMDigidakState());
    };
  }, [dispatch, decision]);

  useEffect(() => {
    // Skip reset on initial mount — form is already initialised with the correct values
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    reset(defaultValues);
    setHasSearched(false);
  }, [decision]);

  const onSubmit = (data) => {
    setHasSearched(true);
    resetGridState();
    const payload = { decision, page: 1 };
    if (data.fromDate) payload.input_created_on_ = fromAndToDateFormat(data.fromDate);
    if (data.toDate) payload.input_created_on = fromAndToDateFormat(data.toDate);
    dispatch(fetchDDMDigidakGridData(payload));
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(`${FORM_STORAGE_KEY}_${decision}`);
    } catch (err) {
      console.error(err);
    }
    reset(defaultValues);
    setHasSearched(false);
    resetGridState(); // also clears grid storage inside the hook
    dispatch(fetchDDMDigidakGridData({ decision, page: 1 }));
  };

  const isGoDisabled = !fromDate || !toDate;

  const handleViewDigidak = useCallback(
    (item) => {
      if (item?.dataItem?.id) {
        // Save screen-specific form state before leaving — hook auto-saves grid state
        try {
          sessionStorage.setItem(
            `${FORM_STORAGE_KEY}_${decision}`,
            JSON.stringify({
              hasSearched,
              fromDate: fromDate ? fromDate.toISOString() : null,
              toDate: toDate ? toDate.toISOString() : null,
            }),
          );
        } catch (err) {
          console.error(err);
        }

        navigate(`/digidak-view/${item?.dataItem?.id}`, {
          state: {
            digidakObjectId: item?.dataItem?.id,
            screenName: "viewInward",
            pathname: location?.pathname,
            digidak_uid: item?.dataItem?.digidak_uid,
            i_folder_id: item?.dataItem?.i_folder_id,
          },
        });
      }
    },
    [navigate, decision, hasSearched, fromDate, toDate, location],
  );

  const handleMovementRegister = useCallback(
    async (props) => {
      const data = props?.dataItem;

      if (data?.id) {
        const response = await dispatch(fetchDigidakMovementRegister({ input_parent_folders: data.id }));

        if (response.type === "getDigidakMovementRegister/fulfilled") {
          setMovementRegisterData(response.payload || []);
          setPopups((prev) => ({ ...prev, movementRegister: true }));
        }
      }
    },
    [dispatch],
  );

  const DigidakUIDCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0" onClick={() => handleViewDigidak(props)}>
        {props.dataItem.digidak_uid}
      </button>
    </td>
  );

  // Grid Action Cell
  const ActionCell = (props) => {
    return (
      <td className="sticky-action-cell">
        <div className="d-flex align-items-center justify-content-start gap-1">
          <button className="icon-wrapper icon-clickable border-0 bg-transparent" onClick={() => handleMovementRegister(props)} title="Movement Register">
            <FaClipboardList size="14px" color="#5e9bf7" />
          </button>
        </div>
      </td>
    );
  };

  // Skeleton rows for loading
  const skeletonRows = Array.from({ length: 25 }).map((_, index) => ({
    id: index,
    digidak_uid: " ",
    subject: " ",
    entry_date: " ",
    decision: " ",
    status: " ",
    type_category: " ",
    entry_type: " ",
    mode_of_receipt: " ",
    received_from: " ",
    priority: " ",
    secrecy: " ",
    language: " ",
    is_ddm: true,
  }));

  return (
    <Layout>
      <h6 className="case-title-h6 mb-2">{`DDM ${decision}`}</h6>
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
          <ExcelExport data={processedData} fileName={decision === "Inward" ? "Digidak_Inward.xlsx" : "Digidak_Outward.xlsx"} ref={excelExportRef}>
            <Grid
              {...dataState}
              data={loading ? { data: skeletonRows, total: processedData.total } : processedData}
              sortable
              filterable
              pageable={{
                info: true,
                buttonCount: 10,
                pageSizes: false,
              }}
              onDataStateChange={handleDataStateChange}
            >
              <GridColumn field="digidak_uid" title="Digidak UID" width="120px" cells={{ data: loading ? Skeleton : DigidakUIDCell }} />
              <GridColumn field="subject" title="Subject" width="250px" cells={{ data: loading ? Skeleton : undefined }} />

              {decision === "Outward" && (
                <GridColumn
                  field="due_date"
                  title="Due Date"
                  width="150px"
                  cells={{
                    filterCell: (props) => (
                      <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                        <DatePickerFilterCell {...props} />
                      </HeaderTdElement>
                    ),
                    data: loading ? Skeleton : undefined,
                  }}
                />
              )}

              <GridColumn
                field="status"
                title="Status"
                width="130px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={digidakStatusOptions} />
                    </HeaderTdElement>
                  ),
                  data: loading ? Skeleton : undefined,
                }}
              />

              <GridColumn
                field="type_category"
                title="Category"
                width="130px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={digidakCategoryOptions} />
                    </HeaderTdElement>
                  ),
                  data: loading ? Skeleton : undefined,
                }}
              />

              {decision === "Outward" && <GridColumn field="sender" title="Sender" width="130px" filterable={true} cells={{ data: loading ? Skeleton : undefined }} />}

              {decision === "Outward" && <GridColumn field="recipient" title="Recipient" width="130px" filterable={true} cells={{ data: loading ? Skeleton : undefined }} />}

              <GridColumn field="mode_of_receipt" title="Mode of Receipt" width="160px" cells={{ data: loading ? Skeleton : undefined }} />

              <GridColumn
                field="secrecy"
                title="Secrecy"
                width="120px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={natureOfCaseOptions} />
                    </HeaderTdElement>
                  ),
                  data: loading ? Skeleton : undefined,
                }}
              />

              <GridColumn
                field="language"
                title="Language"
                width="120px"
                cells={{
                  filterCell: (props) => (
                    <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                      <DropdownFilterCell {...props} data={caseLanguageOptions} />
                    </HeaderTdElement>
                  ),
                  data: loading ? Skeleton : undefined,
                }}
              />

              <GridColumn title="Actions" width="80px" filterable={false} sortable={false} locked cells={{ data: loading ? Skeleton : ActionCell }} />
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
};

export default DDMLetters;
