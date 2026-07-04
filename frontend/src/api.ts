import axios from 'axios';
import { API_BASE_URL } from './config';

export const STORAGE_KEY = 'student-portal-auth';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// On an expired/invalid token, clear auth and bounce to the login screen
// instead of letting every subsequent request fail silently.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken(null);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);
