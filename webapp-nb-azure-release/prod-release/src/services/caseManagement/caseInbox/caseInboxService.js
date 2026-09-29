import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const caseInboxService = {
  getInboxCases: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        page: 1,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };

      // Merge default and provided params
      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getInboxCases, {
        params: mergedParams,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
      });

      // Return full response including pagination metadata
      return {
        entries: response.data?.entries || [],
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
        links: response.data?.links || [],
      };
    } catch (error) {
      console.error(error?.message || "An error occurred");
      throw error;
    }
  },
  // Push back
  pushBackCase: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.pushPullBackStatus, payload);
    return response.data;
  },
};
