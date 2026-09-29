import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const sentCaseService = {
  // fetch sent cases
  getOutboxCases: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        input_login_user1: "",
        input_remove_decisions1: "",
        input_remove_decisions2: "",
        input_login_user2: "",
        page: 1,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };

      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getOutboxCases, {
        params: mergedParams,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
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
  // fetch sent cases — new API (sent.task query)
  getOutboxCasesV2: async (params = {}) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.getOutboxCasesV2, {
        params,
        baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
      });
      return {
        entries: response.data?.data || [],
        total: response.data?.total || 0,
        page: response.data?.currentPage || 1,
        itemsPerPage: response.data?.itemsPerPage ?? DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      console.error(error?.message || "An error occurred");
      throw error;
    }
  },
  getNotesheetId: async (params) => {
    try {
      const defaultParams = {
        inline: true,
        input_folder_path: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };
      const mergedParams = { ...defaultParams, ...params };
      const response = await axiosInstance.get(ServiceUrl.getNotesheetId, {
        params: mergedParams,
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  refreshNotesheet: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.refreshNotesheet, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  // download notesheet
  downloadNotesheet: async (note_sheet_id) => {
    const response = await axiosInstance.get(ServiceUrl.downloadNotesheet(note_sheet_id), {
      responseType: "blob",
    });
    return response.data;
  },
  // Pull back
  pullBackCase: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.pushPullBackStatus, payload);
    return response.data;
  },
};
