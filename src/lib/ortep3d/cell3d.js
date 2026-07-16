import * as THREE from 'three';
import { UnitCell } from '../structure/crystal';

/**
 * Creates a 3D arrow visualization using a cylinder shaft and cone head.
 * The arrow points in the direction of the provided vector from the origin.
 * @param {THREE.Vector3} vector - The direction and magnitude vector for the arrow
 * @param {THREE.Color|string|number} color - The color for both shaft and head (THREE.Color, hex string, or number)
 * @param {number} headLength - The length/height of the cone arrowhead
 * @param {number} headWidth - The radius of the cone arrowhead base
 * @param {number} cylinderRadius - The radius of the cylinder shaft for the arrow
 * @returns {THREE.Group} A THREE.Group containing the cylinder shaft and cone head meshes
 */
function createCylinderArrow(vector, color, headLength, headWidth, cylinderRadius) {
    const direction = vector.clone().normalize();
    const magnitude = vector.length();
    const shaftLength = magnitude - headLength;
    
    // Create a cylinder geometry for the arrow shaft
    const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, shaftLength, 8);
    const cylinderMaterial = new THREE.MeshBasicMaterial({ color: color });
    const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    
    // Create a cone geometry for the arrow head
    const coneGeometry = new THREE.ConeGeometry(headWidth, headLength, 8);
    const coneMaterial = new THREE.MeshBasicMaterial({ color: color });
    const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Default cylinder points along Y-axis (0, 1, 0)
    // Default cone points along Y-axis (0, 1, 0)
    const defaultDirection = new THREE.Vector3(0, 1, 0);
    
    // Create rotation quaternion to align with target direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(defaultDirection, direction);
    
    // Apply rotation to both meshes
    cylinderMesh.applyQuaternion(quaternion);
    coneMesh.applyQuaternion(quaternion);
    
    // Position cylinder at half its length along the direction
    cylinderMesh.position.copy(direction.clone().multiplyScalar(shaftLength / 2));
    
    // Position cone at the end of the shaft
    coneMesh.position.copy(direction.clone().multiplyScalar(shaftLength + headLength / 2));
    
    // Combine the cylinder and cone into a group
    const arrowGroup = new THREE.Group();
    arrowGroup.add(cylinderMesh);
    arrowGroup.add(coneMesh);
    
    return arrowGroup;
}

/**
 * Creates the wireframe edges of a unit cell using line segments.
 * This creates a proper parallelepiped representation with 12 edges.
 * @param {THREE.Matrix4} transformationMatrix - The fractional-to-cartesian transformation matrix
 * @param {string|number} color - Color for the wireframe lines
 * @param {number} opacity - Opacity of the wireframe lines
 * @param {number} lineWidth - Width of the lines (note: may not work in all browsers)
 * @returns {THREE.Group} A group containing all the wireframe edges
 */
function createUnitCellWireframe(transformationMatrix, color, opacity, lineWidth) {
    const wireframeGroup = new THREE.Group();
    
    // Define the 8 vertices of a unit cube in fractional coordinates
    const vertices = [
        new THREE.Vector3(0, 0, 0), // 0: origin
        new THREE.Vector3(1, 0, 0), // 1: along a
        new THREE.Vector3(0, 1, 0), // 2: along b  
        new THREE.Vector3(0, 0, 1), // 3: along c
        new THREE.Vector3(1, 1, 0), // 4: a+b
        new THREE.Vector3(1, 0, 1), // 5: a+c
        new THREE.Vector3(0, 1, 1), // 6: b+c
        new THREE.Vector3(1, 1, 1), // 7: a+b+c
    ];
    
    // Transform vertices to cartesian coordinates
    const cartesianVertices = vertices.map(vertex => {
        return vertex.clone().applyMatrix4(transformationMatrix);
    });
    
    // Define the 12 edges of the parallelepiped
    const edges = [
        // Bottom face (z=0)
        [0, 1], [1, 4], [4, 2], [2, 0],
        // Top face (z=1)  
        [3, 5], [5, 7], [7, 6], [6, 3],
        // Vertical edges connecting bottom and top
        [0, 3], [1, 5], [4, 7], [2, 6],
    ];
    
    // Create line material
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: opacity < 1.0,
        opacity: opacity,
        linewidth: 1.0 * lineWidth, // Note: may not work in WebGL
    });
    
    // Create each edge as a line segment
    edges.forEach(([startIdx, endIdx]) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            cartesianVertices[startIdx],
            cartesianVertices[endIdx],
        ]);
        
        const line = new THREE.Line(geometry, lineMaterial);
        wireframeGroup.add(line);
    });
    
    return wireframeGroup;
}

