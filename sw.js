// 옥구초 일기 알림 서비스워커
const DIARY_URL = ''; // 3단계에서 일기앱 exec URL 채움

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 푸시 수신(2단계부터 사용)
self.addEventListener('push', e => {
  let d = { title: '옥구초 일기', body: '오늘 일기 썼어? ✍️' };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: 'okgu_icon.png',
    badge: 'okgu_icon.png',
    data: { url: d.url || DIARY_URL }
  }));
});

// 알림 탭 → 일기앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || DIARY_URL || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    for (const c of cl) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
