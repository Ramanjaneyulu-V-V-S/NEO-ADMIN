import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDigidakDropdown, fetchDigidakSourceVertical, fetchOfficeTypeByDept } from "../redux/digidak/dropdowns/digidakDropdownSlice";
import { fetchCaseTypes } from "../redux/caseManagement/createCase/createCaseSlice";
import { useDDMContext } from "./useDDMContext";

// Centralizes all data-fetching side effects that were previously in Layout.jsx
const useLayoutDataFetch = (screenName) => {
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state?.login);
  const { sourceVerticalData } = useSelector((state) => state.digidakDropdown);
  const { caseTypes } = useSelector((state) => state.createCase);

  const { department_short_code_multi } = userProfile?.properties || {};
  const { isDDM } = useDDMContext();

  const isHRMDUser = department_short_code_multi?.includes("hrmd");
  const sourceVerticalLoaded = sourceVerticalData && typeof sourceVerticalData === "object" && Object.keys(sourceVerticalData).length > 0;

  // Fetch Digidak Dropdowns
  useEffect(() => {
    if (screenName === "inwardEntry" || screenName === "outwardEntry") {
      const dropdowns = ["received_from", "state_of_sender", "type_category", "priority", "secrecy", "languages", "mode_of_receipt"];

      dropdowns.forEach((key) => dispatch(fetchDigidakDropdown(key)));
    }

    // Preload both correspondence dropdowns only for outward entry
    if (screenName === "outwardEntry") {
      dispatch(fetchDigidakDropdown("nature_of_correspondence_internal"));
      dispatch(fetchDigidakDropdown("nature_of_correspondence_external"));
    }

    if (screenName === "outwardEntry" || screenName === "endorseScreen") {
      dispatch(fetchDigidakDropdown("HO"));
      dispatch(fetchDigidakDropdown("RO"));
      dispatch(fetchDigidakDropdown("TE"));
    }
  }, [dispatch, screenName]);

  // Fetch Source Vertical only once per user
  useEffect(() => {
    if (screenName === "inwardEntry" || screenName === "outwardEntry" || screenName === "forwardLetter") {
      const objectName = userProfile?.properties?.object_name;

      if (objectName && !sourceVerticalLoaded) {
        dispatch(
          fetchDigidakSourceVertical({
            loginUser: objectName,
            isDDM,
          }),
        );
      }
    }
  }, [dispatch, screenName, userProfile?.properties?.object_name, sourceVerticalLoaded, isDDM]);

  // Fetch office type by department
  useEffect(() => {
    if (screenName !== "outwardEntry" && screenName !== "forwardLetter") return;
    if (!sourceVerticalLoaded) return; // fix for 403

    const payload = {
      in_login_user: userProfile?.properties?.object_name,
      ...(isHRMDUser && { dept_name: "hrmd" }),
    };

    if (payload.in_login_user) {
      dispatch(fetchOfficeTypeByDept(payload));
    }
  }, [dispatch, screenName, isHRMDUser, userProfile?.properties?.object_name, sourceVerticalLoaded]);

  // Fetch Case Types once for case management screens
  useEffect(() => {
    if (!caseTypes?.length) {
      dispatch(fetchCaseTypes({ input_folder: `/ECM CONFIG/Case Type` }));
    }
  }, []);
};

export default useLayoutDataFetch;
