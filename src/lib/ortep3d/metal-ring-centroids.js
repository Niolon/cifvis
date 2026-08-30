import { chemicalBonds } from '../structure/bond-classification.js';
import { eigs } from '../math-lite.js';

export const DEFAULT_METAL_CENTRE_ELEMENTS = [
    'Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni',
    'Cu', 'Zn', 'Ga', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag',
    'Cd', 'In', 'Sn', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb',
    'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au',
    'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am',
    'Cm', 'Bk', 'Cf',
];

export const DEFAULT_METAL_RING_CENTROID_OPTIONS = {
    centreElements: DEFAULT_METAL_CENTRE_ELEMENTS,
    ringElements: ['B', 'C', 'N', 'O', 'P', 'S'],
    minRingSize: 5,
    maxRingSize: 8,
    minBondedAtoms: 3,
    minRingCoverage: 0.5,
    requireGeometryCheck: true,
    maxLateralDisplacementRatio: 0.75,
    maxDistanceSpreadRatio: 0.35,
    dashSegmentLength: 0.3,
    dashFraction: 0.6,
};

/**
 * Validates metal-ring centroid detection and dash settings.
 * @param {object} options - Fully merged centroid options
 * @returns {void}
 */
export function validateMetalRingCentroidOptions(options) {
    for (const name of ['centreElements', 'ringElements']) {
        if (!Array.isArray(options[name]) || options[name].length === 0 ||
            options[name].some(value => typeof value !== 'string' || value.length === 0)) {
            throw new TypeError(`metalRingCentroidOptions.${name} must be a non-empty string array`);
        }
    }
    for (const name of ['minRingSize', 'maxRingSize', 'minBondedAtoms']) {
        if (!Number.isInteger(options[name]) || options[name] < 1) {
            throw new TypeError(`metalRingCentroidOptions.${name} must be a positive integer`);
        }
    }
    if (options.minRingSize > options.maxRingSize) {
        throw new TypeError('metalRingCentroidOptions.minRingSize must not exceed maxRingSize');
    }
    if (options.minBondedAtoms > options.maxRingSize) {
        throw new TypeError('metalRingCentroidOptions.minBondedAtoms must not exceed maxRingSize');
    }
    if (typeof options.requireGeometryCheck !== 'boolean') {
        throw new TypeError('metalRingCentroidOptions.requireGeometryCheck must be boolean');
    }
    for (const name of ['minRingCoverage', 'dashFraction']) {
        if (!(Number.isFinite(options[name]) && options[name] > 0 && options[name] <= 1)) {
            throw new TypeError(`metalRingCentroidOptions.${name} must be greater than 0 and at most 1`);
        }
    }
    for (const name of ['maxLateralDisplacementRatio', 'maxDistanceSpreadRatio']) {
        if (!(Number.isFinite(options[name]) && options[name] >= 0)) {
            throw new TypeError(`metalRingCentroidOptions.${name} must be a non-negative finite number`);
        }
    }
    if (!(Number.isFinite(options.dashSegmentLength) && options.dashSegmentLength > 0)) {
        throw new TypeError('metalRingCentroidOptions.dashSegmentLength must be a positive finite number');
    }
}

/**
 * Canonicalises rotations and traversal direction for deterministic cycle deduplication.
 * @param {string[]} ids - Atom IDs in cycle traversal order
 * @returns {string} Canonical cycle identifier
 */
function canonicalCycle(ids) {
    const variants = [];
    for (const ordered of [ids, [...ids].reverse()]) {
        for (let i = 0; i < ordered.length; i++) {
            variants.push([...ordered.slice(i), ...ordered.slice(0, i)].join('\u0000'));
        }
    }
    variants.sort();
    return variants[0];
}

/**
 * Tests whether a cycle contains no edge between non-consecutive vertices.
 * @param {string[]} cycle - Atom IDs in cycle traversal order
 * @param {Map<string, Set<string>>} adjacency - Ligand graph adjacency
 * @returns {boolean} Whether the cycle is chordless
 */
