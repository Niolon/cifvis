import * as THREE from 'three';
import { Bond } from '../structure/bonds.js';
import defaultSettings from './structure-settings.js';
import {
    findMetalRingCentroidInteractions,
    layoutCentroidDashes,
    validateMetalRingCentroidOptions,
} from './metal-ring-centroids.js';
import { computeCentroidDashTransforms, ORTEP3JsStructure } from './ortep.js';

/**
 * Creates a minimal atom test double with Cartesian coordinates.
 * @param {string} label - Atom label
 * @param {string} atomType - Chemical element symbol
 * @param {number[]} xyz - Cartesian coordinates
 * @returns {object} Atom test double
 */
function atom(label, atomType, xyz) {
    const point = Object.assign([...xyz], { x: xyz[0], y: xyz[1], z: xyz[2] });
    return {
        label,
        atomType,
        uniqueId: `${label}|1_555`,
        position: { toCartesian: () => point },
    };
}

/**
 * Creates a planar carbon ring and a metal centre with selected contacts.
 * @param {object} [config] - Fixture configuration
 * @param {number} [config.size] - Number of ring atoms; defaults to five
 * @param {number[]} [config.contacts] - Ring indices bonded to the centre
 * @param {number[]} [config.centre] - Cartesian centre coordinates
 * @returns {{structure: object, metalBonds: Bond[]}} Structure fixture and centre bonds
 */
function polygonStructure({ size = 5, contacts = [0, 1, 2, 3, 4], centre = [0, 0, 1.5] } = {}) {
    const ring = Array.from({ length: size }, (_, index) => {
        const angle = 2 * Math.PI * index / size;
        return atom(`C${index + 1}`, 'C', [Math.cos(angle), Math.sin(angle), 0]);
    });
    const metal = atom('Fe1', 'Fe', centre);
    const ringBonds = ring.map((current, index) =>
        new Bond(current.uniqueId, ring[(index + 1) % size].uniqueId, 1.4));
    const metalBonds = contacts.map(index =>
        new Bond(metal.uniqueId, ring[index].uniqueId, 1.8));
    return {
        structure: {
            atoms: [metal, ...ring], bonds: [...ringBonds, ...metalBonds], hBonds: [], cell: {},
        },
        metalBonds,
    };
}

const options = () => ({ ...defaultSettings.metalRingCentroidOptions });

