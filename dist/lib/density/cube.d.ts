/**
 * Periodic scalar values read from a Gaussian Cube grid whose three voxel axes
 * span one crystallographic cell.
 */
/**
 * Parses a Gaussian Cube scalar grid. Coordinates are normalized to Å; density
 * properties are additionally normalized from e/bohr³ to e/Å³.
 * @param {string} cubeText - Complete Cube file contents.
 * @param {object} [options] - Property, dataset, scaling, and periodicity options.
 * @returns {ScalarFieldGrid} Parsed grid and metadata.
 */
export function parseCube(cubeText: string, options?: object): ScalarFieldGrid;
export const BOHR_TO_ANGSTROM: 0.529177210903;
import { ScalarFieldGrid } from './scalar-field.js';
//# sourceMappingURL=cube.d.ts.map