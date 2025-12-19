import api from './api';

/**
 * Utility function to get WebSocket base URL from environment variables
 * Converts HTTP(S) URLs to WS(S) URLs
 * 
 * Note: In production with Nginx proxy, WebSocket connections should use
 * the same domain as the frontend with /ws/ path (to be proxied by Nginx).
 * In development, we use the backend URL directly.
 */
function getWebSocketBaseURL() {
  // Use explicit WebSocket URL if provided
  if (import.meta.env.VITE_WS_URL_BASE) {
    return import.meta.env.VITE_WS_URL_BASE;
  }

  // In production, use relative WebSocket URL (same domain via Nginx proxy)
  // In development, use localhost backend
  if (!import.meta.env.DEV) {
    // Production: use current domain with wss://
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  // Development: derive from API URL or use localhost
  const apiUrl = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';

  // Extract base URL without /api/v1 suffix
  const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

  // Convert HTTP(S) to WS(S)
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  } else if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }

  // Fallback to localhost WebSocket
  return 'ws://localhost:8000';
}

// Cache the WebSocket base URL at module load time
// This is safe because Vite environment variables are resolved at build time
const WS_BASE_URL = getWebSocketBaseURL();

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
    this.maxReconnectAttempts = 3; // Reduced from 5 to 3 for faster fallback
    this.maxReconnectDelay = 30000; // 30 seconds
    this.reconnectTimeout = null;
    this.hasWebSocketFailed = false; // Track if WebSocket has permanently failed
    this.isDegraded = false; // Degraded state (working with polling)
    this.onAuthError = null; // Callback for authentication errors
    this.lastReconnectAttempt = null;
    this.minReconnectInterval = 5000; // Minimum 5 seconds between reconnections
  }

  getWebSocketURL() {
    const token = localStorage.getItem('access_token');
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('WebSocket token:', token ? 'Present' : 'Missing');
      console.log('WebSocket base URL:', WS_BASE_URL);
    }

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
        listener(data);
      } catch (error) {
        // Only log in development, prevent one listener from breaking others
        if (import.meta.env.DEV) {
          console.error('Error in notification listener:', error);
        }
        // DO NOT propagate the error
      }
    });
  }

  // Method to register authentication error callback
  setAuthErrorHandler(callback) {
    this.onAuthError = callback;
  }

  connectWebSocket(userId) {
    // Prevenir reconexiones muy frecuentes
    const now = Date.now();
    if (this.lastReconnectAttempt && (now - this.lastReconnectAttempt) < this.minReconnectInterval) {
      if (import.meta.env.DEV) {
        console.log('Reconnection throttled, too soon since last attempt');
      }
      return;
    }
    this.lastReconnectAttempt = now;

    // Agregar al inicio para prevenir múltiples reconexiones simultáneas
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // If WebSocket has permanently failed, go straight to polling
    if (this.hasWebSocketFailed) {
      if (!this.isPolling) {
        this.startPolling(userId);
      }
      return;
    }

    if (!window.WebSocket) {
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log('WebSocket no soportado, usando polling');
      }
      this.hasWebSocketFailed = true;
      this.startPolling(userId);
      return;
    }

    // If already connected or connecting, don't reconnect
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.connecting) return;
    this.connecting = true;

    // Close existing connection if closing or closed to be safe
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    try {
      const wsUrl = this.getWebSocketURL();
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log('Conectando WebSocket a:', wsUrl);
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.websocketEnabled = true;
        this.connecting = false;
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.log('WebSocket conectado exitosamente');
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only log in development mode
          if (import.meta.env.DEV) {
            console.log('Mensaje WebSocket recibido:', data);
          }

          if (data.type === 'new_notification' && data.payload) {
            // Show browser notification
            this.showBrowserNotification(data.payload);

            // Notify all listeners - FIXED: pass full data object, not just payload
            this.notifyListeners(data);
          }
        } catch (error) {
          // Only log in development mode
          if (import.meta.env.DEV) {
            console.error('Error procesando mensaje WebSocket:', error);
          }
        }
      };

      this.socket.onerror = (error) => {
        // Only log in development mode - make errors completely silent in production
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
        
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.log('WebSocket closed:', event.code, event.reason);
        }

        // Attempt reconnection with exponential backoff
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
          this.reconnectAttempts++;
          
          // Only log in development mode
          if (import.meta.env.DEV) {
            console.log(`WebSocket disconnected. Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          }
          
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket(userId);
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          // Max reconnect attempts reached, fallback to polling permanently
          // Only log in development mode
          if (import.meta.env.DEV) {
            console.log('Max WebSocket reconnection attempts reached. Falling back to polling permanently.');
          }
          this.hasWebSocketFailed = true; // Mark WebSocket as permanently failed
          this.isDegraded = true; // Degraded state (working with polling)
          this.reconnectAttempts = 0; // Reset for future manual attempts
          this.startPolling(userId);
        }
      };
    } catch (error) {
      // Only log in development mode - make errors completely silent in production
      if (import.meta.env.DEV) {
        console.error('Error creating WebSocket connection:', error);
      }
      this.connecting = false;
      // Fallback to polling on connection error
      this.startPolling(userId);
    }
  }

  startPolling(userId) {
    if (this.isPolling) return;

    this.isPolling = true;
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('Iniciando polling de notificaciones');
    }

    // Start polling immediately
    this.pollNotifications();

    this.pollingInterval = setInterval(async () => {
      await this.pollNotifications();
    }, 30000);
  }

  async pollNotifications() {
    try {
      const unreadCount = await this.getUnreadCount();
      
      // Notify listeners with polling update event
      // This ensures components can refresh their state even when WebSocket is not available
      this.notifyListeners({ 
        type: 'polling_update', 
        unreadCount: unreadCount 
      });
      
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log(`[Polling] Notified listeners with count: ${unreadCount}`);
      }
    } catch (error) {
      // Only log in development mode - silently fail in production
      if (import.meta.env.DEV) {
        console.error('Error en polling de notificaciones:', error);
      }
      // Don't throw - just continue polling
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log('Polling de notificaciones detenido');
      }
    }
  }

  disconnect() {
    // Only disconnect if we really want to shutdown app-wide (e.g. logout)
    // Removed forceful close on unmount of components since it's a singleton now.
    // We add a method forceDisconnect for Logout.

    // Changing behavior: 'disconnect' now actually disconnects. 
    // Components should no longer call disconnect() on unmount.

    // Clear any pending reconnection attempts
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
    this.hasWebSocketFailed = false; // Reset the permanent failure flag on disconnect
    this.isDegraded = false; // Reset degraded state on disconnect
    this.lastReconnectAttempt = null; // Reset last reconnect timestamp
    
    // Only log in development mode
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
      // Only log in development mode
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
    try {
      const response = await api.get('/notifications/', { params });
      // Handle paginated response - return results array or empty array
      return Array.isArray(response.data.results)
        ? response.data.results
        : (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      // Handle 401 errors with callback
      if (error.response?.status === 401) {
        if (this.onAuthError && typeof this.onAuthError === 'function') {
          this.onAuthError(); // Notify logout
        }
        if (import.meta.env.DEV) {
          console.error('Authentication error fetching notifications - token may be expired');
        }
        return [];
      }
      // Only log in development mode - silent in production
      if (import.meta.env.DEV) {
        console.error('Error fetching notifications:', error);
      }
      // Return empty array instead of throwing to prevent white screens
      // The calling component can check error state if needed
      return [];
    }
  }

  async markAsRead(notificationId) {
    try {
      // Try WebSocket first for real-time update
      const sentViaWS = this.markAsReadViaWebSocket(notificationId);

      // Always call API as well to ensure persistence
      await api.post(`/notifications/${notificationId}/mark_as_read/`);

      // Only log in development mode
      if (import.meta.env.DEV && sentViaWS) {
        console.log(`Notificación ${notificationId} marcada como leída vía WebSocket y API`);
      }
    } catch (error) {
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.error('Error marcando notificación como leída:', error);
      }
      // Don't throw - fail silently to prevent breaking UI
    }
  }

  async markAllAsRead() {
    try {
      await api.post('/notifications/mark_all_as_read/');
    } catch (error) {
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.error('Error marking all notifications as read:', error);
      }
      // Don't throw - fail silently to prevent breaking UI
      // Caller can handle by checking if unread count changed
    }
  }

  async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread_count/');
      return response.data.unread_count;
    } catch (error) {
      // Handle 401 errors with callback
      if (error.response?.status === 401) {
        if (this.onAuthError && typeof this.onAuthError === 'function') {
          this.onAuthError(); // Notify logout
        }
        if (import.meta.env.DEV) {
          console.error('Authentication error fetching unread count - token may be expired');
        }
        return 0;
      }
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.error('Error fetching unread count:', error);
      }
      // Return 0 instead of throwing to prevent breaking UI
      return 0;
    }
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

// Export both the class instance and convenience functions
export default notificationService;

export const getNotifications = (params) => notificationService.getNotifications(params);
export const markAsRead = (notificationId) => notificationService.markAsRead(notificationId);
export const markAllAsRead = () => notificationService.markAllAsRead();
export const getUnreadCount = () => notificationService.getUnreadCount();