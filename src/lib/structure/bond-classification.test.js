import { describe, expect, test } from 'vitest';
import { Bond } from './bonds.js';
import { CellSymmetry, SymmetryOperation } from './cell-symmetry.js';
import { Atom, CrystalStructure, UnitCell } from './crystal.js';
import { FractPosition } from './position.js';
import { chemicalBonds, isChemicalBond } from './bond-classification.js';
import { growFragment } from './structure-modifiers/growing/grow-fragment.js';
import { SymmetryGrower } from './structure-modifiers/modes.js';

/**
 * Creates a compact structure for bond-classification tests.
 * @param {Array<Array<string>>} atomDefinitions - Atom label/type pairs
 * @param {Array<Array<string|number>>} bondDefinitions - Bond endpoint, symmetry, and length tuples
 * @returns {CrystalStructure} Test structure
 */
function makeStructure(atomDefinitions, bondDefinitions) {
    const atoms = atomDefinitions.map(([label, atomType], index) => new Atom(
        label,
        atomType,
        new FractPosition(0.1 * (index + 1), 0.1, 0.1),
    ));
    const bonds = bondDefinitions.map(([atom1, atom2, symmetry, length]) => new Bond(
        atom1,
        atom2,
        length,
        0.01,
        symmetry,
    ));
    return new CrystalStructure(
        new UnitCell(10, 10, 10, 90, 90, 90),
        atoms,
        bonds,
        [],
        new CellSymmetry('P -1', 2, [
            new SymmetryOperation('x,y,z'),
            new SymmetryOperation('-x,-y,-z'),
        ]),
    );
}

describe('chemical bond classification', () => {
    test('separates non-metal publication contacts from covalent bonds', () => {
        const structure = makeStructure(
            [['N1', 'N'], ['O1', 'O'], ['O2', 'O']],
            [['N1', 'O1', '.', 1.25], ['N1', 'O2', '.', 2.95], ['O1', 'O2', '2_555', 2.71]],
        );

        expect(isChemicalBond(structure, structure.bonds[0])).toBe(true);
        expect(isChemicalBond(structure, structure.bonds[1])).toBe(false);
        expect(isChemicalBond(structure, structure.bonds[2])).toBe(false);
        expect(chemicalBonds(structure)).toEqual([structure.bonds[0]]);
    });

    test('conservatively retains metal coordination bonds', () => {
        const structure = makeStructure(
            [['Cu1', 'Cu'], ['O1', 'O'], ['Cu2', 'Cu']],
            [['Cu1', 'O1', '.', 2.36], ['Cu1', 'Cu2', '2_555', 3.60]],
        );

        expect(chemicalBonds(structure)).toEqual(structure.bonds);
    });

    test('rejects implausibly long rows regardless of element type', () => {
        const structure = makeStructure(
            [['Cu1', 'Cu'], ['Cu2', 'Cu']],
            [['Cu1', 'Cu2', '2_555', 5.75]],
        );

        expect(chemicalBonds(structure)).toHaveLength(0);
    });

    test('does not grow a fragment through a symmetry-related contact', () => {
        const structure = makeStructure(
            [['O1', 'O'], ['O2', 'O']],
            [['O1', 'O2', '2_555', 2.71]],
        );

        const { grownStructure } = growFragment(structure);

        expect(grownStructure.atoms).toHaveLength(2);
        expect(grownStructure.bonds).toHaveLength(0);
        expect(grownStructure.calculateConnectedGroups().map(group => group.atoms.length)).toEqual([1, 1]);
    });

    test.each([
        SymmetryGrower.MODES.FRAGMENT,
        SymmetryGrower.MODES.CELL,
        SymmetryGrower.MODES.FRAGMENT_CELL,
    ])('%s mode uses the shared chemical graph', mode => {
        const structure = makeStructure(
            [['O1', 'O'], ['O2', 'O']],
            [['O1', 'O2', '2_555', 2.71]],
        );

        const result = new SymmetryGrower(mode).apply(structure);

        expect(result.bonds).toHaveLength(0);
    });
});
