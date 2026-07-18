import * as THREE from 'three';
import { CIF } from '../read-cif/base.js';
import { CrystalStructure } from '../structure/crystal.js';
import { ORTEP3JsStructure } from './ortep.js';
import { setupLighting, structureOrientationMatrix } from './staging.js';
import defaultSettings from './structure-settings.js';
import { ViewerControls } from './viewer-controls.js';
import { BondGenerator, AtomLabelFilter, IsolatedHydrogenFixer } from '../structure/structure-modifiers/fixers.js';
import { DisorderFilter, HydrogenFilter, SymmetryGrower } from '../structure/structure-modifiers/modes.js';
import { tryToFixCifBlock } from '../fix-cif/base.js';
import { createCameraController } from './camera-controllers.js';
import { createCell3D } from './cell3d.js';
import { AtomLabelManager } from './atom-label-manager.js';
import {
    parseDifferenceDensitySource,
} from '../density/difference-density.js';
import ScalarFieldWorker from '../density/scalar-field-worker.js?worker';
import { parseCube } from '../density/cube.js';
import { ScalarFieldGrid } from '../density/scalar-field.js';
import { createStructureFactorModelInput } from '../density/structure-factor-model.js';
import {
    createDifferenceDensityProgression,
} from '../density/difference-density-progress.js';
import { normalizeIsosurfaceSteps } from '../density/isosurface-progress.js';
import { assertCellsMatch } from '../density/cell-matching.js';
import { ThreeIsosurfaceLayer } from './three-isosurface-layer.js';

const VALID_ATOM_LABEL_PLACEMENT_MODES = [
    'auto-omit',
    'quality-omit',
    'performance-omit',
    'maximum-coverage',
];
const VALID_ATOM_LABEL_CALLOUT_PLACEMENTS = ['structure', 'viewport'];

/**
 * @typedef {object} AtomLabelPlacement
 * @property {string} id - Unique atom ID
 * @property {string} text - Displayed label text
 * @property {{left: number, right: number, top: number, bottom: number}} rect - Label bounds
 * @property {{x1: number, y1: number, x2: number, y2: number, radius: number}|null} leaderSegment
 * Screen-space connector, when one is needed
 * @property {boolean} [isCallout] - Whether this is an outer callout placement
 */

/**
 * @typedef {object} HiddenAtomLabel
 * @property {string} id - Unique atom ID
 * @property {string} text - Requested label text
 * @property {'static-no-space'|'viewport-capacity'|'no-space'|'max-visible'} reason
 * Why the label was omitted
 */

/**
 * @typedef {object} AtomLabelLayout
 * @property {AtomLabelPlacement[]} placed - Visible screen-space placements
 * @property {HiddenAtomLabel[]} hidden - Omitted labels and their reasons
 * @property {'none'|'quality-omit'|'performance-omit'|'maximum-coverage'} placementPolicy
 * Effective placement policy
 */

/**
 * Checks one public label-selection value.
 * @param {unknown} show - Candidate label selection
 * @returns {boolean} Whether the value matches the public API
 */
function isValidAtomLabelSelection(show) {
    if (show === 'none' || show === 'all' || show === 'non-hydrogen') {
        return true;
    }
    return Array.isArray(show) && show.every(item =>
        typeof item === 'string' ||
        (item !== null && typeof item === 'object' && typeof item.id === 'string'),
    );
}

/**
 * Validates atom-label options shared by construction and runtime updates.
 * @param {object} options - Partial atom-label options
 */
function validateAtomLabelOptions(options) {
    if (options.placementMode !== undefined &&
        !VALID_ATOM_LABEL_PLACEMENT_MODES.includes(options.placementMode)) {
        throw new Error(
            `Invalid atom label placement mode: "${options.placementMode}". ` +
            `Must be one of: ${VALID_ATOM_LABEL_PLACEMENT_MODES.join(', ')}`,
        );
    }
    if (options.calloutPlacement !== undefined &&
        !VALID_ATOM_LABEL_CALLOUT_PLACEMENTS.includes(options.calloutPlacement)) {
        throw new Error(
            `Invalid atom label callout placement: "${options.calloutPlacement}". ` +
            `Must be one of: ${VALID_ATOM_LABEL_CALLOUT_PLACEMENTS.join(', ')}`,
        );
    }
    if (options.show !== undefined && !isValidAtomLabelSelection(options.show)) {
        throw new Error(
            'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
        );
    }
    if (options.maxConnectorLength !== undefined &&
        !(typeof options.maxConnectorLength === 'number' && options.maxConnectorLength > 0)) {
        throw new Error('atomLabels.maxConnectorLength must be a positive number');
    }
    if (options.performanceNoSpaceCellSize !== undefined &&
        !(typeof options.performanceNoSpaceCellSize === 'number' &&
            options.performanceNoSpaceCellSize > 0)) {
        throw new Error('atomLabels.performanceNoSpaceCellSize must be a positive number');
    }
    if (options.autoPerformanceLabelThreshold !== undefined &&
        !(Number.isInteger(options.autoPerformanceLabelThreshold) &&
            options.autoPerformanceLabelThreshold >= 0)) {
        throw new Error('atomLabels.autoPerformanceLabelThreshold must be a non-negative integer');
    }
}

/**
 * Omits undefined partial values so they do not replace active defaults.
 * @param {object} options - Partial options
 * @returns {object} Defined option values
 */
function definedOptions(options) {
    return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
}

/**
 * Selects options belonging to one public option group.
 * @param {object} options - Flat per-load options.
 * @param {object} defaults - Default values defining the group keys.
 * @param {string[]} [extraNames] - Valid keys without global defaults.
 * @returns {object} Options selected for the group.
 */
