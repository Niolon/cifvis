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

/**
 * Calculates one shared white-mix fraction that brings the darkest colour in
 * a palette up to a relative-luminance floor - the dark-background
 * counterpart of paletteLuminanceScale. Mixing towards white (instead of
 * multiplying) also brightens pure black, and applying the same fraction to
 * the whole palette preserves every between-colour brightness relationship.
 * @param {Array<THREE.ColorRepresentation|THREE.Color>} colors - Palette colours
 * @param {number} floor - Minimum relative luminance, from 0 to 1
 * @returns {number} White-mix fraction from 0 to 1 for liftColorLuminance
 */
export function paletteLuminanceLift(colors, floor = 0) {
    const minimum = THREE.MathUtils.clamp(floor, 0, 1);
    const darkest = colors.reduce(
        (current, color) => Math.min(current, colorLuminance(color)),
        1,
    );
    if (darkest >= minimum) {
        return 0;
    }
    return darkest < 1 ? (minimum - darkest) / (1 - darkest) : 0;
}

/**
 * Applies a shared white-mix fraction without mutating the input colour.
 * Because relative luminance is linear in RGB, mixing a fraction t towards
 * white raises a colour's luminance from L to L + t * (1 - L).
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @param {number} lift - White-mix fraction from paletteLuminanceLift
 * @returns {THREE.Color} Lifted colour
 */
export function liftColorLuminance(color, lift) {
    const result = new THREE.Color().set(color);
    return result.lerp(new THREE.Color(1, 1, 1), THREE.MathUtils.clamp(lift, 0, 1));
}
