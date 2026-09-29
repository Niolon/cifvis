import { F as e, I as t, M as n, N as r, P as i, j as a } from "./crystal-lXuG9SGp.js";
//#region src/lib/read-cif/version.js
function o(e) {
	return e.charCodeAt(0) === 65279 ? e.slice(1) : e;
}
function s(e) {
	let t = o(e);
	return /^#\\#CIF_2\.0/.test(t) ? 2 : 1;
}
//#endregion
//#region src/lib/read-cif/tokenizer.js
var c = /* @__PURE__ */ new Set([
	" ",
	"	",
	"\r",
	"\n"
]), l = /* @__PURE__ */ new Set([
	"[",
	"]",
	"{",
	"}"
]);
function u(e, t, n, r) {
	if (e[t + 1] === n && e[t + 2] === n) {
		let i = n + n + n, a = e.indexOf(i, t + 3);
		if (a === -1) throw Error(`Unterminated triple-quoted string starting on line ${r}`);
		let o = e.slice(t + 3, a);
		return {
			value: o,
			next: a + 3,
			newlines: f(o)
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
function d(e, t, n) {
	let r = e.indexOf("\n;", t);
	if (r === -1) throw Error(`Unterminated text field starting on line ${n}`);
	let i = e.slice(t + 1, r);
	return i.startsWith("\n") && (i = i.slice(1)), {
		value: i,
		next: r + 2,
		newlines: f(e.slice(t, r + 2))
	};
}
function f(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] === "\n" && t++;
	return t;
}
function p(e, t) {
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
function m(e) {
	let t = e.replace(/\r\n?/g, "\n"), n = [], r = t.length, i = 0, a = 1, o = !0;
	for (; i < r;) {
		let e = t[i];
		if (e === "\n") {
			i++, a++, o = !0;
			continue;
		}
		if (c.has(e)) {
			i++, o = !1;
			continue;
		}
		if (e === "#") {
			for (; i < r && t[i] !== "\n";) i++;
			continue;
		}
		if (e === ";" && o) {
			let e = d(t, i, a);
			n.push({
				type: "value",
				value: e.value,
				quoted: !0,
				line: a
			}), i = e.next, a += e.newlines, o = !1;
			continue;
		}
		if (l.has(e)) {
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
			let r = u(t, i, e, a);
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
		for (; i < r && !c.has(t[i]) && !l.has(t[i]);) i++;
		n.push(p(t.slice(s, i), a)), o = !1;
	}
	return n;
}
//#endregion
//#region src/lib/read-cif/base.js
function h(e) {
	let t = null;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (t !== null) {
			r === t && (n + 1 === e.length || /\s/u.test(e[n + 1])) && (t = null);
			continue;
		}
		if ((r === "'" || r === "\"") && (n === 0 || /\s/u.test(e[n - 1]))) {
			t = r;
			continue;
		}
		if (r === "#" && n > 0 && /\s/u.test(e[n - 1])) return e.slice(0, n - 1);
	}
	return e;
}
function g(e) {
	let t = [], n = null, r = 0;
	for (let i of e) i.type === "listOpen" || i.type === "tableOpen" ? r++ : (i.type === "listClose" || i.type === "tableClose") && r--, i.type === "data" && r === 0 ? (n = [i], t.push(n)) : n && n.push(i);
	return t;
}
var _ = class {
	constructor(e, t = !0) {
		this.splitSU = t;
		let n = o(e);
		this.version = s(n), this.rawCifBlocks = this.version === 2 ? g(m(n)) : this.splitCifBlocks("\n\n" + n), this.blocks = Array(this.rawCifBlocks.length).fill(null), this._blockNameMap = null;
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
		return this.blocks[e] || (this.blocks[e] = new v(this.rawCifBlocks[e], this.splitSU, this.version)), this.blocks[e];
	}
	getAllBlocks() {
		for (let e = 0; e < this.blocks.length; e++) this.blocks[e] || (this.blocks[e] = new v(this.rawCifBlocks[e], this.splitSU, this.version));
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
}, v = class {
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
		let r = this.rawText.split("\n").filter((e) => !e.trim().startsWith("#")).map(h);
		this.dataBlockName = r[0];
		let i = 1;
		for (; i < r.length;) {
			if (i + 1 < r.length && r[i + 1].startsWith(";")) {
				let t = e(r, i + 1);
				this.data[r[i]] = t.value, i = t.endIndex + 1;
				continue;
			}
			if (r[i].trim().startsWith("loop_")) {
				let e = a.fromLines(r.slice(i), this.splitSU);
				if (!Object.prototype.hasOwnProperty.call(this.data, e.getName())) this.data[e.getName()] = e;
				else {
					let t = n(this.data[e.getName()], e, e.getName());
					this.data[t.newNames[0]] = t.newEntries[0], this.data[t.newNames[1]] = t.newEntries[1];
				}
				i += e.getEndIndex();
				continue;
			}
			let o = r[i].trim();
			if (o.length === 0) {
				i++;
				continue;
			}
			let s = o.match(/^(_\S+)\s+(.*)$/);
			if (s) {
				let e = s[1], n = t(s[2], this.splitSU);
				this.data[e] = n.value, isNaN(n.su) || (this.data[e + "_su"] = n.su);
			} else if (o.startsWith("_") && !r[i + 1].startsWith("_")) {
				let e = o, n = t(r[i + 1].trim(), this.splitSU);
				this.data[e] = n.value, isNaN(n.su) || (this.data[e + "_su"] = n.su), i++;
			} else throw Error("Could not parse line " + String(i) + ": " + r[i]);
			i++;
		}
	}
	parseV2() {
		this.data = {};
		let e = this.tokens;
		this.dataBlockName = e[0] && e[0].type === "data" ? e[0].value : null;
		let t = 1, n = 0;
		for (; t < e.length;) {
			let i = e[t];
			if (i.type === "save") {
				n++, t++;
				continue;
			}
			if (i.type === "saveEnd") {
				n > 0 && n--, t++;
				continue;
			}
			if (n > 0 || i.type === "global" || i.type === "stop") {
				t++;
				continue;
			}
			if (i.type === "tag") {
				let n = r(e, t + 1, this.splitSU);
				this.data[i.value] = n.value, isNaN(n.su) || (this.data[i.value + "_su"] = n.su), t = n.nextPos;
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
		let r = t + 1, o = [];
		for (; r < e.length && e[r].type === "tag";) o.push(e[r].value), r++;
		let s = [];
		for (; r < e.length && (e[r].type === "value" || e[r].type === "listOpen" || e[r].type === "tableOpen");) {
			let t = r;
			r = i(e, r), s.push([t, r]);
		}
		let c = a.fromTokens(o, e, s, this.splitSU);
		if (!Object.prototype.hasOwnProperty.call(this.data, c.getName())) this.data[c.getName()] = c;
		else {
			let e = n(this.data[c.getName()], c, c.getName());
			this.data[e.newNames[0]] = e.newEntries[0], this.data[e.newNames[1]] = e.newEntries[1];
		}
		return r;
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
};
//#endregion
export { _ as t };
