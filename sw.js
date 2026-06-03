// OKGU DIARY Web Push service worker
const DIARY_URL = 'https://rlasksk030.github.io/okgu-diary-alarm-/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'OKGU DIARY',
    body: '새 알림이 있어요.',
    url: DIARY_URL,
    tag: 'okgu-diary',
    icon: 'okgu_icon.png'
  };

  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (err) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'OKGU DIARY', {
      body: data.body || '새 알림이 있어요.',
      icon: data.icon || 'okgu_icon.png',
      badge: 'okgu_icon.png',
      tag: data.tag || 'okgu-diary',
      renotify: true,
      data: { url: data.url || DIARY_URL }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || DIARY_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(url);
          return client;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
