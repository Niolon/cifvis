import * as THREE from 'three';
import { ViewerControls } from './viewer-controls.js';

/** @returns {{controls: ViewerControls, viewer: object}} Minimal controls test harness. */
function createControls() {
    const cameraState = {
        type: 'orthographic',
        position: [0, 0, 10],
        orthoSize: 5,
        pan: [0, 0],
        zoomScale: 1,
        quaternion: [0, 0, 0, 1],
    };
    const viewer = {
        cameraController: {
            applyCoupledViewState: vi.fn(),
            getCoupledViewState: vi.fn(() => cameraState),
            pan: vi.fn(),
            reset: vi.fn(),
            zoom: vi.fn(),
        },
        requestRender: vi.fn(),
        atomLabelManager: { invalidateLayout: vi.fn() },
    };
    const controls = Object.create(ViewerControls.prototype);
    controls.viewer = viewer;
    controls.moleculeContainer = new THREE.Group();
    controls.options = {
        interaction: { rotationSpeed: 5, lockRotation: false, lockZoom: false },
        camera: { wheelZoomSpeed: 0.001 },
    };
    controls.state = { isDragging: false, isPanning: false };
    controls.interactionCallbacks = new Set();
    controls.coupledInteractionStates = new Map();
    return { controls, viewer };
}

describe('ViewerControls coupled interactions', () => {
    test('broadcasts local rotation, pan, zoom, and reset operations', () => {
        const { controls, viewer } = createControls();
        const interactions = [];
        controls.onInteraction(interaction => interactions.push(interaction));

        controls.rotateStructure(new THREE.Vector2(0.1, -0.2));
        controls.panCamera(new THREE.Vector2(-0.3, 0.4));
        controls.handleZoom(0.05);
        controls.resetCameraPosition();

        expect(interactions).toEqual([
            {
                type: 'rotate',
                matrix: controls.moleculeContainer.matrix.toArray(),
            },
            { type: 'camera', state: viewer.cameraController.getCoupledViewState() },
            { type: 'camera', state: viewer.cameraController.getCoupledViewState() },
            { type: 'camera', state: viewer.cameraController.getCoupledViewState() },
        ]);
        expect(viewer.requestRender).toHaveBeenCalledTimes(4);
    });

    test('replays remote operations silently and tracks peer interaction state', () => {
        const { controls, viewer } = createControls();
        const listener = vi.fn();
        const source = {};
        controls.onInteraction(listener);

        const targetPosition = new THREE.Vector3(3, -2, 1);
        const targetQuaternion = new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        const targetScale = new THREE.Vector3(1.2, 1.2, 1.2);
        const targetMatrix = new THREE.Matrix4().compose(
            targetPosition,
            targetQuaternion,
            targetScale,
        );
        controls.applyCoupledInteraction({
            type: 'rotate',
            matrix: targetMatrix.toArray(),
        }, source);
        const cameraState = viewer.cameraController.getCoupledViewState();
        controls.applyCoupledInteraction({ type: 'camera', state: cameraState }, source);
        controls.applyCoupledInteraction({
            type: 'interaction-state',
            isDragging: true,
            isPanning: false,
        }, source);

        expect(viewer.cameraController.applyCoupledViewState).toHaveBeenCalledWith(cameraState);
        expect(controls.moleculeContainer.position.distanceTo(targetPosition)).toBeCloseTo(0);
        expect(controls.moleculeContainer.quaternion.angleTo(targetQuaternion)).toBeCloseTo(0);
        expect(controls.moleculeContainer.scale.distanceTo(targetScale)).toBeCloseTo(0);
        expect(viewer.requestRender).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
        expect(controls.isInteracting()).toBe(true);

        controls.applyCoupledInteraction({
            type: 'interaction-state',
            isDragging: false,
            isPanning: false,
        }, source);
        expect(controls.isInteracting()).toBe(false);
        expect(viewer.atomLabelManager.invalidateLayout).toHaveBeenCalledTimes(1);
    });
});

describe('ViewerControls live-view helpers and gesture locks', () => {
    test('maps external Cartesian XYZ angles to Rz * Ry * Rx', () => {
        const { controls } = createControls();
        controls.setExternalEulerRotation({ x: 0.3, y: -0.4, z: 0.5 });

        const expected = new THREE.Matrix4()
            .makeRotationZ(0.5)
            .multiply(new THREE.Matrix4().makeRotationY(-0.4))
            .multiply(new THREE.Matrix4().makeRotationX(0.3));
        controls.moleculeContainer.matrix.elements.forEach((value, index) => {
            expect(value).toBeCloseTo(expected.elements[index]);
        });
    });

    test('blocks only pointer rotation and wheel zoom when locked', () => {
        const { controls, viewer } = createControls();
        controls.options.interaction.lockRotation = true;
        controls.options.interaction.lockZoom = true;
        controls.updateMouseCoordinates = vi.fn();
        controls.handleZoom = vi.fn();

        controls.handleMouseDown({ button: 0, clientX: 10, clientY: 20 });
        controls.handleWheel({ preventDefault: vi.fn(), deltaY: 5 });

        expect(controls.state.isDragging).toBe(false);
        expect(controls.handleZoom).not.toHaveBeenCalled();

        // The explicit control operation remains available to public callers.
        controls.rotateStructure(new THREE.Vector2(0.1, 0));
        expect(viewer.requestRender).toHaveBeenCalledTimes(1);
    });
});
