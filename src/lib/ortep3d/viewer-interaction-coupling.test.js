import * as THREE from 'three';
import { ViewerInteractionCoupling, coupleViewerInteractions } from './viewer-interaction-coupling.js';

/** @returns {object} Minimal viewer test double. */
function createViewer() {
    const callbacks = new Set();
    const modeCallbacks = new Set();
    const controls = {
        applyCoupledInteraction: vi.fn(),
        clearCoupledInteraction: vi.fn(),
        onInteraction: vi.fn(callback => {
            callbacks.add(callback);
            return () => callbacks.delete(callback);
        }),
        emit(interaction) {
            callbacks.forEach(callback => callback(interaction));
        },
    };
    const viewer = {
        controls,
        moleculeContainer: new THREE.Group(),
        cameraController: {
            getCoupledViewState: vi.fn(() => ({
                type: 'perspective',
                position: [0, 0, 10],
                positionScale: [0, 0, 1],
                quaternion: [0, 0, 0, 1],
            })),
            applyCoupledViewState: vi.fn(),
        },
        modifiers: {
            hydrogen: { mode: 'none' },
            disorder: { mode: 'all' },
            symmetry: { mode: 'none' },
        },
        onModifierModeChange: vi.fn(callback => {
            modeCallbacks.add(callback);
            return () => modeCallbacks.delete(callback);
        }),
        requestRender: vi.fn(),
    };
    viewer.setModifierModes = vi.fn(async (modes, behavior = {}) => {
        Object.entries(modes).forEach(([modifierName, mode]) => {
            viewer.modifiers[modifierName].mode = mode;
            modeCallbacks.forEach(callback => callback({
                modifierName,
                mode,
                coupled: behavior.broadcast === false,
            }));
        });
        return { success: true };
    });
    viewer.emitMode = change => modeCallbacks.forEach(callback => callback(change));
    controls.setStructureTransform = vi.fn(matrix => {
        viewer.moleculeContainer.matrix.fromArray(matrix);
        viewer.moleculeContainer.matrix.decompose(
            viewer.moleculeContainer.position,
            viewer.moleculeContainer.quaternion,
            viewer.moleculeContainer.scale,
        );
    });
    return viewer;
}

