import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const digidakCorrespondenceService = {
  // Get Groups for Vertical Head
  getVerticalHeadGroups: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakVerticalHeadGroups, payload);
    return response.data;
  },
  getVerticalHeadGroupCheck: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
    return response.data;
  },
  // Get Vertical Users
  getVerticalUsers: async (payload, params = {}) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakVerticalUsers, payload, {
      params: {
        "include-lwso": true,
        page: 1,
        start: 0,
        "items-per-page": 100,
        ...params,
      },
    });
    return response.data;
  },
  // Assign User
  providePermission: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.provideDigidakPermission, payload);
    return response.data;
  },
};
