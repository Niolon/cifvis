import { create, all } from 'mathjs';
import * as lite from '../src/lib/math-lite.js';

const mj = create(all, {});

let failures = 0;
/**
 * Compares two numbers or (nested) arrays of numbers for approximate equality and logs a failure.
 * @param {number|Array} a - first value
 * @param {number|Array} b - second value
 * @param {number} tol - allowed absolute difference
 * @param {string} label - label used in the failure message
 */
function approxEqual(a, b, tol = 1e-8, label = '') {
    const flatA = Array.isArray(a) ? a.flat(2) : [a];
    const flatB = Array.isArray(b) ? b.flat(2) : [b];
    if (flatA.length !== flatB.length) {
        console.log(`FAIL ${label}: length mismatch`, a, b);
        failures++;
        return;
    }
    for (let i = 0; i < flatA.length; i++) {
        if (Math.abs(flatA[i] - flatB[i]) > tol) {
            console.log(`FAIL ${label}: mismatch at ${i}`, a, b);
            failures++;
            return;
        }
    }
}

/**
 * Generates a random 3x3 matrix with entries in [-2, 2).
 * @returns {number[][]} random 3x3 matrix
 */
function randMat3() {
    return [0, 1, 2].map(() => [0, 1, 2].map(() => Math.random() * 4 - 2));
}
/**
 * Generates a random symmetric 3x3 matrix.
 * @returns {number[][]} random symmetric 3x3 matrix
 */
function randSymMat3() {
    const m = randMat3();
    return m.map((row, i) => row.map((_, j) => (m[i][j] + m[j][i]) / 2));
}
/**
 * Generates a random 3-vector with entries in [-2, 2).
 * @returns {number[]} random 3-vector
 */
function randVec3() {
    return [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2];
}

for (let trial = 0; trial < 200; trial++) {
    const A = randMat3();
    const B = randMat3();
    const v = randVec3();
    const w = randVec3();
    const sym = randSymMat3();

    approxEqual(mj.multiply(A, B), lite.multiply(A, B), 1e-8, 'multiply mat*mat');
    approxEqual(mj.multiply(A, v), lite.multiply(A, v), 1e-8, 'multiply mat*vec');
    approxEqual(mj.multiply(A, 2.5), lite.multiply(A, 2.5), 1e-8, 'multiply mat*scalar');
    approxEqual(mj.add(v, w), lite.add(v, w), 1e-8, 'add vec+vec');
    approxEqual(mj.subtract(v, w), lite.subtract(v, w), 1e-8, 'subtract vec-vec');
    approxEqual(mj.transpose(A), lite.transpose(A), 1e-8, 'transpose');
    approxEqual(mj.det(A), lite.det(A), 1e-6, 'det');
    approxEqual(mj.inv(A), lite.inv(A), 1e-6, 'inv');
    approxEqual(mj.diag(v), lite.diag(v), 1e-8, 'diag');
    approxEqual(mj.norm(v), lite.norm(v), 1e-8, 'norm');

    const mjEigs = mj.eigs(sym);
    const liteEigs = lite.eigs(sym);
    const mjVals = [...mjEigs.values].sort((a, b) => a - b);
    const liteVals = [...liteEigs.values].sort((a, b) => a - b);
    approxEqual(mjVals, liteVals, 1e-5, 'eigenvalues');

    // Verify eigenvector reconstruction: M*v = lambda*v for each lite eigenpair
    for (const { value, vector } of liteEigs.eigenvectors) {
        const vec = vector.toArray();
        const Mv = lite.multiply(sym, vec);
        const lambdaV = vec.map(x => x * value);
        approxEqual(Mv, lambdaV, 1e-5, 'eigenvector M*v = lambda*v');
        const normV = lite.norm(vec);
        approxEqual(normV, 1, 1e-6, 'eigenvector is unit length');
    }
}

const alpha = 91.3;
approxEqual(
    mj.unit(alpha, 'deg').toNumber('rad'),
    lite.unit(alpha, 'deg').toNumber('rad'),
    1e-10,
    'unit deg->rad',
);

console.log(failures === 0 ? 'All parity checks passed (200 trials)' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
