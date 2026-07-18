import * as THREE from 'three';
import { chemicalBonds } from '../structure/bond-classification.js';
import { inferElementFromLabel } from '../structure/crystal.js';
import { layoutAtomLabels } from './atom-label-layout.js';
import AtomLabelWorker from './atom-label-worker.js?worker&inline';
import defaultSettings from './structure-settings.js';
import {
    liftColorLuminance,
    paletteLuminanceLift,
    paletteLuminanceScale,
    scaleColorLuminance,
} from './color-utils.js';

const layoutOptionKeys = [
    'atomPadding',
    'autoPerformanceLabelThreshold',
    'calloutChoiceLimit',
    'calloutColumnGap',
    'calloutColumns',
    'calloutGap',
    'calloutPlacement',
    'calloutRowGap',
    'calloutSearchLimit',
    'maximumCoverageDistanceSteps',
    'fallbackDistance',
    'performanceNoSpaceCellSize',
    'labelPadding',
    'leaderBondCrossingPenalty',
    'leaderWidth',
    'maxVisible',
    'maxConnectorLength',
    'movementPenalty',
    'placementMode',
    'repairDepth',
    'repairSearchLimit',
    'ringPenalty',
    'spatialCellSize',
    'viewportPadding',
];

/**
 * Copies only structured-clone-safe solver options into a worker request.
 * @param {object} options - Complete atom-label options
 * @returns {object} Collision-layout options
 */
function pickLayoutOptions(options) {
    return Object.fromEntries(layoutOptionKeys.map(key => [key, options[key]]));
}

/**
 * Normalizes the public label selection option.
 * @param {unknown} show - User-provided selection
 * @returns {'all'|'non-hydrogen'|'none'|Array} Normalized selection
 */
function normalizeShow(show) {
    if (Array.isArray(show)) {
        return show;
    }
    if (show === 'all' || show === 'non-hydrogen' || show === 'none') {
        return show;
    }
    return 'none';
}

/**
 * Normalizes array label requests to object form.
 * @param {Array} show - User requests
 * @returns {Array<object>} Normalized requests
 */
function normalizeRequestedLabels(show) {
    if (!Array.isArray(show)) {
        return [];
    }
    return show.map(item => typeof item === 'string' ? { id: item } : item)
        .filter(item => item && typeof item.id === 'string');
}

/**
 * Calculates the shared scale for the configured atom-colour palette.
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number} ceiling - Palette relative-luminance ceiling
 * @returns {number} Shared linear RGB scale
 */
export function atomLabelPaletteLuminanceScale(elementProperties, ceiling) {
    return paletteLuminanceScale(collectAtomLabelPalette(elementProperties), ceiling);
}

/**
 * Calculates the shared white-mix lift for the configured atom-colour palette
 * against a relative-luminance floor (dark backgrounds).
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number} floor - Palette relative-luminance floor
 * @returns {number} Shared white-mix fraction
 */
export function atomLabelPaletteLuminanceLift(elementProperties, floor) {
    return paletteLuminanceLift(collectAtomLabelPalette(elementProperties), floor);
}

/**
 * Collects the active atom-colour palette across default and custom elements.
 * @param {object} elementProperties - Active per-element viewer properties
 * @returns {string[]} Palette colours
 */
function collectAtomLabelPalette(elementProperties) {
    const activeElementProperties = elementProperties || {};
    const paletteSymbols = new Set([
        ...Object.keys(defaultSettings.elementProperties),
        ...Object.keys(activeElementProperties),
    ]);
    return [...paletteSymbols]
        .map(symbol => activeElementProperties[symbol]?.atomColor ??
            defaultSettings.elementProperties[symbol]?.atomColor)
        .filter(Boolean);
}

/**
 * Resolves one label's text colour, optionally following its atom colour with
 * a palette-wide luminance scale for readability against the halo/background.
 * @param {object} atom - Atom represented by the label
 * @param {object} options - Atom-label display options
 * @param {object} elementProperties - Active per-element viewer properties
 * @param {number|null} [paletteScale] - Precomputed shared palette scale
 * @returns {string} CSS colour string
 */
