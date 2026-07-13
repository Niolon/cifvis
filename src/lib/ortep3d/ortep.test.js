import * as THREE from 'three';
import {
    ORTEP3JsStructure, GeometryMaterialCache, getThreeEllipsoidMatrix, calcBondTransform,
    ORTEPObject, ORTEPGroupObject, ORTEPHBond, ORTEPAtom, ORTEPAniAtom, ORTEPIsoAtom, ORTEPConstantAtom,
    ORTEPBond, create2DPlotHatchMaterial, createCutawayPlaneMaterial,
    trimBondToAtomSurfaces,
} from './ortep.js';
import { Atom, CrystalStructure, UnitCell } from '../structure/crystal.js';
import { Bond, HBond } from '../structure/bonds.js';
import { FractPosition } from '../structure/position.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import defaultSettings from './structure-settings.js';
import { create, all } from 'mathjs';

const math = create(all);

describe('Transformation Functions', () => {
    describe('getThreeEllipsoidMatrix', () => {
        test('correctly converts mathjs matrix to THREE.Matrix4', () => {
            const mockUAnisoADP = {
                getEllipsoidMatrix: vi.fn().mockReturnValue(math.matrix([
                    [0.1, 0.2, 0.3],
                    [0.4, 0.5, 0.6],
                    [0.7, 0.8, 0.9],
                ])),
            };

            const matrix = getThreeEllipsoidMatrix(mockUAnisoADP, {});

            expect(matrix).toBeInstanceOf(THREE.Matrix4);
            expect(matrix.elements).toEqual([
                0.1, 0.4, 0.7, 0,
                0.2, 0.5, 0.8, 0,
                0.3, 0.6, 0.9, 0,
                0, 0, 0, 1,
            ]);
        });
    });

    describe('calcBondTransform', () => {
        test('creates correct transformation for vertical bond', () => {
            const pos1 = new THREE.Vector3(0, -1, 0);
            const pos2 = new THREE.Vector3(0, 1, 0);

            const matrix = calcBondTransform(pos1, pos2);

            expect(new THREE.Vector3(1, 0, 0).applyMatrix4(matrix).length()).toBeCloseTo(1);
            expect(new THREE.Vector3(0, 1, 0).applyMatrix4(matrix).length()).toBeCloseTo(2);
            expect(new THREE.Vector3(0, 0, 1).applyMatrix4(matrix).length()).toBeCloseTo(1);

            // Check position (should be at midpoint)
            expect(matrix.elements[12]).toBeCloseTo(0); // x
            expect(matrix.elements[13]).toBeCloseTo(0); // y
            expect(matrix.elements[14]).toBeCloseTo(0); // z
        });

        test('creates correct transformation for vertical bond not centred on zero', () => {
            const pos1 = new THREE.Vector3(0, 0, 0);
            const pos2 = new THREE.Vector3(0, 2, 0);

            const matrix = calcBondTransform(pos1, pos2);

            expect(new THREE.Vector3(1, 0, 0).applyMatrix4(matrix).length()).toBeCloseTo(Math.sqrt(2));
            expect(new THREE.Vector3(0, 1, 0).applyMatrix4(matrix).length()).toBeCloseTo(3);
            expect(new THREE.Vector3(0, 0, 1).applyMatrix4(matrix).length()).toBeCloseTo(Math.sqrt(2));

            // Check position (should be at midpoint)
            expect(matrix.elements[12]).toBeCloseTo(0); // x
            expect(matrix.elements[13]).toBeCloseTo(1); // y
            expect(matrix.elements[14]).toBeCloseTo(0); // z
        });

        test('creates correct transformation for diagonal bond', () => {
            const pos1 = new THREE.Vector3(0.5, 0.5, 0.5);
            const pos2 = new THREE.Vector3(-0.5, -0.5, -0.5);

            const matrix = calcBondTransform(pos1, pos2);

            // Check length preservation
            const bondLength = pos1.distanceTo(pos2);
            const transformedLength = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix).length();
            expect(transformedLength).toBeCloseTo(bondLength);

            // Check midpoint position
            const expectedMidpoint = pos1.clone().add(pos2).multiplyScalar(0.5);
            expect(matrix.elements[12]).toBeCloseTo(expectedMidpoint.x);
            expect(matrix.elements[13]).toBeCloseTo(expectedMidpoint.y);
            expect(matrix.elements[14]).toBeCloseTo(expectedMidpoint.z);
        });

        test('handles zero-length bond gracefully', () => {
            const pos = new THREE.Vector3(1, 1, 1);
            expect(() => calcBondTransform(pos, pos.clone())).toThrow(
                'Error in ORTEP Bond Creation. Trying to create a zero length bond.',
            );
        });
    });

    describe('trimBondToAtomSurfaces', () => {
        test('moves each endpoint by its directional surface distance', () => {
            const start = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3(2, 0, 0);
            const atom1 = { getSurfaceDistanceAlong: vi.fn().mockReturnValue(0.25) };
            const atom2 = { getSurfaceDistanceAlong: vi.fn().mockReturnValue(0.5) };

            const [trimmedStart, trimmedEnd] = trimBondToAtomSurfaces(
                start, end, atom1, atom2,
            );

            expect(trimmedStart.toArray()).toEqual([0.25, 0, 0]);
            expect(trimmedEnd.toArray()).toEqual([1.5, 0, 0]);
            expect(start.toArray()).toEqual([0, 0, 0]);
            expect(end.toArray()).toEqual([2, 0, 0]);
        });

        test('leaves endpoints unchanged without rendered atoms', () => {
            const start = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3(1, 0, 0);

            const [trimmedStart, trimmedEnd] = trimBondToAtomSurfaces(
                start, end, null, null,
            );

            expect(trimmedStart.equals(start)).toBe(true);
            expect(trimmedEnd.equals(end)).toBe(true);
        });
    });
});

