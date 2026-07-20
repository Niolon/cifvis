import { defineConfig } from 'vite';
import { resolve } from 'path';
import generateSvgIconsPlugin from './vite-plugin-generate-svg-icons';

export default defineConfig({
    plugins: [generateSvgIconsPlugin()],
    base: '/cifvis/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, '../site/index.html'),
                // The documentation is a VitePress site under docs/ and is
                // built separately via `npm run docs:build`.
            },
            output: {
                // Ensure files go to the main dist directory
                dir: resolve(__dirname, '../dist'),
                // Ensure assets are placed directly in the output directory
                assetFileNames: 'assets/[name].[hash][extname]',
                chunkFileNames: 'assets/[name].[hash].js',
                entryFileNames: 'assets/[name].[hash].js',
            },
        },
        // Specify the output directory
        outDir: '../dist',
        emptyOutDir: true,
    },
    // Specify the root directory for file resolution
    root: resolve(__dirname, '../site'),
    // Specify the public directory path (relative to root)
    publicDir: resolve(__dirname, '../site/public'),
    watch: true,
});
