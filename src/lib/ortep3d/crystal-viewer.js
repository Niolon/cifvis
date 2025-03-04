import * as THREE from 'three';
import { CIF } from '../read-cif/base.js';
import { CrystalStructure } from '../structure/crystal.js';
import { ORTEP3JsStructure } from './ortep.js';
import { setupLighting, calculateCameraDistance, structureOrientationMatrix } from './staging.js';
import defaultSettings from './structure-settings.js';
import { ViewerControls } from './viewer-controls.js';
import { BondGenerator, AtomLabelFilter, IsolatedHydrogenFixer } from '../structure/structure-modifiers/fixers.js';
import { DisorderFilter, HydrogenFilter, SymmetryGrower } from '../structure/structure-modifiers/modes.js';
import { tryToFixCifBlock } from '../fix-cif/base.js';

export class SelectionManager {
    constructor(options) {
        this.options = options;
        this.selectedObjects = new Set();
        this.selectionCallbacks = new Set();
        this.selectedData = new Set();
    }

    pruneInvalidSelections(container) {
        // Clear old visual selections since the objects no longer exist
        this.selectedObjects.clear();

        // Collect all available data in current structure
        const availableData = new Set();
        container.traverse((object) => {
            if (object.userData?.selectable) {
                const data = this.getObjectData(object);
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
                const data = this.getObjectData(object);
                if (this.hasMatchingData(data)) {
                    const color = this.getColorForData(data);
                    object.select(color, this.options);
                    this.selectedObjects.add(object);
                }
            }
        });

        this.notifyCallbacks();
    }

    getDataWithoutColor(data) {
        const { color, ...rest } = data;
        return rest;
    }

    getObjectData(object) {
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

    hasMatchingData(data) {
        if (!data) {
            return false; 
        }

        return Array.from(this.selectedData).some(stored => this.matchData(stored, data));
    }

    getColorForData(data) {
        const stored = Array.from(this.selectedData).find(stored => this.matchData(stored, data));
        return stored ? stored.color : this.getNextColor();
    }

    handle(object) {
        if (this.options.mode === 'single') {
            this.selectedObjects.forEach(selected => {
                this.remove(selected);
            });
            this.selectedObjects.clear();
            this.selectedData.clear();
        }

        const data = this.getObjectData(object);
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

    add(object, color) {
        object.select(color || this.getNextColor(), this.options);
        this.selectedObjects.add(object);
    }

    remove(object) {
        this.selectedObjects.delete(object);
        object.deselect();
    }

    clear() {
        this.selectedObjects.forEach(object => {
            this.remove(object);
        });
        this.selectedObjects.clear();
        this.selectedData.clear();
        this.notifyCallbacks();
    }

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

    onChange(callback) {
        this.selectionCallbacks.add(callback);
    }

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

    setMode(mode) {
        if (mode !== 'single' && mode !== 'multiple') {
            throw new Error('Selection mode must be either "single" or "multiple"');
        }
        
        this.options.mode = mode;
        
        if (mode === 'single' && this.selectedObjects.size > 1) {
            const selectedObjects = Array.from(this.selectedObjects);
            const lastSelected = selectedObjects[selectedObjects.length - 1];
            const lastData = this.getObjectData(lastSelected);
            
            this.clear();
            if (lastData) {
                this.add(lastSelected);
                this.selectedData.add({ ...lastData, color: lastSelected.selectionColor });
            }
            this.notifyCallbacks();
        }
    }

    dispose() {
        this.clear();
        this.selectionCallbacks.clear();
    }
}

export class CrystalViewer {    
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
            hydrogen: new HydrogenFilter(this.options.hydrogenMode),
            disorder: new DisorderFilter(this.options.disorderMode),
            symmetry: new SymmetryGrower(this.options.symmetryMode),
        };

        this.selections = new SelectionManager(this.options);

        this.setupScene();
        this.controls = new ViewerControls(this);
        this.animate();
        this.needsRender = true;

    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            this.options.camera.fov,
            this.container.clientWidth / this.container.clientHeight,
            this.options.camera.near,
            this.options.camera.far,
        );
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.resizeRendererToDisplaySize();;
        this.container.appendChild(this.renderer.domElement);
             
        this.moleculeContainer = new THREE.Group();
        this.scene.add(this.moleculeContainer);
        
        this.camera.position.copy(this.options.camera.initialPosition);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.camera.lookAt(this.cameraTarget);
    }

    async loadStructure(cifText, cifBlockIndex=0) {
        if (cifText === undefined) {
            console.error('Cannot load an empty text as CIF');
            return { success: false, error: 'Cannot load an empty text as CIF' };
        }
        try {
            const cif = new CIF(cifText);
            try {
                this.state.baseStructure = CrystalStructure.fromCIF(cif.getBlock(cifBlockIndex));
            } catch (e) {
                if (!this.options.fixCifErrors) {
                    try{ 
                        const maybeFixedCifBlock = tryToFixCifBlock(cif.getBlock(cifBlockIndex));
                        this.state.baseStructure = CrystalStructure.fromCIF(maybeFixedCifBlock);
                    } catch {
                        // throw original error as it should be more informative
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
            await this.setupNewStructure();            
    
            return { success: true };
        } catch (error) {
            console.error('Error loading structure:', error);
            return { success: false, error: error.message };
        }
    }

    async setupNewStructure() {
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
    
    updateCamera() {
        this.controls.handleResize();
        const distance = calculateCameraDistance(this.moleculeContainer, this.camera);
        this.camera.position.set(0, 0, distance);
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(this.cameraTarget);
        this.options.camera.minDistance = distance * 0.2;
        this.options.camera.maxDistance = distance * 2;
    }

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

    async cycleModifierMode(modifierName) {
        const selectedModifier = this.modifiers[modifierName];
        const mode = selectedModifier.cycleMode(this.state.baseStructure);
        let result;
        if (selectedModifier.requiresCameraUpdate) {
            result = await this.setupNewStructure();
        } else {
            result = await this.updateStructure();
        }
        return { ...result, mode };
    }

    numberModifierModes(modifierName) {
        if (!this.state.baseStructure) {
            return false; 
        }
        const atomfilteredStructure = this.modifiers.removeatoms.apply(this.state.baseStructure);

        const selectedModifier = this.modifiers[modifierName];
        return selectedModifier.getApplicableModes(atomfilteredStructure).length;
    }

    animate() {
        if (this.options.renderMode === 'constant' || this.needsRender) {
            this.renderer.render(this.scene, this.camera);
            this.needsRender = false;
        }
        requestAnimationFrame(this.animate.bind(this));
    }

    requestRender() {
        if (this.options.renderMode === 'onDemand') {
            this.needsRender = true;
        }
    }

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

    selectAtoms(atomLabels) {
        this.selections.selectAtoms(atomLabels, this.moleculeContainer);
    }

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