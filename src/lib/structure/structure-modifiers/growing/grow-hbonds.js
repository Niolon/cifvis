
import { HBond, Bond } from '../../bonds.js';
import { CrystalStructure } from '../../crystal.js';
import { combineAtomId } from './util.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';

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
        // Extract base label from acceptorAtomLabel (may already contain symmetry like 'O|1_554')
        const acceptorBaseLabel = hBond.acceptorAtomId.split('|')[0];
        finalHBonds.push(new HBond(
            hBond.donorAtomId,
            hBond.hydrogenAtomId,
            combineAtomId(acceptorBaseLabel, hBond.acceptorAtomSymmetry, structure.symmetry),
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

        // find group index of acceptor atom, should always be possible because
        // of checks in structure.calculateConnectedGroups()
        // Extract base label from acceptorAtomId (e.g., 'N1|2_555' -> 'N1')
        const acceptorGroupBaseLabel = hBond.acceptorAtomId.split('|')[0];
        const acceptorGroupIndex = groups.findIndex(
            group => group.atoms.some(atom => atom.label === acceptorGroupBaseLabel),
        );

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

        // Create new atoms - combine symmetries if atom already had appliedSymmetry
        const symmetryAtoms = structure.symmetry.applySymmetry(symOpLabel, acceptorGroup.atoms);
        for (let i = 0; i < symmetryAtoms.length; i++) {
            const atom = symmetryAtoms[i];
            const originalAtom = acceptorGroup.atoms[i];

            // Combine symmetries if original atom had existing symmetry (from fragment growth)
            let combinedSymm = symOpLabel;
            if (originalAtom.appliedSymmetry &&
                originalAtom.appliedSymmetry.key !== `${structure.symmetry.identitySymOpId}_555`) {
                combinedSymm = structure.symmetry.combineSymmetryCodes(
                    symOpLabel, originalAtom.appliedSymmetry.key,
                );
            }

            atom.appliedSymmetry = AppliedSymmetry.fromString(combinedSymm);
            // atom.label remains base label
            finalAtoms.push(atom);
        }

        // Create new bonds
        acceptorGroup.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry === '.')
            .forEach(bond => {
                finalBonds.push(new Bond(
                    combineAtomId(bond.atom1Id, symOpLabel, structure.symmetry),
                    combineAtomId(bond.atom2Id, symOpLabel, structure.symmetry),
                    bond.bondLength,
                    bond.bondLengthSU,
                    '.',
                ));
            });

        // Create new HBonds
        acceptorGroup.hBonds
            .filter(({ acceptorAtomSymmetry }) => acceptorAtomSymmetry === '.')
            .forEach(hBond => {
                finalHBonds.push(new HBond(
                    combineAtomId(hBond.donorAtomId, symOpLabel, structure.symmetry),
                    combineAtomId(hBond.hydrogenAtomId, symOpLabel, structure.symmetry),
                    combineAtomId(hBond.acceptorAtomId, symOpLabel, structure.symmetry),
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
