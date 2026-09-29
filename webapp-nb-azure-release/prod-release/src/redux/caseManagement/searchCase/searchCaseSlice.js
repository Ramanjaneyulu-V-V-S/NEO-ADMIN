import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { searchCaseService } from "../../../services/caseManagement/searchCase/searchCaseService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

export const searchCase = createAsyncThunk("case/searchCase", async (params, { rejectWithValue }) => {
  try {
    const data = await searchCaseService.searchCase(params);
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
export const searchInDoc = createAsyncThunk("case/searchInDoc", async (params, { rejectWithValue }) => {
  try {
    const data = await searchCaseService.searchInDoc(params);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Search in document failed");
  }
});

const initialState = {
  loading: false,
  error: null,
  searchResult: [],
  searchInDocResult: [],
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const searchCaseSlice = createSlice({
  name: "searchCases",
  initialState,
  reducers: {
    clearSearchResults: (state) => {
      state.searchResult = [];
      state.searchInDocResult = [];
    },
    resetSearchPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder
      // Case Search - updates searchResult
      .addCase(searchCase.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.searchResult = [];
      })
      .addCase(searchCase.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResult = action.payload?.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
        state.error = null;
      })
      .addCase(searchCase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Document Search - updates searchInDocResult (NOT searchResult to avoid pollution)
      .addCase(searchInDoc.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.searchInDocResult = [];
      })
      .addCase(searchInDoc.fulfilled, (state, action) => {
        state.loading = false;
        state.searchInDocResult = action.payload?.entries;
        state.error = null;
      })
      .addCase(searchInDoc.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults, resetSearchPagination } = searchCaseSlice.actions;
export default searchCaseSlice.reducer;
