import { create, all } from 'mathjs';

import { UIsoADP, UAnisoADP, ADPFactory } from './adp.js';
import { UnitCell } from './crystal.js';
import { CIF } from '../read-cif/base.js';

const math = create(all);

describe('ADPs', () => {
    test('UIsoADP stores single parameter', () => {
        const adp = new UIsoADP(0.05);
        expect(adp.uiso).toBe(0.05);
    });

    test('UIsoADP creates from Biso value', () => {
        const biso = 5.0;
        const adp = UIsoADP.fromBiso(biso);
        expect(adp.uiso).toBeCloseTo(biso / (8 * Math.PI * Math.PI));
    });

    test('UAnisoAdpcreates from Bani values', () => {
        const b11 = 5.0;
        const b22 = 6.0;
        const b33 = 7.0;
        const b12 = 0.5;
        const b13 = 0.6;
        const b23 = 0.7;

        const adp = UAnisoADP.fromBani(b11, b22, b33, b12, b13, b23);

        const factor = 1 / (8 * Math.PI * Math.PI);
        expect(adp.u11).toBeCloseTo(b11 * factor);
        expect(adp.u22).toBeCloseTo(b22 * factor);
        expect(adp.u33).toBeCloseTo(b33 * factor);
        expect(adp.u12).toBeCloseTo(b12 * factor);
        expect(adp.u13).toBeCloseTo(b13 * factor);
        expect(adp.u23).toBeCloseTo(b23 * factor);
    });

    test('UAnisoADP calculates cartesian parameters', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const adp = new UAnisoADP(0.05, 0.05, 0.05, 0, 0, 0);
        const cartParams = adp.getUCart(cell);
    
        expect(cartParams).toHaveLength(6);
        expect(cartParams[0]).toBeCloseTo(0.05);
    });

    describe('UAnisoADP getEllipsoidMatrix', () => {
        let mockUnitCell;
    
        beforeEach(() => {
            mockUnitCell = {
                fractToCartMatrix: math.matrix([
                    [10, 0, 0],
                    [0, 10, 0],
                    [0, 0, 10],
                ]),
            };
        });

        test('handles symmetric ADP matrix', () => {
            const adp = new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
            //const rowMagnitudes = [];
            for (let i = 0; i < 3; i++) {
                const row = [
                    matrix.get([i, 0]),
                    matrix.get([i, 1]),
                    matrix.get([i, 2]),
                ];
                // Each row should have two zeros and one value abs(sqrt(0.01))
                expect(row.filter(v => Math.abs(v) < 1e-10)).toHaveLength(2);
                expect(Math.max(...row.map(Math.abs))).toBeCloseTo(0.1, 5);
            }
        });

        test('normalizes eigenvectors when determinant ≠ 1', () => {
            const adp = new UAnisoADP(0.02, 0.01, 0.03, 0.005, 0.008, 0.002);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
            const det = math.det(matrix);
      
            expect(det).toBeGreaterThan(0.0);

            const mockUnitCell2 = {
                fractToCartMatrix: math.matrix([
                    [0, 0, 10],
                    [0, 10, 0],
                    [10, 0, 0],
                ]),
            };
            const matrix2 = adp.getEllipsoidMatrix(mockUnitCell2);
            const det2 = math.det(matrix2);
      
            expect(det2).toBeGreaterThan(0.0);
        });

        test('transforms diagonal ADPs correctly', () => {
            const adp = new UAnisoADP(0.01, 0.02, 0.03, 0, 0, 0);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
      
            // For diagonal ADPs, each row should have exactly one non-zero value
            // equal to sqrt(Uii), with the other two values being zero
            const expectedValues = [0.1, Math.sqrt(0.02), Math.sqrt(0.03)];
      
            // Count occurrences of each expected value in matrix rows
            const rowMagnitudes = [];
            for (let i = 0; i < 3; i++) {
                const row = [
                    matrix.get([i, 0]),
                    matrix.get([i, 1]),
                    matrix.get([i, 2]),
                ];
                // Each row should have two zeros and one value from expectedValues
                expect(row.filter(v => Math.abs(v) < 1e-10)).toHaveLength(2);
                rowMagnitudes.push(Math.max(...row.map(Math.abs)));
            }
      
            // Check that each expected value appears exactly once
            expectedValues.forEach(expected => {
                expect(rowMagnitudes.filter(v => Math.abs(v - expected) < 1e-10)).toHaveLength(1);
            });
        });
    });
});

describe('ADPFactory', () => {
    describe('explicit type handling', () => {
        test('respects explicit Uani type when valid', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
C1 C 0 0 0 Uani

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
C1 0.01 0.02 0.03 0 0 0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UAnisoADP);
            expect(adp.u11).toBe(0.01);
        });

        test('throw error if  explicit type data not available', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
_atom_site_U_iso_or_equiv
C1 C 0 0 0 Uani 0.02
`;
            const cif = new CIF(cifText);
            expect(() => ADPFactory.fromCIF(cif.getBlock(0), 0)).toThrow(
                'Atom C1 had ADP type UAni, but no atom_site_aniso loop was found',
            );
        });

        test('handles missing adp_type', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 C 0 0 0 0.02
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UIsoADP);
            expect(adp.uiso).toBe(0.02);
        });
    });

    describe('anisotropic inference', () => {
        test('prefers Uani over Bani when both present', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
_atom_site_aniso_B_11
_atom_site_aniso_B_22
_atom_site_aniso_B_33
_atom_site_aniso_B_12
_atom_site_aniso_B_13
_atom_site_aniso_B_23
C1 0.01 0.02 0.03 0 0 0 1 1 1 0 0 0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UAnisoADP);
            expect(adp.u11).toBe(0.01);
        });

        test('falls back to Bani when Uani incomplete', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_B_11
_atom_site_aniso_B_22
_atom_site_aniso_B_33
_atom_site_aniso_B_12
_atom_site_aniso_B_13
_atom_site_aniso_B_23
C1 0.01 1 1 1 0 0 0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UAnisoADP);
            const expectedU = 1 / (8 * Math.PI * Math.PI);
            expect(adp.u11).toBeCloseTo(expectedU);
        });

        test('handles missing anisotropic data gracefully', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 C 0 0 0 0.02

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
C2 0.01
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UIsoADP);
            expect(adp.uiso).toBe(0.02);
        });
    });

    describe('isotropic inference', () => {
        test('prefers Uiso over Biso when both present', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
_atom_site_B_iso_or_equiv
C1 C 0 0 0 0.02 1.0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UIsoADP);
            expect(adp.uiso).toBe(0.02);
        });

        test('falls back to Biso when Uiso not present', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_B_iso_or_equiv
C1 C 0 0 0 1.0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeInstanceOf(UIsoADP);
            const expectedU = 1.0 / (8 * Math.PI * Math.PI);
            expect(adp.uiso).toBeCloseTo(expectedU);
        });
    });

    describe('error handling', () => {
        test('handles NaN values in atomic parameters', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 C 0 0 0 ?
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeNull();
        });

        test('handles NaN values in anisotropic data', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
C1 0.01 ? 0.03 0 0 0
`;
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeNull();
        });

        test('returns null if adp_type not known', () => {
            const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
C1 C 0 0 0 custom
`; 
            const cif = new CIF(cifText);
            const adp = ADPFactory.fromCIF(cif.getBlock(0), 0);
            
            expect(adp).toBeNull();
        });
    });
});