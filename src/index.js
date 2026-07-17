// Export core functionality
export { CIF } from './lib/read-cif/base.js';
export { CrystalStructure } from './lib/structure/crystal.js';
export { ORTEP3JsStructure } from './lib/ortep3d/ortep.js';
export { formatValueEsd } from './lib/formatting.js';
export {
    calculateDifferenceDensityMap,
    createCifDifferenceDensityDataset,
    DifferenceDensityMap,
    parseDifferenceDensitySource,
} from './lib/density/difference-density.js';
export { DEFAULT_DIFFERENCE_DENSITY_OPTIONS } from './lib/density/difference-density-options.js';
export { lookupAnomalousDispersion } from './lib/density/anomalous-dispersion.js';
export {
    calculateIAMStructureFactors,
    createIAMStructureFactorCalculator,
    evaluateCromerMann,
    lookupCromerMann,
} from './lib/density/iam-structure-factors.js';
export {
    isSystematicAbsence,
    mergeReflectionIntensities,
    readReflectionIntensities,
} from './lib/density/reflection-intensities.js';
export { tryToFixCifBlock } from './lib/fix-cif/base.js';
export { getDisorderIcon, generateDisorderGroupIcon } from './lib/disorder-icons.js';
export { 
    HydrogenFilter, DisorderFilter, SymmetryGrower, 
} from './lib/structure/structure-modifiers/modes.js';
export {
    AtomLabelFilter, BondGenerator,
} from './lib/structure/structure-modifiers/fixers.js';

// Export DOM-dependent features
export { CrystalViewer } from './lib/ortep3d/crystal-viewer.js';

import  { CifViewWidget } from './lib/widget.js';

// Register web component
if (typeof window !== 'undefined' && window.customElements) {
    try {
        window.customElements.define('cifview-widget', CifViewWidget);
    } catch (e) {
        if (!e.message.includes('already been defined')) {
            console.warn('Failed to register cifview-widget:', e);
        }
    }
}

export { CifViewWidget };
