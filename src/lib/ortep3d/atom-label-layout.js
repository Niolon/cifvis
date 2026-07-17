/**
 * Tests whether two axis-aligned rectangles overlap.
 * Touching edges are allowed.
 * @param {{left: number, right: number, top: number, bottom: number}} a - First rectangle
 * @param {{left: number, right: number, top: number, bottom: number}} b - Second rectangle
 * @returns {boolean} Whether the rectangles overlap
 */
export function rectanglesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Tests whether a rectangle overlaps a circular atom obstacle.
 * @param {{left: number, right: number, top: number, bottom: number}} rect - Label rectangle
 * @param {{x: number, y: number, radius: number}} circle - Atom obstacle
 * @returns {boolean} Whether the two shapes overlap
 */
export function rectangleOverlapsCircle(rect, circle) {
    const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
    const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.radius * circle.radius;
}

/**
 * Tests whether a line segment intersects a rectangle expanded by a radius.
 * Uses a slab intersection, so bond thickness can be represented without
 * converting every bond to a polygon.
 * @param {{x1: number, y1: number, x2: number, y2: number, radius?: number}} segment - Segment
 * @param {{left: number, right: number, top: number, bottom: number}} rect - Rectangle
 * @returns {boolean} Whether the thick segment intersects the rectangle
 */
export function segmentIntersectsRectangle(segment, rect) {
    const radius = segment.radius || 0;
    const expanded = {
        left: rect.left - radius,
        right: rect.right + radius,
        top: rect.top - radius,
        bottom: rect.bottom + radius,
    };
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    let minimum = 0;
    let maximum = 1;

    for (const [origin, delta, lower, upper] of [
        [segment.x1, dx, expanded.left, expanded.right],
        [segment.y1, dy, expanded.top, expanded.bottom],
    ]) {
        if (Math.abs(delta) < 1e-9) {
            if (origin < lower || origin > upper) {
                return false;
            }
            continue;
        }
        const first = (lower - origin) / delta;
        const second = (upper - origin) / delta;
        minimum = Math.max(minimum, Math.min(first, second));
        maximum = Math.min(maximum, Math.max(first, second));
        if (minimum > maximum) {
            return false;
        }
    }
    return true;
}

/**
 * Calculates the squared distance from a point to a line segment.
 * @param {{x: number, y: number}} point - Point
 * @param {{x1: number, y1: number, x2: number, y2: number}} segment - Segment
 * @returns {number} Squared distance
 */
function pointToSegmentDistanceSquared(point, segment) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return (point.x - segment.x1) ** 2 + (point.y - segment.y1) ** 2;
    }
    const amount = Math.max(0, Math.min(1,
        ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / lengthSquared,
    ));
    const nearestX = segment.x1 + amount * dx;
    const nearestY = segment.y1 + amount * dy;
    return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}

/**
 * Returns the signed turn made by three points.
 * @param {{x: number, y: number}} a - First point
 * @param {{x: number, y: number}} b - Second point
 * @param {{x: number, y: number}} c - Third point
 * @returns {number} Signed cross product
 */
function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Tests whether the centre lines of two segments intersect.
 * @param {object} a - First segment
 * @param {object} b - Second segment
 * @returns {boolean} Whether the centre lines intersect
 */
function segmentCentreLinesIntersect(a, b) {
    const a1 = { x: a.x1, y: a.y1 };
    const a2 = { x: a.x2, y: a.y2 };
    const b1 = { x: b.x1, y: b.y1 };
    const b2 = { x: b.x2, y: b.y2 };
    const first = orientation(a1, a2, b1);
    const second = orientation(a1, a2, b2);
    const third = orientation(b1, b2, a1);
    const fourth = orientation(b1, b2, a2);
    if ([first, second, third, fourth].every(value => Math.abs(value) < 1e-9)) {
        return Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)) <=
            Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) &&
            Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)) <=
            Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
    }
    return first * second <= 0 && third * fourth <= 0;
}

/**
 * Tests whether two thick line segments cross or approach within their radii.
 * @param {{x1: number, y1: number, x2: number, y2: number, radius?: number}} a - First segment
 * @param {{x1: number, y1: number, x2: number, y2: number, radius?: number}} b - Second segment
 * @returns {boolean} Whether the segments overlap
 */
export function segmentsOverlap(a, b) {
    if (segmentCentreLinesIntersect(a, b)) {
        return true;
    }
    const radius = (a.radius || 0) + (b.radius || 0);
    const minimumDistanceSquared = Math.min(
        pointToSegmentDistanceSquared({ x: a.x1, y: a.y1 }, b),
        pointToSegmentDistanceSquared({ x: a.x2, y: a.y2 }, b),
        pointToSegmentDistanceSquared({ x: b.x1, y: b.y1 }, a),
        pointToSegmentDistanceSquared({ x: b.x2, y: b.y2 }, a),
    );
    return minimumDistanceSquared <= radius * radius;
}

/**
 * Tests whether a point lies in a polygon using an even-odd ray crossing test.
 * @param {{x: number, y: number}} point - Test point
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} Whether the point is inside the polygon
 */
export function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        const crosses = ((pi.y > point.y) !== (pj.y > point.y)) &&
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x;
        if (crosses) {
            inside = !inside;
        }
    }
    return inside;
}

const CANDIDATE_DIRECTIONS = Array.from({ length: 16 }, (_, index) => {
    const angle = index * Math.PI / 8;
    return { x: Math.cos(angle), y: Math.sin(angle) };
});

