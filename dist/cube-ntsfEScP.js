import { A as e, C as t, D as n, O as r, S as i, f as a, g as o, l as s, p as c, r as l, t as u, w as d, x as f } from "./crystal-lXuG9SGp.js";
import { t as p } from "./base-BwevIGf3.js";
//#region src/lib/density/cell-matching.js
var m = Object.freeze({
	relativeLength: .001,
	angleDegrees: .05
});
function h(e, t, n = m) {
	for (let r of [
		"a",
		"b",
		"c"
	]) {
		let i = Math.max(Math.abs(t[r]), 1);
		if (Math.abs(e[r] - t[r]) / i > n.relativeLength) return !1;
	}
	for (let r of [
		"alpha",
		"beta",
		"gamma"
	]) if (Math.abs(e[r] - t[r]) > n.angleDegrees) return !1;
	return !0;
}
function g(e, t, n = "Reflection") {
	for (let r of [
		"a",
		"b",
		"c"
	]) {
		let i = Math.max(Math.abs(t[r]), 1);
		if (Math.abs(e[r] - t[r]) / i > m.relativeLength) throw Error(`${n} unit cell does not match the structure (${r})`);
	}
	for (let r of [
		"alpha",
		"beta",
		"gamma"
	]) if (Math.abs(e[r] - t[r]) > m.angleDegrees) throw Error(`${n} unit cell does not match the structure (${r})`);
}
//#endregion
//#region src/lib/density/cif-values.js
function _(e) {
	if (e == null || e === !1 || e === "." || e === "?") return null;
	let t = Number(e);
	return Number.isFinite(t) ? t : null;
}
function v(e, t) {
	for (let n of typeof t == "string" ? [t] : t) try {
		let t = e.get(n, !1);
		if (t && typeof t.get == "function") return t;
	} catch {}
	return null;
}
function y(e, t, n = null) {
	if (!e) return n;
	try {
		return e.get(t, n !== null && n) || n;
	} catch {
		return n;
	}
}
function b(e, t) {
	for (let n of t) try {
		let t = _(e.get(n));
		if (t !== null) return t;
	} catch {}
	return null;
}
function x(e, t) {
	for (let n of t) try {
		let t = e.get(n);
		if (typeof t == "string" && t.trim()) return t;
	} catch {}
	return null;
}
//#endregion
//#region src/lib/density/structure-factor-model.js
var S = 2 * Math.PI, C = -2 * Math.PI ** 2;
function w(t, r, i, o) {
	if (t.adp instanceof c) return { isotropic: t.adp.uiso };
	if (t.adp instanceof a) {
		let [a, s, c, l, u, d] = t.adp.getUCart(r), f = n(n(i, [
			[
				a,
				l,
				u
			],
			[
				l,
				s,
				d
			],
			[
				u,
				d,
				c
			]
		]), e(i)), p = [
			f[0][0],
			f[1][1],
			f[2][2],
			f[0][1],
			f[0][2],
			f[1][2]
		], m = n(e(o), n(f, o));
		return {
			anisotropic: p,
			reciprocalQuadratic: [
				m[0][0],
				m[1][1],
				m[2][2],
				m[0][1],
				m[0][2],
				m[1][2]
			]
		};
	}
	return null;
}
function T(e, t, n) {
	if (!e) return 1;
	if (e.isotropic !== void 0) return Math.exp(C * e.isotropic * t.reciprocalLengthSquared[n]);
	let [r, i, a, o, s, c] = e.reciprocalQuadratic;
	return Math.exp(C * (r * t.hSquared[n] + i * t.kSquared[n] + a * t.lSquared[n] + 2 * o * t.hk[n] + 2 * s * t.hl[n] + 2 * c * t.kl[n]));
}
function E(e, t, n) {
	if (!e) return 1;
	if (e.isotropic !== void 0) return Math.exp(-2 * Math.PI ** 2 * e.isotropic * n);
	let [r, i, a, o, s, c] = e.anisotropic, [l, u, d] = t, f = r * l * l + i * u * u + a * d * d + 2 * o * l * u + 2 * s * l * d + 2 * c * u * d;
	return Math.exp(-2 * Math.PI ** 2 * f);
}
function D(e) {
	return e.map((e) => {
		let t = (e % 1 + 1) % 1, n = Math.abs(t - 1) < 1e-8 ? 0 : t;
		return Math.round(n * 1e8);
	}).join(",");
}
function O(e) {
	return Array.isArray(e) ? e : [
		e.h,
		e.k,
		e.l
	];
}
function k(e, t) {
	let n = e.length, r = new Int32Array(n), i = new Int32Array(n), a = new Int32Array(n), o = new Float64Array(n), s = new Float64Array(n), c = new Float64Array(n), l = new Float64Array(n), u = new Float64Array(n), d = new Float64Array(n), f = new Float64Array(n), p = new Float64Array(n), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), _ = new Int32Array(n), v = new Int32Array(n), y = new Int32Array(n);
	for (let b = 0; b < n; b++) {
		let n = O(e[b]);
		if (n.length < 3 || n.some((e) => !Number.isInteger(e) || e < -2147483648 || e > 2147483647)) throw Error("Structure-factor reflection indices must be 32-bit integers");
		[r[b], i[b], a[b]] = n, o[b] = r[b] ** 2, s[b] = i[b] ** 2, c[b] = a[b] ** 2, l[b] = r[b] * i[b], u[b] = r[b] * a[b], d[b] = i[b] * a[b];
		let x = t[0][0] * r[b] + t[0][1] * i[b] + t[0][2] * a[b], S = t[1][0] * r[b] + t[1][1] * i[b] + t[1][2] * a[b], C = t[2][0] * r[b] + t[2][1] * i[b] + t[2][2] * a[b];
		f[b] = x ** 2 + S ** 2 + C ** 2, p[b] = f[b] / 4, _[b] = A(m, r[b]), v[b] = A(h, i[b]), y[b] = A(g, a[b]);
	}
	return {
		h: r,
		k: i,
		l: a,
		hSquared: o,
		kSquared: s,
		lSquared: c,
		hk: l,
		hl: u,
		kl: d,
		reciprocalLengthSquared: f,
		sSquared: p,
		uniqueH: [...m.keys()],
		uniqueK: [...h.keys()],
		uniqueL: [...g.keys()],
		hTableIndex: _,
		kTableIndex: v,
		lTableIndex: y
	};
}
function A(e, t) {
	let n = e.get(t);
	return n === void 0 && (n = e.size, e.set(t, n)), n;
}
function j(e, t) {
	let n = new Float64Array(2 * t.length);
	for (let r = 0; r < t.length; r++) {
		let i = S * t[r] * e;
		n[2 * r] = Math.cos(i), n[2 * r + 1] = Math.sin(i);
	}
	return n;
}
function M(e) {
	return e instanceof c ? {
		type: "Uiso",
		values: [e.uiso]
	} : e instanceof a ? {
		type: "Uani",
		values: [
			e.u11,
			e.u22,
			e.u33,
			e.u12,
			e.u13,
			e.u23
		]
	} : null;
}
function N(e) {
	return e?.type === "Uiso" ? new c(e.values[0]) : e?.type === "Uani" ? new a(...e.values) : null;
}
function P(e, n) {
	if (e instanceof c) return e.uiso < -1e-10;
	if (!(e instanceof a)) return !1;
	let r = e.getUCart(n);
	return t([
		[
			r[0],
			r[3],
			r[4]
		],
		[
			r[3],
			r[1],
			r[5]
		],
		[
			r[4],
			r[5],
			r[2]
		]
	]).eigenvectors.some((e) => e.value < -1e-10);
}
function F(e, t) {
	let r = t.get("_atom_site"), i = r.get(["_atom_site.label", "_atom_site_label"]), a = r.get(["_atom_site.occupancy", "_atom_site_occupancy"], Array(i.length).fill(1)), s = new Map(i.map((e, t) => [String(e), _(a[t]) ?? 1])), c = d(e.cell.fractToCartMatrix), l = e.atoms.map((e) => {
		let t = e.position instanceof o ? [
			e.position.x,
			e.position.y,
			e.position.z
		] : n(c, [
			e.position.x,
			e.position.y,
			e.position.z
		]);
		return {
			label: e.label,
			atomType: e.atomType,
			position: Array.isArray(t) ? t : t.toArray(),
			adp: M(e.adp),
			occupancy: s.get(String(e.label)) ?? 1
		};
	});
	return {
		cell: Object.fromEntries([
			"a",
			"b",
			"c",
			"alpha",
			"beta",
			"gamma"
		].map((t) => [t, e.cell[t]])),
		atoms: l,
		symmetryOperations: e.symmetry.symmetryOperations.map((e) => ({
			rotation: e.rotMatrix.map((e) => [...e]),
			translation: [...e.transVector]
		})),
		wavelength: b(t, [
			"_diffrn_radiation_wavelength.wavelength",
			"_diffrn_radiation.wavelength",
			"_diffrn_radiation_wavelength"
		])
	};
}
function I(t, r = 0, i = {}) {
	if (typeof t != "string" || t.length === 0) throw Error("Structure-factor calculation requires the coordinate CIF text");
	if (typeof i.resolveAtom != "function") throw Error("Structure-factor calculation requires an atom factor resolver");
	let a = new p(t), c = typeof r == "number" ? a.getBlock(r) : a.getBlockByName(r), m = i.structureModel ?? null, g = m ? new l(m.cell.a, m.cell.b, m.cell.c, m.cell.alpha, m.cell.beta, m.cell.gamma) : l.fromCIF(c);
	if (i.expectedCell && !h(g, i.expectedCell)) throw Error("Structure-factor coordinate CIF cell does not match the reflection cell");
	let v = m?.wavelength ?? b(c, [
		"_diffrn_radiation_wavelength.wavelength",
		"_diffrn_radiation.wavelength",
		"_diffrn_radiation_wavelength"
	]) ?? _(i.wavelength), y = m?.atoms ?? (() => {
		let e = c.get("_atom_site"), t = e.get(["_atom_site.label", "_atom_site_label"]), n = e.get(["_atom_site.occupancy", "_atom_site_occupancy"], Array(t.length).fill(1));
		return t.map((e, t) => ({
			label: e,
			index: t,
			occupancy: n[t]
		}));
	})(), x = [], A = {}, M = [], F = /* @__PURE__ */ new Map();
	for (let e = 0; e < y.length; e++) {
		let t = y[e], n, r = t.index ?? e;
		if (m) n = new u(t.label, t.atomType, new o(...t.position), N(t.adp));
		else try {
			n = u.fromCIF(c, r);
		} catch (e) {
			if (e.message.includes("Dummy atom")) continue;
			throw e;
		}
		let a = i.resolveAtom({
			atom: n,
			index: r,
			block: c,
			wavelength: v
		});
		if (!a || typeof a.scatteringAt != "function") throw Error(`No scattering-factor model for atom ${n.label} (${n.atomType})`);
		let s = a.source ?? "unknown";
		A[s] = (A[s] ?? 0) + 1;
		let l = a.scatteringKey ?? a.scatteringAt, d = F.get(l);
		d === void 0 && (d = M.length, F.set(l, d), M.push({
			scatteringAt: a.scatteringAt,
			exponentialCount: a.exponentialCount ?? 0,
			atoms: []
		})), x.push({
			atom: n,
			occupancy: _(t.occupancy) ?? 1,
			scatteringModelIndex: d
		});
	}
	let I = g.fractToCartMatrix.toArray(), L = d(I), R = e(L), z = Array.isArray(R) ? R : R.toArray(), B = (m?.symmetryOperations ?? s.fromCIF(c).symmetryOperations.map((e) => ({
		rotation: e.rotMatrix,
		translation: e.transVector
	}))).map((e) => ({
		operation: {
			rotation: e.rotation,
			translation: e.translation
		},
		cartesianRotation: n(n(I, e.rotation), L)
	})), V = 0;
	for (let e of x) {
		let t = /* @__PURE__ */ new Set(), r = e.atom.position instanceof o ? [
			e.atom.position.x,
			e.atom.position.y,
			e.atom.position.z
		] : n(L, [
			e.atom.position.x,
			e.atom.position.y,
			e.atom.position.z
		]);
		for (let i of B) {
			let a = f(n(i.operation.rotation, r), i.operation.translation), o = Array.isArray(a) ? a : a.toArray(), s = D(o);
			if (t.has(s)) continue;
			t.add(s);
			let c = {
				position: o,
				occupancy: e.occupancy,
				displacement: w(e.atom, g, i.cartesianRotation, z)
			};
			V++, M[e.scatteringModelIndex].atoms.push(c);
		}
	}
	let H = x.filter((e) => P(e.atom.adp, g)).map((e) => e.atom.label), U = /* @__PURE__ */ new Set(), W = /* @__PURE__ */ new Map(), G = /* @__PURE__ */ new Set(), K = 0, q = 0, J = 0;
	for (let e of M) for (let t of e.atoms) if (U.add(JSON.stringify(t.displacement)), !t.displacement) K++;
	else if (t.displacement.isotropic !== void 0) {
		q++;
		let e = W.get(t.displacement.isotropic);
		e === void 0 && (e = {
			index: W.size,
			atomCount: 0
		}, W.set(t.displacement.isotropic, e)), e.atomCount++, t.displacement.isotropicModelIndex = e.index;
	} else J++, G.add(JSON.stringify(t.displacement.reciprocalQuadratic));
	function ee(e, t, n) {
		let r = z.map((r) => r[0] * e + r[1] * t + r[2] * n), i = r.reduce((e, t) => e + t ** 2, 0), a = i / 4, o = 0, s = 0;
		for (let c = 0; c < M.length; c++) {
			let l = M[c], u = l.scatteringAt(a);
			for (let a of l.atoms) {
				let c = S * (e * a.position[0] + t * a.position[1] + n * a.position[2]), l = a.occupancy * E(a.displacement, r, i), d = Math.cos(c), f = Math.sin(c);
				o += l * (u.real * d - u.imaginary * f), s += l * (u.real * f + u.imaginary * d);
			}
		}
		return {
			real: o,
			imaginary: s
		};
	}
	function te(e) {
		let t = performance.now(), n = k(e, z), r = performance.now() - t, i = e.length, a = performance.now(), o = M.map((e) => {
			let t = new Float64Array(i), r = new Float64Array(i), a = !0;
			for (let o = 0; o < i; o++) {
				let i = e.scatteringAt(n.sSquared[o]);
				t[o] = i.real, r[o] = i.imaginary, a &&= i.imaginary === 0;
			}
			return {
				real: t,
				imaginary: r,
				realOnly: a
			};
		}), s = performance.now() - a, c = new Float64Array(i), l = new Float64Array(i), u = performance.now(), d = [...W.values()].filter((e) => e.atomCount > 1).length, f = [...W.values()].filter((e) => e.atomCount === 1).length, p = d > 0, m = p ? [...W].map(([e, t]) => {
			if (t.atomCount === 1) return null;
			let r = new Float64Array(i);
			for (let t = 0; t < i; t++) r[t] = Math.exp(C * e * n.reciprocalLengthSquared[t]);
			return r;
		}) : null, h = performance.now() - u, g = 0, _ = 0, v = 0, y = p ? d * i : 0;
		for (let e = 0; e < M.length; e++) {
			let t = M[e], r = o[e];
			for (let e of t.atoms) {
				let t = m && e.displacement?.isotropicModelIndex !== void 0 ? m[e.displacement.isotropicModelIndex] : null, a = performance.now(), o = {
					x: j(e.position[0], n.uniqueH),
					y: j(e.position[1], n.uniqueK),
					z: j(e.position[2], n.uniqueL)
				};
				g += performance.now() - a, v += 2 * (n.uniqueH.length + n.uniqueK.length + n.uniqueL.length), e.displacement && (y += t ? 0 : i);
				let s = performance.now();
				for (let a = 0; a < i; a++) {
					let i = 2 * n.hTableIndex[a], s = 2 * n.kTableIndex[a], u = 2 * n.lTableIndex[a], d = o.x[i] * o.y[s] - o.x[i + 1] * o.y[s + 1], f = o.x[i] * o.y[s + 1] + o.x[i + 1] * o.y[s], p = d * o.z[u] - f * o.z[u + 1], m = d * o.z[u + 1] + f * o.z[u], h = e.occupancy * (t ? t[a] : T(e.displacement, n, a));
					if (r.realOnly) {
						let e = h * r.real[a];
						c[a] += e * p, l[a] += e * m;
					} else {
						let e = r.real[a], t = r.imaginary[a];
						c[a] += h * (e * p - t * m), l[a] += h * (e * m + t * p);
					}
				}
				_ += performance.now() - s;
			}
		}
		let b = new Float64Array(i);
		for (let e = 0; e < i; e++) b[e] = c[e] ** 2 + l[e] ** 2;
		let x = M.reduce((e, t) => e + t.exponentialCount * i, 0), S = n.h.byteLength + n.k.byteLength + n.l.byteLength + c.byteLength + l.byteLength + b.byteLength, w = [
			n.hSquared,
			n.kSquared,
			n.lSquared,
			n.hk,
			n.hl,
			n.kl,
			n.reciprocalLengthSquared,
			n.sSquared,
			n.hTableIndex,
			n.kTableIndex,
			n.lTableIndex
		].reduce((e, t) => e + t.byteLength, 0), E = o.reduce((e, t) => e + t.real.byteLength + t.imaginary.byteLength, 0), D = 2 * Float64Array.BYTES_PER_ELEMENT * (n.uniqueH.length + n.uniqueK.length + n.uniqueL.length), O = m?.reduce((e, t) => e + (t?.byteLength ?? 0), 0) ?? 0;
		return {
			h: n.h,
			k: n.k,
			l: n.l,
			real: c,
			imaginary: l,
			fSquared: b,
			diagnostics: {
				backend: "prepared-soa",
				phaseMode: "tables",
				dwfMode: "uiso-vectors",
				dwfVectorReuseEnabled: p,
				reflectionPreparationMs: r,
				scatteringPreparationMs: s,
				dwfPreparationMs: h,
				phaseTablePreparationMs: g,
				accumulationMs: _,
				reflectionCount: i,
				expandedAtomCount: V,
				scatteringModelCount: M.length,
				displacementModelCount: U.size,
				noAdpExpandedAtomCount: K,
				uisoExpandedAtomCount: q,
				uaniExpandedAtomCount: J,
				uniqueUisoCount: W.size,
				sharedUisoModelCount: d,
				uniqueReciprocalUaniTensorCount: G.size,
				uisoDwfExpEvaluationCount: p ? (d + f) * i : q * i,
				uaniDwfExpEvaluationCount: J * i,
				phaseTrigEvaluationCount: v,
				dwfExpEvaluationCount: y,
				cromerMannExpEvaluationCount: x,
				outputBytes: S,
				workBufferBytes: w + E + D + O
			}
		};
	}
	return {
		coefficientAt: ee,
		calculatePrepared: te,
		calculate(e) {
			return e.map((e) => {
				let [t, n, r] = O(e), i = ee(t, n, r);
				return {
					h: t,
					k: n,
					l: r,
					...i,
					amplitude: Math.hypot(i.real, i.imaginary),
					phase: Math.atan2(i.imaginary, i.real) * 180 / Math.PI
				};
			});
		},
		metadata: {
			wavelength: v,
			atomCount: x.length,
			expandedAtomCount: V,
			symmetryOperationCount: B.length,
			scatteringModelCount: M.length,
			displacementModelCount: U.size,
			noAdpExpandedAtomCount: K,
			uisoExpandedAtomCount: q,
			uaniExpandedAtomCount: J,
			uniqueUisoCount: W.size,
			uniqueReciprocalUaniTensorCount: G.size,
			sourceCounts: A,
			npdAdpCount: H.length,
			npdAdpLabels: H
		}
	};
}
//#endregion
//#region src/lib/density/anomalous-dispersion.js
var L = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf".split(" "), R = Object.fromEntries(Object.entries({
	mo: {
		wavelength: .71073,
		real: "0 0 0 0 0 .002 .004 .008 .014 .021 .03 .042 .056 .072 .09 .11 .132 .155 .179 .203 .226 .248 .267 .284 .295 .301 .299 .285 .263 .222 .163 .081 -.03 -.178 -.374 -.652 -1.044 -1.657 -2.951 -2.965 -2.197 -1.825 -1.59 -1.42 -1.287 -1.177 -1.085 -1.005 -.936 -.873 -.816 -.772 -.726 -.684 -.644 -.613 -.588 -.564 -.53 -.535 -.53 -.533 -.542 -.564 -.591 -.619 -.666 -.723 -.795 -.884 -.988 -1.118 -1.258 -1.421 -1.598 -1.816 -2.066 -2.352 -2.688 -3.084 -3.556 -4.133 -4.861 -5.924 -7.444 -8.862 -7.912 -7.62 -7.725 -8.127 -8.96 -10.673 -11.158 -9.725 -8.926 -8.416 -7.99 -7.683",
		imaginary: "0 0 0 0 .001 .002 .003 .006 .01 .016 .025 .036 .052 .071 .095 .124 .159 .201 .25 .306 .372 .446 .53 .624 .729 .845 .973 1.113 1.266 1.431 1.609 1.801 2.007 2.223 2.456 2.713 2.973 3.264 3.542 .56 .621 .688 .759 .836 .919 1.007 1.101 1.202 1.31 1.424 1.546 1.675 1.812 1.958 2.119 2.282 2.452 2.632 2.845 3.018 3.225 3.442 3.669 3.904 4.151 4.41 4.678 4.958 5.248 5.548 5.858 6.185 6.523 6.872 7.232 7.605 7.99 8.388 8.798 9.223 9.659 10.102 10.559 11.042 9.961 10.403 7.754 8.105 8.472 8.87 9.284 9.654 4.148 4.33 4.511 4.697 4.908 5.107"
	},
	cu: {
		wavelength: 1.54184,
		real: "0 0 .001 .003 .008 .017 .029 .047 .069 .097 .129 .165 .204 .244 .283 .319 .348 .366 .365 .341 .285 .189 .035 -.198 -.568 -1.179 -2.464 -2.956 -2.019 -1.612 -1.354 -1.163 -1.011 -.879 -.767 -.665 -.574 -.465 -.386 -.314 -.248 -.191 -.145 -.105 -.077 -.059 -.06 -.079 -.126 -.194 -.287 -.418 -.579 -.783 -1.022 -1.334 -1.716 -2.17 -2.939 -3.431 -4.357 -5.696 -7.718 -9.242 -9.498 -10.423 -12.255 -9.733 -8.488 -7.701 -7.133 -6.715 -6.351 -6.048 -5.79 -5.581 -5.391 -5.233 -5.096 -4.99 -4.883 -4.818 -4.776 -4.756 -4.772 -4.787 -4.833 -4.898 -4.994 -5.091 -5.216 -5.359 -5.529 -5.712 -5.93 -6.176 -6.498 -6.798",
		imaginary: "0 0 0 .001 .004 .009 .018 .032 .053 .083 .124 .177 .246 .33 .434 .557 .702 .872 1.066 1.286 1.533 1.807 2.11 2.443 2.808 3.204 3.608 .509 .589 .678 .777 .886 1.006 1.139 1.283 1.439 1.608 1.82 2.025 2.245 2.482 2.735 3.005 3.296 3.605 3.934 4.282 4.653 5.045 5.459 5.894 6.352 6.835 7.348 7.904 8.46 9.036 9.648 10.535 10.933 11.614 12.32 11.276 11.946 9.242 9.748 3.704 3.937 4.181 4.432 4.693 4.977 5.271 5.577 5.891 6.221 6.566 6.925 7.297 7.686 8.089 8.505 8.93 9.383 9.843 10.317 10.803 11.296 11.799 12.33 12.868 13.409 13.967 14.536 15.087 15.634 16.317 16.93"
	}
}).map(([e, t]) => {
	let n = t.real.trim().split(/\s+/).map(Number), r = t.imaginary.trim().split(/\s+/).map(Number);
	if (n.length !== L.length || r.length !== L.length) throw Error(`Invalid internal anomalous-dispersion table: ${e}`);
	return [e, {
		wavelength: t.wavelength,
		values: new Map(L.map((e, t) => [e, {
			real: n[t],
			imaginary: r[t]
		}]))
	}];
}));
function z(e) {
	let t = String(e).trim().match(/^([A-Za-z]{1,2})/);
	if (!t) return null;
	if (t[1].toUpperCase() === "D") return "H";
	let n = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase();
	return L.includes(n) ? n : null;
}
function B(e, t) {
	if (e.table !== void 0) {
		let t = String(e.table).toLowerCase().replace(/[^a-z]/g, "").slice(0, 2), n = R[t];
		if (!n) throw Error("Anomalous-dispersion table must be \"Cu\" or \"Mo\"");
		return {
			key: t,
			...n
		};
	}
	if (!Number.isFinite(t)) return null;
	let n = _(e.wavelengthTolerance) ?? .005, r = Object.entries(R).find(([, e]) => Math.abs(e.wavelength - t) <= n);
	return r ? {
		key: r[0],
		...r[1]
	} : null;
}
function V(e, t, n = {}) {
	let r = z(e), i = B(n, _(t)), a = r && i?.values.get(r);
	return a ? {
		...a,
		table: i.key,
		wavelength: i.wavelength
	} : null;
}
function H(e, t, n) {
	let r = v(e, t), i = y(r, n), a = y(r, [
		"_atom_site_dispersion.real",
		"_atom_site_dispersion_real",
		"_atom_type_scat.dispersion_real",
		"_atom_type_scat_dispersion_real"
	]), o = y(r, [
		"_atom_site_dispersion.imag",
		"_atom_site_dispersion_imag",
		"_atom_type_scat.dispersion_imag",
		"_atom_type_scat_dispersion_imag"
	]), s = /* @__PURE__ */ new Map();
	if (!i || !a && !o) return s;
	for (let e = 0; e < i.length; e++) s.set(String(i[e]), {
		real: a ? _(a[e]) : null,
		imaginary: o ? _(o[e]) : null
	});
	return s;
}
function U(e, t, n) {
	let r = e.values ?? e.fallbackValues;
	if (!r) return null;
	let i = r[t] ?? r[n];
	return Array.isArray(i) ? {
		real: _(i[0]),
		imaginary: _(i[1])
	} : i && typeof i == "object" ? {
		real: _(i.real ?? i.fPrime),
		imaginary: _(i.imaginary ?? i.fDoublePrime)
	} : null;
}
function W(e, t) {
	return !e && !t ? null : {
		real: e?.real ?? t?.real ?? null,
		imaginary: e?.imaginary ?? t?.imaginary ?? null
	};
}
function G(e, t, n, r, i, a) {
	let o = z(e), s = U(a, e, o), c = W(s, o ? i?.values.get(o) : null), l = r.get(String(e)) ?? r.get(o), u = W(n.get(String(t)), W(l, c));
	if (!u || u.real === null || u.imaginary === null) throw Error(`No complete anomalous-dispersion factors for atom ${t} (${e}); provide them in the CIF or select a supported internal table`);
	let d = n.has(String(t)) ? "site-cif" : l ? "type-cif" : s ? "configured" : "internal";
	return {
		real: u.real,
		imaginary: u.imaginary,
		source: d
	};
}
function K(e, t = 0, n = {}, r = null) {
	let i, a, o, s = I(e, t, {
		expectedCell: r,
		wavelength: n.wavelength,
		structureModel: n.structureModel,
		resolveAtom({ atom: e, block: t, wavelength: r }) {
			i ??= B(n, r), a ??= H(t, ["_atom_site_dispersion"], ["_atom_site_dispersion.label", "_atom_site_dispersion_label"]), o ??= H(t, ["_atom_type", "_atom_type_scat"], ["_atom_type.symbol", "_atom_type_symbol"]);
			let s = G(e.atomType, e.label, a, o, i, n);
			return {
				source: s.source,
				scatteringKey: `${s.real},${s.imaginary}`,
				scatteringAt() {
					return {
						real: s.real,
						imaginary: s.imaginary
					};
				}
			};
		}
	});
	return {
		...s,
		metadata: {
			...s.metadata,
			enabled: !0,
			internalTable: i?.key ?? null
		}
	};
}
//#endregion
//#region src/lib/density/cromer-mann.js
var q = new Map("H 0.493002 0.322912 0.140191 0.04081 10.5109 26.1257 3.14236 57.7997 0.003038\nHe 0.8734 0.6309 0.3112 0.178 9.1037 3.3568 22.9276 0.9821 0.0064\nLi 1.1282 0.7508 0.6175 0.4653 3.9546 1.0524 85.3905 168.261 0.0377\nBe 1.5919 1.1278 0.5391 0.7029 43.6427 1.8623 103.483 0.542 0.0385\nB 2.0545 1.3326 1.0979 0.7068 23.2185 1.021 60.3498 0.1403 -0.1932\nC 2.31 1.02 1.5886 0.865 20.8439 10.2075 0.5687 51.6512 0.2156\nN 12.2126 3.1322 2.0125 1.1663 0.0057 9.8933 28.9975 0.5826 -11.529\nO 3.0485 2.2868 1.5463 0.867 13.2771 5.7011 0.3239 32.9089 0.2508\nF 3.5392 2.6412 1.517 1.0243 10.2825 4.2944 0.2615 26.1476 0.2776\nNe 3.9553 3.1125 1.4546 1.1251 8.4042 3.4262 0.2306 21.7184 0.3515\nNa 4.7626 3.1736 1.2674 1.1128 3.285 8.8422 0.3136 129.424 0.676\nMg 5.4204 2.1735 1.2269 2.3073 2.8275 79.2611 0.3808 7.1937 0.8584\nAl 6.4202 1.9002 1.5936 1.9646 3.0387 0.7426 31.5472 85.0886 1.1151\nSi 6.2915 3.0353 1.9891 1.541 2.4386 32.3337 0.6785 81.6937 1.1407\nP 6.4345 4.1791 1.78 1.4908 1.9067 27.157 0.526 68.1645 1.1149\nS 6.9053 5.2034 1.4379 1.5863 1.4679 22.2151 0.2536 56.172 0.8669\nCl 11.4604 7.1964 6.2556 1.6455 0.0104 1.1662 18.5194 47.7784 -9.5574\nAr 7.4845 6.7723 0.6539 1.6442 0.9072 14.8407 43.8983 33.3929 1.4445\nK 8.2186 7.4398 1.0519 0.8659 12.7949 0.7748 213.187 41.6841 1.4228\nCa 8.6266 7.3873 1.5899 1.0211 10.4421 0.6599 85.7484 178.437 1.3751\nSc 9.189 7.3679 1.6409 1.468 9.0213 0.5729 136.108 51.3531 1.3329\nTi 9.7595 7.3558 1.6991 1.9021 7.8508 0.5 35.6338 116.105 1.2807\nV 10.2971 7.3511 2.0703 2.0571 6.8657 0.4385 26.8938 102.478 1.2199\nCr 10.6406 7.3537 3.324 1.4922 6.1038 0.392 20.2626 98.7399 1.1832\nMn 11.2819 7.3573 3.0193 2.2441 5.3409 0.3432 17.8674 83.7543 1.0896\nFe 11.7695 7.3573 3.5222 2.3045 4.7611 0.3072 15.3535 76.8805 1.0369\nCo 12.2841 7.3409 4.0034 2.3488 4.2791 0.2784 13.5359 71.1692 1.0118\nNi 12.8376 7.292 4.4438 2.38 3.8785 0.2565 12.1763 66.3421 1.0341\nCu 13.338 7.1676 5.6158 1.6735 3.5828 0.247 11.3966 64.8126 1.191\nZn 14.0743 7.0318 5.1652 2.41 3.2655 0.2333 10.3163 58.7097 1.3041\nGa 15.2354 6.7006 4.3591 2.9623 3.0669 0.2412 10.7805 61.4135 1.7189\nGe 16.0816 6.3747 3.7068 3.683 2.8509 0.2516 11.4468 54.7625 2.1313\nAs 16.6723 6.0701 3.4313 4.2779 2.6345 0.2647 12.9479 47.7972 2.531\nSe 17.0006 5.8196 3.9731 4.3543 2.4098 0.2726 15.2372 43.8163 2.8409\nBr 17.1789 5.2358 5.6377 3.9851 2.1723 16.5796 0.2609 41.4328 2.9557\nKr 17.3555 6.7286 5.5493 3.5375 1.9384 16.5623 0.2261 39.3972 2.825\nRb 17.1784 9.6435 5.1399 1.5292 1.7888 17.3151 0.2748 164.934 3.4873\nSr 17.5663 9.8184 5.422 2.6694 1.5564 14.0988 0.1664 132.376 2.5064\nY 17.776 10.2946 5.72629 3.26588 1.4029 12.8006 0.125599 104.354 1.91213\nZr 17.8765 10.948 5.41732 3.65721 1.27618 11.916 0.117622 87.6627 2.06929\nNb 17.6142 12.0144 4.04183 3.53346 1.18865 11.766 0.204785 69.7957 3.75591\nMo 3.7025 17.2356 12.8876 3.7429 0.2772 1.0958 11.004 61.6584 4.3875\nTc 19.1301 11.0948 4.64901 2.71263 0.864132 8.14487 21.5707 86.8472 5.40428\nRu 19.2674 12.9182 4.86337 1.56756 0.80852 8.43467 24.7997 94.2928 5.37874\nRh 19.2957 14.3501 4.73425 1.28918 0.751536 8.21758 25.8749 98.6062 5.328\nPd 19.3319 15.5017 5.29537 0.605844 0.698655 7.98929 25.2052 76.8986 5.26593\nAg 19.2808 16.6885 4.8045 1.0463 0.6446 7.4726 24.6605 99.8156 5.179\nCd 19.2214 17.6444 4.461 1.6029 0.5946 6.9089 24.7008 87.4825 5.0694\nIn 19.1624 18.5596 4.2948 2.0396 0.5476 6.3776 25.8499 92.8029 4.9391\nSn 19.1889 19.1005 4.4585 2.4663 5.8303 0.5031 26.8909 83.9571 4.7821\nSb 19.6418 19.0455 5.0371 2.6827 5.3034 0.4607 27.9074 75.2825 4.5909\nTe 19.9644 19.0138 6.14487 2.5239 4.81742 0.420885 28.5284 70.8403 4.352\nI 20.1472 18.9949 7.5138 2.2735 4.347 0.3814 27.766 66.8776 4.0712\nXe 20.2933 19.0298 8.9767 1.99 3.9282 0.344 26.4659 64.2658 3.7118\nCs 20.3892 19.1062 10.662 1.4953 3.569 0.3107 24.3879 213.904 3.3352\nBa 20.3361 19.297 10.888 2.6959 3.216 0.2756 20.2073 167.202 2.7731\nLa 20.578 19.599 11.3727 3.28719 2.94817 0.244475 18.7726 133.124 2.14678\nCe 21.1671 19.7695 11.8513 3.33049 2.81219 0.226836 17.6083 127.113 1.86264\nPr 22.044 19.6697 12.3856 2.82428 2.77393 0.222087 16.7669 143.644 2.0583\nNd 22.6845 19.6847 12.774 2.85137 2.66248 0.210628 15.885 137.903 1.98486\nPm 23.3405 19.6095 13.1235 2.87516 2.5627 0.202088 15.1009 132.721 2.02876\nSm 24.0042 19.4258 13.4396 2.89604 2.47274 0.196451 14.3996 128.007 2.20963\nEu 24.6274 19.0886 13.7603 2.9227 2.3879 0.1942 13.7546 123.174 2.5745\nGd 25.0709 19.0798 13.8518 3.54545 2.25341 0.181951 12.9331 101.398 2.4196\nTb 25.8976 18.2185 14.3167 2.95354 2.24256 0.196143 12.6648 115.362 3.58324\nDy 26.507 17.6383 14.5596 2.96577 2.1802 0.202172 12.1899 111.874 4.29728\nHo 26.9049 17.294 14.5583 3.63837 2.07051 0.19794 11.4407 92.6566 4.56796\nEr 27.6563 16.4285 14.9779 2.98233 2.07356 0.223545 11.3604 105.703 5.92046\nTm 28.1819 15.8851 15.1542 2.98706 2.02859 0.238849 10.9975 102.961 6.75621\nYb 28.6641 15.4345 15.3087 2.98963 1.9889 0.257119 10.6647 100.417 7.56672\nLu 28.9476 15.2208 15.1 3.71601 1.90182 9.98519 0.261033 84.3298 7.97628\nHf 29.144 15.1726 14.7586 4.30013 1.83262 9.5999 0.275116 72.029 8.58154\nTa 29.2024 15.2293 14.5135 4.76492 1.77333 9.37046 0.295977 63.3644 9.24354\nW 29.0818 15.43 14.4327 5.11982 1.72029 9.2259 0.321703 57.056 9.8875\nRe 28.7621 15.7189 14.5564 5.44174 1.67191 9.09227 0.3505 52.0861 10.472\nOs 28.1894 16.155 14.9305 5.67589 1.62903 8.97948 0.382661 48.1647 11.0005\nIr 27.3049 16.7296 15.6115 5.83377 1.59279 8.86553 0.417916 45.0011 11.4722\nPt 27.0059 17.7639 15.7131 5.7837 1.51293 8.81174 0.424593 38.6103 11.6883\nAu 16.8819 18.5913 25.5582 5.86 0.4611 8.6216 1.4826 36.3956 12.0658\nHg 20.6809 19.0417 21.6575 5.9676 0.545 8.4484 1.5729 38.3246 12.6089\nTl 27.5446 19.1584 15.538 5.52593 0.65515 8.70751 1.96347 45.8149 13.1746\nPb 31.0617 13.0637 18.442 5.9696 0.6902 2.3576 8.618 47.2579 13.4118\nBi 33.3689 12.951 16.5877 6.4692 0.704 2.9238 8.7937 48.0093 13.5782\nPo 34.6726 15.4733 13.1138 7.02588 0.700999 3.55078 9.55642 47.0045 13.677\nAt 35.3163 19.0211 9.49887 7.42518 0.68587 3.97458 11.3824 45.4715 13.7108\nRn 35.5631 21.2816 8.0037 7.4433 0.6631 4.0691 14.0422 44.2473 13.6905\nFr 35.9299 23.0547 12.1439 2.11253 0.646453 4.17619 23.1052 150.645 13.7247\nRa 35.763 22.9064 12.4739 3.21097 0.616341 3.87135 19.9887 142.325 13.6211\nAc 35.6597 23.1032 12.5977 4.08655 0.589092 3.65155 18.599 117.02 13.5266\nTh 35.5645 23.4219 12.7473 4.80703 0.563359 3.46204 17.8309 99.1722 13.4314\nPa 35.8847 23.2948 14.1891 4.17287 0.547751 3.41519 16.9235 105.251 13.4287\nU 36.0228 23.4128 14.9491 4.188 0.5293 3.3253 16.0927 100.613 13.3966\nNp 36.1874 23.5964 15.6402 4.1855 0.511929 3.25396 15.3622 97.4908 13.3573\nPu 36.5254 23.8083 16.7707 3.47947 0.499384 3.26371 14.9455 105.98 13.3812\nAm 36.6706 24.0992 17.3415 3.49331 0.483629 3.20647 14.3136 102.273 13.3592\nCm 36.6488 24.4096 17.399 4.21665 0.465154 3.08997 13.4346 88.4834 13.2887\nBk 36.7881 24.7736 17.8919 4.23284 0.451018 3.04619 12.8946 86.003 13.2754\nCf 36.9185 25.1995 18.3317 4.24391 0.437533 3.00775 12.4044 83.7881 13.2674".split("\n").map((e) => {
	let [t, ...n] = e.trim().split(/\s+/);
	if (n.length !== 9 || n.some((e) => !Number.isFinite(Number(e)))) throw Error(`Invalid internal Cromer-Mann coefficients for ${t}`);
	return [t, n.map(Number)];
}));
function J(e) {
	let t = q.get(e === "D" ? "H" : e);
	return t ? [...t] : null;
}
function ee(e, t) {
	let n = e[8];
	for (let r = 0; r < 4; r++) n += e[r] * Math.exp(-e[r + 4] * t);
	return n;
}
//#endregion
//#region src/lib/density/iam-structure-factors.js
var te = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf".split(" "), ne = [
	"a1",
	"a2",
	"a3",
	"a4",
	"b1",
	"b2",
	"b3",
	"b4",
	"c"
];
function re(e) {
	let t = String(e).trim().match(/^([A-Za-z]{1,2})/);
	if (!t) return null;
	if (t[1].toUpperCase() === "D") return "H";
	let n = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase();
	return te.includes(n) ? n : null;
}
function ie(e) {
	let t = v(e, ["_atom_type", "_atom_type_scat"]), n = y(t, ["_atom_type.symbol", "_atom_type_symbol"]), r = ne.map((e) => y(t, [
		`_atom_type_scat.Cromer_Mann_${e}`,
		`_atom_type_scat_Cromer_Mann_${e}`,
		`_atom_type.scat_Cromer_Mann_${e}`
	])), i = /* @__PURE__ */ new Map();
	if (!n || r.some((e) => !e)) return i;
	for (let e = 0; e < n.length; e++) {
		let t = r.map((t) => _(t[e]));
		if (t.every((e) => e !== null)) {
			let r = String(n[e]);
			i.set(r, t);
			let a = re(r);
			a && !i.has(a) && i.set(a, t);
		}
	}
	return i;
}
function ae(e, t, n) {
	let r = v(e, t), i = y(r, n), a = y(r, [
		"_atom_site_dispersion.real",
		"_atom_site_dispersion_real",
		"_atom_type_scat.dispersion_real",
		"_atom_type_scat_dispersion_real"
	]), o = y(r, [
		"_atom_site_dispersion.imag",
		"_atom_site_dispersion_imag",
		"_atom_type_scat.dispersion_imag",
		"_atom_type_scat_dispersion_imag"
	]), s = /* @__PURE__ */ new Map();
	if (!i || !a && !o) return s;
	for (let e = 0; e < i.length; e++) s.set(String(i[e]), {
		real: a ? _(a[e]) : null,
		imaginary: o ? _(o[e]) : null
	});
	return s;
}
function oe(e, t, n) {
	let r = e.cromerMann?.[t] ?? e.cromerMann?.[n];
	if (!Array.isArray(r) || r.length !== 9) return null;
	let i = r.map(_);
	return i.every((e) => e !== null) ? i : null;
}
function se(e, t, n) {
	let r = e.dispersionValues?.[t] ?? e.dispersionValues?.[n];
	return Array.isArray(r) ? {
		real: _(r[0]),
		imaginary: _(r[1])
	} : r && typeof r == "object" ? {
		real: _(r.real ?? r.fPrime),
		imaginary: _(r.imaginary ?? r.fDoublePrime)
	} : null;
}
function ce(e) {
	return e?.real !== null && e?.real !== void 0 && e?.imaginary !== null && e?.imaginary !== void 0;
}
function le(e, t) {
	return {
		real: e?.real ?? t?.real ?? null,
		imaginary: e?.imaginary ?? t?.imaginary ?? null
	};
}
function ue(e, t = 0, n = {}) {
	let r, i, a, o = n.includeAnomalous !== !1, s = I(e, t, {
		expectedCell: n.expectedCell,
		wavelength: n.wavelength,
		structureModel: n.structureModel,
		resolveAtom({ atom: e, block: t, wavelength: s }) {
			r ??= ie(t), i ??= ae(t, ["_atom_type", "_atom_type_scat"], ["_atom_type.symbol", "_atom_type_symbol"]), a ??= ae(t, ["_atom_site_dispersion"], ["_atom_site_dispersion.label", "_atom_site_dispersion_label"]);
			let c = re(e.atomType), l = r.get(e.atomType) ?? r.get(c), u = oe(n, e.atomType, c), d = l ?? u ?? J(c);
			if (!d) throw Error(`No Cromer-Mann coefficients for atom ${e.label} (${e.atomType})`);
			let f = {
				real: 0,
				imaginary: 0
			}, p = "disabled";
			if (o) {
				let t = a.get(e.label), r = i.get(e.atomType) ?? i.get(c), o = se(n, e.atomType, c), l = le(t, le(r, le(o, V(c, s, n.anomalous ?? {}))));
				ce(l) ? (f = l, p = t ? "site-cif" : r ? "type-cif" : o ? "configured" : "internal") : p = "zero";
			}
			return {
				source: `${l ? "cif" : u ? "configured" : "internal"}/${p}`,
				exponentialCount: 4,
				scatteringKey: JSON.stringify([
					...d,
					f.real,
					f.imaginary
				]),
				scatteringAt(e) {
					return {
						real: ee(d, e) + f.real,
						imaginary: f.imaginary
					};
				}
			};
		}
	});
	return {
		...s,
		metadata: {
			...s.metadata,
			model: "IAM",
			includeAnomalous: o
		}
	};
}
function de(e, t, n = {}) {
	return ue(e, n.cifBlock ?? 0, n).calculate(t);
}
//#endregion
//#region src/lib/density/reciprocal-symmetry.js
var fe = 2 * Math.PI, pe = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap();
function he(e, t, n = 1e-6) {
	return e.map((e) => {
		let r = e[0] * t[0] + e[1] * t[1] + e[2] * t[2], i = Math.round(r);
		if (Math.abs(r - i) > n) throw Error(`Symmetry operation produced a non-integral reflection index: ${r}`);
		return Object.is(i, -0) ? 0 : i;
	});
}
function ge(t) {
	let n = pe.get(t);
	return n || (n = t.symmetryOperations.map((t) => ({
		operation: t,
		reciprocalRotation: e(d(t.rotMatrix)),
		positionReciprocalRotation: e(t.rotMatrix),
		translation: t.transVector
	})), pe.set(t, n)), n;
}
function _e(e, t = 1e-6) {
	let n = Math.round(e);
	if (Math.abs(e - n) > t) throw Error(`Symmetry operation contains a non-integral reciprocal rotation: ${e}`);
	return Object.is(n, -0) ? 0 : n;
}
function ve(e, t) {
	for (; t !== 0;) [e, t] = [t, e % t];
	return e;
}
function ye(e, t = 1e-8, n = 192) {
	for (let r = 1; r <= n; r++) {
		let n = Math.round(e * r);
		if (Math.abs(e - n / r) <= t) return {
			numerator: n,
			denominator: r
		};
	}
	return null;
}
function be(e) {
	let t = [], n = 1;
	for (let r of e) for (let e of r.translation) {
		let r = ye(e);
		if (!r || (t.push(r), n = n * r.denominator / ve(n, r.denominator), !Number.isSafeInteger(n) || n > 4096)) return null;
	}
	let r = new Int32Array(t.length);
	t.forEach((e, t) => {
		r[t] = e.numerator * n / e.denominator;
	});
	let i = new Float64Array(n), a = new Float64Array(n);
	for (let e = 0; e < n; e++) {
		let t = fe * e / n;
		i[e] = Math.cos(t), a[e] = Math.sin(t);
	}
	return {
		denominator: n,
		translationNumerators: r,
		rootReal: i,
		rootImaginary: a
	};
}
function xe(e) {
	let t = me.get(e);
	if (t) return t;
	let n = ge(e), r = new Int32Array(n.length * 9), i = new Int32Array(n.length * 9), a = new Float64Array(n.length * 3);
	return n.forEach((e, t) => {
		let n = t * 9, o = t * 3;
		for (let t = 0; t < 3; t++) {
			for (let a = 0; a < 3; a++) {
				let o = n + t * 3 + a;
				r[o] = _e(e.reciprocalRotation[t][a]), i[o] = _e(e.positionReciprocalRotation[t][a]);
			}
			a[o + t] = e.translation[t];
		}
	}), t = {
		operationCount: n.length,
		reciprocalRotations: r,
		positionReciprocalRotations: i,
		translations: a,
		absencePhases: be(n),
		absenceScratch: {
			h: new Int32Array(n.length),
			k: new Int32Array(n.length),
			l: new Int32Array(n.length),
			real: new Float64Array(n.length),
			imaginary: new Float64Array(n.length)
		}
	}, me.set(e, t), t;
}
function Se(e, t, n, r, i = !0) {
	let a = xe(r), o = a.reciprocalRotations, s = Infinity, c = Infinity, l = Infinity;
	for (let r = 0; r < a.operationCount; r++) {
		let a = r * 9, u = o[a] * e + o[a + 1] * t + o[a + 2] * n, d = o[a + 3] * e + o[a + 4] * t + o[a + 5] * n, f = o[a + 6] * e + o[a + 7] * t + o[a + 8] * n;
		i && (u > 0 || u === 0 && (d > 0 || d === 0 && f > 0)) && (u = -u, d = -d, f = -f), (u < s || u === s && (d < c || d === c && f < l)) && (s = u, c = d, l = f);
	}
	return [
		s === 0 ? 0 : s,
		c === 0 ? 0 : c,
		l === 0 ? 0 : l
	];
}
function Ce(e, t, n, r, i = 1e-8) {
	if (e === 0 && t === 0 && n === 0) return !1;
	let a = /* @__PURE__ */ new Map();
	for (let i of ge(r)) {
		let r = he(i.positionReciprocalRotation, [
			e,
			t,
			n
		]).join(","), o = fe * (e * i.translation[0] + t * i.translation[1] + n * i.translation[2]), s = a.get(r) ?? {
			real: 0,
			imaginary: 0
		};
		s.real += Math.cos(o), s.imaginary += Math.sin(o), a.set(r, s);
	}
	return [...a.values()].every((e) => Math.hypot(e.real, e.imaginary) <= i);
}
function we(e, t, n, r, i = 1e-8) {
	if (e === 0 && t === 0 && n === 0) return !1;
	let a = xe(r), o = a.absencePhases;
	if (!o) return Ce(e, t, n, r, i);
	let s = a.positionReciprocalRotations, c = a.absenceScratch, l = 0;
	for (let r = 0; r < a.operationCount; r++) {
		let i = r * 9, a = r * 3, u = s[i] * e + s[i + 1] * t + s[i + 2] * n, d = s[i + 3] * e + s[i + 4] * t + s[i + 5] * n, f = s[i + 6] * e + s[i + 7] * t + s[i + 8] * n, p = 0;
		for (; p < l && (c.h[p] !== u || c.k[p] !== d || c.l[p] !== f);) p++;
		p === l && (c.h[p] = u, c.k[p] = d, c.l[p] = f, c.real[p] = 0, c.imaginary[p] = 0, l++);
		let m = e * o.translationNumerators[a] + t * o.translationNumerators[a + 1] + n * o.translationNumerators[a + 2];
		m = (m % o.denominator + o.denominator) % o.denominator, c.real[p] += o.rootReal[m], c.imaginary[p] += o.rootImaginary[m];
	}
	for (let e = 0; e < l; e++) if (Math.hypot(c.real[e], c.imaginary[e]) > i) return !1;
	return !0;
}
//#endregion
//#region src/lib/density/reflection-intensities.js
var Y = () => performance.now();
function Te() {
	return {
		reflectionSourceDiscoveryMs: 0,
		reflectionSourceParseMs: 0,
		reflectionRowDecodeMs: 0,
		reflectionSymmetrySetupMs: 0,
		reflectionAbsenceMs: 0,
		reflectionCanonicalizationMs: 0,
		reflectionMergeAccumulationMs: 0,
		reflectionMergeFinalizationMs: 0,
		reflectionMergeSortMs: 0,
		reflectionPreparationTotalMs: 0,
		rawReflectionCount: 0,
		validReflectionCount: 0,
		invalidReflectionCount: 0,
		distinctInputHklCount: 0,
		systematicAbsenceCount: 0,
		mergedReflectionCount: 0,
		symmetryOperationCount: 0,
		absenceCacheHitCount: 0,
		absenceCacheMissCount: 0,
		canonicalCacheHitCount: 0,
		canonicalCacheMissCount: 0,
		shelxContainerExtractionMs: 0,
		shelxFixedWidthDecodeMs: 0,
		shelxFallbackDecodeCount: 0
	};
}
function Ee(e, t, n, r, i, a, o, s) {
	return {
		h: e,
		k: t,
		l: n,
		intensity: r,
		sigma: i,
		sourceIndex: a,
		count: e.length,
		invalidCount: o,
		rawCount: s
	};
}
function De(e, t = !1) {
	let n = Array(e.count);
	for (let r = 0; r < e.count; r++) n[r] = {
		h: e.h[r],
		k: e.k[r],
		l: e.l[r],
		intensity: e.intensity[r],
		sigma: Number.isNaN(e.sigma[r]) ? null : e.sigma[r],
		sourceIndex: e.sourceIndex[r],
		...t ? { multiplicity: 1 } : {}
	};
	return n;
}
function Oe(e, t) {
	return [t, ...e.getAllBlocks().filter((e) => e !== t)];
}
function ke(e, t, n) {
	return [
		e,
		t,
		n
	].every((e) => Number.isInteger(e));
}
function Ae(e, t, n, r, i = null) {
	let a = [
		e,
		t,
		n,
		r
	].map((e) => e?.length);
	if (a.some((e) => e === void 0) || !a.every((e) => e === a[0])) throw Error("Reflection index and intensity columns must have the same row count");
	if (i && i.length !== a[0]) throw Error("Reflection intensity and uncertainty columns must have the same row count");
	let o = [], s = [], c = [], l = [], u = [], d = [], f = 0;
	for (let p = 0; p < a[0]; p++) {
		let a = _(e[p]), m = _(t[p]), h = _(n[p]), g = _(r[p]), v = i ? _(i[p]) : null;
		if (!ke(a, m, h) || g === null || i && v === null) {
			f++;
			continue;
		}
		o.push(a), s.push(m), c.push(h), l.push(g), u.push(v ?? NaN), d.push(p);
	}
	return Ee(Int32Array.from(o), Int32Array.from(s), Int32Array.from(c), Float64Array.from(l), Float64Array.from(u), Uint32Array.from(d), f, a[0]);
}
function je(e) {
	let t = y(e, ["_refln.index_h", "_refln_index_h"]), n = y(e, ["_refln.index_k", "_refln_index_k"]), r = y(e, ["_refln.index_l", "_refln_index_l"]), i = y(e, ["_refln.intensity_meas", "_refln_intensity_meas"]);
	if (i) return {
		...Ae(t, n, r, i, y(e, [
			"_refln.intensity_sigma",
			"_refln_intensity_sigma",
			"_refln.intensity_meas_su",
			"_refln_intensity_meas_su"
		])),
		valueKind: "intensity"
	};
	let a = y(e, ["_refln.F_squared_meas", "_refln_F_squared_meas"]);
	if (a) return {
		...Ae(t, n, r, a, y(e, [
			"_refln.F_squared_sigma",
			"_refln_F_squared_sigma",
			"_refln.F_squared_meas_su",
			"_refln_F_squared_meas_su"
		])),
		valueKind: "F-squared"
	};
	let o = y(e, ["_refln.F_meas", "_refln_F_meas"]);
	if (o) {
		let i = y(e, ["_refln.F_sigma", "_refln_F_sigma"]);
		return {
			...Ae(t, n, r, o.map((e) => {
				let t = _(e);
				return t === null ? null : t ** 2;
			}), i?.map((e, t) => {
				let n = _(e), r = _(o[t]);
				return n === null || r === null ? null : 2 * Math.abs(r) * n;
			}) ?? null),
			valueKind: "F-amplitude-squared"
		};
	}
	throw Error("The _refln loop contains no measured intensity, F-squared, or F columns");
}
function Me(e) {
	let t = y(e, ["_diffrn_refln.index_h", "_diffrn_refln_index_h"]), n = y(e, ["_diffrn_refln.index_k", "_diffrn_refln_index_k"]), r = y(e, ["_diffrn_refln.index_l", "_diffrn_refln_index_l"]), i = y(e, [
		"_diffrn_refln.intensity_net",
		"_diffrn_refln_intensity_net",
		"_diffrn_refln.intensity_meas",
		"_diffrn_refln_intensity_meas"
	]), a = y(e, [
		"_diffrn_refln.intensity_u",
		"_diffrn_refln_intensity_u",
		"_diffrn_refln.intensity_sigma",
		"_diffrn_refln_intensity_sigma",
		"_diffrn_refln.intensity_net_su",
		"_diffrn_refln_intensity_net_su"
	]);
	if (!i) throw Error("The _diffrn_refln loop contains no net measured intensity column");
	return Ae(t, n, r, i, a);
}
function Ne(e, t = null) {
	let n = [], r = [], i = [], a = [], o = [], s = [], c = 0, l = 0, u = String(e).split(/\r?\n/), d = t ? Y() : 0;
	for (let [e, d] of u.entries()) {
		if (d.trim().length === 0) continue;
		l++;
		let u = [
			d.slice(0, 4).trim(),
			d.slice(4, 8).trim(),
			d.slice(8, 12).trim(),
			d.slice(12, 20).trim(),
			d.slice(20, 28).trim()
		], [f, p, m, h, g] = u.map(Number);
		if (!(d.length >= 28 && u.every(Boolean) && ke(f, p, m) && Number.isFinite(h) && Number.isFinite(g))) {
			let e = d.trim().split(/\s+/);
			[f, p, m, h, g] = e.slice(0, 5).map(_), t && t.shelxFallbackDecodeCount++;
		}
		if (!ke(f, p, m) || !Number.isFinite(h) || !Number.isFinite(g)) {
			c++;
			continue;
		}
		if (f === 0 && p === 0 && m === 0 && h === 0 && g === 0) {
			l--;
			break;
		}
		n.push(f), r.push(p), i.push(m), a.push(h), o.push(g), s.push(e);
	}
	return t && (t.shelxFixedWidthDecodeMs += Y() - d), Ee(Int32Array.from(n), Int32Array.from(r), Int32Array.from(i), Float64Array.from(a), Float64Array.from(o), Uint32Array.from(s), c, l);
}
function Pe(e) {
	e.parse();
	let t = Object.keys(e.data).find((e) => /shelx.*hkl_file/i.test(e));
	return t ? e.data[t] : null;
}
function Fe(e) {
	let t = [];
	for (let n of ["_iucr_refine_fcf_details"]) {
		let r;
		try {
			r = e.get(n);
		} catch {
			continue;
		}
		if (!(typeof r != "string" || !r.includes("data_"))) try {
			for (let e of new p(r).getAllBlocks()) {
				let n = v(e, "_refln");
				n && t.push(n);
			}
		} catch {}
	}
	return t;
}
function Ie(e, t) {
	let n = t.differenceDensityInputMode ?? "auto";
	if (n !== "auto") return n;
	if (t.differenceDensityCoefficientColumns || [
		"_cifvis_difference_density_loop",
		"_cifvis_difference_density_h",
		"_cifvis_difference_density_k",
		"_cifvis_difference_density_l",
		"_cifvis_difference_density_a",
		"_cifvis_difference_density_b"
	].map((t) => e.get(t, !1)).every((e) => typeof e == "string" && e.length > 0)) return "fcf";
	let r = v(e, "_refln");
	if (!r) return "cif-iam";
	let i = (e) => y(r, e, null) !== null, a = i(["_refln.phase_calc", "_refln_phase_calc"]), o = i([
		"_refln.F_squared_meas",
		"_refln_F_squared_meas",
		"_refln.F_meas",
		"_refln_F_meas"
	]), s = i([
		"_refln.F_calc",
		"_refln_F_calc",
		"_refln.F_squared_calc",
		"_refln_F_squared_calc"
	]);
	return a && o && s ? "fcf" : "cif-iam";
}
function Le(e, t, n, r, i = 1e-8) {
	return we(e, t, n, r, i);
}
function Re(e) {
	let t = e.length, n = new Int32Array(t), r = new Int32Array(t), i = new Int32Array(t), a = new Float64Array(t), o = new Float64Array(t), s = new Uint32Array(t);
	for (let c = 0; c < t; c++) {
		let t = e[c];
		n[c] = t.h, r[c] = t.k, i[c] = t.l, a[c] = t.intensity, o[c] = t.sigma === null || t.sigma === void 0 ? NaN : t.sigma, s[c] = t.sourceIndex ?? c;
	}
	return Ee(n, r, i, a, o, s, 0, t);
}
function ze(e, t, n, r, i, a) {
	let o = r - n + 1, s = a - i + 1, c = (t - e + 1) * o * s;
	return Number.isSafeInteger(c) ? (t, r, a) => ((t - e) * o + (r - n)) * s + (a - i) : (e, t, n) => `${e},${t},${n}`;
}
function Be(e) {
	let t = Infinity, n = -Infinity, r = Infinity, i = -Infinity, a = Infinity, o = -Infinity;
	for (let s = 0; s < e.count; s++) t = Math.min(t, e.h[s]), n = Math.max(n, e.h[s]), r = Math.min(r, e.k[s]), i = Math.max(i, e.k[s]), a = Math.min(a, e.l[s]), o = Math.max(o, e.l[s]);
	return e.count === 0 ? () => 0 : ze(t, n, r, i, a, o);
}
function Ve(e, t) {
	return e.h - t.h || e.k - t.k || e.l - t.l;
}
function He(e, t, n = {}) {
	let r = n.debug === !0, i = r ? n.diagnostics ?? Te() : null, a = e?.h instanceof Int32Array ? e : Re(e), o = n.mergeFriedel !== !1, s = n.removeSystematicAbsences !== !1, c = a.count, l = Be(a), u = new Uint8Array(c), d = /* @__PURE__ */ new Map(), f = 0, p = r ? Y() : 0, m = xe(t);
	r && (i.reflectionSymmetrySetupMs += Y() - p, i.symmetryOperationCount = m.operationCount);
	let h = r ? Y() : 0;
	for (let e = 0; e < c; e++) {
		let o = a.h[e], c = a.k[e], p = a.l[e], m = l(o, c, p), h = d.get(m);
		h === void 0 ? (h = s && Le(o, c, p, t, n.absenceTolerance), d.set(m, h), r && i.absenceCacheMissCount++) : r && i.absenceCacheHitCount++, h && (u[e] = 1, f++);
	}
	r && (i.reflectionAbsenceMs += Y() - h);
	let g = new Int32Array(c), _ = new Int32Array(c), v = new Int32Array(c), y = /* @__PURE__ */ new Map(), b = Infinity, x = -Infinity, S = Infinity, C = -Infinity, w = Infinity, T = -Infinity, E = r ? Y() : 0;
	for (let e = 0; e < c; e++) {
		if (u[e]) continue;
		let n = a.h[e], s = a.k[e], c = a.l[e], d = l(n, s, c), f = y.get(d);
		f === void 0 ? (f = Se(n, s, c, t, o), y.set(d, f), r && i.canonicalCacheMissCount++) : r && i.canonicalCacheHitCount++;
		let [p, m, h] = f;
		g[e] = p, _[e] = m, v[e] = h, b = Math.min(b, p), x = Math.max(x, p), S = Math.min(S, m), C = Math.max(C, m), w = Math.min(w, h), T = Math.max(T, h);
	}
	r && (i.reflectionCanonicalizationMs += Y() - E);
	let D = y.size === 0 ? () => 0 : ze(b, x, S, C, w, T), O = /* @__PURE__ */ new Map(), k = r ? Y() : 0;
	for (let e = 0; e < c; e++) {
		if (u[e]) continue;
		let t = g[e], n = _[e], r = v[e], i = D(t, n, r), o = O.get(i);
		o === void 0 && (o = {
			h: t,
			k: n,
			l: r,
			count: 0,
			allPositiveSigma: !0,
			allSigmaPresent: !0,
			intensitySum: 0,
			sigmaSquaredSum: 0,
			weightSum: 0,
			weightedIntensitySum: 0
		}, O.set(i, o));
		let s = a.intensity[e], c = a.sigma[e];
		if (o.count++, o.intensitySum += s, Number.isNaN(c)) o.allPositiveSigma = !1, o.allSigmaPresent = !1;
		else if (o.sigmaSquaredSum += c ** 2, c > 0) {
			let e = 1 / c ** 2;
			o.weightSum += e, o.weightedIntensitySum += s / c ** 2;
		} else o.allPositiveSigma = !1;
	}
	r && (i.reflectionMergeAccumulationMs += Y() - k);
	let A = r ? Y() : 0, j = Array(O.size), M = 0;
	for (let e of O.values()) j[M++] = {
		h: e.h,
		k: e.k,
		l: e.l,
		intensity: e.allPositiveSigma ? e.weightedIntensitySum / e.weightSum : e.intensitySum / e.count,
		sigma: e.allPositiveSigma ? Math.sqrt(1 / e.weightSum) : e.allSigmaPresent ? Math.sqrt(e.sigmaSquaredSum) / e.count : null,
		multiplicity: e.count
	};
	r && (i.reflectionMergeFinalizationMs += Y() - A);
	let N = r ? Y() : 0;
	return j.sort(Ve), r && (i.reflectionMergeSortMs += Y() - N, i.distinctInputHklCount = d.size, i.systematicAbsenceCount = f, i.mergedReflectionCount = j.length), {
		reflections: j,
		systematicAbsenceCount: f,
		...r ? { diagnostics: i } : {}
	};
}
function Ue(e, t, n = {}) {
	return He(e, t, n);
}
function We(e, t = 0, n = {}) {
	let r = n.debug === !0, i = r ? Y() : 0, a = r ? Te() : null, o = r ? Y() : 0, c = new p(e), l = typeof t == "number" ? c.getBlock(t) : c.getBlockByName(t), u = Oe(c, l), d = n.resolveDifferenceDensityInputMode === !0 ? Ie(l, n) : null;
	r && (a.reflectionSourceParseMs += Y() - o);
	let f = n.source ?? "auto", m = (e) => f === "auto" || f === e, h = (e, t) => {
		let n = De(t, !0);
		return r && (a.rawReflectionCount = t.rawCount, a.validReflectionCount = t.count, a.invalidReflectionCount = t.invalidCount, a.distinctInputHklCount = new Set(n.map((e) => `${e.h},${e.k},${e.l}`)).size, a.mergedReflectionCount = n.length, a.reflectionPreparationTotalMs = Y() - i), {
			reflections: n,
			metadata: {
				source: e.source,
				valueKind: t.valueKind,
				alreadyMerged: !0,
				inputCount: t.rawCount,
				outputCount: t.count,
				invalidCount: t.invalidCount,
				systematicAbsenceCount: 0,
				mergeFriedel: null,
				...d ? { resolvedDifferenceDensityInputMode: d } : {}
			},
			...r ? { diagnostics: a } : {}
		};
	}, g = r ? Y() : 0;
	if (m("refln")) {
		let e = u.map((e) => v(e, "_refln")).filter(Boolean).map((e) => ({
			loop: e,
			source: "refln"
		}));
		r && (a.reflectionSourceDiscoveryMs += Y() - g);
		let t = null;
		for (let n = 0; n < 2; n++) {
			let i = e;
			if (n === 1) {
				let e = r ? Y() : 0;
				i = u.flatMap(Fe).map((e) => ({
					loop: e,
					source: "embedded-refln"
				})), r && (a.reflectionSourceDiscoveryMs += Y() - e);
			}
			for (let e of i) try {
				let t = r ? Y() : 0, n = je(e.loop);
				return r && (a.reflectionRowDecodeMs += Y() - t), h(e, n);
			} catch (e) {
				if (!e.message.includes("contains no measured")) throw e;
				t = e;
			}
		}
		if (f === "refln" && t) throw t;
	} else r && (a.reflectionSourceDiscoveryMs += Y() - g);
	let _, y, b = r ? Y() : 0;
	if (m("diffrn_refln")) {
		let e = u.map((e) => v(e, "_diffrn_refln")).find(Boolean);
		if (e) {
			let t = r ? Y() : 0;
			_ = Me(e), r && (a.reflectionRowDecodeMs += Y() - t), y = "diffrn_refln";
		}
	}
	if (!_ && m("shelx_hkl_file")) {
		let e = r ? Y() : 0, t = u.map(Pe).find((e) => typeof e == "string");
		if (r && (a.shelxContainerExtractionMs += Y() - e), t) {
			let e = r ? Y() : 0;
			_ = Ne(t, a), r && (a.reflectionRowDecodeMs += Y() - e), y = "shelx_hkl_file";
		}
	}
	if (r && (a.reflectionSourceDiscoveryMs += Y() - b), !_) throw Error(`No usable reflection intensities were found for source "${f}". Difference density requires finite observed values; check the reflection value and sigma columns, their missing-value markers, and the selected reflection source.`);
	let x = r ? Y() : 0, S = s.fromCIF(l);
	r && (a.reflectionSymmetrySetupMs += Y() - x);
	let C = Ue(_, S, {
		...n,
		...r ? { diagnostics: a } : {}
	});
	return r && (a.rawReflectionCount = _.rawCount, a.validReflectionCount = _.count, a.invalidReflectionCount = _.invalidCount, a.systematicAbsenceCount = C.systematicAbsenceCount, a.mergedReflectionCount = C.reflections.length, a.reflectionPreparationTotalMs = Y() - i), {
		reflections: C.reflections,
		metadata: {
			source: y,
			valueKind: "intensity",
			alreadyMerged: !1,
			inputCount: _.rawCount,
			outputCount: C.reflections.length,
			invalidCount: _.invalidCount,
			systematicAbsenceCount: C.systematicAbsenceCount,
			mergeFriedel: n.mergeFriedel !== !1,
			...d ? { resolvedDifferenceDensityInputMode: d } : {}
		},
		...r ? { diagnostics: a } : {}
	};
}
//#endregion
//#region src/lib/density/extinction-correction.js
function Ge(e, t, n, r) {
	if (!(e > 0) || !(t > 0) || n === 0) return 1;
	let i = r * t / 2;
	if (!(i > 0 && i < 1)) throw Error(`Cannot apply SHELXL extinction at sin(theta)=${i}; check the radiation wavelength and reflection indices`);
	let a = 2 * i * Math.sqrt(1 - i ** 2);
	return (1 + .001 * n * e * r ** 3 / a) ** -.25;
}
function Ke(t, i, a, o, s, c = !0) {
	let l = (e, t = {}) => ({
		factors: Array(o.length).fill(1),
		metadata: {
			enabled: !1,
			model: "SHELXL-isotropic",
			reason: e,
			...t
		}
	});
	if (c === !1) return l("disabled");
	if (c !== !0 && typeof c != "number" && (typeof c != "object" || !c || Array.isArray(c))) throw Error("extinctionCorrection must be true, false, a coefficient, or an object");
	let u = _(typeof c == "number" ? c : c?.coefficient), f = b(t, ["_refine_ls.extinction_coef", "_refine_ls_extinction_coef"]), p = u ?? f, m = u === null ? "cif" : "configured";
	if (p === null) return l("not-reported");
	if (p < 0) throw Error(`Difference density was not created because the ${m === "cif" ? "CIF reports" : "configuration supplies"} a negative SHELXL extinction coefficient (${p}). Correct the coefficient or set extinctionCorrection: false to ignore the reported correction.`);
	if (p === 0) return l("zero-coefficient", {
		coefficient: p,
		source: m
	});
	let h = x(t, ["_refine_ls.extinction_method", "_refine_ls_extinction_method"]), g = x(t, ["_refine_ls.extinction_expression", "_refine_ls_extinction_expression"]);
	if (!(/shelxl/i.test(h ?? "") || /0\.001/i.test(g ?? "") && /sin\s*\(?\s*2/i.test(g ?? "")) && u === null) return l("unsupported-model", {
		coefficient: p,
		source: m,
		method: h,
		expression: g
	});
	let v = (typeof c == "object" ? _(c.wavelength) : null) ?? a;
	if (!(v > 0)) {
		let e = x(t, [
			"_diffrn_radiation_wavelength.wavelength",
			"_diffrn_radiation.wavelength",
			"_diffrn_radiation_wavelength"
		]);
		throw Error(`Difference density was not created because the reported SHELXL extinction correction requires one positive radiation wavelength, but the CIF reports ${e === null ? "no usable wavelength" : `"${e}"`}. Provide extinctionCorrection: { coefficient, wavelength } with a representative wavelength, or set extinctionCorrection: false to ignore the reported correction.`);
	}
	let y = s.fSquared?.length ?? s.length;
	if (o.length !== y) throw Error("Extinction correction requires matching observed and calculated reflections");
	let S = e(d(i.fractToCartMatrix)), C = o.map((e, t) => {
		let i = r(n(S, [
			e.h,
			e.k,
			e.l
		]));
		return Ge(s.fSquared?.[t] ?? s[t].amplitude ** 2, i, p, v);
	}), w = C.reduce((e, t) => Math.min(e, t), 1);
	return {
		factors: C,
		metadata: {
			enabled: !0,
			model: "SHELXL-isotropic",
			coefficient: p,
			wavelength: v,
			source: m,
			method: h,
			expression: g,
			correctedReflectionCount: C.filter((e) => e < 1).length,
			minimumAmplitudeFactor: w,
			maximumAmplitudeCorrection: 1 / w
		}
	};
}
//#endregion
//#region src/lib/density/scalar-field.js
function X(e, t) {
	return (e % t + t) % t;
}
function qe(e, t, n, r, i) {
	let a = t - e, o = n - t, s = r - n;
	if (o === 0) return t;
	let c = a * o <= 0 ? 0 : 2 * a * o / (a + o), l = o * s <= 0 ? 0 : 2 * o * s / (o + s), u = i * i, d = u * i;
	return (2 * d - 3 * u + 1) * t + (d - 2 * u + i) * c + (-2 * d + 3 * u) * n + (d - u) * l;
}
var Je = class e {
	constructor(e, t, n, r = {}) {
		this.cell = e, this.dimensions = t, this.values = n, Object.assign(this, r);
	}
	toPayload() {
		let { cell: e, dimensions: t, values: n, ...r } = this;
		return {
			cell: {
				a: e.a,
				b: e.b,
				c: e.c,
				alpha: e.alpha,
				beta: e.beta,
				gamma: e.gamma
			},
			dimensions: t,
			values: n,
			...r
		};
	}
	static fromPayload(t) {
		let n = new l(t.cell.a, t.cell.b, t.cell.c, t.cell.alpha, t.cell.beta, t.cell.gamma), { cell: r, dimensions: i, values: a, ...o } = t;
		return new e(n, i, a, o);
	}
	valueAtIndex(e, t, n) {
		let [r, i, a] = this.dimensions;
		return this.values[(X(n, a) * i + X(t, i)) * r + X(e, r)];
	}
	sample(e, t, n) {
		let [r, i, a] = this.dimensions, o = this.originFractional ?? [
			0,
			0,
			0
		], s = [
			(e - o[0]) * r,
			(t - o[1]) * i,
			(n - o[2]) * a
		], c = this.boundaryMode !== "zero";
		if (!c && s.some((e, t) => e < 0 || e > this.dimensions[t] - 1)) return 0;
		let l = s.map(Math.floor), u = s.map((e, t) => !c && l[t] >= this.dimensions[t] - 1 ? (l[t] = this.dimensions[t] - 1, 0) : e - l[t]), d = (e, t, n) => {
			let o = c ? X(e, r) : Math.min(r - 1, e), s = c ? X(t, i) : Math.min(i - 1, t), l = c ? X(n, a) : Math.min(a - 1, n);
			return this.valueAtIndex(o, s, l);
		}, f = (e, t, n) => e + (t - e) * n, p = f(d(l[0], l[1], l[2]), d(l[0] + 1, l[1], l[2]), u[0]), m = f(d(l[0], l[1] + 1, l[2]), d(l[0] + 1, l[1] + 1, l[2]), u[0]), h = f(d(l[0], l[1], l[2] + 1), d(l[0] + 1, l[1], l[2] + 1), u[0]), g = f(d(l[0], l[1] + 1, l[2] + 1), d(l[0] + 1, l[1] + 1, l[2] + 1), u[0]);
		return f(f(p, m, u[1]), f(h, g, u[1]), u[2]);
	}
	sampleCubic(e, t, n) {
		let [r, i, a] = this.dimensions, o = this.originFractional ?? [
			0,
			0,
			0
		], s = (e - o[0]) * r, c = (t - o[1]) * i, l = (n - o[2]) * a, u = this.boundaryMode !== "zero";
		if (!u && (s < 0 || s > r - 1 || c < 0 || c > i - 1 || l < 0 || l > a - 1)) return 0;
		let d = u ? Math.floor(s) : Math.min(Math.floor(s), r - 1), f = u ? Math.floor(c) : Math.min(Math.floor(c), i - 1), p = u ? Math.floor(l) : Math.min(Math.floor(l), a - 1), m = d === r - 1 && !u ? 0 : s - d, h = f === i - 1 && !u ? 0 : c - f, g = p === a - 1 && !u ? 0 : l - p, _ = (e, t) => u ? X(e, t) : e < 0 || e >= t ? -1 : e, v = _(d - 1, r), y = _(d, r), b = _(d + 1, r), x = _(d + 2, r), S = _(f - 1, i), C = _(f, i), w = _(f + 1, i), T = _(f + 2, i), E = _(p - 1, a), D = _(p, a), O = _(p + 1, a), k = _(p + 2, a), A = (e, t) => e < 0 || t < 0 ? 0 : qe(v < 0 ? 0 : this.valueAtIndex(v, e, t), y < 0 ? 0 : this.valueAtIndex(y, e, t), b < 0 ? 0 : this.valueAtIndex(b, e, t), x < 0 ? 0 : this.valueAtIndex(x, e, t), m), j = (e) => qe(A(S, e), A(C, e), A(w, e), A(T, e), h);
		return qe(j(E), j(D), j(O), j(k), g);
	}
}, Ye = [
	0,
	1,
	2
];
function Xe(e) {
	let t = 1;
	for (; t < e;) t *= 2;
	return Math.max(2, t);
}
function Ze(e) {
	let t = Math.max(1, Math.round(e));
	for (let e of [
		2,
		3,
		5
	]) for (; t % e === 0;) t /= e;
	return t === 1;
}
function Qe(e, t = 1) {
	let n = Math.max(2, Math.ceil(e)), r = Math.max(1, Math.round(t));
	for (let e = n;; e++) if (e % r === 0 && Ze(e)) return e;
}
function $e(e, t) {
	let n = Math.abs(Math.round(e)), r = Math.abs(Math.round(t));
	for (; r;) [n, r] = [r, n % r];
	return n;
}
function et(e, t) {
	return Math.abs(e * t) / Math.max(1, $e(e, t));
}
function tt(e, t = 1e-6, n = 12) {
	let r = (Number(e) % 1 + 1) % 1;
	if (r < t || Math.abs(r - 1) < t) return 1;
	for (let e = 2; e <= n; e++) if (Math.abs(r * e - Math.round(r * e)) <= t) return e;
	return null;
}
function nt(e, t, n) {
	let r = (t) => {
		for (; e[t] !== t;) e[t] = e[e[t]], t = e[t];
		return t;
	}, i = r(t), a = r(n);
	i !== a && (e[a] = i);
}
function rt(e, t = []) {
	let n = e.map((e) => Math.max(2, Math.ceil(e))), r = [
		1,
		1,
		1
	], i = [
		0,
		1,
		2
	], a = [], o = !0;
	for (let e of t ?? []) {
		let t = e.rotation ?? e.rotMatrix, n = e.translation ?? e.transVector ?? [
			0,
			0,
			0
		];
		if (!(!Array.isArray(t) || t.length !== 3)) for (let e of Ye) {
			for (let n of Ye) {
				let r = Number(t[e]?.[n]);
				if (!Number.isFinite(r) || Math.abs(r - Math.round(r)) > 1e-6) {
					o = !1, a.push("non-integral-symmetry-rotation");
					continue;
				}
				e !== n && Math.round(r) !== 0 && nt(i, e, n);
			}
			let s = tt(n[e]);
			s === null || !Ze(s) ? (o = !1, a.push("non-crystallographic-translation")) : r[e] = et(r[e], s);
		}
	}
	if (!o) return {
		dimensions: n.map((e) => Qe(e)),
		symmetryCompatible: !1,
		fallbackReason: [...new Set(a)].join(",")
	};
	let s = /* @__PURE__ */ new Map(), c = (e) => {
		for (; i[e] !== e;) e = i[e];
		return e;
	};
	for (let e of Ye) {
		let t = c(e), n = s.get(t) ?? [];
		n.push(e), s.set(t, n);
	}
	let l = [...n];
	for (let e of s.values()) {
		let t = Qe(Math.max(...e.map((e) => n[e])), e.reduce((e, t) => et(e, r[t]), 1));
		e.forEach((e) => {
			l[e] = t;
		});
	}
	return {
		dimensions: l,
		symmetryCompatible: !0,
		fallbackReason: null
	};
}
function it(e, t = 1, n = {}) {
	let r = [
		0,
		0,
		0
	];
	for (let { h: t, k: n, l: i } of e.values()) r[0] = Math.max(r[0], Math.abs(t)), r[1] = Math.max(r[1], Math.abs(n)), r[2] = Math.max(r[2], Math.abs(i));
	let i = Math.max(1, Number(t) || 1);
	if (n.backend === "radix-2") return {
		dimensions: r.map((e) => Xe(Xe(2 * e + 1) * i)),
		maxima: r,
		symmetryCompatible: !1,
		fallbackReason: "legacy-radix-2-grid"
	};
	let a = r.map((e) => Math.ceil(i * (2 * e + 1)));
	return {
		...rt(a, n.symmetryOperations),
		maxima: r,
		minimumDimensions: a
	};
}
//#endregion
//#region src/lib/density/fft.js
var at = /* @__PURE__ */ new Map(), ot = /* @__PURE__ */ new Map(), st = Math.sqrt(3) / 2, ct = (Math.sqrt(5) - 1) / 4, lt = -(Math.sqrt(5) + 1) / 4, ut = Math.sin(2 * Math.PI / 5), dt = Math.sin(Math.PI / 5);
function ft() {
	return globalThis.performance?.now?.() ?? Date.now();
}
function pt(e) {
	return Number.isInteger(e) && e > 0 && (e & e - 1) == 0;
}
function mt(e) {
	let t = e, n = {
		2: 0,
		3: 0,
		5: 0
	};
	for (let e of [
		2,
		3,
		5
	]) for (; t % e === 0;) n[e]++, t /= e;
	return {
		exponents: n,
		remaining: t
	};
}
function ht(e) {
	for (let t of [
		2,
		3,
		5
	]) if (e % t === 0) return t;
	return e;
}
function gt(e, t, n, r, i, a, o, s, c, l, u, d, f) {
	if (i === 1) {
		a[s] = e[n], o[s] = t[n];
		return;
	}
	let p = ht(i);
	if (p === i && ![
		2,
		3,
		5
	].includes(p)) throw Error(`Mixed-radix FFT length contains an unsupported factor: ${i}`);
	let m = i / p;
	for (let i = 0; i < p; i++) gt(e, t, n + i * r, r * p, m, a, o, s + i * m, c, l, u + i * m, d, f);
	let h = f.get(i);
	for (let e = 0; e < m; e++) {
		let t = s + e, n = a[t], r = o[t], i = s + m + e, f = d < 0 ? h.imaginary[m + e] : -h.imaginary[m + e], g = a[i] * h.real[m + e] - o[i] * f, _ = a[i] * f + o[i] * h.real[m + e];
		if (p === 2) {
			c[u + e] = n + g, l[u + e] = r + _, c[u + m + e] = n - g, l[u + m + e] = r - _;
			continue;
		}
		let v = s + 2 * m + e, y = d < 0 ? h.imaginary[2 * m + e] : -h.imaginary[2 * m + e], b = a[v] * h.real[2 * m + e] - o[v] * y, x = a[v] * y + o[v] * h.real[2 * m + e];
		if (p === 3) {
			let t = d < 0 ? st : -st, i = n - .5 * (g + b), a = r - .5 * (_ + x), o = t * (_ - x), s = t * (b - g);
			c[u + e] = n + g + b, l[u + e] = r + _ + x, c[u + m + e] = i + o, l[u + m + e] = a + s, c[u + 2 * m + e] = i - o, l[u + 2 * m + e] = a - s;
			continue;
		}
		let S = s + 3 * m + e, C = d < 0 ? h.imaginary[3 * m + e] : -h.imaginary[3 * m + e], w = a[S] * h.real[3 * m + e] - o[S] * C, T = a[S] * C + o[S] * h.real[3 * m + e], E = s + 4 * m + e, D = d < 0 ? h.imaginary[4 * m + e] : -h.imaginary[4 * m + e], O = a[E] * h.real[4 * m + e] - o[E] * D, k = a[E] * D + o[E] * h.real[4 * m + e], A = g + O, j = _ + k, M = b + w, N = x + T, P = g - O, F = _ - k, I = b - w, L = x - T, R = d < 0 ? ut : -ut, z = d < 0 ? dt : -dt, B = n + ct * A + lt * M, V = r + ct * j + lt * N, H = R * F + z * L, U = -R * P - z * I, W = n + lt * A + ct * M, G = r + lt * j + ct * N, K = z * F - R * L, q = -z * P + R * I;
		c[u + e] = n + A + M, l[u + e] = r + j + N, c[u + m + e] = B + H, l[u + m + e] = V + U, c[u + 2 * m + e] = W + K, l[u + 2 * m + e] = G + q, c[u + 3 * m + e] = W - K, l[u + 3 * m + e] = G - q, c[u + 4 * m + e] = B - H, l[u + 4 * m + e] = V - U;
	}
	for (let e = 0; e < i; e++) a[s + e] = c[u + e], o[s + e] = l[u + e];
}
function _t(e) {
	let t = e;
	for (let e of [
		2,
		3,
		5
	]) for (; t % e === 0;) t /= e;
	if (t !== 1 || e < 2) throw Error(`Mixed-radix FFT length must be a 2/3/5-smooth integer: ${e}`);
	let n = /* @__PURE__ */ new Map();
	for (let t = e; t > 1;) {
		let e = ht(t), r = t / e, i = new Float64Array(e * r), a = new Float64Array(e * r);
		for (let n = 0; n < e; n++) for (let e = 0; e < r; e++) {
			let o = -2 * Math.PI * n * e / t;
			i[n * r + e] = Math.cos(o), a[n * r + e] = Math.sin(o);
		}
		n.set(t, {
			real: i,
			imaginary: a
		}), t /= e;
	}
	return {
		length: e,
		outputReal: new Float64Array(e),
		outputImaginary: new Float64Array(e),
		scratchReal: new Float64Array(e),
		scratchImaginary: new Float64Array(e),
		twiddleTables: n
	};
}
function vt(e) {
	if (!pt(e) || e < 2) throw Error(`Radix-2 FFT length must be a power of two: ${e}`);
	let t = new Uint32Array(e);
	for (let n = 1, r = 0; n < e; n++) {
		let i = e >> 1;
		for (; r & i; i >>= 1) r ^= i;
		r ^= i, t[n] = r;
	}
	let n = [];
	for (let t = 2; t <= e; t *= 2) {
		let e = -2 * Math.PI / t;
		n.push({
			width: t,
			rootReal: Math.cos(e),
			rootImaginary: Math.sin(e)
		});
	}
	return {
		length: e,
		bitReversal: t,
		stages: n
	};
}
function yt(e, t = "auto") {
	if (![
		"auto",
		"mixed-radix",
		"radix-2"
	].includes(t)) throw Error("FFT axis kernel must be \"auto\", \"mixed-radix\", or \"radix-2\"");
	if (t === "auto") return pt(e) ? "radix-2" : "mixed-radix";
	if (t === "radix-2" && !pt(e)) throw Error(`Radix-2 axis kernel cannot transform length ${e}`);
	return t;
}
function bt(e, t = "auto") {
	let n = yt(e, t), r = n === "radix-2" ? ot : at, i = r.get(e);
	if (i) return {
		kernel: n,
		plan: i,
		cacheHit: !0,
		setupTimeMs: 0
	};
	let a = ft(), o = n === "radix-2" ? vt(e) : _t(e), s = ft() - a;
	return r.set(e, o), {
		kernel: n,
		plan: o,
		cacheHit: !1,
		setupTimeMs: s
	};
}
function xt(e, t = "mixed-radix") {
	let n = 2 * e * Float64Array.BYTES_PER_ELEMENT;
	if (yt(e, t) === "radix-2") return n + e * Uint32Array.BYTES_PER_ELEMENT + Math.log2(e) * 3 * Float64Array.BYTES_PER_ELEMENT;
	let r = 0;
	for (let t = e; t > 1;) {
		let e = ht(t);
		r += 2 * t, t /= e;
	}
	return n + (4 * e + r) * Float64Array.BYTES_PER_ELEMENT;
}
function St(e, t, n, r = !1) {
	if (e.length !== n.length || t.length !== n.length) throw Error("FFT line and plan lengths must match");
	gt(e, t, 0, 1, n.length, n.outputReal, n.outputImaginary, 0, n.scratchReal, n.scratchImaginary, 0, r ? 1 : -1, n.twiddleTables);
	let i = r ? 1 / n.length : 1;
	for (let r = 0; r < n.length; r++) e[r] = n.outputReal[r] * i, t[r] = n.outputImaginary[r] * i;
}
function Ct(e, t, n = !1, r = null) {
	let i = e.length, a = r ?? bt(i, "radix-2").plan;
	for (let n = 1; n < i; n++) {
		let r = a.bitReversal[n];
		n < r && ([e[n], e[r]] = [e[r], e[n]], [t[n], t[r]] = [t[r], t[n]]);
	}
	for (let r of a.stages) {
		let { width: a, rootReal: o } = r, s = n ? -r.rootImaginary : r.rootImaginary;
		for (let n = 0; n < i; n += a) {
			let r = 1, i = 0;
			for (let c = 0; c < a / 2; c++) {
				let l = n + c, u = l + a / 2, d = e[u] * r - t[u] * i, f = e[u] * i + t[u] * r, p = e[l], m = t[l];
				e[l] = p + d, t[l] = m + f, e[u] = p - d, t[u] = m - f;
				let h = r * o - i * s;
				i = r * s + i * o, r = h;
			}
		}
	}
	if (n) for (let n = 0; n < i; n++) e[n] /= i, t[n] /= i;
}
function wt(e, t, n, r, i = "mixed-radix") {
	let a = ft(), [o, s, c] = n, l = n[r], u = new Float64Array(l), d = new Float64Array(l), f = bt(l, i), p = ft(), m = (n, r) => {
		for (let i = 0; i < l; i++) {
			let a = n + i * r;
			u[i] = e[a], d[i] = t[a];
		}
		f.kernel === "mixed-radix" ? St(u, d, f.plan) : Ct(u, d, !1, f.plan);
		for (let i = 0; i < l; i++) {
			let a = n + i * r;
			e[a] = u[i], t[a] = d[i];
		}
	};
	if (r === 0) for (let e = 0; e < c; e++) for (let t = 0; t < s; t++) m((e * s + t) * o, 1);
	else if (r === 1) for (let e = 0; e < c; e++) for (let t = 0; t < o; t++) m(e * s * o + t, o);
	else for (let e = 0; e < s; e++) for (let t = 0; t < o; t++) m(e * o + t, o * s);
	return {
		axis: r,
		length: l,
		lineCount: r === 0 ? s * c : r === 1 ? o * c : o * s,
		kernel: f.kernel,
		planCacheHit: f.cacheHit,
		planSetupTimeMs: f.setupTimeMs,
		kernelTimeMs: ft() - p,
		totalTimeMs: ft() - a
	};
}
//#endregion
//#region src/lib/density/difference-density.js
var Tt = 2 * Math.PI, Z = () => globalThis.performance?.now?.() ?? Date.now(), Et = class extends Error {
	constructor(e) {
		super(e), this.name = "UnsupportedCoefficientSourceError";
	}
};
function Q(e, t) {
	return (e % t + t) % t;
}
function $(e, t, ...n) {
	try {
		return e.get(t);
	} catch (e) {
		if (n.length > 0) return n[0];
		throw e;
	}
}
function Dt(e) {
	let t = e.map((e) => e.length);
	if (t.some((e) => e !== t[0])) throw Error(`Reflection columns have inconsistent lengths: ${t.join(", ")}`);
}
function Ot(e, t) {
	let n = typeof e == "string" ? [e] : e;
	if (!Array.isArray(n) || n.length < 1 || n.length > 2 || n.some((e) => typeof e != "string" || e.length === 0)) throw Error(`${t} must name one or two CIF columns`);
	return n;
}
function kt(e, t, n) {
	return Ot(t, n).map((t) => {
		try {
			return e.get(t);
		} catch {
			throw Error(`Custom density column not found: ${t}`);
		}
	});
}
function At(e, t) {
	let n = t.amplitudes ?? t.amplitudeColumns ?? t.amplitude, r = t.phases ?? t.phaseColumns ?? t.phase, i = t.aValues ?? t.a ?? t.A, a = t.bValues ?? t.b ?? t.B, o = n !== void 0 || r !== void 0, s = i !== void 0 || a !== void 0;
	if (o === s) throw Error("Custom density columns must specify either amplitudes/phases or A/B values");
	if (s) {
		if (i === void 0 || a === void 0) throw Error("Custom density A and B columns must both be specified");
		let t = kt(e, i, "a"), n = kt(e, a, "b");
		if (t.length !== n.length) throw Error("Custom density A and B column counts must match");
		return Dt([...t, ...n]), {
			mode: t.length === 1 ? "a-b" : "a-b-difference",
			componentCount: t.length,
			valueColumns: [...t, ...n],
			coefficientAt(e) {
				return {
					real: Number(t[0][e]) - (t[1] ? Number(t[1][e]) : 0),
					imaginary: Number(n[0][e]) - (n[1] ? Number(n[1][e]) : 0)
				};
			}
		};
	}
	if (n === void 0 || r === void 0) throw Error("Custom density amplitude and phase columns must both be specified");
	let c = kt(e, n, "amplitudes"), l = kt(e, r, "phases");
	if (l.length !== 1 && l.length !== c.length) throw Error("Use one common phase column or one phase column per amplitude");
	Dt([...c, ...l]);
	let u = t.phaseUnit === "radians" ? 1 : Math.PI / 180;
	if (t.phaseUnit !== void 0 && !["degrees", "radians"].includes(t.phaseUnit)) throw Error("Custom density phaseUnit must be \"degrees\" or \"radians\"");
	let d = l.length === c.length && l.length === 2;
	return {
		mode: c.length === 1 ? "amplitude-phase" : d ? "split-phase-difference" : "common-phase-difference",
		componentCount: c.length,
		valueColumns: [...c, ...l],
		coefficientAt(e) {
			if (!d) {
				let t = Number(c[0][e]) - (c[1] ? Number(c[1][e]) : 0), n = Number(l[0][e]) * u;
				return {
					real: t * Math.cos(n),
					imaginary: t * Math.sin(n)
				};
			}
			let t = Number(l[0][e]) * u, n = Number(l[1][e]) * u;
			return {
				real: Number(c[0][e]) * Math.cos(t) - Number(c[1][e]) * Math.cos(n),
				imaginary: Number(c[0][e]) * Math.sin(t) - Number(c[1][e]) * Math.sin(n)
			};
		}
	};
}
function jt(e) {
	e.parse();
	let t = Object.keys(e.data).find((e) => /shelx.*fab_file/i.test(e));
	return t ? e.data[t] : null;
}
function Mt(e) {
	let t = jt(e);
	if (typeof t != "string") return null;
	let n = [], r = [], i = [], a = [], o = [];
	for (let e of t.split("\n")) {
		let t = e.trim().split(/\s+/).map(Number);
		if (t.length < 5 || t.slice(0, 5).some((e) => !Number.isFinite(e)) || !t.slice(0, 3).every(Number.isInteger)) continue;
		let [s, c, l, u, d] = t;
		n.push(s), r.push(c), i.push(l), a.push(u), o.push(d);
	}
	return n.length > 0 ? {
		h: n,
		k: r,
		l: i,
		real: a,
		imaginary: o
	} : null;
}
function Nt(e) {
	let t = y(v(e, "_smtbx_masks_void"), ["_smtbx_masks_void.count_electrons", "_smtbx_masks_void_count_electrons"]);
	if (!t) return null;
	let n = t.reduce((e, t) => e + (_(t) ?? 0), 0);
	return {
		voidCount: t.length,
		totalElectrons: n
	};
}
function Pt(e, t) {
	let n = e ?? "first";
	if (![
		"first",
		"second",
		"both",
		"result"
	].includes(n)) throw Error("Anomalous-dispersion target must be \"first\", \"second\", \"both\", or \"result\"");
	if (n === "second") {
		if (t < 2) throw Error("Cannot correct the second operand of a single coefficient set");
		return 1;
	}
	return n === "both" && t > 1 ? 0 : -1;
}
function Ft(e, t) {
	if (t.generator !== void 0 && t.generator !== "auto") {
		let e = String(t.generator).toLowerCase();
		if (!["olex", "shelxl"].includes(e)) throw Error("Anomalous-dispersion generator must be \"auto\", \"olex\", or \"shelxl\"");
		return e;
	}
	let n = (t) => {
		try {
			return String(e.get(t, "")).toLowerCase();
		} catch {
			return "";
		}
	}, r = n("_computing_structure_refinement");
	if (r.includes("olex2.refine") || r.includes("olex2_refine")) return "olex";
	if (r.includes("shelxl")) return "shelxl";
	let i = n("_audit_creation_method");
	return i.includes("olex2.refine") || i.includes("olex2_refine") ? "olex" : i.includes("shelxl") ? "shelxl" : "unknown";
}
function It(e, t, n, r, i, a = .05) {
	let o = e.symmetryOperations.find((e) => e.rotMatrix.every((e, t) => e.every((e, n) => Math.abs(e - (t === n ? -1 : 0)) < 1e-8)));
	if (!o) return {
		centrosymmetric: !1,
		available: !1
	};
	if (!i) return {
		centrosymmetric: !0,
		available: !1
	};
	let s = 0, c = 0;
	for (let e = 0; e < i.length; e++) {
		let a = Number(i[e]), l = [
			Number(t[e]),
			Number(n[e]),
			Number(r[e])
		];
		if (![a, ...l].every(Number.isFinite)) continue;
		let u = 180 * (l[0] * o.transVector[0] + l[1] * o.transVector[1] + l[2] * o.transVector[2]), d = Math.abs(((a - u + 90) % 180 + 180) % 180 - 90);
		c = Math.max(c, d), s++;
	}
	return {
		centrosymmetric: !0,
		method: "inversion-phases",
		available: s > 0,
		checkedCount: s,
		toleranceDegrees: a,
		maximumDeviationDegrees: c,
		alreadyCorrected: s > 0 && c <= a,
		needsCorrection: s > 0 && c > a
	};
}
function Lt(e, t, n, r, i, a = .05, o = 1e-4) {
	if (!r) return {
		centrosymmetric: !1,
		method: "friedel-pair-phases",
		available: !1
	};
	let s = /* @__PURE__ */ new Map(), c = 0;
	for (let a = 0; a < r.length; a++) {
		let o = [
			Number(e[a]),
			Number(t[a]),
			Number(n[a])
		], l = Number(r[a]), u = i ? Number(i[a]) : null;
		[...o, l].every(Number.isFinite) && (Number.isFinite(u) && (c = Math.max(c, Math.abs(u))), s.set(o.join(","), {
			indices: o,
			phase: l,
			amplitude: u
		}));
	}
	let l = /* @__PURE__ */ new Set(), u = 0, d = 0, f = 0, p = c * 1e-4;
	for (let [e, t] of s) {
		if (l.has(e) || t.indices.every((e) => e === 0)) continue;
		let n = t.indices.map((e) => -e).join(","), r = s.get(n);
		if (!r || (l.add(e), l.add(n), c > 0 && (Math.abs(t.amplitude) < p || Math.abs(r.amplitude) < p))) continue;
		let i = Math.abs(((t.phase + r.phase + 180) % 360 + 360) % 360 - 180);
		d = Math.max(d, i), c > 0 && Number.isFinite(t.amplitude) && Number.isFinite(r.amplitude) && (f = Math.max(f, Math.abs(Math.abs(t.amplitude) - Math.abs(r.amplitude)) / c)), u++;
	}
	let m = u > 0 && d <= a && f <= o;
	return {
		centrosymmetric: !1,
		method: "friedel-pair-phases",
		available: u > 0,
		checkedPairCount: u,
		toleranceDegrees: a,
		maximumDeviationDegrees: d,
		amplitudeToleranceRelative: o,
		maximumAmplitudeDeviationRelative: f,
		alreadyCorrected: m,
		needsCorrection: u > 0 && !m
	};
}
function Rt(e, t, n, r, i, a) {
	let o = `${t},${n},${r}`, s = e.get(o);
	s ? (s.real += i, s.imaginary += a, s.count++) : e.set(o, {
		h: t,
		k: n,
		l: r,
		real: i,
		imaginary: a,
		count: 1
	});
}
function zt(e, t, n, r, i, a) {
	let o = t > 0 || t === 0 && (n > 0 || n === 0 && r >= 0);
	Rt(e, o ? t : -t, o ? n : -n, o ? r : -r, i, o ? a : -a);
}
function Bt(e, t, n, r, i, a, o = !1) {
	let s = /* @__PURE__ */ new Map();
	for (let a = 0; a < e.length; a++) {
		let c = Number(e[a]), l = Number(t[a]), u = Number(n[a]), { real: d, imaginary: f } = r(a);
		if ([
			c,
			l,
			u,
			d,
			f
		].every(Number.isFinite)) for (let e of ge(i)) {
			let t = e.operation, [n, r, i] = he(e.reciprocalRotation, [
				c,
				l,
				u
			]), a = Tt * (n * t.transVector[0] + r * t.transVector[1] + i * t.transVector[2]), p = Math.cos(a), m = Math.sin(a), h = d * p - f * m, g = d * m + f * p;
			o ? zt(s, n, r, i, h, g) : Rt(s, n, r, i, h, g), !o && (n !== 0 || r !== 0 || i !== 0) && Rt(s, -n, -r, -i, h, -g);
		}
	}
	a && s.delete("0,0,0");
	for (let e of s.values()) e.real /= e.count, e.imaginary /= e.count;
	return s;
}
function Vt(t, i) {
	if (t.coefficients.size === 0) throw Error("Reflection source contains no usable difference-map coefficients");
	let a = e(d(t.cell.fractToCartMatrix)), o = 0;
	for (let e of t.coefficients.values()) e.reciprocalLength = r(n(a, [
		e.h,
		e.k,
		e.l
	])), o = Math.max(o, e.reciprocalLength);
	return {
		...t,
		maximumReciprocalLength: o,
		symmetryOperations: i.symmetryOperations.map((e) => ({
			rotation: e.rotMatrix.map((e) => [...e]),
			translation: [...e.transVector]
		}))
	};
}
function Ht(e, t, n, r) {
	let i = Number(n);
	if (Number.isFinite(i) && i > 0) return {
		scale: i,
		fittedReflectionCount: 0,
		explicit: !0
	};
	let a = 0, o = 0, s = 0;
	for (let n = 0; n < e.length; n++) {
		let i = e[n], c = t.fSquared[n] * r[n] ** 2;
		if (!(i.intensity > 0 && c > 0)) continue;
		let l = i.sigma > 0 ? 1 / i.sigma ** 2 : 1;
		a += l * i.intensity * c, o += l * i.intensity ** 2, s++;
	}
	let c = a / o;
	if (!(Number.isFinite(c) && c > 0 && s > 0)) throw Error("Could not fit a positive intensity scale against the IAM calculation");
	return {
		scale: c,
		fittedReflectionCount: s,
		explicit: !1
	};
}
function Ut(e, t = 0, n = {}) {
	let r = n.debugTimings === !0, i = r ? Z() : null, a = i, o = () => {
		if (!r) return null;
		let e = Z(), t = e - a;
		return a = e, t;
	}, c = new p(e), u = typeof t == "number" ? c.getBlock(t) : c.getBlockByName(t), d = o(), f = n.coordinateCifText ?? e, m = n.coordinateCifBlock ?? t, h = f === e ? c : new p(f), g = typeof m == "number" ? h.getBlock(m) : h.getBlockByName(m), _ = o(), v, y = "reflection";
	try {
		v = l.fromCIF(u);
	} catch (n) {
		if (!/Unit cell parameter entries missing in CIF/.test(n.message)) throw n;
		if (f === e && m === t) throw Error(`Reflection CIF does not contain a complete unit cell and no separate coordinate CIF was supplied: ${n.message}`, { cause: n });
		try {
			v = l.fromCIF(g), y = "coordinate-fallback";
		} catch (e) {
			throw Error(`Reflection CIF does not contain a complete unit cell and the coordinate CIF fallback could not provide one: ${e.message}`, { cause: e });
		}
	}
	let b = s.fromCIF(u), x = o(), S = {
		includeAnomalous: !1,
		...n.iam
	}, C = { ...n.reflections };
	C.mergeFriedel === void 0 && (C.mergeFriedel = S.includeAnomalous === !1);
	let w = n.preparedObservations ?? We(e, t, C);
	if (w.reflections.length === 0) throw Error("Difference density was not created because the reflection source contains no usable observed intensities. Check the reflection value/sigma columns and missing-value markers.");
	let T = o(), E = Z(), D = ue(f, m, {
		...S,
		expectedCell: v,
		structureModel: n.structureModel
	}), O = Z() - E, k = o(), A = Z(), j = D.calculatePrepared(w.reflections);
	if (j.diagnostics.expandedAtomCount === 0) throw Error("Difference density was not created because the coordinate CIF contains no usable atom sites for the IAM structure-factor calculation.");
	let M = Z() - A, N = o(), P = n.solventMaskCorrection ?? "auto";
	if (![
		!0,
		!1,
		"auto"
	].includes(P)) throw Error("solventMaskCorrection must be \"auto\", true, or false");
	let F = P === !1 ? null : Mt(g), I = o(), L = j, R = 0, z = 0, B = 0;
	if (F) {
		let e = Bt(F.h, F.k, F.l, (e) => ({
			real: F.real[e],
			imaginary: F.imaginary[e]
		}), b, !1), t = o();
		L = {
			...j,
			real: j.real.slice(),
			imaginary: j.imaginary.slice(),
			fSquared: j.fSquared.slice()
		};
		for (let t = 0; t < w.reflections.length; t++) {
			let n = w.reflections[t], r = e.get(`${n.h},${n.k},${n.l}`);
			if (!r) continue;
			R++;
			let i = j.real[t] + r.real, a = j.imaginary[t] + r.imaginary;
			L.real[t] = i, L.imaginary[t] = a, L.fSquared[t] = i ** 2 + a ** 2;
		}
		z = t, B = o();
	} else if (P === !0) throw Error("solventMaskCorrection was requested but no _shelx_fab_file was found");
	let V = {
		enabled: !!F,
		requested: P,
		source: "shelx-fab-file",
		fabReflectionCount: F?.h.length ?? 0,
		appliedReflectionCount: R,
		...Nt(g)
	}, H = o(), U = n.extinctionCorrection ?? "auto";
	if (![
		"auto",
		!0,
		!1
	].includes(U) && typeof U != "number" && (typeof U != "object" || !U || Array.isArray(U))) throw Error("extinctionCorrection must be \"auto\", true, false, a coefficient, or an object");
	let W = U === "auto" && w.metadata.source === "embedded-refln", G = Ke(g, v, D.metadata.wavelength, w.reflections, L, W ? !1 : U === "auto" || U);
	W && (G.metadata.reason = "embedded-fcf-already-corrected");
	let K = o(), q = Ht(w.reflections, L, n.intensityScale, G.factors), J = o(), ee = 0, te = 0, ne = 0, re = (e) => {
		let t = w.reflections[e], n = L.real[e], r = L.imaginary[e], i = L.fSquared[e], a = Math.sqrt(i), o = q.scale * t.intensity / G.factors[e] ** 2;
		o < 0 && ee++;
		let s = Math.sqrt(Math.max(0, o)) - a;
		return te += Math.abs(o - i), ne += i, a === 0 ? {
			real: s,
			imaginary: 0
		} : {
			real: s * n / a,
			imaginary: s * r / a
		};
	}, ie = w.reflections.map((e) => e.h), ae = w.reflections.map((e) => e.k), oe = w.reflections.map((e) => e.l), se = o(), ce = Bt(ie, ae, oe, re, b, !0, !0), le = o(), de = r ? {
		datasetSourceSetupMs: d,
		datasetCellSymmetrySetupMs: x,
		datasetObservationSetupMs: T,
		datasetIamModelBuildMs: k,
		datasetFcalcMs: N,
		datasetCoordinateSetupMs: _,
		datasetSolventMaskDiscoveryDecodeMs: I,
		datasetSolventMaskSymmetryExpansionMs: z,
		datasetSolventMaskCopyApplicationMs: B,
		datasetSolventMaskMetadataMs: H,
		datasetExtinctionMs: K,
		datasetScaleFitMs: J,
		datasetCoefficientInputSetupMs: se,
		datasetCoefficientExpansionMs: le
	} : void 0, fe = Vt({
		cell: v,
		coefficients: ce,
		reflectionCount: w.reflections.length,
		coefficientMode: "fo-fc-iam-phase",
		omitF000: !0,
		anomalousDispersion: {
			enabled: D.metadata.includeAnomalous,
			target: "both",
			source: "iam"
		},
		sourceType: "cif-iam",
		cellSource: y,
		fieldKind: "difference-density",
		intensityScale: q.scale,
		intensityScaleExplicit: q.explicit,
		scaleFittedReflectionCount: q.fittedReflectionCount,
		scaleR1: ne > 0 ? te / ne : null,
		negativeIntensityCount: ee,
		observations: w.metadata,
		iam: {
			...D.metadata,
			modelBuildTimeMs: O,
			calculation: {
				...j.diagnostics,
				timeMs: M
			}
		},
		solventMaskCorrection: V,
		datasetPreparationTimings: de,
		reflectionPolicy: {
			mergeFriedel: w.metadata.mergeFriedel,
			includeAnomalous: D.metadata.includeAnomalous
		},
		extinctionCorrection: G.metadata,
		friedelImplicit: !0
	}, b);
	return r && (fe.datasetPreparationTimings.datasetFinalizationMs = o(), fe.datasetPreparationTimings.datasetInstrumentedTotalMs = Z() - i), fe;
}
function Wt(e, t) {
	try {
		let n = new p(e), r = typeof t == "number" ? n.getBlock(t) : n.getBlockByName(t), i = (e) => r.get(e, null), a = i("_cifvis_difference_density_loop"), o = i("_cifvis_difference_density_h"), s = i("_cifvis_difference_density_k"), c = i("_cifvis_difference_density_l"), l = i("_cifvis_difference_density_a"), u = i("_cifvis_difference_density_b");
		if ([
			a,
			o,
			s,
			c,
			l,
			u
		].every((e) => typeof e == "string" && e.length > 0)) return {
			loop: a,
			h: o,
			k: s,
			l: c,
			a: l,
			b: u,
			omitF000: !1,
			fieldKind: "deformation-density"
		};
	} catch {}
	return null;
}
function Gt(e, t = 0, n = {}) {
	let r = n.debugTimings === !0, i = r ? Z() : null, a = n.inputMode ?? "auto";
	if (![
		"auto",
		"fcf",
		"cif-iam"
	].includes(a)) throw Error("Difference-density inputMode must be \"auto\", \"fcf\", or \"cif-iam\"");
	if (n.preparedSource?.mode === "cif-iam") {
		let a = Ut(e, t, {
			...n,
			preparedObservations: n.preparedSource.observations
		});
		return r && Object.assign(a.datasetPreparationTimings, {
			datasetSelfDescriptionDetectionMs: 0,
			datasetExplicitCoefficientAttemptMs: 0,
			datasetSourceDispatchTotalMs: Z() - i
		}), a;
	}
	let o = n.coefficientColumns ?? Wt(e, t), s = r ? Z() - i : null, c = 0;
	if (a !== "cif-iam") {
		let i = r ? Z() : null;
		try {
			return $t(e, t, o, n.anomalousDispersion ?? null, n);
		} catch (e) {
			if (r && (c = Z() - i), a === "fcf" || o || !(e instanceof Et)) throw e;
		}
	}
	let l = Ut(e, t, n);
	return r && Object.assign(l.datasetPreparationTimings, {
		datasetSelfDescriptionDetectionMs: s,
		datasetExplicitCoefficientAttemptMs: c,
		datasetSourceDispatchTotalMs: Z() - i
	}), l;
}
function Kt(e) {
	return Math.abs(i(e.fractToCartMatrix));
}
function qt(e, t, n = 0) {
	let r = new Float32Array(e.length), i = 0, a = 0, o = Infinity, s = -Infinity;
	for (let n = 0; n < e.length; n++) {
		let c = e[n] / t;
		r[n] = c, i += c, a += c * c, o = Math.min(o, c), s = Math.max(s, c);
	}
	let c = i / r.length, l = Math.max(0, a / r.length - c * c);
	return {
		values: r,
		mean: c,
		sigma: Math.sqrt(l),
		minimum: o,
		maximum: s,
		maxImaginary: n
	};
}
function Jt(e, t = 0, n = null) {
	let r = n?.sum ?? 0, i = n?.sumSquared ?? 0, a = n?.minimum ?? Infinity, o = n?.maximum ?? -Infinity;
	if (!n) for (let t of e) r += t, i += t * t, a = Math.min(a, t), o = Math.max(o, t);
	let s = r / e.length, c = Math.max(0, i / e.length - s * s);
	return {
		values: e,
		mean: s,
		sigma: Math.sqrt(c),
		minimum: a,
		maximum: o,
		maxImaginary: t
	};
}
function Yt(e, t = !1) {
	if (t) return {
		absolute: 0,
		relative: 0
	};
	let n = 0, r = 0;
	for (let t of e.values()) {
		let i = e.get(`${-t.h},${-t.k},${-t.l}`);
		if (r = Math.max(r, Math.hypot(t.real, t.imaginary)), !i) return {
			absolute: Infinity,
			relative: Infinity
		};
		n = Math.max(n, Math.hypot(t.real - i.real, t.imaginary + i.imaginary));
	}
	return {
		absolute: n,
		relative: n / Math.max(r, 2 ** -52)
	};
}
function Xt(e, t, n, r, i) {
	let a = Z(), [o, s] = n, c = n[0] * n[1] * n[2], l = new Float64Array(c), u = new Float64Array(c), d = Z() - a, f = Z();
	for (let { h: t, k: r, l: a, real: c, imaginary: d } of e.values()) {
		let e = (Q(a, n[2]) * s + Q(r, s)) * o + Q(t, o);
		if (l[e] = c, u[e] = d, i.friedelImplicit && (t !== 0 || r !== 0 || a !== 0)) {
			let e = (Q(-a, n[2]) * s + Q(-r, s)) * o + Q(-t, o);
			l[e] = c, u[e] = -d;
		}
	}
	let p = Z() - f, m = Z(), h = [
		0,
		1,
		2
	].map((e) => wt(l, u, n, e, r)), g = Z() - m, _ = Z(), v = Kt(t), y = 0;
	for (let e of u) y = Math.max(y, Math.abs(e / v));
	let b = Math.max(...n.map((e) => xt(e, r)));
	h.forEach((e) => {
		e.factorization = mt(e.length);
	});
	let x = [...new Set(h.map((e) => e.kernel))], S = qt(l, v, y), C = Z() - _;
	return {
		dimensions: n,
		...S,
		volume: v,
		fftBackend: x.length === 1 ? x[0] : "hybrid",
		fftAxisKernel: r,
		fftAxisStatistics: h,
		fftPlanSetupTimeMs: h.reduce((e, t) => e + t.planSetupTimeMs, 0),
		realTransform: !1,
		storedCoefficientCount: e.size,
		workBufferBytes: b,
		allocatedBytes: l.byteLength + u.byteLength + c * 4 + b,
		fftAllocationTimeMs: d,
		fftCoefficientPlacementTimeMs: p,
		fftTransformTimeMs: g,
		fftStatisticsTimeMs: C,
		symmetryCompatibleGrid: i.symmetryCompatible,
		fftGridPlanner: i.gridPlanner,
		gridFallbackReason: i.fallbackReason
	};
}
function Zt(e, t, n, r, i, a) {
	let [o, s, c] = n, l = Math.floor(o / 2) + 1, u = [
		l,
		s,
		c
	], d = l * s * c, f = Z(), p = new Float64Array(d), m = new Float64Array(d), h = new Float32Array(o * s * c), g = Z() - f, _ = 0, v = Z();
	for (let { h: t, k: n, l: r, real: a, imaginary: o } of e.values()) {
		if (t < 0) continue;
		let e = (Q(r, c) * s + Q(n, s)) * l + t;
		if (p[e] = a, m[e] = o, _++, i.friedelImplicit && t === 0 && (n !== 0 || r !== 0)) {
			let e = (Q(-r, c) * s + Q(-n, s)) * l;
			p[e] = a, m[e] = -o;
		}
	}
	let y = Z() - v, b = Z(), x = [1, 2].map((e) => wt(p, m, u, e, r)), S = new Float64Array(o), C = new Float64Array(o), w = Z(), T = bt(o, r), E = Z(), D = Kt(t), O = 1 / D, k = 0, A = 0, j = 0, M = Infinity, N = -Infinity;
	for (let e = 0; e < c; e++) for (let t = 0; t < s; t++) {
		let n = (e * s + t) * l;
		for (let e = 0; e < l; e++) S[e] = p[n + e], C[e] = m[n + e];
		for (let e = l; e < o; e++) S[e] = S[o - e], C[e] = -C[o - e];
		T.kernel === "mixed-radix" ? St(S, C, T.plan) : Ct(S, C, !1, T.plan);
		let r = (e * s + t) * o;
		for (let e = 0; e < o; e++) {
			let t = Math.fround(S[e] * O);
			h[r + e] = t, A += t, j += t * t, M = Math.min(M, t), N = Math.max(N, t), k = Math.max(k, Math.abs(C[e]));
		}
	}
	let P = Z(), F = P - b;
	x.unshift({
		axis: 0,
		length: o,
		lineCount: s * c,
		kernel: T.kernel,
		planCacheHit: T.cacheHit,
		planSetupTimeMs: T.setupTimeMs,
		kernelTimeMs: P - E,
		totalTimeMs: P - w
	}), x.forEach((e) => {
		e.factorization = mt(e.length);
	});
	let I = Math.max(...n.map((e) => xt(e, r))), L = [...new Set(x.map((e) => e.kernel))], R = Z(), z = Jt(h, k * O, {
		sum: A,
		sumSquared: j,
		minimum: M,
		maximum: N
	}), B = Z() - R;
	return {
		dimensions: n,
		...z,
		volume: D,
		fftBackend: L.length === 1 ? L[0] : "hybrid",
		fftAxisKernel: r,
		fftAxisStatistics: x,
		fftPlanSetupTimeMs: x.reduce((e, t) => e + t.planSetupTimeMs, 0),
		realTransform: !0,
		storedCoefficientCount: _,
		hermitianResidual: a.relative,
		workBufferBytes: I,
		allocatedBytes: p.byteLength + m.byteLength + h.byteLength + I,
		fftAllocationTimeMs: g,
		fftCoefficientPlacementTimeMs: y,
		fftTransformTimeMs: F,
		fftStatisticsTimeMs: B,
		symmetryCompatibleGrid: i.symmetryCompatible,
		fftGridPlanner: i.gridPlanner,
		gridFallbackReason: i.fallbackReason
	};
}
function Qt(e, t, n = 1, r = {}) {
	let i = Z(), a = "auto", o = Z(), s = it(e, n, {
		backend: "mixed-radix",
		symmetryOperations: r.symmetryOperations
	}), c = Z() - o;
	s.gridPlanner = "smooth", s.friedelImplicit = r.friedelImplicit === !0;
	let l = Z(), u = Yt(e, s.friedelImplicit), d = Z() - l, f;
	return u.relative <= 1e-10 ? f = Zt(e, t, s.dimensions, a, s, u) : (f = Xt(e, t, s.dimensions, a, s), f.fftFallbackReason = "non-hermitian-coefficients", f.hermitianResidual = u.relative), f.fftGridPlanningTimeMs = c, f.fftHermitianValidationTimeMs = d, f.fftTotalTimeMs = Z() - i, f;
}
function $t(e, t = 0, n = null, r = null, i = {}) {
	let a = new p(e), o = typeof t == "number" ? a.getBlock(t) : a.getBlockByName(t), c, u = "reflection", d = i.coordinateCifText, f = typeof d == "string" && d.length > 0, m = null, h = () => {
		if (!f) return null;
		if (m === null) {
			let n = d === e ? a : new p(d), r = i.coordinateCifBlock ?? t, o = typeof r == "number" ? n.getBlock(r) : n.getBlockByName(r);
			m = l.fromCIF(o);
		}
		return m;
	};
	try {
		c = l.fromCIF(o);
	} catch (e) {
		if (!/Unit cell parameter entries missing in CIF/.test(e.message) || !f) throw e;
		try {
			c = h(), u = "coordinate-fallback";
		} catch (e) {
			throw Error(`Reflection CIF does not contain a complete unit cell and the coordinate CIF fallback could not provide one: ${e.message}`, { cause: e });
		}
	}
	u === "reflection" && f && g(c, h(), "Reflection");
	let _ = s.fromCIF(o), v;
	try {
		v = o.get(n?.loop ?? "_refln");
	} catch (e) {
		throw n ? e : new Et(e.message);
	}
	let y = $(v, n?.h ?? ["_refln.index_h", "_refln_index_h"]), b = $(v, n?.k ?? ["_refln.index_k", "_refln_index_k"]), x = $(v, n?.l ?? ["_refln.index_l", "_refln_index_l"]), S = $(v, ["_refln.phase_calc", "_refln_phase_calc"], null), C = $(v, ["_refln.F_calc", "_refln_F_calc"], null), w = C === null ? $(v, ["_refln.F_squared_calc", "_refln_F_squared_calc"], null) : null, T = C ?? w?.map((e) => Math.sqrt(Math.max(0, Number(e)))), E, D;
	if (n) E = At(v, n), D = n.omitF000 ?? !1;
	else {
		if (S === null) throw new Et("None of the keys [_refln.phase_calc, _refln_phase_calc] found in CIF loop");
		let e = S, t = $(v, ["_refln.F_squared_meas", "_refln_F_squared_meas"], null), n = t === null ? $(v, ["_refln.F_meas", "_refln_F_meas"], null) : null, r = $(v, ["_refln.F_calc", "_refln_F_calc"], null), i = r === null ? $(v, ["_refln.F_squared_calc", "_refln_F_squared_calc"], null) : null;
		if (t === null && n === null) throw new Et("FCF contains neither measured F nor measured F-squared values");
		if (r === null && i === null) throw new Et("FCF contains neither calculated F nor calculated F-squared values");
		E = {
			mode: "fo-fc-common-phase",
			componentCount: 2,
			defaultAnomalousTarget: t !== null && i !== null ? "both" : "first",
			valueColumns: [
				e,
				t ?? n,
				r ?? i
			],
			coefficientAt(a) {
				let o = t === null ? Math.max(0, Number(n[a])) : Math.sqrt(Math.max(0, Number(t[a]))), s = i === null ? Math.abs(Number(r[a])) : Math.sqrt(Math.max(0, Number(i[a]))), c = Number(e[a]) * Math.PI / 180, l = o - s;
				return {
					real: l * Math.cos(c),
					imaginary: l * Math.sin(c)
				};
			}
		}, D = !0;
	}
	Dt([
		y,
		b,
		x,
		...E.valueColumns
	]);
	let O = E.coefficientAt, k = {
		enabled: !1,
		requested: !!r
	};
	if (r) {
		let e = r === !0 ? {} : r;
		if (typeof e != "object") throw Error("Anomalous-dispersion options must be true or an object");
		let t = Ft(o, e), n;
		if (e.phaseDetection === !1) n = {
			available: !1,
			disabled: !0
		};
		else {
			let t = It(_, y, b, x, S, Number(e.phaseToleranceDegrees) || .05);
			n = t.centrosymmetric ? t : Lt(y, b, x, S, T, Number(e.phaseToleranceDegrees) || .05, Number(e.friedelAmplitudeToleranceRelative) || 1e-4);
		}
		let i = n.disabled ? "phase-detection-disabled" : n.alreadyCorrected ? "phases-already-corrected" : !n.available && t !== "olex" ? "exact-test-unavailable" : null;
		if (i) k = {
			enabled: !1,
			requested: !0,
			generator: t,
			reason: i,
			phaseCheck: n
		};
		else {
			let r = e.target ?? E.defaultAnomalousTarget ?? "first", i = K(e.cifText, e.cifBlock ?? 0, e, c), a = Pt(r, E.componentCount);
			O = (e) => {
				let t = E.coefficientAt(e), n = i.coefficientAt(Number(y[e]), Number(b[e]), Number(x[e]));
				return {
					real: t.real + a * n.real,
					imaginary: t.imaginary + a * n.imaginary
				};
			}, k = {
				...i.metadata,
				requested: !0,
				generator: t,
				phaseCheck: n,
				target: r,
				correctionScale: a
			};
		}
	}
	let A = Bt(y, b, x, O, _, D, !0);
	return Vt({
		cell: c,
		coefficients: A,
		reflectionCount: y.length,
		coefficientMode: E.mode,
		omitF000: D,
		anomalousDispersion: k,
		sourceType: "fcf",
		cellSource: u,
		fieldKind: n ? "deformation-density" : "difference-density",
		friedelImplicit: !0
	}, _);
}
function en(e, t = 1, n = 1) {
	let r = Z();
	if (!(Number.isFinite(t) && t > 0 && t <= 1)) throw Error("Difference-density resolution fraction must be in the interval (0, 1]");
	let i = Z(), a = e.maximumReciprocalLength * t, o = t === 1 ? e.coefficients : new Map(Array.from(e.coefficients.entries()).filter(([, e]) => e.reciprocalLength <= a + 1e-12));
	if (o.size === 0) {
		let t = Infinity;
		for (let n of e.coefficients.values()) t = Math.min(t, n.reciprocalLength);
		o = /* @__PURE__ */ new Map();
		for (let [n, r] of e.coefficients) r.reciprocalLength <= t + 1e-12 && o.set(n, r);
	}
	let s = Z() - i;
	if (!(Number.isFinite(n) && n >= 1)) throw Error("Difference-density grid oversampling must be at least 1");
	let c = Qt(o, e.cell, n, {
		symmetryOperations: e.symmetryOperations,
		friedelImplicit: e.friedelImplicit
	}), l = Z(), u = 0;
	for (let e of o.values()) (e.h !== 0 || e.k !== 0 || e.l !== 0) && u++;
	let d = o.size + u, f = new Je(e.cell, c.dimensions, c.values, {
		reflectionCount: e.reflectionCount,
		coefficientCount: e.friedelImplicit ? d : o.size,
		fullCoefficientCount: e.friedelImplicit ? e.coefficients.size * 2 - !!e.coefficients.has("0,0,0") : e.coefficients.size,
		coefficientMode: e.coefficientMode,
		omitF000: e.omitF000,
		anomalousDispersion: e.anomalousDispersion,
		sourceType: e.sourceType,
		fieldKind: e.fieldKind,
		contourMode: "sigma",
		displayLabel: "Δρ/eÅ⁻³",
		quantityName: e.fieldKind === "deformation-density" ? "deformation density" : "difference density",
		valueUnit: "e/angstrom^3",
		surfaceSign: "both",
		boundaryMode: "periodic",
		intensityScale: e.intensityScale,
		intensityScaleExplicit: e.intensityScaleExplicit,
		scaleFittedReflectionCount: e.scaleFittedReflectionCount,
		scaleR1: e.scaleR1,
		negativeIntensityCount: e.negativeIntensityCount,
		observations: e.observations,
		iam: e.iam,
		reflectionPolicy: e.reflectionPolicy,
		extinctionCorrection: e.extinctionCorrection,
		solventMaskCorrection: e.solventMaskCorrection,
		symmetryOperations: e.symmetryOperations,
		resolutionFraction: t,
		gridOversampling: n,
		mean: c.mean,
		sigma: c.sigma,
		minimum: c.minimum,
		maximum: c.maximum,
		maxImaginary: c.maxImaginary,
		volume: c.volume,
		fftBackend: c.fftBackend,
		fftGridPlanner: c.fftGridPlanner,
		fftAxisKernel: c.fftAxisKernel,
		fftAxisStatistics: c.fftAxisStatistics,
		fftPlanSetupTimeMs: c.fftPlanSetupTimeMs,
		fftGridPlanningTimeMs: c.fftGridPlanningTimeMs,
		fftHermitianValidationTimeMs: c.fftHermitianValidationTimeMs,
		fftAllocationTimeMs: c.fftAllocationTimeMs,
		fftCoefficientPlacementTimeMs: c.fftCoefficientPlacementTimeMs,
		fftTransformTimeMs: c.fftTransformTimeMs,
		fftStatisticsTimeMs: c.fftStatisticsTimeMs,
		fftTotalTimeMs: c.fftTotalTimeMs,
		densityCoefficientSelectionTimeMs: s,
		realTransform: c.realTransform,
		storedCoefficientCount: c.storedCoefficientCount,
		hermitianResidual: c.hermitianResidual ?? null,
		fftAllocatedBytes: c.allocatedBytes,
		fftWorkBufferBytes: c.workBufferBytes,
		symmetryCompatibleGrid: c.symmetryCompatibleGrid,
		fftFallbackReason: c.fftFallbackReason ?? c.gridFallbackReason ?? null
	});
	return f.densityMapAssemblyTimeMs = Z() - l, f.densityMapTotalTimeMs = Z() - r, f;
}
//#endregion
//#region src/lib/density/cube.js
var tn = .529177210903, nn = /* @__PURE__ */ new Set([
	"density",
	"signed-density",
	"orbital",
	"potential",
	"generic"
]);
function rn(e, t) {
	return e[0] * t[0] + e[1] * t[1] + e[2] * t[2];
}
function an(e) {
	return Math.hypot(...e);
}
function on(e, t) {
	let n = Math.max(-1, Math.min(1, rn(e, t) / (an(e) * an(t))));
	return Math.acos(n) * 180 / Math.PI;
}
function sn(e) {
	return Array.isArray(e) ? e : e.toArray();
}
function cn(e, t, n) {
	let r = e.trim().split(/\s+/).map(Number);
	if (r.length < t || r.some((e) => !Number.isFinite(e))) throw Error(`Invalid Gaussian Cube ${n} line`);
	return r;
}
function ln(e, t, n) {
	if (!nn.has(e)) throw Error(`Cube property must be one of: ${Array.from(nn).join(", ")}`);
	let r = e === "density" || e === "signed-density", i = n.valueScale;
	if (i === void 0 && (i = r && t === "bohr" ? 1 / tn ** 3 : 1), !(Number.isFinite(i) && i !== 0)) throw Error("Cube valueScale must be a finite non-zero number");
	if (e === "density") return {
		valueScale: i,
		valueUnit: "e/angstrom^3",
		displayLabel: "ρ/eÅ⁻³",
		quantityName: "electron density",
		surfaceSign: "positive",
		defaultLevel: n.level ?? .3
	};
	if (e === "signed-density") return {
		valueScale: i,
		valueUnit: "e/angstrom^3",
		displayLabel: "Δρ/eÅ⁻³",
		quantityName: "signed density",
		surfaceSign: "both",
		defaultLevel: n.level ?? .05
	};
	let a = {
		orbital: ["ψ", "orbital"],
		potential: ["V", "potential"],
		generic: ["Cube", "Cube field"]
	};
	return {
		valueScale: i,
		valueUnit: n.valueUnit ?? "cube",
		displayLabel: n.displayLabel ?? a[e][0],
		quantityName: n.quantityName ?? a[e][1],
		surfaceSign: n.sign ?? "both",
		defaultLevel: n.level ?? null
	};
}
function un(e) {
	let t = 0, n = 0, r = Infinity, i = -Infinity;
	for (let a of e) t += a, n += a * a, r = Math.min(r, a), i = Math.max(i, a);
	let a = t / e.length;
	return {
		mean: a,
		sigma: Math.sqrt(Math.max(0, n / e.length - a * a)),
		minimum: r,
		maximum: i
	};
}
function dn(e, t = {}) {
	if (typeof e != "string" || e.trim().length === 0) throw Error("Cannot parse an empty Gaussian Cube file");
	let r = e.replace(/\r\n?/g, "\n").split("\n");
	if (r.length < 6) throw Error("Gaussian Cube file is missing its header");
	let i = [r[0], r[1]], a = cn(r[2], 4, "atom/origin"), o = Math.trunc(a[0]), s = Math.abs(o), c = a.slice(1, 4), u = a.length >= 5 ? Math.trunc(a[4]) : 1;
	if (u < 1) throw Error("Gaussian Cube dataset count must be positive");
	let f = [], p = [];
	for (let e = 0; e < 3; e++) {
		let t = cn(r[3 + e], 4, `axis ${e + 1}`);
		p.push(Math.trunc(t[0])), f.push(t.slice(1, 4));
	}
	if (p.some((e) => e === 0)) throw Error("Gaussian Cube grid dimensions must be non-zero");
	let m = p.every((e) => e > 0), h = p.every((e) => e < 0);
	if (!m && !h) throw Error("Gaussian Cube grid dimensions must use one consistent unit sign");
	let g = m ? "bohr" : "angstrom", _ = m ? tn : 1, v = p.map(Math.abs), y = c.map((e) => e * _), b = f.map((e) => e.map((e) => e * _)), x = [];
	if (r.length < 6 + s) throw Error("Gaussian Cube file ends inside its atom list");
	for (let e = 0; e < s; e++) {
		let t = cn(r[6 + e], 5, `atom ${e + 1}`);
		x.push({
			atomicNumber: Math.trunc(t[0]),
			charge: t[1],
			position: t.slice(2, 5).map((e) => e * _)
		});
	}
	let S = r.slice(6 + s).join(" ").trim().split(/\s+/).filter(Boolean), C = 0, w = u, T = Array.from({ length: w }, (e, t) => t + 1);
	if (o < 0) {
		if (w = Number(S[C++]), !(Number.isInteger(w) && w > 0)) throw Error("Gaussian Cube orbital dataset count is invalid");
		if (T = S.slice(C, C + w).map(Number), T.length !== w || T.some((e) => !Number.isFinite(e))) throw Error("Gaussian Cube orbital identifiers are incomplete");
		C += w;
	}
	let E = t.datasetIndex ?? 0;
	if (!(Number.isInteger(E) && E >= 0 && E < w)) throw Error(`Cube datasetIndex must be between 0 and ${w - 1}`);
	let D = v[0] * v[1] * v[2], O = D * w;
	if (S.length - C !== O) throw Error(`Gaussian Cube grid contains ${S.length - C} values; expected ${O}`);
	let k = t.property ?? "density", A = ln(k, g, t), j = new Float32Array(D);
	for (let e = 0; e < D; e++) {
		let t = Number(S[C + e * w + E]);
		if (!Number.isFinite(t)) throw Error(`Gaussian Cube grid value ${e + 1} is not finite`);
		let n = Math.floor(e / (v[1] * v[2])), r = e % (v[1] * v[2]), i = Math.floor(r / v[2]), a = (r % v[2] * v[1] + i) * v[0] + n;
		j[a] = t * A.valueScale;
	}
	let M = b.map((e, t) => e.map((e) => e * v[t]));
	if (M.some((e) => an(e) === 0)) throw Error("Gaussian Cube lattice vectors must be non-zero");
	let N = new l(an(M[0]), an(M[1]), an(M[2]), on(M[1], M[2]), on(M[0], M[2]), on(M[0], M[1])), P = sn(n(d([
		[
			M[0][0],
			M[1][0],
			M[2][0]
		],
		[
			M[0][1],
			M[1][1],
			M[2][1]
		],
		[
			M[0][2],
			M[1][2],
			M[2][2]
		]
	]), y)), F = un(j), I = A.defaultLevel ?? 3 * F.sigma;
	return new Je(N, v, j, {
		...F,
		comments: i,
		atoms: x,
		origin: y,
		originFractional: P,
		axisVectors: b,
		latticeVectors: M,
		coordinateUnit: g,
		datasetCount: w,
		datasetIds: T,
		datasetIndex: E,
		datasetId: T[E],
		property: k,
		valueScale: A.valueScale,
		valueUnit: A.valueUnit,
		displayLabel: A.displayLabel,
		quantityName: A.quantityName,
		surfaceSign: A.surfaceSign,
		defaultLevel: I,
		boundaryMode: t.periodic === !1 ? "zero" : "periodic",
		sourceType: "cube",
		fieldKind: k === "density" ? "electron-density" : k === "signed-density" ? "deformation-density" : k,
		contourMode: "absolute",
		resolutionFraction: 1,
		gridOversampling: 1
	});
}
//#endregion
export { Gt as a, Ue as c, ue as d, ee as f, g, F as h, Ut as i, We as l, V as m, dn as n, Je as o, J as p, en as r, Le as s, tn as t, de as u };
