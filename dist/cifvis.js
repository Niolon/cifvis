import * as e from "three";
import { BufferAttribute as t, BufferGeometry as n, Color as r, DynamicDrawUsage as i, Mesh as a, Sphere as o, Vector3 as s } from "three";
//#region src/lib/read-cif/helpers.js
function c(e, t = !0, n = 1) {
	let r = e.match(/^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)\((\d+)\)$/);
	if (t && r) {
		let [, e, t, n, i] = r, a = e === "-" ? -1 : 1, o = parseFloat(t), s = parseInt(n), c = t.includes(".") ? t.split(".")[1].length : 0, l = Number(a * o * 10 ** s), u = s - c, d = Number(parseInt(i) * 10 ** u);
		return c - s >= 0 && c - s <= 100 ? {
			value: Number(l.toFixed(c - s)),
			su: Number(d.toFixed(c - s))
		} : {
			value: l,
			su: d
		};
	}
	let i = e.match(/^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)$/);
	if (i) {
		let [, e, t, n] = i, r = e === "-" ? -1 : 1, a = t.includes(".") ? t.split(".")[1].length : 0, o = parseInt(n), s = Number(r * parseFloat(t) * 10 ** o);
		return a - o >= 0 && a - o <= 100 ? {
			value: Number(s.toFixed(a - o)),
			su: NaN
		} : {
			value: s,
			su: NaN
		};
	}
	let a = e.match(/^([+-]?)(\d+\.?\d*|\.\d+)\((\d+)\)$/);
	if (t && a) {
		let [, e, t, n] = a, r = e === "-" ? -1 : 1;
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
	return isNaN(e) ? n === 2 ? {
		value: e,
		su: NaN
	} : /^".*"$/.test(e) || /^'.*'$/.test(e) ? {
		value: e.slice(1, -1).replace(/\\([^\\])/g, "$1"),
		su: NaN
	} : {
		value: e.replace(/\\([^\\])/g, "$1"),
		su: NaN
	} : {
		value: e.includes(".") ? parseFloat(e) : parseInt(e),
		su: NaN
	};
}
function l(e, t) {
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
function u(e, t, n) {
	let r = e[t];
	if (!r) throw Error("Unexpected end of CIF2 value stream");
	switch (r.type) {
		case "value": {
			if (r.quoted) return {
				value: r.value,
				su: NaN,
				nextPos: t + 1
			};
			let e = c(r.value, n, 2);
			return {
				value: e.value,
				su: e.su,
				nextPos: t + 1
			};
		}
		case "listOpen": return d(e, t, n);
		case "tableOpen": return f(e, t, n);
		default: throw Error(`Unexpected token '${r.type}' where a CIF2 value was expected`);
	}
}
function d(e, t, n) {
	let r = [], i = t + 1;
	for (; e[i] && e[i].type !== "listClose";) {
		let t = u(e, i, n);
		r.push(t.value), i = t.nextPos;
	}
	if (!e[i]) throw Error("Unterminated CIF2 list value");
	return {
		value: r,
		su: NaN,
		nextPos: i + 1
	};
}
function f(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = t + 1;
	for (; e[i] && e[i].type !== "tableClose";) {
		let t = e[i];
		if (t.type !== "value") throw Error("CIF2 table key must be a quoted string");
		if (!e[i + 1] || e[i + 1].type !== "colon") throw Error(`CIF2 table entry for key '${t.value}' is missing its colon`);
		let a = u(e, i + 2, n);
		r.set(t.value, a.value), i = a.nextPos;
	}
	if (!e[i]) throw Error("Unterminated CIF2 table value");
	return {
		value: r,
		su: NaN,
		nextPos: i + 1
	};
}
function p(e, t) {
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
var m = /* @__PURE__ */ "_space_group_symop_ssg._space_group_symop._symmetry_equiv._geom_bond._geom_hbond._geom_angle._geom_torsion._diffrn_refln._refln._atom_site_fourier_wave_vector._atom_site_moment_fourier_param._atom_site_moment_special_func._atom_site_moment._atom_site_rotation._atom_site_displace_Fourier._atom_site_displace_special_func._atom_site_occ_Fourier._atom_site_occ_special_func._atom_site_phason._atom_site_rot_Fourier_param._atom_site_rot_Fourier._atom_site_rot_special_func._atom_site_U_Fourier._atom_site_anharm_gc_c._atom_site_anharm_gc_d._atom_site_aniso._atom_site".split("."), h = class e {
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
		let e = this._cif2CellTokenRanges === void 0 ? this.dataLines.reduce((e, t, n) => {
			if (t = t.trim(), !t.length) return e;
			if (t.startsWith(";")) {
				let t = l(this.dataLines, n);
				e.push({
					value: t.value,
					su: NaN
				});
				for (let e = n; e < t.endIndex + 1; e++) this.dataLines[e] = "";
				return e;
			}
			let r = Array.from(t.matchAll(/'([^']*(?:'\S[^']*)*)'|"([^"]*(?:"\S[^"]*)*)"|\S+/g));
			return e.concat(r.map((e) => c(e[1] || e[2] || e[0], this.splitSU)));
		}, []) : this._cif2CellTokenRanges.map(([e]) => {
			let t = u(this._cif2Tokens, e, this.splitSU);
			return {
				value: t.value,
				su: t.su
			};
		}), t = this.headers.length;
		if (e.length % t !== 0) {
			let n = e.map(({ value: e, su: t }) => `{value: ${e}, su: ${t}}`).join(", ");
			throw Error(`Loop ${this.name}: Cannot distribute ${e.length} values evenly into ${t} columns\nentries are: ${n}`);
		} else if (e.length === 0) throw Error(`Loop ${this.name} has no data values.`);
		for (let n = 0; n < t; n++) {
			let r = this.headers[n], i = e.slice(n).filter((e, n) => n % t === 0);
			i.some((e) => !isNaN(e.su)) ? (this.data[r] = i.map((e) => e.value), this.data[r + "_su"] = i.map((e) => e.su), this.headers.push(r + "_su")) : this.data[r] = i.map((e) => e.value);
		}
	}
	findCommonStart(e = !0) {
		if (e) {
			for (let e of m) if (this.headerLines.filter((t) => t.toLowerCase().startsWith(e.toLowerCase())).length >= this.headerLines.length / 2) return e;
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
function g(e) {
	return e && typeof e.getHeaders == "function";
}
function _(e) {
	return e.getHeaders()[0].split("_").filter((e) => e.length > 0);
}
function v(e, t, n) {
	let r = g(e) ? e : t, i = n.split("_").filter((e) => e.length > 0), a = _(r), o = "_" + i.join("_") + "_" + a[i.length];
	return g(e) ? [o, n] : [n, o];
}
function y(e, t) {
	let n = e.findCommonStart(!1), r = t.findCommonStart(!1);
	return n.length === r.length ? null : [n, r];
}
function b(e, t, n) {
	let r = n.split("_").filter((e) => e.length > 0), i = _(e), a = _(t);
	return i.length >= a.length ? [n + "_" + i[r.length], n] : [n, n + "_" + a[r.length]];
}
function x(e, t, n) {
	let r;
	r = !g(e) || !g(t) ? v(e, t, n) : y(e, t) || b(e, t, n);
	let i = [e, t];
	return i.forEach((e, t) => {
		g(e) && (e.name = r[t]);
	}), {
		newNames: r,
		newEntries: i
	};
}
//#endregion
//#region src/lib/read-cif/version.js
function S(e) {
	return e.charCodeAt(0) === 65279 ? e.slice(1) : e;
}
function C(e) {
	let t = S(e);
	return /^#\\#CIF_2\.0/.test(t) ? 2 : 1;
}
//#endregion
//#region src/lib/read-cif/tokenizer.js
var w = /* @__PURE__ */ new Set([
	" ",
	"	",
	"\r",
	"\n"
]), T = /* @__PURE__ */ new Set([
	"[",
	"]",
	"{",
	"}"
]);
function E(e, t, n, r) {
	if (e[t + 1] === n && e[t + 2] === n) {
		let i = n + n + n, a = e.indexOf(i, t + 3);
		if (a === -1) throw Error(`Unterminated triple-quoted string starting on line ${r}`);
		let o = e.slice(t + 3, a);
		return {
			value: o,
			next: a + 3,
			newlines: O(o)
		};
	}
	let i = e.indexOf(n, t + 1), a = e.indexOf("\n", t + 1);
	if (i === -1 || a !== -1 && a < i) throw Error(`Unterminated quoted string starting on line ${r}`);
	return {
		value: e.slice(t + 1, i),
		next: i + 1,
		newlines: 0
	};
}
function D(e, t, n) {
	let r = e.indexOf("\n;", t);
	if (r === -1) throw Error(`Unterminated text field starting on line ${n}`);
	let i = e.slice(t + 1, r);
	return i.startsWith("\n") && (i = i.slice(1)), {
		value: i,
		next: r + 2,
		newlines: O(e.slice(t, r + 2))
	};
}
function O(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] === "\n" && t++;
	return t;
}
function k(e, t) {
	let n = e.toLowerCase();
	return n === "loop_" ? {
		type: "loop",
		line: t
	} : n === "save_" ? {
		type: "saveEnd",
		line: t
	} : n === "global_" ? {
		type: "global",
		line: t
	} : n === "stop_" ? {
		type: "stop",
		line: t
	} : n.startsWith("data_") ? {
		type: "data",
		value: e.slice(5),
		line: t
	} : n.startsWith("save_") ? {
		type: "save",
		value: e.slice(5),
		line: t
	} : e[0] === "_" ? {
		type: "tag",
		value: e,
		line: t
	} : {
		type: "value",
		value: e,
		quoted: !1,
		line: t
	};
}
function A(e) {
	let t = e.replace(/\r\n?/g, "\n"), n = [], r = t.length, i = 0, a = 1, o = !0;
	for (; i < r;) {
		let e = t[i];
		if (e === "\n") {
			i++, a++, o = !0;
			continue;
		}
		if (w.has(e)) {
			i++, o = !1;
			continue;
		}
		if (e === "#") {
			for (; i < r && t[i] !== "\n";) i++;
			continue;
		}
		if (e === ";" && o) {
			let e = D(t, i, a);
			n.push({
				type: "value",
				value: e.value,
				quoted: !0,
				line: a
			}), i = e.next, a += e.newlines, o = !1;
			continue;
		}
		if (T.has(e)) {
			let t = {
				"[": "listOpen",
				"]": "listClose",
				"{": "tableOpen",
				"}": "tableClose"
			}[e];
			n.push({
				type: t,
				line: a
			}), i++, o = !1;
			continue;
		}
		if (e === "'" || e === "\"") {
			let r = E(t, i, e, a);
			n.push({
				type: "value",
				value: r.value,
				quoted: !0,
				line: a
			}), i = r.next, a += r.newlines, o = !1, t[i] === ":" && (n.push({
				type: "colon",
				line: a
			}), i++);
			continue;
		}
		let s = i;
		for (; i < r && !w.has(t[i]) && !T.has(t[i]);) i++;
		n.push(k(t.slice(s, i), a)), o = !1;
	}
	return n;
}
//#endregion
//#region src/lib/read-cif/base.js
function ee(e) {
	let t = [], n = null, r = 0;
	for (let i of e) i.type === "listOpen" || i.type === "tableOpen" ? r++ : (i.type === "listClose" || i.type === "tableClose") && r--, i.type === "data" && r === 0 ? (n = [i], t.push(n)) : n && n.push(i);
	return t;
}
var j = class {
	constructor(e, t = !0) {
		this.splitSU = t;
		let n = S(e);
		this.version = C(n), this.rawCifBlocks = this.version === 2 ? ee(A(n)) : this.splitCifBlocks("\n\n" + n), this.blocks = Array(this.rawCifBlocks.length).fill(null), this._blockNameMap = null;
	}
	splitCifBlocks(e) {
		let t = [], n = e.replaceAll("\r\n", "\n").split(/\r?\ndata_/).slice(1), r = 0;
		for (; r < n.length;) {
			let e = n[r], i = /\n;/g, a = e.match(i), o = a ? a.length : 0;
			for (; o % 2 == 1 && r + 1 < n.length;) r++, e += "\ndata_" + n[r], o = e.match(i).length;
			t.push(e), r++;
		}
		return t;
	}
	getBlock(e = 0) {
		if (e < 0 || e >= this.rawCifBlocks.length) throw Error(`Block index ${e} out of range. This CIF has ${this.rawCifBlocks.length} block(s).`);
		return this.blocks[e] || (this.blocks[e] = new te(this.rawCifBlocks[e], this.splitSU, this.version)), this.blocks[e];
	}
	getAllBlocks() {
		for (let e = 0; e < this.blocks.length; e++) this.blocks[e] || (this.blocks[e] = new te(this.rawCifBlocks[e], this.splitSU, this.version));
		return this.blocks;
	}
	_extractBlockNames() {
		if (this._blockNameMap !== null) return this._blockNameMap;
		if (this._blockNameMap = /* @__PURE__ */ new Map(), this.version === 2) return this.rawCifBlocks.forEach((e, t) => {
			e[0] && e[0].type === "data" && this._blockNameMap.set(e[0].value, t);
		}), this._blockNameMap;
		let e = /^(\w+[\w.-]*)/;
		return this.rawCifBlocks.forEach((t, n) => {
			let r = e.exec(t.trim());
			r && r[1] && this._blockNameMap.set(r[1], n);
		}), this._blockNameMap;
	}
	getBlockNames() {
		return Array.from(this._extractBlockNames().keys());
	}
	getBlockByName(e) {
		let t = this._extractBlockNames().get(e);
		if (t === void 0) throw Error(`Block with name '${e}' not found. Available blocks: ${this.getBlockNames().join(", ")}`);
		return this.getBlock(t);
	}
}, te = class {
	constructor(e, t = !0, n = 1) {
		this.splitSU = t, this.version = n, n === 2 ? (this.tokens = e, this.rawText = null) : (this.rawText = e, this.tokens = null), this.data = null, this.dataBlockName = null;
	}
	parse() {
		if (this.data !== null) return;
		if (this.version === 2) {
			this.parseV2();
			return;
		}
		this.data = {};
		let e = this.rawText.split("\n").filter((e) => !e.trim().startsWith("#")).map((e) => e.split(/ #(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/)[0]);
		this.dataBlockName = e[0];
		let t = 1;
		for (; t < e.length;) {
			if (t + 1 < e.length && e[t + 1].startsWith(";")) {
				let n = l(e, t + 1);
				this.data[e[t]] = n.value, t = n.endIndex + 1;
				continue;
			}
			if (e[t].trim().startsWith("loop_")) {
				let n = h.fromLines(e.slice(t), this.splitSU);
				if (!Object.prototype.hasOwnProperty.call(this.data, n.getName())) this.data[n.getName()] = n;
				else {
					let e = x(this.data[n.getName()], n, n.getName());
					this.data[e.newNames[0]] = e.newEntries[0], this.data[e.newNames[1]] = e.newEntries[1];
				}
				t += n.getEndIndex();
				continue;
			}
			let n = e[t].trim();
			if (n.length === 0) {
				t++;
				continue;
			}
			let r = n.match(/^(_\S+)\s+(.*)$/);
			if (r) {
				let e = r[1], t = c(r[2], this.splitSU);
				this.data[e] = t.value, isNaN(t.su) || (this.data[e + "_su"] = t.su);
			} else if (n.startsWith("_") && !e[t + 1].startsWith("_")) {
				let r = n, i = c(e[t + 1].trim(), this.splitSU);
				this.data[r] = i.value, isNaN(i.su) || (this.data[r + "_su"] = i.su), t++;
			} else throw Error("Could not parse line " + String(t) + ": " + e[t]);
			t++;
		}
	}
	parseV2() {
		this.data = {};
		let e = this.tokens;
		this.dataBlockName = e[0] && e[0].type === "data" ? e[0].value : null;
		let t = 1, n = 0;
		for (; t < e.length;) {
			let r = e[t];
			if (r.type === "save") {
				n++, t++;
				continue;
			}
			if (r.type === "saveEnd") {
				n > 0 && n--, t++;
				continue;
			}
			if (n > 0 || r.type === "global" || r.type === "stop") {
				t++;
				continue;
			}
			if (r.type === "tag") {
				let n = u(e, t + 1, this.splitSU);
				this.data[r.value] = n.value, isNaN(n.su) || (this.data[r.value + "_su"] = n.su), t = n.nextPos;
				continue;
			}
			if (r.type === "loop") {
				t = this.parseLoopV2(e, t);
				continue;
			}
			t++;
		}
	}
	parseLoopV2(e, t) {
		let n = t + 1, r = [];
		for (; n < e.length && e[n].type === "tag";) r.push(e[n].value), n++;
		let i = [];
		for (; n < e.length && (e[n].type === "value" || e[n].type === "listOpen" || e[n].type === "tableOpen");) {
			let t = n;
			n = p(e, n), i.push([t, n]);
		}
		let a = h.fromTokens(r, e, i, this.splitSU);
		if (!Object.prototype.hasOwnProperty.call(this.data, a.getName())) this.data[a.getName()] = a;
		else {
			let e = x(this.data[a.getName()], a, a.getName());
			this.data[e.newNames[0]] = e.newEntries[0], this.data[e.newNames[1]] = e.newEntries[1];
		}
		return n;
	}
	get dataBlockName() {
		return this._dataBlockName || this.parse(), this._dataBlockName;
	}
	set dataBlockName(e) {
		this._dataBlockName = e;
	}
	get(e, t = null) {
		this.parse();
		let n = Array.isArray(e) ? e : [e];
		for (let e of n) {
			let t = this.data[e];
			if (t !== void 0) return t;
		}
		if (t !== null) return t;
		throw Error(`None of the keys [${n.join(", ")}] found in CIF block`);
	}
}, M = class e {
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
function N(e) {
	return e instanceof M ? N(e.toArray()) : Array.isArray(e) ? e.map(N) : e;
}
function P(e, t) {
	return e.some((e) => e instanceof M) ? new M(t) : t;
}
function ne(e, t, n) {
	return Array.isArray(e) && Array.isArray(t) ? e.map((e, r) => ne(e, t[r], n)) : n(e, t);
}
function F(e) {
	return new M(N(e));
}
function I(e, t) {
	let n = N(e), r = N(t), i;
	if (typeof r == "number") i = Array.isArray(n[0]) ? n.map((e) => e.map((e) => e * r)) : n.map((e) => e * r);
	else if (typeof n == "number") i = Array.isArray(r[0]) ? r.map((e) => e.map((e) => e * n)) : r.map((e) => e * n);
	else if (Array.isArray(n[0]) && Array.isArray(r[0])) i = n.map((e, t) => e.map((i, a) => e.reduce((e, i, o) => e + n[t][o] * r[o][a], 0)));
	else if (Array.isArray(n[0])) i = n.map((e) => e.reduce((e, t, n) => e + t * r[n], 0));
	else throw Error("multiply: unsupported operand shapes");
	return P([e, t], i);
}
function re(e, t) {
	return P([e, t], ne(N(e), N(t), (e, t) => e + t));
}
function ie(e, t) {
	return P([e, t], ne(N(e), N(t), (e, t) => e - t));
}
function L(e) {
	let t = N(e), n = t[0].map((e, n) => t.map((e) => e[n]));
	return P([e], n);
}
function ae(e) {
	let t = N(e);
	if (t.length !== 3) throw Error("det: only 3x3 matrices are supported");
	return t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0]) + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0]);
}
function R(e) {
	let t = N(e);
	if (t.length !== 3) throw Error("inv: only 3x3 matrices are supported");
	let n = ae(t);
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
	return P([e], i);
}
function oe(e) {
	let t = N(e), n = t.length, r = Array.from({ length: n }, (e, r) => Array.from({ length: n }, (e, n) => r === n ? t[r] : 0));
	return P([e], r);
}
function se(e) {
	let t = N(e);
	return Math.sqrt(t.reduce((e, t) => e + t * t, 0));
}
function ce(e, t) {
	if (t !== "deg") throw Error(`unit: unsupported unit '${t}'`);
	return { toNumber(t) {
		if (t !== "rad") throw Error(`unit: unsupported conversion to '${t}'`);
		return e * Math.PI / 180;
	} };
}
function le(e) {
	return Array.from({ length: e }, (t, n) => Array.from({ length: e }, (e, t) => +(n === t)));
}
function ue(e) {
	return Array(e).fill(0);
}
function de(e) {
	let t = N(e), n = Array.isArray(t[0]) ? t.map((e) => [...e]) : [...t];
	return P([e], n);
}
function fe(e, t) {
	return ne(N(e), N(t), (e, t) => e === t);
}
var pe = Math.abs, me = (e) => Math.min(...N(e));
function he(e) {
	let t = e.map((e) => [...e]), n = le(3);
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
function ge(e) {
	let { eigenvalues: t, eigenvectors: n } = he(N(e));
	return {
		values: t,
		eigenvectors: t.map((e, t) => ({
			value: e,
			vector: new M(n[t])
		}))
	};
}
//#endregion
//#region src/lib/structure/fract-to-cart.js
function _e(e) {
	let t = ce(e.alpha, "deg").toNumber("rad"), n = ce(e.beta, "deg").toNumber("rad"), r = ce(e.gamma, "deg").toNumber("rad"), i = Math.cos(t), a = Math.cos(n), o = Math.cos(r), s = Math.sin(r), c = Math.sqrt(1 - i * i - a * a - o * o + 2 * i * a * o);
	return F([
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
function ve(e) {
	return F([
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
function ye(e) {
	let t = F(e);
	return [
		t.get([0, 0]),
		t.get([1, 1]),
		t.get([2, 2]),
		t.get([0, 1]),
		t.get([0, 2]),
		t.get([1, 2])
	];
}
function be(e, t) {
	let n = F(e), r = oe(F(L(L(R(n))).toArray().map((e) => se(e))));
	return ye(I(I(n, I(I(r, ve(t)), L(r))), L(n)));
}
//#endregion
//#region src/lib/structure/position.js
var xe = class e {
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
}, Se = class extends xe {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return new Ce(...I(e.fractToCartMatrix, F([
			this.x,
			this.y,
			this.z
		])).toArray());
	}
}, Ce = class extends xe {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return this;
	}
}, we = class {
	static fromCIF(e, t) {
		let n = !1, r = e.get("_atom_site"), i = [".", "?"];
		if (String(r.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], t, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		try {
			let e = r.getIndex(["_atom_site.fract_x", "_atom_site_fract_x"], t), a = r.getIndex(["_atom_site.fract_y", "_atom_site_fract_y"], t), o = r.getIndex(["_atom_site.fract_z", "_atom_site_fract_z"], t);
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new Se(e, a, o);
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
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new Ce(e, a, o);
			n = !0;
		} catch {}
		throw Error(n ? "Dummy atom: Invalid position" : "Invalid position: No valid fractional or Cartesian coordinates found");
	}
}, z = class e {
	constructor(e) {
		this.uiso = e;
	}
	static fromBiso(t) {
		return new e(t / (8 * Math.PI * Math.PI));
	}
}, B = class e {
	constructor(e, t, n, r, i, a) {
		this.u11 = e, this.u22 = t, this.u33 = n, this.u12 = r, this.u13 = i, this.u23 = a;
	}
	static fromBani(t, n, r, i, a, o) {
		let s = 1 / (8 * Math.PI * Math.PI);
		return new e(t * s, n * s, r * s, i * s, a * s, o * s);
	}
	getUCart(e) {
		return be(e.fractToCartMatrix, [
			this.u11,
			this.u22,
			this.u33,
			this.u12,
			this.u13,
			this.u23
		]);
	}
	getEllipsoidMatrix(e) {
		let { eigenvectors: t } = ge(ve(this.getUCart(e))), n = L(F(t.map((e) => e.vector))), r = F(t.map((e) => e.value > 0 ? e.value : NaN)), i = ae(n), a = oe(r.map(Math.sqrt)), o;
		return o = pe(i - 1) > 1e-10 ? I(I(n, 1 / i), a) : I(n, a), F(o);
	}
}, Te = class e {
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
		].some(isNaN) ? null : new B(i, a, o, s, c, l);
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
		].some(isNaN) ? null : B.fromBani(i, a, o, s, c, l);
	}
	static createUiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : new z(n);
		} catch {
			return null;
		}
	}
	static createBiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.b_iso_or_equiv", "_atom_site_B_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : z.fromBiso(n);
		} catch {
			return null;
		}
	}
};
//#endregion
//#region src/lib/structure/position-code.js
function Ee(e) {
	if (e == null || e === "." || e === "?") return ".";
	let t = String(e).trim();
	return t === "" || t === "." || t === "?" ? "." : t.includes("_") ? t : `${t}_555`;
}
function De(e) {
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
function Oe(e, t) {
	let n = String(e);
	if (!n || n.includes("_")) throw Error(`Invalid symmetry operation ID: ${e}`);
	if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isInteger)) throw Error(`Invalid symmetry translation: ${t}`);
	let r = t.map((e) => e + 5);
	return r.every((e) => e >= 0 && e <= 9) ? `${n}_${r.join("")}` : `${n}_[${t.join(",")}]`;
}
//#endregion
//#region src/lib/structure/cell-symmetry.js
function ke(e) {
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
var Ae = class e {
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
			let i = /([+-]?\d*\.?\d*(?:\/\d+)?)\*?([XYZ])/g, a;
			for (; (a = i.exec(e)) !== null;) {
				let e = a[1], n = a[2];
				if (!e || e === "+") e = "1";
				else if (e === "-") e = "-1";
				else if (e.includes("/")) {
					let [t, n] = e.split("/");
					e = parseFloat(t) / parseFloat(n);
				}
				e = parseFloat(e);
				let i = n === "X" ? 0 : n === "Y" ? 1 : 2;
				t[r][i] = e;
			}
			let o = e.replace(/[+-]?\d*\.?\d*(?:\/\d+)?\*?[XYZ]/g, "").match(/[+-]?\d*\.?\d+(?:\/\d+)?/g) || [];
			for (let e of o) if (e.includes("/")) {
				let [t, i] = e.split("/");
				n[r] += parseFloat(t) / parseFloat(i);
			} else n[r] += parseFloat(e);
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
		let t = re(I(this.rotMatrix, e), this.transVector);
		return Array.isArray(t) ? t : t.toArray();
	}
	applyToAtom(e) {
		let t = new Se(...re(I(this.rotMatrix, [
			e.position.x,
			e.position.y,
			e.position.z
		]), this.transVector)), n = null;
		if (e.adp && e.adp instanceof B) {
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
			], r = this.rotMatrix, i = L(r), a = I(I(r, t), i);
			n = new B(a[0][0], a[1][1], a[2][2], a[0][1], a[0][2], a[1][2]);
		} else e.adp && e.adp instanceof z && (n = new z(e.adp.uiso));
		return new ze(e.label, e.atomType, t, n, e.disorderGroup);
	}
	applyToAtoms(e) {
		return e.map((e) => this.applyToAtom(e));
	}
	copy() {
		let t = new e("x,y,z");
		return t.rotMatrix = de(this.rotMatrix), t.transVector = de(this.transVector), t;
	}
	toSymmetryString(e = null) {
		let t = [
			"x",
			"y",
			"z"
		], n = [], r = e ? re(this.transVector, e) : this.transVector;
		for (let e = 0; e < 3; e++) {
			let i = "", a = [];
			for (let n = 0; n < 3; n++) {
				let r = this.rotMatrix[e][n];
				if (Math.abs(r) > 1e-10) if (Math.abs(Math.abs(r) - 1) < 1e-10) a.push(r > 0 ? t[n] : `-${t[n]}`);
				else {
					let e = ke(Math.abs(r));
					a.push(r > 0 ? `${e}${t[n]}` : `-${e}${t[n]}`);
				}
			}
			if (i = a.join("+"), i === "" && (i = "0"), Math.abs(r[e]) > 1e-10) {
				let t = ke(Math.abs(r[e])), n = r[e] < 0 ? `-${t}` : t;
				i = i === "0" ? n : i.startsWith("-") ? `${n}${i}` : `${n}+${i}`;
			}
			n.push(i);
		}
		return n.join(",");
	}
}, je = class e {
	constructor(e, t, n, r = null) {
		this.spaceGroupName = e, this.spaceGroupNumber = t, this.symmetryOperations = n, this.operationIds = r || new Map(n.map((e, t) => [(t + 1).toString(), t])), this.identitySymOpId = Array.from(this.operationIds.entries()).find(([e, t]) => {
			let n = this.symmetryOperations[t];
			return fe(n.rotMatrix, le(3)) && fe(n.transVector, ue(3));
		})?.[0], this._combineSymmetryCodesCache = /* @__PURE__ */ new Map(), this._rotationMatrixIndex = /* @__PURE__ */ new Map(), this._buildRotationIndex();
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
		let n = this._hashCode(e), r = this._hashCode(t);
		return n << 16 | r & 65535;
	}
	_hashCode(e) {
		let t = 0;
		for (let n = 0; n < e.length; n++) {
			let r = e.charCodeAt(n);
			t = (t << 5) - t + r, t &= t;
		}
		return t;
	}
	generateEquivalentPositions(e) {
		return this.symmetryOperations.map((t) => t.applyToPoint(e));
	}
	parsePositionCode(e) {
		let { id: t, translation: n } = De(e), r = this.operationIds.get(t);
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
		let { symOp: i, transVector: a } = this.parsePositionCode(e), { symOp: o, transVector: s } = this.parsePositionCode(t), c = [
			a[0] + i.transVector[0],
			a[1] + i.transVector[1],
			a[2] + i.transVector[2]
		], l = [
			s[0] + o.transVector[0],
			s[1] + o.transVector[1],
			s[2] + o.transVector[2]
		], u = this._multiplyMatrices3x3(i.rotMatrix, o.rotMatrix), d = this._multiplyMatrixVector3x3(i.rotMatrix, l), f = [
			c[0] + d[0],
			c[1] + d[1],
			c[2] + d[2]
		], p = this._matrixToKey(u), m = this._rotationMatrixIndex.get(p);
		if (!m) throw Error(`No matching symmetry operation found for combined position codes: ${e} and ${t}`);
		for (let e of m) {
			let t = this.symmetryOperations[e], r = [
				f[0] - t.transVector[0],
				f[1] - t.transVector[1],
				f[2] - t.transVector[2]
			];
			if (r.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) {
				let t = null;
				for (let [n, r] of this.operationIds.entries()) if (r === e) {
					t = n;
					break;
				}
				let i = r.map((e) => Math.round(e)), a = Oe(t, i);
				return this._combineSymmetryCodesCache.set(n, a), a;
			}
		}
		throw Error(`No matching symmetry operation found for combined position codes: ${e} and ${t}`);
	}
	invertPositionCode(e) {
		let { symOp: t, transVector: n } = this.parsePositionCode(e), r = [
			n[0] + t.transVector[0],
			n[1] + t.transVector[1],
			n[2] + t.transVector[2]
		], i = R(t.rotMatrix), a = this._multiplyMatrixVector3x3(i, r.map((e) => -e)), o = this._rotationMatrixIndex.get(this._matrixToKey(i));
		if (o) for (let e of o) {
			let t = this.symmetryOperations[e], n = a.map((e, n) => e - t.transVector[n]);
			if (!n.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) continue;
			let r = Array.from(this.operationIds.entries()).find(([, t]) => t === e)?.[0];
			return Oe(r, n.map((e) => Math.round(e)));
		}
		throw Error(`No inverse symmetry operation found for position code: ${e}`);
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
			Math.abs(e.position.x - t[r].position.x) * n.a < .001 && Math.abs(e.position.y - t[r].position.y) * n.b < .001 && Math.abs(e.position.z - t[r].position.z) * n.c < .001 ? i.push(e.label) : a.push(e);
		}), {
			atoms: a,
			specialPositions: i
		};
	}
	static fromCIF(t) {
		let n = t.get([
			"_space_group.name_h-m_alt",
			"_space_group.name_H-M_full",
			"_symmetry_space_group_name_H-M",
			"_space_group_name_H-M_alt"
		], "Unknown"), r = t.get([
			"_space_group.it_number",
			"_space_group.IT_number",
			"_symmetry_Int_Tables_number",
			"_space_group_IT_number"
		], 0), i = t.get([
			"_space_group_symop",
			"_symmetry_equiv",
			"_symmetry_equiv_pos",
			"_space_group_symop.operation_xyz",
			"_space_group_symop_operation_xyz",
			"_symmetry_equiv.pos_as_xyz",
			"_symmetry_equiv_pos_as_xyz"
		], !1);
		if (i && !(i instanceof h)) return new e(n, r, [new Ae(i)]);
		if (i || console.warn(Object.keys(t).filter((e) => e.includes("sym"))), i) {
			let t = i.get([
				"_space_group_symop.operation_xyz",
				"_space_group_symop_operation_xyz",
				"_symmetry_equiv.pos_as_xyz",
				"_symmetry_equiv_pos_as_xyz"
			]), a = null;
			try {
				let e = i.get([
					"_space_group_symop.id",
					"_space_group_symop_id",
					"_symmetry_equiv.id",
					"_symmetry_equiv_pos_site_id"
				]);
				a = new Map(e.map((e, t) => [e.toString(), t]));
			} catch {}
			let o = t.map((e) => new Ae(e));
			return new e(n, r, o, a);
		} else return console.warn("No symmetry operations found in CIF block, will use P1"), new e("Unknown", 0, [new Ae("x,y,z")]);
	}
};
//#endregion
//#region src/lib/structure/bonds.js
function Me(e) {
	return String(e).split("|")[0];
}
function Ne(e, t = "1_555") {
	let n = String(e);
	return n.includes("|") ? n : `${n}|${t}`;
}
var V = class e {
	constructor(e, t, n = null, r = null, i = null) {
		let a = Ee(i);
		this.atom1Id = Ne(e), this.atom2Id = Ne(t, a === "." ? "1_555" : a), this.bondLength = n, this.bondLengthSU = r, this.atom2SiteSymmetry = a;
	}
	get atom1Label() {
		return Me(this.atom1Id);
	}
	get atom2Label() {
		return Me(this.atom2Id);
	}
	static fromCIF(t, n) {
		let r = t.get("_geom_bond"), i = r.getIndex(["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"], n, "."), a = r.getIndex(["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"], n, !1);
		a && a === i && (i = "."), i = Ee(i);
		let o = `${r.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], n)}|1_555`, s = r.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], n), c = i === "?" ? "." : i, l = `${s}|${c === "." ? "1_555" : c}`;
		return new e(o, l, r.getIndex(["_geom_bond.distance", "_geom_bond_distance"], n), r.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], n, NaN), c);
	}
}, H = class e {
	constructor(e, t, n, r, i, a, o, s, c, l, u, d) {
		let f = Ee(d);
		this.donorAtomId = Ne(e), this.hydrogenAtomId = Ne(t), this.acceptorAtomId = Ne(n, f === "." ? "1_555" : f), this.donorHydrogenDistance = r, this.donorHydrogenDistanceSU = i, this.acceptorHydrogenDistance = a, this.acceptorHydrogenDistanceSU = o, this.donorAcceptorDistance = s, this.donorAcceptorDistanceSU = c, this.hBondAngle = l, this.hBondAngleSU = u, this.acceptorAtomSymmetry = f;
	}
	get donorAtomLabel() {
		return Me(this.donorAtomId);
	}
	get hydrogenAtomLabel() {
		return Me(this.hydrogenAtomId);
	}
	get acceptorAtomLabel() {
		return Me(this.acceptorAtomId);
	}
	static fromCIF(t, n) {
		let r = t.get("_geom_hbond"), i = r.getIndex(["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"], n, "."), a = `${r.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], n)}|1_555`, o = `${r.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], n)}|1_555`, s = r.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], n), c = Ee(i), l = `${s}|${c === "." ? "1_555" : c}`;
		return new e(a, o, l, r.getIndex(["_geom_hbond.distance_dh", "_geom_hbond_distance_DH"], n, NaN), r.getIndex(["_geom_hbond.distance_dh_su", "_geom_hbond_distance_DH_su"], n, NaN), r.getIndex(["_geom_hbond.distance_ha", "_geom_hbond_distance_HA"], n, NaN), r.getIndex(["_geom_hbond.distance_ha_su", "_geom_hbond_distance_HA_su"], n, NaN), r.getIndex(["_geom_hbond.distance_da", "_geom_hbond_distance_DA"], n, NaN), r.getIndex(["_geom_hbond.distance_da_su", "_geom_hbond_distance_DA_su"], n, NaN), r.getIndex(["_geom_hbond.angle_dha", "_geom_hbond_angle_DHA"], n, NaN), r.getIndex(["_geom_hbond.angle_dha_su", "_geom_hbond_angle_DHA_su"], n, NaN), c);
	}
}, Pe = class {
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
}, Fe = class e {
	static createBonds(t, n) {
		try {
			let r = t.get("_geom_bond"), i = r.get(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]).length, a = [];
			for (let o = 0; o < i; o++) {
				let i = r.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], o), s = r.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], o);
				e.isValidBondPair(i, s, n) && a.push(V.fromCIF(t, o));
			}
			return a;
		} catch {
			return [];
		}
	}
	static createHBonds(t, n) {
		let r = t.get("_geom_hbond", !1);
		if (!r) return [];
		let i = r.get(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]).length, a = [];
		for (let o = 0; o < i; o++) {
			let i = r.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], o, "?"), s = r.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], o, "?"), c = r.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], o, "?");
			e.isValidHBondTriplet(i, s, c, n) && a.push(H.fromCIF(t, o));
		}
		return a;
	}
	static validateBonds(e, t, n) {
		let r = new Pe(), i = new Set(t.map((e) => e.label));
		for (let t of e) {
			let e = [], a = t.atom1Id.split("|")[0], o = t.atom2Id.split("|")[0];
			if (i.has(a) || e.push(a), i.has(o) || e.push(o), e.length > 0 && r.addAtomLabelError(`Non-existent atoms in bond: ${t.atom1Label} - ${t.atom2Label}, non-existent atom(s): ${e.join(", ")}`), t.atom2SiteSymmetry && t.atom2SiteSymmetry !== ".") try {
				n.parsePositionCode(t.atom2SiteSymmetry);
			} catch {
				r.addSymmetryError(`Invalid symmetry in bond: ${t.atom1Label} - ${t.atom2Label}, invalid symmetry operation: ${t.atom2SiteSymmetry}`);
			}
		}
		return r;
	}
	static validateHBonds(e, t, n) {
		let r = new Pe(), i = new Set(t.map((e) => e.label));
		for (let t of e) {
			let e = [], a = t.donorAtomId.split("|")[0], o = t.hydrogenAtomId.split("|")[0], s = t.acceptorAtomId.split("|")[0];
			if (i.has(a) || e.push(a), i.has(o) || e.push(o), i.has(s) || e.push(s), e.length > 0 && r.addAtomLabelError(`Non-existent atoms in H-bond: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, non-existent atom(s): ${e.join(", ")}`), t.acceptorAtomSymmetry && t.acceptorAtomSymmetry !== ".") try {
				n.parsePositionCode(t.acceptorAtomSymmetry);
			} catch {
				r.addSymmetryError(`Invalid symmetry in H-bond: ${t.donorAtomLabel} - ${t.hydrogenAtomLabel} - ${t.acceptorAtomLabel}, invalid symmetry operation: ${t.acceptorAtomSymmetry}`);
			}
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
};
//#endregion
//#region src/lib/structure/crystal.js
function Ie(e) {
	if (!e || typeof e != "string") throw Error(`Invalid atom label: ${e}`);
	let t = e.toUpperCase(), n = RegExp(`^(${(/* @__PURE__ */ "HE.LI.BE.NE.NA.MG.AL.SI.CL.AR.CA.SC.TI.CR.MN.FE.CO.NI.CU.ZN.GA.GE.AS.SE.BR.KR.RB.SR.ZR.NB.MO.TC.RU.RH.PD.AG.CD.IN.SN.SB.TE.XE.CS.BA.LA.CE.PR.ND.PM.SM.EU.GD.TB.DY.HO.ER.TM.YB.LU.HF.TA.RE.OS.IR.PT.AU.HG.TL.PB.BI.PO.AT.RN.FR.RA.AC.TH.PA.NP.PU.AM.CM".split(".")).join("|")})`), r = t.match(n);
	if (r) return Le(r[1]);
	let i = t.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
	if (i) return Le(i[1]);
	throw Error(`Could not infer element type from atom label: ${e}`);
}
function Le(e) {
	return e.length === 1 ? e : e[0] + e[1].toLowerCase();
}
var U = class e {
	constructor(e, t, n = [], r = [], i = null) {
		this.cell = e, this.atoms = t, this.bonds = n, this.hBonds = r, this.symmetry = i || new je("None", 0, [new Ae("x,y,z")]);
	}
	static fromCIF(t) {
		let n = Re.fromCIF(t), r = t.get("_atom_site").get(["_atom_site.label", "_atom_site_label"]), i = Array.from({ length: r.length }, (e, n) => {
			try {
				return ze.fromCIF(t, n);
			} catch (e) {
				if (e.message.includes("Dummy atom")) return null;
				throw e;
			}
		}).filter((e) => e !== null);
		if (i.length === 0) throw Error("The cif file contains no valid atoms.");
		let a = new Set(i.map((e) => e.label)), o = Fe.createBonds(t, a), s = Fe.createHBonds(t, a), c = je.fromCIF(t), l = Fe.validateBonds(o, i, c), u = Fe.validateHBonds(s, i, c);
		if (!l.isValid() || !u.isValid()) {
			let e = "There were errors in the bond or H-bond creation\n", t = l.report(i, c), n = u.report(i, c);
			throw t.length !== 0 && n.length !== 0 ? Error(e + t + "\n" + n) : Error(e + t + n);
		}
		return new e(n, i, o, s, c);
	}
	getAtomById(e) {
		for (let t of this.atoms) if (t.uniqueId === e) return t;
		if (!e.includes("|")) {
			for (let t of this.atoms) if (t.label === e && !t.appliedSymmetry) return t;
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
			e.has(r) || e.set(r, n), !n.appliedSymmetry && !t.has(n.label) && t.set(n.label, n);
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
			let t = e.donorAtomId || e.donorAtomLabel, i = e.acceptorAtomId || e.acceptorAtomLabel, o = n(t), s = n(i);
			!o || !s || e.acceptorAtomSymmetry !== "." && e.acceptorAtomSymmetry !== null || (a(o).hBonds.add(e), r.has(s.uniqueId) && a(s).hBonds.add(e));
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
}, Re = class e {
	constructor(e, t, n, r, i, a) {
		this._a = e, this._b = t, this._c = n, this._alpha = r, this._beta = i, this._gamma = a, this.fractToCartMatrix = _e(this);
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
		this._a = e, this.fractToCartMatrix = _e(this);
	}
	get b() {
		return this._b;
	}
	set b(e) {
		if (e <= 0) throw Error("Cell parameter 'b' must be positive");
		this._b = e, this.fractToCartMatrix = _e(this);
	}
	get c() {
		return this._c;
	}
	set c(e) {
		if (e <= 0) throw Error("Cell parameter 'c' must be positive");
		this._c = e, this.fractToCartMatrix = _e(this);
	}
	get alpha() {
		return this._alpha;
	}
	set alpha(e) {
		if (e <= 0 || e >= 180) throw Error("Angle alpha must be between 0 and 180 degrees");
		this._alpha = e, this.fractToCartMatrix = _e(this);
	}
	get beta() {
		return this._beta;
	}
	set beta(e) {
		if (e <= 0 || e >= 180) throw Error("Angle beta must be between 0 and 180 degrees");
		this._beta = e, this.fractToCartMatrix = _e(this);
	}
	get gamma() {
		return this._gamma;
	}
	set gamma(e) {
		if (e <= 0 || e >= 180) throw Error("Angle gamma must be between 0 and 180 degrees");
		this._gamma = e, this.fractToCartMatrix = _e(this);
	}
}, ze = class e {
	constructor(e, t, n, r = null, i = 0, a = null) {
		this.label = String(e), this.atomType = t, this.position = n, this.adp = r, this.disorderGroup = i, this.appliedSymmetry = a;
	}
	get uniqueId() {
		return this.appliedSymmetry ? `${this.label}|${this.appliedSymmetry.key}` : `${this.label}|1_555`;
	}
	static fromCIF(t, n = null, r = null) {
		let i = t.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"]), o = n;
		if (n === null && r) o = a.indexOf(r);
		else if (n === null) throw Error("either atomIndex or atomLabel need to be provided");
		let s = a[o], c = [".", "?"];
		if (c.includes(s)) throw Error("Dummy atom: Invalid label");
		if (String(i.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], o, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		let l = i.getIndex(["_atom_site.type_symbol", "_atom_site_type_symbol"], o, !1);
		if (l ||= Ie(s), c.includes(l)) throw Error("Dummy atom: Invalid atom type");
		let u = we.fromCIF(t, o), d = Te.fromCIF(t, o), f = i.getIndex(["_atom_site.disorder_group", "_atom_site_disorder_group"], o, ".");
		return new e(s, l, u, d, f === "." ? 0 : f);
	}
};
function Be(e, t) {
	return e.disorderGroup === t.disorderGroup || e.disorderGroup === 0 || t.disorderGroup === 0;
}
//#endregion
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function Ve(e, t = !1) {
	let r = e[0].index !== null, i = new Set(Object.keys(e[0].attributes)), a = new Set(Object.keys(e[0].morphAttributes)), o = {}, s = {}, c = e[0].morphTargetsRelative, l = new n(), u = 0;
	for (let n = 0; n < e.length; ++n) {
		let d = e[n], f = 0;
		if (r !== (d.index !== null)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."), null;
		for (let e in d.attributes) {
			if (!i.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". All geometries must have compatible attributes; make sure \"" + e + "\" attribute exists among all geometries, or in none of them."), null;
			o[e] === void 0 && (o[e] = []), o[e].push(d.attributes[e]), f++;
		}
		if (f !== i.size) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". Make sure all geometries have the same number of attributes."), null;
		if (c !== d.morphTargetsRelative) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". .morphTargetsRelative must be consistent throughout all geometries."), null;
		for (let e in d.morphAttributes) {
			if (!a.has(e)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ".  .morphAttributes must be consistent throughout all geometries."), null;
			s[e] === void 0 && (s[e] = []), s[e].push(d.morphAttributes[e]);
		}
		if (t) {
			let e;
			if (r) e = d.index.count;
			else if (d.attributes.position !== void 0) e = d.attributes.position.count;
			else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + n + ". The geometry must have either an index or a position attribute"), null;
			l.addGroup(u, e, n), u += e;
		}
	}
	if (r) {
		let t = 0, n = [];
		for (let r = 0; r < e.length; ++r) {
			let i = e[r].index;
			for (let e = 0; e < i.count; ++e) n.push(i.getX(e) + t);
			t += e[r].attributes.position.count;
		}
		l.setIndex(n);
	}
	for (let e in o) {
		let t = He(o[e]);
		if (!t) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " attribute."), null;
		l.setAttribute(e, t);
	}
	for (let e in s) {
		let t = s[e][0].length;
		if (t !== 0) {
			l.morphAttributes = l.morphAttributes || {}, l.morphAttributes[e] = [];
			for (let n = 0; n < t; ++n) {
				let t = [];
				for (let r = 0; r < s[e].length; ++r) t.push(s[e][r][n]);
				let r = He(t);
				if (!r) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
				l.morphAttributes[e].push(r);
			}
		}
	}
	return l;
}
function He(e) {
	let n, r, i, a = -1, o = 0;
	for (let t = 0; t < e.length; ++t) {
		let s = e[t];
		if (n === void 0 && (n = s.array.constructor), n !== s.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
		if (r === void 0 && (r = s.itemSize), r !== s.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
		if (i === void 0 && (i = s.normalized), i !== s.normalized) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
		if (a === -1 && (a = s.gpuType), a !== s.gpuType) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."), null;
		o += s.count * r;
	}
	let s = new n(o), c = new t(s, r, i), l = 0;
	for (let t = 0; t < e.length; ++t) {
		let n = e[t];
		if (n.isInterleavedBufferAttribute) {
			let e = l / r;
			for (let t = 0, i = n.count; t < i; t++) for (let i = 0; i < r; i++) {
				let r = n.getComponent(t, i);
				c.setComponent(t + e, i, r);
			}
		} else s.set(n.array, l);
		l += n.count * r;
	}
	return a !== void 0 && (c.gpuType = a), c;
}
//#endregion
//#region src/lib/structure/covalent-radii.js
var Ue = Object.freeze({
	H: .31,
	D: .31,
	He: .28,
	Li: 1.28,
	Be: .96,
	B: .84,
	C: .76,
	N: .71,
	O: .66,
	F: .57,
	Ne: .58,
	Na: 1.66,
	Mg: 1.41,
	Al: 1.21,
	Si: 1.11,
	P: 1.07,
	S: 1.05,
	Cl: 1.02,
	Ar: 1.06,
	K: 2.03,
	Ca: 1.76,
	Sc: 1.7,
	Ti: 1.6,
	V: 1.53,
	Cr: 1.39,
	Mn: 1.39,
	Fe: 1.32,
	Co: 1.26,
	Ni: 1.24,
	Cu: 1.32,
	Zn: 1.22,
	Ga: 1.22,
	Ge: 1.2,
	As: 1.19,
	Se: 1.2,
	Br: 1.2,
	Kr: 1.16,
	Rb: 2.2,
	Sr: 1.95,
	Y: 1.9,
	Zr: 1.75,
	Nb: 1.64,
	Mo: 1.54,
	Tc: 1.47,
	Ru: 1.46,
	Rh: 1.42,
	Pd: 1.39,
	Ag: 1.45,
	Cd: 1.44,
	In: 1.42,
	Sn: 1.39,
	Sb: 1.39,
	Te: 1.38,
	I: 1.39,
	Xe: 1.4,
	Cs: 2.44,
	Ba: 2.15,
	La: 2.07,
	Ce: 2.04,
	Pr: 2.03,
	Nd: 2.01,
	Pm: 1.99,
	Sm: 1.98,
	Eu: 1.98,
	Gd: 1.96,
	Tb: 1.94,
	Dy: 1.92,
	Ho: 1.92,
	Er: 1.89,
	Tm: 1.9,
	Yb: 1.87,
	Lu: 1.87,
	Hf: 1.75,
	Ta: 1.7,
	W: 1.62,
	Re: 1.51,
	Os: 1.44,
	Ir: 1.41,
	Pt: 1.36,
	Au: 1.36,
	Hg: 1.32,
	Tl: 1.45,
	Pb: 1.46,
	Bi: 1.48,
	Po: 1.4,
	At: 1.5,
	Rn: 1.5,
	Fr: 2.6,
	Ra: 2.21,
	Ac: 2.15,
	Th: 2.06,
	Pa: 2,
	U: 1.96,
	Np: 1.9,
	Pu: 1.87,
	Am: 1.8,
	Cm: 1.69
}), We = Object.freeze(/* @__PURE__ */ new Set([
	"Li",
	"Na",
	"K",
	"Rb",
	"Cs",
	"Fr",
	"Be",
	"Mg",
	"Ca",
	"Sr",
	"Ba",
	"Ra"
])), Ge = Object.freeze({
	Bk: 1.65,
	Cf: 1.81
}), Ke = Object.freeze({
	useWorker: !0,
	useSymmetry: !0,
	autoLoad: !1,
	inputMode: "auto",
	reflections: Object.freeze({}),
	iam: Object.freeze({}),
	intensityScale: null,
	extinctionCorrection: "auto",
	coefficientColumns: null,
	anomalousDispersion: !1,
	reciprocalResolution: 1,
	initialGridOversampling: 1,
	gridOversampling: 2,
	progressiveSteps: Object.freeze([
		.5,
		.75,
		1
	]),
	visible: !0,
	sigmaLevel: 3,
	radius: 1.5,
	resolution: 64,
	gridSpacing: .15,
	maxResolution: 96,
	stitchTolerance: 1e-4,
	positiveColor: "#36b566",
	negativeColor: "#d94b64",
	deformationPositiveColor: "#4FC3F7",
	deformationNegativeColor: "#FF9800",
	opacity: .55,
	wireframe: !0,
	maxPolyCount: 1e5
}), qe = Object.fromEntries(Object.entries({
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
	radius: Ue[e] ?? Ge[e],
	...t
}])), W = {
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
	interaction: {
		rotationSpeed: 5,
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
	renderStyle: "solid-3d",
	plot2DBackground: "#ffffff",
	plot2DAtomColor: "#ffffff",
	plot2DLineColor: "#000000",
	plot2DBondColor: "#000000",
	plot2DOpenBondInnerScale: .5,
	plot2DStripeCount: 7,
	plot2DStripeWidth: .18,
	plot2DOutlineScale: 1.035,
	hydrogenMode: "none",
	disorderMode: "all",
	symmetryMode: "none",
	differenceDensity: { ...Ke },
	bondGrowTolerance: .45,
	fixCifErrors: !1,
	atomLabels: {
		show: "none",
		placementMode: "auto-omit",
		text: {},
		fontSize: 14,
		fontWeight: 500,
		fontFamily: "system-ui, -apple-system, sans-serif",
		color: "#111111",
		haloColor: "#ffffff",
		haloWidth: 2,
		leaderLines: "auto",
		leaderColor: "rgba(17, 17, 17, 0.55)",
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
	bondColor: "#666666",
	bondColorRoughness: .3,
	bondColorMetalness: .1,
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
	elementProperties: qe
}, Je = [
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
], Ye = [
	-1,
	1,
	1
], Xe = [
	new e.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
	new e.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1),
	new e.Matrix4().set(0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
];
function Ze(t, n) {
	let r = new e.Color(t.atomColor), i = Math.max(1, n.atomCutawayStripeCount), a = e.MathUtils.clamp(n.atomCutawayStripeWidth, .01, 1) / 2, o = new e.MeshStandardMaterial({
		color: t.ringColor,
		roughness: n.atomColorRoughness,
		metalness: n.atomColorMetalness,
		side: e.DoubleSide
	});
	return o.userData.cutawayStripes = {
		color: r,
		count: i,
		width: a * 2
	}, o.onBeforeCompile = (e) => {
		e.uniforms.cutawayStripeColor = { value: r }, e.uniforms.cutawayStripeCount = { value: i }, e.uniforms.cutawayStripeHalfWidth = { value: a }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vCutawayUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvCutawayUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vCutawayUv;\nuniform vec3 cutawayStripeColor;\nuniform float cutawayStripeCount;\nuniform float cutawayStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat cutawayStripeCoordinate = vCutawayUv.y * cutawayStripeCount;\nfloat cutawayStripePhase = fract(cutawayStripeCoordinate);\nfloat cutawayStripeDistance = abs(cutawayStripePhase - 0.5);\nfloat cutawayStripeEdge = max(fwidth(cutawayStripeCoordinate), 0.001);\nfloat cutawayStripeMask = 1.0 - smoothstep(\n    cutawayStripeHalfWidth - cutawayStripeEdge,\n    cutawayStripeHalfWidth + cutawayStripeEdge,\n    cutawayStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, cutawayStripeColor, cutawayStripeMask\n);");
	}, o.customProgramCacheKey = () => "cutaway-horizontal-stripes-v1", o;
}
function Qe(t, n = t.plot2DLineColor) {
	let r = new e.Color(n), i = Math.max(1, t.plot2DStripeCount), a = e.MathUtils.clamp(t.plot2DStripeWidth, .01, 1) / 2, o = new e.MeshBasicMaterial({
		color: t.plot2DAtomColor,
		side: e.DoubleSide
	});
	return o.userData.plot2DHatch = {
		color: r,
		count: i,
		width: a * 2
	}, o.onBeforeCompile = (e) => {
		e.uniforms.plot2DStripeColor = { value: r }, e.uniforms.plot2DStripeCount = { value: i }, e.uniforms.plot2DStripeHalfWidth = { value: a }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vPlot2DUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvPlot2DUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vPlot2DUv;\nuniform vec3 plot2DStripeColor;\nuniform float plot2DStripeCount;\nuniform float plot2DStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat plot2DStripeCoordinate = vPlot2DUv.y * plot2DStripeCount;\nfloat plot2DStripePhase = fract(plot2DStripeCoordinate);\nfloat plot2DStripeDistance = abs(plot2DStripePhase - 0.5);\nfloat plot2DStripeEdge = max(fwidth(plot2DStripeCoordinate), 0.001);\nfloat plot2DStripeMask = 1.0 - smoothstep(\n    plot2DStripeHalfWidth - plot2DStripeEdge,\n    plot2DStripeHalfWidth + plot2DStripeEdge,\n    plot2DStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, plot2DStripeColor, plot2DStripeMask\n);");
	}, o.customProgramCacheKey = () => "2d-plot-curved-octant-hatch-v1", o;
}
function $e(e, t) {
	e.scale.set(t[0] / Ye[0], t[1] / Ye[1], t[2] / Ye[2]);
}
function et(e, t) {
	let n = e.getAttribute("uv"), r = Math.cos(t), i = Math.sin(t);
	for (let e = 0; e < n.count; e++) {
		let t = n.getX(e) - .5, a = n.getY(e) - .5;
		n.setXY(e, t * r - a * i + .5, t * i + a * r + .5);
	}
	n.needsUpdate = !0;
}
function tt(t) {
	let n = {
		position: 0,
		rotation: 0,
		scale: 0,
		matrix: 0
	};
	function r(t) {
		let i = t.position, a = t.rotation, o = t.scale, s = t.matrix.elements;
		if ([
			i.x,
			i.y,
			i.z
		].some(isNaN) && (console.log("pos"), console.log(i), console.log(t.userData), n.position++), [
			a.x,
			a.y,
			a.z
		].some(isNaN) && (n.rotation++, console.log("rot"), console.log(a), console.log(t.userData)), [
			o.x,
			o.y,
			o.z
		].some(isNaN) && (console.log("scale"), console.log(o), console.log(t.userData), n.scale++), s.some(isNaN) && (n.matrix++, console.log("matrix"), console.log(s), console.log(t.userData)), t.isInstancedMesh) {
			let r = new e.Matrix4();
			for (let e = 0; e < t.count; e++) t.getMatrixAt(e, r), r.elements.some(isNaN) && (n.matrix++, console.log("instanceMatrix"), console.log(r.elements), console.log(t.userData));
		}
		for (let e of t.children) r(e);
	}
	return r(t), n;
}
var nt = class {
	constructor(t, n, r) {
		this.mesh = new e.InstancedMesh(t, n, r), this.mesh.userData = { selectable: !1 }, this.nextIndex = 0;
	}
	register(e) {
		let t = this.nextIndex++;
		return this.mesh.setMatrixAt(t, e), t;
	}
	finalize() {
		this.mesh.instanceMatrix.needsUpdate = !0, this.mesh.computeBoundingSphere();
	}
	hideInstance(t) {
		this.mesh.setMatrixAt(t, new e.Matrix4().makeScale(0, 0, 0)), this.mesh.instanceMatrix.needsUpdate = !0;
	}
	restoreInstance(e, t) {
		this.mesh.setMatrixAt(e, t), this.mesh.instanceMatrix.needsUpdate = !0;
	}
};
function rt(t, n) {
	let r = t.getEllipsoidMatrix(n).toArray();
	return new e.Matrix4(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1);
}
function it(t, n) {
	let r = n.clone().sub(t), i = r.length();
	if (i === 0) throw Error("Error in ORTEP Bond Creation. Trying to create a zero length bond.");
	let a = r.divideScalar(i), o = new e.Vector3(0, 1, 0), s = new e.Vector3().crossVectors(a, o), c = -Math.acos(a.dot(o));
	return new e.Matrix4().makeScale(1, i, 1).premultiply(new e.Matrix4().makeRotationAxis(s.normalize(), c)).setPosition(t.clone().add(n).multiplyScalar(.5));
}
function at(e, t, n, r) {
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
var ot = class {
	constructor(e = {}) {
		let t = e || {};
		this.options = {
			...W,
			...t,
			elementProperties: {
				...W.elementProperties,
				...t.elementProperties || {}
			}
		}, this.scaling = 1.5384, this.geometries = {}, this.materials = {}, this.elementMaterials = {}, this.initializeGeometries(), this.initializeMaterials();
	}
	initializeGeometries() {
		if (this.geometries.atom = new e.IcosahedronGeometry(this.scaling, this.options.atomDetail), this.options.renderStyle !== "solid-3d") {
			let t = Math.max(3, 2 ** this.options.atomDetail + 2);
			this.geometries.atomOctant = new e.SphereGeometry(this.scaling, t, t, 0, Math.PI / 2, 0, Math.PI / 2), this.geometries.emptyAtom = new e.BufferGeometry(), this.geometries.cutawayPlanes = this.createCutawayPlanes(t * 4);
		}
		this.geometries.adpRing = this.createADPHalfTorus(), this.geometries.adpRingSet = this.createMergedADPRingSet(this.geometries.adpRing), this.geometries.bond = new e.CylinderGeometry(this.options.bondRadius, this.options.bondRadius, .98, this.options.bondSections, 1, !0), this.geometries.hbond = new e.CylinderGeometry(this.options.hbondRadius, this.options.hbondRadius, .98, this.options.bondSections, 1, !0);
	}
	initializeMaterials() {
		if (this.options.renderStyle === "cutout-2d") {
			this.materials.bond = new e.MeshBasicMaterial({ color: this.options.plot2DBondColor }), this.materials.openBond = new e.MeshBasicMaterial({ color: this.options.plot2DAtomColor }), this.materials.openBondOutline = new e.MeshBasicMaterial({
				color: this.options.plot2DBondColor,
				side: e.BackSide
			}), this.materials.hbond = new e.MeshBasicMaterial({ color: this.options.plot2DLineColor });
			return;
		}
		this.materials.bond = new e.MeshStandardMaterial({
			color: this.options.bondColor,
			roughness: this.options.bondColorRoughness,
			metalness: this.options.bondColorMetalness
		}), this.materials.hbond = new e.MeshStandardMaterial({
			color: this.options.hbondColor,
			roughness: this.options.hbondColorRoughness,
			metalness: this.options.hbondColorMetalness
		});
	}
	validateElementType(e) {
		if (!this.options.elementProperties[e]) throw Error(`Unknown element type: ${e}. Please ensure element properties are defined.Pass the type settings as custom options, ifthey are element from periodic table`);
	}
	getAtomMaterials(t) {
		let n = t;
		if (this.options.elementProperties[n] || (n = Ie(t)), this.validateElementType(n), this.options.renderStyle === "cutout-2d") {
			let t = `${n}_2d_materials`;
			if (!this.elementMaterials[t]) {
				let r = this.options.elementProperties[n], i = ["H", "D"].includes(n) ? this.options.plot2DLineColor : r.atomColor, a = new e.MeshBasicMaterial({
					color: i,
					side: e.BackSide
				}), o = new e.MeshBasicMaterial({ color: this.options.plot2DAtomColor });
				o.userData.plot2DOutlineMaterial = a, o.userData.plot2DOutlineScale = this.options.plot2DOutlineScale;
				let s = new e.MeshBasicMaterial({ color: i }), c = Qe(this.options, i);
				this.elementMaterials[t] = [
					o,
					s,
					c,
					a
				];
			}
			return this.elementMaterials[t];
		}
		let r = `${n}_materials`;
		if (!this.elementMaterials[r]) {
			let t = this.options.elementProperties[n], i = new e.MeshStandardMaterial({
				color: t.atomColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			}), a = new e.MeshStandardMaterial({
				color: t.ringColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			});
			this.elementMaterials[r] = [i, a], this.options.renderStyle === "cutout-3d" && this.elementMaterials[r].push(Ze(t, this.options));
		}
		return this.elementMaterials[r];
	}
	createADPHalfTorus() {
		let t = new e.TorusGeometry(this.scaling * this.options.atomADPRingWidthFactor, this.options.atomADPRingHeight, this.options.atomADPInnerSections, this.options.atomADPRingSections), n = t.attributes.position.array, r = t.index.array, i = [], a = [], o = /* @__PURE__ */ new Set();
		for (let e = 0; e < r.length; e += 3) {
			let t = [
				r[e] * 3,
				r[e + 1] * 3,
				r[e + 2] * 3
			].map((e) => ({
				index: e / 3,
				distance: Math.sqrt(n[e] * n[e] + n[e + 1] * n[e + 1] + n[e + 2] * n[e + 2])
			}));
			t.some((e) => e.distance >= this.scaling) && t.forEach((t) => o.add(r[e + t.index % 3]));
		}
		let s = /* @__PURE__ */ new Map(), c = 0;
		o.forEach((e) => {
			let t = e * 3;
			i.push(n[t], n[t + 1], n[t + 2]), s.set(e, c++);
		});
		for (let e = 0; e < r.length; e += 3) o.has(r[e]) && o.has(r[e + 1]) && o.has(r[e + 2]) && a.push(s.get(r[e]), s.get(r[e + 1]), s.get(r[e + 2]));
		let l = new e.BufferGeometry();
		return l.setAttribute("position", new e.Float32BufferAttribute(i, 3)), l.setIndex(a), l.computeVertexNormals(), l.rotateX(.5 * Math.PI), t.dispose(), l;
	}
	createCutawayPlanes(t) {
		let n = new e.CircleGeometry(this.scaling, t), r = new e.CircleGeometry(this.scaling, t), i = new e.CircleGeometry(this.scaling, t);
		et(r, Math.PI / 2), et(i, Math.PI / 2), r.rotateX(Math.PI / 2), i.rotateY(Math.PI / 2);
		let a = Ve([
			n,
			r,
			i
		]);
		return n.dispose(), r.dispose(), i.dispose(), a;
	}
	createMergedADPRingSet(e) {
		let t = Xe.map((t) => {
			let n = e.clone();
			return n.applyMatrix4(t), n;
		}), n = Ve(t);
		return t.forEach((e) => e.dispose()), n;
	}
	dispose() {
		Object.values(this.geometries).forEach((e) => e.dispose()), Object.values(this.materials).forEach((e) => e.dispose()), Object.values(this.elementMaterials).forEach((e) => {
			e.forEach((e) => e.dispose());
		});
	}
}, st = class {
	constructor(e, t = {}) {
		let n = t || {}, r = { ...W.elementProperties };
		n.elementProperties && Object.entries(n.elementProperties).forEach(([e, t]) => {
			r[e] = {
				...r[e],
				...t
			};
		}), this.options = {
			...W,
			...n,
			elementProperties: r
		}, this.crystalStructure = e, this.cache = new ot(this.options), this.createStructure();
	}
	createStructure() {
		this.atoms3D = [], this.bonds3D = [], this.hBonds3D = [];
		let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Map();
		for (let e of this.crystalStructure.atoms) {
			let r = e.uniqueId;
			t.add(r), n.has(r) || n.set(r, e);
		}
		let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = (t) => {
			let i = r.get(t);
			if (!i) {
				let a = n.get(t).position.toCartesian(this.crystalStructure.cell);
				i = new e.Vector3(a.x, a.y, a.z), r.set(t, i);
			}
			return i;
		};
		if (this.options.renderStyle !== "solid-3d") for (let e of this.crystalStructure.atoms) {
			let [t, n, r] = this.cache.getAtomMaterials(e.atomType), a;
			a = e.adp instanceof B ? new ut(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.cache.geometries.adpRingSet, n, {
				octantGeometry: this.cache.geometries.atomOctant,
				emptyGeometry: this.cache.geometries.emptyAtom,
				planeGeometry: this.cache.geometries.cutawayPlanes,
				planeMaterial: r,
				hysteresis: this.options.atomCutawayHysteresis
			}) : e.adp instanceof z ? new dt(e, this.crystalStructure.cell, this.cache.geometries.atom, t) : new ft(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.options), this.atoms3D.push(a), i.has(e.uniqueId) || i.set(e.uniqueId, a);
		}
		else {
			this.cache.geometries.atom.boundingSphere || this.cache.geometries.atom.computeBoundingSphere();
			let e = this.cache.geometries.atom.boundingSphere.radius, t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = [];
			for (let e of this.crystalStructure.atoms) {
				let [i, a] = this.cache.getAtomMaterials(e.atomType);
				if (e.adp instanceof B) {
					let { matrix: o, valid: s } = pt(e, this.crystalStructure.cell);
					s ? (t.set(i, (t.get(i) || 0) + 1), n.set(a, (n.get(a) || 0) + 1), r.push({
						atom: e,
						kind: "ani",
						matrix: o,
						atomMaterial: i,
						ringMaterial: a
					})) : r.push({
						atom: e,
						kind: "ani-fallback",
						atomMaterial: i,
						ringMaterial: a
					});
				} else if (e.adp instanceof z) {
					let { matrix: n, valid: a } = mt(e, this.crystalStructure.cell);
					a ? (t.set(i, (t.get(i) || 0) + 1), r.push({
						atom: e,
						kind: "iso",
						matrix: n,
						atomMaterial: i
					})) : r.push({
						atom: e,
						kind: "iso-fallback",
						atomMaterial: i
					});
				} else {
					let n = ht(e, this.crystalStructure.cell, this.options);
					t.set(i, (t.get(i) || 0) + 1), r.push({
						atom: e,
						kind: "constant",
						matrix: n,
						atomMaterial: i
					});
				}
			}
			let a = /* @__PURE__ */ new Map();
			for (let [e, n] of t) a.set(e, new nt(this.cache.geometries.atom, e, n));
			let o = /* @__PURE__ */ new Map();
			for (let [e, t] of n) o.set(e, new nt(this.cache.geometries.adpRingSet, e, t));
			for (let t of r) {
				let n;
				n = t.kind === "ani" ? new vt(t.atom, a.get(t.atomMaterial), t.matrix, e, o.get(t.ringMaterial)) : t.kind === "iso" || t.kind === "constant" ? new _t(t.atom, a.get(t.atomMaterial), t.matrix, e) : t.kind === "ani-fallback" ? new ut(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial, this.cache.geometries.adpRingSet, t.ringMaterial, null) : new dt(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial), this.atoms3D.push(n), i.has(t.atom.uniqueId) || i.set(t.atom.uniqueId, n);
			}
			a.forEach((e) => e.finalize()), o.forEach((e) => e.finalize()), this.atomPools = a, this.ringPools = o;
		}
		let o = this.options.renderStyle === "solid-3d" ? null : (e) => i.get(e), s = this.crystalStructure.bonds.filter((e) => {
			let n = t.has(e.atom1Id), r = t.has(e.atom2Id);
			return n && r;
		});
		if (this.options.renderStyle === "cutout-2d") for (let e of s) try {
			let t = [n.get(e.atom1Id), n.get(e.atom2Id)].some((e) => Number(e.disorderGroup) > 1);
			this.bonds3D.push(new yt(e, this.crystalStructure, this.cache.geometries.bond, t ? this.cache.materials.openBond : this.cache.materials.bond, a, o, t ? {
				outlineMaterial: this.cache.materials.openBondOutline,
				innerScale: this.options.plot2DOpenBondInnerScale
			} : null));
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		else {
			let e = [];
			for (let t of s) try {
				let n = bt.computeMatrix(t, this.crystalStructure, a, o);
				e.push([t, n]);
			} catch (e) {
				if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
			}
			this.bondPool = e.length > 0 ? new nt(this.cache.geometries.bond, this.cache.materials.bond, e.length) : null;
			for (let [t, n] of e) this.bonds3D.push(new bt(t, this.bondPool, n));
			this.bondPool?.finalize();
		}
		let c = this.crystalStructure.hBonds.filter((e) => t.has(e.donorAtomId) && t.has(e.acceptorAtomId) && (!e.hydrogenAtomId || t.has(e.hydrogenAtomId))), l = [], u = 0;
		for (let e of c) try {
			let t = xt.computeSegmentMatrices(e, this.crystalStructure, this.options.hbondDashSegmentLength, this.options.hbondDashFraction, a, o);
			l.push([e, t]), u += t.length;
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		this.hbondPool = u > 0 ? new nt(this.cache.geometries.hbond, this.cache.materials.hbond, u) : null;
		for (let [e, t] of l) this.hBonds3D.push(new xt(e, this.hbondPool, t));
		this.hbondPool?.finalize();
	}
	getGroup() {
		let t = new e.Group();
		if (this.atomPools) for (let e of this.atomPools.values()) t.add(e.mesh);
		if (this.ringPools) for (let e of this.ringPools.values()) t.add(e.mesh);
		for (let e of this.atoms3D) t.add(e);
		this.bondPool && t.add(this.bondPool.mesh);
		for (let e of this.bonds3D) t.add(e);
		this.hbondPool && t.add(this.hbondPool.mesh);
		for (let e of this.hBonds3D) t.add(e);
		return tt(t), t.cutawayAtoms = this.atoms3D.filter((e) => e.isCutaway), t.cameraFacingAtoms = t.cutawayAtoms, t.atomLabelAnchors = this.atoms3D.map((t) => {
			let n;
			t.segments?.[0]?.matrix ? n = t.segments[0].matrix.clone() : (t.updateMatrix(), n = t.matrix.clone());
			let r = new e.Vector3().setFromMatrixPosition(n), i = new e.Vector3();
			n.decompose(new e.Vector3(), new e.Quaternion(), i);
			let a = (t.surfaceRadius || .25) * Math.max(i.x, i.y, i.z);
			return {
				atom: t.userData.atomData,
				position: r,
				radius: a
			};
		}), t;
	}
	dispose() {
		this.cache.dispose();
	}
}, ct = class t extends e.Mesh {
	constructor(e, n) {
		if (new.target === t) throw TypeError("ORTEPObject is an abstract class and cannot be instantiated directly.");
		super(e, n), this._selectionColor = null, this.marker = null;
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(t) {
		return new e.MeshBasicMaterial({
			color: t,
			transparent: !0,
			opacity: .9,
			side: e.BackSide
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
}, lt = class extends ct {
	constructor(t, n, r, i) {
		super(r, i), this.updateSurfaceRadius();
		let a = i.userData.plot2DOutlineMaterial;
		if (a) {
			let t = new e.Mesh(r, a);
			t.scale.multiplyScalar(i.userData.plot2DOutlineScale), t.userData = {
				selectable: !1,
				type: "2d-atom-outline"
			}, this.add(t), this.plot2DOutline = t;
		}
		let o = new e.Vector3(...t.position.toCartesian(n));
		this.position.copy(o), this.userData = {
			type: "atom",
			atomData: t,
			selectable: !0
		};
	}
	updateSurfaceRadius() {
		this.geometry.boundingSphere || this.geometry.computeBoundingSphere(), this.surfaceRadius = this.geometry.boundingSphere?.radius || 0;
	}
	getSurfaceDistanceAlong(e) {
		if (e.lengthSq() === 0 || this.surfaceRadius === 0) return 0;
		this.updateMatrix();
		let t = this.matrix.clone().setPosition(0, 0, 0).invert(), n = e.clone().normalize().applyMatrix4(t).length();
		return Number.isFinite(n) && n > 0 ? this.surfaceRadius / n : 0;
	}
	createSelectionMarker(t, n) {
		let r = new e.Mesh(this.geometry, this.createSelectionMaterial(t));
		return r.scale.multiplyScalar(n.selection.markerMult), r.userData.selectable = !1, r;
	}
}, ut = class extends lt {
	constructor(t, n, r, i, a, o, s = null) {
		if (super(t, n, r, i), [
			t.adp.u11,
			t.adp.u22,
			t.adp.u33
		].some((e) => e <= 0)) this.geometry = new e.TetrahedronGeometry(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
		else {
			let r = rt(t.adp, n);
			if (r.toArray().includes(NaN)) this.geometry = new e.TetrahedronGeometry(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
			else {
				s && this.setupCutaway(s, i);
				let t = new e.Mesh(a, o);
				t.userData.selectable = !1, this.add(t), this.ringMesh = t, this.applyMatrix4(r);
			}
		}
		let c = new e.Vector3(...t.position.toCartesian(n));
		this.position.copy(c), this.userData = {
			type: "atom",
			atomData: t,
			selectable: !0
		};
	}
	setupCutaway(t, n) {
		if (this.geometry = t.emptyGeometry, this.isCutaway = !0, this.cutawayHysteresis = t.hysteresis, this.cutawaySigns = [
			1,
			1,
			1
		], this.cutawayViewDirection = new e.Vector3(), this.cutawayWorldPosition = new e.Vector3(), this.cutawayInverseRotation = new e.Matrix4(), this.cutawayOctants = Je.map((r, i) => {
			let a = new e.Mesh(t.octantGeometry, n);
			return $e(a, r), a.userData = {
				selectable: !1,
				type: "ellipsoid-octant",
				octantIndex: i
			}, this.add(a), a;
		}), this.plot2DOutline) {
			this.remove(this.plot2DOutline);
			let r = n.userData.plot2DOutlineMaterial, i = n.userData.plot2DOutlineScale;
			this.cutawayOutlines = Je.map((n, a) => {
				let o = new e.Mesh(t.octantGeometry, r);
				return $e(o, n), o.scale.multiplyScalar(i), o.userData = {
					selectable: !1,
					type: "2d-ellipsoid-outline",
					octantIndex: a
				}, this.add(o), o;
			}), this.plot2DOutline = null;
		}
		let r = new e.Mesh(t.planeGeometry, t.planeMaterial);
		r.userData = {
			selectable: !1,
			type: "ellipsoid-cutaway-planes"
		}, this.add(r), this.cutawayPlanes = r, this.setMissingOctant(7);
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
		}), this.cutawayOutlines?.forEach((t, n) => {
			t.visible = n !== e;
		}), this.marker?.cutawayOctants?.forEach((t, n) => {
			t.visible = n !== e;
		}));
	}
	createSelectionMarker(t, n) {
		if (!this.isCutaway) return super.createSelectionMarker(t, n);
		let r = new e.Group(), i = this.createSelectionMaterial(t);
		return r.cutawayOctants = Je.map((t, n) => {
			let a = new e.Mesh(this.cutawayOctants[0].geometry, i);
			return $e(a, t), a.visible = n !== this.missingOctantIndex, a.userData.selectable = !1, r.add(a), a;
		}), r.material = i, r.scale.multiplyScalar(n.selection.markerMult), r.userData.selectable = !1, r;
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
	raycast(t, n) {
		if (!this.isCutaway) return super.raycast(t, n);
		let r = [];
		return [...this.cutawayOctants.filter((e) => e.visible), this.cutawayPlanes].forEach((n) => {
			e.Mesh.prototype.raycast.call(n, t, r);
		}), r.forEach((e) => {
			n.push({
				...e,
				object: this
			});
		}), !1;
	}
	get adpRingMatrices() {
		return Xe.map((e) => e.clone());
	}
}, dt = class extends lt {
	constructor(t, n, r, i) {
		if (super(t, n, r, i), !t.adp || !("uiso" in t.adp)) throw Error("Atom must have isotropic displacement parameters (UIsoADP)");
		t.adp.uiso <= 0 ? (this.geometry = new e.TetrahedronGeometry(1), this.updateSurfaceRadius()) : this.scale.multiplyScalar(Math.sqrt(t.adp.uiso));
	}
}, ft = class extends lt {
	constructor(e, t, n, r, i) {
		super(e, t, n, r);
		let a = e.atomType;
		try {
			i.elementProperties[a] || (a = Ie(e.atomType));
		} catch {
			throw Error(`Element properties not found for atom type: '${e.atomType}'`);
		}
		this.scale.multiplyScalar(i.atomConstantRadiusMultiplier * i.elementProperties[a].radius);
	}
};
function pt(t, n) {
	if ([
		t.adp.u11,
		t.adp.u3,
		t.adp.u33
	].some((e) => e <= 0)) return {
		matrix: null,
		valid: !1
	};
	let r = rt(t.adp, n);
	if (r.toArray().includes(NaN)) return {
		matrix: null,
		valid: !1
	};
	let i = new e.Vector3(...t.position.toCartesian(n));
	return {
		matrix: r.setPosition(i),
		valid: !0
	};
}
function mt(t, n) {
	if (t.adp.uiso <= 0) return {
		matrix: null,
		valid: !1
	};
	let r = Math.sqrt(t.adp.uiso), i = new e.Vector3(...t.position.toCartesian(n));
	return {
		matrix: new e.Matrix4().makeScale(r, r, r).setPosition(i),
		valid: !0
	};
}
function ht(t, n, r) {
	let i = t.atomType;
	try {
		r.elementProperties[i] || (i = Ie(t.atomType));
	} catch {
		throw Error(`Element properties not found for atom type: '${t.atomType}'`);
	}
	let a = r.atomConstantRadiusMultiplier * r.elementProperties[i].radius, o = new e.Vector3(...t.position.toCartesian(n));
	return new e.Matrix4().makeScale(a, a, a).setPosition(o);
}
var gt = class t extends e.Object3D {
	constructor() {
		if (new.target === t) throw TypeError("PooledSelectableObject is an abstract class and cannot be instantiated directly.");
		super(), this._selectionColor = null, this.marker = null, this.matrixAutoUpdate = !1, this.segments = [];
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(t) {
		return new e.MeshBasicMaterial({
			color: t,
			transparent: !0,
			opacity: .9,
			side: e.BackSide
		});
	}
	raycast(t, n) {
		let r = [], i = new e.Mesh();
		i.matrixAutoUpdate = !1;
		for (let e of this.segments) i.geometry = e.pool.mesh.geometry, i.material = e.pool.mesh.material, i.matrixWorld.multiplyMatrices(this.matrixWorld, e.matrix), i.raycast(t, r);
		r.length > 0 && (r.sort((e, t) => e.distance - t.distance), n.push({
			...r[0],
			object: this
		}));
	}
	select(t, n) {
		this._selectionColor = t, this.highlightMeshes = this.segments.map((t) => {
			let r = t.pool.mesh.material.clone();
			r.emissive?.setHex(n.selection.highlightEmissive), t.pool.hideInstance(t.index);
			let i = new e.Mesh(t.pool.mesh.geometry, r);
			return i.applyMatrix4(t.matrix), i.userData = {
				...this.userData,
				selectable: !1
			}, this.add(i), i;
		});
		let r = this.createSelectionMarker(t, n);
		this.add(r), this.marker = r;
	}
	deselect() {
		this._selectionColor = null, this.segments.forEach((e) => e.pool.restoreInstance(e.index, e.matrix)), this.highlightMeshes &&= (this.highlightMeshes.forEach((e) => {
			this.remove(e), e.material.dispose();
		}), null), this.marker &&= (this.remove(this.marker), this.marker.traverse((t) => {
			t instanceof e.Mesh && t.material?.dispose();
		}), null);
	}
	createSelectionMarker(e, t) {
		throw Error("createSelectionMarker needs to be implemented in a subclass");
	}
	dispose() {
		this.marker && this.deselect();
	}
}, _t = class extends gt {
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
	createSelectionMarker(t, n) {
		let r = this.segments[0], i = new e.Mesh(r.pool.mesh.geometry, this.createSelectionMaterial(t));
		return i.applyMatrix4(r.matrix), i.scale.multiplyScalar(n.selection.markerMult), i.userData.selectable = !1, i;
	}
}, vt = class extends _t {
	constructor(e, t, n, r, i) {
		super(e, t, n, r), i && (this.ringPool = i, this.ringIndex = i.register(n));
	}
}, yt = class extends ct {
	constructor(t, n, r, i, a = null, o = null, s = null) {
		super(r, i);
		let c, l;
		if (a) c = a(t.atom1Id), l = a(t.atom2Id);
		else {
			let r = n.getAtomById(t.atom1Id), i = n.getAtomById(t.atom2Id);
			c = new e.Vector3(...r.position.toCartesian(n.cell)), l = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		o && ([c, l] = at(c, l, o(t.atom1Id), o(t.atom2Id)));
		let u = it(c, l);
		if (this.applyMatrix4(u), s) {
			let t = e.MathUtils.clamp(s.innerScale, .05, .95);
			this.scale.x *= t, this.scale.z *= t;
			let n = new e.Mesh(r, s.outlineMaterial);
			n.scale.set(1 / t, 1, 1 / t), n.userData = {
				selectable: !1,
				type: "2d-open-bond-outline"
			}, this.add(n), this.openBondOutline = n;
		}
		this.userData = {
			type: "bond",
			bondData: t,
			selectable: !0,
			isOpenDisorderBond: !!s
		};
	}
	createSelectionMarker(t, n) {
		let r = new e.Mesh(this.geometry, this.createSelectionMaterial(t));
		return r.scale.x *= n.selection.bondMarkerMult, r.scale.z *= n.selection.bondMarkerMult, r.userData.selectable = !1, r;
	}
};
e.Group;
var bt = class extends gt {
	static computeMatrix(t, n, r = null, i = null) {
		let a, o;
		if (r) a = r(t.atom1Id), o = r(t.atom2Id);
		else {
			let r = n.getAtomById(t.atom1Id), i = n.getAtomById(t.atom2Id);
			a = new e.Vector3(...r.position.toCartesian(n.cell)), o = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		return i && ([a, o] = at(a, o, i(t.atom1Id), i(t.atom2Id))), it(a, o);
	}
	constructor(e, t, n) {
		super(), this.userData = {
			type: "bond",
			bondData: e,
			selectable: !0,
			isOpenDisorderBond: !1
		}, this.segments = [{
			pool: t,
			matrix: n,
			index: t.register(n)
		}];
	}
	createSelectionMarker(t, n) {
		let r = this.segments[0], i = new e.Mesh(r.pool.mesh.geometry, this.createSelectionMaterial(t));
		return i.applyMatrix4(r.matrix), i.scale.x *= n.selection.bondMarkerMult, i.scale.z *= n.selection.bondMarkerMult, i.userData.selectable = !1, i;
	}
}, xt = class extends gt {
	static computeSegmentMatrices(t, n, r, i, a = null, o = null) {
		let s, c;
		if (a) s = a(t.hydrogenAtomId), c = a(t.acceptorAtomId);
		else {
			let r = n.getAtomById(t.hydrogenAtomId), i = n.getAtomById(t.acceptorAtomId);
			s = new e.Vector3(...r.position.toCartesian(n.cell)), c = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		o && ([s, c] = at(s, c, o(t.hydrogenAtomId), o(t.acceptorAtomId)));
		let l = s.distanceTo(c), u = Math.max(1, Math.floor(l / r)), d = l / u * i, f = [];
		for (let t = 0; t < u; t++) {
			let n = t / u, r = n + d / l, i = new e.Vector3().lerpVectors(s, c, n), a = new e.Vector3().lerpVectors(s, c, r);
			f.push(it(i, a));
		}
		return f;
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
	createSelectionMarker(t, n) {
		let r = new e.Group(), i = this.createSelectionMaterial(t);
		return this.segments.forEach((t) => {
			let a = new e.Mesh(t.pool.mesh.geometry, i);
			a.applyMatrix4(t.matrix), a.scale.x *= n.selection.bondMarkerMult, a.scale.y *= .8 * n.selection.bondMarkerMult, a.scale.z *= n.selection.bondMarkerMult, a.userData.selectable = !1, r.add(a);
		}), r;
	}
};
//#endregion
//#region src/lib/formatting.js
function St(e, t, n = 4) {
	if (!isFinite(1 / t)) return Ct(e, n).toFixed(n);
	let r = Math.floor(Math.log10(t));
	t * 10 ** -r < 2 && --r;
	let i = Ct(e, -r);
	if (r < 0) {
		let e = Math.round(t / 10 ** r);
		return `${i.toFixed(-r)}(${e})`;
	}
	return `${i}(${Ct(t, r)})`;
}
function Ct(e, t) {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}
//#endregion
//#region src/lib/density/cell-matching.js
var wt = Object.freeze({
	relativeLength: .001,
	angleDegrees: .05
});
function Tt(e, t, n = wt) {
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
function Et(e, t, n = "Reflection") {
	for (let r of [
		"a",
		"b",
		"c"
	]) {
		let i = Math.max(Math.abs(t[r]), 1);
		if (Math.abs(e[r] - t[r]) / i > wt.relativeLength) throw Error(`${n} unit cell does not match the structure (${r})`);
	}
	for (let r of [
		"alpha",
		"beta",
		"gamma"
	]) if (Math.abs(e[r] - t[r]) > wt.angleDegrees) throw Error(`${n} unit cell does not match the structure (${r})`);
}
//#endregion
//#region src/lib/density/cif-values.js
function G(e) {
	if (e == null || e === !1 || e === "." || e === "?") return null;
	let t = Number(e);
	return Number.isFinite(t) ? t : null;
}
function Dt(e, t) {
	for (let n of typeof t == "string" ? [t] : t) try {
		let t = e.get(n, !1);
		if (t && typeof t.get == "function") return t;
	} catch {}
	return null;
}
function K(e, t, n = null) {
	if (!e) return n;
	try {
		return e.get(t, n !== null && n) || n;
	} catch {
		return n;
	}
}
function Ot(e, t) {
	for (let n of t) try {
		let t = G(e.get(n));
		if (t !== null) return t;
	} catch {}
	return null;
}
function kt(e, t) {
	for (let n of t) try {
		let t = e.get(n);
		if (typeof t == "string" && t.trim()) return t;
	} catch {}
	return null;
}
//#endregion
//#region src/lib/density/structure-factor-model.js
var At = 2 * Math.PI;
function jt(e, t, n) {
	if (e.adp instanceof z) return { isotropic: e.adp.uiso };
	if (e.adp instanceof B) {
		let [r, i, a, o, s, c] = e.adp.getUCart(t), l = I(I(n, [
			[
				r,
				o,
				s
			],
			[
				o,
				i,
				c
			],
			[
				s,
				c,
				a
			]
		]), L(n));
		return { anisotropic: [
			l[0][0],
			l[1][1],
			l[2][2],
			l[0][1],
			l[0][2],
			l[1][2]
		] };
	}
	return null;
}
function Mt(e, t, n) {
	if (!e) return 1;
	if (e.isotropic !== void 0) return Math.exp(-2 * Math.PI ** 2 * e.isotropic * n);
	let [r, i, a, o, s, c] = e.anisotropic, [l, u, d] = t, f = r * l * l + i * u * u + a * d * d + 2 * o * l * u + 2 * s * l * d + 2 * c * u * d;
	return Math.exp(-2 * Math.PI ** 2 * f);
}
function Nt(e) {
	return e.map((e) => {
		let t = (e % 1 + 1) % 1, n = Math.abs(t - 1) < 1e-8 ? 0 : t;
		return Math.round(n * 1e8);
	}).join(",");
}
function Pt(e) {
	return Array.isArray(e) ? e : [
		e.h,
		e.k,
		e.l
	];
}
function Ft(e) {
	return e instanceof z ? {
		type: "Uiso",
		values: [e.uiso]
	} : e instanceof B ? {
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
function It(e) {
	return e?.type === "Uiso" ? new z(e.values[0]) : e?.type === "Uani" ? new B(...e.values) : null;
}
function Lt(e, t) {
	if (e instanceof z) return e.uiso < -1e-10;
	if (!(e instanceof B)) return !1;
	let n = e.getUCart(t);
	return ge([
		[
			n[0],
			n[3],
			n[4]
		],
		[
			n[3],
			n[1],
			n[5]
		],
		[
			n[4],
			n[5],
			n[2]
		]
	]).eigenvectors.some((e) => e.value < -1e-10);
}
function Rt(e, t) {
	let n = t.get("_atom_site"), r = n.get(["_atom_site.label", "_atom_site_label"]), i = n.get(["_atom_site.occupancy", "_atom_site_occupancy"], Array(r.length).fill(1)), a = new Map(r.map((e, t) => [String(e), G(i[t]) ?? 1])), o = R(e.cell.fractToCartMatrix), s = e.atoms.map((e) => {
		let t = e.position instanceof Se ? [
			e.position.x,
			e.position.y,
			e.position.z
		] : I(o, [
			e.position.x,
			e.position.y,
			e.position.z
		]);
		return {
			label: e.label,
			atomType: e.atomType,
			position: Array.isArray(t) ? t : t.toArray(),
			adp: Ft(e.adp),
			occupancy: a.get(String(e.label)) ?? 1
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
		atoms: s,
		symmetryOperations: e.symmetry.symmetryOperations.map((e) => ({
			rotation: e.rotMatrix.map((e) => [...e]),
			translation: [...e.transVector]
		})),
		wavelength: Ot(t, [
			"_diffrn_radiation_wavelength.wavelength",
			"_diffrn_radiation.wavelength",
			"_diffrn_radiation_wavelength"
		])
	};
}
function zt(e, t = 0, n = {}) {
	if (typeof e != "string" || e.length === 0) throw Error("Structure-factor calculation requires the coordinate CIF text");
	if (typeof n.resolveAtom != "function") throw Error("Structure-factor calculation requires an atom factor resolver");
	let r = new j(e), i = typeof t == "number" ? r.getBlock(t) : r.getBlockByName(t), a = n.structureModel ?? null, o = a ? new Re(a.cell.a, a.cell.b, a.cell.c, a.cell.alpha, a.cell.beta, a.cell.gamma) : Re.fromCIF(i);
	if (n.expectedCell && !Tt(o, n.expectedCell)) throw Error("Structure-factor coordinate CIF cell does not match the reflection cell");
	let s = a?.wavelength ?? Ot(i, [
		"_diffrn_radiation_wavelength.wavelength",
		"_diffrn_radiation.wavelength",
		"_diffrn_radiation_wavelength"
	]) ?? G(n.wavelength), c = a?.atoms ?? (() => {
		let e = i.get("_atom_site"), t = e.get(["_atom_site.label", "_atom_site_label"]), n = e.get(["_atom_site.occupancy", "_atom_site_occupancy"], Array(t.length).fill(1));
		return t.map((e, t) => ({
			label: e,
			index: t,
			occupancy: n[t]
		}));
	})(), l = [], u = {}, d = [], f = /* @__PURE__ */ new Map();
	for (let e = 0; e < c.length; e++) {
		let t = c[e], r, o = t.index ?? e;
		if (a) r = new ze(t.label, t.atomType, new Se(...t.position), It(t.adp));
		else try {
			r = ze.fromCIF(i, o);
		} catch (e) {
			if (e.message.includes("Dummy atom")) continue;
			throw e;
		}
		let p = n.resolveAtom({
			atom: r,
			index: o,
			block: i,
			wavelength: s
		});
		if (!p || typeof p.scatteringAt != "function") throw Error(`No scattering-factor model for atom ${r.label} (${r.atomType})`);
		let m = p.source ?? "unknown";
		u[m] = (u[m] ?? 0) + 1;
		let h = p.scatteringKey ?? p.scatteringAt, g = f.get(h);
		g === void 0 && (g = d.length, f.set(h, g), d.push({
			scatteringAt: p.scatteringAt,
			atoms: []
		})), l.push({
			atom: r,
			occupancy: G(t.occupancy) ?? 1,
			scatteringModelIndex: g
		});
	}
	let p = o.fractToCartMatrix.toArray(), m = R(p), h = L(m), g = Array.isArray(h) ? h : h.toArray(), _ = (a?.symmetryOperations ?? je.fromCIF(i).symmetryOperations.map((e) => ({
		rotation: e.rotMatrix,
		translation: e.transVector
	}))).map((e) => ({
		operation: {
			rotation: e.rotation,
			translation: e.translation
		},
		cartesianRotation: I(I(p, e.rotation), m)
	})), v = 0;
	for (let e of l) {
		let t = /* @__PURE__ */ new Set(), n = e.atom.position instanceof Se ? [
			e.atom.position.x,
			e.atom.position.y,
			e.atom.position.z
		] : I(m, [
			e.atom.position.x,
			e.atom.position.y,
			e.atom.position.z
		]);
		for (let r of _) {
			let i = re(I(r.operation.rotation, n), r.operation.translation), a = Array.isArray(i) ? i : i.toArray(), s = Nt(a);
			if (t.has(s)) continue;
			t.add(s);
			let c = {
				position: a,
				occupancy: e.occupancy,
				displacement: jt(e.atom, o, r.cartesianRotation)
			};
			v++, d[e.scatteringModelIndex].atoms.push(c);
		}
	}
	let y = l.filter((e) => Lt(e.atom.adp, o)).map((e) => e.atom.label);
	function b(e, t, n) {
		let r = g.map((r) => r[0] * e + r[1] * t + r[2] * n), i = r.reduce((e, t) => e + t ** 2, 0), a = i / 4, o = 0, s = 0;
		for (let c = 0; c < d.length; c++) {
			let l = d[c], u = l.scatteringAt(a);
			for (let a of l.atoms) {
				let c = At * (e * a.position[0] + t * a.position[1] + n * a.position[2]), l = a.occupancy * Mt(a.displacement, r, i), d = Math.cos(c), f = Math.sin(c);
				o += l * (u.real * d - u.imaginary * f), s += l * (u.real * f + u.imaginary * d);
			}
		}
		return {
			real: o,
			imaginary: s
		};
	}
	return {
		coefficientAt: b,
		calculate(e) {
			return e.map((e) => {
				let [t, n, r] = Pt(e), i = b(t, n, r);
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
			wavelength: s,
			atomCount: l.length,
			expandedAtomCount: v,
			scatteringModelCount: d.length,
			sourceCounts: u,
			npdAdpCount: y.length,
			npdAdpLabels: y
		}
	};
}
//#endregion
//#region src/lib/density/anomalous-dispersion.js
var Bt = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf".split(" "), Vt = Object.fromEntries(Object.entries({
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
	if (n.length !== Bt.length || r.length !== Bt.length) throw Error(`Invalid internal anomalous-dispersion table: ${e}`);
	return [e, {
		wavelength: t.wavelength,
		values: new Map(Bt.map((e, t) => [e, {
			real: n[t],
			imaginary: r[t]
		}]))
	}];
}));
function Ht(e) {
	let t = String(e).trim().match(/^([A-Za-z]{1,2})/);
	if (!t) return null;
	if (t[1].toUpperCase() === "D") return "H";
	let n = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase();
	return Bt.includes(n) ? n : null;
}
function Ut(e, t) {
	if (e.table !== void 0) {
		let t = String(e.table).toLowerCase().replace(/[^a-z]/g, "").slice(0, 2), n = Vt[t];
		if (!n) throw Error("Anomalous-dispersion table must be \"Cu\" or \"Mo\"");
		return {
			key: t,
			...n
		};
	}
	if (!Number.isFinite(t)) return null;
	let n = G(e.wavelengthTolerance) ?? .005, r = Object.entries(Vt).find(([, e]) => Math.abs(e.wavelength - t) <= n);
	return r ? {
		key: r[0],
		...r[1]
	} : null;
}
function Wt(e, t, n = {}) {
	let r = Ht(e), i = Ut(n, G(t)), a = r && i?.values.get(r);
	return a ? {
		...a,
		table: i.key,
		wavelength: i.wavelength
	} : null;
}
function Gt(e, t, n) {
	let r = Dt(e, t), i = K(r, n), a = K(r, [
		"_atom_site_dispersion.real",
		"_atom_site_dispersion_real",
		"_atom_type_scat.dispersion_real",
		"_atom_type_scat_dispersion_real"
	]), o = K(r, [
		"_atom_site_dispersion.imag",
		"_atom_site_dispersion_imag",
		"_atom_type_scat.dispersion_imag",
		"_atom_type_scat_dispersion_imag"
	]), s = /* @__PURE__ */ new Map();
	if (!i || !a && !o) return s;
	for (let e = 0; e < i.length; e++) s.set(String(i[e]), {
		real: a ? G(a[e]) : null,
		imaginary: o ? G(o[e]) : null
	});
	return s;
}
function Kt(e, t, n) {
	let r = e.values ?? e.fallbackValues;
	if (!r) return null;
	let i = r[t] ?? r[n];
	return Array.isArray(i) ? {
		real: G(i[0]),
		imaginary: G(i[1])
	} : i && typeof i == "object" ? {
		real: G(i.real ?? i.fPrime),
		imaginary: G(i.imaginary ?? i.fDoublePrime)
	} : null;
}
function qt(e, t) {
	return !e && !t ? null : {
		real: e?.real ?? t?.real ?? null,
		imaginary: e?.imaginary ?? t?.imaginary ?? null
	};
}
function Jt(e, t, n, r, i, a) {
	let o = Ht(e), s = Kt(a, e, o), c = qt(s, o ? i?.values.get(o) : null), l = r.get(String(e)) ?? r.get(o), u = qt(n.get(String(t)), qt(l, c));
	if (!u || u.real === null || u.imaginary === null) throw Error(`No complete anomalous-dispersion factors for atom ${t} (${e}); provide them in the CIF or select a supported internal table`);
	let d = n.has(String(t)) ? "site-cif" : l ? "type-cif" : s ? "configured" : "internal";
	return {
		real: u.real,
		imaginary: u.imaginary,
		source: d
	};
}
function Yt(e, t = 0, n = {}, r = null) {
	let i, a, o, s = zt(e, t, {
		expectedCell: r,
		wavelength: n.wavelength,
		structureModel: n.structureModel,
		resolveAtom({ atom: e, block: t, wavelength: r }) {
			i ??= Ut(n, r), a ??= Gt(t, ["_atom_site_dispersion"], ["_atom_site_dispersion.label", "_atom_site_dispersion_label"]), o ??= Gt(t, ["_atom_type", "_atom_type_scat"], ["_atom_type.symbol", "_atom_type_symbol"]);
			let s = Jt(e.atomType, e.label, a, o, i, n);
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
var Xt = new Map("H 0.493002 0.322912 0.140191 0.04081 10.5109 26.1257 3.14236 57.7997 0.003038\nHe 0.8734 0.6309 0.3112 0.178 9.1037 3.3568 22.9276 0.9821 0.0064\nLi 1.1282 0.7508 0.6175 0.4653 3.9546 1.0524 85.3905 168.261 0.0377\nBe 1.5919 1.1278 0.5391 0.7029 43.6427 1.8623 103.483 0.542 0.0385\nB 2.0545 1.3326 1.0979 0.7068 23.2185 1.021 60.3498 0.1403 -0.1932\nC 2.31 1.02 1.5886 0.865 20.8439 10.2075 0.5687 51.6512 0.2156\nN 12.2126 3.1322 2.0125 1.1663 0.0057 9.8933 28.9975 0.5826 -11.529\nO 3.0485 2.2868 1.5463 0.867 13.2771 5.7011 0.3239 32.9089 0.2508\nF 3.5392 2.6412 1.517 1.0243 10.2825 4.2944 0.2615 26.1476 0.2776\nNe 3.9553 3.1125 1.4546 1.1251 8.4042 3.4262 0.2306 21.7184 0.3515\nNa 4.7626 3.1736 1.2674 1.1128 3.285 8.8422 0.3136 129.424 0.676\nMg 5.4204 2.1735 1.2269 2.3073 2.8275 79.2611 0.3808 7.1937 0.8584\nAl 6.4202 1.9002 1.5936 1.9646 3.0387 0.7426 31.5472 85.0886 1.1151\nSi 6.2915 3.0353 1.9891 1.541 2.4386 32.3337 0.6785 81.6937 1.1407\nP 6.4345 4.1791 1.78 1.4908 1.9067 27.157 0.526 68.1645 1.1149\nS 6.9053 5.2034 1.4379 1.5863 1.4679 22.2151 0.2536 56.172 0.8669\nCl 11.4604 7.1964 6.2556 1.6455 0.0104 1.1662 18.5194 47.7784 -9.5574\nAr 7.4845 6.7723 0.6539 1.6442 0.9072 14.8407 43.8983 33.3929 1.4445\nK 8.2186 7.4398 1.0519 0.8659 12.7949 0.7748 213.187 41.6841 1.4228\nCa 8.6266 7.3873 1.5899 1.0211 10.4421 0.6599 85.7484 178.437 1.3751\nSc 9.189 7.3679 1.6409 1.468 9.0213 0.5729 136.108 51.3531 1.3329\nTi 9.7595 7.3558 1.6991 1.9021 7.8508 0.5 35.6338 116.105 1.2807\nV 10.2971 7.3511 2.0703 2.0571 6.8657 0.4385 26.8938 102.478 1.2199\nCr 10.6406 7.3537 3.324 1.4922 6.1038 0.392 20.2626 98.7399 1.1832\nMn 11.2819 7.3573 3.0193 2.2441 5.3409 0.3432 17.8674 83.7543 1.0896\nFe 11.7695 7.3573 3.5222 2.3045 4.7611 0.3072 15.3535 76.8805 1.0369\nCo 12.2841 7.3409 4.0034 2.3488 4.2791 0.2784 13.5359 71.1692 1.0118\nNi 12.8376 7.292 4.4438 2.38 3.8785 0.2565 12.1763 66.3421 1.0341\nCu 13.338 7.1676 5.6158 1.6735 3.5828 0.247 11.3966 64.8126 1.191\nZn 14.0743 7.0318 5.1652 2.41 3.2655 0.2333 10.3163 58.7097 1.3041\nGa 15.2354 6.7006 4.3591 2.9623 3.0669 0.2412 10.7805 61.4135 1.7189\nGe 16.0816 6.3747 3.7068 3.683 2.8509 0.2516 11.4468 54.7625 2.1313\nAs 16.6723 6.0701 3.4313 4.2779 2.6345 0.2647 12.9479 47.7972 2.531\nSe 17.0006 5.8196 3.9731 4.3543 2.4098 0.2726 15.2372 43.8163 2.8409\nBr 17.1789 5.2358 5.6377 3.9851 2.1723 16.5796 0.2609 41.4328 2.9557\nKr 17.3555 6.7286 5.5493 3.5375 1.9384 16.5623 0.2261 39.3972 2.825\nRb 17.1784 9.6435 5.1399 1.5292 1.7888 17.3151 0.2748 164.934 3.4873\nSr 17.5663 9.8184 5.422 2.6694 1.5564 14.0988 0.1664 132.376 2.5064\nY 17.776 10.2946 5.72629 3.26588 1.4029 12.8006 0.125599 104.354 1.91213\nZr 17.8765 10.948 5.41732 3.65721 1.27618 11.916 0.117622 87.6627 2.06929\nNb 17.6142 12.0144 4.04183 3.53346 1.18865 11.766 0.204785 69.7957 3.75591\nMo 3.7025 17.2356 12.8876 3.7429 0.2772 1.0958 11.004 61.6584 4.3875\nTc 19.1301 11.0948 4.64901 2.71263 0.864132 8.14487 21.5707 86.8472 5.40428\nRu 19.2674 12.9182 4.86337 1.56756 0.80852 8.43467 24.7997 94.2928 5.37874\nRh 19.2957 14.3501 4.73425 1.28918 0.751536 8.21758 25.8749 98.6062 5.328\nPd 19.3319 15.5017 5.29537 0.605844 0.698655 7.98929 25.2052 76.8986 5.26593\nAg 19.2808 16.6885 4.8045 1.0463 0.6446 7.4726 24.6605 99.8156 5.179\nCd 19.2214 17.6444 4.461 1.6029 0.5946 6.9089 24.7008 87.4825 5.0694\nIn 19.1624 18.5596 4.2948 2.0396 0.5476 6.3776 25.8499 92.8029 4.9391\nSn 19.1889 19.1005 4.4585 2.4663 5.8303 0.5031 26.8909 83.9571 4.7821\nSb 19.6418 19.0455 5.0371 2.6827 5.3034 0.4607 27.9074 75.2825 4.5909\nTe 19.9644 19.0138 6.14487 2.5239 4.81742 0.420885 28.5284 70.8403 4.352\nI 20.1472 18.9949 7.5138 2.2735 4.347 0.3814 27.766 66.8776 4.0712\nXe 20.2933 19.0298 8.9767 1.99 3.9282 0.344 26.4659 64.2658 3.7118\nCs 20.3892 19.1062 10.662 1.4953 3.569 0.3107 24.3879 213.904 3.3352\nBa 20.3361 19.297 10.888 2.6959 3.216 0.2756 20.2073 167.202 2.7731\nLa 20.578 19.599 11.3727 3.28719 2.94817 0.244475 18.7726 133.124 2.14678\nCe 21.1671 19.7695 11.8513 3.33049 2.81219 0.226836 17.6083 127.113 1.86264\nPr 22.044 19.6697 12.3856 2.82428 2.77393 0.222087 16.7669 143.644 2.0583\nNd 22.6845 19.6847 12.774 2.85137 2.66248 0.210628 15.885 137.903 1.98486\nPm 23.3405 19.6095 13.1235 2.87516 2.5627 0.202088 15.1009 132.721 2.02876\nSm 24.0042 19.4258 13.4396 2.89604 2.47274 0.196451 14.3996 128.007 2.20963\nEu 24.6274 19.0886 13.7603 2.9227 2.3879 0.1942 13.7546 123.174 2.5745\nGd 25.0709 19.0798 13.8518 3.54545 2.25341 0.181951 12.9331 101.398 2.4196\nTb 25.8976 18.2185 14.3167 2.95354 2.24256 0.196143 12.6648 115.362 3.58324\nDy 26.507 17.6383 14.5596 2.96577 2.1802 0.202172 12.1899 111.874 4.29728\nHo 26.9049 17.294 14.5583 3.63837 2.07051 0.19794 11.4407 92.6566 4.56796\nEr 27.6563 16.4285 14.9779 2.98233 2.07356 0.223545 11.3604 105.703 5.92046\nTm 28.1819 15.8851 15.1542 2.98706 2.02859 0.238849 10.9975 102.961 6.75621\nYb 28.6641 15.4345 15.3087 2.98963 1.9889 0.257119 10.6647 100.417 7.56672\nLu 28.9476 15.2208 15.1 3.71601 1.90182 9.98519 0.261033 84.3298 7.97628\nHf 29.144 15.1726 14.7586 4.30013 1.83262 9.5999 0.275116 72.029 8.58154\nTa 29.2024 15.2293 14.5135 4.76492 1.77333 9.37046 0.295977 63.3644 9.24354\nW 29.0818 15.43 14.4327 5.11982 1.72029 9.2259 0.321703 57.056 9.8875\nRe 28.7621 15.7189 14.5564 5.44174 1.67191 9.09227 0.3505 52.0861 10.472\nOs 28.1894 16.155 14.9305 5.67589 1.62903 8.97948 0.382661 48.1647 11.0005\nIr 27.3049 16.7296 15.6115 5.83377 1.59279 8.86553 0.417916 45.0011 11.4722\nPt 27.0059 17.7639 15.7131 5.7837 1.51293 8.81174 0.424593 38.6103 11.6883\nAu 16.8819 18.5913 25.5582 5.86 0.4611 8.6216 1.4826 36.3956 12.0658\nHg 20.6809 19.0417 21.6575 5.9676 0.545 8.4484 1.5729 38.3246 12.6089\nTl 27.5446 19.1584 15.538 5.52593 0.65515 8.70751 1.96347 45.8149 13.1746\nPb 31.0617 13.0637 18.442 5.9696 0.6902 2.3576 8.618 47.2579 13.4118\nBi 33.3689 12.951 16.5877 6.4692 0.704 2.9238 8.7937 48.0093 13.5782\nPo 34.6726 15.4733 13.1138 7.02588 0.700999 3.55078 9.55642 47.0045 13.677\nAt 35.3163 19.0211 9.49887 7.42518 0.68587 3.97458 11.3824 45.4715 13.7108\nRn 35.5631 21.2816 8.0037 7.4433 0.6631 4.0691 14.0422 44.2473 13.6905\nFr 35.9299 23.0547 12.1439 2.11253 0.646453 4.17619 23.1052 150.645 13.7247\nRa 35.763 22.9064 12.4739 3.21097 0.616341 3.87135 19.9887 142.325 13.6211\nAc 35.6597 23.1032 12.5977 4.08655 0.589092 3.65155 18.599 117.02 13.5266\nTh 35.5645 23.4219 12.7473 4.80703 0.563359 3.46204 17.8309 99.1722 13.4314\nPa 35.8847 23.2948 14.1891 4.17287 0.547751 3.41519 16.9235 105.251 13.4287\nU 36.0228 23.4128 14.9491 4.188 0.5293 3.3253 16.0927 100.613 13.3966\nNp 36.1874 23.5964 15.6402 4.1855 0.511929 3.25396 15.3622 97.4908 13.3573\nPu 36.5254 23.8083 16.7707 3.47947 0.499384 3.26371 14.9455 105.98 13.3812\nAm 36.6706 24.0992 17.3415 3.49331 0.483629 3.20647 14.3136 102.273 13.3592\nCm 36.6488 24.4096 17.399 4.21665 0.465154 3.08997 13.4346 88.4834 13.2887\nBk 36.7881 24.7736 17.8919 4.23284 0.451018 3.04619 12.8946 86.003 13.2754\nCf 36.9185 25.1995 18.3317 4.24391 0.437533 3.00775 12.4044 83.7881 13.2674".split("\n").map((e) => {
	let [t, ...n] = e.trim().split(/\s+/);
	if (n.length !== 9 || n.some((e) => !Number.isFinite(Number(e)))) throw Error(`Invalid internal Cromer-Mann coefficients for ${t}`);
	return [t, n.map(Number)];
}));
function Zt(e) {
	let t = Xt.get(e === "D" ? "H" : e);
	return t ? [...t] : null;
}
function Qt(e, t) {
	let n = e[8];
	for (let r = 0; r < 4; r++) n += e[r] * Math.exp(-e[r + 4] * t);
	return n;
}
//#endregion
//#region src/lib/density/iam-structure-factors.js
var $t = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf".split(" "), en = [
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
function tn(e) {
	let t = String(e).trim().match(/^([A-Za-z]{1,2})/);
	if (!t) return null;
	if (t[1].toUpperCase() === "D") return "H";
	let n = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase();
	return $t.includes(n) ? n : null;
}
function nn(e) {
	let t = Dt(e, ["_atom_type", "_atom_type_scat"]), n = K(t, ["_atom_type.symbol", "_atom_type_symbol"]), r = en.map((e) => K(t, [
		`_atom_type_scat.Cromer_Mann_${e}`,
		`_atom_type_scat_Cromer_Mann_${e}`,
		`_atom_type.scat_Cromer_Mann_${e}`
	])), i = /* @__PURE__ */ new Map();
	if (!n || r.some((e) => !e)) return i;
	for (let e = 0; e < n.length; e++) {
		let t = r.map((t) => G(t[e]));
		if (t.every((e) => e !== null)) {
			let r = String(n[e]);
			i.set(r, t);
			let a = tn(r);
			a && !i.has(a) && i.set(a, t);
		}
	}
	return i;
}
function rn(e, t, n) {
	let r = Dt(e, t), i = K(r, n), a = K(r, [
		"_atom_site_dispersion.real",
		"_atom_site_dispersion_real",
		"_atom_type_scat.dispersion_real",
		"_atom_type_scat_dispersion_real"
	]), o = K(r, [
		"_atom_site_dispersion.imag",
		"_atom_site_dispersion_imag",
		"_atom_type_scat.dispersion_imag",
		"_atom_type_scat_dispersion_imag"
	]), s = /* @__PURE__ */ new Map();
	if (!i || !a && !o) return s;
	for (let e = 0; e < i.length; e++) s.set(String(i[e]), {
		real: a ? G(a[e]) : null,
		imaginary: o ? G(o[e]) : null
	});
	return s;
}
function an(e, t, n) {
	let r = e.cromerMann?.[t] ?? e.cromerMann?.[n];
	if (!Array.isArray(r) || r.length !== 9) return null;
	let i = r.map(G);
	return i.every((e) => e !== null) ? i : null;
}
function on(e, t, n) {
	let r = e.dispersionValues?.[t] ?? e.dispersionValues?.[n];
	return Array.isArray(r) ? {
		real: G(r[0]),
		imaginary: G(r[1])
	} : r && typeof r == "object" ? {
		real: G(r.real ?? r.fPrime),
		imaginary: G(r.imaginary ?? r.fDoublePrime)
	} : null;
}
function sn(e) {
	return e?.real !== null && e?.real !== void 0 && e?.imaginary !== null && e?.imaginary !== void 0;
}
function cn(e, t) {
	return {
		real: e?.real ?? t?.real ?? null,
		imaginary: e?.imaginary ?? t?.imaginary ?? null
	};
}
function ln(e, t = 0, n = {}) {
	let r, i, a, o = n.includeAnomalous !== !1, s = zt(e, t, {
		expectedCell: n.expectedCell,
		wavelength: n.wavelength,
		structureModel: n.structureModel,
		resolveAtom({ atom: e, block: t, wavelength: s }) {
			r ??= nn(t), i ??= rn(t, ["_atom_type", "_atom_type_scat"], ["_atom_type.symbol", "_atom_type_symbol"]), a ??= rn(t, ["_atom_site_dispersion"], ["_atom_site_dispersion.label", "_atom_site_dispersion_label"]);
			let c = tn(e.atomType), l = r.get(e.atomType) ?? r.get(c), u = an(n, e.atomType, c), d = l ?? u ?? Zt(c);
			if (!d) throw Error(`No Cromer-Mann coefficients for atom ${e.label} (${e.atomType})`);
			let f = {
				real: 0,
				imaginary: 0
			}, p = "disabled";
			if (o) {
				let t = a.get(e.label), r = i.get(e.atomType) ?? i.get(c), o = on(n, e.atomType, c), l = cn(t, cn(r, cn(o, Wt(c, s, n.anomalous ?? {}))));
				sn(l) ? (f = l, p = t ? "site-cif" : r ? "type-cif" : o ? "configured" : "internal") : p = "zero";
			}
			return {
				source: `${l ? "cif" : u ? "configured" : "internal"}/${p}`,
				scatteringKey: JSON.stringify([
					...d,
					f.real,
					f.imaginary
				]),
				scatteringAt(e) {
					return {
						real: Qt(d, e) + f.real,
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
function un(e, t, n = {}) {
	return ln(e, n.cifBlock ?? 0, n).calculate(t);
}
//#endregion
//#region src/lib/density/reciprocal-symmetry.js
var dn = 2 * Math.PI, fn = /* @__PURE__ */ new WeakMap();
function pn(e, t, n = 1e-6) {
	return e.map((e) => {
		let r = e[0] * t[0] + e[1] * t[1] + e[2] * t[2], i = Math.round(r);
		if (Math.abs(r - i) > n) throw Error(`Symmetry operation produced a non-integral reflection index: ${r}`);
		return Object.is(i, -0) ? 0 : i;
	});
}
function mn(e) {
	let t = fn.get(e);
	return t || (t = e.symmetryOperations.map((e) => ({
		operation: e,
		reciprocalRotation: L(R(e.rotMatrix)),
		positionReciprocalRotation: L(e.rotMatrix),
		translation: e.transVector
	})), fn.set(e, t)), t;
}
function hn(e, t) {
	for (let n = 0; n < 3; n++) if (e[n] !== t[n]) return e[n] - t[n];
	return 0;
}
function gn(e, t, n, r, i = !0) {
	let a = mn(r).map((r) => pn(r.reciprocalRotation, [
		e,
		t,
		n
	]));
	return i && a.push(...a.map((e) => e.map((e) => e === 0 ? 0 : -e))), a.sort(hn), a[0];
}
function _n(e, t, n, r, i = 1e-8) {
	if (e === 0 && t === 0 && n === 0) return !1;
	let a = /* @__PURE__ */ new Map();
	for (let i of mn(r)) {
		let r = pn(i.positionReciprocalRotation, [
			e,
			t,
			n
		]).join(","), o = dn * (e * i.translation[0] + t * i.translation[1] + n * i.translation[2]), s = a.get(r) ?? {
			real: 0,
			imaginary: 0
		};
		s.real += Math.cos(o), s.imaginary += Math.sin(o), a.set(r, s);
	}
	return [...a.values()].every((e) => Math.hypot(e.real, e.imaginary) <= i);
}
//#endregion
//#region src/lib/density/reflection-intensities.js
function vn(e, t) {
	return [t, ...e.getAllBlocks().filter((e) => e !== t)];
}
function yn(e, t, n) {
	return [
		e,
		t,
		n
	].every((e) => Number.isInteger(e));
}
function bn(e, t, n, r, i = null) {
	let a = [
		e,
		t,
		n,
		r
	].map((e) => e?.length);
	if (a.some((e) => e === void 0) || !a.every((e) => e === a[0])) throw Error("Reflection index and intensity columns must have the same row count");
	if (i && i.length !== a[0]) throw Error("Reflection intensity and uncertainty columns must have the same row count");
	let o = [], s = 0;
	for (let c = 0; c < a[0]; c++) {
		let a = G(e[c]), l = G(t[c]), u = G(n[c]), d = G(r[c]), f = i ? G(i[c]) : null;
		if (!yn(a, l, u) || d === null || i && f === null) {
			s++;
			continue;
		}
		o.push({
			h: a,
			k: l,
			l: u,
			intensity: d,
			sigma: f,
			sourceIndex: c
		});
	}
	return {
		rows: o,
		invalidCount: s
	};
}
function xn(e) {
	let t = K(e, ["_refln.index_h", "_refln_index_h"]), n = K(e, ["_refln.index_k", "_refln_index_k"]), r = K(e, ["_refln.index_l", "_refln_index_l"]), i = K(e, ["_refln.intensity_meas", "_refln_intensity_meas"]);
	if (i) return {
		...bn(t, n, r, i, K(e, [
			"_refln.intensity_sigma",
			"_refln_intensity_sigma",
			"_refln.intensity_meas_su",
			"_refln_intensity_meas_su"
		])),
		valueKind: "intensity"
	};
	let a = K(e, ["_refln.F_squared_meas", "_refln_F_squared_meas"]);
	if (a) return {
		...bn(t, n, r, a, K(e, [
			"_refln.F_squared_sigma",
			"_refln_F_squared_sigma",
			"_refln.F_squared_meas_su",
			"_refln_F_squared_meas_su"
		])),
		valueKind: "F-squared"
	};
	let o = K(e, ["_refln.F_meas", "_refln_F_meas"]);
	if (o) {
		let i = K(e, ["_refln.F_sigma", "_refln_F_sigma"]);
		return {
			...bn(t, n, r, o.map((e) => {
				let t = G(e);
				return t === null ? null : t ** 2;
			}), i?.map((e, t) => {
				let n = G(e), r = G(o[t]);
				return n === null || r === null ? null : 2 * Math.abs(r) * n;
			}) ?? null),
			valueKind: "F-amplitude-squared"
		};
	}
	throw Error("The _refln loop contains no measured intensity, F-squared, or F columns");
}
function Sn(e) {
	let t = K(e, ["_diffrn_refln.index_h", "_diffrn_refln_index_h"]), n = K(e, ["_diffrn_refln.index_k", "_diffrn_refln_index_k"]), r = K(e, ["_diffrn_refln.index_l", "_diffrn_refln_index_l"]), i = K(e, [
		"_diffrn_refln.intensity_net",
		"_diffrn_refln_intensity_net",
		"_diffrn_refln.intensity_meas",
		"_diffrn_refln_intensity_meas"
	]), a = K(e, [
		"_diffrn_refln.intensity_u",
		"_diffrn_refln_intensity_u",
		"_diffrn_refln.intensity_sigma",
		"_diffrn_refln_intensity_sigma",
		"_diffrn_refln.intensity_net_su",
		"_diffrn_refln_intensity_net_su"
	]);
	if (!i) throw Error("The _diffrn_refln loop contains no net measured intensity column");
	return bn(t, n, r, i, a);
}
function Cn(e) {
	let t = [
		e.slice(0, 4),
		e.slice(4, 8),
		e.slice(8, 12),
		e.slice(12, 20),
		e.slice(20, 28),
		e.slice(28, 32)
	].map((e) => e.trim());
	return t.slice(0, 5).some((e) => e.length === 0) ? null : t;
}
function wn(e) {
	let t = [], n = 0;
	for (let [r, i] of String(e).split(/\r?\n/).entries()) {
		if (i.trim().length === 0) continue;
		let [e, a, o, s, c] = i.trim().split(/\s+/).slice(0, 5).map(G);
		if (!yn(e, a, o) || s === null || c === null) {
			let t = Cn(i);
			[e, a, o, s, c] = t ? t.slice(0, 5).map(G) : [
				null,
				null,
				null,
				null,
				null
			];
		}
		if (!yn(e, a, o) || s === null || c === null) {
			n++;
			continue;
		}
		if (e === 0 && a === 0 && o === 0 && s === 0 && c === 0) break;
		t.push({
			h: e,
			k: a,
			l: o,
			intensity: s,
			sigma: c,
			sourceIndex: r
		});
	}
	return {
		rows: t,
		invalidCount: n
	};
}
function Tn(e) {
	e.parse();
	let t = Object.keys(e.data).find((e) => /shelx.*hkl_file/i.test(e));
	return t ? e.data[t] : null;
}
function En(e) {
	let t = [];
	for (let n of ["_iucr_refine_fcf_details"]) {
		let r;
		try {
			r = e.get(n);
		} catch {
			continue;
		}
		if (!(typeof r != "string" || !r.includes("data_"))) try {
			for (let e of new j(r).getAllBlocks()) {
				let n = Dt(e, "_refln");
				n && t.push(n);
			}
		} catch {}
	}
	return t;
}
function Dn(e, t, n, r, i = 1e-8) {
	return _n(e, t, n, r, i);
}
function On(e, t, n = {}) {
	let r = n.mergeFriedel !== !1, i = n.removeSystematicAbsences !== !1, a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = 0;
	for (let l of e) {
		let e = `${l.h},${l.k},${l.l}`, u = o.get(e);
		if (u === void 0 && (u = i && Dn(l.h, l.k, l.l, t, n.absenceTolerance), o.set(e, u)), u) {
			c++;
			continue;
		}
		let d = s.get(e);
		d || (d = gn(l.h, l.k, l.l, t, r), s.set(e, d));
		let [f, p, m] = d, h = `${f},${p},${m}`;
		a.has(h) || a.set(h, {
			h: f,
			k: p,
			l: m,
			observations: []
		}), a.get(h).observations.push(l);
	}
	let l = [...a.values()].map((e) => {
		let t = e.observations.every((e) => e.sigma > 0), n, r;
		if (t) {
			let t = e.observations.reduce((e, t) => e + 1 / t.sigma ** 2, 0);
			n = e.observations.reduce((e, t) => e + t.intensity / t.sigma ** 2, 0) / t, r = Math.sqrt(1 / t);
		} else n = e.observations.reduce((e, t) => e + t.intensity, 0) / e.observations.length, r = e.observations.every((e) => e.sigma !== null) ? Math.sqrt(e.observations.reduce((e, t) => e + t.sigma ** 2, 0)) / e.observations.length : null;
		return {
			h: e.h,
			k: e.k,
			l: e.l,
			intensity: n,
			sigma: r,
			multiplicity: e.observations.length
		};
	});
	return l.sort((e, t) => hn([
		e.h,
		e.k,
		e.l
	], [
		t.h,
		t.k,
		t.l
	])), {
		reflections: l,
		systematicAbsenceCount: c
	};
}
function kn(e, t = 0, n = {}) {
	let r = new j(e), i = typeof t == "number" ? r.getBlock(t) : r.getBlockByName(t), a = vn(r, i), o = n.source ?? "auto", s = (e) => o === "auto" || o === e;
	if (s("refln")) {
		let e = [...a.map((e) => Dt(e, "_refln")).filter(Boolean).map((e) => ({
			loop: e,
			source: "refln"
		})), ...a.flatMap(En).map((e) => ({
			loop: e,
			source: "embedded-refln"
		}))], t = null;
		for (let n of e) try {
			let e = xn(n.loop);
			return {
				reflections: e.rows.map((e) => ({
					...e,
					multiplicity: 1
				})),
				metadata: {
					source: n.source,
					valueKind: e.valueKind,
					alreadyMerged: !0,
					inputCount: e.rows.length + e.invalidCount,
					outputCount: e.rows.length,
					invalidCount: e.invalidCount,
					systematicAbsenceCount: 0,
					mergeFriedel: null
				}
			};
		} catch (e) {
			if (!e.message.includes("contains no measured")) throw e;
			t = e;
		}
		if (o === "refln" && t) throw t;
	}
	let c, l;
	if (s("diffrn_refln")) {
		let e = a.map((e) => Dt(e, "_diffrn_refln")).find(Boolean);
		e && (c = Sn(e), l = "diffrn_refln");
	}
	if (!c && s("shelx_hkl_file")) {
		let e = a.map(Tn).find((e) => typeof e == "string");
		e && (c = wn(e), l = "shelx_hkl_file");
	}
	if (!c) throw Error(`No usable reflection intensities found for source "${o}"`);
	let u = je.fromCIF(i), d = On(c.rows, u, n);
	return {
		reflections: d.reflections,
		metadata: {
			source: l,
			valueKind: "intensity",
			alreadyMerged: !1,
			inputCount: c.rows.length + c.invalidCount,
			outputCount: d.reflections.length,
			invalidCount: c.invalidCount,
			systematicAbsenceCount: d.systematicAbsenceCount,
			mergeFriedel: n.mergeFriedel !== !1
		}
	};
}
//#endregion
//#region src/lib/density/extinction-correction.js
function An(e, t, n, r) {
	if (!(e > 0) || !(t > 0) || n === 0) return 1;
	let i = r * t / 2;
	if (!(i > 0 && i < 1)) throw Error(`Cannot apply SHELXL extinction at sin(theta)=${i}; check the radiation wavelength and reflection indices`);
	let a = 2 * i * Math.sqrt(1 - i ** 2);
	return (1 + .001 * n * e * r ** 3 / a) ** -.25;
}
function jn(e, t, n, r, i, a = !0) {
	let o = (e, t = {}) => ({
		factors: Array(r.length).fill(1),
		metadata: {
			enabled: !1,
			model: "SHELXL-isotropic",
			reason: e,
			...t
		}
	});
	if (a === !1) return o("disabled");
	if (a !== !0 && typeof a != "number" && (typeof a != "object" || !a || Array.isArray(a))) throw Error("extinctionCorrection must be true, false, a coefficient, or an object");
	let s = G(typeof a == "number" ? a : a?.coefficient), c = Ot(e, ["_refine_ls.extinction_coef", "_refine_ls_extinction_coef"]), l = s ?? c, u = s === null ? "cif" : "configured";
	if (l === null) return o("not-reported");
	if (l < 0) throw Error("SHELXL extinction coefficient must not be negative");
	if (l === 0) return o("zero-coefficient", {
		coefficient: l,
		source: u
	});
	let d = kt(e, ["_refine_ls.extinction_method", "_refine_ls_extinction_method"]), f = kt(e, ["_refine_ls.extinction_expression", "_refine_ls_extinction_expression"]);
	if (!(/shelxl/i.test(d ?? "") || /0\.001/i.test(f ?? "") && /sin\s*\(?\s*2/i.test(f ?? "")) && s === null) return o("unsupported-model", {
		coefficient: l,
		source: u,
		method: d,
		expression: f
	});
	let p = (typeof a == "object" ? G(a.wavelength) : null) ?? n;
	if (!(p > 0)) throw Error("SHELXL extinction correction requires a positive radiation wavelength");
	if (r.length !== i.length) throw Error("Extinction correction requires matching observed and calculated reflections");
	let m = L(R(t.fractToCartMatrix)), h = r.map((e, t) => {
		let n = se(I(m, [
			e.h,
			e.k,
			e.l
		]));
		return An(i[t].amplitude ** 2, n, l, p);
	}), g = h.reduce((e, t) => Math.min(e, t), 1);
	return {
		factors: h,
		metadata: {
			enabled: !0,
			model: "SHELXL-isotropic",
			coefficient: l,
			wavelength: p,
			source: u,
			method: d,
			expression: f,
			correctedReflectionCount: h.filter((e) => e < 1).length,
			minimumAmplitudeFactor: g,
			maximumAmplitudeCorrection: 1 / g
		}
	};
}
//#endregion
//#region src/lib/density/difference-density.js
var Mn = 2 * Math.PI, Nn = class extends Error {
	constructor(e) {
		super(e), this.name = "UnsupportedCoefficientSourceError";
	}
};
function Pn(e) {
	let t = 1;
	for (; t < e;) t *= 2;
	return Math.max(2, t);
}
function Fn(e, t) {
	return (e % t + t) % t;
}
function q(e, t, ...n) {
	try {
		return e.get(t);
	} catch (e) {
		if (n.length > 0) return n[0];
		throw e;
	}
}
function In(e) {
	let t = e.map((e) => e.length);
	if (t.some((e) => e !== t[0])) throw Error(`Reflection columns have inconsistent lengths: ${t.join(", ")}`);
}
function Ln(e, t) {
	let n = typeof e == "string" ? [e] : e;
	if (!Array.isArray(n) || n.length < 1 || n.length > 2 || n.some((e) => typeof e != "string" || e.length === 0)) throw Error(`${t} must name one or two CIF columns`);
	return n;
}
function Rn(e, t, n) {
	return Ln(t, n).map((t) => {
		try {
			return e.get(t);
		} catch {
			throw Error(`Custom density column not found: ${t}`);
		}
	});
}
function zn(e, t) {
	let n = t.amplitudes ?? t.amplitudeColumns ?? t.amplitude, r = t.phases ?? t.phaseColumns ?? t.phase, i = t.aValues ?? t.a ?? t.A, a = t.bValues ?? t.b ?? t.B, o = n !== void 0 || r !== void 0, s = i !== void 0 || a !== void 0;
	if (o === s) throw Error("Custom density columns must specify either amplitudes/phases or A/B values");
	if (s) {
		if (i === void 0 || a === void 0) throw Error("Custom density A and B columns must both be specified");
		let t = Rn(e, i, "a"), n = Rn(e, a, "b");
		if (t.length !== n.length) throw Error("Custom density A and B column counts must match");
		return In([...t, ...n]), {
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
	let c = Rn(e, n, "amplitudes"), l = Rn(e, r, "phases");
	if (l.length !== 1 && l.length !== c.length) throw Error("Use one common phase column or one phase column per amplitude");
	In([...c, ...l]);
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
function Bn(e, t) {
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
function Vn(e, t) {
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
function Hn(e, t, n, r, i, a = .05) {
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
function Un(e, t, n, r, i, a = .05, o = 1e-4) {
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
function Wn(e, t, n, r, i, a) {
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
function Gn(e, t, n, r, i, a) {
	let o = /* @__PURE__ */ new Map();
	for (let a = 0; a < e.length; a++) {
		let s = Number(e[a]), c = Number(t[a]), l = Number(n[a]), { real: u, imaginary: d } = r(a);
		if ([
			s,
			c,
			l,
			u,
			d
		].every(Number.isFinite)) for (let e of mn(i)) {
			let t = e.operation, [n, r, i] = pn(e.reciprocalRotation, [
				s,
				c,
				l
			]), a = Mn * (n * t.transVector[0] + r * t.transVector[1] + i * t.transVector[2]), f = Math.cos(a), p = Math.sin(a), m = u * f - d * p, h = u * p + d * f;
			Wn(o, n, r, i, m, h), (n !== 0 || r !== 0 || i !== 0) && Wn(o, -n, -r, -i, m, -h);
		}
	}
	a && o.delete("0,0,0");
	for (let e of o.values()) e.real /= e.count, e.imaginary /= e.count;
	return o;
}
function Kn(e, t) {
	if (e.coefficients.size === 0) throw Error("Reflection source contains no usable difference-map coefficients");
	let n = L(R(e.cell.fractToCartMatrix)), r = 0;
	for (let t of e.coefficients.values()) t.reciprocalLength = se(I(n, [
		t.h,
		t.k,
		t.l
	])), r = Math.max(r, t.reciprocalLength);
	return {
		...e,
		maximumReciprocalLength: r,
		symmetryOperations: t.symmetryOperations.map((e) => ({
			rotation: e.rotMatrix.map((e) => [...e]),
			translation: [...e.transVector]
		}))
	};
}
function qn(e, t, n, r) {
	let i = Number(n);
	if (Number.isFinite(i) && i > 0) return {
		scale: i,
		fittedReflectionCount: 0,
		explicit: !0
	};
	let a = 0, o = 0, s = 0;
	for (let n = 0; n < e.length; n++) {
		let i = e[n], c = t[n].amplitude ** 2 * r[n] ** 2;
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
function Jn(e, t = 0, n = {}) {
	let r = new j(e), i = typeof t == "number" ? r.getBlock(t) : r.getBlockByName(t), a = Re.fromCIF(i), o = je.fromCIF(i), s = {
		includeAnomalous: !1,
		...n.iam
	}, c = { ...n.reflections };
	c.mergeFriedel === void 0 && (c.mergeFriedel = s.includeAnomalous === !1);
	let l = kn(e, t, c), u = n.coordinateCifText ?? e, d = n.coordinateCifBlock ?? t, f = ln(u, d, {
		...s,
		expectedCell: a,
		structureModel: n.structureModel
	}), p = f.calculate(l.reflections), m = u === e ? r : new j(u), h = typeof d == "number" ? m.getBlock(d) : m.getBlockByName(d), g = n.extinctionCorrection ?? "auto";
	if (![
		"auto",
		!0,
		!1
	].includes(g) && typeof g != "number" && (typeof g != "object" || !g || Array.isArray(g))) throw Error("extinctionCorrection must be \"auto\", true, false, a coefficient, or an object");
	let _ = g === "auto" && l.metadata.source === "embedded-refln", v = jn(h, a, f.metadata.wavelength, l.reflections, p, _ ? !1 : g === "auto" || g);
	_ && (v.metadata.reason = "embedded-fcf-already-corrected");
	let y = qn(l.reflections, p, n.intensityScale, v.factors), b = 0, x = 0, S = 0;
	return Kn({
		cell: a,
		coefficients: Gn(l.reflections.map((e) => e.h), l.reflections.map((e) => e.k), l.reflections.map((e) => e.l), (e) => {
			let t = l.reflections[e], n = p[e], r = y.scale * t.intensity / v.factors[e] ** 2;
			r < 0 && b++;
			let i = Math.sqrt(Math.max(0, r)) - n.amplitude, a = Math.atan2(n.imaginary, n.real);
			return x += Math.abs(r - n.amplitude ** 2), S += n.amplitude ** 2, {
				real: i * Math.cos(a),
				imaginary: i * Math.sin(a)
			};
		}, o, !0),
		reflectionCount: l.reflections.length,
		coefficientMode: "fo-fc-iam-phase",
		omitF000: !0,
		anomalousDispersion: {
			enabled: f.metadata.includeAnomalous,
			target: "both",
			source: "iam"
		},
		densitySource: "cif-iam",
		densityKind: "difference",
		intensityScale: y.scale,
		intensityScaleExplicit: y.explicit,
		scaleFittedReflectionCount: y.fittedReflectionCount,
		scaleR1: S > 0 ? x / S : null,
		negativeIntensityCount: b,
		observations: l.metadata,
		iam: f.metadata,
		reflectionPolicy: {
			mergeFriedel: l.metadata.mergeFriedel,
			includeAnomalous: f.metadata.includeAnomalous
		},
		extinctionCorrection: v.metadata
	}, o);
}
function Yn(e, t) {
	try {
		let n = new j(e), r = typeof t == "number" ? n.getBlock(t) : n.getBlockByName(t), i = (e) => r.get(e, null), a = i("_cifvis_difference_density_loop"), o = i("_cifvis_difference_density_h"), s = i("_cifvis_difference_density_k"), c = i("_cifvis_difference_density_l"), l = i("_cifvis_difference_density_a"), u = i("_cifvis_difference_density_b");
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
			densityKind: "deformation"
		};
	} catch {}
	return null;
}
function Xn(e, t = 0, n = {}) {
	let r = n.inputMode ?? "auto";
	if (![
		"auto",
		"fcf",
		"cif-iam"
	].includes(r)) throw Error("Difference-density inputMode must be \"auto\", \"fcf\", or \"cif-iam\"");
	let i = n.coefficientColumns ?? Yn(e, t);
	if (r !== "cif-iam") try {
		return tr(e, t, i, n.anomalousDispersion ?? null);
	} catch (e) {
		if (r === "fcf" || i || !(e instanceof Nn)) throw e;
	}
	return Jn(e, t, n);
}
function Zn(e, t, n = !1) {
	let r = e.length;
	for (let n = 1, i = 0; n < r; n++) {
		let a = r >> 1;
		for (; i & a; a >>= 1) i ^= a;
		i ^= a, n < i && ([e[n], e[i]] = [e[i], e[n]], [t[n], t[i]] = [t[i], t[n]]);
	}
	let i = n ? 1 : -1;
	for (let n = 2; n <= r; n *= 2) {
		let a = i * Mn / n, o = Math.cos(a), s = Math.sin(a);
		for (let i = 0; i < r; i += n) {
			let r = 1, a = 0, c = n / 2;
			for (let n = 0; n < c; n++) {
				let l = i + n, u = l + c, d = e[u] * r - t[u] * a, f = e[u] * a + t[u] * r, p = e[l], m = t[l];
				e[l] = p + d, t[l] = m + f, e[u] = p - d, t[u] = m - f;
				let h = r * o - a * s;
				a = r * s + a * o, r = h;
			}
		}
	}
	if (n) for (let n = 0; n < r; n++) e[n] /= r, t[n] /= r;
}
function Qn(e, t, n, r) {
	let [i, a, o] = n, s = n[r], c = new Float64Array(s), l = new Float64Array(s), u = (n) => {
		for (let r = 0; r < s; r++) {
			let i = n(r);
			c[r] = e[i], l[r] = t[i];
		}
		Zn(c, l);
		for (let r = 0; r < s; r++) {
			let i = n(r);
			e[i] = c[r], t[i] = l[r];
		}
	};
	if (r === 0) for (let e = 0; e < o; e++) for (let t = 0; t < a; t++) {
		let n = (e * a + t) * i;
		u((e) => n + e);
	}
	else if (r === 1) for (let e = 0; e < o; e++) for (let t = 0; t < i; t++) u((n) => (e * a + n) * i + t);
	else for (let e = 0; e < a; e++) for (let t = 0; t < i; t++) u((n) => (n * a + e) * i + t);
}
function $n(e) {
	return Math.abs(ae(e.fractToCartMatrix));
}
function er(e, t, n = 1) {
	let r = 0, i = 0, a = 0;
	for (let { h: t, k: n, l: o } of e.values()) r = Math.max(r, Math.abs(t)), i = Math.max(i, Math.abs(n)), a = Math.max(a, Math.abs(o));
	let o = [
		Pn(2 * r + 1),
		Pn(2 * i + 1),
		Pn(2 * a + 1)
	].map((e) => Pn(e * Math.max(1, n))), [s, c] = o, l = o[0] * o[1] * o[2], u = new Float64Array(l), d = new Float64Array(l);
	for (let { h: t, k: n, l: r, real: i, imaginary: a } of e.values()) {
		let e = (Fn(r, o[2]) * c + Fn(n, c)) * s + Fn(t, s);
		u[e] = i, d[e] = a;
	}
	Qn(u, d, o, 0), Qn(u, d, o, 1), Qn(u, d, o, 2);
	let f = $n(t), p = new Float32Array(l), m = 0, h = Infinity, g = -Infinity, _ = 0;
	for (let e = 0; e < l; e++) {
		let t = u[e] / f;
		p[e] = t, m += t, h = Math.min(h, t), g = Math.max(g, t), _ = Math.max(_, Math.abs(d[e] / f));
	}
	let v = m / l, y = 0;
	for (let e of p) y += (e - v) ** 2;
	return {
		dimensions: o,
		values: p,
		mean: v,
		sigma: Math.sqrt(y / l),
		minimum: h,
		maximum: g,
		maxImaginary: _,
		volume: f
	};
}
function tr(e, t = 0, n = null, r = null) {
	let i = new j(e), a = typeof t == "number" ? i.getBlock(t) : i.getBlockByName(t), o = Re.fromCIF(a), s = je.fromCIF(a), c;
	try {
		c = a.get(n?.loop ?? "_refln");
	} catch (e) {
		throw n ? e : new Nn(e.message);
	}
	let l = q(c, n?.h ?? ["_refln.index_h", "_refln_index_h"]), u = q(c, n?.k ?? ["_refln.index_k", "_refln_index_k"]), d = q(c, n?.l ?? ["_refln.index_l", "_refln_index_l"]), f = q(c, ["_refln.phase_calc", "_refln_phase_calc"], null), p = q(c, ["_refln.F_calc", "_refln_F_calc"], null), m = p === null ? q(c, ["_refln.F_squared_calc", "_refln_F_squared_calc"], null) : null, h = p ?? m?.map((e) => Math.sqrt(Math.max(0, Number(e)))), g, _;
	if (n) g = zn(c, n), _ = n.omitF000 ?? !1;
	else {
		if (f === null) throw new Nn("None of the keys [_refln.phase_calc, _refln_phase_calc] found in CIF loop");
		let e = f, t = q(c, ["_refln.F_squared_meas", "_refln_F_squared_meas"], null), n = t === null ? q(c, ["_refln.F_meas", "_refln_F_meas"], null) : null, r = q(c, ["_refln.F_calc", "_refln_F_calc"], null), i = r === null ? q(c, ["_refln.F_squared_calc", "_refln_F_squared_calc"], null) : null;
		if (t === null && n === null) throw new Nn("FCF contains neither measured F nor measured F-squared values");
		if (r === null && i === null) throw new Nn("FCF contains neither calculated F nor calculated F-squared values");
		g = {
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
		}, _ = !0;
	}
	In([
		l,
		u,
		d,
		...g.valueColumns
	]);
	let v = g.coefficientAt, y = {
		enabled: !1,
		requested: !!r
	};
	if (r) {
		let e = r === !0 ? {} : r;
		if (typeof e != "object") throw Error("Anomalous-dispersion options must be true or an object");
		let t = Vn(a, e), n;
		if (e.phaseDetection === !1) n = {
			available: !1,
			disabled: !0
		};
		else {
			let t = Hn(s, l, u, d, f, Number(e.phaseToleranceDegrees) || .05);
			n = t.centrosymmetric ? t : Un(l, u, d, f, h, Number(e.phaseToleranceDegrees) || .05, Number(e.friedelAmplitudeToleranceRelative) || 1e-4);
		}
		let i = n.disabled ? "phase-detection-disabled" : n.alreadyCorrected ? "phases-already-corrected" : !n.available && t !== "olex" ? "exact-test-unavailable" : null;
		if (i) y = {
			enabled: !1,
			requested: !0,
			generator: t,
			reason: i,
			phaseCheck: n
		};
		else {
			let r = e.target ?? g.defaultAnomalousTarget ?? "first", i = Yt(e.cifText, e.cifBlock ?? 0, e, o), a = Bn(r, g.componentCount);
			v = (e) => {
				let t = g.coefficientAt(e), n = i.coefficientAt(Number(l[e]), Number(u[e]), Number(d[e]));
				return {
					real: t.real + a * n.real,
					imaginary: t.imaginary + a * n.imaginary
				};
			}, y = {
				...i.metadata,
				requested: !0,
				generator: t,
				phaseCheck: n,
				target: r,
				correctionScale: a
			};
		}
	}
	return Kn({
		cell: o,
		coefficients: Gn(l, u, d, v, s, _),
		reflectionCount: l.length,
		coefficientMode: g.mode,
		omitF000: _,
		anomalousDispersion: y,
		densitySource: "fcf",
		densityKind: n ? "deformation" : "difference"
	}, s);
}
function nr(e, t = 1, n = 1) {
	if (!(Number.isFinite(t) && t > 0 && t <= 1)) throw Error("Difference-density resolution fraction must be in the interval (0, 1]");
	let r = e.maximumReciprocalLength * t, i = t === 1 ? e.coefficients : new Map(Array.from(e.coefficients.entries()).filter(([, e]) => e.reciprocalLength <= r + 1e-12));
	if (i.size === 0) {
		let t = Math.min(...Array.from(e.coefficients.values()).map((e) => e.reciprocalLength));
		i = new Map(Array.from(e.coefficients.entries()).filter(([, e]) => e.reciprocalLength <= t + 1e-12));
	}
	if (!(Number.isFinite(n) && n >= 1)) throw Error("Difference-density grid oversampling must be at least 1");
	let a = er(i, e.cell, n);
	return new rr(e.cell, a.dimensions, a.values, {
		reflectionCount: e.reflectionCount,
		coefficientCount: i.size,
		fullCoefficientCount: e.coefficients.size,
		coefficientMode: e.coefficientMode,
		omitF000: e.omitF000,
		anomalousDispersion: e.anomalousDispersion,
		densitySource: e.densitySource,
		densityKind: e.densityKind,
		intensityScale: e.intensityScale,
		intensityScaleExplicit: e.intensityScaleExplicit,
		scaleFittedReflectionCount: e.scaleFittedReflectionCount,
		scaleR1: e.scaleR1,
		negativeIntensityCount: e.negativeIntensityCount,
		observations: e.observations,
		iam: e.iam,
		reflectionPolicy: e.reflectionPolicy,
		extinctionCorrection: e.extinctionCorrection,
		symmetryOperations: e.symmetryOperations,
		resolutionFraction: t,
		gridOversampling: n,
		mean: a.mean,
		sigma: a.sigma,
		minimum: a.minimum,
		maximum: a.maximum,
		maxImaginary: a.maxImaginary,
		volume: a.volume
	});
}
var rr = class e {
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
		let n = new Re(t.cell.a, t.cell.b, t.cell.c, t.cell.alpha, t.cell.beta, t.cell.gamma), { cell: r, dimensions: i, values: a, ...o } = t;
		return new e(n, i, a, o);
	}
	sample(e, t, n) {
		let [r, i, a] = this.dimensions, o = [
			e * r,
			t * i,
			n * a
		], s = o.map(Math.floor), c = o.map((e, t) => e - s[t]), l = (e, t, n) => this.values[(Fn(n, a) * i + Fn(t, i)) * r + Fn(e, r)], u = l(s[0], s[1], s[2]), d = l(s[0] + 1, s[1], s[2]), f = l(s[0], s[1] + 1, s[2]), p = l(s[0] + 1, s[1] + 1, s[2]), m = l(s[0], s[1], s[2] + 1), h = l(s[0] + 1, s[1], s[2] + 1), g = l(s[0], s[1] + 1, s[2] + 1), _ = l(s[0] + 1, s[1] + 1, s[2] + 1), v = (e, t, n) => e + (t - e) * n, y = v(u, d, c[0]), b = v(f, p, c[0]), x = v(m, h, c[0]), S = v(g, _, c[0]);
		return v(v(y, b, c[1]), v(x, S, c[1]), c[2]);
	}
	static fromCIF(e, t = 0, n = null, r = null) {
		return nr(tr(e, t, n, r));
	}
	static fromReflectionCIF(e, t = 0, n = {}) {
		return nr(Jn(e, t, n));
	}
};
//#endregion
//#region src/lib/fix-cif/reconcile-labels.js
function ir(e, t = !0) {
	if (!e || typeof e != "string") throw Error("Empty atom label");
	let n = e.toUpperCase().replace(/[()[\]{}]/g, "");
	if (t && (n = n.replace(/\^[a-zA-Z1-9]+$/, "").replace(/_[a-zA-Z1-9]+$/, "").replace(/_\$\d+$/, "")), n === "") throw Error(`Label "${e}" normalizes to empty string`);
	return n;
}
function ar(e, t = !0) {
	let n = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		try {
			let r = ir(e, t);
			n.has(r) || n.set(r, []), n.get(r).push(e);
		} catch (e) {
			console.warn(`Skipping invalid label: ${e.message}`);
		}
	});
	let r = /* @__PURE__ */ new Map();
	for (let [e, t] of n.entries()) t.length === 1 ? r.set(e, t[0]) : console.warn(`Multiple labels map to ${e}: ${t.join(", ")}. Skipping mapping.`);
	return r;
}
function or(e, t, n, r = !0) {
	let i = ar(n, r), a = e.get(t).map((e) => {
		let t = ir(e, r);
		return i.has(t) ? i.get(t) : e;
	});
	e.data[t] = a;
}
//#endregion
//#region src/lib/fix-cif/guess-symmetry.js
function sr(e) {
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
function cr(e, t) {
	let n = e.get(t).map((e) => sr(e));
	e.data[t] = n;
}
//#endregion
//#region src/lib/fix-cif/base.js
function J(e, t) {
	for (let n of t) if (e.headerLines.includes(n)) return n;
	return null;
}
function lr(e, t) {
	if (J(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"])) return;
	let n = J(e, ["_atom_site.adp_type", "_atom_site_adp_type"]), r = J(e, ["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"]);
	if (!n || !r) return;
	let i = e.get(n), a = e.get(r);
	e.data[n] = i.map((e, t) => {
		let n = Number.isFinite(Number(a[t]));
		return /^uani$/i.test(String(e)) && n ? "Uiso" : e;
	});
}
function ur(e, t = !0, n = !0, r = !0) {
	let i, a;
	if ((t || n) && (i = e.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"])), t) {
		let t = e.get("_atom_site_aniso", !1);
		if (t) {
			let e = J(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"]);
			e ? or(t, e, a) : lr(i, t);
		}
	}
	if (n || r) {
		let t = e.get("_geom_bond", !1);
		if (t && (n && (or(t, J(t, ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]), a), or(t, J(t, ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"]), a)), r)) {
			let e = J(t, ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"]);
			e && cr(t, e);
			let n = J(t, ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"]);
			n && cr(t, n);
		}
		let i = e.get("_geom_hbond", !1);
		if (i) {
			if (n) {
				or(i, J(i, ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]), a);
				let e = J(i, ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"]);
				e && or(i, e, a), or(i, J(i, ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"]), a);
			}
			if (r) {
				let e = J(i, ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"]);
				e && cr(i, e);
			}
		}
	}
}
//#endregion
//#region src/lib/disorder-icons.js
function dr(e, t) {
	if (t === "all") return e.all;
	if (e[t]) return e[t];
	let n = /^group(\d+)of\d+$/.exec(t)?.[1];
	return n ? fr(e, n) : "";
}
function fr(e, t) {
	let n = e.all.replace(/#000000/g, "#8f8f8f"), r = String(t).length, i = `<text x="8.925192" y="8.925193" text-anchor="middle" dominant-baseline="central" font-size="${r <= 1 ? 9 : Math.max(9 - (r - 1) * 1.5, 5)}" font-family="system-ui, sans-serif" font-weight="bold" fill="#000000">${t}</text>`;
	return n.replace("</svg>", `${i}</svg>`);
}
//#endregion
//#region src/lib/structure/structure-modifiers/base.js
var pr = class e {
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
function Y(e, t) {
	return `${e}|${t}`;
}
function X(e, t, n) {
	let r = e.split("|"), i = r[0], a = `${n.identitySymOpId}_555`;
	return r.length === 2 && (a = r[1]), Y(i, n.combineSymmetryCodes(t, a));
}
//#endregion
//#region src/lib/structure/applied-symmetry.js
var Z = class e {
	constructor(e, t) {
		this.id = e, this.translation = [...t], this._updateKey();
	}
	_updateKey() {
		this.key = Oe(this.id, this.translation);
	}
	static fromString(t) {
		let { id: n, translation: r } = De(t);
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
}, mr = /* @__PURE__ */ new Set([
	"H",
	"D",
	"B",
	"C",
	"N",
	"O",
	"F",
	"Si",
	"P",
	"S",
	"Cl",
	"As",
	"Se",
	"Br",
	"Te",
	"I"
]), hr = 4, gr = 1.6;
function _r(e) {
	return mr.has(e) ? Ue[e] : void 0;
}
function vr(e, t = e.bonds) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e.atoms) n.has(t.label) || n.set(t.label, t.atomType);
	return t.filter((e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > hr) return !1;
		let t = n.get(e.atom1Label), r = n.get(e.atom2Label);
		if (t === void 0 || r === void 0) return !0;
		let i = _r(t), a = _r(r);
		return i === void 0 || a === void 0 || e.bondLength <= gr * (i + a);
	});
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-fragment.js
function Q(e, t) {
	return e < t ? `${e}->${t}` : `${t}->${e}`;
}
function $(e, t, n) {
	return `${e}-${t}...${n}`;
}
var yr = class {
	constructor(e, t) {
		this.groupIndex = e, this.appliedSymmetry = typeof t == "string" ? Z.fromString(t) : t;
	}
	isTranslationalDuplicateOf(e) {
		return this.groupIndex === e.groupIndex && this.appliedSymmetry.id === e.appliedSymmetry.id && (this.appliedSymmetry.translation[0] !== e.appliedSymmetry.translation[0] || this.appliedSymmetry.translation[1] !== e.appliedSymmetry.translation[1] || this.appliedSymmetry.translation[2] !== e.appliedSymmetry.translation[2]);
	}
	getSymmetryString() {
		return this.appliedSymmetry.toString();
	}
}, br = class {
	constructor(e, t, n, r) {
		this.originAtom = e.includes("|") ? e : Y(e, "1_555"), this.targetAtom = t.includes("|") ? t : Y(t, "1_555"), this.bondLength = n, this.bondLengthSU = r;
	}
}, xr = class {
	constructor(e, t, n, r, i, a) {
		this.originIndex = e, this.originSymmetry = typeof t == "string" ? Z.fromString(t) : t, this.targetIndex = n, this.targetSymmetry = typeof r == "string" ? Z.fromString(r) : r, this.connectingBonds = i, this.creationOriginIndex = a;
	}
	getKey() {
		let e = this.originSymmetry.key, t = this.targetSymmetry.key;
		return this.originIndex === this.targetIndex ? e < t ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}` : this.originIndex < this.targetIndex ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}`;
	}
};
function Sr(e, t, n) {
	let r = t.map(() => /* @__PURE__ */ new Map()), i = t.map(() => []);
	return e.bonds.filter((e) => e.atom2SiteSymmetry !== ".").forEach((e) => {
		let t = n.get(e.atom1Id) ?? n.get(e.atom1Label), a = e.atom2Id.split("|")[0], o = `${a}|1_555`, s = n.get(o) ?? n.get(a);
		if (t === void 0 || s === void 0) return;
		let c = `${t}->${s}@.@${e.atom2SiteSymmetry}`;
		if (r[t].has(c)) {
			let n = r[t].get(c);
			i[t][n].bonds.push(new br(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU));
		} else r[t].set(c, i[t].length), i[t].push({
			targetIndex: s,
			targetSymmetry: Z.fromString(e.atom2SiteSymmetry),
			bonds: [new br(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU)]
		});
	}), i;
}
function Cr(e, t) {
	let n = [], r = /* @__PURE__ */ new Set();
	return e.forEach((e, i) => {
		for (let a of e) {
			let e = new xr(i, t, a.targetIndex, a.targetSymmetry, a.bonds, i), o = e.getKey();
			r.has(o) || (n.push(e), r.add(o));
		}
	}), {
		danglingConnections: n,
		processedConnections: r
	};
}
function wr(e, t, n, r, i) {
	let a = [], o = [], s = new yr(e.targetIndex, e.targetSymmetry), c = r[e.targetIndex];
	for (let r of c) {
		let s = (typeof r.targetSymmetry == "string" ? Z.fromString(r.targetSymmetry) : r.targetSymmetry).combine(e.targetSymmetry, t.symmetry), c = new xr(e.targetIndex, e.targetSymmetry, r.targetIndex, s, r.bonds, e.creationOriginIndex), l = c.getKey();
		if (i.has(l)) continue;
		i.add(l);
		let u = new yr(r.targetIndex, s);
		n[e.creationOriginIndex].some((e) => u.isTranslationalDuplicateOf(e)) ? o.push(c) : a.push(c);
	}
	return {
		newConnectedGroup: s,
		newDanglingConnections: a,
		foundTranslations: o
	};
}
function Tr(e, t) {
	let n = /* @__PURE__ */ new Map();
	t.forEach((e, t) => {
		e.atoms.forEach((e) => n.set(e.uniqueId, t));
	});
	let r = Z.fromString(e.symmetry.identitySymOpId + "_555"), i = Sr(e, t, n), { danglingConnections: a, processedConnections: o } = Cr(i, r), s = [], c = [], l = t.map(() => []);
	t.forEach((e, t) => {
		l[t].push(new yr(t, r));
	});
	let u = 0, d = 0;
	for (; d < a.length;) {
		if (u++ > 1e4) {
			console.error("Max iterations reached in createConnectivity. Possible infinite loop orvery complex structure.");
			break;
		}
		let t = a[d++], n = wr(t, e, l, i, o);
		l[t.creationOriginIndex].push(n.newConnectedGroup), a.push(...n.newDanglingConnections), c.push(...n.foundTranslations), s.push(t);
	}
	return d < a.length && console.warn(`Connectivity processing stopped due to iteration limit. ${a.length - d} connections remain unprocessed.`), {
		networkConnections: s,
		translationLinks: c,
		discoveredGroups: l
	};
}
function Er(e) {
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
function Dr(e, t, n, r) {
	let i = t.map((e) => [[...e.atoms]]), a = /* @__PURE__ */ new Map(), o = [];
	return e.forEach((e) => {
		let [a, o] = e.split("@.@");
		if (o === r) return;
		let s = Number(a), c = t[s].atoms, l = n.symmetry.applySymmetry(o, c), u = Z.fromString(o);
		l.forEach((e) => {
			e.appliedSymmetry = u;
		}), i[s].push(l);
	}), i.forEach((e) => {
		if (e.length > 0 && e[0].length > 0) {
			let t = e[0].length;
			for (let r = 0; r < t; ++r) {
				let t = e.map((e) => e[r]), i = [];
				for (let e = 0; e < t.length; e++) {
					let r = t[e], s = e === 0, c = !1;
					for (let e of i) if (c = Math.abs(e.position.x - r.position.x) * n.cell.a < 1e-4 && Math.abs(e.position.y - r.position.y) * n.cell.b < 1e-4 && Math.abs(e.position.z - r.position.z) * n.cell.c < 1e-4, c) {
						a.set(r.uniqueId, e.uniqueId);
						break;
					}
					c || (i.push(r), s || o.push(r));
				}
			}
		}
	}), {
		specialPositionAtoms: a,
		newAtoms: o
	};
}
function Or(e, t, n, r, i, a) {
	let o = [];
	e.forEach((e) => {
		o.push(...e.bonds);
	});
	let s = /* @__PURE__ */ new Set();
	return o.forEach((e) => {
		s.add(Q(e.atom1Id, e.atom2Id));
	}), t.forEach((t) => {
		let [n, i] = t.split("@.@");
		i !== a && e[Number(n)].bonds.forEach((e) => {
			let t = e.atom1Id.split("|")[0], n = e.atom2Id.split("|")[0], a = Y(t, i), c = Y(n, i), l = r.get(a) || a, u = r.get(c) || c, d = Q(l, u);
			s.has(d) || (s.add(d), o.push(new V(l, u, e.bondLength, e.bondLengthSU, ".")));
		});
	}), n.forEach((e) => {
		let t = e.originAtomId || e.originSymmAtom, n = e.targetAtomId || e.targetSymmAtom, i = t.split(/[|@]/)[0], c = n.split(/[|@]/)[0], l = e.originSymmetry || Z.fromString(t.split(/[|@]/)[1] || a), u = e.targetSymmetry || Z.fromString(n.split(/[|@]/)[1] || a), d = l.key === a ? Y(i, a) : Y(i, l.key), f = u.key === a ? Y(c, a) : Y(c, u.key), p = r.get(d) || d, m = r.get(f) || f, h = p.includes("|") ? p : Y(p, a), g = m.includes("|") ? m : Y(m, a), _ = Q(h, g);
		s.has(_) || (s.add(_), o.push(new V(h, g, e.bondLength, e.bondLengthSU, ".")));
	}), {
		newBonds: o,
		atomLabels: new Set(i.map((e) => e.uniqueId))
	};
}
function kr(e, t, n, r, i, a, o) {
	let s = [], c = /* @__PURE__ */ new Set();
	e.hBonds.forEach((e) => {
		let t;
		t = e.acceptorAtomSymmetry === "." || e.acceptorAtomSymmetry === o ? $(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId) : `${$(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId)}@${e.acceptorAtomSymmetry}`, c.has(t) || (c.add(t), s.push(e));
	});
	let l = t.map(() => []);
	return e.hBonds.filter((e) => e.acceptorAtomSymmetry !== ".").forEach((e) => {
		let t = n.get(e.donorAtomId);
		t !== void 0 && l[t].push(e);
	}), r.forEach((n) => {
		let [r, u] = n.split("@.@");
		if (u === o) return;
		let d = Number(r);
		t[d].hBonds.forEach((e) => {
			let t = e.donorAtomId.split("|")[0], n = e.hydrogenAtomId.split("|")[0], r = e.acceptorAtomId.split("|")[0], a = Y(t, u), o = Y(n, u), l = Y(r, u), d = i.get(a) || a, f = i.get(o) || o, p = i.get(l) || l, m = $(d, f, p);
			c.has(m) || (c.add(m), s.push(new H(d, f, p, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".")));
		}), l[d].forEach((t) => {
			let n = t.donorAtomId.split("|")[0], r = t.hydrogenAtomId.split("|")[0], o = Y(n, u), l = Y(r, u), d = i.get(o) || o, f = i.get(l) || l, p = e.symmetry.combineSymmetryCodes(u, t.acceptorAtomSymmetry), m = t.acceptorAtomId.split("|")[0], h = Y(m, p), g = i.get(h) || h, _, v;
			a.has(g) ? (_ = new H(d, f, g, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."), v = $(d, f, g)) : (_ = new H(d, f, m, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, p), v = `${$(d, f, m)}@${p}`), c.has(v) || (c.add(v), s.push(_));
		});
	}), s;
}
function Ar(e, t, n, r) {
	let i = [];
	return e.forEach((e) => {
		for (let t of e.connectingBonds) {
			let a = t.originAtom.split("|")[0], o = t.targetAtom.split("|")[0], s = Y(a, e.originSymmetry.key), c = Y(o, e.targetSymmetry.key), l = n.get(s) || s, u = n.get(c) || c, d = u.split("|")[1] || e.targetSymmetry.key, f = Q(l, u);
			r.has(f) || (r.add(f), i.push(new V(l, u, t.bondLength, t.bondLengthSU, d)));
		}
	}), i;
}
function jr(e) {
	let t = new U(e.cell, e.atoms, vr(e), e.hBonds, e.symmetry), n = t.calculateConnectedGroups(), r = /* @__PURE__ */ new Map();
	n.forEach((e, t) => {
		e.atoms.forEach((e) => {
			r.set(e.uniqueId, t);
		});
	});
	let i = e.symmetry.identitySymOpId + "_555", { networkConnections: a, translationLinks: o } = Tr(t, n), { requiredSymmetryInstances: s, interGroupBonds: c } = Er(a, e, i), { specialPositionAtoms: l, newAtoms: u } = Dr(s, n, t, i), { newBonds: d, atomLabels: f } = Or(n, s, c, l, u, i), p = kr(t, n, r, s, l, f, i), m = Ar(o, t, l, new Set(d.map((e) => Q(e.atom1Id, e.atom2Id))));
	for (let e of m) d.push(e);
	return {
		grownStructure: new U(t.cell, [...t.atoms, ...u], d, p, t.symmetry),
		specialPositionAtoms: l
	};
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-cell.js
var Mr = 4;
function Nr(e, t) {
	let n = /* @__PURE__ */ new Set([e.identitySymOpId]), r = /* @__PURE__ */ new Set();
	for (let n of t) {
		let t = e.combineSymmetryCodes(n + "_555", e.identitySymOpId + "_555");
		r.add(t.split("_")[0]);
	}
	for (let [t] of e.operationIds) n.has(t) || r.has(t) || n.add(t);
	return n;
}
function Pr(e) {
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
function Fr(e) {
	let t = Pr(e);
	return F([
		(t.minX + t.maxX) / 2,
		(t.minY + t.maxY) / 2,
		(t.minZ + t.maxZ) / 2
	]);
}
function Ir(e, t, n) {
	let r = t.symmetry.identitySymOpId, i = /* @__PURE__ */ new Set();
	for (let t of e.atoms) t.appliedSymmetry ? i.add(t.appliedSymmetry.id) : i.add(r);
	let a = new Set(e.atoms.map((e) => e.uniqueId));
	for (let [e, t] of n) {
		let n = r;
		e.includes("|") && (n = e.split("|")[1].split("_")[0]), a.has(t) && i.add(n);
	}
	return Array.from(i);
}
function Lr(e, t = 1e-6) {
	let { x: n, y: r, z: i } = e.position;
	return n >= -t && n < 1 - t && r >= -t && r < 1 - t && i >= -t && i < 1 - t;
}
function Rr(e, t = 3) {
	let n = e.position.x.toFixed(t), r = e.position.y.toFixed(t), i = e.position.z.toFixed(t);
	return `${e.label}_x${n}_y${r}_z${i}`;
}
function zr(e, t, n) {
	let { symOp: r, transVector: i } = e.parsePositionCode(t), a = re(re(I(r.rotMatrix, F(n)), r.transVector), i), o = Math.floor(a.get([0])), s = Math.floor(a.get([1])), c = Math.floor(a.get([2])), l = t.split("_")[0], u = (t.split("_")[1] || "555").split("").map((e) => parseInt(e, 10)), d = `${u[0] - o}${u[1] - s}${u[2] - c}`;
	return {
		newCentre: ie(a, F([
			o,
			s,
			c
		])),
		newString: `${l}_${d}`
	};
}
function Br(e, t, n, r, i) {
	let a = [], o = t.applySymmetry(n, e.atoms);
	for (let s = 0; s < o.length; s++) {
		let c = o[s], l = e.atoms[s], u = n;
		l.appliedSymmetry && l.appliedSymmetry.key !== `${t.identitySymOpId}_555` && (u = t.combineSymmetryCodes(n, l.appliedSymmetry.key)), c.appliedSymmetry = Z.fromString(u);
		let d = c.uniqueId;
		if (i && !Lr(c)) {
			let e = Math.floor(c.position.x), n = Math.floor(c.position.y), i = Math.floor(c.position.z);
			c.position.x -= e, c.position.y -= n, c.position.z -= i, c.appliedSymmetry.translation[0] -= e, c.appliedSymmetry.translation[1] -= n, c.appliedSymmetry.translation[2] -= i, c.appliedSymmetry._updateKey();
			let a = c.uniqueId, o = `${t.identitySymOpId}_${5 - e}${5 - n}${5 - i}`;
			r.atomTranslations.set(d, [a, o]);
		}
		let f = c.uniqueId, p = Rr(c), m = r.atomMap.get(p);
		m ? r.specialPositionMap.set(f, m) : (r.atomMap.set(p, f), a.push(c));
	}
	return a;
}
function Vr(e, t, n, r) {
	let i = [];
	for (let a of e.internalBonds) {
		let e = X(a.atom1Id, n, t), o = r.specialPositionMap.get(e) || e, s = X(a.atom2Id, n, t), c = r.specialPositionMap.get(s) || s;
		if (o !== c) {
			if (!r.atomTranslations.has(o) && !r.atomTranslations.has(c)) {
				let e = Q(o, c);
				if (!r.createdBonds.has(e)) {
					let t = new V(o, c, a.bondLength, a.bondLengthSU, ".");
					i.push(t), r.createdBonds.add(e);
				}
			} else if (r.atomTranslations.has(o) && r.atomTranslations.has(c)) {
				let [e, t] = r.atomTranslations.get(o), [n, s] = r.atomTranslations.get(c);
				if (t === s) {
					let t = Q(e, n);
					if (!r.createdBonds.has(t)) {
						let o = new V(e, n, a.bondLength, a.bondLengthSU, ".");
						i.push(o), r.createdBonds.add(t);
					}
				}
			}
		}
	}
	return i;
}
function Hr(e, t, n, r) {
	let i = [];
	for (let a of e.internalHBonds) {
		let e = r.specialPositionMap.get(X(a.donorAtomId, n, t)) || X(a.donorAtomId, n, t), o = r.specialPositionMap.get(X(a.hydrogenAtomId, n, t)) || X(a.hydrogenAtomId, n, t), s;
		if (a.acceptorAtomSymmetry && a.acceptorAtomSymmetry !== ".") {
			let e = `${a.acceptorAtomId.split("|")[0]}|${t.combineSymmetryCodes(n, a.acceptorAtomSymmetry)}`;
			s = r.specialPositionMap.get(e) || e;
		} else s = r.specialPositionMap.get(X(a.acceptorAtomId, n, t)) || X(a.acceptorAtomId, n, t);
		if (!r.atomTranslations.has(e) && !r.atomTranslations.has(o) && !r.atomTranslations.has(s)) {
			let t = $(e, o, s);
			if (!r.createdHBonds.has(t)) {
				let n = new H(e, o, s, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
				r.createdHBonds.add(t), i.push(n);
			}
		} else if (r.atomTranslations.has(e) && r.atomTranslations.has(o) && r.atomTranslations.has(s)) {
			let [t, n] = r.atomTranslations.get(e), [c, l] = r.atomTranslations.get(o), [u, d] = r.atomTranslations.get(s);
			if (n === l && l === d) {
				let e = $(t, c, u);
				if (!r.createdHBonds.has(e)) {
					let n = new H(t, c, u, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
					r.createdHBonds.add(e), i.push(n);
				}
			}
		}
	}
	return i;
}
function Ur(e, t, n, r) {
	let i = [];
	for (let a of e.externalBonds) {
		let e = r.specialPositionMap.get(X(a.atom1Id, n, t)) || X(a.atom1Id, n, t), o = t.combineSymmetryCodes(n, a.atom2SiteSymmetry), s = a.atom2Id.split("|")[0];
		if (r.atomTranslations.has(e)) {
			let n;
			[e, n] = r.atomTranslations.get(e), o = t.combineSymmetryCodes(n, o);
		}
		let c = `${s}|${o}`;
		c = r.specialPositionMap.get(c) || c;
		let l = Q(e, c);
		if (!r.createdBonds.has(l)) {
			let t = new V(e, c, a.bondLength, a.bondLengthSU, o);
			i.push(t), r.createdBonds.add(l);
		}
	}
	return i;
}
function Wr(e, t, n, r) {
	let i = [];
	for (let a of e.externalHBonds) {
		let e = r.specialPositionMap.get(X(a.donorAtomId, n, t)) || X(a.donorAtomId, n, t), o = r.specialPositionMap.get(X(a.hydrogenAtomId, n, t)) || X(a.hydrogenAtomId, n, t), s = t.combineSymmetryCodes(n, a.acceptorAtomSymmetry);
		if (r.atomTranslations.has(e) && r.atomTranslations.has(o)) {
			let n;
			[e, n] = r.atomTranslations.get(e);
			let [i, a] = r.atomTranslations.get(o);
			if (n !== a) continue;
			o = i, s = t.combineSymmetryCodes(n, s);
		} else if (r.atomTranslations.has(e) || r.atomTranslations.has(o)) continue;
		let c = `${a.acceptorAtomId.split("|")[0]}|${s}`;
		if (e.split("|")[1] === s) continue;
		let l = $(e, o, c);
		if (!r.createdHBonds.has(l)) {
			let t = new H(e, o, c, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, s);
			i.push(t), r.createdHBonds.add(l);
		}
	}
	return i;
}
function Gr(e, t, n, r, i) {
	let { newCentre: a, newString: o } = zr(t, t.combineSymmetryCodes(n, e.symmString), e.groupCentre);
	return {
		atoms: Br(e, t, o, r, i),
		internalBonds: Vr(e, t, o, r),
		internalHBonds: Hr(e, t, o, r),
		externalBonds: Ur(e, t, o, r),
		externalHBonds: Wr(e, t, o, r),
		symmString: o,
		groupCentre: a
	};
}
function Kr(e, t = !0, n = null) {
	let r;
	if (r = n === null ? /* @__PURE__ */ new Map() : n, e.atoms.length === 0) return new U(e.cell, [], [], [], e.symmetry);
	let i = e.calculateConnectedGroups(), a = i.map((t) => {
		let n = Ir(t, e, r);
		return Array.from(Nr(e.symmetry, n));
	}), o = i.map((t) => e.bonds.filter((e) => e.atom2SiteSymmetry && e.atom2SiteSymmetry !== "." && t.atoms.some((t) => t.label === e.atom1Id.split("|")[0]))), s = i.map((t) => e.hBonds.filter((e) => e.acceptorAtomSymmetry && e.acceptorAtomSymmetry !== "." && t.atoms.some((t) => t.label === e.donorAtomId.split("|")[0]))), c = {
		atomMap: /* @__PURE__ */ new Map(),
		createdBonds: /* @__PURE__ */ new Set(),
		createdHBonds: /* @__PURE__ */ new Set(),
		specialPositionMap: r,
		atomTranslations: /* @__PURE__ */ new Map()
	}, l = [];
	for (let n = 0; n < i.length; n++) {
		let r = i[n], u = a[n], d = Fr(r.atoms), f = u[0], p = {
			atoms: r.atoms,
			internalBonds: r.bonds,
			internalHBonds: r.hBonds,
			symmString: `${f}_555`,
			groupCentre: d,
			externalBonds: o[n],
			externalHBonds: s[n]
		};
		for (let n of u) {
			let r = `${n}_555`, i = Gr(p, e.symmetry, r, c, t);
			l.push(i);
		}
	}
	let u = [...t ? [] : e.symmetry.applySymmetry(`${e.symmetry.identitySymOpId}_555`, e.atoms).map((t, n) => (t.appliedSymmetry = e.atoms[n].appliedSymmetry?.copy() || null, t)), ...l.flatMap((e) => e.atoms)], d = /* @__PURE__ */ new Map();
	for (let e of u) d.has(e.uniqueId) || d.set(e.uniqueId, e);
	let f = Array.from(d.values()), p = [...t ? [] : e.bonds.map((e) => new V(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry)), ...l.flatMap((e) => e.internalBonds)], m = [...t ? [] : e.hBonds.map((e) => new H(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry)), ...l.flatMap((e) => e.internalHBonds)], h = new Set(f.map((e) => e.uniqueId));
	l.forEach((e) => {
		e.externalBonds.forEach((e) => {
			let t = c.specialPositionMap.get(e.atom1Id) || e.atom1Id;
			c.atomTranslations.has(t) && ([t] = c.atomTranslations.get(t));
			let n = c.specialPositionMap.get(e.atom2Id) || e.atom2Id;
			if (c.atomTranslations.has(n) && ([n] = c.atomTranslations.get(n)), h.has(t) && h.has(n) && t !== n) {
				let r = new V(t, n, e.bondLength, e.bondLengthSU, ".");
				p.push(r);
			} else if (h.has(t)) {
				let n = new V(t, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry);
				p.push(n);
			}
		}), e.externalHBonds.forEach((e) => {
			let t = null, n = c.specialPositionMap.get(e.donorAtomId) || e.donorAtomId;
			h.has(n) || (n = c.specialPositionMap.get(n) || n, c.atomTranslations.has(n) && ([n, t] = c.atomTranslations.get(n)));
			let r = null, i = c.specialPositionMap.get(e.hydrogenAtomId) || e.hydrogenAtomId;
			h.has(i) || (i = c.specialPositionMap.get(i) || i, c.atomTranslations.has(i) && ([i, r] = c.atomTranslations.get(i)));
			let a;
			if (a = !e.acceptorAtomSymmetry || e.acceptorAtomSymmetry === "." ? e.acceptorAtomId : `${e.acceptorAtomId.split("|")[0]}|${e.acceptorAtomSymmetry}`, !h.has(a) && (a = c.specialPositionMap.get(a) || a, c.atomTranslations.has(a))) {
				let [e, n] = c.atomTranslations.get(a);
				t === n && r === n && (a = e);
			}
			if (h.has(n) && h.has(i) && h.has(a)) {
				let t = new H(n, i, a, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".");
				m.push(t);
			} else if (h.has(n) && h.has(i)) {
				let t = new H(n, i, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry);
				m.push(t);
			}
		});
	});
	let g = new Map(f.map((e) => [e.uniqueId, e])), _ = /* @__PURE__ */ new Map(), v = (t) => {
		let n = _.get(t.uniqueId);
		return n || (n = t.position.toCartesian(e.cell), _.set(t.uniqueId, n)), n;
	}, y = (e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > Mr) return !1;
		let t = g.get(e.atom1Id), n = g.get(e.atom2Id);
		if (!t || !n) return e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		let r = v(t), i = v(n), a = Math.hypot(r.x - i.x, r.y - i.y, r.z - i.z), o = Math.max(.15, e.bondLength * .1);
		return a <= e.bondLength + o;
	}, b = p.filter((e) => {
		let t = h.has(e.atom1Id), n = e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		return t && (h.has(e.atom2Id) || n) && y(e);
	}), x = m.filter((e) => h.has(e.donorAtomId) && h.has(e.hydrogenAtomId)), S = b, C = new U(e.cell, f, S, x, e.symmetry), w = /* @__PURE__ */ new Map();
	for (let e of C.calculateConnectedGroups()) {
		let t = Fr(e.atoms).toArray().map((e) => Math.floor(e));
		for (let n of e.atoms) {
			let e = n.uniqueId;
			n.position.x -= t[0], n.position.y -= t[1], n.position.z -= t[2], n.appliedSymmetry && (n.appliedSymmetry.translation[0] -= t[0], n.appliedSymmetry.translation[1] -= t[1], n.appliedSymmetry.translation[2] -= t[2], n.appliedSymmetry._updateKey()), w.set(e, n.uniqueId);
		}
	}
	let T = [], E = /* @__PURE__ */ new Map(), D = /* @__PURE__ */ new Map(), O = /* @__PURE__ */ new Map();
	for (let e of f) {
		let t = Rr(e), n = D.get(e.uniqueId) || E.get(t);
		n ? O.set(e.uniqueId, n) : (E.set(t, e.uniqueId), D.set(e.uniqueId, e.uniqueId), T.push(e));
	}
	for (let [e, t] of w) w.set(e, O.get(t) || t);
	let k = [], A = /* @__PURE__ */ new Set();
	for (let e of b) {
		let t = w.get(e.atom1Id) || e.atom1Id, n = w.get(e.atom2Id) || e.atom2Id;
		if (t === n) continue;
		let r = Q(t, n);
		A.has(r) || (e.atom1Id = t, e.atom2Id = n, k.push(e), A.add(r));
	}
	let ee = [], j = /* @__PURE__ */ new Set();
	for (let e of x) {
		e.donorAtomId = w.get(e.donorAtomId) || e.donorAtomId, e.hydrogenAtomId = w.get(e.hydrogenAtomId) || e.hydrogenAtomId, e.acceptorAtomId = w.get(e.acceptorAtomId) || e.acceptorAtomId;
		let t = $(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId);
		j.has(t) || (ee.push(e), j.add(t));
	}
	return new U(e.cell, T, k, ee, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-hbonds.js
function qr(e, t) {
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
function Jr(e) {
	let t = new Map(e.atoms.map((e) => [e.uniqueId, e])), n = /* @__PURE__ */ new Map();
	for (let t of e.atoms) n.has(t.label) || n.set(t.label, []), n.get(t.label).push(t);
	let r = (t, n) => {
		let r = t.position.toCartesian(e.cell), i = n.position.toCartesian(e.cell);
		return Math.hypot(r.x - i.x, r.y - i.y, r.z - i.z);
	}, i = (e) => Math.max(.15, e * .1), a = (e, t) => !Number.isFinite(t) || Math.abs(e - t) <= i(t), o = [], s = /* @__PURE__ */ new Set();
	for (let i of e.hBonds) {
		let e = n.get(i.donorAtomLabel) || [], c = n.get(i.hydrogenAtomLabel) || [], l = n.get(i.acceptorAtomLabel) || [], u = null, d = [], f = t.get(i.donorAtomId), p = t.get(i.hydrogenAtomId);
		if (f && p && a(r(f, p), i.donorHydrogenDistance)) d = [[f, p]];
		else {
			let t = null;
			for (let n of e) for (let e of c) {
				let o = r(n, e), s = Math.abs(o - i.donorHydrogenDistance);
				a(o, i.donorHydrogenDistance) && (!t || s < t.error) && (t = {
					donor: n,
					hydrogen: e,
					error: s
				});
			}
			t && (d = [[t.donor, t.hydrogen]]);
		}
		for (let [e, t] of d) {
			let n = r(e, t);
			for (let o of l) {
				let s = r(t, o), c = r(e, o);
				if (!a(s, i.acceptorHydrogenDistance) || !a(c, i.donorAcceptorDistance)) continue;
				let l = Math.abs(n - i.donorHydrogenDistance) + Math.abs(s - i.acceptorHydrogenDistance) + Math.abs(c - i.donorAcceptorDistance);
				(!u || l < u.score) && (u = {
					donor: e,
					hydrogen: t,
					acceptor: o,
					score: l
				});
			}
		}
		if (!u) continue;
		let m = `${u.donor.uniqueId}|${u.hydrogen.uniqueId}|${u.acceptor.uniqueId}`;
		s.has(m) || (s.add(m), o.push(new H(u.donor.uniqueId, u.hydrogen.uniqueId, u.acceptor.uniqueId, i.donorHydrogenDistance, i.donorHydrogenDistanceSU, i.acceptorHydrogenDistance, i.acceptorHydrogenDistanceSU, i.donorAcceptorDistance, i.donorAcceptorDistanceSU, i.hBondAngle, i.hBondAngleSU, ".")));
	}
	return new U(e.cell, e.atoms, e.bonds, o, e.symmetry);
}
function Yr(e, t = /* @__PURE__ */ new Map()) {
	let n = e.calculateConnectedGroups(), r = (e) => t.get(e) || e, i = [], a = [], o = /* @__PURE__ */ new Set();
	e.hBonds.forEach((t) => {
		if (t.acceptorAtomSymmetry === ".") a.push(t);
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
			o.has(r) || (o.add(r), i.push(t));
		}
	});
	let s = n.map(() => []);
	for (let e of i) {
		let t = n.findIndex((t) => t.atoms.some((t) => t.uniqueId === e.donorAtomId));
		t !== -1 && s[t].push(e);
	}
	let c = /* @__PURE__ */ new Set(), l = [...e.atoms], u = [...e.bonds], d = new Set(l.map((e) => e.uniqueId)), f = new Set(a.map((e) => `${e.donorAtomId}|${e.hydrogenAtomId}|${e.acceptorAtomId}`)), p = [], m = (e) => {
		let t = `${e.donorAtomId}|${e.hydrogenAtomId}|${e.acceptorAtomId}`;
		f.has(t) || (a.push(e), f.add(t));
	}, h = (t, i) => {
		let a = `${t}@${i}`;
		if (c.has(a)) return;
		c.add(a);
		let o = n[t], f = e.symmetry.applySymmetry(i, o.atoms);
		for (let t = 0; t < f.length; t++) {
			let n = f[t], r = o.atoms[t], a = i;
			r.appliedSymmetry && r.appliedSymmetry.key !== `${e.symmetry.identitySymOpId}_555` && (a = e.symmetry.combineSymmetryCodes(i, r.appliedSymmetry.key)), n.appliedSymmetry = Z.fromString(a), d.has(n.uniqueId) || (l.push(n), d.add(n.uniqueId));
		}
		o.bonds.filter(({ atom2SiteSymmetry: e }) => e === ".").forEach((t) => {
			u.push(new V(X(t.atom1Id, i, e.symmetry), X(t.atom2Id, i, e.symmetry), t.bondLength, t.bondLengthSU, "."));
		}), [...o.hBonds, ...s[t]].forEach((t) => {
			if (t.acceptorAtomSymmetry === ".") {
				m(new H(r(X(t.donorAtomId, i, e.symmetry)), r(X(t.hydrogenAtomId, i, e.symmetry)), r(X(t.acceptorAtomId, i, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
				return;
			}
			p.push(new H(r(X(t.donorAtomId, i, e.symmetry)), r(X(t.hydrogenAtomId, i, e.symmetry)), r(X(t.acceptorAtomId, i, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		});
	};
	for (let t of i) {
		let i = t.acceptorAtomId.split("|")[0], a = t.acceptorAtomId.split("|")[0], o = n.findIndex((e) => e.atoms.some((e) => e.label === a));
		if (o === -1) throw Error(`Cannot grow H-bond: acceptor atom ${a} is not in the structure`);
		m(new H(r(t.donorAtomId), r(t.hydrogenAtomId), r(X(i, t.acceptorAtomSymmetry, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		let s = t.acceptorAtomSymmetry;
		h(o, s);
		let c = n.findIndex((e) => e.atoms.some((e) => e.uniqueId === t.donorAtomId));
		if (c === -1) throw Error(`Cannot grow reciprocal H-bond: donor atom ${t.donorAtomId} is not in the structure`);
		let l = e.symmetry.invertPositionCode(s);
		h(c, l), m(new H(r(X(t.donorAtomId, l, e.symmetry)), r(X(t.hydrogenAtomId, l, e.symmetry)), `${i}|${e.symmetry.identitySymOpId}_555`, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
	}
	for (let e of p) d.has(e.donorAtomId) && d.has(e.hydrogenAtomId) && d.has(e.acceptorAtomId) && m(e);
	return new U(e.cell, l, u, a, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/modes.js
var Xr = class e extends pr {
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
		let n = t.atoms.filter((t) => t.atomType !== "H" || this.mode !== e.MODES.NONE).map((t) => new ze(t.label, t.atomType, t.position, t.atomType === "H" && this.mode === e.MODES.CONSTANT ? null : t.adp, t.disorderGroup, t.appliedSymmetry)), r = t.bonds.filter((n) => {
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
		return new U(t.cell, n, r, i, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [e.MODES.NONE];
		return t.atoms.some((e) => e.atomType === "H") ? (n.push(e.MODES.CONSTANT), t.atoms.some((e) => e.atomType === "H" && e.adp instanceof B) && n.push(e.MODES.ANISOTROPIC), n) : n;
	}
}, Zr = class e extends pr {
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
		return new U(t.cell, o, s, c, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [...new Set(t.atoms.map((e) => Number(e.disorderGroup)).filter((e) => e > 0))].sort((e, t) => e - t);
		this._groupValuesByRank = n;
		let r = { ALL: e.MODES.ALL };
		return n.forEach((t, i) => {
			r[`GROUP${i + 1}`] = e.modeForGroup(i + 1, n.length);
		}), this.MODES = Object.freeze(r), Object.values(this.MODES);
	}
}, Qr = class e extends pr {
	static MODES = Object.freeze({
		NONE: "none",
		HBONDS: "hbonds",
		FRAGMENT: "fragment",
		FRAGMENT_HBONDS: "fragment-hbonds",
		CELL: "cell",
		FRAGMENT_CELL: "fragment-cell"
	});
	static PREFERRED_FALLBACK_ORDER = [e.MODES.FRAGMENT, e.MODES.CELL];
	constructor(t = e.MODES.NONE) {
		super(e.MODES, t, "SymmetryGrower", e.PREFERRED_FALLBACK_ORDER);
	}
	get requiresCameraUpdate() {
		return !0;
	}
	get drawCell() {
		return this.mode === e.MODES.CELL || this.mode === e.MODES.FRAGMENT_CELL;
	}
	apply(t) {
		this.ensureValidMode(t);
		let n = this.mode === e.MODES.NONE ? t : new U(t.cell, t.atoms, vr(t), t.hBonds, t.symmetry), r = /* @__PURE__ */ new Map();
		if (this.mode === e.MODES.FRAGMENT || this.mode === e.MODES.FRAGMENT_HBONDS) {
			let e = jr(n);
			n = e.grownStructure, r = e.specialPositionAtoms;
		}
		if (this.mode === e.MODES.CELL) n = Kr(n);
		else if (this.mode === e.MODES.FRAGMENT_CELL) {
			let e = jr(n);
			r = e.specialPositionAtoms, n = Kr(e.grownStructure, !1, r), n = Jr(n);
		}
		return (this.mode === e.MODES.HBONDS || this.mode === e.MODES.FRAGMENT_HBONDS) && (this.mode === e.MODES.FRAGMENT_HBONDS && (n = new U(n.cell, n.atoms, qr(n, n.bonds), n.hBonds, n.symmetry)), n = Yr(n, r), this.mode === e.MODES.FRAGMENT_HBONDS && (n = new U(n.cell, n.atoms, qr(n, n.bonds), n.hBonds, n.symmetry), n = Jr(n))), n;
	}
	getApplicableModes(t) {
		let n = [
			e.MODES.NONE,
			e.MODES.CELL,
			e.MODES.FRAGMENT_CELL
		];
		if (!(t.symmetry && t.symmetry.symmetryOperations.length > 0)) return n;
		let r = t.bonds.some((e) => e.atom2SiteSymmetry !== ".");
		return r && n.push(e.MODES.FRAGMENT), t.hBonds.some((e) => e.acceptorAtomSymmetry !== ".") && (r ? n.push(e.MODES.FRAGMENT_HBONDS) : n.push(e.MODES.HBONDS)), n;
	}
}, $r = class e extends pr {
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
		return new U(t.cell, r, i, a, t.symmetry);
	}
	getApplicableModes() {
		return Object.values(e.MODES);
	}
}, ei = class e extends pr {
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
		return We.has(e) || We.has(t) ? Math.min(this.tolerance, .4) : this.tolerance;
	}
	getMaxBondDistance(e, t, n) {
		let r = n[e]?.radius, i = n[t]?.radius;
		if (!r || !i) throw Error(`Missing radius for element ${r ? t : e}`);
		return r + i + this.getTolerance(e, t);
	}
	generateBonds(e, t) {
		let n = /* @__PURE__ */ new Set(), { cell: r, atoms: i } = e, a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
		for (let t of e.bonds) s.add(t.atom1Id), s.add(t.atom2Id);
		i.forEach((e) => {
			let n = e.position.toCartesian(r);
			if (a.set(e.uniqueId, [
				n.x,
				n.y,
				n.z
			]), Object.prototype.hasOwnProperty.call(t, e.atomType) && !o.has(e.atomType)) o.set(e.atomType, e.atomType);
			else if (!o.has(e.atomType)) try {
				o.set(e.atomType, Ie(e.atomType));
			} catch {
				throw Error(`Missing radius for element ${e.atomType}`);
			}
		});
		let c = 0;
		for (let e of o.values()) for (let n of o.values()) c = Math.max(c, this.getMaxBondDistance(e, n, t));
		let l = c > 0 ? c : 1, u = (e, t, n) => `${e},${t},${n}`, d = /* @__PURE__ */ new Map();
		i.forEach((e, t) => {
			let n = a.get(e.uniqueId), r = Math.floor(n[0] / l), i = Math.floor(n[1] / l), o = Math.floor(n[2] / l), s = u(r, i, o);
			d.has(s) || d.set(s, []), d.get(s).push(t);
		});
		for (let e = 0; e < i.length; e++) {
			let r = i[e], c = a.get(r.uniqueId), f = Math.floor(c[0] / l), p = Math.floor(c[1] / l), m = Math.floor(c[2] / l);
			for (let l = -1; l <= 1; l++) for (let h = -1; h <= 1; h++) for (let g = -1; g <= 1; g++) {
				let _ = d.get(u(f + l, p + h, m + g));
				if (_) for (let l of _) {
					if (l <= e) continue;
					let u = i[l];
					if ((r.atomType === "H" || u.atomType === "H") && (s.has(r.uniqueId) || s.has(u.uniqueId)) || !Be(r, u)) continue;
					let d = a.get(u.uniqueId), f = c[0] - d[0], p = c[1] - d[1], m = c[2] - d[2], h = this.getMaxBondDistance(o.get(r.atomType), o.get(u.atomType), t);
					if (Math.abs(f) > h || Math.abs(p) > h || Math.abs(m) > h) continue;
					let g = se([
						f,
						p,
						m
					]);
					g <= h && g > 1e-4 && n.add(new V(r.uniqueId, u.uniqueId, g, null, "."));
				}
			}
		}
		return n;
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
		return new U(t.cell, t.atoms, n, t.hBonds, t.symmetry);
	}
	getApplicableModes(t) {
		return t.bonds.length > 0 ? [
			e.MODES.KEEP,
			e.MODES.ADD,
			e.MODES.REPLACE
		] : [e.MODES.CREATE, e.MODES.IGNORE];
	}
}, ti = class e extends pr {
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
		return new U(t.cell, t.atoms, [...t.bonds, ...r], t.hBonds, t.symmetry);
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
		let n = [];
		return t.forEach(({ atom: t, atomIndex: r }) => {
			let i = t.position.toCartesian(e.cell), a = [
				i.x,
				i.y,
				i.z
			];
			if (r > 0) {
				let i = e.atoms[r - 1];
				if (i.atomType !== "H" && Be(i, t)) {
					let r = i.position.toCartesian(e.cell), o = se(ie(a, [
						r.x,
						r.y,
						r.z
					]));
					if (o <= this.maxBondDistance) {
						n.push(new V(i.uniqueId, t.uniqueId, o, null, "."));
						return;
					}
				}
			}
			let o = !1;
			for (let i = r - 1; i >= 0 && !o; i--) {
				let r = e.atoms[i];
				if (r.atomType === "H" || !Be(r, t)) continue;
				let s = r.position.toCartesian(e.cell), c = se(ie(a, [
					s.x,
					s.y,
					s.z
				]));
				c <= this.maxBondDistance && (n.push(new V(r.uniqueId, t.uniqueId, c, null, ".")), o = !0);
			}
			if (!o && r < e.atoms.length - 1) for (let i = r + 1; i < e.atoms.length && !o; i++) {
				let r = e.atoms[i];
				if (r.atomType === "H" || !(r.disorderGroup === t.disorderGroup || r.disorderGroup === 0 || t.disorderGroup === 0)) continue;
				let s = r.position.toCartesian(e.cell), c = se(ie(a, [
					s.x,
					s.y,
					s.z
				]));
				c <= this.maxBondDistance && (n.push(new V(r.uniqueId, t.uniqueId, c, null, ".")), o = !0);
			}
		}), n;
	}
	getApplicableModes(t) {
		return t.bonds.length === 0 ? [e.MODES.OFF] : this.findIsolatedHydrogenAtoms(t).length > 0 ? [e.MODES.ON] : [e.MODES.OFF];
	}
};
//#endregion
//#region src/lib/ortep3d/staging.js
function ni(t) {
	let n = new e.Vector3();
	t.forEach((e) => n.add(e)), n.divideScalar(t.length);
	let r = new e.Matrix3(), i = new e.Vector3();
	t.forEach((e) => {
		i.copy(e).sub(n), r.elements[0] += i.x * i.x, r.elements[1] += i.x * i.y, r.elements[2] += i.x * i.z, r.elements[3] += i.y * i.x, r.elements[4] += i.y * i.y, r.elements[5] += i.y * i.z, r.elements[6] += i.z * i.x, r.elements[7] += i.z * i.y, r.elements[8] += i.z * i.z;
	});
	let { values: a, eigenvectors: o } = ge(ri(r)), s = me(a);
	if (s <= 0) return console.warn("Could not find a mean plane, expected?"), new e.Vector3(0, 1, 0);
	let c = o.filter((e) => e.value === s)[0].vector, l = new e.Vector3(...c.toArray());
	return l.normalize(), l;
}
function ri(e) {
	let t = e.elements;
	return F([
		[
			t[0],
			t[1],
			t[2]
		],
		[
			t[3],
			t[4],
			t[5]
		],
		[
			t[6],
			t[7],
			t[8]
		]
	]);
}
function ii(t) {
	let n = [], r = new e.Vector3();
	if (t.traverse((e) => {
		e.userData?.type === "atom" && (n.push(e.position.clone()), r.add(e.position));
	}), n.length === 0) return null;
	r.divideScalar(n.length);
	let i = n.map((e) => e.sub(r)), a = ni(i), o = new e.Vector3(0, 0, 1), s = new e.Quaternion();
	s.setFromUnitVectors(a, o);
	let c = new e.Matrix4();
	c.makeRotationFromQuaternion(s);
	let l = i.map((e) => e.clone().applyMatrix4(c)), u = 0, d = 0;
	l.forEach((e, t) => {
		let n = Math.sqrt(e.x * e.x + e.y * e.y);
		n > u && (u = n, d = t);
	});
	let f = new e.Vector2(l[d].x, l[d].y);
	f.x < 0 && f.multiplyScalar(-1);
	let p = -Math.atan2(f.y, f.x), m = new e.Matrix4().makeRotationZ(p);
	return c.premultiply(m), c.premultiply(new e.Matrix4().makeRotationX(Math.PI / 8)), c.premultiply(new e.Matrix4().makeRotationY(Math.PI / 48)), c;
}
function ai(t, n) {
	t.children = t.children.filter((t) => !(t instanceof e.Light));
	let r = 6;
	n.traverse((e) => {
		e.userData?.type === "atom" && e.position.length() > r && (r = e.position.length());
	});
	let i = r * 2, a = new e.AmbientLight(16777215, 1);
	t.add(a);
	let o = new e.SpotLight(16777215, 1e3, 0, Math.PI * .27, .6);
	o.position.set(0, -.5, i * 2), o.lookAt(new e.Vector3(0, 0, 0)), t.add(o), [
		{
			pos: [
				-1,
				-.5,
				1
			],
			intensity: .4
		},
		{
			pos: [
				1,
				-.5,
				1
			],
			intensity: .4
		},
		{
			pos: [
				0,
				-.5,
				1
			],
			intensity: .3
		}
	].forEach(({ pos: n, intensity: r }) => {
		let a = new e.DirectionalLight(16777215, r);
		a.position.set(n[0] * i, n[1] * i, n[2] * i), a.lookAt(new e.Vector3(0, 0, 0)), t.add(a);
	});
}
//#endregion
//#region src/lib/ortep3d/viewer-controls.js
var oi = class {
	constructor(t) {
		this.viewer = t, this.state = {
			isDragging: !1,
			isPanning: !1,
			mouse: new e.Vector2(),
			lastClickTime: 0,
			clickStartTime: 0,
			pinchStartDistance: 0,
			lastTouchRotation: 0,
			lastRightClickTime: 0,
			twoFingerStartPos: new e.Vector2(),
			initialCameraPosition: t.camera.position.clone()
		};
		let { container: n, camera: r, renderer: i, moleculeContainer: a, options: o } = t;
		this.container = n, this.camera = r, this.renderer = i, this.moleculeContainer = a, this.options = o, this.doubleClickDelay = 300, this.raycaster = new e.Raycaster(), this.raycaster.near = .1, this.raycaster.far = 100, this.bindEventHandlers(), this.setupEventListeners();
	}
	bindEventHandlers() {
		this.boundHandlers = {
			wheel: this.handleWheel.bind(this),
			mouseDown: this.handleMouseDown.bind(this),
			mouseMove: this.handleMouseMove.bind(this),
			mouseUp: this.handleMouseUp.bind(this),
			click: this.handleClick.bind(this),
			contextMenu: this.handleContextMenu.bind(this),
			touchStart: this.handleTouchStart.bind(this),
			touchMove: this.handleTouchMove.bind(this),
			touchEnd: this.handleTouchEnd.bind(this),
			resize: this.handleResize.bind(this)
		};
	}
	setupEventListeners() {
		let e = this.renderer.domElement, { wheel: t, mouseDown: n, mouseMove: r, mouseUp: i, click: a, contextMenu: o, touchStart: s, touchMove: c, touchEnd: l, resize: u } = this.boundHandlers;
		e.addEventListener("wheel", t, { passive: !1 }), e.addEventListener("mousedown", n), e.addEventListener("mousemove", r), e.addEventListener("mouseup", i), e.addEventListener("mouseleave", i), e.addEventListener("click", a), e.addEventListener("contextmenu", o), e.addEventListener("touchstart", s, { passive: !1 }), e.addEventListener("touchmove", c, { passive: !1 }), e.addEventListener("touchend", l), window.addEventListener("resize", u);
	}
	clientToMouseCoordinates(t, n) {
		let r = this.container.getBoundingClientRect();
		return new e.Vector2((t - r.left) / r.width * 2 - 1, -((n - r.top) / r.height) * 2 + 1);
	}
	updateMouseCoordinates(e, t) {
		let n = this.clientToMouseCoordinates(e, t);
		this.state.mouse.x = n.x, this.state.mouse.y = n.y;
	}
	resetCameraPosition() {
		this.viewer.cameraController.reset(), this.viewer.requestRender();
	}
	handleSelection(e, t) {
		this.updateMouseCoordinates(e.clientX, e.clientY), this.raycaster.setFromCamera(this.state.mouse, this.camera);
		let n = [];
		this.moleculeContainer.traverse((e) => {
			e.userData?.selectable && n.push(e);
		});
		let r = this.raycaster.intersectObjects(n).filter((e) => e.object.userData?.selectable);
		r.length > 0 ? this.viewer.selections.handle(r[0].object) : t < this.doubleClickDelay && this.viewer.selections.clear(), this.viewer.requestRender();
	}
	rotateStructure(t) {
		let n = this.options.interaction.rotationSpeed, r = new e.Vector3(1, 0, 0), i = new e.Vector3(0, 1, 0);
		this.moleculeContainer.applyMatrix4(new e.Matrix4().makeRotationAxis(i, t.x * n)), this.moleculeContainer.applyMatrix4(new e.Matrix4().makeRotationAxis(r, -t.y * n)), this.viewer.requestRender();
	}
	panCamera(e) {
		this.viewer.cameraController.pan(e), this.viewer.requestRender();
	}
	handleTouchSelect(e, t) {
		let n = this.options.interaction.touchRaycast;
		this.raycaster.params.Line.threshold = n.lineThreshold, this.raycaster.params.Points.threshold = n.pointsThreshold, this.raycaster.params.Mesh.threshold = n.meshThreshold, this.handleSelection(e, t);
	}
	handleZoom(e) {
		this.viewer.cameraController.zoom(e), this.viewer.requestRender();
	}
	handleTouchStart(e) {
		e.preventDefault();
		let t = e.touches;
		if (t.length === 1 && !this.state.isDragging) this.state.isDragging = !0, this.state.clickStartTime = Date.now(), this.updateMouseCoordinates(t[0].clientX, t[0].clientY);
		else if (t.length === 2) {
			if (!this.state.isDragging) {
				let e = t[0].clientX - t[1].clientX, n = t[0].clientY - t[1].clientY;
				this.state.pinchStartDistance = Math.hypot(e, n);
				let r = this.clientToMouseCoordinates((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
				this.state.twoFingerStartPos.copy(r);
			}
			this.state.isDragging = !1;
		}
	}
	handleTouchMove(t) {
		t.preventDefault();
		let n = t.touches;
		if (n.length === 1 && this.state.isDragging) {
			let t = n[0], r = this.clientToMouseCoordinates(t.clientX, t.clientY), i = new e.Vector2(r.x - this.state.mouse.x, r.y - this.state.mouse.y);
			this.rotateStructure(i), this.state.mouse.set(r.x, r.y);
		} else if (n.length === 2) {
			let e = n[0].clientX - n[1].clientX, t = n[0].clientY - n[1].clientY, r = Math.hypot(e, t);
			if (!this.state.pinchStartDistance) {
				this.state.pinchStartDistance = r;
				let e = this.clientToMouseCoordinates((n[0].clientX + n[1].clientX) / 2, (n[0].clientY + n[1].clientY) / 2);
				this.state.twoFingerStartPos.copy(e);
				return;
			}
			this.handleZoom((this.state.pinchStartDistance - r) * this.options.camera.pinchZoomSpeed), this.state.pinchStartDistance = r;
			let i = this.clientToMouseCoordinates((n[0].clientX + n[1].clientX) / 2, (n[0].clientY + n[1].clientY) / 2), a = i.clone().sub(this.state.twoFingerStartPos);
			this.panCamera(a), this.state.twoFingerStartPos.copy(i);
		}
	}
	handleTouchEnd(e) {
		if (e.cancelable && e.preventDefault(), e.touches.length === 0 && e.changedTouches.length > 0) {
			if (Date.now() - this.state.clickStartTime < this.options.interaction.clickThreshold) {
				let t = e.changedTouches[0], n = Date.now(), r = {
					clientX: t.clientX,
					clientY: t.clientY
				};
				this.handleTouchSelect(r, n - this.state.lastClickTime), this.state.lastClickTime = n;
			}
			this.state.isDragging = !1, this.state.pinchStartDistance = 0, this.viewer.atomLabelManager?.invalidateLayout(), this.viewer.requestRender();
		}
	}
	handleContextMenu(e) {
		e.preventDefault();
		let t = Date.now();
		t - this.state.lastRightClickTime < this.doubleClickDelay && this.resetCameraPosition(), this.state.lastRightClickTime = t;
	}
	handleMouseDown(e) {
		e.button === 2 ? this.state.isPanning = !0 : this.state.isDragging = !0, this.state.clickStartTime = Date.now(), this.updateMouseCoordinates(e.clientX, e.clientY);
	}
	handleMouseMove(t) {
		if (!this.state.isDragging && !this.state.isPanning) return;
		let n = this.container.getBoundingClientRect(), r = new e.Vector2((t.clientX - n.left) / n.width * 2 - 1, -((t.clientY - n.top) / n.height) * 2 + 1), i = r.clone().sub(this.state.mouse);
		this.state.isPanning ? this.panCamera(i) : this.rotateStructure(i), this.state.mouse.copy(r);
	}
	handleMouseUp() {
		this.state.isDragging = !1, this.state.isPanning = !1, this.viewer.atomLabelManager?.invalidateLayout(), this.viewer.requestRender();
	}
	handleClick(e) {
		if (e.button !== 0 || Date.now() - this.state.clickStartTime > this.options.interaction.clickThreshold || this.state.isDragging) return;
		let t = Date.now(), n = this.options.interaction.mouseRaycast;
		this.raycaster.params.Line.threshold = n.lineThreshold, this.raycaster.params.Points.threshold = n.pointsThreshold, this.raycaster.params.Mesh.threshold = n.meshThreshold, this.handleSelection(e, t - this.state.lastClickTime), this.state.lastClickTime = t;
	}
	handleWheel(e) {
		e.preventDefault(), this.handleZoom(e.deltaY * this.options.camera.wheelZoomSpeed);
	}
	handleResize() {
		this.viewer.cameraController.handleResize(), this.viewer.resizeRendererToDisplaySize(), this.viewer.requestRender();
	}
	dispose() {
		let e = this.renderer.domElement, { wheel: t, mouseDown: n, mouseMove: r, mouseUp: i, click: a, contextMenu: o, touchStart: s, touchMove: c, touchEnd: l, resize: u } = this.boundHandlers;
		e.removeEventListener("wheel", t), e.removeEventListener("mousedown", n), e.removeEventListener("mousemove", r), e.removeEventListener("mouseup", i), e.removeEventListener("mouseleave", i), e.removeEventListener("click", a), e.removeEventListener("contextmenu", o), e.removeEventListener("touchstart", s), e.removeEventListener("touchmove", c), e.removeEventListener("touchend", l), window.removeEventListener("resize", u);
	}
}, si = class t {
	constructor(n, r) {
		if (new.target === t) throw Error("AbstractCamera is an abstract class and cannot be instantiated directly");
		this.container = n, this.options = r, this.cameraTarget = new e.Vector3(0, 0, 0), this.createCamera();
	}
	createCamera() {
		throw Error("createCamera() must be implemented by subclass");
	}
	fitToStructure(e) {
		throw Error("fitToStructure() must be implemented by subclass");
	}
	zoom(e) {
		throw Error("zoom() must be implemented by subclass");
	}
	pan(e) {
		throw Error("pan() must be implemented by subclass");
	}
	handleResize() {
		throw Error("handleResize() must be implemented by subclass");
	}
	reset() {
		this.camera.position.copy(this.basePosition), this.camera.lookAt(this.cameraTarget);
	}
}, ci = class extends si {
	createCamera() {
		return this.camera = new e.PerspectiveCamera(this.options.fov, this.container.clientWidth / this.container.clientHeight, this.options.near, this.options.far), this.camera.position.copy(this.options.initialPosition), this.camera.lookAt(this.cameraTarget), this.camera;
	}
	fitToStructure(t) {
		let n = new e.Box3().setFromObject(t);
		if (n.isEmpty()) return;
		let r = new e.Vector3();
		n.getSize(r);
		let i = this.options.fov * Math.PI / 180, a = this.container.clientWidth / this.container.clientHeight, o = Math.atan(a * Math.tan(i / 2) * 2), s = r.x / r.y, c;
		c = s <= a ? r.y / 2 / Math.tan(i / 2) + r.z / 2 : r.x / 2 / Math.tan(o / 2) + r.z / 2, this.camera.position.set(0, 0, c), this.camera.lookAt(this.cameraTarget), this.options.minDistance = c * .2, this.options.maxDistance = c * 2, this.basePosition = new e.Vector3(0, 0, c);
	}
	zoom(t) {
		let { minDistance: n, maxDistance: r } = this.options, i = r - n, a = this.camera.position.length(), o = e.MathUtils.clamp(a + t * i, n, r), s = this.camera.position.clone().normalize();
		this.camera.position.copy(s.multiplyScalar(o));
	}
	pan(t) {
		let n = this.camera.position.z, r = this.options.fov * Math.PI / 180, i = Math.tan(r / 2) * n, a = i * this.camera.aspect, o = -t.x * a, s = -t.y * i, c = new e.Vector3(), l = new e.Vector3();
		this.camera.matrix.extractBasis(c, l, new e.Vector3()), this.camera.position.addScaledVector(c, o), this.camera.position.addScaledVector(l, s);
	}
	handleResize() {
		let e = this.container.clientWidth / this.container.clientHeight;
		this.camera.aspect = e;
		let t = this.options.fov;
		this.container.clientWidth < this.container.clientHeight ? this.camera.fov = 2 * Math.atan(Math.tan(t * Math.PI / 360) / e) * 180 / Math.PI : this.camera.fov = t, this.camera.updateProjectionMatrix();
	}
}, li = class extends si {
	createCamera() {
		let t = this.container.clientWidth / this.container.clientHeight, n = this.options.orthoSize || 5;
		return this.camera = new e.OrthographicCamera(-n * t, n * t, n, -n, this.options.near, this.options.far), this.camera.position.copy(this.options.initialPosition), this.camera.lookAt(this.cameraTarget), this.camera;
	}
	fitToStructure(t) {
		let n = new e.Box3().setFromObject(t);
		if (n.isEmpty()) return;
		let r = new e.Vector3();
		n.getSize(r);
		let i = this.container.clientWidth / this.container.clientHeight, a = r.x / r.y, o;
		o = a <= i ? r.y / 2 : r.x / (2 * i), o *= 1.05, this.setOrthoSize(o), this.camera.updateProjectionMatrix(), this.options.minSize = o * .2, this.options.maxSize = o * 2, this.baseSize = o, this.basePosition = new e.Vector3(0, 0, Math.max(r.x, r.y)), this.camera.position.set(this.basePosition.x, this.basePosition.y, this.basePosition.z);
	}
	zoom(t) {
		let { minDistance: n, maxDistance: r } = this.options, i = r - n, { minSize: a, maxSize: o } = this.options, s = 1 + t * this.options.wheelZoomSpeed * i * 50, c = e.MathUtils.clamp(this.camera.top * s, a, o);
		this.setOrthoSize(c), this.camera.updateProjectionMatrix();
	}
	pan(t) {
		let n = this.camera.top, r = this.camera.right / this.camera.top, i = -t.x * n * r, a = -t.y * n, o = new e.Vector3(), s = new e.Vector3();
		this.camera.matrix.extractBasis(o, s, new e.Vector3()), this.camera.position.addScaledVector(o, i), this.camera.position.addScaledVector(s, a);
	}
	handleResize() {
		let e = this.container.clientWidth / this.container.clientHeight, t = this.camera.top;
		this.camera.left = -t * e, this.camera.right = t * e, this.camera.updateProjectionMatrix();
	}
	setOrthoSize(e) {
		let t = this.container.clientWidth / this.container.clientHeight;
		this.camera.top = e, this.camera.bottom = -e, this.camera.left = -e * t, this.camera.right = e * t;
	}
};
function ui(e, t) {
	switch ((t.camera?.type || "perspective").toLowerCase()) {
		case "orthographic": return new li(e, t.camera);
		default: return new ci(e, t.camera);
	}
}
//#endregion
//#region src/lib/ortep3d/cell3d.js
function di(t, n, r, i, a) {
	let o = t.clone().normalize(), s = t.length() - r, c = new e.CylinderGeometry(a, a, s, 8), l = new e.MeshBasicMaterial({ color: n }), u = new e.Mesh(c, l), d = new e.ConeGeometry(i, r, 8), f = new e.MeshBasicMaterial({ color: n }), p = new e.Mesh(d, f), m = new e.Vector3(0, 1, 0), h = new e.Quaternion();
	h.setFromUnitVectors(m, o), u.applyQuaternion(h), p.applyQuaternion(h), u.position.copy(o.clone().multiplyScalar(s / 2)), p.position.copy(o.clone().multiplyScalar(s + r / 2));
	let g = new e.Group();
	return g.add(u), g.add(p), g;
}
function fi(t, n, r, i) {
	let a = new e.Group(), o = [
		new e.Vector3(0, 0, 0),
		new e.Vector3(1, 0, 0),
		new e.Vector3(0, 1, 0),
		new e.Vector3(0, 0, 1),
		new e.Vector3(1, 1, 0),
		new e.Vector3(1, 0, 1),
		new e.Vector3(0, 1, 1),
		new e.Vector3(1, 1, 1)
	].map((e) => e.clone().applyMatrix4(t)), s = [
		[0, 1],
		[1, 4],
		[4, 2],
		[2, 0],
		[3, 5],
		[5, 7],
		[7, 6],
		[6, 3],
		[0, 3],
		[1, 5],
		[4, 7],
		[2, 6]
	], c = new e.LineBasicMaterial({
		color: n,
		transparent: r < 1,
		opacity: r,
		linewidth: 1 * i
	});
	return s.forEach(([t, n]) => {
		let r = new e.BufferGeometry().setFromPoints([o[t], o[n]]), i = new e.Line(r, c);
		a.add(i);
	}), a;
}
function pi(t, n) {
	let { boxColor: r, boxOpacity: i, boxLineWidth: a, arrowColorA: o, arrowColorB: s, arrowColorC: c, arrowHeadLengthMult: l, arrowHeadWidthMult: u, arrowCylinderRadius: d } = n, f = new e.Group(), p = t.fractToCartMatrix.toArray(), m = new e.Matrix4(p[0][0], p[0][1], p[0][2], 0, p[1][0], p[1][1], p[1][2], 0, p[2][0], p[2][1], p[2][2], 0, 0, 0, 0, 1), h = fi(m, r, i, a);
	f.add(h);
	let g = new e.Vector3(), _ = new e.Vector3(), v = new e.Vector3();
	m.extractBasis(g, _, v);
	let { a: y, b, c: x } = t, S = Math.max(y, b, x) * l, C = S * u, w = di(g, o, S, C, d), T = di(_, s, S, C, d), E = di(v, c, S, C, d);
	return f.add(w), f.add(T), f.add(E), f.name = "UnitCell", f.userData = {
		selectable: !1,
		cellParameters: {
			a: y,
			b,
			c: x,
			alpha: t.alpha,
			beta: t.beta,
			gamma: t.gamma
		},
		type: "UnitCell"
	}, f;
}
//#endregion
//#region src/lib/ortep3d/atom-label-layout.js
function mi(e, t) {
	return e.left < t.right && e.right > t.left && e.top < t.bottom && e.bottom > t.top;
}
function hi(e, t) {
	let n = Math.max(e.left, Math.min(t.x, e.right)), r = Math.max(e.top, Math.min(t.y, e.bottom)), i = t.x - n, a = t.y - r;
	return i * i + a * a < t.radius * t.radius;
}
function gi(e, t) {
	let n = e.radius || 0, r = {
		left: t.left - n,
		right: t.right + n,
		top: t.top - n,
		bottom: t.bottom + n
	}, i = e.x2 - e.x1, a = e.y2 - e.y1, o = 0, s = 1;
	for (let [t, n, c, l] of [[
		e.x1,
		i,
		r.left,
		r.right
	], [
		e.y1,
		a,
		r.top,
		r.bottom
	]]) {
		if (Math.abs(n) < 1e-9) {
			if (t < c || t > l) return !1;
			continue;
		}
		let e = (c - t) / n, r = (l - t) / n;
		if (o = Math.max(o, Math.min(e, r)), s = Math.min(s, Math.max(e, r)), o > s) return !1;
	}
	return !0;
}
function _i(e, t) {
	let n = t.x2 - t.x1, r = t.y2 - t.y1, i = n * n + r * r;
	if (i === 0) return (e.x - t.x1) ** 2 + (e.y - t.y1) ** 2;
	let a = Math.max(0, Math.min(1, ((e.x - t.x1) * n + (e.y - t.y1) * r) / i)), o = t.x1 + a * n, s = t.y1 + a * r;
	return (e.x - o) ** 2 + (e.y - s) ** 2;
}
function vi(e, t, n) {
	return (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x);
}
function yi(e, t) {
	let n = {
		x: e.x1,
		y: e.y1
	}, r = {
		x: e.x2,
		y: e.y2
	}, i = {
		x: t.x1,
		y: t.y1
	}, a = {
		x: t.x2,
		y: t.y2
	}, o = vi(n, r, i), s = vi(n, r, a), c = vi(i, a, n), l = vi(i, a, r);
	return [
		o,
		s,
		c,
		l
	].every((e) => Math.abs(e) < 1e-9) ? Math.max(Math.min(e.x1, e.x2), Math.min(t.x1, t.x2)) <= Math.min(Math.max(e.x1, e.x2), Math.max(t.x1, t.x2)) && Math.max(Math.min(e.y1, e.y2), Math.min(t.y1, t.y2)) <= Math.min(Math.max(e.y1, e.y2), Math.max(t.y1, t.y2)) : o * s <= 0 && c * l <= 0;
}
function bi(e, t) {
	if (yi(e, t)) return !0;
	let n = (e.radius || 0) + (t.radius || 0);
	return Math.min(_i({
		x: e.x1,
		y: e.y1
	}, t), _i({
		x: e.x2,
		y: e.y2
	}, t), _i({
		x: t.x1,
		y: t.y1
	}, e), _i({
		x: t.x2,
		y: t.y2
	}, e)) <= n * n;
}
function xi(e) {
	let t = e.radius || 0;
	return {
		left: Math.min(e.x1, e.x2) - t,
		right: Math.max(e.x1, e.x2) + t,
		top: Math.min(e.y1, e.y2) - t,
		bottom: Math.max(e.y1, e.y2) + t
	};
}
function Si(e) {
	return {
		left: e.x - e.radius,
		right: e.x + e.radius,
		top: e.y - e.radius,
		bottom: e.y + e.radius
	};
}
function Ci(e) {
	return {
		left: Math.min(...e.map((e) => e.x)),
		right: Math.max(...e.map((e) => e.x)),
		top: Math.min(...e.map((e) => e.y)),
		bottom: Math.max(...e.map((e) => e.y))
	};
}
function wi(e, t) {
	let n = [...e.map(Si), ...t.map(xi)];
	return n.length === 0 ? null : n.reduce((e, t) => ({
		left: Math.min(e.left, t.left),
		right: Math.max(e.right, t.right),
		top: Math.min(e.top, t.top),
		bottom: Math.max(e.bottom, t.bottom)
	}));
}
var Ti = class {
	constructor(e = 64) {
		this.cellSize = e, this.cells = /* @__PURE__ */ new Map();
	}
	insert(e, t) {
		for (let n = Math.floor(t.left / this.cellSize); n <= Math.floor(t.right / this.cellSize); n++) for (let r = Math.floor(t.top / this.cellSize); r <= Math.floor(t.bottom / this.cellSize); r++) {
			let t = `${n},${r}`;
			this.cells.has(t) || this.cells.set(t, /* @__PURE__ */ new Set()), this.cells.get(t).add(e);
		}
	}
	remove(e, t) {
		for (let n = Math.floor(t.left / this.cellSize); n <= Math.floor(t.right / this.cellSize); n++) for (let r = Math.floor(t.top / this.cellSize); r <= Math.floor(t.bottom / this.cellSize); r++) {
			let t = `${n},${r}`, i = this.cells.get(t);
			i && (i.delete(e), i.size === 0 && this.cells.delete(t));
		}
	}
	query(e) {
		let t = /* @__PURE__ */ new Set();
		for (let n = Math.floor(e.left / this.cellSize); n <= Math.floor(e.right / this.cellSize); n++) for (let r = Math.floor(e.top / this.cellSize); r <= Math.floor(e.bottom / this.cellSize); r++) {
			let e = this.cells.get(`${n},${r}`);
			e && e.forEach((e) => t.add(e));
		}
		return [...t];
	}
};
function Ei(e, t) {
	let n = !1;
	for (let r = 0, i = t.length - 1; r < t.length; i = r++) {
		let a = t[r], o = t[i];
		a.y > e.y != o.y > e.y && e.x < (o.x - a.x) * (e.y - a.y) / (o.y - a.y) + a.x && (n = !n);
	}
	return n;
}
var Di = Array.from({ length: 16 }, (e, t) => {
	let n = t * Math.PI / 8;
	return {
		x: Math.cos(n),
		y: Math.sin(n)
	};
});
function Oi(e, t, n, r) {
	let i = e.width / 2, a = e.height / 2, o = Math.abs(t.x) * i + Math.abs(t.y) * a, s = e.radius + r.atomPadding + o + (n - 1) * r.fallbackDistance, c = e.x + t.x * s, l = e.y + t.y * s, u = r.labelPadding, d = n > 1 ? {
		x1: e.x + t.x * (e.radius + r.atomPadding),
		y1: e.y + t.y * (e.radius + r.atomPadding),
		x2: c - t.x * (o + u),
		y2: l - t.y * (o + u),
		radius: r.leaderWidth / 2
	} : null;
	return {
		x: c,
		y: l,
		anchorX: e.x,
		anchorY: e.y,
		direction: t,
		distanceMultiplier: n,
		leaderLine: n > 1,
		leaderSegment: d,
		rect: {
			left: c - i - u,
			right: c + i + u,
			top: l - a - u,
			bottom: l + a + u
		}
	};
}
function ki(e, t, n, r, i) {
	let a = t.preferredDirection || {
		x: 1,
		y: -1
	}, o = (1 - (e.direction.x * a.x + e.direction.y * a.y)) * 50;
	if (e.leaderLine && (o += 150 + (e.distanceMultiplier - 1) * 75), n.some((t) => Ei(e, t)) && (o += i.ringPenalty), r) {
		let t = e.direction.x * r.direction.x + e.direction.y * r.direction.y;
		o += (1 - t) * i.movementPenalty;
	}
	return o;
}
function Ai(e, t, n, r) {
	let i = e.width / 2, a = e.height / 2, o = t - e.x, s = n - e.y, c = Math.hypot(o, s) || 1, l = {
		x: o / c,
		y: s / c
	}, u = Math.abs(l.x) * i + Math.abs(l.y) * a, d = r.labelPadding;
	return {
		x: t,
		y: n,
		anchorX: e.x,
		anchorY: e.y,
		direction: l,
		distanceMultiplier: 1 + c / r.fallbackDistance,
		leaderLine: !0,
		isCallout: !0,
		leaderSegment: {
			x1: e.x + l.x * (e.radius + r.atomPadding),
			y1: e.y + l.y * (e.radius + r.atomPadding),
			x2: t - l.x * (u + d),
			y2: n - l.y * (u + d),
			radius: r.leaderWidth / 2
		},
		rect: {
			left: t - i - d,
			right: t + i + d,
			top: n - a - d,
			bottom: n + a + d
		}
	};
}
function ji(e) {
	return e.leaderSegment ? Math.hypot(e.leaderSegment.x2 - e.leaderSegment.x1, e.leaderSegment.y2 - e.leaderSegment.y1) : 0;
}
function Mi(e, t) {
	if (!Number.isFinite(e.z)) return null;
	let n = Math.max(1, t.performanceNoSpaceCellSize ?? 24);
	return [Math.floor(e.x / n), Math.floor(e.y / n)].join(":");
}
function Ni(e, t, n) {
	return e.left >= n && e.top >= n && e.right <= t.width - n && e.bottom <= t.height - n;
}
function Pi(e, t, n, r, i, a, o = /* @__PURE__ */ new Map()) {
	let s = [], c = [], l = [], u = a.spatialCellSize || 64, d = new Ti(u), f = new Ti(u), p = new Ti(u), m = new Ti(u), h = new Ti(u);
	t.forEach((e) => d.insert(e, Si(e))), n.forEach((e) => f.insert(e, xi(e))), r.forEach((e) => p.insert(e, Ci(e)));
	let g = Math.min(e.length, a.maxVisible ?? Infinity), _ = a.placementMode === "performance-omit" || a.placementMode === "auto-omit" && g > (a.autoPerformanceLabelThreshold ?? 500), v = [...e].sort((e, t) => (t.priority || 0) - (e.priority || 0) || (_ ? (Number.isFinite(e.z) ? e.z : Infinity) - (Number.isFinite(t.z) ? t.z : Infinity) : 0) || e.id.localeCompare(t.id)), y = v.slice(0, a.maxVisible), b = a.placementMode === "maximum-coverage", x = wi(t, n), S = /* @__PURE__ */ new Map(), C = /* @__PURE__ */ new WeakMap(), w = /* @__PURE__ */ new Map(), T = (e, t) => {
		if (C.has(e)) return C.get(e);
		let n = !0;
		if (ji(e) > (a.maxConnectorLength ?? Infinity) && (n = !1), n && !Ni(e.rect, i, a.viewportPadding) && (n = !1), n && d.query(e.rect).some((t) => hi(e.rect, t)) && (n = !1), n && f.query(e.rect).some((t) => gi(t, e.rect)) && (n = !1), n && e.leaderSegment) {
			let r = xi(e.leaderSegment);
			!b && f.query(r).some((t) => bi(e.leaderSegment, t)) && (n = !1), n && d.query(r).some((n) => n.id !== t.id && _i(n, e.leaderSegment) < n.radius ** 2) && (n = !1);
		}
		return C.set(e, n), n;
	}, E = (e, t) => {
		if (!T(e, t)) return null;
		let n = new Set(m.query(e.rect).filter((t) => mi(e.rect, t.rect)));
		if (h.query(e.rect).filter((t) => gi(t.leaderSegment, e.rect)).forEach((e) => n.add(e)), !e.leaderSegment) return n;
		let r = xi(e.leaderSegment);
		return m.query(r).filter((t) => gi(e.leaderSegment, t.rect)).forEach((e) => n.add(e)), b || h.query(r).filter((t) => bi(e.leaderSegment, t.leaderSegment)).forEach((e) => n.add(e)), n;
	}, D = (e, t) => E(e, t)?.size === 0, O = (e, t) => {
		let n = {
			...e,
			...t
		};
		return s.push(n), m.insert(n, n.rect), n.leaderSegment && h.insert(n, xi(n.leaderSegment)), n;
	}, k = (e) => {
		s.splice(s.indexOf(e), 1), m.remove(e, e.rect), e.leaderSegment && h.remove(e, xi(e.leaderSegment));
	}, A = (e, t, n, r, i) => {
		for (let a of t) {
			if (i.remaining-- <= 0) return !1;
			let t = E(a, e);
			if (!t) continue;
			if (t.size === 0) return O(e, a), !0;
			if (n <= 0 || t.size !== 1) continue;
			let o = [...t][0];
			if (r.has(o.id) || (o.priority || 0) > (e.priority || 0)) continue;
			let s = S.get(o.id) || [];
			if (k(o), !D(a, e)) {
				O(o, o);
				continue;
			}
			let c = O(e, a), l = new Set(r);
			if (l.add(e.id), A(o, s, n - 1, l, i)) return !0;
			k(c), O(o, o);
		}
		return !1;
	}, ee = (e, t) => A(e, t, Math.max(0, a.repairDepth ?? 2), /* @__PURE__ */ new Set(), { remaining: Math.max(0, a.repairSearchLimit ?? 48) });
	for (let e of y) {
		let t = _ ? Mi(e, a) : null, n = t === null ? void 0 : w.get(t);
		if (n !== void 0 && n < e.z - 1e-6) {
			c.push({
				id: e.id,
				text: e.text,
				reason: "static-no-space"
			});
			continue;
		}
		let r = [], i = b ? Array.from({ length: Math.max(2, a.maximumCoverageDistanceSteps ?? 6) }, (e, t) => t + 1) : [1, 2];
		for (let t of i) for (let n of Di) {
			let i = Oi(e, n, t, a);
			i.score = ki(i, e, p.query({
				left: i.x,
				right: i.x,
				top: i.y,
				bottom: i.y
			}), o.get(e.id), a), r.push(i);
		}
		r.sort((e, t) => e.score - t.score), S.set(e.id, r);
		let s = r.find((t) => D(t, e));
		if (s) O(e, s);
		else if (_ && t !== null && r.every((t) => !T(t, e))) {
			let n = w.get(t);
			(n === void 0 || e.z < n) && w.set(t, e.z), l.push(e);
		} else if (!_ && ee(e, r)) continue;
		else l.push(e);
	}
	if (b && l.length > 0) {
		let e = Math.max(1, a.calloutColumns || 3), t = a.calloutRowGap || 4, n = a.calloutPlacement !== "viewport" && x !== null, r = a.calloutGap ?? 12, o = n ? x.left - r : a.viewportPadding, s = n ? x.right + r : i.width - a.viewportPadding, u = [...l].sort((e, t) => (t.priority || 0) - (e.priority || 0) || Math.min(Math.abs(t.x - o), Math.abs(s - t.x)) - Math.min(Math.abs(e.x - o), Math.abs(s - e.x)) || e.id.localeCompare(t.id));
		for (let o of u) {
			let s = [], l = 0, u = o.height + a.labelPadding * 2 + t, d = n ? Math.max(a.viewportPadding, x.top) : a.viewportPadding, p = n ? Math.min(i.height - a.viewportPadding, x.bottom) : i.height - a.viewportPadding, m = Math.max(1, Math.floor(Math.max(u, p - d) / u)), h = d + o.height / 2 + a.labelPadding, g = Array.from({ length: m }, (e, t) => h + t * u).filter((e) => e + o.height / 2 + a.labelPadding <= p);
			g.length === 0 && g.push(Math.max(a.viewportPadding + o.height / 2 + a.labelPadding, Math.min(i.height - a.viewportPadding - o.height / 2 - a.labelPadding, (d + p) / 2))), g.sort((e, t) => Math.abs(e - o.y) - Math.abs(t - o.y));
			let _ = o.x < i.width / 2 ? "left" : "right", v = [_, _ === "left" ? "right" : "left"];
			calloutSearch: for (let t of g) for (let c = 0; c < e; c++) for (let e of v) {
				if (l >= a.calloutSearchLimit || s.length >= a.calloutChoiceLimit) break calloutSearch;
				l++;
				let u = o.width / 2 + a.labelPadding + c * (o.width + a.calloutColumnGap), d = e === "left" ? a.viewportPadding + u : i.width - a.viewportPadding - u, p = e === "left" ? x?.left - r - u : x?.right + r + u, m = n ? p : d, h = Ai(o, m, t, a);
				if (E(h, o) !== null) {
					h.score = Math.hypot(m - o.x, t - o.y);
					let e = xi(h.leaderSegment);
					h.score += f.query(e).filter((e) => bi(h.leaderSegment, e)).length * a.leaderBondCrossingPenalty, s.push(h);
				}
			}
			let y = [...(S.get(o.id) || []).filter((e) => E(e, o) !== null), ...s].sort((e, t) => ji(e) - ji(t) || e.score - t.score);
			S.set(o.id, y), A(o, y, Math.max(0, a.repairDepth ?? 2), /* @__PURE__ */ new Set(), { remaining: Math.max(0, a.repairSearchLimit ?? 48) }) || c.push({
				id: o.id,
				text: o.text,
				reason: "viewport-capacity"
			});
		}
	} else l.forEach((e) => c.push({
		id: e.id,
		text: e.text,
		reason: "no-space"
	}));
	for (let e of v.slice(a.maxVisible)) c.push({
		id: e.id,
		text: e.text,
		reason: "max-visible"
	});
	return {
		placed: s,
		hidden: c,
		placementPolicy: b ? "maximum-coverage" : _ ? "performance-omit" : "quality-omit"
	};
}
//#endregion
//#region src/lib/ortep3d/atom-label-worker.js?worker&inline
var Fi = "(function(){function e(e,t){return e.left<t.right&&e.right>t.left&&e.top<t.bottom&&e.bottom>t.top}function t(e,t){let n=Math.max(e.left,Math.min(t.x,e.right)),r=Math.max(e.top,Math.min(t.y,e.bottom)),i=t.x-n,a=t.y-r;return i*i+a*a<t.radius*t.radius}function n(e,t){let n=e.radius||0,r={left:t.left-n,right:t.right+n,top:t.top-n,bottom:t.bottom+n},i=e.x2-e.x1,a=e.y2-e.y1,o=0,s=1;for(let[t,n,c,l]of[[e.x1,i,r.left,r.right],[e.y1,a,r.top,r.bottom]]){if(Math.abs(n)<1e-9){if(t<c||t>l)return!1;continue}let e=(c-t)/n,r=(l-t)/n;if(o=Math.max(o,Math.min(e,r)),s=Math.min(s,Math.max(e,r)),o>s)return!1}return!0}function r(e,t){let n=t.x2-t.x1,r=t.y2-t.y1,i=n*n+r*r;if(i===0)return(e.x-t.x1)**2+(e.y-t.y1)**2;let a=Math.max(0,Math.min(1,((e.x-t.x1)*n+(e.y-t.y1)*r)/i)),o=t.x1+a*n,s=t.y1+a*r;return(e.x-o)**2+(e.y-s)**2}function i(e,t,n){return(t.x-e.x)*(n.y-e.y)-(t.y-e.y)*(n.x-e.x)}function a(e,t){let n={x:e.x1,y:e.y1},r={x:e.x2,y:e.y2},a={x:t.x1,y:t.y1},o={x:t.x2,y:t.y2},s=i(n,r,a),c=i(n,r,o),l=i(a,o,n),u=i(a,o,r);return[s,c,l,u].every(e=>Math.abs(e)<1e-9)?Math.max(Math.min(e.x1,e.x2),Math.min(t.x1,t.x2))<=Math.min(Math.max(e.x1,e.x2),Math.max(t.x1,t.x2))&&Math.max(Math.min(e.y1,e.y2),Math.min(t.y1,t.y2))<=Math.min(Math.max(e.y1,e.y2),Math.max(t.y1,t.y2)):s*c<=0&&l*u<=0}function o(e,t){if(a(e,t))return!0;let n=(e.radius||0)+(t.radius||0);return Math.min(r({x:e.x1,y:e.y1},t),r({x:e.x2,y:e.y2},t),r({x:t.x1,y:t.y1},e),r({x:t.x2,y:t.y2},e))<=n*n}function s(e){let t=e.radius||0;return{left:Math.min(e.x1,e.x2)-t,right:Math.max(e.x1,e.x2)+t,top:Math.min(e.y1,e.y2)-t,bottom:Math.max(e.y1,e.y2)+t}}function c(e){return{left:e.x-e.radius,right:e.x+e.radius,top:e.y-e.radius,bottom:e.y+e.radius}}function l(e){return{left:Math.min(...e.map(e=>e.x)),right:Math.max(...e.map(e=>e.x)),top:Math.min(...e.map(e=>e.y)),bottom:Math.max(...e.map(e=>e.y))}}function u(e,t){let n=[...e.map(c),...t.map(s)];return n.length===0?null:n.reduce((e,t)=>({left:Math.min(e.left,t.left),right:Math.max(e.right,t.right),top:Math.min(e.top,t.top),bottom:Math.max(e.bottom,t.bottom)}))}var d=class{constructor(e=64){this.cellSize=e,this.cells=new Map}insert(e,t){for(let n=Math.floor(t.left/this.cellSize);n<=Math.floor(t.right/this.cellSize);n++)for(let r=Math.floor(t.top/this.cellSize);r<=Math.floor(t.bottom/this.cellSize);r++){let t=`${n},${r}`;this.cells.has(t)||this.cells.set(t,new Set),this.cells.get(t).add(e)}}remove(e,t){for(let n=Math.floor(t.left/this.cellSize);n<=Math.floor(t.right/this.cellSize);n++)for(let r=Math.floor(t.top/this.cellSize);r<=Math.floor(t.bottom/this.cellSize);r++){let t=`${n},${r}`,i=this.cells.get(t);i&&(i.delete(e),i.size===0&&this.cells.delete(t))}}query(e){let t=new Set;for(let n=Math.floor(e.left/this.cellSize);n<=Math.floor(e.right/this.cellSize);n++)for(let r=Math.floor(e.top/this.cellSize);r<=Math.floor(e.bottom/this.cellSize);r++){let e=this.cells.get(`${n},${r}`);e&&e.forEach(e=>t.add(e))}return[...t]}};function f(e,t){let n=!1;for(let r=0,i=t.length-1;r<t.length;i=r++){let a=t[r],o=t[i];a.y>e.y!=o.y>e.y&&e.x<(o.x-a.x)*(e.y-a.y)/(o.y-a.y)+a.x&&(n=!n)}return n}let p=Array.from({length:16},(e,t)=>{let n=t*Math.PI/8;return{x:Math.cos(n),y:Math.sin(n)}});function m(e,t,n,r){let i=e.width/2,a=e.height/2,o=Math.abs(t.x)*i+Math.abs(t.y)*a,s=e.radius+r.atomPadding+o+(n-1)*r.fallbackDistance,c=e.x+t.x*s,l=e.y+t.y*s,u=r.labelPadding,d=n>1?{x1:e.x+t.x*(e.radius+r.atomPadding),y1:e.y+t.y*(e.radius+r.atomPadding),x2:c-t.x*(o+u),y2:l-t.y*(o+u),radius:r.leaderWidth/2}:null;return{x:c,y:l,anchorX:e.x,anchorY:e.y,direction:t,distanceMultiplier:n,leaderLine:n>1,leaderSegment:d,rect:{left:c-i-u,right:c+i+u,top:l-a-u,bottom:l+a+u}}}function h(e,t,n,r,i){let a=t.preferredDirection||{x:1,y:-1},o=(1-(e.direction.x*a.x+e.direction.y*a.y))*50;if(e.leaderLine&&(o+=150+(e.distanceMultiplier-1)*75),n.some(t=>f(e,t))&&(o+=i.ringPenalty),r){let t=e.direction.x*r.direction.x+e.direction.y*r.direction.y;o+=(1-t)*i.movementPenalty}return o}function g(e,t,n,r){let i=e.width/2,a=e.height/2,o=t-e.x,s=n-e.y,c=Math.hypot(o,s)||1,l={x:o/c,y:s/c},u=Math.abs(l.x)*i+Math.abs(l.y)*a,d=r.labelPadding;return{x:t,y:n,anchorX:e.x,anchorY:e.y,direction:l,distanceMultiplier:1+c/r.fallbackDistance,leaderLine:!0,isCallout:!0,leaderSegment:{x1:e.x+l.x*(e.radius+r.atomPadding),y1:e.y+l.y*(e.radius+r.atomPadding),x2:t-l.x*(u+d),y2:n-l.y*(u+d),radius:r.leaderWidth/2},rect:{left:t-i-d,right:t+i+d,top:n-a-d,bottom:n+a+d}}}function _(e){return e.leaderSegment?Math.hypot(e.leaderSegment.x2-e.leaderSegment.x1,e.leaderSegment.y2-e.leaderSegment.y1):0}function v(e,t){if(!Number.isFinite(e.z))return null;let n=Math.max(1,t.performanceNoSpaceCellSize??24);return[Math.floor(e.x/n),Math.floor(e.y/n)].join(`:`)}function y(e,t,n){return e.left>=n&&e.top>=n&&e.right<=t.width-n&&e.bottom<=t.height-n}function b(i,a,f,b,x,S,C=new Map){let w=[],T=[],E=[],D=S.spatialCellSize||64,O=new d(D),k=new d(D),A=new d(D),j=new d(D),M=new d(D);a.forEach(e=>O.insert(e,c(e))),f.forEach(e=>k.insert(e,s(e))),b.forEach(e=>A.insert(e,l(e)));let N=Math.min(i.length,S.maxVisible??1/0),P=S.placementMode===`performance-omit`||S.placementMode===`auto-omit`&&N>(S.autoPerformanceLabelThreshold??500),F=[...i].sort((e,t)=>(t.priority||0)-(e.priority||0)||(P?(Number.isFinite(e.z)?e.z:1/0)-(Number.isFinite(t.z)?t.z:1/0):0)||e.id.localeCompare(t.id)),I=F.slice(0,S.maxVisible),L=S.placementMode===`maximum-coverage`,R=u(a,f),z=new Map,B=new WeakMap,V=new Map,H=(e,i)=>{if(B.has(e))return B.get(e);let a=!0;if(_(e)>(S.maxConnectorLength??1/0)&&(a=!1),a&&!y(e.rect,x,S.viewportPadding)&&(a=!1),a&&O.query(e.rect).some(n=>t(e.rect,n))&&(a=!1),a&&k.query(e.rect).some(t=>n(t,e.rect))&&(a=!1),a&&e.leaderSegment){let t=s(e.leaderSegment);!L&&k.query(t).some(t=>o(e.leaderSegment,t))&&(a=!1),a&&O.query(t).some(t=>t.id!==i.id&&r(t,e.leaderSegment)<t.radius**2)&&(a=!1)}return B.set(e,a),a},U=(t,r)=>{if(!H(t,r))return null;let i=new Set(j.query(t.rect).filter(n=>e(t.rect,n.rect)));if(M.query(t.rect).filter(e=>n(e.leaderSegment,t.rect)).forEach(e=>i.add(e)),!t.leaderSegment)return i;let a=s(t.leaderSegment);return j.query(a).filter(e=>n(t.leaderSegment,e.rect)).forEach(e=>i.add(e)),L||M.query(a).filter(e=>o(t.leaderSegment,e.leaderSegment)).forEach(e=>i.add(e)),i},W=(e,t)=>U(e,t)?.size===0,G=(e,t)=>{let n={...e,...t};return w.push(n),j.insert(n,n.rect),n.leaderSegment&&M.insert(n,s(n.leaderSegment)),n},K=e=>{w.splice(w.indexOf(e),1),j.remove(e,e.rect),e.leaderSegment&&M.remove(e,s(e.leaderSegment))},q=(e,t,n,r,i)=>{for(let a of t){if(i.remaining--<=0)return!1;let t=U(a,e);if(!t)continue;if(t.size===0)return G(e,a),!0;if(n<=0||t.size!==1)continue;let o=[...t][0];if(r.has(o.id)||(o.priority||0)>(e.priority||0))continue;let s=z.get(o.id)||[];if(K(o),!W(a,e)){G(o,o);continue}let c=G(e,a),l=new Set(r);if(l.add(e.id),q(o,s,n-1,l,i))return!0;K(c),G(o,o)}return!1},J=(e,t)=>q(e,t,Math.max(0,S.repairDepth??2),new Set,{remaining:Math.max(0,S.repairSearchLimit??48)});for(let e of I){let t=P?v(e,S):null,n=t===null?void 0:V.get(t);if(n!==void 0&&n<e.z-1e-6){T.push({id:e.id,text:e.text,reason:`static-no-space`});continue}let r=[],i=L?Array.from({length:Math.max(2,S.maximumCoverageDistanceSteps??6)},(e,t)=>t+1):[1,2];for(let t of i)for(let n of p){let i=m(e,n,t,S);i.score=h(i,e,A.query({left:i.x,right:i.x,top:i.y,bottom:i.y}),C.get(e.id),S),r.push(i)}r.sort((e,t)=>e.score-t.score),z.set(e.id,r);let a=r.find(t=>W(t,e));if(a)G(e,a);else if(P&&t!==null&&r.every(t=>!H(t,e))){let n=V.get(t);(n===void 0||e.z<n)&&V.set(t,e.z),E.push(e)}else if(!P&&J(e,r))continue;else E.push(e)}if(L&&E.length>0){let e=Math.max(1,S.calloutColumns||3),t=S.calloutRowGap||4,n=S.calloutPlacement!==`viewport`&&R!==null,r=S.calloutGap??12,i=n?R.left-r:S.viewportPadding,a=n?R.right+r:x.width-S.viewportPadding,c=[...E].sort((e,t)=>(t.priority||0)-(e.priority||0)||Math.min(Math.abs(t.x-i),Math.abs(a-t.x))-Math.min(Math.abs(e.x-i),Math.abs(a-e.x))||e.id.localeCompare(t.id));for(let i of c){let a=[],c=0,l=i.height+S.labelPadding*2+t,u=n?Math.max(S.viewportPadding,R.top):S.viewportPadding,d=n?Math.min(x.height-S.viewportPadding,R.bottom):x.height-S.viewportPadding,f=Math.max(1,Math.floor(Math.max(l,d-u)/l)),p=u+i.height/2+S.labelPadding,m=Array.from({length:f},(e,t)=>p+t*l).filter(e=>e+i.height/2+S.labelPadding<=d);m.length===0&&m.push(Math.max(S.viewportPadding+i.height/2+S.labelPadding,Math.min(x.height-S.viewportPadding-i.height/2-S.labelPadding,(u+d)/2))),m.sort((e,t)=>Math.abs(e-i.y)-Math.abs(t-i.y));let h=i.x<x.width/2?`left`:`right`,v=[h,h===`left`?`right`:`left`];calloutSearch:for(let t of m)for(let l=0;l<e;l++)for(let e of v){if(c>=S.calloutSearchLimit||a.length>=S.calloutChoiceLimit)break calloutSearch;c++;let u=i.width/2+S.labelPadding+l*(i.width+S.calloutColumnGap),d=e===`left`?S.viewportPadding+u:x.width-S.viewportPadding-u,f=e===`left`?R?.left-r-u:R?.right+r+u,p=n?f:d,m=g(i,p,t,S);if(U(m,i)!==null){m.score=Math.hypot(p-i.x,t-i.y);let e=s(m.leaderSegment);m.score+=k.query(e).filter(e=>o(m.leaderSegment,e)).length*S.leaderBondCrossingPenalty,a.push(m)}}let y=[...(z.get(i.id)||[]).filter(e=>U(e,i)!==null),...a].sort((e,t)=>_(e)-_(t)||e.score-t.score);z.set(i.id,y),q(i,y,Math.max(0,S.repairDepth??2),new Set,{remaining:Math.max(0,S.repairSearchLimit??48)})||T.push({id:i.id,text:i.text,reason:`viewport-capacity`})}}else E.forEach(e=>T.push({id:e.id,text:e.text,reason:`no-space`}));for(let e of F.slice(S.maxVisible))T.push({id:e.id,text:e.text,reason:`max-visible`});return{placed:w,hidden:T,placementPolicy:L?`maximum-coverage`:P?`performance-omit`:`quality-omit`}}self.onmessage=e=>{let{id:t,labels:n,atoms:r,bonds:i,rings:a,viewport:o,options:s,previousPlacements:c}=e.data;try{let e=b(n,r,i,a,o,s,new Map(c));self.postMessage({id:t,layout:e})}catch(e){self.postMessage({id:t,error:e instanceof Error?e.message:String(e)})}}})();", Ii = typeof self < "u" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", Fi], { type: "text/javascript;charset=utf-8" });
function Li(e) {
	let t;
	try {
		if (t = Ii && (self.URL || self.webkitURL).createObjectURL(Ii), !t) throw "";
		let n = new Worker(t, { name: e?.name });
		return n.addEventListener("error", () => {
			(self.URL || self.webkitURL).revokeObjectURL(t);
		}), n;
	} catch {
		return new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(Fi), { name: e?.name });
	}
}
//#endregion
//#region src/lib/ortep3d/atom-label-manager.js
var Ri = [
	"atomPadding",
	"autoPerformanceLabelThreshold",
	"calloutChoiceLimit",
	"calloutColumnGap",
	"calloutColumns",
	"calloutGap",
	"calloutPlacement",
	"calloutRowGap",
	"calloutSearchLimit",
	"maximumCoverageDistanceSteps",
	"fallbackDistance",
	"performanceNoSpaceCellSize",
	"labelPadding",
	"leaderBondCrossingPenalty",
	"leaderWidth",
	"maxVisible",
	"maxConnectorLength",
	"movementPenalty",
	"placementMode",
	"repairDepth",
	"repairSearchLimit",
	"ringPenalty",
	"spatialCellSize",
	"viewportPadding"
];
function zi(e) {
	return Object.fromEntries(Ri.map((t) => [t, e[t]]));
}
function Bi(e) {
	return Array.isArray(e) || e === "all" || e === "non-hydrogen" || e === "none" ? e : "none";
}
function Vi(e) {
	return Array.isArray(e) ? e.map((e) => typeof e == "string" ? { id: e } : e).filter((e) => e && typeof e.id == "string") : [];
}
function Hi(e, t) {
	return e.includes("|") ? e === t.uniqueId : e === t.label;
}
function Ui(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) {
		let r = (n + 1) % e.length;
		t += e[n].x * e[r].y - e[r].x * e[n].y;
	}
	return Math.abs(t) / 2;
}
function Wi(e, t) {
	return e.z >= -1 && e.z <= 1 && e.x + e.radius >= 0 && e.x - e.radius <= t.width && e.y + e.radius >= 0 && e.y - e.radius <= t.height;
}
function Gi(e) {
	if (!e) return [];
	let t = [...new Map(e.atoms.map((e) => [e.uniqueId, e])).keys()].sort(), n = new Map(t.map((e, t) => [e, t])), r = new Map(t.map((e) => [e, /* @__PURE__ */ new Set()]));
	for (let t of vr(e)) r.has(t.atom1Id) && r.has(t.atom2Id) && (r.get(t.atom1Id).add(t.atom2Id), r.get(t.atom2Id).add(t.atom1Id));
	let i = [], a = /* @__PURE__ */ new Set();
	for (let e of t) {
		let t = [e], o = new Set(t), s = (c) => {
			if (!(t.length > 7 || i.length >= 512)) for (let l of r.get(c)) if (l === e && t.length >= 5) {
				let e = [...t], n = 0;
				for (let t of e) n += [...r.get(t)].filter((t) => e.includes(t)).length;
				if (n !== e.length * 2) continue;
				let o = [...e].sort().join("|");
				a.has(o) || (a.add(o), i.push(e));
			} else !o.has(l) && n.get(l) >= n.get(e) && (o.add(l), t.push(l), s(l), t.pop(), o.delete(l));
		};
		s(e);
	}
	return i;
}
var Ki = class {
	constructor(e) {
		this.viewer = e, this.options = e.options.atomLabels, this.previousPlacements = /* @__PURE__ */ new Map(), this.layout = {
			placed: [],
			hidden: [],
			placementPolicy: "none"
		}, this.rings = null, this.displayStructure = null, this.bondNeighbours = /* @__PURE__ */ new Map(), this.measurementCache = /* @__PURE__ */ new Map(), this.lastLayoutTime = 0, this.forceNextLayout = !0, this.lastMoleculeMatrix = null, this.lastCameraMatrix = null, this.lastProjectionMatrix = null, this.lastViewport = null, this.layoutRevision = 0, this.lastLayoutRevision = 0, this.nextWorkerRequestId = 1, this.worker = null, this.workerUnavailable = !1, this.pendingLayout = null, this.layoutQueued = !1, this.layoutWaiters = [], this.scheduledFrame = null, this.disposed = !1, this.lastExecutionMode = "none", this.loadingIndicatorActive = !1, this.loadingIndicatorTimer = null, this.canvas = document.createElement("canvas"), this.canvas.className = "cifvis-atom-labels", this.canvas.setAttribute("aria-hidden", "true"), Object.assign(this.canvas.style, {
			position: "absolute",
			inset: "0",
			pointerEvents: "none",
			zIndex: "1"
		}), window.getComputedStyle(e.container).position === "static" && (this.changedContainerPosition = !0, this.previousContainerPosition = e.container.style.position, e.container.style.position = "relative"), e.container.appendChild(this.canvas), this.context = this.canvas.getContext("2d"), this.loadingIndicator = document.createElement("div"), this.loadingIndicator.className = "cifvis-atom-label-loading", this.loadingIndicator.setAttribute("role", "status"), this.loadingIndicator.setAttribute("aria-live", "polite"), Object.assign(this.loadingIndicator.style, {
			position: "absolute",
			right: "12px",
			bottom: "12px",
			display: "none",
			alignItems: "center",
			gap: "7px",
			padding: "6px 9px",
			border: "1px solid rgba(0, 0, 0, 0.14)",
			borderRadius: "6px",
			background: "rgba(255, 255, 255, 0.92)",
			color: "#333333",
			font: "12px system-ui, -apple-system, sans-serif",
			pointerEvents: "none",
			zIndex: "2"
		});
		let t = document.createElement("progress");
		t.removeAttribute("value"), t.setAttribute("aria-hidden", "true"), Object.assign(t.style, {
			width: "32px",
			height: "8px"
		}), this.loadingIndicator.append(t, document.createTextNode("Laying out labels…")), e.container.appendChild(this.loadingIndicator);
	}
	setOptions(e) {
		this.options = e, (!e.showLoadingIndicator || Bi(e.show) === "none") && this.endLoadingIndicator(), this.previousPlacements.clear(), this.measurementCache.clear(), this.invalidateLayout();
	}
	setStructure(e) {
		this.endLoadingIndicator(), this.displayStructure = e, this.rings = null, this.bondNeighbours.clear(), this.previousPlacements.clear(), this.invalidateLayout();
	}
	prepareTopology() {
		if (this.rings === null) {
			this.rings = Gi(this.displayStructure), this.bondNeighbours = new Map(this.displayStructure.atoms.map((e) => [e.uniqueId, /* @__PURE__ */ new Set()]));
			for (let e of this.displayStructure.bonds) this.bondNeighbours.has(e.atom1Id) && this.bondNeighbours.has(e.atom2Id) && (this.bondNeighbours.get(e.atom1Id).add(e.atom2Id), this.bondNeighbours.get(e.atom2Id).add(e.atom1Id));
		}
	}
	invalidateLayout() {
		this.forceNextLayout = !0, this.layoutRevision++;
	}
	beginLoadingIndicator() {
		if (!this.options.showLoadingIndicator || this.loadingIndicatorActive) return;
		this.loadingIndicatorActive = !0;
		let e = () => {
			this.loadingIndicatorTimer = null, this.loadingIndicatorActive && !this.disposed && (this.loadingIndicator.style.display = "flex");
		}, t = Math.max(0, this.options.loadingIndicatorDelayMs ?? 120);
		t === 0 ? e() : this.loadingIndicatorTimer = setTimeout(e, t);
	}
	endLoadingIndicator() {
		this.loadingIndicatorActive = !1, this.loadingIndicatorTimer !== null && (clearTimeout(this.loadingIndicatorTimer), this.loadingIndicatorTimer = null), this.loadingIndicator && (this.loadingIndicator.style.display = "none");
	}
	scheduleUpdate() {
		if (!this.disposed) {
			if ((this.viewer.controls?.state.isDragging || this.viewer.controls?.state.isPanning) && this.endLoadingIndicator(), this.clearStaleFrame(), this.pendingLayout) {
				this.layoutQueued = !0;
				return;
			}
			this.scheduledFrame === null && (this.scheduledFrame = requestAnimationFrame(() => {
				this.scheduledFrame = null, this.update();
			}));
		}
	}
	clearStaleFrame() {
		if (!this.context || this.layout.placed.length === 0 || !this.lastMoleculeMatrix || !this.lastCameraMatrix || !this.lastProjectionMatrix) return;
		let e = this.viewer.container.clientWidth, t = this.viewer.container.clientHeight;
		if (!(this.lastViewport?.width !== e || this.lastViewport?.height !== t || this.lastLayoutRevision !== this.layoutRevision || !this.lastMoleculeMatrix.equals(this.viewer.moleculeContainer.matrixWorld) || !this.lastCameraMatrix.equals(this.viewer.camera.matrixWorld) || !this.lastProjectionMatrix.equals(this.viewer.camera.projectionMatrix))) return;
		let n = window.devicePixelRatio || 1;
		this.context.setTransform(n, 0, 0, n, 0, 0), this.context.clearRect(0, 0, e, t);
	}
	transformsUnchanged(e, t) {
		return !this.forceNextLayout && this.lastViewport?.width === e && this.lastViewport?.height === t && this.lastMoleculeMatrix?.equals(this.viewer.moleculeContainer.matrixWorld) && this.lastCameraMatrix?.equals(this.viewer.camera.matrixWorld) && this.lastProjectionMatrix?.equals(this.viewer.camera.projectionMatrix);
	}
	rememberTransforms(e, t) {
		this.lastViewport = {
			width: e,
			height: t
		}, this.lastMoleculeMatrix = this.viewer.moleculeContainer.matrixWorld.clone(), this.lastCameraMatrix = this.viewer.camera.matrixWorld.clone(), this.lastProjectionMatrix = this.viewer.camera.projectionMatrix.clone(), this.forceNextLayout = !1;
	}
	captureLayoutState(e, t) {
		return {
			width: e,
			height: t,
			revision: this.layoutRevision,
			moleculeMatrix: this.viewer.moleculeContainer.matrixWorld.clone(),
			cameraMatrix: this.viewer.camera.matrixWorld.clone(),
			projectionMatrix: this.viewer.camera.projectionMatrix.clone()
		};
	}
	layoutStateIsCurrent(e) {
		return e.revision === this.layoutRevision && e.width === this.viewer.container.clientWidth && e.height === this.viewer.container.clientHeight && e.moleculeMatrix.equals(this.viewer.moleculeContainer.matrixWorld) && e.cameraMatrix.equals(this.viewer.camera.matrixWorld) && e.projectionMatrix.equals(this.viewer.camera.projectionMatrix);
	}
	getWorker() {
		if (this.options.useWorker === !1 || this.workerUnavailable || typeof Worker > "u") return null;
		if (this.worker) return this.worker;
		try {
			return this.worker = new Li({ name: "cifvis-atom-label-layout" }), this.worker.onmessage = (e) => this.handleWorkerMessage(e.data), this.worker.onerror = (e) => {
				e.preventDefault?.(), this.handleWorkerFailure(Error(e.message || "Atom-label worker failed"));
			}, this.worker;
		} catch (e) {
			return this.workerUnavailable = !0, console.warn("Atom-label worker unavailable; using main-thread layout.", e), null;
		}
	}
	resize() {
		let e = window.devicePixelRatio || 1, t = this.viewer.container.clientWidth, n = this.viewer.container.clientHeight, r = Math.floor(t * e), i = Math.floor(n * e);
		(this.canvas.width !== r || this.canvas.height !== i) && (this.canvas.width = r, this.canvas.height = i, this.canvas.style.width = `${t}px`, this.canvas.style.height = `${n}px`);
	}
	resolveRequests() {
		let e = this.displayStructure, t = Bi(this.options.show);
		if (!e || t === "none") return [];
		if (t === "all" || t === "non-hydrogen") return e.atoms.filter((e) => t === "all" || !["H", "D"].includes(e.atomType)).map((e) => ({
			atom: e,
			text: this.options.text?.[e.uniqueId] ?? this.options.text?.[e.label] ?? e.label,
			priority: 0
		})).filter((e) => e.text !== null && String(e.text).length > 0).map((e) => ({
			...e,
			text: String(e.text).slice(0, 200)
		}));
		let n = Vi(t), r = [];
		for (let t of e.atoms) {
			let e = n.find((e) => Hi(e.id, t));
			if (!e) continue;
			let i = e.text ?? this.options.text?.[t.uniqueId] ?? this.options.text?.[t.label] ?? t.label;
			i !== null && String(i).length > 0 && r.push({
				atom: t,
				text: String(i).slice(0, 200),
				priority: e.priority || 0
			});
		}
		return r;
	}
	projectLocalPosition(e) {
		let t = e.clone().applyMatrix4(this.viewer.moleculeContainer.matrixWorld).project(this.viewer.camera);
		return {
			x: (t.x + 1) * this.viewer.container.clientWidth / 2,
			y: (1 - t.y) * this.viewer.container.clientHeight / 2,
			z: t.z
		};
	}
	projectRadius(t, n) {
		let r = this.projectLocalPosition(t), i = [
			new e.Vector3(n, 0, 0),
			new e.Vector3(0, n, 0),
			new e.Vector3(0, 0, n)
		].map((e) => this.projectLocalPosition(t.clone().add(e)));
		return Math.max(0, ...i.map((e) => Math.hypot(e.x - r.x, e.y - r.y)));
	}
	projectAnchors() {
		let e = this.viewer.state.currentStructure?.atomLabelAnchors || [], t = /* @__PURE__ */ new Map();
		for (let n of e) {
			let e = this.projectLocalPosition(n.position);
			t.set(n.atom.uniqueId, {
				...e,
				id: n.atom.uniqueId,
				localPosition: n.position,
				radius: Math.max(2, this.projectRadius(n.position, n.radius))
			});
		}
		return t;
	}
	projectBonds(e) {
		let t = [], n = (n, r, i, a) => {
			let o = e.get(n), s = e.get(r);
			if (!o || !s || o.z < -1 || o.z > 1 || s.z < -1 || s.z > 1) return;
			let c = o.localPosition.clone().add(s.localPosition).multiplyScalar(.5);
			t.push({
				x1: o.x,
				y1: o.y,
				x2: s.x,
				y2: s.y,
				radius: this.projectRadius(c, i) + this.options.bondPadding,
				type: a
			});
		};
		for (let e of this.displayStructure.bonds) n(e.atom1Id, e.atom2Id, this.viewer.options.bondRadius, "bond");
		for (let e of this.displayStructure.hBonds) n(e.hydrogenAtomId, e.acceptorAtomId, this.viewer.options.hbondRadius, "hbond");
		return t;
	}
	preferredDirection(e, t) {
		let n = t.get(e.uniqueId), r = [...this.bondNeighbours.get(e.uniqueId) || []].map((e) => t.get(e)).filter(Boolean), i = 0, a = 0;
		for (let e of r) {
			let t = e.x - n.x, r = e.y - n.y, o = Math.hypot(t, r) || 1;
			i -= t / o, a -= r / o;
		}
		let o = Math.hypot(i, a);
		if (o > .1) return {
			x: i / o,
			y: a / o
		};
		let s = 0;
		for (let t of e.uniqueId) s = s * 31 + t.charCodeAt(0) >>> 0;
		let c = s % 16 * Math.PI / 8;
		return {
			x: Math.cos(c),
			y: Math.sin(c)
		};
	}
	projectRings(e) {
		return this.rings.map((t) => t.map((t) => e.get(t))).filter((e) => e.every(Boolean) && Ui(e) >= 25);
	}
	update() {
		if (!this.context) return this.completeUpdate(this.layout);
		if (this.pendingLayout) return this.layoutQueued = !0, new Promise((e) => this.layoutWaiters.push(e));
		this.resize();
		let e = this.viewer.container.clientWidth, t = this.viewer.container.clientHeight;
		this.viewer.camera.updateMatrixWorld(), this.viewer.moleculeContainer.updateMatrixWorld(!0);
		let n = performance.now(), r = this.viewer.controls?.state.isDragging || this.viewer.controls?.state.isPanning, i = this.resolveRequests();
		if (r && (this.options.placementMode === "maximum-coverage" || i.length > this.options.interactionLabelLimit)) return this.endLoadingIndicator(), this.options.hideLabelsDuringDeferredLayout && (this.canvas.style.visibility = "hidden"), this.completeUpdate(this.layout);
		if (this.canvas.style.visibility = "visible", this.transformsUnchanged(e, t) || r && !this.forceNextLayout && n - this.lastLayoutTime < this.options.layoutThrottleMs) return this.completeUpdate(this.layout);
		this.lastLayoutTime = n;
		let a = window.devicePixelRatio || 1;
		if (this.context.setTransform(a, 0, 0, a, 0, 0), i.length === 0) return this.endLoadingIndicator(), this.layout = {
			placed: [],
			hidden: [],
			placementPolicy: "none"
		}, this.context.clearRect(0, 0, e, t), this.rememberTransforms(e, t), this.completeUpdate(this.layout);
		let o = this.projectAnchors(), s = i.filter((n) => {
			let r = o.get(n.atom.uniqueId);
			return r && Wi(r, {
				width: e,
				height: t
			});
		});
		if (s.length === 0) return this.endLoadingIndicator(), this.layout = {
			placed: [],
			hidden: [],
			placementPolicy: "none"
		}, this.context.clearRect(0, 0, e, t), this.rememberTransforms(e, t), this.completeUpdate(this.layout);
		this.beginLoadingIndicator(), this.prepareTopology();
		let c = `${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`;
		this.context.font = c, this.context.textAlign = "center", this.context.textBaseline = "middle";
		let l = {
			labels: s.map((e) => {
				let t = o.get(e.atom.uniqueId), n = `${c}\u0000${e.text}`, r = this.measurementCache.get(n);
				return r === void 0 && (r = this.context.measureText(e.text).width, this.measurementCache.set(n, r)), {
					id: e.atom.uniqueId,
					text: e.text,
					x: t.x,
					y: t.y,
					z: t.z,
					radius: t.radius,
					width: r,
					height: this.options.fontSize * 1.2,
					priority: e.priority,
					preferredDirection: this.preferredDirection(e.atom, o)
				};
			}),
			atoms: [...o.values()].filter((e) => e.z >= -1 && e.z <= 1).map((e) => ({
				id: e.id,
				x: e.x,
				y: e.y,
				radius: e.radius + this.options.atomPadding
			})),
			bonds: this.projectBonds(o),
			rings: this.projectRings(o).map((e) => e.map((e) => ({
				x: e.x,
				y: e.y
			}))),
			viewport: {
				width: e,
				height: t
			},
			options: zi(this.options),
			previousPlacements: [...this.previousPlacements.entries()]
		}, u = this.captureLayoutState(e, t), d = this.getWorker();
		if (!d) {
			let e = this.calculateLayout(l);
			return this.lastExecutionMode = this.workerUnavailable ? "main-thread-fallback" : "main-thread", this.applyLayout(e, u), this.completeUpdate(e);
		}
		let f = this.nextWorkerRequestId++;
		this.pendingLayout = {
			id: f,
			input: l,
			state: u
		};
		let p = new Promise((e) => this.layoutWaiters.push(e));
		return d.postMessage({
			id: f,
			...l
		}), p;
	}
	calculateLayout(e) {
		return Pi(e.labels, e.atoms, e.bonds, e.rings, e.viewport, e.options, new Map(e.previousPlacements));
	}
	handleWorkerMessage(e) {
		if (!this.pendingLayout || e.id !== this.pendingLayout.id) return;
		if (e.error) {
			this.handleWorkerFailure(Error(e.error));
			return;
		}
		let { state: t } = this.pendingLayout;
		this.pendingLayout = null;
		let n = this.layoutQueued || !this.layoutStateIsCurrent(t);
		if (this.layoutQueued = !1, n) {
			this.forceNextLayout = !0, this.scheduleUpdate();
			return;
		}
		this.applyLayout(e.layout, t), this.lastExecutionMode = "worker", this.resolveLayoutWaiters(e.layout);
	}
	handleWorkerFailure(e) {
		let t = this.pendingLayout;
		if (this.pendingLayout = null, this.layoutQueued = !1, this.worker?.terminate(), this.worker = null, this.workerUnavailable = !0, !t || this.disposed) {
			this.endLoadingIndicator(), this.resolveLayoutWaiters(this.layout);
			return;
		}
		if (console.warn("Atom-label worker failed; using main-thread layout.", e), this.layoutStateIsCurrent(t.state)) {
			let e = this.calculateLayout(t.input);
			this.lastExecutionMode = "main-thread-fallback", this.applyLayout(e, t.state), this.resolveLayoutWaiters(e);
		} else this.forceNextLayout = !0, this.scheduleUpdate();
	}
	resolveLayoutWaiters(e) {
		let t = this.layoutWaiters.splice(0);
		for (let n of t) n(e);
	}
	completeUpdate(e) {
		return this.resolveLayoutWaiters(e), Promise.resolve(e);
	}
	applyLayout(e, t) {
		this.endLoadingIndicator(), this.layout = e, this.previousPlacements = new Map(e.placed.map((e) => [e.id, e])), this.lastViewport = {
			width: t.width,
			height: t.height
		}, this.lastMoleculeMatrix = t.moleculeMatrix, this.lastCameraMatrix = t.cameraMatrix, this.lastProjectionMatrix = t.projectionMatrix, this.lastLayoutRevision = t.revision, this.forceNextLayout = !1;
		let n = window.devicePixelRatio || 1;
		this.context.setTransform(n, 0, 0, n, 0, 0), this.context.clearRect(0, 0, t.width, t.height), this.context.font = `${this.options.fontWeight} ${this.options.fontSize}px ${this.options.fontFamily}`, this.context.textAlign = "center", this.context.textBaseline = "middle", this.canvas.style.visibility = "visible", this.draw();
	}
	draw() {
		let e = this.context;
		e.lineJoin = "round", e.lineCap = "round";
		for (let t of this.layout.placed) t.leaderLine && this.options.leaderLines !== "none" && (e.strokeStyle = this.options.leaderColor, e.lineWidth = this.options.leaderWidth, e.beginPath(), e.moveTo(t.leaderSegment.x1, t.leaderSegment.y1), e.lineTo(t.leaderSegment.x2, t.leaderSegment.y2), e.stroke()), this.options.haloWidth > 0 && (e.strokeStyle = this.options.haloColor, e.lineWidth = this.options.haloWidth * 2, e.strokeText(t.text, t.x, t.y)), e.fillStyle = this.options.color, e.fillText(t.text, t.x, t.y);
	}
	dispose() {
		this.disposed = !0, this.endLoadingIndicator(), this.scheduledFrame !== null && (cancelAnimationFrame(this.scheduledFrame), this.scheduledFrame = null), this.worker?.terminate(), this.worker = null, this.pendingLayout = null, this.resolveLayoutWaiters(this.layout), this.canvas.remove(), this.loadingIndicator.remove(), this.changedContainerPosition && (this.viewer.container.style.position = this.previousContainerPosition), this.previousPlacements.clear(), this.measurementCache.clear(), this.viewer = null;
	}
}, qi = class extends a {
	constructor(e, a, c = !1, l = !1, u = 1e4) {
		let d = new n();
		super(d, a), this.isMarchingCubes = !0;
		let f = this, p = /* @__PURE__ */ new Float32Array(36), m = /* @__PURE__ */ new Float32Array(36), h = /* @__PURE__ */ new Float32Array(36);
		this.enableUvs = c, this.enableColors = l, this.init = function(e) {
			this.resolution = e, this.isolation = 80, this.size = e, this.size2 = this.size * this.size, this.size3 = this.size2 * this.size, this.halfsize = this.size / 2, this.delta = 2 / this.size, this.yd = this.size, this.zd = this.size2, this.field = new Float32Array(this.size3), this.normal_cache = new Float32Array(this.size3 * 3), this.palette = new Float32Array(this.size3 * 3), this.count = 0;
			let n = u * 3;
			this.positionArray = new Float32Array(n * 3);
			let r = new t(this.positionArray, 3);
			r.setUsage(i), d.setAttribute("position", r), this.normalArray = new Float32Array(n * 3);
			let a = new t(this.normalArray, 3);
			if (a.setUsage(i), d.setAttribute("normal", a), this.enableUvs) {
				this.uvArray = new Float32Array(n * 2);
				let e = new t(this.uvArray, 2);
				e.setUsage(i), d.setAttribute("uv", e);
			}
			if (this.enableColors) {
				this.colorArray = new Float32Array(n * 3);
				let e = new t(this.colorArray, 3);
				e.setUsage(i), d.setAttribute("color", e);
			}
			d.boundingSphere = new o(new s(), 1);
		};
		function g(e, t, n) {
			return e + (t - e) * n;
		}
		function _(e, t, n, r, i, a, o, s, c, l) {
			let u = (n - o) / (s - o), d = f.normal_cache;
			p[t + 0] = r + u * f.delta, p[t + 1] = i, p[t + 2] = a, m[t + 0] = g(d[e + 0], d[e + 3], u), m[t + 1] = g(d[e + 1], d[e + 4], u), m[t + 2] = g(d[e + 2], d[e + 5], u), h[t + 0] = g(f.palette[c * 3 + 0], f.palette[l * 3 + 0], u), h[t + 1] = g(f.palette[c * 3 + 1], f.palette[l * 3 + 1], u), h[t + 2] = g(f.palette[c * 3 + 2], f.palette[l * 3 + 2], u);
		}
		function v(e, t, n, r, i, a, o, s, c, l) {
			let u = (n - o) / (s - o), d = f.normal_cache;
			p[t + 0] = r, p[t + 1] = i + u * f.delta, p[t + 2] = a;
			let _ = e + f.yd * 3;
			m[t + 0] = g(d[e + 0], d[_ + 0], u), m[t + 1] = g(d[e + 1], d[_ + 1], u), m[t + 2] = g(d[e + 2], d[_ + 2], u), h[t + 0] = g(f.palette[c * 3 + 0], f.palette[l * 3 + 0], u), h[t + 1] = g(f.palette[c * 3 + 1], f.palette[l * 3 + 1], u), h[t + 2] = g(f.palette[c * 3 + 2], f.palette[l * 3 + 2], u);
		}
		function y(e, t, n, r, i, a, o, s, c, l) {
			let u = (n - o) / (s - o), d = f.normal_cache;
			p[t + 0] = r, p[t + 1] = i, p[t + 2] = a + u * f.delta;
			let _ = e + f.zd * 3;
			m[t + 0] = g(d[e + 0], d[_ + 0], u), m[t + 1] = g(d[e + 1], d[_ + 1], u), m[t + 2] = g(d[e + 2], d[_ + 2], u), h[t + 0] = g(f.palette[c * 3 + 0], f.palette[l * 3 + 0], u), h[t + 1] = g(f.palette[c * 3 + 1], f.palette[l * 3 + 1], u), h[t + 2] = g(f.palette[c * 3 + 2], f.palette[l * 3 + 2], u);
		}
		function b(e) {
			let t = e * 3;
			f.normal_cache[t] === 0 && (f.normal_cache[t + 0] = f.field[e - 1] - f.field[e + 1], f.normal_cache[t + 1] = f.field[e - f.yd] - f.field[e + f.yd], f.normal_cache[t + 2] = f.field[e - f.zd] - f.field[e + f.zd]);
		}
		function x(e, t, n, r, i) {
			let a = r + 1, o = r + f.yd, s = r + f.zd, c = a + f.yd, l = a + f.zd, u = r + f.yd + f.zd, d = a + f.yd + f.zd, g = 0, x = f.field[r], C = f.field[a], w = f.field[o], T = f.field[c], E = f.field[s], D = f.field[l], O = f.field[u], k = f.field[d];
			x < i && (g |= 1), C < i && (g |= 2), w < i && (g |= 8), T < i && (g |= 4), E < i && (g |= 16), D < i && (g |= 32), O < i && (g |= 128), k < i && (g |= 64);
			let A = Ji[g];
			if (A === 0) return 0;
			let ee = f.delta, j = e + ee, te = t + ee, M = n + ee;
			A & 1 && (b(r), b(a), _(r * 3, 0, i, e, t, n, x, C, r, a)), A & 2 && (b(a), b(c), v(a * 3, 3, i, j, t, n, C, T, a, c)), A & 4 && (b(o), b(c), _(o * 3, 6, i, e, te, n, w, T, o, c)), A & 8 && (b(r), b(o), v(r * 3, 9, i, e, t, n, x, w, r, o)), A & 16 && (b(s), b(l), _(s * 3, 12, i, e, t, M, E, D, s, l)), A & 32 && (b(l), b(d), v(l * 3, 15, i, j, t, M, D, k, l, d)), A & 64 && (b(u), b(d), _(u * 3, 18, i, e, te, M, O, k, u, d)), A & 128 && (b(s), b(u), v(s * 3, 21, i, e, t, M, E, O, s, u)), A & 256 && (b(r), b(s), y(r * 3, 24, i, e, t, n, x, E, r, s)), A & 512 && (b(a), b(l), y(a * 3, 27, i, j, t, n, C, D, a, l)), A & 1024 && (b(c), b(d), y(c * 3, 30, i, j, te, n, T, k, c, d)), A & 2048 && (b(o), b(u), y(o * 3, 33, i, e, te, n, w, O, o, u)), g <<= 4;
			let N, P, ne, F = 0, I = 0;
			for (; Yi[g + I] != -1;) N = g + I, P = N + 1, ne = N + 2, S(p, m, h, 3 * Yi[N], 3 * Yi[P], 3 * Yi[ne]), I += 3, F++;
			return F;
		}
		function S(e, t, n, r, i, a) {
			let o = f.count * 3;
			if (f.positionArray[o + 0] = e[r], f.positionArray[o + 1] = e[r + 1], f.positionArray[o + 2] = e[r + 2], f.positionArray[o + 3] = e[i], f.positionArray[o + 4] = e[i + 1], f.positionArray[o + 5] = e[i + 2], f.positionArray[o + 6] = e[a], f.positionArray[o + 7] = e[a + 1], f.positionArray[o + 8] = e[a + 2], f.material.flatShading === !0) {
				let e = (t[r + 0] + t[i + 0] + t[a + 0]) / 3, n = (t[r + 1] + t[i + 1] + t[a + 1]) / 3, s = (t[r + 2] + t[i + 2] + t[a + 2]) / 3;
				f.normalArray[o + 0] = e, f.normalArray[o + 1] = n, f.normalArray[o + 2] = s, f.normalArray[o + 3] = e, f.normalArray[o + 4] = n, f.normalArray[o + 5] = s, f.normalArray[o + 6] = e, f.normalArray[o + 7] = n, f.normalArray[o + 8] = s;
			} else f.normalArray[o + 0] = t[r + 0], f.normalArray[o + 1] = t[r + 1], f.normalArray[o + 2] = t[r + 2], f.normalArray[o + 3] = t[i + 0], f.normalArray[o + 4] = t[i + 1], f.normalArray[o + 5] = t[i + 2], f.normalArray[o + 6] = t[a + 0], f.normalArray[o + 7] = t[a + 1], f.normalArray[o + 8] = t[a + 2];
			if (f.enableUvs) {
				let t = f.count * 2;
				f.uvArray[t + 0] = e[r + 0], f.uvArray[t + 1] = e[r + 2], f.uvArray[t + 2] = e[i + 0], f.uvArray[t + 3] = e[i + 2], f.uvArray[t + 4] = e[a + 0], f.uvArray[t + 5] = e[a + 2];
			}
			f.enableColors && (f.colorArray[o + 0] = n[r + 0], f.colorArray[o + 1] = n[r + 1], f.colorArray[o + 2] = n[r + 2], f.colorArray[o + 3] = n[i + 0], f.colorArray[o + 4] = n[i + 1], f.colorArray[o + 5] = n[i + 2], f.colorArray[o + 6] = n[a + 0], f.colorArray[o + 7] = n[a + 1], f.colorArray[o + 8] = n[a + 2]), f.count += 3;
		}
		this.addBall = function(e, t, n, i, a, o) {
			let s = Math.sign(i);
			i = Math.abs(i);
			let c = o != null, l = new r(e, t, n);
			if (c) try {
				l = o instanceof r ? o : Array.isArray(o) ? new r(Math.min(Math.abs(o[0]), 1), Math.min(Math.abs(o[1]), 1), Math.min(Math.abs(o[2]), 1)) : new r(o);
			} catch {
				l = new r(e, t, n);
			}
			let u = this.size * Math.sqrt(i / a), d = n * this.size, f = t * this.size, p = e * this.size, m = Math.floor(d - u);
			m < 1 && (m = 1);
			let h = Math.floor(d + u);
			h > this.size - 1 && (h = this.size - 1);
			let g = Math.floor(f - u);
			g < 1 && (g = 1);
			let _ = Math.floor(f + u);
			_ > this.size - 1 && (_ = this.size - 1);
			let v = Math.floor(p - u);
			v < 1 && (v = 1);
			let y = Math.floor(p + u);
			y > this.size - 1 && (y = this.size - 1);
			let b, x, S, C, w, T, E, D, O, k, A;
			for (S = m; S < h; S++) for (w = this.size2 * S, D = S / this.size - n, O = D * D, x = g; x < _; x++) for (C = w + this.size * x, E = x / this.size - t, k = E * E, b = v; b < y; b++) if (T = b / this.size - e, A = i / (1e-6 + T * T + k + O) - a, A > 0) {
				this.field[C + b] += A * s;
				let e = Math.sqrt((b - p) * (b - p) + (x - f) * (x - f) + (S - d) * (S - d)) / u, t = 1 - e * e * e * (e * (e * 6 - 15) + 10);
				this.palette[(C + b) * 3 + 0] += l.r * t, this.palette[(C + b) * 3 + 1] += l.g * t, this.palette[(C + b) * 3 + 2] += l.b * t;
			}
		}, this.addPlaneX = function(e, t) {
			let n = this.size, r = this.yd, i = this.zd, a = this.field, o, s, c, l, u, d, f, p = n * Math.sqrt(e / t);
			for (p > n && (p = n), o = 0; o < p; o++) if (d = o / n, l = d * d, u = e / (1e-4 + l) - t, u > 0) for (s = 0; s < n; s++) for (f = o + s * r, c = 0; c < n; c++) a[i * c + f] += u;
		}, this.addPlaneY = function(e, t) {
			let n = this.size, r = this.yd, i = this.zd, a = this.field, o, s, c, l, u, d, f, p, m = n * Math.sqrt(e / t);
			for (m > n && (m = n), s = 0; s < m; s++) if (d = s / n, l = d * d, u = e / (1e-4 + l) - t, u > 0) for (f = s * r, o = 0; o < n; o++) for (p = f + o, c = 0; c < n; c++) a[i * c + p] += u;
		}, this.addPlaneZ = function(e, t) {
			let n = this.size, r = this.yd, i = this.zd, a = this.field, o, s, c, l, u, d, f, p, m = n * Math.sqrt(e / t);
			for (m > n && (m = n), c = 0; c < m; c++) if (d = c / n, l = d * d, u = e / (1e-4 + l) - t, u > 0) for (f = i * c, s = 0; s < n; s++) for (p = f + s * r, o = 0; o < n; o++) a[p + o] += u;
		}, this.setCell = function(e, t, n, r) {
			let i = this.size2 * n + this.size * t + e;
			this.field[i] = r;
		}, this.getCell = function(e, t, n) {
			let r = this.size2 * n + this.size * t + e;
			return this.field[r];
		}, this.blur = function(e = 1) {
			let t = this.field, n = t.slice(), r = this.size, i = this.size2;
			for (let a = 0; a < r; a++) for (let o = 0; o < r; o++) for (let s = 0; s < r; s++) {
				let c = i * s + r * o + a, l = n[c], u = 1;
				for (let t = -1; t <= 1; t += 2) {
					let c = t + a;
					if (!(c < 0 || c >= r)) for (let t = -1; t <= 1; t += 2) {
						let a = t + o;
						if (!(a < 0 || a >= r)) for (let t = -1; t <= 1; t += 2) {
							let o = t + s;
							if (o < 0 || o >= r) continue;
							let d = n[i * o + r * a + c];
							u++, l += e * (d - l) / u;
						}
					}
				}
				t[c] = l;
			}
		}, this.reset = function() {
			for (let e = 0; e < this.size3; e++) this.normal_cache[e * 3] = 0, this.field[e] = 0, this.palette[e * 3] = this.palette[e * 3 + 1] = this.palette[e * 3 + 2] = 0;
		}, this.update = function() {
			this.count = 0;
			let e = this.size - 2;
			for (let t = 1; t < e; t++) {
				let n = this.size2 * t, r = (t - this.halfsize) / this.halfsize;
				for (let t = 1; t < e; t++) {
					let i = n + this.size * t, a = (t - this.halfsize) / this.halfsize;
					for (let t = 1; t < e; t++) x((t - this.halfsize) / this.halfsize, a, r, i + t, this.isolation);
				}
			}
			this.geometry.setDrawRange(0, this.count), d.getAttribute("position").needsUpdate = !0, d.getAttribute("normal").needsUpdate = !0, this.enableUvs && (d.getAttribute("uv").needsUpdate = !0), this.enableColors && (d.getAttribute("color").needsUpdate = !0), this.count / 3 > u && console.warn("THREE.MarchingCubes: Geometry buffers too small for rendering. Please create an instance with a higher poly count.");
		}, this.init(e);
	}
}, Ji = new Int32Array([
	0,
	265,
	515,
	778,
	1030,
	1295,
	1541,
	1804,
	2060,
	2309,
	2575,
	2822,
	3082,
	3331,
	3593,
	3840,
	400,
	153,
	915,
	666,
	1430,
	1183,
	1941,
	1692,
	2460,
	2197,
	2975,
	2710,
	3482,
	3219,
	3993,
	3728,
	560,
	825,
	51,
	314,
	1590,
	1855,
	1077,
	1340,
	2620,
	2869,
	2111,
	2358,
	3642,
	3891,
	3129,
	3376,
	928,
	681,
	419,
	170,
	1958,
	1711,
	1445,
	1196,
	2988,
	2725,
	2479,
	2214,
	4010,
	3747,
	3497,
	3232,
	1120,
	1385,
	1635,
	1898,
	102,
	367,
	613,
	876,
	3180,
	3429,
	3695,
	3942,
	2154,
	2403,
	2665,
	2912,
	1520,
	1273,
	2035,
	1786,
	502,
	255,
	1013,
	764,
	3580,
	3317,
	4095,
	3830,
	2554,
	2291,
	3065,
	2800,
	1616,
	1881,
	1107,
	1370,
	598,
	863,
	85,
	348,
	3676,
	3925,
	3167,
	3414,
	2650,
	2899,
	2137,
	2384,
	1984,
	1737,
	1475,
	1226,
	966,
	719,
	453,
	204,
	4044,
	3781,
	3535,
	3270,
	3018,
	2755,
	2505,
	2240,
	2240,
	2505,
	2755,
	3018,
	3270,
	3535,
	3781,
	4044,
	204,
	453,
	719,
	966,
	1226,
	1475,
	1737,
	1984,
	2384,
	2137,
	2899,
	2650,
	3414,
	3167,
	3925,
	3676,
	348,
	85,
	863,
	598,
	1370,
	1107,
	1881,
	1616,
	2800,
	3065,
	2291,
	2554,
	3830,
	4095,
	3317,
	3580,
	764,
	1013,
	255,
	502,
	1786,
	2035,
	1273,
	1520,
	2912,
	2665,
	2403,
	2154,
	3942,
	3695,
	3429,
	3180,
	876,
	613,
	367,
	102,
	1898,
	1635,
	1385,
	1120,
	3232,
	3497,
	3747,
	4010,
	2214,
	2479,
	2725,
	2988,
	1196,
	1445,
	1711,
	1958,
	170,
	419,
	681,
	928,
	3376,
	3129,
	3891,
	3642,
	2358,
	2111,
	2869,
	2620,
	1340,
	1077,
	1855,
	1590,
	314,
	51,
	825,
	560,
	3728,
	3993,
	3219,
	3482,
	2710,
	2975,
	2197,
	2460,
	1692,
	1941,
	1183,
	1430,
	666,
	915,
	153,
	400,
	3840,
	3593,
	3331,
	3082,
	2822,
	2575,
	2309,
	2060,
	1804,
	1541,
	1295,
	1030,
	778,
	515,
	265,
	0
]), Yi = new Int32Array([
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	8,
	3,
	9,
	8,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	1,
	2,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	2,
	10,
	0,
	2,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	8,
	3,
	2,
	10,
	8,
	10,
	9,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	11,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	11,
	2,
	8,
	11,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	9,
	0,
	2,
	3,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	11,
	2,
	1,
	9,
	11,
	9,
	8,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	10,
	1,
	11,
	10,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	10,
	1,
	0,
	8,
	10,
	8,
	11,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	9,
	0,
	3,
	11,
	9,
	11,
	10,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	8,
	10,
	10,
	8,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	7,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	3,
	0,
	7,
	3,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	8,
	4,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	1,
	9,
	4,
	7,
	1,
	7,
	3,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	8,
	4,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	4,
	7,
	3,
	0,
	4,
	1,
	2,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	2,
	10,
	9,
	0,
	2,
	8,
	4,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	10,
	9,
	2,
	9,
	7,
	2,
	7,
	3,
	7,
	9,
	4,
	-1,
	-1,
	-1,
	-1,
	8,
	4,
	7,
	3,
	11,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	4,
	7,
	11,
	2,
	4,
	2,
	0,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	0,
	1,
	8,
	4,
	7,
	2,
	3,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	7,
	11,
	9,
	4,
	11,
	9,
	11,
	2,
	9,
	2,
	1,
	-1,
	-1,
	-1,
	-1,
	3,
	10,
	1,
	3,
	11,
	10,
	7,
	8,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	11,
	10,
	1,
	4,
	11,
	1,
	0,
	4,
	7,
	11,
	4,
	-1,
	-1,
	-1,
	-1,
	4,
	7,
	8,
	9,
	0,
	11,
	9,
	11,
	10,
	11,
	0,
	3,
	-1,
	-1,
	-1,
	-1,
	4,
	7,
	11,
	4,
	11,
	9,
	9,
	11,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	4,
	0,
	8,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	5,
	4,
	1,
	5,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	5,
	4,
	8,
	3,
	5,
	3,
	1,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	9,
	5,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	0,
	8,
	1,
	2,
	10,
	4,
	9,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	2,
	10,
	5,
	4,
	2,
	4,
	0,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	10,
	5,
	3,
	2,
	5,
	3,
	5,
	4,
	3,
	4,
	8,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	4,
	2,
	3,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	11,
	2,
	0,
	8,
	11,
	4,
	9,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	5,
	4,
	0,
	1,
	5,
	2,
	3,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	1,
	5,
	2,
	5,
	8,
	2,
	8,
	11,
	4,
	8,
	5,
	-1,
	-1,
	-1,
	-1,
	10,
	3,
	11,
	10,
	1,
	3,
	9,
	5,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	9,
	5,
	0,
	8,
	1,
	8,
	10,
	1,
	8,
	11,
	10,
	-1,
	-1,
	-1,
	-1,
	5,
	4,
	0,
	5,
	0,
	11,
	5,
	11,
	10,
	11,
	0,
	3,
	-1,
	-1,
	-1,
	-1,
	5,
	4,
	8,
	5,
	8,
	10,
	10,
	8,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	7,
	8,
	5,
	7,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	3,
	0,
	9,
	5,
	3,
	5,
	7,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	7,
	8,
	0,
	1,
	7,
	1,
	5,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	5,
	3,
	3,
	5,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	7,
	8,
	9,
	5,
	7,
	10,
	1,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	1,
	2,
	9,
	5,
	0,
	5,
	3,
	0,
	5,
	7,
	3,
	-1,
	-1,
	-1,
	-1,
	8,
	0,
	2,
	8,
	2,
	5,
	8,
	5,
	7,
	10,
	5,
	2,
	-1,
	-1,
	-1,
	-1,
	2,
	10,
	5,
	2,
	5,
	3,
	3,
	5,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	9,
	5,
	7,
	8,
	9,
	3,
	11,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	7,
	9,
	7,
	2,
	9,
	2,
	0,
	2,
	7,
	11,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	11,
	0,
	1,
	8,
	1,
	7,
	8,
	1,
	5,
	7,
	-1,
	-1,
	-1,
	-1,
	11,
	2,
	1,
	11,
	1,
	7,
	7,
	1,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	8,
	8,
	5,
	7,
	10,
	1,
	3,
	10,
	3,
	11,
	-1,
	-1,
	-1,
	-1,
	5,
	7,
	0,
	5,
	0,
	9,
	7,
	11,
	0,
	1,
	0,
	10,
	11,
	10,
	0,
	-1,
	11,
	10,
	0,
	11,
	0,
	3,
	10,
	5,
	0,
	8,
	0,
	7,
	5,
	7,
	0,
	-1,
	11,
	10,
	5,
	7,
	11,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	6,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	5,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	0,
	1,
	5,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	8,
	3,
	1,
	9,
	8,
	5,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	6,
	5,
	2,
	6,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	6,
	5,
	1,
	2,
	6,
	3,
	0,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	6,
	5,
	9,
	0,
	6,
	0,
	2,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	9,
	8,
	5,
	8,
	2,
	5,
	2,
	6,
	3,
	2,
	8,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	11,
	10,
	6,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	0,
	8,
	11,
	2,
	0,
	10,
	6,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	2,
	3,
	11,
	5,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	10,
	6,
	1,
	9,
	2,
	9,
	11,
	2,
	9,
	8,
	11,
	-1,
	-1,
	-1,
	-1,
	6,
	3,
	11,
	6,
	5,
	3,
	5,
	1,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	11,
	0,
	11,
	5,
	0,
	5,
	1,
	5,
	11,
	6,
	-1,
	-1,
	-1,
	-1,
	3,
	11,
	6,
	0,
	3,
	6,
	0,
	6,
	5,
	0,
	5,
	9,
	-1,
	-1,
	-1,
	-1,
	6,
	5,
	9,
	6,
	9,
	11,
	11,
	9,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	10,
	6,
	4,
	7,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	3,
	0,
	4,
	7,
	3,
	6,
	5,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	9,
	0,
	5,
	10,
	6,
	8,
	4,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	6,
	5,
	1,
	9,
	7,
	1,
	7,
	3,
	7,
	9,
	4,
	-1,
	-1,
	-1,
	-1,
	6,
	1,
	2,
	6,
	5,
	1,
	4,
	7,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	5,
	5,
	2,
	6,
	3,
	0,
	4,
	3,
	4,
	7,
	-1,
	-1,
	-1,
	-1,
	8,
	4,
	7,
	9,
	0,
	5,
	0,
	6,
	5,
	0,
	2,
	6,
	-1,
	-1,
	-1,
	-1,
	7,
	3,
	9,
	7,
	9,
	4,
	3,
	2,
	9,
	5,
	9,
	6,
	2,
	6,
	9,
	-1,
	3,
	11,
	2,
	7,
	8,
	4,
	10,
	6,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	10,
	6,
	4,
	7,
	2,
	4,
	2,
	0,
	2,
	7,
	11,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	4,
	7,
	8,
	2,
	3,
	11,
	5,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	9,
	2,
	1,
	9,
	11,
	2,
	9,
	4,
	11,
	7,
	11,
	4,
	5,
	10,
	6,
	-1,
	8,
	4,
	7,
	3,
	11,
	5,
	3,
	5,
	1,
	5,
	11,
	6,
	-1,
	-1,
	-1,
	-1,
	5,
	1,
	11,
	5,
	11,
	6,
	1,
	0,
	11,
	7,
	11,
	4,
	0,
	4,
	11,
	-1,
	0,
	5,
	9,
	0,
	6,
	5,
	0,
	3,
	6,
	11,
	6,
	3,
	8,
	4,
	7,
	-1,
	6,
	5,
	9,
	6,
	9,
	11,
	4,
	7,
	9,
	7,
	11,
	9,
	-1,
	-1,
	-1,
	-1,
	10,
	4,
	9,
	6,
	4,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	10,
	6,
	4,
	9,
	10,
	0,
	8,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	0,
	1,
	10,
	6,
	0,
	6,
	4,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	3,
	1,
	8,
	1,
	6,
	8,
	6,
	4,
	6,
	1,
	10,
	-1,
	-1,
	-1,
	-1,
	1,
	4,
	9,
	1,
	2,
	4,
	2,
	6,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	0,
	8,
	1,
	2,
	9,
	2,
	4,
	9,
	2,
	6,
	4,
	-1,
	-1,
	-1,
	-1,
	0,
	2,
	4,
	4,
	2,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	3,
	2,
	8,
	2,
	4,
	4,
	2,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	4,
	9,
	10,
	6,
	4,
	11,
	2,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	2,
	2,
	8,
	11,
	4,
	9,
	10,
	4,
	10,
	6,
	-1,
	-1,
	-1,
	-1,
	3,
	11,
	2,
	0,
	1,
	6,
	0,
	6,
	4,
	6,
	1,
	10,
	-1,
	-1,
	-1,
	-1,
	6,
	4,
	1,
	6,
	1,
	10,
	4,
	8,
	1,
	2,
	1,
	11,
	8,
	11,
	1,
	-1,
	9,
	6,
	4,
	9,
	3,
	6,
	9,
	1,
	3,
	11,
	6,
	3,
	-1,
	-1,
	-1,
	-1,
	8,
	11,
	1,
	8,
	1,
	0,
	11,
	6,
	1,
	9,
	1,
	4,
	6,
	4,
	1,
	-1,
	3,
	11,
	6,
	3,
	6,
	0,
	0,
	6,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	6,
	4,
	8,
	11,
	6,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	10,
	6,
	7,
	8,
	10,
	8,
	9,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	7,
	3,
	0,
	10,
	7,
	0,
	9,
	10,
	6,
	7,
	10,
	-1,
	-1,
	-1,
	-1,
	10,
	6,
	7,
	1,
	10,
	7,
	1,
	7,
	8,
	1,
	8,
	0,
	-1,
	-1,
	-1,
	-1,
	10,
	6,
	7,
	10,
	7,
	1,
	1,
	7,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	6,
	1,
	6,
	8,
	1,
	8,
	9,
	8,
	6,
	7,
	-1,
	-1,
	-1,
	-1,
	2,
	6,
	9,
	2,
	9,
	1,
	6,
	7,
	9,
	0,
	9,
	3,
	7,
	3,
	9,
	-1,
	7,
	8,
	0,
	7,
	0,
	6,
	6,
	0,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	3,
	2,
	6,
	7,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	11,
	10,
	6,
	8,
	10,
	8,
	9,
	8,
	6,
	7,
	-1,
	-1,
	-1,
	-1,
	2,
	0,
	7,
	2,
	7,
	11,
	0,
	9,
	7,
	6,
	7,
	10,
	9,
	10,
	7,
	-1,
	1,
	8,
	0,
	1,
	7,
	8,
	1,
	10,
	7,
	6,
	7,
	10,
	2,
	3,
	11,
	-1,
	11,
	2,
	1,
	11,
	1,
	7,
	10,
	6,
	1,
	6,
	7,
	1,
	-1,
	-1,
	-1,
	-1,
	8,
	9,
	6,
	8,
	6,
	7,
	9,
	1,
	6,
	11,
	6,
	3,
	1,
	3,
	6,
	-1,
	0,
	9,
	1,
	11,
	6,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	8,
	0,
	7,
	0,
	6,
	3,
	11,
	0,
	11,
	6,
	0,
	-1,
	-1,
	-1,
	-1,
	7,
	11,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	6,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	0,
	8,
	11,
	7,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	11,
	7,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	1,
	9,
	8,
	3,
	1,
	11,
	7,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	1,
	2,
	6,
	11,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	3,
	0,
	8,
	6,
	11,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	9,
	0,
	2,
	10,
	9,
	6,
	11,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	6,
	11,
	7,
	2,
	10,
	3,
	10,
	8,
	3,
	10,
	9,
	8,
	-1,
	-1,
	-1,
	-1,
	7,
	2,
	3,
	6,
	2,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	7,
	0,
	8,
	7,
	6,
	0,
	6,
	2,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	7,
	6,
	2,
	3,
	7,
	0,
	1,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	6,
	2,
	1,
	8,
	6,
	1,
	9,
	8,
	8,
	7,
	6,
	-1,
	-1,
	-1,
	-1,
	10,
	7,
	6,
	10,
	1,
	7,
	1,
	3,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	7,
	6,
	1,
	7,
	10,
	1,
	8,
	7,
	1,
	0,
	8,
	-1,
	-1,
	-1,
	-1,
	0,
	3,
	7,
	0,
	7,
	10,
	0,
	10,
	9,
	6,
	10,
	7,
	-1,
	-1,
	-1,
	-1,
	7,
	6,
	10,
	7,
	10,
	8,
	8,
	10,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	6,
	8,
	4,
	11,
	8,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	6,
	11,
	3,
	0,
	6,
	0,
	4,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	6,
	11,
	8,
	4,
	6,
	9,
	0,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	4,
	6,
	9,
	6,
	3,
	9,
	3,
	1,
	11,
	3,
	6,
	-1,
	-1,
	-1,
	-1,
	6,
	8,
	4,
	6,
	11,
	8,
	2,
	10,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	3,
	0,
	11,
	0,
	6,
	11,
	0,
	4,
	6,
	-1,
	-1,
	-1,
	-1,
	4,
	11,
	8,
	4,
	6,
	11,
	0,
	2,
	9,
	2,
	10,
	9,
	-1,
	-1,
	-1,
	-1,
	10,
	9,
	3,
	10,
	3,
	2,
	9,
	4,
	3,
	11,
	3,
	6,
	4,
	6,
	3,
	-1,
	8,
	2,
	3,
	8,
	4,
	2,
	4,
	6,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	4,
	2,
	4,
	6,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	9,
	0,
	2,
	3,
	4,
	2,
	4,
	6,
	4,
	3,
	8,
	-1,
	-1,
	-1,
	-1,
	1,
	9,
	4,
	1,
	4,
	2,
	2,
	4,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	1,
	3,
	8,
	6,
	1,
	8,
	4,
	6,
	6,
	10,
	1,
	-1,
	-1,
	-1,
	-1,
	10,
	1,
	0,
	10,
	0,
	6,
	6,
	0,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	6,
	3,
	4,
	3,
	8,
	6,
	10,
	3,
	0,
	3,
	9,
	10,
	9,
	3,
	-1,
	10,
	9,
	4,
	6,
	10,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	9,
	5,
	7,
	6,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	4,
	9,
	5,
	11,
	7,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	0,
	1,
	5,
	4,
	0,
	7,
	6,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	7,
	6,
	8,
	3,
	4,
	3,
	5,
	4,
	3,
	1,
	5,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	4,
	10,
	1,
	2,
	7,
	6,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	6,
	11,
	7,
	1,
	2,
	10,
	0,
	8,
	3,
	4,
	9,
	5,
	-1,
	-1,
	-1,
	-1,
	7,
	6,
	11,
	5,
	4,
	10,
	4,
	2,
	10,
	4,
	0,
	2,
	-1,
	-1,
	-1,
	-1,
	3,
	4,
	8,
	3,
	5,
	4,
	3,
	2,
	5,
	10,
	5,
	2,
	11,
	7,
	6,
	-1,
	7,
	2,
	3,
	7,
	6,
	2,
	5,
	4,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	4,
	0,
	8,
	6,
	0,
	6,
	2,
	6,
	8,
	7,
	-1,
	-1,
	-1,
	-1,
	3,
	6,
	2,
	3,
	7,
	6,
	1,
	5,
	0,
	5,
	4,
	0,
	-1,
	-1,
	-1,
	-1,
	6,
	2,
	8,
	6,
	8,
	7,
	2,
	1,
	8,
	4,
	8,
	5,
	1,
	5,
	8,
	-1,
	9,
	5,
	4,
	10,
	1,
	6,
	1,
	7,
	6,
	1,
	3,
	7,
	-1,
	-1,
	-1,
	-1,
	1,
	6,
	10,
	1,
	7,
	6,
	1,
	0,
	7,
	8,
	7,
	0,
	9,
	5,
	4,
	-1,
	4,
	0,
	10,
	4,
	10,
	5,
	0,
	3,
	10,
	6,
	10,
	7,
	3,
	7,
	10,
	-1,
	7,
	6,
	10,
	7,
	10,
	8,
	5,
	4,
	10,
	4,
	8,
	10,
	-1,
	-1,
	-1,
	-1,
	6,
	9,
	5,
	6,
	11,
	9,
	11,
	8,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	6,
	11,
	0,
	6,
	3,
	0,
	5,
	6,
	0,
	9,
	5,
	-1,
	-1,
	-1,
	-1,
	0,
	11,
	8,
	0,
	5,
	11,
	0,
	1,
	5,
	5,
	6,
	11,
	-1,
	-1,
	-1,
	-1,
	6,
	11,
	3,
	6,
	3,
	5,
	5,
	3,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	10,
	9,
	5,
	11,
	9,
	11,
	8,
	11,
	5,
	6,
	-1,
	-1,
	-1,
	-1,
	0,
	11,
	3,
	0,
	6,
	11,
	0,
	9,
	6,
	5,
	6,
	9,
	1,
	2,
	10,
	-1,
	11,
	8,
	5,
	11,
	5,
	6,
	8,
	0,
	5,
	10,
	5,
	2,
	0,
	2,
	5,
	-1,
	6,
	11,
	3,
	6,
	3,
	5,
	2,
	10,
	3,
	10,
	5,
	3,
	-1,
	-1,
	-1,
	-1,
	5,
	8,
	9,
	5,
	2,
	8,
	5,
	6,
	2,
	3,
	8,
	2,
	-1,
	-1,
	-1,
	-1,
	9,
	5,
	6,
	9,
	6,
	0,
	0,
	6,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	5,
	8,
	1,
	8,
	0,
	5,
	6,
	8,
	3,
	8,
	2,
	6,
	2,
	8,
	-1,
	1,
	5,
	6,
	2,
	1,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	3,
	6,
	1,
	6,
	10,
	3,
	8,
	6,
	5,
	6,
	9,
	8,
	9,
	6,
	-1,
	10,
	1,
	0,
	10,
	0,
	6,
	9,
	5,
	0,
	5,
	6,
	0,
	-1,
	-1,
	-1,
	-1,
	0,
	3,
	8,
	5,
	6,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	5,
	6,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	5,
	10,
	7,
	5,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	5,
	10,
	11,
	7,
	5,
	8,
	3,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	11,
	7,
	5,
	10,
	11,
	1,
	9,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	10,
	7,
	5,
	10,
	11,
	7,
	9,
	8,
	1,
	8,
	3,
	1,
	-1,
	-1,
	-1,
	-1,
	11,
	1,
	2,
	11,
	7,
	1,
	7,
	5,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	1,
	2,
	7,
	1,
	7,
	5,
	7,
	2,
	11,
	-1,
	-1,
	-1,
	-1,
	9,
	7,
	5,
	9,
	2,
	7,
	9,
	0,
	2,
	2,
	11,
	7,
	-1,
	-1,
	-1,
	-1,
	7,
	5,
	2,
	7,
	2,
	11,
	5,
	9,
	2,
	3,
	2,
	8,
	9,
	8,
	2,
	-1,
	2,
	5,
	10,
	2,
	3,
	5,
	3,
	7,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	2,
	0,
	8,
	5,
	2,
	8,
	7,
	5,
	10,
	2,
	5,
	-1,
	-1,
	-1,
	-1,
	9,
	0,
	1,
	5,
	10,
	3,
	5,
	3,
	7,
	3,
	10,
	2,
	-1,
	-1,
	-1,
	-1,
	9,
	8,
	2,
	9,
	2,
	1,
	8,
	7,
	2,
	10,
	2,
	5,
	7,
	5,
	2,
	-1,
	1,
	3,
	5,
	3,
	7,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	7,
	0,
	7,
	1,
	1,
	7,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	0,
	3,
	9,
	3,
	5,
	5,
	3,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	8,
	7,
	5,
	9,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	8,
	4,
	5,
	10,
	8,
	10,
	11,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	5,
	0,
	4,
	5,
	11,
	0,
	5,
	10,
	11,
	11,
	3,
	0,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	9,
	8,
	4,
	10,
	8,
	10,
	11,
	10,
	4,
	5,
	-1,
	-1,
	-1,
	-1,
	10,
	11,
	4,
	10,
	4,
	5,
	11,
	3,
	4,
	9,
	4,
	1,
	3,
	1,
	4,
	-1,
	2,
	5,
	1,
	2,
	8,
	5,
	2,
	11,
	8,
	4,
	5,
	8,
	-1,
	-1,
	-1,
	-1,
	0,
	4,
	11,
	0,
	11,
	3,
	4,
	5,
	11,
	2,
	11,
	1,
	5,
	1,
	11,
	-1,
	0,
	2,
	5,
	0,
	5,
	9,
	2,
	11,
	5,
	4,
	5,
	8,
	11,
	8,
	5,
	-1,
	9,
	4,
	5,
	2,
	11,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	5,
	10,
	3,
	5,
	2,
	3,
	4,
	5,
	3,
	8,
	4,
	-1,
	-1,
	-1,
	-1,
	5,
	10,
	2,
	5,
	2,
	4,
	4,
	2,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	10,
	2,
	3,
	5,
	10,
	3,
	8,
	5,
	4,
	5,
	8,
	0,
	1,
	9,
	-1,
	5,
	10,
	2,
	5,
	2,
	4,
	1,
	9,
	2,
	9,
	4,
	2,
	-1,
	-1,
	-1,
	-1,
	8,
	4,
	5,
	8,
	5,
	3,
	3,
	5,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	4,
	5,
	1,
	0,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	8,
	4,
	5,
	8,
	5,
	3,
	9,
	0,
	5,
	0,
	3,
	5,
	-1,
	-1,
	-1,
	-1,
	9,
	4,
	5,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	11,
	7,
	4,
	9,
	11,
	9,
	10,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	8,
	3,
	4,
	9,
	7,
	9,
	11,
	7,
	9,
	10,
	11,
	-1,
	-1,
	-1,
	-1,
	1,
	10,
	11,
	1,
	11,
	4,
	1,
	4,
	0,
	7,
	4,
	11,
	-1,
	-1,
	-1,
	-1,
	3,
	1,
	4,
	3,
	4,
	8,
	1,
	10,
	4,
	7,
	4,
	11,
	10,
	11,
	4,
	-1,
	4,
	11,
	7,
	9,
	11,
	4,
	9,
	2,
	11,
	9,
	1,
	2,
	-1,
	-1,
	-1,
	-1,
	9,
	7,
	4,
	9,
	11,
	7,
	9,
	1,
	11,
	2,
	11,
	1,
	0,
	8,
	3,
	-1,
	11,
	7,
	4,
	11,
	4,
	2,
	2,
	4,
	0,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	11,
	7,
	4,
	11,
	4,
	2,
	8,
	3,
	4,
	3,
	2,
	4,
	-1,
	-1,
	-1,
	-1,
	2,
	9,
	10,
	2,
	7,
	9,
	2,
	3,
	7,
	7,
	4,
	9,
	-1,
	-1,
	-1,
	-1,
	9,
	10,
	7,
	9,
	7,
	4,
	10,
	2,
	7,
	8,
	7,
	0,
	2,
	0,
	7,
	-1,
	3,
	7,
	10,
	3,
	10,
	2,
	7,
	4,
	10,
	1,
	10,
	0,
	4,
	0,
	10,
	-1,
	1,
	10,
	2,
	8,
	7,
	4,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	9,
	1,
	4,
	1,
	7,
	7,
	1,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	9,
	1,
	4,
	1,
	7,
	0,
	8,
	1,
	8,
	7,
	1,
	-1,
	-1,
	-1,
	-1,
	4,
	0,
	3,
	7,
	4,
	3,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	4,
	8,
	7,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	10,
	8,
	10,
	11,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	0,
	9,
	3,
	9,
	11,
	11,
	9,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	10,
	0,
	10,
	8,
	8,
	10,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	1,
	10,
	11,
	3,
	10,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	2,
	11,
	1,
	11,
	9,
	9,
	11,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	0,
	9,
	3,
	9,
	11,
	1,
	2,
	9,
	2,
	11,
	9,
	-1,
	-1,
	-1,
	-1,
	0,
	2,
	11,
	8,
	0,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	3,
	2,
	11,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	8,
	2,
	8,
	10,
	10,
	8,
	9,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	9,
	10,
	2,
	0,
	9,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	8,
	2,
	8,
	10,
	0,
	1,
	8,
	1,
	10,
	8,
	-1,
	-1,
	-1,
	-1,
	1,
	10,
	2,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	3,
	8,
	9,
	1,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	9,
	1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	3,
	8,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1
]);
//#endregion
//#region src/lib/density/difference-density-surface.js
function Xi(e, t, n, r) {
	return [
		e[0][0] * t + e[0][1] * n + e[0][2] * r,
		e[1][0] * t + e[1][1] * n + e[1][2] * r,
		e[2][0] * t + e[2][1] * n + e[2][2] * r
	];
}
function Zi(e, t) {
	if (!e?.atoms?.length) return {
		minimum: [
			0,
			0,
			0
		],
		maximum: [
			1,
			1,
			1
		]
	};
	let n = R(e.cell.fractToCartMatrix).toArray().map((e) => t * Math.sqrt(e[0] ** 2 + e[1] ** 2 + e[2] ** 2)), r = [
		Infinity,
		Infinity,
		Infinity
	], i = [
		-Infinity,
		-Infinity,
		-Infinity
	];
	for (let t of e.atoms) {
		let e = [
			t.position.x,
			t.position.y,
			t.position.z
		];
		for (let t = 0; t < 3; t++) r[t] = Math.min(r[t], e[t] - n[t]), i[t] = Math.max(i[t], e[t] + n[t]);
	}
	return {
		minimum: r,
		maximum: i
	};
}
function Qi(e, t = {}) {
	let n = {
		...Ke,
		...t
	}, r = Math.max(8, Math.round(Number(n.resolution))), i = Math.max(r, Math.round(Number(n.maxResolution))), a = Number(n.gridSpacing);
	if (!(Number.isFinite(a) && a > 0)) throw Error("Difference-density surface grid spacing must be a positive number");
	if (!(Number.isFinite(i) && i >= 8)) throw Error("Difference-density maximum surface resolution must be at least 8");
	let o = Zi(e, n.radius), s = e.cell.fractToCartMatrix.toArray(), c = o.maximum.map((e, t) => (e - o.minimum[t]) * Math.hypot(s[0][t], s[1][t], s[2][t])), l = Math.ceil(Math.max(...c) / a) + 1;
	return Math.min(i, Math.max(r, l));
}
function $i(t, n) {
	let r = t.fractToCartMatrix.toArray(), i = n.maximum.map((e, t) => e - n.minimum[t]), a = Xi(r, ...n.minimum.map((e, t) => e + i[t] / 2));
	return new e.Matrix4().set(r[0][0] * i[0] / 2, r[0][1] * i[1] / 2, r[0][2] * i[2] / 2, a[0], r[1][0] * i[0] / 2, r[1][1] * i[1] / 2, r[1][2] * i[2] / 2, a[1], r[2][0] * i[0] / 2, r[2][1] * i[1] / 2, r[2][2] * i[2] / 2, a[2], 0, 0, 0, 1);
}
function ea(e, t, n) {
	for (let r of t) {
		let t = e[0] - r[0], i = e[1] - r[1], a = e[2] - r[2];
		if (t * t + i * i + a * a <= n) return !0;
	}
	return !1;
}
function ta(e, t, n, r, i) {
	let a = new qi(e, t, !1, !1, n);
	return a.name = r, a.isolation = i, a.frustumCulled = !1, a.userData = {
		selectable: !1,
		type: "difference-density",
		sign: r.includes("Positive") ? "positive" : "negative"
	}, a;
}
function na(t, n, r = {}) {
	let i = performance.now(), a = {
		...Ke,
		...r
	}, o = Math.max(8, Math.round(a.resolution)), s = a.level ?? a.sigmaLevel * t.sigma;
	if (!(Number.isFinite(s) && s > 0)) throw Error("Difference-density contour level must be a positive finite number");
	if (!(Number.isFinite(a.radius) && a.radius > 0)) throw Error("Difference-density radius must be a positive finite number");
	let c = Zi(n, a.radius), l = a.sign ?? "both";
	if (![
		"positive",
		"negative",
		"both"
	].includes(l)) throw Error("Difference-density surface sign must be \"positive\", \"negative\", or \"both\"");
	let u = l !== "negative", d = l !== "positive", f = new e.MeshStandardMaterial({
		color: a.positiveColor,
		transparent: a.opacity < 1,
		opacity: a.opacity,
		wireframe: a.wireframe,
		side: e.DoubleSide,
		depthWrite: a.opacity >= 1,
		roughness: .35,
		metalness: 0
	}), p = f.clone();
	p.color.set(a.negativeColor);
	let m = u ? ta(o, f, a.maxPolyCount, "PositiveDifferenceDensity", s) : null, h = d ? ta(o, p, a.maxPolyCount, "NegativeDifferenceDensity", s) : null;
	m || f.dispose(), h || p.dispose();
	let g = c.maximum.map((e, t) => e - c.minimum[t]), _ = o / 2, v = n.cell.fractToCartMatrix.toArray(), y = n.atoms.map((e) => Xi(v, e.position.x, e.position.y, e.position.z)), b = a.radius ** 2;
	for (let e = 0; e < o; e++) {
		let n = c.minimum[2] + ((e - _) / _ + 1) * g[2] / 2;
		for (let r = 0; r < o; r++) {
			let i = c.minimum[1] + ((r - _) / _ + 1) * g[1] / 2, a = (e * o + r) * o;
			for (let e = 0; e < o; e++) {
				let r = c.minimum[0] + ((e - _) / _ + 1) * g[0] / 2;
				if (!ea(Xi(v, r, i, n), y, b)) continue;
				let o = t.sample(r, i, n);
				m && (m.field[a + e] = o), h && (h.field[a + e] = -o);
			}
		}
	}
	let x = performance.now();
	m?.update(), h?.update();
	let S = performance.now() - x, C = m ? m.geometry.drawRange.count / 3 : 0, w = h ? h.geometry.drawRange.count / 3 : 0, T = $i(n.cell, c), E = [m, h].filter(Boolean);
	for (let e of E) e.matrix.copy(T), e.matrixAutoUpdate = !1;
	let D = new e.Group();
	D.name = "DifferenceDensity", D.visible = a.visible;
	let O = performance.now() - i;
	return D.userData = {
		selectable: !1,
		type: "difference-density",
		bounds: c,
		level: s,
		sigmaLevel: s / t.sigma,
		resolution: o,
		positivePolygonCount: C,
		negativePolygonCount: w,
		polygonCount: C + w,
		symmetryUsed: !1,
		displayedRegionCount: 1,
		generatedRegionCount: 1,
		reusedRegionCount: 0,
		marchingCubesPassCount: E.length,
		stitched: !1,
		stitchTimeMs: 0,
		removedDuplicateTriangleCount: 0,
		polygonizationTimeMs: S,
		marchingCubesTimeMs: O,
		generationTimeMs: O
	}, D.add(...E), D;
}
//#endregion
//#region src/lib/density/difference-density-symmetry.js
var ra = 1e-4;
function ia(e, t) {
	return [
		e[0][0] * t[0] + e[0][1] * t[1] + e[0][2] * t[2],
		e[1][0] * t[0] + e[1][1] * t[1] + e[1][2] * t[2],
		e[2][0] * t[0] + e[2][1] * t[1] + e[2][2] * t[2]
	];
}
function aa(e, t) {
	return e.reduce((e, n, r) => e + (n - t[r]) ** 2, 0);
}
function oa(e) {
	return Array.isArray(e) ? e : e.toArray();
}
function sa(e, t) {
	let n = e.fractToCartMatrix.toArray();
	return Math.max(...t.maximum.map((e, r) => (e - t.minimum[r]) * Math.hypot(n[0][r], n[1][r], n[2][r])));
}
function ca(e, t) {
	let n = t;
	for (; e[n] !== n;) n = e[n];
	for (; e[t] !== t;) {
		let r = e[t];
		e[t] = n, t = r;
	}
	return n;
}
function la(e, t, n) {
	let r = ca(e, t), i = ca(e, n);
	r !== i && (e[i] = r);
}
function ua(e, t, n = 0) {
	let r = e?.atoms ?? [];
	if (r.length === 0) return [];
	let i = e.cell.fractToCartMatrix.toArray(), a = r.map((e) => ia(i, [
		e.position.x,
		e.position.y,
		e.position.z
	])), o = r.map((e, t) => t), s = (2 * t + n) ** 2;
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) aa(a[e], a[t]) <= s && la(o, e, t);
	let c = /* @__PURE__ */ new Map();
	for (let e = 0; e < r.length; e++) {
		let t = ca(o, e);
		c.has(t) || c.set(t, { atoms: [] }), c.get(t).atoms.push(r[e]);
	}
	return Array.from(c.values());
}
function da(e, t, n, r, i = "both") {
	return ua(e, t);
}
function fa(e) {
	return e.atoms.map((e) => `${e.label}\u0000${e.atomType}\u0000${e.disorderGroup}`).sort().join("");
}
function pa(e, t) {
	return e.label === t.label && e.atomType === t.atomType && Number(e.disorderGroup) === Number(t.disorderGroup);
}
function ma(e, t, n) {
	return oa(I(e.rotation, n)).map((n, r) => n + e.translation[r] + t[r]);
}
function ha(e, t, n, r) {
	let i = e.atoms[0], a = ma(n, [
		0,
		0,
		0
	], [
		i.position.x,
		i.position.y,
		i.position.z
	]), o = t.atoms.filter((e) => pa(i, e));
	for (let i of o) {
		let o = [
			i.position.x - a[0],
			i.position.y - a[1],
			i.position.z - a[2]
		].map(Math.round), s = new Set(t.atoms.map((e, t) => t)), c = !0;
		for (let i of e.atoms) {
			let e = ia(r, ma(n, o, [
				i.position.x,
				i.position.y,
				i.position.z
			])), a = -1;
			for (let n of s) {
				let o = t.atoms[n];
				if (pa(i, o) && aa(e, ia(r, [
					o.position.x,
					o.position.y,
					o.position.z
				])) <= ra ** 2) {
					a = n;
					break;
				}
			}
			if (a === -1) {
				c = !1;
				break;
			}
			s.delete(a);
		}
		if (c && s.size === 0) return {
			rotation: n.rotation,
			translation: n.translation.map((e, t) => e + o[t])
		};
	}
	return null;
}
function ga(e, t, n, r) {
	if (e.atoms.length !== t.atoms.length || fa(e) !== fa(t)) return null;
	let i = n.symmetryOperations ?? [{
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
		translation: [
			0,
			0,
			0
		]
	}];
	for (let n of i) {
		let i = ha(e, t, n, r);
		if (i) return i;
	}
	return null;
}
function _a(t, n) {
	let r = t.fractToCartMatrix.toArray(), i = oa(R(r)), a = oa(I(r, I(n.rotation, i))), o = ia(r, n.translation);
	return {
		determinant: ae(a),
		matrix: new e.Matrix4().set(a[0][0], a[0][1], a[0][2], o[0], a[1][0], a[1][1], a[1][2], o[1], a[2][0], a[2][1], a[2][2], o[2], 0, 0, 0, 1)
	};
}
function va(t, n = !1) {
	let r = new e.BufferGeometry(), i = t.drawRange.count;
	for (let [a, o] of Object.entries(t.attributes)) {
		let t = o.array.slice(0, i * o.itemSize);
		if (n) for (let e = 0; e < i; e += 3) for (let n = 0; n < o.itemSize; n++) {
			let r = (e + 1) * o.itemSize + n, i = (e + 2) * o.itemSize + n;
			[t[r], t[i]] = [t[i], t[r]];
		}
		r.setAttribute(a, new e.BufferAttribute(t, o.itemSize, o.normalized));
	}
	return r.setDrawRange(0, i), r.computeBoundingBox(), r.computeBoundingSphere(), r;
}
function ya(t, n) {
	let r = [], i = [], a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = 1 / Math.max(n, 2 ** -52), c = 0;
	for (let e of t) {
		let t = e.getAttribute("position");
		for (let e = 0; e < t.count; e += 3) {
			let n = [];
			for (let i = 0; i < 3; i++) {
				let o = e + i, c = [
					t.getX(o),
					t.getY(o),
					t.getZ(o)
				], l = c.map((e) => Math.round(e * s)).join(","), u = a.get(l);
				u === void 0 && (u = r.length / 3, a.set(l, u), r.push(...c)), n.push(u);
			}
			if (new Set(n).size < 3) {
				c++;
				continue;
			}
			let l = [...n].sort((e, t) => e - t).join(",");
			if (o.has(l)) {
				c++;
				continue;
			}
			o.add(l), i.push(...n);
		}
		e.dispose();
	}
	let l = new e.BufferGeometry();
	l.setAttribute("position", new e.Float32BufferAttribute(r, 3));
	let u = r.length / 3 > 65535 ? Uint32Array : Uint16Array;
	return l.setIndex(new e.BufferAttribute(new u(i), 1)), l.setDrawRange(0, i.length), l.computeVertexNormals(), l.computeBoundingBox(), l.computeBoundingSphere(), {
		geometry: l,
		removedTriangles: c
	};
}
function ba(e, t) {
	return {
		cell: e.cell,
		atoms: t.atoms
	};
}
function xa(e, t, n) {
	let r = [];
	for (let i of e) {
		let e = null, a = null;
		for (let o of r) {
			let r = ga(o.representative, i, t, n);
			if (r) {
				e = o, a = r;
				break;
			}
		}
		e ? e.copies.push({
			region: i,
			transform: a
		}) : r.push({
			representative: i,
			copies: [{
				region: i,
				transform: {
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
					translation: [
						0,
						0,
						0
					]
				}
			}]
		});
	}
	return r;
}
function Sa(t, n, r = {}) {
	let i = {
		...Ke,
		...r
	};
	if (i.useSymmetry === !1 || !n?.atoms?.length) return na(t, n, i);
	let a = performance.now(), o = Zi(n, i.radius), s = Math.max(8, Math.round(i.resolution)), c = sa(n.cell, o) / Math.max(1, s - 1), l = i.level ?? i.sigmaLevel * t.sigma, u = n.cell.fractToCartMatrix.toArray(), d = ["positive", "negative"].map((e) => {
		let r = da(n, i.radius, t, l, e);
		return {
			sign: e,
			regions: r,
			classes: xa(r, t, u)
		};
	}), f = d.reduce((e, t) => e + t.regions.length, 0), p = d.reduce((e, t) => e + t.classes.length, 0), m = f - p;
	if (m === 0) {
		let e = na(t, n, i);
		for (let t of d) e.userData[`${t.sign}DisplayedRegionCount`] = t.regions.length;
		return e;
	}
	let h = performance.now() - a, g = new e.Group();
	g.name = "DifferenceDensity", g.visible = i.visible;
	let _ = 0, v = 0, y = 0, b = 0, x = 0, S = {
		positive: [],
		negative: []
	}, C = {
		positive: [],
		negative: []
	};
	d.forEach((e) => {
		e.classes.forEach((r) => {
			let a = ba(n, r.representative), o = Zi(a, i.radius), l = Math.max(8, Math.min(s, Math.ceil(sa(n.cell, o) / c) + 1)), u = Math.max(2e3, Math.min(i.maxPolyCount, Math.ceil(i.maxPolyCount * (l / s) ** 2 * 2))), d = performance.now(), f = na(t, a, {
				...i,
				resolution: l,
				maxPolyCount: u,
				sign: e.sign
			});
			b += performance.now() - d, y += f.userData.polygonizationTimeMs;
			let p = f.children[0], m = {
				regular: va(p.geometry),
				mirrored: null,
				material: p.material,
				matrix: p.matrix.clone()
			};
			C[e.sign].push(m.material), p.geometry.dispose(), r.copies.forEach((t) => {
				let r = _a(n.cell, t.transform), i = m.regular;
				r.determinant < 0 && (x++, m.mirrored ??= va(m.regular, !0), i = m.mirrored);
				let a = i.clone();
				a.applyMatrix4(r.matrix.clone().multiply(m.matrix)), a.deleteAttribute("normal"), S[e.sign].push(a);
			}), m.regular.dispose(), m.mirrored?.dispose();
		});
	});
	let w = performance.now(), T = 0;
	for (let t of ["positive", "negative"]) {
		let n = ya(S[t], i.stitchTolerance ?? 1e-4);
		T += n.removedTriangles;
		let r = C[t][0];
		C[t].slice(1).forEach((e) => e.dispose());
		let a = new e.Mesh(n.geometry, r);
		a.name = `${t === "positive" ? "Positive" : "Negative"}DifferenceDensity`, a.userData = {
			selectable: !1,
			type: "difference-density",
			sign: t
		}, a.frustumCulled = !1, g.add(a);
		let o = (n.geometry.getIndex()?.count ?? 0) / 3;
		t === "positive" ? _ = o : v = o;
	}
	let E = performance.now() - w;
	return g.userData = {
		selectable: !1,
		type: "difference-density",
		bounds: o,
		level: l,
		sigmaLevel: l / t.sigma,
		resolution: s,
		positivePolygonCount: _,
		negativePolygonCount: v,
		polygonCount: _ + v,
		symmetryUsed: !0,
		displayedRegionCount: f,
		generatedRegionCount: p,
		positiveDisplayedRegionCount: d[0].regions.length,
		positiveGeneratedRegionCount: d[0].classes.length,
		negativeDisplayedRegionCount: d[1].regions.length,
		negativeGeneratedRegionCount: d[1].classes.length,
		reusedRegionCount: m,
		marchingCubesPassCount: p,
		stitched: !0,
		stitchTolerance: i.stitchTolerance ?? 1e-4,
		stitchTimeMs: E,
		removedDuplicateTriangleCount: T,
		improperTransformCount: x,
		symmetryPlanningTimeMs: h,
		polygonizationTimeMs: y,
		marchingCubesTimeMs: b,
		generationTimeMs: performance.now() - a
	}, g;
}
//#endregion
//#region src/lib/density/difference-density-worker.js?worker
function Ca(e) {
	return new Worker("/assets/difference-density-worker-HnYHm54H.js", { name: e?.name });
}
//#endregion
//#region src/lib/density/difference-density-progress.js
function wa(e) {
	let t = (Array.isArray(e) ? e : [1]).map(Number).filter((e) => Number.isFinite(e) && e > 0 && e <= 1).sort((e, t) => e - t);
	return t.includes(1) || t.push(1), [...new Set(t)];
}
function Ta(e, t = {}) {
	let n = wa(t.steps), r = Number(t.reciprocalResolution) || 1, i = Math.max(1, Number(t.gridOversampling) || 1), a = n.length === 1 ? i : Math.min(i, Math.max(1, Number(t.initialGridOversampling) || 1)), o = null;
	return {
		steps: n,
		mapAt(t) {
			let n = t === 0 ? a : t === 1 && a !== i ? i : null;
			return n !== null && (o = nr(e, r, n)), {
				map: o,
				changed: n !== null
			};
		}
	};
}
//#endregion
//#region src/lib/ortep3d/crystal-viewer.js
var Ea = [
	"auto-omit",
	"quality-omit",
	"performance-omit",
	"maximum-coverage"
], Da = ["structure", "viewport"];
function Oa(e) {
	return e === "none" || e === "all" || e === "non-hydrogen" || Array.isArray(e) && e.every((e) => typeof e == "string" || typeof e == "object" && !!e && typeof e.id == "string");
}
function ka(e) {
	if (e.placementMode !== void 0 && !Ea.includes(e.placementMode)) throw Error(`Invalid atom label placement mode: "${e.placementMode}". Must be one of: ${Ea.join(", ")}`);
	if (e.calloutPlacement !== void 0 && !Da.includes(e.calloutPlacement)) throw Error(`Invalid atom label callout placement: "${e.calloutPlacement}". Must be one of: ${Da.join(", ")}`);
	if (e.show !== void 0 && !Oa(e.show)) throw Error("atomLabels.show must be \"none\", \"all\", \"non-hydrogen\", or an array of label requests");
	if (e.maxConnectorLength !== void 0 && !(typeof e.maxConnectorLength == "number" && e.maxConnectorLength > 0)) throw Error("atomLabels.maxConnectorLength must be a positive number");
	if (e.performanceNoSpaceCellSize !== void 0 && !(typeof e.performanceNoSpaceCellSize == "number" && e.performanceNoSpaceCellSize > 0)) throw Error("atomLabels.performanceNoSpaceCellSize must be a positive number");
	if (e.autoPerformanceLabelThreshold !== void 0 && !(Number.isInteger(e.autoPerformanceLabelThreshold) && e.autoPerformanceLabelThreshold >= 0)) throw Error("atomLabels.autoPerformanceLabelThreshold must be a non-negative integer");
}
function Aa(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
var ja = class {
	constructor(e) {
		this.options = e, this.selectedObjects = /* @__PURE__ */ new Set(), this.selectionCallbacks = /* @__PURE__ */ new Set(), this.selectedData = /* @__PURE__ */ new Set();
	}
	pruneInvalidSelections(e) {
		if (this.selectedObjects.clear(), this.selectedData.size === 0) {
			this.notifyCallbacks();
			return;
		}
		let t = /* @__PURE__ */ new Set();
		e.traverse((e) => {
			if (e.userData?.selectable) {
				let n = this.getObjectDescriptorData(e);
				n && t.add(JSON.stringify(n));
			}
		}), this.selectedData = new Set(Array.from(this.selectedData).filter((e) => t.has(JSON.stringify({
			type: e.type,
			...this.getDataWithoutColor(e)
		})))), e.traverse((e) => {
			if (e.userData?.selectable) {
				let t = this.getObjectDescriptorData(e);
				if (this.hasMatchingData(t)) {
					let n = this.getColorForData(t);
					e.select(n, this.options), this.selectedObjects.add(e);
				}
			}
		}), this.notifyCallbacks();
	}
	getDataWithoutColor(e) {
		let { color: t, ...n } = e;
		return n;
	}
	getObjectDescriptorData(e) {
		if (!e.userData) return null;
		switch (e.userData.type) {
			case "atom": return {
				type: "atom",
				id: e.userData.atomData.uniqueId,
				label: e.userData.atomData.label
			};
			case "bond": return {
				type: "bond",
				atom1: e.userData.bondData.atom1Id,
				atom2: e.userData.bondData.atom2Id
			};
			case "hbond": return {
				type: "hbond",
				donor: e.userData.hbondData.donorAtomId,
				hydrogen: e.userData.hbondData.hydrogenAtomId,
				acceptor: e.userData.hbondData.acceptorAtomId
			};
			default: return null;
		}
	}
	hasMatchingData(e) {
		return e ? Array.from(this.selectedData).some((t) => this.matchData(t, e)) : !1;
	}
	getColorForData(e) {
		let t = Array.from(this.selectedData).find((t) => this.matchData(t, e));
		return t ? t.color : this.getNextColor();
	}
	getNextColor() {
		let e = /* @__PURE__ */ new Map();
		this.selectedData.forEach((t) => {
			e.set(t.color, (e.get(t.color) || 0) + 1);
		});
		let t = this.options.selection.markerColors.find((t) => !e.has(t));
		if (!t) {
			let n = Math.min(...e.values());
			t = this.options.selection.markerColors.find((t) => e.get(t) === n);
		}
		return t;
	}
	handle(e) {
		this.options.mode === "single" && (this.selectedObjects.forEach((e) => {
			this.remove(e);
		}), this.selectedObjects.clear(), this.selectedData.clear());
		let t = this.getObjectDescriptorData(e);
		if (!t) return null;
		let n;
		return this.hasMatchingData(t) ? (n = e.selectionColor, this.remove(e), this.selectedData = new Set(Array.from(this.selectedData).filter((e) => !this.matchData(e, t)))) : (n = this.getNextColor(), this.add(e, n), this.selectedData.add({
			...t,
			color: n
		})), this.notifyCallbacks(), n;
	}
	matchData(e, t) {
		if (e.type !== t.type) return !1;
		switch (e.type) {
			case "atom": return e.id === t.id;
			case "bond": return e.atom1 === t.atom1 && e.atom2 === t.atom2 || e.atom1 === t.atom2 && e.atom2 === t.atom1;
			case "hbond": return e.donor === t.donor && e.hydrogen === t.hydrogen && e.acceptor === t.acceptor;
			default: return !1;
		}
	}
	add(e, t) {
		e.select(t || this.getNextColor(), this.options), this.selectedObjects.add(e);
	}
	remove(e) {
		this.selectedObjects.delete(e), e.deselect();
	}
	clear() {
		this.selectedObjects.forEach((e) => {
			this.remove(e);
		}), this.selectedObjects.clear(), this.selectedData.clear(), this.notifyCallbacks();
	}
	onChange(e) {
		this.selectionCallbacks.add(e);
	}
	notifyCallbacks() {
		let e = Array.from(this.selectedObjects).map((e) => ({
			type: e.userData.type,
			data: e.userData.type === "hbond" ? e.userData.hbondData : e.userData.type === "bond" ? e.userData.bondData : e.userData.atomData,
			color: e.selectionColor
		}));
		this.selectionCallbacks.forEach((t) => t(e));
	}
	setMode(e) {
		if (e !== "single" && e !== "multiple") throw Error("Selection mode must be either \"single\" or \"multiple\"");
		if (this.options.mode = e, e === "single" && this.selectedObjects.size > 1) {
			let e = Array.from(this.selectedObjects), t = e[e.length - 1], n = this.getObjectDescriptorData(t);
			this.clear(), n && (this.add(t), this.selectedData.add({
				...n,
				color: t.selectionColor
			})), this.notifyCallbacks();
		}
	}
	dispose() {
		this.clear(), this.selectionCallbacks.clear();
	}
	selectAtoms(e, t) {
		let n = new Set(e);
		t.traverse((e) => {
			if (e.userData?.type === "atom" && e.userData?.selectable && n.has(e.userData.atomData.label)) {
				let t = this.getObjectDescriptorData(e);
				this.hasMatchingData(t) || (this.add(e), this.selectedData.add({
					...t,
					color: e.selectionColor
				}));
			}
		}), this.notifyCallbacks();
	}
}, Ma = class {
	constructor(t, n = {}) {
		let r = ["constant", "onDemand"];
		if (n.renderMode && !r.includes(n.renderMode)) throw Error(`Invalid render mode: "${n.renderMode}". Must be one of: ${r.join(", ")}`);
		let i = [
			"solid-3d",
			"cutout-3d",
			"cutout-2d"
		];
		if (n.renderStyle && !i.includes(n.renderStyle)) throw Error(`Invalid render style: "${n.renderStyle}". Must be one of: ${i.join(", ")}`);
		ka(n.atomLabels || {});
		let a = Aa(n.atomLabels || {});
		this.container = t;
		let o = n.camera?.initialPosition ?? W.camera.initialPosition;
		this.options = {
			camera: {
				...W.camera,
				...n.camera || {},
				initialPosition: o.isVector3 ? o.clone() : new e.Vector3(...o)
			},
			selection: {
				...W.selection,
				...n.selection || {}
			},
			interaction: {
				...W.interaction,
				...n.interaction || {}
			},
			atomLabels: {
				...W.atomLabels,
				...a,
				text: {
					...W.atomLabels.text,
					...a.text || {}
				}
			},
			atomDetail: n.atomDetail || W.atomDetail,
			atomCutawayHysteresis: n.atomCutawayHysteresis ?? W.atomCutawayHysteresis,
			atomCutawayStripeCount: n.atomCutawayStripeCount ?? W.atomCutawayStripeCount,
			atomCutawayStripeWidth: n.atomCutawayStripeWidth ?? W.atomCutawayStripeWidth,
			atomColorRoughness: n.atomColorRoughness || W.atomColorRoughness,
			atomColorMetalness: n.atomColorMetalness || W.atomColorMetalness,
			atomADPRingWidthFactor: n.atomADPRingWidthFactor || W.atomADPRingWidthFactor,
			atomADPRingHeight: n.atomADPRingHeight || W.atomADPRingHeight,
			atomADPRingSections: n.atomADPRingSections || W.atomADPRingSections,
			bondRadius: n.bondRadius || W.bondRadius,
			bondSections: n.bondSections || W.bondSections,
			bondColor: n.bondColor || W.bondColor,
			bondColorRoughness: n.bondColorRoughness || W.bondColorRoughness,
			bondColorMetalness: n.bondColorMetalness || W.bondColorMetalness,
			bondGrowTolerance: n.bondGrowTolerance ?? W.bondGrowTolerance,
			hbondRadius: n.hbondRadius ?? W.hbondRadius,
			hbondColor: n.hbondColor || W.hbondColor,
			hbondColorRoughness: n.hbondColorRoughness ?? W.hbondColorRoughness,
			hbondColorMetalness: n.hbondColorMetalness ?? W.hbondColorMetalness,
			hbondDashSegmentLength: n.hbondDashSegmentLength ?? W.hbondDashSegmentLength,
			hbondDashFraction: n.hbondDashFraction ?? W.hbondDashFraction,
			elementProperties: {
				...W.elementProperties,
				...n.elementProperties
			},
			hydrogenMode: n.hydrogenMode || W.hydrogenMode,
			disorderMode: n.disorderMode || W.disorderMode,
			symmetryMode: n.symmetryMode || W.symmetryMode,
			renderMode: n.renderMode || W.renderMode,
			renderStyle: n.renderStyle || W.renderStyle,
			plot2DBackground: n.plot2DBackground || W.plot2DBackground,
			plot2DAtomColor: n.plot2DAtomColor || W.plot2DAtomColor,
			plot2DLineColor: n.plot2DLineColor || W.plot2DLineColor,
			plot2DBondColor: n.plot2DBondColor || W.plot2DBondColor,
			plot2DOpenBondInnerScale: n.plot2DOpenBondInnerScale ?? W.plot2DOpenBondInnerScale,
			plot2DStripeCount: n.plot2DStripeCount ?? W.plot2DStripeCount,
			plot2DStripeWidth: n.plot2DStripeWidth ?? W.plot2DStripeWidth,
			plot2DOutlineScale: n.plot2DOutlineScale ?? W.plot2DOutlineScale,
			fixCifErrors: n.fixCifErrors || W.fixCifErrors,
			cell: {
				...W.cell,
				...n.cell
			},
			differenceDensity: {
				...W.differenceDensity,
				...Aa(n.differenceDensity || {})
			}
		}, this.state = {
			isDragging: !1,
			currentCifContent: null,
			currentCifBlock: null,
			currentStructure: null,
			displayStructure: null,
			currentFloor: null,
			baseStructure: null,
			ortepObjects: /* @__PURE__ */ new Map(),
			structureCenter: new e.Vector3(),
			differenceDensityMap: null,
			differenceDensityGroup: null,
			differenceDensityResolutionFraction: 1,
			differenceDensitySurfaceResolutionFraction: 1,
			currentStructureFactorModel: null
		}, this.differenceDensityUpdateCallbacks = /* @__PURE__ */ new Set(), this.differenceDensityLoadSequence = 0, this.differenceDensityWorker = null, this.differenceDensityPendingResolve = null, this.differenceDensityMainThreadLoadId = null, this.modifiers = {
			removeatoms: new $r(),
			addhydrogen: new ti(),
			missingbonds: new ei(this.options.elementProperties, this.options.bondGrowTolerance),
			disorder: new Zr(this.options.disorderMode),
			symmetry: new Qr(this.options.symmetryMode),
			hydrogen: new Xr(this.options.hydrogenMode)
		}, this.selections = new ja(this.options), this.setupScene(), this.atomLabelManager = new Ki(this), this.controls = new oi(this), this.animate(), this.needsRender = !0;
	}
	setupScene() {
		this.scene = new e.Scene(), this.cameraController = ui(this.container, this.options), this.camera = this.cameraController.camera, this.renderer = new e.WebGLRenderer({
			antialias: !0,
			alpha: !0
		}), this.options.renderStyle === "cutout-2d" && this.renderer.setClearColor(this.options.plot2DBackground, 1), this.resizeRendererToDisplaySize(), this.container.appendChild(this.renderer.domElement), this.moleculeContainer = new e.Group(), this.scene.add(this.moleculeContainer), this.camera.position.copy(this.options.camera.initialPosition), this.cameraTarget = new e.Vector3(0, 0, 0), this.camera.lookAt(this.cameraTarget);
	}
	async loadCIF(e, t = 0, n = {}) {
		if (e === void 0) return console.error("Cannot load an empty text as CIF"), {
			success: !1,
			error: "Cannot load an empty text as CIF"
		};
		try {
			let r = new j(e), i;
			try {
				i = typeof t == "number" ? r.getBlock(t) : r.getBlockByName(t);
			} catch (e) {
				return {
					success: !1,
					error: e.message
				};
			}
			let a;
			try {
				a = U.fromCIF(i);
			} catch (e) {
				if (this.options.fixCifErrors) throw e;
				try {
					ur(i), a = U.fromCIF(i);
				} catch {
					throw e;
				}
			}
			this.cancelDifferenceDensityLoad("Coordinate structure changed"), this.removeDifferenceDensity3D(), this.state.differenceDensityMap = null, await this.loadStructure(a), this.state.currentCifContent = e, this.state.currentCifBlock = t, this.state.currentStructureFactorModel = Rt(a, i);
			let o = n.differenceDensity ?? this.options.differenceDensity.autoLoad;
			if (!o) return { success: !0 };
			let s = o === !0 ? {} : o;
			return typeof s != "object" || Array.isArray(s) ? {
				success: !1,
				error: "loadCIF differenceDensity must be true, false, or an options object"
			} : {
				success: !0,
				differenceDensityStarted: !0,
				differenceDensity: new Promise((n) => setTimeout(() => {
					if (this.state.currentCifContent !== e || this.state.currentCifBlock !== t) {
						n({
							success: !1,
							cancelled: !0,
							error: "Coordinate structure changed"
						});
						return;
					}
					this.loadDifferenceDensity(e, t, s).then(n);
				}, 0))
			};
		} catch (e) {
			return console.error("Error loading structure:", e), {
				success: !1,
				error: e.message
			};
		}
	}
	async loadDifferenceDensity(e, t = 0, n = {}) {
		if (!this.state.baseStructure) return {
			success: !1,
			error: "Load a crystal structure before loading difference density"
		};
		if (e === void 0) return {
			success: !1,
			error: "Cannot load empty text as an FCF"
		};
		this.cancelDifferenceDensityLoad("Superseded by a new FCF load"), this.removeDifferenceDensity3D(), this.state.differenceDensityMap = null, this.options.differenceDensity = {
			...this.options.differenceDensity,
			...Aa(n)
		};
		let r = ++this.differenceDensityLoadSequence;
		return this.notifyDifferenceDensityUpdate({
			type: "started",
			loadId: r
		}), this.options.differenceDensity.useWorker && typeof Worker < "u" ? this.loadDifferenceDensityInWorker(e, t, r) : this.loadDifferenceDensityOnMainThread(e, t, r);
	}
	onDifferenceDensityUpdate(e) {
		if (typeof e != "function") throw Error("Difference-density update callback must be a function");
		return this.differenceDensityUpdateCallbacks.add(e), () => this.differenceDensityUpdateCallbacks.delete(e);
	}
	notifyDifferenceDensityUpdate(e) {
		for (let t of this.differenceDensityUpdateCallbacks) try {
			t(e);
		} catch (e) {
			console.error("Difference-density update callback failed:", e);
		}
	}
	loadDifferenceDensityInWorker(e, t, n) {
		return new Promise((r) => {
			let i = new Ca();
			this.differenceDensityWorker = i, this.differenceDensityPendingResolve = r;
			let a = (e) => {
				if (n !== this.differenceDensityLoadSequence) return;
				let t = e?.message || String(e);
				console.error("Error loading difference density:", e), this.notifyDifferenceDensityUpdate({
					type: "error",
					loadId: n,
					error: t
				}), this.finishDifferenceDensityWorker(), r({
					success: !1,
					error: t
				});
			};
			i.addEventListener("error", a), i.addEventListener("message", (e) => {
				let t = e.data;
				if (!(t.loadId !== n || n !== this.differenceDensityLoadSequence)) {
					if (t.type === "error") {
						a(Error(t.error));
						return;
					}
					if (t.type === "update") try {
						let e = t.map ? this.differenceDensityMapFromPayload(t.map) : this.state.differenceDensityMap;
						if (!e) throw Error("Density worker requested surface refinement before providing a grid");
						if (this.applyProgressiveDifferenceDensityMap(e, t), t.final) {
							let i = this.differenceDensityResult(e);
							this.notifyDifferenceDensityUpdate({
								...t,
								...i,
								type: "complete",
								loadId: n
							}), this.finishDifferenceDensityWorker(), r(i);
						} else this.continueDensityWorkerAfterRender(i, n, t.stepIndex);
					} catch (e) {
						a(e);
					}
				}
			}), i.postMessage({
				type: "load",
				loadId: n,
				fcfText: e,
				fcfBlock: t,
				datasetOptions: this.differenceDensityDatasetOptions(),
				steps: this.options.differenceDensity.progressiveSteps,
				reciprocalResolution: this.options.differenceDensity.reciprocalResolution,
				initialGridOversampling: this.options.differenceDensity.initialGridOversampling,
				gridOversampling: this.options.differenceDensity.gridOversampling
			});
		});
	}
	async loadDifferenceDensityOnMainThread(e, t, n) {
		this.differenceDensityMainThreadLoadId = n;
		try {
			let r = Ta(Xn(e, t, this.differenceDensityDatasetOptions()), {
				steps: this.options.differenceDensity.progressiveSteps,
				reciprocalResolution: this.options.differenceDensity.reciprocalResolution,
				initialGridOversampling: this.options.differenceDensity.initialGridOversampling,
				gridOversampling: this.options.differenceDensity.gridOversampling
			}), i = r.steps, a;
			for (let e = 0; e < i.length; e++) {
				if (n !== this.differenceDensityLoadSequence) return {
					success: !1,
					cancelled: !0,
					error: "Difference-density load cancelled"
				};
				a = r.mapAt(e).map;
				let t = {
					loadId: n,
					stepIndex: e,
					totalSteps: i.length,
					final: e === i.length - 1,
					surfaceResolutionFraction: i[e]
				};
				this.applyProgressiveDifferenceDensityMap(a, t), t.final || await new Promise((e) => setTimeout(e, 0));
			}
			let o = this.differenceDensityResult(a);
			return this.notifyDifferenceDensityUpdate({
				type: "complete",
				loadId: n,
				...o
			}), o;
		} catch (e) {
			return n === this.differenceDensityLoadSequence ? (console.error("Error loading difference density:", e), this.notifyDifferenceDensityUpdate({
				type: "error",
				loadId: n,
				error: e.message
			}), {
				success: !1,
				error: e.message
			}) : {
				success: !1,
				cancelled: !0,
				error: "Difference-density load cancelled"
			};
		} finally {
			this.differenceDensityMainThreadLoadId === n && (this.differenceDensityMainThreadLoadId = null);
		}
	}
	differenceDensityAnomalousDispersionOptions() {
		let e = this.options.differenceDensity.anomalousDispersion;
		if (!e) return null;
		if (e !== !0 && (typeof e != "object" || Array.isArray(e))) throw Error("differenceDensity.anomalousDispersion must be true, false, or an object");
		return {
			...e === !0 ? {} : e,
			cifText: this.state.currentCifContent,
			cifBlock: this.state.currentCifBlock,
			structureModel: this.state.currentStructureFactorModel
		};
	}
	differenceDensityDatasetOptions() {
		return {
			inputMode: this.options.differenceDensity.inputMode,
			coefficientColumns: this.options.differenceDensity.coefficientColumns,
			anomalousDispersion: this.differenceDensityAnomalousDispersionOptions(),
			coordinateCifText: this.state.currentCifContent,
			coordinateCifBlock: this.state.currentCifBlock,
			structureModel: this.state.currentStructureFactorModel,
			reflections: this.options.differenceDensity.reflections,
			iam: this.options.differenceDensity.iam,
			intensityScale: this.options.differenceDensity.intensityScale,
			extinctionCorrection: this.options.differenceDensity.extinctionCorrection
		};
	}
	normalizedDifferenceDensitySteps() {
		return wa(this.options.differenceDensity.progressiveSteps);
	}
	differenceDensityMapFromPayload(e) {
		return rr.fromPayload(e);
	}
	applyProgressiveDifferenceDensityMap(e, t) {
		this.validateDifferenceDensityCell(e.cell, this.state.baseStructure.cell), this.state.differenceDensityMap = e, this.state.differenceDensityResolutionFraction = e.resolutionFraction, this.state.differenceDensitySurfaceResolutionFraction = t.surfaceResolutionFraction ?? 1, this.updateDifferenceDensity3D(this.state.displayStructure);
		let n = this.state.differenceDensityGroup?.userData ?? {};
		this.requestRender(), this.notifyDifferenceDensityUpdate({
			type: "update",
			...t,
			progress: (t.stepIndex + 1) / t.totalSteps,
			resolutionFraction: e.resolutionFraction,
			gridOversampling: e.gridOversampling,
			surfaceResolutionFraction: this.state.differenceDensitySurfaceResolutionFraction,
			surfaceResolution: n.resolution ?? 0,
			dimensions: [...e.dimensions],
			reflectionCount: e.reflectionCount,
			coefficientCount: e.coefficientCount,
			coefficientMode: e.coefficientMode,
			omitF000: e.omitF000,
			anomalousDispersion: e.anomalousDispersion,
			densitySource: e.densitySource,
			densityKind: e.densityKind,
			intensityScale: e.intensityScale,
			scaleR1: e.scaleR1,
			observations: e.observations,
			iam: e.iam,
			reflectionPolicy: e.reflectionPolicy,
			extinctionCorrection: e.extinctionCorrection,
			sigma: e.sigma,
			minimum: e.minimum,
			maximum: e.maximum,
			polygonCount: n.polygonCount ?? 0,
			positivePolygonCount: n.positivePolygonCount ?? 0,
			negativePolygonCount: n.negativePolygonCount ?? 0,
			symmetryUsed: n.symmetryUsed ?? !1,
			displayedRegionCount: n.displayedRegionCount ?? 1,
			generatedRegionCount: n.generatedRegionCount ?? 1,
			reusedRegionCount: n.reusedRegionCount ?? 0,
			marchingCubesPassCount: n.marchingCubesPassCount ?? 2,
			marchingCubesTimeMs: n.marchingCubesTimeMs ?? n.generationTimeMs ?? 0,
			polygonizationTimeMs: n.polygonizationTimeMs ?? 0,
			stitched: n.stitched ?? !1,
			stitchTimeMs: n.stitchTimeMs ?? 0,
			removedDuplicateTriangleCount: n.removedDuplicateTriangleCount ?? 0
		});
	}
	continueDensityWorkerAfterRender(e, t, n) {
		let r = !1, i = () => {
			r || e !== this.differenceDensityWorker || (r = !0, e.postMessage({
				type: "continue",
				loadId: t,
				stepIndex: n
			}));
		};
		typeof requestAnimationFrame == "function" && requestAnimationFrame(i), setTimeout(i, 100);
	}
	differenceDensityResult(e) {
		let t = this.state.differenceDensityGroup?.userData ?? {};
		return {
			success: !0,
			reflectionCount: e.reflectionCount,
			coefficientCount: e.coefficientCount,
			coefficientMode: e.coefficientMode,
			omitF000: e.omitF000,
			anomalousDispersion: e.anomalousDispersion,
			densitySource: e.densitySource,
			densityKind: e.densityKind,
			intensityScale: e.intensityScale,
			scaleR1: e.scaleR1,
			observations: e.observations,
			iam: e.iam,
			reflectionPolicy: e.reflectionPolicy,
			extinctionCorrection: e.extinctionCorrection,
			dimensions: [...e.dimensions],
			gridOversampling: e.gridOversampling,
			sigma: e.sigma,
			minimum: e.minimum,
			maximum: e.maximum,
			polygonCount: t.polygonCount ?? 0,
			positivePolygonCount: t.positivePolygonCount ?? 0,
			negativePolygonCount: t.negativePolygonCount ?? 0,
			symmetryUsed: t.symmetryUsed ?? !1,
			displayedRegionCount: t.displayedRegionCount ?? 1,
			generatedRegionCount: t.generatedRegionCount ?? 1,
			reusedRegionCount: t.reusedRegionCount ?? 0,
			marchingCubesPassCount: t.marchingCubesPassCount ?? 2,
			marchingCubesTimeMs: t.marchingCubesTimeMs ?? t.generationTimeMs ?? 0,
			stitched: t.stitched ?? !1,
			stitchTimeMs: t.stitchTimeMs ?? 0,
			removedDuplicateTriangleCount: t.removedDuplicateTriangleCount ?? 0
		};
	}
	finishDifferenceDensityWorker() {
		this.differenceDensityWorker?.terminate(), this.differenceDensityWorker = null, this.differenceDensityPendingResolve = null;
	}
	cancelDifferenceDensityLoad(e = "Difference-density load cancelled") {
		let t = this.differenceDensityMainThreadLoadId !== null;
		if (!this.differenceDensityWorker && !this.differenceDensityPendingResolve && !t) return;
		let n = this.differenceDensityMainThreadLoadId ?? this.differenceDensityLoadSequence;
		t && (this.differenceDensityLoadSequence++, this.differenceDensityMainThreadLoadId = null), this.differenceDensityWorker?.terminate(), this.differenceDensityWorker = null;
		let r = this.differenceDensityPendingResolve;
		this.differenceDensityPendingResolve = null, r?.({
			success: !1,
			cancelled: !0,
			error: e
		}), this.notifyDifferenceDensityUpdate({
			type: "cancelled",
			loadId: n,
			error: e
		});
	}
	updateDifferenceDensityOptions(e = {}) {
		return this.options.differenceDensity = {
			...this.options.differenceDensity,
			...Aa(e)
		}, this.state.differenceDensityMap && this.state.displayStructure && (this.updateDifferenceDensity3D(this.state.displayStructure), this.requestRender()), { success: !0 };
	}
	clearDifferenceDensity() {
		this.cancelDifferenceDensityLoad(), this.removeDifferenceDensity3D(), this.state.differenceDensityMap = null, this.state.differenceDensityResolutionFraction = 1, this.state.differenceDensitySurfaceResolutionFraction = 1, this.requestRender();
	}
	validateDifferenceDensityCell(e, t) {
		Et(e, t, "FCF");
	}
	async loadStructure(t = this.state.baseStructure) {
		this.state.baseStructure = t, this.selections.clear(), this.moleculeContainer.position.set(0, 0, 0), this.moleculeContainer.rotation.set(0, 0, 0), this.moleculeContainer.scale.set(1, 1, 1), this.moleculeContainer.updateMatrix(), this.moleculeContainer.matrixAutoUpdate = !0, this.moleculeContainer.updateMatrixWorld(!0), this.cameraTarget.set(0, 0, 0), this.camera.position.copy(this.options.camera.initialPosition), this.camera.lookAt(this.cameraTarget), this.state.structureCenter.set(0, 0, 0), this.update3DOrtep();
		let n = ii(this.state.currentStructure);
		return this.container.clientHeight > this.container.clientWidth && n.premultiply(new e.Matrix4().makeRotationZ(Math.PI / 2)), n && (this.moleculeContainer.setRotationFromMatrix(n), this.moleculeContainer.updateMatrix()), new e.Box3().setFromObject(this.moleculeContainer).getCenter(this.state.structureCenter), this.moleculeContainer.position.sub(this.state.structureCenter), this.updateCamera(), ai(this.scene, this.state.currentStructure), this.requestRender(), { success: !0 };
	}
	async updateStructure() {
		try {
			let e = this.moleculeContainer.matrix.clone();
			return this.update3DOrtep(), this.moleculeContainer.matrix.copy(e), this.moleculeContainer.matrixAutoUpdate = !1, this.requestRender(), { success: !0 };
		} catch (e) {
			return console.error("Error updating structure:", e), {
				success: !1,
				error: e.message
			};
		}
	}
	update3DOrtep() {
		this.removeStructure();
		let e = this.state.baseStructure, t = !1;
		for (let n of Object.values(this.modifiers)) e = n.apply(e), t ||= n.drawCell;
		if (t) {
			let t = pi(e.cell, this.options.cell);
			this.moleculeContainer.add(t);
		}
		let n = new st(e, this.options).getGroup();
		this.moleculeContainer.add(n), this.state.currentStructure = n, this.state.displayStructure = e, this.updateDifferenceDensity3D(e), this.atomLabelManager.setStructure(e), this.selections.pruneInvalidSelections(this.moleculeContainer);
	}
	updateDifferenceDensity3D(e) {
		if (this.removeDifferenceDensity3D(), !this.state.differenceDensityMap || !e) return;
		let t = Qi(e, this.options.differenceDensity), n = this.state.differenceDensityMap.densityKind === "deformation" ? {
			positiveColor: this.options.differenceDensity.deformationPositiveColor,
			negativeColor: this.options.differenceDensity.deformationNegativeColor
		} : {}, r = Sa(this.state.differenceDensityMap, e, {
			...this.options.differenceDensity,
			...n,
			resolution: Math.max(8, Math.round(t * (this.state.differenceDensitySurfaceResolutionFraction ?? 1)))
		});
		this.moleculeContainer.add(r), this.state.differenceDensityGroup = r;
	}
	removeDifferenceDensity3D() {
		let e = this.state.differenceDensityGroup;
		e && (e.traverse((e) => {
			e.geometry?.dispose(), e.material?.dispose();
		}), e.removeFromParent(), this.state.differenceDensityGroup = null);
	}
	updateCamera() {
		this.controls.handleResize(), this.cameraController.fitToStructure(this.moleculeContainer), this.requestRender();
	}
	removeStructure() {
		this.moleculeContainer.traverse((e) => {
			e.geometry && e.geometry.dispose(), e.material && e.material.dispose();
		}), this.moleculeContainer.clear(), this.state.differenceDensityGroup = null;
	}
	async cycleModifierMode(e) {
		let t = this.modifiers[e], n = t.cycleMode(this.state.baseStructure), r;
		return r = t.requiresCameraUpdate ? await this.loadStructure(this.state.baseStructure) : await this.updateStructure(), {
			...r,
			mode: n
		};
	}
	numberModifierModes(e) {
		if (!this.state.baseStructure) return !1;
		let t = this.modifiers.removeatoms.apply(this.state.baseStructure);
		return this.modifiers[e].getApplicableModes(t).length;
	}
	animate() {
		(this.options.renderMode === "constant" || this.needsRender) && (this.updateCameraFacingOctants(), this.renderer.render(this.scene, this.camera), this.atomLabelManager.scheduleUpdate(), this.needsRender = !1), requestAnimationFrame(this.animate.bind(this));
	}
	updateCameraFacingOctants() {
		let e = this.state.currentStructure?.cameraFacingAtoms;
		e?.length && (this.camera.updateMatrixWorld(), this.moleculeContainer.updateMatrixWorld(!0), e.forEach((e) => {
			e.updateCutawayOctant(this.camera);
		}));
	}
	requestRender() {
		this.options.renderMode === "onDemand" && (this.needsRender = !0);
	}
	resizeRendererToDisplaySize() {
		let e = this.renderer.domElement, t = window.devicePixelRatio || 1, n = Math.floor(this.container.clientWidth * t), r = Math.floor(this.container.clientHeight * t), i = e.width !== n || e.height !== r;
		return i && (this.renderer.setSize(n, r, !1), e.style.width = `${this.container.clientWidth}px`, e.style.height = `${this.container.clientHeight}px`, this.renderer.setViewport(0, 0, n, r)), i;
	}
	selectAtoms(e) {
		this.selections.selectAtoms(e, this.moleculeContainer);
	}
	setAtomLabels(e) {
		if (!Oa(e)) throw Error("atomLabels.show must be \"none\", \"all\", \"non-hydrogen\", or an array of label requests");
		this.options.atomLabels.show = e, this.atomLabelManager.setOptions(this.options.atomLabels), this.requestRender();
	}
	updateAtomLabelOptions(e) {
		ka(e);
		let t = Aa(e);
		this.options.atomLabels = {
			...this.options.atomLabels,
			...t,
			text: {
				...this.options.atomLabels.text,
				...t.text || {}
			}
		}, this.atomLabelManager.setOptions(this.options.atomLabels), this.requestRender();
	}
	clearAtomLabels() {
		this.setAtomLabels("none");
	}
	getAtomLabelLayout() {
		return this.atomLabelManager.layout;
	}
	dispose() {
		this.controls.dispose(), this.atomLabelManager.dispose(), this.scene.traverse((e) => {
			e.geometry && e.geometry.dispose(), e.material && (Array.isArray(e.material) ? e.material.forEach((e) => e.dispose()) : e.material.dispose());
		}), this.selections.dispose(), this.renderer.dispose(), this.renderer.domElement.parentNode && this.renderer.domElement.parentNode.removeChild(this.renderer.domElement), this.scene = null, this.camera = null, this.renderer = null, this.state = null, this.options = null;
	}
}, Na = {
	disorder: {
		all: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path4-5\" style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1\" d=\"m 28.684508,10.729386 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607593 2.6075482,2.6075482 0 0 0 1.079004,2.104776 l -2.987415,6.12935 a 2.6075482,2.6075482 0 0 0 -0.778764,-0.11938 2.6075482,2.6075482 0 0 0 -2.607592,2.6076 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -0.948262,-2.01125 l 3.013252,-6.18464 a 2.6075482,2.6075482 0 0 0 0.622185,0.08114 2.6075482,2.6075482 0 0 0 0.624251,-0.07648 l 3.01377,6.18308 a 2.6075482,2.6075482 0 0 0 -0.950847,2.00815 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.6076 2.6075482,2.6075482 0 0 0 -0.777214,0.12196 l -2.985347,-6.12727 A 2.6075482,2.6075482 0 0 0 31.2921,13.336979 2.6075482,2.6075482 0 0 0 28.684508,10.729386 Z\" /><path id=\"path8-7\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 23.328762,11.972721 a 2.6075482,2.6075482 0 0 0 -2.607592,2.607594 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 0.70435,-0.0987 l 1.051099,2.16473 0.556038,-1.14205 -0.720886,-1.4733 a 2.6075482,2.6075482 0 0 0 1.016992,-2.05827 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path8-0-5\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 33.918297,11.972721 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607594 2.6075482,2.6075482 0 0 0 1.0604,2.09083 l -0.673344,1.37666 0.556039,1.14205 1.014408,-2.08876 a 2.6075482,2.6075482 0 0 0 0.65009,0.08681 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path9-8\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 30.92003,19.636335 -1.539441,3.15433 a 2.6075482,2.6075482 0 0 0 -0.696081,-0.0956 2.6075482,2.6075482 0 0 0 -0.750342,0.1142 l -1.51412,-3.10265 -0.557071,1.13998 1.187007,2.43345 a 2.6075482,2.6075482 0 0 0 -0.973067,2.02261 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607592,-2.60759 2.6075482,2.6075482 0 0 0 -1.015958,-2.06447 l 1.20096,-2.46187 z\" /></g></svg>",
		group1of2: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><g id=\"g1\" transform=\"translate(-0.54705812,0.13474933)\"><path id=\"path4-5\" style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1\" d=\"m 29.231566,10.594637 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607593 2.6075482,2.6075482 0 0 0 1.079004,2.104776 l -2.987415,6.12935 a 2.6075482,2.6075482 0 0 0 -0.778764,-0.11938 2.6075482,2.6075482 0 0 0 -2.607592,2.6076 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -0.948262,-2.01125 l 3.013252,-6.18464 a 2.6075482,2.6075482 0 0 0 0.622185,0.08114 2.6075482,2.6075482 0 0 0 0.624251,-0.07648 l 3.01377,6.18308 a 2.6075482,2.6075482 0 0 0 -0.950847,2.00815 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.6076 2.6075482,2.6075482 0 0 0 -0.777214,0.12196 l -2.985347,-6.12727 a 2.6075482,2.6075482 0 0 0 1.075386,-2.109436 2.6075482,2.6075482 0 0 0 -2.607592,-2.607593 z\" /><path id=\"path8-7\" style=\"fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 23.87582,11.837972 a 2.6075482,2.6075482 0 0 0 -2.607592,2.607594 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 0.70435,-0.0987 l 1.051099,2.16473 0.556038,-1.14205 -0.720886,-1.4733 a 2.6075482,2.6075482 0 0 0 1.016992,-2.05827 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path8-0-5\" style=\"fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 34.465355,11.837972 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607594 2.6075482,2.6075482 0 0 0 1.0604,2.09083 l -0.673344,1.37666 0.556039,1.14205 1.014408,-2.08876 a 2.6075482,2.6075482 0 0 0 0.65009,0.08681 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path9-8\" style=\"fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 31.467088,19.501586 -1.539441,3.15433 a 2.6075482,2.6075482 0 0 0 -0.696081,-0.0956 2.6075482,2.6075482 0 0 0 -0.750342,0.1142 l -1.51412,-3.10265 -0.557071,1.13998 1.187007,2.43345 a 2.6075482,2.6075482 0 0 0 -0.973067,2.02261 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607592,-2.60759 2.6075482,2.6075482 0 0 0 -1.015958,-2.06447 l 1.20096,-2.46187 z\" /></g></g></svg>",
		group2of2: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path4-5\" style=\"color:#000000;fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1\" d=\"m 28.684508,10.729386 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607593 2.6075482,2.6075482 0 0 0 1.079004,2.104776 l -2.987415,6.12935 a 2.6075482,2.6075482 0 0 0 -0.778764,-0.11938 2.6075482,2.6075482 0 0 0 -2.607592,2.6076 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -0.948262,-2.01125 l 3.013252,-6.18464 a 2.6075482,2.6075482 0 0 0 0.622185,0.08114 2.6075482,2.6075482 0 0 0 0.624251,-0.07648 l 3.01377,6.18308 a 2.6075482,2.6075482 0 0 0 -0.950847,2.00815 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.6076 2.6075482,2.6075482 0 0 0 -0.777214,0.12196 l -2.985347,-6.12727 A 2.6075482,2.6075482 0 0 0 31.2921,13.336979 2.6075482,2.6075482 0 0 0 28.684508,10.729386 Z\" /><path id=\"path8-7\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 23.328762,11.972721 a 2.6075482,2.6075482 0 0 0 -2.607592,2.607594 2.6075482,2.6075482 0 0 0 2.607592,2.60759 2.6075482,2.6075482 0 0 0 0.70435,-0.0987 l 1.051099,2.16473 0.556038,-1.14205 -0.720886,-1.4733 a 2.6075482,2.6075482 0 0 0 1.016992,-2.05827 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path8-0-5\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 33.918297,11.972721 a 2.6075482,2.6075482 0 0 0 -2.607593,2.607594 2.6075482,2.6075482 0 0 0 1.0604,2.09083 l -0.673344,1.37666 0.556039,1.14205 1.014408,-2.08876 a 2.6075482,2.6075482 0 0 0 0.65009,0.08681 2.6075482,2.6075482 0 0 0 2.607593,-2.60759 2.6075482,2.6075482 0 0 0 -2.607593,-2.607594 z\" /><path id=\"path9-8\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0;stroke-dashoffset:0.0831496\" d=\"m 30.92003,19.636335 -1.539441,3.15433 a 2.6075482,2.6075482 0 0 0 -0.696081,-0.0956 2.6075482,2.6075482 0 0 0 -0.750342,0.1142 l -1.51412,-3.10265 -0.557071,1.13998 1.187007,2.43345 a 2.6075482,2.6075482 0 0 0 -0.973067,2.02261 2.6075482,2.6075482 0 0 0 2.607593,2.60759 2.6075482,2.6075482 0 0 0 2.607592,-2.60759 2.6075482,2.6075482 0 0 0 -1.015958,-2.06447 l 1.20096,-2.46187 z\" /></g></svg>"
	},
	hydrogen: {
		anisotropic: "<svg width=\"17.85038mm\" height=\"17.850386mm\" viewBox=\"0 0 17.85038 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-78.600695,-38.873141)\"><ellipse style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:1.8975;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1\" id=\"path7-4\" cx=\"37.167099\" cy=\"89.280861\" rx=\"4.8005486\" ry=\"9.1209068\" transform=\"matrix(0.82466981,-0.56561445,0.63703802,0.77083238,0,0)\" /><path id=\"path17-7-9\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.26484;-inkscape-stroke:none\" d=\"m 85.424476,44.723369 v 6.149929 h 1.191773 v -2.479079 h 1.819274 v 2.479079 h 1.191771 v -6.149929 h -1.191771 v 2.479077 h -1.819274 v -2.479077 z\" /></g></svg>",
		constant: "<svg width=\"17.850388mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850388 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-58.39314,-38.873141)\"><circle style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:2;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1\" id=\"path6-0\" cx=\"67.318336\" cy=\"47.798332\" r=\"6.8755083\" /><path id=\"path17-7-9\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.26484;-inkscape-stroke:none\" d=\"m 65.216925,44.723369 v 6.149929 h 1.191773 v -2.479079 h 1.819274 v 2.479079 h 1.191771 v -6.149929 h -1.191771 v 2.479077 h -1.819274 v -2.479077 z\" /></g></svg>",
		none: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-37.755639,-38.873141)\"><g id=\"g2\"><path style=\"fill:#000000;fill-opacity:1;stroke:#8f8f8f;stroke-width:2;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1\" d=\"m 39.917575,41.035079 13.526512,13.52651\" id=\"path5-9\" /><g id=\"g1\" style=\"stroke:#8f8f8f;stroke-opacity:1\"><path style=\"fill:#a4a4a4;fill-opacity:1;stroke:#8f8f8f;stroke-width:2;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1\" d=\"M 53.444087,41.035079 39.917575,54.561589\" id=\"path5-1-0\" /></g></g><path id=\"path17-7-9\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.26484;-inkscape-stroke:none\" d=\"m 44.579422,44.723369 v 6.149929 h 1.191773 v -2.479079 h 1.819274 v 2.479079 h 1.191771 v -6.149929 h -1.191771 v 2.479077 h -1.819274 v -2.479077 z\" /></g></svg>"
	},
	symmetry: {
		cell: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"rect1-7\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.885488;stroke-dasharray:none;stroke-dashoffset:0\" d=\"m 35.131826,13.806456 a 1.8058389,1.8058389 0 0 0 -1.722892,1.795239 1.8058389,1.8058389 0 0 0 0.747241,1.457276 l -2.068608,4.245219 a 1.8058389,1.8058389 0 0 0 -0.539502,-0.08268 1.8058389,1.8058389 0 0 0 -1.806091,1.805575 1.8058389,1.8058389 0 0 0 1.806091,1.806091 1.8058389,1.8058389 0 0 0 1.805575,-1.806091 1.8058389,1.8058389 0 0 0 -0.656291,-1.39268 l 2.086695,-4.282943 a 1.8058389,1.8058389 0 0 0 0.347782,0.04496 z\" /><path id=\"rect1-9\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.885488;stroke-dasharray:none;stroke-dashoffset:0\" d=\"m 25.7976,24.838373 a 1.8058389,1.8058389 0 0 1 -1.806091,-1.805574 1.8058389,1.8058389 0 0 1 0.656807,-1.393197 l -2.086694,-4.282943 a 1.8058389,1.8058389 0 0 1 -0.430982,0.05633 1.8058389,1.8058389 0 0 1 -0.04082,-0.0052 v -3.601331 a 1.8058389,1.8058389 0 0 1 0.04082,-0.0052 1.8058389,1.8058389 0 0 1 1.806092,1.805574 1.8058389,1.8058389 0 0 1 -0.747242,1.457792 l 2.068608,4.244703 a 1.8058389,1.8058389 0 0 1 0.539502,-0.08268 1.8058389,1.8058389 0 0 1 1.806091,1.806092 1.8058389,1.8058389 0 0 1 -1.806091,1.805574 z\" /><rect style=\"fill:none;stroke:#8f8f8f;stroke-width:0.885488;stroke-dasharray:none;stroke-dashoffset:0\" id=\"rect1\" width=\"13.310269\" height=\"14.213681\" x=\"21.998884\" y=\"12.212976\" /></g></svg>",
		"fragment-cell": "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path4-5\" style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1\" d=\"m 28.654018,14.073019 a 1.8049188,1.8049188 0 0 0 -1.804949,1.80495 1.8049188,1.8049188 0 0 0 0.746876,1.456905 l -2.06786,4.242674 a 1.8049188,1.8049188 0 0 0 -0.539052,-0.08263 1.8049188,1.8049188 0 0 0 -1.804949,1.804955 1.8049188,1.8049188 0 0 0 1.804949,1.804948 1.8049188,1.8049188 0 0 0 1.80495,-1.804948 1.8049188,1.8049188 0 0 0 -0.656378,-1.392167 l 2.085743,-4.280946 a 1.8049188,1.8049188 0 0 0 0.43067,0.05617 1.8049188,1.8049188 0 0 0 0.432101,-0.05294 l 2.086101,4.279867 a 1.8049188,1.8049188 0 0 0 -0.658167,1.390021 1.8049188,1.8049188 0 0 0 1.80495,1.804948 1.8049188,1.8049188 0 0 0 1.80495,-1.804948 1.8049188,1.8049188 0 0 0 -1.80495,-1.804955 1.8049188,1.8049188 0 0 0 -0.53798,0.08442 l -2.066427,-4.24125 a 1.8049188,1.8049188 0 0 0 0.744372,-1.460131 1.8049188,1.8049188 0 0 0 -1.80495,-1.80495 z\" /><path style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:0.885;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1\" d=\"m 23.00627,12.221089 5.667627,-0.01522 -0.0024,14.228985 h -5.665232\" id=\"path5\" /><path style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:0.885;stroke-dasharray:0.885, 0.4425;stroke-dashoffset:0;stroke-opacity:1\" d=\"m 37.066846,26.434854 h -7.9624\" id=\"path6-6\" /><path style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:0.885;stroke-dasharray:0.885, 0.4425;stroke-dashoffset:0;stroke-opacity:1\" d=\"m 37.066846,12.204679 h -7.9624\" id=\"path6-6-6\" /><path style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:0.885002;stroke-dasharray:0.885002, 0.4425;stroke-dashoffset:0;stroke-opacity:1\" d=\"m 20.351046,12.20468 h 2.652477\" id=\"path6-1\" /><path style=\"fill:none;fill-opacity:1;stroke:#8f8f8f;stroke-width:0.885002;stroke-dasharray:0.885002, 0.4425;stroke-dashoffset:0;stroke-opacity:1\" d=\"m 20.351046,26.434853 h 2.652477\" id=\"path6-1-4\" /></g></svg>",
		"fragment-hbonds": "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path19\" style=\"color:#000000;fill:#000000;fill-opacity:1;stroke-width:0.999849;stroke-dashoffset:0.022;-inkscape-stroke:none\" d=\"m 25.466978,23.91462 v 0.898 h 0.900067 v -0.898 z m 1.800134,0 v 0.898 h 0.898517 v -0.898 z m 1.828036,0 v 0.898 h 0.900067 v -0.898 z m 1.800651,0 v 0.898 h 0.898 v -0.898 z m 1.800134,0 v 0.898 h 0.806547 v -0.898 z\" /><circle style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999\" id=\"path1-7-53-8\" cx=\"33.972233\" cy=\"24.363619\" r=\"2.3135188\" /><path id=\"path17\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.421606;-inkscape-stroke:none\" d=\"m 23.896835,13.771838 v 0.898 h 9.514368 v -0.898 z\" /><circle style=\"fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none\" id=\"path1-7-59\" cx=\"23.335806\" cy=\"14.220837\" r=\"2.3135188\" /><circle style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999\" id=\"path1-7-7-5\" cx=\"33.972233\" cy=\"14.220837\" r=\"2.3135188\" /><g id=\"path7-2\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1\" transform=\"matrix(1,0,0,0.15009676,0,9.2641086)\"><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path11-3\" /><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"m 28.353516,10.933594 v 16.828125 h 0.599609 V 10.933594 Z\" id=\"path15-3\" /></g><path id=\"path17-7\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.199128;-inkscape-stroke:none\" d=\"m 21.755799,22.051616 v 4.624007 h 0.89607 v -1.863969 h 1.367875 v 1.863969 h 0.896069 v -4.624007 h -0.896069 v 1.863968 h -1.367875 v -1.863968 z\" /><g id=\"path7-9\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1\" transform=\"matrix(1,0,0,0.51054368,0,9.4452649)\"><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path11\" /><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"m 28.353516,10.933594 v 16.828125 h 0.599609 V 10.933594 Z\" id=\"path15\" /></g><g id=\"path7-9-3\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1\" transform=\"matrix(1,0,0,0.15604158,0,23.402517)\"><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path11-7\" /><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"m 28.353516,10.933594 v 16.828125 h 0.599609 V 10.933594 Z\" id=\"path15-9\" /></g></g></svg>",
		fragment: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><g id=\"g1\" transform=\"translate(20.608042,9.8427536)\"><path id=\"path17-4\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.4;-inkscape-stroke:none\" d=\"m 3.245596,9.0762805 v 0.800985 h 9.601481 v -0.800985 z\" /><circle style=\"fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none\" id=\"path1-7-8\" cx=\"2.7277639\" cy=\"9.4770622\" r=\"2.3135188\" /><circle style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999\" id=\"path1-7-7-2\" cx=\"13.364189\" cy=\"9.4770622\" r=\"2.3135188\" /></g><g id=\"g2\" transform=\"translate(-1.2072753e-7,-0.02758705)\"><g id=\"path7-7-3\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1\" transform=\"matrix(1,0,0,0.45417979,6.985e-4,15.153145)\"><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path11-9-2\" /><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"m 28.353516,10.933594 v 16.828125 h 0.599609 V 10.933594 Z\" id=\"path15-6-5\" /></g><g id=\"path7-7-3-7\" style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1\" transform=\"matrix(1,0,0,0.45140061,6.985e-4,5.9976457)\"><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path11-9-2-1\" /><path style=\"color:#000000;fill:#000000;fill-opacity:1;stroke:none;stroke-opacity:1;-inkscape-stroke:none\" d=\"m 28.353516,10.933594 v 16.828125 h 0.599609 V 10.933594 Z\" id=\"path15-6-5-6\" /></g></g></g></svg>",
		hbonds: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path19\" style=\"color:#000000;fill:#000000;stroke-width:0.999849;stroke-dashoffset:0.022;-inkscape-stroke:none;fill-opacity:1\" d=\"m 25.466978,18.844554 v 0.898 h 0.900067 v -0.898 z m 1.800134,0 v 0.898 h 0.898517 v -0.898 z m 1.828036,0 v 0.898 h 0.900067 v -0.898 z m 1.800651,0 v 0.898 h 0.898 v -0.898 z m 1.800134,0 v 0.898 h 0.806547 v -0.898 z\" /><circle style=\"fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999\" id=\"path1-7-53-2\" cx=\"33.972233\" cy=\"19.293554\" r=\"2.3135188\" /><path id=\"path17-7\" style=\"color:#000000;fill:#000000;stroke:none;stroke-width:0.199128;-inkscape-stroke:none\" d=\"m 21.755799,16.98155 v 4.624007 h 0.89607 v -1.863969 h 1.367875 v 1.863969 h 0.896069 V 16.98155 h -0.896069 v 1.863968 H 22.651869 V 16.98155 Z\" /><path style=\"fill:#000000;stroke:#000000;stroke-width:0.600002;stroke-dasharray:none\" d=\"m 28.654019,20.03939 v 7.695178\" id=\"path7-6\" /><path style=\"fill:#000000;stroke:#000000;stroke-width:0.600002;stroke-dasharray:none\" d=\"m 28.654018,10.905064 v 7.643502\" id=\"path7-6-2\" /></g></svg>",
		none: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\" /><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><path id=\"path17-0\" style=\"color:#000000;fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0.421606;-inkscape-stroke:none\" d=\"m 23.896827,18.870815 v 0.898 h 9.51437 v -0.898 z\" /><circle style=\"fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none\" id=\"path1-7-1\" cx=\"23.335804\" cy=\"19.319817\" r=\"2.3135188\" /><circle style=\"fill:#8f8f8f;fill-opacity:1;stroke:none;stroke-width:0.564999\" id=\"path1-7-7-8\" cx=\"33.972233\" cy=\"19.319817\" r=\"2.3135188\" /><path style=\"fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none\" d=\"M 28.654019,10.932651 V 27.762155\" id=\"path7\" /></g></svg>"
	},
	upload: "<svg width=\"17.850384mm\" height=\"17.850386mm\" viewBox=\"0 0 17.850384 17.850386\" version=\"1.1\" id=\"svg1\" (0e150ed6c4, 2023-07-21)\"xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\"><id=\"namedview1\" pagecolor=\"#ffffff\" bordercolor=\"#000000\" borderopacity=\"0.25\" showguides=\"false\" /><defs id=\"defs1\"><marker style=\"overflow:visible\" id=\"ArrowWide\" refX=\"0\" refY=\"0\" orient=\"auto-start-reverse\" arrow\" markerWidth=\"1\" markerHeight=\"1\" viewBox=\"0 0 1 1\" preserveAspectRatio=\"xMidYMid\"><path style=\"fill:none;stroke:context-stroke;stroke-width:1;stroke-linecap:butt\" d=\"M 3,-3 0,0 3,3\" transform=\"rotate(180,0.125,0)\" id=\"path1\" /></marker></defs><g 1\" id=\"layer1\" transform=\"translate(-19.728827,-10.394623)\"><text xml:space=\"preserve\" style=\"font-size:7.05556px;fill:#e6e6e6;stroke:none;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none\" x=\"22.242813\" y=\"28.151989\" id=\"text2\"><tspan id=\"tspan2\" style=\"font-size:7.05556px;fill:#1a1a1a;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none\" x=\"22.242813\" y=\"28.151989\">CIF</tspan></text><path style=\"fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1\" d=\"m 20.714121,18.107197 v 3.07807 h 15.879794 v -3.07807\" id=\"path2\" /><path style=\"fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1;marker-end:url(#ArrowWide)\" d=\"M 28.654018,19.170064 V 11.045456\" id=\"path3\" /></g></svg>"
}, Pa = "\n  cifview-widget {\n    display: flex;\n    flex-direction: column;\n    font-family: system-ui, -apple-system, sans-serif;\n    height: 100%;\n    position: relative;\n    background: var(--cifvis-bg, #fafafa);\n    border-radius: var(--cifvis-radius, 8px);\n    overflow: hidden;\n  }\n\n  cifview-widget .crystal-container {\n    flex: 1;\n    min-height: 0;\n    position: relative;\n  }\n\n  cifview-widget .crystal-caption {\n    padding: 12px 16px;\n    background: var(--cifvis-caption-bg, #ffffff);\n    border-top: 1px solid var(--cifvis-caption-border, #eaeaea);\n    color: var(--cifvis-caption-color, #333);\n    font-size: 14px;\n    line-height: 1.5;\n  }\n\n  cifview-widget .button-container {\n    position: absolute;\n    top: 16px;\n    right: 16px;\n    display: flex;\n    gap: 8px;\n    z-index: 1000;\n  }\n\n  cifview-widget .control-button {\n    width: 40px;\n    height: 40px;\n    border: none;\n    border-radius: var(--cifvis-button-radius, 8px);\n    background: var(--cifvis-button-bg, rgba(255, 255, 255, 0.9));\n    cursor: pointer;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 8px;\n    transition: all 0.2s ease;\n    box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n  }\n\n  cifview-widget .control-button:hover {\n    background: var(--cifvis-button-hover-bg, #ffffff);\n    box-shadow: 0 4px 8px rgba(0,0,0,0.15);\n  }\n\n  cifview-widget .control-button svg {\n    width: 24px;\n    height: 24px;\n  }\n", Fa = class extends HTMLElement {
	static get observedAttributes() {
		return [
			"caption",
			"src",
			"data",
			"icons",
			"filtered-atoms",
			"options",
			"hydrogen-mode",
			"disorder-mode",
			"symmetry-mode",
			"block",
			"atom-labels"
		];
	}
	constructor() {
		if (super(), !document.getElementById("cifview-styles")) {
			let e = document.createElement("style");
			e.id = "cifview-styles", e.textContent = Pa, document.head.appendChild(e);
		}
		this.viewer = null, this.baseCaption = "", this.selections = [], this.customIcons = null, this.userOptions = {}, this.defaultCaption = "Generated with <a href=\"https://github.com/Niolon/cifvis\">CifVis</a>.";
	}
	get icons() {
		return {
			...Na,
			...this.customIcons
		};
	}
	async connectedCallback() {
		this.baseCaption = this.getAttribute("caption") || this.defaultCaption, this.parseOptions(), this.parseInitialModes(), this.parseInitialAtomLabels();
		let e = document.createElement("div");
		e.className = "crystal-container", this.appendChild(e);
		let t = document.createElement("div");
		t.className = "button-container", e.appendChild(t), this.buttonContainer = t;
		let n = document.createElement("div");
		n.className = "crystal-caption", n.innerHTML = this.baseCaption, this.appendChild(n), this.captionElement = n, this.viewer = new Ma(e, this.userOptions), this.viewer.selections.onChange((e) => {
			this.selections = e, this.updateCaption();
		}), this.customIcons = this.parseCustomIcons(), await this.updateFilteredAtoms();
		let r = this.getAttribute("src"), i = this.getAttribute("data"), a = this.resolveBlockSelector(this.getAttribute("block"));
		r ? await this.loadFromUrl(r, a) : i && await this.loadFromString(i, a);
	}
	resolveBlockSelector(e) {
		return e ? /^\d+$/.test(e) ? Number(e) : e : 0;
	}
	parseOptions() {
		let e = this.getAttribute("options");
		if (e) try {
			let t = JSON.parse(e);
			this.userOptions = this.mergeOptions(t);
		} catch (e) {
			console.warn("Failed to parse options:", e);
		}
	}
	mergeOptions(e) {
		let t = { ...W };
		return Object.keys(e).forEach((n) => {
			n === "elementProperties" ? (t.elementProperties = { ...t.elementProperties }, Object.keys(e.elementProperties || {}).forEach((n) => {
				t.elementProperties[n] = {
					...t.elementProperties[n] || {},
					...e.elementProperties[n]
				};
			})) : typeof e[n] == "object" && e[n] !== null ? t[n] = {
				...t[n] || {},
				...e[n]
			} : t[n] = e[n];
		}), t;
	}
	parseInitialModes() {
		let e = this.getAttribute("hydrogen-mode"), t = this.getAttribute("disorder-mode"), n = this.getAttribute("symmetry-mode");
		e && (this.userOptions.hydrogenMode = e), t && (this.userOptions.disorderMode = t), n && (this.userOptions.symmetryMode = n);
	}
	parseInitialAtomLabels() {
		let e = this.getAttribute("atom-labels");
		if (!e) return;
		let t = e;
		if (![
			"all",
			"none",
			"non-hydrogen"
		].includes(e)) try {
			t = JSON.parse(e);
		} catch (e) {
			console.warn("Failed to parse atom-labels:", e);
			return;
		}
		this.userOptions.atomLabels = {
			...this.userOptions.atomLabels || W.atomLabels,
			show: t
		};
	}
	clearButtons() {
		if (this.buttonContainer) for (; this.buttonContainer.firstChild;) this.buttonContainer.removeChild(this.buttonContainer.firstChild);
	}
	setupButtons() {
		!this.viewer || !this.viewer.state.baseStructure || (this.clearButtons(), this.viewer.numberModifierModes("hydrogen") > 1 && this.addButton(this.buttonContainer, "hydrogen", "Toggle Hydrogen Display"), this.viewer.numberModifierModes("disorder") > 2 && this.addButton(this.buttonContainer, "disorder", "Toggle Disorder Display"), this.viewer.numberModifierModes("symmetry") > 1 && this.addButton(this.buttonContainer, "symmetry", "Toggle Symmetry Display"));
	}
	parseCustomIcons() {
		try {
			let e;
			try {
				e = JSON.parse(this.getAttribute("icons"));
			} catch {
				throw Error("Failed to parse custom icon definition. Needs to be valid JSON.");
			}
			if (!e) return null;
			let t = Object.getOwnPropertyNames(e), n = Object.getOwnPropertyNames(this.viewer.modifiers), r = t.filter((e) => !n.includes(e));
			if (r.length > 0) throw Error(`One or more invalid categories for custom icons: ${r.join(", ")}. Valid categories: ${n.join(", ")}`);
			let i = {}, a = [];
			for (let n of t) {
				i[n] = {};
				let r = Object.values(this.viewer.modifiers[n].MODES);
				Object.getOwnPropertyNames(e[t]).forEach((t) => {
					r.includes(t) ? i[n][t] = e[n][t] : a.push([n, t]);
				});
			}
			if (a.length > 0) {
				let e = a.map(([e, t]) => `${e}: ${t}`).join(" ,");
				throw Error(`The following custom icons do not map to a valid mode: ${e}`);
			}
			return i;
		} catch (e) {
			return console.warn("Failed to parse custom icons:", e), null;
		}
	}
	async updateFilteredAtoms() {
		let e = this.getAttribute("filtered-atoms");
		this.viewer.modifiers.removeatoms.setFilteredLabels(e || ""), e && e.trim() ? this.viewer.modifiers.removeatoms.mode = "on" : this.viewer.modifiers.removeatoms.mode = "off", this.setupButtons();
	}
	addButton(e, t, n) {
		let r = document.createElement("button");
		r.className = `control-button ${t}-button`, r.title = n, this.renderButtonIcon(r, t, this.viewer.modifiers[t].mode, n), e.appendChild(r), r.addEventListener("click", async () => {
			let e = await this.viewer.cycleModifierMode(t);
			e.success && this.renderButtonIcon(r, t, e.mode, n);
		});
	}
	renderButtonIcon(e, t, n, r) {
		e.innerHTML = this.getIcon(t, n);
		let i = e.querySelector("svg");
		i && (i.setAttribute("alt", r), i.setAttribute("role", "img"), i.setAttribute("aria-label", r));
	}
	getIcon(e, t) {
		return e === "disorder" ? dr(this.icons.disorder, t) : this.icons[e]?.[t] || "";
	}
	async attributeChangedCallback(e, t, n) {
		if (this.viewer) switch (e) {
			case "caption":
				this.baseCaption = n && n === "" ? this.defaultCaption : n, this.updateCaption();
				break;
			case "src":
				n && await this.loadFromUrl(n, this.resolveBlockSelector(this.getAttribute("block")));
				break;
			case "data":
				n && await this.loadFromString(n, this.resolveBlockSelector(this.getAttribute("block")));
				break;
			case "icons":
				this.customIcons = this.parseCustomIcons();
				break;
			case "filtered-atoms":
				await this.updateFilteredAtoms(), await this.viewer.loadStructure();
				break;
			case "atom-labels":
				if (n === null || n === "") this.viewer.clearAtomLabels();
				else if ([
					"all",
					"none",
					"non-hydrogen"
				].includes(n)) this.viewer.setAtomLabels(n);
				else try {
					this.viewer.setAtomLabels(JSON.parse(n));
				} catch (e) {
					console.warn("Failed to parse atom-labels:", e);
				}
				break;
			case "options":
				if (this.parseOptions(), this.parseInitialAtomLabels(), this.viewer) {
					let e = this.querySelector(".crystal-container"), t = this.viewer.state.currentCifContent, n = this.viewer.state.currentCifBlock;
					this.viewer.dispose(), this.viewer = new Ma(e, this.userOptions), this.viewer.selections.onChange((e) => {
						this.selections = e, this.updateCaption();
					}), t && (await this.viewer.loadCIF(t, n ?? 0), this.setupButtons());
				}
				break;
			case "block": {
				let e = this.viewer.state.currentCifContent;
				if (e) {
					this.resetLoadState();
					let t = await this.viewer.loadCIF(e, this.resolveBlockSelector(n));
					t.success ? this.setupButtons() : this.createErrorDiv(Error(t.error));
				}
				break;
			}
			case "hydrogen-mode":
				this.viewer.modifiers.hydrogen && (this.viewer.modifiers.hydrogen.mode = n, await this.viewer.updateStructure(), this.setupButtons());
				break;
			case "disorder-mode":
				this.viewer.modifiers.disorder && (this.viewer.modifiers.disorder.mode = n, await this.viewer.updateStructure(), this.setupButtons());
				break;
			case "symmetry-mode":
				this.viewer.modifiers.symmetry && (this.viewer.modifiers.symmetry.mode = n, await this.viewer.loadStructure(), this.setupButtons());
				break;
		}
	}
	resetLoadState() {
		this.clearErrorDiv(), this.baseCaption = this.getAttribute("caption") || this.defaultCaption, this.updateCaption();
	}
	async loadFromUrl(e, t = 0) {
		this.resetLoadState();
		try {
			let n = await fetch(e);
			if (!n.ok) throw Error(`Failed to load CIF file: ${n.status} ${n.statusText}`);
			let r = n.headers.get("content-type");
			if (r && r.includes("text/html")) throw Error("Received no or invalid content for src.");
			let i = await n.text();
			if (i.includes("<!DOCTYPE html>") || i.includes("<html>")) throw Error("Received no or invalid content for src.");
			let a = await this.viewer.loadCIF(i, t);
			if (a.success) this.setupButtons();
			else throw Error(a.error || "Unknown Error");
		} catch (e) {
			this.createErrorDiv(e);
		}
	}
	async loadFromString(e, t = 0) {
		this.resetLoadState();
		try {
			let n = await this.viewer.loadCIF(e, t);
			if (n.success) this.setupButtons();
			else throw Error(n.error || "Unknown Error");
		} catch (e) {
			this.createErrorDiv(e);
		}
	}
	createErrorDiv(e) {
		console.error("Error loading structure:", e);
		let t = this.sanitizeHTML(e.message);
		if (this.baseCaption = `Error loading structure: ${t}`, this.updateCaption(), this.viewer) {
			let e = this.querySelector(".crystal-container");
			if (e) {
				this.clearErrorDiv();
				let n = document.createElement("div");
				n.style.position = "absolute", n.style.inset = "0", n.style.zIndex = "2000", n.style.display = "flex", n.style.justifyContent = "center", n.style.alignItems = "center", n.style.height = "100%", n.style.padding = "20px", n.style.textAlign = "center", n.style.color = "#d32f2f", n.style.background = "#fafafa";
				let r = document.createElement("div"), i = document.createElement("h3");
				i.textContent = "Error Loading Structure", r.appendChild(i);
				let a = document.createElement("p");
				a.textContent = t, r.appendChild(a);
				let o = document.createElement("p");
				o.textContent = "Please check that the file exists and is a valid CIF file.", r.appendChild(o), n.appendChild(r), e.appendChild(n), this.errorDiv = n;
			}
		}
	}
	clearErrorDiv() {
		this.errorDiv &&= (this.errorDiv.remove(), null);
	}
	sanitizeHTML(e) {
		return e ? String(e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
	}
	updateCaption() {
		let e = this.baseCaption;
		if (this.selections.length > 0) {
			e.endsWith(".") || (e += "."), e += " Selected Atoms and Bonds: ";
			let t = this.selections.map((e) => {
				let t = "#" + e.color.toString(16).padStart(6, "0"), n = "";
				if (e.type === "atom") n = `${e.data.label} (${e.data.atomType})`;
				else if (e.type === "bond") {
					let t = St(e.data.bondLength, e.data.bondLengthSU);
					n = `${e.data.atom1Label}-${e.data.atom2Label}: ${t} Å`;
				} else e.type === "hbond" && (n = `${e.data.donorAtomLabel}→${e.data.acceptorAtomLabel}`);
				return `<span style="color:${t}">${n}</span>`;
			}).join(", ");
			e += t + ".";
		}
		this.captionElement.innerHTML = e, this.viewer.controls.handleResize();
	}
	disconnectedCallback() {
		this.viewer && this.viewer.dispose();
	}
};
//#endregion
//#region src/index.js
if (typeof window < "u" && window.customElements) try {
	window.customElements.define("cifview-widget", Fa);
} catch (e) {
	e.message.includes("already been defined") || console.warn("Failed to register cifview-widget:", e);
}
//#endregion
export { $r as AtomLabelFilter, ei as BondGenerator, j as CIF, Fa as CifViewWidget, U as CrystalStructure, Ma as CrystalViewer, Ke as DEFAULT_DIFFERENCE_DENSITY_OPTIONS, rr as DifferenceDensityMap, Zr as DisorderFilter, Xr as HydrogenFilter, st as ORTEP3JsStructure, Qr as SymmetryGrower, nr as calculateDifferenceDensityMap, un as calculateIAMStructureFactors, Jn as createCifDifferenceDensityDataset, ln as createIAMStructureFactorCalculator, Qt as evaluateCromerMann, St as formatValueEsd, fr as generateDisorderGroupIcon, dr as getDisorderIcon, Dn as isSystematicAbsence, Wt as lookupAnomalousDispersion, Zt as lookupCromerMann, On as mergeReflectionIntensities, Xn as parseDifferenceDensitySource, kn as readReflectionIntensities, ur as tryToFixCifBlock };
