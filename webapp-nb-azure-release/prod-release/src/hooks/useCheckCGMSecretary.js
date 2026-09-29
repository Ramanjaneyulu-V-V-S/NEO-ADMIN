import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCGMSecretary } from "../redux/login/loginSlice";
import { viewCaseService } from "../services/caseManagement/viewCase/ViewCaseService";

export function useCheckCGMSecretary() {
  const dispatch = useDispatch();
  const { userProfile, isCGMSecretary } = useSelector((state) => state.login);
  const { object_name, office_type, department_short_code, ro_short_code } = userProfile?.properties || {};

  useEffect(() => {
    if (!userProfile) return;
    if (!object_name || !office_type) return;
    if (isCGMSecretary !== null) return;

    // Build CGM Secretary group names
    const HOCgmSecGroupName = `ecm_${office_type.toLowerCase()}_${department_short_code?.toLowerCase()}_cgm_sec`;
    const ROTECgmSecGroupName = `ecm_${ro_short_code?.toLowerCase()}_cgm_sec`;

    const checkCGMSecretary = async () => {
      try {
        const payload = {
          "run-stateless": "true",
          data: {
            variables: {
              group_name: office_type === "HO" ? HOCgmSecGroupName : ROTECgmSecGroupName,
              is_group: true,
            },
          },
        };

        const res = await viewCaseService.getUserNames(payload);
        const outUsers = res?.data?.variables?.op_user_name || [];
        const isCGMSec = outUsers.includes(object_name);

        dispatch(setCGMSecretary(isCGMSec));
      } catch (err) {
        console.error(err);
      }
    };

    checkCGMSecretary();
  }, [object_name, office_type, department_short_code, ro_short_code, isCGMSecretary, dispatch, userProfile]);
}
