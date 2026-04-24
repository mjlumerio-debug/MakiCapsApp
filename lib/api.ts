import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const PRODUCTION_API_BASE_URL = 'https://makidesuoperation.site/api/v1';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_BASE_URL).replace(/\/+$/, '') + '/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased to 30 seconds for production stability
});

// Add a request interceptor to attach the auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
    } catch (error) {
      console.error('[API Interceptor] Failed to get auth token:', error);
    }
    return config;
  },
  (error) => {
    // 🔍 Verbose Network Error Logging
    if (error.message === 'Network Error') {
        console.error('[API] Network Error: Please check server status at:', API_BASE_URL);
    }
    return Promise.reject(error);
  }
);

export const getApiBaseUrl = (): string => API_BASE_URL;

export default api;
