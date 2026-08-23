
import { UnitCell } from './crystal.js';
import { CifBlock } from '../read-cif/base.js';
import * as math from '../math-lite.js';

/**
 * Abstract base class for representing positions in 3D space
 * Instances are iterable and yield their x, y, z coordinates in sequence.
 * @abstract
 */
export class BasePosition {
    #coords;

    /**
     * Creates a new position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate 
     * @param {number} z - Z coordinate
     * @throws {TypeError} If instantiated directly
     */
    constructor(x, y, z) {
        if (new.target === BasePosition) {
            throw new TypeError(
                'BasePosition is an abstract class and cannot be instantiated directly, you probably want CartPosition',
            );
        }
        this.#coords = [Number(x), Number(y), Number(z)];
        Object.defineProperties(this, {
            0: { get: () => this.#coords[0] },
            1: { get: () => this.#coords[1] },
            2: { get: () => this.#coords[2] },
            length: { value: 3 },
            [Symbol.iterator]: { 
                value: function* () {
                    yield this.#coords[0];
                    yield this.#coords[1];
                    yield this.#coords[2];
                },
            },
        });
    }

    get x() {
        return this.#coords[0]; 
    }
    get y() {
        return this.#coords[1]; 
    }
    get z() {
        return this.#coords[2]; 
    }

    set x(value) {
        this.#coords[0] = value; 
    }
    set y(value) {
        this.#coords[1] = value; 
    }
    set z(value) {
        this.#coords[2] = value; 
    }

    /**
     * Converts from given coordinate system to Cartesian coordinates
     * @abstract
     * @param {UnitCell} _unitCell - Unit cell for conversion
     * @returns {CartPosition} Position in Cartesian coordinates
     * @throws {Error} If not implemented by subclass
     */
    toCartesian(_unitCell) {
        throw new Error('toCartesian must be implemented by subclass');
    }
}

/**
 * Represents a position in fractional coordinates
 * @augments BasePosition
 */
export class FractPosition extends BasePosition {
    /**
     * Creates a new fractional position
     * @param {number} x - X coordinate in fractional units
     * @param {number} y - Y coordinate in fractional units 
     * @param {number} z - Z coordinate in fractional units
     */
    constructor(x, y, z) {
        super(x, y, z);
    }

    /**
     * Converts to Cartesian coordinates using unit cell parameters
     * @param {UnitCell} unitCell - Unit cell for conversion
     * @returns {CartPosition} Position in Cartesian coordinates
     */
    toCartesian(unitCell) {
        const cartCoords = math.multiply(
            unitCell.fractToCartMatrix, 
            math.matrix([this.x, this.y, this.z]),
        );
        return new CartPosition(...cartCoords.toArray());
    }
}

/**
 * Wraps a fractional position's coordinates into the [0, 1) range, i.e. into the
 * reference unit cell. Used before comparing positions that may differ by whole
 * lattice translations but represent the same crystallographic point.
 * @param {FractPosition} position - Fractional position to wrap
 * @returns {FractPosition} New position with each coordinate wrapped into [0, 1)
 */
export function wrapFractional(position) {
    const wrap = value => ((value % 1) + 1) % 1;
    return new FractPosition(wrap(position.x), wrap(position.y), wrap(position.z));
}

// `positionsCoincide` is used in symmetry-growth inner loops. Retain a plain
// conversion matrix per cell so equality tests do not allocate temporary
// FractPosition, CartPosition, and Matrix objects.
const fractToCartMatrices = new WeakMap();

/** Physical tolerance used when symmetry images represent one special position. */
export const SPECIAL_POSITION_TOLERANCE = 1e-3;

/**
 * Gets the plain fractional-to-Cartesian matrix cached for a unit cell.
 * @param {UnitCell} unitCell - Unit cell whose coordinate basis is needed.
 * @returns {number[][]} Plain 3×3 fractional-to-Cartesian matrix.
 */
function getFractToCartMatrix(unitCell) {
    let matrix = fractToCartMatrices.get(unitCell);
    if (!matrix) {
        matrix = unitCell.fractToCartMatrix.toArray();
        fractToCartMatrices.set(unitCell, matrix);
    }
    return matrix;
}

/**
 * Wraps one fractional coordinate into the reference-cell interval [0, 1).
 * @param {number} value - Fractional coordinate.
 * @returns {number} Wrapped coordinate.
 */
function wrapCoordinate(value) {
    return ((value % 1) + 1) % 1;
}

/**
 * Resolves a fractional position into wrapped Cartesian coordinates without
 * allocating Position or Matrix objects. Used to index canonical symmetry
 * images; callers needing only equality should use positionsCoincide directly.
 * @param {FractPosition} position - Fractional position to transform.
 * @param {UnitCell} unitCell - Unit cell defining the Cartesian basis.
 * @returns {number[]} Wrapped Cartesian coordinates in Å.
 */
export function wrappedCartesianCoordinates(position, unitCell) {
    const matrix = getFractToCartMatrix(unitCell);
    const x = wrapCoordinate(position.x);
    const y = wrapCoordinate(position.y);
    const z = wrapCoordinate(position.z);
    return [
        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
        matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
    ];
}

/**
 * Central routine for "do these two positions represent the same physical point in
 * the crystal" - the question special-position detection, symmetry-duplicate atom
 * collapsing, and symmetry-orbit duplicate detection all need answered consistently.
 * Wraps both positions into the reference cell (so a whole-lattice-translation apart
 * still counts as coincident) and compares true Euclidean distance in Cartesian space
 * (so the tolerance is a physical distance, not a per-axis approximation that ignores
 * non-orthogonal cell angles).
 * @param {FractPosition} position1 - First fractional position
 * @param {FractPosition} position2 - Second fractional position
 * @param {UnitCell} unitCell - Unit cell for Cartesian conversion
 * @param {number} [tolerance] - Maximum Cartesian distance (in Å) to count as coincident
 * @returns {boolean} Whether the two positions coincide within tolerance
 */
export function positionsCoincide(position1, position2, unitCell, tolerance = SPECIAL_POSITION_TOLERANCE) {
    const matrix = getFractToCartMatrix(unitCell);
    // Choose the nearest periodic image before converting to Cartesian space.
    // Comparing wrapped coordinates directly treats 0.99999 and 0.00001 as a
    // full unit-cell apart, even though they are separated by only 0.00002 in
    // fractional space.
    const x = position1.x - position2.x - Math.round(position1.x - position2.x);
    const y = position1.y - position2.y - Math.round(position1.y - position2.y);
    const z = position1.z - position2.z - Math.round(position1.z - position2.z);
    const dx = matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z;
    const dy = matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z;
    const dz = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z;
    return Math.hypot(dx, dy, dz) < tolerance;
}

/**
 * Whether two positions are the same site in the *same* cell, i.e. coincident
 * without any lattice translation between them.
 *
 * This is the stricter counterpart to {@link positionsCoincide}, which answers
 * "same point of the periodic crystal" and therefore also accepts images a whole
 * lattice translation apart. Both questions are needed, for different purposes:
 * periodic equivalence decides which images may be omitted to keep growth finite,
 * whereas only true coincidence licenses rewriting one atom's ID onto another.
 * Rewriting an ID across a lattice translation moves a bond endpoint a full cell
 * or more, which draws a bond spanning the structure.
 * @param {FractPosition} position1 - First fractional position
 * @param {FractPosition} position2 - Second fractional position
 * @param {UnitCell} unitCell - Unit cell for Cartesian conversion
 * @param {number} [tolerance] - Maximum Cartesian distance (in Å) to count as coincident
 * @returns {boolean} Whether the positions are the same site with no lattice offset
 */
export function positionsCoincideInSameCell(
    position1, position2, unitCell, tolerance = SPECIAL_POSITION_TOLERANCE,
) {
    const matrix = getFractToCartMatrix(unitCell);
    const x = position1.x - position2.x;
    const y = position1.y - position2.y;
    const z = position1.z - position2.z;
    const dx = matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z;
    const dy = matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z;
    const dz = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z;
    return Math.hypot(dx, dy, dz) < tolerance;
}

/**
 * Represents a position in Cartesian coordinates
 * @augments BasePosition
 */
export class CartPosition extends BasePosition {
    /**
     * Creates a new Cartesian position
     * @param {number} x - X coordinate in Angstroms
     * @param {number} y - Y coordinate in Angstroms
     * @param {number} z - Z coordinate in Angstroms
     */
    constructor(x, y, z) {
        super(x, y, z);
    }

    /**
     * Returns self since already in Cartesian coordinates
     * @param {UnitCell} _unitCell - Unused unit cell
     * @returns {CartPosition} This position instance
     */
    toCartesian(_unitCell) {
        return this;
    }
}

/**
 * Factory class for creating Position objects from CIF data
 */
export class PositionFactory {
    /**
     * Creates a Position object from CIF data
     * @param {CifBlock} cifBlock - CIF data block containing position data
     * @param {number} index - Index in the loop
     * @returns {BasePosition} Position object in fractional or Cartesian coordinates
     * @throws {Error} If neither fractional nor Cartesian coordinates are valid
     */
    static fromCIF(cifBlock, index) {
        let invalidCoordsFound = false;
        const atomSite = cifBlock.get('_atom_site');
        const invalidValues = ['.', '?'];

        const calcFlag = String(atomSite.getIndex(
            ['_atom_site.calc_flag', '_atom_site_calc_flag'],
            index,
            '',
        )).toLowerCase();
        if (calcFlag === 'dum') {
            throw new Error('Dummy atom: calc_flag is dum');
        }

        // Try fractional coordinates first
        try {
            const x = atomSite.getIndex(['_atom_site.fract_x', '_atom_site_fract_x'], index);
            const y = atomSite.getIndex(['_atom_site.fract_y', '_atom_site_fract_y'], index);
            const z = atomSite.getIndex(['_atom_site.fract_z', '_atom_site_fract_z'], index);

            if (!invalidValues.includes(x) && !invalidValues.includes(y) && !invalidValues.includes(z)) {
                return new FractPosition(x, y, z);
            } else {
                invalidCoordsFound = true;
            }
        } catch {
            // Fractional coordinates not found
        }

        // Try Cartesian coordinates
        try {
            const x = atomSite.getIndex(['_atom_site.Cartn_x', '_atom_site.cartn_x', '_atom_site_Cartn_x'], index);
            const y = atomSite.getIndex(['_atom_site.Cartn_y', '_atom_site.cartn_y', '_atom_site_Cartn_y'], index);
            const z = atomSite.getIndex(['_atom_site.Cartn_z', '_atom_site.cartn_z', '_atom_site_Cartn_z'], index);

            if (!invalidValues.includes(x) && !invalidValues.includes(y) && !invalidValues.includes(z)) {
                return new CartPosition(x, y, z);
            } else {
                invalidCoordsFound = true;
            }
        } catch {
            // Cartesian coordinates not found
        }
        if (invalidCoordsFound) { 
            throw new Error('Dummy atom: Invalid position');
        }

        throw new Error('Invalid position: No valid fractional or Cartesian coordinates found');
    }
}
