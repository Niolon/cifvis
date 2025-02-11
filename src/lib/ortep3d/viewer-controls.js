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
            lastTwoFingerTapTime: 0,
            twoFingerTapCount: 0,
            cameraOffset: new THREE.Vector3(),
            initialCameraPosition: viewer.camera.position.clone(),
        };

        // Cache frequently accessed properties
        const { container, camera, renderer, moleculeContainer, raycaster, options } = viewer;
        this.container = container;
        this.camera = camera;
        this.renderer = renderer;
        this.moleculeContainer = moleculeContainer;
        this.raycaster = raycaster;
        this.options = options;
        this.doubleClickDelay = 300;

        this.bindEventHandlers();
        this.setupEventListeners();
    }

    bindEventHandlers() {
        // Bind event handlers once in constructor
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

        canvas.addEventListener('wheel', wheel);
        canvas.addEventListener('mousedown', mouseDown);
        canvas.addEventListener('mousemove', mouseMove);
        canvas.addEventListener('mouseup', mouseUp);
        canvas.addEventListener('mouseleave', mouseUp);
        canvas.addEventListener('click', click);
        canvas.addEventListener('contextmenu', contextMenu);
        canvas.addEventListener('touchstart', touchStart);
        canvas.addEventListener('touchmove', touchMove);
        canvas.addEventListener('touchend', touchEnd);
        window.addEventListener('resize', resize);
    }

    updateMouseCoordinates(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        this.state.mouse.set(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
        );
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

    rotateStructure(delta) {
        const rotationSpeed = this.options.interaction.rotationSpeed;
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);

        // Apply rotations separately to ensure proper matrix multiplication
        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(yAxis, delta.x * rotationSpeed)
        );
        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(xAxis, -delta.y * rotationSpeed)
        );
    }

    handleZoom(zoomDelta) {
        const { minDistance, maxDistance } = this.options.camera;
        const currentDistance = this.camera.position.distanceTo(this.viewer.cameraTarget);
        const newDistance = THREE.MathUtils.clamp(
            currentDistance + zoomDelta,
            minDistance,
            maxDistance,
        );
        
        const direction = this.camera.position.clone()
            .sub(this.viewer.cameraTarget)
            .normalize()
            .multiplyScalar(newDistance);
            
        this.camera.position.copy(direction.add(this.viewer.cameraTarget));
        this.camera.lookAt(this.viewer.cameraTarget);
        this.viewer.requestRender();
    }

    handleTouchStart(event) {
        event.preventDefault();
        const touches = event.touches;
        const currentTime = Date.now();
        
        if (touches.length === 1) {
            if (currentTime - this.state.lastTwoFingerTapTime < this.doubleClickDelay) {
                // Quick single touch after two-finger tap - start panning
                this.state.isPanning = true;
                this.state.isDragging = false;
            } else {
                this.state.isPanning = false;
                this.state.isDragging = true;
            }
            this.state.clickStartTime = currentTime;
            this.updateMouseCoordinates(touches[0].clientX, touches[0].clientY);
        } else if (touches.length === 2) {
            this.state.isDragging = false;
            this.state.isPanning = false;
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            this.state.pinchStartDistance = Math.hypot(dx, dy);
            this.state.lastTouchRotation = Math.atan2(dy, dx);
            
            // Track two-finger taps for camera reset
            if (currentTime - this.state.lastTwoFingerTapTime < this.doubleClickDelay) {
                this.state.twoFingerTapCount++;
                if (this.state.twoFingerTapCount === 2) {
                    this.resetCameraPosition();
                    this.state.twoFingerTapCount = 0;
                }
            } else {
                this.state.twoFingerTapCount = 1;
            }
            this.state.lastTwoFingerTapTime = currentTime;
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        const touches = event.touches;
        
        if (touches.length === 1 && (this.state.isDragging || this.state.isPanning)) {
            const touch = touches[0];
            const rect = this.container.getBoundingClientRect();
            const newMouse = new THREE.Vector2(
                ((touch.clientX - rect.left) / rect.width) * 2 - 1,
                -((touch.clientY - rect.top) / rect.height) * 2 + 1,
            );
            
            const delta = newMouse.clone().sub(this.state.mouse);
            if (this.state.isPanning) {
                this.panCamera(delta);
            } else {
                this.rotateStructure(delta);
            }
            this.state.mouse.copy(newMouse);
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            
            // Handle pinch zoom
            this.handleZoom((this.state.pinchStartDistance - distance) * 0.01);
            this.state.pinchStartDistance = distance;
            
            // Handle rotation
            const rotation = Math.atan2(dy, dx);
            this.moleculeContainer.rotateZ(rotation - this.state.lastTouchRotation);
            this.state.lastTouchRotation = rotation;
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        if (event.touches.length === 0) {
            const touchDuration = Date.now() - this.state.clickStartTime;
            
            if (touchDuration < this.options.interaction.clickThreshold && !this.state.isDragging) {
                const currentTime = Date.now();
                this.handleSelection(
                    event.changedTouches[0], 
                    currentTime - this.state.lastClickTime,
                );
                this.state.lastClickTime = currentTime;
            }
            this.state.isDragging = false;
        }
    }

    handleContextMenu(event) {
        event.preventDefault();
        const currentTime = Date.now();
        const timeSinceLastRightClick = currentTime - this.state.lastRightClickTime;
        
        if (timeSinceLastRightClick < this.doubleClickDelay) {
            // Double right click - reset camera position
            this.resetCameraPosition();
        }
        
        this.state.lastRightClickTime = currentTime;
    }

    resetCameraPosition() {
        // Reset camera to initial position
        this.camera.position.copy(this.state.initialCameraPosition);
        this.camera.rotation.set(0, 0, 0);
        this.viewer.requestRender();
    }

    panCamera(delta) {
        // Scale the movement based on camera distance
        const distance = this.camera.position.length();
        const scale = distance * 0.002; // Adjust this value to change pan sensitivity
        
        // Create offset in camera's local space
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Move camera directly without affecting the look direction
        const moveX = -delta.x * scale;
        const moveY = delta.y * scale;
        
        this.camera.position.addScaledVector(right, moveX);
        this.camera.position.addScaledVector(up, moveY);
        
        this.viewer.requestRender();
    }

    handleMouseDown(event) {
        if (event.button === 2) { // Right mouse button
            this.state.isPanning = true;
        } else {
            this.state.isDragging = true;
        }
        this.state.clickStartTime = Date.now();
        this.updateMouseCoordinates(event.clientX, event.clientY);
    }

    handleMouseMove(event) {
        if (!this.state.isDragging && !this.state.isPanning) return;
        
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
        this.viewer.requestRender();
    }

    handleMouseUp() {
        this.state.isDragging = false;
        this.state.isPanning = false;
    }

    handleClick(event) {
        const clickDuration = Date.now() - this.state.clickStartTime;
        if (clickDuration > this.options.interaction.clickThreshold || this.state.isDragging) {
            return;
        }

        const currentTime = Date.now();
        this.handleSelection(event, currentTime - this.state.lastClickTime);
        this.state.lastClickTime = currentTime;
    }

    handleWheel(event) {
        event.preventDefault();
        this.handleZoom(event.deltaY * this.options.camera.zoomSpeed);
    }

    handleResize() {
        const rect = this.container.getBoundingClientRect();
        this.camera.aspect = rect.width / rect.height;
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

        canvas.removeEventListener('touchstart', touchStart);
        canvas.removeEventListener('touchmove', touchMove);
        canvas.removeEventListener('touchend', touchEnd);
        window.removeEventListener('resize', resize);
    }
}