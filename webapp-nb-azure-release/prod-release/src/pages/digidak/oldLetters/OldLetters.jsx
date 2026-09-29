import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

// components
import Layout from "../../../components/layout/Layout";
import Skeleton from "../../../components/Loader/Skeleton";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

//kendo react
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

// icons
import { FaFileExport, FaSearch, FaClipboardList } from "react-icons/fa";

// sweet alert
import Swal from "sweetalert2";

import { formatDateOnly } from "../../../utils/Utils";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import { fetchDigidakOldLettersV2, DEFAULT_PAGE_SIZE, resetOldLettersPagination } from "../../../redux/digidak/inbox/digidakInboxSlice";
import { digidakStatusOptions, digidakCategoryOptions, caseLanguageOptions, oldLettersSecrecyOptions } from "../../data/DropdownData";
import useServerSideGrid from "../../../hooks/useServerSideGrid";

const BASE_FILTER_FIELD_MAP = {
  digidak_uid: "uid_number",
  subject: "subject",
  status: "inp_status",
  type_category: "type_category",
  mode_of_receipt: "mode_of_receipt",
  secrecy: "secrecy",
  language: "languages",
  due_date: "due_date",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["digidak_uid", "subject", "sender", "recipient", "mode_of_receipt"]);

// Hook owns grid state (dataState, currentPage, filterSearchParams) under GRID_STORAGE_KEY.
// Screen owns form state (fromDate, toDate) under FORM_STORAGE_KEY.
const GRID_STORAGE_KEY = "oldLetters_grid";
const FORM_STORAGE_KEY = "oldLetters_form";

