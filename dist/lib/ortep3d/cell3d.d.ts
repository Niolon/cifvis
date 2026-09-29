/**
 * Creates a 3D representation of a unit cell using Three.js with proper wireframe edges.
 * @param {UnitCell} cell - The unit cell object containing dimensions and angles
 * @param {object} cellSettings - Settings for the cell representation
 * @param {string} cellSettings.boxColor - Color of the cell wireframe
 * @param {number} cellSettings.boxOpacity - Opacity of the cell wireframe
 * @param {number} cellSettings.boxLineWidth - Width of wireframe lines
 * @param {string} cellSettings.arrowColorA - Color for axis A
 * @param {string} cellSettings.arrowColorB - Color for axis B
 * @param {string} cellSettings.arrowColorC - Color for axis C
 * @param {number} cellSettings.arrowHeadLengthMult - Head length as fraction of smallest axis
 * @param {number} cellSettings.arrowHeadWidthMult - Head width as fraction of head length
 * @param {number} cellSettings.arrowCylinderRadius - Radius of the arrow shaft cylinders
 * @returns {THREE.Group} A Three.js Group containing the cell wireframe and axes
 */
export function createCell3D(cell: UnitCell, cellSettings: {
    boxColor: string;
    boxOpacity: number;
    boxLineWidth: number;
    arrowColorA: string;
    arrowColorB: string;
    arrowColorC: string;
    arrowHeadLengthMult: number;
    arrowHeadWidthMult: number;
    arrowCylinderRadius: number;
}): THREE.Group;
import { UnitCell } from '../structure/crystal.js';
import * as THREE from 'three';
//# sourceMappingURL=cell3d.d.ts.map