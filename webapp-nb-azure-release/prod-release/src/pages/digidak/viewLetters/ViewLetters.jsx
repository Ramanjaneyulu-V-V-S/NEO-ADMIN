import { useCallback, useMemo, useRef, useState, useEffect } from "react";

//component
import Layout from "../../../components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

//kendo react
import { process } from "@progress/kendo-data-query";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { ExcelExport } from "@progress/kendo-react-excel-export";

//inline svg icons
const ResetIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 2v6h6M21.5 22v-6h-6" />
    <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.3" />
  </svg>
);

import "./ViewLetters.css";
import DigidakStats from "./DigidakStats";
import { formatDateOnly } from "../../../utils/Utils";
import { useDigidakDashboardData } from "../../../hooks/useDigidakDashboardData";
import DigidakExportButton from "../../../components/digidak/DigidakExportButton";

const InboxIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M121 32C91.6 32 66 52 58.9 80.5L1.9 308.4C.6 313.5 0 318.7 0 323.9V416c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64v-92.1c0-5.2-.6-10.4-1.9-15.5l-57-227.9C446 52 420.4 32 391 32H121zm0 64h270l48 192H352c-17.7 0-32 14.3-32 32v16c0 8.8-7.2 16-16 16H208c-8.8 0-16-7.2-16-16v-16c0-17.7-14.3-32-32-32H73l48-192z" />
  </svg>
);
const ClockIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120v136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z" />
  </svg>
);
const WarningIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0-64 0 32 32 0 1 0 64 0z" />
  </svg>
);
const PaperPlaneIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M476.59 227.05l-.16-.07L49.35 49.84A23.56 23.56 0 0 0 27.14 52 24.65 24.65 0 0 0 16 72.59V185.88a24 24 0 0 0 19.52 23.57l176.38 33.41L35.52 276.55A24 24 0 0 0 16 300.12V413.41a24.65 24.65 0 0 0 11.14 20.59 23.74 23.74 0 0 0 13.26 4 24.27 24.27 0 0 0 8.95-1.75l427.08-177.14a25 25 0 0 0 .16-32.06z" />
  </svg>
);
const ReplyIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M205 34.8c11.5 5.1 19 16.6 19 29.2v64h112C399.4 128 448 176.6 448 240v56.1c0 13.8-8.8 26.1-21.9 30.6s-27.4 .3-35.5-10.4c-24.7-32.6-63.4-53.3-106.6-53.3H224v64c0 12.6-7.4 24.1-19 29.2s-25 3-34.4-5.4l-160-144C3.9 200.9 0 192.5 0 184s3.9-16.9 10.6-23.8l160-144c9.4-8.5 22.9-10.6 34.4-5.4z" />
  </svg>
);

import {
  DIGIDAK_ISSUED_STATUSES_ALL,
  DIGIDAK_ISSUED_STATUSES_PENDING,
  DIGIDAK_RECEIVED_STATUSES_WITH_CLOSED,
  DIGIDAK_RECEIVED_STATUSES_ACTION,
  DIGIDAK_RECEIVED_STATUSES_MONTH,
} from "../../data/DropdownData";

const summarySkeletonRows = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  office_department: "",
  total_received: "",
  pending_action: "",
  pending_1_month: "",
  total_issued: "",
  pending_response: "",
  response_1_month: "",
}));

