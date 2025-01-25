import { defineConfig } from 'vite';
import { resolve } from 'path';
import svgIconsPlugin from './vite-plugin-svg-icons';

export default defineConfig({
  plugins: [svgIconsPlugin()],
  base: '/cifvis/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        widget: resolve(__dirname, 'widget.html')
      },
      output: {
        inlineDynamicImports: false
      }
    }
  },
  publicDir: 'public'
});