// scripts/generate-svg-icons.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgDir = path.resolve(__dirname, '../src/svg-icons');
const outputDir = path.resolve(__dirname, '../src/lib/generated');
const outputFile = path.resolve(outputDir, 'svg-icons.js');

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
 * Ensure that the output folder exists. Create it if not.
 */
function ensureOutputDirExists() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}`);
    }
}

/**
 * Generate a javascript version of the included SVG icons for distribution with the
 * libary.
 * @returns {boolean} Indicator whether build was successful
 */
function generateSvgIconsFile() {
    const icons = {};

    try {
        ensureOutputDirExists();
        
        // Read all SVG files from the directory
        const svgFiles = fs.readdirSync(svgDir).filter(file => file.endsWith('.svg'));
        
        svgFiles.forEach(file => {
            const content = fs.readFileSync(path.join(svgDir, file), 'utf-8');
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

        // Generate JavaScript file content
        const fileContent = `// This file is auto-generated - DO NOT EDIT
export const SVG_ICONS = ${JSON.stringify(icons, null, 2)};
`;

        // Write to the output file
        fs.writeFileSync(outputFile, fileContent);
        console.log(`Generated SVG icons file at ${outputFile}`);
        console.log(`Processed ${svgFiles.length} SVG files`);
        
        return true;
    } catch (error) {
        console.error('Error generating SVG icons file:', error);
        return false;
    }
}

// If this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const success = generateSvgIconsFile();
    process.exit(success ? 0 : 1);
}

export { generateSvgIconsFile };