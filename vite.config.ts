/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  base: process.env.OP_BASE ?? '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Orders, Please',
        short_name: 'Orders',
        description: 'Bar mental-math trainer: sum orders, give change.',
        theme_color: '#2b1d12',
        background_color: '#2b1d12',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      $core: path.resolve(import.meta.dirname, 'src/core'),
      $lib: path.resolve(import.meta.dirname, 'src/lib'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
