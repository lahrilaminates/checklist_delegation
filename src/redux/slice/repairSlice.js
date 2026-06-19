import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    fetchRepairDataSortByDate,
    fetchRepairDataForHistory,
    updateRepairData,
    postRepairTaskApi
} from "../api/repairApi";

// --- EXISTING THUNKS ---

export const repairData = createAsyncThunk("repairData", async (page = 1, { rejectWithValue }) => {
    try {
        const response = await fetchRepairDataSortByDate(page);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

export const repairHistoryData = createAsyncThunk("repairHistoryData", async (page = 1, { rejectWithValue }) => {
    try {
        const response = await fetchRepairDataForHistory(page);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

export const updateRepair = createAsyncThunk("updateRepair", async (data, { rejectWithValue }) => {
    try {
        const response = await updateRepairData(data);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

// --- NEW THUNK FOR CREATING REPAIR REQUEST ---
export const createRepair = createAsyncThunk("repair/create", async (data, { rejectWithValue }) => {
    try {
        const response = await postRepairTaskApi(data);
        return response;
    } catch (error) {
        return rejectWithValue(error.message);
    }
});

const repairSlice = createSlice({
    name: "repair",
    initialState: {
        repair: [],
        history: [],
        loading: false,
        error: null,
        totalCount: 0,
        currentPage: 1,
        hasMore: true
    },
    reducers: {},
    extraReducers: (builder) => {
        // --- Fetch Data ---
        builder.addCase(repairData.pending, (state) => { state.loading = true; });
        builder.addCase(repairData.fulfilled, (state, action) => {
            state.loading = false;
            if (action.meta.arg === 1) state.repair = action.payload.data;
            else state.repair = [...state.repair, ...action.payload.data];
            state.totalCount = action.payload.totalCount;
            state.currentPage = action.meta.arg;
            state.hasMore = state.repair.length < state.totalCount;
        });
        builder.addCase(repairData.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });

        // --- Fetch History ---
        builder.addCase(repairHistoryData.fulfilled, (state, action) => {
            if (action.meta.arg === 1) state.history = action.payload;
            else state.history = [...state.history, ...action.payload];
        });

        // --- Update/Submit ---
        builder.addCase(updateRepair.pending, (state) => { state.loading = true; });
        builder.addCase(updateRepair.fulfilled, (state, action) => {
            state.loading = false;
            // Optimistic update: Remove submitted items from 'repair' list
            if (Array.isArray(action.payload)) {
                const updatedIds = action.payload.map(item => item.id);
                state.repair = state.repair.filter(task => !updatedIds.includes(task.id));
            }
        });
        builder.addCase(updateRepair.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });

        // --- HANDLE CREATE REPAIR (New Request) ---
        builder.addCase(createRepair.pending, (state) => { state.loading = true; });
        builder.addCase(createRepair.fulfilled, (state, action) => {
            state.loading = false;
            // Supabase insert returns an array of the inserted rows.
            // We add the new task(s) to the top of the 'repair' list.
            if (Array.isArray(action.payload)) {
                state.repair = [...action.payload, ...state.repair];
            } else if (action.payload) {
                state.repair = [action.payload, ...state.repair];
            }
        });
        builder.addCase(createRepair.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload;
        });
    }
});

export default repairSlice.reducer;