import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/jrc': {
        target: 'https://re.jrc.ec.europa.eu',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/jrc/, '/api'),
      },
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/anthropic/, ''),
      },
    },
  },
  plugins: [
    react(),
  ]
});
