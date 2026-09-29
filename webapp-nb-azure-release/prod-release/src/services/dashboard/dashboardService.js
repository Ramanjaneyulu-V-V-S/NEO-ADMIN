import axiosInstance from "../axiosConfig";
import { ServiceUrl } from "../serviceUrl";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const dashboardService = {
  getDepartments: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        input_folder: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };

      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getDepartments, {
        params: mergedParams,
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getDashboardVerticals: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getDashboardVerticals, payload, {
        params: {
          "include-lwso": true,
          page: 1,
          start: 0,
          "items-per-page": 50,
        },
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },

  // Digidak Dashboard Grid Data
  getDigidakDashboardGridData: async (payload, extraParams = {}) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getDigidakDashboardCounts, payload, {
        params: {
          "include-lwso": true,
          page: 1,
          start: 0,
          "items-per-page": 50,
          ...extraParams,
        },
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },

  // ECM Dashboard Count V2 : Integration API
  getDashboardCountV2: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakInboxV2, {
      params: { ...params },
      baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
    });
    return response.data?.data || [];
  },

  // Digidak Inbox V2 : Integration API
  getDashboardBarClickDataInboxOutboxV2: async (params = {}) => {
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
};
