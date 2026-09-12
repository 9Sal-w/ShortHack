import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ВАЖНО ПРО NGINX PROXY:
 * В production-сборке фронтенд обращается к серверу ТОЛЬКО по относительным
 * путям вида /api/... Это сделано намеренно, чтобы Nginx мог прозрачно
 * проксировать /api на реальный backend без изменений кода фронтенда.
 *
 * Секция server.proxy ниже используется ТОЛЬКО при локальной разработке
 * (npm run dev), когда backend поднят на localhost:8080.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    watch: {
      // Исключаем служебные папки IDE (Visual Studio создаёт .vs при
      // открытии папки проекта) и node_modules, чтобы избежать EBUSY-ошибок.
      ignored: ['**/.vs/**', '**/node_modules/**', '**/.git/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
