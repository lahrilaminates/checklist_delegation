import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchNotificationsApi, createNotificationApi, deleteNotificationApi, markAsReadApi } from "../api/notificationApi";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async ({ role, userId }, { rejectWithValue }) => {
    try {
      const data = await fetchNotificationsApi(role, userId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async ({ notificationId, userId }, { rejectWithValue }) => {
    try {
      await markAsReadApi(notificationId, userId);
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createNotification = createAsyncThunk(
  "notifications/createNotification",
  async (notificationData, { rejectWithValue }) => {
    try {
      const data = await createNotificationApi(notificationData);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const removeNotification = createAsyncThunk(
  "notifications/deleteNotification",
  async (id, { rejectWithValue }) => {
    try {
      await deleteNotificationApi(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
      })
      .addCase(removeNotification.fulfilled, (state, action) => {
        state.list = state.list.filter((n) => n.id !== action.payload);
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const index = state.list.findIndex(n => n.id === action.payload);
        if (index !== -1) {
          state.list[index].isRead = true;
        }
      });
  },
});

export default notificationSlice.reducer;
