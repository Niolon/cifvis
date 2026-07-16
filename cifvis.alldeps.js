//#region src/lib/read-cif/helpers.js
function e(e, t = !0, n = 1) {
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
function t(e, t) {
	let n = [e[t].slice(1)], r = e.slice(t + 1), i = r.findIndex((e) => e.startsWith(";")), a = n.concat(r.slice(0, i)), o = a.findIndex((e) => e.trim() !== ""), s = a.findLastIndex((e) => e.trim !== "");
	return {
		value: a.slice(o, s + 1).join("\n"),
		endIndex: t + i + 1
	};
}
//#endregion
//#region src/lib/read-cif/cif2-values.js
function n(t, n, a) {
	let o = t[n];
	if (!o) throw Error("Unexpected end of CIF2 value stream");
	switch (o.type) {
		case "value": {
			if (o.quoted) return {
				value: o.value,
				su: NaN,
				nextPos: n + 1
			};
			let t = e(o.value, a, 2);
			return {
				value: t.value,
				su: t.su,
				nextPos: n + 1
			};
		}
		case "listOpen": return r(t, n, a);
		case "tableOpen": return i(t, n, a);
		default: throw Error(`Unexpected token '${o.type}' where a CIF2 value was expected`);
	}
}
function r(e, t, r) {
	let i = [], a = t + 1;
	for (; e[a] && e[a].type !== "listClose";) {
		let t = n(e, a, r);
		i.push(t.value), a = t.nextPos;
	}
	if (!e[a]) throw Error("Unterminated CIF2 list value");
	return {
		value: i,
		su: NaN,
		nextPos: a + 1
	};
}
function i(e, t, r) {
	let i = /* @__PURE__ */ new Map(), a = t + 1;
	for (; e[a] && e[a].type !== "tableClose";) {
		let t = e[a];
		if (t.type !== "value") throw Error("CIF2 table key must be a quoted string");
		if (!e[a + 1] || e[a + 1].type !== "colon") throw Error(`CIF2 table entry for key '${t.value}' is missing its colon`);
		let o = n(e, a + 2, r);
		i.set(t.value, o.value), a = o.nextPos;
	}
	if (!e[a]) throw Error("Unterminated CIF2 table value");
	return {
		value: i,
		su: NaN,
		nextPos: a + 1
	};
}
function a(e, t) {
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
var o = /* @__PURE__ */ "_space_group_symop_ssg._space_group_symop._symmetry_equiv._geom_bond._geom_hbond._geom_angle._geom_torsion._diffrn_refln._refln._atom_site_fourier_wave_vector._atom_site_moment_fourier_param._atom_site_moment_special_func._atom_site_moment._atom_site_rotation._atom_site_displace_Fourier._atom_site_displace_special_func._atom_site_occ_Fourier._atom_site_occ_special_func._atom_site_phason._atom_site_rot_Fourier_param._atom_site_rot_Fourier._atom_site_rot_special_func._atom_site_U_Fourier._atom_site_anharm_gc_c._atom_site_anharm_gc_d._atom_site_aniso._atom_site".split("."), s = class r {
	constructor(e, t, n, r, i = null) {
		this.splitSU = r, this.headerLines = e, this.dataLines = t, this.endIndex = n, this.headers = null, this.data = null, this.name = null, i ? this.name = i : this.name = this.findCommonStart();
	}
	static fromLines(e, t) {
		let n = 1;
		for (; n < e.length && e[n].trim().startsWith("_");) n++;
		let i = e.slice(1, n).map((e) => e.trim()), a = n, o = !1;
		for (; a < e.length && (!e[a].trim().startsWith("_") && !e[a].trim().startsWith("loop_") || o);) e[a].startsWith(";") && (o = !o), a++;
		let s = e.slice(n, a);
		return new r(i, s, a, t);
	}
	static fromTokens(e, t, n, i) {
		let a = new r(e, [], 0, i);
		return a._cif2Tokens = t, a._cif2CellTokenRanges = n, a;
	}
	parse() {
		if (this.data !== null) return;
		this.headers = [...this.headerLines], this.data = {};
		let r = this._cif2CellTokenRanges === void 0 ? this.dataLines.reduce((n, r, i) => {
			if (r = r.trim(), !r.length) return n;
			if (r.startsWith(";")) {
				let e = t(this.dataLines, i);
				n.push({
					value: e.value,
					su: NaN
				});
				for (let t = i; t < e.endIndex + 1; t++) this.dataLines[t] = "";
				return n;
			}
			let a = Array.from(r.matchAll(/'([^']*(?:'\S[^']*)*)'|"([^"]*(?:"\S[^"]*)*)"|\S+/g));
			return n.concat(a.map((t) => e(t[1] || t[2] || t[0], this.splitSU)));
		}, []) : this._cif2CellTokenRanges.map(([e]) => {
			let t = n(this._cif2Tokens, e, this.splitSU);
			return {
				value: t.value,
				su: t.su
			};
		}), i = this.headers.length;
		if (r.length % i !== 0) {
			let e = r.map(({ value: e, su: t }) => `{value: ${e}, su: ${t}}`).join(", ");
			throw Error(`Loop ${this.name}: Cannot distribute ${r.length} values evenly into ${i} columns\nentries are: ${e}`);
		} else if (r.length === 0) throw Error(`Loop ${this.name} has no data values.`);
		for (let e = 0; e < i; e++) {
			let t = this.headers[e], n = r.slice(e).filter((e, t) => t % i === 0);
			n.some((e) => !isNaN(e.su)) ? (this.data[t] = n.map((e) => e.value), this.data[t + "_su"] = n.map((e) => e.su), this.headers.push(t + "_su")) : this.data[t] = n.map((e) => e.value);
		}
	}
	findCommonStart(e = !0) {
		if (e) {
			for (let e of o) if (this.headerLines.filter((t) => t.toLowerCase().startsWith(e.toLowerCase())).length >= this.headerLines.length / 2) return e;
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
function c(e) {
	return e && typeof e.getHeaders == "function";
}
function l(e) {
	return e.getHeaders()[0].split("_").filter((e) => e.length > 0);
}
function u(e, t, n) {
	let r = c(e) ? e : t, i = n.split("_").filter((e) => e.length > 0), a = l(r), o = "_" + i.join("_") + "_" + a[i.length];
	return c(e) ? [o, n] : [n, o];
}
function d(e, t) {
	let n = e.findCommonStart(!1), r = t.findCommonStart(!1);
	return n.length === r.length ? null : [n, r];
}
function f(e, t, n) {
	let r = n.split("_").filter((e) => e.length > 0), i = l(e), a = l(t);
	return i.length >= a.length ? [n + "_" + i[r.length], n] : [n, n + "_" + a[r.length]];
}
function p(e, t, n) {
	let r;
	r = !c(e) || !c(t) ? u(e, t, n) : d(e, t) || f(e, t, n);
	let i = [e, t];
	return i.forEach((e, t) => {
		c(e) && (e.name = r[t]);
	}), {
		newNames: r,
		newEntries: i
	};
}
//#endregion
//#region src/lib/read-cif/version.js
function m(e) {
	return e.charCodeAt(0) === 65279 ? e.slice(1) : e;
}
function h(e) {
	let t = m(e);
	return /^#\\#CIF_2\.0/.test(t) ? 2 : 1;
}
//#endregion
//#region src/lib/read-cif/tokenizer.js
var g = /* @__PURE__ */ new Set([
	" ",
	"	",
	"\r",
	"\n"
]), _ = /* @__PURE__ */ new Set([
	"[",
	"]",
	"{",
	"}"
]);
function v(e, t, n, r) {
	if (e[t + 1] === n && e[t + 2] === n) {
		let i = n + n + n, a = e.indexOf(i, t + 3);
		if (a === -1) throw Error(`Unterminated triple-quoted string starting on line ${r}`);
		let o = e.slice(t + 3, a);
		return {
			value: o,
			next: a + 3,
			newlines: b(o)
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
function y(e, t, n) {
	let r = e.indexOf("\n;", t);
	if (r === -1) throw Error(`Unterminated text field starting on line ${n}`);
	let i = e.slice(t + 1, r);
	return i.startsWith("\n") && (i = i.slice(1)), {
		value: i,
		next: r + 2,
		newlines: b(e.slice(t, r + 2))
	};
}
function b(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] === "\n" && t++;
	return t;
}
function x(e, t) {
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
function S(e) {
	let t = e.replace(/\r\n?/g, "\n"), n = [], r = t.length, i = 0, a = 1, o = !0;
	for (; i < r;) {
		let e = t[i];
		if (e === "\n") {
			i++, a++, o = !0;
			continue;
		}
		if (g.has(e)) {
			i++, o = !1;
			continue;
		}
		if (e === "#") {
			for (; i < r && t[i] !== "\n";) i++;
			continue;
		}
		if (e === ";" && o) {
			let e = y(t, i, a);
			n.push({
				type: "value",
				value: e.value,
				quoted: !0,
				line: a
			}), i = e.next, a += e.newlines, o = !1;
			continue;
		}
		if (_.has(e)) {
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
			let r = v(t, i, e, a);
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
		for (; i < r && !g.has(t[i]) && !_.has(t[i]);) i++;
		n.push(x(t.slice(s, i), a)), o = !1;
	}
	return n;
}
//#endregion
//#region src/lib/read-cif/base.js
function C(e) {
	let t = [], n = null, r = 0;
	for (let i of e) i.type === "listOpen" || i.type === "tableOpen" ? r++ : (i.type === "listClose" || i.type === "tableClose") && r--, i.type === "data" && r === 0 ? (n = [i], t.push(n)) : n && n.push(i);
	return t;
}
var w = class {
	constructor(e, t = !0) {
		this.splitSU = t;
		let n = m(e);
		this.version = h(n), this.rawCifBlocks = this.version === 2 ? C(S(n)) : this.splitCifBlocks("\n\n" + n), this.blocks = Array(this.rawCifBlocks.length).fill(null), this._blockNameMap = null;
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
		let n = this.rawText.split("\n").filter((e) => !e.trim().startsWith("#")).map((e) => e.split(/ #(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/)[0]);
		this.dataBlockName = n[0];
		let r = 1;
		for (; r < n.length;) {
			if (r + 1 < n.length && n[r + 1].startsWith(";")) {
				let e = t(n, r + 1);
				this.data[n[r]] = e.value, r = e.endIndex + 1;
				continue;
			}
			if (n[r].trim().startsWith("loop_")) {
				let e = s.fromLines(n.slice(r), this.splitSU);
				if (!Object.prototype.hasOwnProperty.call(this.data, e.getName())) this.data[e.getName()] = e;
				else {
					let t = p(this.data[e.getName()], e, e.getName());
					this.data[t.newNames[0]] = t.newEntries[0], this.data[t.newNames[1]] = t.newEntries[1];
				}
				r += e.getEndIndex();
				continue;
			}
			let i = n[r].trim();
			if (i.length === 0) {
				r++;
				continue;
			}
			let a = i.match(/^(_\S+)\s+(.*)$/);
			if (a) {
				let t = a[1], n = e(a[2], this.splitSU);
				this.data[t] = n.value, isNaN(n.su) || (this.data[t + "_su"] = n.su);
			} else if (i.startsWith("_") && !n[r + 1].startsWith("_")) {
				let t = i, a = e(n[r + 1].trim(), this.splitSU);
				this.data[t] = a.value, isNaN(a.su) || (this.data[t + "_su"] = a.su), r++;
			} else throw Error("Could not parse line " + String(r) + ": " + n[r]);
			r++;
		}
	}
	parseV2() {
		this.data = {};
		let e = this.tokens;
		this.dataBlockName = e[0] && e[0].type === "data" ? e[0].value : null;
		let t = 1, r = 0;
		for (; t < e.length;) {
			let i = e[t];
			if (i.type === "save") {
				r++, t++;
				continue;
			}
			if (i.type === "saveEnd") {
				r > 0 && r--, t++;
				continue;
			}
			if (r > 0 || i.type === "global" || i.type === "stop") {
				t++;
				continue;
			}
			if (i.type === "tag") {
				let r = n(e, t + 1, this.splitSU);
				this.data[i.value] = r.value, isNaN(r.su) || (this.data[i.value + "_su"] = r.su), t = r.nextPos;
				continue;
			}
			if (i.type === "loop") {
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
			n = a(e, n), i.push([t, n]);
		}
		let o = s.fromTokens(r, e, i, this.splitSU);
		if (!Object.prototype.hasOwnProperty.call(this.data, o.getName())) this.data[o.getName()] = o;
		else {
			let e = p(this.data[o.getName()], o, o.getName());
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
function ee(e, t) {
	return O([e, t], k(D(e), D(t), (e, t) => e + t));
}
function M(e, t) {
	return O([e, t], k(D(e), D(t), (e, t) => e - t));
}
function N(e) {
	let t = D(e), n = t[0].map((e, n) => t.map((e) => e[n]));
	return O([e], n);
}
function te(e) {
	let t = D(e);
	if (t.length !== 3) throw Error("det: only 3x3 matrices are supported");
	return t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1]) - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0]) + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0]);
}
function P(e) {
	let t = D(e);
	if (t.length !== 3) throw Error("inv: only 3x3 matrices are supported");
	let n = te(t);
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
function ne(e) {
	let t = D(e), n = t.length, r = Array.from({ length: n }, (e, r) => Array.from({ length: n }, (e, n) => r === n ? t[r] : 0));
	return O([e], r);
}
function re(e) {
	let t = D(e);
	return Math.sqrt(t.reduce((e, t) => e + t * t, 0));
}
function ie(e, t) {
	if (t !== "deg") throw Error(`unit: unsupported unit '${t}'`);
	return { toNumber(t) {
		if (t !== "rad") throw Error(`unit: unsupported conversion to '${t}'`);
		return e * Math.PI / 180;
	} };
}
function ae(e) {
	return Array.from({ length: e }, (t, n) => Array.from({ length: e }, (e, t) => +(n === t)));
}
function oe(e) {
	return Array(e).fill(0);
}
function se(e) {
	let t = D(e), n = Array.isArray(t[0]) ? t.map((e) => [...e]) : [...t];
	return O([e], n);
}
function F(e, t) {
	return k(D(e), D(t), (e, t) => e === t);
}
var ce = Math.abs, le = (e) => Math.min(...D(e));
function ue(e) {
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
function de(e) {
	let { eigenvalues: t, eigenvectors: n } = ue(D(e));
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
function fe(e) {
	let t = ie(e.alpha, "deg").toNumber("rad"), n = ie(e.beta, "deg").toNumber("rad"), r = ie(e.gamma, "deg").toNumber("rad"), i = Math.cos(t), a = Math.cos(n), o = Math.cos(r), s = Math.sin(r), c = Math.sqrt(1 - i * i - a * a - o * o + 2 * i * a * o);
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
function pe(e) {
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
function me(e) {
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
function he(e, t) {
	let n = A(e), r = ne(A(N(N(P(n))).toArray().map((e) => re(e))));
	return me(j(j(n, j(j(r, pe(t)), N(r))), N(n)));
}
//#endregion
//#region src/lib/structure/position.js
var ge = class e {
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
}, _e = class extends ge {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return new ve(...j(e.fractToCartMatrix, A([
			this.x,
			this.y,
			this.z
		])).toArray());
	}
}, ve = class extends ge {
	constructor(e, t, n) {
		super(e, t, n);
	}
	toCartesian(e) {
		return this;
	}
}, ye = class {
	static fromCIF(e, t) {
		let n = !1, r = e.get("_atom_site"), i = [".", "?"];
		if (String(r.getIndex(["_atom_site.calc_flag", "_atom_site_calc_flag"], t, "")).toLowerCase() === "dum") throw Error("Dummy atom: calc_flag is dum");
		try {
			let e = r.getIndex(["_atom_site.fract_x", "_atom_site_fract_x"], t), a = r.getIndex(["_atom_site.fract_y", "_atom_site_fract_y"], t), o = r.getIndex(["_atom_site.fract_z", "_atom_site_fract_z"], t);
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new _e(e, a, o);
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
			if (!i.includes(e) && !i.includes(a) && !i.includes(o)) return new ve(e, a, o);
			n = !0;
		} catch {}
		throw Error(n ? "Dummy atom: Invalid position" : "Invalid position: No valid fractional or Cartesian coordinates found");
	}
}, be = class e {
	constructor(e) {
		this.uiso = e;
	}
	static fromBiso(t) {
		return new e(t / (8 * Math.PI * Math.PI));
	}
}, xe = class e {
	constructor(e, t, n, r, i, a) {
		this.u11 = e, this.u22 = t, this.u33 = n, this.u12 = r, this.u13 = i, this.u23 = a;
	}
	static fromBani(t, n, r, i, a, o) {
		let s = 1 / (8 * Math.PI * Math.PI);
		return new e(t * s, n * s, r * s, i * s, a * s, o * s);
	}
	getUCart(e) {
		return he(e.fractToCartMatrix, [
			this.u11,
			this.u22,
			this.u33,
			this.u12,
			this.u13,
			this.u23
		]);
	}
	getEllipsoidMatrix(e) {
		let { eigenvectors: t } = de(pe(this.getUCart(e))), n = N(A(t.map((e) => e.vector))), r = A(t.map((e) => e.value > 0 ? e.value : NaN)), i = te(n), a = ne(r.map(Math.sqrt)), o;
		return o = ce(i - 1) > 1e-10 ? j(j(n, 1 / i), a) : j(n, a), A(o);
	}
}, I = class e {
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
		].some(isNaN) ? null : new xe(i, a, o, s, c, l);
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
		].some(isNaN) ? null : xe.fromBani(i, a, o, s, c, l);
	}
	static createUiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : new be(n);
		} catch {
			return null;
		}
	}
	static createBiso(e, t) {
		try {
			let n = e.get("_atom_site").getIndex(["_atom_site.b_iso_or_equiv", "_atom_site_B_iso_or_equiv"], t, NaN);
			return isNaN(n) ? null : be.fromBiso(n);
		} catch {
			return null;
		}
	}
};
//#endregion
//#region src/lib/structure/position-code.js
function Se(e) {
	if (e == null || e === "." || e === "?") return ".";
	let t = String(e).trim();
	return t === "" || t === "." || t === "?" ? "." : t.includes("_") ? t : `${t}_555`;
}
function Ce(e) {
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
function we(e, t) {
	let n = String(e);
	if (!n || n.includes("_")) throw Error(`Invalid symmetry operation ID: ${e}`);
	if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isInteger)) throw Error(`Invalid symmetry translation: ${t}`);
	let r = t.map((e) => e + 5);
	return r.every((e) => e >= 0 && e <= 9) ? `${n}_${r.join("")}` : `${n}_[${t.join(",")}]`;
}
//#endregion
//#region src/lib/structure/cell-symmetry.js
function L(e) {
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
var Te = class e {
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
		let t = ee(j(this.rotMatrix, e), this.transVector);
		return Array.isArray(t) ? t : t.toArray();
	}
	applyToAtom(e) {
		let t = new _e(...ee(j(this.rotMatrix, [
			e.position.x,
			e.position.y,
			e.position.z
		]), this.transVector)), n = null;
		if (e.adp && e.adp instanceof xe) {
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
			], r = this.rotMatrix, i = N(r), a = j(j(r, t), i);
			n = new xe(a[0][0], a[1][1], a[2][2], a[0][1], a[0][2], a[1][2]);
		} else e.adp && e.adp instanceof be && (n = new be(e.adp.uiso));
		return new Fe(e.label, e.atomType, t, n, e.disorderGroup);
	}
	applyToAtoms(e) {
		return e.map((e) => this.applyToAtom(e));
	}
	copy() {
		let t = new e("x,y,z");
		return t.rotMatrix = se(this.rotMatrix), t.transVector = se(this.transVector), t;
	}
	toSymmetryString(e = null) {
		let t = [
			"x",
			"y",
			"z"
		], n = [], r = e ? ee(this.transVector, e) : this.transVector;
		for (let e = 0; e < 3; e++) {
			let i = "", a = [];
			for (let n = 0; n < 3; n++) {
				let r = this.rotMatrix[e][n];
				if (Math.abs(r) > 1e-10) if (Math.abs(Math.abs(r) - 1) < 1e-10) a.push(r > 0 ? t[n] : `-${t[n]}`);
				else {
					let e = L(Math.abs(r));
					a.push(r > 0 ? `${e}${t[n]}` : `-${e}${t[n]}`);
				}
			}
			if (i = a.join("+"), i === "" && (i = "0"), Math.abs(r[e]) > 1e-10) {
				let t = L(Math.abs(r[e])), n = r[e] < 0 ? `-${t}` : t;
				i = i === "0" ? n : i.startsWith("-") ? `${n}${i}` : `${n}+${i}`;
			}
			n.push(i);
		}
		return n.join(",");
	}
}, R = class e {
	constructor(e, t, n, r = null) {
		this.spaceGroupName = e, this.spaceGroupNumber = t, this.symmetryOperations = n, this.operationIds = r || new Map(n.map((e, t) => [(t + 1).toString(), t])), this.identitySymOpId = Array.from(this.operationIds.entries()).find(([e, t]) => {
			let n = this.symmetryOperations[t];
			return F(n.rotMatrix, ae(3)) && F(n.transVector, oe(3));
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
		let { id: t, translation: n } = Ce(e), r = this.operationIds.get(t);
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
				let i = r.map((e) => Math.round(e)), a = we(t, i);
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
		], i = P(t.rotMatrix), a = this._multiplyMatrixVector3x3(i, r.map((e) => -e)), o = this._rotationMatrixIndex.get(this._matrixToKey(i));
		if (o) for (let e of o) {
			let t = this.symmetryOperations[e], n = a.map((e, n) => e - t.transVector[n]);
			if (!n.every((e) => Math.abs(e - Math.round(e)) < 1e-5)) continue;
			let r = Array.from(this.operationIds.entries()).find(([, t]) => t === e)?.[0];
			return we(r, n.map((e) => Math.round(e)));
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
		if (i && !(i instanceof s)) return new e(n, r, [new Te(i)]);
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
			let o = t.map((e) => new Te(e));
			return new e(n, r, o, a);
		} else return console.warn("No symmetry operations found in CIF block, will use P1"), new e("Unknown", 0, [new Te("x,y,z")]);
	}
};
//#endregion
//#region src/lib/structure/bonds.js
function z(e) {
	return String(e).split("|")[0];
}
function Ee(e, t = "1_555") {
	let n = String(e);
	return n.includes("|") ? n : `${n}|${t}`;
}
var De = class e {
	constructor(e, t, n = null, r = null, i = null) {
		let a = Se(i);
		this.atom1Id = Ee(e), this.atom2Id = Ee(t, a === "." ? "1_555" : a), this.bondLength = n, this.bondLengthSU = r, this.atom2SiteSymmetry = a;
	}
	get atom1Label() {
		return z(this.atom1Id);
	}
	get atom2Label() {
		return z(this.atom2Id);
	}
	static fromCIF(t, n) {
		let r = t.get("_geom_bond"), i = r.getIndex(["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"], n, "."), a = r.getIndex(["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"], n, !1);
		a && a === i && (i = "."), i = Se(i);
		let o = `${r.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], n)}|1_555`, s = r.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], n), c = i === "?" ? "." : i, l = `${s}|${c === "." ? "1_555" : c}`;
		return new e(o, l, r.getIndex(["_geom_bond.distance", "_geom_bond_distance"], n), r.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], n, NaN), c);
	}
}, Oe = class e {
	constructor(e, t, n, r, i, a, o, s, c, l, u, d) {
		let f = Se(d);
		this.donorAtomId = Ee(e), this.hydrogenAtomId = Ee(t), this.acceptorAtomId = Ee(n, f === "." ? "1_555" : f), this.donorHydrogenDistance = r, this.donorHydrogenDistanceSU = i, this.acceptorHydrogenDistance = a, this.acceptorHydrogenDistanceSU = o, this.donorAcceptorDistance = s, this.donorAcceptorDistanceSU = c, this.hBondAngle = l, this.hBondAngleSU = u, this.acceptorAtomSymmetry = f;
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
		let r = t.get("_geom_hbond"), i = r.getIndex(["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"], n, "."), a = `${r.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], n)}|1_555`, o = `${r.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], n)}|1_555`, s = r.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], n), c = Se(i), l = `${s}|${c === "." ? "1_555" : c}`;
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
				e.isValidBondPair(i, s, n) && a.push(De.fromCIF(t, o));
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
			e.isValidHBondTriplet(i, s, c, n) && a.push(Oe.fromCIF(t, o));
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
function je(e) {
	if (!e || typeof e != "string") throw Error(`Invalid atom label: ${e}`);
	let t = e.toUpperCase(), n = RegExp(`^(${(/* @__PURE__ */ "HE.LI.BE.NE.NA.MG.AL.SI.CL.AR.CA.SC.TI.CR.MN.FE.CO.NI.CU.ZN.GA.GE.AS.SE.BR.KR.RB.SR.ZR.NB.MO.TC.RU.RH.PD.AG.CD.IN.SN.SB.TE.XE.CS.BA.LA.CE.PR.ND.PM.SM.EU.GD.TB.DY.HO.ER.TM.YB.LU.HF.TA.RE.OS.IR.PT.AU.HG.TL.PB.BI.PO.AT.RN.FR.RA.AC.TH.PA.NP.PU.AM.CM".split(".")).join("|")})`), r = t.match(n);
	if (r) return Me(r[1]);
	let i = t.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
	if (i) return Me(i[1]);
	throw Error(`Could not infer element type from atom label: ${e}`);
}
function Me(e) {
	return e.length === 1 ? e : e[0] + e[1].toLowerCase();
}
var Ne = class e {
	constructor(e, t, n = [], r = [], i = null) {
		this.cell = e, this.atoms = t, this.bonds = n, this.hBonds = r, this.symmetry = i || new R("None", 0, [new Te("x,y,z")]);
	}
	static fromCIF(t) {
		let n = Pe.fromCIF(t), r = t.get("_atom_site").get(["_atom_site.label", "_atom_site_label"]), i = Array.from({ length: r.length }, (e, n) => {
			try {
				return Fe.fromCIF(t, n);
			} catch (e) {
				if (e.message.includes("Dummy atom")) return null;
				throw e;
			}
		}).filter((e) => e !== null);
		if (i.length === 0) throw Error("The cif file contains no valid atoms.");
		let a = new Set(i.map((e) => e.label)), o = Ae.createBonds(t, a), s = Ae.createHBonds(t, a), c = R.fromCIF(t), l = Ae.validateBonds(o, i, c), u = Ae.validateHBonds(s, i, c);
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
}, Pe = class e {
	constructor(e, t, n, r, i, a) {
		this._a = e, this._b = t, this._c = n, this._alpha = r, this._beta = i, this._gamma = a, this.fractToCartMatrix = fe(this);
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
		this._a = e, this.fractToCartMatrix = fe(this);
	}
	get b() {
		return this._b;
	}
	set b(e) {
		if (e <= 0) throw Error("Cell parameter 'b' must be positive");
		this._b = e, this.fractToCartMatrix = fe(this);
	}
	get c() {
		return this._c;
	}
	set c(e) {
		if (e <= 0) throw Error("Cell parameter 'c' must be positive");
		this._c = e, this.fractToCartMatrix = fe(this);
	}
	get alpha() {
		return this._alpha;
	}
	set alpha(e) {
		if (e <= 0 || e >= 180) throw Error("Angle alpha must be between 0 and 180 degrees");
		this._alpha = e, this.fractToCartMatrix = fe(this);
	}
	get beta() {
		return this._beta;
	}
	set beta(e) {
		if (e <= 0 || e >= 180) throw Error("Angle beta must be between 0 and 180 degrees");
		this._beta = e, this.fractToCartMatrix = fe(this);
	}
	get gamma() {
		return this._gamma;
	}
	set gamma(e) {
		if (e <= 0 || e >= 180) throw Error("Angle gamma must be between 0 and 180 degrees");
		this._gamma = e, this.fractToCartMatrix = fe(this);
	}
}, Fe = class e {
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
		if (l ||= je(s), c.includes(l)) throw Error("Dummy atom: Invalid atom type");
		let u = ye.fromCIF(t, o), d = I.fromCIF(t, o), f = i.getIndex(["_atom_site.disorder_group", "_atom_site_disorder_group"], o, ".");
		return new e(s, l, u, d, f === "." ? 0 : f);
	}
};
function Ie(e, t) {
	return e.disorderGroup === t.disorderGroup || e.disorderGroup === 0 || t.disorderGroup === 0;
}
var Le = 1e3, Re = 1001, ze = 1002, Be = 1003, Ve = 1004, He = 1005, Ue = 1006, We = 1007, Ge = 1008, Ke = 1009, qe = 1010, Je = 1011, Ye = 1012, Xe = 1013, Ze = 1014, Qe = 1015, $e = 1016, et = 1017, tt = 1018, nt = 1020, rt = 35902, it = 35899, at = 1021, ot = 1022, st = 1023, ct = 1026, lt = 1027, ut = 1028, dt = 1029, ft = 1030, pt = 1031, mt = 1033, ht = 33776, gt = 33777, _t = 33778, vt = 33779, yt = 35840, bt = 35841, xt = 35842, St = 35843, Ct = 36196, wt = 37492, Tt = 37496, Et = 37488, Dt = 37489, Ot = 37490, kt = 37491, At = 37808, jt = 37809, Mt = 37810, Nt = 37811, Pt = 37812, Ft = 37813, It = 37814, Lt = 37815, Rt = 37816, zt = 37817, Bt = 37818, Vt = 37819, Ht = 37820, Ut = 37821, Wt = 36492, Gt = 36494, Kt = 36495, qt = 36283, Jt = 36284, Yt = 36285, Xt = 36286, Zt = 2300, Qt = 2301, $t = 2302, en = 2303, tn = 2400, nn = 2401, rn = 2402, an = 3200, on = "srgb", sn = "srgb-linear", cn = "linear", ln = "srgb", un = 7680, dn = 35044, fn = 2e3;
function pn(e) {
	for (let t = e.length - 1; t >= 0; --t) if (e[t] >= 65535) return !0;
	return !1;
}
function mn(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
function hn(e) {
	return document.createElementNS("http://www.w3.org/1999/xhtml", e);
}
function gn() {
	let e = hn("canvas");
	return e.style.display = "block", e;
}
var _n = {};
function vn(...e) {
	let t = "THREE." + e.shift();
	console.log(t, ...e);
}
function yn(e) {
	let t = e[0];
	if (typeof t == "string" && t.startsWith("TSL:")) {
		let t = e[1];
		t && t.isStackTrace ? e[0] += " " + t.getLocation() : e[1] = "Stack trace not available. Enable \"THREE.Node.captureStackTrace\" to capture stack traces.";
	}
	return e;
}
function B(...e) {
	e = yn(e);
	let t = "THREE." + e.shift();
	{
		let n = e[0];
		n && n.isStackTrace ? console.warn(n.getError(t)) : console.warn(t, ...e);
	}
}
function V(...e) {
	e = yn(e);
	let t = "THREE." + e.shift();
	{
		let n = e[0];
		n && n.isStackTrace ? console.error(n.getError(t)) : console.error(t, ...e);
	}
}
function bn(...e) {
	let t = e.join(" ");
	t in _n || (_n[t] = !0, B(...e));
}
function xn(e, t, n) {
	return new Promise(function(r, i) {
		function a() {
			switch (e.clientWaitSync(t, e.SYNC_FLUSH_COMMANDS_BIT, 0)) {
				case e.WAIT_FAILED:
					i();
					break;
				case e.TIMEOUT_EXPIRED:
					setTimeout(a, n);
					break;
				default: r();
			}
		}
		setTimeout(a, n);
	});
}
var Sn = {
	0: 1,
	2: 6,
	4: 7,
	3: 5,
	1: 0,
	6: 2,
	7: 4,
	5: 3
}, Cn = class {
	addEventListener(e, t) {
		this._listeners === void 0 && (this._listeners = {});
		let n = this._listeners;
		n[e] === void 0 && (n[e] = []), n[e].indexOf(t) === -1 && n[e].push(t);
	}
	hasEventListener(e, t) {
		let n = this._listeners;
		return n !== void 0 && n[e] !== void 0 && n[e].indexOf(t) !== -1;
	}
	removeEventListener(e, t) {
		let n = this._listeners;
		if (n === void 0) return;
		let r = n[e];
		if (r !== void 0) {
			let e = r.indexOf(t);
			e !== -1 && r.splice(e, 1);
		}
	}
	dispatchEvent(e) {
		let t = this._listeners;
		if (t === void 0) return;
		let n = t[e.type];
		if (n !== void 0) {
			e.target = this;
			let t = n.slice(0);
			for (let n = 0, r = t.length; n < r; n++) t[n].call(this, e);
			e.target = null;
		}
	}
}, wn = /* @__PURE__ */ "00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff".split("."), Tn = 1234567, En = Math.PI / 180, Dn = 180 / Math.PI;
function On() {
	let e = Math.random() * 4294967295 | 0, t = Math.random() * 4294967295 | 0, n = Math.random() * 4294967295 | 0, r = Math.random() * 4294967295 | 0;
	return (wn[e & 255] + wn[e >> 8 & 255] + wn[e >> 16 & 255] + wn[e >> 24 & 255] + "-" + wn[t & 255] + wn[t >> 8 & 255] + "-" + wn[t >> 16 & 15 | 64] + wn[t >> 24 & 255] + "-" + wn[n & 63 | 128] + wn[n >> 8 & 255] + "-" + wn[n >> 16 & 255] + wn[n >> 24 & 255] + wn[r & 255] + wn[r >> 8 & 255] + wn[r >> 16 & 255] + wn[r >> 24 & 255]).toLowerCase();
}
function H(e, t, n) {
	return Math.max(t, Math.min(n, e));
}
function kn(e, t) {
	return (e % t + t) % t;
}
function An(e, t, n, r, i) {
	return r + (e - t) * (i - r) / (n - t);
}
function jn(e, t, n) {
	return e === t ? 0 : (n - e) / (t - e);
}
function Mn(e, t, n) {
	return (1 - n) * e + n * t;
}
function Nn(e, t, n, r) {
	return Mn(e, t, 1 - Math.exp(-n * r));
}
function Pn(e, t = 1) {
	return t - Math.abs(kn(e, t * 2) - t);
}
function Fn(e, t, n) {
	return e <= t ? 0 : e >= n ? 1 : (e = (e - t) / (n - t), e * e * (3 - 2 * e));
}
function In(e, t, n) {
	return e <= t ? 0 : e >= n ? 1 : (e = (e - t) / (n - t), e * e * e * (e * (e * 6 - 15) + 10));
}
function Ln(e, t) {
	return e + Math.floor(Math.random() * (t - e + 1));
}
function Rn(e, t) {
	return e + Math.random() * (t - e);
}
function zn(e) {
	return e * (.5 - Math.random());
}
function Bn(e) {
	e !== void 0 && (Tn = e);
	let t = Tn += 1831565813;
	return t = Math.imul(t ^ t >>> 15, t | 1), t ^= t + Math.imul(t ^ t >>> 7, t | 61), ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function Vn(e) {
	return e * En;
}
function Hn(e) {
	return e * Dn;
}
function Un(e) {
	return (e & e - 1) == 0 && e !== 0;
}
function Wn(e) {
	return 2 ** Math.ceil(Math.log(e) / Math.LN2);
}
function Gn(e) {
	return 2 ** Math.floor(Math.log(e) / Math.LN2);
}
function Kn(e, t, n, r, i) {
	let a = Math.cos, o = Math.sin, s = a(n / 2), c = o(n / 2), l = a((t + r) / 2), u = o((t + r) / 2), d = a((t - r) / 2), f = o((t - r) / 2), p = a((r - t) / 2), m = o((r - t) / 2);
	switch (i) {
		case "XYX":
			e.set(s * u, c * d, c * f, s * l);
			break;
		case "YZY":
			e.set(c * f, s * u, c * d, s * l);
			break;
		case "ZXZ":
			e.set(c * d, c * f, s * u, s * l);
			break;
		case "XZX":
			e.set(s * u, c * m, c * p, s * l);
			break;
		case "YXY":
			e.set(c * p, s * u, c * m, s * l);
			break;
		case "ZYZ":
			e.set(c * m, c * p, s * u, s * l);
			break;
		default: B("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " + i);
	}
}
function qn(e, t) {
	switch (t.constructor) {
		case Float32Array: return e;
		case Uint32Array: return e / 4294967295;
		case Uint16Array: return e / 65535;
		case Uint8Array: return e / 255;
		case Int32Array: return Math.max(e / 2147483647, -1);
		case Int16Array: return Math.max(e / 32767, -1);
		case Int8Array: return Math.max(e / 127, -1);
		default: throw Error("THREE.MathUtils: Invalid component type.");
	}
}
function Jn(e, t) {
	switch (t.constructor) {
		case Float32Array: return e;
		case Uint32Array: return Math.round(e * 4294967295);
		case Uint16Array: return Math.round(e * 65535);
		case Uint8Array: return Math.round(e * 255);
		case Int32Array: return Math.round(e * 2147483647);
		case Int16Array: return Math.round(e * 32767);
		case Int8Array: return Math.round(e * 127);
		default: throw Error("THREE.MathUtils: Invalid component type.");
	}
}
var Yn = {
	DEG2RAD: En,
	RAD2DEG: Dn,
	generateUUID: On,
	clamp: H,
	euclideanModulo: kn,
	mapLinear: An,
	inverseLerp: jn,
	lerp: Mn,
	damp: Nn,
	pingpong: Pn,
	smoothstep: Fn,
	smootherstep: In,
	randInt: Ln,
	randFloat: Rn,
	randFloatSpread: zn,
	seededRandom: Bn,
	degToRad: Vn,
	radToDeg: Hn,
	isPowerOfTwo: Un,
	ceilPowerOfTwo: Wn,
	floorPowerOfTwo: Gn,
	setQuaternionFromProperEuler: Kn,
	normalize: Jn,
	denormalize: qn
}, U = class e {
	static {
		e.prototype.isVector2 = !0;
	}
	constructor(e = 0, t = 0) {
		this.x = e, this.y = t;
	}
	get width() {
		return this.x;
	}
	set width(e) {
		this.x = e;
	}
	get height() {
		return this.y;
	}
	set height(e) {
		this.y = e;
	}
	set(e, t) {
		return this.x = e, this.y = t, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			default: throw Error("THREE.Vector2: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			default: throw Error("THREE.Vector2: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this;
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	applyMatrix3(e) {
		let t = this.x, n = this.y, r = e.elements;
		return this.x = r[0] * t + r[3] * n + r[6], this.y = r[1] * t + r[4] * n + r[7], this;
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this;
	}
	clamp(e, t) {
		return this.x = H(this.x, e.x, t.x), this.y = H(this.y, e.y, t.y), this;
	}
	clampScalar(e, t) {
		return this.x = H(this.x, e, t), this.y = H(this.y, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(H(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y;
	}
	cross(e) {
		return this.x * e.y - this.y * e.x;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	angle() {
		return Math.atan2(-this.y, -this.x) + Math.PI;
	}
	angleTo(e) {
		let t = Math.sqrt(this.lengthSq() * e.lengthSq());
		if (t === 0) return Math.PI / 2;
		let n = this.dot(e) / t;
		return Math.acos(H(n, -1, 1));
	}
	distanceTo(e) {
		return Math.sqrt(this.distanceToSquared(e));
	}
	distanceToSquared(e) {
		let t = this.x - e.x, n = this.y - e.y;
		return t * t + n * n;
	}
	manhattanDistanceTo(e) {
		return Math.abs(this.x - e.x) + Math.abs(this.y - e.y);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this;
	}
	rotateAround(e, t) {
		let n = Math.cos(t), r = Math.sin(t), i = this.x - e.x, a = this.y - e.y;
		return this.x = i * n - a * r + e.x, this.y = i * r + a * n + e.y, this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y;
	}
}, Xn = class {
	constructor(e = 0, t = 0, n = 0, r = 1) {
		this.isQuaternion = !0, this._x = e, this._y = t, this._z = n, this._w = r;
	}
	static slerpFlat(e, t, n, r, i, a, o) {
		let s = n[r + 0], c = n[r + 1], l = n[r + 2], u = n[r + 3], d = i[a + 0], f = i[a + 1], p = i[a + 2], m = i[a + 3];
		if (u !== m || s !== d || c !== f || l !== p) {
			let e = s * d + c * f + l * p + u * m;
			e < 0 && (d = -d, f = -f, p = -p, m = -m, e = -e);
			let t = 1 - o;
			if (e < .9995) {
				let n = Math.acos(e), r = Math.sin(n);
				t = Math.sin(t * n) / r, o = Math.sin(o * n) / r, s = s * t + d * o, c = c * t + f * o, l = l * t + p * o, u = u * t + m * o;
			} else {
				s = s * t + d * o, c = c * t + f * o, l = l * t + p * o, u = u * t + m * o;
				let e = 1 / Math.sqrt(s * s + c * c + l * l + u * u);
				s *= e, c *= e, l *= e, u *= e;
			}
		}
		e[t] = s, e[t + 1] = c, e[t + 2] = l, e[t + 3] = u;
	}
	static multiplyQuaternionsFlat(e, t, n, r, i, a) {
		let o = n[r], s = n[r + 1], c = n[r + 2], l = n[r + 3], u = i[a], d = i[a + 1], f = i[a + 2], p = i[a + 3];
		return e[t] = o * p + l * u + s * f - c * d, e[t + 1] = s * p + l * d + c * u - o * f, e[t + 2] = c * p + l * f + o * d - s * u, e[t + 3] = l * p - o * u - s * d - c * f, e;
	}
	get x() {
		return this._x;
	}
	set x(e) {
		this._x = e, this._onChangeCallback();
	}
	get y() {
		return this._y;
	}
	set y(e) {
		this._y = e, this._onChangeCallback();
	}
	get z() {
		return this._z;
	}
	set z(e) {
		this._z = e, this._onChangeCallback();
	}
	get w() {
		return this._w;
	}
	set w(e) {
		this._w = e, this._onChangeCallback();
	}
	set(e, t, n, r) {
		return this._x = e, this._y = t, this._z = n, this._w = r, this._onChangeCallback(), this;
	}
	clone() {
		return new this.constructor(this._x, this._y, this._z, this._w);
	}
	copy(e) {
		return this._x = e.x, this._y = e.y, this._z = e.z, this._w = e.w, this._onChangeCallback(), this;
	}
	setFromEuler(e, t = !0) {
		let n = e._x, r = e._y, i = e._z, a = e._order, o = Math.cos, s = Math.sin, c = o(n / 2), l = o(r / 2), u = o(i / 2), d = s(n / 2), f = s(r / 2), p = s(i / 2);
		switch (a) {
			case "XYZ":
				this._x = d * l * u + c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "YXZ":
				this._x = d * l * u + c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u + d * f * p;
				break;
			case "ZXY":
				this._x = d * l * u - c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "ZYX":
				this._x = d * l * u - c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u + d * f * p;
				break;
			case "YZX":
				this._x = d * l * u + c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "XZY":
				this._x = d * l * u - c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u + d * f * p;
				break;
			default: B("Quaternion: .setFromEuler() encountered an unknown order: " + a);
		}
		return t === !0 && this._onChangeCallback(), this;
	}
	setFromAxisAngle(e, t) {
		let n = t / 2, r = Math.sin(n);
		return this._x = e.x * r, this._y = e.y * r, this._z = e.z * r, this._w = Math.cos(n), this._onChangeCallback(), this;
	}
	setFromRotationMatrix(e) {
		let t = e.elements, n = t[0], r = t[4], i = t[8], a = t[1], o = t[5], s = t[9], c = t[2], l = t[6], u = t[10], d = n + o + u;
		if (d > 0) {
			let e = .5 / Math.sqrt(d + 1);
			this._w = .25 / e, this._x = (l - s) * e, this._y = (i - c) * e, this._z = (a - r) * e;
		} else if (n > o && n > u) {
			let e = 2 * Math.sqrt(1 + n - o - u);
			this._w = (l - s) / e, this._x = .25 * e, this._y = (r + a) / e, this._z = (i + c) / e;
		} else if (o > u) {
			let e = 2 * Math.sqrt(1 + o - n - u);
			this._w = (i - c) / e, this._x = (r + a) / e, this._y = .25 * e, this._z = (s + l) / e;
		} else {
			let e = 2 * Math.sqrt(1 + u - n - o);
			this._w = (a - r) / e, this._x = (i + c) / e, this._y = (s + l) / e, this._z = .25 * e;
		}
		return this._onChangeCallback(), this;
	}
	setFromUnitVectors(e, t) {
		let n = e.dot(t) + 1;
		return n < 1e-8 ? (n = 0, Math.abs(e.x) > Math.abs(e.z) ? (this._x = -e.y, this._y = e.x, this._z = 0, this._w = n) : (this._x = 0, this._y = -e.z, this._z = e.y, this._w = n)) : (this._x = e.y * t.z - e.z * t.y, this._y = e.z * t.x - e.x * t.z, this._z = e.x * t.y - e.y * t.x, this._w = n), this.normalize();
	}
	angleTo(e) {
		return 2 * Math.acos(Math.abs(H(this.dot(e), -1, 1)));
	}
	rotateTowards(e, t) {
		let n = this.angleTo(e);
		if (n === 0) return this;
		let r = Math.min(1, t / n);
		return this.slerp(e, r), this;
	}
	identity() {
		return this.set(0, 0, 0, 1);
	}
	invert() {
		return this.conjugate();
	}
	conjugate() {
		return this._x *= -1, this._y *= -1, this._z *= -1, this._onChangeCallback(), this;
	}
	dot(e) {
		return this._x * e._x + this._y * e._y + this._z * e._z + this._w * e._w;
	}
	lengthSq() {
		return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
	}
	length() {
		return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
	}
	normalize() {
		let e = this.length();
		return e === 0 ? (this._x = 0, this._y = 0, this._z = 0, this._w = 1) : (e = 1 / e, this._x *= e, this._y *= e, this._z *= e, this._w *= e), this._onChangeCallback(), this;
	}
	multiply(e) {
		return this.multiplyQuaternions(this, e);
	}
	premultiply(e) {
		return this.multiplyQuaternions(e, this);
	}
	multiplyQuaternions(e, t) {
		let n = e._x, r = e._y, i = e._z, a = e._w, o = t._x, s = t._y, c = t._z, l = t._w;
		return this._x = n * l + a * o + r * c - i * s, this._y = r * l + a * s + i * o - n * c, this._z = i * l + a * c + n * s - r * o, this._w = a * l - n * o - r * s - i * c, this._onChangeCallback(), this;
	}
	slerp(e, t) {
		let n = e._x, r = e._y, i = e._z, a = e._w, o = this.dot(e);
		o < 0 && (n = -n, r = -r, i = -i, a = -a, o = -o);
		let s = 1 - t;
		if (o < .9995) {
			let e = Math.acos(o), c = Math.sin(e);
			s = Math.sin(s * e) / c, t = Math.sin(t * e) / c, this._x = this._x * s + n * t, this._y = this._y * s + r * t, this._z = this._z * s + i * t, this._w = this._w * s + a * t, this._onChangeCallback();
		} else this._x = this._x * s + n * t, this._y = this._y * s + r * t, this._z = this._z * s + i * t, this._w = this._w * s + a * t, this.normalize();
		return this;
	}
	slerpQuaternions(e, t, n) {
		return this.copy(e).slerp(t, n);
	}
	random() {
		let e = 2 * Math.PI * Math.random(), t = 2 * Math.PI * Math.random(), n = Math.random(), r = Math.sqrt(1 - n), i = Math.sqrt(n);
		return this.set(r * Math.sin(e), r * Math.cos(e), i * Math.sin(t), i * Math.cos(t));
	}
	equals(e) {
		return e._x === this._x && e._y === this._y && e._z === this._z && e._w === this._w;
	}
	fromArray(e, t = 0) {
		return this._x = e[t], this._y = e[t + 1], this._z = e[t + 2], this._w = e[t + 3], this._onChangeCallback(), this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this._x, e[t + 1] = this._y, e[t + 2] = this._z, e[t + 3] = this._w, e;
	}
	fromBufferAttribute(e, t) {
		return this._x = e.getX(t), this._y = e.getY(t), this._z = e.getZ(t), this._w = e.getW(t), this._onChangeCallback(), this;
	}
	toJSON() {
		return this.toArray();
	}
	_onChange(e) {
		return this._onChangeCallback = e, this;
	}
	_onChangeCallback() {}
	*[Symbol.iterator]() {
		yield this._x, yield this._y, yield this._z, yield this._w;
	}
}, W = class e {
	static {
		e.prototype.isVector3 = !0;
	}
	constructor(e = 0, t = 0, n = 0) {
		this.x = e, this.y = t, this.z = n;
	}
	set(e, t, n) {
		return n === void 0 && (n = this.z), this.x = e, this.y = t, this.z = n, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this.z = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setZ(e) {
		return this.z = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			case 2:
				this.z = t;
				break;
			default: throw Error("THREE.Vector3: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			case 2: return this.z;
			default: throw Error("THREE.Vector3: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y, this.z);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this.z = e.z, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this.z += e.z, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this.z += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this.z = e.z + t.z, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this.z += e.z * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this.z -= e.z, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this.z -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this.z = e.z - t.z, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this.z *= e.z, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this.z *= e, this;
	}
	multiplyVectors(e, t) {
		return this.x = e.x * t.x, this.y = e.y * t.y, this.z = e.z * t.z, this;
	}
	applyEuler(e) {
		return this.applyQuaternion(Qn.setFromEuler(e));
	}
	applyAxisAngle(e, t) {
		return this.applyQuaternion(Qn.setFromAxisAngle(e, t));
	}
	applyMatrix3(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements;
		return this.x = i[0] * t + i[3] * n + i[6] * r, this.y = i[1] * t + i[4] * n + i[7] * r, this.z = i[2] * t + i[5] * n + i[8] * r, this;
	}
	applyNormalMatrix(e) {
		return this.applyMatrix3(e).normalize();
	}
	applyMatrix4(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements, a = 1 / (i[3] * t + i[7] * n + i[11] * r + i[15]);
		return this.x = (i[0] * t + i[4] * n + i[8] * r + i[12]) * a, this.y = (i[1] * t + i[5] * n + i[9] * r + i[13]) * a, this.z = (i[2] * t + i[6] * n + i[10] * r + i[14]) * a, this;
	}
	applyQuaternion(e) {
		let t = this.x, n = this.y, r = this.z, i = e.x, a = e.y, o = e.z, s = e.w, c = 2 * (a * r - o * n), l = 2 * (o * t - i * r), u = 2 * (i * n - a * t);
		return this.x = t + s * c + a * u - o * l, this.y = n + s * l + o * c - i * u, this.z = r + s * u + i * l - a * c, this;
	}
	project(e) {
		return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix);
	}
	unproject(e) {
		return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld);
	}
	transformDirection(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements;
		return this.x = i[0] * t + i[4] * n + i[8] * r, this.y = i[1] * t + i[5] * n + i[9] * r, this.z = i[2] * t + i[6] * n + i[10] * r, this.normalize();
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this.z /= e.z, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this.z = Math.min(this.z, e.z), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this.z = Math.max(this.z, e.z), this;
	}
	clamp(e, t) {
		return this.x = H(this.x, e.x, t.x), this.y = H(this.y, e.y, t.y), this.z = H(this.z, e.z, t.z), this;
	}
	clampScalar(e, t) {
		return this.x = H(this.x, e, t), this.y = H(this.y, e, t), this.z = H(this.z, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(H(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this.z = -this.z, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y + this.z * e.z;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this.z += (e.z - this.z) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this.z = e.z + (t.z - e.z) * n, this;
	}
	cross(e) {
		return this.crossVectors(this, e);
	}
	crossVectors(e, t) {
		let n = e.x, r = e.y, i = e.z, a = t.x, o = t.y, s = t.z;
		return this.x = r * s - i * o, this.y = i * a - n * s, this.z = n * o - r * a, this;
	}
	projectOnVector(e) {
		let t = e.lengthSq();
		if (t === 0) return this.set(0, 0, 0);
		let n = e.dot(this) / t;
		return this.copy(e).multiplyScalar(n);
	}
	projectOnPlane(e) {
		return Zn.copy(this).projectOnVector(e), this.sub(Zn);
	}
	reflect(e) {
		return this.sub(Zn.copy(e).multiplyScalar(2 * this.dot(e)));
	}
	angleTo(e) {
		let t = Math.sqrt(this.lengthSq() * e.lengthSq());
		if (t === 0) return Math.PI / 2;
		let n = this.dot(e) / t;
		return Math.acos(H(n, -1, 1));
	}
	distanceTo(e) {
		return Math.sqrt(this.distanceToSquared(e));
	}
	distanceToSquared(e) {
		let t = this.x - e.x, n = this.y - e.y, r = this.z - e.z;
		return t * t + n * n + r * r;
	}
	manhattanDistanceTo(e) {
		return Math.abs(this.x - e.x) + Math.abs(this.y - e.y) + Math.abs(this.z - e.z);
	}
	setFromSpherical(e) {
		return this.setFromSphericalCoords(e.radius, e.phi, e.theta);
	}
	setFromSphericalCoords(e, t, n) {
		let r = Math.sin(t) * e;
		return this.x = r * Math.sin(n), this.y = Math.cos(t) * e, this.z = r * Math.cos(n), this;
	}
	setFromCylindrical(e) {
		return this.setFromCylindricalCoords(e.radius, e.theta, e.y);
	}
	setFromCylindricalCoords(e, t, n) {
		return this.x = e * Math.sin(t), this.y = n, this.z = e * Math.cos(t), this;
	}
	setFromMatrixPosition(e) {
		let t = e.elements;
		return this.x = t[12], this.y = t[13], this.z = t[14], this;
	}
	setFromMatrixScale(e) {
		let t = this.setFromMatrixColumn(e, 0).length(), n = this.setFromMatrixColumn(e, 1).length(), r = this.setFromMatrixColumn(e, 2).length();
		return this.x = t, this.y = n, this.z = r, this;
	}
	setFromMatrixColumn(e, t) {
		return this.fromArray(e.elements, t * 4);
	}
	setFromMatrix3Column(e, t) {
		return this.fromArray(e.elements, t * 3);
	}
	setFromEuler(e) {
		return this.x = e._x, this.y = e._y, this.z = e._z, this;
	}
	setFromColor(e) {
		return this.x = e.r, this.y = e.g, this.z = e.b, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y && e.z === this.z;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this.z = e[t + 2], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e[t + 2] = this.z, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this.z = e.getZ(t), this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this;
	}
	randomDirection() {
		let e = Math.random() * Math.PI * 2, t = Math.random() * 2 - 1, n = Math.sqrt(1 - t * t);
		return this.x = n * Math.cos(e), this.y = t, this.z = n * Math.sin(e), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y, yield this.z;
	}
}, Zn = /*@__PURE__*/ new W(), Qn = /*@__PURE__*/ new Xn(), G = class e {
	static {
		e.prototype.isMatrix3 = !0;
	}
	constructor(e, t, n, r, i, a, o, s, c) {
		this.elements = [
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r, i, a, o, s, c);
	}
	set(e, t, n, r, i, a, o, s, c) {
		let l = this.elements;
		return l[0] = e, l[1] = r, l[2] = o, l[3] = t, l[4] = i, l[5] = s, l[6] = n, l[7] = a, l[8] = c, this;
	}
	identity() {
		return this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this;
	}
	copy(e) {
		let t = this.elements, n = e.elements;
		return t[0] = n[0], t[1] = n[1], t[2] = n[2], t[3] = n[3], t[4] = n[4], t[5] = n[5], t[6] = n[6], t[7] = n[7], t[8] = n[8], this;
	}
	extractBasis(e, t, n) {
		return e.setFromMatrix3Column(this, 0), t.setFromMatrix3Column(this, 1), n.setFromMatrix3Column(this, 2), this;
	}
	setFromMatrix4(e) {
		let t = e.elements;
		return this.set(t[0], t[4], t[8], t[1], t[5], t[9], t[2], t[6], t[10]), this;
	}
	multiply(e) {
		return this.multiplyMatrices(this, e);
	}
	premultiply(e) {
		return this.multiplyMatrices(e, this);
	}
	multiplyMatrices(e, t) {
		let n = e.elements, r = t.elements, i = this.elements, a = n[0], o = n[3], s = n[6], c = n[1], l = n[4], u = n[7], d = n[2], f = n[5], p = n[8], m = r[0], h = r[3], g = r[6], _ = r[1], v = r[4], y = r[7], b = r[2], x = r[5], S = r[8];
		return i[0] = a * m + o * _ + s * b, i[3] = a * h + o * v + s * x, i[6] = a * g + o * y + s * S, i[1] = c * m + l * _ + u * b, i[4] = c * h + l * v + u * x, i[7] = c * g + l * y + u * S, i[2] = d * m + f * _ + p * b, i[5] = d * h + f * v + p * x, i[8] = d * g + f * y + p * S, this;
	}
	multiplyScalar(e) {
		let t = this.elements;
		return t[0] *= e, t[3] *= e, t[6] *= e, t[1] *= e, t[4] *= e, t[7] *= e, t[2] *= e, t[5] *= e, t[8] *= e, this;
	}
	determinant() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8];
		return t * a * l - t * o * c - n * i * l + n * o * s + r * i * c - r * a * s;
	}
	invert() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8], u = l * a - o * c, d = o * s - l * i, f = c * i - a * s, p = t * u + n * d + r * f;
		if (p === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
		let m = 1 / p;
		return e[0] = u * m, e[1] = (r * c - l * n) * m, e[2] = (o * n - r * a) * m, e[3] = d * m, e[4] = (l * t - r * s) * m, e[5] = (r * i - o * t) * m, e[6] = f * m, e[7] = (n * s - c * t) * m, e[8] = (a * t - n * i) * m, this;
	}
	transpose() {
		let e, t = this.elements;
		return e = t[1], t[1] = t[3], t[3] = e, e = t[2], t[2] = t[6], t[6] = e, e = t[5], t[5] = t[7], t[7] = e, this;
	}
	getNormalMatrix(e) {
		return this.setFromMatrix4(e).invert().transpose();
	}
	transposeIntoArray(e) {
		let t = this.elements;
		return e[0] = t[0], e[1] = t[3], e[2] = t[6], e[3] = t[1], e[4] = t[4], e[5] = t[7], e[6] = t[2], e[7] = t[5], e[8] = t[8], this;
	}
	setUvTransform(e, t, n, r, i, a, o) {
		let s = Math.cos(i), c = Math.sin(i);
		return this.set(n * s, n * c, -n * (s * a + c * o) + a + e, -r * c, r * s, -r * (-c * a + s * o) + o + t, 0, 0, 1), this;
	}
	scale(e, t) {
		return bn("Matrix3: .scale() is deprecated. Use .makeScale() instead."), this.premultiply($n.makeScale(e, t)), this;
	}
	rotate(e) {
		return bn("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."), this.premultiply($n.makeRotation(-e)), this;
	}
	translate(e, t) {
		return bn("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."), this.premultiply($n.makeTranslation(e, t)), this;
	}
	makeTranslation(e, t) {
		return e.isVector2 ? this.set(1, 0, e.x, 0, 1, e.y, 0, 0, 1) : this.set(1, 0, e, 0, 1, t, 0, 0, 1), this;
	}
	makeRotation(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, -n, 0, n, t, 0, 0, 0, 1), this;
	}
	makeScale(e, t) {
		return this.set(e, 0, 0, 0, t, 0, 0, 0, 1), this;
	}
	equals(e) {
		let t = this.elements, n = e.elements;
		for (let e = 0; e < 9; e++) if (t[e] !== n[e]) return !1;
		return !0;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 9; n++) this.elements[n] = e[n + t];
		return this;
	}
	toArray(e = [], t = 0) {
		let n = this.elements;
		return e[t] = n[0], e[t + 1] = n[1], e[t + 2] = n[2], e[t + 3] = n[3], e[t + 4] = n[4], e[t + 5] = n[5], e[t + 6] = n[6], e[t + 7] = n[7], e[t + 8] = n[8], e;
	}
	clone() {
		return new this.constructor().fromArray(this.elements);
	}
}, $n = /*@__PURE__*/ new G(), er = /*@__PURE__*/ new G().set(.4123908, .3575843, .1804808, .212639, .7151687, .0721923, .0193308, .1191948, .9505322), tr = /*@__PURE__*/ new G().set(3.2409699, -1.5373832, -.4986108, -.9692436, 1.8759675, .0415551, .0556301, -.203977, 1.0569715);
function nr() {
	let e = {
		enabled: !0,
		workingColorSpace: sn,
		spaces: {},
		convert: function(e, t, n) {
			return this.enabled === !1 || t === n || !t || !n ? e : (this.spaces[t].transfer === "srgb" && (e.r = rr(e.r), e.g = rr(e.g), e.b = rr(e.b)), this.spaces[t].primaries !== this.spaces[n].primaries && (e.applyMatrix3(this.spaces[t].toXYZ), e.applyMatrix3(this.spaces[n].fromXYZ)), this.spaces[n].transfer === "srgb" && (e.r = ir(e.r), e.g = ir(e.g), e.b = ir(e.b)), e);
		},
		workingToColorSpace: function(e, t) {
			return this.convert(e, this.workingColorSpace, t);
		},
		colorSpaceToWorking: function(e, t) {
			return this.convert(e, t, this.workingColorSpace);
		},
		getPrimaries: function(e) {
			return this.spaces[e].primaries;
		},
		getTransfer: function(e) {
			return e === "" ? cn : this.spaces[e].transfer;
		},
		getToneMappingMode: function(e) {
			return this.spaces[e].outputColorSpaceConfig.toneMappingMode || "standard";
		},
		getLuminanceCoefficients: function(e, t = this.workingColorSpace) {
			return e.fromArray(this.spaces[t].luminanceCoefficients);
		},
		define: function(e) {
			Object.assign(this.spaces, e);
		},
		_getMatrix: function(e, t, n) {
			return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ);
		},
		_getDrawingBufferColorSpace: function(e) {
			return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace;
		},
		_getUnpackColorSpace: function(e = this.workingColorSpace) {
			return this.spaces[e].workingColorSpaceConfig.unpackColorSpace;
		},
		fromWorkingColorSpace: function(t, n) {
			return bn("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."), e.workingToColorSpace(t, n);
		},
		toWorkingColorSpace: function(t, n) {
			return bn("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."), e.colorSpaceToWorking(t, n);
		}
	}, t = [
		.64,
		.33,
		.3,
		.6,
		.15,
		.06
	], n = [
		.2126,
		.7152,
		.0722
	], r = [.3127, .329];
	return e.define({
		[sn]: {
			primaries: t,
			whitePoint: r,
			transfer: cn,
			toXYZ: er,
			fromXYZ: tr,
			luminanceCoefficients: n,
			workingColorSpaceConfig: { unpackColorSpace: on },
			outputColorSpaceConfig: { drawingBufferColorSpace: on }
		},
		[on]: {
			primaries: t,
			whitePoint: r,
			transfer: ln,
			toXYZ: er,
			fromXYZ: tr,
			luminanceCoefficients: n,
			outputColorSpaceConfig: { drawingBufferColorSpace: on }
		}
	}), e;
}
var K = /*@__PURE__*/ nr();
function rr(e) {
	return e < .04045 ? e * .0773993808 : (e * .9478672986 + .0521327014) ** 2.4;
}
function ir(e) {
	return e < .0031308 ? e * 12.92 : 1.055 * e ** .41666 - .055;
}
var ar, or = class {
	static getDataURL(e, t = "image/png") {
		if (/^data:/i.test(e.src) || typeof HTMLCanvasElement > "u") return e.src;
		let n;
		if (e instanceof HTMLCanvasElement) n = e;
		else {
			ar === void 0 && (ar = hn("canvas")), ar.width = e.width, ar.height = e.height;
			let t = ar.getContext("2d");
			e instanceof ImageData ? t.putImageData(e, 0, 0) : t.drawImage(e, 0, 0, e.width, e.height), n = ar;
		}
		return n.toDataURL(t);
	}
	static sRGBToLinear(e) {
		if (typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap) {
			let t = hn("canvas");
			t.width = e.width, t.height = e.height;
			let n = t.getContext("2d");
			n.drawImage(e, 0, 0, e.width, e.height);
			let r = n.getImageData(0, 0, e.width, e.height), i = r.data;
			for (let e = 0; e < i.length; e++) i[e] = rr(i[e] / 255) * 255;
			return n.putImageData(r, 0, 0), t;
		} else if (e.data) {
			let t = e.data.slice(0);
			for (let e = 0; e < t.length; e++) t instanceof Uint8Array || t instanceof Uint8ClampedArray ? t[e] = Math.floor(rr(t[e] / 255) * 255) : t[e] = rr(t[e]);
			return {
				data: t,
				width: e.width,
				height: e.height
			};
		} else return B("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."), e;
	}
}, sr = 0, cr = class {
	constructor(e = null) {
		this.isSource = !0, Object.defineProperty(this, "id", { value: sr++ }), this.uuid = On(), this.data = e, this.dataReady = !0, this.version = 0;
	}
	getSize(e) {
		let t = this.data;
		return typeof HTMLVideoElement < "u" && t instanceof HTMLVideoElement ? e.set(t.videoWidth, t.videoHeight, 0) : typeof VideoFrame < "u" && t instanceof VideoFrame ? e.set(t.displayWidth, t.displayHeight, 0) : t === null ? e.set(0, 0, 0) : e.set(t.width, t.height, t.depth || 0), e;
	}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		if (!t && e.images[this.uuid] !== void 0) return e.images[this.uuid];
		let n = {
			uuid: this.uuid,
			url: ""
		}, r = this.data;
		if (r !== null) {
			let e;
			if (Array.isArray(r)) {
				e = [];
				for (let t = 0, n = r.length; t < n; t++) r[t].isDataTexture ? e.push(lr(r[t].image)) : e.push(lr(r[t]));
			} else e = lr(r);
			n.url = e;
		}
		return t || (e.images[this.uuid] = n), n;
	}
};
function lr(e) {
	return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap ? or.getDataURL(e) : e.data ? {
		data: Array.from(e.data),
		width: e.width,
		height: e.height,
		type: e.data.constructor.name
	} : (B("Texture: Unable to serialize Texture."), {});
}
var ur = 0, dr = /*@__PURE__*/ new W(), fr = class e extends Cn {
	constructor(t = e.DEFAULT_IMAGE, n = e.DEFAULT_MAPPING, r = Re, i = Re, a = Ue, o = Ge, s = st, c = Ke, l = e.DEFAULT_ANISOTROPY, u = "") {
		super(), this.isTexture = !0, Object.defineProperty(this, "id", { value: ur++ }), this.uuid = On(), this.name = "", this.source = new cr(t), this.mipmaps = [], this.mapping = n, this.channel = 0, this.wrapS = r, this.wrapT = i, this.magFilter = a, this.minFilter = o, this.anisotropy = l, this.format = s, this.internalFormat = null, this.type = c, this.offset = new U(0, 0), this.repeat = new U(1, 1), this.center = new U(0, 0), this.rotation = 0, this.matrixAutoUpdate = !0, this.matrix = new G(), this.generateMipmaps = !0, this.premultiplyAlpha = !1, this.flipY = !0, this.unpackAlignment = 4, this.colorSpace = u, this.userData = {}, this.updateRanges = [], this.version = 0, this.onUpdate = null, this.renderTarget = null, this.isRenderTargetTexture = !1, this.isArrayTexture = !!(t && t.depth && t.depth > 1), this.pmremVersion = 0, this.normalized = !1;
	}
	get width() {
		return this.source.getSize(dr).x;
	}
	get height() {
		return this.source.getSize(dr).y;
	}
	get depth() {
		return this.source.getSize(dr).z;
	}
	get image() {
		return this.source.data;
	}
	set image(e) {
		this.source.data = e;
	}
	updateMatrix() {
		this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
	}
	addUpdateRange(e, t) {
		this.updateRanges.push({
			start: e,
			count: t
		});
	}
	clearUpdateRanges() {
		this.updateRanges.length = 0;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.name = e.name, this.source = e.source, this.mipmaps = e.mipmaps.slice(0), this.mapping = e.mapping, this.channel = e.channel, this.wrapS = e.wrapS, this.wrapT = e.wrapT, this.magFilter = e.magFilter, this.minFilter = e.minFilter, this.anisotropy = e.anisotropy, this.format = e.format, this.internalFormat = e.internalFormat, this.type = e.type, this.normalized = e.normalized, this.offset.copy(e.offset), this.repeat.copy(e.repeat), this.center.copy(e.center), this.rotation = e.rotation, this.matrixAutoUpdate = e.matrixAutoUpdate, this.matrix.copy(e.matrix), this.generateMipmaps = e.generateMipmaps, this.premultiplyAlpha = e.premultiplyAlpha, this.flipY = e.flipY, this.unpackAlignment = e.unpackAlignment, this.colorSpace = e.colorSpace, this.renderTarget = e.renderTarget, this.isRenderTargetTexture = e.isRenderTargetTexture, this.isArrayTexture = e.isArrayTexture, this.userData = JSON.parse(JSON.stringify(e.userData)), this.needsUpdate = !0, this;
	}
	setValues(e) {
		for (let t in e) {
			let n = e[t];
			if (n === void 0) {
				B(`Texture.setValues(): parameter '${t}' has value of undefined.`);
				continue;
			}
			let r = this[t];
			if (r === void 0) {
				B(`Texture.setValues(): property '${t}' does not exist.`);
				continue;
			}
			r && n && r.isVector2 && n.isVector2 || r && n && r.isVector3 && n.isVector3 || r && n && r.isMatrix3 && n.isMatrix3 ? r.copy(n) : this[t] = n;
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		if (!t && e.textures[this.uuid] !== void 0) return e.textures[this.uuid];
		let n = {
			metadata: {
				version: 4.7,
				type: "Texture",
				generator: "Texture.toJSON"
			},
			uuid: this.uuid,
			name: this.name,
			image: this.source.toJSON(e).uuid,
			mapping: this.mapping,
			channel: this.channel,
			repeat: [this.repeat.x, this.repeat.y],
			offset: [this.offset.x, this.offset.y],
			center: [this.center.x, this.center.y],
			rotation: this.rotation,
			wrap: [this.wrapS, this.wrapT],
			format: this.format,
			internalFormat: this.internalFormat,
			type: this.type,
			normalized: this.normalized,
			colorSpace: this.colorSpace,
			minFilter: this.minFilter,
			magFilter: this.magFilter,
			anisotropy: this.anisotropy,
			flipY: this.flipY,
			generateMipmaps: this.generateMipmaps,
			premultiplyAlpha: this.premultiplyAlpha,
			unpackAlignment: this.unpackAlignment
		};
		return Object.keys(this.userData).length > 0 && (n.userData = this.userData), t || (e.textures[this.uuid] = n), n;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	transformUv(e) {
		if (this.mapping !== 300) return e;
		if (e.applyMatrix3(this.matrix), e.x < 0 || e.x > 1) switch (this.wrapS) {
			case Le:
				e.x -= Math.floor(e.x);
				break;
			case Re:
				e.x = e.x < 0 ? 0 : 1;
				break;
			case ze:
				Math.abs(Math.floor(e.x) % 2) === 1 ? e.x = Math.ceil(e.x) - e.x : e.x -= Math.floor(e.x);
				break;
		}
		if (e.y < 0 || e.y > 1) switch (this.wrapT) {
			case Le:
				e.y -= Math.floor(e.y);
				break;
			case Re:
				e.y = e.y < 0 ? 0 : 1;
				break;
			case ze:
				Math.abs(Math.floor(e.y) % 2) === 1 ? e.y = Math.ceil(e.y) - e.y : e.y -= Math.floor(e.y);
				break;
		}
		return this.flipY && (e.y = 1 - e.y), e;
	}
	set needsUpdate(e) {
		e === !0 && (this.version++, this.source.needsUpdate = !0);
	}
	set needsPMREMUpdate(e) {
		e === !0 && this.pmremVersion++;
	}
};
fr.DEFAULT_IMAGE = null, fr.DEFAULT_MAPPING = 300, fr.DEFAULT_ANISOTROPY = 1;
var pr = class e {
	static {
		e.prototype.isVector4 = !0;
	}
	constructor(e = 0, t = 0, n = 0, r = 1) {
		this.x = e, this.y = t, this.z = n, this.w = r;
	}
	get width() {
		return this.z;
	}
	set width(e) {
		this.z = e;
	}
	get height() {
		return this.w;
	}
	set height(e) {
		this.w = e;
	}
	set(e, t, n, r) {
		return this.x = e, this.y = t, this.z = n, this.w = r, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this.z = e, this.w = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setZ(e) {
		return this.z = e, this;
	}
	setW(e) {
		return this.w = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			case 2:
				this.z = t;
				break;
			case 3:
				this.w = t;
				break;
			default: throw Error("THREE.Vector4: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			case 2: return this.z;
			case 3: return this.w;
			default: throw Error("THREE.Vector4: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y, this.z, this.w);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this.z = e.z, this.w = e.w === void 0 ? 1 : e.w, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this.z += e.z, this.w += e.w, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this.z += e, this.w += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this.z = e.z + t.z, this.w = e.w + t.w, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this.z += e.z * t, this.w += e.w * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this.z -= e.z, this.w -= e.w, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this.z -= e, this.w -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this.z = e.z - t.z, this.w = e.w - t.w, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this.z *= e.z, this.w *= e.w, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this.z *= e, this.w *= e, this;
	}
	applyMatrix4(e) {
		let t = this.x, n = this.y, r = this.z, i = this.w, a = e.elements;
		return this.x = a[0] * t + a[4] * n + a[8] * r + a[12] * i, this.y = a[1] * t + a[5] * n + a[9] * r + a[13] * i, this.z = a[2] * t + a[6] * n + a[10] * r + a[14] * i, this.w = a[3] * t + a[7] * n + a[11] * r + a[15] * i, this;
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this.z /= e.z, this.w /= e.w, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	setAxisAngleFromQuaternion(e) {
		this.w = 2 * Math.acos(e.w);
		let t = Math.sqrt(1 - e.w * e.w);
		return t < 1e-4 ? (this.x = 1, this.y = 0, this.z = 0) : (this.x = e.x / t, this.y = e.y / t, this.z = e.z / t), this;
	}
	setAxisAngleFromRotationMatrix(e) {
		let t, n, r, i, a = .01, o = .1, s = e.elements, c = s[0], l = s[4], u = s[8], d = s[1], f = s[5], p = s[9], m = s[2], h = s[6], g = s[10];
		if (Math.abs(l - d) < a && Math.abs(u - m) < a && Math.abs(p - h) < a) {
			if (Math.abs(l + d) < o && Math.abs(u + m) < o && Math.abs(p + h) < o && Math.abs(c + f + g - 3) < o) return this.set(1, 0, 0, 0), this;
			t = Math.PI;
			let e = (c + 1) / 2, s = (f + 1) / 2, _ = (g + 1) / 2, v = (l + d) / 4, y = (u + m) / 4, b = (p + h) / 4;
			return e > s && e > _ ? e < a ? (n = 0, r = .707106781, i = .707106781) : (n = Math.sqrt(e), r = v / n, i = y / n) : s > _ ? s < a ? (n = .707106781, r = 0, i = .707106781) : (r = Math.sqrt(s), n = v / r, i = b / r) : _ < a ? (n = .707106781, r = .707106781, i = 0) : (i = Math.sqrt(_), n = y / i, r = b / i), this.set(n, r, i, t), this;
		}
		let _ = Math.sqrt((h - p) * (h - p) + (u - m) * (u - m) + (d - l) * (d - l));
		return Math.abs(_) < .001 && (_ = 1), this.x = (h - p) / _, this.y = (u - m) / _, this.z = (d - l) / _, this.w = Math.acos((c + f + g - 1) / 2), this;
	}
	setFromMatrixPosition(e) {
		let t = e.elements;
		return this.x = t[12], this.y = t[13], this.z = t[14], this.w = t[15], this;
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this.z = Math.min(this.z, e.z), this.w = Math.min(this.w, e.w), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this.z = Math.max(this.z, e.z), this.w = Math.max(this.w, e.w), this;
	}
	clamp(e, t) {
		return this.x = H(this.x, e.x, t.x), this.y = H(this.y, e.y, t.y), this.z = H(this.z, e.z, t.z), this.w = H(this.w, e.w, t.w), this;
	}
	clampScalar(e, t) {
		return this.x = H(this.x, e, t), this.y = H(this.y, e, t), this.z = H(this.z, e, t), this.w = H(this.w, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(H(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this.w = Math.floor(this.w), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this.w = Math.ceil(this.w), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this.w = Math.round(this.w), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this.w = Math.trunc(this.w), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this.z = -this.z, this.w = -this.w, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y + this.z * e.z + this.w * e.w;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this.z += (e.z - this.z) * t, this.w += (e.w - this.w) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this.z = e.z + (t.z - e.z) * n, this.w = e.w + (t.w - e.w) * n, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y && e.z === this.z && e.w === this.w;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this.z = e[t + 2], this.w = e[t + 3], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e[t + 2] = this.z, e[t + 3] = this.w, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this.z = e.getZ(t), this.w = e.getW(t), this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this.w = Math.random(), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y, yield this.z, yield this.w;
	}
}, mr = class extends Cn {
	constructor(e = 1, t = 1, n = {}) {
		super(), n = Object.assign({
			generateMipmaps: !1,
			internalFormat: null,
			minFilter: Ue,
			depthBuffer: !0,
			stencilBuffer: !1,
			resolveDepthBuffer: !0,
			resolveStencilBuffer: !0,
			depthTexture: null,
			samples: 0,
			count: 1,
			depth: 1,
			multiview: !1,
			useArrayDepthTexture: !1
		}, n), this.isRenderTarget = !0, this.width = e, this.height = t, this.depth = n.depth, this.scissor = new pr(0, 0, e, t), this.scissorTest = !1, this.viewport = new pr(0, 0, e, t), this.textures = [];
		let r = new fr({
			width: e,
			height: t,
			depth: n.depth
		}), i = n.count;
		for (let e = 0; e < i; e++) this.textures[e] = r.clone(), this.textures[e].isRenderTargetTexture = !0, this.textures[e].renderTarget = this;
		this._setTextureOptions(n), this.depthBuffer = n.depthBuffer, this.stencilBuffer = n.stencilBuffer, this.resolveDepthBuffer = n.resolveDepthBuffer, this.resolveStencilBuffer = n.resolveStencilBuffer, this._depthTexture = null, this.depthTexture = n.depthTexture, this.samples = n.samples, this.multiview = n.multiview, this.useArrayDepthTexture = n.useArrayDepthTexture;
	}
	_setTextureOptions(e = {}) {
		let t = {
			minFilter: Ue,
			generateMipmaps: !1,
			flipY: !1,
			internalFormat: null
		};
		e.mapping !== void 0 && (t.mapping = e.mapping), e.wrapS !== void 0 && (t.wrapS = e.wrapS), e.wrapT !== void 0 && (t.wrapT = e.wrapT), e.wrapR !== void 0 && (t.wrapR = e.wrapR), e.magFilter !== void 0 && (t.magFilter = e.magFilter), e.minFilter !== void 0 && (t.minFilter = e.minFilter), e.format !== void 0 && (t.format = e.format), e.type !== void 0 && (t.type = e.type), e.anisotropy !== void 0 && (t.anisotropy = e.anisotropy), e.colorSpace !== void 0 && (t.colorSpace = e.colorSpace), e.flipY !== void 0 && (t.flipY = e.flipY), e.generateMipmaps !== void 0 && (t.generateMipmaps = e.generateMipmaps), e.internalFormat !== void 0 && (t.internalFormat = e.internalFormat);
		for (let e = 0; e < this.textures.length; e++) this.textures[e].setValues(t);
	}
	get texture() {
		return this.textures[0];
	}
	set texture(e) {
		this.textures[0] = e;
	}
	set depthTexture(e) {
		this._depthTexture !== null && (this._depthTexture.renderTarget = null), e !== null && (e.renderTarget = this), this._depthTexture = e;
	}
	get depthTexture() {
		return this._depthTexture;
	}
	setSize(e, t, n = 1) {
		if (this.width !== e || this.height !== t || this.depth !== n) {
			this.width = e, this.height = t, this.depth = n;
			for (let r = 0, i = this.textures.length; r < i; r++) this.textures[r].image.width = e, this.textures[r].image.height = t, this.textures[r].image.depth = n, this.textures[r].isData3DTexture !== !0 && (this.textures[r].isArrayTexture = this.textures[r].image.depth > 1);
			this.dispose();
		}
		this.viewport.set(0, 0, e, t), this.scissor.set(0, 0, e, t);
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.width = e.width, this.height = e.height, this.depth = e.depth, this.scissor.copy(e.scissor), this.scissorTest = e.scissorTest, this.viewport.copy(e.viewport), this.textures.length = 0;
		for (let t = 0, n = e.textures.length; t < n; t++) {
			this.textures[t] = e.textures[t].clone(), this.textures[t].isRenderTargetTexture = !0, this.textures[t].renderTarget = this;
			let n = Object.assign({}, e.textures[t].image);
			this.textures[t].source = new cr(n);
		}
		return this.depthBuffer = e.depthBuffer, this.stencilBuffer = e.stencilBuffer, this.resolveDepthBuffer = e.resolveDepthBuffer, this.resolveStencilBuffer = e.resolveStencilBuffer, e.depthTexture !== null && (this.depthTexture = e.depthTexture.clone()), this.samples = e.samples, this.multiview = e.multiview, this.useArrayDepthTexture = e.useArrayDepthTexture, this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, hr = class extends mr {
	constructor(e = 1, t = 1, n = {}) {
		super(e, t, n), this.isWebGLRenderTarget = !0;
	}
}, gr = class extends fr {
	constructor(e = null, t = 1, n = 1, r = 1) {
		super(null), this.isDataArrayTexture = !0, this.image = {
			data: e,
			width: t,
			height: n,
			depth: r
		}, this.magFilter = Be, this.minFilter = Be, this.wrapR = Re, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1, this.layerUpdates = /* @__PURE__ */ new Set();
	}
	addLayerUpdate(e) {
		this.layerUpdates.add(e);
	}
	clearLayerUpdates() {
		this.layerUpdates.clear();
	}
}, _r = class extends fr {
	constructor(e = null, t = 1, n = 1, r = 1) {
		super(null), this.isData3DTexture = !0, this.image = {
			data: e,
			width: t,
			height: n,
			depth: r
		}, this.magFilter = Be, this.minFilter = Be, this.wrapR = Re, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1;
	}
}, q = class e {
	static {
		e.prototype.isMatrix4 = !0;
	}
	constructor(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h) {
		this.elements = [
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h);
	}
	set(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h) {
		let g = this.elements;
		return g[0] = e, g[4] = t, g[8] = n, g[12] = r, g[1] = i, g[5] = a, g[9] = o, g[13] = s, g[2] = c, g[6] = l, g[10] = u, g[14] = d, g[3] = f, g[7] = p, g[11] = m, g[15] = h, this;
	}
	identity() {
		return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
	}
	clone() {
		return new e().fromArray(this.elements);
	}
	copy(e) {
		let t = this.elements, n = e.elements;
		return t[0] = n[0], t[1] = n[1], t[2] = n[2], t[3] = n[3], t[4] = n[4], t[5] = n[5], t[6] = n[6], t[7] = n[7], t[8] = n[8], t[9] = n[9], t[10] = n[10], t[11] = n[11], t[12] = n[12], t[13] = n[13], t[14] = n[14], t[15] = n[15], this;
	}
	copyPosition(e) {
		let t = this.elements, n = e.elements;
		return t[12] = n[12], t[13] = n[13], t[14] = n[14], this;
	}
	setFromMatrix3(e) {
		let t = e.elements;
		return this.set(t[0], t[3], t[6], 0, t[1], t[4], t[7], 0, t[2], t[5], t[8], 0, 0, 0, 0, 1), this;
	}
	extractBasis(e, t, n) {
		return this.determinantAffine() === 0 ? (e.set(1, 0, 0), t.set(0, 1, 0), n.set(0, 0, 1), this) : (e.setFromMatrixColumn(this, 0), t.setFromMatrixColumn(this, 1), n.setFromMatrixColumn(this, 2), this);
	}
	makeBasis(e, t, n) {
		return this.set(e.x, t.x, n.x, 0, e.y, t.y, n.y, 0, e.z, t.z, n.z, 0, 0, 0, 0, 1), this;
	}
	extractRotation(e) {
		if (e.determinantAffine() === 0) return this.identity();
		let t = this.elements, n = e.elements, r = 1 / vr.setFromMatrixColumn(e, 0).length(), i = 1 / vr.setFromMatrixColumn(e, 1).length(), a = 1 / vr.setFromMatrixColumn(e, 2).length();
		return t[0] = n[0] * r, t[1] = n[1] * r, t[2] = n[2] * r, t[3] = 0, t[4] = n[4] * i, t[5] = n[5] * i, t[6] = n[6] * i, t[7] = 0, t[8] = n[8] * a, t[9] = n[9] * a, t[10] = n[10] * a, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, this;
	}
	makeRotationFromEuler(e) {
		let t = this.elements, n = e.x, r = e.y, i = e.z, a = Math.cos(n), o = Math.sin(n), s = Math.cos(r), c = Math.sin(r), l = Math.cos(i), u = Math.sin(i);
		if (e.order === "XYZ") {
			let e = a * l, n = a * u, r = o * l, i = o * u;
			t[0] = s * l, t[4] = -s * u, t[8] = c, t[1] = n + r * c, t[5] = e - i * c, t[9] = -o * s, t[2] = i - e * c, t[6] = r + n * c, t[10] = a * s;
		} else if (e.order === "YXZ") {
			let e = s * l, n = s * u, r = c * l, i = c * u;
			t[0] = e + i * o, t[4] = r * o - n, t[8] = a * c, t[1] = a * u, t[5] = a * l, t[9] = -o, t[2] = n * o - r, t[6] = i + e * o, t[10] = a * s;
		} else if (e.order === "ZXY") {
			let e = s * l, n = s * u, r = c * l, i = c * u;
			t[0] = e - i * o, t[4] = -a * u, t[8] = r + n * o, t[1] = n + r * o, t[5] = a * l, t[9] = i - e * o, t[2] = -a * c, t[6] = o, t[10] = a * s;
		} else if (e.order === "ZYX") {
			let e = a * l, n = a * u, r = o * l, i = o * u;
			t[0] = s * l, t[4] = r * c - n, t[8] = e * c + i, t[1] = s * u, t[5] = i * c + e, t[9] = n * c - r, t[2] = -c, t[6] = o * s, t[10] = a * s;
		} else if (e.order === "YZX") {
			let e = a * s, n = a * c, r = o * s, i = o * c;
			t[0] = s * l, t[4] = i - e * u, t[8] = r * u + n, t[1] = u, t[5] = a * l, t[9] = -o * l, t[2] = -c * l, t[6] = n * u + r, t[10] = e - i * u;
		} else if (e.order === "XZY") {
			let e = a * s, n = a * c, r = o * s, i = o * c;
			t[0] = s * l, t[4] = -u, t[8] = c * l, t[1] = e * u + i, t[5] = a * l, t[9] = n * u - r, t[2] = r * u - n, t[6] = o * l, t[10] = i * u + e;
		}
		return t[3] = 0, t[7] = 0, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, this;
	}
	makeRotationFromQuaternion(e) {
		return this.compose(br, e, xr);
	}
	lookAt(e, t, n) {
		let r = this.elements;
		return wr.subVectors(e, t), wr.lengthSq() === 0 && (wr.z = 1), wr.normalize(), Sr.crossVectors(n, wr), Sr.lengthSq() === 0 && (Math.abs(n.z) === 1 ? wr.x += 1e-4 : wr.z += 1e-4, wr.normalize(), Sr.crossVectors(n, wr)), Sr.normalize(), Cr.crossVectors(wr, Sr), r[0] = Sr.x, r[4] = Cr.x, r[8] = wr.x, r[1] = Sr.y, r[5] = Cr.y, r[9] = wr.y, r[2] = Sr.z, r[6] = Cr.z, r[10] = wr.z, this;
	}
	multiply(e) {
		return this.multiplyMatrices(this, e);
	}
	premultiply(e) {
		return this.multiplyMatrices(e, this);
	}
	multiplyMatrices(e, t) {
		let n = e.elements, r = t.elements, i = this.elements, a = n[0], o = n[4], s = n[8], c = n[12], l = n[1], u = n[5], d = n[9], f = n[13], p = n[2], m = n[6], h = n[10], g = n[14], _ = n[3], v = n[7], y = n[11], b = n[15], x = r[0], S = r[4], C = r[8], w = r[12], T = r[1], E = r[5], D = r[9], O = r[13], k = r[2], A = r[6], j = r[10], ee = r[14], M = r[3], N = r[7], te = r[11], P = r[15];
		return i[0] = a * x + o * T + s * k + c * M, i[4] = a * S + o * E + s * A + c * N, i[8] = a * C + o * D + s * j + c * te, i[12] = a * w + o * O + s * ee + c * P, i[1] = l * x + u * T + d * k + f * M, i[5] = l * S + u * E + d * A + f * N, i[9] = l * C + u * D + d * j + f * te, i[13] = l * w + u * O + d * ee + f * P, i[2] = p * x + m * T + h * k + g * M, i[6] = p * S + m * E + h * A + g * N, i[10] = p * C + m * D + h * j + g * te, i[14] = p * w + m * O + h * ee + g * P, i[3] = _ * x + v * T + y * k + b * M, i[7] = _ * S + v * E + y * A + b * N, i[11] = _ * C + v * D + y * j + b * te, i[15] = _ * w + v * O + y * ee + b * P, this;
	}
	multiplyScalar(e) {
		let t = this.elements;
		return t[0] *= e, t[4] *= e, t[8] *= e, t[12] *= e, t[1] *= e, t[5] *= e, t[9] *= e, t[13] *= e, t[2] *= e, t[6] *= e, t[10] *= e, t[14] *= e, t[3] *= e, t[7] *= e, t[11] *= e, t[15] *= e, this;
	}
	determinant() {
		let e = this.elements, t = e[0], n = e[4], r = e[8], i = e[12], a = e[1], o = e[5], s = e[9], c = e[13], l = e[2], u = e[6], d = e[10], f = e[14], p = e[3], m = e[7], h = e[11], g = e[15], _ = s * f - c * d, v = o * f - c * u, y = o * d - s * u, b = a * f - c * l, x = a * d - s * l, S = a * u - o * l;
		return t * (m * _ - h * v + g * y) - n * (p * _ - h * b + g * x) + r * (p * v - m * b + g * S) - i * (p * y - m * x + h * S);
	}
	determinantAffine() {
		let e = this.elements, t = e[0], n = e[4], r = e[8], i = e[1], a = e[5], o = e[9], s = e[2], c = e[6], l = e[10];
		return t * (a * l - o * c) - n * (i * l - o * s) + r * (i * c - a * s);
	}
	transpose() {
		let e = this.elements, t;
		return t = e[1], e[1] = e[4], e[4] = t, t = e[2], e[2] = e[8], e[8] = t, t = e[6], e[6] = e[9], e[9] = t, t = e[3], e[3] = e[12], e[12] = t, t = e[7], e[7] = e[13], e[13] = t, t = e[11], e[11] = e[14], e[14] = t, this;
	}
	setPosition(e, t, n) {
		let r = this.elements;
		return e.isVector3 ? (r[12] = e.x, r[13] = e.y, r[14] = e.z) : (r[12] = e, r[13] = t, r[14] = n), this;
	}
	invert() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8], u = e[9], d = e[10], f = e[11], p = e[12], m = e[13], h = e[14], g = e[15], _ = t * o - n * a, v = t * s - r * a, y = t * c - i * a, b = n * s - r * o, x = n * c - i * o, S = r * c - i * s, C = l * m - u * p, w = l * h - d * p, T = l * g - f * p, E = u * h - d * m, D = u * g - f * m, O = d * g - f * h, k = _ * O - v * D + y * E + b * T - x * w + S * C;
		if (k === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
		let A = 1 / k;
		return e[0] = (o * O - s * D + c * E) * A, e[1] = (r * D - n * O - i * E) * A, e[2] = (m * S - h * x + g * b) * A, e[3] = (d * x - u * S - f * b) * A, e[4] = (s * T - a * O - c * w) * A, e[5] = (t * O - r * T + i * w) * A, e[6] = (h * y - p * S - g * v) * A, e[7] = (l * S - d * y + f * v) * A, e[8] = (a * D - o * T + c * C) * A, e[9] = (n * T - t * D - i * C) * A, e[10] = (p * x - m * y + g * _) * A, e[11] = (u * y - l * x - f * _) * A, e[12] = (o * w - a * E - s * C) * A, e[13] = (t * E - n * w + r * C) * A, e[14] = (m * v - p * b - h * _) * A, e[15] = (l * b - u * v + d * _) * A, this;
	}
	scale(e) {
		let t = this.elements, n = e.x, r = e.y, i = e.z;
		return t[0] *= n, t[4] *= r, t[8] *= i, t[1] *= n, t[5] *= r, t[9] *= i, t[2] *= n, t[6] *= r, t[10] *= i, t[3] *= n, t[7] *= r, t[11] *= i, this;
	}
	getMaxScaleOnAxis() {
		let e = this.elements, t = e[0] * e[0] + e[1] * e[1] + e[2] * e[2], n = e[4] * e[4] + e[5] * e[5] + e[6] * e[6], r = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
		return Math.sqrt(Math.max(t, n, r));
	}
	makeTranslation(e, t, n) {
		return e.isVector3 ? this.set(1, 0, 0, e.x, 0, 1, 0, e.y, 0, 0, 1, e.z, 0, 0, 0, 1) : this.set(1, 0, 0, e, 0, 1, 0, t, 0, 0, 1, n, 0, 0, 0, 1), this;
	}
	makeRotationX(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(1, 0, 0, 0, 0, t, -n, 0, 0, n, t, 0, 0, 0, 0, 1), this;
	}
	makeRotationY(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, 0, n, 0, 0, 1, 0, 0, -n, 0, t, 0, 0, 0, 0, 1), this;
	}
	makeRotationZ(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, -n, 0, 0, n, t, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
	}
	makeRotationAxis(e, t) {
		let n = Math.cos(t), r = Math.sin(t), i = 1 - n, a = e.x, o = e.y, s = e.z, c = i * a, l = i * o;
		return this.set(c * a + n, c * o - r * s, c * s + r * o, 0, c * o + r * s, l * o + n, l * s - r * a, 0, c * s - r * o, l * s + r * a, i * s * s + n, 0, 0, 0, 0, 1), this;
	}
	makeScale(e, t, n) {
		return this.set(e, 0, 0, 0, 0, t, 0, 0, 0, 0, n, 0, 0, 0, 0, 1), this;
	}
	makeShear(e, t, n, r, i, a) {
		return this.set(1, n, i, 0, e, 1, a, 0, t, r, 1, 0, 0, 0, 0, 1), this;
	}
	compose(e, t, n) {
		let r = this.elements, i = t._x, a = t._y, o = t._z, s = t._w, c = i + i, l = a + a, u = o + o, d = i * c, f = i * l, p = i * u, m = a * l, h = a * u, g = o * u, _ = s * c, v = s * l, y = s * u, b = n.x, x = n.y, S = n.z;
		return r[0] = (1 - (m + g)) * b, r[1] = (f + y) * b, r[2] = (p - v) * b, r[3] = 0, r[4] = (f - y) * x, r[5] = (1 - (d + g)) * x, r[6] = (h + _) * x, r[7] = 0, r[8] = (p + v) * S, r[9] = (h - _) * S, r[10] = (1 - (d + m)) * S, r[11] = 0, r[12] = e.x, r[13] = e.y, r[14] = e.z, r[15] = 1, this;
	}
	decompose(e, t, n) {
		let r = this.elements;
		e.x = r[12], e.y = r[13], e.z = r[14];
		let i = this.determinantAffine();
		if (i === 0) return n.set(1, 1, 1), t.identity(), this;
		let a = vr.set(r[0], r[1], r[2]).length(), o = vr.set(r[4], r[5], r[6]).length(), s = vr.set(r[8], r[9], r[10]).length();
		i < 0 && (a = -a), yr.copy(this);
		let c = 1 / a, l = 1 / o, u = 1 / s;
		return yr.elements[0] *= c, yr.elements[1] *= c, yr.elements[2] *= c, yr.elements[4] *= l, yr.elements[5] *= l, yr.elements[6] *= l, yr.elements[8] *= u, yr.elements[9] *= u, yr.elements[10] *= u, t.setFromRotationMatrix(yr), n.x = a, n.y = o, n.z = s, this;
	}
	makePerspective(e, t, n, r, i, a, o = fn, s = !1) {
		let c = this.elements, l = 2 * i / (t - e), u = 2 * i / (n - r), d = (t + e) / (t - e), f = (n + r) / (n - r), p, m;
		if (s) p = i / (a - i), m = a * i / (a - i);
		else if (o === 2e3) p = -(a + i) / (a - i), m = -2 * a * i / (a - i);
		else if (o === 2001) p = -a / (a - i), m = -a * i / (a - i);
		else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + o);
		return c[0] = l, c[4] = 0, c[8] = d, c[12] = 0, c[1] = 0, c[5] = u, c[9] = f, c[13] = 0, c[2] = 0, c[6] = 0, c[10] = p, c[14] = m, c[3] = 0, c[7] = 0, c[11] = -1, c[15] = 0, this;
	}
	makeOrthographic(e, t, n, r, i, a, o = fn, s = !1) {
		let c = this.elements, l = 2 / (t - e), u = 2 / (n - r), d = -(t + e) / (t - e), f = -(n + r) / (n - r), p, m;
		if (s) p = 1 / (a - i), m = a / (a - i);
		else if (o === 2e3) p = -2 / (a - i), m = -(a + i) / (a - i);
		else if (o === 2001) p = -1 / (a - i), m = -i / (a - i);
		else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + o);
		return c[0] = l, c[4] = 0, c[8] = 0, c[12] = d, c[1] = 0, c[5] = u, c[9] = 0, c[13] = f, c[2] = 0, c[6] = 0, c[10] = p, c[14] = m, c[3] = 0, c[7] = 0, c[11] = 0, c[15] = 1, this;
	}
	equals(e) {
		let t = this.elements, n = e.elements;
		for (let e = 0; e < 16; e++) if (t[e] !== n[e]) return !1;
		return !0;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 16; n++) this.elements[n] = e[n + t];
		return this;
	}
	toArray(e = [], t = 0) {
		let n = this.elements;
		return e[t] = n[0], e[t + 1] = n[1], e[t + 2] = n[2], e[t + 3] = n[3], e[t + 4] = n[4], e[t + 5] = n[5], e[t + 6] = n[6], e[t + 7] = n[7], e[t + 8] = n[8], e[t + 9] = n[9], e[t + 10] = n[10], e[t + 11] = n[11], e[t + 12] = n[12], e[t + 13] = n[13], e[t + 14] = n[14], e[t + 15] = n[15], e;
	}
}, vr = /*@__PURE__*/ new W(), yr = /*@__PURE__*/ new q(), br = /*@__PURE__*/ new W(0, 0, 0), xr = /*@__PURE__*/ new W(1, 1, 1), Sr = /*@__PURE__*/ new W(), Cr = /*@__PURE__*/ new W(), wr = /*@__PURE__*/ new W(), Tr = /*@__PURE__*/ new q(), Er = /*@__PURE__*/ new Xn(), Dr = class e {
	constructor(t = 0, n = 0, r = 0, i = e.DEFAULT_ORDER) {
		this.isEuler = !0, this._x = t, this._y = n, this._z = r, this._order = i;
	}
	get x() {
		return this._x;
	}
	set x(e) {
		this._x = e, this._onChangeCallback();
	}
	get y() {
		return this._y;
	}
	set y(e) {
		this._y = e, this._onChangeCallback();
	}
	get z() {
		return this._z;
	}
	set z(e) {
		this._z = e, this._onChangeCallback();
	}
	get order() {
		return this._order;
	}
	set order(e) {
		this._order = e, this._onChangeCallback();
	}
	set(e, t, n, r = this._order) {
		return this._x = e, this._y = t, this._z = n, this._order = r, this._onChangeCallback(), this;
	}
	clone() {
		return new this.constructor(this._x, this._y, this._z, this._order);
	}
	copy(e) {
		return this._x = e._x, this._y = e._y, this._z = e._z, this._order = e._order, this._onChangeCallback(), this;
	}
	setFromRotationMatrix(e, t = this._order, n = !0) {
		let r = e.elements, i = r[0], a = r[4], o = r[8], s = r[1], c = r[5], l = r[9], u = r[2], d = r[6], f = r[10];
		switch (t) {
			case "XYZ":
				this._y = Math.asin(H(o, -1, 1)), Math.abs(o) < .9999999 ? (this._x = Math.atan2(-l, f), this._z = Math.atan2(-a, i)) : (this._x = Math.atan2(d, c), this._z = 0);
				break;
			case "YXZ":
				this._x = Math.asin(-H(l, -1, 1)), Math.abs(l) < .9999999 ? (this._y = Math.atan2(o, f), this._z = Math.atan2(s, c)) : (this._y = Math.atan2(-u, i), this._z = 0);
				break;
			case "ZXY":
				this._x = Math.asin(H(d, -1, 1)), Math.abs(d) < .9999999 ? (this._y = Math.atan2(-u, f), this._z = Math.atan2(-a, c)) : (this._y = 0, this._z = Math.atan2(s, i));
				break;
			case "ZYX":
				this._y = Math.asin(-H(u, -1, 1)), Math.abs(u) < .9999999 ? (this._x = Math.atan2(d, f), this._z = Math.atan2(s, i)) : (this._x = 0, this._z = Math.atan2(-a, c));
				break;
			case "YZX":
				this._z = Math.asin(H(s, -1, 1)), Math.abs(s) < .9999999 ? (this._x = Math.atan2(-l, c), this._y = Math.atan2(-u, i)) : (this._x = 0, this._y = Math.atan2(o, f));
				break;
			case "XZY":
				this._z = Math.asin(-H(a, -1, 1)), Math.abs(a) < .9999999 ? (this._x = Math.atan2(d, c), this._y = Math.atan2(o, i)) : (this._x = Math.atan2(-l, f), this._y = 0);
				break;
			default: B("Euler: .setFromRotationMatrix() encountered an unknown order: " + t);
		}
		return this._order = t, n === !0 && this._onChangeCallback(), this;
	}
	setFromQuaternion(e, t, n) {
		return Tr.makeRotationFromQuaternion(e), this.setFromRotationMatrix(Tr, t, n);
	}
	setFromVector3(e, t = this._order) {
		return this.set(e.x, e.y, e.z, t);
	}
	reorder(e) {
		return Er.setFromEuler(this), this.setFromQuaternion(Er, e);
	}
	equals(e) {
		return e._x === this._x && e._y === this._y && e._z === this._z && e._order === this._order;
	}
	fromArray(e) {
		return this._x = e[0], this._y = e[1], this._z = e[2], e[3] !== void 0 && (this._order = e[3]), this._onChangeCallback(), this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this._x, e[t + 1] = this._y, e[t + 2] = this._z, e[t + 3] = this._order, e;
	}
	_onChange(e) {
		return this._onChangeCallback = e, this;
	}
	_onChangeCallback() {}
	*[Symbol.iterator]() {
		yield this._x, yield this._y, yield this._z, yield this._order;
	}
};
Dr.DEFAULT_ORDER = "XYZ";
var Or = class {
	constructor() {
		this.mask = 1;
	}
	set(e) {
		this.mask = (1 << e | 0) >>> 0;
	}
	enable(e) {
		this.mask |= 1 << e | 0;
	}
	enableAll() {
		this.mask = -1;
	}
	toggle(e) {
		this.mask ^= 1 << e | 0;
	}
	disable(e) {
		this.mask &= ~(1 << e | 0);
	}
	disableAll() {
		this.mask = 0;
	}
	test(e) {
		return (this.mask & e.mask) !== 0;
	}
	isEnabled(e) {
		return (this.mask & (1 << e | 0)) != 0;
	}
}, kr = 0, Ar = /*@__PURE__*/ new W(), jr = /*@__PURE__*/ new Xn(), Mr = /*@__PURE__*/ new q(), Nr = /*@__PURE__*/ new W(), Pr = /*@__PURE__*/ new W(), Fr = /*@__PURE__*/ new W(), Ir = /*@__PURE__*/ new Xn(), Lr = /*@__PURE__*/ new W(1, 0, 0), Rr = /*@__PURE__*/ new W(0, 1, 0), zr = /*@__PURE__*/ new W(0, 0, 1), Br = { type: "added" }, Vr = { type: "removed" }, Hr = {
	type: "childadded",
	child: null
}, Ur = {
	type: "childremoved",
	child: null
}, Wr = class e extends Cn {
	constructor() {
		super(), this.isObject3D = !0, Object.defineProperty(this, "id", { value: kr++ }), this.uuid = On(), this.name = "", this.type = "Object3D", this.parent = null, this.children = [], this.up = e.DEFAULT_UP.clone();
		let t = new W(), n = new Dr(), r = new Xn(), i = new W(1, 1, 1);
		function a() {
			r.setFromEuler(n, !1);
		}
		function o() {
			n.setFromQuaternion(r, void 0, !1);
		}
		n._onChange(a), r._onChange(o), Object.defineProperties(this, {
			position: {
				configurable: !0,
				enumerable: !0,
				value: t
			},
			rotation: {
				configurable: !0,
				enumerable: !0,
				value: n
			},
			quaternion: {
				configurable: !0,
				enumerable: !0,
				value: r
			},
			scale: {
				configurable: !0,
				enumerable: !0,
				value: i
			},
			modelViewMatrix: { value: new q() },
			normalMatrix: { value: new G() }
		}), this.matrix = new q(), this.matrixWorld = new q(), this.matrixAutoUpdate = e.DEFAULT_MATRIX_AUTO_UPDATE, this.matrixWorldAutoUpdate = e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, this.matrixWorldNeedsUpdate = !1, this.layers = new Or(), this.visible = !0, this.castShadow = !1, this.receiveShadow = !1, this.frustumCulled = !0, this.renderOrder = 0, this.animations = [], this.customDepthMaterial = void 0, this.customDistanceMaterial = void 0, this.static = !1, this.userData = {}, this.pivot = null;
	}
	onBeforeShadow() {}
	onAfterShadow() {}
	onBeforeRender() {}
	onAfterRender() {}
	applyMatrix4(e) {
		this.matrixAutoUpdate && this.updateMatrix(), this.matrix.premultiply(e), this.matrix.decompose(this.position, this.quaternion, this.scale);
	}
	applyQuaternion(e) {
		return this.quaternion.premultiply(e), this;
	}
	setRotationFromAxisAngle(e, t) {
		this.quaternion.setFromAxisAngle(e, t);
	}
	setRotationFromEuler(e) {
		this.quaternion.setFromEuler(e, !0);
	}
	setRotationFromMatrix(e) {
		this.quaternion.setFromRotationMatrix(e);
	}
	setRotationFromQuaternion(e) {
		this.quaternion.copy(e);
	}
	rotateOnAxis(e, t) {
		return jr.setFromAxisAngle(e, t), this.quaternion.multiply(jr), this;
	}
	rotateOnWorldAxis(e, t) {
		return jr.setFromAxisAngle(e, t), this.quaternion.premultiply(jr), this;
	}
	rotateX(e) {
		return this.rotateOnAxis(Lr, e);
	}
	rotateY(e) {
		return this.rotateOnAxis(Rr, e);
	}
	rotateZ(e) {
		return this.rotateOnAxis(zr, e);
	}
	translateOnAxis(e, t) {
		return Ar.copy(e).applyQuaternion(this.quaternion), this.position.add(Ar.multiplyScalar(t)), this;
	}
	translateX(e) {
		return this.translateOnAxis(Lr, e);
	}
	translateY(e) {
		return this.translateOnAxis(Rr, e);
	}
	translateZ(e) {
		return this.translateOnAxis(zr, e);
	}
	localToWorld(e) {
		return this.updateWorldMatrix(!0, !1), e.applyMatrix4(this.matrixWorld);
	}
	worldToLocal(e) {
		return this.updateWorldMatrix(!0, !1), e.applyMatrix4(Mr.copy(this.matrixWorld).invert());
	}
	lookAt(e, t, n) {
		e.isVector3 ? Nr.copy(e) : Nr.set(e, t, n);
		let r = this.parent;
		this.updateWorldMatrix(!0, !1), Pr.setFromMatrixPosition(this.matrixWorld), this.isCamera || this.isLight ? Mr.lookAt(Pr, Nr, this.up) : Mr.lookAt(Nr, Pr, this.up), this.quaternion.setFromRotationMatrix(Mr), r && (Mr.extractRotation(r.matrixWorld), jr.setFromRotationMatrix(Mr), this.quaternion.premultiply(jr.invert()));
	}
	add(e) {
		if (arguments.length > 1) {
			for (let e = 0; e < arguments.length; e++) this.add(arguments[e]);
			return this;
		}
		return e === this ? (V("Object3D.add: object can't be added as a child of itself.", e), this) : (e && e.isObject3D ? (e.removeFromParent(), e.parent = this, this.children.push(e), e.dispatchEvent(Br), Hr.child = e, this.dispatchEvent(Hr), Hr.child = null) : V("Object3D.add: object not an instance of THREE.Object3D.", e), this);
	}
	remove(e) {
		if (arguments.length > 1) {
			for (let e = 0; e < arguments.length; e++) this.remove(arguments[e]);
			return this;
		}
		let t = this.children.indexOf(e);
		return t !== -1 && (e.parent = null, this.children.splice(t, 1), e.dispatchEvent(Vr), Ur.child = e, this.dispatchEvent(Ur), Ur.child = null), this;
	}
	removeFromParent() {
		let e = this.parent;
		return e !== null && e.remove(this), this;
	}
	clear() {
		return this.remove(...this.children);
	}
	attach(e) {
		return this.updateWorldMatrix(!0, !1), Mr.copy(this.matrixWorld).invert(), e.parent !== null && (e.parent.updateWorldMatrix(!0, !1), Mr.multiply(e.parent.matrixWorld)), e.applyMatrix4(Mr), e.removeFromParent(), e.parent = this, this.children.push(e), e.updateWorldMatrix(!1, !0), e.dispatchEvent(Br), Hr.child = e, this.dispatchEvent(Hr), Hr.child = null, this;
	}
	getObjectById(e) {
		return this.getObjectByProperty("id", e);
	}
	getObjectByName(e) {
		return this.getObjectByProperty("name", e);
	}
	getObjectByProperty(e, t) {
		if (this[e] === t) return this;
		for (let n = 0, r = this.children.length; n < r; n++) {
			let r = this.children[n].getObjectByProperty(e, t);
			if (r !== void 0) return r;
		}
	}
	getObjectsByProperty(e, t, n = []) {
		this[e] === t && n.push(this);
		let r = this.children;
		for (let i = 0, a = r.length; i < a; i++) r[i].getObjectsByProperty(e, t, n);
		return n;
	}
	getWorldPosition(e) {
		return this.updateWorldMatrix(!0, !1), e.setFromMatrixPosition(this.matrixWorld);
	}
	getWorldQuaternion(e) {
		return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Pr, e, Fr), e;
	}
	getWorldScale(e) {
		return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Pr, Ir, e), e;
	}
	getWorldDirection(e) {
		this.updateWorldMatrix(!0, !1);
		let t = this.matrixWorld.elements;
		return e.set(t[8], t[9], t[10]).normalize();
	}
	raycast() {}
	traverse(e) {
		e(this);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].traverse(e);
	}
	traverseVisible(e) {
		if (this.visible === !1) return;
		e(this);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].traverseVisible(e);
	}
	traverseAncestors(e) {
		let t = this.parent;
		t !== null && (e(t), t.traverseAncestors(e));
	}
	updateMatrix() {
		this.matrix.compose(this.position, this.quaternion, this.scale);
		let e = this.pivot;
		if (e !== null) {
			let t = e.x, n = e.y, r = e.z, i = this.matrix.elements;
			i[12] += t - i[0] * t - i[4] * n - i[8] * r, i[13] += n - i[1] * t - i[5] * n - i[9] * r, i[14] += r - i[2] * t - i[6] * n - i[10] * r;
		}
		this.matrixWorldNeedsUpdate = !0;
	}
	updateMatrixWorld(e) {
		this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || e) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, e = !0);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].updateMatrixWorld(e);
	}
	updateWorldMatrix(e, t, n = !1) {
		let r = this.parent;
		if (e === !0 && r !== null && r.updateWorldMatrix(!0, !1), this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || n) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, n = !0), t === !0) {
			let e = this.children;
			for (let t = 0, r = e.length; t < r; t++) e[t].updateWorldMatrix(!1, !0, n);
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string", n = {};
		t && (e = {
			geometries: {},
			materials: {},
			textures: {},
			images: {},
			shapes: {},
			skeletons: {},
			animations: {},
			nodes: {}
		}, n.metadata = {
			version: 4.7,
			type: "Object",
			generator: "Object3D.toJSON"
		});
		let r = {};
		r.uuid = this.uuid, r.type = this.type, this.name !== "" && (r.name = this.name), this.castShadow === !0 && (r.castShadow = !0), this.receiveShadow === !0 && (r.receiveShadow = !0), this.visible === !1 && (r.visible = !1), this.frustumCulled === !1 && (r.frustumCulled = !1), this.renderOrder !== 0 && (r.renderOrder = this.renderOrder), this.static !== !1 && (r.static = this.static), Object.keys(this.userData).length > 0 && (r.userData = this.userData), r.layers = this.layers.mask, r.matrix = this.matrix.toArray(), r.up = this.up.toArray(), this.pivot !== null && (r.pivot = this.pivot.toArray()), this.matrixAutoUpdate === !1 && (r.matrixAutoUpdate = !1), this.morphTargetDictionary !== void 0 && (r.morphTargetDictionary = Object.assign({}, this.morphTargetDictionary)), this.morphTargetInfluences !== void 0 && (r.morphTargetInfluences = this.morphTargetInfluences.slice()), this.isInstancedMesh && (r.type = "InstancedMesh", r.count = this.count, r.instanceMatrix = this.instanceMatrix.toJSON(), this.instanceColor !== null && (r.instanceColor = this.instanceColor.toJSON())), this.isBatchedMesh && (r.type = "BatchedMesh", r.perObjectFrustumCulled = this.perObjectFrustumCulled, r.sortObjects = this.sortObjects, r.drawRanges = this._drawRanges, r.reservedRanges = this._reservedRanges, r.geometryInfo = this._geometryInfo.map((e) => ({
			...e,
			boundingBox: e.boundingBox ? e.boundingBox.toJSON() : void 0,
			boundingSphere: e.boundingSphere ? e.boundingSphere.toJSON() : void 0
		})), r.instanceInfo = this._instanceInfo.map((e) => ({ ...e })), r.availableInstanceIds = this._availableInstanceIds.slice(), r.availableGeometryIds = this._availableGeometryIds.slice(), r.nextIndexStart = this._nextIndexStart, r.nextVertexStart = this._nextVertexStart, r.geometryCount = this._geometryCount, r.maxInstanceCount = this._maxInstanceCount, r.maxVertexCount = this._maxVertexCount, r.maxIndexCount = this._maxIndexCount, r.geometryInitialized = this._geometryInitialized, r.matricesTexture = this._matricesTexture.toJSON(e), r.indirectTexture = this._indirectTexture.toJSON(e), this._colorsTexture !== null && (r.colorsTexture = this._colorsTexture.toJSON(e)), this.boundingSphere !== null && (r.boundingSphere = this.boundingSphere.toJSON()), this.boundingBox !== null && (r.boundingBox = this.boundingBox.toJSON()));
		function i(t, n) {
			return t[n.uuid] === void 0 && (t[n.uuid] = n.toJSON(e)), n.uuid;
		}
		if (this.isScene) this.background && (this.background.isColor ? r.background = this.background.toJSON() : this.background.isTexture && (r.background = this.background.toJSON(e).uuid)), this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== !0 && (r.environment = this.environment.toJSON(e).uuid);
		else if (this.isMesh || this.isLine || this.isPoints) {
			r.geometry = i(e.geometries, this.geometry);
			let t = this.geometry.parameters;
			if (t !== void 0 && t.shapes !== void 0) {
				let n = t.shapes;
				if (Array.isArray(n)) for (let t = 0, r = n.length; t < r; t++) {
					let r = n[t];
					i(e.shapes, r);
				}
				else i(e.shapes, n);
			}
		}
		if (this.isSkinnedMesh && (r.bindMode = this.bindMode, r.bindMatrix = this.bindMatrix.toArray(), this.skeleton !== void 0 && (i(e.skeletons, this.skeleton), r.skeleton = this.skeleton.uuid)), this.material !== void 0) if (Array.isArray(this.material)) {
			let t = [];
			for (let n = 0, r = this.material.length; n < r; n++) t.push(i(e.materials, this.material[n]));
			r.material = t;
		} else r.material = i(e.materials, this.material);
		if (this.children.length > 0) {
			r.children = [];
			for (let t = 0; t < this.children.length; t++) r.children.push(this.children[t].toJSON(e).object);
		}
		if (this.animations.length > 0) {
			r.animations = [];
			for (let t = 0; t < this.animations.length; t++) {
				let n = this.animations[t];
				r.animations.push(i(e.animations, n));
			}
		}
		if (t) {
			let t = a(e.geometries), r = a(e.materials), i = a(e.textures), o = a(e.images), s = a(e.shapes), c = a(e.skeletons), l = a(e.animations), u = a(e.nodes);
			t.length > 0 && (n.geometries = t), r.length > 0 && (n.materials = r), i.length > 0 && (n.textures = i), o.length > 0 && (n.images = o), s.length > 0 && (n.shapes = s), c.length > 0 && (n.skeletons = c), l.length > 0 && (n.animations = l), u.length > 0 && (n.nodes = u);
		}
		return n.object = r, n;
		function a(e) {
			let t = [];
			for (let n in e) {
				let r = e[n];
				delete r.metadata, t.push(r);
			}
			return t;
		}
	}
	clone(e) {
		return new this.constructor().copy(this, e);
	}
	copy(e, t = !0) {
		if (this.name = e.name, this.up.copy(e.up), this.position.copy(e.position), this.rotation.order = e.rotation.order, this.quaternion.copy(e.quaternion), this.scale.copy(e.scale), this.pivot = e.pivot === null ? null : e.pivot.clone(), this.matrix.copy(e.matrix), this.matrixWorld.copy(e.matrixWorld), this.matrixAutoUpdate = e.matrixAutoUpdate, this.matrixWorldAutoUpdate = e.matrixWorldAutoUpdate, this.matrixWorldNeedsUpdate = e.matrixWorldNeedsUpdate, this.layers.mask = e.layers.mask, this.visible = e.visible, this.castShadow = e.castShadow, this.receiveShadow = e.receiveShadow, this.frustumCulled = e.frustumCulled, this.renderOrder = e.renderOrder, this.static = e.static, this.animations = e.animations.slice(), this.userData = JSON.parse(JSON.stringify(e.userData)), t === !0) for (let t = 0; t < e.children.length; t++) {
			let n = e.children[t];
			this.add(n.clone());
		}
		return this;
	}
};
Wr.DEFAULT_UP = /*@__PURE__*/ new W(0, 1, 0), Wr.DEFAULT_MATRIX_AUTO_UPDATE = !0, Wr.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
var Gr = class extends Wr {
	constructor() {
		super(), this.isGroup = !0, this.type = "Group";
	}
}, Kr = { type: "move" }, qr = class {
	constructor() {
		this._targetRay = null, this._grip = null, this._hand = null;
	}
	getHandSpace() {
		return this._hand === null && (this._hand = new Gr(), this._hand.matrixAutoUpdate = !1, this._hand.visible = !1, this._hand.joints = {}, this._hand.inputState = { pinching: !1 }), this._hand;
	}
	getTargetRaySpace() {
		return this._targetRay === null && (this._targetRay = new Gr(), this._targetRay.matrixAutoUpdate = !1, this._targetRay.visible = !1, this._targetRay.hasLinearVelocity = !1, this._targetRay.linearVelocity = new W(), this._targetRay.hasAngularVelocity = !1, this._targetRay.angularVelocity = new W()), this._targetRay;
	}
	getGripSpace() {
		return this._grip === null && (this._grip = new Gr(), this._grip.matrixAutoUpdate = !1, this._grip.visible = !1, this._grip.hasLinearVelocity = !1, this._grip.linearVelocity = new W(), this._grip.hasAngularVelocity = !1, this._grip.angularVelocity = new W(), this._grip.eventsEnabled = !1), this._grip;
	}
	dispatchEvent(e) {
		return this._targetRay !== null && this._targetRay.dispatchEvent(e), this._grip !== null && this._grip.dispatchEvent(e), this._hand !== null && this._hand.dispatchEvent(e), this;
	}
	connect(e) {
		if (e && e.hand) {
			let t = this._hand;
			if (t) for (let n of e.hand.values()) this._getHandJoint(t, n);
		}
		return this.dispatchEvent({
			type: "connected",
			data: e
		}), this;
	}
	disconnect(e) {
		return this.dispatchEvent({
			type: "disconnected",
			data: e
		}), this._targetRay !== null && (this._targetRay.visible = !1), this._grip !== null && (this._grip.visible = !1), this._hand !== null && (this._hand.visible = !1), this;
	}
	update(e, t, n) {
		let r = null, i = null, a = null, o = this._targetRay, s = this._grip, c = this._hand;
		if (e && t.session.visibilityState !== "visible-blurred") {
			if (c && e.hand) {
				a = !0;
				for (let r of e.hand.values()) {
					let e = t.getJointPose(r, n), i = this._getHandJoint(c, r);
					e !== null && (i.matrix.fromArray(e.transform.matrix), i.matrix.decompose(i.position, i.rotation, i.scale), i.matrixWorldNeedsUpdate = !0, i.jointRadius = e.radius), i.visible = e !== null;
				}
				let r = c.joints["index-finger-tip"], i = c.joints["thumb-tip"], o = r.position.distanceTo(i.position);
				c.inputState.pinching && o > .025 ? (c.inputState.pinching = !1, this.dispatchEvent({
					type: "pinchend",
					handedness: e.handedness,
					target: this
				})) : !c.inputState.pinching && o <= .015 && (c.inputState.pinching = !0, this.dispatchEvent({
					type: "pinchstart",
					handedness: e.handedness,
					target: this
				}));
			} else s !== null && e.gripSpace && (i = t.getPose(e.gripSpace, n), i !== null && (s.matrix.fromArray(i.transform.matrix), s.matrix.decompose(s.position, s.rotation, s.scale), s.matrixWorldNeedsUpdate = !0, i.linearVelocity ? (s.hasLinearVelocity = !0, s.linearVelocity.copy(i.linearVelocity)) : s.hasLinearVelocity = !1, i.angularVelocity ? (s.hasAngularVelocity = !0, s.angularVelocity.copy(i.angularVelocity)) : s.hasAngularVelocity = !1, s.eventsEnabled && s.dispatchEvent({
				type: "gripUpdated",
				data: e,
				target: this
			})));
			o !== null && (r = t.getPose(e.targetRaySpace, n), r === null && i !== null && (r = i), r !== null && (o.matrix.fromArray(r.transform.matrix), o.matrix.decompose(o.position, o.rotation, o.scale), o.matrixWorldNeedsUpdate = !0, r.linearVelocity ? (o.hasLinearVelocity = !0, o.linearVelocity.copy(r.linearVelocity)) : o.hasLinearVelocity = !1, r.angularVelocity ? (o.hasAngularVelocity = !0, o.angularVelocity.copy(r.angularVelocity)) : o.hasAngularVelocity = !1, this.dispatchEvent(Kr)));
		}
		return o !== null && (o.visible = r !== null), s !== null && (s.visible = i !== null), c !== null && (c.visible = a !== null), this;
	}
	_getHandJoint(e, t) {
		if (e.joints[t.jointName] === void 0) {
			let n = new Gr();
			n.matrixAutoUpdate = !1, n.visible = !1, e.joints[t.jointName] = n, e.add(n);
		}
		return e.joints[t.jointName];
	}
}, Jr = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
}, Yr = {
	h: 0,
	s: 0,
	l: 0
}, Xr = {
	h: 0,
	s: 0,
	l: 0
};
function Zr(e, t, n) {
	return n < 0 && (n += 1), n > 1 && --n, n < 1 / 6 ? e + (t - e) * 6 * n : n < 1 / 2 ? t : n < 2 / 3 ? e + (t - e) * 6 * (2 / 3 - n) : e;
}
var J = class {
	constructor(e, t, n) {
		return this.isColor = !0, this.r = 1, this.g = 1, this.b = 1, this.set(e, t, n);
	}
	set(e, t, n) {
		if (t === void 0 && n === void 0) {
			let t = e;
			t && t.isColor ? this.copy(t) : typeof t == "number" ? this.setHex(t) : typeof t == "string" && this.setStyle(t);
		} else this.setRGB(e, t, n);
		return this;
	}
	setScalar(e) {
		return this.r = e, this.g = e, this.b = e, this;
	}
	setHex(e, t = on) {
		return e = Math.floor(e), this.r = (e >> 16 & 255) / 255, this.g = (e >> 8 & 255) / 255, this.b = (e & 255) / 255, K.colorSpaceToWorking(this, t), this;
	}
	setRGB(e, t, n, r = K.workingColorSpace) {
		return this.r = e, this.g = t, this.b = n, K.colorSpaceToWorking(this, r), this;
	}
	setHSL(e, t, n, r = K.workingColorSpace) {
		if (e = kn(e, 1), t = H(t, 0, 1), n = H(n, 0, 1), t === 0) this.r = this.g = this.b = n;
		else {
			let r = n <= .5 ? n * (1 + t) : n + t - n * t, i = 2 * n - r;
			this.r = Zr(i, r, e + 1 / 3), this.g = Zr(i, r, e), this.b = Zr(i, r, e - 1 / 3);
		}
		return K.colorSpaceToWorking(this, r), this;
	}
	setStyle(e, t = on) {
		function n(t) {
			t !== void 0 && parseFloat(t) < 1 && B("Color: Alpha component of " + e + " will be ignored.");
		}
		let r;
		if (r = /^(\w+)\(([^\)]*)\)/.exec(e)) {
			let i, a = r[1], o = r[2];
			switch (a) {
				case "rgb":
				case "rgba":
					if (i = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setRGB(Math.min(255, parseInt(i[1], 10)) / 255, Math.min(255, parseInt(i[2], 10)) / 255, Math.min(255, parseInt(i[3], 10)) / 255, t);
					if (i = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setRGB(Math.min(100, parseInt(i[1], 10)) / 100, Math.min(100, parseInt(i[2], 10)) / 100, Math.min(100, parseInt(i[3], 10)) / 100, t);
					break;
				case "hsl":
				case "hsla":
					if (i = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setHSL(parseFloat(i[1]) / 360, parseFloat(i[2]) / 100, parseFloat(i[3]) / 100, t);
					break;
				default: B("Color: Unknown color model " + e);
			}
		} else if (r = /^\#([A-Fa-f\d]+)$/.exec(e)) {
			let n = r[1], i = n.length;
			if (i === 3) return this.setRGB(parseInt(n.charAt(0), 16) / 15, parseInt(n.charAt(1), 16) / 15, parseInt(n.charAt(2), 16) / 15, t);
			if (i === 6) return this.setHex(parseInt(n, 16), t);
			B("Color: Invalid hex color " + e);
		} else if (e && e.length > 0) return this.setColorName(e, t);
		return this;
	}
	setColorName(e, t = on) {
		let n = Jr[e.toLowerCase()];
		return n === void 0 ? B("Color: Unknown color " + e) : this.setHex(n, t), this;
	}
	clone() {
		return new this.constructor(this.r, this.g, this.b);
	}
	copy(e) {
		return this.r = e.r, this.g = e.g, this.b = e.b, this;
	}
	copySRGBToLinear(e) {
		return this.r = rr(e.r), this.g = rr(e.g), this.b = rr(e.b), this;
	}
	copyLinearToSRGB(e) {
		return this.r = ir(e.r), this.g = ir(e.g), this.b = ir(e.b), this;
	}
	convertSRGBToLinear() {
		return this.copySRGBToLinear(this), this;
	}
	convertLinearToSRGB() {
		return this.copyLinearToSRGB(this), this;
	}
	getHex(e = on) {
		return K.workingToColorSpace(Qr.copy(this), e), Math.round(H(Qr.r * 255, 0, 255)) * 65536 + Math.round(H(Qr.g * 255, 0, 255)) * 256 + Math.round(H(Qr.b * 255, 0, 255));
	}
	getHexString(e = on) {
		return ("000000" + this.getHex(e).toString(16)).slice(-6);
	}
	getHSL(e, t = K.workingColorSpace) {
		K.workingToColorSpace(Qr.copy(this), t);
		let n = Qr.r, r = Qr.g, i = Qr.b, a = Math.max(n, r, i), o = Math.min(n, r, i), s, c, l = (o + a) / 2;
		if (o === a) s = 0, c = 0;
		else {
			let e = a - o;
			switch (c = l <= .5 ? e / (a + o) : e / (2 - a - o), a) {
				case n:
					s = (r - i) / e + (r < i ? 6 : 0);
					break;
				case r:
					s = (i - n) / e + 2;
					break;
				case i:
					s = (n - r) / e + 4;
					break;
			}
			s /= 6;
		}
		return e.h = s, e.s = c, e.l = l, e;
	}
	getRGB(e, t = K.workingColorSpace) {
		return K.workingToColorSpace(Qr.copy(this), t), e.r = Qr.r, e.g = Qr.g, e.b = Qr.b, e;
	}
	getStyle(e = on) {
		K.workingToColorSpace(Qr.copy(this), e);
		let t = Qr.r, n = Qr.g, r = Qr.b;
		return e === "srgb" ? `rgb(${Math.round(t * 255)},${Math.round(n * 255)},${Math.round(r * 255)})` : `color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`;
	}
	offsetHSL(e, t, n) {
		return this.getHSL(Yr), this.setHSL(Yr.h + e, Yr.s + t, Yr.l + n);
	}
	add(e) {
		return this.r += e.r, this.g += e.g, this.b += e.b, this;
	}
	addColors(e, t) {
		return this.r = e.r + t.r, this.g = e.g + t.g, this.b = e.b + t.b, this;
	}
	addScalar(e) {
		return this.r += e, this.g += e, this.b += e, this;
	}
	sub(e) {
		return this.r = Math.max(0, this.r - e.r), this.g = Math.max(0, this.g - e.g), this.b = Math.max(0, this.b - e.b), this;
	}
	multiply(e) {
		return this.r *= e.r, this.g *= e.g, this.b *= e.b, this;
	}
	multiplyScalar(e) {
		return this.r *= e, this.g *= e, this.b *= e, this;
	}
	lerp(e, t) {
		return this.r += (e.r - this.r) * t, this.g += (e.g - this.g) * t, this.b += (e.b - this.b) * t, this;
	}
	lerpColors(e, t, n) {
		return this.r = e.r + (t.r - e.r) * n, this.g = e.g + (t.g - e.g) * n, this.b = e.b + (t.b - e.b) * n, this;
	}
	lerpHSL(e, t) {
		this.getHSL(Yr), e.getHSL(Xr);
		let n = Mn(Yr.h, Xr.h, t), r = Mn(Yr.s, Xr.s, t), i = Mn(Yr.l, Xr.l, t);
		return this.setHSL(n, r, i), this;
	}
	setFromVector3(e) {
		return this.r = e.x, this.g = e.y, this.b = e.z, this;
	}
	applyMatrix3(e) {
		let t = this.r, n = this.g, r = this.b, i = e.elements;
		return this.r = i[0] * t + i[3] * n + i[6] * r, this.g = i[1] * t + i[4] * n + i[7] * r, this.b = i[2] * t + i[5] * n + i[8] * r, this;
	}
	equals(e) {
		return e.r === this.r && e.g === this.g && e.b === this.b;
	}
	fromArray(e, t = 0) {
		return this.r = e[t], this.g = e[t + 1], this.b = e[t + 2], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.r, e[t + 1] = this.g, e[t + 2] = this.b, e;
	}
	fromBufferAttribute(e, t) {
		return this.r = e.getX(t), this.g = e.getY(t), this.b = e.getZ(t), this;
	}
	toJSON() {
		return this.getHex();
	}
	*[Symbol.iterator]() {
		yield this.r, yield this.g, yield this.b;
	}
}, Qr = /*@__PURE__*/ new J();
J.NAMES = Jr;
var $r = class extends Wr {
	constructor() {
		super(), this.isScene = !0, this.type = "Scene", this.background = null, this.environment = null, this.fog = null, this.backgroundBlurriness = 0, this.backgroundIntensity = 1, this.backgroundRotation = new Dr(), this.environmentIntensity = 1, this.environmentRotation = new Dr(), this.overrideMaterial = null, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	copy(e, t) {
		return super.copy(e, t), e.background !== null && (this.background = e.background.clone()), e.environment !== null && (this.environment = e.environment.clone()), e.fog !== null && (this.fog = e.fog.clone()), this.backgroundBlurriness = e.backgroundBlurriness, this.backgroundIntensity = e.backgroundIntensity, this.backgroundRotation.copy(e.backgroundRotation), this.environmentIntensity = e.environmentIntensity, this.environmentRotation.copy(e.environmentRotation), e.overrideMaterial !== null && (this.overrideMaterial = e.overrideMaterial.clone()), this.matrixAutoUpdate = e.matrixAutoUpdate, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return this.fog !== null && (t.object.fog = this.fog.toJSON()), this.backgroundBlurriness > 0 && (t.object.backgroundBlurriness = this.backgroundBlurriness), this.backgroundIntensity !== 1 && (t.object.backgroundIntensity = this.backgroundIntensity), t.object.backgroundRotation = this.backgroundRotation.toArray(), this.environmentIntensity !== 1 && (t.object.environmentIntensity = this.environmentIntensity), t.object.environmentRotation = this.environmentRotation.toArray(), t;
	}
}, ei = /*@__PURE__*/ new W(), ti = /*@__PURE__*/ new W(), ni = /*@__PURE__*/ new W(), ri = /*@__PURE__*/ new W(), ii = /*@__PURE__*/ new W(), ai = /*@__PURE__*/ new W(), oi = /*@__PURE__*/ new W(), si = /*@__PURE__*/ new W(), ci = /*@__PURE__*/ new W(), li = /*@__PURE__*/ new W(), ui = /*@__PURE__*/ new pr(), di = /*@__PURE__*/ new pr(), fi = /*@__PURE__*/ new pr(), pi = class e {
	constructor(e = new W(), t = new W(), n = new W()) {
		this.a = e, this.b = t, this.c = n;
	}
	static getNormal(e, t, n, r) {
		r.subVectors(n, t), ei.subVectors(e, t), r.cross(ei);
		let i = r.lengthSq();
		return i > 0 ? r.multiplyScalar(1 / Math.sqrt(i)) : r.set(0, 0, 0);
	}
	static getBarycoord(e, t, n, r, i) {
		ei.subVectors(r, t), ti.subVectors(n, t), ni.subVectors(e, t);
		let a = ei.dot(ei), o = ei.dot(ti), s = ei.dot(ni), c = ti.dot(ti), l = ti.dot(ni), u = a * c - o * o;
		if (u === 0) return i.set(0, 0, 0), null;
		let d = 1 / u, f = (c * s - o * l) * d, p = (a * l - o * s) * d;
		return i.set(1 - f - p, p, f);
	}
	static containsPoint(e, t, n, r) {
		return this.getBarycoord(e, t, n, r, ri) !== null && ri.x >= 0 && ri.y >= 0 && ri.x + ri.y <= 1;
	}
	static getInterpolation(e, t, n, r, i, a, o, s) {
		return this.getBarycoord(e, t, n, r, ri) === null ? (s.x = 0, s.y = 0, "z" in s && (s.z = 0), "w" in s && (s.w = 0), null) : (s.setScalar(0), s.addScaledVector(i, ri.x), s.addScaledVector(a, ri.y), s.addScaledVector(o, ri.z), s);
	}
	static getInterpolatedAttribute(e, t, n, r, i, a) {
		return ui.setScalar(0), di.setScalar(0), fi.setScalar(0), ui.fromBufferAttribute(e, t), di.fromBufferAttribute(e, n), fi.fromBufferAttribute(e, r), a.setScalar(0), a.addScaledVector(ui, i.x), a.addScaledVector(di, i.y), a.addScaledVector(fi, i.z), a;
	}
	static isFrontFacing(e, t, n, r) {
		return ei.subVectors(n, t), ti.subVectors(e, t), ei.cross(ti).dot(r) < 0;
	}
	set(e, t, n) {
		return this.a.copy(e), this.b.copy(t), this.c.copy(n), this;
	}
	setFromPointsAndIndices(e, t, n, r) {
		return this.a.copy(e[t]), this.b.copy(e[n]), this.c.copy(e[r]), this;
	}
	setFromAttributeAndIndices(e, t, n, r) {
		return this.a.fromBufferAttribute(e, t), this.b.fromBufferAttribute(e, n), this.c.fromBufferAttribute(e, r), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.a.copy(e.a), this.b.copy(e.b), this.c.copy(e.c), this;
	}
	getArea() {
		return ei.subVectors(this.c, this.b), ti.subVectors(this.a, this.b), ei.cross(ti).length() * .5;
	}
	getMidpoint(e) {
		return e.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
	}
	getNormal(t) {
		return e.getNormal(this.a, this.b, this.c, t);
	}
	getPlane(e) {
		return e.setFromCoplanarPoints(this.a, this.b, this.c);
	}
	getBarycoord(t, n) {
		return e.getBarycoord(t, this.a, this.b, this.c, n);
	}
	getInterpolation(t, n, r, i, a) {
		return e.getInterpolation(t, this.a, this.b, this.c, n, r, i, a);
	}
	containsPoint(t) {
		return e.containsPoint(t, this.a, this.b, this.c);
	}
	isFrontFacing(t) {
		return e.isFrontFacing(this.a, this.b, this.c, t);
	}
	intersectsBox(e) {
		return e.intersectsTriangle(this);
	}
	closestPointToPoint(e, t) {
		let n = this.a, r = this.b, i = this.c, a, o;
		ii.subVectors(r, n), ai.subVectors(i, n), si.subVectors(e, n);
		let s = ii.dot(si), c = ai.dot(si);
		if (s <= 0 && c <= 0) return t.copy(n);
		ci.subVectors(e, r);
		let l = ii.dot(ci), u = ai.dot(ci);
		if (l >= 0 && u <= l) return t.copy(r);
		let d = s * u - l * c;
		if (d <= 0 && s >= 0 && l <= 0) return a = s / (s - l), t.copy(n).addScaledVector(ii, a);
		li.subVectors(e, i);
		let f = ii.dot(li), p = ai.dot(li);
		if (p >= 0 && f <= p) return t.copy(i);
		let m = f * c - s * p;
		if (m <= 0 && c >= 0 && p <= 0) return o = c / (c - p), t.copy(n).addScaledVector(ai, o);
		let h = l * p - f * u;
		if (h <= 0 && u - l >= 0 && f - p >= 0) return oi.subVectors(i, r), o = (u - l) / (u - l + (f - p)), t.copy(r).addScaledVector(oi, o);
		let g = 1 / (h + m + d);
		return a = m * g, o = d * g, t.copy(n).addScaledVector(ii, a).addScaledVector(ai, o);
	}
	equals(e) {
		return e.a.equals(this.a) && e.b.equals(this.b) && e.c.equals(this.c);
	}
}, mi = class {
	constructor(e = new W(Infinity, Infinity, Infinity), t = new W(-Infinity, -Infinity, -Infinity)) {
		this.isBox3 = !0, this.min = e, this.max = t;
	}
	set(e, t) {
		return this.min.copy(e), this.max.copy(t), this;
	}
	setFromArray(e) {
		this.makeEmpty();
		for (let t = 0, n = e.length; t < n; t += 3) this.expandByPoint(gi.fromArray(e, t));
		return this;
	}
	setFromBufferAttribute(e) {
		this.makeEmpty();
		for (let t = 0, n = e.count; t < n; t++) this.expandByPoint(gi.fromBufferAttribute(e, t));
		return this;
	}
	setFromPoints(e) {
		this.makeEmpty();
		for (let t = 0, n = e.length; t < n; t++) this.expandByPoint(e[t]);
		return this;
	}
	setFromCenterAndSize(e, t) {
		let n = gi.copy(t).multiplyScalar(.5);
		return this.min.copy(e).sub(n), this.max.copy(e).add(n), this;
	}
	setFromObject(e, t = !1) {
		return this.makeEmpty(), this.expandByObject(e, t);
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.min.copy(e.min), this.max.copy(e.max), this;
	}
	makeEmpty() {
		return this.min.x = this.min.y = this.min.z = Infinity, this.max.x = this.max.y = this.max.z = -Infinity, this;
	}
	isEmpty() {
		return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
	}
	getCenter(e) {
		return this.isEmpty() ? e.set(0, 0, 0) : e.addVectors(this.min, this.max).multiplyScalar(.5);
	}
	getSize(e) {
		return this.isEmpty() ? e.set(0, 0, 0) : e.subVectors(this.max, this.min);
	}
	expandByPoint(e) {
		return this.min.min(e), this.max.max(e), this;
	}
	expandByVector(e) {
		return this.min.sub(e), this.max.add(e), this;
	}
	expandByScalar(e) {
		return this.min.addScalar(-e), this.max.addScalar(e), this;
	}
	expandByObject(e, t = !1) {
		e.updateWorldMatrix(!1, !1);
		let n = e.geometry;
		if (n !== void 0) {
			let r = n.getAttribute("position");
			if (t === !0 && r !== void 0 && e.isInstancedMesh !== !0) for (let t = 0, n = r.count; t < n; t++) e.isMesh === !0 ? e.getVertexPosition(t, gi) : gi.fromBufferAttribute(r, t), gi.applyMatrix4(e.matrixWorld), this.expandByPoint(gi);
			else e.boundingBox === void 0 ? (n.boundingBox === null && n.computeBoundingBox(), _i.copy(n.boundingBox)) : (e.boundingBox === null && e.computeBoundingBox(), _i.copy(e.boundingBox)), _i.applyMatrix4(e.matrixWorld), this.union(_i);
		}
		let r = e.children;
		for (let e = 0, n = r.length; e < n; e++) this.expandByObject(r[e], t);
		return this;
	}
	containsPoint(e) {
		return e.x >= this.min.x && e.x <= this.max.x && e.y >= this.min.y && e.y <= this.max.y && e.z >= this.min.z && e.z <= this.max.z;
	}
	containsBox(e) {
		return this.min.x <= e.min.x && e.max.x <= this.max.x && this.min.y <= e.min.y && e.max.y <= this.max.y && this.min.z <= e.min.z && e.max.z <= this.max.z;
	}
	getParameter(e, t) {
		return t.set((e.x - this.min.x) / (this.max.x - this.min.x), (e.y - this.min.y) / (this.max.y - this.min.y), (e.z - this.min.z) / (this.max.z - this.min.z));
	}
	intersectsBox(e) {
		return e.max.x >= this.min.x && e.min.x <= this.max.x && e.max.y >= this.min.y && e.min.y <= this.max.y && e.max.z >= this.min.z && e.min.z <= this.max.z;
	}
	intersectsSphere(e) {
		return this.clampPoint(e.center, gi), gi.distanceToSquared(e.center) <= e.radius * e.radius;
	}
	intersectsPlane(e) {
		let t, n;
		return e.normal.x > 0 ? (t = e.normal.x * this.min.x, n = e.normal.x * this.max.x) : (t = e.normal.x * this.max.x, n = e.normal.x * this.min.x), e.normal.y > 0 ? (t += e.normal.y * this.min.y, n += e.normal.y * this.max.y) : (t += e.normal.y * this.max.y, n += e.normal.y * this.min.y), e.normal.z > 0 ? (t += e.normal.z * this.min.z, n += e.normal.z * this.max.z) : (t += e.normal.z * this.max.z, n += e.normal.z * this.min.z), t <= -e.constant && n >= -e.constant;
	}
	intersectsTriangle(e) {
		if (this.isEmpty()) return !1;
		this.getCenter(wi), Ti.subVectors(this.max, wi), vi.subVectors(e.a, wi), yi.subVectors(e.b, wi), bi.subVectors(e.c, wi), xi.subVectors(yi, vi), Si.subVectors(bi, yi), Ci.subVectors(vi, bi);
		let t = [
			0,
			-xi.z,
			xi.y,
			0,
			-Si.z,
			Si.y,
			0,
			-Ci.z,
			Ci.y,
			xi.z,
			0,
			-xi.x,
			Si.z,
			0,
			-Si.x,
			Ci.z,
			0,
			-Ci.x,
			-xi.y,
			xi.x,
			0,
			-Si.y,
			Si.x,
			0,
			-Ci.y,
			Ci.x,
			0
		];
		return !Oi(t, vi, yi, bi, Ti) || (t = [
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		], !Oi(t, vi, yi, bi, Ti)) ? !1 : (Ei.crossVectors(xi, Si), t = [
			Ei.x,
			Ei.y,
			Ei.z
		], Oi(t, vi, yi, bi, Ti));
	}
	clampPoint(e, t) {
		return t.copy(e).clamp(this.min, this.max);
	}
	distanceToPoint(e) {
		return this.clampPoint(e, gi).distanceTo(e);
	}
	getBoundingSphere(e) {
		return this.isEmpty() ? e.makeEmpty() : (this.getCenter(e.center), e.radius = this.getSize(gi).length() * .5), e;
	}
	intersect(e) {
		return this.min.max(e.min), this.max.min(e.max), this.isEmpty() && this.makeEmpty(), this;
	}
	union(e) {
		return this.min.min(e.min), this.max.max(e.max), this;
	}
	applyMatrix4(e) {
		return this.isEmpty() ? this : (hi[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(e), hi[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(e), hi[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(e), hi[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(e), hi[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(e), hi[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(e), hi[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(e), hi[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(e), this.setFromPoints(hi), this);
	}
	translate(e) {
		return this.min.add(e), this.max.add(e), this;
	}
	equals(e) {
		return e.min.equals(this.min) && e.max.equals(this.max);
	}
	toJSON() {
		return {
			min: this.min.toArray(),
			max: this.max.toArray()
		};
	}
	fromJSON(e) {
		return this.min.fromArray(e.min), this.max.fromArray(e.max), this;
	}
}, hi = [
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W(),
	/*@__PURE__*/ new W()
], gi = /*@__PURE__*/ new W(), _i = /*@__PURE__*/ new mi(), vi = /*@__PURE__*/ new W(), yi = /*@__PURE__*/ new W(), bi = /*@__PURE__*/ new W(), xi = /*@__PURE__*/ new W(), Si = /*@__PURE__*/ new W(), Ci = /*@__PURE__*/ new W(), wi = /*@__PURE__*/ new W(), Ti = /*@__PURE__*/ new W(), Ei = /*@__PURE__*/ new W(), Di = /*@__PURE__*/ new W();
function Oi(e, t, n, r, i) {
	for (let a = 0, o = e.length - 3; a <= o; a += 3) {
		Di.fromArray(e, a);
		let o = i.x * Math.abs(Di.x) + i.y * Math.abs(Di.y) + i.z * Math.abs(Di.z), s = t.dot(Di), c = n.dot(Di), l = r.dot(Di);
		if (Math.max(-Math.max(s, c, l), Math.min(s, c, l)) > o) return !1;
	}
	return !0;
}
var ki = /*@__PURE__*/ new W(), Ai = /*@__PURE__*/ new U(), ji = 0, Mi = class extends Cn {
	constructor(e, t, n = !1) {
		if (super(), Array.isArray(e)) throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");
		this.isBufferAttribute = !0, Object.defineProperty(this, "id", { value: ji++ }), this.name = "", this.array = e, this.itemSize = t, this.count = e === void 0 ? 0 : e.length / t, this.normalized = n, this.usage = dn, this.updateRanges = [], this.gpuType = Qe, this.version = 0;
	}
	onUploadCallback() {}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	setUsage(e) {
		return this.usage = e, this;
	}
	addUpdateRange(e, t) {
		this.updateRanges.push({
			start: e,
			count: t
		});
	}
	clearUpdateRanges() {
		this.updateRanges.length = 0;
	}
	copy(e) {
		return this.name = e.name, this.array = new e.array.constructor(e.array), this.itemSize = e.itemSize, this.count = e.count, this.normalized = e.normalized, this.usage = e.usage, this.gpuType = e.gpuType, this;
	}
	copyAt(e, t, n) {
		e *= this.itemSize, n *= t.itemSize;
		for (let r = 0, i = this.itemSize; r < i; r++) this.array[e + r] = t.array[n + r];
		return this;
	}
	copyArray(e) {
		return this.array.set(e), this;
	}
	applyMatrix3(e) {
		if (this.itemSize === 2) for (let t = 0, n = this.count; t < n; t++) Ai.fromBufferAttribute(this, t), Ai.applyMatrix3(e), this.setXY(t, Ai.x, Ai.y);
		else if (this.itemSize === 3) for (let t = 0, n = this.count; t < n; t++) ki.fromBufferAttribute(this, t), ki.applyMatrix3(e), this.setXYZ(t, ki.x, ki.y, ki.z);
		return this;
	}
	applyMatrix4(e) {
		for (let t = 0, n = this.count; t < n; t++) ki.fromBufferAttribute(this, t), ki.applyMatrix4(e), this.setXYZ(t, ki.x, ki.y, ki.z);
		return this;
	}
	applyNormalMatrix(e) {
		for (let t = 0, n = this.count; t < n; t++) ki.fromBufferAttribute(this, t), ki.applyNormalMatrix(e), this.setXYZ(t, ki.x, ki.y, ki.z);
		return this;
	}
	transformDirection(e) {
		for (let t = 0, n = this.count; t < n; t++) ki.fromBufferAttribute(this, t), ki.transformDirection(e), this.setXYZ(t, ki.x, ki.y, ki.z);
		return this;
	}
	set(e, t = 0) {
		return this.array.set(e, t), this;
	}
	getComponent(e, t) {
		let n = this.array[e * this.itemSize + t];
		return this.normalized && (n = qn(n, this.array)), n;
	}
	setComponent(e, t, n) {
		return this.normalized && (n = Jn(n, this.array)), this.array[e * this.itemSize + t] = n, this;
	}
	getX(e) {
		let t = this.array[e * this.itemSize];
		return this.normalized && (t = qn(t, this.array)), t;
	}
	setX(e, t) {
		return this.normalized && (t = Jn(t, this.array)), this.array[e * this.itemSize] = t, this;
	}
	getY(e) {
		let t = this.array[e * this.itemSize + 1];
		return this.normalized && (t = qn(t, this.array)), t;
	}
	setY(e, t) {
		return this.normalized && (t = Jn(t, this.array)), this.array[e * this.itemSize + 1] = t, this;
	}
	getZ(e) {
		let t = this.array[e * this.itemSize + 2];
		return this.normalized && (t = qn(t, this.array)), t;
	}
	setZ(e, t) {
		return this.normalized && (t = Jn(t, this.array)), this.array[e * this.itemSize + 2] = t, this;
	}
	getW(e) {
		let t = this.array[e * this.itemSize + 3];
		return this.normalized && (t = qn(t, this.array)), t;
	}
	setW(e, t) {
		return this.normalized && (t = Jn(t, this.array)), this.array[e * this.itemSize + 3] = t, this;
	}
	setXY(e, t, n) {
		return e *= this.itemSize, this.normalized && (t = Jn(t, this.array), n = Jn(n, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this;
	}
	setXYZ(e, t, n, r) {
		return e *= this.itemSize, this.normalized && (t = Jn(t, this.array), n = Jn(n, this.array), r = Jn(r, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this.array[e + 2] = r, this;
	}
	setXYZW(e, t, n, r, i) {
		return e *= this.itemSize, this.normalized && (t = Jn(t, this.array), n = Jn(n, this.array), r = Jn(r, this.array), i = Jn(i, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this.array[e + 2] = r, this.array[e + 3] = i, this;
	}
	onUpload(e) {
		return this.onUploadCallback = e, this;
	}
	clone() {
		return new this.constructor(this.array, this.itemSize).copy(this);
	}
	toJSON() {
		let e = {
			itemSize: this.itemSize,
			type: this.array.constructor.name,
			array: Array.from(this.array),
			normalized: this.normalized
		};
		return this.name !== "" && (e.name = this.name), this.usage !== 35044 && (e.usage = this.usage), e;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, Ni = class extends Mi {
	constructor(e, t, n) {
		super(new Uint16Array(e), t, n);
	}
}, Pi = class extends Mi {
	constructor(e, t, n) {
		super(new Uint32Array(e), t, n);
	}
}, Y = class extends Mi {
	constructor(e, t, n) {
		super(new Float32Array(e), t, n);
	}
}, Fi = /*@__PURE__*/ new mi(), Ii = /*@__PURE__*/ new W(), Li = /*@__PURE__*/ new W(), Ri = class {
	constructor(e = new W(), t = -1) {
		this.isSphere = !0, this.center = e, this.radius = t;
	}
	set(e, t) {
		return this.center.copy(e), this.radius = t, this;
	}
	setFromPoints(e, t) {
		let n = this.center;
		t === void 0 ? Fi.setFromPoints(e).getCenter(n) : n.copy(t);
		let r = 0;
		for (let t = 0, i = e.length; t < i; t++) r = Math.max(r, n.distanceToSquared(e[t]));
		return this.radius = Math.sqrt(r), this;
	}
	copy(e) {
		return this.center.copy(e.center), this.radius = e.radius, this;
	}
	isEmpty() {
		return this.radius < 0;
	}
	makeEmpty() {
		return this.center.set(0, 0, 0), this.radius = -1, this;
	}
	containsPoint(e) {
		return e.distanceToSquared(this.center) <= this.radius * this.radius;
	}
	distanceToPoint(e) {
		return e.distanceTo(this.center) - this.radius;
	}
	intersectsSphere(e) {
		let t = this.radius + e.radius;
		return e.center.distanceToSquared(this.center) <= t * t;
	}
	intersectsBox(e) {
		return e.intersectsSphere(this);
	}
	intersectsPlane(e) {
		return Math.abs(e.distanceToPoint(this.center)) <= this.radius;
	}
	clampPoint(e, t) {
		let n = this.center.distanceToSquared(e);
		return t.copy(e), n > this.radius * this.radius && (t.sub(this.center).normalize(), t.multiplyScalar(this.radius).add(this.center)), t;
	}
	getBoundingBox(e) {
		return this.isEmpty() ? (e.makeEmpty(), e) : (e.set(this.center, this.center), e.expandByScalar(this.radius), e);
	}
	applyMatrix4(e) {
		return this.center.applyMatrix4(e), this.radius *= e.getMaxScaleOnAxis(), this;
	}
	translate(e) {
		return this.center.add(e), this;
	}
	expandByPoint(e) {
		if (this.isEmpty()) return this.center.copy(e), this.radius = 0, this;
		Ii.subVectors(e, this.center);
		let t = Ii.lengthSq();
		if (t > this.radius * this.radius) {
			let e = Math.sqrt(t), n = (e - this.radius) * .5;
			this.center.addScaledVector(Ii, n / e), this.radius += n;
		}
		return this;
	}
	union(e) {
		return e.isEmpty() ? this : this.isEmpty() ? (this.copy(e), this) : (this.center.equals(e.center) === !0 ? this.radius = Math.max(this.radius, e.radius) : (Li.subVectors(e.center, this.center).setLength(e.radius), this.expandByPoint(Ii.copy(e.center).add(Li)), this.expandByPoint(Ii.copy(e.center).sub(Li))), this);
	}
	equals(e) {
		return e.center.equals(this.center) && e.radius === this.radius;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	toJSON() {
		return {
			radius: this.radius,
			center: this.center.toArray()
		};
	}
	fromJSON(e) {
		return this.radius = e.radius, this.center.fromArray(e.center), this;
	}
}, zi = 0, Bi = /*@__PURE__*/ new q(), Vi = /*@__PURE__*/ new Wr(), Hi = /*@__PURE__*/ new W(), Ui = /*@__PURE__*/ new mi(), Wi = /*@__PURE__*/ new mi(), Gi = /*@__PURE__*/ new W(), Ki = class e extends Cn {
	constructor() {
		super(), this.isBufferGeometry = !0, Object.defineProperty(this, "id", { value: zi++ }), this.uuid = On(), this.name = "", this.type = "BufferGeometry", this.index = null, this.indirect = null, this.indirectOffset = 0, this.attributes = {}, this.morphAttributes = {}, this.morphTargetsRelative = !1, this.groups = [], this.boundingBox = null, this.boundingSphere = null, this.drawRange = {
			start: 0,
			count: Infinity
		}, this.userData = {}, this._transformed = !1;
	}
	getIndex() {
		return this.index;
	}
	setIndex(e) {
		return Array.isArray(e) ? this.index = new (pn(e) ? Pi : Ni)(e, 1) : this.index = e, this;
	}
	setIndirect(e, t = 0) {
		return this.indirect = e, this.indirectOffset = t, this;
	}
	getIndirect() {
		return this.indirect;
	}
	getAttribute(e) {
		return this.attributes[e];
	}
	setAttribute(e, t) {
		return this.attributes[e] = t, this;
	}
	deleteAttribute(e) {
		return delete this.attributes[e], this;
	}
	hasAttribute(e) {
		return this.attributes[e] !== void 0;
	}
	addGroup(e, t, n = 0) {
		this.groups.push({
			start: e,
			count: t,
			materialIndex: n
		});
	}
	clearGroups() {
		this.groups = [];
	}
	setDrawRange(e, t) {
		this.drawRange.start = e, this.drawRange.count = t;
	}
	applyMatrix4(e) {
		let t = this.attributes.position;
		t !== void 0 && (t.applyMatrix4(e), t.needsUpdate = !0);
		let n = this.attributes.normal;
		if (n !== void 0) {
			let t = new G().getNormalMatrix(e);
			n.applyNormalMatrix(t), n.needsUpdate = !0;
		}
		let r = this.attributes.tangent;
		return r !== void 0 && (r.transformDirection(e), r.needsUpdate = !0), this.boundingBox !== null && this.computeBoundingBox(), this.boundingSphere !== null && this.computeBoundingSphere(), this._transformed = !0, this;
	}
	applyQuaternion(e) {
		return Bi.makeRotationFromQuaternion(e), this.applyMatrix4(Bi), this;
	}
	rotateX(e) {
		return Bi.makeRotationX(e), this.applyMatrix4(Bi), this;
	}
	rotateY(e) {
		return Bi.makeRotationY(e), this.applyMatrix4(Bi), this;
	}
	rotateZ(e) {
		return Bi.makeRotationZ(e), this.applyMatrix4(Bi), this;
	}
	translate(e, t, n) {
		return Bi.makeTranslation(e, t, n), this.applyMatrix4(Bi), this;
	}
	scale(e, t, n) {
		return Bi.makeScale(e, t, n), this.applyMatrix4(Bi), this;
	}
	lookAt(e) {
		return Vi.lookAt(e), Vi.updateMatrix(), this.applyMatrix4(Vi.matrix), this;
	}
	center() {
		return this.computeBoundingBox(), this.boundingBox.getCenter(Hi).negate(), this.translate(Hi.x, Hi.y, Hi.z), this;
	}
	setFromPoints(e) {
		let t = this.getAttribute("position");
		if (t === void 0) {
			let t = [];
			for (let n = 0, r = e.length; n < r; n++) {
				let r = e[n];
				t.push(r.x, r.y, r.z || 0);
			}
			this.setAttribute("position", new Y(t, 3));
		} else {
			let n = Math.min(e.length, t.count);
			for (let r = 0; r < n; r++) {
				let n = e[r];
				t.setXYZ(r, n.x, n.y, n.z || 0);
			}
			e.length > t.count && B("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."), t.needsUpdate = !0;
		}
		return this;
	}
	computeBoundingBox() {
		this.boundingBox === null && (this.boundingBox = new mi());
		let e = this.attributes.position, t = this.morphAttributes.position;
		if (e && e.isGLBufferAttribute) {
			V("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this), this.boundingBox.set(new W(-Infinity, -Infinity, -Infinity), new W(Infinity, Infinity, Infinity));
			return;
		}
		if (e !== void 0) {
			if (this.boundingBox.setFromBufferAttribute(e), t) for (let e = 0, n = t.length; e < n; e++) {
				let n = t[e];
				Ui.setFromBufferAttribute(n), this.morphTargetsRelative ? (Gi.addVectors(this.boundingBox.min, Ui.min), this.boundingBox.expandByPoint(Gi), Gi.addVectors(this.boundingBox.max, Ui.max), this.boundingBox.expandByPoint(Gi)) : (this.boundingBox.expandByPoint(Ui.min), this.boundingBox.expandByPoint(Ui.max));
			}
		} else this.boundingBox.makeEmpty();
		(isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) && V("BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The \"position\" attribute is likely to have NaN values.", this);
	}
	computeBoundingSphere() {
		this.boundingSphere === null && (this.boundingSphere = new Ri());
		let e = this.attributes.position, t = this.morphAttributes.position;
		if (e && e.isGLBufferAttribute) {
			V("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this), this.boundingSphere.set(new W(), Infinity);
			return;
		}
		if (e) {
			let n = this.boundingSphere.center;
			if (Ui.setFromBufferAttribute(e), t) for (let e = 0, n = t.length; e < n; e++) {
				let n = t[e];
				Wi.setFromBufferAttribute(n), this.morphTargetsRelative ? (Gi.addVectors(Ui.min, Wi.min), Ui.expandByPoint(Gi), Gi.addVectors(Ui.max, Wi.max), Ui.expandByPoint(Gi)) : (Ui.expandByPoint(Wi.min), Ui.expandByPoint(Wi.max));
			}
			Ui.getCenter(n);
			let r = 0;
			for (let t = 0, i = e.count; t < i; t++) Gi.fromBufferAttribute(e, t), r = Math.max(r, n.distanceToSquared(Gi));
			if (t) for (let i = 0, a = t.length; i < a; i++) {
				let a = t[i], o = this.morphTargetsRelative;
				for (let t = 0, i = a.count; t < i; t++) Gi.fromBufferAttribute(a, t), o && (Hi.fromBufferAttribute(e, t), Gi.add(Hi)), r = Math.max(r, n.distanceToSquared(Gi));
			}
			this.boundingSphere.radius = Math.sqrt(r), isNaN(this.boundingSphere.radius) && V("BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The \"position\" attribute is likely to have NaN values.", this);
		}
	}
	computeTangents() {
		let e = this.index, t = this.attributes;
		if (e === null || t.position === void 0 || t.normal === void 0 || t.uv === void 0) {
			V("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
			return;
		}
		let n = t.position, r = t.normal, i = t.uv, a = this.getAttribute("tangent");
		(a === void 0 || a.count !== n.count) && (a = new Mi(new Float32Array(4 * n.count), 4), this.setAttribute("tangent", a));
		let o = [], s = [];
		for (let e = 0; e < n.count; e++) o[e] = new W(), s[e] = new W();
		let c = new W(), l = new W(), u = new W(), d = new U(), f = new U(), p = new U(), m = new W(), h = new W();
		function g(e, t, r) {
			c.fromBufferAttribute(n, e), l.fromBufferAttribute(n, t), u.fromBufferAttribute(n, r), d.fromBufferAttribute(i, e), f.fromBufferAttribute(i, t), p.fromBufferAttribute(i, r), l.sub(c), u.sub(c), f.sub(d), p.sub(d);
			let a = 1 / (f.x * p.y - p.x * f.y);
			isFinite(a) && (m.copy(l).multiplyScalar(p.y).addScaledVector(u, -f.y).multiplyScalar(a), h.copy(u).multiplyScalar(f.x).addScaledVector(l, -p.x).multiplyScalar(a), o[e].add(m), o[t].add(m), o[r].add(m), s[e].add(h), s[t].add(h), s[r].add(h));
		}
		let _ = this.groups;
		_.length === 0 && (_ = [{
			start: 0,
			count: e.count
		}]);
		for (let t = 0, n = _.length; t < n; ++t) {
			let n = _[t], r = n.start, i = n.count;
			for (let t = r, n = r + i; t < n; t += 3) g(e.getX(t + 0), e.getX(t + 1), e.getX(t + 2));
		}
		let v = new W(), y = new W(), b = new W(), x = new W();
		function S(e) {
			b.fromBufferAttribute(r, e), x.copy(b);
			let t = o[e];
			v.copy(t), v.sub(b.multiplyScalar(b.dot(t))).normalize(), y.crossVectors(x, t);
			let n = y.dot(s[e]) < 0 ? -1 : 1;
			a.setXYZW(e, v.x, v.y, v.z, n);
		}
		for (let t = 0, n = _.length; t < n; ++t) {
			let n = _[t], r = n.start, i = n.count;
			for (let t = r, n = r + i; t < n; t += 3) S(e.getX(t + 0)), S(e.getX(t + 1)), S(e.getX(t + 2));
		}
		this._transformed = !0;
	}
	computeVertexNormals() {
		let e = this.index, t = this.getAttribute("position");
		if (t !== void 0) {
			let n = this.getAttribute("normal");
			if (n === void 0 || n.count !== t.count) n = new Mi(new Float32Array(t.count * 3), 3), this.setAttribute("normal", n);
			else for (let e = 0, t = n.count; e < t; e++) n.setXYZ(e, 0, 0, 0);
			let r = new W(), i = new W(), a = new W(), o = new W(), s = new W(), c = new W(), l = new W(), u = new W();
			if (e) for (let d = 0, f = e.count; d < f; d += 3) {
				let f = e.getX(d + 0), p = e.getX(d + 1), m = e.getX(d + 2);
				r.fromBufferAttribute(t, f), i.fromBufferAttribute(t, p), a.fromBufferAttribute(t, m), l.subVectors(a, i), u.subVectors(r, i), l.cross(u), o.fromBufferAttribute(n, f), s.fromBufferAttribute(n, p), c.fromBufferAttribute(n, m), o.add(l), s.add(l), c.add(l), n.setXYZ(f, o.x, o.y, o.z), n.setXYZ(p, s.x, s.y, s.z), n.setXYZ(m, c.x, c.y, c.z);
			}
			else for (let e = 0, o = t.count; e < o; e += 3) r.fromBufferAttribute(t, e + 0), i.fromBufferAttribute(t, e + 1), a.fromBufferAttribute(t, e + 2), l.subVectors(a, i), u.subVectors(r, i), l.cross(u), n.setXYZ(e + 0, l.x, l.y, l.z), n.setXYZ(e + 1, l.x, l.y, l.z), n.setXYZ(e + 2, l.x, l.y, l.z);
			this.normalizeNormals(), n.needsUpdate = !0;
		}
	}
	normalizeNormals() {
		let e = this.attributes.normal;
		for (let t = 0, n = e.count; t < n; t++) Gi.fromBufferAttribute(e, t), Gi.normalize(), e.setXYZ(t, Gi.x, Gi.y, Gi.z);
	}
	toNonIndexed() {
		function t(e, t) {
			let n = e.array, r = e.itemSize, i = e.normalized, a = new n.constructor(t.length * r), o = 0, s = 0;
			for (let i = 0, c = t.length; i < c; i++) {
				o = e.isInterleavedBufferAttribute ? t[i] * e.data.stride + e.offset : t[i] * r;
				for (let e = 0; e < r; e++) a[s++] = n[o++];
			}
			return new Mi(a, r, i);
		}
		if (this.index === null) return B("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."), this;
		let n = new e(), r = this.index.array, i = this.attributes;
		for (let e in i) {
			let a = i[e], o = t(a, r);
			n.setAttribute(e, o);
		}
		let a = this.morphAttributes;
		for (let e in a) {
			let i = [], o = a[e];
			for (let e = 0, n = o.length; e < n; e++) {
				let n = o[e], a = t(n, r);
				i.push(a);
			}
			n.morphAttributes[e] = i;
		}
		n.morphTargetsRelative = this.morphTargetsRelative;
		let o = this.groups;
		for (let e = 0, t = o.length; e < t; e++) {
			let t = o[e];
			n.addGroup(t.start, t.count, t.materialIndex);
		}
		return n;
	}
	toJSON() {
		let e = { metadata: {
			version: 4.7,
			type: "BufferGeometry",
			generator: "BufferGeometry.toJSON"
		} };
		if (e.uuid = this.uuid, e.type = this.parameters !== void 0 && this._transformed === !0 ? "BufferGeometry" : this.type, this.name !== "" && (e.name = this.name), Object.keys(this.userData).length > 0 && (e.userData = this.userData), this.parameters !== void 0 && this._transformed !== !0) {
			let t = this.parameters;
			for (let n in t) t[n] !== void 0 && (e[n] = t[n]);
			return e;
		}
		e.data = { attributes: {} };
		let t = this.index;
		t !== null && (e.data.index = {
			type: t.array.constructor.name,
			array: Array.prototype.slice.call(t.array)
		});
		let n = this.attributes;
		for (let t in n) {
			let r = n[t];
			e.data.attributes[t] = r.toJSON(e.data);
		}
		let r = {}, i = !1;
		for (let t in this.morphAttributes) {
			let n = this.morphAttributes[t], a = [];
			for (let t = 0, r = n.length; t < r; t++) {
				let r = n[t];
				a.push(r.toJSON(e.data));
			}
			a.length > 0 && (r[t] = a, i = !0);
		}
		i && (e.data.morphAttributes = r, e.data.morphTargetsRelative = this.morphTargetsRelative);
		let a = this.groups;
		a.length > 0 && (e.data.groups = JSON.parse(JSON.stringify(a)));
		let o = this.boundingSphere;
		return o !== null && (e.data.boundingSphere = o.toJSON()), e;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.index = null, this.attributes = {}, this.morphAttributes = {}, this.groups = [], this.boundingBox = null, this.boundingSphere = null;
		let t = {};
		this.name = e.name;
		let n = e.index;
		n !== null && this.setIndex(n.clone());
		let r = e.attributes;
		for (let e in r) {
			let n = r[e];
			this.setAttribute(e, n.clone(t));
		}
		let i = e.morphAttributes;
		for (let e in i) {
			let n = [], r = i[e];
			for (let e = 0, i = r.length; e < i; e++) n.push(r[e].clone(t));
			this.morphAttributes[e] = n;
		}
		this.morphTargetsRelative = e.morphTargetsRelative;
		let a = e.groups;
		for (let e = 0, t = a.length; e < t; e++) {
			let t = a[e];
			this.addGroup(t.start, t.count, t.materialIndex);
		}
		let o = e.boundingBox;
		o !== null && (this.boundingBox = o.clone());
		let s = e.boundingSphere;
		return s !== null && (this.boundingSphere = s.clone()), this.drawRange.start = e.drawRange.start, this.drawRange.count = e.drawRange.count, this.userData = e.userData, this._transformed = e._transformed, this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, qi = 0, Ji = class extends Cn {
	constructor() {
		super(), this.isMaterial = !0, Object.defineProperty(this, "id", { value: qi++ }), this.uuid = On(), this.name = "", this.type = "Material", this.blending = 1, this.side = 0, this.vertexColors = !1, this.opacity = 1, this.transparent = !1, this.alphaHash = !1, this.blendSrc = 204, this.blendDst = 205, this.blendEquation = 100, this.blendSrcAlpha = null, this.blendDstAlpha = null, this.blendEquationAlpha = null, this.blendColor = new J(0, 0, 0), this.blendAlpha = 0, this.depthFunc = 3, this.depthTest = !0, this.depthWrite = !0, this.stencilWriteMask = 255, this.stencilFunc = 519, this.stencilRef = 0, this.stencilFuncMask = 255, this.stencilFail = un, this.stencilZFail = un, this.stencilZPass = un, this.stencilWrite = !1, this.clippingPlanes = null, this.clipIntersection = !1, this.clipShadows = !1, this.shadowSide = null, this.colorWrite = !0, this.precision = null, this.polygonOffset = !1, this.polygonOffsetFactor = 0, this.polygonOffsetUnits = 0, this.dithering = !1, this.alphaToCoverage = !1, this.premultipliedAlpha = !1, this.forceSinglePass = !1, this.allowOverride = !0, this.visible = !0, this.toneMapped = !0, this.userData = {}, this.version = 0, this._alphaTest = 0;
	}
	get alphaTest() {
		return this._alphaTest;
	}
	set alphaTest(e) {
		this._alphaTest > 0 != e > 0 && this.version++, this._alphaTest = e;
	}
	onBeforeRender() {}
	onBeforeCompile() {}
	customProgramCacheKey() {
		return this.onBeforeCompile.toString();
	}
	setValues(e) {
		if (e !== void 0) for (let t in e) {
			let n = e[t];
			if (n === void 0) {
				B(`Material: parameter '${t}' has value of undefined.`);
				continue;
			}
			let r = this[t];
			if (r === void 0) {
				B(`Material: '${t}' is not a property of THREE.${this.type}.`);
				continue;
			}
			r && r.isColor ? r.set(n) : r && r.isVector2 && n && n.isVector2 || r && r.isEuler && n && n.isEuler || r && r.isVector3 && n && n.isVector3 ? r.copy(n) : this[t] = n;
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		t && (e = {
			textures: {},
			images: {}
		});
		let n = { metadata: {
			version: 4.7,
			type: "Material",
			generator: "Material.toJSON"
		} };
		n.uuid = this.uuid, n.type = this.type, this.name !== "" && (n.name = this.name), this.color && this.color.isColor && (n.color = this.color.getHex()), this.roughness !== void 0 && (n.roughness = this.roughness), this.metalness !== void 0 && (n.metalness = this.metalness), this.sheen !== void 0 && (n.sheen = this.sheen), this.sheenColor && this.sheenColor.isColor && (n.sheenColor = this.sheenColor.getHex()), this.sheenRoughness !== void 0 && (n.sheenRoughness = this.sheenRoughness), this.emissive && this.emissive.isColor && (n.emissive = this.emissive.getHex()), this.emissiveIntensity !== void 0 && this.emissiveIntensity !== 1 && (n.emissiveIntensity = this.emissiveIntensity), this.specular && this.specular.isColor && (n.specular = this.specular.getHex()), this.specularIntensity !== void 0 && (n.specularIntensity = this.specularIntensity), this.specularColor && this.specularColor.isColor && (n.specularColor = this.specularColor.getHex()), this.shininess !== void 0 && (n.shininess = this.shininess), this.clearcoat !== void 0 && (n.clearcoat = this.clearcoat), this.clearcoatRoughness !== void 0 && (n.clearcoatRoughness = this.clearcoatRoughness), this.clearcoatMap && this.clearcoatMap.isTexture && (n.clearcoatMap = this.clearcoatMap.toJSON(e).uuid), this.clearcoatRoughnessMap && this.clearcoatRoughnessMap.isTexture && (n.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON(e).uuid), this.clearcoatNormalMap && this.clearcoatNormalMap.isTexture && (n.clearcoatNormalMap = this.clearcoatNormalMap.toJSON(e).uuid, n.clearcoatNormalScale = this.clearcoatNormalScale.toArray()), this.sheenColorMap && this.sheenColorMap.isTexture && (n.sheenColorMap = this.sheenColorMap.toJSON(e).uuid), this.sheenRoughnessMap && this.sheenRoughnessMap.isTexture && (n.sheenRoughnessMap = this.sheenRoughnessMap.toJSON(e).uuid), this.dispersion !== void 0 && (n.dispersion = this.dispersion), this.iridescence !== void 0 && (n.iridescence = this.iridescence), this.iridescenceIOR !== void 0 && (n.iridescenceIOR = this.iridescenceIOR), this.iridescenceThicknessRange !== void 0 && (n.iridescenceThicknessRange = this.iridescenceThicknessRange), this.iridescenceMap && this.iridescenceMap.isTexture && (n.iridescenceMap = this.iridescenceMap.toJSON(e).uuid), this.iridescenceThicknessMap && this.iridescenceThicknessMap.isTexture && (n.iridescenceThicknessMap = this.iridescenceThicknessMap.toJSON(e).uuid), this.anisotropy !== void 0 && (n.anisotropy = this.anisotropy), this.anisotropyRotation !== void 0 && (n.anisotropyRotation = this.anisotropyRotation), this.anisotropyMap && this.anisotropyMap.isTexture && (n.anisotropyMap = this.anisotropyMap.toJSON(e).uuid), this.map && this.map.isTexture && (n.map = this.map.toJSON(e).uuid), this.matcap && this.matcap.isTexture && (n.matcap = this.matcap.toJSON(e).uuid), this.alphaMap && this.alphaMap.isTexture && (n.alphaMap = this.alphaMap.toJSON(e).uuid), this.lightMap && this.lightMap.isTexture && (n.lightMap = this.lightMap.toJSON(e).uuid, n.lightMapIntensity = this.lightMapIntensity), this.aoMap && this.aoMap.isTexture && (n.aoMap = this.aoMap.toJSON(e).uuid, n.aoMapIntensity = this.aoMapIntensity), this.bumpMap && this.bumpMap.isTexture && (n.bumpMap = this.bumpMap.toJSON(e).uuid, n.bumpScale = this.bumpScale), this.normalMap && this.normalMap.isTexture && (n.normalMap = this.normalMap.toJSON(e).uuid, n.normalMapType = this.normalMapType, n.normalScale = this.normalScale.toArray()), this.displacementMap && this.displacementMap.isTexture && (n.displacementMap = this.displacementMap.toJSON(e).uuid, n.displacementScale = this.displacementScale, n.displacementBias = this.displacementBias), this.roughnessMap && this.roughnessMap.isTexture && (n.roughnessMap = this.roughnessMap.toJSON(e).uuid), this.metalnessMap && this.metalnessMap.isTexture && (n.metalnessMap = this.metalnessMap.toJSON(e).uuid), this.emissiveMap && this.emissiveMap.isTexture && (n.emissiveMap = this.emissiveMap.toJSON(e).uuid), this.specularMap && this.specularMap.isTexture && (n.specularMap = this.specularMap.toJSON(e).uuid), this.specularIntensityMap && this.specularIntensityMap.isTexture && (n.specularIntensityMap = this.specularIntensityMap.toJSON(e).uuid), this.specularColorMap && this.specularColorMap.isTexture && (n.specularColorMap = this.specularColorMap.toJSON(e).uuid), this.envMap && this.envMap.isTexture && (n.envMap = this.envMap.toJSON(e).uuid, this.combine !== void 0 && (n.combine = this.combine)), this.envMapRotation !== void 0 && (n.envMapRotation = this.envMapRotation.toArray()), this.envMapIntensity !== void 0 && (n.envMapIntensity = this.envMapIntensity), this.reflectivity !== void 0 && (n.reflectivity = this.reflectivity), this.refractionRatio !== void 0 && (n.refractionRatio = this.refractionRatio), this.gradientMap && this.gradientMap.isTexture && (n.gradientMap = this.gradientMap.toJSON(e).uuid), this.transmission !== void 0 && (n.transmission = this.transmission), this.transmissionMap && this.transmissionMap.isTexture && (n.transmissionMap = this.transmissionMap.toJSON(e).uuid), this.thickness !== void 0 && (n.thickness = this.thickness), this.thicknessMap && this.thicknessMap.isTexture && (n.thicknessMap = this.thicknessMap.toJSON(e).uuid), this.attenuationDistance !== void 0 && this.attenuationDistance !== Infinity && (n.attenuationDistance = this.attenuationDistance), this.attenuationColor !== void 0 && (n.attenuationColor = this.attenuationColor.getHex()), this.size !== void 0 && (n.size = this.size), this.shadowSide !== null && (n.shadowSide = this.shadowSide), this.sizeAttenuation !== void 0 && (n.sizeAttenuation = this.sizeAttenuation), this.blending !== 1 && (n.blending = this.blending), this.side !== 0 && (n.side = this.side), this.vertexColors === !0 && (n.vertexColors = !0), this.opacity < 1 && (n.opacity = this.opacity), this.transparent === !0 && (n.transparent = !0), this.blendSrc !== 204 && (n.blendSrc = this.blendSrc), this.blendDst !== 205 && (n.blendDst = this.blendDst), this.blendEquation !== 100 && (n.blendEquation = this.blendEquation), this.blendSrcAlpha !== null && (n.blendSrcAlpha = this.blendSrcAlpha), this.blendDstAlpha !== null && (n.blendDstAlpha = this.blendDstAlpha), this.blendEquationAlpha !== null && (n.blendEquationAlpha = this.blendEquationAlpha), this.blendColor && this.blendColor.isColor && (n.blendColor = this.blendColor.getHex()), this.blendAlpha !== 0 && (n.blendAlpha = this.blendAlpha), this.depthFunc !== 3 && (n.depthFunc = this.depthFunc), this.depthTest === !1 && (n.depthTest = this.depthTest), this.depthWrite === !1 && (n.depthWrite = this.depthWrite), this.colorWrite === !1 && (n.colorWrite = this.colorWrite), this.stencilWriteMask !== 255 && (n.stencilWriteMask = this.stencilWriteMask), this.stencilFunc !== 519 && (n.stencilFunc = this.stencilFunc), this.stencilRef !== 0 && (n.stencilRef = this.stencilRef), this.stencilFuncMask !== 255 && (n.stencilFuncMask = this.stencilFuncMask), this.stencilFail !== 7680 && (n.stencilFail = this.stencilFail), this.stencilZFail !== 7680 && (n.stencilZFail = this.stencilZFail), this.stencilZPass !== 7680 && (n.stencilZPass = this.stencilZPass), this.stencilWrite === !0 && (n.stencilWrite = this.stencilWrite), this.rotation !== void 0 && this.rotation !== 0 && (n.rotation = this.rotation), this.polygonOffset === !0 && (n.polygonOffset = !0), this.polygonOffsetFactor !== 0 && (n.polygonOffsetFactor = this.polygonOffsetFactor), this.polygonOffsetUnits !== 0 && (n.polygonOffsetUnits = this.polygonOffsetUnits), this.linewidth !== void 0 && this.linewidth !== 1 && (n.linewidth = this.linewidth), this.dashSize !== void 0 && (n.dashSize = this.dashSize), this.gapSize !== void 0 && (n.gapSize = this.gapSize), this.scale !== void 0 && (n.scale = this.scale), this.dithering === !0 && (n.dithering = !0), this.alphaTest > 0 && (n.alphaTest = this.alphaTest), this.alphaHash === !0 && (n.alphaHash = !0), this.alphaToCoverage === !0 && (n.alphaToCoverage = !0), this.premultipliedAlpha === !0 && (n.premultipliedAlpha = !0), this.forceSinglePass === !0 && (n.forceSinglePass = !0), this.allowOverride === !1 && (n.allowOverride = !1), this.wireframe === !0 && (n.wireframe = !0), this.wireframeLinewidth > 1 && (n.wireframeLinewidth = this.wireframeLinewidth), this.wireframeLinecap !== "round" && (n.wireframeLinecap = this.wireframeLinecap), this.wireframeLinejoin !== "round" && (n.wireframeLinejoin = this.wireframeLinejoin), this.flatShading === !0 && (n.flatShading = !0), this.visible === !1 && (n.visible = !1), this.toneMapped === !1 && (n.toneMapped = !1), this.fog === !1 && (n.fog = !1), Object.keys(this.userData).length > 0 && (n.userData = this.userData);
		function r(e) {
			let t = [];
			for (let n in e) {
				let r = e[n];
				delete r.metadata, t.push(r);
			}
			return t;
		}
		if (t) {
			let t = r(e.textures), i = r(e.images);
			t.length > 0 && (n.textures = t), i.length > 0 && (n.images = i);
		}
		return n;
	}
	fromJSON(e, t) {
		if (e.uuid !== void 0 && (this.uuid = e.uuid), e.name !== void 0 && (this.name = e.name), e.color !== void 0 && this.color !== void 0 && this.color.setHex(e.color), e.roughness !== void 0 && (this.roughness = e.roughness), e.metalness !== void 0 && (this.metalness = e.metalness), e.sheen !== void 0 && (this.sheen = e.sheen), e.sheenColor !== void 0 && (this.sheenColor = new J().setHex(e.sheenColor)), e.sheenRoughness !== void 0 && (this.sheenRoughness = e.sheenRoughness), e.emissive !== void 0 && this.emissive !== void 0 && this.emissive.setHex(e.emissive), e.specular !== void 0 && this.specular !== void 0 && this.specular.setHex(e.specular), e.specularIntensity !== void 0 && (this.specularIntensity = e.specularIntensity), e.specularColor !== void 0 && this.specularColor !== void 0 && this.specularColor.setHex(e.specularColor), e.shininess !== void 0 && (this.shininess = e.shininess), e.clearcoat !== void 0 && (this.clearcoat = e.clearcoat), e.clearcoatRoughness !== void 0 && (this.clearcoatRoughness = e.clearcoatRoughness), e.dispersion !== void 0 && (this.dispersion = e.dispersion), e.iridescence !== void 0 && (this.iridescence = e.iridescence), e.iridescenceIOR !== void 0 && (this.iridescenceIOR = e.iridescenceIOR), e.iridescenceThicknessRange !== void 0 && (this.iridescenceThicknessRange = e.iridescenceThicknessRange), e.transmission !== void 0 && (this.transmission = e.transmission), e.thickness !== void 0 && (this.thickness = e.thickness), e.attenuationDistance !== void 0 && (this.attenuationDistance = e.attenuationDistance), e.attenuationColor !== void 0 && this.attenuationColor !== void 0 && this.attenuationColor.setHex(e.attenuationColor), e.anisotropy !== void 0 && (this.anisotropy = e.anisotropy), e.anisotropyRotation !== void 0 && (this.anisotropyRotation = e.anisotropyRotation), e.fog !== void 0 && (this.fog = e.fog), e.flatShading !== void 0 && (this.flatShading = e.flatShading), e.blending !== void 0 && (this.blending = e.blending), e.combine !== void 0 && (this.combine = e.combine), e.side !== void 0 && (this.side = e.side), e.shadowSide !== void 0 && (this.shadowSide = e.shadowSide), e.opacity !== void 0 && (this.opacity = e.opacity), e.transparent !== void 0 && (this.transparent = e.transparent), e.alphaTest !== void 0 && (this.alphaTest = e.alphaTest), e.alphaHash !== void 0 && (this.alphaHash = e.alphaHash), e.depthFunc !== void 0 && (this.depthFunc = e.depthFunc), e.depthTest !== void 0 && (this.depthTest = e.depthTest), e.depthWrite !== void 0 && (this.depthWrite = e.depthWrite), e.colorWrite !== void 0 && (this.colorWrite = e.colorWrite), e.blendSrc !== void 0 && (this.blendSrc = e.blendSrc), e.blendDst !== void 0 && (this.blendDst = e.blendDst), e.blendEquation !== void 0 && (this.blendEquation = e.blendEquation), e.blendSrcAlpha !== void 0 && (this.blendSrcAlpha = e.blendSrcAlpha), e.blendDstAlpha !== void 0 && (this.blendDstAlpha = e.blendDstAlpha), e.blendEquationAlpha !== void 0 && (this.blendEquationAlpha = e.blendEquationAlpha), e.blendColor !== void 0 && this.blendColor !== void 0 && this.blendColor.setHex(e.blendColor), e.blendAlpha !== void 0 && (this.blendAlpha = e.blendAlpha), e.stencilWriteMask !== void 0 && (this.stencilWriteMask = e.stencilWriteMask), e.stencilFunc !== void 0 && (this.stencilFunc = e.stencilFunc), e.stencilRef !== void 0 && (this.stencilRef = e.stencilRef), e.stencilFuncMask !== void 0 && (this.stencilFuncMask = e.stencilFuncMask), e.stencilFail !== void 0 && (this.stencilFail = e.stencilFail), e.stencilZFail !== void 0 && (this.stencilZFail = e.stencilZFail), e.stencilZPass !== void 0 && (this.stencilZPass = e.stencilZPass), e.stencilWrite !== void 0 && (this.stencilWrite = e.stencilWrite), e.wireframe !== void 0 && (this.wireframe = e.wireframe), e.wireframeLinewidth !== void 0 && (this.wireframeLinewidth = e.wireframeLinewidth), e.wireframeLinecap !== void 0 && (this.wireframeLinecap = e.wireframeLinecap), e.wireframeLinejoin !== void 0 && (this.wireframeLinejoin = e.wireframeLinejoin), e.rotation !== void 0 && (this.rotation = e.rotation), e.linewidth !== void 0 && (this.linewidth = e.linewidth), e.dashSize !== void 0 && (this.dashSize = e.dashSize), e.gapSize !== void 0 && (this.gapSize = e.gapSize), e.scale !== void 0 && (this.scale = e.scale), e.polygonOffset !== void 0 && (this.polygonOffset = e.polygonOffset), e.polygonOffsetFactor !== void 0 && (this.polygonOffsetFactor = e.polygonOffsetFactor), e.polygonOffsetUnits !== void 0 && (this.polygonOffsetUnits = e.polygonOffsetUnits), e.dithering !== void 0 && (this.dithering = e.dithering), e.alphaToCoverage !== void 0 && (this.alphaToCoverage = e.alphaToCoverage), e.premultipliedAlpha !== void 0 && (this.premultipliedAlpha = e.premultipliedAlpha), e.forceSinglePass !== void 0 && (this.forceSinglePass = e.forceSinglePass), e.allowOverride !== void 0 && (this.allowOverride = e.allowOverride), e.visible !== void 0 && (this.visible = e.visible), e.toneMapped !== void 0 && (this.toneMapped = e.toneMapped), e.userData !== void 0 && (this.userData = e.userData), e.vertexColors !== void 0 && (typeof e.vertexColors == "number" ? this.vertexColors = e.vertexColors > 0 : this.vertexColors = e.vertexColors), e.size !== void 0 && (this.size = e.size), e.sizeAttenuation !== void 0 && (this.sizeAttenuation = e.sizeAttenuation), e.map !== void 0 && (this.map = t[e.map] || null), e.matcap !== void 0 && (this.matcap = t[e.matcap] || null), e.alphaMap !== void 0 && (this.alphaMap = t[e.alphaMap] || null), e.bumpMap !== void 0 && (this.bumpMap = t[e.bumpMap] || null), e.bumpScale !== void 0 && (this.bumpScale = e.bumpScale), e.normalMap !== void 0 && (this.normalMap = t[e.normalMap] || null), e.normalMapType !== void 0 && (this.normalMapType = e.normalMapType), e.normalScale !== void 0) {
			let t = e.normalScale;
			Array.isArray(t) === !1 && (t = [t, t]), this.normalScale = new U().fromArray(t);
		}
		return e.displacementMap !== void 0 && (this.displacementMap = t[e.displacementMap] || null), e.displacementScale !== void 0 && (this.displacementScale = e.displacementScale), e.displacementBias !== void 0 && (this.displacementBias = e.displacementBias), e.roughnessMap !== void 0 && (this.roughnessMap = t[e.roughnessMap] || null), e.metalnessMap !== void 0 && (this.metalnessMap = t[e.metalnessMap] || null), e.emissiveMap !== void 0 && (this.emissiveMap = t[e.emissiveMap] || null), e.emissiveIntensity !== void 0 && (this.emissiveIntensity = e.emissiveIntensity), e.specularMap !== void 0 && (this.specularMap = t[e.specularMap] || null), e.specularIntensityMap !== void 0 && (this.specularIntensityMap = t[e.specularIntensityMap] || null), e.specularColorMap !== void 0 && (this.specularColorMap = t[e.specularColorMap] || null), e.envMap !== void 0 && (this.envMap = t[e.envMap] || null), e.envMapRotation !== void 0 && this.envMapRotation.fromArray(e.envMapRotation), e.envMapIntensity !== void 0 && (this.envMapIntensity = e.envMapIntensity), e.reflectivity !== void 0 && (this.reflectivity = e.reflectivity), e.refractionRatio !== void 0 && (this.refractionRatio = e.refractionRatio), e.lightMap !== void 0 && (this.lightMap = t[e.lightMap] || null), e.lightMapIntensity !== void 0 && (this.lightMapIntensity = e.lightMapIntensity), e.aoMap !== void 0 && (this.aoMap = t[e.aoMap] || null), e.aoMapIntensity !== void 0 && (this.aoMapIntensity = e.aoMapIntensity), e.gradientMap !== void 0 && (this.gradientMap = t[e.gradientMap] || null), e.clearcoatMap !== void 0 && (this.clearcoatMap = t[e.clearcoatMap] || null), e.clearcoatRoughnessMap !== void 0 && (this.clearcoatRoughnessMap = t[e.clearcoatRoughnessMap] || null), e.clearcoatNormalMap !== void 0 && (this.clearcoatNormalMap = t[e.clearcoatNormalMap] || null), e.clearcoatNormalScale !== void 0 && (this.clearcoatNormalScale = new U().fromArray(e.clearcoatNormalScale)), e.iridescenceMap !== void 0 && (this.iridescenceMap = t[e.iridescenceMap] || null), e.iridescenceThicknessMap !== void 0 && (this.iridescenceThicknessMap = t[e.iridescenceThicknessMap] || null), e.transmissionMap !== void 0 && (this.transmissionMap = t[e.transmissionMap] || null), e.thicknessMap !== void 0 && (this.thicknessMap = t[e.thicknessMap] || null), e.anisotropyMap !== void 0 && (this.anisotropyMap = t[e.anisotropyMap] || null), e.sheenColorMap !== void 0 && (this.sheenColorMap = t[e.sheenColorMap] || null), e.sheenRoughnessMap !== void 0 && (this.sheenRoughnessMap = t[e.sheenRoughnessMap] || null), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.name = e.name, this.blending = e.blending, this.side = e.side, this.vertexColors = e.vertexColors, this.opacity = e.opacity, this.transparent = e.transparent, this.blendSrc = e.blendSrc, this.blendDst = e.blendDst, this.blendEquation = e.blendEquation, this.blendSrcAlpha = e.blendSrcAlpha, this.blendDstAlpha = e.blendDstAlpha, this.blendEquationAlpha = e.blendEquationAlpha, this.blendColor.copy(e.blendColor), this.blendAlpha = e.blendAlpha, this.depthFunc = e.depthFunc, this.depthTest = e.depthTest, this.depthWrite = e.depthWrite, this.stencilWriteMask = e.stencilWriteMask, this.stencilFunc = e.stencilFunc, this.stencilRef = e.stencilRef, this.stencilFuncMask = e.stencilFuncMask, this.stencilFail = e.stencilFail, this.stencilZFail = e.stencilZFail, this.stencilZPass = e.stencilZPass, this.stencilWrite = e.stencilWrite;
		let t = e.clippingPlanes, n = null;
		if (t !== null) {
			let e = t.length;
			n = Array(e);
			for (let r = 0; r !== e; ++r) n[r] = t[r].clone();
		}
		return this.clippingPlanes = n, this.clipIntersection = e.clipIntersection, this.clipShadows = e.clipShadows, this.shadowSide = e.shadowSide, this.colorWrite = e.colorWrite, this.precision = e.precision, this.polygonOffset = e.polygonOffset, this.polygonOffsetFactor = e.polygonOffsetFactor, this.polygonOffsetUnits = e.polygonOffsetUnits, this.dithering = e.dithering, this.alphaTest = e.alphaTest, this.alphaHash = e.alphaHash, this.alphaToCoverage = e.alphaToCoverage, this.premultipliedAlpha = e.premultipliedAlpha, this.forceSinglePass = e.forceSinglePass, this.allowOverride = e.allowOverride, this.visible = e.visible, this.toneMapped = e.toneMapped, this.userData = JSON.parse(JSON.stringify(e.userData)), this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
}, Yi = /*@__PURE__*/ new W(), Xi = /*@__PURE__*/ new W(), Zi = /*@__PURE__*/ new W(), Qi = /*@__PURE__*/ new W(), $i = /*@__PURE__*/ new W(), ea = /*@__PURE__*/ new W(), ta = /*@__PURE__*/ new W(), na = class {
	constructor(e = new W(), t = new W(0, 0, -1)) {
		this.origin = e, this.direction = t;
	}
	set(e, t) {
		return this.origin.copy(e), this.direction.copy(t), this;
	}
	copy(e) {
		return this.origin.copy(e.origin), this.direction.copy(e.direction), this;
	}
	at(e, t) {
		return t.copy(this.origin).addScaledVector(this.direction, e);
	}
	lookAt(e) {
		return this.direction.copy(e).sub(this.origin).normalize(), this;
	}
	recast(e) {
		return this.origin.copy(this.at(e, Yi)), this;
	}
	closestPointToPoint(e, t) {
		t.subVectors(e, this.origin);
		let n = t.dot(this.direction);
		return n < 0 ? t.copy(this.origin) : t.copy(this.origin).addScaledVector(this.direction, n);
	}
	distanceToPoint(e) {
		return Math.sqrt(this.distanceSqToPoint(e));
	}
	distanceSqToPoint(e) {
		let t = Yi.subVectors(e, this.origin).dot(this.direction);
		return t < 0 ? this.origin.distanceToSquared(e) : (Yi.copy(this.origin).addScaledVector(this.direction, t), Yi.distanceToSquared(e));
	}
	distanceSqToSegment(e, t, n, r) {
		Xi.copy(e).add(t).multiplyScalar(.5), Zi.copy(t).sub(e).normalize(), Qi.copy(this.origin).sub(Xi);
		let i = e.distanceTo(t) * .5, a = -this.direction.dot(Zi), o = Qi.dot(this.direction), s = -Qi.dot(Zi), c = Qi.lengthSq(), l = Math.abs(1 - a * a), u, d, f, p;
		if (l > 0) if (u = a * s - o, d = a * o - s, p = i * l, u >= 0) if (d >= -p) if (d <= p) {
			let e = 1 / l;
			u *= e, d *= e, f = u * (u + a * d + 2 * o) + d * (a * u + d + 2 * s) + c;
		} else d = i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		else d = -i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		else d <= -p ? (u = Math.max(0, -(-a * i + o)), d = u > 0 ? -i : Math.min(Math.max(-i, -s), i), f = -u * u + d * (d + 2 * s) + c) : d <= p ? (u = 0, d = Math.min(Math.max(-i, -s), i), f = d * (d + 2 * s) + c) : (u = Math.max(0, -(a * i + o)), d = u > 0 ? i : Math.min(Math.max(-i, -s), i), f = -u * u + d * (d + 2 * s) + c);
		else d = a > 0 ? -i : i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		return n && n.copy(this.origin).addScaledVector(this.direction, u), r && r.copy(Xi).addScaledVector(Zi, d), f;
	}
	intersectSphere(e, t) {
		Yi.subVectors(e.center, this.origin);
		let n = Yi.dot(this.direction), r = Yi.dot(Yi) - n * n, i = e.radius * e.radius;
		if (r > i) return null;
		let a = Math.sqrt(i - r), o = n - a, s = n + a;
		return s < 0 ? null : o < 0 ? this.at(s, t) : this.at(o, t);
	}
	intersectsSphere(e) {
		return e.radius < 0 ? !1 : this.distanceSqToPoint(e.center) <= e.radius * e.radius;
	}
	distanceToPlane(e) {
		let t = e.normal.dot(this.direction);
		if (t === 0) return e.distanceToPoint(this.origin) === 0 ? 0 : null;
		let n = -(this.origin.dot(e.normal) + e.constant) / t;
		return n >= 0 ? n : null;
	}
	intersectPlane(e, t) {
		let n = this.distanceToPlane(e);
		return n === null ? null : this.at(n, t);
	}
	intersectsPlane(e) {
		let t = e.distanceToPoint(this.origin);
		return t === 0 || e.normal.dot(this.direction) * t < 0;
	}
	intersectBox(e, t) {
		let n, r, i, a, o, s, c = 1 / this.direction.x, l = 1 / this.direction.y, u = 1 / this.direction.z, d = this.origin;
		return c >= 0 ? (n = (e.min.x - d.x) * c, r = (e.max.x - d.x) * c) : (n = (e.max.x - d.x) * c, r = (e.min.x - d.x) * c), l >= 0 ? (i = (e.min.y - d.y) * l, a = (e.max.y - d.y) * l) : (i = (e.max.y - d.y) * l, a = (e.min.y - d.y) * l), n > a || i > r || ((i > n || isNaN(n)) && (n = i), (a < r || isNaN(r)) && (r = a), u >= 0 ? (o = (e.min.z - d.z) * u, s = (e.max.z - d.z) * u) : (o = (e.max.z - d.z) * u, s = (e.min.z - d.z) * u), n > s || o > r) || ((o > n || n !== n) && (n = o), (s < r || r !== r) && (r = s), r < 0) ? null : this.at(n >= 0 ? n : r, t);
	}
	intersectsBox(e) {
		return this.intersectBox(e, Yi) !== null;
	}
	intersectTriangle(e, t, n, r, i) {
		$i.subVectors(t, e), ea.subVectors(n, e), ta.crossVectors($i, ea);
		let a = this.direction.dot(ta), o;
		if (a > 0) {
			if (r) return null;
			o = 1;
		} else if (a < 0) o = -1, a = -a;
		else return null;
		Qi.subVectors(this.origin, e);
		let s = o * this.direction.dot(ea.crossVectors(Qi, ea));
		if (s < 0) return null;
		let c = o * this.direction.dot($i.cross(Qi));
		if (c < 0 || s + c > a) return null;
		let l = -o * Qi.dot(ta);
		return l < 0 ? null : this.at(l / a, i);
	}
	applyMatrix4(e) {
		return this.origin.applyMatrix4(e), this.direction.transformDirection(e), this;
	}
	equals(e) {
		return e.origin.equals(this.origin) && e.direction.equals(this.direction);
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, ra = class extends Ji {
	constructor(e) {
		super(), this.isMeshBasicMaterial = !0, this.type = "MeshBasicMaterial", this.color = new J(16777215), this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.specularMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new Dr(), this.combine = 0, this.reflectivity = 1, this.refractionRatio = .98, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.specularMap = e.specularMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.combine = e.combine, this.reflectivity = e.reflectivity, this.refractionRatio = e.refractionRatio, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.fog = e.fog, this;
	}
}, ia = /*@__PURE__*/ new q(), aa = /*@__PURE__*/ new na(), oa = /*@__PURE__*/ new Ri(), sa = /*@__PURE__*/ new W(), ca = /*@__PURE__*/ new W(), la = /*@__PURE__*/ new W(), ua = /*@__PURE__*/ new W(), da = /*@__PURE__*/ new W(), fa = /*@__PURE__*/ new W(), pa = /*@__PURE__*/ new W(), ma = /*@__PURE__*/ new W(), X = class extends Wr {
	constructor(e = new Ki(), t = new ra()) {
		super(), this.isMesh = !0, this.type = "Mesh", this.geometry = e, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.count = 1, this.updateMorphTargets();
	}
	copy(e, t) {
		return super.copy(e, t), e.morphTargetInfluences !== void 0 && (this.morphTargetInfluences = e.morphTargetInfluences.slice()), e.morphTargetDictionary !== void 0 && (this.morphTargetDictionary = Object.assign({}, e.morphTargetDictionary)), this.material = Array.isArray(e.material) ? e.material.slice() : e.material, this.geometry = e.geometry, this;
	}
	updateMorphTargets() {
		let e = this.geometry.morphAttributes, t = Object.keys(e);
		if (t.length > 0) {
			let n = e[t[0]];
			if (n !== void 0) {
				this.morphTargetInfluences = [], this.morphTargetDictionary = {};
				for (let e = 0, t = n.length; e < t; e++) {
					let t = n[e].name || String(e);
					this.morphTargetInfluences.push(0), this.morphTargetDictionary[t] = e;
				}
			}
		}
	}
	getVertexPosition(e, t) {
		let n = this.geometry, r = n.attributes.position, i = n.morphAttributes.position, a = n.morphTargetsRelative;
		t.fromBufferAttribute(r, e);
		let o = this.morphTargetInfluences;
		if (i && o) {
			fa.set(0, 0, 0);
			for (let n = 0, r = i.length; n < r; n++) {
				let r = o[n], s = i[n];
				r !== 0 && (da.fromBufferAttribute(s, e), a ? fa.addScaledVector(da, r) : fa.addScaledVector(da.sub(t), r));
			}
			t.add(fa);
		}
		return t;
	}
	raycast(e, t) {
		let n = this.geometry, r = this.material, i = this.matrixWorld;
		r !== void 0 && (n.boundingSphere === null && n.computeBoundingSphere(), oa.copy(n.boundingSphere), oa.applyMatrix4(i), aa.copy(e.ray).recast(e.near), !(oa.containsPoint(aa.origin) === !1 && (aa.intersectSphere(oa, sa) === null || aa.origin.distanceToSquared(sa) > (e.far - e.near) ** 2)) && (ia.copy(i).invert(), aa.copy(e.ray).applyMatrix4(ia), !(n.boundingBox !== null && aa.intersectsBox(n.boundingBox) === !1) && this._computeIntersections(e, t, aa)));
	}
	_computeIntersections(e, t, n) {
		let r, i = this.geometry, a = this.material, o = i.index, s = i.attributes.position, c = i.attributes.uv, l = i.attributes.uv1, u = i.attributes.normal, d = i.groups, f = i.drawRange;
		if (o !== null) if (Array.isArray(a)) for (let i = 0, s = d.length; i < s; i++) {
			let s = d[i], p = a[s.materialIndex], m = Math.max(s.start, f.start), h = Math.min(o.count, Math.min(s.start + s.count, f.start + f.count));
			for (let i = m, a = h; i < a; i += 3) {
				let a = o.getX(i), d = o.getX(i + 1), f = o.getX(i + 2);
				r = ga(this, p, e, n, c, l, u, a, d, f), r && (r.faceIndex = Math.floor(i / 3), r.face.materialIndex = s.materialIndex, t.push(r));
			}
		}
		else {
			let i = Math.max(0, f.start), s = Math.min(o.count, f.start + f.count);
			for (let d = i, f = s; d < f; d += 3) {
				let i = o.getX(d), s = o.getX(d + 1), f = o.getX(d + 2);
				r = ga(this, a, e, n, c, l, u, i, s, f), r && (r.faceIndex = Math.floor(d / 3), t.push(r));
			}
		}
		else if (s !== void 0) if (Array.isArray(a)) for (let i = 0, o = d.length; i < o; i++) {
			let o = d[i], p = a[o.materialIndex], m = Math.max(o.start, f.start), h = Math.min(s.count, Math.min(o.start + o.count, f.start + f.count));
			for (let i = m, a = h; i < a; i += 3) {
				let a = i, s = i + 1, d = i + 2;
				r = ga(this, p, e, n, c, l, u, a, s, d), r && (r.faceIndex = Math.floor(i / 3), r.face.materialIndex = o.materialIndex, t.push(r));
			}
		}
		else {
			let i = Math.max(0, f.start), o = Math.min(s.count, f.start + f.count);
			for (let s = i, d = o; s < d; s += 3) {
				let i = s, o = s + 1, d = s + 2;
				r = ga(this, a, e, n, c, l, u, i, o, d), r && (r.faceIndex = Math.floor(s / 3), t.push(r));
			}
		}
	}
};
function ha(e, t, n, r, i, a, o, s) {
	let c;
	if (c = t.side === 1 ? r.intersectTriangle(o, a, i, !0, s) : r.intersectTriangle(i, a, o, t.side === 0, s), c === null) return null;
	ma.copy(s), ma.applyMatrix4(e.matrixWorld);
	let l = n.ray.origin.distanceTo(ma);
	return l < n.near || l > n.far ? null : {
		distance: l,
		point: ma.clone(),
		object: e
	};
}
function ga(e, t, n, r, i, a, o, s, c, l) {
	e.getVertexPosition(s, ca), e.getVertexPosition(c, la), e.getVertexPosition(l, ua);
	let u = ha(e, t, n, r, ca, la, ua, pa);
	if (u) {
		let e = new W();
		pi.getBarycoord(pa, ca, la, ua, e), i && (u.uv = pi.getInterpolatedAttribute(i, s, c, l, e, new U())), a && (u.uv1 = pi.getInterpolatedAttribute(a, s, c, l, e, new U())), o && (u.normal = pi.getInterpolatedAttribute(o, s, c, l, e, new W()), u.normal.dot(r.direction) > 0 && u.normal.multiplyScalar(-1));
		let t = {
			a: s,
			b: c,
			c: l,
			normal: new W(),
			materialIndex: 0
		};
		pi.getNormal(ca, la, ua, t.normal), u.face = t, u.barycoord = e;
	}
	return u;
}
var _a = class extends fr {
	constructor(e = null, t = 1, n = 1, r, i, a, o, s, c = Be, l = Be, u, d) {
		super(null, a, o, s, c, l, r, i, u, d), this.isDataTexture = !0, this.image = {
			data: e,
			width: t,
			height: n
		}, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1;
	}
}, va = class extends Mi {
	constructor(e, t, n, r = 1) {
		super(e, t, n), this.isInstancedBufferAttribute = !0, this.meshPerAttribute = r;
	}
	copy(e) {
		return super.copy(e), this.meshPerAttribute = e.meshPerAttribute, this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.meshPerAttribute = this.meshPerAttribute, e.isInstancedBufferAttribute = !0, e;
	}
}, ya = /*@__PURE__*/ new q(), ba = /*@__PURE__*/ new q(), xa = [], Sa = /*@__PURE__*/ new mi(), Ca = /*@__PURE__*/ new q(), wa = /*@__PURE__*/ new X(), Ta = /*@__PURE__*/ new Ri(), Ea = class extends X {
	constructor(e, t, n) {
		super(e, t), this.isInstancedMesh = !0, this.instanceMatrix = new va(new Float32Array(n * 16), 16), this.instanceColor = null, this.morphTexture = null, this.count = n, this.boundingBox = null, this.boundingSphere = null;
		for (let e = 0; e < n; e++) this.setMatrixAt(e, Ca);
	}
	computeBoundingBox() {
		let e = this.geometry, t = this.count;
		this.boundingBox === null && (this.boundingBox = new mi()), e.boundingBox === null && e.computeBoundingBox(), this.boundingBox.makeEmpty();
		for (let n = 0; n < t; n++) this.getMatrixAt(n, ya), Sa.copy(e.boundingBox).applyMatrix4(ya), this.boundingBox.union(Sa);
	}
	computeBoundingSphere() {
		let e = this.geometry, t = this.count;
		this.boundingSphere === null && (this.boundingSphere = new Ri()), e.boundingSphere === null && e.computeBoundingSphere(), this.boundingSphere.makeEmpty();
		for (let n = 0; n < t; n++) this.getMatrixAt(n, ya), Ta.copy(e.boundingSphere).applyMatrix4(ya), this.boundingSphere.union(Ta);
	}
	copy(e, t) {
		return super.copy(e, t), this.instanceMatrix.copy(e.instanceMatrix), e.morphTexture !== null && (this.morphTexture = e.morphTexture.clone()), e.instanceColor !== null && (this.instanceColor = e.instanceColor.clone()), this.count = e.count, e.boundingBox !== null && (this.boundingBox = e.boundingBox.clone()), e.boundingSphere !== null && (this.boundingSphere = e.boundingSphere.clone()), this;
	}
	getColorAt(e, t) {
		return this.instanceColor === null ? t.setRGB(1, 1, 1) : t.fromArray(this.instanceColor.array, e * 3);
	}
	getMatrixAt(e, t) {
		return t.fromArray(this.instanceMatrix.array, e * 16);
	}
	getMorphAt(e, t) {
		let n = t.morphTargetInfluences, r = this.morphTexture.source.data.data, i = e * (n.length + 1) + 1;
		for (let e = 0; e < n.length; e++) n[e] = r[i + e];
	}
	raycast(e, t) {
		let n = this.matrixWorld, r = this.count;
		if (wa.geometry = this.geometry, wa.material = this.material, wa.material !== void 0 && (this.boundingSphere === null && this.computeBoundingSphere(), Ta.copy(this.boundingSphere), Ta.applyMatrix4(n), e.ray.intersectsSphere(Ta) !== !1)) for (let i = 0; i < r; i++) {
			this.getMatrixAt(i, ya), ba.multiplyMatrices(n, ya), wa.matrixWorld = ba, wa.raycast(e, xa);
			for (let e = 0, n = xa.length; e < n; e++) {
				let n = xa[e];
				n.instanceId = i, n.object = this, t.push(n);
			}
			xa.length = 0;
		}
	}
	setColorAt(e, t) {
		return this.instanceColor === null && (this.instanceColor = new va(new Float32Array(this.instanceMatrix.count * 3).fill(1), 3)), t.toArray(this.instanceColor.array, e * 3), this;
	}
	setMatrixAt(e, t) {
		return t.toArray(this.instanceMatrix.array, e * 16), this;
	}
	setMorphAt(e, t) {
		let n = t.morphTargetInfluences, r = n.length + 1;
		this.morphTexture === null && (this.morphTexture = new _a(new Float32Array(r * this.count), r, this.count, ut, Qe));
		let i = this.morphTexture.source.data.data, a = 0;
		for (let e = 0; e < n.length; e++) a += n[e];
		let o = this.geometry.morphTargetsRelative ? 1 : 1 - a, s = r * e;
		return i[s] = o, i.set(n, s + 1), this;
	}
	updateMorphTargets() {}
	dispose() {
		this.dispatchEvent({ type: "dispose" }), this.morphTexture !== null && (this.morphTexture.dispose(), this.morphTexture = null);
	}
}, Da = /*@__PURE__*/ new W(), Oa = /*@__PURE__*/ new W(), ka = /*@__PURE__*/ new G(), Aa = class {
	constructor(e = new W(1, 0, 0), t = 0) {
		this.isPlane = !0, this.normal = e, this.constant = t;
	}
	set(e, t) {
		return this.normal.copy(e), this.constant = t, this;
	}
	setComponents(e, t, n, r) {
		return this.normal.set(e, t, n), this.constant = r, this;
	}
	setFromNormalAndCoplanarPoint(e, t) {
		return this.normal.copy(e), this.constant = -t.dot(this.normal), this;
	}
	setFromCoplanarPoints(e, t, n) {
		let r = Da.subVectors(n, t).cross(Oa.subVectors(e, t)).normalize();
		return this.setFromNormalAndCoplanarPoint(r, e), this;
	}
	copy(e) {
		return this.normal.copy(e.normal), this.constant = e.constant, this;
	}
	normalize() {
		let e = 1 / this.normal.length();
		return this.normal.multiplyScalar(e), this.constant *= e, this;
	}
	negate() {
		return this.constant *= -1, this.normal.negate(), this;
	}
	distanceToPoint(e) {
		return this.normal.dot(e) + this.constant;
	}
	distanceToSphere(e) {
		return this.distanceToPoint(e.center) - e.radius;
	}
	projectPoint(e, t) {
		return t.copy(e).addScaledVector(this.normal, -this.distanceToPoint(e));
	}
	intersectLine(e, t, n = !0) {
		let r = e.delta(Da), i = this.normal.dot(r);
		if (i === 0) return this.distanceToPoint(e.start) === 0 ? t.copy(e.start) : null;
		let a = -(e.start.dot(this.normal) + this.constant) / i;
		return n === !0 && (a < 0 || a > 1) ? null : t.copy(e.start).addScaledVector(r, a);
	}
	intersectsLine(e) {
		let t = this.distanceToPoint(e.start), n = this.distanceToPoint(e.end);
		return t < 0 && n > 0 || n < 0 && t > 0;
	}
	intersectsBox(e) {
		return e.intersectsPlane(this);
	}
	intersectsSphere(e) {
		return e.intersectsPlane(this);
	}
	coplanarPoint(e) {
		return e.copy(this.normal).multiplyScalar(-this.constant);
	}
	applyMatrix4(e, t) {
		let n = t || ka.getNormalMatrix(e), r = this.coplanarPoint(Da).applyMatrix4(e), i = this.normal.applyMatrix3(n).normalize();
		return this.constant = -r.dot(i), this;
	}
	translate(e) {
		return this.constant -= e.dot(this.normal), this;
	}
	equals(e) {
		return e.normal.equals(this.normal) && e.constant === this.constant;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, ja = /*@__PURE__*/ new Ri(), Ma = /*@__PURE__*/ new U(.5, .5), Na = /*@__PURE__*/ new W(), Pa = class {
	constructor(e = new Aa(), t = new Aa(), n = new Aa(), r = new Aa(), i = new Aa(), a = new Aa()) {
		this.planes = [
			e,
			t,
			n,
			r,
			i,
			a
		];
	}
	set(e, t, n, r, i, a) {
		let o = this.planes;
		return o[0].copy(e), o[1].copy(t), o[2].copy(n), o[3].copy(r), o[4].copy(i), o[5].copy(a), this;
	}
	copy(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) t[n].copy(e.planes[n]);
		return this;
	}
	setFromProjectionMatrix(e, t = fn, n = !1) {
		let r = this.planes, i = e.elements, a = i[0], o = i[1], s = i[2], c = i[3], l = i[4], u = i[5], d = i[6], f = i[7], p = i[8], m = i[9], h = i[10], g = i[11], _ = i[12], v = i[13], y = i[14], b = i[15];
		if (r[0].setComponents(c - a, f - l, g - p, b - _).normalize(), r[1].setComponents(c + a, f + l, g + p, b + _).normalize(), r[2].setComponents(c + o, f + u, g + m, b + v).normalize(), r[3].setComponents(c - o, f - u, g - m, b - v).normalize(), n) r[4].setComponents(s, d, h, y).normalize(), r[5].setComponents(c - s, f - d, g - h, b - y).normalize();
		else if (r[4].setComponents(c - s, f - d, g - h, b - y).normalize(), t === 2e3) r[5].setComponents(c + s, f + d, g + h, b + y).normalize();
		else if (t === 2001) r[5].setComponents(s, d, h, y).normalize();
		else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: " + t);
		return this;
	}
	intersectsObject(e) {
		if (e.boundingSphere !== void 0) e.boundingSphere === null && e.computeBoundingSphere(), ja.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);
		else {
			let t = e.geometry;
			t.boundingSphere === null && t.computeBoundingSphere(), ja.copy(t.boundingSphere).applyMatrix4(e.matrixWorld);
		}
		return this.intersectsSphere(ja);
	}
	intersectsSprite(e) {
		return ja.center.set(0, 0, 0), ja.radius = .7071067811865476 + Ma.distanceTo(e.center), ja.applyMatrix4(e.matrixWorld), this.intersectsSphere(ja);
	}
	intersectsSphere(e) {
		let t = this.planes, n = e.center, r = -e.radius;
		for (let e = 0; e < 6; e++) if (t[e].distanceToPoint(n) < r) return !1;
		return !0;
	}
	intersectsBox(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) {
			let r = t[n];
			if (Na.x = r.normal.x > 0 ? e.max.x : e.min.x, Na.y = r.normal.y > 0 ? e.max.y : e.min.y, Na.z = r.normal.z > 0 ? e.max.z : e.min.z, r.distanceToPoint(Na) < 0) return !1;
		}
		return !0;
	}
	containsPoint(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) if (t[n].distanceToPoint(e) < 0) return !1;
		return !0;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Fa = class extends Ji {
	constructor(e) {
		super(), this.isLineBasicMaterial = !0, this.type = "LineBasicMaterial", this.color = new J(16777215), this.map = null, this.linewidth = 1, this.linecap = "round", this.linejoin = "round", this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.linewidth = e.linewidth, this.linecap = e.linecap, this.linejoin = e.linejoin, this.fog = e.fog, this;
	}
}, Ia = /*@__PURE__*/ new W(), La = /*@__PURE__*/ new W(), Ra = /*@__PURE__*/ new q(), za = /*@__PURE__*/ new na(), Ba = /*@__PURE__*/ new Ri(), Va = /*@__PURE__*/ new W(), Ha = /*@__PURE__*/ new W(), Ua = class extends Wr {
	constructor(e = new Ki(), t = new Fa()) {
		super(), this.isLine = !0, this.type = "Line", this.geometry = e, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.updateMorphTargets();
	}
	copy(e, t) {
		return super.copy(e, t), this.material = Array.isArray(e.material) ? e.material.slice() : e.material, this.geometry = e.geometry, this;
	}
	computeLineDistances() {
		let e = this.geometry;
		if (e.index === null) {
			let t = e.attributes.position, n = [0];
			for (let e = 1, r = t.count; e < r; e++) Ia.fromBufferAttribute(t, e - 1), La.fromBufferAttribute(t, e), n[e] = n[e - 1], n[e] += Ia.distanceTo(La);
			e.setAttribute("lineDistance", new Y(n, 1));
		} else B("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
		return this;
	}
	raycast(e, t) {
		let n = this.geometry, r = this.matrixWorld, i = e.params.Line.threshold, a = n.drawRange;
		if (n.boundingSphere === null && n.computeBoundingSphere(), Ba.copy(n.boundingSphere), Ba.applyMatrix4(r), Ba.radius += i, e.ray.intersectsSphere(Ba) === !1) return;
		Ra.copy(r).invert(), za.copy(e.ray).applyMatrix4(Ra);
		let o = i / ((this.scale.x + this.scale.y + this.scale.z) / 3), s = o * o, c = this.isLineSegments ? 2 : 1, l = n.index, u = n.attributes.position;
		if (l !== null) {
			let n = Math.max(0, a.start), r = Math.min(l.count, a.start + a.count);
			for (let i = n, a = r - 1; i < a; i += c) {
				let n = l.getX(i), r = l.getX(i + 1), a = Wa(this, e, za, s, n, r, i);
				a && t.push(a);
			}
			if (this.isLineLoop) {
				let i = l.getX(r - 1), a = l.getX(n), o = Wa(this, e, za, s, i, a, r - 1);
				o && t.push(o);
			}
		} else {
			let n = Math.max(0, a.start), r = Math.min(u.count, a.start + a.count);
			for (let i = n, a = r - 1; i < a; i += c) {
				let n = Wa(this, e, za, s, i, i + 1, i);
				n && t.push(n);
			}
			if (this.isLineLoop) {
				let i = Wa(this, e, za, s, r - 1, n, r - 1);
				i && t.push(i);
			}
		}
	}
	updateMorphTargets() {
		let e = this.geometry.morphAttributes, t = Object.keys(e);
		if (t.length > 0) {
			let n = e[t[0]];
			if (n !== void 0) {
				this.morphTargetInfluences = [], this.morphTargetDictionary = {};
				for (let e = 0, t = n.length; e < t; e++) {
					let t = n[e].name || String(e);
					this.morphTargetInfluences.push(0), this.morphTargetDictionary[t] = e;
				}
			}
		}
	}
};
function Wa(e, t, n, r, i, a, o) {
	let s = e.geometry.attributes.position;
	if (Ia.fromBufferAttribute(s, i), La.fromBufferAttribute(s, a), n.distanceSqToSegment(Ia, La, Va, Ha) > r) return;
	Va.applyMatrix4(e.matrixWorld);
	let c = t.ray.origin.distanceTo(Va);
	if (!(c < t.near || c > t.far)) return {
		distance: c,
		point: Ha.clone().applyMatrix4(e.matrixWorld),
		index: o,
		face: null,
		faceIndex: null,
		barycoord: null,
		object: e
	};
}
var Ga = class extends fr {
	constructor(e = [], t = 301, n, r, i, a, o, s, c, l) {
		super(e, t, n, r, i, a, o, s, c, l), this.isCubeTexture = !0, this.flipY = !1;
	}
	get images() {
		return this.image;
	}
	set images(e) {
		this.image = e;
	}
}, Ka = class extends fr {
	constructor(e, t, n = Ze, r, i, a, o = Be, s = Be, c, l = ct, u = 1) {
		if (l !== 1026 && l !== 1027) throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");
		super({
			width: e,
			height: t,
			depth: u
		}, r, i, a, o, s, l, n, c), this.isDepthTexture = !0, this.flipY = !1, this.generateMipmaps = !1, this.compareFunction = null;
	}
	copy(e) {
		return super.copy(e), this.source = new cr(Object.assign({}, e.image)), this.compareFunction = e.compareFunction, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return this.compareFunction !== null && (t.compareFunction = this.compareFunction), t;
	}
}, qa = class extends Ka {
	constructor(e, t = Ze, n = 301, r, i, a = Be, o = Be, s, c = ct) {
		let l = {
			width: e,
			height: e,
			depth: 1
		}, u = [
			l,
			l,
			l,
			l,
			l,
			l
		];
		super(e, e, t, n, r, i, a, o, s, c), this.image = u, this.isCubeDepthTexture = !0, this.isCubeTexture = !0;
	}
	get images() {
		return this.image;
	}
	set images(e) {
		this.image = e;
	}
}, Ja = class extends fr {
	constructor(e = null) {
		super(), this.sourceTexture = e, this.isExternalTexture = !0;
	}
	copy(e) {
		return super.copy(e), this.sourceTexture = e.sourceTexture, this;
	}
}, Ya = class e extends Ki {
	constructor(e = 1, t = 1, n = 1, r = 1, i = 1, a = 1) {
		super(), this.type = "BoxGeometry", this.parameters = {
			width: e,
			height: t,
			depth: n,
			widthSegments: r,
			heightSegments: i,
			depthSegments: a
		};
		let o = this;
		r = Math.floor(r), i = Math.floor(i), a = Math.floor(a);
		let s = [], c = [], l = [], u = [], d = 0, f = 0;
		p("z", "y", "x", -1, -1, n, t, e, a, i, 0), p("z", "y", "x", 1, -1, n, t, -e, a, i, 1), p("x", "z", "y", 1, 1, e, n, t, r, a, 2), p("x", "z", "y", 1, -1, e, n, -t, r, a, 3), p("x", "y", "z", 1, -1, e, t, n, r, i, 4), p("x", "y", "z", -1, -1, e, t, -n, r, i, 5), this.setIndex(s), this.setAttribute("position", new Y(c, 3)), this.setAttribute("normal", new Y(l, 3)), this.setAttribute("uv", new Y(u, 2));
		function p(e, t, n, r, i, a, p, m, h, g, _) {
			let v = a / h, y = p / g, b = a / 2, x = p / 2, S = m / 2, C = h + 1, w = g + 1, T = 0, E = 0, D = new W();
			for (let a = 0; a < w; a++) {
				let o = a * y - x;
				for (let s = 0; s < C; s++) D[e] = (s * v - b) * r, D[t] = o * i, D[n] = S, c.push(D.x, D.y, D.z), D[e] = 0, D[t] = 0, D[n] = m > 0 ? 1 : -1, l.push(D.x, D.y, D.z), u.push(s / h), u.push(1 - a / g), T += 1;
			}
			for (let e = 0; e < g; e++) for (let t = 0; t < h; t++) {
				let n = d + t + C * e, r = d + t + C * (e + 1), i = d + (t + 1) + C * (e + 1), a = d + (t + 1) + C * e;
				s.push(n, r, a), s.push(r, i, a), E += 6;
			}
			o.addGroup(f, E, _), f += E, d += T;
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.width, t.height, t.depth, t.widthSegments, t.heightSegments, t.depthSegments);
	}
}, Xa = class e extends Ki {
	constructor(e = 1, t = 32, n = 0, r = Math.PI * 2) {
		super(), this.type = "CircleGeometry", this.parameters = {
			radius: e,
			segments: t,
			thetaStart: n,
			thetaLength: r
		}, t = Math.max(3, t);
		let i = [], a = [], o = [], s = [], c = new W(), l = new U();
		a.push(0, 0, 0), o.push(0, 0, 1), s.push(.5, .5);
		for (let i = 0, u = 3; i <= t; i++, u += 3) {
			let d = n + i / t * r;
			c.x = e * Math.cos(d), c.y = e * Math.sin(d), a.push(c.x, c.y, c.z), o.push(0, 0, 1), l.x = (a[u] / e + 1) / 2, l.y = (a[u + 1] / e + 1) / 2, s.push(l.x, l.y);
		}
		for (let e = 1; e <= t; e++) i.push(e, e + 1, 0);
		this.setIndex(i), this.setAttribute("position", new Y(a, 3)), this.setAttribute("normal", new Y(o, 3)), this.setAttribute("uv", new Y(s, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.segments, t.thetaStart, t.thetaLength);
	}
}, Za = class e extends Ki {
	constructor(e = 1, t = 1, n = 1, r = 32, i = 1, a = !1, o = 0, s = Math.PI * 2) {
		super(), this.type = "CylinderGeometry", this.parameters = {
			radiusTop: e,
			radiusBottom: t,
			height: n,
			radialSegments: r,
			heightSegments: i,
			openEnded: a,
			thetaStart: o,
			thetaLength: s
		};
		let c = this;
		r = Math.floor(r), i = Math.floor(i);
		let l = [], u = [], d = [], f = [], p = 0, m = [], h = n / 2, g = 0;
		_(), a === !1 && (e > 0 && v(!0), t > 0 && v(!1)), this.setIndex(l), this.setAttribute("position", new Y(u, 3)), this.setAttribute("normal", new Y(d, 3)), this.setAttribute("uv", new Y(f, 2));
		function _() {
			let a = new W(), _ = new W(), v = 0, y = (t - e) / n;
			for (let c = 0; c <= i; c++) {
				let l = [], g = c / i, v = g * (t - e) + e;
				for (let e = 0; e <= r; e++) {
					let t = e / r, i = t * s + o, c = Math.sin(i), m = Math.cos(i);
					_.x = v * c, _.y = -g * n + h, _.z = v * m, u.push(_.x, _.y, _.z), a.set(c, y, m).normalize(), d.push(a.x, a.y, a.z), f.push(t, 1 - g), l.push(p++);
				}
				m.push(l);
			}
			for (let n = 0; n < r; n++) for (let r = 0; r < i; r++) {
				let a = m[r][n], o = m[r + 1][n], s = m[r + 1][n + 1], c = m[r][n + 1];
				(e > 0 || r !== 0) && (l.push(a, o, c), v += 3), (t > 0 || r !== i - 1) && (l.push(o, s, c), v += 3);
			}
			c.addGroup(g, v, 0), g += v;
		}
		function v(n) {
			let i = p, a = new U(), m = new W(), _ = 0, v = n === !0 ? e : t, y = n === !0 ? 1 : -1;
			for (let e = 1; e <= r; e++) u.push(0, h * y, 0), d.push(0, y, 0), f.push(.5, .5), p++;
			let b = p;
			for (let e = 0; e <= r; e++) {
				let t = e / r * s + o, n = Math.cos(t), i = Math.sin(t);
				m.x = v * i, m.y = h * y, m.z = v * n, u.push(m.x, m.y, m.z), d.push(0, y, 0), a.x = n * .5 + .5, a.y = i * .5 * y + .5, f.push(a.x, a.y), p++;
			}
			for (let e = 0; e < r; e++) {
				let t = i + e, r = b + e;
				n === !0 ? l.push(r, r + 1, t) : l.push(r + 1, r, t), _ += 3;
			}
			c.addGroup(g, _, n === !0 ? 1 : 2), g += _;
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radiusTop, t.radiusBottom, t.height, t.radialSegments, t.heightSegments, t.openEnded, t.thetaStart, t.thetaLength);
	}
}, Qa = class e extends Za {
	constructor(e = 1, t = 1, n = 32, r = 1, i = !1, a = 0, o = Math.PI * 2) {
		super(0, e, t, n, r, i, a, o), this.type = "ConeGeometry", this.parameters = {
			radius: e,
			height: t,
			radialSegments: n,
			heightSegments: r,
			openEnded: i,
			thetaStart: a,
			thetaLength: o
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.height, t.radialSegments, t.heightSegments, t.openEnded, t.thetaStart, t.thetaLength);
	}
}, $a = class e extends Ki {
	constructor(e = [], t = [], n = 1, r = 0) {
		super(), this.type = "PolyhedronGeometry", this.parameters = {
			vertices: e,
			indices: t,
			radius: n,
			detail: r
		};
		let i = [], a = [];
		o(r), c(n), l(), this.setAttribute("position", new Y(i, 3)), this.setAttribute("normal", new Y(i.slice(), 3)), this.setAttribute("uv", new Y(a, 2)), r === 0 ? this.computeVertexNormals() : this.normalizeNormals();
		function o(e) {
			let n = new W(), r = new W(), i = new W();
			for (let a = 0; a < t.length; a += 3) f(t[a + 0], n), f(t[a + 1], r), f(t[a + 2], i), s(n, r, i, e);
		}
		function s(e, t, n, r) {
			let i = r + 1, a = [];
			for (let r = 0; r <= i; r++) {
				a[r] = [];
				let o = e.clone().lerp(n, r / i), s = t.clone().lerp(n, r / i), c = i - r;
				for (let e = 0; e <= c; e++) e === 0 && r === i ? a[r][e] = o : a[r][e] = o.clone().lerp(s, e / c);
			}
			for (let e = 0; e < i; e++) for (let t = 0; t < 2 * (i - e) - 1; t++) {
				let n = Math.floor(t / 2);
				t % 2 == 0 ? (d(a[e][n + 1]), d(a[e + 1][n]), d(a[e][n])) : (d(a[e][n + 1]), d(a[e + 1][n + 1]), d(a[e + 1][n]));
			}
		}
		function c(e) {
			let t = new W();
			for (let n = 0; n < i.length; n += 3) t.x = i[n + 0], t.y = i[n + 1], t.z = i[n + 2], t.normalize().multiplyScalar(e), i[n + 0] = t.x, i[n + 1] = t.y, i[n + 2] = t.z;
		}
		function l() {
			let e = new W();
			for (let t = 0; t < i.length; t += 3) {
				e.x = i[t + 0], e.y = i[t + 1], e.z = i[t + 2];
				let n = h(e) / 2 / Math.PI + .5, r = g(e) / Math.PI + .5;
				a.push(n, 1 - r);
			}
			p(), u();
		}
		function u() {
			for (let e = 0; e < a.length; e += 6) {
				let t = a[e + 0], n = a[e + 2], r = a[e + 4];
				Math.max(t, n, r) > .9 && Math.min(t, n, r) < .1 && (t < .2 && (a[e + 0] += 1), n < .2 && (a[e + 2] += 1), r < .2 && (a[e + 4] += 1));
			}
		}
		function d(e) {
			i.push(e.x, e.y, e.z);
		}
		function f(t, n) {
			let r = t * 3;
			n.x = e[r + 0], n.y = e[r + 1], n.z = e[r + 2];
		}
		function p() {
			let e = new W(), t = new W(), n = new W(), r = new W(), o = new U(), s = new U(), c = new U();
			for (let l = 0, u = 0; l < i.length; l += 9, u += 6) {
				e.set(i[l + 0], i[l + 1], i[l + 2]), t.set(i[l + 3], i[l + 4], i[l + 5]), n.set(i[l + 6], i[l + 7], i[l + 8]), o.set(a[u + 0], a[u + 1]), s.set(a[u + 2], a[u + 3]), c.set(a[u + 4], a[u + 5]), r.copy(e).add(t).add(n).divideScalar(3);
				let d = h(r);
				m(o, u + 0, e, d), m(s, u + 2, t, d), m(c, u + 4, n, d);
			}
		}
		function m(e, t, n, r) {
			r < 0 && e.x === 1 && (a[t] = e.x - 1), n.x === 0 && n.z === 0 && (a[t] = r / 2 / Math.PI + .5);
		}
		function h(e) {
			return Math.atan2(e.z, -e.x);
		}
		function g(e) {
			return Math.atan2(-e.y, Math.sqrt(e.x * e.x + e.z * e.z));
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.vertices, t.indices, t.radius, t.detail);
	}
}, eo = class e extends $a {
	constructor(e = 1, t = 0) {
		let n = (1 + Math.sqrt(5)) / 2, r = [
			-1,
			n,
			0,
			1,
			n,
			0,
			-1,
			-n,
			0,
			1,
			-n,
			0,
			0,
			-1,
			n,
			0,
			1,
			n,
			0,
			-1,
			-n,
			0,
			1,
			-n,
			n,
			0,
			-1,
			n,
			0,
			1,
			-n,
			0,
			-1,
			-n,
			0,
			1
		];
		super(r, [
			0,
			11,
			5,
			0,
			5,
			1,
			0,
			1,
			7,
			0,
			7,
			10,
			0,
			10,
			11,
			1,
			5,
			9,
			5,
			11,
			4,
			11,
			10,
			2,
			10,
			7,
			6,
			7,
			1,
			8,
			3,
			9,
			4,
			3,
			4,
			2,
			3,
			2,
			6,
			3,
			6,
			8,
			3,
			8,
			9,
			4,
			9,
			5,
			2,
			4,
			11,
			6,
			2,
			10,
			8,
			6,
			7,
			9,
			8,
			1
		], e, t), this.type = "IcosahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, to = class e extends Ki {
	constructor(e = 1, t = 1, n = 1, r = 1) {
		super(), this.type = "PlaneGeometry", this.parameters = {
			width: e,
			height: t,
			widthSegments: n,
			heightSegments: r
		};
		let i = e / 2, a = t / 2, o = Math.floor(n), s = Math.floor(r), c = o + 1, l = s + 1, u = e / o, d = t / s, f = [], p = [], m = [], h = [];
		for (let e = 0; e < l; e++) {
			let t = e * d - a;
			for (let n = 0; n < c; n++) {
				let r = n * u - i;
				p.push(r, -t, 0), m.push(0, 0, 1), h.push(n / o), h.push(1 - e / s);
			}
		}
		for (let e = 0; e < s; e++) for (let t = 0; t < o; t++) {
			let n = t + c * e, r = t + c * (e + 1), i = t + 1 + c * (e + 1), a = t + 1 + c * e;
			f.push(n, r, a), f.push(r, i, a);
		}
		this.setIndex(f), this.setAttribute("position", new Y(p, 3)), this.setAttribute("normal", new Y(m, 3)), this.setAttribute("uv", new Y(h, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.width, t.height, t.widthSegments, t.heightSegments);
	}
}, no = class e extends Ki {
	constructor(e = 1, t = 32, n = 16, r = 0, i = Math.PI * 2, a = 0, o = Math.PI) {
		super(), this.type = "SphereGeometry", this.parameters = {
			radius: e,
			widthSegments: t,
			heightSegments: n,
			phiStart: r,
			phiLength: i,
			thetaStart: a,
			thetaLength: o
		}, t = Math.max(3, Math.floor(t)), n = Math.max(2, Math.floor(n));
		let s = Math.min(a + o, Math.PI), c = 0, l = [], u = new W(), d = new W(), f = [], p = [], m = [], h = [];
		for (let f = 0; f <= n; f++) {
			let g = [], _ = f / n, v = a + _ * o, y = e * Math.cos(v), b = Math.sqrt(e * e - y * y), x = 0;
			f === 0 && a === 0 ? x = .5 / t : f === n && s === Math.PI && (x = -.5 / t);
			for (let e = 0; e <= t; e++) {
				let n = e / t, a = r + n * i;
				u.x = -b * Math.cos(a), u.y = y, u.z = b * Math.sin(a), p.push(u.x, u.y, u.z), d.copy(u).normalize(), m.push(d.x, d.y, d.z), h.push(n + x, 1 - _), g.push(c++);
			}
			l.push(g);
		}
		for (let e = 0; e < n; e++) for (let r = 0; r < t; r++) {
			let t = l[e][r + 1], i = l[e][r], o = l[e + 1][r], c = l[e + 1][r + 1];
			(e !== 0 || a > 0) && f.push(t, i, c), (e !== n - 1 || s < Math.PI) && f.push(i, o, c);
		}
		this.setIndex(f), this.setAttribute("position", new Y(p, 3)), this.setAttribute("normal", new Y(m, 3)), this.setAttribute("uv", new Y(h, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.widthSegments, t.heightSegments, t.phiStart, t.phiLength, t.thetaStart, t.thetaLength);
	}
}, ro = class e extends $a {
	constructor(e = 1, t = 0) {
		super([
			1,
			1,
			1,
			-1,
			-1,
			1,
			-1,
			1,
			-1,
			1,
			-1,
			-1
		], [
			2,
			1,
			0,
			0,
			3,
			2,
			1,
			3,
			0,
			2,
			3,
			1
		], e, t), this.type = "TetrahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, io = class e extends Ki {
	constructor(e = 1, t = .4, n = 12, r = 48, i = Math.PI * 2, a = 0, o = Math.PI * 2) {
		super(), this.type = "TorusGeometry", this.parameters = {
			radius: e,
			tube: t,
			radialSegments: n,
			tubularSegments: r,
			arc: i,
			thetaStart: a,
			thetaLength: o
		}, n = Math.floor(n), r = Math.floor(r);
		let s = [], c = [], l = [], u = [], d = new W(), f = new W(), p = new W();
		for (let s = 0; s <= n; s++) {
			let m = a + s / n * o;
			for (let a = 0; a <= r; a++) {
				let o = a / r * i;
				f.x = (e + t * Math.cos(m)) * Math.cos(o), f.y = (e + t * Math.cos(m)) * Math.sin(o), f.z = t * Math.sin(m), c.push(f.x, f.y, f.z), d.x = e * Math.cos(o), d.y = e * Math.sin(o), p.subVectors(f, d).normalize(), l.push(p.x, p.y, p.z), u.push(a / r), u.push(s / n);
			}
		}
		for (let e = 1; e <= n; e++) for (let t = 1; t <= r; t++) {
			let n = (r + 1) * e + t - 1, i = (r + 1) * (e - 1) + t - 1, a = (r + 1) * (e - 1) + t, o = (r + 1) * e + t;
			s.push(n, i, o), s.push(i, a, o);
		}
		this.setIndex(s), this.setAttribute("position", new Y(c, 3)), this.setAttribute("normal", new Y(l, 3)), this.setAttribute("uv", new Y(u, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.tube, t.radialSegments, t.tubularSegments, t.arc);
	}
};
function ao(e) {
	let t = {};
	for (let n in e) {
		t[n] = {};
		for (let r in e[n]) {
			let i = e[n][r];
			if (so(i)) i.isRenderTargetTexture ? (B("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."), t[n][r] = null) : t[n][r] = i.clone();
			else if (Array.isArray(i)) if (so(i[0])) {
				let e = [];
				for (let t = 0, n = i.length; t < n; t++) e[t] = i[t].clone();
				t[n][r] = e;
			} else t[n][r] = i.slice();
			else t[n][r] = i;
		}
	}
	return t;
}
function oo(e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = ao(e[n]);
		for (let e in r) t[e] = r[e];
	}
	return t;
}
function so(e) {
	return e && (e.isColor || e.isMatrix3 || e.isMatrix4 || e.isVector2 || e.isVector3 || e.isVector4 || e.isTexture || e.isQuaternion);
}
function co(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) t.push(e[n].clone());
	return t;
}
function lo(e) {
	let t = e.getRenderTarget();
	return t === null ? e.outputColorSpace : t.isXRRenderTarget === !0 ? t.texture.colorSpace : K.workingColorSpace;
}
var uo = {
	clone: ao,
	merge: oo
}, fo = "void main() {\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}", po = "void main() {\n	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}", mo = class extends Ji {
	constructor(e) {
		super(), this.isShaderMaterial = !0, this.type = "ShaderMaterial", this.defines = {}, this.uniforms = {}, this.uniformsGroups = [], this.vertexShader = fo, this.fragmentShader = po, this.linewidth = 1, this.wireframe = !1, this.wireframeLinewidth = 1, this.fog = !1, this.lights = !1, this.clipping = !1, this.forceSinglePass = !0, this.extensions = {
			clipCullDistance: !1,
			multiDraw: !1
		}, this.defaultAttributeValues = {
			color: [
				1,
				1,
				1
			],
			uv: [0, 0],
			uv1: [0, 0]
		}, this.index0AttributeName = void 0, this.uniformsNeedUpdate = !1, this.glslVersion = null, e !== void 0 && this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.fragmentShader = e.fragmentShader, this.vertexShader = e.vertexShader, this.uniforms = ao(e.uniforms), this.uniformsGroups = co(e.uniformsGroups), this.defines = Object.assign({}, e.defines), this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.fog = e.fog, this.lights = e.lights, this.clipping = e.clipping, this.extensions = Object.assign({}, e.extensions), this.glslVersion = e.glslVersion, this.defaultAttributeValues = Object.assign({}, e.defaultAttributeValues), this.index0AttributeName = e.index0AttributeName, this.uniformsNeedUpdate = e.uniformsNeedUpdate, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		t.glslVersion = this.glslVersion, t.uniforms = {};
		for (let n in this.uniforms) {
			let r = this.uniforms[n].value;
			r && r.isTexture ? t.uniforms[n] = {
				type: "t",
				value: r.toJSON(e).uuid
			} : r && r.isColor ? t.uniforms[n] = {
				type: "c",
				value: r.getHex()
			} : r && r.isVector2 ? t.uniforms[n] = {
				type: "v2",
				value: r.toArray()
			} : r && r.isVector3 ? t.uniforms[n] = {
				type: "v3",
				value: r.toArray()
			} : r && r.isVector4 ? t.uniforms[n] = {
				type: "v4",
				value: r.toArray()
			} : r && r.isMatrix3 ? t.uniforms[n] = {
				type: "m3",
				value: r.toArray()
			} : r && r.isMatrix4 ? t.uniforms[n] = {
				type: "m4",
				value: r.toArray()
			} : t.uniforms[n] = { value: r };
		}
		Object.keys(this.defines).length > 0 && (t.defines = this.defines), t.vertexShader = this.vertexShader, t.fragmentShader = this.fragmentShader, t.lights = this.lights, t.clipping = this.clipping;
		let n = {};
		for (let e in this.extensions) this.extensions[e] === !0 && (n[e] = !0);
		return Object.keys(n).length > 0 && (t.extensions = n), t;
	}
	fromJSON(e, t) {
		if (super.fromJSON(e, t), e.uniforms !== void 0) for (let n in e.uniforms) {
			let r = e.uniforms[n];
			switch (this.uniforms[n] = {}, r.type) {
				case "t":
					this.uniforms[n].value = t[r.value] || null;
					break;
				case "c":
					this.uniforms[n].value = new J().setHex(r.value);
					break;
				case "v2":
					this.uniforms[n].value = new U().fromArray(r.value);
					break;
				case "v3":
					this.uniforms[n].value = new W().fromArray(r.value);
					break;
				case "v4":
					this.uniforms[n].value = new pr().fromArray(r.value);
					break;
				case "m3":
					this.uniforms[n].value = new G().fromArray(r.value);
					break;
				case "m4":
					this.uniforms[n].value = new q().fromArray(r.value);
					break;
				default: this.uniforms[n].value = r.value;
			}
		}
		if (e.defines !== void 0 && (this.defines = e.defines), e.vertexShader !== void 0 && (this.vertexShader = e.vertexShader), e.fragmentShader !== void 0 && (this.fragmentShader = e.fragmentShader), e.glslVersion !== void 0 && (this.glslVersion = e.glslVersion), e.extensions !== void 0) for (let t in e.extensions) this.extensions[t] = e.extensions[t];
		return e.lights !== void 0 && (this.lights = e.lights), e.clipping !== void 0 && (this.clipping = e.clipping), this;
	}
}, ho = class extends mo {
	constructor(e) {
		super(e), this.isRawShaderMaterial = !0, this.type = "RawShaderMaterial";
	}
}, go = class extends Ji {
	constructor(e) {
		super(), this.isMeshStandardMaterial = !0, this.type = "MeshStandardMaterial", this.defines = { STANDARD: "" }, this.color = new J(16777215), this.roughness = 1, this.metalness = 0, this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.emissive = new J(0), this.emissiveIntensity = 1, this.emissiveMap = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new U(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.roughnessMap = null, this.metalnessMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new Dr(), this.envMapIntensity = 1, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.flatShading = !1, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.defines = { STANDARD: "" }, this.color.copy(e.color), this.roughness = e.roughness, this.metalness = e.metalness, this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.emissive.copy(e.emissive), this.emissiveMap = e.emissiveMap, this.emissiveIntensity = e.emissiveIntensity, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.roughnessMap = e.roughnessMap, this.metalnessMap = e.metalnessMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.envMapIntensity = e.envMapIntensity, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.flatShading = e.flatShading, this.fog = e.fog, this;
	}
}, _o = class extends Ji {
	constructor(e) {
		super(), this.isMeshDepthMaterial = !0, this.type = "MeshDepthMaterial", this.depthPacking = an, this.map = null, this.alphaMap = null, this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.wireframe = !1, this.wireframeLinewidth = 1, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.depthPacking = e.depthPacking, this.map = e.map, this.alphaMap = e.alphaMap, this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this;
	}
}, vo = class extends Ji {
	constructor(e) {
		super(), this.isMeshDistanceMaterial = !0, this.type = "MeshDistanceMaterial", this.map = null, this.alphaMap = null, this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.map = e.map, this.alphaMap = e.alphaMap, this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this;
	}
};
function yo(e, t) {
	return !e || e.constructor === t ? e : typeof t.BYTES_PER_ELEMENT == "number" ? new t(e) : Array.prototype.slice.call(e);
}
var bo = class {
	constructor(e, t, n, r) {
		this.parameterPositions = e, this._cachedIndex = 0, this.resultBuffer = r === void 0 ? new t.constructor(n) : r, this.sampleValues = t, this.valueSize = n, this.settings = null, this.DefaultSettings_ = {};
	}
	evaluate(e) {
		let t = this.parameterPositions, n = this._cachedIndex, r = t[n], i = t[n - 1];
		validate_interval: {
			seek: {
				let a;
				linear_scan: {
					forward_scan: if (!(e < r)) {
						for (let a = n + 2;;) {
							if (r === void 0) {
								if (e < i) break forward_scan;
								return n = t.length, this._cachedIndex = n, this.copySampleValue_(n - 1);
							}
							if (n === a) break;
							if (i = r, r = t[++n], e < r) break seek;
						}
						a = t.length;
						break linear_scan;
					}
					if (!(e >= i)) {
						let o = t[1];
						e < o && (n = 2, i = o);
						for (let a = n - 2;;) {
							if (i === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
							if (n === a) break;
							if (r = i, i = t[--n - 1], e >= i) break seek;
						}
						a = n, n = 0;
						break linear_scan;
					}
					break validate_interval;
				}
				for (; n < a;) {
					let r = n + a >>> 1;
					e < t[r] ? a = r : n = r + 1;
				}
				if (r = t[n], i = t[n - 1], i === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
				if (r === void 0) return n = t.length, this._cachedIndex = n, this.copySampleValue_(n - 1);
			}
			this._cachedIndex = n, this.intervalChanged_(n, i, r);
		}
		return this.interpolate_(n, i, e, r);
	}
	getSettings_() {
		return this.settings || this.DefaultSettings_;
	}
	copySampleValue_(e) {
		let t = this.resultBuffer, n = this.sampleValues, r = this.valueSize, i = e * r;
		for (let e = 0; e !== r; ++e) t[e] = n[i + e];
		return t;
	}
	interpolate_() {
		throw Error("THREE.Interpolant: Call to abstract method.");
	}
	intervalChanged_() {}
}, xo = class extends bo {
	constructor(e, t, n, r) {
		super(e, t, n, r), this._weightPrev = -0, this._offsetPrev = -0, this._weightNext = -0, this._offsetNext = -0, this.DefaultSettings_ = {
			endingStart: tn,
			endingEnd: tn
		};
	}
	intervalChanged_(e, t, n) {
		let r = this.parameterPositions, i = e - 2, a = e + 1, o = r[i], s = r[a];
		if (o === void 0) switch (this.getSettings_().endingStart) {
			case nn:
				i = e, o = 2 * t - n;
				break;
			case rn:
				i = r.length - 2, o = t + r[i] - r[i + 1];
				break;
			default: i = e, o = n;
		}
		if (s === void 0) switch (this.getSettings_().endingEnd) {
			case nn:
				a = e, s = 2 * n - t;
				break;
			case rn:
				a = 1, s = n + r[1] - r[0];
				break;
			default: a = e - 1, s = t;
		}
		let c = (n - t) * .5, l = this.valueSize;
		this._weightPrev = c / (t - o), this._weightNext = c / (s - n), this._offsetPrev = i * l, this._offsetNext = a * l;
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = this._offsetPrev, u = this._offsetNext, d = this._weightPrev, f = this._weightNext, p = (n - t) / (r - t), m = p * p, h = m * p, g = -d * h + 2 * d * m - d * p, _ = (1 + d) * h + (-1.5 - 2 * d) * m + (-.5 + d) * p + 1, v = (-1 - f) * h + (1.5 + f) * m + .5 * p, y = f * h - f * m;
		for (let e = 0; e !== o; ++e) i[e] = g * a[l + e] + _ * a[c + e] + v * a[s + e] + y * a[u + e];
		return i;
	}
}, So = class extends bo {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = (n - t) / (r - t), u = 1 - l;
		for (let e = 0; e !== o; ++e) i[e] = a[c + e] * u + a[s + e] * l;
		return i;
	}
}, Co = class extends bo {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e) {
		return this.copySampleValue_(e - 1);
	}
}, wo = class extends bo {
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = this.inTangents, u = this.outTangents;
		if (!l || !u) {
			let e = (n - t) / (r - t), l = 1 - e;
			for (let t = 0; t !== o; ++t) i[t] = a[c + t] * l + a[s + t] * e;
			return i;
		}
		let d = o * 2, f = e - 1;
		for (let p = 0; p !== o; ++p) {
			let o = a[c + p], m = a[s + p], h = f * d + p * 2, g = u[h], _ = u[h + 1], v = e * d + p * 2, y = l[v], b = l[v + 1], x = (n - t) / (r - t), S, C, w, T, E;
			for (let e = 0; e < 8; e++) {
				S = x * x, C = S * x, w = 1 - x, T = w * w, E = T * w;
				let e = E * t + 3 * T * x * g + 3 * w * S * y + C * r - n;
				if (Math.abs(e) < 1e-10) break;
				let i = 3 * T * (g - t) + 6 * w * x * (y - g) + 3 * S * (r - y);
				if (Math.abs(i) < 1e-10) break;
				x -= e / i, x = Math.max(0, Math.min(1, x));
			}
			i[p] = E * o + 3 * T * x * _ + 3 * w * S * b + C * m;
		}
		return i;
	}
}, To = class {
	constructor(e, t, n, r) {
		if (e === void 0) throw Error("THREE.KeyframeTrack: track name is undefined");
		if (t === void 0 || t.length === 0) throw Error("THREE.KeyframeTrack: no keyframes in track named " + e);
		this.name = e, this.times = yo(t, this.TimeBufferType), this.values = yo(n, this.ValueBufferType), this.setInterpolation(r || this.DefaultInterpolation);
	}
	static toJSON(e) {
		let t = e.constructor, n;
		if (t.toJSON !== this.toJSON) n = t.toJSON(e);
		else {
			n = {
				name: e.name,
				times: yo(e.times, Array),
				values: yo(e.values, Array)
			};
			let t = e.getInterpolation();
			t !== e.DefaultInterpolation && (n.interpolation = t);
		}
		return n.type = e.ValueTypeName, n;
	}
	InterpolantFactoryMethodDiscrete(e) {
		return new Co(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodLinear(e) {
		return new So(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodSmooth(e) {
		return new xo(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodBezier(e) {
		let t = new wo(this.times, this.values, this.getValueSize(), e);
		return this.settings && (t.inTangents = this.settings.inTangents, t.outTangents = this.settings.outTangents), t;
	}
	setInterpolation(e) {
		let t;
		switch (e) {
			case Zt:
				t = this.InterpolantFactoryMethodDiscrete;
				break;
			case Qt:
				t = this.InterpolantFactoryMethodLinear;
				break;
			case $t:
				t = this.InterpolantFactoryMethodSmooth;
				break;
			case en:
				t = this.InterpolantFactoryMethodBezier;
				break;
		}
		if (t === void 0) {
			let t = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
			if (this.createInterpolant === void 0) if (e !== this.DefaultInterpolation) this.setInterpolation(this.DefaultInterpolation);
			else throw Error(t);
			return B("KeyframeTrack:", t), this;
		}
		return this.createInterpolant = t, this;
	}
	getInterpolation() {
		switch (this.createInterpolant) {
			case this.InterpolantFactoryMethodDiscrete: return Zt;
			case this.InterpolantFactoryMethodLinear: return Qt;
			case this.InterpolantFactoryMethodSmooth: return $t;
			case this.InterpolantFactoryMethodBezier: return en;
		}
	}
	getValueSize() {
		return this.values.length / this.times.length;
	}
	shift(e) {
		if (e !== 0) {
			let t = this.times;
			for (let n = 0, r = t.length; n !== r; ++n) t[n] += e;
		}
		return this;
	}
	scale(e) {
		if (e !== 1) {
			let t = this.times;
			for (let n = 0, r = t.length; n !== r; ++n) t[n] *= e;
		}
		return this;
	}
	trim(e, t) {
		let n = this.times, r = n.length, i = 0, a = r - 1;
		for (; i !== r && n[i] < e;) ++i;
		for (; a !== -1 && n[a] > t;) --a;
		if (++a, i !== 0 || a !== r) {
			i >= a && (a = Math.max(a, 1), i = a - 1);
			let e = this.getValueSize();
			this.times = n.slice(i, a), this.values = this.values.slice(i * e, a * e);
		}
		return this;
	}
	validate() {
		let e = !0, t = this.getValueSize();
		t - Math.floor(t) !== 0 && (V("KeyframeTrack: Invalid value size in track.", this), e = !1);
		let n = this.times, r = this.values, i = n.length;
		i === 0 && (V("KeyframeTrack: Track is empty.", this), e = !1);
		let a = null;
		for (let t = 0; t !== i; t++) {
			let r = n[t];
			if (typeof r == "number" && isNaN(r)) {
				V("KeyframeTrack: Time is not a valid number.", this, t, r), e = !1;
				break;
			}
			if (a !== null && a > r) {
				V("KeyframeTrack: Out of order keys.", this, t, r, a), e = !1;
				break;
			}
			a = r;
		}
		if (r !== void 0 && mn(r)) for (let t = 0, n = r.length; t !== n; ++t) {
			let n = r[t];
			if (isNaN(n)) {
				V("KeyframeTrack: Value is not a valid number.", this, t, n), e = !1;
				break;
			}
		}
		return e;
	}
	optimize() {
		let e = this.times.slice(), t = this.values.slice(), n = this.getValueSize(), r = this.getInterpolation() === $t, i = e.length - 1, a = 1;
		for (let o = 1; o < i; ++o) {
			let i = !1, s = e[o];
			if (s !== e[o + 1] && (o !== 1 || s !== e[0])) if (r) i = !0;
			else {
				let e = o * n, r = e - n, a = e + n;
				for (let o = 0; o !== n; ++o) {
					let n = t[e + o];
					if (n !== t[r + o] || n !== t[a + o]) {
						i = !0;
						break;
					}
				}
			}
			if (i) {
				if (o !== a) {
					e[a] = e[o];
					let r = o * n, i = a * n;
					for (let e = 0; e !== n; ++e) t[i + e] = t[r + e];
				}
				++a;
			}
		}
		if (i > 0) {
			e[a] = e[i];
			for (let e = i * n, r = a * n, o = 0; o !== n; ++o) t[r + o] = t[e + o];
			++a;
		}
		return a === e.length ? (this.times = e, this.values = t) : (this.times = e.slice(0, a), this.values = t.slice(0, a * n)), this;
	}
	clone() {
		let e = this.times.slice(), t = this.values.slice(), n = this.constructor, r = new n(this.name, e, t);
		return r.createInterpolant = this.createInterpolant, r;
	}
};
To.prototype.ValueTypeName = "", To.prototype.TimeBufferType = Float32Array, To.prototype.ValueBufferType = Float32Array, To.prototype.DefaultInterpolation = Qt;
var Eo = class extends To {
	constructor(e, t, n) {
		super(e, t, n);
	}
};
Eo.prototype.ValueTypeName = "bool", Eo.prototype.ValueBufferType = Array, Eo.prototype.DefaultInterpolation = Zt, Eo.prototype.InterpolantFactoryMethodLinear = void 0, Eo.prototype.InterpolantFactoryMethodSmooth = void 0;
var Do = class extends To {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
Do.prototype.ValueTypeName = "color";
var Oo = class extends To {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
Oo.prototype.ValueTypeName = "number";
var ko = class extends bo {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = (n - t) / (r - t), c = e * o;
		for (let e = c + o; c !== e; c += 4) Xn.slerpFlat(i, 0, a, c - o, a, c, s);
		return i;
	}
}, Ao = class extends To {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	InterpolantFactoryMethodLinear(e) {
		return new ko(this.times, this.values, this.getValueSize(), e);
	}
};
Ao.prototype.ValueTypeName = "quaternion", Ao.prototype.InterpolantFactoryMethodSmooth = void 0;
var jo = class extends To {
	constructor(e, t, n) {
		super(e, t, n);
	}
};
jo.prototype.ValueTypeName = "string", jo.prototype.ValueBufferType = Array, jo.prototype.DefaultInterpolation = Zt, jo.prototype.InterpolantFactoryMethodLinear = void 0, jo.prototype.InterpolantFactoryMethodSmooth = void 0;
var Mo = class extends To {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
Mo.prototype.ValueTypeName = "vector";
var No = /*@__PURE__*/ new class {
	constructor(e, t, n) {
		let r = this, i = !1, a = 0, o = 0, s, c = [];
		this.onStart = void 0, this.onLoad = e, this.onProgress = t, this.onError = n, this._abortController = null, this.itemStart = function(e) {
			o++, i === !1 && r.onStart !== void 0 && r.onStart(e, a, o), i = !0;
		}, this.itemEnd = function(e) {
			a++, r.onProgress !== void 0 && r.onProgress(e, a, o), a === o && (i = !1, r.onLoad !== void 0 && r.onLoad());
		}, this.itemError = function(e) {
			r.onError !== void 0 && r.onError(e);
		}, this.resolveURL = function(e) {
			return e = e.normalize("NFC"), s ? s(e) : e;
		}, this.setURLModifier = function(e) {
			return s = e, this;
		}, this.addHandler = function(e, t) {
			return c.push(e, t), this;
		}, this.removeHandler = function(e) {
			let t = c.indexOf(e);
			return t !== -1 && c.splice(t, 2), this;
		}, this.getHandler = function(e) {
			for (let t = 0, n = c.length; t < n; t += 2) {
				let n = c[t], r = c[t + 1];
				if (n.global && (n.lastIndex = 0), n.test(e)) return r;
			}
			return null;
		}, this.abort = function() {
			return this.abortController.abort(), this._abortController = null, this;
		};
	}
	get abortController() {
		return this._abortController ||= new AbortController(), this._abortController;
	}
}(), Po = class {
	constructor(e) {
		this.manager = e === void 0 ? No : e, this.crossOrigin = "anonymous", this.withCredentials = !1, this.path = "", this.resourcePath = "", this.requestHeader = {}, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	load() {}
	loadAsync(e, t) {
		let n = this;
		return new Promise(function(r, i) {
			n.load(e, r, t, i);
		});
	}
	parse() {}
	setCrossOrigin(e) {
		return this.crossOrigin = e, this;
	}
	setWithCredentials(e) {
		return this.withCredentials = e, this;
	}
	setPath(e) {
		return this.path = e, this;
	}
	setResourcePath(e) {
		return this.resourcePath = e, this;
	}
	setRequestHeader(e) {
		return this.requestHeader = e, this;
	}
	abort() {
		return this;
	}
};
Po.DEFAULT_MATERIAL_NAME = "__DEFAULT";
var Fo = class extends Wr {
	constructor(e, t = 1) {
		super(), this.isLight = !0, this.type = "Light", this.color = new J(e), this.intensity = t;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	copy(e, t) {
		return super.copy(e, t), this.color.copy(e.color), this.intensity = e.intensity, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.color = this.color.getHex(), t.object.intensity = this.intensity, t;
	}
}, Io = /*@__PURE__*/ new q(), Lo = /*@__PURE__*/ new W(), Ro = /*@__PURE__*/ new W(), zo = class {
	constructor(e) {
		this.camera = e, this.intensity = 1, this.bias = 0, this.biasNode = null, this.normalBias = 0, this.radius = 1, this.blurSamples = 8, this.mapSize = new U(512, 512), this.mapType = Ke, this.map = null, this.mapPass = null, this.matrix = new q(), this.autoUpdate = !0, this.needsUpdate = !1, this._frustum = new Pa(), this._frameExtents = new U(1, 1), this._viewportCount = 1, this._viewports = [new pr(0, 0, 1, 1)];
	}
	getViewportCount() {
		return this._viewportCount;
	}
	getFrustum() {
		return this._frustum;
	}
	updateMatrices(e) {
		let t = this.camera, n = this.matrix;
		Lo.setFromMatrixPosition(e.matrixWorld), t.position.copy(Lo), Ro.setFromMatrixPosition(e.target.matrixWorld), t.lookAt(Ro), t.updateMatrixWorld(), Io.multiplyMatrices(t.projectionMatrix, t.matrixWorldInverse), this._frustum.setFromProjectionMatrix(Io, t.coordinateSystem, t.reversedDepth), t.coordinateSystem === 2001 || t.reversedDepth ? n.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, 1, 0, 0, 0, 0, 1) : n.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1), n.multiply(Io);
	}
	getViewport(e) {
		return this._viewports[e];
	}
	getFrameExtents() {
		return this._frameExtents;
	}
	dispose() {
		this.map && this.map.dispose(), this.mapPass && this.mapPass.dispose();
	}
	copy(e) {
		return this.camera = e.camera.clone(), this.intensity = e.intensity, this.bias = e.bias, this.radius = e.radius, this.autoUpdate = e.autoUpdate, this.needsUpdate = e.needsUpdate, this.normalBias = e.normalBias, this.blurSamples = e.blurSamples, this.mapSize.copy(e.mapSize), this.biasNode = e.biasNode, this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	toJSON() {
		let e = {};
		return this.intensity !== 1 && (e.intensity = this.intensity), this.bias !== 0 && (e.bias = this.bias), this.normalBias !== 0 && (e.normalBias = this.normalBias), this.radius !== 1 && (e.radius = this.radius), (this.mapSize.x !== 512 || this.mapSize.y !== 512) && (e.mapSize = this.mapSize.toArray()), e.camera = this.camera.toJSON(!1).object, delete e.camera.matrix, e;
	}
}, Bo = /*@__PURE__*/ new W(), Vo = /*@__PURE__*/ new Xn(), Ho = /*@__PURE__*/ new W(), Uo = class extends Wr {
	constructor() {
		super(), this.isCamera = !0, this.type = "Camera", this.matrixWorldInverse = new q(), this.projectionMatrix = new q(), this.projectionMatrixInverse = new q(), this.coordinateSystem = fn, this._reversedDepth = !1;
	}
	get reversedDepth() {
		return this._reversedDepth;
	}
	copy(e, t) {
		return super.copy(e, t), this.matrixWorldInverse.copy(e.matrixWorldInverse), this.projectionMatrix.copy(e.projectionMatrix), this.projectionMatrixInverse.copy(e.projectionMatrixInverse), this.coordinateSystem = e.coordinateSystem, this;
	}
	getWorldDirection(e) {
		return super.getWorldDirection(e).negate();
	}
	updateMatrixWorld(e) {
		super.updateMatrixWorld(e), this.matrixWorld.decompose(Bo, Vo, Ho), Ho.x === 1 && Ho.y === 1 && Ho.z === 1 ? this.matrixWorldInverse.copy(this.matrixWorld).invert() : this.matrixWorldInverse.compose(Bo, Vo, Ho.set(1, 1, 1)).invert();
	}
	updateWorldMatrix(e, t, n = !1) {
		super.updateWorldMatrix(e, t, n), this.matrixWorld.decompose(Bo, Vo, Ho), Ho.x === 1 && Ho.y === 1 && Ho.z === 1 ? this.matrixWorldInverse.copy(this.matrixWorld).invert() : this.matrixWorldInverse.compose(Bo, Vo, Ho.set(1, 1, 1)).invert();
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Wo = /*@__PURE__*/ new W(), Go = /*@__PURE__*/ new U(), Ko = /*@__PURE__*/ new U(), qo = class extends Uo {
	constructor(e = 50, t = 1, n = .1, r = 2e3) {
		super(), this.isPerspectiveCamera = !0, this.type = "PerspectiveCamera", this.fov = e, this.zoom = 1, this.near = n, this.far = r, this.focus = 10, this.aspect = t, this.view = null, this.filmGauge = 35, this.filmOffset = 0, this.updateProjectionMatrix();
	}
	copy(e, t) {
		return super.copy(e, t), this.fov = e.fov, this.zoom = e.zoom, this.near = e.near, this.far = e.far, this.focus = e.focus, this.aspect = e.aspect, this.view = e.view === null ? null : Object.assign({}, e.view), this.filmGauge = e.filmGauge, this.filmOffset = e.filmOffset, this;
	}
	setFocalLength(e) {
		let t = .5 * this.getFilmHeight() / e;
		this.fov = Dn * 2 * Math.atan(t), this.updateProjectionMatrix();
	}
	getFocalLength() {
		let e = Math.tan(En * .5 * this.fov);
		return .5 * this.getFilmHeight() / e;
	}
	getEffectiveFOV() {
		return Dn * 2 * Math.atan(Math.tan(En * .5 * this.fov) / this.zoom);
	}
	getFilmWidth() {
		return this.filmGauge * Math.min(this.aspect, 1);
	}
	getFilmHeight() {
		return this.filmGauge / Math.max(this.aspect, 1);
	}
	getViewBounds(e, t, n) {
		Wo.set(-1, -1, .5).applyMatrix4(this.projectionMatrixInverse), t.set(Wo.x, Wo.y).multiplyScalar(-e / Wo.z), Wo.set(1, 1, .5).applyMatrix4(this.projectionMatrixInverse), n.set(Wo.x, Wo.y).multiplyScalar(-e / Wo.z);
	}
	getViewSize(e, t) {
		return this.getViewBounds(e, Go, Ko), t.subVectors(Ko, Go);
	}
	setViewOffset(e, t, n, r, i, a) {
		this.aspect = e / t, this.view === null && (this.view = {
			enabled: !0,
			fullWidth: 1,
			fullHeight: 1,
			offsetX: 0,
			offsetY: 0,
			width: 1,
			height: 1
		}), this.view.enabled = !0, this.view.fullWidth = e, this.view.fullHeight = t, this.view.offsetX = n, this.view.offsetY = r, this.view.width = i, this.view.height = a, this.updateProjectionMatrix();
	}
	clearViewOffset() {
		this.view !== null && (this.view.enabled = !1), this.updateProjectionMatrix();
	}
	updateProjectionMatrix() {
		let e = this.near, t = e * Math.tan(En * .5 * this.fov) / this.zoom, n = 2 * t, r = this.aspect * n, i = -.5 * r, a = this.view;
		if (this.view !== null && this.view.enabled) {
			let e = a.fullWidth, o = a.fullHeight;
			i += a.offsetX * r / e, t -= a.offsetY * n / o, r *= a.width / e, n *= a.height / o;
		}
		let o = this.filmOffset;
		o !== 0 && (i += e * o / this.getFilmWidth()), this.projectionMatrix.makePerspective(i, i + r, t, t - n, e, this.far, this.coordinateSystem, this.reversedDepth), this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.fov = this.fov, t.object.zoom = this.zoom, t.object.near = this.near, t.object.far = this.far, t.object.focus = this.focus, t.object.aspect = this.aspect, this.view !== null && (t.object.view = Object.assign({}, this.view)), t.object.filmGauge = this.filmGauge, t.object.filmOffset = this.filmOffset, t;
	}
}, Jo = class extends zo {
	constructor() {
		super(new qo(50, 1, .5, 500)), this.isSpotLightShadow = !0, this.focus = 1, this.aspect = 1;
	}
	updateMatrices(e) {
		let t = this.camera, n = Dn * 2 * e.angle * this.focus, r = this.mapSize.width / this.mapSize.height * this.aspect, i = e.distance || t.far;
		(n !== t.fov || r !== t.aspect || i !== t.far) && (t.fov = n, t.aspect = r, t.far = i, t.updateProjectionMatrix()), super.updateMatrices(e);
	}
	copy(e) {
		return super.copy(e), this.focus = e.focus, this;
	}
}, Yo = class extends Fo {
	constructor(e, t, n = 0, r = Math.PI / 3, i = 0, a = 2) {
		super(e, t), this.isSpotLight = !0, this.type = "SpotLight", this.position.copy(Wr.DEFAULT_UP), this.updateMatrix(), this.target = new Wr(), this.distance = n, this.angle = r, this.penumbra = i, this.decay = a, this.map = null, this.shadow = new Jo();
	}
	get power() {
		return this.intensity * Math.PI;
	}
	set power(e) {
		this.intensity = e / Math.PI;
	}
	dispose() {
		super.dispose(), this.shadow.dispose();
	}
	copy(e, t) {
		return super.copy(e, t), this.distance = e.distance, this.angle = e.angle, this.penumbra = e.penumbra, this.decay = e.decay, this.target = e.target.clone(), this.map = e.map, this.shadow = e.shadow.clone(), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.distance = this.distance, t.object.angle = this.angle, t.object.decay = this.decay, t.object.penumbra = this.penumbra, t.object.target = this.target.uuid, this.map && this.map.isTexture && (t.object.map = this.map.toJSON(e).uuid), t.object.shadow = this.shadow.toJSON(), t;
	}
}, Xo = class extends Uo {
	constructor(e = -1, t = 1, n = 1, r = -1, i = .1, a = 2e3) {
		super(), this.isOrthographicCamera = !0, this.type = "OrthographicCamera", this.zoom = 1, this.view = null, this.left = e, this.right = t, this.top = n, this.bottom = r, this.near = i, this.far = a, this.updateProjectionMatrix();
	}
	copy(e, t) {
		return super.copy(e, t), this.left = e.left, this.right = e.right, this.top = e.top, this.bottom = e.bottom, this.near = e.near, this.far = e.far, this.zoom = e.zoom, this.view = e.view === null ? null : Object.assign({}, e.view), this;
	}
	setViewOffset(e, t, n, r, i, a) {
		this.view === null && (this.view = {
			enabled: !0,
			fullWidth: 1,
			fullHeight: 1,
			offsetX: 0,
			offsetY: 0,
			width: 1,
			height: 1
		}), this.view.enabled = !0, this.view.fullWidth = e, this.view.fullHeight = t, this.view.offsetX = n, this.view.offsetY = r, this.view.width = i, this.view.height = a, this.updateProjectionMatrix();
	}
	clearViewOffset() {
		this.view !== null && (this.view.enabled = !1), this.updateProjectionMatrix();
	}
	updateProjectionMatrix() {
		let e = (this.right - this.left) / (2 * this.zoom), t = (this.top - this.bottom) / (2 * this.zoom), n = (this.right + this.left) / 2, r = (this.top + this.bottom) / 2, i = n - e, a = n + e, o = r + t, s = r - t;
		if (this.view !== null && this.view.enabled) {
			let e = (this.right - this.left) / this.view.fullWidth / this.zoom, t = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
			i += e * this.view.offsetX, a = i + e * this.view.width, o -= t * this.view.offsetY, s = o - t * this.view.height;
		}
		this.projectionMatrix.makeOrthographic(i, a, o, s, this.near, this.far, this.coordinateSystem, this.reversedDepth), this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.zoom = this.zoom, t.object.left = this.left, t.object.right = this.right, t.object.top = this.top, t.object.bottom = this.bottom, t.object.near = this.near, t.object.far = this.far, this.view !== null && (t.object.view = Object.assign({}, this.view)), t;
	}
}, Zo = class extends zo {
	constructor() {
		super(new Xo(-5, 5, 5, -5, .5, 500)), this.isDirectionalLightShadow = !0;
	}
}, Qo = class extends Fo {
	constructor(e, t) {
		super(e, t), this.isDirectionalLight = !0, this.type = "DirectionalLight", this.position.copy(Wr.DEFAULT_UP), this.updateMatrix(), this.target = new Wr(), this.shadow = new Zo();
	}
	dispose() {
		super.dispose(), this.shadow.dispose();
	}
	copy(e) {
		return super.copy(e), this.target = e.target.clone(), this.shadow = e.shadow.clone(), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.shadow = this.shadow.toJSON(), t.object.target = this.target.uuid, t;
	}
}, $o = class extends Fo {
	constructor(e, t) {
		super(e, t), this.isAmbientLight = !0, this.type = "AmbientLight";
	}
}, es = -90, ts = 1, ns = class extends Wr {
	constructor(e, t, n) {
		super(), this.type = "CubeCamera", this.renderTarget = n, this.coordinateSystem = null, this.activeMipmapLevel = 0;
		let r = new qo(es, ts, e, t);
		r.layers = this.layers, this.add(r);
		let i = new qo(es, ts, e, t);
		i.layers = this.layers, this.add(i);
		let a = new qo(es, ts, e, t);
		a.layers = this.layers, this.add(a);
		let o = new qo(es, ts, e, t);
		o.layers = this.layers, this.add(o);
		let s = new qo(es, ts, e, t);
		s.layers = this.layers, this.add(s);
		let c = new qo(es, ts, e, t);
		c.layers = this.layers, this.add(c);
	}
	updateCoordinateSystem() {
		let e = this.coordinateSystem, t = this.children.concat(), [n, r, i, a, o, s] = t;
		for (let e of t) this.remove(e);
		if (e === 2e3) n.up.set(0, 1, 0), n.lookAt(1, 0, 0), r.up.set(0, 1, 0), r.lookAt(-1, 0, 0), i.up.set(0, 0, -1), i.lookAt(0, 1, 0), a.up.set(0, 0, 1), a.lookAt(0, -1, 0), o.up.set(0, 1, 0), o.lookAt(0, 0, 1), s.up.set(0, 1, 0), s.lookAt(0, 0, -1);
		else if (e === 2001) n.up.set(0, -1, 0), n.lookAt(-1, 0, 0), r.up.set(0, -1, 0), r.lookAt(1, 0, 0), i.up.set(0, 0, 1), i.lookAt(0, 1, 0), a.up.set(0, 0, -1), a.lookAt(0, -1, 0), o.up.set(0, -1, 0), o.lookAt(0, 0, 1), s.up.set(0, -1, 0), s.lookAt(0, 0, -1);
		else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " + e);
		for (let e of t) this.add(e), e.updateMatrixWorld();
	}
	update(e, t) {
		this.parent === null && this.updateMatrixWorld();
		let { renderTarget: n, activeMipmapLevel: r } = this;
		this.coordinateSystem !== e.coordinateSystem && (this.coordinateSystem = e.coordinateSystem, this.updateCoordinateSystem());
		let [i, a, o, s, c, l] = this.children, u = e.getRenderTarget(), d = e.getActiveCubeFace(), f = e.getActiveMipmapLevel(), p = e.xr.enabled;
		e.xr.enabled = !1;
		let m = n.texture.generateMipmaps;
		n.texture.generateMipmaps = !1;
		let h = !1;
		h = e.isWebGLRenderer === !0 ? e.state.buffers.depth.getReversed() : e.reversedDepthBuffer, e.setRenderTarget(n, 0, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, i), e.setRenderTarget(n, 1, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, a), e.setRenderTarget(n, 2, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, o), e.setRenderTarget(n, 3, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, s), e.setRenderTarget(n, 4, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, c), n.texture.generateMipmaps = m, e.setRenderTarget(n, 5, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, l), e.setRenderTarget(u, d, f), e.xr.enabled = p, n.texture.needsPMREMUpdate = !0;
	}
}, rs = class extends qo {
	constructor(e = []) {
		super(), this.isArrayCamera = !0, this.isMultiViewCamera = !1, this.cameras = e;
	}
}, is = "\\[\\]\\.:\\/", as = /* @__PURE__ */ RegExp("[\\[\\]\\.:\\/]", "g"), os = "[^\\[\\]\\.:\\/]", ss = "[^" + is.replace("\\.", "") + "]", cs = /*@__PURE__*/ "((?:WC+[\\/:])*)".replace("WC", os), ls = /*@__PURE__*/ "(WCOD+)?".replace("WCOD", ss), us = /*@__PURE__*/ "(?:\\.(WC+)(?:\\[(.+)\\])?)?".replace("WC", os), ds = /*@__PURE__*/ "\\.(WC+)(?:\\[(.+)\\])?".replace("WC", os), fs = RegExp("^" + cs + ls + us + ds + "$"), ps = [
	"material",
	"materials",
	"bones",
	"map"
], ms = class {
	constructor(e, t, n) {
		let r = n || hs.parseTrackName(t);
		this._targetGroup = e, this._bindings = e.subscribe_(t, r);
	}
	getValue(e, t) {
		this.bind();
		let n = this._targetGroup.nCachedObjects_, r = this._bindings[n];
		r !== void 0 && r.getValue(e, t);
	}
	setValue(e, t) {
		let n = this._bindings;
		for (let r = this._targetGroup.nCachedObjects_, i = n.length; r !== i; ++r) n[r].setValue(e, t);
	}
	bind() {
		let e = this._bindings;
		for (let t = this._targetGroup.nCachedObjects_, n = e.length; t !== n; ++t) e[t].bind();
	}
	unbind() {
		let e = this._bindings;
		for (let t = this._targetGroup.nCachedObjects_, n = e.length; t !== n; ++t) e[t].unbind();
	}
}, hs = class e {
	constructor(t, n, r) {
		this.path = n, this.parsedPath = r || e.parseTrackName(n), this.node = e.findNode(t, this.parsedPath.nodeName), this.rootNode = t, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
	}
	static create(t, n, r) {
		return t && t.isAnimationObjectGroup ? new e.Composite(t, n, r) : new e(t, n, r);
	}
	static sanitizeNodeName(e) {
		return e.replace(/\s/g, "_").replace(as, "");
	}
	static parseTrackName(e) {
		let t = fs.exec(e);
		if (t === null) throw Error("THREE.PropertyBinding: Cannot parse trackName: " + e);
		let n = {
			nodeName: t[2],
			objectName: t[3],
			objectIndex: t[4],
			propertyName: t[5],
			propertyIndex: t[6]
		}, r = n.nodeName && n.nodeName.lastIndexOf(".");
		if (r !== void 0 && r !== -1) {
			let e = n.nodeName.substring(r + 1);
			ps.indexOf(e) !== -1 && (n.nodeName = n.nodeName.substring(0, r), n.objectName = e);
		}
		if (n.propertyName === null || n.propertyName.length === 0) throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: " + e);
		return n;
	}
	static findNode(e, t) {
		if (t === void 0 || t === "" || t === "." || t === -1 || t === e.name || t === e.uuid) return e;
		if (e.skeleton) {
			let n = e.skeleton.getBoneByName(t);
			if (n !== void 0) return n;
		}
		if (e.children) {
			let n = function(e) {
				for (let r = 0; r < e.length; r++) {
					let i = e[r];
					if (i.name === t || i.uuid === t) return i;
					let a = n(i.children);
					if (a) return a;
				}
				return null;
			}, r = n(e.children);
			if (r) return r;
		}
		return null;
	}
	_getValue_unavailable() {}
	_setValue_unavailable() {}
	_getValue_direct(e, t) {
		e[t] = this.targetObject[this.propertyName];
	}
	_getValue_array(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) e[t++] = n[r];
	}
	_getValue_arrayElement(e, t) {
		e[t] = this.resolvedProperty[this.propertyIndex];
	}
	_getValue_toArray(e, t) {
		this.resolvedProperty.toArray(e, t);
	}
	_setValue_direct(e, t) {
		this.targetObject[this.propertyName] = e[t];
	}
	_setValue_direct_setNeedsUpdate(e, t) {
		this.targetObject[this.propertyName] = e[t], this.targetObject.needsUpdate = !0;
	}
	_setValue_direct_setMatrixWorldNeedsUpdate(e, t) {
		this.targetObject[this.propertyName] = e[t], this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_array(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
	}
	_setValue_array_setNeedsUpdate(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
		this.targetObject.needsUpdate = !0;
	}
	_setValue_array_setMatrixWorldNeedsUpdate(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
		this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_arrayElement(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t];
	}
	_setValue_arrayElement_setNeedsUpdate(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t], this.targetObject.needsUpdate = !0;
	}
	_setValue_arrayElement_setMatrixWorldNeedsUpdate(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t], this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_fromArray(e, t) {
		this.resolvedProperty.fromArray(e, t);
	}
	_setValue_fromArray_setNeedsUpdate(e, t) {
		this.resolvedProperty.fromArray(e, t), this.targetObject.needsUpdate = !0;
	}
	_setValue_fromArray_setMatrixWorldNeedsUpdate(e, t) {
		this.resolvedProperty.fromArray(e, t), this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_getValue_unbound(e, t) {
		this.bind(), this.getValue(e, t);
	}
	_setValue_unbound(e, t) {
		this.bind(), this.setValue(e, t);
	}
	bind() {
		let t = this.node, n = this.parsedPath, r = n.objectName, i = n.propertyName, a = n.propertyIndex;
		if (t || (t = e.findNode(this.rootNode, n.nodeName), this.node = t), this.getValue = this._getValue_unavailable, this.setValue = this._setValue_unavailable, !t) {
			B("PropertyBinding: No target node found for track: " + this.path + ".");
			return;
		}
		if (r) {
			let e = n.objectIndex;
			switch (r) {
				case "materials":
					if (!t.material) {
						V("PropertyBinding: Can not bind to material as node does not have a material.", this);
						return;
					}
					if (!t.material.materials) {
						V("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
						return;
					}
					t = t.material.materials;
					break;
				case "bones":
					if (!t.skeleton) {
						V("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
						return;
					}
					t = t.skeleton.bones;
					for (let n = 0; n < t.length; n++) if (t[n].name === e) {
						e = n;
						break;
					}
					break;
				case "map":
					if ("map" in t) {
						t = t.map;
						break;
					}
					if (!t.material) {
						V("PropertyBinding: Can not bind to material as node does not have a material.", this);
						return;
					}
					if (!t.material.map) {
						V("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
						return;
					}
					t = t.material.map;
					break;
				default:
					if (t[r] === void 0) {
						V("PropertyBinding: Can not bind to objectName of node undefined.", this);
						return;
					}
					t = t[r];
			}
			if (e !== void 0) {
				if (t[e] === void 0) {
					V("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, t);
					return;
				}
				t = t[e];
			}
		}
		let o = t[i];
		if (o === void 0) {
			let e = n.nodeName;
			V("PropertyBinding: Trying to update property for track: " + e + "." + i + " but it wasn't found.", t);
			return;
		}
		let s = this.Versioning.None;
		this.targetObject = t, t.isMaterial === !0 ? s = this.Versioning.NeedsUpdate : t.isObject3D === !0 && (s = this.Versioning.MatrixWorldNeedsUpdate);
		let c = this.BindingType.Direct;
		if (a !== void 0) {
			if (i === "morphTargetInfluences") {
				if (!t.geometry) {
					V("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
					return;
				}
				if (!t.geometry.morphAttributes) {
					V("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
					return;
				}
				t.morphTargetDictionary[a] !== void 0 && (a = t.morphTargetDictionary[a]);
			}
			c = this.BindingType.ArrayElement, this.resolvedProperty = o, this.propertyIndex = a;
		} else o.fromArray !== void 0 && o.toArray !== void 0 ? (c = this.BindingType.HasFromToArray, this.resolvedProperty = o) : Array.isArray(o) ? (c = this.BindingType.EntireArray, this.resolvedProperty = o) : this.propertyName = i;
		this.getValue = this.GetterByBindingType[c], this.setValue = this.SetterByBindingTypeAndVersioning[c][s];
	}
	unbind() {
		this.node = null, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
	}
};
hs.Composite = ms, hs.prototype.BindingType = {
	Direct: 0,
	EntireArray: 1,
	ArrayElement: 2,
	HasFromToArray: 3
}, hs.prototype.Versioning = {
	None: 0,
	NeedsUpdate: 1,
	MatrixWorldNeedsUpdate: 2
}, hs.prototype.GetterByBindingType = [
	hs.prototype._getValue_direct,
	hs.prototype._getValue_array,
	hs.prototype._getValue_arrayElement,
	hs.prototype._getValue_toArray
], hs.prototype.SetterByBindingTypeAndVersioning = [
	[
		hs.prototype._setValue_direct,
		hs.prototype._setValue_direct_setNeedsUpdate,
		hs.prototype._setValue_direct_setMatrixWorldNeedsUpdate
	],
	[
		hs.prototype._setValue_array,
		hs.prototype._setValue_array_setNeedsUpdate,
		hs.prototype._setValue_array_setMatrixWorldNeedsUpdate
	],
	[
		hs.prototype._setValue_arrayElement,
		hs.prototype._setValue_arrayElement_setNeedsUpdate,
		hs.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
	],
	[
		hs.prototype._setValue_fromArray,
		hs.prototype._setValue_fromArray_setNeedsUpdate,
		hs.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
	]
];
var gs = /*@__PURE__*/ new q(), _s = class {
	constructor(e, t, n = 0, r = Infinity) {
		this.ray = new na(e, t), this.near = n, this.far = r, this.camera = null, this.layers = new Or(), this.params = {
			Mesh: {},
			Line: { threshold: 1 },
			LOD: {},
			Points: { threshold: 1 },
			Sprite: {}
		};
	}
	set(e, t) {
		this.ray.set(e, t);
	}
	setFromCamera(e, t) {
		t.isPerspectiveCamera ? (this.ray.origin.setFromMatrixPosition(t.matrixWorld), this.ray.direction.set(e.x, e.y, .5).unproject(t).sub(this.ray.origin).normalize(), this.camera = t) : t.isOrthographicCamera ? (this.ray.origin.set(e.x, e.y, t.projectionMatrix.elements[14]).unproject(t), this.ray.direction.set(0, 0, -1).transformDirection(t.matrixWorld), this.camera = t) : V("Raycaster: Unsupported camera type: " + t.type);
	}
	setFromXRController(e) {
		return gs.identity().extractRotation(e.matrixWorld), this.ray.origin.setFromMatrixPosition(e.matrixWorld), this.ray.direction.set(0, 0, -1).applyMatrix4(gs), this;
	}
	intersectObject(e, t = !0, n = []) {
		return ys(e, this, n, t), n.sort(vs), n;
	}
	intersectObjects(e, t = !0, n = []) {
		for (let r = 0, i = e.length; r < i; r++) ys(e[r], this, n, t);
		return n.sort(vs), n;
	}
};
function vs(e, t) {
	return e.distance - t.distance;
}
function ys(e, t, n, r) {
	let i = !0;
	if (e.layers.test(t.layers) && e.raycast(t, n) === !1 && (i = !1), i === !0 && r === !0) {
		let r = e.children;
		for (let e = 0, i = r.length; e < i; e++) ys(r[e], t, n, !0);
	}
}
(class e {
	static {
		e.prototype.isMatrix2 = !0;
	}
	constructor(e, t, n, r) {
		this.elements = [
			1,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r);
	}
	identity() {
		return this.set(1, 0, 0, 1), this;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 4; n++) this.elements[n] = e[n + t];
		return this;
	}
	set(e, t, n, r) {
		let i = this.elements;
		return i[0] = e, i[2] = t, i[1] = n, i[3] = r, this;
	}
});
function bs(e, t, n, r) {
	let i = xs(r);
	switch (n) {
		case at: return e * t;
		case ut: return e * t / i.components * i.byteLength;
		case dt: return e * t / i.components * i.byteLength;
		case ft: return e * t * 2 / i.components * i.byteLength;
		case pt: return e * t * 2 / i.components * i.byteLength;
		case ot: return e * t * 3 / i.components * i.byteLength;
		case st: return e * t * 4 / i.components * i.byteLength;
		case mt: return e * t * 4 / i.components * i.byteLength;
		case ht:
		case gt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 8;
		case _t:
		case vt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case bt:
		case St: return Math.max(e, 16) * Math.max(t, 8) / 4;
		case yt:
		case xt: return Math.max(e, 8) * Math.max(t, 8) / 2;
		case Ct:
		case wt:
		case Et:
		case Dt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 8;
		case Tt:
		case Ot:
		case kt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case At: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case jt: return Math.floor((e + 4) / 5) * Math.floor((t + 3) / 4) * 16;
		case Mt: return Math.floor((e + 4) / 5) * Math.floor((t + 4) / 5) * 16;
		case Nt: return Math.floor((e + 5) / 6) * Math.floor((t + 4) / 5) * 16;
		case Pt: return Math.floor((e + 5) / 6) * Math.floor((t + 5) / 6) * 16;
		case Ft: return Math.floor((e + 7) / 8) * Math.floor((t + 4) / 5) * 16;
		case It: return Math.floor((e + 7) / 8) * Math.floor((t + 5) / 6) * 16;
		case Lt: return Math.floor((e + 7) / 8) * Math.floor((t + 7) / 8) * 16;
		case Rt: return Math.floor((e + 9) / 10) * Math.floor((t + 4) / 5) * 16;
		case zt: return Math.floor((e + 9) / 10) * Math.floor((t + 5) / 6) * 16;
		case Bt: return Math.floor((e + 9) / 10) * Math.floor((t + 7) / 8) * 16;
		case Vt: return Math.floor((e + 9) / 10) * Math.floor((t + 9) / 10) * 16;
		case Ht: return Math.floor((e + 11) / 12) * Math.floor((t + 9) / 10) * 16;
		case Ut: return Math.floor((e + 11) / 12) * Math.floor((t + 11) / 12) * 16;
		case Wt:
		case Gt:
		case Kt: return Math.ceil(e / 4) * Math.ceil(t / 4) * 16;
		case qt:
		case Jt: return Math.ceil(e / 4) * Math.ceil(t / 4) * 8;
		case Yt:
		case Xt: return Math.ceil(e / 4) * Math.ceil(t / 4) * 16;
	}
	throw Error(`Unable to determine texture byte length for ${n} format.`);
}
function xs(e) {
	switch (e) {
		case Ke:
		case qe: return {
			byteLength: 1,
			components: 1
		};
		case Ye:
		case Je:
		case $e: return {
			byteLength: 2,
			components: 1
		};
		case et:
		case tt: return {
			byteLength: 2,
			components: 4
		};
		case Ze:
		case Xe:
		case Qe: return {
			byteLength: 4,
			components: 1
		};
		case rt:
		case it: return {
			byteLength: 4,
			components: 3
		};
	}
	throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`);
}
typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: { revision: "185" } })), typeof window < "u" && (window.__THREE__ ? B("WARNING: Multiple instances of Three.js being imported.") : window.__THREE__ = "185");
//#endregion
//#region node_modules/three/build/three.module.js
function Ss() {
	let e = null, t = !1, n = null, r = null;
	function i(t, a) {
		n(t, a), r = e.requestAnimationFrame(i);
	}
	return {
		start: function() {
			t !== !0 && n !== null && e !== null && (r = e.requestAnimationFrame(i), t = !0);
		},
		stop: function() {
			e !== null && e.cancelAnimationFrame(r), t = !1;
		},
		setAnimationLoop: function(e) {
			n = e;
		},
		setContext: function(t) {
			e = t;
		}
	};
}
function Cs(e) {
	let t = /* @__PURE__ */ new WeakMap();
	function n(t, n) {
		let r = t.array, i = t.usage, a = r.byteLength, o = e.createBuffer();
		e.bindBuffer(n, o), e.bufferData(n, r, i), t.onUploadCallback();
		let s;
		if (r instanceof Float32Array) s = e.FLOAT;
		else if (typeof Float16Array < "u" && r instanceof Float16Array) s = e.HALF_FLOAT;
		else if (r instanceof Uint16Array) s = t.isFloat16BufferAttribute ? e.HALF_FLOAT : e.UNSIGNED_SHORT;
		else if (r instanceof Int16Array) s = e.SHORT;
		else if (r instanceof Uint32Array) s = e.UNSIGNED_INT;
		else if (r instanceof Int32Array) s = e.INT;
		else if (r instanceof Int8Array) s = e.BYTE;
		else if (r instanceof Uint8Array) s = e.UNSIGNED_BYTE;
		else if (r instanceof Uint8ClampedArray) s = e.UNSIGNED_BYTE;
		else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: " + r);
		return {
			buffer: o,
			type: s,
			bytesPerElement: r.BYTES_PER_ELEMENT,
			version: t.version,
			size: a
		};
	}
	function r(t, n, r) {
		let i = n.array, a = n.updateRanges;
		if (e.bindBuffer(r, t), a.length === 0) e.bufferSubData(r, 0, i);
		else {
			a.sort((e, t) => e.start - t.start);
			let t = 0;
			for (let e = 1; e < a.length; e++) {
				let n = a[t], r = a[e];
				r.start <= n.start + n.count + 1 ? n.count = Math.max(n.count, r.start + r.count - n.start) : (++t, a[t] = r);
			}
			a.length = t + 1;
			for (let t = 0, n = a.length; t < n; t++) {
				let n = a[t];
				e.bufferSubData(r, n.start * i.BYTES_PER_ELEMENT, i, n.start, n.count);
			}
			n.clearUpdateRanges();
		}
		n.onUploadCallback();
	}
	function i(e) {
		return e.isInterleavedBufferAttribute && (e = e.data), t.get(e);
	}
	function a(n) {
		n.isInterleavedBufferAttribute && (n = n.data);
		let r = t.get(n);
		r && (e.deleteBuffer(r.buffer), t.delete(n));
	}
	function o(e, i) {
		if (e.isInterleavedBufferAttribute && (e = e.data), e.isGLBufferAttribute) {
			let n = t.get(e);
			(!n || n.version < e.version) && t.set(e, {
				buffer: e.buffer,
				type: e.type,
				bytesPerElement: e.elementSize,
				version: e.version
			});
			return;
		}
		let a = t.get(e);
		if (a === void 0) t.set(e, n(e, i));
		else if (a.version < e.version) {
			if (a.size !== e.array.byteLength) throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");
			r(a.buffer, e, i), a.version = e.version;
		}
	}
	return {
		get: i,
		remove: a,
		update: o
	};
}
var Z = {
	alphahash_fragment: "#ifdef USE_ALPHAHASH\n	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;\n#endif",
	alphahash_pars_fragment: "#ifdef USE_ALPHAHASH\n	const float ALPHA_HASH_SCALE = 0.05;\n	float hash2D( vec2 value ) {\n		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );\n	}\n	float hash3D( vec3 value ) {\n		return hash2D( vec2( hash2D( value.xy ), value.z ) );\n	}\n	float getAlphaHashThreshold( vec3 position ) {\n		float maxDeriv = max(\n			length( dFdx( position.xyz ) ),\n			length( dFdy( position.xyz ) )\n		);\n		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );\n		vec2 pixScales = vec2(\n			exp2( floor( log2( pixScale ) ) ),\n			exp2( ceil( log2( pixScale ) ) )\n		);\n		vec2 alpha = vec2(\n			hash3D( floor( pixScales.x * position.xyz ) ),\n			hash3D( floor( pixScales.y * position.xyz ) )\n		);\n		float lerpFactor = fract( log2( pixScale ) );\n		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;\n		float a = min( lerpFactor, 1.0 - lerpFactor );\n		vec3 cases = vec3(\n			x * x / ( 2.0 * a * ( 1.0 - a ) ),\n			( x - 0.5 * a ) / ( 1.0 - a ),\n			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )\n		);\n		float threshold = ( x < ( 1.0 - a ) )\n			? ( ( x < a ) ? cases.x : cases.y )\n			: cases.z;\n		return clamp( threshold , 1.0e-6, 1.0 );\n	}\n#endif",
	alphamap_fragment: "#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;\n#endif",
	alphamap_pars_fragment: "#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif",
	alphatest_fragment: "#ifdef USE_ALPHATEST\n	#ifdef ALPHA_TO_COVERAGE\n	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );\n	if ( diffuseColor.a == 0.0 ) discard;\n	#else\n	if ( diffuseColor.a < alphaTest ) discard;\n	#endif\n#endif",
	alphatest_pars_fragment: "#ifdef USE_ALPHATEST\n	uniform float alphaTest;\n#endif",
	aomap_fragment: "#ifdef USE_AOMAP\n	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;\n	reflectedLight.indirectDiffuse *= ambientOcclusion;\n	#if defined( USE_CLEARCOAT ) \n		clearcoatSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_SHEEN ) \n		sheenSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( STANDARD )\n		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );\n		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );\n	#endif\n#endif",
	aomap_pars_fragment: "#ifdef USE_AOMAP\n	uniform sampler2D aoMap;\n	uniform float aoMapIntensity;\n#endif",
	batching_pars_vertex: "#ifdef USE_BATCHING\n	#if ! defined( GL_ANGLE_multi_draw )\n	#define gl_DrawID _gl_DrawID\n	uniform int _gl_DrawID;\n	#endif\n	uniform highp sampler2D batchingTexture;\n	uniform highp usampler2D batchingIdTexture;\n	mat4 getBatchingMatrix( const in float i ) {\n		int size = textureSize( batchingTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n	float getIndirectIndex( const in int i ) {\n		int size = textureSize( batchingIdTexture, 0 ).x;\n		int x = i % size;\n		int y = i / size;\n		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );\n	}\n#endif\n#ifdef USE_BATCHING_COLOR\n	uniform sampler2D batchingColorTexture;\n	vec4 getBatchingColor( const in float i ) {\n		int size = textureSize( batchingColorTexture, 0 ).x;\n		int j = int( i );\n		int x = j % size;\n		int y = j / size;\n		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );\n	}\n#endif",
	batching_vertex: "#ifdef USE_BATCHING\n	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );\n#endif",
	begin_vertex: "vec3 transformed = vec3( position );\n#ifdef USE_ALPHAHASH\n	vPosition = vec3( position );\n#endif",
	beginnormal_vertex: "vec3 objectNormal = vec3( normal );\n#ifdef USE_TANGENT\n	vec3 objectTangent = vec3( tangent.xyz );\n#endif",
	bsdfs: "float G_BlinnPhong_Implicit( ) {\n	return 0.25;\n}\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n}\nvec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( specularColor, 1.0, dotVH );\n	float G = G_BlinnPhong_Implicit( );\n	float D = D_BlinnPhong( shininess, dotNH );\n	return F * ( G * D );\n} // validated",
	iridescence_fragment: "#ifdef USE_IRIDESCENCE\n	const mat3 XYZ_TO_REC709 = mat3(\n		 3.2404542, -0.9692660,  0.0556434,\n		-1.5371385,  1.8760108, -0.2040259,\n		-0.4985314,  0.0415560,  1.0572252\n	);\n	vec3 Fresnel0ToIor( vec3 fresnel0 ) {\n		vec3 sqrtF0 = sqrt( fresnel0 );\n		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );\n	}\n	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );\n	}\n	float IorToFresnel0( float transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));\n	}\n	vec3 evalSensitivity( float OPD, vec3 shift ) {\n		float phase = 2.0 * PI * OPD * 1.0e-9;\n		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );\n		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );\n		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );\n		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );\n		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );\n		xyz /= 1.0685e-7;\n		vec3 rgb = XYZ_TO_REC709 * xyz;\n		return rgb;\n	}\n	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {\n		vec3 I;\n		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );\n		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );\n		float cosTheta2Sq = 1.0 - sinTheta2Sq;\n		if ( cosTheta2Sq < 0.0 ) {\n			return vec3( 1.0 );\n		}\n		float cosTheta2 = sqrt( cosTheta2Sq );\n		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );\n		float R12 = F_Schlick( R0, 1.0, cosTheta1 );\n		float T121 = 1.0 - R12;\n		float phi12 = 0.0;\n		if ( iridescenceIOR < outsideIOR ) phi12 = PI;\n		float phi21 = PI - phi12;\n		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );\n		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );\n		vec3 phi23 = vec3( 0.0 );\n		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;\n		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;\n		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;\n		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;\n		vec3 phi = vec3( phi21 ) + phi23;\n		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );\n		vec3 r123 = sqrt( R123 );\n		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );\n		vec3 C0 = R12 + Rs;\n		I = C0;\n		vec3 Cm = Rs - T121;\n		for ( int m = 1; m <= 2; ++ m ) {\n			Cm *= r123;\n			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );\n			I += Cm * Sm;\n		}\n		return max( I, vec3( 0.0 ) );\n	}\n#endif",
	bumpmap_pars_fragment: "#ifdef USE_BUMPMAP\n	uniform sampler2D bumpMap;\n	uniform float bumpScale;\n	vec2 dHdxy_fwd() {\n		vec2 dSTdx = dFdx( vBumpMapUv );\n		vec2 dSTdy = dFdy( vBumpMapUv );\n		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;\n		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;\n		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;\n		return vec2( dBx, dBy );\n	}\n	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {\n		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );\n		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );\n		vec3 vN = surf_norm;\n		vec3 R1 = cross( vSigmaY, vN );\n		vec3 R2 = cross( vN, vSigmaX );\n		float fDet = dot( vSigmaX, R1 ) * faceDirection;\n		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n		return normalize( abs( fDet ) * surf_norm - vGrad );\n	}\n#endif",
	clipping_planes_fragment: "#if NUM_CLIPPING_PLANES > 0\n	vec4 plane;\n	#ifdef ALPHA_TO_COVERAGE\n		float distanceToPlane, distanceGradient;\n		float clipOpacity = 1.0;\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n			distanceGradient = fwidth( distanceToPlane ) / 2.0;\n			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n			if ( clipOpacity == 0.0 ) discard;\n		}\n		#pragma unroll_loop_end\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n			float unionClipOpacity = 1.0;\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n				plane = clippingPlanes[ i ];\n				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n				distanceGradient = fwidth( distanceToPlane ) / 2.0;\n				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n			}\n			#pragma unroll_loop_end\n			clipOpacity *= 1.0 - unionClipOpacity;\n		#endif\n		diffuseColor.a *= clipOpacity;\n		if ( diffuseColor.a == 0.0 ) discard;\n	#else\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;\n		}\n		#pragma unroll_loop_end\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n			bool clipped = true;\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n				plane = clippingPlanes[ i ];\n				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;\n			}\n			#pragma unroll_loop_end\n			if ( clipped ) discard;\n		#endif\n	#endif\n#endif",
	clipping_planes_pars_fragment: "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n#endif",
	clipping_planes_pars_vertex: "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n#endif",
	clipping_planes_vertex: "#if NUM_CLIPPING_PLANES > 0\n	vClipPosition = - mvPosition.xyz;\n#endif",
	color_fragment: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n	diffuseColor *= vColor;\n#endif",
	color_pars_fragment: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n	varying vec4 vColor;\n#endif",
	color_pars_vertex: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n	varying vec4 vColor;\n#endif",
	color_vertex: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n	vColor = vec4( 1.0 );\n#endif\n#ifdef USE_COLOR_ALPHA\n	vColor *= color;\n#elif defined( USE_COLOR )\n	vColor.rgb *= color;\n#endif\n#ifdef USE_INSTANCING_COLOR\n	vColor.rgb *= instanceColor.rgb;\n#endif\n#ifdef USE_BATCHING_COLOR\n	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );\n#endif",
	common: "#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define PI_HALF 1.5707963267948966\n#define RECIPROCAL_PI 0.3183098861837907\n#define RECIPROCAL_PI2 0.15915494309189535\n#define EPSILON 1e-6\n#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n#define whiteComplement( a ) ( 1.0 - saturate( a ) )\nfloat pow2( const in float x ) { return x*x; }\nvec3 pow2( const in vec3 x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }\nfloat average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }\nhighp float rand( const in vec2 uv ) {\n	const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n	return fract( sin( sn ) * c );\n}\n#ifdef HIGH_PRECISION\n	float precisionSafeLength( vec3 v ) { return length( v ); }\n#else\n	float precisionSafeLength( vec3 v ) {\n		float maxComponent = max3( abs( v ) );\n		return length( v / maxComponent ) * maxComponent;\n	}\n#endif\nstruct IncidentLight {\n	vec3 color;\n	vec3 direction;\n	bool visible;\n};\nstruct ReflectedLight {\n	vec3 directDiffuse;\n	vec3 directSpecular;\n	vec3 indirectDiffuse;\n	vec3 indirectSpecular;\n};\n#ifdef USE_ALPHAHASH\n	varying vec3 vPosition;\n#endif\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n}\n#define inverseTransformDirection transformDirectionByInverseViewMatrix\nvec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {\n	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );\n}\nvec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {\n	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );\n}\nbool isPerspectiveMatrix( mat4 m ) {\n	return m[ 2 ][ 3 ] == - 1.0;\n}\nvec2 equirectUv( in vec3 dir ) {\n	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\n	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n	return vec2( u, v );\n}\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n	return RECIPROCAL_PI * diffuseColor;\n}\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n}\nfloat F_Schlick( const in float f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n} // validated",
	cube_uv_reflection_fragment: "#ifdef ENVMAP_TYPE_CUBE_UV\n	#define cubeUV_minMipLevel 4.0\n	#define cubeUV_minTileSize 16.0\n	float getFace( vec3 direction ) {\n		vec3 absDirection = abs( direction );\n		float face = - 1.0;\n		if ( absDirection.x > absDirection.z ) {\n			if ( absDirection.x > absDirection.y )\n				face = direction.x > 0.0 ? 0.0 : 3.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		} else {\n			if ( absDirection.z > absDirection.y )\n				face = direction.z > 0.0 ? 2.0 : 5.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		}\n		return face;\n	}\n	vec2 getUV( vec3 direction, float face ) {\n		vec2 uv;\n		if ( face == 0.0 ) {\n			uv = vec2( direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 1.0 ) {\n			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );\n		} else if ( face == 2.0 ) {\n			uv = vec2( - direction.x, direction.y ) / abs( direction.z );\n		} else if ( face == 3.0 ) {\n			uv = vec2( - direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 4.0 ) {\n			uv = vec2( - direction.x, direction.z ) / abs( direction.y );\n		} else {\n			uv = vec2( direction.x, direction.y ) / abs( direction.z );\n		}\n		return 0.5 * ( uv + 1.0 );\n	}\n	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {\n		float face = getFace( direction );\n		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );\n		mipInt = max( mipInt, cubeUV_minMipLevel );\n		float faceSize = exp2( mipInt );\n		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;\n		if ( face > 2.0 ) {\n			uv.y += faceSize;\n			face -= 3.0;\n		}\n		uv.x += face * faceSize;\n		uv.x += filterInt * 3.0 * cubeUV_minTileSize;\n		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );\n		uv.x *= CUBEUV_TEXEL_WIDTH;\n		uv.y *= CUBEUV_TEXEL_HEIGHT;\n		#ifdef texture2DGradEXT\n			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;\n		#else\n			return texture2D( envMap, uv ).rgb;\n		#endif\n	}\n	#define cubeUV_r0 1.0\n	#define cubeUV_m0 - 2.0\n	#define cubeUV_r1 0.8\n	#define cubeUV_m1 - 1.0\n	#define cubeUV_r4 0.4\n	#define cubeUV_m4 2.0\n	#define cubeUV_r5 0.305\n	#define cubeUV_m5 3.0\n	#define cubeUV_r6 0.21\n	#define cubeUV_m6 4.0\n	float roughnessToMip( float roughness ) {\n		float mip = 0.0;\n		if ( roughness >= cubeUV_r1 ) {\n			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;\n		} else if ( roughness >= cubeUV_r4 ) {\n			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;\n		} else if ( roughness >= cubeUV_r5 ) {\n			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;\n		} else if ( roughness >= cubeUV_r6 ) {\n			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;\n		} else {\n			mip = - 2.0 * log2( 1.16 * roughness );		}\n		return mip;\n	}\n	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {\n		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );\n		float mipF = fract( mip );\n		float mipInt = floor( mip );\n		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );\n		if ( mipF == 0.0 ) {\n			return vec4( color0, 1.0 );\n		} else {\n			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );\n			return vec4( mix( color0, color1, mipF ), 1.0 );\n		}\n	}\n#endif",
	defaultnormal_vertex: "vec3 transformedNormal = objectNormal;\n#ifdef USE_TANGENT\n	vec3 transformedTangent = objectTangent;\n#endif\n#ifdef USE_BATCHING\n	mat3 bm = mat3( batchingMatrix );\n	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );\n	transformedNormal = bm * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = bm * transformedTangent;\n	#endif\n#endif\n#ifdef USE_INSTANCING\n	mat3 im = mat3( instanceMatrix );\n	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );\n	transformedNormal = im * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = im * transformedTangent;\n	#endif\n#endif\ntransformedNormal = normalMatrix * transformedNormal;\n#ifdef FLIP_SIDED\n	transformedNormal = - transformedNormal;\n#endif\n#ifdef USE_TANGENT\n	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;\n#endif",
	displacementmap_pars_vertex: "#ifdef USE_DISPLACEMENTMAP\n	uniform sampler2D displacementMap;\n	uniform float displacementScale;\n	uniform float displacementBias;\n#endif",
	displacementmap_vertex: "#ifdef USE_DISPLACEMENTMAP\n	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );\n#endif",
	emissivemap_fragment: "#ifdef USE_EMISSIVEMAP\n	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE\n		emissiveColor = sRGBTransferEOTF( emissiveColor );\n	#endif\n	totalEmissiveRadiance *= emissiveColor.rgb;\n#endif",
	emissivemap_pars_fragment: "#ifdef USE_EMISSIVEMAP\n	uniform sampler2D emissiveMap;\n#endif",
	colorspace_fragment: "gl_FragColor = linearToOutputTexel( gl_FragColor );",
	colorspace_pars_fragment: "vec4 LinearTransferOETF( in vec4 value ) {\n	return value;\n}\nvec4 sRGBTransferEOTF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );\n}\nvec4 sRGBTransferOETF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\n}",
	envmap_fragment: "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vec3 cameraToFrag;\n		if ( isOrthographic ) {\n			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToFrag = normalize( vWorldPosition - cameraPosition );\n		}\n		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vec3 reflectVec = reflect( cameraToFrag, worldNormal );\n		#else\n			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );\n		#endif\n	#else\n		vec3 reflectVec = vReflect;\n	#endif\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );\n		#ifdef ENVMAP_BLENDING_MULTIPLY\n			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n		#elif defined( ENVMAP_BLENDING_MIX )\n			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n		#elif defined( ENVMAP_BLENDING_ADD )\n			outgoingLight += envColor.xyz * specularStrength * reflectivity;\n		#endif\n	#endif\n#endif",
	envmap_common_pars_fragment: "#ifdef USE_ENVMAP\n	uniform float envMapIntensity;\n	uniform mat3 envMapRotation;\n	#ifdef ENVMAP_TYPE_CUBE\n		uniform samplerCube envMap;\n	#else\n		uniform sampler2D envMap;\n	#endif\n#endif",
	envmap_pars_fragment: "#ifdef USE_ENVMAP\n	uniform float reflectivity;\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		varying vec3 vWorldPosition;\n		uniform float refractionRatio;\n	#else\n		varying vec3 vReflect;\n	#endif\n#endif",
	envmap_pars_vertex: "#ifdef USE_ENVMAP\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		\n		varying vec3 vWorldPosition;\n	#else\n		varying vec3 vReflect;\n		uniform float refractionRatio;\n	#endif\n#endif",
	envmap_physical_pars_fragment: "#ifdef USE_ENVMAP\n	vec3 getIBLIrradiance( const in vec3 normal ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );\n			return PI * envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 reflectVec = reflect( - viewDir, normal );\n			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );\n			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );\n			return envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	#ifdef USE_ANISOTROPY\n		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {\n			#ifdef ENVMAP_TYPE_CUBE_UV\n				vec3 bentNormal = cross( bitangent, viewDir );\n				bentNormal = normalize( cross( bentNormal, bitangent ) );\n				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );\n				return getIBLRadiance( viewDir, bentNormal, roughness );\n			#else\n				return vec3( 0.0 );\n			#endif\n		}\n	#endif\n#endif",
	envmap_vertex: "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vWorldPosition = worldPosition.xyz;\n	#else\n		vec3 cameraToVertex;\n		if ( isOrthographic ) {\n			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n		}\n		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vReflect = reflect( cameraToVertex, worldNormal );\n		#else\n			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n		#endif\n	#endif\n#endif",
	fog_vertex: "#ifdef USE_FOG\n	vFogDepth = - mvPosition.z;\n#endif",
	fog_pars_vertex: "#ifdef USE_FOG\n	varying float vFogDepth;\n#endif",
	fog_fragment: "#ifdef USE_FOG\n	#ifdef FOG_EXP2\n		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n	#else\n		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n	#endif\n	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif",
	fog_pars_fragment: "#ifdef USE_FOG\n	uniform vec3 fogColor;\n	varying float vFogDepth;\n	#ifdef FOG_EXP2\n		uniform float fogDensity;\n	#else\n		uniform float fogNear;\n		uniform float fogFar;\n	#endif\n#endif",
	gradientmap_pars_fragment: "#ifdef USE_GRADIENTMAP\n	uniform sampler2D gradientMap;\n#endif\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n	float dotNL = dot( normal, lightDirection );\n	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n	#ifdef USE_GRADIENTMAP\n		return vec3( texture2D( gradientMap, coord ).r );\n	#else\n		vec2 fw = fwidth( coord ) * 0.5;\n		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );\n	#endif\n}",
	lightmap_pars_fragment: "#ifdef USE_LIGHTMAP\n	uniform sampler2D lightMap;\n	uniform float lightMapIntensity;\n#endif",
	lights_lambert_fragment: "LambertMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularStrength = specularStrength;",
	lights_lambert_pars_fragment: "varying vec3 vViewPosition;\nstruct LambertMaterial {\n	vec3 diffuseColor;\n	float specularStrength;\n};\nvoid RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Lambert\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert",
	lights_pars_begin: "uniform bool receiveShadow;\nuniform vec3 ambientLightColor;\n#if defined( USE_LIGHT_PROBES )\n	uniform vec3 lightProbe[ 9 ];\n#endif\nvec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {\n	float x = normal.x, y = normal.y, z = normal.z;\n	vec3 result = shCoefficients[ 0 ] * 0.886227;\n	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;\n	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;\n	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;\n	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;\n	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;\n	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );\n	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;\n	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );\n	return result;\n}\nvec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {\n	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );\n	return irradiance;\n}\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n	vec3 irradiance = ambientLightColor;\n	return irradiance;\n}\nfloat getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n	if ( cutoffDistance > 0.0 ) {\n		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n	}\n	return distanceFalloff;\n}\nfloat getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {\n	return smoothstep( coneCosine, penumbraCosine, angleCosine );\n}\n#if NUM_DIR_LIGHTS > 0\n	struct DirectionalLight {\n		vec3 direction;\n		vec3 color;\n	};\n	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {\n		light.color = directionalLight.color;\n		light.direction = directionalLight.direction;\n		light.visible = true;\n	}\n#endif\n#if NUM_POINT_LIGHTS > 0\n	struct PointLight {\n		vec3 position;\n		vec3 color;\n		float distance;\n		float decay;\n	};\n	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = pointLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float lightDistance = length( lVector );\n		light.color = pointLight.color;\n		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );\n		light.visible = ( light.color != vec3( 0.0 ) );\n	}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n	struct SpotLight {\n		vec3 position;\n		vec3 direction;\n		vec3 color;\n		float distance;\n		float decay;\n		float coneCos;\n		float penumbraCos;\n	};\n	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = spotLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float angleCos = dot( light.direction, spotLight.direction );\n		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n		if ( spotAttenuation > 0.0 ) {\n			float lightDistance = length( lVector );\n			light.color = spotLight.color * spotAttenuation;\n			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );\n			light.visible = ( light.color != vec3( 0.0 ) );\n		} else {\n			light.color = vec3( 0.0 );\n			light.visible = false;\n		}\n	}\n#endif\n#if NUM_RECT_AREA_LIGHTS > 0\n	struct RectAreaLight {\n		vec3 color;\n		vec3 position;\n		vec3 halfWidth;\n		vec3 halfHeight;\n	};\n	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;\n	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n#endif\n#if NUM_HEMI_LIGHTS > 0\n	struct HemisphereLight {\n		vec3 direction;\n		vec3 skyColor;\n		vec3 groundColor;\n	};\n	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {\n		float dotNL = dot( normal, hemiLight.direction );\n		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n		return irradiance;\n	}\n#endif\n#include <lightprobes_pars_fragment>",
	lights_toon_fragment: "ToonMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;",
	lights_toon_pars_fragment: "varying vec3 vViewPosition;\nstruct ToonMaterial {\n	vec3 diffuseColor;\n};\nvoid RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Toon\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon",
	lights_phong_fragment: "BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;",
	lights_phong_pars_fragment: "varying vec3 vViewPosition;\nstruct BlinnPhongMaterial {\n	vec3 diffuseColor;\n	vec3 specularColor;\n	float specularShininess;\n	float specularStrength;\n};\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;\n}\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_BlinnPhong\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong",
	lights_physical_fragment: "PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );\nmaterial.metalness = metalnessFactor;\nvec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );\nmaterial.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;\nmaterial.roughness = min( material.roughness, 1.0 );\n#ifdef IOR\n	material.ior = ior;\n	#ifdef USE_SPECULAR\n		float specularIntensityFactor = specularIntensity;\n		vec3 specularColorFactor = specularColor;\n		#ifdef USE_SPECULAR_COLORMAP\n			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;\n		#endif\n		#ifdef USE_SPECULAR_INTENSITYMAP\n			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;\n		#endif\n		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );\n	#else\n		float specularIntensityFactor = 1.0;\n		vec3 specularColorFactor = vec3( 1.0 );\n		material.specularF90 = 1.0;\n	#endif\n	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;\n	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );\n#else\n	material.specularColor = vec3( 0.04 );\n	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );\n	material.specularF90 = 1.0;\n#endif\n#ifdef USE_CLEARCOAT\n	material.clearcoat = clearcoat;\n	material.clearcoatRoughness = clearcoatRoughness;\n	material.clearcoatF0 = vec3( 0.04 );\n	material.clearcoatF90 = 1.0;\n	#ifdef USE_CLEARCOATMAP\n		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;\n	#endif\n	#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;\n	#endif\n	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );\n	material.clearcoatRoughness += geometryRoughness;\n	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );\n#endif\n#ifdef USE_DISPERSION\n	material.dispersion = dispersion;\n#endif\n#ifdef USE_IRIDESCENCE\n	material.iridescence = iridescence;\n	material.iridescenceIOR = iridescenceIOR;\n	#ifdef USE_IRIDESCENCEMAP\n		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;\n	#endif\n	#ifdef USE_IRIDESCENCE_THICKNESSMAP\n		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;\n	#else\n		material.iridescenceThickness = iridescenceThicknessMaximum;\n	#endif\n#endif\n#ifdef USE_SHEEN\n	material.sheenColor = sheenColor;\n	#ifdef USE_SHEEN_COLORMAP\n		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;\n	#endif\n	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	#ifdef USE_ANISOTROPYMAP\n		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );\n		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;\n		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;\n	#else\n		vec2 anisotropyV = anisotropyVector;\n	#endif\n	material.anisotropy = length( anisotropyV );\n	if( material.anisotropy == 0.0 ) {\n		anisotropyV = vec2( 1.0, 0.0 );\n	} else {\n		anisotropyV /= material.anisotropy;\n		material.anisotropy = saturate( material.anisotropy );\n	}\n	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );\n	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;\n	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;\n#endif",
	lights_physical_pars_fragment: "uniform sampler2D dfgLUT;\nstruct PhysicalMaterial {\n	vec3 diffuseColor;\n	vec3 diffuseContribution;\n	vec3 specularColor;\n	vec3 specularColorBlended;\n	float roughness;\n	float metalness;\n	float specularF90;\n	float dispersion;\n	#ifdef USE_CLEARCOAT\n		float clearcoat;\n		float clearcoatRoughness;\n		vec3 clearcoatF0;\n		float clearcoatF90;\n	#endif\n	#ifdef USE_IRIDESCENCE\n		float iridescence;\n		float iridescenceIOR;\n		float iridescenceThickness;\n		vec3 iridescenceFresnel;\n		vec3 iridescenceF0;\n		vec3 iridescenceFresnelDielectric;\n		vec3 iridescenceFresnelMetallic;\n	#endif\n	#ifdef USE_SHEEN\n		vec3 sheenColor;\n		float sheenRoughness;\n	#endif\n	#ifdef IOR\n		float ior;\n	#endif\n	#ifdef USE_TRANSMISSION\n		float transmission;\n		float transmissionAlpha;\n		float thickness;\n		float attenuationDistance;\n		vec3 attenuationColor;\n	#endif\n	#ifdef USE_ANISOTROPY\n		float anisotropy;\n		float alphaT;\n		vec3 anisotropyT;\n		vec3 anisotropyB;\n	#endif\n};\nvec3 clearcoatSpecularDirect = vec3( 0.0 );\nvec3 clearcoatSpecularIndirect = vec3( 0.0 );\nvec3 sheenSpecularDirect = vec3( 0.0 );\nvec3 sheenSpecularIndirect = vec3(0.0 );\nvec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {\n    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );\n    float x2 = x * x;\n    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );\n    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );\n}\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\n	float a2 = pow2( alpha );\n	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n	return 0.5 / max( gv + gl, EPSILON );\n}\nfloat D_GGX( const in float alpha, const in float dotNH ) {\n	float a2 = pow2( alpha );\n	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;\n	return RECIPROCAL_PI * a2 / pow2( denom );\n}\n#ifdef USE_ANISOTROPY\n	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {\n		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );\n		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );\n		return 0.5 / max( gv + gl, EPSILON );\n	}\n	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {\n		float a2 = alphaT * alphaB;\n		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );\n		highp float v2 = dot( v, v );\n		float w2 = a2 / v2;\n		return RECIPROCAL_PI * a2 * pow2 ( w2 );\n	}\n#endif\n#ifdef USE_CLEARCOAT\n	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {\n		vec3 f0 = material.clearcoatF0;\n		float f90 = material.clearcoatF90;\n		float roughness = material.clearcoatRoughness;\n		float alpha = pow2( roughness );\n		vec3 halfDir = normalize( lightDir + viewDir );\n		float dotNL = saturate( dot( normal, lightDir ) );\n		float dotNV = saturate( dot( normal, viewDir ) );\n		float dotNH = saturate( dot( normal, halfDir ) );\n		float dotVH = saturate( dot( viewDir, halfDir ) );\n		vec3 F = F_Schlick( f0, f90, dotVH );\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n		return F * ( V * D );\n	}\n#endif\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {\n	vec3 f0 = material.specularColorBlended;\n	float f90 = material.specularF90;\n	float roughness = material.roughness;\n	float alpha = pow2( roughness );\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( f0, f90, dotVH );\n	#ifdef USE_IRIDESCENCE\n		F = mix( F, material.iridescenceFresnel, material.iridescence );\n	#endif\n	#ifdef USE_ANISOTROPY\n		float dotTL = dot( material.anisotropyT, lightDir );\n		float dotTV = dot( material.anisotropyT, viewDir );\n		float dotTH = dot( material.anisotropyT, halfDir );\n		float dotBL = dot( material.anisotropyB, lightDir );\n		float dotBV = dot( material.anisotropyB, viewDir );\n		float dotBH = dot( material.anisotropyB, halfDir );\n		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );\n		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );\n	#else\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n	#endif\n	return F * ( V * D );\n}\nvec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {\n	const float LUT_SIZE = 64.0;\n	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;\n	const float LUT_BIAS = 0.5 / LUT_SIZE;\n	float dotNV = saturate( dot( N, V ) );\n	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );\n	uv = uv * LUT_SCALE + LUT_BIAS;\n	return uv;\n}\nfloat LTC_ClippedSphereFormFactor( const in vec3 f ) {\n	float l = length( f );\n	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );\n}\nvec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {\n	float x = dot( v1, v2 );\n	float y = abs( x );\n	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;\n	float b = 3.4175940 + ( 4.1616724 + y ) * y;\n	float v = a / b;\n	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;\n	return cross( v1, v2 ) * theta_sintheta;\n}\nvec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {\n	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];\n	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];\n	vec3 lightNormal = cross( v1, v2 );\n	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );\n	vec3 T1, T2;\n	T1 = normalize( V - N * dot( V, N ) );\n	T2 = - cross( N, T1 );\n	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );\n	vec3 coords[ 4 ];\n	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );\n	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );\n	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );\n	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );\n	coords[ 0 ] = normalize( coords[ 0 ] );\n	coords[ 1 ] = normalize( coords[ 1 ] );\n	coords[ 2 ] = normalize( coords[ 2 ] );\n	coords[ 3 ] = normalize( coords[ 3 ] );\n	vec3 vectorFormFactor = vec3( 0.0 );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );\n	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );\n	return vec3( result );\n}\n#if defined( USE_SHEEN )\nfloat D_Charlie( float roughness, float dotNH ) {\n	float alpha = pow2( roughness );\n	float invAlpha = 1.0 / alpha;\n	float cos2h = dotNH * dotNH;\n	float sin2h = max( 1.0 - cos2h, 0.0078125 );\n	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );\n}\nfloat V_Neubelt( float dotNV, float dotNL ) {\n	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );\n}\nvec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float D = D_Charlie( sheenRoughness, dotNH );\n	float V = V_Neubelt( dotNV, dotNL );\n	return sheenColor * ( D * V );\n}\n#endif\nfloat IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float r2 = roughness * roughness;\n	float rInv = 1.0 / ( roughness + 0.1 );\n	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;\n	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;\n	float DG = exp( a * dotNV + b );\n	return saturate( DG );\n}\nvec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;\n	return specularColor * fab.x + specularF90 * fab.y;\n}\n#ifdef USE_IRIDESCENCE\nvoid computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#else\nvoid computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#endif\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;\n	#ifdef USE_IRIDESCENCE\n		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );\n	#else\n		vec3 Fr = specularColor;\n	#endif\n	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;\n	float Ess = fab.x + fab.y;\n	float Ems = 1.0 - Ess;\n	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );\n	singleScatter += FssEss;\n	multiScatter += Fms * Ems;\n}\nvec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {\n	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;\n	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;\n	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;\n	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;\n	float Ess_V = dfgV.x + dfgV.y;\n	float Ess_L = dfgL.x + dfgL.y;\n	float Ems_V = 1.0 - Ess_V;\n	float Ems_L = 1.0 - Ess_L;\n	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;\n	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );\n	float compensationFactor = Ems_V * Ems_L;\n	vec3 multiScatter = Fms * compensationFactor;\n	return singleScatter + multiScatter;\n}\n#if NUM_RECT_AREA_LIGHTS > 0\n	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n		vec3 normal = geometryNormal;\n		vec3 viewDir = geometryViewDir;\n		vec3 position = geometryPosition;\n		vec3 lightPos = rectAreaLight.position;\n		vec3 halfWidth = rectAreaLight.halfWidth;\n		vec3 halfHeight = rectAreaLight.halfHeight;\n		vec3 lightColor = rectAreaLight.color;\n		float roughness = material.roughness;\n		vec3 rectCoords[ 4 ];\n		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;\n		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;\n		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;\n		vec2 uv = LTC_Uv( normal, viewDir, roughness );\n		vec4 t1 = texture2D( ltc_1, uv );\n		vec4 t2 = texture2D( ltc_2, uv );\n		mat3 mInv = mat3(\n			vec3( t1.x, 0, t1.y ),\n			vec3(    0, 1,    0 ),\n			vec3( t1.z, 0, t1.w )\n		);\n		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );\n		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );\n		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );\n		#ifdef USE_CLEARCOAT\n			vec3 Ncc = geometryClearcoatNormal;\n			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );\n			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );\n			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );\n			mat3 mInvClearcoat = mat3(\n				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),\n				vec3(             0, 1,             0 ),\n				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )\n			);\n			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;\n			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );\n		#endif\n	}\n#endif\nvoid RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	#ifdef USE_CLEARCOAT\n		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );\n		vec3 ccIrradiance = dotNLcc * directLight.color;\n		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );\n	#endif\n	#ifdef USE_SHEEN\n \n 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );\n \n 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );\n \n 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );\n \n 		irradiance *= sheenEnergyComp;\n \n 	#endif\n	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );\n}\nvoid RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );\n	#ifdef USE_SHEEN\n		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;\n		diffuse *= sheenEnergyComp;\n	#endif\n	reflectedLight.indirectDiffuse += diffuse;\n}\nvoid RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\n	#ifdef USE_CLEARCOAT\n		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );\n	#endif\n	#ifdef USE_SHEEN\n		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;\n 	#endif\n	vec3 singleScatteringDielectric = vec3( 0.0 );\n	vec3 multiScatteringDielectric = vec3( 0.0 );\n	vec3 singleScatteringMetallic = vec3( 0.0 );\n	vec3 multiScatteringMetallic = vec3( 0.0 );\n	#ifdef USE_IRIDESCENCE\n		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );\n		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );\n	#else\n		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );\n		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );\n	#endif\n	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );\n	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );\n	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;\n	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );\n	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;\n	vec3 indirectSpecular = radiance * singleScattering;\n	indirectSpecular += multiScattering * cosineWeightedIrradiance;\n	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;\n	#ifdef USE_SHEEN\n		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;\n		indirectSpecular *= sheenEnergyComp;\n		indirectDiffuse *= sheenEnergyComp;\n	#endif\n	reflectedLight.indirectSpecular += indirectSpecular;\n	reflectedLight.indirectDiffuse += indirectDiffuse;\n}\n#define RE_Direct				RE_Direct_Physical\n#define RE_Direct_RectArea		RE_Direct_RectArea_Physical\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical\n#define RE_IndirectSpecular		RE_IndirectSpecular_Physical\nfloat computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {\n	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );\n}",
	lights_fragment_begin: "\nvec3 geometryPosition = - vViewPosition;\nvec3 geometryNormal = normal;\nvec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\nvec3 geometryClearcoatNormal = vec3( 0.0 );\n#ifdef USE_CLEARCOAT\n	geometryClearcoatNormal = clearcoatNormal;\n#endif\n#ifdef USE_IRIDESCENCE\n	float dotNVi = saturate( dot( normal, geometryViewDir ) );\n	if ( material.iridescenceThickness == 0.0 ) {\n		material.iridescence = 0.0;\n	} else {\n		material.iridescence = saturate( material.iridescence );\n	}\n	if ( material.iridescence > 0.0 ) {\n		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );\n		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );\n		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );\n		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );\n	}\n#endif\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n	PointLight pointLight;\n	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n		pointLight = pointLights[ i ];\n		getPointLightInfo( pointLight, geometryPosition, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )\n		pointLightShadow = pointLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n	SpotLight spotLight;\n	vec4 spotColor;\n	vec3 spotLightCoord;\n	bool inSpotLightMap;\n	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n		spotLight = spotLights[ i ];\n		getSpotLightInfo( spotLight, geometryPosition, directLight );\n		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX\n		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS\n		#else\n		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#endif\n		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )\n			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;\n			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );\n			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );\n			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;\n		#endif\n		#undef SPOT_LIGHT_MAP_INDEX\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		spotLightShadow = spotLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n	DirectionalLight directionalLight;\n	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n		directionalLight = directionalLights[ i ];\n		getDirectionalLightInfo( directionalLight, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n		directionalLightShadow = directionalLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n	RectAreaLight rectAreaLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n		rectAreaLight = rectAreaLights[ i ];\n		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if defined( RE_IndirectDiffuse )\n	vec3 iblIrradiance = vec3( 0.0 );\n	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n	#if defined( USE_LIGHT_PROBES )\n		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n	#endif\n	#if ( NUM_HEMI_LIGHTS > 0 )\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n		}\n		#pragma unroll_loop_end\n	#endif\n	#ifdef USE_LIGHT_PROBES_GRID\n		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;\n		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );\n		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );\n	#endif\n#endif\n#if defined( RE_IndirectSpecular )\n	vec3 radiance = vec3( 0.0 );\n	vec3 clearcoatRadiance = vec3( 0.0 );\n#endif",
	lights_fragment_maps: "#if defined( RE_IndirectDiffuse )\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n		irradiance += lightMapIrradiance;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\n		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )\n			iblIrradiance += getIBLIrradiance( geometryNormal );\n		#endif\n	#endif\n#endif\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n	#ifdef USE_ANISOTROPY\n		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );\n	#else\n		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );\n	#endif\n	#ifdef USE_CLEARCOAT\n		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );\n	#endif\n#endif",
	lights_fragment_end: "#if defined( RE_IndirectDiffuse )\n	#if defined( LAMBERT ) || defined( PHONG )\n		irradiance += iblIrradiance;\n	#endif\n	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif\n#if defined( RE_IndirectSpecular )\n	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif",
	lightprobes_pars_fragment: "#ifdef USE_LIGHT_PROBES_GRID\nuniform highp sampler3D probesSH;\nuniform vec3 probesMin;\nuniform vec3 probesMax;\nuniform vec3 probesResolution;\nvec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {\n	vec3 res = probesResolution;\n	vec3 gridRange = probesMax - probesMin;\n	vec3 resMinusOne = res - 1.0;\n	vec3 probeSpacing = gridRange / resMinusOne;\n	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;\n	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );\n	uvw = uvw * resMinusOne / res + 0.5 / res;\n	float nz          = res.z;\n	float paddedSlices = nz + 2.0;\n	float atlasDepth  = 7.0 * paddedSlices;\n	float uvZBase     = uvw.z * nz + 1.0;\n	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );\n	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );\n	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );\n	vec3 c0 = s0.xyz;\n	vec3 c1 = vec3( s0.w, s1.xy );\n	vec3 c2 = vec3( s1.zw, s2.x );\n	vec3 c3 = s2.yzw;\n	vec3 c4 = s3.xyz;\n	vec3 c5 = vec3( s3.w, s4.xy );\n	vec3 c6 = vec3( s4.zw, s5.x );\n	vec3 c7 = s5.yzw;\n	vec3 c8 = s6.xyz;\n	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;\n	vec3 result = c0 * 0.886227;\n	result += c1 * 2.0 * 0.511664 * y;\n	result += c2 * 2.0 * 0.511664 * z;\n	result += c3 * 2.0 * 0.511664 * x;\n	result += c4 * 2.0 * 0.429043 * x * y;\n	result += c5 * 2.0 * 0.429043 * y * z;\n	result += c6 * ( 0.743125 * z * z - 0.247708 );\n	result += c7 * 2.0 * 0.429043 * x * z;\n	result += c8 * 0.429043 * ( x * x - y * y );\n	return max( result, vec3( 0.0 ) );\n}\n#endif",
	logdepthbuf_fragment: "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;\n#endif",
	logdepthbuf_pars_fragment: "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n	uniform float logDepthBufFC;\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif",
	logdepthbuf_pars_vertex: "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif",
	logdepthbuf_vertex: "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n	vFragDepth = 1.0 + gl_Position.w;\n	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );\n#endif",
	map_fragment: "#ifdef USE_MAP\n	vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );\n	#endif\n	diffuseColor *= sampledDiffuseColor;\n#endif",
	map_pars_fragment: "#ifdef USE_MAP\n	uniform sampler2D map;\n#endif",
	map_particle_fragment: "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n	#if defined( USE_POINTS_UV )\n		vec2 uv = vUv;\n	#else\n		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n	#endif\n#endif\n#ifdef USE_MAP\n	diffuseColor *= texture2D( map, uv );\n#endif\n#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, uv ).g;\n#endif",
	map_particle_pars_fragment: "#if defined( USE_POINTS_UV )\n	varying vec2 vUv;\n#else\n	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n		uniform mat3 uvTransform;\n	#endif\n#endif\n#ifdef USE_MAP\n	uniform sampler2D map;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif",
	metalnessmap_fragment: "float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n	metalnessFactor *= texelMetalness.b;\n#endif",
	metalnessmap_pars_fragment: "#ifdef USE_METALNESSMAP\n	uniform sampler2D metalnessMap;\n#endif",
	morphinstance_vertex: "#ifdef USE_INSTANCING_MORPH\n	float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;\n	}\n#endif",
	morphcolor_vertex: "#if defined( USE_MORPHCOLORS )\n	vColor *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		#if defined( USE_COLOR_ALPHA )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];\n		#elif defined( USE_COLOR )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];\n		#endif\n	}\n#endif",
	morphnormal_vertex: "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];\n	}\n#endif",
	morphtarget_pars_vertex: "#ifdef USE_MORPHTARGETS\n	#ifndef USE_INSTANCING_MORPH\n		uniform float morphTargetBaseInfluence;\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n	#endif\n	uniform sampler2DArray morphTargetsTexture;\n	uniform ivec2 morphTargetsTextureSize;\n	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {\n		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;\n		int y = texelIndex / morphTargetsTextureSize.x;\n		int x = texelIndex - y * morphTargetsTextureSize.x;\n		ivec3 morphUV = ivec3( x, y, morphTargetIndex );\n		return texelFetch( morphTargetsTexture, morphUV, 0 );\n	}\n#endif",
	morphtarget_vertex: "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];\n	}\n#endif",
	normal_fragment_begin: "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;\n#ifdef FLAT_SHADED\n	vec3 fdx = dFdx( vViewPosition );\n	vec3 fdy = dFdy( vViewPosition );\n	vec3 normal = normalize( cross( fdx, fdy ) );\n#else\n	vec3 normal = normalize( vNormal );\n	#ifdef DOUBLE_SIDED\n		normal *= faceDirection;\n	#endif\n#endif\n#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )\n	#ifdef USE_TANGENT\n		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn = getTangentFrame( - vViewPosition, normal,\n		#if defined( USE_NORMALMAP )\n			vNormalMapUv\n		#elif defined( USE_CLEARCOAT_NORMALMAP )\n			vClearcoatNormalMapUv\n		#else\n			vUv\n		#endif\n		);\n	#endif\n	#ifdef DOUBLE_SIDED\n		tbn[0] *= faceDirection;\n		tbn[1] *= faceDirection;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	#ifdef USE_TANGENT\n		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n	#endif\n	#ifdef DOUBLE_SIDED\n		tbn2[0] *= faceDirection;\n		tbn2[1] *= faceDirection;\n	#endif\n#endif\nvec3 nonPerturbedNormal = normal;",
	normal_fragment_maps: "#ifdef USE_NORMALMAP_OBJECTSPACE\n	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	#ifdef FLIP_SIDED\n		normal = - normal;\n	#endif\n	#ifdef DOUBLE_SIDED\n		normal = normal * faceDirection;\n	#endif\n	normal = normalize( normalMatrix * normal );\n#elif defined( USE_NORMALMAP_TANGENTSPACE )\n	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	#if defined( USE_PACKED_NORMALMAP )\n		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );\n	#endif\n	mapN.xy *= normalScale;\n	normal = normalize( tbn * mapN );\n#elif defined( USE_BUMPMAP )\n	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );\n#endif",
	normal_pars_fragment: "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif",
	normal_pars_vertex: "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif",
	normal_vertex: "#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n	#ifdef USE_TANGENT\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n		#ifdef FLIP_SIDED\n			vBitangent = - vBitangent;\n		#endif\n	#endif\n#endif",
	normalmap_pars_fragment: "#ifdef USE_NORMALMAP\n	uniform sampler2D normalMap;\n	uniform vec2 normalScale;\n#endif\n#ifdef USE_NORMALMAP_OBJECTSPACE\n	uniform mat3 normalMatrix;\n#endif\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )\n	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n		vec3 q0 = dFdx( eye_pos.xyz );\n		vec3 q1 = dFdy( eye_pos.xyz );\n		vec2 st0 = dFdx( uv.st );\n		vec2 st1 = dFdy( uv.st );\n		vec3 N = surf_norm;\n		vec3 q1perp = cross( q1, N );\n		vec3 q0perp = cross( N, q0 );\n		vec3 T = q1perp * st0.x + q0perp * st1.x;\n		vec3 B = q1perp * st0.y + q0perp * st1.y;\n		float det = max( dot( T, T ), dot( B, B ) );\n		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n		return mat3( T * scale, B * scale, N );\n	}\n#endif",
	clearcoat_normal_fragment_begin: "#ifdef USE_CLEARCOAT\n	vec3 clearcoatNormal = nonPerturbedNormal;\n#endif",
	clearcoat_normal_fragment_maps: "#ifdef USE_CLEARCOAT_NORMALMAP\n	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;\n	clearcoatMapN.xy *= clearcoatNormalScale;\n	clearcoatNormal = normalize( tbn2 * clearcoatMapN );\n#endif",
	clearcoat_pars_fragment: "#ifdef USE_CLEARCOATMAP\n	uniform sampler2D clearcoatMap;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform sampler2D clearcoatNormalMap;\n	uniform vec2 clearcoatNormalScale;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform sampler2D clearcoatRoughnessMap;\n#endif",
	iridescence_pars_fragment: "#ifdef USE_IRIDESCENCEMAP\n	uniform sampler2D iridescenceMap;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform sampler2D iridescenceThicknessMap;\n#endif",
	opaque_fragment: "#ifdef OPAQUE\ndiffuseColor.a = 1.0;\n#endif\n#ifdef USE_TRANSMISSION\ndiffuseColor.a *= material.transmissionAlpha;\n#endif\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );",
	packing: "vec3 packNormalToRGB( const in vec3 normal ) {\n	return normalize( normal ) * 0.5 + 0.5;\n}\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n	return 2.0 * rgb.xyz - 1.0;\n}\nconst float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;\nconst float Inv255 = 1. / 255.;\nconst vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );\nconst vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );\nconst vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );\nconst vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );\nvec4 packDepthToRGBA( const in float v ) {\n	if( v <= 0.0 )\n		return vec4( 0., 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec4( 1., 1., 1., 1. );\n	float vuf;\n	float af = modf( v * PackFactors.a, vuf );\n	float bf = modf( vuf * ShiftRight8, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );\n}\nvec3 packDepthToRGB( const in float v ) {\n	if( v <= 0.0 )\n		return vec3( 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec3( 1., 1., 1. );\n	float vuf;\n	float bf = modf( v * PackFactors.b, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	return vec3( vuf * Inv255, gf * PackUpscale, bf );\n}\nvec2 packDepthToRG( const in float v ) {\n	if( v <= 0.0 )\n		return vec2( 0., 0. );\n	if( v >= 1.0 )\n		return vec2( 1., 1. );\n	float vuf;\n	float gf = modf( v * 256., vuf );\n	return vec2( vuf * Inv255, gf );\n}\nfloat unpackRGBAToDepth( const in vec4 v ) {\n	return dot( v, UnpackFactors4 );\n}\nfloat unpackRGBToDepth( const in vec3 v ) {\n	return dot( v, UnpackFactors3 );\n}\nfloat unpackRGToDepth( const in vec2 v ) {\n	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;\n}\nvec4 pack2HalfToRGBA( const in vec2 v ) {\n	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );\n	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );\n}\nvec2 unpackRGBATo2Half( const in vec4 v ) {\n	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( viewZ + near ) / ( near - far );\n}\nfloat orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n	\n		return depth * ( far - near ) - far;\n	#else\n		return depth * ( near - far ) - near;\n	#endif\n}\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );\n}\nfloat perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n		return ( near * far ) / ( ( near - far ) * depth - near );\n	#else\n		return ( near * far ) / ( ( far - near ) * depth - far );\n	#endif\n}",
	premultiplied_alpha_fragment: "#ifdef PREMULTIPLIED_ALPHA\n	gl_FragColor.rgb *= gl_FragColor.a;\n#endif",
	project_vertex: "vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_BATCHING\n	mvPosition = batchingMatrix * mvPosition;\n#endif\n#ifdef USE_INSTANCING\n	mvPosition = instanceMatrix * mvPosition;\n#endif\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;",
	dithering_fragment: "#ifdef DITHERING\n	gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n#endif",
	dithering_pars_fragment: "#ifdef DITHERING\n	vec3 dithering( vec3 color ) {\n		float grid_position = rand( gl_FragCoord.xy );\n		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n		return color + dither_shift_RGB;\n	}\n#endif",
	roughnessmap_fragment: "float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n	roughnessFactor *= texelRoughness.g;\n#endif",
	roughnessmap_pars_fragment: "#ifdef USE_ROUGHNESSMAP\n	uniform sampler2D roughnessMap;\n#endif",
	shadowmap_pars_fragment: "#if NUM_SPOT_LIGHT_COORDS > 0\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#if NUM_SPOT_LIGHT_MAPS > 0\n	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		#else\n			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		#endif\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		#else\n			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		#endif\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		#elif defined( SHADOWMAP_TYPE_BASIC )\n			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		#endif\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n	#if defined( SHADOWMAP_TYPE_PCF )\n		float interleavedGradientNoise( vec2 position ) {\n			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );\n		}\n		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {\n			const float goldenAngle = 2.399963229728653;\n			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );\n			float theta = float( sampleIndex ) * goldenAngle + phi;\n			return vec2( cos( theta ), sin( theta ) ) * r;\n		}\n	#endif\n	#if defined( SHADOWMAP_TYPE_PCF )\n		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			shadowCoord.z += shadowBias;\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n				float radius = shadowRadius * texelSize.x;\n				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;\n				shadow = (\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )\n				) * 0.2;\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#elif defined( SHADOWMAP_TYPE_VSM )\n		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				shadowCoord.z -= shadowBias;\n			#else\n				shadowCoord.z += shadowBias;\n			#endif\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;\n				float mean = distribution.x;\n				float variance = distribution.y * distribution.y;\n				#ifdef USE_REVERSED_DEPTH_BUFFER\n					float hard_shadow = step( mean, shadowCoord.z );\n				#else\n					float hard_shadow = step( shadowCoord.z, mean );\n				#endif\n				\n				if ( hard_shadow == 1.0 ) {\n					shadow = 1.0;\n				} else {\n					variance = max( variance, 0.0000001 );\n					float d = shadowCoord.z - mean;\n					float p_max = variance / ( variance + d * d );\n					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );\n					shadow = max( hard_shadow, p_max );\n				}\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#else\n		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				shadowCoord.z -= shadowBias;\n			#else\n				shadowCoord.z += shadowBias;\n			#endif\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				float depth = texture2D( shadowMap, shadowCoord.xy ).r;\n				#ifdef USE_REVERSED_DEPTH_BUFFER\n					shadow = step( depth, shadowCoord.z );\n				#else\n					shadow = step( shadowCoord.z, depth );\n				#endif\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n	#if defined( SHADOWMAP_TYPE_PCF )\n	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		float shadow = 1.0;\n		vec3 lightToPosition = shadowCoord.xyz;\n		vec3 bd3D = normalize( lightToPosition );\n		vec3 absVec = abs( lightToPosition );\n		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );\n		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n				dp -= shadowBias;\n			#else\n				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n				dp += shadowBias;\n			#endif\n			float texelSize = shadowRadius / shadowMapSize.x;\n			vec3 absDir = abs( bd3D );\n			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );\n			tangent = normalize( cross( bd3D, tangent ) );\n			vec3 bitangent = cross( bd3D, tangent );\n			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;\n			vec2 sample0 = vogelDiskSample( 0, 5, phi );\n			vec2 sample1 = vogelDiskSample( 1, 5, phi );\n			vec2 sample2 = vogelDiskSample( 2, 5, phi );\n			vec2 sample3 = vogelDiskSample( 3, 5, phi );\n			vec2 sample4 = vogelDiskSample( 4, 5, phi );\n			shadow = (\n				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )\n			) * 0.2;\n		}\n		return mix( 1.0, shadow, shadowIntensity );\n	}\n	#elif defined( SHADOWMAP_TYPE_BASIC )\n	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		float shadow = 1.0;\n		vec3 lightToPosition = shadowCoord.xyz;\n		vec3 absVec = abs( lightToPosition );\n		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );\n		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {\n			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n			dp += shadowBias;\n			vec3 bd3D = normalize( lightToPosition );\n			float depth = textureCube( shadowMap, bd3D ).r;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				depth = 1.0 - depth;\n			#endif\n			shadow = step( dp, depth );\n		}\n		return mix( 1.0, shadow, shadowIntensity );\n	}\n	#endif\n	#endif\n#endif",
	shadowmap_pars_vertex: "#if NUM_SPOT_LIGHT_COORDS > 0\n	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n#endif",
	shadowmap_vertex: "#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )\n	#ifdef HAS_NORMAL\n		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );\n	#else\n		vec3 shadowWorldNormal = vec3( 0.0 );\n	#endif\n	vec4 shadowWorldPosition;\n#endif\n#if defined( USE_SHADOWMAP )\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );\n			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );\n			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n#endif\n#if NUM_SPOT_LIGHT_COORDS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {\n		shadowWorldPosition = worldPosition;\n		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;\n		#endif\n		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n#endif",
	shadowmask_pars_fragment: "float getShadowMask() {\n	float shadow = 1.0;\n	#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n		directionalLight = directionalLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n		spotLight = spotLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )\n	PointLightShadow pointLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n		pointLight = pointLightShadows[ i ];\n		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#endif\n	return shadow;\n}",
	skinbase_vertex: "#ifdef USE_SKINNING\n	mat4 boneMatX = getBoneMatrix( skinIndex.x );\n	mat4 boneMatY = getBoneMatrix( skinIndex.y );\n	mat4 boneMatZ = getBoneMatrix( skinIndex.z );\n	mat4 boneMatW = getBoneMatrix( skinIndex.w );\n#endif",
	skinning_pars_vertex: "#ifdef USE_SKINNING\n	uniform mat4 bindMatrix;\n	uniform mat4 bindMatrixInverse;\n	uniform highp sampler2D boneTexture;\n	mat4 getBoneMatrix( const in float i ) {\n		int size = textureSize( boneTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n#endif",
	skinning_vertex: "#ifdef USE_SKINNING\n	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n	vec4 skinned = vec4( 0.0 );\n	skinned += boneMatX * skinVertex * skinWeight.x;\n	skinned += boneMatY * skinVertex * skinWeight.y;\n	skinned += boneMatZ * skinVertex * skinWeight.z;\n	skinned += boneMatW * skinVertex * skinWeight.w;\n	transformed = ( bindMatrixInverse * skinned ).xyz;\n#endif",
	skinnormal_vertex: "#ifdef USE_SKINNING\n	mat4 skinMatrix = mat4( 0.0 );\n	skinMatrix += skinWeight.x * boneMatX;\n	skinMatrix += skinWeight.y * boneMatY;\n	skinMatrix += skinWeight.z * boneMatZ;\n	skinMatrix += skinWeight.w * boneMatW;\n	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;\n	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n	#ifdef USE_TANGENT\n		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n	#endif\n#endif",
	specularmap_fragment: "float specularStrength;\n#ifdef USE_SPECULARMAP\n	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );\n	specularStrength = texelSpecular.r;\n#else\n	specularStrength = 1.0;\n#endif",
	specularmap_pars_fragment: "#ifdef USE_SPECULARMAP\n	uniform sampler2D specularMap;\n#endif",
	tonemapping_fragment: "#if defined( TONE_MAPPING )\n	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n#endif",
	tonemapping_pars_fragment: "#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\nuniform float toneMappingExposure;\nvec3 LinearToneMapping( vec3 color ) {\n	return saturate( toneMappingExposure * color );\n}\nvec3 ReinhardToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	return saturate( color / ( vec3( 1.0 ) + color ) );\n}\nvec3 CineonToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	color = max( vec3( 0.0 ), color - 0.004 );\n	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n}\nvec3 RRTAndODTFit( vec3 v ) {\n	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;\n	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;\n	return a / b;\n}\nvec3 ACESFilmicToneMapping( vec3 color ) {\n	const mat3 ACESInputMat = mat3(\n		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),\n		vec3( 0.04823, 0.01566, 0.83777 )\n	);\n	const mat3 ACESOutputMat = mat3(\n		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),\n		vec3( -0.07367, -0.00605,  1.07602 )\n	);\n	color *= toneMappingExposure / 0.6;\n	color = ACESInputMat * color;\n	color = RRTAndODTFit( color );\n	color = ACESOutputMat * color;\n	return saturate( color );\n}\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(\n	vec3( 1.6605, - 0.1246, - 0.0182 ),\n	vec3( - 0.5876, 1.1329, - 0.1006 ),\n	vec3( - 0.0728, - 0.0083, 1.1187 )\n);\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(\n	vec3( 0.6274, 0.0691, 0.0164 ),\n	vec3( 0.3293, 0.9195, 0.0880 ),\n	vec3( 0.0433, 0.0113, 0.8956 )\n);\nvec3 agxDefaultContrastApprox( vec3 x ) {\n	vec3 x2 = x * x;\n	vec3 x4 = x2 * x2;\n	return + 15.5 * x4 * x2\n		- 40.14 * x4 * x\n		+ 31.96 * x4\n		- 6.868 * x2 * x\n		+ 0.4298 * x2\n		+ 0.1191 * x\n		- 0.00232;\n}\nvec3 AgXToneMapping( vec3 color ) {\n	const mat3 AgXInsetMatrix = mat3(\n		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),\n		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),\n		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )\n	);\n	const mat3 AgXOutsetMatrix = mat3(\n		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),\n		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),\n		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )\n	);\n	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;\n	color *= toneMappingExposure;\n	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\n	color = AgXInsetMatrix * color;\n	color = max( color, 1e-10 );	color = log2( color );\n	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );\n	color = clamp( color, 0.0, 1.0 );\n	color = agxDefaultContrastApprox( color );\n	color = AgXOutsetMatrix * color;\n	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );\n	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\n	color = clamp( color, 0.0, 1.0 );\n	return color;\n}\nvec3 NeutralToneMapping( vec3 color ) {\n	const float StartCompression = 0.8 - 0.04;\n	const float Desaturation = 0.15;\n	color *= toneMappingExposure;\n	float x = min( color.r, min( color.g, color.b ) );\n	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;\n	color -= offset;\n	float peak = max( color.r, max( color.g, color.b ) );\n	if ( peak < StartCompression ) return color;\n	float d = 1. - StartCompression;\n	float newPeak = 1. - d * d / ( peak + d - StartCompression );\n	color *= newPeak / peak;\n	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );\n	return mix( color, vec3( newPeak ), g );\n}\nvec3 CustomToneMapping( vec3 color ) { return color; }",
	transmission_fragment: "#ifdef USE_TRANSMISSION\n	material.transmission = transmission;\n	material.transmissionAlpha = 1.0;\n	material.thickness = thickness;\n	material.attenuationDistance = attenuationDistance;\n	material.attenuationColor = attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;\n	#endif\n	vec3 pos = vWorldPosition;\n	vec3 v = normalize( cameraPosition - pos );\n	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );\n	vec4 transmitted = getIBLVolumeRefraction(\n		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,\n		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,\n		material.attenuationColor, material.attenuationDistance );\n	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );\n	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );\n#endif",
	transmission_pars_fragment: "#ifdef USE_TRANSMISSION\n	uniform float transmission;\n	uniform float thickness;\n	uniform float attenuationDistance;\n	uniform vec3 attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		uniform sampler2D transmissionMap;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		uniform sampler2D thicknessMap;\n	#endif\n	uniform vec2 transmissionSamplerSize;\n	uniform sampler2D transmissionSamplerMap;\n	uniform mat4 modelMatrix;\n	uniform mat4 projectionMatrix;\n	varying vec3 vWorldPosition;\n	float w0( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );\n	}\n	float w1( float a ) {\n		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );\n	}\n	float w2( float a ){\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );\n	}\n	float w3( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * a * a );\n	}\n	float g0( float a ) {\n		return w0( a ) + w1( a );\n	}\n	float g1( float a ) {\n		return w2( a ) + w3( a );\n	}\n	float h0( float a ) {\n		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );\n	}\n	float h1( float a ) {\n		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );\n	}\n	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {\n		uv = uv * texelSize.zw + 0.5;\n		vec2 iuv = floor( uv );\n		vec2 fuv = fract( uv );\n		float g0x = g0( fuv.x );\n		float g1x = g1( fuv.x );\n		float h0x = h0( fuv.x );\n		float h1x = h1( fuv.x );\n		float h0y = h0( fuv.y );\n		float h1y = h1( fuv.y );\n		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +\n			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );\n	}\n	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {\n		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );\n		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );\n		vec2 fLodSizeInv = 1.0 / fLodSize;\n		vec2 cLodSizeInv = 1.0 / cLodSize;\n		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );\n		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );\n		return mix( fSample, cSample, fract( lod ) );\n	}\n	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {\n		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );\n		vec3 modelScale;\n		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );\n		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );\n		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );\n		return normalize( refractionVector ) * thickness * modelScale;\n	}\n	float applyIorToRoughness( const in float roughness, const in float ior ) {\n		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );\n	}\n	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {\n		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );\n		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );\n	}\n	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {\n		if ( isinf( attenuationDistance ) ) {\n			return vec3( 1.0 );\n		} else {\n			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;\n			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;\n		}\n	}\n	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,\n		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,\n		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,\n		const in vec3 attenuationColor, const in float attenuationDistance ) {\n		vec4 transmittedLight;\n		vec3 transmittance;\n		#ifdef USE_DISPERSION\n			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;\n			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );\n			for ( int i = 0; i < 3; i ++ ) {\n				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );\n				vec3 refractedRayExit = position + transmissionRay;\n				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n				vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n				refractionCoords += 1.0;\n				refractionCoords /= 2.0;\n				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );\n				transmittedLight[ i ] = transmissionSample[ i ];\n				transmittedLight.a += transmissionSample.a;\n				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];\n			}\n			transmittedLight.a /= 3.0;\n		#else\n			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );\n			vec3 refractedRayExit = position + transmissionRay;\n			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n			vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n			refractionCoords += 1.0;\n			refractionCoords /= 2.0;\n			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );\n			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );\n		#endif\n		vec3 attenuatedColor = transmittance * transmittedLight.rgb;\n		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );\n		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;\n		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );\n	}\n#endif",
	uv_pars_fragment: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif",
	uv_pars_vertex: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	uniform mat3 mapTransform;\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform mat3 alphaMapTransform;\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	uniform mat3 lightMapTransform;\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	uniform mat3 aoMapTransform;\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	uniform mat3 bumpMapTransform;\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	uniform mat3 normalMapTransform;\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	uniform mat3 displacementMapTransform;\n	varying vec2 vDisplacementMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	uniform mat3 emissiveMapTransform;\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	uniform mat3 metalnessMapTransform;\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	uniform mat3 roughnessMapTransform;\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	uniform mat3 anisotropyMapTransform;\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	uniform mat3 clearcoatMapTransform;\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform mat3 clearcoatNormalMapTransform;\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform mat3 clearcoatRoughnessMapTransform;\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	uniform mat3 sheenColorMapTransform;\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	uniform mat3 sheenRoughnessMapTransform;\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	uniform mat3 iridescenceMapTransform;\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform mat3 iridescenceThicknessMapTransform;\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	uniform mat3 specularMapTransform;\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	uniform mat3 specularColorMapTransform;\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	uniform mat3 specularIntensityMapTransform;\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif",
	uv_vertex: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	vUv = vec3( uv, 1 ).xy;\n#endif\n#ifdef USE_MAP\n	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ALPHAMAP\n	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_LIGHTMAP\n	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_AOMAP\n	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_BUMPMAP\n	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_NORMALMAP\n	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_EMISSIVEMAP\n	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_METALNESSMAP\n	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOATMAP\n	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULARMAP\n	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_THICKNESSMAP\n	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;\n#endif",
	worldpos_vertex: "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\n	vec4 worldPosition = vec4( transformed, 1.0 );\n	#ifdef USE_BATCHING\n		worldPosition = batchingMatrix * worldPosition;\n	#endif\n	#ifdef USE_INSTANCING\n		worldPosition = instanceMatrix * worldPosition;\n	#endif\n	worldPosition = modelMatrix * worldPosition;\n#endif",
	background_vert: "varying vec2 vUv;\nuniform mat3 uvTransform;\nvoid main() {\n	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	gl_Position = vec4( position.xy, 1.0, 1.0 );\n}",
	background_frag: "uniform sampler2D t2D;\nuniform float backgroundIntensity;\nvarying vec2 vUv;\nvoid main() {\n	vec4 texColor = texture2D( t2D, vUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	backgroundCube_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}",
	backgroundCube_frag: "#ifdef ENVMAP_TYPE_CUBE\n	uniform samplerCube envMap;\n#elif defined( ENVMAP_TYPE_CUBE_UV )\n	uniform sampler2D envMap;\n#endif\nuniform float backgroundBlurriness;\nuniform float backgroundIntensity;\nuniform mat3 backgroundRotation;\nvarying vec3 vWorldDirection;\n#include <cube_uv_reflection_fragment>\nvoid main() {\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );\n	#elif defined( ENVMAP_TYPE_CUBE_UV )\n		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );\n	#else\n		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	cube_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}",
	cube_frag: "uniform samplerCube tCube;\nuniform float tFlip;\nuniform float opacity;\nvarying vec3 vWorldDirection;\nvoid main() {\n	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );\n	gl_FragColor = texColor;\n	gl_FragColor.a *= opacity;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	depth_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#include <morphinstance_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vHighPrecisionZW = gl_Position.zw;\n}",
	depth_frag: "#if DEPTH_PACKING == 3200\n	uniform float opacity;\n#endif\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <clipping_planes_fragment>\n	#if DEPTH_PACKING == 3200\n		diffuseColor.a = opacity;\n	#endif\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <logdepthbuf_fragment>\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];\n	#else\n		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;\n	#endif\n	#if DEPTH_PACKING == 3200\n		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );\n	#elif DEPTH_PACKING == 3201\n		gl_FragColor = packDepthToRGBA( fragCoordZ );\n	#elif DEPTH_PACKING == 3202\n		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );\n	#elif DEPTH_PACKING == 3203\n		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );\n	#endif\n}",
	distance_vert: "#define DISTANCE\nvarying vec3 vWorldPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#include <morphinstance_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <worldpos_vertex>\n	#include <clipping_planes_vertex>\n	vWorldPosition = worldPosition.xyz;\n}",
	distance_frag: "#define DISTANCE\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <clipping_planes_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	float dist = length( vWorldPosition - referencePosition );\n	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n	dist = saturate( dist );\n	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );\n}",
	equirect_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n}",
	equirect_frag: "uniform sampler2D tEquirect;\nvarying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vec3 direction = normalize( vWorldDirection );\n	vec2 sampleUV = equirectUv( direction );\n	gl_FragColor = texture2D( tEquirect, sampleUV );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	linedashed_vert: "uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;\n#include <common>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	vLineDistance = scale * lineDistance;\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}",
	linedashed_frag: "uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	if ( mod( vLineDistance, totalSize ) > dashSize ) {\n		discard;\n	}\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	meshbasic_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinbase_vertex>\n		#include <skinnormal_vertex>\n		#include <defaultnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <fog_vertex>\n}",
	meshbasic_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;\n	#else\n		reflectedLight.indirectDiffuse += vec3( 1.0 );\n	#endif\n	#include <aomap_fragment>\n	reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n	vec3 outgoingLight = reflectedLight.indirectDiffuse;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshlambert_vert: "#define LAMBERT\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshlambert_frag: "#define LAMBERT\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_lambert_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_lambert_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshmatcap_vert: "#define MATCAP\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n	vViewPosition = - mvPosition.xyz;\n}",
	meshmatcap_frag: "#define MATCAP\nuniform vec3 diffuse;\nuniform float opacity;\nuniform sampler2D matcap;\nvarying vec3 vViewPosition;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	vec3 viewDir = normalize( vViewPosition );\n	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );\n	vec3 y = cross( viewDir, x );\n	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n	#ifdef USE_MATCAP\n		vec4 matcapColor = texture2D( matcap, uv );\n	#else\n		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );\n	#endif\n	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshnormal_vert: "#define NORMAL\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	vViewPosition = - mvPosition.xyz;\n#endif\n}",
	meshnormal_frag: "#define NORMAL\nuniform float opacity;\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <uv_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );\n	#ifdef OPAQUE\n		gl_FragColor.a = 1.0;\n	#endif\n}",
	meshphong_vert: "#define PHONG\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshphong_frag: "#define PHONG\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_phong_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_phong_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshphysical_vert: "#define STANDARD\nvarying vec3 vViewPosition;\n#ifdef USE_TRANSMISSION\n	varying vec3 vWorldPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n#ifdef USE_TRANSMISSION\n	vWorldPosition = worldPosition.xyz;\n#endif\n}",
	meshphysical_frag: "#define STANDARD\n#ifdef PHYSICAL\n	#define IOR\n	#define USE_SPECULAR\n#endif\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n#ifdef IOR\n	uniform float ior;\n#endif\n#ifdef USE_SPECULAR\n	uniform float specularIntensity;\n	uniform vec3 specularColor;\n	#ifdef USE_SPECULAR_COLORMAP\n		uniform sampler2D specularColorMap;\n	#endif\n	#ifdef USE_SPECULAR_INTENSITYMAP\n		uniform sampler2D specularIntensityMap;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT\n	uniform float clearcoat;\n	uniform float clearcoatRoughness;\n#endif\n#ifdef USE_DISPERSION\n	uniform float dispersion;\n#endif\n#ifdef USE_IRIDESCENCE\n	uniform float iridescence;\n	uniform float iridescenceIOR;\n	uniform float iridescenceThicknessMinimum;\n	uniform float iridescenceThicknessMaximum;\n#endif\n#ifdef USE_SHEEN\n	uniform vec3 sheenColor;\n	uniform float sheenRoughness;\n	#ifdef USE_SHEEN_COLORMAP\n		uniform sampler2D sheenColorMap;\n	#endif\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		uniform sampler2D sheenRoughnessMap;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	uniform vec2 anisotropyVector;\n	#ifdef USE_ANISOTROPYMAP\n		uniform sampler2D anisotropyMap;\n	#endif\n#endif\nvarying vec3 vViewPosition;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <iridescence_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_physical_pars_fragment>\n#include <transmission_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <clearcoat_pars_fragment>\n#include <iridescence_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <roughnessmap_fragment>\n	#include <metalnessmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <clearcoat_normal_fragment_begin>\n	#include <clearcoat_normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_physical_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;\n	#include <transmission_fragment>\n	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n	#ifdef USE_SHEEN\n \n		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;\n \n 	#endif\n	#ifdef USE_CLEARCOAT\n		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );\n		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );\n		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;\n	#endif\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshtoon_vert: "#define TOON\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshtoon_frag: "#define TOON\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <gradientmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_toon_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_toon_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	points_vert: "uniform float size;\nuniform float scale;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n#ifdef USE_POINTS_UV\n	varying vec2 vUv;\n	uniform mat3 uvTransform;\n#endif\nvoid main() {\n	#ifdef USE_POINTS_UV\n		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	#endif\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	gl_PointSize = size;\n	#ifdef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );\n	#endif\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <fog_vertex>\n}",
	points_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <color_pars_fragment>\n#include <map_particle_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_particle_fragment>\n	#include <color_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	shadow_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <shadowmap_pars_vertex>\nvoid main() {\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	shadow_frag: "uniform vec3 color;\nuniform float opacity;\n#include <common>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <logdepthbuf_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\nvoid main() {\n	#include <logdepthbuf_fragment>\n	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	sprite_vert: "uniform float rotation;\nuniform vec2 center;\n#include <common>\n#include <uv_pars_vertex>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	vec4 mvPosition = modelViewMatrix[ 3 ];\n	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );\n	#ifndef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) scale *= - mvPosition.z;\n	#endif\n	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;\n	vec2 rotatedPosition;\n	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;\n	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;\n	mvPosition.xy += rotatedPosition;\n	gl_Position = projectionMatrix * mvPosition;\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}",
	sprite_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n}"
}, Q = {
	common: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		map: { value: null },
		mapTransform: { value: /*@__PURE__*/ new G() },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new G() },
		alphaTest: { value: 0 }
	},
	specularmap: {
		specularMap: { value: null },
		specularMapTransform: { value: /*@__PURE__*/ new G() }
	},
	envmap: {
		envMap: { value: null },
		envMapRotation: { value: /*@__PURE__*/ new G() },
		reflectivity: { value: 1 },
		ior: { value: 1.5 },
		refractionRatio: { value: .98 },
		dfgLUT: { value: null }
	},
	aomap: {
		aoMap: { value: null },
		aoMapIntensity: { value: 1 },
		aoMapTransform: { value: /*@__PURE__*/ new G() }
	},
	lightmap: {
		lightMap: { value: null },
		lightMapIntensity: { value: 1 },
		lightMapTransform: { value: /*@__PURE__*/ new G() }
	},
	bumpmap: {
		bumpMap: { value: null },
		bumpMapTransform: { value: /*@__PURE__*/ new G() },
		bumpScale: { value: 1 }
	},
	normalmap: {
		normalMap: { value: null },
		normalMapTransform: { value: /*@__PURE__*/ new G() },
		normalScale: { value: /*@__PURE__*/ new U(1, 1) }
	},
	displacementmap: {
		displacementMap: { value: null },
		displacementMapTransform: { value: /*@__PURE__*/ new G() },
		displacementScale: { value: 1 },
		displacementBias: { value: 0 }
	},
	emissivemap: {
		emissiveMap: { value: null },
		emissiveMapTransform: { value: /*@__PURE__*/ new G() }
	},
	metalnessmap: {
		metalnessMap: { value: null },
		metalnessMapTransform: { value: /*@__PURE__*/ new G() }
	},
	roughnessmap: {
		roughnessMap: { value: null },
		roughnessMapTransform: { value: /*@__PURE__*/ new G() }
	},
	gradientmap: { gradientMap: { value: null } },
	fog: {
		fogDensity: { value: 25e-5 },
		fogNear: { value: 1 },
		fogFar: { value: 2e3 },
		fogColor: { value: /*@__PURE__*/ new J(16777215) }
	},
	lights: {
		ambientLightColor: { value: [] },
		lightProbe: { value: [] },
		directionalLights: {
			value: [],
			properties: {
				direction: {},
				color: {}
			}
		},
		directionalLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {}
			}
		},
		directionalShadowMatrix: { value: [] },
		spotLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				direction: {},
				distance: {},
				coneCos: {},
				penumbraCos: {},
				decay: {}
			}
		},
		spotLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {}
			}
		},
		spotLightMap: { value: [] },
		spotLightMatrix: { value: [] },
		pointLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				decay: {},
				distance: {}
			}
		},
		pointLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {},
				shadowCameraNear: {},
				shadowCameraFar: {}
			}
		},
		pointShadowMatrix: { value: [] },
		hemisphereLights: {
			value: [],
			properties: {
				direction: {},
				skyColor: {},
				groundColor: {}
			}
		},
		rectAreaLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				width: {},
				height: {}
			}
		},
		ltc_1: { value: null },
		ltc_2: { value: null },
		probesSH: { value: null },
		probesMin: { value: /*@__PURE__*/ new W() },
		probesMax: { value: /*@__PURE__*/ new W() },
		probesResolution: { value: /*@__PURE__*/ new W() }
	},
	points: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		size: { value: 1 },
		scale: { value: 1 },
		map: { value: null },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new G() },
		alphaTest: { value: 0 },
		uvTransform: { value: /*@__PURE__*/ new G() }
	},
	sprite: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		center: { value: /*@__PURE__*/ new U(.5, .5) },
		rotation: { value: 0 },
		map: { value: null },
		mapTransform: { value: /*@__PURE__*/ new G() },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new G() },
		alphaTest: { value: 0 }
	}
}, ws = {
	basic: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.specularmap,
			Q.envmap,
			Q.aomap,
			Q.lightmap,
			Q.fog
		]),
		vertexShader: Z.meshbasic_vert,
		fragmentShader: Z.meshbasic_frag
	},
	lambert: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.specularmap,
			Q.envmap,
			Q.aomap,
			Q.lightmap,
			Q.emissivemap,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			Q.fog,
			Q.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Z.meshlambert_vert,
		fragmentShader: Z.meshlambert_frag
	},
	phong: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.specularmap,
			Q.envmap,
			Q.aomap,
			Q.lightmap,
			Q.emissivemap,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			Q.fog,
			Q.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				specular: { value: /*@__PURE__*/ new J(1118481) },
				shininess: { value: 30 },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Z.meshphong_vert,
		fragmentShader: Z.meshphong_frag
	},
	standard: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.envmap,
			Q.aomap,
			Q.lightmap,
			Q.emissivemap,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			Q.roughnessmap,
			Q.metalnessmap,
			Q.fog,
			Q.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				roughness: { value: 1 },
				metalness: { value: 0 },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Z.meshphysical_vert,
		fragmentShader: Z.meshphysical_frag
	},
	toon: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.aomap,
			Q.lightmap,
			Q.emissivemap,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			Q.gradientmap,
			Q.fog,
			Q.lights,
			{ emissive: { value: /*@__PURE__*/ new J(0) } }
		]),
		vertexShader: Z.meshtoon_vert,
		fragmentShader: Z.meshtoon_frag
	},
	matcap: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			Q.fog,
			{ matcap: { value: null } }
		]),
		vertexShader: Z.meshmatcap_vert,
		fragmentShader: Z.meshmatcap_frag
	},
	points: {
		uniforms: /*@__PURE__*/ oo([Q.points, Q.fog]),
		vertexShader: Z.points_vert,
		fragmentShader: Z.points_frag
	},
	dashed: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.fog,
			{
				scale: { value: 1 },
				dashSize: { value: 1 },
				totalSize: { value: 2 }
			}
		]),
		vertexShader: Z.linedashed_vert,
		fragmentShader: Z.linedashed_frag
	},
	depth: {
		uniforms: /*@__PURE__*/ oo([Q.common, Q.displacementmap]),
		vertexShader: Z.depth_vert,
		fragmentShader: Z.depth_frag
	},
	normal: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.bumpmap,
			Q.normalmap,
			Q.displacementmap,
			{ opacity: { value: 1 } }
		]),
		vertexShader: Z.meshnormal_vert,
		fragmentShader: Z.meshnormal_frag
	},
	sprite: {
		uniforms: /*@__PURE__*/ oo([Q.sprite, Q.fog]),
		vertexShader: Z.sprite_vert,
		fragmentShader: Z.sprite_frag
	},
	background: {
		uniforms: {
			uvTransform: { value: /*@__PURE__*/ new G() },
			t2D: { value: null },
			backgroundIntensity: { value: 1 }
		},
		vertexShader: Z.background_vert,
		fragmentShader: Z.background_frag
	},
	backgroundCube: {
		uniforms: {
			envMap: { value: null },
			backgroundBlurriness: { value: 0 },
			backgroundIntensity: { value: 1 },
			backgroundRotation: { value: /*@__PURE__*/ new G() }
		},
		vertexShader: Z.backgroundCube_vert,
		fragmentShader: Z.backgroundCube_frag
	},
	cube: {
		uniforms: {
			tCube: { value: null },
			tFlip: { value: -1 },
			opacity: { value: 1 }
		},
		vertexShader: Z.cube_vert,
		fragmentShader: Z.cube_frag
	},
	equirect: {
		uniforms: { tEquirect: { value: null } },
		vertexShader: Z.equirect_vert,
		fragmentShader: Z.equirect_frag
	},
	distance: {
		uniforms: /*@__PURE__*/ oo([
			Q.common,
			Q.displacementmap,
			{
				referencePosition: { value: /*@__PURE__*/ new W() },
				nearDistance: { value: 1 },
				farDistance: { value: 1e3 }
			}
		]),
		vertexShader: Z.distance_vert,
		fragmentShader: Z.distance_frag
	},
	shadow: {
		uniforms: /*@__PURE__*/ oo([
			Q.lights,
			Q.fog,
			{
				color: { value: /*@__PURE__*/ new J(0) },
				opacity: { value: 1 }
			}
		]),
		vertexShader: Z.shadow_vert,
		fragmentShader: Z.shadow_frag
	}
};
ws.physical = {
	uniforms: /*@__PURE__*/ oo([ws.standard.uniforms, {
		clearcoat: { value: 0 },
		clearcoatMap: { value: null },
		clearcoatMapTransform: { value: /*@__PURE__*/ new G() },
		clearcoatNormalMap: { value: null },
		clearcoatNormalMapTransform: { value: /*@__PURE__*/ new G() },
		clearcoatNormalScale: { value: /*@__PURE__*/ new U(1, 1) },
		clearcoatRoughness: { value: 0 },
		clearcoatRoughnessMap: { value: null },
		clearcoatRoughnessMapTransform: { value: /*@__PURE__*/ new G() },
		dispersion: { value: 0 },
		iridescence: { value: 0 },
		iridescenceMap: { value: null },
		iridescenceMapTransform: { value: /*@__PURE__*/ new G() },
		iridescenceIOR: { value: 1.3 },
		iridescenceThicknessMinimum: { value: 100 },
		iridescenceThicknessMaximum: { value: 400 },
		iridescenceThicknessMap: { value: null },
		iridescenceThicknessMapTransform: { value: /*@__PURE__*/ new G() },
		sheen: { value: 0 },
		sheenColor: { value: /*@__PURE__*/ new J(0) },
		sheenColorMap: { value: null },
		sheenColorMapTransform: { value: /*@__PURE__*/ new G() },
		sheenRoughness: { value: 1 },
		sheenRoughnessMap: { value: null },
		sheenRoughnessMapTransform: { value: /*@__PURE__*/ new G() },
		transmission: { value: 0 },
		transmissionMap: { value: null },
		transmissionMapTransform: { value: /*@__PURE__*/ new G() },
		transmissionSamplerSize: { value: /*@__PURE__*/ new U() },
		transmissionSamplerMap: { value: null },
		thickness: { value: 0 },
		thicknessMap: { value: null },
		thicknessMapTransform: { value: /*@__PURE__*/ new G() },
		attenuationDistance: { value: 0 },
		attenuationColor: { value: /*@__PURE__*/ new J(0) },
		specularColor: { value: /*@__PURE__*/ new J(1, 1, 1) },
		specularColorMap: { value: null },
		specularColorMapTransform: { value: /*@__PURE__*/ new G() },
		specularIntensity: { value: 1 },
		specularIntensityMap: { value: null },
		specularIntensityMapTransform: { value: /*@__PURE__*/ new G() },
		anisotropyVector: { value: /*@__PURE__*/ new U() },
		anisotropyMap: { value: null },
		anisotropyMapTransform: { value: /*@__PURE__*/ new G() }
	}]),
	vertexShader: Z.meshphysical_vert,
	fragmentShader: Z.meshphysical_frag
};
var Ts = {
	r: 0,
	b: 0,
	g: 0
}, Es = /*@__PURE__*/ new q(), Ds = /*@__PURE__*/ new G();
Ds.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function Os(e, t, n, r, i, a) {
	let o = new J(0), s = i === !0 ? 0 : 1, c, l, u = null, d = 0, f = null;
	function p(e) {
		let n = e.isScene === !0 ? e.background : null;
		if (n && n.isTexture) {
			let r = e.backgroundBlurriness > 0;
			n = t.get(n, r);
		}
		return n;
	}
	function m(t) {
		let r = !1, i = p(t);
		i === null ? g(o, s) : i && i.isColor && (g(i, 1), r = !0);
		let c = e.xr.getEnvironmentBlendMode();
		c === "additive" ? n.buffers.color.setClear(0, 0, 0, 1, a) : c === "alpha-blend" && n.buffers.color.setClear(0, 0, 0, 0, a), (e.autoClear || r) && (n.buffers.depth.setTest(!0), n.buffers.depth.setMask(!0), n.buffers.color.setMask(!0), e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil));
	}
	function h(t, n) {
		let i = p(n);
		i && (i.isCubeTexture || i.mapping === 306) ? (l === void 0 && (l = new X(new Ya(1, 1, 1), new mo({
			name: "BackgroundCubeMaterial",
			uniforms: ao(ws.backgroundCube.uniforms),
			vertexShader: ws.backgroundCube.vertexShader,
			fragmentShader: ws.backgroundCube.fragmentShader,
			side: 1,
			depthTest: !1,
			depthWrite: !1,
			fog: !1,
			allowOverride: !1
		})), l.geometry.deleteAttribute("normal"), l.geometry.deleteAttribute("uv"), l.onBeforeRender = function(e, t, n) {
			this.matrixWorld.copyPosition(n.matrixWorld);
		}, Object.defineProperty(l.material, "envMap", { get: function() {
			return this.uniforms.envMap.value;
		} }), r.update(l)), l.material.uniforms.envMap.value = i, l.material.uniforms.backgroundBlurriness.value = n.backgroundBlurriness, l.material.uniforms.backgroundIntensity.value = n.backgroundIntensity, l.material.uniforms.backgroundRotation.value.setFromMatrix4(Es.makeRotationFromEuler(n.backgroundRotation)).transpose(), i.isCubeTexture && i.isRenderTargetTexture === !1 && l.material.uniforms.backgroundRotation.value.premultiply(Ds), l.material.toneMapped = K.getTransfer(i.colorSpace) !== ln, (u !== i || d !== i.version || f !== e.toneMapping) && (l.material.needsUpdate = !0, u = i, d = i.version, f = e.toneMapping), l.layers.enableAll(), t.unshift(l, l.geometry, l.material, 0, 0, null)) : i && i.isTexture && (c === void 0 && (c = new X(new to(2, 2), new mo({
			name: "BackgroundMaterial",
			uniforms: ao(ws.background.uniforms),
			vertexShader: ws.background.vertexShader,
			fragmentShader: ws.background.fragmentShader,
			side: 0,
			depthTest: !1,
			depthWrite: !1,
			fog: !1,
			allowOverride: !1
		})), c.geometry.deleteAttribute("normal"), Object.defineProperty(c.material, "map", { get: function() {
			return this.uniforms.t2D.value;
		} }), r.update(c)), c.material.uniforms.t2D.value = i, c.material.uniforms.backgroundIntensity.value = n.backgroundIntensity, c.material.toneMapped = K.getTransfer(i.colorSpace) !== ln, i.matrixAutoUpdate === !0 && i.updateMatrix(), c.material.uniforms.uvTransform.value.copy(i.matrix), (u !== i || d !== i.version || f !== e.toneMapping) && (c.material.needsUpdate = !0, u = i, d = i.version, f = e.toneMapping), c.layers.enableAll(), t.unshift(c, c.geometry, c.material, 0, 0, null));
	}
	function g(t, r) {
		t.getRGB(Ts, lo(e)), n.buffers.color.setClear(Ts.r, Ts.g, Ts.b, r, a);
	}
	function _() {
		l !== void 0 && (l.geometry.dispose(), l.material.dispose(), l = void 0), c !== void 0 && (c.geometry.dispose(), c.material.dispose(), c = void 0);
	}
	return {
		getClearColor: function() {
			return o;
		},
		setClearColor: function(e, t = 1) {
			o.set(e), s = t, g(o, s);
		},
		getClearAlpha: function() {
			return s;
		},
		setClearAlpha: function(e) {
			s = e, g(o, s);
		},
		render: m,
		addToRenderList: h,
		dispose: _
	};
}
function ks(e, t) {
	let n = e.getParameter(e.MAX_VERTEX_ATTRIBS), r = {}, i = f(null), a = i, o = !1;
	function s(n, r, i, s, c) {
		let u = !1, f = d(n, s, i, r);
		a !== f && (a = f, l(a.object)), u = p(n, s, i, c), u && m(n, s, i, c), c !== null && t.update(c, e.ELEMENT_ARRAY_BUFFER), (u || o) && (o = !1, b(n, r, i, s), c !== null && e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, t.get(c).buffer));
	}
	function c() {
		return e.createVertexArray();
	}
	function l(t) {
		return e.bindVertexArray(t);
	}
	function u(t) {
		return e.deleteVertexArray(t);
	}
	function d(e, t, n, i) {
		let a = i.wireframe === !0, o = r[t.id];
		o === void 0 && (o = {}, r[t.id] = o);
		let s = e.isInstancedMesh === !0 ? e.id : 0, l = o[s];
		l === void 0 && (l = {}, o[s] = l);
		let u = l[n.id];
		u === void 0 && (u = {}, l[n.id] = u);
		let d = u[a];
		return d === void 0 && (d = f(c()), u[a] = d), d;
	}
	function f(e) {
		let t = [], r = [], i = [];
		for (let e = 0; e < n; e++) t[e] = 0, r[e] = 0, i[e] = 0;
		return {
			geometry: null,
			program: null,
			wireframe: !1,
			newAttributes: t,
			enabledAttributes: r,
			attributeDivisors: i,
			object: e,
			attributes: {},
			index: null
		};
	}
	function p(e, t, n, r) {
		let i = a.attributes, o = t.attributes, s = 0, c = n.getAttributes();
		for (let t in c) if (c[t].location >= 0) {
			let n = i[t], r = o[t];
			if (r === void 0 && (t === "instanceMatrix" && e.instanceMatrix && (r = e.instanceMatrix), t === "instanceColor" && e.instanceColor && (r = e.instanceColor)), n === void 0 || n.attribute !== r || r && n.data !== r.data) return !0;
			s++;
		}
		return a.attributesNum !== s || a.index !== r;
	}
	function m(e, t, n, r) {
		let i = {}, o = t.attributes, s = 0, c = n.getAttributes();
		for (let t in c) if (c[t].location >= 0) {
			let n = o[t];
			n === void 0 && (t === "instanceMatrix" && e.instanceMatrix && (n = e.instanceMatrix), t === "instanceColor" && e.instanceColor && (n = e.instanceColor));
			let r = {};
			r.attribute = n, n && n.data && (r.data = n.data), i[t] = r, s++;
		}
		a.attributes = i, a.attributesNum = s, a.index = r;
	}
	function h() {
		let e = a.newAttributes;
		for (let t = 0, n = e.length; t < n; t++) e[t] = 0;
	}
	function g(e) {
		_(e, 0);
	}
	function _(t, n) {
		let r = a.newAttributes, i = a.enabledAttributes, o = a.attributeDivisors;
		r[t] = 1, i[t] === 0 && (e.enableVertexAttribArray(t), i[t] = 1), o[t] !== n && (e.vertexAttribDivisor(t, n), o[t] = n);
	}
	function v() {
		let t = a.newAttributes, n = a.enabledAttributes;
		for (let r = 0, i = n.length; r < i; r++) n[r] !== t[r] && (e.disableVertexAttribArray(r), n[r] = 0);
	}
	function y(t, n, r, i, a, o, s) {
		s === !0 ? e.vertexAttribIPointer(t, n, r, a, o) : e.vertexAttribPointer(t, n, r, i, a, o);
	}
	function b(n, r, i, a) {
		h();
		let o = a.attributes, s = i.getAttributes(), c = r.defaultAttributeValues;
		for (let r in s) {
			let i = s[r];
			if (i.location >= 0) {
				let s = o[r];
				if (s === void 0 && (r === "instanceMatrix" && n.instanceMatrix && (s = n.instanceMatrix), r === "instanceColor" && n.instanceColor && (s = n.instanceColor)), s !== void 0) {
					let r = s.normalized, o = s.itemSize, c = t.get(s);
					if (c === void 0) continue;
					let l = c.buffer, u = c.type, d = c.bytesPerElement, f = u === e.INT || u === e.UNSIGNED_INT || s.gpuType === 1013;
					if (s.isInterleavedBufferAttribute) {
						let t = s.data, c = t.stride, p = s.offset;
						if (t.isInstancedInterleavedBuffer) {
							for (let e = 0; e < i.locationSize; e++) _(i.location + e, t.meshPerAttribute);
							n.isInstancedMesh !== !0 && a._maxInstanceCount === void 0 && (a._maxInstanceCount = t.meshPerAttribute * t.count);
						} else for (let e = 0; e < i.locationSize; e++) g(i.location + e);
						e.bindBuffer(e.ARRAY_BUFFER, l);
						for (let e = 0; e < i.locationSize; e++) y(i.location + e, o / i.locationSize, u, r, c * d, (p + o / i.locationSize * e) * d, f);
					} else {
						if (s.isInstancedBufferAttribute) {
							for (let e = 0; e < i.locationSize; e++) _(i.location + e, s.meshPerAttribute);
							n.isInstancedMesh !== !0 && a._maxInstanceCount === void 0 && (a._maxInstanceCount = s.meshPerAttribute * s.count);
						} else for (let e = 0; e < i.locationSize; e++) g(i.location + e);
						e.bindBuffer(e.ARRAY_BUFFER, l);
						for (let e = 0; e < i.locationSize; e++) y(i.location + e, o / i.locationSize, u, r, o * d, o / i.locationSize * e * d, f);
					}
				} else if (c !== void 0) {
					let t = c[r];
					if (t !== void 0) switch (t.length) {
						case 2:
							e.vertexAttrib2fv(i.location, t);
							break;
						case 3:
							e.vertexAttrib3fv(i.location, t);
							break;
						case 4:
							e.vertexAttrib4fv(i.location, t);
							break;
						default: e.vertexAttrib1fv(i.location, t);
					}
				}
			}
		}
		v();
	}
	function x() {
		T();
		for (let e in r) {
			let t = r[e];
			for (let e in t) {
				let n = t[e];
				for (let e in n) {
					let t = n[e];
					for (let e in t) u(t[e].object), delete t[e];
					delete n[e];
				}
			}
			delete r[e];
		}
	}
	function S(e) {
		if (r[e.id] === void 0) return;
		let t = r[e.id];
		for (let e in t) {
			let n = t[e];
			for (let e in n) {
				let t = n[e];
				for (let e in t) u(t[e].object), delete t[e];
				delete n[e];
			}
		}
		delete r[e.id];
	}
	function C(e) {
		for (let t in r) {
			let n = r[t];
			for (let t in n) {
				let r = n[t];
				if (r[e.id] === void 0) continue;
				let i = r[e.id];
				for (let e in i) u(i[e].object), delete i[e];
				delete r[e.id];
			}
		}
	}
	function w(e) {
		for (let t in r) {
			let n = r[t], i = e.isInstancedMesh === !0 ? e.id : 0, a = n[i];
			if (a !== void 0) {
				for (let e in a) {
					let t = a[e];
					for (let e in t) u(t[e].object), delete t[e];
					delete a[e];
				}
				delete n[i], Object.keys(n).length === 0 && delete r[t];
			}
		}
	}
	function T() {
		E(), o = !0, a !== i && (a = i, l(a.object));
	}
	function E() {
		i.geometry = null, i.program = null, i.wireframe = !1;
	}
	return {
		setup: s,
		reset: T,
		resetDefaultState: E,
		dispose: x,
		releaseStatesOfGeometry: S,
		releaseStatesOfObject: w,
		releaseStatesOfProgram: C,
		initAttributes: h,
		enableAttribute: g,
		disableUnusedAttributes: v
	};
}
function As(e, t, n) {
	let r;
	function i(e) {
		r = e;
	}
	function a(t, i) {
		e.drawArrays(r, t, i), n.update(i, r, 1);
	}
	function o(t, i, a) {
		a !== 0 && (e.drawArraysInstanced(r, t, i, a), n.update(i, r, a));
	}
	function s(e, i, a) {
		if (a === 0) return;
		t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(r, e, 0, i, 0, a);
		let o = 0;
		for (let e = 0; e < a; e++) o += i[e];
		n.update(o, r, 1);
	}
	this.setMode = i, this.render = a, this.renderInstances = o, this.renderMultiDraw = s;
}
function js(e, t, n, r) {
	let i;
	function a() {
		if (i !== void 0) return i;
		if (t.has("EXT_texture_filter_anisotropic") === !0) {
			let n = t.get("EXT_texture_filter_anisotropic");
			i = e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
		} else i = 0;
		return i;
	}
	function o(t) {
		return !(t !== 1023 && r.convert(t) !== e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT));
	}
	function s(n) {
		let i = n === 1016 && (t.has("EXT_color_buffer_half_float") || t.has("EXT_color_buffer_float"));
		return !(n !== 1009 && r.convert(n) !== e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE) && n !== 1015 && !i);
	}
	function c(t) {
		if (t === "highp") {
			if (e.getShaderPrecisionFormat(e.VERTEX_SHADER, e.HIGH_FLOAT).precision > 0 && e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.HIGH_FLOAT).precision > 0) return "highp";
			t = "mediump";
		}
		return t === "mediump" && e.getShaderPrecisionFormat(e.VERTEX_SHADER, e.MEDIUM_FLOAT).precision > 0 && e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.MEDIUM_FLOAT).precision > 0 ? "mediump" : "lowp";
	}
	let l = n.precision === void 0 ? "highp" : n.precision, u = c(l);
	u !== l && (B("WebGLRenderer:", l, "not supported, using", u, "instead."), l = u);
	let d = n.logarithmicDepthBuffer === !0, f = n.reversedDepthBuffer === !0 && t.has("EXT_clip_control");
	n.reversedDepthBuffer === !0 && f === !1 && B("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");
	let p = e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS), m = e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS), h = e.getParameter(e.MAX_TEXTURE_SIZE), g = e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE), _ = e.getParameter(e.MAX_VERTEX_ATTRIBS), v = e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS), y = e.getParameter(e.MAX_VARYING_VECTORS), b = e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS), x = e.getParameter(e.MAX_SAMPLES), S = e.getParameter(e.SAMPLES);
	return {
		isWebGL2: !0,
		getMaxAnisotropy: a,
		getMaxPrecision: c,
		textureFormatReadable: o,
		textureTypeReadable: s,
		precision: l,
		logarithmicDepthBuffer: d,
		reversedDepthBuffer: f,
		maxTextures: p,
		maxVertexTextures: m,
		maxTextureSize: h,
		maxCubemapSize: g,
		maxAttributes: _,
		maxVertexUniforms: v,
		maxVaryings: y,
		maxFragmentUniforms: b,
		maxSamples: x,
		samples: S
	};
}
function Ms(e) {
	let t = this, n = null, r = 0, i = !1, a = !1, o = new Aa(), s = new G(), c = {
		value: null,
		needsUpdate: !1
	};
	this.uniform = c, this.numPlanes = 0, this.numIntersection = 0, this.init = function(e, t) {
		let n = e.length !== 0 || t || r !== 0 || i;
		return i = t, r = e.length, n;
	}, this.beginShadows = function() {
		a = !0, u(null);
	}, this.endShadows = function() {
		a = !1;
	}, this.setGlobalState = function(e, t) {
		n = u(e, t, 0);
	}, this.setState = function(t, o, s) {
		let d = t.clippingPlanes, f = t.clipIntersection, p = t.clipShadows, m = e.get(t);
		if (!i || d === null || d.length === 0 || a && !p) a ? u(null) : l();
		else {
			let e = a ? 0 : r, t = e * 4, i = m.clippingState || null;
			c.value = i, i = u(d, o, t, s);
			for (let e = 0; e !== t; ++e) i[e] = n[e];
			m.clippingState = i, this.numIntersection = f ? this.numPlanes : 0, this.numPlanes += e;
		}
	};
	function l() {
		c.value !== n && (c.value = n, c.needsUpdate = r > 0), t.numPlanes = r, t.numIntersection = 0;
	}
	function u(e, n, r, i) {
		let a = e === null ? 0 : e.length, l = null;
		if (a !== 0) {
			if (l = c.value, i !== !0 || l === null) {
				let t = r + a * 4, i = n.matrixWorldInverse;
				s.getNormalMatrix(i), (l === null || l.length < t) && (l = new Float32Array(t));
				for (let t = 0, n = r; t !== a; ++t, n += 4) o.copy(e[t]).applyMatrix4(i, s), o.normal.toArray(l, n), l[n + 3] = o.constant;
			}
			c.value = l, c.needsUpdate = !0;
		}
		return t.numPlanes = a, t.numIntersection = 0, l;
	}
}
var Ns = 4, Ps = [
	.125,
	.215,
	.35,
	.446,
	.526,
	.582
], Fs = 20, Is = 256, Ls = /*@__PURE__*/ new Xo(), Rs = /*@__PURE__*/ new J(), zs = null, Bs = 0, Vs = 0, Hs = !1, Us = /*@__PURE__*/ new W(), Ws = class {
	constructor(e) {
		this._renderer = e, this._pingPongRenderTarget = null, this._lodMax = 0, this._cubeSize = 0, this._sizeLods = [], this._sigmas = [], this._lodMeshes = [], this._backgroundBox = null, this._cubemapMaterial = null, this._equirectMaterial = null, this._blurMaterial = null, this._ggxMaterial = null;
	}
	fromScene(e, t = 0, n = .1, r = 100, i = {}) {
		let { size: a = 256, position: o = Us } = i;
		zs = this._renderer.getRenderTarget(), Bs = this._renderer.getActiveCubeFace(), Vs = this._renderer.getActiveMipmapLevel(), Hs = this._renderer.xr.enabled, this._renderer.xr.enabled = !1, this._setSize(a);
		let s = this._allocateTargets();
		return s.depthBuffer = !0, this._sceneToCubeUV(e, n, r, s, o), t > 0 && this._blur(s, 0, 0, t), this._applyPMREM(s), this._cleanup(s), s;
	}
	fromEquirectangular(e, t = null) {
		return this._fromTexture(e, t);
	}
	fromCubemap(e, t = null) {
		return this._fromTexture(e, t);
	}
	compileCubemapShader() {
		this._cubemapMaterial === null && (this._cubemapMaterial = Zs(), this._compileMaterial(this._cubemapMaterial));
	}
	compileEquirectangularShader() {
		this._equirectMaterial === null && (this._equirectMaterial = Xs(), this._compileMaterial(this._equirectMaterial));
	}
	dispose() {
		this._dispose(), this._cubemapMaterial !== null && this._cubemapMaterial.dispose(), this._equirectMaterial !== null && this._equirectMaterial.dispose(), this._backgroundBox !== null && (this._backgroundBox.geometry.dispose(), this._backgroundBox.material.dispose());
	}
	_setSize(e) {
		this._lodMax = Math.floor(Math.log2(e)), this._cubeSize = 2 ** this._lodMax;
	}
	_dispose() {
		this._blurMaterial !== null && this._blurMaterial.dispose(), this._ggxMaterial !== null && this._ggxMaterial.dispose(), this._pingPongRenderTarget !== null && this._pingPongRenderTarget.dispose();
		for (let e = 0; e < this._lodMeshes.length; e++) this._lodMeshes[e].geometry.dispose();
	}
	_cleanup(e) {
		this._renderer.setRenderTarget(zs, Bs, Vs), this._renderer.xr.enabled = Hs, e.scissorTest = !1, qs(e, 0, 0, e.width, e.height);
	}
	_fromTexture(e, t) {
		e.mapping === 301 || e.mapping === 302 ? this._setSize(e.image.length === 0 ? 16 : e.image[0].width || e.image[0].image.width) : this._setSize(e.image.width / 4), zs = this._renderer.getRenderTarget(), Bs = this._renderer.getActiveCubeFace(), Vs = this._renderer.getActiveMipmapLevel(), Hs = this._renderer.xr.enabled, this._renderer.xr.enabled = !1;
		let n = t || this._allocateTargets();
		return this._textureToCubeUV(e, n), this._applyPMREM(n), this._cleanup(n), n;
	}
	_allocateTargets() {
		let e = 3 * Math.max(this._cubeSize, 112), t = 4 * this._cubeSize, n = {
			magFilter: Ue,
			minFilter: Ue,
			generateMipmaps: !1,
			type: $e,
			format: st,
			colorSpace: sn,
			depthBuffer: !1
		}, r = Ks(e, t, n);
		if (this._pingPongRenderTarget === null || this._pingPongRenderTarget.width !== e || this._pingPongRenderTarget.height !== t) {
			this._pingPongRenderTarget !== null && this._dispose(), this._pingPongRenderTarget = Ks(e, t, n);
			let { _lodMax: r } = this;
			({lodMeshes: this._lodMeshes, sizeLods: this._sizeLods, sigmas: this._sigmas} = Gs(r)), this._blurMaterial = Ys(r, e, t), this._ggxMaterial = Js(r, e, t);
		}
		return r;
	}
	_compileMaterial(e) {
		let t = new X(new Ki(), e);
		this._renderer.compile(t, Ls);
	}
	_sceneToCubeUV(e, t, n, r, i) {
		let a = new qo(90, 1, t, n), o = [
			1,
			-1,
			1,
			1,
			1,
			1
		], s = [
			1,
			1,
			1,
			-1,
			-1,
			-1
		], c = this._renderer, l = c.autoClear, u = c.toneMapping;
		c.getClearColor(Rs), c.toneMapping = 0, c.autoClear = !1, c.state.buffers.depth.getReversed() && (c.setRenderTarget(r), c.clearDepth(), c.setRenderTarget(null)), this._backgroundBox === null && (this._backgroundBox = new X(new Ya(), new ra({
			name: "PMREM.Background",
			side: 1,
			depthWrite: !1,
			depthTest: !1
		})));
		let d = this._backgroundBox, f = d.material, p = !1, m = e.background;
		m ? m.isColor && (f.color.copy(m), e.background = null, p = !0) : (f.color.copy(Rs), p = !0);
		for (let t = 0; t < 6; t++) {
			let n = t % 3;
			n === 0 ? (a.up.set(0, o[t], 0), a.position.set(i.x, i.y, i.z), a.lookAt(i.x + s[t], i.y, i.z)) : n === 1 ? (a.up.set(0, 0, o[t]), a.position.set(i.x, i.y, i.z), a.lookAt(i.x, i.y + s[t], i.z)) : (a.up.set(0, o[t], 0), a.position.set(i.x, i.y, i.z), a.lookAt(i.x, i.y, i.z + s[t]));
			let l = this._cubeSize;
			qs(r, n * l, t > 2 ? l : 0, l, l), c.setRenderTarget(r), p && c.render(d, a), c.render(e, a);
		}
		c.toneMapping = u, c.autoClear = l, e.background = m;
	}
	_textureToCubeUV(e, t) {
		let n = this._renderer, r = e.mapping === 301 || e.mapping === 302;
		r ? (this._cubemapMaterial === null && (this._cubemapMaterial = Zs()), this._cubemapMaterial.uniforms.flipEnvMap.value = e.isRenderTargetTexture === !1 ? -1 : 1) : this._equirectMaterial === null && (this._equirectMaterial = Xs());
		let i = r ? this._cubemapMaterial : this._equirectMaterial, a = this._lodMeshes[0];
		a.material = i;
		let o = i.uniforms;
		o.envMap.value = e;
		let s = this._cubeSize;
		qs(t, 0, 0, 3 * s, 2 * s), n.setRenderTarget(t), n.render(a, Ls);
	}
	_applyPMREM(e) {
		let t = this._renderer, n = t.autoClear;
		t.autoClear = !1;
		let r = this._lodMeshes.length;
		for (let t = 1; t < r; t++) this._applyGGXFilter(e, t - 1, t);
		t.autoClear = n;
	}
	_applyGGXFilter(e, t, n) {
		let r = this._renderer, i = this._pingPongRenderTarget, a = this._ggxMaterial, o = this._lodMeshes[n];
		o.material = a;
		let s = a.uniforms, c = n / (this._lodMeshes.length - 1), l = t / (this._lodMeshes.length - 1), u = Math.sqrt(c * c - l * l) * (0 + c * 1.25), { _lodMax: d } = this, f = this._sizeLods[n], p = 3 * f * (n > d - Ns ? n - d + Ns : 0), m = 4 * (this._cubeSize - f);
		s.envMap.value = e.texture, s.roughness.value = u, s.mipInt.value = d - t, qs(i, p, m, 3 * f, 2 * f), r.setRenderTarget(i), r.render(o, Ls), s.envMap.value = i.texture, s.roughness.value = 0, s.mipInt.value = d - n, qs(e, p, m, 3 * f, 2 * f), r.setRenderTarget(e), r.render(o, Ls);
	}
	_blur(e, t, n, r, i) {
		let a = this._pingPongRenderTarget;
		this._halfBlur(e, a, t, n, r, "latitudinal", i), this._halfBlur(a, e, n, n, r, "longitudinal", i);
	}
	_halfBlur(e, t, n, r, i, a, o) {
		let s = this._renderer, c = this._blurMaterial;
		a !== "latitudinal" && a !== "longitudinal" && V("blur direction must be either latitudinal or longitudinal!");
		let l = this._lodMeshes[r];
		l.material = c;
		let u = c.uniforms, d = this._sizeLods[n] - 1, f = isFinite(i) ? Math.PI / (2 * d) : 2 * Math.PI / (2 * Fs - 1), p = i / f, m = isFinite(i) ? 1 + Math.floor(3 * p) : Fs;
		m > Fs && B(`sigmaRadians, ${i}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Fs}`);
		let h = [], g = 0;
		for (let e = 0; e < Fs; ++e) {
			let t = e / p, n = Math.exp(-t * t / 2);
			h.push(n), e === 0 ? g += n : e < m && (g += 2 * n);
		}
		for (let e = 0; e < h.length; e++) h[e] = h[e] / g;
		u.envMap.value = e.texture, u.samples.value = m, u.weights.value = h, u.latitudinal.value = a === "latitudinal", o && (u.poleAxis.value = o);
		let { _lodMax: _ } = this;
		u.dTheta.value = f, u.mipInt.value = _ - n;
		let v = this._sizeLods[r];
		qs(t, 3 * v * (r > _ - Ns ? r - _ + Ns : 0), 4 * (this._cubeSize - v), 3 * v, 2 * v), s.setRenderTarget(t), s.render(l, Ls);
	}
};
function Gs(e) {
	let t = [], n = [], r = [], i = e, a = e - Ns + 1 + Ps.length;
	for (let o = 0; o < a; o++) {
		let a = 2 ** i;
		t.push(a);
		let s = 1 / a;
		o > e - Ns ? s = Ps[o - e + Ns - 1] : o === 0 && (s = 0), n.push(s);
		let c = 1 / (a - 2), l = -c, u = 1 + c, d = [
			l,
			l,
			u,
			l,
			u,
			u,
			l,
			l,
			u,
			u,
			l,
			u
		], f = /* @__PURE__ */ new Float32Array(108), p = /* @__PURE__ */ new Float32Array(72), m = /* @__PURE__ */ new Float32Array(36);
		for (let e = 0; e < 6; e++) {
			let t = e % 3 * 2 / 3 - 1, n = e > 2 ? 0 : -1, r = [
				t,
				n,
				0,
				t + 2 / 3,
				n,
				0,
				t + 2 / 3,
				n + 1,
				0,
				t,
				n,
				0,
				t + 2 / 3,
				n + 1,
				0,
				t,
				n + 1,
				0
			];
			f.set(r, 18 * e), p.set(d, 12 * e);
			let i = [
				e,
				e,
				e,
				e,
				e,
				e
			];
			m.set(i, 6 * e);
		}
		let h = new Ki();
		h.setAttribute("position", new Mi(f, 3)), h.setAttribute("uv", new Mi(p, 2)), h.setAttribute("faceIndex", new Mi(m, 1)), r.push(new X(h, null)), i > Ns && i--;
	}
	return {
		lodMeshes: r,
		sizeLods: t,
		sigmas: n
	};
}
function Ks(e, t, n) {
	let r = new hr(e, t, n);
	return r.texture.mapping = 306, r.texture.name = "PMREM.cubeUv", r.scissorTest = !0, r;
}
function qs(e, t, n, r, i) {
	e.viewport.set(t, n, r, i), e.scissor.set(t, n, r, i);
}
function Js(e, t, n) {
	return new mo({
		name: "PMREMGGXConvolution",
		defines: {
			GGX_SAMPLES: Is,
			CUBEUV_TEXEL_WIDTH: 1 / t,
			CUBEUV_TEXEL_HEIGHT: 1 / n,
			CUBEUV_MAX_MIP: `${e}.0`
		},
		uniforms: {
			envMap: { value: null },
			roughness: { value: 0 },
			mipInt: { value: 0 }
		},
		vertexShader: Qs(),
		fragmentShader: "\n\n			precision highp float;\n			precision highp int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n			uniform float roughness;\n			uniform float mipInt;\n\n			#define ENVMAP_TYPE_CUBE_UV\n			#include <cube_uv_reflection_fragment>\n\n			#define PI 3.14159265359\n\n			// Van der Corput radical inverse\n			float radicalInverse_VdC(uint bits) {\n				bits = (bits << 16u) | (bits >> 16u);\n				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);\n				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);\n				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);\n				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);\n				return float(bits) * 2.3283064365386963e-10; // / 0x100000000\n			}\n\n			// Hammersley sequence\n			vec2 hammersley(uint i, uint N) {\n				return vec2(float(i) / float(N), radicalInverse_VdC(i));\n			}\n\n			// GGX VNDF importance sampling (Eric Heitz 2018)\n			// \"Sampling the GGX Distribution of Visible Normals\"\n			// https://jcgt.org/published/0007/04/01/\n			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {\n				float alpha = roughness * roughness;\n\n				// Section 4.1: Orthonormal basis\n				vec3 T1 = vec3(1.0, 0.0, 0.0);\n				vec3 T2 = cross(V, T1);\n\n				// Section 4.2: Parameterization of projected area\n				float r = sqrt(Xi.x);\n				float phi = 2.0 * PI * Xi.y;\n				float t1 = r * cos(phi);\n				float t2 = r * sin(phi);\n				float s = 0.5 * (1.0 + V.z);\n				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;\n\n				// Section 4.3: Reprojection onto hemisphere\n				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;\n\n				// Section 3.4: Transform back to ellipsoid configuration\n				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));\n			}\n\n			void main() {\n				vec3 N = normalize(vOutputDirection);\n				vec3 V = N; // Assume view direction equals normal for pre-filtering\n\n				vec3 prefilteredColor = vec3(0.0);\n				float totalWeight = 0.0;\n\n				// For very low roughness, just sample the environment directly\n				if (roughness < 0.001) {\n					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);\n					return;\n				}\n\n				// Tangent space basis for VNDF sampling\n				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n				vec3 tangent = normalize(cross(up, N));\n				vec3 bitangent = cross(N, tangent);\n\n				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {\n					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));\n\n					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)\n					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);\n\n					// Transform H back to world space\n					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);\n					vec3 L = normalize(2.0 * dot(V, H) * H - V);\n\n					float NdotL = max(dot(N, L), 0.0);\n\n					if(NdotL > 0.0) {\n						// Sample environment at fixed mip level\n						// VNDF importance sampling handles the distribution filtering\n						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);\n\n						// Weight by NdotL for the split-sum approximation\n						// VNDF PDF naturally accounts for the visible microfacet distribution\n						prefilteredColor += sampleColor * NdotL;\n						totalWeight += NdotL;\n					}\n				}\n\n				if (totalWeight > 0.0) {\n					prefilteredColor = prefilteredColor / totalWeight;\n				}\n\n				gl_FragColor = vec4(prefilteredColor, 1.0);\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Ys(e, t, n) {
	let r = new Float32Array(Fs), i = new W(0, 1, 0);
	return new mo({
		name: "SphericalGaussianBlur",
		defines: {
			n: Fs,
			CUBEUV_TEXEL_WIDTH: 1 / t,
			CUBEUV_TEXEL_HEIGHT: 1 / n,
			CUBEUV_MAX_MIP: `${e}.0`
		},
		uniforms: {
			envMap: { value: null },
			samples: { value: 1 },
			weights: { value: r },
			latitudinal: { value: !1 },
			dTheta: { value: 0 },
			mipInt: { value: 0 },
			poleAxis: { value: i }
		},
		vertexShader: Qs(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n			uniform int samples;\n			uniform float weights[ n ];\n			uniform bool latitudinal;\n			uniform float dTheta;\n			uniform float mipInt;\n			uniform vec3 poleAxis;\n\n			#define ENVMAP_TYPE_CUBE_UV\n			#include <cube_uv_reflection_fragment>\n\n			vec3 getSample( float theta, vec3 axis ) {\n\n				float cosTheta = cos( theta );\n				// Rodrigues' axis-angle rotation\n				vec3 sampleDirection = vOutputDirection * cosTheta\n					+ cross( axis, vOutputDirection ) * sin( theta )\n					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );\n\n				return bilinearCubeUV( envMap, sampleDirection, mipInt );\n\n			}\n\n			void main() {\n\n				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );\n\n				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {\n\n					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );\n\n				}\n\n				axis = normalize( axis );\n\n				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );\n\n				for ( int i = 1; i < n; i++ ) {\n\n					if ( i >= samples ) {\n\n						break;\n\n					}\n\n					float theta = dTheta * float( i );\n					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );\n					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );\n\n				}\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Xs() {
	return new mo({
		name: "EquirectangularToCubeUV",
		uniforms: { envMap: { value: null } },
		vertexShader: Qs(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n\n			#include <common>\n\n			void main() {\n\n				vec3 outputDirection = normalize( vOutputDirection );\n				vec2 uv = equirectUv( outputDirection );\n\n				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Zs() {
	return new mo({
		name: "CubemapToCubeUV",
		uniforms: {
			envMap: { value: null },
			flipEnvMap: { value: -1 }
		},
		vertexShader: Qs(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			uniform float flipEnvMap;\n\n			varying vec3 vOutputDirection;\n\n			uniform samplerCube envMap;\n\n			void main() {\n\n				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Qs() {
	return "\n\n		precision mediump float;\n		precision mediump int;\n\n		attribute float faceIndex;\n\n		varying vec3 vOutputDirection;\n\n		// RH coordinate system; PMREM face-indexing convention\n		vec3 getDirection( vec2 uv, float face ) {\n\n			uv = 2.0 * uv - 1.0;\n\n			vec3 direction = vec3( uv, 1.0 );\n\n			if ( face == 0.0 ) {\n\n				direction = direction.zyx; // ( 1, v, u ) pos x\n\n			} else if ( face == 1.0 ) {\n\n				direction = direction.xzy;\n				direction.xz *= -1.0; // ( -u, 1, -v ) pos y\n\n			} else if ( face == 2.0 ) {\n\n				direction.x *= -1.0; // ( -u, v, 1 ) pos z\n\n			} else if ( face == 3.0 ) {\n\n				direction = direction.zyx;\n				direction.xz *= -1.0; // ( -1, v, -u ) neg x\n\n			} else if ( face == 4.0 ) {\n\n				direction = direction.xzy;\n				direction.xy *= -1.0; // ( -u, -1, v ) neg y\n\n			} else if ( face == 5.0 ) {\n\n				direction.z *= -1.0; // ( u, v, -1 ) neg z\n\n			}\n\n			return direction;\n\n		}\n\n		void main() {\n\n			vOutputDirection = getDirection( uv, faceIndex );\n			gl_Position = vec4( position, 1.0 );\n\n		}\n	";
}
var $s = class extends hr {
	constructor(e = 1, t = {}) {
		super(e, e, t), this.isWebGLCubeRenderTarget = !0;
		let n = {
			width: e,
			height: e,
			depth: 1
		}, r = [
			n,
			n,
			n,
			n,
			n,
			n
		];
		this.texture = new Ga(r), this._setTextureOptions(t), this.texture.isRenderTargetTexture = !0;
	}
	fromEquirectangularTexture(e, t) {
		this.texture.type = t.type, this.texture.colorSpace = t.colorSpace, this.texture.generateMipmaps = t.generateMipmaps, this.texture.minFilter = t.minFilter, this.texture.magFilter = t.magFilter;
		let n = {
			uniforms: { tEquirect: { value: null } },
			vertexShader: "\n\n				varying vec3 vWorldDirection;\n\n				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n\n					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n\n				}\n\n				void main() {\n\n					vWorldDirection = transformDirection( position, modelMatrix );\n\n					#include <begin_vertex>\n					#include <project_vertex>\n\n				}\n			",
			fragmentShader: "\n\n				uniform sampler2D tEquirect;\n\n				varying vec3 vWorldDirection;\n\n				#include <common>\n\n				void main() {\n\n					vec3 direction = normalize( vWorldDirection );\n\n					vec2 sampleUV = equirectUv( direction );\n\n					gl_FragColor = texture2D( tEquirect, sampleUV );\n\n				}\n			"
		}, r = new Ya(5, 5, 5), i = new mo({
			name: "CubemapFromEquirect",
			uniforms: ao(n.uniforms),
			vertexShader: n.vertexShader,
			fragmentShader: n.fragmentShader,
			side: 1,
			blending: 0
		});
		i.uniforms.tEquirect.value = t;
		let a = new X(r, i), o = t.minFilter;
		return t.minFilter === 1008 && (t.minFilter = Ue), new ns(1, 10, this).update(e, a), t.minFilter = o, a.geometry.dispose(), a.material.dispose(), this;
	}
	clear(e, t = !0, n = !0, r = !0) {
		let i = e.getRenderTarget();
		for (let i = 0; i < 6; i++) e.setRenderTarget(this, i), e.clear(t, n, r);
		e.setRenderTarget(i);
	}
};
function ec(e) {
	let t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = null;
	function i(e, t = !1) {
		return e == null ? null : t ? o(e) : a(e);
	}
	function a(n) {
		if (n && n.isTexture) {
			let r = n.mapping;
			if (r === 303 || r === 304) if (t.has(n)) {
				let e = t.get(n).texture;
				return s(e, n.mapping);
			} else {
				let r = n.image;
				if (r && r.height > 0) {
					let i = new $s(r.height);
					return i.fromEquirectangularTexture(e, n), t.set(n, i), n.addEventListener("dispose", l), s(i.texture, n.mapping);
				} else return null;
			}
		}
		return n;
	}
	function o(t) {
		if (t && t.isTexture) {
			let i = t.mapping, a = i === 303 || i === 304, o = i === 301 || i === 302;
			if (a || o) {
				let i = n.get(t), s = i === void 0 ? 0 : i.texture.pmremVersion;
				if (t.isRenderTargetTexture && t.pmremVersion !== s) return r === null && (r = new Ws(e)), i = a ? r.fromEquirectangular(t, i) : r.fromCubemap(t, i), i.texture.pmremVersion = t.pmremVersion, n.set(t, i), i.texture;
				if (i !== void 0) return i.texture;
				{
					let s = t.image;
					return a && s && s.height > 0 || o && s && c(s) ? (r === null && (r = new Ws(e)), i = a ? r.fromEquirectangular(t) : r.fromCubemap(t), i.texture.pmremVersion = t.pmremVersion, n.set(t, i), t.addEventListener("dispose", u), i.texture) : null;
				}
			}
		}
		return t;
	}
	function s(e, t) {
		return t === 303 ? e.mapping = 301 : t === 304 && (e.mapping = 302), e;
	}
	function c(e) {
		let t = 0;
		for (let n = 0; n < 6; n++) e[n] !== void 0 && t++;
		return t === 6;
	}
	function l(e) {
		let n = e.target;
		n.removeEventListener("dispose", l);
		let r = t.get(n);
		r !== void 0 && (t.delete(n), r.dispose());
	}
	function u(e) {
		let t = e.target;
		t.removeEventListener("dispose", u);
		let r = n.get(t);
		r !== void 0 && (n.delete(t), r.dispose());
	}
	function d() {
		t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r !== null && (r.dispose(), r = null);
	}
	return {
		get: i,
		dispose: d
	};
}
function tc(e) {
	let t = {};
	function n(n) {
		if (t[n] !== void 0) return t[n];
		let r = e.getExtension(n);
		return t[n] = r, r;
	}
	return {
		has: function(e) {
			return n(e) !== null;
		},
		init: function() {
			n("EXT_color_buffer_float"), n("WEBGL_clip_cull_distance"), n("OES_texture_float_linear"), n("EXT_color_buffer_half_float"), n("WEBGL_multisampled_render_to_texture"), n("WEBGL_render_shared_exponent");
		},
		get: function(e) {
			let t = n(e);
			return t === null && bn("WebGLRenderer: " + e + " extension not supported."), t;
		}
	};
}
function nc(e, t, n, r) {
	let i = {}, a = /* @__PURE__ */ new WeakMap();
	function o(e) {
		let s = e.target;
		s.index !== null && t.remove(s.index);
		for (let e in s.attributes) t.remove(s.attributes[e]);
		s.removeEventListener("dispose", o), delete i[s.id];
		let c = a.get(s);
		c && (t.remove(c), a.delete(s)), r.releaseStatesOfGeometry(s), s.isInstancedBufferGeometry === !0 && delete s._maxInstanceCount, n.memory.geometries--;
	}
	function s(e, t) {
		return i[t.id] === !0 ? t : (t.addEventListener("dispose", o), i[t.id] = !0, n.memory.geometries++, t);
	}
	function c(n) {
		let r = n.attributes;
		for (let n in r) t.update(r[n], e.ARRAY_BUFFER);
	}
	function l(e) {
		let n = [], r = e.index, i = e.attributes.position, o = 0;
		if (i === void 0) return;
		if (r !== null) {
			let e = r.array;
			o = r.version;
			for (let t = 0, r = e.length; t < r; t += 3) {
				let r = e[t + 0], i = e[t + 1], a = e[t + 2];
				n.push(r, i, i, a, a, r);
			}
		} else {
			let e = i.array;
			o = i.version;
			for (let t = 0, r = e.length / 3 - 1; t < r; t += 3) {
				let e = t + 0, r = t + 1, i = t + 2;
				n.push(e, r, r, i, i, e);
			}
		}
		let s = new (i.count >= 65535 ? Pi : Ni)(n, 1);
		s.version = o;
		let c = a.get(e);
		c && t.remove(c), a.set(e, s);
	}
	function u(e) {
		let t = a.get(e);
		if (t) {
			let n = e.index;
			n !== null && t.version < n.version && l(e);
		} else l(e);
		return a.get(e);
	}
	return {
		get: s,
		update: c,
		getWireframeAttribute: u
	};
}
function rc(e, t, n) {
	let r;
	function i(e) {
		r = e;
	}
	let a, o;
	function s(e) {
		a = e.type, o = e.bytesPerElement;
	}
	function c(t, i) {
		e.drawElements(r, i, a, t * o), n.update(i, r, 1);
	}
	function l(t, i, s) {
		s !== 0 && (e.drawElementsInstanced(r, i, a, t * o, s), n.update(i, r, s));
	}
	function u(e, i, o) {
		if (o === 0) return;
		t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(r, i, 0, a, e, 0, o);
		let s = 0;
		for (let e = 0; e < o; e++) s += i[e];
		n.update(s, r, 1);
	}
	this.setMode = i, this.setIndex = s, this.render = c, this.renderInstances = l, this.renderMultiDraw = u;
}
function ic(e) {
	let t = {
		geometries: 0,
		textures: 0
	}, n = {
		frame: 0,
		calls: 0,
		triangles: 0,
		points: 0,
		lines: 0
	};
	function r(t, r, i) {
		switch (n.calls++, r) {
			case e.TRIANGLES:
				n.triangles += t / 3 * i;
				break;
			case e.LINES:
				n.lines += t / 2 * i;
				break;
			case e.LINE_STRIP:
				n.lines += i * (t - 1);
				break;
			case e.LINE_LOOP:
				n.lines += i * t;
				break;
			case e.POINTS:
				n.points += i * t;
				break;
			default:
				V("WebGLInfo: Unknown draw mode:", r);
				break;
		}
	}
	function i() {
		n.calls = 0, n.triangles = 0, n.points = 0, n.lines = 0;
	}
	return {
		memory: t,
		render: n,
		programs: null,
		autoReset: !0,
		reset: i,
		update: r
	};
}
function ac(e, t, n) {
	let r = /* @__PURE__ */ new WeakMap(), i = new pr();
	function a(a, o, s) {
		let c = a.morphTargetInfluences, l = o.morphAttributes.position || o.morphAttributes.normal || o.morphAttributes.color, u = l === void 0 ? 0 : l.length, d = r.get(o);
		if (d === void 0 || d.count !== u) {
			d !== void 0 && d.texture.dispose();
			let e = o.morphAttributes.position !== void 0, n = o.morphAttributes.normal !== void 0, a = o.morphAttributes.color !== void 0, s = o.morphAttributes.position || [], c = o.morphAttributes.normal || [], l = o.morphAttributes.color || [], f = 0;
			e === !0 && (f = 1), n === !0 && (f = 2), a === !0 && (f = 3);
			let p = o.attributes.position.count * f, m = 1;
			p > t.maxTextureSize && (m = Math.ceil(p / t.maxTextureSize), p = t.maxTextureSize);
			let h = new Float32Array(p * m * 4 * u), g = new gr(h, p, m, u);
			g.type = Qe, g.needsUpdate = !0;
			let _ = f * 4;
			for (let t = 0; t < u; t++) {
				let r = s[t], o = c[t], u = l[t], d = p * m * 4 * t;
				for (let t = 0; t < r.count; t++) {
					let s = t * _;
					e === !0 && (i.fromBufferAttribute(r, t), h[d + s + 0] = i.x, h[d + s + 1] = i.y, h[d + s + 2] = i.z, h[d + s + 3] = 0), n === !0 && (i.fromBufferAttribute(o, t), h[d + s + 4] = i.x, h[d + s + 5] = i.y, h[d + s + 6] = i.z, h[d + s + 7] = 0), a === !0 && (i.fromBufferAttribute(u, t), h[d + s + 8] = i.x, h[d + s + 9] = i.y, h[d + s + 10] = i.z, h[d + s + 11] = u.itemSize === 4 ? i.w : 1);
				}
			}
			d = {
				count: u,
				texture: g,
				size: new U(p, m)
			}, r.set(o, d);
			function v() {
				g.dispose(), r.delete(o), o.removeEventListener("dispose", v);
			}
			o.addEventListener("dispose", v);
		}
		if (a.isInstancedMesh === !0 && a.morphTexture !== null) s.getUniforms().setValue(e, "morphTexture", a.morphTexture, n);
		else {
			let t = 0;
			for (let e = 0; e < c.length; e++) t += c[e];
			let n = o.morphTargetsRelative ? 1 : 1 - t;
			s.getUniforms().setValue(e, "morphTargetBaseInfluence", n), s.getUniforms().setValue(e, "morphTargetInfluences", c);
		}
		s.getUniforms().setValue(e, "morphTargetsTexture", d.texture, n), s.getUniforms().setValue(e, "morphTargetsTextureSize", d.size);
	}
	return { update: a };
}
function oc(e, t, n, r, i) {
	let a = /* @__PURE__ */ new WeakMap();
	function o(r) {
		let o = i.render.frame, s = r.geometry, l = t.get(r, s);
		if (a.get(l) !== o && (t.update(l), a.set(l, o)), r.isInstancedMesh && (r.hasEventListener("dispose", c) === !1 && r.addEventListener("dispose", c), a.get(r) !== o && (n.update(r.instanceMatrix, e.ARRAY_BUFFER), r.instanceColor !== null && n.update(r.instanceColor, e.ARRAY_BUFFER), a.set(r, o))), r.isSkinnedMesh) {
			let e = r.skeleton;
			a.get(e) !== o && (e.update(), a.set(e, o));
		}
		return l;
	}
	function s() {
		a = /* @__PURE__ */ new WeakMap();
	}
	function c(e) {
		let t = e.target;
		t.removeEventListener("dispose", c), r.releaseStatesOfObject(t), n.remove(t.instanceMatrix), t.instanceColor !== null && n.remove(t.instanceColor);
	}
	return {
		update: o,
		dispose: s
	};
}
var sc = {
	1: "LINEAR_TONE_MAPPING",
	2: "REINHARD_TONE_MAPPING",
	3: "CINEON_TONE_MAPPING",
	4: "ACES_FILMIC_TONE_MAPPING",
	6: "AGX_TONE_MAPPING",
	7: "NEUTRAL_TONE_MAPPING",
	5: "CUSTOM_TONE_MAPPING"
};
function cc(e, t, n, r, i, a) {
	let o = new hr(t, n, {
		type: e,
		depthBuffer: i,
		stencilBuffer: a,
		samples: r ? 4 : 0,
		depthTexture: i ? new Ka(t, n) : void 0
	}), s = new hr(t, n, {
		type: $e,
		depthBuffer: !1,
		stencilBuffer: !1
	}), c = new Ki();
	c.setAttribute("position", new Y([
		-1,
		3,
		0,
		-1,
		-1,
		0,
		3,
		-1,
		0
	], 3)), c.setAttribute("uv", new Y([
		0,
		2,
		0,
		0,
		2,
		0
	], 2));
	let l = new ho({
		uniforms: { tDiffuse: { value: null } },
		vertexShader: "\n			precision highp float;\n\n			uniform mat4 modelViewMatrix;\n			uniform mat4 projectionMatrix;\n\n			attribute vec3 position;\n			attribute vec2 uv;\n\n			varying vec2 vUv;\n\n			void main() {\n				vUv = uv;\n				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n			}",
		fragmentShader: "\n			precision highp float;\n\n			uniform sampler2D tDiffuse;\n\n			varying vec2 vUv;\n\n			#include <tonemapping_pars_fragment>\n			#include <colorspace_pars_fragment>\n\n			void main() {\n				gl_FragColor = texture2D( tDiffuse, vUv );\n\n				#ifdef LINEAR_TONE_MAPPING\n					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );\n				#elif defined( REINHARD_TONE_MAPPING )\n					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );\n				#elif defined( CINEON_TONE_MAPPING )\n					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );\n				#elif defined( ACES_FILMIC_TONE_MAPPING )\n					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );\n				#elif defined( AGX_TONE_MAPPING )\n					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );\n				#elif defined( NEUTRAL_TONE_MAPPING )\n					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );\n				#elif defined( CUSTOM_TONE_MAPPING )\n					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );\n				#endif\n\n				#ifdef SRGB_TRANSFER\n					gl_FragColor = sRGBTransferOETF( gl_FragColor );\n				#endif\n			}",
		depthTest: !1,
		depthWrite: !1
	}), u = new X(c, l), d = new Xo(-1, 1, 1, -1, 0, 1), f = null, p = null, m = !1, h, g = null, _ = [], v = !1;
	this.setSize = function(e, t) {
		o.setSize(e, t), s.setSize(e, t);
		for (let n = 0; n < _.length; n++) {
			let r = _[n];
			r.setSize && r.setSize(e, t);
		}
	}, this.setEffects = function(e) {
		_ = e, v = _.length > 0 && _[0].isRenderPass === !0;
		let t = o.width, n = o.height;
		for (let e = 0; e < _.length; e++) {
			let r = _[e];
			r.setSize && r.setSize(t, n);
		}
	}, this.begin = function(e, t) {
		if (m || e.toneMapping === 0 && _.length === 0) return !1;
		if (g = t, t !== null) {
			let e = t.width, n = t.height;
			(o.width !== e || o.height !== n) && this.setSize(e, n);
		}
		return v === !1 && e.setRenderTarget(o), h = e.toneMapping, e.toneMapping = 0, !0;
	}, this.hasRenderPass = function() {
		return v;
	}, this.end = function(e, t) {
		e.toneMapping = h, m = !0;
		let n = o, r = s;
		for (let i = 0; i < _.length; i++) {
			let a = _[i];
			if (a.enabled !== !1 && (a.render(e, r, n, t), a.needsSwap !== !1)) {
				let e = n;
				n = r, r = e;
			}
		}
		if (f !== e.outputColorSpace || p !== e.toneMapping) {
			f = e.outputColorSpace, p = e.toneMapping, l.defines = {}, K.getTransfer(f) === "srgb" && (l.defines.SRGB_TRANSFER = "");
			let t = sc[p];
			t && (l.defines[t] = ""), l.needsUpdate = !0;
		}
		l.uniforms.tDiffuse.value = n.texture, e.setRenderTarget(g), e.render(u, d), g = null, m = !1;
	}, this.isCompositing = function() {
		return m;
	}, this.dispose = function() {
		o.depthTexture && o.depthTexture.dispose(), o.dispose(), s.dispose(), c.dispose(), l.dispose();
	};
}
var lc = /*@__PURE__*/ new fr(), uc = /*@__PURE__*/ new Ka(1, 1), dc = /*@__PURE__*/ new gr(), fc = /*@__PURE__*/ new _r(), pc = /*@__PURE__*/ new Ga(), mc = [], hc = [], gc = /* @__PURE__ */ new Float32Array(16), _c = /* @__PURE__ */ new Float32Array(9), vc = /* @__PURE__ */ new Float32Array(4);
function yc(e, t, n) {
	let r = e[0];
	if (r <= 0 || r > 0) return e;
	let i = t * n, a = mc[i];
	if (a === void 0 && (a = new Float32Array(i), mc[i] = a), t !== 0) {
		r.toArray(a, 0);
		for (let r = 1, i = 0; r !== t; ++r) i += n, e[r].toArray(a, i);
	}
	return a;
}
function bc(e, t) {
	if (e.length !== t.length) return !1;
	for (let n = 0, r = e.length; n < r; n++) if (e[n] !== t[n]) return !1;
	return !0;
}
function xc(e, t) {
	for (let n = 0, r = t.length; n < r; n++) e[n] = t[n];
}
function Sc(e, t) {
	let n = hc[t];
	n === void 0 && (n = new Int32Array(t), hc[t] = n);
	for (let r = 0; r !== t; ++r) n[r] = e.allocateTextureUnit();
	return n;
}
function Cc(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1f(this.addr, t), n[0] = t);
}
function wc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2f(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if (bc(n, t)) return;
		e.uniform2fv(this.addr, t), xc(n, t);
	}
}
function Tc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3f(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else if (t.r !== void 0) (n[0] !== t.r || n[1] !== t.g || n[2] !== t.b) && (e.uniform3f(this.addr, t.r, t.g, t.b), n[0] = t.r, n[1] = t.g, n[2] = t.b);
	else {
		if (bc(n, t)) return;
		e.uniform3fv(this.addr, t), xc(n, t);
	}
}
function Ec(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4f(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if (bc(n, t)) return;
		e.uniform4fv(this.addr, t), xc(n, t);
	}
}
function Dc(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if (bc(n, t)) return;
		e.uniformMatrix2fv(this.addr, !1, t), xc(n, t);
	} else {
		if (bc(n, r)) return;
		vc.set(r), e.uniformMatrix2fv(this.addr, !1, vc), xc(n, r);
	}
}
function Oc(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if (bc(n, t)) return;
		e.uniformMatrix3fv(this.addr, !1, t), xc(n, t);
	} else {
		if (bc(n, r)) return;
		_c.set(r), e.uniformMatrix3fv(this.addr, !1, _c), xc(n, r);
	}
}
function kc(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if (bc(n, t)) return;
		e.uniformMatrix4fv(this.addr, !1, t), xc(n, t);
	} else {
		if (bc(n, r)) return;
		gc.set(r), e.uniformMatrix4fv(this.addr, !1, gc), xc(n, r);
	}
}
function Ac(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1i(this.addr, t), n[0] = t);
}
function jc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2i(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if (bc(n, t)) return;
		e.uniform2iv(this.addr, t), xc(n, t);
	}
}
function Mc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3i(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else {
		if (bc(n, t)) return;
		e.uniform3iv(this.addr, t), xc(n, t);
	}
}
function Nc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4i(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if (bc(n, t)) return;
		e.uniform4iv(this.addr, t), xc(n, t);
	}
}
function Pc(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1ui(this.addr, t), n[0] = t);
}
function Fc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2ui(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if (bc(n, t)) return;
		e.uniform2uiv(this.addr, t), xc(n, t);
	}
}
function Ic(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3ui(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else {
		if (bc(n, t)) return;
		e.uniform3uiv(this.addr, t), xc(n, t);
	}
}
function Lc(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4ui(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if (bc(n, t)) return;
		e.uniform4uiv(this.addr, t), xc(n, t);
	}
}
function Rc(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i);
	let a;
	this.type === e.SAMPLER_2D_SHADOW ? (uc.compareFunction = n.isReversedDepthBuffer() ? 518 : 515, a = uc) : a = lc, n.setTexture2D(t || a, i);
}
function zc(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTexture3D(t || fc, i);
}
function Bc(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTextureCube(t || pc, i);
}
function Vc(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTexture2DArray(t || dc, i);
}
function Hc(e) {
	switch (e) {
		case 5126: return Cc;
		case 35664: return wc;
		case 35665: return Tc;
		case 35666: return Ec;
		case 35674: return Dc;
		case 35675: return Oc;
		case 35676: return kc;
		case 5124:
		case 35670: return Ac;
		case 35667:
		case 35671: return jc;
		case 35668:
		case 35672: return Mc;
		case 35669:
		case 35673: return Nc;
		case 5125: return Pc;
		case 36294: return Fc;
		case 36295: return Ic;
		case 36296: return Lc;
		case 35678:
		case 36198:
		case 36298:
		case 36306:
		case 35682: return Rc;
		case 35679:
		case 36299:
		case 36307: return zc;
		case 35680:
		case 36300:
		case 36308:
		case 36293: return Bc;
		case 36289:
		case 36303:
		case 36311:
		case 36292: return Vc;
	}
}
function Uc(e, t) {
	e.uniform1fv(this.addr, t);
}
function Wc(e, t) {
	let n = yc(t, this.size, 2);
	e.uniform2fv(this.addr, n);
}
function Gc(e, t) {
	let n = yc(t, this.size, 3);
	e.uniform3fv(this.addr, n);
}
function Kc(e, t) {
	let n = yc(t, this.size, 4);
	e.uniform4fv(this.addr, n);
}
function qc(e, t) {
	let n = yc(t, this.size, 4);
	e.uniformMatrix2fv(this.addr, !1, n);
}
function Jc(e, t) {
	let n = yc(t, this.size, 9);
	e.uniformMatrix3fv(this.addr, !1, n);
}
function Yc(e, t) {
	let n = yc(t, this.size, 16);
	e.uniformMatrix4fv(this.addr, !1, n);
}
function Xc(e, t) {
	e.uniform1iv(this.addr, t);
}
function Zc(e, t) {
	e.uniform2iv(this.addr, t);
}
function Qc(e, t) {
	e.uniform3iv(this.addr, t);
}
function $c(e, t) {
	e.uniform4iv(this.addr, t);
}
function el(e, t) {
	e.uniform1uiv(this.addr, t);
}
function tl(e, t) {
	e.uniform2uiv(this.addr, t);
}
function nl(e, t) {
	e.uniform3uiv(this.addr, t);
}
function rl(e, t) {
	e.uniform4uiv(this.addr, t);
}
function il(e, t, n) {
	let r = this.cache, i = t.length, a = Sc(n, i);
	bc(r, a) || (e.uniform1iv(this.addr, a), xc(r, a));
	let o;
	o = this.type === e.SAMPLER_2D_SHADOW ? uc : lc;
	for (let e = 0; e !== i; ++e) n.setTexture2D(t[e] || o, a[e]);
}
function al(e, t, n) {
	let r = this.cache, i = t.length, a = Sc(n, i);
	bc(r, a) || (e.uniform1iv(this.addr, a), xc(r, a));
	for (let e = 0; e !== i; ++e) n.setTexture3D(t[e] || fc, a[e]);
}
function ol(e, t, n) {
	let r = this.cache, i = t.length, a = Sc(n, i);
	bc(r, a) || (e.uniform1iv(this.addr, a), xc(r, a));
	for (let e = 0; e !== i; ++e) n.setTextureCube(t[e] || pc, a[e]);
}
function sl(e, t, n) {
	let r = this.cache, i = t.length, a = Sc(n, i);
	bc(r, a) || (e.uniform1iv(this.addr, a), xc(r, a));
	for (let e = 0; e !== i; ++e) n.setTexture2DArray(t[e] || dc, a[e]);
}
function cl(e) {
	switch (e) {
		case 5126: return Uc;
		case 35664: return Wc;
		case 35665: return Gc;
		case 35666: return Kc;
		case 35674: return qc;
		case 35675: return Jc;
		case 35676: return Yc;
		case 5124:
		case 35670: return Xc;
		case 35667:
		case 35671: return Zc;
		case 35668:
		case 35672: return Qc;
		case 35669:
		case 35673: return $c;
		case 5125: return el;
		case 36294: return tl;
		case 36295: return nl;
		case 36296: return rl;
		case 35678:
		case 36198:
		case 36298:
		case 36306:
		case 35682: return il;
		case 35679:
		case 36299:
		case 36307: return al;
		case 35680:
		case 36300:
		case 36308:
		case 36293: return ol;
		case 36289:
		case 36303:
		case 36311:
		case 36292: return sl;
	}
}
var ll = class {
	constructor(e, t, n) {
		this.id = e, this.addr = n, this.cache = [], this.type = t.type, this.setValue = Hc(t.type);
	}
}, ul = class {
	constructor(e, t, n) {
		this.id = e, this.addr = n, this.cache = [], this.type = t.type, this.size = t.size, this.setValue = cl(t.type);
	}
}, dl = class {
	constructor(e) {
		this.id = e, this.seq = [], this.map = {};
	}
	setValue(e, t, n) {
		let r = this.seq;
		for (let i = 0, a = r.length; i !== a; ++i) {
			let a = r[i];
			a.setValue(e, t[a.id], n);
		}
	}
}, fl = /(\w+)(\])?(\[|\.)?/g;
function pl(e, t) {
	e.seq.push(t), e.map[t.id] = t;
}
function ml(e, t, n) {
	let r = e.name, i = r.length;
	for (fl.lastIndex = 0;;) {
		let a = fl.exec(r), o = fl.lastIndex, s = a[1], c = a[2] === "]", l = a[3];
		if (c && (s |= 0), l === void 0 || l === "[" && o + 2 === i) {
			pl(n, l === void 0 ? new ll(s, e, t) : new ul(s, e, t));
			break;
		} else {
			let e = n.map[s];
			e === void 0 && (e = new dl(s), pl(n, e)), n = e;
		}
	}
}
var hl = class {
	constructor(e, t) {
		this.seq = [], this.map = {};
		let n = e.getProgramParameter(t, e.ACTIVE_UNIFORMS);
		for (let r = 0; r < n; ++r) {
			let n = e.getActiveUniform(t, r);
			ml(n, e.getUniformLocation(t, n.name), this);
		}
		let r = [], i = [];
		for (let t of this.seq) t.type === e.SAMPLER_2D_SHADOW || t.type === e.SAMPLER_CUBE_SHADOW || t.type === e.SAMPLER_2D_ARRAY_SHADOW ? r.push(t) : i.push(t);
		r.length > 0 && (this.seq = r.concat(i));
	}
	setValue(e, t, n, r) {
		let i = this.map[t];
		i !== void 0 && i.setValue(e, n, r);
	}
	setOptional(e, t, n) {
		let r = t[n];
		r !== void 0 && this.setValue(e, n, r);
	}
	static upload(e, t, n, r) {
		for (let i = 0, a = t.length; i !== a; ++i) {
			let a = t[i], o = n[a.id];
			o.needsUpdate !== !1 && a.setValue(e, o.value, r);
		}
	}
	static seqWithValue(e, t) {
		let n = [];
		for (let r = 0, i = e.length; r !== i; ++r) {
			let i = e[r];
			i.id in t && n.push(i);
		}
		return n;
	}
};
function gl(e, t, n) {
	let r = e.createShader(t);
	return e.shaderSource(r, n), e.compileShader(r), r;
}
var _l = 37297, vl = 0;
function yl(e, t) {
	let n = e.split("\n"), r = [], i = Math.max(t - 6, 0), a = Math.min(t + 6, n.length);
	for (let e = i; e < a; e++) {
		let i = e + 1;
		r.push(`${i === t ? ">" : " "} ${i}: ${n[e]}`);
	}
	return r.join("\n");
}
var bl = /*@__PURE__*/ new G();
function xl(e) {
	K._getMatrix(bl, K.workingColorSpace, e);
	let t = `mat3( ${bl.elements.map((e) => e.toFixed(4))} )`;
	switch (K.getTransfer(e)) {
		case cn: return [t, "LinearTransferOETF"];
		case ln: return [t, "sRGBTransferOETF"];
		default: return B("WebGLProgram: Unsupported color space: ", e), [t, "LinearTransferOETF"];
	}
}
function Sl(e, t, n) {
	let r = e.getShaderParameter(t, e.COMPILE_STATUS), i = (e.getShaderInfoLog(t) || "").trim();
	if (r && i === "") return "";
	let a = /ERROR: 0:(\d+)/.exec(i);
	if (a) {
		let r = parseInt(a[1]);
		return n.toUpperCase() + "\n\n" + i + "\n\n" + yl(e.getShaderSource(t), r);
	} else return i;
}
function Cl(e, t) {
	let n = xl(t);
	return [
		`vec4 ${e}( vec4 value ) {`,
		`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,
		"}"
	].join("\n");
}
var wl = {
	1: "Linear",
	2: "Reinhard",
	3: "Cineon",
	4: "ACESFilmic",
	6: "AgX",
	7: "Neutral",
	5: "Custom"
};
function Tl(e, t) {
	let n = wl[t];
	return n === void 0 ? (B("WebGLProgram: Unsupported toneMapping:", t), "vec3 " + e + "( vec3 color ) { return LinearToneMapping( color ); }") : "vec3 " + e + "( vec3 color ) { return " + n + "ToneMapping( color ); }";
}
var El = /*@__PURE__*/ new W();
function Dl() {
	return K.getLuminanceCoefficients(El), [
		"float luminance( const in vec3 rgb ) {",
		`	const vec3 weights = vec3( ${El.x.toFixed(4)}, ${El.y.toFixed(4)}, ${El.z.toFixed(4)} );`,
		"	return dot( weights, rgb );",
		"}"
	].join("\n");
}
function Ol(e) {
	return [e.extensionClipCullDistance ? "#extension GL_ANGLE_clip_cull_distance : require" : "", e.extensionMultiDraw ? "#extension GL_ANGLE_multi_draw : require" : ""].filter(jl).join("\n");
}
function kl(e) {
	let t = [];
	for (let n in e) {
		let r = e[n];
		r !== !1 && t.push("#define " + n + " " + r);
	}
	return t.join("\n");
}
function Al(e, t) {
	let n = {}, r = e.getProgramParameter(t, e.ACTIVE_ATTRIBUTES);
	for (let i = 0; i < r; i++) {
		let r = e.getActiveAttrib(t, i), a = r.name, o = 1;
		r.type === e.FLOAT_MAT2 && (o = 2), r.type === e.FLOAT_MAT3 && (o = 3), r.type === e.FLOAT_MAT4 && (o = 4), n[a] = {
			type: r.type,
			location: e.getAttribLocation(t, a),
			locationSize: o
		};
	}
	return n;
}
function jl(e) {
	return e !== "";
}
function Ml(e, t) {
	let n = t.numSpotLightShadows + t.numSpotLightMaps - t.numSpotLightShadowsWithMaps;
	return e.replace(/NUM_DIR_LIGHTS/g, t.numDirLights).replace(/NUM_SPOT_LIGHTS/g, t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g, t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g, n).replace(/NUM_RECT_AREA_LIGHTS/g, t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g, t.numPointLights).replace(/NUM_HEMI_LIGHTS/g, t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g, t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g, t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g, t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g, t.numPointLightShadows);
}
function Nl(e, t) {
	return e.replace(/NUM_CLIPPING_PLANES/g, t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g, t.numClippingPlanes - t.numClipIntersection);
}
var Pl = /^[ \t]*#include +<([\w\d./]+)>/gm;
function Fl(e) {
	return e.replace(Pl, Ll);
}
var Il = /* @__PURE__ */ new Map();
function Ll(e, t) {
	let n = Z[t];
	if (n === void 0) {
		let e = Il.get(t);
		if (e !== void 0) n = Z[e], B("WebGLRenderer: Shader chunk \"%s\" has been deprecated. Use \"%s\" instead.", t, e);
		else throw Error("THREE.WebGLProgram: Can not resolve #include <" + t + ">");
	}
	return Fl(n);
}
var Rl = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
function zl(e) {
	return e.replace(Rl, Bl);
}
function Bl(e, t, n, r) {
	let i = "";
	for (let e = parseInt(t); e < parseInt(n); e++) i += r.replace(/\[\s*i\s*\]/g, "[ " + e + " ]").replace(/UNROLLED_LOOP_INDEX/g, e);
	return i;
}
function Vl(e) {
	let t = `precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;
	return e.precision === "highp" ? t += "\n#define HIGH_PRECISION" : e.precision === "mediump" ? t += "\n#define MEDIUM_PRECISION" : e.precision === "lowp" && (t += "\n#define LOW_PRECISION"), t;
}
var Hl = {
	1: "SHADOWMAP_TYPE_PCF",
	3: "SHADOWMAP_TYPE_VSM"
};
function Ul(e) {
	return Hl[e.shadowMapType] || "SHADOWMAP_TYPE_BASIC";
}
var Wl = {
	301: "ENVMAP_TYPE_CUBE",
	302: "ENVMAP_TYPE_CUBE",
	306: "ENVMAP_TYPE_CUBE_UV"
};
function Gl(e) {
	return e.envMap === !1 ? "ENVMAP_TYPE_CUBE" : Wl[e.envMapMode] || "ENVMAP_TYPE_CUBE";
}
var Kl = { 302: "ENVMAP_MODE_REFRACTION" };
function ql(e) {
	return e.envMap === !1 ? "ENVMAP_MODE_REFLECTION" : Kl[e.envMapMode] || "ENVMAP_MODE_REFLECTION";
}
var Jl = {
	0: "ENVMAP_BLENDING_MULTIPLY",
	1: "ENVMAP_BLENDING_MIX",
	2: "ENVMAP_BLENDING_ADD"
};
function Yl(e) {
	return e.envMap === !1 ? "ENVMAP_BLENDING_NONE" : Jl[e.combine] || "ENVMAP_BLENDING_NONE";
}
function Xl(e) {
	let t = e.envMapCubeUVHeight;
	if (t === null) return null;
	let n = Math.log2(t) - 2, r = 1 / t;
	return {
		texelWidth: 1 / (3 * Math.max(2 ** n, 112)),
		texelHeight: r,
		maxMip: n
	};
}
function Zl(e, t, n, r) {
	let i = e.getContext(), a = n.defines, o = n.vertexShader, s = n.fragmentShader, c = Ul(n), l = Gl(n), u = ql(n), d = Yl(n), f = Xl(n), p = Ol(n), m = kl(a), h = i.createProgram(), g, _, v = n.glslVersion ? "#version " + n.glslVersion + "\n" : "";
	n.isRawShaderMaterial ? (g = [
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m
	].filter(jl).join("\n"), g.length > 0 && (g += "\n"), _ = [
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m
	].filter(jl).join("\n"), _.length > 0 && (_ += "\n")) : (g = [
		Vl(n),
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m,
		n.extensionClipCullDistance ? "#define USE_CLIP_DISTANCE" : "",
		n.batching ? "#define USE_BATCHING" : "",
		n.batchingColor ? "#define USE_BATCHING_COLOR" : "",
		n.instancing ? "#define USE_INSTANCING" : "",
		n.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
		n.instancingMorph ? "#define USE_INSTANCING_MORPH" : "",
		n.useFog && n.fog ? "#define USE_FOG" : "",
		n.useFog && n.fogExp2 ? "#define FOG_EXP2" : "",
		n.map ? "#define USE_MAP" : "",
		n.envMap ? "#define USE_ENVMAP" : "",
		n.envMap ? "#define " + u : "",
		n.lightMap ? "#define USE_LIGHTMAP" : "",
		n.aoMap ? "#define USE_AOMAP" : "",
		n.bumpMap ? "#define USE_BUMPMAP" : "",
		n.normalMap ? "#define USE_NORMALMAP" : "",
		n.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
		n.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
		n.displacementMap ? "#define USE_DISPLACEMENTMAP" : "",
		n.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
		n.anisotropy ? "#define USE_ANISOTROPY" : "",
		n.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
		n.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
		n.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
		n.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
		n.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
		n.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
		n.specularMap ? "#define USE_SPECULARMAP" : "",
		n.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
		n.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
		n.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
		n.metalnessMap ? "#define USE_METALNESSMAP" : "",
		n.alphaMap ? "#define USE_ALPHAMAP" : "",
		n.alphaHash ? "#define USE_ALPHAHASH" : "",
		n.transmission ? "#define USE_TRANSMISSION" : "",
		n.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
		n.thicknessMap ? "#define USE_THICKNESSMAP" : "",
		n.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
		n.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
		n.mapUv ? "#define MAP_UV " + n.mapUv : "",
		n.alphaMapUv ? "#define ALPHAMAP_UV " + n.alphaMapUv : "",
		n.lightMapUv ? "#define LIGHTMAP_UV " + n.lightMapUv : "",
		n.aoMapUv ? "#define AOMAP_UV " + n.aoMapUv : "",
		n.emissiveMapUv ? "#define EMISSIVEMAP_UV " + n.emissiveMapUv : "",
		n.bumpMapUv ? "#define BUMPMAP_UV " + n.bumpMapUv : "",
		n.normalMapUv ? "#define NORMALMAP_UV " + n.normalMapUv : "",
		n.displacementMapUv ? "#define DISPLACEMENTMAP_UV " + n.displacementMapUv : "",
		n.metalnessMapUv ? "#define METALNESSMAP_UV " + n.metalnessMapUv : "",
		n.roughnessMapUv ? "#define ROUGHNESSMAP_UV " + n.roughnessMapUv : "",
		n.anisotropyMapUv ? "#define ANISOTROPYMAP_UV " + n.anisotropyMapUv : "",
		n.clearcoatMapUv ? "#define CLEARCOATMAP_UV " + n.clearcoatMapUv : "",
		n.clearcoatNormalMapUv ? "#define CLEARCOAT_NORMALMAP_UV " + n.clearcoatNormalMapUv : "",
		n.clearcoatRoughnessMapUv ? "#define CLEARCOAT_ROUGHNESSMAP_UV " + n.clearcoatRoughnessMapUv : "",
		n.iridescenceMapUv ? "#define IRIDESCENCEMAP_UV " + n.iridescenceMapUv : "",
		n.iridescenceThicknessMapUv ? "#define IRIDESCENCE_THICKNESSMAP_UV " + n.iridescenceThicknessMapUv : "",
		n.sheenColorMapUv ? "#define SHEEN_COLORMAP_UV " + n.sheenColorMapUv : "",
		n.sheenRoughnessMapUv ? "#define SHEEN_ROUGHNESSMAP_UV " + n.sheenRoughnessMapUv : "",
		n.specularMapUv ? "#define SPECULARMAP_UV " + n.specularMapUv : "",
		n.specularColorMapUv ? "#define SPECULAR_COLORMAP_UV " + n.specularColorMapUv : "",
		n.specularIntensityMapUv ? "#define SPECULAR_INTENSITYMAP_UV " + n.specularIntensityMapUv : "",
		n.transmissionMapUv ? "#define TRANSMISSIONMAP_UV " + n.transmissionMapUv : "",
		n.thicknessMapUv ? "#define THICKNESSMAP_UV " + n.thicknessMapUv : "",
		n.vertexTangents && n.flatShading === !1 ? "#define USE_TANGENT" : "",
		n.vertexNormals ? "#define HAS_NORMAL" : "",
		n.vertexColors ? "#define USE_COLOR" : "",
		n.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
		n.vertexUv1s ? "#define USE_UV1" : "",
		n.vertexUv2s ? "#define USE_UV2" : "",
		n.vertexUv3s ? "#define USE_UV3" : "",
		n.pointsUvs ? "#define USE_POINTS_UV" : "",
		n.flatShading ? "#define FLAT_SHADED" : "",
		n.skinning ? "#define USE_SKINNING" : "",
		n.morphTargets ? "#define USE_MORPHTARGETS" : "",
		n.morphNormals && n.flatShading === !1 ? "#define USE_MORPHNORMALS" : "",
		n.morphColors ? "#define USE_MORPHCOLORS" : "",
		n.morphTargetsCount > 0 ? "#define MORPHTARGETS_TEXTURE_STRIDE " + n.morphTextureStride : "",
		n.morphTargetsCount > 0 ? "#define MORPHTARGETS_COUNT " + n.morphTargetsCount : "",
		n.doubleSided ? "#define DOUBLE_SIDED" : "",
		n.flipSided ? "#define FLIP_SIDED" : "",
		n.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
		n.shadowMapEnabled ? "#define " + c : "",
		n.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
		n.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
		n.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
		n.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
		"uniform mat4 modelMatrix;",
		"uniform mat4 modelViewMatrix;",
		"uniform mat4 projectionMatrix;",
		"uniform mat4 viewMatrix;",
		"uniform mat3 normalMatrix;",
		"uniform vec3 cameraPosition;",
		"uniform bool isOrthographic;",
		"#ifdef USE_INSTANCING",
		"	attribute mat4 instanceMatrix;",
		"#endif",
		"#ifdef USE_INSTANCING_COLOR",
		"	attribute vec3 instanceColor;",
		"#endif",
		"#ifdef USE_INSTANCING_MORPH",
		"	uniform sampler2D morphTexture;",
		"#endif",
		"attribute vec3 position;",
		"attribute vec3 normal;",
		"attribute vec2 uv;",
		"#ifdef USE_UV1",
		"	attribute vec2 uv1;",
		"#endif",
		"#ifdef USE_UV2",
		"	attribute vec2 uv2;",
		"#endif",
		"#ifdef USE_UV3",
		"	attribute vec2 uv3;",
		"#endif",
		"#ifdef USE_TANGENT",
		"	attribute vec4 tangent;",
		"#endif",
		"#if defined( USE_COLOR_ALPHA )",
		"	attribute vec4 color;",
		"#elif defined( USE_COLOR )",
		"	attribute vec3 color;",
		"#endif",
		"#ifdef USE_SKINNING",
		"	attribute vec4 skinIndex;",
		"	attribute vec4 skinWeight;",
		"#endif",
		"\n"
	].filter(jl).join("\n"), _ = [
		Vl(n),
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m,
		n.useFog && n.fog ? "#define USE_FOG" : "",
		n.useFog && n.fogExp2 ? "#define FOG_EXP2" : "",
		n.alphaToCoverage ? "#define ALPHA_TO_COVERAGE" : "",
		n.map ? "#define USE_MAP" : "",
		n.matcap ? "#define USE_MATCAP" : "",
		n.envMap ? "#define USE_ENVMAP" : "",
		n.envMap ? "#define " + l : "",
		n.envMap ? "#define " + u : "",
		n.envMap ? "#define " + d : "",
		f ? "#define CUBEUV_TEXEL_WIDTH " + f.texelWidth : "",
		f ? "#define CUBEUV_TEXEL_HEIGHT " + f.texelHeight : "",
		f ? "#define CUBEUV_MAX_MIP " + f.maxMip + ".0" : "",
		n.lightMap ? "#define USE_LIGHTMAP" : "",
		n.aoMap ? "#define USE_AOMAP" : "",
		n.bumpMap ? "#define USE_BUMPMAP" : "",
		n.normalMap ? "#define USE_NORMALMAP" : "",
		n.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
		n.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
		n.packedNormalMap ? "#define USE_PACKED_NORMALMAP" : "",
		n.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
		n.anisotropy ? "#define USE_ANISOTROPY" : "",
		n.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
		n.clearcoat ? "#define USE_CLEARCOAT" : "",
		n.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
		n.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
		n.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
		n.dispersion ? "#define USE_DISPERSION" : "",
		n.iridescence ? "#define USE_IRIDESCENCE" : "",
		n.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
		n.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
		n.specularMap ? "#define USE_SPECULARMAP" : "",
		n.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
		n.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
		n.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
		n.metalnessMap ? "#define USE_METALNESSMAP" : "",
		n.alphaMap ? "#define USE_ALPHAMAP" : "",
		n.alphaTest ? "#define USE_ALPHATEST" : "",
		n.alphaHash ? "#define USE_ALPHAHASH" : "",
		n.sheen ? "#define USE_SHEEN" : "",
		n.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
		n.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
		n.transmission ? "#define USE_TRANSMISSION" : "",
		n.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
		n.thicknessMap ? "#define USE_THICKNESSMAP" : "",
		n.vertexTangents && n.flatShading === !1 ? "#define USE_TANGENT" : "",
		n.vertexColors || n.instancingColor ? "#define USE_COLOR" : "",
		n.vertexAlphas || n.batchingColor ? "#define USE_COLOR_ALPHA" : "",
		n.vertexUv1s ? "#define USE_UV1" : "",
		n.vertexUv2s ? "#define USE_UV2" : "",
		n.vertexUv3s ? "#define USE_UV3" : "",
		n.pointsUvs ? "#define USE_POINTS_UV" : "",
		n.gradientMap ? "#define USE_GRADIENTMAP" : "",
		n.flatShading ? "#define FLAT_SHADED" : "",
		n.doubleSided ? "#define DOUBLE_SIDED" : "",
		n.flipSided ? "#define FLIP_SIDED" : "",
		n.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
		n.shadowMapEnabled ? "#define " + c : "",
		n.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
		n.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
		n.numLightProbeGrids > 0 ? "#define USE_LIGHT_PROBES_GRID" : "",
		n.decodeVideoTexture ? "#define DECODE_VIDEO_TEXTURE" : "",
		n.decodeVideoTextureEmissive ? "#define DECODE_VIDEO_TEXTURE_EMISSIVE" : "",
		n.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
		n.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
		"uniform mat4 viewMatrix;",
		"uniform vec3 cameraPosition;",
		"uniform bool isOrthographic;",
		n.toneMapping === 0 ? "" : "#define TONE_MAPPING",
		n.toneMapping === 0 ? "" : Z.tonemapping_pars_fragment,
		n.toneMapping === 0 ? "" : Tl("toneMapping", n.toneMapping),
		n.dithering ? "#define DITHERING" : "",
		n.opaque ? "#define OPAQUE" : "",
		Z.colorspace_pars_fragment,
		Cl("linearToOutputTexel", n.outputColorSpace),
		Dl(),
		n.useDepthPacking ? "#define DEPTH_PACKING " + n.depthPacking : "",
		"\n"
	].filter(jl).join("\n")), o = Fl(o), o = Ml(o, n), o = Nl(o, n), s = Fl(s), s = Ml(s, n), s = Nl(s, n), o = zl(o), s = zl(s), n.isRawShaderMaterial !== !0 && (v = "#version 300 es\n", g = [
		p,
		"#define attribute in",
		"#define varying out",
		"#define texture2D texture"
	].join("\n") + "\n" + g, _ = [
		"#define varying in",
		n.glslVersion === "300 es" ? "" : "layout(location = 0) out highp vec4 pc_fragColor;",
		n.glslVersion === "300 es" ? "" : "#define gl_FragColor pc_fragColor",
		"#define gl_FragDepthEXT gl_FragDepth",
		"#define texture2D texture",
		"#define textureCube texture",
		"#define texture2DProj textureProj",
		"#define texture2DLodEXT textureLod",
		"#define texture2DProjLodEXT textureProjLod",
		"#define textureCubeLodEXT textureLod",
		"#define texture2DGradEXT textureGrad",
		"#define texture2DProjGradEXT textureProjGrad",
		"#define textureCubeGradEXT textureGrad"
	].join("\n") + "\n" + _);
	let y = v + g + o, b = v + _ + s, x = gl(i, i.VERTEX_SHADER, y), S = gl(i, i.FRAGMENT_SHADER, b);
	i.attachShader(h, x), i.attachShader(h, S), n.index0AttributeName === void 0 ? n.hasPositionAttribute === !0 && i.bindAttribLocation(h, 0, "position") : i.bindAttribLocation(h, 0, n.index0AttributeName), i.linkProgram(h);
	function C(t) {
		if (e.debug.checkShaderErrors) {
			let n = i.getProgramInfoLog(h) || "", r = i.getShaderInfoLog(x) || "", a = i.getShaderInfoLog(S) || "", o = n.trim(), s = r.trim(), c = a.trim(), l = !0, u = !0;
			if (i.getProgramParameter(h, i.LINK_STATUS) === !1) if (l = !1, typeof e.debug.onShaderError == "function") e.debug.onShaderError(i, h, x, S);
			else {
				let e = Sl(i, x, "vertex"), n = Sl(i, S, "fragment");
				V("WebGLProgram: Shader Error " + i.getError() + " - VALIDATE_STATUS " + i.getProgramParameter(h, i.VALIDATE_STATUS) + "\n\nMaterial Name: " + t.name + "\nMaterial Type: " + t.type + "\n\nProgram Info Log: " + o + "\n" + e + "\n" + n);
			}
			else o === "" ? (s === "" || c === "") && (u = !1) : B("WebGLProgram: Program Info Log:", o);
			u && (t.diagnostics = {
				runnable: l,
				programLog: o,
				vertexShader: {
					log: s,
					prefix: g
				},
				fragmentShader: {
					log: c,
					prefix: _
				}
			});
		}
		i.deleteShader(x), i.deleteShader(S), w = new hl(i, h), T = Al(i, h);
	}
	let w;
	this.getUniforms = function() {
		return w === void 0 && C(this), w;
	};
	let T;
	this.getAttributes = function() {
		return T === void 0 && C(this), T;
	};
	let E = n.rendererExtensionParallelShaderCompile === !1;
	return this.isReady = function() {
		return E === !1 && (E = i.getProgramParameter(h, _l)), E;
	}, this.destroy = function() {
		r.releaseStatesOfProgram(this), i.deleteProgram(h), this.program = void 0;
	}, this.type = n.shaderType, this.name = n.shaderName, this.id = vl++, this.cacheKey = t, this.usedTimes = 1, this.program = h, this.vertexShader = x, this.fragmentShader = S, this;
}
var Ql = 0, $l = class {
	constructor() {
		this.shaderCache = /* @__PURE__ */ new Map(), this.materialCache = /* @__PURE__ */ new Map();
	}
	update(e, t, n) {
		let r = this._getShaderCacheForMaterial(e);
		return r.has(t) === !1 && (r.add(t), t.usedTimes++), r.has(n) === !1 && (r.add(n), n.usedTimes++), this;
	}
	remove(e) {
		let t = this.materialCache.get(e);
		for (let e of t) e.usedTimes--, e.usedTimes === 0 && this.shaderCache.delete(e.code);
		return this.materialCache.delete(e), this;
	}
	getVertexShaderStage(e) {
		return this._getShaderStage(e.vertexShader);
	}
	getFragmentShaderStage(e) {
		return this._getShaderStage(e.fragmentShader);
	}
	dispose() {
		this.shaderCache.clear(), this.materialCache.clear();
	}
	_getShaderCacheForMaterial(e) {
		let t = this.materialCache, n = t.get(e);
		return n === void 0 && (n = /* @__PURE__ */ new Set(), t.set(e, n)), n;
	}
	_getShaderStage(e) {
		let t = this.shaderCache, n = t.get(e);
		return n === void 0 && (n = new eu(e), t.set(e, n)), n;
	}
}, eu = class {
	constructor(e) {
		this.id = Ql++, this.code = e, this.usedTimes = 0;
	}
};
function tu(e) {
	return e === 1030 || e === 37490 || e === 36285;
}
function nu(e, t, n, r, i, a) {
	let o = new Or(), s = new $l(), c = /* @__PURE__ */ new Set(), l = [], u = /* @__PURE__ */ new Map(), d = r.logarithmicDepthBuffer, f = r.precision, p = {
		MeshDepthMaterial: "depth",
		MeshDistanceMaterial: "distance",
		MeshNormalMaterial: "normal",
		MeshBasicMaterial: "basic",
		MeshLambertMaterial: "lambert",
		MeshPhongMaterial: "phong",
		MeshToonMaterial: "toon",
		MeshStandardMaterial: "physical",
		MeshPhysicalMaterial: "physical",
		MeshMatcapMaterial: "matcap",
		LineBasicMaterial: "basic",
		LineDashedMaterial: "dashed",
		PointsMaterial: "points",
		ShadowMaterial: "shadow",
		SpriteMaterial: "sprite"
	};
	function m(e) {
		return c.add(e), e === 0 ? "uv" : `uv${e}`;
	}
	function h(i, o, l, u, h, g) {
		let _ = u.fog, v = h.geometry, y = i.isMeshStandardMaterial || i.isMeshLambertMaterial || i.isMeshPhongMaterial ? u.environment : null, b = i.isMeshStandardMaterial || i.isMeshLambertMaterial && !i.envMap || i.isMeshPhongMaterial && !i.envMap, x = t.get(i.envMap || y, b), S = x && x.mapping === 306 ? x.image.height : null, C = p[i.type];
		i.precision !== null && (f = r.getMaxPrecision(i.precision), f !== i.precision && B("WebGLProgram.getParameters:", i.precision, "not supported, using", f, "instead."));
		let w = v.morphAttributes.position || v.morphAttributes.normal || v.morphAttributes.color, T = w === void 0 ? 0 : w.length, E = 0;
		v.morphAttributes.position !== void 0 && (E = 1), v.morphAttributes.normal !== void 0 && (E = 2), v.morphAttributes.color !== void 0 && (E = 3);
		let D, O, k, A;
		if (C) {
			let e = ws[C];
			D = e.vertexShader, O = e.fragmentShader;
		} else {
			D = i.vertexShader, O = i.fragmentShader;
			let e = s.getVertexShaderStage(i), t = s.getFragmentShaderStage(i);
			s.update(i, e, t), k = e.id, A = t.id;
		}
		let j = e.getRenderTarget(), ee = e.state.buffers.depth.getReversed(), M = h.isInstancedMesh === !0, N = h.isBatchedMesh === !0, te = !!i.map, P = !!i.matcap, ne = !!x, re = !!i.aoMap, ie = !!i.lightMap, ae = !!i.bumpMap && i.wireframe === !1, oe = !!i.normalMap, se = !!i.displacementMap, F = !!i.emissiveMap, ce = !!i.metalnessMap, le = !!i.roughnessMap, ue = i.anisotropy > 0, de = i.clearcoat > 0, fe = i.dispersion > 0, pe = i.iridescence > 0, me = i.sheen > 0, he = i.transmission > 0, ge = ue && !!i.anisotropyMap, _e = de && !!i.clearcoatMap, ve = de && !!i.clearcoatNormalMap, ye = de && !!i.clearcoatRoughnessMap, be = pe && !!i.iridescenceMap, xe = pe && !!i.iridescenceThicknessMap, I = me && !!i.sheenColorMap, Se = me && !!i.sheenRoughnessMap, Ce = !!i.specularMap, we = !!i.specularColorMap, L = !!i.specularIntensityMap, Te = he && !!i.transmissionMap, R = he && !!i.thicknessMap, z = !!i.gradientMap, Ee = !!i.alphaMap, De = i.alphaTest > 0, Oe = !!i.alphaHash, ke = !!i.extensions, Ae = 0;
		i.toneMapped && (j === null || j.isXRRenderTarget === !0) && (Ae = e.toneMapping);
		let je = {
			shaderID: C,
			shaderType: i.type,
			shaderName: i.name,
			vertexShader: D,
			fragmentShader: O,
			defines: i.defines,
			customVertexShaderID: k,
			customFragmentShaderID: A,
			isRawShaderMaterial: i.isRawShaderMaterial === !0,
			glslVersion: i.glslVersion,
			precision: f,
			batching: N,
			batchingColor: N && h._colorsTexture !== null,
			instancing: M,
			instancingColor: M && h.instanceColor !== null,
			instancingMorph: M && h.morphTexture !== null,
			outputColorSpace: j === null ? e.outputColorSpace : j.isXRRenderTarget === !0 ? j.texture.colorSpace : K.workingColorSpace,
			alphaToCoverage: !!i.alphaToCoverage,
			map: te,
			matcap: P,
			envMap: ne,
			envMapMode: ne && x.mapping,
			envMapCubeUVHeight: S,
			aoMap: re,
			lightMap: ie,
			bumpMap: ae,
			normalMap: oe,
			displacementMap: se,
			emissiveMap: F,
			normalMapObjectSpace: oe && i.normalMapType === 1,
			normalMapTangentSpace: oe && i.normalMapType === 0,
			packedNormalMap: oe && i.normalMapType === 0 && tu(i.normalMap.format),
			metalnessMap: ce,
			roughnessMap: le,
			anisotropy: ue,
			anisotropyMap: ge,
			clearcoat: de,
			clearcoatMap: _e,
			clearcoatNormalMap: ve,
			clearcoatRoughnessMap: ye,
			dispersion: fe,
			iridescence: pe,
			iridescenceMap: be,
			iridescenceThicknessMap: xe,
			sheen: me,
			sheenColorMap: I,
			sheenRoughnessMap: Se,
			specularMap: Ce,
			specularColorMap: we,
			specularIntensityMap: L,
			transmission: he,
			transmissionMap: Te,
			thicknessMap: R,
			gradientMap: z,
			opaque: i.transparent === !1 && i.blending === 1 && i.alphaToCoverage === !1,
			alphaMap: Ee,
			alphaTest: De,
			alphaHash: Oe,
			combine: i.combine,
			mapUv: te && m(i.map.channel),
			aoMapUv: re && m(i.aoMap.channel),
			lightMapUv: ie && m(i.lightMap.channel),
			bumpMapUv: ae && m(i.bumpMap.channel),
			normalMapUv: oe && m(i.normalMap.channel),
			displacementMapUv: se && m(i.displacementMap.channel),
			emissiveMapUv: F && m(i.emissiveMap.channel),
			metalnessMapUv: ce && m(i.metalnessMap.channel),
			roughnessMapUv: le && m(i.roughnessMap.channel),
			anisotropyMapUv: ge && m(i.anisotropyMap.channel),
			clearcoatMapUv: _e && m(i.clearcoatMap.channel),
			clearcoatNormalMapUv: ve && m(i.clearcoatNormalMap.channel),
			clearcoatRoughnessMapUv: ye && m(i.clearcoatRoughnessMap.channel),
			iridescenceMapUv: be && m(i.iridescenceMap.channel),
			iridescenceThicknessMapUv: xe && m(i.iridescenceThicknessMap.channel),
			sheenColorMapUv: I && m(i.sheenColorMap.channel),
			sheenRoughnessMapUv: Se && m(i.sheenRoughnessMap.channel),
			specularMapUv: Ce && m(i.specularMap.channel),
			specularColorMapUv: we && m(i.specularColorMap.channel),
			specularIntensityMapUv: L && m(i.specularIntensityMap.channel),
			transmissionMapUv: Te && m(i.transmissionMap.channel),
			thicknessMapUv: R && m(i.thicknessMap.channel),
			alphaMapUv: Ee && m(i.alphaMap.channel),
			vertexTangents: !!v.attributes.tangent && (oe || ue),
			vertexNormals: !!v.attributes.normal,
			vertexColors: i.vertexColors,
			vertexAlphas: i.vertexColors === !0 && !!v.attributes.color && v.attributes.color.itemSize === 4,
			pointsUvs: h.isPoints === !0 && !!v.attributes.uv && (te || Ee),
			fog: !!_,
			useFog: i.fog === !0,
			fogExp2: !!_ && _.isFogExp2,
			flatShading: i.wireframe === !1 && (i.flatShading === !0 || v.attributes.normal === void 0 && oe === !1 && (i.isMeshLambertMaterial || i.isMeshPhongMaterial || i.isMeshStandardMaterial || i.isMeshPhysicalMaterial)),
			sizeAttenuation: i.sizeAttenuation === !0,
			logarithmicDepthBuffer: d,
			reversedDepthBuffer: ee,
			skinning: h.isSkinnedMesh === !0,
			hasPositionAttribute: v.attributes.position !== void 0,
			morphTargets: v.morphAttributes.position !== void 0,
			morphNormals: v.morphAttributes.normal !== void 0,
			morphColors: v.morphAttributes.color !== void 0,
			morphTargetsCount: T,
			morphTextureStride: E,
			numDirLights: o.directional.length,
			numPointLights: o.point.length,
			numSpotLights: o.spot.length,
			numSpotLightMaps: o.spotLightMap.length,
			numRectAreaLights: o.rectArea.length,
			numHemiLights: o.hemi.length,
			numDirLightShadows: o.directionalShadowMap.length,
			numPointLightShadows: o.pointShadowMap.length,
			numSpotLightShadows: o.spotShadowMap.length,
			numSpotLightShadowsWithMaps: o.numSpotLightShadowsWithMaps,
			numLightProbes: o.numLightProbes,
			numLightProbeGrids: g.length,
			numClippingPlanes: a.numPlanes,
			numClipIntersection: a.numIntersection,
			dithering: i.dithering,
			shadowMapEnabled: e.shadowMap.enabled && l.length > 0,
			shadowMapType: e.shadowMap.type,
			toneMapping: Ae,
			decodeVideoTexture: te && i.map.isVideoTexture === !0 && K.getTransfer(i.map.colorSpace) === "srgb",
			decodeVideoTextureEmissive: F && i.emissiveMap.isVideoTexture === !0 && K.getTransfer(i.emissiveMap.colorSpace) === "srgb",
			premultipliedAlpha: i.premultipliedAlpha,
			doubleSided: i.side === 2,
			flipSided: i.side === 1,
			useDepthPacking: i.depthPacking >= 0,
			depthPacking: i.depthPacking || 0,
			index0AttributeName: i.index0AttributeName,
			extensionClipCullDistance: ke && i.extensions.clipCullDistance === !0 && n.has("WEBGL_clip_cull_distance"),
			extensionMultiDraw: (ke && i.extensions.multiDraw === !0 || N) && n.has("WEBGL_multi_draw"),
			rendererExtensionParallelShaderCompile: n.has("KHR_parallel_shader_compile"),
			customProgramCacheKey: i.customProgramCacheKey()
		};
		return je.vertexUv1s = c.has(1), je.vertexUv2s = c.has(2), je.vertexUv3s = c.has(3), c.clear(), je;
	}
	function g(t) {
		let n = [];
		if (t.shaderID ? n.push(t.shaderID) : (n.push(t.customVertexShaderID), n.push(t.customFragmentShaderID)), t.defines !== void 0) for (let e in t.defines) n.push(e), n.push(t.defines[e]);
		return t.isRawShaderMaterial === !1 && (_(n, t), v(n, t), n.push(e.outputColorSpace)), n.push(t.customProgramCacheKey), n.join();
	}
	function _(e, t) {
		e.push(t.precision), e.push(t.outputColorSpace), e.push(t.envMapMode), e.push(t.envMapCubeUVHeight), e.push(t.mapUv), e.push(t.alphaMapUv), e.push(t.lightMapUv), e.push(t.aoMapUv), e.push(t.bumpMapUv), e.push(t.normalMapUv), e.push(t.displacementMapUv), e.push(t.emissiveMapUv), e.push(t.metalnessMapUv), e.push(t.roughnessMapUv), e.push(t.anisotropyMapUv), e.push(t.clearcoatMapUv), e.push(t.clearcoatNormalMapUv), e.push(t.clearcoatRoughnessMapUv), e.push(t.iridescenceMapUv), e.push(t.iridescenceThicknessMapUv), e.push(t.sheenColorMapUv), e.push(t.sheenRoughnessMapUv), e.push(t.specularMapUv), e.push(t.specularColorMapUv), e.push(t.specularIntensityMapUv), e.push(t.transmissionMapUv), e.push(t.thicknessMapUv), e.push(t.combine), e.push(t.fogExp2), e.push(t.sizeAttenuation), e.push(t.morphTargetsCount), e.push(t.morphAttributeCount), e.push(t.numDirLights), e.push(t.numPointLights), e.push(t.numSpotLights), e.push(t.numSpotLightMaps), e.push(t.numHemiLights), e.push(t.numRectAreaLights), e.push(t.numDirLightShadows), e.push(t.numPointLightShadows), e.push(t.numSpotLightShadows), e.push(t.numSpotLightShadowsWithMaps), e.push(t.numLightProbes), e.push(t.shadowMapType), e.push(t.toneMapping), e.push(t.numClippingPlanes), e.push(t.numClipIntersection), e.push(t.depthPacking);
	}
	function v(e, t) {
		o.disableAll(), t.instancing && o.enable(0), t.instancingColor && o.enable(1), t.instancingMorph && o.enable(2), t.matcap && o.enable(3), t.envMap && o.enable(4), t.normalMapObjectSpace && o.enable(5), t.normalMapTangentSpace && o.enable(6), t.clearcoat && o.enable(7), t.iridescence && o.enable(8), t.alphaTest && o.enable(9), t.vertexColors && o.enable(10), t.vertexAlphas && o.enable(11), t.vertexUv1s && o.enable(12), t.vertexUv2s && o.enable(13), t.vertexUv3s && o.enable(14), t.vertexTangents && o.enable(15), t.anisotropy && o.enable(16), t.alphaHash && o.enable(17), t.batching && o.enable(18), t.dispersion && o.enable(19), t.batchingColor && o.enable(20), t.gradientMap && o.enable(21), t.packedNormalMap && o.enable(22), t.vertexNormals && o.enable(23), e.push(o.mask), o.disableAll(), t.fog && o.enable(0), t.useFog && o.enable(1), t.flatShading && o.enable(2), t.logarithmicDepthBuffer && o.enable(3), t.reversedDepthBuffer && o.enable(4), t.skinning && o.enable(5), t.morphTargets && o.enable(6), t.morphNormals && o.enable(7), t.morphColors && o.enable(8), t.premultipliedAlpha && o.enable(9), t.shadowMapEnabled && o.enable(10), t.doubleSided && o.enable(11), t.flipSided && o.enable(12), t.useDepthPacking && o.enable(13), t.dithering && o.enable(14), t.transmission && o.enable(15), t.sheen && o.enable(16), t.opaque && o.enable(17), t.pointsUvs && o.enable(18), t.decodeVideoTexture && o.enable(19), t.decodeVideoTextureEmissive && o.enable(20), t.alphaToCoverage && o.enable(21), t.numLightProbeGrids > 0 && o.enable(22), t.hasPositionAttribute && o.enable(23), e.push(o.mask);
	}
	function y(e) {
		let t = p[e.type], n;
		if (t) {
			let e = ws[t];
			n = uo.clone(e.uniforms);
		} else n = e.uniforms;
		return n;
	}
	function b(t, n) {
		let r = u.get(n);
		return r === void 0 ? (r = new Zl(e, n, t, i), l.push(r), u.set(n, r)) : ++r.usedTimes, r;
	}
	function x(e) {
		if (--e.usedTimes === 0) {
			let t = l.indexOf(e);
			l[t] = l[l.length - 1], l.pop(), u.delete(e.cacheKey), e.destroy();
		}
	}
	function S(e) {
		s.remove(e);
	}
	function C() {
		s.dispose();
	}
	return {
		getParameters: h,
		getProgramCacheKey: g,
		getUniforms: y,
		acquireProgram: b,
		releaseProgram: x,
		releaseShaderCache: S,
		programs: l,
		dispose: C
	};
}
function ru() {
	let e = /* @__PURE__ */ new WeakMap();
	function t(t) {
		return e.has(t);
	}
	function n(t) {
		let n = e.get(t);
		return n === void 0 && (n = {}, e.set(t, n)), n;
	}
	function r(t) {
		e.delete(t);
	}
	function i(t, n, r) {
		e.get(t)[n] = r;
	}
	function a() {
		e = /* @__PURE__ */ new WeakMap();
	}
	return {
		has: t,
		get: n,
		remove: r,
		update: i,
		dispose: a
	};
}
function iu(e, t) {
	return e.groupOrder === t.groupOrder ? e.renderOrder === t.renderOrder ? e.material.id === t.material.id ? e.materialVariant === t.materialVariant ? e.z === t.z ? e.id - t.id : e.z - t.z : e.materialVariant - t.materialVariant : e.material.id - t.material.id : e.renderOrder - t.renderOrder : e.groupOrder - t.groupOrder;
}
function au(e, t) {
	return e.groupOrder === t.groupOrder ? e.renderOrder === t.renderOrder ? e.z === t.z ? e.id - t.id : t.z - e.z : e.renderOrder - t.renderOrder : e.groupOrder - t.groupOrder;
}
function ou() {
	let e = [], t = 0, n = [], r = [], i = [];
	function a() {
		t = 0, n.length = 0, r.length = 0, i.length = 0;
	}
	function o(e) {
		let t = 0;
		return e.isInstancedMesh && (t += 2), e.isSkinnedMesh && (t += 1), t;
	}
	function s(n, r, i, a, s, c) {
		let l = e[t];
		return l === void 0 ? (l = {
			id: n.id,
			object: n,
			geometry: r,
			material: i,
			materialVariant: o(n),
			groupOrder: a,
			renderOrder: n.renderOrder,
			z: s,
			group: c
		}, e[t] = l) : (l.id = n.id, l.object = n, l.geometry = r, l.material = i, l.materialVariant = o(n), l.groupOrder = a, l.renderOrder = n.renderOrder, l.z = s, l.group = c), t++, l;
	}
	function c(e, t, a, o, c, l) {
		let u = s(e, t, a, o, c, l);
		a.transmission > 0 ? r.push(u) : a.transparent === !0 ? i.push(u) : n.push(u);
	}
	function l(e, t, a, o, c, l) {
		let u = s(e, t, a, o, c, l);
		a.transmission > 0 ? r.unshift(u) : a.transparent === !0 ? i.unshift(u) : n.unshift(u);
	}
	function u(e, t, a) {
		n.length > 1 && n.sort(e || iu), r.length > 1 && r.sort(t || au), i.length > 1 && i.sort(t || au), a && (n.reverse(), r.reverse(), i.reverse());
	}
	function d() {
		for (let n = t, r = e.length; n < r; n++) {
			let t = e[n];
			if (t.id === null) break;
			t.id = null, t.object = null, t.geometry = null, t.material = null, t.group = null;
		}
	}
	return {
		opaque: n,
		transmissive: r,
		transparent: i,
		init: a,
		push: c,
		unshift: l,
		finish: d,
		sort: u
	};
}
function su() {
	let e = /* @__PURE__ */ new WeakMap();
	function t(t, n) {
		let r = e.get(t), i;
		return r === void 0 ? (i = new ou(), e.set(t, [i])) : n >= r.length ? (i = new ou(), r.push(i)) : i = r[n], i;
	}
	function n() {
		e = /* @__PURE__ */ new WeakMap();
	}
	return {
		get: t,
		dispose: n
	};
}
function cu() {
	let e = {};
	return { get: function(t) {
		if (e[t.id] !== void 0) return e[t.id];
		let n;
		switch (t.type) {
			case "DirectionalLight":
				n = {
					direction: new W(),
					color: new J()
				};
				break;
			case "SpotLight":
				n = {
					position: new W(),
					direction: new W(),
					color: new J(),
					distance: 0,
					coneCos: 0,
					penumbraCos: 0,
					decay: 0
				};
				break;
			case "PointLight":
				n = {
					position: new W(),
					color: new J(),
					distance: 0,
					decay: 0
				};
				break;
			case "HemisphereLight":
				n = {
					direction: new W(),
					skyColor: new J(),
					groundColor: new J()
				};
				break;
			case "RectAreaLight":
				n = {
					color: new J(),
					position: new W(),
					halfWidth: new W(),
					halfHeight: new W()
				};
				break;
		}
		return e[t.id] = n, n;
	} };
}
function lu() {
	let e = {};
	return { get: function(t) {
		if (e[t.id] !== void 0) return e[t.id];
		let n;
		switch (t.type) {
			case "DirectionalLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new U()
				};
				break;
			case "SpotLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new U()
				};
				break;
			case "PointLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new U(),
					shadowCameraNear: 1,
					shadowCameraFar: 1e3
				};
				break;
		}
		return e[t.id] = n, n;
	} };
}
var uu = 0;
function du(e, t) {
	return (t.castShadow ? 2 : 0) - (e.castShadow ? 2 : 0) + +!!t.map - !!e.map;
}
function fu(e) {
	let t = new cu(), n = lu(), r = {
		version: 0,
		hash: {
			directionalLength: -1,
			pointLength: -1,
			spotLength: -1,
			rectAreaLength: -1,
			hemiLength: -1,
			numDirectionalShadows: -1,
			numPointShadows: -1,
			numSpotShadows: -1,
			numSpotMaps: -1,
			numLightProbes: -1
		},
		ambient: [
			0,
			0,
			0
		],
		probe: [],
		directional: [],
		directionalShadow: [],
		directionalShadowMap: [],
		directionalShadowMatrix: [],
		spot: [],
		spotLightMap: [],
		spotShadow: [],
		spotShadowMap: [],
		spotLightMatrix: [],
		rectArea: [],
		rectAreaLTC1: null,
		rectAreaLTC2: null,
		point: [],
		pointShadow: [],
		pointShadowMap: [],
		pointShadowMatrix: [],
		hemi: [],
		numSpotLightShadowsWithMaps: 0,
		numLightProbes: 0
	};
	for (let e = 0; e < 9; e++) r.probe.push(new W());
	let i = new W(), a = new q(), o = new q();
	function s(i) {
		let a = 0, o = 0, s = 0;
		for (let e = 0; e < 9; e++) r.probe[e].set(0, 0, 0);
		let c = 0, l = 0, u = 0, d = 0, f = 0, p = 0, m = 0, h = 0, g = 0, _ = 0, v = 0;
		i.sort(du);
		for (let e = 0, y = i.length; e < y; e++) {
			let y = i[e], b = y.color, x = y.intensity, S = y.distance, C = null;
			if (y.shadow && y.shadow.map && (C = y.shadow.map.texture.format === 1030 ? y.shadow.map.texture : y.shadow.map.depthTexture || y.shadow.map.texture), y.isAmbientLight) a += b.r * x, o += b.g * x, s += b.b * x;
			else if (y.isLightProbe) {
				for (let e = 0; e < 9; e++) r.probe[e].addScaledVector(y.sh.coefficients[e], x);
				v++;
			} else if (y.isDirectionalLight) {
				let e = t.get(y);
				if (e.color.copy(y.color).multiplyScalar(y.intensity), y.castShadow) {
					let e = y.shadow, t = n.get(y);
					t.shadowIntensity = e.intensity, t.shadowBias = e.bias, t.shadowNormalBias = e.normalBias, t.shadowRadius = e.radius, t.shadowMapSize = e.mapSize, r.directionalShadow[c] = t, r.directionalShadowMap[c] = C, r.directionalShadowMatrix[c] = y.shadow.matrix, p++;
				}
				r.directional[c] = e, c++;
			} else if (y.isSpotLight) {
				let e = t.get(y);
				e.position.setFromMatrixPosition(y.matrixWorld), e.color.copy(b).multiplyScalar(x), e.distance = S, e.coneCos = Math.cos(y.angle), e.penumbraCos = Math.cos(y.angle * (1 - y.penumbra)), e.decay = y.decay, r.spot[u] = e;
				let i = y.shadow;
				if (y.map && (r.spotLightMap[g] = y.map, g++, i.updateMatrices(y), y.castShadow && _++), r.spotLightMatrix[u] = i.matrix, y.castShadow) {
					let e = n.get(y);
					e.shadowIntensity = i.intensity, e.shadowBias = i.bias, e.shadowNormalBias = i.normalBias, e.shadowRadius = i.radius, e.shadowMapSize = i.mapSize, r.spotShadow[u] = e, r.spotShadowMap[u] = C, h++;
				}
				u++;
			} else if (y.isRectAreaLight) {
				let e = t.get(y);
				e.color.copy(b).multiplyScalar(x), e.halfWidth.set(y.width * .5, 0, 0), e.halfHeight.set(0, y.height * .5, 0), r.rectArea[d] = e, d++;
			} else if (y.isPointLight) {
				let e = t.get(y);
				if (e.color.copy(y.color).multiplyScalar(y.intensity), e.distance = y.distance, e.decay = y.decay, y.castShadow) {
					let e = y.shadow, t = n.get(y);
					t.shadowIntensity = e.intensity, t.shadowBias = e.bias, t.shadowNormalBias = e.normalBias, t.shadowRadius = e.radius, t.shadowMapSize = e.mapSize, t.shadowCameraNear = e.camera.near, t.shadowCameraFar = e.camera.far, r.pointShadow[l] = t, r.pointShadowMap[l] = C, r.pointShadowMatrix[l] = y.shadow.matrix, m++;
				}
				r.point[l] = e, l++;
			} else if (y.isHemisphereLight) {
				let e = t.get(y);
				e.skyColor.copy(y.color).multiplyScalar(x), e.groundColor.copy(y.groundColor).multiplyScalar(x), r.hemi[f] = e, f++;
			}
		}
		d > 0 && (e.has("OES_texture_float_linear") === !0 ? (r.rectAreaLTC1 = Q.LTC_FLOAT_1, r.rectAreaLTC2 = Q.LTC_FLOAT_2) : (r.rectAreaLTC1 = Q.LTC_HALF_1, r.rectAreaLTC2 = Q.LTC_HALF_2)), r.ambient[0] = a, r.ambient[1] = o, r.ambient[2] = s;
		let y = r.hash;
		(y.directionalLength !== c || y.pointLength !== l || y.spotLength !== u || y.rectAreaLength !== d || y.hemiLength !== f || y.numDirectionalShadows !== p || y.numPointShadows !== m || y.numSpotShadows !== h || y.numSpotMaps !== g || y.numLightProbes !== v) && (r.directional.length = c, r.spot.length = u, r.rectArea.length = d, r.point.length = l, r.hemi.length = f, r.directionalShadow.length = p, r.directionalShadowMap.length = p, r.pointShadow.length = m, r.pointShadowMap.length = m, r.spotShadow.length = h, r.spotShadowMap.length = h, r.directionalShadowMatrix.length = p, r.pointShadowMatrix.length = m, r.spotLightMatrix.length = h + g - _, r.spotLightMap.length = g, r.numSpotLightShadowsWithMaps = _, r.numLightProbes = v, y.directionalLength = c, y.pointLength = l, y.spotLength = u, y.rectAreaLength = d, y.hemiLength = f, y.numDirectionalShadows = p, y.numPointShadows = m, y.numSpotShadows = h, y.numSpotMaps = g, y.numLightProbes = v, r.version = uu++);
	}
	function c(e, t) {
		let n = 0, s = 0, c = 0, l = 0, u = 0, d = t.matrixWorldInverse;
		for (let t = 0, f = e.length; t < f; t++) {
			let f = e[t];
			if (f.isDirectionalLight) {
				let e = r.directional[n];
				e.direction.setFromMatrixPosition(f.matrixWorld), i.setFromMatrixPosition(f.target.matrixWorld), e.direction.sub(i), e.direction.transformDirection(d), n++;
			} else if (f.isSpotLight) {
				let e = r.spot[c];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), e.direction.setFromMatrixPosition(f.matrixWorld), i.setFromMatrixPosition(f.target.matrixWorld), e.direction.sub(i), e.direction.transformDirection(d), c++;
			} else if (f.isRectAreaLight) {
				let e = r.rectArea[l];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), o.identity(), a.copy(f.matrixWorld), a.premultiply(d), o.extractRotation(a), e.halfWidth.set(f.width * .5, 0, 0), e.halfHeight.set(0, f.height * .5, 0), e.halfWidth.applyMatrix4(o), e.halfHeight.applyMatrix4(o), l++;
			} else if (f.isPointLight) {
				let e = r.point[s];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), s++;
			} else if (f.isHemisphereLight) {
				let e = r.hemi[u];
				e.direction.setFromMatrixPosition(f.matrixWorld), e.direction.transformDirection(d), u++;
			}
		}
	}
	return {
		setup: s,
		setupView: c,
		state: r
	};
}
function pu(e) {
	let t = new fu(e), n = [], r = [], i = [];
	function a(e) {
		d.camera = e, n.length = 0, r.length = 0, i.length = 0;
	}
	function o(e) {
		n.push(e);
	}
	function s(e) {
		r.push(e);
	}
	function c(e) {
		i.push(e);
	}
	function l() {
		t.setup(n);
	}
	function u(e) {
		t.setupView(n, e);
	}
	let d = {
		lightsArray: n,
		shadowsArray: r,
		lightProbeGridArray: i,
		camera: null,
		lights: t,
		transmissionRenderTarget: {},
		textureUnits: 0
	};
	return {
		init: a,
		state: d,
		setupLights: l,
		setupLightsView: u,
		pushLight: o,
		pushShadow: s,
		pushLightProbeGrid: c
	};
}
function mu(e) {
	let t = /* @__PURE__ */ new WeakMap();
	function n(n, r = 0) {
		let i = t.get(n), a;
		return i === void 0 ? (a = new pu(e), t.set(n, [a])) : r >= i.length ? (a = new pu(e), i.push(a)) : a = i[r], a;
	}
	function r() {
		t = /* @__PURE__ */ new WeakMap();
	}
	return {
		get: n,
		dispose: r
	};
}
var hu = "void main() {\n	gl_Position = vec4( position, 1.0 );\n}", gu = "uniform sampler2D shadow_pass;\nuniform vec2 resolution;\nuniform float radius;\nvoid main() {\n	const float samples = float( VSM_SAMPLES );\n	float mean = 0.0;\n	float squared_mean = 0.0;\n	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );\n	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;\n	for ( float i = 0.0; i < samples; i ++ ) {\n		float uvOffset = uvStart + i * uvStride;\n		#ifdef HORIZONTAL_PASS\n			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;\n			mean += distribution.x;\n			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;\n		#else\n			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;\n			mean += depth;\n			squared_mean += depth * depth;\n		#endif\n	}\n	mean = mean / samples;\n	squared_mean = squared_mean / samples;\n	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );\n	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );\n}", _u = [
	/*@__PURE__*/ new W(1, 0, 0),
	/*@__PURE__*/ new W(-1, 0, 0),
	/*@__PURE__*/ new W(0, 1, 0),
	/*@__PURE__*/ new W(0, -1, 0),
	/*@__PURE__*/ new W(0, 0, 1),
	/*@__PURE__*/ new W(0, 0, -1)
], vu = [
	/*@__PURE__*/ new W(0, -1, 0),
	/*@__PURE__*/ new W(0, -1, 0),
	/*@__PURE__*/ new W(0, 0, 1),
	/*@__PURE__*/ new W(0, 0, -1),
	/*@__PURE__*/ new W(0, -1, 0),
	/*@__PURE__*/ new W(0, -1, 0)
], yu = /*@__PURE__*/ new q(), bu = /*@__PURE__*/ new W(), xu = /*@__PURE__*/ new W();
function Su(e, t, n) {
	let r = new Pa(), i = new U(), a = new U(), o = new pr(), s = new _o(), c = new vo(), l = {}, u = n.maxTextureSize, d = {
		0: 1,
		1: 0,
		2: 2
	}, f = new mo({
		defines: { VSM_SAMPLES: 8 },
		uniforms: {
			shadow_pass: { value: null },
			resolution: { value: new U() },
			radius: { value: 4 }
		},
		vertexShader: hu,
		fragmentShader: gu
	}), p = f.clone();
	p.defines.HORIZONTAL_PASS = 1;
	let m = new Ki();
	m.setAttribute("position", new Mi(new Float32Array([
		-1,
		-1,
		.5,
		3,
		-1,
		.5,
		-1,
		3,
		.5
	]), 3));
	let h = new X(m, f), g = this;
	this.enabled = !1, this.autoUpdate = !0, this.needsUpdate = !1, this.type = 1;
	let _ = this.type;
	this.render = function(t, n, s) {
		if (g.enabled === !1 || g.autoUpdate === !1 && g.needsUpdate === !1 || t.length === 0) return;
		this.type === 2 && (B("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."), this.type = 1);
		let c = e.getRenderTarget(), l = e.getActiveCubeFace(), d = e.getActiveMipmapLevel(), f = e.state;
		f.setBlending(0), f.buffers.depth.getReversed() === !0 ? f.buffers.color.setClear(0, 0, 0, 0) : f.buffers.color.setClear(1, 1, 1, 1), f.buffers.depth.setTest(!0), f.setScissorTest(!1);
		let p = _ !== this.type;
		p && n.traverse(function(e) {
			e.material && (Array.isArray(e.material) ? e.material.forEach((e) => e.needsUpdate = !0) : e.material.needsUpdate = !0);
		});
		for (let c = 0, l = t.length; c < l; c++) {
			let l = t[c], d = l.shadow;
			if (d === void 0) {
				B("WebGLShadowMap:", l, "has no shadow.");
				continue;
			}
			if (d.autoUpdate === !1 && d.needsUpdate === !1) continue;
			i.copy(d.mapSize);
			let m = d.getFrameExtents();
			i.multiply(m), a.copy(d.mapSize), (i.x > u || i.y > u) && (i.x > u && (a.x = Math.floor(u / m.x), i.x = a.x * m.x, d.mapSize.x = a.x), i.y > u && (a.y = Math.floor(u / m.y), i.y = a.y * m.y, d.mapSize.y = a.y));
			let h = e.state.buffers.depth.getReversed();
			if (d.camera._reversedDepth = h, d.map === null || p === !0) {
				if (d.map !== null && (d.map.depthTexture !== null && (d.map.depthTexture.dispose(), d.map.depthTexture = null), d.map.dispose()), this.type === 3) {
					if (l.isPointLight) {
						B("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");
						continue;
					}
					d.map = new hr(i.x, i.y, {
						format: ft,
						type: $e,
						minFilter: Ue,
						magFilter: Ue,
						generateMipmaps: !1
					}), d.map.texture.name = l.name + ".shadowMap", d.map.depthTexture = new Ka(i.x, i.y, Qe), d.map.depthTexture.name = l.name + ".shadowMapDepth", d.map.depthTexture.format = ct, d.map.depthTexture.compareFunction = null, d.map.depthTexture.minFilter = Be, d.map.depthTexture.magFilter = Be;
				} else l.isPointLight ? (d.map = new $s(i.x), d.map.depthTexture = new qa(i.x, Ze)) : (d.map = new hr(i.x, i.y), d.map.depthTexture = new Ka(i.x, i.y, Ze)), d.map.depthTexture.name = l.name + ".shadowMap", d.map.depthTexture.format = ct, this.type === 1 ? (d.map.depthTexture.compareFunction = h ? 518 : 515, d.map.depthTexture.minFilter = Ue, d.map.depthTexture.magFilter = Ue) : (d.map.depthTexture.compareFunction = null, d.map.depthTexture.minFilter = Be, d.map.depthTexture.magFilter = Be);
				d.camera.updateProjectionMatrix();
			}
			let g = d.map.isWebGLCubeRenderTarget ? 6 : 1;
			for (let t = 0; t < g; t++) {
				if (d.map.isWebGLCubeRenderTarget) e.setRenderTarget(d.map, t), e.clear();
				else {
					t === 0 && (e.setRenderTarget(d.map), e.clear());
					let n = d.getViewport(t);
					o.set(a.x * n.x, a.y * n.y, a.x * n.z, a.y * n.w), f.viewport(o);
				}
				if (l.isPointLight) {
					let e = d.camera, n = d.matrix, r = l.distance || e.far;
					r !== e.far && (e.far = r, e.updateProjectionMatrix()), bu.setFromMatrixPosition(l.matrixWorld), e.position.copy(bu), xu.copy(e.position), xu.add(_u[t]), e.up.copy(vu[t]), e.lookAt(xu), e.updateMatrixWorld(), n.makeTranslation(-bu.x, -bu.y, -bu.z), yu.multiplyMatrices(e.projectionMatrix, e.matrixWorldInverse), d._frustum.setFromProjectionMatrix(yu, e.coordinateSystem, e.reversedDepth);
				} else d.updateMatrices(l);
				r = d.getFrustum(), b(n, s, d.camera, l, this.type);
			}
			d.isPointLightShadow !== !0 && this.type === 3 && v(d, s), d.needsUpdate = !1;
		}
		_ = this.type, g.needsUpdate = !1, e.setRenderTarget(c, l, d);
	};
	function v(n, r) {
		let a = t.update(h);
		f.defines.VSM_SAMPLES !== n.blurSamples && (f.defines.VSM_SAMPLES = n.blurSamples, p.defines.VSM_SAMPLES = n.blurSamples, f.needsUpdate = !0, p.needsUpdate = !0), n.mapPass === null && (n.mapPass = new hr(i.x, i.y, {
			format: ft,
			type: $e
		})), f.uniforms.shadow_pass.value = n.map.depthTexture, f.uniforms.resolution.value = n.mapSize, f.uniforms.radius.value = n.radius, e.setRenderTarget(n.mapPass), e.clear(), e.renderBufferDirect(r, null, a, f, h, null), p.uniforms.shadow_pass.value = n.mapPass.texture, p.uniforms.resolution.value = n.mapSize, p.uniforms.radius.value = n.radius, e.setRenderTarget(n.map), e.clear(), e.renderBufferDirect(r, null, a, p, h, null);
	}
	function y(t, n, r, i) {
		let a = null, o = r.isPointLight === !0 ? t.customDistanceMaterial : t.customDepthMaterial;
		if (o !== void 0) a = o;
		else if (a = r.isPointLight === !0 ? c : s, e.localClippingEnabled && n.clipShadows === !0 && Array.isArray(n.clippingPlanes) && n.clippingPlanes.length !== 0 || n.displacementMap && n.displacementScale !== 0 || n.alphaMap && n.alphaTest > 0 || n.map && n.alphaTest > 0 || n.alphaToCoverage === !0) {
			let e = a.uuid, t = n.uuid, r = l[e];
			r === void 0 && (r = {}, l[e] = r);
			let i = r[t];
			i === void 0 && (i = a.clone(), r[t] = i, n.addEventListener("dispose", x)), a = i;
		}
		if (a.visible = n.visible, a.wireframe = n.wireframe, i === 3 ? a.side = n.shadowSide === null ? n.side : n.shadowSide : a.side = n.shadowSide === null ? d[n.side] : n.shadowSide, a.alphaMap = n.alphaMap, a.alphaTest = n.alphaToCoverage === !0 ? .5 : n.alphaTest, a.map = n.map, a.clipShadows = n.clipShadows, a.clippingPlanes = n.clippingPlanes, a.clipIntersection = n.clipIntersection, a.displacementMap = n.displacementMap, a.displacementScale = n.displacementScale, a.displacementBias = n.displacementBias, a.wireframeLinewidth = n.wireframeLinewidth, a.linewidth = n.linewidth, r.isPointLight === !0 && a.isMeshDistanceMaterial === !0) {
			let t = e.properties.get(a);
			t.light = r;
		}
		return a;
	}
	function b(n, i, a, o, s) {
		if (n.visible === !1) return;
		if (n.layers.test(i.layers) && (n.isMesh || n.isLine || n.isPoints) && (n.castShadow || n.receiveShadow && s === 3) && (!n.frustumCulled || r.intersectsObject(n))) {
			n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse, n.matrixWorld);
			let r = t.update(n), c = n.material;
			if (Array.isArray(c)) {
				let t = r.groups;
				for (let l = 0, u = t.length; l < u; l++) {
					let u = t[l], d = c[u.materialIndex];
					if (d && d.visible) {
						let t = y(n, d, o, s);
						n.onBeforeShadow(e, n, i, a, r, t, u), e.renderBufferDirect(a, null, r, t, n, u), n.onAfterShadow(e, n, i, a, r, t, u);
					}
				}
			} else if (c.visible) {
				let t = y(n, c, o, s);
				n.onBeforeShadow(e, n, i, a, r, t, null), e.renderBufferDirect(a, null, r, t, n, null), n.onAfterShadow(e, n, i, a, r, t, null);
			}
		}
		let c = n.children;
		for (let e = 0, t = c.length; e < t; e++) b(c[e], i, a, o, s);
	}
	function x(e) {
		e.target.removeEventListener("dispose", x);
		for (let t in l) {
			let n = l[t], r = e.target.uuid;
			r in n && (n[r].dispose(), delete n[r]);
		}
	}
}
function Cu(e, t) {
	function n() {
		let t = !1, n = new pr(), r = null, i = new pr(0, 0, 0, 0);
		return {
			setMask: function(n) {
				r !== n && !t && (e.colorMask(n, n, n, n), r = n);
			},
			setLocked: function(e) {
				t = e;
			},
			setClear: function(t, r, a, o, s) {
				s === !0 && (t *= o, r *= o, a *= o), n.set(t, r, a, o), i.equals(n) === !1 && (e.clearColor(t, r, a, o), i.copy(n));
			},
			reset: function() {
				t = !1, r = null, i.set(-1, 0, 0, 0);
			}
		};
	}
	function r() {
		let n = !1, r = !1, i = null, a = null, o = null;
		return {
			setReversed: function(e) {
				if (r !== e) {
					let n = t.get("EXT_clip_control");
					e ? n.clipControlEXT(n.LOWER_LEFT_EXT, n.ZERO_TO_ONE_EXT) : n.clipControlEXT(n.LOWER_LEFT_EXT, n.NEGATIVE_ONE_TO_ONE_EXT), r = e;
					let i = o;
					o = null, this.setClear(i);
				}
			},
			getReversed: function() {
				return r;
			},
			setTest: function(t) {
				t ? ce(e.DEPTH_TEST) : le(e.DEPTH_TEST);
			},
			setMask: function(t) {
				i !== t && !n && (e.depthMask(t), i = t);
			},
			setFunc: function(t) {
				if (r && (t = Sn[t]), a !== t) {
					switch (t) {
						case 0:
							e.depthFunc(e.NEVER);
							break;
						case 1:
							e.depthFunc(e.ALWAYS);
							break;
						case 2:
							e.depthFunc(e.LESS);
							break;
						case 3:
							e.depthFunc(e.LEQUAL);
							break;
						case 4:
							e.depthFunc(e.EQUAL);
							break;
						case 5:
							e.depthFunc(e.GEQUAL);
							break;
						case 6:
							e.depthFunc(e.GREATER);
							break;
						case 7:
							e.depthFunc(e.NOTEQUAL);
							break;
						default: e.depthFunc(e.LEQUAL);
					}
					a = t;
				}
			},
			setLocked: function(e) {
				n = e;
			},
			setClear: function(t) {
				o !== t && (o = t, r && (t = 1 - t), e.clearDepth(t));
			},
			reset: function() {
				n = !1, i = null, a = null, o = null, r = !1;
			}
		};
	}
	function i() {
		let t = !1, n = null, r = null, i = null, a = null, o = null, s = null, c = null, l = null;
		return {
			setTest: function(n) {
				t || (n ? ce(e.STENCIL_TEST) : le(e.STENCIL_TEST));
			},
			setMask: function(r) {
				n !== r && !t && (e.stencilMask(r), n = r);
			},
			setFunc: function(t, n, o) {
				(r !== t || i !== n || a !== o) && (e.stencilFunc(t, n, o), r = t, i = n, a = o);
			},
			setOp: function(t, n, r) {
				(o !== t || s !== n || c !== r) && (e.stencilOp(t, n, r), o = t, s = n, c = r);
			},
			setLocked: function(e) {
				t = e;
			},
			setClear: function(t) {
				l !== t && (e.clearStencil(t), l = t);
			},
			reset: function() {
				t = !1, n = null, r = null, i = null, a = null, o = null, s = null, c = null, l = null;
			}
		};
	}
	let a = new n(), o = new r(), s = new i(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), u = {}, d = {}, f = {}, p = /* @__PURE__ */ new WeakMap(), m = [], h = null, g = !1, _ = null, v = null, y = null, b = null, x = null, S = null, C = null, w = new J(0, 0, 0), T = 0, E = !1, D = null, O = null, k = null, A = null, j = null, ee = e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS), M = !1, N = 0, te = e.getParameter(e.VERSION);
	te.indexOf("WebGL") === -1 ? te.indexOf("OpenGL ES") !== -1 && (N = parseFloat(/^OpenGL ES (\d)/.exec(te)[1]), M = N >= 2) : (N = parseFloat(/^WebGL (\d)/.exec(te)[1]), M = N >= 1);
	let P = null, ne = {}, re = e.getParameter(e.SCISSOR_BOX), ie = e.getParameter(e.VIEWPORT), ae = new pr().fromArray(re), oe = new pr().fromArray(ie);
	function se(t, n, r, i) {
		let a = /* @__PURE__ */ new Uint8Array(4), o = e.createTexture();
		e.bindTexture(t, o), e.texParameteri(t, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(t, e.TEXTURE_MAG_FILTER, e.NEAREST);
		for (let o = 0; o < r; o++) t === e.TEXTURE_3D || t === e.TEXTURE_2D_ARRAY ? e.texImage3D(n, 0, e.RGBA, 1, 1, i, 0, e.RGBA, e.UNSIGNED_BYTE, a) : e.texImage2D(n + o, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, a);
		return o;
	}
	let F = {};
	F[e.TEXTURE_2D] = se(e.TEXTURE_2D, e.TEXTURE_2D, 1), F[e.TEXTURE_CUBE_MAP] = se(e.TEXTURE_CUBE_MAP, e.TEXTURE_CUBE_MAP_POSITIVE_X, 6), F[e.TEXTURE_2D_ARRAY] = se(e.TEXTURE_2D_ARRAY, e.TEXTURE_2D_ARRAY, 1, 1), F[e.TEXTURE_3D] = se(e.TEXTURE_3D, e.TEXTURE_3D, 1, 1), a.setClear(0, 0, 0, 1), o.setClear(1), s.setClear(0), ce(e.DEPTH_TEST), o.setFunc(3), _e(!1), ve(1), ce(e.CULL_FACE), he(0);
	function ce(t) {
		u[t] !== !0 && (e.enable(t), u[t] = !0);
	}
	function le(t) {
		u[t] !== !1 && (e.disable(t), u[t] = !1);
	}
	function ue(t, n) {
		return f[t] === n ? !1 : (e.bindFramebuffer(t, n), f[t] = n, t === e.DRAW_FRAMEBUFFER && (f[e.FRAMEBUFFER] = n), t === e.FRAMEBUFFER && (f[e.DRAW_FRAMEBUFFER] = n), !0);
	}
	function de(t, n) {
		let r = m, i = !1;
		if (t) {
			r = p.get(n), r === void 0 && (r = [], p.set(n, r));
			let a = t.textures;
			if (r.length !== a.length || r[0] !== e.COLOR_ATTACHMENT0) {
				for (let t = 0, n = a.length; t < n; t++) r[t] = e.COLOR_ATTACHMENT0 + t;
				r.length = a.length, i = !0;
			}
		} else r[0] !== e.BACK && (r[0] = e.BACK, i = !0);
		i && e.drawBuffers(r);
	}
	function fe(t) {
		return h === t ? !1 : (e.useProgram(t), h = t, !0);
	}
	let pe = {
		100: e.FUNC_ADD,
		101: e.FUNC_SUBTRACT,
		102: e.FUNC_REVERSE_SUBTRACT
	};
	pe[103] = e.MIN, pe[104] = e.MAX;
	let me = {
		200: e.ZERO,
		201: e.ONE,
		202: e.SRC_COLOR,
		204: e.SRC_ALPHA,
		210: e.SRC_ALPHA_SATURATE,
		208: e.DST_COLOR,
		206: e.DST_ALPHA,
		203: e.ONE_MINUS_SRC_COLOR,
		205: e.ONE_MINUS_SRC_ALPHA,
		209: e.ONE_MINUS_DST_COLOR,
		207: e.ONE_MINUS_DST_ALPHA,
		211: e.CONSTANT_COLOR,
		212: e.ONE_MINUS_CONSTANT_COLOR,
		213: e.CONSTANT_ALPHA,
		214: e.ONE_MINUS_CONSTANT_ALPHA
	};
	function he(t, n, r, i, a, o, s, c, l, u) {
		if (t === 0) {
			g === !0 && (le(e.BLEND), g = !1);
			return;
		}
		if (g === !1 && (ce(e.BLEND), g = !0), t !== 5) {
			if (t !== _ || u !== E) {
				if ((v !== 100 || x !== 100) && (e.blendEquation(e.FUNC_ADD), v = 100, x = 100), u) switch (t) {
					case 1:
						e.blendFuncSeparate(e.ONE, e.ONE_MINUS_SRC_ALPHA, e.ONE, e.ONE_MINUS_SRC_ALPHA);
						break;
					case 2:
						e.blendFunc(e.ONE, e.ONE);
						break;
					case 3:
						e.blendFuncSeparate(e.ZERO, e.ONE_MINUS_SRC_COLOR, e.ZERO, e.ONE);
						break;
					case 4:
						e.blendFuncSeparate(e.DST_COLOR, e.ONE_MINUS_SRC_ALPHA, e.ZERO, e.ONE);
						break;
					default:
						V("WebGLState: Invalid blending: ", t);
						break;
				}
				else switch (t) {
					case 1:
						e.blendFuncSeparate(e.SRC_ALPHA, e.ONE_MINUS_SRC_ALPHA, e.ONE, e.ONE_MINUS_SRC_ALPHA);
						break;
					case 2:
						e.blendFuncSeparate(e.SRC_ALPHA, e.ONE, e.ONE, e.ONE);
						break;
					case 3:
						V("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");
						break;
					case 4:
						V("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");
						break;
					default:
						V("WebGLState: Invalid blending: ", t);
						break;
				}
				y = null, b = null, S = null, C = null, w.set(0, 0, 0), T = 0, _ = t, E = u;
			}
			return;
		}
		a ||= n, o ||= r, s ||= i, (n !== v || a !== x) && (e.blendEquationSeparate(pe[n], pe[a]), v = n, x = a), (r !== y || i !== b || o !== S || s !== C) && (e.blendFuncSeparate(me[r], me[i], me[o], me[s]), y = r, b = i, S = o, C = s), (c.equals(w) === !1 || l !== T) && (e.blendColor(c.r, c.g, c.b, l), w.copy(c), T = l), _ = t, E = !1;
	}
	function ge(t, n) {
		t.side === 2 ? le(e.CULL_FACE) : ce(e.CULL_FACE);
		let r = t.side === 1;
		n && (r = !r), _e(r), t.blending === 1 && t.transparent === !1 ? he(0) : he(t.blending, t.blendEquation, t.blendSrc, t.blendDst, t.blendEquationAlpha, t.blendSrcAlpha, t.blendDstAlpha, t.blendColor, t.blendAlpha, t.premultipliedAlpha), o.setFunc(t.depthFunc), o.setTest(t.depthTest), o.setMask(t.depthWrite), a.setMask(t.colorWrite);
		let i = t.stencilWrite;
		s.setTest(i), i && (s.setMask(t.stencilWriteMask), s.setFunc(t.stencilFunc, t.stencilRef, t.stencilFuncMask), s.setOp(t.stencilFail, t.stencilZFail, t.stencilZPass)), be(t.polygonOffset, t.polygonOffsetFactor, t.polygonOffsetUnits), t.alphaToCoverage === !0 ? ce(e.SAMPLE_ALPHA_TO_COVERAGE) : le(e.SAMPLE_ALPHA_TO_COVERAGE);
	}
	function _e(t) {
		D !== t && (t ? e.frontFace(e.CW) : e.frontFace(e.CCW), D = t);
	}
	function ve(t) {
		t === 0 ? le(e.CULL_FACE) : (ce(e.CULL_FACE), t !== O && (t === 1 ? e.cullFace(e.BACK) : t === 2 ? e.cullFace(e.FRONT) : e.cullFace(e.FRONT_AND_BACK))), O = t;
	}
	function ye(t) {
		t !== k && (M && e.lineWidth(t), k = t);
	}
	function be(t, n, r) {
		t ? (ce(e.POLYGON_OFFSET_FILL), (A !== n || j !== r) && (A = n, j = r, o.getReversed() && (n = -n), e.polygonOffset(n, r))) : le(e.POLYGON_OFFSET_FILL);
	}
	function xe(t) {
		t ? ce(e.SCISSOR_TEST) : le(e.SCISSOR_TEST);
	}
	function I(t) {
		t === void 0 && (t = e.TEXTURE0 + ee - 1), P !== t && (e.activeTexture(t), P = t);
	}
	function Se(t, n, r) {
		r === void 0 && (r = P === null ? e.TEXTURE0 + ee - 1 : P);
		let i = ne[r];
		i === void 0 && (i = {
			type: void 0,
			texture: void 0
		}, ne[r] = i), (i.type !== t || i.texture !== n) && (P !== r && (e.activeTexture(r), P = r), e.bindTexture(t, n || F[t]), i.type = t, i.texture = n);
	}
	function Ce() {
		let t = ne[P];
		t !== void 0 && t.type !== void 0 && (e.bindTexture(t.type, null), t.type = void 0, t.texture = void 0);
	}
	function we() {
		try {
			e.compressedTexImage2D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function L() {
		try {
			e.compressedTexImage3D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function Te() {
		try {
			e.texSubImage2D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function R() {
		try {
			e.texSubImage3D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function z() {
		try {
			e.compressedTexSubImage2D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function Ee() {
		try {
			e.compressedTexSubImage3D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function De() {
		try {
			e.texStorage2D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function Oe() {
		try {
			e.texStorage3D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function ke() {
		try {
			e.texImage2D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function Ae() {
		try {
			e.texImage3D(...arguments);
		} catch (e) {
			V("WebGLState:", e);
		}
	}
	function je(t) {
		return d[t] === void 0 ? e.getParameter(t) : d[t];
	}
	function Me(t, n) {
		d[t] !== n && (e.pixelStorei(t, n), d[t] = n);
	}
	function Ne(t) {
		ae.equals(t) === !1 && (e.scissor(t.x, t.y, t.z, t.w), ae.copy(t));
	}
	function Pe(t) {
		oe.equals(t) === !1 && (e.viewport(t.x, t.y, t.z, t.w), oe.copy(t));
	}
	function Fe(t, n) {
		let r = l.get(n);
		r === void 0 && (r = /* @__PURE__ */ new WeakMap(), l.set(n, r));
		let i = r.get(t);
		i === void 0 && (i = e.getUniformBlockIndex(n, t.name), r.set(t, i));
	}
	function Ie(t, n) {
		let r = l.get(n).get(t);
		c.get(n) !== r && (e.uniformBlockBinding(n, r, t.__bindingPointIndex), c.set(n, r));
	}
	function Le() {
		e.disable(e.BLEND), e.disable(e.CULL_FACE), e.disable(e.DEPTH_TEST), e.disable(e.POLYGON_OFFSET_FILL), e.disable(e.SCISSOR_TEST), e.disable(e.STENCIL_TEST), e.disable(e.SAMPLE_ALPHA_TO_COVERAGE), e.blendEquation(e.FUNC_ADD), e.blendFunc(e.ONE, e.ZERO), e.blendFuncSeparate(e.ONE, e.ZERO, e.ONE, e.ZERO), e.blendColor(0, 0, 0, 0), e.colorMask(!0, !0, !0, !0), e.clearColor(0, 0, 0, 0), e.depthMask(!0), e.depthFunc(e.LESS), o.setReversed(!1), e.clearDepth(1), e.stencilMask(4294967295), e.stencilFunc(e.ALWAYS, 0, 4294967295), e.stencilOp(e.KEEP, e.KEEP, e.KEEP), e.clearStencil(0), e.cullFace(e.BACK), e.frontFace(e.CCW), e.polygonOffset(0, 0), e.activeTexture(e.TEXTURE0), e.bindFramebuffer(e.FRAMEBUFFER, null), e.bindFramebuffer(e.DRAW_FRAMEBUFFER, null), e.bindFramebuffer(e.READ_FRAMEBUFFER, null), e.useProgram(null), e.lineWidth(1), e.scissor(0, 0, e.canvas.width, e.canvas.height), e.viewport(0, 0, e.canvas.width, e.canvas.height), e.pixelStorei(e.PACK_ALIGNMENT, 4), e.pixelStorei(e.UNPACK_ALIGNMENT, 4), e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, !1), e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, e.BROWSER_DEFAULT_WEBGL), e.pixelStorei(e.PACK_ROW_LENGTH, 0), e.pixelStorei(e.PACK_SKIP_PIXELS, 0), e.pixelStorei(e.PACK_SKIP_ROWS, 0), e.pixelStorei(e.UNPACK_ROW_LENGTH, 0), e.pixelStorei(e.UNPACK_IMAGE_HEIGHT, 0), e.pixelStorei(e.UNPACK_SKIP_PIXELS, 0), e.pixelStorei(e.UNPACK_SKIP_ROWS, 0), e.pixelStorei(e.UNPACK_SKIP_IMAGES, 0), u = {}, d = {}, P = null, ne = {}, f = {}, p = /* @__PURE__ */ new WeakMap(), m = [], h = null, g = !1, _ = null, v = null, y = null, b = null, x = null, S = null, C = null, w = new J(0, 0, 0), T = 0, E = !1, D = null, O = null, k = null, A = null, j = null, ae.set(0, 0, e.canvas.width, e.canvas.height), oe.set(0, 0, e.canvas.width, e.canvas.height), a.reset(), o.reset(), s.reset();
	}
	return {
		buffers: {
			color: a,
			depth: o,
			stencil: s
		},
		enable: ce,
		disable: le,
		bindFramebuffer: ue,
		drawBuffers: de,
		useProgram: fe,
		setBlending: he,
		setMaterial: ge,
		setFlipSided: _e,
		setCullFace: ve,
		setLineWidth: ye,
		setPolygonOffset: be,
		setScissorTest: xe,
		activeTexture: I,
		bindTexture: Se,
		unbindTexture: Ce,
		compressedTexImage2D: we,
		compressedTexImage3D: L,
		texImage2D: ke,
		texImage3D: Ae,
		pixelStorei: Me,
		getParameter: je,
		updateUBOMapping: Fe,
		uniformBlockBinding: Ie,
		texStorage2D: De,
		texStorage3D: Oe,
		texSubImage2D: Te,
		texSubImage3D: R,
		compressedTexSubImage2D: z,
		compressedTexSubImage3D: Ee,
		scissor: Ne,
		viewport: Pe,
		reset: Le
	};
}
function wu(e, t, n, r, i, a, o) {
	let s = t.has("WEBGL_multisampled_render_to_texture") ? t.get("WEBGL_multisampled_render_to_texture") : null, c = typeof navigator > "u" ? !1 : /OculusBrowser/g.test(navigator.userAgent), l = new U(), u = /* @__PURE__ */ new WeakMap(), d = /* @__PURE__ */ new Set(), f, p = /* @__PURE__ */ new WeakMap(), m = !1;
	try {
		m = typeof OffscreenCanvas < "u" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
	} catch {}
	function h(e, t) {
		return m ? new OffscreenCanvas(e, t) : hn("canvas");
	}
	function g(e, t, n) {
		let r = 1, i = we(e);
		if ((i.width > n || i.height > n) && (r = n / Math.max(i.width, i.height)), r < 1) if (typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap || typeof VideoFrame < "u" && e instanceof VideoFrame) {
			let n = Math.floor(r * i.width), a = Math.floor(r * i.height);
			f === void 0 && (f = h(n, a));
			let o = t ? h(n, a) : f;
			return o.width = n, o.height = a, o.getContext("2d").drawImage(e, 0, 0, n, a), B("WebGLRenderer: Texture has been resized from (" + i.width + "x" + i.height + ") to (" + n + "x" + a + ")."), o;
		} else return "data" in e && B("WebGLRenderer: Image in DataTexture is too big (" + i.width + "x" + i.height + ")."), e;
		return e;
	}
	function _(e) {
		return e.generateMipmaps;
	}
	function v(t) {
		e.generateMipmap(t);
	}
	function y(t) {
		return t.isWebGLCubeRenderTarget ? e.TEXTURE_CUBE_MAP : t.isWebGL3DRenderTarget ? e.TEXTURE_3D : t.isWebGLArrayRenderTarget || t.isCompressedArrayTexture ? e.TEXTURE_2D_ARRAY : e.TEXTURE_2D;
	}
	function b(n, r, i, a, o, s = !1) {
		if (n !== null) {
			if (e[n] !== void 0) return e[n];
			B("WebGLRenderer: Attempt to use non-existing WebGL internal format '" + n + "'");
		}
		let c;
		a && (c = t.get("EXT_texture_norm16"), c || B("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));
		let l = r;
		if (r === e.RED && (i === e.FLOAT && (l = e.R32F), i === e.HALF_FLOAT && (l = e.R16F), i === e.UNSIGNED_BYTE && (l = e.R8), i === e.UNSIGNED_SHORT && c && (l = c.R16_EXT), i === e.SHORT && c && (l = c.R16_SNORM_EXT)), r === e.RED_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.R8UI), i === e.UNSIGNED_SHORT && (l = e.R16UI), i === e.UNSIGNED_INT && (l = e.R32UI), i === e.BYTE && (l = e.R8I), i === e.SHORT && (l = e.R16I), i === e.INT && (l = e.R32I)), r === e.RG && (i === e.FLOAT && (l = e.RG32F), i === e.HALF_FLOAT && (l = e.RG16F), i === e.UNSIGNED_BYTE && (l = e.RG8), i === e.UNSIGNED_SHORT && c && (l = c.RG16_EXT), i === e.SHORT && c && (l = c.RG16_SNORM_EXT)), r === e.RG_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RG8UI), i === e.UNSIGNED_SHORT && (l = e.RG16UI), i === e.UNSIGNED_INT && (l = e.RG32UI), i === e.BYTE && (l = e.RG8I), i === e.SHORT && (l = e.RG16I), i === e.INT && (l = e.RG32I)), r === e.RGB_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RGB8UI), i === e.UNSIGNED_SHORT && (l = e.RGB16UI), i === e.UNSIGNED_INT && (l = e.RGB32UI), i === e.BYTE && (l = e.RGB8I), i === e.SHORT && (l = e.RGB16I), i === e.INT && (l = e.RGB32I)), r === e.RGBA_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RGBA8UI), i === e.UNSIGNED_SHORT && (l = e.RGBA16UI), i === e.UNSIGNED_INT && (l = e.RGBA32UI), i === e.BYTE && (l = e.RGBA8I), i === e.SHORT && (l = e.RGBA16I), i === e.INT && (l = e.RGBA32I)), r === e.RGB && (i === e.UNSIGNED_SHORT && c && (l = c.RGB16_EXT), i === e.SHORT && c && (l = c.RGB16_SNORM_EXT), i === e.UNSIGNED_INT_5_9_9_9_REV && (l = e.RGB9_E5), i === e.UNSIGNED_INT_10F_11F_11F_REV && (l = e.R11F_G11F_B10F)), r === e.RGBA) {
			let t = s ? cn : K.getTransfer(o);
			i === e.FLOAT && (l = e.RGBA32F), i === e.HALF_FLOAT && (l = e.RGBA16F), i === e.UNSIGNED_BYTE && (l = t === "srgb" ? e.SRGB8_ALPHA8 : e.RGBA8), i === e.UNSIGNED_SHORT && c && (l = c.RGBA16_EXT), i === e.SHORT && c && (l = c.RGBA16_SNORM_EXT), i === e.UNSIGNED_SHORT_4_4_4_4 && (l = e.RGBA4), i === e.UNSIGNED_SHORT_5_5_5_1 && (l = e.RGB5_A1);
		}
		return (l === e.R16F || l === e.R32F || l === e.RG16F || l === e.RG32F || l === e.RGBA16F || l === e.RGBA32F) && t.get("EXT_color_buffer_float"), l;
	}
	function x(t, n) {
		let r;
		return t ? n === null || n === 1014 || n === 1020 ? r = e.DEPTH24_STENCIL8 : n === 1015 ? r = e.DEPTH32F_STENCIL8 : n === 1012 && (r = e.DEPTH24_STENCIL8, B("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")) : n === null || n === 1014 || n === 1020 ? r = e.DEPTH_COMPONENT24 : n === 1015 ? r = e.DEPTH_COMPONENT32F : n === 1012 && (r = e.DEPTH_COMPONENT16), r;
	}
	function S(e, t) {
		return _(e) === !0 || e.isFramebufferTexture && e.minFilter !== 1003 && e.minFilter !== 1006 ? Math.log2(Math.max(t.width, t.height)) + 1 : e.mipmaps !== void 0 && e.mipmaps.length > 0 ? e.mipmaps.length : e.isCompressedTexture && Array.isArray(e.image) ? t.mipmaps.length : 1;
	}
	function C(e) {
		let t = e.target;
		t.removeEventListener("dispose", C), T(t), t.isVideoTexture && u.delete(t), t.isHTMLTexture && d.delete(t);
	}
	function w(e) {
		let t = e.target;
		t.removeEventListener("dispose", w), D(t);
	}
	function T(e) {
		let t = r.get(e);
		if (t.__webglInit === void 0) return;
		let n = e.source, i = p.get(n);
		if (i) {
			let r = i[t.__cacheKey];
			r.usedTimes--, r.usedTimes === 0 && E(e), Object.keys(i).length === 0 && p.delete(n);
		}
		r.remove(e);
	}
	function E(t) {
		let n = r.get(t);
		e.deleteTexture(n.__webglTexture);
		let i = t.source, a = p.get(i);
		delete a[n.__cacheKey], o.memory.textures--;
	}
	function D(t) {
		let n = r.get(t);
		if (t.depthTexture && (t.depthTexture.dispose(), r.remove(t.depthTexture)), t.isWebGLCubeRenderTarget) for (let t = 0; t < 6; t++) {
			if (Array.isArray(n.__webglFramebuffer[t])) for (let r = 0; r < n.__webglFramebuffer[t].length; r++) e.deleteFramebuffer(n.__webglFramebuffer[t][r]);
			else e.deleteFramebuffer(n.__webglFramebuffer[t]);
			n.__webglDepthbuffer && e.deleteRenderbuffer(n.__webglDepthbuffer[t]);
		}
		else {
			if (Array.isArray(n.__webglFramebuffer)) for (let t = 0; t < n.__webglFramebuffer.length; t++) e.deleteFramebuffer(n.__webglFramebuffer[t]);
			else e.deleteFramebuffer(n.__webglFramebuffer);
			if (n.__webglDepthbuffer && e.deleteRenderbuffer(n.__webglDepthbuffer), n.__webglMultisampledFramebuffer && e.deleteFramebuffer(n.__webglMultisampledFramebuffer), n.__webglColorRenderbuffer) for (let t = 0; t < n.__webglColorRenderbuffer.length; t++) n.__webglColorRenderbuffer[t] && e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);
			n.__webglDepthRenderbuffer && e.deleteRenderbuffer(n.__webglDepthRenderbuffer);
		}
		let i = t.textures;
		for (let t = 0, n = i.length; t < n; t++) {
			let n = r.get(i[t]);
			n.__webglTexture && (e.deleteTexture(n.__webglTexture), o.memory.textures--), r.remove(i[t]);
		}
		r.remove(t);
	}
	let O = 0;
	function k() {
		O = 0;
	}
	function A() {
		return O;
	}
	function j(e) {
		O = e;
	}
	function ee() {
		let e = O;
		return e >= i.maxTextures && B("WebGLTextures: Trying to use " + e + " texture units while this GPU supports only " + i.maxTextures), O += 1, e;
	}
	function M(e) {
		let t = [];
		return t.push(e.wrapS), t.push(e.wrapT), t.push(e.wrapR || 0), t.push(e.magFilter), t.push(e.minFilter), t.push(e.anisotropy), t.push(e.internalFormat), t.push(e.format), t.push(e.type), t.push(e.generateMipmaps), t.push(e.premultiplyAlpha), t.push(e.flipY), t.push(e.unpackAlignment), t.push(e.colorSpace), t.join();
	}
	function N(t, i) {
		let a = r.get(t);
		if (t.isVideoTexture && Se(t), t.isRenderTargetTexture === !1 && t.isExternalTexture !== !0 && t.version > 0 && a.__version !== t.version) {
			let e = t.image;
			if (e === null) B("WebGLRenderer: Texture marked for update but no image data found.");
			else if (e.complete === !1) B("WebGLRenderer: Texture marked for update but image is incomplete");
			else {
				le(a, t, i);
				return;
			}
		} else t.isExternalTexture && (a.__webglTexture = t.sourceTexture ? t.sourceTexture : null);
		n.bindTexture(e.TEXTURE_2D, a.__webglTexture, e.TEXTURE0 + i);
	}
	function te(t, i) {
		let a = r.get(t);
		if (t.isRenderTargetTexture === !1 && t.version > 0 && a.__version !== t.version) {
			le(a, t, i);
			return;
		} else t.isExternalTexture && (a.__webglTexture = t.sourceTexture ? t.sourceTexture : null);
		n.bindTexture(e.TEXTURE_2D_ARRAY, a.__webglTexture, e.TEXTURE0 + i);
	}
	function P(t, i) {
		let a = r.get(t);
		if (t.isRenderTargetTexture === !1 && t.version > 0 && a.__version !== t.version) {
			le(a, t, i);
			return;
		}
		n.bindTexture(e.TEXTURE_3D, a.__webglTexture, e.TEXTURE0 + i);
	}
	function ne(t, i) {
		let a = r.get(t);
		if (t.isCubeDepthTexture !== !0 && t.version > 0 && a.__version !== t.version) {
			ue(a, t, i);
			return;
		}
		n.bindTexture(e.TEXTURE_CUBE_MAP, a.__webglTexture, e.TEXTURE0 + i);
	}
	let re = {
		[Le]: e.REPEAT,
		[Re]: e.CLAMP_TO_EDGE,
		[ze]: e.MIRRORED_REPEAT
	}, ie = {
		[Be]: e.NEAREST,
		[Ve]: e.NEAREST_MIPMAP_NEAREST,
		[He]: e.NEAREST_MIPMAP_LINEAR,
		[Ue]: e.LINEAR,
		[We]: e.LINEAR_MIPMAP_NEAREST,
		[Ge]: e.LINEAR_MIPMAP_LINEAR
	}, ae = {
		512: e.NEVER,
		519: e.ALWAYS,
		513: e.LESS,
		515: e.LEQUAL,
		514: e.EQUAL,
		518: e.GEQUAL,
		516: e.GREATER,
		517: e.NOTEQUAL
	};
	function oe(n, a) {
		if (a.type === 1015 && t.has("OES_texture_float_linear") === !1 && (a.magFilter === 1006 || a.magFilter === 1007 || a.magFilter === 1005 || a.magFilter === 1008 || a.minFilter === 1006 || a.minFilter === 1007 || a.minFilter === 1005 || a.minFilter === 1008) && B("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."), e.texParameteri(n, e.TEXTURE_WRAP_S, re[a.wrapS]), e.texParameteri(n, e.TEXTURE_WRAP_T, re[a.wrapT]), (n === e.TEXTURE_3D || n === e.TEXTURE_2D_ARRAY) && e.texParameteri(n, e.TEXTURE_WRAP_R, re[a.wrapR]), e.texParameteri(n, e.TEXTURE_MAG_FILTER, ie[a.magFilter]), e.texParameteri(n, e.TEXTURE_MIN_FILTER, ie[a.minFilter]), a.compareFunction && (e.texParameteri(n, e.TEXTURE_COMPARE_MODE, e.COMPARE_REF_TO_TEXTURE), e.texParameteri(n, e.TEXTURE_COMPARE_FUNC, ae[a.compareFunction])), t.has("EXT_texture_filter_anisotropic") === !0) {
			if (a.magFilter === 1003 || a.minFilter !== 1005 && a.minFilter !== 1008 || a.type === 1015 && t.has("OES_texture_float_linear") === !1) return;
			if (a.anisotropy > 1 || r.get(a).__currentAnisotropy) {
				let o = t.get("EXT_texture_filter_anisotropic");
				e.texParameterf(n, o.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(a.anisotropy, i.getMaxAnisotropy())), r.get(a).__currentAnisotropy = a.anisotropy;
			}
		}
	}
	function se(t, n) {
		let r = !1;
		t.__webglInit === void 0 && (t.__webglInit = !0, n.addEventListener("dispose", C));
		let i = n.source, a = p.get(i);
		a === void 0 && (a = {}, p.set(i, a));
		let s = M(n);
		if (s !== t.__cacheKey) {
			a[s] === void 0 && (a[s] = {
				texture: e.createTexture(),
				usedTimes: 0
			}, o.memory.textures++, r = !0), a[s].usedTimes++;
			let i = a[t.__cacheKey];
			i !== void 0 && (a[t.__cacheKey].usedTimes--, i.usedTimes === 0 && E(n)), t.__cacheKey = s, t.__webglTexture = a[s].texture;
		}
		return r;
	}
	function F(e, t, n) {
		return Math.floor(Math.floor(e / n) / t);
	}
	function ce(t, r, i, a) {
		let o = t.updateRanges;
		if (o.length === 0) n.texSubImage2D(e.TEXTURE_2D, 0, 0, 0, r.width, r.height, i, a, r.data);
		else {
			o.sort((e, t) => e.start - t.start);
			let s = 0;
			for (let e = 1; e < o.length; e++) {
				let t = o[s], n = o[e], i = t.start + t.count, a = F(n.start, r.width, 4), c = F(t.start, r.width, 4);
				n.start <= i + 1 && a === c && F(n.start + n.count - 1, r.width, 4) === a ? t.count = Math.max(t.count, n.start + n.count - t.start) : (++s, o[s] = n);
			}
			o.length = s + 1;
			let c = n.getParameter(e.UNPACK_ROW_LENGTH), l = n.getParameter(e.UNPACK_SKIP_PIXELS), u = n.getParameter(e.UNPACK_SKIP_ROWS);
			n.pixelStorei(e.UNPACK_ROW_LENGTH, r.width);
			for (let t = 0, s = o.length; t < s; t++) {
				let s = o[t], c = Math.floor(s.start / 4), l = Math.ceil(s.count / 4), u = c % r.width, d = Math.floor(c / r.width), f = l;
				n.pixelStorei(e.UNPACK_SKIP_PIXELS, u), n.pixelStorei(e.UNPACK_SKIP_ROWS, d), n.texSubImage2D(e.TEXTURE_2D, 0, u, d, f, 1, i, a, r.data);
			}
			t.clearUpdateRanges(), n.pixelStorei(e.UNPACK_ROW_LENGTH, c), n.pixelStorei(e.UNPACK_SKIP_PIXELS, l), n.pixelStorei(e.UNPACK_SKIP_ROWS, u);
		}
	}
	function le(t, o, s) {
		let c = e.TEXTURE_2D;
		(o.isDataArrayTexture || o.isCompressedArrayTexture) && (c = e.TEXTURE_2D_ARRAY), o.isData3DTexture && (c = e.TEXTURE_3D);
		let l = se(t, o), u = o.source;
		n.bindTexture(c, t.__webglTexture, e.TEXTURE0 + s);
		let f = r.get(u);
		if (u.version !== f.__version || l === !0) {
			if (n.activeTexture(e.TEXTURE0 + s), !(typeof ImageBitmap < "u" && o.image instanceof ImageBitmap)) {
				let t = K.getPrimaries(K.workingColorSpace), r = o.colorSpace === "" ? null : K.getPrimaries(o.colorSpace), i = o.colorSpace === "" || t === r ? e.NONE : e.BROWSER_DEFAULT_WEBGL;
				n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, o.flipY), n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, o.premultiplyAlpha), n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, i);
			}
			n.pixelStorei(e.UNPACK_ALIGNMENT, o.unpackAlignment);
			let t = g(o.image, !1, i.maxTextureSize);
			t = Ce(o, t);
			let r = a.convert(o.format, o.colorSpace), p = a.convert(o.type), m = b(o.internalFormat, r, p, o.normalized, o.colorSpace, o.isVideoTexture);
			oe(c, o);
			let h, y = o.mipmaps, C = o.isVideoTexture !== !0, w = f.__version === void 0 || l === !0, T = u.dataReady, E = S(o, t);
			if (o.isDepthTexture) m = x(o.format === lt, o.type), w && (C ? n.texStorage2D(e.TEXTURE_2D, 1, m, t.width, t.height) : n.texImage2D(e.TEXTURE_2D, 0, m, t.width, t.height, 0, r, p, null));
			else if (o.isDataTexture) if (y.length > 0) {
				C && w && n.texStorage2D(e.TEXTURE_2D, E, m, y[0].width, y[0].height);
				for (let t = 0, i = y.length; t < i; t++) h = y[t], C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, p, h.data) : n.texImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, r, p, h.data);
				o.generateMipmaps = !1;
			} else C ? (w && n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height), T && ce(o, t, r, p)) : n.texImage2D(e.TEXTURE_2D, 0, m, t.width, t.height, 0, r, p, t.data);
			else if (o.isCompressedTexture) if (o.isCompressedArrayTexture) {
				C && w && n.texStorage3D(e.TEXTURE_2D_ARRAY, E, m, y[0].width, y[0].height, t.depth);
				for (let i = 0, a = y.length; i < a; i++) if (h = y[i], o.format !== 1023) if (r !== null) if (C) {
					if (T) if (o.layerUpdates.size > 0) {
						let t = bs(h.width, h.height, o.format, o.type);
						for (let a of o.layerUpdates) {
							let o = h.data.subarray(a * t / h.data.BYTES_PER_ELEMENT, (a + 1) * t / h.data.BYTES_PER_ELEMENT);
							n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, a, h.width, h.height, 1, r, o);
						}
						o.clearLayerUpdates();
					} else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, 0, h.width, h.height, t.depth, r, h.data);
				} else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY, i, m, h.width, h.height, t.depth, 0, h.data, 0, 0);
				else B("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
				else C ? T && n.texSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, 0, h.width, h.height, t.depth, r, p, h.data) : n.texImage3D(e.TEXTURE_2D_ARRAY, i, m, h.width, h.height, t.depth, 0, r, p, h.data);
			} else {
				C && w && n.texStorage2D(e.TEXTURE_2D, E, m, y[0].width, y[0].height);
				for (let t = 0, i = y.length; t < i; t++) h = y[t], o.format === 1023 ? C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, p, h.data) : n.texImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, r, p, h.data) : r === null ? B("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()") : C ? T && n.compressedTexSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, h.data) : n.compressedTexImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, h.data);
			}
			else if (o.isDataArrayTexture) if (C) {
				if (w && n.texStorage3D(e.TEXTURE_2D_ARRAY, E, m, t.width, t.height, t.depth), T) if (o.layerUpdates.size > 0) {
					let i = bs(t.width, t.height, o.format, o.type);
					for (let a of o.layerUpdates) {
						let o = t.data.subarray(a * i / t.data.BYTES_PER_ELEMENT, (a + 1) * i / t.data.BYTES_PER_ELEMENT);
						n.texSubImage3D(e.TEXTURE_2D_ARRAY, 0, 0, 0, a, t.width, t.height, 1, r, p, o);
					}
					o.clearLayerUpdates();
				} else n.texSubImage3D(e.TEXTURE_2D_ARRAY, 0, 0, 0, 0, t.width, t.height, t.depth, r, p, t.data);
			} else n.texImage3D(e.TEXTURE_2D_ARRAY, 0, m, t.width, t.height, t.depth, 0, r, p, t.data);
			else if (o.isData3DTexture) C ? (w && n.texStorage3D(e.TEXTURE_3D, E, m, t.width, t.height, t.depth), T && n.texSubImage3D(e.TEXTURE_3D, 0, 0, 0, 0, t.width, t.height, t.depth, r, p, t.data)) : n.texImage3D(e.TEXTURE_3D, 0, m, t.width, t.height, t.depth, 0, r, p, t.data);
			else if (o.isFramebufferTexture) {
				if (w) if (C) n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height);
				else {
					let i = t.width, a = t.height;
					for (let t = 0; t < E; t++) n.texImage2D(e.TEXTURE_2D, t, m, i, a, 0, r, p, null), i >>= 1, a >>= 1;
				}
			} else if (o.isHTMLTexture) {
				if ("texElementImage2D" in e) {
					let n = e.canvas;
					if (n.hasAttribute("layoutsubtree") || n.setAttribute("layoutsubtree", "true"), t.parentNode !== n) {
						n.appendChild(t), d.add(o), n.onpaint = (e) => {
							let t = e.changedElements;
							for (let e of d) t.includes(e.image) && (e.needsUpdate = !0);
						}, n.requestPaint();
						return;
					}
					if (e.texElementImage2D.length === 3) e.texElementImage2D(e.TEXTURE_2D, e.RGBA8, t);
					else {
						let n = e.RGBA, r = e.RGBA, i = e.UNSIGNED_BYTE;
						e.texElementImage2D(e.TEXTURE_2D, 0, n, r, i, t);
					}
					e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
				}
			} else if (y.length > 0) {
				if (C && w) {
					let t = we(y[0]);
					n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height);
				}
				for (let t = 0, i = y.length; t < i; t++) h = y[t], C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, r, p, h) : n.texImage2D(e.TEXTURE_2D, t, m, r, p, h);
				o.generateMipmaps = !1;
			} else if (C) {
				if (w) {
					let r = we(t);
					n.texStorage2D(e.TEXTURE_2D, E, m, r.width, r.height);
				}
				T && n.texSubImage2D(e.TEXTURE_2D, 0, 0, 0, r, p, t);
			} else n.texImage2D(e.TEXTURE_2D, 0, m, r, p, t);
			_(o) && v(c), f.__version = u.version, o.onUpdate && o.onUpdate(o);
		}
		t.__version = o.version;
	}
	function ue(t, o, s) {
		if (o.image.length !== 6) return;
		let c = se(t, o), l = o.source;
		n.bindTexture(e.TEXTURE_CUBE_MAP, t.__webglTexture, e.TEXTURE0 + s);
		let u = r.get(l);
		if (l.version !== u.__version || c === !0) {
			n.activeTexture(e.TEXTURE0 + s);
			let t = K.getPrimaries(K.workingColorSpace), r = o.colorSpace === "" ? null : K.getPrimaries(o.colorSpace), d = o.colorSpace === "" || t === r ? e.NONE : e.BROWSER_DEFAULT_WEBGL;
			n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, o.flipY), n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, o.premultiplyAlpha), n.pixelStorei(e.UNPACK_ALIGNMENT, o.unpackAlignment), n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, d);
			let f = o.isCompressedTexture || o.image[0].isCompressedTexture, p = o.image[0] && o.image[0].isDataTexture, m = [];
			for (let e = 0; e < 6; e++) !f && !p ? m[e] = g(o.image[e], !0, i.maxCubemapSize) : m[e] = p ? o.image[e].image : o.image[e], m[e] = Ce(o, m[e]);
			let h = m[0], y = a.convert(o.format, o.colorSpace), x = a.convert(o.type), C = b(o.internalFormat, y, x, o.normalized, o.colorSpace), w = o.isVideoTexture !== !0, T = u.__version === void 0 || c === !0, E = l.dataReady, D = S(o, h);
			oe(e.TEXTURE_CUBE_MAP, o);
			let O;
			if (f) {
				w && T && n.texStorage2D(e.TEXTURE_CUBE_MAP, D, C, h.width, h.height);
				for (let t = 0; t < 6; t++) {
					O = m[t].mipmaps;
					for (let r = 0; r < O.length; r++) {
						let i = O[r];
						o.format === 1023 ? w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, 0, 0, i.width, i.height, y, x, i.data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, C, i.width, i.height, 0, y, x, i.data) : y === null ? B("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()") : w ? E && n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, 0, 0, i.width, i.height, y, i.data) : n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, C, i.width, i.height, 0, i.data);
					}
				}
			} else {
				if (O = o.mipmaps, w && T) {
					O.length > 0 && D++;
					let t = we(m[0]);
					n.texStorage2D(e.TEXTURE_CUBE_MAP, D, C, t.width, t.height);
				}
				for (let t = 0; t < 6; t++) if (p) {
					w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, 0, 0, m[t].width, m[t].height, y, x, m[t].data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, C, m[t].width, m[t].height, 0, y, x, m[t].data);
					for (let r = 0; r < O.length; r++) {
						let i = O[r].image[t].image;
						w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, 0, 0, i.width, i.height, y, x, i.data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, C, i.width, i.height, 0, y, x, i.data);
					}
				} else {
					w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, 0, 0, y, x, m[t]) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, C, y, x, m[t]);
					for (let r = 0; r < O.length; r++) {
						let i = O[r];
						w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, 0, 0, y, x, i.image[t]) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, C, y, x, i.image[t]);
					}
				}
			}
			_(o) && v(e.TEXTURE_CUBE_MAP), u.__version = l.version, o.onUpdate && o.onUpdate(o);
		}
		t.__version = o.version;
	}
	function de(t, i, o, c, l, u) {
		let d = a.convert(o.format, o.colorSpace), f = a.convert(o.type), p = b(o.internalFormat, d, f, o.normalized, o.colorSpace), m = r.get(i), h = r.get(o);
		if (h.__renderTarget = i, !m.__hasExternalTextures) {
			let t = Math.max(1, i.width >> u), r = Math.max(1, i.height >> u);
			l === e.TEXTURE_3D || l === e.TEXTURE_2D_ARRAY ? n.texImage3D(l, u, p, t, r, i.depth, 0, d, f, null) : n.texImage2D(l, u, p, t, r, 0, d, f, null);
		}
		n.bindFramebuffer(e.FRAMEBUFFER, t), I(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, c, l, h.__webglTexture, 0, xe(i)) : (l === e.TEXTURE_2D || l >= e.TEXTURE_CUBE_MAP_POSITIVE_X && l <= e.TEXTURE_CUBE_MAP_NEGATIVE_Z) && e.framebufferTexture2D(e.FRAMEBUFFER, c, l, h.__webglTexture, u), n.bindFramebuffer(e.FRAMEBUFFER, null);
	}
	function fe(t, n, r) {
		if (e.bindRenderbuffer(e.RENDERBUFFER, t), n.depthBuffer) {
			let i = n.depthTexture, a = i && i.isDepthTexture ? i.type : null, o = x(n.stencilBuffer, a), c = n.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
			I(n) ? s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER, xe(n), o, n.width, n.height) : r ? e.renderbufferStorageMultisample(e.RENDERBUFFER, xe(n), o, n.width, n.height) : e.renderbufferStorage(e.RENDERBUFFER, o, n.width, n.height), e.framebufferRenderbuffer(e.FRAMEBUFFER, c, e.RENDERBUFFER, t);
		} else {
			let t = n.textures;
			for (let i = 0; i < t.length; i++) {
				let o = t[i], c = a.convert(o.format, o.colorSpace), l = a.convert(o.type), u = b(o.internalFormat, c, l, o.normalized, o.colorSpace);
				I(n) ? s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER, xe(n), u, n.width, n.height) : r ? e.renderbufferStorageMultisample(e.RENDERBUFFER, xe(n), u, n.width, n.height) : e.renderbufferStorage(e.RENDERBUFFER, u, n.width, n.height);
			}
		}
		e.bindRenderbuffer(e.RENDERBUFFER, null);
	}
	function pe(t, i, o) {
		let c = i.isWebGLCubeRenderTarget === !0;
		if (n.bindFramebuffer(e.FRAMEBUFFER, t), !(i.depthTexture && i.depthTexture.isDepthTexture)) throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");
		let l = r.get(i.depthTexture);
		if (l.__renderTarget = i, (!l.__webglTexture || i.depthTexture.image.width !== i.width || i.depthTexture.image.height !== i.height) && (i.depthTexture.image.width = i.width, i.depthTexture.image.height = i.height, i.depthTexture.needsUpdate = !0), c) {
			if (l.__webglInit === void 0 && (l.__webglInit = !0, i.depthTexture.addEventListener("dispose", C)), l.__webglTexture === void 0) {
				l.__webglTexture = e.createTexture(), n.bindTexture(e.TEXTURE_CUBE_MAP, l.__webglTexture), oe(e.TEXTURE_CUBE_MAP, i.depthTexture);
				let t = a.convert(i.depthTexture.format), r = a.convert(i.depthTexture.type), o;
				i.depthTexture.format === 1026 ? o = e.DEPTH_COMPONENT24 : i.depthTexture.format === 1027 && (o = e.DEPTH24_STENCIL8);
				for (let n = 0; n < 6; n++) e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + n, 0, o, i.width, i.height, 0, t, r, null);
			}
		} else N(i.depthTexture, 0);
		let u = l.__webglTexture, d = xe(i), f = c ? e.TEXTURE_CUBE_MAP_POSITIVE_X + o : e.TEXTURE_2D, p = i.depthTexture.format === 1027 ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
		if (i.depthTexture.format === 1026) I(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, p, f, u, 0, d) : e.framebufferTexture2D(e.FRAMEBUFFER, p, f, u, 0);
		else if (i.depthTexture.format === 1027) I(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, p, f, u, 0, d) : e.framebufferTexture2D(e.FRAMEBUFFER, p, f, u, 0);
		else throw Error("THREE.WebGLTextures: Unknown depthTexture format.");
	}
	function me(t) {
		let i = r.get(t), a = t.isWebGLCubeRenderTarget === !0;
		if (i.__boundDepthTexture !== t.depthTexture) {
			let e = t.depthTexture;
			if (i.__depthDisposeCallback && i.__depthDisposeCallback(), e) {
				let t = () => {
					delete i.__boundDepthTexture, delete i.__depthDisposeCallback, e.removeEventListener("dispose", t);
				};
				e.addEventListener("dispose", t), i.__depthDisposeCallback = t;
			}
			i.__boundDepthTexture = e;
		}
		if (t.depthTexture && !i.__autoAllocateDepthBuffer) if (a) for (let e = 0; e < 6; e++) pe(i.__webglFramebuffer[e], t, e);
		else {
			let e = t.texture.mipmaps;
			e && e.length > 0 ? pe(i.__webglFramebuffer[0], t, 0) : pe(i.__webglFramebuffer, t, 0);
		}
		else if (a) {
			i.__webglDepthbuffer = [];
			for (let r = 0; r < 6; r++) if (n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer[r]), i.__webglDepthbuffer[r] === void 0) i.__webglDepthbuffer[r] = e.createRenderbuffer(), fe(i.__webglDepthbuffer[r], t, !1);
			else {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, a = i.__webglDepthbuffer[r];
				e.bindRenderbuffer(e.RENDERBUFFER, a), e.framebufferRenderbuffer(e.FRAMEBUFFER, n, e.RENDERBUFFER, a);
			}
		} else {
			let r = t.texture.mipmaps;
			if (r && r.length > 0 ? n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer[0]) : n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer), i.__webglDepthbuffer === void 0) i.__webglDepthbuffer = e.createRenderbuffer(), fe(i.__webglDepthbuffer, t, !1);
			else {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, r = i.__webglDepthbuffer;
				e.bindRenderbuffer(e.RENDERBUFFER, r), e.framebufferRenderbuffer(e.FRAMEBUFFER, n, e.RENDERBUFFER, r);
			}
		}
		n.bindFramebuffer(e.FRAMEBUFFER, null);
	}
	function he(t, n, i) {
		let a = r.get(t);
		n !== void 0 && de(a.__webglFramebuffer, t, t.texture, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, 0), i !== void 0 && me(t);
	}
	function ge(t) {
		let i = t.texture, s = r.get(t), c = r.get(i);
		t.addEventListener("dispose", w);
		let l = t.textures, u = t.isWebGLCubeRenderTarget === !0, d = l.length > 1;
		if (d || (c.__webglTexture === void 0 && (c.__webglTexture = e.createTexture()), c.__version = i.version, o.memory.textures++), u) {
			s.__webglFramebuffer = [];
			for (let t = 0; t < 6; t++) if (i.mipmaps && i.mipmaps.length > 0) {
				s.__webglFramebuffer[t] = [];
				for (let n = 0; n < i.mipmaps.length; n++) s.__webglFramebuffer[t][n] = e.createFramebuffer();
			} else s.__webglFramebuffer[t] = e.createFramebuffer();
		} else {
			if (i.mipmaps && i.mipmaps.length > 0) {
				s.__webglFramebuffer = [];
				for (let t = 0; t < i.mipmaps.length; t++) s.__webglFramebuffer[t] = e.createFramebuffer();
			} else s.__webglFramebuffer = e.createFramebuffer();
			if (d) for (let t = 0, n = l.length; t < n; t++) {
				let n = r.get(l[t]);
				n.__webglTexture === void 0 && (n.__webglTexture = e.createTexture(), o.memory.textures++);
			}
			if (t.samples > 0 && I(t) === !1) {
				s.__webglMultisampledFramebuffer = e.createFramebuffer(), s.__webglColorRenderbuffer = [], n.bindFramebuffer(e.FRAMEBUFFER, s.__webglMultisampledFramebuffer);
				for (let n = 0; n < l.length; n++) {
					let r = l[n];
					s.__webglColorRenderbuffer[n] = e.createRenderbuffer(), e.bindRenderbuffer(e.RENDERBUFFER, s.__webglColorRenderbuffer[n]);
					let i = a.convert(r.format, r.colorSpace), o = a.convert(r.type), c = b(r.internalFormat, i, o, r.normalized, r.colorSpace, t.isXRRenderTarget === !0), u = xe(t);
					e.renderbufferStorageMultisample(e.RENDERBUFFER, u, c, t.width, t.height), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + n, e.RENDERBUFFER, s.__webglColorRenderbuffer[n]);
				}
				e.bindRenderbuffer(e.RENDERBUFFER, null), t.depthBuffer && (s.__webglDepthRenderbuffer = e.createRenderbuffer(), fe(s.__webglDepthRenderbuffer, t, !0)), n.bindFramebuffer(e.FRAMEBUFFER, null);
			}
		}
		if (u) {
			n.bindTexture(e.TEXTURE_CUBE_MAP, c.__webglTexture), oe(e.TEXTURE_CUBE_MAP, i);
			for (let n = 0; n < 6; n++) if (i.mipmaps && i.mipmaps.length > 0) for (let r = 0; r < i.mipmaps.length; r++) de(s.__webglFramebuffer[n][r], t, i, e.COLOR_ATTACHMENT0, e.TEXTURE_CUBE_MAP_POSITIVE_X + n, r);
			else de(s.__webglFramebuffer[n], t, i, e.COLOR_ATTACHMENT0, e.TEXTURE_CUBE_MAP_POSITIVE_X + n, 0);
			_(i) && v(e.TEXTURE_CUBE_MAP), n.unbindTexture();
		} else if (d) {
			for (let i = 0, a = l.length; i < a; i++) {
				let a = l[i], o = r.get(a), c = e.TEXTURE_2D;
				(t.isWebGL3DRenderTarget || t.isWebGLArrayRenderTarget) && (c = t.isWebGL3DRenderTarget ? e.TEXTURE_3D : e.TEXTURE_2D_ARRAY), n.bindTexture(c, o.__webglTexture), oe(c, a), de(s.__webglFramebuffer, t, a, e.COLOR_ATTACHMENT0 + i, c, 0), _(a) && v(c);
			}
			n.unbindTexture();
		} else {
			let r = e.TEXTURE_2D;
			if ((t.isWebGL3DRenderTarget || t.isWebGLArrayRenderTarget) && (r = t.isWebGL3DRenderTarget ? e.TEXTURE_3D : e.TEXTURE_2D_ARRAY), n.bindTexture(r, c.__webglTexture), oe(r, i), i.mipmaps && i.mipmaps.length > 0) for (let n = 0; n < i.mipmaps.length; n++) de(s.__webglFramebuffer[n], t, i, e.COLOR_ATTACHMENT0, r, n);
			else de(s.__webglFramebuffer, t, i, e.COLOR_ATTACHMENT0, r, 0);
			_(i) && v(r), n.unbindTexture();
		}
		t.depthBuffer && me(t);
	}
	function _e(e) {
		let t = e.textures;
		for (let i = 0, a = t.length; i < a; i++) {
			let a = t[i];
			if (_(a)) {
				let t = y(e), i = r.get(a).__webglTexture;
				n.bindTexture(t, i), v(t), n.unbindTexture();
			}
		}
	}
	let ve = [], ye = [];
	function be(t) {
		if (t.samples > 0) {
			if (I(t) === !1) {
				let i = t.textures, a = t.width, o = t.height, s = e.COLOR_BUFFER_BIT, l = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, u = r.get(t), d = i.length > 1;
				if (d) for (let t = 0; t < i.length; t++) n.bindFramebuffer(e.FRAMEBUFFER, u.__webglMultisampledFramebuffer), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.RENDERBUFFER, null), n.bindFramebuffer(e.FRAMEBUFFER, u.__webglFramebuffer), e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.TEXTURE_2D, null, 0);
				n.bindFramebuffer(e.READ_FRAMEBUFFER, u.__webglMultisampledFramebuffer);
				let f = t.texture.mipmaps;
				f && f.length > 0 ? n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglFramebuffer[0]) : n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglFramebuffer);
				for (let n = 0; n < i.length; n++) {
					if (t.resolveDepthBuffer && (t.depthBuffer && (s |= e.DEPTH_BUFFER_BIT), t.stencilBuffer && t.resolveStencilBuffer && (s |= e.STENCIL_BUFFER_BIT)), d) {
						e.framebufferRenderbuffer(e.READ_FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.RENDERBUFFER, u.__webglColorRenderbuffer[n]);
						let t = r.get(i[n]).__webglTexture;
						e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, t, 0);
					}
					e.blitFramebuffer(0, 0, a, o, 0, 0, a, o, s, e.NEAREST), c === !0 && (ve.length = 0, ye.length = 0, ve.push(e.COLOR_ATTACHMENT0 + n), t.depthBuffer && t.resolveDepthBuffer === !1 && (ve.push(l), ye.push(l), e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER, ye)), e.invalidateFramebuffer(e.READ_FRAMEBUFFER, ve));
				}
				if (n.bindFramebuffer(e.READ_FRAMEBUFFER, null), n.bindFramebuffer(e.DRAW_FRAMEBUFFER, null), d) for (let t = 0; t < i.length; t++) {
					n.bindFramebuffer(e.FRAMEBUFFER, u.__webglMultisampledFramebuffer), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.RENDERBUFFER, u.__webglColorRenderbuffer[t]);
					let a = r.get(i[t]).__webglTexture;
					n.bindFramebuffer(e.FRAMEBUFFER, u.__webglFramebuffer), e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.TEXTURE_2D, a, 0);
				}
				n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglMultisampledFramebuffer);
			} else if (t.depthBuffer && t.resolveDepthBuffer === !1 && c) {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
				e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER, [n]);
			}
		}
	}
	function xe(e) {
		return Math.min(i.maxSamples, e.samples);
	}
	function I(e) {
		let n = r.get(e);
		return e.samples > 0 && t.has("WEBGL_multisampled_render_to_texture") === !0 && n.__useRenderToTexture !== !1;
	}
	function Se(e) {
		let t = o.render.frame;
		u.get(e) !== t && (u.set(e, t), e.update());
	}
	function Ce(e, t) {
		let n = e.colorSpace, r = e.format, i = e.type;
		return e.isCompressedTexture === !0 || e.isVideoTexture === !0 || n !== "srgb-linear" && n !== "" && (K.getTransfer(n) === "srgb" ? (r !== 1023 || i !== 1009) && B("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.") : V("WebGLTextures: Unsupported texture color space:", n)), t;
	}
	function we(e) {
		return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement ? (l.width = e.naturalWidth || e.width, l.height = e.naturalHeight || e.height) : typeof VideoFrame < "u" && e instanceof VideoFrame ? (l.width = e.displayWidth, l.height = e.displayHeight) : (l.width = e.width, l.height = e.height), l;
	}
	this.allocateTextureUnit = ee, this.resetTextureUnits = k, this.getTextureUnits = A, this.setTextureUnits = j, this.setTexture2D = N, this.setTexture2DArray = te, this.setTexture3D = P, this.setTextureCube = ne, this.rebindTextures = he, this.setupRenderTarget = ge, this.updateRenderTargetMipmap = _e, this.updateMultisampleRenderTarget = be, this.setupDepthRenderbuffer = me, this.setupFrameBufferTexture = de, this.useMultisampledRTT = I, this.isReversedDepthBuffer = function() {
		return n.buffers.depth.getReversed();
	};
}
function Tu(e, t) {
	function n(n, r = "") {
		let i, a = K.getTransfer(r);
		if (n === 1009) return e.UNSIGNED_BYTE;
		if (n === 1017) return e.UNSIGNED_SHORT_4_4_4_4;
		if (n === 1018) return e.UNSIGNED_SHORT_5_5_5_1;
		if (n === 35902) return e.UNSIGNED_INT_5_9_9_9_REV;
		if (n === 35899) return e.UNSIGNED_INT_10F_11F_11F_REV;
		if (n === 1010) return e.BYTE;
		if (n === 1011) return e.SHORT;
		if (n === 1012) return e.UNSIGNED_SHORT;
		if (n === 1013) return e.INT;
		if (n === 1014) return e.UNSIGNED_INT;
		if (n === 1015) return e.FLOAT;
		if (n === 1016) return e.HALF_FLOAT;
		if (n === 1021) return e.ALPHA;
		if (n === 1022) return e.RGB;
		if (n === 1023) return e.RGBA;
		if (n === 1026) return e.DEPTH_COMPONENT;
		if (n === 1027) return e.DEPTH_STENCIL;
		if (n === 1028) return e.RED;
		if (n === 1029) return e.RED_INTEGER;
		if (n === 1030) return e.RG;
		if (n === 1031) return e.RG_INTEGER;
		if (n === 1033) return e.RGBA_INTEGER;
		if (n === 33776 || n === 33777 || n === 33778 || n === 33779) if (a === "srgb") if (i = t.get("WEBGL_compressed_texture_s3tc_srgb"), i !== null) {
			if (n === 33776) return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;
			if (n === 33777) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
			if (n === 33778) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
			if (n === 33779) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
		} else return null;
		else if (i = t.get("WEBGL_compressed_texture_s3tc"), i !== null) {
			if (n === 33776) return i.COMPRESSED_RGB_S3TC_DXT1_EXT;
			if (n === 33777) return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;
			if (n === 33778) return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;
			if (n === 33779) return i.COMPRESSED_RGBA_S3TC_DXT5_EXT;
		} else return null;
		if (n === 35840 || n === 35841 || n === 35842 || n === 35843) if (i = t.get("WEBGL_compressed_texture_pvrtc"), i !== null) {
			if (n === 35840) return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
			if (n === 35841) return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
			if (n === 35842) return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
			if (n === 35843) return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
		} else return null;
		if (n === 36196 || n === 37492 || n === 37496 || n === 37488 || n === 37489 || n === 37490 || n === 37491) if (i = t.get("WEBGL_compressed_texture_etc"), i !== null) {
			if (n === 36196 || n === 37492) return a === "srgb" ? i.COMPRESSED_SRGB8_ETC2 : i.COMPRESSED_RGB8_ETC2;
			if (n === 37496) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC : i.COMPRESSED_RGBA8_ETC2_EAC;
			if (n === 37488) return i.COMPRESSED_R11_EAC;
			if (n === 37489) return i.COMPRESSED_SIGNED_R11_EAC;
			if (n === 37490) return i.COMPRESSED_RG11_EAC;
			if (n === 37491) return i.COMPRESSED_SIGNED_RG11_EAC;
		} else return null;
		if (n === 37808 || n === 37809 || n === 37810 || n === 37811 || n === 37812 || n === 37813 || n === 37814 || n === 37815 || n === 37816 || n === 37817 || n === 37818 || n === 37819 || n === 37820 || n === 37821) if (i = t.get("WEBGL_compressed_texture_astc"), i !== null) {
			if (n === 37808) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR : i.COMPRESSED_RGBA_ASTC_4x4_KHR;
			if (n === 37809) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR : i.COMPRESSED_RGBA_ASTC_5x4_KHR;
			if (n === 37810) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR : i.COMPRESSED_RGBA_ASTC_5x5_KHR;
			if (n === 37811) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR : i.COMPRESSED_RGBA_ASTC_6x5_KHR;
			if (n === 37812) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR : i.COMPRESSED_RGBA_ASTC_6x6_KHR;
			if (n === 37813) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR : i.COMPRESSED_RGBA_ASTC_8x5_KHR;
			if (n === 37814) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR : i.COMPRESSED_RGBA_ASTC_8x6_KHR;
			if (n === 37815) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR : i.COMPRESSED_RGBA_ASTC_8x8_KHR;
			if (n === 37816) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR : i.COMPRESSED_RGBA_ASTC_10x5_KHR;
			if (n === 37817) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR : i.COMPRESSED_RGBA_ASTC_10x6_KHR;
			if (n === 37818) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR : i.COMPRESSED_RGBA_ASTC_10x8_KHR;
			if (n === 37819) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR : i.COMPRESSED_RGBA_ASTC_10x10_KHR;
			if (n === 37820) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR : i.COMPRESSED_RGBA_ASTC_12x10_KHR;
			if (n === 37821) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR : i.COMPRESSED_RGBA_ASTC_12x12_KHR;
		} else return null;
		if (n === 36492 || n === 36494 || n === 36495) if (i = t.get("EXT_texture_compression_bptc"), i !== null) {
			if (n === 36492) return a === "srgb" ? i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT : i.COMPRESSED_RGBA_BPTC_UNORM_EXT;
			if (n === 36494) return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
			if (n === 36495) return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
		} else return null;
		if (n === 36283 || n === 36284 || n === 36285 || n === 36286) if (i = t.get("EXT_texture_compression_rgtc"), i !== null) {
			if (n === 36283) return i.COMPRESSED_RED_RGTC1_EXT;
			if (n === 36284) return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;
			if (n === 36285) return i.COMPRESSED_RED_GREEN_RGTC2_EXT;
			if (n === 36286) return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
		} else return null;
		return n === 1020 ? e.UNSIGNED_INT_24_8 : e[n] === void 0 ? null : e[n];
	}
	return { convert: n };
}
var Eu = "\nvoid main() {\n\n	gl_Position = vec4( position, 1.0 );\n\n}", Du = "\nuniform sampler2DArray depthColor;\nuniform float depthWidth;\nuniform float depthHeight;\n\nvoid main() {\n\n	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );\n\n	if ( coord.x >= 1.0 ) {\n\n		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;\n\n	} else {\n\n		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;\n\n	}\n\n}", Ou = class {
	constructor() {
		this.texture = null, this.mesh = null, this.depthNear = 0, this.depthFar = 0;
	}
	init(e, t) {
		if (this.texture === null) {
			let n = new Ja(e.texture);
			(e.depthNear !== t.depthNear || e.depthFar !== t.depthFar) && (this.depthNear = e.depthNear, this.depthFar = e.depthFar), this.texture = n;
		}
	}
	getMesh(e) {
		if (this.texture !== null && this.mesh === null) {
			let t = e.cameras[0].viewport, n = new mo({
				vertexShader: Eu,
				fragmentShader: Du,
				uniforms: {
					depthColor: { value: this.texture },
					depthWidth: { value: t.z },
					depthHeight: { value: t.w }
				}
			});
			this.mesh = new X(new to(20, 20), n);
		}
		return this.mesh;
	}
	reset() {
		this.texture = null, this.mesh = null;
	}
	getDepthTexture() {
		return this.texture;
	}
}, ku = class extends Cn {
	constructor(e, t) {
		super();
		let n = this, r = null, i = 1, a = null, o = "local-floor", s = 1, c = null, l = null, u = null, d = null, f = null, p = null, m = typeof XRWebGLBinding < "u", h = new Ou(), g = {}, _ = t.getContextAttributes(), v = null, y = null, b = [], x = [], S = new U(), C = null, w = new qo();
		w.viewport = new pr();
		let T = new qo();
		T.viewport = new pr();
		let E = [w, T], D = new rs(), O = null, k = null;
		this.cameraAutoUpdate = !0, this.enabled = !1, this.isPresenting = !1, this.getController = function(e) {
			let t = b[e];
			return t === void 0 && (t = new qr(), b[e] = t), t.getTargetRaySpace();
		}, this.getControllerGrip = function(e) {
			let t = b[e];
			return t === void 0 && (t = new qr(), b[e] = t), t.getGripSpace();
		}, this.getHand = function(e) {
			let t = b[e];
			return t === void 0 && (t = new qr(), b[e] = t), t.getHandSpace();
		};
		function A(e) {
			let t = x.indexOf(e.inputSource);
			if (t === -1) return;
			let n = b[t];
			n !== void 0 && (n.update(e.inputSource, e.frame, c || a), n.dispatchEvent({
				type: e.type,
				data: e.inputSource
			}));
		}
		function j() {
			r.removeEventListener("select", A), r.removeEventListener("selectstart", A), r.removeEventListener("selectend", A), r.removeEventListener("squeeze", A), r.removeEventListener("squeezestart", A), r.removeEventListener("squeezeend", A), r.removeEventListener("end", j), r.removeEventListener("inputsourceschange", ee);
			for (let e = 0; e < b.length; e++) {
				let t = x[e];
				t !== null && (x[e] = null, b[e].disconnect(t));
			}
			O = null, k = null, h.reset();
			for (let e in g) delete g[e];
			e.setRenderTarget(v), f = null, d = null, u = null, r = null, y = null, ae.stop(), n.isPresenting = !1, e.setPixelRatio(C), e.setSize(S.width, S.height, !1), n.dispatchEvent({ type: "sessionend" });
		}
		this.setFramebufferScaleFactor = function(e) {
			i = e, n.isPresenting === !0 && B("WebXRManager: Cannot change framebuffer scale while presenting.");
		}, this.setReferenceSpaceType = function(e) {
			o = e, n.isPresenting === !0 && B("WebXRManager: Cannot change reference space type while presenting.");
		}, this.getReferenceSpace = function() {
			return c || a;
		}, this.setReferenceSpace = function(e) {
			c = e;
		}, this.getBaseLayer = function() {
			return d === null ? f : d;
		}, this.getBinding = function() {
			return u === null && m && (u = new XRWebGLBinding(r, t)), u;
		}, this.getFrame = function() {
			return p;
		}, this.getSession = function() {
			return r;
		}, this.setSession = async function(l) {
			if (r = l, r !== null) {
				if (v = e.getRenderTarget(), r.addEventListener("select", A), r.addEventListener("selectstart", A), r.addEventListener("selectend", A), r.addEventListener("squeeze", A), r.addEventListener("squeezestart", A), r.addEventListener("squeezeend", A), r.addEventListener("end", j), r.addEventListener("inputsourceschange", ee), _.xrCompatible !== !0 && await t.makeXRCompatible(), C = e.getPixelRatio(), e.getSize(S), m && "createProjectionLayer" in XRWebGLBinding.prototype) {
					let n = null, a = null, o = null;
					_.depth && (o = _.stencil ? t.DEPTH24_STENCIL8 : t.DEPTH_COMPONENT24, n = _.stencil ? lt : ct, a = _.stencil ? nt : Ze);
					let s = {
						colorFormat: t.RGBA8,
						depthFormat: o,
						scaleFactor: i
					};
					u = this.getBinding(), d = u.createProjectionLayer(s), r.updateRenderState({ layers: [d] }), e.setPixelRatio(1), e.setSize(d.textureWidth, d.textureHeight, !1), y = new hr(d.textureWidth, d.textureHeight, {
						format: st,
						type: Ke,
						depthTexture: new Ka(d.textureWidth, d.textureHeight, a, void 0, void 0, void 0, void 0, void 0, void 0, n),
						stencilBuffer: _.stencil,
						colorSpace: e.outputColorSpace,
						samples: _.antialias ? 4 : 0,
						resolveDepthBuffer: d.ignoreDepthValues === !1,
						resolveStencilBuffer: d.ignoreDepthValues === !1
					});
				} else {
					let n = {
						antialias: _.antialias,
						alpha: !0,
						depth: _.depth,
						stencil: _.stencil,
						framebufferScaleFactor: i
					};
					f = new XRWebGLLayer(r, t, n), r.updateRenderState({ baseLayer: f }), e.setPixelRatio(1), e.setSize(f.framebufferWidth, f.framebufferHeight, !1), y = new hr(f.framebufferWidth, f.framebufferHeight, {
						format: st,
						type: Ke,
						colorSpace: e.outputColorSpace,
						stencilBuffer: _.stencil,
						resolveDepthBuffer: f.ignoreDepthValues === !1,
						resolveStencilBuffer: f.ignoreDepthValues === !1
					});
				}
				y.isXRRenderTarget = !0, this.setFoveation(s), c = null, a = await r.requestReferenceSpace(o), ae.setContext(r), ae.start(), n.isPresenting = !0, n.dispatchEvent({ type: "sessionstart" });
			}
		}, this.getEnvironmentBlendMode = function() {
			if (r !== null) return r.environmentBlendMode;
		}, this.getDepthTexture = function() {
			return h.getDepthTexture();
		};
		function ee(e) {
			for (let t = 0; t < e.removed.length; t++) {
				let n = e.removed[t], r = x.indexOf(n);
				r >= 0 && (x[r] = null, b[r].disconnect(n));
			}
			for (let t = 0; t < e.added.length; t++) {
				let n = e.added[t], r = x.indexOf(n);
				if (r === -1) {
					for (let e = 0; e < b.length; e++) if (e >= x.length) {
						x.push(n), r = e;
						break;
					} else if (x[e] === null) {
						x[e] = n, r = e;
						break;
					}
					if (r === -1) break;
				}
				let i = b[r];
				i && i.connect(n);
			}
		}
		let M = new W(), N = new W();
		function te(e, t, n) {
			M.setFromMatrixPosition(t.matrixWorld), N.setFromMatrixPosition(n.matrixWorld);
			let r = M.distanceTo(N), i = t.projectionMatrix.elements, a = n.projectionMatrix.elements, o = i[14] / (i[10] - 1), s = i[14] / (i[10] + 1), c = (i[9] + 1) / i[5], l = (i[9] - 1) / i[5], u = (i[8] - 1) / i[0], d = (a[8] + 1) / a[0], f = o * u, p = o * d, m = r / (-u + d), h = m * -u;
			if (t.matrixWorld.decompose(e.position, e.quaternion, e.scale), e.translateX(h), e.translateZ(m), e.matrixWorld.compose(e.position, e.quaternion, e.scale), e.matrixWorldInverse.copy(e.matrixWorld).invert(), i[10] === -1) e.projectionMatrix.copy(t.projectionMatrix), e.projectionMatrixInverse.copy(t.projectionMatrixInverse);
			else {
				let t = o + m, n = s + m, i = f - h, a = p + (r - h), u = c * s / n * t, d = l * s / n * t;
				e.projectionMatrix.makePerspective(i, a, u, d, t, n), e.projectionMatrixInverse.copy(e.projectionMatrix).invert();
			}
		}
		function P(e, t) {
			t === null ? e.matrixWorld.copy(e.matrix) : e.matrixWorld.multiplyMatrices(t.matrixWorld, e.matrix), e.matrixWorldInverse.copy(e.matrixWorld).invert();
		}
		this.updateCamera = function(e) {
			if (r === null) return;
			let t = e.near, n = e.far;
			h.texture !== null && (h.depthNear > 0 && (t = h.depthNear), h.depthFar > 0 && (n = h.depthFar)), D.near = T.near = w.near = t, D.far = T.far = w.far = n, (O !== D.near || k !== D.far) && (r.updateRenderState({
				depthNear: D.near,
				depthFar: D.far
			}), O = D.near, k = D.far), D.layers.mask = e.layers.mask | 6, w.layers.mask = D.layers.mask & -5, T.layers.mask = D.layers.mask & -3;
			let i = e.parent, a = D.cameras;
			P(D, i);
			for (let e = 0; e < a.length; e++) P(a[e], i);
			a.length === 2 ? te(D, w, T) : D.projectionMatrix.copy(w.projectionMatrix), ne(e, D, i);
		};
		function ne(e, t, n) {
			n === null ? e.matrix.copy(t.matrixWorld) : (e.matrix.copy(n.matrixWorld), e.matrix.invert(), e.matrix.multiply(t.matrixWorld)), e.matrix.decompose(e.position, e.quaternion, e.scale), e.updateMatrixWorld(!0), e.projectionMatrix.copy(t.projectionMatrix), e.projectionMatrixInverse.copy(t.projectionMatrixInverse), e.isPerspectiveCamera && (e.fov = Dn * 2 * Math.atan(1 / e.projectionMatrix.elements[5]), e.zoom = 1);
		}
		this.getCamera = function() {
			return D;
		}, this.getFoveation = function() {
			if (!(d === null && f === null)) return s;
		}, this.setFoveation = function(e) {
			s = e, d !== null && (d.fixedFoveation = e), f !== null && f.fixedFoveation !== void 0 && (f.fixedFoveation = e);
		}, this.hasDepthSensing = function() {
			return h.texture !== null;
		}, this.getDepthSensingMesh = function() {
			return h.getMesh(D);
		}, this.getCameraTexture = function(e) {
			return g[e];
		};
		let re = null;
		function ie(t, i) {
			if (l = i.getViewerPose(c || a), p = i, l !== null) {
				let t = l.views;
				f !== null && (e.setRenderTargetFramebuffer(y, f.framebuffer), e.setRenderTarget(y));
				let i = !1;
				t.length !== D.cameras.length && (D.cameras.length = 0, i = !0);
				for (let n = 0; n < t.length; n++) {
					let r = t[n], a = null;
					if (f !== null) a = f.getViewport(r);
					else {
						let t = u.getViewSubImage(d, r);
						a = t.viewport, n === 0 && (e.setRenderTargetTextures(y, t.colorTexture, t.depthStencilTexture), e.setRenderTarget(y));
					}
					let o = E[n];
					o === void 0 && (o = new qo(), o.layers.enable(n), o.viewport = new pr(), E[n] = o), o.matrix.fromArray(r.transform.matrix), o.matrix.decompose(o.position, o.quaternion, o.scale), o.projectionMatrix.fromArray(r.projectionMatrix), o.projectionMatrixInverse.copy(o.projectionMatrix).invert(), o.viewport.set(a.x, a.y, a.width, a.height), n === 0 && (D.matrix.copy(o.matrix), D.matrix.decompose(D.position, D.quaternion, D.scale)), i === !0 && D.cameras.push(o);
				}
				let a = r.enabledFeatures;
				if (a && a.includes("depth-sensing") && r.depthUsage == "gpu-optimized" && m) {
					u = n.getBinding();
					let e = u.getDepthInformation(t[0]);
					e && e.isValid && e.texture && h.init(e, r.renderState);
				}
				if (a && a.includes("camera-access") && m) {
					e.state.unbindTexture(), u = n.getBinding();
					for (let e = 0; e < t.length; e++) {
						let n = t[e].camera;
						if (n) {
							let e = g[n];
							e || (e = new Ja(), g[n] = e);
							let t = u.getCameraImage(n);
							e.sourceTexture = t;
						}
					}
				}
			}
			for (let e = 0; e < b.length; e++) {
				let t = x[e], n = b[e];
				t !== null && n !== void 0 && n.update(t, i, c || a);
			}
			re && re(t, i), i.detectedPlanes && n.dispatchEvent({
				type: "planesdetected",
				data: i
			}), p = null;
		}
		let ae = new Ss();
		ae.setAnimationLoop(ie), this.setAnimationLoop = function(e) {
			re = e;
		}, this.dispose = function() {};
	}
}, Au = /*@__PURE__*/ new q(), ju = /*@__PURE__*/ new G();
ju.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function Mu(e, t) {
	function n(e, t) {
		e.matrixAutoUpdate === !0 && e.updateMatrix(), t.value.copy(e.matrix);
	}
	function r(t, n) {
		n.color.getRGB(t.fogColor.value, lo(e)), n.isFog ? (t.fogNear.value = n.near, t.fogFar.value = n.far) : n.isFogExp2 && (t.fogDensity.value = n.density);
	}
	function i(e, t, n, r, i) {
		t.isNodeMaterial ? t.uniformsNeedUpdate = !1 : t.isMeshBasicMaterial ? a(e, t) : t.isMeshLambertMaterial ? (a(e, t), t.envMap && (e.envMapIntensity.value = t.envMapIntensity)) : t.isMeshToonMaterial ? (a(e, t), d(e, t)) : t.isMeshPhongMaterial ? (a(e, t), u(e, t), t.envMap && (e.envMapIntensity.value = t.envMapIntensity)) : t.isMeshStandardMaterial ? (a(e, t), f(e, t), t.isMeshPhysicalMaterial && p(e, t, i)) : t.isMeshMatcapMaterial ? (a(e, t), m(e, t)) : t.isMeshDepthMaterial ? a(e, t) : t.isMeshDistanceMaterial ? (a(e, t), h(e, t)) : t.isMeshNormalMaterial ? a(e, t) : t.isLineBasicMaterial ? (o(e, t), t.isLineDashedMaterial && s(e, t)) : t.isPointsMaterial ? c(e, t, n, r) : t.isSpriteMaterial ? l(e, t) : t.isShadowMaterial ? (e.color.value.copy(t.color), e.opacity.value = t.opacity) : t.isShaderMaterial && (t.uniformsNeedUpdate = !1);
	}
	function a(e, r) {
		e.opacity.value = r.opacity, r.color && e.diffuse.value.copy(r.color), r.emissive && e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity), r.map && (e.map.value = r.map, n(r.map, e.mapTransform)), r.alphaMap && (e.alphaMap.value = r.alphaMap, n(r.alphaMap, e.alphaMapTransform)), r.bumpMap && (e.bumpMap.value = r.bumpMap, n(r.bumpMap, e.bumpMapTransform), e.bumpScale.value = r.bumpScale, r.side === 1 && (e.bumpScale.value *= -1)), r.normalMap && (e.normalMap.value = r.normalMap, n(r.normalMap, e.normalMapTransform), e.normalScale.value.copy(r.normalScale), r.side === 1 && e.normalScale.value.negate()), r.displacementMap && (e.displacementMap.value = r.displacementMap, n(r.displacementMap, e.displacementMapTransform), e.displacementScale.value = r.displacementScale, e.displacementBias.value = r.displacementBias), r.emissiveMap && (e.emissiveMap.value = r.emissiveMap, n(r.emissiveMap, e.emissiveMapTransform)), r.specularMap && (e.specularMap.value = r.specularMap, n(r.specularMap, e.specularMapTransform)), r.alphaTest > 0 && (e.alphaTest.value = r.alphaTest);
		let i = t.get(r), a = i.envMap, o = i.envMapRotation;
		a && (e.envMap.value = a, e.envMapRotation.value.setFromMatrix4(Au.makeRotationFromEuler(o)).transpose(), a.isCubeTexture && a.isRenderTargetTexture === !1 && e.envMapRotation.value.premultiply(ju), e.reflectivity.value = r.reflectivity, e.ior.value = r.ior, e.refractionRatio.value = r.refractionRatio), r.lightMap && (e.lightMap.value = r.lightMap, e.lightMapIntensity.value = r.lightMapIntensity, n(r.lightMap, e.lightMapTransform)), r.aoMap && (e.aoMap.value = r.aoMap, e.aoMapIntensity.value = r.aoMapIntensity, n(r.aoMap, e.aoMapTransform));
	}
	function o(e, t) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, t.map && (e.map.value = t.map, n(t.map, e.mapTransform));
	}
	function s(e, t) {
		e.dashSize.value = t.dashSize, e.totalSize.value = t.dashSize + t.gapSize, e.scale.value = t.scale;
	}
	function c(e, t, r, i) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, e.size.value = t.size * r, e.scale.value = i * .5, t.map && (e.map.value = t.map, n(t.map, e.uvTransform)), t.alphaMap && (e.alphaMap.value = t.alphaMap, n(t.alphaMap, e.alphaMapTransform)), t.alphaTest > 0 && (e.alphaTest.value = t.alphaTest);
	}
	function l(e, t) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, e.rotation.value = t.rotation, t.map && (e.map.value = t.map, n(t.map, e.mapTransform)), t.alphaMap && (e.alphaMap.value = t.alphaMap, n(t.alphaMap, e.alphaMapTransform)), t.alphaTest > 0 && (e.alphaTest.value = t.alphaTest);
	}
	function u(e, t) {
		e.specular.value.copy(t.specular), e.shininess.value = Math.max(t.shininess, 1e-4);
	}
	function d(e, t) {
		t.gradientMap && (e.gradientMap.value = t.gradientMap);
	}
	function f(e, t) {
		e.metalness.value = t.metalness, t.metalnessMap && (e.metalnessMap.value = t.metalnessMap, n(t.metalnessMap, e.metalnessMapTransform)), e.roughness.value = t.roughness, t.roughnessMap && (e.roughnessMap.value = t.roughnessMap, n(t.roughnessMap, e.roughnessMapTransform)), t.envMap && (e.envMapIntensity.value = t.envMapIntensity);
	}
	function p(e, t, r) {
		e.ior.value = t.ior, t.sheen > 0 && (e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen), e.sheenRoughness.value = t.sheenRoughness, t.sheenColorMap && (e.sheenColorMap.value = t.sheenColorMap, n(t.sheenColorMap, e.sheenColorMapTransform)), t.sheenRoughnessMap && (e.sheenRoughnessMap.value = t.sheenRoughnessMap, n(t.sheenRoughnessMap, e.sheenRoughnessMapTransform))), t.clearcoat > 0 && (e.clearcoat.value = t.clearcoat, e.clearcoatRoughness.value = t.clearcoatRoughness, t.clearcoatMap && (e.clearcoatMap.value = t.clearcoatMap, n(t.clearcoatMap, e.clearcoatMapTransform)), t.clearcoatRoughnessMap && (e.clearcoatRoughnessMap.value = t.clearcoatRoughnessMap, n(t.clearcoatRoughnessMap, e.clearcoatRoughnessMapTransform)), t.clearcoatNormalMap && (e.clearcoatNormalMap.value = t.clearcoatNormalMap, n(t.clearcoatNormalMap, e.clearcoatNormalMapTransform), e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale), t.side === 1 && e.clearcoatNormalScale.value.negate())), t.dispersion > 0 && (e.dispersion.value = t.dispersion), t.iridescence > 0 && (e.iridescence.value = t.iridescence, e.iridescenceIOR.value = t.iridescenceIOR, e.iridescenceThicknessMinimum.value = t.iridescenceThicknessRange[0], e.iridescenceThicknessMaximum.value = t.iridescenceThicknessRange[1], t.iridescenceMap && (e.iridescenceMap.value = t.iridescenceMap, n(t.iridescenceMap, e.iridescenceMapTransform)), t.iridescenceThicknessMap && (e.iridescenceThicknessMap.value = t.iridescenceThicknessMap, n(t.iridescenceThicknessMap, e.iridescenceThicknessMapTransform))), t.transmission > 0 && (e.transmission.value = t.transmission, e.transmissionSamplerMap.value = r.texture, e.transmissionSamplerSize.value.set(r.width, r.height), t.transmissionMap && (e.transmissionMap.value = t.transmissionMap, n(t.transmissionMap, e.transmissionMapTransform)), e.thickness.value = t.thickness, t.thicknessMap && (e.thicknessMap.value = t.thicknessMap, n(t.thicknessMap, e.thicknessMapTransform)), e.attenuationDistance.value = t.attenuationDistance, e.attenuationColor.value.copy(t.attenuationColor)), t.anisotropy > 0 && (e.anisotropyVector.value.set(t.anisotropy * Math.cos(t.anisotropyRotation), t.anisotropy * Math.sin(t.anisotropyRotation)), t.anisotropyMap && (e.anisotropyMap.value = t.anisotropyMap, n(t.anisotropyMap, e.anisotropyMapTransform))), e.specularIntensity.value = t.specularIntensity, e.specularColor.value.copy(t.specularColor), t.specularColorMap && (e.specularColorMap.value = t.specularColorMap, n(t.specularColorMap, e.specularColorMapTransform)), t.specularIntensityMap && (e.specularIntensityMap.value = t.specularIntensityMap, n(t.specularIntensityMap, e.specularIntensityMapTransform));
	}
	function m(e, t) {
		t.matcap && (e.matcap.value = t.matcap);
	}
	function h(e, n) {
		let r = t.get(n).light;
		e.referencePosition.value.setFromMatrixPosition(r.matrixWorld), e.nearDistance.value = r.shadow.camera.near, e.farDistance.value = r.shadow.camera.far;
	}
	return {
		refreshFogUniforms: r,
		refreshMaterialUniforms: i
	};
}
function Nu(e, t, n, r) {
	let i = {}, a = {}, o = [], s = e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);
	function c(e, t) {
		let n = t.program;
		r.uniformBlockBinding(e, n);
	}
	function l(e, n) {
		let o = i[e.id];
		o === void 0 && (g(e), o = u(e), i[e.id] = o, e.addEventListener("dispose", v));
		let s = n.program;
		r.updateUBOMapping(e, s);
		let c = t.render.frame;
		a[e.id] !== c && (f(e), a[e.id] = c);
	}
	function u(t) {
		let n = d();
		t.__bindingPointIndex = n;
		let r = e.createBuffer(), i = t.__size, a = t.usage;
		return e.bindBuffer(e.UNIFORM_BUFFER, r), e.bufferData(e.UNIFORM_BUFFER, i, a), e.bindBuffer(e.UNIFORM_BUFFER, null), e.bindBufferBase(e.UNIFORM_BUFFER, n, r), r;
	}
	function d() {
		for (let e = 0; e < s; e++) if (o.indexOf(e) === -1) return o.push(e), e;
		return V("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."), 0;
	}
	function f(t) {
		let n = i[t.id], r = t.uniforms, a = t.__cache;
		e.bindBuffer(e.UNIFORM_BUFFER, n);
		for (let e = 0, t = r.length; e < t; e++) {
			let t = r[e];
			if (Array.isArray(t)) for (let n = 0, r = t.length; n < r; n++) p(t[n], e, n, a);
			else p(t, e, 0, a);
		}
		e.bindBuffer(e.UNIFORM_BUFFER, null);
	}
	function p(t, n, r, i) {
		if (h(t, n, r, i) === !0) {
			let n = t.__offset, r = t.value;
			if (Array.isArray(r)) {
				let e = 0;
				for (let n = 0; n < r.length; n++) {
					let i = r[n], a = _(i);
					m(i, t.__data, e), typeof i != "number" && typeof i != "boolean" && !i.isMatrix3 && !ArrayBuffer.isView(i) && (e += a.storage / Float32Array.BYTES_PER_ELEMENT);
				}
			} else m(r, t.__data, 0);
			e.bufferSubData(e.UNIFORM_BUFFER, n, t.__data);
		}
	}
	function m(e, t, n) {
		typeof e == "number" || typeof e == "boolean" ? t[0] = e : e.isMatrix3 ? (t[0] = e.elements[0], t[1] = e.elements[1], t[2] = e.elements[2], t[3] = 0, t[4] = e.elements[3], t[5] = e.elements[4], t[6] = e.elements[5], t[7] = 0, t[8] = e.elements[6], t[9] = e.elements[7], t[10] = e.elements[8], t[11] = 0) : ArrayBuffer.isView(e) ? t.set(new e.constructor(e.buffer, e.byteOffset, t.length)) : e.toArray(t, n);
	}
	function h(e, t, n, r) {
		let i = e.value, a = t + "_" + n;
		if (r[a] === void 0) return typeof i == "number" || typeof i == "boolean" ? r[a] = i : ArrayBuffer.isView(i) ? r[a] = i.slice() : r[a] = i.clone(), !0;
		{
			let e = r[a];
			if (typeof i == "number" || typeof i == "boolean") {
				if (e !== i) return r[a] = i, !0;
			} else if (ArrayBuffer.isView(i)) return !0;
			else if (e.equals(i) === !1) return e.copy(i), !0;
		}
		return !1;
	}
	function g(e) {
		let t = e.uniforms, n = 0;
		for (let e = 0, r = t.length; e < r; e++) {
			let r = Array.isArray(t[e]) ? t[e] : [t[e]];
			for (let e = 0, t = r.length; e < t; e++) {
				let t = r[e], i = Array.isArray(t.value) ? t.value : [t.value];
				for (let e = 0, r = i.length; e < r; e++) {
					let r = i[e], a = _(r), o = n % 16, s = o % a.boundary, c = o + s;
					n += s, c !== 0 && 16 - c < a.storage && (n += 16 - c), t.__data = new Float32Array(a.storage / Float32Array.BYTES_PER_ELEMENT), t.__offset = n, n += a.storage;
				}
			}
		}
		let r = n % 16;
		return r > 0 && (n += 16 - r), e.__size = n, e.__cache = {}, this;
	}
	function _(e) {
		let t = {
			boundary: 0,
			storage: 0
		};
		return typeof e == "number" || typeof e == "boolean" ? (t.boundary = 4, t.storage = 4) : e.isVector2 ? (t.boundary = 8, t.storage = 8) : e.isVector3 || e.isColor ? (t.boundary = 16, t.storage = 12) : e.isVector4 ? (t.boundary = 16, t.storage = 16) : e.isMatrix3 ? (t.boundary = 48, t.storage = 48) : e.isMatrix4 ? (t.boundary = 64, t.storage = 64) : e.isTexture ? B("WebGLRenderer: Texture samplers can not be part of an uniforms group.") : ArrayBuffer.isView(e) ? (t.boundary = 16, t.storage = e.byteLength) : B("WebGLRenderer: Unsupported uniform value type.", e), t;
	}
	function v(t) {
		let n = t.target;
		n.removeEventListener("dispose", v);
		let r = o.indexOf(n.__bindingPointIndex);
		o.splice(r, 1), e.deleteBuffer(i[n.id]), delete i[n.id], delete a[n.id];
	}
	function y() {
		for (let t in i) e.deleteBuffer(i[t]);
		o = [], i = {}, a = {};
	}
	return {
		bind: c,
		update: l,
		dispose: y
	};
}
var Pu = new Uint16Array([
	12469,
	15057,
	12620,
	14925,
	13266,
	14620,
	13807,
	14376,
	14323,
	13990,
	14545,
	13625,
	14713,
	13328,
	14840,
	12882,
	14931,
	12528,
	14996,
	12233,
	15039,
	11829,
	15066,
	11525,
	15080,
	11295,
	15085,
	10976,
	15082,
	10705,
	15073,
	10495,
	13880,
	14564,
	13898,
	14542,
	13977,
	14430,
	14158,
	14124,
	14393,
	13732,
	14556,
	13410,
	14702,
	12996,
	14814,
	12596,
	14891,
	12291,
	14937,
	11834,
	14957,
	11489,
	14958,
	11194,
	14943,
	10803,
	14921,
	10506,
	14893,
	10278,
	14858,
	9960,
	14484,
	14039,
	14487,
	14025,
	14499,
	13941,
	14524,
	13740,
	14574,
	13468,
	14654,
	13106,
	14743,
	12678,
	14818,
	12344,
	14867,
	11893,
	14889,
	11509,
	14893,
	11180,
	14881,
	10751,
	14852,
	10428,
	14812,
	10128,
	14765,
	9754,
	14712,
	9466,
	14764,
	13480,
	14764,
	13475,
	14766,
	13440,
	14766,
	13347,
	14769,
	13070,
	14786,
	12713,
	14816,
	12387,
	14844,
	11957,
	14860,
	11549,
	14868,
	11215,
	14855,
	10751,
	14825,
	10403,
	14782,
	10044,
	14729,
	9651,
	14666,
	9352,
	14599,
	9029,
	14967,
	12835,
	14966,
	12831,
	14963,
	12804,
	14954,
	12723,
	14936,
	12564,
	14917,
	12347,
	14900,
	11958,
	14886,
	11569,
	14878,
	11247,
	14859,
	10765,
	14828,
	10401,
	14784,
	10011,
	14727,
	9600,
	14660,
	9289,
	14586,
	8893,
	14508,
	8533,
	15111,
	12234,
	15110,
	12234,
	15104,
	12216,
	15092,
	12156,
	15067,
	12010,
	15028,
	11776,
	14981,
	11500,
	14942,
	11205,
	14902,
	10752,
	14861,
	10393,
	14812,
	9991,
	14752,
	9570,
	14682,
	9252,
	14603,
	8808,
	14519,
	8445,
	14431,
	8145,
	15209,
	11449,
	15208,
	11451,
	15202,
	11451,
	15190,
	11438,
	15163,
	11384,
	15117,
	11274,
	15055,
	10979,
	14994,
	10648,
	14932,
	10343,
	14871,
	9936,
	14803,
	9532,
	14729,
	9218,
	14645,
	8742,
	14556,
	8381,
	14461,
	8020,
	14365,
	7603,
	15273,
	10603,
	15272,
	10607,
	15267,
	10619,
	15256,
	10631,
	15231,
	10614,
	15182,
	10535,
	15118,
	10389,
	15042,
	10167,
	14963,
	9787,
	14883,
	9447,
	14800,
	9115,
	14710,
	8665,
	14615,
	8318,
	14514,
	7911,
	14411,
	7507,
	14279,
	7198,
	15314,
	9675,
	15313,
	9683,
	15309,
	9712,
	15298,
	9759,
	15277,
	9797,
	15229,
	9773,
	15166,
	9668,
	15084,
	9487,
	14995,
	9274,
	14898,
	8910,
	14800,
	8539,
	14697,
	8234,
	14590,
	7790,
	14479,
	7409,
	14367,
	7067,
	14178,
	6621,
	15337,
	8619,
	15337,
	8631,
	15333,
	8677,
	15325,
	8769,
	15305,
	8871,
	15264,
	8940,
	15202,
	8909,
	15119,
	8775,
	15022,
	8565,
	14916,
	8328,
	14804,
	8009,
	14688,
	7614,
	14569,
	7287,
	14448,
	6888,
	14321,
	6483,
	14088,
	6171,
	15350,
	7402,
	15350,
	7419,
	15347,
	7480,
	15340,
	7613,
	15322,
	7804,
	15287,
	7973,
	15229,
	8057,
	15148,
	8012,
	15046,
	7846,
	14933,
	7611,
	14810,
	7357,
	14682,
	7069,
	14552,
	6656,
	14421,
	6316,
	14251,
	5948,
	14007,
	5528,
	15356,
	5942,
	15356,
	5977,
	15353,
	6119,
	15348,
	6294,
	15332,
	6551,
	15302,
	6824,
	15249,
	7044,
	15171,
	7122,
	15070,
	7050,
	14949,
	6861,
	14818,
	6611,
	14679,
	6349,
	14538,
	6067,
	14398,
	5651,
	14189,
	5311,
	13935,
	4958,
	15359,
	4123,
	15359,
	4153,
	15356,
	4296,
	15353,
	4646,
	15338,
	5160,
	15311,
	5508,
	15263,
	5829,
	15188,
	6042,
	15088,
	6094,
	14966,
	6001,
	14826,
	5796,
	14678,
	5543,
	14527,
	5287,
	14377,
	4985,
	14133,
	4586,
	13869,
	4257,
	15360,
	1563,
	15360,
	1642,
	15358,
	2076,
	15354,
	2636,
	15341,
	3350,
	15317,
	4019,
	15273,
	4429,
	15203,
	4732,
	15105,
	4911,
	14981,
	4932,
	14836,
	4818,
	14679,
	4621,
	14517,
	4386,
	14359,
	4156,
	14083,
	3795,
	13808,
	3437,
	15360,
	122,
	15360,
	137,
	15358,
	285,
	15355,
	636,
	15344,
	1274,
	15322,
	2177,
	15281,
	2765,
	15215,
	3223,
	15120,
	3451,
	14995,
	3569,
	14846,
	3567,
	14681,
	3466,
	14511,
	3305,
	14344,
	3121,
	14037,
	2800,
	13753,
	2467,
	15360,
	0,
	15360,
	1,
	15359,
	21,
	15355,
	89,
	15346,
	253,
	15325,
	479,
	15287,
	796,
	15225,
	1148,
	15133,
	1492,
	15008,
	1749,
	14856,
	1882,
	14685,
	1886,
	14506,
	1783,
	14324,
	1608,
	13996,
	1398,
	13702,
	1183
]), Fu = null;
function Iu() {
	return Fu === null && (Fu = new _a(Pu, 16, 16, ft, $e), Fu.name = "DFG_LUT", Fu.minFilter = Ue, Fu.magFilter = Ue, Fu.wrapS = Re, Fu.wrapT = Re, Fu.generateMipmaps = !1, Fu.needsUpdate = !0), Fu;
}
var Lu = class {
	constructor(e = {}) {
		let { canvas: t = gn(), context: n = null, depth: r = !0, stencil: i = !1, alpha: a = !1, antialias: o = !1, premultipliedAlpha: s = !0, preserveDrawingBuffer: c = !1, powerPreference: l = "default", failIfMajorPerformanceCaveat: u = !1, reversedDepthBuffer: d = !1, outputBufferType: f = Ke } = e;
		this.isWebGLRenderer = !0;
		let p;
		if (n !== null) {
			if (typeof WebGLRenderingContext < "u" && n instanceof WebGLRenderingContext) throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");
			p = n.getContextAttributes().alpha;
		} else p = a;
		let m = f, h = /* @__PURE__ */ new Set([
			mt,
			pt,
			dt
		]), g = /* @__PURE__ */ new Set([
			Ke,
			Ze,
			Ye,
			nt,
			et,
			tt
		]), _ = /* @__PURE__ */ new Uint32Array(4), v = /* @__PURE__ */ new Int32Array(4), y = new W(), b = null, x = null, S = [], C = [], w = null;
		this.domElement = t, this.debug = {
			checkShaderErrors: !0,
			onShaderError: null
		}, this.autoClear = !0, this.autoClearColor = !0, this.autoClearDepth = !0, this.autoClearStencil = !0, this.sortObjects = !0, this.clippingPlanes = [], this.localClippingEnabled = !1, this.toneMapping = 0, this.toneMappingExposure = 1, this.transmissionResolutionScale = 1;
		let T = this, E = !1, D = null, O = null, k = null, A = null;
		this._outputColorSpace = on;
		let j = 0, ee = 0, M = null, N = -1, te = null, P = new pr(), ne = new pr(), re = null, ie = new J(0), ae = 0, oe = t.width, se = t.height, F = 1, ce = null, le = null, ue = new pr(0, 0, oe, se), de = new pr(0, 0, oe, se), fe = !1, pe = new Pa(), me = !1, he = !1, ge = new q(), _e = new W(), ve = new pr(), ye = {
			background: null,
			fog: null,
			environment: null,
			overrideMaterial: null,
			isScene: !0
		}, be = !1;
		function xe() {
			return M === null ? F : 1;
		}
		let I = n;
		function Se(e, n) {
			return t.getContext(e, n);
		}
		try {
			let e = {
				alpha: !0,
				depth: r,
				stencil: i,
				antialias: o,
				premultipliedAlpha: s,
				preserveDrawingBuffer: c,
				powerPreference: l,
				failIfMajorPerformanceCaveat: u
			};
			if ("setAttribute" in t && t.setAttribute("data-engine", "three.js r185"), t.addEventListener("webglcontextlost", qe, !1), t.addEventListener("webglcontextrestored", Je, !1), t.addEventListener("webglcontextcreationerror", Xe, !1), I === null) {
				let t = "webgl2";
				if (I = Se(t, e), I === null) throw Se(t) ? Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.") : Error("THREE.WebGLRenderer: Error creating WebGL context.");
			}
		} catch (e) {
			throw V("WebGLRenderer: " + e.message), e;
		}
		let Ce, we, L, Te, R, z, Ee, De, Oe, ke, Ae, je, Me, Ne, Pe, Fe, Ie, Le, Re, ze, Be, Ve, He;
		function Ue() {
			Ce = new tc(I), Ce.init(), Be = new Tu(I, Ce), we = new js(I, Ce, e, Be), L = new Cu(I, Ce), we.reversedDepthBuffer && d && L.buffers.depth.setReversed(!0), O = I.createFramebuffer(), k = I.createFramebuffer(), A = I.createFramebuffer(), Te = new ic(I), R = new ru(), z = new wu(I, Ce, L, R, we, Be, Te), Ee = new ec(T), De = new Cs(I), Ve = new ks(I, De), Oe = new nc(I, De, Te, Ve), ke = new oc(I, Oe, De, Ve, Te), Le = new ac(I, we, z), Pe = new Ms(R), Ae = new nu(T, Ee, Ce, we, Ve, Pe), je = new Mu(T, R), Me = new su(), Ne = new mu(Ce), Ie = new Os(T, Ee, L, ke, p, s), Fe = new Su(T, ke, we), He = new Nu(I, Te, we, L), Re = new As(I, Ce, Te), ze = new rc(I, Ce, Te), Te.programs = Ae.programs, T.capabilities = we, T.extensions = Ce, T.properties = R, T.renderLists = Me, T.shadowMap = Fe, T.state = L, T.info = Te;
		}
		Ue(), m !== 1009 && (w = new cc(m, t.width, t.height, o, r, i));
		let We = new ku(T, I);
		this.xr = We, this.getContext = function() {
			return I;
		}, this.getContextAttributes = function() {
			return I.getContextAttributes();
		}, this.forceContextLoss = function() {
			let e = Ce.get("WEBGL_lose_context");
			e && e.loseContext();
		}, this.forceContextRestore = function() {
			let e = Ce.get("WEBGL_lose_context");
			e && e.restoreContext();
		}, this.getPixelRatio = function() {
			return F;
		}, this.setPixelRatio = function(e) {
			e !== void 0 && (F = e, this.setSize(oe, se, !1));
		}, this.getSize = function(e) {
			return e.set(oe, se);
		}, this.setSize = function(e, n, r = !0) {
			if (We.isPresenting) {
				B("WebGLRenderer: Can't change size while VR device is presenting.");
				return;
			}
			oe = e, se = n, t.width = Math.floor(e * F), t.height = Math.floor(n * F), r === !0 && (t.style.width = e + "px", t.style.height = n + "px"), w !== null && w.setSize(t.width, t.height), this.setViewport(0, 0, e, n);
		}, this.getDrawingBufferSize = function(e) {
			return e.set(oe * F, se * F).floor();
		}, this.setDrawingBufferSize = function(e, n, r) {
			oe = e, se = n, F = r, t.width = Math.floor(e * r), t.height = Math.floor(n * r), this.setViewport(0, 0, e, n);
		}, this.setEffects = function(e) {
			if (m === 1009) {
				V("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");
				return;
			}
			if (e) {
				for (let t = 0; t < e.length; t++) if (e[t].isOutputPass === !0) {
					B("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");
					break;
				}
			}
			w.setEffects(e || []);
		}, this.getCurrentViewport = function(e) {
			return e.copy(P);
		}, this.getViewport = function(e) {
			return e.copy(ue);
		}, this.setViewport = function(e, t, n, r) {
			e.isVector4 ? ue.set(e.x, e.y, e.z, e.w) : ue.set(e, t, n, r), L.viewport(P.copy(ue).multiplyScalar(F).round());
		}, this.getScissor = function(e) {
			return e.copy(de);
		}, this.setScissor = function(e, t, n, r) {
			e.isVector4 ? de.set(e.x, e.y, e.z, e.w) : de.set(e, t, n, r), L.scissor(ne.copy(de).multiplyScalar(F).round());
		}, this.getScissorTest = function() {
			return fe;
		}, this.setScissorTest = function(e) {
			L.setScissorTest(fe = e);
		}, this.setOpaqueSort = function(e) {
			ce = e;
		}, this.setTransparentSort = function(e) {
			le = e;
		}, this.getClearColor = function(e) {
			return e.copy(Ie.getClearColor());
		}, this.setClearColor = function() {
			Ie.setClearColor(...arguments);
		}, this.getClearAlpha = function() {
			return Ie.getClearAlpha();
		}, this.setClearAlpha = function() {
			Ie.setClearAlpha(...arguments);
		}, this.clear = function(e = !0, t = !0, n = !0) {
			let r = 0;
			if (e) {
				let e = !1;
				if (M !== null) {
					let t = M.texture.format;
					e = h.has(t);
				}
				if (e) {
					let e = M.texture.type, t = g.has(e), n = Ie.getClearColor(), r = Ie.getClearAlpha(), i = n.r, a = n.g, o = n.b;
					t ? (_[0] = i, _[1] = a, _[2] = o, _[3] = r, I.clearBufferuiv(I.COLOR, 0, _)) : (v[0] = i, v[1] = a, v[2] = o, v[3] = r, I.clearBufferiv(I.COLOR, 0, v));
				} else r |= I.COLOR_BUFFER_BIT;
			}
			t && (r |= I.DEPTH_BUFFER_BIT, this.state.buffers.depth.setMask(!0)), n && (r |= I.STENCIL_BUFFER_BIT, this.state.buffers.stencil.setMask(4294967295)), r !== 0 && I.clear(r);
		}, this.clearColor = function() {
			this.clear(!0, !1, !1);
		}, this.clearDepth = function() {
			this.clear(!1, !0, !1);
		}, this.clearStencil = function() {
			this.clear(!1, !1, !0);
		}, this.setNodesHandler = function(e) {
			e.setRenderer(this), D = e;
		}, this.dispose = function() {
			t.removeEventListener("webglcontextlost", qe, !1), t.removeEventListener("webglcontextrestored", Je, !1), t.removeEventListener("webglcontextcreationerror", Xe, !1), Ie.dispose(), Me.dispose(), Ne.dispose(), R.dispose(), Ee.dispose(), ke.dispose(), Ve.dispose(), He.dispose(), Ae.dispose(), We.dispose(), We.removeEventListener("sessionstart", ct), We.removeEventListener("sessionend", lt), ut.stop();
		};
		function qe(e) {
			e.preventDefault(), vn("WebGLRenderer: Context Lost."), E = !0;
		}
		function Je() {
			vn("WebGLRenderer: Context Restored."), E = !1;
			let e = Te.autoReset, t = Fe.enabled, n = Fe.autoUpdate, r = Fe.needsUpdate, i = Fe.type;
			Ue(), Te.autoReset = e, Fe.enabled = t, Fe.autoUpdate = n, Fe.needsUpdate = r, Fe.type = i;
		}
		function Xe(e) {
			V("WebGLRenderer: A WebGL context could not be created. Reason: ", e.statusMessage);
		}
		function Qe(e) {
			let t = e.target;
			t.removeEventListener("dispose", Qe), rt(t);
		}
		function rt(e) {
			it(e), R.remove(e);
		}
		function it(e) {
			let t = R.get(e).programs;
			t !== void 0 && (t.forEach(function(e) {
				Ae.releaseProgram(e);
			}), e.isShaderMaterial && Ae.releaseShaderCache(e));
		}
		this.renderBufferDirect = function(e, t, n, r, i, a) {
			t === null && (t = ye);
			let o = i.isMesh && i.matrixWorld.determinantAffine() < 0, s = Ct(e, t, n, r, i);
			L.setMaterial(r, o);
			let c = n.index, l = 1;
			if (r.wireframe === !0) {
				if (c = Oe.getWireframeAttribute(n), c === void 0) return;
				l = 2;
			}
			let u = n.drawRange, d = n.attributes.position, f = u.start * l, p = (u.start + u.count) * l;
			a !== null && (f = Math.max(f, a.start * l), p = Math.min(p, (a.start + a.count) * l)), c === null ? d != null && (f = Math.max(f, 0), p = Math.min(p, d.count)) : (f = Math.max(f, 0), p = Math.min(p, c.count));
			let m = p - f;
			if (m < 0 || m === Infinity) return;
			Ve.setup(i, r, s, n, c);
			let h, g = Re;
			if (c !== null && (h = De.get(c), g = ze, g.setIndex(h)), i.isMesh) r.wireframe === !0 ? (L.setLineWidth(r.wireframeLinewidth * xe()), g.setMode(I.LINES)) : g.setMode(I.TRIANGLES);
			else if (i.isLine) {
				let e = r.linewidth;
				e === void 0 && (e = 1), L.setLineWidth(e * xe()), i.isLineSegments ? g.setMode(I.LINES) : i.isLineLoop ? g.setMode(I.LINE_LOOP) : g.setMode(I.LINE_STRIP);
			} else i.isPoints ? g.setMode(I.POINTS) : i.isSprite && g.setMode(I.TRIANGLES);
			if (i.isBatchedMesh) if (Ce.get("WEBGL_multi_draw")) g.renderMultiDraw(i._multiDrawStarts, i._multiDrawCounts, i._multiDrawCount);
			else {
				let e = i._multiDrawStarts, t = i._multiDrawCounts, n = i._multiDrawCount, a = c ? De.get(c).bytesPerElement : 1, o = R.get(r).currentProgram.getUniforms();
				for (let r = 0; r < n; r++) o.setValue(I, "_gl_DrawID", r), g.render(e[r] / a, t[r]);
			}
			else if (i.isInstancedMesh) g.renderInstances(f, m, i.count);
			else if (n.isInstancedBufferGeometry) {
				let e = n._maxInstanceCount === void 0 ? Infinity : n._maxInstanceCount, t = Math.min(n.instanceCount, e);
				g.renderInstances(f, m, t);
			} else g.render(f, m);
		};
		function at(e, t, n) {
			e.transparent === !0 && e.side === 2 && e.forceSinglePass === !1 ? (e.side = 1, e.needsUpdate = !0, yt(e, t, n), e.side = 0, e.needsUpdate = !0, yt(e, t, n), e.side = 2) : yt(e, t, n);
		}
		this.compile = function(e, t, n = null) {
			n === null && (n = e), x = Ne.get(n), x.init(t), C.push(x), n.traverseVisible(function(e) {
				e.isLight && e.layers.test(t.layers) && (x.pushLight(e), e.castShadow && x.pushShadow(e));
			}), e !== n && e.traverseVisible(function(e) {
				e.isLight && e.layers.test(t.layers) && (x.pushLight(e), e.castShadow && x.pushShadow(e));
			}), x.setupLights();
			let r = /* @__PURE__ */ new Set();
			return e.traverse(function(e) {
				if (!(e.isMesh || e.isPoints || e.isLine || e.isSprite)) return;
				let t = e.material;
				if (t) if (Array.isArray(t)) for (let i = 0; i < t.length; i++) {
					let a = t[i];
					at(a, n, e), r.add(a);
				}
				else at(t, n, e), r.add(t);
			}), x = C.pop(), r;
		}, this.compileAsync = function(e, t, n = null) {
			let r = this.compile(e, t, n);
			return new Promise((t) => {
				function n() {
					if (r.forEach(function(e) {
						R.get(e).currentProgram.isReady() && r.delete(e);
					}), r.size === 0) {
						t(e);
						return;
					}
					setTimeout(n, 10);
				}
				Ce.get("KHR_parallel_shader_compile") === null ? setTimeout(n, 10) : n();
			});
		};
		let ot = null;
		function st(e) {
			ot && ot(e);
		}
		function ct() {
			ut.stop();
		}
		function lt() {
			ut.start();
		}
		let ut = new Ss();
		ut.setAnimationLoop(st), typeof self < "u" && ut.setContext(self), this.setAnimationLoop = function(e) {
			ot = e, We.setAnimationLoop(e), e === null ? ut.stop() : ut.start();
		}, We.addEventListener("sessionstart", ct), We.addEventListener("sessionend", lt), this.render = function(e, t) {
			if (t !== void 0 && t.isCamera !== !0) {
				V("WebGLRenderer.render: camera is not an instance of THREE.Camera.");
				return;
			}
			if (E === !0) return;
			D !== null && D.renderStart(e, t);
			let n = We.enabled === !0 && We.isPresenting === !0, r = w !== null && (M === null || n) && w.begin(T, M);
			if (e.matrixWorldAutoUpdate === !0 && e.updateMatrixWorld(), t.parent === null && t.matrixWorldAutoUpdate === !0 && t.updateMatrixWorld(), We.enabled === !0 && We.isPresenting === !0 && (w === null || w.isCompositing() === !1) && (We.cameraAutoUpdate === !0 && We.updateCamera(t), t = We.getCamera()), e.isScene === !0 && e.onBeforeRender(T, e, t, M), x = Ne.get(e, C.length), x.init(t), x.state.textureUnits = z.getTextureUnits(), C.push(x), ge.multiplyMatrices(t.projectionMatrix, t.matrixWorldInverse), pe.setFromProjectionMatrix(ge, fn, t.reversedDepth), he = this.localClippingEnabled, me = Pe.init(this.clippingPlanes, he), b = Me.get(e, S.length), b.init(), S.push(b), We.enabled === !0 && We.isPresenting === !0) {
				let e = T.xr.getDepthSensingMesh();
				e !== null && ft(e, t, -Infinity, T.sortObjects);
			}
			ft(e, t, 0, T.sortObjects), b.finish(), T.sortObjects === !0 && b.sort(ce, le, t.reversedDepth), be = We.enabled === !1 || We.isPresenting === !1 || We.hasDepthSensing() === !1, be && Ie.addToRenderList(b, e), this.info.render.frame++, this.info.autoReset === !0 && this.info.reset(), me === !0 && Pe.beginShadows();
			let i = x.state.shadowsArray;
			if (Fe.render(i, e, t), me === !0 && Pe.endShadows(), (r && w.hasRenderPass()) === !1) {
				let n = b.opaque, r = b.transmissive;
				if (x.setupLights(), t.isArrayCamera) {
					let i = t.cameras;
					if (r.length > 0) for (let t = 0, a = i.length; t < a; t++) {
						let a = i[t];
						gt(n, r, e, a);
					}
					be && Ie.render(e);
					for (let t = 0, n = i.length; t < n; t++) {
						let n = i[t];
						ht(b, e, n, n.viewport);
					}
				} else r.length > 0 && gt(n, r, e, t), be && Ie.render(e), ht(b, e, t);
			}
			M !== null && ee === 0 && (z.updateMultisampleRenderTarget(M), z.updateRenderTargetMipmap(M)), r && w.end(T), e.isScene === !0 && e.onAfterRender(T, e, t), Ve.resetDefaultState(), N = -1, te = null, C.pop(), C.length > 0 ? (x = C[C.length - 1], z.setTextureUnits(x.state.textureUnits), me === !0 && Pe.setGlobalState(T.clippingPlanes, x.state.camera)) : x = null, S.pop(), b = S.length > 0 ? S[S.length - 1] : null, D !== null && D.renderEnd();
		};
		function ft(e, t, n, r) {
			if (e.visible === !1) return;
			if (e.layers.test(t.layers)) {
				if (e.isGroup) n = e.renderOrder;
				else if (e.isLOD) e.autoUpdate === !0 && e.update(t);
				else if (e.isLightProbeGrid) x.pushLightProbeGrid(e);
				else if (e.isLight) x.pushLight(e), e.castShadow && x.pushShadow(e);
				else if (e.isSprite) {
					if (!e.frustumCulled || pe.intersectsSprite(e)) {
						r && ve.setFromMatrixPosition(e.matrixWorld).applyMatrix4(ge);
						let t = ke.update(e), i = e.material;
						i.visible && b.push(e, t, i, n, ve.z, null);
					}
				} else if ((e.isMesh || e.isLine || e.isPoints) && (!e.frustumCulled || pe.intersectsObject(e))) {
					let t = ke.update(e), i = e.material;
					if (r && (e.boundingSphere === void 0 ? (t.boundingSphere === null && t.computeBoundingSphere(), ve.copy(t.boundingSphere.center)) : (e.boundingSphere === null && e.computeBoundingSphere(), ve.copy(e.boundingSphere.center)), ve.applyMatrix4(e.matrixWorld).applyMatrix4(ge)), Array.isArray(i)) {
						let r = t.groups;
						for (let a = 0, o = r.length; a < o; a++) {
							let o = r[a], s = i[o.materialIndex];
							s && s.visible && b.push(e, t, s, n, ve.z, o);
						}
					} else i.visible && b.push(e, t, i, n, ve.z, null);
				}
			}
			let i = e.children;
			for (let e = 0, a = i.length; e < a; e++) ft(i[e], t, n, r);
		}
		function ht(e, t, n, r) {
			let { opaque: i, transmissive: a, transparent: o } = e;
			x.setupLightsView(n), me === !0 && Pe.setGlobalState(T.clippingPlanes, n), r && L.viewport(P.copy(r)), i.length > 0 && _t(i, t, n), a.length > 0 && _t(a, t, n), o.length > 0 && _t(o, t, n), L.buffers.depth.setTest(!0), L.buffers.depth.setMask(!0), L.buffers.color.setMask(!0), L.setPolygonOffset(!1);
		}
		function gt(e, t, n, r) {
			if ((n.isScene === !0 ? n.overrideMaterial : null) !== null) return;
			if (x.state.transmissionRenderTarget[r.id] === void 0) {
				let e = Ce.has("EXT_color_buffer_half_float") || Ce.has("EXT_color_buffer_float");
				x.state.transmissionRenderTarget[r.id] = new hr(1, 1, {
					generateMipmaps: !0,
					type: e ? $e : Ke,
					minFilter: Ge,
					samples: Math.max(4, we.samples),
					stencilBuffer: i,
					resolveDepthBuffer: !1,
					resolveStencilBuffer: !1,
					colorSpace: K.workingColorSpace
				});
			}
			let a = x.state.transmissionRenderTarget[r.id], o = r.viewport || P;
			a.setSize(o.z * T.transmissionResolutionScale, o.w * T.transmissionResolutionScale);
			let s = T.getRenderTarget(), c = T.getActiveCubeFace(), l = T.getActiveMipmapLevel();
			T.setRenderTarget(a), T.getClearColor(ie), ae = T.getClearAlpha(), ae < 1 && T.setClearColor(16777215, .5), T.clear(), be && Ie.render(n);
			let u = T.toneMapping;
			T.toneMapping = 0;
			let d = r.viewport;
			if (r.viewport !== void 0 && (r.viewport = void 0), x.setupLightsView(r), me === !0 && Pe.setGlobalState(T.clippingPlanes, r), _t(e, n, r), z.updateMultisampleRenderTarget(a), z.updateRenderTargetMipmap(a), Ce.has("WEBGL_multisampled_render_to_texture") === !1) {
				let e = !1;
				for (let i = 0, a = t.length; i < a; i++) {
					let { object: a, geometry: o, material: s, group: c } = t[i];
					if (s.side === 2 && a.layers.test(r.layers)) {
						let t = s.side;
						s.side = 1, s.needsUpdate = !0, vt(a, n, r, o, s, c), s.side = t, s.needsUpdate = !0, e = !0;
					}
				}
				e === !0 && (z.updateMultisampleRenderTarget(a), z.updateRenderTargetMipmap(a));
			}
			T.setRenderTarget(s, c, l), T.setClearColor(ie, ae), d !== void 0 && (r.viewport = d), T.toneMapping = u;
		}
		function _t(e, t, n) {
			let r = t.isScene === !0 ? t.overrideMaterial : null;
			for (let i = 0, a = e.length; i < a; i++) {
				let a = e[i], { object: o, geometry: s, group: c } = a, l = a.material;
				l.allowOverride === !0 && r !== null && (l = r), o.layers.test(n.layers) && vt(o, t, n, s, l, c);
			}
		}
		function vt(e, t, n, r, i, a) {
			e.onBeforeRender(T, t, n, r, i, a), e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse, e.matrixWorld), e.normalMatrix.getNormalMatrix(e.modelViewMatrix), i.onBeforeRender(T, t, n, r, e, a), i.transparent === !0 && i.side === 2 && i.forceSinglePass === !1 ? (i.side = 1, i.needsUpdate = !0, T.renderBufferDirect(n, t, r, i, e, a), i.side = 0, i.needsUpdate = !0, T.renderBufferDirect(n, t, r, i, e, a), i.side = 2) : T.renderBufferDirect(n, t, r, i, e, a), e.onAfterRender(T, t, n, r, i, a);
		}
		function yt(e, t, n) {
			t.isScene !== !0 && (t = ye);
			let r = R.get(e), i = x.state.lights, a = x.state.shadowsArray, o = i.state.version, s = Ae.getParameters(e, i.state, a, t, n, x.state.lightProbeGridArray), c = Ae.getProgramCacheKey(s), l = r.programs;
			r.environment = e.isMeshStandardMaterial || e.isMeshLambertMaterial || e.isMeshPhongMaterial ? t.environment : null, r.fog = t.fog;
			let u = e.isMeshStandardMaterial || e.isMeshLambertMaterial && !e.envMap || e.isMeshPhongMaterial && !e.envMap;
			r.envMap = Ee.get(e.envMap || r.environment, u), r.envMapRotation = r.environment !== null && e.envMap === null ? t.environmentRotation : e.envMapRotation, l === void 0 && (e.addEventListener("dispose", Qe), l = /* @__PURE__ */ new Map(), r.programs = l);
			let d = l.get(c);
			if (d !== void 0) {
				if (r.currentProgram === d && r.lightsStateVersion === o) return xt(e, s), d;
			} else s.uniforms = Ae.getUniforms(e), D !== null && e.isNodeMaterial && D.build(e, n, s), e.onBeforeCompile(s, T), d = Ae.acquireProgram(s, c), l.set(c, d), r.uniforms = s.uniforms;
			let f = r.uniforms;
			return (!e.isShaderMaterial && !e.isRawShaderMaterial || e.clipping === !0) && (f.clippingPlanes = Pe.uniform), xt(e, s), r.needsLights = Tt(e), r.lightsStateVersion = o, r.needsLights && (f.ambientLightColor.value = i.state.ambient, f.lightProbe.value = i.state.probe, f.directionalLights.value = i.state.directional, f.directionalLightShadows.value = i.state.directionalShadow, f.spotLights.value = i.state.spot, f.spotLightShadows.value = i.state.spotShadow, f.rectAreaLights.value = i.state.rectArea, f.ltc_1.value = i.state.rectAreaLTC1, f.ltc_2.value = i.state.rectAreaLTC2, f.pointLights.value = i.state.point, f.pointLightShadows.value = i.state.pointShadow, f.hemisphereLights.value = i.state.hemi, f.directionalShadowMatrix.value = i.state.directionalShadowMatrix, f.spotLightMatrix.value = i.state.spotLightMatrix, f.spotLightMap.value = i.state.spotLightMap, f.pointShadowMatrix.value = i.state.pointShadowMatrix), r.lightProbeGrid = x.state.lightProbeGridArray.length > 0, r.currentProgram = d, r.uniformsList = null, d;
		}
		function bt(e) {
			if (e.uniformsList === null) {
				let t = e.currentProgram.getUniforms();
				e.uniformsList = hl.seqWithValue(t.seq, e.uniforms);
			}
			return e.uniformsList;
		}
		function xt(e, t) {
			let n = R.get(e);
			n.outputColorSpace = t.outputColorSpace, n.batching = t.batching, n.batchingColor = t.batchingColor, n.instancing = t.instancing, n.instancingColor = t.instancingColor, n.instancingMorph = t.instancingMorph, n.skinning = t.skinning, n.morphTargets = t.morphTargets, n.morphNormals = t.morphNormals, n.morphColors = t.morphColors, n.morphTargetsCount = t.morphTargetsCount, n.numClippingPlanes = t.numClippingPlanes, n.numIntersection = t.numClipIntersection, n.vertexAlphas = t.vertexAlphas, n.vertexTangents = t.vertexTangents, n.toneMapping = t.toneMapping;
		}
		function St(e, t) {
			if (e.length === 0) return null;
			if (e.length === 1) return e[0].texture === null ? null : e[0];
			y.setFromMatrixPosition(t.matrixWorld);
			for (let t = 0, n = e.length; t < n; t++) {
				let n = e[t];
				if (n.texture !== null && n.boundingBox.containsPoint(y)) return n;
			}
			return null;
		}
		function Ct(e, t, n, r, i) {
			t.isScene !== !0 && (t = ye), z.resetTextureUnits();
			let a = t.fog, o = r.isMeshStandardMaterial || r.isMeshLambertMaterial || r.isMeshPhongMaterial ? t.environment : null, s = M === null ? T.outputColorSpace : M.isXRRenderTarget === !0 ? M.texture.colorSpace : K.workingColorSpace, c = r.isMeshStandardMaterial || r.isMeshLambertMaterial && !r.envMap || r.isMeshPhongMaterial && !r.envMap, l = Ee.get(r.envMap || o, c), u = r.vertexColors === !0 && !!n.attributes.color && n.attributes.color.itemSize === 4, d = !!n.attributes.tangent && (!!r.normalMap || r.anisotropy > 0), f = !!n.morphAttributes.position, p = !!n.morphAttributes.normal, m = !!n.morphAttributes.color, h = 0;
			r.toneMapped && (M === null || M.isXRRenderTarget === !0) && (h = T.toneMapping);
			let g = n.morphAttributes.position || n.morphAttributes.normal || n.morphAttributes.color, _ = g === void 0 ? 0 : g.length, v = R.get(r), y = x.state.lights;
			if (me === !0 && (he === !0 || e !== te)) {
				let t = e === te && r.id === N;
				Pe.setState(r, e, t);
			}
			let b = !1;
			r.version === v.__version ? v.needsLights && v.lightsStateVersion !== y.state.version ? b = !0 : v.outputColorSpace === s ? i.isBatchedMesh && v.batching === !1 || !i.isBatchedMesh && v.batching === !0 || i.isBatchedMesh && v.batchingColor === !0 && i.colorTexture === null || i.isBatchedMesh && v.batchingColor === !1 && i.colorTexture !== null || i.isInstancedMesh && v.instancing === !1 || !i.isInstancedMesh && v.instancing === !0 || i.isSkinnedMesh && v.skinning === !1 || !i.isSkinnedMesh && v.skinning === !0 || i.isInstancedMesh && v.instancingColor === !0 && i.instanceColor === null || i.isInstancedMesh && v.instancingColor === !1 && i.instanceColor !== null || i.isInstancedMesh && v.instancingMorph === !0 && i.morphTexture === null || i.isInstancedMesh && v.instancingMorph === !1 && i.morphTexture !== null ? b = !0 : v.envMap === l ? r.fog === !0 && v.fog !== a || v.numClippingPlanes !== void 0 && (v.numClippingPlanes !== Pe.numPlanes || v.numIntersection !== Pe.numIntersection) ? b = !0 : v.vertexAlphas === u && v.vertexTangents === d && v.morphTargets === f && v.morphNormals === p && v.morphColors === m && v.toneMapping === h && v.morphTargetsCount === _ ? !!v.lightProbeGrid != x.state.lightProbeGridArray.length > 0 && (b = !0) : b = !0 : b = !0 : b = !0 : (b = !0, v.__version = r.version);
			let S = v.currentProgram;
			b === !0 && (S = yt(r, t, i), D && r.isNodeMaterial && D.onUpdateProgram(r, S, v));
			let C = !1, w = !1, E = !1, O = S.getUniforms(), k = v.uniforms;
			if (L.useProgram(S.program) && (C = !0, w = !0, E = !0), r.id !== N && (N = r.id, w = !0), v.needsLights) {
				let e = St(x.state.lightProbeGridArray, i);
				v.lightProbeGrid !== e && (v.lightProbeGrid = e, w = !0);
			}
			if (C || te !== e) {
				L.buffers.depth.getReversed() && e.reversedDepth !== !0 && (e._reversedDepth = !0, e.updateProjectionMatrix()), O.setValue(I, "projectionMatrix", e.projectionMatrix), O.setValue(I, "viewMatrix", e.matrixWorldInverse);
				let t = O.map.cameraPosition;
				t !== void 0 && t.setValue(I, _e.setFromMatrixPosition(e.matrixWorld)), we.logarithmicDepthBuffer && O.setValue(I, "logDepthBufFC", 2 / (Math.log(e.far + 1) / Math.LN2)), (r.isMeshPhongMaterial || r.isMeshToonMaterial || r.isMeshLambertMaterial || r.isMeshBasicMaterial || r.isMeshStandardMaterial || r.isShaderMaterial) && O.setValue(I, "isOrthographic", e.isOrthographicCamera === !0), te !== e && (te = e, w = !0, E = !0);
			}
			if (v.needsLights && (y.state.directionalShadowMap.length > 0 && O.setValue(I, "directionalShadowMap", y.state.directionalShadowMap, z), y.state.spotShadowMap.length > 0 && O.setValue(I, "spotShadowMap", y.state.spotShadowMap, z), y.state.pointShadowMap.length > 0 && O.setValue(I, "pointShadowMap", y.state.pointShadowMap, z)), i.isSkinnedMesh) {
				O.setOptional(I, i, "bindMatrix"), O.setOptional(I, i, "bindMatrixInverse");
				let e = i.skeleton;
				e && (e.boneTexture === null && e.computeBoneTexture(), O.setValue(I, "boneTexture", e.boneTexture, z));
			}
			i.isBatchedMesh && (O.setOptional(I, i, "batchingTexture"), O.setValue(I, "batchingTexture", i._matricesTexture, z), O.setOptional(I, i, "batchingIdTexture"), O.setValue(I, "batchingIdTexture", i._indirectTexture, z), O.setOptional(I, i, "batchingColorTexture"), i._colorsTexture !== null && O.setValue(I, "batchingColorTexture", i._colorsTexture, z));
			let A = n.morphAttributes;
			if ((A.position !== void 0 || A.normal !== void 0 || A.color !== void 0) && Le.update(i, n, S), (w || v.receiveShadow !== i.receiveShadow) && (v.receiveShadow = i.receiveShadow, O.setValue(I, "receiveShadow", i.receiveShadow)), (r.isMeshStandardMaterial || r.isMeshLambertMaterial || r.isMeshPhongMaterial) && r.envMap === null && t.environment !== null && (k.envMapIntensity.value = t.environmentIntensity), k.dfgLUT !== void 0 && (k.dfgLUT.value = Iu()), w) {
				if (O.setValue(I, "toneMappingExposure", T.toneMappingExposure), v.needsLights && wt(k, E), a && r.fog === !0 && je.refreshFogUniforms(k, a), je.refreshMaterialUniforms(k, r, F, se, x.state.transmissionRenderTarget[e.id]), v.needsLights && v.lightProbeGrid) {
					let e = v.lightProbeGrid;
					k.probesSH.value = e.texture, k.probesMin.value.copy(e.boundingBox.min), k.probesMax.value.copy(e.boundingBox.max), k.probesResolution.value.copy(e.resolution);
				}
				hl.upload(I, bt(v), k, z);
			}
			if (r.isShaderMaterial && r.uniformsNeedUpdate === !0 && (hl.upload(I, bt(v), k, z), r.uniformsNeedUpdate = !1), r.isSpriteMaterial && O.setValue(I, "center", i.center), O.setValue(I, "modelViewMatrix", i.modelViewMatrix), O.setValue(I, "normalMatrix", i.normalMatrix), O.setValue(I, "modelMatrix", i.matrixWorld), r.uniformsGroups !== void 0) {
				let e = r.uniformsGroups;
				for (let t = 0, n = e.length; t < n; t++) {
					let n = e[t];
					He.update(n, S), He.bind(n, S);
				}
			}
			return S;
		}
		function wt(e, t) {
			e.ambientLightColor.needsUpdate = t, e.lightProbe.needsUpdate = t, e.directionalLights.needsUpdate = t, e.directionalLightShadows.needsUpdate = t, e.pointLights.needsUpdate = t, e.pointLightShadows.needsUpdate = t, e.spotLights.needsUpdate = t, e.spotLightShadows.needsUpdate = t, e.rectAreaLights.needsUpdate = t, e.hemisphereLights.needsUpdate = t;
		}
		function Tt(e) {
			return e.isMeshLambertMaterial || e.isMeshToonMaterial || e.isMeshPhongMaterial || e.isMeshStandardMaterial || e.isShadowMaterial || e.isShaderMaterial && e.lights === !0;
		}
		this.getActiveCubeFace = function() {
			return j;
		}, this.getActiveMipmapLevel = function() {
			return ee;
		}, this.getRenderTarget = function() {
			return M;
		}, this.setRenderTargetTextures = function(e, t, n) {
			let r = R.get(e);
			r.__autoAllocateDepthBuffer = e.resolveDepthBuffer === !1, r.__autoAllocateDepthBuffer === !1 && (r.__useRenderToTexture = !1), R.get(e.texture).__webglTexture = t, R.get(e.depthTexture).__webglTexture = r.__autoAllocateDepthBuffer ? void 0 : n, r.__hasExternalTextures = !0;
		}, this.setRenderTargetFramebuffer = function(e, t) {
			let n = R.get(e);
			n.__webglFramebuffer = t, n.__useDefaultFramebuffer = t === void 0;
		}, this.setRenderTarget = function(e, t = 0, n = 0) {
			M = e, j = t, ee = n;
			let r = null, i = !1, a = !1;
			if (e) {
				let o = R.get(e);
				if (o.__useDefaultFramebuffer !== void 0) {
					L.bindFramebuffer(I.FRAMEBUFFER, o.__webglFramebuffer), P.copy(e.viewport), ne.copy(e.scissor), re = e.scissorTest, L.viewport(P), L.scissor(ne), L.setScissorTest(re), N = -1;
					return;
				} else if (o.__webglFramebuffer === void 0) z.setupRenderTarget(e);
				else if (o.__hasExternalTextures) z.rebindTextures(e, R.get(e.texture).__webglTexture, R.get(e.depthTexture).__webglTexture);
				else if (e.depthBuffer) {
					let t = e.depthTexture;
					if (o.__boundDepthTexture !== t) {
						if (t !== null && R.has(t) && (e.width !== t.image.width || e.height !== t.image.height)) throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");
						z.setupDepthRenderbuffer(e);
					}
				}
				let s = e.texture;
				(s.isData3DTexture || s.isDataArrayTexture || s.isCompressedArrayTexture) && (a = !0);
				let c = R.get(e).__webglFramebuffer;
				e.isWebGLCubeRenderTarget ? (r = Array.isArray(c[t]) ? c[t][n] : c[t], i = !0) : r = e.samples > 0 && z.useMultisampledRTT(e) === !1 ? R.get(e).__webglMultisampledFramebuffer : Array.isArray(c) ? c[n] : c, P.copy(e.viewport), ne.copy(e.scissor), re = e.scissorTest;
			} else P.copy(ue).multiplyScalar(F).floor(), ne.copy(de).multiplyScalar(F).floor(), re = fe;
			if (n !== 0 && (r = O), L.bindFramebuffer(I.FRAMEBUFFER, r) && L.drawBuffers(e, r), L.viewport(P), L.scissor(ne), L.setScissorTest(re), i) {
				let r = R.get(e.texture);
				I.framebufferTexture2D(I.FRAMEBUFFER, I.COLOR_ATTACHMENT0, I.TEXTURE_CUBE_MAP_POSITIVE_X + t, r.__webglTexture, n);
			} else if (a) {
				let r = t;
				for (let t = 0; t < e.textures.length; t++) {
					let i = R.get(e.textures[t]);
					I.framebufferTextureLayer(I.FRAMEBUFFER, I.COLOR_ATTACHMENT0 + t, i.__webglTexture, n, r);
				}
			} else if (e !== null && n !== 0) {
				let t = R.get(e.texture);
				I.framebufferTexture2D(I.FRAMEBUFFER, I.COLOR_ATTACHMENT0, I.TEXTURE_2D, t.__webglTexture, n);
			}
			N = -1;
		}, this.readRenderTargetPixels = function(e, t, n, r, i, a, o, s = 0) {
			if (!(e && e.isWebGLRenderTarget)) {
				V("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
				return;
			}
			let c = R.get(e).__webglFramebuffer;
			if (e.isWebGLCubeRenderTarget && o !== void 0 && (c = c[o]), c) {
				L.bindFramebuffer(I.FRAMEBUFFER, c);
				try {
					let o = e.textures[s], c = o.format, l = o.type;
					if (e.textures.length > 1 && I.readBuffer(I.COLOR_ATTACHMENT0 + s), !we.textureFormatReadable(c)) {
						V("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");
						return;
					}
					if (!we.textureTypeReadable(l)) {
						V("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");
						return;
					}
					t >= 0 && t <= e.width - r && n >= 0 && n <= e.height - i && I.readPixels(t, n, r, i, Be.convert(c), Be.convert(l), a);
				} finally {
					let e = M === null ? null : R.get(M).__webglFramebuffer;
					L.bindFramebuffer(I.FRAMEBUFFER, e);
				}
			}
		}, this.readRenderTargetPixelsAsync = async function(e, t, n, r, i, a, o, s = 0) {
			if (!(e && e.isWebGLRenderTarget)) throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
			let c = R.get(e).__webglFramebuffer;
			if (e.isWebGLCubeRenderTarget && o !== void 0 && (c = c[o]), c) if (t >= 0 && t <= e.width - r && n >= 0 && n <= e.height - i) {
				L.bindFramebuffer(I.FRAMEBUFFER, c);
				let o = e.textures[s], l = o.format, u = o.type;
				if (e.textures.length > 1 && I.readBuffer(I.COLOR_ATTACHMENT0 + s), !we.textureFormatReadable(l)) throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");
				if (!we.textureTypeReadable(u)) throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");
				let d = I.createBuffer();
				I.bindBuffer(I.PIXEL_PACK_BUFFER, d), I.bufferData(I.PIXEL_PACK_BUFFER, a.byteLength, I.STREAM_READ), I.readPixels(t, n, r, i, Be.convert(l), Be.convert(u), 0);
				let f = M === null ? null : R.get(M).__webglFramebuffer;
				L.bindFramebuffer(I.FRAMEBUFFER, f);
				let p = I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE, 0);
				return I.flush(), await xn(I, p, 4), I.bindBuffer(I.PIXEL_PACK_BUFFER, d), I.getBufferSubData(I.PIXEL_PACK_BUFFER, 0, a), I.deleteBuffer(d), I.deleteSync(p), a;
			} else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.");
		}, this.copyFramebufferToTexture = function(e, t = null, n = 0) {
			let r = 2 ** -n, i = Math.floor(e.image.width * r), a = Math.floor(e.image.height * r), o = t === null ? 0 : t.x, s = t === null ? 0 : t.y;
			z.setTexture2D(e, 0), I.copyTexSubImage2D(I.TEXTURE_2D, n, 0, 0, o, s, i, a), L.unbindTexture();
		}, this.copyTextureToTexture = function(e, t, n = null, r = null, i = 0, a = 0) {
			let o, s, c, l, u, d, f, p, m, h = e.isCompressedTexture ? e.mipmaps[a] : e.image;
			if (n !== null) o = n.max.x - n.min.x, s = n.max.y - n.min.y, c = n.isBox3 ? n.max.z - n.min.z : 1, l = n.min.x, u = n.min.y, d = n.isBox3 ? n.min.z : 0;
			else {
				let t = 2 ** -i;
				o = Math.floor(h.width * t), s = Math.floor(h.height * t), c = e.isDataArrayTexture ? h.depth : e.isData3DTexture ? Math.floor(h.depth * t) : 1, l = 0, u = 0, d = 0;
			}
			r === null ? (f = 0, p = 0, m = 0) : (f = r.x, p = r.y, m = r.z);
			let g = Be.convert(t.format), _ = Be.convert(t.type), v;
			t.isData3DTexture ? (z.setTexture3D(t, 0), v = I.TEXTURE_3D) : t.isDataArrayTexture || t.isCompressedArrayTexture ? (z.setTexture2DArray(t, 0), v = I.TEXTURE_2D_ARRAY) : (z.setTexture2D(t, 0), v = I.TEXTURE_2D), L.activeTexture(I.TEXTURE0), L.pixelStorei(I.UNPACK_FLIP_Y_WEBGL, t.flipY), L.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL, t.premultiplyAlpha), L.pixelStorei(I.UNPACK_ALIGNMENT, t.unpackAlignment);
			let y = L.getParameter(I.UNPACK_ROW_LENGTH), b = L.getParameter(I.UNPACK_IMAGE_HEIGHT), x = L.getParameter(I.UNPACK_SKIP_PIXELS), S = L.getParameter(I.UNPACK_SKIP_ROWS), C = L.getParameter(I.UNPACK_SKIP_IMAGES);
			L.pixelStorei(I.UNPACK_ROW_LENGTH, h.width), L.pixelStorei(I.UNPACK_IMAGE_HEIGHT, h.height), L.pixelStorei(I.UNPACK_SKIP_PIXELS, l), L.pixelStorei(I.UNPACK_SKIP_ROWS, u), L.pixelStorei(I.UNPACK_SKIP_IMAGES, d);
			let w = e.isDataArrayTexture || e.isData3DTexture, T = t.isDataArrayTexture || t.isData3DTexture;
			if (e.isDepthTexture) {
				let n = R.get(e), r = R.get(t), h = R.get(n.__renderTarget), g = R.get(r.__renderTarget);
				L.bindFramebuffer(I.READ_FRAMEBUFFER, h.__webglFramebuffer), L.bindFramebuffer(I.DRAW_FRAMEBUFFER, g.__webglFramebuffer);
				for (let n = 0; n < c; n++) w && (I.framebufferTextureLayer(I.READ_FRAMEBUFFER, I.COLOR_ATTACHMENT0, R.get(e).__webglTexture, i, d + n), I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER, I.COLOR_ATTACHMENT0, R.get(t).__webglTexture, a, m + n)), I.blitFramebuffer(l, u, o, s, f, p, o, s, I.DEPTH_BUFFER_BIT, I.NEAREST);
				L.bindFramebuffer(I.READ_FRAMEBUFFER, null), L.bindFramebuffer(I.DRAW_FRAMEBUFFER, null);
			} else if (i !== 0 || e.isRenderTargetTexture || R.has(e)) {
				let n = R.get(e), r = R.get(t);
				L.bindFramebuffer(I.READ_FRAMEBUFFER, k), L.bindFramebuffer(I.DRAW_FRAMEBUFFER, A);
				for (let e = 0; e < c; e++) w ? I.framebufferTextureLayer(I.READ_FRAMEBUFFER, I.COLOR_ATTACHMENT0, n.__webglTexture, i, d + e) : I.framebufferTexture2D(I.READ_FRAMEBUFFER, I.COLOR_ATTACHMENT0, I.TEXTURE_2D, n.__webglTexture, i), T ? I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER, I.COLOR_ATTACHMENT0, r.__webglTexture, a, m + e) : I.framebufferTexture2D(I.DRAW_FRAMEBUFFER, I.COLOR_ATTACHMENT0, I.TEXTURE_2D, r.__webglTexture, a), i === 0 ? T ? I.copyTexSubImage3D(v, a, f, p, m + e, l, u, o, s) : I.copyTexSubImage2D(v, a, f, p, l, u, o, s) : I.blitFramebuffer(l, u, o, s, f, p, o, s, I.COLOR_BUFFER_BIT, I.NEAREST);
				L.bindFramebuffer(I.READ_FRAMEBUFFER, null), L.bindFramebuffer(I.DRAW_FRAMEBUFFER, null);
			} else T ? e.isDataTexture || e.isData3DTexture ? I.texSubImage3D(v, a, f, p, m, o, s, c, g, _, h.data) : t.isCompressedArrayTexture ? I.compressedTexSubImage3D(v, a, f, p, m, o, s, c, g, h.data) : I.texSubImage3D(v, a, f, p, m, o, s, c, g, _, h) : e.isDataTexture ? I.texSubImage2D(I.TEXTURE_2D, a, f, p, o, s, g, _, h.data) : e.isCompressedTexture ? I.compressedTexSubImage2D(I.TEXTURE_2D, a, f, p, h.width, h.height, g, h.data) : I.texSubImage2D(I.TEXTURE_2D, a, f, p, o, s, g, _, h);
			L.pixelStorei(I.UNPACK_ROW_LENGTH, y), L.pixelStorei(I.UNPACK_IMAGE_HEIGHT, b), L.pixelStorei(I.UNPACK_SKIP_PIXELS, x), L.pixelStorei(I.UNPACK_SKIP_ROWS, S), L.pixelStorei(I.UNPACK_SKIP_IMAGES, C), a === 0 && t.generateMipmaps && I.generateMipmap(v), L.unbindTexture();
		}, this.initRenderTarget = function(e) {
			R.get(e).__webglFramebuffer === void 0 && z.setupRenderTarget(e);
		}, this.initTexture = function(e) {
			e.isCubeTexture ? z.setTextureCube(e, 0) : e.isData3DTexture ? z.setTexture3D(e, 0) : e.isDataArrayTexture || e.isCompressedArrayTexture ? z.setTexture2DArray(e, 0) : z.setTexture2D(e, 0), L.unbindTexture();
		}, this.resetState = function() {
			j = 0, ee = 0, M = null, L.reset(), Ve.reset();
		}, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	get coordinateSystem() {
		return fn;
	}
	get outputColorSpace() {
		return this._outputColorSpace;
	}
	set outputColorSpace(e) {
		this._outputColorSpace = e;
		let t = this.getContext();
		t.drawingBufferColorSpace = K._getDrawingBufferColorSpace(e), t.unpackColorSpace = K._getUnpackColorSpace();
	}
};
//#endregion
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
function Ru(e, t = !1) {
	let n = e[0].index !== null, r = new Set(Object.keys(e[0].attributes)), i = new Set(Object.keys(e[0].morphAttributes)), a = {}, o = {}, s = e[0].morphTargetsRelative, c = new Ki(), l = 0;
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
		let t = zu(a[e]);
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
				let r = zu(t);
				if (!r) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + e + " morphAttribute."), null;
				c.morphAttributes[e].push(r);
			}
		}
	}
	return c;
}
function zu(e) {
	let t, n, r, i = -1, a = 0;
	for (let o = 0; o < e.length; ++o) {
		let s = e[o];
		if (t === void 0 && (t = s.array.constructor), t !== s.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
		if (n === void 0 && (n = s.itemSize), n !== s.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
		if (r === void 0 && (r = s.normalized), r !== s.normalized) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
		if (i === -1 && (i = s.gpuType), i !== s.gpuType) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."), null;
		a += s.count * n;
	}
	let o = new t(a), s = new Mi(o, n, r), c = 0;
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
//#endregion
//#region src/lib/structure/covalent-radii.js
var Bu = Object.freeze({
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
}), Vu = Object.freeze(/* @__PURE__ */ new Set([
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
])), Hu = Object.freeze({
	Bk: 1.65,
	Cf: 1.81
}), $ = {
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
		radius: Bu[e] ?? Hu[e],
		...t
	}]))
}, Uu = [
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
], Wu = [
	-1,
	1,
	1
], Gu = [
	new q().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
	new q().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1),
	new q().set(0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
];
function Ku(e, t) {
	let n = new J(e.atomColor), r = Math.max(1, t.atomCutawayStripeCount), i = Yn.clamp(t.atomCutawayStripeWidth, .01, 1) / 2, a = new go({
		color: e.ringColor,
		roughness: t.atomColorRoughness,
		metalness: t.atomColorMetalness,
		side: 2
	});
	return a.userData.cutawayStripes = {
		color: n,
		count: r,
		width: i * 2
	}, a.onBeforeCompile = (e) => {
		e.uniforms.cutawayStripeColor = { value: n }, e.uniforms.cutawayStripeCount = { value: r }, e.uniforms.cutawayStripeHalfWidth = { value: i }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vCutawayUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvCutawayUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vCutawayUv;\nuniform vec3 cutawayStripeColor;\nuniform float cutawayStripeCount;\nuniform float cutawayStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat cutawayStripeCoordinate = vCutawayUv.y * cutawayStripeCount;\nfloat cutawayStripePhase = fract(cutawayStripeCoordinate);\nfloat cutawayStripeDistance = abs(cutawayStripePhase - 0.5);\nfloat cutawayStripeEdge = max(fwidth(cutawayStripeCoordinate), 0.001);\nfloat cutawayStripeMask = 1.0 - smoothstep(\n    cutawayStripeHalfWidth - cutawayStripeEdge,\n    cutawayStripeHalfWidth + cutawayStripeEdge,\n    cutawayStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, cutawayStripeColor, cutawayStripeMask\n);");
	}, a.customProgramCacheKey = () => "cutaway-horizontal-stripes-v1", a;
}
function qu(e, t = e.plot2DLineColor) {
	let n = new J(t), r = Math.max(1, e.plot2DStripeCount), i = Yn.clamp(e.plot2DStripeWidth, .01, 1) / 2, a = new ra({
		color: e.plot2DAtomColor,
		side: 2
	});
	return a.userData.plot2DHatch = {
		color: n,
		count: r,
		width: i * 2
	}, a.onBeforeCompile = (e) => {
		e.uniforms.plot2DStripeColor = { value: n }, e.uniforms.plot2DStripeCount = { value: r }, e.uniforms.plot2DStripeHalfWidth = { value: i }, e.vertexShader = e.vertexShader.replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vPlot2DUv;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvPlot2DUv = uv;"), e.fragmentShader = e.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vPlot2DUv;\nuniform vec3 plot2DStripeColor;\nuniform float plot2DStripeCount;\nuniform float plot2DStripeHalfWidth;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat plot2DStripeCoordinate = vPlot2DUv.y * plot2DStripeCount;\nfloat plot2DStripePhase = fract(plot2DStripeCoordinate);\nfloat plot2DStripeDistance = abs(plot2DStripePhase - 0.5);\nfloat plot2DStripeEdge = max(fwidth(plot2DStripeCoordinate), 0.001);\nfloat plot2DStripeMask = 1.0 - smoothstep(\n    plot2DStripeHalfWidth - plot2DStripeEdge,\n    plot2DStripeHalfWidth + plot2DStripeEdge,\n    plot2DStripeDistance\n);\ndiffuseColor.rgb = mix(\n    diffuseColor.rgb, plot2DStripeColor, plot2DStripeMask\n);");
	}, a.customProgramCacheKey = () => "2d-plot-curved-octant-hatch-v1", a;
}
function Ju(e, t) {
	e.scale.set(t[0] / Wu[0], t[1] / Wu[1], t[2] / Wu[2]);
}
function Yu(e, t) {
	let n = e.getAttribute("uv"), r = Math.cos(t), i = Math.sin(t);
	for (let e = 0; e < n.count; e++) {
		let t = n.getX(e) - .5, a = n.getY(e) - .5;
		n.setXY(e, t * r - a * i + .5, t * i + a * r + .5);
	}
	n.needsUpdate = !0;
}
function Xu(e) {
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
			let n = new q();
			for (let r = 0; r < e.count; r++) e.getMatrixAt(r, n), n.elements.some(isNaN) && (t.matrix++, console.log("instanceMatrix"), console.log(n.elements), console.log(e.userData));
		}
		for (let t of e.children) n(t);
	}
	return n(e), t;
}
var Zu = class {
	constructor(e, t, n) {
		this.mesh = new Ea(e, t, n), this.mesh.userData = { selectable: !1 }, this.nextIndex = 0;
	}
	register(e) {
		let t = this.nextIndex++;
		return this.mesh.setMatrixAt(t, e), t;
	}
	finalize() {
		this.mesh.instanceMatrix.needsUpdate = !0, this.mesh.computeBoundingSphere();
	}
	hideInstance(e) {
		this.mesh.setMatrixAt(e, new q().makeScale(0, 0, 0)), this.mesh.instanceMatrix.needsUpdate = !0;
	}
	restoreInstance(e, t) {
		this.mesh.setMatrixAt(e, t), this.mesh.instanceMatrix.needsUpdate = !0;
	}
};
function Qu(e, t) {
	let n = e.getEllipsoidMatrix(t).toArray();
	return new q(n[0][0], n[0][1], n[0][2], 0, n[1][0], n[1][1], n[1][2], 0, n[2][0], n[2][1], n[2][2], 0, 0, 0, 0, 1);
}
function $u(e, t) {
	let n = t.clone().sub(e), r = n.length();
	if (r === 0) throw Error("Error in ORTEP Bond Creation. Trying to create a zero length bond.");
	let i = n.divideScalar(r), a = new W(0, 1, 0), o = new W().crossVectors(i, a), s = -Math.acos(i.dot(a));
	return new q().makeScale(1, r, 1).premultiply(new q().makeRotationAxis(o.normalize(), s)).setPosition(e.clone().add(t).multiplyScalar(.5));
}
function ed(e, t, n, r) {
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
var td = class {
	constructor(e = {}) {
		let t = e || {};
		this.options = {
			...$,
			...t,
			elementProperties: {
				...$.elementProperties,
				...t.elementProperties || {}
			}
		}, this.scaling = 1.5384, this.geometries = {}, this.materials = {}, this.elementMaterials = {}, this.initializeGeometries(), this.initializeMaterials();
	}
	initializeGeometries() {
		if (this.geometries.atom = new eo(this.scaling, this.options.atomDetail), this.options.renderStyle !== "solid-3d") {
			let e = Math.max(3, 2 ** this.options.atomDetail + 2);
			this.geometries.atomOctant = new no(this.scaling, e, e, 0, Math.PI / 2, 0, Math.PI / 2), this.geometries.emptyAtom = new Ki(), this.geometries.cutawayPlanes = this.createCutawayPlanes(e * 4);
		}
		this.geometries.adpRing = this.createADPHalfTorus(), this.geometries.adpRingSet = this.createMergedADPRingSet(this.geometries.adpRing), this.geometries.bond = new Za(this.options.bondRadius, this.options.bondRadius, .98, this.options.bondSections, 1, !0), this.geometries.hbond = new Za(this.options.hbondRadius, this.options.hbondRadius, .98, this.options.bondSections, 1, !0);
	}
	initializeMaterials() {
		if (this.options.renderStyle === "cutout-2d") {
			this.materials.bond = new ra({ color: this.options.plot2DBondColor }), this.materials.openBond = new ra({ color: this.options.plot2DAtomColor }), this.materials.openBondOutline = new ra({
				color: this.options.plot2DBondColor,
				side: 1
			}), this.materials.hbond = new ra({ color: this.options.plot2DLineColor });
			return;
		}
		this.materials.bond = new go({
			color: this.options.bondColor,
			roughness: this.options.bondColorRoughness,
			metalness: this.options.bondColorMetalness
		}), this.materials.hbond = new go({
			color: this.options.hbondColor,
			roughness: this.options.hbondColorRoughness,
			metalness: this.options.hbondColorMetalness
		});
	}
	validateElementType(e) {
		if (!this.options.elementProperties[e]) throw Error(`Unknown element type: ${e}. Please ensure element properties are defined.Pass the type settings as custom options, ifthey are element from periodic table`);
	}
	getAtomMaterials(e) {
		let t = e;
		if (this.options.elementProperties[t] || (t = je(e)), this.validateElementType(t), this.options.renderStyle === "cutout-2d") {
			let e = `${t}_2d_materials`;
			if (!this.elementMaterials[e]) {
				let n = this.options.elementProperties[t], r = ["H", "D"].includes(t) ? this.options.plot2DLineColor : n.atomColor, i = new ra({
					color: r,
					side: 1
				}), a = new ra({ color: this.options.plot2DAtomColor });
				a.userData.plot2DOutlineMaterial = i, a.userData.plot2DOutlineScale = this.options.plot2DOutlineScale;
				let o = new ra({ color: r }), s = qu(this.options, r);
				this.elementMaterials[e] = [
					a,
					o,
					s,
					i
				];
			}
			return this.elementMaterials[e];
		}
		let n = `${t}_materials`;
		if (!this.elementMaterials[n]) {
			let e = this.options.elementProperties[t], r = new go({
				color: e.atomColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			}), i = new go({
				color: e.ringColor,
				roughness: this.options.atomColorRoughness,
				metalness: this.options.atomColorMetalness
			});
			this.elementMaterials[n] = [r, i], this.options.renderStyle === "cutout-3d" && this.elementMaterials[n].push(Ku(e, this.options));
		}
		return this.elementMaterials[n];
	}
	createADPHalfTorus() {
		let e = new io(this.scaling * this.options.atomADPRingWidthFactor, this.options.atomADPRingHeight, this.options.atomADPInnerSections, this.options.atomADPRingSections), t = e.attributes.position.array, n = e.index.array, r = [], i = [], a = /* @__PURE__ */ new Set();
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
		let c = new Ki();
		return c.setAttribute("position", new Y(r, 3)), c.setIndex(i), c.computeVertexNormals(), c.rotateX(.5 * Math.PI), e.dispose(), c;
	}
	createCutawayPlanes(e) {
		let t = new Xa(this.scaling, e), n = new Xa(this.scaling, e), r = new Xa(this.scaling, e);
		Yu(n, Math.PI / 2), Yu(r, Math.PI / 2), n.rotateX(Math.PI / 2), r.rotateY(Math.PI / 2);
		let i = Ru([
			t,
			n,
			r
		]);
		return t.dispose(), n.dispose(), r.dispose(), i;
	}
	createMergedADPRingSet(e) {
		let t = Gu.map((t) => {
			let n = e.clone();
			return n.applyMatrix4(t), n;
		}), n = Ru(t);
		return t.forEach((e) => e.dispose()), n;
	}
	dispose() {
		Object.values(this.geometries).forEach((e) => e.dispose()), Object.values(this.materials).forEach((e) => e.dispose()), Object.values(this.elementMaterials).forEach((e) => {
			e.forEach((e) => e.dispose());
		});
	}
}, nd = class {
	constructor(e, t = {}) {
		let n = t || {}, r = { ...$.elementProperties };
		n.elementProperties && Object.entries(n.elementProperties).forEach(([e, t]) => {
			r[e] = {
				...r[e],
				...t
			};
		}), this.options = {
			...$,
			...n,
			elementProperties: r
		}, this.crystalStructure = e, this.cache = new td(this.options), this.createStructure();
	}
	createStructure() {
		this.atoms3D = [], this.bonds3D = [], this.hBonds3D = [];
		let e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Map();
		for (let n of this.crystalStructure.atoms) {
			let r = n.uniqueId;
			e.add(r), t.has(r) || t.set(r, n);
		}
		let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = (e) => {
			let r = n.get(e);
			if (!r) {
				let i = t.get(e).position.toCartesian(this.crystalStructure.cell);
				r = new W(i.x, i.y, i.z), n.set(e, r);
			}
			return r;
		};
		if (this.options.renderStyle !== "solid-3d") for (let e of this.crystalStructure.atoms) {
			let [t, n, i] = this.cache.getAtomMaterials(e.atomType), a;
			a = e.adp instanceof xe ? new ad(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.cache.geometries.adpRingSet, n, {
				octantGeometry: this.cache.geometries.atomOctant,
				emptyGeometry: this.cache.geometries.emptyAtom,
				planeGeometry: this.cache.geometries.cutawayPlanes,
				planeMaterial: i,
				hysteresis: this.options.atomCutawayHysteresis
			}) : e.adp instanceof be ? new od(e, this.crystalStructure.cell, this.cache.geometries.atom, t) : new sd(e, this.crystalStructure.cell, this.cache.geometries.atom, t, this.options), this.atoms3D.push(a), r.has(e.uniqueId) || r.set(e.uniqueId, a);
		}
		else {
			this.cache.geometries.atom.boundingSphere || this.cache.geometries.atom.computeBoundingSphere();
			let e = this.cache.geometries.atom.boundingSphere.radius, t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), i = [];
			for (let e of this.crystalStructure.atoms) {
				let [r, a] = this.cache.getAtomMaterials(e.atomType);
				if (e.adp instanceof xe) {
					let { matrix: o, valid: s } = cd(e, this.crystalStructure.cell);
					s ? (t.set(r, (t.get(r) || 0) + 1), n.set(a, (n.get(a) || 0) + 1), i.push({
						atom: e,
						kind: "ani",
						matrix: o,
						atomMaterial: r,
						ringMaterial: a
					})) : i.push({
						atom: e,
						kind: "ani-fallback",
						atomMaterial: r,
						ringMaterial: a
					});
				} else if (e.adp instanceof be) {
					let { matrix: n, valid: a } = ld(e, this.crystalStructure.cell);
					a ? (t.set(r, (t.get(r) || 0) + 1), i.push({
						atom: e,
						kind: "iso",
						matrix: n,
						atomMaterial: r
					})) : i.push({
						atom: e,
						kind: "iso-fallback",
						atomMaterial: r
					});
				} else {
					let n = ud(e, this.crystalStructure.cell, this.options);
					t.set(r, (t.get(r) || 0) + 1), i.push({
						atom: e,
						kind: "constant",
						matrix: n,
						atomMaterial: r
					});
				}
			}
			let a = /* @__PURE__ */ new Map();
			for (let [e, n] of t) a.set(e, new Zu(this.cache.geometries.atom, e, n));
			let o = /* @__PURE__ */ new Map();
			for (let [e, t] of n) o.set(e, new Zu(this.cache.geometries.adpRingSet, e, t));
			for (let t of i) {
				let n;
				n = t.kind === "ani" ? new pd(t.atom, a.get(t.atomMaterial), t.matrix, e, o.get(t.ringMaterial)) : t.kind === "iso" || t.kind === "constant" ? new fd(t.atom, a.get(t.atomMaterial), t.matrix, e) : t.kind === "ani-fallback" ? new ad(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial, this.cache.geometries.adpRingSet, t.ringMaterial, null) : new od(t.atom, this.crystalStructure.cell, this.cache.geometries.atom, t.atomMaterial), this.atoms3D.push(n), r.has(t.atom.uniqueId) || r.set(t.atom.uniqueId, n);
			}
			a.forEach((e) => e.finalize()), o.forEach((e) => e.finalize()), this.atomPools = a, this.ringPools = o;
		}
		let a = this.options.renderStyle === "solid-3d" ? null : (e) => r.get(e), o = this.crystalStructure.bonds.filter((t) => {
			let n = e.has(t.atom1Id), r = e.has(t.atom2Id);
			return n && r;
		});
		if (this.options.renderStyle === "cutout-2d") for (let e of o) try {
			let n = [t.get(e.atom1Id), t.get(e.atom2Id)].some((e) => Number(e.disorderGroup) > 1);
			this.bonds3D.push(new md(e, this.crystalStructure, this.cache.geometries.bond, n ? this.cache.materials.openBond : this.cache.materials.bond, i, a, n ? {
				outlineMaterial: this.cache.materials.openBondOutline,
				innerScale: this.options.plot2DOpenBondInnerScale
			} : null));
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		else {
			let e = [];
			for (let t of o) try {
				let n = hd.computeMatrix(t, this.crystalStructure, i, a);
				e.push([t, n]);
			} catch (e) {
				if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
			}
			this.bondPool = e.length > 0 ? new Zu(this.cache.geometries.bond, this.cache.materials.bond, e.length) : null;
			for (let [t, n] of e) this.bonds3D.push(new hd(t, this.bondPool, n));
			this.bondPool?.finalize();
		}
		let s = this.crystalStructure.hBonds.filter((t) => e.has(t.donorAtomId) && e.has(t.acceptorAtomId) && (!t.hydrogenAtomId || e.has(t.hydrogenAtomId))), c = [], l = 0;
		for (let e of s) try {
			let t = gd.computeSegmentMatrices(e, this.crystalStructure, this.options.hbondDashSegmentLength, this.options.hbondDashFraction, i, a);
			c.push([e, t]), l += t.length;
		} catch (e) {
			if (e.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.") throw e;
		}
		this.hbondPool = l > 0 ? new Zu(this.cache.geometries.hbond, this.cache.materials.hbond, l) : null;
		for (let [e, t] of c) this.hBonds3D.push(new gd(e, this.hbondPool, t));
		this.hbondPool?.finalize();
	}
	getGroup() {
		let e = new Gr();
		if (this.atomPools) for (let t of this.atomPools.values()) e.add(t.mesh);
		if (this.ringPools) for (let t of this.ringPools.values()) e.add(t.mesh);
		for (let t of this.atoms3D) e.add(t);
		this.bondPool && e.add(this.bondPool.mesh);
		for (let t of this.bonds3D) e.add(t);
		this.hbondPool && e.add(this.hbondPool.mesh);
		for (let t of this.hBonds3D) e.add(t);
		return Xu(e), e.cutawayAtoms = this.atoms3D.filter((e) => e.isCutaway), e.cameraFacingAtoms = e.cutawayAtoms, e;
	}
	dispose() {
		this.cache.dispose();
	}
}, rd = class e extends X {
	constructor(t, n) {
		if (new.target === e) throw TypeError("ORTEPObject is an abstract class and cannot be instantiated directly.");
		super(t, n), this._selectionColor = null, this.marker = null;
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(e) {
		return new ra({
			color: e,
			transparent: !0,
			opacity: .9,
			side: 1
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
}, id = class extends rd {
	constructor(e, t, n, r) {
		super(n, r), this.updateSurfaceRadius();
		let i = r.userData.plot2DOutlineMaterial;
		if (i) {
			let e = new X(n, i);
			e.scale.multiplyScalar(r.userData.plot2DOutlineScale), e.userData = {
				selectable: !1,
				type: "2d-atom-outline"
			}, this.add(e), this.plot2DOutline = e;
		}
		let a = new W(...e.position.toCartesian(t));
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
		if (e.lengthSq() === 0 || this.surfaceRadius === 0) return 0;
		this.updateMatrix();
		let t = this.matrix.clone().setPosition(0, 0, 0).invert(), n = e.clone().normalize().applyMatrix4(t).length();
		return Number.isFinite(n) && n > 0 ? this.surfaceRadius / n : 0;
	}
	createSelectionMarker(e, t) {
		let n = new X(this.geometry, this.createSelectionMaterial(e));
		return n.scale.multiplyScalar(t.selection.markerMult), n.userData.selectable = !1, n;
	}
}, ad = class extends id {
	constructor(e, t, n, r, i, a, o = null) {
		if (super(e, t, n, r), [
			e.adp.u11,
			e.adp.u22,
			e.adp.u33
		].some((e) => e <= 0)) this.geometry = new ro(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
		else {
			let n = Qu(e.adp, t);
			if (n.toArray().includes(NaN)) this.geometry = new ro(.8), this.plot2DOutline && (this.plot2DOutline.geometry = this.geometry), this.updateSurfaceRadius();
			else {
				o && this.setupCutaway(o, r);
				let e = new X(i, a);
				e.userData.selectable = !1, this.add(e), this.ringMesh = e, this.applyMatrix4(n);
			}
		}
		let s = new W(...e.position.toCartesian(t));
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
		], this.cutawayViewDirection = new W(), this.cutawayWorldPosition = new W(), this.cutawayInverseRotation = new q(), this.cutawayOctants = Uu.map((n, r) => {
			let i = new X(e.octantGeometry, t);
			return Ju(i, n), i.userData = {
				selectable: !1,
				type: "ellipsoid-octant",
				octantIndex: r
			}, this.add(i), i;
		}), this.plot2DOutline) {
			this.remove(this.plot2DOutline);
			let n = t.userData.plot2DOutlineMaterial, r = t.userData.plot2DOutlineScale;
			this.cutawayOutlines = Uu.map((t, i) => {
				let a = new X(e.octantGeometry, n);
				return Ju(a, t), a.scale.multiplyScalar(r), a.userData = {
					selectable: !1,
					type: "2d-ellipsoid-outline",
					octantIndex: i
				}, this.add(a), a;
			}), this.plot2DOutline = null;
		}
		let n = new X(e.planeGeometry, e.planeMaterial);
		n.userData = {
			selectable: !1,
			type: "ellipsoid-cutaway-planes"
		}, this.add(n), this.cutawayPlanes = n, this.setMissingOctant(7);
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
	createSelectionMarker(e, t) {
		if (!this.isCutaway) return super.createSelectionMarker(e, t);
		let n = new Gr(), r = this.createSelectionMaterial(e);
		return n.cutawayOctants = Uu.map((e, t) => {
			let i = new X(this.cutawayOctants[0].geometry, r);
			return Ju(i, e), i.visible = t !== this.missingOctantIndex, i.userData.selectable = !1, n.add(i), i;
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
			X.prototype.raycast.call(t, e, n);
		}), n.forEach((e) => {
			t.push({
				...e,
				object: this
			});
		}), !1;
	}
	get adpRingMatrices() {
		return Gu.map((e) => e.clone());
	}
}, od = class extends id {
	constructor(e, t, n, r) {
		if (super(e, t, n, r), !e.adp || !("uiso" in e.adp)) throw Error("Atom must have isotropic displacement parameters (UIsoADP)");
		e.adp.uiso <= 0 ? (this.geometry = new ro(1), this.updateSurfaceRadius()) : this.scale.multiplyScalar(Math.sqrt(e.adp.uiso));
	}
}, sd = class extends id {
	constructor(e, t, n, r, i) {
		super(e, t, n, r);
		let a = e.atomType;
		try {
			i.elementProperties[a] || (a = je(e.atomType));
		} catch {
			throw Error(`Element properties not found for atom type: '${e.atomType}'`);
		}
		this.scale.multiplyScalar(i.atomConstantRadiusMultiplier * i.elementProperties[a].radius);
	}
};
function cd(e, t) {
	if ([
		e.adp.u11,
		e.adp.u3,
		e.adp.u33
	].some((e) => e <= 0)) return {
		matrix: null,
		valid: !1
	};
	let n = Qu(e.adp, t);
	if (n.toArray().includes(NaN)) return {
		matrix: null,
		valid: !1
	};
	let r = new W(...e.position.toCartesian(t));
	return {
		matrix: n.setPosition(r),
		valid: !0
	};
}
function ld(e, t) {
	if (e.adp.uiso <= 0) return {
		matrix: null,
		valid: !1
	};
	let n = Math.sqrt(e.adp.uiso), r = new W(...e.position.toCartesian(t));
	return {
		matrix: new q().makeScale(n, n, n).setPosition(r),
		valid: !0
	};
}
function ud(e, t, n) {
	let r = e.atomType;
	try {
		n.elementProperties[r] || (r = je(e.atomType));
	} catch {
		throw Error(`Element properties not found for atom type: '${e.atomType}'`);
	}
	let i = n.atomConstantRadiusMultiplier * n.elementProperties[r].radius, a = new W(...e.position.toCartesian(t));
	return new q().makeScale(i, i, i).setPosition(a);
}
var dd = class e extends Wr {
	constructor() {
		if (new.target === e) throw TypeError("PooledSelectableObject is an abstract class and cannot be instantiated directly.");
		super(), this._selectionColor = null, this.marker = null, this.matrixAutoUpdate = !1, this.segments = [];
	}
	get selectionColor() {
		return this._selectionColor;
	}
	createSelectionMaterial(e) {
		return new ra({
			color: e,
			transparent: !0,
			opacity: .9,
			side: 1
		});
	}
	raycast(e, t) {
		let n = [], r = new X();
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
			n.emissive?.setHex(t.selection.highlightEmissive), e.pool.hideInstance(e.index);
			let r = new X(e.pool.mesh.geometry, n);
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
			e instanceof X && e.material?.dispose();
		}), null);
	}
	createSelectionMarker(e, t) {
		throw Error("createSelectionMarker needs to be implemented in a subclass");
	}
	dispose() {
		this.marker && this.deselect();
	}
}, fd = class extends dd {
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
		let n = this.segments[0], r = new X(n.pool.mesh.geometry, this.createSelectionMaterial(e));
		return r.applyMatrix4(n.matrix), r.scale.multiplyScalar(t.selection.markerMult), r.userData.selectable = !1, r;
	}
}, pd = class extends fd {
	constructor(e, t, n, r, i) {
		super(e, t, n, r), i && (this.ringPool = i, this.ringIndex = i.register(n));
	}
}, md = class extends rd {
	constructor(e, t, n, r, i = null, a = null, o = null) {
		super(n, r);
		let s, c;
		if (i) s = i(e.atom1Id), c = i(e.atom2Id);
		else {
			let n = t.getAtomById(e.atom1Id), r = t.getAtomById(e.atom2Id);
			s = new W(...n.position.toCartesian(t.cell)), c = new W(...r.position.toCartesian(t.cell));
		}
		a && ([s, c] = ed(s, c, a(e.atom1Id), a(e.atom2Id)));
		let l = $u(s, c);
		if (this.applyMatrix4(l), o) {
			let e = Yn.clamp(o.innerScale, .05, .95);
			this.scale.x *= e, this.scale.z *= e;
			let t = new X(n, o.outlineMaterial);
			t.scale.set(1 / e, 1, 1 / e), t.userData = {
				selectable: !1,
				type: "2d-open-bond-outline"
			}, this.add(t), this.openBondOutline = t;
		}
		this.userData = {
			type: "bond",
			bondData: e,
			selectable: !0,
			isOpenDisorderBond: !!o
		};
	}
	createSelectionMarker(e, t) {
		let n = new X(this.geometry, this.createSelectionMaterial(e));
		return n.scale.x *= t.selection.bondMarkerMult, n.scale.z *= t.selection.bondMarkerMult, n.userData.selectable = !1, n;
	}
}, hd = class extends dd {
	static computeMatrix(e, t, n = null, r = null) {
		let i, a;
		if (n) i = n(e.atom1Id), a = n(e.atom2Id);
		else {
			let n = t.getAtomById(e.atom1Id), r = t.getAtomById(e.atom2Id);
			i = new W(...n.position.toCartesian(t.cell)), a = new W(...r.position.toCartesian(t.cell));
		}
		return r && ([i, a] = ed(i, a, r(e.atom1Id), r(e.atom2Id))), $u(i, a);
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
	createSelectionMarker(e, t) {
		let n = this.segments[0], r = new X(n.pool.mesh.geometry, this.createSelectionMaterial(e));
		return r.applyMatrix4(n.matrix), r.scale.x *= t.selection.bondMarkerMult, r.scale.z *= t.selection.bondMarkerMult, r.userData.selectable = !1, r;
	}
}, gd = class extends dd {
	static computeSegmentMatrices(e, t, n, r, i = null, a = null) {
		let o, s;
		if (i) o = i(e.hydrogenAtomId), s = i(e.acceptorAtomId);
		else {
			let n = t.getAtomById(e.hydrogenAtomId), r = t.getAtomById(e.acceptorAtomId);
			o = new W(...n.position.toCartesian(t.cell)), s = new W(...r.position.toCartesian(t.cell));
		}
		a && ([o, s] = ed(o, s, a(e.hydrogenAtomId), a(e.acceptorAtomId)));
		let c = o.distanceTo(s), l = Math.max(1, Math.floor(c / n)), u = c / l * r, d = [];
		for (let e = 0; e < l; e++) {
			let t = e / l, n = t + u / c, r = new W().lerpVectors(o, s, t), i = new W().lerpVectors(o, s, n);
			d.push($u(r, i));
		}
		return d;
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
		let n = new Gr(), r = this.createSelectionMaterial(e);
		return this.segments.forEach((e) => {
			let i = new X(e.pool.mesh.geometry, r);
			i.applyMatrix4(e.matrix), i.scale.x *= t.selection.bondMarkerMult, i.scale.y *= .8 * t.selection.bondMarkerMult, i.scale.z *= t.selection.bondMarkerMult, i.userData.selectable = !1, n.add(i);
		}), n;
	}
};
//#endregion
//#region src/lib/formatting.js
function _d(e, t, n = 4) {
	if (!isFinite(1 / t)) return vd(e, n).toFixed(n);
	let r = Math.floor(Math.log10(t));
	t * 10 ** -r < 2 && --r;
	let i = vd(e, -r);
	if (r < 0) {
		let e = Math.round(t / 10 ** r);
		return `${i.toFixed(-r)}(${e})`;
	}
	return `${i}(${vd(t, r)})`;
}
function vd(e, t) {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}
//#endregion
//#region src/lib/fix-cif/reconcile-labels.js
function yd(e, t = !0) {
	if (!e || typeof e != "string") throw Error("Empty atom label");
	let n = e.toUpperCase().replace(/[()[\]{}]/g, "");
	if (t && (n = n.replace(/\^[a-zA-Z1-9]+$/, "").replace(/_[a-zA-Z1-9]+$/, "").replace(/_\$\d+$/, "")), n === "") throw Error(`Label "${e}" normalizes to empty string`);
	return n;
}
function bd(e, t = !0) {
	let n = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		try {
			let r = yd(e, t);
			n.has(r) || n.set(r, []), n.get(r).push(e);
		} catch (e) {
			console.warn(`Skipping invalid label: ${e.message}`);
		}
	});
	let r = /* @__PURE__ */ new Map();
	for (let [e, t] of n.entries()) t.length === 1 ? r.set(e, t[0]) : console.warn(`Multiple labels map to ${e}: ${t.join(", ")}. Skipping mapping.`);
	return r;
}
function xd(e, t, n, r = !0) {
	let i = bd(n, r), a = e.get(t).map((e) => {
		let t = yd(e, r);
		return i.has(t) ? i.get(t) : e;
	});
	e.data[t] = a;
}
//#endregion
//#region src/lib/fix-cif/guess-symmetry.js
function Sd(e) {
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
function Cd(e, t) {
	let n = e.get(t).map((e) => Sd(e));
	e.data[t] = n;
}
//#endregion
//#region src/lib/fix-cif/base.js
function wd(e, t) {
	for (let n of t) if (e.headerLines.includes(n)) return n;
	return null;
}
function Td(e, t) {
	if (wd(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"])) return;
	let n = wd(e, ["_atom_site.adp_type", "_atom_site_adp_type"]), r = wd(e, ["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"]);
	if (!n || !r) return;
	let i = e.get(n), a = e.get(r);
	e.data[n] = i.map((e, t) => {
		let n = Number.isFinite(Number(a[t]));
		return /^uani$/i.test(String(e)) && n ? "Uiso" : e;
	});
}
function Ed(e, t = !0, n = !0, r = !0) {
	let i, a;
	if ((t || n) && (i = e.get("_atom_site"), a = i.get(["_atom_site.label", "_atom_site_label"])), t) {
		let t = e.get("_atom_site_aniso", !1);
		if (t) {
			let e = wd(t, ["_atom_site_aniso.label", "_atom_site_aniso_label"]);
			e ? xd(t, e, a) : Td(i, t);
		}
	}
	if (n || r) {
		let t = e.get("_geom_bond", !1);
		if (t && (n && (xd(t, wd(t, ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]), a), xd(t, wd(t, ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"]), a)), r)) {
			let e = wd(t, ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"]);
			e && Cd(t, e);
			let n = wd(t, ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"]);
			n && Cd(t, n);
		}
		let i = e.get("_geom_hbond", !1);
		if (i) {
			if (n) {
				xd(i, wd(i, ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]), a);
				let e = wd(i, ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"]);
				e && xd(i, e, a), xd(i, wd(i, ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"]), a);
			}
			if (r) {
				let e = wd(i, ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"]);
				e && Cd(i, e);
			}
		}
	}
}
//#endregion
//#region src/lib/disorder-icons.js
function Dd(e, t) {
	if (t === "all") return e.all;
	if (e[t]) return e[t];
	let n = /^group(\d+)of\d+$/.exec(t)?.[1];
	return n ? Od(e, n) : "";
}
function Od(e, t) {
	let n = e.all.replace(/#000000/g, "#8f8f8f"), r = String(t).length, i = `<text x="8.925192" y="8.925193" text-anchor="middle" dominant-baseline="central" font-size="${r <= 1 ? 9 : Math.max(9 - (r - 1) * 1.5, 5)}" font-family="system-ui, sans-serif" font-weight="bold" fill="#000000">${t}</text>`;
	return n.replace("</svg>", `${i}</svg>`);
}
//#endregion
//#region src/lib/structure/structure-modifiers/base.js
var kd = class e {
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
function Ad(e, t) {
	return `${e}|${t}`;
}
function jd(e, t, n) {
	let r = e.split("|"), i = r[0], a = `${n.identitySymOpId}_555`;
	return r.length === 2 && (a = r[1]), Ad(i, n.combineSymmetryCodes(t, a));
}
//#endregion
//#region src/lib/structure/applied-symmetry.js
var Md = class e {
	constructor(e, t) {
		this.id = e, this.translation = [...t], this._updateKey();
	}
	_updateKey() {
		this.key = we(this.id, this.translation);
	}
	static fromString(t) {
		let { id: n, translation: r } = Ce(t);
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
}, Nd = /* @__PURE__ */ new Set([
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
]), Pd = 4, Fd = 1.6;
function Id(e) {
	return Nd.has(e) ? Bu[e] : void 0;
}
function Ld(e, t = e.bonds) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e.atoms) n.has(t.label) || n.set(t.label, t.atomType);
	return t.filter((e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > Pd) return !1;
		let t = n.get(e.atom1Label), r = n.get(e.atom2Label);
		if (t === void 0 || r === void 0) return !0;
		let i = Id(t), a = Id(r);
		return i === void 0 || a === void 0 || e.bondLength <= Fd * (i + a);
	});
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-fragment.js
function Rd(e, t) {
	return e < t ? `${e}->${t}` : `${t}->${e}`;
}
function zd(e, t, n) {
	return `${e}-${t}...${n}`;
}
var Bd = class {
	constructor(e, t) {
		this.groupIndex = e, this.appliedSymmetry = typeof t == "string" ? Md.fromString(t) : t;
	}
	isTranslationalDuplicateOf(e) {
		return this.groupIndex === e.groupIndex && this.appliedSymmetry.id === e.appliedSymmetry.id && (this.appliedSymmetry.translation[0] !== e.appliedSymmetry.translation[0] || this.appliedSymmetry.translation[1] !== e.appliedSymmetry.translation[1] || this.appliedSymmetry.translation[2] !== e.appliedSymmetry.translation[2]);
	}
	getSymmetryString() {
		return this.appliedSymmetry.toString();
	}
}, Vd = class {
	constructor(e, t, n, r) {
		this.originAtom = e.includes("|") ? e : Ad(e, "1_555"), this.targetAtom = t.includes("|") ? t : Ad(t, "1_555"), this.bondLength = n, this.bondLengthSU = r;
	}
}, Hd = class {
	constructor(e, t, n, r, i, a) {
		this.originIndex = e, this.originSymmetry = typeof t == "string" ? Md.fromString(t) : t, this.targetIndex = n, this.targetSymmetry = typeof r == "string" ? Md.fromString(r) : r, this.connectingBonds = i, this.creationOriginIndex = a;
	}
	getKey() {
		let e = this.originSymmetry.key, t = this.targetSymmetry.key;
		return this.originIndex === this.targetIndex ? e < t ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}` : this.originIndex < this.targetIndex ? `${this.originIndex}_${e}_${this.targetIndex}_${t}` : `${this.targetIndex}_${t}_${this.originIndex}_${e}`;
	}
};
function Ud(e, t, n) {
	let r = t.map(() => /* @__PURE__ */ new Map()), i = t.map(() => []);
	return e.bonds.filter((e) => e.atom2SiteSymmetry !== ".").forEach((e) => {
		let t = n.get(e.atom1Id) ?? n.get(e.atom1Label), a = e.atom2Id.split("|")[0], o = `${a}|1_555`, s = n.get(o) ?? n.get(a);
		if (t === void 0 || s === void 0) return;
		let c = `${t}->${s}@.@${e.atom2SiteSymmetry}`;
		if (r[t].has(c)) {
			let n = r[t].get(c);
			i[t][n].bonds.push(new Vd(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU));
		} else r[t].set(c, i[t].length), i[t].push({
			targetIndex: s,
			targetSymmetry: Md.fromString(e.atom2SiteSymmetry),
			bonds: [new Vd(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU)]
		});
	}), i;
}
function Wd(e, t) {
	let n = [], r = /* @__PURE__ */ new Set();
	return e.forEach((e, i) => {
		for (let a of e) {
			let e = new Hd(i, t, a.targetIndex, a.targetSymmetry, a.bonds, i), o = e.getKey();
			r.has(o) || (n.push(e), r.add(o));
		}
	}), {
		danglingConnections: n,
		processedConnections: r
	};
}
function Gd(e, t, n, r, i) {
	let a = [], o = [], s = new Bd(e.targetIndex, e.targetSymmetry), c = r[e.targetIndex];
	for (let r of c) {
		let s = (typeof r.targetSymmetry == "string" ? Md.fromString(r.targetSymmetry) : r.targetSymmetry).combine(e.targetSymmetry, t.symmetry), c = new Hd(e.targetIndex, e.targetSymmetry, r.targetIndex, s, r.bonds, e.creationOriginIndex), l = c.getKey();
		if (i.has(l)) continue;
		i.add(l);
		let u = new Bd(r.targetIndex, s);
		n[e.creationOriginIndex].some((e) => u.isTranslationalDuplicateOf(e)) ? o.push(c) : a.push(c);
	}
	return {
		newConnectedGroup: s,
		newDanglingConnections: a,
		foundTranslations: o
	};
}
function Kd(e, t) {
	let n = /* @__PURE__ */ new Map();
	t.forEach((e, t) => {
		e.atoms.forEach((e) => n.set(e.uniqueId, t));
	});
	let r = Md.fromString(e.symmetry.identitySymOpId + "_555"), i = Ud(e, t, n), { danglingConnections: a, processedConnections: o } = Wd(i, r), s = [], c = [], l = t.map(() => []);
	t.forEach((e, t) => {
		l[t].push(new Bd(t, r));
	});
	let u = 0, d = 0;
	for (; d < a.length;) {
		if (u++ > 1e4) {
			console.error("Max iterations reached in createConnectivity. Possible infinite loop orvery complex structure.");
			break;
		}
		let t = a[d++], n = Gd(t, e, l, i, o);
		l[t.creationOriginIndex].push(n.newConnectedGroup), a.push(...n.newDanglingConnections), c.push(...n.foundTranslations), s.push(t);
	}
	return d < a.length && console.warn(`Connectivity processing stopped due to iteration limit. ${a.length - d} connections remain unprocessed.`), {
		networkConnections: s,
		translationLinks: c,
		discoveredGroups: l
	};
}
function qd(e) {
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
function Jd(e, t, n, r) {
	let i = t.map((e) => [[...e.atoms]]), a = /* @__PURE__ */ new Map(), o = [];
	return e.forEach((e) => {
		let [a, o] = e.split("@.@");
		if (o === r) return;
		let s = Number(a), c = t[s].atoms, l = n.symmetry.applySymmetry(o, c), u = Md.fromString(o);
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
function Yd(e, t, n, r, i, a) {
	let o = [];
	e.forEach((e) => {
		o.push(...e.bonds);
	});
	let s = /* @__PURE__ */ new Set();
	return o.forEach((e) => {
		s.add(Rd(e.atom1Id, e.atom2Id));
	}), t.forEach((t) => {
		let [n, i] = t.split("@.@");
		i !== a && e[Number(n)].bonds.forEach((e) => {
			let t = e.atom1Id.split("|")[0], n = e.atom2Id.split("|")[0], a = Ad(t, i), c = Ad(n, i), l = r.get(a) || a, u = r.get(c) || c, d = Rd(l, u);
			s.has(d) || (s.add(d), o.push(new De(l, u, e.bondLength, e.bondLengthSU, ".")));
		});
	}), n.forEach((e) => {
		let t = e.originAtomId || e.originSymmAtom, n = e.targetAtomId || e.targetSymmAtom, i = t.split(/[|@]/)[0], c = n.split(/[|@]/)[0], l = e.originSymmetry || Md.fromString(t.split(/[|@]/)[1] || a), u = e.targetSymmetry || Md.fromString(n.split(/[|@]/)[1] || a), d = l.key === a ? Ad(i, a) : Ad(i, l.key), f = u.key === a ? Ad(c, a) : Ad(c, u.key), p = r.get(d) || d, m = r.get(f) || f, h = p.includes("|") ? p : Ad(p, a), g = m.includes("|") ? m : Ad(m, a), _ = Rd(h, g);
		s.has(_) || (s.add(_), o.push(new De(h, g, e.bondLength, e.bondLengthSU, ".")));
	}), {
		newBonds: o,
		atomLabels: new Set(i.map((e) => e.uniqueId))
	};
}
function Xd(e, t, n, r, i, a, o) {
	let s = [], c = /* @__PURE__ */ new Set();
	e.hBonds.forEach((e) => {
		let t;
		t = e.acceptorAtomSymmetry === "." || e.acceptorAtomSymmetry === o ? zd(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId) : `${zd(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId)}@${e.acceptorAtomSymmetry}`, c.has(t) || (c.add(t), s.push(e));
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
			let t = e.donorAtomId.split("|")[0], n = e.hydrogenAtomId.split("|")[0], r = e.acceptorAtomId.split("|")[0], a = Ad(t, u), o = Ad(n, u), l = Ad(r, u), d = i.get(a) || a, f = i.get(o) || o, p = i.get(l) || l, m = zd(d, f, p);
			c.has(m) || (c.add(m), s.push(new Oe(d, f, p, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".")));
		}), l[d].forEach((t) => {
			let n = t.donorAtomId.split("|")[0], r = t.hydrogenAtomId.split("|")[0], o = Ad(n, u), l = Ad(r, u), d = i.get(o) || o, f = i.get(l) || l, p = e.symmetry.combineSymmetryCodes(u, t.acceptorAtomSymmetry), m = t.acceptorAtomId.split("|")[0], h = Ad(m, p), g = i.get(h) || h, _, v;
			a.has(g) ? (_ = new Oe(d, f, g, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."), v = zd(d, f, g)) : (_ = new Oe(d, f, m, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, p), v = `${zd(d, f, m)}@${p}`), c.has(v) || (c.add(v), s.push(_));
		});
	}), s;
}
function Zd(e, t, n, r) {
	let i = [];
	return e.forEach((e) => {
		for (let t of e.connectingBonds) {
			let a = t.originAtom.split("|")[0], o = t.targetAtom.split("|")[0], s = Ad(a, e.originSymmetry.key), c = Ad(o, e.targetSymmetry.key), l = n.get(s) || s, u = n.get(c) || c, d = u.split("|")[1] || e.targetSymmetry.key, f = Rd(l, u);
			r.has(f) || (r.add(f), i.push(new De(l, u, t.bondLength, t.bondLengthSU, d)));
		}
	}), i;
}
function Qd(e) {
	let t = new Ne(e.cell, e.atoms, Ld(e), e.hBonds, e.symmetry), n = t.calculateConnectedGroups(), r = /* @__PURE__ */ new Map();
	n.forEach((e, t) => {
		e.atoms.forEach((e) => {
			r.set(e.uniqueId, t);
		});
	});
	let i = e.symmetry.identitySymOpId + "_555", { networkConnections: a, translationLinks: o } = Kd(t, n), { requiredSymmetryInstances: s, interGroupBonds: c } = qd(a, e, i), { specialPositionAtoms: l, newAtoms: u } = Jd(s, n, t, i), { newBonds: d, atomLabels: f } = Yd(n, s, c, l, u, i), p = Xd(t, n, r, s, l, f, i), m = Zd(o, t, l, new Set(d.map((e) => Rd(e.atom1Id, e.atom2Id))));
	for (let e of m) d.push(e);
	return {
		grownStructure: new Ne(t.cell, [...t.atoms, ...u], d, p, t.symmetry),
		specialPositionAtoms: l
	};
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-cell.js
var $d = 4;
function ef(e, t) {
	let n = /* @__PURE__ */ new Set([e.identitySymOpId]), r = /* @__PURE__ */ new Set();
	for (let n of t) {
		let t = e.combineSymmetryCodes(n + "_555", e.identitySymOpId + "_555");
		r.add(t.split("_")[0]);
	}
	for (let [t] of e.operationIds) n.has(t) || r.has(t) || n.add(t);
	return n;
}
function tf(e) {
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
function nf(e) {
	let t = tf(e);
	return A([
		(t.minX + t.maxX) / 2,
		(t.minY + t.maxY) / 2,
		(t.minZ + t.maxZ) / 2
	]);
}
function rf(e, t, n) {
	let r = t.symmetry.identitySymOpId, i = /* @__PURE__ */ new Set();
	for (let t of e.atoms) t.appliedSymmetry ? i.add(t.appliedSymmetry.id) : i.add(r);
	let a = new Set(e.atoms.map((e) => e.uniqueId));
	for (let [e, t] of n) {
		let n = r;
		e.includes("|") && (n = e.split("|")[1].split("_")[0]), a.has(t) && i.add(n);
	}
	return Array.from(i);
}
function af(e, t = 1e-6) {
	let { x: n, y: r, z: i } = e.position;
	return n >= -t && n < 1 - t && r >= -t && r < 1 - t && i >= -t && i < 1 - t;
}
function of(e, t = 3) {
	let n = e.position.x.toFixed(t), r = e.position.y.toFixed(t), i = e.position.z.toFixed(t);
	return `${e.label}_x${n}_y${r}_z${i}`;
}
function sf(e, t, n) {
	let { symOp: r, transVector: i } = e.parsePositionCode(t), a = ee(ee(j(r.rotMatrix, A(n)), r.transVector), i), o = Math.floor(a.get([0])), s = Math.floor(a.get([1])), c = Math.floor(a.get([2])), l = t.split("_")[0], u = (t.split("_")[1] || "555").split("").map((e) => parseInt(e, 10)), d = `${u[0] - o}${u[1] - s}${u[2] - c}`;
	return {
		newCentre: M(a, A([
			o,
			s,
			c
		])),
		newString: `${l}_${d}`
	};
}
function cf(e, t, n, r, i) {
	let a = [], o = t.applySymmetry(n, e.atoms);
	for (let s = 0; s < o.length; s++) {
		let c = o[s], l = e.atoms[s], u = n;
		l.appliedSymmetry && l.appliedSymmetry.key !== `${t.identitySymOpId}_555` && (u = t.combineSymmetryCodes(n, l.appliedSymmetry.key)), c.appliedSymmetry = Md.fromString(u);
		let d = c.uniqueId;
		if (i && !af(c)) {
			let e = Math.floor(c.position.x), n = Math.floor(c.position.y), i = Math.floor(c.position.z);
			c.position.x -= e, c.position.y -= n, c.position.z -= i, c.appliedSymmetry.translation[0] -= e, c.appliedSymmetry.translation[1] -= n, c.appliedSymmetry.translation[2] -= i, c.appliedSymmetry._updateKey();
			let a = c.uniqueId, o = `${t.identitySymOpId}_${5 - e}${5 - n}${5 - i}`;
			r.atomTranslations.set(d, [a, o]);
		}
		let f = c.uniqueId, p = of(c), m = r.atomMap.get(p);
		m ? r.specialPositionMap.set(f, m) : (r.atomMap.set(p, f), a.push(c));
	}
	return a;
}
function lf(e, t, n, r) {
	let i = [];
	for (let a of e.internalBonds) {
		let e = jd(a.atom1Id, n, t), o = r.specialPositionMap.get(e) || e, s = jd(a.atom2Id, n, t), c = r.specialPositionMap.get(s) || s;
		if (o !== c) {
			if (!r.atomTranslations.has(o) && !r.atomTranslations.has(c)) {
				let e = Rd(o, c);
				if (!r.createdBonds.has(e)) {
					let t = new De(o, c, a.bondLength, a.bondLengthSU, ".");
					i.push(t), r.createdBonds.add(e);
				}
			} else if (r.atomTranslations.has(o) && r.atomTranslations.has(c)) {
				let [e, t] = r.atomTranslations.get(o), [n, s] = r.atomTranslations.get(c);
				if (t === s) {
					let t = Rd(e, n);
					if (!r.createdBonds.has(t)) {
						let o = new De(e, n, a.bondLength, a.bondLengthSU, ".");
						i.push(o), r.createdBonds.add(t);
					}
				}
			}
		}
	}
	return i;
}
function uf(e, t, n, r) {
	let i = [];
	for (let a of e.internalHBonds) {
		let e = r.specialPositionMap.get(jd(a.donorAtomId, n, t)) || jd(a.donorAtomId, n, t), o = r.specialPositionMap.get(jd(a.hydrogenAtomId, n, t)) || jd(a.hydrogenAtomId, n, t), s;
		if (a.acceptorAtomSymmetry && a.acceptorAtomSymmetry !== ".") {
			let e = `${a.acceptorAtomId.split("|")[0]}|${t.combineSymmetryCodes(n, a.acceptorAtomSymmetry)}`;
			s = r.specialPositionMap.get(e) || e;
		} else s = r.specialPositionMap.get(jd(a.acceptorAtomId, n, t)) || jd(a.acceptorAtomId, n, t);
		if (!r.atomTranslations.has(e) && !r.atomTranslations.has(o) && !r.atomTranslations.has(s)) {
			let t = zd(e, o, s);
			if (!r.createdHBonds.has(t)) {
				let n = new Oe(e, o, s, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
				r.createdHBonds.add(t), i.push(n);
			}
		} else if (r.atomTranslations.has(e) && r.atomTranslations.has(o) && r.atomTranslations.has(s)) {
			let [t, n] = r.atomTranslations.get(e), [c, l] = r.atomTranslations.get(o), [u, d] = r.atomTranslations.get(s);
			if (n === l && l === d) {
				let e = zd(t, c, u);
				if (!r.createdHBonds.has(e)) {
					let n = new Oe(t, c, u, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, ".");
					r.createdHBonds.add(e), i.push(n);
				}
			}
		}
	}
	return i;
}
function df(e, t, n, r) {
	let i = [];
	for (let a of e.externalBonds) {
		let e = r.specialPositionMap.get(jd(a.atom1Id, n, t)) || jd(a.atom1Id, n, t), o = t.combineSymmetryCodes(n, a.atom2SiteSymmetry), s = a.atom2Id.split("|")[0];
		if (r.atomTranslations.has(e)) {
			let n;
			[e, n] = r.atomTranslations.get(e), o = t.combineSymmetryCodes(n, o);
		}
		let c = `${s}|${o}`;
		c = r.specialPositionMap.get(c) || c;
		let l = Rd(e, c);
		if (!r.createdBonds.has(l)) {
			let t = new De(e, c, a.bondLength, a.bondLengthSU, o);
			i.push(t), r.createdBonds.add(l);
		}
	}
	return i;
}
function ff(e, t, n, r) {
	let i = [];
	for (let a of e.externalHBonds) {
		let e = r.specialPositionMap.get(jd(a.donorAtomId, n, t)) || jd(a.donorAtomId, n, t), o = r.specialPositionMap.get(jd(a.hydrogenAtomId, n, t)) || jd(a.hydrogenAtomId, n, t), s = t.combineSymmetryCodes(n, a.acceptorAtomSymmetry);
		if (r.atomTranslations.has(e) && r.atomTranslations.has(o)) {
			let n;
			[e, n] = r.atomTranslations.get(e);
			let [i, a] = r.atomTranslations.get(o);
			if (n !== a) continue;
			o = i, s = t.combineSymmetryCodes(n, s);
		} else if (r.atomTranslations.has(e) || r.atomTranslations.has(o)) continue;
		let c = `${a.acceptorAtomId.split("|")[0]}|${s}`;
		if (e.split("|")[1] === s) continue;
		let l = zd(e, o, c);
		if (!r.createdHBonds.has(l)) {
			let t = new Oe(e, o, c, a.donorHydrogenDistance, a.donorHydrogenDistanceSU, a.acceptorHydrogenDistance, a.acceptorHydrogenDistanceSU, a.donorAcceptorDistance, a.donorAcceptorDistanceSU, a.hBondAngle, a.hBondAngleSU, s);
			i.push(t), r.createdHBonds.add(l);
		}
	}
	return i;
}
function pf(e, t, n, r, i) {
	let { newCentre: a, newString: o } = sf(t, t.combineSymmetryCodes(n, e.symmString), e.groupCentre);
	return {
		atoms: cf(e, t, o, r, i),
		internalBonds: lf(e, t, o, r),
		internalHBonds: uf(e, t, o, r),
		externalBonds: df(e, t, o, r),
		externalHBonds: ff(e, t, o, r),
		symmString: o,
		groupCentre: a
	};
}
function mf(e, t = !0, n = null) {
	let r;
	if (r = n === null ? /* @__PURE__ */ new Map() : n, e.atoms.length === 0) return new Ne(e.cell, [], [], [], e.symmetry);
	let i = e.calculateConnectedGroups(), a = i.map((t) => {
		let n = rf(t, e, r);
		return Array.from(ef(e.symmetry, n));
	}), o = i.map((t) => e.bonds.filter((e) => e.atom2SiteSymmetry && e.atom2SiteSymmetry !== "." && t.atoms.some((t) => t.label === e.atom1Id.split("|")[0]))), s = i.map((t) => e.hBonds.filter((e) => e.acceptorAtomSymmetry && e.acceptorAtomSymmetry !== "." && t.atoms.some((t) => t.label === e.donorAtomId.split("|")[0]))), c = {
		atomMap: /* @__PURE__ */ new Map(),
		createdBonds: /* @__PURE__ */ new Set(),
		createdHBonds: /* @__PURE__ */ new Set(),
		specialPositionMap: r,
		atomTranslations: /* @__PURE__ */ new Map()
	}, l = [];
	for (let n = 0; n < i.length; n++) {
		let r = i[n], u = a[n], d = nf(r.atoms), f = u[0], p = {
			atoms: r.atoms,
			internalBonds: r.bonds,
			internalHBonds: r.hBonds,
			symmString: `${f}_555`,
			groupCentre: d,
			externalBonds: o[n],
			externalHBonds: s[n]
		};
		for (let n of u) {
			let r = `${n}_555`, i = pf(p, e.symmetry, r, c, t);
			l.push(i);
		}
	}
	let u = [...t ? [] : e.symmetry.applySymmetry(`${e.symmetry.identitySymOpId}_555`, e.atoms).map((t, n) => (t.appliedSymmetry = e.atoms[n].appliedSymmetry?.copy() || null, t)), ...l.flatMap((e) => e.atoms)], d = /* @__PURE__ */ new Map();
	for (let e of u) d.has(e.uniqueId) || d.set(e.uniqueId, e);
	let f = Array.from(d.values()), p = [...t ? [] : e.bonds.map((e) => new De(e.atom1Id, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry)), ...l.flatMap((e) => e.internalBonds)], m = [...t ? [] : e.hBonds.map((e) => new Oe(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry)), ...l.flatMap((e) => e.internalHBonds)], h = new Set(f.map((e) => e.uniqueId));
	l.forEach((e) => {
		e.externalBonds.forEach((e) => {
			let t = c.specialPositionMap.get(e.atom1Id) || e.atom1Id;
			c.atomTranslations.has(t) && ([t] = c.atomTranslations.get(t));
			let n = c.specialPositionMap.get(e.atom2Id) || e.atom2Id;
			if (c.atomTranslations.has(n) && ([n] = c.atomTranslations.get(n)), h.has(t) && h.has(n) && t !== n) {
				let r = new De(t, n, e.bondLength, e.bondLengthSU, ".");
				p.push(r);
			} else if (h.has(t)) {
				let n = new De(t, e.atom2Id, e.bondLength, e.bondLengthSU, e.atom2SiteSymmetry);
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
				let t = new Oe(n, i, a, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, ".");
				m.push(t);
			} else if (h.has(n) && h.has(i)) {
				let t = new Oe(n, i, e.acceptorAtomId, e.donorHydrogenDistance, e.donorHydrogenDistanceSU, e.acceptorHydrogenDistance, e.acceptorHydrogenDistanceSU, e.donorAcceptorDistance, e.donorAcceptorDistanceSU, e.hBondAngle, e.hBondAngleSU, e.acceptorAtomSymmetry);
				m.push(t);
			}
		});
	});
	let g = new Map(f.map((e) => [e.uniqueId, e])), _ = /* @__PURE__ */ new Map(), v = (t) => {
		let n = _.get(t.uniqueId);
		return n || (n = t.position.toCartesian(e.cell), _.set(t.uniqueId, n)), n;
	}, y = (e) => {
		if (!Number.isFinite(e.bondLength)) return !0;
		if (e.bondLength > $d) return !1;
		let t = g.get(e.atom1Id), n = g.get(e.atom2Id);
		if (!t || !n) return e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		let r = v(t), i = v(n), a = Math.hypot(r.x - i.x, r.y - i.y, r.z - i.z), o = Math.max(.15, e.bondLength * .1);
		return a <= e.bondLength + o;
	}, b = p.filter((e) => {
		let t = h.has(e.atom1Id), n = e.atom2SiteSymmetry && e.atom2SiteSymmetry !== ".";
		return t && (h.has(e.atom2Id) || n) && y(e);
	}), x = m.filter((e) => h.has(e.donorAtomId) && h.has(e.hydrogenAtomId)), S = b, C = new Ne(e.cell, f, S, x, e.symmetry), w = /* @__PURE__ */ new Map();
	for (let e of C.calculateConnectedGroups()) {
		let t = nf(e.atoms).toArray().map((e) => Math.floor(e));
		for (let n of e.atoms) {
			let e = n.uniqueId;
			n.position.x -= t[0], n.position.y -= t[1], n.position.z -= t[2], n.appliedSymmetry && (n.appliedSymmetry.translation[0] -= t[0], n.appliedSymmetry.translation[1] -= t[1], n.appliedSymmetry.translation[2] -= t[2], n.appliedSymmetry._updateKey()), w.set(e, n.uniqueId);
		}
	}
	let T = [], E = /* @__PURE__ */ new Map(), D = /* @__PURE__ */ new Map(), O = /* @__PURE__ */ new Map();
	for (let e of f) {
		let t = of(e), n = D.get(e.uniqueId) || E.get(t);
		n ? O.set(e.uniqueId, n) : (E.set(t, e.uniqueId), D.set(e.uniqueId, e.uniqueId), T.push(e));
	}
	for (let [e, t] of w) w.set(e, O.get(t) || t);
	let k = [], A = /* @__PURE__ */ new Set();
	for (let e of b) {
		let t = w.get(e.atom1Id) || e.atom1Id, n = w.get(e.atom2Id) || e.atom2Id;
		if (t === n) continue;
		let r = Rd(t, n);
		A.has(r) || (e.atom1Id = t, e.atom2Id = n, k.push(e), A.add(r));
	}
	let j = [], ee = /* @__PURE__ */ new Set();
	for (let e of x) {
		e.donorAtomId = w.get(e.donorAtomId) || e.donorAtomId, e.hydrogenAtomId = w.get(e.hydrogenAtomId) || e.hydrogenAtomId, e.acceptorAtomId = w.get(e.acceptorAtomId) || e.acceptorAtomId;
		let t = zd(e.donorAtomId, e.hydrogenAtomId, e.acceptorAtomId);
		ee.has(t) || (j.push(e), ee.add(t));
	}
	return new Ne(e.cell, T, k, j, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/growing/grow-hbonds.js
function hf(e, t) {
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
function gf(e) {
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
		s.has(m) || (s.add(m), o.push(new Oe(u.donor.uniqueId, u.hydrogen.uniqueId, u.acceptor.uniqueId, i.donorHydrogenDistance, i.donorHydrogenDistanceSU, i.acceptorHydrogenDistance, i.acceptorHydrogenDistanceSU, i.donorAcceptorDistance, i.donorAcceptorDistanceSU, i.hBondAngle, i.hBondAngleSU, ".")));
	}
	return new Ne(e.cell, e.atoms, e.bonds, o, e.symmetry);
}
function _f(e, t = /* @__PURE__ */ new Map()) {
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
			r.appliedSymmetry && r.appliedSymmetry.key !== `${e.symmetry.identitySymOpId}_555` && (a = e.symmetry.combineSymmetryCodes(i, r.appliedSymmetry.key)), n.appliedSymmetry = Md.fromString(a), d.has(n.uniqueId) || (l.push(n), d.add(n.uniqueId));
		}
		o.bonds.filter(({ atom2SiteSymmetry: e }) => e === ".").forEach((t) => {
			u.push(new De(jd(t.atom1Id, i, e.symmetry), jd(t.atom2Id, i, e.symmetry), t.bondLength, t.bondLengthSU, "."));
		}), [...o.hBonds, ...s[t]].forEach((t) => {
			if (t.acceptorAtomSymmetry === ".") {
				m(new Oe(r(jd(t.donorAtomId, i, e.symmetry)), r(jd(t.hydrogenAtomId, i, e.symmetry)), r(jd(t.acceptorAtomId, i, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
				return;
			}
			p.push(new Oe(r(jd(t.donorAtomId, i, e.symmetry)), r(jd(t.hydrogenAtomId, i, e.symmetry)), r(jd(t.acceptorAtomId, i, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		});
	};
	for (let t of i) {
		let i = t.acceptorAtomId.split("|")[0], a = t.acceptorAtomId.split("|")[0], o = n.findIndex((e) => e.atoms.some((e) => e.label === a));
		if (o === -1) throw Error(`Cannot grow H-bond: acceptor atom ${a} is not in the structure`);
		m(new Oe(r(t.donorAtomId), r(t.hydrogenAtomId), r(jd(i, t.acceptorAtomSymmetry, e.symmetry)), t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
		let s = t.acceptorAtomSymmetry;
		h(o, s);
		let c = n.findIndex((e) => e.atoms.some((e) => e.uniqueId === t.donorAtomId));
		if (c === -1) throw Error(`Cannot grow reciprocal H-bond: donor atom ${t.donorAtomId} is not in the structure`);
		let l = e.symmetry.invertPositionCode(s);
		h(c, l), m(new Oe(r(jd(t.donorAtomId, l, e.symmetry)), r(jd(t.hydrogenAtomId, l, e.symmetry)), `${i}|${e.symmetry.identitySymOpId}_555`, t.donorHydrogenDistance, t.donorHydrogenDistanceSU, t.acceptorHydrogenDistance, t.acceptorHydrogenDistanceSU, t.donorAcceptorDistance, t.donorAcceptorDistanceSU, t.hBondAngle, t.hBondAngleSU, "."));
	}
	for (let e of p) d.has(e.donorAtomId) && d.has(e.hydrogenAtomId) && d.has(e.acceptorAtomId) && m(e);
	return new Ne(e.cell, l, u, a, e.symmetry);
}
//#endregion
//#region src/lib/structure/structure-modifiers/modes.js
var vf = class e extends kd {
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
		let n = t.atoms.filter((t) => t.atomType !== "H" || this.mode !== e.MODES.NONE).map((t) => new Fe(t.label, t.atomType, t.position, t.atomType === "H" && this.mode === e.MODES.CONSTANT ? null : t.adp, t.disorderGroup, t.appliedSymmetry)), r = t.bonds.filter((n) => {
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
		return new Ne(t.cell, n, r, i, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [e.MODES.NONE];
		return t.atoms.some((e) => e.atomType === "H") ? (n.push(e.MODES.CONSTANT), t.atoms.some((e) => e.atomType === "H" && e.adp instanceof xe) && n.push(e.MODES.ANISOTROPIC), n) : n;
	}
}, yf = class e extends kd {
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
		return new Ne(t.cell, o, s, c, t.symmetry);
	}
	getApplicableModes(t) {
		let n = [...new Set(t.atoms.map((e) => Number(e.disorderGroup)).filter((e) => e > 0))].sort((e, t) => e - t);
		this._groupValuesByRank = n;
		let r = { ALL: e.MODES.ALL };
		return n.forEach((t, i) => {
			r[`GROUP${i + 1}`] = e.modeForGroup(i + 1, n.length);
		}), this.MODES = Object.freeze(r), Object.values(this.MODES);
	}
}, bf = class e extends kd {
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
		let n = this.mode === e.MODES.NONE ? t : new Ne(t.cell, t.atoms, Ld(t), t.hBonds, t.symmetry), r = /* @__PURE__ */ new Map();
		if (this.mode === e.MODES.FRAGMENT || this.mode === e.MODES.FRAGMENT_HBONDS) {
			let e = Qd(n);
			n = e.grownStructure, r = e.specialPositionAtoms;
		}
		if (this.mode === e.MODES.CELL) n = mf(n);
		else if (this.mode === e.MODES.FRAGMENT_CELL) {
			let e = Qd(n);
			r = e.specialPositionAtoms, n = mf(e.grownStructure, !1, r), n = gf(n);
		}
		return (this.mode === e.MODES.HBONDS || this.mode === e.MODES.FRAGMENT_HBONDS) && (this.mode === e.MODES.FRAGMENT_HBONDS && (n = new Ne(n.cell, n.atoms, hf(n, n.bonds), n.hBonds, n.symmetry)), n = _f(n, r), this.mode === e.MODES.FRAGMENT_HBONDS && (n = new Ne(n.cell, n.atoms, hf(n, n.bonds), n.hBonds, n.symmetry), n = gf(n))), n;
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
}, xf = class e extends kd {
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
		return new Ne(t.cell, r, i, a, t.symmetry);
	}
	getApplicableModes() {
		return Object.values(e.MODES);
	}
}, Sf = class e extends kd {
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
		return Vu.has(e) || Vu.has(t) ? Math.min(this.tolerance, .4) : this.tolerance;
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
				o.set(e.atomType, je(e.atomType));
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
					if ((r.atomType === "H" || u.atomType === "H") && (s.has(r.uniqueId) || s.has(u.uniqueId)) || !Ie(r, u)) continue;
					let d = a.get(u.uniqueId), f = c[0] - d[0], p = c[1] - d[1], m = c[2] - d[2], h = this.getMaxBondDistance(o.get(r.atomType), o.get(u.atomType), t);
					if (Math.abs(f) > h || Math.abs(p) > h || Math.abs(m) > h) continue;
					let g = re([
						f,
						p,
						m
					]);
					g <= h && g > 1e-4 && n.add(new De(r.uniqueId, u.uniqueId, g, null, "."));
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
		return new Ne(t.cell, t.atoms, n, t.hBonds, t.symmetry);
	}
	getApplicableModes(t) {
		return t.bonds.length > 0 ? [
			e.MODES.KEEP,
			e.MODES.ADD,
			e.MODES.REPLACE
		] : [e.MODES.CREATE, e.MODES.IGNORE];
	}
}, Cf = class e extends kd {
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
		return new Ne(t.cell, t.atoms, [...t.bonds, ...r], t.hBonds, t.symmetry);
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
				if (i.atomType !== "H" && Ie(i, t)) {
					let r = i.position.toCartesian(e.cell), o = re(M(a, [
						r.x,
						r.y,
						r.z
					]));
					if (o <= this.maxBondDistance) {
						n.push(new De(i.uniqueId, t.uniqueId, o, null, "."));
						return;
					}
				}
			}
			let o = !1;
			for (let i = r - 1; i >= 0 && !o; i--) {
				let r = e.atoms[i];
				if (r.atomType === "H" || !Ie(r, t)) continue;
				let s = r.position.toCartesian(e.cell), c = re(M(a, [
					s.x,
					s.y,
					s.z
				]));
				c <= this.maxBondDistance && (n.push(new De(r.uniqueId, t.uniqueId, c, null, ".")), o = !0);
			}
			if (!o && r < e.atoms.length - 1) for (let i = r + 1; i < e.atoms.length && !o; i++) {
				let r = e.atoms[i];
				if (r.atomType === "H" || !(r.disorderGroup === t.disorderGroup || r.disorderGroup === 0 || t.disorderGroup === 0)) continue;
				let s = r.position.toCartesian(e.cell), c = re(M(a, [
					s.x,
					s.y,
					s.z
				]));
				c <= this.maxBondDistance && (n.push(new De(r.uniqueId, t.uniqueId, c, null, ".")), o = !0);
			}
		}), n;
	}
	getApplicableModes(t) {
		return t.bonds.length === 0 ? [e.MODES.OFF] : this.findIsolatedHydrogenAtoms(t).length > 0 ? [e.MODES.ON] : [e.MODES.OFF];
	}
};
//#endregion
//#region src/lib/ortep3d/staging.js
function wf(e) {
	let t = new W();
	e.forEach((e) => t.add(e)), t.divideScalar(e.length);
	let n = new G(), r = new W();
	e.forEach((e) => {
		r.copy(e).sub(t), n.elements[0] += r.x * r.x, n.elements[1] += r.x * r.y, n.elements[2] += r.x * r.z, n.elements[3] += r.y * r.x, n.elements[4] += r.y * r.y, n.elements[5] += r.y * r.z, n.elements[6] += r.z * r.x, n.elements[7] += r.z * r.y, n.elements[8] += r.z * r.z;
	});
	let { values: i, eigenvectors: a } = de(Tf(n)), o = le(i);
	if (o <= 0) return console.warn("Could not find a mean plane, expected?"), new W(0, 1, 0);
	let s = a.filter((e) => e.value === o)[0].vector, c = new W(...s.toArray());
	return c.normalize(), c;
}
function Tf(e) {
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
function Ef(e) {
	let t = [], n = new W();
	if (e.traverse((e) => {
		e.userData?.type === "atom" && (t.push(e.position.clone()), n.add(e.position));
	}), t.length === 0) return null;
	n.divideScalar(t.length);
	let r = t.map((e) => e.sub(n)), i = wf(r), a = new W(0, 0, 1), o = new Xn();
	o.setFromUnitVectors(i, a);
	let s = new q();
	s.makeRotationFromQuaternion(o);
	let c = r.map((e) => e.clone().applyMatrix4(s)), l = 0, u = 0;
	c.forEach((e, t) => {
		let n = Math.sqrt(e.x * e.x + e.y * e.y);
		n > l && (l = n, u = t);
	});
	let d = new U(c[u].x, c[u].y);
	d.x < 0 && d.multiplyScalar(-1);
	let f = -Math.atan2(d.y, d.x), p = new q().makeRotationZ(f);
	return s.premultiply(p), s.premultiply(new q().makeRotationX(Math.PI / 8)), s.premultiply(new q().makeRotationY(Math.PI / 48)), s;
}
function Df(e, t) {
	e.children = e.children.filter((e) => !(e instanceof Fo));
	let n = 6;
	t.traverse((e) => {
		e.userData?.type === "atom" && e.position.length() > n && (n = e.position.length());
	});
	let r = n * 2, i = new $o(16777215, 1);
	e.add(i);
	let a = new Yo(16777215, 1e3, 0, Math.PI * .27, .6);
	a.position.set(0, -.5, r * 2), a.lookAt(new W(0, 0, 0)), e.add(a), [
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
	].forEach(({ pos: t, intensity: n }) => {
		let i = new Qo(16777215, n);
		i.position.set(t[0] * r, t[1] * r, t[2] * r), i.lookAt(new W(0, 0, 0)), e.add(i);
	});
}
//#endregion
//#region src/lib/ortep3d/viewer-controls.js
var Of = class {
	constructor(e) {
		this.viewer = e, this.state = {
			isDragging: !1,
			isPanning: !1,
			mouse: new U(),
			lastClickTime: 0,
			clickStartTime: 0,
			pinchStartDistance: 0,
			lastTouchRotation: 0,
			lastRightClickTime: 0,
			twoFingerStartPos: new U(),
			initialCameraPosition: e.camera.position.clone()
		};
		let { container: t, camera: n, renderer: r, moleculeContainer: i, options: a } = e;
		this.container = t, this.camera = n, this.renderer = r, this.moleculeContainer = i, this.options = a, this.doubleClickDelay = 300, this.raycaster = new _s(), this.raycaster.near = .1, this.raycaster.far = 100, this.bindEventHandlers(), this.setupEventListeners();
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
	clientToMouseCoordinates(e, t) {
		let n = this.container.getBoundingClientRect();
		return new U((e - n.left) / n.width * 2 - 1, -((t - n.top) / n.height) * 2 + 1);
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
	rotateStructure(e) {
		let t = this.options.interaction.rotationSpeed, n = new W(1, 0, 0), r = new W(0, 1, 0);
		this.moleculeContainer.applyMatrix4(new q().makeRotationAxis(r, e.x * t)), this.moleculeContainer.applyMatrix4(new q().makeRotationAxis(n, -e.y * t)), this.viewer.requestRender();
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
	handleTouchMove(e) {
		e.preventDefault();
		let t = e.touches;
		if (t.length === 1 && this.state.isDragging) {
			let e = t[0], n = this.clientToMouseCoordinates(e.clientX, e.clientY), r = new U(n.x - this.state.mouse.x, n.y - this.state.mouse.y);
			this.rotateStructure(r), this.state.mouse.set(n.x, n.y);
		} else if (t.length === 2) {
			let e = t[0].clientX - t[1].clientX, n = t[0].clientY - t[1].clientY, r = Math.hypot(e, n);
			if (!this.state.pinchStartDistance) {
				this.state.pinchStartDistance = r;
				let e = this.clientToMouseCoordinates((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
				this.state.twoFingerStartPos.copy(e);
				return;
			}
			this.handleZoom((this.state.pinchStartDistance - r) * this.options.camera.pinchZoomSpeed), this.state.pinchStartDistance = r;
			let i = this.clientToMouseCoordinates((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2), a = i.clone().sub(this.state.twoFingerStartPos);
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
	handleMouseMove(e) {
		if (!this.state.isDragging && !this.state.isPanning) return;
		let t = this.container.getBoundingClientRect(), n = new U((e.clientX - t.left) / t.width * 2 - 1, -((e.clientY - t.top) / t.height) * 2 + 1), r = n.clone().sub(this.state.mouse);
		this.state.isPanning ? this.panCamera(r) : this.rotateStructure(r), this.state.mouse.copy(n);
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
}, kf = class e {
	constructor(t, n) {
		if (new.target === e) throw Error("AbstractCamera is an abstract class and cannot be instantiated directly");
		this.container = t, this.options = n, this.cameraTarget = new W(0, 0, 0), this.createCamera();
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
}, Af = class extends kf {
	createCamera() {
		return this.camera = new qo(this.options.fov, this.container.clientWidth / this.container.clientHeight, this.options.near, this.options.far), this.camera.position.copy(this.options.initialPosition), this.camera.lookAt(this.cameraTarget), this.camera;
	}
	fitToStructure(e) {
		let t = new mi().setFromObject(e);
		if (t.isEmpty()) return;
		let n = new W();
		t.getSize(n);
		let r = this.options.fov * Math.PI / 180, i = this.container.clientWidth / this.container.clientHeight, a = Math.atan(i * Math.tan(r / 2) * 2), o = n.x / n.y, s;
		s = o <= i ? n.y / 2 / Math.tan(r / 2) + n.z / 2 : n.x / 2 / Math.tan(a / 2) + n.z / 2, this.camera.position.set(0, 0, s), this.camera.lookAt(this.cameraTarget), this.options.minDistance = s * .2, this.options.maxDistance = s * 2, this.basePosition = new W(0, 0, s);
	}
	zoom(e) {
		let { minDistance: t, maxDistance: n } = this.options, r = n - t, i = this.camera.position.length(), a = Yn.clamp(i + e * r, t, n), o = this.camera.position.clone().normalize();
		this.camera.position.copy(o.multiplyScalar(a));
	}
	pan(e) {
		let t = this.camera.position.z, n = this.options.fov * Math.PI / 180, r = Math.tan(n / 2) * t, i = r * this.camera.aspect, a = -e.x * i, o = -e.y * r, s = new W(), c = new W();
		this.camera.matrix.extractBasis(s, c, new W()), this.camera.position.addScaledVector(s, a), this.camera.position.addScaledVector(c, o);
	}
	handleResize() {
		let e = this.container.clientWidth / this.container.clientHeight;
		this.camera.aspect = e;
		let t = this.options.fov;
		this.container.clientWidth < this.container.clientHeight ? this.camera.fov = 2 * Math.atan(Math.tan(t * Math.PI / 360) / e) * 180 / Math.PI : this.camera.fov = t, this.camera.updateProjectionMatrix();
	}
}, jf = class extends kf {
	createCamera() {
		let e = this.container.clientWidth / this.container.clientHeight, t = this.options.orthoSize || 5;
		return this.camera = new Xo(-t * e, t * e, t, -t, this.options.near, this.options.far), this.camera.position.copy(this.options.initialPosition), this.camera.lookAt(this.cameraTarget), this.camera;
	}
	fitToStructure(e) {
		let t = new mi().setFromObject(e);
		if (t.isEmpty()) return;
		let n = new W();
		t.getSize(n);
		let r = this.container.clientWidth / this.container.clientHeight, i = n.x / n.y, a;
		a = i <= r ? n.y / 2 : n.x / (2 * r), a *= 1.05, this.setOrthoSize(a), this.camera.updateProjectionMatrix(), this.options.minSize = a * .2, this.options.maxSize = a * 2, this.baseSize = a, this.basePosition = new W(0, 0, Math.max(n.x, n.y)), this.camera.position.set(this.basePosition.x, this.basePosition.y, this.basePosition.z);
	}
	zoom(e) {
		let { minDistance: t, maxDistance: n } = this.options, r = n - t, { minSize: i, maxSize: a } = this.options, o = 1 + e * this.options.wheelZoomSpeed * r * 50, s = Yn.clamp(this.camera.top * o, i, a);
		this.setOrthoSize(s), this.camera.updateProjectionMatrix();
	}
	pan(e) {
		let t = this.camera.top, n = this.camera.right / this.camera.top, r = -e.x * t * n, i = -e.y * t, a = new W(), o = new W();
		this.camera.matrix.extractBasis(a, o, new W()), this.camera.position.addScaledVector(a, r), this.camera.position.addScaledVector(o, i);
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
function Mf(e, t) {
	switch ((t.camera?.type || "perspective").toLowerCase()) {
		case "orthographic": return new jf(e, t.camera);
		default: return new Af(e, t.camera);
	}
}
//#endregion
//#region src/lib/ortep3d/cell3d.js
function Nf(e, t, n, r, i) {
	let a = e.clone().normalize(), o = e.length() - n, s = new X(new Za(i, i, o, 8), new ra({ color: t })), c = new X(new Qa(r, n, 8), new ra({ color: t })), l = new W(0, 1, 0), u = new Xn();
	u.setFromUnitVectors(l, a), s.applyQuaternion(u), c.applyQuaternion(u), s.position.copy(a.clone().multiplyScalar(o / 2)), c.position.copy(a.clone().multiplyScalar(o + n / 2));
	let d = new Gr();
	return d.add(s), d.add(c), d;
}
function Pf(e, t, n, r) {
	let i = new Gr(), a = [
		new W(0, 0, 0),
		new W(1, 0, 0),
		new W(0, 1, 0),
		new W(0, 0, 1),
		new W(1, 1, 0),
		new W(1, 0, 1),
		new W(0, 1, 1),
		new W(1, 1, 1)
	].map((t) => t.clone().applyMatrix4(e)), o = [
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
	], s = new Fa({
		color: t,
		transparent: n < 1,
		opacity: n,
		linewidth: 1 * r
	});
	return o.forEach(([e, t]) => {
		let n = new Ua(new Ki().setFromPoints([a[e], a[t]]), s);
		i.add(n);
	}), i;
}
function Ff(e, t) {
	let { boxColor: n, boxOpacity: r, boxLineWidth: i, arrowColorA: a, arrowColorB: o, arrowColorC: s, arrowHeadLengthMult: c, arrowHeadWidthMult: l, arrowCylinderRadius: u } = t, d = new Gr(), f = e.fractToCartMatrix.toArray(), p = new q(f[0][0], f[0][1], f[0][2], 0, f[1][0], f[1][1], f[1][2], 0, f[2][0], f[2][1], f[2][2], 0, 0, 0, 0, 1), m = Pf(p, n, r, i);
	d.add(m);
	let h = new W(), g = new W(), _ = new W();
	p.extractBasis(h, g, _);
	let { a: v, b: y, c: b } = e, x = Math.max(v, y, b) * c, S = x * l, C = Nf(h, a, x, S, u), w = Nf(g, o, x, S, u), T = Nf(_, s, x, S, u);
	return d.add(C), d.add(w), d.add(T), d.name = "UnitCell", d.userData = {
		selectable: !1,
		cellParameters: {
			a: v,
			b: y,
			c: b,
			alpha: e.alpha,
			beta: e.beta,
			gamma: e.gamma
		},
		type: "UnitCell"
	}, d;
}
//#endregion
//#region src/lib/ortep3d/crystal-viewer.js
var If = class {
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
}, Lf = class {
	constructor(e, t = {}) {
		let n = ["constant", "onDemand"];
		if (t.renderMode && !n.includes(t.renderMode)) throw Error(`Invalid render mode: "${t.renderMode}". Must be one of: ${n.join(", ")}`);
		let r = [
			"solid-3d",
			"cutout-3d",
			"cutout-2d"
		];
		if (t.renderStyle && !r.includes(t.renderStyle)) throw Error(`Invalid render style: "${t.renderStyle}". Must be one of: ${r.join(", ")}`);
		this.container = e;
		let i = t.camera?.initialPosition ?? $.camera.initialPosition;
		this.options = {
			camera: {
				...$.camera,
				...t.camera || {},
				initialPosition: i.isVector3 ? i.clone() : new W(...i)
			},
			selection: {
				...$.selection,
				...t.selection || {}
			},
			interaction: {
				...$.interaction,
				...t.interaction || {}
			},
			atomDetail: t.atomDetail || $.atomDetail,
			atomCutawayHysteresis: t.atomCutawayHysteresis ?? $.atomCutawayHysteresis,
			atomCutawayStripeCount: t.atomCutawayStripeCount ?? $.atomCutawayStripeCount,
			atomCutawayStripeWidth: t.atomCutawayStripeWidth ?? $.atomCutawayStripeWidth,
			atomColorRoughness: t.atomColorRoughness || $.atomColorRoughness,
			atomColorMetalness: t.atomColorMetalness || $.atomColorMetalness,
			atomADPRingWidthFactor: t.atomADPRingWidthFactor || $.atomADPRingWidthFactor,
			atomADPRingHeight: t.atomADPRingHeight || $.atomADPRingHeight,
			atomADPRingSections: t.atomADPRingSections || $.atomADPRingSections,
			bondRadius: t.bondRadius || $.bondRadius,
			bondSections: t.bondSections || $.bondSections,
			bondColor: t.bondColor || $.bondColor,
			bondColorRoughness: t.bondColorRoughness || $.bondColorRoughness,
			bondColorMetalness: t.bondColorMetalness || $.bondColorMetalness,
			bondGrowTolerance: t.bondGrowTolerance ?? $.bondGrowTolerance,
			elementProperties: {
				...$.elementProperties,
				...t.elementProperties
			},
			hydrogenMode: t.hydrogenMode || $.hydrogenMode,
			disorderMode: t.disorderMode || $.disorderMode,
			symmetryMode: t.symmetryMode || $.symmetryMode,
			renderMode: t.renderMode || $.renderMode,
			renderStyle: t.renderStyle || $.renderStyle,
			plot2DBackground: t.plot2DBackground || $.plot2DBackground,
			plot2DAtomColor: t.plot2DAtomColor || $.plot2DAtomColor,
			plot2DLineColor: t.plot2DLineColor || $.plot2DLineColor,
			plot2DBondColor: t.plot2DBondColor || $.plot2DBondColor,
			plot2DOpenBondInnerScale: t.plot2DOpenBondInnerScale ?? $.plot2DOpenBondInnerScale,
			plot2DStripeCount: t.plot2DStripeCount ?? $.plot2DStripeCount,
			plot2DStripeWidth: t.plot2DStripeWidth ?? $.plot2DStripeWidth,
			plot2DOutlineScale: t.plot2DOutlineScale ?? $.plot2DOutlineScale,
			fixCifErrors: t.fixCifErrors || $.fixCifErrors,
			cell: {
				...$.cell,
				...t.cell
			}
		}, this.state = {
			isDragging: !1,
			currentCifContent: null,
			currentCifBlock: null,
			currentStructure: null,
			currentFloor: null,
			baseStructure: null,
			ortepObjects: /* @__PURE__ */ new Map(),
			structureCenter: new W()
		}, this.modifiers = {
			removeatoms: new xf(),
			addhydrogen: new Cf(),
			missingbonds: new Sf(this.options.elementProperties, this.options.bondGrowTolerance),
			disorder: new yf(this.options.disorderMode),
			symmetry: new bf(this.options.symmetryMode),
			hydrogen: new vf(this.options.hydrogenMode)
		}, this.selections = new If(this.options), this.setupScene(), this.controls = new Of(this), this.animate(), this.needsRender = !0;
	}
	setupScene() {
		this.scene = new $r(), this.cameraController = Mf(this.container, this.options), this.camera = this.cameraController.camera, this.renderer = new Lu({
			antialias: !0,
			alpha: !0
		}), this.options.renderStyle === "cutout-2d" && this.renderer.setClearColor(this.options.plot2DBackground, 1), this.resizeRendererToDisplaySize(), this.container.appendChild(this.renderer.domElement), this.moleculeContainer = new Gr(), this.scene.add(this.moleculeContainer), this.camera.position.copy(this.options.camera.initialPosition), this.cameraTarget = new W(0, 0, 0), this.camera.lookAt(this.cameraTarget);
	}
	async loadCIF(e, t = 0) {
		if (e === void 0) return console.error("Cannot load an empty text as CIF"), {
			success: !1,
			error: "Cannot load an empty text as CIF"
		};
		try {
			let n = new w(e), r;
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
				i = Ne.fromCIF(r);
			} catch (e) {
				if (this.options.fixCifErrors) throw e;
				try {
					let e = Ed(r);
					i = Ne.fromCIF(e);
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
	async loadStructure(e = this.state.baseStructure) {
		this.state.baseStructure = e, this.selections.clear(), this.moleculeContainer.position.set(0, 0, 0), this.moleculeContainer.rotation.set(0, 0, 0), this.moleculeContainer.scale.set(1, 1, 1), this.moleculeContainer.updateMatrix(), this.moleculeContainer.matrixAutoUpdate = !0, this.moleculeContainer.updateMatrixWorld(!0), this.cameraTarget.set(0, 0, 0), this.camera.position.copy(this.options.camera.initialPosition), this.camera.lookAt(this.cameraTarget), this.state.structureCenter.set(0, 0, 0), this.update3DOrtep();
		let t = Ef(this.state.currentStructure);
		return this.container.clientHeight > this.container.clientWidth && t.premultiply(new q().makeRotationZ(Math.PI / 2)), t && (this.moleculeContainer.setRotationFromMatrix(t), this.moleculeContainer.updateMatrix()), new mi().setFromObject(this.moleculeContainer).getCenter(this.state.structureCenter), this.moleculeContainer.position.sub(this.state.structureCenter), this.updateCamera(), Df(this.scene, this.state.currentStructure), this.requestRender(), { success: !0 };
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
			let t = Ff(e.cell, this.options.cell);
			this.moleculeContainer.add(t);
		}
		let n = new nd(e, this.options).getGroup();
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
}, Rf = {
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
}, zf = "\n  cifview-widget {\n    display: flex;\n    flex-direction: column;\n    font-family: system-ui, -apple-system, sans-serif;\n    height: 100%;\n    position: relative;\n    background: var(--cifvis-bg, #fafafa);\n    border-radius: var(--cifvis-radius, 8px);\n    overflow: hidden;\n  }\n\n  cifview-widget .crystal-container {\n    flex: 1;\n    min-height: 0;\n    position: relative;\n  }\n\n  cifview-widget .crystal-caption {\n    padding: 12px 16px;\n    background: var(--cifvis-caption-bg, #ffffff);\n    border-top: 1px solid var(--cifvis-caption-border, #eaeaea);\n    color: var(--cifvis-caption-color, #333);\n    font-size: 14px;\n    line-height: 1.5;\n  }\n\n  cifview-widget .button-container {\n    position: absolute;\n    top: 16px;\n    right: 16px;\n    display: flex;\n    gap: 8px;\n    z-index: 1000;\n  }\n\n  cifview-widget .control-button {\n    width: 40px;\n    height: 40px;\n    border: none;\n    border-radius: var(--cifvis-button-radius, 8px);\n    background: var(--cifvis-button-bg, rgba(255, 255, 255, 0.9));\n    cursor: pointer;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 8px;\n    transition: all 0.2s ease;\n    box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n  }\n\n  cifview-widget .control-button:hover {\n    background: var(--cifvis-button-hover-bg, #ffffff);\n    box-shadow: 0 4px 8px rgba(0,0,0,0.15);\n  }\n\n  cifview-widget .control-button svg {\n    width: 24px;\n    height: 24px;\n  }\n", Bf = class extends HTMLElement {
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
			e.id = "cifview-styles", e.textContent = zf, document.head.appendChild(e);
		}
		this.viewer = null, this.baseCaption = "", this.selections = [], this.customIcons = null, this.userOptions = {}, this.defaultCaption = "Generated with <a href=\"https://github.com/Niolon/cifvis\">CifVis</a>.";
	}
	get icons() {
		return {
			...Rf,
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
		n.className = "crystal-caption", n.innerHTML = this.baseCaption, this.appendChild(n), this.captionElement = n, this.viewer = new Lf(e, this.userOptions), this.viewer.selections.onChange((e) => {
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
		let t = { ...$ };
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
		return e === "disorder" ? Dd(this.icons.disorder, t) : this.icons[e]?.[t] || "";
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
					this.viewer.dispose(), this.viewer = new Lf(e, this.userOptions), this.viewer.selections.onChange((e) => {
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
					let t = _d(e.data.bondLength, e.data.bondLengthSU);
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
	window.customElements.define("cifview-widget", Bf);
} catch (e) {
	e.message.includes("already been defined") || console.warn("Failed to register cifview-widget:", e);
}
//#endregion
export { xf as AtomLabelFilter, Sf as BondGenerator, w as CIF, Bf as CifViewWidget, Ne as CrystalStructure, Lf as CrystalViewer, yf as DisorderFilter, vf as HydrogenFilter, nd as ORTEP3JsStructure, bf as SymmetryGrower, _d as formatValueEsd, Od as generateDisorderGroupIcon, Dd as getDisorderIcon, Ed as tryToFixCifBlock };
