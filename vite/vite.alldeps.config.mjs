import { defineConfig } from 'vite';
import { resolve } from 'path';
import generateSvgIconsPlugin from './vite-plugin-generate-svg-icons';

/**
 * Inline every web worker into this bundle.
 *
 * The alldeps build is the drop-in <script> distribution: consumers copy one
 * file and expect it to work. A worker left as a separate chunk is emitted with
 * a root-absolute URL ("/assets/scalar-field-worker-<hash>.js"), so it only
 * resolves when the page is served from the server root. Under any sub-path --
 * a GitHub Pages project site, a docs server, a shared static host -- the
 * worker 404s. That failure is silent: loadScalarFieldSources() still resolves
 * and difference density simply never appears.
 *
 * The atom-label worker is already imported with ?worker&inline; this extends
 * the same treatment to the rest for this build only, leaving the bundler-
 * targeted builds free to emit separate, cacheable chunks.
 * @returns {import('vite').Plugin} Vite plugin rewriting worker imports to inline.
 */
function inlineWorkersPlugin() {
    return {
        name: 'cifvis-inline-workers',
        enforce: 'pre',
        resolveId(source, importer, options) {
            if (!source.includes('?worker') || source.includes('inline')) {
                return null;
            }
            return this.resolve(`${source}&inline`, importer, {
                ...options,
                skipSelf: true,
            });
        },
    };
}

export default defineConfig({
    plugins: [generateSvgIconsPlugin(), inlineWorkersPlugin()],
    build: {
        lib: {
            entry: resolve(__dirname, '../src/index.js'),
            name: 'CifVis',
            fileName: 'cifvis.alldeps',
        },
    },
});