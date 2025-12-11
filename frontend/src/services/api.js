import axios from 'axios';
import { getCsrfToken } from '../utils/security';

// Use relative URL for API base - Nginx proxy will handle routing to backend
// In production: /api/v1 -> proxied to backend by Nginx
// In development: /api/v1 -> requires proxy in vite.config.js or full URL
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1')
  : '/api/v1';

// Only log in development mode
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Agregar CSRF token para métodos que modifican datos
    if (['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken
          });

          const newToken = response.data.access;
          localStorage.setItem('access_token', newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;