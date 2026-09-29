/**
 * Wraps a fractional position's coordinates into the [0, 1) range, i.e. into the
 * reference unit cell. Used before comparing positions that may differ by whole
 * lattice translations but represent the same crystallographic point.
 * @param {FractPosition} position - Fractional position to wrap
 * @returns {FractPosition} New position with each coordinate wrapped into [0, 1)
 */
export function wrapFractional(position: FractPosition): FractPosition;
/**
 * Resolves a fractional position into wrapped Cartesian coordinates without
 * allocating Position or Matrix objects. Used to index canonical symmetry
 * images; callers needing only equality should use positionsCoincide directly.
 * @param {FractPosition} position - Fractional position to transform.
 * @param {UnitCell} unitCell - Unit cell defining the Cartesian basis.
 * @returns {number[]} Wrapped Cartesian coordinates in Å.
 */
export function wrappedCartesianCoordinates(position: FractPosition, unitCell: UnitCell): number[];
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
export function positionsCoincide(position1: FractPosition, position2: FractPosition, unitCell: UnitCell, tolerance?: number): boolean;
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
export function positionsCoincideInSameCell(position1: FractPosition, position2: FractPosition, unitCell: UnitCell, tolerance?: number): boolean;
/**
 * Abstract base class for representing positions in 3D space
 * Instances are iterable and yield their x, y, z coordinates in sequence.
 * @abstract
 */
export class BasePosition {
    /**
     * Creates a new position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} z - Z coordinate
     * @throws {TypeError} If instantiated directly
     */
    constructor(x: number, y: number, z: number);
    set x(value: number);
    get x(): number;
    set y(value: number);
    get y(): number;
    set z(value: number);
    get z(): number;
    /**
     * Converts from given coordinate system to Cartesian coordinates
     * @abstract
     * @param {UnitCell} _unitCell - Unit cell for conversion
     * @returns {CartPosition} Position in Cartesian coordinates
     * @throws {Error} If not implemented by subclass
     */
    toCartesian(_unitCell: UnitCell): CartPosition;
    #private;
}
/**
 * Represents a position in fractional coordinates
 * @augments BasePosition
 */
export class FractPosition extends BasePosition {
}
/** Physical tolerance used when symmetry images represent one special position. */
export const SPECIAL_POSITION_TOLERANCE: 0.001;
/**
 * Represents a position in Cartesian coordinates
 * @augments BasePosition
 */
export class CartPosition extends BasePosition {
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
    static fromCIF(cifBlock: CifBlock, index: number): BasePosition;
}
import { UnitCell } from './crystal.js';
import { CifBlock } from '../read-cif/base.js';
//# sourceMappingURL=position.d.ts.map