import { decodePositionCode } from '../../src/lib/structure/position-code.js';

/**
 * Largest deviation, in Ångström, between the length a bond is labelled with and the
 * distance actually spanned by the two atoms it names, before the bond counts as
 * inconsistent. Published `_geom_bond_distance` values are commonly rounded to two
 * decimals, so the threshold sits just above that rounding.
 */
export const BOND_LENGTH_TOLERANCE = 0.05;

/**
 * Builds a plain fractional-to-Cartesian converter for a unit cell.
 * @param {object} cell - Unit cell providing `fractToCartMatrix`.
 * @returns {(fract: number[]) => number[]} Converts fractional to Cartesian coordinates.
 */
function cartesianConverter(cell) {
    const matrix = cell.fractToCartMatrix.toArray();
    return fract => [
        matrix[0][0] * fract[0] + matrix[0][1] * fract[1] + matrix[0][2] * fract[2],
        matrix[1][0] * fract[0] + matrix[1][1] * fract[1] + matrix[1][2] * fract[2],
        matrix[2][0] * fract[0] + matrix[2][1] * fract[1] + matrix[2][2] * fract[2],
    ];
}

/**
 * Distance between two Cartesian points.
 * @param {number[]} first - First point.
 * @param {number[]} second - Second point.
 * @returns {number} Euclidean distance.
 */
