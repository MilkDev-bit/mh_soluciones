/**
 * Web Push Notification Utilities
 * Handles push notification subscription and management
 */

import api from './api';

// Check browser compatibility
export const isPushNotificationSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Convert VAPID key from base64 to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Request notification permission from user
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

// Get current notification permission
export const getNotificationPermission = () => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

// Register service worker
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers not supported in this browser');
  }

  try {
    const registration = await navigator.serviceWorker.register('/custom-sw.js', {
      scope: '/'
    });

    console.log('Service Worker registered:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error('Error registering Service Worker:', error);
    throw error;
  }
};

// Get VAPID public key from backend
export const getVapidPublicKey = async () => {
  try {
    const response = await api.get('/notifications/push/vapid-public-key/');
    return response.data.public_key;
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    throw error;
  }
};

const sameKey = (buffer, uint8) => {
  if (!buffer || !uint8) return false;
  const a = new Uint8Array(buffer);
  if (a.length !== uint8.length) return false;
  return a.every((v, i) => v === uint8[i]);
};

// Subscribe to push notifications.
// `force`: descarta la suscripción actual del navegador y crea una nueva.
export const subscribeToPush = async ({ force = false } = {}) => {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications not supported in this browser');
  }

  try {
    // Check permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    // Get service worker registration
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await registerServiceWorker();
    }

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // [FIX] Si el navegador ya tenía una suscripción creada con OTRA clave
    // VAPID (p. ej. tras cambiar las claves del servidor), el servicio push
    // rechaza todos los envíos. Se descarta y se crea una nueva.
    const existing = await registration.pushManager.getSubscription();
    if (existing && (force || !sameKey(existing.options?.applicationServerKey, convertedVapidKey))) {
      await existing.unsubscribe();
    }

    // Subscribe to push (devuelve la existente si sigue siendo válida)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Send subscription to server
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
};

/**
 * [FIX] El interruptor solo miraba si el NAVEGADOR estaba suscrito. Si el
 * servidor no tenía la suscripción (o la había desactivado), se veía
 * "activado" pero "Enviar prueba" respondía 400. Al abrir la pantalla se
 * vuelve a registrar la suscripción del navegador en el servidor.
 */
export const syncPushSubscription = async () => {
  if (!isPushNotificationSupported() || getNotificationPermission() !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration && await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const vapidPublicKey = await getVapidPublicKey();
  if (!sameKey(subscription.options?.applicationServerKey, urlBase64ToUint8Array(vapidPublicKey))) {
    await subscribeToPush({ force: true });
    return true;
  }
  await sendSubscriptionToServer(subscription);
  return true;
};

// Send subscription to backend
export const sendSubscriptionToServer = async (subscription) => {
  try {
    const subscriptionJSON = subscription.toJSON();
    
    const data = {
      endpoint: subscriptionJSON.endpoint,
      p256dh: subscriptionJSON.keys.p256dh,
      auth: subscriptionJSON.keys.auth
    };

    const response = await api.post('/notifications/push/subscriptions/', data);
    console.log('Subscription sent to server:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending subscription to server:', error);
    throw error;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPush = async () => {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return false;
    }

    // Unsubscribe from browser
    const unsubscribed = await subscription.unsubscribe();
    
    // Notify server
    if (unsubscribed) {
      try {
        await api.post('/notifications/push/subscriptions/unsubscribe/', {
          endpoint: subscription.endpoint
        });
      } catch (error) {
        console.error('Error notifying server of unsubscription:', error);
      }
    }

    console.log('Unsubscription successful:', unsubscribed);
    return unsubscribed;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw error;
  }
};

// Check if user is subscribed to push
export const isPushSubscribed = async () => {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
};

// Get current push subscription
export const getPushSubscription = async () => {
  if (!isPushNotificationSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return null;
    }

    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
};

// Send test push notification
export const sendTestPushNotification = async () => {
  try {
    const response = await api.post('/notifications/push/subscriptions/send_test/');
    console.log('Test notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
};
