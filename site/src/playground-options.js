/**
 * Parses one comma-separated numeric three-vector.
 * @param {string} value - Comma-separated values.
 * @returns {number[]|null} Finite vector or null.
 */
function vector(value) {
    const values = value?.split(',').map(Number);
    return values?.length === 3 && values.every(Number.isFinite) ? values : null;
}

/**
 * Parses the compact playground contour-plane flag.
 * @param {string|null} value - `best-fit`, `atoms:A,B,C`, or coordinate form.
 * @returns {object|null} Public CrystalViewer plane option.
 */
export function parseContourPlaneFlag(value) {
    if (value === 'best-fit') {
        return { mode: 'best-fit' };
    }
    if (value?.startsWith('atoms:')) {
        const atoms = value.slice('atoms:'.length).split(',').filter(Boolean);
        return atoms.length >= 3 ? { atoms } : null;
    }
    const [coordinateSystem, originValue, normalValue, extra] = value?.split(':') ?? [];
    const systems = { frac: 'fractional', cart: 'cartesian' };
    const origin = vector(originValue);
    const normal = vector(normalValue);
    if (systems[coordinateSystem] && origin && normal && extra === undefined) {
        return { coordinateSystem: systems[coordinateSystem], origin, normal };
    }
    return null;
}

/**
 * Reads public playground options from a query string.
 * @param {string} search - URL query string including the optional leading `?`.
 * @returns {object} CrystalViewer options derived from the URL.
 */
export function getPlaygroundViewerOptions(search) {
    const params = new URLSearchParams(search);
    const style = params.get('style');
    const validStyles = ['solid-3d', 'cutout-3d', 'cutout-2d'];
    const labels = params.get('labels');
    const validLabelModes = ['all', 'non-hydrogen', 'none'];
    const labelPlacement = params.get('label-mode');
    const validLabelPlacements = [
        'auto-omit',
        'quality-omit',
        'performance-omit',
        'maximum-coverage',
    ];
    const labelCallouts = params.get('label-callouts');
    const validLabelCallouts = ['structure', 'viewport'];
    const maximumConnector = Number(params.get('label-max-connector'));
    const contourPlane = parseContourPlaneFlag(params.get('contours'));
    const options = {};

    if (validStyles.includes(style)) {
        options.renderStyle = style;
    }
    if (validLabelModes.includes(labels)) {
        options.atomLabels = {
            show: labels,
            placementMode: validLabelPlacements.includes(labelPlacement) ?
                labelPlacement : 'auto-omit',
            calloutPlacement: validLabelCallouts.includes(labelCallouts) ?
                labelCallouts : 'structure',
        };
        if (Number.isFinite(maximumConnector) && maximumConnector > 0) {
            options.atomLabels.maxConnectorLength = Math.max(20, Math.min(1000, maximumConnector));
        }
    }
    if (contourPlane) {
        options.contourLines = { enabled: true, plane: contourPlane };
    }
    return options;
}
