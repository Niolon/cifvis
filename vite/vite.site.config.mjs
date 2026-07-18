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
                docsIndex: resolve(__dirname, '../site/docs/index.html'),
                docsComparison: resolve(__dirname, '../site/docs/comparison.html'),
                docsWidget: resolve(__dirname, '../site/docs/widget-usage.html'),
                docsOptions: resolve(__dirname, '../site/docs/options-reference.html'),
                docsUsing: resolve(__dirname, '../site/docs/using-cifvis.html'),
                docsDeveloping: resolve(__dirname, '../site/docs/developing-cifvis.html'),
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
