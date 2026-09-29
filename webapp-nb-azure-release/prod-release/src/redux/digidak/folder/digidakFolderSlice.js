import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";

export const fetchDigidakFolderDetails = createAsyncThunk("digidak/fetchFolderDetails", async ({ input_object_id = "", input_uid_number = "" }, { rejectWithValue }) => {
  try {
    const params = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 100,
      input_object_id,
      input_uid_number,
    };

    const response = await digidakInwardService.getDigidakInwardGridData(params);
    return response;
  } catch (err) {
    return rejectWithValue(err?.response?.data || err.message);
  }
});

const digidakFolderSlice = createSlice({
  name: "digidakFolder",
  initialState: {
    loading: false,
    error: null,
    folderDetails: null,
  },
  reducers: {
    clearFolderDetails: (state) => {
      state.folderDetails = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDigidakFolderDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakFolderDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.folderDetails = action.payload?.entries?.[0] || null;
      })
      .addCase(fetchDigidakFolderDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearFolderDetails } = digidakFolderSlice.actions;
export default digidakFolderSlice.reducer;
