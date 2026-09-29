/**
 * Resolves partial viewer options against the one canonical default object.
 * Returned nested values are detached so viewer state cannot mutate the public defaults.
 * @param {object} options - Partial viewer options
 * @param {object} metalRingCentroidOptions - Validated centroid options
 * @returns {object} Resolved mutable viewer options
 */
export function resolveViewerOptions(options: object, metalRingCentroidOptions: object): object;
/**
 * Manages selections of atoms, bonds, and hydrogen bonds in the 3D structure.
 * Tracks selected objects, their data, and handles selection state changes.
 * Selection changes trigger registered callbacks with detailed information about
 * selected items. Callbacks receive an array of selection objects containing:
 * - type: 'atom', 'bond', or 'hbond'
 * - data: Complete data for the selected item (atomData, bondData, or hbondData)
 * - color: Hex color code used for the selection visualization
 * This notification system allows the application to update UI elements, display
 * property information, or synchronize with other components when selections change.
 * The underlying data objects (Atom, Bond, HBond) are defined in the structure folder:
 * - Atom: lib/structure/crystal.js
 * - Bond & HBond: lib/structure/bonds.js
 * These classes provide additional methods and properties for working with the selected items.
 */
export class SelectionManager {
    /**
     * Creates a selection manager with the given configuration.
     * @param {object} options - Selection configuration options
     */
    constructor(options: object);
    options: object;
    selectedObjects: Set<any>;
    selectionCallbacks: Set<any>;
    selectedData: Set<any>;
    /**
     * Removes invalid selections and restores valid ones after structure changes.
     * @param {THREE.Object3D} container - Container with selectable objects
     */
    pruneInvalidSelections(container: THREE.Object3D): void;
    /**
     * Returns a copy of the data without the color property.
     * @param {object} data - Data object containing selection information
     * @returns {object} Data without color information
     */
    getDataWithoutColor(data: object): object;
    /**
     * Extracts data from an object's to create a combination of uniquely identifyable
     * properties.
     * @param {THREE.Object3D} object - Object to extract data from
     * @returns {object|null} Extracted data or null if unavailable
     */
    getObjectDescriptorData(object: THREE.Object3D): object | null;
    /**
     * Checks if there is stored data matching the given object data.
     * @param {object} data - Data to check against stored selections
     * @returns {boolean} True if matching data exists
     */
    hasMatchingData(data: object): boolean;
    /**
     * Gets the color for a given data object, reuse the color if the data object has one
     * assigned, otherwise get a new color.
     * @param {object} data - Data to get color for
     * @returns {number} Hex color code for the data
     */
    getColorForData(data: object): number;
    /**
     * Gets the next available color for a new selection.
     * @returns {number} Hex color code for the new selection
     */
    getNextColor(): number;
    /**
     * Processes selection/deselection of an object and manages selection state.
     * @param {THREE.Object3D} object - Object to handle selection for
     * @returns {number|null} The selection color or null if selection failed
     */
    handle(object: THREE.Object3D): number | null;
    /**
     * Compares two data objects to determine if they represent the same entity.
     * @param {object} data1 - First data object
     * @param {object} data2 - Second data object
     * @returns {boolean} True if data objects match
     */
    matchData(data1: object, data2: object): boolean;
    /**
     * Adds an object to the selection set.
     * @param {THREE.Object3D} object - Object to add to selection
     * @param {number} [color] - Color to use for selection visualization
     */
    add(object: THREE.Object3D, color?: number): void;
    /**
     * Removes an object from the selection set.
     * @param {THREE.Object3D} object - Object to remove from selection
     */
    remove(object: THREE.Object3D): void;
    /**
     * Clears all current selections.
     */
    clear(): void;
    /**
     * Registers a callback to be notified when selection changes.
     * @param {function(Array<{type: string, data: object, color: ?number}>): void} callback - Called
     *  with the updated list of selections
     * @returns {function(): void} Unsubscribe function.
     */
    onChange(callback: (arg0: Array<{
        type: string;
        data: object;
        color: number | null;
    }>) => void): () => void;
    /**
     * Returns the current selections in their selection order.
     * @returns {Array<{type: string, data: object, color: ?number}>} Current selection descriptors.
     */
    getSelections(): Array<{
        type: string;
        data: object;
        color: number | null;
    }>;
    /**
     * Notifies all registered callbacks about selection changes.
     * See the class JSDoc documentation for more information.
     */
    notifyCallbacks(): void;
    /**
     * Sets the selection mode (single or multiple).
     * @param {string} mode - 'single' or 'multiple'
     * @throws {Error} If mode value is invalid
     */
    setMode(mode: string): void;
    /**
     * Releases resources used by the selection manager.
     */
    dispose(): void;
    /**
     * Selects atoms matching the provided labels.
     * @param {string[]} atomLabels - Labels of atoms to select
     * @param {THREE.Object3D} container - Container with selectable objects
     */
    selectAtoms(atomLabels: string[], container: THREE.Object3D): void;
}
/**
 * Main viewer class for 3D crystal structure visualization.
 * Handles structure loading, display, and user interaction.
 * Provides an interactive 3D visualization of crystallographic information:
 * - Loads structures from CIF (Crystallographic Information File) format
 * - Displays atoms with proper elemental colors and sizes
 * - Renders bonds between atoms and hydrogen bonds as defined in the CIF file
 * - Supports anisotropic displacement parameters (ADPs) visualization
 * - Allows interactive rotation, zooming, and selection of structure elements
 * - Provides structure modification capabilities through Structure Modifiers
 *
 * The viewer manages several key components:
 * - selections: SelectionManager for handling atom/bond selections
 * - modifiers: Structure modifiers that control display options:
 * - removeatoms: Filter specific atoms from the display
 * - addhydrogen: Fix isolated hydrogen atoms
 * - missingbonds: Generate bonds based on atomic distances
 * - hydrogen: Control hydrogen display (none/constant/anisotropic)
 * - disorder: Filter atoms based on disorder groups
 * - symmetry: Generate symmetry-equivalent atoms and bonds
 * @see SelectionManager for selection handling details
 * @see ../structure/structure-modifiers/modes.js and fixers.js for structure modifiers
 */
