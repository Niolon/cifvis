import * as THREE from 'three';

/**
 * Abstract base class for camera controllers in CifVis.
 * Handles configuration, setup, updates, and interaction responses.
 */
class AbstractCameraController {
    /**
     * Creates a new camera controller instance.
     * @param {HTMLElement} container - The DOM container element
     * @param {object} options - Camera configuration options
     */
    constructor(container, options) {
        if (new.target === AbstractCameraController) {
            throw new Error('AbstractCamera is an abstract class and cannot be instantiated directly');
        }
        
        this.container = container;
        this.options = options;
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.createCamera();
    }
    
    /**
     * Creates and initializes the Three.js camera
     * @abstract
     * @returns {THREE.Camera} The created camera instance
     */
    createCamera() {
        throw new Error('createCamera() must be implemented by subclass');
    }
    
    /**
     * Adjusts camera to fit the structure
     * @abstract
     * @param {THREE.Object3D} _structureGroup - The molecular structure to fit in view
     */
    fitToStructure(_structureGroup) {
        throw new Error('fitToStructure() must be implemented by subclass');
    }
    
    /**
     * Handles zoom operations
     * @abstract
     * @param {number} _zoomDelta - Amount and direction of zoom
     */
    zoom(_zoomDelta) {
        throw new Error('zoom() must be implemented by subclass');
    }
    
    /**
     * Handles pan operations
     * @abstract
     * @param {THREE.Vector2} _delta - Amount and direction of pan in normalized coordinates
     */
    pan(_delta) {
        throw new Error('pan() must be implemented by subclass');
    }
    
    /**
     * Updates camera parameters when container is resized
     * @abstract
     */
    handleResize() {
        throw new Error('handleResize() must be implemented by subclass');
    }
    
    /**
     * Resets camera to default position
     */
    reset() {
        this.camera.position.copy(this.basePosition);
        this.camera.lookAt(this.cameraTarget);
    }
}

/**
 * Perspective camera controller implementation for CifVis
 * @augments AbstractCameraController
 */
class PerspectiveCameraController extends AbstractCameraController {
    /**
     * Creates and initializes a perspective camera
     * @returns {THREE.PerspectiveCamera} The created perspective camera
     */
    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            this.options.fov,
            this.container.clientWidth / this.container.clientHeight,
            this.options.near,
            this.options.far,
        );

        this.camera.position.copy(this.options.initialPosition);
        this.camera.lookAt(this.cameraTarget);
        return this.camera;
    }

    /**
     * Adjusts camera distance to fit the entire structure in view
     * @param {THREE.Object3D} structureGroup - The molecular structure to fit in view
     */
    fitToStructure(structureGroup) {
        // Calculate bounding box
        const boundingBox = new THREE.Box3().setFromObject(structureGroup);
        if (boundingBox.isEmpty()) {
            return;
        }
        
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        // Calculate optimal distance using FOV
        const verticalFovRadians = this.options.fov * Math.PI / 180;
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const horizontalFovRadians = Math.atan(aspect * Math.tan(verticalFovRadians / 2) * 2);
        
        const structureAspect = size.x / size.y;
        let distance;
        
        if (structureAspect <= aspect) {
            distance = (size.y / 2 / Math.tan(verticalFovRadians / 2) + size.z / 2);
        } else {
            distance = (size.x / 2 / Math.tan(horizontalFovRadians / 2) + size.z / 2);
        }
        
        // Update camera position and constraints
        this.camera.position.set(0, 0, distance);
        this.camera.lookAt(this.cameraTarget);
        
        // Set constraints
        this.options.minDistance = distance * 0.2;
        this.options.maxDistance = distance * 2;
        this.basePosition = new THREE.Vector3(0, 0, distance);
    }
    
    /**
     * Adjusts camera distance based on zoom delta
     * @param {number} zoomDelta - Amount to zoom (positive = zoom out, negative = zoom in)
     */
    zoom(zoomDelta) {
        const { minDistance, maxDistance } = this.options;
        const maxTravel = maxDistance - minDistance;
        const currentDistance = this.camera.position.length();
        const newDistance = THREE.MathUtils.clamp(
            currentDistance + zoomDelta * maxTravel,
            minDistance,
            maxDistance,
        );
        
        const direction = this.camera.position.clone().normalize();
        this.camera.position.copy(direction.multiplyScalar(newDistance));
    }
    
    /**
     * Moves camera in the view plane
     * @param {THREE.Vector2} delta - Pan amount in normalized device coordinates (-1 to 1)
     */
    pan(delta) {
        const distance = this.camera.position.z;
        
        // Calculate view frustum size at current distance
        const fovRadians = this.options.fov * Math.PI / 180;
        const frustumHeight = Math.tan(fovRadians / 2) * distance;
        const frustumWidth = frustumHeight * this.camera.aspect;
        
        // Convert normalized coordinates to world space
        const moveX = -delta.x * frustumWidth;
        const moveY = -delta.y * frustumHeight;
        
        // Extract camera basis vectors
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Move camera in view plane
        this.camera.position.addScaledVector(right, moveX);
        this.camera.position.addScaledVector(up, moveY);
    }
    
    /**
     * Updates camera aspect ratio and projection when container is resized
     */
    handleResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.aspect = aspect;
        
        // Handle adaptive FOV for different aspect ratios
        const targetFov = this.options.fov;
        
        if (this.container.clientWidth < this.container.clientHeight) {
            // Width is limiting factor
            this.camera.fov = 2 * Math.atan(Math.tan(targetFov * Math.PI / 360) / aspect) * 180 / Math.PI;
        } else {
            // Height is limiting factor
            this.camera.fov = targetFov;
        }
        
        this.camera.updateProjectionMatrix();
    }
}

