import * as math from '../math-lite.js';
import { formatAtomLabel } from '../formatting.js';

const DEGREES_PER_RADIAN = 180 / Math.PI;

const subtract = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const length = vector => Math.hypot(...vector);

/**
 * @param {number[]} vector - Vector to normalize.
 * @returns {number[]} Unit vector.
 */
function normalized(vector) {
    const magnitude = length(vector);
    if (magnitude === 0) {
        throw new Error('Cannot measure coincident atoms');
    }
    return vector.map(value => value / magnitude);
}

/**
 * Measures an ordered atom selection. With 5+ atoms, all but the last define
 * a least-squares mean plane and the last atom is the distance probe.
 * @param {object[]} atoms - Selected atoms in selection order.
 * @param {object} cell - Unit cell used to convert fractional coordinates.
 * @returns {object} Measurement type, value, unit, and atom labels.
 */
export function measureAtoms(atoms, cell) {
    if (atoms.length < 2) {
        throw new Error('Select at least two atoms to measure');
    }
    const points = atoms.map(atom => atom.position.toCartesian(cell));
    const cartesianPoints = points.map(point => [point.x, point.y, point.z]);
    const labels = atoms.map(atom => atom.label);
    const atomIds = atoms.map(atom => atom.uniqueId);

    if (points.length === 2) {
        return {
            type: 'distance', value: length(subtract(points[1], points[0])), unit: 'Å', labels,
            points: cartesianPoints, atomIds,
        };
    }
    if (points.length === 3) {
        const first = normalized(subtract(points[0], points[1]));
        const second = normalized(subtract(points[2], points[1]));
        const cosine = Math.max(-1, Math.min(1, dot(first, second)));
        return {
            type: 'angle', value: Math.acos(cosine) * DEGREES_PER_RADIAN, unit: '°', labels,
            points: cartesianPoints, atomIds,
        };
    }
    if (points.length === 4) {
        const middle = normalized(subtract(points[2], points[1]));
        const first = subtract(points[0], points[1]);
        const last = subtract(points[3], points[2]);
        const firstNormal = normalized(first.map((value, index) => value - dot(first, middle) * middle[index]));
        const lastNormal = normalized(last.map((value, index) => value - dot(last, middle) * middle[index]));
        return {
            type: 'torsion',
            value: Math.atan2(dot(cross(middle, firstNormal), lastNormal), dot(firstNormal, lastNormal))
                * DEGREES_PER_RADIAN,
            unit: '°',
            labels,
            points: cartesianPoints,
            atomIds,
        };
    }

    const planePoints = points.slice(0, -1);
    const probe = points.at(-1);
    const centroid = planePoints.reduce((sum, point) => ({
        x: sum.x + point.x,
        y: sum.y + point.y,
        z: sum.z + point.z,
    }), { x: 0, y: 0, z: 0 });
    centroid.x /= planePoints.length;
    centroid.y /= planePoints.length;
    centroid.z /= planePoints.length;

    const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const point of planePoints) {
        const centered = subtract(point, centroid);
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 3; column++) {
                covariance[row][column] += centered[row] * centered[column];
            }
        }
    }
    const eigen = math.eigs(covariance);
    const scale = Math.max(1, Math.abs(eigen.values.at(-1)));
    if (Math.abs(eigen.values[1]) <= scale * 1e-12) {
        throw new Error('Cannot define a mean plane from collinear atoms');
    }
    const normal = normalized(eigen.eigenvectors[0].vector.toArray());
    const probeOffset = subtract(probe, centroid);
    const signedDistance = dot(probeOffset, normal);
    const projection = [
        probe.x - signedDistance * normal[0],
        probe.y - signedDistance * normal[1],
        probe.z - signedDistance * normal[2],
    ];
    return {
        type: 'plane-distance',
        value: Math.abs(dot(subtract(probe, centroid), normal)),
        unit: 'Å',
        labels,
        planeLabels: labels.slice(0, -1),
        probeLabel: labels.at(-1),
        points: cartesianPoints,
        atomIds,
        plane: {
            centroid: [centroid.x, centroid.y, centroid.z],
            normal,
            projection,
        },
    };
}

/**
 * @param {object} measurement - Measurement to format.
 * @param {object} [options] - Display formatting options.
 * @param {boolean} [options.subscriptNonElement] - Whether numeric non-element parts use subscripts.
 * @returns {string} Compact human-readable result.
 */
export function formatMeasurement(measurement, options = {}) {
    const value = measurement.value.toFixed(measurement.unit === '°' ? 2 : 3);
    if (measurement.type === 'plane-distance') {
        const probeLabel = formatAtomLabel(measurement.probeLabel, options.subscriptNonElement);
        const planeLabels = measurement.planeLabels.map(label =>
            formatAtomLabel(label, options.subscriptNonElement));
        return `${probeLabel} to mean plane ` +
            `(${planeLabels.join(', ')}): ${value} ${measurement.unit}`;
    }
    const name = measurement.type === 'distance' ? 'Distance' :
        measurement.type === 'angle' ? 'Angle' : 'Torsion';
    const unitSeparator = measurement.unit === '°' ? '' : ' ';
    const labels = measurement.labels.map(label => formatAtomLabel(label, options.subscriptNonElement));
    return `${name} ${labels.join('–')}: ${value}${unitSeparator}${measurement.unit}`;
}

/**
 * @param {number} atomCount - Number of selected atoms.
 * @returns {{enabled: boolean, symbol: string, title: string}} Button presentation.
 */
export function measurementAction(atomCount) {
    if (atomCount < 2) {
        const remaining = 2 - atomCount;
        return { enabled: false, symbol: '↔', title: `Select ${remaining} more atom${remaining === 1 ? '' : 's'}` };
    }
    if (atomCount === 2) {
        return { enabled: true, symbol: '↔', title: 'Measure distance' };
    }
    if (atomCount === 3) {
        return { enabled: true, symbol: '∠', title: 'Measure angle' };
    }
    if (atomCount === 4) {
        return { enabled: true, symbol: '∡', title: 'Measure torsion angle' };
    }
    return { enabled: true, symbol: '⏥', title: 'Measure last atom distance to mean plane' };
}
