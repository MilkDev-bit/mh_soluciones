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

  connectWebSocket(userId, onNewNotifications = null) {
    if (!window.WebSocket) {
      if (import.meta.env.DEV) {
        console.log('WebSocket no soportado, usando polling');
      }
      this.startPolling(userId, onNewNotifications);
      return;
    }

    // Close existing connection if any
    if (this.socket) {
      this.socket.close();
    }

    try {
      const wsUrl = this.getWebSocketURL();
      if (import.meta.env.DEV) {
        console.log('Conectando WebSocket a:', wsUrl);
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.websocketEnabled = true;
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
            // Show browser notification
            this.showBrowserNotification(data.payload);
            
            // Call the callback if provided
            if (onNewNotifications) {
              onNewNotifications(data.payload);
            }
          }
        } catch (error) {
          console.error('Error procesando mensaje WebSocket:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        this.websocketEnabled = false;
      };

      this.socket.onclose = (event) => {
        this.websocketEnabled = false;
        if (import.meta.env.DEV) {
          console.log('WebSocket cerrado:', event.code, event.reason);
        }

        // Fallback to polling if WebSocket connection fails
        if (!event.wasClean) {
          console.log('WebSocket cerrado inesperadamente, usando polling');
          this.startPolling(userId, onNewNotifications);
        }
      };
    } catch (error) {
      console.error('Error creando conexión WebSocket:', error);
      this.startPolling(userId, onNewNotifications);
    }
  }

  startPolling(userId, onNewNotifications = null) {
    if (this.isPolling) return;
    
    this.isPolling = true;
    if (import.meta.env.DEV) {
      console.log('Iniciando polling de notificaciones');
    }

    this.pollNotifications(onNewNotifications);

    this.pollingInterval = setInterval(async () => {
      await this.pollNotifications(onNewNotifications);
    }, 30000);
  }

  async pollNotifications(onNewNotifications = null) {
    try {
      const unreadCount = await this.getUnreadCount();
      if (unreadCount > 0 && onNewNotifications) {
        onNewNotifications(unreadCount);
      }
    } catch (error) {
      console.error('Error en polling de notificaciones:', error);
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.stopPolling();
    
    this.websocketEnabled = false;
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
      console.error('Error mostrando notificación del navegador:', error);
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
      return response.data.results || response.data || [];
    } catch (error) {
      throw error;
    }
  }

  async markAsRead(notificationId) {
    try {
      // Try WebSocket first for real-time update
      const sentViaWS = this.markAsReadViaWebSocket(notificationId);
      
      // Always call API as well to ensure persistence
      await api.post(`/notifications/${notificationId}/mark_as_read/`);
      
      if (import.meta.env.DEV && sentViaWS) {
        console.log(`Notificación ${notificationId} marcada como leída vía WebSocket y API`);
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }

  async markAllAsRead() {
    try {
      await api.post('/notifications/mark_all_as_read/');
    } catch (error) {
      throw error;
    }
  }

  async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread_count/');
      return response.data.unread_count;
    } catch (error) {
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