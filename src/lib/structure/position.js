
import { UnitCell } from './crystal.js';
import { CifBlock } from '../read-cif/base.js';
import { create, all } from 'mathjs';

const math = create(all);

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