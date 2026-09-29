import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const documentService = {
  getFilePath: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axiosInstance.post(ServiceUrl.getFilePath, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // import draft document
  uploadDocument: async (payload) => {
    const folderId = payload?.properties?.folder_id;

    const url = ServiceUrl.uploadDocument(folderId);
    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  // get draft documents
  getDraftDocuments: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 75,
    };

    const response = await axiosInstance.get(ServiceUrl.getDraftSupportingDoc, {
      params: {
        ...defaultParams,
        ...params,
      },
    });
    return response.data;
  },
  addVersionDraftDoc: async (documentId, payload) => {
    const url = ServiceUrl.addVersionDraftDoc(documentId);
    const response = await axiosInstance.post(url, payload);
    return response.data;
  },
  // get draft documents
  getSupportingDocuments: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 75,
    };

    const response = await axiosInstance.get(ServiceUrl.getDraftSupportingDoc, {
      params: {
        ...defaultParams,
        ...params,
      },
    });
    return response.data;
  },

  // download doc
  downloadDocument: async (documentId) => {
    const response = await axiosInstance.get(ServiceUrl.downloadDocument(documentId), {
      responseType: "blob",
    });
    return response.data;
  },
  // delete draft or supporting document
  deleteDocument: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.deleteDraftSupportingDoc, payload);
    return response.data;
  },
  // get getFinalDocuments
  getFinalDocuments: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 75,
    };

    const response = await axiosInstance.get(ServiceUrl.getDraftSupportingDoc, {
      params: {
        ...defaultParams,
        ...params,
      },
    });
    return response.data;
  },
  moveToFinalDocument: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.updateFinalDocument, payload);
    return response.data;
  },
  renderSupporting: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.renderSupporting, payload);
    return response.data;
  },
  // get folder id by path
  getFolderIdByPath: async (folderPath) => {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "folder_path",
          in_location: folderPath,
        },
      },
    };
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);

    return response?.data;
  },
};
