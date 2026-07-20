// Export core functionality
export { CIF } from './lib/read-cif/base.js';
export { CrystalStructure } from './lib/structure/crystal.js';
export { ORTEP3JsStructure } from './lib/ortep3d/ortep.js';
export { formatValueEsd } from './lib/formatting.js';
export {
    calculateDifferenceDensityMap,
    createCifDifferenceDensityDataset,
    parseDifferenceDensitySource,
} from './lib/density/difference-density.js';
export { DEFAULT_DIFFERENCE_DENSITY_OPTIONS } from './lib/density/difference-density-options.js';
export { DEFAULT_ISOSURFACE_OPTIONS } from './lib/density/isosurface-options.js';
export { DEFAULT_CONTOUR_LINE_OPTIONS } from './lib/density/contour-line-options.js';
export { DEFAULT_SCALAR_FIELD_OPTIONS } from './lib/density/scalar-field-options.js';
export { BOHR_TO_ANGSTROM, parseCube } from './lib/density/cube.js';
export { ScalarFieldGrid } from './lib/density/scalar-field.js';
export { calculatePlanarContours, resolveContourPlane } from './lib/density/plane-contours.js';
export {
    createIsosurfaces,
    isosurfaceBounds,
    isosurfaceResolution,
} from './lib/density/isosurface.js';
export {
    connectedIsosurfaceRegions,
    createSymmetryAwareIsosurfaces,
} from './lib/density/symmetry-isosurface.js';
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
export {
    ViewerInteractionCoupling,
    coupleViewerInteractions,
} from './lib/ortep3d/viewer-interaction-coupling.js';
export { ThreeIsosurfaceLayer } from './lib/ortep3d/three-isosurface-layer.js';
export { ThreeContourLineLayer } from './lib/ortep3d/three-contour-line-layer.js';

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
