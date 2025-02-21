import * as THREE from 'three';
import defaultSettings from './structure-settings.js';
import { inferElementFromLabel } from '../structure/crystal.js';
import { HBond, Bond } from '../structure/bonds.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import { SymmetryGrower } from '../structure/structure-modifiers.js';

// Check objects for NaN values and count by type
function checkForNaN(object3D) {
    const nanCounts = {
        position: 0,
        rotation: 0,
        scale: 0,
        matrix: 0,
    };

    function checkObject(obj) {
        const position = obj.position;
        const rotation = obj.rotation;
        const scale = obj.scale;
        const matrix = obj.matrix.elements;

        if ([position.x, position.y, position.z].some(isNaN)) {
            console.log('pos');
            console.log(position);
            console.log(obj.userData);
            nanCounts.position++;
        }
        if ([rotation.x, rotation.y, rotation.z].some(isNaN)) {
            nanCounts.rotation++;
            console.log('rot');
            console.log(rotation);
            console.log(obj.userData);
        }
        if ([scale.x, scale.y, scale.z].some(isNaN)) {
            console.log('scale');
            console.log(scale);
            console.log(obj.userData);
            nanCounts.scale++;
        }
        if (matrix.some(isNaN)) {
            nanCounts.matrix++;
            console.log('matrix');
            console.log(matrix);
            console.log(obj.userData);
        }

        for (const child of obj.children) {
            checkObject(child);
        }
    }

    checkObject(object3D);
    return nanCounts;
}

/**
 * Calculate transformation matrix for ellipsoid visualisation.
 * @param {UAnisoADP} uAnisoADPobj - Anisotropic displacement parameters object
 * @param {UnitCell} unitCell - Unit cell object
 * @returns {THREE.Matrix4} Transformation matrix for ellipsoid visualisation
 */
export function getThreeEllipsoidMatrix(uAnisoADPobj, unitCell) {
    const transformationMatrix = uAnisoADPobj.getEllipsoidMatrix(unitCell);
    const matrixArray = transformationMatrix.toArray();

    return new THREE.Matrix4(
        matrixArray[0][0], matrixArray[0][1], matrixArray[0][2], 0,
        matrixArray[1][0], matrixArray[1][1], matrixArray[1][2], 0,
        matrixArray[2][0], matrixArray[2][1], matrixArray[2][2], 0,
        0, 0, 0, 1,
    );
}

/**
 * Calculates transformation matrix for bond placement between two points.
 * @param {THREE.Vector3} position1 - Start position
 * @param {THREE.Vector3} position2 - End position
 * @returns {THREE.Matrix4} Transformation matrix
 */
export function calcBondTransform(position1, position2) {
    const direction = position2.clone().sub(position1);
    const length = direction.length();
    if (length === 0.0) {
        throw new Error('Error in ORTEP Bond Creation. Trying to create a zero length bond.');
    }
    const unit = direction.divideScalar(length);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const rotationAxis = new THREE.Vector3().crossVectors(unit, yAxis);
    const angle = -Math.acos(unit.dot(yAxis));
    
    return new THREE.Matrix4()
        .makeScale(1, length, 1)
        .premultiply(new THREE.Matrix4().makeRotationAxis(
            rotationAxis.normalize(),
            angle,
        ))
        .setPosition(
            position1.clone().add(position2).multiplyScalar(0.5),
        );
}

/**
 * Cache for Three.js geometries and materials used in molecular visualisation.
 * Allows for reuse of geometries and materials, which is more efficient than
 * generating copies for every object.
 */