describe('GeometryMaterialCache', () => {
    let cache;

    beforeEach(() => {
        cache = new GeometryMaterialCache();
    });

    afterEach(() => {
        cache.dispose();
    });

    describe('initialization', () => {
        test('creates default geometries', () => {
            expect(cache.geometries.atom).toBeInstanceOf(THREE.BufferGeometry);
            expect(cache.geometries.adpRing).toBeInstanceOf(THREE.BufferGeometry);
            expect(cache.geometries.bond).toBeInstanceOf(THREE.BufferGeometry);
            expect(cache.geometries.hbond).toBeInstanceOf(THREE.BufferGeometry);
        });

        test('creates shared cutaway geometries when requested', () => {
            const cutawayCache = new GeometryMaterialCache({ atomEllipsoidStyle: 'cutout' });
            const [, , planeMaterial] = cutawayCache.getAtomMaterials('C');

            expect(cutawayCache.geometries.atomOctant).toBeInstanceOf(THREE.SphereGeometry);
            expect(cutawayCache.geometries.emptyAtom).toBeInstanceOf(THREE.BufferGeometry);
            expect(cutawayCache.geometries.cutawayPlanes).toBeInstanceOf(THREE.BufferGeometry);
            expect(planeMaterial.userData.cutawayStripes.width).toBe(0.5);

            cutawayCache.dispose();
        });

        test('aligns each cutaway plane stripe direction to a different principal axis', () => {
            const cutawayCache = new GeometryMaterialCache({ atomEllipsoidStyle: 'cutout' });
            const geometry = cutawayCache.geometries.cutawayPlanes;
            const positions = geometry.getAttribute('position');
            const uv = geometry.getAttribute('uv');
            const planeVertexCount = positions.count / 3;
            const coordinateGetters = [
                index => positions.getX(index),
                index => positions.getY(index),
                index => positions.getZ(index),
            ];
            const stripeGradientAxes = [0, 1, 2].map(planeIndex => {
                const start = planeIndex * planeVertexCount;
                const end = start + planeVertexCount;
                const covariance = coordinateGetters.map(getCoordinate => {
                    let value = 0;
                    for (let index = start; index < end; index++) {
                        value += getCoordinate(index) * (uv.getY(index) - 0.5);
                    }
                    return Math.abs(value);
                });
                return covariance.indexOf(Math.max(...covariance));
            });

            // UV gradients Y, X and Z yield lines along principal axes X, Z and Y.
            expect(stripeGradientAxes).toEqual([1, 0, 2]);

            cutawayCache.dispose();
        });

        test('creates default materials', () => {
            expect(cache.materials.bond).toBeInstanceOf(THREE.Material);
            expect(cache.materials.hbond).toBeInstanceOf(THREE.Material);
            expect(cache.materials.bond.color).toBeDefined();
            expect(cache.materials.hbond.color).toBeDefined();
        });

        test('initializes with custom options', () => {
            const customOptions = {
                atomDetail: 4,
                bondRadius: 0.0001,
                bondColor: '#ff0000',
            };
            const customCache = new GeometryMaterialCache(customOptions);

            expect(customCache.options.atomDetail).toBe(4);
            expect(customCache.options.bondRadius).toBe(0.0001);
            expect(customCache.options.bondColor).toBe('#ff0000');

            // Should preserve default options not overridden
            expect(customCache.options.bondSections).toBe(defaultSettings.bondSections);
        });

        test('handles null or undefined options', () => {
            expect(() => new GeometryMaterialCache(null)).not.toThrow();
            expect(() => new GeometryMaterialCache(undefined)).not.toThrow();
        });
    });

    describe('element type validation', () => {
        test('validates known element types', () => {
            expect(() => cache.validateElementType('C')).not.toThrow();
            expect(() => cache.validateElementType('H')).not.toThrow();
            expect(() => cache.validateElementType('O')).not.toThrow();
        });

        test('throws error for unknown element types', () => {
            expect(() => cache.validateElementType('Xx')).toThrow('Unknown element type');
            expect(() => cache.validateElementType('')).toThrow('Unknown element type');
        });

        test('handles element validation with custom properties', () => {
            const customCache = new GeometryMaterialCache({
                elementProperties: {
                    'Custom': {
                        atomColor: '#ffffff',
                        ringColor: '#000000',
                    },
                },
            });

            expect(() => customCache.validateElementType('Custom')).not.toThrow();
        });
    });

    describe('material management', () => {
        test('creates and caches atom materials', () => {
            const [atomMaterial1, ringMaterial1] = cache.getAtomMaterials('C');
            const [atomMaterial2, ringMaterial2] = cache.getAtomMaterials('C');

            // Should return cached materials
            expect(atomMaterial1).toBe(atomMaterial2);
            expect(ringMaterial1).toBe(ringMaterial2);

            // Materials should have correct properties
            expect(atomMaterial1.color).toBeDefined();
            expect(ringMaterial1.color).toBeDefined();
        });

        test('creates different materials for different elements', () => {
            const [cAtomMaterial] = cache.getAtomMaterials('C');
            const [oAtomMaterial] = cache.getAtomMaterials('O');

            expect(cAtomMaterial).not.toBe(oAtomMaterial);
            expect(cAtomMaterial.color).not.toBe(oAtomMaterial.color);
        });

        test('applies correct material properties', () => {
            const [atomMaterial, ringMaterial] = cache.getAtomMaterials('C');

            expect(atomMaterial.roughness).toBe(cache.options.atomColorRoughness);
            expect(atomMaterial.metalness).toBe(cache.options.atomColorMetalness);
            expect(ringMaterial.roughness).toBe(cache.options.atomColorRoughness);
            expect(ringMaterial.metalness).toBe(cache.options.atomColorMetalness);
        });

        test('creates atom-coloured horizontal stripes for cutaway planes', () => {
            const material = createCutawayPlaneMaterial(
                { atomColor: '#ff0000', ringColor: '#ffffff' },
                {
                    atomColorRoughness: 0.4,
                    atomColorMetalness: 0.5,
                    atomCutawayStripeCount: 6,
                    atomCutawayStripeWidth: 0.2,
                },
            );
            const shader = {
                uniforms: {},
                vertexShader: '#include <uv_pars_vertex>\n#include <uv_vertex>',
                fragmentShader: '#include <common>\n#include <color_fragment>',
            };

            material.onBeforeCompile(shader);

            expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
            expect(material.color.getHexString()).toBe('ffffff');
            expect(material.userData.cutawayStripes.color.getHexString()).toBe('ff0000');
            expect(material.userData.cutawayStripes).toMatchObject({ count: 6, width: 0.2 });
            expect(shader.uniforms.cutawayStripeCount.value).toBe(6);
            expect(shader.uniforms.cutawayStripeHalfWidth.value).toBe(0.1);
            expect(shader.vertexShader).toContain('vCutawayUv = uv');
            expect(shader.fragmentShader).toContain('vCutawayUv.y * cutawayStripeCount');
            expect(shader.fragmentShader).toContain('fwidth(cutawayStripeCoordinate)');
            expect(shader.fragmentShader).not.toContain('fwidth(cutawayStripePhase)');
            expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix');

            material.dispose();
        });

        test('creates element-coloured materials for the 2D plot style', () => {
            const plotCache = new GeometryMaterialCache({ renderStyle: '2d' });
            const [carbon, carbonRing, carbonHatch] = plotCache.getAtomMaterials('C');
            const [oxygen, oxygenRing, oxygenHatch] = plotCache.getAtomMaterials('O');

            expect(carbon).toBeInstanceOf(THREE.MeshBasicMaterial);
            expect(carbon.color.getHexString()).toBe('ffffff');
            expect(oxygen.color.getHexString()).toBe('ffffff');
            expect(carbonRing.color.getHexString()).toBe('000000');
            expect(oxygenRing.color.getHexString()).toBe('ff0d0d');
            expect(carbonHatch.userData.plot2DHatch.color.getHexString()).toBe('000000');
            expect(oxygenHatch.userData.plot2DHatch.color.getHexString()).toBe('ff0d0d');
            expect(plotCache.materials.bond.color.getHexString()).toBe('000000');
            expect(plotCache.materials.openBond.color.getHexString()).toBe('ffffff');
            expect(plotCache.materials.openBond.transparent).toBe(false);
            expect(plotCache.materials.openBond.depthWrite).toBe(true);
            expect(plotCache.materials.openBondOutline.color.getHexString()).toBe('000000');
            expect(plotCache.materials.openBondOutline.side).toBe(THREE.BackSide);
            expect(plotCache.geometries.cutawayPlanes).toBeInstanceOf(THREE.BufferGeometry);

            plotCache.dispose();
        });

        test('injects antialiased stripes into the 2D hatch material', () => {
            const material = create2DPlotHatchMaterial(
                {
                    plot2DAtomColor: '#ffffff',
                    plot2DLineColor: '#000000',
                    plot2DStripeCount: 8,
                    plot2DStripeWidth: 0.25,
                },
                '#3050f8',
            );
            const shader = {
                uniforms: {},
                vertexShader: '#include <uv_pars_vertex>\n#include <uv_vertex>',
                fragmentShader: '#include <common>\n#include <color_fragment>',
            };

            material.onBeforeCompile(shader);

            expect(shader.uniforms.plot2DStripeColor.value.getHexString()).toBe('3050f8');
            expect(shader.uniforms.plot2DStripeCount.value).toBe(8);
            expect(shader.uniforms.plot2DStripeHalfWidth.value).toBe(0.125);
            expect(shader.vertexShader).toContain('vPlot2DUv = uv');
            expect(shader.fragmentShader).toContain('vPlot2DUv.y * plot2DStripeCount');
            expect(shader.fragmentShader).toContain('fwidth(plot2DStripeCoordinate)');
            expect(shader.fragmentShader).not.toContain('fwidth(plot2DStripePhase)');

            material.dispose();
        });
    });

    describe('ADP ring geometry', () => {
        test('creates valid ADP ring geometry', () => {
            const ring = cache.createADPHalfTorus();

            expect(ring).toBeInstanceOf(THREE.BufferGeometry);
            expect(ring.attributes.position).toBeDefined();
            expect(ring.attributes.normal).toBeDefined();
            expect(ring.index).toBeDefined();
        });

        test('ADP ring has correct vertex filtering', () => {
            const ring = cache.createADPHalfTorus();
            const positions = ring.attributes.position.array;
            const indices = ring.index.array;

            // Check that each triangle has at least one vertex outside the scaling radius
            for (let i = 0; i < indices.length; i += 3) {
                const vertices = [
                    indices[i] * 3,
                    indices[i + 1] * 3,
                    indices[i + 2] * 3,
                ].map(idx => ({
                    distance: Math.sqrt(
                        positions[idx] * positions[idx] +
                        positions[idx + 1] * positions[idx + 1] +
                        positions[idx + 2] * positions[idx + 2],
                    ),
                }));

                expect(vertices.some(v => v.distance >= cache.scaling)).toBe(true);
            }

            // Additionally verify that we have vertices both inside and outside
            // to ensure we're actually creating a connection to the sphere
            const distances = [];
            for (let i = 0; i < positions.length; i += 3) {
                const distance = Math.sqrt(
                    positions[i] * positions[i] +
                    positions[i + 1] * positions[i + 1] +
                    positions[i + 2] * positions[i + 2],
                );
                distances.push(distance);
            }

            expect(distances.some(d => d >= cache.scaling)).toBe(true);
            expect(distances.some(d => d < cache.scaling)).toBe(true);
        });

        test('ADP ring has correct orientation', () => {
            const ring = cache.createADPHalfTorus();
            const matrix = new THREE.Matrix4();
            ring.computeBoundingBox();

            // Should be rotated around X axis by PI/2
            matrix.makeRotationX(-Math.PI / 2);
            ring.applyMatrix4(matrix);
            ring.computeBoundingBox();

            // After un-rotating, the ring should be primarily in the XY plane
            const { min, max } = ring.boundingBox;
            const zRange = max.z - min.z;
            const xyRange = Math.max(max.x - min.x, max.y - min.y);

            expect(zRange).toBeLessThan(xyRange);
        });
    });

    describe('resource disposal', () => {
        let disposeSpy;

        beforeEach(() => {
            disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
        });

        afterEach(() => {
            disposeSpy.mockRestore();
        });

        test('disposes all geometries', () => {
            cache.dispose();

            // We should have 4 geometries: atom, adpRing, bond, and hbond
            expect(disposeSpy).toHaveBeenCalledTimes(4);
        });

        test('disposes all materials', () => {
            // Create some materials first
            cache.getAtomMaterials('C');
            cache.getAtomMaterials('O');

            const materialDisposeSpy = vi.spyOn(THREE.Material.prototype, 'dispose');

            cache.dispose();

            // Should dispose base materials and element materials
            const expectedCalls = 2 + // Base materials (bond, hbond)
                4;  // Element materials (2 elements × 2 materials each)
            expect(materialDisposeSpy).toHaveBeenCalledTimes(expectedCalls);

            materialDisposeSpy.mockRestore();
        });

        test('handles multiple dispose calls', () => {
            cache.dispose();
            expect(() => cache.dispose()).not.toThrow();
        });
    });
});

