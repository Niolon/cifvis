import { lookupSpaceGroup } from './space-group-lookup.js';

describe('lookupSpaceGroup', () => {
    test('looks up by number', () => {
        const entry = lookupSpaceGroup({ number: 14 });
        expect(entry.symbol_hm_short).toBe('P21/c');
        expect(entry.operations).toHaveLength(4);
    });

    test('accepts a numeric string number', () => {
        expect(lookupSpaceGroup({ number: '62' }).symbol_hm_short).toBe('Pnma');
    });

    test('looks up by name in various spellings', () => {
        expect(lookupSpaceGroup({ name: 'P 21/c' }).number).toBe(14);
        expect(lookupSpaceGroup({ name: 'P21/c' }).number).toBe(14);
        expect(lookupSpaceGroup({ name: 'p21/C' }).number).toBe(14);
    });

    test('prefers number over name when both are given', () => {
        expect(lookupSpaceGroup({ number: 14, name: 'P n m a' }).number).toBe(14);
    });

    test('falls back to name when number is missing or invalid', () => {
        expect(lookupSpaceGroup({ number: 0, name: 'Pnma' }).number).toBe(62);
        expect(lookupSpaceGroup({ number: undefined, name: 'Pnma' }).number).toBe(62);
    });

    test('returns null for unknown groups and the Unknown sentinel', () => {
        expect(lookupSpaceGroup({ number: 231 })).toBeNull();
        expect(lookupSpaceGroup({ name: 'Not a group' })).toBeNull();
        expect(lookupSpaceGroup({ name: 'Unknown' })).toBeNull();
        expect(lookupSpaceGroup({})).toBeNull();
    });

    test('resolves every one of the 230 space group numbers', () => {
        for (let number = 1; number <= 230; number++) {
            const entry = lookupSpaceGroup({ number });
            expect(entry).not.toBeNull();
            expect(entry.operations.length).toBeGreaterThan(0);
        }
    });
});
