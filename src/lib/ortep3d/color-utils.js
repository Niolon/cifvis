import * as THREE from 'three';

/**
 * Calculates WCAG/Rec. 709 relative luminance from a Three.js linear RGB color.
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @returns {number} Relative luminance in the range 0-1
 */
export function colorLuminance(color) {
    const linearColor = color?.isColor ? color : new THREE.Color(color);
    return 0.2126 * linearColor.r + 0.7152 * linearColor.g + 0.0722 * linearColor.b;
}

/**
 * Calculates one scale factor that brings the brightest colour in a palette
 * to a relative-luminance ceiling. Applying it to the whole palette preserves
 * every between-colour brightness relationship instead of clipping colours
 * independently at the ceiling.
 * @param {Array<THREE.ColorRepresentation|THREE.Color>} colors - Palette colours
 * @param {number} ceiling - Maximum relative luminance, from 0 to 1
 * @returns {number} Linear RGB scale factor from 0 to 1
 */
export function paletteLuminanceScale(colors, ceiling = 1) {
    const maximum = THREE.MathUtils.clamp(ceiling, 0, 1);
    const brightest = colors.reduce(
        (current, color) => Math.max(current, colorLuminance(color)),
        0,
    );
    return brightest > maximum && brightest > 0 ? maximum / brightest : 1;
}

/**
 * Applies a shared linear RGB palette scale without mutating the input colour.
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @param {number} scale - Palette scale factor
 * @returns {THREE.Color} Scaled colour
 */
export function scaleColorLuminance(color, scale) {
    const result = new THREE.Color().set(color);
    return result.multiplyScalar(THREE.MathUtils.clamp(scale, 0, 1));
}
