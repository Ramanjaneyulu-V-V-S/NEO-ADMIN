import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { caseDetailsService } from "../../../services/caseManagement/caseDetails/caseDetailsService";

// Default page size for server-side pagination
export const DEFAULT_REF_PAGE_SIZE = 50;

export const fetchCaseDetails = createAsyncThunk("viewCase/fetchCaseDetails", async ({ folderId }, { rejectWithValue }) => {
  try {
    const response = await caseDetailsService.getCaseDetails(folderId);
    return response;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to fetch case details";
    return rejectWithValue(message);
  }
});
export const updateCaseDetails = createAsyncThunk("viewCase/updateCaseDetails", async ({ folderId, payload }, { rejectWithValue }) => {
  try {
    const response = await caseDetailsService.updateCaseDetails(folderId, payload);
    return response;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to update case details";
    return rejectWithValue(message);
  }
});
export const fetchReferenceCases = createAsyncThunk("viewCases/fetchReferenceCases", async (params, { rejectWithValue }) => {
  try {
    const data = await caseDetailsService.getReferenceCases(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_REF_PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err?.response?.data || err.message);
  }
});
export const fetchSelectReferenceCases = createAsyncThunk("viewCases/fetchSelectReferenceCases", async (params, { rejectWithValue }) => {
  try {
    const data = await caseDetailsService.selectReferenceCases(params);
    return {
      entries: data?.entries || [],
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || DEFAULT_REF_PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err?.response?.data || err.message);
  }
});
export const addReferenceCases = createAsyncThunk("viewCase/addReferenceCases", async ({ folderId, payload }, { rejectWithValue }) => {
  try {
    const response = await caseDetailsService.addReferenceCases(folderId, payload);
    return response;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to update case details";
    return rejectWithValue(message);
  }
});
export const removeReferenceCases = createAsyncThunk("viewCase/removeReferenceCases", async ({ folderId, payload }, { rejectWithValue }) => {
  try {
    const response = await caseDetailsService.removeReferenceCases(folderId, payload);
    return response;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to update case details";
    return rejectWithValue(message);
  }
});
export const fetchMovementRegister = createAsyncThunk("viewCases/fetchMovementRegister", async (params, { rejectWithValue }) => {
  try {
    const data = await caseDetailsService.getMovementRegister(params);
    return data?.entries || [];
  } catch (err) {
    return rejectWithValue(err?.response?.data || err.message);
  }
});

const initialState = {
  loading: false,
  movementLoading: false,
  referenceLoading: false,
  selectRefLoading: false,
  error: null,
  caseDetails: null,
  movementRegister: [],
  referenceCases: [],
  selectReferenceCases: [],
  referencePagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_REF_PAGE_SIZE,
    totalPages: 0,
  },
  selectRefPagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_REF_PAGE_SIZE,
    totalPages: 0,
  },
};

const caseDetailsSlice = createSlice({
  name: "caseDetails",
  initialState,
  reducers: {
    clearCaseDetails: (state) => {
      state.error = null;
    },
    resetReferencePagination: (state) => {
      state.referencePagination = initialState.referencePagination;
    },
    resetSelectRefPagination: (state) => {
      state.selectRefPagination = initialState.selectRefPagination;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCaseDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCaseDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.caseDetails = action.payload;
        state.error = null;
      })
      .addCase(fetchCaseDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateCaseDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCaseDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.caseDetails = action.payload;
        state.error = null;
      })
      .addCase(updateCaseDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch reference cases
      .addCase(fetchReferenceCases.pending, (state) => {
        state.referenceLoading = true;
        state.error = null;
        state.referenceCases = [];
      })
      .addCase(fetchReferenceCases.fulfilled, (state, action) => {
        state.referenceLoading = false;
        state.referenceCases = action.payload.entries;
        state.referencePagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchReferenceCases.rejected, (state, action) => {
        state.referenceLoading = false;
        state.error = action.payload;
      })

      // select reference cases
      .addCase(fetchSelectReferenceCases.pending, (state) => {
        state.selectRefLoading = true;
        state.error = null;
      })
      .addCase(fetchSelectReferenceCases.fulfilled, (state, action) => {
        state.selectRefLoading = false;
        state.selectReferenceCases = action.payload.entries;
        state.selectRefPagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchSelectReferenceCases.rejected, (state, action) => {
        state.selectRefLoading = false;
        state.error = action.payload;
      })

      // Fetch Movement register cases
      .addCase(fetchMovementRegister.pending, (state) => {
        state.movementLoading = true;
        state.error = null;
      })
      .addCase(fetchMovementRegister.fulfilled, (state, action) => {
        state.movementLoading = false;
        state.movementRegister = action.payload;
      })
      .addCase(fetchMovementRegister.rejected, (state, action) => {
        state.movementLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCaseDetails, resetReferencePagination, resetSelectRefPagination } = caseDetailsSlice.actions;
export default caseDetailsSlice.reducer;
