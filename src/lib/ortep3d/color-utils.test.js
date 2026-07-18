import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
    colorLuminance,
    liftColorLuminance,
    paletteLuminanceLift,
    paletteLuminanceScale,
    scaleColorLuminance,
} from './color-utils.js';

describe('readable color luminance', () => {
    test('leaves a wholly dark palette unscaled', () => {
        const scale = paletteLuminanceScale(['#111111', '#222222'], 0.25);

        expect(scale).toBe(1);
    });

    test('scales the brightest palette color to the ceiling', () => {
        const scale = paletteLuminanceScale(['#ffffff', '#ffff99', '#222222'], 0.25);
        const white = scaleColorLuminance('#ffffff', scale);

        expect(colorLuminance(white)).toBeCloseTo(0.25, 6);
    });

    test('preserves within-color and between-color luminance ratios', () => {
        const first = new THREE.Color('#ffff99');
        const second = new THREE.Color('#ff0d0d');
        const scale = paletteLuminanceScale(['#ffffff', first, second], 0.25);
        const scaledFirst = scaleColorLuminance(first, scale);
        const scaledSecond = scaleColorLuminance(second, scale);

        expect(scaledFirst.r / scaledFirst.g).toBeCloseTo(first.r / first.g, 6);
        expect(scaledFirst.b / scaledFirst.r).toBeCloseTo(first.b / first.r, 6);
        expect(colorLuminance(scaledFirst) / colorLuminance(scaledSecond)).toBeCloseTo(
            colorLuminance(first) / colorLuminance(second),
            6,
        );
    });
});

describe('dark-background luminance floor', () => {
    test('leaves an already bright palette unlifted', () => {
        expect(paletteLuminanceLift(['#ffffff', '#cccccc'], 0.25)).toBe(0);
    });

    test('lifts the darkest palette color (including black) to the floor', () => {
        const lift = paletteLuminanceLift(['#000000', '#ffffff'], 0.35);
        const black = liftColorLuminance('#000000', lift);

        expect(lift).toBeGreaterThan(0);
        expect(colorLuminance(black)).toBeCloseTo(0.35, 6);
    });

    test('preserves luminance ordering when lifting', () => {
        const dark = new THREE.Color('#111111');
        const bright = new THREE.Color('#ff0d0d');
        const lift = paletteLuminanceLift([dark, bright], 0.4);
        const liftedDark = liftColorLuminance(dark, lift);
        const liftedBright = liftColorLuminance(bright, lift);

        expect(colorLuminance(liftedDark)).toBeLessThan(colorLuminance(liftedBright));
        expect(colorLuminance(liftedBright)).toBeGreaterThan(colorLuminance(bright));
    });
});
