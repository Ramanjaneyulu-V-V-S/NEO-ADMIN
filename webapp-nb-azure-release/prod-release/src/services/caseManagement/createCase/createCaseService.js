import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const createCaseService = {
  getVerticalCaseType: async ({ input_folder = "", page = 1, start = 0, itemsPerPage = 100 }) => {
    const response = await axiosInstance.get(ServiceUrl.getDepartments, {
      params: {
        inline: true,
        input_folder: input_folder,
        page: page,
        start: start,
        "items-per-page": itemsPerPage,
      },
    });
    return response.data;
  },
  getFileNumbers: async (params) => {
    const defaultParams = {
      inline: true,
      input_ho_ro: "",
      page: 1,
      start: 0,
      "items-per-page": 50,
    };
    const response = await axiosInstance.get(ServiceUrl.getFileNumbers, {
      params: { ...defaultParams, ...params },
    });
    const data = response.data;
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.["items-per-page"] || 50,
    };
  },
  createNotesheet: async (notes = {}) => {
    const response = await axiosInstance.post(ServiceUrl.createNotesheet, notes, {
      params: {
        id: "processes%2Fcms_create_notesheet_from_inline_editor%2Fcms_create_notesheet_from_inline_editor_initiate_staless_ds_outputs-3",
      },
    });
    return response.data;
  },
  uploadDocument: async (payload) => {
    const folderId = payload?.properties?.folder_id;

    const url = ServiceUrl.uploadDocument(folderId);
    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  createCase: async (caseData = {}) => {
    const response = await axiosInstance.post(ServiceUrl.createCase, caseData, {
      params: {
        id: "processes%2Fcms_create_case%2Fcms_create_case_initiate_staless_ds_outputs-3",
      },
    });

    return response.data;
  },
};
