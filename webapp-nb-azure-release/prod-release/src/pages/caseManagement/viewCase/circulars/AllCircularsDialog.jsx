import React from "react";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import CircularFilterBar from "./CircularFilterBar";

const AllCircularsDialog = React.memo(
  ({ isLoading, data, total, dataState, onDataStateChange, onClose, filterBarProps, CircularNoCell, DescriptionCell, DateCell, FavouriteCell, CopyLinkCell }) => (
    <Dialog title="All Circulars - Update Favorites" onClose={onClose} width="70vw" height="85vh">
      {isLoading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}
      {filterBarProps && <CircularFilterBar {...filterBarProps} showFavouritesButton={false} />}
      <div className="circular-data-grid">
        <Grid {...dataState} data={data} total={total} sortable resizable pageable={{ info: true, buttonCount: 5, pageSizes: false }} onDataStateChange={onDataStateChange}>
          <GridColumn field="circular_no" title="Circular No." cells={{ data: CircularNoCell }} />
          <GridColumn field="description" title="Description" cells={{ data: DescriptionCell }} />
          <GridColumn field="circular_date" title="Date" cells={{ data: DateCell }} width="130px" />
          <GridColumn field="department" title="Department" width="100px" />
          <GridColumn field="id" title="Favourite" cells={{ data: FavouriteCell }} width="75px" />
          <GridColumn field="id" title="Link" cells={{ data: CopyLinkCell }} width="50px" />
        </Grid>
      </div>
      <DialogActionsBar>
        <div className="d-flex justify-content-end mt-3 gap-2">
          <Button className="common-btn-css submit-button me-2" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogActionsBar>
    </Dialog>
  ),
);

AllCircularsDialog.displayName = "AllCircularsDialog";
export default AllCircularsDialog;
