import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
    colorLuminance,
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
