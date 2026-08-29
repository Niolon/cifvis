import { describe, expect, test } from 'vitest';
import {
    clearFftPlanCache,
    createMixedRadixPlan,
    getFftPlan,
    mixedRadixFftLine,
    radix2FftLine,
    resolveAxisKernel,
} from './fft.js';
import {
    fractionalDenominator,
    nextSmooth235,
    planCompatibleDimensions,
} from './fft-grid.js';

/**
 * @param {number[]} values - Real input samples.
 * @returns {Array<{real:number, imaginary:number}>} Direct complex transform.
 */
function directDft(values) {
    return values.map((_, frequency) => values.reduce((sum, value, sample) => {
        const angle = -2 * Math.PI * frequency * sample / values.length;
        return {
            real: sum.real + value * Math.cos(angle),
            imaginary: sum.imaginary + value * Math.sin(angle),
        };
    }, { real: 0, imaginary: 0 }));
}

describe('mixed-radix FFT and grid planning', () => {
    test.each([2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 25])(
        'matches direct DFT for length %i',
        length => {
            const source = Array.from({ length }, (_, index) => Math.sin(index * 0.7) + index * 0.03);
            const real = Float64Array.from(source);
            const imaginary = new Float64Array(length);
            mixedRadixFftLine(real, imaginary, createMixedRadixPlan(length));
            directDft(source).forEach((expected, index) => {
                expect(real[index]).toBeCloseTo(expected.real, 10);
                expect(imaginary[index]).toBeCloseTo(expected.imaginary, 10);
            });
        },
    );

    test('matches the legacy radix-2 transform', () => {
        const mixedReal = Float64Array.from([1, 2, 4, 8, 3, 5, 7, 9]);
        const mixedImaginary = new Float64Array(8);
        const legacyReal = mixedReal.slice();
        const legacyImaginary = mixedImaginary.slice();
        mixedRadixFftLine(mixedReal, mixedImaginary, createMixedRadixPlan(8));
        radix2FftLine(legacyReal, legacyImaginary);
        expect([...mixedReal]).toEqual(expect.arrayContaining(
            [...legacyReal].map(value => expect.closeTo(value, 10)),
        ));
        mixedImaginary.forEach((value, index) =>
            expect(value).toBeCloseTo(legacyImaginary[index], 10));
    });

    test('selects and caches specialized plans independently for each axis length', () => {
        clearFftPlanCache();
        expect(resolveAxisKernel(64, 'auto')).toBe('radix-2');
        expect(resolveAxisKernel(72, 'auto')).toBe('mixed-radix');
        expect(getFftPlan(64, 'auto')).toMatchObject({
            kernel: 'radix-2',
            cacheHit: false,
        });
        expect(getFftPlan(64, 'auto')).toMatchObject({
            kernel: 'radix-2',
            cacheHit: true,
            setupTimeMs: 0,
        });
        expect(getFftPlan(72, 'auto')).toMatchObject({
            kernel: 'mixed-radix',
            cacheHit: false,
        });
    });

    test('chooses smooth dimensions commensurate with screw translations', () => {
        const plan = planCompatibleDimensions([65, 70, 31], [{
            rotation: [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
            translation: [0, 0, 0.25],
        }]);
        expect(plan.dimensions).toEqual([72, 72, 32]);
        expect(plan.symmetryCompatible).toBe(true);
        expect(nextSmooth235(130)).toBe(135);
        expect(fractionalDenominator(1 / 6)).toBe(6);
    });

    test('reports an incompatible non-crystallographic translation without grid inflation', () => {
        const plan = planCompatibleDimensions([20, 20, 20], [{
            rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            translation: [1 / 13, 0, 0],
        }]);
        expect(plan.symmetryCompatible).toBe(false);
        expect(plan.fallbackReason).toContain('non-crystallographic-translation');
    });
});
