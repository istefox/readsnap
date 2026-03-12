import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'popup': resolve(__dirname, 'src/popup/popup.js'),
        'options': resolve(__dirname, 'src/options/options.js'),
      },
      output: {
        entryFileNames: '[name].js',
        // Inline shared code into each entry (no shared chunks)
        // This avoids import path issues in MV3 service workers
        manualChunks: undefined,
      },
    },
    target: 'esnext',
    minify: false,
  },
});
