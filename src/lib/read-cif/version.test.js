import { describe, expect, test } from 'vitest';
import { detectCifVersion, stripBom } from './version.js';

describe('stripBom', () => {
    test('removes a single leading BOM', () => {
        expect(stripBom('﻿data_x')).toBe('data_x');
    });

    test('leaves content without a BOM unchanged', () => {
        expect(stripBom('data_x')).toBe('data_x');
    });

    test('only strips a leading BOM, not later ones', () => {
        expect(stripBom('a﻿b')).toBe('a﻿b');
    });
});

describe('detectCifVersion', () => {
    test('detects CIF2 from the magic code', () => {
        expect(detectCifVersion('#\\#CIF_2.0\ndata_x')).toBe(2);
    });

    test('treats the CIF1.1 magic code as CIF1', () => {
        expect(detectCifVersion('#\\#CIF_1.1\ndata_x')).toBe(1);
    });

    test('treats a file with no magic code as CIF1', () => {
        expect(detectCifVersion('data_x\n_cell_length_a 1.0')).toBe(1);
    });

    test('detects CIF2 even with a leading BOM', () => {
        expect(detectCifVersion('﻿#\\#CIF_2.0\ndata_x')).toBe(2);
    });

    test('detects CIF2 when the magic code has no trailing newline', () => {
        expect(detectCifVersion('#\\#CIF_2.0')).toBe(2);
    });

    test('does not treat the magic code as CIF2 when it is not at the start', () => {
        expect(detectCifVersion('data_x\n#\\#CIF_2.0')).toBe(1);
    });
});