function distance(first, second) {
    return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

/**
 * Places an atom ID of the form `label|symmetryCode` using only the structure's own
 * symmetry operations - no growth involved.
 * @param {object} structure - Structure providing symmetry.
 * @param {Map<string, object>} atomsByLabel - Asymmetric-unit atoms indexed by label.
 * @param {string} atomId - Atom ID to place.
 * @returns {number[]|null} Fractional coordinates, or null when the ID cannot be resolved.
 */
function placeAtomId(structure, atomsByLabel, atomId) {
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
    const operationIndex = structure.symmetry.operationIds.get(decoded.id);
    if (operationIndex === undefined) {
        return null;
    }
    const image = structure.symmetry.symmetryOperations[operationIndex]
        .applyToPoint([atom.position.x, atom.position.y, atom.position.z]);
    return [
        image[0] + decoded.translation[0],
        image[1] + decoded.translation[1],
        image[2] + decoded.translation[2],
    ];
}

/**
 * Checks whether a CIF agrees with itself: for every `_geom_bond` entry, places both
 * endpoints using the CIF's own coordinates and site-symmetry codes and compares the
 * result against the bond length the CIF states.
 *
 * This is the reference point for {@link checkGrownBonds}. A structure whose basis is
 * already unsound will produce inconsistent bonds after growth no matter how correct
 * the growth code is - the symmetry orbit of a wrong bond is a set of wrong bonds - so
 * without this diagnostic those files masquerade as growth defects.
 * @param {object} structure - Parsed, ungrown CrystalStructure.
 * @returns {{checked: number, mismatched: string[]}} Bonds verifiable from the CIF alone,
 *  and a description of each that disagrees with its own stated length.
 */
export function checkCifBasis(structure) {
    const atomsByLabel = new Map(structure.atoms.map(atom => [atom.label, atom]));
    const toCartesian = cartesianConverter(structure.cell);
    const mismatched = [];
    let checked = 0;

    for (const bond of structure.bonds) {
        if (bond.bondLength === null || bond.bondLength === undefined) {
            continue;
        }
        const first = placeAtomId(structure, atomsByLabel, bond.atom1Id);
        const second = placeAtomId(structure, atomsByLabel, bond.atom2Id);
        if (!first || !second) {
            continue;
        }
        checked++;
        const spanned = distance(toCartesian(first), toCartesian(second));
        if (Math.abs(spanned - bond.bondLength) > BOND_LENGTH_TOLERANCE) {
            mismatched.push(
                `${bond.atom1Id}-${bond.atom2Id} cifCoordinates=${spanned.toFixed(3)}`
                + ` cifLabel=${bond.bondLength}`,
            );
        }
    }
    return { checked, mismatched };
}

/**
 * Checks that a grown structure is internally consistent: every bond resolves to two
 * materialised atoms, and spans the distance it is labelled with.
 *
 * A bond drawn at a length other than the one it carries means its endpoints name the
 * wrong symmetry images - historically an image displaced by whole lattice translations,
 * which draws a bond across the entire model.
 * @param {object} structure - Structure produced by a SymmetryGrower.
 * @returns {{idCollisions: number, dangling: string[], inconsistent: string[]}} Repeated
 *  atom IDs, bonds naming an atom that is not present, and bonds whose drawn length
 *  disagrees with their labelled length.
 */
export function checkGrownBonds(structure) {
    const atomsById = new Map();
    let idCollisions = 0;
    for (const atom of structure.atoms) {
        if (atomsById.has(atom.uniqueId)) {
            idCollisions++;
        } else {
            atomsById.set(atom.uniqueId, atom);
        }
    }

    const dangling = [];
    const inconsistent = [];
    for (const bond of structure.bonds) {
        // A bond still carrying a site-symmetry code deliberately points at an image
        // outside the model - the ungrown view and the cell modes both keep such
        // records, and the renderer skips them until the partner exists. Only a bond
        // that claims to be fully resolved must name two present atoms.
        if (bond.atom2SiteSymmetry && bond.atom2SiteSymmetry !== '.') {
            continue;
        }
        const first = atomsById.get(bond.atom1Id);
        const second = atomsById.get(bond.atom2Id);
        if (!first || !second) {
            dangling.push(`${bond.atom1Id}-${bond.atom2Id}`);
            continue;
        }
        if (bond.bondLength === null || bond.bondLength === undefined) {
            continue;
        }
        const firstPosition = first.position.toCartesian(structure.cell);
        const secondPosition = second.position.toCartesian(structure.cell);
        const spanned = distance(
            [firstPosition.x, firstPosition.y, firstPosition.z],
            [secondPosition.x, secondPosition.y, secondPosition.z],
        );
        if (Math.abs(spanned - bond.bondLength) > BOND_LENGTH_TOLERANCE) {
            inconsistent.push(
                `${bond.atom1Id}-${bond.atom2Id} drawn=${spanned.toFixed(3)}`
                + ` labelled=${bond.bondLength}`,
            );
        }
    }
    return { idCollisions, dangling, inconsistent };
}

/**
 * Formats one grown-structure finding together with the verdict on the source CIF, so a
 * reader can tell a growth defect from faithfully reproduced bad input without opening
 * the file.
 * @param {object} options - Report inputs.
 * @param {string} options.filePath - CIF being tested.
 * @param {object} options.modes - Active `{hydrogenMode, disorderMode, symmetryMode}`.
 * @param {object} options.grown - Result of {@link checkGrownBonds}.
 * @param {object} options.basis - Result of {@link checkCifBasis}.
 * @returns {string} Multi-line report.
 */
export function formatBondConsistencyReport({ filePath, modes, grown, basis }) {
    const verdict = basis.mismatched.length > 0
        ? `SOURCE CIF ALREADY INCONSISTENT (${basis.mismatched.length}/${basis.checked} of its own`
            + ' bonds disagree with its own coordinates) - growth is likely reproducing bad input'
        : `SOURCE CIF IS SELF-CONSISTENT (${basis.checked} bonds verified) - introduced by growth`;

    const lines = [
        `Bond consistency in ${filePath}:`,
        `  Modes: H=${modes.hydrogenMode}, D=${modes.disorderMode}, S=${modes.symmetryMode}`,
        `  Diagnosis: ${verdict}`,
    ];
    if (grown.idCollisions > 0) {
        lines.push(`  Repeated atom IDs: ${grown.idCollisions}`);
    }
    if (grown.dangling.length > 0) {
        lines.push(`  Bonds naming a missing atom: ${grown.dangling.length}`);
        grown.dangling.slice(0, 3).forEach(entry => lines.push(`    ${entry}`));
    }
    if (grown.inconsistent.length > 0) {
        lines.push(`  Bonds drawn at the wrong length: ${grown.inconsistent.length}`);
        grown.inconsistent.slice(0, 3).forEach(entry => lines.push(`    ${entry}`));
    }
    if (basis.mismatched.length > 0) {
        lines.push('  Example of the CIF disagreeing with itself:');

        basis.mismatched.slice(0, 3).forEach(entry => lines.push(`    ${entry}`));
    }
    return lines.join('\n');
}
