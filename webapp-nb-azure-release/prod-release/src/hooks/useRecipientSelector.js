import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { fetchDDMUsers, fetchHRMDUsers } from "../redux/digidak/dropdowns/digidakDropdownSlice";

export const useRecipientSelector = ({ control, setValue, getValues, dropdownData }) => {
  const dispatch = useDispatch();

  // Extract dropdown lists
  const { office_type: office_type_data = [], HO = [], RO = [], TE = [] } = dropdownData || {};

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, object_name, location, department_short_code_multi } = userProfile?.properties || {};
  const isHRMDUser = department_short_code_multi?.includes("hrmd");
  const { hrmdUsers, hrmdDoUsers, ddmUsers, DOLetterRecipientsByOfficeType } = useSelector((state) => state.digidakDropdown);

  // Watch form fields
  const selectedRO = useWatch({ control, name: "ros" });
  const selectedType = useWatch({ control, name: "ro" })?.value;
  const isBulk = useWatch({ control, name: "sendingBulkLetter" });
  const natureOfCorrespondence = useWatch({ control, name: "subtype" });

  // DO letter specific modifications
  const isDOLetter = natureOfCorrespondence === "DO Letter";
  const ddmUsersList = ddmUsers.map((i) => i.value || i);
  const hoDepartments = isDOLetter ? DOLetterRecipientsByOfficeType?.HO?.map((i) => i.value || i) || [] : HO.map((i) => i.value || i);
  const roNames = isDOLetter ? DOLetterRecipientsByOfficeType?.RO?.map((i) => i.value || i) || [] : RO.map((i) => i.value || i);
  const teNames = isDOLetter ? DOLetterRecipientsByOfficeType?.TE?.map((i) => i.value || i) || [] : TE.map((i) => i.value || i);

  // Normalize any value to array
  const normalizeArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const safeSelectedRO = normalizeArray(selectedRO);

  // Department generator
  const getDepartmentOptions = (rosList) => {
    const opts = [];

    if (rosList.includes("HO") || rosList.includes("All Departments")) opts.push(...hoDepartments);
    if (rosList.includes("RO") || rosList.includes("All RO")) opts.push(...roNames);
    if (rosList.includes("TE") || rosList.includes("All TE")) opts.push(...teNames);
    if (rosList.includes("All DDM")) opts.push(...ddmUsersList);

    return opts;
  };

  const departmentOptions = getDepartmentOptions(safeSelectedRO);

  // HO/RO/TE MultiSelect logic
  const handleHORoTeChange = (field, e) => {
    const newValue = e.value || [];
    const previous = field.value || [];
    const prevDeps = getValues("departments") || [];

    field.onChange(newValue);

    if (newValue.length === 0) {
      setValue("departments", []);
      return;
    }

    let updatedDeps = [...prevDeps];

    const added = newValue.filter((i) => !previous.includes(i));
    const removed = previous.filter((i) => !newValue.includes(i));

    // removals
    removed.forEach((item) => {
      if (["All Departments", "HO"].includes(item)) updatedDeps = updatedDeps.filter((d) => !hoDepartments.includes(d));
      if (["All RO", "RO"].includes(item)) updatedDeps = updatedDeps.filter((d) => !roNames.includes(d));
      if (["All TE", "TE"].includes(item)) updatedDeps = updatedDeps.filter((d) => !teNames.includes(d));

      if (item === "All DDM") updatedDeps = updatedDeps.filter((d) => !ddmUsersList.includes(d));
    });

    // additions
    added.forEach((item) => {
      if (item === "All Departments") hoDepartments.forEach((d) => !updatedDeps.includes(d) && updatedDeps.push(d));
      if (item === "All RO") roNames.forEach((d) => !updatedDeps.includes(d) && updatedDeps.push(d));
      if (item === "All TE") teNames.forEach((d) => !updatedDeps.includes(d) && updatedDeps.push(d));
      if (item === "All DDM") ddmUsersList.forEach((d) => !updatedDeps.includes(d) && updatedDeps.push(d));
    });

    // prune invalid deps
    const valid = getDepartmentOptions(newValue);
    updatedDeps = updatedDeps.filter((d) => valid.includes(d));

    setValue("departments", updatedDeps, { shouldValidate: true });
  };

  // Department multiselect
  const handleDepartmentsChange = (field, e) => {
    field.onChange(e.value || []);
  };

  useEffect(() => {
    const shouldFetchDDM = isBulk || selectedType === "DDM";

    if (!shouldFetchDDM) return;
    if (ddmUsers?.length > 0) return; // cache guard
    if (!object_name) return;

    dispatch(fetchDDMUsers(object_name));
  }, [isBulk, selectedType, ddmUsers?.length, object_name, dispatch]);

  useEffect(() => {
    if (natureOfCorrespondence === "Office Order") {
      dispatch(fetchHRMDUsers({ office_type, location }));
    }
  }, [dispatch, office_type, location, natureOfCorrespondence]);

  const isDOFlow = selectedType === "Users" && isHRMDUser && natureOfCorrespondence === "DO Letter";
  const effectiveHrmdUsers = isDOFlow ? hrmdDoUsers : hrmdUsers;

  // Filter out Users and Verticals for DO Letter
  const effectiveOfficeTypeData =
    natureOfCorrespondence !== "Office Order" ? office_type_data.filter((opt) => opt.value !== "Users" && opt.value !== "Verticals") : office_type_data;

  return {
    isBulk,
    office_type,
    office_type_data: effectiveOfficeTypeData,
    hoDepartments,
    roNames,
    teNames,
    hrmdUsers: effectiveHrmdUsers,
    ddmUsers,
    selectedType,
    safeSelectedRO,
    departmentOptions,
    handleHORoTeChange,
    handleDepartmentsChange,
  };
};