export class GeometryMaterialCache {
    /**
     * Creates a new geometry and material cache.
     * @param {Object} [options] - Visualisation options with defaults from structure-settings.js
     */
    constructor(options = {}) {
        const safeOptions = options || {};
        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...(safeOptions.elementProperties || {}),
            },
        };

        this.scaling = 1.5384;
        this.geometries = {};
        this.materials = {};
        this.elementMaterials = {};

        this.initializeGeometries();
        this.initializeMaterials();
    }

    /**
     * Creates and caches base geometries for atoms, ADP rings, bonds and H-bonds.
     * @private
     */
    initializeGeometries() {
        // Base atom geometry
        this.geometries.atom = new THREE.IcosahedronGeometry(
            this.scaling, 
            this.options.atomDetail,
        );

        // ADP ring geometry
        this.geometries.adpRing = this.createADPHalfTorus();

        // Bond geometry
        this.geometries.bond = new THREE.CylinderGeometry(
            this.options.bondRadius,
            this.options.bondRadius,
            0.98,
            this.options.bondSections,
            1,
            true,
        );

        // H-bond geometry
        this.geometries.hbond = new THREE.CylinderGeometry(
            this.options.hbondRadius,
            this.options.hbondRadius,
            0.98,
            this.options.bondSections,
            1,
            true,
        );
    }

    /**
     * Creates and caches base materials for bonds and H-bonds.
     * @private
     */
    initializeMaterials() {
        // Base bond material
        this.materials.bond = new THREE.MeshStandardMaterial({
            color: this.options.bondColor,
            roughness: this.options.bondColorRoughness,
            metalness: this.options.bondColorMetalness,
        });

        // Base H-bond material
        this.materials.hbond = new THREE.MeshStandardMaterial({
            color: this.options.hbondColor,
            roughness: this.options.hbondColorRoughness,
            metalness: this.options.hbondColorMetalness,
        });
    }

    /**
     * Validates that properties exist for given element type.
     * @param {string} elementType - Chemical element symbol
     * @throws {Error} If element properties not found
     */
    validateElementType(elementType) {
        if (!this.options.elementProperties[elementType]) {
            throw new Error(
                `Unknown element type: ${elementType}. ` +
                'Please ensure element properties are defined.' + 
                'Pass the type settings as custom options, if' +
                'they are element from periodic table',
            );
        }
    }

    /**
     * Gets or creates cached materials for given atom type.
     * @param {string} atomType - Chemical element symbol
     * @returns {[THREE.Material, THREE.Material]} Array containing [atomMaterial, ringMaterial]
     */
    getAtomMaterials(atomType) {
        let elementType = atomType;
        if (!this.options.elementProperties[elementType]) {
            elementType = inferElementFromLabel(atomType);
        }
        this.validateElementType(elementType);

        const key = `${elementType}_materials`;
        if (!this.elementMaterials[key]) {
            const elementProperty = this.options.elementProperties[elementType];
            
            const atomMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.atomColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness,
            });

            const ringMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.ringColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness,
            });

            this.elementMaterials[key] = [atomMaterial, ringMaterial];
        }

        return this.elementMaterials[key];
    }

    /**
     * Creates geometry for anisotropic displacement parameter visualisation,
     * by removing the inner vertices of a torus that would be obstructed by
     * the atom sphere anyway.
     * @private
     * @returns {THREE.BufferGeometry} Half torus geometry for ADP visualisation
     */
    createADPHalfTorus() {
        const fullRing = new THREE.TorusGeometry(
            this.scaling * this.options.atomADPRingWidthFactor,
            this.options.atomADPRingHeight,
            this.options.atomADPInnerSections,
            this.options.atomADPRingSections,
        );
        
        const positions = fullRing.attributes.position.array;
        const indices = fullRing.index.array;
        const newPositions = [];
        const newIndices = [];
        const keptIndices = new Set();
        
        // First pass: identify vertices to keep
        for (let i = 0; i < indices.length; i += 3) {
            const idx1 = indices[i] * 3;
            const idx2 = indices[i + 1] * 3;
            const idx3 = indices[i + 2] * 3;
            
            const vertices = [idx1, idx2, idx3].map(idx => ({
                index: idx / 3,
                distance: Math.sqrt(
                    positions[idx] * positions[idx] +
                    positions[idx + 1] * positions[idx + 1] +
                    positions[idx + 2] * positions[idx + 2],
                ),
            }));
            
            if (vertices.some(v => v.distance >= this.scaling)) {
                vertices.forEach(v => keptIndices.add(indices[i + v.index % 3]));
            }
        }
        
        // Second pass: create new vertex array and index mapping
        const indexMap = new Map();
        let newIndex = 0;
        
        keptIndices.forEach(oldIndex => {
            const idx = oldIndex * 3;
            newPositions.push(
                positions[idx],
                positions[idx + 1],
                positions[idx + 2],
            );
            indexMap.set(oldIndex, newIndex++);
        });
        
        // Third pass: create new index array using mapped indices
        for (let i = 0; i < indices.length; i += 3) {
            if (keptIndices.has(indices[i]) && 
                keptIndices.has(indices[i + 1]) && 
                keptIndices.has(indices[i + 2])) {
                newIndices.push(
                    indexMap.get(indices[i]),
                    indexMap.get(indices[i + 1]),
                    indexMap.get(indices[i + 2]),
                );
            }
        }
        
        const baseADPRing = new THREE.BufferGeometry();
        baseADPRing.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
        baseADPRing.setIndex(newIndices);
        baseADPRing.computeVertexNormals();
        baseADPRing.rotateX(0.5 * Math.PI);
        
        fullRing.dispose();
        return baseADPRing;
    }

    /**
     * Cleans up all cached resources.
     */
    dispose() {
        Object.values(this.geometries).forEach(geometry => geometry.dispose());
        Object.values(this.materials).forEach(material => material.dispose());
        Object.values(this.elementMaterials).forEach(([atomMaterial, ringMaterial]) => {
            atomMaterial.dispose();
            ringMaterial.dispose();
        });
    }
}

