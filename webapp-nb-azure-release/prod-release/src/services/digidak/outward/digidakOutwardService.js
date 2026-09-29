import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const digidakOutwardService = {
  // API 1: Create Outward Entry
  createOutwardEntry: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.createDigidakOutward, payload);
    return response.data;
  },
  // API 2: Provide Permission
  providePermission: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.provideDigidakOutwardPermission, payload);
    return response.data;
  },
  // getSelectedRecipientsCombined
  getSelectedRecipientsCombined: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getSelectedRecipientsCombined, payload);
    return response.data;
  },
  // getEndorseSequence
  getEndorseSequence: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getEndorseSequence, payload);
    return response.data;
  },
  // Get Digidak Groups for Popup
  getDigidakGroups: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
