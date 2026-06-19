// loginSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchUniqueDepartmentDataApi, fetchUniqueDoerNameDataApi, fetchUniqueGivenByDataApi, pushAssignTaskApi } from '../api/assignTaskApi';

export const uniqueDepartmentData = createAsyncThunk('fetch/department', async () => {
  const department = await fetchUniqueDepartmentDataApi();
  return department;
});
export const uniqueGivenByData = createAsyncThunk('fetch/given_by', async () => {
  const givenBy = await fetchUniqueGivenByDataApi();

  return givenBy;
}
);
export const uniqueDoerNameData = createAsyncThunk('fetch/doerName', async (department) => {
  const doerName = await fetchUniqueDoerNameDataApi(department);

  return doerName;
}
);

export const assignTaskInTable = createAsyncThunk('post/delegation', async ({ tasks, table }, { rejectWithValue }) => {
  try {
    const assignTask = await pushAssignTaskApi(tasks, table);
    return assignTask;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});



const assignTaskSlice = createSlice({
  name: 'assignTask',
  initialState: {
    department: [],
    givenBy: [],
    doerName: [],
    assignTask: [],
    error: null,
    loading: false,

  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(uniqueDepartmentData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uniqueDepartmentData.fulfilled, (state, action) => {
        state.loading = false;
        state.department = action.payload;
      })
      .addCase(uniqueDepartmentData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(uniqueGivenByData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uniqueGivenByData.fulfilled, (state, action) => {
        state.loading = false;
        state.givenBy = action.payload;
      })
      .addCase(uniqueGivenByData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(uniqueDoerNameData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uniqueDoerNameData.fulfilled, (state, action) => {
        state.loading = false;
        state.doerName = action.payload;
      })
      .addCase(uniqueDoerNameData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(assignTaskInTable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(assignTaskInTable.fulfilled, (state, action) => {
        state.loading = false;
        state.assignTask.push(action.payload);
      })
      .addCase(assignTaskInTable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default assignTaskSlice.reducer;
