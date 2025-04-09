import { defineConfig } from 'vite';
import { resolve } from 'path';
import generateSvgIconsPlugin from './vite-plugin-generate-svg-icons';

export default defineConfig({
    plugins: [generateSvgIconsPlugin()],
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