import '@testing-library/jest-dom';
import { fireEvent, createEvent } from '@testing-library/dom';
import { ViewerControls } from './viewer-controls.js';
import * as THREE from 'three';
//import { CrystalViewer } from './crystal-viewer.js';

// Mock THREE.js
jest.mock('three', () => {
    const mockVector3 = jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
        x,
        y,
        z,
        set: jest.fn(),
        copy: jest.fn(),
        clone: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        multiplyScalar: jest.fn().mockReturnThis(),
        addScaledVector: jest.fn(),
        length: jest.fn().mockReturnValue(10),
    }));

    const mockVector2 = jest.fn().mockImplementation((x = 0, y = 0) => ({
        x,
        y,
        set: jest.fn(),
        copy: jest.fn(),
        clone: jest.fn().mockReturnThis(),
        sub: jest.fn().mockReturnThis(),
    }));

    return {
        Vector3: mockVector3,
        Vector2: mockVector2,
        PerspectiveCamera: jest.fn().mockImplementation(() => ({
            position: new mockVector3(0, 0, 10),
            aspect: 1.33,
            fov: 45,
            updateProjectionMatrix: jest.fn(),
            lookAt: jest.fn(),
            matrix: {
                extractBasis: jest.fn().mockImplementation((r, u) => {
                    r.set(1, 0, 0);
                    u.set(0, 1, 0);
                }),
            },
        })),
        Group: jest.fn().mockImplementation(() => ({
            traverse: jest.fn(),
            applyMatrix4: jest.fn(),
            matrixAutoUpdate: true,
            updateMatrix: jest.fn(),
            updateMatrixWorld: jest.fn(),
        })),
        Matrix4: jest.fn().mockImplementation(() => ({
            makeRotationAxis: jest.fn().mockReturnThis(),
            makeRotationFromQuaternion: jest.fn().mockReturnThis(),
            multiply: jest.fn().mockReturnThis(),
            premultiply: jest.fn().mockReturnThis(),
            setPosition: jest.fn().mockReturnThis(),
            extractBasis: jest.fn(),
        })),
        Raycaster: jest.fn().mockImplementation(() => ({
            setFromCamera: jest.fn(),
            intersectObjects: jest.fn().mockReturnValue([]),
            params: {
                Line: { threshold: 0 },
                Points: { threshold: 0 },
                Mesh: { threshold: 0 },
            },
        })),
        MathUtils: {
            clamp: jest.fn().mockImplementation((val, min, max) => Math.min(Math.max(val, min), max)),
        },
    };
});

