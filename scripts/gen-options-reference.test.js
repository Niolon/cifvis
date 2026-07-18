import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildOptionsData } from './gen-options-reference.mjs';
import { descriptions } from '../docs/.vitepress/data/option-descriptions.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = resolve(projectRoot, 'docs/.vitepress/data/options-data.json');

describe('options reference generation', () => {
    it('committed options-data.json matches the current defaults', () => {
        const committed = JSON.parse(readFileSync(dataPath, 'utf8'));
        expect(committed).toEqual(buildOptionsData());
    });

    it('every generated option path has a hand-written description', () => {
        const data = buildOptionsData();
        const missing = [];
        for (const rows of Object.values(data)) {
            for (const row of rows) {
                if (!descriptions[row.path]) {
                    missing.push(row.path);
                }
            }
        }
        expect(missing, `Add descriptions in docs/.vitepress/data/option-descriptions.js for: ${missing.join(', ')}`)
            .toEqual([]);
    });
});
