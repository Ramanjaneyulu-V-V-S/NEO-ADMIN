import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const digidakOutboxService = {
  // 1️⃣ Fetch workflow groups for logged-in user
  getGroups: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.getDigidakGroups, payload);
    return response.data;
  },
  // Digidak Outbox V2 — new Integration API
  getDigidakOutboxV2: async (params = {}) => {
    const response = await axiosInstance.get(ServiceUrl.getDigidakOutboxV2, {
      params,
      baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
    });
    return {
      entries: response.data?.data || [],
      total: response.data?.total || 0,
      page: response.data?.currentPage || 1,
      itemsPerPage: response.data?.itemsPerPage ?? DEFAULT_PAGE_SIZE,
    };
  },
};
