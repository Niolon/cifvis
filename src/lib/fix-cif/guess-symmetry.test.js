import { guessSymmetryOperation, reconcileSymmetryOperations } from './guess-symmetry.js';
import { CIF } from '../read-cif/base.js';
import { CifLoop } from '../read-cif/loop.js';

describe('guessSymmetryOperation', () => {
    describe('handles standard cases', () => {
        test('preserves already correct format', () => {
            expect(guessSymmetryOperation('2_555')).toBe('2_555');
            expect(guessSymmetryOperation('12_456')).toBe('12_456');
        });

        test('handles empty/null input', () => {
            expect(guessSymmetryOperation(null)).toBe('.');
            expect(guessSymmetryOperation(undefined)).toBe('.');
            expect(guessSymmetryOperation('')).toBe('.');
            expect(guessSymmetryOperation('.')).toBe('.');
        });
    });

    describe('handles alternative separators', () => {
        test('converts space-separated format with numeric IDs', () => {
            expect(guessSymmetryOperation('2 555')).toBe('2_555');
            expect(guessSymmetryOperation('12 456')).toBe('12_456');
        });

        test('converts dash-separated format with numeric IDs', () => {
            expect(guessSymmetryOperation('2-555')).toBe('2_555');
            expect(guessSymmetryOperation('12-456')).toBe('12_456');
        });

        test('converts dot-separated format with numeric IDs', () => {
            expect(guessSymmetryOperation('2.555')).toBe('2_555');
            expect(guessSymmetryOperation('12.456')).toBe('12_456');
        });

        test('handles flexible ID formats', () => {
            expect(guessSymmetryOperation('m1 555')).toBe('m1_555');
            expect(guessSymmetryOperation('4+ 565')).toBe('4+_565');
            expect(guessSymmetryOperation('2x-555')).toBe('2x_555');
            expect(guessSymmetryOperation('Symm1 555')).toBe('Symm1_555');
            expect(guessSymmetryOperation('-m1 555')).toBe('-m1_555');
            expect(guessSymmetryOperation('-4-565')).toBe('-4_565');
            expect(guessSymmetryOperation('-2x 555')).toBe('-2x_555');
        });

        test('handles extra whitespace', () => {
            expect(guessSymmetryOperation('  2 555  ')).toBe('2_555');
            expect(guessSymmetryOperation(' m1 456 ')).toBe('m1_456');
        });
    });

    describe('handles encoded integer formats', () => {
        test('handles 5-digit codes with translation at end', () => {
            expect(guessSymmetryOperation('20555')).toBe('2_555');
            expect(guessSymmetryOperation('30565')).toBe('3_565');
            expect(guessSymmetryOperation('10455')).toBe('1_455');
        });

        test('handles 5-digit codes with translation at start', () => {
            expect(guessSymmetryOperation('56503')).toBe('3_565');
            expect(guessSymmetryOperation('45502')).toBe('2_455');
            expect(guessSymmetryOperation('55501')).toBe('1_555');
        });

        test('handles 6-digit codes with translation at end', () => {
            expect(guessSymmetryOperation('120565')).toBe('12_565');
            expect(guessSymmetryOperation('230555')).toBe('23_555');
            expect(guessSymmetryOperation('150455')).toBe('15_455');
        });

        test('handles 6-digit codes with translation at start', () => {
            expect(guessSymmetryOperation('565012')).toBe('12_565');
            expect(guessSymmetryOperation('455023')).toBe('23_455');
            expect(guessSymmetryOperation('555015')).toBe('15_555');
        });

        test('chooses position based on distance from 555', () => {
            // 565 is closer to 555 than 356, so interpret as 12_565
            expect(guessSymmetryOperation('356012')).toBe('12_356');
            
            // 555 is closer to 555 than 503, so interpret as 12_555
            expect(guessSymmetryOperation('50312')).toBe('12_503');
        });
    });

    describe('handles invalid formats', () => {
        test('returns original value for unrecognized formats', () => {
            expect(guessSymmetryOperation('abc')).toBe('abc');
            expect(guessSymmetryOperation('1_abc')).toBe('1_abc');
            expect(guessSymmetryOperation('1234567')).toBe('1234567'); // Too many digits
            expect(guessSymmetryOperation('1234')).toBe('1234'); // Too few digits
            expect(guessSymmetryOperation('a_555')).toBe('a_555');
        });
    });
});

describe('reconcileSymmetryOperations', () => {
    /**
     * Creates a test symmetry loop for testing
     * @param {Array<string>} operations list of operations to be put into the geom_bond_site_symmetry field
     * @returns {CifLoop} a loop component containing the specified entries
     */
    function createTestLoop(operations) {
        const cifText = `
data_test
loop_
_geom_bond_site_symmetry
${operations.join('\n')}
`;
        const cif = new CIF(cifText);
        return cif.getBlock().get('_geom_bond');
    }

    test('reconciles various symmetry formats in loop', () => {
        const loop = createTestLoop([
            '"2 555"',      // space separated
            '12-565',     // dash separated
            '30555',      // 5-digit integer, translation at end
            '565012',     // 6-digit integer, translation at start
            '2_555',      // already correct format
            'invalid',    // invalid format
        ]);

        reconcileSymmetryOperations(loop, '_geom_bond_site_symmetry');

        const reconciled = loop.get('_geom_bond_site_symmetry');
        expect(reconciled).toEqual([
            '2_555',   // converted from space separated
            '12_565',  // converted from dash separated
            '3_555',   // converted from 5-digit integer
            '12_565',  // converted from 6-digit integer
            '2_555',   // unchanged correct format
            'invalid', // unchanged invalid format
        ]);
    });

    test('handles empty and invalid values', () => {
        const loop = createTestLoop([
            '.',
            '?',
            'abc',
            '1234',
        ]);

        reconcileSymmetryOperations(loop, '_geom_bond_site_symmetry');

        const reconciled = loop.get('_geom_bond_site_symmetry');
        expect(reconciled).toEqual([
            '.',     // unchanged
            '?',     // unchanged
            'abc',   // unchanged
            1234,  // unchanged
        ]);
    });

    test('handles mixed formats consistently', () => {
        const loop = createTestLoop([
            '"2 555"',     // space separated numeric
            '20555',     // 5-digit, translation at end
            '555021',    // 6-digit, translation at start 
            '21-555',    // dash separated numeric
            '"m1 565"',    // space separated with letter
            'Symm2-555', // dash separated with letters
            '"4+ 565"',    // space separated with symbol
            '"-m1 555"',   // negative ID with space
            '"-4-565"',    // negative ID with dash
            '"-2x 555"',   // negative ID with letter
        ]);

        reconcileSymmetryOperations(loop, '_geom_bond_site_symmetry');

        const reconciled = loop.get('_geom_bond_site_symmetry');
        expect(reconciled).toEqual([
            '2_555',
            '2_555',
            '21_555',
            '21_555',
            'm1_565',
            'Symm2_555',
            '4+_565',
            '-m1_555',
            '-4_565',
            '-2x_555',
        ]);
    });
});