describe('ViewerControls', () => {
    let controls;
    let mockViewer;
    let canvas;

    beforeEach(() => {
        // Set up canvas with getBoundingClientRect
        canvas = document.createElement('div');
        Object.defineProperty(canvas, 'getBoundingClientRect', {
            value: jest.fn().mockReturnValue({
                width: 800,
                height: 600,
                left: 0,
                top: 0,
                right: 800,
                bottom: 600,
            }),
        });

        // Create mock viewer
        mockViewer = {
            //container: document.createElement('div'),
            container: canvas,
            camera: new THREE.PerspectiveCamera(),
            renderer: {
                domElement: canvas,
                setSize: jest.fn(),
            },
            moleculeContainer: new THREE.Group(),
            selections: {
                handle: jest.fn(),
                clear: jest.fn(),
            },
            requestRender: jest.fn(),
            options: {
                camera: {
                    minDistance: 1,
                    maxDistance: 100,
                    wheelZoomSpeed: 0.1,
                    pinchZoomSpeed: 0.001,
                    fov: 45,
                    near: 0.1,
                    far: 1000,
                },
                interaction: {
                    rotationSpeed: 5,
                    clickThreshold: 200,
                    mouseRaycast: {
                        lineThreshold: 0.5,
                        pointsThreshold: 0.5,
                        meshThreshold: 0.1,
                    },
                    touchRaycast: {
                        lineThreshold: 2.0,
                        pointsThreshold: 2.0,
                        meshThreshold: 0.2,
                    },
                },
            },
        };

        controls = new ViewerControls(mockViewer);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('initializes with correct state', () => {
            expect(controls.state.isDragging).toBe(false);
            expect(controls.state.isPanning).toBe(false);
            expect(controls.state.mouse).toBeDefined();
            expect(controls.raycaster).toBeDefined();
        });

        test('sets up raycaster with correct parameters', () => {
            expect(controls.raycaster.near).toBe(0.1);
            expect(controls.raycaster.far).toBe(100);
        });
    });

    describe('Coordinate Conversion', () => {
        test('converts client coordinates to NDC correctly', () => {
            const coords = controls.clientToMouseCoordinates(400, 300);
            expect(coords.x).toBe(0);  // Center of 800px width
            expect(coords.y).toBe(0);  // Center of 600px height
        });

        test('handles coordinates at viewport edges', () => {
            const topLeft = controls.clientToMouseCoordinates(0, 0);
            expect(topLeft.x).toBe(-1);
            expect(topLeft.y).toBe(1);

            const bottomRight = controls.clientToMouseCoordinates(800, 600);
            expect(bottomRight.x).toBe(1);
            expect(bottomRight.y).toBe(-1);
        });
    });

    describe('Mouse Interaction', () => {
        test('handles mouse drag rotation', () => {
            // Start drag
            fireEvent.mouseDown(canvas, {
                clientX: 400,
                clientY: 300,
                button: 0,
            });

            // Move mouse
            fireEvent.mouseMove(canvas, {
                clientX: 500,
                clientY: 400,
            });

            expect(mockViewer.moleculeContainer.applyMatrix4).toHaveBeenCalled();
            expect(mockViewer.requestRender).toHaveBeenCalled();
        });

        test('handles mouse wheel zoom', () => {
            const x0 = mockViewer.camera.position.x;
            const y0 = mockViewer.camera.position.x;
            const z0 = mockViewer.camera.position.z;

            const wheelEvent = createEvent.wheel(canvas, {
                deltaY: 100,
            });
            
            fireEvent(canvas, wheelEvent);

            expect(mockViewer.requestRender).toHaveBeenCalled();
            expect(x0 - mockViewer.camera.position.x).not.toBe(0);
            expect(y0 - mockViewer.camera.position.y).not.toBe(0);
            expect(z0 - mockViewer.camera.position.z).not.toBe(0);

        });

        test('handles object selection on click', () => {
            const mockObject = { userData: { selectable: true } };
            controls.raycaster.intersectObjects.mockReturnValueOnce([{ object: mockObject }]);

            fireEvent.click(canvas, {
                clientX: 400,
                clientY: 300,
                button: 0,
            });

            expect(mockViewer.selections.handle).toHaveBeenCalledWith(mockObject);
        });

        test('clears selection on double click empty space', () => {
            controls.state.lastClickTime = Date.now() - 100;
            controls.raycaster.intersectObjects.mockReturnValueOnce([]);

            fireEvent.click(canvas, {
                clientX: 400,
                clientY: 300,
                button: 0,
            });

            fireEvent.click(canvas, {
                clientX: 400,
                clientY: 300,
                button: 0,
            });

            expect(mockViewer.selections.clear).toHaveBeenCalled();
        });
    });

    describe('Touch Interaction', () => {
        test('handles single touch drag', () => {
            // Create touch events
            const touchStart = new TouchEvent('touchstart', {
                touches: [new Touch({
                    identifier: 0,
                    target: canvas,
                    clientX: 400,
                    clientY: 300,
                })],
            });

            const touchMove = new TouchEvent('touchmove', {
                touches: [new Touch({
                    identifier: 0,
                    target: canvas,
                    clientX: 500,
                    clientY: 400,
                })],
            });

            fireEvent(canvas, touchStart);
            fireEvent(canvas, touchMove);

            expect(mockViewer.moleculeContainer.applyMatrix4).toHaveBeenCalled();
            expect(mockViewer.requestRender).toHaveBeenCalled();
        });

        test('handles pinch zoom', () => {
            const touchStart = new TouchEvent('touchstart', {
                touches: [
                    new Touch({
                        identifier: 0,
                        target: canvas,
                        clientX: 300,
                        clientY: 200,
                    }),
                    new Touch({
                        identifier: 1,
                        target: canvas,
                        clientX: 500,
                        clientY: 400,
                    }),
                ],
            });

            const touchMove = new TouchEvent('touchmove', {
                touches: [
                    new Touch({
                        identifier: 0,
                        target: canvas,
                        clientX: 350,
                        clientY: 250,
                    }),
                    new Touch({
                        identifier: 1,
                        target: canvas,
                        clientX: 450,
                        clientY: 350,
                    }),
                ],
            });

            fireEvent(canvas, touchStart);
            fireEvent(canvas, touchMove);

            expect(mockViewer.requestRender).toHaveBeenCalled();
        });
    });

    describe('Camera Controls', () => {
        test('pans camera correct distance in projected space', () => {
            mockViewer.camera.position.z = 10;
            mockViewer.camera.fov = 45;
            mockViewer.camera.aspect = 800/600;

            const right = new THREE.Vector3(1, 0, 0);
            const up = new THREE.Vector3(0, 1, 0);
            
            mockViewer.camera.matrix.extractBasis.mockImplementation((r, u) => {
                r.copy(right);
                u.copy(up);
            });

            const fovRadians = 45 * Math.PI / 180;
            const frustumHeight = 2 * Math.tan(fovRadians / 2) * 10;
            const frustumWidth = frustumHeight * (800/600);

            const delta = new THREE.Vector2(0.5, 0.25);
            controls.panCamera(delta);

            const expectedMoveX = -0.5 * frustumWidth;
            const expectedMoveY = -0.25 * frustumHeight;

            expect(mockViewer.camera.position.addScaledVector)
                .toHaveBeenCalledWith(right, expectedMoveX);
            expect(mockViewer.camera.position.addScaledVector)
                .toHaveBeenCalledWith(up, expectedMoveY);
        });

        test('maintains aspect ratio during window resize', () => {
            mockViewer.container.getBoundingClientRect = jest.fn().mockReturnValue({
                width: 1000,
                height: 500,
            });

            controls.handleResize();

            expect(mockViewer.camera.updateProjectionMatrix).toHaveBeenCalled();
            expect(mockViewer.renderer.setSize).toHaveBeenCalledWith(1000, 500);
            expect(mockViewer.requestRender).toHaveBeenCalled();
        });

        test('resets camera position on double right click', () => {
            controls.state.lastRightClickTime = Date.now() - 100;
            
            const contextMenuEvent = new MouseEvent('contextmenu', {
                clientX: 400,
                clientY: 300,
            });

            fireEvent(canvas, contextMenuEvent);

            expect(mockViewer.camera.position.set).toHaveBeenCalled();
            expect(mockViewer.requestRender).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('removes all event listeners on dispose', () => {
            const removeEventListenerSpy = jest.spyOn(canvas, 'removeEventListener');
            
            controls.dispose();
            
            expect(removeEventListenerSpy).toHaveBeenCalledTimes(10); // All event types
        });
    });
});