import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { process } from "@progress/kendo-data-query";
import { useSelector } from "react-redux";
import { usePublishIv } from "../../../../hooks/usePublishIv";
import CircularViewer from "../../../../components/iv/CircularViewer";

import { useCircularsData } from "./hooks/useCircularsData";
import { useCircularFilters } from "./hooks/useCircularFilters";
import { useCircularFavourites } from "./hooks/useCircularFavourites";
import { useCopyLink } from "./hooks/useCopyLink";
import { useCircularGridCells } from "./hooks/useCircularGridCells";
import CircularFilterBar from "./CircularFilterBar";
import AllCircularsDialog from "./AllCircularsDialog";
import { DEFAULT_PAGE_SIZE } from "./constants";
import "./Circulars.css";

const Circulars = ({ onAllCircularsDialogToggle }) => {
  const { userProfile } = useSelector((state) => state?.login);
  const userProfileId = userProfile?.properties?.id;
  const { publish: publishIv } = usePublishIv();

  // ── Data (entries, loading, pagination, mapping, fetch functions) ──────────
  const {
    favouriteCircularsLoading,
    allCircularsLoading,
    searchResultsLoading,
    mappedFavouriteCirculars,
    mappedSearchResults,
    mappedAllCirculars,
    hasAllCircularsLoaded,
    mainGridPagination,
    dialogPagination,
    favourites,
    setFavourites,
    setSearchResultsEntries,
    fetchFavouriteCircularsData,
    fetchAllCircularsData,
    fetchSearchResults,
    updatePublishingIdInEntries,
    safeAlert,
    favouriteFetchParams,
  } = useCircularsData({ userProfileId });

  // ── Filters (filter state, department options, buildSearchParams) ──────────
  const {
    filterDepartment,
    setFilterDepartment,
    filterYear,
    setFilterYear,
    filterInternalExternal,
    setFilterInternalExternal,
    filterLanguage,
    setFilterLanguage,
    searchName,
    setSearchName,
    departmentOptions,
    yearOptions,
    buildSearchParams,
    clearFilters,
  } = useCircularFilters();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false);
  const [showViewerDialog, setShowViewerDialog] = useState(false);
  const [showFavouriteDialog, setShowFavouriteDialog] = useState(false);
  const [selectedCircular, setSelectedCircular] = useState(null);
  const [isRepublishing, setIsRepublishing] = useState(false);
  const [mainGridCurrentPage, setMainGridCurrentPage] = useState(1);
  const [dialogCurrentPage, setDialogCurrentPage] = useState(1);

  // ── Dialog filter state ──────────────────────────────────────────────────
  const [dialogFilterDept, setDialogFilterDept] = useState(null);
  const [dialogFilterYear, setDialogFilterYear] = useState(null);
  const [dialogFilterType, setDialogFilterType] = useState(null);
  const [dialogFilterLanguage, setDialogFilterLanguage] = useState(null);
  const [dialogSearchName, setDialogSearchName] = useState("");
  const [dataState, setDataState] = useState({
    sort: [{ field: "circular_date", dir: "desc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });
  const [favouriteDataState, setFavouriteDataState] = useState({
    sort: [{ field: "circular_date", dir: "desc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  // ── Copy link ─────────────────────────────────────────────────────────────
  const { copiedLinks, errorMessages, copyLinkLoading, handleCopyLink } = useCopyLink({
    onPublishingIdUpdate: updatePublishingIdInEntries,
  });

  // ── Circular click — defined BEFORE useCircularGridCells (it takes this as a dep) ──
  const handleCircularClick = useCallback(
    async (circular) => {
      if (!circular) return;

      if (circular.publishing_id) {
        setSelectedCircular({ ...circular });
        setShowViewerDialog(true);
        return;
      }

      if (isRepublishing) return;

      if (!circular.id) {
        safeAlert("Warning", "Unable to identify the selected circular.", "warning");
        return;
      }

      setIsRepublishing(true);
      try {
        const publicationId = await publishIv(String(circular.id));
        if (publicationId) {
          updatePublishingIdInEntries(circular.id, publicationId);
          setSelectedCircular({ ...circular, publishing_id: publicationId });
          setShowViewerDialog(true);
        } else {
          safeAlert("Info", "This circular does not have a published document. The publishing ID is unavailable.", "info");
        }
      } catch {
        safeAlert("Info", "This circular does not have a published document. The publishing ID is unavailable.", "info");
      } finally {
        setIsRepublishing(false);
      }
    },
    [isRepublishing, publishIv, updatePublishingIdInEntries, safeAlert],
  );

  // ── Favourite toggle ──────────────────────────────────────────────────────
  const { favouriteLoading, handleFavouriteToggle } = useCircularFavourites({
    favourites,
    setFavourites,
    favouriteFetchParams,
    fetchFavouriteCircularsData,
    buildSearchParams,
    isShowingSearchResults,
    mainGridCurrentPage,
    setSearchResultsEntries,
    safeAlert,
  });

  // ── Memoized grid cell components ─────────────────────────────────────────
  const { CircularNoCell, DescriptionCell, DateCell, FavouriteCell, CopyLinkCell } = useCircularGridCells({
    favourites,
    favouriteLoading,
    isFavouriteListRefreshing: favouriteCircularsLoading,
    copiedLinks,
    copyLinkLoading,
    errorMessages,
    onFavouriteToggle: handleFavouriteToggle,
    onCopyLink: handleCopyLink,
    onCircularClick: handleCircularClick,
  });

  // ── Search handlers ───────────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (page = 1) => {
      const searchParams = buildSearchParams(page);
      setIsShowingSearchResults(true);
      const entries = await fetchSearchResults(searchParams);
      if (entries !== null) {
        setMainGridCurrentPage(page);
        if (page === 1) setDataState((prev) => ({ ...prev, skip: 0 }));
      }
    },
    [buildSearchParams, fetchSearchResults],
  );

  const handleClearFilters = useCallback(async () => {
    clearFilters();
    setIsShowingSearchResults(false);
    setMainGridCurrentPage(1);
    setDataState((prev) => ({ ...prev, skip: 0 }));
    if (favouriteFetchParams) await fetchFavouriteCircularsData();
  }, [clearFilters, favouriteFetchParams, fetchFavouriteCircularsData]);

  const handleGetFavourites = useCallback(async () => {
    // Reset dialog filters and pagination when opening
    setDialogFilterDept(null);
    setDialogFilterYear(null);
    setDialogFilterType(null);
    setDialogFilterLanguage(null);
    setDialogSearchName("");
    setDialogCurrentPage(1);
    setFavouriteDataState((prev) => ({ ...prev, skip: 0 }));
    const entries = await fetchAllCircularsData(1, {});
    if (entries !== null) {
      setShowFavouriteDialog(true);
      onAllCircularsDialogToggle?.(true);
    }
  }, [fetchAllCircularsData, onAllCircularsDialogToggle]);

  // ── Dialog filter handlers ───────────────────────────────────────────────
  const buildDialogFilterParams = useCallback(() => {
    const params = {};
    const trimmed = dialogSearchName.trim();
    if (trimmed) params.input_search_all = trimmed;
    if (dialogFilterDept?.text) params.input_department = dialogFilterDept.text;
    if (dialogFilterYear?.value) {
      const yearNumber = Number(dialogFilterYear.value);
      if (!Number.isNaN(yearNumber)) params.input_circular_year = yearNumber;
    }
    if (dialogFilterType?.value) params.input_internal_external = dialogFilterType.value;
    if (dialogFilterLanguage?.value) params.input_language = dialogFilterLanguage.value;
    return params;
  }, [dialogSearchName, dialogFilterDept, dialogFilterYear, dialogFilterType, dialogFilterLanguage]);

  const handleDialogSearch = useCallback(
    async (page = 1) => {
      setDialogCurrentPage(1);
      setFavouriteDataState((prev) => ({ ...prev, skip: 0 }));
      await fetchAllCircularsData(page, buildDialogFilterParams());
    },
    [fetchAllCircularsData, buildDialogFilterParams],
  );

  const handleDialogClearFilters = useCallback(async () => {
    setDialogFilterDept(null);
    setDialogFilterYear(null);
    setDialogFilterType(null);
    setDialogFilterLanguage(null);
    setDialogSearchName("");
    setDialogCurrentPage(1);
    setFavouriteDataState((prev) => ({ ...prev, skip: 0 }));
    await fetchAllCircularsData(1, {});
  }, [fetchAllCircularsData]);

  // ── Grid data state changes (pagination) ─────────────────────────────────
  const handleDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);
      const newPage = Math.floor(newDataState.skip / DEFAULT_PAGE_SIZE) + 1;
      if (newPage !== mainGridCurrentPage) {
        setMainGridCurrentPage(newPage);
        if (isShowingSearchResults) handleSearch(newPage);
        else fetchFavouriteCircularsData(newPage);
      }
    },
    [mainGridCurrentPage, isShowingSearchResults, handleSearch, fetchFavouriteCircularsData],
  );

  const handleFavouriteDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setFavouriteDataState(newDataState);
      const newPage = Math.floor(newDataState.skip / DEFAULT_PAGE_SIZE) + 1;
      if (newPage !== dialogCurrentPage) {
        setDialogCurrentPage(newPage);
        fetchAllCircularsData(newPage);
      }
    },
    [dialogCurrentPage, fetchAllCircularsData],
  );

  // ── Refresh dialog when favourites change while it is open ────────────────
  useEffect(() => {
    if (showFavouriteDialog && hasAllCircularsLoaded) fetchAllCircularsData(dialogCurrentPage);
  }, [favourites, showFavouriteDialog, hasAllCircularsLoaded, fetchAllCircularsData, dialogCurrentPage]);

  // ── Derived grid data ─────────────────────────────────────────────────────
  const gridLoading = isShowingSearchResults ? searchResultsLoading : favouriteCircularsLoading;
  const gridData = isShowingSearchResults ? mappedSearchResults : mappedFavouriteCirculars;

  const processedData = useMemo(() => {
    const result = process(gridData, { sort: dataState.sort, filter: dataState.filter });
    result.total = mainGridPagination.total;
    return result;
  }, [gridData, dataState.sort, dataState.filter, mainGridPagination.total]);

  const allCircularsProcessedData = useMemo(() => {
    const result = process(mappedAllCirculars, {
      sort: favouriteDataState.sort,
      filter: favouriteDataState.filter,
    });
    result.total = dialogPagination.total;
    return result;
  }, [mappedAllCirculars, favouriteDataState.sort, favouriteDataState.filter, dialogPagination.total]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {gridLoading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      {isRepublishing && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
          <div className="k-loading-text circulars-republishing-text">Publishing document, please wait...</div>
        </div>
      )}

      <div className="table-container">
        <CircularFilterBar
          filterDepartment={filterDepartment}
          onFilterDepartmentChange={setFilterDepartment}
          filterYear={filterYear}
          onFilterYearChange={setFilterYear}
          filterInternalExternal={filterInternalExternal}
          onFilterInternalExternalChange={setFilterInternalExternal}
          filterLanguage={filterLanguage}
          onFilterLanguageChange={setFilterLanguage}
          searchName={searchName}
          onSearchNameChange={setSearchName}
          departmentOptions={departmentOptions}
          yearOptions={yearOptions}
          onSearch={handleSearch}
          onClearFilters={handleClearFilters}
          onGetFavourites={handleGetFavourites}
          isFavouriteListRefreshing={favouriteCircularsLoading}
        />

        <div className="document-table circular-table-active">
          {!gridLoading && !isShowingSearchResults && mappedFavouriteCirculars.length === 0 ? (
            <div className="text-center circulars-empty-state">
              <p className="circulars-empty-title">No favorite circulars found.</p>
              <p className="text-muted small mb-0">
                <span className="text-decoration-underline cursor-pointer color-blue" onClick={handleGetFavourites}>
                  Mark circulars as favorites
                </span>{" "}
                to see them here.
              </p>
            </div>
          ) : (
            <div className="view-reference-data-grid">
              <Grid
                {...dataState}
                data={processedData.data}
                total={processedData.total}
                sortable
                resizable
                pageable={{ info: true, buttonCount: 5, pageSizes: false }}
                onDataStateChange={handleDataStateChange}
              >
                <GridColumn field="circular_no" title="Circular No." cells={{ data: CircularNoCell }} />
                <GridColumn field="description" title="Description" cells={{ data: DescriptionCell }} />
                <GridColumn field="circular_date" title="Date" cells={{ data: DateCell }} width="75px" />
                <GridColumn field="department" title="Department" width="90px" />
                <GridColumn field="id" title="Favourite" cells={{ data: FavouriteCell }} width="70px" />
                <GridColumn field="id" title="Link" cells={{ data: CopyLinkCell }} width="50px" />
              </Grid>
            </div>
          )}
        </div>

        {showViewerDialog && (
          <Dialog
            title={selectedCircular?.circular_no || "Circular Viewer"}
            onClose={() => {
              setShowViewerDialog(false);
              setSelectedCircular(null);
            }}
            width="50vw"
            height="90vh"
            className="circular-viewer-dialog"
          >
            <div>
              <CircularViewer publicationId={selectedCircular?.publishing_id} ivTitle={selectedCircular?.circular_no || "Circular"} instanceId="circular-viewer" />
            </div>
            <DialogActionsBar>
              <div className="d-flex justify-content-end mt-3 gap-2">
                <Button className="common-btn-css submit-button me-2" onClick={() => setShowViewerDialog(false)}>
                  Close
                </Button>
              </div>
            </DialogActionsBar>
          </Dialog>
        )}

        {showFavouriteDialog && (
          <AllCircularsDialog
            isLoading={allCircularsLoading}
            data={allCircularsProcessedData.data}
            total={allCircularsProcessedData.total}
            dataState={favouriteDataState}
            onDataStateChange={handleFavouriteDataStateChange}
            onClose={() => {
              setShowFavouriteDialog(false);
              onAllCircularsDialogToggle?.(false);
            }}
            filterBarProps={{
              filterDepartment: dialogFilterDept,
              onFilterDepartmentChange: setDialogFilterDept,
              filterYear: dialogFilterYear,
              onFilterYearChange: setDialogFilterYear,
              filterInternalExternal: dialogFilterType,
              onFilterInternalExternalChange: setDialogFilterType,
              filterLanguage: dialogFilterLanguage,
              onFilterLanguageChange: setDialogFilterLanguage,
              searchName: dialogSearchName,
              onSearchNameChange: setDialogSearchName,
              departmentOptions,
              yearOptions,
              onSearch: handleDialogSearch,
              onClearFilters: handleDialogClearFilters,
            }}
            CircularNoCell={CircularNoCell}
            DescriptionCell={DescriptionCell}
            DateCell={DateCell}
            FavouriteCell={FavouriteCell}
            CopyLinkCell={CopyLinkCell}
          />
        )}
      </div>
    </>
  );
};

export default Circulars;
