import { UAnisoADP } from '../adp.js';
import { Bond, HBond } from '../bonds.js';
import { SymmetryOperation, CellSymmetry } from '../cell-symmetry.js';
import { UnitCell, CrystalStructure, Atom } from '../crystal.js';
import { FractPosition } from '../position.js';
import {
    BaseFilter,
} from './base.js';

export class MockStructure {
    constructor(baseStructure = null) {
        if (baseStructure) {
            this.structure = baseStructure;
        } else {
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,y+1/2,-z'),
                new SymmetryOperation('-x+1/2,y,-z+1/2'),
                new SymmetryOperation('x+1/2,-y+1/2,z'),
            ];
            const symmetry = new CellSymmetry('Test', 1, symmetryOps);

            this.structure = new CrystalStructure(cell, [], [], [], symmetry);
        }
    }

    static createDefault({
        hasHydrogens = false, hasAnisoHydrogens = false, disorderGroups = [], hasMultipleSymmetry = false,
    } = {}) {
        const structure = new MockStructure()
            .addAtom('C1', 'C', 0.1, 0.1, 0.1)
            .addAtom('C2', 'C', 0.2, 0.2, 0.2)
            .addAtom('O1', 'O', 0.3, 0.3, 0.3)
            .addAtom('N1', 'N', 0.4, 0.4, 0.4)
            .addBond('C1', 'C2')
            .addBond('C2', 'O1')
            .addBond('C1', 'O1', '.');

        if (hasMultipleSymmetry) {
            structure
                .addAtom('N2', 'N', 0.5, 0.5, 0.5)
                .addAtom('S1', 'S', 0.6, 0.6, 0.6)
                .addBond('N2', 'C1', '.') // connect atom to otherwise connected atoms
                .addBond('N1', 'N2', '2_545') // Second symmetry op + translation
                .addBond('S1', 'N1', '3_565') // Third symmetry op + translation
                .addBond('C2', 'N2', '4_655'); // Fourth symmetry op + translation;
        }

        if (hasHydrogens) {
            structure
                .addAtom('H1', 'H', 0.15, 0.15, 0.15)
                .addAtom('H2', 'H', 0.25, 0.25, 0.25)
                .addBond('C1', 'H1')
                .addBond('C2', 'H2')
                .addBond('O1', 'H1')
                .addBond('O1', 'H2')
                .addHBond('O1', 'H1', 'N1')
                .addHBond('O1', 'H2', 'N1', '.');
            if (hasMultipleSymmetry) {
                structure
                    .addBond('N1', 'H1')
                    .addBond('N2', 'H2')
                    .addHBond('N1', 'H1', 'S1', '2_555')
                    .addHBond('N2', 'H2', 'O1', '3_568');
            }
        }

        if (hasAnisoHydrogens) {
            structure
                .addAtom('H3', 'H', 0.35, 0.35, 0.35, 0, new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0))
                .addBond('C2', 'H3');
        }

        disorderGroups.forEach((group, i) => {
            structure
                .addAtom(`A${i}`, 'C', 0.7 + 0.1 * i, 0.7 + 0.1 * i, 0.7 + 0.1 * i, group)
                .addBond(`A${i}`, 'C1');
        });

        return structure;
    }

    addAtom(label, type, x = 0, y = 0, z = 0, disorderGroup = 0, adp = null) {
        this.structure.atoms.push(new Atom(label, type, new FractPosition(x, y, z), adp, disorderGroup));
        return this;
    }

    addBond(atom1Label, atom2Label, symmetry = '.', length = 1.5, su = 0.01) {
        this.structure.bonds.push(
            new Bond(atom1Label, atom2Label, length, su, symmetry),
        );
        return this;
    }

    addHBond(donor, hydrogen, acceptor, symmetry = '.', {
        dhDist = 1.0, dhDistSU = 0.01, haDist = 2.0, haDistSU = 0.02, 
        daDist = 2.8, daDistSU = 0.03, angle = 175, angleSU = 1,
    } = {}) {
        this.structure.hBonds.push(
            new HBond(
                donor,
                hydrogen,
                acceptor,
                dhDist,
                dhDistSU,
                haDist,
                haDistSU,
                daDist,
                daDistSU,
                angle,
                angleSU,
                symmetry,
            ),
        );
        return this;
    }

    build() {
        const atomLabels = new Set(this.structure.atoms.map(atom => atom.label));

        for (const bond of this.structure.bonds) {
            if (!atomLabels.has(bond.atom1Label)) {
                throw new Error(`Bond references non-existent atom ${bond.atom1Label}`);
            }
            if (bond.atom2SiteSymmetry === '.' && !atomLabels.has(bond.atom2Label)) {
                throw new Error(`Bond references non-existent atom ${bond.atom2Label}`);
            }
        }

        for (const hbond of this.structure.hBonds) {
            if (!atomLabels.has(hbond.donorAtomLabel)) {
                throw new Error(`H-bond references non-existent donor atom ${hbond.donorAtomLabel}`);
            }
            if (!atomLabels.has(hbond.hydrogenAtomLabel)) {
                throw new Error(`H-bond references non-existent hydrogen atom ${hbond.hydrogenAtomLabel}`);
            }
            if (hbond.acceptorAtomSymmetry === '.' && !atomLabels.has(hbond.acceptorAtomLabel)) {
                throw new Error(`H-bond references non-existent acceptor atom ${hbond.acceptorAtomLabel}`);
            }
        }
        this.structure.recalculateConnectedGroups();

        return this.structure;
    }
}
export function checkSymmetryGrowth(grown, {
    checkSymmetries = [], // Symmetry operations to verify growth with
    excludeSymmetries = [], // Symmetry operations to verify NO growth with
}) {
    const atomLabels = ['C1', 'C2', 'O1', 'N1', 'N2', 'H1', 'H2'];
    const bondPairs = [['C1', 'C2'], ['C1', 'O1'], ['C2', 'O1'], ['N2', 'C1']];
    const hbondTriples = [['O1', 'H1', 'N1'], ['O1', 'H2', 'N1']];

    const errors = [];

    // Check for required atoms
    const missingAtoms = [];
    for (const atomLabel of atomLabels) {
        for (const symm of checkSymmetries) {
            if (!grown.atoms.some(a => a.label === `${atomLabel}@${symm}`)) {
                missingAtoms.push([atomLabel, symm]);
            }
        }
    }
    if (missingAtoms.length > 0) {
        errors.push(`Missing atoms: ${JSON.stringify(missingAtoms)}`);
    }

    // Check for excluded atoms
    const unexpectedAtoms = [];
    for (const atomLabel of atomLabels) {
        for (const symm of excludeSymmetries) {
            if (grown.atoms.some(a => a.label === `${atomLabel}@${symm}`)) {
                unexpectedAtoms.push([atomLabel, symm]);
            }
        }
    }
    if (unexpectedAtoms.length > 0) {
        errors.push(`Unexpected atoms found: ${JSON.stringify(unexpectedAtoms)}`);
    }

    // Check for required bonds
    const missingBonds = [];
    for (const [atom1, atom2] of bondPairs) {
        for (const symm of checkSymmetries) {
            const atom1Label = `${atom1}@${symm}`;
            const atom2Label = `${atom2}@${symm}`;
            if (!grown.bonds.some(b => (b.atom1Label === atom1Label && b.atom2Label === atom2Label) ||
                (b.atom1Label === atom2Label && b.atom2Label === atom1Label),
            )) {
                missingBonds.push([atom1Label, atom2Label]);
            }
        }
    }
    if (missingBonds.length > 0) {
        errors.push(`Missing bonds: ${JSON.stringify(missingBonds)}`);
    }

    // Check for required hydrogen bonds
    const missingHBonds = [];
    for (const [donor, hydrogen, acceptor] of hbondTriples) {
        for (const symm of checkSymmetries) {
            const donorLabel = `${donor}@${symm}`;
            const hydrogenLabel = `${hydrogen}@${symm}`;
            const acceptorLabel = `${acceptor}@${symm}`;
            if (!grown.hBonds.some(hb => hb.donorAtomLabel === donorLabel &&
                hb.hydrogenAtomLabel === hydrogenLabel &&
                hb.acceptorAtomLabel === acceptorLabel,
            )) {
                missingHBonds.push([donorLabel, hydrogenLabel, acceptorLabel]);
            }
        }
    }
    if (missingHBonds.length > 0) {
        errors.push(`Missing hydrogen bonds: ${JSON.stringify(missingHBonds)}`);
    }

    return errors;
}
describe('BaseFilter', () => {
    test('cannot be instantiated directly', () => {
        expect(() => {
            new BaseFilter({}, 'mode', 'TestFilter');
        }).toThrow(TypeError);
    });

    test('requires implementation of abstract methods', () => {
        class IncompleteFilter extends BaseFilter {
            constructor() {
                super({ A: 'a' }, 'a', 'IncompleteFilter');
            }
        }

        const filter = new IncompleteFilter();
        expect(() => filter.apply({})).toThrow('Method "apply" must be implemented by subclass');
        expect(() => filter.getApplicableModes({})).toThrow(
            'Method "getApplicableModes" must be implemented by subclass',
        );
    });

    class TestFilter extends BaseFilter {
        static MODES = { A: 'a', B: 'b', C: 'c', D: 'd' };
        static PREFERRED_FALLBACK_ORDER = ['c', 'b', 'a'];

        constructor(mode = TestFilter.MODES.A) {
            super(TestFilter.MODES, mode, 'TestFilter', TestFilter.PREFERRED_FALLBACK_ORDER);
        }

        getApplicableModes(structure) {
            if (structure === 'structureAB') {
                return [TestFilter.MODES.A, TestFilter.MODES.B];
            }
            return [TestFilter.MODES.D];
        }

        apply(structure) {
            this.ensureValidMode(structure);
            return structure;
        }
    }

    test('validates modes on construction', () => {
        expect(() => new TestFilter('invalid')).toThrow('Invalid TestFilter mode');
        expect(() => new TestFilter(TestFilter.MODES.A)).not.toThrow();
    });

    test('handles mode cycling', () => {
        const filter = new TestFilter(TestFilter.MODES.A);
        expect(filter.cycleMode('structureAB')).toBe(TestFilter.MODES.B);
        expect(filter.cycleMode('structureAB')).toBe(TestFilter.MODES.A);
        expect(filter.cycleMode('structureAB')).toBe(TestFilter.MODES.B);
    });

    test('handles invalid modes with fallback', () => {
        const filter = new TestFilter(TestFilter.MODES.C);
        expect(filter.mode).toBe(TestFilter.MODES.C);

        filter.ensureValidMode('structureAB');

        expect(filter.mode).toBe(TestFilter.MODES.B);

        // ensure that is also runs if not PREFERRED_FALLBACK_ORDER
        filter.ensureValidMode('NotinMode');

        expect(filter.mode).toBe(TestFilter.MODES.D);
    });

    test('set mode can handle uppercalse mode names', () => {
        const filter = new TestFilter(TestFilter.MODES.A);
        filter.mode = 'B';
        expect(filter.mode).toBe(TestFilter.MODES.B);
    });
});
