import api from './api';

const NOTIFICATIONS_TIMEOUT = 10000;
const UNREAD_COUNT_TIMEOUT = 5000; 

function getWebSocketBaseURL() {
  if (import.meta.env.VITE_WS_URL_BASE) {
    return import.meta.env.VITE_WS_URL_BASE;
  }

  if (!import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  const apiUrl = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';

  const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  } else if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }

  return 'ws://localhost:8000';
}

const WS_BASE_URL = getWebSocketBaseURL();

/**
 * Helper function to handle API calls with timeout and error handling
 * @param {Function} apiCall - The API call function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @param {*} defaultValue - Default value to return on error
 * @param {Function} onAuthError - Optional callback for 401 errors
 * @returns {Promise<*>} - The API response or default value
 */
async function apiCallWithTimeout(apiCall, timeout, defaultValue, onAuthError = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await apiCall(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      if (import.meta.env.DEV) {
        console.warn('[NotificationService] Request timeout');
      }
      return defaultValue;
    }
    
    if (error.response?.status === 401) {
      if (onAuthError && typeof onAuthError === 'function') {
        onAuthError();
      }
      if (import.meta.env.DEV) {
        console.error('[NotificationService] Authentication error - token may be expired');
      }
      return defaultValue;
    }
    
    if (import.meta.env.DEV) {
      console.error('[NotificationService] API error:', error);
    }
    return defaultValue;
  }
}

class NotificationService {
  constructor() {
    this.socket = null;
    this.pollingInterval = null;
    this.isPolling = false;
    this.notificationPermission = null;
    this.websocketEnabled = false;
    this.listeners = new Set();
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.maxReconnectDelay = 30000;
    this.reconnectTimeout = null;
    this.hasWebSocketFailed = false;
    this.isDegraded = false;
    this.onAuthError = null;
    this.lastReconnectAttempt = null;
    this.minReconnectInterval = 5000;
  }

