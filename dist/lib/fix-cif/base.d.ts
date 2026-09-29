/**
 * Attempts to fix inconsistencies in a CIF block by reconciling atom labels and symmetry operations
 * across different data categories (ADP, bonds, h-bonds)
 * @param {CifBlock} block - CIF block to fix
 * @param {boolean} [fixADPLabels] - Whether to fix atom labels in anisotropic displacement parameter data
 * @param {boolean} [fixBondLabels] - Whether to fix atom labels in bond data
 * @param {boolean} [fixBondSymmetry] - Whether to fix symmetry operation formats in bond data
 */
export function tryToFixCifBlock(block: CifBlock, fixADPLabels?: boolean, fixBondLabels?: boolean, fixBondSymmetry?: boolean): void;
import { CifBlock } from '../read-cif/base.js';
//# sourceMappingURL=base.d.ts.map