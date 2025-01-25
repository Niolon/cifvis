import { defineConfig } from 'vite';
import { resolve } from 'path';
import svgIconsPlugin from './vite-plugin-svg-icons';

export default defineConfig({
  plugins: [svgIconsPlugin()],
  base: process.env.NODE_ENV === 'production' 
    ? 'https://niolon.github.io/cifvis' 
    : '/cifvis/',
  server: {
    base: '/cifvis/'
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'CrystalViewer',
      fileName: 'crystal-viewer'
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        widget: resolve(__dirname, 'widget.html')
      }
    }
  },
  publicDir: 'public'
});