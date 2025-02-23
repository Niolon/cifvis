// Export only non-DOM functionality
export { CIF } from './lib/read-cif/base.js';
export { CrystalStructure } from './lib/structure/crystal.js';
export { ORTEP3JsStructure } from './lib/ortep3d/ortep.js';
export { formatValueEsd } from './lib/formatting.js';
export { tryToFixCifBlock } from './lib/fix-cif/base.js';
export { 
    HydrogenFilter, DisorderFilter, SymmetryGrower, AtomLabelFilter, BondGenerator,
} from './lib/structure/structure-modifiers.js';
// Stub DOM-dependent features
export class CrystalViewer {
    constructor() {
        throw new Error('CrystalViewer is not available in non-DOM environments');
    }
}

export class CifViewWidget {
    constructor() {
        throw new Error('CifViewWidget is not available in non-DOM environments');
    }
}