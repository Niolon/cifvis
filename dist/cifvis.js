import * as e from "three";
import { BufferAttribute as t, BufferGeometry as n } from "three";
//#region src/lib/read-cif/helpers.js
function r(e, t = !0, n = 1) {
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
function i(e, t) {
	let n = [e[t].slice(1)], r = e.slice(t + 1), i = r.findIndex((e) => e.startsWith(";")), a = n.concat(r.slice(0, i)), o = a.findIndex((e) => e.trim() !== ""), s = a.findLastIndex((e) => e.trim !== "");
	return {
		value: a.slice(o, s + 1).join("\n"),
		endIndex: t + i + 1
	};
}
//#endregion
//#region src/lib/read-cif/cif2-values.js
function a(e, t, n) {
	let i = e[t];
	if (!i) throw Error("Unexpected end of CIF2 value stream");
	switch (i.type) {
		case "value": {
			if (i.quoted) return {
				value: i.value,
				su: NaN,
				nextPos: t + 1
			};
			let e = r(i.value, n, 2);
			return {
				value: e.value,
				su: e.su,
				nextPos: t + 1
			};
		}
		case "listOpen": return o(e, t, n);
		case "tableOpen": return s(e, t, n);
		default: throw Error(`Unexpected token '${i.type}' where a CIF2 value was expected`);
	}
}
function o(e, t, n) {
	let r = [], i = t + 1;
	for (; e[i] && e[i].type !== "listClose";) {
		let t = a(e, i, n);
		r.push(t.value), i = t.nextPos;
	}
	if (!e[i]) throw Error("Unterminated CIF2 list value");
	return {
		value: r,
		su: NaN,
		nextPos: i + 1
	};
}
function s(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = t + 1;
	for (; e[i] && e[i].type !== "tableClose";) {
		let t = e[i];
		if (t.type !== "value") throw Error("CIF2 table key must be a quoted string");
		if (!e[i + 1] || e[i + 1].type !== "colon") throw Error(`CIF2 table entry for key '${t.value}' is missing its colon`);
		let o = a(e, i + 2, n);
		r.set(t.value, o.value), i = o.nextPos;
	}
	if (!e[i]) throw Error("Unterminated CIF2 table value");
	return {
		value: r,
		su: NaN,
		nextPos: i + 1
	};
}
function c(e, t) {
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
var l = /* @__PURE__ */ "_space_group_symop_ssg._space_group_symop._symmetry_equiv._geom_bond._geom_hbond._geom_angle._geom_torsion._diffrn_refln._refln._atom_site_fourier_wave_vector._atom_site_moment_fourier_param._atom_site_moment_special_func._atom_site_moment._atom_site_rotation._atom_site_displace_Fourier._atom_site_displace_special_func._atom_site_occ_Fourier._atom_site_occ_special_func._atom_site_phason._atom_site_rot_Fourier_param._atom_site_rot_Fourier._atom_site_rot_special_func._atom_site_U_Fourier._atom_site_anharm_gc_c._atom_site_anharm_gc_d._atom_site_aniso._atom_site".split("."), u = class e {
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
				let t = i(this.dataLines, n);
				e.push({
					value: t.value,
					su: NaN
				});
				for (let e = n; e < t.endIndex + 1; e++) this.dataLines[e] = "";
				return e;
			}
			let a = Array.from(t.matchAll(/'([^']*(?:'\S[^']*)*)'|"([^"]*(?:"\S[^"]*)*)"|\S+/g));
			return e.concat(a.map((e) => r(e[1] || e[2] || e[0], this.splitSU)));
		}, []) : this._cif2CellTokenRanges.map(([e]) => {
			let t = a(this._cif2Tokens, e, this.splitSU);
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
			for (let e of l) if (this.headerLines.filter((t) => t.toLowerCase().startsWith(e.toLowerCase())).length >= this.headerLines.length / 2) return e;
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
function d(e) {
	return e && typeof e.getHeaders == "function";
}
function f(e) {
	return e.getHeaders()[0].split("_").filter((e) => e.length > 0);
}
function p(e, t, n) {
	let r = d(e) ? e : t, i = n.split("_").filter((e) => e.length > 0), a = f(r), o = "_" + i.join("_") + "_" + a[i.length];
	return d(e) ? [o, n] : [n, o];
}
function m(e, t) {
	let n = e.findCommonStart(!1), r = t.findCommonStart(!1);
	return n.length === r.length ? null : [n, r];
}
function h(e, t, n) {
	let r = n.split("_").filter((e) => e.length > 0), i = f(e), a = f(t);
	return i.length >= a.length ? [n + "_" + i[r.length], n] : [n, n + "_" + a[r.length]];
}
function g(e, t, n) {
	let r;
	r = !d(e) || !d(t) ? p(e, t, n) : m(e, t) || h(e, t, n);
	let i = [e, t];
	return i.forEach((e, t) => {
		d(e) && (e.name = r[t]);
	}), {
		newNames: r,
		newEntries: i
	};
}
//#endregion
//#region src/lib/read-cif/version.js
function _(e) {
	return e.charCodeAt(0) === 65279 ? e.slice(1) : e;
}
function v(e) {
	let t = _(e);
	return /^#\\#CIF_2\.0/.test(t) ? 2 : 1;
}
//#endregion
//#region src/lib/read-cif/tokenizer.js
var y = /* @__PURE__ */ new Set([
	" ",
	"	",
	"\r",
	"\n"
]), b = /* @__PURE__ */ new Set([
	"[",
	"]",
	"{",
	"}"
]);
function x(e, t, n, r) {
	if (e[t + 1] === n && e[t + 2] === n) {
		let i = n + n + n, a = e.indexOf(i, t + 3);
		if (a === -1) throw Error(`Unterminated triple-quoted string starting on line ${r}`);
		let o = e.slice(t + 3, a);
		return {
			value: o,
			next: a + 3,
			newlines: C(o)
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
function S(e, t, n) {
	let r = e.indexOf("\n;", t);
	if (r === -1) throw Error(`Unterminated text field starting on line ${n}`);
	let i = e.slice(t + 1, r);
	return i.startsWith("\n") && (i = i.slice(1)), {
		value: i,
		next: r + 2,
		newlines: C(e.slice(t, r + 2))
	};
}
function C(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] === "\n" && t++;
	return t;
}
function w(e, t) {
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
function ee(e) {
	let t = e.replace(/\r\n?/g, "\n"), n = [], r = t.length, i = 0, a = 1, o = !0;
	for (; i < r;) {
		let e = t[i];
		if (e === "\n") {
			i++, a++, o = !0;
			continue;
		}
		if (y.has(e)) {
			i++, o = !1;
			continue;
		}
		if (e === "#") {
			for (; i < r && t[i] !== "\n";) i++;
			continue;
		}
		if (e === ";" && o) {
			let e = S(t, i, a);
			n.push({
				type: "value",
				value: e.value,
				quoted: !0,
				line: a
			}), i = e.next, a += e.newlines, o = !1;
			continue;
		}
		if (b.has(e)) {
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
			let r = x(t, i, e, a);
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
		for (; i < r && !y.has(t[i]) && !b.has(t[i]);) i++;
		n.push(w(t.slice(s, i), a)), o = !1;
	}
	return n;
}
//#endregion
//#region src/lib/read-cif/base.js
function te(e) {
	let t = [], n = null, r = 0;
	for (let i of e) i.type === "listOpen" || i.type === "tableOpen" ? r++ : (i.type === "listClose" || i.type === "tableClose") && r--, i.type === "data" && r === 0 ? (n = [i], t.push(n)) : n && n.push(i);
	return t;
}
var ne = class {
	constructor(e, t = !0) {
		this.splitSU = t;
		let n = _(e);
		this.version = v(n), this.rawCifBlocks = this.version === 2 ? te(ee(n)) : this.splitCifBlocks("\n\n" + n), this.blocks = Array(this.rawCifBlocks.length).fill(null), this._blockNameMap = null;
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
		return this.blocks[e] || (this.blocks[e] = new T(this.rawCifBlocks[e], this.splitSU, this.version)), this.blocks[e];
	}
	getAllBlocks() {
		for (let e = 0; e < this.blocks.length; e++) this.blocks[e] || (this.blocks[e] = new T(this.rawCifBlocks[e], this.splitSU, this.version));
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
}, T = class {
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
				let n = i(e, t + 1);
				this.data[e[t]] = n.value, t = n.endIndex + 1;
				continue;
			}
			if (e[t].trim().startsWith("loop_")) {
				let n = u.fromLines(e.slice(t), this.splitSU);
				if (!Object.prototype.hasOwnProperty.call(this.data, n.getName())) this.data[n.getName()] = n;
				else {
					let e = g(this.data[n.getName()], n, n.getName());
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
			let a = n.match(/^(_\S+)\s+(.*)$/);
			if (a) {
				let e = a[1], t = r(a[2], this.splitSU);
				this.data[e] = t.value, isNaN(t.su) || (this.data[e + "_su"] = t.su);
			} else if (n.startsWith("_") && !e[t + 1].startsWith("_")) {
				let i = n, a = r(e[t + 1].trim(), this.splitSU);
				this.data[i] = a.value, isNaN(a.su) || (this.data[i + "_su"] = a.su), t++;
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
				let n = a(e, t + 1, this.splitSU);
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
			n = c(e, n), i.push([t, n]);
		}
		let a = u.fromTokens(r, e, i, this.splitSU);
		if (!Object.prototype.hasOwnProperty.call(this.data, a.getName())) this.data[a.getName()] = a;
		else {
			let e = g(this.data[a.getName()], a, a.getName());
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
}, E = class e {
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
function D(e) {
	return e instanceof E ? D(e.toArray()) : Array.isArray(e) ? e.map(D) : e;
}
function O(e, t) {
	return e.some((e) => e instanceof E) ? new E(t) : t;
}
function k(e, t, n) {
	return Array.isArray(e) && Array.isArray(t) ? e.map((e, r) => k(e, t[r], n)) : n(e, t);
}
function A(e) {
	return new E(D(e));
}
function j(e, t) {
	let n = D(e), r = D(t), i;
	if (typeof r == "number") i = Array.isArray(n[0]) ? n.map((e) => e.map((e) => e * r)) : n.map((e) => e * r);
	else if (typeof n == "number") i = Array.isArray(r[0]) ? r.map((e) => e.map((e) => e * n)) : r.map((e) => e * n);
	else if (Array.isArray(n[0]) && Array.isArray(r[0])) i = n.map((e, t) => e.map((i, a) => e.reduce((e, i, o) => e + n[t][o] * r[o][a], 0)));
	else if (Array.isArray(n[0])) i = n.map((e) => e.reduce((e, t, n) => e + t * r[n], 0));
	else throw Error("multiply: unsupported operand shapes");
	return O([e, t], i);
}
function M(e, t) {
	return O([e, t], k(D(e), D(t), (e, t) => e + t));
}
function N(e, t) {
	return O([e, t], k(D(e), D(t), (e, t) => e - t));
}
function P(e) {
	let t = D(e), n = t[0].map((e, n) => t.map((e) => e[n]));
	return O([e], n);
}
function re(e) {
	let t = D(e);
	if (t.length !== 3) throw Error("det: only 3x3 matrices are supported");
	return t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0]) + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0]);
}
function ie(e) {
	let t = D(e);
	if (t.length !== 3) throw Error("inv: only 3x3 matrices are supported");
	let n = re(t);
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
	return O([e], i);
}
function ae(e) {
	let t = D(e), n = t.length, r = Array.from({ length: n }, (e, r) => Array.from({ length: n }, (e, n) => r === n ? t[r] : 0));
	return O([e], r);
}
function F(e) {
	let t = D(e);
	return Math.sqrt(t.reduce((e, t) => e + t * t, 0));
}
function oe(e, t) {
	if (t !== "deg") throw Error(`unit: unsupported unit '${t}'`);
	return { toNumber(t) {
		if (t !== "rad") throw Error(`unit: unsupported conversion to '${t}'`);
		return e * Math.PI / 180;
	} };
}
function se(e) {
	return Array.from({ length: e }, (t, n) => Array.from({ length: e }, (e, t) => +(n === t)));
}
function ce(e) {
	return Array(e).fill(0);
}
function le(e) {
	let t = D(e), n = Array.isArray(t[0]) ? t.map((e) => [...e]) : [...t];
	return O([e], n);
}
function ue(e, t) {
	return k(D(e), D(t), (e, t) => e === t);
}
var de = Math.abs, fe = (e) => Math.min(...D(e));
function pe(e) {
	let t = e.map((e) => [...e]), n = se(3);
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
function me(e) {
	let { eigenvalues: t, eigenvectors: n } = pe(D(e));
	return {
		values: t,
		eigenvectors: t.map((e, t) => ({
			value: e,
			vector: new E(n[t])
		}))
	};
}
//#endregion
//#region src/lib/structure/fract-to-cart.js
function I(e) {
	let t = oe(e.alpha, "deg").toNumber("rad"), n = oe(e.beta, "deg").toNumber("rad"), r = oe(e.gamma, "deg").toNumber("rad"), i = Math.cos(t), a = Math.cos(n), o = Math.cos(r), s = Math.sin(r), c = Math.sqrt(1 - i * i - a * a - o * o + 2 * i * a * o);
	return A([
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
function he(e) {
	return A([
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
function ge(e) {
	let t = A(e);
	return [
		t.get([0, 0]),
		t.get([1, 1]),
		t.get([2, 2]),
		t.get([0, 1]),
		t.get([0, 2]),
		t.get([1, 2])
	];
}
function _e(e, t) {
	let n = A(e), r = ae(A(P(P(ie(n))).toArray().map((e) => F(e))));
	return ge(j(j(n, j(j(r, he(t)), P(r))), P(n)));
}
//#endregion
//#region src/lib/structure/position.js
var ve = class e {
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
}, ye = class extends ve {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return new be(...j(e.fractToCartMatrix, A([
			this.x,
			this.y,
			this.z
		])).toArray());
	}
}, be = class extends ve {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return this;
	}
}, xe = class {
	static fromCIF(e, t) {
		let n = !1, r = e.get("_atom_site"), i = [".", "?"];
		if (String(r.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], t, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		try {
			let e = r.getIndex(["_atom_site.fract_x", "_atom_site_fract_x"], t), a = r.getIndex(["_atom_site.fract_y", "_atom_site_fract_y"], t), o = r.getIndex(["_atom_site.fract_z", "_atom_site_fract_z"], t);
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new ye(e, a, o);
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
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new be(e, a, o);
			n = !0;
		} catch {}
		throw Error(n ? "Dummy atom: Invalid position" : "Invalid position: No valid fractional or Cartesian coordinates found");
	}
}, L = class e {
	constructor(e) {
		this.uiso = e;
	}
	static fromBiso(t) {
		return new e(t / (8 * Math.PI * Math.PI));
	}
}, R = class e {
	constructor(e, t, n, r, i, a) {
		this.u11 = e, this.u22 = t, this.u33 = n, this.u12 = r, this.u13 = i, this.u23 = a;
	}
	static fromBani(t, n, r, i, a, o) {
		let s = 1 / (8 * Math.PI * Math.PI);
		return new e(t * s, n * s, r * s, i * s, a * s, o * s);
	}
	getUCart(e) {
		return _e(e.fractToCartMatrix, [
			this.u11,
			this.u22,
			this.u33,
			this.u12,
			this.u13,
			this.u23
		]);
	}
	getEllipsoidMatrix(e) {
		let { eigenvectors: t } = me(he(this.getUCart(e))), n = P(A(t.map((e) => e.vector))), r = A(t.map((e) => e.value > 0 ? e.value : NaN)), i = re(n), a = ae(r.map(Math.sqrt)), o;
		return o = de(i - 1) > 1e-10 ? j(j(n, 1 / i), a) : j(n, a), A(o);
	}
}, Se = class e {
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
		].some(isNaN) ? null : new R(i, a, o, s, c, l);
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
		].some(isNaN) ? null : R.fromBani(i, a, o, s, c, l);
	}
	static createUiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : new L(n);
		} catch {
			return null;
		}
	}
	static createBiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.b_iso_or_equiv", "_atom_site_B_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : L.fromBiso(n);
		} catch {
			return null;
		}
	}
};
//#endregion
//#region src/lib/structure/position-code.js
function Ce(e) {
	if (e == null || e === "." || e === "?") return ".";
	let t = String(e).trim();
	return t === "" || t === "." || t === "?" ? "." : t.includes("_") ? t : `${t}_555`;
}
function we(e) {
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
function Te(e, t) {
	let n = String(e);
	if (!n || n.includes("_")) throw Error(`Invalid symmetry operation ID: ${e}`);
	if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isInteger)) throw Error(`Invalid symmetry translation: ${t}`);
	let r = t.map((e) => e + 5);
	return r.every((e) => e >= 0 && e <= 9) ? `${n}_${r.join("")}` : `${n}_[${t.join(",")}]`;
}
//#endregion
//#region src/lib/structure/cell-symmetry.js
function Ee(e) {
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
var De = class e {
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
		let t = M(j(this.rotMatrix, e), this.transVector);
		return Array.isArray(t) ? t : t.toArray();
	}
	applyToAtom(e) {
		let t = new ye(...M(j(this.rotMatrix, [
			e.position.x,
			e.position.y,
			e.position.z
		]), this.transVector)), n = null;
		if (e.adp && e.adp instanceof R) {
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
			], r = this.rotMatrix, i = P(r), a = j(j(r, t), i);
			n = new R(a[0][0], a[1][1], a[2][2], a[0][1], a[0][2], a[1][2]);
		} else e.adp && e.adp instanceof L && (n = new L(e.adp.uiso));
		return new Ne(e.label, e.atomType, t, n, e.disorderGroup);
	}
	applyToAtoms(e) {
		return e.map((e) => this.applyToAtom(e));
	}
	copy() {
		let t = new e("x,y,z");
		return t.rotMatrix = le(this.rotMatrix), t.transVector = le(this.transVector), t;
	}
	toSymmetryString(e = null) {
		let t = [
			"x",
			"y",
			"z"
		], n = [], r = e ? M(this.transVector, e) : this.transVector;
		for (let e = 0; e < 3; e++) {
			let i = "", a = [];
			for (let n = 0; n < 3; n++) {
				let r = this.rotMatrix[e][n];
				if (Math.abs(r) > 1e-10) if (Math.abs(Math.abs(r) - 1) < 1e-10) a.push(r > 0 ? t[n] : `-${t[n]}`);
				else {
					let e = Ee(Math.abs(r));
					a.push(r > 0 ? `${e}${t[n]}` : `-${e}${t[n]}`);
				}
			}
			if (i = a.join("+"), i === "" && (i = "0"), Math.abs(r[e]) > 1e-10) {
				let t = Ee(Math.abs(r[e])), n = r[e] < 0 ? `-${t}` : t;
				i = i === "0" ? n : i.startsWith("-") ? `${n}${i}` : `${n}+${i}`;
			}
			n.push(i);
		}
		return n.join(",");
	}
}, Oe = class e {
	constructor(e, t, n, r = null) {
		this.spaceGroupName = e, this.spaceGroupNumber = t, this.symmetryOperations = n, this.operationIds = r || new Map(n.map((e, t) => [(t + 1).toString(), t])), this.identitySymOpId = Array.from(this.operationIds.entries()).find(([e, t]) => {
			let n = this.symmetryOperations[t];
			return ue(n.rotMatrix, se(3)) && ue(n.transVector, ce(3));
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
		let { id: t, translation: n } = we(e), r = this.operationIds.get(t);
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
				let i = r.map((e) => Math.round(e)), a = Te(t, i);
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
		], i = ie(t.rotMatrix), a = this._multiplyMatrixVector3x3(i, r.map((e) => -e)), o = this._rotationMatrixIndex.get(this._matrixToKey(i));
		if (o) for (let e of o) {
			let t = this.symmetryOperations[e], n = a.map((e, n) => e - t.transVector[n]);
			if (!n.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) continue;
			let r = Array.from(this.operationIds.entries()).find(([, t]) => t === e)?.[0];
			return Te(r, n.map((e) => Math.round(e)));
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
		if (i && !(i instanceof u)) return new e(n, r, [new De(i)]);
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
			let o = t.map((e) => new De(e));
			return new e(n, r, o, a);
		} else return console.warn("No symmetry operations found in CIF block, will use P1"), new e("Unknown", 0, [new De("x,y,z")]);
	}
};
//#endregion
//#region src/lib/structure/bonds.js
function z(e) {
	return String(e).split("|")[0];
}
function B(e, t = "1_555") {
	let n = String(e);
	return n.includes("|") ? n : `${n}|${t}`;
}
var V = class e {
	constructor(e, t, n = null, r = null, i = null) {
		let a = Ce(i);
		this.atom1Id = B(e), this.atom2Id = B(t, a === "." ? "1_555" : a), this.bondLength = n, this.bondLengthSU = r, this.atom2SiteSymmetry = a;
	}
	get atom1Label() {
		return z(this.atom1Id);
	}
	get atom2Label() {
		return z(this.atom2Id);
	}
	static fromCIF(t, n) {
		let r = t.get("_geom_bond"), i = r.getIndex(["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"], n, "."), a = r.getIndex(["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"], n, !1);
		a && a === i && (i = "."), i = Ce(i);
		let o = `${r.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], n)}|1_555`, s = r.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], n), c = i === "?" ? "." : i, l = `${s}|${c === "." ? "1_555" : c}`;
		return new e(o, l, r.getIndex(["_geom_bond.distance", "_geom_bond_distance"], n), r.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], n, NaN), c);
	}
}, H = class e {
	constructor(e, t, n, r, i, a, o, s, c, l, u, d) {
		let f = Ce(d);
		this.donorAtomId = B(e), this.hydrogenAtomId = B(t), this.acceptorAtomId = B(n, f === "." ? "1_555" : f), this.donorHydrogenDistance = r, this.donorHydrogenDistanceSU = i, this.acceptorHydrogenDistance = a, this.acceptorHydrogenDistanceSU = o, this.donorAcceptorDistance = s, this.donorAcceptorDistanceSU = c, this.hBondAngle = l, this.hBondAngleSU = u, this.acceptorAtomSymmetry = f;
	}
	get donorAtomLabel() {
		return z(this.donorAtomId);
	}
	get hydrogenAtomLabel() {
		return z(this.hydrogenAtomId);
	}
	get acceptorAtomLabel() {
		return z(this.acceptorAtomId);
	}
	static fromCIF(t, n) {
		let r = t.get("_geom_hbond"), i = r.getIndex(["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"], n, "."), a = `${r.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], n)}|1_555`, o = `${r.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], n)}|1_555`, s = r.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], n), c = Ce(i), l = `${s}|${c === "." ? "1_555" : c}`;
		return new e(a, o, l, r.getIndex(["_geom_hbond.distance_dh", "_geom_hbond_distance_DH"], n, NaN), r.getIndex(["_geom_hbond.distance_dh_su", "_geom_hbond_distance_DH_su"], n, NaN), r.getIndex(["_geom_hbond.distance_ha", "_geom_hbond_distance_HA"], n, NaN), r.getIndex(["_geom_hbond.distance_ha_su", "_geom_hbond_distance_HA_su"], n, NaN), r.getIndex(["_geom_hbond.distance_da", "_geom_hbond_distance_DA"], n, NaN), r.getIndex(["_geom_hbond.distance_da_su", "_geom_hbond_distance_DA_su"], n, NaN), r.getIndex(["_geom_hbond.angle_dha", "_geom_hbond_angle_DHA"], n, NaN), r.getIndex(["_geom_hbond.angle_dha_su", "_geom_hbond_angle_DHA_su"], n, NaN), c);
	}
}, ke = class {
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
}, Ae = class e {
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
		let r = new ke(), i = new Set(t.map((e) => e.label));
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
		let r = new ke(), i = new Set(t.map((e) => e.label));
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
function U(e) {
	if (!e || typeof e != "string") throw Error(`Invalid atom label: ${e}`);
	let t = e.toUpperCase(), n = RegExp(`^(${(/* @__PURE__ */ "HE.LI.BE.NE.NA.MG.AL.SI.CL.AR.CA.SC.TI.CR.MN.FE.CO.NI.CU.ZN.GA.GE.AS.SE.BR.KR.RB.SR.ZR.NB.MO.TC.RU.RH.PD.AG.CD.IN.SN.SB.TE.XE.CS.BA.LA.CE.PR.ND.PM.SM.EU.GD.TB.DY.HO.ER.TM.YB.LU.HF.TA.RE.OS.IR.PT.AU.HG.TL.PB.BI.PO.AT.RN.FR.RA.AC.TH.PA.NP.PU.AM.CM".split(".")).join("|")})`), r = t.match(n);
	if (r) return je(r[1]);
	let i = t.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
	if (i) return je(i[1]);
	throw Error(`Could not infer element type from atom label: ${e}`);
}
function je(e) {
	return e.length === 1 ? e : e[0] + e[1].toLowerCase();
}
var W = class e {
	constructor(e, t, n = [], r = [], i = null) {
		this.cell = e, this.atoms = t, this.bonds = n, this.hBonds = r, this.symmetry = i || new Oe("None", 0, [new De("x,y,z")]);
	}
	static fromCIF(t) {
		let n = Me.fromCIF(t), r = t.get("_atom_site").get(["_atom_site.label", "_atom_site_label"]), i = Array.from({ length: r.length }, (e, n) => {
			try {
				return Ne.fromCIF(t, n);
			} catch (e) {
				if (e.message.includes("Dummy atom")) return null;
				throw e;
			}
		}).filter((e) => e !== null);
		if (i.length === 0) throw Error("The cif file contains no valid atoms.");
		let a = new Set(i.map((e) => e.label)), o = Ae.createBonds(t, a), s = Ae.createHBonds(t, a), c = Oe.fromCIF(t), l = Ae.validateBonds(o, i, c), u = Ae.validateHBonds(s, i, c);
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
}, Me = class e {
	constructor(e, t, n, r, i, a) {
		this._a = e, this._b = t, this._c = n, this._alpha = r, this._beta = i, this._gamma = a, this.fractToCartMatrix = I(this);
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
		this._a = e, this.fractToCartMatrix = I(this);
	}
	get b() {
		return this._b;
	}
	set b(e) {
		if (e <= 0) throw Error("Cell parameter 'b' must be positive");
		this._b = e, this.fractToCartMatrix = I(this);
	}
	get c() {
		return this._c;
	}
	set c(e) {
		if (e <= 0) throw Error("Cell parameter 'c' must be positive");
		this._c = e, this.fractToCartMatrix = I(this);
	}
	get alpha() {
		return this._alpha;
	}
	set alpha(e) {
		if (e <= 0 || e >= 180) throw Error("Angle alpha must be between 0 and 180 degrees");
		this._alpha = e, this.fractToCartMatrix = I(this);
	}
	get beta() {
		return this._beta;
	}
	set beta(e) {
		if (e <= 0 || e >= 180) throw Error("Angle beta must be between 0 and 180 degrees");
		this._beta = e, this.fractToCartMatrix = I(this);
	}
	get gamma() {
		return this._gamma;
	}
	set gamma(e) {
		if (e <= 0 || e >= 180) throw Error("Angle gamma must be between 0 and 180 degrees");
		this._gamma = e, this.fractToCartMatrix = I(this);
	}
}, Ne = class e {
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
		if (l ||= U(s), c.includes(l)) throw Error("Dummy atom: Invalid atom type");
		let u = xe.fromCIF(t, o), d = Se.fromCIF(t, o), f = i.getIndex(["_atom_site.disorder_group", "_atom_site_disorder_group"], o, ".");
		return new e(s, l, u, d, f === "." ? 0 : f);
	}
};
function Pe(e, t) {
	return e.disorderGroup === t.disorderGroup || e.disorderGroup === 0 || t.disorderGroup === 0;
}
//#endregion
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function Fe(e, t = !1) {
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
		let t = Ie(o[e]);
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
				let r = Ie(t);
				if (!r) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
				l.morphAttributes[e].push(r);
			}
		}
	}
	return l;
}
function Ie(e) {
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
var Le = Object.freeze({
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
}), Re = Object.freeze(/* @__PURE__ */ new Set([
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
])), ze = Object.freeze({
	Bk: 1.65,
	Cf: 1.81
}), G = {
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
	bondGrowTolerance: .45,
	fixCifErrors: !1,
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
	elementProperties: Object.fromEntries(Object.entries({
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
		radius: Le[e] ?? ze[e],
		...t
	}]))
}, Be = [
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
], Ve = [
	-1,
	1,
	1
], He = [
	new e.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
	new e.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1),
	new e.Matrix4().set(0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
];
function Ue(t, n) {
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
function We(t, n = t.plot2DLineColor) {
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
function Ge(e, t) {
	e.scale.set(t[0] / Ve[0], t[1] / Ve[1], t[2] / Ve[2]);
}
function Ke(e, t) {
	let n = e.getAttribute("uv"), r = Math.cos(t), i = Math.sin(t);
	for (let e = 0; e < n.count; e++) {
		let t = n.getX(e) - .5, a = n.getY(e) - .5;
		n.setXY(e, t * r - a * i + .5, t * i + a * r + .5);
	}
	n.needsUpdate = !0;
}
function qe(t) {
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
var Je = class {
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
function Ye(t, n) {
	let r = t.getEllipsoidMatrix(n).toArray();
	return new e.Matrix4(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1);
}
function Xe(t, n) {
	let r = n.clone().sub(t), i = r.length();
	if (i === 0) throw Error("Error in ORTEP Bond Creation. Trying to create a zero length bond.");
	let a = r.divideScalar(i), o = new e.Vector3(0, 1, 0), s = new e.Vector3().crossVectors(a, o), c = -Math.acos(a.dot(o));
	return new e.Matrix4().makeScale(1, i, 1).premultiply(new e.Matrix4().makeRotationAxis(s.normalize(), c)).setPosition(t.clone().add(n).multiplyScalar(.5));
}
function Ze(e, t, n, r) {
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
var Qe = class {
	constructor(e = {}) {
		let t = e || {};
		this.options = {
			...G,
			...t,
			elementProperties: {
				...G.elementProperties,
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
		if (this.options.elementProperties[n] || (n = U(t)), this.validateElementType(n), this.options.renderStyle === "cutout-2d") {
			let t = `${n}_2d_materials`;
			if (!this.elementMaterials[t]) {
				let r = this.options.elementProperties[n], i = ["H", "D"].includes(n) ? this.options.plot2DLineColor : r.atomColor, a = new e.MeshBasicMaterial({
					color: i,
					side: e.BackSide
				}), o = new e.MeshBasicMaterial({ color: this.options.plot2DAtomColor });
				o.userData.plot2DOutlineMaterial = a, o.userData.plot2DOutlineScale = this.options.plot2DOutlineScale;
				let s = new e.MeshBasicMaterial({ color: i }), c = We(this.options, i);
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
			this.elementMaterials[r] = [i, a], this.options.renderStyle === "cutout-3d" && this.elementMaterials[r].push(Ue(t, this.options));
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
		Ke(r, Math.PI / 2), Ke(i, Math.PI / 2), r.rotateX(Math.PI / 2), i.rotateY(Math.PI / 2);
		let a = Fe([
			n,
			r,
			i
		]);
		return n.dispose(), r.dispose(), i.dispose(), a;
	}
	createMergedADPRingSet(e) {
		let t = He.map((t) => {
			let n = e.clone();
			return n.applyMatrix4(t), n;
		}), n = Fe(t);
		return t.forEach((e) => e.dispose()), n;
	}
	dispose() {
		Object.values(this.geometries).forEach((e) => e.dispose()), Object.values(this.materials).forEach((e) => e.dispose()), Object.values(this.elementMaterials).forEach((e) => {
			e.forEach((e) => e.dispose());
		});
	}
}, $e = class {
	constructor(e, t = {}) {
		let n = t || {}, r = { ...G.elementProperties };
		n.elementProperties && Object.entries(n.elementProperties).forEach(([e, t]) => {
			r[e] = {
				...r[e],
				...t
			};
		}), this.options = {
			...G,
			...n,
			elementProperties: r
		}, this.crystalStructure = e, this.cache = new Qe(this.options), this.createStructure();
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
			a = e.adp instanceof R ? new nt(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.cache.geometries.adpRingSet, n, {
				octantGeometry: this.cache.geometries.atomOctant,
				emptyGeometry: this.cache.geometries.emptyAtom,
				planeGeometry: this.cache.geometries.cutawayPlanes,
				planeMaterial: r,
				hysteresis: this.options.atomCutawayHysteresis
			}) : e.adp instanceof L ? new rt(e, this.crystalStructure.cell, this.cache.geometries.atom, t) : new it(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.options), this.atoms3D.push(a), i.has(e.uniqueId) || i.set(e.uniqueId, a);
		}
		else {
			this.cache.geometries.atom.boundingSphere || this.cache.geometries.atom.computeBoundingSphere();
			let e = this.cache.geometries.atom.boundingSphere.radius, t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = [];
			for (let e of this.crystalStructure.atoms) {
				let [i, a] = this.cache.getAtomMaterials(e.atomType);
				if (e.adp instanceof R) {
					let { matrix: o, valid: s } = at(e, this.crystalStructure.cell);
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
				} else if (e.adp instanceof L) {
					let { matrix: n, valid: a } = ot(e, this.crystalStructure.cell);
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
					let n = st(e, this.crystalStructure.cell, this.options);
					t.set(i, (t.get(i) || 0) + 1), r.push({
						atom: e,
						kind: "constant",
						matrix: n,
						atomMaterial: i
					});
				}
			}
			let a = /* @__PURE__ */ new Map();
			for (let [e, n] of t) a.set(e, new Je(this.cache.geometries.atom, e, n));
			let o = /* @__PURE__ */ new Map();
			for (let [e, t] of n) o.set(e, new Je(this.cache.geometries.adpRingSet, e, t));
			for (let t of r) {
				let n;
				n = t.kind === "ani" ? new ut(t.atom, a.get(t.atomMaterial), t.matrix, e, o.get(t.ringMaterial)) : t.kind === "iso" || t.kind === "constant" ? new lt(t.atom, a.get(t.atomMaterial), t.matrix, e) : t.kind === "ani-fallback" ? new nt(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial, this.cache.geometries.adpRingSet, t.ringMaterial, null) : new rt(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial), this.atoms3D.push(n), i.has(t.atom.uniqueId) || i.set(t.atom.uniqueId, n);
			}
			a.forEach((e) => e.finalize()), o.forEach((e) => e.finalize()), this.atomPools = a, this.ringPools = o;
		}
		let o = this.options.renderStyle === "solid-3d" ? null : (e) => i.get(e), s = this.crystalStructure.bonds.filter((e) => {
			let n = t.has(e.atom1Id), r = t.has(e.atom2Id);
			return n && r;
		});
		if (this.options.renderStyle === "cutout-2d") for (let e of s) try {
			let t = [n.get(e.atom1Id), n.get(e.atom2Id)].some((e) => Number(e.disorderGroup) > 1);
			this.bonds3D.push(new dt(e, this.crystalStructure, this.cache.geometries.bond, t ? this.cache.materials.openBond : this.cache.materials.bond, a, o, t ? {
				outlineMaterial: this.cache.materials.openBondOutline,
				innerScale: this.options.plot2DOpenBondInnerScale
			} : null));
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		else {
			let e = [];
			for (let t of s) try {
				let n = ft.computeMatrix(t, this.crystalStructure, a, o);
				e.push([t, n]);
			} catch (e) {
				if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
			}
			this.bondPool = e.length > 0 ? new Je(this.cache.geometries.bond, this.cache.materials.bond, e.length) : null;
			for (let [t, n] of e) this.bonds3D.push(new ft(t, this.bondPool, n));
			this.bondPool?.finalize();
		}
		let c = this.crystalStructure.hBonds.filter((e) => t.has(e.donorAtomId) && t.has(e.acceptorAtomId) && (!e.hydrogenAtomId || t.has(e.hydrogenAtomId))), l = [], u = 0;
		for (let e of c) try {
			let t = pt.computeSegmentMatrices(e, this.crystalStructure, this.options.hbondDashSegmentLength, this.options.hbondDashFraction, a, o);
			l.push([e, t]), u += t.length;
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		this.hbondPool = u > 0 ? new Je(this.cache.geometries.hbond, this.cache.materials.hbond, u) : null;
		for (let [e, t] of l) this.hBonds3D.push(new pt(e, this.hbondPool, t));
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
		return qe(t), t.cutawayAtoms = this.atoms3D.filter((e) => e.isCutaway), t.cameraFacingAtoms = t.cutawayAtoms, t;
	}
	dispose() {
		this.cache.dispose();
	}
}, et = class t extends e.Mesh {
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
}, tt = class extends et {
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
}, nt = class extends tt {
	constructor(t, n, r, i, a, o, s = null) {
		if (super(t, n, r, i), [
			t.adp.u11,
			t.adp.u22,
			t.adp.u33
		].some((e) => e <= 0)) this.geometry = new e.TetrahedronGeometry(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
		else {
			let r = Ye(t.adp, n);
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
		], this.cutawayViewDirection = new e.Vector3(), this.cutawayWorldPosition = new e.Vector3(), this.cutawayInverseRotation = new e.Matrix4(), this.cutawayOctants = Be.map((r, i) => {
			let a = new e.Mesh(t.octantGeometry, n);
			return Ge(a, r), a.userData = {
				selectable: !1,
				type: "ellipsoid-octant",
				octantIndex: i
			}, this.add(a), a;
		}), this.plot2DOutline) {
			this.remove(this.plot2DOutline);
			let r = n.userData.plot2DOutlineMaterial, i = n.userData.plot2DOutlineScale;
			this.cutawayOutlines = Be.map((n, a) => {
				let o = new e.Mesh(t.octantGeometry, r);
				return Ge(o, n), o.scale.multiplyScalar(i), o.userData = {
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
		return r.cutawayOctants = Be.map((t, n) => {
			let a = new e.Mesh(this.cutawayOctants[0].geometry, i);
			return Ge(a, t), a.visible = n !== this.missingOctantIndex, a.userData.selectable = !1, r.add(a), a;
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
		return He.map((e) => e.clone());
	}
}, rt = class extends tt {
	constructor(t, n, r, i) {
		if (super(t, n, r, i), !t.adp || !("uiso" in t.adp)) throw Error("Atom must have isotropic displacement parameters (UIsoADP)");
		t.adp.uiso <= 0 ? (this.geometry = new e.TetrahedronGeometry(1), this.updateSurfaceRadius()) : this.scale.multiplyScalar(Math.sqrt(t.adp.uiso));
	}
}, it = class extends tt {
	constructor(e, t, n, r, i) {
		super(e, t, n, r);
		let a = e.atomType;
		try {
			i.elementProperties[a] || (a = U(e.atomType));
		} catch {
			throw Error(`Element properties not found for atom type: '${e.atomType}'`);
		}
		this.scale.multiplyScalar(i.atomConstantRadiusMultiplier * i.elementProperties[a].radius);
	}
};
function at(t, n) {
	if ([
		t.adp.u11,
		t.adp.u3,
		t.adp.u33
	].some((e) => e <= 0)) return {
		matrix: null,
		valid: !1
	};
	let r = Ye(t.adp, n);
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
function ot(t, n) {
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
function st(t, n, r) {
	let i = t.atomType;
	try {
		r.elementProperties[i] || (i = U(t.atomType));
	} catch {
		throw Error(`Element properties not found for atom type: '${t.atomType}'`);
	}
	let a = r.atomConstantRadiusMultiplier * r.elementProperties[i].radius, o = new e.Vector3(...t.position.toCartesian(n));
	return new e.Matrix4().makeScale(a, a, a).setPosition(o);
}
var ct = class t extends e.Object3D {
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
}, lt = class extends ct {
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
}, ut = class extends lt {
	constructor(e, t, n, r, i) {
		super(e, t, n, r), i && (this.ringPool = i, this.ringIndex = i.register(n));
	}
}, dt = class extends et {
	constructor(t, n, r, i, a = null, o = null, s = null) {
		super(r, i);
		let c, l;
		if (a) c = a(t.atom1Id), l = a(t.atom2Id);
		else {
			let r = n.getAtomById(t.atom1Id), i = n.getAtomById(t.atom2Id);
			c = new e.Vector3(...r.position.toCartesian(n.cell)), l = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		o && ([c, l] = Ze(c, l, o(t.atom1Id), o(t.atom2Id)));
		let u = Xe(c, l);
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
var ft = class extends ct {
	static computeMatrix(t, n, r = null, i = null) {
		let a, o;
		if (r) a = r(t.atom1Id), o = r(t.atom2Id);
		else {
			let r = n.getAtomById(t.atom1Id), i = n.getAtomById(t.atom2Id);
			a = new e.Vector3(...r.position.toCartesian(n.cell)), o = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		return i && ([a, o] = Ze(a, o, i(t.atom1Id), i(t.atom2Id))), Xe(a, o);
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
}, pt = class extends ct {
	static computeSegmentMatrices(t, n, r, i, a = null, o = null) {
		let s, c;
		if (a) s = a(t.hydrogenAtomId), c = a(t.acceptorAtomId);
		else {
			let r = n.getAtomById(t.hydrogenAtomId), i = n.getAtomById(t.acceptorAtomId);
			s = new e.Vector3(...r.position.toCartesian(n.cell)), c = new e.Vector3(...i.position.toCartesian(n.cell));
		}
		o && ([s, c] = Ze(s, c, o(t.hydrogenAtomId), o(t.acceptorAtomId)));
		let l = s.distanceTo(c), u = Math.max(1, Math.floor(l / r)), d = l / u * i, f = [];
		for (let t = 0; t < u; t++) {
			let n = t / u, r = n + d / l, i = new e.Vector3().lerpVectors(s, c, n), a = new e.Vector3().lerpVectors(s, c, r);
			f.push(Xe(i, a));
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
function mt(e, t, n = 4) {
	if (!isFinite(1 / t)) return ht(e, n).toFixed(n);
	let r = Math.floor(Math.log10(t));
	t * 10 ** -r < 2 && --r;
	let i = ht(e, -r);
	if (r < 0) {
		let e = Math.round(t / 10 ** r);
		return `${i.toFixed(-r)}(${e})`;
	}
	return `${i}(${ht(t, r)})`;
}
function ht(e, t) {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}
//#endregion
//#region src/lib/fix-cif/reconcile-labels.js
function gt(e, t = !0) {
	if (!e || typeof e != "string") throw Error("Empty atom label");
	let n = e.toUpperCase().replace(/[()[\]{}]/g, "");
	if (t && (n = n.replace(/\^[a-zA-Z1-9]+$/, "").replace(/_[a-zA-Z1-9]+$/, "").replace(/_\$\d+$/, "")), n === "") throw Error(`Label "${e}" normalizes to empty string`);
	return n;
}
function _t(e, t = !0) {
	let n = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		try {
			let r = gt(e, t);
			n.has(r) || n.set(r, []), n.get(r).push(e);
		} catch (e) {
			console.warn(`Skipping invalid label: ${e.message}`);
		}
	});
	let r = /* @__PURE__ */ new Map();
	for (let [e, t] of n.entries()) t.length === 1 ? r.set(e, t[0]) : console.warn(`Multiple labels map to ${e}: ${t.join(", ")}. Skipping mapping.`);
	return r;
}
function K(e, t, n, r = !0) {
	let i = _t(n, r), a = e.get(t).map((e) => {
		let t = gt(e, r);
		return i.has(t) ? i.get(t) : e;
	});
	e.data[t] = a;
}
//#endregion
//#region src/lib/fix-cif/guess-symmetry.js
function vt(e) {
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
function yt(e, t) {
	let n = e.get(t).map((e) => vt(e));
	e.data[t] = n;
}
//#endregion
//#region src/lib/fix-cif/base.js
function q(e, t) {
	for (let n of t) if (e.headerLines.includes(n)) return n;
	return null;
}
function bt(e, t) {
	if (q(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"])) return;
	let n = q(e, ["_atom_site.adp_type", "_atom_site_adp_type"]), r = q(e, ["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"]);
	if (!n || !r) return;
	let i = e.get(n), a = e.get(r);
	e.data[n] = i.map((e, t) => {
		let n = Number.isFinite(Number(a[t]));
		return /^uani$/i.test(String(e)) && n ? "Uiso" : e;
	});
}
function xt(e, t = !0, n = !0, r = !0) {
	let i, a;
	if ((t || n) && (i = e.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"])), t) {
		let t = e.get("_atom_site_aniso", !1);
		if (t) {
			let e = q(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"]);
			e ? K(t, e, a) : bt(i, t);
		}
	}
	if (n || r) {
		let t = e.get("_geom_bond", !1);
		if (t && (n && (K(t, q(t, ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]), a), K(t, q(t, ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"]), a)), r)) {
			let e = q(t, ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"]);
			e && yt(t, e);
			let n = q(t, ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"]);
			n && yt(t, n);
		}
		let i = e.get("_geom_hbond", !1);
		if (i) {
			if (n) {
				K(i, q(i, ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]), a);
				let e = q(i, ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"]);
				e && K(i, e, a), K(i, q(i, ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"]), a);
			}
			if (r) {
				let e = q(i, ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"]);
				e && yt(i, e);
			}
		}
	}
}
//#endregion
//#region src/lib/disorder-icons.js
function St(e, t) {
	if (t === "all") return e.all;
	if (e[t]) return e[t];
	let n = /^group(\d+)of\d+$/.exec(t)?.[1];
	return n ? Ct(e, n) : "";
}
function Ct(e, t) {
	let n = e.all.replace(/#000000/g, "#8f8f8f"), r = String(t).length, i = `<text x="8.925192" y="8.925193" text-anchor="middle" dominant-baseline="central" font-size="${r <= 1 ? 9 : Math.max(9 - (r - 1) * 1.5, 5)}" font-family="system-ui, sans-serif" font-weight="bold" fill="#000000">${t}</text>`;
	return n.replace("</svg>", `${i}</svg>`);
}
//#endregion
//#region src/lib/structure/structure-modifiers/base.js
var J = class e {
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
		this.key = Te(this.id, this.translation);
	}
	static fromString(t) {
		let { id: n, translation: r } = we(t);
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
}, wt = /* @__PURE__ */ new Set([
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
]), Tt = 4, Et = 1.6;
function Dt(e) {
	return wt.has(e) ? Le[e] : void 0;
}
function Ot(e, t = e.bonds) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e.atoms) n.has(t.label) || n.set(t.label, t.atomType);
	return t.filter((e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > Tt) return !1;
		let t = n.get(e.atom1Label), r = n.get(e.atom2Label);
		if (t === void 0 || r === void 0) return !0;
		let i = Dt(t), a = Dt(r);
		return i === void 0 || a === void 0 || e.bondLength <= Et * (i + a);
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
var kt = class {
	constructor(e, t) {
		this.groupIndex = e, this.appliedSymmetry = typeof t == "string" ? Z.fromString(t) : t;
	}
	isTranslationalDuplicateOf(e) {
		return this.groupIndex === e.groupIndex && this.appliedSymmetry.id === e.appliedSymmetry.id && (this.appliedSymmetry.translation[0] !== e.appliedSymmetry.translation[0] || this.appliedSymmetry.translation[1] !== e.appliedSymmetry.translation[1] || this.appliedSymmetry.translation[2] !== e.appliedSymmetry.translation[2]);
	}
	getSymmetryString() {
		return this.appliedSymmetry.toString();
	}
}, At = class {
	constructor(e, t, n, r) {
		this.originAtom = e.includes("|") ? e : Y(e, "1_555"), this.targetAtom = t.includes("|") ? t : Y(t, "1_555"), this.bondLength = n, this.bondLengthSU = r;
	}
}, jt = class {
	constructor(e, t, n, r, i, a) {
		this.originIndex = e, this.originSymmetry = typeof t == "string" ? Z.fromString(t) : t, this.targetIndex = n, this.targetSymmetry = typeof r == "string" ? Z.fromString(r) : r, this.connectingBonds = i, this.creationOriginIndex = a;
	}
	getKey() {
		let e = this.originSymmetry.key, t = this.targetSymmetry.key;
		return this.originIndex === this.targetIndex ? e < t ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}` : this.originIndex < this.targetIndex ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}`;
	}
};
function Mt(e, t, n) {
	let r = t.map(() => /* @__PURE__ */ new Map()), i = t.map(() => []);
	return e.bonds.filter((e) => e.atom2SiteSymmetry !== ".").forEach((e) => {
		let t = n.get(e.atom1Id) ?? n.get(e.atom1Label), a = e.atom2Id.split("|")[0], o = `${a}|1_555`, s = n.get(o) ?? n.get(a);
		if (t === void 0 || s === void 0) return;
		let c = `${t}->${s}@.@${e.atom2SiteSymmetry}`;
		if (r[t].has(c)) {
			let n = r[t].get(c);
			i[t][n].bonds.push(new At(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU));
		} else r[t].set(c, i[t].length), i[t].push({
			targetIndex: s,
			targetSymmetry: Z.fromString(e.atom2SiteSymmetry),
			bonds: [new At(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU)]
		});
	}), i;
}
function Nt(e, t) {
	let n = [], r = /* @__PURE__ */ new Set();
	return e.forEach((e, i) => {
		for (let a of e) {
			let e = new jt(i, t, a.targetIndex, a.targetSymmetry, a.bonds, i), o = e.getKey();
			r.has(o) || (n.push(e), r.add(o));
		}
	}), {
		danglingConnections: n,
		processedConnections: r
	};
}
function Pt(e, t, n, r, i) {
	let a = [], o = [], s = new kt(e.targetIndex, e.targetSymmetry), c = r[e.targetIndex];
	for (let r of c) {
		let s = (typeof r.targetSymmetry == "string" ? Z.fromString(r.targetSymmetry) : r.targetSymmetry).combine(e.targetSymmetry, t.symmetry), c = new jt(e.targetIndex, e.targetSymmetry, r.targetIndex, s, r.bonds, e.creationOriginIndex), l = c.getKey();
		if (i.has(l)) continue;
		i.add(l);
		let u = new kt(r.targetIndex, s);
		n[e.creationOriginIndex].some((e) => u.isTranslationalDuplicateOf(e)) ? o.push(c) : a.push(c);
	}
	return {
		newConnectedGroup: s,
		newDanglingConnections: a,
		foundTranslations: o
	};
}
function Ft(e, t) {
	let n = /* @__PURE__ */ new Map();
	t.forEach((e, t) => {
		e.atoms.forEach((e) => n.set(e.uniqueId, t));
	});
	let r = Z.fromString(e.symmetry.identitySymOpId + "_555"), i = Mt(e, t, n), { danglingConnections: a, processedConnections: o } = Nt(i, r), s = [], c = [], l = t.map(() => []);
	t.forEach((e, t) => {
		l[t].push(new kt(t, r));
	});
	let u = 0, d = 0;
	for (; d < a.length;) {
		if (u++ > 1e4) {
			console.error("Max iterations reached in createConnectivity. Possible infinite loop orvery complex structure.");
			break;
		}
		let t = a[d++], n = Pt(t, e, l, i, o);
		l[t.creationOriginIndex].push(n.newConnectedGroup), a.push(...n.newDanglingConnections), c.push(...n.foundTranslations), s.push(t);
	}
	return d < a.length && console.warn(`Connectivity processing stopped due to iteration limit. ${a.length - d} connections remain unprocessed.`), {
		networkConnections: s,
		translationLinks: c,
		discoveredGroups: l
	};
}
function It(e) {
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
function Lt(e, t, n, r) {
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
function Rt(e, t, n, r, i, a) {
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
function zt(e, t, n, r, i, a, o) {
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
function Bt(e, t, n, r) {
	let i = [];
	return e.forEach((e) => {
		for (let t of e.connectingBonds) {
			let a = t.originAtom.split("|")[0], o = t.targetAtom.split("|")[0], s = Y(a, e.originSymmetry.key), c = Y(o, e.targetSymmetry.key), l = n.get(s) || s, u = n.get(c) || c, d = u.split("|")[1] || e.targetSymmetry.key, f = Q(l, u);
			r.has(f) || (r.add(f), i.push(new V(l, u, t.bondLength, t.bondLengthSU, d)));
		}
	}), i;
}
function Vt(e) {
	let t = new W(e.cell, e.atoms, Ot(e), e.hBonds, e.symmetry), n = t.calculateConnectedGroups(), r = /* @__PURE__ */ new Map();
	n.forEach((e, t) => {
		e.atoms.forEach((e) => {
			r.set(e.uniqueId, t);
		});
	});
	let i = e.symmetry.identitySymOpId + "_555", { networkConnections: a, translationLinks: o } = Ft(t, n), { requiredSymmetryInstances: s, interGroupBonds: c } = It(a, e, i), { specialPositionAtoms: l, newAtoms: u } = Lt(s, n, t, i), { newBonds: d, atomLabels: f } = Rt(n, s, c, l, u, i), p = zt(t, n, r, s, l, f, i), m = Bt(o, t, l, new Set(d.map((e) => Q(e.atom1Id, e.atom2Id))));
	for (let e of m) d.push(e);
	return {
		grownStructure: new W(t.cell, [...t.atoms, ...u], d, p, t.symmetry),
		specialPositionAtoms: l
	};
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-cell.js
var Ht = 4;
function Ut(e, t) {
	let n = /* @__PURE__ */ new Set([e.identitySymOpId]), r = /* @__PURE__ */ new Set();
	for (let n of t) {
		let t = e.combineSymmetryCodes(n + "_555", e.identitySymOpId + "_555");
		r.add(t.split("_")[0]);
	}
	for (let [t] of e.operationIds) n.has(t) || r.has(t) || n.add(t);
	return n;
}
function Wt(e) {
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
function Gt(e) {
	let t = Wt(e);
	return A([
		(t.minX + t.maxX) / 2,
		(t.minY + t.maxY) / 2,
		(t.minZ + t.maxZ) / 2
	]);
}
function Kt(e, t, n) {
	let r = t.symmetry.identitySymOpId, i = /* @__PURE__ */ new Set();
	for (let t of e.atoms) t.appliedSymmetry ? i.add(t.appliedSymmetry.id) : i.add(r);
	let a = new Set(e.atoms.map((e) => e.uniqueId));
	for (let [e, t] of n) {
		let n = r;
		e.includes("|") && (n = e.split("|")[1].split("_")[0]), a.has(t) && i.add(n);
	}
	return Array.from(i);
}
function qt(e, t = 1e-6) {
	let { x: n, y: r, z: i } = e.position;
	return n >= -t && n < 1 - t && r >= -t && r < 1 - t && i >= -t && i < 1 - t;
}
function Jt(e, t = 3) {
	let n = e.position.x.toFixed(t), r = e.position.y.toFixed(t), i = e.position.z.toFixed(t);
	return `${e.label}_x${n}_y${r}_z${i}`;
}
function Yt(e, t, n) {
	let { symOp: r, transVector: i } = e.parsePositionCode(t), a = M(M(j(r.rotMatrix, A(n)), r.transVector), i), o = Math.floor(a.get([0])), s = Math.floor(a.get([1])), c = Math.floor(a.get([2])), l = t.split("_")[0], u = (t.split("_")[1] || "555").split("").map((e) => parseInt(e, 10)), d = `${u[0] - o}${u[1] - s}${u[2] - c}`;
	return {
		newCentre: N(a, A([
			o,
			s,
			c
		])),
		newString: `${l}_${d}`
	};
}
function Xt(e, t, n, r, i) {
	let a = [], o = t.applySymmetry(n, e.atoms);
	for (let s = 0; s < o.length; s++) {
		let c = o[s], l = e.atoms[s], u = n;
		l.appliedSymmetry && l.appliedSymmetry.key !== `${t.identitySymOpId}_555` && (u = t.combineSymmetryCodes(n, l.appliedSymmetry.key)), c.appliedSymmetry = Z.fromString(u);
		let d = c.uniqueId;
		if (i && !qt(c)) {
			let e = Math.floor(c.position.x), n = Math.floor(c.position.y), i = Math.floor(c.position.z);
			c.position.x -= e, c.position.y -= n, c.position.z -= i, c.appliedSymmetry.translation[0] -= e, c.appliedSymmetry.translation[1] -= n, c.appliedSymmetry.translation[2] -= i, c.appliedSymmetry._updateKey();
			let a = c.uniqueId, o = `${t.identitySymOpId}_${5 - e}${5 - n}${5 - i}`;
			r.atomTranslations.set(d, [a, o]);
		}
		let f = c.uniqueId, p = Jt(c), m = r.atomMap.get(p);
		m ? r.specialPositionMap.set(f, m) : (r.atomMap.set(p, f), a.push(c));
	}
	return a;
}
function Zt(e, t, n, r) {
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
function Qt(e, t, n, r) {
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
function $t(e, t, n, r) {
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
function en(e, t, n, r) {
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
function tn(e, t, n, r, i) {
	let { newCentre: a, newString: o } = Yt(t, t.combineSymmetryCodes(n, e.symmString), e.groupCentre);
	return {
		atoms: Xt(e, t, o, r, i),
		internalBonds: Zt(e, t, o, r),
		internalHBonds: Qt(e, t, o, r),
		externalBonds: $t(e, t, o, r),
		externalHBonds: en(e, t, o, r),
		symmString: o,
		groupCentre: a
	};
}
function nn(e, t = !0, n = null) {
	let r;
	if (r = n === null ? /* @__PURE__ */ new Map() : n, e.atoms.length === 0) return new W(e.cell, [], [], [], e.symmetry);
	let i = e.calculateConnectedGroups(), a = i.map((t) => {
		let n = Kt(t, e, r);
		return Array.from(Ut(e.symmetry, n));
	}), o = i.map((t) => e.bonds.filter((e) => e.atom2SiteSymmetry && e.atom2SiteSymmetry !== "." && t.atoms.some((t) => t.label === e.atom1Id.split("|")[0]))), s = i.map((t) => e.hBonds.filter((e) => e.acceptorAtomSymmetry && e.acceptorAtomSymmetry !== "." && t.atoms.some((t) => t.label === e.donorAtomId.split("|")[0]))), c = {
		atomMap: /* @__PURE__ */ new Map(),
		createdBonds: /* @__PURE__ */ new Set(),
		createdHBonds: /* @__PURE__ */ new Set(),
		specialPositionMap: r,
		atomTranslations: /* @__PURE__ */ new Map()
	}, l = [];
	for (let n = 0; n < i.length; n++) {
		let r = i[n], u = a[n], d = Gt(r.atoms), f = u[0], p = {
			atoms: r.atoms,
			internalBonds: r.bonds,
			internalHBonds: r.hBonds,
			symmString: `${f}_555`,
			groupCentre: d,
			externalBonds: o[n],
			externalHBonds: s[n]
		};
		for (let n of u) {
			let r = `${n}_555`, i = tn(p, e.symmetry, r, c, t);
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
		if (e.bondLength > Ht) return !1;
		let t = g.get(e.atom1Id), n = g.get(e.atom2Id);
		if (!t || !n) return e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		let r = v(t), i = v(n), a = Math.hypot(r.x - i.x, r.y - i.y, r.z - i.z), o = Math.max(.15, e.bondLength * .1);
		return a <= e.bondLength + o;
	}, b = p.filter((e) => {
		let t = h.has(e.atom1Id), n = e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		return t && (h.has(e.atom2Id) || n) && y(e);
	}), x = m.filter((e) => h.has(e.donorAtomId) && h.has(e.hydrogenAtomId)), S = b, C = new W(e.cell, f, S, x, e.symmetry), w = /* @__PURE__ */ new Map();
	for (let e of C.calculateConnectedGroups()) {
		let t = Gt(e.atoms).toArray().map((e) => Math.floor(e));
		for (let n of e.atoms) {
			let e = n.uniqueId;
			n.position.x -= t[0], n.position.y -= t[1], n.position.z -= t[2], n.appliedSymmetry && (n.appliedSymmetry.translation[0] -= t[0], n.appliedSymmetry.translation[1] -= t[1], n.appliedSymmetry.translation[2] -= t[2], n.appliedSymmetry._updateKey()), w.set(e, n.uniqueId);
		}
	}
	let ee = [], te = /* @__PURE__ */ new Map(), ne = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new Map();
	for (let e of f) {
		let t = Jt(e), n = ne.get(e.uniqueId) || te.get(t);
		n ? T.set(e.uniqueId, n) : (te.set(t, e.uniqueId), ne.set(e.uniqueId, e.uniqueId), ee.push(e));
	}
	for (let [e, t] of w) w.set(e, T.get(t) || t);
	let E = [], D = /* @__PURE__ */ new Set();
	for (let e of b) {
		let t = w.get(e.atom1Id) || e.atom1Id, n = w.get(e.atom2Id) || e.atom2Id;
		if (t === n) continue;
		let r = Q(t, n);
		D.has(r) || (e.atom1Id = t, e.atom2Id = n, E.push(e), D.add(r));
	}
	let O = [], k = /* @__PURE__ */ new Set();
	for (let e of x) {
		e.donorAtomId = w.get(e.donorAtomId) || e.donorAtomId, e.hydrogenAtomId = w.get(e.hydrogenAtomId) || e.hydrogenAtomId, e.acceptorAtomId = w.get(e.acceptorAtomId) || e.acceptorAtomId;
		let t = $(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId);
		k.has(t) || (O.push(e), k.add(t));
	}
	return new W(e.cell, ee, E, O, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-hbonds.js
function rn(e, t) {
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
function an(e) {
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
	return new W(e.cell, e.atoms, e.bonds, o, e.symmetry);
}
function on(e, t = /* @__PURE__ */ new Map()) {
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
	return new W(e.cell, l, u, a, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/modes.js
var sn = class e extends J {
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
		let n = t.atoms.filter((t) => t.atomType !== "H" || this.mode !== e.MODES.NONE).map((t) => new Ne(t.label, t.atomType, t.position, t.atomType === "H" && this.mode === e.MODES.CONSTANT ? null : t.adp, t.disorderGroup, t.appliedSymmetry)), r = t.bonds.filter((n) => {
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
		return new W(t.cell, n, r, i, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [e.MODES.NONE];
		return t.atoms.some((e) => e.atomType === "H") ? (n.push(e.MODES.CONSTANT), t.atoms.some((e) => e.atomType === "H" && e.adp instanceof R) && n.push(e.MODES.ANISOTROPIC), n) : n;
	}
}, cn = class e extends J {
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
		return new W(t.cell, o, s, c, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [...new Set(t.atoms.map((e) => Number(e.disorderGroup)).filter((e) => e > 0))].sort((e, t) => e - t);
		this._groupValuesByRank = n;
		let r = { ALL: e.MODES.ALL };
		return n.forEach((t, i) => {
			r[`GROUP${i + 1}`] = e.modeForGroup(i + 1, n.length);
		}), this.MODES = Object.freeze(r), Object.values(this.MODES);
	}
}, ln = class e extends J {
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
		let n = this.mode === e.MODES.NONE ? t : new W(t.cell, t.atoms, Ot(t), t.hBonds, t.symmetry), r = /* @__PURE__ */ new Map();
		if (this.mode === e.MODES.FRAGMENT || this.mode === e.MODES.FRAGMENT_HBONDS) {
			let e = Vt(n);
			n = e.grownStructure, r = e.specialPositionAtoms;
		}
		if (this.mode === e.MODES.CELL) n = nn(n);
		else if (this.mode === e.MODES.FRAGMENT_CELL) {
			let e = Vt(n);
			r = e.specialPositionAtoms, n = nn(e.grownStructure, !1, r), n = an(n);
		}
		return (this.mode === e.MODES.HBONDS || this.mode === e.MODES.FRAGMENT_HBONDS) && (this.mode === e.MODES.FRAGMENT_HBONDS && (n = new W(n.cell, n.atoms, rn(n, n.bonds), n.hBonds, n.symmetry)), n = on(n, r), this.mode === e.MODES.FRAGMENT_HBONDS && (n = new W(n.cell, n.atoms, rn(n, n.bonds), n.hBonds, n.symmetry), n = an(n))), n;
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
}, un = class e extends J {
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
		return new W(t.cell, r, i, a, t.symmetry);
	}
	getApplicableModes() {
		return Object.values(e.MODES);
	}
}, dn = class e extends J {
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
		return Re.has(e) || Re.has(t) ? Math.min(this.tolerance, .4) : this.tolerance;
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
				o.set(e.atomType, U(e.atomType));
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
					if ((r.atomType === "H" || u.atomType === "H") && (s.has(r.uniqueId) || s.has(u.uniqueId)) || !Pe(r, u)) continue;
					let d = a.get(u.uniqueId), f = c[0] - d[0], p = c[1] - d[1], m = c[2] - d[2], h = this.getMaxBondDistance(o.get(r.atomType), o.get(u.atomType), t);
					if (Math.abs(f) > h || Math.abs(p) > h || Math.abs(m) > h) continue;
					let g = F([
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
		return new W(t.cell, t.atoms, n, t.hBonds, t.symmetry);
	}
	getApplicableModes(t) {
		return t.bonds.length > 0 ? [
			e.MODES.KEEP,
			e.MODES.ADD,
			e.MODES.REPLACE
		] : [e.MODES.CREATE, e.MODES.IGNORE];
	}
}, fn = class e extends J {
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
		return new W(t.cell, t.atoms, [...t.bonds, ...r], t.hBonds, t.symmetry);
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
				if (i.atomType !== "H" && Pe(i, t)) {
					let r = i.position.toCartesian(e.cell), o = F(N(a, [
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
				if (r.atomType === "H" || !Pe(r, t)) continue;
				let s = r.position.toCartesian(e.cell), c = F(N(a, [
					s.x,
					s.y,
					s.z
				]));
				c <= this.maxBondDistance && (n.push(new V(r.uniqueId, t.uniqueId, c, null, ".")), o = !0);
			}
			if (!o && r < e.atoms.length - 1) for (let i = r + 1; i < e.atoms.length && !o; i++) {
				let r = e.atoms[i];
				if (r.atomType === "H" || !(r.disorderGroup === t.disorderGroup || r.disorderGroup === 0 || t.disorderGroup === 0)) continue;
				let s = r.position.toCartesian(e.cell), c = F(N(a, [
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
function pn(t) {
	let n = new e.Vector3();
	t.forEach((e) => n.add(e)), n.divideScalar(t.length);
	let r = new e.Matrix3(), i = new e.Vector3();
	t.forEach((e) => {
		i.copy(e).sub(n), r.elements[0] += i.x * i.x, r.elements[1] += i.x * i.y, r.elements[2] += i.x * i.z, r.elements[3] += i.y * i.x, r.elements[4] += i.y * i.y, r.elements[5] += i.y * i.z, r.elements[6] += i.z * i.x, r.elements[7] += i.z * i.y, r.elements[8] += i.z * i.z;
	});
	let { values: a, eigenvectors: o } = me(mn(r)), s = fe(a);
	if (s <= 0) return console.warn("Could not find a mean plane, expected?"), new e.Vector3(0, 1, 0);
	let c = o.filter((e) => e.value === s)[0].vector, l = new e.Vector3(...c.toArray());
	return l.normalize(), l;
}
function mn(e) {
	let t = e.elements;
	return A([
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
function hn(t) {
	let n = [], r = new e.Vector3();
	if (t.traverse((e) => {
		e.userData?.type === "atom" && (n.push(e.position.clone()), r.add(e.position));
	}), n.length === 0) return null;
	r.divideScalar(n.length);
	let i = n.map((e) => e.sub(r)), a = pn(i), o = new e.Vector3(0, 0, 1), s = new e.Quaternion();
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
function gn(t, n) {
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
var _n = class {
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
			this.state.isDragging = !1, this.state.pinchStartDistance = 0;
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
		this.state.isDragging = !1, this.state.isPanning = !1;
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
}, vn = class t {
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
}, yn = class extends vn {
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
}, bn = class extends vn {
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
function xn(e, t) {
	switch ((t.camera?.type || "perspective").toLowerCase()) {
		case "orthographic": return new bn(e, t.camera);
		default: return new yn(e, t.camera);
	}
}
//#endregion
//#region src/lib/ortep3d/cell3d.js
function Sn(t, n, r, i, a) {
	let o = t.clone().normalize(), s = t.length() - r, c = new e.CylinderGeometry(a, a, s, 8), l = new e.MeshBasicMaterial({ color: n }), u = new e.Mesh(c, l), d = new e.ConeGeometry(i, r, 8), f = new e.MeshBasicMaterial({ color: n }), p = new e.Mesh(d, f), m = new e.Vector3(0, 1, 0), h = new e.Quaternion();
	h.setFromUnitVectors(m, o), u.applyQuaternion(h), p.applyQuaternion(h), u.position.copy(o.clone().multiplyScalar(s / 2)), p.position.copy(o.clone().multiplyScalar(s + r / 2));
	let g = new e.Group();
	return g.add(u), g.add(p), g;
}
function Cn(t, n, r, i) {
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
function wn(t, n) {
	let { boxColor: r, boxOpacity: i, boxLineWidth: a, arrowColorA: o, arrowColorB: s, arrowColorC: c, arrowHeadLengthMult: l, arrowHeadWidthMult: u, arrowCylinderRadius: d } = n, f = new e.Group(), p = t.fractToCartMatrix.toArray(), m = new e.Matrix4(p[0][0], p[0][1], p[0][2], 0, p[1][0], p[1][1], p[1][2], 0, p[2][0], p[2][1], p[2][2], 0, 0, 0, 0, 1), h = Cn(m, r, i, a);
	f.add(h);
	let g = new e.Vector3(), _ = new e.Vector3(), v = new e.Vector3();
	m.extractBasis(g, _, v);
	let { a: y, b, c: x } = t, S = Math.max(y, b, x) * l, C = S * u, w = Sn(g, o, S, C, d), ee = Sn(_, s, S, C, d), te = Sn(v, c, S, C, d);
	return f.add(w), f.add(ee), f.add(te), f.name = "UnitCell", f.userData = {
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
//#region src/lib/ortep3d/crystal-viewer.js
var Tn = class {
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
}, En = class {
	constructor(t, n = {}) {
		let r = ["constant", "onDemand"];
		if (n.renderMode && !r.includes(n.renderMode)) throw Error(`Invalid render mode: "${n.renderMode}". Must be one of: ${r.join(", ")}`);
		let i = [
			"solid-3d",
			"cutout-3d",
			"cutout-2d"
		];
		if (n.renderStyle && !i.includes(n.renderStyle)) throw Error(`Invalid render style: "${n.renderStyle}". Must be one of: ${i.join(", ")}`);
		this.container = t;
		let a = n.camera?.initialPosition ?? G.camera.initialPosition;
		this.options = {
			camera: {
				...G.camera,
				...n.camera || {},
				initialPosition: a.isVector3 ? a.clone() : new e.Vector3(...a)
			},
			selection: {
				...G.selection,
				...n.selection || {}
			},
			interaction: {
				...G.interaction,
				...n.interaction || {}
			},
			atomDetail: n.atomDetail || G.atomDetail,
			atomCutawayHysteresis: n.atomCutawayHysteresis ?? G.atomCutawayHysteresis,
			atomCutawayStripeCount: n.atomCutawayStripeCount ?? G.atomCutawayStripeCount,
			atomCutawayStripeWidth: n.atomCutawayStripeWidth ?? G.atomCutawayStripeWidth,
			atomColorRoughness: n.atomColorRoughness || G.atomColorRoughness,
			atomColorMetalness: n.atomColorMetalness || G.atomColorMetalness,
			atomADPRingWidthFactor: n.atomADPRingWidthFactor || G.atomADPRingWidthFactor,
			atomADPRingHeight: n.atomADPRingHeight || G.atomADPRingHeight,
			atomADPRingSections: n.atomADPRingSections || G.atomADPRingSections,
			bondRadius: n.bondRadius || G.bondRadius,
			bondSections: n.bondSections || G.bondSections,
			bondColor: n.bondColor || G.bondColor,
			bondColorRoughness: n.bondColorRoughness || G.bondColorRoughness,
			bondColorMetalness: n.bondColorMetalness || G.bondColorMetalness,
			bondGrowTolerance: n.bondGrowTolerance ?? G.bondGrowTolerance,
			elementProperties: {
				...G.elementProperties,
				...n.elementProperties
			},
			hydrogenMode: n.hydrogenMode || G.hydrogenMode,
			disorderMode: n.disorderMode || G.disorderMode,
			symmetryMode: n.symmetryMode || G.symmetryMode,
			renderMode: n.renderMode || G.renderMode,
			renderStyle: n.renderStyle || G.renderStyle,
			plot2DBackground: n.plot2DBackground || G.plot2DBackground,
			plot2DAtomColor: n.plot2DAtomColor || G.plot2DAtomColor,
			plot2DLineColor: n.plot2DLineColor || G.plot2DLineColor,
			plot2DBondColor: n.plot2DBondColor || G.plot2DBondColor,
			plot2DOpenBondInnerScale: n.plot2DOpenBondInnerScale ?? G.plot2DOpenBondInnerScale,
			plot2DStripeCount: n.plot2DStripeCount ?? G.plot2DStripeCount,
			plot2DStripeWidth: n.plot2DStripeWidth ?? G.plot2DStripeWidth,
			plot2DOutlineScale: n.plot2DOutlineScale ?? G.plot2DOutlineScale,
			fixCifErrors: n.fixCifErrors || G.fixCifErrors,
			cell: {
				...G.cell,
				...n.cell
			}
		}, this.state = {
			isDragging: !1,
			currentCifContent: null,
			currentCifBlock: null,
			currentStructure: null,
			currentFloor: null,
			baseStructure: null,
			ortepObjects: /* @__PURE__ */ new Map(),
			structureCenter: new e.Vector3()
		}, this.modifiers = {
			removeatoms: new un(),
			addhydrogen: new fn(),
			missingbonds: new dn(this.options.elementProperties, this.options.bondGrowTolerance),
			disorder: new cn(this.options.disorderMode),
			symmetry: new ln(this.options.symmetryMode),
			hydrogen: new sn(this.options.hydrogenMode)
		}, this.selections = new Tn(this.options), this.setupScene(), this.controls = new _n(this), this.animate(), this.needsRender = !0;
	}
	setupScene() {
		this.scene = new e.Scene(), this.cameraController = xn(this.container, this.options), this.camera = this.cameraController.camera, this.renderer = new e.WebGLRenderer({
			antialias: !0,
			alpha: !0
		}), this.options.renderStyle === "cutout-2d" && this.renderer.setClearColor(this.options.plot2DBackground, 1), this.resizeRendererToDisplaySize(), this.container.appendChild(this.renderer.domElement), this.moleculeContainer = new e.Group(), this.scene.add(this.moleculeContainer), this.camera.position.copy(this.options.camera.initialPosition), this.cameraTarget = new e.Vector3(0, 0, 0), this.camera.lookAt(this.cameraTarget);
	}
	async loadCIF(e, t = 0) {
		if (e === void 0) return console.error("Cannot load an empty text as CIF"), {
			success: !1,
			error: "Cannot load an empty text as CIF"
		};
		try {
			let n = new ne(e), r;
			try {
				r = typeof t == "number" ? n.getBlock(t) : n.getBlockByName(t);
			} catch (e) {
				return {
					success: !1,
					error: e.message
				};
			}
			let i;
			try {
				i = W.fromCIF(r);
			} catch (e) {
				if (this.options.fixCifErrors) throw e;
				try {
					let e = xt(r);
					i = W.fromCIF(e);
				} catch {
					throw e;
				}
			}
			return await this.loadStructure(i), this.state.currentCifContent = e, this.state.currentCifBlock = t, { success: !0 };
		} catch (e) {
			return console.error("Error loading structure:", e), {
				success: !1,
				error: e.message
			};
		}
	}
	async loadStructure(t = this.state.baseStructure) {
		this.state.baseStructure = t, this.selections.clear(), this.moleculeContainer.position.set(0, 0, 0), this.moleculeContainer.rotation.set(0, 0, 0), this.moleculeContainer.scale.set(1, 1, 1), this.moleculeContainer.updateMatrix(), this.moleculeContainer.matrixAutoUpdate = !0, this.moleculeContainer.updateMatrixWorld(!0), this.cameraTarget.set(0, 0, 0), this.camera.position.copy(this.options.camera.initialPosition), this.camera.lookAt(this.cameraTarget), this.state.structureCenter.set(0, 0, 0), this.update3DOrtep();
		let n = hn(this.state.currentStructure);
		return this.container.clientHeight > this.container.clientWidth && n.premultiply(new e.Matrix4().makeRotationZ(Math.PI / 2)), n && (this.moleculeContainer.setRotationFromMatrix(n), this.moleculeContainer.updateMatrix()), new e.Box3().setFromObject(this.moleculeContainer).getCenter(this.state.structureCenter), this.moleculeContainer.position.sub(this.state.structureCenter), this.updateCamera(), gn(this.scene, this.state.currentStructure), this.requestRender(), { success: !0 };
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
			let t = wn(e.cell, this.options.cell);
			this.moleculeContainer.add(t);
		}
		let n = new $e(e, this.options).getGroup();
		this.moleculeContainer.add(n), this.state.currentStructure = n, this.selections.pruneInvalidSelections(this.moleculeContainer);
	}
	updateCamera() {
		this.controls.handleResize(), this.cameraController.fitToStructure(this.moleculeContainer), this.requestRender();
	}
	removeStructure() {
		this.moleculeContainer.traverse((e) => {
			e.geometry && e.geometry.dispose(), e.material && e.material.dispose();
		}), this.moleculeContainer.clear();
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
		(this.options.renderMode === "constant" || this.needsRender) && (this.updateCameraFacingOctants(), this.renderer.render(this.scene, this.camera), this.needsRender = !1), requestAnimationFrame(this.animate.bind(this));
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
	dispose() {
		this.controls.dispose(), this.scene.traverse((e) => {
			e.geometry && e.geometry.dispose(), e.material && (Array.isArray(e.material) ? e.material.forEach((e) => e.dispose()) : e.material.dispose());
		}), this.selections.dispose(), this.renderer.dispose(), this.renderer.domElement.parentNode && this.renderer.domElement.parentNode.removeChild(this.renderer.domElement), this.scene = null, this.camera = null, this.renderer = null, this.state = null, this.options = null;
	}
}, Dn = {
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
}, On = "\n  cifview-widget {\n    display: flex;\n    flex-direction: column;\n    font-family: system-ui, -apple-system, sans-serif;\n    height: 100%;\n    position: relative;\n    background: var(--cifvis-bg, #fafafa);\n    border-radius: var(--cifvis-radius, 8px);\n    overflow: hidden;\n  }\n\n  cifview-widget .crystal-container {\n    flex: 1;\n    min-height: 0;\n    position: relative;\n  }\n\n  cifview-widget .crystal-caption {\n    padding: 12px 16px;\n    background: var(--cifvis-caption-bg, #ffffff);\n    border-top: 1px solid var(--cifvis-caption-border, #eaeaea);\n    color: var(--cifvis-caption-color, #333);\n    font-size: 14px;\n    line-height: 1.5;\n  }\n\n  cifview-widget .button-container {\n    position: absolute;\n    top: 16px;\n    right: 16px;\n    display: flex;\n    gap: 8px;\n    z-index: 1000;\n  }\n\n  cifview-widget .control-button {\n    width: 40px;\n    height: 40px;\n    border: none;\n    border-radius: var(--cifvis-button-radius, 8px);\n    background: var(--cifvis-button-bg, rgba(255, 255, 255, 0.9));\n    cursor: pointer;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 8px;\n    transition: all 0.2s ease;\n    box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n  }\n\n  cifview-widget .control-button:hover {\n    background: var(--cifvis-button-hover-bg, #ffffff);\n    box-shadow: 0 4px 8px rgba(0,0,0,0.15);\n  }\n\n  cifview-widget .control-button svg {\n    width: 24px;\n    height: 24px;\n  }\n", kn = class extends HTMLElement {
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
			"block"
		];
	}
	constructor() {
		if (super(), !document.getElementById("cifview-styles")) {
			let e = document.createElement("style");
			e.id = "cifview-styles", e.textContent = On, document.head.appendChild(e);
		}
		this.viewer = null, this.baseCaption = "", this.selections = [], this.customIcons = null, this.userOptions = {}, this.defaultCaption = "Generated with <a href=\"https://github.com/Niolon/cifvis\">CifVis</a>.";
	}
	get icons() {
		return {
			...Dn,
			...this.customIcons
		};
	}
	async connectedCallback() {
		this.baseCaption = this.getAttribute("caption") || this.defaultCaption, this.parseOptions(), this.parseInitialModes();
		let e = document.createElement("div");
		e.className = "crystal-container", this.appendChild(e);
		let t = document.createElement("div");
		t.className = "button-container", e.appendChild(t), this.buttonContainer = t;
		let n = document.createElement("div");
		n.className = "crystal-caption", n.innerHTML = this.baseCaption, this.appendChild(n), this.captionElement = n, this.viewer = new En(e, this.userOptions), this.viewer.selections.onChange((e) => {
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
		let t = { ...G };
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
		return e === "disorder" ? St(this.icons.disorder, t) : this.icons[e]?.[t] || "";
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
			case "options":
				if (this.parseOptions(), this.viewer) {
					let e = this.querySelector(".crystal-container"), t = this.viewer.state.currentCifContent, n = this.viewer.state.currentCifBlock;
					this.viewer.dispose(), this.viewer = new En(e, this.userOptions), this.viewer.selections.onChange((e) => {
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
					let t = mt(e.data.bondLength, e.data.bondLengthSU);
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
	window.customElements.define("cifview-widget", kn);
} catch (e) {
	e.message.includes("already been defined") || console.warn("Failed to register cifview-widget:", e);
}
//#endregion
export { un as AtomLabelFilter, dn as BondGenerator, ne as CIF, kn as CifViewWidget, W as CrystalStructure, En as CrystalViewer, cn as DisorderFilter, sn as HydrogenFilter, $e as ORTEP3JsStructure, ln as SymmetryGrower, mt as formatValueEsd, Ct as generateDisorderGroupIcon, St as getDisorderIcon, xt as tryToFixCifBlock };
