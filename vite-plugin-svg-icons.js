import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const VIRTUAL_MODULE_ID = 'virtual:svg-icons';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

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
            const svgDir = resolve(process.cwd(), 'public/svg');
            icons = {};
            
            const svgFiles = readdirSync(svgDir).filter(file => file.endsWith('.svg'));
            svgFiles.forEach(file => {
              const content = readFileSync(join(svgDir, file), 'utf-8');
              const [type, ...modeParts] = file.replace('.svg', '').split('-');
              const mode = modeParts.join('-');
              
              if (!icons[type]) icons[type] = {};
              icons[type][mode] = content;
            });

            console.log('Found SVG files:', svgFiles);
            console.log('Processed icons:', Object.keys(icons));
          } catch (error) {
            console.error('Error loading SVG icons:', error);
            icons = {};
          }
        }
        return `export const SVG_ICONS = ${JSON.stringify(icons, null, 2)};`;
      }
    }
  };
}