import * as THREE from 'three';
import { chemicalBonds } from '../structure/bond-classification.js';
import { layoutAtomLabels } from './atom-label-layout.js';

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
 * Finds chordless five-to-seven-member cycles in a structure's chemical graph.
 * This is a bounded geometric hint, not an aromaticity assignment.
 * @param {import('../structure/crystal.js').CrystalStructure} structure - Displayed structure
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
     * @param {import('./crystal-viewer.js').CrystalViewer} viewer - Owning viewer
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.options = viewer.options.atomLabels;
        this.previousPlacements = new Map();
        this.layout = { placed: [], hidden: [] };
        this.rings = [];
        this.displayStructure = null;

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
    }

    setOptions(options) {
        this.options = options;
        this.previousPlacements.clear();
    }

    setStructure(structure) {
        this.displayStructure = structure;
        this.rings = findSmallRings(structure);
        this.previousPlacements.clear();
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
        const neighbours = [];
        for (const bond of this.displayStructure.bonds) {
            const otherId = bond.atom1Id === atom.uniqueId ? bond.atom2Id :
                bond.atom2Id === atom.uniqueId ? bond.atom1Id : null;
            if (otherId && projectedAnchors.has(otherId)) {
                neighbours.push(projectedAnchors.get(otherId));
            }
        }
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

    update() {
        if (!this.context) {
            return;
        }
        this.resize();
        const width = this.viewer.container.clientWidth;
        const height = this.viewer.container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.context.clearRect(0, 0, width, height);

        const requests = this.resolveRequests();
        if (requests.length === 0) {
            this.layout = { placed: [], hidden: [] };
            return;
        }
        this.viewer.camera.updateMatrixWorld();
        this.viewer.moleculeContainer.updateMatrixWorld(true);
        const projectedAnchors = this.projectAnchors();
        const font = `${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        this.context.font = font;
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        const labels = requests.map(request => {
            const anchor = projectedAnchors.get(request.atom.uniqueId);
            if (!anchor || anchor.z < -1 || anchor.z > 1) {
                return null;
            }
            const metrics = this.context.measureText(request.text);
            return {
                id: request.atom.uniqueId,
                text: request.text,
                x: anchor.x,
                y: anchor.y,
                radius: anchor.radius,
                width: metrics.width,
                height: this.options.fontSize * 1.2,
                priority: request.priority,
                preferredDirection: this.preferredDirection(request.atom, projectedAnchors),
            };
        }).filter(Boolean);
        const obstacles = [...projectedAnchors.values()]
            .filter(anchor => anchor.z >= -1 && anchor.z <= 1)
            .map(anchor => ({ ...anchor, radius: anchor.radius + this.options.atomPadding }));

        this.layout = layoutAtomLabels(
            labels,
            obstacles,
            this.projectBonds(projectedAnchors),
            this.projectRings(projectedAnchors),
            { width, height },
            this.options,
            this.previousPlacements,
        );
        this.previousPlacements = new Map(this.layout.placed.map(label => [label.id, label]));
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
            context.fillStyle = this.options.color;
            context.fillText(label.text, label.x, label.y);
        }
    }

    dispose() {
        this.canvas.remove();
        if (this.changedContainerPosition) {
            this.viewer.container.style.position = this.previousContainerPosition;
        }
        this.previousPlacements.clear();
        this.viewer = null;
    }
}
