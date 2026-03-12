// ReadSnap Offscreen Document — OCR + Image Processing
// ESM import instead of UMD <script> tag
import Tesseract from './tesseract.esm.min.js';

console.log('[Offscreen] Loaded, Tesseract:', typeof Tesseract);

let tesseractWorker = null;
let currentLanguage = null;

async function getWorker(language) {
  if (tesseractWorker) {
    if (currentLanguage !== language) {
      console.log('[Offscreen] Reinitializing for language:', language);
      await tesseractWorker.reinitialize(language);
      currentLanguage = language;
    }
    return tesseractWorker;
  }

  const workerPath = chrome.runtime.getURL('ocr/worker-wrapper.js');
  const corePath = chrome.runtime.getURL('ocr/tesseract-core-simd-lstm.wasm.js');
  const langPath = chrome.runtime.getURL('ocr/tesseract/traineddata');

  // The worker loads .wasm.js via importScripts (works with chrome-extension:// + CSP 'self')
  // but its internal fetch() for .wasm binaries and traineddata fails in MV3 workers.
  // Solution: pre-cache those files with synthetic https:// keys, and the worker-wrapper
  // maps chrome-extension:// fetch URLs to synthetic cache keys.
  const extensionOrigin = chrome.runtime.getURL('');  // e.g. chrome-extension://abc123/
  const cache = await caches.open('tesseract-data');

  console.log('[Offscreen] Creating Tesseract worker...');

  // Cache WASM binary files (fetched internally by the .wasm.js glue code)
  const wasmFiles = [
    'ocr/tesseract-core-simd-lstm.wasm',
    'ocr/tesseract-core-lstm.wasm',
  ];
  for (const file of wasmFiles) {
    const fakeUrl = `https://readsnap.local/${file}`;
    if (!(await cache.match(fakeUrl))) {
      console.log('[Offscreen] Caching:', file);
      const resp = await fetch(chrome.runtime.getURL(file));
      const blob = await resp.blob();
      await cache.put(fakeUrl, new Response(blob, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      }));
    }
  }

  // Cache traineddata files
  const langs = language.split('+');
  for (const lang of langs) {
    const file = `ocr/tesseract/traineddata/${lang}.traineddata`;
    const fakeUrl = `https://readsnap.local/${file}`;
    if (!(await cache.match(fakeUrl))) {
      console.log('[Offscreen] Caching traineddata:', lang);
      const resp = await fetch(chrome.runtime.getURL(file));
      const blob = await resp.blob();
      await cache.put(fakeUrl, new Response(blob, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }));
    }
  }
  console.log('[Offscreen] All files cached, creating worker...');

  tesseractWorker = await Tesseract.createWorker(language, 1, {
    workerBlobURL: false,
    workerPath,
    corePath,       // real chrome-extension:// URL — loaded via importScripts (CSP 'self' OK)
    langPath,       // real chrome-extension:// URL — fetch intercepted by worker-wrapper
    cacheMethod: 'none',
    gzip: false,
    logger: (m) => console.log('[Tesseract]', m.status, Math.round((m.progress || 0) * 100) + '%'),
  });

  console.log('[Offscreen] Tesseract worker ready!');
  currentLanguage = language;
  return tesseractWorker;
}

// --- Message listener (only handle messages targeted to offscreen) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  console.log('[Offscreen] Message:', msg.action);

  if (msg.action === 'ping') {
    sendResponse({ ready: true });
    return false;
  }

  if (msg.action === 'runOCR') {
    runOCR(msg.dataUrl, msg.language)
      .then(text => sendResponse({ result: text }))
      .catch(err => {
        console.error('[Offscreen] OCR error:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (msg.action === 'cropImage') {
    cropImage(msg.dataUrl, msg.rect, msg.devicePixelRatio)
      .then(dataUrl => sendResponse({ result: dataUrl }))
      .catch(err => {
        console.error('[Offscreen] Crop error:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (msg.action === 'stitchImages') {
    stitchImages(msg.segments, msg.scrollHeight, msg.viewportHeight, msg.devicePixelRatio, msg.outputFormat)
      .then(dataUrl => sendResponse({ result: dataUrl }))
      .catch(err => {
        console.error('[Offscreen] Stitch error:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }

  return false;
});

// --- OCR ---
async function runOCR(dataUrl, language) {
  console.log('[Offscreen] runOCR called, language:', language);
  const worker = await getWorker(language);
  console.log('[Offscreen] Worker obtained, recognizing...');
  const { data: { text } } = await worker.recognize(dataUrl);
  console.log('[Offscreen] Recognition done, text length:', text.length);
  return text;
}

// --- Crop image ---
async function cropImage(dataUrl, rect, dpr) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const sx = Math.round(rect.x * dpr);
  const sy = Math.round(rect.y * dpr);
  const sw = Math.round(rect.width * dpr);
  const sh = Math.round(rect.height * dpr);

  canvas.width = sw;
  canvas.height = sh;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  return canvas.toDataURL('image/png');
}

// --- Stitch images ---
async function stitchImages(segments, scrollHeight, viewportHeight, dpr, outputFormat) {
  if (segments.length === 0) throw new Error('No segments to stitch');
  if (segments.length === 1) return segments[0].dataUrl;

  const images = await Promise.all(segments.map(s => loadImage(s.dataUrl)));
  const imgWidth = images[0].width;
  const totalHeight = Math.round(scrollHeight * dpr);

  const maxCanvasHeight = 32767;
  const canvasHeight = Math.min(totalHeight, maxCanvasHeight);

  const canvas = document.createElement('canvas');
  canvas.width = imgWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < segments.length; i++) {
    const img = images[i];
    const drawY = Math.round(segments[i].scrollY * dpr);

    if (i === segments.length - 1) {
      const overlapY = canvasHeight - img.height;
      ctx.drawImage(img, 0, Math.max(drawY, overlapY));
    } else {
      ctx.drawImage(img, 0, drawY);
    }
  }

  const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = outputFormat === 'jpeg' ? 0.85 : undefined;
  return canvas.toDataURL(mime, quality);
}

// --- Helpers ---
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
