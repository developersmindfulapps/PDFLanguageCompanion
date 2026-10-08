import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        viewer: path.resolve(process.cwd(), 'viewer.html'),
        background: path.resolve(process.cwd(), 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  // NOTE: Vite automatically copies the entire `public/` directory into `dist/`.
  // This includes:
  //   public/pdf.worker.min.mjs  — PDF.js worker (avoids CDN / CSP issues)
  //   public/cmaps/              — PDF.js CMap files for CID-font text decoding
  //   public/standard_fonts/     — PDF.js standard fonts for offline font rendering
  //   public/manifest.json       — Chrome Extension manifest
  //   public/icons/              — Extension icons
  //
  // IMPORTANT: Do NOT remove public/cmaps/ or public/standard_fonts/ or replace
  // URLs in pdfService.ts with remote CDN URLs. In Chrome Extension MV3, CDN
  // fetches are blocked by CSP.
});

