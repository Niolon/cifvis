import { describe, expect, it } from 'vitest';
import {
    classifyPlaygroundCif,
    externalCifFetchErrorMessage,
    hasSupportedReflectionData,
    resolvePlaygroundFromUrl,
} from './playground-cif-routing.js';

describe('playground CIF routing', () => {
    it('resolves an encoded external CIF URL and derives its filename', () => {
        const source = 'https://example.org/structures/my structure.cif?download=1';
        const result = resolvePlaygroundFromUrl(
            `?from-url=${encodeURIComponent(source)}`,
            'https://niolon.github.io/cifvis/',
        );

        expect(result).toEqual({
            url: 'https://example.org/structures/my%20structure.cif?download=1',
            fileName: 'my structure.cif',
        });
    });

    it('resolves relative CIF sources against the playground URL', () => {
        expect(resolvePlaygroundFromUrl(
            '?from-url=examples/sample.cif',
            'https://example.org/playground/',
        )).toEqual({
            url: 'https://example.org/playground/examples/sample.cif',
            fileName: 'sample.cif',
        });
    });

    it('returns null without from-url and rejects non-web protocols', () => {
        expect(resolvePlaygroundFromUrl('?unrelated=yes', 'https://example.org/')).toBeNull();
        expect(() => resolvePlaygroundFromUrl(
            '?from-url=file%3A%2F%2F%2Ftmp%2Fstructure.cif',
            'https://example.org/',
        )).toThrow('must use HTTP or HTTPS');
    });

    it('clearly signposts likely CORS failures for cross-origin sources', () => {
        const message = externalCifFetchErrorMessage({
            url: 'https://crystallography.net/cod/1100509.cif',
            fileName: '1100509.cif',
        }, 'http://localhost:5173/');

        expect(message).toContain('crystallography.net');
        expect(message).toContain('cross-origin');
        expect(message).toContain('CORS');
        expect(message).toContain('Access-Control-Allow-Origin');
        expect(message).toContain('Upload button');
    });

    it('does not blame CORS for a same-origin fetch failure', () => {
        const message = externalCifFetchErrorMessage({
            url: 'http://localhost:5173/cif/missing.cif',
            fileName: 'missing.cif',
        }, 'http://localhost:5173/');

        expect(message).toContain('Check that the URL is reachable');
        expect(message).not.toContain('CORS');
    });

    it('recognises a coordinate CIF as a structure load', () => {
        const cif = `data_structure
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 0.1 0.2 0.3
`;

        expect(classifyPlaygroundCif(cif)).toEqual({
            blockCount: 1,
            coordinateBlock: 0,
            reflectionBlock: null,
        });
    });

    it('routes a reflection-only FCF to the active structure', () => {
        const fcf = `data_reflections
loop_
_refln_index_h
_refln_index_k
_refln_index_l
_refln_F_squared_meas
1 0 0 12.0
`;

        expect(classifyPlaygroundCif(fcf)).toEqual({
            blockCount: 1,
            coordinateBlock: null,
            reflectionBlock: 0,
        });
        expect(hasSupportedReflectionData(fcf)).toBe(true);
    });

    it('does not mistake atom scattering metadata for coordinates', () => {
        const fcf = `data_reflections
_atom_type_scat_dispersion_real 0.003
_shelx_hkl_file
;
   1   0   0   10.00    1.00   1
;
`;

        expect(classifyPlaygroundCif(fcf).coordinateBlock).toBeNull();
        expect(classifyPlaygroundCif(fcf).reflectionBlock).toBe(0);
    });

    it('selects coordinate and reflection data independently across blocks', () => {
        const cif = `data_metadata
_audit_creation_method test

data_reflections
_iucr_refine_fcf_details 'LIST 4'

data_structure
_atom_site.Cartn_x 1.0
`;

        expect(classifyPlaygroundCif(cif)).toEqual({
            blockCount: 3,
            coordinateBlock: 2,
            reflectionBlock: 1,
        });
    });
});
