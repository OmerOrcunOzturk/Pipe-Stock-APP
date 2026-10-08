import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Geliştirme sırasında veri ve giriş istekleri yerel sunucuya (npm run sunucu) aktarılır.
  server: {
    proxy: {
      '/auth/v1': 'http://localhost:8080',
      '/rest/v1': 'http://localhost:8080',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
