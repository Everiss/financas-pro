// Service Worker — Financas Pro Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Financas Pro', body: event.data ? event.data.text() : '' };
  }

  const title   = data.title   ?? 'Financas Pro';
  const options = {
    body:   data.body   ?? '',
    icon:   data.icon   ?? '/icon-192.png',
    badge:  data.badge  ?? '/icon-72.png',
    tag:    data.tag    ?? 'financas-pro',
    data:   { url: data.url ?? '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Foca numa aba já aberta se possível
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          self.clients.openWindow(url);
        }
      }),
  );
});
