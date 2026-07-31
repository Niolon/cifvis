import { Bond } from '../structure/bonds.js';
import { CrystalStructure } from '../structure/crystal.js';
import { decodePositionCode, encodePositionCode } from '../structure/position-code.js';

/**
 * Largest deviation, in Ångström, between a stated bond length and the distance the
 * structure's own coordinates span before the bond counts as inconsistent. Published
 * distances are commonly rounded to two decimals, so this sits just above that.
 */
export const BOND_GEOMETRY_TOLERANCE = 0.05;

/** Longest distance still accepted as a real bond when falling back to the coordinates. */
export const MAX_PLAUSIBLE_BOND = 4.0;

/** Lattice translations searched, per axis, when looking for the intended image. */
const TRANSLATION_SEARCH_RANGE = 2;

/**
 * @typedef {object} BondGeometryRepairs
 * @property {number} recoded - Bonds whose site-symmetry code was corrected.
 * @property {number} lengthCorrected - Bonds whose stated length was replaced by the real distance.
 * @property {number} dropped - Bonds that could not be reconciled either way.
 * @property {string[]} details - Human-readable description of each repair.
 */

/**
 * Repairs bonds whose stated length contradicts the structure's own coordinates and
 * site-symmetry codes.
 *
 * A `_geom_bond` entry carries three pieces of information - the two atom labels, a
 * site-symmetry code, and a distance - and a file can state all three inconsistently.
 * The distance is then the only one of the three that is independently meaningful: it
 * is what the depositor measured. So the code is re-derived from it wherever some
 * symmetry image reproduces it, which is the common case by a wide margin; across the
 * COD problem corpus 4235 of 4262 inconsistent bonds are repairable this way.
 *
 * Correcting the length instead would satisfy any consistency check while leaving the
 * bond drawn between the wrong pair of atoms - typically whole unit cells apart - so it
 * is used only where no image reproduces the stated distance and the coordinates
 * themselves still describe a chemically plausible bond.
 * @param {CrystalStructure} structure - Structure to repair.
 * @param {object} [options] - Overrides.
 * @param {number} [options.tolerance] - Maximum accepted length deviation in Å.
 * @param {number} [options.maxPlausibleBond] - Longest distance accepted from coordinates alone.
 * @returns {{structure: CrystalStructure, repairs: BondGeometryRepairs}} Repaired structure
 *  and a description of what was changed. The input is left untouched.
 */
