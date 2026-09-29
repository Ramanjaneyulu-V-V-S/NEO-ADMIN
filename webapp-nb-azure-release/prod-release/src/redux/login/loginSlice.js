import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { loginService } from "../../services/login/loginService";

const isAccountBlocked = (error) => {
  const { data, status } = error?.response || {};

  if (!data && !status) return false;

  // Case 1: HTTP status-based
  if (status === 423) return true;

  // Case 2: Rate limit string response
  if (typeof data === "string") {
    return data.includes("Rate limit exceeded");
  }
  // Case 3: account Locked
  if (typeof data === "object") {
    return data?.error_description === "ACCOUNT_LOCKED" || data?.error === "ACCOUNT_LOCKED";
  }
  return false;
};

export const loginUser = createAsyncThunk("login", async (params, { rejectWithValue }) => {
  try {
    const response = await loginService.loginAndGetProfile(params);
    return response?.entries?.[0]?.content;
  } catch (error) {
    const message = error?.response?.data?.error_description || error?.response?.data?.message || error?.message || "Authentication failed";
    return rejectWithValue({ message, isBlocked: isAccountBlocked(error) });
  }
});

export const getUserProfile = createAsyncThunk("getUserProfile", async (params, { rejectWithValue }) => {
  try {
    const response = await loginService.getUserProfile(params);
    return response?.entries?.[0]?.content;
  } catch (error) {
    return rejectWithValue(error?.response?.data?.message || error?.message || "Failed to fetch user profile");
  }
});

export const updateUserProfile = createAsyncThunk("viewCase/updateUserProfile", async (payload, { rejectWithValue }) => {
  try {
    const response = await loginService.updateUserProfile(payload);
    return response;
  } catch (error) {
    return rejectWithValue(error?.response?.data || "Failed");
  }
});

export const fetchButtonCondition = createAsyncThunk("fetchButtonCondition", async (payload, { rejectWithValue }) => {
  try {
    const response = await loginService.fetchButtonCondition(payload);
    return response?.data?.variables?.in_user_grade;
  } catch (error) {
    return rejectWithValue(error?.response?.data || "Failed");
  }
});

const initialState = {
  loading: false,
  error: null,
  isAccountBlocked: false,
  userProfile: null,
  dmdChairmanCondition: "",
  isCGMUser: null,
  isCGMSecretary: null,
};

const loginSlice = createSlice({
  name: "login",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.loading = false;
      state.isAccountBlocked = false;
    },
    setCGMUser: (state, action) => {
      state.isCGMUser = action.payload; // true | false
    },
    setCGMSecretary: (state, action) => {
      state.isCGMSecretary = action.payload; // true | false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userProfile = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.payload;
        state.isAccountBlocked = action.payload?.isBlocked || false;
      })

      .addCase(getUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.userProfile = action.payload;
        state.error = null;
      })
      .addCase(getUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchButtonCondition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchButtonCondition.fulfilled, (state, action) => {
        state.loading = false;
        state.dmdChairmanCondition = action.payload;
        state.error = null;
      })
      .addCase(fetchButtonCondition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setCGMUser, setCGMSecretary } = loginSlice.actions;
export default loginSlice.reducer;
