import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakCorrespondenceService } from "../../../services/digidak/correspondence/digidakCorrespondenceService";

export const fetchDigidakVerticalHeadGroups = createAsyncThunk("digidakCorrespondence/fetchVerticalHeadGroups", async (userName, { rejectWithValue }) => {
  try {
    // Payload for API
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "vertical_head",
          in_login_user: userName,
        },
      },
    };

    // API Call
    const response = await digidakCorrespondenceService.getVerticalHeadGroups(payload);

    // Extract & Map to Dropdown format
    const displayNames = response?.data?.variables?.group_display_name || [];
    const groupNames = response?.data?.variables?.group_names || [];
    const dropdownOptions = displayNames.map((displayName, idx) => ({
      text: displayName,
      value: groupNames[idx] || displayName,
    }));

    return dropdownOptions;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const fetchDigidakVerticalUsers = createAsyncThunk("digidakCorrespondence/fetchVerticalUsers", async ({ folderId, loginUser }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: { variables: { flag: "vertical_users", in_folder_id: folderId, in_login_user: loginUser } },
    };

    // optional: override defaults like page/size here
    const res = await digidakCorrespondenceService.getVerticalUsers(payload, {});

    const users =
      res?.data?.variables?.vertical_users?.map((u) => ({
        text: u,
        value: u,
      })) || [];

    return users;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const provideDigidakPermission = createAsyncThunk("digidakCorrespondence/updateAction", async ({ folderId, actionType, loginUser, extra = {} }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          in_flag: actionType,
          in_login_user: loginUser,
          ...extra,
        },
        packages: {
          digidak_folder: {
            properties: { id: folderId },
            href: `folders/cms_digidak_folder/${folderId}`,
          },
        },
      },
    };
    const res = await digidakCorrespondenceService.providePermission(payload);
    return res;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

const digidakCorrespondenceSlice = createSlice({
  name: "digidakCorrespondence",
  initialState: {
    loading: false,
    success: false,
    error: null,
    verticalHeadGroups: [],
    verticalUsers: [],
    permissionResponse: null,
  },
  reducers: {
    resetCorrespondenceState: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* Fetch Vertical Head Groups */
      .addCase(fetchDigidakVerticalHeadGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakVerticalHeadGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.verticalHeadGroups = action.payload;
      })
      .addCase(fetchDigidakVerticalHeadGroups.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      })

      /* Fetch Vertical Users */
      .addCase(fetchDigidakVerticalUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDigidakVerticalUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.verticalUsers = action.payload;
      })
      .addCase(fetchDigidakVerticalUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Assign User
      .addCase(provideDigidakPermission.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(provideDigidakPermission.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.permissionResponse = action.payload;
      })
      .addCase(provideDigidakPermission.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      });
  },
});

export const { resetCorrespondenceState } = digidakCorrespondenceSlice.actions;
export default digidakCorrespondenceSlice.reducer;