/**
 * Main class for creating 3D molecular structure visualisations.
 */
export class ORTEP3JsStructure {
    /**
     * Creates a new ORTEP structure visualisation.
     * @param {CrystalStructure} crystalStructure - Input crystal structure
     * @param {Object} [options] - Visualisation options
     */
    constructor(crystalStructure, options = {}) {
        const safeOptions = options || {};
        
        // Handle deep merging of elementProperties
        const mergedElementProperties = { ...defaultSettings.elementProperties };
        if (safeOptions.elementProperties) {
            Object.entries(safeOptions.elementProperties).forEach(([element, props]) => {
                mergedElementProperties[element] = {
                    ...mergedElementProperties[element],
                    ...props,
                };
            });
        }

        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: mergedElementProperties,
        };
        
        this.crystalStructure = crystalStructure;
        this.cache = new GeometryMaterialCache(this.options);
        
        this.createStructure();
    }
    /**
     * Creates 3D representations of atoms, bonds and H-bonds.
     * @private
     */
    createStructure() {
        this.atoms3D = [];
        this.bonds3D = [];
        this.hBonds3D = [];

        const atomLabels = this.crystalStructure.atoms.map(atom => atom.label);
        
        // Create atoms
        for (const atom of this.crystalStructure.atoms) {
            const [atomMaterial, ringMaterial] = this.cache.getAtomMaterials(atom.atomType);
            
            if (atom.adp instanceof UAnisoADP) {
                this.atoms3D.push(new ORTEPAniAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                    this.cache.geometries.adpRing,
                    ringMaterial,
                ));
            } else if (atom.adp instanceof UIsoADP) {
                this.atoms3D.push(new ORTEPIsoAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                ));
            } else {
                this.atoms3D.push(new ORTEPConstantAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                    this.options,
                ));
            }
        }

        // Handle regular bonds
        const drawnBonds = this.crystalStructure.bonds
            .map(bond => new Bond(
                bond.atom1Label,
                SymmetryGrower.combineSymOpLabel(bond.atom2Label, bond.atom2SiteSymmetry),
                bond.bondLength,
                bond.bondLengthSU,
                '.',
            ))
            .filter(bond => atomLabels.includes(bond.atom2Label));

        for (const bond of drawnBonds) {
            try {
                this.bonds3D.push(new ORTEPBond(
                    bond,
                    this.crystalStructure,
                    this.cache.geometries.bond,
                    this.cache.materials.bond,
                ));
            } catch (e) {
                if (e.message !== 'Error in ORTEP Bond Creation. Trying to create a zero length bond.') {
                    throw e;
                }
            }
        }

        // Handle hydrogen bonds
        const drawnHBonds = this.crystalStructure.hBonds
            .map(hBond => new HBond(
                hBond.donorAtomLabel,
                hBond.hydrogenAtomLabel,
                SymmetryGrower.combineSymOpLabel(
                    hBond.acceptorAtomLabel, 
                    hBond.acceptorAtomSymmetry,
                ),
                hBond.donorHydrogenDistance,
                hBond.donorHydrogenDistanceSU,
                hBond.acceptorHydrogenDistance,
                hBond.acceptorHydrogenDistanceSU,
                hBond.donorAcceptorDistance,
                hBond.donorAcceptorDistanceSU,
                hBond.hBondAngle,
                hBond.hBondAngleSU,
                '.',
            ))
            .filter(hBond => atomLabels.includes(hBond.acceptorAtomLabel));

        for (const hbond of drawnHBonds) {
            try {
                this.hBonds3D.push(new ORTEPHBond(
                    hbond,
                    this.crystalStructure,
                    this.cache.geometries.hbond,
                    this.cache.materials.hbond,
                    this.options.hbondDashSegmentLength,
                    this.options.hbondDashFraction,
                ));
            } catch (e) {
                if (e.message !== 'Error in ORTEP Bond Creation. Trying to create a zero length bond.') {
                    throw e;
                }
            }
        }
    }

    /**
     * Returns a THREE.Group containing all visualisation objects.
     * @returns {THREE.Group} Group containing all structure objects
     */
    getGroup() {
        const group = new THREE.Group();
        
        for (const atom3D of this.atoms3D) {
            group.add(atom3D);
        }
        
        for (const bond3D of this.bonds3D) {
            group.add(bond3D);
        }
        
        for (const hBond3D of this.hBonds3D) {
            group.add(hBond3D);
        }
        checkForNaN(group);
        
        return group;
    }

    /**
     * Cleans up all resources.
     */
    dispose() {
        this.cache.dispose();
    }
}