describe('ORTEP3JsStructure', () => {
    let structure;
    let mockCrystalStructure;

    beforeEach(() => {
        // Create a mock crystal structure with minimal data
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5),
                new UIsoADP(0.02)),
            new Atom('H1', 'H', new FractPosition(0.1, 0.1, 0.1),
                new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0)),
        ];
        const bonds = [
            new Bond('C1', 'O1', 1.5, 0.01, '.'),
        ];
        const hbonds = [
            new HBond('O1', 'H1', 'C1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),
        ];

        mockCrystalStructure = new CrystalStructure(cell, atoms, bonds, hbonds);
    });

    describe('element property handling', () => {
        test('preserves unmodified element properties', () => {
            const originalColor = defaultSettings.elementProperties.C.atomColor;
            structure = new ORTEP3JsStructure(mockCrystalStructure);
            expect(structure.options.elementProperties.C.atomColor).toBe(originalColor);
        });

        test('updates single property while preserving others', () => {
            const originalAtomColor = defaultSettings.elementProperties.C.atomColor;
            const newRingColor = '#00ff00';

            structure = new ORTEP3JsStructure(mockCrystalStructure, {
                elementProperties: {
                    'C': { ringColor: newRingColor },
                },
            });

            expect(structure.options.elementProperties.C.atomColor).toBe(originalAtomColor);
            expect(structure.options.elementProperties.C.ringColor).toBe(newRingColor);
        });

        test('handles null/undefined options', () => {
            expect(() => {
                structure = new ORTEP3JsStructure(mockCrystalStructure, null);
            }).not.toThrow();

            expect(() => {
                structure = new ORTEP3JsStructure(mockCrystalStructure, { elementProperties: null });
            }).not.toThrow();
        });

        test('preserves other elements when updating one', () => {
            const originalOxygenProps = { ...defaultSettings.elementProperties.O };

            structure = new ORTEP3JsStructure(mockCrystalStructure, {
                elementProperties: {
                    'C': { ringColor: '#00ff00' },
                },
            });

            expect(structure.options.elementProperties.O).toEqual(originalOxygenProps);
        });
    });

    describe('basic functionality', () => {
        beforeEach(() => {
            structure = new ORTEP3JsStructure(mockCrystalStructure);
        });

        test('creates correct number of 3D objects', () => {
            expect(structure.atoms3D).toHaveLength(3);
            expect(structure.bonds3D).toHaveLength(1);
            expect(structure.hBonds3D).toHaveLength(1);
        });

        test('creates group with correct structure', () => {
            const group = structure.getGroup();
            expect(group).toBeInstanceOf(THREE.Group);
            expect(group.children).toHaveLength(5); // 3 atoms + 1 bond + 1 hbond
        });

        test('exposes cutaway atoms for camera-facing updates', () => {
            structure.dispose();
            structure = new ORTEP3JsStructure(mockCrystalStructure, {
                atomEllipsoidStyle: 'cutout',
            });

            const group = structure.getGroup();
            expect(group.cutawayAtoms).toHaveLength(1);
            expect(group.cutawayAtoms[0].userData.atomData.label).toBe('H1');
        });

        test('creates a surface-trimmed, camera-facing 2D plot structure', () => {
            structure.dispose();
            structure = new ORTEP3JsStructure(mockCrystalStructure, {
                renderStyle: '2d',
            });
            const group = structure.getGroup();
            const anisotropicAtom = structure.atoms3D[2];

            expect(group.cameraFacingAtoms).toEqual([anisotropicAtom]);
            expect(anisotropicAtom.isCutaway).toBe(true);
            expect(anisotropicAtom.cutawayOctants).toHaveLength(8);
            expect(anisotropicAtom.cutawayOctants.filter(octant => octant.visible)).toHaveLength(7);
            expect(anisotropicAtom.cutawayOutlines).toHaveLength(8);
            expect(anisotropicAtom.cutawayOutlines.filter(outline => outline.visible)).toHaveLength(7);
            expect(anisotropicAtom.cutawayPlanes.material.userData.plot2DHatch).toBeDefined();
            expect(structure.bonds3D[0].material).toBeInstanceOf(THREE.MeshBasicMaterial);
        });

        test('renders PART 2 bonds with opaque white centres in the 2D plot', () => {
            structure.dispose();
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const atoms = [
                new Atom(
                    'C0',
                    'C',
                    new FractPosition(0, 0, 0),
                    new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0),
                ),
                new Atom(
                    'C1',
                    'C',
                    new FractPosition(0.25, 0, 0),
                    new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0),
                    1,
                ),
                new Atom(
                    'C2',
                    'C',
                    new FractPosition(0.5, 0, 0),
                    new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0),
                    2,
                ),
            ];
            const bonds = [
                new Bond('C0', 'C1'),
                new Bond('C0', 'C2'),
            ];
            structure = new ORTEP3JsStructure(
                new CrystalStructure(cell, atoms, bonds),
                { renderStyle: '2d' },
            );

            const [nonDisordered, part1, part2] = structure.atoms3D;
            const [closedBond, openBond] = structure.bonds3D;
            const group = structure.getGroup();

            expect(nonDisordered.isCutaway).toBe(true);
            expect(part1.isCutaway).toBe(true);
            expect(part2.isCutaway).toBe(true);
            expect(group.cameraFacingAtoms).toEqual([nonDisordered, part1, part2]);

            expect(closedBond.userData.isOpenDisorderBond).toBe(false);
            expect(closedBond.material.color.getHexString()).toBe('000000');
            expect(closedBond.openBondOutline).toBeUndefined();

            expect(openBond.userData.isOpenDisorderBond).toBe(true);
            expect(openBond.material.color.getHexString()).toBe('ffffff');
            expect(openBond.material.transparent).toBe(false);
            expect(openBond.material.opacity).toBe(1);
            expect(openBond.material.depthWrite).toBe(true);
            expect(openBond.openBondOutline).toBeInstanceOf(THREE.Mesh);
            expect(openBond.openBondOutline.material.color.getHexString()).toBe('000000');
            expect(openBond.openBondOutline.material.side).toBe(THREE.BackSide);
            expect(openBond.scale.x).toBeCloseTo(0.5);
            expect(openBond.scale.z).toBeCloseTo(0.5);
            expect(openBond.openBondOutline.scale.x).toBeCloseTo(2);
            expect(openBond.openBondOutline.scale.z).toBeCloseTo(2);
        });
    });

    afterEach(() => {
        if (structure) {
            structure.dispose();
        }
    });
});

