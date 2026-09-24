import { defineConfig } from 'vite';
import { savesPlugin } from './vite-saves-plugin.js';

export default defineConfig({
  plugins: [savesPlugin()],
  server: {
    port: 5173,
    open: true
  }
});
