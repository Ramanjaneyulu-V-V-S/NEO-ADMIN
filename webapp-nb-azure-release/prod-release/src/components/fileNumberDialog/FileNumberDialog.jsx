import { useState, useCallback, useRef, useEffect } from "react";

//kendo react
import { orderBy } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { RadioButton } from "@progress/kendo-react-inputs";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

import GroupDropdown from "./GroupDropdown";

const DEFAULT_PAGE_SIZE = 50;

const FILTER_FIELD_MAP = {
  value: "input_name",
  text: "input_description",
};

const FileNumberDialog = ({
  onClose,
  fileNumbers = [],
  selectedFileNumber,
  onSelectFileNumber,
  showGroupDropdown = false,
  onGroupSelect,
  selectedGroup,
  isLoading = false,
  paginationTotal = 0,
  onFetch,
}) => {
  const filterDebounceRef = useRef(null);

  const [dataState, setDataState] = useState({
    sort: [{ field: "value", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const [activeFilters, setActiveFilters] = useState(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  const buildFilterParams = useCallback((filter) => {
    if (!filter?.filters) return null;
    const result = {};
    filter.filters.forEach((f) => {
      const apiKey = FILTER_FIELD_MAP[f.field];
      if (apiKey && f.value) {
        result[apiKey] = f.value;
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  }, []);

  const handleDataStateChange = useCallback(
    (e) => {
      const newState = e.dataState;
      setDataState(newState);

      if (typeof onFetch !== "function") return;

      // Detect filter changes
      const newFilterParams = buildFilterParams(newState.filter);
      const filtersChanged = JSON.stringify(newFilterParams) !== JSON.stringify(activeFilters);

      if (filtersChanged) {
        // Clear any pending debounce
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

        filterDebounceRef.current = setTimeout(() => {
          setActiveFilters(newFilterParams);
          // Reset to page 1 on filter change
          setDataState((prev) => ({ ...prev, skip: 0 }));
          onFetch(1, newFilterParams);
        }, 1000);
        return;
      }

      // Handle page change
      const newPage = Math.floor(newState.skip / DEFAULT_PAGE_SIZE) + 1;
      const currentPage = Math.floor(dataState.skip / DEFAULT_PAGE_SIZE) + 1;
      if (newPage !== currentPage) {
        onFetch(newPage, activeFilters);
      }
    },
    [onFetch, dataState.skip, activeFilters, buildFilterParams],
  );

  // Client-side sort only (filtering is server-side)
  const getProcessedData = () => {
    let data = fileNumbers;
    if (dataState.sort?.length) {
      data = orderBy(data, dataState.sort);
    }
    return { data, total: paginationTotal || data.length };
  };

  const { data, total } = getProcessedData();

  const handelCheckFile = (props) => {
    const fileNumber = props.dataItem;
    const isSelected = selectedFileNumber?.value === fileNumber.value;

    return (
      <td>
        <RadioButton checked={isSelected} onChange={() => onSelectFileNumber(fileNumber)} />
      </td>
    );
  };

  const handleGroupSelect = (value) => {
    if (onGroupSelect) {
      onGroupSelect(value);
    }
  };

  return (
    <Dialog title="File Number" className="file-no-wh" onClose={onClose}>
      {showGroupDropdown && <GroupDropdown onSelect={handleGroupSelect} selectedGroup={selectedGroup} />}

      <div className="file-no-grid">
        {isLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}
        <Grid
          {...dataState}
          data={data}
          total={total}
          sortable
          filterable
          pageable={{
            info: false,
            buttonCount: 10,
            pageSizes: false,
          }}
          onDataStateChange={handleDataStateChange}
        >
          <GridColumn width="60px" title="Select" sortable={false} filterable={false} cells={{ data: handelCheckFile }} />
          <GridColumn width="150px" field="value" title="Value" filter="text" />
          <GridColumn field="text" title="Description" filter="text" />
        </Grid>
      </div>

      <DialogActionsBar>
        <div className="d-flex justify-content-end mt-1 gap-2">
          <Button className="common-btn-css submit-button me-2" onClick={onClose} disabled={!selectedFileNumber}>
            SELECT
          </Button>
        </div>
      </DialogActionsBar>
    </Dialog>
  );
};

export default FileNumberDialog;
