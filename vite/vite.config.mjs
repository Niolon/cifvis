import { defineConfig } from 'vite';
import { resolve } from 'path';
import generateSvgIconsPlugin from './vite-plugin-generate-svg-icons';

export default defineConfig({
    plugins: [generateSvgIconsPlugin()],
    build: {
        lib: {
            entry: {
                cifvis: resolve(__dirname, '../src/index.js'),
                core: resolve(__dirname, '../src/core.js'),
                density: resolve(__dirname, '../src/density.js'),
                experimental: resolve(__dirname, '../src/experimental.js'),
                'widget/register': resolve(__dirname, '../src/widget/register.js'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: ['three'],
        },
    },
});
