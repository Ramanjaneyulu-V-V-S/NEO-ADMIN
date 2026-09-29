import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const caseDetailsService = {
  getCaseDetails: async (folderId) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.caseDetails(folderId));
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  updateCaseDetails: async (folderId, payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.caseDetails(folderId), payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getReferenceCases: async (params) => {
    try {
      const defaultParams = {
        inline: true,
        input_object_id: "",
        page: 1,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };
      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getReferenceCases, {
        params: mergedParams,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
      });

      return {
        entries: response.data?.entries || [],
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  selectReferenceCases: async (params) => {
    try {
      const defaultParams = {
        inline: true,
        input_ho_ro: "",
        input_status: "",
        input_object_id: "",
        input_department_short_co: "",
        page: 1,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };
      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.selectReferenceCases, {
        params: mergedParams,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
      });

      return {
        entries: response.data?.entries || [],
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        itemsPerPage: response.data?.["items-per-page"] || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  addReferenceCases: async (folderId, payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.caseDetails(folderId), payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  removeReferenceCases: async (folderId, payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.caseDetails(folderId), payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getMovementRegister: async (params) => {
    try {
      const defaultParams = {
        inline: true,
        input_parent_folders: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };
      const mergedParams = { ...defaultParams, ...params };
      const response = await axiosInstance.get(ServiceUrl.getMovementRegister, {
        params: mergedParams,
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