// Mock classes for testing
class TestORTEPObject extends ORTEPObject {
    createSelectionMarker(color, options) {
        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            this.createSelectionMaterial(color),
        );
        marker.scale.multiplyScalar(options.selection.markerMult);
        return marker;
    }
}

describe('ORTEPObject', () => {
    let object;
    const mockOptions = {
        selection: {
            markerMult: 1.3,
            highlightEmissive: 0xaaaaaa,
        },
    };

    beforeEach(() => {
        object = new TestORTEPObject(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial(),
        );
    });

    test('initializes with null selection color', () => {
        expect(object.selectionColor).toBeNull();
    });

    test('handles selection', () => {
        object.select(0xff0000, mockOptions);
        expect(object.selectionColor).toBe(0xff0000);
        expect(object.marker).toBeTruthy();
        expect(object.originalMaterial).toBeTruthy();
    });

    test('handles deselection', () => {
        const originalMaterial = object.material;
        object.select(0xff0000, mockOptions);
        object.deselect();
        expect(object.selectionColor).toBeNull();
        expect(object.marker).toBeNull();
        expect(object.material).toBe(originalMaterial);
    });

    test('properly disposes resources', () => {
        const geometrySpy = vi.spyOn(object.geometry, 'dispose');
        const materialSpy = vi.spyOn(object.material, 'dispose');

        object.dispose();

        expect(geometrySpy).toHaveBeenCalled();
        expect(materialSpy).toHaveBeenCalled();
    });
});

describe('ORTEPObject is abstract', () => {
    test('cannot instantiate directly', () => {
        expect(() => {
            new ORTEPObject();
        }).toThrow('ORTEPObject is an abstract class and cannot be instantiated directly');
    });

    test('createSelectionMarker needs to be implemented', () => {
        // Create a concrete subclass that doesn't implement createSelectionMarker
        class ConcreteORTEPObject extends ORTEPObject {
            // Empty class - doesn't implement required method
        }

        const obj = new ConcreteORTEPObject();
        expect(() => {
            obj.createSelectionMarker();
        }).toThrow('createSelectionMarker needs to be implemented in a subclass');
    });
});

