export const DEFAULT_CONTOUR_LINE_OPTIONS: Readonly<{
    enabled: false;
    plane: Readonly<{
        mode: "best-fit";
    }>;
    padding: 1.5;
    maxAtomDistance: 2.5;
    resolution: 256;
    gridSpacing: 0.04;
    maxResolution: 512;
    interpolation: "tricubic";
    contourCount: 20;
    contourStep: null;
    levelSubdivisions: 4;
    levels: null;
    sign: null;
    zeroLine: false;
    zeroColor: "#666666";
    lineColor: null;
    lineWidth: 1.5;
    haloColor: "#ffffff";
    haloWidth: 1;
    opacity: 1;
    depthOffset: 0.02;
}>;
//# sourceMappingURL=contour-line-options.d.ts.map