export class CrystalViewer {
    /**
     * Creates a new crystal structure viewer with the given configuration.
     * @param {HTMLElement} container - DOM element to contain the viewer
     * @param {object} [options] - Viewer configuration options including:
     * - camera: Camera settings (fov, position, distance limits, etc.)
     * - selection: Selection behavior configuration
     * - interaction: User interaction parameters (rotation speed, click thresholds)
     * - atomDetail/atomColorRoughness/etc.: Appearance settings for atoms
     * - adpRepresentation/peanutScale/peanutDetail: ADP surface kind, scale, and fidelity
     * - bondRadius/bondColor/etc.: Appearance settings for bonds
     * - elementProperties: Per-element appearance settings (colors, radii)
     * - hydrogenMode/disorderMode/symmetryMode: Initial display modes
     * - renderMode: 'constant' for continuous updates or 'onDemand' for efficient rendering
     * - debug: Expose detailed performance timings in density events/results
     * - fixCifErrors: Whether to attempt automatic fixes for common CIF format issues
     * see ./structure-settings.js for the default values
     * @throws {Error} If a rendering enum contains an unsupported value
     */
    constructor(container: HTMLElement, options?: object);
    container: HTMLElement;
    options: object;
    state: {
        isDragging: boolean;
        currentCifContent: null;
        currentCifBlock: null;
        currentStructure: null;
        displayStructure: null;
        currentFloor: null;
        baseStructure: null;
        ortepObjects: Map<any, any>;
        structureCenter: THREE.Vector3;
        scalarField: null;
        scalarFields: never[];
        activeScalarFieldIndex: number;
        isosurfaceResolutionFraction: number;
        contourDisplayVersion: number;
        currentStructureFactorModel: null;
    };
    scalarFieldUpdateCallbacks: Set<any>;
    modifierModeCallbacks: Set<any>;
    measurementCallbacks: Set<any>;
    measurementGroups: Map<any, any>;
    measurements: Map<any, any>;
    measurementSequence: number;
    currentMeasurement: any;
    hoveredAtomObjects: Map<any, any>;
    scalarFieldLoadSequence: number;
    scalarFieldPreparationSequence: number;
    scalarFieldPreparationId: number | null;
    scalarFieldLoadTimings: {
        loadStartedEpochMs: number | null;
    } | null;
    scalarFieldWorker: any;
    scalarFieldWorkerConstructedEpochMs: number | null;
    scalarFieldWorkerReadyEpochMs: any;
    scalarFieldPendingResolve: ((value: object | PromiseLike<object>) => void) | null;
    scalarFieldMainThreadLoadId: number | null;
    scalarFieldLoadTarget: {
        loadId: number | null;
        fieldId: string;
        fieldName: string;
        activate: boolean;
        isosurfaceOptions: {};
    } | null;
    scalarFieldIdSequence: number;
    defaultDifferenceDensityOptions: any;
    defaultScalarFieldOptions: any;
    defaultIsosurfaceOptions: any;
    modifiers: {
        removeatoms: AtomLabelFilter;
        addhydrogen: IsolatedHydrogenFixer;
        missingbonds: BondGenerator;
        disorder: DisorderFilter;
        symmetry: SymmetryGrower;
        hydrogen: HydrogenFilter;
    };
    selections: SelectionManager;
    isosurfaceLayer: ThreeIsosurfaceLayer;
    contourLineLayer: ThreeContourLineLayer;
    atomLabelManager: AtomLabelManager;
    controls: ViewerControls;
    needsRender: boolean;
    /**
     * Sets up the Three.js scene, camera, and renderer.
     * @private
     */
    private setupScene;
    scene: THREE.Scene<THREE.Object3DEventMap> | null | undefined;
    cameraController: {
        container: HTMLElement;
        options: object;
        cameraTarget: THREE.Vector3;
        createCamera(): THREE.Camera;
        fitToStructure(_structureGroup: THREE.Object3D): void;
        zoom(_zoomDelta: number): void;
        pan(_delta: THREE.Vector2): void;
        handleResize(): void;
        reset(): void;
        getCoupledViewState(): object;
        applyCoupledViewState(_state: object): void;
    } | undefined;
    camera: any;
    renderer: THREE.WebGLRenderer | null | undefined;
    moleculeContainer: THREE.Group<THREE.Object3DEventMap> | undefined;
    cameraTarget: THREE.Vector3 | undefined;
    /**
     * Keeps the renderer matched to the container as it changes size.
     *
     * Without this, the size read during construction is the only one the
     * renderer ever sees. A viewer built inside a hidden container -- a
     * reveal.js slide that is not current, an inactive tab, a collapsed
     * accordion, a closed <details> -- gets a 0x0 canvas, and revealing the
     * container afterwards does not recover it. The viewer stays blank with no
     * error, which is a hard failure to diagnose from the outside.
     *
     * ResizeObserver fires once on observe(), so a viewer created at zero size
     * corrects itself as soon as the container is laid out.
     */
    observeContainerResize(): void;
    containerResizeObserver: ResizeObserver | null | undefined;
    /**
     * Loads a crystal structure from CIF text.
     * This is the main entry point for displaying a new structure.
     * @param {string} cifText - CIF format text content
     * @param {number|string} [cifBlock] - Index or name of the CIF block to load (for multi-block CIFs)
     * @param {object} [options] - Per-load options; differenceDensity enables deferred automatic density.
     * @returns {Promise<object>} Result object with:
     * - success: Boolean indicating if loading succeeded
     * - error: Error message if loading failed
     *
     * On success, `cifText` and `cifBlock` are persisted to `this.state.currentCifContent` /
     * `this.state.currentCifBlock` so a later reload (e.g. after an options change) can reuse them.
     *
     * Example:
     * ```
     * const result = await viewer.loadCIF(cifContent);
     * if (result.success) {
     *   console.log('Structure loaded successfully');
     * } else {
     *   console.error('Failed to load structure:', result.error);
     * }
     * ```
     */
    loadCIF(cifText: string, cifBlock?: number | string, options?: object): Promise<object>;
    /**
     * Loads an FCF progressively and displays its Fo-Fc difference density.
     * The worker calculates an initial grid and then the final oversampled grid.
     * Later progressive updates reuse the final grid and refine only its surface.
     * @param {string} fcfText - LIST 6/8-style FCF text.
     * @param {number|string} [fcfBlock] - FCF block index or name.
     * @param {object} [options] - Calculation, isosurface, and collection options.
     * @returns {Promise<object>} Load result and map statistics.
     */
    loadDifferenceDensity(fcfText: string, fcfBlock?: number | string, options?: object): Promise<object>;
    /**
     * Loads a periodic Gaussian Cube scalar field over the active crystal.
     * Cube coordinates and density values are normalized to Å and e/Å³ by
     * default. Use `property: "orbital"|"potential"|"generic"` for other
     * scalar quantities, and `datasetIndex` for multi-orbital files.
     * @param {string} cubeText - Complete Gaussian Cube file contents.
     * @param {object} [options] - Cube parsing, isosurface, and collection options.
     * @returns {Promise<object>} Load result and map statistics.
     */
    loadCube(cubeText: string, options?: object): Promise<object>;
    /**
     * Subscribes to scalar-field events (`started`, `update`, `complete`, `display`,
     * `visibility`, `cleared`, `error`, and `cancelled`). Display-bearing events
     * expose level/visibility and active-field collection metadata so UIs need
     * not inspect renderer state.
     * @param {function(object): void} callback - Update listener.
     * @returns {function(): void} Function that removes the listener.
     */
    onScalarFieldUpdate(callback: (arg0: object) => void): () => void;
    /**
     * Notifies all scalar-field listeners.
     * @param {object} update - Scalar-field pipeline event.
     */
    notifyScalarFieldUpdate(update: object): void;
    /**
     * Runs the progressive pipeline in a module worker.
     * @param {string} fcfText - FCF source text.
     * @param {number|string} fcfBlock - FCF block index or name.
     * @param {number} loadId - Identifier used to reject stale worker events.
     * @returns {Promise<object>} Final load result.
     * @private
     */
    private loadDifferenceDensityInWorker;
    /**
     * Runs Cube parsing in the density worker and progressively refines its surface.
     * @param {string} cubeText - Complete Cube file contents.
     * @param {object} cubeOptions - Worker-safe Cube parser options.
     * @param {number} loadId - Active density load identifier.
     * @returns {Promise<object>} Final Cube load result.
     */
    loadCubeInWorker(cubeText: string, cubeOptions: object, loadId: number): Promise<object>;
    /**
     * Synchronous-environment fallback retaining the same progressive events.
     * @param {string} fcfText - FCF source text.
     * @param {number|string} fcfBlock - FCF block index or name.
     * @param {number} loadId - Identifier used to reject stale results.
     * @returns {Promise<object>} Final load result.
     * @private
     */
    private loadDifferenceDensityOnMainThread;
    /**
     * Synchronous-environment Cube fallback retaining progressive surface events.
     * @param {string} cubeText - Complete Cube file contents.
     * @param {object} cubeOptions - Cube parser options.
     * @param {number} loadId - Active density load identifier.
     * @returns {Promise<object>} Final Cube load result.
     */
    loadCubeOnMainThread(cubeText: string, cubeOptions: object, loadId: number): Promise<object>;
    /**
     * Adds the active coordinate CIF to the public anomalous-correction option.
     * @returns {object|null} Worker-safe correction configuration.
     * @private
     */
    private differenceDensityAnomalousDispersionOptions;
    /** @returns {object} Worker-safe coefficient or CIF/IAM dataset options. */
    differenceDensityDatasetOptions(): object;
    /** @returns {number[]} Valid ordered surface-resolution fractions. */
    normalizedIsosurfaceSteps(): number[];
    /**
     * Defines where the next progressive worker result belongs in the field collection.
     * @param {number|null} loadId - Progressive-load identifier, or null for a direct field.
     * @param {object} options - Per-source options.
     * @param {object} isosurfaceOptions - Presentation snapshot retained with the field.
     * @param {string} defaultName - Human-readable fallback name.
     * @returns {object} Prepared collection target.
     * @private
     */
    private prepareScalarFieldLoad;
    /** @returns {object[]} Public metadata for every loaded field, without grid values. */
    getScalarFields(): object[];
    /** @returns {object} Collection metadata included in public field events. */
    scalarFieldCollectionState(): object;
    /** @returns {ThreeIsosurfaceLayer|ThreeContourLineLayer} Active field adapter. */
    scalarFieldDisplayLayer(): ThreeIsosurfaceLayer | ThreeContourLineLayer;
    /** @returns {object|null} Worker-safe displayed structure and contour options. */
    contourWorkerRequest(): object | null;
    /**
     * @param {object|null} [contours] - Packed contours already calculated by the worker.
     * @returns {object} Statistics for the rebuilt surface/line representation.
     */
    rebuildScalarFieldDisplay(contours?: object | null): object;
    /**
     * Installs one collection entry into the Three.js adapter.
     * @param {number} index - Collection index.
     * @param {boolean} [visible] - Whether its surface should be shown.
     * @param {object|null} [contours] - Packed contours already calculated by the worker.
     * @returns {object} Surface statistics.
     * @private
     */
    private activateScalarFieldIndex;
    /**
     * Adds or updates the collection entry targeted by a progressive load.
     * @param {ScalarFieldGrid} field - New grid state.
     * @param {number} resolutionFraction - Current surface-resolution fraction.
     * @param {object|null} [contours] - Packed contours already calculated by the worker.
     * @returns {{index:number, surfaceStatistics:object}} Stored entry and rendering result.
     * @private
     */
    private storeProgressiveScalarField;
    /**
     * @param {object} payload - Transferable worker map data.
     * @returns {ScalarFieldGrid} Field reconstructed from a worker payload.
     */
    scalarFieldFromPayload(payload: object): ScalarFieldGrid;
    /**
     * Applies one progressive map and emits its update signal.
     * @param {ScalarFieldGrid} field - Current scalar grid.
     * @param {object} message - Progressive step metadata.
     * @returns {object} Debug-only application timing diagnostics.
     */
    applyProgressiveScalarField(field: ScalarFieldGrid, message: object): object;
    /**
     * Waits for a browser frame before requesting the next surface refinement.
     * @param {Worker} worker - Active density worker.
     * @param {number} loadId - Active load identifier.
     * @param {number} stepIndex - Surface step awaiting acknowledgement.
     */
    continueScalarFieldWorkerAfterRender(worker: Worker, loadId: number, stepIndex: number): void;
    /**
     * @param {ScalarFieldGrid} field - Completed scalar grid.
     * @returns {object} Public successful density-load result.
     */
    scalarFieldResult(field: ScalarFieldGrid): object;
    /** @returns {object} Renderer-independent density state exposed to UI listeners. */
    scalarFieldDisplayState(): object;
    /** @returns {Worker} Warm per-viewer scalar-field worker. */
    ensureScalarFieldWorker(): Worker;
    /**
     * Marks a successful scalar-field load complete while retaining its warm worker.
     * @param {Worker} [worker] - Worker that completed the load.
     */
    finishScalarFieldLoad(worker?: Worker): void;
    /**
     * Terminates a worker that is busy, failed, replaced, or no longer needed.
     * @param {Worker} [worker] - Worker to terminate.
     */
    destroyScalarFieldWorker(worker?: Worker): void;
    /**
     * Cancels any in-flight progressive density load.
     * @param {string} reason - Public cancellation reason.
     */
    cancelScalarFieldLoad(reason?: string): void;
    /**
     * Adds an already calculated scalar grid to the displayed collection.
     * @param {ScalarFieldGrid} field - Renderer-independent scalar grid.
     * @param {object} [options] - fieldId, fieldName, activate, and isosurface options.
     * @returns {object} Successful field result or a validation error.
     */
    addScalarField(field: ScalarFieldGrid, options?: object): object;
    /**
     * Loads an ordered collection of heterogeneous scalar-field sources.
     * @param {object[]} sources - Difference-density, Cube, or direct-field definitions.
     * @returns {Promise<object>} Aggregate result and individual source results.
     */
    loadScalarFieldSources(sources: object[]): Promise<object>;
    /**
     * @param {number|string|null} selector - Collection index, field ID, or active-field default.
     * @returns {number} Selected collection index.
     */
    resolveScalarFieldIndex(selector: number | string | null): number;
    /**
     * Displays one loaded field by collection index or fieldId.
     * @param {number|string} selector - Collection index or stable field ID.
     * @returns {object} Selection result.
     */
    setActiveScalarField(selector: number | string): object;
    /**
     * Advances through every field and one hidden state.
     * @returns {object} New active/visibility state.
     */
    cycleScalarField(): object;
    /**
     * Updates contour and appearance options without rebuilding the scalar field.
     * @param {object} options - Partial isosurface display options.
     * @returns {object} Update result.
     */
    updateIsosurfaceOptions(options?: object): object;
    /**
     * Enables/disables planar contours or changes their plane and line settings.
     * @param {object} options - Partial contour-line display options.
     * @returns {object} Update result.
     */
    updateContourLineOptions(options?: object): object;
    /**
     * Shows or hides the existing isosurfaces without rebuilding them.
     * @param {boolean} visible - Requested visibility.
     * @returns {object} Successful visibility update.
     */
    setIsosurfaceVisibility(visible: boolean): object;
    /**
     * Removes one field by index/fieldId, defaulting to the active field.
     * @param {number|string} [selector] - Collection index or stable field ID.
     * @returns {object} Removal result.
     */
    clearScalarField(selector?: number | string): object;
    /**
     * Removes every loaded scalar field.
     * @returns {object} Empty collection state.
     */
    clearScalarFields(): object;
    /**
     * Ensures that a scalar field belongs to the displayed coordinate CIF.
     * @param {object} fieldCell - Unit cell parsed from the field source.
     * @param {object} structureCell - Unit cell parsed from the coordinate CIF.
     * @param {string} [label] - Source label used in mismatch errors.
     * @private
     */
    private validateScalarFieldCell;
    /**
     * Initializes a new structure in the viewer with proper orientation.
     * @param {CrystalStructure} [structure] - Crystal structure to load. Defaults to the
     * viewer's current base structure, so callers can use this to reset the camera/orientation
     * for a modifier change without having to thread the structure through themselves.
     * @returns {Promise<object>} Object indicating success
     * @private
     */
    private loadStructure;
    /**
     * Updates the current structure while preserving rotation.
     * Used internally when structure modifiers change.
     * @returns {Promise<object>} Object indicating success or failure
     * @private
     */
    private updateStructure;
    /**
     * Updates the 3D visualization by applying structure modifiers and creating visual elements.
     * @private
     */
    private update3DOrtep;
    /**
     * Updates camera position and parameters based on structure size.
     * @private
     */
    private updateCamera;
    /**
     * Returns the current external-XYZ Cartesian view in degrees (Rz * Ry * Rx).
     * @returns {{rotation: {convention:string, x:number, y:number, z:number},
     *   camera: {type:string, viewSize?:number, distance?:number, zoomScale:number},
     *   locks: {rotation:boolean, zoom:boolean}}} Serializable live view state
     */
    getViewState(): {
        rotation: {
            convention: string;
            x: number;
            y: number;
            z: number;
        };
        camera: {
            type: string;
            viewSize?: number;
            distance?: number;
            zoomScale: number;
        };
        locks: {
            rotation: boolean;
            zoom: boolean;
        };
    };
    /**
     * Applies live view parts despite gesture locks and broadcasts each update.
     * @param {{rotation?: {x?:number, y?:number, z?:number},
     *   camera?: {viewSize?:number, distance?:number, zoomScale?:number}}} state - Partial live state
     */
    setViewState(state: {
        rotation?: {
            x?: number;
            y?: number;
            z?: number;
        };
        camera?: {
            viewSize?: number;
            distance?: number;
            zoomScale?: number;
        };
    }): void;
    /**
     * Updates the independent rotation/zoom gesture locks without rebuilding.
     * @param {{rotation?:boolean, zoom?:boolean}} locks - Lock values to update
     */
    setInteractionLocks(locks: {
        rotation?: boolean;
        zoom?: boolean;
    }): void;
    /**
     * Removes the current structure and frees associated resources.
     * @private
     */
    private removeStructure;
    /**
     * Cycles through available modes for a structure modifier.
     * This method allows switching between different visualization options for:
     * - hydrogen: Control how hydrogen atoms are displayed
     * - disorder: Control which disorder groups are shown
     * - symmetry: Control how symmetry-equivalent atoms are generated
     * - removeatoms: Toggle atom filtering on/off
     * @param {string} modifierName - Name of the modifier to cycle ('hydrogen', 'disorder', 'symmetry', etc.)
     * @returns {Promise<object>} Result object with:
     * - success: Boolean indicating if mode change succeeded
     * - mode: The new active mode after cycling
     * - error: Error message if change failed
     *
     * Example:
     * ```
     * const result = await viewer.cycleModifierMode('hydrogen');
     * console.log(`New hydrogen display mode: ${result.mode}`);
     * ```
     */
    cycleModifierMode(modifierName: string): Promise<object>;
    /**
     * Sets a structure modifier to a semantic mode and rebuilds only when the
     * mode is applicable to the loaded structure.
     * @param {string} modifierName - Modifier name
     * @param {string} mode - Requested semantic mode
     * @param {object} [behavior] - Coupling behavior
     * @returns {Promise<object>} Update result, including skipped unsupported modes
     */
    setModifierMode(modifierName: string, mode: string, behavior?: object): Promise<object>;
    /**
     * Applies several semantic modifier modes with at most one structure rebuild.
     * Unsupported modes are reported and skipped independently.
     * @param {object} modes - Modifier-name to semantic-mode mapping
     * @param {object} [behavior] - Coupling behavior
     * @returns {Promise<object>} Batched update result and per-modifier changes
     */
    setModifierModes(modes: object, behavior?: object): Promise<object>;
    /**
     * Subscribes to successful structure-modifier mode changes.
     * @param {function(object): void} callback - Mode-change listener
     * @returns {function(): void} Function that removes the listener
     */
    onModifierModeChange(callback: (arg0: object) => void): () => void;
    /** @param {object} change - Successful modifier mode change. */
    notifyModifierModeChange(change: object): void;
    /**
     * Gets the number of available modes for a structure modifier.
     * Useful for determining if a modifier has options for the current structure.
     * @param {string} modifierName - Name of the modifier to check ('hydrogen', 'disorder', 'symmetry', etc.)
     * @returns {number|boolean} Number of available modes or false if no structure loaded
     *
     * Example:
     * ```
     * // Check if hydrogen display options are available
     * const hydrogenModes = viewer.numberModifierModes('hydrogen');
     * if (hydrogenModes > 1) {
     *   // Enable hydrogen toggle button
     * }
     * ```
     */
    numberModifierModes(modifierName: string): number | boolean;
    /**
     * Animation loop that renders the scene when needed.
     * Called automatically; users don't need to invoke this directly.
     * @private
     */
    private animate;
    animationFrameId: number | undefined;
    /**
     * Keeps cutaway ellipsoids open towards the camera as the structure rotates.
     * @private
     */
    private updateCameraFacingOctants;
    /**
     * Orders atoms front-to-back so a nearer cutaway atom fully occludes the
     * carved-open interior of a farther one. Every part of an atom (its
     * ellipsoid shells and cross-section) draws before that atom's own depth
     * cap, and a nearer atom's cap is written before any part of a farther
     * atom - so pure depth testing hides shells, rings, and cross-sections
     * seen through a nearer atom's opening while the atom's own interior shows.
     * @param {Array<object>} atoms - Atom objects to order (front-to-back)
     * @private
     */
    private updateAtomDrawOrder;
    /**
     * Requests a render update for the on-demand rendering mode (on by default).
     * Call this after making changes that should be reflected in the display.
     */
    requestRender(): void;
    /**
     * Resizes the renderer to match the container's display size.
     * Called automatically on window resize.
     * @returns {boolean} True if resize was needed
     * @private
     */
    private resizeRendererToDisplaySize;
    /**
     * Renders the current view to a standalone canvas at an arbitrary
     * resolution, for exporting publication-quality images. The molecular
     * scene and the atom-label overlay are composited together; the framing
     * matches what is on screen because the capture scales uniformly.
     * @param {object} [options] - Capture options
     * @param {number} [options.scale] - Resolution multiplier over the on-screen CSS size
     * @param {number} [options.longEdge] - Target length of the longer edge in pixels (overrides scale)
     * @param {string} [options.background] - Background fill: 'transparent' (default), or any CSS colour
     * @param {boolean} [options.includeLabels] - Whether to draw atom labels (default true)
     * @returns {HTMLCanvasElement} A canvas holding the rendered image
     */
    captureImage({ scale, longEdge, background, includeLabels }?: {
        scale?: number | undefined;
        longEdge?: number | undefined;
        background?: string | undefined;
        includeLabels?: boolean | undefined;
    }): HTMLCanvasElement;
    /**
     * Captures the current view as a PNG (or other type) Blob.
     * @param {object} [options] - Options forwarded to captureImage plus a type
     * @param {string} [options.type] - Image MIME type (default 'image/png')
     * @param {number} [options.quality] - Encoder quality for lossy types (0-1)
     * @returns {Promise<Blob>} The encoded image
     */
    captureImageBlob({ type, quality, ...options }?: {
        type?: string | undefined;
        quality?: number | undefined;
    }): Promise<Blob>;
    /**
     * Updates selection presentation without rebuilding the viewer or losing selections.
     * Existing atom/bond markers are recreated immediately with the new settings.
     * @param {object} options - Partial selection options
     */
    updateSelectionOptions(options?: object): void;
    /**
     * Updates measurement appearance and recolours all persistent overlays in place.
     * @param {object} options - Partial measurement options.
     */
    updateMeasurementOptions(options?: object): void;
    /**
     * Selects specific atoms by their labels.
     * Allows programmatic selection of atoms without user interaction.
     * @param {string[]} atomLabels - Array of atom labels to select
     *
     * Example:
     * ```
     * // Select specific atoms of interest
     * viewer.selectAtoms(['C1', 'O1', 'N2']);
     * ```
     */
    selectAtoms(atomLabels: string[]): void;
    /**
     * Measures the currently selected atoms in selection order.
     * @returns {object} Context-sensitive distance, angle, torsion, or plane-distance result.
     */
    measureSelectedAtoms(): object;
    /**
     * Measures an ordered list of displayed atoms without changing the current selection.
     * Exact unique IDs take precedence over plain atom labels.
     * @param {string[]} atomIds - Two or more unique IDs or atom labels in measurement order.
     * @returns {object} Created persistent measurement.
     */
    measureAtomsById(atomIds: string[]): object;
    /**
     * @param {object} measurement - Measurement geometry and value to display.
     * @returns {void}
     */
    displayMeasurement(measurement: object): void;
    /**
     * Removes the visible measurement.
     * @param {string|null} [measurementId] - One measurement to remove, or null for all.
     * @param {boolean} [notify] - Whether to notify UI subscribers.
     */
    clearMeasurement(measurementId?: string | null, notify?: boolean): void;
    /** @returns {object[]} All persistent measurements in creation order. */
    getMeasurements(): object[];
    /** Notifies measurement UI subscribers with the complete persistent collection. */
    notifyMeasurementCallbacks(): void;
    /**
     * @param {function(object[]): void} callback - Measurement collection listener.
     * @returns {function(): void} Unsubscribe function.
     */
    onMeasurementChange(callback: (arg0: object[]) => void): () => void;
    /**
     * Shows one persistent measurement overlay and hides every other overlay.
     * Passing null returns all persistent measurements to their default hidden state.
     * @param {string|null} measurementId - Measurement ID to reveal, or null to hide all.
     */
    setHoveredMeasurement(measurementId: string | null): void;
    /**
     * Temporarily highlights one symmetry-resolved atom without changing selection state.
     * @param {string|null} atomId - Atom unique ID, or null to clear hover.
     * @param {number} [hoverColor] - Highlight colour, normally the owning measurement colour.
     */
    setHoveredAtom(atomId: string | null, hoverColor?: number): void;
    /**
     * Replaces the set of atom labels displayed by the viewer.
     * Plain labels such as `C1` match all displayed symmetry copies; a full
     * unique ID such as `C1|2_555` matches only that atom instance.
     * @param {'none'|'all'|'non-hydrogen'|Array<string|object>} show - Label selection
     */
    setAtomLabels(show: "none" | "all" | "non-hydrogen" | Array<string | object>): void;
    /**
     * Updates atom-label appearance or layout options without rebuilding the structure.
     * @param {object} options - Partial atom-label options
     */
    updateAtomLabelOptions(options: object): void;
    /**
     * Hides all atom labels.
     */
    clearAtomLabels(): void;
    /**
     * Returns the most recent screen-space label layout and omission reasons.
     * @returns {AtomLabelLayout} Current layout
     */
    getAtomLabelLayout(): AtomLabelLayout;
    /**
     * Releases all resources used by the viewer.
     * Call this when the viewer is no longer needed to prevent memory leaks.
     *
     * Example:
     * ```
     * // When removing the viewer from the application
     * viewer.dispose();
     * viewer = null;
     * ```
     */
    dispose(): void;
}
export type AtomLabelPlacement = {
    /**
     * - Unique atom ID
     */
    id: string;
    /**
     * - Displayed label text
     */
    text: string;
    /**
     * - Per-label CSS text colour
     */
    color?: string | undefined;
    /**
     * - Label bounds
     */
    rect: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    /**
     * Screen-space connector, when one is needed
     */
    leaderSegment: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        radius: number;
    } | null;
    /**
     * - Whether this is an outer callout placement
     */
    isCallout?: boolean | undefined;
};
export type HiddenAtomLabel = {
    /**
     * - Unique atom ID
     */
    id: string;
    /**
     * - Requested label text
     */
    text: string;
    /**
     * Why the label was omitted
     */
    reason: "static-no-space" | "viewport-capacity" | "no-space" | "max-visible";
};
export type AtomLabelLayout = {
    /**
     * - Visible screen-space placements
     */
    placed: AtomLabelPlacement[];
    /**
     * - Omitted labels and their reasons
     */
    hidden: HiddenAtomLabel[];
    /**
     * Effective placement policy
     */
    placementPolicy: "none" | "quality-omit" | "performance-omit" | "maximum-coverage";
};
import * as THREE from 'three';
import { AtomLabelFilter } from '../structure/structure-modifiers/fixers.js';
import { IsolatedHydrogenFixer } from '../structure/structure-modifiers/fixers.js';
import { BondGenerator } from '../structure/structure-modifiers/fixers.js';
import { DisorderFilter } from '../structure/structure-modifiers/modes.js';
import { SymmetryGrower } from '../structure/structure-modifiers/modes.js';
import { HydrogenFilter } from '../structure/structure-modifiers/modes.js';
import { ThreeIsosurfaceLayer } from './three-isosurface-layer.js';
import { ThreeContourLineLayer } from './three-contour-line-layer.js';
import { AtomLabelManager } from './atom-label-manager.js';
import { ViewerControls } from './viewer-controls.js';
import { ScalarFieldGrid } from '../density/scalar-field.js';
//# sourceMappingURL=crystal-viewer.d.ts.map