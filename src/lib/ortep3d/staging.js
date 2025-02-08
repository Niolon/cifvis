import * as THREE from 'three';

/**
 * Calculates the bounding box and dimensions of a structure
 * @param {THREE.Object3D} structureGroup - The structure to analyze
 * @returns {Object} Bounds information including box, size, and center
 */
export function calculateStructureBounds(structureGroup) {
    // Create a bounding box that will encompass all geometry in the group
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(structureGroup);
    
    // Calculate the size and center of the structure
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    return { boundingBox, size, center };
}

/**
 * Sets up scene lighting based on structure dimensions
 * @param {THREE.Scene} scene - The scene to light
 * @param {Object} structureBounds - Bounds information from calculateStructureBounds
 */
export function setupLighting(scene, structureBounds) {
    // Remove all existing lights
    scene.children = scene.children.filter(child => !(child instanceof THREE.Light));
    
    const { size, __ } = structureBounds;
    const maxDimension = Math.max(size.x, size.y, size.z);
    const lightDistance = maxDimension;
    
    // Base ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    
    // Main shadow-casting light
    const mainLight = new THREE.SpotLight(0xffffff, 1000, 0.0, Math.PI * 0.27, 0.6);
    mainLight.position.set(0, -0.5, 4 * lightDistance);
    // mainLight.castShadow = true;
    mainLight.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
    
    // Configure shadow properties
    // mainLight.shadow.mapSize.width = 2048;
    // mainLight.shadow.mapSize.height = 2048;
    // mainLight.shadow.camera.near = 0.1;
    // mainLight.shadow.camera.far = lightDistance * 10;
    // mainLight.shadow.camera.left = -maxDimension;
    // mainLight.shadow.camera.right = maxDimension;
    // mainLight.shadow.camera.top = maxDimension;
    // mainLight.shadow.camera.bottom = -maxDimension;
    // mainLight.shadow.radius = 20;
    scene.add(mainLight);

    // Additional fill lights for better depth perception
    const fillLights = [
        { pos: [-1, -0.5, 1], intensity: 0.4 },
        { pos: [1, -0.5, 1], intensity: 0.4 },
        { pos: [0, -0.5, 1], intensity: 0.3 }
    ];

    fillLights.forEach(({ pos, intensity }) => {
        const light = new THREE.DirectionalLight(0xffffff, intensity);
        light.position.set(
            pos[0] * lightDistance,
            pos[1] * lightDistance,
            pos[2] * lightDistance
        );
        scene.add(light);
    });
}

/**
 * Creates a floor plane that can receive shadows from the molecule
 * @param {number} size - The width and depth of the floor
 * @returns {THREE.Mesh} The floor mesh
 */
export function createFloor(size) {
    const floorGeometry = new THREE.PlaneGeometry(size, size);
    //const floorMaterial = new THREE.MeshStandardMaterial({
    //    color: 0xffffff,
    //    roughness: 0.8,
    //    metalness: 0.0
    //});
    const floorMaterial = new THREE.ShadowMaterial({
        opacity: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.castShadow = true;
    floor.receiveShadow = true;
    floor.rotation.z = -Math.PI / 2;
    return floor;
}