describe('ORTEPAtom and subclasses', () => {
    let mockAtom;
    let mockUnitCell;
    let mockGeometry;
    let mockMaterial;
    let mockADPRing;
    let mockRingMaterial;
    let mockOptions;

    beforeEach(() => {
        // Set up mocks
        mockUnitCell = new UnitCell(10, 10, 10, 90, 90, 90);
        mockGeometry = new THREE.IcosahedronGeometry(1, 2);
        mockMaterial = new THREE.MeshStandardMaterial();
        mockADPRing = new THREE.TorusGeometry(1, 0.1, 8, 24);
        mockRingMaterial = new THREE.MeshStandardMaterial();
        mockOptions = {
            elementProperties: {
                'C': { radius: 0.76 },
                'O': { radius: 0.66 },
                'H': { radius: 0.31 },
            },
            atomConstantRadiusMultiplier: 0.3,
            selection: {
                markerMult: 1.3,
                highlightEmissive: 0xaaaaaa,
            },
        };
    });

    afterEach(() => {
        // Clean up
        mockGeometry.dispose();
        mockMaterial.dispose();
        mockADPRing.dispose();
        mockRingMaterial.dispose();
    });

    describe('ORTEPAtom', () => {
        beforeEach(() => {
            mockAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
            );
        });

        test('constructs with basic properties', () => {
            const ortepAtom = new ORTEPAtom(mockAtom, mockUnitCell, mockGeometry, mockMaterial);

            expect(ortepAtom.geometry).toBe(mockGeometry);
            expect(ortepAtom.material).toBe(mockMaterial);
            expect(ortepAtom.userData.type).toBe('atom');
            expect(ortepAtom.userData.atomData).toBe(mockAtom);
            expect(ortepAtom.userData.selectable).toBe(true);
        });

        test('correctly transforms fractional to cartesian coordinates', () => {
            const ortepAtom = new ORTEPAtom(mockAtom, mockUnitCell, mockGeometry, mockMaterial);

            // Calculate expected cartesian position
            const cartPos = mockAtom.position.toCartesian(mockUnitCell);

            expect(ortepAtom.position.x).toBeCloseTo(cartPos.x);
            expect(ortepAtom.position.y).toBeCloseTo(cartPos.y);
            expect(ortepAtom.position.z).toBeCloseTo(cartPos.z);
        });

        test('calculates direction-dependent distances to a scaled atom surface', () => {
            const ortepAtom = new ORTEPAtom(mockAtom, mockUnitCell, mockGeometry, mockMaterial);
            ortepAtom.scale.set(2, 1, 0.5);
            mockGeometry.computeBoundingSphere();
            const radius = mockGeometry.boundingSphere.radius;

            expect(ortepAtom.getSurfaceDistanceAlong(new THREE.Vector3(1, 0, 0)))
                .toBeCloseTo(2 * radius);
            expect(ortepAtom.getSurfaceDistanceAlong(new THREE.Vector3(0, 0, 1)))
                .toBeCloseTo(0.5 * radius);
        });

        test('handles selection and deselection correctly', () => {
            const ortepAtom = new ORTEPAtom(mockAtom, mockUnitCell, mockGeometry, mockMaterial);

            // Test selection
            ortepAtom.select(0xff0000, mockOptions);
            expect(ortepAtom.selectionColor).toBe(0xff0000);
            expect(ortepAtom.marker).toBeTruthy();
            expect(ortepAtom.originalMaterial).toBe(mockMaterial);
            expect(ortepAtom.material).not.toBe(mockMaterial);
            expect(ortepAtom.material.emissive.getHex()).toBe(mockOptions.selection.highlightEmissive);

            // Test deselection
            ortepAtom.deselect();
            expect(ortepAtom.selectionColor).toBeNull();
            expect(ortepAtom.marker).toBeNull();
            expect(ortepAtom.material).toBe(mockMaterial);
            expect(ortepAtom.originalMaterial).toBeNull();
        });
    });

    describe('ORTEPAniAtom', () => {
        beforeEach(() => {
            mockAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
                new UAnisoADP(0.01, 0.02, 0.03, 0.001, 0.002, 0.003),
            );
        });

        test('constructs with anisotropic properties', () => {
            const ortepAtom = new ORTEPAniAtom(
                mockAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
                mockADPRing,
                mockRingMaterial,
            );

            expect(ortepAtom.geometry).toBe(mockGeometry);
            expect(ortepAtom.material).toBe(mockMaterial);
            expect(ortepAtom.children.length).toBe(3); // 3 ADP rings

            // Verify rings were created correctly
            ortepAtom.children.forEach(ring => {
                expect(ring).toBeInstanceOf(THREE.Mesh);
                expect(ring.geometry).toBe(mockADPRing);
                expect(ring.material).toBe(mockRingMaterial);
                expect(ring.userData.selectable).toBe(false);
            });
        });

        test('handles invalid ADP matrices gracefully', () => {
            // Create atom with invalid ADP that will produce NaN in matrix
            const invalidAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
                new UAnisoADP(NaN, 0.02, 0.03, 0.001, 0.002, 0.003),
            );

            const ortepAtom = new ORTEPAniAtom(
                invalidAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
            );

            // Should fall back to tetrahedron geometry
            expect(ortepAtom.geometry).toBeInstanceOf(THREE.TetrahedronGeometry);
        });

        test('applies correct ADP ring matrices', () => {
            const ortepAtom = new ORTEPAniAtom(
                mockAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
                mockADPRing,
                mockRingMaterial,
            );

            const matrices = ortepAtom.adpRingMatrices;

            // Check we have 3 matrices
            expect(matrices).toHaveLength(3);

            // Verify each matrix is orthogonal
            matrices.forEach(matrix => {
                const elements = matrix.elements;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        let dot = 0;
                        for (let k = 0; k < 3; k++) {
                            dot += elements[i * 4 + k] * elements[j * 4 + k];
                        }
                        // Should be 1 for i=j, 0 otherwise
                        expect(dot).toBeCloseTo(i === j ? 1 : 0);
                    }
                }
            });
        });

        test('creates eight shared octants and keeps one facing octant hidden', () => {
            const cutawayCache = new GeometryMaterialCache({ atomEllipsoidStyle: 'cutout' });
            const [atomMaterial, ringMaterial, planeMaterial] =
                cutawayCache.getAtomMaterials('C');
            const ortepAtom = new ORTEPAniAtom(
                mockAtom,
                mockUnitCell,
                cutawayCache.geometries.atom,
                atomMaterial,
                cutawayCache.geometries.adpRing,
                ringMaterial,
                {
                    octantGeometry: cutawayCache.geometries.atomOctant,
                    emptyGeometry: cutawayCache.geometries.emptyAtom,
                    planeGeometry: cutawayCache.geometries.cutawayPlanes,
                    planeMaterial,
                    hysteresis: 0.025,
                },
            );

            expect(ortepAtom.isCutaway).toBe(true);
            expect(ortepAtom.cutawayOctants).toHaveLength(8);
            expect(new Set(ortepAtom.cutawayOctants.map(octant => octant.geometry)).size).toBe(1);
            expect(ortepAtom.cutawayOctants.filter(octant => octant.visible)).toHaveLength(7);
            expect(ortepAtom.cutawayPlanes.geometry).toBe(cutawayCache.geometries.cutawayPlanes);

            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
            camera.position.set(7, 11, 13);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            ortepAtom.updateMatrixWorld(true);
            ortepAtom.updateCutawayOctant(camera);
            const firstMissingOctant = ortepAtom.missingOctantIndex;

            camera.position.multiplyScalar(-1);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            ortepAtom.updateCutawayOctant(camera);

            expect(ortepAtom.missingOctantIndex).not.toBe(firstMissingOctant);
            expect(ortepAtom.cutawayOctants.filter(octant => octant.visible)).toHaveLength(7);
            cutawayCache.dispose();
        });

        test('keeps cutaway selection marker synchronized with the missing octant', () => {
            const cutawayCache = new GeometryMaterialCache({ atomEllipsoidStyle: 'cutout' });
            const [atomMaterial, ringMaterial, planeMaterial] =
                cutawayCache.getAtomMaterials('C');
            const ortepAtom = new ORTEPAniAtom(
                mockAtom,
                mockUnitCell,
                cutawayCache.geometries.atom,
                atomMaterial,
                cutawayCache.geometries.adpRing,
                ringMaterial,
                {
                    octantGeometry: cutawayCache.geometries.atomOctant,
                    emptyGeometry: cutawayCache.geometries.emptyAtom,
                    planeGeometry: cutawayCache.geometries.cutawayPlanes,
                    planeMaterial,
                    hysteresis: 0.025,
                },
            );

            ortepAtom.select(0xff0000, mockOptions);
            expect(ortepAtom.marker.cutawayOctants.filter(octant => octant.visible))
                .toHaveLength(7);
            expect(ortepAtom.cutawayOctants.every(octant => octant.material === ortepAtom.material))
                .toBe(true);

            ortepAtom.setMissingOctant(0);
            expect(ortepAtom.marker.cutawayOctants[0].visible).toBe(false);
            ortepAtom.deselect();
            expect(ortepAtom.cutawayOctants.every(octant => octant.material === atomMaterial))
                .toBe(true);
            cutawayCache.dispose();
        });

        test('redirects cutaway child raycasts to the selectable atom', () => {
            const cutawayCache = new GeometryMaterialCache({ atomEllipsoidStyle: 'cutout' });
            const [atomMaterial, ringMaterial, planeMaterial] =
                cutawayCache.getAtomMaterials('C');
            const ortepAtom = new ORTEPAniAtom(
                mockAtom,
                mockUnitCell,
                cutawayCache.geometries.atom,
                atomMaterial,
                cutawayCache.geometries.adpRing,
                ringMaterial,
                {
                    octantGeometry: cutawayCache.geometries.atomOctant,
                    emptyGeometry: cutawayCache.geometries.emptyAtom,
                    planeGeometry: cutawayCache.geometries.cutawayPlanes,
                    planeMaterial,
                    hysteresis: 0.025,
                },
            );
            ortepAtom.updateMatrixWorld(true);

            const origin = ortepAtom.localToWorld(new THREE.Vector3(-5, -5, -5));
            const target = ortepAtom.localToWorld(new THREE.Vector3(0, 0, 0));
            const raycaster = new THREE.Raycaster(
                origin,
                target.sub(origin).normalize(),
            );
            const intersects = raycaster.intersectObject(ortepAtom);

            expect(intersects.length).toBeGreaterThan(0);
            expect(intersects[0].object).toBe(ortepAtom);
            cutawayCache.dispose();
        });
    });

    describe('ORTEPIsoAtom', () => {
        beforeEach(() => {
            mockAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
                new UIsoADP(0.025),
            );
        });

        test('constructs with correct scaling based on Uiso', () => {
            const ortepAtom = new ORTEPIsoAtom(mockAtom, mockUnitCell, mockGeometry, mockMaterial);

            // Scale should be based on sqrt(Uiso)
            const expectedScale = Math.sqrt(mockAtom.adp.uiso);
            expect(ortepAtom.scale.x).toBeCloseTo(expectedScale);
            expect(ortepAtom.scale.y).toBeCloseTo(expectedScale);
            expect(ortepAtom.scale.z).toBeCloseTo(expectedScale);
        });

        test('throws error when atom has no UIsoADP', () => {
            const invalidAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
            );

            expect(() => new ORTEPIsoAtom(
                invalidAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
            )).toThrow('Atom must have isotropic displacement parameters (UIsoADP)');
        });
    });

    describe('ORTEPConstantAtom', () => {
        beforeEach(() => {
            mockAtom = new Atom(
                'C1',
                'C',
                new FractPosition(0.1, 0.2, 0.3),
            );
        });

        test('constructs with correct scaling based on element radius and multiplier', () => {
            const ortepAtom = new ORTEPConstantAtom(
                mockAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
                mockOptions,
            );

            const expectedScale = mockOptions.atomConstantRadiusMultiplier *
                mockOptions.elementProperties[mockAtom.atomType].radius;
            expect(ortepAtom.scale.x).toBeCloseTo(expectedScale);
            expect(ortepAtom.scale.y).toBeCloseTo(expectedScale);
            expect(ortepAtom.scale.z).toBeCloseTo(expectedScale);
        });

        test('throws error when element properties not found', () => {
            const unknownAtom = new Atom(
                'X1',
                'X',  // Unknown element
                new FractPosition(0.1, 0.2, 0.3),
            );

            expect(() => new ORTEPConstantAtom(
                unknownAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
                mockOptions,
            )).toThrow('Element properties not found for atom type: \'X\'');
        });

        test('throws error when options not provided', () => {
            expect(() => new ORTEPConstantAtom(
                mockAtom,
                mockUnitCell,
                mockGeometry,
                mockMaterial,
            )).toThrow('Element properties not found for atom type: \'C\'');
        });
    });
});

