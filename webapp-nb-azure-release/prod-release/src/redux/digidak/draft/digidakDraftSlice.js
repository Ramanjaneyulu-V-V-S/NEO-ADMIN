import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakDraftService } from "../../../services/digidak/draft/digidakDraftService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

export const fetchDigidakDraft = createAsyncThunk("digidakDraft/fetchDraft", async ({ userName, inputStatus, page = 1, ...filterParams }, { rejectWithValue }) => {
  try {
    //  Prepare query params object
    const queryParams = {
      inline: true,
      input_status: inputStatus,
      input_initiator: userName,
      input_is_forward: false,
      page,
      start: 0,
      "items-per-page": DEFAULT_PAGE_SIZE,
      ...filterParams,
    };

    // API call with params
    const data = await digidakDraftService.getDraftData(queryParams);

    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
    };
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

const initialState = {
  loading: false,
  groups: [],
  draftList: [],
  error: null,
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const digidakDraftSlice = createSlice({
  name: "digidakDraft",
  initialState,
  reducers: {
    resetDigidakDraftPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDigidakDraft.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakDraft.fulfilled, (state, action) => {
        state.loading = false;
        state.draftList = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDigidakDraft.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetDigidakDraftPagination } = digidakDraftSlice.actions;
export default digidakDraftSlice.reducer;
