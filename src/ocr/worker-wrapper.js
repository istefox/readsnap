// Wrapper worker: intercepts fetch() for chrome-extension:// URLs
// and serves them from Cache API (pre-populated by offscreen main thread).
// Web Workers in MV3 can't fetch chrome-extension:// URLs directly,
// but importScripts() works fine (CSP 'self').
// Cache keys use synthetic https://readsnap.local/ URLs because
// Cache API rejects chrome-extension:// scheme.

const originalFetch = self.fetch.bind(self);

self.fetch = async function(url, options) {
  const urlStr = typeof url === 'string' ? url : (url instanceof Request ? url.url : '');
  if (urlStr.startsWith('chrome-extension://')) {
    // Map chrome-extension://EXTID/ocr/foo → https://readsnap.local/ocr/foo
    const path = new URL(urlStr).pathname;  // e.g. /ocr/tesseract-core-simd-lstm.wasm
    const cacheKey = 'https://readsnap.local' + path;
    console.log('[Worker] Intercepting fetch:', urlStr, '→', cacheKey);
    try {
      const cache = await caches.open('tesseract-data');
      const cached = await cache.match(cacheKey);
      if (cached) {
        console.log('[Worker] Cache HIT:', cacheKey);
        return cached.clone();
      }
      console.warn('[Worker] Cache MISS:', cacheKey);
    } catch (e) {
      console.error('[Worker] Cache error:', e);
    }
    // Can't fall through — fetch will fail anyway for chrome-extension:// in worker
    return new Response('Not found in cache', { status: 404 });
  }
  return originalFetch(url, options);
};

importScripts('worker.min.js');