describe('ORTEPBond', () => {
    let mockBond;
    let mockCrystalStructure;
    let mockGeometry;
    let mockMaterial;
    let mockAtom1;
    let mockAtom2;
    let mockUnitCell;
    let mockOptions;

    beforeEach(() => {
        // Set up mocks
        mockUnitCell = new UnitCell(10, 10, 10, 90, 90, 90);
        mockGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        mockMaterial = new THREE.MeshStandardMaterial();
        mockOptions = {
            selection: {
                markerMult: 1.3,
                bondMarkerMult: 1.7,
                highlightEmissive: 0xaaaaaa,
            },
        };

        // Create atoms
        mockAtom1 = new Atom(
            'C1',
            'C',
            new FractPosition(0, 0, 0),
        );
        mockAtom2 = new Atom(
            'O1',
            'O',
            new FractPosition(0.1, 0.1, 0.1),
        );

        // Create bond
        mockBond = new Bond(
            'C1',
            'O1',
            1.5,
            0.01,
        );

        // Create crystal structure
        mockCrystalStructure = new CrystalStructure(
            mockUnitCell,
            [mockAtom1, mockAtom2],
        );
    });

    afterEach(() => {
        mockGeometry.dispose();
        mockMaterial.dispose();
    });

    test('constructs basic bond with correct properties', () => {
        const ortepBond = new ORTEPBond(
            mockBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
        );

        expect(ortepBond.geometry).toBe(mockGeometry);
        expect(ortepBond.material).toBe(mockMaterial);
        expect(ortepBond.userData.type).toBe('bond');
        expect(ortepBond.userData.bondData).toBe(mockBond);
        expect(ortepBond.userData.selectable).toBe(true);
    });

    test('positions bond correctly between atoms', () => {
        const ortepBond = new ORTEPBond(
            mockBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
        );

        // Calculate expected positions
        const pos1 = new THREE.Vector3(...mockAtom1.position.toCartesian(mockUnitCell));
        const pos2 = new THREE.Vector3(...mockAtom2.position.toCartesian(mockUnitCell));
        const midpoint = new THREE.Vector3()
            .addVectors(pos1, pos2)
            .multiplyScalar(0.5);

        // Check bond midpoint position
        expect(ortepBond.position.x).toBeCloseTo(midpoint.x);
        expect(ortepBond.position.y).toBeCloseTo(midpoint.y);
        expect(ortepBond.position.z).toBeCloseTo(midpoint.z);

        // Check bond length
        const bondLength = pos1.distanceTo(pos2);
        const scale = new THREE.Vector3();
        ortepBond.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        expect(scale.y).toBeCloseTo(bondLength);
    });

    test('orients bond in correct direction', () => {
        const ortepBond = new ORTEPBond(
            mockBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
        );

        // Calculate expected direction
        const pos1 = new THREE.Vector3(...mockAtom1.position.toCartesian(mockUnitCell));
        const pos2 = new THREE.Vector3(...mockAtom2.position.toCartesian(mockUnitCell));
        const expectedDirection = new THREE.Vector3()
            .subVectors(pos2, pos1)
            .normalize();

        // Extract actual direction from bond's transformation matrix
        const bondDirection = new THREE.Vector3(0, 1, 0) // Cylinder's default up direction
            .applyMatrix4(ortepBond.matrix)
            .sub(ortepBond.position)
            .normalize();

        // Check alignment (either parallel or antiparallel is fine)
        const dotProduct = Math.abs(bondDirection.dot(expectedDirection));
        expect(dotProduct).toBeCloseTo(1, 5);
    });

    test('trims a bond to rendered atom surfaces when a resolver is provided', () => {
        const pos1 = new THREE.Vector3(...mockAtom1.position.toCartesian(mockUnitCell));
        const pos2 = new THREE.Vector3(...mockAtom2.position.toCartesian(mockUnitCell));
        const renderedAtoms = new Map([
            [mockAtom1.uniqueId, { getSurfaceDistanceAlong: () => 0.2 }],
            [mockAtom2.uniqueId, { getSurfaceDistanceAlong: () => 0.3 }],
        ]);
        const ortepBond = new ORTEPBond(
            mockBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            null,
            atomId => renderedAtoms.get(atomId),
        );
        const scale = new THREE.Vector3();
        ortepBond.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

        expect(scale.y).toBeCloseTo(pos1.distanceTo(pos2) - 0.5);
    });

    test('throws error when atoms not found in structure', () => {
        const invalidBond = new Bond(
            'X1',  // Non-existent atom
            'O1',
            1.5,
            0.01,
        );

        expect(() => new ORTEPBond(
            invalidBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
        )).toThrow('Could not find atom with ID: X1');
    });

    test('creates correctly scaled selection marker', () => {
        const ortepBond = new ORTEPBond(
            mockBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
        );

        const marker = ortepBond.createSelectionMarker(0xff0000, mockOptions);

        expect(marker).toBeInstanceOf(THREE.Mesh);
        expect(marker.geometry).toBe(mockGeometry);
        expect(marker.material.color.getHex()).toBe(0xff0000);
        expect(marker.scale.x).toBe(mockOptions.selection.bondMarkerMult);
        expect(marker.scale.z).toBe(mockOptions.selection.bondMarkerMult);
        // y-scale (length) should remain unchanged
        expect(marker.scale.y).toBe(1);
        expect(marker.userData.selectable).toBe(false);
    });

    test('handles bonds with different atom positions', () => {
        // Test various relative positions
        const testCases = [
            { pos1: [0, 0, 0], pos2: [0.2, 0, 0] },    // Along x-axis
            { pos1: [0, 0, 0], pos2: [0, 0.2, 0] },    // Along y-axis
            { pos1: [0, 0, 0], pos2: [0, 0, 0.2] },    // Along z-axis
            { pos1: [0, 0, 0], pos2: [0.1, 0.1, 0.1] }, // Diagonal
        ];

        testCases.forEach(({ pos1, pos2 }) => {
            mockAtom1.position = new FractPosition(...pos1);
            mockAtom2.position = new FractPosition(...pos2);

            const ortepBond = new ORTEPBond(
                mockBond,
                mockCrystalStructure,
                mockGeometry,
                mockMaterial,
            );

            // Calculate expected positions and length
            const cartPos1 = new THREE.Vector3(...mockAtom1.position.toCartesian(mockUnitCell));
            const cartPos2 = new THREE.Vector3(...mockAtom2.position.toCartesian(mockUnitCell));
            const expectedLength = cartPos1.distanceTo(cartPos2);

            // Check bond length
            const scale = new THREE.Vector3();
            ortepBond.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
            expect(scale.y).toBeCloseTo(expectedLength);
        });
    });
});

