import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { setupLighting } from './staging.js';

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
