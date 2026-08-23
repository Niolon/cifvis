import { det } from '../math-lite.js';
import {
    UIsoADP,
    UAnisoADP,
    ADPFactory,
    createRMSDPeanutSurface,
    ellipsoidProbabilityScale,
    getADPPrincipalFrame,
} from './adp.js';
import { UnitCell } from './crystal.js';
import { CIF } from '../read-cif/base.js';

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
                fractToCartMatrix: [
                    [10, 0, 0],
                    [0, 10, 0],
                    [0, 0, 10],
                ],
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
            const matrixDet = det(matrix);

            expect(matrixDet).toBeGreaterThan(0.0);

            const mockUnitCell2 = {
                fractToCartMatrix: [
                    [0, 0, 10],
                    [0, 10, 0],
                    [10, 0, 0],
                ],
            };
            const matrix2 = adp.getEllipsoidMatrix(mockUnitCell2);
            const matrixDet2 = det(matrix2);

            expect(matrixDet2).toBeGreaterThan(0.0);
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

    describe('RMSD PEANUT surface', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);

        test.each([
            [[1, 1, 1], 'isotropic'],
            [[4, 1, 1], 'prolate'],
            [[16, 1, 1], 'strongly prolate'],
            [[4, 4, 1], 'oblate'],
            [[9, 4, 1], 'triaxial'],
        ])('decomposes the %s synthetic tensor', ([u11, u22, u33]) => {
            const adp = new UAnisoADP(u11, u22, u33, 0, 0, 0);
            const frame = getADPPrincipalFrame(adp, cell);

            expect(frame.valid).toBe(true);
            expect(frame.eigenvalues).toEqual([...frame.eigenvalues].sort((a, b) => b - a));
            expect(det(frame.rotation)).toBeCloseTo(1, 10);
            frame.rotation.forEach(row => row.forEach(value => expect(Number.isFinite(value)).toBe(true)));
        });

        test('uses analytic directional RMSD radii and bounds every direction', () => {
            const scale = ellipsoidProbabilityScale(0.5);
            const surface = createRMSDPeanutSurface(
                new UAnisoADP(0.09, 0.04, 0.01, 0, 0, 0),
                cell,
                scale,
            );

            expect(surface.valid).toBe(true);
            expect(surface.surfaceDistanceAlong([1, 0, 0])).toBeCloseTo(scale * 0.3, 10);
            expect(surface.surfaceDistanceAlong([0, 1, 0])).toBeCloseTo(scale * 0.2, 10);
            expect(surface.surfaceDistanceAlong([0, 0, 1])).toBeCloseTo(scale * 0.1, 10);
            expect(surface.surfaceDistanceAlong([1, 1, 1])).toBeLessThanOrEqual(
                surface.boundingRadius,
            );
        });

        test('matches ellipsoid principal extents at the default independent scale', () => {
            const scale = ellipsoidProbabilityScale(0.5);
            const adp = new UAnisoADP(0.09, 0.04, 0.01, 0, 0, 0);
            const surface = createRMSDPeanutSurface(adp, cell, scale);
            const ellipsoid = adp.getEllipsoidMatrix(cell).toArray();
            const ellipsoidColumnLengths = [0, 1, 2].map(column => Math.hypot(
                ellipsoid[0][column], ellipsoid[1][column], ellipsoid[2][column],
            ) * scale);

            expect(surface.eigenvalues.map(value => scale * Math.sqrt(value)))
                .toEqual(ellipsoidColumnLengths);
        });

        test('matches the shader radial formula and exact normal against finite differences', () => {
            const surface = createRMSDPeanutSurface(
                new UAnisoADP(0.09, 0.04, 0.01, 0, 0, 0), cell, 1.5,
            );
            const direction = [0.6, 0.7, Math.sqrt(0.15)];
            const shape = surface.normalizedShape;
            const shaderQ = shape.reduce(
                (sum, value, index) => sum + value * direction[index] ** 2,
                0,
            );
            expect(surface.localRadialScale(direction)).toBeCloseTo(Math.sqrt(shaderQ), 12);

            const point = candidate => {
                const length = Math.hypot(...candidate);
                const n = candidate.map(value => value / length);
                const radial = surface.localRadialScale(n);
                return n.map(value => value * radial);
            };
            const epsilon = 1e-6;
            const before = point([direction[0] - epsilon, direction[1], direction[2]]);
            const after = point([direction[0] + epsilon, direction[1], direction[2]]);
            const tangent = after.map((value, index) => value - before[index]);
            const normal = surface.localNormal(direction);
            const normalDotTangent = normal.reduce(
                (sum, value, index) => sum + value * tangent[index],
                0,
            );
            expect(normalDotTangent).toBeCloseTo(0, 10);
        });

        test('rejects non-positive and effectively zero principal values', () => {
            expect(createRMSDPeanutSurface(
                new UAnisoADP(0.02, 0.01, -0.001, 0, 0, 0), cell, 1.5,
            ).valid).toBe(false);
            expect(createRMSDPeanutSurface(
                new UAnisoADP(1, 0.5, 1e-13, 0, 0, 0), cell, 1.5,
            ).valid).toBe(false);
            expect(createRMSDPeanutSurface(
                new UAnisoADP(1, 0.5, 0.25, 0, 0, 0), cell, 0,
            ).valid).toBe(false);
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

describe('ellipsoidProbabilityScale', () => {
    test('matches the conventional 50% probability ellipsoid scale factor', () => {
        expect(ellipsoidProbabilityScale(0.5)).toBeCloseTo(1.5382, 3);
    });

    test('increases monotonically with probability', () => {
        const low = ellipsoidProbabilityScale(0.3);
        const mid = ellipsoidProbabilityScale(0.5);
        const high = ellipsoidProbabilityScale(0.9);
        const veryHigh = ellipsoidProbabilityScale(0.99);

        expect(low).toBeLessThan(mid);
        expect(mid).toBeLessThan(high);
        expect(high).toBeLessThan(veryHigh);
    });

    test('rejects probabilities outside (0, 1)', () => {
        expect(() => ellipsoidProbabilityScale(0)).toThrow('between 0 and 1');
        expect(() => ellipsoidProbabilityScale(1)).toThrow('between 0 and 1');
        expect(() => ellipsoidProbabilityScale(-0.1)).toThrow('between 0 and 1');
        expect(() => ellipsoidProbabilityScale(NaN)).toThrow('between 0 and 1');
    });
});
