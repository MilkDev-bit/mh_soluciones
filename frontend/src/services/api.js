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
    
    // Detectar si estamos enviando FormData (para uploads de archivos)
    // El navegador debe establecer Content-Type automáticamente con el boundary correcto
    if (config.data instanceof FormData) {
      // Eliminar Content-Type para que el navegador lo establezca automáticamente
      delete config.headers['Content-Type'];
      
      if (import.meta.env.DEV) {
        console.log('📤 FormData detected - letting browser set Content-Type with boundary');
      }
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

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No refresh token available, redirect to login
          console.error('No refresh token available');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
          refresh: refreshToken
        });

        const newToken = response.data.access;
        localStorage.setItem('access_token', newToken);

        // Update the failed request with new token and retry
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Token refresh failed - clear tokens and redirect to login
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);

export default api;