import { ServiceUrl } from "../../serviceUrl";
import axiosInstance from "../../axiosConfig";

export const notificationService = {
  getNotification: async (payload) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.getNotification, {
        params: payload,
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  updateNotificationPreferences: async (payload, id) => {
    try {
      const url = `${ServiceUrl.updateNotificationPreferences}/${id}`;
      const response = await axiosInstance.post(url, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  updateReadStatus: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.updateReadStatus, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