export function repairBondGeometry(structure, options = {}) {
    const tolerance = options.tolerance ?? BOND_GEOMETRY_TOLERANCE;
    const maxPlausibleBond = options.maxPlausibleBond ?? MAX_PLAUSIBLE_BOND;

    const atomsByLabel = new Map(structure.atoms.map(atom => [atom.label, atom]));
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const toCartesian = fract => [
        matrix[0][0] * fract[0] + matrix[0][1] * fract[1] + matrix[0][2] * fract[2],
        matrix[1][0] * fract[0] + matrix[1][1] * fract[1] + matrix[1][2] * fract[2],
        matrix[2][0] * fract[0] + matrix[2][1] * fract[1] + matrix[2][2] * fract[2],
    ];
    const separation = (first, second) => Math.hypot(
        first[0] - second[0], first[1] - second[1], first[2] - second[2],
    );

    /**
     * Places an atom ID using the structure's own symmetry.
     * @param {string} atomId - ID of the form `label` or `label|code`.
     * @returns {number[]|null} Fractional coordinates, or null when unresolvable.
     */
    const place = atomId => {
        const [label, code] = atomId.split('|');
        const atom = atomsByLabel.get(label);
        if (!atom) {
            return null;
        }
        let decoded;
        try {
            decoded = decodePositionCode(code || '1_555');
        } catch {
            return null;
        }
        const index = structure.symmetry.operationIds.get(decoded.id);
        if (index === undefined) {
            return null;
        }
        const image = structure.symmetry.symmetryOperations[index]
            .applyToPoint([atom.position.x, atom.position.y, atom.position.z]);
        return [
            image[0] + decoded.translation[0],
            image[1] + decoded.translation[1],
            image[2] + decoded.translation[2],
        ];
    };

    /**
     * Finds the symmetry image of an atom that sits the stated distance from a fixed
     * point.
     *
     * The operation the file names is tried first and kept whenever some lattice
     * translation of it reproduces the distance. In the corpus this is what these files
     * need: the operation id is right and only the `_klm` digits are wrong, off by a
     * whole lattice vector related to the centring. Preferring it keeps the repair
     * minimal and avoids swapping in a symmetry-equivalent image that happens to sit at
     * the same distance. Otherwise every operation is searched, smallest lattice
     * translation first, so the result is deterministic and as compact as possible.
     * @param {number[]} origin - Cartesian position of the fixed endpoint.
     * @param {object} target - Asymmetric-unit atom to image.
     * @param {number} statedLength - Distance the bond claims to span.
     * @param {string|null} preferredOperationId - Operation id the file named.
     * @returns {string|null} Position code reproducing the distance, or null.
     */
    const findIntendedImage = (origin, target, statedLength, preferredOperationId) => {
        const searchOperation = operationId => {
            const index = structure.symmetry.operationIds.get(operationId);
            if (index === undefined) {
                return null;
            }
            const image = structure.symmetry.symmetryOperations[index]
                .applyToPoint([target.position.x, target.position.y, target.position.z]);
            let best = null;
            let bestMagnitude = Infinity;
            for (let x = -TRANSLATION_SEARCH_RANGE; x <= TRANSLATION_SEARCH_RANGE; x++) {
                for (let y = -TRANSLATION_SEARCH_RANGE; y <= TRANSLATION_SEARCH_RANGE; y++) {
                    for (let z = -TRANSLATION_SEARCH_RANGE; z <= TRANSLATION_SEARCH_RANGE; z++) {
                        const distance = separation(
                            origin, toCartesian([image[0] + x, image[1] + y, image[2] + z]),
                        );
                        if (Math.abs(distance - statedLength) > tolerance) {
                            continue;
                        }
                        const magnitude = Math.abs(x) + Math.abs(y) + Math.abs(z);
                        if (magnitude < bestMagnitude) {
                            bestMagnitude = magnitude;
                            best = encodePositionCode(operationId, [x, y, z]);
                        }
                    }
                }
            }
            return best;
        };

        if (preferredOperationId) {
            const kept = searchOperation(preferredOperationId);
            if (kept) {
                return kept;
            }
        }
        for (const operationId of structure.symmetry.operationIds.keys()) {
            const found = searchOperation(operationId);
            if (found) {
                return found;
            }
        }
        return null;
    };

    const repairs = { recoded: 0, lengthCorrected: 0, dropped: 0, details: [] };
    const repairedBonds = [];

    for (const bond of structure.bonds) {
        const first = place(bond.atom1Id);
        const second = place(bond.atom2Id);
        if (bond.bondLength === null || bond.bondLength === undefined || !first || !second) {
            repairedBonds.push(bond);
            continue;
        }
        const origin = toCartesian(first);
        const spanned = separation(origin, toCartesian(second));
        if (Math.abs(spanned - bond.bondLength) <= tolerance) {
            repairedBonds.push(bond);
            continue;
        }

        const targetLabel = bond.atom2Id.split('|')[0];
        let statedOperationId = null;
        try {
            statedOperationId = decodePositionCode(
                bond.atom2Id.split('|')[1] || '1_555',
            ).id;
        } catch {
            statedOperationId = null;
        }
        const intendedCode = findIntendedImage(
            origin, atomsByLabel.get(targetLabel), bond.bondLength, statedOperationId,
        );
        if (intendedCode) {
            repairs.recoded++;
            repairs.details.push(
                `${bond.atom1Id}-${bond.atom2Id}: site symmetry corrected to ${intendedCode}`
                + ` (stated ${bond.bondLength} A, code as written spanned ${spanned.toFixed(3)} A)`,
            );
            repairedBonds.push(new Bond(
                bond.atom1Id, targetLabel, bond.bondLength, bond.bondLengthSU, intendedCode,
            ));
            continue;
        }

        if (spanned <= maxPlausibleBond) {
            repairs.lengthCorrected++;
            repairs.details.push(
                `${bond.atom1Id}-${bond.atom2Id}: length corrected to ${spanned.toFixed(4)} A`
                + ` (file stated ${bond.bondLength} A; no symmetry image reproduces that)`,
            );
            repairedBonds.push(new Bond(
                bond.atom1Id, bond.atom2Id, spanned, bond.bondLengthSU, bond.atom2SiteSymmetry,
            ));
            continue;
        }

        repairs.dropped++;
        repairs.details.push(
            `${bond.atom1Id}-${bond.atom2Id}: dropped - stated ${bond.bondLength} A matches no`
            + ` symmetry image and the coordinates span ${spanned.toFixed(3)} A`,
        );
    }

    return {
        structure: new CrystalStructure(
            structure.cell,
            structure.atoms,
            repairedBonds,
            structure.hBonds,
            structure.symmetry,
        ),
        repairs,
    };
}
