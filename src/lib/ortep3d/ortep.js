import * as THREE from "three";
import { create, all } from 'mathjs';

const config = { };
const math = create(all, config);
import defaultSettings from "./structure-settings.js";
import { HBond, Bond, UAnisoADP } from "../structure/crystal.js";
import { adpToMatrix } from "../structure/fract-to-cart.js";
import { SymmetryGrower } from "../structure/structure-modifiers.js";

/**
 * Calculate transformation matrix for ellipsoid visualization.
 * 
 * @param {number[]} uijCart - Uij values in Cartesian coordinates. 
 *                            Order is U11, U22, U33, U12, U13, U23.
 * @returns {THREE.Matrix4} THREE.js Matrix4 transformation matrix for ellipsoid visualization.
 * 
 * @throws {Error} If input array does not contain exactly 6 values.
 * 
 * @notes
 * For conversion from CIF convention, see R. W. Grosse-Kunstleve,
 * J. Appl. Cryst. (2002). 35, 477-480.
 */
export function calcEllipsoidMatrix(uijCart) {
    // Input validation
    if (uijCart.length !== 6) {
        throw new Error("This function needs six cartesian Uij parameters.");
    }

    // Create the symmetric matrix from Uij parameters
    const uijMatrix = adpToMatrix(uijCart);

    // Calculate eigenvalues and eigenvectors
    const { values: _, eigenvectors: eigenvectors_obj } = math.eigs(uijMatrix);
    eigenvectors_obj.reverse();
    const eigenvectors = math.transpose(math.matrix(eigenvectors_obj.map(entry => entry.vector)));
    // Check determinant and normalize if needed
    const eigenvalues = math.matrix(eigenvectors_obj.map(entry => entry.value));
    const det = math.det(eigenvectors);
    const sqrtEigenvalues = math.diag(eigenvalues.map(Math.sqrt));
    
    let transformationMatrix;
    
    if (math.abs(det - 1) > 1e-10) {
        const normalizedEigenvectors = math.multiply(eigenvectors, 1/det);
        transformationMatrix = math.multiply(normalizedEigenvectors, sqrtEigenvalues);
    } else {
        transformationMatrix = math.multiply(eigenvectors, sqrtEigenvalues);
    }

    // Convert math.js matrix to array
    const matrixArray = math.matrix(transformationMatrix).toArray();
    const norms = math.diag(math.matrix(transformationMatrix.toArray().map(row => math.norm(row))));

    // Create THREE.js Matrix4
    // Note: Matrix4 is column-major, while our computation was row-major
    // Also need to expand from 3x3 to 4x4 with proper homogeneous coordinates
    const matrix4 = new THREE.Matrix4();
    matrix4.set(
        matrixArray[0][0], matrixArray[0][1], matrixArray[0][2], 0,
        matrixArray[1][0], matrixArray[1][1], matrixArray[1][2], 0,
        matrixArray[2][0], matrixArray[2][1], matrixArray[2][2], 0,
        0, 0, 0, 1
    );
    // matrix4.transpose();
    return matrix4;
}

