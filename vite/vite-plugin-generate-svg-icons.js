// vite-plugin-generate-svg-icons.js
import { generateSvgIconsFile } from '../scripts/generate-svg-icons.js';

/**
 * Creates a Vite plugin that generates SVG icons on startup.
 * @returns {import('vite').Plugin} Vite plugin
 */
export default function generateSvgIconsPlugin() {   
    return {
        name: 'generate-svg-icons',
        
        buildStart() {
            // Generate SVG icons on startup
            console.log('Generating SVG icons on startup...');
            generateSvgIconsFile();
        },
    };
}