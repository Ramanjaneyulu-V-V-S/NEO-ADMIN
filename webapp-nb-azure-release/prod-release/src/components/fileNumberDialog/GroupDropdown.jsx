import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Label } from "@progress/kendo-react-labels";

const GroupDropdown = ({ onSelect, selectedGroup }) => {
  const [data, setData] = useState([]);
  const [value, setValue] = useState(null);

  const { userProfile } = useSelector((state) => state.login);
  const { department_short_code, department_short_code_multi, object_name: userName } = userProfile?.properties || {};

  useEffect(() => {
    if (department_short_code_multi && department_short_code_multi.length > 0) {
      const mappedData = department_short_code_multi.map((item) => ({
        text: item.toUpperCase(),
        value: item.toLowerCase(),
      }));
      setData(mappedData);

      // Set initial value from selectedGroup prop (previously selected) or department_short_code
      let initialValue = null;

      if (selectedGroup) {
        initialValue = mappedData.find((item) => item.value === selectedGroup.toLowerCase());
      } else if (department_short_code) {
        initialValue = mappedData.find((item) => item.value === department_short_code.toLowerCase());
      }

      if (initialValue) {
        setValue(initialValue);
      }
    }
  }, [userName, department_short_code_multi, selectedGroup]);

  const handleChange = (event) => {
    setValue(event.target.value);
    if (onSelect) {
      onSelect(event.target.value.value);
    }
  };

  return (
    <div className="mb-3">
      <Label className="case-form-label mb-1">Select Department</Label>
      <DropDownList data={data} textField="text" dataItemKey="value" value={value} onChange={handleChange} className="case-form-control" />
    </div>
  );
};

export default GroupDropdown;
