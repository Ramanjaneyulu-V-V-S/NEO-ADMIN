import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const digidakInwardService = {
  // API 1: Create Inward Entry
  createInwardEntry: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.createDigidakInward, payload);
    return response.data;
  },
  // Intermediate API: Get Groups (new requirement)
  getGroups: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
    return response.data;
  },
  // API 2: Provide Permission
  providePermission: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.provideDigidakPermission, payload);
    return response.data;
  },
  getDigidakInwardGridData: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        input_uid_number: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };

      const mergedParams = { ...defaultParams, ...params };

      // ⭐ Automatically keep only the one that has data
      if (mergedParams.input_object_id) {
        delete mergedParams.input_uid_number;
      }
      if (mergedParams.input_uid_number) {
        delete mergedParams.input_object_id;
      }

      const response = await axiosInstance.get(ServiceUrl.getDigidakInwardGridData, {
        params: mergedParams,
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  // fetch doc
  getInwardDocuments: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        input_parent_folders: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };

      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getInwardDocuments, {
        params: mergedParams,
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  updateDocumentsType: async ({ docId, document_type, object_name, uid_number }) => {
    const payload = {
      properties: {
        document_type,
        object_name,
        uid_number,
      },
      type: "cms_digidak_document",
    };

    try {
      const response = await axiosInstance.post(
        `${ServiceUrl.updateDocumentsType}/${docId}`, // <-- append docId to URL
        payload,
      );
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getDigidakMovementRegister: async (params) => {
    try {
      const defaultParams = {
        inline: true,
        input_parent_folders: "",
        page: 1,
        start: 0,
        "items-per-page": 50,
      };
      const mergedParams = { ...defaultParams, ...params };
      const response = await axiosInstance.get(ServiceUrl.getDigidakMovementRegister, {
        params: mergedParams,
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
