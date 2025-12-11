import { defineConfig } from 'vite';

export default defineConfig({
  base: '/satorama/',  // GitHub Pages serves from repo name path
  server: {
    host: true,
    open: true,
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
