import { useCallback } from "react";
import { FaStar, FaRegStar } from "react-icons/fa";
import { formatDateCell } from "../../../../../utils/Utils";

/**
 * Returns memoized Kendo Grid cell components.
 * Each cell is re-created only when its specific dependencies change.
 *
 * @param {Object}   params
 * @param {Set}      params.favourites
 * @param {Set}      params.favouriteLoading
 * @param {boolean}  params.isFavouriteListRefreshing
 * @param {Set}      params.copiedLinks
 * @param {Map}      params.copyLinkLoading
 * @param {Map}      params.errorMessages
 * @param {Function} params.onFavouriteToggle
 * @param {Function} params.onCopyLink
 * @param {Function} params.onCircularClick
 */
export function useCircularGridCells({
  favourites,
  favouriteLoading,
  isFavouriteListRefreshing,
  copiedLinks,
  copyLinkLoading,
  errorMessages,
  onFavouriteToggle,
  onCopyLink,
  onCircularClick,
}) {
  const CircularNoCell = useCallback(
    (props) => {
      const dataItem = props.dataItem || {};
      return (
        <td>
          <button className="case-number-span cursor-pointer text-decoration-underline border-0 bg-transparent" onClick={() => onCircularClick(dataItem)}>
            {dataItem.circular_no || "N/A"}
          </button>
        </td>
      );
    },
    [onCircularClick],
  );

  const DescriptionCell = useCallback(
    (props) => {
      const dataItem = props.dataItem || {};
      return (
        <td>
          <button className="case-number-span cursor-pointer text-decoration-underline border-0 bg-transparent" onClick={() => onCircularClick(dataItem)}>
            {dataItem.description || "N/A"}
          </button>
        </td>
      );
    },
    [onCircularClick],
  );

  const DateCell = useCallback((props) => {
    const dataItem = props.dataItem || {};
    return <td>{dataItem.circular_date ? formatDateCell(dataItem.circular_date) : "N/A"}</td>;
  }, []);

  const FavouriteCell = useCallback(
    (props) => {
      const item = props.dataItem || {};
      const circularId = item?.id;

      if (!circularId) {
        return (
          <td className="text-center">
            <span className="font-size-12 text-muted">N/A</span>
          </td>
        );
      }

      const isFavourite = favourites.has(circularId) || item?.is_favourite;
      const isProcessing = favouriteLoading.has(circularId) || isFavouriteListRefreshing;

      return (
        <td className="text-center">
          <span
            onClick={() => !isProcessing && onFavouriteToggle(item)}
            className={`favourite-star ${isFavourite ? "favourite-star-active" : "favourite-star-inactive"} ${isProcessing ? "favourite-star-processing" : "cursor-pointer"}`}
            title={isProcessing ? "Updating favourite..." : isFavourite ? "Remove from favourites" : "Mark as favourite"}
          >
            {isFavourite ? <FaStar /> : <FaRegStar />}
          </span>
        </td>
      );
    },
    [favourites, favouriteLoading, isFavouriteListRefreshing, onFavouriteToggle],
  );

  const CopyLinkCell = useCallback(
    (props) => {
      const dataItem = props.dataItem || {};

      if (!dataItem.id) {
        return (
          <td className="text-center py-2">
            <span className="text-muted small">N/A</span>
          </td>
        );
      }

      const circularId = dataItem.id;
      const isCopied = copiedLinks.has(circularId);
      const isLoadingCopy = copyLinkLoading.has(circularId) || false;
      const errorMsg = errorMessages.get(circularId);

      return (
        <td className="text-center">
          <div className="d-flex flex-column align-items-center gap-1">
            <button
              onClick={() => onCopyLink(dataItem)}
              disabled={isLoadingCopy}
              className={`copy-link-btn d-flex align-items-center justify-content-center ${errorMsg ? "text-danger" : isCopied ? "text-success" : "text-primary"} ${isLoadingCopy ? "opacity-50" : ""}`}
              title={errorMsg || (isCopied ? "Copied!" : "Copy link to this circular")}
            >
              {isLoadingCopy ? "⏳" : errorMsg ? "✗" : isCopied ? "✓" : "🔗"}
            </button>
            {isCopied && !errorMsg && <span className="copy-link-success">Copied</span>}
            {errorMsg && <span className="copy-link-error">{errorMsg}</span>}
          </div>
        </td>
      );
    },
    [copiedLinks, copyLinkLoading, errorMessages, onCopyLink],
  );

  return { CircularNoCell, DescriptionCell, DateCell, FavouriteCell, CopyLinkCell };
}
