import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Serve a Microsoft Store-compliant PWA manifest at a custom path that
// bypasses the Base44 plugin's default manifest handler, then rewrite the
// <link rel="manifest"> tag in index.html to point to it.
function customManifestPlugin() {
  let manifestContent = '';
  try {
    manifestContent = readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf-8');
  } catch (e) {
    console.warn('public/manifest.json not found — using Base44 default manifest');
  }
  const serveManifest = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(manifestContent);
  };
  return {
    name: 'custom-manifest',
    configureServer(server) {
      server.middlewares.use('/store-manifest.json', serveManifest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/store-manifest.json', serveManifest);
    },
    transformIndexHtml(html) {
      // Replace any manifest link href with our custom path
      return html.replace(
        /<link\s+rel="manifest"\s+href="[^"]*"/g,
        '<link rel="manifest" href="/store-manifest.json"'
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'warn',
  build: {
    // Split rarely-changing vendor code out of the main entry chunk. Without
    // this the entry bundle is ~950 kB, so every app deploy forces mobile users
    // to re-download React, the router, charts and animation libraries too.
    // Splitting them keeps those cached across releases.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('three')) return 'vendor-three';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          return undefined;
        },
      },
    },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    customManifestPlugin(),
  ]
});