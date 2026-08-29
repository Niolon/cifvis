/** @vi-environment jsdom */

import { AtomLabelManager } from './atom-label-manager.js';

describe('AtomLabelManager label formatting', () => {
    test('preserves raw text for segmented canvas typography', () => {
        const manager = Object.create(AtomLabelManager.prototype);
        manager.displayStructure = {
            atoms: [
                { label: 'C1', uniqueId: 'C1|1_555', atomType: 'C' },
                { label: 'Si1B', uniqueId: 'Si1B|1_555', atomType: 'Si' },
            ],
        };
        manager.options = {
            show: 'all', text: {}, subscriptNonElement: true,
        };
        expect(manager.resolveRequests().map(request => request.text)).toEqual(['C1', 'Si1B']);
        expect(manager.displayStructure.atoms.map(atom => atom.label)).toEqual(['C1', 'Si1B']);
    });
});
