import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/neoadmin/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own long-cached chunk so
        // the app entry stays small and repeat visits only re-download app code.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'radix-vendor': ['@radix-ui/react-popover', '@radix-ui/react-select', 'cmdk'],
        },
      },
    },
  },
  server: {
    proxy: {
      // Dev only: forward the Tomcat-style backend path to the local Spring Boot server,
      // which serves the same APIs at /api (no /neoadminBackend context).
      '/neoadminBackend/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/neoadminBackend/, ''),
      },
    },
  },
})