/**
 * Base class for selectable THREE.js mesh objects that handle selection visualisation
 * @abstract
 */
export class ORTEPObject extends THREE.Mesh {
    /**
     * Creates a new selectable object.
     * @param {THREE.BufferGeometry} geometry - Object geometry
     * @param {THREE.Material} material - Object material
     */
    constructor(geometry, material) {
        if (new.target === ORTEPObject) {
            throw new TypeError('ORTEPObject is an abstract class and cannot be instantiated directly.');
        }
        super(geometry, material);
        this._selectionColor = null;
        this.marker = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format
     * @returns {THREE.Material} Selection highlight material
     */
    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide,
        });
    }

    /**
     * Handles object selection.
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    select(color, options) {
        this._selectionColor = color;
        
        const highlightMaterial = this.material.clone();
        highlightMaterial.emissive?.setHex(options.selection.highlightEmissive);
        this.originalMaterial = this.material;
        this.material = highlightMaterial;

        const marker = this.createSelectionMarker(color, options);
        this.add(marker);
        this.marker = marker;
    }

    /**
     * Handles object deselection.
     */
    deselect() {
        this._selectionColor = null;
        this.removeSelectionMarker();
    }

    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    createSelectionMarker(_color, _options) {
        throw new Error('createSelectionMarker needs to be implemented in a subclass');
    }

    /**
     * Removes selection marker and restores original material.
     * @private
     */
    removeSelectionMarker() {
        if (this.marker) {
            this.remove(this.marker);
            this.marker.geometry?.dispose();
            this.marker.material?.dispose();
            this.marker = null;
        }
        
        if (this.originalMaterial) {
            this.material.dispose();
            this.material = this.originalMaterial;
            this.originalMaterial = null;
        }
    }

    /**
     * Cleans up resources.
     */
    dispose() {
        this.deselect();
        this.geometry?.dispose();
        this.material?.dispose();
    }
}

