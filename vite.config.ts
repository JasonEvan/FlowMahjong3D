import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep Vite's generated dependency cache out of node_modules. This lets the
  // dev server run even if dependencies were installed with sudo.
  cacheDir: '.vite',
})