class TestORTEPGroupObject extends ORTEPGroupObject {
    createSelectionMarker(color, _options) {
        const marker = new THREE.Group();
        const material = this.createSelectionMaterial(color);

        this.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
                const markerMesh = new THREE.Mesh(child.geometry, material);
                markerMesh.matrix.copy(child.matrix);
                marker.add(markerMesh);
            }
        });
        return marker;
    }
}

describe('ORTEPGroupObject', () => {
    let group;
    let child1, child2;
    const mockOptions = {
        selection: {
            markerMult: 1.3,
            highlightEmissive: 0xaaaaaa,
        },
    };

    beforeEach(() => {
        group = new TestORTEPGroupObject();
        child1 = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial(),
        );
        child2 = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial(),
        );
        group.add(child1, child2);
    });

    afterEach(() => {
        // Clean up
        child1.geometry.dispose();
        child1.material.dispose();
        child2.geometry.dispose();
        child2.material.dispose();
        if (group.marker) {
            group.marker.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
            });
        }
    });

    test('cannot be instantiated directly', () => {
        expect(() => {
            new ORTEPGroupObject();
        }).toThrow('ORTEPGroupObject is an abstract class and cannot be instantiated directly');
    });

    test('throws error when createSelectionMarker not implemented', () => {
        // Create minimal concrete subclass without implementing createSelectionMarker
        class MinimalGroup extends ORTEPGroupObject { }
        const minimalGroup = new MinimalGroup();

        expect(() => {
            minimalGroup.createSelectionMarker(0xff0000, {});
        }).toThrow('createSelectionMarker needs to be implemented in a subclass');
    });

    test('redirects raycasting from children to group', () => {
        const raycaster = new THREE.Raycaster();
        const intersects = [];

        // Position raycaster to hit child1
        raycaster.ray.origin.set(0, 0, -5);
        raycaster.ray.direction.set(0, 0, 1);

        child1.raycast(raycaster, intersects);

        expect(intersects.length).toBe(1);
        expect(intersects[0].object).toBe(group);
    });

    test('handles selection for all children', () => {
        group.select(0xff0000, mockOptions);

        expect(group.selectionColor).toBe(0xff0000);
        expect(group.marker).toBeTruthy();

        const nonMarkerChildren = group.children.filter(child => child !== group.marker);
        nonMarkerChildren.forEach(child => {
            expect(child.originalMaterial).toBeTruthy();
        });
    });

    test('handles deselection for all children', () => {
        const originalMaterials = group.children.map(child => child.material);

        group.select(0xff0000, mockOptions);
        group.deselect();

        expect(group.selectionColor).toBeNull();
        expect(group.marker).toBeNull();

        // Check each child has its original material restored
        group.children.forEach((child, index) => {
            expect(child.material).toBe(originalMaterials[index]);
            expect(child.originalMaterial).toBeNull();
        });
    });

    test('deselecting a deselected object is handled gracefully', () => {
        const originalMaterials = group.children.map(child => child.material);

        // Deselect without selecting first
        expect(() => {
            group.deselect();
        }).not.toThrow();

        expect(group.selectionColor).toBeNull();
        expect(group.marker).toBeNull();

        // Verify children still have their original materials
        group.children.forEach((child, index) => {
            expect(child.material).toBe(originalMaterials[index]);
            expect(child.originalMaterial).toBeUndefined();
        });
    });

    test('properly disposes all resources when selected', () => {
        group.select(0xff0000, mockOptions); // Select first

        const geometrySpies = group.children
            .filter(child => child instanceof THREE.Mesh)
            .map(child => vi.spyOn(child.geometry, 'dispose'));
        const materialSpies = group.children
            .filter(child => child instanceof THREE.Mesh)
            .map(child => vi.spyOn(child.material, 'dispose'));

        group.dispose();

        geometrySpies.forEach(spy => expect(spy).toHaveBeenCalled());
        materialSpies.forEach(spy => expect(spy).toHaveBeenCalled());
    });

    test('properly disposes all resources when not selected', () => {
        const geometrySpies = group.children.map(child =>
            vi.spyOn(child.geometry, 'dispose'),
        );
        const materialSpies = group.children.map(child =>
            vi.spyOn(child.material, 'dispose'),
        );

        // Dispose without ever selecting
        group.dispose();

        geometrySpies.forEach(spy => expect(spy).toHaveBeenCalled());
        materialSpies.forEach(spy => expect(spy).toHaveBeenCalled());
        expect(group.children).toHaveLength(0);
    });
});