export function resolveAtomLabelColor(atom, options, elementProperties, paletteScale = null) {
    if (options.colorMode !== 'atom') {
        return options.color;
    }
    const activeElementProperties = elementProperties || {};
    let elementType = atom.atomType;
    if (!activeElementProperties[elementType] && !defaultSettings.elementProperties[elementType]) {
        elementType = inferElementFromLabel(atom.atomType);
    }
    const atomColor = activeElementProperties[elementType]?.atomColor ??
        defaultSettings.elementProperties[elementType]?.atomColor;
    if (!atomColor) {
        return options.color;
    }
    const floor = options.atomColorLuminanceFloor;
    let color;
    let identity;
    if (floor !== null && floor !== undefined) {
        // A configured floor replaces the ceiling: brighten the palette
        // towards white for dark backgrounds instead of darkening it.
        const lift = paletteScale ?? atomLabelPaletteLuminanceLift(activeElementProperties, floor);
        color = liftColorLuminance(atomColor, lift);
        identity = lift === 0;
    } else {
        const scale = paletteScale ?? atomLabelPaletteLuminanceScale(
            activeElementProperties,
            options.atomColorLuminanceCeiling,
        );
        color = scaleColorLuminance(atomColor, scale);
        identity = scale === 1;
    }
    if (identity) {
        return `#${color.getHexString(THREE.SRGBColorSpace)}`;
    }
    const srgb = color.clone().convertLinearToSRGB();
    const channels = [srgb.r, srgb.g, srgb.b]
        .map(channel => Math.floor(THREE.MathUtils.clamp(channel, 0, 1) * 255))
        .map(channel => channel.toString(16).padStart(2, '0'));
    return `#${channels.join('')}`;
}

/**
 * Matches either a base CIF label or a symmetry-qualified atom ID.
 * @param {string} selector - Atom selector
 * @param {object} atom - Atom data
 * @returns {boolean} Whether the selector matches
 */
function selectorMatches(selector, atom) {
    return selector.includes('|') ? selector === atom.uniqueId : selector === atom.label;
}

/**
 * Calculates the unsigned area of a screen-space polygon.
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {number} Area in CSS pixels squared
 */
function polygonArea(polygon) {
    let area = 0;
    for (let index = 0; index < polygon.length; index++) {
        const next = (index + 1) % polygon.length;
        area += polygon[index].x * polygon[next].y - polygon[next].x * polygon[index].y;
    }
    return Math.abs(area) / 2;
}

/**
 * Tests whether any part of a projected atom remains inside the viewport.
 * @param {{x: number, y: number, z: number, radius: number}} anchor - Projected atom footprint
 * @param {{width: number, height: number}} viewport - CSS-pixel viewport
 * @returns {boolean} Whether the atom can currently be seen
 */
export function projectedAtomIntersectsViewport(anchor, viewport) {
    return anchor.z >= -1 && anchor.z <= 1 &&
        anchor.x + anchor.radius >= 0 && anchor.x - anchor.radius <= viewport.width &&
        anchor.y + anchor.radius >= 0 && anchor.y - anchor.radius <= viewport.height;
}

/**
 * Finds chordless five-to-seven-member cycles in a structure's chemical graph.
 * This is a bounded geometric hint, not an aromaticity assignment.
 * @param {object} structure - Displayed structure
 * @returns {Array<string[]>} Rings represented by ordered atom IDs
 */
