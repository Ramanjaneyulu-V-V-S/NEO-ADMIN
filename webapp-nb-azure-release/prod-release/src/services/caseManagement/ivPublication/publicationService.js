import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

export const publicationService = {
  callPublishIvService: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.callPublishIvService, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
};
