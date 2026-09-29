import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { sentCaseService } from "../../../services/caseManagement/sentCases/sentCaseService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

export const fetchOutboxCases = createAsyncThunk("outbox/fetchOutboxCases", async (params, { rejectWithValue }) => {
  try {
    const data = await sentCaseService.getOutboxCases(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    console.error(error);
    return rejectWithValue(error.message);
  }
});

// V2 — new sent.task API
export const fetchOutboxCasesV2 = createAsyncThunk("outbox/fetchOutboxCasesV2", async (params, { rejectWithValue }) => {
  try {
    const data = await sentCaseService.getOutboxCasesV2(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    console.error(error);
    return rejectWithValue(error.message);
  }
});

export const silentFetchOutboxCasesV2 = createAsyncThunk("outbox/silentFetchOutboxCasesV2", async (params, { rejectWithValue }) => {
  try {
    const data = await sentCaseService.getOutboxCasesV2(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// Silent background fetch — updates data without showing the full-screen loader
export const silentFetchOutboxCases = createAsyncThunk("outbox/silentFetchOutboxCases", async (params, { rejectWithValue }) => {
  try {
    const data = await sentCaseService.getOutboxCases(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const initialState = {
  loading: false,
  error: null,
  outboxCases: [],
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const caseOutboxSlice = createSlice({
  name: "caseOutbox",
  initialState,
  reducers: {
    clearCaseOutboxError: (state) => {
      state.error = null;
    },
    resetOutboxPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOutboxCases.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOutboxCases.fulfilled, (state, action) => {
        state.loading = false;
        state.outboxCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
        state.error = null;
      })
      .addCase(fetchOutboxCases.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.outboxCases = [];
      })
      // Silent fetch — no loading state change, just update data when fulfilled
      .addCase(silentFetchOutboxCases.fulfilled, (state, action) => {
        state.outboxCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      // V2 thunks — same state shape
      .addCase(fetchOutboxCasesV2.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOutboxCasesV2.fulfilled, (state, action) => {
        state.loading = false;
        state.outboxCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
        state.error = null;
      })
      .addCase(fetchOutboxCasesV2.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.outboxCases = [];
      })
      .addCase(silentFetchOutboxCasesV2.fulfilled, (state, action) => {
        state.outboxCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      });
  },
});

export const { clearCaseOutboxError, resetOutboxPagination } = caseOutboxSlice.actions;
export default caseOutboxSlice.reducer;
