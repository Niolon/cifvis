/**
 * Validates metal-ring centroid detection and dash settings.
 * @param {object} options - Fully merged centroid options
 * @returns {void}
 */
export function validateMetalRingCentroidOptions(options: object): void;
/**
 * Enumerates canonical chordless cycles reachable from selected ligand atoms.
 * @param {Map<string, Set<string>>} adjacency - Ligand graph adjacency
 * @param {Iterable<string>} starts - Existing centre-neighbour atom IDs
 * @param {number} minSize - Minimum cycle size
 * @param {number} maxSize - Maximum cycle size
 * @param {Set<string>} [excluded] - Atom IDs that traversal must not enter
 * @returns {Array<{key:string, atoms:string[]}>} Unique cycles
 */
export function findChordlessCycles(adjacency: Map<string, Set<string>>, starts: Iterable<string>, minSize: number, maxSize: number, excluded?: Set<string>): Array<{
    key: string;
    atoms: string[];
}>;
/**
 * Returns a rendering plan without mutating the structure or its bonds.
 * @param {object} structure - Displayed crystal structure
 * @param {object[]} drawableBonds - Existing visible regular bonds
 * @param {object} options - Fully merged centroid options
 * @returns {{interactions:object[], suppressedBonds:Set<object>}} Rendering plan
 */
export function findMetalRingCentroidInteractions(structure: object, drawableBonds: object[], options: object): {
    interactions: object[];
    suppressedBonds: Set<object>;
};
/**
 * Produces visible dash intervals with an even leading gap and a terminal dash at the centroid.
 * @param {number} length - Total interaction length
 * @param {number} targetPeriod - Approximate dash-plus-gap period
 * @param {number} dashFraction - Solid fraction of each period
 * @returns {Array<{start:number, end:number}>} Visible dash intervals
 */
export function layoutCentroidDashes(length: number, targetPeriod: number, dashFraction: number): Array<{
    start: number;
    end: number;
}>;
export const DEFAULT_METAL_CENTRE_ELEMENTS: string[];
export namespace DEFAULT_METAL_RING_CENTROID_OPTIONS {
    export { DEFAULT_METAL_CENTRE_ELEMENTS as centreElements };
    export let ringElements: string[];
    export let minRingSize: number;
    export let maxRingSize: number;
    export let minBondedAtoms: number;
    export let minRingCoverage: number;
    export let requireGeometryCheck: boolean;
    export let maxRingPlanarityRatio: number;
    export let maxLateralDisplacementRatio: number;
    export let maxDistanceSpreadRatio: number;
    export let dashSegmentLength: number;
    export let dashFraction: number;
}
//# sourceMappingURL=metal-ring-centroids.d.ts.map