import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { publicationService } from "../../../services/caseManagement/ivPublication/publicationService";

// Async thunk for calling publish IV service
export const callPublishIvService = createAsyncThunk("publication/callPublishIvService", async (payload, { rejectWithValue }) => {
  try {
    const response = await publicationService.callPublishIvService(payload);
    return response;
  } catch (error) {
    const errorMessage = error.response?.data?.developerMessage || error.message;
    return rejectWithValue(errorMessage);
  }
});

const publicationSlice = createSlice({
  name: "publication",
  initialState: {},
  reducers: {},
});
export default publicationSlice.reducer;
