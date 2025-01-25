import * as THREE from 'three';
import { create, all } from 'mathjs';
import { CIF } from './read-cif.js';
import { CrystalStructure } from "./crystal.js";
import { ORTEP3JsStructure} from "./ortep.js";
import { calculateStructureBounds, setupLighting, createFloor } from './staging.js';
import defaultSettings from "./structure-settings.js";
import { ViewerControls } from './viewer-controls.js';
import { DisorderFilter, HydrogenFilter, SymmetryGrower } from "./structure-modifiers.js";

const math = create(all);

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
            selectedObjects: new Set(),
            isDragging: false,
            currentCifContent: null,
            currentStructure: null,
            currentFloor: null,
            selectionCallbacks: new Set(),
            baseStructure: null,
            ortepObjects: new Map()
        };
        this.modifiers = {
            hydrogen: new HydrogenFilter(this.options.hydrogenMode),
            disorder: new DisorderFilter(this.options.disorderMode),
            symmetry: new SymmetryGrower(this.options.symmetryMode)
        }

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
        this.state.selectedObjects.clear();
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

    handleSelection(object) {
        if (object.userData.type === 'hbond_segment') {
            object = object.userData.parentGroup;
        }
    
        if (this.options.selection.mode === 'single') {
            this.state.selectedObjects.forEach(selected => {
                this.removeSelection(selected);
            });
            this.state.selectedObjects.clear();
        }
    
        let color;
        if (this.state.selectedObjects.has(object)) {
            color = object.userData.selectionColor;
            this.removeSelection(object);
        } else {
            this.addSelection(object);
            color = object.userData.selectionColor;
        }
    
        this.notifySelectionCallbacks();
        return color;
    }

    getNextSelectionColor() {
        const colorCounts = new Map();
        this.state.selectedObjects.forEach(obj => {
            const color = obj.userData.selectionColor;
            colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        });
        
        let color = this.options.selection.markerColors.find(c => !colorCounts.has(c));
        if (!color) {
            const minCount = Math.min(...colorCounts.values());
            color = this.options.selection.markerColors.find(c => 
                colorCounts.get(c) === minCount
            );
        }
        return color;
    }
    
    addSelection(object) {
        const color = this.getNextSelectionColor();
        this.state.selectedObjects.add(object);
        
        const highlightMaterial = object.material.clone();
        highlightMaterial.emissive.setHex(this.options.selection.highlightEmissive);
        object.userData.originalMaterial = object.material;
        object.material = highlightMaterial;

        const ortepObject = this.state.ortepObjects.get(object);
        const marker = ortepObject.createSelectionMarker(color, this.options);
        object.add(marker);
        object.userData.marker = marker;
        object.userData.selectionColor = color;
    }

    removeSelection(object) {
        this.state.selectedObjects.delete(object);
        
        if (object.userData.marker) {
            object.remove(object.userData.marker);
            try {
                object.userData.marker.geometry.dispose();
                object.userData.marker.material.dispose();
            } catch {
                object.userData.marker.dispose()
            }
            object.userData.marker = null;
        }
        
        if (object.userData.originalMaterial) {
            object.material.dispose();
            object.material = object.userData.originalMaterial;
            object.userData.originalMaterial = null;
        }
    }

    clearSelections() {
        this.state.selectedObjects.forEach(object => {
            this.removeSelection(object);
        });
        this.notifySelectionCallbacks();
    }

    selectAtoms(atomLabels) {
        this.clearSelections();
        atomLabels.forEach(label => {
            const atom = this.findAtomMeshByLabel(label);
            if (atom) {
                this.addSelection(atom);
            }
        });
        this.notifySelectionCallbacks();
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

    onSelectionChange(callback) {
        this.state.selectionCallbacks.add(callback);
    }

    notifySelectionCallbacks() {
        const selections = Array.from(this.state.selectedObjects).map(object => ({
            type: object.userData.type,
            data: object.userData.type === 'hbond' ? object.userData.hbondData : 
                  object.userData.type === 'bond' ? object.userData.bondData : 
                  object.userData.atomData,
            color: object.userData.selectionColor
        }));
        this.state.selectionCallbacks.forEach(callback => callback(selections));
    }

    setSelectionMode(mode) {
        if (mode !== 'single' && mode !== 'multiple') {
            throw new Error('Selection mode must be either "single" or "multiple"');
        }
        
        this.options.selection.mode = mode;
        
        if (mode === 'single' && this.state.selectedAtoms?.size > 1) {
            const selectedAtoms = Array.from(this.state.selectedAtoms);
            const lastSelected = selectedAtoms[selectedAtoms.length - 1];
            
            this.clearSelections();
            this.addSelection(lastSelected);
            this.notifySelectionCallbacks();
        }
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