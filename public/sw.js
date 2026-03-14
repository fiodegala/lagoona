/// <reference lib="webworker" />

// Service Worker for Push Notifications and PWA
const sw = self as unknown as ServiceWorkerGlobalScope;

// Push event - received from server
sw.addEventListener('push', (event) => {
  let data = { title: 'Fio de Gala', message: 'Nova notificação', type: '', entityId: '' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // fallback
  }

  const iconMap: Record<string, string> = {
    new_order: '🛍️',
    abandoned_cart: '🛒',
    pos_sale: '💰',
    stock_transfer: '📦',
  };

  const routeMap: Record<string, string> = {
    new_order: '/admin/orders',
    abandoned_cart: '/admin/abandoned-carts',
    pos_sale: '/admin/sales',
    stock_transfer: '/admin/stock',
  };

  const options: NotificationOptions = {
    body: data.message,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.type + '-' + (data.entityId || Date.now()),
    data: {
      url: routeMap[data.type] || '/admin',
      type: data.type,
      entityId: data.entityId,
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(
    sw.registration.showNotification(data.title, options)
  );
});

// Notification click - open the app at the right route
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/admin';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window
      return sw.clients.openWindow(url);
    })
  );
});

// Install event
sw.addEventListener('install', () => {
  sw.skipWaiting();
});

// Activate event
sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});
