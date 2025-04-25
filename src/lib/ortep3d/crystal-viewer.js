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
                    label: object.userData.atomData.label,
                };
            case 'bond':
                return {
                    type: 'bond',
                    atom1: object.userData.bondData.atom1Label,
                    atom2: object.userData.bondData.atom2Label,
                };
            case 'hbond':
                return {
                    type: 'hbond',
                    donor: object.userData.hbondData.donorAtomLabel,
                    hydrogen: object.userData.hbondData.hydrogenAtomLabel,
                    acceptor: object.userData.hbondData.acceptorAtomLabel,
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
                return data1.label === data2.label;
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
     * @param {Function} callback - Function called with updated selections
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
     * @throws {Error} If an invalid render mode is provided
     */
    constructor(container, options = {}) {
        const validRenderModes = ['constant', 'onDemand'];
        if (options.renderMode && !validRenderModes.includes(options.renderMode)) {
            throw new Error(
                `Invalid render mode: "${options.renderMode}". Must be one of: ${validRenderModes.join(', ')}`,
            );
        }

        this.container = container;
        this.options = {
            camera: {
                ...defaultSettings.camera,
                initialPosition: new THREE.Vector3(...defaultSettings.camera.initialPosition),
                ...(options.camera || {}),
            },
            selection: {
                ...defaultSettings.selection,
                ...(options.selection || {}),
            },
            interaction: {
                ...defaultSettings.interaction,
                ...(options.interaction || {}),
            },
            atomDetail: options.atomDetail || defaultSettings.atomDetail,
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
            bondGrowToleranceFactor: options.bondGrowToleranceFactor || defaultSettings.bondGrowToleranceFactor,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...options.elementProperties,
            },
            hydrogenMode: options.hydrogenMode || defaultSettings.hydrogenMode,
            disorderMode: options.disorderMode || defaultSettings.disorderMode,
            symmetryMode: options.symmetryMode || defaultSettings.symmetryMode,
            renderMode: options.renderMode || defaultSettings.renderMode,
            fixCifErrors: options.fixCifErrors || defaultSettings.fixCifErrors,
        };
  
        this.state = {
            isDragging: false,
            currentCifContent: null,
            currentStructure: null,
            currentFloor: null,
            baseStructure: null,
            ortepObjects: new Map(),
            structureCenter: new THREE.Vector3(),
        };

        this.modifiers = {
            removeatoms: new AtomLabelFilter(),
            addhydrogen: new IsolatedHydrogenFixer(),
            missingbonds: new BondGenerator(
                this.options.elementProperties,
                this.options.bondGrowToleranceFactor,
            ),
            disorder: new DisorderFilter(this.options.disorderMode),
            symmetry: new SymmetryGrower(this.options.symmetryMode),
            hydrogen: new HydrogenFilter(this.options.hydrogenMode),
        };

        this.selections = new SelectionManager(this.options);

        this.setupScene();
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
        this.resizeRendererToDisplaySize();;
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
     * @param {number} [cifBlockIndex] - Index of the CIF block to load (for multi-block CIFs)
     * @returns {Promise<object>} Result object with:
     * - success: Boolean indicating if loading succeeded
     * - error: Error message if loading failed
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
    async loadCIF(cifText, cifBlockIndex=0) {
        if (cifText === undefined) {
            console.error('Cannot load an empty text as CIF');
            return { success: false, error: 'Cannot load an empty text as CIF' };
        }
        try {
            const cif = new CIF(cifText);
            let structure;
            try {
                structure = CrystalStructure.fromCIF(cif.getBlock(cifBlockIndex));
            } catch (e) {
                if (!this.options.fixCifErrors) {
                    try{ 
                        const maybeFixedCifBlock = tryToFixCifBlock(cif.getBlock(cifBlockIndex));
                        structure = CrystalStructure.fromCIF(maybeFixedCifBlock);
                    } catch {
                        // throw original error as it should be more informative
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
            await this.loadStructure(structure);            
    
            return { success: true };
        } catch (error) {
            console.error('Error loading structure:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Initializes a new structure in the viewer with proper orientation.
     * @param {CrystalStructure} structure - crystal structure to load
     * @returns {Promise<object>} Object indicating success
     * @private
     */
    async loadStructure(structure) {
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

        // Calculate center from rotated structure for proper bounding box
        const extent = new THREE.Box3().setFromObject(this.moleculeContainer);
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
        for (const modifier of Object.values(this.modifiers)) {
            structure = modifier.apply(structure);
        }

        const ortep = new ORTEP3JsStructure(structure, this.options);
        const ortep3DGroup = ortep.getGroup();
        this.moleculeContainer.add(ortep3DGroup);
        this.state.currentStructure = ortep3DGroup;
        this.selections.pruneInvalidSelections(this.moleculeContainer);
    }

    /**
     * Updates camera position and parameters based on structure size.
     * @private
     */
    updateCamera() {
        this.controls.handleResize();
        this.cameraController.fitToStructure(this.moleculeContainer);
        this.requestRender();
    }

    /**
     * Removes the current structure and frees associated resources.
     * @private
     */
    removeStructure() {
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
            this.renderer.render(this.scene, this.camera);
            this.needsRender = false;
        }
        requestAnimationFrame(this.animate.bind(this));
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
        this.controls.dispose();
        
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