const OldLetters = ({ mode = "Outbox" }) => {
  const excelExportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Read and consume saved form state once on mount (written by handleViewDigidak before navigating away)
  const [savedFormState] = useState(() => {
    try {
      const key = `${FORM_STORAGE_KEY}_${mode}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        sessionStorage.removeItem(key);
        return JSON.parse(saved);
      }
    } catch {
      /* ignored */
    }
    return null;
  });

  const [fromDate, setFromDate] = useState(savedFormState?.fromDate ? new Date(savedFormState.fromDate) : null);
  const [toDate, setToDate] = useState(savedFormState?.toDate ? new Date(savedFormState.toDate) : null);

  // Login user details
  const { userProfile } = useSelector((state) => state.login);
  const { office_type, department_short_code, location: userLocation } = userProfile?.properties || {};
  const loginRegion = office_type === "HO" ? department_short_code?.toUpperCase() : userLocation;

  const FILTER_FIELD_MAP = useMemo(
    () => ({
      ...BASE_FILTER_FIELD_MAP,
      recipient: "received_from",
      sender: mode === "Outbox" ? "inp_login_region" : "login_region",
    }),
    [mode],
  );

  const { oldLettersList, loading, oldLettersPagination } = useSelector((state) => state.digidakInbox);

  const [popups, setPopups] = useState({ movementRegister: false });
  const [movementRegisterData, setMovementRegisterData] = useState([]);

  // Mapped data as per api response
  const mappedOldLettersData = useMemo(() => {
    return (
      oldLettersList?.map((item) => {
        const {
          id,
          r_object_id,
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
        } = item ?? {};

        return {
          // 🔑 Identifiers
          id: r_object_id || id,
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

          // Sender info
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
          recipient: received_from || "",
        };
      }) ?? []
    );
  }, [oldLettersList, mode]);

  const onFetch = useCallback(
    (page, activeFilters) => {
      if (loginRegion) {
        dispatch(
          fetchDigidakOldLettersV2({
            _login_region: loginRegion,
            page,
            mode,
            ...(fromDate && { from_date: formatDateOnly(fromDate) }),
            ...(toDate && { to_date: formatDateOnly(toDate) }),
            ...(activeFilters || {}),
          }),
        );
      }
    },
    [dispatch, loginRegion, mode, fromDate, toDate],
  );

  const onResetPagination = useCallback(() => dispatch(resetOldLettersPagination()), [dispatch]);

  const { dataState, handleDataStateChange, processedData, resetGridState, currentPage, filterSearchParams, isStateRestored } = useServerSideGrid({
    filterFieldMap: FILTER_FIELD_MAP,
    textFilterFields: TEXT_FILTER_FIELDS,
    pageSize: DEFAULT_PAGE_SIZE,
    onFetch,
    onResetPagination,
    data: mappedOldLettersData,
    paginationTotal: oldLettersPagination.total,
    initialSort: [{ field: "digidak_uid", dir: "asc" }],
    storageKey: `${GRID_STORAGE_KEY}_${mode}`,
  });

  // Ensures the restore fetch only fires once even if loginRegion/mode effect re-runs
  const restorationConsumedRef = useRef(false);

  useEffect(() => {
    if (loginRegion) {
      if (isStateRestored && !restorationConsumedRef.current) {
        // Restore: re-fetch the page and filters the user was on before navigating away
        restorationConsumedRef.current = true;
        dispatch(
          fetchDigidakOldLettersV2({
            _login_region: loginRegion,
            page: currentPage,
            mode,
            ...(fromDate && { from_date: formatDateOnly(fromDate) }),
            ...(toDate && { to_date: formatDateOnly(toDate) }),
            ...(filterSearchParams || {}),
          }),
        );
      } else {
        resetGridState();
        dispatch(fetchDigidakOldLettersV2({ _login_region: loginRegion, page: 1, mode }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginRegion, mode]);

  const handleSearch = () => {
    if (loginRegion) {
      resetGridState();
      dispatch(
        fetchDigidakOldLettersV2({
          _login_region: loginRegion,
          page: 1,
          mode,
          ...(fromDate && { from_date: formatDateOnly(fromDate) }),
          ...(toDate && { to_date: formatDateOnly(toDate) }),
        }),
      );
    }
  };

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

  const handleViewDigidak = useCallback(
    (item) => {
      if (item?.dataItem?.id) {
        // Save screen-specific form state before leaving — hook auto-saves grid state
        try {
          sessionStorage.setItem(
            `${FORM_STORAGE_KEY}_${mode}`,
            JSON.stringify({
              fromDate: fromDate ? fromDate.toISOString() : null,
              toDate: toDate ? toDate.toISOString() : null,
            }),
          );
        } catch {
          /* ignored */
        }

        navigate(`/old-letters-view/${item?.dataItem?.id}`, {
          state: {
            digidakObjectId: item?.dataItem?.id,
            screenName: "OldLetters",
            pathname: location?.pathname,
            digidak_uid: item?.dataItem?.digidak_uid,
            i_folder_id: item?.dataItem?.folder_id,
          },
        });
      }
    },
    [navigate, location, mode, fromDate, toDate],
  );

  // Custom Cells
  const DigidakUIDCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent text-primary text-decoration-underline" onClick={() => handleViewDigidak(props)}>
        {props.dataItem.digidak_uid}
      </button>
    </td>
  );

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

  // Skeleton Data
  const skeletonRows = Array.from({ length: 25 }).map((_, i) => ({ id: i }));

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-between my-2">
        <h6 className="case-title-h6">{`Old Letters ${mode}`}</h6>

        <div className="d-flex align-items-center gap-2">
          <DatePicker
            value={fromDate}
            format="dd/MM/yyyy"
            placeholder="From Date"
            className="font-size-12 width-150"
            max={new Date()}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <DatePicker
            value={toDate}
            format="dd/MM/yyyy"
            placeholder="To Date"
            className="font-size-12 width-150"
            max={new Date()}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Button type="button" onClick={handleSearch} className="master-search-btn" aria-label="Search">
            <FaSearch size="14px" />
          </Button>

          <Button className="export-to-excel" onClick={handleExport}>
            <div className="d-flex align-items-center font-size-12">
              <FaFileExport className="me-1" /> Export
            </div>
          </Button>
        </div>
      </div>

      <div className="old-case-grid">
        <ExcelExport data={processedData} fileName={`Old_Letters_${mode}.xlsx`} ref={excelExportRef}>
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
            <GridColumn field="digidak_uid" title="Digidak UID" width="120px" cells={{ data: loading ? Skeleton : DigidakUIDCell }} />

            <GridColumn field="subject" title="Subject" width="250px" cells={{ data: loading ? Skeleton : undefined }} />

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

            <GridColumn field="sender" title="Sender" width="130px" filterable={true} cells={{ data: loading ? Skeleton : undefined }} />

            <GridColumn field="recipient" title="Recipient" width="130px" filterable={true} cells={{ data: loading ? Skeleton : undefined }} />

            <GridColumn field="mode_of_receipt" title="Mode of Receipt" width="160px" cells={{ data: loading ? Skeleton : undefined }} />

            <GridColumn
              field="secrecy"
              title="Secrecy"
              width="120px"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={oldLettersSecrecyOptions} />
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

            <GridColumn
              title="MR"
              width="45px"
              headerCell={() => <span title="Movement Register">MR</span>}
              filterable={false}
              sortable={false}
              resizable={false}
              cells={{ data: loading ? Skeleton : ActionCell }}
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

export default OldLetters;
