import * as React from "react";

// Kendo Components
import { Button } from "@progress/kendo-react-buttons";
import { filterClearIcon } from "@progress/kendo-svg-icons";
import { DropDownList } from "@progress/kendo-react-dropdowns";

export const DropdownFilterCell = (props) => {
  const hasValue = (value) => Boolean(value && value !== props.defaultItem);

  const [data, setData] = React.useState(props.data || []);

  const onChange = (event) => {
    const isValueSet = hasValue(event.target.value);
    props.onChange({
      value: isValueSet ? event.target.value : "",
      operator: isValueSet ? "eq" : "",
      syntheticEvent: event.syntheticEvent,
    });
  };

  const onClearButtonClick = (event) => {
    event.preventDefault();
    props.onChange({
      value: "",
      operator: "",
      syntheticEvent: event,
    });
  };

  const onFilterChange = (event) => {
    const filterValue = event.filter?.value?.toLowerCase() || "";
    const filtered = props.data.filter((item) => item?.toLowerCase().includes(filterValue));
    setData(filtered);
  };

  return (
    <div className="k-filtercell">
      <DropDownList
        data={data}
        filterable={true}
        onChange={onChange}
        defaultItem={props.defaultItem}
        onFilterChange={onFilterChange}
        value={props.value || props.defaultItem}
        ariaLabel={props.ariaLabel || "Filter"}
      />
      <Button title="Clear" svgIcon={filterClearIcon} onClick={onClearButtonClick} disabled={!hasValue(props.value)} />
    </div>
  );
};
