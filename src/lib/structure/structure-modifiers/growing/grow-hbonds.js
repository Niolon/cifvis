
import { HBond, Bond } from '../../bonds.js';
import { CrystalStructure } from '../../crystal.js';
import { combineSymAtomLabel } from './util.js';

/**
 * Grows external hydrogen bonds (HBonds) in a crystal structure by applying symmetry operations
 * to connected groups and generating new atoms, bonds, and HBonds as needed.
 *
 * This function identifies HBonds that cross symmetry boundaries (i.e., those with a non-'.'
 * acceptorAtomSymmetry), applies the corresponding symmetry operation to the connected group,
 * and adds the resulting atoms, bonds, and HBonds to the structure. It ensures that each group
 * is only grown once per symmetry operation to avoid duplication.
 * @param {CrystalStructure} structure - The crystal structure to grow HBonds for.
 * @returns {CrystalStructure} A new CrystalStructure instance with the grown atoms, bonds, and HBonds.
 * @throws {Error} If an HBond references a non-existing acceptor atom.
 */
export function growExternalHBonds(structure) {
    const groups = structure.calculateConnectedGroups();

    const growableHBonds = [];
    const finalHBonds = [];
    structure.hBonds.forEach(hBond => {
        if (hBond.acceptorAtomSymmetry === '.') {
            finalHBonds.push(hBond);
        } else {
            growableHBonds.push(hBond);
        }
    });

    const alreadyGrownGroups = new Set();

    const finalAtoms = [...structure.atoms];
    const finalBonds = [...structure.bonds];

    for (const hBond of growableHBonds) {
        // add the hBond to final hBonds
        finalBonds.push(new HBond(
            combineSymAtomLabel(hBond.donorAtomLabel, hBond.acceptorAtomSymmetry, structure.symmetry),
            combineSymAtomLabel(hBond.hydrogenAtomLabel, hBond.acceptorAtomSymmetry, structure.symmetry),
            combineSymAtomLabel(hBond.acceptorAtomLabel, hBond.acceptorAtomSymmetry, structure.symmetry),
            hBond.donorHydrogenDistance,
            hBond.donorHydrogenDistanceSU,
            hBond.acceptorHydrogenDistance,
            hBond.acceptorHydrogenDistanceSU,
            hBond.donorAcceptorDistance,
            hBond.donorAcceptorDistanceSU,
            hBond.hBondAngle,
            hBond.hBondAngleSU,
            '.',
        ));

        // find group index of acceptor atom
        const acceptorGroupIndex = groups.findIndex(
            group => group.atoms.some(atom => atom.label === hBond.acceptorAtomLabel),
        );

        if (!acceptorGroupIndex) {
            throw new Error(`HBond has non-existing acceptor atom: ${hBond.acceptorAtomLabel}`);
        }

        const symOpLabel = hBond.acceptorAtomSymmetry;

        // Make sure we are not growing a group twice if connected by two HBonds
        const growLabel = `${acceptorGroupIndex}@${symOpLabel}`;
        if (alreadyGrownGroups.has(growLabel)) {
            continue;
        } else {
            alreadyGrownGroups.add(growLabel);
        }

        // Get the acceptor group
        const acceptorGroup = groups[acceptorGroupIndex];

        // Create new atoms
        const symmetryAtoms = structure.symmetry.applySymmetry(symOpLabel, acceptorGroup.atoms);
        symmetryAtoms.forEach(atom => {
            atom.label = combineSymAtomLabel(atom.label, symOpLabel, structure.symmetry);
            finalAtoms.push(atom);
        });

        // Create new bonds
        acceptorGroup.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry === '.')
            .forEach(bond => {
                finalBonds.add(new Bond(
                    combineSymAtomLabel(bond.atom1Label, symOpLabel, structure.symmetry),
                    combineSymAtomLabel(bond.atom2Label, symOpLabel, structure.symmetry),
                    bond.bondLength,
                    bond.bondLengthSU,
                    '.',
                ));
            });

        // Create new HBonds
        acceptorGroup.hBonds
            .filter(({ acceptorAtomSymmetry }) => acceptorAtomSymmetry === '.')
            .forEach(hBond => {
                finalBonds.push(new HBond(
                    combineSymAtomLabel(hBond.donorAtomLabel, symOpLabel, structure.symmetry),
                    combineSymAtomLabel(hBond.hydrogenAtomLabel, symOpLabel, structure.symmetry),
                    combineSymAtomLabel(hBond.acceptorAtomLabel, symOpLabel, structure.symmetry),
                    hBond.donorHydrogenDistance,
                    hBond.donorHydrogenDistanceSU,
                    hBond.acceptorHydrogenDistance,
                    hBond.acceptorHydrogenDistanceSU,
                    hBond.donorAcceptorDistance,
                    hBond.donorAcceptorDistanceSU,
                    hBond.hBondAngle,
                    hBond.hBondAngleSU,
                    '.',
                ));
            });
    }

    return new CrystalStructure(
        structure.cell,
        finalAtoms,
        finalBonds,
        finalHBonds,
        structure.symmetry,
    );
}