export function findSmallRings(structure) {
    if (!structure) {
        return [];
    }
    const atomsById = new Map(structure.atoms.map(atom => [atom.uniqueId, atom]));
    const atomIds = [...atomsById.keys()].sort();
    const order = new Map(atomIds.map((id, index) => [id, index]));
    const graph = new Map(atomIds.map(id => [id, new Set()]));
    for (const bond of chemicalBonds(structure)) {
        if (graph.has(bond.atom1Id) && graph.has(bond.atom2Id)) {
            graph.get(bond.atom1Id).add(bond.atom2Id);
            graph.get(bond.atom2Id).add(bond.atom1Id);
        }
    }

    const rings = [];
    const seen = new Set();
    for (const start of atomIds) {
        const path = [start];
        const visited = new Set(path);
        const visit = current => {
            if (path.length > 7 || rings.length >= 512) {
                return;
            }
            for (const next of graph.get(current)) {
                if (next === start && path.length >= 5) {
                    const cycle = [...path];
                    let edgeCount = 0;
                    for (const id of cycle) {
                        edgeCount += [...graph.get(id)].filter(neighbour => cycle.includes(neighbour)).length;
                    }
                    if (edgeCount !== cycle.length * 2) {
                        continue;
                    }
                    const key = [...cycle].sort().join('|');
                    if (!seen.has(key)) {
                        seen.add(key);
                        rings.push(cycle);
                    }
                } else if (!visited.has(next) && order.get(next) >= order.get(start)) {
                    visited.add(next);
                    path.push(next);
                    visit(next);
                    path.pop();
                    visited.delete(next);
                }
            }
        };
        visit(start);
    }
    return rings;
}

/**
 * Owns the transparent label canvas and updates its projected label layout.
 */
export class AtomLabelManager {
    /**
     * @param {object} viewer - Owning viewer
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.options = viewer.options.atomLabels;
        this.previousPlacements = new Map();
        this.layout = { placed: [], hidden: [], placementPolicy: 'none' };
        this.rings = null;
        this.displayStructure = null;
        this.bondNeighbours = new Map();
        this.measurementCache = new Map();
        this.atomLabelColorCache = new Map();
        this.atomLabelColorScale = null;
        this.lastLayoutTime = 0;
        this.forceNextLayout = true;
        this.lastMoleculeMatrix = null;
        this.lastCameraMatrix = null;
        this.lastProjectionMatrix = null;
        this.lastViewport = null;
        this.layoutRevision = 0;
        this.lastLayoutRevision = 0;
        this.nextWorkerRequestId = 1;
        this.worker = null;
        this.workerUnavailable = false;
        this.pendingLayout = null;
        this.layoutQueued = false;
        this.layoutWaiters = [];
        this.scheduledFrame = null;
        this.disposed = false;
        this.lastExecutionMode = 'none';
        this.loadingIndicatorActive = false;
        this.loadingIndicatorTimer = null;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cifvis-atom-labels';
        this.canvas.setAttribute('aria-hidden', 'true');
        Object.assign(this.canvas.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '1',
        });
        if (window.getComputedStyle(viewer.container).position === 'static') {
            this.changedContainerPosition = true;
            this.previousContainerPosition = viewer.container.style.position;
            viewer.container.style.position = 'relative';
        }
        viewer.container.appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');

        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'cifvis-atom-label-loading';
        this.loadingIndicator.setAttribute('role', 'status');
        this.loadingIndicator.setAttribute('aria-live', 'polite');
        Object.assign(this.loadingIndicator.style, {
            position: 'absolute',
            right: '12px',
            bottom: '12px',
            display: 'none',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 9px',
            border: '1px solid rgba(0, 0, 0, 0.14)',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.92)',
            color: '#333333',
            font: '12px system-ui, -apple-system, sans-serif',
            pointerEvents: 'none',
            zIndex: '2',
        });
        const progress = document.createElement('progress');
        progress.removeAttribute('value');
        progress.setAttribute('aria-hidden', 'true');
        Object.assign(progress.style, { width: '32px', height: '8px' });
        this.loadingIndicator.append(progress, document.createTextNode('Laying out labels…'));
        viewer.container.appendChild(this.loadingIndicator);
    }

    setOptions(options) {
        this.options = options;
        if (!options.showLoadingIndicator || normalizeShow(options.show) === 'none') {
            this.endLoadingIndicator();
        }
        this.previousPlacements.clear();
        this.measurementCache.clear();
        this.atomLabelColorCache.clear();
        this.atomLabelColorScale = null;
        this.invalidateLayout();
    }

    setStructure(structure) {
        this.endLoadingIndicator();
        this.displayStructure = structure;
        this.rings = null;
        this.bondNeighbours.clear();
        this.previousPlacements.clear();
        this.invalidateLayout();
    }

    prepareTopology() {
        if (this.rings !== null) {
            return;
        }
        this.rings = findSmallRings(this.displayStructure);
        this.bondNeighbours = new Map(
            this.displayStructure.atoms.map(atom => [atom.uniqueId, new Set()]),
        );
        for (const bond of this.displayStructure.bonds) {
            if (this.bondNeighbours.has(bond.atom1Id) && this.bondNeighbours.has(bond.atom2Id)) {
                this.bondNeighbours.get(bond.atom1Id).add(bond.atom2Id);
                this.bondNeighbours.get(bond.atom2Id).add(bond.atom1Id);
            }
        }
    }

    invalidateLayout() {
        this.forceNextLayout = true;
        this.layoutRevision++;
    }

    beginLoadingIndicator() {
        if (!this.options.showLoadingIndicator || this.loadingIndicatorActive) {
            return;
        }
        this.loadingIndicatorActive = true;
        const show = () => {
            this.loadingIndicatorTimer = null;
            if (this.loadingIndicatorActive && !this.disposed) {
                this.loadingIndicator.style.display = 'flex';
            }
        };
        const delay = Math.max(0, this.options.loadingIndicatorDelayMs ?? 120);
        if (delay === 0) {
            show();
        } else {
            this.loadingIndicatorTimer = setTimeout(show, delay);
        }
    }

    endLoadingIndicator() {
        this.loadingIndicatorActive = false;
        if (this.loadingIndicatorTimer !== null) {
            clearTimeout(this.loadingIndicatorTimer);
            this.loadingIndicatorTimer = null;
        }
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    /**
     * Schedules label preparation after the current browser paint. Repeated
     * render requests collapse into one layout and no worker backlog is built.
     */
    scheduleUpdate() {
        if (this.disposed) {
            return;
        }
        const interacting = this.viewer.controls?.isInteracting?.() ??
            (this.viewer.controls?.state.isDragging || this.viewer.controls?.state.isPanning);
        if (interacting) {
            this.endLoadingIndicator();
        }
        this.clearStaleFrame();
        if (this.pendingLayout) {
            this.layoutQueued = true;
            return;
        }
        if (this.scheduledFrame !== null) {
            return;
        }
        this.scheduledFrame = requestAnimationFrame(() => {
            this.scheduledFrame = null;
            void this.update();
        });
    }