/**
 * Base class for atom visualisations.
 */
export class ORTEPAtom extends ORTEPObject {
    /**
     * Creates a new atom visualisation.
     * @param {Atom} atom - Input atom data
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     */
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(baseAtom, atomMaterial);
        const position = new THREE.Vector3(...atom.position.toCartesian(unitCell));

        this.position.copy(position);
        this.userData = {
            type: 'atom',
            atomData: atom,
            selectable: true,
        };
    }

    /**
     * Creates visual marker for selection of atoms.
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry, 
            this.createSelectionMaterial(color),
        );
        outlineMesh.scale.multiplyScalar(options.selection.markerMult);
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

/**
 * Class for atoms with anisotropic displacement parameters.
 */
export class ORTEPAniAtom extends ORTEPAtom {
    /**
     * Creates a new anisotropic atom visualisation.
     * @param {Atom} atom - Input atom data with anisotropic displacement parameters
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @param {THREE.BufferGeometry} baseADPRing - ADP ring geometry
     * @param {THREE.Material} ADPRingMaterial - ADP ring material
     */
    constructor(atom, unitCell, baseAtom, atomMaterial, baseADPRing, ADPRingMaterial) {
        super(atom, unitCell, baseAtom, atomMaterial);
        if ([atom.adp.u11, atom.adp.u3, atom.adp.u33].some(val => val <= 0)) {
            this.geometry = new THREE.TetrahedronGeometry(0.8);
        } else {
            const ellipsoidMatrix = getThreeEllipsoidMatrix(atom.adp, unitCell);
            if (ellipsoidMatrix.toArray().includes(NaN)) {
                this.geometry = new THREE.TetrahedronGeometry(0.8);
            } else {            
                for (const matrix of this.adpRingMatrices) {
                    const ringMesh = new THREE.Mesh(baseADPRing, ADPRingMaterial);
                    ringMesh.applyMatrix4(matrix);
                    ringMesh.userData.selectable = false;
                    this.add(ringMesh);
                }
    
                this.applyMatrix4(ellipsoidMatrix);
            }
        }
        
        const position = new THREE.Vector3(...atom.position.toCartesian(unitCell));
        this.position.copy(position);
        this.userData = {
            type: 'atom',
            atomData: atom,
            selectable: true,
        };
    }

    get adpRingMatrices() {
        return [
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, -1.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
            new THREE.Matrix4().set(
                0.0, -1.0, 0.0, 0.0,
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
        ];
    }
}

/**
 * Class for atoms with isotropic displacement parameters.
 */
export class ORTEPIsoAtom extends ORTEPAtom {
    /**
     * Creates a new isotropic atom visualisation.
     * @param {Atom} atom - Input atom data with isotropic displacement parameters
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @throws {Error} If atom lacks isotropic displacement parameters
     */
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(atom, unitCell, baseAtom, atomMaterial);
        if (!atom.adp || !('uiso' in atom.adp)) {
            throw new Error('Atom must have isotropic displacement parameters (UIsoADP)');
        }
        if (atom.adp.uiso <= 0.0) {
            this.geometry = new THREE.TetrahedronGeometry(1);
        } else {
            this.scale.multiplyScalar(Math.sqrt(atom.adp.uiso));
        }
    }
}

/**
 * Class for atoms with visualised with constant radius.
 */
export class ORTEPConstantAtom extends ORTEPAtom {
    /**
     * Creates a new constant radius atom visualization.
     * @param {Atom} atom - Input atom data
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @param {Object} options - Must contain elementProperties for atom type
     * @throws {Error} If element properties not found
     */
    constructor(atom, unitCell, baseAtom, atomMaterial, options) {
        super(atom, unitCell, baseAtom, atomMaterial);
        let elementType = atom.atomType;
        try {
            if (!options.elementProperties[elementType]) {   
                elementType = inferElementFromLabel(atom.atomType);
            } 
        } catch {
            throw new Error(`Element properties not found for atom type: '${atom.atomType}'`);
        }
        this.scale.multiplyScalar(
            options.atomConstantRadiusMultiplier * options.elementProperties[elementType].radius,
        );
    }
}

