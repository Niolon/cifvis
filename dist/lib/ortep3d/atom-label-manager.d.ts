/**
 * Calculates the shared scale for the configured atom-colour palette.
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number} ceiling - Palette relative-luminance ceiling
 * @returns {number} Shared linear RGB scale
 */
export function atomLabelPaletteLuminanceScale(elementProperties: object, ceiling: number): number;
/**
 * Calculates the shared white-mix lift for the configured atom-colour palette
 * against a relative-luminance floor (dark backgrounds).
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number} floor - Palette relative-luminance floor
 * @returns {number} Shared white-mix fraction
 */
export function atomLabelPaletteLuminanceLift(elementProperties: object, floor: number): number;
/**
 * Resolves one label's text colour, optionally following its atom colour with
 * a palette-wide luminance scale for readability against the halo/background.
 * @param {object} atom - Atom represented by the label
 * @param {object} options - Atom-label display options
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number|null} [paletteScale] - Precomputed shared palette scale
 * @returns {string} CSS colour string
 */
export function resolveAtomLabelColor(atom: object, options: object, elementProperties: object, paletteScale?: number | null): string;
/**
 * Tests whether any part of a projected atom remains inside the viewport.
 * @param {{x: number, y: number, z: number, radius: number}} anchor - Projected atom footprint
 * @param {{width: number, height: number}} viewport - CSS-pixel viewport
 * @returns {boolean} Whether the atom can currently be seen
 */
export function projectedAtomIntersectsViewport(anchor: {
    x: number;
    y: number;
    z: number;
    radius: number;
}, viewport: {
    width: number;
    height: number;
}): boolean;
/**
 * Finds chordless five-to-seven-member cycles in a structure's chemical graph.
 * This is a bounded geometric hint, not an aromaticity assignment.
 * @param {object} structure - Displayed structure
 * @returns {Array<string[]>} Rings represented by ordered atom IDs
 */
export function findSmallRings(structure: object): Array<string[]>;
/**
 * Owns the transparent label canvas and updates its projected label layout.
 */
export class AtomLabelManager {
    /**
     * @param {object} viewer - Owning viewer
     */
    constructor(viewer: object);
    viewer: object;
    options: any;
    previousPlacements: Map<any, any>;
    layout: {
        placed: never[];
        hidden: never[];
        placementPolicy: string;
    };
    rings: string[][] | null;
    displayStructure: any;
    bondNeighbours: Map<any, any>;
    measurementCache: Map<any, any>;
    atomLabelColorCache: Map<any, any>;
    atomLabelColorScale: any;
    lastLayoutTime: number;
    forceNextLayout: boolean;
    lastMoleculeMatrix: any;
    lastCameraMatrix: any;
    lastProjectionMatrix: any;
    lastViewport: {
        width: any;
        height: any;
    } | {
        width: any;
        height: any;
    } | null;
    layoutRevision: number;
    lastLayoutRevision: number;
    nextWorkerRequestId: number;
    worker: any;
    workerUnavailable: boolean;
    pendingLayout: {
        id: number;
        input: {
            labels: any;
            atoms: {
                id: any;
                x: any;
                y: any;
                radius: any;
            }[];
            bonds: any[];
            rings: {
                x: any;
                y: any;
            }[][];
            viewport: {
                width: any;
                height: any;
            };
            options: object;
            previousPlacements: [any, any][];
        };
        state: {
            width: any;
            height: any;
            revision: number;
            moleculeMatrix: any;
            cameraMatrix: any;
            projectionMatrix: any;
        };
    } | null;
    layoutQueued: boolean;
    layoutWaiters: any[];
    scheduledFrame: any;
    disposed: boolean;
    lastExecutionMode: string;
    loadingIndicatorActive: boolean;
    loadingIndicatorTimer: number | null;
    canvas: HTMLCanvasElement;
    changedContainerPosition: boolean | undefined;
    previousContainerPosition: any;
    context: CanvasRenderingContext2D | null;
    loadingIndicator: HTMLDivElement;
    setOptions(options: any): void;
    setStructure(structure: any): void;
    prepareTopology(): void;
    invalidateLayout(): void;
    beginLoadingIndicator(): void;
    endLoadingIndicator(): void;
    /**
     * Schedules label preparation after the current browser paint. Repeated
     * render requests collapse into one layout and no worker backlog is built.
     */
    scheduleUpdate(): void;
    /**
     * Removes labels drawn for an old camera or molecule pose immediately.
     * Waiting for an asynchronous replacement here would leave a visible
     * after-image during rotation.
     */
    clearStaleFrame(): void;
    transformsUnchanged(width: any, height: any): any;
    rememberTransforms(width: any, height: any): void;
    captureLayoutState(width: any, height: any): {
        width: any;
        height: any;
        revision: number;
        moleculeMatrix: any;
        cameraMatrix: any;
        projectionMatrix: any;
    };
    layoutStateIsCurrent(state: any): any;
    getWorker(): any;
    resize(): void;
    resolveRequests(): any;
    projectLocalPosition(position: any): {
        x: number;
        y: number;
        z: any;
    };
    projectRadius(position: any, radius: any): number;
    projectAnchors(): Map<any, any>;
    projectBonds(projectedAnchors: any): any[];
    preferredDirection(atom: any, projectedAnchors: any): {
        x: number;
        y: number;
    };
    projectRings(projectedAnchors: any): any[][];
    /**
     * Returns the cached display colour for an atom label.
     * @param {object} atom - Displayed atom
     * @returns {string} CSS colour
     */
    getAtomLabelColor(atom: object): string;
    /**
     * Projects and measures labels, then delegates collision placement to a
     * worker when available.
     * @returns {Promise<object>} The accepted current layout
     */
    update(): Promise<object>;
    calculateLayout(input: any): {
        placed: Array<object>;
        hidden: Array<object>;
    };
    handleWorkerMessage(message: any): void;
    handleWorkerFailure(error: any): void;
    resolveLayoutWaiters(layout: any): void;
    /**
     * Settles any callers carried over from a stale worker result and completes
     * a synchronous update path.
     * @param {object} layout - Current accepted layout
     * @returns {Promise<object>} Resolved current layout
     */
    completeUpdate(layout: object): Promise<object>;
    applyLayout(layout: any, state: any): void;
    draw(): void;
    /**
     * Paints the current placed-label layout onto a 2D context. Label
     * coordinates are stored in CSS pixels, so the same layout renders at any
     * resolution - used by the live overlay (at devicePixelRatio) and by
     * high-resolution image capture (at an arbitrary scale).
     * @param {CanvasRenderingContext2D} context - Destination context
     * @param {number} [scale] - Pixels per CSS pixel; the caller has already
     *  cleared and set the transform for the live overlay, so this defaults to
     *  leaving the transform untouched
     */
    paintLayout(context: CanvasRenderingContext2D, scale?: number): void;
    /**
     * Whether any atom labels are currently placed and visible.
     * @returns {boolean} True when the live overlay shows at least one label
     */
    hasVisibleLabels(): boolean;
    dispose(): void;
}
//# sourceMappingURL=atom-label-manager.d.ts.map