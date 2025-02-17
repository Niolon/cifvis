import { FractPosition, CartPosition, BasePosition, PositionFactory } from './position.js';
import { UnitCell } from './crystal.js';
import { CIF } from '../cif/read-cif.js';

describe('Position Classes', () => {
    const unitCell = new UnitCell(10, 10, 10, 90, 90, 90);

    test('Position base class cannot be instantiated directly', () => {
        expect(() => new BasePosition(1, 2, 3))
            .toThrow('Position is an abstract class and cannot be instantiated directly');
    });

    test('Position provides array-like access', () => {
        const pos = new FractPosition(1, 2, 3);
        expect(pos[0]).toBe(1);
        expect(pos[1]).toBe(2);
        expect(pos[2]).toBe(3);
        expect([...pos]).toEqual([1, 2, 3]);
    });

    test('Position getters/setters work correctly', () => {
        const pos = new FractPosition(1, 2, 3);
      
        pos.x = 4;
        pos.y = 5;
        pos.z = 6;

        expect(pos.x).toBe(4);
        expect(pos.y).toBe(5);
        expect(pos.z).toBe(6);
        expect([...pos]).toEqual([4, 5, 6]);
    });

    test('FractPosition converts to CartPosition correctly', () => {
        const fPos = new FractPosition(0.5, 0.5, 0.5);
        const cPos = fPos.toCartesian(unitCell);
      
        expect(cPos).toBeInstanceOf(CartPosition);
        expect(cPos.x).toBeCloseTo(5.0);
        expect(cPos.y).toBeCloseTo(5.0);
        expect(cPos.z).toBeCloseTo(5.0);
    });

    test('CartPosition toCartesian returns self', () => {
        const cPos = new CartPosition(5, 5, 5);
        const result = cPos.toCartesian(unitCell);
      
        expect(result).toBe(cPos);
    });

    test('toCartesian throws error if not implemented', () => {
        class TestPosition extends BasePosition {}

        const testPosition = new TestPosition(0.0, 0.0, 0.0);
        expect(() => testPosition.toCartesian()).toThrow('toCartesian must be implemented by subclass');
    });
});

describe('PositionFactory', () => {
    test('creates FractPosition from fractional coordinates', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 0.5 0.5 0.5
`;
        const cif = new CIF(cifText);
        const position = PositionFactory.fromCIF(cif.getBlock(), 0);
        
        expect(position).toBeInstanceOf(FractPosition);
        expect(position.x).toBe(0.5);
        expect(position.y).toBe(0.5);
        expect(position.z).toBe(0.5);
    });

    test('creates CartPosition from Cartesian coordinates', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
C1 5.0 5.0 5.0
`;
        const cif = new CIF(cifText);
        const position = PositionFactory.fromCIF(cif.getBlock(), 0);
        
        expect(position).toBeInstanceOf(CartPosition);
        expect(position.x).toBe(5.0);
        expect(position.y).toBe(5.0);
        expect(position.z).toBe(5.0);
    });

    test('prefers fractional over Cartesian coordinates', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
C1 0.5 0.5 0.5 5.0 5.0 5.0
`;
        const cif = new CIF(cifText);
        const position = PositionFactory.fromCIF(cif.getBlock(), 0);
        
        expect(position).toBeInstanceOf(FractPosition);
        expect(position.x).toBe(0.5);
    });

    test('detects dummy atom from calc_flag', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_calc_flag
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 dum 0.5 0.5 0.5
`;
        const cif = new CIF(cifText);
        expect(() => PositionFactory.fromCIF(cif.getBlock(), 0))
            .toThrow('Dummy atom: calc_flag is dum');
    });

    test('detects dummy atom from invalid fractional coordinates', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 0.5 . 0.5
`;
        const cif = new CIF(cifText);
        expect(() => PositionFactory.fromCIF(cif.getBlock(), 0))
            .toThrow('Dummy atom: Invalid position');
    });

    test('detects dummy atom from invalid cartesian coordinates', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_Cartn_x
_atom_site_Cartn_y
_atom_site_Cartn_z
C1 0.5 . 0.5
`;
        const cif = new CIF(cifText);
        expect(() => PositionFactory.fromCIF(cif.getBlock(), 0))
            .toThrow('Dummy atom: Invalid position');
    });

    test('throws error when no coordinates found', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
C1 C
`;
        const cif = new CIF(cifText);
        expect(() => PositionFactory.fromCIF(cif.getBlock(), 0))
            .toThrow('Invalid position: No valid fractional or Cartesian coordinates found');
    });
});