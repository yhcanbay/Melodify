import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: fileURLToPath(new URL('./mobile', import.meta.url)),
  publicDir: false,
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-mobile', import.meta.url)),
    emptyOutDir: true,
  },
})
