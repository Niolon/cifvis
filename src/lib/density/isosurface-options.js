export const DEFAULT_ISOSURFACE_OPTIONS = Object.freeze({
    useSymmetry: true,
    progressiveSteps: Object.freeze([0.5, 0.75, 1]),
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
    // The sparse patch path is available for benchmarked opt-in use. Keep the
    // established symmetry-aware path as the default until the COD performance
    // gate demonstrates that patch enumeration is a consistent win.
    generationMode: 'legacy',
    // Numerical extraction is independent from the cache/generation strategy.
    // Three.js remains available as the validation/fallback implementation.
    surfaceExtractor: 'cifvis',
    patchCacheMaxBytes: 64 * 1024 * 1024,
});