  getWebSocketURL() {
    const token = localStorage.getItem('access_token');

    if (token) {
      return `${WS_BASE_URL}/ws/notifications/?token=${encodeURIComponent(token)}`;
    }

    return `${WS_BASE_URL}/ws/notifications/`;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        const result = listener(data);
        
        if (result && typeof result.then === 'function') {
          result.catch(error => {
            if (import.meta.env.DEV) {
              console.error('Error in async notification listener:', error);
            }
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error in notification listener:', error);
        }
      }
    });
  }

  setAuthErrorHandler(callback) {
    this.onAuthError = callback;
  }

  connectWebSocket(userId) {
    const now = Date.now();
    if (this.lastReconnectAttempt && (now - this.lastReconnectAttempt) < this.minReconnectInterval) {
      if (import.meta.env.DEV) {
        console.log('Reconnection throttled, too soon since last attempt');
      }
      return;
    }
    this.lastReconnectAttempt = now;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.hasWebSocketFailed) {
      if (!this.isPolling) {
        this.startPolling(userId);
      }
      return;
    }

    if (!window.WebSocket) {
      if (import.meta.env.DEV) {
        console.log('WebSocket no soportado, usando polling');
      }
      this.hasWebSocketFailed = true;
      this.startPolling(userId);
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.connecting) return;
    this.connecting = true;

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    try {
      const wsUrl = this.getWebSocketURL();
      if (import.meta.env.DEV) {
        console.log('Conectando WebSocket a:', wsUrl);
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.websocketEnabled = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        if (import.meta.env.DEV) {
          console.log('WebSocket conectado exitosamente');
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (import.meta.env.DEV) {
            console.log('Mensaje WebSocket recibido:', data);
          }

          if (data.type === 'new_notification' && data.payload) {
            this.showBrowserNotification(data.payload);
            this.notifyListeners(data);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error procesando mensaje WebSocket:', error);
          }
        }
      };

      this.socket.onerror = (error) => {
        if (import.meta.env.DEV) {
          console.error('WebSocket error:', error);
        }
        this.websocketEnabled = false;
        this.connecting = false;
      };

      this.socket.onclose = (event) => {
        this.websocketEnabled = false;
        this.connecting = false;
        this.socket = null;
        
        if (import.meta.env.DEV) {
          console.log('WebSocket closed:', event.code, event.reason);
        }

        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
          this.reconnectAttempts++;
          
          if (import.meta.env.DEV) {
            console.log(`WebSocket disconnected. Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          }
          
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket(userId);
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          if (import.meta.env.DEV) {
            console.log('Max WebSocket reconnection attempts reached. Falling back to polling permanently.');
          }
          this.hasWebSocketFailed = true;
          this.isDegraded = true; 
          this.reconnectAttempts = 0;
          this.startPolling(userId);
        }
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating WebSocket connection:', error);
      }
      this.connecting = false;
      this.startPolling(userId);
    }
  }

  startPolling(userId) {
    if (this.isPolling) return;

    this.isPolling = true;
    if (import.meta.env.DEV) {
      console.log('Iniciando polling de notificaciones');
    }

    this.pollNotifications();

    this.pollingInterval = setInterval(async () => {
      await this.pollNotifications();
    }, 30000);
  }

  async pollNotifications() {
    try {
      const unreadCount = await this.getUnreadCount();
      
      this.notifyListeners({ 
        type: 'polling_update', 
        unreadCount: unreadCount 
      });
      
      if (import.meta.env.DEV) {
        console.log(`[Polling] Notified listeners with count: ${unreadCount}`);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error en polling de notificaciones:', error);
      }
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      if (import.meta.env.DEV) {
        console.log('Polling de notificaciones detenido');
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.stopPolling();

    this.websocketEnabled = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.hasWebSocketFailed = false; 
    this.isDegraded = false;
    this.lastReconnectAttempt = null;
    
    if (import.meta.env.DEV) {
      console.log('Servicio de notificaciones desconectado');
    }
  }

  sendWebSocketMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  markAsReadViaWebSocket(notificationId) {
    return this.sendWebSocketMessage({
      type: 'mark_as_read',
      notification_id: notificationId
    });
  }

  async showBrowserNotification(notificationData) {
    if (!('Notification' in window)) return;
    if (this.notificationPermission === null) {
      this.notificationPermission = await Notification.requestPermission();
    }
    if (this.notificationPermission !== 'granted') return;

    try {
      const { title, message, id } = notificationData;
      const notification = new Notification(title || 'Nueva notificación', {
        body: message || 'Tienes una nueva notificación',
        icon: '/logo192.png',
        tag: `notification-${id}`,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        this.markAsRead(id);
      };

      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error mostrando notificación del navegador:', error);
      }
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      return permission;
    } catch (error) {
      return 'denied';
    }
  }

  async getNotifications(params = {}) {
    return apiCallWithTimeout(
      async (signal) => {
        const response = await api.get('/notifications/', { params, signal });
        
        if (import.meta.env.DEV) {
          console.log('[NotificationService] Raw Response:', response);
        }
        
        const resData = response.data !== undefined ? response.data : response;
        
        if (resData && Array.isArray(resData.results)) {
          return resData.results;      
        } else if (Array.isArray(resData)) {
          return resData;              
        } else if (response && Array.isArray(response.results)) {
          return response.results;      
        }
        
        return [];
      },
      NOTIFICATIONS_TIMEOUT,
      [],
      this.onAuthError
    );
  }

  async markAsRead(notificationId) {
    try {
      const sentViaWS = this.markAsReadViaWebSocket(notificationId);

      await api.post(`/notifications/${notificationId}/mark_as_read/`);

      if (import.meta.env.DEV && sentViaWS) {
        console.log(`Notificación ${notificationId} marcada como leída vía WebSocket y API`);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error marcando notificación como leída:', error);
      }
    }
  }

  async markAllAsRead() {
    try {
      await api.post('/notifications/mark_all_as_read/');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error marking all notifications as read:', error);
      }
    }
  }

  async getUnreadCount() {
    return apiCallWithTimeout(
      async (signal) => {
        const response = await api.get('/notifications/unread_count/', { signal });
        return response.data.unread_count;
      },
      UNREAD_COUNT_TIMEOUT,
      0,
      this.onAuthError
    );
  }

  getPermissionStatus() {
    return this.notificationPermission;
  }

  getConnectionStatus() {
    return {
      websocketEnabled: this.websocketEnabled,
      isPolling: this.isPolling,
      notificationPermission: this.notificationPermission
    };
  }
}

const notificationService = new NotificationService();

export default notificationService;

export const getNotifications = (params) => notificationService.getNotifications(params);
export const markAsRead = (notificationId) => notificationService.markAsRead(notificationId);
export const markAllAsRead = () => notificationService.markAllAsRead();
export const getUnreadCount = () => notificationService.getUnreadCount();