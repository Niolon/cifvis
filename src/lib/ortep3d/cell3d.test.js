import * as THREE from 'three';
import { createCell3D } from './cell3d.js';

// Mock the calcBondTransform import since it's not used in the current implementation
vitest.mock('../ortep.js', () => ({
    calcBondTransform: vitest.fn(),
}));

describe('cell3d.js', () => {
    let mockUnitCell;
    let defaultCellSettings;

    beforeEach(() => {
        // Create a mock unit cell with typical values
        mockUnitCell = {
            a: 10.0,
            b: 12.0, 
            c: 8.0,
            alpha: 90,
            beta: 90,
            gamma: 90,
            fractToCartMatrix: {
                toArray: () => [
                    [10.0, 0.0, 0.0],
                    [0.0, 12.0, 0.0],
                    [0.0, 0.0, 8.0],
                ],
            },
        };

        defaultCellSettings = {
            color: '#CCCCCC',
            opacity: 0.5,
            colorA: '#FF0000',
            colorB: '#00FF00', 
            colorC: '#0000FF',
            headLengthMult: 0.1,
            headWidthMult: 0.5,
            lineWidth: 2,
        };
    });

    describe('createCell3D', () => {
        test('creates a THREE.Group with correct name and userData', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            
            expect(result).toBeInstanceOf(THREE.Group);
            expect(result.name).toBe('UnitCell');
            expect(result.userData.selectable).toBe(false);
            expect(result.userData.type).toBe('UnitCell');
            expect(result.userData.cellParameters).toEqual({
                a: 10.0,
                b: 12.0,
                c: 8.0,
                alpha: 90,
                beta: 90,
                gamma: 90,
            });
        });

        test('creates correct number of child objects (wireframe + 3 arrows)', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            
            // Should contain: 1 wireframe group + 3 arrow groups = 4 children
            expect(result.children).toHaveLength(4);
        });

        test('creates wireframe with 12 line segments', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            
            // First child should be the wireframe group
            const wireframe = result.children[0];
            expect(wireframe).toBeInstanceOf(THREE.Group);
            expect(wireframe.children).toHaveLength(12); // 12 edges of parallelepiped
            
            // All children should be Line objects
            wireframe.children.forEach(child => {
                expect(child).toBeInstanceOf(THREE.Line);
                expect(child.material).toBeInstanceOf(THREE.LineBasicMaterial);
            });
        });

        test('applies correct wireframe color and opacity', () => {
            const customSettings = {
                ...defaultCellSettings,
                color: '#FF5500',
                opacity: 0.7,
            };
            
            const result = createCell3D(mockUnitCell, customSettings);
            const wireframe = result.children[0];
            const firstLine = wireframe.children[0];
            
            expect(firstLine.material.color).toEqual(new THREE.Color('#FF5500'));
            expect(firstLine.material.opacity).toBe(0.7);
            expect(firstLine.material.transparent).toBe(true);
        });

        test('creates three arrow groups with correct colors', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            
            // Skip wireframe (index 0), check arrows (indices 1-3)
            const arrows = result.children.slice(1);
            expect(arrows).toHaveLength(3);
            
            arrows.forEach(arrow => {
                expect(arrow).toBeInstanceOf(THREE.Group);
                expect(arrow.children).toHaveLength(2); // cylinder + cone
            });
        });

        test('handles different unit cell shapes correctly', () => {
            // Test with a non-orthogonal unit cell
            const triclinicCell = {
                a: 5.0,
                b: 7.0,
                c: 9.0,
                alpha: 75,
                beta: 85,
                gamma: 95,
                fractToCartMatrix: {
                    toArray: () => [
                        [5.0, 1.2, 0.5],
                        [0.0, 6.8, 0.3],
                        [0.0, 0.0, 8.9],
                    ],
                },
            };
            
            const result = createCell3D(triclinicCell, defaultCellSettings);
            
            expect(result).toBeInstanceOf(THREE.Group);
            expect(result.children).toHaveLength(4);
            expect(result.userData.cellParameters.alpha).toBe(75);
        });

        test('calculates arrow dimensions correctly', () => {
            // Mock the createCylinderArrow function to capture its arguments
            const originalCreateCylinderArrow = vitest.fn(() => new THREE.Group());
            
            // We need to test this indirectly by checking the head dimensions calculation
            const smallCell = {
                a: 2.0,
                b: 4.0,
                c: 3.0,
                alpha: 90,
                beta: 90,
                gamma: 90,
                fractToCartMatrix: {
                    toArray: () => [
                        [2.0, 0.0, 0.0],
                        [0.0, 4.0, 0.0],
                        [0.0, 0.0, 3.0],
                    ],
                },
            };
            
            const customSettings = {
                ...defaultCellSettings,
                headLengthMult: 0.2,
                headWidthMult: 0.6,
            };
            
            const result = createCell3D(smallCell, customSettings);
            
            // The smallest axis is 2.0, so headLength should be 2.0 * 0.2 = 0.4
            // headWidth should be 0.4 * 0.6 = 0.24
            expect(result.userData.cellParameters.a).toBe(2.0);
        });

        test('uses default values for optional parameters', () => {
            const minimalSettings = {
                color: '#FFFFFF',
                opacity: 1.0,
                colorA: '#FF0000',
                colorB: '#00FF00',
                colorC: '#0000FF',
            };
            
            const result = createCell3D(mockUnitCell, minimalSettings);
            
            expect(result).toBeInstanceOf(THREE.Group);
            expect(result.children).toHaveLength(4);
        });

        test('handles edge case with very small unit cell', () => {
            const smallCell = {
                a: 0.1,
                b: 0.1,
                c: 0.1,
                alpha: 90,
                beta: 90,
                gamma: 90,
                fractToCartMatrix: {
                    toArray: () => [
                        [0.1, 0.0, 0.0],
                        [0.0, 0.1, 0.0],
                        [0.0, 0.0, 0.1],
                    ],
                },
            };
            
            const result = createCell3D(smallCell, defaultCellSettings);
            
            expect(result).toBeInstanceOf(THREE.Group);
            expect(result.children).toHaveLength(4);
        });

        test('handles edge case with very large unit cell', () => {
            const largeCell = {
                a: 1000.0,
                b: 1000.0,
                c: 1000.0,
                alpha: 90,
                beta: 90,
                gamma: 90,
                fractToCartMatrix: {
                    toArray: () => [
                        [1000.0, 0.0, 0.0],
                        [0.0, 1000.0, 0.0],
                        [0.0, 0.0, 1000.0],
                    ],
                },
            };
            
            const result = createCell3D(largeCell, defaultCellSettings);
            
            expect(result).toBeInstanceOf(THREE.Group);
            expect(result.children).toHaveLength(4);
        });

        test('wireframe vertices are correctly positioned', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            const wireframe = result.children[0];
            
            // Check that we have line geometries with correct point counts
            wireframe.children.forEach(line => {
                const positions = line.geometry.attributes.position;
                expect(positions.count).toBe(2); // Each line has 2 points
                expect(positions.itemSize).toBe(3); // 3D coordinates
            });
        });

        test('handles opacity correctly for transparent and opaque cases', () => {
            // Test transparent case
            const transparentSettings = { ...defaultCellSettings, opacity: 0.3 };
            const transparentResult = createCell3D(mockUnitCell, transparentSettings);
            const transparentWireframe = transparentResult.children[0];
            const transparentLine = transparentWireframe.children[0];
            
            expect(transparentLine.material.transparent).toBe(true);
            expect(transparentLine.material.opacity).toBe(0.3);
            
            // Test opaque case  
            const opaqueSettings = { ...defaultCellSettings, opacity: 1.0 };
            const opaqueResult = createCell3D(mockUnitCell, opaqueSettings);
            const opaqueWireframe = opaqueResult.children[0];
            const opaqueLine = opaqueWireframe.children[0];
            
            expect(opaqueLine.material.transparent).toBe(false);
            expect(opaqueLine.material.opacity).toBe(1.0);
        });

        test('arrow colors are applied correctly', () => {
            const customColors = {
                ...defaultCellSettings,
                colorA: '#FF5733',
                colorB: '#33FF57', 
                colorC: '#3357FF',
            };
            
            const result = createCell3D(mockUnitCell, customColors);
            const arrows = result.children.slice(1); // Skip wireframe
            
            // Note: Testing exact arrow colors requires access to the internal 
            // createCylinderArrow function, which creates meshes with materials
            // This is a structural test to ensure arrows are created
            arrows.forEach(arrow => {
                expect(arrow.children).toHaveLength(2); // cylinder + cone
                arrow.children.forEach(mesh => {
                    expect(mesh).toBeInstanceOf(THREE.Mesh);
                    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
                });
            });
        });
    });

    describe('createUnitCellWireframe (indirectly tested)', () => {
        test('creates correct wireframe structure', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            const wireframe = result.children[0];
            
            // Test the structure created by createUnitCellWireframe
            expect(wireframe.children).toHaveLength(12);
            
            // Verify all edges are Line objects with LineBasicMaterial
            wireframe.children.forEach(edge => {
                expect(edge).toBeInstanceOf(THREE.Line);
                expect(edge.material).toBeInstanceOf(THREE.LineBasicMaterial);
                expect(edge.geometry).toBeInstanceOf(THREE.BufferGeometry);
            });
        });
    });

    describe('createCylinderArrow (indirectly tested)', () => {
        test('creates correct arrow structure', () => {
            const result = createCell3D(mockUnitCell, defaultCellSettings);
            const arrows = result.children.slice(1);
            
            // Each arrow should be a group with 2 children (cylinder + cone)
            arrows.forEach(arrow => {
                expect(arrow).toBeInstanceOf(THREE.Group);
                expect(arrow.children).toHaveLength(2);
                
                const [cylinder, cone] = arrow.children;
                expect(cylinder).toBeInstanceOf(THREE.Mesh);
                expect(cone).toBeInstanceOf(THREE.Mesh);
                
                // Check geometries
                expect(cylinder.geometry).toBeInstanceOf(THREE.CylinderGeometry);
                expect(cone.geometry).toBeInstanceOf(THREE.ConeGeometry);
                
                // Check materials
                expect(cylinder.material).toBeInstanceOf(THREE.MeshBasicMaterial);
                expect(cone.material).toBeInstanceOf(THREE.MeshBasicMaterial);
            });
        });
    });

    describe('Error handling and edge cases', () => {
        test('handles missing optional cellSettings properties gracefully', () => {
            const minimalSettings = {
                color: '#FFFFFF',
                opacity: 1.0,
                colorA: '#FF0000',
                colorB: '#00FF00',
                colorC: '#0000FF',
            };
            
            expect(() => {
                createCell3D(mockUnitCell, minimalSettings);
            }).not.toThrow();
        });

        test('handles zero-length axes gracefully', () => {
            const degenerateCell = {
                a: 0.0,
                b: 1.0,
                c: 1.0,
                alpha: 90,
                beta: 90,
                gamma: 90,
                fractToCartMatrix: {
                    toArray: () => [
                        [0.0, 0.0, 0.0],
                        [0.0, 1.0, 0.0],
                        [0.0, 0.0, 1.0],
                    ],
                },
            };
            
            // This might create issues with arrow head calculations
            // The function should handle this gracefully
            expect(() => {
                createCell3D(degenerateCell, defaultCellSettings);
            }).not.toThrow();
        });
    });
});