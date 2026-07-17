import { describe, expect, it } from 'vitest';
import {
    classifyPlaygroundCif,
    hasSupportedReflectionData,
} from './playground-cif-routing.js';

describe('playground CIF routing', () => {
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
