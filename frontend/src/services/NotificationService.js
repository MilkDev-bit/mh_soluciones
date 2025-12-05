import api from './api';

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
    console.log('WebSocket token:', token ? 'Present' : 'Missing');
    
    if (token) {
      return `wss://app.mhsolucionesempresariales.com/ws/notifications/?token=${encodeURIComponent(token)}`;
    }
    
    return 'wss://app.mhsolucionesempresariales.com/ws/notifications/';
  }

  connectWebSocket(userId, onNewNotifications = null) {
    if (!window.WebSocket) {
      console.log('WebSocket no soportado, usando polling');
      this.startPolling(userId, onNewNotifications);
      return;
    }
  }

  startPolling(userId, onNewNotifications = null) {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log('Iniciando polling de notificaciones');

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
      console.log('Polling de notificaciones detenido');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.stopPolling();
    
    this.websocketEnabled = false;
    console.log('Servicio de notificaciones desconectado');
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
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async markAsRead(notificationId) {
    try {
      await api.patch(`/notifications/${notificationId}/mark_as_read/`);
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
export default notificationService;