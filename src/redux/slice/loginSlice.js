// loginSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { LoginCredentialsApi } from '../api/loginApi';

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (formData, thunkAPI) => {
    const response = await LoginCredentialsApi(formData);
    if (response.error) {
      return thunkAPI.rejectWithValue(response.error);
    }
    return response.data;
  }
);

const loginSlice = createSlice({
  name: 'userData',
  initialState: {
    userData: [],
    error: null,
    loading: false,
    isLoggedIn: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userData = action.payload;
        state.isLoggedIn = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isLoggedIn = false;
      });
  },
});

export default loginSlice.reducer;
