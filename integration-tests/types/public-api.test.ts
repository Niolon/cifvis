import {
    CIF,
    CifViewWidget,
    CrystalStructure,
    CrystalViewer,
    DEFAULT_VIEWER_OPTIONS,
    MeasurementControls,
    UAnisoADP,
} from 'cifvis';
import {
    BondGenerator,
    formatAtomLabel,
    measureAtoms,
    tryToFixCifBlock,
} from 'cifvis/core';
import {
    DEFAULT_DIFFERENCE_DENSITY_OPTIONS,
    ScalarFieldGrid,
    calculateIAMStructureFactors,
    parseCube,
} from 'cifvis/density';
import {
    ORTEP3JsStructure,
    ThreeContourLineLayer,
    ThreeIsosurfaceLayer,
    ViewerInteractionCoupling,
} from 'cifvis/experimental';
import 'cifvis/widget/register';

// Compile-time package contract: every public entry point resolves through the
// package export map, and its documented exports retain declaration identities.
void [
    CIF,
    CifViewWidget,
    CrystalStructure,
    CrystalViewer,
    DEFAULT_VIEWER_OPTIONS,
    MeasurementControls,
    UAnisoADP,
    BondGenerator,
    formatAtomLabel,
    measureAtoms,
    tryToFixCifBlock,
    DEFAULT_DIFFERENCE_DENSITY_OPTIONS,
    ScalarFieldGrid,
    calculateIAMStructureFactors,
    parseCube,
    ORTEP3JsStructure,
    ThreeContourLineLayer,
    ThreeIsosurfaceLayer,
    ViewerInteractionCoupling,
];

const cif = new CIF('data_example\n');
const block = cif.getBlock(0);
void block;

const cubeText: Parameters<typeof parseCube>[0] = 'cube contents';
void cubeText;

// @ts-expect-error Viewer defaults are exposed as read-only package constants.
DEFAULT_VIEWER_OPTIONS.renderMode = 'continuous';

// @ts-expect-error Browser classes are intentionally absent from cifvis/core.
const CoreViewer: typeof import('cifvis/core')['CrystalViewer'] = CrystalViewer;
void CoreViewer;