/**
 * Class for chemical bond visualization.
 */
export class ORTEPBond extends ORTEPObject {
    /**
     * Creates a new bond visualization.
     * @param {Bond} bond - Bond data
     * @param {CrystalStructure} crystalStructure - Parent structure
     * @param {THREE.BufferGeometry} baseBond - Bond geometry
     * @param {THREE.Material} baseBondMaterial - Bond material
     */
    constructor(bond, crystalStructure, baseBond, baseBondMaterial) {
        super(baseBond, baseBondMaterial);
        const bondAtom1 = crystalStructure.getAtomByLabel(bond.atom1Label);
        const bondAtom2 = crystalStructure.getAtomByLabel(bond.atom2Label);
        const atom1position = new THREE.Vector3(...bondAtom1.position.toCartesian(crystalStructure.cell));
        const atom2position = new THREE.Vector3(...bondAtom2.position.toCartesian(crystalStructure.cell));
        const bondTransform = calcBondTransform(atom1position, atom2position);
        
        this.applyMatrix4(bondTransform);
        this.userData = {
            type: 'bond',
            bondData: bond,
            selectable: true,
        };
    }

    /**
     * Creates visual marker for selection of bonds.
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry, 
            this.createSelectionMaterial(color),
        );
        outlineMesh.scale.x *= options.selection.bondMarkerMult;
        outlineMesh.scale.z *= options.selection.bondMarkerMult;
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

/**
 * Abstract base class for grouped objects like dashed Bonds.
 * @abstract
 */
export class ORTEPGroupObject extends THREE.Group {
    /**
     * Creates a new group object.
     */
    constructor() {
        if (new.target === ORTEPGroupObject) {
            throw new TypeError('ORTEPGroupObject is an abstract class and cannot be instantiated directly.');
        }
        super();
        this._selectionColor = null;
        this.marker = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

    /**
     * Adds objects with raycasting redirection.
     * @param {...THREE.Object3D} objects - Objects to add
     * @returns {this}
     */
    add(...objects) {
        objects.forEach(object => {
            if (object instanceof THREE.Mesh) {
                // Store original raycast method
                const originalRaycast = object.raycast;
                
                // Override raycast to redirect to parent
                object.raycast = (raycaster, intersects) => {
                    const meshIntersects = [];
                    originalRaycast.call(object, raycaster, meshIntersects);
                    
                    if (meshIntersects.length > 0) {
                        const intersection = meshIntersects[0];
                        intersects.push({
                            distance: intersection.distance,
                            point: intersection.point,
                            object: this, // Return parent group
                            face: intersection.face,
                            faceIndex: intersection.faceIndex,
                            uv: intersection.uv,
                        });
                    }
                };
            }
        });
        
        return super.add(...objects);
    }

    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format
     * @returns {THREE.Material} Selection highlight material
     */
    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide,
        });
    }

    /**
     * Handles group selection.
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    select(color, options) {
        this._selectionColor = color;
        
        // Handle materials for all children
        this.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const highlightMaterial = child.material.clone();
                highlightMaterial.emissive?.setHex(options.selection.highlightEmissive);
                child.originalMaterial = child.material;
                child.material = highlightMaterial;
            }
        });

        // Create and add marker
        const marker = this.createSelectionMarker(color, options);
        this.add(marker);
        this.marker = marker;
    }

    /**
     * Handles group deselection.
     */
    deselect() {
        this._selectionColor = null;

        // Remove marker
        if (this.marker) {
            this.remove(this.marker);
            this.marker.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
            });
            this.marker = null;
        }
        
        // Restore original materials
        this.traverse(child => {
            if (child instanceof THREE.Mesh && child.originalMaterial) {
                child.material.dispose();
                child.material = child.originalMaterial;
                child.originalMaterial = null;
            }
        });
    }

    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    createSelectionMarker(_color, _options) {
        throw new Error('createSelectionMarker needs to be implemented in a subclass');
    }

    /**
     * Cleans up resources.
     */
    dispose() {
        // Clean up selection-related resources
        if (this.marker) {
            this.deselect();
        }

        // Clean up all mesh resources
        this.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
        this.clear();
    }
}

