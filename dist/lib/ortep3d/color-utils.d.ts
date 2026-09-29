/**
 * Calculates WCAG/Rec. 709 relative luminance from a Three.js linear RGB color.
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @returns {number} Relative luminance in the range 0-1
 */
export function colorLuminance(color: THREE.ColorRepresentation | THREE.Color): number;
/**
 * Calculates one scale factor that brings the brightest colour in a palette
 * to a relative-luminance ceiling. Applying it to the whole palette preserves
 * every between-colour brightness relationship instead of clipping colours
 * independently at the ceiling.
 * @param {Array<THREE.ColorRepresentation|THREE.Color>} colors - Palette colours
 * @param {number} ceiling - Maximum relative luminance, from 0 to 1
 * @returns {number} Linear RGB scale factor from 0 to 1
 */
export function paletteLuminanceScale(colors: Array<THREE.ColorRepresentation | THREE.Color>, ceiling?: number): number;
/**
 * Applies a shared linear RGB palette scale without mutating the input colour.
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @param {number} scale - Palette scale factor
 * @returns {THREE.Color} Scaled colour
 */
export function scaleColorLuminance(color: THREE.ColorRepresentation | THREE.Color, scale: number): THREE.Color;
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
export function paletteLuminanceLift(colors: Array<THREE.ColorRepresentation | THREE.Color>, floor?: number): number;
/**
 * Applies a shared white-mix fraction without mutating the input colour.
 * Because relative luminance is linear in RGB, mixing a fraction t towards
 * white raises a colour's luminance from L to L + t * (1 - L).
 * @param {THREE.ColorRepresentation|THREE.Color} color - Input colour
 * @param {number} lift - White-mix fraction from paletteLuminanceLift
 * @returns {THREE.Color} Lifted colour
 */
export function liftColorLuminance(color: THREE.ColorRepresentation | THREE.Color, lift: number): THREE.Color;
import * as THREE from 'three';
//# sourceMappingURL=color-utils.d.ts.map