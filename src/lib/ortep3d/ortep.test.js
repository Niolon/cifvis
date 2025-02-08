import * as THREE from 'three';
import {
    ORTEP3JsStructure, GeometryMaterialCache, getThreeEllipsoidMatrix, calcBondTransform,
    ORTEPObject, ORTEPGroupObject, ORTEPHBond
 } from './ortep.js';
import { UAnisoADP, Atom, Bond, HBond, FractPosition, CrystalStructure, UnitCell } from '../structure/crystal.js';
import defaultSettings from './structure-settings.js';
import { create, all } from 'mathjs';

const math = create(all);

describe('Transformation Functions', () => {
    describe('getThreeEllipsoidMatrix', () => {
        test('correctly converts mathjs matrix to THREE.Matrix4', () => {
            const mockUAnisoADP = {
                getEllipsoidMatrix: jest.fn().mockReturnValue(math.matrix([
                    [0.1, 0.2, 0.3],
                    [0.4, 0.5, 0.6],
                    [0.7, 0.8, 0.9]
                ]))
            };
            
            const matrix = getThreeEllipsoidMatrix(mockUAnisoADP, {});
            
            expect(matrix).toBeInstanceOf(THREE.Matrix4);
            expect(matrix.elements).toEqual([
                0.1, 0.4, 0.7, 0,
                0.2, 0.5, 0.8, 0,
                0.3, 0.6, 0.9, 0,
                0, 0, 0, 1
            ]);
        });
    });

    describe('calcBondTransform', () => {
        test('creates correct transformation for vertical bond', () => {
            const pos1 = new THREE.Vector3(0, -1, 0);
            const pos2 = new THREE.Vector3(0, 1, 0);
            
            const matrix = calcBondTransform(pos1, pos2);

            const vector = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix);
            
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

            const vector = new THREE.Vector3(0, 1, 0).applyMatrix4(matrix);
            
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
            expect(() => calcBondTransform(pos, pos.clone())).not.toThrow();
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
                bondColor: '#ff0000'
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
                        ringColor: '#000000'
                    }
                }
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
                    indices[i + 2] * 3
                ].map(idx => ({
                    distance: Math.sqrt(
                        positions[idx] * positions[idx] +
                        positions[idx + 1] * positions[idx + 1] +
                        positions[idx + 2] * positions[idx + 2]
                    )
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
                    positions[i + 2] * positions[i + 2]
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
            matrix.makeRotationX(-Math.PI/2);
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
            disposeSpy = jest.spyOn(THREE.BufferGeometry.prototype, 'dispose');
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
            
            const materialDisposeSpy = jest.spyOn(THREE.Material.prototype, 'dispose');
            
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
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),
            new Atom('H1', 'H', new FractPosition(0.1, 0.1, 0.1), 
                new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0))
        ];
        const bonds = [
            new Bond('C1', 'O1', 1.5, 0.01)
        ];
        const hbonds = [
            new HBond('O1', 'H1', 'C1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1)
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
                    'C': { ringColor: newRingColor }
                }
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
                    'C': { ringColor: '#00ff00' }
                }
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
            this.createSelectionMaterial(color)
        );
        marker.scale.multiplyScalar(options.selection.markerMult);
        return marker;
    }
}

class TestORTEPGroupObject extends ORTEPGroupObject {
    createSelectionMarker(color, options) {
        const marker = new THREE.Group();
        this.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
                const markerMesh = new THREE.Mesh(
                    child.geometry,
                    this.createSelectionMaterial(color)
                );
                markerMesh.matrix.copy(child.matrix);
                marker.add(markerMesh);
            }
        });
        return marker;
    }
}

describe('ORTEP Base Classes', () => {
    describe('ORTEPObject', () => {
        let object;
        const mockOptions = {
            selection: {
                markerMult: 1.3,
                highlightEmissive: 0xaaaaaa
            }
        };

        beforeEach(() => {
            object = new TestORTEPObject(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial()
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
            const geometrySpy = jest.spyOn(object.geometry, 'dispose');
            const materialSpy = jest.spyOn(object.material, 'dispose');
            
            object.dispose();
            
            expect(geometrySpy).toHaveBeenCalled();
            expect(materialSpy).toHaveBeenCalled();
        });
    });

    describe('ORTEPGroupObject', () => {
        let group;
        let child1, child2;
        const mockOptions = {
            selection: {
                markerMult: 1.3,
                highlightEmissive: 0xaaaaaa
            }
        };

        beforeEach(() => {
            group = new TestORTEPGroupObject();
            child1 = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial()
            );
            child2 = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial()
            );
            group.add(child1, child2);
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
            group.children.forEach(child => {
                if (child !== group.marker) {
                    expect(child.originalMaterial).toBeTruthy();
                }
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

        test('properly disposes all resources', () => {
            const geometrySpies = group.children.map(child => 
                jest.spyOn(child.geometry, 'dispose')
            );
            const materialSpies = group.children.map(child => 
                jest.spyOn(child.material, 'dispose')
            );
            
            group.dispose();
            
            geometrySpies.forEach(spy => expect(spy).toHaveBeenCalled());
            materialSpies.forEach(spy => expect(spy).toHaveBeenCalled());
        });
    });
});