describe('ORTEPHBond', () => {
    let mockHBond;
    let mockCrystalStructure;
    let mockGeometry;
    let mockMaterial;
    let mockDonor;
    let mockHydrogen;
    let mockAcceptor;
    let mockUnitCell;
    let mockOptions;

    beforeEach(() => {
        // Set up mocks
        mockUnitCell = new UnitCell(10, 10, 10, 90, 90, 90);
        mockGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        mockMaterial = new THREE.MeshStandardMaterial();
        mockOptions = {
            selection: {
                markerMult: 1.3,
                bondMarkerMult: 1.7,
                highlightEmissive: 0xaaaaaa,
            },
        };

        // Create atoms
        mockDonor = new Atom(
            'O1',
            'O',
            new FractPosition(0, 0, 0),
        );
        mockHydrogen = new Atom(
            'H1',
            'H',
            new FractPosition(0.1, 0, 0),
        );
        mockAcceptor = new Atom(
            'N1',
            'N',
            new FractPosition(0.2, 0, 0),
        );

        // Create H-bond
        mockHBond = new HBond(
            'O1',
            'H1',
            'N1',
            1.0,  // D-H distance
            0.01, // D-H distance SU
            2.0,  // H···A distance
            0.02, // H···A distance SU
            2.8,  // D···A distance
            0.03, // D···A distance SU
            175,  // D-H···A angle
            1,    // Angle SU
            '.',   // Symmetry
        );

        // Create crystal structure
        mockCrystalStructure = new CrystalStructure(
            mockUnitCell,
            [mockDonor, mockHydrogen, mockAcceptor],
        );
    });

    afterEach(() => {
        mockGeometry.dispose();
        mockMaterial.dispose();
    });

    test('constructs with correct properties', () => {
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            0.3,  // targetSegmentLength
            0.6,   // dashFraction
        );

        expect(hbond.userData.type).toBe('hbond');
        expect(hbond.userData.hbondData).toBe(mockHBond);
        expect(hbond.userData.selectable).toBe(true);
    });

    test('creates correct number of dash segments', () => {
        const targetSegmentLength = 0.3;
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            targetSegmentLength,
            0.6,
        );

        // Calculate expected number of segments
        const hydrogenPos = new THREE.Vector3(...mockHydrogen.position.toCartesian(mockUnitCell));
        const acceptorPos = new THREE.Vector3(...mockAcceptor.position.toCartesian(mockUnitCell));
        const totalLength = hydrogenPos.distanceTo(acceptorPos);
        const expectedSegments = Math.max(1, Math.floor(totalLength / targetSegmentLength));

        expect(hbond.children.length).toBe(expectedSegments);
    });

    test('trims hydrogen bonds to rendered atom surfaces', () => {
        const renderedAtoms = new Map([
            [mockHydrogen.uniqueId, { getSurfaceDistanceAlong: () => 0.1 }],
            [mockAcceptor.uniqueId, { getSurfaceDistanceAlong: () => 0.2 }],
        ]);
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            0.3,
            0.6,
            null,
            atomId => renderedAtoms.get(atomId),
        );

        // The untrimmed 1.0 Å span produces three segments; trimming it to
        // 0.7 Å leaves two.
        expect(hbond.children).toHaveLength(2);
    });

    test('positions dash segments correctly', () => {
        const targetSegmentLength = 0.3;
        const dashFraction = 0.6;
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            targetSegmentLength,
            dashFraction,
        );

        const hydrogenPos = new THREE.Vector3(...mockHydrogen.position.toCartesian(mockUnitCell));
        const acceptorPos = new THREE.Vector3(...mockAcceptor.position.toCartesian(mockUnitCell));
        const direction = acceptorPos.clone().sub(hydrogenPos).normalize();

        // Check each segment's position and orientation
        hbond.children.forEach(segment => {
            const segmentPosition = new THREE.Vector3();
            segment.getWorldPosition(segmentPosition);

            // Verify segment is on the line between H and A
            const segmentDirection = segmentPosition.clone().sub(hydrogenPos).normalize();
            expect(segmentDirection.dot(direction)).toBeCloseTo(1, 5);

            // Verify segment is oriented correctly
            const upVector = new THREE.Vector3(0, 1, 0);
            segment.getWorldQuaternion(new THREE.Quaternion()).normalize();
            const segmentUp = upVector.clone().applyQuaternion(segment.quaternion).normalize();
            expect(segmentUp.dot(direction)).toBeCloseTo(1, 5);
        });
    });

    test('segments have correct length based on dashFraction', () => {
        const targetSegmentLength = 0.3;
        const dashFraction = 0.6;
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            targetSegmentLength,
            dashFraction,
        );

        const hydrogenPos = new THREE.Vector3(...mockHydrogen.position.toCartesian(mockUnitCell));
        const acceptorPos = new THREE.Vector3(...mockAcceptor.position.toCartesian(mockUnitCell));
        const totalLength = hydrogenPos.distanceTo(acceptorPos);
        const numSegments = Math.max(1, Math.floor(totalLength / targetSegmentLength));
        const segmentLength = totalLength / numSegments;
        const expectedDashLength = segmentLength * dashFraction;

        hbond.children.forEach(segment => {
            const scale = new THREE.Vector3();
            segment.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
            expect(scale.y).toBeCloseTo(expectedDashLength);
        });
    });

    test('creates correctly scaled selection markers for all segments', () => {
        const hbond = new ORTEPHBond(
            mockHBond,
            mockCrystalStructure,
            mockGeometry,
            mockMaterial,
            0.3,
            0.6,
        );

        const marker = hbond.createSelectionMarker(0xff0000, mockOptions);

        expect(marker).toBeInstanceOf(THREE.Group);
        expect(marker.children.length).toBe(hbond.children.length);

        marker.children.forEach(markerSegment => {
            expect(markerSegment.scale.x).toBe(mockOptions.selection.bondMarkerMult);
            expect(markerSegment.scale.z).toBe(mockOptions.selection.bondMarkerMult);
            expect(markerSegment.userData.selectable).toBe(false);
            expect(markerSegment.material.color.getHex()).toBe(0xff0000);
        });
    });
});
