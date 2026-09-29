import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { digidakCorrespondenceService } from "../services/digidak/correspondence/digidakCorrespondenceService";
import { setCGMUser } from "../redux/login/loginSlice";

export function useCheckCGMUser() {
  const dispatch = useDispatch();
  const { userProfile, isCGMUser } = useSelector((state) => state.login);
  const { object_name, office_type, department_short_code, ro_short_code } = userProfile?.properties || {};

  useEffect(() => {
    if (!userProfile) return;
    if (!object_name || !office_type) return;
    if (isCGMUser !== null) return;

    // Build CGM group names
    const HOCgmGroupName = `ecm_digidak_${office_type.toLowerCase()}_${department_short_code?.toLowerCase()}_cgm`;
    const ROTECgmGroupName = `ecm_digidak_${office_type.toLowerCase()}_${ro_short_code?.toLowerCase()}_cgm`;

    const checkCGM = async () => {
      try {
        const permissionPayload = {
          "run-stateless": "true",
          data: {
            variables: {
              flag: "vertical_head_group",
              in_group_name: office_type === "HO" ? HOCgmGroupName : ROTECgmGroupName,
            },
          },
        };

        const cgmRes = await digidakCorrespondenceService.getVerticalHeadGroupCheck(permissionPayload);
        const outUsers = cgmRes?.data?.variables?.out_groups_user || [];
        const isCGM = outUsers.includes(object_name);

        // Store globally
        dispatch(setCGMUser(isCGM));
      } catch (err) {
        console.error(err);
      }
    };

    checkCGM();
  }, [object_name, office_type, department_short_code, ro_short_code, isCGMUser, dispatch, userProfile]);
}
