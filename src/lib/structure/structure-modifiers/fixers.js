//import { atomLabelsMatch } from '../../fix-cif/reconcile-labels.js';
import { Bond } from '../bonds.js';
import { CrystalStructure, inferElementFromLabel, disorderGroupsCompatible } from '../crystal.js';
import { S_BLOCK_ELEMENTS } from '../covalent-radii.js';
import { encodePositionCode } from '../position-code.js';
import { BaseFilter } from './base.js';
import * as math from '../../math-lite.js';

/**
 * Filter that removes specified atoms and their connected bonds from a structure,
 * supporting both individual labels and ranges with the ">" syntax
 * @augments BaseFilter
 */
export class AtomLabelFilter extends BaseFilter {
    static MODES = Object.freeze({
        ON: 'on',
        OFF: 'off',
    });

    /**
     * Creates a new atom label filter
     * @param {string[]|string} [filteredLabels] - Array of atom labels or comma-separated string to filter
     * @param {AtomLabelFilter.MODES} [mode] - Initial filter mode
     */
    constructor(filteredLabels = [], mode = AtomLabelFilter.MODES.OFF) {
        super(AtomLabelFilter.MODES, mode, 'AtomLabelFilter', []);
        this.setFilteredLabels(filteredLabels);
    }

    get requiresCameraUpdate() {
        return true;
    }

    /**
     * Parses a range expression (e.g., "A1>A10") and returns all labels in the range
     * @param {string} rangeExpr - Range expression in the format "start>end"
     * @param {string[]} allLabels - All available atom labels to filter the range against
     * @returns {string[]} Array of labels in the range
     * @private
     */
    _parseRangeExpression(rangeExpr, allLabels) {
        const [startLabel, endLabel] = rangeExpr.split('>').map(label => label.trim());

        if (!startLabel || !endLabel) {
            console.warn(`Invalid range expression: ${rangeExpr}`);
            return [];
        }

        if (!allLabels.includes(startLabel)) {
            throw new Error(`Range filtering included unknown start label: ${startLabel}`);
        }

        if (!allLabels.includes(endLabel)) {
            throw new Error(`Range filtering included unknown end label: ${endLabel}`);
        }

        const startIndex = allLabels.indexOf(startLabel);
        const endIndex = allLabels.indexOf(endLabel);

        return allLabels.slice(startIndex, endIndex + 1);
    }

    /**
     * Updates the list of filtered atom labels
     * @param {string[]|string} labels - New array of atom labels or comma-separated string to filter
     */
    setFilteredLabels(labels) {
        let labelArray = [];

        if (typeof labels === 'string') {
            labelArray = labels.split(',').map(label => label.trim()).filter(label => label);
        } else if (Array.isArray(labels)) {
            labelArray = labels;
        }

        this.filteredLabels = new Set(labelArray);
    }

    /**
     * Expands any range expressions in the filtered labels using available atom labels
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {Set<string>} - set of expanded labels for the range
     * @private
     */
    _expandRanges(structure) {
        const allLabels = structure.atoms.map(atom => atom.label);
        const expandedLabels = new Set();

        for (const label of this.filteredLabels) {
            if (label.includes('>') && !allLabels.includes(label)) {
                // This is a range expression
                const rangeLabels = this._parseRangeExpression(label, allLabels);
                rangeLabels.forEach(l => expandedLabels.add(l));
            } else {
                // This is a simple label
                expandedLabels.add(label);
            }
        }

        return expandedLabels;
    }

