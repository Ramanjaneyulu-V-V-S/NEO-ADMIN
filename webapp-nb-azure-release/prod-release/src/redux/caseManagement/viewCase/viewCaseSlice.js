import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { viewCaseService } from "../../../services/caseManagement/viewCase/ViewCaseService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

// fetch ViewCase
export const fetchViewCases = createAsyncThunk("viewCases/fetchViewCases", async (params, { rejectWithValue }) => {
  try {
    const data = await viewCaseService.getViewCases(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    const message = error.response?.data?.message || "Failed to fetch cases";
    return rejectWithValue(message);
  }
});

const initialState = {
  loading: false,
  countLoading: false,
  error: null,
  viewCases: [],
  casesCount: [],
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const viewCasesSlice = createSlice({
  name: "viewCases",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetViewCasesPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder

      // fetch ViewCase
      .addCase(fetchViewCases.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchViewCases.fulfilled, (state, action) => {
        state.loading = false;
        state.viewCases = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchViewCases.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, resetViewCasesPagination } = viewCasesSlice.actions;
export default viewCasesSlice.reducer;