function optionSubset(options, defaults, extraNames = []) {
    const names = new Set([...Object.keys(defaults), ...extraNames]);
    return Object.fromEntries(
        Object.entries(definedOptions(options)).filter(([name]) => names.has(name)),
    );
}

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
    constructor(options) {
        this.options = options;
        this.selectedObjects = new Set();
        this.selectionCallbacks = new Set();
        this.selectedData = new Set();
    }

    /**
     * Removes invalid selections and restores valid ones after structure changes.
     * @param {THREE.Object3D} container - Container with selectable objects
     */
    pruneInvalidSelections(container) {
        // Clear old visual selections since the objects no longer exist
        this.selectedObjects.clear();

        // With no stored selection there is nothing to reconcile. This is the
        // normal initial-display path and avoids two full scene traversals.
        if (this.selectedData.size === 0) {
            this.notifyCallbacks();
            return;
        }

        // Collect all available data in current structure
        const availableData = new Set();
        container.traverse((object) => {
            if (object.userData?.selectable) {
                const data = this.getObjectDescriptorData(object);
                if (data) {
                    availableData.add(JSON.stringify(data));
                }
            }
        });

        // Remove any stored data that doesn't exist in current structure
        this.selectedData = new Set(
            Array.from(this.selectedData).filter(stored =>
                availableData.has(JSON.stringify({
                    type: stored.type,
                    ...this.getDataWithoutColor(stored),
                })),
            ),
        );

        // Find and select visual objects that match our remaining stored data
        container.traverse((object) => {
            if (object.userData?.selectable) {
                const data = this.getObjectDescriptorData(object);
                if (this.hasMatchingData(data)) {
                    const color = this.getColorForData(data);
                    object.select(color, this.options);
                    this.selectedObjects.add(object);
                }
            }
        });

        this.notifyCallbacks();
    }

    /**
     * Returns a copy of the data without the color property.
     * @param {object} data - Data object containing selection information
     * @returns {object} Data without color information
     */
    getDataWithoutColor(data) {
        const { color, ...rest } = data;
        return rest;
    }

    /**
     * Extracts data from an object's to create a combination of uniquely identifyable
     * properties.
     * @param {THREE.Object3D} object - Object to extract data from
     * @returns {object|null} Extracted data or null if unavailable
     */
    getObjectDescriptorData(object) {
        if (!object.userData) {
            return null;
        }

        switch (object.userData.type) {
            case 'atom':
                return {
                    type: 'atom',
                    id: object.userData.atomData.uniqueId,
                    label: object.userData.atomData.label,
                };
            case 'bond':
                return {
                    type: 'bond',
                    atom1: object.userData.bondData.atom1Id,
                    atom2: object.userData.bondData.atom2Id,
                };
            case 'hbond':
                return {
                    type: 'hbond',
                    donor: object.userData.hbondData.donorAtomId,
                    hydrogen: object.userData.hbondData.hydrogenAtomId,
                    acceptor: object.userData.hbondData.acceptorAtomId,
                };
            default:
                return null;
        }
    }

    /**
     * Checks if there is stored data matching the given object data.
     * @param {object} data - Data to check against stored selections
     * @returns {boolean} True if matching data exists
     */
    hasMatchingData(data) {
        if (!data) {
            return false;
        }

        return Array.from(this.selectedData).some(stored => this.matchData(stored, data));
    }

    /**
     * Gets the color for a given data object, reuse the color if the data object has one 
     * assigned, otherwise get a new color.
     * @param {object} data - Data to get color for
     * @returns {number} Hex color code for the data
     */
    getColorForData(data) {
        const stored = Array.from(this.selectedData).find(stored => this.matchData(stored, data));
        return stored ? stored.color : this.getNextColor();
    }

    /**
     * Gets the next available color for a new selection.
     * @returns {number} Hex color code for the new selection
     */
    getNextColor() {
        const colorCounts = new Map();
        this.selectedData.forEach(data => {
            colorCounts.set(data.color, (colorCounts.get(data.color) || 0) + 1);
        });

        let color = this.options.selection.markerColors.find(c => !colorCounts.has(c));
        if (!color) {
            const minCount = Math.min(...colorCounts.values());
            color = this.options.selection.markerColors.find(c =>
                colorCounts.get(c) === minCount,
            );
        }
        return color;
    }

    /**
     * Processes selection/deselection of an object and manages selection state.
     * @param {THREE.Object3D} object - Object to handle selection for
     * @returns {number|null} The selection color or null if selection failed
     */
    handle(object) {
        if (this.options.mode === 'single') {
            this.selectedObjects.forEach(selected => {
                this.remove(selected);
            });
            this.selectedObjects.clear();
            this.selectedData.clear();
        }

        const data = this.getObjectDescriptorData(object);
        if (!data) {
            return null;
        }

        let color;
        if (this.hasMatchingData(data)) {
            color = object.selectionColor;
            this.remove(object);
            this.selectedData = new Set(
                Array.from(this.selectedData).filter(stored => !this.matchData(stored, data)),
            );
        } else {
            color = this.getNextColor();
            this.add(object, color);
            this.selectedData.add({ ...data, color });
        }

        this.notifyCallbacks();
        return color;
    }

    /**
     * Compares two data objects to determine if they represent the same entity.
     * @param {object} data1 - First data object
     * @param {object} data2 - Second data object
     * @returns {boolean} True if data objects match
     */
    matchData(data1, data2) {
        if (data1.type !== data2.type) {
            return false;
        }

        switch (data1.type) {
            case 'atom':
                return data1.id === data2.id;
            case 'bond':
                return (data1.atom1 === data2.atom1 && data1.atom2 === data2.atom2) ||
                    (data1.atom1 === data2.atom2 && data1.atom2 === data2.atom1);
            case 'hbond':
                return data1.donor === data2.donor &&
                    data1.hydrogen === data2.hydrogen &&
                    data1.acceptor === data2.acceptor;
            default:
                return false;
        }
    }

    /**
     * Adds an object to the selection set.
     * @param {THREE.Object3D} object - Object to add to selection
     * @param {number} [color] - Color to use for selection visualization
     */
    add(object, color) {
        object.select(color || this.getNextColor(), this.options);
        this.selectedObjects.add(object);
    }

    /**
     * Removes an object from the selection set.
     * @param {THREE.Object3D} object - Object to remove from selection
     */
    remove(object) {
        this.selectedObjects.delete(object);
        object.deselect();
    }

    /**
     * Clears all current selections.
     */
    clear() {
        this.selectedObjects.forEach(object => {
            this.remove(object);
        });
        this.selectedObjects.clear();
        this.selectedData.clear();
        this.notifyCallbacks();
    }

    /**
     * Registers a callback to be notified when selection changes.
     * @param {function(Array<{type: string, data: object, color: ?number}>): void} callback - Called
     *  with the updated list of selections
     */
    onChange(callback) {
        this.selectionCallbacks.add(callback);
    }

    /**
     * Notifies all registered callbacks about selection changes.
     * See the class JSDoc documentation for more information.
     */
    notifyCallbacks() {
        const selections = Array.from(this.selectedObjects).map(object => ({
            type: object.userData.type,
            data: object.userData.type === 'hbond' ? object.userData.hbondData :
                object.userData.type === 'bond' ? object.userData.bondData :
                    object.userData.atomData,
            color: object.selectionColor,
        }));
        this.selectionCallbacks.forEach(callback => callback(selections));
    }

    /**
     * Sets the selection mode (single or multiple).
     * @param {string} mode - 'single' or 'multiple'
     * @throws {Error} If mode value is invalid
     */
    setMode(mode) {
        if (mode !== 'single' && mode !== 'multiple') {
            throw new Error('Selection mode must be either "single" or "multiple"');
        }

        this.options.mode = mode;

        if (mode === 'single' && this.selectedObjects.size > 1) {
            const selectedObjects = Array.from(this.selectedObjects);
            const lastSelected = selectedObjects[selectedObjects.length - 1];
            const lastData = this.getObjectDescriptorData(lastSelected);

            this.clear();
            if (lastData) {
                this.add(lastSelected);
                this.selectedData.add({ ...lastData, color: lastSelected.selectionColor });
            }
            this.notifyCallbacks();
        }
    }

    /**
     * Releases resources used by the selection manager.
     */
    dispose() {
        this.clear();
        this.selectionCallbacks.clear();
    }

    /**
     * Selects atoms matching the provided labels.
     * @param {string[]} atomLabels - Labels of atoms to select
     * @param {THREE.Object3D} container - Container with selectable objects
     */
    selectAtoms(atomLabels, container) {
        const labelsSet = new Set(atomLabels);
        container.traverse((object) => {
            if (object.userData?.type === 'atom' &&
                object.userData?.selectable &&
                labelsSet.has(object.userData.atomData.label)) {

                const data = this.getObjectDescriptorData(object);
                if (!this.hasMatchingData(data)) {
                    this.add(object);
                    this.selectedData.add({ ...data, color: object.selectionColor });
                }
            }
        });
        this.notifyCallbacks();
    }
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
     * - bondRadius/bondColor/etc.: Appearance settings for bonds
     * - elementProperties: Per-element appearance settings (colors, radii)
     * - hydrogenMode/disorderMode/symmetryMode: Initial display modes
     * - renderMode: 'constant' for continuous updates or 'onDemand' for efficient rendering
     * - fixCifErrors: Whether to attempt automatic fixes for common CIF format issues
     * see ./structure-settings.js for the default values
     * @throws {Error} If a rendering enum contains an unsupported value
     */
    constructor(container, options = {}) {
        const validRenderModes = ['constant', 'onDemand'];
        if (options.renderMode && !validRenderModes.includes(options.renderMode)) {
            throw new Error(
                `Invalid render mode: "${options.renderMode}". Must be one of: ${validRenderModes.join(', ')}`,
            );
        }
        const validRenderStyles = ['solid-3d', 'cutout-3d', 'cutout-2d'];
        if (options.renderStyle && !validRenderStyles.includes(options.renderStyle)) {
            throw new Error(
                `Invalid render style: "${options.renderStyle}". ` +
                `Must be one of: ${validRenderStyles.join(', ')}`,
            );
        }
        validateAtomLabelOptions(options.atomLabels || {});
        const atomLabelOptions = definedOptions(options.atomLabels || {});

        this.container = container;
        const initialPosition = options.camera?.initialPosition ?? defaultSettings.camera.initialPosition;
        this.options = {
            camera: {
                ...defaultSettings.camera,
                ...(options.camera || {}),
                initialPosition: initialPosition.isVector3 ?
                    initialPosition.clone() : new THREE.Vector3(...initialPosition),
            },
            selection: {
                ...defaultSettings.selection,
                ...(options.selection || {}),
            },
            interaction: {
                ...defaultSettings.interaction,
                ...(options.interaction || {}),
            },
            atomLabels: {
                ...defaultSettings.atomLabels,
                ...atomLabelOptions,
                text: {
                    ...defaultSettings.atomLabels.text,
                    ...(atomLabelOptions.text || {}),
                },
            },
            atomDetail: options.atomDetail || defaultSettings.atomDetail,
            atomCutawayHysteresis: options.atomCutawayHysteresis ?? defaultSettings.atomCutawayHysteresis,
            atomCutawayStripeCount: options.atomCutawayStripeCount ??
                defaultSettings.atomCutawayStripeCount,
            atomCutawayStripeWidth: options.atomCutawayStripeWidth ??
                defaultSettings.atomCutawayStripeWidth,
            atomColorRoughness: options.atomColorRoughness || defaultSettings.atomColorRoughness,
            atomColorMetalness: options.atomColorMetalness || defaultSettings.atomColorMetalness,
            atomADPRingWidthFactor: options.atomADPRingWidthFactor || defaultSettings.atomADPRingWidthFactor,
            atomADPRingHeight: options.atomADPRingHeight || defaultSettings.atomADPRingHeight,
            atomADPRingSections: options.atomADPRingSections || defaultSettings.atomADPRingSections,
            bondRadius: options.bondRadius || defaultSettings.bondRadius,
            bondSections: options.bondSections || defaultSettings.bondSections,
            bondColor: options.bondColor || defaultSettings.bondColor,
            bondColorRoughness: options.bondColorRoughness || defaultSettings.bondColorRoughness,
            bondColorMetalness: options.bondColorMetalness || defaultSettings.bondColorMetalness,
            bondGrowTolerance: options.bondGrowTolerance ?? defaultSettings.bondGrowTolerance,
            hbondRadius: options.hbondRadius ?? defaultSettings.hbondRadius,
            hbondColor: options.hbondColor || defaultSettings.hbondColor,
            hbondColorRoughness: options.hbondColorRoughness ?? defaultSettings.hbondColorRoughness,
            hbondColorMetalness: options.hbondColorMetalness ?? defaultSettings.hbondColorMetalness,
            hbondDashSegmentLength: options.hbondDashSegmentLength ?? defaultSettings.hbondDashSegmentLength,
            hbondDashFraction: options.hbondDashFraction ?? defaultSettings.hbondDashFraction,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...options.elementProperties,
            },
            hydrogenMode: options.hydrogenMode || defaultSettings.hydrogenMode,
            disorderMode: options.disorderMode || defaultSettings.disorderMode,
            symmetryMode: options.symmetryMode || defaultSettings.symmetryMode,
            renderMode: options.renderMode || defaultSettings.renderMode,
            renderStyle: options.renderStyle || defaultSettings.renderStyle,
            plot2DBackground: options.plot2DBackground || defaultSettings.plot2DBackground,
            plot2DAtomColor: options.plot2DAtomColor || defaultSettings.plot2DAtomColor,
            plot2DLineColor: options.plot2DLineColor || defaultSettings.plot2DLineColor,
            plot2DBondColor: options.plot2DBondColor || defaultSettings.plot2DBondColor,
            plot2DOpenBondInnerScale: options.plot2DOpenBondInnerScale ??
                defaultSettings.plot2DOpenBondInnerScale,
            plot2DStripeCount: options.plot2DStripeCount ?? defaultSettings.plot2DStripeCount,
            plot2DStripeWidth: options.plot2DStripeWidth ?? defaultSettings.plot2DStripeWidth,
            plot2DOutlineScale: options.plot2DOutlineScale ?? defaultSettings.plot2DOutlineScale,
            fixCifErrors: options.fixCifErrors || defaultSettings.fixCifErrors,
            cell: {
                ...defaultSettings.cell,
                ...options.cell,
            },
            differenceDensity: {
                ...defaultSettings.differenceDensity,
                ...definedOptions(options.differenceDensity || {}),
            },
            scalarField: {
                ...defaultSettings.scalarField,
                ...definedOptions(options.scalarField || {}),
            },
            isosurface: {
                ...defaultSettings.isosurface,
                ...definedOptions(options.isosurface || {}),
            },
        };

        this.state = {
            isDragging: false,
            currentCifContent: null,
            currentCifBlock: null,
            currentStructure: null,
            displayStructure: null,
            currentFloor: null,
            baseStructure: null,
            ortepObjects: new Map(),
            structureCenter: new THREE.Vector3(),
            scalarField: null,
            isosurfaceResolutionFraction: 1,
            currentStructureFactorModel: null,
        };

        this.scalarFieldUpdateCallbacks = new Set();
        this.scalarFieldLoadSequence = 0;
        this.scalarFieldWorker = null;
        this.scalarFieldPendingResolve = null;
        this.scalarFieldMainThreadLoadId = null;

        this.modifiers = {
            removeatoms: new AtomLabelFilter(),
            addhydrogen: new IsolatedHydrogenFixer(),
            missingbonds: new BondGenerator(
                this.options.elementProperties,
                this.options.bondGrowTolerance,
            ),
            disorder: new DisorderFilter(this.options.disorderMode),
            symmetry: new SymmetryGrower(this.options.symmetryMode),
            hydrogen: new HydrogenFilter(this.options.hydrogenMode),
        };

        this.selections = new SelectionManager(this.options);

        this.setupScene();
        this.isosurfaceLayer = new ThreeIsosurfaceLayer(
            this.moleculeContainer,
            this.options.isosurface,
        );
        this.atomLabelManager = new AtomLabelManager(this);
        this.controls = new ViewerControls(this);
        this.animate();
        this.needsRender = true;

    }

    /**
     * Sets up the Three.js scene, camera, and renderer.
     * @private
     */
    setupScene() {
        this.scene = new THREE.Scene();

        this.cameraController = createCameraController(this.container, this.options);
        this.camera = this.cameraController.camera;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        if (this.options.renderStyle === 'cutout-2d') {
            this.renderer.setClearColor(this.options.plot2DBackground, 1);
        }
        this.resizeRendererToDisplaySize();
        this.container.appendChild(this.renderer.domElement);

        this.moleculeContainer = new THREE.Group();
        this.scene.add(this.moleculeContainer);

        this.camera.position.copy(this.options.camera.initialPosition);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.camera.lookAt(this.cameraTarget);
    }

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
    async loadCIF(cifText, cifBlock = 0, options = {}) {
        if (cifText === undefined) {
            console.error('Cannot load an empty text as CIF');
            return { success: false, error: 'Cannot load an empty text as CIF' };
        }
        try {
            const cif = new CIF(cifText);
            let block;
            try {
                block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
            } catch (e) {
                return { success: false, error: e.message };
            }
            let structure;
            try {
                structure = CrystalStructure.fromCIF(block);
            } catch (e) {
                if (!this.options.fixCifErrors) {
                    try {
                        tryToFixCifBlock(block);
                        structure = CrystalStructure.fromCIF(block);
                    } catch {
                        // throw original error as it should be more informative
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
            // Density data belongs to a specific coordinate model/cell. A new
            // coordinate CIF must never inherit the previous FCF implicitly.
            const hadScalarField = Boolean(this.state.scalarField);
            this.cancelScalarFieldLoad('Coordinate structure changed');
            this.isosurfaceLayer.clear();
            this.state.scalarField = null;
            if (hadScalarField) {
                this.notifyScalarFieldUpdate({ type: 'cleared' });
            }
            await this.loadStructure(structure);

            this.state.currentCifContent = cifText;
            this.state.currentCifBlock = cifBlock;
            this.state.currentStructureFactorModel = createStructureFactorModelInput(
                structure,
                block,
            );

            const densityRequest = options.differenceDensity ??
                this.options.differenceDensity.autoLoad;
            if (!densityRequest) {
                return { success: true };
            }
            const densityOptions = densityRequest === true ? {} : densityRequest;
            if (typeof densityOptions !== 'object' || Array.isArray(densityOptions)) {
                return {
                    success: false,
                    error: 'loadCIF differenceDensity must be true, false, or an options object',
                };
            }
            // Structure installation and its initial render are complete before
            // density work is even scheduled. In browsers, all reflection/IAM/
            // FFT work then stays inside the dedicated density worker.
            const differenceDensity = new Promise(resolve => setTimeout(() => {
                if (this.state.currentCifContent !== cifText || this.state.currentCifBlock !== cifBlock) {
                    resolve({ success: false, cancelled: true, error: 'Coordinate structure changed' });
                    return;
                }
                this.loadDifferenceDensity(cifText, cifBlock, densityOptions).then(resolve);
            }, 0));
            return { success: true, differenceDensityStarted: true, differenceDensity };
        } catch (error) {
            console.error('Error loading structure:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Loads an FCF progressively and displays its Fo-Fc difference density.
     * The worker calculates one fixed, oversampled scalar grid. Progressive
     * updates reuse that grid and refine only its surface tessellation.
     * @param {string} fcfText - LIST 6/8-style FCF text.
     * @param {number|string} [fcfBlock] - FCF block index or name.
     * @param {object} [options] - Partial difference-density display options.
     * @returns {Promise<object>} Load result and map statistics.
     */
    async loadDifferenceDensity(fcfText, fcfBlock = 0, options = {}) {
        if (!this.state.baseStructure) {
            return { success: false, error: 'Load a crystal structure before loading difference density' };
        }
        if (fcfText === undefined) {
            return { success: false, error: 'Cannot load empty text as an FCF' };
        }

        this.cancelScalarFieldLoad('Superseded by a new FCF load');
        this.isosurfaceLayer.clear();
        this.state.scalarField = null;
        this.options.differenceDensity = {
            ...this.options.differenceDensity,
            ...optionSubset(options, defaultSettings.differenceDensity),
        };
        this.options.isosurface = {
            ...this.options.isosurface,
            ...optionSubset(options, defaultSettings.isosurface, ['level', 'sign']),
        };
        this.options.scalarField = {
            ...this.options.scalarField,
            ...optionSubset(options, defaultSettings.scalarField),
        };
        this.isosurfaceLayer.setOptions(this.options.isosurface);
        const loadId = ++this.scalarFieldLoadSequence;
        this.notifyScalarFieldUpdate({
            type: 'started',
            loadId,
            visible: this.options.isosurface.visible,
            sigmaLevel: this.options.isosurface.sigmaLevel,
        });

        if (this.options.scalarField.useWorker && typeof Worker !== 'undefined') {
            return this.loadDifferenceDensityInWorker(fcfText, fcfBlock, loadId);
        }
        return this.loadDifferenceDensityOnMainThread(fcfText, fcfBlock, loadId);
    }

    /**
     * Loads a periodic Gaussian Cube scalar field over the active crystal.
     * Cube coordinates and density values are normalized to Å and e/Å³ by
     * default. Use `property: "orbital"|"potential"|"generic"` for other
     * scalar quantities, and `datasetIndex` for multi-orbital files.
     * @param {string} cubeText - Complete Gaussian Cube file contents.
     * @param {object} [options] - Cube parsing and density display options.
     * @returns {Promise<object>} Load result and map statistics.
     */
    async loadCube(cubeText, options = {}) {
        if (!this.state.baseStructure) {
            return { success: false, error: 'Load a crystal structure before loading a Cube file' };
        }
        if (typeof cubeText !== 'string' || cubeText.length === 0) {
            return { success: false, error: 'Cannot load empty text as a Cube file' };
        }
        if (options === null || typeof options !== 'object' || Array.isArray(options)) {
            return { success: false, error: 'loadCube options must be an object' };
        }

        this.cancelScalarFieldLoad('Superseded by a new Cube load');
        this.isosurfaceLayer.clear();
        this.state.scalarField = null;
        const cubeOptionNames = new Set([
            'property', 'datasetIndex', 'valueScale', 'valueUnit',
            'displayLabel', 'quantityName', 'periodic', 'level', 'sign',
        ]);
        const displayOptions = optionSubset(
            options,
            defaultSettings.isosurface,
            ['level', 'sign'],
        );
        this.options.isosurface = {
            ...this.options.isosurface,
            ...displayOptions,
        };
        // Absolute Cube level/sign live on the loaded map. Do not inherit an
        // override that may have been applied to a previous Fourier map.
        delete this.options.isosurface.level;
        delete this.options.isosurface.sign;
        this.options.scalarField = {
            ...this.options.scalarField,
            ...optionSubset(options, defaultSettings.scalarField),
        };
        this.isosurfaceLayer.setOptions(this.options.isosurface);
        const cubeOptions = Object.fromEntries(
            Object.entries(definedOptions(options))
                .filter(([name]) => cubeOptionNames.has(name)),
        );
        const property = cubeOptions.property ?? 'density';
        const propertyDisplay = {
            density: { displayLabel: 'ρ/eÅ⁻³', quantityName: 'electron density', signed: false },
            'signed-density': { displayLabel: 'Δρ/eÅ⁻³', quantityName: 'signed density', signed: true },
            orbital: { displayLabel: 'ψ', quantityName: 'orbital', signed: true },
            potential: { displayLabel: 'V', quantityName: 'potential', signed: true },
            generic: { displayLabel: 'Cube', quantityName: 'Cube field', signed: true },
        }[property] ?? { displayLabel: 'Cube', quantityName: 'Cube field', signed: true };
        const loadId = ++this.scalarFieldLoadSequence;
        this.notifyScalarFieldUpdate({
            type: 'started',
            loadId,
            visible: this.options.isosurface.visible,
            sigmaLevel: null,
            sourceType: 'cube',
            displayLabel: cubeOptions.displayLabel ?? propertyDisplay.displayLabel,
            quantityName: cubeOptions.quantityName ?? propertyDisplay.quantityName,
            signed: cubeOptions.sign === 'positive' ? false : propertyDisplay.signed,
        });

        if (this.options.scalarField.useWorker && typeof Worker !== 'undefined') {
            return this.loadCubeInWorker(cubeText, cubeOptions, loadId);
        }
        return this.loadCubeOnMainThread(cubeText, cubeOptions, loadId);
    }

    /**
     * Subscribes to scalar-field events (`started`, `update`, `complete`, `display`,
     * `visibility`, `cleared`, `error`, and `cancelled`). Display-bearing events
     * expose level/visibility fields so UIs need not inspect renderer state.
     * @param {function(object): void} callback - Update listener.
     * @returns {function(): void} Function that removes the listener.
     */
    onScalarFieldUpdate(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Scalar-field update callback must be a function');
        }
        this.scalarFieldUpdateCallbacks.add(callback);
        return () => this.scalarFieldUpdateCallbacks.delete(callback);
    }

    /**
     * Notifies all scalar-field listeners.
     * @param {object} update - Scalar-field pipeline event.
     */
    notifyScalarFieldUpdate(update) {
        for (const callback of this.scalarFieldUpdateCallbacks) {
            try {
                callback(update);
            } catch (error) {
                console.error('Scalar-field update callback failed:', error);
            }
        }
    }

    /**
     * Runs the progressive pipeline in a module worker.
     * @param {string} fcfText - FCF source text.
     * @param {number|string} fcfBlock - FCF block index or name.
     * @param {number} loadId - Identifier used to reject stale worker events.
     * @returns {Promise<object>} Final load result.
     * @private
     */
    loadDifferenceDensityInWorker(fcfText, fcfBlock, loadId) {
        return new Promise(resolve => {
            const worker = new ScalarFieldWorker();
            this.scalarFieldWorker = worker;
            this.scalarFieldPendingResolve = resolve;

            const fail = (error) => {
                if (loadId !== this.scalarFieldLoadSequence) {
                    return;
                }
                const message = error?.message || String(error);
                console.error('Error loading difference density:', error);
                this.notifyScalarFieldUpdate({ type: 'error', loadId, error: message });
                this.finishScalarFieldWorker();
                resolve({ success: false, error: message });
            };

            worker.addEventListener('error', fail);
            worker.addEventListener('message', event => {
                const message = event.data;
                if (message.loadId !== loadId || loadId !== this.scalarFieldLoadSequence) {
                    return;
                }
                if (message.type === 'error') {
                    fail(new Error(message.error));
                    return;
                }
                if (message.type !== 'update') {
                    return;
                }

                try {
                    const field = message.map
                        ? this.scalarFieldFromPayload(message.map)
                        : this.state.scalarField;
                    if (!field) {
                        throw new Error('Density worker requested surface refinement before providing a grid');
                    }
                    this.applyProgressiveScalarField(field, message);
                    if (message.final) {
                        const result = this.scalarFieldResult(field);
                        this.notifyScalarFieldUpdate({
                            ...message,
                            ...result,
                            type: 'complete',
                            loadId,
                        });
                        this.finishScalarFieldWorker();
                        resolve(result);
                    } else {
                        this.continueScalarFieldWorkerAfterRender(worker, loadId, message.stepIndex);
                    }
                } catch (error) {
                    fail(error);
                }
            });

            worker.postMessage({
                type: 'load-difference-density',
                loadId,
                fcfText,
                fcfBlock,
                datasetOptions: this.differenceDensityDatasetOptions(),
                steps: this.options.isosurface.progressiveSteps,
                reciprocalResolution: this.options.differenceDensity.reciprocalResolution,
                initialGridOversampling: this.options.differenceDensity.initialGridOversampling,
                gridOversampling: this.options.differenceDensity.gridOversampling,
            });
        });
    }

    /**
     * Runs Cube parsing in the density worker and progressively refines its surface.
     * @param {string} cubeText - Complete Cube file contents.
     * @param {object} cubeOptions - Worker-safe Cube parser options.
     * @param {number} loadId - Active density load identifier.
     * @returns {Promise<object>} Final Cube load result.
     */
    loadCubeInWorker(cubeText, cubeOptions, loadId) {
        return new Promise(resolve => {
            const worker = new ScalarFieldWorker();
            this.scalarFieldWorker = worker;
            this.scalarFieldPendingResolve = resolve;

            const fail = (error) => {
                if (loadId !== this.scalarFieldLoadSequence) {
                    return;
                }
                const message = error?.message || String(error);
                console.error('Error loading Cube field:', error);
                this.notifyScalarFieldUpdate({ type: 'error', loadId, error: message });
                this.finishScalarFieldWorker();
                resolve({ success: false, error: message });
            };

            worker.addEventListener('error', fail);
            worker.addEventListener('message', event => {
                const message = event.data;
                if (message.loadId !== loadId || loadId !== this.scalarFieldLoadSequence) {
                    return;
                }
                if (message.type === 'error') {
                    fail(new Error(message.error));
                    return;
                }
                if (message.type !== 'update') {
                    return;
                }
                try {
                    const field = message.map
                        ? this.scalarFieldFromPayload(message.map)
                        : this.state.scalarField;
                    if (!field) {
                        throw new Error('Cube worker requested refinement before providing a grid');
                    }
                    this.applyProgressiveScalarField(field, message);
                    if (message.final) {
                        const result = this.scalarFieldResult(field);
                        this.notifyScalarFieldUpdate({
                            ...message,
                            ...result,
                            type: 'complete',
                            loadId,
                        });
                        this.finishScalarFieldWorker();
                        resolve(result);
                    } else {
                        this.continueScalarFieldWorkerAfterRender(worker, loadId, message.stepIndex);
                    }
                } catch (error) {
                    fail(error);
                }
            });

            worker.postMessage({
                type: 'load-cube',
                loadId,
                cubeText,
                cubeOptions,
                steps: this.options.isosurface.progressiveSteps,
            });
        });
    }

    /**
     * Synchronous-environment fallback retaining the same progressive events.
     * @param {string} fcfText - FCF source text.
     * @param {number|string} fcfBlock - FCF block index or name.
     * @param {number} loadId - Identifier used to reject stale results.
     * @returns {Promise<object>} Final load result.
     * @private
     */
    async loadDifferenceDensityOnMainThread(fcfText, fcfBlock, loadId) {
        this.scalarFieldMainThreadLoadId = loadId;
        try {
            const dataset = parseDifferenceDensitySource(
                fcfText,
                fcfBlock,
                this.differenceDensityDatasetOptions(),
            );
            const progression = createDifferenceDensityProgression(dataset, {
                steps: this.options.isosurface.progressiveSteps,
                reciprocalResolution: this.options.differenceDensity.reciprocalResolution,
                initialGridOversampling: this.options.differenceDensity.initialGridOversampling,
                gridOversampling: this.options.differenceDensity.gridOversampling,
            });
            const steps = progression.steps;
            let densityMap;
            for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
                if (loadId !== this.scalarFieldLoadSequence) {
                    return { success: false, cancelled: true, error: 'Difference-density load cancelled' };
                }
                densityMap = progression.mapAt(stepIndex).map;
                const message = {
                    loadId,
                    stepIndex,
                    totalSteps: steps.length,
                    final: stepIndex === steps.length - 1,
                    surfaceResolutionFraction: steps[stepIndex],
                };
                this.applyProgressiveScalarField(densityMap, message);
                if (!message.final) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            const result = this.scalarFieldResult(densityMap);
            this.notifyScalarFieldUpdate({ type: 'complete', loadId, ...result });
            return result;
        } catch (error) {
            if (loadId !== this.scalarFieldLoadSequence) {
                return { success: false, cancelled: true, error: 'Difference-density load cancelled' };
            }
            console.error('Error loading difference density:', error);
            this.notifyScalarFieldUpdate({ type: 'error', loadId, error: error.message });
            return { success: false, error: error.message };
        } finally {
            if (this.scalarFieldMainThreadLoadId === loadId) {
                this.scalarFieldMainThreadLoadId = null;
            }
        }
    }

    /**
     * Synchronous-environment Cube fallback retaining progressive surface events.
     * @param {string} cubeText - Complete Cube file contents.
     * @param {object} cubeOptions - Cube parser options.
     * @param {number} loadId - Active density load identifier.
     * @returns {Promise<object>} Final Cube load result.
     */
    async loadCubeOnMainThread(cubeText, cubeOptions, loadId) {
        this.scalarFieldMainThreadLoadId = loadId;
        try {
            const densityMap = parseCube(cubeText, cubeOptions);
            const steps = this.normalizedIsosurfaceSteps();
            for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
                if (loadId !== this.scalarFieldLoadSequence) {
                    return { success: false, cancelled: true, error: 'Cube load cancelled' };
                }
                const message = {
                    loadId,
                    stepIndex,
                    totalSteps: steps.length,
                    final: stepIndex === steps.length - 1,
                    surfaceResolutionFraction: steps[stepIndex],
                };
                this.applyProgressiveScalarField(densityMap, message);
                if (!message.final) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            const result = this.scalarFieldResult(densityMap);
            this.notifyScalarFieldUpdate({ type: 'complete', loadId, ...result });
            return result;
        } catch (error) {
            if (loadId !== this.scalarFieldLoadSequence) {
                return { success: false, cancelled: true, error: 'Cube load cancelled' };
            }
            console.error('Error loading Cube field:', error);
            this.notifyScalarFieldUpdate({ type: 'error', loadId, error: error.message });
            return { success: false, error: error.message };
        } finally {
            if (this.scalarFieldMainThreadLoadId === loadId) {
                this.scalarFieldMainThreadLoadId = null;
            }
        }
    }

    /**
     * Adds the active coordinate CIF to the public anomalous-correction option.
     * @returns {object|null} Worker-safe correction configuration.
     * @private
     */
    differenceDensityAnomalousDispersionOptions() {
        const option = this.options.differenceDensity.anomalousDispersion;
        if (!option) {
            return null;
        }
        if (option !== true && (typeof option !== 'object' || Array.isArray(option))) {
            throw new Error('differenceDensity.anomalousDispersion must be true, false, or an object');
        }
        return {
            ...(option === true ? {} : option),
            cifText: this.state.currentCifContent,
            cifBlock: this.state.currentCifBlock,
            structureModel: this.state.currentStructureFactorModel,
        };
    }

    /** @returns {object} Worker-safe coefficient or CIF/IAM dataset options. */
    differenceDensityDatasetOptions() {
        return {
            inputMode: this.options.differenceDensity.inputMode,
            coefficientColumns: this.options.differenceDensity.coefficientColumns,
            anomalousDispersion: this.differenceDensityAnomalousDispersionOptions(),
            coordinateCifText: this.state.currentCifContent,
            coordinateCifBlock: this.state.currentCifBlock,
            structureModel: this.state.currentStructureFactorModel,
            reflections: this.options.differenceDensity.reflections,
            iam: this.options.differenceDensity.iam,
            intensityScale: this.options.differenceDensity.intensityScale,
            extinctionCorrection: this.options.differenceDensity.extinctionCorrection,
        };
    }

    /** @returns {number[]} Valid ordered surface-resolution fractions. */
    normalizedIsosurfaceSteps() {
        return normalizeIsosurfaceSteps(this.options.isosurface.progressiveSteps);
    }

    /**
     * @param {object} payload - Transferable worker map data.
     * @returns {ScalarFieldGrid} Field reconstructed from a worker payload.
     */
    scalarFieldFromPayload(payload) {
        return ScalarFieldGrid.fromPayload(payload);
    }

    /**
     * Applies one progressive map and emits its update signal.
     * @param {ScalarFieldGrid} field - Current scalar grid.
     * @param {object} message - Progressive step metadata.
     */
    applyProgressiveScalarField(field, message) {
        this.validateScalarFieldCell(field.cell, this.state.baseStructure.cell,
            field.sourceType === 'cube' ? 'Cube' : 'FCF');
        this.state.scalarField = field;
        this.state.isosurfaceResolutionFraction = message.surfaceResolutionFraction ?? 1;
        this.isosurfaceLayer.setField(field, this.state.isosurfaceResolutionFraction);
        this.isosurfaceLayer.setStructure(this.state.displayStructure);
        const surfaceStatistics = this.isosurfaceLayer.rebuild() ?? {};
        const display = this.scalarFieldDisplayState();
        this.requestRender();
        this.notifyScalarFieldUpdate({
            type: 'update',
            ...message,
            progress: (message.stepIndex + 1) / message.totalSteps,
            resolutionFraction: field.resolutionFraction,
            gridOversampling: field.gridOversampling,
            surfaceResolutionFraction: this.state.isosurfaceResolutionFraction,
            surfaceResolution: surfaceStatistics.resolution ?? 0,
            dimensions: [...field.dimensions],
            reflectionCount: field.reflectionCount,
            coefficientCount: field.coefficientCount,
            coefficientMode: field.coefficientMode,
            omitF000: field.omitF000,
            anomalousDispersion: field.anomalousDispersion,
            sourceType: field.sourceType,
            fieldKind: field.fieldKind,
            property: field.property,
            datasetCount: field.datasetCount,
            datasetIndex: field.datasetIndex,
            datasetId: field.datasetId,
            valueUnit: field.valueUnit,
            displayLabel: field.displayLabel,
            quantityName: field.quantityName,
            signed: field.surfaceSign !== 'positive',
            intensityScale: field.intensityScale,
            scaleR1: field.scaleR1,
            observations: field.observations,
            iam: field.iam,
            reflectionPolicy: field.reflectionPolicy,
            extinctionCorrection: field.extinctionCorrection,
            sigma: field.sigma,
            minimum: field.minimum,
            maximum: field.maximum,
            polygonCount: surfaceStatistics.polygonCount ?? 0,
            positivePolygonCount: surfaceStatistics.positivePolygonCount ?? 0,
            negativePolygonCount: surfaceStatistics.negativePolygonCount ?? 0,
            symmetryUsed: surfaceStatistics.symmetryUsed ?? false,
            displayedRegionCount: surfaceStatistics.displayedRegionCount ?? 1,
            generatedRegionCount: surfaceStatistics.generatedRegionCount ?? 1,
            reusedRegionCount: surfaceStatistics.reusedRegionCount ?? 0,
            marchingCubesPassCount: surfaceStatistics.marchingCubesPassCount ?? 2,
            marchingCubesTimeMs: surfaceStatistics.marchingCubesTimeMs ??
                surfaceStatistics.generationTimeMs ?? 0,
            polygonizationTimeMs: surfaceStatistics.polygonizationTimeMs ?? 0,
            stitched: surfaceStatistics.stitched ?? false,
            stitchTimeMs: surfaceStatistics.stitchTimeMs ?? 0,
            removedDuplicateTriangleCount:
                surfaceStatistics.removedDuplicateTriangleCount ?? 0,
            ...display,
        });
    }

    /**
     * Waits for a browser frame before requesting the next surface refinement.
     * @param {Worker} worker - Active density worker.
     * @param {number} loadId - Active load identifier.
     * @param {number} stepIndex - Surface step awaiting acknowledgement.
     */
    continueScalarFieldWorkerAfterRender(worker, loadId, stepIndex) {
        let continued = false;
        const continueWorker = () => {
            if (continued || worker !== this.scalarFieldWorker) {
                return;
            }
            continued = true;
            worker.postMessage({ type: 'continue', loadId, stepIndex });
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(continueWorker);
        }
        setTimeout(continueWorker, 100);
    }

    /**
     * @param {ScalarFieldGrid} field - Completed scalar grid.
     * @returns {object} Public successful density-load result.
     */
    scalarFieldResult(field) {
        const surfaceStatistics = this.isosurfaceLayer.statistics;
        return {
            success: true,
            reflectionCount: field.reflectionCount,
            coefficientCount: field.coefficientCount,
            coefficientMode: field.coefficientMode,
            omitF000: field.omitF000,
            anomalousDispersion: field.anomalousDispersion,
            sourceType: field.sourceType,
            fieldKind: field.fieldKind,
            property: field.property,
            datasetCount: field.datasetCount,
            datasetIndex: field.datasetIndex,
            datasetId: field.datasetId,
            valueUnit: field.valueUnit,
            intensityScale: field.intensityScale,
            scaleR1: field.scaleR1,
            observations: field.observations,
            iam: field.iam,
            reflectionPolicy: field.reflectionPolicy,
            extinctionCorrection: field.extinctionCorrection,
            dimensions: [...field.dimensions],
            gridOversampling: field.gridOversampling,
            sigma: field.sigma,
            minimum: field.minimum,
            maximum: field.maximum,
            polygonCount: surfaceStatistics.polygonCount ?? 0,
            positivePolygonCount: surfaceStatistics.positivePolygonCount ?? 0,
            negativePolygonCount: surfaceStatistics.negativePolygonCount ?? 0,
            symmetryUsed: surfaceStatistics.symmetryUsed ?? false,
            displayedRegionCount: surfaceStatistics.displayedRegionCount ?? 1,
            generatedRegionCount: surfaceStatistics.generatedRegionCount ?? 1,
            reusedRegionCount: surfaceStatistics.reusedRegionCount ?? 0,
            marchingCubesPassCount: surfaceStatistics.marchingCubesPassCount ?? 2,
            marchingCubesTimeMs: surfaceStatistics.marchingCubesTimeMs ??
                surfaceStatistics.generationTimeMs ?? 0,
            stitched: surfaceStatistics.stitched ?? false,
            stitchTimeMs: surfaceStatistics.stitchTimeMs ?? 0,
            removedDuplicateTriangleCount:
                surfaceStatistics.removedDuplicateTriangleCount ?? 0,
            ...this.scalarFieldDisplayState(),
        };
    }

    /** @returns {object} Renderer-independent density state exposed to UI listeners. */
    scalarFieldDisplayState() {
        return this.isosurfaceLayer.displayState;
    }

    /** Terminates the active worker without resolving its already-handled promise. */
    finishScalarFieldWorker() {
        this.scalarFieldWorker?.terminate();
        this.scalarFieldWorker = null;
        this.scalarFieldPendingResolve = null;
    }

    /**
     * Cancels any in-flight progressive density load.
     * @param {string} reason - Public cancellation reason.
     */
    cancelScalarFieldLoad(reason = 'Scalar-field load cancelled') {
        const mainThreadActive = this.scalarFieldMainThreadLoadId !== null;
        if (!this.scalarFieldWorker && !this.scalarFieldPendingResolve && !mainThreadActive) {
            return;
        }
        const loadId = this.scalarFieldMainThreadLoadId ?? this.scalarFieldLoadSequence;
        if (mainThreadActive) {
            this.scalarFieldLoadSequence++;
            this.scalarFieldMainThreadLoadId = null;
        }
        this.scalarFieldWorker?.terminate();
        this.scalarFieldWorker = null;
        const resolve = this.scalarFieldPendingResolve;
        this.scalarFieldPendingResolve = null;
        resolve?.({ success: false, cancelled: true, error: reason });
        this.notifyScalarFieldUpdate({ type: 'cancelled', loadId, error: reason });
    }

    /**
     * Updates contour and appearance options without rebuilding the scalar field.
     * @param {object} options - Partial isosurface display options.
     * @returns {object} Update result.
     */
    updateIsosurfaceOptions(options = {}) {
        const updates = definedOptions(options);
        if (Object.keys(updates).length === 1 && Object.hasOwn(updates, 'visible')) {
            return this.setIsosurfaceVisibility(updates.visible);
        }
        this.options.isosurface = {
            ...this.options.isosurface,
            ...updates,
        };
        this.isosurfaceLayer.setOptions(this.options.isosurface);
        if (this.state.scalarField && this.state.displayStructure) {
            this.isosurfaceLayer.rebuild();
            this.requestRender();
            this.notifyScalarFieldUpdate({
                type: 'display',
                ...this.scalarFieldDisplayState(),
            });
        }
        return { success: true };
    }

    /**
     * Shows or hides the existing isosurfaces without rebuilding them.
     * @param {boolean} visible - Requested visibility.
     * @returns {object} Successful visibility update.
     */
    setIsosurfaceVisibility(visible) {
        const usedVisibility = this.isosurfaceLayer.setVisible(visible);
        this.options.isosurface.visible = usedVisibility;
        this.requestRender();
        this.notifyScalarFieldUpdate({
            type: 'visibility',
            visible: usedVisibility,
        });
        return { success: true, visible: usedVisibility };
    }

    /** Removes the loaded scalar field and its isosurfaces. */
    clearScalarField() {
        this.cancelScalarFieldLoad();
        this.isosurfaceLayer.clear();
        this.state.scalarField = null;
        this.state.isosurfaceResolutionFraction = 1;
        this.notifyScalarFieldUpdate({ type: 'cleared' });
        this.requestRender();
    }

    /**
     * Ensures that a scalar field belongs to the displayed coordinate CIF.
     * @param {object} fieldCell - Unit cell parsed from the field source.
     * @param {object} structureCell - Unit cell parsed from the coordinate CIF.
     * @param {string} [label] - Source label used in mismatch errors.
     * @private
     */
    validateScalarFieldCell(fieldCell, structureCell, label = 'scalar field') {
        assertCellsMatch(fieldCell, structureCell, label);
    }

    /**
     * Initializes a new structure in the viewer with proper orientation.
     * @param {CrystalStructure} [structure] - Crystal structure to load. Defaults to the
     * viewer's current base structure, so callers can use this to reset the camera/orientation
     * for a modifier change without having to thread the structure through themselves.
     * @returns {Promise<object>} Object indicating success
     * @private
     */
    async loadStructure(structure = this.state.baseStructure) {
        this.state.baseStructure = structure;
        this.selections.clear();

        // Complete reset of molecule container
        this.moleculeContainer.position.set(0, 0, 0);
        this.moleculeContainer.rotation.set(0, 0, 0);
        this.moleculeContainer.scale.set(1, 1, 1);
        this.moleculeContainer.updateMatrix();
        this.moleculeContainer.matrixAutoUpdate = true;  // Enable auto updates for new transformations
        this.moleculeContainer.updateMatrixWorld(true);

        // Reset camera target and position
        this.cameraTarget.set(0, 0, 0);
        this.camera.position.copy(this.options.camera.initialPosition);
        this.camera.lookAt(this.cameraTarget);

        // Reset structure center
        this.state.structureCenter.set(0, 0, 0);

        this.update3DOrtep();

        // Calculate initial rotation
        const rotation = structureOrientationMatrix(this.state.currentStructure);
        if (this.container.clientHeight > this.container.clientWidth) {
            rotation.premultiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        }

        if (rotation) {
            this.moleculeContainer.setRotationFromMatrix(rotation);
            this.moleculeContainer.updateMatrix();
        }

        // Centre on the rendered molecule, not auxiliary objects such as the
        // unit-cell helper or an asymmetric/clipped density surface. Density is
        // normally added after the initial structure load, but it is already
        // present when a growth-mode change rebuilds the scene; including it
        // here would therefore move the molecule after cycling modifiers.
        this.moleculeContainer.updateMatrixWorld(true);
        const extent = new THREE.Box3().setFromObject(this.state.currentStructure);
        extent.getCenter(this.state.structureCenter);

        this.moleculeContainer.position.sub(this.state.structureCenter);

        this.updateCamera();
        setupLighting(this.scene, this.state.currentStructure);
        this.requestRender();
        return { success: true };
    }

    /**
     * Updates the current structure while preserving rotation.
     * Used internally when structure modifiers change.
     * @returns {Promise<object>} Object indicating success or failure
     * @private
     */
    async updateStructure() {
        try {
            const currentRotation = this.moleculeContainer.matrix.clone();
            this.update3DOrtep();

            // Restore rotation
            this.moleculeContainer.matrix.copy(currentRotation);
            this.moleculeContainer.matrixAutoUpdate = false;

            this.requestRender();
            return { success: true };
        } catch (error) {
            console.error('Error updating structure:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Updates the 3D visualization by applying structure modifiers and creating visual elements.
     * @private
     */
    update3DOrtep() {
        this.removeStructure();
        let structure = this.state.baseStructure;
        let drawCell = false;
        for (const modifier of Object.values(this.modifiers)) {
            structure = modifier.apply(structure);
            drawCell = drawCell || modifier.drawCell;
        }

        if (drawCell) {
            const cell3D = createCell3D(structure.cell, this.options.cell);
            this.moleculeContainer.add(cell3D);
        }

        const ortep = new ORTEP3JsStructure(structure, this.options);
        const ortep3DGroup = ortep.getGroup();
        this.moleculeContainer.add(ortep3DGroup);
        this.state.currentStructure = ortep3DGroup;
        this.state.displayStructure = structure;
        this.isosurfaceLayer.setStructure(structure);
        this.isosurfaceLayer.rebuild();
        this.atomLabelManager.setStructure(structure);
        this.selections.pruneInvalidSelections(this.moleculeContainer);
    }

    /**
     * Updates camera position and parameters based on structure size.
     * @private
     */
    updateCamera() {
        this.controls.handleResize();
        // Camera framing follows the molecule only. Density is an overlay and
        // must not change either the molecular centre or the fitted zoom when
        // it happens to be present during a modifier rebuild.
        this.cameraController.fitToStructure(
            this.state.currentStructure ?? this.moleculeContainer,
        );
        this.requestRender();
    }

    /**
     * Removes the current structure and frees associated resources.
     * @private
     */
    removeStructure() {
        this.isosurfaceLayer?.clearMesh();
        this.moleculeContainer.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                object.material.dispose();
            }
        });
        this.moleculeContainer.clear();
    }

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
    async cycleModifierMode(modifierName) {
        const selectedModifier = this.modifiers[modifierName];
        const mode = selectedModifier.cycleMode(this.state.baseStructure);
        let result;
        if (selectedModifier.requiresCameraUpdate) {
            result = await this.loadStructure(this.state.baseStructure);
        } else {
            result = await this.updateStructure();
        }
        return { ...result, mode };
    }

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
    numberModifierModes(modifierName) {
        if (!this.state.baseStructure) {
            return false;
        }
        const atomfilteredStructure = this.modifiers.removeatoms.apply(this.state.baseStructure);

        const selectedModifier = this.modifiers[modifierName];
        return selectedModifier.getApplicableModes(atomfilteredStructure).length;
    }

    /**
     * Animation loop that renders the scene when needed.
     * Called automatically; users don't need to invoke this directly.
     * @private
     */
    animate() {
        if (this.options.renderMode === 'constant' || this.needsRender) {
            this.updateCameraFacingOctants();
            this.renderer.render(this.scene, this.camera);
            this.atomLabelManager.scheduleUpdate();
            this.needsRender = false;
        }
        requestAnimationFrame(this.animate.bind(this));
    }

    /**
     * Keeps cutaway ellipsoids open towards the camera as the structure rotates.
     * @private
     */
    updateCameraFacingOctants() {
        const cameraFacingAtoms = this.state.currentStructure?.cameraFacingAtoms;
        if (!cameraFacingAtoms?.length) {
            return;
        }

        this.camera.updateMatrixWorld();
        this.moleculeContainer.updateMatrixWorld(true);
        cameraFacingAtoms.forEach(atom => {
            atom.updateCutawayOctant(this.camera);
        });
    }

    /**
     * Requests a render update for the on-demand rendering mode (on by default).
     * Call this after making changes that should be reflected in the display.
     */
    requestRender() {
        if (this.options.renderMode === 'onDemand') {
            this.needsRender = true;
        }
    }

    /**
     * Resizes the renderer to match the container's display size.
     * Called automatically on window resize.
     * @returns {boolean} True if resize was needed
     * @private
     */
    resizeRendererToDisplaySize() {
        const canvas = this.renderer.domElement;
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.floor(this.container.clientWidth * pixelRatio);
        const height = Math.floor(this.container.clientHeight * pixelRatio);

        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            // Set the internal pixel dimensions (renderer buffer size)
            this.renderer.setSize(width, height, false);

            // Explicitly set the CSS dimensions to match the container
            canvas.style.width = `${this.container.clientWidth}px`;
            canvas.style.height = `${this.container.clientHeight}px`;

            // Update the renderer's viewport
            this.renderer.setViewport(0, 0, width, height);
        }
        return needResize;
    }

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
    selectAtoms(atomLabels) {
        this.selections.selectAtoms(atomLabels, this.moleculeContainer);
    }

    /**
     * Replaces the set of atom labels displayed by the viewer.
     * Plain labels such as `C1` match all displayed symmetry copies; a full
     * unique ID such as `C1|2_555` matches only that atom instance.
     * @param {'none'|'all'|'non-hydrogen'|Array<string|object>} show - Label selection
     */
    setAtomLabels(show) {
        if (!isValidAtomLabelSelection(show)) {
            throw new Error(
                'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
            );
        }
        this.options.atomLabels.show = show;
        this.atomLabelManager.setOptions(this.options.atomLabels);
        this.requestRender();
    }

    /**
     * Updates atom-label appearance or layout options without rebuilding the structure.
     * @param {object} options - Partial atom-label options
     */
    updateAtomLabelOptions(options) {
        validateAtomLabelOptions(options);
        const nextOptions = definedOptions(options);
        this.options.atomLabels = {
            ...this.options.atomLabels,
            ...nextOptions,
            text: {
                ...this.options.atomLabels.text,
                ...(nextOptions.text || {}),
            },
        };
        this.atomLabelManager.setOptions(this.options.atomLabels);
        this.requestRender();
    }

    /**
     * Hides all atom labels.
     */
    clearAtomLabels() {
        this.setAtomLabels('none');
    }

    /**
     * Returns the most recent screen-space label layout and omission reasons.
     * @returns {AtomLabelLayout} Current layout
     */
    getAtomLabelLayout() {
        return this.atomLabelManager.layout;
    }

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
    dispose() {
        this.cancelScalarFieldLoad('Viewer disposed');
        this.isosurfaceLayer.dispose();
        this.controls.dispose();
        this.atomLabelManager.dispose();

        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        this.selections.dispose();
        this.renderer.dispose();

        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.state = null;
        this.options = null;
    }
}
