export const DEFAULT_ISOSURFACE_OPTIONS = Object.freeze({
    useSymmetry: true,
    // The frozen 5,000-structure COD campaign found the final CifVis surface
    // below 100 ms in 99.9% of valid cases. Avoid unconditional preview work;
    // applications may still opt into fractional redraws for unusual workloads.
    progressiveSteps: Object.freeze([1]),
    visible: true,
    sigmaLevel: 3,
    radius: 1.5,
    resolution: 64,
    gridSpacing: 0.15,
    maxResolution: 96,
    stitchTolerance: 1e-4,
    positiveColor: '#267e47',
    negativeColor: '#992a3e',
    deformationPositiveColor: '#4FC3F7',
    deformationNegativeColor: '#FF9800',
    opacity: 0.55,
    wireframe: true,
    maxPolyCount: 100000,
    surfaceCacheMaxBytes: 64 * 1024 * 1024,
});
