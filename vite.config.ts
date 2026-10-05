import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // `/api` is served by Vercel functions: run `npx vercel dev` to exercise the backend locally.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
