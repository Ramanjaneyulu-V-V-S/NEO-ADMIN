import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakDropdownService } from "../../../services/digidak/dropdowns/digidakDropdownService";
import { mapDoUserToDropdownOption } from "../../../utils/dropdownUtils";
import { loginService } from "../../../services/login/loginService";

const sortByText = (options) => [...options].sort((a, b) => (a.text ?? "").localeCompare(b.text ?? ""));

export const fetchDigidakDropdown = createAsyncThunk("digidak/fetchDropdown", async (type, { getState, rejectWithValue }) => {
  try {
    const { digidakDropdown } = getState();

    // Prevent duplicate fetch if already available
    if (digidakDropdown.dropdownData[type]?.length) {
      return { type, options: digidakDropdown.dropdownData[type] };
    }

    const response = await digidakDropdownService.getDropdownData(type);
    const options = sortByText(
      response?.entries?.map((entry) => {
        const props = entry?.content?.properties;
        return {
          text: props?.results,
          value: props?.results,
        };
      }) || [],
    );

    return { type, options };
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

export const fetchDigidakSourceVertical = createAsyncThunk("digidakDropdown/fetchSourceVertical", async ({ loginUser, isDDM }, { rejectWithValue }) => {
  const payload = {
    "run-stateless": "true",
    data: {
      variables: {
        flag: isDDM ? "verticals" : "source_vertical",
        in_login_user: loginUser,
      },
    },
  };

  try {
    const res = await digidakDropdownService.getSourceVerticalDropdown(payload);
    return mapOptions(res);
  } catch (error) {
    // Retry ONLY if 403 (production rate-limit / ACL timing issue)
    if (error?.response?.status === 403) {
      await wait(200);
      try {
        const retryRes = await digidakDropdownService.getSourceVerticalDropdown(payload);
        return mapOptions(retryRes);
      } catch (retryError) {
        return rejectWithValue(retryError.response?.data || retryError.message);
      }
    }

    return rejectWithValue(error.response?.data || error.message);
  }
});

export const fetchHRMDUsers = createAsyncThunk("digidakDropdown/fetchHRMDUsers", async ({ office_type, location }) => {
  try {
    const baseParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 3200,
    };

    const params = office_type === "HO" ? baseParams : { ...baseParams, input_location: location };
    const res = await loginService.getUserProfile(params);
    const users = res?.entries || [];

    return sortByText(
      users
        ?.map((item) => {
          const props = item?.content?.properties ?? {};

          const { object_name, uin } = props;

          //  Skip invalid records
          if (!object_name || !uin) return null;

          return {
            text: `${object_name} - ${uin}`,
            value: object_name,
          };
        })
        .filter(Boolean),
    );
  } catch (error) {
    console.error(error);
  }
});

// HRMD Users dropdown -> DO Letter
export const fetchHRMDDoUsers = createAsyncThunk("digidakDropdown/fetchHRMDDoUsers", async ({ office_type = "" }, { getState, rejectWithValue }) => {
  const state = getState().digidakDropdown;

  //  Prevent duplicate calls
  if (state.hrmdDoUsers?.length > 0) {
    return state.hrmdDoUsers;
  }

  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          in_office_type: office_type,
        },
      },
    };

    const res = await digidakDropdownService.getHRMDDOUsersDropdown(payload);
    const results = res?.data?.variables?.results || [];
    const dropdownOptions = sortByText(results.map(mapDoUserToDropdownOption)); // extract name from raw string -> later to be done by backend

    return dropdownOptions;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

// Fetch DO Letter specific dropdown data to display in selected recipients component
export const fetchDOLetterSelectedRecipients = createAsyncThunk("digidakDropdown/fetchDOLetterSelectedRecipients", async ({ office_type = "" }, { getState, rejectWithValue }) => {
  try {
    const state = getState().digidakDropdown;

    // Prevent duplicate call per office type
    if (state.hrmdDoUsersByOfficeType?.[office_type]?.length > 0) {
      return {
        office_type,
        options: state.hrmdDoUsersByOfficeType[office_type],
        fromCache: true,
      };
    }

    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          in_office_type: office_type,
        },
      },
    };

    const res = await digidakDropdownService.getHRMDDOUsersDropdown(payload);
    const results = res?.data?.variables?.results1 || [];

    const dropdownOptions = sortByText(
      results.map((user) => ({
        text: user,
        value: user,
      })),
    );

    return {
      office_type,
      options: dropdownOptions,
      fromCache: false,
    };
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

// DDM Users dropdown
export const fetchDDMUsers = createAsyncThunk("digidakDropdown/fetchDDMUsers", async (loginUser, { getState, rejectWithValue }) => {
  const state = getState().digidakDropdown;

  // Prevent duplicate calls
  if (state.ddmUsers?.length > 0) {
    return state.ddmUsers;
  }

  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "ddm_users",
          in_login_user: loginUser,
        },
      },
    };

    const res = await digidakDropdownService.getDDMUsersDropdown(payload);

    const users = res?.data?.variables?.out_users_names || [];

    // Map to dropdown format
    return sortByText(
      users.map((u) => ({
        text: u,
        value: u,
      })),
    );
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

