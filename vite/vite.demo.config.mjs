import { defineConfig } from 'vite';
import { resolve } from 'path';
import svgIconsPlugin from './vite-plugin-svg-icons';

export default defineConfig({
    plugins: [svgIconsPlugin()],
    base: '/cifvis/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, '../demo/index.html'),
                widget: resolve(__dirname, '../demo/widget.html'),
            },
            //output: {
            //    inlineDynamicImports: false,
            //},
        },
    },
    publicDir: '../demo/public',
});