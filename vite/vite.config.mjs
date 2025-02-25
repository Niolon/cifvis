import { defineConfig } from 'vite';
import { resolve } from 'path';
import svgIconsPlugin from './vite-plugin-svg-icons';

export default defineConfig({
    plugins: [svgIconsPlugin()],
    build: {
        lib: {
            entry: resolve(__dirname, '../src/index.js'),
            name: 'CifVis',
            fileName: 'cifvis',
        },
        rollupOptions: {
            external: ['three', 'mathjs'],
            output: {
                globals: {
                    three: 'THREE',
                    mathjs: 'math',
                },
            },
        },
    },
});