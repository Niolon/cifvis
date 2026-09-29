/**
 * Parses one component of a crystallographic symmetry expression in linear time.
 * Unsupported terms are ignored, matching the historical parser's permissive behaviour.
 * @param {string} component - Component such as `-x+y+1/2`.
 * @returns {{coefficients: number[], translation: number}} Rotation coefficients and translation.
 */
export function parseSymmetryComponent(component: string): {
    coefficients: number[];
    translation: number;
};
//# sourceMappingURL=symmetry-expression.d.ts.map