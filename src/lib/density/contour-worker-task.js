import { UnitCell } from '../structure/crystal.js';
import { calculatePlanarContours, packPlanarContours } from './plane-contours.js';

/**
 * @param {object} payload - Worker-safe structure payload.
 * @returns {object} Minimal structure reconstructed from a worker-safe payload.
 */
function structureFromPayload(payload) {
    return {
        cell: new UnitCell(
            payload.cell.a,
            payload.cell.b,
            payload.cell.c,
            payload.cell.alpha,
            payload.cell.beta,
            payload.cell.gamma,
        ),
        atoms: payload.atoms,
    };
}

/**
 * Samples and contours a scalar field without depending on Three.js.
 * Progressive fractions reduce only the plane investigation density; the
 * physical plane, levels, colours, and line presentation remain unchanged.
 * @param {object} field - Scalar field exposing sample/sampleCubic.
 * @param {object|null} request - Worker-safe structure and contour options.
 * @param {number} resolutionFraction - Current progressive resolution fraction.
 * @returns {object|null} Packed transferable contour data.
 */
export function calculateContourWorkerTask(field, request, resolutionFraction) {
    if (!request) {
        return null;
    }
    const fraction = Math.max(0.1, Number(resolutionFraction) || 1);
    const options = {
        ...request.options,
        resolution: Math.max(8, Math.round(request.options.resolution * fraction)),
        maxResolution: Math.max(8, Math.round(request.options.maxResolution * fraction)),
        gridSpacing: request.options.gridSpacing / fraction,
    };
    const contours = packPlanarContours(calculatePlanarContours(
        field,
        structureFromPayload(request.structure),
        options,
    ));
    contours.displayVersion = request.displayVersion;
    return contours;
}

/**
 * @param {object|null} contours - Packed contour result.
 * @returns {ArrayBuffer[]} Buffers transferred with a packed contour result.
 */
export function contourTransferables(contours) {
    return contours
        ? [
            contours.positiveSegments.buffer,
            contours.negativeSegments.buffer,
            contours.zeroSegments.buffer,
        ]
        : [];
}
