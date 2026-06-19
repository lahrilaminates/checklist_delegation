import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchChechListDataForHistory, fetchChechListDataSortByDate, postChecklistAdminDoneAPI, updateChecklistData } from "../api/checkListApi";


export const checklistHistoryData = createAsyncThunk(
  'fetch/history',
  async (page = 1) => {
    const histroydata = await fetchChechListDataForHistory(page);
    return { data: histroydata, page };
  }
);


export const checklistData = createAsyncThunk(
  'fetch/checklist',
  async (page = 1) => {
    const { data, totalCount } = await fetchChechListDataSortByDate(page);
    return { data, page, totalCount };
  }
);



export const checklistAdminDone=createAsyncThunk( 'insert/admin_done',async () => {
  const admin_done = await postChecklistAdminDoneAPI();
 
  return admin_done;
}
);

// checkListSlice.js
export const updateChecklist = createAsyncThunk(
  'update/checklist',
  async (submissionData) => {
    const updated = await updateChecklistData(submissionData);
    return updated;
  }
);



const checkListSlice = createSlice({
  name: 'checklist',
 
  initialState: {
    checklist: [],
    history:[],
    error: null,
    loading: false,
   
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
   
      .addCase(checklistData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checklistData.fulfilled, (state, action) => {
        state.loading = false;
        
        // If it's the first page, replace the data
        if (action.payload.page === 1) {
          state.checklist = action.payload.data;
        } else {
          // Otherwise, append to existing data
          state.checklist = [...state.checklist, ...action.payload.data];
        }
        
        state.currentPage = action.payload.page;
        
        // Calculate if there are more pages
        const itemsPerPage = 50;
        state.hasMore = state.checklist.length < action.payload.totalCount;
      })
      .addCase(checklistData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
         .addCase(updateChecklist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateChecklist.fulfilled, (state, action) => {
        state.loading = false;
        state.checklist=action.payload;
      })
      .addCase(updateChecklist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
         .addCase(checklistHistoryData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
     .addCase(checklistHistoryData.fulfilled, (state, action) => {
  state.loading = false;
  
  // If it's the first page, replace the data
  if (action.payload.page === 1) {
    state.history = action.payload.data;
  } else {
    // Otherwise, append to existing data
    state.history = [...state.history, ...action.payload.data];
  }
})
      .addCase(checklistHistoryData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(checklistAdminDone.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checklistAdminDone.fulfilled, (state, action) => {
        state.loading = false;
        state.history.push(action.payload);
      })
      .addCase(checklistAdminDone.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
     
  },
});

export default checkListSlice.reducer;
