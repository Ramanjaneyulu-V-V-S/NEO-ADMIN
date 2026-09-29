import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDigidakGroups } from "../redux/digidak/inbox/digidakInboxSlice";

export const useDigidakGroups = (objectName) => {
  const dispatch = useDispatch();
  const { groups } = useSelector((state) => state.digidakInbox);
  const groupsArray = groups?.variables?.out_groups_user || [];
  const hasGroups = groupsArray.length > 0;

  const fetchGroups = useCallback(async () => {
    if (!objectName || hasGroups) return;

    try {
      await dispatch(fetchDigidakGroups(objectName)).unwrap();
    } catch (error) {
      console.error(error);
    }
  }, [dispatch, objectName, hasGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return groupsArray;
};
