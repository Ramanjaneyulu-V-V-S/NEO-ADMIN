import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const searchCaseService = {
  searchCase: async (params) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.getAllCases, {
        params: {
          ...params,
          input_is_migrated: false,
        },
      });
      // Return full response including pagination metadata
      return {
        entries: response.data?.entries || [],
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      console.error(error?.message || "An error occurred");
      throw error;
    }
  },
  searchInDoc: async (params) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.searchInDoc, {
        params,
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
