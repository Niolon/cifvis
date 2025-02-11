import * as THREE from 'three';

export class ViewerControls {
    constructor(viewer) {
        this.viewer = viewer;
        this.container = viewer.container;
        this.camera = viewer.camera;
        this.renderer = viewer.renderer;
        this.moleculeContainer = viewer.moleculeContainer;
        this.raycaster = viewer.raycaster;
        this.options = viewer.options;
        this.doubleClickDelay = 300;
        
        this.state = {
            isDragging: false,
            mouse: new THREE.Vector2(),
            lastClickTime: 0,
            clickStartTime: 0,
            pinchStartDistance: 0,
            lastTouchRotation: 0,
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('wheel', this.handleWheel.bind(this));
        canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        canvas.addEventListener('click', this.handleClick.bind(this));
        
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    updateMouseCoordinates(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        this.state.mouse.set(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
        );
    }

    handleTouchStart(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            this.state.isDragging = true;
            this.state.clickStartTime = Date.now();
            const touch = event.touches[0];
            this.updateMouseCoordinates(touch.clientX, touch.clientY);
        } else if (event.touches.length === 2) {
            this.state.isDragging = false;
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.state.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
            this.state.lastTouchRotation = Math.atan2(dy, dx);
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        const rect = this.container.getBoundingClientRect();
        
        if (event.touches.length === 1 && this.state.isDragging) {
            const touch = event.touches[0];
            const newMouse = new THREE.Vector2(
                ((touch.clientX - rect.left) / rect.width) * 2 - 1,
                -((touch.clientY - rect.top) / rect.height) * 2 + 1,
            );
            
            const delta = newMouse.clone().sub(this.state.mouse);
            this.rotateStructure(delta);
            this.state.mouse.copy(newMouse);
        } else if (event.touches.length === 2) {
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const zoomDelta = (this.state.pinchStartDistance - distance) * 0.01;
            this.handleZoom(zoomDelta);
            this.state.pinchStartDistance = distance;
            
            const rotation = Math.atan2(dy, dx);
            const rotationDelta = rotation - this.state.lastTouchRotation;
            this.moleculeContainer.rotateZ(rotationDelta);
            this.state.lastTouchRotation = rotation;
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        
        if (event.touches.length === 0) {
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - this.state.clickStartTime;
            
            if (touchDuration < this.options.interaction.clickThreshold && !this.state.isDragging) {
                this.handleTap(event.changedTouches[0]);
            }
            
            this.state.isDragging = false;
        }
    }

    handleTap(touch) {
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - this.state.lastClickTime;
        this.state.lastClickTime = currentTime;
        
        this.updateMouseCoordinates(touch.clientX, touch.clientY);
        
        this.raycaster.setFromCamera(this.state.mouse, this.camera);
        const objectsToIntersect = [];
        this.moleculeContainer.traverse((object) => {
            if (object instanceof THREE.Mesh && object.userData.selectable === true) {
                objectsToIntersect.push(object);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(objectsToIntersect)
            .filter(i => i.object.userData.selectable !== false);
        
        if (intersects.length > 0) {
            const tappedObject = intersects[0].object;
            this.viewer.selections.handle(tappedObject);
        } else if (timeSinceLastTap < this.doubleClickDelay) {
            this.viewer.selections.clear();
        }
        this.viewer.requestRender();
    }

    rotateStructure(delta) {
        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(
                new THREE.Vector3(0, 1, 0),
                delta.x * this.options.interaction.rotationSpeed,
            ),
        );
        this.moleculeContainer.applyMatrix4(
            new THREE.Matrix4().makeRotationAxis(
                new THREE.Vector3(1, 0, 0),
                -delta.y * this.options.interaction.rotationSpeed,
            ),
        );
    }

    handleZoom(zoomDelta) {
        const currentDistance = this.camera.position.distanceTo(this.viewer.cameraTarget);
        const newDistance = THREE.MathUtils.clamp(
            currentDistance + zoomDelta,
            this.options.camera.minDistance,
            this.options.camera.maxDistance,
        );
        
        const direction = this.camera.position.clone()
            .sub(this.viewer.cameraTarget)
            .normalize();
        this.camera.position.copy(direction.multiplyScalar(newDistance).add(this.viewer.cameraTarget));
        this.camera.lookAt(this.viewer.cameraTarget);
        this.viewer.requestRender();
    }

    handleResize() {
        const rect = this.container.getBoundingClientRect();
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(rect.width, rect.height);
        this.viewer.requestRender();
    }

    handleWheel(event) {
        event.preventDefault();
        this.handleZoom(event.deltaY * this.options.camera.zoomSpeed);
    }

    handleMouseMove(event) {
        if (!this.state.isDragging) {
            return; 
        }
        
        const newMouse = new THREE.Vector2();
        const rect = this.container.getBoundingClientRect();
        newMouse.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        
        const delta = newMouse.clone().sub(this.state.mouse);
        this.rotateStructure(delta);
        this.state.mouse.copy(newMouse);
        this.viewer.requestRender();
    }

    handleMouseDown(event) {
        this.state.isDragging = true;
        this.state.clickStartTime = Date.now();
        this.updateMouseCoordinates(event.clientX, event.clientY);
    }

    handleMouseUp() {
        this.state.isDragging = false;
    }

    handleClick(event) {
        const clickEndTime = Date.now();
        if (clickEndTime - this.state.clickStartTime > this.options.interaction.clickThreshold) {
            return; 
        }
        if (this.state.isDragging) {
            return; 
        }

        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - this.state.lastClickTime;
        this.state.lastClickTime = currentTime;

        this.updateMouseCoordinates(event.clientX, event.clientY);

        this.raycaster.setFromCamera(this.state.mouse, this.camera);
        const objectsToIntersect = [];
        this.moleculeContainer.traverse((object) => {
            if (object.userData.selectable === true) {
                objectsToIntersect.push(object);
            }
        });
        const intersects = this.raycaster.intersectObjects(objectsToIntersect)
            .filter((intersect) => intersect.object.userData && intersect.object.userData.selectable);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            this.viewer.selections.handle(clickedObject);
        } else if (timeSinceLastClick < this.doubleClickDelay) {
            this.viewer.selections.clear();
        }
        this.viewer.requestRender();
    }

    dispose() {
        const canvas = this.renderer.domElement;
        
        canvas.removeEventListener('wheel', this.handleWheel);
        canvas.removeEventListener('mousedown', this.handleMouseDown);
        canvas.removeEventListener('mousemove', this.handleMouseMove);
        canvas.removeEventListener('mouseup', this.handleMouseUp);
        canvas.removeEventListener('mouseleave', this.handleMouseUp);
        canvas.removeEventListener('click', this.handleClick);
        
        canvas.removeEventListener('touchstart', this.handleTouchStart);
        canvas.removeEventListener('touchmove', this.handleTouchMove);
        canvas.removeEventListener('touchend', this.handleTouchEnd);
        
        window.removeEventListener('resize', this.handleResize);
    }
}