import { describe, expect, test } from 'vitest';
import { UnitCell, CrystalStructure, Atom } from '../structure/crystal.js';
import { FractPosition } from '../structure/position.js';
import { Bond } from '../structure/bonds.js';
import { CellSymmetry, SymmetryOperation } from '../structure/cell-symmetry.js';
import { repairBondGeometry } from './bond-geometry.js';

const cell = new UnitCell(10, 10, 10, 90, 90, 90);
const symmetry = new CellSymmetry('P-1', 2, [
    new SymmetryOperation('x,y,z'),
    new SymmetryOperation('-x,-y,-z'),
]);

/**
 * Builds a two-atom test structure with one bond.
 * @param {Bond} bond - The bond to include.
 * @returns {CrystalStructure} Structure for repair.
 */
function structureWith(bond) {
    return new CrystalStructure(
        cell,
        [
            new Atom('C1', 'C', new FractPosition(0.1, 0.0, 0.0)),
            new Atom('C2', 'C', new FractPosition(0.25, 0.0, 0.0)),
        ],
        [bond],
        [],
        symmetry,
    );
}

describe('repairBondGeometry', () => {
    test('leaves a bond alone when the file already agrees with itself', () => {
        // C1 at x=1.0 A, C2 at x=2.5 A -> 1.5 A apart.
        const { structure, repairs } = repairBondGeometry(structureWith(
            new Bond('C1', 'C2', 1.5, 0.01, '.'),
        ));

        expect(repairs).toMatchObject({ recoded: 0, lengthCorrected: 0, dropped: 0 });
        expect(structure.bonds[0].bondLength).toBe(1.5);
        expect(structure.bonds[0].atom2SiteSymmetry).toBe('.');
    });

    test('corrects the site symmetry when another image reproduces the stated length', () => {
        // As written the bond points at C2 a whole cell away (11.5 A), but the file
        // states 1.5 A - which the untranslated image does reproduce.
        const { structure, repairs } = repairBondGeometry(structureWith(
            new Bond('C1', 'C2', 1.5, 0.01, '1_655'),
        ));

        expect(repairs.recoded).toBe(1);
        expect(repairs.lengthCorrected).toBe(0);
        expect(structure.bonds[0].atom2SiteSymmetry).toBe('1_555');
        // The stated length is kept: it is the measurement the depositor made.
        expect(structure.bonds[0].bondLength).toBe(1.5);
    });

    test('falls back to the coordinates when no image reproduces the stated length', () => {
        // 1.5 A apart in the file; no symmetry image sits 1.9 A from C1.
        const { structure, repairs } = repairBondGeometry(structureWith(
            new Bond('C1', 'C2', 1.9, 0.01, '.'),
        ));

        expect(repairs.recoded).toBe(0);
        expect(repairs.lengthCorrected).toBe(1);
        expect(structure.bonds[0].bondLength).toBeCloseTo(1.5, 4);
    });

    test('drops a bond that matches no image and spans an implausible distance', () => {
        const structure = new CrystalStructure(
            cell,
            [
                new Atom('C1', 'C', new FractPosition(0.0, 0.0, 0.0)),
                new Atom('C2', 'C', new FractPosition(0.9, 0.0, 0.0)),
            ],
            // 9 A apart, and no image sits 1.5 A from C1.
            [new Bond('C1', 'C2', 1.5, 0.01, '.')],
            [],
            new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]),
        );
        const result = repairBondGeometry(structure);

        expect(result.repairs.dropped).toBe(1);
        expect(result.structure.bonds).toHaveLength(0);
    });

    test('leaves a bond alone when a duplicated label has a reading that fits', () => {
        // COD 1519817 reuses labels: two distinct sites are both called H10N, and only
        // one of them is the hydrogen N10 actually bonds to. Resolving the label to a
        // single atom measured the bond against the wrong site and reported a 10 A
        // "N-H bond" for a file whose 0.88 A is perfectly standard.
        const structure = new CrystalStructure(
            cell,
            [
                new Atom('N10', 'N', new FractPosition(0.0, 0.0, 0.0)),
                // Not the intended partner: 5 A away.
                new Atom('H10N', 'H', new FractPosition(0.5, 0.0, 0.0)),
                // The intended partner: 1 A away.
                new Atom('H10N', 'H', new FractPosition(0.1, 0.0, 0.0)),
            ],
            [new Bond('N10', 'H10N', 1.0, 0.01, '.')],
            [],
            new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]),
        );
        const { structure: repaired, repairs } = repairBondGeometry(structure);

        expect(repairs).toMatchObject({ recoded: 0, lengthCorrected: 0, dropped: 0 });
        expect(repaired.bonds[0].bondLength).toBe(1.0);
    });

    test('does not modify the input structure', () => {
        const original = structureWith(new Bond('C1', 'C2', 1.5, 0.01, '1_655'));
        repairBondGeometry(original);

        expect(original.bonds[0].atom2SiteSymmetry).toBe('1_655');
    });
});
