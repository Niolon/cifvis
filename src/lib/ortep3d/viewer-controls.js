import * as THREE from 'three';

export class ViewerControls {    
    constructor(viewer) {
        this.viewer = viewer;
        this.state = {
            isDragging: false,
            isPanning: false,
            mouse: new THREE.Vector2(),
            lastClickTime: 0,
            clickStartTime: 0,
            pinchStartDistance: 0,
            lastTouchRotation: 0,
            lastRightClickTime: 0,
            twoFingerStartPos: new THREE.Vector2(),
            initialCameraPosition: viewer.camera.position.clone(),
        };

        // Cache frequently accessed properties
        const { container, camera, renderer, moleculeContainer, options } = viewer;
        this.container = container;
        this.camera = camera;
        this.renderer = renderer;
        this.moleculeContainer = moleculeContainer;
        this.options = options;
        this.doubleClickDelay = 300;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.near = 0.1;
        this.raycaster.far = 100;

        this.bindEventHandlers();
        this.setupEventListeners();
    }

    bindEventHandlers() {
        this.boundHandlers = {
            wheel: this.handleWheel.bind(this),
            mouseDown: this.handleMouseDown.bind(this),
            mouseMove: this.handleMouseMove.bind(this),
            mouseUp: this.handleMouseUp.bind(this),
            click: this.handleClick.bind(this),
            contextMenu: this.handleContextMenu.bind(this),
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this),
            resize: this.handleResize.bind(this),
        };
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;
        const { 
            wheel, mouseDown, mouseMove, mouseUp, click, contextMenu,
            touchStart, touchMove, touchEnd, resize,
        } = this.boundHandlers;

