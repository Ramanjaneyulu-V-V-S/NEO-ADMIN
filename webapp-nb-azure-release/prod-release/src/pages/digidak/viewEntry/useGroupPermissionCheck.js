import { useEffect, useState } from "react";
import { digidakCorrespondenceService } from "../../../services/digidak/correspondence/digidakCorrespondenceService";

/**
 * Checks whether the logged-in user belongs to a given vertical-head group.
 * Replaces the three near-identical useEffect blocks that were in ViewEntry.
 *
 * @param {string|undefined} loginUser      - current user's object_name
 * @param {string|undefined} groupName      - group to check membership against
 * @param {object} [options]
 * @param {boolean} [options.includeLoginUser] - if true, sends in_login_user in payload
 * @param {string[]} [options.mergeUsers]      - extra user list to merge with API result before checking
 * @returns {boolean} whether the user is allowed
 */
const useGroupPermissionCheck = (loginUser, groupName, options = {}) => {
  const { includeLoginUser = false, mergeUsers } = options;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!loginUser || !groupName || groupName === "-" || groupName === "") {
      setAllowed(false);
      return;
    }

    const checkPermission = async () => {
      try {
        const variables = { flag: "vertical_head_group", in_group_name: groupName };
        if (includeLoginUser) {
          variables.in_login_user = loginUser;
        }

        const payload = {
          "run-stateless": "true",
          data: { variables },
        };

        const res = await digidakCorrespondenceService.getVerticalHeadGroupCheck(payload);
        const outUsers = res?.data?.variables?.out_groups_user || [];

        if (mergeUsers) {
          const combined = [...outUsers, ...mergeUsers];
          setAllowed(combined.includes(loginUser));
        } else {
          // outUsers can be array or string depending on the API response
          const userList = Array.isArray(outUsers) ? outUsers : String(outUsers);
          setAllowed(userList.includes(loginUser));
        }
      } catch (err) {
        console.error(err);
        setAllowed(false);
      }
    };

    checkPermission();
  }, [loginUser, groupName, includeLoginUser, mergeUsers]);

  return allowed;
};

export default useGroupPermissionCheck;
