/**
 * Creates the appropriate camera controller type based on options.
 * @param {HTMLElement} container - DOM element containing the viewer
 * @param {object} options - Camera configuration options
 * @param {object} options.camera - Camera-specific options
 * @param {string} [options.camera.type] - Type of camera ('perspective' or 'orthographic')
 * @returns {AbstractCameraController} The created camera controller instance
 */
export function createCameraController(container: HTMLElement, options: {
    camera: {
        type?: string | undefined;
    };
}): AbstractCameraController;
/**
 * Abstract base class for camera controllers in CifVis.
 * Handles configuration, setup, updates, and interaction responses.
 */
declare class AbstractCameraController {
    /**
     * Creates a new camera controller instance.
     * @param {HTMLElement} container - The DOM container element
     * @param {object} options - Camera configuration options
     */
    constructor(container: HTMLElement, options: object);
    container: HTMLElement;
    options: object;
    cameraTarget: THREE.Vector3;
    /**
     * Creates and initializes the Three.js camera
     * @abstract
     * @returns {THREE.Camera} The created camera instance
     */
    createCamera(): THREE.Camera;
    /**
     * Adjusts camera to fit the structure
     * @abstract
     * @param {THREE.Object3D} _structureGroup - The molecular structure to fit in view
     */
    fitToStructure(_structureGroup: THREE.Object3D): void;
    /**
     * Handles zoom operations
     * @abstract
     * @param {number} _zoomDelta - Amount and direction of zoom
     */
    zoom(_zoomDelta: number): void;
    /**
     * Handles pan operations
     * @abstract
     * @param {THREE.Vector2} _delta - Amount and direction of pan in normalized coordinates
     */
    pan(_delta: THREE.Vector2): void;
    /**
     * Updates camera parameters when container is resized
     * @abstract
     */
    handleResize(): void;
    /**
     * Resets camera to default position
     */
    reset(): void;
    /**
     * Captures camera pan and zoom relative to this viewer's fitted size.
     * @abstract
     * @returns {object} Size-independent camera state
     */
    getCoupledViewState(): object;
    /**
     * Applies size-independent camera state captured from another viewer.
     * @abstract
     * @param {object} _state - Coupled camera state
     */
    applyCoupledViewState(_state: object): void;
}
import * as THREE from 'three';
export {};
//# sourceMappingURL=camera-controllers.d.ts.map