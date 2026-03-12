// ReadSnap Service Worker — Orchestrator
import { saveToReadwise } from '../lib/readwise-api.js';
import { formatHtml } from '../utils/html-formatter.js';

// --- Message listener (ignore messages targeted to offscreen) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'offscreen') return false;

  if (msg.action === 'captureArea') {
    handleAreaCapture().then(() => sendResponse({ ok: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === 'areaSelected') {
    handleAreaSelected(msg, sender).then(r => sendResponse(r)).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === 'areaCancelled') {
    sendResponse({ ok: true });
    return false;
  }
  if (msg.action === 'captureFullPage') {
    handleFullPageCapture().then(r => sendResponse(r)).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === 'validateToken') {
    validateToken(msg.token).then(r => sendResponse(r)).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  return false;
});

// --- Keyboard shortcuts ---
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-full-page') {
    handleFullPageCapture();
  } else if (command === 'capture-area') {
    handleAreaCapture();
  }
});

// --- Area capture ---
async function handleAreaCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith('chrome://')) {
    throw new Error('Cannot capture this page');
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['content/area-selector.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content/area-selector.js'],
  });
}

async function handleAreaSelected(msg, sender) {
  const { rect, devicePixelRatio, pageUrl, pageTitle } = msg;

  setBadge('...', '#2563eb');
  console.log('[ReadSnap] Area selected, capturing tab...');

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    console.log('[ReadSnap] Tab captured, cropping...');

    await ensureOffscreenReady();
    console.log('[ReadSnap] Offscreen ready, sending crop...');

    const croppedDataUrl = await sendOffscreenMessage({
      action: 'cropImage',
      dataUrl,
      rect,
      devicePixelRatio,
    });
    console.log('[ReadSnap] Cropped, processing...');

    await processCapture(croppedDataUrl, pageUrl, pageTitle);

    setBadge('OK', '#2e7d32');
    setTimeout(() => setBadge('', ''), 3000);
    return { ok: true };
  } catch (err) {
    console.error('[ReadSnap] Area capture error:', err);
    setBadge('!', '#c62828');
    setTimeout(() => setBadge('', ''), 5000);
    throw err;
  }
}

// --- Full page capture ---
async function handleFullPageCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith('chrome://')) {
    throw new Error('Cannot capture this page');
  }

  setBadge('...', '#2563eb');
  console.log('[ReadSnap] Full page capture starting...');

  try {
    const [{ result: pageInfo }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio,
      }),
    });

    const { scrollHeight, viewportHeight, devicePixelRatio } = pageInfo;
    const totalScrolls = Math.ceil(scrollHeight / viewportHeight);
    console.log(`[ReadSnap] Page: ${scrollHeight}px, ${totalScrolls} segments`);

    const segments = [];
    for (let i = 0; i < totalScrolls; i++) {
      const scrollY = i * viewportHeight;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (y) => window.scrollTo(0, y),
        args: [scrollY],
      });
      await new Promise(r => setTimeout(r, 150));
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      segments.push({ dataUrl, scrollY });
    }
    console.log('[ReadSnap] All segments captured');

    // Restore scroll position
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (x, y) => window.scrollTo(x, y),
      args: [pageInfo.scrollX, pageInfo.scrollY],
    });

    await ensureOffscreenReady();
    console.log('[ReadSnap] Offscreen ready, stitching...');

    const stitchedDataUrl = await sendOffscreenMessage({
      action: 'stitchImages',
      segments,
      scrollHeight,
      viewportHeight,
      devicePixelRatio,
      outputFormat: 'jpeg',
    });
    console.log('[ReadSnap] Stitched, processing...');

    await processCapture(stitchedDataUrl, tab.url, tab.title);

    setBadge('OK', '#2e7d32');
    setTimeout(() => setBadge('', ''), 3000);
    return { ok: true };
  } catch (err) {
    console.error('[ReadSnap] Full-page capture error:', err);
    setBadge('!', '#c62828');
    setTimeout(() => setBadge('', ''), 5000);
    throw err;
  }
}

// --- OCR + Readwise pipeline ---
async function processCapture(imageDataUrl, pageUrl, pageTitle) {
  const settings = await chrome.storage.local.get([
    'readwiseToken', 'ocrLanguage', 'defaultTags', 'includeImage', 'ocrEnabled',
  ]);

  if (!settings.readwiseToken) {
    throw new Error('No Readwise token configured. Open Settings to add one.');
  }

  let ocrText = '';
  const ocrEnabled = settings.ocrEnabled !== false;

  if (ocrEnabled) {
    console.log('[ReadSnap] Starting OCR...');
    await ensureOffscreenReady();
    ocrText = await sendOffscreenMessage({
      action: 'runOCR',
      dataUrl: imageDataUrl,
      language: settings.ocrLanguage || 'eng',
    });
    console.log('[ReadSnap] OCR done, text length:', ocrText.length);
  }

  const includeImage = settings.includeImage !== false;
  const html = formatHtml(ocrText, includeImage ? imageDataUrl : null);

  console.log('[ReadSnap] Sending to Readwise...');
  await saveToReadwise({
    token: settings.readwiseToken,
    html,
    title: pageTitle || 'ReadSnap Capture',
    sourceUrl: pageUrl,
    tags: settings.defaultTags
      ? settings.defaultTags.split(',').map(t => t.trim()).filter(Boolean)
      : [],
  });
  console.log('[ReadSnap] Saved to Readwise!');
}

// --- Offscreen document management ---
async function ensureOffscreenReady() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts.length > 0) {
    console.log('[ReadSnap] Offscreen already exists');
    return;
  }

  console.log('[ReadSnap] Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: 'ocr/offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Image processing: crop, stitch, and OCR with Tesseract.js',
  });
  console.log('[ReadSnap] Offscreen created, waiting for ready...');

  // Wait for offscreen document to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const resp = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'ping' });
      if (resp?.ready) {
        console.log('[ReadSnap] Offscreen is ready');
        return;
      }
    } catch (e) {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Offscreen document failed to initialize');
}

function sendOffscreenMessage(msg) {
  return new Promise((resolve, reject) => {
    // Timeout after 60 seconds
    const timeout = setTimeout(() => {
      reject(new Error(`Offscreen message timed out: ${msg.action}`));
    }, 60000);

    chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response?.result);
      }
    });
  });
}

// --- Token validation ---
async function validateToken(token) {
  try {
    const res = await fetch('https://readwise.io/api/v2/auth/', {
      headers: { Authorization: `Token ${token}` },
    });
    return { valid: res.ok };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// --- Badge helper ---
function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}
