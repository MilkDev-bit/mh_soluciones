import axios from 'axios';
import { getCsrfToken } from '../utils/security';

const isProd = !import.meta.env.DEV;
const host = window.location.host; // Esto dará 'app.mhsolucionesempresariales.com'

export const WS_URL = isProd
  ? `wss://${host}/ws/notifications/`
  : `ws://localhost:8000/ws/notifications/`;

const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1')
  : '/api/v1';

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
    // Bearer token is now handled by HttpOnly cookies automatically
    // No need to manually inject Authorization header from localStorage
    
    // Log warning in dev for non-login requests if we want to trace
    if (import.meta.env.DEV && !['/auth/login/', '/token/refresh/'].includes(config.url)) {
      // With cookies, we don't know if a token exists until the request fails with 401
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
        // Use a separate axios instance for token refresh to avoid circular interceptor calls
        // backend will use the refresh cookie automatically
        await axios.post(`${API_BASE_URL}/token/refresh/`, {}, {
          withCredentials: true
        });

        // Retry the original request (it will now include the new access cookie)
        return api(originalRequest);
      } catch (refreshError) {
        // Token refresh failed - redirect to login
        console.error('Token refresh failed:', refreshError);
        
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