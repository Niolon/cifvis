import { defineConfig } from 'vitepress';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import generateSvgIconsPlugin from '../../vite/vite-plugin-generate-svg-icons.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
    base: '/cifvis/docs/',
    title: 'CifVis',
    description: 'Interactive 3D visualization of crystal structures from CIF files, in the browser.',
    lang: 'en',
    lastUpdated: false,

    vue: {
        template: {
            compilerOptions: {
                isCustomElement: (tag) => tag === 'cifview-widget',
            },
        },
    },

    vite: {
        plugins: [generateSvgIconsPlugin()],
        resolve: {
            alias: {
                cifvis: resolve(projectRoot, 'src/index.js'),
            },
        },
    },

    themeConfig: {
        siteTitle: 'CifVis Docs',

        nav: [
            { text: 'General', link: '/general/introduction' },
            { text: 'Widget', link: '/widget/getting-started' },
            { text: 'JS Library', link: '/library/getting-started' },
            { text: 'Reference', link: '/reference/' },
            { text: 'Gallery', link: '/gallery/' },
            { text: 'Playground', link: 'https://niolon.github.io/cifvis/' },
        ],

        sidebar: [
            {
                text: 'General',
                collapsed: false,
                items: [
                    { text: 'Introduction', link: '/general/introduction' },
                    { text: 'CIF files', link: '/general/cif-files' },
                    { text: 'The structure model', link: '/general/structure-model' },
                    { text: 'Density concepts', link: '/general/density-concepts' },
                ],
            },
            {
                text: 'Widget',
                collapsed: false,
                items: [
                    { text: 'Getting started', link: '/widget/getting-started' },
                    { text: 'Loading data', link: '/widget/loading-data' },
                    { text: 'Display options', link: '/widget/display-options' },
                    { text: 'Density maps', link: '/widget/density' },
                    { text: 'Filtered atoms', link: '/widget/filtered-atoms' },
                    { text: 'Comparison views', link: '/widget/comparison-views' },
                    { text: 'Attributes reference', link: '/widget/attributes-reference' },
                    { text: 'Styling', link: '/widget/styling' },
                ],
            },
            {
                text: 'JS Library',
                collapsed: false,
                items: [
                    { text: 'Getting started', link: '/library/getting-started' },
                    { text: 'CrystalViewer', link: '/library/crystal-viewer' },
                    { text: 'Density maps', link: '/library/density' },
                    { text: 'Filters', link: '/library/filters' },
                    { text: 'Coupled viewers', link: '/library/coupling' },
                    { text: 'Three.js integration', link: '/library/threejs-integration' },
                ],
            },
            {
                text: 'Atom Labels',
                collapsed: false,
                items: [
                    { text: 'Activating labels', link: '/labels/' },
                    { text: 'How placement works', link: '/labels/how-it-works' },
                    { text: 'Labels in the widget', link: '/labels/widget' },
                ],
            },
            {
                text: 'Options Reference',
                collapsed: true,
                items: [
                    { text: 'Overview', link: '/reference/' },
                    { text: 'Camera', link: '/reference/camera' },
                    { text: 'Selection', link: '/reference/selection' },
                    { text: 'Interaction', link: '/reference/interaction' },
                    { text: 'Rendering', link: '/reference/rendering' },
                    { text: 'Display modes', link: '/reference/display-modes' },
                    { text: 'Atom labels', link: '/reference/atom-labels' },
                    { text: 'Atom visualization', link: '/reference/atom-visualization' },
                    { text: 'Density & scalar fields', link: '/reference/density' },
                    { text: 'Bonds', link: '/reference/bonds' },
                    { text: 'Hydrogen bonds', link: '/reference/hydrogen-bonds' },
                    { text: 'Unit cell', link: '/reference/cell' },
                    { text: 'Element properties', link: '/reference/elements' },
                ],
            },
            {
                text: 'Gallery',
                collapsed: false,
                items: [
                    { text: 'Overview', link: '/gallery/' },
                    { text: 'Comparison views', link: '/gallery/comparison-views' },
                    { text: 'Difference density', link: '/gallery/difference-density' },
                    { text: 'Publication-style 2D', link: '/gallery/publication-2d' },
                    { text: 'Contour section', link: '/gallery/contour-section' },
                    { text: 'Custom theming', link: '/gallery/custom-theming' },
                    { text: 'Disorder handling', link: '/gallery/disorder' },
                    { text: 'Labeled figures', link: '/gallery/atom-labels-figure' },
                    { text: 'Embedding with other JS', link: '/gallery/embedding' },
                    { text: 'Extended solids', link: '/gallery/extended-solid' },
                ],
            },
            {
                text: 'Contributing',
                collapsed: true,
                items: [
                    { text: 'Developing CifVis', link: '/contributing/' },
                ],
            },
        ],

        search: {
            provider: 'local',
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/niolon/cifvis' },
        ],

        outline: { level: [2, 3] },

        footer: {
            message: 'Released under the ' +
                '<a href="https://www.mozilla.org/en-US/MPL/2.0/">Mozilla Public License 2.0</a>.',
            copyright: 'CifVis — Paul Niklas Ruth',
        },
    },
});
