import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Serve a Microsoft Store-compliant PWA manifest, overriding the
// Base44 plugin's dynamically generated one.
function customManifestPlugin() {
  let manifestContent = '';
  try {
    manifestContent = readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf-8');
  } catch (e) {
    console.warn('public/manifest.json not found — using Base44 default manifest');
  }
  return {
    name: 'custom-manifest',
    configureServer(server) {
      server.middlewares.use('/manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(manifestContent);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(manifestContent);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'warn',
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