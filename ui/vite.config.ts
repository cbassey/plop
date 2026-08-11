import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// Local middleware plugin (plain ESM, no TS types).
// @ts-expect-error — .mjs shim for the harness API
import { harnessApiPlugin } from './server/harness-api.mjs'

export default defineConfig({
  plugins: [react(), harnessApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
