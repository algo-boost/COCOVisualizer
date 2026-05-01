import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 输出到 ../static/dist；index.html 仅供 dev server 使用。
// 后端 templates/index.html 通过 manifest.json 判断是否走 Vite 产物。
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: __dirname,
  base: mode === 'production' ? '/static/dist/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'static', 'dist'),
    emptyOutDir: true,
    manifest: true,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src', 'main.jsx'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://127.0.0.1:6010',
      '/static/vendor': 'http://127.0.0.1:6010',
      '/static/logo.png': 'http://127.0.0.1:6010',
    },
  },
}));
