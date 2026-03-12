# ReadSnap

<p align="center">
  <img src="icons/icon-128.png" alt="ReadSnap icon" width="128">
</p>

Chrome extension that captures full-page or area screenshots, extracts text using OCR, and saves everything to [Readwise Reader](https://readwise.io/read).

## Features

- **Full-page capture** — automatically scrolls and stitches the entire page into a single image
- **Area selection** — draw a rectangle to capture a specific region
- **Built-in OCR** — text extraction powered by [Tesseract.js](https://github.com/naptha/tesseract.js), running 100% locally in your browser
- **Multi-language** — supports English, Italian, or both
- **Keyboard shortcuts** — `⌘⇧S` full page, `⌘⇧A` area select (Ctrl on Windows/Linux)
- **Auto-tagging** — configure default tags for organizing captures in Readwise
- **Private** — no data sent to third parties, no analytics, no tracking

## Setup

1. Install the extension from the Chrome Web Store *(review pending)*
2. Click the extension icon → **Settings**
3. Enter your Readwise access token (get it from [readwise.io/access_token](https://readwise.io/access_token))
4. Start capturing

## Development

```bash
npm install
npm run build      # Vite bundle + copy static assets to dist/
npm run dev        # Vite watch mode (run full build first)
```

Load `dist/` as an unpacked extension in `chrome://extensions` with Developer mode enabled.

## How it works

```
Popup / Keyboard shortcut
  → Service Worker (orchestrates capture)
    → Content Script (area selection overlay)
    → Offscreen Document (image crop/stitch + Tesseract.js OCR)
    → Readwise API (save)
```

All image processing and OCR runs locally in an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen). The WASM binaries and language data are bundled in the extension package.

## Tech stack

- Chrome Extension Manifest V3
- [Vite](https://vite.dev/) — build tooling
- [Tesseract.js](https://github.com/naptha/tesseract.js) v5 — OCR engine (WASM)
- Chrome Offscreen Documents API — DOM/Canvas access for image processing
- Cache API — workaround for MV3 fetch restrictions in web workers

## Privacy

All OCR processing happens locally. The only external communication is with the Readwise API using your personal token. See [Privacy Policy](PRIVACY_POLICY.md).

## License

MIT
