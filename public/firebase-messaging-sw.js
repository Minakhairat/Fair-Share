/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// Background FCM listener initialized dynamically via query params or postMessage from client
let messagingInitialized = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE_MESSAGING' && !messagingInitialized) {
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'FairShare Reminder';
        const options = {
          body: payload.notification?.body || 'You have an updated family responsibility.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.data?.taskId || 'fairshare-update',
          data: payload.data || {},
        };
        self.registration.showNotification(title, options);
      });
      messagingInitialized = true;
    } catch (err) {
      console.error('FCM SW initialization error:', err);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
