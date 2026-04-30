import axios from 'axios';
import { getCsrfToken } from '../utils/security';

const isProd = !import.meta.env.DEV;
const host = window.location.host;

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

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (resolve, reject) => {
  refreshSubscribers.push({ resolve, reject });
};

const onRefreshed = () => {
  refreshSubscribers.forEach(({ resolve }) => resolve());
  refreshSubscribers = [];
};

const onRefreshFailed = (error) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
};

api.interceptors.request.use(
  (config) => {

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];

      if (import.meta.env.DEV) {
        console.log('📤 FormData detected - browser sets Content-Type');
      }
    }

    if (['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            () => resolve(api(originalRequest)),
            (err) => reject(err)
          );
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {}, {
          withCredentials: true
        });

        isRefreshing = false;
        onRefreshed();

        return api(originalRequest);

      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed(refreshError);

        console.error('Token refresh failed:', refreshError);

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;