import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/neoadmin/',
  plugins: [react()],
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