describe('metal-ring centroid detection', () => {
    test('accepts non-consecutive 1,2,4 contacts without changing the bond graph', () => {
        const { structure, metalBonds } = polygonStructure({ contacts: [0, 1, 3] });
        const originalBonds = [...structure.bonds];
        const result = findMetalRingCentroidInteractions(structure, structure.bonds, options());

        expect(result.interactions).toHaveLength(1);
        expect(result.interactions[0]).toMatchObject({
            type: 'ring-centroid-bond', bondedAtomCount: 3, coverage: 0.6,
        });
        result.interactions[0].centroid.forEach(value => expect(value).toBeCloseTo(0));
        expect(result.suppressedBonds).toEqual(new Set(metalBonds));
        expect(structure.bonds).toEqual(originalBonds);
    });

    test('accepts 4/6 arene coverage and rejects lateral geometry', () => {
        const accepted = polygonStructure({ size: 6, contacts: [0, 1, 2, 4] }).structure;
        expect(findMetalRingCentroidInteractions(accepted, accepted.bonds, options()).interactions)
            .toHaveLength(1);

        const displaced = polygonStructure({
            size: 6, contacts: [0, 1, 2, 4], centre: [2, 0, 1.5],
        }).structure;
        expect(findMetalRingCentroidInteractions(displaced, displaced.bonds, options()).interactions)
            .toHaveLength(0);
    });

    test('rejects non-planar rings using the configurable RMS planarity ratio', () => {
        const { structure } = polygonStructure({ size: 6, contacts: [0, 1, 2, 3, 4, 5] });
        structure.atoms.filter(candidate => candidate.atomType === 'C').forEach((candidate, index) => {
            const original = candidate.position.toCartesian();
            const z = index % 2 === 0 ? 0.35 : -0.35;
            const point = Object.assign([original.x, original.y, z], {
                x: original.x, y: original.y, z,
            });
            candidate.position.toCartesian = () => point;
        });
        const relaxed = {
            ...options(), maxRingPlanarityRatio: 1, maxDistanceSpreadRatio: 1,
        };
        const accepted = findMetalRingCentroidInteractions(structure, structure.bonds, relaxed);
        expect(accepted.interactions).toHaveLength(1);
        expect(accepted.interactions[0].ringPlanarityRatio).toBeGreaterThan(
            options().maxRingPlanarityRatio,
        );
        expect(findMetalRingCentroidInteractions(structure, structure.bonds, {
            ...relaxed, maxRingPlanarityRatio: options().maxRingPlanarityRatio,
        }).interactions).toEqual([]);
    });

    test('excludes the current centre from its own configurable ligand topology', () => {
        const iron = atom('Fe1', 'Fe', [0, 0, 0]);
        const ring = [
            atom('C1', 'C', [1, 0, 0]),
            atom('C2', 'C', [1, 1, 0]),
            atom('C3', 'C', [0, 2, 0]),
            atom('C4', 'C', [-1, 1, 0]),
        ];
        const atoms = [iron, ...ring];
        const bonds = atoms.map((current, index) =>
            new Bond(current.uniqueId, atoms[(index + 1) % atoms.length].uniqueId, 1.4));
        const structure = { atoms, bonds, cell: {} };
        expect(findMetalRingCentroidInteractions(structure, bonds, {
            ...options(), centreElements: ['Fe'], ringElements: ['C', 'Fe'],
            minBondedAtoms: 2, minRingCoverage: 0.4, requireGeometryCheck: false,
        }).interactions).toEqual([]);
    });

    test('rejects purely alternating contacts while retaining adjacent 1,2,4 contacts', () => {
        const alternating = polygonStructure({ size: 6, contacts: [0, 2, 4] }).structure;
        expect(findMetalRingCentroidInteractions(
            alternating, alternating.bonds, options(),
        ).interactions).toEqual([]);

        const cp = polygonStructure({ contacts: [0, 1, 3] }).structure;
        expect(findMetalRingCentroidInteractions(cp, cp.bonds, options()).interactions)
            .toHaveLength(1);
    });

    test('does not mistake shared centre contacts for a ligand ring', () => {
        const sodium = atom('Na1', 'Na', [0, 0, 0]);
        const chlorides = Array.from({ length: 4 }, (_, index) =>
            atom(`Cl${index}`, 'Cl', [index, 0, 0]));
        const bonds = chlorides.map(chloride =>
            new Bond(sodium.uniqueId, chloride.uniqueId, 2.5));
        const structure = { atoms: [sodium, ...chlorides], bonds, cell: {} };
        expect(findMetalRingCentroidInteractions(structure, bonds, options()).interactions).toEqual([]);
    });

    test('rejects carboxylate and oversized crown coordination', () => {
        const iron = atom('Fe1', 'Fe', [0, 0, 1.5]);
        const carbon = atom('C1', 'C', [0, 0, 0]);
        const oxygens = [atom('O1', 'O', [-1, 0, 0]), atom('O2', 'O', [1, 0, 0])];
        const carboxylateBonds = [
            new Bond(carbon.uniqueId, oxygens[0].uniqueId, 1.25),
            new Bond(carbon.uniqueId, oxygens[1].uniqueId, 1.25),
            new Bond(iron.uniqueId, oxygens[0].uniqueId, 2),
            new Bond(iron.uniqueId, oxygens[1].uniqueId, 2),
        ];
        const carboxylate = { atoms: [iron, carbon, ...oxygens], bonds: carboxylateBonds, cell: {} };
        expect(findMetalRingCentroidInteractions(
            carboxylate, carboxylateBonds, options(),
        ).interactions).toEqual([]);

        const crownAtoms = Array.from({ length: 18 }, (_, index) => {
            const angle = 2 * Math.PI * index / 18;
            return atom(`${index % 2 ? 'O' : 'C'}${index}`, index % 2 ? 'O' : 'C', [
                3 * Math.cos(angle), 3 * Math.sin(angle), 0,
            ]);
        });
        const crownBonds = crownAtoms.map((current, index) =>
            new Bond(current.uniqueId, crownAtoms[(index + 1) % 18].uniqueId, 1.4));
        const crownContacts = [1, 7, 13].map(index =>
            new Bond(iron.uniqueId, crownAtoms[index].uniqueId, 3.4));
        const crown = {
            atoms: [iron, ...crownAtoms], bonds: [...crownBonds, ...crownContacts], cell: {},
        };
        expect(findMetalRingCentroidInteractions(crown, crown.bonds, options()).interactions)
            .toEqual([]);
    });

    test('rejects incoherent centre distances independently of lateral tolerance', () => {
        const { structure } = polygonStructure();
        const moved = structure.atoms.find(candidate => candidate.label === 'C1');
        const point = Object.assign([3, 0, 0], { x: 3, y: 0, z: 0 });
        moved.position.toCartesian = () => point;
        expect(findMetalRingCentroidInteractions(structure, structure.bonds, {
            ...options(), maxLateralDisplacementRatio: 10,
        }).interactions).toEqual([]);
    });

    test('makes fused candidates sharing centre contacts mutually exclusive', () => {
        const coordinates = {
            A: [-0.5, 0, 0], B: [0.5, 0, 0], C: [1, 1, 0], D: [0.5, 2, 0],
            E: [-0.5, 2, 0], F: [-1, 1, 0], G: [1, -1, 0], H: [0.5, -2, 0],
            I: [-0.5, -2, 0], J: [-1, -1, 0],
        };
        const atoms = Object.entries(coordinates).map(([label, xyz]) => atom(label, 'C', xyz));
        const byLabel = new Map(atoms.map(value => [value.label, value]));
        const iron = atom('Fe1', 'Fe', [0, 0, 1.5]);
        const edges = [
            ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A'],
            ['B', 'G'], ['G', 'H'], ['H', 'I'], ['I', 'J'], ['J', 'A'],
        ];
        const bonds = edges.map(([first, second]) =>
            new Bond(byLabel.get(first).uniqueId, byLabel.get(second).uniqueId, 1.4));
        for (const label of ['C', 'D', 'E', 'G', 'H', 'I']) {
            bonds.push(new Bond(iron.uniqueId, byLabel.get(label).uniqueId, 2));
        }
        const structure = { atoms: [iron, ...atoms], bonds, cell: {} };
        const result = findMetalRingCentroidInteractions(structure, bonds, {
            ...options(), requireGeometryCheck: false,
        });
        expect(result.interactions).toHaveLength(1);
    });

    test('keeps distinct same-centre rings that share only one spiro atom', () => {
        const coordinates = {
            A: [0, 0, 0], B: [1, 0, 0], C: [1.5, 1, 0], D: [0.5, 2, 0],
            E: [-0.5, 1, 0], F: [-1, 0, 0], G: [-1.5, -1, 0], H: [-0.5, -2, 0],
            I: [0.5, -1, 0],
        };
        const atoms = Object.entries(coordinates).map(([label, xyz]) => atom(label, 'C', xyz));
        const byLabel = new Map(atoms.map(value => [value.label, value]));
        const iron = atom('Fe1', 'Fe', [0, 0, 1.5]);
        const edges = [
            ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'A'],
            ['A', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'I'], ['I', 'A'],
        ];
        const bonds = edges.map(([first, second]) =>
            new Bond(byLabel.get(first).uniqueId, byLabel.get(second).uniqueId, 1.4));
        for (const label of ['B', 'C', 'D', 'F', 'G', 'H']) {
            bonds.push(new Bond(iron.uniqueId, byLabel.get(label).uniqueId, 2));
        }
        const structure = { atoms: [iron, ...atoms], bonds, cell: {} };
        const result = findMetalRingCentroidInteractions(structure, bonds, {
            ...options(), requireGeometryCheck: false,
        });
        expect(result.interactions).toHaveLength(2);
    });

    test('validates nested configuration', () => {
        expect(() => validateMetalRingCentroidOptions({
            ...options(), minRingSize: 9, maxRingSize: 5,
        })).toThrow(/minRingSize/);
        expect(() => validateMetalRingCentroidOptions({ ...options(), dashFraction: 0 }))
            .toThrow(/dashFraction/);
        expect(() => validateMetalRingCentroidOptions({
            ...options(), maxRingPlanarityRatio: -0.1,
        })).toThrow(/maxRingPlanarityRatio/);
    });

    test.each(['solid-3d', 'cutout-3d', 'cutout-2d'])(
        'renders transient non-selectable capsules in %s', renderStyle => {
            const { structure } = polygonStructure();
            const originalBonds = [...structure.bonds];
            const ortep = new ORTEP3JsStructure(structure, {
                collapseMetalRingBonds: true,
                renderStyle,
            });

            expect(ortep.centroidInteractions).toHaveLength(1);
            expect(ortep.bonds3D).toHaveLength(5);
            expect(ortep.centroidBodyPool.mesh.userData.selectable).toBe(false);
            expect(ortep.centroidCapPool.mesh.userData.selectable).toBe(false);
            expect(ortep.centroidBodyPool === ortep.bondPool)
                .toBe(renderStyle !== 'cutout-2d');
            expect(Boolean(ortep.centroidOutlineBodyPool)).toBe(renderStyle === 'cutout-2d');
            expect(Boolean(ortep.centroidOutlineCapPool)).toBe(renderStyle === 'cutout-2d');
            expect(ortep.centroidOutlineBodyPool?.mesh.instanceMatrix ?? null).toBe(
                renderStyle === 'cutout-2d' ? ortep.centroidBodyPool.mesh.instanceMatrix : null,
            );
            expect(ortep.centroidOutlineCapPool?.mesh.instanceMatrix ?? null).toBe(
                renderStyle === 'cutout-2d' ? ortep.centroidCapPool.mesh.instanceMatrix : null,
            );
            const group = ortep.getGroup();
            expect(group.children.filter(child => child === ortep.centroidCapPool.mesh)).toHaveLength(1);
            expect(group.children.filter(child => child === ortep.bondPool?.mesh)).toHaveLength(
                renderStyle === 'cutout-2d' ? 0 : 1,
            );
            expect(structure.bonds).toEqual(originalBonds);
            ortep.dispose();
        },
    );

    test('keeps split-colour bonds and centroid bodies in one draw pool', () => {
        const { structure } = polygonStructure();
        const ortep = new ORTEP3JsStructure(structure, {
            collapseMetalRingBonds: true,
            bondColorMode: 'split',
        });

        expect(ortep.centroidBodyPool).toBe(ortep.bondPool);
        expect(ortep.bondPool.mesh.instanceColor).toBeTruthy();
        expect(ortep.bondPool.nextIndex).toBe(ortep.bondPool.mesh.count);
        expect(ortep.getGroup().children.filter(child => child === ortep.bondPool.mesh))
            .toHaveLength(1);
        ortep.dispose();
    });
});

