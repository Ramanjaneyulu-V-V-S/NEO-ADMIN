import axiosInstance from "../../axiosConfig";
import { ServiceUrl } from "../../serviceUrl";
import qs from "qs";

// Default page size for server-side pagination
const DEFAULT_PAGE_SIZE = 50;

export const viewCaseService = {
  // get ViewCase
  getViewCases: async (params = {}) => {
    try {
      const defaultParams = {
        inline: true,
        input_ho_ro: "",
        input_is_migrated: false,
        page: 1,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };

      const mergedParams = { ...defaultParams, ...params };

      const response = await axiosInstance.get(ServiceUrl.getAllCases, {
        params: mergedParams,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
      });

      // Return full response including pagination metadata
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
  // resubmit case
  resubmitCase: async ({ login_user, inp_case_objectid }) => {
    const params = {
      "include-lwso": true,
      page: 1,
      start: 0,
      "items-per-page": 50,
    };

    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          login_user: login_user,
          inp_case_objectid: inp_case_objectid,
        },
      },
    };

    try {
      const response = await axiosInstance.post(ServiceUrl.resubmitCase, payload, { params });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  // initiate Linear Process
  initiateLinearProcess: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.initiateLinearProcess, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getUsers: async ({ input_group_name = "", input_remove_user_name = "", page = 1, start = 0, itemsPerPage = 500 }) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.getUsers, {
        params: {
          inline: true,
          input_group_name: input_group_name,
          input_remove_user_name: input_remove_user_name,
          page: page,
          start: start,
          "items-per-page": itemsPerPage,
        },
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getUserNames: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getUserNames, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getGrade: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getGrade, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getAllGradeUsers: async ({
    input_office_type = "",
    input_ro_short_code = "",
    input_dept_short_code = "",
    input_user_grade = "",
    input_remove_user_name = "",
    page = 1,
    start = 0,
    itemsPerPage = 500,
  }) => {
    try {
      const params = {
        inline: true,
        input_office_type,
        input_dept_short_code,
        input_ro_short_code,
        input_user_grade,
        input_remove_user_name,
        page,
        start,
        "items-per-page": itemsPerPage,
      };

      const response = await axiosInstance.get(ServiceUrl.getAllGradeUsers, {
        params,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }), // key=value1&key=value2
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getCGMGMUsers: async ({ input_office_type = "", input_department_name = "", input_user_grade_ = "", page = 1, start = 0, itemsPerPage = 500 }) => {
    try {
      const params = {
        inline: true,
        input_office_type,
        input_department_name,
        input_user_grade_,
        page,
        start,
        "items-per-page": itemsPerPage,
      };

      const response = await axiosInstance.get(ServiceUrl.userProfile, {
        params,
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }), // key=value1&key=value2
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getCGMUsers: async ({ input_department_short_co = "", input_office_type = "", input_designation = "", input_ro_short_code = "", page = 1, start = 0, itemsPerPage = 500 }) => {
    try {
      const params = {
        inline: true,
        input_department_short_co,
        input_office_type,
        input_designation,
        page,
        start,
        "items-per-page": itemsPerPage,
      };

      if (input_office_type !== "HO" && input_ro_short_code) {
        params.input_ro_short_code = input_ro_short_code;
      }

      const response = await axiosInstance.get(ServiceUrl.userProfile, {
        params,
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getGroups: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getGroups, {
        ...payload,
      });

      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getUserData: async ({
    input_name = "",
    input_user_login_name = "",
    page = 1,
    start = 0,
    input_department_name = "",
    input_user_grade = "",
    input_location = "",
    itemsPerPage = 500,
  }) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.userProfile, {
        params: {
          inline: true,
          input_name: input_name,
          input_user_login_name: input_user_login_name,
          input_department_name: input_department_name,
          input_user_grade: input_user_grade,
          input_location: input_location,
          page: page,
          start: start,
          "items-per-page": itemsPerPage,
        },
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getBackwardPerformers: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getBackwardPerformers, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  getSelectedUserForCaseCancel: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getSelectedUser, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  // get Case Movement Regis
  getCaseMovementRegis: async (caseId) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.caseMovementRegis(), {
        params: { inline: true, input_parent_folders: caseId },
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  fetchWFId: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.getWFId, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  userVerticalDepartmentPart: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.userVerticalDepartmentPart, payload, {
        params: {
          id: "processes%2Fcms_is_given_user_part_%2Fcms_is_given_user_part__initiate_staless_ds_outputs-3",
        },
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  isUserVerticalDepartmentPart: async (payload) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.isUserVerticalDepartmentPart, payload);
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
    }
  },
  deleteCase: async (folderId) => {
    try {
      const response = await axiosInstance.post(ServiceUrl.caseDetails(folderId), {
        properties: { status: "Delete" },
        type: "cms_case_folder",
      });
      return response.data;
    } catch (error) {
      console.error(error?.message || "An error occurred");
      throw error;
    }
  },
  // Fetch created_by dropdown options for Old Cases
  getOldCasesCreatedBy: async (params = {}) => {
    try {
      const response = await axiosInstance.get(ServiceUrl.getOutboxCasesV2, {
        params: {
          queryName: "old.cases.created.by",
          ...params,
        },
        baseURL: (import.meta.env.VITE_API_BASE_URL || "") + (import.meta.env.VITE_API_BASE_PATH || "").replace("/service", ""),
      });
      return response.data?.data || [];
    } catch (error) {
      console.error(error?.message || "An error occurred");
      return [];
    }
  },
};