    /**
     * Applies the filter to a structure, removing specified atoms and their bonds
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with atoms removed if filter is on
     */
    apply(structure) {
        if (this.mode === AtomLabelFilter.MODES.OFF) {
            return structure;
        }

        const expandedLabels = this._expandRanges(structure);

        const filteredAtoms = structure.atoms.filter(atom =>
            !expandedLabels.has(atom.label),
        );

        const filteredBonds = structure.bonds.filter(bond => {
            const atom1 = structure.getAtomById(bond.atom1Id);
            const atom2 = structure.getAtomById(bond.atom2Id);
            return !expandedLabels.has(atom1.label) && !expandedLabels.has(atom2.label);
        });

        const filteredHBonds = structure.hBonds.filter(hBond => {
            const donor = structure.getAtomById(hBond.donorAtomId);
            const hydrogen = structure.getAtomById(hBond.hydrogenAtomId);
            const acceptor = structure.getAtomById(hBond.acceptorAtomId);
            return !expandedLabels.has(donor.label) &&
                !expandedLabels.has(hydrogen.label) &&
                !expandedLabels.has(acceptor.label);
        });

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes - both modes are always available
     * @returns {Array<string>} Array containing both ON and OFF modes
     */
    getApplicableModes() {
        return Object.values(AtomLabelFilter.MODES);
    }
}

/**
 * Generates bonds between atoms based on their atomic radii and positions
 * @augments BaseFilter
 */

export class BondGenerator extends BaseFilter {
    static MODES = Object.freeze({
        KEEP: 'keep', // Keep existing bonds only
        ADD: 'add', // Add new bonds while keeping existing ones
        REPLACE: 'replace', // Replace all bonds with generated ones
        CREATE: 'create', // Create bonds only if none exist
        IGNORE: 'ignore', // Don't create bonds if none exist
    });

    static PREFERRED_FALLBACK_ORDER = [
        BondGenerator.MODES.KEEP,
        BondGenerator.MODES.ADD,
        BondGenerator.MODES.REPLACE,
        BondGenerator.MODES.CREATE,
        BondGenerator.MODES.IGNORE,
    ];

    /**
     * Creates a new bond generator to generate bonds between atoms based on their atomic radii
     * @class
     * @param {object} elementProperties - Element properties containing atomic radii from structure-settings.js
     * @param {number} tolerance - Additive tolerance in Angstroms added to the sum of atomic radii
     * @param {BondGenerator.MODES} [mode] - Initial operation mode
     */
    constructor(elementProperties, tolerance, mode = BondGenerator.MODES.KEEP) {
        super(BondGenerator.MODES, mode, 'BondGenerator', BondGenerator.PREFERRED_FALLBACK_ORDER);
        this.elementProperties = elementProperties;
        this.tolerance = tolerance;
    }

    /**
     * Gets the additive tolerance for a pair of elements. Group 1/2 (s-block)
     * elements form predominantly ionic bonds whose lengths deviate further
     * from a simple covalent-radius sum, so CCDC/Mercury-style practice
     * applies a tighter tolerance to them.
     * @param {string} element1 - First element symbol
     * @param {string} element2 - Second element symbol
     * @returns {number} Additive tolerance in Angstroms
     */
    getTolerance(element1, element2) {
        if (S_BLOCK_ELEMENTS.has(element1) || S_BLOCK_ELEMENTS.has(element2)) {
            return Math.min(this.tolerance, 0.40);
        }
        return this.tolerance;
    }

    /**
     * Gets the maximum allowed bond distance between two atoms
     * @param {string} element1 - First element symbol
     * @param {string} element2 - Second element symbol
     * @param {object} elementProperties - Element property definitions
     * @returns {number} Maximum allowed bond distance
     */
    getMaxBondDistance(element1, element2, elementProperties) {
        const radius1 = elementProperties[element1]?.radius;
        const radius2 = elementProperties[element2]?.radius;

        if (!radius1 || !radius2) {
            throw new Error(`Missing radius for element ${!radius1 ? element1 : element2}`);
        }

        return radius1 + radius2 + this.getTolerance(element1, element2);
    }

