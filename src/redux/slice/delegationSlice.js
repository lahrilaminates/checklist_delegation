import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchDelegation_DoneDataSortByDate, fetchDelegationDataSortByDate } from "../api/delegationApi";

// export const delegationDoneData=createAsyncThunk( 'post/delegation',async (selectedData) => {
//     const doneTask = await postDelegationDonedata(selectedData);

//     return doneTask;
//   }
// );

export const delegationData = createAsyncThunk('fetch/delegation', async () => {
  const Task = await fetchDelegationDataSortByDate();

  return Task;
}
);

export const delegation_DoneData = createAsyncThunk('fetch/delegation_done', async () => {
  const Task = await fetchDelegation_DoneDataSortByDate();

  return Task;
}
);

const delegationSlice = createSlice({
  name: 'delegation',


  initialState: {
    delegation: [],
    delegation_done: [],
    error: null,
    loading: false,

  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      //  .addCase(delegationDoneData.pending, (state) => {
      //     state.loading = true;
      //     state.error = null;
      //   })
      //   .addCase(delegationDoneData.fulfilled, (state, action) => {
      //     state.loading = false;
      //     state.delegation.push(action.payload);
      //   })
      //   .addCase(delegationDoneData.rejected, (state, action) => {
      //     state.loading = false;
      //     state.error = action.payload;
      //   })
      .addCase(delegationData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(delegationData.fulfilled, (state, action) => {
        state.loading = false;
        state.delegation = action.payload;
      })
      .addCase(delegationData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(delegation_DoneData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(delegation_DoneData.fulfilled, (state, action) => {
        state.loading = false;
        state.delegation_done = action.payload;
      })
      .addCase(delegation_DoneData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default delegationSlice.reducer;
