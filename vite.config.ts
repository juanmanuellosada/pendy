import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Tauri builds: drop the PWA manifest link from index.html. The manifest's
// `start_url`/`scope` are written for the GitHub Pages deploy and trick
// WebKitGTK into navigating the Tauri window to the deployed PWA on launch.
const stripPwaManifestForTauri = (): Plugin => ({
  name: 'strip-pwa-manifest-for-tauri',
  transformIndexHtml(html) {
    if (!process.env.TAURI_ENV_PLATFORM) return html
    return html.replace(/<link\s+rel="manifest"[^>]*\/?>\s*/g, '')
  },
})

export default defineConfig({
  base: process.env.TAURI_ENV_PLATFORM ? '/' : '/pendy/',
  plugins: [react(), tailwindcss(), stripPwaManifestForTauri()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
})
