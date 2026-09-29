import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { createCaseService } from "../../../services/caseManagement/createCase/createCaseService";

export const fetchVertical = createAsyncThunk("dropdown/fetchVertical", async (params, { rejectWithValue }) => {
  try {
    const response = await createCaseService.getVerticalCaseType(params);
    let vertical =
      response?.entries?.map((entry) => ({
        text: entry?.content?.properties?.object_name,
        value: entry?.content?.properties?.title,
        id: entry?.content?.properties?.id,
      })) || [];

    // Sort alphabetically by `text`
    vertical.sort((a, b) => a.text.localeCompare(b.text));

    return vertical;
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch verticals");
  }
});
export const fetchCaseTypes = createAsyncThunk("dropdown/fetchCaseTypes", async (params, { rejectWithValue }) => {
  try {
    const response = await createCaseService.getVerticalCaseType(params);
    let caseTypes =
      response?.entries?.map((entry) => ({
        text: entry?.content?.properties?.object_name,
        value: entry?.content?.properties?.object_name,
      })) || [];

    // Sort alphabetically by `text`
    caseTypes.sort((a, b) => a.text.localeCompare(b.text));

    return caseTypes;
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch case types");
  }
});

export const fetchFileNumbers = createAsyncThunk("dropdown/fetchFileNumbers", async (params, { rejectWithValue }) => {
  try {
    const data = await createCaseService.getFileNumbers(params);
    const transformedData = (data?.entries || []).map((fileNumber) => ({
      text: fileNumber?.content?.properties?.description,
      value: fileNumber?.content?.properties?.object_name,
    }));
    return {
      data: transformedData,
      total: data?.total || 0,
      page: data?.page || 1,
      itemsPerPage: data?.itemsPerPage || 50,
    };
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch file numbers");
  }
});

const initialState = {
  loading: false,
  error: null,
  vertical: [],
  caseTypes: [],
  fileNumbers: [],
  fileNumbersPagination: {
    total: 0,
    page: 1,
    itemsPerPage: 50,
  },
};

const createCaseSlice = createSlice({
  name: "createCase",
  initialState,
  reducers: {
    clearCreateCaseError: (state) => {
      state.error = null;
    },
    resetFileNumbersPagination: (state) => {
      state.fileNumbersPagination = initialState.fileNumbersPagination;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch vertical
      .addCase(fetchVertical.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.vertical = [];
      })
      .addCase(fetchVertical.fulfilled, (state, action) => {
        state.loading = false;
        state.vertical = action.payload;
      })
      .addCase(fetchVertical.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Case Types
      .addCase(fetchCaseTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCaseTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.caseTypes = action.payload;
      })
      .addCase(fetchCaseTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch file numbers
      .addCase(fetchFileNumbers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFileNumbers.fulfilled, (state, action) => {
        state.loading = false;
        state.fileNumbers = action.payload.data;
        state.fileNumbersPagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
        };
      })
      .addCase(fetchFileNumbers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCreateCaseError, resetFileNumbersPagination } = createCaseSlice.actions;
export default createCaseSlice.reducer;
