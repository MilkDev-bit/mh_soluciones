import api from './api';

class NotificationService {
  constructor() {
    this.notificationPermission = null;
    this.pushSubscription = null;
    this.isSubscribed = false;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones');
      return 'denied';
    }

    if (this.notificationPermission) {
      return this.notificationPermission;
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      
      if (permission === 'granted') {
        await this.subscribeToPushNotifications();
      }
      
      return permission;
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
      return 'denied';
    }
  }

  async subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications no soportadas');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
      });

      this.pushSubscription = subscription;
      this.isSubscribed = true;

      await this.sendSubscriptionToBackend(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Error al suscribirse a push notifications:', error);
      return null;
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async sendSubscriptionToBackend(subscription) {
    try {
      await api.post('/notifications/subscribe/', {
        subscription: subscription
      });
    } catch (error) {
      console.error('Error enviando suscripción al backend:', error);
    }
  }

  connectWebSocket(userId) {
    if (!userId) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('No se encontró token de acceso para la conexión WebSocket.');
      return;
    }
    
    const backendUrl = import.meta.env.VITE_API_BASE_URL;
    if (!backendUrl) {
      console.error("La variable de entorno VITE_API_BASE_URL no está definida.");
      return;
    }

    let wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws/notifications/';
    wsUrl += `?token=${token}`;
    
    console.log('Intentando conectar WebSocket a:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket conectado para notificaciones');
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error procesando mensaje WebSocket:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket desconectado:', event);
        this.handleReconnection(userId);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error conectando WebSocket:', error);
    }
  }

  handleReconnection(userId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connectWebSocket(userId);
      }, delay);
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'new_notification':
        this.showBrowserNotification(data.payload);
        break;
      case 'notification_read':
        break;
      default:
        console.log('Mensaje WebSocket no manejado:', data);
    }
  }

  showBrowserNotification(notificationData) {
    if (this.notificationPermission !== 'granted') return;

    const { title, message, notification_type, id } = notificationData;

    const notification = new Notification(title, {
      body: message,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: `notification-${id}`,
      requireInteraction: true,
      data: { notificationId: id }
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      this.markAsRead(id);
      this.handleNotificationClick(notificationData);
    };

    setTimeout(() => {
      notification.close();
    }, 10000);
  }

  handleNotificationClick(notification) {
    switch (notification.notification_type) {
      case 'TASK_ASSIGNED':
        window.location.href = '/tasks';
        break;
      case 'PROJECT_UPDATE':
        window.location.href = `/projects/${notification.content_object_id}`;
        break;
      default:
        window.location.href = '/notifications';
    }
  }

  async getNotifications(params = {}) {
    try {
      const response = await api.get('/notifications/', { params });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      throw error;
    }
  }

  async markAsRead(notificationId) {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'mark_as_read',
          notification_id: notificationId
        }));
      }

      await api.patch(`/notifications/${notificationId}/mark_as_read/`);
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }

  async markAllAsRead() {
    try {
      await api.post('/notifications/mark_all_as_read/');
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
      throw error;
    }
  }

  async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread_count/');
      return response.data.unread_count;
    } catch (error) {
      console.error('Error obteniendo conteo de no leídas:', error);
      return 0;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  getPermissionStatus() {
    return this.notificationPermission;
  }

  isPushEnabled() {
    return this.isSubscribed;
  }
}

const notificationService = new NotificationService();
export default notificationService;