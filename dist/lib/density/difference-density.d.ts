/**
 * Creates Fo-Fc coefficients from any supported observed-reflection source and
 * an IAM calculation from the coordinate CIF.
 * @param {string} cifText - CIF containing the observed reflections.
 * @param {number|string} cifBlock - Reflection cell/symmetry block.
 * @param {object} options - IAM, reflection-reading, and scale options.
 * @returns {object} Difference-density dataset.
 */
export function createCifDifferenceDensityDataset(cifText: string, cifBlock?: number | string, options?: object): object;
/**
 * Parses an explicit FCF coefficient source or falls back to CIF observations
 * plus IAM Fcalc when no usable coefficient loop exists.
 * @param {string} text - FCF or coordinate/reflection CIF text.
 * @param {number|string} block - CIF block.
 * @param {object} options - Source selection and parser options.
 * @returns {object} Difference-density dataset.
 */
export function parseDifferenceDensitySource(text: string, block?: number | string, options?: object): object;
/**
 * Parses and symmetry-expands an FCF once so multiple resolution shells can
 * reuse the expensive text/reflection work.
 * @param {string} fcfText - LIST 6/8-style FCF text.
 * @param {number|string} [cifBlock] - FCF block index or name.
 * @param {object|null} [coefficientColumns] - Custom Fourier coefficient columns.
 * @param {boolean|object|null} [anomalousDispersion] - Anomalous correction and coordinate CIF.
 * @param {object} [options] - Dataset options, including an optional coordinate CIF cell fallback.
 * @returns {object} Parsed progressive-density dataset.
 */
export function parseDifferenceDensityDataset(fcfText: string, cifBlock?: number | string, coefficientColumns?: object | null, anomalousDispersion?: boolean | object | null, options?: object): object;
/**
 * Calculates one resolution shell from a previously parsed FCF dataset.
 * @param {object} dataset - Result of parseDifferenceDensityDataset().
 * @param {number} [resolutionFraction] - Fraction of the maximum reciprocal resolution.
 * @param {number} [gridOversampling] - Real-space FFT grid oversampling factor.
 * @returns {ScalarFieldGrid} Periodic difference-density grid.
 */
export function calculateDifferenceDensityMap(dataset: object, resolutionFraction?: number, gridOversampling?: number): ScalarFieldGrid;
import { ScalarFieldGrid } from './scalar-field.js';
//# sourceMappingURL=difference-density.d.ts.map