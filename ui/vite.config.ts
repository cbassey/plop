import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The API is a service now (plop/api), not dev-server middleware, so the
// dashboard behaves the same on your machine and on the host. In dev, Vite
// forwards /api to uvicorn. In a build, VITE_PLOP_API_URL points the
// browser at the deployed API instead.
const apiTarget = process.env.PLOP_API_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
