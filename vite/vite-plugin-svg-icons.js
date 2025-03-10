import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const VIRTUAL_MODULE_ID = 'virtual:svg-icons';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Cleans SVG content by removing unnecessary elements and whitespace.
 * @param {string} content - The raw SVG file content
 * @returns {string} Cleaned SVG content
 */
function cleanSvg(content) {
    return content
        .replace(/<\?xml[^>]*\?>\s*/g, '') // Remove XML declaration
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/sodipodi:[^\s>]+(?:\s*=\s*"[^"]*")?\s*/g, '') // Remove sodipodi attributes
        .replace(/inkscape:[^\s>]+(?:\s*=\s*"[^"]*")?\s*/g, '') // Remove inkscape attributes
        .replace(/\s+xmlns:(?:sodipodi|inkscape)="[^"]*"\s*/g, '') // Remove sodipodi/inkscape namespaces
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .replace(/\s+/g, ' ') // Collapse remaining whitespace
        .trim();
}

/**
 * Creates a Vite plugin that imports SVG icons from a directory and makes them available
 * as a virtual module. The plugin assumes SVG files are named according to the pattern:
 * `type-mode.svg` or just `type.svg`.
 * 
 * The plugin automatically cleans the SVG files by removing Inkscape-specific XML entries,
 * comments, unnecessary attributes, and whitespace to significantly reduce the file size
 * and improve performance.
 * 
 * When imported in code as `import { SVG_ICONS } from 'virtual:svg-icons'`, the icons
 * will be available in a nested object structure:
 * ```
 * {
 *   type1: {
 *     mode1: "<svg>...</svg>",
 *     mode2: "<svg>...</svg>"
 *   },
 *   type2: "<svg>...</svg>"
 * }
 * ```
 * @returns {import('vite').Plugin} A Vite plugin object
 * @example
 * // vite.config.js
 * import { defineConfig } from 'vite';
 * import svgIconsPlugin from './plugins/svg-icons-plugin';
 * 
 * export default defineConfig({
 *   plugins: [
 *     svgIconsPlugin()
 *   ]
 * });
 * 
 * // In your code
 * import { SVG_ICONS } from 'virtual:svg-icons';
 * 
 * // Use the SVG content
 * element.innerHTML = SVG_ICONS.hydrogen.anisotropic;
 */
export default function svgIconsPlugin() {
    let icons = null;

    return {
        name: 'svg-icons',
        resolveId(id) {
            if (id === VIRTUAL_MODULE_ID) {
                return RESOLVED_VIRTUAL_MODULE_ID;
            }
        },

        load(id) {
            if (id === RESOLVED_VIRTUAL_MODULE_ID) {
                if (!icons) {
                    try {
                        const svgDir = resolve(process.cwd(), 'src/svg-icons');
                        icons = {};
            
                        const svgFiles = readdirSync(svgDir).filter(file => file.endsWith('.svg'));
                        svgFiles.forEach(file => {
                            const content = readFileSync(join(svgDir, file), 'utf-8');
                            const [type, ...modeParts] = file.replace('.svg', '').split('-');
                            const mode = modeParts.join('-');
              
                            if (!icons[type]) {
                                icons[type] = {}; 
                            }

                            if (mode === '') {
                                icons[type] = cleanSvg(content);
                            } else {
                                icons[type][mode] = cleanSvg(content);
                            }
                        });
                        console.log('');
                        console.log('Found SVG files:', svgFiles);
                        console.log('Processed icons:', Object.keys(icons));
                    } catch (error) {
                        console.error('Error loading SVG icons:', error);
                        icons = {};
                    }
                }
                return `export const SVG_ICONS = ${JSON.stringify(icons, null, 2)};`;
            }
        },
    };
}