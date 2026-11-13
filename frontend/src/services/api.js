import axios from 'axios';
import { getCsrfToken } from '../utils/security';
import { SESSION_EXPIRED_KEY } from '../utils/token';

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

// [FIX] 429 "demasiadas peticiones": al borrar, duplicar o crear varias tareas
// seguidas se lanzan muchas peticiones (cada acción recarga listas, documentos
// y notificaciones). Antes el 429 llegaba como error y, si caía en el refresh
// del token, la sesión se cerraba. Ahora se espera lo que indica el servidor
// (Retry-After) y se reintenta.
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RATE_LIMIT_WAIT_MS = 20000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryAfterMs = (error, attempt) => {
  const header = Number(error?.response?.headers?.['retry-after']);
  const ms = Number.isFinite(header) && header > 0 ? header * 1000 : 1000 * 2 ** attempt;
  return Math.min(ms + Math.random() * 300, MAX_RATE_LIMIT_WAIT_MS);
};

// Refresh del token con reintento si el servidor responde 429.
const refreshAccessToken = async () => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {}, { withCredentials: true });
    } catch (err) {
      if (err.response?.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs(err, attempt));
        continue;
      }
      throw err;
    }
  }
};

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

    if (error.response?.status === 429 && originalRequest) {
      // El servidor rechazó la petición antes de procesarla: se puede repetir.
      originalRequest._rateLimitRetries = (originalRequest._rateLimitRetries || 0) + 1;
      if (originalRequest._rateLimitRetries <= MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs(error, originalRequest._rateLimitRetries - 1));
        return api(originalRequest);
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {

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
        await refreshAccessToken();

        isRefreshing = false;
        onRefreshed();

        return api(originalRequest);

      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed(refreshError);

        console.error('Token refresh failed:', refreshError);

        // Solo se cierra la sesión si el servidor RECHAZÓ el refresh token
        // (vencido o inválido). Antes cualquier falla —sin internet, timeout,
        // o un 502 mientras Railway reinicia el servidor en un despliegue—
        // mandaba al login aunque la sesión siguiera siendo válida.
        const refreshStatus = refreshError.response?.status;
        const sessionInvalid = [400, 401, 403].includes(refreshStatus);

        // Páginas públicas: no se manda al login (p. ej. el Aviso de
        // Privacidad se puede leer sin sesión).
        const PUBLIC_PATHS = ['/login', '/aviso-de-privacidad'];
        if (sessionInvalid && !PUBLIC_PATHS.includes(window.location.pathname)) {
          // 'inactive': el servidor cerró la sesión por 40 min sin actividad.
          const inactive = refreshError.response?.data?.code === 'session_inactive';
          sessionStorage.setItem(SESSION_EXPIRED_KEY, inactive ? 'inactive' : 'true');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }

        // Falla temporal: se devuelve el error original y la sesión sigue.
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;