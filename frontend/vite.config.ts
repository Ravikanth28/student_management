import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// Single source of truth for the app version: frontend/package.json "version".
// The web reads it via __APP_VERSION__; CI stamps the APK's versionName with it.
const pkgVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        // Allow large file uploads through the proxy
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[proxy error]', err.message);
          });
        },
      }
    }
  }
});
