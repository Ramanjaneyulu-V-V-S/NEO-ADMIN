import { useState, useCallback } from "react";
import { circularsService } from "../../../../../services/caseManagement/circulars/circularsService";

export function useCircularFavourites({
  favourites,
  setFavourites,
  favouriteFetchParams,
  fetchFavouriteCircularsData,
  buildSearchParams,
  isShowingSearchResults,
  mainGridCurrentPage,
  setSearchResultsEntries,
  safeAlert,
}) {
  const [favouriteLoading, setFavouriteLoading] = useState(new Set());

  const handleFavouriteToggle = useCallback(
    async (circular) => {
      const circularId = circular?.id;
      if (!circularId) {
        safeAlert("Warning", "Unable to identify the selected circular.", "warning");
        return;
      }
      if (!favouriteFetchParams?.input_user_profile_id) {
        safeAlert("Warning", "User information is missing. Please re-login and try again.", "warning");
        return;
      }
      if (favouriteLoading.has(circularId)) return;

      const operation = favourites.has(circularId) ? "remove" : "create";

      setFavouriteLoading((prev) => {
        const s = new Set(prev);
        s.add(circularId);
        return s;
      });

      try {
        await circularsService.favouriteCirculars({
          circularId,
          userProfileId: favouriteFetchParams.input_user_profile_id,
          operation,
        });

        setFavourites((prev) => {
          const s = new Set(prev);
          if (operation === "create") s.add(circularId);
          else s.delete(circularId);
          return s;
        });

        if (favouriteFetchParams) await fetchFavouriteCircularsData();

        if (isShowingSearchResults) {
          try {
            const resp = await circularsService.getCirculars(buildSearchParams(mainGridCurrentPage));
            setSearchResultsEntries(Array.isArray(resp?.entries) ? resp.entries : []);
          } catch (err) {
            console.error(err);
          }
        }
      } catch (err) {
        safeAlert("Error", err?.message || "Failed to update favourite circular.", "error");
      } finally {
        setFavouriteLoading((prev) => {
          const s = new Set(prev);
          s.delete(circularId);
          return s;
        });
      }
    },
    [
      favourites,
      setFavourites,
      favouriteLoading,
      favouriteFetchParams,
      fetchFavouriteCircularsData,
      isShowingSearchResults,
      buildSearchParams,
      mainGridCurrentPage,
      setSearchResultsEntries,
      safeAlert,
    ],
  );

  return { favouriteLoading, handleFavouriteToggle };
}
