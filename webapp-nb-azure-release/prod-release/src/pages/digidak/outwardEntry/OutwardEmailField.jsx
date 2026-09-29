import { useEffect } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@progress/kendo-react-inputs";
import { Label } from "@progress/kendo-react-labels";

export const OutwardEmailField = ({ type, mode, control, errors, setValue, clearErrors, unregister, disabled }) => {
  const shouldShow = type === "External" && mode === "Email";

  // Clear value & validation when hidden
  useEffect(() => {
    if (!shouldShow) {
      setValue("recipientEmail", "");
      clearErrors("recipientEmail");

      if (unregister) {
        unregister("recipientEmail");
      }
    }
  }, [shouldShow, setValue, clearErrors, unregister]);

  return (
    <div className={`col-12 col-sm-4 col-md-3 ${shouldShow ? "d-block" : "d-none"}`}>
      <Label className="case-form-label">
        Email <span className="required-asterisk">*</span>
      </Label>

      <Controller
        name="recipientEmail"
        control={control}
        rules={
          shouldShow
            ? {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address",
                },
              }
            : {}
        }
        render={({ field }) => <Input className="case-form-dropdown" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={disabled} />}
      />

      {errors.recipientEmail && <div className="form-error">{errors.recipientEmail.message}</div>}
    </div>
  );
};
