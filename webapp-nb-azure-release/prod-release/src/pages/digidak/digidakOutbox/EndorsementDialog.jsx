import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { process } from "@progress/kendo-data-query";
import Skeleton from "../../../components/Loader/Skeleton";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { mapEndorsementItem } from "./outboxDataMapper";

const EndorsementDialog = ({ open, onClose, endorseUid }) => {
  const navigate = useNavigate();
  const [gridData, setGridData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataState, setDataState] = useState({
    sort: [],
    skip: 0,
    take: 50,
    filter: null,
  });

  const fetchEndorsementData = useCallback(async () => {
    if (!endorseUid) return;
    try {
      setLoading(true);
      const response = await digidakInwardService.getDigidakInwardGridData({
        input_endorse_uid: endorseUid,
        input_is_endorsed_letter: true,
      });
      setGridData(response?.entries || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [endorseUid]);

  useEffect(() => {
    if (!open || !endorseUid) return;
    setGridData([]);
    setDataState({ sort: [], skip: 0, take: 50, filter: null });
    fetchEndorsementData();
  }, [open, endorseUid, fetchEndorsementData]);

  const mappedData = useMemo(() => {
    return gridData?.map(mapEndorsementItem) ?? [];
  }, [gridData]);

  const processedData = useMemo(() => process(mappedData, dataState), [mappedData, dataState]);

  const handleNavigateEndorsementUID = (props) => {
    const data = props.dataItem;
    navigate(`/digidak-view/${data?.id}`, {
      state: {
        digidakObjectId: data?.id,
        screenName: "viewOutward",
        digidak_uid: data?.uid_number,
        i_folder_id: data?.i_folder_id?.[0],
      },
    });
    onClose();
  };

  const EndorsementNumberCell = (props) => (
    <td>
      <button className="digidak-uid-span cursor-pointer border-0 bg-transparent" onClick={() => handleNavigateEndorsementUID(props)}>
        {props.dataItem.uid_number}
      </button>
    </td>
  );

  const skeletonRows = Array.from({ length: 6 }, (_, index) => ({ id: index }));

  if (!open || !endorseUid) return null;

  return (
    <Dialog title={"Endorsement List"} onClose={onClose} className="endorse-dialog-wh">
      <Grid data={loading ? skeletonRows : processedData}>
        <GridColumn field="uid_number" title="UID Number" cells={{ data: loading ? Skeleton : EndorsementNumberCell }} />
        <GridColumn field="endorse_uid" title="Endorse UID" cells={{ data: loading ? Skeleton : undefined }} />
        <GridColumn field="decision" title="Decision" cells={{ data: loading ? Skeleton : undefined }} />
        <GridColumn field="initiator" title="Initiator" cells={{ data: loading ? Skeleton : undefined }} />
        <GridColumn field="selected_region" title="Dept/RO/TE" cells={{ data: loading ? Skeleton : undefined }} />
        <GridColumn field="status" title="Status" cells={{ data: loading ? Skeleton : undefined }} />
      </Grid>
      <div className="float-end mt-2">
        <Button onClick={onClose} className="common-btn-css submit-button">
          Close
        </Button>
      </div>
    </Dialog>
  );
};

export default EndorsementDialog;
