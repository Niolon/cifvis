import { C as e, a as t, f as n, h as r, m as i, p as a } from "./crystal-lXuG9SGp.js";
import { n as o, r as s, t as c } from "./bond-classification-7Zs9jDm-.js";
import { a as l, c as u, d, f, l as p, r as m, t as h, u as g } from "./plane-contours-BPCSbldp.js";
import * as _ from "three";
import { Box3 as v, BufferAttribute as y, BufferGeometry as b, Float32BufferAttribute as x, InstancedBufferGeometry as S, InstancedInterleavedBuffer as C, InterleavedBufferAttribute as w, Line3 as ee, MathUtils as te, Matrix4 as ne, Mesh as T, ShaderLib as E, ShaderMaterial as re, Sphere as ie, UniformsLib as D, UniformsUtils as ae, Vector2 as oe, Vector3 as O, Vector4 as k, WireframeGeometry as se } from "three";
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function ce(e, t = !1) {
	let n = e[0].index !== null, r = new Set(Object.keys(e[0].attributes)), i = new Set(Object.keys(e[0].morphAttributes)), a = {}, o = {}, s = e[0].morphTargetsRelative, c = new b(), l = 0;
	for (let u = 0; u < e.length; ++u) {
		let d = e[u], f = 0;
		if (n !== (d.index !== null)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."), null;
		for (let e in d.attributes) {
			if (!r.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ". All geometries must have compatible attributes; make sure \"" + e + "\" attribute exists among all geometries, or in none of them."), null;
			a[e] === void 0 && (a[e] = []), a[e].push(d.attributes[e]), f++;
		}
		if (f !== r.size) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ". Make sure all geometries have the same number of attributes."), null;
		if (s !== d.morphTargetsRelative) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ". .morphTargetsRelative must be consistent throughout all geometries."), null;
		for (let e in d.morphAttributes) {
			if (!i.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ".  .morphAttributes must be consistent throughout all geometries."), null;
			o[e] === void 0 && (o[e] = []), o[e].push(d.morphAttributes[e]);
		}
		if (t) {
			let e;
			if (n) e = d.index.count;
			else if (d.attributes.position !== void 0) e = d.attributes.position.count;
			else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + u + ". The geometry must have either an index or a position attribute"), null;
			c.addGroup(l, e, u), l += e;
		}
	}
	if (n) {
		let t = 0, n = [];
		for (let r = 0; r < e.length; ++r) {
			let i = e[r].index;
			for (let e = 0; e < i.count; ++e) n.push(i.getX(e) + t);
			t += e[r].attributes.position.count;
		}
		c.setIndex(n);
	}
	for (let e in a) {
		let t = le(a[e]);
		if (!t) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " attribute."), null;
		c.setAttribute(e, t);
	}
	for (let e in o) {
		let t = o[e][0].length;
		if (t !== 0) {
			c.morphAttributes = c.morphAttributes || {}, c.morphAttributes[e] = [];
			for (let n = 0; n < t; ++n) {
				let t = [];
				for (let r = 0; r < o[e].length; ++r) t.push(o[e][r][n]);
				let r = le(t);
				if (!r) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
				c.morphAttributes[e].push(r);
			}
		}
	}
	return c;
}
function le(e) {
	let t, n, r, i = -1, a = 0;
	for (let o = 0; o < e.length; ++o) {
		let s = e[o];
		if (t === void 0 && (t = s.array.constructor), t !== s.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
		if (n === void 0 && (n = s.itemSize), n !== s.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
		if (r === void 0 && (r = s.normalized), r !== s.normalized) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
		if (i === -1 && (i = s.gpuType), i !== s.gpuType) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."), null;
		a += s.count * n;
	}
	let o = new t(a), s = new y(o, n, r), c = 0;
	for (let t = 0; t < e.length; ++t) {
		let r = e[t];
		if (r.isInterleavedBufferAttribute) {
			let e = c / n;
			for (let t = 0, i = r.count; t < i; t++) for (let i = 0; i < n; i++) {
				let n = r.getComponent(t, i);
				s.setComponent(t + e, i, n);
			}
		} else o.set(r.array, c);
		c += r.count * n;
	}
	return i !== void 0 && (s.gpuType = i), s;
}
var A = {
	centreElements: /* @__PURE__ */ "Li.Be.Na.Mg.Al.K.Ca.Sc.Ti.V.Cr.Mn.Fe.Co.Ni.Cu.Zn.Ga.Rb.Sr.Y.Zr.Nb.Mo.Tc.Ru.Rh.Pd.Ag.Cd.In.Sn.Cs.Ba.La.Ce.Pr.Nd.Pm.Sm.Eu.Gd.Tb.Dy.Ho.Er.Tm.Yb.Lu.Hf.Ta.W.Re.Os.Ir.Pt.Au.Hg.Tl.Pb.Bi.Po.Fr.Ra.Ac.Th.Pa.U.Np.Pu.Am.Cm.Bk.Cf".split("."),
	ringElements: [
		"B",
		"C",
		"N",
		"O",
		"P",
		"S"
	],
	minRingSize: 5,
	maxRingSize: 8,
	minBondedAtoms: 3,
	minRingCoverage: .5,
	requireGeometryCheck: !0,
	maxRingPlanarityRatio: .15,
	maxLateralDisplacementRatio: .75,
	maxDistanceSpreadRatio: .35,
	dashSegmentLength: .3,
	dashFraction: .6
};
function ue(e) {
	for (let t of ["centreElements", "ringElements"]) if (!Array.isArray(e[t]) || e[t].length === 0 || e[t].some((e) => typeof e != "string" || e.length === 0)) throw TypeError(`metalRingCentroidOptions.${t} must be a non-empty string array`);
	for (let t of [
		"minRingSize",
		"maxRingSize",
		"minBondedAtoms"
	]) if (!Number.isInteger(e[t]) || e[t] < 1) throw TypeError(`metalRingCentroidOptions.${t} must be a positive integer`);
	if (e.minRingSize > e.maxRingSize) throw TypeError("metalRingCentroidOptions.minRingSize must not exceed maxRingSize");
	if (e.minBondedAtoms > e.maxRingSize) throw TypeError("metalRingCentroidOptions.minBondedAtoms must not exceed maxRingSize");
	if (typeof e.requireGeometryCheck != "boolean") throw TypeError("metalRingCentroidOptions.requireGeometryCheck must be boolean");
	for (let t of ["minRingCoverage", "dashFraction"]) if (!(Number.isFinite(e[t]) && e[t] > 0 && e[t] <= 1)) throw TypeError(`metalRingCentroidOptions.${t} must be greater than 0 and at most 1`);
	for (let t of [
		"maxRingPlanarityRatio",
		"maxLateralDisplacementRatio",
		"maxDistanceSpreadRatio"
	]) if (!(Number.isFinite(e[t]) && e[t] >= 0)) throw TypeError(`metalRingCentroidOptions.${t} must be a non-negative finite number`);
	if (!(Number.isFinite(e.dashSegmentLength) && e.dashSegmentLength > 0)) throw TypeError("metalRingCentroidOptions.dashSegmentLength must be a positive finite number");
}
function de(e) {
	let t = [];
	for (let n of [e, [...e].reverse()]) for (let e = 0; e < n.length; e++) t.push([...n.slice(e), ...n.slice(0, e)].join("\0"));
	return t.sort(), t[0];
}
function fe(e, t) {
	let n = e.length;
	for (let r = 0; r < n; r++) for (let i = r + 1; i < n; i++) if (!(i === r + 1 || r === 0 && i === n - 1) && t.get(e[r])?.has(e[i])) return !1;
	return !0;
}
function pe(e, t, n, r, i = /* @__PURE__ */ new Set()) {
	let a = /* @__PURE__ */ new Map();
	for (let o of t) {
		if (!e.has(o) || i.has(o)) continue;
		let t = (s, c, l) => {
			for (let u of e.get(s) || []) i.has(u) || (u === o ? c.length >= n && fe(c, e) && a.set(de(c), [...c]) : !l.has(u) && c.length < r && (l.add(u), t(u, [...c, u], l), l.delete(u)));
		};
		t(o, [o], /* @__PURE__ */ new Set([o]));
	}
	return [...a.entries()].map(([e, t]) => ({
		key: e,
		atoms: t
	}));
}
function me(e, t) {
	let n = e.position.toCartesian(t);
	return [
		n.x,
		n.y,
		n.z
	];
}
var he = (e, t) => Math.hypot(e[0] - t[0], e[1] - t[1], e[2] - t[2]);
function ge(t, n, r) {
	let i = me(t, r), a = n.map((e) => me(e, r));
	if ([...i, ...a.flat()].some((e) => !Number.isFinite(e))) return null;
	let o = [
		0,
		1,
		2
	].map((e) => a.reduce((t, n) => t + n[e], 0) / a.length), s = a.map((e) => e.map((e, t) => e - o[t])), c = e([
		0,
		1,
		2
	].map((e) => [
		0,
		1,
		2
	].map((t) => s.reduce((n, r) => n + r[e] * r[t], 0) / s.length)));
	if (c.values.some((e) => !Number.isFinite(e))) return null;
	let l = Math.max(1, Math.abs(c.values[2]));
	if (!(c.values[1] > l * 1e-12)) return null;
	let u = c.eigenvectors[0].vector.toArray();
	if (u.some((e) => !Number.isFinite(e))) return null;
	let d = i.map((e, t) => e - o[t]), f = d.reduce((e, t, n) => e + t * u[n], 0), p = Math.hypot(...d.map((e, t) => e - f * u[t])), m = s.reduce((e, t) => e + Math.hypot(...t), 0) / s.length;
	if (!(m > 0)) return null;
	let h = a.map((e) => he(i, e)), g = h.reduce((e, t) => e + t, 0) / h.length;
	return g > 0 ? {
		centroid: o,
		ringPlanarityRatio: Math.sqrt(Math.max(0, c.values[0])) / m,
		lateralDisplacementRatio: p / m,
		distanceSpreadRatio: (Math.max(...h) - Math.min(...h)) / g
	} : null;
}
function _e(e) {
	return [e.atom1Id, e.atom2Id].sort().join("\0");
}
function ve(e, t, n) {
	let r = new Map(e.atoms.map((e) => [e.uniqueId, e])), i = new Set(n.centreElements), a = new Set(n.ringElements), o = /* @__PURE__ */ new Map(), s = (e, t) => {
		o.has(e) || o.set(e, /* @__PURE__ */ new Set()), o.has(t) || o.set(t, /* @__PURE__ */ new Set()), o.get(e).add(t), o.get(t).add(e);
	};
	for (let n of c(e, t)) {
		let e = r.get(n.atom1Id), t = r.get(n.atom2Id);
		e && t && a.has(e.atomType) && a.has(t.atomType) && s(e.uniqueId, t.uniqueId);
	}
	let l = /* @__PURE__ */ new Map(), u = (e, t, n) => {
		!i.has(e.atomType) || !a.has(t.atomType) || (l.has(e.uniqueId) || l.set(e.uniqueId, []), l.get(e.uniqueId).push({
			ligandId: t.uniqueId,
			bond: n
		}));
	};
	for (let e of t) {
		let t = r.get(e.atom1Id), n = r.get(e.atom2Id);
		!t || !n || (u(t, n, e), u(n, t, e));
	}
	let d = [];
	for (let [t, i] of l) {
		let a = r.get(t), s = new Set(i.map((e) => e.ligandId));
		for (let c of pe(o, s, n.minRingSize, n.maxRingSize, /* @__PURE__ */ new Set([t]))) {
			let t = new Set(c.atoms), o = i.filter((e) => t.has(e.ligandId)), s = [...new Set(o.map((e) => e.ligandId))], l = s.length / c.atoms.length;
			if (s.length < n.minBondedAtoms || l < n.minRingCoverage) continue;
			let u = new Set(s);
			if (!c.atoms.some((e, t) => u.has(e) && u.has(c.atoms[(t + 1) % c.atoms.length]))) continue;
			let f = c.atoms.map((e) => r.get(e)), p = ge(a, f, e.cell);
			p && (n.requireGeometryCheck && (p.ringPlanarityRatio > n.maxRingPlanarityRatio || p.lateralDisplacementRatio > n.maxLateralDisplacementRatio || p.distanceSpreadRatio > n.maxDistanceSpreadRatio) || d.push({
				type: "ring-centroid-bond",
				centreAtom: a,
				ringAtoms: f,
				originalBondedAtoms: s.map((e) => r.get(e)),
				originalBonds: o.map((e) => e.bond),
				centroid: p.centroid,
				coverage: l,
				bondedAtomCount: s.length,
				ringPlanarityRatio: p.ringPlanarityRatio,
				lateralDisplacementRatio: p.lateralDisplacementRatio,
				distanceSpreadRatio: p.distanceSpreadRatio,
				canonicalRingId: c.key
			}));
		}
	}
	d.sort((e, t) => t.coverage - e.coverage || t.bondedAtomCount - e.bondedAtomCount || e.lateralDisplacementRatio - t.lateralDisplacementRatio || e.ringAtoms.length - t.ringAtoms.length || e.canonicalRingId.localeCompare(t.canonicalRingId));
	let f = /* @__PURE__ */ new Set(), p = /* @__PURE__ */ new Map(), m = [];
	for (let e of d) {
		let t = e.originalBonds.map(_e), n = e.centreAtom.uniqueId, r = p.get(n) || [], i = new Set(e.ringAtoms.map((e) => e.uniqueId)), a = r.some((e) => {
			let t = 0;
			for (let n of i) if (e.has(n) && ++t >= 2) return !0;
			return !1;
		});
		t.some((e) => f.has(e)) || a || (t.forEach((e) => f.add(e)), r.push(i), p.set(n, r), m.push(e));
	}
	return {
		interactions: m,
		suppressedBonds: new Set(m.flatMap((e) => e.originalBonds))
	};
}
function ye(e, t, n) {
	if (!(e > 0)) return [];
	let r = Math.max(1, Math.round(e / t)), i = e / r, a = i * n, o = i - a;
	return Array.from({ length: r }, (t, n) => {
		let s = o + n * i;
		return {
			start: s,
			end: n === r - 1 ? e : s + a
		};
	});
}
//#endregion
//#region src/lib/ortep3d/structure-settings.js
var be = Object.fromEntries(Object.entries({
	H: {
		atomColor: "#ffffff",
		ringColor: "#000000"
	},
	D: {
		atomColor: "#ffffff",
		ringColor: "#000000"
	},
	He: {
		atomColor: "#d9ffff",
		ringColor: "#000000"
	},
	Li: {
		atomColor: "#cc80ff",
		ringColor: "#000000"
	},
	Be: {
		atomColor: "#c2ff00",
		ringColor: "#000000"
	},
	B: {
		atomColor: "#ffb5b5",
		ringColor: "#000000"
	},
	C: {
		atomColor: "#000000",
		ringColor: "#ffffff"
	},
	N: {
		atomColor: "#3050f8",
		ringColor: "#ffffff"
	},
	O: {
		atomColor: "#ff0d0d",
		ringColor: "#ffffff"
	},
	F: {
		atomColor: "#90e050",
		ringColor: "#000000"
	},
	Ne: {
		atomColor: "#b3e3f5",
		ringColor: "#000000"
	},
	Na: {
		atomColor: "#ab5cf2",
		ringColor: "#ffffff"
	},
	Mg: {
		atomColor: "#8aff00",
		ringColor: "#000000"
	},
	Al: {
		atomColor: "#bfa6a6",
		ringColor: "#000000"
	},
	Si: {
		atomColor: "#f0c8a0",
		ringColor: "#000000"
	},
	P: {
		atomColor: "#ff8000",
		ringColor: "#000000"
	},
	S: {
		atomColor: "#ffff30",
		ringColor: "#000000"
	},
	Cl: {
		atomColor: "#1ff01f",
		ringColor: "#000000"
	},
	Ar: {
		atomColor: "#80d1e3",
		ringColor: "#000000"
	},
	K: {
		atomColor: "#8f40d4",
		ringColor: "#ffffff"
	},
	Ca: {
		atomColor: "#3dff00",
		ringColor: "#000000"
	},
	Sc: {
		atomColor: "#e6e6e6",
		ringColor: "#000000"
	},
	Ti: {
		atomColor: "#bfc2c7",
		ringColor: "#000000"
	},
	V: {
		atomColor: "#a6a6ab",
		ringColor: "#000000"
	},
	Cr: {
		atomColor: "#8a99c7",
		ringColor: "#000000"
	},
	Mn: {
		atomColor: "#9c7ac7",
		ringColor: "#000000"
	},
	Fe: {
		atomColor: "#e06633",
		ringColor: "#ffffff"
	},
	Co: {
		atomColor: "#f090a0",
		ringColor: "#000000"
	},
	Ni: {
		atomColor: "#50d050",
		ringColor: "#000000"
	},
	Cu: {
		atomColor: "#c88033",
		ringColor: "#000000"
	},
	Zn: {
		atomColor: "#7d80b0",
		ringColor: "#000000"
	},
	Ga: {
		atomColor: "#c28f8f",
		ringColor: "#000000"
	},
	Ge: {
		atomColor: "#668f8f",
		ringColor: "#000000"
	},
	As: {
		atomColor: "#bd80e3",
		ringColor: "#000000"
	},
	Se: {
		atomColor: "#ffa100",
		ringColor: "#000000"
	},
	Br: {
		atomColor: "#a62929",
		ringColor: "#ffffff"
	},
	Kr: {
		atomColor: "#5cb8d1",
		ringColor: "#000000"
	},
	Rb: {
		atomColor: "#702eb0",
		ringColor: "#ffffff"
	},
	Sr: {
		atomColor: "#00ff00",
		ringColor: "#000000"
	},
	Y: {
		atomColor: "#94ffff",
		ringColor: "#000000"
	},
	Zr: {
		atomColor: "#94e0e0",
		ringColor: "#000000"
	},
	Nb: {
		atomColor: "#73c2c9",
		ringColor: "#000000"
	},
	Mo: {
		atomColor: "#54b5b5",
		ringColor: "#000000"
	},
	Tc: {
		atomColor: "#3b9e9e",
		ringColor: "#000000"
	},
	Ru: {
		atomColor: "#248f8f",
		ringColor: "#000000"
	},
	Rh: {
		atomColor: "#0a7d8c",
		ringColor: "#000000"
	},
	Pd: {
		atomColor: "#006985",
		ringColor: "#ffffff"
	},
	Ag: {
		atomColor: "#c0c0c0",
		ringColor: "#000000"
	},
	Cd: {
		atomColor: "#ffd98f",
		ringColor: "#000000"
	},
	In: {
		atomColor: "#a67573",
		ringColor: "#000000"
	},
	Sn: {
		atomColor: "#668080",
		ringColor: "#000000"
	},
	Sb: {
		atomColor: "#9e63b5",
		ringColor: "#ffffff"
	},
	Te: {
		atomColor: "#d47a00",
		ringColor: "#000000"
	},
	I: {
		atomColor: "#940094",
		ringColor: "#ffffff"
	},
	Xe: {
		atomColor: "#429eb0",
		ringColor: "#000000"
	},
	Cs: {
		atomColor: "#57178f",
		ringColor: "#ffffff"
	},
	Ba: {
		atomColor: "#00c900",
		ringColor: "#000000"
	},
	La: {
		atomColor: "#70d4ff",
		ringColor: "#000000"
	},
	Ce: {
		atomColor: "#ffffc7",
		ringColor: "#000000"
	},
	Pr: {
		atomColor: "#d9ffc7",
		ringColor: "#000000"
	},
	Nd: {
		atomColor: "#c7ffc7",
		ringColor: "#000000"
	},
	Pm: {
		atomColor: "#a3ffc7",
		ringColor: "#000000"
	},
	Sm: {
		atomColor: "#8fffc7",
		ringColor: "#000000"
	},
	Eu: {
		atomColor: "#61ffc7",
		ringColor: "#000000"
	},
	Gd: {
		atomColor: "#45ffc7",
		ringColor: "#000000"
	},
	Tb: {
		atomColor: "#30ffc7",
		ringColor: "#000000"
	},
	Dy: {
		atomColor: "#1fffc7",
		ringColor: "#000000"
	},
	Ho: {
		atomColor: "#00ff9c",
		ringColor: "#000000"
	},
	Er: {
		atomColor: "#00e675",
		ringColor: "#000000"
	},
	Tm: {
		atomColor: "#00d452",
		ringColor: "#000000"
	},
	Yb: {
		atomColor: "#00bf38",
		ringColor: "#000000"
	},
	Lu: {
		atomColor: "#00ab24",
		ringColor: "#000000"
	},
	Hf: {
		atomColor: "#4dc2ff",
		ringColor: "#000000"
	},
	Ta: {
		atomColor: "#4da6ff",
		ringColor: "#000000"
	},
	W: {
		atomColor: "#2194d6",
		ringColor: "#000000"
	},
	Re: {
		atomColor: "#267dab",
		ringColor: "#000000"
	},
	Os: {
		atomColor: "#266696",
		ringColor: "#ffffff"
	},
	Ir: {
		atomColor: "#175487",
		ringColor: "#ffffff"
	},
	Pt: {
		atomColor: "#d0d0e0",
		ringColor: "#000000"
	},
	Au: {
		atomColor: "#ffd123",
		ringColor: "#000000"
	},
	Hg: {
		atomColor: "#b8b8d0",
		ringColor: "#000000"
	},
	Tl: {
		atomColor: "#a6544d",
		ringColor: "#ffffff"
	},
	Pb: {
		atomColor: "#575961",
		ringColor: "#ffffff"
	},
	Bi: {
		atomColor: "#9e4fb5",
		ringColor: "#ffffff"
	},
	Po: {
		atomColor: "#ab5c00",
		ringColor: "#ffffff"
	},
	At: {
		atomColor: "#754f45",
		ringColor: "#ffffff"
	},
	Rn: {
		atomColor: "#428296",
		ringColor: "#000000"
	},
	Fr: {
		atomColor: "#420066",
		ringColor: "#ffffff"
	},
	Ra: {
		atomColor: "#007d00",
		ringColor: "#000000"
	},
	Ac: {
		atomColor: "#70abfa",
		ringColor: "#000000"
	},
	Th: {
		atomColor: "#00baff",
		ringColor: "#000000"
	},
	Pa: {
		atomColor: "#00a1ff",
		ringColor: "#000000"
	},
	U: {
		atomColor: "#008fff",
		ringColor: "#000000"
	},
	Np: {
		atomColor: "#0080ff",
		ringColor: "#000000"
	},
	Pu: {
		atomColor: "#006bff",
		ringColor: "#ffffff"
	},
	Am: {
		atomColor: "#545cf2",
		ringColor: "#ffffff"
	},
	Cm: {
		atomColor: "#785ce3",
		ringColor: "#ffffff"
	},
	Bk: {
		atomColor: "#8a4fe3",
		ringColor: "#ffffff"
	},
	Cf: {
		atomColor: "#a136d4",
		ringColor: "#ffffff"
	}
}).map(([e, t]) => [e, {
	radius: o[e] ?? s[e],
	...t
}])), xe = {
	camera: {
		type: "orthographic",
		minDistance: 1,
		maxDistance: 100,
		wheelZoomSpeed: 8e-4,
		pinchZoomSpeed: .001,
		initialPosition: [
			0,
			0,
			10
		],
		fov: 45,
		near: .1,
		far: 1e3
	},
	selection: {
		mode: "multiple",
		markerMult: 1.3,
		bondMarkerMult: 1.7,
		haloWidth: 4,
		highlightEmissive: 11184810,
		markerColors: [
			2062260,
			16744206,
			2924588,
			14034728,
			9725885,
			9197131,
			14907330,
			8355711,
			12369186,
			1556175
		]
	},
	measurement: {
		lineRadius: .075,
		markerRadius: .11,
		markerColors: [
			58879,
			16723349,
			11988992,
			16766464,
			8146431
		]
	},
	interaction: {
		rotationSpeed: 5,
		lockRotation: !1,
		lockZoom: !1,
		clickThreshold: 200,
		mouseRaycast: {
			lineThreshold: .5,
			pointsThreshold: .5,
			meshThreshold: .1
		},
		touchRaycast: {
			lineThreshold: 2,
			pointsThreshold: 2,
			meshThreshold: .2
		}
	},
	renderMode: "onDemand",
	debug: !1,
	renderStyle: "solid-3d",
	adpRepresentation: "ellipsoid",
	sealCutoutCavity: !0,
	plot2DBackground: "#ffffff",
	plot2DAtomColor: "#ffffff",
	plot2DLineColor: "#000000",
	plot2DBondColor: "#000000",
	plot2DBondOutlineColor: "#ffffff",
	plot2DBondOutlineWidth: 2,
	plot2DColorLuminanceCeiling: .25,
	plot2DColorLuminanceFloor: null,
	plot2DOpenBondInnerScale: .5,
	plot2DStripeCount: 7,
	plot2DStripeWidth: .18,
	plot2DOutlineWidth: 1.2,
	hydrogenMode: "none",
	disorderMode: "all",
	symmetryMode: "none",
	packingCutoff: 1.001,
	differenceDensity: f,
	scalarField: d,
	isosurface: g,
	contourLines: p,
	bondGrowTolerance: .45,
	fixCifErrors: !1,
	atomLabels: {
		show: "none",
		subscriptNonElement: !1,
		placementMode: "auto-omit",
		text: {},
		fontSize: 14,
		fontWeight: 500,
		fontFamily: "system-ui, -apple-system, sans-serif",
		colorMode: "uniform",
		color: "#111111",
		atomColorLuminanceCeiling: .25,
		atomColorLuminanceFloor: null,
		haloColor: "#ffffff",
		haloWidth: 2,
		leaderLines: "auto",
		leaderColor: "label",
		leaderWidth: 1,
		atomPadding: 3,
		bondPadding: 2,
		labelPadding: 2,
		viewportPadding: 4,
		fallbackDistance: 18,
		maxConnectorLength: Infinity,
		ringPenalty: 1e3,
		movementPenalty: 80,
		repairDepth: 2,
		repairSearchLimit: 48,
		autoPerformanceLabelThreshold: 500,
		performanceNoSpaceCellSize: 24,
		spatialCellSize: 64,
		useWorker: !0,
		showLoadingIndicator: !0,
		loadingIndicatorDelayMs: 120,
		layoutThrottleMs: 32,
		interactionLabelLimit: 300,
		hideLabelsDuringDeferredLayout: !0,
		calloutPlacement: "structure",
		calloutGap: 12,
		maximumCoverageDistanceSteps: 6,
		calloutColumns: 3,
		calloutColumnGap: 8,
		calloutRowGap: 4,
		calloutSearchLimit: 64,
		calloutChoiceLimit: 4,
		leaderBondCrossingPenalty: 25,
		maxVisible: Infinity
	},
	ellipsoidProbability: .5,
	peanutScale: 1.5381723183496745,
	peanutMeridianCount: 10,
	peanutLatitudeIntervals: 6,
	peanutGridPoleAxis: "structure-y",
	peanutGridLineWidth: .01,
	peanutDetail: 5,
	atomDetail: 3,
	atomCutawayHysteresis: .025,
	atomCutawayStripeCount: 7,
	atomCutawayStripeWidth: .5,
	atomColorRoughness: .4,
	atomColorMetalness: .5,
	atomADPRingWidthFactor: 1,
	atomADPRingHeight: .06,
	atomADPRingSections: 18,
	atomADPInnerSections: 7,
	atomConstantRadiusMultiplier: .25,
	bondRadius: .05,
	bondSections: 15,
	bondColorMode: "uniform",
	bondColor: "#666666",
	bondDisorderColorsEnabled: !0,
	bondColorPart1: "#333333",
	bondColorPart2Plus: "#CCCCCC",
	bondColorRoughness: .3,
	bondColorMetalness: .1,
	collapseMetalRingBonds: !1,
	metalRingCentroidOptions: {
		...A,
		centreElements: [...A.centreElements],
		ringElements: [...A.ringElements]
	},
	hbondRadius: .04,
	hbondColor: "#AAAAAA",
	hbondColorRoughness: .3,
	hbondColorMetalness: .1,
	hbondDashSegmentLength: .3,
	hbondDashFraction: .6,
	cell: {
		boxColor: "#000000",
		boxOpacity: .8,
		boxLineWidth: 2,
		arrowColorA: "#E74C3C",
		arrowColorB: "#2ECC71",
		arrowColorC: "#3498DB",
		arrowHeadLengthMult: .05,
		arrowHeadWidthMult: .25,
		arrowCylinderRadius: .04
	},
	elementProperties: be
};
function Se(e) {
	if (typeof e != "object" || !e) return e;
	for (let t of Object.values(e)) Se(t);
	return Object.isFrozen(e) ? e : Object.freeze(e);
}
var j = Se(xe);
//#endregion
//#region src/lib/ortep3d/color-utils.js
function Ce(e) {
	let t = e?.isColor ? e : new _.Color(e);
	return .2126 * t.r + .7152 * t.g + .0722 * t.b;
}
function we(e, t = 1) {
	let n = _.MathUtils.clamp(t, 0, 1), r = e.reduce((e, t) => Math.max(e, Ce(t)), 0);
	return r > n && r > 0 ? n / r : 1;
}
function M(e, t) {
	return new _.Color().set(e).multiplyScalar(_.MathUtils.clamp(t, 0, 1));
}
function Te(e, t = 0) {
	let n = _.MathUtils.clamp(t, 0, 1), r = e.reduce((e, t) => Math.min(e, Ce(t)), 1);
	return r >= n ? 0 : r < 1 ? (n - r) / (1 - r) : 0;
}
function N(e, t) {
	return new _.Color().set(e).lerp(new _.Color(1, 1, 1), _.MathUtils.clamp(t, 0, 1));
}
//#endregion
//#region src/lib/ortep3d/ortep.js
var P = [
	[
		-1,
		-1,
		-1
	],
	[
		-1,
		-1,
		1
	],
	[
		-1,
		1,
		-1
	],
	[
		-1,
		1,
		1
	],
	[
		1,
		-1,
		-1
	],
	[
		1,
		-1,
		1
	],
	[
		1,
		1,
		-1
	],
	[
		1,
		1,
		1
	]
], F = [
	-1,
	1,
	1
];
function Ee(e) {
	return e === "cutout-3d" ? "explanatory-3d" : e === "cutout-2d" ? "publication-2d" : "clean-3d";
}
var De = "\n    attribute vec3 peanutShape;\n    uniform vec3 peanutUniformShape;\n    uniform mat3 peanutGridRotation;\n    uniform mat3 peanutGridBasis;\n    uniform float uPeanutOutlinePx;\n    uniform vec2 uPeanutOutlineViewport;\n    varying vec3 vPeanutGridDirection;\n    varying vec3 vPeanutWorldPosition;\n    varying vec3 vPeanutViewNormal;\n    varying vec3 vPeanutViewDirection;\n", Oe = "\n    vec3 peanutDirection = normalize( position );\n    #ifdef PEANUT_UNIFORM_SHAPE\n        vec3 activePeanutShape = peanutUniformShape;\n    #else\n        vec3 activePeanutShape = peanutShape;\n    #endif\n    float peanutQ = dot( activePeanutShape, peanutDirection * peanutDirection );\n    vec3 transformed = position * sqrt( max( peanutQ, 0.0 ) );\n", ke = "\n    vec3 peanutNormalDirection = normalize( position );\n    #ifdef PEANUT_UNIFORM_SHAPE\n        vec3 peanutNormalShape = peanutUniformShape;\n    #else\n        vec3 peanutNormalShape = peanutShape;\n    #endif\n    float peanutNormalQ = dot(\n        peanutNormalShape,\n        peanutNormalDirection * peanutNormalDirection\n    );\n    vec3 objectNormal = normalize(\n        2.0 * peanutNormalQ * peanutNormalDirection -\n        peanutNormalShape * peanutNormalDirection\n    );\n", Ae = "\n    varying vec3 vPeanutGridDirection;\n    varying vec3 vPeanutWorldPosition;\n    varying vec3 vPeanutViewNormal;\n    varying vec3 vPeanutViewDirection;\n    uniform vec3 peanutGridColor;\n    uniform float peanutGridLineWidth;\n    uniform float peanutMeridianCount;\n    uniform float peanutLatitudeIntervals;\n\n    float peanutPeriodicLine( float coordinate, vec3 surfacePosition ) {\n        float distanceToLine = abs( fract( coordinate + 0.5 ) - 0.5 );\n        vec2 coordinateGradient = vec2( dFdx( coordinate ), dFdy( coordinate ) );\n        float coordinatePerPixel = max( length( coordinateGradient ), 0.0001 );\n        vec2 screenNormal = coordinateGradient / coordinatePerPixel;\n        float worldPerPixel = max( length(\n            dFdx( surfacePosition ) * screenNormal.x +\n            dFdy( surfacePosition ) * screenNormal.y\n        ), 0.000001 );\n        float halfWidth = 0.5 * peanutGridLineWidth *\n            coordinatePerPixel / worldPerPixel;\n        float antialias = 0.5 * coordinatePerPixel;\n        return 1.0 - smoothstep(\n            max( halfWidth - antialias, 0.0 ),\n            halfWidth + antialias,\n            distanceToLine\n        );\n    }\n\n    float peanutSurfaceGrid( vec3 rawDirection, vec3 surfacePosition ) {\n        vec3 direction = normalize( rawDirection );\n        float longitude = atan( direction.z, direction.x ) / ( 2.0 * PI ) + 0.5;\n        float latitude = asin( clamp( direction.y, -1.0, 1.0 ) ) / PI + 0.5;\n        float meridians = peanutPeriodicLine(\n            longitude * peanutMeridianCount, surfacePosition\n        );\n        float latitudes = peanutPeriodicLine(\n            latitude * peanutLatitudeIntervals, surfacePosition\n        );\n        // Longitude is undefined exactly at a pole. Suppress only a very small\n        // cap there; a broader fade leaves an obvious hole when viewed down\n        // the grid axis.\n        float awayFromPoles = smoothstep( 0.001, 0.015, 1.0 - abs( direction.y ) );\n        return max( meridians * awayFromPoles, latitudes * awayFromPoles );\n    }\n";
function I(e, t) {
	let n = t.presentation, r = t.uniformShape || null, i = new _.Color(t.gridColor ?? 0), a = t.gridRotation ? new _.Matrix3().set(t.gridRotation[0][0], t.gridRotation[0][1], t.gridRotation[0][2], t.gridRotation[1][0], t.gridRotation[1][1], t.gridRotation[1][2], t.gridRotation[2][0], t.gridRotation[2][1], t.gridRotation[2][2]) : new _.Matrix3(), o = t.gridPoleAxis ?? "structure-y", s = new _.Matrix3();
	return o === "principal-maximum" ? s.set(0, -1, 0, 1, 0, 0, 0, 0, 1) : o === "principal-minimum" && s.set(1, 0, 0, 0, 0, 1, 0, -1, 0), e.defines = { ...e.defines }, r ? e.defines.PEANUT_UNIFORM_SHAPE = 1 : delete e.defines.PEANUT_UNIFORM_SHAPE, o === "structure-y" ? delete e.defines.PEANUT_PRINCIPAL_GRID : e.defines.PEANUT_PRINCIPAL_GRID = 1, e.userData.peanut = {
		presentation: n,
		gridColor: i.clone(),
		silhouetteWidth: t.silhouetteWidth ?? 1.2,
		gridLineWidth: t.gridLineWidth ?? .01,
		meridianCount: t.meridianCount ?? 10,
		latitudeIntervals: t.latitudeIntervals ?? 6,
		gridPoleAxis: o,
		outlinePixelUniform: t.outlinePixelUniform,
		outlineViewport: t.outlineViewport
	}, e.onBeforeCompile = (e) => {
		if (e.uniforms.peanutUniformShape = { value: new _.Vector3(...r || [
			1,
			1,
			1
		]) }, e.uniforms.peanutGridRotation = { value: a }, e.uniforms.peanutGridBasis = { value: s }, e.vertexShader = e.vertexShader.replace("#include <common>", `#include <common>\n${De}`).replace("#include <begin_vertex>", Oe).replace("#include <beginnormal_vertex>", ke), n === "outline") {
			e.uniforms.uPeanutOutlinePx = t.outlinePixelUniform, e.uniforms.uPeanutOutlineViewport = t.outlineViewport, e.vertexShader = e.vertexShader.replace("#include <project_vertex>", "\n                vec3 peanutOutlineNormal = normalize(\n                    2.0 * peanutQ * peanutDirection -\n                    activePeanutShape * peanutDirection\n                );\n                vec4 mvPosition = vec4( transformed, 1.0 );\n                #ifdef USE_INSTANCING\n                    mvPosition = instanceMatrix * mvPosition;\n                    peanutOutlineNormal = mat3( instanceMatrix ) * peanutOutlineNormal;\n                #endif\n                mvPosition = modelViewMatrix * mvPosition;\n                peanutOutlineNormal = normalize(\n                    mat3( modelViewMatrix ) * peanutOutlineNormal\n                );\n                vec4 peanutClipPosition = projectionMatrix * mvPosition;\n                vec3 peanutClipNormal = (\n                    projectionMatrix * vec4( peanutOutlineNormal, 0.0 )\n                ).xyz;\n                vec2 peanutOutlineDirection = length( peanutClipNormal.xy ) > 1e-6\n                    ? normalize( peanutClipNormal.xy ) : vec2( 0.0 );\n                peanutClipPosition.xy += peanutOutlineDirection *\n                    uPeanutOutlinePx * 2.0 * peanutClipPosition.w /\n                    uPeanutOutlineViewport;\n                gl_Position = peanutClipPosition;\n                ");
			return;
		}
		if (n !== "clean-3d" && n !== "depth") {
			e.uniforms.peanutGridColor = { value: i }, e.uniforms.peanutGridLineWidth = { value: t.gridLineWidth ?? .01 }, e.uniforms.peanutMeridianCount = { value: t.meridianCount ?? 10 }, e.uniforms.peanutLatitudeIntervals = { value: t.latitudeIntervals ?? 6 }, e.vertexShader = e.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n                #ifdef PEANUT_PRINCIPAL_GRID\n                    vPeanutGridDirection = normalize( peanutGridBasis * peanutDirection );\n                #else\n                    #ifdef USE_INSTANCING\n                        vPeanutGridDirection = normalize(\n                            mat3( instanceMatrix ) * peanutDirection\n                        );\n                    #else\n                        vPeanutGridDirection = normalize(\n                            peanutGridRotation * peanutDirection\n                        );\n                    #endif\n                #endif\n                #ifdef USE_INSTANCING\n                    vPeanutWorldPosition = (\n                        modelMatrix * instanceMatrix * vec4( transformed, 1.0 )\n                    ).xyz;\n                    vec3 peanutViewNormal = mat3( modelViewMatrix ) * mat3( instanceMatrix ) *\n                        normalize( 2.0 * peanutQ * peanutDirection -\n                            activePeanutShape * peanutDirection );\n                #else\n                    vPeanutWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n                    vec3 peanutViewNormal = mat3( modelViewMatrix ) *\n                        normalize( 2.0 * peanutQ * peanutDirection -\n                            activePeanutShape * peanutDirection );\n                #endif\n                vPeanutViewNormal = normalize( peanutViewNormal );\n                vPeanutViewDirection = normalize( -mvPosition.xyz );"), e.fragmentShader = e.fragmentShader.replace("#include <common>", `#include <common>\n${Ae}`);
			let r = n === "publication-2d" ? "\n                    float peanutGridMask = peanutSurfaceGrid(\n                        vPeanutGridDirection, vPeanutWorldPosition\n                    );\n                    if ( peanutGridMask < 0.01 ) discard;\n                    diffuseColor.rgb = peanutGridColor;\n                " : "\n                    float peanutGridMask = peanutSurfaceGrid(\n                        vPeanutGridDirection, vPeanutWorldPosition\n                    );\n                    diffuseColor.rgb = mix(\n                        diffuseColor.rgb, peanutGridColor, peanutGridMask\n                    );\n                ";
			e.fragmentShader = e.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${r}`);
		}
	}, e.customProgramCacheKey = () => [
		"rmsd-peanut-v1",
		n,
		r ? "uniform" : "instanced"
	].join("-"), e.needsUpdate = !0, e;
}
var je = "\n    vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );\n    vec4 clipPosition = projectionMatrix * mvPosition;\n    vec3 clipNormal = ( projectionMatrix * vec4( normalize( normalMatrix * normal ), 0.0 ) ).xyz;\n    vec2 outlineDir = length( clipNormal.xy ) > 1e-6 ? normalize( clipNormal.xy ) : vec2( 0.0 );\n    clipPosition.xy += outlineDir * uOutlinePx * 2.0 * clipPosition.w / uOutlineViewport;\n    gl_Position = clipPosition;\n";
function Me(e, t, n) {
	e.onBeforeCompile = (e) => {
		e.uniforms.uOutlinePx = t, e.uniforms.uOutlineViewport = n, e.vertexShader = "uniform float uOutlinePx;\nuniform vec2 uOutlineViewport;\n" + e.vertexShader.replace("#include <project_vertex>", je);
	}, e.customProgramCacheKey = () => "screen-space-outline-v1";
}
function Ne(e) {
	e.stencilWrite = !0, e.stencilRef = 0, e.stencilFunc = _.EqualStencilFunc, e.stencilFail = _.KeepStencilOp, e.stencilZFail = _.KeepStencilOp, e.stencilZPass = _.KeepStencilOp;
}
function Pe(e, t) {
	let n = new _.ShaderMaterial({
		uniforms: {
			uOutlinePx: e,
			uOutlineViewport: t
		},
		vertexShader: "\n            uniform float uOutlinePx;\n            uniform vec2 uOutlineViewport;\n            void main() {\n                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\n                vec4 clipPosition = projectionMatrix * mvPosition;\n                vec3 clipNormal = (\n                    projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)\n                ).xyz;\n                vec2 outlineDir = length(clipNormal.xy) > 1e-6\n                    ? normalize(clipNormal.xy) : vec2(0.0);\n                clipPosition.xy += outlineDir * uOutlinePx * 2.0\n                    * clipPosition.w / uOutlineViewport;\n                gl_Position = clipPosition;\n            }\n        ",
		fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
		side: _.BackSide,
		colorWrite: !1,
		depthWrite: !1,
		depthTest: !1,
		stencilWrite: !0,
		stencilRef: 0,
		stencilFunc: _.EqualStencilFunc,
		stencilFail: _.KeepStencilOp,
		stencilZFail: _.KeepStencilOp,
		stencilZPass: _.IncrementWrapStencilOp
	});
	return n.name = "cutaway-ellipsoid-occlusion-mask", n;
}
var Fe = 1, Ie = 2, Le = 3, L = 1e6, Re = [
	new _.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
	new _.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1),
	new _.Matrix4().set(0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
];
function ze(e, t) {
	let n = new _.Color(e.atomColor), r = Math.max(1, t.atomCutawayStripeCount), i = _.MathUtils.clamp(t.atomCutawayStripeWidth, .01, 1) / 2, a = new _.MeshStandardMaterial({
		color: e.ringColor,
		roughness: t.atomColorRoughness,
		metalness: t.atomColorMetalness,
		side: _.DoubleSide
	});
	return a.userData.cutawayStripes = {
		color: n,
		count: r,
		width: i * 2
	}, a.onBeforeCompile = (e) => {
		e.uniforms.cutawayStripeColor = { value: n }, e.uniforms.cutawayStripeCount = { value: r }, e.uniforms.cutawayStripeHalfWidth = { value: i }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vCutawayUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvCutawayUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vCutawayUv;\nuniform vec3 cutawayStripeColor;\nuniform float cutawayStripeCount;\nuniform float cutawayStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat cutawayStripeCoordinate = vCutawayUv.y * cutawayStripeCount;\nfloat cutawayStripePhase = fract(cutawayStripeCoordinate);\nfloat cutawayStripeDistance = abs(cutawayStripePhase - 0.5);\nfloat cutawayStripeEdge = max(fwidth(cutawayStripeCoordinate), 0.001);\nfloat cutawayStripeMask = 1.0 - smoothstep(\n    cutawayStripeHalfWidth - cutawayStripeEdge,\n    cutawayStripeHalfWidth + cutawayStripeEdge,\n    cutawayStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, cutawayStripeColor, cutawayStripeMask\n);");
	}, a.customProgramCacheKey = () => "cutaway-horizontal-stripes-v1", a;
}
function Be(e, t = e.plot2DLineColor) {
	let n = new _.Color(t), r = Math.max(1, e.plot2DStripeCount), i = _.MathUtils.clamp(e.plot2DStripeWidth, .01, 1) / 2, a = new _.MeshBasicMaterial({
		color: e.plot2DAtomColor,
		side: _.DoubleSide
	});
	return a.userData.plot2DHatch = {
		color: n,
		count: r,
		width: i * 2
	}, a.onBeforeCompile = (e) => {
		e.uniforms.plot2DStripeColor = { value: n }, e.uniforms.plot2DStripeCount = { value: r }, e.uniforms.plot2DStripeHalfWidth = { value: i }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vPlot2DUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvPlot2DUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vPlot2DUv;\nuniform vec3 plot2DStripeColor;\nuniform float plot2DStripeCount;\nuniform float plot2DStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat plot2DStripeCoordinate = vPlot2DUv.y * plot2DStripeCount;\nfloat plot2DStripePhase = fract(plot2DStripeCoordinate);\nfloat plot2DStripeDistance = abs(plot2DStripePhase - 0.5);\nfloat plot2DStripeEdge = max(fwidth(plot2DStripeCoordinate), 0.001);\nfloat plot2DStripeMask = 1.0 - smoothstep(\n    plot2DStripeHalfWidth - plot2DStripeEdge,\n    plot2DStripeHalfWidth + plot2DStripeEdge,\n    plot2DStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, plot2DStripeColor, plot2DStripeMask\n);");
	}, a.customProgramCacheKey = () => "2d-plot-curved-octant-hatch-v1", a;
}
function R(e, t) {
	e.scale.set(t[0] / F[0], t[1] / F[1], t[2] / F[2]);
}
function Ve(e, t) {
	let n = e.getAttribute("uv"), r = Math.cos(t), i = Math.sin(t);
	for (let e = 0; e < n.count; e++) {
		let t = n.getX(e) - .5, a = n.getY(e) - .5;
		n.setXY(e, t * r - a * i + .5, t * i + a * r + .5);
	}
	n.needsUpdate = !0;
}
function He(e) {
	let t = {
		position: 0,
		rotation: 0,
		scale: 0,
		matrix: 0
	};
	function n(e) {
		let r = e.position, i = e.rotation, a = e.scale, o = e.matrix.elements;
		if ([
			r.x,
			r.y,
			r.z
		].some(isNaN) && (console.log("pos"), console.log(r), console.log(e.userData), t.position++), [
			i.x,
			i.y,
			i.z
		].some(isNaN) && (t.rotation++, console.log("rot"), console.log(i), console.log(e.userData)), [
			a.x,
			a.y,
			a.z
		].some(isNaN) && (console.log("scale"), console.log(a), console.log(e.userData), t.scale++), o.some(isNaN) && (t.matrix++, console.log("matrix"), console.log(o), console.log(e.userData)), e.isInstancedMesh) {
			let n = new _.Matrix4();
			for (let r = 0; r < e.count; r++) e.getMatrixAt(r, n), n.elements.some(isNaN) && (t.matrix++, console.log("instanceMatrix"), console.log(n.elements), console.log(e.userData));
		}
		for (let t of e.children) n(t);
	}
	return n(e), t;
}
var z = class {
	constructor(e, t, n) {
		this.mesh = new _.InstancedMesh(e, t, n), this.mesh.userData = { selectable: !1 }, this.nextIndex = 0;
	}
	register(e, t = null) {
		let n = this.nextIndex++;
		return this.mesh.setMatrixAt(n, e), t && this.mesh.setColorAt(n, t), n;
	}
	finalize() {
		this.mesh.instanceMatrix.needsUpdate = !0, this.mesh.instanceColor && (this.mesh.instanceColor.needsUpdate = !0), this.mesh.computeBoundingSphere();
	}
	hideInstance(e) {
		this.mesh.setMatrixAt(e, new _.Matrix4().makeScale(0, 0, 0)), this.mesh.instanceMatrix.needsUpdate = !0;
	}
	restoreInstance(e, t) {
		this.mesh.setMatrixAt(e, t), this.mesh.instanceMatrix.needsUpdate = !0;
	}
}, Ue = class {
	constructor(e, t) {
		this.sourcePool = e, this.mesh = new _.InstancedMesh(e.mesh.geometry, t, e.mesh.count), this.mesh.instanceMatrix = e.mesh.instanceMatrix, this.mesh.userData = { selectable: !1 };
	}
	finalize() {
		this.mesh.boundingSphere = this.sourcePool.mesh.boundingSphere, this.mesh.boundingBox = this.sourcePool.mesh.boundingBox;
	}
}, We = class extends z {
	constructor(e, t, n, r = null, i = null) {
		e.boundingSphere || e.computeBoundingSphere();
		let a = new _.InstancedBufferGeometry();
		a.setIndex(e.index);
		for (let [t, n] of Object.entries(e.attributes)) a.setAttribute(t, n);
		if (a.boundingSphere = e.boundingSphere.clone(), a.boundingBox = e.boundingBox?.clone() || null, a.setAttribute("peanutShape", new _.InstancedBufferAttribute(new Float32Array(n * 3), 3)), super(a, t, n), this.baseGeometry = e, this.shapeAttribute = a.getAttribute("peanutShape"), this.meshes = [this.mesh], r) {
			let e = new _.InstancedMesh(a, r, n);
			e.instanceMatrix = this.mesh.instanceMatrix, e.userData = {
				selectable: !1,
				type: "peanut-depth-mask"
			}, e.renderOrder = 0, this.mesh.renderOrder = 1, this.depthMesh = e, this.meshes.unshift(e);
		}
		if (i) {
			let e = new _.InstancedMesh(a, i, n);
			e.instanceMatrix = this.mesh.instanceMatrix, e.userData = {
				selectable: !1,
				type: "peanut-outline"
			}, e.renderOrder = 2, this.outlineMesh = e, this.meshes.push(e);
		}
	}
	registerPeanut(e, t) {
		let n = super.register(e);
		return this.shapeAttribute.setXYZ(n, ...t), n;
	}
	finalize() {
		this.shapeAttribute.needsUpdate = !0, super.finalize(), this.depthMesh && (this.depthMesh.boundingSphere = this.mesh.boundingSphere), this.outlineMesh && (this.outlineMesh.boundingSphere = this.mesh.boundingSphere);
	}
	dispose() {
		this.mesh.geometry.dispose();
	}
};
function Ge(e, t) {
	let n = e.getEllipsoidMatrix(t).toArray();
	return new _.Matrix4(n[0][0], n[0][1], n[0][2], 0, n[1][0], n[1][1], n[1][2], 0, n[2][0], n[2][1], n[2][2], 0, 0, 0, 0, 1);
}
function B(e, t) {
	let n = t.clone().sub(e), r = n.length();
	if (r === 0) throw Error("Error in ORTEP Bond Creation. Trying to create a zero length bond.");
	let i = n.divideScalar(r), a = new _.Vector3(0, 1, 0), o = new _.Vector3().crossVectors(i, a), s = -Math.acos(i.dot(a));
	return new _.Matrix4().makeScale(1, r, 1).premultiply(new _.Matrix4().makeRotationAxis(o.normalize(), s)).setPosition(e.clone().add(t).multiplyScalar(.5));
}
function Ke(e, t, n, r) {
	let i = t.clone().sub(e), a = i.length();
	if (!(a > 0)) return {
		bodies: [],
		caps: []
	};
	i.divideScalar(a);
	let o = [], s = [];
	for (let t of ye(a, n.dashSegmentLength, n.dashFraction)) {
		let n = t.end - t.start, c = (t.start + t.end) / (2 * a);
		if (n <= 2 * r) {
			let a = e.clone().addScaledVector(i, (t.start + t.end) / 2), o = n / (2 * r);
			s.push({
				matrix: new _.Matrix4().makeScale(o, o, o).setPosition(a),
				midpointFraction: c
			});
			continue;
		}
		let l = e.clone().addScaledVector(i, t.start + r), u = e.clone().addScaledVector(i, t.end - r);
		o.push({
			matrix: B(l, u),
			midpointFraction: c
		}), s.push({
			matrix: new _.Matrix4().makeTranslation(...l),
			midpointFraction: c
		}, {
			matrix: new _.Matrix4().makeTranslation(...u),
			midpointFraction: c
		});
	}
	return {
		bodies: o,
		caps: s
	};
}
function qe(e, t, n, r) {
	let i = e.clone(), a = t.clone(), o = a.clone().sub(i), s = o.length();
	if (s === 0 || !n || !r) return [i, a];
	o.divideScalar(s);
	let c = n.getSurfaceDistanceAlong(o), l = r.getSurfaceDistanceAlong(o.clone().negate());
	c = Number.isFinite(c) && c > 0 ? c : 0, l = Number.isFinite(l) && l > 0 ? l : 0;
	let u = c + l;
	if (u >= s) {
		let e = s * (1 - 2 ** -52) / u;
		c *= e, l *= e;
	}
	return i.addScaledVector(o, c), a.addScaledVector(o, -l), [i, a];
}
var Je = class {
	constructor(e = {}) {
		let t = e || {};
		this.options = {
			...j,
			...t,
			elementProperties: {
				...j.elementProperties,
				...t.elementProperties || {}
			}
		}, this.scaling = r(this.options.ellipsoidProbability), this.geometries = {}, this.materials = {}, this.elementMaterials = {}, this.outlineViewport = { value: new _.Vector2(1, 1) }, this.outlinePixels = {
			atom: { value: this.options.plot2DOutlineWidth ?? 0 },
			bond: { value: this.options.plot2DBondOutlineWidth ?? 0 }
		};
		let n = Object.values(this.options.elementProperties).map((e) => e.atomColor).filter(Boolean), i = this.options.plot2DColorLuminanceFloor;
		this.plot2DElementColorScale = i == null ? we(n, this.options.plot2DColorLuminanceCeiling) : 1, this.plot2DElementColorLift = i == null ? 0 : Te(n, i), this.initializeGeometries(), this.initializeMaterials();
	}
	initializeGeometries() {
		if (this.geometries.atom = new _.IcosahedronGeometry(this.scaling, this.options.atomDetail), this.options.adpRepresentation === "rmsd-peanut" && (this.geometries.peanut = new _.IcosahedronGeometry(this.options.peanutScale, this.options.peanutDetail)), this.options.adpRepresentation === "ellipsoid" && this.options.renderStyle !== "solid-3d") {
			let e = Math.max(3, 2 ** this.options.atomDetail + 2);
			this.geometries.atomOctant = new _.SphereGeometry(this.scaling, e, e, 0, Math.PI / 2, 0, Math.PI / 2), this.geometries.emptyAtom = new _.BufferGeometry(), this.geometries.cutawayPlanes = this.createCutawayPlanes(e * 4), this.materials.cutawayDepthCap = new _.MeshBasicMaterial({
				colorWrite: !1,
				depthWrite: !0,
				depthTest: !0
			}), this.options.sealCutoutCavity && (Ne(this.materials.cutawayDepthCap), this.materials.cutawayOcclusion = Pe(this.options.renderStyle === "cutout-2d" ? this.outlinePixels.atom : { value: 0 }, this.outlineViewport));
		}
		this.options.adpRepresentation === "ellipsoid" && (this.geometries.adpRing = this.createADPHalfTorus(), this.geometries.adpRingSet = this.createMergedADPRingSet(this.geometries.adpRing)), this.geometries.bond = new _.CylinderGeometry(this.options.bondRadius, this.options.bondRadius, 1, this.options.bondSections, 1, !0), this.options.collapseMetalRingBonds && (this.geometries.centroidCap = new _.SphereGeometry(this.options.bondRadius, this.options.bondSections, Math.max(6, Math.ceil(this.options.bondSections / 2)))), this.geometries.hbond = new _.CylinderGeometry(this.options.hbondRadius, this.options.hbondRadius, 1, this.options.bondSections, 1, !1);
	}
	initializeMaterials() {
		if (this.options.renderStyle === "cutout-2d") {
			this.materials.bond = new _.MeshBasicMaterial({ color: this.options.plot2DBondColor }), this.materials.openBond = new _.MeshBasicMaterial({ color: this.options.plot2DAtomColor }), this.materials.openBondOutline = new _.MeshBasicMaterial({
				color: this.options.plot2DBondColor,
				side: _.BackSide
			}), this.materials.bondDepthOutline = new _.MeshBasicMaterial({
				color: this.options.plot2DBondOutlineColor,
				side: _.BackSide,
				depthTest: !0,
				depthWrite: !0
			}), Me(this.materials.bondDepthOutline, this.outlinePixels.bond, this.outlineViewport), this.materials.hbond = new _.MeshBasicMaterial({ color: this.options.plot2DLineColor });
			return;
		}
		this.materials.bond = new _.MeshStandardMaterial({
			color: 16777215,
			roughness: this.options.bondColorRoughness,
			metalness: this.options.bondColorMetalness
		}), this.materials.hbond = new _.MeshStandardMaterial({
			color: this.options.hbondColor,
			roughness: this.options.hbondColorRoughness,
			metalness: this.options.hbondColorMetalness
		});
	}
	validateElementType(e) {
		if (!this.options.elementProperties[e]) throw Error(`Unknown element type: ${e}. Please ensure element properties are defined.Pass the type settings as custom options, ifthey are element from periodic table`);
	}
	getAtomMaterials(e, n = !1) {
		let r = e;
		if (this.options.elementProperties[r] || (r = t(e)), this.validateElementType(r), this.options.renderStyle === "cutout-2d") {
			let e = `${r}_2d_materials${n ? "_ellipsoid" : ""}`;
			if (!this.elementMaterials[e]) {
				let t = this.options.elementProperties[r].atomColor, i = N(M(t, this.plot2DElementColorScale), this.plot2DElementColorLift), a = new _.MeshBasicMaterial({
					color: i,
					side: _.BackSide
				});
				Me(a, this.outlinePixels.atom, this.outlineViewport);
				let o = new _.MeshBasicMaterial({ color: this.options.plot2DAtomColor });
				o.userData.plot2DOutlineMaterial = a;
				let s = new _.MeshBasicMaterial({ color: i }), c = Be(this.options, i);
				n && [
					o,
					s,
					c,
					a
				].forEach(Ne), this.elementMaterials[e] = [
					o,
					s,
					c,
					a
				];
			}
			return this.elementMaterials[e];
		}
		let i = `${r}_materials${n ? "_ellipsoid" : ""}`;
		if (!this.elementMaterials[i]) {
			let e = this.options.elementProperties[r], t = new _.MeshStandardMaterial({
				color: e.atomColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			}), a = new _.MeshStandardMaterial({
				color: e.ringColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			});
			this.elementMaterials[i] = [t, a], this.options.renderStyle === "cutout-3d" && this.elementMaterials[i].push(ze(e, this.options)), n && this.elementMaterials[i].forEach(Ne);
		}
		return this.elementMaterials[i];
	}
	getPlot2DElementLineColor(e, n = "atomColor") {
		let r = e;
		this.options.elementProperties[r] || (r = t(e)), this.validateElementType(r);
		let i = this.options.elementProperties[r][n];
		return N(M(i, this.plot2DElementColorScale), this.plot2DElementColorLift);
	}
	getPeanutMaterials(e, n = !1) {
		let r = e;
		this.options.elementProperties[r] || (r = t(e)), this.validateElementType(r);
		let i = Ee(this.options.renderStyle), a = `${r}_peanut_${n ? "negative" : "positive"}_${i}_${this.options.peanutMeridianCount}_${this.options.peanutLatitudeIntervals}_${this.options.peanutGridPoleAxis}_${this.options.peanutGridLineWidth}`;
		if (!this.elementMaterials[a]) {
			let e = this.options.elementProperties[r], t, o = null, s = null;
			if (i === "publication-2d") {
				let e = this.getPlot2DElementLineColor(r, n ? "ringColor" : "atomColor");
				t = I(new _.MeshBasicMaterial({
					color: e,
					depthWrite: !1,
					depthTest: !0,
					depthFunc: _.LessEqualDepth,
					side: _.DoubleSide
				}), {
					presentation: i,
					gridColor: e,
					meridianCount: this.options.peanutMeridianCount,
					latitudeIntervals: this.options.peanutLatitudeIntervals,
					gridPoleAxis: this.options.peanutGridPoleAxis,
					gridLineWidth: this.options.peanutGridLineWidth
				}), o = I(new _.MeshBasicMaterial({
					colorWrite: !1,
					depthWrite: !0,
					depthTest: !0,
					side: _.DoubleSide
				}), { presentation: "depth" }), s = I(new _.MeshBasicMaterial({
					color: e,
					side: _.BackSide,
					depthWrite: !0,
					depthTest: !0
				}), {
					presentation: "outline",
					outlinePixelUniform: this.outlinePixels.atom,
					outlineViewport: this.outlineViewport
				}), t.userData.peanutDepthMaterial = o, t.userData.peanutOutlineMaterial = s;
			} else t = I(new _.MeshStandardMaterial({
				color: n ? e.ringColor : e.atomColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			}), {
				presentation: i,
				gridColor: n ? e.atomColor : e.ringColor,
				meridianCount: this.options.peanutMeridianCount,
				latitudeIntervals: this.options.peanutLatitudeIntervals,
				gridPoleAxis: this.options.peanutGridPoleAxis,
				gridLineWidth: this.options.peanutGridLineWidth
			});
			this.elementMaterials[a] = [
				t,
				o,
				s
			].filter(Boolean);
		}
		let [o, s = null, c = null] = this.elementMaterials[a];
		return {
			body: o,
			depth: s,
			outline: c,
			presentation: i
		};
	}
	createADPHalfTorus() {
		let e = new _.TorusGeometry(this.scaling * this.options.atomADPRingWidthFactor, this.options.atomADPRingHeight, this.options.atomADPInnerSections, this.options.atomADPRingSections), t = e.attributes.position.array, n = e.index.array, r = [], i = [], a = /* @__PURE__ */ new Set();
		for (let e = 0; e < n.length; e += 3) {
			let r = [
				n[e] * 3,
				n[e + 1] * 3,
				n[e + 2] * 3
			].map((e) => ({
				index: e / 3,
				distance: Math.sqrt(t[e] * t[e] + t[e + 1] * t[e + 1] + t[e + 2] * t[e + 2])
			}));
			r.some((e) => e.distance >= this.scaling) && r.forEach((t) => a.add(n[e + t.index % 3]));
		}
		let o = /* @__PURE__ */ new Map(), s = 0;
		a.forEach((e) => {
			let n = e * 3;
			r.push(t[n], t[n + 1], t[n + 2]), o.set(e, s++);
		});
		for (let e = 0; e < n.length; e += 3) a.has(n[e]) && a.has(n[e + 1]) && a.has(n[e + 2]) && i.push(o.get(n[e]), o.get(n[e + 1]), o.get(n[e + 2]));
		let c = new _.BufferGeometry();
		return c.setAttribute("position", new _.Float32BufferAttribute(r, 3)), c.setIndex(i), c.computeVertexNormals(), c.rotateX(.5 * Math.PI), e.dispose(), c;
	}
	createCutawayPlanes(e) {
		let t = new _.CircleGeometry(this.scaling, e), n = new _.CircleGeometry(this.scaling, e), r = new _.CircleGeometry(this.scaling, e);
		Ve(n, Math.PI / 2), Ve(r, Math.PI / 2), n.rotateX(Math.PI / 2), r.rotateY(Math.PI / 2);
		let i = ce([
			t,
			n,
			r
		]);
		return t.dispose(), n.dispose(), r.dispose(), i;
	}
	createMergedADPRingSet(e) {
		let t = Re.map((t) => {
			let n = e.clone();
			return n.applyMatrix4(t), n;
		}), n = ce(t);
		return t.forEach((e) => e.dispose()), n;
	}
	setOutlineViewport(e, t) {
		this.outlineViewport.value.set(Math.max(1, e), Math.max(1, t));
	}
	dispose() {
		Object.values(this.geometries).forEach((e) => e.dispose()), Object.values(this.materials).forEach((e) => e.dispose()), Object.values(this.elementMaterials).forEach((e) => {
			e.forEach((e) => e.dispose());
		});
	}
}, Ye = class {
	constructor(e, t = {}) {
		let n = performance.now(), r = t || {}, i = { ...j.elementProperties };
		if (r.elementProperties && Object.entries(r.elementProperties).forEach(([e, t]) => {
			i[e] = {
				...i[e],
				...t
			};
		}), this.options = {
			...j,
			...r,
			metalRingCentroidOptions: {
				...j.metalRingCentroidOptions,
				...r.metalRingCentroidOptions || {}
			},
			elementProperties: i
		}, typeof this.options.collapseMetalRingBonds != "boolean") throw TypeError("collapseMetalRingBonds must be boolean");
		if (typeof this.options.bondDisorderColorsEnabled != "boolean") throw TypeError("bondDisorderColorsEnabled must be boolean");
		ue(this.options.metalRingCentroidOptions), this.crystalStructure = e;
		let a = performance.now();
		this.cache = new Je(this.options);
		let o = performance.now() - a;
		this.createStructure(), this.timings.optionsSetupTimeMs = a - n, this.timings.cacheSetupTimeMs = o, this.timings.constructorTimeMs = performance.now() - n;
	}
	createStructure() {
		let e = performance.now();
		this.atoms3D = [], this.bonds3D = [], this.hBonds3D = [], this.centroidInteractions = [];
		let t = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map();
		for (let e of this.crystalStructure.atoms) {
			let n = e.uniqueId;
			t.add(n), r.has(n) || r.set(n, e);
		}
		let i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = (e) => {
			let t = i.get(e);
			if (!t) {
				let n = r.get(e).position.toCartesian(this.crystalStructure.cell);
				t = new _.Vector3(n.x, n.y, n.z), i.set(e, t);
			}
			return t;
		}, c = this.options.adpRepresentation === "ellipsoid" && this.options.renderStyle !== "solid-3d", l = performance.now();
		if (c) for (let e of this.crystalStructure.atoms) {
			let t = e.adp instanceof n, [r, i, s] = this.cache.getAtomMaterials(e.atomType, t), c;
			c = e.adp instanceof n ? new Qe(e, this.crystalStructure.cell, this.cache.geometries.atom, r, this.cache.geometries.adpRingSet, i, {
				octantGeometry: this.cache.geometries.atomOctant,
				emptyGeometry: this.cache.geometries.emptyAtom,
				planeGeometry: this.cache.geometries.cutawayPlanes,
				planeMaterial: s,
				depthCapMaterial: this.options.sealCutoutCavity ? this.cache.materials.cutawayDepthCap : null,
				occlusionGeometry: this.cache.geometries.atom,
				occlusionMaterial: this.cache.materials.cutawayOcclusion ?? null,
				hysteresis: this.options.atomCutawayHysteresis
			}) : e.adp instanceof a ? new $e(e, this.crystalStructure.cell, this.cache.geometries.atom, r) : new et(e, this.crystalStructure.cell, this.cache.geometries.atom, r, this.options), this.atoms3D.push(c), o.has(e.uniqueId) || o.set(e.uniqueId, c);
		}
		else {
			this.cache.geometries.atom.boundingSphere || this.cache.geometries.atom.computeBoundingSphere();
			let e = this.cache.geometries.atom.boundingSphere.radius;
			this.cache.geometries.peanut && !this.cache.geometries.peanut.boundingSphere && this.cache.geometries.peanut.computeBoundingSphere();
			let t = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), s = [];
			for (let e of this.crystalStructure.atoms) {
				if (e.adp instanceof n && this.options.adpRepresentation === "rmsd-peanut") {
					let n = tt(e, this.crystalStructure.cell, this.options.peanutScale);
					if (n.valid) {
						let r = n.surface.components.map((n) => {
							let r = this.cache.getPeanutMaterials(e.atomType, n.sign === "negative");
							return t.set(r.body, (t.get(r.body) || 0) + 1), i.set(r.body, r), {
								...n,
								materials: r
							};
						});
						s.push({
							atom: e,
							kind: "peanut",
							...n,
							components: r,
							presentation: r[0].materials.presentation
						});
					} else {
						let [t, n] = this.cache.getAtomMaterials(e.atomType);
						s.push({
							atom: e,
							kind: "ani-fallback",
							atomMaterial: t,
							ringMaterial: n
						});
					}
					continue;
				}
				let [o, c] = this.cache.getAtomMaterials(e.atomType);
				if (e.adp instanceof n) {
					let { matrix: n, valid: i } = nt(e, this.crystalStructure.cell);
					i ? (t.set(o, (t.get(o) || 0) + 1), r.set(c, (r.get(c) || 0) + 1), s.push({
						atom: e,
						kind: "ani",
						matrix: n,
						atomMaterial: o,
						ringMaterial: c
					})) : s.push({
						atom: e,
						kind: "ani-fallback",
						atomMaterial: o,
						ringMaterial: c
					});
				} else if (e.adp instanceof a) {
					if (this.options.renderStyle !== "solid-3d") {
						s.push({
							atom: e,
							kind: "iso-individual",
							atomMaterial: o
						});
						continue;
					}
					let { matrix: n, valid: r } = rt(e, this.crystalStructure.cell);
					r ? (t.set(o, (t.get(o) || 0) + 1), s.push({
						atom: e,
						kind: "iso",
						matrix: n,
						atomMaterial: o
					})) : s.push({
						atom: e,
						kind: "iso-fallback",
						atomMaterial: o
					});
				} else {
					if (this.options.renderStyle !== "solid-3d") {
						s.push({
							atom: e,
							kind: "constant-individual",
							atomMaterial: o
						});
						continue;
					}
					let n = it(e, this.crystalStructure.cell, this.options);
					t.set(o, (t.get(o) || 0) + 1), s.push({
						atom: e,
						kind: "constant",
						matrix: n,
						atomMaterial: o
					});
				}
			}
			let c = /* @__PURE__ */ new Map();
			for (let [e, n] of t) {
				let t = i.get(e);
				c.set(e, t ? new We(this.cache.geometries.peanut, e, n, t.depth, t.outline) : new z(this.cache.geometries.atom, e, n));
			}
			let l = /* @__PURE__ */ new Map();
			for (let [e, t] of r) l.set(e, new z(this.cache.geometries.adpRingSet, e, t));
			for (let t of s) {
				let n;
				n = t.kind === "ani" ? new st(t.atom, c.get(t.atomMaterial), t.matrix, e, l.get(t.ringMaterial)) : t.kind === "peanut" ? new ct(t.atom, t.components.map((e) => ({
					...e,
					pool: c.get(e.materials.body)
				})), t.matrix, t.surface, t.presentation) : t.kind === "iso" || t.kind === "constant" ? new ot(t.atom, c.get(t.atomMaterial), t.matrix, e) : t.kind === "ani-fallback" ? new Qe(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial, this.cache.geometries.adpRingSet, t.ringMaterial, null) : t.kind === "iso-individual" ? new $e(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial) : t.kind === "constant-individual" ? new et(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial, this.options) : new $e(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial), this.atoms3D.push(n), o.has(t.atom.uniqueId) || o.set(t.atom.uniqueId, n);
			}
			c.forEach((e) => e.finalize()), l.forEach((e) => e.finalize()), this.atomPools = c, this.ringPools = l;
		}
		let u = performance.now() - l, d = performance.now(), f = this.options.renderStyle !== "solid-3d" || this.options.adpRepresentation === "rmsd-peanut", p = (e) => o.get(e), m = f ? p : null, h = this.crystalStructure.bonds.filter((e) => {
			let n = t.has(e.atom1Id), r = t.has(e.atom2Id);
			return n && r;
		});
		if (this.options.collapseMetalRingBonds) {
			let e = ve(this.crystalStructure, h, this.options.metalRingCentroidOptions);
			this.centroidInteractions = e.interactions, h = h.filter((t) => !e.suppressedBonds.has(t));
		}
		let g = new Set([...r.values()].map((e) => Number(e.disorderGroup) || 0)), v = g.has(1) && [...g].some((e) => e > 1), y = v && this.options.bondDisorderColorsEnabled, b = [];
		for (let e of this.centroidInteractions) {
			let t = s(e.centreAtom.uniqueId).clone(), n = new _.Vector3(...e.centroid), r = n.clone().sub(t), i = o.get(e.centreAtom.uniqueId);
			if (i && r.lengthSq() > 0) {
				let e = r.clone().normalize(), n = i.getSurfaceDistanceAlong(e);
				Number.isFinite(n) && n > 0 && n < r.length() && t.addScaledVector(e, n);
			}
			let a = Ke(t, n, this.options.metalRingCentroidOptions, this.options.bondRadius), c = e.ringAtoms.reduce((e, t) => e.add(this.cache.getAtomMaterials(t.atomType)[0].color), new _.Color(0, 0, 0)).multiplyScalar(1 / e.ringAtoms.length), l = this.cache.getAtomMaterials(e.centreAtom.atomType)[0].color, u = new _.Color(this.options.bondColor);
			b.push({
				interaction: e,
				transforms: a,
				colourFor: (e) => this.options.bondColorMode === "split" && this.options.renderStyle !== "cutout-2d" ? e.midpointFraction <= .5 ? l : c : u
			});
		}
		let x = b.reduce((e, t) => e + t.transforms.bodies.length, 0), S = b.reduce((e, t) => e + t.transforms.caps.length, 0);
		if (this.options.renderStyle === "cutout-2d") for (let e of h) try {
			let t = r.get(e.atom1Id), n = r.get(e.atom2Id), i = Math.max(Number(t?.disorderGroup) || 0, Number(n?.disorderGroup) || 0), a = v && i > 1;
			this.bonds3D.push(new lt(e, this.crystalStructure, this.cache.geometries.bond, a ? this.cache.materials.openBond : this.cache.materials.bond, s, m, a ? {
				outlineMaterial: this.cache.materials.openBondOutline,
				innerScale: this.options.plot2DOpenBondInnerScale
			} : null, {
				material: this.cache.materials.bondDepthOutline,
				width: this.options.plot2DBondOutlineWidth,
				endpointInset: this.options.bondRadius
			}));
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		else {
			let e = [], t = this.options.bondColorMode === "split" ? /* @__PURE__ */ new Map() : null, n = new _.Color(this.options.bondColor), i = new _.Color(this.options.bondColorPart1), a = new _.Color(this.options.bondColorPart2Plus);
			if (t) for (let [e, n] of r) t.set(e, this.cache.getAtomMaterials(n.atomType)[0].color);
			for (let o of h) try {
				let c = ut.computeMatrix(o, this.crystalStructure, s, m), l = Math.max(Number(r.get(o.atom1Id)?.disorderGroup) || 0, Number(r.get(o.atom2Id)?.disorderGroup) || 0), u = t ? [t.get(o.atom1Id), t.get(o.atom2Id)] : y && l > 1 ? a : y && l === 1 ? i : n;
				e.push([
					o,
					c,
					u
				]);
			} catch (e) {
				if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
			}
			let o = e.reduce((e, [, , t]) => e + (Array.isArray(t) ? 2 : 1), 0) + x;
			this.bondPool = o > 0 ? new z(this.cache.geometries.bond, this.cache.materials.bond, o) : null;
			for (let [t, n, r] of e) this.bonds3D.push(new ut(t, this.bondPool, n, r));
			for (let e of b) e.transforms.bodies.forEach((t) => this.bondPool.register(t.matrix, e.colourFor(t)));
			this.centroidBodyPool = x ? this.bondPool : null, this.centroidBodiesShareBondPool = x > 0, this.bondPool?.finalize();
		}
		if (this.options.renderStyle === "cutout-2d" && x) {
			this.centroidBodyPool = new z(this.cache.geometries.bond, this.cache.materials.bond, x);
			for (let e of b) e.transforms.bodies.forEach((e) => this.centroidBodyPool.register(e.matrix));
		}
		this.centroidCapPool = S ? new z(this.cache.geometries.centroidCap, this.cache.materials.bond, S) : null;
		for (let e of b) e.transforms.caps.forEach((t) => this.centroidCapPool.register(t.matrix, e.colourFor(t)));
		let C = this.options.renderStyle === "cutout-2d" && this.options.plot2DBondOutlineWidth > 0 ? this.cache.materials.bondDepthOutline : null;
		this.centroidOutlineBodyPool = C && this.centroidBodyPool ? new Ue(this.centroidBodyPool, C) : null, this.centroidOutlineCapPool = C && this.centroidCapPool ? new Ue(this.centroidCapPool, C) : null;
		for (let e of [
			this.centroidBodyPool,
			this.centroidCapPool,
			this.centroidOutlineBodyPool,
			this.centroidOutlineCapPool
		]) !e || e === this.bondPool || (e.mesh.userData = {
			selectable: !1,
			type: "ring-centroid-interactions",
			interactions: this.centroidInteractions
		}, e.finalize?.());
		let w = performance.now() - d, ee = performance.now(), te = this.crystalStructure.hBonds.filter((e) => t.has(e.donorAtomId) && t.has(e.acceptorAtomId) && (!e.hydrogenAtomId || t.has(e.hydrogenAtomId))), ne = [], T = 0;
		for (let e of te) try {
			let t = dt.computeSegmentMatrices(e, this.crystalStructure, this.options.hbondDashSegmentLength, this.options.hbondDashFraction, s, p);
			ne.push([e, t]), T += t.length;
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		this.hbondPool = T > 0 ? new z(this.cache.geometries.hbond, this.cache.materials.hbond, T) : null;
		for (let [e, t] of ne) this.hBonds3D.push(new dt(e, this.hbondPool, t));
		this.hbondPool?.finalize(), this.timings = {
			structurePreparationTimeMs: l - e,
			atomCreationTimeMs: u,
			bondCreationTimeMs: w,
			hydrogenBondCreationTimeMs: performance.now() - ee,
			structureCreationTimeMs: performance.now() - e,
			groupAssemblyTimeMs: 0
		};
	}
	getGroup() {
		let e = performance.now(), t = new _.Group();
		if (this.atomPools) for (let e of this.atomPools.values()) for (let n of e.meshes || [e.mesh]) t.add(n);
		if (this.ringPools) for (let e of this.ringPools.values()) t.add(e.mesh);
		for (let e of this.atoms3D) t.add(e);
		let n = (e) => e.traverse((e) => {
			e.renderOrder = L;
		});
		this.bondPool && (this.bondPool.mesh.renderOrder = L, t.add(this.bondPool.mesh));
		for (let e of this.bonds3D) n(e), t.add(e);
		for (let e of [
			this.centroidBodyPool,
			this.centroidCapPool,
			this.centroidOutlineBodyPool,
			this.centroidOutlineCapPool
		]) !e || e === this.bondPool || (e.mesh.renderOrder = L, t.add(e.mesh));
		this.hbondPool && (this.hbondPool.mesh.renderOrder = L, t.add(this.hbondPool.mesh));
		for (let e of this.hBonds3D) n(e), t.add(e);
		return He(t), t.cutawayAtoms = this.atoms3D.filter((e) => e.isCutaway), t.cameraFacingAtoms = t.cutawayAtoms, t.orderableAtoms = this.atoms3D, t.setOutlineViewport = (e, t) => this.cache.setOutlineViewport(e, t), t.atomLabelAnchors = this.atoms3D.map((e) => {
			let t;
			e.segments?.[0]?.matrix ? t = e.segments[0].matrix.clone() : (e.updateMatrix(), t = e.matrix.clone());
			let n = new _.Vector3().setFromMatrixPosition(t), r = new _.Vector3();
			t.decompose(new _.Vector3(), new _.Quaternion(), r);
			let i = e.surfaceDescriptor?.boundingRadius || (e.surfaceRadius || .25) * Math.max(r.x, r.y, r.z);
			return {
				atom: e.userData.atomData,
				position: n,
				radius: i
			};
		}), this.timings.groupAssemblyTimeMs += performance.now() - e, t;
	}
	dispose() {
		if (this.atomPools) for (let e of this.atomPools.values()) e.dispose?.();
		this.cache.dispose();
	}
}, Xe = class e extends _.Mesh {
	constructor(t, n) {
		if (new.target === e) throw TypeError("ORTEPObject is an abstract class and cannot be instantiated directly.");
		super(t, n), this._selectionColor = null, this.marker = null;
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(e) {
		return new _.MeshBasicMaterial({
			color: e,
			transparent: !0,
			opacity: .9,
			side: _.BackSide
		});
	}
	select(e, t) {
		this._selectionColor = e;
		let n = this.material.clone();
		n.emissive?.setHex(t.selection.highlightEmissive), this.originalMaterial = this.material, this.material = n;
		let r = this.createSelectionMarker(e, t);
		this.add(r), this.marker = r;
	}
	deselect() {
		this._selectionColor = null, this.removeSelectionMarker();
	}
	createSelectionMarker(e, t) {
		throw Error("createSelectionMarker needs to be implemented in a subclass");
	}
	removeSelectionMarker() {
		this.marker &&= (this.remove(this.marker), this.marker.geometry?.dispose(), this.marker.material?.dispose(), null), this.originalMaterial &&= (this.material.dispose(), this.material = this.originalMaterial, null);
	}
	dispose() {
		this.deselect(), this.geometry?.dispose(), this.material?.dispose();
	}
}, Ze = class extends Xe {
	constructor(e, t, n, r) {
		super(n, r), this.updateSurfaceRadius();
		let i = r.userData.plot2DOutlineMaterial;
		if (i) {
			let e = new _.Mesh(n, i);
			e.userData = {
				selectable: !1,
				type: "2d-atom-outline"
			}, this.add(e), this.plot2DOutline = e;
		}
		let a = new _.Vector3(...e.position.toCartesian(t));
		this.position.copy(a), this.userData = {
			type: "atom",
			atomData: e,
			selectable: !0
		};
	}
	updateSurfaceRadius() {
		this.geometry.boundingSphere || this.geometry.computeBoundingSphere(), this.surfaceRadius = this.geometry.boundingSphere?.radius || 0;
	}
	getSurfaceDistanceAlong(e) {
		if (this.isSolidFallback || e.lengthSq() === 0 || this.surfaceRadius === 0) return 0;
		this.updateMatrix();
		let t = this.matrix.clone().setPosition(0, 0, 0).invert(), n = e.clone().normalize().applyMatrix4(t).length();
		return Number.isFinite(n) && n > 0 ? this.surfaceRadius / n : 0;
	}
	createSelectionMarker(e, t) {
		let n = new _.Mesh(this.geometry, this.createSelectionMaterial(e));
		return n.scale.multiplyScalar(t.selection.markerMult), n.userData.selectable = !1, n;
	}
}, Qe = class extends Ze {
	constructor(e, t, n, r, i, a, o = null) {
		if (super(e, t, n, r), [
			e.adp.u11,
			e.adp.u22,
			e.adp.u33
		].some((e) => e <= 0)) this.isSolidFallback = !0, this.geometry = new _.TetrahedronGeometry(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
		else {
			let n = Ge(e.adp, t);
			if (n.toArray().includes(NaN)) this.isSolidFallback = !0, this.geometry = new _.TetrahedronGeometry(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
			else {
				o && this.setupCutaway(o, r);
				let e = new _.Mesh(i, a);
				e.userData.selectable = !1, this.add(e), this.ringMesh = e, this.applyMatrix4(n);
			}
		}
		let s = new _.Vector3(...e.position.toCartesian(t));
		this.position.copy(s), this.userData = {
			type: "atom",
			atomData: e,
			selectable: !0
		};
	}
	setupCutaway(e, t) {
		if (this.geometry = e.emptyGeometry, this.isCutaway = !0, this.cutawayHysteresis = e.hysteresis, this.cutawaySigns = [
			1,
			1,
			1
		], this.cutawayViewDirection = new _.Vector3(), this.cutawayWorldPosition = new _.Vector3(), this.cutawayInverseRotation = new _.Matrix4(), this.cutawayOctants = P.map((n, r) => {
			let i = new _.Mesh(e.octantGeometry, t);
			return R(i, n), i.userData = {
				selectable: !1,
				type: "ellipsoid-octant",
				octantIndex: r
			}, this.add(i), i;
		}), this.plot2DOutline) {
			this.remove(this.plot2DOutline);
			let n = t.userData.plot2DOutlineMaterial;
			this.cutawayOutlines = P.map((t, r) => {
				let i = new _.Mesh(e.octantGeometry, n);
				return R(i, t), i.userData = {
					selectable: !1,
					type: "2d-ellipsoid-outline",
					octantIndex: r
				}, this.add(i), i;
			}), this.plot2DOutline = null;
		}
		let n = new _.Mesh(e.planeGeometry, e.planeMaterial);
		if (n.userData = {
			selectable: !1,
			type: "ellipsoid-cutaway-planes"
		}, n.renderOrder = Fe, this.add(n), this.cutawayPlanes = n, e.depthCapMaterial) {
			let t = new _.Mesh(e.octantGeometry, e.depthCapMaterial);
			t.renderOrder = Ie, t.userData = {
				selectable: !1,
				type: "ellipsoid-cutaway-depth-cap"
			}, this.add(t), this.cutawayDepthCap = t;
		}
		if (e.occlusionMaterial) {
			let t = new _.Mesh(e.occlusionGeometry, e.occlusionMaterial);
			t.renderOrder = Le, t.userData = {
				selectable: !1,
				type: "ellipsoid-publication-occlusion-mask"
			}, this.add(t), this.cutawayOcclusionMask = t;
		}
		this.setMissingOctant(7);
	}
	getCameraFacingOctant(e) {
		let t = this.cutawayViewDirection;
		return e.isPerspectiveCamera ? (e.getWorldPosition(t), this.getWorldPosition(this.cutawayWorldPosition), t.sub(this.cutawayWorldPosition)) : e.getWorldDirection(t).negate(), this.cutawayInverseRotation.extractRotation(this.matrixWorld).invert(), t.transformDirection(this.cutawayInverseRotation), [
			t.x,
			t.y,
			t.z
		].forEach((e, t) => {
			Math.abs(e) > this.cutawayHysteresis && (this.cutawaySigns[t] = e < 0 ? -1 : 1);
		}), (this.cutawaySigns[0] > 0 ? 4 : 0) + (this.cutawaySigns[1] > 0 ? 2 : 0) + +(this.cutawaySigns[2] > 0);
	}
	updateCutawayOctant(e) {
		this.isCutaway && this.setMissingOctant(this.getCameraFacingOctant(e));
	}
	setMissingOctant(e) {
		e !== this.missingOctantIndex && (this.missingOctantIndex = e, this.cutawayOctants.forEach((t, n) => {
			t.visible = n !== e;
		}), this.cutawayDepthCap && R(this.cutawayDepthCap, P[e]), this.cutawayOutlines?.forEach((t, n) => {
			t.visible = n !== e;
		}), this.marker?.cutawayOctants?.forEach((t, n) => {
			t.visible = n !== e;
		}));
	}
	createSelectionMarker(e, t) {
		if (!this.isCutaway) return super.createSelectionMarker(e, t);
		let n = new _.Group(), r = this.createSelectionMaterial(e);
		return n.cutawayOctants = P.map((e, t) => {
			let i = new _.Mesh(this.cutawayOctants[0].geometry, r);
			return R(i, e), i.visible = t !== this.missingOctantIndex, i.userData.selectable = !1, n.add(i), i;
		}), n.material = r, n.scale.multiplyScalar(t.selection.markerMult), n.userData.selectable = !1, n;
	}
	select(e, t) {
		super.select(e, t), this.cutawayOctants?.forEach((e) => {
			e.material = this.material;
		});
	}
	deselect() {
		super.deselect(), this.cutawayOctants?.forEach((e) => {
			e.material = this.material;
		});
	}
	raycast(e, t) {
		if (!this.isCutaway) return super.raycast(e, t);
		let n = [];
		return [...this.cutawayOctants.filter((e) => e.visible), this.cutawayPlanes].forEach((t) => {
			_.Mesh.prototype.raycast.call(t, e, n);
		}), n.forEach((e) => {
			t.push({
				...e,
				object: this
			});
		}), !1;
	}
	get adpRingMatrices() {
		return Re.map((e) => e.clone());
	}
}, $e = class extends Ze {
	constructor(e, t, n, r) {
		if (super(e, t, n, r), !e.adp || !("uiso" in e.adp)) throw Error("Atom must have isotropic displacement parameters (UIsoADP)");
		e.adp.uiso <= 0 ? (this.isSolidFallback = !0, this.geometry = new _.TetrahedronGeometry(1), this.updateSurfaceRadius()) : this.scale.multiplyScalar(Math.sqrt(e.adp.uiso));
	}
}, et = class extends Ze {
	constructor(e, n, r, i, a) {
		super(e, n, r, i);
		let o = e.atomType;
		try {
			a.elementProperties[o] || (o = t(e.atomType));
		} catch {
			throw Error(`Element properties not found for atom type: '${e.atomType}'`);
		}
		this.scale.multiplyScalar(a.atomConstantRadiusMultiplier * a.elementProperties[o].radius);
	}
};
function tt(e, t, n) {
	let r = i(e.adp, t, n);
	if (!r.valid) return {
		matrix: null,
		surface: r,
		valid: !1
	};
	let a = r.rotation, o = new _.Matrix4().set(a[0][0], a[0][1], a[0][2], 0, a[1][0], a[1][1], a[1][2], 0, a[2][0], a[2][1], a[2][2], 0, 0, 0, 0, 1).scale(new _.Vector3(r.maxScale, r.maxScale, r.maxScale));
	return o.setPosition(new _.Vector3(...e.position.toCartesian(t))), {
		matrix: o,
		surface: r,
		valid: !0
	};
}
function nt(e, t) {
	if ([
		e.adp.u11,
		e.adp.u3,
		e.adp.u33
	].some((e) => e <= 0)) return {
		matrix: null,
		valid: !1
	};
	let n = Ge(e.adp, t);
	if (n.toArray().includes(NaN)) return {
		matrix: null,
		valid: !1
	};
	let r = new _.Vector3(...e.position.toCartesian(t));
	return {
		matrix: n.setPosition(r),
		valid: !0
	};
}
function rt(e, t) {
	if (e.adp.uiso <= 0) return {
		matrix: null,
		valid: !1
	};
	let n = Math.sqrt(e.adp.uiso), r = new _.Vector3(...e.position.toCartesian(t));
	return {
		matrix: new _.Matrix4().makeScale(n, n, n).setPosition(r),
		valid: !0
	};
}
function it(e, n, r) {
	let i = e.atomType;
	try {
		r.elementProperties[i] || (i = t(e.atomType));
	} catch {
		throw Error(`Element properties not found for atom type: '${e.atomType}'`);
	}
	let a = r.atomConstantRadiusMultiplier * r.elementProperties[i].radius, o = new _.Vector3(...e.position.toCartesian(n));
	return new _.Matrix4().makeScale(a, a, a).setPosition(o);
}
var at = class e extends _.Object3D {
	constructor() {
		if (new.target === e) throw TypeError("PooledSelectableObject is an abstract class and cannot be instantiated directly.");
		super(), this._selectionColor = null, this.marker = null, this.matrixAutoUpdate = !1, this.segments = [];
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(e) {
		return new _.MeshBasicMaterial({
			color: e,
			transparent: !0,
			opacity: .9,
			side: _.BackSide
		});
	}
	raycast(e, t) {
		let n = [], r = new _.Mesh();
		r.matrixAutoUpdate = !1;
		for (let t of this.segments) r.geometry = t.pool.mesh.geometry, r.material = t.pool.mesh.material, r.matrixWorld.multiplyMatrices(this.matrixWorld, t.matrix), r.raycast(e, n);
		n.length > 0 && (n.sort((e, t) => e.distance - t.distance), t.push({
			...n[0],
			object: this
		}));
	}
	select(e, t) {
		this._selectionColor = e, this.highlightMeshes = this.segments.map((e) => {
			let n = e.pool.mesh.material.clone();
			e.color && n.color && n.color.copy(e.color), n.emissive?.setHex(t.selection.highlightEmissive), e.pool.hideInstance(e.index);
			let r = new _.Mesh(e.pool.mesh.geometry, n);
			return r.applyMatrix4(e.matrix), r.userData = {
				...this.userData,
				selectable: !1
			}, this.add(r), r;
		});
		let n = this.createSelectionMarker(e, t);
		this.add(n), this.marker = n;
	}
	deselect() {
		this._selectionColor = null, this.segments.forEach((e) => e.pool.restoreInstance(e.index, e.matrix)), this.highlightMeshes &&= (this.highlightMeshes.forEach((e) => {
			this.remove(e), e.material.dispose();
		}), null), this.marker &&= (this.remove(this.marker), this.marker.traverse((e) => {
			e instanceof _.Mesh && e.material?.dispose();
		}), null);
	}
	createSelectionMarker(e, t) {
		throw Error("createSelectionMarker needs to be implemented in a subclass");
	}
	dispose() {
		this.marker && this.deselect();
	}
}, ot = class extends at {
	constructor(e, t, n, r) {
		super(), this.userData = {
			type: "atom",
			atomData: e,
			selectable: !0
		}, this.segments = [{
			pool: t,
			matrix: n,
			index: t.register(n)
		}], this.surfaceRadius = r;
	}
	getSurfaceDistanceAlong(e) {
		if (e.lengthSq() === 0 || this.surfaceRadius === 0) return 0;
		let t = this.segments[0].matrix.clone().setPosition(0, 0, 0).invert(), n = e.clone().normalize().applyMatrix4(t).length();
		return Number.isFinite(n) && n > 0 ? this.surfaceRadius / n : 0;
	}
	createSelectionMarker(e, t) {
		let n = this.segments[0], r = new _.Mesh(n.pool.mesh.geometry, this.createSelectionMaterial(e));
		return r.applyMatrix4(n.matrix), r.scale.multiplyScalar(t.selection.markerMult), r.userData.selectable = !1, r;
	}
}, st = class extends ot {
	constructor(e, t, n, r, i) {
		super(e, t, n, r), i && (this.ringPool = i, this.ringIndex = i.register(n));
	}
}, ct = class extends ot {
	constructor(e, t, n, r, i) {
		let a = t[0];
		super(e, a.pool, n, a.pool.mesh.geometry.boundingSphere?.radius || 0), this.segments[0].sign = a.sign, this.segments[0].normalizedShape = a.normalizedShape, a.pool.shapeAttribute.setXYZ(this.segments[0].index, ...a.normalizedShape);
		for (let e of t.slice(1)) {
			let t = e.pool.register(n);
			e.pool.shapeAttribute.setXYZ(t, ...e.normalizedShape), this.segments.push({
				pool: e.pool,
				matrix: n,
				index: t,
				sign: e.sign,
				normalizedShape: e.normalizedShape
			});
		}
		this.surfaceDescriptor = r, this.presentation = i;
	}
	getSurfaceDistanceAlong(e) {
		return this.surfaceDescriptor.surfaceDistanceAlong([
			e.x,
			e.y,
			e.z
		]);
	}
	raycast(e, t) {
		let n = [];
		if (super.raycast(e, n), n.length === 0) return;
		let r = [];
		for (let t of this.segments) {
			let n = t.pool.mesh.geometry.clone(), i = n.getAttribute("position"), a = t.normalizedShape;
			for (let e = 0; e < i.count; e++) {
				let t = i.getX(e), n = i.getY(e), r = i.getZ(e), o = 1 / Math.hypot(t, n, r), s = t * o, c = n * o, l = r * o, u = Math.sqrt(Math.max(a[0] * s * s + a[1] * c * c + a[2] * l * l, 0));
				i.setXYZ(e, t * u, n * u, r * u);
			}
			i.needsUpdate = !0, n.computeBoundingSphere();
			let o = new _.Mesh(n, t.pool.mesh.material);
			o.matrixAutoUpdate = !1, o.matrixWorld.multiplyMatrices(this.matrixWorld, t.matrix), _.Mesh.prototype.raycast.call(o, e, r), n.dispose();
		}
		r.length > 0 && (r.sort((e, t) => e.distance - t.distance), t.push({
			...r[0],
			object: this
		}));
	}
	createStandalonePeanutMaterial(e, t) {
		let n = e.clone(), r = e.userData.peanut;
		return I(n, {
			presentation: r.presentation,
			gridColor: r.gridColor,
			silhouetteWidth: r.silhouetteWidth,
			gridLineWidth: r.gridLineWidth,
			meridianCount: r.meridianCount,
			latitudeIntervals: r.latitudeIntervals,
			gridPoleAxis: r.gridPoleAxis,
			uniformShape: t,
			gridRotation: this.surfaceDescriptor.rotation
		});
	}
	select(e, t) {
		this._selectionColor = e, this.presentation !== "publication-2d" && (this.highlightMeshes = this.segments.map((e) => {
			e.pool.hideInstance(e.index);
			let n = this.createStandalonePeanutMaterial(e.pool.mesh.material, e.normalizedShape);
			n.emissive?.setHex(t.selection.highlightEmissive);
			let r = new _.Mesh(e.pool.baseGeometry, n);
			return r.applyMatrix4(e.matrix), r.userData = {
				...this.userData,
				selectable: !1
			}, this.add(r), r;
		}));
		let n = this.createSelectionMarker(e, t);
		this.add(n), this.marker = n;
	}
	createSelectionMarker(e, t) {
		let n = this.segments.map((n) => {
			let r;
			if (this.presentation === "publication-2d") {
				let i = n.pool.outlineMesh.material.userData.peanut, a = t.plot2DOutlineWidth ?? 1.2, o = t.selection.haloWidth ?? 4;
				r = I(new _.MeshBasicMaterial({
					color: e,
					transparent: !0,
					opacity: .9,
					side: _.BackSide,
					depthTest: !0,
					depthWrite: !1
				}), {
					presentation: "outline",
					uniformShape: n.normalizedShape,
					gridRotation: this.surfaceDescriptor.rotation,
					outlinePixelUniform: { value: a + o },
					outlineViewport: i.outlineViewport
				});
			} else r = I(this.createSelectionMaterial(e), {
				presentation: "clean-3d",
				uniformShape: n.normalizedShape,
				gridRotation: this.surfaceDescriptor.rotation
			});
			let i = new _.Mesh(n.pool.baseGeometry, r);
			return i.applyMatrix4(n.matrix), this.presentation === "publication-2d" ? i.renderOrder = 1000001 : i.scale.multiplyScalar(t.selection.markerMult), i.userData.selectable = !1, i;
		});
		if (n.length === 1) return n[0];
		let r = new _.Group();
		return r.add(...n), r.userData.selectable = !1, r;
	}
}, lt = class extends Xe {
	constructor(e, t, n, r, i = null, a = null, o = null, s = null) {
		super(n, r);
		let c, l;
		if (i) c = i(e.atom1Id), l = i(e.atom2Id);
		else {
			let n = t.getAtomById(e.atom1Id), r = t.getAtomById(e.atom2Id);
			c = new _.Vector3(...n.position.toCartesian(t.cell)), l = new _.Vector3(...r.position.toCartesian(t.cell));
		}
		a && ([c, l] = qe(c, l, a(e.atom1Id), a(e.atom2Id)));
		let u = B(c, l), d = c.distanceTo(l);
		this.applyMatrix4(u);
		let f = 1;
		if (o) {
			let e = _.MathUtils.clamp(o.innerScale, .05, .95);
			f = e, this.scale.x *= e, this.scale.z *= e;
			let t = new _.Mesh(n, o.outlineMaterial);
			t.scale.set(1 / e, 1, 1 / e), t.userData = {
				selectable: !1,
				type: "2d-open-bond-outline"
			}, this.add(t), this.openBondOutline = t;
		}
		if (s && s.width > 0) {
			let e = Math.max(0, s.endpointInset || 0), t = d > 0 ? Math.max(.05, 1 - 2 * e / d) : 1, r = new _.Mesh(n, s.material);
			r.scale.set(1 / f, t, 1 / f), r.userData = {
				selectable: !1,
				type: "2d-bond-depth-outline"
			}, this.add(r), this.bondDepthOutline = r;
		}
		this.userData = {
			type: "bond",
			bondData: e,
			selectable: !0,
			isOpenDisorderBond: !!o
		};
	}
	createSelectionMarker(e, t) {
		let n = new _.Mesh(this.geometry, this.createSelectionMaterial(e));
		return n.scale.x *= t.selection.bondMarkerMult, n.scale.z *= t.selection.bondMarkerMult, n.userData.selectable = !1, n;
	}
};
_.Group;
var ut = class e extends at {
	static computeSplitMatrices(e) {
		let t = new _.Matrix4().makeScale(1, .5, 1);
		return [-.25, .25].map((n) => e.clone().multiply(new _.Matrix4().makeTranslation(0, n, 0)).multiply(t));
	}
	static computeMatrix(e, t, n = null, r = null) {
		let i, a;
		if (n) i = n(e.atom1Id), a = n(e.atom2Id);
		else {
			let n = t.getAtomById(e.atom1Id), r = t.getAtomById(e.atom2Id);
			i = new _.Vector3(...n.position.toCartesian(t.cell)), a = new _.Vector3(...r.position.toCartesian(t.cell));
		}
		return r && ([i, a] = qe(i, a, r(e.atom1Id), r(e.atom2Id))), B(i, a);
	}
	constructor(t, n, r, i = null) {
		super(), this.userData = {
			type: "bond",
			bondData: t,
			selectable: !0,
			isOpenDisorderBond: !1
		}, this.fullMatrix = r;
		let a = Array.isArray(i) ? i : null, o = a ? e.computeSplitMatrices(r) : [r];
		this.segments = o.map((e, t) => {
			let r = a?.[t] || i || null;
			return {
				pool: n,
				matrix: e,
				index: n.register(e, r),
				color: r?.clone() || null
			};
		});
	}
	createSelectionMarker(e, t) {
		let n = this.segments[0], r = new _.Mesh(n.pool.mesh.geometry, this.createSelectionMaterial(e));
		return r.applyMatrix4(this.fullMatrix), r.scale.x *= t.selection.bondMarkerMult, r.scale.z *= t.selection.bondMarkerMult, r.userData.selectable = !1, r;
	}
}, dt = class extends at {
	static computeSegmentMatrices(e, t, n, r, i = null, a = null) {
		let o, s;
		if (i) o = i(e.hydrogenAtomId), s = i(e.acceptorAtomId);
		else {
			let n = t.getAtomById(e.hydrogenAtomId), r = t.getAtomById(e.acceptorAtomId);
			o = new _.Vector3(...n.position.toCartesian(t.cell)), s = new _.Vector3(...r.position.toCartesian(t.cell));
		}
		a && ([o, s] = qe(o, s, a(e.hydrogenAtomId), a(e.acceptorAtomId)));
		let c = o.distanceTo(s), l = Math.max(1, Math.round(c / n)), u = c / (l + 1 - r), d = u * r, f = u - d, p = [];
		for (let e = 0; e < l; e++) {
			let t = (f + e * u) / c, n = t + d / c, r = new _.Vector3().lerpVectors(o, s, t), i = new _.Vector3().lerpVectors(o, s, n);
			p.push(B(r, i));
		}
		return p;
	}
	constructor(e, t, n) {
		super(), this.userData = {
			type: "hbond",
			hbondData: e,
			selectable: !0
		}, this.pool = t, this.segments = n.map((e) => ({
			pool: t,
			matrix: e,
			index: t.register(e)
		}));
	}
	createSelectionMarker(e, t) {
		let n = new _.Group(), r = this.createSelectionMaterial(e);
		return this.segments.forEach((e) => {
			let i = new _.Mesh(e.pool.mesh.geometry, r);
			i.applyMatrix4(e.matrix), i.scale.x *= t.selection.bondMarkerMult, i.scale.y *= .8 * t.selection.bondMarkerMult, i.scale.z *= t.selection.bondMarkerMult, i.userData.selectable = !1, n.add(i);
		}), n;
	}
}, ft = /* @__PURE__ */ new Set([
	"positiveColor",
	"negativeColor",
	"deformationPositiveColor",
	"deformationNegativeColor",
	"opacity",
	"visible"
]), pt = class {
	constructor(e, t = {}) {
		this.parent = e, this.options = { ...t }, this.field = null, this.structure = null, this.group = null, this.resolutionFraction = 1, this.regionCache = new m(t.surfaceCacheMaxBytes), this.appearanceOnlyUpdate = !1;
	}
	setField(e, t = 1) {
		e !== this.field && (this.regionCache.clear(), this.appearanceOnlyUpdate = !1), this.field = e, this.resolutionFraction = t;
	}
	setStructure(e) {
		e !== this.structure && (this.appearanceOnlyUpdate = !1), this.structure = e;
	}
	setOptions(e = {}) {
		let t = Object.entries(e).filter(([e, t]) => this.options[e] !== t);
		this.appearanceOnlyUpdate = !!this.group && t.length > 0 && t.every(([e]) => ft.has(e)), this.options = {
			...this.options,
			...e
		}, e.surfaceCacheMaxBytes !== void 0 && (this.regionCache.maxBytes = Math.max(0, Number(e.surfaceCacheMaxBytes) || 0));
	}
	rebuild() {
		if (this.appearanceOnlyUpdate && this.group) return this.appearanceOnlyUpdate = !1, this.updateAppearance(), this.group.userData.appearanceCacheHitCount = (this.group.userData.appearanceCacheHitCount ?? 0) + 1, {
			...this.group.userData,
			surfaceTotalTimeMs: 0,
			generationTimeMs: 0
		};
		if (this.clearMesh(), !this.field || !this.structure) return null;
		let e = u(this.structure, this.options), t = this.field.fieldKind === "deformation-density" ? {
			positiveColor: this.options.deformationPositiveColor,
			negativeColor: this.options.deformationNegativeColor
		} : {}, n = {
			...this.options,
			...t,
			gridSpacing: this.options.gridSpacing / this.resolutionFraction,
			resolution: Math.max(8, Math.round(e * this.resolutionFraction))
		};
		return this.group = l(this.field, this.structure, n, this.regionCache), this.group.visible = this.options.visible !== !1, this.parent.add(this.group), this.group.userData;
	}
	updateAppearance() {
		let e = this.field?.fieldKind === "deformation-density";
		this.group.visible = this.options.visible !== !1, this.group.traverse((t) => {
			let n = t.userData?.sign;
			if (!n || !t.material) return;
			let r = e ? n === "positive" ? this.options.deformationPositiveColor : this.options.deformationNegativeColor : n === "positive" ? this.options.positiveColor : this.options.negativeColor, i = Array.isArray(t.material) ? t.material : [t.material];
			for (let e of i) e.color?.set(r), e.opacity = this.options.opacity, e.transparent = this.options.opacity < 1, e.depthWrite = this.options.opacity >= 1, e.needsUpdate = !0;
		});
	}
	clearMesh() {
		this.group &&= (this.group.traverse((e) => {
			e.geometry?.dispose(), e.material?.dispose();
		}), this.group.removeFromParent(), null);
	}
	clear() {
		this.clearMesh(), this.regionCache.clear(), this.field = null, this.resolutionFraction = 1, this.appearanceOnlyUpdate = !1;
	}
	setVisible(e) {
		let t = !!e;
		return this.options.visible = t, this.group && (this.group.visible = t), t;
	}
	get statistics() {
		return this.group?.userData ?? {};
	}
	get displayState() {
		let e = this.group?.userData;
		return {
			available: Number.isFinite(e?.level),
			visible: this.group?.visible ?? this.options.visible !== !1,
			level: Number.isFinite(e?.level) ? e.level : null,
			sigmaLevel: this.field?.contourMode === "sigma" ? Number.isFinite(e?.sigmaLevel) ? e.sigmaLevel : this.options.sigmaLevel : null,
			sourceType: this.field?.sourceType ?? null,
			fieldKind: this.field?.fieldKind ?? null,
			displayLabel: this.field?.displayLabel ?? "Scalar field",
			quantityName: this.field?.quantityName ?? "scalar field",
			signed: this.field?.surfaceSign !== "positive",
			displayMode: "isosurface"
		};
	}
	dispose() {
		this.clear(), this.structure = null, this.parent = null;
	}
}, mt = new v(), V = new O(), ht = class extends S {
	constructor() {
		super(), this.isLineSegmentsGeometry = !0, this.type = "LineSegmentsGeometry", this.setIndex([
			0,
			2,
			1,
			2,
			3,
			1,
			2,
			4,
			3,
			4,
			5,
			3,
			4,
			6,
			5,
			6,
			7,
			5
		]), this.setAttribute("position", new x([
			-1,
			2,
			0,
			1,
			2,
			0,
			-1,
			1,
			0,
			1,
			1,
			0,
			-1,
			0,
			0,
			1,
			0,
			0,
			-1,
			-1,
			0,
			1,
			-1,
			0
		], 3)), this.setAttribute("uv", new x([
			-1,
			2,
			1,
			2,
			-1,
			1,
			1,
			1,
			-1,
			-1,
			1,
			-1,
			-1,
			-2,
			1,
			-2
		], 2));
	}
	applyMatrix4(e) {
		let t = this.attributes.instanceStart, n = this.attributes.instanceEnd;
		return t !== void 0 && (t.applyMatrix4(e), n.applyMatrix4(e), t.needsUpdate = !0), this.boundingBox !== null && this.computeBoundingBox(), this.boundingSphere !== null && this.computeBoundingSphere(), this;
	}
	setPositions(e) {
		let t;
		e instanceof Float32Array ? t = e : Array.isArray(e) && (t = new Float32Array(e));
		let n = new C(t, 6, 1);
		return this.setAttribute("instanceStart", new w(n, 3, 0)), this.setAttribute("instanceEnd", new w(n, 3, 3)), this.instanceCount = this.attributes.instanceStart.count, this.computeBoundingBox(), this.computeBoundingSphere(), this;
	}
	setColors(e) {
		let t;
		e instanceof Float32Array ? t = e : Array.isArray(e) && (t = new Float32Array(e));
		let n = new C(t, 6, 1);
		return this.setAttribute("instanceColorStart", new w(n, 3, 0)), this.setAttribute("instanceColorEnd", new w(n, 3, 3)), this;
	}
	fromWireframeGeometry(e) {
		return this.setPositions(e.attributes.position.array), this;
	}
	fromEdgesGeometry(e) {
		return this.setPositions(e.attributes.position.array), this;
	}
	fromMesh(e) {
		return this.fromWireframeGeometry(new se(e.geometry)), this;
	}
	fromLineSegments(e) {
		let t = e.geometry;
		return this.setPositions(t.attributes.position.array), this;
	}
	computeBoundingBox() {
		this.boundingBox === null && (this.boundingBox = new v());
		let e = this.attributes.instanceStart, t = this.attributes.instanceEnd;
		e !== void 0 && t !== void 0 && (this.boundingBox.setFromBufferAttribute(e), mt.setFromBufferAttribute(t), this.boundingBox.union(mt));
	}
	computeBoundingSphere() {
		this.boundingSphere === null && (this.boundingSphere = new ie()), this.boundingBox === null && this.computeBoundingBox();
		let e = this.attributes.instanceStart, t = this.attributes.instanceEnd;
		if (e !== void 0 && t !== void 0) {
			let n = this.boundingSphere.center;
			this.boundingBox.getCenter(n);
			let r = 0;
			for (let i = 0, a = e.count; i < a; i++) V.fromBufferAttribute(e, i), r = Math.max(r, n.distanceToSquared(V)), V.fromBufferAttribute(t, i), r = Math.max(r, n.distanceToSquared(V));
			this.boundingSphere.radius = Math.sqrt(r), isNaN(this.boundingSphere.radius) && console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.", this);
		}
	}
	toJSON() {}
};
D.line = {
	worldUnits: { value: 1 },
	linewidth: { value: 1 },
	resolution: { value: new oe() },
	dashOffset: { value: 0 },
	dashScale: { value: 1 },
	dashSize: { value: 1 },
	gapSize: { value: 1 }
}, E.line = {
	uniforms: ae.merge([
		D.common,
		D.fog,
		D.line
	]),
	vertexShader: "\n		#include <common>\n		#include <color_pars_vertex>\n		#include <fog_pars_vertex>\n		#include <logdepthbuf_pars_vertex>\n		#include <clipping_planes_pars_vertex>\n\n		uniform float linewidth;\n		uniform vec2 resolution;\n\n		attribute vec3 instanceStart;\n		attribute vec3 instanceEnd;\n\n		attribute vec3 instanceColorStart;\n		attribute vec3 instanceColorEnd;\n\n		#ifdef WORLD_UNITS\n\n			varying vec4 worldPos;\n			varying vec3 worldStart;\n			varying vec3 worldEnd;\n\n			#ifdef USE_DASH\n\n				varying vec2 vUv;\n\n			#endif\n\n		#else\n\n			varying vec2 vUv;\n\n		#endif\n\n		#ifdef USE_DASH\n\n			uniform float dashScale;\n			attribute float instanceDistanceStart;\n			attribute float instanceDistanceEnd;\n			varying float vLineDistance;\n\n		#endif\n\n		float trimSegmentAlpha( const in vec4 start, const in vec4 end ) {\n\n			// compute the interpolation factor needed to trim the segment so it terminates\n			// between the camera plane and the near plane\n\n			// conservative estimate of the near plane\n			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column\n			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column\n\n			// we need different nearEstimate formula for reversed and default depth buffer\n			// a is positive with a reversed depth buffer so it can be used for controlling the code flow\n			float nearEstimate = ( a > 0.0 ) ? ( - b / ( a + 1.0 ) ) : ( - 0.5 * b / a );\n\n			return ( nearEstimate - start.z ) / ( end.z - start.z );\n\n		}\n\n		void main() {\n\n			#ifdef USE_COLOR\n\n				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;\n\n			#endif\n\n			float aspect = resolution.x / resolution.y;\n\n			// camera space\n			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );\n			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );\n\n			#ifdef USE_DASH\n\n				float lineDistanceStart = dashScale * instanceDistanceStart;\n				float lineDistanceEnd = dashScale * instanceDistanceEnd;\n\n			#endif\n\n			#ifdef WORLD_UNITS\n\n				worldStart = start.xyz;\n				worldEnd = end.xyz;\n\n			#else\n\n				vUv = uv;\n\n			#endif\n\n			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane\n			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space\n			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly\n			// perhaps there is a more elegant solution -- WestLangley\n\n			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column\n\n			if ( perspective ) {\n\n				if ( start.z < 0.0 && end.z >= 0.0 ) {\n\n					float alpha = trimSegmentAlpha( start, end );\n					end.xyz = mix( start.xyz, end.xyz, alpha );\n\n					#ifdef USE_DASH\n\n						lineDistanceEnd = mix( lineDistanceStart, lineDistanceEnd, alpha );\n\n					#endif\n\n				} else if ( end.z < 0.0 && start.z >= 0.0 ) {\n\n					float alpha = trimSegmentAlpha( end, start );\n					start.xyz = mix( end.xyz, start.xyz, alpha );\n\n					#ifdef USE_DASH\n\n						lineDistanceStart = mix( lineDistanceEnd, lineDistanceStart, alpha );\n\n					#endif\n\n				}\n\n			}\n\n			#ifdef USE_DASH\n\n				vLineDistance = ( position.y < 0.5 ) ? lineDistanceStart : lineDistanceEnd;\n				vUv = uv;\n\n			#endif\n\n			// clip space\n			vec4 clipStart = projectionMatrix * start;\n			vec4 clipEnd = projectionMatrix * end;\n\n			// ndc space\n			vec3 ndcStart = clipStart.xyz / clipStart.w;\n			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;\n\n			// direction\n			vec2 dir = ndcEnd.xy - ndcStart.xy;\n\n			// account for clip-space aspect ratio\n			dir.x *= aspect;\n			dir = normalize( dir );\n\n			#ifdef WORLD_UNITS\n\n				vec3 worldDir = normalize( end.xyz - start.xyz );\n				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );\n				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );\n				vec3 worldFwd = cross( worldDir, worldUp );\n				worldPos = position.y < 0.5 ? start: end;\n\n				// height offset\n				float hw = linewidth * 0.5;\n				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;\n\n				// don't extend the line if we're rendering dashes because we\n				// won't be rendering the endcaps\n				#ifndef USE_DASH\n\n					// cap extension\n					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;\n\n					// add width to the box\n					worldPos.xyz += worldFwd * hw;\n\n					// endcaps\n					if ( position.y > 1.0 || position.y < 0.0 ) {\n\n						worldPos.xyz -= worldFwd * 2.0 * hw;\n\n					}\n\n				#endif\n\n				// project the worldpos\n				vec4 clip = projectionMatrix * worldPos;\n\n				// shift the depth of the projected points so the line\n				// segments overlap neatly\n				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;\n				clip.z = clipPose.z * clip.w;\n\n			#else\n\n				vec2 offset = vec2( dir.y, - dir.x );\n				// undo aspect ratio adjustment\n				dir.x /= aspect;\n				offset.x /= aspect;\n\n				// sign flip\n				if ( position.x < 0.0 ) offset *= - 1.0;\n\n				// endcaps\n				if ( position.y < 0.0 ) {\n\n					offset += - dir;\n\n				} else if ( position.y > 1.0 ) {\n\n					offset += dir;\n\n				}\n\n				// adjust for linewidth\n				offset *= linewidth;\n\n				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...\n				offset /= resolution.y;\n\n				// select end\n				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;\n\n				// back to clip space\n				offset *= clip.w;\n\n				clip.xy += offset;\n\n			#endif\n\n			gl_Position = clip;\n\n			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation\n\n			#include <logdepthbuf_vertex>\n			#include <clipping_planes_vertex>\n			#include <fog_vertex>\n\n		}\n		",
	fragmentShader: "\n		uniform vec3 diffuse;\n		uniform float opacity;\n		uniform float linewidth;\n\n		#ifdef USE_DASH\n\n			uniform float dashOffset;\n			uniform float dashSize;\n			uniform float gapSize;\n\n		#endif\n\n		varying float vLineDistance;\n\n		#ifdef WORLD_UNITS\n\n			varying vec4 worldPos;\n			varying vec3 worldStart;\n			varying vec3 worldEnd;\n\n			#ifdef USE_DASH\n\n				varying vec2 vUv;\n\n			#endif\n\n		#else\n\n			varying vec2 vUv;\n\n		#endif\n\n		#include <common>\n		#include <color_pars_fragment>\n		#include <fog_pars_fragment>\n		#include <logdepthbuf_pars_fragment>\n		#include <clipping_planes_pars_fragment>\n\n		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {\n\n			float mua;\n			float mub;\n\n			vec3 p13 = p1 - p3;\n			vec3 p43 = p4 - p3;\n\n			vec3 p21 = p2 - p1;\n\n			float d1343 = dot( p13, p43 );\n			float d4321 = dot( p43, p21 );\n			float d1321 = dot( p13, p21 );\n			float d4343 = dot( p43, p43 );\n			float d2121 = dot( p21, p21 );\n\n			float denom = d2121 * d4343 - d4321 * d4321;\n\n			float numer = d1343 * d4321 - d1321 * d4343;\n\n			mua = numer / denom;\n			mua = clamp( mua, 0.0, 1.0 );\n			mub = ( d1343 + d4321 * ( mua ) ) / d4343;\n			mub = clamp( mub, 0.0, 1.0 );\n\n			return vec2( mua, mub );\n\n		}\n\n		void main() {\n\n			float alpha = opacity;\n			vec4 diffuseColor = vec4( diffuse, alpha );\n\n			#include <clipping_planes_fragment>\n\n			#ifdef USE_DASH\n\n				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps\n\n				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX\n\n			#endif\n\n			#ifdef WORLD_UNITS\n\n				// Find the closest points on the view ray and the line segment\n				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;\n				vec3 lineDir = worldEnd - worldStart;\n				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );\n\n				vec3 p1 = worldStart + lineDir * params.x;\n				vec3 p2 = rayEnd * params.y;\n				vec3 delta = p1 - p2;\n				float len = length( delta );\n				float norm = len / linewidth;\n\n				#ifndef USE_DASH\n\n					#ifdef USE_ALPHA_TO_COVERAGE\n\n						float dnorm = fwidth( norm );\n						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );\n\n					#else\n\n						if ( norm > 0.5 ) {\n\n							discard;\n\n						}\n\n					#endif\n\n				#endif\n\n			#else\n\n				#ifdef USE_ALPHA_TO_COVERAGE\n\n					// artifacts appear on some hardware if a derivative is taken within a conditional\n					float a = vUv.x;\n					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;\n					float len2 = a * a + b * b;\n					float dlen = fwidth( len2 );\n\n					if ( abs( vUv.y ) > 1.0 ) {\n\n						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );\n\n					}\n\n				#else\n\n					if ( abs( vUv.y ) > 1.0 ) {\n\n						float a = vUv.x;\n						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;\n						float len2 = a * a + b * b;\n\n						if ( len2 > 1.0 ) discard;\n\n					}\n\n				#endif\n\n			#endif\n\n			#include <logdepthbuf_fragment>\n			#include <color_fragment>\n\n			gl_FragColor = vec4( diffuseColor.rgb, alpha );\n\n			#include <tonemapping_fragment>\n			#include <colorspace_fragment>\n			#include <fog_fragment>\n			#include <premultiplied_alpha_fragment>\n\n		}\n		"
};
var gt = class extends re {
	constructor(e) {
		super({
			type: "LineMaterial",
			uniforms: ae.clone(E.line.uniforms),
			vertexShader: E.line.vertexShader,
			fragmentShader: E.line.fragmentShader,
			clipping: !0
		}), this.isLineMaterial = !0, this.setValues(e);
	}
	get color() {
		return this.uniforms.diffuse.value;
	}
	set color(e) {
		this.uniforms.diffuse.value = e;
	}
	get worldUnits() {
		return "WORLD_UNITS" in this.defines;
	}
	set worldUnits(e) {
		e === !0 !== this.worldUnits && (this.needsUpdate = !0), e === !0 ? this.defines.WORLD_UNITS = "" : delete this.defines.WORLD_UNITS;
	}
	get linewidth() {
		return this.uniforms.linewidth.value;
	}
	set linewidth(e) {
		this.uniforms.linewidth && (this.uniforms.linewidth.value = e);
	}
	get dashed() {
		return "USE_DASH" in this.defines;
	}
	set dashed(e) {
		e === !0 !== this.dashed && (this.needsUpdate = !0), e === !0 ? this.defines.USE_DASH = "" : delete this.defines.USE_DASH;
	}
	get dashScale() {
		return this.uniforms.dashScale.value;
	}
	set dashScale(e) {
		this.uniforms.dashScale.value = e;
	}
	get dashSize() {
		return this.uniforms.dashSize.value;
	}
	set dashSize(e) {
		this.uniforms.dashSize.value = e;
	}
	get dashOffset() {
		return this.uniforms.dashOffset.value;
	}
	set dashOffset(e) {
		this.uniforms.dashOffset.value = e;
	}
	get gapSize() {
		return this.uniforms.gapSize.value;
	}
	set gapSize(e) {
		this.uniforms.gapSize.value = e;
	}
	get opacity() {
		return this.uniforms.opacity.value;
	}
	set opacity(e) {
		this.uniforms && (this.uniforms.opacity.value = e);
	}
	get resolution() {
		return this.uniforms.resolution.value;
	}
	set resolution(e) {
		this.uniforms.resolution.value.copy(e);
	}
	get alphaToCoverage() {
		return "USE_ALPHA_TO_COVERAGE" in this.defines;
	}
	set alphaToCoverage(e) {
		this.defines && (e === !0 !== this.alphaToCoverage && (this.needsUpdate = !0), e === !0 ? this.defines.USE_ALPHA_TO_COVERAGE = "" : delete this.defines.USE_ALPHA_TO_COVERAGE);
	}
}, _t = new k(), vt = new O(), yt = new O(), H = new k(), U = new k(), W = new k(), G = new O(), bt = new ne(), K = new ee(), xt = new O(), q = new v(), J = new ie(), Y = new k(), X, Z;
function St(e, t, n) {
	return Y.set(0, 0, -t, 1).applyMatrix4(e.projectionMatrix), Y.multiplyScalar(1 / Y.w), Y.x = Z / n.width, Y.y = Z / n.height, Y.applyMatrix4(e.projectionMatrixInverse), Y.multiplyScalar(1 / Y.w), Math.abs(Math.max(Y.x, Y.y));
}
function Ct(e, t) {
	let n = e.matrixWorld, r = e.geometry, i = r.attributes.instanceStart, a = r.attributes.instanceEnd, o = Math.min(r.instanceCount, i.count);
	for (let r = 0, s = o; r < s; r++) {
		K.start.fromBufferAttribute(i, r), K.end.fromBufferAttribute(a, r), K.applyMatrix4(n);
		let o = new O(), s = new O();
		X.distanceSqToSegment(K.start, K.end, s, o), s.distanceTo(o) < Z * .5 && t.push({
			point: s,
			pointOnLine: o,
			distance: X.origin.distanceTo(s),
			object: e,
			face: null,
			faceIndex: r,
			uv: null,
			uv1: null
		});
	}
}
function wt(e, t, n) {
	let r = t.projectionMatrix, i = e.material.resolution, a = e.matrixWorld, o = e.geometry, s = o.attributes.instanceStart, c = o.attributes.instanceEnd, l = Math.min(o.instanceCount, s.count), u = -t.near;
	X.at(1, W), W.w = 1, W.applyMatrix4(t.matrixWorldInverse), W.applyMatrix4(r), W.multiplyScalar(1 / W.w), W.x *= i.x / 2, W.y *= i.y / 2, W.z = 0, G.copy(W), bt.multiplyMatrices(t.matrixWorldInverse, a);
	for (let t = 0, o = l; t < o; t++) {
		if (H.fromBufferAttribute(s, t), U.fromBufferAttribute(c, t), H.w = 1, U.w = 1, H.applyMatrix4(bt), U.applyMatrix4(bt), H.z > u && U.z > u) continue;
		if (H.z > u) {
			let e = H.z - U.z, t = (H.z - u) / e;
			H.lerp(U, t);
		} else if (U.z > u) {
			let e = U.z - H.z, t = (U.z - u) / e;
			U.lerp(H, t);
		}
		H.applyMatrix4(r), U.applyMatrix4(r), H.multiplyScalar(1 / H.w), U.multiplyScalar(1 / U.w), H.x *= i.x / 2, H.y *= i.y / 2, U.x *= i.x / 2, U.y *= i.y / 2, K.start.copy(H), K.start.z = 0, K.end.copy(U), K.end.z = 0;
		let o = K.closestPointToPointParameter(G, !0);
		K.at(o, xt);
		let l = te.lerp(H.z, U.z, o), d = l >= -1 && l <= 1, f = G.distanceTo(xt) < Z * .5;
		if (d && f) {
			K.start.fromBufferAttribute(s, t), K.end.fromBufferAttribute(c, t), K.start.applyMatrix4(a), K.end.applyMatrix4(a);
			let r = new O(), i = new O();
			X.distanceSqToSegment(K.start, K.end, i, r), n.push({
				point: i,
				pointOnLine: r,
				distance: X.origin.distanceTo(i),
				object: e,
				face: null,
				faceIndex: t,
				uv: null,
				uv1: null
			});
		}
	}
}
var Tt = class extends T {
	constructor(e = new ht(), t = new gt({ color: Math.random() * 16777215 })) {
		super(e, t), this.isLineSegments2 = !0, this.type = "LineSegments2";
	}
	computeLineDistances() {
		let e = this.geometry, t = e.attributes.instanceStart, n = e.attributes.instanceEnd, r = new Float32Array(2 * t.count);
		for (let e = 0, i = 0, a = t.count; e < a; e++, i += 2) vt.fromBufferAttribute(t, e), yt.fromBufferAttribute(n, e), r[i] = i === 0 ? 0 : r[i - 1], r[i + 1] = r[i] + vt.distanceTo(yt);
		let i = new C(r, 2, 1);
		return e.setAttribute("instanceDistanceStart", new w(i, 1, 0)), e.setAttribute("instanceDistanceEnd", new w(i, 1, 1)), this;
	}
	raycast(e, t) {
		let n = this.material.worldUnits, r = e.camera;
		if (r === null && !n && console.error("LineSegments2: \"Raycaster.camera\" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false."), n === !1 && (this.material.resolution.x === 0 || this.material.resolution.y === 0)) return;
		let i = e.params.Line2 === void 0 ? 0 : e.params.Line2.threshold || 0;
		X = e.ray;
		let a = this.matrixWorld, o = this.geometry, s = this.material;
		Z = s.linewidth + i, o.boundingSphere === null && o.computeBoundingSphere(), J.copy(o.boundingSphere).applyMatrix4(a);
		let c;
		if (c = n ? Z * .5 : St(r, Math.max(r.near, J.distanceToPoint(X.origin)), s.resolution), J.radius += c, X.intersectsSphere(J) === !1) return;
		o.boundingBox === null && o.computeBoundingBox(), q.copy(o.boundingBox).applyMatrix4(a);
		let l;
		l = n ? Z * .5 : St(r, Math.max(r.near, q.distanceToPoint(X.origin)), s.resolution), q.expandByScalar(l), X.intersectsBox(q) !== !1 && (n ? Ct(this, t) : wt(this, r, t));
	}
	onBeforeRender(e) {
		let t = this.material.uniforms;
		t && t.resolution && (e.getViewport(_t), this.material.uniforms.resolution.value.set(_t.z, _t.w));
	}
}, Et = 0, Dt = 1;
function Q() {
	return globalThis.performance?.now?.() ?? Date.now();
}
function Ot(e) {
	return ArrayBuffer.isView(e) ? e : new Float32Array(e.flat(2));
}
function $(e) {
	return ArrayBuffer.isView(e) ? e.length / 6 : e.length;
}
var kt = class {
	constructor(e, t = {}) {
		this.parent = e, this.options = { ...t }, this.field = null, this.structure = null, this.group = null;
	}
	setField(e) {
		this.field = e;
	}
	setStructure(e) {
		this.structure = e;
	}
	setOptions(e = {}) {
		this.options = {
			...this.options,
			...e
		};
	}
	addSegments(e, t, n, r) {
		let i = $(t);
		if (i === 0) return;
		let a = Ot(t);
		if (this.options.haloWidth > 0) {
			let t = new ht();
			t.setPositions(a);
			let r = new Tt(t, new gt({
				color: this.options.haloColor,
				linewidth: this.options.lineWidth + 2 * this.options.haloWidth,
				opacity: this.options.opacity,
				transparent: this.options.opacity < 1,
				depthWrite: !1,
				worldUnits: !1,
				alphaToCoverage: this.options.opacity >= 1,
				polygonOffset: !0,
				polygonOffsetFactor: Et,
				polygonOffsetUnits: Dt
			}));
			r.name = `${n[0].toUpperCase()}${n.slice(1)} contour halo`, r.renderOrder = -1, e.add(r);
		}
		let o = new ht();
		o.setPositions(a);
		let s = new Tt(o, new gt({
			color: r,
			linewidth: this.options.lineWidth,
			opacity: this.options.opacity,
			transparent: this.options.opacity < 1,
			depthWrite: !0,
			worldUnits: !1,
			alphaToCoverage: this.options.opacity >= 1,
			polygonOffset: !0,
			polygonOffsetFactor: Et,
			polygonOffsetUnits: Dt
		}));
		s.name = `${n[0].toUpperCase()}${n.slice(1)} contour lines`, s.userData.sign = n, s.userData.segmentCount = i, e.add(s);
	}
	rebuild() {
		let e = Q();
		if (this.clearMesh(), !this.field || !this.structure) return null;
		let t = h(this.field, this.structure, this.options);
		return this.buildContours(t, e);
	}
	rebuildFromContours(e) {
		let t = Q();
		return this.clearMesh(), !this.field || !e ? null : this.buildContours(e, t);
	}
	buildContours(e, t) {
		let n = this.field.fieldKind === "deformation-density", r = this.options.lineColor ?? (n ? this.options.deformationPositiveColor : this.options.positiveColor), i = this.options.lineColor ?? (n ? this.options.deformationNegativeColor : this.options.negativeColor), a = Q(), o = new _.Group();
		o.name = "Planar contour lines", this.addSegments(o, e.positiveSegments, "positive", r), this.addSegments(o, e.negativeSegments, "negative", i), this.addSegments(o, e.zeroSegments, "zero", this.options.zeroColor);
		let s = Q();
		return o.userData = {
			displayMode: "contour-lines",
			level: e.level,
			sigmaLevel: Number.isFinite(this.field.sigma) && this.field.sigma !== 0 ? e.level / this.field.sigma : null,
			levels: e.levels,
			dimensions: e.dimensions,
			plane: e.plane,
			segmentCount: e.segmentCount,
			positiveSegmentCount: $(e.positiveSegments),
			negativeSegmentCount: $(e.negativeSegments),
			zeroSegmentCount: $(e.zeroSegments),
			polygonCount: 0,
			resolution: Math.max(...e.dimensions),
			planeSetupTimeMs: e.timings.planeSetupTimeMs,
			samplingTimeMs: e.timings.samplingTimeMs,
			contourExtractionTimeMs: e.timings.contourExtractionTimeMs,
			calculationTimeMs: e.timings.totalTimeMs,
			geometryTimeMs: s - a,
			generationTimeMs: s - t
		}, o.visible = this.options.visible !== !1, this.group = o, this.parent.add(o), o.userData;
	}
	clearMesh() {
		this.group &&= (this.group.traverse((e) => {
			e.geometry?.dispose(), e.material?.dispose();
		}), this.group.removeFromParent(), null);
	}
	clear() {
		this.clearMesh(), this.field = null;
	}
	setVisible(e) {
		let t = !!e;
		return this.options.visible = t, this.group && (this.group.visible = t), t;
	}
	get statistics() {
		return this.group?.userData ?? {};
	}
	get displayState() {
		let e = this.group?.userData;
		return {
			available: Number.isFinite(e?.level),
			visible: this.group?.visible ?? this.options.visible !== !1,
			level: Number.isFinite(e?.level) ? e.level : null,
			sigmaLevel: this.field?.contourMode === "sigma" ? Number.isFinite(e?.sigmaLevel) ? e.sigmaLevel : this.options.sigmaLevel : null,
			sourceType: this.field?.sourceType ?? null,
			fieldKind: this.field?.fieldKind ?? null,
			displayLabel: this.field?.displayLabel ?? "Scalar field",
			quantityName: this.field?.quantityName ?? "scalar field",
			signed: this.field?.surfaceSign !== "positive",
			displayMode: "contour-lines",
			segmentCount: e?.segmentCount ?? 0,
			contourLevels: e?.levels ?? []
		};
	}
	dispose() {
		this.clear(), this.structure = null, this.parent = null;
	}
};
//#endregion
//#region src/lib/disorder-icons.js
function At(e, t) {
	if (t === "all") return e.all;
	if (e[t]) return e[t];
	let n = /^group(\d+)of\d+$/.exec(t)?.[1];
	return n ? jt(e, n) : "";
}
function jt(e, t) {
	let n = e.all.replace(/#000000/g, "#8f8f8f"), r = String(t).length, i = `<text x="8.925192" y="8.925193" text-anchor="middle" dominant-baseline="central" font-size="${r <= 1 ? 9 : Math.max(9 - (r - 1) * 1.5, 5)}" font-family="system-ui, sans-serif" font-weight="bold" fill="#000000">${t}</text>`;
	return n.replace("</svg>", `${i}</svg>`);
}
//#endregion
export { Ye as a, we as c, ue as d, pt as i, M as l, At as n, N as o, kt as r, Te as s, jt as t, j as u };
