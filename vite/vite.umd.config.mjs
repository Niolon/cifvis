import { defineConfig } from 'vite';
import { resolve } from 'path';
import generateSvgIconsPlugin from './vite-plugin-generate-svg-icons';

export default defineConfig({
    plugins: [generateSvgIconsPlugin()],
    build: {
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, '../src/index.js'),
            name: 'CifVis',
            fileName: () => 'cifvis.umd.cjs',
            formats: ['umd'],
        },
        rollupOptions: {
            external: ['three'],
            output: {
                globals: {
                    three: 'THREE',
                },
            },
        },
    },
});
