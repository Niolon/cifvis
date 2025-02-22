import { reconcileAtomLabels } from './reconcile-labels.js';
import { reconcileSymmetryOperations } from './guess-symmetry.js';

/**
 * Finds the first available key from a list of possible keys in a loop's data
 * @param {CifLoop} loop - CIF loop to check keys in
 * @param {string[]} keys - Array of possible keys to check
 * @returns {string|null} First found key or null if none exist
 */
function determineAvailableKey(loop, keys) {
    for (const key of keys) {
        if (loop.headerLines.includes(key)) {
            return key;
        }
    }
    return null;
}


/**
 * Attempts to fix inconsistencies in a CIF block by reconciling atom labels and symmetry operations
 * across different data categories (ADP, bonds, h-bonds)
 * 
 * @param {CifBlock} block - CIF block to fix
 * @param {boolean} [fixADPLabels=true] - Whether to fix atom labels in anisotropic displacement parameter data
 * @param {boolean} [fixBondLabels=true] - Whether to fix atom labels in bond data
 * @param {boolean} [fixBondSymmetry=true] - Whether to fix symmetry operation formats in bond data
 */
export function tryToFixCifBlock(block, fixADPLabels=true, fixBondLabels=true, fixBondSymmetry=true) {
    let atomSiteLabels;
    if (fixADPLabels || fixBondLabels) {
        atomSiteLabels = block.get('_atom_site').get(['_atom_site.label', '_atom_site_label']);
    }
    if (fixADPLabels) {
        const atomSiteAniso = block.get('_atom_site_aniso', false);
        if (atomSiteAniso) {
            const labelKey = determineAvailableKey(atomSiteAniso, ['_atom_site_aniso.label', '_atom_site_aniso_label']);
            if (labelKey) {
                reconcileAtomLabels(atomSiteAniso, labelKey, atomSiteLabels);
            }
        }
    }
    if (fixBondLabels || fixBondSymmetry) {
        const bondLoop = block.get('_geom_bond', false);
        if (bondLoop) {
            if (fixBondLabels) {
                const labelKey1 = determineAvailableKey(
                    bondLoop, ['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1'],
                );
                reconcileAtomLabels(bondLoop, labelKey1, atomSiteLabels);
                const labelKey2 = determineAvailableKey(
                    bondLoop, ['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2'],
                );
                reconcileAtomLabels(bondLoop, labelKey2, atomSiteLabels);
            }
            if (fixBondSymmetry) {
                const symmKey = determineAvailableKey(
                    bondLoop, ['_geom_bond.site_symmetry_1', '_geom_bond_site_symmetry_1'],
                );
                if (symmKey) {
                    reconcileSymmetryOperations(bondLoop, symmKey);
                }
                const symmKey2 = determineAvailableKey(
                    bondLoop, ['_geom_bond.site_symmetry_2', '_geom_bond_site_symmetry_2'],
                );
                if (symmKey2) {
                    reconcileSymmetryOperations(bondLoop, symmKey2);
                }
            }
        }
        const hBondLoop = block.get('_geom_hbond', false);
        if (hBondLoop) {
            if (fixBondLabels) {
                const labelKey1 = determineAvailableKey(
                    hBondLoop, ['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D'],
                );
                reconcileAtomLabels(hBondLoop, labelKey1, atomSiteLabels);
                const labelKey2 = determineAvailableKey(
                    hBondLoop, ['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'],
                );
                if (labelKey2) {
                    reconcileAtomLabels(hBondLoop, labelKey2, atomSiteLabels);
                }
                const labelKey3 = determineAvailableKey(
                    hBondLoop, ['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'],
                );
                reconcileAtomLabels(hBondLoop, labelKey3, atomSiteLabels);
            }
            if (fixBondSymmetry) {
                const symmKey = determineAvailableKey(
                    hBondLoop, ['_geom_hbond.site_symmetry_a', '_geom_hbond_site_symmetry_A'],
                );
                if (symmKey) {
                    reconcileSymmetryOperations(hBondLoop, symmKey);
                }
            }
        }
    }
}