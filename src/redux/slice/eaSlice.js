import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchEATasks, fetchEATasksHistory } from '../api/eaApi';

// Async thunks
export const loadEATasks = createAsyncThunk(
    'ea/loadEATasks',
    async () => {
        const data = await fetchEATasks();
        return data;
    }
);

export const loadEATasksHistory = createAsyncThunk(
    'ea/loadEATasksHistory',
    async () => {
        const data = await fetchEATasksHistory();
        return data;
    }
);

const eaSlice = createSlice({
    name: 'ea',
    initialState: {
        tasks: [],
        history: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearEAError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Load EA Tasks
            .addCase(loadEATasks.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loadEATasks.fulfilled, (state, action) => {
                state.loading = false;
                state.tasks = action.payload;
            })
            .addCase(loadEATasks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            // Load EA Tasks History
            .addCase(loadEATasksHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loadEATasksHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.history = action.payload;
            })
            .addCase(loadEATasksHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            });
    },
});

export const { clearEAError } = eaSlice.actions;
export default eaSlice.reducer;
