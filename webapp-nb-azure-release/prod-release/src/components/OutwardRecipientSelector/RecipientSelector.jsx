import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@progress/kendo-react-labels";
import { Checkbox } from "@progress/kendo-react-inputs";
import { useRecipientSelector } from "../../hooks/useRecipientSelector";
import { MultiSelect, DropDownList } from "@progress/kendo-react-dropdowns";
import PropTypes from "prop-types";

export default function RecipientSelector({ control, errors, disabled, setValue, getValues, isGenerated, dropdownData, verticalOptions, responseToDigidakId, disableRO }) {
  const {
    isBulk,
    office_type,
    office_type_data,
    hoDepartments,
    roNames,
    teNames,
    ddmUsers,
    hrmdUsers,
    selectedType,
    safeSelectedRO,
    departmentOptions,
    handleHORoTeChange,
    handleDepartmentsChange,
  } = useRecipientSelector({
    control,
    setValue,
    getValues,
    dropdownData,
  });

  const formValues = getValues();

  const [officeFilter, setOfficeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");

  const filterData = (data, filter) => {
    if (!filter || !data) return data;
    return data.filter((item) => {
      const text = typeof item === "string" ? item : item.text || "";
      return text.toLowerCase().includes(filter.toLowerCase());
    });
  };

  useEffect(() => {
    if (responseToDigidakId) {
      setValue("sendingBulkLetter", false);
    }
  }, [responseToDigidakId, setValue]);

  const filteredOfficeTypeData = office_type === "HO" ? office_type_data.filter((opt) => opt.value !== "DDM") : office_type_data;
  const filteredUsersOnly = [
    {
      text: "Users",
      value: "Users",
    },
  ];

  const filteredOfficeTypeBulkData =
    office_type === "HO" ? ["All Departments", "All RO", "All TE", "HO", "RO", "TE"] : ["All Departments", "All RO", "All TE", "All DDM", "HO", "RO", "TE"];

  const isDoLetter = formValues?.subtype === "DO Letter";
  const isOfficeOrder = formValues?.subtype === "Office Order";

  return (
    <>
      {/* Bulk Checkbox */}

      {!isDoLetter && (
        <div className="col-xs-12 col-sm-4 col-md-3">
          <div className="d-flex align-items-center mt-4 bulk-radio-btn">
            <Controller
              name="sendingBulkLetter"
              control={control}
              render={({ field }) => (
                <>
                  <Checkbox
                    id="sendingBulkLetter"
                    size="medium"
                    checked={!!field.value}
                    onChange={(e) => {
                      field.onChange(e.value);

                      // Clear SINGLE mode fields
                      setValue("ro", "");
                      setValue("department", "");
                      setValue("in_hrmd_users", "");
                      setValue("in_outward_vertical", "");

                      // Clear BULK mode fields
                      setValue("ros", []);
                      setValue("departments", []);
                    }}
                    disabled={isGenerated || !!responseToDigidakId}
                  />
                  <label htmlFor="sendingBulkLetter" className="case-form-label ms-2 mb-0 mt-0">
                    Sending Bulk Letter
                  </label>
                </>
              )}
            />
          </div>

          {errors.sendingBulkLetter && <div className="form-error">{errors.sendingBulkLetter.message}</div>}
        </div>
      )}

      {/* Conditional rendering */}
      {isBulk ? (
        <>
          {/* Bulk HO/RO/TE */}
          <div className="col-xs-12 col-sm-4 col-md-3">
            <Label className="case-form-label">
              {isOfficeOrder ? "Users" : "HO/RO/TE"} <span className="required-asterisk">*</span>
            </Label>
            <Controller
              name="ros"
              control={control}
              rules={{
                required: `${isOfficeOrder ? "Users" : "HO/RO/TE"} is required`,
              }}
              render={({ field }) => (
                <MultiSelect
                  data={filterData(isOfficeOrder ? ["Users"] : filteredOfficeTypeBulkData, officeFilter)}
                  filterable={true}
                  onFilterChange={(e) => setOfficeFilter(e.filter.value)}
                  value={field.value || []}
                  onChange={(e) => handleHORoTeChange(field, e)}
                  disabled={isGenerated}
                  className="case-form-dropdown"
                />
              )}
            />
            {errors.ros && <div className="form-error">{errors.ros.message}</div>}
          </div>

          {/* Bulk Selected Recipients */}
          <div className="col-xs-12 col-sm-4 col-md-3">
            <Label className="case-form-label">
              Selected Recipients <span className="required-asterisk">*</span>
            </Label>

            <Controller
              name="departments"
              control={control}
              rules={{ required: "Selected Recipients are required" }}
              render={({ field }) => {
                // compute inside render
                const selectedValues = hrmdUsers?.filter((user) => (Array.isArray(field.value) ? field.value.includes(user.value) : false)) || [];

                return (
                  <>
                    {isOfficeOrder ? (
                      <MultiSelect
                        data={filterData(hrmdUsers || [], recipientFilter)}
                        filterable={true}
                        onFilterChange={(e) => setRecipientFilter(e.filter.value)}
                        textField="text"
                        dataItemKey="value"
                        value={selectedValues} // pass objects
                        onChange={(e) =>
                          field.onChange(
                            e.value.map((item) => item.value), // store IDs
                          )
                        }
                        disabled={isGenerated || safeSelectedRO.length === 0}
                        className="case-form-dropdown selected-recipients"
                      />
                    ) : (
                      <MultiSelect
                        data={filterData(departmentOptions, recipientFilter)}
                        filterable={true}
                        onFilterChange={(e) => setRecipientFilter(e.filter.value)}
                        value={field.value || []}
                        onChange={(e) => handleDepartmentsChange(field, e)}
                        disabled={isGenerated || safeSelectedRO.length === 0}
                        className="case-form-dropdown selected-recipients"
                      />
                    )}
                  </>
                );
              }}
            />

            {errors.departments && <div className="form-error">{errors.departments.message}</div>}
          </div>
        </>
      ) : (
        <>
          {/* Single HO/RO/TE */}
          <div className="col-xs-12 col-sm-4 col-md-3">
            <Label className="case-form-label">
              {isOfficeOrder ? "Users" : "HO/RO/TE"} <span className="required-asterisk">*</span>
            </Label>
            <Controller
              name="ro"
              control={control}
              rules={{
                required: `${isOfficeOrder ? "Users" : "HO/RO/TE"} is required`,
              }}
              render={({ field }) => (
                <DropDownList
                  data={filterData(isOfficeOrder ? filteredUsersOnly : filteredOfficeTypeData, officeFilter)}
                  filterable={true}
                  onFilterChange={(e) => setOfficeFilter(e.filter.value)}
                  textField="text"
                  dataItemKey="value"
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e.value);

                    // Clear ONLY on user action
                    setValue("department", "");
                    setValue("in_hrmd_users", "");
                    setValue("in_outward_vertical", "");
                    setValue("in_ddm_users", "");
                  }}
                  // disabled={isGenerated || disabled}
                  disabled={isGenerated || disabled || disableRO}
                  className="case-form-dropdown"
                />
              )}
            />
            {errors.ro && <div className="form-error">{errors.ro.message}</div>}
          </div>

          {/* Single Selected Recipients */}
          <div className="col-xs-12 col-sm-4 col-md-3">
            <Label className="case-form-label">
              {selectedType === "DDM" ? "DDM Users" : "Selected Recipients"}
              <span className="required-asterisk">*</span>
            </Label>
            <Controller
              name={selectedType === "DDM" ? "in_ddm_users" : selectedType === "Users" ? "in_hrmd_users" : selectedType === "Verticals" ? "in_outward_vertical" : "department"}
              control={control}
              rules={{ required: "Recipient is required" }}
              render={({ field }) => {
                let options = [];
                if (selectedType === "HO") options = hoDepartments;
                if (selectedType === "RO") options = roNames;
                if (selectedType === "TE") options = teNames;
                if (selectedType === "DDM") options = ddmUsers; // DDM ddmUserOptions

                // Provide lists for HRMD special cases
                if (selectedType === "Users") options = hrmdUsers || [];
                if (selectedType === "Verticals") options = verticalOptions;

                const isObjectData = options?.length && typeof options[0] === "object";

                return (
                  <DropDownList
                    data={filterData(options, recipientFilter)}
                    filterable={true}
                    onFilterChange={(e) => setRecipientFilter(e.filter.value)}
                    value={isObjectData ? options.find((opt) => opt.value === field.value?.value) || null : typeof field.value === "string" ? field.value : ""}
                    onChange={(e) => {
                      field.onChange(isObjectData ? e.value : e.value);
                    }}
                    disabled={isGenerated || !selectedType || disabled}
                    className="case-form-dropdown"
                    textField={isObjectData ? "text" : undefined}
                    dataItemKey={isObjectData ? "value" : undefined}
                  />
                );
              }}
            />

            {(errors.department || errors.in_hrmd_users || errors.in_outward_vertical || errors.in_ddm_users) && (
              <div className="form-error">{errors.department?.message || errors.in_hrmd_users?.message || errors.in_outward_vertical?.message || errors.in_ddm_users?.message}</div>
            )}
          </div>
        </>
      )}
    </>
  );
}

RecipientSelector.propTypes = {
  control: PropTypes.object,
  errors: PropTypes.object,
  disabled: PropTypes.bool,
  setValue: PropTypes.func,
  getValues: PropTypes.func,
  isGenerated: PropTypes.bool,
  dropdownData: PropTypes.array,
  verticalOptions: PropTypes.array,
  responseToDigidakId: PropTypes.any,
  disableRO: PropTypes.bool,
};
