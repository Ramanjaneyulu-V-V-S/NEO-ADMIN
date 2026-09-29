import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakInboxService } from "../../../services/digidak/inbox/digidakInboxService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

// 1. Fetch Groups
export const fetchDigidakGroups = createAsyncThunk("digidakInbox/fetchGroups", async (userName, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "login_user",
          in_login_user: userName,
        },
      },
    };

    const response = await digidakInboxService.getGroups(payload);
    return response?.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const fetchDigidakInboxV2 = createAsyncThunk(
  "digidakInbox/fetchInboxV2",
  async ({ userName, groups, from_date, to_date, mode = "inbox", page = 1, ...filterParams }, { rejectWithValue }) => {
    try {
      // base statuses
      let statuses = ["Unread", "Opened", "Assigned Head", "Assigned", "Closed", "Reassigned", "Reassign Head", "Responded", "Follow-Up", "Inprocess", "Pushback"];

      if (mode === "response") {
        statuses = statuses.filter((s) => s !== "Closed");
      }

      const loggedUser = userName;
      const workflowGroups = [...(groups || []), loggedUser].filter(Boolean).join(",");
      const statusString = statuses.join(",");

      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const todayStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

      const formatToDDMMYYYY = (dateVal) => {
        if (!dateVal) return "";
        const d = new Date(dateVal);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      };

      const effectiveFromDate = from_date ? formatToDDMMYYYY(from_date) : "01/01/2024";
      const effectiveToDate = to_date ? formatToDDMMYYYY(to_date) : todayStr;

      // Prepare query params object
      const queryParams = {
        queryName: "digidak.inbox",
        wfgroups: workflowGroups,
        from_date: effectiveFromDate,
        to_date: effectiveToDate,
        task_category: mode === "response" ? "Actionable" : "",
        status: statusString,
        page,
        itemsPerPage: DEFAULT_PAGE_SIZE,
        ...filterParams,
      };

      // API call with params
      const data = await digidakInboxService.getInboxDataV2(queryParams);

      return {
        entries: data?.entries || [],
        total: data?.total || 0,
        page: data?.page || 1,
        itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

export const fetchDigidakLetterbox = createAsyncThunk(
  "digidakLetterbox/fetchDigidakLetterbox",
  async ({ mode = "letterBox", object_name, page = 1, ...filterParams }, { rejectWithValue }) => {
    try {
      let statuses = ["Assigned", "Closed"];

      if (mode === "response") {
        statuses = statuses.filter((s) => s !== "Closed");
      }

      // Prepare query params object
      const queryParams = {
        inline: true,
        input_status: statuses,
        input_hrmd_users: object_name,

        page,
        start: 0,
        "items-per-page": DEFAULT_PAGE_SIZE,
        ...filterParams,
      };

      if (mode === "response") {
        queryParams.input_task_category = "Actionable";
      }

      const data = await digidakInboxService.getLetterBoxData(queryParams);

      return {
        entries: data?.entries || [],
        total: data?.total || 0,
        page: data?.page || 1,
        itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

// V2 — new Integration API for old letters (inbox & outbox)
export const fetchDigidakOldLettersV2 = createAsyncThunk(
  "digidakInbox/fetchOldLettersV2",
  async ({ mode = "Outbox", _login_region, from_date, to_date, page = 1, ...filterParams }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const { isDMDChairman, dashboardDeptNames } = state.digidakInbox;
      const department_name = state.login?.userProfile?.properties?.department_name;
      const is_ddm = department_name?.trim().toLowerCase() === "ddm";
      const dept_names = isDMDChairman ? dashboardDeptNames || [] : [];

      const today = new Date();
      const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

      const effectiveFromDate = from_date || "01/01/2024";
      const effectiveToDate = to_date || todayStr;

      const baseParams = {
        page,
        itemsPerPage: DEFAULT_PAGE_SIZE,
        from_date: effectiveFromDate,
        to_date: effectiveToDate,
        is_ddm,
      };

      // When DMD Chairman, use all dept names instead of single login_region
      const regionValue = dept_names.length > 0 ? dept_names.join(",") : _login_region || "";

      const params =
        mode === "Inbox"
          ? { queryName: "digidak.migration.inbox", selected_region: regionValue, ...baseParams, ...filterParams }
          : { queryName: "digidak.migration.outbox", login_region: regionValue, ...baseParams, ...filterParams };

      const data = await digidakInboxService.getOldLettersDataV2(params);
      return {
        entries: data?.entries || [],
        total: data?.total || 0,
        page: data?.page || 1,
        itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

// Push Back
export const pushbackDigidak = createAsyncThunk("digidakInbox/pushback", async ({ folderId, loginUser, extra = {} }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          in_flag: "Pushback",
          in_login_user: loginUser,
          ...extra,
        },
        packages: {
          digidak_folder: {
            properties: { id: folderId },
            href: `folders/cms_digidak_folder/${folderId}`,
          },
        },
      },
    };

    const response = await digidakInboxService.pushBack(payload);
    return response?.data || response;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

const initialState = {
  loading: false,
  isDMDChairman: false,
  groups: [],
  inboxList: [],
  letterBoxList: [],
  oldLettersList: [],
  dashboardDeptNames: [],
  error: null,
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
  oldLettersPagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const digidakInboxSlice = createSlice({
  name: "digidakInbox",
  initialState,
  reducers: {
    resetDigidakInboxPagination: (state) => {
      state.pagination = initialState.pagination;
    },
    resetOldLettersPagination: (state) => {
      state.oldLettersPagination = initialState.oldLettersPagination;
    },
    setDashboardDeptNames: (state, action) => {
      state.dashboardDeptNames = action.payload || [];
    },
  },
  extraReducers: (builder) => {
    builder
      // 🧩 fetchDigidakGroups
      .addCase(fetchDigidakGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakGroups.fulfilled, (state, action) => {
        const variables = action.payload?.variables || {};
        state.loading = false;
        state.groups = action.payload || [];
        state.isDMDChairman = variables?.is_dmd_chairman || false;
      })
      .addCase(fetchDigidakGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 🧩 fetchDigidakInboxV2
      .addCase(fetchDigidakInboxV2.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakInboxV2.fulfilled, (state, action) => {
        state.loading = false;
        state.inboxList = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDigidakInboxV2.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 🧩 fetchDigidakLetterbox
      .addCase(fetchDigidakLetterbox.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakLetterbox.fulfilled, (state, action) => {
        state.loading = false;
        state.inboxList = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDigidakLetterbox.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 🧩 fetchDigidakOldLettersV2
      .addCase(fetchDigidakOldLettersV2.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakOldLettersV2.fulfilled, (state, action) => {
        state.loading = false;
        state.oldLettersList = action.payload.entries;
        state.oldLettersPagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDigidakOldLettersV2.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(pushbackDigidak.pending, (state) => {
        state.loading = true;
      })
      .addCase(pushbackDigidak.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(pushbackDigidak.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetDigidakInboxPagination, resetOldLettersPagination, setDashboardDeptNames } = digidakInboxSlice.actions;
export default digidakInboxSlice.reducer;
