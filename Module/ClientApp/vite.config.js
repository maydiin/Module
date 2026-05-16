import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5287',
        changeOrigin: true
      },
      '/hubs': {
        target: 'http://localhost:5287',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: '../wwwroot',
    emptyOutDir: false // Don't delete wwwroot contents (keeps lib/bootstrap, favicon, etc.)
  }
})

