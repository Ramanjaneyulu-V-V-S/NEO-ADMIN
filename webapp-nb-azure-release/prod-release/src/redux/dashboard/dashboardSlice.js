import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { dashboardService } from "../../services/dashboard/dashboardService";

export const fetchDepartments = createAsyncThunk("fetchDepartments", async (params, { rejectWithValue }) => {
  try {
    const data = await dashboardService.getDepartments(params);

    const transformedData = (data?.entries || []).map((item) => ({
      text: item?.content?.properties?.object_name,
      value: item?.content?.properties?.title,
    }));

    return transformedData;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to fetch cases";
    return rejectWithValue(message);
  }
});
export const fetchDashboardVerticals = createAsyncThunk("dashboard/fetchDashboardVerticals", async (params, { rejectWithValue }) => {
  try {
    const response = await dashboardService.getDashboardVerticals(params);

    const verticalDeptData =
      response?.data?.variables?.out_object_name?.map((item, index) => ({
        text: item,
        value: response?.data?.variables?.out_title[index],
      })) || [];

    return verticalDeptData;
  } catch (error) {
    const message = error.response?.data?.message || "Failed to fetch dashboard verticals";
    return rejectWithValue(message);
  }
});

const initialState = {
  loading: false,
  error: null,
  pendingCases: [],
  departmentNames: [],
  dashboardVerticals: [],
  roteDepartments: [],
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    clearDashboardError: (state) => {
      state.error = null;
    },
    clearDashboardData: (state) => {
      state.verticalDeptData = [];
      state.pendingCases = [];
      state.allCasesCount = [];
      state.departmentNames = [];
    },
  },
  extraReducers: (builder) => {
    builder

      // fetch HO Departments
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.departmentNames = action.payload;
        state.error = null;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchDashboardVerticals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardVerticals.fulfilled, (state, action) => {
        const { office_type } = action.meta.arg;

        state.loading = false;

        if (office_type === "HO") {
          if (action.payload.length > 1) {
            const allVerticals = action.payload.map((i) => i.value);
            const assignedVertical = {
              text: "Assigned Verticals",
              value: allVerticals,
            };

            state.dashboardVerticals = [assignedVertical, ...action.payload];
            state.selectedVertical = assignedVertical;
          } else {
            state.dashboardVerticals = action.payload;
            state.selectedVertical = action.payload[0] ?? null;
          }
        } else {
          if (action.payload.length > 1) {
            const allDepartments = action.payload.map((i) => i.value);
            const assignedDept = {
              text: "Assigned Departments",
              value: allDepartments,
            };

            state.roteDepartments = [assignedDept, ...action.payload];
            state.selectedROTEDepartment = assignedDept;
          } else {
            state.roteDepartments = action.payload;
            state.selectedROTEDepartment = action.payload[0] ?? null;
          }
        }
      })
      .addCase(fetchDashboardVerticals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearDashboardError, clearDashboardData } = dashboardSlice.actions;
export default dashboardSlice.reducer;
