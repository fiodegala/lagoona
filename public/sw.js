// Service Worker for Push Notifications and PWA

const clearLegacyCaches = async () => {
  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
};

self.addEventListener('push', (event) => {
  let data = { title: 'Fio de Gala', message: 'Nova notificação', type: '', entityId: '' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // fallback payload
  }

  const routeMap = {
    new_order: '/admin/orders',
    abandoned_cart: '/admin/abandoned-carts',
    pos_sale: '/admin/sales',
    stock_transfer: '/admin/stock',
  };

  const options = {
    body: data.message,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `${data.type}-${data.entityId || Date.now()}`,
    data: {
      url: routeMap[data.type] || '/admin',
      type: data.type,
      entityId: data.entityId,
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(url);
          }
          return;
        }
      }

      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      clearLegacyCaches(),
    ])
  );
});
