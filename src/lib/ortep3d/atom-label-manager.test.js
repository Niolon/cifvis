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

    test('draws leader lines with the resolved label colour by default', () => {
        const manager = Object.create(AtomLabelManager.prototype);
        manager.options = {
            fontWeight: 500,
            fontSize: 14,
            fontFamily: 'sans-serif',
            leaderLines: 'auto',
            leaderColor: 'label',
            leaderWidth: 1,
            haloWidth: 0,
            color: '#111111',
        };
        manager.layout = { placed: [{
            text: 'Si1B', elementText: 'Si', nonElementText: '1B', color: '#336699',
            x: 20, y: 20, leaderLine: true,
            leaderSegment: { x1: 0, y1: 0, x2: 10, y2: 10 },
        }] };
        const context = {
            beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
            strokeText: vi.fn(), fillText: vi.fn(),
            measureText: vi.fn(text => ({ width: text.length * 5 })),
        };

        manager.paintLayout(context);

        expect(context.strokeStyle).toBe('#336699');
    });
});
