import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { digidakOutboxService } from "../../../services/digidak/outbox/digidakOutboxService";

// Default page size for server-side pagination
export const DEFAULT_PAGE_SIZE = 50;

// V2 — new Integration API
export const fetchDigidakOutboxV2 = createAsyncThunk(
  "digidakOutbox/fetchOutboxV2",
  async ({ input_vertical, input_source_vertical, input_login_dept_ro_te, is_ddm, from_date, to_date, page = 1, ...filterParams }, { rejectWithValue }) => {
    try {
      const statuses = ",Unread,Opened,Assigned Head,Assigned,Closed,Reassigned,Reassign Head,Responded,Follow-Up,Inprocess,Pushback";

      const pad = (n) => String(n).padStart(2, "0");
      const today = new Date();
      const todayStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

      const formatToDDMMYYYY = (dateVal) => {
        if (!dateVal) return "";
        const d = new Date(dateVal);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      };

      const effectiveFromDate = from_date ? formatToDDMMYYYY(from_date) : "01/01/2024";
      const effectiveToDate = to_date ? formatToDDMMYYYY(to_date) : todayStr;

      const sourceVerticalStr = Array.isArray(input_source_vertical) ? input_source_vertical.join(",") : input_source_vertical || "";

      const queryParams = {
        queryName: "digidak.outbox",
        decision: "Outward",
        status: statuses,
        cgm_group: input_login_dept_ro_te || "",
        vertical: is_ddm ? "" : input_vertical || "",
        source_vertical: is_ddm ? "" : sourceVerticalStr,
        is_ddm: !!is_ddm,
        from_date: effectiveFromDate,
        to_date: effectiveToDate,
        page,
        itemsPerPage: DEFAULT_PAGE_SIZE,
        ...filterParams,
      };

      const data = await digidakOutboxService.getDigidakOutboxV2(queryParams);
      return {
        entries: data?.entries || [],
        total: data?.total || 0,
        page: data?.page || 1,
        itemsPerPage: data?.itemsPerPage || DEFAULT_PAGE_SIZE,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);

const initialState = {
  loading: false,
  outboxList: [],
  error: null,
  pagination: {
    total: 0,
    page: 1,
    itemsPerPage: DEFAULT_PAGE_SIZE,
    totalPages: 0,
  },
};

const digidakOutboxSlice = createSlice({
  name: "digidakOutbox",
  initialState,
  reducers: {
    resetDigidakOutboxPagination: (state) => {
      state.pagination = initialState.pagination;
    },
  },
  extraReducers: (builder) => {
    builder
      // 🧩 fetchDigidakOutboxV2
      .addCase(fetchDigidakOutboxV2.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDigidakOutboxV2.fulfilled, (state, action) => {
        state.loading = false;
        state.outboxList = action.payload.entries;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          itemsPerPage: action.payload.itemsPerPage,
          totalPages: Math.ceil(action.payload.total / action.payload.itemsPerPage),
        };
      })
      .addCase(fetchDigidakOutboxV2.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetDigidakOutboxPagination } = digidakOutboxSlice.actions;
export default digidakOutboxSlice.reducer;
