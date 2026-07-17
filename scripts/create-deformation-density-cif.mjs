/* eslint-disable jsdoc/require-jsdoc -- command-line generation helpers */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CIF } from '../src/lib/read-cif/base.js';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 3) {
    throw new Error(
        'Usage: create-deformation-density-cif.mjs <coordinate.cif> <har.fcf> <output.cif>',
    );
}
const [coordinateArgument, gpawArgument, outputArgument] = arguments_;

const coordinatePath = resolve(coordinateArgument);
const gpawPath = resolve(gpawArgument);
const outputPath = resolve(outputArgument);

function reflectionCoefficients(path) {
    const block = new CIF(readFileSync(path, 'utf8'), false).getBlock(0);
    const loop = block.get('_refln');
    const h = loop.get(['_refln.index_h', '_refln_index_h']);
    const k = loop.get(['_refln.index_k', '_refln_index_k']);
    const l = loop.get(['_refln.index_l', '_refln_index_l']);
    const amplitudes = loop.get(['_refln.F_calc', '_refln_F_calc']);
    const phases = loop.get(['_refln.phase_calc', '_refln_phase_calc']);
    const lengths = [h, k, l, amplitudes, phases].map(values => values.length);
    if (!lengths.every(length => length === lengths[0])) {
        throw new Error(`Inconsistent reflection columns in ${path}: ${lengths.join(', ')}`);
    }
    return h.map((hValue, index) => {
        const reflection = {
            h: Number(hValue),
            k: Number(k[index]),
            l: Number(l[index]),
            amplitude: Number(amplitudes[index]),
            phase: Number(phases[index]),
        };
        if (!Object.values(reflection).every(Number.isFinite)) {
            throw new Error(`Non-numeric reflection coefficient at row ${index + 1} in ${path}`);
        }
        return reflection;
    });
}

function complexCoefficient(reflection) {
    const phase = reflection.phase * Math.PI / 180;
    return {
        real: reflection.amplitude * Math.cos(phase),
        imaginary: reflection.amplitude * Math.sin(phase),
    };
}

function fixed(value, decimals = 6) {
    const threshold = 0.5 * 10 ** -decimals;
    return (Math.abs(value) < threshold ? 0 : value).toFixed(decimals);
}

const coordinateText = readFileSync(coordinatePath, 'utf8').trimEnd();
const gpaw = reflectionCoefficients(gpawPath);
const iam = createIAMStructureFactorCalculator(coordinateText, 0, {
    includeAnomalous: false,
}).calculate(gpaw);

const rows = gpaw.map((reflection, index) => {
    const iamReflection = iam[index];
    const gpawComplex = complexCoefficient(reflection);
    const iamComplex = {
        real: iamReflection.real,
        imaginary: iamReflection.imaginary,
    };
    return [
        reflection.h,
        reflection.k,
        reflection.l,
        fixed(reflection.amplitude),
        fixed(reflection.phase),
        fixed(iamReflection.amplitude),
        fixed(iamReflection.phase),
        fixed(gpawComplex.real - iamComplex.real),
        fixed(gpawComplex.imaginary - iamComplex.imaginary),
    ].join(' ');
});

const customLoop = `

# cifvis custom deformation-density coefficients.
# Default sign: GPAW/SCAN HAR minus IAM at the GPAW geometry and ADPs.
_cifvis_deformation_density_model_first 'GPAW/SCAN HAR'
_cifvis_deformation_density_model_second 'neutral-atom IAM at GPAW geometry and ADPs'
_cifvis_deformation_density_sign 'first minus second'
_cifvis_deformation_density_phase_unit degrees
_cifvis_deformation_density_source_first '${gpawPath.split('/').at(-1)}'
_cifvis_deformation_density_source_second 'calculated from ${coordinatePath.split('/').at(-1)}'
_cifvis_deformation_density_iam_anomalous_dispersion no
_cifvis_difference_density_loop '_cifvis_deformation_refln'
_cifvis_difference_density_h '_cifvis_deformation_refln.index_h'
_cifvis_difference_density_k '_cifvis_deformation_refln.index_k'
_cifvis_difference_density_l '_cifvis_deformation_refln.index_l'
_cifvis_difference_density_a '_cifvis_deformation_refln.difference_a'
_cifvis_difference_density_b '_cifvis_deformation_refln.difference_b'
_cifvis_difference_density_kind deformation

loop_
 _cifvis_deformation_refln.index_h
 _cifvis_deformation_refln.index_k
 _cifvis_deformation_refln.index_l
 _cifvis_deformation_refln.amplitude_gpaw
 _cifvis_deformation_refln.phase_gpaw
 _cifvis_deformation_refln.amplitude_iam
 _cifvis_deformation_refln.phase_iam
 _cifvis_deformation_refln.difference_a
 _cifvis_deformation_refln.difference_b
${rows.join('\n')}
`;

writeFileSync(outputPath, coordinateText + customLoop, 'utf8');
console.log(`Wrote ${rows.length} deformation coefficients to ${outputPath}`);
