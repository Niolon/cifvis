import { createSymAtomLabel } from './util.js';

test('createSymAtomLabel correctly formats labels', () => {
    expect(createSymAtomLabel('C1', '1_555')).toBe('C1@1_555');
    expect(createSymAtomLabel('O12', '2_654')).toBe('O12@2_654');
});