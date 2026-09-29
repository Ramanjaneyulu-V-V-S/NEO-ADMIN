import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakDDMService } from "../../../services/digidak/ddm/digidakDDMService";
import { fetchDigidakGroups } from "../inbox/digidakInboxSlice";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

export const fetchDDMDigidakGridData = createAsyncThunk(
  "ddmDigidak/fetchDDMDigidakGridData",
  async ({ decision, page = 1, start = 0, input_created_on, input_created_on_, ...filterParams }, { rejectWithValue }) => {
    try {
      const queryParams = {
        inline: true,
        input_is_ddm: true,
        input_decision: decision,
        input_status_: "Saved",
        input_is_forward: false,
        page,
        start,
        "items-per-page": DEFAULT_PAGE_SIZE,
      };

      if (input_created_on) queryParams.input_created_on = input_created_on;
      if (input_created_on_) queryParams.input_created_on_ = input_created_on_;

      Object.assign(queryParams, filterParams);

      const data = await digidakDDMService.getDDMDigidakData(queryParams);

      return {
        entries: data?.entries || [],
        total: data?.total || 0,
        page: data?.page || 1,
        itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data || error.message);
    }
  },
);

const initialState = {
  loading: false,
  ddmList: [],
  ddmCommunicationUsers: [],
  isDDMCommunicationUser: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const ddmDigidakSlice = createSlice({
  name: "ddmDigidak",
  initialState,
  reducers: {
    resetDDMDigidakState: (state) => {
      state.loading = false;
      state.ddmList = [];
      state.error = null;
      state.pagination = initialState.pagination;
    },
    resetDDMPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDDMDigidakGridData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDDMDigidakGridData.fulfilled, (state, action) => {
        state.loading = false;
        state.ddmList = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDDMDigidakGridData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // DDM Communication Users populated from Groups API
      .addCase(fetchDigidakGroups.fulfilled, (state, action) => {
        const variables = action.payload?.variables || {};
        const users = variables.out_users_names || [];
        state.ddmCommunicationUsers = users;
        state.isDDMCommunicationUser = users.includes(action.meta.arg);
      });
  },
});

export const { resetDDMDigidakState, resetDDMPagination } = ddmDigidakSlice.actions;
export default ddmDigidakSlice.reducer;