function calcBondTransform(position1, position2) {
    // Calculate length and unit vector
    const direction = position2.clone().sub(position1);
    const length = direction.length();
    const unit = direction.divideScalar(length);
    
    // Y-axis reference vector
    const yAxis = new THREE.Vector3(0, 1, 0);
    
    // Calculate rotation axis and angle
    const rotationAxis = new THREE.Vector3().crossVectors(unit, yAxis);
    const angle = -Math.acos(unit.dot(yAxis));
    
    // Create and return transformation matrix
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
export class ORTEP3JsStructure {
    constructor(crystalStructure, options = {}) {
        this.options = {
            atomDetail: defaultSettings.atomDetail,
            atomColorRoughness: defaultSettings.atomColorRoughness,
            atomColorMetalness: defaultSettings.atomColorMetalness,
            atomADPRingWidthFactor: defaultSettings.atomADPRingWidthFactor,
            atomADPRingHeight: defaultSettings.atomADPRingHeight,
            atomADPRingSections: defaultSettings.atomADPRingSections,
            bondRadius: defaultSettings.bondRadius,
            bondSections: defaultSettings.bondSections,
            bondColor: defaultSettings.bondColor,
            bondColorRoughness: defaultSettings.bondColorRoughness,
            bondColorMetalness: defaultSettings.bondColorMetalness,
            hbondRadius: defaultSettings.hbondRadius,
            hbondColor: defaultSettings.hbondColor,
            hbondColorRoughness: defaultSettings.hbondColorRoughness,
            hbondColorMetalness: defaultSettings.hbondColorMetalness,
            hbondDashSegmentLength: defaultSettings.hbondDashSegmentLength,
            hbondDashFraction: defaultSettings.hbondDashFraction,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...options.elementProperties
            },
            ...options
        };
        this.crystalStructure = crystalStructure;
        this.scaling = 1.5384;
        
        this.createBaseGeometries()
        this.createBaseMaterials()

        this.colorMaterials = {};
        this.atoms3D = [];

        const atomLabels = this.crystalStructure.atoms.map(atom => atom.label);
        
        // Create atoms
        for (const atom of this.crystalStructure.atoms) {
            const [atomMaterial, ringMaterial] = this.getAtomMaterials(atom.atomType);
            
            if (atom.adp instanceof UAnisoADP) {
                this.atoms3D.push(new ORTEPAniAtom(
                    atom, 
                    this.crystalStructure.cell,
                    this.baseAtom,
                    atomMaterial,
                    this.baseADPRing,
                    ringMaterial
                ));
            } else {
                this.atoms3D.push(new ORTEPIsoAtom(
                    atom, 
                    this.crystalStructure.cell,
                    this.baseAtom,
                    atomMaterial,
                ));
            }
        }

        // Handle regular bonds
        const drawnBonds = this.crystalStructure.bonds.map(bond => {
            return new Bond(
                bond.atom1Label, 
                SymmetryGrower.combineSymOpLabel(bond.atom2Label, bond.atom2SiteSymmetry),
                bond.bondLength, 
                bond.bondLengthSU,
                "."
            );
        })
        .filter(bond => atomLabels.includes(bond.atom2Label));

        this.bonds3D = [];
        for (const bond of drawnBonds) {
            this.bonds3D.push(new ORTEPBond(
                bond,
                this.crystalStructure,
                this.baseBond,
                this.baseBondMaterial
            ));
        }

        const drawnHBonds = this.crystalStructure.hBonds.map(hBond => {
            return new HBond(
                hBond.donorAtomLabel,
                hBond.hydrogenAtomLabel,
                SymmetryGrower.combineSymOpLabel(hBond.acceptorAtomLabel, hBond.acceptorAtomSymmetry),
                hBond.donorHydrogenDistance,
                hBond.donorHydrogenDistanceSU,
                hBond.acceptorHydrogenDistance,
                hBond.acceptorHydrogenDistanceSU,
                hBond.donorAcceptorDistance,
                hBond.donorAcceptorDistanceSU,
                hBond.hBondAngle,
                hBond.hBondAngleSU,
                "."
            );
        })
        .filter(hBond => atomLabels.includes(hBond.acceptorAtomLabel));

        // Handle hydrogen bonds
        this.hBonds3D = [];
        for (const hbond of drawnHBonds) {
            this.hBonds3D.push(new ORTEPHBond(
                hbond,
                this.crystalStructure,
                this.baseHBond,
                this.baseHBondMaterial,
                this.options.hbondDashSegmentLength,
                this.options.hbondDashFraction
            ));
        }
    }

    createBaseGeometries() {
        this.baseAtom = new THREE.IcosahedronGeometry(
            this.scaling, 
            this.options.atomDetail
        );
        
        this.baseADPRing = this.getADPHalfTorus();

        this.baseBond = new THREE.CylinderGeometry(
            this.options.bondRadius, 
            this.options.bondRadius, 
            0.98, 
            this.options.bondSections, 
            1, 
            true
        );

        this.baseHBond = new THREE.CylinderGeometry(
            this.options.hbondRadius,
            this.options.hbondRadius,
            0.98,
            this.options.bondSections,
            1,
            true
        );
    }

    createBaseMaterials() {
        this.baseBondMaterial = new THREE.MeshStandardMaterial({
            color: this.options.bondColor,
            roughness: this.options.bondColorRoughness, 
            metalness: this.options.bondColorMetalness
        });

        this.baseHBondMaterial = new THREE.MeshStandardMaterial({
            color: this.options.hbondColor,
            roughness: this.options.hbondColorRoughness,
            metalness: this.options.hbondColorMetalness
        });
    }

    getADPHalfTorus() {
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
            
            const dist1 = Math.sqrt(
                positions[idx1] * positions[idx1] + 
                positions[idx1 + 1] * positions[idx1 + 1] + 
                positions[idx1 + 2] * positions[idx1 + 2]
            );
            const dist2 = Math.sqrt(
                positions[idx2] * positions[idx2] + 
                positions[idx2 + 1] * positions[idx2 + 1] + 
                positions[idx2 + 2] * positions[idx2 + 2]
            );
            const dist3 = Math.sqrt(
                positions[idx3] * positions[idx3] + 
                positions[idx3 + 1] * positions[idx3 + 1] + 
                positions[idx3 + 2] * positions[idx3 + 2]
            );
            
            // Only keep triangles where all vertices are outside sphere
            if (dist1 >= this.scaling && dist2 >= this.scaling && dist3 >= this.scaling) {
                keptIndices.add(indices[i]);
                keptIndices.add(indices[i + 1]);
                keptIndices.add(indices[i + 2]);
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
        return baseADPRing
    }

    // Rest of the class methods remain unchanged
    getAtomMaterials(atomType) {
        const elementProperty = this.options.elementProperties[atomType];
        for (const color of [elementProperty.atomColor, elementProperty.ringColor]) {
            if (!(color in this.colorMaterials)) {
                const newMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: this.options.atomColorRoughness,
                    metalness: this.options.atomColorMetalness
                });
                this.colorMaterials[color] = newMaterial;
            }
        }
        const atomMaterial = this.colorMaterials[elementProperty.atomColor];
        const ringMaterial = this.colorMaterials[elementProperty.ringColor];
        return [atomMaterial, ringMaterial]
    }

    getGroup() {
        const group = new THREE.Group;
        let meanAccumulator = new THREE.Vector3();
        for (const atom3D of this.atoms3D) {
            group.add(atom3D.object3D);
            meanAccumulator.add(atom3D.object3D.position);
        }
        for (const bond3D of this.bonds3D) {
            group.add(bond3D.object3D);
        }
        for (const hBond3D of this.hBonds3D) {
            group.add(hBond3D.object3D);
        }
        meanAccumulator.divideScalar(-this.atoms3D.length);
        group.position.copy(meanAccumulator);
        return group;
    }
}

