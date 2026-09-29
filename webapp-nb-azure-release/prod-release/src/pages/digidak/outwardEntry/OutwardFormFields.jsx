import React from "react";
import { Controller } from "react-hook-form";
import { Label } from "@progress/kendo-react-labels";
import { Input } from "@progress/kendo-react-inputs";
import { DropDownList } from "@progress/kendo-react-dropdowns";

export const FormDropdownField = ({ name, label, data, disabled = false, control, errors, isGenerated }) => {
  const isObjectData = data?.length && typeof data[0] === "object";
  const isSourceVertical = name === "srcVerticalId";

  return (
    <div className="col-xs-12 col-sm-4 col-md-3">
      <Label className="case-form-label">
        {label} <span className="required-asterisk">*</span>
      </Label>
      <Controller
        name={name}
        control={control}
        rules={{ required: `${label} is required` }}
        render={({ field }) => {
          return (
            <DropDownList
              className="case-form-dropdown"
              data={data}
              value={isSourceVertical ? field.value?.[0] || null : field.value}
              onChange={(e) => {
                const newValue = isSourceVertical ? (e.value ? [e.value] : []) : e.value;
                field.onChange(newValue);
              }}
              disabled={isGenerated || disabled}
              textField={isObjectData ? "text" : undefined}
              dataItemKey={isObjectData ? "value" : undefined}
            />
          );
        }}
      />
      {errors[name] && <div className="form-error">{errors[name].message}</div>}
    </div>
  );
};

export const FormInputField = ({ name, label, colClass = "col-xs-12 col-sm-4 col-md-3", control, errors, isGenerated }) => (
  <div className={colClass}>
    <Label className="case-form-label">
      {label} <span className="required-asterisk">*</span>
    </Label>
    <Controller
      name={name}
      control={control}
      rules={{ required: `${label} is required` }}
      render={({ field }) => <Input className="case-form-dropdown" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />}
    />
    {errors[name] && <div className="form-error">{errors[name].message}</div>}
  </div>
);
