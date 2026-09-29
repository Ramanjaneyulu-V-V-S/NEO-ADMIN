import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const digidakInboxService = {
  // Fetch workflow groups for logged-in user
  getGroups: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
    return response.data;
  },

  // Digidak Inbox V2 : Integration API
  getInboxDataV2: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakInboxV2, {
      params,
      baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
    });
    return {
      entries: response.data?.data || [],
      total: response.data?.total || 0,
      page: response.data?.currentPage || 1,
      itemsPerPage: response.data?.itemsPerPage ?? DEFAULT_PAGE_SIZE,
    };
  },

  // Digidak getLetterBoxData : clean params
  getLetterBoxData: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakInwardGridData, {
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

  pushBack: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.provideDigidakPermission, payload);
    return response.data;
  },

  // Digidak Old Letters V2 — new Integration API
  getOldLettersDataV2: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getOldLettersMigrationV2, {
      params,
      baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
    });
    return {
      entries: response.data?.data || [],
      total: response.data?.total || 0,
      page: response.data?.currentPage || 1,
      itemsPerPage: response.data?.itemsPerPage ?? DEFAULT_PAGE_SIZE,
    };
  },
};
