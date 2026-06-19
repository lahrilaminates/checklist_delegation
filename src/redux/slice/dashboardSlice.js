import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import supabase from "../../SupabaseClient";
import {
  countCompleteTaskApi,
  countOverDueORExtendedTaskApi,
  countPendingOrDelayTaskApi,
  countTotalTaskApi,
  fetchDashboardDataApi
} from "../api/dashboardApi";

// Dashboard data thunk
export const dashboardData = createAsyncThunk(
  'dashboard/fetchData',
  async ({ dashboardType, staffFilter }) => {
    const data = await fetchDashboardDataApi(dashboardType, staffFilter);
    return data;
  }
);

export const totalTaskInTable = createAsyncThunk(
  "dashboard/totalTaskInTable",
  async ({ dashboardType, staffFilter, departmentFilter }) => {
    try {
      const response = await countTotalTaskApi(dashboardType, staffFilter, departmentFilter)
      return response
    } catch (error) {
      console.error("Error fetching total tasks:", error)
      throw error
    }
  }
)

// Update completeTaskInTable
export const completeTaskInTable = createAsyncThunk(
  "dashboard/completeTaskInTable",
  async ({ dashboardType, staffFilter, departmentFilter }) => {
    try {
      const response = await countCompleteTaskApi(dashboardType, staffFilter, departmentFilter)
      return response
    } catch (error) {
      console.error("Error fetching complete tasks:", error)
      throw error
    }
  }
)

export const uniqueGivenByData = createAsyncThunk(
  'fetch/uniqueGivenBy',
  async () => {
    try {
      const { data, error } = await supabase
        .from('checklist')
        .select('given_by')
        .not('given_by', 'is', null)
        .order('given_by');

      if (error) throw error;

      // Extract unique values and remove duplicates
      const uniqueGivenBy = [...new Set(data.map(item => item.given_by))].filter(Boolean);
      return uniqueGivenBy;
    } catch (error) {
      console.error("Error fetching unique given_by:", error);
      throw error;
    }
  }
);

// Update pendingTaskInTable
export const pendingTaskInTable = createAsyncThunk(
  "dashboard/pendingTaskInTable",
  async ({ dashboardType, staffFilter, departmentFilter }) => {
    try {
      const response = await countPendingOrDelayTaskApi(dashboardType, staffFilter, departmentFilter)
      return response
    } catch (error) {
      console.error("Error fetching pending tasks:", error)
      throw error
    }
  }
)

// Update overdueTaskInTable
export const overdueTaskInTable = createAsyncThunk(
  "dashboard/overdueTaskInTable",
  async ({ dashboardType, staffFilter, departmentFilter }) => {
    try {
      const response = await countOverDueORExtendedTaskApi(dashboardType, staffFilter, departmentFilter)
      return response
    } catch (error) {
      console.error("Error fetching overdue tasks:", error)
      throw error
    }
  }
)
const dashboardSlice = createSlice({
  name: 'dashBoard',
  initialState: {
    dashboard: [],
    totalTask: 0,
    completeTask: 0,
    pendingTask: 0,
    overdueTask: 0,
    error: null,
    loading: false,
  },
  reducers: {
    // Reset dashboard state
    resetDashboardState: (state) => {
      state.dashboard = [];
      state.totalTask = 0;
      state.completeTask = 0;
      state.pendingTask = 0;
      state.overdueTask = 0;
      state.error = null;
      state.loading = false;
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Dashboard Data cases
      .addCase(dashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(dashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(dashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch dashboard data';
      })

      // Total Task cases
      .addCase(totalTaskInTable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(totalTaskInTable.fulfilled, (state, action) => {
        state.loading = false;
        state.totalTask = action.payload || 0;
      })
      .addCase(totalTaskInTable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch total tasks';
      })

      // Complete Task cases
      .addCase(completeTaskInTable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(completeTaskInTable.fulfilled, (state, action) => {
        state.loading = false;
        state.completeTask = action.payload || 0;
      })
      .addCase(completeTaskInTable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch complete tasks';
      })

      // Pending Task cases
      .addCase(pendingTaskInTable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(pendingTaskInTable.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingTask = action.payload || 0;
      })
      .addCase(pendingTaskInTable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch pending tasks';
      })

      // Overdue Task cases
      .addCase(overdueTaskInTable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(overdueTaskInTable.fulfilled, (state, action) => {
        state.loading = false;
        state.overdueTask = action.payload || 0;
      })
      .addCase(overdueTaskInTable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch overdue tasks';
      });
  },
});

export const { resetDashboardState, clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;