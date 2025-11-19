import axios from 'axios';
import type { AuthTokens } from '../types';
import { isTokenExpired } from './tokenUtils';

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
  localStorage.removeItem('current-user');
};

// Force logout and redirect to login
const forceLogout = () => {
  console.log('🚪 Session expired - forcing logout');
  clearTokens();
  
  // Clear all localStorage cart data
  const cartKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('cart-') || key.startsWith('flower-fairies-cart')
  );
  cartKeys.forEach(key => localStorage.removeItem(key));
  
  // Redirect to auth page
  if (window.location.pathname !== '/auth' && window.location.pathname !== '/verify-email') {
    window.location.href = '/auth';
  }
};

// Check token expiry before each request
api.interceptors.request.use((config) => {
  if (accessToken) {
    // Check if token is expired before making request
    if (isTokenExpired(accessToken)) {
      console.warn('⚠️ Access token expired, attempting refresh...');
      // Let the response interceptor handle the refresh
    }
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = getRefreshToken();
        
        // If no refresh token or it's expired, force logout
        if (!refreshToken || isTokenExpired(refreshToken)) {
          console.log('❌ Refresh token missing or expired');
          forceLogout();
          return Promise.reject(error);
        }
        
        // Attempt to refresh access token
        const { data } = await api.post('/auth/refresh', { refreshToken });
        if (data.accessToken || data.tokens?.accessToken) {
          const newTokens = data.tokens || data;
          setTokens(newTokens);
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return api(originalRequest);
        } else {
          throw new Error('No access token in refresh response');
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        forceLogout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
