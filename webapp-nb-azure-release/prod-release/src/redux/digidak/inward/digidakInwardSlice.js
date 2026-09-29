import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";

export const createDigidakInward = createAsyncThunk("digidak/createInward", async (formData, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: formData,
      },
    };

    const response = await digidakInwardService.createInwardEntry(payload);
    return response; // full API response
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});
// Fetch Group
export const fetchDigidakGroups = createAsyncThunk("digidak/fetchGroups", async ({ loginUser, groupName, flag = "inwardvertical" }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag,
          in_login_user: loginUser,
          in_group_name: groupName,
        },
      },
    };

    const response = await digidakInwardService.getGroups(payload);
    return response;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});
// Provide Permission
export const provideDigidakPermission = createAsyncThunk("digidak/providePermission", async ({ folderId, status = "Assigned Head", extra = {} }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          in_flag: status,
          ...extra, // dynamic fields
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
    const response = await digidakInwardService.providePermission(payload);
    return response;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});
export const fetchDigidakMovementRegister = createAsyncThunk("getDigidakMovementRegister", async (params, { rejectWithValue }) => {
  try {
    const data = await digidakInwardService.getDigidakMovementRegister(params);
    return data?.entries || [];
  } catch (err) {
    return rejectWithValue(err?.response?.data || err.message);
  }
});

const digidakInwardSlice = createSlice({
  name: "digidakInward",

  initialState: {
    loading: false,
    success: false,
    error: null,
    folderData: null,
    digidakMovementRegister: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createDigidakInward.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(createDigidakInward.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        const folder = action.payload?.data?.packages?.digidak_folder || null;
        state.folderData = folder;
      })
      .addCase(createDigidakInward.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.success = false;
      })
      // fetchDigidakGroups
      .addCase(fetchDigidakGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakGroups.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchDigidakGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // provideDigidakPermission
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
        state.success = false;
      })
      // Fetch Movement register cases
      .addCase(fetchDigidakMovementRegister.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakMovementRegister.fulfilled, (state, action) => {
        state.loading = false;
        state.digidakMovementRegister = action.payload;
      })
      .addCase(fetchDigidakMovementRegister.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default digidakInwardSlice.reducer;
