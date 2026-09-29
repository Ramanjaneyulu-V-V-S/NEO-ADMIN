import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { circularsService } from "../../../../../services/caseManagement/circulars/circularsService";
import { showSweetAlert } from "../../../../../components/sweetAlert/SweetAlert";
import { DEFAULT_PAGE_SIZE } from "../constants";

export function useCircularsData({ userProfileId }) {
  const safeAlert = useCallback((title, message, type = "info") => {
    if (typeof showSweetAlert === "function") showSweetAlert(title, message, type);
  }, []);

  const favouriteFetchParams = useMemo(() => (userProfileId ? { input_user_profile_id: userProfileId } : null), [userProfileId]);

  const [favouriteCircularEntries, setFavouriteCircularEntries] = useState([]);
  const [favouriteCircularsLoading, setFavouriteCircularsLoading] = useState(false);
  const [allCircularEntries, setAllCircularEntries] = useState([]);
  const [allCircularsLoading, setAllCircularsLoading] = useState(false);
  const [searchResultsEntries, setSearchResultsEntries] = useState([]);
  const [searchResultsLoading, setSearchResultsLoading] = useState(false);
  const [favourites, setFavourites] = useState(new Set());
  const [mainGridPagination, setMainGridPagination] = useState({ total: 0, page: 1, itemsPerPage: DEFAULT_PAGE_SIZE });
  const [dialogPagination, setDialogPagination] = useState({ total: 0, page: 1, itemsPerPage: DEFAULT_PAGE_SIZE });
  const dialogFilterParamsRef = useRef({});

  const deriveCircularId = useCallback((item) => {
    if (!item) return null;
    const props = item?.content?.properties || item?.properties || {};
    const rawId = props?.r_object_id ?? props?.id ?? props?.object_id ?? props?.circular_id ?? item?.id ?? null;
    return rawId ? String(rawId) : null;
  }, []);

  // Rebuild favourites Set whenever favouriteCircularEntries changes
  useEffect(() => {
    if (!Array.isArray(favouriteCircularEntries)) {
      setFavourites((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const nextSet = new Set(favouriteCircularEntries.map(deriveCircularId).filter(Boolean));
    setFavourites((prev) => {
      if (prev.size === nextSet.size && [...nextSet].every((id) => prev.has(id))) return prev;
      return nextSet;
    });
  }, [favouriteCircularEntries, deriveCircularId]);

  const updatePublishingIdInEntries = useCallback(
    (circularId, newPublishingId) => {
      const patch = (entries) => {
        let changed = false;
        const patched = entries.map((entry) => {
          if (deriveCircularId(entry) !== String(circularId)) return entry;
          changed = true;
          if (entry?.content?.properties) return { ...entry, content: { ...entry.content, properties: { ...entry.content.properties, publishing_id: newPublishingId } } };
          if (entry?.properties) return { ...entry, properties: { ...entry.properties, publishing_id: newPublishingId } };
          return entry;
        });
        return changed ? patched : entries;
      };
      setFavouriteCircularEntries(patch);
      setSearchResultsEntries(patch);
      setAllCircularEntries(patch);
    },
    [deriveCircularId],
  );

  const mapCircularEntries = useCallback(
    (entries, forceFavourite = false) => {
      if (!Array.isArray(entries)) return [];
      return entries
        .map((entry) => {
          const props = entry?.content?.properties || entry?.properties || {};
          const docId = deriveCircularId(entry);
          if (!docId) return null;
          const department = props?.department || props?.category || "";
          if (!department) return null;
          const internalExternal = props?.internal_external || props?.circular_type;
          return {
            id: docId,
            circular_no: props?.circular_number || "",
            description: props?.description || "",
            circular_date: props?.circular_date || "",
            department: String(department),
            is_favourite: forceFavourite || favourites.has(docId),
            is_internal: typeof internalExternal === "string" ? internalExternal.toLowerCase() !== "external" : true,
            publishing_id: props?.publishing_id || "",
            originalDoc: entry,
          };
        })
        .filter(Boolean);
    },
    [favourites, deriveCircularId],
  );

  const fetchFavouriteCircularsData = useCallback(
    async (page = 1) => {
      if (!favouriteFetchParams) {
        safeAlert("Warning", "User information is missing. Please re-login and try again.", "warning");
        return null;
      }
      setFavouriteCircularsLoading(true);
      try {
        const resp = await circularsService.getFavouriteCirculars({
          ...favouriteFetchParams,
          page,
          // start: (page - 1) * DEFAULT_PAGE_SIZE,
          start:0,
          "items-per-page": DEFAULT_PAGE_SIZE,
        });
        const entries = Array.isArray(resp?.entries) ? resp.entries : [];
        setFavouriteCircularEntries(entries);
        const serverTotal = resp?.total || 0;
        const estimatedTotal = serverTotal > 0 ? serverTotal : (entries.length < DEFAULT_PAGE_SIZE ? ((page - 1) * DEFAULT_PAGE_SIZE) + entries.length : page * DEFAULT_PAGE_SIZE + 1);
        setMainGridPagination({ total: estimatedTotal, page, itemsPerPage: DEFAULT_PAGE_SIZE });
        return entries;
      } catch (error) {
        setFavouriteCircularEntries([]);
        safeAlert("Error", error?.message || "Unable to fetch favourite circulars.", "error");
        return null;
      } finally {
        setFavouriteCircularsLoading(false);
      }
    },
    [favouriteFetchParams, safeAlert],
  );

  const fetchAllCircularsData = useCallback(
    async (page = 1, filterParams) => {
      // Store filter params for subsequent pagination calls
      if (filterParams !== undefined) {
        dialogFilterParamsRef.current = filterParams;
      }
      setAllCircularsLoading(true);
      try {
        const resp = await circularsService.getCirculars({
          page,
          // start: (page - 1) * DEFAULT_PAGE_SIZE,
          start:0,
          "items-per-page": DEFAULT_PAGE_SIZE,
          ...dialogFilterParamsRef.current,
        });
        const entries = Array.isArray(resp?.entries) ? resp.entries : [];
        setAllCircularEntries(entries);
        // Use server total if available; otherwise estimate from entries length
        const serverTotal = resp?.total || 0;
        const estimatedTotal = serverTotal > 0 ? serverTotal : (entries.length < DEFAULT_PAGE_SIZE ? ((page - 1) * DEFAULT_PAGE_SIZE) + entries.length : page * DEFAULT_PAGE_SIZE + 1);
        setDialogPagination({ total: estimatedTotal, page, itemsPerPage: DEFAULT_PAGE_SIZE });
        return entries;
      } catch (error) {
        setAllCircularEntries([]);
        safeAlert("Error", error?.message || "Unable to fetch circulars.", "error");
        return null;
      } finally {
        setAllCircularsLoading(false);
      }
    },
    [safeAlert],
  );

  /**
   * Fetches circulars matching the given search params.
   * Caller is responsible for providing pagination fields:
   *   { page, start: (page-1)*DEFAULT_PAGE_SIZE, "items-per-page": DEFAULT_PAGE_SIZE }
   * See buildSearchParams() in useCircularFilters for the canonical builder.
   */
  const fetchSearchResults = useCallback(
    async (searchParams) => {
      setSearchResultsLoading(true);
      try {
        const resp = await circularsService.getCirculars(searchParams);
        const entries = Array.isArray(resp?.entries) ? resp.entries : [];
        setSearchResultsEntries(entries);
        const page = searchParams?.page || 1;
        const serverTotal = resp?.total || 0;
        const estimatedTotal = serverTotal > 0 ? serverTotal : (entries.length < DEFAULT_PAGE_SIZE ? ((page - 1) * DEFAULT_PAGE_SIZE) + entries.length : page * DEFAULT_PAGE_SIZE + 1);
        setMainGridPagination({ total: estimatedTotal, page, itemsPerPage: DEFAULT_PAGE_SIZE });
        return entries;
      } catch (error) {
        setSearchResultsEntries([]);
        safeAlert("Error", error?.message || "Unable to search circulars.", "error");
        return null;
      } finally {
        setSearchResultsLoading(false);
      }
    },
    [safeAlert],
  );

  // Init: load favourite circulars on mount
  useEffect(() => {
    const init = async () => {
      setFavouriteCircularsLoading(true);
      try {
        const resp = favouriteFetchParams
          ? await circularsService.getFavouriteCirculars({ ...favouriteFetchParams, page: 1, start: 0, "items-per-page": DEFAULT_PAGE_SIZE })
          : { entries: [], total: 0 };
        const favs = Array.isArray(resp?.entries) ? resp.entries : [];
        setFavouriteCircularEntries(favs);
        const serverTotal = resp?.total || 0;
        const estimatedTotal = serverTotal > 0 ? serverTotal : favs.length;
        setMainGridPagination({ total: estimatedTotal, page: 1, itemsPerPage: DEFAULT_PAGE_SIZE });
      } catch {
        safeAlert("Error", "Failed to load favourite circulars on init.", "error");
        setFavouriteCircularEntries([]);
      } finally {
        setFavouriteCircularsLoading(false);
      }
    };
    init();
  }, [deriveCircularId, favouriteFetchParams, safeAlert]);

  const mappedFavouriteCirculars = useMemo(() => mapCircularEntries(favouriteCircularEntries, true), [favouriteCircularEntries, mapCircularEntries]);
  const mappedSearchResults = useMemo(() => mapCircularEntries(searchResultsEntries), [searchResultsEntries, mapCircularEntries]);
  const mappedAllCirculars = useMemo(() => mapCircularEntries(allCircularEntries), [allCircularEntries, mapCircularEntries]);

  return {
    favouriteCircularsLoading,
    allCircularsLoading,
    searchResultsLoading,
    mappedFavouriteCirculars,
    mappedSearchResults,
    mappedAllCirculars,
    hasAllCircularsLoaded: allCircularEntries.length > 0,
    mainGridPagination,
    setMainGridPagination,
    dialogPagination,
    setDialogPagination, // Allow consumers to reset dialog pagination (e.g., on dialog close)
    favourites,
    setFavourites, // Needed by useCircularFavourites to optimistically update after toggle
    setSearchResultsEntries, // Needed by useCircularFavourites to refresh search results after toggle
    fetchFavouriteCircularsData,
    fetchAllCircularsData,
    fetchSearchResults,
    updatePublishingIdInEntries,
    safeAlert, // Shared alert helper; passed to child hooks that don't import showSweetAlert directly
    favouriteFetchParams, // Needed by useCircularFavourites and Circulars orchestrator
  };
}
