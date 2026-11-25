import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run dev` / `build`        → version ordinateur (API FastAPI)
// `npm run dev:mobile` / `build:mobile` → version téléphone sans serveur (un seul index.html + PWA)
export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile'
  return {
    base: mobile ? './' : '/',
    plugins: [react(), ...(mobile ? [viteSingleFile()] : [])],
    build: mobile ? { outDir: 'dist-mobile', chunkSizeWarningLimit: 4000 } : { chunkSizeWarningLimit: 1500 },
    server: {
      port: 5173,
      proxy: mobile ? undefined : { '/api': 'http://localhost:8000' },
    },
  }
})
