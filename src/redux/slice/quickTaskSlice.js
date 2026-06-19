import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  deleteChecklistTasksApi,
  deleteDelegationTasksApi,
  fetchChecklistData,
  fetchDelegationData,
  fetchUsersData,
  updateChecklistTaskApi,
  updateDelegationTaskApi
} from "../api/quickTaskApi";


export const fetchUsers = createAsyncThunk(
  'fetch/users',
  async () => {
    const users = await fetchUsersData();
    return users;
  }
);

export const uniqueChecklistTaskData = createAsyncThunk(
  'fetch/checklistTask',
  async ({ page = 0, pageSize = 50, nameFilter = '', dateFilter = 'all', append = false }) => {
    const result = await fetchChecklistData(page, pageSize, nameFilter, dateFilter);
    return { ...result, append };
  }
);

export const uniqueDelegationTaskData = createAsyncThunk(
  'fetch/delegationTask',
  async ({ page = 0, pageSize = 50, nameFilter = '', dateFilter = 'all', append = false }) => {
    const result = await fetchDelegationData(page, pageSize, nameFilter, dateFilter);
    return { ...result, append };
  }
);


export const deleteChecklistTask = createAsyncThunk(
  'delete/checklistTask',
  async (taskIds, { rejectWithValue }) => {
    try {
      return await deleteChecklistTasksApi(taskIds);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteDelegationTask = createAsyncThunk(
  'delete/delegationTask',
  async (taskIds, { rejectWithValue }) => {
    try {
      return await deleteDelegationTasksApi(taskIds);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ← ADD THIS UPDATE FUNCTION
export const updateChecklistTask = createAsyncThunk(
  'update/checklistTask',
  async ({ updatedTask, originalTask }, { rejectWithValue }) => {
    try {
      const result = await updateChecklistTaskApi(updatedTask, originalTask);
      return result;
    } catch (error) {
      console.error("Redux action error:", error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateDelegationTask = createAsyncThunk(
  'update/delegationTask',
  async ({ updatedTask, originalTask }, { rejectWithValue }) => {
    try {
      const result = await updateDelegationTaskApi(updatedTask, originalTask);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const quickTaskSlice = createSlice({
  name: 'quickTask',
  initialState: {
    quickTask: [],
    delegationTasks: [],
    users: [],
    error: null,
    loading: false,
    checklistPage: 0,
    checklistTotal: 0,
    checklistHasMore: true,
    delegationPage: 0,
    delegationTotal: 0,
    delegationHasMore: true,
  },
  reducers: {
    resetChecklistPagination: (state) => {
      state.quickTask = [];
      state.checklistPage = 0;
      state.checklistHasMore = true;
    },
    resetDelegationPagination: (state) => {
      state.delegationTasks = [];
      state.delegationPage = 0;
      state.delegationHasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uniqueChecklistTaskData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uniqueChecklistTaskData.fulfilled, (state, action) => {
        state.loading = false;
        const { data, total, append } = action.payload;

        if (append) {
          state.quickTask = [...state.quickTask, ...data];
          state.checklistPage += 1;
        } else {
          state.quickTask = data;
          state.checklistPage = 1;
        }

        state.checklistTotal = total;
        state.checklistHasMore = state.quickTask.length < total;
      })
      .addCase(uniqueChecklistTaskData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(uniqueDelegationTaskData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uniqueDelegationTaskData.fulfilled, (state, action) => {
        state.loading = false;
        const { data, total, append } = action.payload;

        if (append) {
          state.delegationTasks = [...state.delegationTasks, ...data];
          state.delegationPage += 1;
        } else {
          state.delegationTasks = data;
          state.delegationPage = 1;
        }

        state.delegationTotal = total;
        state.delegationHasMore = state.delegationTasks.length < total;
      })
      .addCase(uniqueDelegationTaskData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(deleteChecklistTask.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteChecklistTask.fulfilled, (state, action) => {
        state.loading = false;
        // action.payload is an array of deleted task objects
        const deletedIds = action.payload.map(t => t.id);
        state.quickTask = state.quickTask.filter(
          task => !deletedIds.includes(task.id)
        );
      })
      .addCase(deleteChecklistTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(deleteDelegationTask.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteDelegationTask.fulfilled, (state, action) => {
        state.loading = false;
        // action.payload is array of task objects; extract IDs to filter
        const deletedIds = new Set(
          action.payload.map(t => t.task_id || t.id)
        );
        state.delegationTasks = state.delegationTasks.filter(
          task => !deletedIds.has(task.task_id || task.id)
        );
      })
      .addCase(deleteDelegationTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ← ADD THESE UPDATE CASES
      .addCase(updateChecklistTask.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateChecklistTask.fulfilled, (state, action) => {
        state.loading = false;
        const updatedTasks = action.payload; // Array of updated tasks

        // Update all matching tasks in the state
        if (Array.isArray(updatedTasks)) {
          updatedTasks.forEach(updatedTask => {
            const index = state.quickTask.findIndex(task => task.id === updatedTask.id);
            if (index !== -1) {
              state.quickTask[index] = updatedTask;
            }
          });
        }
      })
      .addCase(updateChecklistTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateDelegationTask.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateDelegationTask.fulfilled, (state, action) => {
        state.loading = false;
        const updatedTasks = action.payload;
        if (Array.isArray(updatedTasks)) {
          updatedTasks.forEach(updatedTask => {
            const index = state.delegationTasks.findIndex(task => task.id === updatedTask.task_id);
            if (index !== -1) {
              state.delegationTasks[index] = { ...updatedTask, id: updatedTask.task_id };
            }
          });
        }
      })
      .addCase(updateDelegationTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetChecklistPagination, resetDelegationPagination } = quickTaskSlice.actions;
export default quickTaskSlice.reducer;

