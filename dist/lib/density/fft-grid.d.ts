/**
 * Finds the smallest power-of-two FFT length at least two and not below a bound.
 * @param {number} value - Minimum length.
 * @returns {number} Power-of-two length.
 */
export function nextPowerOfTwo(value: number): number;
/**
 * Tests whether an integer factors entirely into radices 2, 3, and 5.
 * @param {number} value - Candidate FFT length.
 * @returns {boolean} Whether the mixed-radix kernel supports the length.
 */
export function isSmooth235(value: number): boolean;
/**
 * Finds the smallest supported FFT length divisible by a symmetry denominator.
 * @param {number} value - Minimum length.
 * @param {number} divisor - Required screw/glide denominator multiple.
 * @returns {number} Compatible 2/3/5-smooth length.
 */
export function nextSmooth235(value: number, divisor?: number): number;
/**
 * Finds the small crystallographic denominator of a fractional translation.
 * @param {number} value - Fractional translation component.
 * @param {number} tolerance - Maximum rational-approximation residual.
 * @param {number} maximum - Largest crystallographic denominator to consider.
 * @returns {number|null} Compatible denominator, or null for an implausible fraction.
 */
export function fractionalDenominator(value: number, tolerance?: number, maximum?: number): number | null;
/**
 * Chooses a 2/3/5-smooth grid which every supplied space-group operation maps
 * onto itself. Axis-mixing rotations share a dimension; screw/glide
 * translations make the corresponding dimension a denominator multiple.
 * @param {number[]} minimumDimensions - Minimum samples along each fractional axis.
 * @param {object[]} symmetryOperations - Crystallographic rotations and translations.
 * @returns {object} Compatible dimensions and any fallback diagnostic.
 */
export function planCompatibleDimensions(minimumDimensions: number[], symmetryOperations?: object[]): object;
/**
 * Plans production or exact legacy Fourier dimensions from coefficient bounds.
 * @param {Map} coefficients - Reciprocal coefficients keyed by Miller index.
 * @param {number} oversampling - Requested Fourier-grid oversampling.
 * @param {object} options - Backend and crystallographic symmetry metadata.
 * @returns {object} Planned dimensions, reciprocal limits, and diagnostics.
 */
export function planFourierDimensions(coefficients: Map<any, any>, oversampling?: number, options?: object): object;
//# sourceMappingURL=fft-grid.d.ts.map