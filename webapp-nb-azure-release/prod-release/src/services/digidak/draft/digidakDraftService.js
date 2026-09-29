import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const digidakDraftService = {
  getDraftData: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakDraft, {
      params,
      paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
    });
    return {
      entries: response.data?.entries || [],
      total: response.data?.total || 0,
      page: response.data?.page || 1,
      itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
    };
  },
  getDigidakOneFolder: async (folderId) => {
    const response = await axiosInstance.get(`${ServiceUrl.getDigidakOneFolder}/${folderId}`);
    return response.data;
  },
};
