import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { circularsService } from "../../../services/caseManagement/circulars/circularsService";

export const fetchCirculars = createAsyncThunk("circulars/fetchCirculars", async (params, { rejectWithValue }) => {
  try {
    const data = await circularsService.getCirculars(params);
    return data?.entries || [];
  } catch (error) {
    const message = error?.message || "Failed to fetch circulars.";
    return rejectWithValue(message);
  }
});
export const fetchFavouriteCirculars = createAsyncThunk("circulars/fetchFavouriteCirculars", async (params, { rejectWithValue }) => {
  try {
    const data = await circularsService.getFavouriteCirculars(params);
    return data?.entries || [];
  } catch (error) {
    const message = error?.message || "Failed to fetch favourite circulars.";
    return rejectWithValue(message);
  }
});
export const favouriteCirculars = createAsyncThunk("circulars/favouriteCirculars", async (params, { rejectWithValue }) => {
  try {
    const data = await circularsService.favouriteCirculars(params);
    return data;
  } catch (error) {
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to update favourite circular.";
    return rejectWithValue(message);
  }
});

const initialState = {
  circulars: [],
  favouriteCirculars: [],
  loadingCirculars: false,
  loadingFavouriteCirculars: false,
  updatingFavourite: false,
  error: null,
};

const circularsSlice = createSlice({
  name: "circulars",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCirculars.pending, (state) => {
        state.loadingCirculars = true;
        state.error = null;
        state.circulars = [];
      })
      .addCase(fetchCirculars.fulfilled, (state, action) => {
        state.loadingCirculars = false;
        state.circulars = action.payload;
        state.error = null;
      })
      .addCase(fetchCirculars.rejected, (state, action) => {
        state.loadingCirculars = false;
        state.error = action.payload || action.error?.message || "Failed to fetch circulars.";
      })

      .addCase(fetchFavouriteCirculars.pending, (state) => {
        state.loadingFavouriteCirculars = true;
        state.error = null;
      })
      .addCase(fetchFavouriteCirculars.fulfilled, (state, action) => {
        state.loadingFavouriteCirculars = false;
        state.favouriteCirculars = action.payload;
        state.error = null;
      })
      .addCase(fetchFavouriteCirculars.rejected, (state, action) => {
        state.loadingFavouriteCirculars = false;
        state.error = action.payload || action.error?.message || "Failed to fetch favourite circulars.";
      })

      .addCase(favouriteCirculars.pending, (state) => {
        state.updatingFavourite = true;
        state.error = null;
      })
      .addCase(favouriteCirculars.fulfilled, (state, action) => {
        state.updatingFavourite = false;
        state.error = null;
        const entries = action.payload?.entries;
        if (Array.isArray(entries)) {
          state.favouriteCirculars = entries;
        }
      })
      .addCase(favouriteCirculars.rejected, (state, action) => {
        state.updatingFavourite = false;
        state.error = action.payload || action.error?.message || "Failed to update favourite circular.";
      });
  },
});

export default circularsSlice.reducer;
