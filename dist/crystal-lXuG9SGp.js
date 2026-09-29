//#region src/lib/read-cif/helpers.js
function e(e) {
	let t = 0, n = "";
	(e[t] === "+" || e[t] === "-") && (n = e[t++]);
	let r = t, i = 0;
	for (; e[t] >= "0" && e[t] <= "9";) t++, i++;
	if (e[t] === ".") for (t++; e[t] >= "0" && e[t] <= "9";) t++, i++;
	if (i === 0) return null;
	let a = e.slice(r, t), o = null;
	if (e[t] === "e" || e[t] === "E") {
		t++;
		let n = t;
		(e[t] === "+" || e[t] === "-") && t++;
		let r = t;
		for (; e[t] >= "0" && e[t] <= "9";) t++;
		if (t === r) return null;
		o = e.slice(n, t);
	}
	let s = null;
	if (e[t] === "(") {
		t++;
		let n = t;
		for (; e[t] >= "0" && e[t] <= "9";) t++;
		if (t === n || e[t] !== ")") return null;
		s = e.slice(n, t), t++;
	}
	return t === e.length ? {
		signString: n,
		numString: a,
		expString: o,
		suString: s
	} : null;
}
function t(t, n = !0, r = 1) {
	let i = e(t);
	if (n && i && i.expString !== null && i.suString !== null) {
		let { signString: e, numString: t, expString: n, suString: r } = i, a = e === "-" ? -1 : 1, o = parseFloat(t), s = parseInt(n), c = t.includes(".") ? t.split(".")[1].length : 0, l = Number(a * o * 10 ** s), u = s - c, d = Number(parseInt(r) * 10 ** u);
		return c - s >= 0 && c - s <= 100 ? {
			value: Number(l.toFixed(c - s)),
			su: Number(d.toFixed(c - s))
		} : {
			value: l,
			su: d
		};
	}
	if (i && i.expString !== null && i.suString === null) {
		let { signString: e, numString: t, expString: n } = i, r = e === "-" ? -1 : 1, a = t.includes(".") ? t.split(".")[1].length : 0, o = parseInt(n), s = Number(r * parseFloat(t) * 10 ** o);
		return a - o >= 0 && a - o <= 100 ? {
			value: Number(s.toFixed(a - o)),
			su: NaN
		} : {
			value: s,
			su: NaN
		};
	}
	if (n && i && i.expString === null && i.suString !== null) {
		let { signString: e, numString: t, suString: n } = i, r = e === "-" ? -1 : 1;
		if (t.includes(".")) {
			let e = t.split(".")[1].length;
			return {
				value: Number((r * parseFloat(t)).toFixed(e)),
				su: Number((10 ** -e * parseFloat(n)).toFixed(e))
			};
		} else return {
			value: r * parseInt(t),
			su: parseInt(n)
		};
	}
	if (isNaN(t)) {
		if (r === 2) return {
			value: t,
			su: NaN
		};
		let e = t[0];
		return (e === "\"" || e === "'") && t.at(-1) === e ? {
			value: t.slice(1, -1).replace(/\\([^\\])/g, "$1"),
			su: NaN
		} : {
			value: t.replace(/\\([^\\])/g, "$1"),
			su: NaN
		};
	} else return {
		value: t.includes(".") ? parseFloat(t) : parseInt(t),
		su: NaN
	};
}
function n(e, t) {
	let n = [e[t].slice(1)], r = e.slice(t + 1), i = r.findIndex((e) => e.startsWith(";"));
	i === -1 && console.warn(`Unterminated CIF multiline text field starting at input line ${t + 1}; treating end of file as the closing semicolon.`);
	let a = i === -1 ? r.length : i, o = n.concat(r.slice(0, a)), s = o.findIndex((e) => e.trim() !== ""), c = o.findLastIndex((e) => e.trim() !== "");
	return {
		value: s === -1 ? "" : o.slice(s, c + 1).join("\n"),
		endIndex: i === -1 ? e.length - 1 : t + i + 1
	};
}
//#endregion
//#region src/lib/read-cif/cif2-values.js
function r(e, n, r) {
	let o = e[n];
	if (!o) throw Error("Unexpected end of CIF2 value stream");
	switch (o.type) {
		case "value": {
			if (o.quoted) return {
				value: o.value,
				su: NaN,
				nextPos: n + 1
			};
			let e = t(o.value, r, 2);
			return {
				value: e.value,
				su: e.su,
				nextPos: n + 1
			};
		}
		case "listOpen": return i(e, n, r);
		case "tableOpen": return a(e, n, r);
		default: throw Error(`Unexpected token '${o.type}' where a CIF2 value was expected`);
	}
}
function i(e, t, n) {
	let i = [], a = t + 1;
	for (; e[a] && e[a].type !== "listClose";) {
		let t = r(e, a, n);
		i.push(t.value), a = t.nextPos;
	}
	if (!e[a]) throw Error("Unterminated CIF2 list value");
	return {
		value: i,
		su: NaN,
		nextPos: a + 1
	};
}
function a(e, t, n) {
	let i = /* @__PURE__ */ new Map(), a = t + 1;
	for (; e[a] && e[a].type !== "tableClose";) {
		let t = e[a];
		if (t.type !== "value") throw Error("CIF2 table key must be a quoted string");
		if (!e[a + 1] || e[a + 1].type !== "colon") throw Error(`CIF2 table entry for key '${t.value}' is missing its colon`);
		let o = r(e, a + 2, n);
		i.set(t.value, o.value), a = o.nextPos;
	}
	if (!e[a]) throw Error("Unterminated CIF2 table value");
	return {
		value: i,
		su: NaN,
		nextPos: a + 1
	};
}
function o(e, t) {
	let n = e[t];
	if (!n) throw Error("Unexpected end of CIF2 value stream");
	switch (n.type) {
		case "value": return t + 1;
		case "listOpen":
		case "tableOpen": {
			let r = {
				listOpen: "listClose",
				tableOpen: "tableClose"
			}, i = [n.type], a = t + 1;
			for (; a < e.length && i.length > 0;) {
				let t = e[a].type;
				if (t === "listOpen" || t === "tableOpen") i.push(t);
				else if (t === "listClose" || t === "tableClose") {
					let e = r[i[i.length - 1]];
					if (t !== e) throw Error(`Mismatched CIF2 container: expected '${e}' but found '${t}'`);
					i.pop();
				}
				a++;
			}
			if (i.length > 0) throw Error(n.type === "listOpen" ? "Unterminated CIF2 list value" : "Unterminated CIF2 table value");
			return a;
		}
		default: throw Error(`Unexpected token '${n.type}' where a CIF2 value was expected`);
	}
}
//#endregion
//#region src/lib/read-cif/loop.js
var s = /* @__PURE__ */ "_space_group_symop_ssg._space_group_symop._symmetry_equiv._geom_bond._geom_hbond._geom_angle._geom_torsion._diffrn_refln._refln._atom_site_fourier_wave_vector._atom_site_moment_fourier_param._atom_site_moment_special_func._atom_site_moment._atom_site_rotation._atom_site_displace_Fourier._atom_site_displace_special_func._atom_site_occ_Fourier._atom_site_occ_special_func._atom_site_phason._atom_site_rot_Fourier_param._atom_site_rot_Fourier._atom_site_rot_special_func._atom_site_U_Fourier._atom_site_anharm_gc_c._atom_site_anharm_gc_d._atom_site_aniso._atom_site".split(".");
function c(e) {
	let t = [], n = 0;
	for (; n < e.length;) {
		for (; n < e.length && /\s/u.test(e[n]);) n++;
		if (n === e.length) break;
		let r = n, i = e[n] === "'" || e[n] === "\"" ? e[n] : null;
		if (i !== null) {
			for (n++; n < e.length;) {
				if (e[n] === i && (n + 1 === e.length || /\s/u.test(e[n + 1]))) {
					t.push(e.slice(r, n + 1)), n++;
					break;
				}
				n++;
			}
			if (n >= e.length && e[n - 1] !== i) n = r;
			else continue;
		}
		let a = n;
		for (; n < e.length && !/\s/u.test(e[n]);) n++;
		t.push(e.slice(a, n));
	}
	return t;
}
var l = class e {
	constructor(e, t, n, r, i = null) {
		this.splitSU = r, this.headerLines = e, this.dataLines = t, this.endIndex = n, this.headers = null, this.data = null, this.name = null, i ? this.name = i : this.name = this.findCommonStart();
	}
	static fromLines(t, n) {
		let r = 1;
		for (; r < t.length && t[r].trim().startsWith("_");) r++;
		let i = t.slice(1, r).map((e) => e.trim()), a = r, o = !1;
		for (; a < t.length && (!t[a].trim().startsWith("_") && !t[a].trim().startsWith("loop_") || o);) t[a].startsWith(";") && (o = !o), a++;
		let s = t.slice(r, a);
		return new e(i, s, a, n);
	}
	static fromTokens(t, n, r, i) {
		let a = new e(t, [], 0, i);
		return a._cif2Tokens = n, a._cif2CellTokenRanges = r, a;
	}
	parse() {
		if (this.data !== null) return;
		this.headers = [...this.headerLines], this.data = {};
		let e;
		if (this._cif2CellTokenRanges !== void 0) e = this._cif2CellTokenRanges.map(([e]) => {
			let t = r(this._cif2Tokens, e, this.splitSU);
			return {
				value: t.value,
				su: t.su
			};
		});
		else {
			e = [];
			for (let r = 0; r < this.dataLines.length; r++) {
				let i = this.dataLines[r].trim();
				if (i.length) {
					if (i.startsWith(";")) {
						let t = n(this.dataLines, r);
						e.push({
							value: t.value,
							su: NaN
						});
						for (let e = r; e < t.endIndex + 1; e++) this.dataLines[e] = "";
						continue;
					}
					for (let n of c(i)) e.push(t(n, this.splitSU));
				}
			}
		}
		let i = this.headers.length;
		if (e.length % i !== 0) {
			let t = e.map(({ value: e, su: t }) => `{value: ${e}, su: ${t}}`).join(", ");
			throw Error(`Loop ${this.name}: Cannot distribute ${e.length} values evenly into ${i} columns\nentries are: ${t}`);
		} else if (e.length === 0) throw Error(`Loop ${this.name} has no data values.`);
		let a = Array.from({ length: i }, () => []), o = Array.from({ length: i }, () => []), s = new Uint8Array(i);
		for (let t = 0; t < e.length; t++) {
			let n = t % i, r = e[t];
			a[n].push(r.value), o[n].push(r.su), isNaN(r.su) || (s[n] = 1);
		}
		for (let e = 0; e < i; e++) {
			let t = this.headers[e];
			this.data[t] = a[e], s[e] && (this.data[t + "_su"] = o[e], this.headers.push(t + "_su"));
		}
	}
	findCommonStart(e = !0) {
		if (e) {
			for (let e of s) if (this.headerLines.filter((t) => t.toLowerCase().startsWith(e.toLowerCase())).length >= this.headerLines.length / 2) return e;
		}
		let t = this.headerLines.map((e) => e.split("."));
		if (t[0].length > 1) {
			let e = t[0][0];
			if (this.headerLines.filter((t) => t.split(".")[0] === e).length >= this.headerLines.length / 2) return e;
		}
		let n = this.headerLines.map((e) => e.split(/[_.]/).filter((e) => e)), r = Math.min(...n.map((e) => e.length)), i = "";
		for (let e = 0; e < r; e++) {
			let t = n[0][e], r = n.filter((n) => n[e] === t).length;
			if (this.headerLines.length === 2) if (r === 2) i += "_" + t;
			else break;
			else if (r >= this.headerLines.length / 2) i += "_" + t;
			else break;
		}
		return i;
	}
	get(e, t = null) {
		this.parse();
		let n = Array.isArray(e) ? e : [e];
		for (let e of n) {
			let t = this.data[e];
			if (t !== void 0) return t;
		}
		if (t !== null) return t;
		throw Error(`None of the keys [${n.join(", ")}] found in CIF loop ${this.name}`);
	}
	getIndex(e, t, n = null) {
		this.parse();
		let r = Array.isArray(e) ? e : [e];
		if (!r.some((e) => this.headers.includes(e))) {
			if (n !== null) return n;
			throw Error(`None of the keys [${r.join(", ")}] found in CIF loop ${this.name}`);
		}
		let i = this.get(r);
		if (t < i.length) return i[t];
		throw Error(`Tried to look up value of index ${t} in ${this.name}, but length is only ${i.length}`);
	}
	getHeaders() {
		return this.headers || this.parse(), this.headers;
	}
	getName() {
		return this.name;
	}
	getEndIndex() {
		return this.endIndex;
	}
};
function u(e) {
	return e && typeof e.getHeaders == "function";
}
function d(e) {
	return e.getHeaders()[0].split("_").filter((e) => e.length > 0);
}
function f(e, t, n) {
	let r = u(e) ? e : t, i = n.split("_").filter((e) => e.length > 0), a = d(r), o = "_" + i.join("_") + "_" + a[i.length];
	return u(e) ? [o, n] : [n, o];
}
function p(e, t) {
	let n = e.findCommonStart(!1), r = t.findCommonStart(!1);
	return n.length === r.length ? null : [n, r];
}
function m(e, t, n) {
	let r = n.split("_").filter((e) => e.length > 0), i = d(e), a = d(t);
	return i.length >= a.length ? [n + "_" + i[r.length], n] : [n, n + "_" + a[r.length]];
}
function h(e, t, n) {
	let r;
	r = !u(e) || !u(t) ? f(e, t, n) : p(e, t) || m(e, t, n);
	let i = [e, t];
	return i.forEach((e, t) => {
		u(e) && (e.name = r[t]);
	}), {
		newNames: r,
		newEntries: i
	};
}
//#endregion
//#region src/lib/math-lite.js
var g = class e {
	constructor(e) {
		this._data = e;
	}
	toArray() {
		return this._data;
	}
	size() {
		return Array.isArray(this._data[0]) ? [this._data.length, this._data[0].length] : [this._data.length];
	}
	get(e) {
		return e.length === 2 ? this._data[e[0]][e[1]] : this._data[e[0]];
	}
	map(t) {
		let n = Array.isArray(this._data[0]) ? this._data.map((e, n) => e.map((e, r) => t(e, [n, r], this))) : this._data.map((e, n) => t(e, [n], this));
		return new e(n);
	}
};
function _(e) {
	return e instanceof g ? _(e.toArray()) : Array.isArray(e) ? e.map(_) : e;
}
function v(e, t) {
	return e.some((e) => e instanceof g) ? new g(t) : t;
}
function y(e, t, n) {
	return Array.isArray(e) && Array.isArray(t) ? e.map((e, r) => y(e, t[r], n)) : n(e, t);
}
function b(e) {
	return new g(_(e));
}
function ee(e, t) {
	let n = [
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
	for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) n[r][i] = e[r][0] * t[0][i] + e[r][1] * t[1][i] + e[r][2] * t[2][i];
	return n;
}
function te(e, t) {
	return [
		e[0][0] * t[0] + e[0][1] * t[1] + e[0][2] * t[2],
		e[1][0] * t[0] + e[1][1] * t[1] + e[1][2] * t[2],
		e[2][0] * t[0] + e[2][1] * t[1] + e[2][2] * t[2]
	];
}
function x(e) {
	return e.length === 3 && e[0].length === 3 && e[1].length === 3 && e[2].length === 3;
}
function S(e, t) {
	let n = _(e), r = _(t), i;
	if (typeof r == "number") i = Array.isArray(n[0]) ? n.map((e) => e.map((e) => e * r)) : n.map((e) => e * r);
	else if (typeof n == "number") i = Array.isArray(r[0]) ? r.map((e) => e.map((e) => e * n)) : r.map((e) => e * n);
	else if (Array.isArray(n[0]) && Array.isArray(r[0])) i = x(n) && x(r) ? ee(n, r) : n.map((e, t) => e.map((i, a) => e.reduce((e, i, o) => e + n[t][o] * r[o][a], 0)));
	else if (Array.isArray(n[0])) i = x(n) && r.length === 3 ? te(n, r) : n.map((e) => e.reduce((e, t, n) => e + t * r[n], 0));
	else throw Error("multiply: unsupported operand shapes");
	return v([e, t], i);
}
function C(e, t) {
	return v([e, t], y(_(e), _(t), (e, t) => e + t));
}
function ne(e, t) {
	return v([e, t], y(_(e), _(t), (e, t) => e - t));
}
function w(e) {
	let t = _(e), n = t[0].map((e, n) => t.map((e) => e[n]));
	return v([e], n);
}
function T(e) {
	let t = _(e);
	if (t.length !== 3) throw Error("det: only 3x3 matrices are supported");
	return t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0]) + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0]);
}
function E(e) {
	let t = _(e);
	if (t.length !== 3) throw Error("inv: only 3x3 matrices are supported");
	let n = T(t);
	if (n === 0) throw Error("inv: matrix is singular");
	let r = [
		[
			t[1][1] * t[2][2] - t[1][2] * t[2][1],
			-(t[1][0] * t[2][2] - t[1][2] * t[2][0]),
			t[1][0] * t[2][1] - t[1][1] * t[2][0]
		],
		[
			-(t[0][1] * t[2][2] - t[0][2] * t[2][1]),
			t[0][0] * t[2][2] - t[0][2] * t[2][0],
			-(t[0][0] * t[2][1] - t[0][1] * t[2][0])
		],
		[
			t[0][1] * t[1][2] - t[0][2] * t[1][1],
			-(t[0][0] * t[1][2] - t[0][2] * t[1][0]),
			t[0][0] * t[1][1] - t[0][1] * t[1][0]
		]
	], i = r.map((e, t) => e.map((e, i) => r[i][t] / n));
	return v([e], i);
}
function re(e) {
	let t = _(e), n = t.length, r = Array.from({ length: n }, (e, r) => Array.from({ length: n }, (e, n) => r === n ? t[r] : 0));
	return v([e], r);
}
function ie(e) {
	let t = _(e);
	return Math.sqrt(t.reduce((e, t) => e + t * t, 0));
}
function D(e, t) {
	if (t !== "deg") throw Error(`unit: unsupported unit '${t}'`);
	return { toNumber(t) {
		if (t !== "rad") throw Error(`unit: unsupported conversion to '${t}'`);
		return e * Math.PI / 180;
	} };
}
function ae(e) {
	return Array.from({ length: e }, (t, n) => Array.from({ length: e }, (e, t) => +(n === t)));
}
function O(e) {
	let t = _(e), n = Array.isArray(t[0]) ? t.map((e) => [...e]) : [...t];
	return v([e], n);
}
var oe = (e) => Math.min(..._(e));
function se(e) {
	let t = e.map((e) => [...e]), n = ae(3);
	for (let e = 0; e < 100; e++) {
		let e = 0;
		for (let n = 0; n < 3; n++) for (let r = n + 1; r < 3; r++) e += t[n][r] * t[n][r];
		if (e < 1e-28) break;
		for (let e = 0; e < 3; e++) for (let r = e + 1; r < 3; r++) {
			if (Math.abs(t[e][r]) < 1e-300) continue;
			let i = (t[r][r] - t[e][e]) / (2 * t[e][r]), a = (i >= 0 ? 1 : -1) / (Math.abs(i) + Math.sqrt(i * i + 1)), o = 1 / Math.sqrt(a * a + 1), s = a * o, c = t[e][e], l = t[r][r], u = t[e][r];
			t[e][e] = o * o * c - 2 * s * o * u + s * s * l, t[r][r] = s * s * c + 2 * s * o * u + o * o * l, t[e][r] = 0, t[r][e] = 0;
			for (let n = 0; n < 3; n++) if (n !== e && n !== r) {
				let i = t[n][e], a = t[n][r];
				t[n][e] = o * i - s * a, t[e][n] = t[n][e], t[n][r] = s * i + o * a, t[r][n] = t[n][r];
			}
			for (let t = 0; t < 3; t++) {
				let i = n[t][e], a = n[t][r];
				n[t][e] = o * i - s * a, n[t][r] = s * i + o * a;
			}
		}
	}
	let r = [
		0,
		1,
		2
	].sort((e, n) => t[e][e] - t[n][n]);
	return {
		eigenvalues: r.map((e) => t[e][e]),
		eigenvectors: r.map((e) => [
			n[0][e],
			n[1][e],
			n[2][e]
		])
	};
}
function k(e) {
	let { eigenvalues: t, eigenvectors: n } = se(_(e));
	return {
		values: t,
		eigenvectors: t.map((e, t) => ({
			value: e,
			vector: new g(n[t])
		}))
	};
}
//#endregion
//#region src/lib/structure/fract-to-cart.js
function A(e) {
	let t = D(e.alpha, "deg").toNumber("rad"), n = D(e.beta, "deg").toNumber("rad"), r = D(e.gamma, "deg").toNumber("rad"), i = Math.cos(t), a = Math.cos(n), o = Math.cos(r), s = Math.sin(r), c = Math.sqrt(1 - i * i - a * a - o * o + 2 * i * a * o);
	return b([
		[
			e.a,
			e.b * o,
			e.c * a
		],
		[
			0,
			e.b * s,
			e.c * (i - a * o) / s
		],
		[
			0,
			0,
			e.c * c / s
		]
	]);
}
function ce(e) {
	return b([
		[
			e[0],
			e[3],
			e[4]
		],
		[
			e[3],
			e[1],
			e[5]
		],
		[
			e[4],
			e[5],
			e[2]
		]
	]);
}
function le(e) {
	let t = b(e);
	return [
		t.get([0, 0]),
		t.get([1, 1]),
		t.get([2, 2]),
		t.get([0, 1]),
		t.get([0, 2]),
		t.get([1, 2])
	];
}
function ue(e, t) {
	let n = b(e), r = re(b(w(w(E(n))).toArray().map((e) => ie(e))));
	return le(S(S(n, S(S(r, ce(t)), w(r))), w(n)));
}
//#endregion
//#region src/lib/structure/position.js
var de = class e {
	#e;
	constructor(t, n, r) {
		if (new.target === e) throw TypeError("BasePosition is an abstract class and cannot be instantiated directly, you probably want CartPosition");
		this.#e = [
			Number(t),
			Number(n),
			Number(r)
		], Object.defineProperties(this, {
			0: { get: () => this.#e[0] },
			1: { get: () => this.#e[1] },
			2: { get: () => this.#e[2] },
			length: { value: 3 },
			[Symbol.iterator]: { value: function* () {
				yield this.#e[0], yield this.#e[1], yield this.#e[2];
			} }
		});
	}
	get x() {
		return this.#e[0];
	}
	get y() {
		return this.#e[1];
	}
	get z() {
		return this.#e[2];
	}
	set x(e) {
		this.#e[0] = e;
	}
	set y(e) {
		this.#e[1] = e;
	}
	set z(e) {
		this.#e[2] = e;
	}
	toCartesian(e) {
		throw Error("toCartesian must be implemented by subclass");
	}
}, j = class extends de {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return new F(...S(e.fractToCartMatrix, b([
			this.x,
			this.y,
			this.z
		])).toArray());
	}
}, fe = /* @__PURE__ */ new WeakMap(), M = .001;
function N(e) {
	let t = fe.get(e);
	return t || (t = e.fractToCartMatrix.toArray(), fe.set(e, t)), t;
}
function P(e) {
	return (e % 1 + 1) % 1;
}
function pe(e, t) {
	let n = N(t), r = P(e.x), i = P(e.y), a = P(e.z);
	return [
		n[0][0] * r + n[0][1] * i + n[0][2] * a,
		n[1][0] * r + n[1][1] * i + n[1][2] * a,
		n[2][0] * r + n[2][1] * i + n[2][2] * a
	];
}
function me(e, t, n, r = M) {
	let i = N(n), a = e.x - t.x - Math.round(e.x - t.x), o = e.y - t.y - Math.round(e.y - t.y), s = e.z - t.z - Math.round(e.z - t.z), c = i[0][0] * a + i[0][1] * o + i[0][2] * s, l = i[1][0] * a + i[1][1] * o + i[1][2] * s, u = i[2][0] * a + i[2][1] * o + i[2][2] * s;
	return Math.hypot(c, l, u) < r;
}
function he(e, t, n, r = M) {
	let i = N(n), a = e.x - t.x, o = e.y - t.y, s = e.z - t.z, c = i[0][0] * a + i[0][1] * o + i[0][2] * s, l = i[1][0] * a + i[1][1] * o + i[1][2] * s, u = i[2][0] * a + i[2][1] * o + i[2][2] * s;
	return Math.hypot(c, l, u) < r;
}
var F = class extends de {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return this;
	}
}, ge = class {
	static fromCIF(e, t) {
		let n = !1, r = e.get("_atom_site"), i = [".", "?"];
		if (String(r.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], t, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		try {
			let e = r.getIndex(["_atom_site.fract_x", "_atom_site_fract_x"], t), a = r.getIndex(["_atom_site.fract_y", "_atom_site_fract_y"], t), o = r.getIndex(["_atom_site.fract_z", "_atom_site_fract_z"], t);
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new j(e, a, o);
			n = !0;
		} catch {}
		try {
			let e = r.getIndex([
				"_atom_site.Cartn_x",
				"_atom_site.cartn_x",
				"_atom_site_Cartn_x"
			], t), a = r.getIndex([
				"_atom_site.Cartn_y",
				"_atom_site.cartn_y",
				"_atom_site_Cartn_y"
			], t), o = r.getIndex([
				"_atom_site.Cartn_z",
				"_atom_site.cartn_z",
				"_atom_site_Cartn_z"
			], t);
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new F(e, a, o);
			n = !0;
		} catch {}
		throw Error(n ? "Dummy atom: Invalid position" : "Invalid position: No valid fractional or Cartesian coordinates found");
	}
}, I = class e {
	constructor(e) {
		this.uiso = e;
	}
	static fromBiso(t) {
		return new e(t / (8 * Math.PI * Math.PI));
	}
}, L = class e {
	constructor(e, t, n, r, i, a) {
		this.u11 = e, this.u22 = t, this.u33 = n, this.u12 = r, this.u13 = i, this.u23 = a;
	}
	static fromBani(t, n, r, i, a, o) {
		let s = 1 / (8 * Math.PI * Math.PI);
		return new e(t * s, n * s, r * s, i * s, a * s, o * s);
	}
	getUCart(e) {
		return ue(e.fractToCartMatrix, [
			this.u11,
			this.u22,
			this.u33,
			this.u12,
			this.u13,
			this.u23
		]);
	}
	getEllipsoidMatrix(e) {
		let t = R(this, e);
		return t.valid ? b(S(t.rotation, re(t.eigenvalues.map(Math.sqrt)))) : b([
			[
				NaN,
				NaN,
				NaN
			],
			[
				NaN,
				NaN,
				NaN
			],
			[
				NaN,
				NaN,
				NaN
			]
		]);
	}
};
function R(e, t) {
	let n = {
		eigenvalues: [
			NaN,
			NaN,
			NaN
		],
		rotation: [
			[
				1,
				0,
				0
			],
			[
				0,
				1,
				0
			],
			[
				0,
				0,
				1
			]
		],
		valid: !1,
		tolerance: NaN
	};
	try {
		let { eigenvectors: r } = k(ce(e.getUCart(t))), i = r.map((e) => ({
			value: Number(e.value),
			vector: (e.vector.toArray?.() || e.vector).map(Number)
		})).sort((e, t) => t.value - e.value);
		if (i.length !== 3 || i.some((e) => !Number.isFinite(e.value) || e.vector.some((e) => !Number.isFinite(e)))) return n;
		for (let e of i) {
			let t = 0;
			for (let n = 1; n < 3; n++) Math.abs(e.vector[n]) > Math.abs(e.vector[t]) && (t = n);
			e.vector[t] < 0 && (e.vector = e.vector.map((e) => -e));
		}
		let a = w(i.map((e) => e.vector));
		if (T(a) < 0) for (let e = 0; e < 3; e++) a[e][2] *= -1;
		let o = i.map((e) => e.value), s = o[0], c = Math.max(1e-12, Math.abs(s) * 1e-10);
		return {
			eigenvalues: o,
			rotation: a,
			valid: Number.isFinite(s) && o.every((e) => Number.isFinite(e) && e > c),
			tolerance: c
		};
	} catch {
		return n;
	}
}
function _e(e, t, n) {
	let r = R(e, t), i = Number.isFinite(n) && n > 0, a = Math.max(...r.eigenvalues.map(Math.abs)), o = Math.max(1e-12, a * 1e-10), s = r.eigenvalues.every(Number.isFinite) && Number.isFinite(a) && a > o, c = s ? r.eigenvalues.map((e) => e / a) : [
		NaN,
		NaN,
		NaN
	], l = c.map((e) => -e), u = s && i ? Math.sqrt(a) : NaN, d = s ? [r.eigenvalues.some((e) => e > o) && {
		sign: "positive",
		normalizedShape: c
	}, r.eigenvalues.some((e) => e < -o) && {
		sign: "negative",
		normalizedShape: l
	}].filter(Boolean) : [], f = w(r.rotation), p = (e) => {
		if (!Array.isArray(e) || e.length !== 3) return null;
		let t = Math.hypot(e[0], e[1], e[2]);
		return t > 0 ? e.map((e) => e / t) : null;
	};
	return {
		kind: "rmsd-peanut",
		eigenvalues: r.eigenvalues,
		rotation: r.rotation,
		maxScale: u,
		normalizedShape: c,
		complementaryShape: l,
		components: d,
		boundingRadius: s && i ? n * u : 0,
		valid: s && i,
		localRadialScale: (e) => {
			let t = p(e);
			return !s || !t ? 0 : Math.sqrt(Math.abs(c.reduce((e, n, r) => e + n * t[r] * t[r], 0)));
		},
		localNormal: (e) => {
			let t = p(e);
			if (!s || !t) return [
				0,
				0,
				0
			];
			let n = c.reduce((e, n, r) => e + n * t[r] * t[r], 0), r = Math.abs(n), i = n >= 0 ? c : l, a = t.map((e, t) => 2 * r * e - i[t] * e), o = Math.hypot(...a);
			return o > 0 ? a.map((e) => e / o) : [
				0,
				0,
				0
			];
		},
		surfaceDistanceAlong: (e) => {
			let t = p(e);
			if (!s || !i || !t) return 0;
			let a = S(f, t), o = r.eigenvalues.reduce((e, t, n) => e + t * a[n] * a[n], 0);
			return n * Math.sqrt(Math.abs(o));
		}
	};
}
function ve(e) {
	let t = e < 0 ? -1 : 1, n = Math.abs(e), r = 1 / (1 + .3275911 * n);
	return t * (1 - ((((1.061405429 * r + -1.453152027) * r + 1.421413741) * r + -.284496736) * r + .254829592) * r * Math.exp(-n * n));
}
function ye(e) {
	return e <= 0 ? 0 : ve(Math.sqrt(e / 2)) - Math.sqrt(2 * e / Math.PI) * Math.exp(-e / 2);
}
function be(e) {
	if (!(Number.isFinite(e) && e > 0 && e < 1)) throw Error("Ellipsoid probability must be a finite number between 0 and 1");
	let t = 0, n = 100;
	for (let r = 0; r < 100; r++) {
		let r = (t + n) / 2;
		ye(r) < e ? t = r : n = r;
	}
	return Math.sqrt((t + n) / 2);
}
var xe = class e {
	static fromCIF(t, n) {
		let r = t.get("_atom_site"), i = r.getIndex(["_atom_site.label", "_atom_site_label"], n), a = r.getIndex([
			"_atom_site.adp_type",
			"_atom_site_adp_type",
			"_atom_site.thermal_displace_type",
			"_atom_site_thermal_displace_type"
		], n, !1);
		if (a) return e.createFromExplicitType(t, n, i, a);
		if (e.isInAnisoLoop(t, i)) {
			let n = e.createUani(t, i);
			if (n !== null) return n;
			let r = e.createBani(t, i);
			if (r !== null) return r;
		}
		let o = e.createUiso(t, n);
		if (o !== null) return o;
		let s = e.createBiso(t, n);
		return s === null ? null : s;
	}
	static createFromExplicitType(t, n, r, i) {
		switch (i.toLowerCase()) {
			case "uani": return e.createUani(t, r);
			case "aniso": return e.createUani(t, r);
			case "bani": return e.createBani(t, r);
			case "uiso": return e.createUiso(t, n);
			case "iso": return e.createUiso(t, n);
			case "biso": return e.createBiso(t, n);
			default: return null;
		}
	}
	static isInAnisoLoop(e, t) {
		try {
			return e.get("_atom_site_aniso").get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).includes(t);
		} catch {
			return !1;
		}
	}
	static createUani(e, t) {
		let n;
		try {
			n = e.get("_atom_site_aniso");
		} catch {
			throw Error(`Atom ${t} had ADP type UAni, but no atom_site_aniso loop was found`);
		}
		let r = n.get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).indexOf(t);
		if (r === -1) throw Error(`Atom ${t} has ADP type Uani, but was not found in atom_site_aniso.label`);
		let i = n.getIndex(["_atom_site_aniso.u_11", "_atom_site_aniso_U_11"], r, NaN), a = n.getIndex(["_atom_site_aniso.u_22", "_atom_site_aniso_U_22"], r, NaN), o = n.getIndex(["_atom_site_aniso.u_33", "_atom_site_aniso_U_33"], r, NaN), s = n.getIndex(["_atom_site_aniso.u_12", "_atom_site_aniso_U_12"], r, NaN), c = n.getIndex(["_atom_site_aniso.u_13", "_atom_site_aniso_U_13"], r, NaN), l = n.getIndex(["_atom_site_aniso.u_23", "_atom_site_aniso_U_23"], r, NaN);
		return [
			i,
			a,
			o,
			s,
			c,
			l
		].some(isNaN) ? null : new L(i, a, o, s, c, l);
	}
	static createBani(e, t) {
		let n;
		try {
			n = e.get("_atom_site_aniso");
		} catch {
			throw Error(`Atom ${t} had ADP type BAni, but no atom_site_aniso loop was found`);
		}
		let r = n.get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).indexOf(t);
		if (r === -1) throw Error(`Atom ${t} has ADP type Bani, but was not found in atom_site_aniso.label`);
		let i = n.getIndex(["_atom_site_aniso.b_11", "_atom_site_aniso_B_11"], r, NaN), a = n.getIndex(["_atom_site_aniso.b_22", "_atom_site_aniso_B_22"], r, NaN), o = n.getIndex(["_atom_site_aniso.b_33", "_atom_site_aniso_B_33"], r, NaN), s = n.getIndex(["_atom_site_aniso.b_12", "_atom_site_aniso_B_12"], r, NaN), c = n.getIndex(["_atom_site_aniso.b_13", "_atom_site_aniso_B_13"], r, NaN), l = n.getIndex(["_atom_site_aniso.b_23", "_atom_site_aniso_B_23"], r, NaN);
		return [
			i,
			a,
			o,
			s,
			c,
			l
		].some(isNaN) ? null : L.fromBani(i, a, o, s, c, l);
	}
	static createUiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : new I(n);
		} catch {
			return null;
		}
	}
	static createBiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.b_iso_or_equiv", "_atom_site_B_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : I.fromBiso(n);
		} catch {
			return null;
		}
	}
};
//#endregion
//#region src/lib/structure/position-code.js
function z(e, t = null) {
	if (e == null || e === "." || e === "?") return ".";
	let n = String(e).trim();
	if (n === "" || n === "." || n === "?") return ".";
	if (n.includes("_")) return n;
	let r = (e) => (t instanceof Map || t instanceof Set) && t.has(e), i = n.match(/^(\d+)(\d{3})$/);
	return i && t && !r(n) && r(i[1]) ? `${i[1]}_${i[2]}` : `${n}_555`;
}
function B(e) {
	if (e == null) throw Error(`Invalid symmetry position code: ${e}`);
	let t = String(e).trim();
	if (t === "") throw Error("Invalid empty symmetry position code");
	let n = t.match(/^([^_]+)_\[(-?\d+),(-?\d+),(-?\d+)\]$/);
	if (n) return {
		id: n[1],
		translation: n.slice(2).map(Number)
	};
	let r = t.match(/^([^_]+)_([0-9]{3})$/);
	if (r) return {
		id: r[1],
		translation: r[2].split("").map((e) => Number(e) - 5)
	};
	if (!t.includes("_")) return {
		id: t,
		translation: [
			0,
			0,
			0
		]
	};
	throw Error(`Invalid symmetry position code ${t}; expected "<id>_abc" or "<id>_[x,y,z]"`);
}
function V(e, t) {
	let n = String(e);
	if (!n || n.includes("_")) throw Error(`Invalid symmetry operation ID: ${e}`);
	if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isInteger)) throw Error(`Invalid symmetry translation: ${t}`);
	let r = t.map((e) => e + 5);
	return r.every((e) => e >= 0 && e <= 9) ? `${n}_${r.join("")}` : `${n}_[${t.join(",")}]`;
}
//#endregion
//#region src/lib/structure/symmetry-expression.js
function Se(e) {
	if (e.length === 0) return null;
	let t = -1, n = !1, r = 0, i = 0;
	for (let a = 0; a < e.length; a++) {
		let o = e[a];
		if (o >= "0" && o <= "9") {
			r++;
			continue;
		}
		if (o === "." && !n) {
			n = !0;
			continue;
		}
		if (o === "/" && t === -1 && r > 0) {
			t = a, i = r, r = 0, n = !1;
			continue;
		}
		return null;
	}
	if (r === 0) return null;
	if (t === -1) return Number(e);
	if (i === 0) return null;
	let a = Number(e.slice(t + 1));
	return Number(e.slice(0, t)) / a;
}
function Ce(e) {
	let t = [];
	for (let n of e) n.trim() !== "" && t.push(n.toUpperCase());
	let n = t.join(""), r = [
		0,
		0,
		0
	], i = 0, a = 0;
	for (let e = 1; e <= n.length; e++) {
		let t = e === n.length, o = n[e];
		if (!t && o !== "+" && o !== "-") continue;
		let s = n.slice(a, e);
		if (a = e, s.length === 0) continue;
		let c = 1;
		if ((s[0] === "+" || s[0] === "-") && (c = s[0] === "-" ? -1 : 1, s = s.slice(1)), s.length === 0) continue;
		let l = "XYZ".indexOf(s[s.length - 1]);
		if (l !== -1) {
			let e = s.slice(0, -1);
			e.endsWith("*") && (e = e.slice(0, -1));
			let t = e === "" ? 1 : Se(e);
			t !== null && (r[l] = c * t);
			continue;
		}
		let u = Se(s);
		u !== null && (i += c * u);
	}
	return {
		coefficients: r,
		translation: i
	};
}
//#endregion
//#region src/lib/structure/rhombohedral-setting.js
var we = [
	[
		1,
		0,
		1
	],
	[
		-1,
		1,
		1
	],
	[
		0,
		-1,
		1
	]
], Te = [
	[
		2 / 3,
		-1 / 3,
		-1 / 3
	],
	[
		1 / 3,
		1 / 3,
		-2 / 3
	],
	[
		1 / 3,
		1 / 3,
		1 / 3
	]
], H = 12;
function Ee(e, t) {
	return e.map((e) => [
		0,
		1,
		2
	].map((n) => e[0] * t[0][n] + e[1] * t[1][n] + e[2] * t[2][n]));
}
function De(e, t) {
	return e.map((e) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2]);
}
function Oe(e) {
	return (Math.round(e * H) / H % 1 + 1) % 1;
}
function ke(e, t) {
	let n = [
		"x",
		"y",
		"z"
	], r = "";
	if (e.forEach((e, t) => {
		let i = Math.round(e);
		i !== 0 && (i > 0 && r !== "" && (r += "+"), i === -1 ? r += "-" : i !== 1 && (r += String(i)), r += n[t]);
	}), t !== 0) {
		let e = Math.round(t * H), n = Ae(e, H);
		r += `+${e / n}/${H / n}`;
	}
	return r === "" ? "0" : r;
}
function Ae(e, t) {
	return t === 0 ? e : Ae(t, e % t);
}
function je(e, t = .001, n = .01) {
	if (!e) return !1;
	let { a: r, b: i, c: a, alpha: o, beta: s, gamma: c } = e;
	if (![
		r,
		i,
		a,
		o,
		s,
		c
	].every(Number.isFinite)) return !1;
	let l = Math.abs(r - i) < t && Math.abs(i - a) < t, u = Math.abs(o - s) < n && Math.abs(s - c) < n;
	return l && u && Math.abs(o - 90) > n;
}
function Me(e) {
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e) {
		let { rotation: e, translation: i } = Ne(r), a = Ee(Ee(we, e), Te), o = De(we, i).map(Oe), s = a.map((e) => e.map((e) => Math.round(e)).join(",")).join(";") + "|" + o.map((e) => Math.round(e * H)).join(",");
		t.has(s) || (t.add(s), n.push([
			0,
			1,
			2
		].map((e) => ke(a[e], o[e])).join(",")));
	}
	return n;
}
function Ne(e) {
	let t = [], n = [], r = e.split(",");
	if (r.length !== 3) throw Error(`Invalid symmetry operation: ${e}`);
	for (let e of r) {
		let r = Ce(e);
		t.push(r.coefficients), n.push(r.translation);
	}
	return {
		rotation: t,
		translation: n
	};
}
//#endregion
//#region src/lib/structure/space-group-table.js
var Pe = Object.freeze([
	{
		number: 1,
		symbol_cif: "P 1",
		symbol_hm_short: "P1",
		hall_symbol: "P 1",
		universal_h_m: "P 1",
		setting: "",
		is_standard: !0,
		operations: ["x,y,z"]
	},
	{
		number: 2,
		symbol_cif: "P -1",
		symbol_hm_short: "P-1",
		hall_symbol: "-P 1",
		universal_h_m: "P -1",
		setting: "",
		is_standard: !0,
		operations: ["x,y,z", "-x,-y,-z"]
	},
	{
		number: 3,
		symbol_cif: "P 1 2 1",
		symbol_hm_short: "P2",
		hall_symbol: "P 2y",
		universal_h_m: "P 1 2 1",
		setting: "b",
		is_standard: !0,
		operations: ["x,y,z", "-x,y,-z"]
	},
	{
		number: 3,
		symbol_cif: "P 1 1 2",
		symbol_hm_short: "P112",
		hall_symbol: "P 2",
		universal_h_m: "P 1 1 2",
		setting: "c",
		is_standard: !1,
		operations: ["x,y,z", "-x,-y,z"]
	},
	{
		number: 3,
		symbol_cif: "P 2 1 1",
		symbol_hm_short: "P211",
		hall_symbol: "P 2x",
		universal_h_m: "P 2 1 1",
		setting: "a",
		is_standard: !1,
		operations: ["x,y,z", "x,-y,-z"]
	},
	{
		number: 4,
		symbol_cif: "P 1 21 1",
		symbol_hm_short: "P21",
		hall_symbol: "P 2yb",
		universal_h_m: "P 1 21 1",
		setting: "b",
		is_standard: !0,
		operations: ["x,y,z", "-x,y+1/2,-z"]
	},
	{
		number: 4,
		symbol_cif: "P 1 1 21",
		symbol_hm_short: "P1121",
		hall_symbol: "P 2c",
		universal_h_m: "P 1 1 21",
		setting: "c",
		is_standard: !1,
		operations: ["x,y,z", "-x,-y,z+1/2"]
	},
	{
		number: 4,
		symbol_cif: "P 21 1 1",
		symbol_hm_short: "P2111",
		hall_symbol: "P 2xa",
		universal_h_m: "P 21 1 1",
		setting: "a",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,-y,-z"]
	},
	{
		number: 5,
		symbol_cif: "C 1 2 1",
		symbol_hm_short: "C2",
		hall_symbol: "C 2y",
		universal_h_m: "C 1 2 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 5,
		symbol_cif: "A 1 2 1",
		symbol_hm_short: "A2",
		hall_symbol: "A 2y",
		universal_h_m: "A 1 2 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "I 1 2 1",
		symbol_hm_short: "I2",
		hall_symbol: "I 2y",
		universal_h_m: "I 1 2 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "A 1 1 2",
		symbol_hm_short: "A112",
		hall_symbol: "A 2",
		universal_h_m: "A 1 1 2",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "B 1 1 2",
		symbol_hm_short: "B112",
		hall_symbol: "B 2",
		universal_h_m: "B 1 1 2",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "I 1 1 2",
		symbol_hm_short: "I112",
		hall_symbol: "I 2",
		universal_h_m: "I 1 1 2",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "B 2 1 1",
		symbol_hm_short: "B211",
		hall_symbol: "B 2x",
		universal_h_m: "B 2 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,-y,-z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "C 2 1 1",
		symbol_hm_short: "C211",
		hall_symbol: "C 2x",
		universal_h_m: "C 2 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,-z"
		]
	},
	{
		number: 5,
		symbol_cif: "I 2 1 1",
		symbol_hm_short: "I211",
		hall_symbol: "I 2x",
		universal_h_m: "I 2 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2"
		]
	},
	{
		number: 6,
		symbol_cif: "P 1 m 1",
		symbol_hm_short: "Pm",
		hall_symbol: "P -2y",
		universal_h_m: "P 1 m 1",
		setting: "b",
		is_standard: !0,
		operations: ["x,y,z", "x,-y,z"]
	},
	{
		number: 6,
		symbol_cif: "P 1 1 m",
		symbol_hm_short: "P11m",
		hall_symbol: "P -2",
		universal_h_m: "P 1 1 m",
		setting: "c",
		is_standard: !1,
		operations: ["x,y,z", "x,y,-z"]
	},
	{
		number: 6,
		symbol_cif: "P m 1 1",
		symbol_hm_short: "Pm11",
		hall_symbol: "P -2x",
		universal_h_m: "P m 1 1",
		setting: "a",
		is_standard: !1,
		operations: ["x,y,z", "-x,y,z"]
	},
	{
		number: 7,
		symbol_cif: "P 1 c 1",
		symbol_hm_short: "Pc",
		hall_symbol: "P -2yc",
		universal_h_m: "P 1 c 1",
		setting: "b1",
		is_standard: !0,
		operations: ["x,y,z", "x,-y,z+1/2"]
	},
	{
		number: 7,
		symbol_cif: "P 1 n 1",
		symbol_hm_short: "Pn",
		hall_symbol: "P -2yac",
		universal_h_m: "P 1 n 1",
		setting: "b2",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,-y,z+1/2"]
	},
	{
		number: 7,
		symbol_cif: "P 1 a 1",
		symbol_hm_short: "Pa",
		hall_symbol: "P -2ya",
		universal_h_m: "P 1 a 1",
		setting: "b3",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,-y,z"]
	},
	{
		number: 7,
		symbol_cif: "P 1 1 a",
		symbol_hm_short: "P11a",
		hall_symbol: "P -2a",
		universal_h_m: "P 1 1 a",
		setting: "c1",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,y,-z"]
	},
	{
		number: 7,
		symbol_cif: "P 1 1 n",
		symbol_hm_short: "P11n",
		hall_symbol: "P -2ab",
		universal_h_m: "P 1 1 n",
		setting: "c2",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,y+1/2,-z"]
	},
	{
		number: 7,
		symbol_cif: "P 1 1 b",
		symbol_hm_short: "P11b",
		hall_symbol: "P -2b",
		universal_h_m: "P 1 1 b",
		setting: "c3",
		is_standard: !1,
		operations: ["x,y,z", "x,y+1/2,-z"]
	},
	{
		number: 7,
		symbol_cif: "P b 1 1",
		symbol_hm_short: "Pb11",
		hall_symbol: "P -2xb",
		universal_h_m: "P b 1 1",
		setting: "a1",
		is_standard: !1,
		operations: ["x,y,z", "-x,y+1/2,z"]
	},
	{
		number: 7,
		symbol_cif: "P n 1 1",
		symbol_hm_short: "Pn11",
		hall_symbol: "P -2xbc",
		universal_h_m: "P n 1 1",
		setting: "a2",
		is_standard: !1,
		operations: ["x,y,z", "-x,y+1/2,z+1/2"]
	},
	{
		number: 7,
		symbol_cif: "P c 1 1",
		symbol_hm_short: "Pc11",
		hall_symbol: "P -2xc",
		universal_h_m: "P c 1 1",
		setting: "a3",
		is_standard: !1,
		operations: ["x,y,z", "-x,y,z+1/2"]
	},
	{
		number: 8,
		symbol_cif: "C 1 m 1",
		symbol_hm_short: "Cm",
		hall_symbol: "C -2y",
		universal_h_m: "C 1 m 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 8,
		symbol_cif: "A 1 m 1",
		symbol_hm_short: "Am",
		hall_symbol: "A -2y",
		universal_h_m: "A 1 m 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "I 1 m 1",
		symbol_hm_short: "Im",
		hall_symbol: "I -2y",
		universal_h_m: "I 1 m 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "A 1 1 m",
		symbol_hm_short: "A11m",
		hall_symbol: "A -2",
		universal_h_m: "A 1 1 m",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "B 1 1 m",
		symbol_hm_short: "B11m",
		hall_symbol: "B -2",
		universal_h_m: "B 1 1 m",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "I 1 1 m",
		symbol_hm_short: "I11m",
		hall_symbol: "I -2",
		universal_h_m: "I 1 1 m",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "B m 1 1",
		symbol_hm_short: "Bm11",
		hall_symbol: "B -2x",
		universal_h_m: "B m 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,y,z+1/2"
		]
	},
	{
		number: 8,
		symbol_cif: "C m 1 1",
		symbol_hm_short: "Cm11",
		hall_symbol: "C -2x",
		universal_h_m: "C m 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,z"
		]
	},
	{
		number: 8,
		symbol_cif: "I m 1 1",
		symbol_hm_short: "Im11",
		hall_symbol: "I -2x",
		universal_h_m: "I m 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "C 1 c 1",
		symbol_hm_short: "Cc",
		hall_symbol: "C -2yc",
		universal_h_m: "C 1 c 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "A 1 n 1",
		symbol_hm_short: "An",
		hall_symbol: "A -2yab",
		universal_h_m: "A 1 n 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I 1 a 1",
		symbol_hm_short: "Ia",
		hall_symbol: "I -2ya",
		universal_h_m: "I 1 a 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "A 1 a 1",
		symbol_hm_short: "Aa",
		hall_symbol: "A -2ya",
		universal_h_m: "A 1 a 1",
		setting: "-b1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "C 1 n 1",
		symbol_hm_short: "Cn",
		hall_symbol: "C -2yac",
		universal_h_m: "C 1 n 1",
		setting: "-b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I 1 c 1",
		symbol_hm_short: "Ic",
		hall_symbol: "I -2yc",
		universal_h_m: "I 1 c 1",
		setting: "-b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 9,
		symbol_cif: "A 1 1 a",
		symbol_hm_short: "A11a",
		hall_symbol: "A -2a",
		universal_h_m: "A 1 1 a",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "B 1 1 n",
		symbol_hm_short: "B11n",
		hall_symbol: "B -2ab",
		universal_h_m: "B 1 1 n",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I 1 1 b",
		symbol_hm_short: "I11b",
		hall_symbol: "I -2b",
		universal_h_m: "I 1 1 b",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "B 1 1 b",
		symbol_hm_short: "B11b",
		hall_symbol: "B -2b",
		universal_h_m: "B 1 1 b",
		setting: "-c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "A 1 1 n",
		symbol_hm_short: "A11n",
		hall_symbol: "A -2ab",
		universal_h_m: "A 1 1 n",
		setting: "-c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"x,y+1/2,z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I 1 1 a",
		symbol_hm_short: "I11a",
		hall_symbol: "I -2a",
		universal_h_m: "I 1 1 a",
		setting: "-c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "B b 1 1",
		symbol_hm_short: "Bb11",
		hall_symbol: "B -2xb",
		universal_h_m: "B b 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "C n 1 1",
		symbol_hm_short: "Cn11",
		hall_symbol: "C -2xac",
		universal_h_m: "C n 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x,y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I c 1 1",
		symbol_hm_short: "Ic11",
		hall_symbol: "I -2xc",
		universal_h_m: "I c 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,z"
		]
	},
	{
		number: 9,
		symbol_cif: "C c 1 1",
		symbol_hm_short: "Cc11",
		hall_symbol: "C -2xc",
		universal_h_m: "C c 1 1",
		setting: "-a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "B n 1 1",
		symbol_hm_short: "Bn11",
		hall_symbol: "B -2xab",
		universal_h_m: "B n 1 1",
		setting: "-a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x,y+1/2,z+1/2"
		]
	},
	{
		number: 9,
		symbol_cif: "I b 1 1",
		symbol_hm_short: "Ib11",
		hall_symbol: "I -2xb",
		universal_h_m: "I b 1 1",
		setting: "-a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y,z+1/2"
		]
	},
	{
		number: 10,
		symbol_cif: "P 1 2/m 1",
		symbol_hm_short: "P2/m",
		hall_symbol: "-P 2y",
		universal_h_m: "P 1 2/m 1",
		setting: "b",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,-y,z"
		]
	},
	{
		number: 10,
		symbol_cif: "P 1 1 2/m",
		symbol_hm_short: "P112/m",
		hall_symbol: "-P 2",
		universal_h_m: "P 1 1 2/m",
		setting: "c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,-y,-z",
			"x,y,-z"
		]
	},
	{
		number: 10,
		symbol_cif: "P 2/m 1 1",
		symbol_hm_short: "P2/m11",
		hall_symbol: "-P 2x",
		universal_h_m: "P 2/m 1 1",
		setting: "a",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"-x,-y,-z",
			"-x,y,z"
		]
	},
	{
		number: 11,
		symbol_cif: "P 1 21/m 1",
		symbol_hm_short: "P21/m",
		hall_symbol: "-P 2yb",
		universal_h_m: "P 1 21/m 1",
		setting: "b",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 11,
		symbol_cif: "P 1 1 21/m",
		symbol_hm_short: "P1121/m",
		hall_symbol: "-P 2c",
		universal_h_m: "P 1 1 21/m",
		setting: "c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2"
		]
	},
	{
		number: 11,
		symbol_cif: "P 21/m 1 1",
		symbol_hm_short: "P21/m11",
		hall_symbol: "-P 2xa",
		universal_h_m: "P 21/m 1 1",
		setting: "a",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,-z",
			"-x,-y,-z",
			"-x+1/2,y,z"
		]
	},
	{
		number: 12,
		symbol_cif: "C 1 2/m 1",
		symbol_hm_short: "C2/m",
		hall_symbol: "-C 2y",
		universal_h_m: "C 1 2/m 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 12,
		symbol_cif: "A 1 2/m 1",
		symbol_hm_short: "A2/m",
		hall_symbol: "-A 2y",
		universal_h_m: "A 1 2/m 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "I 1 2/m 1",
		symbol_hm_short: "I2/m",
		hall_symbol: "-I 2y",
		universal_h_m: "I 1 2/m 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "A 1 1 2/m",
		symbol_hm_short: "A112/m",
		hall_symbol: "-A 2",
		universal_h_m: "A 1 1 2/m",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,-y,-z",
			"x,y,-z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "B 1 1 2/m",
		symbol_hm_short: "B112/m",
		hall_symbol: "-B 2",
		universal_h_m: "B 1 1 2/m",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,-y,-z",
			"x,y,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "I 1 1 2/m",
		symbol_hm_short: "I112/m",
		hall_symbol: "-I 2",
		universal_h_m: "I 1 1 2/m",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,-y,-z",
			"x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "B 2/m 1 1",
		symbol_hm_short: "B2/m11",
		hall_symbol: "-B 2x",
		universal_h_m: "B 2/m 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"-x,-y,-z",
			"-x,y,z",
			"x+1/2,y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"-x+1/2,y,z+1/2"
		]
	},
	{
		number: 12,
		symbol_cif: "C 2/m 1 1",
		symbol_hm_short: "C2/m11",
		hall_symbol: "-C 2x",
		universal_h_m: "C 2/m 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"-x,-y,-z",
			"-x,y,z",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,z"
		]
	},
	{
		number: 12,
		symbol_cif: "I 2/m 1 1",
		symbol_hm_short: "I2/m11",
		hall_symbol: "-I 2x",
		universal_h_m: "I 2/m 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z",
			"-x,-y,-z",
			"-x,y,z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 2/c 1",
		symbol_hm_short: "P2/c",
		hall_symbol: "-P 2yc",
		universal_h_m: "P 1 2/c 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 2/n 1",
		symbol_hm_short: "P2/n",
		hall_symbol: "-P 2yac",
		universal_h_m: "P 1 2/n 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 2/a 1",
		symbol_hm_short: "P2/a",
		hall_symbol: "-P 2ya",
		universal_h_m: "P 1 2/a 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 1 2/a",
		symbol_hm_short: "P112/a",
		hall_symbol: "-P 2a",
		universal_h_m: "P 1 1 2/a",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"-x,-y,-z",
			"x+1/2,y,-z"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 1 2/n",
		symbol_hm_short: "P112/n",
		hall_symbol: "-P 2ab",
		universal_h_m: "P 1 1 2/n",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z"
		]
	},
	{
		number: 13,
		symbol_cif: "P 1 1 2/b",
		symbol_hm_short: "P112/b",
		hall_symbol: "-P 2b",
		universal_h_m: "P 1 1 2/b",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"-x,-y,-z",
			"x,y+1/2,-z"
		]
	},
	{
		number: 13,
		symbol_cif: "P 2/b 1 1",
		symbol_hm_short: "P2/b11",
		hall_symbol: "-P 2xb",
		universal_h_m: "P 2/b 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y+1/2,-z",
			"-x,-y,-z",
			"-x,y+1/2,z"
		]
	},
	{
		number: 13,
		symbol_cif: "P 2/n 1 1",
		symbol_hm_short: "P2/n11",
		hall_symbol: "-P 2xbc",
		universal_h_m: "P 2/n 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y+1/2,-z+1/2",
			"-x,-y,-z",
			"-x,y+1/2,z+1/2"
		]
	},
	{
		number: 13,
		symbol_cif: "P 2/c 1 1",
		symbol_hm_short: "P2/c11",
		hall_symbol: "-P 2xc",
		universal_h_m: "P 2/c 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z+1/2",
			"-x,-y,-z",
			"-x,y,z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 21/c 1",
		symbol_hm_short: "P21/c",
		hall_symbol: "-P 2ybc",
		universal_h_m: "P 1 21/c 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 21/n 1",
		symbol_hm_short: "P21/n",
		hall_symbol: "-P 2yn",
		universal_h_m: "P 1 21/n 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 21/a 1",
		symbol_hm_short: "P21/a",
		hall_symbol: "-P 2yab",
		universal_h_m: "P 1 21/a 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 1 21/a",
		symbol_hm_short: "P1121/a",
		hall_symbol: "-P 2ac",
		universal_h_m: "P 1 1 21/a",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 1 21/n",
		symbol_hm_short: "P1121/n",
		hall_symbol: "-P 2n",
		universal_h_m: "P 1 1 21/n",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 1 1 21/b",
		symbol_hm_short: "P1121/b",
		hall_symbol: "-P 2bc",
		universal_h_m: "P 1 1 21/b",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 21/b 1 1",
		symbol_hm_short: "P21/b11",
		hall_symbol: "-P 2xab",
		universal_h_m: "P 21/b 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y+1/2,-z",
			"-x,-y,-z",
			"-x+1/2,y+1/2,z"
		]
	},
	{
		number: 14,
		symbol_cif: "P 21/n 1 1",
		symbol_hm_short: "P21/n11",
		hall_symbol: "-P 2xn",
		universal_h_m: "P 21/n 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,-y,-z",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 14,
		symbol_cif: "P 21/c 1 1",
		symbol_hm_short: "P21/c11",
		hall_symbol: "-P 2xac",
		universal_h_m: "P 21/c 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,-z+1/2",
			"-x,-y,-z",
			"-x+1/2,y,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "C 1 2/c 1",
		symbol_hm_short: "C2/c",
		hall_symbol: "-C 2yc",
		universal_h_m: "C 1 2/c 1",
		setting: "b1",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "A 1 2/n 1",
		symbol_hm_short: "A2/n",
		hall_symbol: "-A 2yab",
		universal_h_m: "A 1 2/n 1",
		setting: "b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 1 2/a 1",
		symbol_hm_short: "I2/a",
		hall_symbol: "-I 2ya",
		universal_h_m: "I 1 2/a 1",
		setting: "b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "A 1 2/a 1",
		symbol_hm_short: "A2/a",
		hall_symbol: "-A 2ya",
		universal_h_m: "A 1 2/a 1",
		setting: "-b1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "C 1 2/n 1",
		symbol_hm_short: "C2/n",
		hall_symbol: "-C 2yac",
		universal_h_m: "C 1 2/n 1",
		setting: "-b2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 1 2/c 1",
		symbol_hm_short: "I2/c",
		hall_symbol: "-I 2yc",
		universal_h_m: "I 1 2/c 1",
		setting: "-b3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 15,
		symbol_cif: "A 1 1 2/a",
		symbol_hm_short: "A112/a",
		hall_symbol: "-A 2a",
		universal_h_m: "A 1 1 2/a",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "B 1 1 2/n",
		symbol_hm_short: "B112/n",
		hall_symbol: "-B 2ab",
		universal_h_m: "B 1 1 2/n",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 1 1 2/b",
		symbol_hm_short: "I112/b",
		hall_symbol: "-I 2b",
		universal_h_m: "I 1 1 2/b",
		setting: "c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "B 1 1 2/b",
		symbol_hm_short: "B112/b",
		hall_symbol: "-B 2b",
		universal_h_m: "B 1 1 2/b",
		setting: "-c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "A 1 1 2/n",
		symbol_hm_short: "A112/n",
		hall_symbol: "-A 2ab",
		universal_h_m: "A 1 1 2/n",
		setting: "-c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 1 1 2/a",
		symbol_hm_short: "I112/a",
		hall_symbol: "-I 2a",
		universal_h_m: "I 1 1 2/a",
		setting: "-c3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "B 2/b 1 1",
		symbol_hm_short: "B2/b11",
		hall_symbol: "-B 2xb",
		universal_h_m: "B 2/b 1 1",
		setting: "a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y+1/2,-z",
			"-x,-y,-z",
			"-x,y+1/2,z",
			"x+1/2,y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "C 2/n 1 1",
		symbol_hm_short: "C2/n11",
		hall_symbol: "-C 2xac",
		universal_h_m: "C 2/n 1 1",
		setting: "a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y,-z+1/2",
			"-x,-y,-z",
			"-x+1/2,y,z+1/2",
			"x+1/2,y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"-x,y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 2/c 1 1",
		symbol_hm_short: "I2/c11",
		hall_symbol: "-I 2xc",
		universal_h_m: "I 2/c 1 1",
		setting: "a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z+1/2",
			"-x,-y,-z",
			"-x,y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z"
		]
	},
	{
		number: 15,
		symbol_cif: "C 2/c 1 1",
		symbol_hm_short: "C2/c11",
		hall_symbol: "-C 2xc",
		universal_h_m: "C 2/c 1 1",
		setting: "-a1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,-z+1/2",
			"-x,-y,-z",
			"-x,y,z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "B 2/n 1 1",
		symbol_hm_short: "B2/n11",
		hall_symbol: "-B 2xab",
		universal_h_m: "B 2/n 1 1",
		setting: "-a2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,-y+1/2,-z",
			"-x,-y,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,y,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"-x,y+1/2,z+1/2"
		]
	},
	{
		number: 15,
		symbol_cif: "I 2/b 1 1",
		symbol_hm_short: "I2/b11",
		hall_symbol: "-I 2xb",
		universal_h_m: "I 2/b 1 1",
		setting: "-a3",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y+1/2,-z",
			"-x,-y,-z",
			"-x,y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2"
		]
	},
	{
		number: 16,
		symbol_cif: "P 2 2 2",
		symbol_hm_short: "P222",
		hall_symbol: "P 2 2",
		universal_h_m: "P 2 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z"
		]
	},
	{
		number: 17,
		symbol_cif: "P 2 2 21",
		symbol_hm_short: "P2221",
		hall_symbol: "P 2c 2",
		universal_h_m: "P 2 2 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z",
			"-x,y,-z+1/2"
		]
	},
	{
		number: 17,
		symbol_cif: "P 21 2 2",
		symbol_hm_short: "P2122",
		hall_symbol: "P 2a 2a",
		universal_h_m: "P 21 2 2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z"
		]
	},
	{
		number: 17,
		symbol_cif: "P 2 21 2",
		symbol_hm_short: "P2212",
		hall_symbol: "P 2 2b",
		universal_h_m: "P 2 21 2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 18,
		symbol_cif: "P 21 21 2",
		symbol_hm_short: "P21212",
		hall_symbol: "P 2 2ab",
		universal_h_m: "P 21 21 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 18,
		symbol_cif: "P 2 21 21",
		symbol_hm_short: "P22121",
		hall_symbol: "P 2bc 2",
		universal_h_m: "P 2 21 21",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y,-z",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 18,
		symbol_cif: "P 21 2 21",
		symbol_hm_short: "P21221",
		hall_symbol: "P 2ac 2ac",
		universal_h_m: "P 21 2 21",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z"
		]
	},
	{
		number: 19,
		symbol_cif: "P 21 21 21",
		symbol_hm_short: "P212121",
		hall_symbol: "P 2ac 2ab",
		universal_h_m: "P 21 21 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 20,
		symbol_cif: "C 2 2 21",
		symbol_hm_short: "C2221",
		hall_symbol: "C 2c 2",
		universal_h_m: "C 2 2 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z",
			"-x,y,-z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 20,
		symbol_cif: "A 21 2 2",
		symbol_hm_short: "A2122",
		hall_symbol: "A 2a 2a",
		universal_h_m: "A 21 2 2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 20,
		symbol_cif: "B 2 21 2",
		symbol_hm_short: "B2212",
		hall_symbol: "B 2 2b",
		universal_h_m: "B 2 21 2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 21,
		symbol_cif: "C 2 2 2",
		symbol_hm_short: "C222",
		hall_symbol: "C 2 2",
		universal_h_m: "C 2 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 21,
		symbol_cif: "A 2 2 2",
		symbol_hm_short: "A222",
		hall_symbol: "A 2 2",
		universal_h_m: "A 2 2 2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 21,
		symbol_cif: "B 2 2 2",
		symbol_hm_short: "B222",
		hall_symbol: "B 2 2",
		universal_h_m: "B 2 2 2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 22,
		symbol_cif: "F 2 2 2",
		symbol_hm_short: "F222",
		hall_symbol: "F 2 2",
		universal_h_m: "F 2 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 23,
		symbol_cif: "I 2 2 2",
		symbol_hm_short: "I222",
		hall_symbol: "I 2 2",
		universal_h_m: "I 2 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 24,
		symbol_cif: "I 21 21 21",
		symbol_hm_short: "I212121",
		hall_symbol: "I 2b 2c",
		universal_h_m: "I 21 21 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z"
		]
	},
	{
		number: 25,
		symbol_cif: "P m m 2",
		symbol_hm_short: "Pmm2",
		hall_symbol: "P 2 -2",
		universal_h_m: "P m m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z"
		]
	},
	{
		number: 25,
		symbol_cif: "P 2 m m",
		symbol_hm_short: "P2mm",
		hall_symbol: "P -2 2",
		universal_h_m: "P 2 m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z"
		]
	},
	{
		number: 25,
		symbol_cif: "P m 2 m",
		symbol_hm_short: "Pm2m",
		hall_symbol: "P -2 -2",
		universal_h_m: "P m 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z"
		]
	},
	{
		number: 26,
		symbol_cif: "P m c 21",
		symbol_hm_short: "Pmc21",
		hall_symbol: "P 2c -2",
		universal_h_m: "P m c 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,y,z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 26,
		symbol_cif: "P c m 21",
		symbol_hm_short: "Pcm21",
		hall_symbol: "P 2c -2c",
		universal_h_m: "P c m 21",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,y,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 26,
		symbol_cif: "P 21 m a",
		symbol_hm_short: "P21ma",
		hall_symbol: "P -2a 2a",
		universal_h_m: "P 21 m a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x+1/2,-y,-z",
			"x,-y,z"
		]
	},
	{
		number: 26,
		symbol_cif: "P 21 a m",
		symbol_hm_short: "P21am",
		hall_symbol: "P -2 2a",
		universal_h_m: "P 21 a m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x+1/2,-y,-z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 26,
		symbol_cif: "P b 21 m",
		symbol_hm_short: "Pb21m",
		hall_symbol: "P -2 -2b",
		universal_h_m: "P b 21 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y+1/2,z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 26,
		symbol_cif: "P m 21 b",
		symbol_hm_short: "Pm21b",
		hall_symbol: "P -2b -2",
		universal_h_m: "P m 21 b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y,z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 27,
		symbol_cif: "P c c 2",
		symbol_hm_short: "Pcc2",
		hall_symbol: "P 2 -2c",
		universal_h_m: "P c c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 27,
		symbol_cif: "P 2 a a",
		symbol_hm_short: "P2aa",
		hall_symbol: "P -2a 2",
		universal_h_m: "P 2 a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,-y,-z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 27,
		symbol_cif: "P b 2 b",
		symbol_hm_short: "Pb2b",
		hall_symbol: "P -2b -2b",
		universal_h_m: "P b 2 b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"-x,y,-z"
		]
	},
	{
		number: 28,
		symbol_cif: "P m a 2",
		symbol_hm_short: "Pma2",
		hall_symbol: "P 2 -2a",
		universal_h_m: "P m a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 28,
		symbol_cif: "P b m 2",
		symbol_hm_short: "Pbm2",
		hall_symbol: "P 2 -2b",
		universal_h_m: "P b m 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y+1/2,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 28,
		symbol_cif: "P 2 m b",
		symbol_hm_short: "P2mb",
		hall_symbol: "P -2b 2",
		universal_h_m: "P 2 m b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x,-y,-z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 28,
		symbol_cif: "P 2 c m",
		symbol_hm_short: "P2cm",
		hall_symbol: "P -2c 2",
		universal_h_m: "P 2 c m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"x,-y,-z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 28,
		symbol_cif: "P c 2 m",
		symbol_hm_short: "Pc2m",
		hall_symbol: "P -2c -2c",
		universal_h_m: "P c 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"-x,y,-z"
		]
	},
	{
		number: 28,
		symbol_cif: "P m 2 a",
		symbol_hm_short: "Pm2a",
		hall_symbol: "P -2a -2a",
		universal_h_m: "P m 2 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"-x,y,-z"
		]
	},
	{
		number: 29,
		symbol_cif: "P c a 21",
		symbol_hm_short: "Pca21",
		hall_symbol: "P 2c -2ac",
		universal_h_m: "P c a 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z"
		]
	},
	{
		number: 29,
		symbol_cif: "P b c 21",
		symbol_hm_short: "Pbc21",
		hall_symbol: "P 2c -2b",
		universal_h_m: "P b c 21",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,y+1/2,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 29,
		symbol_cif: "P 21 a b",
		symbol_hm_short: "P21ab",
		hall_symbol: "P -2b 2a",
		universal_h_m: "P 21 a b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x+1/2,-y,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 29,
		symbol_cif: "P 21 c a",
		symbol_hm_short: "P21ca",
		hall_symbol: "P -2ac 2a",
		universal_h_m: "P 21 c a",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"x+1/2,-y,-z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 29,
		symbol_cif: "P c 21 b",
		symbol_hm_short: "Pc21b",
		hall_symbol: "P -2bc -2c",
		universal_h_m: "P c 21 b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z+1/2",
			"-x,y,z+1/2",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 29,
		symbol_cif: "P b 21 a",
		symbol_hm_short: "Pb21a",
		hall_symbol: "P -2a -2ab",
		universal_h_m: "P b 21 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"-x+1/2,y+1/2,z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 30,
		symbol_cif: "P n c 2",
		symbol_hm_short: "Pnc2",
		hall_symbol: "P 2 -2bc",
		universal_h_m: "P n c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 30,
		symbol_cif: "P c n 2",
		symbol_hm_short: "Pcn2",
		hall_symbol: "P 2 -2ac",
		universal_h_m: "P c n 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 30,
		symbol_cif: "P 2 n a",
		symbol_hm_short: "P2na",
		hall_symbol: "P -2ac 2",
		universal_h_m: "P 2 n a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"x,-y,-z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 30,
		symbol_cif: "P 2 a n",
		symbol_hm_short: "P2an",
		hall_symbol: "P -2ab 2",
		universal_h_m: "P 2 a n",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"x,-y,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 30,
		symbol_cif: "P b 2 n",
		symbol_hm_short: "Pb2n",
		hall_symbol: "P -2ab -2ab",
		universal_h_m: "P b 2 n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"-x,y,-z"
		]
	},
	{
		number: 30,
		symbol_cif: "P n 2 b",
		symbol_hm_short: "Pn2b",
		hall_symbol: "P -2bc -2bc",
		universal_h_m: "P n 2 b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"-x,y,-z"
		]
	},
	{
		number: 31,
		symbol_cif: "P m n 21",
		symbol_hm_short: "Pmn21",
		hall_symbol: "P 2ac -2",
		universal_h_m: "P m n 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"-x,y,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 31,
		symbol_cif: "P n m 21",
		symbol_hm_short: "Pnm21",
		hall_symbol: "P 2bc -2bc",
		universal_h_m: "P n m 21",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 31,
		symbol_cif: "P 21 m n",
		symbol_hm_short: "P21mn",
		hall_symbol: "P -2ab 2ab",
		universal_h_m: "P 21 m n",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"x+1/2,-y+1/2,-z",
			"x,-y,z"
		]
	},
	{
		number: 31,
		symbol_cif: "P 21 n m",
		symbol_hm_short: "P21nm",
		hall_symbol: "P -2 2ac",
		universal_h_m: "P 21 n m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x+1/2,-y,-z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 31,
		symbol_cif: "P n 21 m",
		symbol_hm_short: "Pn21m",
		hall_symbol: "P -2 -2bc",
		universal_h_m: "P n 21 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 31,
		symbol_cif: "P m 21 n",
		symbol_hm_short: "Pm21n",
		hall_symbol: "P -2ab -2",
		universal_h_m: "P m 21 n",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"-x,y,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 32,
		symbol_cif: "P b a 2",
		symbol_hm_short: "Pba2",
		hall_symbol: "P 2 -2ab",
		universal_h_m: "P b a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 32,
		symbol_cif: "P 2 c b",
		symbol_hm_short: "P2cb",
		hall_symbol: "P -2bc 2",
		universal_h_m: "P 2 c b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z+1/2",
			"x,-y,-z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 32,
		symbol_cif: "P c 2 a",
		symbol_hm_short: "Pc2a",
		hall_symbol: "P -2ac -2ac",
		universal_h_m: "P c 2 a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x,y,-z"
		]
	},
	{
		number: 33,
		symbol_cif: "P n a 21",
		symbol_hm_short: "Pna21",
		hall_symbol: "P 2c -2n",
		universal_h_m: "P n a 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 33,
		symbol_cif: "P b n 21",
		symbol_hm_short: "Pbn21",
		hall_symbol: "P 2c -2ab",
		universal_h_m: "P b n 21",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 33,
		symbol_cif: "P 21 n b",
		symbol_hm_short: "P21nb",
		hall_symbol: "P -2bc 2a",
		universal_h_m: "P 21 n b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z+1/2",
			"x+1/2,-y,-z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 33,
		symbol_cif: "P 21 c n",
		symbol_hm_short: "P21cn",
		hall_symbol: "P -2n 2a",
		universal_h_m: "P 21 c n",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z+1/2",
			"x+1/2,-y,-z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 33,
		symbol_cif: "P c 21 n",
		symbol_hm_short: "Pc21n",
		hall_symbol: "P -2n -2ac",
		universal_h_m: "P c 21 n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 33,
		symbol_cif: "P n 21 a",
		symbol_hm_short: "Pn21a",
		hall_symbol: "P -2ac -2n",
		universal_h_m: "P n 21 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 34,
		symbol_cif: "P n n 2",
		symbol_hm_short: "Pnn2",
		hall_symbol: "P 2 -2n",
		universal_h_m: "P n n 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 34,
		symbol_cif: "P 2 n n",
		symbol_hm_short: "P2nn",
		hall_symbol: "P -2n 2",
		universal_h_m: "P 2 n n",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z+1/2",
			"x,-y,-z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 34,
		symbol_cif: "P n 2 n",
		symbol_hm_short: "Pn2n",
		hall_symbol: "P -2n -2n",
		universal_h_m: "P n 2 n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x,y,-z"
		]
	},
	{
		number: 35,
		symbol_cif: "C m m 2",
		symbol_hm_short: "Cmm2",
		hall_symbol: "C 2 -2",
		universal_h_m: "C m m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 35,
		symbol_cif: "A 2 m m",
		symbol_hm_short: "A2mm",
		hall_symbol: "A -2 2",
		universal_h_m: "A 2 m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"x,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 35,
		symbol_cif: "B m 2 m",
		symbol_hm_short: "Bm2m",
		hall_symbol: "B -2 -2",
		universal_h_m: "B m 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 36,
		symbol_cif: "C m c 21",
		symbol_hm_short: "Cmc21",
		hall_symbol: "C 2c -2",
		universal_h_m: "C m c 21",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,y,z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 36,
		symbol_cif: "C c m 21",
		symbol_hm_short: "Ccm21",
		hall_symbol: "C 2c -2c",
		universal_h_m: "C c m 21",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"-x,y,z+1/2",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 36,
		symbol_cif: "A 21 m a",
		symbol_hm_short: "A21ma",
		hall_symbol: "A -2a 2a",
		universal_h_m: "A 21 m a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x+1/2,-y,-z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 36,
		symbol_cif: "A 21 a m",
		symbol_hm_short: "A21am",
		hall_symbol: "A -2 2a",
		universal_h_m: "A 21 a m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x+1/2,-y,-z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 36,
		symbol_cif: "B b 21 m",
		symbol_hm_short: "Bb21m",
		hall_symbol: "B -2 -2b",
		universal_h_m: "B b 21 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y+1/2,z",
			"-x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 36,
		symbol_cif: "B m 21 b",
		symbol_hm_short: "Bm21b",
		hall_symbol: "B -2b -2",
		universal_h_m: "B m 21 b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y,z",
			"-x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 37,
		symbol_cif: "C c c 2",
		symbol_hm_short: "Ccc2",
		hall_symbol: "C 2 -2c",
		universal_h_m: "C c c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z+1/2",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 37,
		symbol_cif: "A 2 a a",
		symbol_hm_short: "A2aa",
		hall_symbol: "A -2a 2",
		universal_h_m: "A 2 a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,-y,-z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"x,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 37,
		symbol_cif: "B b 2 b",
		symbol_hm_short: "Bb2b",
		hall_symbol: "B -2b -2b",
		universal_h_m: "B b 2 b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"-x,y,-z",
			"x+1/2,y,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 38,
		symbol_cif: "A m m 2",
		symbol_hm_short: "Amm2",
		hall_symbol: "A 2 -2",
		universal_h_m: "A m m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 38,
		symbol_cif: "B m m 2",
		symbol_hm_short: "Bmm2",
		hall_symbol: "B 2 -2",
		universal_h_m: "B m m 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 38,
		symbol_cif: "B 2 m m",
		symbol_hm_short: "B2mm",
		hall_symbol: "B -2 2",
		universal_h_m: "B 2 m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2",
			"x+1/2,-y,-z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 38,
		symbol_cif: "C 2 m m",
		symbol_hm_short: "C2mm",
		hall_symbol: "C -2 2",
		universal_h_m: "C 2 m m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z",
			"x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 38,
		symbol_cif: "C m 2 m",
		symbol_hm_short: "Cm2m",
		hall_symbol: "C -2 -2",
		universal_h_m: "C m 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 38,
		symbol_cif: "A m 2 m",
		symbol_hm_short: "Am2m",
		hall_symbol: "A -2 -2",
		universal_h_m: "A m 2 m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 39,
		symbol_cif: "A b m 2",
		symbol_hm_short: "Abm2",
		hall_symbol: "A 2 -2b",
		universal_h_m: "A b m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 39,
		symbol_cif: "B m a 2",
		symbol_hm_short: "Bma2",
		hall_symbol: "B 2 -2a",
		universal_h_m: "B m a 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 39,
		symbol_cif: "B 2 c m",
		symbol_hm_short: "B2cm",
		hall_symbol: "B -2a 2",
		universal_h_m: "B 2 c m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,-y,-z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"x,y,-z+1/2",
			"x+1/2,-y,-z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 39,
		symbol_cif: "C 2 m b",
		symbol_hm_short: "C2mb",
		hall_symbol: "C -2a 2",
		universal_h_m: "C 2 m b",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,-y,-z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z",
			"x,y+1/2,-z",
			"x+1/2,-y+1/2,-z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 39,
		symbol_cif: "C m 2 a",
		symbol_hm_short: "Cm2a",
		hall_symbol: "C -2a -2a",
		universal_h_m: "C m 2 a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 39,
		symbol_cif: "A c 2 m",
		symbol_hm_short: "Ac2m",
		hall_symbol: "A -2b -2b",
		universal_h_m: "A c 2 m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 40,
		symbol_cif: "A m a 2",
		symbol_hm_short: "Ama2",
		hall_symbol: "A 2 -2a",
		universal_h_m: "A m a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 40,
		symbol_cif: "B b m 2",
		symbol_hm_short: "Bbm2",
		hall_symbol: "B 2 -2b",
		universal_h_m: "B b m 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 40,
		symbol_cif: "B 2 m b",
		symbol_hm_short: "B2mb",
		hall_symbol: "B -2b 2",
		universal_h_m: "B 2 m b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x,-y,-z",
			"x,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"x+1/2,-y,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 40,
		symbol_cif: "C 2 c m",
		symbol_hm_short: "C2cm",
		hall_symbol: "C -2c 2",
		universal_h_m: "C 2 c m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"x,-y,-z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 40,
		symbol_cif: "C c 2 m",
		symbol_hm_short: "Cc2m",
		hall_symbol: "C -2c -2c",
		universal_h_m: "C c 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 40,
		symbol_cif: "A m 2 a",
		symbol_hm_short: "Am2a",
		hall_symbol: "A -2a -2a",
		universal_h_m: "A m 2 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 41,
		symbol_cif: "A b a 2",
		symbol_hm_short: "Aba2",
		hall_symbol: "A 2 -2ab",
		universal_h_m: "A b a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 41,
		symbol_cif: "B b a 2",
		symbol_hm_short: "Bba2",
		hall_symbol: "B 2 -2ab",
		universal_h_m: "B b a 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 41,
		symbol_cif: "B 2 c b",
		symbol_hm_short: "B2cb",
		hall_symbol: "B -2ab 2",
		universal_h_m: "B 2 c b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"x,-y,-z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"x,y+1/2,-z+1/2",
			"x+1/2,-y,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 41,
		symbol_cif: "C 2 c b",
		symbol_hm_short: "C2cb",
		hall_symbol: "C -2ac 2",
		universal_h_m: "C 2 c b",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"x,-y,-z",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 41,
		symbol_cif: "C c 2 a",
		symbol_hm_short: "Cc2a",
		hall_symbol: "C -2ac -2ac",
		universal_h_m: "C c 2 a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x,y,-z",
			"x+1/2,y+1/2,z",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 41,
		symbol_cif: "A c 2 a",
		symbol_hm_short: "Ac2a",
		hall_symbol: "A -2ab -2ab",
		universal_h_m: "A c 2 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 42,
		symbol_cif: "F m m 2",
		symbol_hm_short: "Fmm2",
		hall_symbol: "F 2 -2",
		universal_h_m: "F m m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 42,
		symbol_cif: "F 2 m m",
		symbol_hm_short: "F2mm",
		hall_symbol: "F -2 2",
		universal_h_m: "F 2 m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"x,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2",
			"x+1/2,-y,-z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z",
			"x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 42,
		symbol_cif: "F m 2 m",
		symbol_hm_short: "Fm2m",
		hall_symbol: "F -2 -2",
		universal_h_m: "F m 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2",
			"x+1/2,y,z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x+1/2,y,-z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 43,
		symbol_cif: "F d d 2",
		symbol_hm_short: "Fdd2",
		hall_symbol: "F 2 -2d",
		universal_h_m: "F d d 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/4,y+1/4,z+1/4",
			"x+1/4,-y+1/4,z+1/4",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"-x+1/4,y+3/4,z+3/4",
			"x+1/4,-y+3/4,z+3/4",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"-x+3/4,y+1/4,z+3/4",
			"x+3/4,-y+1/4,z+3/4",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"-x+3/4,y+3/4,z+1/4",
			"x+3/4,-y+3/4,z+1/4"
		]
	},
	{
		number: 43,
		symbol_cif: "F 2 d d",
		symbol_hm_short: "F2dd",
		hall_symbol: "F -2d 2",
		universal_h_m: "F 2 d d",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/4,y+1/4,-z+1/4",
			"x,-y,-z",
			"x+1/4,-y+3/4,z+3/4",
			"x,y+1/2,z+1/2",
			"x+1/4,y+3/4,-z+3/4",
			"x,-y+1/2,-z+1/2",
			"x+1/4,-y+1/4,z+1/4",
			"x+1/2,y,z+1/2",
			"x+3/4,y+1/4,-z+3/4",
			"x+1/2,-y,-z+1/2",
			"x+3/4,-y+3/4,z+1/4",
			"x+1/2,y+1/2,z",
			"x+3/4,y+3/4,-z+1/4",
			"x+1/2,-y+1/2,-z",
			"x+3/4,-y+1/4,z+3/4"
		]
	},
	{
		number: 43,
		symbol_cif: "F d 2 d",
		symbol_hm_short: "Fd2d",
		hall_symbol: "F -2d -2d",
		universal_h_m: "F d 2 d",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/4,y+1/4,-z+1/4",
			"-x+1/4,y+1/4,z+1/4",
			"-x,y+1/2,-z+1/2",
			"x,y+1/2,z+1/2",
			"x+1/4,y+3/4,-z+3/4",
			"-x+1/4,y+3/4,z+3/4",
			"-x,y,-z",
			"x+1/2,y,z+1/2",
			"x+3/4,y+1/4,-z+3/4",
			"-x+3/4,y+1/4,z+3/4",
			"-x+1/2,y+1/2,-z",
			"x+1/2,y+1/2,z",
			"x+3/4,y+3/4,-z+1/4",
			"-x+3/4,y+3/4,z+1/4",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 44,
		symbol_cif: "I m m 2",
		symbol_hm_short: "Imm2",
		hall_symbol: "I 2 -2",
		universal_h_m: "I m m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 44,
		symbol_cif: "I 2 m m",
		symbol_hm_short: "I2mm",
		hall_symbol: "I -2 2",
		universal_h_m: "I 2 m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"x,-y,-z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 44,
		symbol_cif: "I m 2 m",
		symbol_hm_short: "Im2m",
		hall_symbol: "I -2 -2",
		universal_h_m: "I m 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z",
			"-x,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 45,
		symbol_cif: "I b a 2",
		symbol_hm_short: "Iba2",
		hall_symbol: "I 2 -2c",
		universal_h_m: "I b a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y,z+1/2",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 45,
		symbol_cif: "I 2 c b",
		symbol_hm_short: "I2cb",
		hall_symbol: "I -2a 2",
		universal_h_m: "I 2 c b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"x,-y,-z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 45,
		symbol_cif: "I c 2 a",
		symbol_hm_short: "Ic2a",
		hall_symbol: "I -2b -2b",
		universal_h_m: "I c 2 a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 46,
		symbol_cif: "I m a 2",
		symbol_hm_short: "Ima2",
		hall_symbol: "I 2 -2a",
		universal_h_m: "I m a 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 46,
		symbol_cif: "I b m 2",
		symbol_hm_short: "Ibm2",
		hall_symbol: "I 2 -2b",
		universal_h_m: "I b m 2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 46,
		symbol_cif: "I 2 m b",
		symbol_hm_short: "I2mb",
		hall_symbol: "I -2b 2",
		universal_h_m: "I 2 m b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,-z",
			"x,-y,-z",
			"x,-y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 46,
		symbol_cif: "I 2 c m",
		symbol_hm_short: "I2cm",
		hall_symbol: "I -2c 2",
		universal_h_m: "I 2 c m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"x,-y,-z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z",
			"x+1/2,-y+1/2,-z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 46,
		symbol_cif: "I c 2 m",
		symbol_hm_short: "Ic2m",
		hall_symbol: "I -2c -2c",
		universal_h_m: "I c 2 m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 46,
		symbol_cif: "I m 2 a",
		symbol_hm_short: "Im2a",
		hall_symbol: "I -2a -2a",
		universal_h_m: "I m 2 a",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"-x,y,-z",
			"x+1/2,y+1/2,z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 47,
		symbol_cif: "P m m m",
		symbol_hm_short: "Pmmm",
		hall_symbol: "-P 2 2",
		universal_h_m: "P m m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z"
		]
	},
	{
		number: 48,
		symbol_cif: "P n n n",
		symbol_hm_short: "Pnnn",
		hall_symbol: "P 2 2 -1n",
		universal_h_m: "P n n n:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 48,
		symbol_cif: "P n n n",
		symbol_hm_short: "Pnnn",
		hall_symbol: "-P 2ab 2bc",
		universal_h_m: "P n n n:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 49,
		symbol_cif: "P c c m",
		symbol_hm_short: "Pccm",
		hall_symbol: "-P 2 2c",
		universal_h_m: "P c c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 49,
		symbol_cif: "P m a a",
		symbol_hm_short: "Pmaa",
		hall_symbol: "-P 2a 2",
		universal_h_m: "P m a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 49,
		symbol_cif: "P b m b",
		symbol_hm_short: "Pbmb",
		hall_symbol: "-P 2b 2b",
		universal_h_m: "P b m b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"x,-y,z"
		]
	},
	{
		number: 50,
		symbol_cif: "P b a n",
		symbol_hm_short: "Pban",
		hall_symbol: "P 2 2 -1ab",
		universal_h_m: "P b a n:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 50,
		symbol_cif: "P b a n",
		symbol_hm_short: "Pban",
		hall_symbol: "-P 2ab 2b",
		universal_h_m: "P b a n:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y+1/2,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 50,
		symbol_cif: "P n c b",
		symbol_hm_short: "Pncb",
		hall_symbol: "P 2 2 -1bc",
		universal_h_m: "P n c b:1",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 50,
		symbol_cif: "P n c b",
		symbol_hm_short: "Pncb",
		hall_symbol: "-P 2b 2bc",
		universal_h_m: "P n c b:2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 50,
		symbol_cif: "P c n a",
		symbol_hm_short: "Pcna",
		hall_symbol: "P 2 2 -1ac",
		universal_h_m: "P c n a:1",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 50,
		symbol_cif: "P c n a",
		symbol_hm_short: "Pcna",
		hall_symbol: "-P 2a 2c",
		universal_h_m: "P c n a:2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 51,
		symbol_cif: "P m m a",
		symbol_hm_short: "Pmma",
		hall_symbol: "-P 2a 2a",
		universal_h_m: "P m m a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"x,-y,z"
		]
	},
	{
		number: 51,
		symbol_cif: "P m m b",
		symbol_hm_short: "Pmmb",
		hall_symbol: "-P 2b 2",
		universal_h_m: "P m m b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 51,
		symbol_cif: "P b m m",
		symbol_hm_short: "Pbmm",
		hall_symbol: "-P 2 2b",
		universal_h_m: "P b m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y+1/2,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 51,
		symbol_cif: "P c m m",
		symbol_hm_short: "Pcmm",
		hall_symbol: "-P 2c 2c",
		universal_h_m: "P c m m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 51,
		symbol_cif: "P m c m",
		symbol_hm_short: "Pmcm",
		hall_symbol: "-P 2c 2",
		universal_h_m: "P m c m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 51,
		symbol_cif: "P m a m",
		symbol_hm_short: "Pmam",
		hall_symbol: "-P 2 2a",
		universal_h_m: "P m a m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 52,
		symbol_cif: "P n n a",
		symbol_hm_short: "Pnna",
		hall_symbol: "-P 2a 2bc",
		universal_h_m: "P n n a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 52,
		symbol_cif: "P n n b",
		symbol_hm_short: "Pnnb",
		hall_symbol: "-P 2b 2n",
		universal_h_m: "P n n b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 52,
		symbol_cif: "P b n n",
		symbol_hm_short: "Pbnn",
		hall_symbol: "-P 2n 2b",
		universal_h_m: "P b n n",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y+1/2,-z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y+1/2,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 52,
		symbol_cif: "P c n n",
		symbol_hm_short: "Pcnn",
		hall_symbol: "-P 2ab 2c",
		universal_h_m: "P c n n",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 52,
		symbol_cif: "P n c n",
		symbol_hm_short: "Pncn",
		hall_symbol: "-P 2ab 2n",
		universal_h_m: "P n c n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 52,
		symbol_cif: "P n a n",
		symbol_hm_short: "Pnan",
		hall_symbol: "-P 2n 2bc",
		universal_h_m: "P n a n",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y,z"
		]
	},
	{
		number: 53,
		symbol_cif: "P m n a",
		symbol_hm_short: "Pmna",
		hall_symbol: "-P 2ac 2",
		universal_h_m: "P m n a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x,y,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 53,
		symbol_cif: "P n m b",
		symbol_hm_short: "Pnmb",
		hall_symbol: "-P 2bc 2bc",
		universal_h_m: "P n m b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 53,
		symbol_cif: "P b m n",
		symbol_hm_short: "Pbmn",
		hall_symbol: "-P 2ab 2ab",
		universal_h_m: "P b m n",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x,-y,z"
		]
	},
	{
		number: 53,
		symbol_cif: "P c n m",
		symbol_hm_short: "Pcnm",
		hall_symbol: "-P 2 2ac",
		universal_h_m: "P c n m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 53,
		symbol_cif: "P n c m",
		symbol_hm_short: "Pncm",
		hall_symbol: "-P 2 2bc",
		universal_h_m: "P n c m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 53,
		symbol_cif: "P m a n",
		symbol_hm_short: "Pman",
		hall_symbol: "-P 2ab 2",
		universal_h_m: "P m a n",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 54,
		symbol_cif: "P c c a",
		symbol_hm_short: "Pcca",
		hall_symbol: "-P 2a 2ac",
		universal_h_m: "P c c a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 54,
		symbol_cif: "P c c b",
		symbol_hm_short: "Pccb",
		hall_symbol: "-P 2b 2c",
		universal_h_m: "P c c b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 54,
		symbol_cif: "P b a a",
		symbol_hm_short: "Pbaa",
		hall_symbol: "-P 2a 2b",
		universal_h_m: "P b a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 54,
		symbol_cif: "P c a a",
		symbol_hm_short: "Pcaa",
		hall_symbol: "-P 2ac 2c",
		universal_h_m: "P c a a",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x,y,z+1/2",
			"x+1/2,-y,z"
		]
	},
	{
		number: 54,
		symbol_cif: "P b c b",
		symbol_hm_short: "Pbcb",
		hall_symbol: "-P 2bc 2b",
		universal_h_m: "P b c b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 54,
		symbol_cif: "P b a b",
		symbol_hm_short: "Pbab",
		hall_symbol: "-P 2b 2ab",
		universal_h_m: "P b a b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 55,
		symbol_cif: "P b a m",
		symbol_hm_short: "Pbam",
		hall_symbol: "-P 2 2ab",
		universal_h_m: "P b a m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 55,
		symbol_cif: "P m c b",
		symbol_hm_short: "Pmcb",
		hall_symbol: "-P 2bc 2",
		universal_h_m: "P m c b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y,-z",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x,y,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 55,
		symbol_cif: "P c m a",
		symbol_hm_short: "Pcma",
		hall_symbol: "-P 2ac 2ac",
		universal_h_m: "P c m a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 56,
		symbol_cif: "P c c n",
		symbol_hm_short: "Pccn",
		hall_symbol: "-P 2ab 2ac",
		universal_h_m: "P c c n",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 56,
		symbol_cif: "P n a a",
		symbol_hm_short: "Pnaa",
		hall_symbol: "-P 2ac 2bc",
		universal_h_m: "P n a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 56,
		symbol_cif: "P b n b",
		symbol_hm_short: "Pbnb",
		hall_symbol: "-P 2bc 2ab",
		universal_h_m: "P b n b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 57,
		symbol_cif: "P b c m",
		symbol_hm_short: "Pbcm",
		hall_symbol: "-P 2c 2b",
		universal_h_m: "P b c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y+1/2,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 57,
		symbol_cif: "P c a m",
		symbol_hm_short: "Pcam",
		hall_symbol: "-P 2c 2ac",
		universal_h_m: "P c a m",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z"
		]
	},
	{
		number: 57,
		symbol_cif: "P m c a",
		symbol_hm_short: "Pmca",
		hall_symbol: "-P 2ac 2a",
		universal_h_m: "P m c a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 57,
		symbol_cif: "P m a b",
		symbol_hm_short: "Pmab",
		hall_symbol: "-P 2b 2a",
		universal_h_m: "P m a b",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x+1/2,-y,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x+1/2,y,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 57,
		symbol_cif: "P b m a",
		symbol_hm_short: "Pbma",
		hall_symbol: "-P 2a 2ab",
		universal_h_m: "P b m a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y+1/2,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 57,
		symbol_cif: "P c m b",
		symbol_hm_short: "Pcmb",
		hall_symbol: "-P 2bc 2c",
		universal_h_m: "P c m b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x,y,z+1/2",
			"x,-y+1/2,z"
		]
	},
	{
		number: 58,
		symbol_cif: "P n n m",
		symbol_hm_short: "Pnnm",
		hall_symbol: "-P 2 2n",
		universal_h_m: "P n n m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 58,
		symbol_cif: "P m n n",
		symbol_hm_short: "Pmnn",
		hall_symbol: "-P 2n 2",
		universal_h_m: "P m n n",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 58,
		symbol_cif: "P n m n",
		symbol_hm_short: "Pnmn",
		hall_symbol: "-P 2n 2n",
		universal_h_m: "P n m n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 59,
		symbol_cif: "P m m n",
		symbol_hm_short: "Pmmn",
		hall_symbol: "P 2 2ab -1ab",
		universal_h_m: "P m m n:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x,y,z",
			"x,-y,z"
		]
	},
	{
		number: 59,
		symbol_cif: "P m m n",
		symbol_hm_short: "Pmmn",
		hall_symbol: "-P 2ab 2a",
		universal_h_m: "P m m n:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 59,
		symbol_cif: "P n m m",
		symbol_hm_short: "Pnmm",
		hall_symbol: "P 2bc 2 -1bc",
		universal_h_m: "P n m m:1",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x,-y,-z",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y,-z",
			"-x,y+1/2,z+1/2",
			"x,-y,z"
		]
	},
	{
		number: 59,
		symbol_cif: "P n m m",
		symbol_hm_short: "Pnmm",
		hall_symbol: "-P 2c 2bc",
		universal_h_m: "P n m m:2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z"
		]
	},
	{
		number: 59,
		symbol_cif: "P m n m",
		symbol_hm_short: "Pmnm",
		hall_symbol: "P 2ac 2ac -1ac",
		universal_h_m: "P m n m:1",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z",
			"-x+1/2,-y,-z+1/2",
			"x,y,-z",
			"-x,y,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 59,
		symbol_cif: "P m n m",
		symbol_hm_short: "Pmnm",
		hall_symbol: "-P 2c 2a",
		universal_h_m: "P m n m:2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x+1/2,y,z",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 60,
		symbol_cif: "P b c n",
		symbol_hm_short: "Pbcn",
		hall_symbol: "-P 2n 2ab",
		universal_h_m: "P b c n",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x,-y,z+1/2"
		]
	},
	{
		number: 60,
		symbol_cif: "P c a n",
		symbol_hm_short: "Pcan",
		hall_symbol: "-P 2n 2c",
		universal_h_m: "P c a n",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 60,
		symbol_cif: "P n c a",
		symbol_hm_short: "Pnca",
		hall_symbol: "-P 2a 2n",
		universal_h_m: "P n c a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 60,
		symbol_cif: "P n a b",
		symbol_hm_short: "Pnab",
		hall_symbol: "-P 2bc 2n",
		universal_h_m: "P n a b",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y,z"
		]
	},
	{
		number: 60,
		symbol_cif: "P b n a",
		symbol_hm_short: "Pbna",
		hall_symbol: "-P 2ac 2b",
		universal_h_m: "P b n a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y+1/2,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 60,
		symbol_cif: "P c n b",
		symbol_hm_short: "Pcnb",
		hall_symbol: "-P 2b 2ac",
		universal_h_m: "P c n b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 61,
		symbol_cif: "P b c a",
		symbol_hm_short: "Pbca",
		hall_symbol: "-P 2ac 2ab",
		universal_h_m: "P b c a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 61,
		symbol_cif: "P c a b",
		symbol_hm_short: "Pcab",
		hall_symbol: "-P 2bc 2ac",
		universal_h_m: "P c a b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 62,
		symbol_cif: "P n m a",
		symbol_hm_short: "Pnma",
		hall_symbol: "-P 2ac 2n",
		universal_h_m: "P n m a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z"
		]
	},
	{
		number: 62,
		symbol_cif: "P m n b",
		symbol_hm_short: "Pmnb",
		hall_symbol: "-P 2bc 2a",
		universal_h_m: "P m n b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 62,
		symbol_cif: "P b n m",
		symbol_hm_short: "Pbnm",
		hall_symbol: "-P 2c 2ab",
		universal_h_m: "P b n m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 62,
		symbol_cif: "P c m n",
		symbol_hm_short: "Pcmn",
		hall_symbol: "-P 2n 2ac",
		universal_h_m: "P c m n",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y+1/2,z"
		]
	},
	{
		number: 62,
		symbol_cif: "P m c n",
		symbol_hm_short: "Pmcn",
		hall_symbol: "-P 2n 2a",
		universal_h_m: "P m c n",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 62,
		symbol_cif: "P n a m",
		symbol_hm_short: "Pnam",
		hall_symbol: "-P 2c 2n",
		universal_h_m: "P n a m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 63,
		symbol_cif: "C m c m",
		symbol_hm_short: "Cmcm",
		hall_symbol: "-C 2c 2",
		universal_h_m: "C m c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 63,
		symbol_cif: "C c m m",
		symbol_hm_short: "Ccmm",
		hall_symbol: "-C 2c 2c",
		universal_h_m: "C c m m",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 63,
		symbol_cif: "A m m a",
		symbol_hm_short: "Amma",
		hall_symbol: "-A 2a 2a",
		universal_h_m: "A m m a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 63,
		symbol_cif: "A m a m",
		symbol_hm_short: "Amam",
		hall_symbol: "-A 2 2a",
		universal_h_m: "A m a m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 63,
		symbol_cif: "B b m m",
		symbol_hm_short: "Bbmm",
		hall_symbol: "-B 2 2b",
		universal_h_m: "B b m m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 63,
		symbol_cif: "B m m b",
		symbol_hm_short: "Bmmb",
		hall_symbol: "-B 2b 2",
		universal_h_m: "B m m b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y,z",
			"x,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 64,
		symbol_cif: "C m c a",
		symbol_hm_short: "Cmca",
		hall_symbol: "-C 2ac 2",
		universal_h_m: "C m c a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x,y,z",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 64,
		symbol_cif: "C c m b",
		symbol_hm_short: "Ccmb",
		hall_symbol: "-C 2ac 2ac",
		universal_h_m: "C c m b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 64,
		symbol_cif: "A b m a",
		symbol_hm_short: "Abma",
		hall_symbol: "-A 2ab 2ab",
		universal_h_m: "A b m a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 64,
		symbol_cif: "A c a m",
		symbol_hm_short: "Acam",
		hall_symbol: "-A 2 2ab",
		universal_h_m: "A c a m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 64,
		symbol_cif: "B b c m",
		symbol_hm_short: "Bbcm",
		hall_symbol: "-B 2 2ab",
		universal_h_m: "B b c m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 64,
		symbol_cif: "B m a b",
		symbol_hm_short: "Bmab",
		hall_symbol: "-B 2ab 2",
		universal_h_m: "B m a b",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 65,
		symbol_cif: "C m m m",
		symbol_hm_short: "Cmmm",
		hall_symbol: "-C 2 2",
		universal_h_m: "C m m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 65,
		symbol_cif: "A m m m",
		symbol_hm_short: "Ammm",
		hall_symbol: "-A 2 2",
		universal_h_m: "A m m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 65,
		symbol_cif: "B m m m",
		symbol_hm_short: "Bmmm",
		hall_symbol: "-B 2 2",
		universal_h_m: "B m m m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 66,
		symbol_cif: "C c c m",
		symbol_hm_short: "Cccm",
		hall_symbol: "-C 2 2c",
		universal_h_m: "C c c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z+1/2",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 66,
		symbol_cif: "A m a a",
		symbol_hm_short: "Amaa",
		hall_symbol: "-A 2a 2",
		universal_h_m: "A m a a",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 66,
		symbol_cif: "B b m b",
		symbol_hm_short: "Bbmb",
		hall_symbol: "-B 2b 2b",
		universal_h_m: "B b m b",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"x,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 67,
		symbol_cif: "C m m a",
		symbol_hm_short: "Cmma",
		hall_symbol: "-C 2a 2",
		universal_h_m: "C m m a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x,-y+1/2,z"
		]
	},
	{
		number: 67,
		symbol_cif: "C m m b",
		symbol_hm_short: "Cmmb",
		hall_symbol: "-C 2a 2a",
		universal_h_m: "C m m b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 67,
		symbol_cif: "A b m m",
		symbol_hm_short: "Abmm",
		hall_symbol: "-A 2b 2b",
		universal_h_m: "A b m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 67,
		symbol_cif: "A c m m",
		symbol_hm_short: "Acmm",
		hall_symbol: "-A 2 2b",
		universal_h_m: "A c m m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 67,
		symbol_cif: "B m c m",
		symbol_hm_short: "Bmcm",
		hall_symbol: "-B 2 2a",
		universal_h_m: "B m c m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 67,
		symbol_cif: "B m a m",
		symbol_hm_short: "Bmam",
		hall_symbol: "-B 2a 2",
		universal_h_m: "B m a m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"-x,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "C c c a",
		symbol_hm_short: "Ccca",
		hall_symbol: "C 2 2 -1ac",
		universal_h_m: "C c c a:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "C c c a",
		symbol_hm_short: "Ccca",
		hall_symbol: "-C 2a 2ac",
		universal_h_m: "C c c a:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z+1/2",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "C c c b",
		symbol_hm_short: "Cccb",
		hall_symbol: "C 2 2 -1ac",
		universal_h_m: "C c c b:1",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "C c c b",
		symbol_hm_short: "Cccb",
		hall_symbol: "-C 2a 2c",
		universal_h_m: "C c c b:2",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"x,y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "A b a a",
		symbol_hm_short: "Abaa",
		hall_symbol: "A 2 2 -1ab",
		universal_h_m: "A b a a:1",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "A b a a",
		symbol_hm_short: "Abaa",
		hall_symbol: "-A 2a 2b",
		universal_h_m: "A b a a:2",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "A c a a",
		symbol_hm_short: "Acaa",
		hall_symbol: "A 2 2 -1ab",
		universal_h_m: "A c a a:1",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "A c a a",
		symbol_hm_short: "Acaa",
		hall_symbol: "-A 2ab 2b",
		universal_h_m: "A c a a:2",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y+1/2,z",
			"x+1/2,-y,z",
			"x,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x,y,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "B b c b",
		symbol_hm_short: "Bbcb",
		hall_symbol: "B 2 2 -1ab",
		universal_h_m: "B b c b:1",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "B b c b",
		symbol_hm_short: "Bbcb",
		hall_symbol: "-B 2ab 2b",
		universal_h_m: "B b c b:2",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y+1/2,z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "B b a b",
		symbol_hm_short: "Bbab",
		hall_symbol: "B 2 2 -1ab",
		universal_h_m: "B b a b:1",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 68,
		symbol_cif: "B b a b",
		symbol_hm_short: "Bbab",
		hall_symbol: "-B 2b 2ab",
		universal_h_m: "B b a b:2",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y,z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 69,
		symbol_cif: "F m m m",
		symbol_hm_short: "Fmmm",
		hall_symbol: "-F 2 2",
		universal_h_m: "F m m m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.-x,-y,-z.x,y,-z.-x,y,z.x,-y,z.x,y+1/2,z+1/2.-x,-y+1/2,z+1/2.x,-y+1/2,-z+1/2.-x,y+1/2,-z+1/2.-x,-y+1/2,-z+1/2.x,y+1/2,-z+1/2.-x,y+1/2,z+1/2.x,-y+1/2,z+1/2.x+1/2,y,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y,-z+1/2.-x+1/2,y,-z+1/2.-x+1/2,-y,-z+1/2.x+1/2,y,-z+1/2.-x+1/2,y,z+1/2.x+1/2,-y,z+1/2.x+1/2,y+1/2,z.-x+1/2,-y+1/2,z.x+1/2,-y+1/2,-z.-x+1/2,y+1/2,-z.-x+1/2,-y+1/2,-z.x+1/2,y+1/2,-z.-x+1/2,y+1/2,z.x+1/2,-y+1/2,z".split(".")
	},
	{
		number: 70,
		symbol_cif: "F d d d",
		symbol_hm_short: "Fddd",
		hall_symbol: "F 2 2 -1d",
		universal_h_m: "F d d d:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.-x+1/4,-y+1/4,-z+1/4.x+1/4,y+1/4,-z+1/4.-x+1/4,y+1/4,z+1/4.x+1/4,-y+1/4,z+1/4.x,y+1/2,z+1/2.-x,-y+1/2,z+1/2.x,-y+1/2,-z+1/2.-x,y+1/2,-z+1/2.-x+1/4,-y+3/4,-z+3/4.x+1/4,y+3/4,-z+3/4.-x+1/4,y+3/4,z+3/4.x+1/4,-y+3/4,z+3/4.x+1/2,y,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y,-z+1/2.-x+1/2,y,-z+1/2.-x+3/4,-y+1/4,-z+3/4.x+3/4,y+1/4,-z+3/4.-x+3/4,y+1/4,z+3/4.x+3/4,-y+1/4,z+3/4.x+1/2,y+1/2,z.-x+1/2,-y+1/2,z.x+1/2,-y+1/2,-z.-x+1/2,y+1/2,-z.-x+3/4,-y+3/4,-z+1/4.x+3/4,y+3/4,-z+1/4.-x+3/4,y+3/4,z+1/4.x+3/4,-y+3/4,z+1/4".split(".")
	},
	{
		number: 70,
		symbol_cif: "F d d d",
		symbol_hm_short: "Fddd",
		hall_symbol: "-F 2uv 2vw",
		universal_h_m: "F d d d:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-x+1/4,-y+1/4,z.x,-y+1/4,-z+1/4.-x+1/4,y,-z+1/4.-x,-y,-z.x+3/4,y+3/4,-z.-x,y+3/4,z+3/4.x+3/4,-y,z+3/4.x,y+1/2,z+1/2.-x+1/4,-y+3/4,z+1/2.x,-y+3/4,-z+3/4.-x+1/4,y+1/2,-z+3/4.-x,-y+1/2,-z+1/2.x+3/4,y+1/4,-z+1/2.-x,y+1/4,z+1/4.x+3/4,-y+1/2,z+1/4.x+1/2,y,z+1/2.-x+3/4,-y+1/4,z+1/2.x+1/2,-y+1/4,-z+3/4.-x+3/4,y,-z+3/4.-x+1/2,-y,-z+1/2.x+1/4,y+3/4,-z+1/2.-x+1/2,y+3/4,z+1/4.x+1/4,-y,z+1/4.x+1/2,y+1/2,z.-x+3/4,-y+3/4,z.x+1/2,-y+3/4,-z+1/4.-x+3/4,y+1/2,-z+1/4.-x+1/2,-y+1/2,-z.x+1/4,y+1/4,-z.-x+1/2,y+1/4,z+3/4.x+1/4,-y+1/2,z+3/4".split(".")
	},
	{
		number: 71,
		symbol_cif: "I m m m",
		symbol_hm_short: "Immm",
		hall_symbol: "-I 2 2",
		universal_h_m: "I m m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 72,
		symbol_cif: "I b a m",
		symbol_hm_short: "Ibam",
		hall_symbol: "-I 2 2c",
		universal_h_m: "I b a m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z+1/2",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 72,
		symbol_cif: "I m c b",
		symbol_hm_short: "Imcb",
		hall_symbol: "-I 2a 2",
		universal_h_m: "I m c b",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y,z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 72,
		symbol_cif: "I c m a",
		symbol_hm_short: "Icma",
		hall_symbol: "-I 2b 2b",
		universal_h_m: "I c m a",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y+1/2,z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 73,
		symbol_cif: "I b c a",
		symbol_hm_short: "Ibca",
		hall_symbol: "-I 2b 2c",
		universal_h_m: "I b c a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y,z+1/2",
			"x,-y+1/2,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y,z"
		]
	},
	{
		number: 73,
		symbol_cif: "I c a b",
		symbol_hm_short: "Icab",
		hall_symbol: "-I 2a 2b",
		universal_h_m: "I c a b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x,y,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x,-y,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I m m a",
		symbol_hm_short: "Imma",
		hall_symbol: "-I 2b 2",
		universal_h_m: "I m m a",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y+1/2,-z",
			"-x,y,z",
			"x,-y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I m m b",
		symbol_hm_short: "Immb",
		hall_symbol: "-I 2a 2a",
		universal_h_m: "I m m b",
		setting: "ba-c",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z",
			"x+1/2,-y,-z",
			"-x,y,-z",
			"-x,-y,-z",
			"x+1/2,y,-z",
			"-x+1/2,y,z",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I b m m",
		symbol_hm_short: "Ibmm",
		hall_symbol: "-I 2c 2c",
		universal_h_m: "I b m m",
		setting: "cab",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z+1/2",
			"-x,y,-z",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z+1/2",
			"x,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I c m m",
		symbol_hm_short: "Icmm",
		hall_symbol: "-I 2 2b",
		universal_h_m: "I c m m",
		setting: "-cba",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y+1/2,z",
			"x,-y+1/2,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I m c m",
		symbol_hm_short: "Imcm",
		hall_symbol: "-I 2 2a",
		universal_h_m: "I m c m",
		setting: "bca",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y,z",
			"x+1/2,-y,z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2"
		]
	},
	{
		number: 74,
		symbol_cif: "I m a m",
		symbol_hm_short: "Imam",
		hall_symbol: "-I 2c 2",
		universal_h_m: "I m a m",
		setting: "a-cb",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x,-y,-z",
			"-x,y,-z+1/2",
			"-x,-y,-z",
			"x,y,-z+1/2",
			"-x,y,z",
			"x,-y,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 75,
		symbol_cif: "P 4",
		symbol_hm_short: "P4",
		hall_symbol: "P 4",
		universal_h_m: "P 4",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z"
		]
	},
	{
		number: 76,
		symbol_cif: "P 41",
		symbol_hm_short: "P41",
		hall_symbol: "P 4w",
		universal_h_m: "P 41",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/4",
			"-x,-y,z+1/2",
			"y,-x,z+3/4"
		]
	},
	{
		number: 77,
		symbol_cif: "P 42",
		symbol_hm_short: "P42",
		hall_symbol: "P 4c",
		universal_h_m: "P 42",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2"
		]
	},
	{
		number: 78,
		symbol_cif: "P 43",
		symbol_hm_short: "P43",
		hall_symbol: "P 4cw",
		universal_h_m: "P 43",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+3/4",
			"-x,-y,z+1/2",
			"y,-x,z+1/4"
		]
	},
	{
		number: 79,
		symbol_cif: "I 4",
		symbol_hm_short: "I4",
		hall_symbol: "I 4",
		universal_h_m: "I 4",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 80,
		symbol_cif: "I 41",
		symbol_hm_short: "I41",
		hall_symbol: "I 4bw",
		universal_h_m: "I 41",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/4",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x,z+3/4",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x,z+3/4",
			"-x,-y,z",
			"y,-x+1/2,z+1/4"
		]
	},
	{
		number: 81,
		symbol_cif: "P -4",
		symbol_hm_short: "P-4",
		hall_symbol: "P -4",
		universal_h_m: "P -4",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z"
		]
	},
	{
		number: 82,
		symbol_cif: "I -4",
		symbol_hm_short: "I-4",
		hall_symbol: "I -4",
		universal_h_m: "I -4",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x+1/2,y+1/2,z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-y+1/2,x+1/2,-z+1/2"
		]
	},
	{
		number: 83,
		symbol_cif: "P 4/m",
		symbol_hm_short: "P4/m",
		hall_symbol: "-P 4",
		universal_h_m: "P 4/m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z"
		]
	},
	{
		number: 84,
		symbol_cif: "P 42/m",
		symbol_hm_short: "P42/m",
		hall_symbol: "-P 4c",
		universal_h_m: "P 42/m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"-x,-y,-z",
			"y,-x,-z+1/2",
			"x,y,-z",
			"-y,x,-z+1/2"
		]
	},
	{
		number: 85,
		symbol_cif: "P 4/n",
		symbol_hm_short: "P4/n",
		hall_symbol: "P 4ab -1ab",
		universal_h_m: "P 4/n:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z",
			"-x,-y,z",
			"y+1/2,-x+1/2,z",
			"-x+1/2,-y+1/2,-z",
			"y,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x,-z"
		]
	},
	{
		number: 85,
		symbol_cif: "P 4/n",
		symbol_hm_short: "P4/n",
		hall_symbol: "-P 4a",
		universal_h_m: "P 4/n:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"-x,-y,-z",
			"y+1/2,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z"
		]
	},
	{
		number: 86,
		symbol_cif: "P 42/n",
		symbol_hm_short: "P42/n",
		hall_symbol: "P 4n -1n",
		universal_h_m: "P 42/n:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"y,-x,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-y,x,-z"
		]
	},
	{
		number: 86,
		symbol_cif: "P 42/n",
		symbol_hm_short: "P42/n",
		hall_symbol: "-P 4bc",
		universal_h_m: "P 42/n:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y+1/2,-x,z+1/2",
			"-x,-y,-z",
			"y,-x+1/2,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-y+1/2,x,-z+1/2"
		]
	},
	{
		number: 87,
		symbol_cif: "I 4/m",
		symbol_hm_short: "I4/m",
		hall_symbol: "-I 4",
		universal_h_m: "I 4/m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x+1/2,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-y+1/2,x+1/2,-z+1/2"
		]
	},
	{
		number: 88,
		symbol_cif: "I 41/a",
		symbol_hm_short: "I41/a",
		hall_symbol: "I 4bw -1bw",
		universal_h_m: "I 41/a:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/4",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x,z+3/4",
			"-x,-y+1/2,-z+1/4",
			"y,-x,-z",
			"x+1/2,y,-z+3/4",
			"-y+1/2,x+1/2,-z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x,z+3/4",
			"-x,-y,z",
			"y,-x+1/2,z+1/4",
			"-x+1/2,-y,-z+3/4",
			"y+1/2,-x+1/2,-z+1/2",
			"x,y+1/2,-z+1/4",
			"-y,x,-z"
		]
	},
	{
		number: 88,
		symbol_cif: "I 41/a",
		symbol_hm_short: "I41/a",
		hall_symbol: "-I 4ad",
		universal_h_m: "I 41/a:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+3/4,x+1/4,z+1/4",
			"-x+1/2,-y,z+1/2",
			"y+3/4,-x+3/4,z+3/4",
			"-x,-y,-z",
			"y+1/4,-x+3/4,-z+3/4",
			"x+1/2,y,-z+1/2",
			"-y+1/4,x+1/4,-z+1/4",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/4,x+3/4,z+3/4",
			"-x,-y+1/2,z",
			"y+1/4,-x+1/4,z+1/4",
			"-x+1/2,-y+1/2,-z+1/2",
			"y+3/4,-x+1/4,-z+1/4",
			"x,y+1/2,-z",
			"-y+3/4,x+3/4,-z+3/4"
		]
	},
	{
		number: 89,
		symbol_cif: "P 4 2 2",
		symbol_hm_short: "P422",
		hall_symbol: "P 4 2",
		universal_h_m: "P 4 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z"
		]
	},
	{
		number: 90,
		symbol_cif: "P 4 21 2",
		symbol_hm_short: "P4212",
		hall_symbol: "P 4ab 2ab",
		universal_h_m: "P 4 21 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z",
			"-x,-y,z",
			"y+1/2,-x+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-y,-x,-z",
			"-x+1/2,y+1/2,-z",
			"y,x,-z"
		]
	},
	{
		number: 91,
		symbol_cif: "P 41 2 2",
		symbol_hm_short: "P4122",
		hall_symbol: "P 4w 2c",
		universal_h_m: "P 41 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/4",
			"-x,-y,z+1/2",
			"y,-x,z+3/4",
			"x,-y,-z+1/2",
			"-y,-x,-z+1/4",
			"-x,y,-z",
			"y,x,-z+3/4"
		]
	},
	{
		number: 92,
		symbol_cif: "P 41 21 2",
		symbol_hm_short: "P41212",
		hall_symbol: "P 4abw 2nw",
		universal_h_m: "P 41 21 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/4",
			"-x,-y,z+1/2",
			"y+1/2,-x+1/2,z+3/4",
			"x+1/2,-y+1/2,-z+3/4",
			"-y,-x,-z+1/2",
			"-x+1/2,y+1/2,-z+1/4",
			"y,x,-z"
		]
	},
	{
		number: 93,
		symbol_cif: "P 42 2 2",
		symbol_hm_short: "P4222",
		hall_symbol: "P 4c 2",
		universal_h_m: "P 42 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"x,-y,-z",
			"-y,-x,-z+1/2",
			"-x,y,-z",
			"y,x,-z+1/2"
		]
	},
	{
		number: 94,
		symbol_cif: "P 42 21 2",
		symbol_hm_short: "P42212",
		hall_symbol: "P 4n 2n",
		universal_h_m: "P 42 21 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-y,-x,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"y,x,-z"
		]
	},
	{
		number: 95,
		symbol_cif: "P 43 2 2",
		symbol_hm_short: "P4322",
		hall_symbol: "P 4cw 2c",
		universal_h_m: "P 43 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+3/4",
			"-x,-y,z+1/2",
			"y,-x,z+1/4",
			"x,-y,-z+1/2",
			"-y,-x,-z+3/4",
			"-x,y,-z",
			"y,x,-z+1/4"
		]
	},
	{
		number: 96,
		symbol_cif: "P 43 21 2",
		symbol_hm_short: "P43212",
		hall_symbol: "P 4nw 2abw",
		universal_h_m: "P 43 21 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+3/4",
			"-x,-y,z+1/2",
			"y+1/2,-x+1/2,z+1/4",
			"x+1/2,-y+1/2,-z+1/4",
			"-y,-x,-z+1/2",
			"-x+1/2,y+1/2,-z+3/4",
			"y,x,-z"
		]
	},
	{
		number: 97,
		symbol_cif: "I 4 2 2",
		symbol_hm_short: "I422",
		hall_symbol: "I 4 2",
		universal_h_m: "I 4 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"y+1/2,x+1/2,-z+1/2"
		]
	},
	{
		number: 98,
		symbol_cif: "I 41 2 2",
		symbol_hm_short: "I4122",
		hall_symbol: "I 4bw 2bw",
		universal_h_m: "I 41 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/4",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x,z+3/4",
			"x,-y+1/2,-z+1/4",
			"-y,-x,-z",
			"-x+1/2,y,-z+3/4",
			"y+1/2,x+1/2,-z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x,z+3/4",
			"-x,-y,z",
			"y,-x+1/2,z+1/4",
			"x+1/2,-y,-z+3/4",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x,y+1/2,-z+1/4",
			"y,x,-z"
		]
	},
	{
		number: 99,
		symbol_cif: "P 4 m m",
		symbol_hm_short: "P4mm",
		hall_symbol: "P 4 -2",
		universal_h_m: "P 4 m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,y,z",
			"y,x,z",
			"x,-y,z",
			"-y,-x,z"
		]
	},
	{
		number: 100,
		symbol_cif: "P 4 b m",
		symbol_hm_short: "P4bm",
		hall_symbol: "P 4 -2ab",
		universal_h_m: "P 4 b m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 101,
		symbol_cif: "P 42 c m",
		symbol_hm_short: "P42cm",
		hall_symbol: "P 4c -2c",
		universal_h_m: "P 42 c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"-x,y,z+1/2",
			"y,x,z",
			"x,-y,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 102,
		symbol_cif: "P 42 n m",
		symbol_hm_short: "P42nm",
		hall_symbol: "P 4n -2n",
		universal_h_m: "P 42 n m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"y,x,z",
			"x+1/2,-y+1/2,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 103,
		symbol_cif: "P 4 c c",
		symbol_hm_short: "P4cc",
		hall_symbol: "P 4 -2c",
		universal_h_m: "P 4 c c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,y,z+1/2",
			"y,x,z+1/2",
			"x,-y,z+1/2",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 104,
		symbol_cif: "P 4 n c",
		symbol_hm_short: "P4nc",
		hall_symbol: "P 4 -2n",
		universal_h_m: "P 4 n c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x+1/2,y+1/2,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 105,
		symbol_cif: "P 42 m c",
		symbol_hm_short: "P42mc",
		hall_symbol: "P 4c -2",
		universal_h_m: "P 42 m c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"-x,y,z",
			"y,x,z+1/2",
			"x,-y,z",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 106,
		symbol_cif: "P 42 b c",
		symbol_hm_short: "P42bc",
		hall_symbol: "P 4c -2ab",
		universal_h_m: "P 42 b c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 107,
		symbol_cif: "I 4 m m",
		symbol_hm_short: "I4mm",
		hall_symbol: "I 4 -2",
		universal_h_m: "I 4 m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,y,z",
			"y,x,z",
			"x,-y,z",
			"-y,-x,z",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x+1/2,z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 108,
		symbol_cif: "I 4 c m",
		symbol_hm_short: "I4cm",
		hall_symbol: "I 4 -2c",
		universal_h_m: "I 4 c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"-x,y,z+1/2",
			"y,x,z+1/2",
			"x,-y,z+1/2",
			"-y,-x,z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x+1/2,z+1/2",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 109,
		symbol_cif: "I 41 m d",
		symbol_hm_short: "I41md",
		hall_symbol: "I 4bw -2",
		universal_h_m: "I 41 m d",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/4",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x,z+3/4",
			"-x,y,z",
			"y,x+1/2,z+1/4",
			"x+1/2,-y+1/2,z+1/2",
			"-y+1/2,-x,z+3/4",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x,z+3/4",
			"-x,-y,z",
			"y,-x+1/2,z+1/4",
			"-x+1/2,y+1/2,z+1/2",
			"y+1/2,x,z+3/4",
			"x,-y,z",
			"-y,-x+1/2,z+1/4"
		]
	},
	{
		number: 110,
		symbol_cif: "I 41 c d",
		symbol_hm_short: "I41cd",
		hall_symbol: "I 4bw -2c",
		universal_h_m: "I 41 c d",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/4",
			"-x+1/2,-y+1/2,z+1/2",
			"y+1/2,-x,z+3/4",
			"-x,y,z+1/2",
			"y,x+1/2,z+3/4",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x,z+1/4",
			"x+1/2,y+1/2,z+1/2",
			"-y+1/2,x,z+3/4",
			"-x,-y,z",
			"y,-x+1/2,z+1/4",
			"-x+1/2,y+1/2,z",
			"y+1/2,x,z+1/4",
			"x,-y,z+1/2",
			"-y,-x+1/2,z+3/4"
		]
	},
	{
		number: 111,
		symbol_cif: "P -4 2 m",
		symbol_hm_short: "P-42m",
		hall_symbol: "P -4 2",
		universal_h_m: "P -4 2 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y,-z",
			"y,x,z",
			"-x,y,-z",
			"-y,-x,z"
		]
	},
	{
		number: 112,
		symbol_cif: "P -4 2 c",
		symbol_hm_short: "P-42c",
		hall_symbol: "P -4 2c",
		universal_h_m: "P -4 2 c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y,-z+1/2",
			"y,x,z+1/2",
			"-x,y,-z+1/2",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 113,
		symbol_cif: "P -4 21 m",
		symbol_hm_short: "P-421m",
		hall_symbol: "P -4 2ab",
		universal_h_m: "P -4 21 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x+1/2,-y+1/2,-z",
			"y+1/2,x+1/2,z",
			"-x+1/2,y+1/2,-z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 114,
		symbol_cif: "P -4 21 c",
		symbol_hm_short: "P-421c",
		hall_symbol: "P -4 2n",
		universal_h_m: "P -4 21 c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x+1/2,-y+1/2,-z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 115,
		symbol_cif: "P -4 m 2",
		symbol_hm_short: "P-4m2",
		hall_symbol: "P -4 -2",
		universal_h_m: "P -4 m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x,y,z",
			"-y,-x,-z",
			"x,-y,z",
			"y,x,-z"
		]
	},
	{
		number: 116,
		symbol_cif: "P -4 c 2",
		symbol_hm_short: "P-4c2",
		hall_symbol: "P -4 -2c",
		universal_h_m: "P -4 c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x,y,z+1/2",
			"-y,-x,-z+1/2",
			"x,-y,z+1/2",
			"y,x,-z+1/2"
		]
	},
	{
		number: 117,
		symbol_cif: "P -4 b 2",
		symbol_hm_short: "P-4b2",
		hall_symbol: "P -4 -2ab",
		universal_h_m: "P -4 b 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x+1/2,y+1/2,z",
			"-y+1/2,-x+1/2,-z",
			"x+1/2,-y+1/2,z",
			"y+1/2,x+1/2,-z"
		]
	},
	{
		number: 118,
		symbol_cif: "P -4 n 2",
		symbol_hm_short: "P-4n2",
		hall_symbol: "P -4 -2n",
		universal_h_m: "P -4 n 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x+1/2,y+1/2,z+1/2",
			"-y+1/2,-x+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"y+1/2,x+1/2,-z+1/2"
		]
	},
	{
		number: 119,
		symbol_cif: "I -4 m 2",
		symbol_hm_short: "I-4m2",
		hall_symbol: "I -4 -2",
		universal_h_m: "I -4 m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x,y,z",
			"-y,-x,-z",
			"x,-y,z",
			"y,x,-z",
			"x+1/2,y+1/2,z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-y+1/2,x+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"-y+1/2,-x+1/2,-z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"y+1/2,x+1/2,-z+1/2"
		]
	},
	{
		number: 120,
		symbol_cif: "I -4 c 2",
		symbol_hm_short: "I-4c2",
		hall_symbol: "I -4 -2c",
		universal_h_m: "I -4 c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x,y,z+1/2",
			"-y,-x,-z+1/2",
			"x,-y,z+1/2",
			"y,x,-z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-y+1/2,x+1/2,-z+1/2",
			"-x+1/2,y+1/2,z",
			"-y+1/2,-x+1/2,-z",
			"x+1/2,-y+1/2,z",
			"y+1/2,x+1/2,-z"
		]
	},
	{
		number: 121,
		symbol_cif: "I -4 2 m",
		symbol_hm_short: "I-42m",
		hall_symbol: "I -4 2",
		universal_h_m: "I -4 2 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y,-z",
			"y,x,z",
			"-x,y,-z",
			"-y,-x,z",
			"x+1/2,y+1/2,z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-y+1/2,x+1/2,-z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 122,
		symbol_cif: "I -4 2 d",
		symbol_hm_short: "I-42d",
		hall_symbol: "I -4 2bw",
		universal_h_m: "I -4 2 d",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y+1/2,-z+1/4",
			"y,x+1/2,z+1/4",
			"-x,y+1/2,-z+1/4",
			"-y,-x+1/2,z+1/4",
			"x+1/2,y+1/2,z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"-y+1/2,x+1/2,-z+1/2",
			"x+1/2,-y,-z+3/4",
			"y+1/2,x,z+3/4",
			"-x+1/2,y,-z+3/4",
			"-y+1/2,-x,z+3/4"
		]
	},
	{
		number: 123,
		symbol_cif: "P 4/m m m",
		symbol_hm_short: "P4/mmm",
		hall_symbol: "-P 4 2",
		universal_h_m: "P 4/m m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z",
			"-x,y,z",
			"y,x,z",
			"x,-y,z",
			"-y,-x,z"
		]
	},
	{
		number: 124,
		symbol_cif: "P 4/m c c",
		symbol_hm_short: "P4/mcc",
		hall_symbol: "-P 4 2c",
		universal_h_m: "P 4/m c c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z+1/2",
			"-y,-x,-z+1/2",
			"-x,y,-z+1/2",
			"y,x,-z+1/2",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z",
			"-x,y,z+1/2",
			"y,x,z+1/2",
			"x,-y,z+1/2",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 125,
		symbol_cif: "P 4/n b m",
		symbol_hm_short: "P4/nbm",
		hall_symbol: "P 4 2 -1ab",
		universal_h_m: "P 4/n b m:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"-x+1/2,-y+1/2,-z",
			"y+1/2,-x+1/2,-z",
			"x+1/2,y+1/2,-z",
			"-y+1/2,x+1/2,-z",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 125,
		symbol_cif: "P 4/n b m",
		symbol_hm_short: "P4/nbm",
		hall_symbol: "-P 4a 2b",
		universal_h_m: "P 4/n b m:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"x,-y+1/2,-z",
			"-y+1/2,-x+1/2,-z",
			"-x+1/2,y,-z",
			"y,x,-z",
			"-x,-y,-z",
			"y+1/2,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z",
			"-x,y+1/2,z",
			"y+1/2,x+1/2,z",
			"x+1/2,-y,z",
			"-y,-x,z"
		]
	},
	{
		number: 126,
		symbol_cif: "P 4/n n c",
		symbol_hm_short: "P4/nnc",
		hall_symbol: "P 4 2 -1n",
		universal_h_m: "P 4/n n c:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"y+1/2,-x+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-y+1/2,x+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 126,
		symbol_cif: "P 4/n n c",
		symbol_hm_short: "P4/nnc",
		hall_symbol: "-P 4a 2bc",
		universal_h_m: "P 4/n n c:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"y,x,-z+1/2",
			"-x,-y,-z",
			"y+1/2,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z",
			"-x,y+1/2,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y,z+1/2",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 127,
		symbol_cif: "P 4/m b m",
		symbol_hm_short: "P4/mbm",
		hall_symbol: "-P 4 2ab",
		universal_h_m: "P 4/m b m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x+1/2,-y+1/2,-z",
			"-y+1/2,-x+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"y+1/2,x+1/2,-z",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 128,
		symbol_cif: "P 4/m n c",
		symbol_hm_short: "P4/mnc",
		hall_symbol: "-P 4 2n",
		universal_h_m: "P 4/m n c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"y+1/2,x+1/2,-z+1/2",
			"-x,-y,-z",
			"y,-x,-z",
			"x,y,-z",
			"-y,x,-z",
			"-x+1/2,y+1/2,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 129,
		symbol_cif: "P 4/n m m",
		symbol_hm_short: "P4/nmm",
		hall_symbol: "P 4ab 2ab -1ab",
		universal_h_m: "P 4/n m m:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z",
			"-x,-y,z",
			"y+1/2,-x+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-y,-x,-z",
			"-x+1/2,y+1/2,-z",
			"y,x,-z",
			"-x+1/2,-y+1/2,-z",
			"y,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x,-z",
			"-x,y,z",
			"y+1/2,x+1/2,z",
			"x,-y,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 129,
		symbol_cif: "P 4/n m m",
		symbol_hm_short: "P4/nmm",
		hall_symbol: "-P 4a 2a",
		universal_h_m: "P 4/n m m:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"x+1/2,-y,-z",
			"-y,-x,-z",
			"-x,y+1/2,-z",
			"y+1/2,x+1/2,-z",
			"-x,-y,-z",
			"y+1/2,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z",
			"-x+1/2,y,z",
			"y,x,z",
			"x,-y+1/2,z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 130,
		symbol_cif: "P 4/n c c",
		symbol_hm_short: "P4/ncc",
		hall_symbol: "P 4ab 2n -1ab",
		universal_h_m: "P 4/n c c:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z",
			"-x,-y,z",
			"y+1/2,-x+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-y,-x,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"y,x,-z+1/2",
			"-x+1/2,-y+1/2,-z",
			"y,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x,-z",
			"-x,y,z+1/2",
			"y+1/2,x+1/2,z+1/2",
			"x,-y,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 130,
		symbol_cif: "P 4/n c c",
		symbol_hm_short: "P4/ncc",
		hall_symbol: "-P 4a 2ac",
		universal_h_m: "P 4/n c c:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"x+1/2,-y,-z+1/2",
			"-y,-x,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"y+1/2,x+1/2,-z+1/2",
			"-x,-y,-z",
			"y+1/2,-x,-z",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z",
			"-x+1/2,y,z+1/2",
			"y,x,z+1/2",
			"x,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 131,
		symbol_cif: "P 42/m m c",
		symbol_hm_short: "P42/mmc",
		hall_symbol: "-P 4c 2",
		universal_h_m: "P 42/m m c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"x,-y,-z",
			"-y,-x,-z+1/2",
			"-x,y,-z",
			"y,x,-z+1/2",
			"-x,-y,-z",
			"y,-x,-z+1/2",
			"x,y,-z",
			"-y,x,-z+1/2",
			"-x,y,z",
			"y,x,z+1/2",
			"x,-y,z",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 132,
		symbol_cif: "P 42/m c m",
		symbol_hm_short: "P42/mcm",
		hall_symbol: "-P 4c 2c",
		universal_h_m: "P 42/m c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"x,-y,-z+1/2",
			"-y,-x,-z",
			"-x,y,-z+1/2",
			"y,x,-z",
			"-x,-y,-z",
			"y,-x,-z+1/2",
			"x,y,-z",
			"-y,x,-z+1/2",
			"-x,y,z+1/2",
			"y,x,z",
			"x,-y,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 133,
		symbol_cif: "P 42/n b c",
		symbol_hm_short: "P42/nbc",
		hall_symbol: "P 4n 2c -1n",
		universal_h_m: "P 42/n b c:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x,-y,-z+1/2",
			"-y+1/2,-x+1/2,-z",
			"-x,y,-z+1/2",
			"y+1/2,x+1/2,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"y,-x,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-y,x,-z",
			"-x+1/2,y+1/2,z",
			"y,x,z+1/2",
			"x+1/2,-y+1/2,z",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 133,
		symbol_cif: "P 42/n b c",
		symbol_hm_short: "P42/nbc",
		hall_symbol: "-P 4ac 2b",
		universal_h_m: "P 42/n b c:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z+1/2",
			"x,-y+1/2,-z",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,y,-z",
			"y,x,-z+1/2",
			"-x,-y,-z",
			"y+1/2,-x,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z+1/2",
			"-x,y+1/2,z",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y,z",
			"-y,-x,z+1/2"
		]
	},
	{
		number: 134,
		symbol_cif: "P 42/n n m",
		symbol_hm_short: "P42/nnm",
		hall_symbol: "P 4n 2 -1n",
		universal_h_m: "P 42/n n m:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x,-y,-z",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x,y,-z",
			"y+1/2,x+1/2,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"y,-x,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-y,x,-z",
			"-x+1/2,y+1/2,z+1/2",
			"y,x,z",
			"x+1/2,-y+1/2,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 134,
		symbol_cif: "P 42/n n m",
		symbol_hm_short: "P42/nnm",
		hall_symbol: "-P 4ac 2bc",
		universal_h_m: "P 42/n n m:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z+1/2",
			"x,-y+1/2,-z+1/2",
			"-y+1/2,-x+1/2,-z",
			"-x+1/2,y,-z+1/2",
			"y,x,-z",
			"-x,-y,-z",
			"y+1/2,-x,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z+1/2",
			"-x,y+1/2,z+1/2",
			"y+1/2,x+1/2,z",
			"x+1/2,-y,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 135,
		symbol_cif: "P 42/m b c",
		symbol_hm_short: "P42/mbc",
		hall_symbol: "-P 4c 2ab",
		universal_h_m: "P 42/m b c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z+1/2",
			"-x,-y,z",
			"y,-x,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"y+1/2,x+1/2,-z+1/2",
			"-x,-y,-z",
			"y,-x,-z+1/2",
			"x,y,-z",
			"-y,x,-z+1/2",
			"-x+1/2,y+1/2,z",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,-y+1/2,z",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 136,
		symbol_cif: "P 42/m n m",
		symbol_hm_short: "P42/mnm",
		hall_symbol: "-P 4n 2n",
		universal_h_m: "P 42/m n m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-y,-x,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"y,x,-z",
			"-x,-y,-z",
			"y+1/2,-x+1/2,-z+1/2",
			"x,y,-z",
			"-y+1/2,x+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"y,x,z",
			"x+1/2,-y+1/2,z+1/2",
			"-y,-x,z"
		]
	},
	{
		number: 137,
		symbol_cif: "P 42/n m c",
		symbol_hm_short: "P42/nmc",
		hall_symbol: "P 4n 2n -1n",
		universal_h_m: "P 42/n m c:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-y,-x,-z",
			"-x+1/2,y+1/2,-z+1/2",
			"y,x,-z",
			"-x+1/2,-y+1/2,-z+1/2",
			"y,-x,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-y,x,-z",
			"-x,y,z",
			"y+1/2,x+1/2,z+1/2",
			"x,-y,z",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 137,
		symbol_cif: "P 42/n m c",
		symbol_hm_short: "P42/nmc",
		hall_symbol: "-P 4ac 2a",
		universal_h_m: "P 42/n m c:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z+1/2",
			"x+1/2,-y,-z",
			"-y,-x,-z+1/2",
			"-x,y+1/2,-z",
			"y+1/2,x+1/2,-z+1/2",
			"-x,-y,-z",
			"y+1/2,-x,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z+1/2",
			"-x+1/2,y,z",
			"y,x,z+1/2",
			"x,-y+1/2,z",
			"-y+1/2,-x+1/2,z+1/2"
		]
	},
	{
		number: 138,
		symbol_cif: "P 42/n c m",
		symbol_hm_short: "P42/ncm",
		hall_symbol: "P 4n 2ab -1n",
		universal_h_m: "P 42/n c m:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-y,-x,-z+1/2",
			"-x+1/2,y+1/2,-z",
			"y,x,-z+1/2",
			"-x+1/2,-y+1/2,-z+1/2",
			"y,-x,-z",
			"x+1/2,y+1/2,-z+1/2",
			"-y,x,-z",
			"-x,y,z+1/2",
			"y+1/2,x+1/2,z",
			"x,-y,z+1/2",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 138,
		symbol_cif: "P 42/n c m",
		symbol_hm_short: "P42/ncm",
		hall_symbol: "-P 4ac 2ac",
		universal_h_m: "P 42/n c m:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-y,-x,-z",
			"-x,y+1/2,-z+1/2",
			"y+1/2,x+1/2,-z",
			"-x,-y,-z",
			"y+1/2,-x,-z+1/2",
			"x+1/2,y+1/2,-z",
			"-y,x+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"y,x,z",
			"x,-y+1/2,z+1/2",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 139,
		symbol_cif: "I 4/m m m",
		symbol_hm_short: "I4/mmm",
		hall_symbol: "-I 4 2",
		universal_h_m: "I 4/m m m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z.y,x,z.x,-y,z.-y,-x,z.x+1/2,y+1/2,z+1/2.-y+1/2,x+1/2,z+1/2.-x+1/2,-y+1/2,z+1/2.y+1/2,-x+1/2,z+1/2.x+1/2,-y+1/2,-z+1/2.-y+1/2,-x+1/2,-z+1/2.-x+1/2,y+1/2,-z+1/2.y+1/2,x+1/2,-z+1/2.-x+1/2,-y+1/2,-z+1/2.y+1/2,-x+1/2,-z+1/2.x+1/2,y+1/2,-z+1/2.-y+1/2,x+1/2,-z+1/2.-x+1/2,y+1/2,z+1/2.y+1/2,x+1/2,z+1/2.x+1/2,-y+1/2,z+1/2.-y+1/2,-x+1/2,z+1/2".split(".")
	},
	{
		number: 140,
		symbol_cif: "I 4/m c m",
		symbol_hm_short: "I4/mcm",
		hall_symbol: "-I 4 2c",
		universal_h_m: "I 4/m c m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z+1/2.-y,-x,-z+1/2.-x,y,-z+1/2.y,x,-z+1/2.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z+1/2.y,x,z+1/2.x,-y,z+1/2.-y,-x,z+1/2.x+1/2,y+1/2,z+1/2.-y+1/2,x+1/2,z+1/2.-x+1/2,-y+1/2,z+1/2.y+1/2,-x+1/2,z+1/2.x+1/2,-y+1/2,-z.-y+1/2,-x+1/2,-z.-x+1/2,y+1/2,-z.y+1/2,x+1/2,-z.-x+1/2,-y+1/2,-z+1/2.y+1/2,-x+1/2,-z+1/2.x+1/2,y+1/2,-z+1/2.-y+1/2,x+1/2,-z+1/2.-x+1/2,y+1/2,z.y+1/2,x+1/2,z.x+1/2,-y+1/2,z.-y+1/2,-x+1/2,z".split(".")
	},
	{
		number: 141,
		symbol_cif: "I 41/a m d",
		symbol_hm_short: "I41/amd",
		hall_symbol: "I 4bw 2bw -1bw",
		universal_h_m: "I 41/a m d:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x+1/2,z+1/4.-x+1/2,-y+1/2,z+1/2.y+1/2,-x,z+3/4.x,-y+1/2,-z+1/4.-y,-x,-z.-x+1/2,y,-z+3/4.y+1/2,x+1/2,-z+1/2.-x,-y+1/2,-z+1/4.y,-x,-z.x+1/2,y,-z+3/4.-y+1/2,x+1/2,-z+1/2.-x,y,z.y,x+1/2,z+1/4.x+1/2,-y+1/2,z+1/2.-y+1/2,-x,z+3/4.x+1/2,y+1/2,z+1/2.-y+1/2,x,z+3/4.-x,-y,z.y,-x+1/2,z+1/4.x+1/2,-y,-z+3/4.-y+1/2,-x+1/2,-z+1/2.-x,y+1/2,-z+1/4.y,x,-z.-x+1/2,-y,-z+3/4.y+1/2,-x+1/2,-z+1/2.x,y+1/2,-z+1/4.-y,x,-z.-x+1/2,y+1/2,z+1/2.y+1/2,x,z+3/4.x,-y,z.-y,-x+1/2,z+1/4".split(".")
	},
	{
		number: 141,
		symbol_cif: "I 41/a m d",
		symbol_hm_short: "I41/amd",
		hall_symbol: "-I 4bd 2",
		universal_h_m: "I 41/a m d:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+1/4,z+3/4.x,-y,-z.-y+1/4,-x+1/4,-z+3/4.-x+1/2,y,-z+1/2.y+1/4,x+3/4,-z+1/4.-x,-y,-z.y+3/4,-x+1/4,-z+3/4.x+1/2,y,-z+1/2.-y+3/4,x+3/4,-z+1/4.-x,y,z.y+3/4,x+3/4,z+1/4.x+1/2,-y,z+1/2.-y+3/4,-x+1/4,z+3/4.x+1/2,y+1/2,z+1/2.-y+3/4,x+1/4,z+3/4.-x,-y+1/2,z.y+3/4,-x+3/4,z+1/4.x+1/2,-y+1/2,-z+1/2.-y+3/4,-x+3/4,-z+1/4.-x,y+1/2,-z.y+3/4,x+1/4,-z+3/4.-x+1/2,-y+1/2,-z+1/2.y+1/4,-x+3/4,-z+1/4.x,y+1/2,-z.-y+1/4,x+1/4,-z+3/4.-x+1/2,y+1/2,z+1/2.y+1/4,x+1/4,z+3/4.x,-y+1/2,z.-y+1/4,-x+3/4,z+1/4".split(".")
	},
	{
		number: 142,
		symbol_cif: "I 41/a c d",
		symbol_hm_short: "I41/acd",
		hall_symbol: "I 4bw 2aw -1bw",
		universal_h_m: "I 41/a c d:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x+1/2,z+1/4.-x+1/2,-y+1/2,z+1/2.y+1/2,-x,z+3/4.x+1/2,-y,-z+1/4.-y+1/2,-x+1/2,-z.-x,y+1/2,-z+3/4.y,x,-z+1/2.-x,-y+1/2,-z+1/4.y,-x,-z.x+1/2,y,-z+3/4.-y+1/2,x+1/2,-z+1/2.-x+1/2,y+1/2,z.y+1/2,x,z+1/4.x,-y,z+1/2.-y,-x+1/2,z+3/4.x+1/2,y+1/2,z+1/2.-y+1/2,x,z+3/4.-x,-y,z.y,-x+1/2,z+1/4.x,-y+1/2,-z+3/4.-y,-x,-z+1/2.-x+1/2,y,-z+1/4.y+1/2,x+1/2,-z.-x+1/2,-y,-z+3/4.y+1/2,-x+1/2,-z+1/2.x,y+1/2,-z+1/4.-y,x,-z.-x,y,z+1/2.y,x+1/2,z+3/4.x+1/2,-y+1/2,z.-y+1/2,-x,z+1/4".split(".")
	},
	{
		number: 142,
		symbol_cif: "I 41/a c d",
		symbol_hm_short: "I41/acd",
		hall_symbol: "-I 4bd 2c",
		universal_h_m: "I 41/a c d:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+1/4,z+3/4.x,-y,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x+1/2,y,-z.y+1/4,x+3/4,-z+3/4.-x,-y,-z.y+3/4,-x+1/4,-z+3/4.x+1/2,y,-z+1/2.-y+3/4,x+3/4,-z+1/4.-x,y,z+1/2.y+3/4,x+3/4,z+3/4.x+1/2,-y,z.-y+3/4,-x+1/4,z+1/4.x+1/2,y+1/2,z+1/2.-y+3/4,x+1/4,z+3/4.-x,-y+1/2,z.y+3/4,-x+3/4,z+1/4.x+1/2,-y+1/2,-z.-y+3/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+1/4,-z+1/4.-x+1/2,-y+1/2,-z+1/2.y+1/4,-x+3/4,-z+1/4.x,y+1/2,-z.-y+1/4,x+1/4,-z+3/4.-x+1/2,y+1/2,z.y+1/4,x+1/4,z+1/4.x,-y+1/2,z+1/2.-y+1/4,-x+3/4,z+3/4".split(".")
	},
	{
		number: 143,
		symbol_cif: "P 3",
		symbol_hm_short: "P3",
		hall_symbol: "P 3",
		universal_h_m: "P 3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z"
		]
	},
	{
		number: 144,
		symbol_cif: "P 31",
		symbol_hm_short: "P31",
		hall_symbol: "P 31",
		universal_h_m: "P 31",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+1/3",
			"-x+y,-x,z+2/3"
		]
	},
	{
		number: 145,
		symbol_cif: "P 32",
		symbol_hm_short: "P32",
		hall_symbol: "P 32",
		universal_h_m: "P 32",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+2/3",
			"-x+y,-x,z+1/3"
		]
	},
	{
		number: 146,
		symbol_cif: "R 3",
		symbol_hm_short: "H3",
		hall_symbol: "R 3",
		universal_h_m: "R 3:H",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"x+2/3,y+1/3,z+1/3",
			"-y+2/3,x-y+1/3,z+1/3",
			"-x+y+2/3,-x+1/3,z+1/3",
			"x+1/3,y+2/3,z+2/3",
			"-y+1/3,x-y+2/3,z+2/3",
			"-x+y+1/3,-x+2/3,z+2/3"
		]
	},
	{
		number: 146,
		symbol_cif: "R 3",
		symbol_hm_short: "R3",
		hall_symbol: "P 3*",
		universal_h_m: "R 3:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x"
		]
	},
	{
		number: 147,
		symbol_cif: "P -3",
		symbol_hm_short: "P-3",
		hall_symbol: "-P 3",
		universal_h_m: "P -3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z"
		]
	},
	{
		number: 148,
		symbol_cif: "R -3",
		symbol_hm_short: "H-3",
		hall_symbol: "-R 3",
		universal_h_m: "R -3:H",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z",
			"x+2/3,y+1/3,z+1/3",
			"-y+2/3,x-y+1/3,z+1/3",
			"-x+y+2/3,-x+1/3,z+1/3",
			"-x+2/3,-y+1/3,-z+1/3",
			"y+2/3,-x+y+1/3,-z+1/3",
			"x-y+2/3,x+1/3,-z+1/3",
			"x+1/3,y+2/3,z+2/3",
			"-y+1/3,x-y+2/3,z+2/3",
			"-x+y+1/3,-x+2/3,z+2/3",
			"-x+1/3,-y+2/3,-z+2/3",
			"y+1/3,-x+y+2/3,-z+2/3",
			"x-y+1/3,x+2/3,-z+2/3"
		]
	},
	{
		number: 148,
		symbol_cif: "R -3",
		symbol_hm_short: "R-3",
		hall_symbol: "-P 3*",
		universal_h_m: "R -3:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"-x,-y,-z",
			"-z,-x,-y",
			"-y,-z,-x"
		]
	},
	{
		number: 149,
		symbol_cif: "P 3 1 2",
		symbol_hm_short: "P312",
		hall_symbol: "P 3 2",
		universal_h_m: "P 3 1 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,-z",
			"-x+y,y,-z",
			"x,x-y,-z"
		]
	},
	{
		number: 150,
		symbol_cif: "P 3 2 1",
		symbol_hm_short: "P321",
		hall_symbol: "P 3 2\"",
		universal_h_m: "P 3 2 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,-z",
			"x-y,-y,-z",
			"-x,-x+y,-z"
		]
	},
	{
		number: 151,
		symbol_cif: "P 31 1 2",
		symbol_hm_short: "P3112",
		hall_symbol: "P 31 2 (0 0 4)",
		universal_h_m: "P 31 1 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+1/3",
			"-x+y,-x,z+2/3",
			"-y,-x,-z+2/3",
			"-x+y,y,-z+1/3",
			"x,x-y,-z"
		]
	},
	{
		number: 152,
		symbol_cif: "P 31 2 1",
		symbol_hm_short: "P3121",
		hall_symbol: "P 31 2\"",
		universal_h_m: "P 31 2 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+1/3",
			"-x+y,-x,z+2/3",
			"y,x,-z",
			"x-y,-y,-z+2/3",
			"-x,-x+y,-z+1/3"
		]
	},
	{
		number: 153,
		symbol_cif: "P 32 1 2",
		symbol_hm_short: "P3212",
		hall_symbol: "P 32 2 (0 0 2)",
		universal_h_m: "P 32 1 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+2/3",
			"-x+y,-x,z+1/3",
			"-y,-x,-z+1/3",
			"-x+y,y,-z+2/3",
			"x,x-y,-z"
		]
	},
	{
		number: 154,
		symbol_cif: "P 32 2 1",
		symbol_hm_short: "P3221",
		hall_symbol: "P 32 2\"",
		universal_h_m: "P 32 2 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z+2/3",
			"-x+y,-x,z+1/3",
			"y,x,-z",
			"x-y,-y,-z+1/3",
			"-x,-x+y,-z+2/3"
		]
	},
	{
		number: 155,
		symbol_cif: "R 3 2",
		symbol_hm_short: "H32",
		hall_symbol: "R 3 2\"",
		universal_h_m: "R 3 2:H",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,-z",
			"x-y,-y,-z",
			"-x,-x+y,-z",
			"x+2/3,y+1/3,z+1/3",
			"-y+2/3,x-y+1/3,z+1/3",
			"-x+y+2/3,-x+1/3,z+1/3",
			"y+2/3,x+1/3,-z+1/3",
			"x-y+2/3,-y+1/3,-z+1/3",
			"-x+2/3,-x+y+1/3,-z+1/3",
			"x+1/3,y+2/3,z+2/3",
			"-y+1/3,x-y+2/3,z+2/3",
			"-x+y+1/3,-x+2/3,z+2/3",
			"y+1/3,x+2/3,-z+2/3",
			"x-y+1/3,-y+2/3,-z+2/3",
			"-x+1/3,-x+y+2/3,-z+2/3"
		]
	},
	{
		number: 155,
		symbol_cif: "R 3 2",
		symbol_hm_short: "R32",
		hall_symbol: "P 3* 2",
		universal_h_m: "R 3 2:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"-y,-x,-z",
			"-x,-z,-y",
			"-z,-y,-x"
		]
	},
	{
		number: 156,
		symbol_cif: "P 3 m 1",
		symbol_hm_short: "P3m1",
		hall_symbol: "P 3 -2\"",
		universal_h_m: "P 3 m 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,z",
			"-x+y,y,z",
			"x,x-y,z"
		]
	},
	{
		number: 157,
		symbol_cif: "P 3 1 m",
		symbol_hm_short: "P31m",
		hall_symbol: "P 3 -2",
		universal_h_m: "P 3 1 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,z",
			"x-y,-y,z",
			"-x,-x+y,z"
		]
	},
	{
		number: 158,
		symbol_cif: "P 3 c 1",
		symbol_hm_short: "P3c1",
		hall_symbol: "P 3 -2\"c",
		universal_h_m: "P 3 c 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,z+1/2",
			"-x+y,y,z+1/2",
			"x,x-y,z+1/2"
		]
	},
	{
		number: 159,
		symbol_cif: "P 3 1 c",
		symbol_hm_short: "P31c",
		hall_symbol: "P 3 -2c",
		universal_h_m: "P 3 1 c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,z+1/2",
			"x-y,-y,z+1/2",
			"-x,-x+y,z+1/2"
		]
	},
	{
		number: 160,
		symbol_cif: "R 3 m",
		symbol_hm_short: "H3m",
		hall_symbol: "R 3 -2\"",
		universal_h_m: "R 3 m:H",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,z",
			"-x+y,y,z",
			"x,x-y,z",
			"x+2/3,y+1/3,z+1/3",
			"-y+2/3,x-y+1/3,z+1/3",
			"-x+y+2/3,-x+1/3,z+1/3",
			"-y+2/3,-x+1/3,z+1/3",
			"-x+y+2/3,y+1/3,z+1/3",
			"x+2/3,x-y+1/3,z+1/3",
			"x+1/3,y+2/3,z+2/3",
			"-y+1/3,x-y+2/3,z+2/3",
			"-x+y+1/3,-x+2/3,z+2/3",
			"-y+1/3,-x+2/3,z+2/3",
			"-x+y+1/3,y+2/3,z+2/3",
			"x+1/3,x-y+2/3,z+2/3"
		]
	},
	{
		number: 160,
		symbol_cif: "R 3 m",
		symbol_hm_short: "R3m",
		hall_symbol: "P 3* -2",
		universal_h_m: "R 3 m:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"y,x,z",
			"x,z,y",
			"z,y,x"
		]
	},
	{
		number: 161,
		symbol_cif: "R 3 c",
		symbol_hm_short: "H3c",
		hall_symbol: "R 3 -2\"c",
		universal_h_m: "R 3 c:H",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,z+1/2",
			"-x+y,y,z+1/2",
			"x,x-y,z+1/2",
			"x+2/3,y+1/3,z+1/3",
			"-y+2/3,x-y+1/3,z+1/3",
			"-x+y+2/3,-x+1/3,z+1/3",
			"-y+2/3,-x+1/3,z+5/6",
			"-x+y+2/3,y+1/3,z+5/6",
			"x+2/3,x-y+1/3,z+5/6",
			"x+1/3,y+2/3,z+2/3",
			"-y+1/3,x-y+2/3,z+2/3",
			"-x+y+1/3,-x+2/3,z+2/3",
			"-y+1/3,-x+2/3,z+1/6",
			"-x+y+1/3,y+2/3,z+1/6",
			"x+1/3,x-y+2/3,z+1/6"
		]
	},
	{
		number: 161,
		symbol_cif: "R 3 c",
		symbol_hm_short: "R3c",
		hall_symbol: "P 3* -2n",
		universal_h_m: "R 3 c:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,z+1/2,y+1/2",
			"z+1/2,y+1/2,x+1/2"
		]
	},
	{
		number: 162,
		symbol_cif: "P -3 1 m",
		symbol_hm_short: "P-31m",
		hall_symbol: "-P 3 2",
		universal_h_m: "P -3 1 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,-z",
			"-x+y,y,-z",
			"x,x-y,-z",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z",
			"y,x,z",
			"x-y,-y,z",
			"-x,-x+y,z"
		]
	},
	{
		number: 163,
		symbol_cif: "P -3 1 c",
		symbol_hm_short: "P-31c",
		hall_symbol: "-P 3 2c",
		universal_h_m: "P -3 1 c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"-y,-x,-z+1/2",
			"-x+y,y,-z+1/2",
			"x,x-y,-z+1/2",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z",
			"y,x,z+1/2",
			"x-y,-y,z+1/2",
			"-x,-x+y,z+1/2"
		]
	},
	{
		number: 164,
		symbol_cif: "P -3 m 1",
		symbol_hm_short: "P-3m1",
		hall_symbol: "-P 3 2\"",
		universal_h_m: "P -3 m 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,-z",
			"x-y,-y,-z",
			"-x,-x+y,-z",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z",
			"-y,-x,z",
			"-x+y,y,z",
			"x,x-y,z"
		]
	},
	{
		number: 165,
		symbol_cif: "P -3 c 1",
		symbol_hm_short: "P-3c1",
		hall_symbol: "-P 3 2\"c",
		universal_h_m: "P -3 c 1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x-y,z",
			"-x+y,-x,z",
			"y,x,-z+1/2",
			"x-y,-y,-z+1/2",
			"-x,-x+y,-z+1/2",
			"-x,-y,-z",
			"y,-x+y,-z",
			"x-y,x,-z",
			"-y,-x,z+1/2",
			"-x+y,y,z+1/2",
			"x,x-y,z+1/2"
		]
	},
	{
		number: 166,
		symbol_cif: "R -3 m",
		symbol_hm_short: "H-3m",
		hall_symbol: "-R 3 2\"",
		universal_h_m: "R -3 m:H",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x-y,z.-x+y,-x,z.y,x,-z.x-y,-y,-z.-x,-x+y,-z.-x,-y,-z.y,-x+y,-z.x-y,x,-z.-y,-x,z.-x+y,y,z.x,x-y,z.x+2/3,y+1/3,z+1/3.-y+2/3,x-y+1/3,z+1/3.-x+y+2/3,-x+1/3,z+1/3.y+2/3,x+1/3,-z+1/3.x-y+2/3,-y+1/3,-z+1/3.-x+2/3,-x+y+1/3,-z+1/3.-x+2/3,-y+1/3,-z+1/3.y+2/3,-x+y+1/3,-z+1/3.x-y+2/3,x+1/3,-z+1/3.-y+2/3,-x+1/3,z+1/3.-x+y+2/3,y+1/3,z+1/3.x+2/3,x-y+1/3,z+1/3.x+1/3,y+2/3,z+2/3.-y+1/3,x-y+2/3,z+2/3.-x+y+1/3,-x+2/3,z+2/3.y+1/3,x+2/3,-z+2/3.x-y+1/3,-y+2/3,-z+2/3.-x+1/3,-x+y+2/3,-z+2/3.-x+1/3,-y+2/3,-z+2/3.y+1/3,-x+y+2/3,-z+2/3.x-y+1/3,x+2/3,-z+2/3.-y+1/3,-x+2/3,z+2/3.-x+y+1/3,y+2/3,z+2/3.x+1/3,x-y+2/3,z+2/3".split(".")
	},
	{
		number: 166,
		symbol_cif: "R -3 m",
		symbol_hm_short: "R-3m",
		hall_symbol: "-P 3* 2",
		universal_h_m: "R -3 m:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"-y,-x,-z",
			"-x,-z,-y",
			"-z,-y,-x",
			"-x,-y,-z",
			"-z,-x,-y",
			"-y,-z,-x",
			"y,x,z",
			"x,z,y",
			"z,y,x"
		]
	},
	{
		number: 167,
		symbol_cif: "R -3 c",
		symbol_hm_short: "H-3c",
		hall_symbol: "-R 3 2\"c",
		universal_h_m: "R -3 c:H",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x-y,z.-x+y,-x,z.y,x,-z+1/2.x-y,-y,-z+1/2.-x,-x+y,-z+1/2.-x,-y,-z.y,-x+y,-z.x-y,x,-z.-y,-x,z+1/2.-x+y,y,z+1/2.x,x-y,z+1/2.x+2/3,y+1/3,z+1/3.-y+2/3,x-y+1/3,z+1/3.-x+y+2/3,-x+1/3,z+1/3.y+2/3,x+1/3,-z+5/6.x-y+2/3,-y+1/3,-z+5/6.-x+2/3,-x+y+1/3,-z+5/6.-x+2/3,-y+1/3,-z+1/3.y+2/3,-x+y+1/3,-z+1/3.x-y+2/3,x+1/3,-z+1/3.-y+2/3,-x+1/3,z+5/6.-x+y+2/3,y+1/3,z+5/6.x+2/3,x-y+1/3,z+5/6.x+1/3,y+2/3,z+2/3.-y+1/3,x-y+2/3,z+2/3.-x+y+1/3,-x+2/3,z+2/3.y+1/3,x+2/3,-z+1/6.x-y+1/3,-y+2/3,-z+1/6.-x+1/3,-x+y+2/3,-z+1/6.-x+1/3,-y+2/3,-z+2/3.y+1/3,-x+y+2/3,-z+2/3.x-y+1/3,x+2/3,-z+2/3.-y+1/3,-x+2/3,z+1/6.-x+y+1/3,y+2/3,z+1/6.x+1/3,x-y+2/3,z+1/6".split(".")
	},
	{
		number: 167,
		symbol_cif: "R -3 c",
		symbol_hm_short: "R-3c",
		hall_symbol: "-P 3* 2n",
		universal_h_m: "R -3 c:R",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"z,x,y",
			"y,z,x",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x+1/2,-z+1/2,-y+1/2",
			"-z+1/2,-y+1/2,-x+1/2",
			"-x,-y,-z",
			"-z,-x,-y",
			"-y,-z,-x",
			"y+1/2,x+1/2,z+1/2",
			"x+1/2,z+1/2,y+1/2",
			"z+1/2,y+1/2,x+1/2"
		]
	},
	{
		number: 168,
		symbol_cif: "P 6",
		symbol_hm_short: "P6",
		hall_symbol: "P 6",
		universal_h_m: "P 6",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z"
		]
	},
	{
		number: 169,
		symbol_cif: "P 61",
		symbol_hm_short: "P61",
		hall_symbol: "P 61",
		universal_h_m: "P 61",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/6",
			"-y,x-y,z+1/3",
			"-x,-y,z+1/2",
			"-x+y,-x,z+2/3",
			"y,-x+y,z+5/6"
		]
	},
	{
		number: 170,
		symbol_cif: "P 65",
		symbol_hm_short: "P65",
		hall_symbol: "P 65",
		universal_h_m: "P 65",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+5/6",
			"-y,x-y,z+2/3",
			"-x,-y,z+1/2",
			"-x+y,-x,z+1/3",
			"y,-x+y,z+1/6"
		]
	},
	{
		number: 171,
		symbol_cif: "P 62",
		symbol_hm_short: "P62",
		hall_symbol: "P 62",
		universal_h_m: "P 62",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/3",
			"-y,x-y,z+2/3",
			"-x,-y,z",
			"-x+y,-x,z+1/3",
			"y,-x+y,z+2/3"
		]
	},
	{
		number: 172,
		symbol_cif: "P 64",
		symbol_hm_short: "P64",
		hall_symbol: "P 64",
		universal_h_m: "P 64",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+2/3",
			"-y,x-y,z+1/3",
			"-x,-y,z",
			"-x+y,-x,z+2/3",
			"y,-x+y,z+1/3"
		]
	},
	{
		number: 173,
		symbol_cif: "P 63",
		symbol_hm_short: "P63",
		hall_symbol: "P 6c",
		universal_h_m: "P 63",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2"
		]
	},
	{
		number: 174,
		symbol_cif: "P -6",
		symbol_hm_short: "P-6",
		hall_symbol: "P -6",
		universal_h_m: "P -6",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+y,-x,-z",
			"-y,x-y,z",
			"x,y,-z",
			"-x+y,-x,z",
			"-y,x-y,-z"
		]
	},
	{
		number: 175,
		symbol_cif: "P 6/m",
		symbol_hm_short: "P6/m",
		hall_symbol: "-P 6",
		universal_h_m: "P 6/m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"-x,-y,-z",
			"-x+y,-x,-z",
			"y,-x+y,-z",
			"x,y,-z",
			"x-y,x,-z",
			"-y,x-y,-z"
		]
	},
	{
		number: 176,
		symbol_cif: "P 63/m",
		symbol_hm_short: "P63/m",
		hall_symbol: "-P 6c",
		universal_h_m: "P 63/m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"-x,-y,-z",
			"-x+y,-x,-z+1/2",
			"y,-x+y,-z",
			"x,y,-z+1/2",
			"x-y,x,-z",
			"-y,x-y,-z+1/2"
		]
	},
	{
		number: 177,
		symbol_cif: "P 6 2 2",
		symbol_hm_short: "P622",
		hall_symbol: "P 6 2",
		universal_h_m: "P 6 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"-y,-x,-z",
			"-x,-x+y,-z",
			"-x+y,y,-z",
			"y,x,-z",
			"x,x-y,-z",
			"x-y,-y,-z"
		]
	},
	{
		number: 178,
		symbol_cif: "P 61 2 2",
		symbol_hm_short: "P6122",
		hall_symbol: "P 61 2 (0 0 5)",
		universal_h_m: "P 61 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/6",
			"-y,x-y,z+1/3",
			"-x,-y,z+1/2",
			"-x+y,-x,z+2/3",
			"y,-x+y,z+5/6",
			"-y,-x,-z+5/6",
			"-x,-x+y,-z+2/3",
			"-x+y,y,-z+1/2",
			"y,x,-z+1/3",
			"x,x-y,-z+1/6",
			"x-y,-y,-z"
		]
	},
	{
		number: 179,
		symbol_cif: "P 65 2 2",
		symbol_hm_short: "P6522",
		hall_symbol: "P 65 2 (0 0 1)",
		universal_h_m: "P 65 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+5/6",
			"-y,x-y,z+2/3",
			"-x,-y,z+1/2",
			"-x+y,-x,z+1/3",
			"y,-x+y,z+1/6",
			"-y,-x,-z+1/6",
			"-x,-x+y,-z+1/3",
			"-x+y,y,-z+1/2",
			"y,x,-z+2/3",
			"x,x-y,-z+5/6",
			"x-y,-y,-z"
		]
	},
	{
		number: 180,
		symbol_cif: "P 62 2 2",
		symbol_hm_short: "P6222",
		hall_symbol: "P 62 2 (0 0 4)",
		universal_h_m: "P 62 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/3",
			"-y,x-y,z+2/3",
			"-x,-y,z",
			"-x+y,-x,z+1/3",
			"y,-x+y,z+2/3",
			"-y,-x,-z+2/3",
			"-x,-x+y,-z+1/3",
			"-x+y,y,-z",
			"y,x,-z+2/3",
			"x,x-y,-z+1/3",
			"x-y,-y,-z"
		]
	},
	{
		number: 181,
		symbol_cif: "P 64 2 2",
		symbol_hm_short: "P6422",
		hall_symbol: "P 64 2 (0 0 2)",
		universal_h_m: "P 64 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+2/3",
			"-y,x-y,z+1/3",
			"-x,-y,z",
			"-x+y,-x,z+2/3",
			"y,-x+y,z+1/3",
			"-y,-x,-z+1/3",
			"-x,-x+y,-z+2/3",
			"-x+y,y,-z",
			"y,x,-z+1/3",
			"x,x-y,-z+2/3",
			"x-y,-y,-z"
		]
	},
	{
		number: 182,
		symbol_cif: "P 63 2 2",
		symbol_hm_short: "P6322",
		hall_symbol: "P 6c 2c",
		universal_h_m: "P 63 2 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"-y,-x,-z+1/2",
			"-x,-x+y,-z",
			"-x+y,y,-z+1/2",
			"y,x,-z",
			"x,x-y,-z+1/2",
			"x-y,-y,-z"
		]
	},
	{
		number: 183,
		symbol_cif: "P 6 m m",
		symbol_hm_short: "P6mm",
		hall_symbol: "P 6 -2",
		universal_h_m: "P 6 m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"y,x,z",
			"x,x-y,z",
			"x-y,-y,z",
			"-y,-x,z",
			"-x,-x+y,z",
			"-x+y,y,z"
		]
	},
	{
		number: 184,
		symbol_cif: "P 6 c c",
		symbol_hm_short: "P6cc",
		hall_symbol: "P 6 -2c",
		universal_h_m: "P 6 c c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"y,x,z+1/2",
			"x,x-y,z+1/2",
			"x-y,-y,z+1/2",
			"-y,-x,z+1/2",
			"-x,-x+y,z+1/2",
			"-x+y,y,z+1/2"
		]
	},
	{
		number: 185,
		symbol_cif: "P 63 c m",
		symbol_hm_short: "P63cm",
		hall_symbol: "P 6c -2",
		universal_h_m: "P 63 c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"y,x,z",
			"x,x-y,z+1/2",
			"x-y,-y,z",
			"-y,-x,z+1/2",
			"-x,-x+y,z",
			"-x+y,y,z+1/2"
		]
	},
	{
		number: 186,
		symbol_cif: "P 63 m c",
		symbol_hm_short: "P63mc",
		hall_symbol: "P 6c -2c",
		universal_h_m: "P 63 m c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"y,x,z+1/2",
			"x,x-y,z",
			"x-y,-y,z+1/2",
			"-y,-x,z",
			"-x,-x+y,z+1/2",
			"-x+y,y,z"
		]
	},
	{
		number: 187,
		symbol_cif: "P -6 m 2",
		symbol_hm_short: "P-6m2",
		hall_symbol: "P -6 2",
		universal_h_m: "P -6 m 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+y,-x,-z",
			"-y,x-y,z",
			"x,y,-z",
			"-x+y,-x,z",
			"-y,x-y,-z",
			"-y,-x,-z",
			"x,x-y,z",
			"-x+y,y,-z",
			"-y,-x,z",
			"x,x-y,-z",
			"-x+y,y,z"
		]
	},
	{
		number: 188,
		symbol_cif: "P -6 c 2",
		symbol_hm_short: "P-6c2",
		hall_symbol: "P -6c 2",
		universal_h_m: "P -6 c 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+y,-x,-z+1/2",
			"-y,x-y,z",
			"x,y,-z+1/2",
			"-x+y,-x,z",
			"-y,x-y,-z+1/2",
			"-y,-x,-z",
			"x,x-y,z+1/2",
			"-x+y,y,-z",
			"-y,-x,z+1/2",
			"x,x-y,-z",
			"-x+y,y,z+1/2"
		]
	},
	{
		number: 189,
		symbol_cif: "P -6 2 m",
		symbol_hm_short: "P-62m",
		hall_symbol: "P -6 -2",
		universal_h_m: "P -6 2 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+y,-x,-z",
			"-y,x-y,z",
			"x,y,-z",
			"-x+y,-x,z",
			"-y,x-y,-z",
			"y,x,z",
			"-x,-x+y,-z",
			"x-y,-y,z",
			"y,x,-z",
			"-x,-x+y,z",
			"x-y,-y,-z"
		]
	},
	{
		number: 190,
		symbol_cif: "P -6 2 c",
		symbol_hm_short: "P-62c",
		hall_symbol: "P -6c -2c",
		universal_h_m: "P -6 2 c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+y,-x,-z+1/2",
			"-y,x-y,z",
			"x,y,-z+1/2",
			"-x+y,-x,z",
			"-y,x-y,-z+1/2",
			"y,x,z+1/2",
			"-x,-x+y,-z",
			"x-y,-y,z+1/2",
			"y,x,-z",
			"-x,-x+y,z+1/2",
			"x-y,-y,-z"
		]
	},
	{
		number: 191,
		symbol_cif: "P 6/m m m",
		symbol_hm_short: "P6/mmm",
		hall_symbol: "-P 6 2",
		universal_h_m: "P 6/m m m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"-y,-x,-z",
			"-x,-x+y,-z",
			"-x+y,y,-z",
			"y,x,-z",
			"x,x-y,-z",
			"x-y,-y,-z",
			"-x,-y,-z",
			"-x+y,-x,-z",
			"y,-x+y,-z",
			"x,y,-z",
			"x-y,x,-z",
			"-y,x-y,-z",
			"y,x,z",
			"x,x-y,z",
			"x-y,-y,z",
			"-y,-x,z",
			"-x,-x+y,z",
			"-x+y,y,z"
		]
	},
	{
		number: 192,
		symbol_cif: "P 6/m c c",
		symbol_hm_short: "P6/mcc",
		hall_symbol: "-P 6 2c",
		universal_h_m: "P 6/m c c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z",
			"-y,x-y,z",
			"-x,-y,z",
			"-x+y,-x,z",
			"y,-x+y,z",
			"-y,-x,-z+1/2",
			"-x,-x+y,-z+1/2",
			"-x+y,y,-z+1/2",
			"y,x,-z+1/2",
			"x,x-y,-z+1/2",
			"x-y,-y,-z+1/2",
			"-x,-y,-z",
			"-x+y,-x,-z",
			"y,-x+y,-z",
			"x,y,-z",
			"x-y,x,-z",
			"-y,x-y,-z",
			"y,x,z+1/2",
			"x,x-y,z+1/2",
			"x-y,-y,z+1/2",
			"-y,-x,z+1/2",
			"-x,-x+y,z+1/2",
			"-x+y,y,z+1/2"
		]
	},
	{
		number: 193,
		symbol_cif: "P 63/m c m",
		symbol_hm_short: "P63/mcm",
		hall_symbol: "-P 6c 2",
		universal_h_m: "P 63/m c m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"-y,-x,-z",
			"-x,-x+y,-z+1/2",
			"-x+y,y,-z",
			"y,x,-z+1/2",
			"x,x-y,-z",
			"x-y,-y,-z+1/2",
			"-x,-y,-z",
			"-x+y,-x,-z+1/2",
			"y,-x+y,-z",
			"x,y,-z+1/2",
			"x-y,x,-z",
			"-y,x-y,-z+1/2",
			"y,x,z",
			"x,x-y,z+1/2",
			"x-y,-y,z",
			"-y,-x,z+1/2",
			"-x,-x+y,z",
			"-x+y,y,z+1/2"
		]
	},
	{
		number: 194,
		symbol_cif: "P 63/m m c",
		symbol_hm_short: "P63/mmc",
		hall_symbol: "-P 6c 2c",
		universal_h_m: "P 63/m m c",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"x-y,x,z+1/2",
			"-y,x-y,z",
			"-x,-y,z+1/2",
			"-x+y,-x,z",
			"y,-x+y,z+1/2",
			"-y,-x,-z+1/2",
			"-x,-x+y,-z",
			"-x+y,y,-z+1/2",
			"y,x,-z",
			"x,x-y,-z+1/2",
			"x-y,-y,-z",
			"-x,-y,-z",
			"-x+y,-x,-z+1/2",
			"y,-x+y,-z",
			"x,y,-z+1/2",
			"x-y,x,-z",
			"-y,x-y,-z+1/2",
			"y,x,z+1/2",
			"x,x-y,z",
			"x-y,-y,z+1/2",
			"-y,-x,z",
			"-x,-x+y,z+1/2",
			"-x+y,y,z"
		]
	},
	{
		number: 195,
		symbol_cif: "P 2 3",
		symbol_hm_short: "P23",
		hall_symbol: "P 2 2 3",
		universal_h_m: "P 2 3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"z,x,y",
			"z,-x,-y",
			"-z,x,-y",
			"-z,-x,y",
			"y,z,x",
			"-y,z,-x",
			"-y,-z,x",
			"y,-z,-x"
		]
	},
	{
		number: 196,
		symbol_cif: "F 2 3",
		symbol_hm_short: "F23",
		hall_symbol: "F 2 2 3",
		universal_h_m: "F 2 3",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.z,x,y.z,-x,-y.-z,x,-y.-z,-x,y.y,z,x.-y,z,-x.-y,-z,x.y,-z,-x.x,y+1/2,z+1/2.-x,-y+1/2,z+1/2.x,-y+1/2,-z+1/2.-x,y+1/2,-z+1/2.z,x+1/2,y+1/2.z,-x+1/2,-y+1/2.-z,x+1/2,-y+1/2.-z,-x+1/2,y+1/2.y,z+1/2,x+1/2.-y,z+1/2,-x+1/2.-y,-z+1/2,x+1/2.y,-z+1/2,-x+1/2.x+1/2,y,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y,-z+1/2.-x+1/2,y,-z+1/2.z+1/2,x,y+1/2.z+1/2,-x,-y+1/2.-z+1/2,x,-y+1/2.-z+1/2,-x,y+1/2.y+1/2,z,x+1/2.-y+1/2,z,-x+1/2.-y+1/2,-z,x+1/2.y+1/2,-z,-x+1/2.x+1/2,y+1/2,z.-x+1/2,-y+1/2,z.x+1/2,-y+1/2,-z.-x+1/2,y+1/2,-z.z+1/2,x+1/2,y.z+1/2,-x+1/2,-y.-z+1/2,x+1/2,-y.-z+1/2,-x+1/2,y.y+1/2,z+1/2,x.-y+1/2,z+1/2,-x.-y+1/2,-z+1/2,x.y+1/2,-z+1/2,-x".split(".")
	},
	{
		number: 197,
		symbol_cif: "I 2 3",
		symbol_hm_short: "I23",
		hall_symbol: "I 2 2 3",
		universal_h_m: "I 2 3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"z,x,y",
			"z,-x,-y",
			"-z,x,-y",
			"-z,-x,y",
			"y,z,x",
			"-y,z,-x",
			"-y,-z,x",
			"y,-z,-x",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2",
			"z+1/2,x+1/2,y+1/2",
			"z+1/2,-x+1/2,-y+1/2",
			"-z+1/2,x+1/2,-y+1/2",
			"-z+1/2,-x+1/2,y+1/2",
			"y+1/2,z+1/2,x+1/2",
			"-y+1/2,z+1/2,-x+1/2",
			"-y+1/2,-z+1/2,x+1/2",
			"y+1/2,-z+1/2,-x+1/2"
		]
	},
	{
		number: 198,
		symbol_cif: "P 21 3",
		symbol_hm_short: "P213",
		hall_symbol: "P 2ac 2ab 3",
		universal_h_m: "P 21 3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2",
			"z,x,y",
			"z+1/2,-x+1/2,-y",
			"-z,x+1/2,-y+1/2",
			"-z+1/2,-x,y+1/2",
			"y,z,x",
			"-y,z+1/2,-x+1/2",
			"-y+1/2,-z,x+1/2",
			"y+1/2,-z+1/2,-x"
		]
	},
	{
		number: 199,
		symbol_cif: "I 21 3",
		symbol_hm_short: "I213",
		hall_symbol: "I 2b 2c 3",
		universal_h_m: "I 21 3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y+1/2,z",
			"x,-y,-z+1/2",
			"-x,y+1/2,-z+1/2",
			"z,x,y",
			"z,-x,-y+1/2",
			"-z+1/2,x,-y",
			"-z+1/2,-x,y+1/2",
			"y,z,x",
			"-y+1/2,z,-x",
			"-y,-z+1/2,x",
			"y+1/2,-z+1/2,-x",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y,-z",
			"z+1/2,x+1/2,y+1/2",
			"z+1/2,-x+1/2,-y",
			"-z,x+1/2,-y+1/2",
			"-z,-x+1/2,y",
			"y+1/2,z+1/2,x+1/2",
			"-y,z+1/2,-x+1/2",
			"-y+1/2,-z,x+1/2",
			"y,-z,-x+1/2"
		]
	},
	{
		number: 200,
		symbol_cif: "P m -3",
		symbol_hm_short: "Pm-3",
		hall_symbol: "-P 2 2 3",
		universal_h_m: "P m -3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"z,x,y",
			"z,-x,-y",
			"-z,x,-y",
			"-z,-x,y",
			"y,z,x",
			"-y,z,-x",
			"-y,-z,x",
			"y,-z,-x",
			"-x,-y,-z",
			"x,y,-z",
			"-x,y,z",
			"x,-y,z",
			"-z,-x,-y",
			"-z,x,y",
			"z,-x,y",
			"z,x,-y",
			"-y,-z,-x",
			"y,-z,x",
			"y,z,-x",
			"-y,z,x"
		]
	},
	{
		number: 201,
		symbol_cif: "P n -3",
		symbol_hm_short: "Pn-3",
		hall_symbol: "P 2 2 3 -1n",
		universal_h_m: "P n -3:1",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z",
			"-x,y,-z",
			"z,x,y",
			"z,-x,-y",
			"-z,x,-y",
			"-z,-x,y",
			"y,z,x",
			"-y,z,-x",
			"-y,-z,x",
			"y,-z,-x",
			"-x+1/2,-y+1/2,-z+1/2",
			"x+1/2,y+1/2,-z+1/2",
			"-x+1/2,y+1/2,z+1/2",
			"x+1/2,-y+1/2,z+1/2",
			"-z+1/2,-x+1/2,-y+1/2",
			"-z+1/2,x+1/2,y+1/2",
			"z+1/2,-x+1/2,y+1/2",
			"z+1/2,x+1/2,-y+1/2",
			"-y+1/2,-z+1/2,-x+1/2",
			"y+1/2,-z+1/2,x+1/2",
			"y+1/2,z+1/2,-x+1/2",
			"-y+1/2,z+1/2,x+1/2"
		]
	},
	{
		number: 201,
		symbol_cif: "P n -3",
		symbol_hm_short: "Pn-3",
		hall_symbol: "-P 2ab 2bc 3",
		universal_h_m: "P n -3:2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"z,x,y",
			"z,-x+1/2,-y+1/2",
			"-z+1/2,x,-y+1/2",
			"-z+1/2,-x+1/2,y",
			"y,z,x",
			"-y+1/2,z,-x+1/2",
			"-y+1/2,-z+1/2,x",
			"y,-z+1/2,-x+1/2",
			"-x,-y,-z",
			"x+1/2,y+1/2,-z",
			"-x,y+1/2,z+1/2",
			"x+1/2,-y,z+1/2",
			"-z,-x,-y",
			"-z,x+1/2,y+1/2",
			"z+1/2,-x,y+1/2",
			"z+1/2,x+1/2,-y",
			"-y,-z,-x",
			"y+1/2,-z,x+1/2",
			"y+1/2,z+1/2,-x",
			"-y,z+1/2,x+1/2"
		]
	},
	{
		number: 202,
		symbol_cif: "F m -3",
		symbol_hm_short: "Fm-3",
		hall_symbol: "-F 2 2 3",
		universal_h_m: "F m -3",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.z,x,y.z,-x,-y.-z,x,-y.-z,-x,y.y,z,x.-y,z,-x.-y,-z,x.y,-z,-x.-x,-y,-z.x,y,-z.-x,y,z.x,-y,z.-z,-x,-y.-z,x,y.z,-x,y.z,x,-y.-y,-z,-x.y,-z,x.y,z,-x.-y,z,x.x,y+1/2,z+1/2.-x,-y+1/2,z+1/2.x,-y+1/2,-z+1/2.-x,y+1/2,-z+1/2.z,x+1/2,y+1/2.z,-x+1/2,-y+1/2.-z,x+1/2,-y+1/2.-z,-x+1/2,y+1/2.y,z+1/2,x+1/2.-y,z+1/2,-x+1/2.-y,-z+1/2,x+1/2.y,-z+1/2,-x+1/2.-x,-y+1/2,-z+1/2.x,y+1/2,-z+1/2.-x,y+1/2,z+1/2.x,-y+1/2,z+1/2.-z,-x+1/2,-y+1/2.-z,x+1/2,y+1/2.z,-x+1/2,y+1/2.z,x+1/2,-y+1/2.-y,-z+1/2,-x+1/2.y,-z+1/2,x+1/2.y,z+1/2,-x+1/2.-y,z+1/2,x+1/2.x+1/2,y,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y,-z+1/2.-x+1/2,y,-z+1/2.z+1/2,x,y+1/2.z+1/2,-x,-y+1/2.-z+1/2,x,-y+1/2.-z+1/2,-x,y+1/2.y+1/2,z,x+1/2.-y+1/2,z,-x+1/2.-y+1/2,-z,x+1/2.y+1/2,-z,-x+1/2.-x+1/2,-y,-z+1/2.x+1/2,y,-z+1/2.-x+1/2,y,z+1/2.x+1/2,-y,z+1/2.-z+1/2,-x,-y+1/2.-z+1/2,x,y+1/2.z+1/2,-x,y+1/2.z+1/2,x,-y+1/2.-y+1/2,-z,-x+1/2.y+1/2,-z,x+1/2.y+1/2,z,-x+1/2.-y+1/2,z,x+1/2.x+1/2,y+1/2,z.-x+1/2,-y+1/2,z.x+1/2,-y+1/2,-z.-x+1/2,y+1/2,-z.z+1/2,x+1/2,y.z+1/2,-x+1/2,-y.-z+1/2,x+1/2,-y.-z+1/2,-x+1/2,y.y+1/2,z+1/2,x.-y+1/2,z+1/2,-x.-y+1/2,-z+1/2,x.y+1/2,-z+1/2,-x.-x+1/2,-y+1/2,-z.x+1/2,y+1/2,-z.-x+1/2,y+1/2,z.x+1/2,-y+1/2,z.-z+1/2,-x+1/2,-y.-z+1/2,x+1/2,y.z+1/2,-x+1/2,y.z+1/2,x+1/2,-y.-y+1/2,-z+1/2,-x.y+1/2,-z+1/2,x.y+1/2,z+1/2,-x.-y+1/2,z+1/2,x".split(".")
	},
	{
		number: 203,
		symbol_cif: "F d -3",
		symbol_hm_short: "Fd-3",
		hall_symbol: "F 2 2 3 -1d",
		universal_h_m: "F d -3:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.z,x,y.z,-x,-y.-z,x,-y.-z,-x,y.y,z,x.-y,z,-x.-y,-z,x.y,-z,-x.-x+1/4,-y+1/4,-z+1/4.x+1/4,y+1/4,-z+1/4.-x+1/4,y+1/4,z+1/4.x+1/4,-y+1/4,z+1/4.-z+1/4,-x+1/4,-y+1/4.-z+1/4,x+1/4,y+1/4.z+1/4,-x+1/4,y+1/4.z+1/4,x+1/4,-y+1/4.-y+1/4,-z+1/4,-x+1/4.y+1/4,-z+1/4,x+1/4.y+1/4,z+1/4,-x+1/4.-y+1/4,z+1/4,x+1/4.x,y+1/2,z+1/2.-x,-y+1/2,z+1/2.x,-y+1/2,-z+1/2.-x,y+1/2,-z+1/2.z,x+1/2,y+1/2.z,-x+1/2,-y+1/2.-z,x+1/2,-y+1/2.-z,-x+1/2,y+1/2.y,z+1/2,x+1/2.-y,z+1/2,-x+1/2.-y,-z+1/2,x+1/2.y,-z+1/2,-x+1/2.-x+1/4,-y+3/4,-z+3/4.x+1/4,y+3/4,-z+3/4.-x+1/4,y+3/4,z+3/4.x+1/4,-y+3/4,z+3/4.-z+1/4,-x+3/4,-y+3/4.-z+1/4,x+3/4,y+3/4.z+1/4,-x+3/4,y+3/4.z+1/4,x+3/4,-y+3/4.-y+1/4,-z+3/4,-x+3/4.y+1/4,-z+3/4,x+3/4.y+1/4,z+3/4,-x+3/4.-y+1/4,z+3/4,x+3/4.x+1/2,y,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y,-z+1/2.-x+1/2,y,-z+1/2.z+1/2,x,y+1/2.z+1/2,-x,-y+1/2.-z+1/2,x,-y+1/2.-z+1/2,-x,y+1/2.y+1/2,z,x+1/2.-y+1/2,z,-x+1/2.-y+1/2,-z,x+1/2.y+1/2,-z,-x+1/2.-x+3/4,-y+1/4,-z+3/4.x+3/4,y+1/4,-z+3/4.-x+3/4,y+1/4,z+3/4.x+3/4,-y+1/4,z+3/4.-z+3/4,-x+1/4,-y+3/4.-z+3/4,x+1/4,y+3/4.z+3/4,-x+1/4,y+3/4.z+3/4,x+1/4,-y+3/4.-y+3/4,-z+1/4,-x+3/4.y+3/4,-z+1/4,x+3/4.y+3/4,z+1/4,-x+3/4.-y+3/4,z+1/4,x+3/4.x+1/2,y+1/2,z.-x+1/2,-y+1/2,z.x+1/2,-y+1/2,-z.-x+1/2,y+1/2,-z.z+1/2,x+1/2,y.z+1/2,-x+1/2,-y.-z+1/2,x+1/2,-y.-z+1/2,-x+1/2,y.y+1/2,z+1/2,x.-y+1/2,z+1/2,-x.-y+1/2,-z+1/2,x.y+1/2,-z+1/2,-x.-x+3/4,-y+3/4,-z+1/4.x+3/4,y+3/4,-z+1/4.-x+3/4,y+3/4,z+1/4.x+3/4,-y+3/4,z+1/4.-z+3/4,-x+3/4,-y+1/4.-z+3/4,x+3/4,y+1/4.z+3/4,-x+3/4,y+1/4.z+3/4,x+3/4,-y+1/4.-y+3/4,-z+3/4,-x+1/4.y+3/4,-z+3/4,x+1/4.y+3/4,z+3/4,-x+1/4.-y+3/4,z+3/4,x+1/4".split(".")
	},
	{
		number: 203,
		symbol_cif: "F d -3",
		symbol_hm_short: "Fd-3",
		hall_symbol: "-F 2uv 2vw 3",
		universal_h_m: "F d -3:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-x+1/4,-y+1/4,z.x,-y+1/4,-z+1/4.-x+1/4,y,-z+1/4.z,x,y.z,-x+1/4,-y+1/4.-z+1/4,x,-y+1/4.-z+1/4,-x+1/4,y.y,z,x.-y+1/4,z,-x+1/4.-y+1/4,-z+1/4,x.y,-z+1/4,-x+1/4.-x,-y,-z.x+3/4,y+3/4,-z.-x,y+3/4,z+3/4.x+3/4,-y,z+3/4.-z,-x,-y.-z,x+3/4,y+3/4.z+3/4,-x,y+3/4.z+3/4,x+3/4,-y.-y,-z,-x.y+3/4,-z,x+3/4.y+3/4,z+3/4,-x.-y,z+3/4,x+3/4.x,y+1/2,z+1/2.-x+1/4,-y+3/4,z+1/2.x,-y+3/4,-z+3/4.-x+1/4,y+1/2,-z+3/4.z,x+1/2,y+1/2.z,-x+3/4,-y+3/4.-z+1/4,x+1/2,-y+3/4.-z+1/4,-x+3/4,y+1/2.y,z+1/2,x+1/2.-y+1/4,z+1/2,-x+3/4.-y+1/4,-z+3/4,x+1/2.y,-z+3/4,-x+3/4.-x,-y+1/2,-z+1/2.x+3/4,y+1/4,-z+1/2.-x,y+1/4,z+1/4.x+3/4,-y+1/2,z+1/4.-z,-x+1/2,-y+1/2.-z,x+1/4,y+1/4.z+3/4,-x+1/2,y+1/4.z+3/4,x+1/4,-y+1/2.-y,-z+1/2,-x+1/2.y+3/4,-z+1/2,x+1/4.y+3/4,z+1/4,-x+1/2.-y,z+1/4,x+1/4.x+1/2,y,z+1/2.-x+3/4,-y+1/4,z+1/2.x+1/2,-y+1/4,-z+3/4.-x+3/4,y,-z+3/4.z+1/2,x,y+1/2.z+1/2,-x+1/4,-y+3/4.-z+3/4,x,-y+3/4.-z+3/4,-x+1/4,y+1/2.y+1/2,z,x+1/2.-y+3/4,z,-x+3/4.-y+3/4,-z+1/4,x+1/2.y+1/2,-z+1/4,-x+3/4.-x+1/2,-y,-z+1/2.x+1/4,y+3/4,-z+1/2.-x+1/2,y+3/4,z+1/4.x+1/4,-y,z+1/4.-z+1/2,-x,-y+1/2.-z+1/2,x+3/4,y+1/4.z+1/4,-x,y+1/4.z+1/4,x+3/4,-y+1/2.-y+1/2,-z,-x+1/2.y+1/4,-z,x+1/4.y+1/4,z+3/4,-x+1/2.-y+1/2,z+3/4,x+1/4.x+1/2,y+1/2,z.-x+3/4,-y+3/4,z.x+1/2,-y+3/4,-z+1/4.-x+3/4,y+1/2,-z+1/4.z+1/2,x+1/2,y.z+1/2,-x+3/4,-y+1/4.-z+3/4,x+1/2,-y+1/4.-z+3/4,-x+3/4,y.y+1/2,z+1/2,x.-y+3/4,z+1/2,-x+1/4.-y+3/4,-z+3/4,x.y+1/2,-z+3/4,-x+1/4.-x+1/2,-y+1/2,-z.x+1/4,y+1/4,-z.-x+1/2,y+1/4,z+3/4.x+1/4,-y+1/2,z+3/4.-z+1/2,-x+1/2,-y.-z+1/2,x+1/4,y+3/4.z+1/4,-x+1/2,y+3/4.z+1/4,x+1/4,-y.-y+1/2,-z+1/2,-x.y+1/4,-z+1/2,x+3/4.y+1/4,z+1/4,-x.-y+1/2,z+1/4,x+3/4".split(".")
	},
	{
		number: 204,
		symbol_cif: "I m -3",
		symbol_hm_short: "Im-3",
		hall_symbol: "-I 2 2 3",
		universal_h_m: "I m -3",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y,z.x,-y,-z.-x,y,-z.z,x,y.z,-x,-y.-z,x,-y.-z,-x,y.y,z,x.-y,z,-x.-y,-z,x.y,-z,-x.-x,-y,-z.x,y,-z.-x,y,z.x,-y,z.-z,-x,-y.-z,x,y.z,-x,y.z,x,-y.-y,-z,-x.y,-z,x.y,z,-x.-y,z,x.x+1/2,y+1/2,z+1/2.-x+1/2,-y+1/2,z+1/2.x+1/2,-y+1/2,-z+1/2.-x+1/2,y+1/2,-z+1/2.z+1/2,x+1/2,y+1/2.z+1/2,-x+1/2,-y+1/2.-z+1/2,x+1/2,-y+1/2.-z+1/2,-x+1/2,y+1/2.y+1/2,z+1/2,x+1/2.-y+1/2,z+1/2,-x+1/2.-y+1/2,-z+1/2,x+1/2.y+1/2,-z+1/2,-x+1/2.-x+1/2,-y+1/2,-z+1/2.x+1/2,y+1/2,-z+1/2.-x+1/2,y+1/2,z+1/2.x+1/2,-y+1/2,z+1/2.-z+1/2,-x+1/2,-y+1/2.-z+1/2,x+1/2,y+1/2.z+1/2,-x+1/2,y+1/2.z+1/2,x+1/2,-y+1/2.-y+1/2,-z+1/2,-x+1/2.y+1/2,-z+1/2,x+1/2.y+1/2,z+1/2,-x+1/2.-y+1/2,z+1/2,x+1/2".split(".")
	},
	{
		number: 205,
		symbol_cif: "P a -3",
		symbol_hm_short: "Pa-3",
		hall_symbol: "-P 2ac 2ab 3",
		universal_h_m: "P a -3",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2",
			"z,x,y",
			"z+1/2,-x+1/2,-y",
			"-z,x+1/2,-y+1/2",
			"-z+1/2,-x,y+1/2",
			"y,z,x",
			"-y,z+1/2,-x+1/2",
			"-y+1/2,-z,x+1/2",
			"y+1/2,-z+1/2,-x",
			"-x,-y,-z",
			"x+1/2,y,-z+1/2",
			"-x+1/2,y+1/2,z",
			"x,-y+1/2,z+1/2",
			"-z,-x,-y",
			"-z+1/2,x+1/2,y",
			"z,-x+1/2,y+1/2",
			"z+1/2,x,-y+1/2",
			"-y,-z,-x",
			"y,-z+1/2,x+1/2",
			"y+1/2,z,-x+1/2",
			"-y+1/2,z+1/2,x"
		]
	},
	{
		number: 206,
		symbol_cif: "I a -3",
		symbol_hm_short: "Ia-3",
		hall_symbol: "-I 2b 2c 3",
		universal_h_m: "I a -3",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-x,-y+1/2,z.x,-y,-z+1/2.-x,y+1/2,-z+1/2.z,x,y.z,-x,-y+1/2.-z+1/2,x,-y.-z+1/2,-x,y+1/2.y,z,x.-y+1/2,z,-x.-y,-z+1/2,x.y+1/2,-z+1/2,-x.-x,-y,-z.x,y+1/2,-z.-x,y,z+1/2.x,-y+1/2,z+1/2.-z,-x,-y.-z,x,y+1/2.z+1/2,-x,y.z+1/2,x,-y+1/2.-y,-z,-x.y+1/2,-z,x.y,z+1/2,-x.-y+1/2,z+1/2,x.x+1/2,y+1/2,z+1/2.-x+1/2,-y,z+1/2.x+1/2,-y+1/2,-z.-x+1/2,y,-z.z+1/2,x+1/2,y+1/2.z+1/2,-x+1/2,-y.-z,x+1/2,-y+1/2.-z,-x+1/2,y.y+1/2,z+1/2,x+1/2.-y,z+1/2,-x+1/2.-y+1/2,-z,x+1/2.y,-z,-x+1/2.-x+1/2,-y+1/2,-z+1/2.x+1/2,y,-z+1/2.-x+1/2,y+1/2,z.x+1/2,-y,z.-z+1/2,-x+1/2,-y+1/2.-z+1/2,x+1/2,y.z,-x+1/2,y+1/2.z,x+1/2,-y.-y+1/2,-z+1/2,-x+1/2.y,-z+1/2,x+1/2.y+1/2,z,-x+1/2.-y,z,x+1/2".split(".")
	},
	{
		number: 207,
		symbol_cif: "P 4 3 2",
		symbol_hm_short: "P432",
		hall_symbol: "P 4 2 3",
		universal_h_m: "P 4 3 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"z,x,y",
			"z,-y,x",
			"z,-x,-y",
			"z,y,-x",
			"-z,x,-y",
			"-z,-y,-x",
			"-z,-x,y",
			"-z,y,x",
			"-x,z,y",
			"y,z,x",
			"x,z,-y",
			"-y,z,-x",
			"-x,-z,-y",
			"y,-z,-x",
			"x,-z,y",
			"-y,-z,x"
		]
	},
	{
		number: 208,
		symbol_cif: "P 42 3 2",
		symbol_hm_short: "P4232",
		hall_symbol: "P 4n 2 3",
		universal_h_m: "P 42 3 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/2,x+1/2,z+1/2",
			"-x,-y,z",
			"y+1/2,-x+1/2,z+1/2",
			"x,-y,-z",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x,y,-z",
			"y+1/2,x+1/2,-z+1/2",
			"z,x,y",
			"z+1/2,-y+1/2,x+1/2",
			"z,-x,-y",
			"z+1/2,y+1/2,-x+1/2",
			"-z,x,-y",
			"-z+1/2,-y+1/2,-x+1/2",
			"-z,-x,y",
			"-z+1/2,y+1/2,x+1/2",
			"-x+1/2,z+1/2,y+1/2",
			"y,z,x",
			"x+1/2,z+1/2,-y+1/2",
			"-y,z,-x",
			"-x+1/2,-z+1/2,-y+1/2",
			"y,-z,-x",
			"x+1/2,-z+1/2,y+1/2",
			"-y,-z,x"
		]
	},
	{
		number: 209,
		symbol_cif: "F 4 3 2",
		symbol_hm_short: "F432",
		hall_symbol: "F 4 2 3",
		universal_h_m: "F 4 3 2",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.x,y+1/2,z+1/2.-y,x+1/2,z+1/2.-x,-y+1/2,z+1/2.y,-x+1/2,z+1/2.x,-y+1/2,-z+1/2.-y,-x+1/2,-z+1/2.-x,y+1/2,-z+1/2.y,x+1/2,-z+1/2.z,x+1/2,y+1/2.z,-y+1/2,x+1/2.z,-x+1/2,-y+1/2.z,y+1/2,-x+1/2.-z,x+1/2,-y+1/2.-z,-y+1/2,-x+1/2.-z,-x+1/2,y+1/2.-z,y+1/2,x+1/2.-x,z+1/2,y+1/2.y,z+1/2,x+1/2.x,z+1/2,-y+1/2.-y,z+1/2,-x+1/2.-x,-z+1/2,-y+1/2.y,-z+1/2,-x+1/2.x,-z+1/2,y+1/2.-y,-z+1/2,x+1/2.x+1/2,y,z+1/2.-y+1/2,x,z+1/2.-x+1/2,-y,z+1/2.y+1/2,-x,z+1/2.x+1/2,-y,-z+1/2.-y+1/2,-x,-z+1/2.-x+1/2,y,-z+1/2.y+1/2,x,-z+1/2.z+1/2,x,y+1/2.z+1/2,-y,x+1/2.z+1/2,-x,-y+1/2.z+1/2,y,-x+1/2.-z+1/2,x,-y+1/2.-z+1/2,-y,-x+1/2.-z+1/2,-x,y+1/2.-z+1/2,y,x+1/2.-x+1/2,z,y+1/2.y+1/2,z,x+1/2.x+1/2,z,-y+1/2.-y+1/2,z,-x+1/2.-x+1/2,-z,-y+1/2.y+1/2,-z,-x+1/2.x+1/2,-z,y+1/2.-y+1/2,-z,x+1/2.x+1/2,y+1/2,z.-y+1/2,x+1/2,z.-x+1/2,-y+1/2,z.y+1/2,-x+1/2,z.x+1/2,-y+1/2,-z.-y+1/2,-x+1/2,-z.-x+1/2,y+1/2,-z.y+1/2,x+1/2,-z.z+1/2,x+1/2,y.z+1/2,-y+1/2,x.z+1/2,-x+1/2,-y.z+1/2,y+1/2,-x.-z+1/2,x+1/2,-y.-z+1/2,-y+1/2,-x.-z+1/2,-x+1/2,y.-z+1/2,y+1/2,x.-x+1/2,z+1/2,y.y+1/2,z+1/2,x.x+1/2,z+1/2,-y.-y+1/2,z+1/2,-x.-x+1/2,-z+1/2,-y.y+1/2,-z+1/2,-x.x+1/2,-z+1/2,y.-y+1/2,-z+1/2,x".split(".")
	},
	{
		number: 210,
		symbol_cif: "F 41 3 2",
		symbol_hm_short: "F4132",
		hall_symbol: "F 4d 2 3",
		universal_h_m: "F 41 3 2",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+1/4,z+1/4.-x,-y+1/2,z+1/2.y+3/4,-x+1/4,z+3/4.x,-y,-z.-y+1/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+3/4,-z+1/4.z,x,y.z+1/4,-y+1/4,x+1/4.z+1/2,-x,-y+1/2.z+3/4,y+3/4,-x+1/4.-z,x,-y.-z+3/4,-y+1/4,-x+3/4.-z+1/2,-x,y+1/2.-z+1/4,y+3/4,x+3/4.-x+1/4,z+1/4,y+1/4.y,z+1/2,x+1/2.x+1/4,z+3/4,-y+3/4.-y+1/2,z,-x+1/2.-x+1/4,-z+1/4,-y+1/4.y,-z,-x.x+1/4,-z+3/4,y+3/4.-y+1/2,-z+1/2,x.x,y+1/2,z+1/2.-y+1/4,x+3/4,z+3/4.-x,-y,z.y+3/4,-x+3/4,z+1/4.x,-y+1/2,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x,y,-z.y+3/4,x+1/4,-z+3/4.z,x+1/2,y+1/2.z+1/4,-y+3/4,x+3/4.z+1/2,-x+1/2,-y.z+3/4,y+1/4,-x+3/4.-z,x+1/2,-y+1/2.-z+3/4,-y+3/4,-x+1/4.-z+1/2,-x+1/2,y.-z+1/4,y+1/4,x+1/4.-x+1/4,z+3/4,y+3/4.y,z,x.x+1/4,z+1/4,-y+1/4.-y+1/2,z+1/2,-x.-x+1/4,-z+3/4,-y+3/4.y,-z+1/2,-x+1/2.x+1/4,-z+1/4,y+1/4.-y+1/2,-z,x+1/2.x+1/2,y,z+1/2.-y+3/4,x+1/4,z+3/4.-x+1/2,-y+1/2,z.y+1/4,-x+1/4,z+1/4.x+1/2,-y,-z+1/2.-y+3/4,-x+3/4,-z+1/4.-x+1/2,y+1/2,-z.y+1/4,x+3/4,-z+3/4.z+1/2,x,y+1/2.z+3/4,-y+1/4,x+3/4.z,-x,-y.z+1/4,y+3/4,-x+3/4.-z+1/2,x,-y+1/2.-z+1/4,-y+1/4,-x+1/4.-z,-x,y.-z+3/4,y+3/4,x+1/4.-x+3/4,z+1/4,y+3/4.y+1/2,z+1/2,x.x+3/4,z+3/4,-y+1/4.-y,z,-x.-x+3/4,-z+1/4,-y+3/4.y+1/2,-z,-x+1/2.x+3/4,-z+3/4,y+1/4.-y,-z+1/2,x+1/2.x+1/2,y+1/2,z.-y+3/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+3/4,z+3/4.x+1/2,-y+1/2,-z.-y+3/4,-x+1/4,-z+3/4.-x+1/2,y,-z+1/2.y+1/4,x+1/4,-z+1/4.z+1/2,x+1/2,y.z+3/4,-y+3/4,x+1/4.z,-x+1/2,-y+1/2.z+1/4,y+1/4,-x+1/4.-z+1/2,x+1/2,-y.-z+1/4,-y+3/4,-x+3/4.-z,-x+1/2,y+1/2.-z+3/4,y+1/4,x+3/4.-x+3/4,z+3/4,y+1/4.y+1/2,z,x+1/2.x+3/4,z+1/4,-y+3/4.-y,z+1/2,-x+1/2.-x+3/4,-z+3/4,-y+1/4.y+1/2,-z+1/2,-x.x+3/4,-z+1/4,y+3/4.-y,-z,x".split(".")
	},
	{
		number: 211,
		symbol_cif: "I 4 3 2",
		symbol_hm_short: "I432",
		hall_symbol: "I 4 2 3",
		universal_h_m: "I 4 3 2",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.x+1/2,y+1/2,z+1/2.-y+1/2,x+1/2,z+1/2.-x+1/2,-y+1/2,z+1/2.y+1/2,-x+1/2,z+1/2.x+1/2,-y+1/2,-z+1/2.-y+1/2,-x+1/2,-z+1/2.-x+1/2,y+1/2,-z+1/2.y+1/2,x+1/2,-z+1/2.z+1/2,x+1/2,y+1/2.z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,-y+1/2.z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,-y+1/2.-z+1/2,-y+1/2,-x+1/2.-z+1/2,-x+1/2,y+1/2.-z+1/2,y+1/2,x+1/2.-x+1/2,z+1/2,y+1/2.y+1/2,z+1/2,x+1/2.x+1/2,z+1/2,-y+1/2.-y+1/2,z+1/2,-x+1/2.-x+1/2,-z+1/2,-y+1/2.y+1/2,-z+1/2,-x+1/2.x+1/2,-z+1/2,y+1/2.-y+1/2,-z+1/2,x+1/2".split(".")
	},
	{
		number: 212,
		symbol_cif: "P 43 3 2",
		symbol_hm_short: "P4332",
		hall_symbol: "P 4acd 2ab 3",
		universal_h_m: "P 43 3 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+3/4,x+1/4,z+3/4",
			"-x+1/2,-y,z+1/2",
			"y+3/4,-x+3/4,z+1/4",
			"x+1/2,-y+1/2,-z",
			"-y+1/4,-x+1/4,-z+1/4",
			"-x,y+1/2,-z+1/2",
			"y+1/4,x+3/4,-z+3/4",
			"z,x,y",
			"z+3/4,-y+3/4,x+1/4",
			"z+1/2,-x+1/2,-y",
			"z+1/4,y+3/4,-x+3/4",
			"-z,x+1/2,-y+1/2",
			"-z+1/4,-y+1/4,-x+1/4",
			"-z+1/2,-x,y+1/2",
			"-z+3/4,y+1/4,x+3/4",
			"-x+3/4,z+1/4,y+3/4",
			"y,z,x",
			"x+1/4,z+3/4,-y+3/4",
			"-y,z+1/2,-x+1/2",
			"-x+1/4,-z+1/4,-y+1/4",
			"y+1/2,-z+1/2,-x",
			"x+3/4,-z+3/4,y+1/4",
			"-y+1/2,-z,x+1/2"
		]
	},
	{
		number: 213,
		symbol_cif: "P 41 3 2",
		symbol_hm_short: "P4132",
		hall_symbol: "P 4bd 2ab 3",
		universal_h_m: "P 41 3 2",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"-y+1/4,x+3/4,z+1/4",
			"-x+1/2,-y,z+1/2",
			"y+1/4,-x+1/4,z+3/4",
			"x+1/2,-y+1/2,-z",
			"-y+3/4,-x+3/4,-z+3/4",
			"-x,y+1/2,-z+1/2",
			"y+3/4,x+1/4,-z+1/4",
			"z,x,y",
			"z+1/4,-y+1/4,x+3/4",
			"z+1/2,-x+1/2,-y",
			"z+3/4,y+1/4,-x+1/4",
			"-z,x+1/2,-y+1/2",
			"-z+3/4,-y+3/4,-x+3/4",
			"-z+1/2,-x,y+1/2",
			"-z+1/4,y+3/4,x+1/4",
			"-x+1/4,z+3/4,y+1/4",
			"y,z,x",
			"x+3/4,z+1/4,-y+1/4",
			"-y,z+1/2,-x+1/2",
			"-x+3/4,-z+3/4,-y+3/4",
			"y+1/2,-z+1/2,-x",
			"x+1/4,-z+1/4,y+3/4",
			"-y+1/2,-z,x+1/2"
		]
	},
	{
		number: 214,
		symbol_cif: "I 41 3 2",
		symbol_hm_short: "I4132",
		hall_symbol: "I 4bd 2c 3",
		universal_h_m: "I 41 3 2",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+1/4,z+3/4.x,-y,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x+1/2,y,-z.y+1/4,x+3/4,-z+3/4.z,x,y.z+1/4,-y+1/4,x+3/4.z+1/2,-x+1/2,-y.z+3/4,y+1/4,-x+1/4.-z+1/2,x,-y.-z+1/4,-y+1/4,-x+1/4.-z,-x+1/2,y.-z+3/4,y+1/4,x+3/4.-x+1/4,z+3/4,y+1/4.y,z,x.x+3/4,z+1/4,-y+1/4.-y,z+1/2,-x+1/2.-x+1/4,-z+1/4,-y+1/4.y,-z,-x+1/2.x+3/4,-z+3/4,y+1/4.-y,-z+1/2,x.x+1/2,y+1/2,z+1/2.-y+3/4,x+1/4,z+3/4.-x,-y+1/2,z.y+3/4,-x+3/4,z+1/4.x+1/2,-y+1/2,-z.-y+3/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+1/4,-z+1/4.z+1/2,x+1/2,y+1/2.z+3/4,-y+3/4,x+1/4.z,-x,-y+1/2.z+1/4,y+3/4,-x+3/4.-z,x+1/2,-y+1/2.-z+3/4,-y+3/4,-x+3/4.-z+1/2,-x,y+1/2.-z+1/4,y+3/4,x+1/4.-x+3/4,z+1/4,y+3/4.y+1/2,z+1/2,x+1/2.x+1/4,z+3/4,-y+3/4.-y+1/2,z,-x.-x+3/4,-z+3/4,-y+3/4.y+1/2,-z+1/2,-x.x+1/4,-z+1/4,y+3/4.-y+1/2,-z,x+1/2".split(".")
	},
	{
		number: 215,
		symbol_cif: "P -4 3 m",
		symbol_hm_short: "P-43m",
		hall_symbol: "P -4 2 3",
		universal_h_m: "P -4 3 m",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y,-z",
			"y,x,z",
			"-x,y,-z",
			"-y,-x,z",
			"z,x,y",
			"-z,y,-x",
			"z,-x,-y",
			"-z,-y,x",
			"-z,x,-y",
			"z,y,x",
			"-z,-x,y",
			"z,-y,-x",
			"x,-z,-y",
			"y,z,x",
			"-x,-z,y",
			"-y,z,-x",
			"x,z,y",
			"y,-z,-x",
			"-x,z,-y",
			"-y,-z,x"
		]
	},
	{
		number: 216,
		symbol_cif: "F -4 3 m",
		symbol_hm_short: "F-43m",
		hall_symbol: "F -4 2 3",
		universal_h_m: "F -4 3 m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.y,-x,-z.-x,-y,z.-y,x,-z.x,-y,-z.y,x,z.-x,y,-z.-y,-x,z.z,x,y.-z,y,-x.z,-x,-y.-z,-y,x.-z,x,-y.z,y,x.-z,-x,y.z,-y,-x.x,-z,-y.y,z,x.-x,-z,y.-y,z,-x.x,z,y.y,-z,-x.-x,z,-y.-y,-z,x.x,y+1/2,z+1/2.y,-x+1/2,-z+1/2.-x,-y+1/2,z+1/2.-y,x+1/2,-z+1/2.x,-y+1/2,-z+1/2.y,x+1/2,z+1/2.-x,y+1/2,-z+1/2.-y,-x+1/2,z+1/2.z,x+1/2,y+1/2.-z,y+1/2,-x+1/2.z,-x+1/2,-y+1/2.-z,-y+1/2,x+1/2.-z,x+1/2,-y+1/2.z,y+1/2,x+1/2.-z,-x+1/2,y+1/2.z,-y+1/2,-x+1/2.x,-z+1/2,-y+1/2.y,z+1/2,x+1/2.-x,-z+1/2,y+1/2.-y,z+1/2,-x+1/2.x,z+1/2,y+1/2.y,-z+1/2,-x+1/2.-x,z+1/2,-y+1/2.-y,-z+1/2,x+1/2.x+1/2,y,z+1/2.y+1/2,-x,-z+1/2.-x+1/2,-y,z+1/2.-y+1/2,x,-z+1/2.x+1/2,-y,-z+1/2.y+1/2,x,z+1/2.-x+1/2,y,-z+1/2.-y+1/2,-x,z+1/2.z+1/2,x,y+1/2.-z+1/2,y,-x+1/2.z+1/2,-x,-y+1/2.-z+1/2,-y,x+1/2.-z+1/2,x,-y+1/2.z+1/2,y,x+1/2.-z+1/2,-x,y+1/2.z+1/2,-y,-x+1/2.x+1/2,-z,-y+1/2.y+1/2,z,x+1/2.-x+1/2,-z,y+1/2.-y+1/2,z,-x+1/2.x+1/2,z,y+1/2.y+1/2,-z,-x+1/2.-x+1/2,z,-y+1/2.-y+1/2,-z,x+1/2.x+1/2,y+1/2,z.y+1/2,-x+1/2,-z.-x+1/2,-y+1/2,z.-y+1/2,x+1/2,-z.x+1/2,-y+1/2,-z.y+1/2,x+1/2,z.-x+1/2,y+1/2,-z.-y+1/2,-x+1/2,z.z+1/2,x+1/2,y.-z+1/2,y+1/2,-x.z+1/2,-x+1/2,-y.-z+1/2,-y+1/2,x.-z+1/2,x+1/2,-y.z+1/2,y+1/2,x.-z+1/2,-x+1/2,y.z+1/2,-y+1/2,-x.x+1/2,-z+1/2,-y.y+1/2,z+1/2,x.-x+1/2,-z+1/2,y.-y+1/2,z+1/2,-x.x+1/2,z+1/2,y.y+1/2,-z+1/2,-x.-x+1/2,z+1/2,-y.-y+1/2,-z+1/2,x".split(".")
	},
	{
		number: 217,
		symbol_cif: "I -4 3 m",
		symbol_hm_short: "I-43m",
		hall_symbol: "I -4 2 3",
		universal_h_m: "I -4 3 m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.y,-x,-z.-x,-y,z.-y,x,-z.x,-y,-z.y,x,z.-x,y,-z.-y,-x,z.z,x,y.-z,y,-x.z,-x,-y.-z,-y,x.-z,x,-y.z,y,x.-z,-x,y.z,-y,-x.x,-z,-y.y,z,x.-x,-z,y.-y,z,-x.x,z,y.y,-z,-x.-x,z,-y.-y,-z,x.x+1/2,y+1/2,z+1/2.y+1/2,-x+1/2,-z+1/2.-x+1/2,-y+1/2,z+1/2.-y+1/2,x+1/2,-z+1/2.x+1/2,-y+1/2,-z+1/2.y+1/2,x+1/2,z+1/2.-x+1/2,y+1/2,-z+1/2.-y+1/2,-x+1/2,z+1/2.z+1/2,x+1/2,y+1/2.-z+1/2,y+1/2,-x+1/2.z+1/2,-x+1/2,-y+1/2.-z+1/2,-y+1/2,x+1/2.-z+1/2,x+1/2,-y+1/2.z+1/2,y+1/2,x+1/2.-z+1/2,-x+1/2,y+1/2.z+1/2,-y+1/2,-x+1/2.x+1/2,-z+1/2,-y+1/2.y+1/2,z+1/2,x+1/2.-x+1/2,-z+1/2,y+1/2.-y+1/2,z+1/2,-x+1/2.x+1/2,z+1/2,y+1/2.y+1/2,-z+1/2,-x+1/2.-x+1/2,z+1/2,-y+1/2.-y+1/2,-z+1/2,x+1/2".split(".")
	},
	{
		number: 218,
		symbol_cif: "P -4 3 n",
		symbol_hm_short: "P-43n",
		hall_symbol: "P -4n 2 3",
		universal_h_m: "P -4 3 n",
		setting: "",
		is_standard: !0,
		operations: [
			"x,y,z",
			"y+1/2,-x+1/2,-z+1/2",
			"-x,-y,z",
			"-y+1/2,x+1/2,-z+1/2",
			"x,-y,-z",
			"y+1/2,x+1/2,z+1/2",
			"-x,y,-z",
			"-y+1/2,-x+1/2,z+1/2",
			"z,x,y",
			"-z+1/2,y+1/2,-x+1/2",
			"z,-x,-y",
			"-z+1/2,-y+1/2,x+1/2",
			"-z,x,-y",
			"z+1/2,y+1/2,x+1/2",
			"-z,-x,y",
			"z+1/2,-y+1/2,-x+1/2",
			"x+1/2,-z+1/2,-y+1/2",
			"y,z,x",
			"-x+1/2,-z+1/2,y+1/2",
			"-y,z,-x",
			"x+1/2,z+1/2,y+1/2",
			"y,-z,-x",
			"-x+1/2,z+1/2,-y+1/2",
			"-y,-z,x"
		]
	},
	{
		number: 219,
		symbol_cif: "F -4 3 c",
		symbol_hm_short: "F-43c",
		hall_symbol: "F -4a 2 3",
		universal_h_m: "F -4 3 c",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.y+1/2,-x,-z.-x+1/2,-y+1/2,z.-y,x+1/2,-z.x,-y,-z.y+1/2,x,z.-x+1/2,y+1/2,-z.-y,-x+1/2,z.z,x,y.-z,y+1/2,-x.z,-x+1/2,-y+1/2.-z,-y,x+1/2.-z,x,-y.z,y+1/2,x.-z,-x+1/2,y+1/2.z,-y,-x+1/2.x+1/2,-z,-y.y,z,x.-x,-z,y+1/2.-y+1/2,z,-x+1/2.x+1/2,z,y.y,-z,-x.-x,z,-y+1/2.-y+1/2,-z,x+1/2.x,y+1/2,z+1/2.y+1/2,-x+1/2,-z+1/2.-x+1/2,-y,z+1/2.-y,x,-z+1/2.x,-y+1/2,-z+1/2.y+1/2,x+1/2,z+1/2.-x+1/2,y,-z+1/2.-y,-x,z+1/2.z,x+1/2,y+1/2.-z,y,-x+1/2.z,-x,-y.-z,-y+1/2,x.-z,x+1/2,-y+1/2.z,y,x+1/2.-z,-x,y.z,-y+1/2,-x.x+1/2,-z+1/2,-y+1/2.y,z+1/2,x+1/2.-x,-z+1/2,y.-y+1/2,z+1/2,-x.x+1/2,z+1/2,y+1/2.y,-z+1/2,-x+1/2.-x,z+1/2,-y.-y+1/2,-z+1/2,x.x+1/2,y,z+1/2.y,-x,-z+1/2.-x,-y+1/2,z+1/2.-y+1/2,x+1/2,-z+1/2.x+1/2,-y,-z+1/2.y,x,z+1/2.-x,y+1/2,-z+1/2.-y+1/2,-x+1/2,z+1/2.z+1/2,x,y+1/2.-z+1/2,y+1/2,-x+1/2.z+1/2,-x+1/2,-y.-z+1/2,-y,x.-z+1/2,x,-y+1/2.z+1/2,y+1/2,x+1/2.-z+1/2,-x+1/2,y.z+1/2,-y,-x.x,-z,-y+1/2.y+1/2,z,x+1/2.-x+1/2,-z,y.-y,z,-x.x,z,y+1/2.y+1/2,-z,-x+1/2.-x+1/2,z,-y.-y,-z,x.x+1/2,y+1/2,z.y,-x+1/2,-z.-x,-y,z.-y+1/2,x,-z.x+1/2,-y+1/2,-z.y,x+1/2,z.-x,y,-z.-y+1/2,-x,z.z+1/2,x+1/2,y.-z+1/2,y,-x.z+1/2,-x,-y+1/2.-z+1/2,-y+1/2,x+1/2.-z+1/2,x+1/2,-y.z+1/2,y,x.-z+1/2,-x,y+1/2.z+1/2,-y+1/2,-x+1/2.x,-z+1/2,-y.y+1/2,z+1/2,x.-x+1/2,-z+1/2,y+1/2.-y,z+1/2,-x+1/2.x,z+1/2,y.y+1/2,-z+1/2,-x.-x+1/2,z+1/2,-y+1/2.-y,-z+1/2,x+1/2".split(".")
	},
	{
		number: 220,
		symbol_cif: "I -4 3 d",
		symbol_hm_short: "I-43d",
		hall_symbol: "I -4bd 2c 3",
		universal_h_m: "I -4 3 d",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.y+1/4,-x+3/4,-z+1/4.-x,-y+1/2,z.-y+3/4,x+3/4,-z+1/4.x,-y,-z+1/2.y+1/4,x+1/4,z+1/4.-x,y+1/2,-z+1/2.-y+3/4,-x+1/4,z+1/4.z,x,y.-z+1/4,y+1/4,-x+3/4.z,-x,-y+1/2.-z+1/4,-y+3/4,x+3/4.-z+1/2,x,-y.z+1/4,y+1/4,x+1/4.-z+1/2,-x,y+1/2.z+1/4,-y+3/4,-x+1/4.x+1/4,-z+3/4,-y+1/4.y+1/2,z+1/2,x+1/2.-x+1/4,-z+3/4,y+3/4.-y,z+1/2,-x+1/2.x+1/4,z+1/4,y+1/4.y+1/2,-z+1/2,-x.-x+1/4,z+1/4,-y+3/4.-y,-z+1/2,x.x+1/2,y+1/2,z+1/2.y+3/4,-x+1/4,-z+3/4.-x+1/2,-y,z+1/2.-y+1/4,x+1/4,-z+3/4.x+1/2,-y+1/2,-z.y+3/4,x+3/4,z+3/4.-x+1/2,y,-z.-y+1/4,-x+3/4,z+3/4.z+1/2,x+1/2,y+1/2.-z+3/4,y+3/4,-x+1/4.z+1/2,-x+1/2,-y.-z+3/4,-y+1/4,x+1/4.-z,x+1/2,-y+1/2.z+3/4,y+3/4,x+3/4.-z,-x+1/2,y.z+3/4,-y+1/4,-x+3/4.x+3/4,-z+1/4,-y+3/4.y,z,x.-x+3/4,-z+1/4,y+1/4.-y+1/2,z,-x.x+3/4,z+3/4,y+3/4.y,-z,-x+1/2.-x+3/4,z+3/4,-y+1/4.-y+1/2,-z,x+1/2".split(".")
	},
	{
		number: 221,
		symbol_cif: "P m -3 m",
		symbol_hm_short: "Pm-3m",
		hall_symbol: "-P 4 2 3",
		universal_h_m: "P m -3 m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z.y,x,z.x,-y,z.-y,-x,z.-z,-x,-y.-z,y,-x.-z,x,y.-z,-y,x.z,-x,y.z,y,x.z,x,-y.z,-y,-x.x,-z,-y.-y,-z,-x.-x,-z,y.y,-z,x.x,z,y.-y,z,x.-x,z,-y.y,z,-x".split(".")
	},
	{
		number: 222,
		symbol_cif: "P n -3 n",
		symbol_hm_short: "Pn-3n",
		hall_symbol: "P 4 2 3 -1n",
		universal_h_m: "P n -3 n:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.-x+1/2,-y+1/2,-z+1/2.y+1/2,-x+1/2,-z+1/2.x+1/2,y+1/2,-z+1/2.-y+1/2,x+1/2,-z+1/2.-x+1/2,y+1/2,z+1/2.y+1/2,x+1/2,z+1/2.x+1/2,-y+1/2,z+1/2.-y+1/2,-x+1/2,z+1/2.-z+1/2,-x+1/2,-y+1/2.-z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,y+1/2.-z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,y+1/2.z+1/2,y+1/2,x+1/2.z+1/2,x+1/2,-y+1/2.z+1/2,-y+1/2,-x+1/2.x+1/2,-z+1/2,-y+1/2.-y+1/2,-z+1/2,-x+1/2.-x+1/2,-z+1/2,y+1/2.y+1/2,-z+1/2,x+1/2.x+1/2,z+1/2,y+1/2.-y+1/2,z+1/2,x+1/2.-x+1/2,z+1/2,-y+1/2.y+1/2,z+1/2,-x+1/2".split(".")
	},
	{
		number: 222,
		symbol_cif: "P n -3 n",
		symbol_hm_short: "Pn-3n",
		hall_symbol: "-P 4a 2bc 3",
		universal_h_m: "P n -3 n:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y+1/2,x,z.-x+1/2,-y+1/2,z.y,-x+1/2,z.x,-y+1/2,-z+1/2.-y+1/2,-x+1/2,-z+1/2.-x+1/2,y,-z+1/2.y,x,-z+1/2.z,x,y.z,-y+1/2,x.z,-x+1/2,-y+1/2.z,y,-x+1/2.-z+1/2,x,-y+1/2.-z+1/2,-y+1/2,-x+1/2.-z+1/2,-x+1/2,y.-z+1/2,y,x.-x+1/2,z,y.y,z,x.x,z,-y+1/2.-y+1/2,z,-x+1/2.-x+1/2,-z+1/2,-y+1/2.y,-z+1/2,-x+1/2.x,-z+1/2,y.-y+1/2,-z+1/2,x.-x,-y,-z.y+1/2,-x,-z.x+1/2,y+1/2,-z.-y,x+1/2,-z.-x,y+1/2,z+1/2.y+1/2,x+1/2,z+1/2.x+1/2,-y,z+1/2.-y,-x,z+1/2.-z,-x,-y.-z,y+1/2,-x.-z,x+1/2,y+1/2.-z,-y,x+1/2.z+1/2,-x,y+1/2.z+1/2,y+1/2,x+1/2.z+1/2,x+1/2,-y.z+1/2,-y,-x.x+1/2,-z,-y.-y,-z,-x.-x,-z,y+1/2.y+1/2,-z,x+1/2.x+1/2,z+1/2,y+1/2.-y,z+1/2,x+1/2.-x,z+1/2,-y.y+1/2,z+1/2,-x".split(".")
	},
	{
		number: 223,
		symbol_cif: "P m -3 n",
		symbol_hm_short: "Pm-3n",
		hall_symbol: "-P 4n 2 3",
		universal_h_m: "P m -3 n",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/2,x+1/2,z+1/2.-x,-y,z.y+1/2,-x+1/2,z+1/2.x,-y,-z.-y+1/2,-x+1/2,-z+1/2.-x,y,-z.y+1/2,x+1/2,-z+1/2.z,x,y.z+1/2,-y+1/2,x+1/2.z,-x,-y.z+1/2,y+1/2,-x+1/2.-z,x,-y.-z+1/2,-y+1/2,-x+1/2.-z,-x,y.-z+1/2,y+1/2,x+1/2.-x+1/2,z+1/2,y+1/2.y,z,x.x+1/2,z+1/2,-y+1/2.-y,z,-x.-x+1/2,-z+1/2,-y+1/2.y,-z,-x.x+1/2,-z+1/2,y+1/2.-y,-z,x.-x,-y,-z.y+1/2,-x+1/2,-z+1/2.x,y,-z.-y+1/2,x+1/2,-z+1/2.-x,y,z.y+1/2,x+1/2,z+1/2.x,-y,z.-y+1/2,-x+1/2,z+1/2.-z,-x,-y.-z+1/2,y+1/2,-x+1/2.-z,x,y.-z+1/2,-y+1/2,x+1/2.z,-x,y.z+1/2,y+1/2,x+1/2.z,x,-y.z+1/2,-y+1/2,-x+1/2.x+1/2,-z+1/2,-y+1/2.-y,-z,-x.-x+1/2,-z+1/2,y+1/2.y,-z,x.x+1/2,z+1/2,y+1/2.-y,z,x.-x+1/2,z+1/2,-y+1/2.y,z,-x".split(".")
	},
	{
		number: 224,
		symbol_cif: "P n -3 m",
		symbol_hm_short: "Pn-3m",
		hall_symbol: "P 4n 2 3 -1n",
		universal_h_m: "P n -3 m:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/2,x+1/2,z+1/2.-x,-y,z.y+1/2,-x+1/2,z+1/2.x,-y,-z.-y+1/2,-x+1/2,-z+1/2.-x,y,-z.y+1/2,x+1/2,-z+1/2.z,x,y.z+1/2,-y+1/2,x+1/2.z,-x,-y.z+1/2,y+1/2,-x+1/2.-z,x,-y.-z+1/2,-y+1/2,-x+1/2.-z,-x,y.-z+1/2,y+1/2,x+1/2.-x+1/2,z+1/2,y+1/2.y,z,x.x+1/2,z+1/2,-y+1/2.-y,z,-x.-x+1/2,-z+1/2,-y+1/2.y,-z,-x.x+1/2,-z+1/2,y+1/2.-y,-z,x.-x+1/2,-y+1/2,-z+1/2.y,-x,-z.x+1/2,y+1/2,-z+1/2.-y,x,-z.-x+1/2,y+1/2,z+1/2.y,x,z.x+1/2,-y+1/2,z+1/2.-y,-x,z.-z+1/2,-x+1/2,-y+1/2.-z,y,-x.-z+1/2,x+1/2,y+1/2.-z,-y,x.z+1/2,-x+1/2,y+1/2.z,y,x.z+1/2,x+1/2,-y+1/2.z,-y,-x.x,-z,-y.-y+1/2,-z+1/2,-x+1/2.-x,-z,y.y+1/2,-z+1/2,x+1/2.x,z,y.-y+1/2,z+1/2,x+1/2.-x,z,-y.y+1/2,z+1/2,-x+1/2".split(".")
	},
	{
		number: 224,
		symbol_cif: "P n -3 m",
		symbol_hm_short: "Pn-3m",
		hall_symbol: "-P 4bc 2bc 3",
		universal_h_m: "P n -3 m:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y,x+1/2,z+1/2.-x+1/2,-y+1/2,z.y+1/2,-x,z+1/2.x,-y+1/2,-z+1/2.-y,-x,-z.-x+1/2,y,-z+1/2.y+1/2,x+1/2,-z.z,x,y.z+1/2,-y,x+1/2.z,-x+1/2,-y+1/2.z+1/2,y+1/2,-x.-z+1/2,x,-y+1/2.-z,-y,-x.-z+1/2,-x+1/2,y.-z,y+1/2,x+1/2.-x,z+1/2,y+1/2.y,z,x.x+1/2,z+1/2,-y.-y+1/2,z,-x+1/2.-x,-z,-y.y,-z+1/2,-x+1/2.x+1/2,-z,y+1/2.-y+1/2,-z+1/2,x.-x,-y,-z.y,-x+1/2,-z+1/2.x+1/2,y+1/2,-z.-y+1/2,x,-z+1/2.-x,y+1/2,z+1/2.y,x,z.x+1/2,-y,z+1/2.-y+1/2,-x+1/2,z.-z,-x,-y.-z+1/2,y,-x+1/2.-z,x+1/2,y+1/2.-z+1/2,-y+1/2,x.z+1/2,-x,y+1/2.z,y,x.z+1/2,x+1/2,-y.z,-y+1/2,-x+1/2.x,-z+1/2,-y+1/2.-y,-z,-x.-x+1/2,-z+1/2,y.y+1/2,-z,x+1/2.x,z,y.-y,z+1/2,x+1/2.-x+1/2,z,-y+1/2.y+1/2,z+1/2,-x".split(".")
	},
	{
		number: 225,
		symbol_cif: "F m -3 m",
		symbol_hm_short: "Fm-3m",
		hall_symbol: "-F 4 2 3",
		universal_h_m: "F m -3 m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z.y,x,z.x,-y,z.-y,-x,z.-z,-x,-y.-z,y,-x.-z,x,y.-z,-y,x.z,-x,y.z,y,x.z,x,-y.z,-y,-x.x,-z,-y.-y,-z,-x.-x,-z,y.y,-z,x.x,z,y.-y,z,x.-x,z,-y.y,z,-x.x,y+1/2,z+1/2.-y,x+1/2,z+1/2.-x,-y+1/2,z+1/2.y,-x+1/2,z+1/2.x,-y+1/2,-z+1/2.-y,-x+1/2,-z+1/2.-x,y+1/2,-z+1/2.y,x+1/2,-z+1/2.z,x+1/2,y+1/2.z,-y+1/2,x+1/2.z,-x+1/2,-y+1/2.z,y+1/2,-x+1/2.-z,x+1/2,-y+1/2.-z,-y+1/2,-x+1/2.-z,-x+1/2,y+1/2.-z,y+1/2,x+1/2.-x,z+1/2,y+1/2.y,z+1/2,x+1/2.x,z+1/2,-y+1/2.-y,z+1/2,-x+1/2.-x,-z+1/2,-y+1/2.y,-z+1/2,-x+1/2.x,-z+1/2,y+1/2.-y,-z+1/2,x+1/2.-x,-y+1/2,-z+1/2.y,-x+1/2,-z+1/2.x,y+1/2,-z+1/2.-y,x+1/2,-z+1/2.-x,y+1/2,z+1/2.y,x+1/2,z+1/2.x,-y+1/2,z+1/2.-y,-x+1/2,z+1/2.-z,-x+1/2,-y+1/2.-z,y+1/2,-x+1/2.-z,x+1/2,y+1/2.-z,-y+1/2,x+1/2.z,-x+1/2,y+1/2.z,y+1/2,x+1/2.z,x+1/2,-y+1/2.z,-y+1/2,-x+1/2.x,-z+1/2,-y+1/2.-y,-z+1/2,-x+1/2.-x,-z+1/2,y+1/2.y,-z+1/2,x+1/2.x,z+1/2,y+1/2.-y,z+1/2,x+1/2.-x,z+1/2,-y+1/2.y,z+1/2,-x+1/2.x+1/2,y,z+1/2.-y+1/2,x,z+1/2.-x+1/2,-y,z+1/2.y+1/2,-x,z+1/2.x+1/2,-y,-z+1/2.-y+1/2,-x,-z+1/2.-x+1/2,y,-z+1/2.y+1/2,x,-z+1/2.z+1/2,x,y+1/2.z+1/2,-y,x+1/2.z+1/2,-x,-y+1/2.z+1/2,y,-x+1/2.-z+1/2,x,-y+1/2.-z+1/2,-y,-x+1/2.-z+1/2,-x,y+1/2.-z+1/2,y,x+1/2.-x+1/2,z,y+1/2.y+1/2,z,x+1/2.x+1/2,z,-y+1/2.-y+1/2,z,-x+1/2.-x+1/2,-z,-y+1/2.y+1/2,-z,-x+1/2.x+1/2,-z,y+1/2.-y+1/2,-z,x+1/2.-x+1/2,-y,-z+1/2.y+1/2,-x,-z+1/2.x+1/2,y,-z+1/2.-y+1/2,x,-z+1/2.-x+1/2,y,z+1/2.y+1/2,x,z+1/2.x+1/2,-y,z+1/2.-y+1/2,-x,z+1/2.-z+1/2,-x,-y+1/2.-z+1/2,y,-x+1/2.-z+1/2,x,y+1/2.-z+1/2,-y,x+1/2.z+1/2,-x,y+1/2.z+1/2,y,x+1/2.z+1/2,x,-y+1/2.z+1/2,-y,-x+1/2.x+1/2,-z,-y+1/2.-y+1/2,-z,-x+1/2.-x+1/2,-z,y+1/2.y+1/2,-z,x+1/2.x+1/2,z,y+1/2.-y+1/2,z,x+1/2.-x+1/2,z,-y+1/2.y+1/2,z,-x+1/2.x+1/2,y+1/2,z.-y+1/2,x+1/2,z.-x+1/2,-y+1/2,z.y+1/2,-x+1/2,z.x+1/2,-y+1/2,-z.-y+1/2,-x+1/2,-z.-x+1/2,y+1/2,-z.y+1/2,x+1/2,-z.z+1/2,x+1/2,y.z+1/2,-y+1/2,x.z+1/2,-x+1/2,-y.z+1/2,y+1/2,-x.-z+1/2,x+1/2,-y.-z+1/2,-y+1/2,-x.-z+1/2,-x+1/2,y.-z+1/2,y+1/2,x.-x+1/2,z+1/2,y.y+1/2,z+1/2,x.x+1/2,z+1/2,-y.-y+1/2,z+1/2,-x.-x+1/2,-z+1/2,-y.y+1/2,-z+1/2,-x.x+1/2,-z+1/2,y.-y+1/2,-z+1/2,x.-x+1/2,-y+1/2,-z.y+1/2,-x+1/2,-z.x+1/2,y+1/2,-z.-y+1/2,x+1/2,-z.-x+1/2,y+1/2,z.y+1/2,x+1/2,z.x+1/2,-y+1/2,z.-y+1/2,-x+1/2,z.-z+1/2,-x+1/2,-y.-z+1/2,y+1/2,-x.-z+1/2,x+1/2,y.-z+1/2,-y+1/2,x.z+1/2,-x+1/2,y.z+1/2,y+1/2,x.z+1/2,x+1/2,-y.z+1/2,-y+1/2,-x.x+1/2,-z+1/2,-y.-y+1/2,-z+1/2,-x.-x+1/2,-z+1/2,y.y+1/2,-z+1/2,x.x+1/2,z+1/2,y.-y+1/2,z+1/2,x.-x+1/2,z+1/2,-y.y+1/2,z+1/2,-x".split(".")
	},
	{
		number: 226,
		symbol_cif: "F m -3 c",
		symbol_hm_short: "Fm-3c",
		hall_symbol: "-F 4a 2 3",
		universal_h_m: "F m -3 c",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/2,x,z.-x+1/2,-y+1/2,z.y,-x+1/2,z.x,-y,-z.-y+1/2,-x,-z.-x+1/2,y+1/2,-z.y,x+1/2,-z.z,x,y.z,-y+1/2,x.z,-x+1/2,-y+1/2.z,y,-x+1/2.-z,x,-y.-z,-y+1/2,-x.-z,-x+1/2,y+1/2.-z,y,x+1/2.-x+1/2,z,y.y,z,x.x,z,-y+1/2.-y+1/2,z,-x+1/2.-x+1/2,-z,-y.y,-z,-x.x,-z,y+1/2.-y+1/2,-z,x+1/2.-x,-y,-z.y+1/2,-x,-z.x+1/2,y+1/2,-z.-y,x+1/2,-z.-x,y,z.y+1/2,x,z.x+1/2,-y+1/2,z.-y,-x+1/2,z.-z,-x,-y.-z,y+1/2,-x.-z,x+1/2,y+1/2.-z,-y,x+1/2.z,-x,y.z,y+1/2,x.z,x+1/2,-y+1/2.z,-y,-x+1/2.x+1/2,-z,-y.-y,-z,-x.-x,-z,y+1/2.y+1/2,-z,x+1/2.x+1/2,z,y.-y,z,x.-x,z,-y+1/2.y+1/2,z,-x+1/2.x,y+1/2,z+1/2.-y+1/2,x+1/2,z+1/2.-x+1/2,-y,z+1/2.y,-x,z+1/2.x,-y+1/2,-z+1/2.-y+1/2,-x+1/2,-z+1/2.-x+1/2,y,-z+1/2.y,x,-z+1/2.z,x+1/2,y+1/2.z,-y,x+1/2.z,-x,-y.z,y+1/2,-x.-z,x+1/2,-y+1/2.-z,-y,-x+1/2.-z,-x,y.-z,y+1/2,x.-x+1/2,z+1/2,y+1/2.y,z+1/2,x+1/2.x,z+1/2,-y.-y+1/2,z+1/2,-x.-x+1/2,-z+1/2,-y+1/2.y,-z+1/2,-x+1/2.x,-z+1/2,y.-y+1/2,-z+1/2,x.-x,-y+1/2,-z+1/2.y+1/2,-x+1/2,-z+1/2.x+1/2,y,-z+1/2.-y,x,-z+1/2.-x,y+1/2,z+1/2.y+1/2,x+1/2,z+1/2.x+1/2,-y,z+1/2.-y,-x,z+1/2.-z,-x+1/2,-y+1/2.-z,y,-x+1/2.-z,x,y.-z,-y+1/2,x.z,-x+1/2,y+1/2.z,y,x+1/2.z,x,-y.z,-y+1/2,-x.x+1/2,-z+1/2,-y+1/2.-y,-z+1/2,-x+1/2.-x,-z+1/2,y.y+1/2,-z+1/2,x.x+1/2,z+1/2,y+1/2.-y,z+1/2,x+1/2.-x,z+1/2,-y.y+1/2,z+1/2,-x.x+1/2,y,z+1/2.-y,x,z+1/2.-x,-y+1/2,z+1/2.y+1/2,-x+1/2,z+1/2.x+1/2,-y,-z+1/2.-y,-x,-z+1/2.-x,y+1/2,-z+1/2.y+1/2,x+1/2,-z+1/2.z+1/2,x,y+1/2.z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,-y.z+1/2,y,-x.-z+1/2,x,-y+1/2.-z+1/2,-y+1/2,-x+1/2.-z+1/2,-x+1/2,y.-z+1/2,y,x.-x,z,y+1/2.y+1/2,z,x+1/2.x+1/2,z,-y.-y,z,-x.-x,-z,-y+1/2.y+1/2,-z,-x+1/2.x+1/2,-z,y.-y,-z,x.-x+1/2,-y,-z+1/2.y,-x,-z+1/2.x,y+1/2,-z+1/2.-y+1/2,x+1/2,-z+1/2.-x+1/2,y,z+1/2.y,x,z+1/2.x,-y+1/2,z+1/2.-y+1/2,-x+1/2,z+1/2.-z+1/2,-x,-y+1/2.-z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,y.-z+1/2,-y,x.z+1/2,-x,y+1/2.z+1/2,y+1/2,x+1/2.z+1/2,x+1/2,-y.z+1/2,-y,-x.x,-z,-y+1/2.-y+1/2,-z,-x+1/2.-x+1/2,-z,y.y,-z,x.x,z,y+1/2.-y+1/2,z,x+1/2.-x+1/2,z,-y.y,z,-x.x+1/2,y+1/2,z.-y,x+1/2,z.-x,-y,z.y+1/2,-x,z.x+1/2,-y+1/2,-z.-y,-x+1/2,-z.-x,y,-z.y+1/2,x,-z.z+1/2,x+1/2,y.z+1/2,-y,x.z+1/2,-x,-y+1/2.z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,-y.-z+1/2,-y,-x.-z+1/2,-x,y+1/2.-z+1/2,y+1/2,x+1/2.-x,z+1/2,y.y+1/2,z+1/2,x.x+1/2,z+1/2,-y+1/2.-y,z+1/2,-x+1/2.-x,-z+1/2,-y.y+1/2,-z+1/2,-x.x+1/2,-z+1/2,y+1/2.-y,-z+1/2,x+1/2.-x+1/2,-y+1/2,-z.y,-x+1/2,-z.x,y,-z.-y+1/2,x,-z.-x+1/2,y+1/2,z.y,x+1/2,z.x,-y,z.-y+1/2,-x,z.-z+1/2,-x+1/2,-y.-z+1/2,y,-x.-z+1/2,x,y+1/2.-z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,y.z+1/2,y,x.z+1/2,x,-y+1/2.z+1/2,-y+1/2,-x+1/2.x,-z+1/2,-y.-y+1/2,-z+1/2,-x.-x+1/2,-z+1/2,y+1/2.y,-z+1/2,x+1/2.x,z+1/2,y.-y+1/2,z+1/2,x.-x+1/2,z+1/2,-y+1/2.y,z+1/2,-x+1/2".split(".")
	},
	{
		number: 227,
		symbol_cif: "F d -3 m",
		symbol_hm_short: "Fd-3m",
		hall_symbol: "F 4d 2 3 -1d",
		universal_h_m: "F d -3 m:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+1/4,z+1/4.-x,-y+1/2,z+1/2.y+3/4,-x+1/4,z+3/4.x,-y,-z.-y+1/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+3/4,-z+1/4.z,x,y.z+1/4,-y+1/4,x+1/4.z+1/2,-x,-y+1/2.z+3/4,y+3/4,-x+1/4.-z,x,-y.-z+3/4,-y+1/4,-x+3/4.-z+1/2,-x,y+1/2.-z+1/4,y+3/4,x+3/4.-x+1/4,z+1/4,y+1/4.y,z+1/2,x+1/2.x+1/4,z+3/4,-y+3/4.-y+1/2,z,-x+1/2.-x+1/4,-z+1/4,-y+1/4.y,-z,-x.x+1/4,-z+3/4,y+3/4.-y+1/2,-z+1/2,x.-x+1/4,-y+1/4,-z+1/4.y,-x,-z.x+1/4,y+3/4,-z+3/4.-y+1/2,x,-z+1/2.-x+1/4,y+1/4,z+1/4.y,x+1/2,z+1/2.x+1/4,-y+3/4,z+3/4.-y+1/2,-x+1/2,z.-z+1/4,-x+1/4,-y+1/4.-z,y,-x.-z+3/4,x+1/4,y+3/4.-z+1/2,-y+1/2,x.z+1/4,-x+1/4,y+1/4.z+1/2,y,x+1/2.z+3/4,x+1/4,-y+3/4.z,-y+1/2,-x+1/2.x,-z,-y.-y+1/4,-z+3/4,-x+3/4.-x,-z+1/2,y+1/2.y+3/4,-z+1/4,x+3/4.x,z,y.-y+1/4,z+1/4,x+1/4.-x,z+1/2,-y+1/2.y+3/4,z+3/4,-x+1/4.x,y+1/2,z+1/2.-y+1/4,x+3/4,z+3/4.-x,-y,z.y+3/4,-x+3/4,z+1/4.x,-y+1/2,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x,y,-z.y+3/4,x+1/4,-z+3/4.z,x+1/2,y+1/2.z+1/4,-y+3/4,x+3/4.z+1/2,-x+1/2,-y.z+3/4,y+1/4,-x+3/4.-z,x+1/2,-y+1/2.-z+3/4,-y+3/4,-x+1/4.-z+1/2,-x+1/2,y.-z+1/4,y+1/4,x+1/4.-x+1/4,z+3/4,y+3/4.y,z,x.x+1/4,z+1/4,-y+1/4.-y+1/2,z+1/2,-x.-x+1/4,-z+3/4,-y+3/4.y,-z+1/2,-x+1/2.x+1/4,-z+1/4,y+1/4.-y+1/2,-z,x+1/2.-x+1/4,-y+3/4,-z+3/4.y,-x+1/2,-z+1/2.x+1/4,y+1/4,-z+1/4.-y+1/2,x+1/2,-z.-x+1/4,y+3/4,z+3/4.y,x,z.x+1/4,-y+1/4,z+1/4.-y+1/2,-x,z+1/2.-z+1/4,-x+3/4,-y+3/4.-z,y+1/2,-x+1/2.-z+3/4,x+3/4,y+1/4.-z+1/2,-y,x+1/2.z+1/4,-x+3/4,y+3/4.z+1/2,y+1/2,x.z+3/4,x+3/4,-y+1/4.z,-y,-x.x,-z+1/2,-y+1/2.-y+1/4,-z+1/4,-x+1/4.-x,-z,y.y+3/4,-z+3/4,x+1/4.x,z+1/2,y+1/2.-y+1/4,z+3/4,x+3/4.-x,z,-y.y+3/4,z+1/4,-x+3/4.x+1/2,y,z+1/2.-y+3/4,x+1/4,z+3/4.-x+1/2,-y+1/2,z.y+1/4,-x+1/4,z+1/4.x+1/2,-y,-z+1/2.-y+3/4,-x+3/4,-z+1/4.-x+1/2,y+1/2,-z.y+1/4,x+3/4,-z+3/4.z+1/2,x,y+1/2.z+3/4,-y+1/4,x+3/4.z,-x,-y.z+1/4,y+3/4,-x+3/4.-z+1/2,x,-y+1/2.-z+1/4,-y+1/4,-x+1/4.-z,-x,y.-z+3/4,y+3/4,x+1/4.-x+3/4,z+1/4,y+3/4.y+1/2,z+1/2,x.x+3/4,z+3/4,-y+1/4.-y,z,-x.-x+3/4,-z+1/4,-y+3/4.y+1/2,-z,-x+1/2.x+3/4,-z+3/4,y+1/4.-y,-z+1/2,x+1/2.-x+3/4,-y+1/4,-z+3/4.y+1/2,-x,-z+1/2.x+3/4,y+3/4,-z+1/4.-y,x,-z.-x+3/4,y+1/4,z+3/4.y+1/2,x+1/2,z.x+3/4,-y+3/4,z+1/4.-y,-x+1/2,z+1/2.-z+3/4,-x+1/4,-y+3/4.-z+1/2,y,-x+1/2.-z+1/4,x+1/4,y+1/4.-z,-y+1/2,x+1/2.z+3/4,-x+1/4,y+3/4.z,y,x.z+1/4,x+1/4,-y+1/4.z+1/2,-y+1/2,-x.x+1/2,-z,-y+1/2.-y+3/4,-z+3/4,-x+1/4.-x+1/2,-z+1/2,y.y+1/4,-z+1/4,x+1/4.x+1/2,z,y+1/2.-y+3/4,z+1/4,x+3/4.-x+1/2,z+1/2,-y.y+1/4,z+3/4,-x+3/4.x+1/2,y+1/2,z.-y+3/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+3/4,z+3/4.x+1/2,-y+1/2,-z.-y+3/4,-x+1/4,-z+3/4.-x+1/2,y,-z+1/2.y+1/4,x+1/4,-z+1/4.z+1/2,x+1/2,y.z+3/4,-y+3/4,x+1/4.z,-x+1/2,-y+1/2.z+1/4,y+1/4,-x+1/4.-z+1/2,x+1/2,-y.-z+1/4,-y+3/4,-x+3/4.-z,-x+1/2,y+1/2.-z+3/4,y+1/4,x+3/4.-x+3/4,z+3/4,y+1/4.y+1/2,z,x+1/2.x+3/4,z+1/4,-y+3/4.-y,z+1/2,-x+1/2.-x+3/4,-z+3/4,-y+1/4.y+1/2,-z+1/2,-x.x+3/4,-z+1/4,y+3/4.-y,-z,x.-x+3/4,-y+3/4,-z+1/4.y+1/2,-x+1/2,-z.x+3/4,y+1/4,-z+3/4.-y,x+1/2,-z+1/2.-x+3/4,y+3/4,z+1/4.y+1/2,x,z+1/2.x+3/4,-y+1/4,z+3/4.-y,-x,z.-z+3/4,-x+3/4,-y+1/4.-z+1/2,y+1/2,-x.-z+1/4,x+3/4,y+3/4.-z,-y,x.z+3/4,-x+3/4,y+1/4.z,y+1/2,x+1/2.z+1/4,x+3/4,-y+3/4.z+1/2,-y,-x+1/2.x+1/2,-z+1/2,-y.-y+3/4,-z+1/4,-x+3/4.-x+1/2,-z,y+1/2.y+1/4,-z+3/4,x+3/4.x+1/2,z+1/2,y.-y+3/4,z+3/4,x+1/4.-x+1/2,z,-y+1/2.y+1/4,z+1/4,-x+1/4".split(".")
	},
	{
		number: 227,
		symbol_cif: "F d -3 m",
		symbol_hm_short: "Fd-3m",
		hall_symbol: "-F 4vw 2vw 3",
		universal_h_m: "F d -3 m:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y,x+1/4,z+1/4.-x+3/4,-y+1/4,z+1/2.y+3/4,-x,z+3/4.x,-y+1/4,-z+1/4.-y,-x,-z.-x+3/4,y,-z+3/4.y+3/4,x+1/4,-z+1/2.z,x,y.z+1/4,-y,x+1/4.z+1/2,-x+3/4,-y+1/4.z+3/4,y+3/4,-x.-z+1/4,x,-y+1/4.-z,-y,-x.-z+3/4,-x+3/4,y.-z+1/2,y+3/4,x+1/4.-x,z+1/4,y+1/4.y,z+1/2,x+1/2.x+1/4,z+3/4,-y+1/2.-y+1/4,z,-x+1/4.-x,-z+1/2,-y+1/2.y,-z+1/4,-x+1/4.x+1/4,-z,y+1/4.-y+1/4,-z+3/4,x+1/2.-x,-y,-z.y,-x+3/4,-z+3/4.x+1/4,y+3/4,-z+1/2.-y+1/4,x,-z+1/4.-x,y+3/4,z+3/4.y,x,z.x+1/4,-y,z+1/4.-y+1/4,-x+3/4,z+1/2.-z,-x,-y.-z+3/4,y,-x+3/4.-z+1/2,x+1/4,y+3/4.-z+1/4,-y+1/4,x.z+3/4,-x,y+3/4.z,y,x.z+1/4,x+1/4,-y.z+1/2,-y+1/4,-x+3/4.x,-z+3/4,-y+3/4.-y,-z+1/2,-x+1/2.-x+3/4,-z+1/4,y+1/2.y+3/4,-z,x+3/4.x,z+1/2,y+1/2.-y,z+3/4,x+3/4.-x+3/4,z,-y+3/4.y+3/4,z+1/4,-x+1/2.x,y+1/2,z+1/2.-y,x+3/4,z+3/4.-x+3/4,-y+3/4,z.y+3/4,-x+1/2,z+1/4.x,-y+3/4,-z+3/4.-y,-x+1/2,-z+1/2.-x+3/4,y+1/2,-z+1/4.y+3/4,x+3/4,-z.z,x+1/2,y+1/2.z+1/4,-y+1/2,x+3/4.z+1/2,-x+1/4,-y+3/4.z+3/4,y+1/4,-x+1/2.-z+1/4,x+1/2,-y+3/4.-z,-y+1/2,-x+1/2.-z+3/4,-x+1/4,y+1/2.-z+1/2,y+1/4,x+3/4.-x,z+3/4,y+3/4.y,z,x.x+1/4,z+1/4,-y.-y+1/4,z+1/2,-x+3/4.-x,-z,-y.y,-z+3/4,-x+3/4.x+1/4,-z+1/2,y+3/4.-y+1/4,-z+1/4,x.-x,-y+1/2,-z+1/2.y,-x+1/4,-z+1/4.x+1/4,y+1/4,-z.-y+1/4,x+1/2,-z+3/4.-x,y+1/4,z+1/4.y,x+1/2,z+1/2.x+1/4,-y+1/2,z+3/4.-y+1/4,-x+1/4,z.-z,-x+1/2,-y+1/2.-z+3/4,y+1/2,-x+1/4.-z+1/2,x+3/4,y+1/4.-z+1/4,-y+3/4,x+1/2.z+3/4,-x+1/2,y+1/4.z,y+1/2,x+1/2.z+1/4,x+3/4,-y+1/2.z+1/2,-y+3/4,-x+1/4.x,-z+1/4,-y+1/4.-y,-z,-x.-x+3/4,-z+3/4,y.y+3/4,-z+1/2,x+1/4.x,z,y.-y,z+1/4,x+1/4.-x+3/4,z+1/2,-y+1/4.y+3/4,z+3/4,-x.x+1/2,y,z+1/2.-y+1/2,x+1/4,z+3/4.-x+1/4,-y+1/4,z.y+1/4,-x,z+1/4.x+1/2,-y+1/4,-z+3/4.-y+1/2,-x,-z+1/2.-x+1/4,y,-z+1/4.y+1/4,x+1/4,-z.z+1/2,x,y+1/2.z+3/4,-y,x+3/4.z,-x+3/4,-y+3/4.z+1/4,y+3/4,-x+1/2.-z+3/4,x,-y+3/4.-z+1/2,-y,-x+1/2.-z+1/4,-x+3/4,y+1/2.-z,y+3/4,x+3/4.-x+1/2,z+1/4,y+3/4.y+1/2,z+1/2,x.x+3/4,z+3/4,-y.-y+3/4,z,-x+3/4.-x+1/2,-z+1/2,-y.y+1/2,-z+1/4,-x+3/4.x+3/4,-z,y+3/4.-y+3/4,-z+3/4,x.-x+1/2,-y,-z+1/2.y+1/2,-x+3/4,-z+1/4.x+3/4,y+3/4,-z.-y+3/4,x,-z+3/4.-x+1/2,y+3/4,z+1/4.y+1/2,x,z+1/2.x+3/4,-y,z+3/4.-y+3/4,-x+3/4,z.-z+1/2,-x,-y+1/2.-z+1/4,y,-x+1/4.-z,x+1/4,y+1/4.-z+3/4,-y+1/4,x+1/2.z+1/4,-x,y+1/4.z+1/2,y,x+1/2.z+3/4,x+1/4,-y+1/2.z,-y+1/4,-x+1/4.x+1/2,-z+3/4,-y+1/4.-y+1/2,-z+1/2,-x.-x+1/4,-z+1/4,y.y+1/4,-z,x+1/4.x+1/2,z+1/2,y.-y+1/2,z+3/4,x+1/4.-x+1/4,z,-y+1/4.y+1/4,z+1/4,-x.x+1/2,y+1/2,z.-y+1/2,x+3/4,z+1/4.-x+1/4,-y+3/4,z+1/2.y+1/4,-x+1/2,z+3/4.x+1/2,-y+3/4,-z+1/4.-y+1/2,-x+1/2,-z.-x+1/4,y+1/2,-z+3/4.y+1/4,x+3/4,-z+1/2.z+1/2,x+1/2,y.z+3/4,-y+1/2,x+1/4.z,-x+1/4,-y+1/4.z+1/4,y+1/4,-x.-z+3/4,x+1/2,-y+1/4.-z+1/2,-y+1/2,-x.-z+1/4,-x+1/4,y.-z,y+1/4,x+1/4.-x+1/2,z+3/4,y+1/4.y+1/2,z,x+1/2.x+3/4,z+1/4,-y+1/2.-y+3/4,z+1/2,-x+1/4.-x+1/2,-z,-y+1/2.y+1/2,-z+3/4,-x+1/4.x+3/4,-z+1/2,y+1/4.-y+3/4,-z+1/4,x+1/2.-x+1/2,-y+1/2,-z.y+1/2,-x+1/4,-z+3/4.x+3/4,y+1/4,-z+1/2.-y+3/4,x+1/2,-z+1/4.-x+1/2,y+1/4,z+3/4.y+1/2,x+1/2,z.x+3/4,-y+1/2,z+1/4.-y+3/4,-x+1/4,z+1/2.-z+1/2,-x+1/2,-y.-z+1/4,y+1/2,-x+3/4.-z,x+3/4,y+3/4.-z+3/4,-y+3/4,x.z+1/4,-x+1/2,y+3/4.z+1/2,y+1/2,x.z+3/4,x+3/4,-y.z,-y+3/4,-x+3/4.x+1/2,-z+1/4,-y+3/4.-y+1/2,-z,-x+1/2.-x+1/4,-z+3/4,y+1/2.y+1/4,-z+1/2,x+3/4.x+1/2,z,y+1/2.-y+1/2,z+1/4,x+3/4.-x+1/4,z+1/2,-y+3/4.y+1/4,z+3/4,-x+1/2".split(".")
	},
	{
		number: 228,
		symbol_cif: "F d -3 c",
		symbol_hm_short: "Fd-3c",
		hall_symbol: "F 4d 2 3 -1ad",
		universal_h_m: "F d -3 c:1",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+1/4,z+1/4.-x,-y+1/2,z+1/2.y+3/4,-x+1/4,z+3/4.x,-y,-z.-y+1/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+3/4,-z+1/4.z,x,y.z+1/4,-y+1/4,x+1/4.z+1/2,-x,-y+1/2.z+3/4,y+3/4,-x+1/4.-z,x,-y.-z+3/4,-y+1/4,-x+3/4.-z+1/2,-x,y+1/2.-z+1/4,y+3/4,x+3/4.-x+1/4,z+1/4,y+1/4.y,z+1/2,x+1/2.x+1/4,z+3/4,-y+3/4.-y+1/2,z,-x+1/2.-x+1/4,-z+1/4,-y+1/4.y,-z,-x.x+1/4,-z+3/4,y+3/4.-y+1/2,-z+1/2,x.-x+3/4,-y+1/4,-z+1/4.y+1/2,-x,-z.x+3/4,y+3/4,-z+3/4.-y,x,-z+1/2.-x+3/4,y+1/4,z+1/4.y+1/2,x+1/2,z+1/2.x+3/4,-y+3/4,z+3/4.-y,-x+1/2,z.-z+3/4,-x+1/4,-y+1/4.-z+1/2,y,-x.-z+1/4,x+1/4,y+3/4.-z,-y+1/2,x.z+3/4,-x+1/4,y+1/4.z,y,x+1/2.z+1/4,x+1/4,-y+3/4.z+1/2,-y+1/2,-x+1/2.x+1/2,-z,-y.-y+3/4,-z+3/4,-x+3/4.-x+1/2,-z+1/2,y+1/2.y+1/4,-z+1/4,x+3/4.x+1/2,z,y.-y+3/4,z+1/4,x+1/4.-x+1/2,z+1/2,-y+1/2.y+1/4,z+3/4,-x+1/4.x,y+1/2,z+1/2.-y+1/4,x+3/4,z+3/4.-x,-y,z.y+3/4,-x+3/4,z+1/4.x,-y+1/2,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x,y,-z.y+3/4,x+1/4,-z+3/4.z,x+1/2,y+1/2.z+1/4,-y+3/4,x+3/4.z+1/2,-x+1/2,-y.z+3/4,y+1/4,-x+3/4.-z,x+1/2,-y+1/2.-z+3/4,-y+3/4,-x+1/4.-z+1/2,-x+1/2,y.-z+1/4,y+1/4,x+1/4.-x+1/4,z+3/4,y+3/4.y,z,x.x+1/4,z+1/4,-y+1/4.-y+1/2,z+1/2,-x.-x+1/4,-z+3/4,-y+3/4.y,-z+1/2,-x+1/2.x+1/4,-z+1/4,y+1/4.-y+1/2,-z,x+1/2.-x+3/4,-y+3/4,-z+3/4.y+1/2,-x+1/2,-z+1/2.x+3/4,y+1/4,-z+1/4.-y,x+1/2,-z.-x+3/4,y+3/4,z+3/4.y+1/2,x,z.x+3/4,-y+1/4,z+1/4.-y,-x,z+1/2.-z+3/4,-x+3/4,-y+3/4.-z+1/2,y+1/2,-x+1/2.-z+1/4,x+3/4,y+1/4.-z,-y,x+1/2.z+3/4,-x+3/4,y+3/4.z,y+1/2,x.z+1/4,x+3/4,-y+1/4.z+1/2,-y,-x.x+1/2,-z+1/2,-y+1/2.-y+3/4,-z+1/4,-x+1/4.-x+1/2,-z,y.y+1/4,-z+3/4,x+1/4.x+1/2,z+1/2,y+1/2.-y+3/4,z+3/4,x+3/4.-x+1/2,z,-y.y+1/4,z+1/4,-x+3/4.x+1/2,y,z+1/2.-y+3/4,x+1/4,z+3/4.-x+1/2,-y+1/2,z.y+1/4,-x+1/4,z+1/4.x+1/2,-y,-z+1/2.-y+3/4,-x+3/4,-z+1/4.-x+1/2,y+1/2,-z.y+1/4,x+3/4,-z+3/4.z+1/2,x,y+1/2.z+3/4,-y+1/4,x+3/4.z,-x,-y.z+1/4,y+3/4,-x+3/4.-z+1/2,x,-y+1/2.-z+1/4,-y+1/4,-x+1/4.-z,-x,y.-z+3/4,y+3/4,x+1/4.-x+3/4,z+1/4,y+3/4.y+1/2,z+1/2,x.x+3/4,z+3/4,-y+1/4.-y,z,-x.-x+3/4,-z+1/4,-y+3/4.y+1/2,-z,-x+1/2.x+3/4,-z+3/4,y+1/4.-y,-z+1/2,x+1/2.-x+1/4,-y+1/4,-z+3/4.y,-x,-z+1/2.x+1/4,y+3/4,-z+1/4.-y+1/2,x,-z.-x+1/4,y+1/4,z+3/4.y,x+1/2,z.x+1/4,-y+3/4,z+1/4.-y+1/2,-x+1/2,z+1/2.-z+1/4,-x+1/4,-y+3/4.-z,y,-x+1/2.-z+3/4,x+1/4,y+1/4.-z+1/2,-y+1/2,x+1/2.z+1/4,-x+1/4,y+3/4.z+1/2,y,x.z+3/4,x+1/4,-y+1/4.z,-y+1/2,-x.x,-z,-y+1/2.-y+1/4,-z+3/4,-x+1/4.-x,-z+1/2,y.y+3/4,-z+1/4,x+1/4.x,z,y+1/2.-y+1/4,z+1/4,x+3/4.-x,z+1/2,-y.y+3/4,z+3/4,-x+3/4.x+1/2,y+1/2,z.-y+3/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+3/4,z+3/4.x+1/2,-y+1/2,-z.-y+3/4,-x+1/4,-z+3/4.-x+1/2,y,-z+1/2.y+1/4,x+1/4,-z+1/4.z+1/2,x+1/2,y.z+3/4,-y+3/4,x+1/4.z,-x+1/2,-y+1/2.z+1/4,y+1/4,-x+1/4.-z+1/2,x+1/2,-y.-z+1/4,-y+3/4,-x+3/4.-z,-x+1/2,y+1/2.-z+3/4,y+1/4,x+3/4.-x+3/4,z+3/4,y+1/4.y+1/2,z,x+1/2.x+3/4,z+1/4,-y+3/4.-y,z+1/2,-x+1/2.-x+3/4,-z+3/4,-y+1/4.y+1/2,-z+1/2,-x.x+3/4,-z+1/4,y+3/4.-y,-z,x.-x+1/4,-y+3/4,-z+1/4.y,-x+1/2,-z.x+1/4,y+1/4,-z+3/4.-y+1/2,x+1/2,-z+1/2.-x+1/4,y+3/4,z+1/4.y,x,z+1/2.x+1/4,-y+1/4,z+3/4.-y+1/2,-x,z.-z+1/4,-x+3/4,-y+1/4.-z,y+1/2,-x.-z+3/4,x+3/4,y+3/4.-z+1/2,-y,x.z+1/4,-x+3/4,y+1/4.z+1/2,y+1/2,x+1/2.z+3/4,x+3/4,-y+3/4.z,-y,-x+1/2.x,-z+1/2,-y.-y+1/4,-z+1/4,-x+3/4.-x,-z,y+1/2.y+3/4,-z+3/4,x+3/4.x,z+1/2,y.-y+1/4,z+3/4,x+1/4.-x,z,-y+1/2.y+3/4,z+1/4,-x+1/4".split(".")
	},
	{
		number: 228,
		symbol_cif: "F d -3 c",
		symbol_hm_short: "Fd-3c",
		hall_symbol: "-F 4ud 2vw 3",
		universal_h_m: "F d -3 c:2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y+1/2,x+1/4,z+1/4.-x+1/4,-y+3/4,z+1/2.y+3/4,-x+1/2,z+3/4.x,-y+1/4,-z+1/4.-y+1/2,-x,-z.-x+1/4,y+1/2,-z+3/4.y+3/4,x+3/4,-z+1/2.z,x,y.z+1/4,-y+1/2,x+1/4.z+1/2,-x+1/4,-y+3/4.z+3/4,y+3/4,-x+1/2.-z+1/4,x,-y+1/4.-z,-y+1/2,-x.-z+3/4,-x+1/4,y+1/2.-z+1/2,y+3/4,x+3/4.-x+1/2,z+1/4,y+1/4.y,z+1/2,x+1/2.x+1/4,z+3/4,-y.-y+3/4,z,-x+3/4.-x+1/2,-z+1/2,-y+1/2.y,-z+1/4,-x+1/4.x+1/4,-z,y+3/4.-y+3/4,-z+3/4,x.-x,-y,-z.y+1/2,-x+3/4,-z+3/4.x+3/4,y+1/4,-z+1/2.-y+1/4,x+1/2,-z+1/4.-x,y+3/4,z+3/4.y+1/2,x,z.x+3/4,-y+1/2,z+1/4.-y+1/4,-x+1/4,z+1/2.-z,-x,-y.-z+3/4,y+1/2,-x+3/4.-z+1/2,x+3/4,y+1/4.-z+1/4,-y+1/4,x+1/2.z+3/4,-x,y+3/4.z,y+1/2,x.z+1/4,x+3/4,-y+1/2.z+1/2,-y+1/4,-x+1/4.x+1/2,-z+3/4,-y+3/4.-y,-z+1/2,-x+1/2.-x+3/4,-z+1/4,y.y+1/4,-z,x+1/4.x+1/2,z+1/2,y+1/2.-y,z+3/4,x+3/4.-x+3/4,z,-y+1/4.y+1/4,z+1/4,-x.x,y+1/2,z+1/2.-y+1/2,x+3/4,z+3/4.-x+1/4,-y+1/4,z.y+3/4,-x,z+1/4.x,-y+3/4,-z+3/4.-y+1/2,-x+1/2,-z+1/2.-x+1/4,y,-z+1/4.y+3/4,x+1/4,-z.z,x+1/2,y+1/2.z+1/4,-y,x+3/4.z+1/2,-x+3/4,-y+1/4.z+3/4,y+1/4,-x.-z+1/4,x+1/2,-y+3/4.-z,-y,-x+1/2.-z+3/4,-x+3/4,y.-z+1/2,y+1/4,x+1/4.-x+1/2,z+3/4,y+3/4.y,z,x.x+1/4,z+1/4,-y+1/2.-y+3/4,z+1/2,-x+1/4.-x+1/2,-z,-y.y,-z+3/4,-x+3/4.x+1/4,-z+1/2,y+1/4.-y+3/4,-z+1/4,x+1/2.-x,-y+1/2,-z+1/2.y+1/2,-x+1/4,-z+1/4.x+3/4,y+3/4,-z.-y+1/4,x,-z+3/4.-x,y+1/4,z+1/4.y+1/2,x+1/2,z+1/2.x+3/4,-y,z+3/4.-y+1/4,-x+3/4,z.-z,-x+1/2,-y+1/2.-z+3/4,y,-x+1/4.-z+1/2,x+1/4,y+3/4.-z+1/4,-y+3/4,x.z+3/4,-x+1/2,y+1/4.z,y,x+1/2.z+1/4,x+1/4,-y.z+1/2,-y+3/4,-x+3/4.x+1/2,-z+1/4,-y+1/4.-y,-z,-x.-x+3/4,-z+3/4,y+1/2.y+1/4,-z+1/2,x+3/4.x+1/2,z,y.-y,z+1/4,x+1/4.-x+3/4,z+1/2,-y+3/4.y+1/4,z+3/4,-x+1/2.x+1/2,y,z+1/2.-y,x+1/4,z+3/4.-x+3/4,-y+3/4,z.y+1/4,-x+1/2,z+1/4.x+1/2,-y+1/4,-z+3/4.-y,-x,-z+1/2.-x+3/4,y+1/2,-z+1/4.y+1/4,x+3/4,-z.z+1/2,x,y+1/2.z+3/4,-y+1/2,x+3/4.z,-x+1/4,-y+1/4.z+1/4,y+3/4,-x.-z+3/4,x,-y+3/4.-z+1/2,-y+1/2,-x+1/2.-z+1/4,-x+1/4,y.-z,y+3/4,x+1/4.-x,z+1/4,y+3/4.y+1/2,z+1/2,x.x+3/4,z+3/4,-y+1/2.-y+1/4,z,-x+1/4.-x,-z+1/2,-y.y+1/2,-z+1/4,-x+3/4.x+3/4,-z,y+1/4.-y+1/4,-z+3/4,x+1/2.-x+1/2,-y,-z+1/2.y,-x+3/4,-z+1/4.x+1/4,y+1/4,-z.-y+3/4,x+1/2,-z+3/4.-x+1/2,y+3/4,z+1/4.y,x,z+1/2.x+1/4,-y+1/2,z+3/4.-y+3/4,-x+1/4,z.-z+1/2,-x,-y+1/2.-z+1/4,y+1/2,-x+1/4.-z,x+3/4,y+3/4.-z+3/4,-y+1/4,x.z+1/4,-x,y+1/4.z+1/2,y+1/2,x+1/2.z+3/4,x+3/4,-y.z,-y+1/4,-x+3/4.x,-z+3/4,-y+1/4.-y+1/2,-z+1/2,-x.-x+1/4,-z+1/4,y+1/2.y+3/4,-z,x+3/4.x,z+1/2,y.-y+1/2,z+3/4,x+1/4.-x+1/4,z,-y+3/4.y+3/4,z+1/4,-x+1/2.x+1/2,y+1/2,z.-y,x+3/4,z+1/4.-x+3/4,-y+1/4,z+1/2.y+1/4,-x,z+3/4.x+1/2,-y+3/4,-z+1/4.-y,-x+1/2,-z.-x+3/4,y,-z+3/4.y+1/4,x+1/4,-z+1/2.z+1/2,x+1/2,y.z+3/4,-y,x+1/4.z,-x+3/4,-y+3/4.z+1/4,y+1/4,-x+1/2.-z+3/4,x+1/2,-y+1/4.-z+1/2,-y,-x.-z+1/4,-x+3/4,y+1/2.-z,y+1/4,x+3/4.-x,z+3/4,y+1/4.y+1/2,z,x+1/2.x+3/4,z+1/4,-y.-y+1/4,z+1/2,-x+3/4.-x,-z,-y+1/2.y+1/2,-z+3/4,-x+1/4.x+3/4,-z+1/2,y+3/4.-y+1/4,-z+1/4,x.-x+1/2,-y+1/2,-z.y,-x+1/4,-z+3/4.x+1/4,y+3/4,-z+1/2.-y+3/4,x,-z+1/4.-x+1/2,y+1/4,z+3/4.y,x+1/2,z.x+1/4,-y,z+1/4.-y+3/4,-x+3/4,z+1/2.-z+1/2,-x+1/2,-y.-z+1/4,y,-x+3/4.-z,x+1/4,y+1/4.-z+3/4,-y+3/4,x+1/2.z+1/4,-x+1/2,y+3/4.z+1/2,y,x.z+3/4,x+1/4,-y+1/2.z,-y+3/4,-x+1/4.x,-z+1/4,-y+3/4.-y+1/2,-z,-x+1/2.-x+1/4,-z+3/4,y.y+3/4,-z+1/2,x+1/4.x,z,y+1/2.-y+1/2,z+1/4,x+3/4.-x+1/4,z+1/2,-y+1/4.y+3/4,z+3/4,-x".split(".")
	},
	{
		number: 229,
		symbol_cif: "I m -3 m",
		symbol_hm_short: "Im-3m",
		hall_symbol: "-I 4 2 3",
		universal_h_m: "I m -3 m",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.z,x,y.z,-y,x.z,-x,-y.z,y,-x.-z,x,-y.-z,-y,-x.-z,-x,y.-z,y,x.-x,z,y.y,z,x.x,z,-y.-y,z,-x.-x,-z,-y.y,-z,-x.x,-z,y.-y,-z,x.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z.y,x,z.x,-y,z.-y,-x,z.-z,-x,-y.-z,y,-x.-z,x,y.-z,-y,x.z,-x,y.z,y,x.z,x,-y.z,-y,-x.x,-z,-y.-y,-z,-x.-x,-z,y.y,-z,x.x,z,y.-y,z,x.-x,z,-y.y,z,-x.x+1/2,y+1/2,z+1/2.-y+1/2,x+1/2,z+1/2.-x+1/2,-y+1/2,z+1/2.y+1/2,-x+1/2,z+1/2.x+1/2,-y+1/2,-z+1/2.-y+1/2,-x+1/2,-z+1/2.-x+1/2,y+1/2,-z+1/2.y+1/2,x+1/2,-z+1/2.z+1/2,x+1/2,y+1/2.z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,-y+1/2.z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,-y+1/2.-z+1/2,-y+1/2,-x+1/2.-z+1/2,-x+1/2,y+1/2.-z+1/2,y+1/2,x+1/2.-x+1/2,z+1/2,y+1/2.y+1/2,z+1/2,x+1/2.x+1/2,z+1/2,-y+1/2.-y+1/2,z+1/2,-x+1/2.-x+1/2,-z+1/2,-y+1/2.y+1/2,-z+1/2,-x+1/2.x+1/2,-z+1/2,y+1/2.-y+1/2,-z+1/2,x+1/2.-x+1/2,-y+1/2,-z+1/2.y+1/2,-x+1/2,-z+1/2.x+1/2,y+1/2,-z+1/2.-y+1/2,x+1/2,-z+1/2.-x+1/2,y+1/2,z+1/2.y+1/2,x+1/2,z+1/2.x+1/2,-y+1/2,z+1/2.-y+1/2,-x+1/2,z+1/2.-z+1/2,-x+1/2,-y+1/2.-z+1/2,y+1/2,-x+1/2.-z+1/2,x+1/2,y+1/2.-z+1/2,-y+1/2,x+1/2.z+1/2,-x+1/2,y+1/2.z+1/2,y+1/2,x+1/2.z+1/2,x+1/2,-y+1/2.z+1/2,-y+1/2,-x+1/2.x+1/2,-z+1/2,-y+1/2.-y+1/2,-z+1/2,-x+1/2.-x+1/2,-z+1/2,y+1/2.y+1/2,-z+1/2,x+1/2.x+1/2,z+1/2,y+1/2.-y+1/2,z+1/2,x+1/2.-x+1/2,z+1/2,-y+1/2.y+1/2,z+1/2,-x+1/2".split(".")
	},
	{
		number: 230,
		symbol_cif: "I a -3 d",
		symbol_hm_short: "Ia-3d",
		hall_symbol: "-I 4bd 2c 3",
		universal_h_m: "I a -3 d",
		setting: "",
		is_standard: !0,
		operations: /* @__PURE__ */ "x,y,z.-y+1/4,x+3/4,z+1/4.-x+1/2,-y,z+1/2.y+1/4,-x+1/4,z+3/4.x,-y,-z+1/2.-y+1/4,-x+1/4,-z+1/4.-x+1/2,y,-z.y+1/4,x+3/4,-z+3/4.z,x,y.z+1/4,-y+1/4,x+3/4.z+1/2,-x+1/2,-y.z+3/4,y+1/4,-x+1/4.-z+1/2,x,-y.-z+1/4,-y+1/4,-x+1/4.-z,-x+1/2,y.-z+3/4,y+1/4,x+3/4.-x+1/4,z+3/4,y+1/4.y,z,x.x+3/4,z+1/4,-y+1/4.-y,z+1/2,-x+1/2.-x+1/4,-z+1/4,-y+1/4.y,-z,-x+1/2.x+3/4,-z+3/4,y+1/4.-y,-z+1/2,x.-x,-y,-z.y+3/4,-x+1/4,-z+3/4.x+1/2,y,-z+1/2.-y+3/4,x+3/4,-z+1/4.-x,y,z+1/2.y+3/4,x+3/4,z+3/4.x+1/2,-y,z.-y+3/4,-x+1/4,z+1/4.-z,-x,-y.-z+3/4,y+3/4,-x+1/4.-z+1/2,x+1/2,y.-z+1/4,-y+3/4,x+3/4.z+1/2,-x,y.z+3/4,y+3/4,x+3/4.z,x+1/2,-y.z+1/4,-y+3/4,-x+1/4.x+3/4,-z+1/4,-y+3/4.-y,-z,-x.-x+1/4,-z+3/4,y+3/4.y,-z+1/2,x+1/2.x+3/4,z+3/4,y+3/4.-y,z,x+1/2.-x+1/4,z+1/4,-y+3/4.y,z+1/2,-x.x+1/2,y+1/2,z+1/2.-y+3/4,x+1/4,z+3/4.-x,-y+1/2,z.y+3/4,-x+3/4,z+1/4.x+1/2,-y+1/2,-z.-y+3/4,-x+3/4,-z+3/4.-x,y+1/2,-z+1/2.y+3/4,x+1/4,-z+1/4.z+1/2,x+1/2,y+1/2.z+3/4,-y+3/4,x+1/4.z,-x,-y+1/2.z+1/4,y+3/4,-x+3/4.-z,x+1/2,-y+1/2.-z+3/4,-y+3/4,-x+3/4.-z+1/2,-x,y+1/2.-z+1/4,y+3/4,x+1/4.-x+3/4,z+1/4,y+3/4.y+1/2,z+1/2,x+1/2.x+1/4,z+3/4,-y+3/4.-y+1/2,z,-x.-x+3/4,-z+3/4,-y+3/4.y+1/2,-z+1/2,-x.x+1/4,-z+1/4,y+3/4.-y+1/2,-z,x+1/2.-x+1/2,-y+1/2,-z+1/2.y+1/4,-x+3/4,-z+1/4.x,y+1/2,-z.-y+1/4,x+1/4,-z+3/4.-x+1/2,y+1/2,z.y+1/4,x+1/4,z+1/4.x,-y+1/2,z+1/2.-y+1/4,-x+3/4,z+3/4.-z+1/2,-x+1/2,-y+1/2.-z+1/4,y+1/4,-x+3/4.-z,x,y+1/2.-z+3/4,-y+1/4,x+1/4.z,-x+1/2,y+1/2.z+1/4,y+1/4,x+1/4.z+1/2,x,-y+1/2.z+3/4,-y+1/4,-x+3/4.x+1/4,-z+3/4,-y+1/4.-y+1/2,-z+1/2,-x+1/2.-x+3/4,-z+1/4,y+1/4.y+1/2,-z,x.x+1/4,z+1/4,y+1/4.-y+1/2,z+1/2,x.-x+3/4,z+3/4,-y+1/4.y+1/2,z,-x+1/2".split(".")
	},
	{
		number: 5,
		symbol_cif: "I 1 21 1",
		symbol_hm_short: "I21",
		hall_symbol: "I 2yb",
		universal_h_m: "I 1 21 1",
		setting: "b4",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y+1/2,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "C 1 21 1",
		symbol_hm_short: "C21",
		hall_symbol: "C 2yb",
		universal_h_m: "C 1 21 1",
		setting: "b5",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y+1/2,-z",
			"x+1/2,y+1/2,z",
			"-x+1/2,y,-z"
		]
	},
	{
		number: 18,
		symbol_cif: "P 21212(a)",
		symbol_hm_short: "P21212(a)",
		hall_symbol: "P 2ab 2a",
		universal_h_m: "P 21212(a)",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 20,
		symbol_cif: "C 2 2 21a)",
		symbol_hm_short: "C2221a)",
		hall_symbol: "C 2ac 2",
		universal_h_m: "C 2 2 21a)",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y,z+1/2",
			"x,-y,-z",
			"-x+1/2,y,-z+1/2",
			"x+1/2,y+1/2,z",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y+1/2,-z",
			"-x,y+1/2,-z+1/2"
		]
	},
	{
		number: 21,
		symbol_cif: "C 2 2 2a",
		symbol_hm_short: "C222a",
		hall_symbol: "C 2ab 2b",
		universal_h_m: "C 2 2 2a",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z",
			"-x+1/2,y,-z",
			"x+1/2,y+1/2,z",
			"-x,-y,z",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 22,
		symbol_cif: "F 2 2 2a",
		symbol_hm_short: "F222a",
		hall_symbol: "F 2 2c",
		universal_h_m: "F 2 2 2a",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x,-y,-z+1/2",
			"-x,y,-z+1/2",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x,-y+1/2,-z",
			"-x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,z+1/2",
			"x+1/2,-y,-z",
			"-x+1/2,y,-z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z",
			"x+1/2,-y+1/2,-z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 23,
		symbol_cif: "I 2 2 2a",
		symbol_hm_short: "I222a",
		hall_symbol: "I 2ab 2bc",
		universal_h_m: "I 2 2 2a",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y,z+1/2",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z"
		]
	},
	{
		number: 94,
		symbol_cif: "P 42 21 2a",
		symbol_hm_short: "P42212a",
		hall_symbol: "P 4bc 2a",
		universal_h_m: "P 42 21 2a",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y,x+1/2,z+1/2",
			"-x+1/2,-y+1/2,z",
			"y+1/2,-x,z+1/2",
			"x+1/2,-y,-z",
			"-y+1/2,-x+1/2,-z+1/2",
			"-x,y+1/2,-z",
			"y,x,-z+1/2"
		]
	},
	{
		number: 197,
		symbol_cif: "I 2 3a",
		symbol_hm_short: "I23a",
		hall_symbol: "I 2ab 2bc 3",
		universal_h_m: "I 2 3a",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x+1/2,-y+1/2,z",
			"x,-y+1/2,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"z,x,y",
			"z,-x+1/2,-y+1/2",
			"-z+1/2,x,-y+1/2",
			"-z+1/2,-x+1/2,y",
			"y,z,x",
			"-y+1/2,z,-x+1/2",
			"-y+1/2,-z+1/2,x",
			"y,-z+1/2,-x+1/2",
			"x+1/2,y+1/2,z+1/2",
			"-x,-y,z+1/2",
			"x+1/2,-y,-z",
			"-x,y+1/2,-z",
			"z+1/2,x+1/2,y+1/2",
			"z+1/2,-x,-y",
			"-z,x+1/2,-y",
			"-z,-x,y+1/2",
			"y+1/2,z+1/2,x+1/2",
			"-y,z+1/2,-x",
			"-y,-z,x+1/2",
			"y+1/2,-z,-x"
		]
	},
	{
		number: 1,
		symbol_cif: "A 1",
		symbol_hm_short: "A1",
		hall_symbol: "A 1",
		universal_h_m: "A 1",
		setting: "",
		is_standard: !1,
		operations: ["x,y,z", "x,y+1/2,z+1/2"]
	},
	{
		number: 1,
		symbol_cif: "B 1",
		symbol_hm_short: "B1",
		hall_symbol: "B 1",
		universal_h_m: "B 1",
		setting: "",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,y,z+1/2"]
	},
	{
		number: 1,
		symbol_cif: "C 1",
		symbol_hm_short: "C1",
		hall_symbol: "C 1",
		universal_h_m: "C 1",
		setting: "",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,y+1/2,z"]
	},
	{
		number: 1,
		symbol_cif: "F 1",
		symbol_hm_short: "F1",
		hall_symbol: "F 1",
		universal_h_m: "F 1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,y+1/2,z+1/2",
			"x+1/2,y,z+1/2",
			"x+1/2,y+1/2,z"
		]
	},
	{
		number: 1,
		symbol_cif: "I 1",
		symbol_hm_short: "I1",
		hall_symbol: "I 1",
		universal_h_m: "I 1",
		setting: "",
		is_standard: !1,
		operations: ["x,y,z", "x+1/2,y+1/2,z+1/2"]
	},
	{
		number: 2,
		symbol_cif: "A -1",
		symbol_hm_short: "A-1",
		hall_symbol: "-A 1",
		universal_h_m: "A -1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,-z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,-z+1/2"
		]
	},
	{
		number: 2,
		symbol_cif: "B -1",
		symbol_hm_short: "B-1",
		hall_symbol: "-B 1",
		universal_h_m: "B -1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,-z+1/2"
		]
	},
	{
		number: 2,
		symbol_cif: "C -1",
		symbol_hm_short: "C-1",
		hall_symbol: "-C 1",
		universal_h_m: "C -1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,-z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,-z"
		]
	},
	{
		number: 2,
		symbol_cif: "F -1",
		symbol_hm_short: "F-1",
		hall_symbol: "-F 1",
		universal_h_m: "F -1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,-z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x+1/2,y,z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,-z"
		]
	},
	{
		number: 2,
		symbol_cif: "I -1",
		symbol_hm_short: "I-1",
		hall_symbol: "-I 1",
		universal_h_m: "I -1",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,-z",
			"x+1/2,y+1/2,z+1/2",
			"-x+1/2,-y+1/2,-z+1/2"
		]
	},
	{
		number: 3,
		symbol_cif: "B 1 2 1",
		symbol_hm_short: "B2",
		hall_symbol: "B 2y",
		universal_h_m: "B 1 2 1",
		setting: "b1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,y,-z+1/2"
		]
	},
	{
		number: 3,
		symbol_cif: "C 1 1 2",
		symbol_hm_short: "C112",
		hall_symbol: "C 2",
		universal_h_m: "C 1 1 2",
		setting: "c1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z"
		]
	},
	{
		number: 4,
		symbol_cif: "B 1 21 1",
		symbol_hm_short: "B21",
		hall_symbol: "B 2yb",
		universal_h_m: "B 1 21 1",
		setting: "b1",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y+1/2,-z",
			"x+1/2,y,z+1/2",
			"-x+1/2,y+1/2,-z+1/2"
		]
	},
	{
		number: 4,
		symbol_cif: "C 1 1 21",
		symbol_hm_short: "C1121",
		hall_symbol: "C 2c",
		universal_h_m: "C 1 1 21",
		setting: "c2",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,-y+1/2,z+1/2"
		]
	},
	{
		number: 5,
		symbol_cif: "F 1 2 1",
		symbol_hm_short: "F2",
		hall_symbol: "F 2y",
		universal_h_m: "F 1 2 1",
		setting: "b6",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2",
			"x+1/2,y,z+1/2",
			"-x+1/2,y,-z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z"
		]
	},
	{
		number: 8,
		symbol_cif: "F 1 m 1",
		symbol_hm_short: "Fm",
		hall_symbol: "F -2y",
		universal_h_m: "F 1 m 1",
		setting: "b4",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"x,-y+1/2,z+1/2",
			"x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 9,
		symbol_cif: "F 1 d 1",
		symbol_hm_short: "Fd",
		hall_symbol: "F -2yuw",
		universal_h_m: "F 1 d 1",
		setting: "b4",
		is_standard: !1,
		operations: [
			"x,y,z",
			"x+1/4,-y,z+1/4",
			"x,y+1/2,z+1/2",
			"x+1/4,-y+1/2,z+3/4",
			"x+1/2,y,z+1/2",
			"x+3/4,-y,z+3/4",
			"x+1/2,y+1/2,z",
			"x+3/4,-y+1/2,z+1/4"
		]
	},
	{
		number: 12,
		symbol_cif: "F 1 2/m 1",
		symbol_hm_short: "F2/m",
		hall_symbol: "-F 2y",
		universal_h_m: "F 1 2/m 1",
		setting: "b4",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,y,-z",
			"-x,-y,-z",
			"x,-y,z",
			"x,y+1/2,z+1/2",
			"-x,y+1/2,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,-y+1/2,z+1/2",
			"x+1/2,y,z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x+1/2,-y,-z+1/2",
			"x+1/2,-y,z+1/2",
			"x+1/2,y+1/2,z",
			"-x+1/2,y+1/2,-z",
			"-x+1/2,-y+1/2,-z",
			"x+1/2,-y+1/2,z"
		]
	},
	{
		number: 64,
		symbol_cif: "A b a m",
		symbol_hm_short: "Abam",
		hall_symbol: "-A 2 2ab",
		universal_h_m: "A b a m",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-x,-y,z",
			"x+1/2,-y+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"-x,-y,-z",
			"x,y,-z",
			"-x+1/2,y+1/2,z",
			"x+1/2,-y+1/2,z",
			"x,y+1/2,z+1/2",
			"-x,-y+1/2,z+1/2",
			"x+1/2,-y,-z+1/2",
			"-x+1/2,y,-z+1/2",
			"-x,-y+1/2,-z+1/2",
			"x,y+1/2,-z+1/2",
			"-x+1/2,y,z+1/2",
			"x+1/2,-y,z+1/2"
		]
	},
	{
		number: 89,
		symbol_cif: "C 4 2 2",
		symbol_hm_short: "C422",
		hall_symbol: "C 4 2",
		universal_h_m: "C 4 2 2",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y,x,z",
			"-x,-y,z",
			"y,-x,z",
			"x,-y,-z",
			"-y,-x,-z",
			"-x,y,-z",
			"y,x,-z",
			"x+1/2,y+1/2,z",
			"-y+1/2,x+1/2,z",
			"-x+1/2,-y+1/2,z",
			"y+1/2,-x+1/2,z",
			"x+1/2,-y+1/2,-z",
			"-y+1/2,-x+1/2,-z",
			"-x+1/2,y+1/2,-z",
			"y+1/2,x+1/2,-z"
		]
	},
	{
		number: 90,
		symbol_cif: "C 4 2 21",
		symbol_hm_short: "C4221",
		hall_symbol: "C 4a 2",
		universal_h_m: "C 4 2 21",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"-y+1/2,x,z",
			"-x+1/2,-y+1/2,z",
			"y,-x+1/2,z",
			"x,-y,-z",
			"-y+1/2,-x,-z",
			"-x+1/2,y+1/2,-z",
			"y,x+1/2,-z",
			"x+1/2,y+1/2,z",
			"-y,x+1/2,z",
			"-x,-y,z",
			"y+1/2,-x,z",
			"x+1/2,-y+1/2,-z",
			"-y,-x+1/2,-z",
			"-x,y,-z",
			"y+1/2,x,-z"
		]
	},
	{
		number: 97,
		symbol_cif: "F 4 2 2",
		symbol_hm_short: "F422",
		hall_symbol: "F 4 2",
		universal_h_m: "F 4 2 2",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.x,y+1/2,z+1/2.-y,x+1/2,z+1/2.-x,-y+1/2,z+1/2.y,-x+1/2,z+1/2.x,-y+1/2,-z+1/2.-y,-x+1/2,-z+1/2.-x,y+1/2,-z+1/2.y,x+1/2,-z+1/2.x+1/2,y,z+1/2.-y+1/2,x,z+1/2.-x+1/2,-y,z+1/2.y+1/2,-x,z+1/2.x+1/2,-y,-z+1/2.-y+1/2,-x,-z+1/2.-x+1/2,y,-z+1/2.y+1/2,x,-z+1/2.x+1/2,y+1/2,z.-y+1/2,x+1/2,z.-x+1/2,-y+1/2,z.y+1/2,-x+1/2,z.x+1/2,-y+1/2,-z.-y+1/2,-x+1/2,-z.-x+1/2,y+1/2,-z.y+1/2,x+1/2,-z".split(".")
	},
	{
		number: 115,
		symbol_cif: "C -4 2 m",
		symbol_hm_short: "C-42m",
		hall_symbol: "C -4 2",
		universal_h_m: "C -4 2 m",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"x,-y,-z",
			"y,x,z",
			"-x,y,-z",
			"-y,-x,z",
			"x+1/2,y+1/2,z",
			"y+1/2,-x+1/2,-z",
			"-x+1/2,-y+1/2,z",
			"-y+1/2,x+1/2,-z",
			"x+1/2,-y+1/2,-z",
			"y+1/2,x+1/2,z",
			"-x+1/2,y+1/2,-z",
			"-y+1/2,-x+1/2,z"
		]
	},
	{
		number: 117,
		symbol_cif: "C -4 2 b",
		symbol_hm_short: "C-42b",
		hall_symbol: "C -4 2ya",
		universal_h_m: "C -4 2 b",
		setting: "",
		is_standard: !1,
		operations: [
			"x,y,z",
			"y,-x,-z",
			"-x,-y,z",
			"-y,x,-z",
			"-x+1/2,y,-z",
			"-y+1/2,-x,z",
			"x+1/2,-y,-z",
			"y+1/2,x,z",
			"x+1/2,y+1/2,z",
			"y+1/2,-x+1/2,-z",
			"-x+1/2,-y+1/2,z",
			"-y+1/2,x+1/2,-z",
			"-x,y+1/2,-z",
			"-y,-x+1/2,z",
			"x,-y+1/2,-z",
			"y,x+1/2,z"
		]
	},
	{
		number: 139,
		symbol_cif: "F 4/m m m",
		symbol_hm_short: "F4/mmm",
		hall_symbol: "-F 4 2",
		universal_h_m: "F 4/m m m",
		setting: "",
		is_standard: !1,
		operations: /* @__PURE__ */ "x,y,z.-y,x,z.-x,-y,z.y,-x,z.x,-y,-z.-y,-x,-z.-x,y,-z.y,x,-z.-x,-y,-z.y,-x,-z.x,y,-z.-y,x,-z.-x,y,z.y,x,z.x,-y,z.-y,-x,z.x,y+1/2,z+1/2.-y,x+1/2,z+1/2.-x,-y+1/2,z+1/2.y,-x+1/2,z+1/2.x,-y+1/2,-z+1/2.-y,-x+1/2,-z+1/2.-x,y+1/2,-z+1/2.y,x+1/2,-z+1/2.-x,-y+1/2,-z+1/2.y,-x+1/2,-z+1/2.x,y+1/2,-z+1/2.-y,x+1/2,-z+1/2.-x,y+1/2,z+1/2.y,x+1/2,z+1/2.x,-y+1/2,z+1/2.-y,-x+1/2,z+1/2.x+1/2,y,z+1/2.-y+1/2,x,z+1/2.-x+1/2,-y,z+1/2.y+1/2,-x,z+1/2.x+1/2,-y,-z+1/2.-y+1/2,-x,-z+1/2.-x+1/2,y,-z+1/2.y+1/2,x,-z+1/2.-x+1/2,-y,-z+1/2.y+1/2,-x,-z+1/2.x+1/2,y,-z+1/2.-y+1/2,x,-z+1/2.-x+1/2,y,z+1/2.y+1/2,x,z+1/2.x+1/2,-y,z+1/2.-y+1/2,-x,z+1/2.x+1/2,y+1/2,z.-y+1/2,x+1/2,z.-x+1/2,-y+1/2,z.y+1/2,-x+1/2,z.x+1/2,-y+1/2,-z.-y+1/2,-x+1/2,-z.-x+1/2,y+1/2,-z.y+1/2,x+1/2,-z.-x+1/2,-y+1/2,-z.y+1/2,-x+1/2,-z.x+1/2,y+1/2,-z.-y+1/2,x+1/2,-z.-x+1/2,y+1/2,z.y+1/2,x+1/2,z.x+1/2,-y+1/2,z.-y+1/2,-x+1/2,z".split(".")
	}
]);
//#endregion
//#region src/lib/structure/space-group-lookup.js
function Fe(e) {
	return String(e).replace(/[\s_]+/g, "").toLowerCase();
}
var U = /* @__PURE__ */ new Map(), W = /* @__PURE__ */ new Map(), Ie = /* @__PURE__ */ new Map();
for (let e of Pe) {
	(e.is_standard || !U.has(e.number)) && U.set(e.number, e);
	for (let t of [
		e.symbol_cif,
		e.symbol_hm_short,
		e.hall_symbol,
		e.universal_h_m
	]) {
		let n = Fe(t), r = Ie.get(n) || [];
		r.includes(e) || (r.push(e), Ie.set(n, r)), W.has(n) || W.set(n, e);
	}
}
function Le({ number: e, name: t, fullName: n, hall: r } = {}) {
	let i = typeof e == "string" ? e.trim() : e, a = typeof i == "string" && /^\d+$/.test(i) ? Number(i) : i, o = Number.isInteger(a) ? U.get(a) : null;
	for (let e of [
		r,
		n,
		t
	]) {
		if (!e || e === "Unknown") continue;
		let t = W.get(Fe(e));
		if (t && (!o || t.number === a)) return t;
	}
	return o || null;
}
//#endregion
//#region src/lib/structure/cell-symmetry.js
function Re(e) {
	if (Math.abs(e) < .0021) return "";
	let t = [
		2,
		3,
		4,
		6
	], n = e < 0 ? "-" : "", r = Math.abs(e);
	if (Math.abs(r - Math.round(r)) < .0021) return n + Math.round(r);
	for (let e of t) {
		let t = r * e, i = Math.round(t);
		if (Math.abs(t - i) < .0021) return i === e ? n + "1" : n + i + "/" + e;
	}
	return n + r.toString();
}
var G = class e {
	constructor(e) {
		let { matrix: t, vector: n } = this.parseSymmetryInstruction(e);
		this.rotMatrix = t, this.transVector = n;
	}
	parseSymmetryInstruction(e) {
		let t = [
			,
			,
			,
		].fill().map(() => [
			,
			,
			,
		].fill(0)), n = [
			,
			,
			,
		].fill(0), r = e.split(",").map((e) => e.toUpperCase().replace(/\s+/g, ""));
		if (r.length !== 3) throw Error("Symmetry operation must have exactly three components");
		return r.forEach((e, r) => {
			let i = Ce(e);
			t[r] = i.coefficients, n[r] = i.translation;
		}), {
			matrix: t,
			vector: n
		};
	}
	static fromCIF(t, n) {
		let r = t.get([
			"_space_group_symop",
			"_symmetry_equiv",
			"_space_group_symop.operation_xyz",
			"_space_group_symop_operation_xyz",
			"_symmetry_equiv.pos_as_xyz",
			"_symmetry_equiv_pos_as_xyz"
		]).getIndex([
			"_space_group_symop.operation_xyz",
			"_space_group_symop_operation_xyz",
			"_symmetry_equiv.pos_as_xyz",
			"_symmetry_equiv_pos_as_xyz"
		], n);
		return new e(r);
	}
	applyToPoint(e) {
		let t = C(S(this.rotMatrix, e), this.transVector);
		return Array.isArray(t) ? t : t.toArray();
	}
	applyToAtom(e) {
		let t = new j(...C(S(this.rotMatrix, [
			e.position.x,
			e.position.y,
			e.position.z
		]), this.transVector)), n = null;
		if (e.adp && e.adp instanceof L) {
			let t = [
				[
					e.adp.u11,
					e.adp.u12,
					e.adp.u13
				],
				[
					e.adp.u12,
					e.adp.u22,
					e.adp.u23
				],
				[
					e.adp.u13,
					e.adp.u23,
					e.adp.u33
				]
			], r = this.rotMatrix, i = w(r), a = S(S(r, t), i);
			n = new L(a[0][0], a[1][1], a[2][2], a[0][1], a[0][2], a[1][2]);
		} else e.adp && e.adp instanceof I && (n = new I(e.adp.uiso));
		return new $(e.label, e.atomType, t, n, e.disorderGroup);
	}
	applyToAtoms(e) {
		return e.map((e) => this.applyToAtom(e));
	}
	copy() {
		let t = new e("x,y,z");
		return t.rotMatrix = O(this.rotMatrix), t.transVector = O(this.transVector), t;
	}
	toSymmetryString(e = null) {
		let t = [
			"x",
			"y",
			"z"
		], n = [], r = e ? C(this.transVector, e) : this.transVector;
		for (let e = 0; e < 3; e++) {
			let i = "", a = [];
			for (let n = 0; n < 3; n++) {
				let r = this.rotMatrix[e][n];
				if (Math.abs(r) > 1e-10) if (Math.abs(Math.abs(r) - 1) < 1e-10) a.push(r > 0 ? t[n] : `-${t[n]}`);
				else {
					let e = Re(Math.abs(r));
					a.push(r > 0 ? `${e}${t[n]}` : `-${e}${t[n]}`);
				}
			}
			if (i = a.join("+"), i === "" && (i = "0"), Math.abs(r[e]) > 1e-10) {
				let t = Re(Math.abs(r[e])), n = r[e] < 0 ? `-${t}` : t;
				i = i === "0" ? n : i.startsWith("-") ? `${n}${i}` : `${n}+${i}`;
			}
			n.push(i);
		}
		return n.join(",");
	}
}, K = class e {
	constructor(e, t, n, r = null) {
		this.spaceGroupName = e, this.spaceGroupNumber = t, this.symmetryOperations = n, this.operationIds = r || new Map(n.map((e, t) => [(t + 1).toString(), t]));
		let i = (e) => e.rotMatrix.every((e, t) => e.every((e, n) => e === +(t === n))) && e.transVector.every((e) => e === 0);
		this.identitySymOpId = Array.from(this.operationIds.entries()).find(([e, t]) => i(this.symmetryOperations[t]))?.[0], this._combineSymmetryCodesCache = /* @__PURE__ */ new Map(), this._invertPositionCodeCache = /* @__PURE__ */ new Map(), this._combineOperationCache = /* @__PURE__ */ new Map(), this._operationIdsByIndex = new Map([...this.operationIds.entries()].map(([e, t]) => [t, e])), this._rotationMatrixIndex = /* @__PURE__ */ new Map(), this._buildRotationIndex();
	}
	_buildRotationIndex() {
		this.symmetryOperations.forEach((e, t) => {
			let n = this._matrixToKey(e.rotMatrix);
			this._rotationMatrixIndex.has(n) || this._rotationMatrixIndex.set(n, []), this._rotationMatrixIndex.get(n).push(t);
		});
	}
	_matrixToKey(e) {
		let t = e.map((e) => e.map((e) => Math.round(e * 1e3) / 1e3));
		return JSON.stringify(t);
	}
	_getCacheKey(e, t) {
		return `${e}\u0000${t}`;
	}
	generateEquivalentPositions(e) {
		return this.symmetryOperations.map((t) => t.applyToPoint(e));
	}
	parsePositionCode(e) {
		let { id: t, translation: n } = B(e), r = this.operationIds.get(t);
		if (r === void 0) throw Error(`Invalid symmetry operation ID in string ${e}: ${t}, expecting string format "<symOpId>_abc". ID entry in present symOp loop?`);
		return {
			symOp: this.symmetryOperations[r],
			transVector: n
		};
	}
	_multiplyMatrices3x3(e, t) {
		return [
			[
				e[0][0] * t[0][0] + e[0][1] * t[1][0] + e[0][2] * t[2][0],
				e[0][0] * t[0][1] + e[0][1] * t[1][1] + e[0][2] * t[2][1],
				e[0][0] * t[0][2] + e[0][1] * t[1][2] + e[0][2] * t[2][2]
			],
			[
				e[1][0] * t[0][0] + e[1][1] * t[1][0] + e[1][2] * t[2][0],
				e[1][0] * t[0][1] + e[1][1] * t[1][1] + e[1][2] * t[2][1],
				e[1][0] * t[0][2] + e[1][1] * t[1][2] + e[1][2] * t[2][2]
			],
			[
				e[2][0] * t[0][0] + e[2][1] * t[1][0] + e[2][2] * t[2][0],
				e[2][0] * t[0][1] + e[2][1] * t[1][1] + e[2][2] * t[2][1],
				e[2][0] * t[0][2] + e[2][1] * t[1][2] + e[2][2] * t[2][2]
			]
		];
	}
	_multiplyMatrixVector3x3(e, t) {
		return [
			e[0][0] * t[0] + e[0][1] * t[1] + e[0][2] * t[2],
			e[1][0] * t[0] + e[1][1] * t[1] + e[1][2] * t[2],
			e[2][0] * t[0] + e[2][1] * t[1] + e[2][2] * t[2]
		];
	}
	combineSymmetryCodes(e, t) {
		let n = this._getCacheKey(e, t), r = this._combineSymmetryCodesCache.get(n);
		if (r !== void 0) {
			if (r instanceof Error) throw r;
			return r;
		}
		let { id: i, translation: a } = B(e), { id: o, translation: s } = B(t), c = `${i}\u0000${o}`, l = this._combineOperationCache.get(c);
		if (!l) {
			let n = this.operationIds.get(i), r = this.operationIds.get(o);
			if (n === void 0 || r === void 0) throw Error(`Invalid symmetry operation ID in string ${e}: ${n === void 0 ? i : o}, expecting string format "<symOpId>_abc". ID entry in present symOp loop?`);
			let { symOp: a } = this.parsePositionCode(e), { symOp: s } = this.parsePositionCode(t), u = this._multiplyMatrices3x3(a.rotMatrix, s.rotMatrix), d = this._matrixToKey(u), f = this._rotationMatrixIndex.get(d);
			if (f) {
				let e = this._multiplyMatrixVector3x3(a.rotMatrix, s.transVector), t = a.transVector.map((t, n) => t + e[n]);
				for (let e of f) {
					let n = this.symmetryOperations[e], r = t.map((e, t) => e - n.transVector[t]);
					if (r.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) {
						l = {
							id: this._operationIdsByIndex.get(e),
							offset: r.map((e) => Math.round(e)),
							outerRotation: a.rotMatrix
						}, this._combineOperationCache.set(c, l);
						break;
					}
				}
			}
		}
		if (!l) throw Error(`No matching symmetry operation found for combined position codes: ${e} and ${t}`);
		let u = this._multiplyMatrixVector3x3(l.outerRotation, s), d = a.map((e, t) => e + u[t] + l.offset[t]), f = V(l.id, d);
		return this._combineSymmetryCodesCache.set(n, f), f;
	}
	invertPositionCode(e) {
		let t = String(e), n = this._invertPositionCodeCache.get(t);
		if (n !== void 0) {
			if (n instanceof Error) throw n;
			return n;
		}
		let { symOp: r, transVector: i } = this.parsePositionCode(e), a = [
			i[0] + r.transVector[0],
			i[1] + r.transVector[1],
			i[2] + r.transVector[2]
		], o = E(r.rotMatrix), s = this._multiplyMatrixVector3x3(o, a.map((e) => -e)), c = this._rotationMatrixIndex.get(this._matrixToKey(o));
		if (c) for (let e of c) {
			let n = this.symmetryOperations[e], r = s.map((e, t) => e - n.transVector[t]);
			if (!r.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) continue;
			let i = Array.from(this.operationIds.entries()).find(([, t]) => t === e)?.[0], a = V(i, r.map((e) => Math.round(e)));
			return this._invertPositionCodeCache.set(t, a), a;
		}
		let l = /* @__PURE__ */ Error(`No inverse symmetry operation found for position code: ${e}`);
		throw this._invertPositionCodeCache.set(t, l), l;
	}
	applySymmetry(e, t) {
		let { symOp: n, transVector: r } = this.parsePositionCode(e), i = n.applyToAtoms(t);
		return i.forEach((e) => {
			e.position.x += r[0], e.position.y += r[1], e.position.z += r[2];
		}), i;
	}
	applySymmetryNonSpecial(e, t, n) {
		let r = this.applySymmetry(e, t), i = [], a = [];
		return r.forEach((e, r) => {
			me(e.position, t[r].position, n, .001) ? i.push(e.label) : a.push(e);
		}), {
			atoms: a,
			specialPositions: i
		};
	}
	static fromCIF(t) {
		let n = t.get([
			"_space_group.name_h-m_alt",
			"_symmetry_space_group_name_H-M",
			"_space_group_name_H-M_alt"
		], !1), r = t.get(["_space_group.name_H-M_full", "_space_group_name_H-M_full"], !1), i = t.get([
			"_space_group.name_Hall",
			"_space_group_name_Hall",
			"_symmetry_space_group_name_Hall"
		], !1), a = r || n || i || "Unknown", o = t.get([
			"_space_group.it_number",
			"_space_group.IT_number",
			"_symmetry_Int_Tables_number",
			"_space_group_IT_number"
		], 0), s = t.get([
			"_space_group_symop",
			"_symmetry_equiv",
			"_symmetry_equiv_pos",
			"_space_group_symop.operation_xyz",
			"_space_group_symop_operation_xyz",
			"_symmetry_equiv.pos_as_xyz",
			"_symmetry_equiv_pos_as_xyz"
		], !1);
		if (s && !(s instanceof l)) {
			let n = t.get([
				"_space_group_symop.id",
				"_space_group_symop_id",
				"_symmetry_equiv.id",
				"_symmetry_equiv_pos_site_id"
			], !1);
			return new e(a, o, [new G(s)], n === !1 ? null : /* @__PURE__ */ new Map([[String(n), 0]]));
		}
		if (s || console.warn(Object.keys(t).filter((e) => e.includes("sym"))), s) {
			let t = s.get([
				"_space_group_symop.operation_xyz",
				"_space_group_symop_operation_xyz",
				"_symmetry_equiv.pos_as_xyz",
				"_symmetry_equiv_pos_as_xyz"
			]), n = null;
			try {
				let e = s.get([
					"_space_group_symop.id",
					"_space_group_symop_id",
					"_symmetry_equiv.id",
					"_symmetry_equiv_pos_site_id"
				]);
				n = new Map(e.map((e, t) => [e.toString(), t]));
			} catch {}
			let r = t.map((e) => new G(e));
			return new e(a, o, r, n);
		}
		let c = Le({
			number: o,
			name: n,
			fullName: r,
			hall: i
		});
		if (c) {
			let n = c.operations, r = "standard International Tables setting";
			if (c.universal_h_m?.endsWith(":H")) {
				let e = null;
				try {
					e = Q.fromCIF(t);
				} catch {
					e = null;
				}
				je(e) && (n = Me(c.operations), r = "rhombohedral axes, matching the cell given in the file");
			}
			return console.warn(`No symmetry operations found in CIF block; reconstructing them from space group ${c.symbol_cif} (No. ${c.number}) assuming the ${r}.`), new e(a === "Unknown" ? c.symbol_cif : a, o || c.number, n.map((e) => new G(e)));
		}
		return console.warn("No symmetry operations found in CIF block, will use P1"), new e("Unknown", 0, [new G("x,y,z")]);
	}
};
//#endregion
//#region src/lib/structure/bonds.js
function q(e) {
	return String(e).split("|")[0];
}
function J(e, t = "1_555") {
	let n = String(e);
	return n.includes("|") ? n : `${n}|${t}`;
}
function Y(e, t, n, r) {
	if (!e || t === ".") return n;
	let i = n === "." ? r : n, a = e.invertPositionCode(t), o = e.combineSymmetryCodes(a, i);
	return o === r ? "." : o;
}
var ze = class e {
	constructor(e, t, n = null, r = null, i = null) {
		let a = z(i);
		this.atom1Id = J(e), this.atom2Id = J(t, a === "." ? "1_555" : a), this.bondLength = n, this.bondLengthSU = r, this.atom2SiteSymmetry = a;
	}
	get atom1Label() {
		return q(this.atom1Id);
	}
	get atom2Label() {
		return q(this.atom2Id);
	}
	static fromCIF(t, n, r = "1") {
		let i = t.get("_geom_bond"), a = typeof r == "object" ? r : null, o = a?.identitySymOpId ?? (typeof r == "string" ? r : "1"), s = i.getIndex(["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"], n, "."), c = i.getIndex(["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"], n, !1), l = z(c === !1 ? "." : c, a?.operationIds);
		s = z(s, a?.operationIds);
		let u = null;
		if (a && l !== ".") try {
			s = Y(a, l, s, `${o}_555`);
		} catch (e) {
			u = e;
		}
		else l !== "." && l === s && (s = ".");
		let d = i.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], n), f = `${o}_555`, p = `${d}|${f}`, m = i.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], n), h = s === "?" ? "." : s, g = `${m}|${h === "." ? f : h}`, _ = new e(p, g, i.getIndex(["_geom_bond.distance", "_geom_bond_distance"], n), i.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], n, NaN), h);
		return _.atom1SiteSymmetry = l, _.symmetryNormalizationError = u, _;
	}
}, Be = class e {
	constructor(e, t, n, r, i, a, o, s, c, l, u, d) {
		let f = z(d);
		this.donorAtomId = J(e), this.hydrogenAtomId = J(t), this.acceptorAtomId = J(n, f === "." ? "1_555" : f), this.donorHydrogenDistance = r, this.donorHydrogenDistanceSU = i, this.acceptorHydrogenDistance = a, this.acceptorHydrogenDistanceSU = o, this.donorAcceptorDistance = s, this.donorAcceptorDistanceSU = c, this.hBondAngle = l, this.hBondAngleSU = u, this.acceptorAtomSymmetry = f;
	}
	get donorAtomLabel() {
		return q(this.donorAtomId);
	}
	get hydrogenAtomLabel() {
		return q(this.hydrogenAtomId);
	}
	get acceptorAtomLabel() {
		return q(this.acceptorAtomId);
	}
	static fromCIF(t, n, r = "1") {
		let i = t.get("_geom_hbond"), a = typeof r == "object" ? r : null, o = `${a?.identitySymOpId ?? (typeof r == "string" ? r : "1")}_555`, s = new Set(i.getHeaders().map((e) => e.toLowerCase())), c = ["_geom_hbond.site_symmetry_h", "_geom_hbond_site_symmetry_H"], l = z(i.getIndex(["_geom_hbond.site_symmetry_d", "_geom_hbond_site_symmetry_D"], n, "."), a?.operationIds), u = c.some((e) => s.has(e.toLowerCase())) ? z(i.getIndex(c, n, "."), a?.operationIds) : l, d = z(i.getIndex(["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"], n, "."), a?.operationIds), f = [];
		try {
			u = Y(a, l, u, o);
		} catch (e) {
			f.push({
				endpoint: "hydrogen",
				error: e
			});
		}
		try {
			d = Y(a, l, d, o);
		} catch (e) {
			f.push({
				endpoint: "acceptor",
				error: e
			});
		}
		let p = `${i.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], n)}|${o}`, m = `${i.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], n)}|${u === "." ? o : u}`, h = `${i.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], n)}|${d === "." ? o : d}`, g = new e(p, m, h, i.getIndex(["_geom_hbond.distance_dh", "_geom_hbond_distance_DH"], n, NaN), i.getIndex(["_geom_hbond.distance_dh_su", "_geom_hbond_distance_DH_su"], n, NaN), i.getIndex(["_geom_hbond.distance_ha", "_geom_hbond_distance_HA"], n, NaN), i.getIndex(["_geom_hbond.distance_ha_su", "_geom_hbond_distance_HA_su"], n, NaN), i.getIndex(["_geom_hbond.distance_da", "_geom_hbond_distance_DA"], n, NaN), i.getIndex(["_geom_hbond.distance_da_su", "_geom_hbond_distance_DA_su"], n, NaN), i.getIndex(["_geom_hbond.angle_dha", "_geom_hbond_angle_DHA"], n, NaN), i.getIndex(["_geom_hbond.angle_dha_su", "_geom_hbond_angle_DHA_su"], n, NaN), d);
		return g.donorAtomSymmetry = l, g.symmetryNormalizationErrors = f, g;
	}
}, X = class {
	constructor() {
		this.atomLabelErrors = [], this.symmetryErrors = [];
	}
	addAtomLabelError(e) {
		this.atomLabelErrors.push(e);
	}
	addSymmetryError(e) {
		this.symmetryErrors.push(e);
	}
	isValid() {
		return this.atomLabelErrors.length + this.symmetryErrors.length === 0;
	}
	report(e, t) {
		let n = "";
		return this.atomLabelErrors.length !== 0 && (n += "Unknown atom label(s). Known labels are \n", n += e.map((e) => e.label).join(", "), n += "\n", n += this.atomLabelErrors.join("\n")), this.symmetryErrors.length !== 0 && (n.length !== 0 && (n += "\n"), n += "Unknown symmetry ID(s) or String format. Expected format is <id>_abc. ", n += "Known IDs are:\n", n += Array.from(t.operationIds.keys()).join(", "), n += "\n", n += this.symmetryErrors.join("\n")), n;
	}
}, Z = class e {
	static createBonds(t, n, r = "1") {
		let i = t.get("_geom_bond", !1);
		if (!i) return [];
		let a = i.get(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]).length, o = [];
		for (let s = 0; s < a; s++) {
			let a = i.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], s), c = i.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], s);
			e.isValidBondPair(a, c, n) && o.push(ze.fromCIF(t, s, r));
		}
		return o;
	}
	static createHBonds(t, n, r = "1") {
		let i = t.get("_geom_hbond", !1);
		if (!i) return [];
		let a = i.get(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]).length, o = [];
		for (let s = 0; s < a; s++) {
			let a = i.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], s, "?"), c = i.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], s, "?"), l = i.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], s, "?");
			e.isValidHBondTriplet(a, c, l, n) && o.push(Be.fromCIF(t, s, r));
		}
		return o;
	}
	static validateBonds(e, t, n) {
		let r = new X(), i = new Set(t.map((e) => e.label));
		for (let t of e) {
			let e = [], a = t.atom1Id.split("|")[0], o = t.atom2Id.split("|")[0];
			i.has(a) || e.push(a), i.has(o) || e.push(o), e.length > 0 && r.addAtomLabelError(`Non-existent atoms in bond: ${t.atom1Label} - ${t.atom2Label}, non-existent atom(s): ${e.join(", ")}`);
			let s = !1;
			if (t.atom1SiteSymmetry && t.atom1SiteSymmetry !== ".") try {
				n.parsePositionCode(t.atom1SiteSymmetry);
			} catch {
				s = !0, r.addSymmetryError(`Invalid symmetry at bond site 1: ${t.atom1Label} - ${t.atom2Label}, invalid symmetry operation: ${t.atom1SiteSymmetry}`);
			}
			if (t.atom2SiteSymmetry && t.atom2SiteSymmetry !== ".") try {
				n.parsePositionCode(t.atom2SiteSymmetry);
			} catch {
				s = !0, r.addSymmetryError(`Invalid symmetry in bond: ${t.atom1Label} - ${t.atom2Label}, invalid symmetry operation: ${t.atom2SiteSymmetry}`);
			}
			t.symmetryNormalizationError && !s && r.addSymmetryError(`Could not normalize bond endpoint symmetries: ${t.atom1Label} - ${t.atom2Label}: ${t.symmetryNormalizationError.message}`);
		}
		return r;
	}
	static validateHBonds(e, t, n) {
		let r = new X(), i = new Set(t.map((e) => e.label));
		for (let t of e) {
			let e = [], a = t.donorAtomId.split("|")[0], o = t.hydrogenAtomId.split("|")[0], s = t.acceptorAtomId.split("|")[0];
			i.has(a) || e.push(a), i.has(o) || e.push(o), i.has(s) || e.push(s), e.length > 0 && r.addAtomLabelError(`Non-existent atoms in H-bond: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, non-existent atom(s): ${e.join(", ")}`);
			let c = !1;
			if (t.donorAtomSymmetry && t.donorAtomSymmetry !== ".") try {
				n.parsePositionCode(t.donorAtomSymmetry);
			} catch {
				c = !0, r.addSymmetryError(`Invalid symmetry at H-bond donor: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, invalid symmetry operation: ${t.donorAtomSymmetry}`);
			}
			let l = t.hydrogenAtomId.split("|")[1];
			if (l) try {
				n.parsePositionCode(l);
			} catch {
				c = !0, r.addSymmetryError(`Invalid symmetry in H-bond hydrogen: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, invalid symmetry operation: ${l}`);
			}
			if (t.acceptorAtomSymmetry && t.acceptorAtomSymmetry !== ".") try {
				n.parsePositionCode(t.acceptorAtomSymmetry);
			} catch {
				c = !0, r.addSymmetryError(`Invalid symmetry in H-bond: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, invalid symmetry operation: ${t.acceptorAtomSymmetry}`);
			}
			if (t.symmetryNormalizationErrors?.length && !c) for (let { endpoint: e, error: n } of t.symmetryNormalizationErrors) r.addSymmetryError(`Could not normalize H-bond ${e} symmetry: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}: ${n.message}`);
		}
		return r;
	}
	static isValidLabel(e) {
		return /^(Cg|Cnt|CG|CNT)/.test(e);
	}
	static isValidBondPair(t, n, r) {
		let i = e.isValidLabel(t), a = e.isValidLabel(n);
		return t === "?" || n === "?" ? !1 : (!i || r.has(t)) && (!a || r.has(n));
	}
	static isValidHBondTriplet(t, n, r, i) {
		let a = e.isValidLabel(t), o = e.isValidLabel(n), s = e.isValidLabel(r);
		return t === "?" || n === "?" || r === "?" ? !1 : (!a || i.has(t)) && (!o || i.has(n)) && (!s || i.has(r));
	}
}, Ve = 1e-4;
function He(e) {
	let t = (e) => e * Math.PI / 180, { a: n, b: r, c: i } = e, a = Math.cos(t(e.alpha)), o = Math.cos(t(e.beta)), s = Math.cos(t(e.gamma));
	return [
		[
			n * n,
			n * r * s,
			n * i * o
		],
		[
			n * r * s,
			r * r,
			r * i * a
		],
		[
			n * i * o,
			r * i * a,
			i * i
		]
	];
}
function Ue(e, t, n) {
	for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
		let a = 0;
		for (let n = 0; n < 3; n++) for (let o = 0; o < 3; o++) a += e[n][r] * t[n][o] * e[o][i];
		if (Math.abs(a - t[r][i]) > Ve * n) return !1;
	}
	return !0;
}
function We(e, t) {
	if (!t || !Array.isArray(e)) return [];
	let { a: n, b: r, c: i, alpha: a, beta: o, gamma: s } = t;
	if (![
		n,
		r,
		i,
		a,
		o,
		s
	].every(Number.isFinite)) return [];
	let c = He(t), l = Math.max(...c.flat().map(Math.abs)), u = [];
	return e.forEach((e, t) => {
		let n = Array.isArray(e.rotMatrix) ? e.rotMatrix : e.rotMatrix?.toArray?.();
		n && (Ue(n, c, l) || u.push(t));
	}), u;
}
//#endregion
//#region src/lib/structure/applied-symmetry.js
var Ge = class e {
	constructor(e, t) {
		this.id = e, this.translation = [...t], this._updateKey();
	}
	_updateKey() {
		this.key = V(this.id, this.translation);
	}
	static fromString(t) {
		let { id: n, translation: r } = B(t);
		return new e(n, r);
	}
	toString() {
		return this.key;
	}
	copy() {
		return new e(this.id, this.translation);
	}
	toJonesFaithful(e) {
		let t = e.operationIds.get(this.id);
		if (t === void 0) throw Error(`Invalid symmetry ID: ${this.id}`);
		return e.symmetryOperations[t].toSymmetryString(this.translation);
	}
	combine(t, n) {
		let r = n.combineSymmetryCodes(t.key, this.key);
		return e.fromString(r);
	}
};
//#endregion
//#region src/lib/structure/crystal.js
function Ke(e) {
	if (!e || typeof e != "string") throw Error(`Invalid atom label: ${e}`);
	let t = e.toUpperCase(), n = RegExp(`^(${(/* @__PURE__ */ "HE.LI.BE.NE.NA.MG.AL.SI.CL.AR.CA.SC.TI.CR.MN.FE.CO.NI.CU.ZN.GA.GE.AS.SE.BR.KR.RB.SR.ZR.NB.MO.TC.RU.RH.PD.AG.CD.IN.SN.SB.TE.XE.CS.BA.LA.CE.PR.ND.PM.SM.EU.GD.TB.DY.HO.ER.TM.YB.LU.HF.TA.RE.OS.IR.PT.AU.HG.TL.PB.BI.PO.AT.RN.FR.RA.AC.TH.PA.NP.PU.AM.CM".split(".")).join("|")})`), r = t.match(n);
	if (r) return qe(r[1]);
	let i = t.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
	if (i) return qe(i[1]);
	throw Error(`Could not infer element type from atom label: ${e}`);
}
function qe(e) {
	return e.length === 1 ? e : e[0] + e[1].toLowerCase();
}
var Je = class e {
	constructor(e, t, n = [], r = [], i = null) {
		this.cell = e, this.atoms = t, this.bonds = n, this.hBonds = r, this.symmetry = i || new K("None", 0, [new G("x,y,z")]);
	}
	static fromCIF(t) {
		let n = Q.fromCIF(t), r = t.get("_atom_site").get(["_atom_site.label", "_atom_site_label"]), i = Array.from({ length: r.length }, (e, n) => {
			try {
				return $.fromCIF(t, n);
			} catch (e) {
				if (e.message.includes("Dummy atom")) return null;
				throw e;
			}
		}).filter((e) => e !== null);
		if (i.length === 0) throw Error("The cif file contains no valid atoms.");
		let a = [], o = /* @__PURE__ */ new Set();
		for (let e of i) o.has(e.label) && (a.includes(e.label) || a.push(e.label)), o.add(e.label);
		if (a.length > 0) throw Error(`Duplicate atom site labels: ${a.slice(0, 10).join(", ")}${a.length > 10 ? ", ..." : ""}. Every _atom_site_label must name exactly one site, otherwise bonds and H-bonds referring to it cannot be resolved.`);
		let s = K.fromCIF(t), c = s.identitySymOpId ?? "1";
		i.forEach((e) => {
			e.appliedSymmetry = new Ge(c, [
				0,
				0,
				0
			]);
		});
		let l = new Set(i.map((e) => e.label)), u = Z.createBonds(t, l, s), d = Z.createHBonds(t, l, s), f = We(s.symmetryOperations, n);
		if (f.length > 0) {
			let e = f.slice(0, 5).map((e) => s.symmetryOperations[e].toSymmetryString()).join(", ");
			throw Error(`Symmetry operations incompatible with the unit cell: ${f.length} of ${s.symmetryOperations.length} do not preserve distances in a cell with alpha=${n.alpha}, beta=${n.beta}, gamma=${n.gamma} (${e}). The symmetry and the cell cannot both be right.`);
		}
		let p = Z.validateBonds(u, i, s), m = Z.validateHBonds(d, i, s);
		if (!p.isValid() || !m.isValid()) {
			let e = "There were errors in the bond or H-bond creation\n", t = p.report(i, s), n = m.report(i, s);
			throw t.length !== 0 && n.length !== 0 ? Error(e + t + "\n" + n) : Error(e + t + n);
		}
		return new e(n, i, u, d, s);
	}
	getAtomById(e) {
		for (let t of this.atoms) if (t.uniqueId === e) return t;
		if (!e.includes("|")) {
			for (let t of this.atoms) if (t.label === e && t.isIdentityImage(this.symmetry?.identitySymOpId)) return t;
		}
		let t = this.atoms.map((e) => e.uniqueId).join(", ");
		throw Error(`Could not find atom with ID: ${e}, available are: ${t}`);
	}
	getAtomByLabel(e) {
		for (let t of this.atoms) if (t.label === e) return t;
		let t = this.atoms.map((e) => e.label).join(", ");
		throw Error(`Could not find atom with label: ${e}, available are: ${t}`);
	}
	calculateConnectedGroups() {
		let e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Map();
		for (let n of this.atoms) {
			let r = n.uniqueId;
			e.has(r) || e.set(r, n), n.isIdentityImage(this.symmetry?.identitySymOpId) && !t.has(n.label) && t.set(n.label, n);
		}
		let n = (n) => e.get(n) || (n.includes("|") ? void 0 : t.get(n)), r = /* @__PURE__ */ new Map(), i = [], a = (e) => {
			if (r.has(e.uniqueId)) return r.get(e.uniqueId);
			let t = {
				atoms: /* @__PURE__ */ new Set(),
				bonds: /* @__PURE__ */ new Set(),
				hBonds: /* @__PURE__ */ new Set()
			};
			return i.push(t), t;
		};
		for (let e of this.bonds) {
			let t = e.atom1Id || e.atom1Label, o = e.atom2Id || e.atom2Label, s = n(t), c = n(o);
			if (!s || !c || e.atom2SiteSymmetry !== "." && e.atom2SiteSymmetry !== null) continue;
			let l = r.get(s.uniqueId), u = r.get(c.uniqueId), d = l || u;
			if (!d) {
				let t = a(s);
				t.atoms.add(s), t.atoms.add(c), t.bonds.add(e), r.set(s.uniqueId, t), r.set(c.uniqueId, t);
			} else if (d.atoms.add(s), d.atoms.add(c), d.bonds.add(e), r.set(s.uniqueId, d), r.set(c.uniqueId, d), l && u && l !== u) {
				for (let e of u.atoms) l.atoms.add(e), r.set(e.uniqueId, l);
				for (let e of u.bonds) l.bonds.add(e);
				i.splice(i.indexOf(u), 1);
			}
		}
		for (let e of this.hBonds) {
			let t = e.donorAtomId || e.donorAtomLabel, o = e.hydrogenAtomId, s = e.acceptorAtomId || e.acceptorAtomLabel, c = n(t);
			if (!c) continue;
			let l = a(c);
			l.atoms.add(c), r.set(c.uniqueId, l);
			let u = o ? n(o) : void 0;
			if (u) {
				let e = r.get(u.uniqueId);
				if (e && e !== l) {
					for (let t of e.atoms) l.atoms.add(t), r.set(t.uniqueId, l);
					for (let t of e.bonds) l.bonds.add(t);
					for (let t of e.hBonds) l.hBonds.add(t);
					i.splice(i.indexOf(e), 1);
				}
				l.atoms.add(u), r.set(u.uniqueId, l);
			}
			if (e.acceptorAtomSymmetry !== "." && e.acceptorAtomSymmetry !== null) continue;
			let d = n(s);
			d && (l.hBonds.add(e), r.has(d.uniqueId) && a(d).hBonds.add(e));
		}
		let o = /* @__PURE__ */ new Set();
		for (let e of i) for (let t of e.atoms) o.add(t);
		return this.atoms.filter((e) => !o.has(e)).forEach((e) => {
			let t = {
				atoms: /* @__PURE__ */ new Set([e]),
				bonds: /* @__PURE__ */ new Set(),
				hBonds: /* @__PURE__ */ new Set()
			};
			i.push(t);
		}), i.map((e) => ({
			atoms: Array.from(e.atoms),
			bonds: Array.from(e.bonds),
			hBonds: Array.from(e.hBonds)
		}));
	}
}, Q = class e {
	constructor(e, t, n, r, i, a) {
		this._a = e, this._b = t, this._c = n, this._alpha = r, this._beta = i, this._gamma = a, this.fractToCartMatrix = A(this);
	}
	static fromCIF(t) {
		let n = [
			t.get(["_cell.length_a", "_cell_length_a"], "not found"),
			t.get(["_cell.length_b", "_cell_length_b"], "not found"),
			t.get(["_cell.length_c", "_cell_length_c"], "not found"),
			t.get(["_cell.angle_alpha", "_cell_angle_alpha"], "not found"),
			t.get(["_cell.angle_beta", "_cell_angle_beta"], "not found"),
			t.get(["_cell.angle_gamma", "_cell_angle_gamma"], "not found")
		];
		if (n.some((e) => e === "not found")) {
			let e = [
				"a",
				"b",
				"c",
				"alpha",
				"beta",
				"gamma"
			], t = [];
			n.forEach((n, r) => {
				n === "not found" && t.push(e[r]);
			});
			let r = t.join(", ");
			throw Error(`Unit cell parameter entries missing in CIF for: ${r}`);
		}
		if (n.some((e) => e < 0)) {
			let e = [
				"a",
				"b",
				"c",
				"alpha",
				"beta",
				"gamma"
			], t = [];
			n.forEach((n, r) => {
				n < 0 && t.push(e[r]);
			});
			let r = t.join(", ");
			throw Error(`Unit cell parameter entries negative in CIF for: ${r}`);
		}
		return new e(...n);
	}
	get a() {
		return this._a;
	}
	set a(e) {
		if (e <= 0) throw Error("Cell parameter 'a' must be positive");
		this._a = e, this.fractToCartMatrix = A(this);
	}
	get b() {
		return this._b;
	}
	set b(e) {
		if (e <= 0) throw Error("Cell parameter 'b' must be positive");
		this._b = e, this.fractToCartMatrix = A(this);
	}
	get c() {
		return this._c;
	}
	set c(e) {
		if (e <= 0) throw Error("Cell parameter 'c' must be positive");
		this._c = e, this.fractToCartMatrix = A(this);
	}
	get alpha() {
		return this._alpha;
	}
	set alpha(e) {
		if (e <= 0 || e >= 180) throw Error("Angle alpha must be between 0 and 180 degrees");
		this._alpha = e, this.fractToCartMatrix = A(this);
	}
	get beta() {
		return this._beta;
	}
	set beta(e) {
		if (e <= 0 || e >= 180) throw Error("Angle beta must be between 0 and 180 degrees");
		this._beta = e, this.fractToCartMatrix = A(this);
	}
	get gamma() {
		return this._gamma;
	}
	set gamma(e) {
		if (e <= 0 || e >= 180) throw Error("Angle gamma must be between 0 and 180 degrees");
		this._gamma = e, this.fractToCartMatrix = A(this);
	}
}, $ = class e {
	constructor(e, t, n, r = null, i = 0, a = null) {
		this.label = String(e), this.atomType = t, this.position = n, this.adp = r, this.disorderGroup = i, this.appliedSymmetry = a;
	}
	get uniqueId() {
		return this.appliedSymmetry ? `${this.label}|${this.appliedSymmetry.key}` : `${this.label}|1_555`;
	}
	isIdentityImage(e) {
		if (!this.appliedSymmetry) return !0;
		let t = `${e ?? "1"}_555`;
		return this.appliedSymmetry.key === t;
	}
	static fromCIF(t, n = null, r = null) {
		let i = t.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"]), o = n;
		if (n === null && r) o = a.indexOf(r);
		else if (n === null) throw Error("either atomIndex or atomLabel need to be provided");
		let s = a[o], c = [".", "?"];
		if (c.includes(s)) throw Error("Dummy atom: Invalid label");
		if (String(i.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], o, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		let l = i.getIndex(["_atom_site.type_symbol", "_atom_site_type_symbol"], o, !1);
		if (l ||= Ke(s), c.includes(l)) throw Error("Dummy atom: Invalid atom type");
		let u = ge.fromCIF(t, o), d = xe.fromCIF(t, o), f = i.getIndex(["_atom_site.disorder_group", "_atom_site_disorder_group"], o, ".");
		return new e(s, l, u, d, f === "." ? 0 : f);
	}
};
function Ye(e, t) {
	return e.disorderGroup === t.disorderGroup || e.disorderGroup === 0 || t.disorderGroup === 0;
}
//#endregion
export { w as A, k as C, S as D, oe as E, n as F, t as I, h as M, r as N, ie as O, o as P, T as S, b as T, M as _, Ke as a, pe as b, Be as c, V as d, L as f, j as g, be as h, Ye as i, l as j, ne as k, K as l, _e as m, Je as n, Ge as o, I as p, Q as r, ze as s, $ as t, B as u, me as v, E as w, C as x, he as y };
