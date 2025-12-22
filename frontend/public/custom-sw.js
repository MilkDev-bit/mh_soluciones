/**
 * Service Worker for Web Push Notifications
 * Handles push notifications and notification clicks
 */

const SW_VERSION = '1.0.0';

// Helper function to safely convert Uint8Array to base64
function uint8ArrayToBase64(uint8Array) {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks = [];
  
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
    chunks.push(String.fromCharCode.apply(null, chunk));
  }
  
  return btoa(chunks.join(''));
}

// Install event - cache static assets if needed
self.addEventListener('install', (event) => {
  console.log(`Service Worker ${SW_VERSION} installing...`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`Service Worker ${SW_VERSION} activating...`);
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Push event - receive and display notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Nueva notificación',
    body: 'Tienes una nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'default-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  try {
    if (event.data) {
      const data = event.data.json();
      console.log('Push data:', data);
      
      // Update notification data with received data
      if (data.title) notificationData.title = data.title;
      if (data.body) notificationData.body = data.body;
      if (data.icon) notificationData.icon = data.icon;
      if (data.tag) notificationData.tag = data.tag;
      
      // Store URL to open when notification is clicked
      if (data.url) {
        notificationData.data = { url: data.url };
      }
    }
  } catch (error) {
    console.error('Error parsing push data:', error);
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    notificationData
  );

  event.waitUntil(promiseChain);
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  
  // Try to focus existing window or open new one
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    // Check if there's already a window open
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    
    // If no matching window, check if any window is open and navigate it
    if (windowClients.length > 0) {
      const client = windowClients[0];
      if ('navigate' in client) {
        return client.navigate(urlToOpen).then(client => client.focus());
      }
    }
    
    // Otherwise, open a new window
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  })
  .catch((error) => {
    console.error('Error handling notification click:', error);
  });

  event.waitUntil(promiseChain);
});

// Push subscription change - handle subscription updates
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
  
  // Try to resubscribe
  const promiseChain = self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: event.oldSubscription?.options?.applicationServerKey
  })
  .then((subscription) => {
    console.log('Resubscribed to push notifications');
    // Send the new subscription to the server
    return fetch('/api/v1/notifications/push/subscriptions/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: uint8ArrayToBase64(new Uint8Array(subscription.getKey('p256dh'))),
        auth: uint8ArrayToBase64(new Uint8Array(subscription.getKey('auth')))
      })
    });
  })
  .catch((error) => {
    console.error('Error resubscribing to push notifications:', error);
  });

  event.waitUntil(promiseChain);
});

// Message event - handle messages from the client
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log(`Service Worker ${SW_VERSION} loaded successfully`);
