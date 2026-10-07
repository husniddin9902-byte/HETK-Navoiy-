/* HETK PWA va brauzer bildirishnomalari uchun mustaqil service worker.
   Tashqi CDN fayliga bog'lanmaydi, shuning uchun Chrome uni doim o'rnata oladi. */
self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Chromium qurilmalari saytni to'liq o'rnatiladigan PWA sifatida tanishi
// uchun tarmoq so'rovlarini worker orqali o'tkazamiz. Javob keshga olinmaydi,
// shuning uchun saytning eski versiyasi qotib qolmaydi.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(function() {
    return new Response('Internet aloqasi mavjud emas.', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8'}
    });
  }));
});

// FCM yuborgan xabarlarni tashqi Firebase SDKsiz ko'rsatadi.
self.addEventListener('push', function(event) {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_error) {
    payload = {notification: {body: event.data ? event.data.text() : ''}};
  }
  const notice = payload.notification || {};
  const data = payload.data || {};
  const title = notice.title || data.title || 'HETK';
  const options = {
    body: notice.body || data.body || 'Yangi bildirishnoma',
    icon: notice.icon || 'icons/hetk-192.png',
    badge: 'icons/hetk-192.png',
    data: {url: data.link || data.url || './'},
    tag: data.tag || data.kind || 'hetk-notification'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.location.href).href;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list) {
    for (const client of list) {
      if ('focus' in client) {
        if ('navigate' in client) client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
