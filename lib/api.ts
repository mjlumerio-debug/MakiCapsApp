import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { logoutUser, setSessionStatus } from './ui_store';

export const PRODUCTION_API_BASE_URL = 'https://makidesuoperation.site/api/v1';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_BASE_URL).replace(/\/+$/, '') + '/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  // withCredentials: true, // Disabled to check if CORS is blocking credentials
  timeout: 30000,
});

// Add a request interceptor to attach the auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      // Skip token for auth endpoints
      const isAuthEndpoint = config.url?.includes('login') || config.url?.includes('register');
      
      if (token && !isAuthEndpoint) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[API Interceptor] Failed to get auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle session expiration (401)
let isLoggingOut = false; // Prevent multiple simultaneous logout attempts

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const requestUrl = error.config?.url || '';

      // Skip logout logic for auth endpoints (login/register should handle their own errors)
      const isAuthEndpoint = requestUrl.includes('login') || requestUrl.includes('register');

      // 401 Unauthorized - Session expired or invalid token
      if (status === 401 && !isAuthEndpoint && !isLoggingOut) {
        console.warn('[API] 401 received. Token may be expired.');
        
        isLoggingOut = true;
        try {
          // Mark session as expired in UI state
          setSessionStatus('expired');
          
          // Execute global logout (clears storage and state)
          await logoutUser();
        } finally {
          // Reset the flag after a delay to prevent rapid re-triggers
          setTimeout(() => { isLoggingOut = false; }, 3000);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const getApiBaseUrl = (): string => API_BASE_URL;

export default api;
