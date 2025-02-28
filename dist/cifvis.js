var Lt = Object.defineProperty;
var gt = (l) => {
  throw TypeError(l);
};
var Tt = (l, t, e) => t in l ? Lt(l, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : l[t] = e;
var D = (l, t, e) => Tt(l, typeof t != "symbol" ? t + "" : t, e), yt = (l, t, e) => t.has(l) || gt("Cannot " + e);
var S = (l, t, e) => (yt(l, t, "read from private field"), e ? e.call(l) : t.get(l)), _t = (l, t, e) => t.has(l) ? gt("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(l) : t.set(l, e), bt = (l, t, e, o) => (yt(l, t, "write to private field"), o ? o.call(l, e) : t.set(l, e), e);
import { create as G, all as U } from "mathjs";
import * as h from "three";
function st(l, t = !0) {
  const e = /^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)\((\d+)\)$/, o = l.match(e);
  if (t && o) {
    const [, n, c, d, m] = o, f = n === "-" ? -1 : 1, u = parseFloat(c), p = parseInt(d), g = c.includes(".") ? c.split(".")[1].length : 0, O = Number(f * u * Math.pow(10, p)), V = p - g, ut = Number(parseInt(m) * Math.pow(10, V));
    return g - p >= 0 && g - p <= 100 ? {
      value: Number(O.toFixed(g - p)),
      su: Number(ut.toFixed(g - p))
    } : { value: O, su: ut };
  }
  const s = /^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)$/, r = l.match(s);
  if (r) {
    const [, n, c, d] = r, m = n === "-" ? -1 : 1, f = c.includes(".") ? c.split(".")[1].length : 0, u = parseInt(d), p = Number(m * parseFloat(c) * Math.pow(10, u));
    return f - u >= 0 && f - u <= 100 ? {
      value: Number(p.toFixed(f - u)),
      su: NaN
    } : { value: p, su: NaN };
  }
  const i = /^([+-]?)(\d+\.?\d*|\.\d+)\((\d+)\)$/, a = l.match(i);
  if (t && a) {
    const [, n, c, d] = a, m = n === "-" ? -1 : 1;
    if (c.includes(".")) {
      const f = c.split(".")[1].length, u = Number((m * parseFloat(c)).toFixed(f)), p = Number((Math.pow(10, -f) * parseFloat(d)).toFixed(f));
      return { value: u, su: p };
    } else {
      const f = m * parseInt(c), u = parseInt(d);
      return { value: f, su: u };
    }
  }
  return isNaN(l) ? /^".*"$/.test(l) || /^'.*'$/.test(l) ? { value: l.slice(1, -1).replace(/\\([^\\])/g, "$1"), su: NaN } : { value: l.replace(/\\([^\\])/g, "$1"), su: NaN } : { value: l.includes(".") ? parseFloat(l) : parseInt(l), su: NaN };
}
function St(l, t) {
  const e = [l[t].slice(1)], o = l.slice(t + 1), s = o.findIndex((n) => n.startsWith(";")), r = e.concat(o.slice(0, s)), i = r.findIndex((n) => n.trim() !== ""), a = r.findLastIndex((n) => n.trim !== "");
  return {
    value: r.slice(i, a + 1).join(`
`),
    endIndex: t + s + 1
  };
}
const Rt = [
  "_space_group_symop_ssg",
  "_space_group_symop",
  "_symmetry_equiv",
  "_geom_bond",
  "_geom_hbond",
  "_geom_angle",
  "_geom_torsion",
  "_diffrn_refln",
  "_refln",
  "_atom_site_fourier_wave_vector",
  "_atom_site_moment_fourier_param",
  "_atom_site_moment_special_func",
  "_atom_site_moment",
  "_atom_site_rotation",
  "_atom_site_displace_Fourier",
  "_atom_site_displace_special_func",
  "_atom_site_occ_Fourier",
  "_atom_site_occ_special_func",
  "_atom_site_phason",
  "_atom_site_rot_Fourier_param",
  "_atom_site_rot_Fourier",
  "_atom_site_rot_special_func",
  "_atom_site_U_Fourier",
  "_atom_site_anharm_gc_c",
  "_atom_site_anharm_gc_d",
  "_atom_site_aniso",
  "_atom_site"
];
class J {
  /**
  * Creates a new CIF loop instance.
  * @constructor
  * @param {Array<string>} lines - Raw lines of the loop construct
  * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
  */
  constructor(t, e, o, s, r = null) {
    this.splitSU = s, this.headerLines = t, this.dataLines = e, this.endIndex = o, this.headers = null, this.data = null, this.name = null, r ? this.name = r : this.name = this.findCommonStart();
  }
  static fromLines(t, e) {
    let o = 1;
    for (; o < t.length && t[o].trim().startsWith("_"); )
      o++;
    const s = t.slice(1, o).map((c) => c.trim());
    let r = o, i = !1;
    for (; r < t.length && (!t[r].trim().startsWith("_") && !t[r].trim().startsWith("loop_") || i); )
      t[r].startsWith(";") && (i = !i), r++;
    const a = t.slice(o, r), n = r;
    return new J(s, a, n, e);
  }
  /**
  * Parses loop content into structured data.
  * Processes headers and values, handling standard uncertainties if enabled.
  */
  parse() {
    if (this.data !== null)
      return;
    this.headers = [...this.headerLines], this.data = {};
    const t = this.dataLines.reduce((o, s, r) => {
      if (s = s.trim(), !s.length)
        return o;
      if (s.startsWith(";")) {
        const a = St(this.dataLines, r);
        o.push({ value: a.value, su: NaN });
        for (let n = r; n < a.endIndex + 1; n++)
          this.dataLines[n] = "";
        return o;
      }
      const i = Array.from(s.matchAll(/'([^']*(?:'\S[^']*)*)'|"([^"]*(?:"\S[^"]*)*)"|\S+/g));
      return o.concat(i.map(
        (a) => st(a[1] || a[2] || a[0], this.splitSU)
      ));
    }, []), e = this.headers.length;
    if (t.length % e !== 0) {
      const o = t.map(({ value: s, su: r }) => `{value: ${s}, su: ${r}}`).join(", ");
      throw new Error(
        `Loop ${this.name}: Cannot distribute ${t.length} values evenly into ${e} columns
entries are: ${o}`
      );
    } else if (t.length === 0)
      throw new Error(`Loop ${this.name} has no data values.`);
    for (let o = 0; o < e; o++) {
      const s = this.headers[o], r = t.slice(o).filter((a, n) => n % e === 0);
      r.some((a) => !isNaN(a.su)) ? (this.data[s] = r.map((a) => a.value), this.data[s + "_su"] = r.map((a) => a.su), this.headers.push(s + "_su")) : this.data[s] = r.map((a) => a.value);
    }
  }
  /**
  * Gets the common name prefix shared by all headers.
  * @returns {string} Common prefix without the trailing underscore
  * @private
  */
  findCommonStart(t = !0) {
    if (t) {
      for (const i of Rt)
        if (this.headerLines.filter((n) => n.toLowerCase().startsWith(i.toLowerCase())).length >= this.headerLines.length / 2)
          return i;
    }
    const e = this.headerLines.map((i) => i.split("."));
    if (e[0].length > 1) {
      const i = e[0][0];
      if (this.headerLines.filter(
        (n) => n.split(".")[0] === i
      ).length >= this.headerLines.length / 2)
        return i;
    }
    const o = this.headerLines.map((i) => i.split(/[_.]/).filter((a) => a)), s = Math.min(...o.map((i) => i.length));
    let r = "";
    for (let i = 0; i < s; i++) {
      const a = o[0][i], n = o.filter(
        (c) => c[i] === a
      ).length;
      if (this.headerLines.length === 2)
        if (n === 2)
          r += "_" + a;
        else
          break;
      else if (n >= this.headerLines.length / 2)
        r += "_" + a;
      else
        break;
    }
    return r;
  }
  /**
  * Gets column data for given keys.
  * @param {(string|string[])} keys - Key or array of keys to try
  * @param {*} [defaultValue=null] - Value to return if keys not found
  * @returns {Array} Column data
  * @throws {Error} If no keys found and no default provided
  */
  get(t, e = null) {
    this.parse();
    const o = Array.isArray(t) ? t : [t];
    for (const s of o) {
      const r = this.data[s];
      if (r !== void 0)
        return r;
    }
    if (e !== null)
      return e;
    throw new Error(`None of the keys [${o.join(", ")}] found in CIF loop ${this.name}`);
  }
  /**
   * Gets value at specific index for one of given keys.
   * @param {(string|string[])} keys - Key or array of keys to try
   * @param {number} index - Row index
   * @param {*} [defaultValue=null] - Value to return if keys not found
   * @returns {*} Value at index
   * @throws {Error} If index out of bounds or keys not found
   */
  getIndex(t, e, o = null) {
    this.parse();
    const s = Array.isArray(t) ? t : [t];
    if (!s.some((i) => this.headers.includes(i))) {
      if (o !== null)
        return o;
      throw new Error(`None of the keys [${s.join(", ")}] found in CIF loop ${this.name}`);
    }
    const r = this.get(s);
    if (e < r.length)
      return r[e];
    throw new Error(
      `Tried to look up value of index ${e} in ${this.name}, but length is only ${r.length}`
    );
  }
  /**
  * Gets all column headers.
  * @returns {Array<string>} Array of header names
  */
  getHeaders() {
    return this.headers || this.parse(), this.headers;
  }
  /**
  * Gets the common name prefix shared by all headers.
  * @returns {string} Common prefix without the trailing underscore
  */
  getName() {
    return this.name;
  }
  /**
  * Gets the line index where this loop ends.
  * @returns {number} Index of the last line of the loop
  */
  getEndIndex() {
    return this.endIndex;
  }
}
function W(l) {
  return l && typeof l.getHeaders == "function";
}
function rt(l) {
  return l.getHeaders()[0].split("_").filter((e) => e.length > 0);
}
function Bt(l, t, e) {
  const o = W(l) ? l : t, s = e.split("_").filter((a) => a.length > 0), r = rt(o), i = "_" + s.join("_") + "_" + r[s.length];
  return W(l) ? [i, e] : [e, i];
}
function Pt(l, t) {
  const e = l.findCommonStart(!1), o = t.findCommonStart(!1);
  return e.length !== o.length ? [e, o] : null;
}
function It(l, t, e) {
  const o = e.split("_").filter((i) => i.length > 0), s = rt(l), r = rt(t);
  return s.length >= r.length ? [
    e + "_" + s[o.length],
    e
  ] : [
    e,
    e + "_" + r[o.length]
  ];
}
function zt(l, t, e) {
  let o;
  !W(l) || !W(t) ? o = Bt(l, t, e) : o = Pt(l, t) || It(l, t, e);
  const s = [l, t];
  return s.forEach((r, i) => {
    W(r) && (r.name = o[i]);
  }), {
    newNames: o,
    newEntries: s
  };
}
class Ft {
  /**
   * Creates a new CIF parser instance.
   * @constructor
   * @param {string} cifString - Raw CIF file content
   * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
   */
  constructor(t, e = !0) {
    this.splitSU = e, this.rawCifBlocks = this.splitCifBlocks(`

` + t), this.blocks = Array(this.rawCifBlocks.length).fill(null);
  }
  /**
   * Splits CIF content into blocks, while accounting for the fact that
   * there might be data entries within a multiline string.
   * @param {string} cifText - Raw CIF content with added newlines
   * @returns {Array<string>} Array of raw block texts
   * @private
   */
  splitCifBlocks(t) {
    const e = [], o = t.replaceAll(`\r
`, `
`).split(/\r?\ndata_/).slice(1);
    let s = 0;
    for (; s < o.length; ) {
      let r = o[s];
      const i = /\n;/g, a = r.match(i);
      let n = a ? a.length : 0;
      for (; n % 2 === 1 && s + 1 < o.length; ) {
        s++, r += `
data_` + o[s];
        const c = r.match(i);
        n = c ? c.length : 0;
      }
      e.push(r), s++;
    }
    return e;
  }
  /**
   * Gets a specific CIF data block.
   * @param {number} index - Block index (default: 0)
   * @returns {CifBlock} The requested CIF block
   */
  getBlock(t = 0) {
    return this.blocks[t] || (this.blocks[t] = new wt(this.rawCifBlocks[t], this.splitSU)), this.blocks[t];
  }
  /**
   * Gets all parsed CIF blocks.
   * @returns {Array<CifBlock>} Array of all CIF blocks
   */
  getAllBlocks() {
    for (let t = 0; t < this.blocks.length; t++)
      this.blocks[t] || (this.blocks[t] = new wt(this.rawCifBlocks[t], this.splitSU));
    return this.blocks;
  }
}
class wt {
  /**
   * Creates a new CIF block instance.
   * @constructor
   * @param {string} blockText - Raw text of the CIF block
   * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
   */
  constructor(t, e = !0) {
    this.rawText = t, this.splitSU = e, this.data = null, this.dataBlockName = null;
  }
  /**
   * Parses block content into structured data.
   * Handles single values, multiline strings, and loops.
   */
  parse() {
    if (this.data !== null)
      return;
    this.data = {};
    const t = this.rawText.split(`
`).filter((o) => !o.trim().startsWith("#")).map((o) => {
      const s = / #(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/;
      return o.split(s)[0];
    });
    this.dataBlockName = t[0];
    let e = 1;
    for (; e < t.length; ) {
      if (e + 1 < t.length && t[e + 1].startsWith(";")) {
        const r = St(t, e + 1);
        this.data[t[e]] = r.value, e = r.endIndex + 1;
        continue;
      }
      if (t[e].trim().startsWith("loop_")) {
        const r = J.fromLines(t.slice(e), this.splitSU);
        if (!Object.prototype.hasOwnProperty.call(this.data, r.getName()))
          this.data[r.getName()] = r;
        else {
          const i = zt(this.data[r.getName()], r, r.getName());
          this.data[i.newNames[0]] = i.newEntries[0], this.data[i.newNames[1]] = i.newEntries[1];
        }
        e += r.getEndIndex();
        continue;
      }
      const o = t[e].trim();
      if (o.length === 0) {
        e++;
        continue;
      }
      const s = o.match(/^(_\S+)\s+(.*)$/);
      if (s) {
        const r = s[1], i = st(s[2], this.splitSU);
        this.data[r] = i.value, isNaN(i.su) || (this.data[r + "_su"] = i.su);
      } else if (o.startsWith("_") && !t[e + 1].startsWith("_")) {
        const r = o, i = st(t[e + 1].trim(), this.splitSU);
        this.data[r] = i.value, isNaN(i.su) || (this.data[r + "_su"] = i.su), e++;
      } else
        throw new Error("Could not parse line " + String(e) + ": " + t[e]);
      e++;
    }
  }
  get dataBlockName() {
    return this._dataBlockName || this.parse(), this._dataBlockName;
  }
  set dataBlockName(t) {
    this._dataBlockName = t;
  }
  /**
   * Gets a value from the CIF block, trying multiple possible keys.
   * @param {(string|Array<string>)} keys - Key or array of keys to try
   * @param {*} [defaultValue=null] - Value to return if keys not found
   * @returns {*} Found value or default value
   * @throws {Error} If no keys found and no default provided
   */
  get(t, e = null) {
    this.parse();
    const o = Array.isArray(t) ? t : [t];
    for (const s of o) {
      const r = this.data[s];
      if (r !== void 0)
        return r;
    }
    if (e !== null)
      return e;
    throw new Error(`None of the keys [${o.join(", ")}] found in CIF block`);
  }
}
const k = G(U, {});
function I(l) {
  const t = k.unit(l.alpha, "deg").toNumber("rad"), e = k.unit(l.beta, "deg").toNumber("rad"), o = k.unit(l.gamma, "deg").toNumber("rad"), s = Math.cos(t), r = Math.cos(e), i = Math.cos(o), a = Math.sin(o), n = Math.sqrt(1 - s * s - r * r - i * i + 2 * s * r * i);
  return k.matrix([
    [l.a, l.b * i, l.c * r],
    [0, l.b * a, l.c * (s - r * i) / a],
    [0, 0, l.c * n / a]
  ]);
}
function Et(l) {
  return k.matrix([
    [l[0], l[3], l[4]],
    [l[3], l[1], l[5]],
    [l[4], l[5], l[2]]
  ]);
}
function Ht(l) {
  const t = k.matrix(l);
  return [
    t.get([0, 0]),
    // U11
    t.get([1, 1]),
    // U22
    t.get([2, 2]),
    // U33
    t.get([0, 1]),
    // U12
    t.get([0, 2]),
    // U13
    t.get([1, 2])
    // U23
  ];
}
function $t(l, t) {
  const e = k.matrix(l), o = k.transpose(k.inv(e)), s = k.diag(k.matrix(k.transpose(o).toArray().map((n) => k.norm(n)))), r = Et(t), i = k.multiply(k.multiply(s, r), k.transpose(s)), a = k.multiply(k.multiply(e, i), k.transpose(e));
  return Ht(a);
}
const kt = G(U);
var v;
const pt = class pt {
  /**
   * Creates a new position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate 
   * @param {number} z - Z coordinate
   * @throws {TypeError} If instantiated directly
   */
  constructor(t, e, o) {
    _t(this, v);
    if (new.target === pt)
      throw new TypeError(
        "BasePosition is an abstract class and cannot be instantiated directly, you probably want CartPosition"
      );
    bt(this, v, [Number(t), Number(e), Number(o)]), Object.defineProperties(this, {
      0: { get: () => S(this, v)[0] },
      1: { get: () => S(this, v)[1] },
      2: { get: () => S(this, v)[2] },
      length: { value: 3 },
      [Symbol.iterator]: {
        value: function* () {
          yield S(this, v)[0], yield S(this, v)[1], yield S(this, v)[2];
        }
      }
    });
  }
  get x() {
    return S(this, v)[0];
  }
  get y() {
    return S(this, v)[1];
  }
  get z() {
    return S(this, v)[2];
  }
  set x(t) {
    S(this, v)[0] = t;
  }
  set y(t) {
    S(this, v)[1] = t;
  }
  set z(t) {
    S(this, v)[2] = t;
  }
  /**
   * Converts from given coordinate system to Cartesian coordinates
   * @abstract
   * @param {UnitCell} _unitCell - Unit cell for conversion
   * @returns {CartPosition} Position in Cartesian coordinates
   * @throws {Error} If not implemented by subclass
   */
  toCartesian(t) {
    throw new Error("toCartesian must be implemented by subclass");
  }
};
v = new WeakMap();
let Z = pt;
class Dt extends Z {
  /**
   * Creates a new fractional position
   * @param {number} x - X coordinate in fractional units
   * @param {number} y - Y coordinate in fractional units 
   * @param {number} z - Z coordinate in fractional units
   */
  constructor(t, e, o) {
    super(t, e, o);
  }
  /**
   * Converts to Cartesian coordinates using unit cell parameters
   * @param {UnitCell} unitCell - Unit cell for conversion
   * @returns {CartPosition} Position in Cartesian coordinates
   */
  toCartesian(t) {
    const e = kt.multiply(
      t.fractToCartMatrix,
      kt.matrix([this.x, this.y, this.z])
    );
    return new At(...e.toArray());
  }
}
class At extends Z {
  /**
   * Creates a new Cartesian position
   * @param {number} x - X coordinate in Angstroms
   * @param {number} y - Y coordinate in Angstroms
   * @param {number} z - Z coordinate in Angstroms
   */
  constructor(t, e, o) {
    super(t, e, o);
  }
  /**
   * Returns self since already in Cartesian coordinates
   * @param {*} _ - Unused unit cell
   * @returns {CartPosition} This position instance
   */
  toCartesian(t) {
    return this;
  }
}
class Gt {
  /**
   * Creates a Position object from CIF data
   * @param {CifBlock} cifBlock - CIF data block containing position data
   * @param {number} index - Index in the loop
   * @returns {BasePosition} Position object in fractional or Cartesian coordinates
   * @throws {Error} If neither fractional nor Cartesian coordinates are valid
   */
  static fromCIF(t, e) {
    let o = !1;
    const s = t.get("_atom_site"), r = [".", "?"];
    if (String(s.getIndex(
      ["_atom_site.calc_flag", "_atom_site_calc_flag"],
      e,
      ""
    )).toLowerCase() === "dum")
      throw new Error("Dummy atom: calc_flag is dum");
    try {
      const a = s.getIndex(["_atom_site.fract_x", "_atom_site_fract_x"], e), n = s.getIndex(["_atom_site.fract_y", "_atom_site_fract_y"], e), c = s.getIndex(["_atom_site.fract_z", "_atom_site_fract_z"], e);
      if (!r.includes(a) && !r.includes(n) && !r.includes(c))
        return new Dt(a, n, c);
      o = !0;
    } catch {
    }
    try {
      const a = s.getIndex(["_atom_site.Cartn_x", "_atom_site.cartn_x", "_atom_site_Cartn_x"], e), n = s.getIndex(["_atom_site.Cartn_y", "_atom_site.cartn_y", "_atom_site_Cartn_y"], e), c = s.getIndex(["_atom_site.Cartn_z", "_atom_site.cartn_z", "_atom_site_Cartn_z"], e);
      if (!r.includes(a) && !r.includes(n) && !r.includes(c))
        return new At(a, n, c);
      o = !0;
    } catch {
    }
    throw o ? new Error("Dummy atom: Invalid position") : new Error("Invalid position: No valid fractional or Cartesian coordinates found");
  }
}
const N = G(U, {});
class H {
  constructor(t) {
    this.uiso = t;
  }
  /**
   * Creates a UIsoADP instance from a B value
   * @param {number} biso - Isotropic B value in Å²
   * @returns {UIsoADP} New UIsoADP instance
   */
  static fromBiso(t) {
    return new H(t / (8 * Math.PI * Math.PI));
  }
}
class $ {
  /**
   * @param {number} u11 - U11 component in Å²
   * @param {number} u22 - U22 component in Å²
   * @param {number} u33 - U33 component in Å²
   * @param {number} u12 - U12 component in Å²
   * @param {number} u13 - U13 component in Å²
   * @param {number} u23 - U23 component in Å² 
   */
  constructor(t, e, o, s, r, i) {
    this.u11 = t, this.u22 = e, this.u33 = o, this.u12 = s, this.u13 = r, this.u23 = i;
  }
  /**
   * Creates a UAnisoADP instance from B values
   * @param {number} b11 - B11 component in Å²
   * @param {number} b22 - B22 component in Å²
   * @param {number} b33 - B33 component in Å²
   * @param {number} b12 - B12 component in Å²
   * @param {number} b13 - B13 component in Å²
   * @param {number} b23 - B23 component in Å²
   * @returns {UAnisoADP} New UAnisoADP instance
   */
  static fromBani(t, e, o, s, r, i) {
    const a = 1 / (8 * Math.PI * Math.PI);
    return new $(
      t * a,
      e * a,
      o * a,
      s * a,
      r * a,
      i * a
    );
  }
  /**
  * Converts ADPs to Cartesian coordinate system
  * @param {UnitCell} unitCell - Cell parameters for transformation
  * @returns {number[]} ADPs in Cartesian coordinates [U11, U22, U33, U12, U13, U23]
  */
  getUCart(t) {
    return $t(
      t.fractToCartMatrix,
      [this.u11, this.u22, this.u33, this.u12, this.u13, this.u23]
    );
  }
  /**
  * Generates the transformation matrix to transform a sphere already scaled for probability
  * to an ORTEP ellipsoid
  * @param {UnitCell} unitCell - unitCell object for the unit cell information
  * @returns {math.Matrix} transformation matrix, is normalised to never invert coordinates
  */
  getEllipsoidMatrix(t) {
    const e = Et(this.getUCart(t)), { eigenvectors: o } = N.eigs(e), s = N.transpose(N.matrix(o.map((c) => c.vector))), r = N.matrix(o.map((c) => c.value > 0 ? c.value : NaN)), i = N.det(s), a = N.diag(r.map(Math.sqrt));
    let n;
    if (N.abs(i - 1) > 1e-10) {
      const c = N.multiply(s, 1 / i);
      n = N.multiply(c, a);
    } else
      n = N.multiply(s, a);
    return N.matrix(n);
  }
}
class M {
  /**
   * Creates the appropriate ADP object based on available CIF data
   * @param {CifBlock} cifBlock - The CIF data block
   * @param {number} atomIndex - Index in atom_site loop
   * @returns {(UIsoADP|UAnisoADP|null)} The appropriate ADP object or null if no valid data
   */
  static fromCIF(t, e) {
    const o = t.get("_atom_site"), s = o.getIndex(["_atom_site.label", "_atom_site_label"], e), r = o.getIndex(
      [
        "_atom_site.adp_type",
        "_atom_site_adp_type",
        "_atom_site.thermal_displace_type",
        "_atom_site_thermal_displace_type"
      ],
      e,
      !1
    );
    if (r)
      return M.createFromExplicitType(t, e, s, r);
    if (M.isInAnisoLoop(t, s)) {
      const c = M.createUani(t, s);
      if (c !== null)
        return c;
      const d = M.createBani(t, s);
      if (d !== null)
        return d;
    }
    const a = M.createUiso(t, e);
    if (a !== null)
      return a;
    const n = M.createBiso(t, e);
    return n !== null ? n : null;
  }
  /**
   * Creates ADP from explicitly specified type
   * @private
   */
  static createFromExplicitType(t, e, o, s) {
    switch (s.toLowerCase()) {
      case "uani":
        return M.createUani(t, o);
      case "aniso":
        return M.createUani(t, o);
      case "bani":
        return M.createBani(t, o);
      case "uiso":
        return M.createUiso(t, e);
      case "iso":
        return M.createUiso(t, e);
      case "biso":
        return M.createBiso(t, e);
      default:
        return null;
    }
  }
  /**
   * Checks if an atom is present in the anisotropic data loop
   * @private
   */
  static isInAnisoLoop(t, e) {
    try {
      return t.get("_atom_site_aniso").get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).includes(e);
    } catch {
      return !1;
    }
  }
  /**
   * Creates anisotropic U-based ADP
   * @private
   */
  static createUani(t, e) {
    let o;
    try {
      o = t.get("_atom_site_aniso");
    } catch {
      throw new Error(`Atom ${e} had ADP type UAni, but no atom_site_aniso loop was found`);
    }
    const r = o.get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).indexOf(e);
    if (r === -1)
      throw new Error(`Atom ${e} has ADP type Uani, but was not found in atom_site_aniso.label`);
    const i = o.getIndex(["_atom_site_aniso.u_11", "_atom_site_aniso_U_11"], r, NaN), a = o.getIndex(["_atom_site_aniso.u_22", "_atom_site_aniso_U_22"], r, NaN), n = o.getIndex(["_atom_site_aniso.u_33", "_atom_site_aniso_U_33"], r, NaN), c = o.getIndex(["_atom_site_aniso.u_12", "_atom_site_aniso_U_12"], r, NaN), d = o.getIndex(["_atom_site_aniso.u_13", "_atom_site_aniso_U_13"], r, NaN), m = o.getIndex(["_atom_site_aniso.u_23", "_atom_site_aniso_U_23"], r, NaN);
    return [i, a, n, c, d, m].some(isNaN) ? null : new $(i, a, n, c, d, m);
  }
  /**
   * Creates anisotropic B-based ADP
   * @private
   */
  static createBani(t, e) {
    let o;
    try {
      o = t.get("_atom_site_aniso");
    } catch {
      throw new Error(`Atom ${e} had ADP type BAni, but no atom_site_aniso loop was found`);
    }
    const r = o.get(["_atom_site_aniso.label", "_atom_site_aniso_label"]).indexOf(e);
    if (r === -1)
      throw new Error(`Atom ${e} has ADP type Bani, but was not found in atom_site_aniso.label`);
    const i = o.getIndex(["_atom_site_aniso.b_11", "_atom_site_aniso_B_11"], r, NaN), a = o.getIndex(["_atom_site_aniso.b_22", "_atom_site_aniso_B_22"], r, NaN), n = o.getIndex(["_atom_site_aniso.b_33", "_atom_site_aniso_B_33"], r, NaN), c = o.getIndex(["_atom_site_aniso.b_12", "_atom_site_aniso_B_12"], r, NaN), d = o.getIndex(["_atom_site_aniso.b_13", "_atom_site_aniso_B_13"], r, NaN), m = o.getIndex(["_atom_site_aniso.b_23", "_atom_site_aniso_B_23"], r, NaN);
    return [i, a, n, c, d, m].some(isNaN) ? null : $.fromBani(i, a, n, c, d, m);
  }
  /**
   * Creates isotropic U-based ADP
   * @private
   */
  static createUiso(t, e) {
    try {
      const s = t.get("_atom_site").getIndex(
        ["_atom_site.u_iso_or_equiv", "_atom_site_U_iso_or_equiv"],
        e,
        NaN
      );
      return isNaN(s) ? null : new H(s);
    } catch {
      return null;
    }
  }
  /**
   * Creates isotropic B-based ADP
   * @private
   */
  static createBiso(t, e) {
    try {
      const s = t.get("_atom_site").getIndex(
        ["_atom_site.b_iso_or_equiv", "_atom_site_B_iso_or_equiv"],
        e,
        NaN
      );
      return isNaN(s) ? null : H.fromBiso(s);
    } catch {
      return null;
    }
  }
}
const x = G(U);
function Ct(l) {
  if (Math.abs(l) < 21e-4)
    return "";
  const t = [2, 3, 4, 6], e = l < 0 ? "-" : "", o = Math.abs(l);
  if (Math.abs(o - Math.round(o)) < 21e-4)
    return e + Math.round(o);
  for (const s of t) {
    const r = o * s, i = Math.round(r);
    if (Math.abs(r - i) < 21e-4)
      return i === s ? e + "1" : e + i + "/" + s;
  }
  return e + o.toString();
}
class F {
  /**
   * Creates a new symmetry operation from a string instruction
   * @param {string} instruction - Symmetry operation in crystallographic notation (e.g. "x,y,z", "-x+1/2,y,-z")
   * @throws {Error} If instruction does not contain exactly three components
   */
  constructor(t) {
    const { matrix: e, vector: o } = this.parseSymmetryInstruction(t);
    this.rotMatrix = e, this.transVector = o;
  }
  /**
   * Parses a symmetry instruction string into rotation matrix and translation vector
   * @private
   * @param {string} instruction - Symmetry operation in crystallographic notation
   * @returns {{matrix: number[][], vector: number[]}} Parsed rotation matrix and translation vector
   * @throws {Error} If instruction does not contain exactly three components
   */
  parseSymmetryInstruction(t) {
    const e = Array(3).fill().map(() => Array(3).fill(0)), o = Array(3).fill(0), s = t.split(",").map((r) => r.trim().toUpperCase());
    if (s.length !== 3)
      throw new Error("Symmetry operation must have exactly three components");
    return s.forEach((r, i) => {
      const a = /([+-]?\d*\.?\d*(?:\/\d+)?)\*?([XYZ])/g;
      let n;
      for (; (n = a.exec(r)) !== null; ) {
        let m = n[1];
        const f = n[2];
        if (!m || m === "+")
          m = "1";
        else if (m === "-")
          m = "-1";
        else if (m.includes("/")) {
          const [p, g] = m.split("/");
          m = parseFloat(p) / parseFloat(g);
        }
        m = parseFloat(m);
        const u = f === "X" ? 0 : f === "Y" ? 1 : 2;
        e[i][u] = m;
      }
      const d = r.replace(/[+-]?\d*\.?\d*(?:\/\d+)?\*?[XYZ]/g, "").match(/[+-]?\d*\.?\d+(?:\/\d+)?/g) || [];
      for (const m of d)
        if (m.includes("/")) {
          const [f, u] = m.split("/");
          o[i] += parseFloat(f) / parseFloat(u);
        } else
          o[i] += parseFloat(m);
    }), { matrix: e, vector: o };
  }
  /**
   * Creates a symmetry operation from a CIF data block
   * @param {CifBlock} cifBlock - CIF data block containing symmetry operations
   * @param {number} symOpIndex - Index of the symmetry operation to extract
   * @returns {SymmetryOperation} New symmetry operation
   * @throws {Error} If no symmetry operations are found in the CIF block
   */
  static fromCIF(t, e) {
    const s = t.get(
      [
        "_space_group_symop",
        "_symmetry_equiv",
        "_space_group_symop.operation_xyz",
        "_space_group_symop_operation_xyz",
        "_symmetry_equiv.pos_as_xyz",
        "_symmetry_equiv_pos_as_xyz"
      ]
    ).getIndex([
      "_space_group_symop.operation_xyz",
      "_space_group_symop_operation_xyz",
      "_symmetry_equiv.pos_as_xyz",
      "_symmetry_equiv_pos_as_xyz"
    ], e);
    return new F(s);
  }
  /**
   * Applies the symmetry operation to a point in fractional coordinates
   * @param {number[]} point - Point in fractional coordinates [x, y, z]
   * @returns {number[]} Transformed point in fractional coordinates
   */
  applyToPoint(t) {
    const e = x.add(
      x.multiply(this.rotMatrix, t),
      this.transVector
    );
    return Array.isArray(e) ? e : e.toArray();
  }
  /**
   * Applies the symmetry operation to an atom, including its displacement parameters if present
   * @param {Object} atom - Atom object with fractional coordinates
   * @param {string} atom.label - Atom label
   * @param {string} atom.atomType - Chemical element symbol
   * @param {FractPosition} atom.position - Fractional position element
   * @param {(UAnisoADP|UIsoADP)} [atom.adp] - Anisotropic or isotropic displacement parameters
   * @param {number} [atom.disorderGroup] - Disorder group identifier
   * @returns {Atom} New atom instance with transformed coordinates and ADPs
   */
  applyToAtom(t) {
    const e = new Dt(...x.add(
      x.multiply(this.rotMatrix, [t.position.x, t.position.y, t.position.z]),
      this.transVector
    ));
    let o = null;
    if (t.adp && t.adp instanceof $) {
      const s = [
        [t.adp.u11, t.adp.u12, t.adp.u13],
        [t.adp.u12, t.adp.u22, t.adp.u23],
        [t.adp.u13, t.adp.u23, t.adp.u33]
      ], r = this.rotMatrix, i = x.transpose(r), a = x.multiply(x.multiply(r, s), i);
      o = new $(
        a[0][0],
        // u11
        a[1][1],
        // u22
        a[2][2],
        // u33
        a[0][1],
        // u12
        a[0][2],
        // u13
        a[1][2]
        // u23
      );
    } else t.adp && t.adp instanceof H && (o = new H(t.adp.uiso));
    return new X(
      t.label,
      t.atomType,
      e,
      o,
      t.disorderGroup
    );
  }
  /**
   * Applies the symmetry operation to multiple atoms
   * @param {Object[]} atoms - Array of atom objects
   * @param {string} atoms[].label - Atom label
   * @param {string} atoms[].atomType - Chemical element symbol
   * @param {FractPosition} atoms[].position - Fractional position object
   * @param {(UAnisoADP|UIsoADP)} [atoms[].adp] - Anisotropic or isotropic displacement parameters
   * @param {number} [atoms[].disorderGroup] - Disorder group identifier
   * @returns {Atom[]} Array of new atom instances with transformed coordinates and ADPs
   */
  applyToAtoms(t) {
    return t.map((e) => this.applyToAtom(e));
  }
  /**
   * Creates a deep copy of this symmetry operation
   * @returns {SymmetryOperation} New independent symmetry operation with the same parameters
   */
  copy() {
    const t = new F("x,y,z");
    return t.rotMatrix = x.clone(this.rotMatrix), t.transVector = x.clone(this.transVector), t;
  }
  /**
   * Generates a symmetry operation string from the internal matrix and vector
   * @param {Array<number>} [additionalTranslation] - Optional translation vector to add
   * @returns {string} Symmetry operation in crystallographic notation (e.g. "-x,y,-z" or "1-x,1+y,-z")
   */
  toSymmetryString(t = null) {
    const e = ["x", "y", "z"], o = [], s = t ? x.add(this.transVector, t) : this.transVector;
    for (let r = 0; r < 3; r++) {
      let i = "";
      const a = [];
      for (let n = 0; n < 3; n++) {
        const c = this.rotMatrix[r][n];
        if (Math.abs(c) > 1e-10)
          if (Math.abs(Math.abs(c) - 1) < 1e-10)
            a.push(c > 0 ? e[n] : `-${e[n]}`);
          else {
            const d = Ct(Math.abs(c));
            a.push(c > 0 ? `${d}${e[n]}` : `-${d}${e[n]}`);
          }
      }
      if (i = a.join("+"), i === "" && (i = "0"), Math.abs(s[r]) > 1e-10) {
        const n = Ct(Math.abs(s[r])), c = s[r] < 0 ? `-${n}` : n;
        i === "0" ? i = c : i.startsWith("-") ? i = `${c}${i}` : i = `${c}+${i}`;
      }
      o.push(i);
    }
    return o.join(",");
  }
}
class q {
  constructor(t, e, o, s = null) {
    var r;
    this.spaceGroupName = t, this.spaceGroupNumber = e, this.symmetryOperations = o, this.operationIds = s || new Map(
      o.map((i, a) => [(a + 1).toString(), a])
    ), this.identitySymOpId = (r = Array.from(this.operationIds.entries()).find(([i, a]) => {
      const n = this.symmetryOperations[a];
      return x.equal(n.rotMatrix, x.identity(3)) && x.equal(n.transVector, x.zeros(3));
    })) == null ? void 0 : r[0];
  }
  generateEquivalentPositions(t) {
    return this.symmetryOperations.map((e) => e.applyToPoint(t));
  }
  parsePositionCode(t) {
    let e, o;
    try {
      const [i, a] = t.split("_");
      o = i, e = a.split("").map((n) => parseInt(n) - 5);
    } catch {
      o = t.toString(), e = [0, 0, 0];
    }
    const s = this.operationIds.get(o);
    if (s === void 0)
      throw new Error(
        `Invalid symmetry operation ID in string ${t}: ${o}, expecting string format "<symOpId>_abc". ID entry in present symOp loop?`
      );
    return { symOp: this.symmetryOperations[s], transVector: e };
  }
  applySymmetry(t, e) {
    const { symOp: o, transVector: s } = this.parsePositionCode(t);
    if (Array.isArray(e)) {
      const i = o.applyToAtoms(e);
      return i.forEach((a) => {
        a.position.x += s[0], a.position.y += s[1], a.position.z += s[2];
      }), i;
    }
    const r = o.applyToAtom(e);
    return r.position.x += s[0], r.position.y += s[1], r.position.z += s[2], r;
  }
  static fromCIF(t) {
    const e = t.get(
      [
        "_space_group.name_h-m_alt",
        "_space_group.name_H-M_full",
        "_symmetry_space_group_name_H-M",
        "_space_group_name_H-M_alt"
      ],
      "Unknown"
    ), o = t.get(
      [
        "_space_group.it_number",
        "_space_group.IT_number",
        "_symmetry_Int_Tables_number",
        "_space_group_IT_number"
      ],
      0
    ), s = t.get(
      [
        "_space_group_symop",
        "_symmetry_equiv",
        "_symmetry_equiv_pos",
        "_space_group_symop.operation_xyz",
        "_space_group_symop_operation_xyz",
        "_symmetry_equiv.pos_as_xyz",
        "_symmetry_equiv_pos_as_xyz"
      ],
      !1
    );
    if (s && !(s instanceof J))
      return new q(
        e,
        o,
        [new F(s)]
      );
    if (s || console.warn(Object.keys(t).filter((r) => r.includes("sym"))), s) {
      const r = s.get([
        "_space_group_symop.operation_xyz",
        "_space_group_symop_operation_xyz",
        "_symmetry_equiv.pos_as_xyz",
        "_symmetry_equiv_pos_as_xyz"
      ]);
      let i = null;
      try {
        const n = s.get([
          "_space_group_symop.id",
          "_space_group_symop_id",
          "_symmetry_equiv.id",
          "_symmetry_equiv_pos_site_id"
        ]);
        i = new Map(n.map((c, d) => [c.toString(), d]));
      } catch {
      }
      const a = r.map((n) => new F(n));
      return new q(
        e,
        o,
        a,
        i
      );
    } else
      return console.warn("No symmetry operations found in CIF block, will use P1"), new q("Unknown", 0, [new F("x,y,z")]);
  }
}
class L {
  /**
  * Creates a new bond
  * @param {string} atom1Label - Label of first atom
  * @param {string} atom2Label - Label of second atom
  * @param {number} [bondLength=null] - Bond length in Å
  * @param {number} [bondLengthSU=null] - Standard uncertainty in bond length
  * @param {string} [atom2SiteSymmetry=null] - Symmetry operation for second atom
  */
  constructor(t, e, o = null, s = null, r = null) {
    this.atom1Label = t, this.atom2Label = e, this.bondLength = o, this.bondLengthSU = s, this.atom2SiteSymmetry = r;
  }
  /**
  * Creates a Bond from CIF data
  * @param {CifBlock} cifBlock - Parsed CIF data block
  * @param {number} bondIndex - Index in _geom_bond loop
  * @returns {Bond} New bond instance
  */
  static fromCIF(t, e) {
    const o = t.get("_geom_bond");
    let s = o.getIndex(
      ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"],
      e,
      "."
    );
    const r = o.getIndex(
      ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"],
      e,
      !1
    );
    return r && r === s && (s = "."), new L(
      o.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], e),
      o.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], e),
      o.getIndex(["_geom_bond.distance", "_geom_bond_distance"], e),
      o.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], e, NaN),
      s !== "?" ? s : "."
    );
  }
}
class j {
  /**
  * Creates a new hydrogen bond
  * @param {string} donorAtomLabel - Label of donor atom
  * @param {string} hydrogenAtomLabel - Label of hydrogen atom
  * @param {string} acceptorAtomLabel - Label of acceptor atom
  * @param {number} donorHydrogenDistance - D-H distance in Å
  * @param {number} donorHydrogenDistanceSU - Standard uncertainty in D-H distance
  * @param {number} acceptorHydrogenDistance - H···A distance in Å
  * @param {number} acceptorHydrogenDistanceSU - Standard uncertainty in H···A distance
  * @param {number} donorAcceptorDistance - D···A distance in Å
  * @param {number} donorAcceptorDistanceSU - Standard uncertainty in D···A distance
  * @param {number} hBondAngle - D-H···A angle in degrees
  * @param {number} hBondAngleSU - Standard uncertainty in angle
  * @param {string} acceptorAtomSymmetry - Symmetry operation for acceptor atom
  */
  constructor(t, e, o, s, r, i, a, n, c, d, m, f) {
    this.donorAtomLabel = t, this.hydrogenAtomLabel = e, this.acceptorAtomLabel = o, this.donorHydrogenDistance = s, this.donorHydrogenDistanceSU = r, this.acceptorHydrogenDistance = i, this.acceptorHydrogenDistanceSU = a, this.donorAcceptorDistance = n, this.donorAcceptorDistanceSU = c, this.hBondAngle = d, this.hBondAngleSU = m, this.acceptorAtomSymmetry = f;
  }
  /**
  * Creates a HBond from CIF data
  * @param {CifBlock} cifBlock - Parsed CIF data block
  * @param {number} hBondIndex - Index in _geom_hbond loop
  * @returns {HBond} New hydrogen bond instance
  */
  static fromCIF(t, e) {
    const o = t.get("_geom_hbond"), s = o.getIndex(
      ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"],
      e,
      "."
    );
    return new j(
      o.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], e),
      o.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], e),
      o.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], e),
      o.getIndex(["_geom_hbond.distance_dh", "_geom_hbond_distance_DH"], e, NaN),
      o.getIndex(["_geom_hbond.distance_dh_su", "_geom_hbond_distance_DH_su"], e, NaN),
      o.getIndex(["_geom_hbond.distance_ha", "_geom_hbond_distance_HA"], e, NaN),
      o.getIndex(["_geom_hbond.distance_ha_su", "_geom_hbond_distance_HA_su"], e, NaN),
      o.getIndex(["_geom_hbond.distance_da", "_geom_hbond_distance_DA"], e, NaN),
      o.getIndex(["_geom_hbond.distance_da_su", "_geom_hbond_distance_DA_su"], e, NaN),
      o.getIndex(["_geom_hbond.angle_dha", "_geom_hbond_angle_DHA"], e, NaN),
      o.getIndex(["_geom_hbond.angle_dha_su", "_geom_hbond_angle_DHA_su"], e, NaN),
      s !== "?" ? s : "."
    );
  }
}
class vt {
  constructor() {
    this.atomLabelErrors = [], this.symmetryErrors = [];
  }
  /**
   * Add an error message to the validation results
   * @param {string} error - Error message to add
   */
  addAtomLabelError(t) {
    this.atomLabelErrors.push(t);
  }
  addSymmetryError(t) {
    this.symmetryErrors.push(t);
  }
  /**
   * Check if validation found any errors
   * @returns {boolean} True if validation passed with no errors
   */
  isValid() {
    return this.atomLabelErrors.length + this.symmetryErrors.length === 0;
  }
  report(t, e) {
    let o = "";
    return this.atomLabelErrors.length !== 0 && (o += `Unknown atom label(s). Known labels are 
`, o += t.map((s) => s.label).join(", "), o += `
`, o += this.atomLabelErrors.join(`
`)), this.symmetryErrors.length !== 0 && (o.length !== 0 && (o += `
`), o += "Unknown symmetry ID(s) or String format. Expected format is <id>_abc. ", o += `Known IDs are:
`, o += Array.from(e.operationIds.keys()).join(", "), o += `
`, o += this.symmetryErrors.join(`
`)), o;
  }
}
class A {
  static createBonds(t, e) {
    try {
      const o = t.get("_geom_bond"), s = o.get(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]).length, r = [];
      for (let i = 0; i < s; i++) {
        const a = o.getIndex(
          ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"],
          i
        ), n = o.getIndex(
          ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"],
          i
        );
        A.isValidBondPair(a, n, e) && r.push(L.fromCIF(t, i));
      }
      return r;
    } catch {
      return [];
    }
  }
  /**
   * Creates hydrogen bonds from CIF data
   * @param {CifBlock} cifBlock - CIF data block to parse
   * @param {Set<string>} atomLabels - Set of valid atom labels
   * @returns {HBond[]} Array of created hydrogen bonds
   */
  static createHBonds(t, e) {
    const o = t.get("_geom_hbond", !1);
    if (!o)
      return [];
    const s = o.get(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]).length, r = [];
    for (let i = 0; i < s; i++) {
      const a = o.getIndex(
        ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"],
        i,
        "?"
      ), n = o.getIndex(
        ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"],
        i,
        "?"
      ), c = o.getIndex(
        ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"],
        i,
        "?"
      );
      A.isValidHBondTriplet(a, n, c, e) && r.push(j.fromCIF(t, i));
    }
    return r;
  }
  /**
   * Validates bonds against crystal structure
   * @param {CrystalStructure} structure - Structure to validate against
   * @returns {ValidationResult} Validation results
   */
  static validateBonds(t, e, o) {
    const s = new vt(), r = new Set(e.map((i) => i.label));
    for (const i of t) {
      const a = [];
      if (r.has(i.atom1Label) || a.push(i.atom1Label), r.has(i.atom2Label) || a.push(i.atom2Label), a.length > 0 && s.addAtomLabelError(
        `Non-existent atoms in bond: ${i.atom1Label} - ${i.atom2Label}, non-existent atom(s): ${a.join(", ")}`
      ), i.atom2SiteSymmetry && i.atom2SiteSymmetry !== ".")
        try {
          o.parsePositionCode(i.atom2SiteSymmetry);
        } catch {
          s.addSymmetryError(
            `Invalid symmetry in bond: ${i.atom1Label} - ${i.atom2Label}, invalid symmetry operation: ${i.atom2SiteSymmetry}`
          );
        }
    }
    return s;
  }
  /**
   * Validates h-bonds against crystal structure
   * @param {CrystalStructure} structure - Structure to validate against
   * @returns {ValidationResult} Validation results
   */
  static validateHBonds(t, e, o) {
    const s = new vt(), r = new Set(e.map((i) => i.label));
    for (const i of t) {
      const a = [];
      if (r.has(i.donorAtomLabel) || a.push(i.donorAtomLabel), r.has(i.hydrogenAtomLabel) || a.push(i.hydrogenAtomLabel), r.has(i.acceptorAtomLabel) || a.push(i.acceptorAtomLabel), a.length > 0 && s.addAtomLabelError(
        `Non-existent atoms in H-bond: ${i.donorAtomLabel} - ${i.hydrogenAtomLabel} - ${i.acceptorAtomLabel}, non-existent atom(s): ${a.join(", ")}`
      ), i.acceptorAtomSymmetry && i.acceptorAtomSymmetry !== ".")
        try {
          o.parsePositionCode(i.acceptorAtomSymmetry);
        } catch {
          s.addSymmetryError(
            `Invalid symmetry in H-bond: ${i.donorAtomLabel} - ${i.hydrogenAtomLabel} - ${i.acceptorAtomLabel}, invalid symmetry operation: ${i.acceptorAtomSymmetry}`
          );
        }
    }
    return s;
  }
  /**
   * Checks for an atom label whether it is valid (exclude centroids)
   * @param {string} atomLabel - An atom Label
   * @returns {boolean} Whether the label is valid
   */
  static isValidLabel(t) {
    return /^(Cg|Cnt|CG|CNT)/.test(t);
  }
  /**
   * Checks if bond atom pair is valid (not centroids unless in atom list)
   * @private
   * @param {string} atom1Label - First atom label
   * @param {string} atom2Label - Second atom label
   * @param {Set<string>} atomLabels - Set of valid atom labels
   * @returns {boolean} Whether bond pair is valid
   */
  static isValidBondPair(t, e, o) {
    const s = A.isValidLabel(t), r = A.isValidLabel(e);
    return t === "?" || e === "?" ? !1 : (!s || o.has(t)) && (!r || o.has(e));
  }
  /**
   * Checks if H-bond atom triplet is valid (not centroids unless in atom list)
   * @private
   * @param {string} donorLabel - Donor atom label
   * @param {string} hydrogenLabel - Hydrogen atom label  
   * @param {string} acceptorLabel - Acceptor atom label
   * @param {Set<string>} atomLabels - Set of valid atom labels
   * @returns {boolean} Whether H-bond triplet is valid
   */
  static isValidHBondTriplet(t, e, o, s) {
    const r = A.isValidLabel(t), i = A.isValidLabel(e), a = A.isValidLabel(o);
    return t === "?" || e === "?" || o === "?" ? !1 : (!r || s.has(t)) && (!i || s.has(e)) && (!a || s.has(o));
  }
}
function Q(l) {
  if (!l || typeof l != "string")
    throw new Error(`Invalid atom label: ${l}`);
  const t = l.toUpperCase(), e = [
    "HE",
    "LI",
    "BE",
    "NE",
    "NA",
    "MG",
    "AL",
    "SI",
    "CL",
    "AR",
    "CA",
    "SC",
    "TI",
    "CR",
    "MN",
    "FE",
    "CO",
    "NI",
    "CU",
    "ZN",
    "GA",
    "GE",
    "AS",
    "SE",
    "BR",
    "KR",
    "RB",
    "SR",
    "ZR",
    "NB",
    "MO",
    "TC",
    "RU",
    "RH",
    "PD",
    "AG",
    "CD",
    "IN",
    "SN",
    "SB",
    "TE",
    "XE",
    "CS",
    "BA",
    "LA",
    "CE",
    "PR",
    "ND",
    "PM",
    "SM",
    "EU",
    "GD",
    "TB",
    "DY",
    "HO",
    "ER",
    "TM",
    "YB",
    "LU",
    "HF",
    "TA",
    "RE",
    "OS",
    "IR",
    "PT",
    "AU",
    "HG",
    "TL",
    "PB",
    "BI",
    "PO",
    "AT",
    "RN",
    "FR",
    "RA",
    "AC",
    "TH",
    "PA",
    "NP",
    "PU",
    "AM",
    "CM"
  ], o = new RegExp(`^(${e.join("|")})`), s = t.match(o);
  if (s)
    return Mt(s[1]);
  const r = t.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
  if (r)
    return Mt(r[1]);
  throw new Error(`Could not infer element type from atom label: ${l}`);
}
function Mt(l) {
  return l.length === 1 ? l : l[0] + l[1].toLowerCase();
}
class T {
  /**
  * Creates a new crystal structure
  * @param {UnitCell} unitCell - Unit cell parameters
  * @param {Atom[]} atoms - Array of atoms in the structure
  * @param {Bond[]} [bonds=[]] - Array of bonds between atoms
  * @param {HBond[]} [hBonds=[]] - Array of hydrogen bonds
  * @param {CellSymmetry} [symmetry=null] - Crystal symmetry information
  */
  constructor(t, e, o = [], s = [], r = null) {
    this.cell = t, this.atoms = e, this.bonds = o, this.hBonds = s, this.recalculateConnectedGroups(), this.symmetry = r || new q("None", 0, [new F("x,y,z")]);
  }
  /**
  * Creates a CrystalStructure from CIF data
  * @param {CifBlock} cifBlock - Parsed CIF data block
  * @returns {CrystalStructure} New crystal structure instance
  */
  static fromCIF(t) {
    const e = ht.fromCIF(t), s = t.get("_atom_site").get(["_atom_site.label", "_atom_site_label"]), r = Array.from({ length: s.length }, (f, u) => {
      try {
        return X.fromCIF(t, u);
      } catch (p) {
        if (p.message.includes("Dummy atom"))
          return null;
        throw p;
      }
    }).filter((f) => f !== null);
    if (r.length === 0)
      throw new Error("The cif file contains no valid atoms.");
    const i = new Set(r.map((f) => f.label)), a = A.createBonds(t, i), n = A.createHBonds(t, i), c = q.fromCIF(t), d = A.validateBonds(a, r, c), m = A.validateHBonds(n, r, c);
    if (!d.isValid() || !m.isValid()) {
      const f = `There were errors in the bond or H-bond creation
`, u = d.report(r, c), p = m.report(r, c);
      throw u.length !== 0 && p.length !== 0 ? new Error(f + u + `
` + p) : new Error(f + u + p);
    }
    return new T(e, r, a, n, c);
  }
  /**
  * Finds an atom by its label 
  * @param {string} atomLabel - Unique atom identifier
  * @returns {Atom} Found atom
  * @throws {Error} If atom with label not found
  */
  getAtomByLabel(t) {
    for (const o of this.atoms)
      if (o.label === t)
        return o;
    const e = this.atoms.map((o) => o.label).join(", ");
    throw new Error(`Could not find atom with label: ${t}, available are: ${e}`);
  }
  /**
  * Groups atoms connected by bonds or H-bonds, excluding symmetry relationships
  * from the provided atoms and bonds
  * @returns {Array<{atoms: Atom[], bonds: Bond[], hBonds: HBond[]}>} Array of connected groups
  */
  recalculateConnectedGroups() {
    const t = /* @__PURE__ */ new Map(), e = [], o = (r) => {
      if (t.has(r.label))
        return t.get(r.label);
      const i = {
        atoms: /* @__PURE__ */ new Set(),
        bonds: /* @__PURE__ */ new Set(),
        hBonds: /* @__PURE__ */ new Set()
      };
      return e.push(i), i;
    };
    for (const r of this.bonds) {
      const i = this.getAtomByLabel(r.atom1Label), a = this.getAtomByLabel(r.atom2Label);
      if (r.atom2SiteSymmetry !== "." && r.atom2SiteSymmetry !== null)
        continue;
      const n = t.get(i.label), c = t.get(a.label), d = n || c;
      if (d) {
        if (d.atoms.add(i), d.atoms.add(a), d.bonds.add(r), t.set(i.label, d), t.set(a.label, d), n && c && n !== c) {
          for (const m of c.atoms)
            n.atoms.add(m), t.set(m.label, n);
          for (const m of c.bonds)
            n.bonds.add(m);
          e.splice(e.indexOf(c), 1);
        }
      } else {
        const m = o(i);
        m.atoms.add(i), m.atoms.add(a), m.bonds.add(r), t.set(i.label, m), t.set(a.label, m);
      }
    }
    for (const r of this.hBonds) {
      const i = this.getAtomByLabel(r.donorAtomLabel), a = this.getAtomByLabel(r.acceptorAtomLabel);
      if (r.acceptorAtomSymmetry !== "." && r.acceptorAtomSymmetry !== null)
        continue;
      o(i).hBonds.add(r), t.has(a.label) && o(a).hBonds.add(r);
    }
    this.atoms.filter((r) => !e.some((i) => i.atoms.has(r))).forEach((r) => {
      const i = {
        atoms: /* @__PURE__ */ new Set([r]),
        bonds: /* @__PURE__ */ new Set(),
        hBonds: /* @__PURE__ */ new Set()
      };
      e.push(i);
    }), this.connectedGroups = e.map((r) => ({
      atoms: Array.from(r.atoms),
      bonds: Array.from(r.bonds),
      hBonds: Array.from(r.hBonds)
    }));
  }
}
class ht {
  /**
  * Creates a new unit cell
  * @param {number} a - a axis length in Å 
  * @param {number} b - b axis length in Å
  * @param {number} c - c axis length in Å 
  * @param {number} alpha - α angle in degrees
  * @param {number} beta - β angle in degrees
  * @param {number} gamma - γ angle in degrees
  * @throws {Error} If parameters invalid
  */
  constructor(t, e, o, s, r, i) {
    this._a = t, this._b = e, this._c = o, this._alpha = s, this._beta = r, this._gamma = i, this.fractToCartMatrix = I(this);
  }
  /**
  * Creates a UnitCell from CIF data
  * @param {CifBlock} cifBlock - Parsed CIF data block
  * @returns {UnitCell} New unit cell instance
  */
  static fromCIF(t) {
    const e = [
      t.get(["_cell.length_a", "_cell_length_a"], -9999.9),
      t.get(["_cell.length_b", "_cell_length_b"], -9999.9),
      t.get(["_cell.length_c", "_cell_length_c"], -9999.9),
      t.get(["_cell.angle_alpha", "_cell_angle_alpha"], -9999.9),
      t.get(["_cell.angle_beta", "_cell_angle_beta"], -9999),
      t.get(["_cell.angle_gamma", "_cell_angle_gamma"], -9999.9)
    ];
    if (e.some((o) => o < 0)) {
      const o = ["a", "b", "c", "alpha", "beta", "gamma"], s = [];
      e.forEach((i, a) => {
        i < 0 && s.push(o[a]);
      });
      const r = s.join(", ");
      throw new Error(
        `Unit cell parameter entries missing in CIF or negative for cell parameters: ${r}`
      );
    }
    return new ht(...e);
  }
  get a() {
    return this._a;
  }
  set a(t) {
    if (t <= 0)
      throw new Error("Cell parameter 'a' must be positive");
    this._a = t, this.fractToCartMatrix = I(this);
  }
  get b() {
    return this._b;
  }
  set b(t) {
    if (t <= 0)
      throw new Error("Cell parameter 'b' must be positive");
    this._b = t, this.fractToCartMatrix = I(this);
  }
  get c() {
    return this._c;
  }
  set c(t) {
    if (t <= 0)
      throw new Error("Cell parameter 'c' must be positive");
    this._c = t, this.fractToCartMatrix = I(this);
  }
  get alpha() {
    return this._alpha;
  }
  set alpha(t) {
    if (t <= 0 || t >= 180)
      throw new Error("Angle alpha must be between 0 and 180 degrees");
    this._alpha = t, this.fractToCartMatrix = I(this);
  }
  get beta() {
    return this._beta;
  }
  set beta(t) {
    if (t <= 0 || t >= 180)
      throw new Error("Angle beta must be between 0 and 180 degrees");
    this._beta = t, this.fractToCartMatrix = I(this);
  }
  get gamma() {
    return this._gamma;
  }
  set gamma(t) {
    if (t <= 0 || t >= 180)
      throw new Error("Angle gamma must be between 0 and 180 degrees");
    this._gamma = t, this.fractToCartMatrix = I(this);
  }
}
class X {
  constructor(t, e, o, s = null, r = 0) {
    this.label = String(t), this.atomType = e, this.position = o, this.adp = s, this.disorderGroup = r;
  }
  /**
   * Creates an Atom from CIF data from either the index or the atom in the 
   * _atom_site_loop
   * @param {CifBlock} cifBlock - Parsed CIF data block
   * @param {number} [atomIndex=null] - Index in _atom_site loop
   * @param {string} [atomLabel=null] - Label to find atom by
   * @returns {Atom} New atom instance
   * @throws {Error} If neither index nor label provided
   */
  static fromCIF(t, e = null, o = null) {
    const s = t.get("_atom_site"), r = s.get(["_atom_site.label", "_atom_site_label"]);
    let i = e;
    if (e === null && o)
      i = r.indexOf(o);
    else if (e === null)
      throw new Error("either atomIndex or atomLabel need to be provided");
    const a = r[i], n = [".", "?"];
    if (n.includes(a))
      throw new Error("Dummy atom: Invalid label");
    if (String(s.getIndex(
      ["_atom_site.calc_flag", "_atom_site_calc_flag"],
      i,
      ""
    )).toLowerCase() === "dum")
      throw new Error("Dummy atom: calc_flag is dum");
    let d = s.getIndex(["_atom_site.type_symbol", "_atom_site_type_symbol"], i, !1);
    if (d || (d = Q(a)), n.includes(d))
      throw new Error("Dummy atom: Invalid atom type");
    const m = Gt.fromCIF(t, i), f = M.fromCIF(t, i), u = s.getIndex(
      ["_atom_site.disorder_group", "_atom_site_disorder_group"],
      i,
      "."
    );
    return new X(
      a,
      d,
      m,
      f,
      u === "." ? 0 : u
    );
  }
}
const _ = {
  camera: {
    minDistance: 1,
    maxDistance: 100,
    wheelZoomSpeed: 8e-4,
    pinchZoomSpeed: 1e-3,
    initialPosition: [0, 0, 10],
    fov: 45,
    near: 0.1,
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
      lineThreshold: 0.5,
      pointsThreshold: 0.5,
      meshThreshold: 0.1
    },
    touchRaycast: {
      lineThreshold: 2,
      pointsThreshold: 2,
      meshThreshold: 0.2
    }
  },
  renderMode: "onDemand",
  // starting values for hydrogen, disorder and symmetry display
  hydrogenMode: "none",
  disorderMode: "all",
  symmetryMode: "bonds-no-hbonds-no",
  bondGrowToleranceFactor: 1.2,
  fixCifErrors: !1,
  // atom visualisation Settings
  atomDetail: 3,
  atomColorRoughness: 0.3,
  atomColorMetalness: 0.5,
  atomADPRingWidthFactor: 1,
  atomADPRingHeight: 0.06,
  atomADPRingSections: 18,
  atomADPInnerSections: 7,
  atomConstantRadiusMultiplier: 0.25,
  // Bond visualisation settings
  bondRadius: 0.05,
  bondSections: 15,
  bondColor: "#666666",
  bondColorRoughness: 0.3,
  bondColorMetalness: 0.1,
  // Hydrogen bond visualisation settings
  hbondRadius: 0.04,
  hbondColor: "#AAAAAA",
  hbondColorRoughness: 0.3,
  hbondColorMetalness: 0.1,
  hbondDashSegmentLength: 0.3,
  // Target length for each dash+gap segment
  hbondDashFraction: 0.6,
  // Fraction of segment that is solid (vs gap)
  elementProperties: {
    H: { radius: 0.31, atomColor: "#ffffff", ringColor: "#000000" },
    D: { radius: 0.31, atomColor: "#ffffff", ringColor: "#000000" },
    He: { radius: 0.28, atomColor: "#d9ffff", ringColor: "#000000" },
    Li: { radius: 1.28, atomColor: "#cc80ff", ringColor: "#000000" },
    Be: { radius: 0.96, atomColor: "#c2ff00", ringColor: "#000000" },
    B: { radius: 0.85, atomColor: "#ffb5b5", ringColor: "#000000" },
    C: { radius: 0.76, atomColor: "#000000", ringColor: "#ffffff" },
    N: { radius: 0.71, atomColor: "#3050f8", ringColor: "#ffffff" },
    O: { radius: 0.66, atomColor: "#ff0d0d", ringColor: "#ffffff" },
    F: { radius: 0.57, atomColor: "#90e050", ringColor: "#000000" },
    Ne: { radius: 0.58, atomColor: "#b3e3f5", ringColor: "#000000" },
    Na: { radius: 1.66, atomColor: "#ab5cf2", ringColor: "#ffffff" },
    Mg: { radius: 1.41, atomColor: "#8aff00", ringColor: "#000000" },
    Al: { radius: 1.21, atomColor: "#bfa6a6", ringColor: "#000000" },
    Si: { radius: 1.11, atomColor: "#f0c8a0", ringColor: "#000000" },
    P: { radius: 1.07, atomColor: "#ff8000", ringColor: "#000000" },
    S: { radius: 1.05, atomColor: "#ffff30", ringColor: "#000000" },
    Cl: { radius: 1.02, atomColor: "#1ff01f", ringColor: "#000000" },
    Ar: { radius: 1.06, atomColor: "#80d1e3", ringColor: "#000000" },
    K: { radius: 2.03, atomColor: "#8f40d4", ringColor: "#ffffff" },
    Ca: { radius: 1.76, atomColor: "#3dff00", ringColor: "#000000" },
    Sc: { radius: 1.7, atomColor: "#e6e6e6", ringColor: "#000000" },
    Ti: { radius: 1.6, atomColor: "#bfc2c7", ringColor: "#000000" },
    V: { radius: 1.53, atomColor: "#a6a6ab", ringColor: "#000000" },
    Cr: { radius: 1.39, atomColor: "#8a99c7", ringColor: "#000000" },
    Mn: { radius: 1.39, atomColor: "#9c7ac7", ringColor: "#000000" },
    Fe: { radius: 1.32, atomColor: "#e06633", ringColor: "#ffffff" },
    Co: { radius: 1.26, atomColor: "#f090a0", ringColor: "#000000" },
    Ni: { radius: 1.24, atomColor: "#50d050", ringColor: "#000000" },
    Cu: { radius: 1.32, atomColor: "#c88033", ringColor: "#000000" },
    Zn: { radius: 1.22, atomColor: "#7d80b0", ringColor: "#000000" },
    Ga: { radius: 1.22, atomColor: "#c28f8f", ringColor: "#000000" },
    Ge: { radius: 1.2, atomColor: "#668f8f", ringColor: "#000000" },
    As: { radius: 1.19, atomColor: "#bd80e3", ringColor: "#000000" },
    Se: { radius: 1.2, atomColor: "#ffa100", ringColor: "#000000" },
    Br: { radius: 1.2, atomColor: "#a62929", ringColor: "#ffffff" },
    Kr: { radius: 1.16, atomColor: "#5cb8d1", ringColor: "#000000" },
    Rb: { radius: 2.2, atomColor: "#702eb0", ringColor: "#ffffff" },
    Sr: { radius: 1.95, atomColor: "#00ff00", ringColor: "#000000" },
    Y: { radius: 1.9, atomColor: "#94ffff", ringColor: "#000000" },
    Zr: { radius: 1.75, atomColor: "#94e0e0", ringColor: "#000000" },
    Nb: { radius: 1.64, atomColor: "#73c2c9", ringColor: "#000000" },
    Mo: { radius: 1.54, atomColor: "#54b5b5", ringColor: "#000000" },
    Tc: { radius: 1.47, atomColor: "#3b9e9e", ringColor: "#000000" },
    Ru: { radius: 1.46, atomColor: "#248f8f", ringColor: "#000000" },
    Rh: { radius: 1.42, atomColor: "#0a7d8c", ringColor: "#000000" },
    Pd: { radius: 1.39, atomColor: "#006985", ringColor: "#ffffff" },
    Ag: { radius: 1.45, atomColor: "#c0c0c0", ringColor: "#000000" },
    Cd: { radius: 1.44, atomColor: "#ffd98f", ringColor: "#000000" },
    In: { radius: 1.42, atomColor: "#a67573", ringColor: "#000000" },
    Sn: { radius: 1.39, atomColor: "#668080", ringColor: "#000000" },
    Sb: { radius: 1.39, atomColor: "#9e63b5", ringColor: "#ffffff" },
    Te: { radius: 1.38, atomColor: "#d47a00", ringColor: "#000000" },
    I: { radius: 1.39, atomColor: "#940094", ringColor: "#ffffff" },
    Xe: { radius: 1.4, atomColor: "#429eb0", ringColor: "#000000" },
    Cs: { radius: 2.44, atomColor: "#57178f", ringColor: "#ffffff" },
    Ba: { radius: 2.15, atomColor: "#00c900", ringColor: "#000000" },
    La: { radius: 2.07, atomColor: "#70d4ff", ringColor: "#000000" },
    Ce: { radius: 2.04, atomColor: "#ffffc7", ringColor: "#000000" },
    Pr: { radius: 2.03, atomColor: "#d9ffc7", ringColor: "#000000" },
    Nd: { radius: 2.01, atomColor: "#c7ffc7", ringColor: "#000000" },
    Pm: { radius: 1.99, atomColor: "#a3ffc7", ringColor: "#000000" },
    Sm: { radius: 1.98, atomColor: "#8fffc7", ringColor: "#000000" },
    Eu: { radius: 1.98, atomColor: "#61ffc7", ringColor: "#000000" },
    Gd: { radius: 1.96, atomColor: "#45ffc7", ringColor: "#000000" },
    Tb: { radius: 1.94, atomColor: "#30ffc7", ringColor: "#000000" },
    Dy: { radius: 1.92, atomColor: "#1fffc7", ringColor: "#000000" },
    Ho: { radius: 1.92, atomColor: "#00ff9c", ringColor: "#000000" },
    Er: { radius: 1.89, atomColor: "#00e675", ringColor: "#000000" },
    Tm: { radius: 1.9, atomColor: "#00d452", ringColor: "#000000" },
    Yb: { radius: 1.87, atomColor: "#00bf38", ringColor: "#000000" },
    Lu: { radius: 1.87, atomColor: "#00ab24", ringColor: "#000000" },
    Hf: { radius: 1.75, atomColor: "#4dc2ff", ringColor: "#000000" },
    Ta: { radius: 1.7, atomColor: "#4da6ff", ringColor: "#000000" },
    W: { radius: 1.62, atomColor: "#2194d6", ringColor: "#000000" },
    Re: { radius: 1.51, atomColor: "#267dab", ringColor: "#000000" },
    Os: { radius: 1.44, atomColor: "#266696", ringColor: "#ffffff" },
    Ir: { radius: 1.41, atomColor: "#175487", ringColor: "#ffffff" },
    Pt: { radius: 1.36, atomColor: "#d0d0e0", ringColor: "#000000" },
    Au: { radius: 1.36, atomColor: "#ffd123", ringColor: "#000000" },
    Hg: { radius: 1.32, atomColor: "#b8b8d0", ringColor: "#000000" },
    Tl: { radius: 1.45, atomColor: "#a6544d", ringColor: "#ffffff" },
    Pb: { radius: 1.46, atomColor: "#575961", ringColor: "#ffffff" },
    Bi: { radius: 1.48, atomColor: "#9e4fb5", ringColor: "#ffffff" },
    Po: { radius: 1.4, atomColor: "#ab5c00", ringColor: "#ffffff" },
    At: { radius: 1.5, atomColor: "#754f45", ringColor: "#ffffff" },
    Rn: { radius: 1.5, atomColor: "#428296", ringColor: "#000000" },
    Fr: { radius: 2.6, atomColor: "#420066", ringColor: "#ffffff" },
    Ra: { radius: 2.21, atomColor: "#007d00", ringColor: "#000000" },
    Ac: { radius: 2.15, atomColor: "#70abfa", ringColor: "#000000" },
    Th: { radius: 2.06, atomColor: "#00baff", ringColor: "#000000" },
    Pa: { radius: 2, atomColor: "#00a1ff", ringColor: "#000000" },
    U: { radius: 1.96, atomColor: "#008fff", ringColor: "#000000" },
    Np: { radius: 1.9, atomColor: "#0080ff", ringColor: "#000000" },
    Pu: { radius: 1.87, atomColor: "#006bff", ringColor: "#ffffff" },
    Am: { radius: 1.8, atomColor: "#545cf2", ringColor: "#ffffff" },
    Cm: { radius: 1.69, atomColor: "#785ce3", ringColor: "#ffffff" },
    Bk: { radius: 1.65, atomColor: "#8a4fe3", ringColor: "#ffffff" },
    Cf: { radius: 1.81, atomColor: "#a136d4", ringColor: "#ffffff" }
  }
};
class P {
  /**
   * Creates a new filter
   * @param {Object.<string, string>} modes - Dictionary of valid modes
   * @param {string} defaultMode - Initial mode to use
   * @param {string} filterName - Name of the filter for error messages
   */
  constructor(t, e, o, s = []) {
    if (new.target === P)
      throw new TypeError("Cannot instantiate BaseFilter directly");
    this.MODES = Object.freeze(t), this.PREFERRED_FALLBACK_ORDER = Object.freeze(s), this.filterName = o, this._mode = null, this.mode = e;
  }
  get requiresCameraUpdate() {
    return !1;
  }
  /**
   * Gets the current mode
   * @returns {string} Current mode
   */
  get mode() {
    return this._mode;
  }
  /**
   * Sets the current mode with validation
   * @param {string} value - New mode to set
   * @throws {Error} If mode is invalid
   */
  set mode(t) {
    const e = t.toLowerCase().replace(/_/g, "-"), o = Object.values(this.MODES);
    if (!o.includes(e))
      throw new Error(
        `Invalid ${this.filterName} mode: "${t}". Valid modes are: ${o.join(", ")}`
      );
    this._mode = e;
  }
  ensureValidMode(t) {
    const e = this.getApplicableModes(t);
    e.includes(this.mode) || (this.mode = this.PREFERRED_FALLBACK_ORDER.find((o) => e.includes(o)) || e[0]);
  }
  /**
   * Abstract method: Applies the filter to a structure
   * @abstract
   * @param {CrystalStructure} structure - Structure to filter
   * @returns {CrystalStructure} Filtered structure
   * @throws {Error} If not implemented by subclass
   */
  apply(t) {
    throw new Error('Method "apply" must be implemented by subclass');
  }
  /**
   * Abstract method: Gets modes applicable to the given structure
   * @abstract
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {string[]} Array of applicable mode names
   * @throws {Error} If not implemented by subclass
   */
  getApplicableModes(t) {
    throw new Error('Method "getApplicableModes" must be implemented by subclass');
  }
  /**
   * Cycles to the next applicable mode for the given structure
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {string} New mode after cycling
   */
  cycleMode(t) {
    const e = this.getApplicableModes(t);
    this.ensureValidMode(t);
    const o = e.indexOf(this._mode);
    return this._mode = e[(o + 1) % e.length], this._mode;
  }
}
G(U);
const C = class C extends P {
  /**
   * Creates a new hydrogen filter
   * @param {HydrogenFilter.MODES} [mode=HydrogenFilter.MODES.NONE] - Initial filter mode
   */
  constructor(t = C.MODES.NONE) {
    super(C.MODES, t, "HydrogenFilter", C.PREFERRED_FALLBACK_ORDER);
  }
  /**
   * Applies hydrogen filtering according to current mode
   * @param {CrystalStructure} structure - Structure to filter
   * @returns {CrystalStructure} New structure with filtered hydrogens
   */
  apply(t) {
    this.ensureValidMode(t);
    const e = t.atoms.filter((r) => r.atomType !== "H" || this.mode !== C.MODES.NONE).map((r) => new X(
      r.label,
      r.atomType,
      r.position,
      r.atomType === "H" && this.mode === C.MODES.CONSTANT ? null : r.adp,
      r.disorderGroup
    )), o = t.bonds.filter((r) => {
      if (this.mode === C.MODES.NONE) {
        const i = t.getAtomByLabel(r.atom1Label), a = t.getAtomByLabel(r.atom2Label);
        return !(i.atomType === "H" || a.atomType === "H");
      }
      return !0;
    }), s = this.mode === C.MODES.NONE ? [] : t.hBonds;
    return new T(
      t.cell,
      e,
      o,
      s,
      t.symmetry
    );
  }
  /**
   * Gets applicable modes based on presence of hydrogens and their ADPs
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<string>} Array of applicable mode names
   */
  getApplicableModes(t) {
    const e = [C.MODES.NONE];
    return t.atoms.some((r) => r.atomType === "H") && (e.push(C.MODES.CONSTANT), t.atoms.some(
      (r) => {
        var i;
        return r.atomType === "H" && ((i = r.adp) == null ? void 0 : i.constructor.name) === "UAnisoADP";
      }
    ) && e.push(C.MODES.ANISOTROPIC)), e;
  }
};
D(C, "MODES", Object.freeze({
  NONE: "none",
  CONSTANT: "constant",
  ANISOTROPIC: "anisotropic"
})), D(C, "PREFERRED_FALLBACK_ORDER", [
  C.MODES.ANISOTROPIC,
  C.MODES.CONSTANT,
  C.MODES.NONE
]);
let it = C;
const w = class w extends P {
  /**
   * Creates a new disorder filter
   * @param {DisorderFilter.MODES} [mode=DisorderFilter.MODES.ALL] - Initial filter mode
   */
  constructor(t = w.MODES.ALL) {
    super(w.MODES, t, "DisorderFilter", w.PREFERRED_FALLBACK_ORDER);
  }
  /**
   * Applies disorder filtering according to current mode
   * @param {CrystalStructure} structure - Structure to filter
   * @returns {CrystalStructure} New structure with filtered disorder groups
   */
  apply(t) {
    this.ensureValidMode(t);
    const e = t.atoms.filter((r) => !(this.mode === w.MODES.GROUP1 && r.disorderGroup > 1 || this.mode === w.MODES.GROUP2 && r.disorderGroup === 1)), o = t.bonds.filter((r) => {
      const i = t.getAtomByLabel(r.atom1Label), a = t.getAtomByLabel(r.atom2Label);
      return !(this.mode === w.MODES.GROUP1 && (i.disorderGroup > 1 || a.disorderGroup > 1) || this.mode === w.MODES.GROUP2 && (i.disorderGroup === 1 || a.disorderGroup === 1));
    }), s = t.hBonds.filter((r) => {
      const i = t.getAtomByLabel(r.donorAtomLabel), a = t.getAtomByLabel(r.hydrogenAtomLabel), n = t.getAtomByLabel(r.acceptorAtomLabel);
      return !(this.mode === w.MODES.GROUP1 && (i.disorderGroup > 1 || a.disorderGroup > 1 || n.disorderGroup > 1) || this.mode === w.MODES.GROUP2 && (i.disorderGroup === 1 || a.disorderGroup === 1 || n.disorderGroup === 1));
    });
    return new T(
      t.cell,
      e,
      o,
      s,
      t.symmetry
    );
  }
  /**
   * Gets applicable modes based on presence of disorder groups
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<string>} Array of applicable mode names
   */
  getApplicableModes(t) {
    const e = [w.MODES.ALL];
    return t.atoms.some((s) => s.disorderGroup > 0) && (t.atoms.some((s) => s.disorderGroup === 1) && e.push(w.MODES.GROUP1), t.atoms.some((s) => s.disorderGroup > 1) && e.push(w.MODES.GROUP2)), e;
  }
};
D(w, "MODES", Object.freeze({
  ALL: "all",
  GROUP1: "group1",
  GROUP2: "group2"
})), D(w, "PREFERRED_FALLBACK_ORDER", [
  w.MODES.ALL,
  w.MODES.GROUP1,
  w.MODES.GROUP2
]);
let at = w;
const y = class y extends P {
  /**
   * Creates a new symmetry grower
   * @param {SymmetryGrower.MODES} [mode=SymmetryGrower.MODES.BONDS_NO_HBONDS_NO] - Initial mode for growing symmetry
   */
  constructor(t = y.MODES.BONDS_NO_HBONDS_NO) {
    super(y.MODES, t, "SymmetryGrower", y.PREFERRED_FALLBACK_ORDER);
  }
  get requiresCameraUpdate() {
    return !0;
  }
  /**
   * Combines an atom label with a symmetry operation code to create a unique identifier
   * @param {string} atomLabel - Original atom label
   * @param {string} symOp - Symmetry operation code (e.g., "2_555")
   * @returns {string} Combined label or original label if no symmetry operation
   */
  static combineSymOpLabel(t, e) {
    return !e || e === "." ? t : `${t}@${e}`;
  }
  /**
   * Finds atoms that can be grown through symmetry operations
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {GrowableAtoms} Atoms that can be grown through bonds and hydrogen bonds
   */
  findGrowableAtoms(t) {
    const e = t.bonds.filter(({ atom2SiteSymmetry: s }) => s && s !== ".").map(({ atom2Label: s, atom2SiteSymmetry: r }) => [s, r]), o = t.hBonds.filter(
      ({ acceptorAtomSymmetry: s }) => s && s !== "."
    ).map(
      ({ acceptorAtomLabel: s, acceptorAtomSymmetry: r }) => [s, r]
    );
    return { bondAtoms: e, hBondAtoms: o };
  }
  /**
   * Grows a set of atoms and their connected groups using symmetry operations
   * @param {CrystalStructure} structure - Original structure containing atoms to grow
   * @param {Array<[string, string]>} atomsToGrow - Array of [atomLabel, symmetryOperation] pairs
   * @param {GrowthState} growthState - Current state of structure growth
   * @returns {GrowthState} Updated growth state including new atoms and bonds
   * @throws {Error} If an atom is not found in any connected group
   */
  growAtomArray(t, e, o) {
    for (const [s, r] of e) {
      const i = y.combineSymOpLabel(s, r);
      if (o.labels.has(i))
        continue;
      const a = t.connectedGroups.find(
        (c) => c.atoms.some((d) => d.label === s)
      );
      if (!a)
        throw new Error(
          `Atom ${s} is not in any group. Typo or structure.recalculateConnectedGroups()?`
        );
      t.symmetry.applySymmetry(r, a.atoms).forEach((c) => {
        c.label = y.combineSymOpLabel(c.label, r), o.labels.add(c.label), o.atoms.add(c);
      }), a.bonds.filter(({ atom2SiteSymmetry: c }) => c === ".").forEach((c) => {
        o.bonds.add(new L(
          y.combineSymOpLabel(c.atom1Label, r),
          y.combineSymOpLabel(c.atom2Label, r),
          c.bondLength,
          c.bondLengthSU,
          "."
        ));
      }), a.hBonds.filter(({ acceptorAtomSymmetry: c }) => c === ".").forEach((c) => {
        o.hBonds.add(new j(
          y.combineSymOpLabel(c.donorAtomLabel, r),
          y.combineSymOpLabel(c.hydrogenAtomLabel, r),
          y.combineSymOpLabel(c.acceptorAtomLabel, r),
          c.donorHydrogenDistance,
          c.donorHydrogenDistanceSU,
          c.acceptorHydrogenDistance,
          c.acceptorHydrogenDistanceSU,
          c.donorAcceptorDistance,
          c.donorAcceptorDistanceSU,
          c.hBondAngle,
          c.hBondAngleSU,
          "."
        ));
      });
    }
    return o;
  }
  /**
   * Grows the structure according to the current mode. Switches mode with a warning if
   * current mode is not applicable.
   * @param {CrystalStructure} structure - Structure to grow
   * @returns {CrystalStructure} New structure with grown atoms and bonds
   */
  apply(t) {
    this.ensureValidMode(t);
    const e = this.findGrowableAtoms(t), o = {
      atoms: new Set(t.atoms),
      bonds: new Set(t.bonds),
      hBonds: new Set(t.hBonds),
      labels: new Set(t.atoms.map(({ label: i }) => i))
    };
    this.mode.startsWith("bonds-yes") && this.growAtomArray(t, e.bondAtoms, o), this.mode.includes("hbonds-yes") && this.growAtomArray(t, e.hBondAtoms, o);
    const s = Array.from(o.atoms);
    for (const i of t.bonds) {
      if (i.atom2SiteSymmetry === ".")
        continue;
      const a = y.combineSymOpLabel(i.atom2Label, i.atom2SiteSymmetry);
      s.some((n) => n.label === a) && o.bonds.add(
        new L(i.atom1Label, a, i.bondLength, i.bondLengthSU, ".")
      );
    }
    for (const i of t.hBonds) {
      if (i.acceptorAtomSymmetry === ".")
        continue;
      const a = y.combineSymOpLabel(i.acceptorAtomLabel, i.acceptorAtomSymmetry);
      s.some((n) => n.label === a) && o.hBonds.add(
        new j(
          i.donorAtomLabel,
          i.hydrogenAtomLabel,
          a,
          i.donorHydrogenDistance,
          i.donorHydrogenDistanceSU,
          i.acceptorHydrogenDistance,
          i.acceptorHydrogenDistanceSU,
          i.donorAcceptorDistance,
          i.donorAcceptorDistanceSU,
          i.hBondAngle,
          i.hBondAngleSU,
          "."
        )
      );
    }
    const r = Array.from(o.hBonds).filter(({ acceptorAtomLabel: i, hydrogenAtomLabel: a, donorAtomLabel: n }) => {
      const c = o.labels.has(i), d = o.labels.has(a), m = o.labels.has(n);
      return c && d && m;
    });
    return new T(
      t.cell,
      s,
      Array.from(o.bonds),
      r,
      t.symmetry
    );
  }
  /**
   * Gets the modes that can be applied to the structure based on content
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<string>} Array of applicable mode names
   */
  getApplicableModes(t) {
    const e = this.findGrowableAtoms(t), o = e.bondAtoms.length > 0, s = e.hBondAtoms.length > 0;
    return !o && !s ? [y.MODES.BONDS_NONE_HBONDS_NONE] : o ? s ? [
      y.MODES.BONDS_YES_HBONDS_YES,
      y.MODES.BONDS_YES_HBONDS_NO,
      y.MODES.BONDS_NO_HBONDS_YES,
      y.MODES.BONDS_NO_HBONDS_NO
    ] : [
      y.MODES.BONDS_YES_HBONDS_NONE,
      y.MODES.BONDS_NO_HBONDS_NONE
    ] : [
      y.MODES.BONDS_NONE_HBONDS_YES,
      y.MODES.BONDS_NONE_HBONDS_NO
    ];
  }
};
D(y, "MODES", Object.freeze({
  BONDS_YES_HBONDS_YES: "bonds-yes-hbonds-yes",
  BONDS_YES_HBONDS_NO: "bonds-yes-hbonds-no",
  BONDS_YES_HBONDS_NONE: "bonds-yes-hbonds-none",
  BONDS_NO_HBONDS_YES: "bonds-no-hbonds-yes",
  BONDS_NO_HBONDS_NO: "bonds-no-hbonds-no",
  BONDS_NO_HBONDS_NONE: "bonds-no-hbonds-none",
  BONDS_NONE_HBONDS_YES: "bonds-none-hbonds-yes",
  BONDS_NONE_HBONDS_NO: "bonds-none-hbonds-no",
  BONDS_NONE_HBONDS_NONE: "bonds-none-hbonds-none"
})), D(y, "PREFERRED_FALLBACK_ORDER", [
  y.MODES.BONDS_NO_HBONDS_NO,
  y.MODES.BONDS_NO_HBONDS_NONE,
  y.MODES.BONDS_NONE_HBONDS_NO
]);
let K = y;
function Ut(l) {
  const t = {
    position: 0,
    rotation: 0,
    scale: 0,
    matrix: 0
  };
  function e(o) {
    const s = o.position, r = o.rotation, i = o.scale, a = o.matrix.elements;
    [s.x, s.y, s.z].some(isNaN) && (console.log("pos"), console.log(s), console.log(o.userData), t.position++), [r.x, r.y, r.z].some(isNaN) && (t.rotation++, console.log("rot"), console.log(r), console.log(o.userData)), [i.x, i.y, i.z].some(isNaN) && (console.log("scale"), console.log(i), console.log(o.userData), t.scale++), a.some(isNaN) && (t.matrix++, console.log("matrix"), console.log(a), console.log(o.userData));
    for (const n of o.children)
      e(n);
  }
  return e(l), t;
}
function Vt(l, t) {
  const o = l.getEllipsoidMatrix(t).toArray();
  return new h.Matrix4(
    o[0][0],
    o[0][1],
    o[0][2],
    0,
    o[1][0],
    o[1][1],
    o[1][2],
    0,
    o[2][0],
    o[2][1],
    o[2][2],
    0,
    0,
    0,
    0,
    1
  );
}
function Ot(l, t) {
  const e = t.clone().sub(l), o = e.length();
  if (o === 0)
    throw new Error("Error in ORTEP Bond Creation. Trying to create a zero length bond.");
  const s = e.divideScalar(o), r = new h.Vector3(0, 1, 0), i = new h.Vector3().crossVectors(s, r), a = -Math.acos(s.dot(r));
  return new h.Matrix4().makeScale(1, o, 1).premultiply(new h.Matrix4().makeRotationAxis(
    i.normalize(),
    a
  )).setPosition(
    l.clone().add(t).multiplyScalar(0.5)
  );
}
class Yt {
  /**
   * Creates a new geometry and material cache.
   * @param {Object} [options] - Visualisation options with defaults from structure-settings.js
   */
  constructor(t = {}) {
    const e = t || {};
    this.options = {
      ..._,
      ...e,
      elementProperties: {
        ..._.elementProperties,
        ...e.elementProperties || {}
      }
    }, this.scaling = 1.5384, this.geometries = {}, this.materials = {}, this.elementMaterials = {}, this.initializeGeometries(), this.initializeMaterials();
  }
  /**
   * Creates and caches base geometries for atoms, ADP rings, bonds and H-bonds.
   * @private
   */
  initializeGeometries() {
    this.geometries.atom = new h.IcosahedronGeometry(
      this.scaling,
      this.options.atomDetail
    ), this.geometries.adpRing = this.createADPHalfTorus(), this.geometries.bond = new h.CylinderGeometry(
      this.options.bondRadius,
      this.options.bondRadius,
      0.98,
      this.options.bondSections,
      1,
      !0
    ), this.geometries.hbond = new h.CylinderGeometry(
      this.options.hbondRadius,
      this.options.hbondRadius,
      0.98,
      this.options.bondSections,
      1,
      !0
    );
  }
  /**
   * Creates and caches base materials for bonds and H-bonds.
   * @private
   */
  initializeMaterials() {
    this.materials.bond = new h.MeshStandardMaterial({
      color: this.options.bondColor,
      roughness: this.options.bondColorRoughness,
      metalness: this.options.bondColorMetalness
    }), this.materials.hbond = new h.MeshStandardMaterial({
      color: this.options.hbondColor,
      roughness: this.options.hbondColorRoughness,
      metalness: this.options.hbondColorMetalness
    });
  }
  /**
   * Validates that properties exist for given element type.
   * @param {string} elementType - Chemical element symbol
   * @throws {Error} If element properties not found
   */
  validateElementType(t) {
    if (!this.options.elementProperties[t])
      throw new Error(
        `Unknown element type: ${t}. Please ensure element properties are defined.Pass the type settings as custom options, ifthey are element from periodic table`
      );
  }
  /**
   * Gets or creates cached materials for given atom type.
   * @param {string} atomType - Chemical element symbol
   * @returns {[THREE.Material, THREE.Material]} Array containing [atomMaterial, ringMaterial]
   */
  getAtomMaterials(t) {
    let e = t;
    this.options.elementProperties[e] || (e = Q(t)), this.validateElementType(e);
    const o = `${e}_materials`;
    if (!this.elementMaterials[o]) {
      const s = this.options.elementProperties[e], r = new h.MeshStandardMaterial({
        color: s.atomColor,
        roughness: this.options.atomColorRoughness,
        metalness: this.options.atomColorMetalness
      }), i = new h.MeshStandardMaterial({
        color: s.ringColor,
        roughness: this.options.atomColorRoughness,
        metalness: this.options.atomColorMetalness
      });
      this.elementMaterials[o] = [r, i];
    }
    return this.elementMaterials[o];
  }
  /**
   * Creates geometry for anisotropic displacement parameter visualisation,
   * by removing the inner vertices of a torus that would be obstructed by
   * the atom sphere anyway.
   * @private
   * @returns {THREE.BufferGeometry} Half torus geometry for ADP visualisation
   */
  createADPHalfTorus() {
    const t = new h.TorusGeometry(
      this.scaling * this.options.atomADPRingWidthFactor,
      this.options.atomADPRingHeight,
      this.options.atomADPInnerSections,
      this.options.atomADPRingSections
    ), e = t.attributes.position.array, o = t.index.array, s = [], r = [], i = /* @__PURE__ */ new Set();
    for (let d = 0; d < o.length; d += 3) {
      const m = o[d] * 3, f = o[d + 1] * 3, u = o[d + 2] * 3, p = [m, f, u].map((g) => ({
        index: g / 3,
        distance: Math.sqrt(
          e[g] * e[g] + e[g + 1] * e[g + 1] + e[g + 2] * e[g + 2]
        )
      }));
      p.some((g) => g.distance >= this.scaling) && p.forEach((g) => i.add(o[d + g.index % 3]));
    }
    const a = /* @__PURE__ */ new Map();
    let n = 0;
    i.forEach((d) => {
      const m = d * 3;
      s.push(
        e[m],
        e[m + 1],
        e[m + 2]
      ), a.set(d, n++);
    });
    for (let d = 0; d < o.length; d += 3)
      i.has(o[d]) && i.has(o[d + 1]) && i.has(o[d + 2]) && r.push(
        a.get(o[d]),
        a.get(o[d + 1]),
        a.get(o[d + 2])
      );
    const c = new h.BufferGeometry();
    return c.setAttribute("position", new h.Float32BufferAttribute(s, 3)), c.setIndex(r), c.computeVertexNormals(), c.rotateX(0.5 * Math.PI), t.dispose(), c;
  }
  /**
   * Cleans up all cached resources.
   */
  dispose() {
    Object.values(this.geometries).forEach((t) => t.dispose()), Object.values(this.materials).forEach((t) => t.dispose()), Object.values(this.elementMaterials).forEach(([t, e]) => {
      t.dispose(), e.dispose();
    });
  }
}
class qt {
  /**
   * Creates a new ORTEP structure visualisation.
   * @param {CrystalStructure} crystalStructure - Input crystal structure
   * @param {Object} [options] - Visualisation options
   */
  constructor(t, e = {}) {
    const o = e || {}, s = { ..._.elementProperties };
    o.elementProperties && Object.entries(o.elementProperties).forEach(([r, i]) => {
      s[r] = {
        ...s[r],
        ...i
      };
    }), this.options = {
      ..._,
      ...o,
      elementProperties: s
    }, this.crystalStructure = t, this.cache = new Yt(this.options), this.createStructure();
  }
  /**
   * Creates 3D representations of atoms, bonds and H-bonds.
   * @private
   */
  createStructure() {
    this.atoms3D = [], this.bonds3D = [], this.hBonds3D = [];
    const t = this.crystalStructure.atoms.map((s) => s.label);
    for (const s of this.crystalStructure.atoms) {
      const [r, i] = this.cache.getAtomMaterials(s.atomType);
      s.adp instanceof $ ? this.atoms3D.push(new jt(
        s,
        this.crystalStructure.cell,
        this.cache.geometries.atom,
        r,
        this.cache.geometries.adpRing,
        i
      )) : s.adp instanceof H ? this.atoms3D.push(new Wt(
        s,
        this.crystalStructure.cell,
        this.cache.geometries.atom,
        r
      )) : this.atoms3D.push(new Kt(
        s,
        this.crystalStructure.cell,
        this.cache.geometries.atom,
        r,
        this.options
      ));
    }
    const e = this.crystalStructure.bonds.map((s) => new L(
      s.atom1Label,
      K.combineSymOpLabel(s.atom2Label, s.atom2SiteSymmetry),
      s.bondLength,
      s.bondLengthSU,
      "."
    )).filter((s) => t.includes(s.atom2Label));
    for (const s of e)
      try {
        this.bonds3D.push(new Xt(
          s,
          this.crystalStructure,
          this.cache.geometries.bond,
          this.cache.materials.bond
        ));
      } catch (r) {
        if (r.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.")
          throw r;
      }
    const o = this.crystalStructure.hBonds.map((s) => new j(
      s.donorAtomLabel,
      s.hydrogenAtomLabel,
      K.combineSymOpLabel(
        s.acceptorAtomLabel,
        s.acceptorAtomSymmetry
      ),
      s.donorHydrogenDistance,
      s.donorHydrogenDistanceSU,
      s.acceptorHydrogenDistance,
      s.acceptorHydrogenDistanceSU,
      s.donorAcceptorDistance,
      s.donorAcceptorDistanceSU,
      s.hBondAngle,
      s.hBondAngleSU,
      "."
    )).filter((s) => t.includes(s.acceptorAtomLabel));
    for (const s of o)
      try {
        this.hBonds3D.push(new Zt(
          s,
          this.crystalStructure,
          this.cache.geometries.hbond,
          this.cache.materials.hbond,
          this.options.hbondDashSegmentLength,
          this.options.hbondDashFraction
        ));
      } catch (r) {
        if (r.message !== "Error in ORTEP Bond Creation. Trying to create a zero length bond.")
          throw r;
      }
  }
  /**
   * Returns a THREE.Group containing all visualisation objects.
   * @returns {THREE.Group} Group containing all structure objects
   */
  getGroup() {
    const t = new h.Group();
    for (const e of this.atoms3D)
      t.add(e);
    for (const e of this.bonds3D)
      t.add(e);
    for (const e of this.hBonds3D)
      t.add(e);
    return Ut(t), t;
  }
  /**
   * Cleans up all resources.
   */
  dispose() {
    this.cache.dispose();
  }
}
class tt extends h.Mesh {
  /**
   * Creates a new selectable object.
   * @param {THREE.BufferGeometry} geometry - Object geometry
   * @param {THREE.Material} material - Object material
   */
  constructor(t, e) {
    if (new.target === tt)
      throw new TypeError("ORTEPObject is an abstract class and cannot be instantiated directly.");
    super(t, e), this._selectionColor = null, this.marker = null;
  }
  get selectionColor() {
    return this._selectionColor;
  }
  /**
   * Creates material for selection highlighting.
   * @param {number} color - Color in hex format
   * @returns {THREE.Material} Selection highlight material
   */
  createSelectionMaterial(t) {
    return new h.MeshBasicMaterial({
      color: t,
      transparent: !0,
      opacity: 0.9,
      side: h.BackSide
    });
  }
  /**
   * Handles object selection.
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  select(t, e) {
    var r;
    this._selectionColor = t;
    const o = this.material.clone();
    (r = o.emissive) == null || r.setHex(e.selection.highlightEmissive), this.originalMaterial = this.material, this.material = o;
    const s = this.createSelectionMarker(t, e);
    this.add(s), this.marker = s;
  }
  /**
   * Handles object deselection.
   */
  deselect() {
    this._selectionColor = null, this.removeSelectionMarker();
  }
  /**
   * Creates visual marker for selection.
   * @abstract
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  createSelectionMarker(t, e) {
    throw new Error("createSelectionMarker needs to be implemented in a subclass");
  }
  /**
   * Removes selection marker and restores original material.
   * @private
   */
  removeSelectionMarker() {
    var t, e;
    this.marker && (this.remove(this.marker), (t = this.marker.geometry) == null || t.dispose(), (e = this.marker.material) == null || e.dispose(), this.marker = null), this.originalMaterial && (this.material.dispose(), this.material = this.originalMaterial, this.originalMaterial = null);
  }
  /**
   * Cleans up resources.
   */
  dispose() {
    var t, e;
    this.deselect(), (t = this.geometry) == null || t.dispose(), (e = this.material) == null || e.dispose();
  }
}
class mt extends tt {
  /**
   * Creates a new atom visualisation.
   * @param {Atom} atom - Input atom data
   * @param {UnitCell} unitCell - Unit cell parameters
   * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
   * @param {THREE.Material} atomMaterial - Atom material
   */
  constructor(t, e, o, s) {
    super(o, s);
    const r = new h.Vector3(...t.position.toCartesian(e));
    this.position.copy(r), this.userData = {
      type: "atom",
      atomData: t,
      selectable: !0
    };
  }
  /**
   * Creates visual marker for selection of atoms.
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  createSelectionMarker(t, e) {
    const o = new h.Mesh(
      this.geometry,
      this.createSelectionMaterial(t)
    );
    return o.scale.multiplyScalar(e.selection.markerMult), o.userData.selectable = !1, o;
  }
}
class jt extends mt {
  /**
   * Creates a new anisotropic atom visualisation.
   * @param {Atom} atom - Input atom data with anisotropic displacement parameters
   * @param {UnitCell} unitCell - Unit cell parameters
   * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
   * @param {THREE.Material} atomMaterial - Atom material
   * @param {THREE.BufferGeometry} baseADPRing - ADP ring geometry
   * @param {THREE.Material} ADPRingMaterial - ADP ring material
   */
  constructor(t, e, o, s, r, i) {
    if (super(t, e, o, s), [t.adp.u11, t.adp.u3, t.adp.u33].some((n) => n <= 0))
      this.geometry = new h.TetrahedronGeometry(0.8);
    else {
      const n = Vt(t.adp, e);
      if (n.toArray().includes(NaN))
        this.geometry = new h.TetrahedronGeometry(0.8);
      else {
        for (const c of this.adpRingMatrices) {
          const d = new h.Mesh(r, i);
          d.applyMatrix4(c), d.userData.selectable = !1, this.add(d);
        }
        this.applyMatrix4(n);
      }
    }
    const a = new h.Vector3(...t.position.toCartesian(e));
    this.position.copy(a), this.userData = {
      type: "atom",
      atomData: t,
      selectable: !0
    };
  }
  get adpRingMatrices() {
    return [
      new h.Matrix4().set(
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
      ),
      new h.Matrix4().set(
        1,
        0,
        0,
        0,
        0,
        0,
        -1,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        1
      ),
      new h.Matrix4().set(
        0,
        -1,
        0,
        0,
        1,
        0,
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
      )
    ];
  }
}
class Wt extends mt {
  /**
   * Creates a new isotropic atom visualisation.
   * @param {Atom} atom - Input atom data with isotropic displacement parameters
   * @param {UnitCell} unitCell - Unit cell parameters
   * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
   * @param {THREE.Material} atomMaterial - Atom material
   * @throws {Error} If atom lacks isotropic displacement parameters
   */
  constructor(t, e, o, s) {
    if (super(t, e, o, s), !t.adp || !("uiso" in t.adp))
      throw new Error("Atom must have isotropic displacement parameters (UIsoADP)");
    t.adp.uiso <= 0 ? this.geometry = new h.TetrahedronGeometry(1) : this.scale.multiplyScalar(Math.sqrt(t.adp.uiso));
  }
}
class Kt extends mt {
  /**
   * Creates a new constant radius atom visualization.
   * @param {Atom} atom - Input atom data
   * @param {UnitCell} unitCell - Unit cell parameters
   * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
   * @param {THREE.Material} atomMaterial - Atom material
   * @param {Object} options - Must contain elementProperties for atom type
   * @throws {Error} If element properties not found
   */
  constructor(t, e, o, s, r) {
    super(t, e, o, s);
    let i = t.atomType;
    try {
      r.elementProperties[i] || (i = Q(t.atomType));
    } catch {
      throw new Error(`Element properties not found for atom type: '${t.atomType}'`);
    }
    this.scale.multiplyScalar(
      r.atomConstantRadiusMultiplier * r.elementProperties[i].radius
    );
  }
}
class Xt extends tt {
  /**
   * Creates a new bond visualization.
   * @param {Bond} bond - Bond data
   * @param {CrystalStructure} crystalStructure - Parent structure
   * @param {THREE.BufferGeometry} baseBond - Bond geometry
   * @param {THREE.Material} baseBondMaterial - Bond material
   */
  constructor(t, e, o, s) {
    super(o, s);
    const r = e.getAtomByLabel(t.atom1Label), i = e.getAtomByLabel(t.atom2Label), a = new h.Vector3(...r.position.toCartesian(e.cell)), n = new h.Vector3(...i.position.toCartesian(e.cell)), c = Ot(a, n);
    this.applyMatrix4(c), this.userData = {
      type: "bond",
      bondData: t,
      selectable: !0
    };
  }
  /**
   * Creates visual marker for selection of bonds.
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  createSelectionMarker(t, e) {
    const o = new h.Mesh(
      this.geometry,
      this.createSelectionMaterial(t)
    );
    return o.scale.x *= e.selection.bondMarkerMult, o.scale.z *= e.selection.bondMarkerMult, o.userData.selectable = !1, o;
  }
}
class ft extends h.Group {
  /**
   * Creates a new group object.
   */
  constructor() {
    if (new.target === ft)
      throw new TypeError("ORTEPGroupObject is an abstract class and cannot be instantiated directly.");
    super(), this._selectionColor = null, this.marker = null;
  }
  get selectionColor() {
    return this._selectionColor;
  }
  /**
   * Adds objects with raycasting redirection.
   * @param {...THREE.Object3D} objects - Objects to add
   * @returns {this}
   */
  add(...t) {
    return t.forEach((e) => {
      if (e instanceof h.Mesh) {
        const o = e.raycast;
        e.raycast = (s, r) => {
          const i = [];
          if (o.call(e, s, i), i.length > 0) {
            const a = i[0];
            r.push({
              distance: a.distance,
              point: a.point,
              object: this,
              // Return parent group
              face: a.face,
              faceIndex: a.faceIndex,
              uv: a.uv
            });
          }
        };
      }
    }), super.add(...t);
  }
  /**
   * Creates material for selection highlighting.
   * @param {number} color - Color in hex format
   * @returns {THREE.Material} Selection highlight material
   */
  createSelectionMaterial(t) {
    return new h.MeshBasicMaterial({
      color: t,
      transparent: !0,
      opacity: 0.9,
      side: h.BackSide
    });
  }
  /**
   * Handles group selection.
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  select(t, e) {
    this._selectionColor = t, this.traverse((s) => {
      var r;
      if (s instanceof h.Mesh) {
        const i = s.material.clone();
        (r = i.emissive) == null || r.setHex(e.selection.highlightEmissive), s.originalMaterial = s.material, s.material = i;
      }
    });
    const o = this.createSelectionMarker(t, e);
    this.add(o), this.marker = o;
  }
  /**
   * Handles group deselection.
   */
  deselect() {
    this._selectionColor = null, this.marker && (this.remove(this.marker), this.marker.traverse((t) => {
      var e, o;
      t instanceof h.Mesh && ((e = t.geometry) == null || e.dispose(), (o = t.material) == null || o.dispose());
    }), this.marker = null), this.traverse((t) => {
      t instanceof h.Mesh && t.originalMaterial && (t.material.dispose(), t.material = t.originalMaterial, t.originalMaterial = null);
    });
  }
  /**
   * Creates visual marker for selection.
   * @abstract
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  createSelectionMarker(t, e) {
    throw new Error("createSelectionMarker needs to be implemented in a subclass");
  }
  /**
   * Cleans up resources.
   */
  dispose() {
    this.marker && this.deselect(), this.traverse((t) => {
      var e, o;
      t instanceof h.Mesh && ((e = t.geometry) == null || e.dispose(), (o = t.material) == null || o.dispose());
    }), this.clear();
  }
}
class Zt extends ft {
  /**
   * Creates a new hydrogen bond visualization.
   * @param {HBond} hbond - H-bond data
   * @param {CrystalStructure} crystalStructure - Parent structure
   * @param {THREE.BufferGeometry} baseHBond - H-bond geometry
   * @param {THREE.Material} baseHBondMaterial - H-bond material
   * @param {number} targetSegmentLength - Approximate target length for dashed segments
   * @param {number} dashFraction - Fraction of segment that is solid
   */
  constructor(t, e, o, s, r, i) {
    super(), this.userData = {
      type: "hbond",
      hbondData: t,
      selectable: !0
    };
    const a = e.getAtomByLabel(t.hydrogenAtomLabel), n = e.getAtomByLabel(t.acceptorAtomLabel), c = new h.Vector3(...a.position.toCartesian(e.cell)), d = new h.Vector3(...n.position.toCartesian(e.cell));
    this.createDashedBondSegments(
      c,
      d,
      o,
      s,
      r,
      i
    );
  }
  /**
   * Creates dashed line segments for hydrogen bond visualization.
   * @private
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {THREE.BufferGeometry} baseHBond - Base H-bond geometry
   * @param {THREE.Material} material - H-bond material
   * @param {number} targetLength - approximate target segment length
   * @param {number} dashFraction - Fraction of segment that is solid
   */
  createDashedBondSegments(t, e, o, s, r, i) {
    const a = t.distanceTo(e), n = Math.max(1, Math.floor(a / r)), d = a / n * i;
    for (let m = 0; m < n; m++) {
      const f = m / n, u = f + d / a, p = new h.Vector3().lerpVectors(t, e, f), g = new h.Vector3().lerpVectors(t, e, u), O = new h.Mesh(o, s.clone());
      O.applyMatrix4(Ot(p, g)), O.userData = this.userData, this.add(O);
    }
  }
  /**
   * Creates visual marker for selection of hydrogen bond.
   * @param {number} color - Selection color in hex format
   * @param {Object} options - Selection options
   */
  createSelectionMarker(t, e) {
    const o = new h.Group(), s = this.createSelectionMaterial(t);
    return this.children.forEach((r) => {
      const i = new h.Mesh(r.geometry, s);
      i.applyMatrix4(r.matrix), i.scale.x *= e.selection.bondMarkerMult, i.scale.y *= 0.8 * e.selection.bondMarkerMult, i.scale.z *= e.selection.bondMarkerMult, i.userData.selectable = !1, o.add(i);
    }), o;
  }
}
function Jt(l, t, e = 4) {
  if (!isFinite(1 / t))
    return et(l, e).toFixed(e);
  let o = Math.floor(Math.log10(t));
  t * Math.pow(10, -o) < 2 && (o -= 1);
  const s = et(l, -o);
  if (o < 0) {
    const i = Math.round(t / Math.pow(10, o));
    return `${s.toFixed(-o)}(${i})`;
  }
  const r = et(t, o);
  return `${s}(${r})`;
}
function et(l, t) {
  const e = Math.pow(10, t);
  return Math.round(l * e) / e;
}
function Nt(l, t = !0) {
  if (!l || typeof l != "string")
    throw new Error("Empty atom label");
  let e = l.toUpperCase().replace(/[()[\]{}]/g, "");
  if (t && (e = e.replace(/\^[a-zA-Z1-9]+$/, "").replace(/_[a-zA-Z1-9]+$/, "").replace(/_\$\d+$/, "")), e === "")
    throw new Error(`Label "${l}" normalizes to empty string`);
  return e;
}
function Qt(l, t = !0) {
  const e = /* @__PURE__ */ new Map();
  l.forEach((s) => {
    try {
      const r = Nt(s, t);
      e.has(r) || e.set(r, []), e.get(r).push(s);
    } catch (r) {
      console.warn(`Skipping invalid label: ${r.message}`);
    }
  });
  const o = /* @__PURE__ */ new Map();
  for (const [s, r] of e.entries())
    r.length === 1 ? o.set(s, r[0]) : console.warn(
      `Multiple labels map to ${s}: ${r.join(", ")}. Skipping mapping.`
    );
  return o;
}
function Y(l, t, e, o = !0) {
  const s = Qt(e, o), i = l.get(t).map((a) => {
    const n = Nt(a, o);
    return s.has(n) ? s.get(n) : a;
  });
  l.data[t] = i;
}
function te(l) {
  if (!l || l === ".")
    return ".";
  const t = String(l).trim();
  if (/^\d+_\d{3}$/.test(t))
    return t;
  const e = t.match(/^-?([^\s\-_.]+)[\s-.](\d{3})$/);
  if (e) {
    const o = e[1], s = e[2];
    return e[0].startsWith("-") ? `-${o}_${s}` : `${o}_${s}`;
  }
  if (/^\d{5,6}$/.test(t)) {
    const o = t.slice(0, 3), s = t.slice(-3), r = Array.from(o).map((a) => Math.abs(parseInt(a) - 5)).reduce((a, n) => a + n, 0), i = Array.from(s).map((a) => Math.abs(parseInt(a) - 5)).reduce((a, n) => a + n, 0);
    return r < i ? `${parseInt(t.slice(3))}_${o}` : `${parseInt(t.slice(0, -4))}_${s}`;
  }
  return l;
}
function ot(l, t) {
  const o = l.get(t).map((s) => te(s));
  l.data[t] = o;
}
function R(l, t) {
  for (const e of t)
    if (l.headerLines.includes(e))
      return e;
  return null;
}
function ee(l, t = !0, e = !0, o = !0) {
  let s;
  if ((t || e) && (s = l.get("_atom_site").get(["_atom_site.label", "_atom_site_label"])), t) {
    const r = l.get("_atom_site_aniso", !1);
    if (r) {
      const i = R(r, ["_atom_site_aniso.label", "_atom_site_aniso_label"]);
      i && Y(r, i, s);
    }
  }
  if (e || o) {
    const r = l.get("_geom_bond", !1);
    if (r) {
      if (e) {
        const a = R(
          r,
          ["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]
        );
        Y(r, a, s);
        const n = R(
          r,
          ["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"]
        );
        Y(r, n, s);
      }
      if (o) {
        const a = R(
          r,
          ["_geom_bond.site_symmetry_1", "_geom_bond_site_symmetry_1"]
        );
        a && ot(r, a);
        const n = R(
          r,
          ["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"]
        );
        n && ot(r, n);
      }
    }
    const i = l.get("_geom_hbond", !1);
    if (i) {
      if (e) {
        const a = R(
          i,
          ["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]
        );
        Y(i, a, s);
        const n = R(
          i,
          ["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"]
        );
        n && Y(i, n, s);
        const c = R(
          i,
          ["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"]
        );
        Y(i, c, s);
      }
      if (o) {
        const a = R(
          i,
          ["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"]
        );
        a && ot(i, a);
      }
    }
  }
}
const B = G(U), z = class z extends P {
  /**
   * Creates a new atom label filter
   * @param {string[]|string} [filteredLabels=[]] - Array of atom labels or comma-separated string to filter
   * @param {AtomLabelFilter.MODES} [mode=AtomLabelFilter.MODES.OFF] - Initial filter mode
   */
  constructor(t = [], e = z.MODES.OFF) {
    super(z.MODES, e, "AtomLabelFilter", []), this.setFilteredLabels(t);
  }
  get requiresCameraUpdate() {
    return !0;
  }
  /**
   * Parses a range expression (e.g., "A1>A10") and returns all labels in the range
   * @param {string} rangeExpr - Range expression in the format "start>end"
   * @param {string[]} allLabels - All available atom labels to filter the range against
   * @returns {string[]} Array of labels in the range
   * @private
   */
  _parseRangeExpression(t, e) {
    const [o, s] = t.split(">").map((a) => a.trim());
    if (!o || !s)
      return console.warn(`Invalid range expression: ${t}`), [];
    if (!e.includes(o))
      throw new Error(`Range filtering included unknown start label: ${o}`);
    if (!e.includes(s))
      throw new Error(`Range filtering included unknown end label: ${s}`);
    const r = e.indexOf(o), i = e.indexOf(s);
    return e.slice(r, i + 1);
  }
  /**
   * Updates the list of filtered atom labels
   * @param {string[]|string} labels - New array of atom labels or comma-separated string to filter
   */
  setFilteredLabels(t) {
    let e = [];
    typeof t == "string" ? e = t.split(",").map((o) => o.trim()).filter((o) => o) : Array.isArray(t) && (e = t), this.filteredLabels = new Set(e);
  }
  /**
   * Expands any range expressions in the filtered labels using available atom labels
   * @param {CrystalStructure} structure - Structure to filter
   * @private
   */
  _expandRanges(t) {
    const e = t.atoms.map((s) => s.label), o = /* @__PURE__ */ new Set();
    for (const s of this.filteredLabels)
      s.includes(">") && !e.includes(s) ? this._parseRangeExpression(s, e).forEach((i) => o.add(i)) : o.add(s);
    return o;
  }
  /**
   * Applies the filter to a structure, removing specified atoms and their bonds
   * @param {CrystalStructure} structure - Structure to filter
   * @returns {CrystalStructure} New structure with atoms removed if filter is on
   */
  apply(t) {
    if (this.mode === z.MODES.OFF)
      return t;
    const e = this._expandRanges(t), o = t.atoms.filter(
      (i) => !e.has(i.label)
    ), s = t.bonds.filter(
      (i) => !e.has(i.atom1Label) && !e.has(i.atom2Label)
    ), r = t.hBonds.filter(
      (i) => !e.has(i.donorAtomLabel) && !e.has(i.hydrogenAtomLabel) && !e.has(i.acceptorAtomLabel)
    );
    return new T(
      t.cell,
      o,
      s,
      r,
      t.symmetry
    );
  }
  /**
   * Gets applicable modes - both modes are always available
   * @returns {Array<string>} Array containing both ON and OFF modes
   */
  getApplicableModes() {
    return Object.values(z.MODES);
  }
};
D(z, "MODES", Object.freeze({
  ON: "on",
  OFF: "off"
}));
let nt = z;
const b = class b extends P {
  /**
   * Creates a new bond generator
   * @param {number} [toleranceFactor=1.3] - How much longer than the sum of atomic radii a bond can be
   * @param {BondGenerator.MODES} [mode=BondGenerator.MODES.KEEP] - Initial filter mode
   */
  constructor(t, e, o = b.MODES.KEEP) {
    super(b.MODES, o, "BondGenerator", b.PREFERRED_FALLBACK_ORDER), this.elementProperties = t, this.toleranceFactor = e;
  }
  /**
   * Gets the maximum allowed bond distance between two atoms
   * @param {string} element1 - First element symbol
   * @param {string} element2 - Second element symbol
   * @param {Object} elementProperties - Element property definitions
   * @returns {number} Maximum allowed bond distance
   */
  getMaxBondDistance(t, e, o) {
    var i, a;
    const s = (i = o[t]) == null ? void 0 : i.radius, r = (a = o[e]) == null ? void 0 : a.radius;
    if (!s || !r)
      throw new Error(`Missing radius for element ${s ? e : t}`);
    return (s + r) * this.toleranceFactor;
  }
  /**
   * Generates bonds between atoms based on their distances
   * @private
   * @param {CrystalStructure} structure - Structure to analyze
   * @param {Object} elementProperties - Element property definitions
   * @returns {Set<Bond>} Set of generated bonds
   */
  generateBonds(t, e) {
    const o = /* @__PURE__ */ new Set(), { cell: s, atoms: r } = t, i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
    r.forEach((n) => {
      const c = n.position.toCartesian(s);
      if (i.set(n.label, [c.x, c.y, c.z]), Object.prototype.hasOwnProperty.call(e, n.atomType) && !a.has(n.atomType))
        a.set(n.atomType, n.atomType);
      else if (!a.has(n.atomType))
        try {
          a.set(n.atomType, Q(n.atomType));
        } catch {
          throw new Error(`Missing radius for element ${n.atomType}`);
        }
    });
    for (let n = 0; n < r.length; n++) {
      const c = r[n], d = i.get(c.label);
      for (let m = n + 1; m < r.length; m++) {
        const f = r[m], u = i.get(f.label);
        if ((c.atomType === "H" || f.atomType === "H") && t.bonds.some((V) => V.atom1Label === c.label || V.atom1Label === f.label || V.atom2Label === c.label || V.atom2Label === f.label))
          continue;
        const p = B.subtract(d, u), g = B.norm(p), O = this.getMaxBondDistance(
          a.get(c.atomType),
          a.get(f.atomType),
          e
        );
        g <= O && g > 1e-4 && o.add(new L(
          c.label,
          f.label,
          g,
          null,
          // No standard uncertainty for generated bonds
          "."
        ));
      }
    }
    return o;
  }
  /**
   * Applies bond generation to a structure according to current mode
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {CrystalStructure} Structure with modified bonds according to mode
   */
  apply(t) {
    this.ensureValidMode(t);
    let e;
    switch (this.mode) {
      case b.MODES.KEEP:
        return t;
      // Keep existing bonds unchanged
      case b.MODES.ADD: {
        const o = this.generateBonds(t, this.elementProperties);
        e = [...t.bonds, ...o];
        break;
      }
      case b.MODES.REPLACE:
        e = [...this.generateBonds(t, this.elementProperties)];
        break;
      case b.MODES.CREATE:
        e = [...this.generateBonds(t, this.elementProperties)];
        break;
      case b.MODES.IGNORE:
        e = [...t.bonds];
        break;
      default:
        return t;
    }
    return new T(
      t.cell,
      t.atoms,
      e,
      t.hBonds,
      t.symmetry
    );
  }
  /**
   * Gets applicable modes based on current structure
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<string>} Array of applicable mode names
   */
  getApplicableModes(t) {
    return t.bonds.length > 0 ? [
      b.MODES.KEEP,
      b.MODES.ADD,
      b.MODES.REPLACE
    ] : [
      b.MODES.CREATE,
      b.MODES.IGNORE
    ];
  }
};
D(b, "MODES", Object.freeze({
  KEEP: "keep",
  // Keep existing bonds only
  ADD: "add",
  // Add new bonds while keeping existing ones
  REPLACE: "replace",
  // Replace all bonds with generated ones
  CREATE: "create",
  // Create bonds only if none exist
  IGNORE: "ignore"
  // Don't create bonds if none exist
})), D(b, "PREFERRED_FALLBACK_ORDER", [
  b.MODES.KEEP,
  b.MODES.ADD,
  b.MODES.REPLACE,
  b.MODES.CREATE,
  b.MODES.IGNORE
]);
let lt = b;
const E = class E extends P {
  /**
   * Creates a new isolated hydrogen fixer
   * @param {IsolatedHydrogenFixer.MODES} [mode=IsolatedHydrogenFixer.MODES.OFF] - Initial filter mode
   * @param {number} [maxBondDistance=1.1] - Maximum distance in Angstroms to consider for hydrogen bonds
   */
  constructor(t = E.MODES.OFF, e = 1.1) {
    super(
      E.MODES,
      t,
      "IsolatedHydrogenFixer",
      E.PREFERRED_FALLBACK_ORDER
    ), this.maxBondDistance = e;
  }
  /**
   * Applies the filter to create bonds for isolated hydrogen atoms
   * @param {CrystalStructure} structure - Structure to filter
   * @returns {CrystalStructure} Modified structure with additional bonds
   */
  apply(t) {
    if (this.ensureValidMode(t), this.mode === E.MODES.OFF)
      return t;
    const e = this.findIsolatedHydrogenAtoms(t);
    if (e.length === 0)
      return t;
    const o = this.createBondsForIsolatedHydrogens(t, e);
    return new T(
      t.cell,
      t.atoms,
      [...t.bonds, ...o],
      t.hBonds,
      t.symmetry
    );
  }
  /**
   * Finds hydrogen atoms that are in connected groups of size one
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<Object>} Array of isolated hydrogen atoms with their indices
   */
  findIsolatedHydrogenAtoms(t) {
    const e = [];
    return t.connectedGroups.forEach((o) => {
      if (o.atoms.length === 1 && o.atoms[0].atomType === "H") {
        const s = o.atoms[0], r = t.atoms.findIndex((i) => i.label === s.label);
        e.push({ atom: s, atomIndex: r });
      }
    }), e;
  }
  /**
   * Creates bonds for isolated hydrogen atoms to nearby potential bonding partners
   * @param {CrystalStructure} structure - Structure to analyze
   * @param {Array<Object>} isolatedHydrogenAtoms - Array of isolated hydrogen atoms with their indices
   * @returns {Array<Bond>} Array of new bonds
   */
  createBondsForIsolatedHydrogens(t, e) {
    const o = [];
    return e.forEach(({ atom: s, atomIndex: r }) => {
      const i = s.position.toCartesian(t.cell), a = [i.x, i.y, i.z];
      if (r > 0) {
        const c = t.atoms[r - 1];
        if (c.atomType !== "H" && (c.disorderGroup === s.disorderGroup || c.disorderGroup === 0 || s.disorderGroup === 0)) {
          const d = c.position.toCartesian(t.cell), m = [d.x, d.y, d.z], f = B.subtract(a, m), u = B.norm(f);
          if (u <= this.maxBondDistance) {
            o.push(new L(
              c.label,
              s.label,
              u,
              null,
              "."
            ));
            return;
          }
        }
      }
      let n = !1;
      for (let c = r - 1; c >= 0 && !n; c--) {
        const d = t.atoms[c];
        if (d.atomType === "H" || !(d.disorderGroup === s.disorderGroup || d.disorderGroup === 0 || s.disorderGroup === 0))
          continue;
        const m = d.position.toCartesian(t.cell), f = [m.x, m.y, m.z], u = B.subtract(a, f), p = B.norm(u);
        p <= this.maxBondDistance && (o.push(new L(
          d.label,
          s.label,
          p,
          null,
          "."
        )), n = !0);
      }
      if (!n && r < t.atoms.length - 1)
        for (let c = r + 1; c < t.atoms.length && !n; c++) {
          const d = t.atoms[c];
          if (d.atomType === "H" || !(d.disorderGroup === s.disorderGroup || d.disorderGroup === 0 || s.disorderGroup === 0))
            continue;
          const m = d.position.toCartesian(t.cell), f = [m.x, m.y, m.z], u = B.subtract(a, f), p = B.norm(u);
          p <= this.maxBondDistance && (o.push(new L(
            d.label,
            s.label,
            p,
            null,
            "."
          )), n = !0);
        }
    }), o;
  }
  /**
   * Gets applicable modes based on whether there are isolated hydrogen atoms
   * @param {CrystalStructure} structure - Structure to analyze
   * @returns {Array<string>} Array of applicable mode names
   */
  getApplicableModes(t) {
    return t.bonds.length === 0 ? [E.MODES.OFF] : t.connectedGroups.some(
      (o) => o.atoms.length === 1 && o.atoms[0].atomType === "H"
    ) ? [
      E.MODES.ON
      //IsolatedHydrogenFixer.MODES.OFF,
    ] : [E.MODES.OFF];
  }
};
D(E, "MODES", Object.freeze({
  ON: "on",
  OFF: "off"
})), D(E, "PREFERRED_FALLBACK_ORDER", [
  E.MODES.ON,
  E.MODES.OFF
]);
let ct = E;
const dt = G(U, {});
function oe(l) {
  const t = new h.Vector3();
  l.forEach((c) => t.add(c)), t.divideScalar(l.length);
  const e = new h.Matrix3(), o = new h.Vector3();
  l.forEach((c) => {
    o.copy(c).sub(t), e.elements[0] += o.x * o.x, e.elements[1] += o.x * o.y, e.elements[2] += o.x * o.z, e.elements[3] += o.y * o.x, e.elements[4] += o.y * o.y, e.elements[5] += o.y * o.z, e.elements[6] += o.z * o.x, e.elements[7] += o.z * o.y, e.elements[8] += o.z * o.z;
  });
  const { values: s, eigenvectors: r } = dt.eigs(se(e)), i = dt.min(s);
  if (i <= 0)
    return console.warn("Could not find a mean plane, expected?"), new h.Vector3(0, 1, 0);
  const a = r.filter((c) => c.value === i)[0].vector, n = new h.Vector3(...a.toArray());
  return n.normalize(), n;
}
function se(l) {
  const t = l.elements;
  return dt.matrix([
    [t[0], t[1], t[2]],
    [t[3], t[4], t[5]],
    [t[6], t[7], t[8]]
  ]);
}
function re(l, t) {
  const e = new h.Box3().setFromObject(l);
  if (e.isEmpty())
    return 10;
  const o = new h.Vector3();
  e.getSize(o);
  const s = t.fov * Math.PI / 180, r = Math.atan(t.aspect * Math.tan(s / 2) * 2);
  return o.x / o.y <= t.aspect ? o.y / 2 / Math.tan(s / 2) + o.z / 2 : o.x / 2 / Math.tan(r / 2) + o.z / 2;
}
function ie(l) {
  const t = [], e = new h.Vector3();
  if (l.traverse((p) => {
    var g;
    ((g = p.userData) == null ? void 0 : g.type) === "atom" && (t.push(p.position.clone()), e.add(p.position));
  }), t.length === 0)
    return null;
  e.divideScalar(t.length);
  const o = t.map((p) => p.sub(e)), s = oe(o), r = new h.Vector3(0, 0, 1), i = new h.Quaternion();
  i.setFromUnitVectors(s, r);
  const a = new h.Matrix4();
  a.makeRotationFromQuaternion(i);
  const n = o.map((p) => p.clone().applyMatrix4(a));
  let c = 0, d = 0;
  n.forEach((p, g) => {
    const O = Math.sqrt(p.x * p.x + p.y * p.y);
    O > c && (c = O, d = g);
  });
  const m = new h.Vector2(
    n[d].x,
    n[d].y
  );
  m.x < 0 && m.multiplyScalar(-1);
  const f = -Math.atan2(m.y, m.x), u = new h.Matrix4().makeRotationZ(f);
  return a.premultiply(u), a.premultiply(new h.Matrix4().makeRotationX(Math.PI / 8)), a.premultiply(new h.Matrix4().makeRotationY(Math.PI / 48)), a;
}
function ae(l, t) {
  l.children = l.children.filter((a) => !(a instanceof h.Light));
  let e = 6;
  t.traverse((a) => {
    var n;
    ((n = a.userData) == null ? void 0 : n.type) === "atom" && a.position.length() > e && (e = a.position.length());
  });
  const o = e * 2, s = new h.AmbientLight(16777215, 1);
  l.add(s);
  const r = new h.SpotLight(16777215, 1e3, 0, Math.PI * 0.27, 0.6);
  r.position.set(0, -0.5, o * 2), r.lookAt(new h.Vector3(0, 0, 0)), l.add(r), [
    { pos: [-1, -0.5, 1], intensity: 0.4 },
    { pos: [1, -0.5, 1], intensity: 0.4 },
    { pos: [0, -0.5, 1], intensity: 0.3 }
  ].forEach(({ pos: a, intensity: n }) => {
    const c = new h.DirectionalLight(16777215, n);
    c.position.set(
      a[0] * o,
      a[1] * o,
      a[2] * o
    ), c.lookAt(new h.Vector3(0, 0, 0)), l.add(c);
  });
}
class ne {
  constructor(t) {
    this.viewer = t, this.state = {
      isDragging: !1,
      isPanning: !1,
      mouse: new h.Vector2(),
      lastClickTime: 0,
      clickStartTime: 0,
      pinchStartDistance: 0,
      lastTouchRotation: 0,
      lastRightClickTime: 0,
      twoFingerStartPos: new h.Vector2(),
      initialCameraPosition: t.camera.position.clone()
    };
    const { container: e, camera: o, renderer: s, moleculeContainer: r, options: i } = t;
    this.container = e, this.camera = o, this.renderer = s, this.moleculeContainer = r, this.options = i, this.doubleClickDelay = 300, this.raycaster = new h.Raycaster(), this.raycaster.near = 0.1, this.raycaster.far = 100, this.bindEventHandlers(), this.setupEventListeners();
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
    const t = this.renderer.domElement, {
      wheel: e,
      mouseDown: o,
      mouseMove: s,
      mouseUp: r,
      click: i,
      contextMenu: a,
      touchStart: n,
      touchMove: c,
      touchEnd: d,
      resize: m
    } = this.boundHandlers;
    t.addEventListener("wheel", e, { passive: !1 }), t.addEventListener("mousedown", o), t.addEventListener("mousemove", s), t.addEventListener("mouseup", r), t.addEventListener("mouseleave", r), t.addEventListener("click", i), t.addEventListener("contextmenu", a), t.addEventListener("touchstart", n, { passive: !1 }), t.addEventListener("touchmove", c, { passive: !1 }), t.addEventListener("touchend", d), window.addEventListener("resize", m);
  }
  clientToMouseCoordinates(t, e) {
    const o = this.container.getBoundingClientRect();
    return new h.Vector2(
      (t - o.left) / o.width * 2 - 1,
      -((e - o.top) / o.height) * 2 + 1
    );
  }
  updateMouseCoordinates(t, e) {
    const o = this.clientToMouseCoordinates(t, e);
    this.state.mouse.x = o.x, this.state.mouse.y = o.y;
  }
  handleSelection(t, e) {
    this.updateMouseCoordinates(t.clientX, t.clientY), this.raycaster.setFromCamera(this.state.mouse, this.camera);
    const o = [];
    this.moleculeContainer.traverse((r) => {
      var i;
      (i = r.userData) != null && i.selectable && o.push(r);
    });
    const s = this.raycaster.intersectObjects(o).filter((r) => {
      var i;
      return (i = r.object.userData) == null ? void 0 : i.selectable;
    });
    s.length > 0 ? this.viewer.selections.handle(s[0].object) : e < this.doubleClickDelay && this.viewer.selections.clear(), this.viewer.requestRender();
  }
  handleMouseClick(t, e) {
    const o = this.options.interaction.mouseRaycast;
    this.raycaster.params.Line.threshold = o.lineThreshold, this.raycaster.params.Points.threshold = o.pointsThreshold, this.raycaster.params.Mesh.threshold = o.meshThreshold, this.handleSelection(t, e);
  }
  handleTouchSelect(t, e) {
    const o = this.options.interaction.touchRaycast;
    this.raycaster.params.Line.threshold = o.lineThreshold, this.raycaster.params.Points.threshold = o.pointsThreshold, this.raycaster.params.Mesh.threshold = o.meshThreshold, this.handleSelection(t, e);
  }
  rotateStructure(t) {
    const e = this.options.interaction.rotationSpeed, o = new h.Vector3(1, 0, 0), s = new h.Vector3(0, 1, 0);
    this.moleculeContainer.applyMatrix4(
      new h.Matrix4().makeRotationAxis(s, t.x * e)
    ), this.moleculeContainer.applyMatrix4(
      new h.Matrix4().makeRotationAxis(o, -t.y * e)
    ), this.viewer.requestRender();
  }
  handleZoom(t) {
    const { minDistance: e, maxDistance: o } = this.options.camera, s = o - e, r = this.camera.position.length(), i = h.MathUtils.clamp(
      r + t * s,
      e,
      o
    ), a = this.camera.position.clone().normalize();
    this.camera.position.copy(a.multiplyScalar(i)), this.viewer.requestRender();
  }
  resetCameraPosition() {
    this.camera.position.x = this.state.initialCameraPosition.x, this.camera.position.y = this.state.initialCameraPosition.y, this.camera.rotation.set(0, 0, 0), this.viewer.requestRender();
  }
  panCamera(t) {
    const e = this.camera.position.z, o = this.camera.fov * Math.PI / 180, s = Math.tan(o / 2) * e, r = s * this.camera.aspect, i = -t.x * r, a = -t.y * s, n = new h.Vector3(), c = new h.Vector3();
    this.camera.matrix.extractBasis(n, c, new h.Vector3()), this.camera.position.addScaledVector(n, i), this.camera.position.addScaledVector(c, a), this.viewer.requestRender();
  }
  handleTouchStart(t) {
    t.preventDefault();
    const e = t.touches;
    if (e.length === 1 && !this.state.isDragging)
      this.state.isDragging = !0, this.state.clickStartTime = Date.now(), this.updateMouseCoordinates(e[0].clientX, e[0].clientY);
    else if (e.length === 2) {
      if (!this.state.isDragging) {
        const o = e[0].clientX - e[1].clientX, s = e[0].clientY - e[1].clientY;
        this.state.pinchStartDistance = Math.hypot(o, s);
        const r = this.clientToMouseCoordinates(
          (e[0].clientX + e[1].clientX) / 2,
          (e[0].clientY + e[1].clientY) / 2
        );
        this.state.twoFingerStartPos.copy(r);
      }
      this.state.isDragging = !1;
    }
  }
  handleTouchMove(t) {
    t.preventDefault();
    const e = t.touches;
    if (e.length === 1 && this.state.isDragging) {
      const o = e[0], s = this.clientToMouseCoordinates(o.clientX, o.clientY), r = new h.Vector2(
        s.x - this.state.mouse.x,
        s.y - this.state.mouse.y
      );
      this.rotateStructure(r), this.state.mouse.set(s.x, s.y);
    } else if (e.length === 2) {
      const o = e[0].clientX - e[1].clientX, s = e[0].clientY - e[1].clientY, r = Math.hypot(o, s);
      if (!this.state.pinchStartDistance) {
        this.state.pinchStartDistance = r;
        const n = this.clientToMouseCoordinates(
          (e[0].clientX + e[1].clientX) / 2,
          (e[0].clientY + e[1].clientY) / 2
        );
        this.state.twoFingerStartPos.copy(n);
        return;
      }
      this.handleZoom((this.state.pinchStartDistance - r) * this.options.camera.pinchZoomSpeed), this.state.pinchStartDistance = r;
      const i = this.clientToMouseCoordinates(
        (e[0].clientX + e[1].clientX) / 2,
        (e[0].clientY + e[1].clientY) / 2
      ), a = i.clone().sub(this.state.twoFingerStartPos);
      this.panCamera(a), this.state.twoFingerStartPos.copy(i);
    }
  }
  handleTouchEnd(t) {
    if (t.cancelable && t.preventDefault(), t.touches.length === 0 && t.changedTouches.length > 0) {
      if (Date.now() - this.state.clickStartTime < this.options.interaction.clickThreshold) {
        const o = t.changedTouches[0], s = Date.now(), r = {
          clientX: o.clientX,
          clientY: o.clientY
        };
        this.handleTouchSelect(r, s - this.state.lastClickTime), this.state.lastClickTime = s;
      }
      this.state.isDragging = !1, this.state.pinchStartDistance = 0;
    }
  }
  handleContextMenu(t) {
    t.preventDefault();
    const e = Date.now();
    e - this.state.lastRightClickTime < this.doubleClickDelay && this.resetCameraPosition(), this.state.lastRightClickTime = e;
  }
  handleMouseDown(t) {
    t.button === 2 ? this.state.isPanning = !0 : this.state.isDragging = !0, this.state.clickStartTime = Date.now(), this.updateMouseCoordinates(t.clientX, t.clientY);
  }
  handleMouseMove(t) {
    if (!this.state.isDragging && !this.state.isPanning)
      return;
    const e = this.container.getBoundingClientRect(), o = new h.Vector2(
      (t.clientX - e.left) / e.width * 2 - 1,
      -((t.clientY - e.top) / e.height) * 2 + 1
    ), s = o.clone().sub(this.state.mouse);
    this.state.isPanning ? this.panCamera(s) : this.rotateStructure(s), this.state.mouse.copy(o);
  }
  handleMouseUp() {
    this.state.isDragging = !1, this.state.isPanning = !1;
  }
  handleClick(t) {
    if (t.button !== 0 || Date.now() - this.state.clickStartTime > this.options.interaction.clickThreshold || this.state.isDragging)
      return;
    const o = Date.now();
    this.handleMouseClick(t, o - this.state.lastClickTime), this.state.lastClickTime = o;
  }
  handleWheel(t) {
    t.preventDefault(), this.handleZoom(t.deltaY * this.options.camera.wheelZoomSpeed);
  }
  handleResize() {
    const t = this.container.getBoundingClientRect(), e = t.width / t.height;
    this.camera.aspect = e;
    const o = this.options.camera.fov;
    t.width < t.height ? this.camera.fov = 2 * Math.atan(Math.tan(o * Math.PI / 360) / e) * 180 / Math.PI : this.camera.fov = o, this.camera.updateProjectionMatrix(), this.renderer.setSize(t.width, t.height), this.viewer.requestRender();
  }
  dispose() {
    const t = this.renderer.domElement, {
      wheel: e,
      mouseDown: o,
      mouseMove: s,
      mouseUp: r,
      click: i,
      contextMenu: a,
      touchStart: n,
      touchMove: c,
      touchEnd: d,
      resize: m
    } = this.boundHandlers;
    t.removeEventListener("wheel", e), t.removeEventListener("mousedown", o), t.removeEventListener("mousemove", s), t.removeEventListener("mouseup", r), t.removeEventListener("mouseleave", r), t.removeEventListener("click", i), t.removeEventListener("contextmenu", a), t.removeEventListener("touchstart", n), t.removeEventListener("touchmove", c), t.removeEventListener("touchend", d), window.removeEventListener("resize", m);
  }
}
class le {
  constructor(t) {
    this.options = t, this.selectedObjects = /* @__PURE__ */ new Set(), this.selectionCallbacks = /* @__PURE__ */ new Set(), this.selectedData = /* @__PURE__ */ new Set();
  }
  pruneInvalidSelections(t) {
    this.selectedObjects.clear();
    const e = /* @__PURE__ */ new Set();
    t.traverse((o) => {
      var s;
      if ((s = o.userData) != null && s.selectable) {
        const r = this.getObjectData(o);
        r && e.add(JSON.stringify(r));
      }
    }), this.selectedData = new Set(
      Array.from(this.selectedData).filter(
        (o) => e.has(JSON.stringify({
          type: o.type,
          ...this.getDataWithoutColor(o)
        }))
      )
    ), t.traverse((o) => {
      var s;
      if ((s = o.userData) != null && s.selectable) {
        const r = this.getObjectData(o);
        if (this.hasMatchingData(r)) {
          const i = this.getColorForData(r);
          o.select(i, this.options), this.selectedObjects.add(o);
        }
      }
    }), this.notifyCallbacks();
  }
  getDataWithoutColor(t) {
    const { color: e, ...o } = t;
    return o;
  }
  getObjectData(t) {
    if (!t.userData)
      return null;
    switch (t.userData.type) {
      case "atom":
        return {
          type: "atom",
          label: t.userData.atomData.label
        };
      case "bond":
        return {
          type: "bond",
          atom1: t.userData.bondData.atom1Label,
          atom2: t.userData.bondData.atom2Label
        };
      case "hbond":
        return {
          type: "hbond",
          donor: t.userData.hbondData.donorAtomLabel,
          hydrogen: t.userData.hbondData.hydrogenAtomLabel,
          acceptor: t.userData.hbondData.acceptorAtomLabel
        };
      default:
        return null;
    }
  }
  hasMatchingData(t) {
    return t ? Array.from(this.selectedData).some((e) => this.matchData(e, t)) : !1;
  }
  getColorForData(t) {
    const e = Array.from(this.selectedData).find((o) => this.matchData(o, t));
    return e ? e.color : this.getNextColor();
  }
  handle(t) {
    this.options.mode === "single" && (this.selectedObjects.forEach((s) => {
      this.remove(s);
    }), this.selectedObjects.clear(), this.selectedData.clear());
    const e = this.getObjectData(t);
    if (!e)
      return null;
    let o;
    return this.hasMatchingData(e) ? (o = t.selectionColor, this.remove(t), this.selectedData = new Set(
      Array.from(this.selectedData).filter((s) => !this.matchData(s, e))
    )) : (o = this.getNextColor(), this.add(t, o), this.selectedData.add({ ...e, color: o })), this.notifyCallbacks(), o;
  }
  matchData(t, e) {
    if (t.type !== e.type)
      return !1;
    switch (t.type) {
      case "atom":
        return t.label === e.label;
      case "bond":
        return t.atom1 === e.atom1 && t.atom2 === e.atom2 || t.atom1 === e.atom2 && t.atom2 === e.atom1;
      case "hbond":
        return t.donor === e.donor && t.hydrogen === e.hydrogen && t.acceptor === e.acceptor;
      default:
        return !1;
    }
  }
  add(t, e) {
    t.select(e || this.getNextColor(), this.options), this.selectedObjects.add(t);
  }
  remove(t) {
    this.selectedObjects.delete(t), t.deselect();
  }
  clear() {
    this.selectedObjects.forEach((t) => {
      this.remove(t);
    }), this.selectedObjects.clear(), this.selectedData.clear(), this.notifyCallbacks();
  }
  getNextColor() {
    const t = /* @__PURE__ */ new Map();
    this.selectedData.forEach((o) => {
      t.set(o.color, (t.get(o.color) || 0) + 1);
    });
    let e = this.options.selection.markerColors.find((o) => !t.has(o));
    if (!e) {
      const o = Math.min(...t.values());
      e = this.options.selection.markerColors.find(
        (s) => t.get(s) === o
      );
    }
    return e;
  }
  onChange(t) {
    this.selectionCallbacks.add(t);
  }
  notifyCallbacks() {
    const t = Array.from(this.selectedObjects).map((e) => ({
      type: e.userData.type,
      data: e.userData.type === "hbond" ? e.userData.hbondData : e.userData.type === "bond" ? e.userData.bondData : e.userData.atomData,
      color: e.selectionColor
    }));
    this.selectionCallbacks.forEach((e) => e(t));
  }
  setMode(t) {
    if (t !== "single" && t !== "multiple")
      throw new Error('Selection mode must be either "single" or "multiple"');
    if (this.options.mode = t, t === "single" && this.selectedObjects.size > 1) {
      const e = Array.from(this.selectedObjects), o = e[e.length - 1], s = this.getObjectData(o);
      this.clear(), s && (this.add(o), this.selectedData.add({ ...s, color: o.selectionColor })), this.notifyCallbacks();
    }
  }
  dispose() {
    this.clear(), this.selectionCallbacks.clear();
  }
}
class xt {
  constructor(t, e = {}) {
    const o = ["constant", "onDemand"];
    if (e.renderMode && !o.includes(e.renderMode))
      throw new Error(
        `Invalid render mode: "${e.renderMode}". Must be one of: ${o.join(", ")}`
      );
    this.container = t, this.options = {
      camera: {
        ..._.camera,
        initialPosition: new h.Vector3(..._.camera.initialPosition),
        ...e.camera || {}
      },
      selection: {
        ..._.selection,
        ...e.selection || {}
      },
      interaction: {
        ..._.interaction,
        ...e.interaction || {}
      },
      atomDetail: e.atomDetail || _.atomDetail,
      atomColorRoughness: e.atomColorRoughness || _.atomColorRoughness,
      atomColorMetalness: e.atomColorMetalness || _.atomColorMetalness,
      atomADPRingWidthFactor: e.atomADPRingWidthFactor || _.atomADPRingWidthFactor,
      atomADPRingHeight: e.atomADPRingHeight || _.atomADPRingHeight,
      atomADPRingSections: e.atomADPRingSections || _.atomADPRingSections,
      bondRadius: e.bondRadius || _.bondRadius,
      bondSections: e.bondSections || _.bondSections,
      bondColor: e.bondColor || _.bondColor,
      bondColorRoughness: e.bondColorRoughness || _.bondColorRoughness,
      bondColorMetalness: e.bondColorMetalness || _.bondColorMetalness,
      bondGrowToleranceFactor: e.bondGrowToleranceFactor || _.bondGrowToleranceFactor,
      elementProperties: {
        ..._.elementProperties,
        ...e.elementProperties
      },
      hydrogenMode: e.hydrogenMode || _.hydrogenMode,
      disorderMode: e.disorderMode || _.disorderMode,
      symmetryMode: e.symmetryMode || _.symmetryMode,
      renderMode: e.renderMode || _.renderMode,
      fixCifErrors: e.fixCifErrors || _.fixCifErrors
    }, this.state = {
      isDragging: !1,
      currentCifContent: null,
      currentStructure: null,
      currentFloor: null,
      baseStructure: null,
      ortepObjects: /* @__PURE__ */ new Map(),
      structureCenter: new h.Vector3()
    }, this.modifiers = {
      removeatoms: new nt(),
      addhydrogen: new ct(),
      missingbonds: new lt(
        this.options.elementProperties,
        this.options.bondGrowToleranceFactor
      ),
      hydrogen: new it(this.options.hydrogenMode),
      disorder: new at(this.options.disorderMode),
      symmetry: new K(this.options.symmetryMode)
    }, this.selections = new le(this.options), this.setupScene(), this.controls = new ne(this), this.animate(), this.needsRender = !0;
  }
  setupScene() {
    this.scene = new h.Scene(), this.camera = new h.PerspectiveCamera(
      this.options.camera.fov,
      this.container.clientWidth / this.container.clientHeight,
      this.options.camera.near,
      this.options.camera.far
    ), this.renderer = new h.WebGLRenderer({ antialias: !0, alpha: !0 }), this.renderer.setSize(this.container.clientWidth, this.container.clientHeight), this.container.appendChild(this.renderer.domElement), this.moleculeContainer = new h.Group(), this.scene.add(this.moleculeContainer), this.camera.position.copy(this.options.camera.initialPosition), this.cameraTarget = new h.Vector3(0, 0, 0), this.camera.lookAt(this.cameraTarget);
  }
  async loadStructure(t, e = 0) {
    if (t === void 0)
      return console.error("Cannot load an empty text as CIF"), { success: !1, error: "Cannot load an empty text as CIF" };
    try {
      const o = new Ft(t);
      try {
        this.state.baseStructure = T.fromCIF(o.getBlock(e));
      } catch (s) {
        if (this.options.fixCifErrors)
          throw s;
        try {
          const r = ee(o.getBlock(e));
          this.state.baseStructure = T.fromCIF(r);
        } catch {
          throw s;
        }
      }
      return await this.setupNewStructure(), { success: !0 };
    } catch (o) {
      return console.error("Error loading structure:", o), { success: !1, error: o.message };
    }
  }
  async setupNewStructure() {
    this.selections.clear(), this.moleculeContainer.position.set(0, 0, 0), this.moleculeContainer.rotation.set(0, 0, 0), this.moleculeContainer.scale.set(1, 1, 1), this.moleculeContainer.updateMatrix(), this.moleculeContainer.matrixAutoUpdate = !0, this.moleculeContainer.updateMatrixWorld(!0), this.cameraTarget.set(0, 0, 0), this.camera.position.copy(this.options.camera.initialPosition), this.camera.lookAt(this.cameraTarget), this.state.structureCenter.set(0, 0, 0), this.update3DOrtep();
    const t = ie(this.state.currentStructure);
    return this.container.clientHeight > this.container.clientWidth && t.premultiply(new h.Matrix4().makeRotationZ(Math.PI / 2)), t && (this.moleculeContainer.setRotationFromMatrix(t), this.moleculeContainer.updateMatrix()), new h.Box3().setFromObject(this.moleculeContainer).getCenter(this.state.structureCenter), this.moleculeContainer.position.sub(this.state.structureCenter), this.updateCamera(), ae(this.scene, this.state.currentStructure), this.requestRender(), { success: !0 };
  }
  async updateStructure() {
    try {
      const t = this.moleculeContainer.matrix.clone();
      return this.update3DOrtep(), this.moleculeContainer.matrix.copy(t), this.moleculeContainer.matrixAutoUpdate = !1, this.requestRender(), { success: !0 };
    } catch (t) {
      return console.error("Error updating structure:", t), { success: !1, error: t.message };
    }
  }
  update3DOrtep() {
    this.removeStructure();
    let t = this.state.baseStructure;
    for (const s of Object.values(this.modifiers))
      t = s.apply(t);
    const o = new qt(t, this.options).getGroup();
    this.moleculeContainer.add(o), this.state.currentStructure = o, this.selections.pruneInvalidSelections(this.moleculeContainer);
  }
  updateCamera() {
    this.controls.handleResize();
    const t = re(this.moleculeContainer, this.camera);
    this.camera.position.set(0, 0, t), this.camera.rotation.set(0, 0, 0), this.camera.lookAt(this.cameraTarget), this.options.camera.minDistance = t * 0.2, this.options.camera.maxDistance = t * 2;
  }
  removeStructure() {
    this.moleculeContainer.traverse((t) => {
      t.geometry && t.geometry.dispose(), t.material && t.material.dispose();
    }), this.moleculeContainer.clear();
  }
  async cycleModifierMode(t) {
    const e = this.modifiers[t], o = e.cycleMode(this.state.baseStructure);
    let s;
    return e.requiresCameraUpdate ? s = await this.setupNewStructure() : s = await this.updateStructure(), { ...s, mode: o };
  }
  numberModifierModes(t) {
    if (!this.state.baseStructure)
      return !1;
    const e = this.modifiers.removeatoms.apply(this.state.baseStructure);
    return this.modifiers[t].getApplicableModes(e).length;
  }
  animate() {
    (this.options.renderMode === "constant" || this.needsRender) && (this.renderer.render(this.scene, this.camera), this.needsRender = !1), requestAnimationFrame(this.animate.bind(this));
  }
  requestRender() {
    this.options.renderMode === "onDemand" && (this.needsRender = !0);
  }
  selectAtoms(t) {
    this.selections.selectAtoms(t, this.moleculeContainer);
  }
  dispose() {
    this.controls.dispose(), this.scene.traverse((t) => {
      t.geometry && t.geometry.dispose(), t.material && (Array.isArray(t.material) ? t.material.forEach((e) => e.dispose()) : t.material.dispose());
    }), this.selections.dispose(), this.renderer.dispose(), this.renderer.domElement.parentNode && this.renderer.domElement.parentNode.removeChild(this.renderer.domElement), this.scene = null, this.camera = null, this.renderer = null, this.state = null, this.options = null;
  }
}
const ce = {
  disorder: {
    all: '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><g id="g8" transform="translate(0,-0.09016496)"><g id="g7" transform="translate(0,0.52916667)"><g id="path2-16" transform="rotate(180,28.623599,19.40998)" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3-6" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4-1" /></g><g id="path2-1-2" transform="rotate(180,28.623599,19.40998)" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5-7" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6-5" /></g><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-9" cx="-28.593182" cy="-24.863596" r="2.3135188" transform="scale(-1)" /><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-2-3" cx="-33.888008" cy="-14.141389" r="2.3135188" transform="scale(-1)" /><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-7-9" cx="-23.298351" cy="-14.141389" r="2.3135188" transform="scale(-1)" /></g><g id="g6" transform="translate(0,-0.52916663)"><g id="path2" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4" /></g><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-2" cx="23.35919" cy="24.678572" r="2.3135188" /><g id="path2-1" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6" /></g><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1" cx="28.654018" cy="13.956366" r="2.3135188" /><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-7" cx="33.948849" cy="24.678572" r="2.3135188" /></g></g></g></svg>',
    group1: '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><g id="path2-16" transform="rotate(180,28.623599,19.629481)" style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3-6" /><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4-1" /></g><g id="path2-1-2" transform="rotate(180,28.623599,19.629481)" style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5-7" /><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6-5" /></g><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1-9" cx="-28.593182" cy="-25.302597" r="2.3135188" transform="scale(-1)" /><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1-2-3" cx="-33.888008" cy="-14.580391" r="2.3135188" transform="scale(-1)" /><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1-7-9" cx="-23.298351" cy="-14.580391" r="2.3135188" transform="scale(-1)" /><g id="g6" transform="translate(0,-0.61933159)"><g id="path2" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4" /></g><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-2" cx="23.35919" cy="24.678572" r="2.3135188" /><g id="path2-1" style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6" /></g><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1" cx="28.654018" cy="13.956366" r="2.3135188" /><circle style="fill:#000000;stroke:#000000;stroke-width:0.564999" id="path1-7" cx="33.948849" cy="24.678572" r="2.3135188" /></g></g></svg>',
    group2: '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><g id="path2-16" transform="rotate(180,28.623599,19.629481)" style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3-6" /><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4-1" /></g><g id="path2-1-2" transform="rotate(180,28.623599,19.629481)" style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5-7" /><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6-5" /></g><circle style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1" id="path1-9" cx="-28.593182" cy="-25.302597" r="2.3135188" transform="scale(-1)" /><circle style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1" id="path1-2-3" cx="-33.888008" cy="-14.580391" r="2.3135188" transform="scale(-1)" /><circle style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1" id="path1-7-9" cx="-23.298351" cy="-14.580391" r="2.3135188" transform="scale(-1)" /><g id="path2" style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" transform="translate(0,-0.61933159)"><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.707504,13.775784 -5.401798,11.08337" id="path3" /><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z" id="path4" /></g><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1-2" cx="23.35919" cy="24.05924" r="2.3135188" /><g id="path2-1" style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" transform="translate(0,-0.61933159)"><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 28.600535,13.775784 5.401798,11.08337" id="path5" /><path style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1" d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z" id="path6" /></g><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1" cx="28.654018" cy="13.337034" r="2.3135188" /><circle style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1" id="path1-7" cx="33.948849" cy="24.05924" r="2.3135188" /></g></svg>'
  },
  hydrogen: {
    anisotropic: '<svg width="17.85038mm" height="17.850386mm" viewBox="0 0 17.85038 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-78.600695,-38.873141)"><text xml:space="preserve" style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" x="84.344688" y="50.876183" id="text3-1-5-9"><tspan id="tspan3-4-4-0" style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1" x="84.344688" y="50.876183">H</tspan></text><ellipse style="fill:none;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" id="path7-4" cx="41.174881" cy="90.830009" rx="4.9952669" ry="9.7379656" transform="rotate(-36.975178)" /></g></svg>',
    constant: '<svg width="17.850388mm" height="17.850386mm" viewBox="0 0 17.850388 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-58.39314,-38.873141)"><text xml:space="preserve" style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" x="64.137131" y="50.876183" id="text3-1-8"><tspan id="tspan3-4-1" style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1" x="64.137131" y="50.876183">H</tspan></text><circle style="fill:none;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" id="path6-0" cx="67.318336" cy="47.798332" r="6.8755083" /></g></svg>',
    none: '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-37.755639,-38.873141)"><text xml:space="preserve" style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" x="43.499626" y="50.876183" id="text3-6" ><tspan id="tspan3-5" style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1" x="43.499626" y="50.876183">H</tspan></text><path style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" d="m 39.917575,41.035079 13.526512,13.52651" id="path5-9" /><path style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" d="M 53.444087,41.035079 39.917575,54.561589" id="path5-1-0" /></g></svg>'
  },
  symmetry: {
    "bonds-no-hbonds-no": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><rect style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="23.823376" /><g id="path8" style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#808080;fill-opacity:1"><path style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="14.248425" r="2.3135188" /><circle style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-7" cx="33.972233" cy="14.248425" r="2.3135188" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108" d="m 23.654019,24.391204 h 10" id="path25" /><path style="color:#000000;fill:#808080;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1" d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-53" cx="33.972233" cy="24.391207" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="24.391207" r="2.3135188" /><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /></g></svg>',
    "bonds-no-hbonds-none": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><g id="path8" style="fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" transform="translate(0,5.0717688)"><path style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="19.319817" r="2.3135188" /><circle style="fill:#808080;fill-opacity:1;stroke:none;stroke-width:0.564999" id="path1-7-7" cx="33.972233" cy="19.319817" r="2.3135188" /><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /></g></svg>',
    "bonds-no-hbonds-yes": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><rect style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="23.823376" /><g id="path8" style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#808080;fill-opacity:1"><path style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="14.248425" r="2.3135188" /><circle style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-7" cx="33.972233" cy="14.248425" r="2.3135188" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108;fill-opacity:1" d="m 23.654019,24.391204 h 10" id="path25" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1" d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-53" cx="33.972233" cy="24.391207" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="24.391207" r="2.3135188" /><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /></g></svg>',
    "bonds-none-hbonds-no": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><rect style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="18.752567" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108" d="m 23.654019,19.319816 h 10" id="path25" /><path style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1" d="m 23.625124,18.720207 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#808080;fill-opacity:1;stroke:none;stroke-width:0.564999" id="path1-7-53" cx="33.972233" cy="19.319817" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="19.319817" r="2.3135188" /><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /></g></svg>',
    "bonds-none-hbonds-yes": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /><rect style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="18.752567" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108" d="m 23.654019,19.319816 h 10" id="path25" /><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1" d="m 23.625124,18.720207 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999" id="path1-7-53" cx="33.972233" cy="19.319817" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="19.319817" r="2.3135188" /></g></svg>',
    "bonds-yes-hbonds-no": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><rect style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="23.823376" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108" d="m 23.654019,24.391204 h 10" id="path25" /><path style="color:#000000;fill:#808080;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1" d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-53" cx="33.972233" cy="24.391207" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="24.391207" r="2.3135188" /><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /><g id="path8" style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#000000;fill-opacity:1"><path style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="14.248425" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-7" cx="33.972233" cy="14.248425" r="2.3135188" /></g></svg>',
    "bonds-yes-hbonds-none": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /><g id="path8" style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" transform="translate(0,5.0717688)"><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="19.319817" r="2.3135188" /><circle style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999" id="path1-7-7" cx="33.972233" cy="19.319817" r="2.3135188" /></g></svg>',
    "bonds-yes-hbonds-yes": '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1" /><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><path style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none" d="M 28.654019,10.932651 V 27.762155" id="path7" /><g id="path8" style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#000000;fill-opacity:1"><path style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654019,14.248425 h 10" id="path23" /><path style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1" d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z" id="path22" /></g><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7" cx="23.335806" cy="14.248425" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-7" cx="33.972233" cy="14.248425" r="2.3135188" /><rect style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1" id="rect25" width="1.3572845" height="1.1344972" x="27.961069" y="23.823376" /><path style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108" d="m 23.654019,24.391204 h 10" id="path25" /><path style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1" d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z" id="path24" /><circle style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1" id="path1-7-53" cx="33.972233" cy="24.391207" r="2.3135188" /><circle style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none" id="path1-7-5" cx="23.335806" cy="24.391207" r="2.3135188" /></g></svg>'
  },
  upload: '<svg width="17.850384mm" height="17.850386mm" viewBox="0 0 17.850384 17.850386" version="1.1" id="svg1" (0e150ed6c4, 2023-07-21)"xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" showguides="false" /><defs id="defs1"><marker style="overflow:visible" id="ArrowWide" refX="0" refY="0" orient="auto-start-reverse" arrow" markerWidth="1" markerHeight="1" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid"><path style="fill:none;stroke:context-stroke;stroke-width:1;stroke-linecap:butt" d="M 3,-3 0,0 3,3" transform="rotate(180,0.125,0)" id="path1" /></marker></defs><g 1" id="layer1" transform="translate(-19.728827,-10.394623)"><text xml:space="preserve" style="font-size:7.05556px;fill:#e6e6e6;stroke:none;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none" x="22.242813" y="28.151989" id="text2"><tspan id="tspan2" style="font-size:7.05556px;fill:#1a1a1a;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none" x="22.242813" y="28.151989">CIF</tspan></text><path style="fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1" d="m 20.714121,18.107197 v 3.07807 h 15.879794 v -3.07807" id="path2" /><path style="fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1;marker-end:url(#ArrowWide)" d="M 28.654018,19.170064 V 11.045456" id="path3" /></g></svg>'
}, de = `
  cifview-widget {
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    height: 100%;
    position: relative;
    background: #fafafa;
    border-radius: 8px;
    overflow: hidden;
  }
  
  cifview-widget .crystal-container {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  
  cifview-widget .crystal-caption {
    padding: 12px 16px;
    background: #ffffff;
    border-top: 1px solid #eaeaea;
    color: #333;
    font-size: 14px;
    line-height: 1.5;
  }

  cifview-widget .button-container {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 1000;
  }

  cifview-widget .control-button {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  cifview-widget .control-button:hover {
    background: #ffffff;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  cifview-widget .control-button svg {
    width: 24px;
    height: 24px;
  }
`;
class he extends HTMLElement {
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
      "symmetry-mode"
    ];
  }
  constructor() {
    if (super(), !document.getElementById("cifview-styles")) {
      const t = document.createElement("style");
      t.id = "cifview-styles", t.textContent = de, document.head.appendChild(t);
    }
    this.viewer = null, this.baseCaption = "", this.selections = [], this.customIcons = null, this.userOptions = {};
  }
  get icons() {
    return { ...ce, ...this.customIcons };
  }
  async connectedCallback() {
    this.baseCaption = this.getAttribute("caption") || "", this.parseOptions(), this.parseInitialModes();
    const t = document.createElement("div");
    t.className = "crystal-container", this.appendChild(t);
    const e = document.createElement("div");
    e.className = "button-container", t.appendChild(e), this.buttonContainer = e;
    const o = document.createElement("div");
    o.className = "crystal-caption", o.innerHTML = this.baseCaption, this.appendChild(o), this.captionElement = o, this.viewer = new xt(t, this.userOptions), this.viewer.selections.onChange((i) => {
      this.selections = i, this.updateCaption();
    }), this.customIcons = this.parseCustomIcons(), await this.updateFilteredAtoms();
    const s = this.getAttribute("src"), r = this.getAttribute("data");
    s ? await this.loadFromUrl(s) : r && await this.loadFromString(r);
  }
  parseOptions() {
    const t = this.getAttribute("options");
    if (t)
      try {
        const e = JSON.parse(t);
        this.userOptions = this.mergeOptions(e);
      } catch (e) {
        console.warn("Failed to parse options:", e);
      }
  }
  mergeOptions(t) {
    const e = { ..._ };
    return Object.keys(t).forEach((o) => {
      o === "elementProperties" ? (e.elementProperties = { ...e.elementProperties }, Object.keys(t.elementProperties || {}).forEach((s) => {
        e.elementProperties[s] = {
          ...e.elementProperties[s] || {},
          ...t.elementProperties[s]
        };
      })) : typeof t[o] == "object" && t[o] !== null ? e[o] = {
        ...e[o] || {},
        ...t[o]
      } : e[o] = t[o];
    }), e;
  }
  parseInitialModes() {
    const t = this.getAttribute("hydrogen-mode"), e = this.getAttribute("disorder-mode"), o = this.getAttribute("symmetry-mode");
    t && (this.userOptions.hydrogenMode = t), e && (this.userOptions.disorderMode = e), o && (this.userOptions.symmetryMode = o);
  }
  clearButtons() {
    if (this.buttonContainer)
      for (; this.buttonContainer.firstChild; )
        this.buttonContainer.removeChild(this.buttonContainer.firstChild);
  }
  setupButtons() {
    !this.viewer || !this.viewer.state.baseStructure || (this.clearButtons(), this.viewer.numberModifierModes("hydrogen") > 1 && this.addButton(this.buttonContainer, "hydrogen", "Toggle Hydrogen Display"), this.viewer.numberModifierModes("disorder") > 2 && this.addButton(this.buttonContainer, "disorder", "Toggle Disorder Display"), this.viewer.numberModifierModes("symmetry") > 1 && this.addButton(this.buttonContainer, "symmetry", "Toggle Symmetry Display"));
  }
  parseCustomIcons() {
    try {
      let t;
      try {
        t = JSON.parse(this.getAttribute("icons"));
      } catch {
        throw new Error("Failed to parse custom icon definition. Needs to be valid JSON.");
      }
      if (!t)
        return null;
      const e = Object.getOwnPropertyNames(t), o = Object.getOwnPropertyNames(this.viewer.modifiers), s = e.filter((a) => !o.includes(a));
      if (s.length > 0)
        throw new Error(
          `One or more invalid categories for custom icons: ${s.join(", ")}. Valid categories: ${o.join(", ")}`
        );
      const r = {}, i = [];
      for (const a of e) {
        r[a] = {};
        const n = Object.values(this.viewer.modifiers[a].MODES);
        Object.getOwnPropertyNames(t[e]).forEach((d) => {
          n.includes(d) ? r[a][d] = t[a][d] : i.push([a, d]);
        });
      }
      if (i.length > 0) {
        const a = i.map(([n, c]) => `${n}: ${c}`).join(" ,");
        throw new Error(`The following custom icons do not map to a valid mode: ${a}`);
      }
      return r;
    } catch (t) {
      return console.warn("Failed to parse custom icons:", t), null;
    }
  }
  async updateFilteredAtoms() {
    const t = this.getAttribute("filtered-atoms");
    this.viewer.modifiers.removeatoms.setFilteredLabels(t || ""), t && t.trim() ? this.viewer.modifiers.removeatoms.mode = "on" : this.viewer.modifiers.removeatoms.mode = "off", this.setupButtons();
  }
  addButton(t, e, o) {
    const s = document.createElement("button");
    s.className = `control-button ${e}-button`;
    const r = this.viewer.modifiers[e].mode;
    s.innerHTML = this.icons[e][r], s.title = o;
    const i = s.querySelector("svg");
    i && (i.setAttribute("alt", o), i.setAttribute("role", "img"), i.setAttribute("aria-label", o)), t.appendChild(s), s.addEventListener("click", async () => {
      const a = await this.viewer.cycleModifierMode(e);
      a.success && (s.innerHTML = this.icons[e][a.mode]);
    });
  }
  async attributeChangedCallback(t, e, o) {
    if (this.viewer)
      switch (t) {
        case "caption":
          this.baseCaption = o, this.updateCaption();
          break;
        case "src":
          o && await this.loadFromUrl(o);
          break;
        case "data":
          o && await this.loadFromString(o);
          break;
        case "icons":
          this.customIcons = this.parseCustomIcons();
          break;
        case "filtered-atoms":
          await this.updateFilteredAtoms(), await this.viewer.updateStructure();
          break;
        case "options":
          if (this.parseOptions(), this.viewer) {
            const s = this.querySelector(".crystal-container"), r = this.viewer.state.currentCifContent;
            this.viewer.dispose(), this.viewer = new xt(s, this.userOptions), this.viewer.selections.onChange((i) => {
              this.selections = i, this.updateCaption();
            }), r && (await this.viewer.loadStructure(r), this.setupButtons());
          }
          break;
        case "hydrogen-mode":
          this.viewer.modifiers.hydrogen && (this.viewer.modifiers.hydrogen.mode = o, await this.viewer.updateStructure(), this.setupButtons());
          break;
        case "disorder-mode":
          this.viewer.modifiers.disorder && (this.viewer.modifiers.disorder.mode = o, await this.viewer.updateStructure(), this.setupButtons());
          break;
        case "symmetry-mode":
          this.viewer.modifiers.symmetry && (this.viewer.modifiers.symmetry.mode = o, await this.viewer.setupNewStructure(), this.setupButtons());
          break;
      }
  }
  async loadFromUrl(t) {
    try {
      const e = await fetch(t);
      if (!e.ok)
        throw new Error(`Failed to load CIF file: ${e.status} ${e.statusText}`);
      const o = e.headers.get("content-type");
      if (o && o.includes("text/html"))
        throw new Error("Received no or invalid content for src.");
      const s = await e.text();
      if (s.includes("<!DOCTYPE html>") || s.includes("<html>"))
        throw new Error("Received no or invalid content for src.");
      const r = await this.viewer.loadStructure(s);
      if (r.success)
        this.setupButtons();
      else
        throw new Error(r.error || "Unknown Error");
    } catch (e) {
      this.createErrorDiv(e);
    }
  }
  async loadFromString(t) {
    try {
      await this.viewer.loadStructure(t), this.setupButtons();
    } catch (e) {
      this.createErrorDiv(e);
    }
  }
  createErrorDiv(t) {
    if (console.error("Error loading structure:", t), this.baseCaption = `Error loading structure: ${t.message}`, this.updateCaption(), this.viewer) {
      const e = this.querySelector(".crystal-container");
      if (e) {
        for (; e.firstChild; )
          e.firstChild.remove();
        const o = document.createElement("div");
        o.style.display = "flex", o.style.justifyContent = "center", o.style.alignItems = "center", o.style.height = "100%", o.style.padding = "20px", o.style.textAlign = "center", o.style.color = "#d32f2f", o.innerHTML = `<div>
                    <h3>Error Loading Structure</h3>
                    <p>${t.message}</p>
                    <p>Please check that the file exists and is a valid CIF file.</p>
                </div>`, e.appendChild(o);
      }
    }
  }
  updateCaption() {
    let t = this.baseCaption;
    if (this.selections.length > 0) {
      t.endsWith(".") || (t += "."), t += " Selected Atoms and Bonds: ";
      const e = this.selections.map((o) => {
        const s = "#" + o.color.toString(16).padStart(6, "0");
        let r = "";
        if (o.type === "atom")
          r = `${o.data.label} (${o.data.atomType})`;
        else if (o.type === "bond") {
          const i = Jt(o.data.bondLength, o.data.bondLengthSU);
          r = `${o.data.atom1Label}-${o.data.atom2Label}: ${i} Å`;
        } else o.type === "hbond" && (r = `${o.data.donorAtomLabel}→${o.data.acceptorAtomLabel}`);
        return `<span style="color:${s}">${r}</span>`;
      }).join(", ");
      t += e + ".";
    }
    this.captionElement.innerHTML = t, this.viewer.controls.handleResize();
  }
  disconnectedCallback() {
    this.viewer && this.viewer.dispose();
  }
}
if (typeof window < "u" && window.customElements)
  try {
    window.customElements.define("cifview-widget", he);
  } catch (l) {
    l.message.includes("already been defined") || console.warn("Failed to register cifview-widget:", l);
  }
export {
  nt as AtomLabelFilter,
  lt as BondGenerator,
  Ft as CIF,
  he as CifViewWidget,
  T as CrystalStructure,
  xt as CrystalViewer,
  at as DisorderFilter,
  it as HydrogenFilter,
  qt as ORTEP3JsStructure,
  K as SymmetryGrower,
  Jt as formatValueEsd,
  ee as tryToFixCifBlock
};
