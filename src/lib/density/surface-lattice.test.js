/* eslint-disable jsdoc/require-jsdoc -- compact numerical fixtures */
import { describe, expect, test } from 'vitest';
import { UnitCell } from '../structure/crystal.js';
import {
    applyAtomCellStencil,
    applyAtomNodeStencil,
    applyAtomSurfaceStencils,
    createAtomCellStencil,
    createAtomNodeStencil,
    planSurfaceLattice,
} from './surface-lattice.js';

function cartesian(matrix, fractional) {
    return [0, 1, 2].map(row =>
        matrix[row][0] * fractional[0] +
        matrix[row][1] * fractional[1] +
        matrix[row][2] * fractional[2]);
}

function verifyConservativeMask(cell, atomPosition) {
    const bounds = { minimum: [-0.5, -0.5, -0.5], maximum: [1.5, 1.5, 1.5] };
    const radius = 1.4;
    const lattice = planSurfaceLattice(cell, bounds, [18, 17, 16]);
    const stencil = createAtomCellStencil(lattice, radius);
    const atoms = [{ position: { x: atomPosition[0], y: atomPosition[1], z: atomPosition[2] } }];
    const { mask } = applyAtomCellStencil(lattice, atoms, stencil);
    const matrix = cell.fractToCartMatrix.toArray();
    const atomCartesian = cartesian(matrix, atomPosition);
    const [nx, ny, nz] = lattice.cellDimensions;
    for (let z = 0; z < nz; z++) {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                const legacyAccepted = [0, 1].some(dz => [0, 1].some(dy =>
                    [0, 1].some(dx => {
                        const fractional = [x + dx, y + dy, z + dz].map((value, axis) =>
                            bounds.minimum[axis] + value * lattice.fractionalStep[axis]);
                        const point = cartesian(matrix, fractional);
                        return Math.hypot(...point.map((value, axis) =>
                            value - atomCartesian[axis])) <= radius;
                    })));
                if (legacyAccepted) {
                    expect(mask[(z * ny + y) * nx + x]).toBe(1);
                }
            }
        }
    }
}

describe('surface lattice atom stencil', () => {
    test.each([
        ['orthogonal', new UnitCell(10, 11, 12, 90, 90, 90)],
        ['monoclinic', new UnitCell(10, 11, 12, 90, 112, 90)],
        ['skewed triclinic', new UnitCell(8, 10, 13, 63, 74, 58)],
    ])('contains every cell accepted by the legacy node mask for %s cells', (_name, cell) => {
        expect(() => verifyConservativeMask(cell, [0.137, 0.501, 0.863])).not.toThrow();
    });

    test('handles boundaries, periodic copies, and overlapping atoms without wrapping', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const bounds = { minimum: [-0.4, 0, 0], maximum: [1.6, 1, 1] };
        const lattice = planSurfaceLattice(cell, bounds, 20);
        const stencil = createAtomCellStencil(lattice, 1.5);
        const result = applyAtomCellStencil(lattice, [
            { position: { x: -0.25, y: 0.5, z: 0.5 } },
            { position: { x: 1.25, y: 0.5, z: 0.5 } },
            { position: { x: 1.25, y: 0.5, z: 0.5 } },
        ], stencil);

        expect(result.activeCellCount).toBeGreaterThan(0);
        const [nx, ny] = lattice.cellDimensions;
        const left = Math.floor((-0.25 - bounds.minimum[0]) / lattice.fractionalStep[0]);
        const right = Math.floor((1.25 - bounds.minimum[0]) / lattice.fractionalStep[0]);
        const y = Math.floor(0.5 / lattice.fractionalStep[1]);
        const z = Math.floor(0.5 / lattice.fractionalStep[2]);
        expect(result.mask[(z * ny + y) * nx + left]).toBe(1);
        expect(result.mask[(z * ny + y) * nx + right]).toBe(1);
        expect(result.candidateCellCount).toBeGreaterThan(result.activeCellCount);
    });

    test('node stencil includes every node accepted by the exact legacy radius', () => {
        const cell = new UnitCell(8, 10, 13, 63, 74, 58);
        const bounds = { minimum: [-0.4, -0.3, -0.2], maximum: [1.4, 1.3, 1.2] };
        const lattice = planSurfaceLattice(cell, bounds, [22, 19, 17]);
        const radius = 1.5;
        const atomPosition = [1.12, 0.03, 0.77];
        const atom = {
            position: { x: atomPosition[0], y: atomPosition[1], z: atomPosition[2] },
        };
        const stencil = createAtomNodeStencil(lattice, radius);
        const { mask } = applyAtomNodeStencil(lattice, [atom], stencil);
        const matrix = cell.fractToCartMatrix.toArray();
        const atomCartesian = cartesian(matrix, atomPosition);
        const [nx, ny, nz] = lattice.dimensions;
        let missedExactNodes = 0;
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                for (let x = 0; x < nx; x++) {
                    const fractional = [x, y, z].map((value, axis) =>
                        bounds.minimum[axis] + value * lattice.fractionalStep[axis]);
                    const point = cartesian(matrix, fractional);
                    const exact = Math.hypot(...point.map((value, axis) =>
                        value - atomCartesian[axis])) <= radius;
                    if (exact && !mask[(z * ny + y) * nx + x]) {
                        missedExactNodes++;
                    }
                }
            }
        }
        expect(missedExactNodes).toBe(0);
    });

    test.each([
        ['orthogonal', new UnitCell(10, 11, 12, 90, 90, 90)],
        ['skewed triclinic', new UnitCell(8, 10, 13, 63, 74, 58)],
    ])('fused application exactly matches separate cell and node masks for %s cells',
        (_name, cell) => {
            const bounds = { minimum: [-0.4, -0.3, -0.2], maximum: [1.4, 1.3, 1.2] };
            const lattice = planSurfaceLattice(cell, bounds, [22, 19, 17]);
            const atoms = [
                { position: { x: -0.31, y: 0.03, z: 0.77 } },
                { position: { x: 1.36, y: 1.21, z: -0.14 } },
                { position: { x: 0.51, y: 0.49, z: 0.52 } },
                { position: { x: 0.51, y: 0.49, z: 0.52 } },
            ];
            const stencil = createAtomCellStencil(lattice, 1.5);
            const separateCells = applyAtomCellStencil(lattice, atoms, stencil);
            const separateNodes = applyAtomNodeStencil(lattice, atoms, stencil);
            const fused = applyAtomSurfaceStencils(lattice, atoms, stencil);

            expect(fused.cellMask).toEqual(separateCells.mask);
            expect(fused.nodeMask).toEqual(separateNodes.mask);
            expect(fused.candidateCellCount).toBe(separateCells.candidateCellCount);
            expect(fused.activeCellCount).toBe(separateCells.activeCellCount);
            expect(fused.candidateNodeCount).toBe(separateNodes.candidateNodeCount);
            expect(fused.allowedNodeCount).toBe(separateNodes.allowedNodeCount);
        });
});
