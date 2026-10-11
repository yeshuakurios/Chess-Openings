import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt', // the app shows a "new version" notice instead of swapping code under a running drill
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        id: './',
        name: 'Opening Goals',
        categories: ['education', 'games'],
        short_name: 'Openings',
        description: 'Learn the goal and strategy of each opening, then drill the lines.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#0a0b10',
        theme_color: '#0a0b10',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'] }
    })
  ]
});