/**
 * Orthographic camera controller implementation for CifVis
 * @augments AbstractCameraController
 */
class OrthographicCameraController extends AbstractCameraController {
    /**
     * Creates and initializes an orthographic camera
     * @returns {THREE.OrthographicCamera} The created orthographic camera
     */
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const size = this.options.orthoSize || 5;
        
        this.camera = new THREE.OrthographicCamera(
            -size * aspect, size * aspect,
            size, -size,
            this.options.near,
            this.options.far,
        );
        
        this.camera.position.copy(this.options.initialPosition);
        this.camera.lookAt(this.cameraTarget);
        return this.camera;
    }
    
    /**
     * Adjusts orthographic camera parameters to fit the structure in view
     * @param {THREE.Object3D} structureGroup - The molecular structure to fit in view
     */
    fitToStructure(structureGroup) {
        // Calculate bounding box
        const boundingBox = new THREE.Box3().setFromObject(structureGroup);
        if (boundingBox.isEmpty()) {
            return;
        }
        
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        // Calculate appropriate size for orthographic view
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const structureAspect = size.x / size.y;
        
        let orthoSize;
        if (structureAspect <= aspect) {
            orthoSize = size.y / 2;
        } else {
            orthoSize = size.x / (2 * aspect);
        }

        orthoSize *= 1.05;
        
        // Set camera parameters
        this.setOrthoSize(orthoSize);
        
        // Position camera appropriately for the structure's depth
        this.camera.updateProjectionMatrix();
        
        // Set constraints
        this.options.minSize = orthoSize * 0.2;
        this.options.maxSize = orthoSize * 2;
        this.baseSize = orthoSize;
        this.basePosition = new THREE.Vector3(0, 0, Math.max(size.x, size.y));
        this.camera.position.set(this.basePosition.x, this.basePosition.y, this.basePosition.z);
    }
    
    /**
     * Adjusts orthographic camera size based on zoom delta
     * @param {number} zoomDelta - Amount to zoom (positive = zoom out, negative = zoom in)
     */
    zoom(zoomDelta) {
        const { minDistance, maxDistance } = this.options;
        const maxTravel = maxDistance - minDistance;
        const { minSize, maxSize } = this.options;
        const zoomFactor = (1 + (zoomDelta * this.options.wheelZoomSpeed * maxTravel * 50)) ;
        const newSize = THREE.MathUtils.clamp(
            this.camera.top * zoomFactor,
            minSize,
            maxSize,
        );
        
        // Update camera frustum
        this.setOrthoSize(newSize);
        this.camera.updateProjectionMatrix();
    }
    
    /**
     * Moves orthographic camera in the view plane
     * @param {THREE.Vector2} delta - Pan amount in normalized device coordinates (-1 to 1)
     */
    pan(delta) {
        // For orthographic, pan amount is proportional to visible size
        const size = this.camera.top;
        const moveX = -delta.x * size * 1.41;
        const moveY = -delta.y * size;
        
        // Extract camera basis vectors
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Move camera in view plane
        this.camera.position.addScaledVector(right, moveX);
        this.camera.position.addScaledVector(up, moveY);
    }
    
    /**
     * Updates orthographic camera frustum when container is resized
     */
    handleResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const currentSize = this.camera.top;
        
        this.camera.left = -currentSize * aspect;
        this.camera.right = currentSize * aspect;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Updates the orthographic camera's frustum size
     * @param {number} size - Half-height of the camera's view frustum
     */
    setOrthoSize(size) {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.top = size;
        this.camera.bottom = -size;
        this.camera.left = -size * aspect;
        this.camera.right = size * aspect;
    }
}

/**
 * Creates the appropriate camera controller type based on options.
 * @param {HTMLElement} container - DOM element containing the viewer
 * @param {object} options - Camera configuration options
 * @param {object} options.camera - Camera-specific options
 * @param {string} [options.camera.type] - Type of camera ('perspective' or 'orthographic')
 * @returns {AbstractCameraController} The created camera controller instance
 */
export function createCameraController(container, options) {
    const type = options.camera?.type || 'perspective';
    
    switch (type.toLowerCase()) {
        case 'orthographic':
            return new OrthographicCameraController(container, options.camera);
        case 'perspective':
        default:
            return new PerspectiveCameraController(container, options.camera);
    }
}