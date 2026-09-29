import { useMemo } from "react";

export const useResponseRecipientDisable = ({ responseToDigidakId, inboxList }) => {
  const responseUid = responseToDigidakId?.value ?? responseToDigidakId;

  const isResponseDDM = useMemo(() => {
    if (!responseUid || !inboxList?.length) return false;

    const matched = inboxList.find((item) => {
      const props = item?.content ? item.content.properties : item;
      return props?.uid_number === responseUid;
    });
    const props = matched?.content ? matched.content.properties : matched;
    const isDDMValue = props?.is_ddm;

    return isDDMValue === true || isDDMValue === 1;
  }, [responseUid, inboxList]);

  const disableRecipientSelector = Boolean(responseUid) && !isResponseDDM;

  // disable only RO for DDM
  const disableRO = isResponseDDM;

  return {
    isResponseDDM,
    disableRecipientSelector,
    disableRO,
  };
};
