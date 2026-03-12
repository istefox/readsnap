import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

function copy(src, dest) {
  const fullSrc = resolve(root, src);
  const fullDest = resolve(dist, dest);
  if (!existsSync(fullSrc)) {
    console.warn(`  SKIP (not found): ${src}`);
    return;
  }
  mkdirSync(dirname(fullDest), { recursive: true });
  cpSync(fullSrc, fullDest, { recursive: true });
  console.log(`  ${src} -> dist/${dest}`);
}

console.log('Copying static assets...');

// Manifest
copy('src/manifest.json', 'manifest.json');

// Popup HTML/CSS
copy('src/popup/popup.html', 'popup.html');
copy('src/popup/popup.css', 'popup.css');

// Options HTML/CSS
copy('src/options/options.html', 'options.html');
copy('src/options/options.css', 'options.css');

// Content script (copied as-is, not bundled)
copy('src/content/area-selector.js', 'content/area-selector.js');
copy('src/content/area-selector.css', 'content/area-selector.css');

// Offscreen document (copied as-is, not bundled)
copy('src/ocr/offscreen.html', 'ocr/offscreen.html');
copy('src/ocr/offscreen.js', 'ocr/offscreen.js');
copy('src/ocr/worker-wrapper.js', 'ocr/worker-wrapper.js');

// Tesseract.js files (copied from node_modules + traineddata)
copy('node_modules/tesseract.js/dist/tesseract.esm.min.js', 'ocr/tesseract.esm.min.js');
copy('node_modules/tesseract.js/dist/worker.min.js', 'ocr/worker.min.js');

// Copy tesseract-core files (wasm + JS glue) — LSTM-only variants for auto-detection
// v5 has: simd-lstm, simd, lstm, base (no relaxedsimd)
const coreFiles = [
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
];
for (const f of coreFiles) {
  copy(`node_modules/tesseract.js-core/${f}`, `ocr/${f}`);
}

// Traineddata
copy('src/ocr/tesseract/traineddata', 'ocr/tesseract/traineddata');

// Icons
copy('icons', 'icons');

console.log('Done!');
