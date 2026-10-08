import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'path';
import { execSync } from 'node:child_process';

function resolveBuildSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __NALI_BUILD_SHA__: JSON.stringify(resolveBuildSha()),
  },
  logLevel: 'warn',
  // Keep the pre-bundled dependency cache OUTSIDE node_modules. When the
  // preview reinstalls packages while the dev server is running, a cache
  // inside node_modules is wiped and every lazy route then fails with
  // "Failed to fetch dynamically imported module" (504 on deps). The root
  // `.vite` folder is already gitignored and survives reinstalls; Vite still
  // re-optimizes on startup whenever the lockfile changes.
  cacheDir: '.vite',
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  build: {
    // The entry chunk is intentionally kept below this app-specific budget
    // after vendor splitting (it dropped from ~956 kB to ~572 kB). Keep the
    // warning useful instead of reporting the known, measured entry size on
    // every production build.
    chunkSizeWarningLimit: 600,
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
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-utils';
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
    mode === 'test' ? null : base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react()
  ].filter(Boolean)
}));