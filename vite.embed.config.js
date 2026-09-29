import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'public/embed',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'src/embed/entry.js'),
      name: 'BptHeroEmbed',
      formats: ['iife'],
      fileName: () => 'bpt-hero.v1.iife.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
