import { ServiceUrl } from "../../serviceUrl";
import axiosInstance from "../../axiosConfig";

export const digidakDropdownService = {
  getDropdownData: async (type) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakDropdown(type));
    return response.data;
  },
  //  For outward source verticals
  getSourceVerticalDropdown: async (payload) => {
    const url = ServiceUrl.getDigidakSourceVertical;

    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  // For HRMD users dropdown
  getHRMDUsersDropdown: async (payload) => {
    const url = ServiceUrl.getDigidakGroups;
    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  // For DDM users dropdown
  getDDMUsersDropdown: async (payload) => {
    const url = ServiceUrl.getDigidakGroups;
    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  // For HRMD users dropdown -> DO Letter
  getHRMDDOUsersDropdown: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getSelectedRecipientsCombined, payload);
    return response.data;
  },
};
