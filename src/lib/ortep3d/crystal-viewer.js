import * as THREE from 'three';
import { CIF } from '../cif/read-cif.js';
import { CrystalStructure } from '../structure/crystal.js';
import { ORTEP3JsStructure} from './ortep.js';
import { calculateStructureBounds, setupLighting } from './staging.js';
import defaultSettings from './structure-settings.js';
import { ViewerControls } from './viewer-controls.js';
import { DisorderFilter, HydrogenFilter, SymmetryGrower } from '../structure/structure-modifiers.js';


export class SelectionManager {
    constructor(options) {
        this.options = options;
        this.selectedObjects = new Set();
        this.selectionCallbacks = new Set();
    }

    handle(object) {
        if (this.options.mode === 'single') {
            this.selectedObjects.forEach(selected => {
                this.remove(selected);
            });
            this.selectedObjects.clear();
        }
    
        let color;
        if (this.selectedObjects.has(object)) {
            color = object.selectionColor;
            this.remove(object);
        } else {
            this.add(object);
            color = object.selectionColor;
        }
    
        this.notifyCallbacks();
        return color;
    }

    getNextColor() {
        const colorCounts = new Map();
        this.selectedObjects.forEach(obj => {
            const color = obj.selectionColor;
            colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        });
        
        let color = this.options.selection.markerColors.find(c => !colorCounts.has(c));
        if (!color) {
            const minCount = Math.min(...colorCounts.values());
            color = this.options.markerColors.find(c => 
                colorCounts.get(c) === minCount
            );
        }
        return color;
    }
    
    add(object) {
        const color = this.getNextColor();
        object.select(color, this.options);
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
        this.notifyCallbacks();
    }

    selectAtoms(atomLabels, moleculeContainer) {
        this.clear();
        atomLabels.forEach(label => {
            const atom = this.findAtomMeshByLabel(label, moleculeContainer);
            if (atom) {
                this.add(atom);
            }
        });
        this.notifyCallbacks();
    }

    findAtomMeshByLabel(label, moleculeContainer) {
        let found = null;
        moleculeContainer.traverse((object) => {
            if (object.userData?.type === 'atom' && 
                object.userData?.atomData?.label === label) {
                found = object;
            }
        });
        return found;
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
            color: object.selectionColor
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
            
            this.clear();
            this.add(lastSelected);
            this.notifyCallbacks();
        }
    }

    dispose() {
        this.clearSelections();
        this.selectionCallbacks.clear();
    }
}

export class CrystalViewer {    
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            camera: {
                ...defaultSettings.camera,
                initialPosition: new THREE.Vector3(...defaultSettings.camera.initialPosition),
                ...(options.camera || {})
            },
            selection: {
                ...defaultSettings.selection,
                ...(options.selection || {})
            },
            interaction: {
                ...defaultSettings.interaction,
                ...(options.interaction || {})
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
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...options.elementProperties
            },
            hydrogenMode: options.hydrogenMode || defaultSettings.hydrogenMode,
            disorderMode: options.disorderMode || defaultSettings.disorderMode,
            symmetryMode: options.symmetryMode || defaultSettings.symmetryMode
        };

        this.state = {
            isDragging: false,
            currentCifContent: null,
            currentStructure: null,
            currentFloor: null,
            baseStructure: null,
            ortepObjects: new Map()
        };

        this.modifiers = {
            hydrogen: new HydrogenFilter(this.options.hydrogenMode),
            disorder: new DisorderFilter(this.options.disorderMode),
            symmetry: new SymmetryGrower(this.options.symmetryMode)
        };

        this.selections = new SelectionManager(this.options);

        this.setupScene();
        this.controls = new ViewerControls(this);
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            this.options.camera.fov,
            this.container.clientWidth / this.container.clientHeight,  // Use container aspect ratio
            this.options.camera.near,
            this.options.camera.far
        );
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Add CSS to ensure renderer canvas fills container
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        
        this.moleculeContainer = new THREE.Group();
        this.scene.add(this.moleculeContainer);
        
        this.camera.position.copy(this.options.camera.initialPosition);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.camera.lookAt(this.cameraTarget);
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 0.5;
        this.raycaster.params.Points.threshold = 0.5;
        this.raycaster.params.Mesh.threshold = 0.1;
        this.raycaster.near = 0.1;
        this.raycaster.far = 100;
    }

    async loadStructure(cifText=null) {
        try {
            this.clearScene();

            if (cifText) {
                this.state.currentCifContent = cifText;
                const cif = new CIF(cifText, true);
                this.state.baseStructure = CrystalStructure.fromCIF(cif.getBlock(0));
            }

            const structure = this.applyFilters();
            const bounds = calculateStructureBounds(structure);
            
            this.updateCameraBounds(bounds);
            setupLighting(this.scene, bounds);

            return { success: true };
        } catch (error) {
            console.error('Error loading structure:', error);
            return { success: false, error: error.message };
        }
    }

    applyFilters() {
        let structure = this.state.baseStructure;
        for (const modifyer of Object.values(this.modifiers)) {
            structure = modifyer.apply(structure);
        }

        const ortep = new ORTEP3JsStructure(structure, this.options);
        
        this.state.ortepObjects = new Map();
        ortep.atoms3D.forEach(atom => this.state.ortepObjects.set(atom.object3D, atom));
        ortep.bonds3D.forEach(bond => this.state.ortepObjects.set(bond.object3D, bond));
        ortep.hBonds3D.forEach(hbond => this.state.ortepObjects.set(hbond.object3D, hbond));
        
        const structureGroup = ortep.getGroup();
        this.setupStructureObjects(structureGroup);
        this.moleculeContainer.add(structureGroup);
        this.state.currentStructure = structureGroup;
        
        return structureGroup;
    }

    clearScene() {
        this.moleculeContainer.clear();
        this.selections.clear();
        if (this.state.currentFloor) {
            this.scene.remove(this.state.currentFloor);
        }
    }

    setupStructureObjects(structureGroup) {
        structureGroup.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
    }

    updateCameraBounds(bounds) {
        const maxDimension = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
        this.options.camera.minDistance = maxDimension * 0.5;
        this.options.camera.maxDistance = maxDimension * 5;
        
        const initialDistance = maxDimension * 2;
        this.camera.position.set(0, 0, initialDistance);
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(this.cameraTarget);
    }

    async cycleHydrogenMode() {
        const mode = this.modifiers.hydrogen.cycleMode(this.state.baseStructure);
        const result = await this.loadStructure();
        return { ...result, mode };
    }

    async cycleDisorderMode() {
        const mode = this.modifiers.disorder.cycleMode(this.state.baseStructure);
        const result = await this.loadStructure();
        return { ...result, mode };
    }

    async cycleSymmetryMode() {
        const mode = this.modifiers.symmetry.cycleMode(this.state.baseStructure);
        const result = await this.loadStructure();
        return { ...result, mode };
    }

    hasDisorderGroups() {
        if (!this.state.baseStructure) return false;
        return this.modifiers.disorder.getApplicableModes(this.state.baseStructure).length > 1;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);
    }

    selectAtoms(atomLabels) {
        this.selections.selectAtoms(atomLabels, this.moleculeContainer);
    }

    findAtomMeshByLabel(label) {
        let found = null;
        this.moleculeContainer.traverse((object) => {
            if (object.userData?.type === 'atom' && 
                object.userData?.atomData?.label === label) {
                found = object;
            }
        });
        return found;
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