    /**
     * Removes labels drawn for an old camera or molecule pose immediately.
     * Waiting for an asynchronous replacement here would leave a visible
     * after-image during rotation.
     */
    clearStaleFrame() {
        if (!this.context || this.layout.placed.length === 0 ||
            !this.lastMoleculeMatrix || !this.lastCameraMatrix ||
            !this.lastProjectionMatrix) {
            return;
        }
        const width = this.viewer.container.clientWidth;
        const height = this.viewer.container.clientHeight;
        const transformChanged = this.lastViewport?.width !== width ||
            this.lastViewport?.height !== height ||
            this.lastLayoutRevision !== this.layoutRevision ||
            !this.lastMoleculeMatrix.equals(this.viewer.moleculeContainer.matrixWorld) ||
            !this.lastCameraMatrix.equals(this.viewer.camera.matrixWorld) ||
            !this.lastProjectionMatrix.equals(this.viewer.camera.projectionMatrix);
        if (!transformChanged) {
            return;
        }
        const dpr = window.devicePixelRatio || 1;
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.context.clearRect(0, 0, width, height);
    }

    transformsUnchanged(width, height) {
        return !this.forceNextLayout && this.lastViewport?.width === width &&
            this.lastViewport?.height === height &&
            this.lastMoleculeMatrix?.equals(this.viewer.moleculeContainer.matrixWorld) &&
            this.lastCameraMatrix?.equals(this.viewer.camera.matrixWorld) &&
            this.lastProjectionMatrix?.equals(this.viewer.camera.projectionMatrix);
    }

    rememberTransforms(width, height) {
        this.lastViewport = { width, height };
        this.lastMoleculeMatrix = this.viewer.moleculeContainer.matrixWorld.clone();
        this.lastCameraMatrix = this.viewer.camera.matrixWorld.clone();
        this.lastProjectionMatrix = this.viewer.camera.projectionMatrix.clone();
        this.forceNextLayout = false;
    }

