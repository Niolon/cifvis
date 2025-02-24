/**
 * Normalizes an atom label for comparison
 * @param {string} label - Atom label to normalize
 * @param {boolean} [removeSuffixes=false] - Whether to remove ^A, ^1, *$n suffixes
 * @returns {string} Normalized label
 * @throws {Error} If label is empty
 */
export function normalizeAtomLabel(label, removeSuffixes = true) {
    if (!label || typeof label !== 'string') {
        throw new Error('Empty atom label');
    }

    // Basic normalization (always applied)
    let normalized = label.toUpperCase().replace(/[()[\]{}]/g, '');

    // Optional suffix removal
    if (removeSuffixes) {
        normalized = normalized
            .replace(/\^[a-zA-Z1-9]+$/, '')   // Remove ^A or ^1 style suffixes
            .replace(/_[a-zA-Z1-9]+$/, '')   // Remove _A or _1 style suffixes
            .replace(/_\$\d+$/, '');    // Remove *$1 style suffixes
    }

    if (normalized === '') {
        throw new Error(`Label "${label}" normalizes to empty string`);
    }

    return normalized;
}

/**
 * Creates a lookup map for atom labels with their original forms.
 * @param {Array<string>} labels - Array of atom labels
 * @param {boolean} [removeSuffixes=false] - Whether to handle special suffixes
 * @returns {Map<string, string>} Map of normalized labels to original labels
 */
export function createLabelMap(labels, removeSuffixes = true) {
    const normalizedToOriginals = new Map();
    
    // First pass: group all original labels by their normalized form
    labels.forEach(label => {
        try {
            const normalized = normalizeAtomLabel(label, removeSuffixes);
            if (!normalizedToOriginals.has(normalized)) {
                normalizedToOriginals.set(normalized, []);
            }
            normalizedToOriginals.get(normalized).push(label);
        } catch (error) {
            console.warn(`Skipping invalid label: ${error.message}`);
        }
    });

    // Second pass: only include unique mappings
    const labelMap = new Map();
    for (const [normalized, originals] of normalizedToOriginals.entries()) {
        if (originals.length === 1) {
            labelMap.set(normalized, originals[0]);
        } else {
            console.warn(
                `Multiple labels map to ${normalized}: ` +
                `${originals.join(', ')}. Skipping mapping.`,
            );
        }
    }

    return labelMap;
}

/**
 * Reconciles atom labels in a loop column with reference labels
 * @param {CifLoop} loop - CIF loop containing the column to reconcile
 * @param {string} columnToReconcile - Name of column containing labels to reconcile
 * @param {Array<string>} referenceLabels - Array of reference atom labels
 * @param {boolean} [removeSuffixes=false] - Whether to handle special suffixes
 * @returns {CifLoop} New loop with reconciled labels
 */
export function reconcileAtomLabels(
    loop, 
    columnToReconcile, 
    referenceLabels, 
    removeSuffixes = true,
) {
    const labelMap = createLabelMap(referenceLabels, removeSuffixes);
    const originalValues = loop.get(columnToReconcile);
       
    const reconciledValues = originalValues.map(value => {
        const normalized = normalizeAtomLabel(value, removeSuffixes);
        if (labelMap.has(normalized)) {
            return labelMap.get(normalized);
        }
        return value; 
    });
    
    loop.data[columnToReconcile] = reconciledValues;  
}

/**
 * Test if two atom labels match after normalization
 * @param {string} label1 - First atom label
 * @param {string} label2 - Second atom label
 * @param {boolean} [removeSuffixes=false] - Whether to handle special suffixes
 * @returns {boolean} True if labels match after normalization
 * @throws {Error} If either label is empty
 */
export function atomLabelsMatch(label1, label2, removeSuffixes = true) {
    return normalizeAtomLabel(label1, removeSuffixes) === normalizeAtomLabel(label2, removeSuffixes);
}