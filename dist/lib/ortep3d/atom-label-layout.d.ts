/**
 * Tests whether two axis-aligned rectangles overlap.
 * Touching edges are allowed.
 * @param {{left: number, right: number, top: number, bottom: number}} a - First rectangle
 * @param {{left: number, right: number, top: number, bottom: number}} b - Second rectangle
 * @returns {boolean} Whether the rectangles overlap
 */
export function rectanglesOverlap(a: {
    left: number;
    right: number;
    top: number;
    bottom: number;
}, b: {
    left: number;
    right: number;
    top: number;
    bottom: number;
}): boolean;
/**
 * Tests whether a rectangle overlaps a circular atom obstacle.
 * @param {{left: number, right: number, top: number, bottom: number}} rect - Label rectangle
 * @param {{x: number, y: number, radius: number}} circle - Atom obstacle
 * @returns {boolean} Whether the two shapes overlap
 */
export function rectangleOverlapsCircle(rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
}, circle: {
    x: number;
    y: number;
    radius: number;
}): boolean;
/**
 * Tests whether a line segment intersects a rectangle expanded by a radius.
 * Uses a slab intersection, so bond thickness can be represented without
 * converting every bond to a polygon.
 * @param {object} segment - Segment, with an optional radius.
 * @param {{left: number, right: number, top: number, bottom: number}} rect - Rectangle
 * @returns {boolean} Whether the thick segment intersects the rectangle
 */
export function segmentIntersectsRectangle(segment: object, rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
}): boolean;
/**
 * Tests whether two thick line segments cross or approach within their radii.
 * @param {object} a - First segment, with an optional radius.
 * @param {object} b - Second segment, with an optional radius.
 * @returns {boolean} Whether the segments overlap
 */
export function segmentsOverlap(a: object, b: object): boolean;
/**
 * Tests whether a point lies in a polygon using an even-odd ray crossing test.
 * @param {{x: number, y: number}} point - Test point
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} Whether the point is inside the polygon
 */
export function pointInPolygon(point: {
    x: number;
    y: number;
}, polygon: Array<{
    x: number;
    y: number;
}>): boolean;
/**
 * Places atom labels in screen space without overlapping atoms or other labels.
 * Labels which cannot be placed are returned in `hidden` rather than overlapped.
 * @param {Array<object>} labels - Measured, projected label requests
 * @param {Array<{x: number, y: number, radius: number}>} atomObstacles - Projected atom footprints
 * @param {Array<{x1: number, y1: number, x2: number, y2: number, radius: number}>} bondObstacles - Bonds
 * @param {Array<Array<{x: number, y: number}>>} ringPolygons - Projected ring interiors
 * @param {{width: number, height: number}} viewport - Available CSS-pixel viewport
 * @param {object} options - Layout options
 * @param {Map<string, object>} [previousPlacements] - Placements from the prior frame
 * @returns {{placed: Array<object>, hidden: Array<object>}} Layout result
 */
export function layoutAtomLabels(labels: Array<object>, atomObstacles: Array<{
    x: number;
    y: number;
    radius: number;
}>, bondObstacles: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    radius: number;
}>, ringPolygons: Array<Array<{
    x: number;
    y: number;
}>>, viewport: {
    width: number;
    height: number;
}, options: object, previousPlacements?: Map<string, object>): {
    placed: Array<object>;
    hidden: Array<object>;
};
/**
 * Small uniform-grid spatial index used by the label solver. Objects spanning
 * more than one cell are registered in every touched cell and deduplicated on query.
 */
export class SpatialHash {
    /**
     * @param {number} [cellSize] - Cell width/height in CSS pixels
     */
    constructor(cellSize?: number);
    cellSize: number;
    cells: Map<any, any>;
    /**
     * Inserts an item under an axis-aligned bound.
     * @param {object} item - Indexed item
     * @param {object} bounds - Axis-aligned bounds
     */
    insert(item: object, bounds: object): void;
    /**
     * Removes an item from every cell touched by its former bounds.
     * @param {object} item - Previously indexed item
     * @param {object} bounds - Bounds used when the item was inserted
     */
    remove(item: object, bounds: object): void;
    /**
     * Returns items which may intersect a bound.
     * @param {object} bounds - Query bounds
     * @returns {object[]} Deduplicated candidate items
     */
    query(bounds: object): object[];
}
//# sourceMappingURL=atom-label-layout.d.ts.map