class ORTEPObject {
    createSelectionMarker(color, options) {
        // Each subclass implements this
    }
}

class ORTEPAtom extends ORTEPObject{
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super();
        this.atom = atom;
        const fract2cart = new THREE.Matrix3().fromArray(unitCell.fractToCartMatrix.toArray().flat());
        const position = new THREE.Vector3(atom.fractX, atom.fractY, atom.fractZ);
        position.applyMatrix3(fract2cart);

        this.object3D = new THREE.Mesh(baseAtom, atomMaterial);
        this.object3D.position.copy(position);
        this.object3D.userData.type = 'atom';
        this.object3D.userData.atomData = atom;
    }

    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(this.object3D.geometry, 
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9,
                side: THREE.BackSide
            })
        );
        outlineMesh.scale.multiplyScalar(options.selection.markerMult);
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

class ORTEPAniAtom extends ORTEPAtom{
    constructor(atom, unitCell, baseAtom, atomMaterial, baseADPRing=null, ADPRingMaterial=null) {
        super(atom, unitCell, baseAtom, atomMaterial);
        const fract2cart = new THREE.Matrix3().fromArray(math.flatten(unitCell.fractToCartMatrix).toArray());
        const position = new THREE.Vector3(atom.fractX, atom.fractY, atom.fractZ);
        position.applyMatrix3(fract2cart);

        const ellipsoidMatrix = calcEllipsoidMatrix(atom.adp.getUCart(unitCell));

        if (ellipsoidMatrix.toArray().includes(NaN)){
            this.object3D = new THREE.Mesh(
                new THREE.TetrahedronGeometry(1),
                atomMaterial
            );
        } else {
            this.object3D = new THREE.Mesh(baseAtom, atomMaterial);
            for (const m of this.adpRingMatrices) {
                const ringMesh = new THREE.Mesh(baseADPRing, ADPRingMaterial);
                ringMesh.applyMatrix4(m);
                ringMesh.userData.selectable = false;
                //ringMesh.userData.parentAtom = this.mesh;
                this.object3D.add(ringMesh);
            }

            this.object3D.applyMatrix4(ellipsoidMatrix);
        }
        this.object3D.position.copy(position);
        this.object3D.userData.type = 'atom';
        this.object3D.userData.atomData = atom;
        this.object3D.userData.selectable = true;
    }

