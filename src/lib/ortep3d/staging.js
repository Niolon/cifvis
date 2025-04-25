import * as THREE from 'three';
import { create, all } from 'mathjs';

const math = create(all, {});

/**
 * Calculates the normal vector to the best-fit (mean) plane through a set of 3D points
 * using principal component analysis (eigenvalue decomposition of the covariance matrix).
 * @param {THREE.Vector3[]} points - Array of 3D points
 * @returns {THREE.Vector3} Unit normal vector to the mean plane
 */
function calculateMeanPlaneNormal(points) {
    // Calculate centroid
    const centroid = new THREE.Vector3();
    points.forEach(p => centroid.add(p));
    centroid.divideScalar(points.length);
    
    // Build covariance matrix
    const covariance = new THREE.Matrix3();
    const temp = new THREE.Vector3();
    
    points.forEach(p => {
        temp.copy(p).sub(centroid);
        covariance.elements[0] += temp.x * temp.x;
        covariance.elements[1] += temp.x * temp.y;
        covariance.elements[2] += temp.x * temp.z;
        covariance.elements[3] += temp.y * temp.x;
        covariance.elements[4] += temp.y * temp.y;
        covariance.elements[5] += temp.y * temp.z;
        covariance.elements[6] += temp.z * temp.x;
        covariance.elements[7] += temp.z * temp.y;
        covariance.elements[8] += temp.z * temp.z;
    });
    
    // Use mathjs for eigenvalue decomposition
    const { values: eigenvalues, eigenvectors: eigenvectors } = math.eigs(threeMatrixToMathJS(covariance));
    // Get normal vector (eigenvector of smallest eigenvalue)
    const minEigenvalue = math.min(eigenvalues);
    if (minEigenvalue <= 0) {
        console.warn('Could not find a mean plane, expected?');
        return new THREE.Vector3(0, 1, 0);
    }
    const normalVector = eigenvectors.filter(entry => entry.value === minEigenvalue)[0].vector;
    const normal = new THREE.Vector3(...normalVector.toArray());
    normal.normalize();
    return normal;
}

/**
 * Converts a THREE.js Matrix3 to a mathjs matrix for advanced matrix operations
 * @param {THREE.Matrix3} matrix - THREE.js Matrix3 to convert
 * @returns {math.Matrix} Equivalent mathjs matrix representation
 */
function threeMatrixToMathJS(matrix) {
    const m = matrix.elements;
    return math.matrix([
        [m[0], m[1], m[2]],
        [m[3], m[4], m[5]],
        [m[6], m[7], m[8]],
    ]);
}

/**
 * Finds optimal rotation to view a molecular structure in a standard orientation:
 * perpendicular to its mean plane, with the longest axis aligned horizontally, and
 * with a slight tilt for better 3D perception.
 * @param {THREE.Object3D} structureGroup - The structure to analyze (containing atom objects)
 * @returns {THREE.Matrix4|null} Rotation matrix to orient structure, or null if no atoms found
 */
export function structureOrientationMatrix(structureGroup) {
    // Extract atom positions
    const positions = [];
    const center = new THREE.Vector3();
    structureGroup.traverse(obj => {
        if(obj.userData?.type === 'atom') {
            positions.push(obj.position.clone());
            center.add(obj.position);
        }
    });
    
    if(positions.length === 0) {
        return null; 
    }
    
    // Center positions
    center.divideScalar(positions.length);
    const centeredPositions = positions.map(p => p.sub(center));
    
    // Get normal to mean plane
    const normal = calculateMeanPlaneNormal(centeredPositions);

    // Calculate rotation to align normal with -z axis (but invert since we rotate structure)
    const zUnit = new THREE.Vector3(0, 0, 1); // Note: positive z since we rotate structure

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(normal, zUnit);
    const rotationMatrix = new THREE.Matrix4();

    rotationMatrix.makeRotationFromQuaternion( quaternion );
    
    // Transform positions
    const rotatedPositions = centeredPositions.map(p => p.clone().applyMatrix4(rotationMatrix));

    // Find point with maximum xy distance
    let maxDistXY = 0;
    let maxDistXYIndex = 0;
    rotatedPositions.forEach((p, i) => {
        const distXY = Math.sqrt(p.x*p.x + p.y*p.y);
        if(distXY > maxDistXY) {
            maxDistXY = distXY;
            maxDistXYIndex = i;
        }
    });
    
    // Calculate final rotation angle
    const xyMax = new THREE.Vector2(
        rotatedPositions[maxDistXYIndex].x,
        rotatedPositions[maxDistXYIndex].y,
    );

    if(xyMax.x < 0) {
        xyMax.multiplyScalar(-1); 
    }
    const rotAngle = -Math.atan2(xyMax.y, xyMax.x); // Note: negative since we rotate structure
    
    // Apply rotation to put largest distance horizontally
    const finalRotation = new THREE.Matrix4().makeRotationZ(rotAngle);
    rotationMatrix.premultiply(finalRotation);

    // Give it a slight angle
    rotationMatrix.premultiply(new THREE.Matrix4().makeRotationX(Math.PI / 8));
    rotationMatrix.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 48));
    
    return rotationMatrix;
}

/**
 * Sets up scene lighting optimized for molecular visualization based on structure dimensions.
 * Creates a combination of ambient light, main directional light, and fill lights.
 * @param {THREE.Scene} scene - The scene to add lights to
 * @param {THREE.Object3D} ortep3DGroup - The molecular structure object to light
 */
export function setupLighting(scene, ortep3DGroup) {
    // Remove all existing lights
    scene.children = scene.children.filter(child => !(child instanceof THREE.Light));
    let maxLength = 6;
    ortep3DGroup.traverse(obj => {
        if(obj.userData?.type === 'atom' && obj.position.length() > maxLength) {
            maxLength = obj.position.length();
        }
    });
    const lightDistance = maxLength * 2;
    
    // Base ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    
    // Main shadow-casting light - always from fixed position since structure rotates
    const mainLight = new THREE.SpotLight(0xffffff, 1000, 0, Math.PI * 0.27, 0.6);
    mainLight.position.set(0, -0.5, lightDistance * 2);
    mainLight.lookAt(new THREE.Vector3(0, 0, 0));
    scene.add(mainLight);

    // Additional fill lights for better depth perception
    const fillLights = [
        { pos: [-1, -0.5, 1], intensity: 0.4 },
        { pos: [1, -0.5, 1], intensity: 0.4 },
        { pos: [0, -0.5, 1], intensity: 0.3 },
    ];

    fillLights.forEach(({ pos, intensity }) => {
        const light = new THREE.DirectionalLight(0xffffff, intensity);
        light.position.set(
            pos[0] * lightDistance,
            pos[1] * lightDistance,
            pos[2] * lightDistance,
        );
        light.lookAt(new THREE.Vector3(0, 0, 0));
        scene.add(light);
    });
}