    captureLayoutState(width, height) {
        return {
            width,
            height,
            revision: this.layoutRevision,
            moleculeMatrix: this.viewer.moleculeContainer.matrixWorld.clone(),
            cameraMatrix: this.viewer.camera.matrixWorld.clone(),
            projectionMatrix: this.viewer.camera.projectionMatrix.clone(),
        };
    }

    layoutStateIsCurrent(state) {
        return state.revision === this.layoutRevision &&
            state.width === this.viewer.container.clientWidth &&
            state.height === this.viewer.container.clientHeight &&
            state.moleculeMatrix.equals(this.viewer.moleculeContainer.matrixWorld) &&
            state.cameraMatrix.equals(this.viewer.camera.matrixWorld) &&
            state.projectionMatrix.equals(this.viewer.camera.projectionMatrix);
    }

    getWorker() {
        if (this.options.useWorker === false || this.workerUnavailable ||
            typeof Worker === 'undefined') {
            return null;
        }
        if (this.worker) {
            return this.worker;
        }
        try {
            this.worker = new AtomLabelWorker({
                name: 'cifvis-atom-label-layout',
            });
            this.worker.onmessage = event => this.handleWorkerMessage(event.data);
            this.worker.onerror = event => {
                event.preventDefault?.();
                this.handleWorkerFailure(new Error(event.message || 'Atom-label worker failed'));
            };
            return this.worker;
        } catch (error) {
            this.workerUnavailable = true;
            console.warn('Atom-label worker unavailable; using main-thread layout.', error);
            return null;
        }
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const width = this.viewer.container.clientWidth;
        const height = this.viewer.container.clientHeight;
        const pixelWidth = Math.floor(width * dpr);
        const pixelHeight = Math.floor(height * dpr);
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        }
    }

    resolveRequests() {
        const structure = this.displayStructure;
        const show = normalizeShow(this.options.show);
        if (!structure || show === 'none') {
            return [];
        }
        if (show === 'all' || show === 'non-hydrogen') {
            return structure.atoms
                .filter(atom => show === 'all' || !['H', 'D'].includes(atom.atomType))
                .map(atom => ({ atom, text: this.options.text?.[atom.uniqueId] ??
                    this.options.text?.[atom.label] ?? atom.label, priority: 0 }))
                .filter(request => request.text !== null && String(request.text).length > 0)
                .map(request => ({ ...request, text: String(request.text).slice(0, 200) }));
        }

        const requests = normalizeRequestedLabels(show);
        const resolved = [];
        for (const atom of structure.atoms) {
            const request = requests.find(item => selectorMatches(item.id, atom));
            if (!request) {
                continue;
            }
            const text = request.text ?? this.options.text?.[atom.uniqueId] ??
                this.options.text?.[atom.label] ?? atom.label;
            if (text !== null && String(text).length > 0) {
                resolved.push({ atom, text: String(text).slice(0, 200), priority: request.priority || 0 });
            }
        }
        return resolved;
    }

    projectLocalPosition(position) {
        const world = position.clone().applyMatrix4(this.viewer.moleculeContainer.matrixWorld);
        const ndc = world.project(this.viewer.camera);
        return {
            x: (ndc.x + 1) * this.viewer.container.clientWidth / 2,
            y: (1 - ndc.y) * this.viewer.container.clientHeight / 2,
            z: ndc.z,
        };
    }

    projectRadius(position, radius) {
        const centre = this.projectLocalPosition(position);
        const extentPoints = [
            new THREE.Vector3(radius, 0, 0),
            new THREE.Vector3(0, radius, 0),
            new THREE.Vector3(0, 0, radius),
        ].map(offset => this.projectLocalPosition(position.clone().add(offset)));
        return Math.max(0, ...extentPoints.map(edge => Math.hypot(
            edge.x - centre.x,
            edge.y - centre.y,
        )));
    }

    projectAnchors() {
        const anchors = this.viewer.state.currentStructure?.atomLabelAnchors || [];
        const projected = new Map();
        for (const anchor of anchors) {
            const centre = this.projectLocalPosition(anchor.position);
            projected.set(anchor.atom.uniqueId, {
                ...centre,
                id: anchor.atom.uniqueId,
                localPosition: anchor.position,
                radius: Math.max(2, this.projectRadius(anchor.position, anchor.radius)),
            });
        }
        return projected;
    }

    projectBonds(projectedAnchors) {
        const obstacles = [];
        const addBond = (atom1Id, atom2Id, radius, type) => {
            const atom1 = projectedAnchors.get(atom1Id);
            const atom2 = projectedAnchors.get(atom2Id);
            if (!atom1 || !atom2 || atom1.z < -1 || atom1.z > 1 || atom2.z < -1 || atom2.z > 1) {
                return;
            }
            const midpoint = atom1.localPosition.clone().add(atom2.localPosition).multiplyScalar(0.5);
            obstacles.push({
                x1: atom1.x,
                y1: atom1.y,
                x2: atom2.x,
                y2: atom2.y,
                radius: this.projectRadius(midpoint, radius) + this.options.bondPadding,
                type,
            });
        };

        for (const bond of this.displayStructure.bonds) {
            addBond(bond.atom1Id, bond.atom2Id, this.viewer.options.bondRadius, 'bond');
        }
        for (const hbond of this.displayStructure.hBonds) {
            addBond(
                hbond.hydrogenAtomId,
                hbond.acceptorAtomId,
                this.viewer.options.hbondRadius,
                'hbond',
            );
        }
        return obstacles;
    }

    preferredDirection(atom, projectedAnchors) {
        const centre = projectedAnchors.get(atom.uniqueId);
        const neighbours = [...(this.bondNeighbours.get(atom.uniqueId) || [])]
            .map(id => projectedAnchors.get(id))
            .filter(Boolean);
        let x = 0;
        let y = 0;
        for (const neighbour of neighbours) {
            const dx = neighbour.x - centre.x;
            const dy = neighbour.y - centre.y;
            const length = Math.hypot(dx, dy) || 1;
            x -= dx / length;
            y -= dy / length;
        }
        const length = Math.hypot(x, y);
        if (length > 0.1) {
            return { x: x / length, y: y / length };
        }
        let hash = 0;
        for (const character of atom.uniqueId) {
            hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        }
        const angle = (hash % 16) * Math.PI / 8;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    }

    projectRings(projectedAnchors) {
        return this.rings.map(ring => ring.map(id => projectedAnchors.get(id)))
            .filter(polygon => polygon.every(Boolean) && polygonArea(polygon) >= 25);
    }

    /**
     * Returns the cached display colour for an atom label.
     * @param {object} atom - Displayed atom
     * @returns {string} CSS colour
     */
    getAtomLabelColor(atom) {
        if (this.options.colorMode !== 'atom') {
            return this.options.color;
        }
        const key = atom.atomType;
        this.atomLabelColorCache ||= new Map();
        const floor = this.options.atomColorLuminanceFloor;
        this.atomLabelColorScale ??= floor !== null && floor !== undefined
            ? atomLabelPaletteLuminanceLift(this.viewer.options.elementProperties, floor)
            : atomLabelPaletteLuminanceScale(
                this.viewer.options.elementProperties,
                this.options.atomColorLuminanceCeiling,
            );
        if (!this.atomLabelColorCache.has(key)) {
            this.atomLabelColorCache.set(key, resolveAtomLabelColor(
                atom,
                this.options,
                this.viewer.options.elementProperties,
                this.atomLabelColorScale,
            ));
        }
        return this.atomLabelColorCache.get(key);
    }

    /**
     * Projects and measures labels, then delegates collision placement to a
     * worker when available.
     * @returns {Promise<object>} The accepted current layout
     */
    update() {
        if (!this.context) {
            return this.completeUpdate(this.layout);
        }
        if (this.pendingLayout) {
            this.layoutQueued = true;
            return new Promise(resolve => this.layoutWaiters.push(resolve));
        }
        this.resize();
        const width = this.viewer.container.clientWidth;
        const height = this.viewer.container.clientHeight;
        this.viewer.camera.updateMatrixWorld();
        this.viewer.moleculeContainer.updateMatrixWorld(true);
        const now = performance.now();
        const interacting = this.viewer.controls?.isInteracting?.() ??
            (this.viewer.controls?.state.isDragging || this.viewer.controls?.state.isPanning);
        const requests = this.resolveRequests();
        const deferUntilInteractionEnds = interacting &&
            (this.options.placementMode === 'maximum-coverage' ||
                requests.length > this.options.interactionLabelLimit);
        if (deferUntilInteractionEnds) {
            this.endLoadingIndicator();
            if (this.options.hideLabelsDuringDeferredLayout) {
                this.canvas.style.visibility = 'hidden';
            }
            return this.completeUpdate(this.layout);
        }
        this.canvas.style.visibility = 'visible';
        if (this.transformsUnchanged(width, height)) {
            return this.completeUpdate(this.layout);
        }
        if (interacting && !this.forceNextLayout &&
            now - this.lastLayoutTime < this.options.layoutThrottleMs) {
            return this.completeUpdate(this.layout);
        }
        this.lastLayoutTime = now;
        const dpr = window.devicePixelRatio || 1;
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (requests.length === 0) {
            this.endLoadingIndicator();
            this.layout = { placed: [], hidden: [], placementPolicy: 'none' };
            this.context.clearRect(0, 0, width, height);
            this.rememberTransforms(width, height);
            return this.completeUpdate(this.layout);
        }
        const projectedAnchors = this.projectAnchors();
        const visibleRequests = requests.filter(request => {
            const anchor = projectedAnchors.get(request.atom.uniqueId);
            return anchor && projectedAtomIntersectsViewport(anchor, { width, height });
        });
        if (visibleRequests.length === 0) {
            this.endLoadingIndicator();
            this.layout = { placed: [], hidden: [], placementPolicy: 'none' };
            this.context.clearRect(0, 0, width, height);
            this.rememberTransforms(width, height);
            return this.completeUpdate(this.layout);
        }
        this.beginLoadingIndicator();
        this.prepareTopology();
        const font = `${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        this.context.font = font;
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        const labels = visibleRequests.map(request => {
            const anchor = projectedAnchors.get(request.atom.uniqueId);
            const measurementKey = `${font}\u0000${request.text}`;
            let measuredWidth = this.measurementCache.get(measurementKey);
            if (measuredWidth === undefined) {
                measuredWidth = this.context.measureText(request.text).width;
                this.measurementCache.set(measurementKey, measuredWidth);
            }
            return {
                id: request.atom.uniqueId,
                text: request.text,
                color: this.getAtomLabelColor(request.atom),
                x: anchor.x,
                y: anchor.y,
                z: anchor.z,
                radius: anchor.radius,
                width: measuredWidth,
                height: this.options.fontSize * 1.2,
                priority: request.priority,
                preferredDirection: this.preferredDirection(request.atom, projectedAnchors),
            };
        });
        const obstacles = [...projectedAnchors.values()]
            .filter(anchor => anchor.z >= -1 && anchor.z <= 1)
            .map(anchor => ({
                id: anchor.id,
                x: anchor.x,
                y: anchor.y,
                radius: anchor.radius + this.options.atomPadding,
            }));
        const input = {
            labels,
            atoms: obstacles,
            bonds: this.projectBonds(projectedAnchors),
            rings: this.projectRings(projectedAnchors)
                .map(polygon => polygon.map(point => ({ x: point.x, y: point.y }))),
            viewport: { width, height },
            options: pickLayoutOptions(this.options),
            previousPlacements: [...this.previousPlacements.entries()],
        };
        const state = this.captureLayoutState(width, height);
        const worker = this.getWorker();
        if (!worker) {
            const layout = this.calculateLayout(input);
            this.lastExecutionMode = this.workerUnavailable ?
                'main-thread-fallback' : 'main-thread';
            this.applyLayout(layout, state);
            return this.completeUpdate(layout);
        }

        const id = this.nextWorkerRequestId++;
        this.pendingLayout = { id, input, state };
        const result = new Promise(resolve => this.layoutWaiters.push(resolve));
        worker.postMessage({ id, ...input });
        return result;
    }

    calculateLayout(input) {
        return layoutAtomLabels(
            input.labels,
            input.atoms,
            input.bonds,
            input.rings,
            input.viewport,
            input.options,
            new Map(input.previousPlacements),
        );
    }

    handleWorkerMessage(message) {
        if (!this.pendingLayout || message.id !== this.pendingLayout.id) {
            return;
        }
        if (message.error) {
            this.handleWorkerFailure(new Error(message.error));
            return;
        }

        const { state } = this.pendingLayout;
        this.pendingLayout = null;
        const stale = this.layoutQueued || !this.layoutStateIsCurrent(state);
        this.layoutQueued = false;
        if (stale) {
            this.forceNextLayout = true;
            this.scheduleUpdate();
            return;
        }
        this.applyLayout(message.layout, state);
        this.lastExecutionMode = 'worker';
        this.resolveLayoutWaiters(message.layout);
    }

    handleWorkerFailure(error) {
        const pending = this.pendingLayout;
        this.pendingLayout = null;
        this.layoutQueued = false;
        this.worker?.terminate();
        this.worker = null;
        this.workerUnavailable = true;
        if (!pending || this.disposed) {
            this.endLoadingIndicator();
            this.resolveLayoutWaiters(this.layout);
            return;
        }
        console.warn('Atom-label worker failed; using main-thread layout.', error);
        if (this.layoutStateIsCurrent(pending.state)) {
            const layout = this.calculateLayout(pending.input);
            this.lastExecutionMode = 'main-thread-fallback';
            this.applyLayout(layout, pending.state);
            this.resolveLayoutWaiters(layout);
        } else {
            this.forceNextLayout = true;
            this.scheduleUpdate();
        }
    }

    resolveLayoutWaiters(layout) {
        const waiters = this.layoutWaiters.splice(0);
        for (const resolve of waiters) {
            resolve(layout);
        }
    }

    /**
     * Settles any callers carried over from a stale worker result and completes
     * a synchronous update path.
     * @param {object} layout - Current accepted layout
     * @returns {Promise<object>} Resolved current layout
     */
    completeUpdate(layout) {
        this.resolveLayoutWaiters(layout);
        return Promise.resolve(layout);
    }

    applyLayout(layout, state) {
        this.endLoadingIndicator();
        this.layout = layout;
        this.previousPlacements = new Map(layout.placed.map(label => [label.id, label]));
        this.lastViewport = { width: state.width, height: state.height };
        this.lastMoleculeMatrix = state.moleculeMatrix;
        this.lastCameraMatrix = state.cameraMatrix;
        this.lastProjectionMatrix = state.projectionMatrix;
        this.lastLayoutRevision = state.revision;
        this.forceNextLayout = false;
        const dpr = window.devicePixelRatio || 1;
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.context.clearRect(0, 0, state.width, state.height);
        this.context.font = `${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.canvas.style.visibility = 'visible';
        this.draw();
    }

    draw() {
        const context = this.context;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        for (const label of this.layout.placed) {
            if (label.leaderLine && this.options.leaderLines !== 'none') {
                context.strokeStyle = this.options.leaderColor;
                context.lineWidth = this.options.leaderWidth;
                context.beginPath();
                context.moveTo(label.leaderSegment.x1, label.leaderSegment.y1);
                context.lineTo(label.leaderSegment.x2, label.leaderSegment.y2);
                context.stroke();
            }
            if (this.options.haloWidth > 0) {
                context.strokeStyle = this.options.haloColor;
                context.lineWidth = this.options.haloWidth * 2;
                context.strokeText(label.text, label.x, label.y);
            }
            context.fillStyle = label.color || this.options.color;
            context.fillText(label.text, label.x, label.y);
        }
    }

    dispose() {
        this.disposed = true;
        this.endLoadingIndicator();
        if (this.scheduledFrame !== null) {
            cancelAnimationFrame(this.scheduledFrame);
            this.scheduledFrame = null;
        }
        this.worker?.terminate();
        this.worker = null;
        this.pendingLayout = null;
        this.resolveLayoutWaiters(this.layout);
        this.canvas.remove();
        this.loadingIndicator.remove();
        if (this.changedContainerPosition) {
            this.viewer.container.style.position = this.previousContainerPosition;
        }
        this.previousPlacements.clear();
        this.measurementCache.clear();
        this.viewer = null;
    }
}
