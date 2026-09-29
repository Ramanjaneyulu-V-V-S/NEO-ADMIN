import React from "react";
import { Label } from "@progress/kendo-react-labels";
import { Input } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { FaSearch, FaRegStar } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";
import { INTERNAL_EXTERNAL_OPTIONS, LANGUAGE_OPTIONS } from "../../../data/DropdownData";

const CircularFilterBar = React.memo(
  ({
    filterDepartment,
    onFilterDepartmentChange,
    filterYear,
    onFilterYearChange,
    filterInternalExternal,
    onFilterInternalExternalChange,
    filterLanguage,
    onFilterLanguageChange,
    searchName,
    onSearchNameChange,
    departmentOptions,
    yearOptions,
    onSearch,
    onClearFilters,
    onGetFavourites,
    isFavouriteListRefreshing,
    showFavouritesButton = true,
  }) => {
    const hasActiveFilters = filterDepartment || filterYear || filterInternalExternal || filterLanguage || searchName.trim();
    return (
      <div className="mb-2">
        <div className="row g-1">
          <div className="col-lg-2 col-md-3 col-sm-6">
            <Label className="font-size-10 fw-semibold">Department</Label>
            <DropDownList
              data={departmentOptions}
              value={filterDepartment}
              onChange={(e) => onFilterDepartmentChange(e.value)}
              textField="text"
              dataItemKey="value"
              className="case-form-dropdown w-100"
            />
          </div>
          <div className="col-lg-2 col-md-3 col-sm-6">
            <Label className="font-size-10 fw-semibold">Year</Label>
            <DropDownList
              data={yearOptions}
              value={filterYear}
              onChange={(e) => onFilterYearChange(e.value)}
              textField="text"
              dataItemKey="value"
              className="case-form-dropdown w-100"
              placeholder="Select Year"
            />
          </div>
          <div className="col-lg-2 col-md-3 col-sm-6">
            <Label className="font-size-10 fw-semibold">Type</Label>
            <DropDownList
              data={INTERNAL_EXTERNAL_OPTIONS}
              value={filterInternalExternal}
              onChange={(e) => onFilterInternalExternalChange(e.value)}
              textField="text"
              dataItemKey="value"
              className="case-form-dropdown w-100"
            />
          </div>
          <div className="col-lg-2 col-md-3 col-sm-6">
            <Label className="font-size-10 fw-semibold">Language</Label>
            <DropDownList
              data={LANGUAGE_OPTIONS}
              value={filterLanguage}
              onChange={(e) => onFilterLanguageChange(e.value)}
              textField="text"
              dataItemKey="value"
              className="case-form-dropdown w-100"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6 d-flex align-items-end">
            <div className="input-group">
              <Input
                value={searchName}
                placeholder="Search..."
                className="font-size-10"
                autoComplete="off"
                onChange={(e) => onSearchNameChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            </div>
          </div>
          <div className="col-lg-2 col-md-2 col-sm-6 d-flex align-items-end">
            <Button className="master-search-btn me-1" type="button" onClick={() => onSearch(1)} title="Search" aria-label="Search">
              <FaSearch size="12px" />
            </Button>
            {hasActiveFilters && (
              <Button className="master-search-btn me-1" type="button" onClick={onClearFilters} title="Clear filters" aria-label="Clear filters">
                <IoIosCloseCircle size="12px" />
              </Button>
            )}
            {showFavouritesButton && (
              <Button
                className="master-search-btn"
                type="button"
                onClick={onGetFavourites}
                disabled={isFavouriteListRefreshing}
                title="View favourites"
                aria-label="View favourites"
              >
                <FaRegStar size="12px" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

CircularFilterBar.displayName = "CircularFilterBar";
export default CircularFilterBar;
