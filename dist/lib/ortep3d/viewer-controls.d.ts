/**
 * Controls user interaction with the 3D crystal structure viewer.
 * Handles mouse, touch, and wheel events for rotation, zoom, panning, and selection.
 */
export class ViewerControls {
    /**
     * Creates a new viewer controls instance.
     * @param {object} viewer - The crystal viewer instance to control
     */
    constructor(viewer: object);
    viewer: object;
    state: {
        isDragging: boolean;
        isPanning: boolean;
        mouse: THREE.Vector2;
        lastClickTime: number;
        clickStartTime: number;
        pinchStartDistance: number;
        lastTouchRotation: number;
        lastRightClickTime: number;
        twoFingerStartPos: THREE.Vector2;
        initialCameraPosition: any;
    };
    container: any;
    camera: any;
    renderer: any;
    moleculeContainer: any;
    options: any;
    doubleClickDelay: number;
    interactionCallbacks: Set<any>;
    coupledInteractionStates: Map<any, any>;
    raycaster: THREE.Raycaster;
    /**
     * Binds all event handlers to maintain proper 'this' context.
     * @private
     */
    private bindEventHandlers;
    boundHandlers: {
        wheel: (event: WheelEvent) => void;
        mouseDown: (event: MouseEvent) => void;
        mouseMove: (event: MouseEvent) => void;
        mouseUp: () => void;
        click: (event: MouseEvent) => void;
        contextMenu: (event: MouseEvent) => void;
        touchStart: (event: TouchEvent) => void;
        touchMove: (event: TouchEvent) => void;
        touchEnd: (event: TouchEvent) => void;
        resize: () => void;
    } | undefined;
    /**
     * Attaches all event listeners to the canvas and window.
     * @private
     */
    private setupEventListeners;
    /**
     * Converts client (screen) coordinates to normalized device coordinates (-1 to 1).
     * @param {number} clientX - X coordinate in client space
     * @param {number} clientY - Y coordinate in client space
     * @returns {THREE.Vector2} Normalized device coordinates
     */
    clientToMouseCoordinates(clientX: number, clientY: number): THREE.Vector2;
    /**
     * Updates the internal mouse state with new client coordinates.
     * @param {number} clientX - X coordinate in client space
     * @param {number} clientY - Y coordinate in client space
     * @private
     */
    private updateMouseCoordinates;
    /**
     * Subscribes to view interactions suitable for replay in another viewer.
     * Selection is intentionally excluded because atom identities need not match.
     * @param {function(object): void} callback - Interaction listener
     * @returns {function(): void} Function that removes the listener
     */
    onInteraction(callback: (arg0: object) => void): () => void;
    /**
     * @param {object} interaction - View interaction to publish
     * @private
     */
    private notifyInteraction;
    /** @returns {boolean} Whether this viewer or a coupled peer is manipulating the view. */
    isInteracting(): boolean;
    /** @private */
    private notifyInteractionState;
    /**
     * Replays one view interaction without broadcasting it again.
     * @param {object} interaction - Interaction emitted by another ViewerControls
     * @param {object} source - Source viewer, used to track remote drag state
     */
    applyCoupledInteraction(interaction: object, source: object): void;
    /**
     * Removes interaction state retained for a peer that was detached.
     * @param {object} source - Detached source viewer
     */
    clearCoupledInteraction(source: object): void;
    /**
     * Copies the complete structure transform so independently fitted render
     * styles use the same molecular origin as well as the same orientation.
     * @param {number[]} matrixElements - Column-major Matrix4 elements
     */
    setStructureTransform(matrixElements: number[]): void;
    /**
     * Sets an external Cartesian XYZ orientation (Rz(z) * Ry(y) * Rx(x)).
     * @param {{x:number, y:number, z:number}} rotation - Angles in radians
     * @param {object} [behavior] - Broadcast and render controls
     */
    setExternalEulerRotation(rotation: {
        x: number;
        y: number;
        z: number;
    }, behavior?: object): void;
    /** Broadcasts the current camera state after a direct camera update. */
    notifyCameraChanged(): void;
    /**
     * Resets camera to initial position and orientation.
     * @param {object} [behavior] - Broadcast and render controls for coupled replay
     * @private
     */
    private resetCameraPosition;
    /**
     * Handles selection logic using raycasting to identify objects under pointer.
     * @param {object} point - Event with clientX and clientY properties
     * @param {number} timeSinceLastInteraction - Time in ms since last click/touch
     * @private
     */
    private handleSelection;
    /**
     * Rotates the molecular structure based on delta movement.
     * @param {THREE.Vector2} delta - Movement delta in normalized device coordinates
     * @param {object} [behavior] - Broadcast and render controls for coupled replay
     * @private
     */
    private rotateStructure;
    /**
     * Moves camera in the view plane based on delta movement.
     * @param {THREE.Vector2} delta - Movement delta in normalized device coordinates
     * @param {object} [behavior] - Broadcast and render controls for coupled replay
     * @private
     */
    private panCamera;
    /**
     * Sets raycast thresholds for touch interaction and handles selection.
     * @param {object} point - Event with clientX and clientY properties
     * @param {number} timeSinceLastInteraction - Time in ms since last touch
     * @private
     */
    private handleTouchSelect;
    /**
     * Adjusts camera distance to zoom in/out of the structure.
     * @param {number} zoomDelta - Zoom amount (positive for zoom out, negative for zoom in)
     * @param {object} [behavior] - Broadcast and render controls for coupled replay
     * @private
     */
    private handleZoom;
    /**
     * Handles touch start events for both single-touch (rotation) and multi-touch (zoom/pan) gestures.
     * @param {TouchEvent} event - Touch start event
     * @private
     */
    private handleTouchStart;
    /**
     * Handles touch move events for rotation, pinch-zoom, and panning.
     * @param {TouchEvent} event - Touch move event
     * @private
     */
    private handleTouchMove;
    /**
     * Handles touch end events, including tap selection.
     * @param {TouchEvent} event - Touch end event
     * @private
     */
    private handleTouchEnd;
    /**
     * Handles context menu events (right-click), including double-right-click for camera reset.
     * @param {MouseEvent} event - Context menu event
     * @private
     */
    private handleContextMenu;
    /**
     * Handles mouse down events to initiate dragging or panning.
     * @param {MouseEvent} event - Mouse down event
     * @private
     */
    private handleMouseDown;
    /**
     * Handles mouse move events for rotation and panning.
     * @param {MouseEvent} event - Mouse move event
     * @private
     */
    private handleMouseMove;
    /**
     * Handles mouse up events to end dragging or panning.
     * @private
     */
    private handleMouseUp;
    /**
     * Handles click events for atom/bond selection.
     * @param {MouseEvent} event - Click event
     * @private
     */
    private handleClick;
    /**
     * Handles wheel events for zooming.
     * @param {WheelEvent} event - Wheel event
     * @private
     */
    private handleWheel;
    /**
     * Handles window resize events by adjusting camera aspect ratio and field of view.
     * @private
     */
    private handleResize;
    /**
     * Removes all event listeners to prevent memory leaks.
     */
    dispose(): void;
}
import * as THREE from 'three';
//# sourceMappingURL=viewer-controls.d.ts.map