import * as THREE from "three";
import defaultSettings from "./structure-settings.js";
import { HBond, Bond, UAnisoADP } from "../structure/crystal.js";
import { SymmetryGrower } from "../structure/structure-modifiers.js";

/**
 * Calculate transformation matrix for ellipsoid visualization.
 * @param {UAnisoADP} uAnisoADPobj - Anisotropic displacement parameters object
 * @param {UnitCell} unitCell - Unit cell object
 * @returns {THREE.Matrix4} Transformation matrix for ellipsoid visualization
 */
export function getThreeEllipsoidMatrix(uAnisoADPobj, unitCell) {
    const transformationMatrix = uAnisoADPobj.getEllipsoidMatrix(unitCell);
    const matrixArray = transformationMatrix.toArray();

    return new THREE.Matrix4(
        matrixArray[0][0], matrixArray[0][1], matrixArray[0][2], 0,
        matrixArray[1][0], matrixArray[1][1], matrixArray[1][2], 0,
        matrixArray[2][0], matrixArray[2][1], matrixArray[2][2], 0,
        0, 0, 0, 1
    );
}

export function calcBondTransform(position1, position2) {
    const direction = position2.clone().sub(position1);
    const length = direction.length();
    const unit = direction.divideScalar(length);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const rotationAxis = new THREE.Vector3().crossVectors(unit, yAxis);
    const angle = -Math.acos(unit.dot(yAxis));
    
    return new THREE.Matrix4()
        .makeScale(1, length, 1)
        .premultiply(new THREE.Matrix4().makeRotationAxis(
            rotationAxis.normalize(),
            angle
        ))
        .setPosition(
            position1.clone().add(position2).multiplyScalar(0.5)
        );
}

export class GeometryMaterialCache {
    constructor(options = {}) {
        const safeOptions = options || {};
        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...(safeOptions.elementProperties || {})
            }
        };

        this.scaling = 1.5384;
        this.geometries = {};
        this.materials = {};
        this.elementMaterials = {};

        this.initializeGeometries();
        this.initializeMaterials();
    }

    initializeGeometries() {
        // Base atom geometry
        this.geometries.atom = new THREE.IcosahedronGeometry(
            this.scaling, 
            this.options.atomDetail
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
            true
        );

        // H-bond geometry
        this.geometries.hbond = new THREE.CylinderGeometry(
            this.options.hbondRadius,
            this.options.hbondRadius,
            0.98,
            this.options.bondSections,
            1,
            true
        );
    }

    initializeMaterials() {
        // Base bond material
        this.materials.bond = new THREE.MeshStandardMaterial({
            color: this.options.bondColor,
            roughness: this.options.bondColorRoughness,
            metalness: this.options.bondColorMetalness
        });

        // Base H-bond material
        this.materials.hbond = new THREE.MeshStandardMaterial({
            color: this.options.hbondColor,
            roughness: this.options.hbondColorRoughness,
            metalness: this.options.hbondColorMetalness
        });
    }

    validateElementType(elementType) {
        if (!this.options.elementProperties[elementType]) {
            throw new Error(
                `Unknown element type: ${elementType}. ` +
                `Please ensure element properties are defined.`
            );
        }
    }

    getAtomMaterials(atomType) {
        this.validateElementType(atomType);

        const key = `${atomType}_materials`;
        if (!this.elementMaterials[key]) {
            const elementProperty = this.options.elementProperties[atomType];
            
            const atomMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.atomColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness
            });

            const ringMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.ringColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness
            });

            this.elementMaterials[key] = [atomMaterial, ringMaterial];
        }

        return this.elementMaterials[key];
    }

    createADPHalfTorus() {
        const fullRing = new THREE.TorusGeometry(
            this.scaling * this.options.atomADPRingWidthFactor,
            this.options.atomADPRingHeight,
            this.options.atomADPInnerSections,
            this.options.atomADPRingSections
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
                    positions[idx + 2] * positions[idx + 2]
                )
            }));
            
            if (vertices.every(v => v.distance >= this.scaling)) {
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
                positions[idx + 2]
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
                    indexMap.get(indices[i + 2])
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

    dispose() {
        Object.values(this.geometries).forEach(geometry => geometry.dispose());
        Object.values(this.materials).forEach(material => material.dispose());
        Object.values(this.elementMaterials).forEach(([atomMaterial, ringMaterial]) => {
            atomMaterial.dispose();
            ringMaterial.dispose();
        });
    }
}

export class ORTEP3JsStructure {
    constructor(crystalStructure, options = {}) {
        const safeOptions = options || {};
        
        // Handle deep merging of elementProperties
        const mergedElementProperties = { ...defaultSettings.elementProperties };
        if (safeOptions.elementProperties) {
            Object.entries(safeOptions.elementProperties).forEach(([element, props]) => {
                mergedElementProperties[element] = {
                    ...mergedElementProperties[element],
                    ...props
                };
            });
        }

        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: mergedElementProperties
        };
        
        this.crystalStructure = crystalStructure;
        this.cache = new GeometryMaterialCache(this.options);
        
