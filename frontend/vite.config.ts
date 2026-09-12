import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 后端 API 地址：开发时通过代理转发，生产由 nginx 反代
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          http: ['axios']
        }
      }
    }
  }
})
