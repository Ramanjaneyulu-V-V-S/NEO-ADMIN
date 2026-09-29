import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

const DigidakUIDCell = (props) => {
  const { dataItem } = props;
  const navigate = useNavigate();

  const handleViewDigidak = useCallback(() => {
    if (!dataItem?.id) return;

    navigate(`/digidak-view/${dataItem.id}`, {
      state: {
        digidakObjectId: dataItem.id,
        screenName: "viewOutward",
        isClickFromViewEntry: true,
        digidak_uid: dataItem.digidak_uid,
        i_folder_id: dataItem.i_folder_id,
      },
    });
  }, [navigate, dataItem]);

  return (
    <td>
      <span className="digidak-uid-span cursor-pointer" onClick={handleViewDigidak}>
        {dataItem?.digidak_uid}
      </span>
    </td>
  );
};

export default DigidakUIDCell;
