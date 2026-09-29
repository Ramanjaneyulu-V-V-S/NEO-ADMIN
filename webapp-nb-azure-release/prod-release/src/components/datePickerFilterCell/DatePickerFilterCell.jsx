import { Button } from "@progress/kendo-react-buttons";
import { filterClearIcon } from "@progress/kendo-svg-icons";
import { DatePicker } from "@progress/kendo-react-dateinputs";

export const DatePickerFilterCell = (props) => {
  const hasValue = Boolean(props.value);

  const onChange = (event) => {
    const val = event.target.value;
    props.onChange({
      value: val || "",
      operator: val ? "eq" : "",
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

  return (
    <div className="k-filtercell">
      <DatePicker format="dd/MM/yyyy" value={props.value || null} onChange={onChange} max={new Date()} placeholder="Select date" />
      <Button title="Clear" svgIcon={filterClearIcon} onClick={onClearButtonClick} disabled={!hasValue} />
    </div>
  );
};