/**
 * Creates a 3D representation of a unit cell using Three.js with proper wireframe edges.
 * @param {UnitCell} cell - The unit cell object containing dimensions and angles
 * @param {object} cellSettings - Settings for the cell representation
 * @param {string} cellSettings.boxColor - Color of the cell wireframe
 * @param {number} cellSettings.boxOpacity - Opacity of the cell wireframe
 * @param {number} cellSettings.boxLineWidth - Width of wireframe lines
 * @param {string} cellSettings.arrowColorA - Color for axis A
 * @param {string} cellSettings.arrowColorB - Color for axis B
 * @param {string} cellSettings.arrowColorC - Color for axis C
 * @param {number} cellSettings.arrowHeadLengthMult - Head length as fraction of smallest axis
 * @param {number} cellSettings.arrowHeadWidthMult - Head width as fraction of head length
 * @param {number} cellSettings.arrowCylinderRadius - Radius of the arrow shaft cylinders
 * @returns {THREE.Group} A Three.js Group containing the cell wireframe and axes
 */
export function createCell3D(cell, cellSettings) {
    const { 
        boxColor, 
        boxOpacity, 
        boxLineWidth,
        arrowColorA, 
        arrowColorB, 
        arrowColorC, 
        arrowHeadLengthMult, 
        arrowHeadWidthMult,
        arrowCylinderRadius,
    } = cellSettings;

    const cellGroup = new THREE.Group();

    // Create transformation matrix from the unit cell
    const matrixArray = cell.fractToCartMatrix.toArray();
    const transformationMatrix = new THREE.Matrix4(
        matrixArray[0][0], matrixArray[0][1], matrixArray[0][2], 0,
        matrixArray[1][0], matrixArray[1][1], matrixArray[1][2], 0,
        matrixArray[2][0], matrixArray[2][1], matrixArray[2][2], 0,
        0, 0, 0, 1,
    );

    // Create the wireframe using line segments
    const wireframe = createUnitCellWireframe(transformationMatrix, boxColor, boxOpacity, boxLineWidth);
    cellGroup.add(wireframe);

    // Extract basis vectors for the axes
    const directionA = new THREE.Vector3();
    const directionB = new THREE.Vector3();
    const directionC = new THREE.Vector3();
    transformationMatrix.extractBasis(directionA, directionB, directionC);

    // Calculate arrow dimensions based on cell parameters
    const { a, b, c } = cell;
    const headLength = Math.max(a, b, c) * arrowHeadLengthMult;
    const headWidth = headLength * arrowHeadWidthMult;

    // Create arrows to represent the cell axes
    const arrowA = createCylinderArrow(directionA, arrowColorA, headLength, headWidth, arrowCylinderRadius);
    const arrowB = createCylinderArrow(directionB, arrowColorB, headLength, headWidth, arrowCylinderRadius);
    const arrowC = createCylinderArrow(directionC, arrowColorC, headLength, headWidth, arrowCylinderRadius);

    cellGroup.add(arrowA);
    cellGroup.add(arrowB);
    cellGroup.add(arrowC);
    
    // Add metadata
    cellGroup.name = 'UnitCell';
    cellGroup.userData = {
        selectable: false,
        cellParameters: { a, b, c, alpha: cell.alpha, beta: cell.beta, gamma: cell.gamma },
        type: 'UnitCell',
    };
    
    return cellGroup;
}