    /**
     * Generates bonds between atoms based on their distances. Candidate pairs
     * are limited via a spatial grid (cell size = the largest possible bond
     * distance among elements present) so only atoms in the same or
     * neighboring cells are ever compared, instead of every pair in the
     * structure.
     * @private
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {object} elementProperties - Element property definitions
     * @returns {Set<Bond>} Set of generated bonds
     */
    generateBonds(structure, elementProperties) {
        const generatedBonds = new Set();
        const { cell, atoms } = structure;

        // Prepare pairwise data once. The previous implementation allocated a
        // mathjs vector and matrix-backed norm for every atom pair.
        const atomPositions = new Map();
        const elementMap = new Map();
        const bondedAtomIds = new Set();
        for (const bond of structure.bonds) {
            bondedAtomIds.add(bond.atom1Id);
            bondedAtomIds.add(bond.atom2Id);
        }

        atoms.forEach(atom => {
            const cartPos = atom.position.toCartesian(cell);
            // Preserve the established behavior for duplicate atom IDs: the last
            // position in the structure is the one used for every matching ID.
            atomPositions.set(atom.uniqueId, [cartPos.x, cartPos.y, cartPos.z]);
            if (Object.prototype.hasOwnProperty.call(elementProperties, atom.atomType)
                && !elementMap.has(atom.atomType)) {
                elementMap.set(atom.atomType, atom.atomType);
            } else if (!elementMap.has(atom.atomType)) {
                try {
                    elementMap.set(atom.atomType, inferElementFromLabel(atom.atomType));
                } catch {
                    throw new Error(`Missing radius for element ${atom.atomType}`);
                }
            }
        });

        // Bucket atoms into a uniform grid sized to the largest possible bond
        // distance, so only same/neighboring-cell pairs need to be checked.
        let maxPossibleDistance = 0;
        for (const el1 of elementMap.values()) {
            for (const el2 of elementMap.values()) {
                maxPossibleDistance = Math.max(
                    maxPossibleDistance,
                    this.getMaxBondDistance(el1, el2, elementProperties),
                );
            }
        }
        const cellSize = maxPossibleDistance > 0 ? maxPossibleDistance : 1;

        const cellKey = (ix, iy, iz) => `${ix},${iy},${iz}`;
        const grid = new Map();
        atoms.forEach((atom, index) => {
            const pos = atomPositions.get(atom.uniqueId);
            const ix = Math.floor(pos[0] / cellSize);
            const iy = Math.floor(pos[1] / cellSize);
            const iz = Math.floor(pos[2] / cellSize);
            const key = cellKey(ix, iy, iz);
            if (!grid.has(key)) {
                grid.set(key, []);
            }
            grid.get(key).push(index);
        });

        // Check distances between atom pairs, restricted to same/neighboring
        // grid cells. Only pairs with j > i are considered (as in the
        // original full pairwise scan) so each unordered pair is checked once
        // and generated bonds keep the atom1/atom2 ordering of the atoms array.
        for (let i = 0; i < atoms.length; i++) {
            const atom1 = atoms[i];
            const pos1 = atomPositions.get(atom1.uniqueId);
            const ix = Math.floor(pos1[0] / cellSize);
            const iy = Math.floor(pos1[1] / cellSize);
            const iz = Math.floor(pos1[2] / cellSize);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const neighbors = grid.get(cellKey(ix + dx, iy + dy, iz + dz));
                        if (!neighbors) {
                            continue;
                        }

                        for (const j of neighbors) {
                            if (j <= i) {
                                continue;
                            }
                            const atom2 = atoms[j];

                            // Skip if either atom is hydrogen and we already have bonds
                            if ((atom1.atomType === 'H' || atom2.atomType === 'H') &&
                                (bondedAtomIds.has(atom1.uniqueId) || bondedAtomIds.has(atom2.uniqueId))) {
                                continue;
                            }

                            if (!disorderGroupsCompatible(atom1, atom2)) {
                                continue;
                            }

                            const pos2 = atomPositions.get(atom2.uniqueId);
                            const distX = pos1[0] - pos2[0];
                            const distY = pos1[1] - pos2[1];
                            const distZ = pos1[2] - pos2[2];
                            const maxDistance = this.getMaxBondDistance(
                                elementMap.get(atom1.atomType),
                                elementMap.get(atom2.atomType),
                                elementProperties,
                            );

                            // A bond-length sphere is contained by this axis-aligned box.
                            // Reject distant pairs before invoking mathjs while retaining the
                            // exact historical norm calculation for all possible bonds.
                            if (Math.abs(distX) > maxDistance || Math.abs(distY) > maxDistance ||
                                Math.abs(distZ) > maxDistance) {
                                continue;
                            }
                            const distance = math.norm([distX, distY, distZ]);

                            if (distance <= maxDistance && distance > 0.0001) {
                                generatedBonds.add(new Bond(
                                    atom1.uniqueId,
                                    atom2.uniqueId,
                                    distance,
                                    null, // No standard uncertainty for generated bonds
                                    '.',
                                ));
                            }
                        }
                    }
                }
            }
        }

        this.generateSymmetryBonds(structure, elementProperties, elementMap, maxPossibleDistance, generatedBonds);

        return generatedBonds;
    }

    /**
     * Adds bonds to symmetry-equivalent positions to an existing set of generated
     * bonds. The Cartesian pass in {@link BondGenerator#generateBonds} only bonds
     * atoms materialised in the same cell, so for structures whose bonds cross a
     * symmetry element - ionic/extended solids, or moieties on special positions -
     * the asymmetric unit contains no in-range pair and those bonds are found only
     * by testing symmetry images of the atoms.
     *
     * Each such bond is emitted once, anchored on the lower-indexed atom (atom1 in
     * the home cell, 1_555), carrying a position code that points at the symmetry
     * equivalent of atom2. The partner atom is not materialised here: the renderer
     * skips a bond until both endpoints exist, and the symmetry growers materialise
     * the partner and resolve the code when the user grows the structure.
     * Performance: like the intra-cell pass, this uses a uniform spatial grid so
     * only same/neighbouring-cell candidates are compared, rather than every
     * atom/operation/translation triple. Every symmetry image of every atom is
     * wrapped into the home cell (plus boundary copies so periodic neighbours land
     * in adjacent grid cells) and bucketed once; each home atom then queries only
     * its 27 neighbouring cells. Cost is roughly linear in atoms x operations
     * instead of quadratic in atoms.
     * @private
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {object} elementProperties - Element property definitions
     * @param {Map<string, string>} elementMap - Resolved element symbol per atomType
     * @param {number} maxPossibleDistance - Largest possible bond distance among elements present
     * @param {Set<Bond>} generatedBonds - Set to add generated bonds to
     */
    generateSymmetryBonds(structure, elementProperties, elementMap, maxPossibleDistance, generatedBonds) {
        const { cell, atoms, symmetry } = structure;
        const operations = symmetry?.symmetryOperations;
        if (!operations || operations.length === 0 || maxPossibleDistance <= 0) {
            return;
        }

        // Reverse the id->index map so a generated code can name its operation.
        const idByIndex = [];
        for (const [id, index] of symmetry.operationIds.entries()) {
            idByIndex[index] = id;
        }
        const identityId = symmetry.identitySymOpId;
        const identityOpIndex = symmetry.operationIds.get(identityId);

        // Inline the fractional->cartesian product with plain numbers; this runs
        // in the hot loops, so it avoids allocating a FractPosition per call.
        const m = cell.fractToCartMatrix.toArray();
        const toCart = fract => [
            m[0][0] * fract[0] + m[0][1] * fract[1] + m[0][2] * fract[2],
            m[1][0] * fract[0] + m[1][1] * fract[1] + m[1][2] * fract[2],
            m[2][0] * fract[0] + m[2][1] * fract[1] + m[2][2] * fract[2],
        ];
        // Cartesian lattice vectors, so a lattice shift is a cheap linear combination.
        const va = toCart([1, 0, 0]);
        const vb = toCart([0, 1, 0]);
        const vc = toCart([0, 0, 1]);

        // Rigorous per-axis fractional reach of a cartesian sphere of the bond cutoff,
        // used to decide which cell-boundary copies of an image can reach a home atom.
        const cartToFract = math.inv(cell.fractToCartMatrix).toArray();
        const marginFrac = [0, 1, 2].map(r =>
            maxPossibleDistance * Math.hypot(cartToFract[r][0], cartToFract[r][1], cartToFract[r][2]),
        );
        const axisShifts = (w, margin) => {
            if (margin >= 0.5) {
                return [-1, 0, 1];
            }
            const shifts = [0];
            if (w < margin) {
                shifts.push(1); // near face 0 -> copy near face 1
            }
            if (w > 1 - margin) {
                shifts.push(-1); // near face 1 -> copy near face 0
            }
            return shifts;
        };

        const cellSize = maxPossibleDistance;
        const cellKey = (ix, iy, iz) => `${ix},${iy},${iz}`;
        const cellIndex = coord => Math.floor(coord / cellSize);

        // Precompute each home atom wrapped into the cell. Only the asymmetric-unit
        // atoms are ever an endpoint, so an image can bond only if it falls in the
        // +/-1 neighbourhood of some home atom's grid cell; anything outside every
        // such neighbourhood is irrelevant and is neither stored nor scanned. The
        // wrap shift is folded back into the emitted code so it stays relative to the
        // atom's real (1_555) position.
        const fracts = atoms.map(atom => [atom.position.x, atom.position.y, atom.position.z]);
        const homeInfo = new Array(atoms.length);
        const relevantCells = new Set();
        const outOfCell = [];
        for (let i = 0; i < atoms.length; i++) {
            const hx = Math.floor(fracts[i][0]);
            const hy = Math.floor(fracts[i][1]);
            const hz = Math.floor(fracts[i][2]);
            const homeCart = toCart([fracts[i][0] - hx, fracts[i][1] - hy, fracts[i][2] - hz]);
            const ix = cellIndex(homeCart[0]);
            const iy = cellIndex(homeCart[1]);
            const iz = cellIndex(homeCart[2]);
            homeInfo[i] = { hx, hy, hz, homeCart, ix, iy, iz };
            if (hx !== 0 || hy !== 0 || hz !== 0) {
                outOfCell.push(i);
            }
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        relevantCells.add(cellKey(ix + dx, iy + dy, iz + dz));
                    }
                }
            }
        }

        // Build a grid of symmetry-image sites, keeping only those in a relevant cell.
        const grid = new Map();
        for (let j = 0; j < atoms.length; j++) {
            for (let opIndex = 0; opIndex < operations.length; opIndex++) {
                const image = operations[opIndex].applyToPoint(fracts[j]);
                const fx = Math.floor(image[0]);
                const fy = Math.floor(image[1]);
                const fz = Math.floor(image[2]);
                const wx = image[0] - fx;
                const wy = image[1] - fy;
                const wz = image[2] - fz;
                const wrappedCart = toCart([wx, wy, wz]);
                for (const sx of axisShifts(wx, marginFrac[0])) {
                    for (const sy of axisShifts(wy, marginFrac[1])) {
                        for (const sz of axisShifts(wz, marginFrac[2])) {
                            const tx = -fx + sx;
                            const ty = -fy + sy;
                            const tz = -fz + sz;
                            // For the pure identity operation a net-zero-translation
                            // copy is the atom in its own cell: it only ever yields the
                            // intra-cell bond (already handled) or a skipped self bond,
                            // so interior atoms need no identity site at all. This is
                            // what keeps periodic (e.g. P1) structures cheap: only
                            // near-border atoms produce identity images.
                            if (opIndex === identityOpIndex && tx === 0 && ty === 0 && tz === 0) {
                                continue;
                            }
                            const cartX = wrappedCart[0] + sx * va[0] + sy * vb[0] + sz * vc[0];
                            const cartY = wrappedCart[1] + sx * va[1] + sy * vb[1] + sz * vc[1];
                            const cartZ = wrappedCart[2] + sx * va[2] + sy * vb[2] + sz * vc[2];
                            const key = cellKey(cellIndex(cartX), cellIndex(cartY), cellIndex(cartZ));
                            if (!relevantCells.has(key)) {
                                continue;
                            }
                            let bucket = grid.get(key);
                            if (!bucket) {
                                bucket = [];
                                grid.set(key, bucket);
                            }
                            bucket.push({
                                atomIndex: j,
                                opIndex,
                                tx,
                                ty,
                                tz,
                                fract: [wx + sx, wy + sy, wz + sz],
                                cartX,
                                cartY,
                                cartZ,
                            });
                        }
                    }
                }
            }
        }

        // Query each home atom against its own and neighbouring grid cells.
        const seen = new Set();
        for (let i = 0; i < atoms.length; i++) {
            const { hx, hy, hz, homeCart, ix, iy, iz } = homeInfo[i];
            // Out-of-cell home atoms are handled by the direct fallback below, which
            // is their sole source of bonds (avoids a second, float-divergent dedup
            // key for the same bond).
            if (hx !== 0 || hy !== 0 || hz !== 0) {
                continue;
            }
            const atom1 = atoms[i];
            const el1 = elementMap.get(atom1.atomType);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const bucket = grid.get(cellKey(ix + dx, iy + dy, iz + dz));
                        if (!bucket) {
                            continue;
                        }
                        for (const site of bucket) {
                            const j = site.atomIndex;
                            // Emit each unordered asymmetric pair once, anchored on the
                            // lower-indexed atom (atom1, home cell, 1_555).
                            if (i > j) {
                                continue;
                            }
                            const atom2 = atoms[j];
                            if (!disorderGroupsCompatible(atom1, atom2)) {
                                continue;
                            }
                            const maxDistance = this.getMaxBondDistance(
                                el1, elementMap.get(atom2.atomType), elementProperties,
                            );
                            const distX = homeCart[0] - site.cartX;
                            const distY = homeCart[1] - site.cartY;
                            const distZ = homeCart[2] - site.cartZ;
                            if (Math.abs(distX) > maxDistance || Math.abs(distY) > maxDistance ||
                                Math.abs(distZ) > maxDistance) {
                                continue;
                            }
                            const d2 = distX * distX + distY * distY + distZ * distZ;
                            if (d2 > maxDistance * maxDistance || d2 <= 1e-8) {
                                continue;
                            }
                            const distance = Math.sqrt(d2);

                            const tx = site.tx + hx;
                            const ty = site.ty + hy;
                            const tz = site.tz + hz;
                            const opId = idByIndex[site.opIndex];
                            // Skip the identity operation in the home cell: atom2 itself
                            // / the intra-cell bond already handled by the Cartesian pass.
                            if (opId === identityId && tx === 0 && ty === 0 && tz === 0) {
                                continue;
                            }

                            // Dedup by the absolute image position so the same neighbour
                            // reached by different operations (special positions) or
                            // boundary copies is only bonded once.
                            const key = `${i}|${j}|${Math.round((site.fract[0] + hx) * 1e4)},`
                                + `${Math.round((site.fract[1] + hy) * 1e4)},`
                                + `${Math.round((site.fract[2] + hz) * 1e4)}`;
                            if (seen.has(key)) {
                                continue;
                            }
                            seen.add(key);

                            const code = encodePositionCode(opId, [tx, ty, tz]);
                            // Guard against an atom bonding to its own image.
                            if (`${atom2.label}|${code}` === atom1.uniqueId) {
                                continue;
                            }

                            generatedBonds.add(new Bond(
                                atom1.uniqueId,
                                atom2.label,
                                distance,
                                null, // No standard uncertainty for generated bonds
                                code,
                            ));
                        }
                    }
                }
            }
        }

        // Atoms listed outside [0,1) (typically sitting exactly on a cell face)
        // act as out-of-cell home atoms whose in-cell partners' net-zero identity
        // images were skipped above. They are rare, so resolve them with a direct
        // search that shares the dedup set with the grid pass.
        for (const i of outOfCell) {
            const atom1 = atoms[i];
            const el1 = elementMap.get(atom1.atomType);
            const pos1 = toCart(fracts[i]);
            for (let j = i; j < atoms.length; j++) {
                const atom2 = atoms[j];
                if (!disorderGroupsCompatible(atom1, atom2)) {
                    continue;
                }
                const maxDistance = this.getMaxBondDistance(
                    el1, elementMap.get(atom2.atomType), elementProperties,
                );
                for (let opIndex = 0; opIndex < operations.length; opIndex++) {
                    const opId = idByIndex[opIndex];
                    const image = operations[opIndex].applyToPoint(fracts[j]);
                    const baseTx = Math.round(fracts[i][0] - image[0]);
                    const baseTy = Math.round(fracts[i][1] - image[1]);
                    const baseTz = Math.round(fracts[i][2] - image[2]);
                    // Cartesian of the nearest image; the 27 candidates are cheap
                    // lattice-vector offsets from it (no per-candidate matrix product).
                    const baseCart = toCart([image[0] + baseTx, image[1] + baseTy, image[2] + baseTz]);
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dz = -1; dz <= 1; dz++) {
                                const tx = baseTx + dx;
                                const ty = baseTy + dy;
                                const tz = baseTz + dz;
                                if (opId === identityId && tx === 0 && ty === 0 && tz === 0) {
                                    continue;
                                }
                                const distX = pos1[0] - (baseCart[0] + dx * va[0] + dy * vb[0] + dz * vc[0]);
                                const distY = pos1[1] - (baseCart[1] + dx * va[1] + dy * vb[1] + dz * vc[1]);
                                const distZ = pos1[2] - (baseCart[2] + dx * va[2] + dy * vb[2] + dz * vc[2]);
                                if (Math.abs(distX) > maxDistance || Math.abs(distY) > maxDistance ||
                                    Math.abs(distZ) > maxDistance) {
                                    continue;
                                }
                                const d2 = distX * distX + distY * distY + distZ * distZ;
                                if (d2 > maxDistance * maxDistance || d2 <= 1e-8) {
                                    continue;
                                }
                                const key = `${i}|${j}|${Math.round((image[0] + tx) * 1e4)},`
                                    + `${Math.round((image[1] + ty) * 1e4)},${Math.round((image[2] + tz) * 1e4)}`;
                                if (seen.has(key)) {
                                    continue;
                                }
                                seen.add(key);
                                const code = encodePositionCode(opId, [tx, ty, tz]);
                                if (`${atom2.label}|${code}` === atom1.uniqueId) {
                                    continue;
                                }
                                generatedBonds.add(new Bond(
                                    atom1.uniqueId, atom2.label, Math.sqrt(d2), null, code,
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Applies bond generation to a structure according to current mode
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {CrystalStructure} Structure with modified bonds according to mode
     */
    apply(structure) {
        // First check if current mode is applicable
        this.ensureValidMode(structure);

        let finalBonds;

        switch (this.mode) {
            case BondGenerator.MODES.KEEP:
                return structure; // Keep existing bonds unchanged

            case BondGenerator.MODES.ADD:
            {
                const newBonds = this.generateBonds(structure, this.elementProperties);
                finalBonds = [...structure.bonds, ...newBonds];
                break;
            }

            case BondGenerator.MODES.REPLACE:
                finalBonds = [...this.generateBonds(structure, this.elementProperties)];
                break;

            case BondGenerator.MODES.CREATE:
                finalBonds = [...this.generateBonds(structure, this.elementProperties)];
                break;

            case BondGenerator.MODES.IGNORE:
                finalBonds = [...structure.bonds];
                break;

            default:
                return structure;
        }

        return new CrystalStructure(
            structure.cell,
            structure.atoms,
            finalBonds,
            structure.hBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes based on current structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const hasBonds = structure.bonds.length > 0;

        if (hasBonds) {
            return [
                BondGenerator.MODES.KEEP,
                BondGenerator.MODES.ADD,
                BondGenerator.MODES.REPLACE,
            ];
        }

        return [
            BondGenerator.MODES.CREATE,
            BondGenerator.MODES.IGNORE,
        ];
    }
}

/**
 * Structure modifier that fixes isolated hydrogen atoms by creating
 * bonds to nearby potential bonding partners.
 * @augments BaseFilter
 */
export class IsolatedHydrogenFixer extends BaseFilter {
    static MODES = Object.freeze({
        ON: 'on',
        OFF: 'off',
    });

    static PREFERRED_FALLBACK_ORDER = [
        IsolatedHydrogenFixer.MODES.ON,
        IsolatedHydrogenFixer.MODES.OFF,
    ];

    /**
     * Creates a new isolated hydrogen fixer
     * @param {IsolatedHydrogenFixer.MODES} [mode] - Initial filter mode
     * @param {number} [maxBondDistance] - Maximum distance in Angstroms to consider for hydrogen bonds
     */
    constructor(mode = IsolatedHydrogenFixer.MODES.OFF, maxBondDistance = 1.1) {
        super(
            IsolatedHydrogenFixer.MODES,
            mode,
            'IsolatedHydrogenFixer',
            IsolatedHydrogenFixer.PREFERRED_FALLBACK_ORDER,
        );
        this.maxBondDistance = maxBondDistance;
    }

    /**
     * Applies the filter to create bonds for isolated hydrogen atoms
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} Modified structure with additional bonds
     */
    apply(structure) {
        this.ensureValidMode(structure);

        // If mode is OFF, return the structure unchanged
        if (this.mode === IsolatedHydrogenFixer.MODES.OFF) {
            return structure;
        }

        // Find all isolated hydrogen atoms
        const isolatedHydrogenAtoms = this.findIsolatedHydrogenAtoms(structure);

        if (isolatedHydrogenAtoms.length === 0) {
            return structure;
        }

        // Create new bonds for isolated hydrogen atoms
        const newBonds = this.createBondsForIsolatedHydrogens(structure, isolatedHydrogenAtoms);

        // Return structure with additional bonds
        return new CrystalStructure(
            structure.cell,
            structure.atoms,
            [...structure.bonds, ...newBonds],
            structure.hBonds,
            structure.symmetry,
        );
    }

    /**
     * Finds hydrogen atoms that are in connected groups of size one
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<object>} Array of isolated hydrogen atoms with their indices
     */
    findIsolatedHydrogenAtoms(structure) {
        const atomsInBonds = new Set();
        structure.bonds.forEach(b => {
            atomsInBonds.add(b.atom1Id);
            atomsInBonds.add(b.atom2Id);
        });

        const isolatedHydrogenAtoms = [];
        structure.atoms.forEach((atom, atomIndex) => {
            if (!atomsInBonds.has(atom.uniqueId) && atom.atomType === 'H') {
                isolatedHydrogenAtoms.push({ atom, atomIndex });
            }
        });

        return isolatedHydrogenAtoms;
    }

    /**
     * Creates bonds for isolated hydrogen atoms to nearby potential bonding partners
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {Array<object>} isolatedHydrogenAtoms - Array of isolated hydrogen atoms with their indices
     * @returns {Array<Bond>} Array of new bonds
     */
    createBondsForIsolatedHydrogens(structure, isolatedHydrogenAtoms) {
        const newBonds = [];

        isolatedHydrogenAtoms.forEach(({ atom, atomIndex }) => {
            // Convert hydrogen position to Cartesian coordinates
            const cartPos = atom.position.toCartesian(structure.cell);
            const hydrogenPosition = [cartPos.x, cartPos.y, cartPos.z];

            // Try to bond with the previous atom first (common case)
            if (atomIndex > 0) {
                const previousAtom = structure.atoms[atomIndex - 1];

                if (previousAtom.atomType !== 'H' &&
                    disorderGroupsCompatible(previousAtom, atom)) {

                    const prevPos = previousAtom.position.toCartesian(structure.cell);
                    const prevPosition = [prevPos.x, prevPos.y, prevPos.z];

                    const diff = math.subtract(hydrogenPosition, prevPosition);
                    const distance = math.norm(diff);

                    if (distance <= this.maxBondDistance) {
                        // Create a bond to the previous atom
                        newBonds.push(new Bond(
                            previousAtom.uniqueId,
                            atom.uniqueId,
                            distance,
                            null,
                            '.',
                        ));
                        // Skip further search
                        return;
                    }
                }
            }

            // If no bond with previous atom, check others in reverse order
            let foundBond = false;

            // Check atoms before hydrogen (in reverse)
            for (let i = atomIndex - 1; i >= 0 && !foundBond; i--) {
                const partner = structure.atoms[i];

                if (partner.atomType === 'H') {
                    continue;
                }

                if (!disorderGroupsCompatible(partner, atom)) {
                    continue;
                }

                const partnerPos = partner.position.toCartesian(structure.cell);
                const partnerPosition = [partnerPos.x, partnerPos.y, partnerPos.z];

                const diff = math.subtract(hydrogenPosition, partnerPosition);
                const distance = math.norm(diff);

                if (distance <= this.maxBondDistance) {
                    newBonds.push(new Bond(
                        partner.uniqueId,
                        atom.uniqueId,
                        distance,
                        null,
                        '.',
                    ));
                    foundBond = true;
                }
            }

            // Only check atoms after hydrogen if no bond found yet
            if (!foundBond && atomIndex < structure.atoms.length - 1) {
                for (let i = atomIndex + 1; i < structure.atoms.length && !foundBond; i++) {
                    const partner = structure.atoms[i];

                    if (partner.atomType === 'H') {
                        continue;
                    }

                    if (!(partner.disorderGroup === atom.disorderGroup ||
                        partner.disorderGroup === 0 ||
                        atom.disorderGroup === 0)) {
                        continue;
                    }

                    const partnerPos = partner.position.toCartesian(structure.cell);
                    const partnerPosition = [partnerPos.x, partnerPos.y, partnerPos.z];

                    const diff = math.subtract(hydrogenPosition, partnerPosition);
                    const distance = math.norm(diff);

                    if (distance <= this.maxBondDistance) {
                        newBonds.push(new Bond(
                            partner.uniqueId,
                            atom.uniqueId,
                            distance,
                            null,
                            '.',
                        ));
                        foundBond = true;
                    }
                }
            }
        });

        return newBonds;
    }

    /**
     * Gets applicable modes based on whether there are isolated hydrogen atoms
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        // Check if there are any bonds at all
        if (structure.bonds.length === 0) {
            return [IsolatedHydrogenFixer.MODES.OFF];
        }

        // Check if there are isolated hydrogen atoms
        const hasIsolatedHydrogens = this.findIsolatedHydrogenAtoms(structure).length > 0;

        if (hasIsolatedHydrogens) {
            return [
                IsolatedHydrogenFixer.MODES.ON,
                //IsolatedHydrogenFixer.MODES.OFF,
            ];
        }

        return [IsolatedHydrogenFixer.MODES.OFF];
    }
}
