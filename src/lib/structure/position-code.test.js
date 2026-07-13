import {
    decodePositionCode,
    encodePositionCode,
    normalizeSiteSymmetry,
} from './position-code.js';

describe('position-code', () => {
    test('normalizes bare and missing site-symmetry values', () => {
        expect(normalizeSiteSymmetry(2)).toBe('2_555');
        expect(normalizeSiteSymmetry('2')).toBe('2_555');
        expect(normalizeSiteSymmetry('2_655')).toBe('2_655');
        expect(normalizeSiteSymmetry('?')).toBe('.');
        expect(normalizeSiteSymmetry('.')).toBe('.');
    });

    test('round-trips conventional position codes', () => {
        expect(decodePositionCode('2_674')).toEqual({
            id: '2',
            translation: [1, 2, -1],
        });
        expect(encodePositionCode('2', [1, 2, -1])).toBe('2_674');
    });

    test('round-trips translations outside the conventional range', () => {
        const code = encodePositionCode('3', [-6, 1, 12]);
        expect(code).toBe('3_[-6,1,12]');
        expect(decodePositionCode(code)).toEqual({
            id: '3',
            translation: [-6, 1, 12],
        });
    });

    test('rejects malformed conventional codes instead of producing NaN', () => {
        expect(() => decodePositionCode('2_;55')).toThrow('Invalid symmetry position code');
        expect(() => decodePositionCode('3_NaN11')).toThrow('Invalid symmetry position code');
    });
});
