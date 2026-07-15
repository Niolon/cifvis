import { COVALENT_RADII, S_BLOCK_ELEMENTS, FALLBACK_RADII } from './covalent-radii.js';

describe('COVALENT_RADII', () => {
    test('matches spot-checked values from Cordero et al. (2008)', () => {
        expect(COVALENT_RADII.H).toBeCloseTo(0.31);
        expect(COVALENT_RADII.C).toBeCloseTo(0.76);
        expect(COVALENT_RADII.N).toBeCloseTo(0.71);
        expect(COVALENT_RADII.O).toBeCloseTo(0.66);
        expect(COVALENT_RADII.Ba).toBeCloseTo(2.15);
        expect(COVALENT_RADII.Pt).toBeCloseTo(1.36);
        expect(COVALENT_RADII.U).toBeCloseTo(1.96);
        expect(COVALENT_RADII.Fe).toBeCloseTo(1.32); // low-spin default
        expect(COVALENT_RADII.Mn).toBeCloseTo(1.39); // low-spin default
        expect(COVALENT_RADII.Co).toBeCloseTo(1.26); // low-spin default
    });

    test('covers elements up to Cm (Z=96)', () => {
        expect(COVALENT_RADII.Cm).toBeCloseTo(1.69);
    });
});

describe('S_BLOCK_ELEMENTS', () => {
    test('includes alkali and alkaline-earth metals', () => {
        expect(S_BLOCK_ELEMENTS.has('Na')).toBe(true);
        expect(S_BLOCK_ELEMENTS.has('Ba')).toBe(true);
    });

    test('excludes hydrogen and non-s-block elements', () => {
        expect(S_BLOCK_ELEMENTS.has('H')).toBe(false);
        expect(S_BLOCK_ELEMENTS.has('C')).toBe(false);
        expect(S_BLOCK_ELEMENTS.has('Fe')).toBe(false);
    });
});

describe('FALLBACK_RADII', () => {
    test('covers elements beyond Cordero et al.\'s Z=1-96 coverage', () => {
        expect(FALLBACK_RADII.Bk).toBeCloseTo(1.65);
        expect(FALLBACK_RADII.Cf).toBeCloseTo(1.81);
    });

    test('does not overlap with COVALENT_RADII', () => {
        for (const element of Object.keys(FALLBACK_RADII)) {
            expect(COVALENT_RADII[element]).toBeUndefined();
        }
    });
});
