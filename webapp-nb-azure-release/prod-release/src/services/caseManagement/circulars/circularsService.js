import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";

const buildFavouritePayload = ({ circularId, userProfileId, operation }) => {
  if (!circularId || !userProfileId || !operation) {
    throw new Error("Invalid payload for favourite circulars operation.");
  }

  return {
    "run-stateless": "true",
    data: {
      variables: {
        ip_operation: operation,
      },
      packages: {
        circularObject: {
          properties: {
            id: circularId,
          },
          href: `contents/cms_circulars/${circularId}`,
        },
        userProfileObject: {
          properties: {
            id: userProfileId,
          },
          href: `business-objects/cms_user_profile/${userProfileId}`,
        },
      },
    },
  };
};
const DEFAULT_PAGE_SIZE = 50;

export const circularsService = {
  getCirculars: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": DEFAULT_PAGE_SIZE,
    };

    try {
      const mergedParams = { ...defaultParams, ...params };
      const response = await axiosInstance.get(ServiceUrl.getCirculars, {
        params: mergedParams,
      });
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
  // get favourite circulars
  getFavouriteCirculars: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": DEFAULT_PAGE_SIZE,
    };

    try {
      const mergedParams = { ...defaultParams, ...params };
      const response = await axiosInstance.get(ServiceUrl.getFavouriteCirculars, {
        params: mergedParams,
      });
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
  // create favourite circular
  favouriteCirculars: async ({ payload, circularId, userProfileId, operation }) => {
    try {
      const requestBody =
        payload ||
        buildFavouritePayload({
          circularId,
          userProfileId,
          operation,
        });

      const response = await axiosInstance.post(ServiceUrl.favouriteCirculars, requestBody);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
      throw error;
    }
  },
};
