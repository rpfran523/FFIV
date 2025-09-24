import axios from 'axios';
import type { AuthTokens } from '../types';

const API_BASE_URL = import.meta.env.PROD
  ? 'https://ff-chi.onrender.com/api'
  : (import.meta.env.VITE_API_URL || '/api');

export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

let accessToken: string | null = localStorage.getItem('ff_token') || null;

export const setTokens = (tokens: AuthTokens) => {
  accessToken = tokens.accessToken || accessToken;
  if (accessToken) localStorage.setItem('ff_token', accessToken);
  if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const clearTokens = () => {
  accessToken = null;
  localStorage.removeItem('ff_token');
  localStorage.removeItem('refreshToken');
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

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
          if (data.accessToken || data.tokens?.accessToken) {
            const newTokens = data.tokens || data;
            setTokens(newTokens);
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
