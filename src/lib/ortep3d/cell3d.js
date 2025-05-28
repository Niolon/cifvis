import * as THREE from 'three';
import { UnitCell } from '../structure/crystal';

/**
 *
 * @param vector
 * @param color
 * @param headLength
 * @param headWidth
 */
function createCylinderArrow(vector, color, headLength, headWidth) {
    const direction = vector.clone().normalize();
    const origin = new THREE.Vector3(0, 0, 0);
    
    // Create a cylinder geometry for the arrow shaft
    const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, vector.length(), 8);
    const cylinderMaterial = new THREE.MeshBasicMaterial({ color: color });
    const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    
    // Position the cylinder
    cylinderMesh.position.copy(origin);
    cylinderMesh.lookAt(direction.add(origin));
    
    // Create a cone geometry for the arrow head
    const coneGeometry = new THREE.ConeGeometry(headWidth, headLength, 8);
    const coneMaterial = new THREE.MeshBasicMaterial({ color: color });
    const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Position the cone at the end of the cylinder
    coneMesh.position.copy(direction.multiplyScalar(vector.length()).add(origin));
    coneMesh.lookAt(direction.add(origin));
    
    // Combine the cylinder and cone into a group
    const arrowGroup = new THREE.Group();
    arrowGroup.add(cylinderMesh);
    arrowGroup.add(coneMesh);
    
    return arrowGroup;
}

/**
 * Creates a 3D representation of a unit cell using Three.js.
 * @param {UnitCell} cell - The unit cell object containing dimensions and angles.
 * @param {object} cellSettings - Settings for the cell representation.
 * @param {string} cellSettings.color - Color of the cell.
 * @param {number} cellSettings.opacity - Opacity of the cell.
 * @param {string} cellSettings.colorA - Color for axis A.
 * @param {string} cellSettings.colorB - Color for axis B.
 * @param {string} cellSettings.colorC - Color for axis C.
 * @returns {THREE.Group} - A Three.js Group containing the cell mesh and axes.
 */
export function createCell3D(cell, cellSettings) {
    const { color, opacity } = cellSettings;

    const cellGroup = new THREE.Group();

    // Create a THREE.BoxGeometry based on the unit cell dimensions
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // Create a material with the specified color and opacity
    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
    });

    // Create the mesh for the unit cell
    const cellMesh = new THREE.Mesh(geometry, material);

    const transformationMatrix = new THREE.Matrix4(...cell.fractToCartMatrix.toArray());
    cellMesh.applyMatrix4(transformationMatrix);

    // Set the rotation based on the angles alpha, beta, gamma
    cellGroup.add(cellMesh);

    const rotationMatrix = new THREE.Matrix4();
    transformationMatrix.extractRotation(rotationMatrix);

    const directionA = new THREE.Vector3(1, 0, 0).applyMatrix4(rotationMatrix);
    const directionB = new THREE.Vector3(0, 1, 0).applyMatrix4(rotationMatrix);
    const directionC = new THREE.Vector3(0, 0, 1).applyMatrix4(rotationMatrix);
    const origin = new THREE.Vector3(0, 0, 0);

    const { a, b, c } = cell;
    const { colorA, colorB, colorC, headLengthMult, headWidthMult } = cellSettings;

    const headLength = Math.min(a, b, c) * headLengthMult; // Length of the arrow heads
    const headWidth = headLength * headWidthMult; // Width of the arrow heads

    // Create arrows to represent the cell axes

    const arrowA = new THREE.ArrowHelper(directionA, origin, a, new THREE.Color(colorA), headLength, headWidth);
    const arrowB = new THREE.ArrowHelper(directionB, origin, b, new THREE.Color(colorB), headLength, headWidth);
    const arrowC = new THREE.ArrowHelper(directionC, origin, c, new THREE.Color(colorC), headLength, headWidth);

    cellGroup.add(arrowA);
    cellGroup.add(arrowB);
    cellGroup.add(arrowC);
    cellGroup.name = 'UnitCell';
    cellGroup.userData = {
        selectable: false,
    };
    
    return cellGroup;
}
