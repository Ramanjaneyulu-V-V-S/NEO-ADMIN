import { useSelector } from "react-redux";

export const useDDMContext = () => {
  const { userProfile } = useSelector((state) => state?.login);
  const department_name = userProfile?.properties?.department_name;
  const isDDM = department_name?.trim().toLowerCase() === "ddm";

  return { isDDM };
};
