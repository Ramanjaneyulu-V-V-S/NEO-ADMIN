import { useState, useEffect } from "react";
import { process } from "@progress/kendo-data-query";
import { Button } from "@progress/kendo-react-buttons";
import { RadioButton } from "@progress/kendo-react-inputs";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

const SelectItemDialog = ({ open, onClose, title = "Select Item", items = [], selectedItem, onSelectItem, columns = [] }) => {
  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "dec" }],
    skip: 0,
    take: 50,
    filter: null,
  });

  const [result, setResult] = useState(process(items, dataState));

  useEffect(() => {
    setResult(process(items, dataState));
  }, [items, dataState]);

  const handleDataStateChange = (e) => setDataState(e.dataState);

  const handleCheckItem = (props) => {
    const item = props.dataItem;
    const isSelected = selectedItem?.value === item.value;

    return (
      <td>
        <RadioButton checked={isSelected} onChange={() => onSelectItem(item)} />
      </td>
    );
  };

  return (
    open && (
      <Dialog title={title} className="file-no-wh" onClose={onClose}>
        <div className="file-no-grid">
          <Grid
            {...dataState}
            data={result.data}
            total={result.total}
            sortable
            filterable
            pageable={{
              info: true,
              buttonCount: 10,
              pageSizes: false,
            }}
            onDataStateChange={handleDataStateChange}
          >
            <GridColumn width="60px" title="Select" sortable={false} filterable={false} cells={{ data: handleCheckItem }} />
            {columns.map((col) => (
              <GridColumn key={col.field} field={col.field} title={col.title} filter="text" />
            ))}
          </Grid>
        </div>

        <DialogActionsBar>
          <div className="d-flex justify-content-end mt-1 gap-2">
            <Button className="common-btn-css submit-button me-2" onClick={onClose} disabled={!selectedItem}>
              SELECT
            </Button>
          </div>
        </DialogActionsBar>
      </Dialog>
    )
  );
};

export default SelectItemDialog;
