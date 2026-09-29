import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakOutwardService } from "../../../services/digidak/outward/digidakOutwardService";

// Create Outward Entry
export const createDigidakOutward = createAsyncThunk("digidakOutward/createOutward", async (formData, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: formData,
      },
    };
    const response = await digidakOutwardService.createOutwardEntry(payload);
    return response;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});
// Provide Outward Permission
export const provideDigidakPermission = createAsyncThunk("digidakOutward/providePermission", async ({ folderId, payload }, { rejectWithValue }) => {
  try {
    const requestBody = {
      "run-stateless": "true",
      data: {
        variables: {
          ...payload,
        },
        packages: {
          digidak_folder: {
            properties: {
              id: folderId,
            },
            href: `folders/cms_digidak_folder/${folderId}`,
          },
        },
      },
    };

    const response = await digidakOutwardService.providePermission(requestBody);
    return response;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

const digidakOutwardSlice = createSlice({
  name: "digidakOutward",

  initialState: {
    loading: false,
    success: false,
    error: null,
    folderData: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder

      // Create Outward
      .addCase(createDigidakOutward.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(createDigidakOutward.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.folderData = action.payload?.data?.packages?.digidak_folder || null;
      })
      .addCase(createDigidakOutward.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Provide Permission
      .addCase(provideDigidakPermission.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(provideDigidakPermission.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(provideDigidakPermission.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default digidakOutwardSlice.reducer;
