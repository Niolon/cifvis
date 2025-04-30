import { CrystalStructure, CIF } from '../../src';
import { growSymmetry } from '../../src/lib/structure/structure-modifiers/grow-symmetry.js';

const baseUrl = import.meta.env.BASE_URL;
fetch(`${baseUrl}cif/ED_para_Ag_3.cif`)
    .then(res => res.text())
    .then(cifText => {
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
        const _output = growSymmetry(structure);
    });

fetch(`${baseUrl}cif/urea.cif`)
    .then(res => res.text())
    .then(cifText => {
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
        const _output = growSymmetry(structure);
    });

fetch(`${baseUrl}cif/CaF2.cif`)
    .then(res => res.text())
    .then(cifText => {
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
        const _output = growSymmetry(structure);
    });

fetch(`${baseUrl}cif/sucrose.cif`)
    .then(res => res.text())
    .then(cifText => {
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
        const _output = growSymmetry(structure);
    });