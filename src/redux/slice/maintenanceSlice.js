
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchMaintenanceDataSortByDate, fetchMaintenanceDataForHistory, updateMaintenanceData, deleteMaintenanceTasksApi, updateMaintenanceTaskApi } from "../api/maintenanceApi";

export const deleteMaintenanceTask = createAsyncThunk(
    "deleteMaintenanceTask",
    async (tasks, { rejectWithValue }) => {
        try {
            const response = await deleteMaintenanceTasksApi(tasks);
            return response;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const maintenanceData = createAsyncThunk("maintenanceData", async (arg = 1, { rejectWithValue }) => {
    try {
        const page = typeof arg === 'object' ? (arg.page || 1) : arg;
        const frequency = typeof arg === 'object' ? (arg.frequency || '') : '';
        const limit = typeof arg === 'object' ? (arg.limit || 50) : 50;
        const searchTerm = typeof arg === 'object' ? (arg.searchTerm || '') : '';
        const dateFilter = typeof arg === 'object' ? (arg.dateFilter || 'all') : 'all';

        const response = await fetchMaintenanceDataSortByDate(page, limit, searchTerm, frequency, dateFilter);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

export const maintenanceHistoryData = createAsyncThunk("maintenanceHistoryData", async (page = 1, { rejectWithValue }) => {
    try {
        const response = await fetchMaintenanceDataForHistory(page);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

export const updateMaintenance = createAsyncThunk("updateMaintenance", async (submissionData, { rejectWithValue }) => {
    try {
        const response = await updateMaintenanceData(submissionData);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

export const updateMaintenanceTask = createAsyncThunk("updateMaintenanceTask", async ({ updatedTask, originalTask }, { rejectWithValue }) => {
    try {
        const response = await updateMaintenanceTaskApi(updatedTask, originalTask);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

const maintenanceSlice = createSlice({
    name: "maintenance",
    initialState: {
        maintenance: [],
        history: [],
        loading: false,
        error: null,
        hasMore: true,
        currentPage: 1,
        totalCount: 0
    },
    reducers: {},
    extraReducers: (builder) => {
        // Pending Tasks
        builder.addCase(maintenanceData.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(maintenanceData.fulfilled, (state, action) => {
            state.loading = false;
            const { data, totalCount } = action.payload;
            const page = typeof action.meta.arg === 'object' ? (action.meta.arg.page || 1) : action.meta.arg;

            if (page === 1) {
                state.maintenance = data;
            } else {
                state.maintenance = [...state.maintenance, ...data];
            }
            state.totalCount = totalCount;
            state.hasMore = state.maintenance.length < totalCount;
            state.currentPage = page;
        });
        builder.addCase(maintenanceData.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });

        // History
        builder.addCase(maintenanceHistoryData.fulfilled, (state, action) => {
            if (action.meta.arg === 1) {
                state.history = action.payload;
            } else {
                state.history = [...state.history, ...action.payload];
            }
        });

        // Update
        builder.addCase(updateMaintenance.fulfilled, (state, action) => {
            // We can filter out updated items from 'maintenance' state locally to update UI immediately
            // or rely on reload. 
            // Let's rely on reload or refetch as per existing patterns.
        });

        // Delete
        builder.addCase(deleteMaintenanceTask.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(deleteMaintenanceTask.fulfilled, (state, action) => {
            state.loading = false;
            const deletedIds = action.payload;
            state.maintenance = state.maintenance.filter(task => !deletedIds.includes(task.id));
        });
        builder.addCase(deleteMaintenanceTask.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });
    }
});

export default maintenanceSlice.reducer;
