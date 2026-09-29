import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { process } from "@progress/kendo-data-query";
import { useDispatch } from "react-redux";

import { FaClipboardList } from "react-icons/fa6";

import DigidakUIDCell from "../digidakOutbox/DigidakUIDCell";
import Skeleton from "../../../components/Loader/Skeleton";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { fetchDigidakMovementRegister } from "../../../redux/digidak/inward/digidakInwardSlice";
import MovementRegister from "../../caseManagement/viewCase/movementRegister/MovementRegister";

const DEFAULT_PAGE_SIZE = 50;

const ViewEntryLettersGrid = ({ digidakUid, isOldLetter = false }) => {
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMovementRegister, setShowMovementRegister] = useState(false);
  const [movementRegisterData, setMovementRegisterData] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const dispatch = useDispatch();

  const [dataState, setDataState] = useState({
    sort: [{ field: "digidak_uid", dir: "asc" }],
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    filter: null,
  });

  const fetchGridData = useCallback(
    async (page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
      if (!digidakUid) return;
      try {
        setLoading(true);

        const response = await digidakInwardService.getDigidakInwardGridData({
          input_group_uid: digidakUid,
          page,
          "items-per-page": pageSize,
        });

        setGridData(response?.entries || []);
        setTotalCount(response?.total || 0);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [digidakUid],
  );

  // Fetch grid data
  useEffect(() => {
    if (!digidakUid) return;
    setCurrentPage(1);
    setTotalCount(0);
    setDataState({
      sort: [{ field: "digidak_uid", dir: "asc" }],
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      filter: null,
    });
    fetchGridData(1);
  }, [digidakUid, fetchGridData]);

  const mappedData = useMemo(() => {
    return (
      gridData?.map((item) => {
        const props = item?.content?.properties ?? {};
        const isOfficeOrder = item?.content?.properties?.office_order_no;

        return {
          id: props.id || item?.id,
          digidak_uid: props.uid_number,
          sender: isOldLetter ? props.initiator : props.r_creator_name,
          letter_no: props.letter_no,
          selected_region: isOfficeOrder ? props?.hrmd_users?.[0] : props.entry_type === "Internal" ? props.selected_region : props.received_from,
          status: props.status,
        };
      }) ?? []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridData]);

  // Process data for Kendo Grid (client-side sort/filter only, pagination is server-side)
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

      const newPageSize = newDataState.take;
      const newPage = Math.floor(newDataState.skip / newPageSize) + 1;

      if (newPage !== currentPage || newPageSize !== dataState.take) {
        setCurrentPage(newPage);
        fetchGridData(newPage, newPageSize);
      }
    },
    [currentPage, dataState.take, fetchGridData],
  );

  const skeletonRows = Array.from({ length: 10 }).map((_, index) => ({
    id: index,
    digidak_uid: " ",
    sender: " ",
    letter_no: " ",
    selected_region: " ",
    status: " ",
  }));

  // open movement register
  const openMovementRegister = async (row) => {
    if (!row?.id) return;

    const response = await dispatch(
      fetchDigidakMovementRegister({
        input_parent_folders: row.id,
      }),
    );

    if (response.type === "getDigidakMovementRegister/fulfilled") {
      setSelectedRow(row);
      setMovementRegisterData(response.payload || []);
      setShowMovementRegister(true);
    }
  };

  const actionCell = (props) => {
    return (
      <td>
        <div className="d-flex align-items-center justify-content-center">
          <button className="icon-wrapper icon-clickable border-0" onClick={() => openMovementRegister(props.dataItem)} title="Movement Register">
            <FaClipboardList size="14px" color="#5e9bf7" />
          </button>
        </div>
      </td>
    );
  };

  return (
    <>
      <div className="view-entry-table-container bg-white mt-4">
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
        >
          <GridColumn field="digidak_uid" title="Digidak UID" width="120px" cells={{ data: loading ? Skeleton : DigidakUIDCell }} />
          <GridColumn field="sender" title="Sender" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="letter_no" title="Letter Number" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="selected_region" title="Dept/RO/TE" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn field="status" title="Status" cells={{ data: loading ? Skeleton : undefined }} />
          <GridColumn title="Action" cells={{ data: loading ? Skeleton : actionCell }} />
        </Grid>
      </div>

      {showMovementRegister && (
        <MovementRegister folderId={selectedRow?.id} visible={showMovementRegister} movementRegisterData={movementRegisterData} onClose={() => setShowMovementRegister(false)} />
      )}
    </>
  );
};

export default ViewEntryLettersGrid;