    get adpRingMatrices() {
        const m_ring0 = new THREE.Matrix4();
        m_ring0.set(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        );

        const m_ring1 = new THREE.Matrix4();
        m_ring1.set(
            1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        );

        const m_ring2 = new THREE.Matrix4();
        m_ring2.set(
            0.0, -1.0, 0.0, 0.0,
            1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        );
        return [m_ring0, m_ring1, m_ring2];
    }
}
class ORTEPIsoAtom extends ORTEPAtom {
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(atom, unitCell, baseAtom, atomMaterial)
        this.object3D.scale.multiplyScalar(1.0/10.53);
        this.object3D.userData.type = 'atom';
        this.object3D.userData.atomData = atom;
        this.object3D.userData.selectable = true;
    }
}

class ORTEPBond extends ORTEPObject{
    constructor(bond, crystalStructure, baseBond, baseBondMaterial) {
        super();
        const fract2cart = new THREE.Matrix3().fromArray(crystalStructure.cell.fractToCartMatrix.toArray().flat());
        const bondAtom1 = crystalStructure.getAtomByLabel(bond.atom1Label);
        const bondAtom2 = crystalStructure.getAtomByLabel(bond.atom2Label);
        const atom1position = new THREE.Vector3(bondAtom1.fractX, bondAtom1.fractY, bondAtom1.fractZ);
        atom1position.applyMatrix3(fract2cart);
        const atom2position = new THREE.Vector3(bondAtom2.fractX, bondAtom2.fractY, bondAtom2.fractZ);
        atom2position.applyMatrix3(fract2cart);
        const bondTransform = calcBondTransform(atom1position, atom2position);
        this.object3D = new THREE.Mesh(baseBond, baseBondMaterial);
        this.object3D.applyMatrix4(bondTransform);
        this.object3D.userData.type = 'bond';
        this.object3D.userData.bondData = bond;
        this.object3D.userData.selectable = true;
    }

    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(this.object3D.geometry, 
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9,
                side: THREE.BackSide
            })
        );
        outlineMesh.scale.x *= options.selection.bondMarkerMult;
        outlineMesh.scale.z *= options.selection.bondMarkerMult;
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

export class DashedBondGroup extends THREE.Group {
    constructor() {
        super();
        this._material = null;
    }