/**
 * Creates one label placement candidate.
 * @param {object} label - Projected label
 * @param {{x: number, y: number}} direction - Unit placement direction
 * @param {number} distanceMultiplier - Near or fallback distance selector
 * @param {object} options - Layout options
 * @returns {object} Placement candidate
 */
function createCandidate(label, direction, distanceMultiplier, options) {
    const halfWidth = label.width / 2;
    const halfHeight = label.height / 2;
    const directionalExtent = Math.abs(direction.x) * halfWidth + Math.abs(direction.y) * halfHeight;
    const distance = label.radius + options.atomPadding + directionalExtent +
        (distanceMultiplier - 1) * options.fallbackDistance;
    const x = label.x + direction.x * distance;
    const y = label.y + direction.y * distance;
    const padding = options.labelPadding;
    const leaderSegment = distanceMultiplier > 1 ? {
        x1: label.x + direction.x * (label.radius + options.atomPadding),
        y1: label.y + direction.y * (label.radius + options.atomPadding),
        x2: x - direction.x * (directionalExtent + padding),
        y2: y - direction.y * (directionalExtent + padding),
        radius: options.leaderWidth / 2,
    } : null;

    return {
        x,
        y,
        anchorX: label.x,
        anchorY: label.y,
        direction,
        leaderLine: distanceMultiplier > 1,
        leaderSegment,
        rect: {
            left: x - halfWidth - padding,
            right: x + halfWidth + padding,
            top: y - halfHeight - padding,
            bottom: y + halfHeight + padding,
        },
    };
}

/**
 * Scores a candidate; lower scores are preferred.
 * @param {object} candidate - Placement candidate
 * @param {object} label - Projected label
 * @param {Array<Array<object>>} ringPolygons - Projected ring polygons
 * @param {object} previousPlacement - Prior frame placement, if any
 * @param {object} options - Layout options
 * @returns {number} Candidate score
 */
function candidateScore(candidate, label, ringPolygons, previousPlacement, options) {
    const preferred = label.preferredDirection || { x: 1, y: -1 };
    const alignment = candidate.direction.x * preferred.x + candidate.direction.y * preferred.y;
    let score = (1 - alignment) * 50;

    if (candidate.leaderLine) {
        score += 200;
    }
    if (ringPolygons.some(polygon => pointInPolygon(candidate, polygon))) {
        score += options.ringPenalty;
    }
    if (previousPlacement) {
        const previousAlignment = candidate.direction.x * previousPlacement.direction.x +
            candidate.direction.y * previousPlacement.direction.y;
        score += (1 - previousAlignment) * options.movementPenalty;
    }
    return score;
}

/**
 * Tests whether a rectangle is wholly inside the padded viewport.
 * @param {object} rect - Candidate rectangle
 * @param {{width: number, height: number}} viewport - Viewport dimensions
 * @param {number} padding - Required edge padding
 * @returns {boolean} Whether the rectangle fits
 */
function isInsideViewport(rect, viewport, padding) {
    return rect.left >= padding && rect.top >= padding &&
        rect.right <= viewport.width - padding && rect.bottom <= viewport.height - padding;
}

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
export function layoutAtomLabels(
    labels,
    atomObstacles,
    bondObstacles,
    ringPolygons,
    viewport,
    options,
    previousPlacements = new Map(),
) {
    const placed = [];
    const hidden = [];
    const allOrderedLabels = [...labels]
        .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.id.localeCompare(b.id));
    const orderedLabels = allOrderedLabels.slice(0, options.maxVisible);

    for (const label of orderedLabels) {
        const candidates = [];
        for (const distanceMultiplier of [1, 2]) {
            for (const direction of CANDIDATE_DIRECTIONS) {
                const candidate = createCandidate(label, direction, distanceMultiplier, options);
                candidate.score = candidateScore(
                    candidate,
                    label,
                    ringPolygons,
                    previousPlacements.get(label.id),
                    options,
                );
                candidates.push(candidate);
            }
        }
        candidates.sort((a, b) => a.score - b.score);

        const candidate = candidates.find(item => {
            if (!isInsideViewport(item.rect, viewport, options.viewportPadding)) {
                return false;
            }
            if (atomObstacles.some(atom => rectangleOverlapsCircle(item.rect, atom))) {
                return false;
            }
            if (bondObstacles.some(bond => segmentIntersectsRectangle(bond, item.rect))) {
                return false;
            }
            if (placed.some(existing => rectanglesOverlap(item.rect, existing.rect) ||
                (existing.leaderSegment && segmentIntersectsRectangle(existing.leaderSegment, item.rect)))) {
                return false;
            }
            if (!item.leaderSegment) {
                return true;
            }
            if (bondObstacles.some(bond => segmentsOverlap(item.leaderSegment, bond))) {
                return false;
            }
            if (atomObstacles.some(atom => atom.id !== label.id &&
                pointToSegmentDistanceSquared(atom, item.leaderSegment) < atom.radius ** 2)) {
                return false;
            }
            return !placed.some(existing =>
                segmentIntersectsRectangle(item.leaderSegment, existing.rect) ||
                (existing.leaderSegment && segmentsOverlap(item.leaderSegment, existing.leaderSegment)),
            );
        });

        if (candidate) {
            placed.push({ ...label, ...candidate });
        } else {
            hidden.push({ id: label.id, text: label.text, reason: 'no-space' });
        }
    }

    for (const label of allOrderedLabels.slice(options.maxVisible)) {
        hidden.push({ id: label.id, text: label.text, reason: 'max-visible' });
    }

    return { placed, hidden };
}
