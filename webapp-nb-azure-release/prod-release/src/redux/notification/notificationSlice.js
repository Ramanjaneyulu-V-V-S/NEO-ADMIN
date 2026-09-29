import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { notificationService } from "../../services/caseManagement/notification/notificationService";

export const fetchNotification = createAsyncThunk("fetchNotification", async (_, { rejectWithValue }) => {
  try {
    const data = await notificationService.getNotification();
    return data?.entries || [];
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch notifications");
  }
});

const initialState = {
  loading: false,
  error: null,
  notificationData: [],
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    clearNotificationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch pending cases
      .addCase(fetchNotification.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotification.fulfilled, (state, action) => {
        state.loading = false;
        state.notificationData = action.payload;
        state.error = null;
      })
      .addCase(fetchNotification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearNotificationError } = notificationSlice.actions;
export default notificationSlice.reducer;