    // Material getter/setter that propagates to all segments
    get material() {
        return this.children[0].material.clone();
    }

    set material(newMaterial) {
        this._material = newMaterial;
        // Update all child segments with the new material
        this.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = newMaterial;
            }
        });
    }

    // Method to dispose of materials properly
    dispose() {
        if (this._material) {
            this._material.dispose();
        }
        this.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
            }
        });
    }

    // Clone method that preserves material handling
    clone(recursive = true) {
        const clone = new DashedBondGroup();
        clone.copy(this, recursive);
        clone._material = this._material;
        return clone;
    }

    // Copy method for proper cloning
    copy(source, recursive = true) {
        super.copy(source, recursive);
        this._material = source._material;
        return this;
    }
}

class ORTEPHBond extends ORTEPObject {
    constructor(hbond, crystalStructure, baseHBond, baseHBondMaterial, targetSegmentLength, dashFraction) {
        super();
        this.baseHBond = baseHBond;
        const fract2cart = new THREE.Matrix3().fromArray(crystalStructure.cell.fractToCartMatrix.toArray().flat());
        
        // Get the hydrogen atom position
        const hydrogenAtom = crystalStructure.getAtomByLabel(hbond.hydrogenAtomLabel);
        const hydrogenPosition = new THREE.Vector3(
            hydrogenAtom.fractX,
            hydrogenAtom.fractY,
            hydrogenAtom.fractZ
        );
        hydrogenPosition.applyMatrix3(fract2cart);

        // Get the acceptor atom position
        const acceptorAtom = crystalStructure.getAtomByLabel(hbond.acceptorAtomLabel);
        const acceptorPosition = new THREE.Vector3(
            acceptorAtom.fractX,
            acceptorAtom.fractY,
            acceptorAtom.fractZ
        );
        acceptorPosition.applyMatrix3(fract2cart);

        // Create dashed bond group with initial material
        this.object3D = new DashedBondGroup();
        
        // Calculate dash pattern using provided parameters
        const totalLength = hydrogenPosition.distanceTo(acceptorPosition);
        const idealNumSegments = Math.floor(totalLength / targetSegmentLength);
        const numSegments = Math.max(1, idealNumSegments);
        const actualSegmentLength = totalLength / numSegments;
        const dashLength = actualSegmentLength * dashFraction;

        // Store positions for selection marker
        this.hydrogenPosition = hydrogenPosition;
        this.acceptorPosition = acceptorPosition;

        // Create dash segments
        for (let i = 0; i < numSegments; i++) {
            const startFraction = i / numSegments;
            const endFraction = startFraction + (dashLength / totalLength);

            const start = new THREE.Vector3().lerpVectors(
                hydrogenPosition,
                acceptorPosition,
                startFraction
            );
            const end = new THREE.Vector3().lerpVectors(
                hydrogenPosition,
                acceptorPosition,
                endFraction
            );

            // Create segment mesh (material will be set by DashedBondGroup)
            const segmentMesh = new THREE.Mesh(baseHBond);
            const segmentTransform = calcBondTransform(start, end);
            segmentMesh.applyMatrix4(segmentTransform);
            
            // Add metadata for interaction
            segmentMesh.userData.type = 'hbond_segment';
            segmentMesh.userData.hbondData = hbond;
            segmentMesh.userData.selectable = true;
            segmentMesh.userData.parentGroup = this.object3D;

            this.object3D.add(segmentMesh);
        }
        this.object3D.material = baseHBondMaterial;

        // Add metadata to the bond group
        this.object3D.userData.type = 'hbond';
        this.object3D.userData.hbondData = hbond;
        this.object3D.userData.selectable = true;
    }

    createSelectionMarker(color, options) {
        const markerGroup = new DashedBondGroup();
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide
        });

        this.object3D.children.forEach(segment => {
            const markerMesh = new THREE.Mesh(segment.geometry, outlineMaterial);
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