// Fetch office type based on department
export const fetchOfficeTypeByDept = createAsyncThunk("digidakDropdown/fetchOfficeTypeByDept", async ({ dept_name = "", in_login_user }, { rejectWithValue }) => {
  try {
    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          flag: "office_type",
          dept_name,
          in_login_user,
        },
      },
    };

    const res = await digidakDropdownService.getHRMDUsersDropdown(payload);

    // Map to dropdown format
    const options = sortByText(
      res?.data?.variables?.vertical_head?.map((item) => ({
        text: item,
        value: item,
      })) || [],
    );

    return options;
  } catch (error) {
    return rejectWithValue(error.response?.data || error.message);
  }
});

const mapOptions = (res) => {
  const display = res?.data?.variables?.group_display_name || [];
  const internal = res?.data?.variables?.group_names || [];

  return sortByText(
    display.map((label, idx) => ({
      text: label,
      value: internal[idx] || label,
    })),
  );
};

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const digidakDropdownSlice = createSlice({
  name: "digidakDropdown",
  initialState: {
    loading: false,
    _pendingCount: 0,
    error: null,
    dropdownData: {},
    sourceVerticalData: [],
    hrmdUsers: [],
    hrmdDoUsers: [],
    ddmUsers: [],

    // DO Letter recipients by office type
    DOLetterRecipientsByOfficeType: {},
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDigidakDropdown.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchDigidakDropdown.fulfilled, (state, action) => {
        const { type, options } = action.payload;
        state.dropdownData[type] = options;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchDigidakDropdown.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      })

      // source vertical state
      .addCase(fetchDigidakSourceVertical.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchDigidakSourceVertical.fulfilled, (state, action) => {
        state.sourceVerticalData = action.payload;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchDigidakSourceVertical.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      });

    // Office type by department
    builder
      .addCase(fetchOfficeTypeByDept.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchOfficeTypeByDept.fulfilled, (state, action) => {
        state.dropdownData.office_type = action.payload;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchOfficeTypeByDept.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      })

      // HRMD users state
      .addCase(fetchHRMDUsers.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchHRMDUsers.fulfilled, (state, action) => {
        state.hrmdUsers = action.payload;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchHRMDUsers.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      })

      // HRMD DO users state
      .addCase(fetchHRMDDoUsers.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchHRMDDoUsers.fulfilled, (state, action) => {
        state.hrmdDoUsers = action.payload;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchHRMDDoUsers.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      })

      // DDM users state
      .addCase(fetchDDMUsers.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchDDMUsers.fulfilled, (state, action) => {
        state.ddmUsers = action.payload;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchDDMUsers.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      })

      // DO Letter recipients by office type
      .addCase(fetchDOLetterSelectedRecipients.pending, (state) => {
        state._pendingCount += 1;
        state.loading = true;
      })
      .addCase(fetchDOLetterSelectedRecipients.fulfilled, (state, action) => {
        const { office_type, options } = action.payload;
        state.DOLetterRecipientsByOfficeType[office_type] = options;
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
      })
      .addCase(fetchDOLetterSelectedRecipients.rejected, (state, action) => {
        state._pendingCount = Math.max(0, state._pendingCount - 1);
        state.loading = state._pendingCount > 0;
        state.error = action.payload;
      });
  },
});

export default digidakDropdownSlice.reducer;