describe('round-capped centroid dash layout', () => {
    test('includes the metal-side clearance in evenly distributed whitespace', () => {
        const dashes = layoutCentroidDashes(1.5, 0.3, 0.6);
        expect(dashes.at(-1).end).toBe(1.5);
        const gaps = dashes.slice(1).map((dash, index) => dash.start - dashes[index].end);
        expect(dashes[0].start).toBeCloseTo(gaps[0]);
        gaps.forEach(gap => expect(gap).toBeCloseTo(gaps[0]));
    });

    test('reserves leading whitespace even for a single short dash', () => {
        const [dash] = layoutCentroidDashes(0.2, 0.3, 0.6);
        expect(dash.start).toBeCloseTo(0.08);
        expect(dash.end).toBe(0.2);
    });

    test('builds capsule bodies and caps without negative lengths', () => {
        const transforms = computeCentroidDashTransforms(
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.5, 0), options(), 0.05,
        );
        expect(transforms.bodies.length).toBeGreaterThan(0);
        expect(transforms.caps).toHaveLength(transforms.bodies.length * 2);
        transforms.bodies.forEach(({ matrix }) => {
            const scale = new THREE.Vector3();
            matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
            expect(scale.y).toBeGreaterThan(0);
        });
    });

    test('uses a scaled sphere for a dash shorter than two cap radii', () => {
        const transforms = computeCentroidDashTransforms(
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.08, 0), options(), 0.05,
        );
        expect(transforms.bodies).toEqual([]);
        expect(transforms.caps).toHaveLength(1);
    });
});
