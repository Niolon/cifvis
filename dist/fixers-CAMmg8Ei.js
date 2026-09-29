import { C as e, D as t, O as n, T as r, _ as i, a, b as o, c as s, d as c, f as l, g as u, i as d, k as f, n as p, o as m, s as h, t as g, u as _, v, w as y, x as b, y as x } from "./crystal-lXuG9SGp.js";
import { i as S, t as C } from "./bond-classification-7Zs9jDm-.js";
//#region src/lib/formatting.js
function w(e, t, n = 4) {
	if (!isFinite(1 / t)) return T(e, n).toFixed(n);
	let r = Math.floor(Math.log10(t));
	t * 10 ** -r < 2 && --r;
	let i = T(e, -r);
	if (r < 0) {
		let e = Math.round(t / 10 ** r);
		return `${i.toFixed(-r)}(${e})`;
	}
	return `${i}(${T(t, r)})`;
}
function T(e, t) {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}
var E = "₀₁₂₃₄₅₆₇₈₉";
function D(e, t = !1) {
	let n = String(e ?? "");
	if (!t) return {
		element: n,
		nonElement: ""
	};
	let r = n.match(/^([A-Z][a-z]?)(.*)$/);
	if (!r) return {
		element: n,
		nonElement: ""
	};
	let i = r[2].startsWith("(") && r[2].endsWith(")") ? r[2].slice(1, -1) : r[2];
	return {
		element: r[1],
		nonElement: i
	};
}
function O(e, t = !1) {
	let n = String(e ?? "");
	if (!t) return n;
	let r = D(n, !0);
	return r.element + r.nonElement.replace(/\d/g, (e) => E[Number(e)]);
}
//#endregion
//#region src/lib/structure/measurements.js
var k = 180 / Math.PI, A = (e, t) => [
	e.x - t.x,
	e.y - t.y,
	e.z - t.z
], j = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], M = (e, t) => [
	e[1] * t[2] - e[2] * t[1],
	e[2] * t[0] - e[0] * t[2],
	e[0] * t[1] - e[1] * t[0]
], N = (e) => Math.hypot(...e);
function P(e) {
	let t = N(e);
	if (t === 0) throw Error("Cannot measure coincident atoms");
	return e.map((e) => e / t);
}
function F(t, n) {
	if (t.length < 2) throw Error("Select at least two atoms to measure");
	let r = t.map((e) => e.position.toCartesian(n)), i = r.map((e) => [
		e.x,
		e.y,
		e.z
	]), a = t.map((e) => e.label), o = t.map((e) => e.uniqueId);
	if (r.length === 2) return {
		type: "distance",
		value: N(A(r[1], r[0])),
		unit: "Å",
		labels: a,
		points: i,
		atomIds: o
	};
	if (r.length === 3) {
		let e = P(A(r[0], r[1])), t = P(A(r[2], r[1])), n = Math.max(-1, Math.min(1, j(e, t)));
		return {
			type: "angle",
			value: Math.acos(n) * k,
			unit: "°",
			labels: a,
			points: i,
			atomIds: o
		};
	}
	if (r.length === 4) {
		let e = P(A(r[2], r[1])), t = A(r[0], r[1]), n = A(r[3], r[2]), s = P(t.map((n, r) => n - j(t, e) * e[r])), c = P(n.map((t, r) => t - j(n, e) * e[r]));
		return {
			type: "torsion",
			value: Math.atan2(j(M(e, s), c), j(s, c)) * k,
			unit: "°",
			labels: a,
			points: i,
			atomIds: o
		};
	}
	let s = r.slice(0, -1), c = r.at(-1), l = s.reduce((e, t) => ({
		x: e.x + t.x,
		y: e.y + t.y,
		z: e.z + t.z
	}), {
		x: 0,
		y: 0,
		z: 0
	});
	l.x /= s.length, l.y /= s.length, l.z /= s.length;
	let u = [
		[
			0,
			0,
			0
		],
		[
			0,
			0,
			0
		],
		[
			0,
			0,
			0
		]
	];
	for (let e of s) {
		let t = A(e, l);
		for (let e = 0; e < 3; e++) for (let n = 0; n < 3; n++) u[e][n] += t[e] * t[n];
	}
	let d = e(u), f = Math.max(1, Math.abs(d.values.at(-1)));
	if (Math.abs(d.values[1]) <= f * 1e-12) throw Error("Cannot define a mean plane from collinear atoms");
	let p = P(d.eigenvectors[0].vector.toArray()), m = j(A(c, l), p), h = [
		c.x - m * p[0],
		c.y - m * p[1],
		c.z - m * p[2]
	];
	return {
		type: "plane-distance",
		value: Math.abs(j(A(c, l), p)),
		unit: "Å",
		labels: a,
		planeLabels: a.slice(0, -1),
		probeLabel: a.at(-1),
		points: i,
		atomIds: o,
		plane: {
			centroid: [
				l.x,
				l.y,
				l.z
			],
			normal: p,
			projection: h
		}
	};
}
function I(e, t = {}) {
	let n = e.value.toFixed(e.unit === "°" ? 2 : 3);
	if (e.type === "plane-distance") return `${O(e.probeLabel, t.subscriptNonElement)} to mean plane (${e.planeLabels.map((e) => O(e, t.subscriptNonElement)).join(", ")}): ${n} ${e.unit}`;
	let r = e.type === "distance" ? "Distance" : e.type === "angle" ? "Angle" : "Torsion", i = e.unit === "°" ? "" : " ";
	return `${r} ${e.labels.map((e) => O(e, t.subscriptNonElement)).join("–")}: ${n}${i}${e.unit}`;
}
function L(e) {
	if (e < 2) {
		let t = 2 - e;
		return {
			enabled: !1,
			symbol: "↔",
			title: `Select ${t} more atom${t === 1 ? "" : "s"}`
		};
	}
	return e === 2 ? {
		enabled: !0,
		symbol: "↔",
		title: "Measure distance"
	} : e === 3 ? {
		enabled: !0,
		symbol: "∠",
		title: "Measure angle"
	} : e === 4 ? {
		enabled: !0,
		symbol: "∡",
		title: "Measure torsion angle"
	} : {
		enabled: !0,
		symbol: "⏥",
		title: "Measure last atom distance to mean plane"
	};
}
//#endregion
//#region src/lib/fix-cif/reconcile-labels.js
function R(e, t = !0) {
	if (!e || typeof e != "string") throw Error("Empty atom label");
	let n = e.toUpperCase().replace(/[()[\]{}]/g, "");
	if (t && (n = n.replace(/\^[a-zA-Z1-9]+$/, "").replace(/_[a-zA-Z1-9]+$/, "").replace(/_\$\d+$/, "")), n === "") throw Error(`Label "${e}" normalizes to empty string`);
	return n;
}
function z(e, t = !0) {
	let n = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		try {
			let r = R(e, t);
			n.has(r) || n.set(r, []), n.get(r).push(e);
		} catch (e) {
			console.warn(`Skipping invalid label: ${e.message}`);
		}
	});
	let r = /* @__PURE__ */ new Map();
	for (let [e, t] of n.entries()) t.length === 1 ? r.set(e, t[0]) : console.warn(`Multiple labels map to ${e}: ${t.join(", ")}. Skipping mapping.`);
	return r;
}
function B(e, t, n, r = !0) {
	let i = z(n, r), a = e.get(t).map((e) => {
		let t = R(e, r);
		return i.has(t) ? i.get(t) : e;
	});
	e.data[t] = a;
}
//#endregion
//#region src/lib/fix-cif/guess-symmetry.js
function V(e) {
	if (!e || e === ".") return ".";
	let t = String(e).trim();
	if (/^\d+_\d{3}$/.test(t)) return t;
	let n = t.match(/^-?([^\s\-_.]+)[\s-.](\d{3})$/);
	if (n) {
		let e = n[1], t = n[2];
		return n[0].startsWith("-") ? `-${e}_${t}` : `${e}_${t}`;
	}
	if (/^\d{5,6}$/.test(t)) {
		let e = t.slice(0, 3), n = t.slice(-3);
		return Array.from(e).map((e) => Math.abs(parseInt(e) - 5)).reduce((e, t) => e + t, 0) < Array.from(n).map((e) => Math.abs(parseInt(e) - 5)).reduce((e, t) => e + t, 0) ? `${parseInt(t.slice(3))}_${e}` : `${parseInt(t.slice(0, -4))}_${n}`;
	}
	return e;
}
function H(e, t) {
	let n = e.get(t).map((e) => V(e));
	e.data[t] = n;
}
//#endregion
//#region src/lib/fix-cif/base.js
function U(e, t) {
	for (let n of t) if (e.headerLines.includes(n)) return n;
	return null;
}
function ee(e, t) {
	if (U(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"])) return;
	let n = U(e, ["_atom_site.adp_type", "_atom_site_adp_type"]), r = U(e, ["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"]);
	if (!n || !r) return;
	let i = e.get(n), a = e.get(r);
	e.data[n] = i.map((e, t) => {
		let n = Number.isFinite(Number(a[t]));
		return /^uani$/i.test(String(e)) && n ? "Uiso" : e;
	});
}
function te(e, t = !0, n = !0, r = !0) {
	let i, a;
	if ((t || n) && (i = e.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"])), t) {
		let t = e.get("_atom_site_aniso", !1);
		if (t) {
			let e = U(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"]);
			e ? B(t, e, a) : ee(i, t);
		}
	}
	if (n || r) {
		let t = e.get("_geom_bond", !1);
		if (t && (n && (B(t, U(t, ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]), a), B(t, U(t, ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"]), a)), r)) {
			let e = U(t, ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"]);
			e && H(t, e);
			let n = U(t, ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"]);
			n && H(t, n);
		}
		let i = e.get("_geom_hbond", !1);
		if (i) {
			if (n) {
				B(i, U(i, ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]), a);
				let e = U(i, ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"]);
				e && B(i, e, a), B(i, U(i, ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"]), a);
			}
			if (r) {
				let e = U(i, ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"]);
				e && H(i, e);
			}
		}
	}
}
//#endregion
//#region src/lib/structure/structure-modifiers/base.js
var W = class e {
	constructor(t, n, r, i = []) {
		if (new.target === e) throw TypeError("Cannot instantiate BaseFilter directly");
		this.MODES = Object.freeze(t), this.PREFERRED_FALLBACK_ORDER = Object.freeze(i), this.filterName = r, this._mode = null, this.mode = n;
	}
	get requiresCameraUpdate() {
		return !1;
	}
	get drawCell() {
		return !1;
	}
	get mode() {
		return this._mode;
	}
	set mode(e) {
		let t = e.toLowerCase().replace(/_/g, "-"), n = Object.values(this.MODES);
		if (!n.includes(t)) throw Error(`Invalid ${this.filterName} mode: "${e}". Valid modes are: ${n.join(", ")}`);
		this._mode = t;
	}
	ensureValidMode(e) {
		let t = this.getApplicableModes(e);
		t.includes(this.mode) || (this.mode = this.PREFERRED_FALLBACK_ORDER.find((e) => t.includes(e)) || t[0]);
	}
	apply(e) {
		throw Error("Method \"apply\" must be implemented by subclass");
	}
	getApplicableModes(e) {
		throw Error("Method \"getApplicableModes\" must be implemented by subclass");
	}
	cycleMode(e) {
		let t = this.getApplicableModes(e);
		this.ensureValidMode(e);
		let n = t.indexOf(this._mode);
		return this._mode = t[(n + 1) % t.length], this._mode;
	}
};
//#endregion
//#region src/lib/structure/structure-modifiers/growing/util.js
function G(e, t) {
	return `${e}|${t}`;
}
function K(e, t, n) {
	let r = e.split("|"), i = r[0], a = `${n.identitySymOpId}_555`;
	return r.length === 2 && (a = r[1]), G(i, n.combineSymmetryCodes(t, a));
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-fragment.js
function q(e, t) {
	return e < t ? `${e}->${t}` : `${t}->${e}`;
}
function J(e, t, n) {
	return `${e}-${t}...${n}`;
}
var Y = class {
	constructor(e, t) {
		this.groupIndex = e, this.appliedSymmetry = typeof t == "string" ? m.fromString(t) : t;
	}
	isTranslationalDuplicateOf(e) {
		return this.groupIndex === e.groupIndex && this.appliedSymmetry.id === e.appliedSymmetry.id && (this.appliedSymmetry.translation[0] !== e.appliedSymmetry.translation[0] || this.appliedSymmetry.translation[1] !== e.appliedSymmetry.translation[1] || this.appliedSymmetry.translation[2] !== e.appliedSymmetry.translation[2]);
	}
	getSymmetryString() {
		return this.appliedSymmetry.toString();
	}
};
function ne(e, t) {
	return e.groupIndex === t.groupIndex && e.appliedSymmetry.id === t.appliedSymmetry.id && e.appliedSymmetry.translation.every((e, n) => e === t.appliedSymmetry.translation[n]);
}
var re = /* @__PURE__ */ new WeakMap();
function X(e, t, n) {
	let r = re.get(t);
	r || (r = /* @__PURE__ */ new Map(), re.set(t, r));
	let i = `${n.groupIndex}@${n.appliedSymmetry.id}`;
	return r.has(i) || r.set(i, e.symmetry.applySymmetry(n.appliedSymmetry.id, t[n.groupIndex].atoms)), r.get(i);
}
function Z(e, t, n, r) {
	if (n.groupIndex !== r.groupIndex || t[n.groupIndex].atoms.length === 0) return !1;
	let i = X(e, t, n), a = X(e, t, r);
	return i.every((t, n) => v(t.position, a[n].position, e.cell));
}
function ie(e, t) {
	let n = Array.from(e.symmetry.operationIds.keys());
	return t.map((r, i) => {
		let a = /* @__PURE__ */ new Map(), o = [];
		for (let r of n) {
			let n = new Y(i, `${r}_555`), s = o.find((r) => Z(e, t, n, r));
			s ? a.set(r, s.appliedSymmetry.id) : (o.push(n), a.set(r, r));
		}
		return a;
	});
}
var ae = class {
	constructor(e, t, n, r) {
		this.originAtom = e.includes("|") ? e : G(e, "1_555"), this.targetAtom = t.includes("|") ? t : G(t, "1_555"), this.bondLength = n, this.bondLengthSU = r;
	}
}, oe = class {
	constructor(e, t, n, r, i, a) {
		this.originIndex = e, this.originSymmetry = typeof t == "string" ? m.fromString(t) : t, this.targetIndex = n, this.targetSymmetry = typeof r == "string" ? m.fromString(r) : r, this.connectingBonds = i, this.creationOriginIndex = a;
	}
	getKey() {
		let e = this.originSymmetry.key, t = this.targetSymmetry.key;
		return this.originIndex === this.targetIndex ? e < t ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}` : this.originIndex < this.targetIndex ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}`;
	}
};
function se(e, t, n) {
	let r = t.map(() => /* @__PURE__ */ new Map()), i = t.map(() => []);
	return e.bonds.filter((e) => e.atom2SiteSymmetry !== ".").forEach((e) => {
		let t = n.get(e.atom1Id) ?? n.get(e.atom1Label), a = e.atom2Id.split("|")[0], o = `${a}|1_555`, s = n.get(o) ?? n.get(a);
		if (t === void 0 || s === void 0) return;
		let c = `${t}->${s}@.@${e.atom2SiteSymmetry}`;
		if (r[t].has(c)) {
			let n = r[t].get(c);
			i[t][n].bonds.push(new ae(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU));
		} else r[t].set(c, i[t].length), i[t].push({
			targetIndex: s,
			targetSymmetry: m.fromString(e.atom2SiteSymmetry),
			bonds: [new ae(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU)]
		});
	}), i;
}
function ce(e) {
	let t = e.map((e, t) => t), n = (e) => {
		let n = e;
		for (; t[n] !== n;) n = t[n];
		for (; t[e] !== e;) {
			let r = t[e];
			t[e] = n, e = r;
		}
		return n;
	}, r = (e, r) => {
		let i = n(e), a = n(r);
		i !== a && (t[a] = i);
	};
	e.forEach((e, t) => {
		e.forEach((e) => r(t, e.targetIndex));
	});
	let i = /* @__PURE__ */ new Map(), a = t.map((e, t) => {
		let r = n(t);
		return i.has(r) || i.set(r, i.size), i.get(r);
	}), o = Array.from({ length: i.size }, () => []);
	return a.forEach((e, t) => {
		o[e].push(t);
	}), {
		componentByGroup: a,
		groupsByComponent: o
	};
}
function le(e, t, n = null) {
	let r = [], i = /* @__PURE__ */ new Set();
	return e.forEach((e, a) => {
		for (let o of e) {
			let e = new oe(a, t, o.targetIndex, o.targetSymmetry, o.bonds, n?.[a] ?? a), s = e.getKey();
			i.has(s) || (r.push(e), i.add(s));
		}
	}), {
		danglingConnections: r,
		processedConnections: i
	};
}
function ue(e, t, n, r, i, a, o = null, s = null, c = null) {
	let l = [], u = [], d = new Y(e.targetIndex, e.targetSymmetry), f = r[e.targetIndex];
	for (let r of f) {
		let d = (typeof r.targetSymmetry == "string" ? m.fromString(r.targetSymmetry) : r.targetSymmetry).combine(e.targetSymmetry, t.symmetry), f = new oe(e.targetIndex, e.targetSymmetry, r.targetIndex, d, r.bonds, e.creationOriginIndex), p = f.getKey();
		if (i.has(p)) continue;
		i.add(p);
		let h = new Y(r.targetIndex, d), g = e.creationOriginIndex, _ = n[g], v = o?.[g] || [], y = (e) => _.some(e) || v.some(e), b = c?.[h.groupIndex]?.get(h.appliedSymmetry.id) || h.appliedSymmetry.id, x = `${h.groupIndex}|${b}`, S = s?.[g]?.get(x), C = S ? h.isTranslationalDuplicateOf(S) : y((e) => h.isTranslationalDuplicateOf(e)), w = !C && (S ? Z(t, a, h, S) : y((e) => Z(t, a, h, e)));
		C ? u.push(f) : w || (l.push(f), o?.[g].push(h), s?.[g].set(x, h));
	}
	return {
		newConnectedGroup: d,
		newDanglingConnections: l,
		foundTranslations: u
	};
}
function de(e, t) {
	let n = /* @__PURE__ */ new Map();
	t.forEach((e, t) => {
		e.atoms.forEach((e) => n.set(e.uniqueId, t));
	});
	let r = m.fromString(e.symmetry.identitySymOpId + "_555"), i = se(e, t, n), { componentByGroup: a, groupsByComponent: o } = ce(i), s = ie(e, t), { danglingConnections: c, processedConnections: l } = le(i, r, a), u = c.length, d = [], f = [], p = o.map(() => []), h = o.map(() => []), g = o.map(() => /* @__PURE__ */ new Map());
	t.forEach((e, t) => {
		let n = a[t], i = new Y(t, r);
		p[n].push(i);
		let o = s[t].get(r.id) || r.id;
		g[n].set(`${t}|${o}`, i);
	});
	let _ = 0;
	for (; _ < c.length;) {
		let n = c[_++], r = new Y(n.targetIndex, n.targetSymmetry), a = n.creationOriginIndex, o = h[a], m = o.findIndex((e) => ne(e, r));
		m !== -1 && o.splice(m, 1);
		let v = p[a], y = s[r.groupIndex].get(r.appliedSymmetry.id) || r.appliedSymmetry.id, b = `${r.groupIndex}|${y}`, x = g[a].get(b);
		if (x && r.isTranslationalDuplicateOf(x)) {
			f.push(n), _ <= u && d.push(n);
			continue;
		}
		if (!x) v.push(r), g[a].set(b, r);
		else if (!ne(r, x) && Z(e, t, r, x)) {
			_ <= u && d.push(n);
			continue;
		}
		let S = ue(n, e, p, i, l, t, h, g, s);
		c.push(...S.newDanglingConnections), f.push(...S.foundTranslations), d.push(n);
	}
	return {
		networkConnections: d,
		translationLinks: f,
		discoveredGroups: p
	};
}
function fe(e) {
	let t = /* @__PURE__ */ new Set(), n = [];
	return e.forEach((e) => {
		t.add(`${e.originIndex}@.@${e.originSymmetry.key}`), t.add(`${e.targetIndex}@.@${e.targetSymmetry.key}`), e.connectingBonds.forEach((t) => {
			n.push({
				originAtomId: t.originAtom,
				originSymmetry: e.originSymmetry,
				targetAtomId: t.targetAtom,
				targetSymmetry: e.targetSymmetry,
				bondLength: t.bondLength,
				bondLengthSU: t.bondLengthSU
			});
		});
	}), {
		requiredSymmetryInstances: t,
		interGroupBonds: n
	};
}
var pe = /* @__PURE__ */ new WeakMap();
function me(e) {
	let t = pe.get(e);
	if (!t) {
		let n = e.fractToCartMatrix.toArray();
		t = [];
		for (let e = -1; e <= 1; e += 1) for (let r = -1; r <= 1; r += 1) for (let i = -1; i <= 1; i += 1) t.push([
			n[0][0] * e + n[0][1] * r + n[0][2] * i,
			n[1][0] * e + n[1][1] * r + n[1][2] * i,
			n[2][0] * e + n[2][1] * r + n[2][2] * i
		]);
		pe.set(e, t);
	}
	return t;
}
function he(e, t, n, r) {
	let i = o(t.position, n), a = i.map((e) => Math.floor(e / r));
	for (let t = -1; t <= 1; t += 1) for (let n = -1; n <= 1; n += 1) for (let o = -1; o <= 1; o += 1) {
		let s = `${a[0] + t},${a[1] + n},${a[2] + o}`;
		for (let t of e.get(s) || []) if (Math.hypot(t.coordinates[0] - i[0], t.coordinates[1] - i[1], t.coordinates[2] - i[2]) < r) return t.atom;
	}
	for (let a of me(n)) {
		let n = i.map((e, t) => e + a[t]), o = n.map((e) => Math.floor(e / r)).join(","), s = e.get(o) || [];
		s.push({
			atom: t,
			coordinates: n
		}), e.set(o, s);
	}
	return null;
}
function ge(e, t, n, r) {
	let i = X(e, t, new Y(n, r));
	if (i.length === 0) return 0;
	let a = 0, o = 0, s = 0;
	for (let e of i) a += e.position.x, o += e.position.y, s += e.position.z;
	let c = i.length, [l, u, d] = r.translation;
	return Math.abs(a / c + l - .5) + Math.abs(o / c + u - .5) + Math.abs(s / c + d - .5);
}
function _e(e, t = null, n = null) {
	let r = !!(t && n), i = /* @__PURE__ */ new Map();
	for (let a of e) {
		let [e, o] = a.split("@.@"), s = m.fromString(o), c = `${e}|${s.id}`, l = r ? ge(t, n, Number(e), s) : s.translation.reduce((e, t) => e + Math.abs(t), 0), u = i.get(c);
		(!u || l < u.magnitude - 1e-9 || Math.abs(l - u.magnitude) <= 1e-9 && a < u.instance) && i.set(c, {
			instance: a,
			magnitude: l
		});
	}
	return new Set([...i.values()].map((e) => e.instance));
}
function ve(e, t, n, r) {
	let a = t.map((e) => [[...e.atoms]]), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), c = [];
	return e.forEach((e) => {
		let [i, o] = e.split("@.@");
		if (o === r) return;
		let s = Number(i), c = t[s].atoms, l = n.symmetry.applySymmetry(o, c), u = m.fromString(o);
		l.forEach((e) => {
			e.appliedSymmetry = u;
		}), a[s].push(l);
	}), a.forEach((e) => {
		if (e.length > 0 && e[0].length > 0) {
			let t = e[0].length;
			for (let r = 0; r < t; ++r) {
				let t = e.map((e) => e[r]), a = /* @__PURE__ */ new Map();
				for (let e = 0; e < t.length; e++) {
					let r = t[e], l = e === 0, u = he(a, r, n.cell, i);
					u ? x(r.position, u.position, n.cell, .001) ? o.set(r.uniqueId, u.uniqueId) : s.add(r.uniqueId) : l || c.push(r);
				}
			}
		}
	}), {
		specialPositionAtoms: o,
		periodicDuplicateAtoms: s,
		newAtoms: c
	};
}
function ye(e, t, n, r, i, a, o = null) {
	let s = [];
	e.forEach((e) => {
		s.push(...e.bonds);
	});
	let c = /* @__PURE__ */ new Set();
	if (s.forEach((e) => {
		c.add(q(e.atom1Id, e.atom2Id));
	}), t.forEach((t) => {
		let [n, i] = t.split("@.@");
		i !== a && e[Number(n)].bonds.forEach((e) => {
			let t = e.atom1Id.split("|")[0], n = e.atom2Id.split("|")[0], a = G(t, i), o = G(n, i), l = r.get(a) || a, u = r.get(o) || o, d = q(l, u);
			c.has(d) || (c.add(d), s.push(new h(l, u, e.bondLength, e.bondLengthSU, ".")));
		});
	}), n.forEach((e) => {
		let t = e.originAtomId || e.originSymmAtom, n = e.targetAtomId || e.targetSymmAtom, i = t.split(/[|@]/)[0], o = n.split(/[|@]/)[0], l = e.originSymmetry || m.fromString(t.split(/[|@]/)[1] || a), u = e.targetSymmetry || m.fromString(n.split(/[|@]/)[1] || a), d = l.key === a ? G(i, a) : G(i, l.key), f = u.key === a ? G(o, a) : G(o, u.key), p = r.get(d) || d, g = r.get(f) || f, _ = p.includes("|") ? p : G(p, a), v = g.includes("|") ? g : G(g, a);
		if (_ === v) return;
		let y = q(_, v);
		c.has(y) || (c.add(y), s.push(new h(_, v, e.bondLength, e.bondLengthSU, ".")));
	}), o) {
		let n = /* @__PURE__ */ new Map(), l = e.map(() => /* @__PURE__ */ new Set([a])), u = new Set(i.map((e) => e.uniqueId).filter(Boolean));
		e.forEach((e, t) => {
			e.atoms.forEach((e) => {
				n.set(e.label, t), u.add(e.uniqueId || G(e.label, a));
			});
		}), t.forEach((e) => {
			let [t, n] = e.split("@.@");
			l[Number(t)]?.add(n);
		}), o.bonds.filter((e) => e.atom2SiteSymmetry !== ".").forEach((e) => {
			let t = n.get(e.atom1Label);
			if (t === void 0) return;
			let i = m.fromString(e.atom2SiteSymmetry);
			for (let n of l[t]) {
				let t = m.fromString(n), a = i.combine(t, o.symmetry), l = G(e.atom1Label, n), d = G(e.atom2Label, a.key), f = r.get(l) || l, p = r.get(d) || d;
				if (f === p || !u.has(f) || !u.has(p)) continue;
				let g = q(f, p);
				c.has(g) || (c.add(g), s.push(new h(f, p, e.bondLength, e.bondLengthSU, ".")));
			}
		});
	}
	return {
		newBonds: s,
		atomLabels: new Set(i.map((e) => e.uniqueId))
	};
}
function be(e, t, n, r, i, a, o) {
	let c = [], l = /* @__PURE__ */ new Set();
	e.hBonds.forEach((e) => {
		let t;
		t = e.acceptorAtomSymmetry === "." || e.acceptorAtomSymmetry === o ? J(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId) : `${J(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId)}@${e.acceptorAtomSymmetry}`, l.has(t) || (l.add(t), c.push(e));
	});
	let u = t.map(() => []);
	return e.hBonds.filter((e) => e.acceptorAtomSymmetry !== ".").forEach((e) => {
		let t = n.get(e.donorAtomId);
		t !== void 0 && u[t].push(e);
	}), r.forEach((n) => {
		let [r, d] = n.split("@.@");
		if (d === o) return;
		let f = Number(r);
		t[f].hBonds.forEach((e) => {
			let t = e.donorAtomId.split("|")[0], n = e.hydrogenAtomId.split("|")[0], r = e.acceptorAtomId.split("|")[0], a = G(t, d), o = G(n, d), u = G(r, d), f = i.get(a) || a, p = i.get(o) || o, m = i.get(u) || u, h = J(f, p, m);
			l.has(h) || (l.add(h), c.push(new s(f, p, m, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".")));
		}), u[f].forEach((t) => {
			let n = t.donorAtomId.split("|")[0], r = t.hydrogenAtomId.split("|")[0], o = G(n, d), u = G(r, d), f = i.get(o) || o, p = i.get(u) || u, m = e.symmetry.combineSymmetryCodes(d, t.acceptorAtomSymmetry), h = t.acceptorAtomId.split("|")[0], g = G(h, m), _ = i.get(g) || g, v, y;
			a.has(_) ? (v = new s(f, p, _, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."), y = J(f, p, _)) : (v = new s(f, p, h, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, m), y = `${J(f, p, h)}@${m}`), l.has(y) || (l.add(y), c.push(v));
		});
	}), c;
}
function xe(e, t, n, r) {
	let i = [];
	return e.forEach((e) => {
		for (let t of e.connectingBonds) {
			let a = t.originAtom.split("|")[0], o = t.targetAtom.split("|")[0], s = G(a, e.originSymmetry.key), c = G(o, e.targetSymmetry.key), l = n.get(s) || s, u = n.get(c) || c, d = u.split("|")[1] || e.targetSymmetry.key, f = q(l, u);
			r.has(f) || (r.add(f), i.push(new h(l, u, t.bondLength, t.bondLengthSU, d)));
		}
	}), i;
}
function Se(e) {
	let t = new p(e.cell, e.atoms, C(e), e.hBonds, e.symmetry), n = t.calculateConnectedGroups(), r = /* @__PURE__ */ new Map();
	n.forEach((e, t) => {
		e.atoms.forEach((e) => {
			r.set(e.uniqueId, t);
		});
	});
	let i = e.symmetry.identitySymOpId + "_555", { networkConnections: a, translationLinks: o } = de(t, n), { requiredSymmetryInstances: s, interGroupBonds: c } = fe(a, e, i), l = _e(s, t, n), { specialPositionAtoms: u, periodicDuplicateAtoms: d, newAtoms: f } = ve(l, n, t, i), m = o.length > 0 || l.size < s.size || d.size > 0, { newBonds: h, atomLabels: g } = ye(n, l, c, u, f, i, t), _ = be(t, n, r, l, u, g, i), v = m ? [] : xe(o, t, u, new Set(h.map((e) => q(e.atom1Id, e.atom2Id))));
	for (let e of v) h.push(e);
	let y = [...t.atoms, ...f], b = h, x = _;
	if (m) {
		let e = new Set(y.map((e) => e.uniqueId));
		b = h.filter((t) => e.has(t.atom1Id) && e.has(t.atom2Id)), x = _.filter((t) => e.has(t.donorAtomId) && e.has(t.hydrogenAtomId) && e.has(t.acceptorAtomId));
	}
	return {
		grownStructure: new p(t.cell, y, b, x, t.symmetry),
		specialPositionAtoms: u
	};
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-cell.js
var Q = 4;
function Ce(e, t) {
	let n = /* @__PURE__ */ new Set([e.identitySymOpId]), r = /* @__PURE__ */ new Set();
	for (let n of t) {
		let t = e.combineSymmetryCodes(n + "_555", e.identitySymOpId + "_555");
		r.add(t.split("_")[0]);
	}
	for (let [t] of e.operationIds) n.has(t) || r.has(t) || n.add(t);
	return n;
}
function we(e) {
	if (e.length === 0) return {
		minX: 0,
		maxX: 1,
		minY: 0,
		maxY: 1,
		minZ: 0,
		maxZ: 1
	};
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity, a = Infinity, o = -Infinity;
	for (let s of e) {
		let { x: e, y: c, z: l } = s.position;
		t = Math.min(t, e), n = Math.max(n, e), r = Math.min(r, c), i = Math.max(i, c), a = Math.min(a, l), o = Math.max(o, l);
	}
	return {
		minX: t,
		maxX: n,
		minY: r,
		maxY: i,
		minZ: a,
		maxZ: o
	};
}
function Te(e) {
	let t = we(e);
	return r([
		(t.minX + t.maxX) / 2,
		(t.minY + t.maxY) / 2,
		(t.minZ + t.maxZ) / 2
	]);
}
function Ee(e, t, n) {
	let r = t.symmetry.identitySymOpId, i = /* @__PURE__ */ new Set();
	for (let t of e.atoms) t.appliedSymmetry ? i.add(t.appliedSymmetry.id) : i.add(r);
	let a = new Set(e.atoms.map((e) => e.uniqueId));
	for (let [e, t] of n) {
		let n = r;
		e.includes("|") && (n = e.split("|")[1].split("_")[0]), a.has(t) && i.add(n);
	}
	return Array.from(i);
}
function De(e, t = 1e-6) {
	let { x: n, y: r, z: i } = e.position;
	return n >= -t && n < 1 - t && r >= -t && r < 1 - t && i >= -t && i < 1 - t;
}
function Oe(e, t = null) {
	let n = ke(t), r = e.position.x.toFixed(n), i = e.position.y.toFixed(n), a = e.position.z.toFixed(n);
	return `${e.label}_x${r}_y${i}_z${a}`;
}
function ke(e) {
	if (!e || ![
		e.a,
		e.b,
		e.c
	].every(Number.isFinite)) return 3;
	let t = Math.max(e.a, e.b, e.c), n = Math.ceil(Math.log10(t / i));
	return Math.min(Math.max(n, 3), 12);
}
function Ae(e, n, i) {
	let { symOp: a, transVector: o } = e.parsePositionCode(n), s = b(b(t(a.rotMatrix, r(i)), a.transVector), o), l = Math.floor(s.get([0])), u = Math.floor(s.get([1])), d = Math.floor(s.get([2])), { id: p, translation: m } = _(n), h = [
		m[0] - l,
		m[1] - u,
		m[2] - d
	];
	return {
		newCentre: f(s, r([
			l,
			u,
			d
		])),
		newString: c(p, h)
	};
}
function je(e, t, n, r, a, o = null) {
	let s = [], c = t.applySymmetry(n, e.atoms);
	for (let l = 0; l < c.length; l++) {
		let u = c[l], d = e.atoms[l], f = n;
		d.appliedSymmetry && d.appliedSymmetry.key !== `${t.identitySymOpId}_555` && (f = t.combineSymmetryCodes(n, d.appliedSymmetry.key)), u.appliedSymmetry = m.fromString(f);
		let p = u.uniqueId;
		if (a && !De(u)) {
			let e = Math.floor(u.position.x), n = Math.floor(u.position.y), i = Math.floor(u.position.z);
			u.position.x -= e, u.position.y -= n, u.position.z -= i, u.appliedSymmetry.translation[0] -= e, u.appliedSymmetry.translation[1] -= n, u.appliedSymmetry.translation[2] -= i, u.appliedSymmetry._updateKey();
			let a = u.uniqueId, o = `${t.identitySymOpId}_${5 - e}${5 - n}${5 - i}`;
			r.atomTranslations.set(p, [a, o]);
		}
		let h = u.uniqueId, g, _ = !1;
		if (o && r.periodicAtomMap) {
			let e = `${u.label}|${u.disorderGroup}`, t = r.periodicAtomMap.get(e) || [], n = t.find((e) => v(u.position, e.atom.position, o, i));
			n ? x(u.position, n.atom.position, o, .001) ? g = n.id : _ = !0 : (t.push({
				atom: u,
				id: h
			}), r.periodicAtomMap.set(e, t));
		} else {
			let e = Oe(u, o);
			g = r.atomMap.get(e), g || r.atomMap.set(e, h);
		}
		g ? r.specialPositionMap.set(h, g) : _ || s.push(u);
	}
	return s;
}
function Me(e, t, n, r) {
	let i = [];
	for (let a of e.internalBonds) {
		let e = K(a.atom1Id, n, t), o = r.specialPositionMap.get(e) || e, s = K(a.atom2Id, n, t), c = r.specialPositionMap.get(s) || s;
		if (o !== c) {
			if (!r.atomTranslations.has(o) && !r.atomTranslations.has(c)) {
				let e = q(o, c);
				if (!r.createdBonds.has(e)) {
					let t = new h(o, c, a.bondLength, a.bondLengthSU, ".");
					i.push(t), r.createdBonds.add(e);
				}
			} else if (r.atomTranslations.has(o) && r.atomTranslations.has(c)) {
				let [e, t] = r.atomTranslations.get(o), [n, s] = r.atomTranslations.get(c);
				if (t === s) {
					let t = q(e, n);
					if (!r.createdBonds.has(t)) {
						let o = new h(e, n, a.bondLength, a.bondLengthSU, ".");
						i.push(o), r.createdBonds.add(t);
					}
				}
			}
		}
	}
	return i;
}
function Ne(e, t, n, r) {
	let i = [];
	for (let a of e.internalHBonds) {
		let e = r.specialPositionMap.get(K(a.donorAtomId, n, t)) || K(a.donorAtomId, n, t), o = r.specialPositionMap.get(K(a.hydrogenAtomId, n, t)) || K(a.hydrogenAtomId, n, t), c;
		if (a.acceptorAtomSymmetry && a.acceptorAtomSymmetry !== ".") {
			let e = `${a.acceptorAtomId.split("|")[0]}|${t.combineSymmetryCodes(n, a.acceptorAtomSymmetry)}`;
			c = r.specialPositionMap.get(e) || e;
		} else c = r.specialPositionMap.get(K(a.acceptorAtomId, n, t)) || K(a.acceptorAtomId, n, t);
		if (!r.atomTranslations.has(e) && !r.atomTranslations.has(o) && !r.atomTranslations.has(c)) {
			let t = J(e, o, c);
			if (!r.createdHBonds.has(t)) {
				let n = new s(e, o, c, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
				r.createdHBonds.add(t), i.push(n);
			}
		} else if (r.atomTranslations.has(e) && r.atomTranslations.has(o) && r.atomTranslations.has(c)) {
			let [t, n] = r.atomTranslations.get(e), [l, u] = r.atomTranslations.get(o), [d, f] = r.atomTranslations.get(c);
			if (n === u && u === f) {
				let e = J(t, l, d);
				if (!r.createdHBonds.has(e)) {
					let n = new s(t, l, d, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
					r.createdHBonds.add(e), i.push(n);
				}
			}
		}
	}
	return i;
}
function Pe(e, t, n, r) {
	let i = [];
	for (let a of e.externalBonds) {
		let e = r.specialPositionMap.get(K(a.atom1Id, n, t)) || K(a.atom1Id, n, t), o = t.combineSymmetryCodes(n, a.atom2SiteSymmetry), s = a.atom2Id.split("|")[0];
		if (r.atomTranslations.has(e)) {
			let n;
			[e, n] = r.atomTranslations.get(e), o = t.combineSymmetryCodes(n, o);
		}
		let c = `${s}|${o}`;
		c = r.specialPositionMap.get(c) || c;
		let l = q(e, c);
		if (!r.createdBonds.has(l)) {
			let t = new h(e, c, a.bondLength, a.bondLengthSU, o);
			i.push(t), r.createdBonds.add(l);
		}
	}
	return i;
}
function Fe(e, t, n, r) {
	let i = [];
	for (let a of e.externalHBonds) {
		let e = r.specialPositionMap.get(K(a.donorAtomId, n, t)) || K(a.donorAtomId, n, t), o = r.specialPositionMap.get(K(a.hydrogenAtomId, n, t)) || K(a.hydrogenAtomId, n, t), c = t.combineSymmetryCodes(n, a.acceptorAtomSymmetry);
		if (r.atomTranslations.has(e) && r.atomTranslations.has(o)) {
			let n;
			[e, n] = r.atomTranslations.get(e);
			let [i, a] = r.atomTranslations.get(o);
			if (n !== a) continue;
			o = i, c = t.combineSymmetryCodes(n, c);
		} else if (r.atomTranslations.has(e) || r.atomTranslations.has(o)) continue;
		let l = `${a.acceptorAtomId.split("|")[0]}|${c}`;
		if (e.split("|")[1] === c) continue;
		let u = J(e, o, l);
		if (!r.createdHBonds.has(u)) {
			let t = new s(e, o, l, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, c);
			i.push(t), r.createdHBonds.add(u);
		}
	}
	return i;
}
function Ie(e, t, n, r, i, a = null) {
	let { newCentre: o, newString: s } = Ae(t, t.combineSymmetryCodes(n, e.symmString), e.groupCentre);
	return {
		atoms: je(e, t, s, r, i, a),
		internalBonds: Me(e, t, s, r),
		internalHBonds: Ne(e, t, s, r),
		externalBonds: Pe(e, t, s, r),
		externalHBonds: Fe(e, t, s, r),
		symmString: s,
		groupCentre: o
	};
}
function Le(e, t = !0, n = null, r = 1) {
	let i;
	if (i = n === null ? /* @__PURE__ */ new Map() : n, e.atoms.length === 0) return new p(e.cell, [], [], [], e.symmetry);
	let a = e.calculateConnectedGroups(), o = a.map((t) => {
		let n = Ee(t, e, i);
		return Array.from(Ce(e.symmetry, n));
	}), l = a.map((t) => e.bonds.filter((e) => e.atom2SiteSymmetry && e.atom2SiteSymmetry !== "." && t.atoms.some((t) => t.label === e.atom1Id.split("|")[0]))), u = a.map((t) => e.hBonds.filter((e) => e.acceptorAtomSymmetry && e.acceptorAtomSymmetry !== "." && t.atoms.some((t) => t.label === e.donorAtomId.split("|")[0]))), d = {
		atomMap: /* @__PURE__ */ new Map(),
		periodicAtomMap: /* @__PURE__ */ new Map(),
		createdBonds: /* @__PURE__ */ new Set(),
		createdHBonds: /* @__PURE__ */ new Set(),
		specialPositionMap: i,
		atomTranslations: /* @__PURE__ */ new Map()
	}, f = [];
	for (let n = 0; n < a.length; n++) {
		let r = a[n], i = o[n], s = Te(r.atoms), c = i[0], p = {
			atoms: r.atoms,
			internalBonds: r.bonds,
			internalHBonds: r.hBonds,
			symmString: `${c}_555`,
			groupCentre: s,
			externalBonds: l[n],
			externalHBonds: u[n]
		};
		for (let n of i) {
			let r = `${n}_555`, i = Ie(p, e.symmetry, r, d, t, e.cell);
			f.push(i);
		}
	}
	let g = [...t ? [] : e.symmetry.applySymmetry(`${e.symmetry.identitySymOpId}_555`, e.atoms).map((t, n) => (t.appliedSymmetry = e.atoms[n].appliedSymmetry?.copy() || null, t)), ...f.flatMap((e) => e.atoms)], v = /* @__PURE__ */ new Map();
	for (let e of g) v.has(e.uniqueId) || v.set(e.uniqueId, e);
	let y = Array.from(v.values()), b = [...t ? [] : e.bonds.map((e) => new h(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry)), ...f.flatMap((e) => e.internalBonds)], x = [...t ? [] : e.hBonds.map((e) => new s(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry)), ...f.flatMap((e) => e.internalHBonds)], S = new Set(y.map((e) => e.uniqueId)), C = (t, n) => {
		if (n[0] === 0 && n[1] === 0 && n[2] === 0) return t;
		let [r, i] = t.split("|"), { id: a, translation: o } = _(i || `${e.symmetry.identitySymOpId}_555`);
		return `${r}|${c(a, [
			o[0] + n[0],
			o[1] + n[1],
			o[2] + n[2]
		])}`;
	};
	f.forEach((e) => {
		e.externalBonds.forEach((e) => {
			let t = d.specialPositionMap.get(e.atom1Id) || e.atom1Id, n = [
				0,
				0,
				0
			];
			if (d.atomTranslations.has(t)) {
				let [e, r] = d.atomTranslations.get(t);
				t = e, n = _(r).translation;
			}
			let r = d.specialPositionMap.get(e.atom2Id) || e.atom2Id, i = C(r, n);
			if (S.has(t) && S.has(i) && t !== i) {
				let n = new h(t, i, e.bondLength, e.bondLengthSU, ".");
				b.push(n);
			} else if (S.has(t)) {
				let n = new h(t, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry);
				b.push(n);
			}
		}), e.externalHBonds.forEach((e) => {
			let t = null, n = d.specialPositionMap.get(e.donorAtomId) || e.donorAtomId;
			S.has(n) || (n = d.specialPositionMap.get(n) || n, d.atomTranslations.has(n) && ([n, t] = d.atomTranslations.get(n)));
			let r = null, i = d.specialPositionMap.get(e.hydrogenAtomId) || e.hydrogenAtomId;
			S.has(i) || (i = d.specialPositionMap.get(i) || i, d.atomTranslations.has(i) && ([i, r] = d.atomTranslations.get(i)));
			let a;
			if (a = !e.acceptorAtomSymmetry || e.acceptorAtomSymmetry === "." ? e.acceptorAtomId : `${e.acceptorAtomId.split("|")[0]}|${e.acceptorAtomSymmetry}`, !S.has(a) && (a = d.specialPositionMap.get(a) || a, d.atomTranslations.has(a))) {
				let [e, n] = d.atomTranslations.get(a);
				t === n && r === n && (a = e);
			}
			if (S.has(n) && S.has(i) && S.has(a)) {
				let t = new s(n, i, a, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".");
				x.push(t);
			} else if (S.has(n) && S.has(i)) {
				let t = new s(n, i, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry);
				x.push(t);
			}
		});
	});
	let w = new Map(y.map((e) => [e.uniqueId, e])), T = /* @__PURE__ */ new Map(), E = (t) => {
		let n = T.get(t.uniqueId);
		return n || (n = t.position.toCartesian(e.cell), T.set(t.uniqueId, n)), n;
	}, D = (e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > Q) return !1;
		let t = w.get(e.atom1Id), n = w.get(e.atom2Id);
		if (!t || !n) return e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		let r = E(t), i = E(n), a = Math.hypot(r.x - i.x, r.y - i.y, r.z - i.z), o = Math.max(.15, e.bondLength * .1);
		return a <= e.bondLength + o;
	}, O = b.filter((e) => {
		let t = S.has(e.atom1Id), n = e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		return t && (S.has(e.atom2Id) || n) && D(e);
	}), k = x.filter((e) => S.has(e.donorAtomId) && S.has(e.hydrogenAtomId)), A = O, j = new p(e.cell, y, A, [], e.symmetry), M = /* @__PURE__ */ new Map();
	for (let t of j.calculateConnectedGroups()) {
		let n = Te(t.atoms).toArray().map((e) => Math.floor(e)), r = n.some((e) => e !== 0);
		for (let i of t.atoms) {
			let t = i.uniqueId;
			if (r) {
				i.position.x -= n[0], i.position.y -= n[1], i.position.z -= n[2];
				let t = i.appliedSymmetry ? i.appliedSymmetry.copy() : new m(e.symmetry.identitySymOpId, [
					0,
					0,
					0
				]);
				t.translation[0] -= n[0], t.translation[1] -= n[1], t.translation[2] -= n[2], t._updateKey(), i.appliedSymmetry = t;
			}
			M.set(t, i.uniqueId);
		}
	}
	let N = [], P = /* @__PURE__ */ new Map(), F = /* @__PURE__ */ new Map(), I = /* @__PURE__ */ new Map();
	for (let t of y) {
		let n = Oe(t, e.cell), r = F.get(t.uniqueId) || P.get(n);
		r ? I.set(t.uniqueId, r) : (P.set(n, t.uniqueId), F.set(t.uniqueId, t.uniqueId), N.push(t));
	}
	for (let [e, t] of M) M.set(e, I.get(t) || t);
	let L = [], R = /* @__PURE__ */ new Set();
	for (let e of O) {
		let t = M.get(e.atom1Id) || e.atom1Id, n = M.get(e.atom2Id) || e.atom2Id;
		if (t === n) continue;
		let r = q(t, n);
		R.has(r) || (e.atom1Id = t, e.atom2Id = n, L.push(e), R.add(r));
	}
	let z = [], B = /* @__PURE__ */ new Set();
	for (let e of k) {
		e.donorAtomId = M.get(e.donorAtomId) || e.donorAtomId, e.hydrogenAtomId = M.get(e.hydrogenAtomId) || e.hydrogenAtomId, e.acceptorAtomId = M.get(e.acceptorAtomId) || e.acceptorAtomId;
		let t = J(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId);
		B.has(t) || (z.push(e), B.add(t));
	}
	let V = new p(e.cell, N, L, z, e.symmetry), H = t && r > 1 ? Re(V, r, e.bonds) : V, U = t && r > 1 ? new Map(H.atoms.map((e) => [e.uniqueId, e])) : null, ee = t && r > 1 ? H.bonds.filter((t) => {
		if (!Number.isFinite(t.bondLength) || t.bondLength > Q) return !1;
		let n = U.get(t.atom1Id), r = U.get(t.atom2Id);
		if (!n || !r) return !1;
		let i = n.position.toCartesian(e.cell), a = r.position.toCartesian(e.cell), o = Math.hypot(i.x - a.x, i.y - a.y, i.z - a.z);
		return Math.abs(o - t.bondLength) <= Math.max(.15, t.bondLength * .1);
	}) : H.bonds;
	return new p(e.cell, H.atoms, ee, H.hBonds, e.symmetry);
}
function Re(e, t, n = []) {
	let r = t - 1;
	if (!(r > 0)) return e;
	let i = [], a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
	for (let t of e.atoms) {
		let e = a.get(t.uniqueId) || [];
		e.push(t), a.set(t.uniqueId, e);
		let n = o.get(t.label) || [];
		n.push(t), o.set(t.label, n);
	}
	for (let t of e.atoms) {
		let { x: n, y: c, z: l } = t.position, d = [];
		if (n < r && d.push(0), c < r && d.push(1), l < r && d.push(2), d.length !== 0) for (let r = 1; r < 1 << d.length; r++) {
			let f = [
				0,
				0,
				0
			];
			for (let e = 0; e < d.length; e++) r & 1 << e && (f[d[e]] = 1);
			let p = new u(n + f[0], c + f[1], l + f[2]), h = (t.appliedSymmetry ? t.appliedSymmetry.copy() : null) || new m(e.symmetry.identitySymOpId, [
				0,
				0,
				0
			]);
			h.translation[0] += f[0], h.translation[1] += f[1], h.translation[2] += f[2], h._updateKey();
			let _ = new g(t.label, t.atomType, p, t.adp, t.disorderGroup, h);
			i.push(_), a.get(t.uniqueId).push(_), o.get(t.label).push(_), s.add(_.uniqueId);
		}
	}
	let c = /* @__PURE__ */ new Set();
	for (let t of e.bonds) c.add(q(t.atom1Id, t.atom2Id));
	let l = [], d = (t, n, r) => {
		if (!Number.isFinite(r.bondLength) || r.bondLength > Q) return !1;
		let i = t.position.toCartesian(e.cell), a = n.position.toCartesian(e.cell), o = Math.hypot(i.x - a.x, i.y - a.y, i.z - a.z);
		return Math.abs(o - r.bondLength) <= Math.max(.15, r.bondLength * .1);
	};
	for (let t of [...e.bonds, ...n]) {
		let e = a.get(t.atom1Id) || o.get(t.atom1Label), n = a.get(t.atom2Id) || o.get(t.atom2Label);
		if (!(!e || !n)) for (let r of e) for (let e of n) {
			if (r.uniqueId === e.uniqueId || !s.has(r.uniqueId) && !s.has(e.uniqueId) || !d(r, e, t)) continue;
			let n = q(r.uniqueId, e.uniqueId);
			c.has(n) || (l.push(new h(r.uniqueId, e.uniqueId, t.bondLength, t.bondLengthSU, ".")), c.add(n));
		}
	}
	return new p(e.cell, [...e.atoms, ...i], [...e.bonds, ...l], e.hBonds, e.symmetry);
}
function ze(e, t) {
	let n = t - 1;
	if (!(n > 0)) return e;
	let r = [...e.bonds, ...e.hBonds.map((e) => new h(e.donorAtomId, e.hydrogenAtomId, null, null, "."))], i = new p(e.cell, e.atoms, r, [], e.symmetry), a = [], o = [], s = new Set(e.bonds.map((e) => q(e.atom1Id, e.atom2Id)));
	for (let t of i.calculateConnectedGroups()) {
		let r = Te(t.atoms).toArray(), i = [];
		for (let e = 0; e < 3; e++) r[e] < n && i.push(e);
		if (i.length !== 0) for (let n = 1; n < 1 << i.length; n++) {
			let r = [
				0,
				0,
				0
			];
			for (let e = 0; e < i.length; e++) n & 1 << e && (r[i[e]] = 1);
			let c = /* @__PURE__ */ new Map();
			for (let n of t.atoms) {
				let t = new u(n.position.x + r[0], n.position.y + r[1], n.position.z + r[2]), i = (n.appliedSymmetry ? n.appliedSymmetry.copy() : null) || new m(e.symmetry.identitySymOpId, [
					0,
					0,
					0
				]);
				i.translation[0] += r[0], i.translation[1] += r[1], i.translation[2] += r[2], i._updateKey();
				let o = new g(n.label, n.atomType, t, n.adp, n.disorderGroup, i);
				c.set(n.uniqueId, o.uniqueId), a.push(o);
			}
			for (let t of e.bonds) {
				let e = c.get(t.atom1Id), n = c.get(t.atom2Id);
				if (!e || !n || e === n) continue;
				let r = q(e, n);
				s.has(r) || (o.push(new h(e, n, t.bondLength, t.bondLengthSU, ".")), s.add(r));
			}
		}
	}
	return new p(e.cell, [...e.atoms, ...a], [...e.bonds, ...o], e.hBonds, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-hbonds.js
var Be = /* @__PURE__ */ new WeakMap(), Ve = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap();
function $(e) {
	return `${Math.round(e.x * 1e8)},${Math.round(e.y * 1e8)},${Math.round(e.z * 1e8)}`;
}
function Ue(e, t) {
	let n = Ve.get(e);
	return n || (n = /* @__PURE__ */ new Map(), Ve.set(e, n)), n.has(t) || n.set(t, e.invertPositionCode(t)), n.get(t);
}
function We(e, t, n) {
	let r = Be.get(e.symmetry);
	r || (r = /* @__PURE__ */ new Map(), Be.set(e.symmetry, r));
	let i = $(t.position), a = `code|${i}|${n}`;
	if (r.has(a)) return r.get(a);
	let o = e.symmetry.applySymmetry(n, [t])[0].position, s = `position|${i}|${$(o)}`;
	if (r.has(s)) {
		let e = r.get(s);
		return r.set(a, e), e;
	}
	let c = [
		o.x,
		o.y,
		o.z
	], l = [
		t.position.x,
		t.position.y,
		t.position.z
	], u = [];
	for (let [t, n] of e.symmetry.operationIds) {
		let r = e.symmetry.symmetryOperations[n].applyToPoint(l), i = c.map((e, t) => e - r[t]);
		i.every((e) => Math.abs(e - Math.round(e)) < 1e-5) && u.push(new m(t, i.map((e) => Math.round(e))).key);
	}
	return r.set(s, u), r.set(a, u), u;
}
function Ge(e, t, n, r, i) {
	let a = He.get(e.symmetry);
	a || (a = /* @__PURE__ */ new Map(), He.set(e.symmetry, a));
	let o = [
		t.donorAtomLabel,
		t.hydrogenAtomLabel,
		t.acceptorAtomLabel,
		$(n.position),
		$(r.position),
		i.join(",")
	].join("|");
	if (a.has(o)) return a.get(o);
	let s = [], c = /* @__PURE__ */ new Set();
	for (let t of i) {
		let i = Ue(e.symmetry, t), [a, o] = e.symmetry.applySymmetry(i, [n, r]), l = `${$(a.position)},${$(o.position)}`;
		c.has(l) || (c.add(l), s.push({
			inverseSymmetry: i,
			positionKey: l
		}));
	}
	return a.set(o, s), s;
}
function Ke(e, t) {
	let n = new Map(e.atoms.map((e) => [e.uniqueId, e])), r = /* @__PURE__ */ new Map();
	for (let i of t) {
		let t = n.get(i.atom1Id), a = n.get(i.atom2Id);
		if (!t || !a) {
			t && i.atom2SiteSymmetry && i.atom2SiteSymmetry !== "." && r.set(`${i.atom1Id}|${i.atom2Id}`, i);
			continue;
		}
		if (!Number.isFinite(i.bondLength) || i.bondLength > 4) continue;
		let o = t.position.toCartesian(e.cell), s = a.position.toCartesian(e.cell), c = Math.hypot(o.x - s.x, o.y - s.y, o.z - s.z);
		if (Math.abs(c - i.bondLength) <= Math.max(.15, i.bondLength * .1)) {
			let e = [i.atom1Id, i.atom2Id].sort().join("|");
			r.has(e) || r.set(e, i);
		}
	}
	return Array.from(r.values());
}
function qe(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.atoms) t.has(n.label) || t.set(n.label, []), t.get(n.label).push(n);
	let n = /* @__PURE__ */ new Map();
	for (let t of e.atoms) {
		let r = t.position.toCartesian(e.cell);
		n.set(t, [
			r.x,
			r.y,
			r.z
		]);
	}
	let r = (e, t) => {
		let r = n.get(e), i = n.get(t);
		return Math.hypot(r[0] - i[0], r[1] - i[1], r[2] - i[2]);
	}, i = (e) => Math.max(.15, e * .1), a = (e, t) => !Number.isFinite(t) || Math.abs(e - t) <= i(t), o = e.hBonds.reduce((e, t) => Math.max(e, Number.isFinite(t.donorAcceptorDistance) ? t.donorAcceptorDistance : 0, Number.isFinite(t.acceptorHydrogenDistance) ? t.acceptorHydrogenDistance : 0, Number.isFinite(t.donorHydrogenDistance) ? t.donorHydrogenDistance : 0), 0), c = o + i(o) || 4, l = /* @__PURE__ */ new Map(), u = (e, t, n) => `${e},${t},${n}`, d = (e) => {
		let r = l.get(e);
		if (r) return r;
		r = /* @__PURE__ */ new Map();
		for (let i of t.get(e) || []) {
			let [e, t, a] = n.get(i), o = u(Math.floor(e / c), Math.floor(t / c), Math.floor(a / c)), s = r.get(o);
			s ? s.push(i) : r.set(o, [i]);
		}
		return l.set(e, r), r;
	}, f = (e, t) => {
		let r = d(e), [i, a, o] = n.get(t), s = Math.floor(i / c), l = Math.floor(a / c), f = Math.floor(o / c), p = [];
		for (let e = -1; e <= 1; e++) for (let t = -1; t <= 1; t++) for (let n = -1; n <= 1; n++) {
			let i = r.get(u(s + e, l + t, f + n));
			i && p.push(...i);
		}
		return p;
	}, m = [], h = /* @__PURE__ */ new Set();
	for (let n of e.hBonds) {
		let e = t.get(n.donorAtomLabel) || [];
		if (e.length !== 0) {
			for (let t of e) for (let e of f(n.hydrogenAtomLabel, t)) if (a(r(t, e), n.donorHydrogenDistance)) for (let i of f(n.acceptorAtomLabel, e)) {
				if (i === t || i === e || !a(r(e, i), n.acceptorHydrogenDistance) || !a(r(t, i), n.donorAcceptorDistance)) continue;
				let o = `${t.uniqueId}|${e.uniqueId}|${i.uniqueId}`;
				h.has(o) || (h.add(o), m.push(new s(t.uniqueId, e.uniqueId, i.uniqueId, n.donorHydrogenDistance, n.donorHydrogenDistanceSU, n.acceptorHydrogenDistance, n.acceptorHydrogenDistanceSU, n.donorAcceptorDistance, n.donorAcceptorDistanceSU, n.hBondAngle, n.hBondAngleSU, ".")));
			}
		}
	}
	return new p(e.cell, e.atoms, e.bonds, m, e.symmetry);
}
function Je(e, t = /* @__PURE__ */ new Map()) {
	let n = e.calculateConnectedGroups(), r = /* @__PURE__ */ new Map(), i = (e) => {
		let n = t.get(e) || e;
		return r.get(n) || r.get(e) || n;
	}, a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
	n.forEach((e, t) => {
		e.atoms.forEach((e) => {
			o.set(e.uniqueId, t), c.has(e.label) || c.set(e.label, t), a.has(e.label) || a.set(e.label, e);
		});
	});
	let l = [], u = [], d = /* @__PURE__ */ new Set();
	e.hBonds.forEach((t) => {
		if (t.acceptorAtomSymmetry === ".") u.push(t);
		else {
			let n = t.donorAtomId.includes("|") ? t.donorAtomId.split("|")[1].split("_")[0] : e.symmetry.identitySymOpId, r = [
				t.donorAtomLabel,
				t.hydrogenAtomLabel,
				t.acceptorAtomLabel,
				n,
				t.donorHydrogenDistance,
				t.acceptorHydrogenDistance,
				t.donorAcceptorDistance,
				t.hBondAngle
			].join("|");
			d.has(r) || (d.add(r), l.push(t));
		}
	});
	let f = n.map(() => []);
	for (let e of l) {
		let t = o.get(e.donorAtomId);
		t !== void 0 && f[t].push(e);
	}
	let g = /* @__PURE__ */ new Set(), _ = [...e.atoms], v = [...e.bonds], y = new Set(_.map((e) => e.uniqueId)), b = new Map(_.map((e) => [`${e.label}|${$(e.position)}`, e.uniqueId])), x = new Map(e.atoms.map((e) => [e.uniqueId, e])), S = (t) => {
		if (x.has(t)) return x.get(t);
		let [n, r] = t.split("|"), i = a.get(n);
		if (!i || !r) return null;
		let o = e.symmetry.applySymmetry(r, [i])[0];
		return o.appliedSymmetry = m.fromString(r), x.set(t, o), o;
	}, C = (e) => {
		if (y.has(e)) return i(e);
		let t = S(e);
		if (!t) return null;
		let n = `${t.label}|${$(t.position)}`, a = b.get(n);
		return a ? (a !== e && r.set(e, a), a) : (_.push(t), y.add(e), b.set(n, e), e);
	}, w = new Set(v.map((e) => [i(e.atom1Id), i(e.atom2Id)].sort().join("|"))), T = new Set(u.map((e) => `${e.donorAtomId}|${e.hydrogenAtomId}|${e.acceptorAtomId}`)), E = /* @__PURE__ */ new Set(), D = [], O = (e) => {
		let t = C(e.donorAtomId) || e.donorAtomId, n = C(e.hydrogenAtomId) || e.hydrogenAtomId, r = C(e.acceptorAtomId) || e.acceptorAtomId, i = t === e.donorAtomId && n === e.hydrogenAtomId && r === e.acceptorAtomId ? e : new s(t, n, r, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, "."), a = `${t}|${n}|${r}`;
		T.has(a) || (u.push(i), T.add(a));
	}, k = (e) => {
		let t = [e.atom1Id, e.atom2Id].sort().join("|");
		w.has(t) || (v.push(e), w.add(t));
	}, A = (t, a) => {
		let o = `${t}@${a}`;
		if (g.has(o)) return;
		g.add(o);
		let c = n[t], l = e.symmetry.applySymmetry(a, c.atoms), u = /* @__PURE__ */ new Map();
		for (let t = 0; t < l.length; t++) {
			let n = l[t], i = c.atoms[t], o = a;
			i.appliedSymmetry && i.appliedSymmetry.key !== `${e.symmetry.identitySymOpId}_555` && (o = e.symmetry.combineSymmetryCodes(a, i.appliedSymmetry.key)), n.appliedSymmetry = m.fromString(o);
			let s = `${n.label}|${$(n.position)}`, d = b.get(s);
			d ? (d !== n.uniqueId && r.set(n.uniqueId, d), u.set(i.uniqueId, d)) : (y.has(n.uniqueId) || (_.push(n), y.add(n.uniqueId), b.set(s, n.uniqueId)), u.set(i.uniqueId, n.uniqueId));
		}
		c.bonds.filter(({ atom2SiteSymmetry: e }) => e === ".").forEach((e) => {
			let t = u.get(e.atom1Id), n = u.get(e.atom2Id);
			!t || !n || k(new h(i(t), i(n), e.bondLength, e.bondLengthSU, "."));
		}), [...c.hBonds, ...f[t]].forEach((t) => {
			if (t.acceptorAtomSymmetry === ".") {
				O(new s(i(K(t.donorAtomId, a, e.symmetry)), i(K(t.hydrogenAtomId, a, e.symmetry)), i(K(t.acceptorAtomId, a, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
				return;
			}
			D.push(new s(i(K(t.donorAtomId, a, e.symmetry)), i(K(t.hydrogenAtomId, a, e.symmetry)), i(K(t.acceptorAtomId, a, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		});
	};
	for (let t of l) {
		let n = t.acceptorAtomId.split("|")[0], r = t.acceptorAtomId.split("|")[0], l = c.get(r);
		if (l === void 0) throw Error(`Cannot grow H-bond: acceptor atom ${r} is not in the structure`);
		let u = t.acceptorAtomSymmetry;
		A(l, u), O(new s(i(t.donorAtomId), i(t.hydrogenAtomId), i(K(n, t.acceptorAtomSymmetry, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		let d = o.get(t.donorAtomId);
		if (d === void 0) throw Error(`Cannot grow reciprocal H-bond: donor atom ${t.donorAtomId} is not in the structure`);
		let f = We(e, a.get(n), u), p = S(t.donorAtomId), m = S(t.hydrogenAtomId);
		if (!p || !m) throw Error(`Cannot grow reciprocal H-bond: donor or hydrogen atom of ${t.donorAtomId}-${t.hydrogenAtomId} is not in the structure`);
		let h = Ge(e, t, p, m, f);
		for (let { inverseSymmetry: r, positionKey: a } of h) {
			let o = [
				t.donorAtomLabel,
				t.hydrogenAtomLabel,
				n,
				a
			].join("|");
			E.has(o) || (E.add(o), A(d, r), O(new s(i(K(t.donorAtomId, r, e.symmetry)), i(K(t.hydrogenAtomId, r, e.symmetry)), `${n}|${e.symmetry.identitySymOpId}_555`, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, ".")));
		}
	}
	for (let e of D) y.has(e.donorAtomId) && y.has(e.hydrogenAtomId) && y.has(e.acceptorAtomId) && O(e);
	return new p(e.cell, _, v, u, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/modes.js
var Ye = class e extends W {
	static MODES = Object.freeze({
		NONE: "none",
		CONSTANT: "constant",
		ANISOTROPIC: "anisotropic"
	});
	static PREFERRED_FALLBACK_ORDER = [
		e.MODES.ANISOTROPIC,
		e.MODES.CONSTANT,
		e.MODES.NONE
	];
	constructor(t = e.MODES.NONE) {
		super(e.MODES, t, "HydrogenFilter", e.PREFERRED_FALLBACK_ORDER);
	}
	apply(t) {
		if (this.ensureValidMode(t), this.mode === e.MODES.ANISOTROPIC) return t;
		let n = t.atoms.filter((t) => t.atomType !== "H" || this.mode !== e.MODES.NONE).map((t) => new g(t.label, t.atomType, t.position, t.atomType === "H" && this.mode === e.MODES.CONSTANT ? null : t.adp, t.disorderGroup, t.appliedSymmetry)), r = t.bonds.filter((n) => {
			if (this.mode === e.MODES.NONE) {
				if (n.atom2SiteSymmetry !== ".") try {
					let e = t.getAtomById(n.atom1Id), r = t.getAtomById(n.atom2Id);
					return !(e.atomType === "H" || r.atomType === "H");
				} catch {
					return !0;
				}
				try {
					let e = t.getAtomById(n.atom1Id), r = t.getAtomById(n.atom2Id);
					return !(e.atomType === "H" || r.atomType === "H");
				} catch {
					return !0;
				}
			}
			return !0;
		}), i = this.mode === e.MODES.NONE ? [] : t.hBonds;
		return new p(t.cell, n, r, i, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [e.MODES.NONE];
		return t.atoms.some((e) => e.atomType === "H") ? (n.push(e.MODES.CONSTANT), t.atoms.some((e) => e.atomType === "H" && e.adp instanceof l) && n.push(e.MODES.ANISOTROPIC), n) : n;
	}
}, Xe = class e extends W {
	static MODES = Object.freeze({ ALL: "all" });
	static PREFERRED_FALLBACK_ORDER = [e.MODES.ALL];
	static modeForGroup(e, t) {
		return `group${e}of${t}`;
	}
	static parseGroupMode(e) {
		let t = /^group(\d+)of(\d+)$/.exec(e);
		return t ? {
			rank: Number(t[1]),
			total: Number(t[2])
		} : null;
	}
	constructor(t = e.MODES.ALL) {
		super(e.MODES, t, "DisorderFilter", e.PREFERRED_FALLBACK_ORDER), this._groupValuesByRank = [];
	}
	get mode() {
		return this._mode;
	}
	set mode(t) {
		let n = t.toLowerCase().replace(/_/g, "-");
		if (n !== e.MODES.ALL && e.parseGroupMode(n) === null) throw Error(`Invalid DisorderFilter mode: "${t}". Valid modes are: "all" or "group<rank>of<total>" (e.g. "group1of2").`);
		this._mode = n;
	}
	apply(t) {
		this.ensureValidMode(t);
		let n = e.parseGroupMode(this.mode), r = n ? this._groupValuesByRank[n.rank - 1] : null, i = (e) => r === null || Number(e.disorderGroup) === 0 || Number(e.disorderGroup) === r, a = (e) => t.getAtomByLabel(e.split("|")[0]), o = t.atoms.filter(i), s = t.bonds.filter((e) => {
			try {
				let t = a(e.atom1Id), n = a(e.atom2Id);
				return i(t) && i(n);
			} catch {
				return !1;
			}
		}), c = t.hBonds.filter((e) => {
			try {
				let t = a(e.donorAtomId), n = a(e.hydrogenAtomId), r = a(e.acceptorAtomId);
				return i(t) && i(n) && i(r);
			} catch {
				return !1;
			}
		});
		return new p(t.cell, o, s, c, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [...new Set(t.atoms.map((e) => Number(e.disorderGroup)).filter((e) => e > 0))].sort((e, t) => e - t);
		this._groupValuesByRank = n;
		let r = { ALL: e.MODES.ALL };
		return n.forEach((t, i) => {
			r[`GROUP${i + 1}`] = e.modeForGroup(i + 1, n.length);
		}), this.MODES = Object.freeze(r), Object.values(this.MODES);
	}
}, Ze = class e extends W {
	static MODES = Object.freeze({
		NONE: "none",
		HBONDS: "hbonds",
		FRAGMENT: "fragment",
		FRAGMENT_HBONDS: "fragment-hbonds",
		CELL: "cell",
		FRAGMENT_CELL: "fragment-cell"
	});
	static PREFERRED_FALLBACK_ORDER = [e.MODES.FRAGMENT, e.MODES.CELL];
	constructor(t = e.MODES.NONE, n = 1.001) {
		super(e.MODES, t, "SymmetryGrower", e.PREFERRED_FALLBACK_ORDER), this.packingCutoff = n;
	}
	get requiresCameraUpdate() {
		return !0;
	}
	get drawCell() {
		return this.mode === e.MODES.CELL || this.mode === e.MODES.FRAGMENT_CELL;
	}
	apply(t) {
		this.ensureValidMode(t);
		let n = this.mode === e.MODES.NONE ? t : new p(t.cell, t.atoms, C(t), t.hBonds, t.symmetry), r = /* @__PURE__ */ new Map();
		if (this.mode === e.MODES.FRAGMENT || this.mode === e.MODES.FRAGMENT_HBONDS) {
			let e = Se(n);
			n = e.grownStructure, r = e.specialPositionAtoms;
		}
		if (this.mode === e.MODES.CELL) n = Le(n, !0, null, this.packingCutoff);
		else if (this.mode === e.MODES.FRAGMENT_CELL) {
			let e = Se(n);
			r = e.specialPositionAtoms, n = ze(Le(e.grownStructure, !1, r), this.packingCutoff), n = qe(n);
		}
		return (this.mode === e.MODES.HBONDS || this.mode === e.MODES.FRAGMENT_HBONDS) && (this.mode === e.MODES.FRAGMENT_HBONDS && (n = new p(n.cell, n.atoms, Ke(n, n.bonds), n.hBonds, n.symmetry)), n = Je(n, r), this.mode === e.MODES.FRAGMENT_HBONDS && (n = new p(n.cell, n.atoms, Ke(n, n.bonds), n.hBonds, n.symmetry), n = qe(n))), n;
	}
	getApplicableModes(t) {
		let n = [e.MODES.NONE];
		if (!(t.symmetry && t.symmetry.symmetryOperations.length > 0)) return n.push(e.MODES.CELL), n;
		let r = t.bonds.some((e) => e.atom2SiteSymmetry !== ".");
		return r && n.push(e.MODES.FRAGMENT), t.hBonds.some((e) => e.acceptorAtomSymmetry !== ".") && (r ? n.push(e.MODES.FRAGMENT_HBONDS) : n.push(e.MODES.HBONDS)), n.push(e.MODES.CELL), n.push(e.MODES.FRAGMENT_CELL), n;
	}
}, Qe = 2;
function $e(e, t = {}) {
	let n = t.tolerance ?? .05, r = t.maxPlausibleBond ?? 4, i = /* @__PURE__ */ new Map();
	for (let t of e.atoms) {
		let e = i.get(t.label);
		e ? e.push(t) : i.set(t.label, [t]);
	}
	let a = e.cell.fractToCartMatrix.toArray(), o = (e) => [
		a[0][0] * e[0] + a[0][1] * e[1] + a[0][2] * e[2],
		a[1][0] * e[0] + a[1][1] * e[1] + a[1][2] * e[2],
		a[2][0] * e[0] + a[2][1] * e[1] + a[2][2] * e[2]
	], s = (e, t) => Math.hypot(e[0] - t[0], e[1] - t[1], e[2] - t[2]), l = (t) => {
		let [n, r] = t.split("|"), a = i.get(n);
		if (!a) return [];
		let o;
		try {
			o = _(r || "1_555");
		} catch {
			return [];
		}
		let s = e.symmetry.operationIds.get(o.id);
		if (s === void 0) return [];
		let c = e.symmetry.symmetryOperations[s];
		return a.map((e) => {
			let t = c.applyToPoint([
				e.position.x,
				e.position.y,
				e.position.z
			]);
			return [
				t[0] + o.translation[0],
				t[1] + o.translation[1],
				t[2] + o.translation[2]
			];
		});
	}, u = (t, r, i, a) => {
		let l = (a) => {
			let l = e.symmetry.operationIds.get(a);
			if (l === void 0) return null;
			let u = null, d = Infinity;
			for (let f of r) {
				let r = e.symmetry.symmetryOperations[l].applyToPoint([
					f.position.x,
					f.position.y,
					f.position.z
				]);
				for (let e = -2; e <= Qe; e++) for (let l = -2; l <= Qe; l++) for (let f = -2; f <= Qe; f++) {
					let p = s(t, o([
						r[0] + e,
						r[1] + l,
						r[2] + f
					]));
					if (Math.abs(p - i) > n) continue;
					let m = Math.abs(e) + Math.abs(l) + Math.abs(f);
					m < d && (d = m, u = c(a, [
						e,
						l,
						f
					]));
				}
			}
			return u;
		};
		if (a) {
			let e = l(a);
			if (e) return e;
		}
		for (let t of e.symmetry.operationIds.keys()) {
			let e = l(t);
			if (e) return e;
		}
		return null;
	}, d = {
		recoded: 0,
		lengthCorrected: 0,
		dropped: 0,
		details: []
	}, f = [];
	for (let t of e.bonds) {
		let e = l(t.atom1Id), a = l(t.atom2Id);
		if (t.bondLength === null || t.bondLength === void 0 || e.length === 0 || a.length === 0) {
			f.push(t);
			continue;
		}
		let c = Infinity, p = o(e[0]);
		for (let n of e) {
			let e = o(n);
			for (let n of a) {
				let r = s(e, o(n));
				Math.abs(r - t.bondLength) < Math.abs(c - t.bondLength) && (c = r, p = e);
			}
		}
		if (Math.abs(c - t.bondLength) <= n) {
			f.push(t);
			continue;
		}
		let m = t.atom2Id.split("|")[0], g = null;
		try {
			g = _(t.atom2Id.split("|")[1] || "1_555").id;
		} catch {
			g = null;
		}
		let v = u(p, i.get(m), t.bondLength, g);
		if (v) {
			d.recoded++, d.details.push(`${t.atom1Id}-${t.atom2Id}: site symmetry corrected to ${v} (stated ${t.bondLength} A, code as written spanned ${c.toFixed(3)} A)`), f.push(new h(t.atom1Id, m, t.bondLength, t.bondLengthSU, v));
			continue;
		}
		if (c <= r) {
			d.lengthCorrected++, d.details.push(`${t.atom1Id}-${t.atom2Id}: length corrected to ${c.toFixed(4)} A (file stated ${t.bondLength} A; no symmetry image reproduces that)`), f.push(new h(t.atom1Id, t.atom2Id, c, t.bondLengthSU, t.atom2SiteSymmetry));
			continue;
		}
		d.dropped++, d.details.push(`${t.atom1Id}-${t.atom2Id}: dropped - stated ${t.bondLength} A matches no symmetry image and the coordinates span ${c.toFixed(3)} A`);
	}
	return {
		structure: new p(e.cell, e.atoms, f, e.hBonds, e.symmetry),
		repairs: d
	};
}
//#endregion
//#region src/lib/structure/structure-modifiers/fixers.js
var et = class e extends W {
	static MODES = Object.freeze({
		ON: "on",
		OFF: "off"
	});
	constructor(t = [], n = e.MODES.OFF) {
		super(e.MODES, n, "AtomLabelFilter", []), this.setFilteredLabels(t);
	}
	get requiresCameraUpdate() {
		return !0;
	}
	_parseRangeExpression(e, t) {
		let [n, r] = e.split(">").map((e) => e.trim());
		if (!n || !r) return console.warn(`Invalid range expression: ${e}`), [];
		if (!t.includes(n)) throw Error(`Range filtering included unknown start label: ${n}`);
		if (!t.includes(r)) throw Error(`Range filtering included unknown end label: ${r}`);
		let i = t.indexOf(n), a = t.indexOf(r);
		return t.slice(i, a + 1);
	}
	setFilteredLabels(e) {
		let t = [];
		typeof e == "string" ? t = e.split(",").map((e) => e.trim()).filter((e) => e) : Array.isArray(e) && (t = e), this.filteredLabels = new Set(t);
	}
	_expandRanges(e) {
		let t = e.atoms.map((e) => e.label), n = /* @__PURE__ */ new Set();
		for (let e of this.filteredLabels) e.includes(">") && !t.includes(e) ? this._parseRangeExpression(e, t).forEach((e) => n.add(e)) : n.add(e);
		return n;
	}
	apply(t) {
		if (this.mode === e.MODES.OFF) return t;
		let n = this._expandRanges(t), r = t.atoms.filter((e) => !n.has(e.label)), i = t.bonds.filter((e) => {
			let r = t.getAtomById(e.atom1Id), i = t.getAtomById(e.atom2Id);
			return !n.has(r.label) && !n.has(i.label);
		}), a = t.hBonds.filter((e) => {
			let r = t.getAtomById(e.donorAtomId), i = t.getAtomById(e.hydrogenAtomId), a = t.getAtomById(e.acceptorAtomId);
			return !n.has(r.label) && !n.has(i.label) && !n.has(a.label);
		});
		return new p(t.cell, r, i, a, t.symmetry);
	}
	getApplicableModes() {
		return Object.values(e.MODES);
	}
}, tt = class e extends W {
	static MODES = Object.freeze({
		KEEP: "keep",
		ADD: "add",
		REPLACE: "replace",
		CREATE: "create",
		IGNORE: "ignore"
	});
	static PREFERRED_FALLBACK_ORDER = [
		e.MODES.KEEP,
		e.MODES.ADD,
		e.MODES.REPLACE,
		e.MODES.CREATE,
		e.MODES.IGNORE
	];
	constructor(t, n, r = e.MODES.KEEP) {
		super(e.MODES, r, "BondGenerator", e.PREFERRED_FALLBACK_ORDER), this.elementProperties = t, this.tolerance = n;
	}
	getTolerance(e, t) {
		return S.has(e) || S.has(t) ? Math.min(this.tolerance, .4) : this.tolerance;
	}
	getMaxBondDistance(e, t, n) {
		let r = n[e]?.radius, i = n[t]?.radius;
		if (!r || !i) throw Error(`Missing radius for element ${r ? t : e}`);
		return r + i + this.getTolerance(e, t);
	}
	generateBonds(e, t) {
		let r = /* @__PURE__ */ new Set(), { cell: i, atoms: o } = e, s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set();
		for (let t of e.bonds) l.add(t.atom1Id), l.add(t.atom2Id);
		o.forEach((e) => {
			let n = e.position.toCartesian(i);
			if (s.set(e.uniqueId, [
				n.x,
				n.y,
				n.z
			]), Object.prototype.hasOwnProperty.call(t, e.atomType) && !c.has(e.atomType)) c.set(e.atomType, e.atomType);
			else if (!c.has(e.atomType)) try {
				c.set(e.atomType, a(e.atomType));
			} catch {
				throw Error(`Missing radius for element ${e.atomType}`);
			}
		});
		let u = 0;
		for (let e of c.values()) for (let n of c.values()) u = Math.max(u, this.getMaxBondDistance(e, n, t));
		let f = u > 0 ? u : 1, p = (e, t, n) => `${e},${t},${n}`, m = /* @__PURE__ */ new Map();
		o.forEach((e, t) => {
			let n = s.get(e.uniqueId), r = Math.floor(n[0] / f), i = Math.floor(n[1] / f), a = Math.floor(n[2] / f), o = p(r, i, a);
			m.has(o) || m.set(o, []), m.get(o).push(t);
		});
		for (let e = 0; e < o.length; e++) {
			let i = o[e], a = s.get(i.uniqueId), u = Math.floor(a[0] / f), g = Math.floor(a[1] / f), _ = Math.floor(a[2] / f);
			for (let f = -1; f <= 1; f++) for (let v = -1; v <= 1; v++) for (let y = -1; y <= 1; y++) {
				let b = m.get(p(u + f, g + v, _ + y));
				if (b) for (let u of b) {
					if (u <= e) continue;
					let f = o[u];
					if ((i.atomType === "H" || f.atomType === "H") && (l.has(i.uniqueId) || l.has(f.uniqueId)) || !d(i, f)) continue;
					let p = s.get(f.uniqueId), m = a[0] - p[0], g = a[1] - p[1], _ = a[2] - p[2], v = this.getMaxBondDistance(c.get(i.atomType), c.get(f.atomType), t);
					if (Math.abs(m) > v || Math.abs(g) > v || Math.abs(_) > v) continue;
					let y = n([
						m,
						g,
						_
					]);
					y <= v && y > 1e-4 && r.add(new h(i.uniqueId, f.uniqueId, y, null, "."));
				}
			}
		}
		return this.generateSymmetryBonds(e, t, c, u, r), r;
	}
	generateSymmetryBonds(e, t, n, r, i) {
		let { cell: a, atoms: o, symmetry: s } = e, l = s?.symmetryOperations;
		if (!l || l.length === 0 || r <= 0) return;
		let u = [];
		for (let [e, t] of s.operationIds.entries()) u[t] = e;
		let f = s.identitySymOpId, p = s.operationIds.get(f), m = a.fractToCartMatrix.toArray(), g = (e) => [
			m[0][0] * e[0] + m[0][1] * e[1] + m[0][2] * e[2],
			m[1][0] * e[0] + m[1][1] * e[1] + m[1][2] * e[2],
			m[2][0] * e[0] + m[2][1] * e[1] + m[2][2] * e[2]
		], _ = g([
			1,
			0,
			0
		]), v = g([
			0,
			1,
			0
		]), b = g([
			0,
			0,
			1
		]), x = y(a.fractToCartMatrix).toArray(), S = [
			0,
			1,
			2
		].map((e) => r * Math.hypot(x[e][0], x[e][1], x[e][2])), C = (e, t) => {
			if (t >= .5) return [
				-1,
				0,
				1
			];
			let n = [0];
			return e < t && n.push(1), e > 1 - t && n.push(-1), n;
		}, w = r, T = (e, t, n) => `${e},${t},${n}`, E = (e) => Math.floor(e / w), D = o.map((e) => [
			e.position.x,
			e.position.y,
			e.position.z
		]), O = Array(o.length), k = /* @__PURE__ */ new Set(), A = [];
		for (let e = 0; e < o.length; e++) {
			let t = Math.floor(D[e][0]), n = Math.floor(D[e][1]), r = Math.floor(D[e][2]), i = g([
				D[e][0] - t,
				D[e][1] - n,
				D[e][2] - r
			]), a = E(i[0]), o = E(i[1]), s = E(i[2]);
			O[e] = {
				hx: t,
				hy: n,
				hz: r,
				homeCart: i,
				ix: a,
				iy: o,
				iz: s
			}, (t !== 0 || n !== 0 || r !== 0) && A.push(e);
			for (let e = -1; e <= 1; e++) for (let t = -1; t <= 1; t++) for (let n = -1; n <= 1; n++) k.add(T(a + e, o + t, s + n));
		}
		let j = /* @__PURE__ */ new Map(), M = Array(o.length), N = (e) => {
			let t = e.join(","), n = j.get(t);
			if (n) return n;
			let r = Array(l.length);
			for (let t = 0; t < l.length; t++) {
				let n = l[t].applyToPoint(e), i = Math.floor(n[0]), a = Math.floor(n[1]), o = Math.floor(n[2]), s = n[0] - i, c = n[1] - a, u = n[2] - o;
				r[t] = {
					opIndex: t,
					image: n,
					fx: i,
					fy: a,
					fz: o,
					wx: s,
					wy: c,
					wz: u,
					wrappedCart: g([
						s,
						c,
						u
					])
				};
			}
			return j.set(t, r), r;
		}, P = /* @__PURE__ */ new Map(), F = o.length <= l.length && o.length * l.length >= 1024, I = F ? /* @__PURE__ */ new Map() : null;
		for (let e = 0; e < o.length; e++) {
			let t = N(D[e]);
			M[e] = t;
			for (let { opIndex: n, fx: r, fy: i, fz: a, wx: o, wy: s, wz: c, wrappedCart: l } of t) for (let t of C(o, S[0])) for (let u of C(s, S[1])) for (let d of C(c, S[2])) {
				let f = -r + t, m = -i + u, h = -a + d;
				if (n === p && f === 0 && m === 0 && h === 0) continue;
				let g = l[0] + t * _[0] + u * v[0] + d * b[0], y = l[1] + t * _[1] + u * v[1] + d * b[1], x = l[2] + t * _[2] + u * v[2] + d * b[2], S = T(E(g), E(y), E(x));
				if (!k.has(S)) continue;
				let C = P.get(S);
				if (C || (C = [], P.set(S, C), F && I.set(S, /* @__PURE__ */ new Set())), F) {
					let n = `${e}|${Math.round((o + t) * 1e10)},${Math.round((s + u) * 1e10)},${Math.round((c + d) * 1e10)}`, r = I.get(S);
					if (r.has(n)) continue;
					r.add(n);
				}
				C.push({
					atomIndex: e,
					opIndex: n,
					tx: f,
					ty: m,
					tz: h,
					fract: [
						o + t,
						s + u,
						c + d
					],
					cartX: g,
					cartY: y,
					cartZ: x
				});
			}
		}
		let L = /* @__PURE__ */ new Set();
		for (let e = 0; e < o.length; e++) {
			let { hx: r, hy: a, hz: s, homeCart: l, ix: p, iy: m, iz: g } = O[e];
			if (r !== 0 || a !== 0 || s !== 0) continue;
			let _ = o[e], v = n.get(_.atomType);
			for (let y = -1; y <= 1; y++) for (let b = -1; b <= 1; b++) for (let x = -1; x <= 1; x++) {
				let S = P.get(T(p + y, m + b, g + x));
				if (S) for (let p of S) {
					let m = p.atomIndex;
					if (e > m) continue;
					let g = o[m];
					if (!d(_, g)) continue;
					let y = this.getMaxBondDistance(v, n.get(g.atomType), t), b = l[0] - p.cartX, x = l[1] - p.cartY, S = l[2] - p.cartZ;
					if (Math.abs(b) > y || Math.abs(x) > y || Math.abs(S) > y) continue;
					let C = b * b + x * x + S * S;
					if (C > y * y || C <= 1e-8) continue;
					let w = Math.sqrt(C), T = p.tx + r, E = p.ty + a, D = p.tz + s, O = u[p.opIndex];
					if (O === f && T === 0 && E === 0 && D === 0) continue;
					let k = `${e}|${m}|${Math.round((p.fract[0] + r) * 1e4)},${Math.round((p.fract[1] + a) * 1e4)},${Math.round((p.fract[2] + s) * 1e4)}`;
					if (L.has(k)) continue;
					L.add(k);
					let A = c(O, [
						T,
						E,
						D
					]);
					`${g.label}|${A}` !== _.uniqueId && i.add(new h(_.uniqueId, g.label, w, null, A));
				}
			}
		}
		for (let e of A) {
			let r = o[e], a = n.get(r.atomType), s = g(D[e]);
			for (let l = e; l < o.length; l++) {
				let p = o[l];
				if (!d(r, p)) continue;
				let m = this.getMaxBondDistance(a, n.get(p.atomType), t);
				for (let { opIndex: t, image: n } of M[l]) {
					let a = u[t], o = Math.round(D[e][0] - n[0]), d = Math.round(D[e][1] - n[1]), y = Math.round(D[e][2] - n[2]), x = g([
						n[0] + o,
						n[1] + d,
						n[2] + y
					]);
					for (let t = -1; t <= 1; t++) for (let u = -1; u <= 1; u++) for (let g = -1; g <= 1; g++) {
						let S = o + t, C = d + u, w = y + g;
						if (a === f && S === 0 && C === 0 && w === 0) continue;
						let T = s[0] - (x[0] + t * _[0] + u * v[0] + g * b[0]), E = s[1] - (x[1] + t * _[1] + u * v[1] + g * b[1]), D = s[2] - (x[2] + t * _[2] + u * v[2] + g * b[2]);
						if (Math.abs(T) > m || Math.abs(E) > m || Math.abs(D) > m) continue;
						let O = T * T + E * E + D * D;
						if (O > m * m || O <= 1e-8) continue;
						let k = `${e}|${l}|${Math.round((n[0] + S) * 1e4)},${Math.round((n[1] + C) * 1e4)},${Math.round((n[2] + w) * 1e4)}`;
						if (L.has(k)) continue;
						L.add(k);
						let A = c(a, [
							S,
							C,
							w
						]);
						`${p.label}|${A}` !== r.uniqueId && i.add(new h(r.uniqueId, p.label, Math.sqrt(O), null, A));
					}
				}
			}
		}
	}
	apply(t) {
		this.ensureValidMode(t);
		let n;
		switch (this.mode) {
			case e.MODES.KEEP: return t;
			case e.MODES.ADD: {
				let e = this.generateBonds(t, this.elementProperties);
				n = [...t.bonds, ...e];
				break;
			}
			case e.MODES.REPLACE:
				n = [...this.generateBonds(t, this.elementProperties)];
				break;
			case e.MODES.CREATE:
				n = [...this.generateBonds(t, this.elementProperties)];
				break;
			case e.MODES.IGNORE:
				n = [...t.bonds];
				break;
			default: return t;
		}
		return new p(t.cell, t.atoms, n, t.hBonds, t.symmetry);
	}
	getApplicableModes(t) {
		return t.bonds.length > 0 ? [
			e.MODES.KEEP,
			e.MODES.ADD,
			e.MODES.REPLACE
		] : [e.MODES.CREATE, e.MODES.IGNORE];
	}
}, nt = class e extends W {
	static MODES = Object.freeze({
		ON: "on",
		OFF: "off"
	});
	static PREFERRED_FALLBACK_ORDER = [e.MODES.ON, e.MODES.OFF];
	constructor(t = e.MODES.OFF, n = 1.1) {
		super(e.MODES, t, "IsolatedHydrogenFixer", e.PREFERRED_FALLBACK_ORDER), this.maxBondDistance = n;
	}
	apply(t) {
		if (this.ensureValidMode(t), this.mode === e.MODES.OFF) return t;
		let n = this.findIsolatedHydrogenAtoms(t);
		if (n.length === 0) return t;
		let r = this.createBondsForIsolatedHydrogens(t, n);
		return new p(t.cell, t.atoms, [...t.bonds, ...r], t.hBonds, t.symmetry);
	}
	findIsolatedHydrogenAtoms(e) {
		let t = /* @__PURE__ */ new Set();
		e.bonds.forEach((e) => {
			t.add(e.atom1Id), t.add(e.atom2Id);
		});
		let n = [];
		return e.atoms.forEach((e, r) => {
			!t.has(e.uniqueId) && e.atomType === "H" && n.push({
				atom: e,
				atomIndex: r
			});
		}), n;
	}
	createBondsForIsolatedHydrogens(e, t) {
		let r = [];
		return t.forEach(({ atom: t, atomIndex: i }) => {
			let a = t.position.toCartesian(e.cell), o = [
				a.x,
				a.y,
				a.z
			];
			if (i > 0) {
				let a = e.atoms[i - 1];
				if (a.atomType !== "H" && d(a, t)) {
					let i = a.position.toCartesian(e.cell), s = n(f(o, [
						i.x,
						i.y,
						i.z
					]));
					if (s <= this.maxBondDistance) {
						r.push(new h(a.uniqueId, t.uniqueId, s, null, "."));
						return;
					}
				}
			}
			let s = !1;
			for (let a = i - 1; a >= 0 && !s; a--) {
				let i = e.atoms[a];
				if (i.atomType === "H" || !d(i, t)) continue;
				let c = i.position.toCartesian(e.cell), l = n(f(o, [
					c.x,
					c.y,
					c.z
				]));
				l <= this.maxBondDistance && (r.push(new h(i.uniqueId, t.uniqueId, l, null, ".")), s = !0);
			}
			if (!s && i < e.atoms.length - 1) for (let a = i + 1; a < e.atoms.length && !s; a++) {
				let i = e.atoms[a];
				if (i.atomType === "H" || !(i.disorderGroup === t.disorderGroup || i.disorderGroup === 0 || t.disorderGroup === 0)) continue;
				let c = i.position.toCartesian(e.cell), l = n(f(o, [
					c.x,
					c.y,
					c.z
				]));
				l <= this.maxBondDistance && (r.push(new h(i.uniqueId, t.uniqueId, l, null, ".")), s = !0);
			}
		}), r;
	}
	getApplicableModes(t) {
		return t.bonds.length === 0 ? [e.MODES.OFF] : this.findIsolatedHydrogenAtoms(t).length > 0 ? [e.MODES.ON] : [e.MODES.OFF];
	}
}, rt = class e extends W {
	static MODES = Object.freeze({
		ON: "on",
		OFF: "off"
	});
	static PREFERRED_FALLBACK_ORDER = [e.MODES.ON, e.MODES.OFF];
	constructor(t = e.MODES.OFF, n = {}) {
		super(e.MODES, t, "BondGeometryFixer", e.PREFERRED_FALLBACK_ORDER), this.options = n, this.lastRepairs = null;
	}
	apply(t) {
		if (this.ensureValidMode(t), this.mode === e.MODES.OFF) return this.lastRepairs = null, t;
		let { structure: n, repairs: r } = $e(t, this.options);
		return this.lastRepairs = r, r.recoded === 0 && r.lengthCorrected === 0 && r.dropped === 0 ? t : n;
	}
	getApplicableModes(t) {
		if (!t?.bonds?.length) return [e.MODES.OFF];
		let { repairs: n } = $e(t, this.options);
		return this.lastRepairs = n, n.recoded > 0 || n.lengthCorrected > 0 || n.dropped > 0 ? [e.MODES.ON, e.MODES.OFF] : [e.MODES.OFF];
	}
};
//#endregion
export { Xe as a, te as c, L as d, D as f, nt as i, I as l, w as m, tt as n, Ye as o, O as p, rt as r, Ze as s, et as t, F as u };
