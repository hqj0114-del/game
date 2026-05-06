const CACHE_NAME = 'pokemon-battle-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
  // 如果 app.js 裡有固定的外部資源 (如預設圖片、字體)，也可以加進來
];

// 安裝 Service Worker 並快取資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('已開啟快取');
        return cache.addAll(urlsToCache);
      })
  );
});

// 攔截網路請求 (Cache First 策略)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在快取中找到對應資源，直接回傳快取
        if (response) {
          return response;
        }
        // 否則透過網路請求獲取
        return fetch(event.request);
      })
  );
});

// 更新 Service Worker 時清除舊的快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
