# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReadSnap is a Chrome extension (Manifest V3) that captures screenshots of web pages, extracts text via OCR (Tesseract.js), and sends the result to Readwise Reader.

## Build Commands

- `npm run build` — Vite bundles JS entry points, then `scripts/build.js` copies static assets to `dist/`
- `npm run dev` — Vite build in watch mode (no asset copying; run full build first)
- No test runner or linter is configured.

To package for Chrome Web Store: zip the contents of `dist/` (not the folder itself).

## Architecture

### Message-passing flow

The extension uses Chrome's `runtime.sendMessage` for all inter-context communication. Messages include a `target` field (`'offscreen'`) to route correctly.

```
Popup/Keyboard shortcut
  → Service Worker (orchestrator)
    → Content Script (area selection only)
    → Offscreen Document (image processing + OCR)
    → Readwise API (save)
```

### Entry points (bundled by Vite)

- `src/background/service-worker.js` → `dist/service-worker.js` — orchestrates captures, manages offscreen document lifecycle, calls Readwise API. Imports `lib/readwise-api.js` and `utils/html-formatter.js` (inlined by Vite, no shared chunks).
- `src/popup/popup.js` → `dist/popup.js` — popup UI logic.
- `src/options/options.js` → `dist/options.js` — settings page logic.

### Static assets (copied by `scripts/build.js`, not bundled)

- `src/content/area-selector.js` — injected via `chrome.scripting.executeScript` at runtime. Cannot use ES module imports.
- `src/ocr/offscreen.js` — runs in offscreen document context, uses ES module import for Tesseract.
- `src/ocr/worker-wrapper.js` — Tesseract web worker that intercepts `fetch()` for `chrome-extension://` URLs and serves from Cache API instead (MV3 workaround).

### Key MV3 constraints to know

- **No shared chunks**: Vite is configured with `manualChunks: undefined` to inline everything. MV3 service workers have import path issues with code-split chunks.
- **WASM requires `'wasm-unsafe-eval'`** in CSP (see `manifest.json`).
- **Offscreen document**: Required for DOM access (Canvas API for image crop/stitch) and running Tesseract WASM. Created on demand via `ensureOffscreenReady()` in service worker, with a ping/retry loop.
- **Cache API workaround**: Web workers in MV3 can't `fetch()` `chrome-extension://` URLs. The offscreen main thread pre-caches WASM binaries and traineddata into Cache API under synthetic `https://readsnap.local/` keys. The worker-wrapper intercepts fetch and serves from cache.
- **Content script (`area-selector.js`)**: Not bundled — injected dynamically, so it must be self-contained (no imports).

### Tesseract.js setup

Tesseract files come from `node_modules` and are copied to `dist/ocr/` at build time:
- `tesseract.esm.min.js`, `worker.min.js` — JS runtime
- `tesseract-core-simd-lstm.wasm` + `tesseract-core-lstm.wasm` — WASM binaries (SIMD and non-SIMD variants)
- `src/ocr/tesseract/traineddata/{eng,ita}.traineddata` — bundled language data

### Settings (chrome.storage.local)

Keys: `readwiseToken`, `ocrLanguage` (`'eng'`/`'ita'`/`'eng+ita'`), `defaultTags`, `includeImage`, `ocrEnabled`.
