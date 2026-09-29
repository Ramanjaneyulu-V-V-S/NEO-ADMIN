import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchFileNumbers } from "../redux/caseManagement/createCase/createCaseSlice";

export const useFileNumbers = () => {
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, ro_short_code, department_short_code } = userProfile?.properties || {};

  const { fileNumbers, fileNumbersPagination, loading } = useSelector((state) => state.createCase);

  const isRO = office_type !== "HO";
  const baseParams = {
    input_ho_ro: office_type,
    input_dept_short_code: department_short_code,
    ...(isRO && { input_ro_short_code: ro_short_code }),
  };

  const fetchPage = useCallback(
    (page = 1, filters = null) => {
      if (!department_short_code) return;
      dispatch(fetchFileNumbers({ ...baseParams, page, "items-per-page": fileNumbersPagination.itemsPerPage, ...filters }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [department_short_code, dispatch, office_type, ro_short_code, fileNumbersPagination.itemsPerPage],
  );

  useEffect(() => {
    if (!department_short_code) return;
    if (fileNumbers && fileNumbers.length > 0) return;

    dispatch(fetchFileNumbers(baseParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department_short_code, dispatch, office_type, ro_short_code]);

  return { fileNumbers, fileNumbersPagination, fileNumbersLoading: loading, fetchFileNumbersPage: fetchPage };
};
