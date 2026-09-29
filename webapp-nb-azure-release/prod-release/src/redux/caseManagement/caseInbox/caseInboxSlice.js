import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { caseInboxService } from "../../../services/caseManagement/caseInbox/caseInboxService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

export const fetchInboxCases = createAsyncThunk("inbox/fetchInboxCases", async (params, { rejectWithValue }) => {
  try {
    const data = await caseInboxService.getInboxCases(params);
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

const initialState = {
  loading: false,
  error: null,
  inboxCases: [],
  eaInboxCases: [],
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const caseInboxSlice = createSlice({
  name: "caseInbox",
  initialState,
  reducers: {
    clearCaseInboxError: (state) => {
      state.error = null;
    },
    resetPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    // Inbox cases
    builder
      .addCase(fetchInboxCases.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInboxCases.fulfilled, (state, action) => {
        state.loading = false;
        state.inboxCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
        state.error = null;
      })
      .addCase(fetchInboxCases.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.inboxCases = [];
      });
  },
});

export const { clearCaseInboxError, resetPagination } = caseInboxSlice.actions;
export default caseInboxSlice.reducer;
