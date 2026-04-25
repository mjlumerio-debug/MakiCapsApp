import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { logoutUser, setSessionStatus } from './ui_store';

export const PRODUCTION_API_BASE_URL = 'https://makidesuoperation.site/api/v1';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_BASE_URL).replace(/\/+$/, '') + '/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Get auth token from SecureStore
 */
export const getAuthToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    return token ? token.trim() : null; // Ensure no whitespace
  } catch (error) {
    console.error('[SecureStore] Failed to get auth_token:', error);
    return null;
  }
};

// Add a request interceptor to attach the auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAuthToken();
      const isAuthEndpoint = config.url?.includes('login') || config.url?.includes('register');
      
        if (token && !isAuthEndpoint) {
          if (config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
          console.log(`[API-OUT] ${config.method?.toUpperCase()} ${config.url} (Token: Attached)`);
        } else if (!isAuthEndpoint) {
          console.warn(`[API-WARN] ${config.method?.toUpperCase()} ${config.url} (Token: MISSING)`);
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
let interceptorSuppressed = false; // Suppresses auto-logout during session validation

/**
 * Temporarily suppress the 401 auto-logout interceptor.
 * Use this during startup session checks so stale tokens
 * don't trigger the "Session Expired" alert.
 */
export const suppressAutoLogout = (suppress: boolean): void => {
  interceptorSuppressed = suppress;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const requestUrl = error.config?.url || '';

      // Skip logout logic for auth endpoints (login/register should handle their own errors)
      const isAuthEndpoint = requestUrl.includes('login') || requestUrl.includes('register');

      // Skip if interceptor is suppressed (during startup session validation)
      const isSuppressed = interceptorSuppressed;

      // 401 Unauthorized - Session expired or invalid token
      if (status === 401 && !isAuthEndpoint && !isLoggingOut && !isSuppressed) {
        // 🚨 CRITICAL: Skip auto-logout for profile and rider routes.
        // This prevents the "Session Expired" loop if the backend is misconfigured.
        if (requestUrl.includes('user') || requestUrl.includes('rider')) {
          console.warn(`[API] 401 on ${requestUrl} suppressed to prevent logout loop.`);
          return Promise.reject(error);
        }

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
