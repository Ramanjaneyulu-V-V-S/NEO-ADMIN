import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { process } from "@progress/kendo-data-query";

const DEFAULT_DATA_STATE = {
  sort: [{ field: "id", dir: "desc" }],
  skip: 0,
  take: 50,
  filter: null,
};

const readStorage = (key) => {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Custom hook to manage server-side grid state (pagination, filtering, debounce).
 *
 * @param {Object} options
 * @param {Object}   options.filterFieldMap      – maps grid field → API param key
 * @param {Set}      options.textFilterFields     – fields that require debounce
 * @param {number}   options.pageSize             – items per page (default 50)
 * @param {Function} options.onFetch              – (page, activeFilters) => void — caller dispatches
 * @param {Function} options.onResetPagination    – () => void — caller dispatches reset action
 * @param {Array}    options.data                 – mapped array for client-side processing
 * @param {number}   options.paginationTotal      – total count from redux pagination
 * @param {Array}    [options.initialSort]        – initial sort descriptor
 * @param {string}   [options.storageKey]         – sessionStorage key for persisting grid state across navigation; omit to disable
 */
const useServerSideGrid = ({ filterFieldMap, textFilterFields, pageSize = 50, onFetch, onResetPagination, data = [], paginationTotal = 0, initialSort, storageKey = null }) => {
  const filterDebounceRef = useRef(null);
  // Prevents the auto-save effect from re-writing storage immediately after resetGridState clears it
  const suppressNextSaveRef = useRef(false);

  // Detect whether there is persisted state to restore (evaluated once at init)
  const [isStateRestored] = useState(() => !!readStorage(storageKey));

  const [currentPage, setCurrentPage] = useState(() => readStorage(storageKey)?.currentPage ?? 1);
  const [filterSearchParams, setFilterSearchParams] = useState(() => readStorage(storageKey)?.filterSearchParams ?? null);
  const [dataState, setDataState] = useState(() => {
    const saved = readStorage(storageKey);
    if (saved?.dataState) return saved.dataState;
    return {
      ...DEFAULT_DATA_STATE,
      take: pageSize,
      ...(initialSort ? { sort: initialSort } : {}),
    };
  });

  // Auto-save grid state to sessionStorage on every change
  useEffect(() => {
    if (!storageKey) return;
    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ dataState, currentPage, filterSearchParams }));
    } catch {
      // sessionStorage may be unavailable (private browsing / quota exceeded)
    }
  }, [storageKey, dataState, currentPage, filterSearchParams]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  const buildActiveFilters = useCallback(
    (filter) => {
      if (!filter?.filters) return null;
      const result = {};
      filter.filters.forEach((f) => {
        const apiKey = filterFieldMap[f.field];
        if (apiKey && f.value) {
          if (Array.isArray(apiKey)) {
            apiKey.forEach((k) => {
              result[k] = f.value;
            });
          } else {
            result[apiKey] = f.value;
          }
        }
      });
      return Object.keys(result).length > 0 ? result : null;
    },
    [filterFieldMap],
  );

  const handleDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);

      const newPage = Math.floor(newDataState.skip / pageSize) + 1;

      // Detect filter changes across all mapped fields
      const newActiveFilters = buildActiveFilters(newDataState.filter);
      const prevActiveFilters = buildActiveFilters(dataState.filter);
      const filtersChanged = JSON.stringify(newActiveFilters) !== JSON.stringify(prevActiveFilters);

      if (filtersChanged) {
        // Check if any changed filter is a text field (needs debounce)
        const newFilters = newDataState.filter?.filters || [];
        const prevFilters = dataState.filter?.filters || [];
        const hasTextFilterChange = newFilters.some((f) => {
          if (!textFilterFields.has(f.field)) return false;
          const prev = prevFilters.find((p) => p.field === f.field);
          return !prev || prev.value !== f.value;
        });

        const executeSearch = () => {
          setFilterSearchParams(newActiveFilters);
          setCurrentPage(1);
          onResetPagination();
          onFetch(1, newActiveFilters);
        };

        // Clear any pending debounce
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
        onFetch(newPage, filterSearchParams);
      }
    },
    [currentPage, pageSize, dataState.filter, filterSearchParams, buildActiveFilters, textFilterFields, onFetch, onResetPagination],
  );

  // Reset grid state — call from form submit / reset handlers
  const resetGridState = useCallback(() => {
    // Suppress the auto-save effect so the cleared storage isn't immediately re-written with default state
    suppressNextSaveRef.current = true;
    setCurrentPage(1);
    setFilterSearchParams(null);
    setDataState((prev) => ({ ...prev, skip: 0, take: pageSize, filter: null }));
    onResetPagination();
    if (storageKey) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
      // sessionStorage may be unavailable (private browsing / quota exceeded)
    }
    }
  }, [pageSize, onResetPagination, storageKey]);

  // Client-side sort only; filtering is server-side to avoid double-filtering already-filtered results
  const processedData = useMemo(() => {
    const result = process(data, { sort: dataState.sort });
    result.total = paginationTotal;
    return result;
  }, [data, dataState.sort, paginationTotal]);

  return {
    dataState,
    setDataState,
    currentPage,
    filterSearchParams,
    isStateRestored,
    handleDataStateChange,
    processedData,
    resetGridState,
  };
};

export default useServerSideGrid;
