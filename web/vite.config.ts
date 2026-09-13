import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { SYS_CONSOLE_PATH } from '@hiroba/shared';

const SYS_SHELL = '/-/sys.html';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'hiroba-sys-shell',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === SYS_CONSOLE_PATH) {
            req.url = SYS_SHELL;
          }
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        sys: resolve(import.meta.dirname, '-/sys.html'),
      },
    },
  },
  server: {
    proxy: {
      '/healthz': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/config.js': 'http://localhost:3000',
      '/load': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/stat': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