describe('ViewerInteractionCoupling', () => {
    let frameCallback;

    beforeEach(() => {
        frameCallback = null;
        vi.stubGlobal('requestAnimationFrame', vi.fn(callback => {
            frameCallback = callback;
            return 17;
        }));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('replays a frame batch to every peer and renders each peer once', () => {
        const source = createViewer();
        const peer1 = createViewer();
        const peer2 = createViewer();
        const coupling = coupleViewerInteractions(source, peer1, peer2);
        const rotate = {
            type: 'rotate',
            matrix: new THREE.Matrix4().makeRotationY(0.2).toArray(),
        };
        const camera = { type: 'camera', state: source.cameraController.getCoupledViewState() };

        source.controls.emit(rotate);
        source.controls.emit(camera);

        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
        expect(peer1.controls.applyCoupledInteraction).not.toHaveBeenCalled();
        frameCallback();

        for (const peer of [peer1, peer2]) {
            expect(peer.controls.applyCoupledInteraction.mock.calls).toEqual([
                [rotate, source],
                [camera, source],
            ]);
            expect(peer.requestRender).toHaveBeenCalledTimes(1);
        }
        expect(source.controls.applyCoupledInteraction).not.toHaveBeenCalled();
        expect(source.requestRender).not.toHaveBeenCalled();

        source.controls.applyCoupledInteraction.mockClear();
        source.requestRender.mockClear();
        peer1.controls.emit(camera);
        frameCallback();
        expect(source.controls.applyCoupledInteraction).toHaveBeenCalledWith(
            camera,
            peer1,
        );
        expect(source.requestRender).toHaveBeenCalledTimes(1);
        coupling.dispose();
    });

    test('synchronizes current modes, complete structure transform, and camera state', async () => {
        const source = createViewer();
        const peer = createViewer();
        source.moleculeContainer.position.set(0.75, -0.5, 1.25);
        source.moleculeContainer.rotation.set(0.2, -0.4, 0.1);
        source.moleculeContainer.scale.setScalar(1.15);
        peer.moleculeContainer.position.set(-2, 0, 0);
        const coupling = coupleViewerInteractions(source, peer);

        source.modifiers.hydrogen.mode = 'constant';
        await coupling.synchronizeFrom(source);

        expect(peer.modifiers.hydrogen.mode).toBe('constant');
        expect(peer.moleculeContainer.position.distanceTo(source.moleculeContainer.position))
            .toBeCloseTo(0);
        expect(peer.moleculeContainer.quaternion.angleTo(source.moleculeContainer.quaternion))
            .toBeCloseTo(0);
        expect(peer.moleculeContainer.scale.distanceTo(source.moleculeContainer.scale)).toBeCloseTo(0);
        expect(peer.cameraController.applyCoupledViewState).toHaveBeenCalledWith(
            source.cameraController.getCoupledViewState(),
        );
        expect(peer.requestRender).toHaveBeenCalledTimes(1);
        coupling.dispose();
    });

    test('propagates applicable semantic modes in both directions without feedback', async () => {
        const viewer1 = createViewer();
        const viewer2 = createViewer();
        const coupling = coupleViewerInteractions(viewer1, viewer2);

        viewer1.modifiers.hydrogen.mode = 'constant';
        viewer1.emitMode({ modifierName: 'hydrogen', mode: 'constant' });
        await coupling.settled();
        expect(viewer2.setModifierModes).toHaveBeenCalledWith(
            { hydrogen: 'constant' },
            { broadcast: false },
        );
        expect(viewer2.modifiers.hydrogen.mode).toBe('constant');
        expect(viewer1.setModifierModes).not.toHaveBeenCalled();

        viewer2.modifiers.disorder.mode = 'group1';
        viewer2.emitMode({ modifierName: 'disorder', mode: 'group1' });
        await coupling.settled();
        expect(viewer1.modifiers.disorder.mode).toBe('group1');
        coupling.dispose();
    });

    test('accepts widgets, detaches peers, and clears their remote interaction state', () => {
        const viewer1 = createViewer();
        const viewer2 = createViewer();
        const widget1 = { viewer: viewer1 };
        const widget2 = { viewer: viewer2 };
        const coupling = new ViewerInteractionCoupling([widget1, widget2]);

        expect(coupling.delete(widget2)).toBe(true);
        expect(viewer1.controls.clearCoupledInteraction).toHaveBeenCalledWith(viewer2);
        expect(viewer2.controls.clearCoupledInteraction).toHaveBeenCalledWith(viewer1);

        viewer1.controls.emit({ type: 'camera', state: viewer1.cameraController.getCoupledViewState() });
        frameCallback();
        expect(viewer2.controls.applyCoupledInteraction).not.toHaveBeenCalled();
        coupling.dispose();
    });

    test('rejects uninitialized widgets with a useful error', () => {
        expect(() => coupleViewerInteractions({ viewer: null })).toThrow(
            'Coupled participants must be CrystalViewer or initialized cifview-widget instances',
        );
    });
});

describe('mode coupling opt-out', () => {
    test('synchronizeFrom copies display modes by default', async () => {
        const source = createViewer();
        const peer = createViewer();
        source.modifiers.hydrogen.mode = 'anisotropic';

        const coupling = coupleViewerInteractions(source, peer);
        await coupling.synchronizeFrom(source);

        expect(peer.modifiers.hydrogen.mode).toBe('anisotropic');
    });

    test('{ modes: false } leaves each viewer showing what it was given', async () => {
        // The case this exists for: a refined model with anisotropic hydrogens
        // beside an input model without them. Copying modes would silently drop
        // the refined viewer back to spheres.
        const refined = createViewer();
        const input = createViewer();
        refined.modifiers.hydrogen.mode = 'anisotropic';
        input.modifiers.hydrogen.mode = 'none';

        const coupling = coupleViewerInteractions(refined, input);
        await coupling.synchronizeFrom(refined, { modes: false });

        expect(refined.modifiers.hydrogen.mode).toBe('anisotropic');
        expect(input.modifiers.hydrogen.mode).toBe('none');
        // the view is still shared
        expect(input.cameraController.applyCoupledViewState).toHaveBeenCalled();
    });

    test('coupleModes:false disables ongoing mode propagation too', async () => {
        const source = createViewer();
        const peer = createViewer();

        const coupling = coupleViewerInteractions(source, peer, { coupleModes: false });
        await coupling.synchronizeFrom(source);
        peer.setModifierModes.mockClear();

        // a mode change on one viewer must not reach the other
        source.emitMode({ modifierName: 'hydrogen', mode: 'constant' });
        await coupling.pendingModeUpdate;

        expect(peer.setModifierModes).not.toHaveBeenCalled();
        expect(coupling.coupleModes).toBe(false);
    });

    test('synchronizeViewFrom shares the view without touching modes', async () => {
        const source = createViewer();
        const peer = createViewer();
        source.modifiers.hydrogen.mode = 'anisotropic';

        const coupling = coupleViewerInteractions(source, peer);
        coupling.synchronizeViewFrom(source);

        expect(peer.modifiers.hydrogen.mode).toBe('none');
        expect(peer.cameraController.applyCoupledViewState).toHaveBeenCalled();
    });

    test('synchronizeViewFrom rejects a source outside the coupling', () => {
        const coupling = coupleViewerInteractions(createViewer(), createViewer());
        expect(() => coupling.synchronizeViewFrom(createViewer())).toThrow(
            /must belong to this coupling/,
        );
    });
});
