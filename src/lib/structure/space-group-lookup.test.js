import { lookupSpaceGroup, lookupSpaceGroupCandidates } from './space-group-lookup.js';

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
        expect(lookupSpaceGroup({ fullName: 'P 1 21/c 1' }).number).toBe(14);
    });

    test('uses Hall and universal H-M symbols to select the declared setting', () => {
        const standard = lookupSpaceGroup({ number: 14 });
        const uniqueAxisC = lookupSpaceGroup({ number: 14, hall: '-P 2ac' });

        expect(standard.hall_symbol).toBe('-P 2ybc');
        expect(standard.operations).toEqual([
            'x,y,z',
            '-x,y+1/2,-z+1/2',
            '-x,-y,-z',
            'x,-y+1/2,z+1/2',
        ]);
        expect(uniqueAxisC.universal_h_m).toBe('P 1 1 21/a');
        expect(uniqueAxisC.operations[1]).toBe('-x+1/2,-y,z+1/2');
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
        expect(lookupSpaceGroup({ number: '14garbage' })).toBeNull();
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

    test('exposes all candidates when a name does not determine one setting', () => {
        const candidates = lookupSpaceGroupCandidates('P n n n');

        expect(candidates.length).toBeGreaterThan(1);
        expect(new Set(candidates.map(entry => entry.hall_symbol)).size).toBeGreaterThan(1);
    });

    test('recognizes a Hall declaration as one operation set', () => {
        const candidates = lookupSpaceGroupCandidates('-P 2ac');

        expect(new Set(candidates.map(entry => entry.operations.join(';'))).size).toBe(1);
    });
});
