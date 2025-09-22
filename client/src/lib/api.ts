import axios from 'axios';
import type { AuthTokens } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let accessToken: string | null = null;

// Token management
export const setTokens = (tokens: AuthTokens) => {
  accessToken = tokens.accessToken;
  localStorage.setItem('refreshToken', tokens.refreshToken);
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const clearTokens = () => {
  accessToken = null;
  localStorage.removeItem('refreshToken');
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          if (data.accessToken) {
            setTokens(data);
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        clearTokens();
        // Don't redirect automatically, let the auth context handle it
      }
    }

    return Promise.reject(error);
  }
);

export default api;
