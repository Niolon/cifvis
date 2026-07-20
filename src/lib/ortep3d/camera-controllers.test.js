import * as THREE from 'three';
import { createCameraController } from './camera-controllers.js';
import defaultSettings from './structure-settings.js';

/** @returns {object} Fixed-size camera host. */
function createContainer() {
    return { clientWidth: 800, clientHeight: 600 };
}

/**
 * @param {string} type - Camera type
 * @returns {object} Camera options wrapper
 */
function createOptions(type) {
    return {
        camera: {
            ...defaultSettings.camera,
            type,
            initialPosition: new THREE.Vector3(...defaultSettings.camera.initialPosition),
        },
    };
}

describe('coupled camera view state', () => {
    test('copies absolute perspective camera distance and pan', () => {
        const source = createCameraController(createContainer(), createOptions('perspective'));
        const target = createCameraController(createContainer(), createOptions('perspective'));
        source.basePosition = new THREE.Vector3(0, 0, 10);
        target.basePosition = new THREE.Vector3(0, 0, 20);
        source.camera.position.set(2, -1, 5);

        target.applyCoupledViewState(source.getCoupledViewState());

        expect(target.camera.position.toArray()).toEqual([2, -1, 5]);
    });

    test('copies absolute orthographic pan and frustum size', () => {
        const source = createCameraController(createContainer(), createOptions('orthographic'));
        const target = createCameraController(createContainer(), createOptions('orthographic'));
        source.baseSize = 5;
        target.baseSize = 10;
        source.basePosition = new THREE.Vector3(0, 0, 8);
        target.basePosition = new THREE.Vector3(0, 0, 16);
        source.camera.position.set(1, -2, 8);
        source.setOrthoSize(2.5);

        target.applyCoupledViewState(source.getCoupledViewState());

        expect(target.camera.position.toArray()).toEqual([1, -2, 8]);
        expect(target.camera.top).toBeCloseTo(2.5);
    });
});
