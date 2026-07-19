import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { setupLighting, structureOrientationMatrix } from './staging.js';

/**
 * Returns direct scene children of a specific light class.
 * @param {THREE.Scene} scene - Scene to inspect
 * @param {typeof THREE.Light} lightClass - THREE light constructor
 * @returns {THREE.Light[]} Matching lights
 */
function getLights(scene, lightClass) {
    return scene.children.filter(child => child instanceof lightClass);
}

describe('setupLighting', () => {
    test('uses one square softbox and two inexpensive fill lights', () => {
        const scene = new THREE.Scene();
        scene.add(new THREE.SpotLight());
        const structure = new THREE.Group();
        const extent = new THREE.Box3(
            new THREE.Vector3(-10, -5, -2),
            new THREE.Vector3(10, 5, 2),
        );

        setupLighting(scene, structure, extent);

        const softboxes = getLights(scene, THREE.RectAreaLight);
        expect(softboxes).toHaveLength(1);
        expect(softboxes[0].width).toBe(softboxes[0].height);
        expect(softboxes[0].castShadow).toBe(false);
        expect(getLights(scene, THREE.SpotLight)).toHaveLength(0);
        expect(getLights(scene, THREE.DirectionalLight)).toHaveLength(2);
        expect(getLights(scene, THREE.AmbientLight)).toHaveLength(1);
    });

    test('keeps softbox size and distance proportional for large structures', () => {
        const structure = new THREE.Group();
        const smallScene = new THREE.Scene();
        const largeScene = new THREE.Scene();
        const smallExtent = new THREE.Box3(
            new THREE.Vector3(-10, -10, -10),
            new THREE.Vector3(10, 10, 10),
        );
        const largeExtent = new THREE.Box3(
            new THREE.Vector3(-50, -50, -50),
            new THREE.Vector3(50, 50, 50),
        );

        setupLighting(smallScene, structure, smallExtent);
        setupLighting(largeScene, structure, largeExtent);

        const smallSoftbox = getLights(smallScene, THREE.RectAreaLight)[0];
        const largeSoftbox = getLights(largeScene, THREE.RectAreaLight)[0];
        const sizeScale = largeSoftbox.width / smallSoftbox.width;
        const distanceScale = largeSoftbox.position.length() / smallSoftbox.position.length();
        expect(sizeScale).toBeCloseTo(5);
        expect(distanceScale).toBeCloseTo(sizeScale);
        expect(largeSoftbox.intensity).toBe(smallSoftbox.intensity);
    });
});

/**
 * Builds a group of fake atom objects on a tilted plane.
 * @param {boolean} instanced - Whether atoms carry their transform in an
 *  instance matrix (pooled solid-3d style) instead of Object3D.position
 * @returns {{group: THREE.Group, normal: THREE.Vector3}} Group and plane normal
 */
function planarStructure(instanced) {
    const group = new THREE.Group();
    const normal = new THREE.Vector3(1, 1, 0).normalize();
    const u = new THREE.Vector3(0, 0, 1);
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    // A clearly anisotropic in-plane point set (long along u).
    const coefficients = [[-4, 0], [-2, 1], [0, -1], [2, 1], [4, 0], [1, -1.5]];
    for (const [a, b] of coefficients) {
        const position = new THREE.Vector3()
            .addScaledVector(u, a)
            .addScaledVector(v, b);
        const atom = new THREE.Object3D();
        atom.userData = { type: 'atom' };
        if (instanced) {
            atom.segments = [{ matrix: new THREE.Matrix4().makeTranslation(...position) }];
        } else {
            atom.position.copy(position);
        }
        group.add(atom);
    }
    return { group, normal };
}

/**
 * Measures how face-on the oriented plane is: |z| of the rotated normal.
 * @param {THREE.Matrix4} rotation - Result of structureOrientationMatrix
 * @param {THREE.Vector3} normal - Original plane normal
 * @returns {number} Absolute z component of the rotated normal (1 = face-on)
 */
function rotatedNormalZ(rotation, normal) {
    return Math.abs(normal.clone().applyMatrix4(rotation).z);
}

describe('structureOrientationMatrix', () => {
    test('orients a planar structure face-on for positioned atoms', () => {
        const { group, normal } = planarStructure(false);
        const rotation = structureOrientationMatrix(group);
        // The deliberate perception tilt (pi/8 + pi/48) keeps |z| just below 1.
        expect(rotatedNormalZ(rotation, normal)).toBeGreaterThan(0.9);
    });

    test('orients pooled/instanced atoms identically (solid-3d regression)', () => {
        const positioned = planarStructure(false);
        const instanced = planarStructure(true);
        const rotationPositioned = structureOrientationMatrix(positioned.group);
        const rotationInstanced = structureOrientationMatrix(instanced.group);
        expect(rotatedNormalZ(rotationInstanced, instanced.normal)).toBeGreaterThan(0.9);
        expect(rotationInstanced.elements.map((e) => Number(e.toFixed(8))))
            .toEqual(rotationPositioned.elements.map((e) => Number(e.toFixed(8))));
    });

    test('returns null for a group without atoms', () => {
        expect(structureOrientationMatrix(new THREE.Group())).toBe(null);
    });
});
