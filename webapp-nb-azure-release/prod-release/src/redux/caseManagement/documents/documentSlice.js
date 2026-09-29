import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { documentService } from "../../../services/caseManagement/documents/documentsService";

export const fetchDraftDocuments = createAsyncThunk("getDraftDocuments", async (params, { rejectWithValue }) => {
  try {
    const data = await documentService.getDraftDocuments(params);
    return data?.entries || [];
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch draft documents");
  }
});
export const fetchSupportingDocuments = createAsyncThunk("getSupportingDocuments", async (params, { rejectWithValue }) => {
  try {
    const data = await documentService.getSupportingDocuments(params);
    return data?.entries || [];
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch supporting documents");
  }
});
export const fetchFinalDocuments = createAsyncThunk("getFinalDocuments", async (params, { rejectWithValue }) => {
  try {
    const data = await documentService.getFinalDocuments(params);
    return data?.entries || [];
  } catch (error) {
    return rejectWithValue(error?.response?.data || error?.message || "Failed to fetch final documents");
  }
});
// fetch docs
export const deleteDocument = createAsyncThunk("deleteDocument", async (payload, { rejectWithValue }) => {
  try {
    const data = await documentService.deleteDocument(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data || "Delete failed");
  }
});

const initialState = {
  loading: false,
  error: null,
  draftDocs: [],
  supportingDocs: [],
  finalDocs: [],
};

const documentsSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Handle draft docs actions
    builder
      .addCase(fetchDraftDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.draftDocs = [];
      })
      .addCase(fetchDraftDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.draftDocs = action.payload;
        state.error = null;
      })
      .addCase(fetchDraftDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // supporting docs
      .addCase(fetchSupportingDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.supportingDocs = [];
      })
      .addCase(fetchSupportingDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.supportingDocs = action.payload;
        state.error = null;
      })
      .addCase(fetchSupportingDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchFinalDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.finalDocs = [];
      })
      .addCase(fetchFinalDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.finalDocs = action.payload;
        state.error = null;
      })
      .addCase(fetchFinalDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // delete docs
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const deletedDocId = action.meta.arg?.document_id;
        state.draftDocs = state.draftDocs.filter((doc) => doc?.content?.properties?.id !== deletedDocId);
        state.supportingDocs = state.supportingDocs.filter((doc) => doc?.content?.properties?.id !== deletedDocId);
      });
  },
});

export const documentsActions = documentsSlice.actions;
export default documentsSlice.reducer;
