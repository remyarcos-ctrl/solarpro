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
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-libs':    ['jspdf', 'html2canvas'],
          'chart-libs':  ['recharts'],
          'map-libs':    ['mapbox-gl', '@mapbox/mapbox-gl-draw', 'react-map-gl'],
          'turf-libs':   ['@turf/turf'],
          'radix-libs':  [
            '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select', '@radix-ui/react-popover',
            '@radix-ui/react-slot', '@radix-ui/react-tabs',
          ],
        },
      },
    },
  },
});
