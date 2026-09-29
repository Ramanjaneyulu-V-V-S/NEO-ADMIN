import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { process } from "@progress/kendo-data-query";
import DigidakUIDCell from "./DigidakUIDCell";
import Skeleton from "../../../components/Loader/Skeleton";

const DEFAULT_PAGE_SIZE = 50;

const GroupLetterGridDialog = ({ open, onClose, groupUid }) => {
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dataState, setDataState] = useState({
    sort: [{ field: "digidak_uid", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const fetchGridData = useCallback(
    async (page = 1) => {
      if (!groupUid) return;
      try {
        setLoading(true);

        const response = await digidakInwardService.getDigidakInwardGridData({
          input_group_uid: groupUid,
          page,
          "items-per-page": DEFAULT_PAGE_SIZE,
        });

        setGridData(response?.entries || []);
        setTotalCount(response?.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [groupUid],
  );

  useEffect(() => {
    if (!open || !groupUid) return;

    setCurrentPage(1);
    setTotalCount(0);
    setDataState({
      sort: [{ field: "digidak_uid", dir: "asc" }],
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      filter: null,
    });
    fetchGridData(1);
  }, [open, groupUid, fetchGridData]);

  // Map API response → grid rows
  const mappedData = useMemo(() => {
    return (
      gridData?.map((item) => {
        const { id, i_folder_id, uid_number, r_creator_name, letter_no, hrmd_users, selected_region, status, office_order_no } = item?.content?.properties ?? {};

        return {
          id: id || item?.id,
          i_folder_id: i_folder_id,
          digidak_uid: uid_number,
          sender: r_creator_name,
          letter_no: letter_no,
          selected_region: hrmd_users ? hrmd_users[0] : selected_region,
          status: status,
          // office order no. - for HRMD Users
          office_order_no: office_order_no,
        };
      }) ?? []
    );
  }, [gridData]);

  // Process data for Kendo Grid (client-side sort/filter only)
  const processedData = useMemo(() => {
    const clientSideState = {
      sort: dataState.sort,
      filter: dataState.filter,
    };
    const result = process(mappedData, clientSideState);
    result.total = totalCount;
    return result;
  }, [mappedData, dataState.sort, dataState.filter, totalCount]);

  const handleDataStateChange = useCallback(
    (e) => {
      const newDataState = e.dataState;
      setDataState(newDataState);

      const newPage = Math.floor(newDataState.skip / DEFAULT_PAGE_SIZE) + 1;

      if (newPage !== currentPage) {
        setCurrentPage(newPage);
        fetchGridData(newPage);
      }
    },
    [currentPage, fetchGridData],
  );

  const hasOfficeOrderNo = useMemo(() => {
    return mappedData.some((item) => item.office_order_no);
  }, [mappedData]);

  const skeletonRows = Array.from({ length: 10 }).map((_, index) => ({
    id: index,
    digidak_uid: " ",
    sender: " ",
    letter_no: " ",
    selected_region: " ",
    status: " ",
    office_order_no: " ",
  }));

  if (!open || !groupUid) return null;

  return (
    <Dialog title="Group Letter Details" onClose={onClose} width={800} minWidth={400}>
      <div className="grid-container">
        <Grid
          {...dataState}
          data={loading ? { data: skeletonRows, total: skeletonRows.length } : processedData}
          sortable
          resizable
          pageable={{
            info: true,
            buttonCount: 10,
            pageSizes: false,
          }}
          onDataStateChange={handleDataStateChange}
          className="group-letter-grid-height"
        >
          <GridColumn field="digidak_uid" title="Digidak UID" cells={{ data: loading ? Skeleton : DigidakUIDCell }} />
          {hasOfficeOrderNo && <GridColumn field="office_order_no" title="Office Order No." cells={{ data: loading ? Skeleton : undefined }} />}
          <GridColumn field="sender" title="Sender" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="letter_no" title="Letter Number" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="selected_region" title="Dept/RO/TE" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="status" title="Status" cells={{ data: loading ? Skeleton : undefined }} />
        </Grid>
      </div>

      <DialogActionsBar>
        <div className="d-flex justify-content-end mt-1 gap-2">
          <Button className="common-btn-css cancel-button" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogActionsBar>
    </Dialog>
  );
};

export default GroupLetterGridDialog;
