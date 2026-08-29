import { Atom, UnitCell } from './crystal.js';
import { CartPosition } from './position.js';
import { formatMeasurement, measureAtoms, measurementAction } from './measurements.js';

const cell = new UnitCell(10, 10, 10, 90, 90, 90);
const atom = (label, x, y, z) => new Atom(label, 'C', new CartPosition(x, y, z));

describe('measureAtoms', () => {
    test('measures a two-atom distance', () => {
        const result = measureAtoms([atom('A', 0, 0, 0), atom('B', 3, 4, 0)], cell);
        expect(result).toMatchObject({ type: 'distance', value: 5, unit: 'Å', labels: ['A', 'B'] });
        expect(formatMeasurement(result)).toBe('Distance A–B: 5.000 Å');
    });

    test('measures a three-atom angle at the middle atom', () => {
        const result = measureAtoms([
            atom('A', 1, 0, 0), atom('B', 0, 0, 0), atom('C', 0, 1, 0),
        ], cell);
        expect(result.type).toBe('angle');
        expect(result.value).toBeCloseTo(90);
    });

    test('measures an ordered four-atom torsion', () => {
        const result = measureAtoms([
            atom('A', 1, 0, 0), atom('B', 0, 0, 0),
            atom('C', 0, 1, 0), atom('D', 0, 1, 1),
        ], cell);
        expect(result.type).toBe('torsion');
        expect(result.value).toBeCloseTo(-90);
    });

    test('measures the last atom from the mean plane of the preceding atoms', () => {
        const result = measureAtoms([
            atom('A', -1, -1, 0), atom('B', 1, -1, 0),
            atom('C', 1, 1, 0), atom('D', -1, 1, 0), atom('E', 0, 0, 2),
        ], cell);
        expect(result).toMatchObject({
            type: 'plane-distance', value: 2, probeLabel: 'E', planeLabels: ['A', 'B', 'C', 'D'],
        });
    });

    test('rejects degenerate measurements', () => {
        expect(() => measureAtoms([atom('A', 0, 0, 0)], cell)).toThrow('at least two');
        expect(() => measureAtoms([
            atom('A', 0, 0, 0), atom('B', 1, 0, 0), atom('C', 2, 0, 0),
            atom('D', 3, 0, 0), atom('E', 0, 1, 0),
        ], cell)).toThrow('collinear');
    });
});

describe('measurementAction', () => {
    test.each([
        [1, false, '↔'], [2, true, '↔'], [3, true, '∠'],
        [4, true, '∡'], [5, true, '⏥'], [12, true, '⏥'],
    ])('maps %i selected atoms to its context action', (count, enabled, symbol) => {
        expect(measurementAction(count)).toMatchObject({ enabled, symbol });
    });

    test('describes the two-atom action as a distance', () => {
        expect(measurementAction(2).title).toBe('Measure distance');
    });
});