        canvas.addEventListener('wheel', wheel, { passive: false });
        canvas.addEventListener('mousedown', mouseDown);
        canvas.addEventListener('mousemove', mouseMove);
        canvas.addEventListener('mouseup', mouseUp);
        canvas.addEventListener('mouseleave', mouseUp);
        canvas.addEventListener('click', click);
        canvas.addEventListener('contextmenu', contextMenu);
        canvas.addEventListener('touchstart', touchStart, { passive: false });
        canvas.addEventListener('touchmove', touchMove, { passive: false });
        canvas.addEventListener('touchend', touchEnd);
        window.addEventListener('resize', resize);
    }

    clientToMouseCoordinates(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        return new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
        );
    }

    updateMouseCoordinates(clientX, clientY) {
        const mCoord = this.clientToMouseCoordinates(clientX, clientY);
        this.state.mouse.x = mCoord.x;
        this.state.mouse.y = mCoord.y;
    }

    handleSelection(point, timeSinceLastInteraction) {
        this.updateMouseCoordinates(point.clientX, point.clientY);
        
        this.raycaster.setFromCamera(this.state.mouse, this.camera);
        const selectableObjects = [];
        this.moleculeContainer.traverse(object => {
            if (object.userData?.selectable) {
                selectableObjects.push(object);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(selectableObjects)
            .filter(i => i.object.userData?.selectable);
        
        if (intersects.length > 0) {
            this.viewer.selections.handle(intersects[0].object);
        } else if (timeSinceLastInteraction < this.doubleClickDelay) {
            this.viewer.selections.clear();
        }
        this.viewer.requestRender();
    }

    handleMouseClick(point, timeSinceLastInteraction) {
        // Set mouse raycaster thresholds
        const mouseThresholds = this.options.interaction.mouseRaycast;
        this.raycaster.params.Line.threshold = mouseThresholds.lineThreshold;
        this.raycaster.params.Points.threshold = mouseThresholds.pointsThreshold;
        this.raycaster.params.Mesh.threshold = mouseThresholds.meshThreshold;

        this.handleSelection(point, timeSinceLastInteraction);
    }

    handleTouchSelect(point, timeSinceLastInteraction) {
        // Set touch raycaster thresholds
        const touchThresholds = this.options.interaction.touchRaycast;
        this.raycaster.params.Line.threshold = touchThresholds.lineThreshold;
        this.raycaster.params.Points.threshold = touchThresholds.pointsThreshold;
        this.raycaster.params.Mesh.threshold = touchThresholds.meshThreshold;

        this.handleSelection(point, timeSinceLastInteraction);
    }

    rotateStructure(delta) {
        const rotationSpeed = this.options.interaction.rotationSpeed;
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);

        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(yAxis, delta.x * rotationSpeed),
        );
        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(xAxis, -delta.y * rotationSpeed),
        );
        this.viewer.requestRender();
    }

    handleZoom(zoomDelta) {
        const { minDistance, maxDistance } = this.options.camera;
        const maxTravel = maxDistance - minDistance;
        const currentDistance = this.camera.position.length();
        const newDistance = THREE.MathUtils.clamp(
            currentDistance + zoomDelta * maxTravel,
            minDistance,
            maxDistance,
        );
        
        const direction = this.camera.position.clone().normalize();
        this.camera.position.copy(direction.multiplyScalar(newDistance));
        this.viewer.requestRender();
    }

    resetCameraPosition() {
        this.camera.position.x = this.state.initialCameraPosition.x;
        this.camera.position.y = this.state.initialCameraPosition.y;
        this.camera.rotation.set(0, 0, 0);
        this.viewer.requestRender();
    }

    panCamera(delta) {
        const distance = this.camera.position.z;
        
        // Calculate the size of the view frustum at the object's distance
        // Factor 2 missing from height as delta goes from -1 to 1 -> 2
        const fovRadians = this.camera.fov * Math.PI / 180;
        const frustumHeight = Math.tan(fovRadians / 2) * distance;
        const frustumWidth = frustumHeight * this.camera.aspect;
        
        // Convert screen coordinates to world space movement
        const moveX = -delta.x * frustumWidth;
        const moveY = -delta.y * frustumHeight;
        
        // Get camera's right and up vectors
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Move camera in the view plane
        this.camera.position.addScaledVector(right, moveX);
        this.camera.position.addScaledVector(up, moveY);
        
        this.viewer.requestRender();
    }

    handleTouchStart(event) {
        event.preventDefault();
        const touches = event.touches;
        
        if (touches.length === 1 && !this.state.isDragging) {
            this.state.isDragging = true;
            this.state.clickStartTime = Date.now();
            this.updateMouseCoordinates(touches[0].clientX, touches[0].clientY);
        } else if (touches.length === 2) {
            // Only initialize two-finger state if we weren't already dragging
            // This prevents jumps when a second finger is added
            if (!this.state.isDragging) {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                this.state.pinchStartDistance = Math.hypot(dx, dy);
                
                // Calculate and store centroid in normalized coordinates right away
                const startCentroid = this.clientToMouseCoordinates(
                    (touches[0].clientX + touches[1].clientX) / 2,
                    (touches[0].clientY + touches[1].clientY) / 2
                );
                this.state.twoFingerStartPos.copy(startCentroid);
            }
            this.state.isDragging = false;
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        const touches = event.touches;
        
        if (touches.length === 1 && this.state.isDragging) {
            const touch = touches[0];
            const newCoord = this.clientToMouseCoordinates(touch.clientX, touch.clientY);
            const delta = new THREE.Vector2(
                newCoord.x - this.state.mouse.x,
                newCoord.y - this.state.mouse.y,
            );
            
            this.rotateStructure(delta);
            this.state.mouse.set(newCoord.x, newCoord.y);
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const distance = Math.hypot(dx, dy);

            // Initialize two-finger state if it wasn't set
            if (!this.state.pinchStartDistance) {
                this.state.pinchStartDistance = distance;
                
                const startCentroid = this.clientToMouseCoordinates(
                    (touches[0].clientX + touches[1].clientX) / 2,
                    (touches[0].clientY + touches[1].clientY) / 2
                );
                this.state.twoFingerStartPos.copy(startCentroid);
                return; // Skip this frame to avoid jumps
            }
            
            // Handle pinch zoom
            this.handleZoom((this.state.pinchStartDistance - distance) * this.options.camera.pinchZoomSpeed);
            this.state.pinchStartDistance = distance;
            
            const currentCentroid = this.clientToMouseCoordinates(
                (touches[0].clientX + touches[1].clientX) / 2,
                (touches[0].clientY + touches[1].clientY) / 2
            );
            
            const delta = currentCentroid.clone().sub(this.state.twoFingerStartPos);
            this.panCamera(delta);
            this.state.twoFingerStartPos.copy(currentCentroid);
        }
    }

    handleTouchEnd(event) {
        if (event.cancelable) {
            event.preventDefault();
        }
        
        if (event.touches.length === 0 && event.changedTouches.length > 0) {
            const touchDuration = Date.now() - this.state.clickStartTime;
            
            if (touchDuration < this.options.interaction.clickThreshold) {
                const touch = event.changedTouches[0];
                const currentTime = Date.now();
                
                // Create a synthetic mouse event for selection
                const fakeEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                };
                
                this.handleTouchSelect(fakeEvent, currentTime - this.state.lastClickTime);
                this.state.lastClickTime = currentTime;
            }
            
            this.state.isDragging = false;
            this.state.pinchStartDistance = 0;  // Reset pinch distance when ending gesture
        }
    }

    handleContextMenu(event) {
        event.preventDefault();
        const currentTime = Date.now();
        const timeSinceLastRightClick = currentTime - this.state.lastRightClickTime;
        
        if (timeSinceLastRightClick < this.doubleClickDelay) {
            this.resetCameraPosition();
        }
        
        this.state.lastRightClickTime = currentTime;
    }

    handleMouseDown(event) {
        if (event.button === 2) {
            this.state.isPanning = true;
        } else {
            this.state.isDragging = true;
        }
        this.state.clickStartTime = Date.now();
        this.updateMouseCoordinates(event.clientX, event.clientY);
    }

    handleMouseMove(event) {
        if (!this.state.isDragging && !this.state.isPanning) {
            return;
        }
        
        const rect = this.container.getBoundingClientRect();
        const newMouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        
        const delta = newMouse.clone().sub(this.state.mouse);
        
        if (this.state.isPanning) {
            this.panCamera(delta);
        } else {
            this.rotateStructure(delta);
        }
        
        this.state.mouse.copy(newMouse);
    }

    handleMouseUp() {
        this.state.isDragging = false;
        this.state.isPanning = false;
    }

    handleClick(event) {
        if (event.button !== 0) {
            return; 
        } // Only handle left clicks
        
        const clickDuration = Date.now() - this.state.clickStartTime;
        if (clickDuration > this.options.interaction.clickThreshold || this.state.isDragging) {
            return;
        }

        const currentTime = Date.now();
        this.handleMouseClick(event, currentTime - this.state.lastClickTime);
        this.state.lastClickTime = currentTime;
    }

    handleWheel(event) {
        event.preventDefault();
        this.handleZoom(event.deltaY * this.options.camera.wheelZoomSpeed);
    }

    handleResize() {
        const rect = this.container.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        this.camera.aspect = aspect;

        // Calculate field of view to fit object based on smallest dimension
        const targetFov = this.options.camera.fov;
        
        if (rect.width < rect.height) {
            // Width is limiting factor, adjust FOV to maintain object size
            this.camera.fov = 2 * Math.atan(Math.tan(targetFov * Math.PI / 360) / aspect) * 180 / Math.PI;
        } else {
            // Height is limiting factor, use target FOV directly
            this.camera.fov = targetFov;
        }

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(rect.width, rect.height);
        this.viewer.requestRender();
    }

    dispose() {
        const canvas = this.renderer.domElement;
        const {
            wheel, mouseDown, mouseMove, mouseUp, click, contextMenu,
            touchStart, touchMove, touchEnd, resize,
        } = this.boundHandlers;

        canvas.removeEventListener('wheel', wheel);
        canvas.removeEventListener('mousedown', mouseDown);
        canvas.removeEventListener('mousemove', mouseMove);
        canvas.removeEventListener('mouseup', mouseUp);
        canvas.removeEventListener('mouseleave', mouseUp);
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('contextmenu', contextMenu);
        canvas.removeEventListener('touchstart', touchStart);
        canvas.removeEventListener('touchmove', touchMove);
        canvas.removeEventListener('touchend', touchEnd);
        window.removeEventListener('resize', resize);
    }
}