/**
 * Class for hydrogen bond visualization.
 */
export class ORTEPHBond extends ORTEPGroupObject {
    /**
     * Creates a new hydrogen bond visualization.
     * @param {HBond} hbond - H-bond data
     * @param {CrystalStructure} crystalStructure - Parent structure
     * @param {THREE.BufferGeometry} baseHBond - H-bond geometry
     * @param {THREE.Material} baseHBondMaterial - H-bond material
     * @param {number} targetSegmentLength - Approximate target length for dashed segments
     * @param {number} dashFraction - Fraction of segment that is solid
     */
    constructor(hbond, crystalStructure, baseHBond, baseHBondMaterial, targetSegmentLength, dashFraction) {
        super();
        this.userData = {
            type: 'hbond',
            hbondData: hbond,
            selectable: true,
        };
        
        const hydrogenAtom = crystalStructure.getAtomByLabel(hbond.hydrogenAtomLabel);
        const acceptorAtom = crystalStructure.getAtomByLabel(hbond.acceptorAtomLabel);
        const hydrogenPosition = new THREE.Vector3(...hydrogenAtom.position.toCartesian(crystalStructure.cell));
        const acceptorPosition = new THREE.Vector3(...acceptorAtom.position.toCartesian(crystalStructure.cell));

        this.createDashedBondSegments(
            hydrogenPosition, acceptorPosition,
            baseHBond, baseHBondMaterial,
            targetSegmentLength, dashFraction,
        );
    }

    /**
     * Creates dashed line segments for hydrogen bond visualization.
     * @private
     * @param {THREE.Vector3} start - Start position
     * @param {THREE.Vector3} end - End position
     * @param {THREE.BufferGeometry} baseHBond - Base H-bond geometry
     * @param {THREE.Material} material - H-bond material
     * @param {number} targetLength - approximate target segment length
     * @param {number} dashFraction - Fraction of segment that is solid
     */
    createDashedBondSegments(start, end, baseHBond, material, targetLength, dashFraction) {
        const totalLength = start.distanceTo(end);
        const numSegments = Math.max(1, Math.floor(totalLength / targetLength));
        const segmentLength = totalLength / numSegments;
        const dashLength = segmentLength * dashFraction;

        for (let i = 0; i < numSegments; i++) {
            const startFraction = i / numSegments;
            const endFraction = startFraction + (dashLength / totalLength);

            const segStart = new THREE.Vector3().lerpVectors(start, end, startFraction);
            const segEnd = new THREE.Vector3().lerpVectors(start, end, endFraction);

            const segmentMesh = new THREE.Mesh(baseHBond, material.clone());
            segmentMesh.applyMatrix4(calcBondTransform(segStart, segEnd));
            segmentMesh.userData = this.userData;
            this.add(segmentMesh);
        }
    }

    /**
     * Creates visual marker for selection of hydrogen bond.
     * @param {number} color - Selection color in hex format
     * @param {Object} options - Selection options
     */
    createSelectionMarker(color, options) {
        const markerGroup = new THREE.Group();
        const material = this.createSelectionMaterial(color);

        this.children.forEach(segment => {
            const markerMesh = new THREE.Mesh(segment.geometry, material);
            markerMesh.applyMatrix4(segment.matrix);
            markerMesh.scale.x *= options.selection.bondMarkerMult;
            markerMesh.scale.y *= 0.8 * options.selection.bondMarkerMult;
            markerMesh.scale.z *= options.selection.bondMarkerMult;
            markerMesh.userData.selectable = false;
            markerGroup.add(markerMesh);
        });

        return markerGroup;
    }
}