import { useState, useCallback, useEffect, useMemo } from "react";
import { dashboardService } from "../../../../../services/dashboard/dashboardService";
import { DEFAULT_PAGE_SIZE } from "../constants";

export function useCircularFilters() {
  const [filterDepartment, setFilterDepartment] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [filterInternalExternal, setFilterInternalExternal] = useState(null);
  const [filterLanguage, setFilterLanguage] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [departmentOptions, setDepartmentOptions] = useState([]);

  // Year options — only current year (mirrors original logic)
  const yearOptions = useMemo(() => {
    const year = new Date().getFullYear().toString();
    return [{ text: year, value: year }];
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await dashboardService.getDepartments({
          input_folder: `/ECM CONFIG/Office Type/HO`,
        });
        const options =
          response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.title,
          })) || [];
        setDepartmentOptions(options);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepartments();
  }, []);

  const buildSearchParams = useCallback(
    (page = 1) => {
      const params = {
        page,
        start: (page - 1) * DEFAULT_PAGE_SIZE,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };
      const trimmedName = searchName.trim();
      if (trimmedName) params.input_search_all = trimmedName;
      if (filterDepartment?.text) params.input_department = filterDepartment.text;
      if (filterYear?.value) {
        const yearNumber = Number(filterYear.value);
        if (!Number.isNaN(yearNumber)) params.input_circular_year = yearNumber;
      }
      if (filterInternalExternal?.value) params.input_internal_external = filterInternalExternal.value;
      if (filterLanguage?.value) params.input_language_type = filterLanguage.value;
      return params;
    },
    [searchName, filterDepartment, filterYear, filterInternalExternal, filterLanguage],
  );

  const clearFilters = useCallback(() => {
    setFilterDepartment(null);
    setFilterYear(null);
    setFilterInternalExternal(null);
    setFilterLanguage(null);
    setSearchName("");
  }, []);

  return {
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
  };
}