const ViewLetters = () => {
  const excelExportRef = useRef(null);
  const navigate = useNavigate();

  const { isDMDChairman } = useSelector((state) => state.digidakInbox);

  // Restore saved state from sessionStorage (before hooks)
  const savedStateRef = useRef(null);
  if (savedStateRef.current === null) {
    try {
      const stored = sessionStorage.getItem("viewLettersSelection");
      if (stored) {
        savedStateRef.current = JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
  }
  const savedState = savedStateRef.current;

  // Clear sessionStorage after reading
  useEffect(() => {
    sessionStorage.removeItem("viewLettersSelection");
  }, []);

  const [hasSearched, setHasSearched] = useState(!!savedState);

  useEffect(() => {
    if (!isDMDChairman) {
      navigate("/dashboard");
    }
  }, [isDMDChairman, navigate]);

  // Date filter state
  const [dateFilters, setDateFilters] = useState({
    from: savedState?.dateFilters?.from ? new Date(savedState.dateFilters.from) : new Date("2025-11-01"),
    to: savedState?.dateFilters?.to ? new Date(savedState.dateFilters.to) : new Date(),
  });

  const priorDate = useMemo(() => {
    const today = new Date();
    const d = new Date(dateFilters.to);
    d.setDate(today.getDate() - 30);
    return d;
  }, [dateFilters.to]);

  // Hook
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    recipients,
    selectedRecipientValue,
    setSelectedRecipientValue,
    dashboardCounts,
    dashboardGridData,
    triggerUnifiedFetch,
    loading,
    resetFilters,
  } = useDigidakDashboardData(dateFilters.from, dateFilters.to, {
    autoFetch: false,
    enabled: true,
    initialCategory: savedState?.selectedCategory,
    initialRecipient: savedState?.selectedRecipientValue,
  });

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: 100,
    filter: null,
  });

  const handleDataStateChange = useCallback((e) => {
    setDataState(e.dataState);
  }, []);

  // Handle Go
  const handleGo = async (e) => {
    e.preventDefault();
    setHasSearched(true);
    try {
      await triggerUnifiedFetch();
    } catch (error) {
      console.error(error);
    }
  };

  // Validation Logic for GO Button
  const isAllCategory = selectedCategory?.text?.startsWith("ALL");
  const areDropdownsValid = isAllCategory ? !!selectedCategory : selectedCategory && selectedRecipientValue;
  const isGoDisabled = !areDropdownsValid;

  // Row selection state
  const [selectedRow, setSelectedRow] = useState(null);

  // Handle reset
  const handleReset = () => {
    setDateFilters({ from: new Date("2025-11-01"), to: new Date() });
    setHasSearched(false);
    setSelectedRow(null);
    resetFilters();
  };

  const handleRowClick = useCallback((e) => {
    setSelectedRow(e.dataItem);
  }, []);

  const summaryGridData = useMemo(() => {
    const deptNames = dashboardGridData?.out_dashboard_dept_names || [];
    if (deptNames.length === 0) return [];

    const getStat = (arr, index) => (Array.isArray(arr) && arr[index] !== undefined ? arr[index] : 0);

    return deptNames.map((dept, index) => ({
      id: dashboardGridData?.out_dashboard_sl_no?.[index] ?? index + 1,
      office_department: dept,
      total_received: getStat(dashboardGridData?.out_dashboard_total_received, index),
      pending_action: getStat(dashboardGridData?.out_dashboard_pending_action, index),
      pending_1_month: getStat(dashboardGridData?.out_dashboard_action_a_month, index),
      total_issued: getStat(dashboardGridData?.out_dashboard_total_issued, index),
      pending_response: getStat(dashboardGridData?.out_dashboard_pending_response, index),
      response_1_month: getStat(dashboardGridData?.out_dashboard_response_a_month, index),
    }));
  }, [dashboardGridData]);

  // Restore selected row once grid data is available
  useEffect(() => {
    if (savedState?.selectedDepartment && summaryGridData.length > 0 && !selectedRow) {
      const match = summaryGridData.find((r) => r.office_department === savedState.selectedDepartment);
      if (match) setSelectedRow(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only restore when grid data becomes available
  }, [summaryGridData]);

  const allRecipientTexts = useMemo(() => dashboardGridData?.out_dashboard_dept_names || [], [dashboardGridData]);

  // Determine input_regions (Array) and input_region (Single)
  const inputRegionsValue = useMemo(() => (selectedRow ? [selectedRow.office_department] : allRecipientTexts), [selectedRow, allRecipientTexts]);
  const inputRegionValue = selectedRow ? selectedRow.office_department : selectedRecipientValue ? selectedRecipientValue.text : allRecipientTexts?.[0];

  const BAR_CLICK_CONFIG = useMemo(() => {
    const fromDateStr = formatDateOnly(dateFilters.from);
    const toDateStr = formatDateOnly(dateFilters.to);
    const priorDateStr = formatDateOnly(priorDate);
    const regionsStr = inputRegionsValue.join(",");

    const issuedBase = {
      queryName: "digidak.dashboard.outbox",
      region: inputRegionValue,
      regions: regionsStr,
      decision: "Outward",
      vertical: "",
      source_vertical: "",
      cgm_group: "",
      type_category: "",
      from_date: fromDateStr,
      to_date: toDateStr,
    };

    const receivedBase = {
      queryName: "digidak.dashboard.inbox",
      regions: regionsStr,
      region: inputRegionValue,
      wfgroup: "",
      group: "",
      task_category: "",
      selected_cgm_group: "",
      from_date: fromDateStr,
      to_date: toDateStr,
    };

    return {
      issuedTabOne: { tab: "issued", params: { ...issuedBase, status: DIGIDAK_ISSUED_STATUSES_ALL, type_category: "" } },
      issuedTabTwo: { tab: "issued", params: { ...issuedBase, status: DIGIDAK_ISSUED_STATUSES_PENDING, type_category: "Information" } },
      issuedTabFive: { tab: "issued", params: { ...issuedBase, status: DIGIDAK_ISSUED_STATUSES_PENDING, from_date: "", to_date: priorDateStr, type_category: "Actionable" } },
      receivedTabOne: { params: { ...receivedBase, status: DIGIDAK_RECEIVED_STATUSES_WITH_CLOSED, task_category: "" } },
      receivedTabThree: { params: { ...receivedBase, status: DIGIDAK_RECEIVED_STATUSES_ACTION, task_category: "Actionable" } },
      receivedTabFive: { params: { ...receivedBase, status: DIGIDAK_RECEIVED_STATUSES_MONTH, from_date: "", to_date: priorDateStr, task_category: "Actionable" } },
    };
  }, [dateFilters.from, dateFilters.to, priorDate, inputRegionsValue, inputRegionValue]);

  const issuedByUsData = useMemo(
    () => [
      {
        tab: "issuedTabOne",
        label: "Total issued",
        value: [selectedRow ? selectedRow.total_issued : dashboardCounts?.out_count_total_issued?.[0] || 0],
        icon: PaperPlaneIcon,
        cardClass: "bg-approved",
        iconClass: "icon-approved",
      },
      {
        tab: "issuedTabTwo",
        label: "Pending for Information",
        value: [selectedRow ? selectedRow.pending_response : dashboardCounts?.out_count_pending_response?.[0] || 0],
        icon: ReplyIcon,
        cardClass: "bg-draft",
        iconClass: "icon-draft",
      },
      {
        tab: "issuedTabFive",
        label: "Response > a month",
        value: [selectedRow ? selectedRow.response_1_month : dashboardCounts?.out_count_response_a_month?.[0] || 0],
        icon: WarningIcon,
        cardClass: "bg-cancelled",
        iconClass: "icon-cancelled",
      },
    ],
    [selectedRow, dashboardCounts],
  );

  const receivedByUsData = useMemo(
    () => [
      {
        tab: "receivedTabOne",
        label: "Total Received by us",
        value: [selectedRow ? selectedRow.total_received : dashboardCounts?.out_count_total_received?.[0] || 0],
        icon: InboxIcon,
        cardClass: "bg-total",
        iconClass: "icon-total",
      },
      {
        tab: "receivedTabThree",
        label: "Pending for Action",
        value: [selectedRow ? selectedRow.pending_action : dashboardCounts?.out_count_pending_action?.[0] || 0],
        icon: ClockIcon,
        cardClass: "bg-progress",
        iconClass: "icon-progress",
      },
      {
        tab: "receivedTabFive",
        label: "Pending > a month",
        value: [selectedRow ? selectedRow.pending_1_month : dashboardCounts?.out_count_action_a_month?.[0] || 0],
        icon: WarningIcon,
        cardClass: "bg-cancelled",
        iconClass: "icon-cancelled",
      },
    ],
    [selectedRow, dashboardCounts],
  );

  const processedData = useMemo(() => process(summaryGridData, dataState), [summaryGridData, dataState]);

  const gridData = useMemo(() => {
    if (loading) return summarySkeletonRows;
    return {
      ...processedData,
      data: processedData.data?.map((item) => ({
        ...item,
        selected: selectedRow?.office_department === item.office_department,
      })),
    };
  }, [loading, processedData, selectedRow]);

  const handleCardClick = useCallback(
    (item) => {
      const config = BAR_CLICK_CONFIG[item.tab];
      if (!config) return;

      const isIssuedTab = item.tab.startsWith("issued");
      const targetRoute = isIssuedTab ? "/digidak-outbox" : "/digidak-inbox";

      let headerContext = "";
      if (selectedRow) {
        headerContext = selectedRow.office_department;
      } else if (selectedRecipientValue) {
        headerContext = selectedRecipientValue.text;
      } else if (selectedCategory) {
        headerContext = selectedCategory.text;
      }

      sessionStorage.setItem(
        "viewLettersSelection",
        JSON.stringify({
          selectedCategory,
          selectedRecipientValue,
          dateFilters,
          selectedDepartment: selectedRow?.office_department || null,
        }),
      );

      navigate(targetRoute, {
        state: {
          tabName: "viewLettersTab",
          pieChartStatus: item.label,
          pieChartCount: item.value?.[0] || 0,
          dashboardParams: config.params,
          headerContext,
          fromDate: dateFilters.from,
          toDate: dateFilters.to,
        },
      });
    },
    [BAR_CLICK_CONFIG, selectedRow, selectedRecipientValue, selectedCategory, dateFilters, navigate],
  );

  return (
    <Layout>
      {loading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <DigidakStats receivedData={receivedByUsData} issuedData={issuedByUsData} handleCardClick={handleCardClick} />

      <div className="main-container-filter main-container-filter--view">
        <form onSubmit={handleGo}>
          <div className="row g-3 align-items-end">
            <div className="col-xs-12 col-sm-6 col-md-2">
              <DatePicker
                format="dd/MM/yyyy"
                placeholder="From Date"
                value={dateFilters.from}
                onChange={(e) => setDateFilters({ ...dateFilters, from: e.value })}
                max={new Date()}
              />
            </div>
            <div className="col-xs-12 col-sm-6 col-md-2">
              <DatePicker
                format="dd/MM/yyyy"
                placeholder="To Date"
                value={dateFilters.to}
                onChange={(e) => setDateFilters({ ...dateFilters, to: e.value })}
                min={dateFilters.from || undefined}
                max={new Date()}
              />
            </div>

            {/* HO / RO / TE Category */}
            <div className="col-xs-12 col-sm-3 col-md-2">
              <DropDownList
                data={categories}
                textField="text"
                dataItemKey="value"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.value);
                  setSelectedRecipientValue(null);
                }}
                className="priority-dropdown"
              />
            </div>

            {/* Dependent Recipient */}
            {!selectedCategory?.text?.startsWith("ALL") && (
              <div className="col-xs-12 col-sm-3 col-md-2">
                <DropDownList
                  data={recipients}
                  textField="text"
                  dataItemKey="value"
                  value={selectedRecipientValue}
                  onChange={(e) => {
                    setSelectedRecipientValue(e.value);
                  }}
                  className="priority-dropdown"
                  disabled={!selectedCategory}
                />
              </div>
            )}

            <div className="col-xs-12 col-sm-6 col-md-auto d-flex gap-2">
              {hasSearched && (
                <Button className="common-btn-css min-width-50 cancel-button me-2 " onClick={handleReset}>
                  <ResetIcon style={{ width: 14, height: 14 }} />
                </Button>
              )}
              <Button className="common-btn-css min-width-50 submit-button" disabled={isGoDisabled}>
                GO
              </Button>
            </div>
            <div className="col-xs-12 col-sm-6 col-md-2 text-end ms-auto">
              <DigidakExportButton excelExportRef={excelExportRef} data={processedData?.data} />
            </div>
          </div>
        </form>

        <div className="view-table-container mt-3">
          <ExcelExport data={processedData} fileName="Digidak_Summary.xlsx" ref={excelExportRef}>
            <Grid
              {...dataState}
              data={gridData}
              dataItemKey="id"
              selectedField="selected"
              selectable={{
                enabled: true,
                mode: "single",
              }}
              onRowClick={handleRowClick}
              sortable
              resizable
              onDataStateChange={handleDataStateChange}
            >
              <GridColumn field="id" title="S.No." width="85px" />
              <GridColumn field="office_department" title="Office/Department" />
              <GridColumn title="Received" headerClassName="received-header-group">
                <GridColumn field="total_received" title="Total Received" headerClassName="received-col" />
                <GridColumn field="pending_action" title="Pending For Action" headerClassName="received-col" />
                <GridColumn field="pending_1_month" title="Pending > 1 Month" headerClassName="received-col" />
              </GridColumn>
              <GridColumn title="Issued" headerClassName="issued-header-group">
                <GridColumn field="total_issued" title="Total Issued" headerClassName="issued-col" />
                <GridColumn field="pending_response" title="Pending For Response" headerClassName="issued-col" />
                <GridColumn field="response_1_month" title="Response > 1 Month" headerClassName="issued-col" />
              </GridColumn>
            </Grid>
          </ExcelExport>
        </div>
      </div>
    </Layout>
  );
};

export default ViewLetters;