function isChordless(cycle, adjacency) {
    const n = cycle.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const consecutive = j === i + 1 || (i === 0 && j === n - 1);
            if (!consecutive && adjacency.get(cycle[i])?.has(cycle[j])) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Enumerates canonical chordless cycles reachable from selected ligand atoms.
 * @param {Map<string, Set<string>>} adjacency - Ligand graph adjacency
 * @param {Iterable<string>} starts - Existing centre-neighbour atom IDs
 * @param {number} minSize - Minimum cycle size
 * @param {number} maxSize - Maximum cycle size
 * @returns {Array<{key:string, atoms:string[]}>} Unique cycles
 */
export function findChordlessCycles(adjacency, starts, minSize, maxSize) {
    const cycles = new Map();
    for (const start of starts) {
        if (!adjacency.has(start)) {
            continue;
        }
        const visit = (current, path, visited) => {
            for (const next of adjacency.get(current) || []) {
                if (next === start) {
                    if (path.length >= minSize && isChordless(path, adjacency)) {
                        cycles.set(canonicalCycle(path), [...path]);
                    }
                } else if (!visited.has(next) && path.length < maxSize) {
                    visited.add(next);
                    visit(next, [...path, next], visited);
                    visited.delete(next);
                }
            }
        };
        visit(start, [start], new Set([start]));
    }
    return [...cycles.entries()].map(([key, atoms]) => ({ key, atoms }));
}

/**
 * Converts an atom position to a compact Cartesian coordinate tuple.
 * @param {object} atom - Structure atom
 * @param {object} cell - Unit cell used for coordinate conversion
 * @returns {number[]} Cartesian x, y, and z coordinates
 */
function cartesian(atom, cell) {
    const point = atom.position.toCartesian(cell);
    return [point.x, point.y, point.z];
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Computes centroid and coordination-geometry metrics for a candidate ring.
 * @param {object} centre - Candidate centre atom
 * @param {object[]} ringAtoms - Atoms forming the ligand ring
 * @param {object} cell - Unit cell used for coordinate conversion
 * @returns {?{centroid:number[], lateralDisplacementRatio:number,
 *     distanceSpreadRatio:number}} Candidate geometry, or null for degenerate input
 */
function geometryFor(centre, ringAtoms, cell) {
    const centrePoint = cartesian(centre, cell);
    const points = ringAtoms.map(atom => cartesian(atom, cell));
    if ([...centrePoint, ...points.flat()].some(value => !Number.isFinite(value))) {
        return null;
    }
    const centroid = [0, 1, 2].map(axis =>
        points.reduce((sum, point) => sum + point[axis], 0) / points.length);
    const offsets = points.map(point => point.map((value, axis) => value - centroid[axis]));
    const covariance = [0, 1, 2].map(i => [0, 1, 2].map(j =>
        offsets.reduce((sum, offset) => sum + offset[i] * offset[j], 0) / offsets.length));
    const eigen = eigs(covariance);
    const scale = Math.max(1, Math.abs(eigen.values[2]));
    if (!(eigen.values[1] > scale * 1e-12)) {
        return null;
    }
    const normal = eigen.eigenvectors[0].vector.toArray();
    const centreOffset = centrePoint.map((value, axis) => value - centroid[axis]);
    const normalDistance = centreOffset.reduce((sum, value, axis) => sum + value * normal[axis], 0);
    const lateral = Math.hypot(...centreOffset.map((value, axis) => value - normalDistance * normal[axis]));
    const meanRadius = offsets.reduce((sum, offset) => sum + Math.hypot(...offset), 0) / offsets.length;
    if (!(meanRadius > 0)) {
        return null;
    }
    const distances = points.map(point => distance(centrePoint, point));
    const meanDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    if (!(meanDistance > 0)) {
        return null;
    }
    return {
        centroid,
        lateralDisplacementRatio: lateral / meanRadius,
        distanceSpreadRatio: (Math.max(...distances) - Math.min(...distances)) / meanDistance,
    };
}

/**
 * Produces an orientation-independent identifier for a bond's endpoints.
 * @param {object} bond - Bond whose endpoints are identified
 * @returns {string} Canonical endpoint identifier
 */
function endpointKey(bond) {
    return [bond.atom1Id, bond.atom2Id].sort().join('\u0000');
}

/**
 * Returns a rendering plan without mutating the structure or its bonds.
 * @param {object} structure - Displayed crystal structure
 * @param {object[]} drawableBonds - Existing visible regular bonds
 * @param {object} options - Fully merged centroid options
 * @returns {{interactions:object[], suppressedBonds:Set<object>}} Rendering plan
 */
export function findMetalRingCentroidInteractions(structure, drawableBonds, options) {
    const atomsById = new Map(structure.atoms.map(atom => [atom.uniqueId, atom]));
    const centreElements = new Set(options.centreElements);
    const ringElements = new Set(options.ringElements);
    const adjacency = new Map();
    const addEdge = (first, second) => {
        if (!adjacency.has(first)) {
            adjacency.set(first, new Set());
        }
        if (!adjacency.has(second)) {
            adjacency.set(second, new Set());
        }
        adjacency.get(first).add(second);
        adjacency.get(second).add(first);
    };
    for (const bond of chemicalBonds(structure, drawableBonds)) {
        const first = atomsById.get(bond.atom1Id);
        const second = atomsById.get(bond.atom2Id);
        if (first && second && ringElements.has(first.atomType) && ringElements.has(second.atomType)) {
            addEdge(first.uniqueId, second.uniqueId);
        }
    }

    const contacts = new Map();
    const addContact = (centre, ligand, bond) => {
        if (!centreElements.has(centre.atomType) || !ringElements.has(ligand.atomType)) {
            return;
        }
        if (!contacts.has(centre.uniqueId)) {
            contacts.set(centre.uniqueId, []);
        }
        contacts.get(centre.uniqueId).push({ ligandId: ligand.uniqueId, bond });
    };
    for (const bond of drawableBonds) {
        const first = atomsById.get(bond.atom1Id);
        const second = atomsById.get(bond.atom2Id);
        if (!first || !second) {
            continue;
        }
        addContact(first, second, bond);
        addContact(second, first, bond);
    }

    const candidates = [];
    for (const [centreId, centreContacts] of contacts) {
        const centreAtom = atomsById.get(centreId);
        const starts = new Set(centreContacts.map(contact => contact.ligandId));
        for (const cycle of findChordlessCycles(
            adjacency, starts, options.minRingSize, options.maxRingSize,
        )) {
            const ringSet = new Set(cycle.atoms);
            const relevant = centreContacts.filter(contact => ringSet.has(contact.ligandId));
            const bondedIds = [...new Set(relevant.map(contact => contact.ligandId))];
            const coverage = bondedIds.length / cycle.atoms.length;
            if (bondedIds.length < options.minBondedAtoms || coverage < options.minRingCoverage) {
                continue;
            }
            const ringAtoms = cycle.atoms.map(id => atomsById.get(id));
            const geometry = geometryFor(centreAtom, ringAtoms, structure.cell);
            if (!geometry) {
                continue;
            }
            if (options.requireGeometryCheck && (
                geometry.lateralDisplacementRatio > options.maxLateralDisplacementRatio ||
                geometry.distanceSpreadRatio > options.maxDistanceSpreadRatio
            )) {
                continue;
            }
            candidates.push({
                type: 'ring-centroid-bond', centreAtom, ringAtoms,
                originalBondedAtoms: bondedIds.map(id => atomsById.get(id)),
                originalBonds: relevant.map(contact => contact.bond),
                centroid: geometry.centroid, coverage, bondedAtomCount: bondedIds.length,
                lateralDisplacementRatio: geometry.lateralDisplacementRatio,
                distanceSpreadRatio: geometry.distanceSpreadRatio,
                canonicalRingId: cycle.key,
            });
        }
    }
    candidates.sort((a, b) => b.coverage - a.coverage ||
        b.bondedAtomCount - a.bondedAtomCount ||
        a.lateralDisplacementRatio - b.lateralDisplacementRatio ||
        a.ringAtoms.length - b.ringAtoms.length ||
        a.canonicalRingId.localeCompare(b.canonicalRingId));
    const used = new Set();
    const accepted = [];
    for (const candidate of candidates) {
        const keys = candidate.originalBonds.map(endpointKey);
        if (keys.some(key => used.has(key))) {
            continue;
        }
        keys.forEach(key => used.add(key));
        accepted.push(candidate);
    }
    return { interactions: accepted, suppressedBonds: new Set(accepted.flatMap(item => item.originalBonds)) };
}

/**
 * Produces visible dash intervals with an even leading gap and a terminal dash at the centroid.
 * @param {number} length - Total interaction length
 * @param {number} targetPeriod - Approximate dash-plus-gap period
 * @param {number} dashFraction - Solid fraction of each period
 * @returns {Array<{start:number, end:number}>} Visible dash intervals
 */
export function layoutCentroidDashes(length, targetPeriod, dashFraction) {
    if (!(length > 0)) {
        return [];
    }
    const count = Math.max(1, Math.round(length / targetPeriod));
    const period = length / count;
    const dashLength = period * dashFraction;
    const gap = period - dashLength;
    return Array.from({ length: count }, (_, index) => {
        const start = gap + index * period;
        return { start, end: index === count - 1 ? length : start + dashLength };
    });
}