        this.createStructure();
    }

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
                    ringMaterial
                ));
            } else {
                this.atoms3D.push(new ORTEPIsoAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial
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
                "."
            ))
            .filter(bond => atomLabels.includes(bond.atom2Label));

        for (const bond of drawnBonds) {
            this.bonds3D.push(new ORTEPBond(
                bond,
                this.crystalStructure,
                this.cache.geometries.bond,
                this.cache.materials.bond
            ));
        }

        // Handle hydrogen bonds
        const drawnHBonds = this.crystalStructure.hBonds
            .map(hBond => new HBond(
                hBond.donorAtomLabel,
                hBond.hydrogenAtomLabel,
                SymmetryGrower.combineSymOpLabel(
                    hBond.acceptorAtomLabel, 
                    hBond.acceptorAtomSymmetry
                ),
                hBond.donorHydrogenDistance,
                hBond.donorHydrogenDistanceSU,
                hBond.acceptorHydrogenDistance,
                hBond.acceptorHydrogenDistanceSU,
                hBond.donorAcceptorDistance,
                hBond.donorAcceptorDistanceSU,
                hBond.hBondAngle,
                hBond.hBondAngleSU,
                "."
            ))
            .filter(hBond => atomLabels.includes(hBond.acceptorAtomLabel));

        for (const hbond of drawnHBonds) {
            this.hBonds3D.push(new ORTEPHBond(
                hbond,
                this.crystalStructure,
                this.cache.geometries.hbond,
                this.cache.materials.hbond,
                this.options.hbondDashSegmentLength,
                this.options.hbondDashFraction
            ));
        }
    }

    getGroup() {
        const group = new THREE.Group();
        let meanAccumulator = new THREE.Vector3();
        
        for (const atom3D of this.atoms3D) {
            group.add(atom3D);
            meanAccumulator.add(atom3D.position);
        }
        
        for (const bond3D of this.bonds3D) {
            group.add(bond3D);
        }
        
        for (const hBond3D of this.hBonds3D) {
            group.add(hBond3D);
        }
        
        meanAccumulator.divideScalar(-this.atoms3D.length);
        group.position.copy(meanAccumulator);
        
        return group;
    }

    dispose() {
        this.cache.dispose();
    }
}


/**
 * Base class for selectable THREE.js mesh objects that handle selection visualization
 */
export class ORTEPObject extends THREE.Mesh {
    constructor(geometry, material) {
        super(geometry, material);
        this._selectionColor = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide
        });
    }
    
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

    deselect() {
        this._selectionColor = null;
        this.removeSelectionMarker();
    }

    createSelectionMarker(color, options) {
        throw new Error("createSelectionMarker needs to be implemented in a subclass");
    }

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

    dispose() {
        this.deselect();
        this.geometry?.dispose();
        this.material?.dispose();
    }
}

export class ORTEPAtom extends ORTEPObject {
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

    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry, 
            this.createSelectionMaterial(color)
        );
        outlineMesh.scale.multiplyScalar(options.selection.markerMult);
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

export class ORTEPAniAtom extends ORTEPAtom {
    constructor(atom, unitCell, baseAtom, atomMaterial, baseADPRing=null, ADPRingMaterial=null) {
        super(atom, unitCell, baseAtom, atomMaterial);

        const ellipsoidMatrix = getThreeEllipsoidMatrix(atom.adp, unitCell);
        if (ellipsoidMatrix.toArray().includes(NaN)) {
            this.geometry = new THREE.TetrahedronGeometry(1);
        } else {            
            if (baseADPRing && ADPRingMaterial) {
                for (const matrix of this.adpRingMatrices) {
                    const ringMesh = new THREE.Mesh(baseADPRing, ADPRingMaterial);
                    ringMesh.applyMatrix4(matrix);
                    ringMesh.userData.selectable = false;
                    this.add(ringMesh);
                }
            }

            this.applyMatrix4(ellipsoidMatrix);
        }
        
        const position = new THREE.Vector3(...atom.position.toCartesian(unitCell));
        this.position.copy(position);
        this.userData = {
            type: 'atom',
            atomData: atom,
            selectable: true,
        };
    }

    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry, 
            this.createSelectionMaterial(color)
        );
        outlineMesh.scale.multiplyScalar(options.selection.markerMult);
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }

    get adpRingMatrices() {
        return [
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            ),
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, -1.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            ),
            new THREE.Matrix4().set(
                0.0, -1.0, 0.0, 0.0,
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            )
        ];
    }
}

export class ORTEPIsoAtom extends ORTEPAtom {
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(atom, unitCell, baseAtom, atomMaterial);
        this.scale.multiplyScalar(1.0/10.53);
    }
}

export class ORTEPBond extends ORTEPObject {
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

    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry, 
            this.createSelectionMaterial(color)
        );
        outlineMesh.scale.x *= options.selection.bondMarkerMult;
        outlineMesh.scale.z *= options.selection.bondMarkerMult;
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}
/**
 * Base class for selectable THREE.js group objects that handle raycasting redirection
 * and selection visualization for their mesh children
 */
export class ORTEPGroupObject extends THREE.Group {
    constructor() {
        super();
        this._selectionColor = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

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
                            uv: intersection.uv
                        });
                    }
                };
            }
        });
        
        return super.add(...objects);
    }

    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide
        });
    }
    
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

    deselect() {
        this._selectionColor = null;

        // Remove marker
        if (this.marker) {
            this.remove(this.marker);
            if (this.marker instanceof THREE.Group) {
                this.marker.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry?.dispose();
                        child.material?.dispose();
                    }
                });
            } else {
                this.marker.geometry?.dispose();
                this.marker.material?.dispose();
            }
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

    createSelectionMarker(color, options) {
        throw new Error("createSelectionMarker needs to be implemented in a subclass");
    }

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
    }
}

/**
 * Represents a hydrogen bond visualization using dashed lines
 */
export class ORTEPHBond extends ORTEPGroupObject {
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
            targetSegmentLength, dashFraction
        );
    }

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