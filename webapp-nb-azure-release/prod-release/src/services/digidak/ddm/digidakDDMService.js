import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const digidakDDMService = {
  getDDMDigidakData: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakInwardGridData, {
      params,
    });
    return {
      entries: response.data?.entries || [],
      total: response.data?.total || 0,
      page: response.data?.page || 1,
      itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
    };
  },
  getDDMCommunicationUsers: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
    return response.data;
  },
};
