import { a as e, i as t, n, r, t as i } from "./disorder-icons-C_i0p1BR.js";
//#region src/lib/ortep3d/viewer-interaction-coupling.js
function a(e) {
	let t = e?.viewer || e;
	if (!t?.controls?.onInteraction || typeof t.controls.applyCoupledInteraction != "function" || typeof t.requestRender != "function") throw Error("Coupled participants must be CrystalViewer or initialized cifview-widget instances");
	return t;
}
function o(e) {
	return typeof requestAnimationFrame == "function" ? requestAnimationFrame(e) : setTimeout(e, 0);
}
function s(e) {
	typeof cancelAnimationFrame == "function" ? cancelAnimationFrame(e) : clearTimeout(e);
}
var c = [
	"hydrogen",
	"disorder",
	"symmetry"
], l = class {
	constructor(e = [], t = {}) {
		this.coupleModes = t.coupleModes !== !1, this.viewers = /* @__PURE__ */ new Map(), this.pendingInteractions = [], this.pendingFrame = null, this.pendingModeUpdate = Promise.resolve(), e.forEach((e) => this.add(e));
	}
	add(e) {
		let t = a(e);
		if (this.viewers.has(t)) return this;
		let n = t.controls.onInteraction((e) => {
			this.enqueue(t, e);
		}), r = this.coupleModes ? t.onModifierModeChange?.((e) => {
			this.enqueueModeChange(t, e);
		}) ?? (() => {}) : (() => {});
		return this.viewers.set(t, {
			stopInteraction: n,
			stopMode: r
		}), this;
	}
	async synchronizeFrom(e, t = {}) {
		let n = a(e);
		if (!this.viewers.has(n)) throw Error("The synchronization source must belong to this coupling");
		if (!(t.modes ?? this.coupleModes)) return this.#e(n), this;
		let r = Object.fromEntries(c.map((e) => [e, n.modifiers[e]?.mode]).filter(([, e]) => e !== void 0));
		return await Promise.all([...this.viewers.keys()].filter((e) => e !== n).map((e) => e.setModifierModes?.(r, { broadcast: !1 }))), this.#e(n), this;
	}
	synchronizeViewFrom(e) {
		let t = a(e);
		if (!this.viewers.has(t)) throw Error("The synchronization source must belong to this coupling");
		return this.#e(t), this;
	}
	#e(e) {
		e.moleculeContainer.updateMatrix();
		let t = e.moleculeContainer.matrix.toArray(), n = e.cameraController.getCoupledViewState();
		for (let r of this.viewers.keys()) r !== e && (r.controls.setStructureTransform(t), r.cameraController.applyCoupledViewState(n), r.requestRender());
	}
	delete(e) {
		let t = e?.viewer || e, n = this.viewers.get(t);
		if (!n) return !1;
		n.stopInteraction(), n.stopMode(), this.viewers.delete(t), this.pendingInteractions = this.pendingInteractions.filter((e) => e.source !== t);
		for (let e of this.viewers.keys()) e.controls.clearCoupledInteraction(t), t.controls.clearCoupledInteraction(e);
		return !0;
	}
	enqueue(e, t) {
		if (t.type === "rotate" || t.type === "camera") for (let n = this.pendingInteractions.length - 1; n >= 0; n--) {
			let r = this.pendingInteractions[n];
			if (r.source === e && r.interaction.type === t.type) {
				this.pendingInteractions[n] = {
					source: e,
					interaction: t
				}, this.pendingFrame === null && (this.pendingFrame = o(() => this.flush()));
				return;
			}
		}
		this.pendingInteractions.push({
			source: e,
			interaction: t
		}), this.pendingFrame === null && (this.pendingFrame = o(() => this.flush()));
	}
	enqueueModeChange(e, t) {
		t.coupled || !c.includes(t.modifierName) || (this.pendingModeUpdate = this.pendingModeUpdate.then(async () => {
			this.viewers.has(e) && (await Promise.all([...this.viewers.keys()].filter((t) => t !== e).map((e) => e.setModifierModes?.({ [t.modifierName]: t.mode }, { broadcast: !1 }))), this.viewers.has(e) && this.#e(e));
		}).catch((e) => {
			console.error("Coupled modifier mode update failed:", e);
		}));
	}
	async settled() {
		this.flush(), await this.pendingModeUpdate;
	}
	flush() {
		if (this.pendingFrame !== null && (s(this.pendingFrame), this.pendingFrame = null), this.pendingInteractions.length === 0) return;
		let e = this.pendingInteractions;
		this.pendingInteractions = [];
		let t = /* @__PURE__ */ new Set();
		for (let { source: n, interaction: r } of e) if (this.viewers.has(n)) for (let e of this.viewers.keys()) e !== n && (e.controls.applyCoupledInteraction(r, n), t.add(e));
		t.forEach((e) => e.requestRender());
	}
	dispose() {
		this.pendingFrame !== null && (s(this.pendingFrame), this.pendingFrame = null), this.pendingInteractions = [];
		let e = [...this.viewers.keys()];
		this.viewers.forEach(({ stopInteraction: e, stopMode: t }) => {
			e(), t();
		}), this.viewers.clear(), e.forEach((t) => {
			e.forEach((e) => t.controls.clearCoupledInteraction(e));
		});
	}
};
function u(...e) {
	let t = {};
	if (e.length > 1) {
		let n = e[e.length - 1];
		n && typeof n == "object" && !Array.isArray(n) && !n.viewer && !n.controls && (t = e.pop());
	}
	return new l(e.length === 1 && Array.isArray(e[0]) ? e[0] : e, t);
}
//#endregion
export { e as ORTEP3JsStructure, r as ThreeContourLineLayer, t as ThreeIsosurfaceLayer, l as ViewerInteractionCoupling, u as coupleViewerInteractions, i as generateDisorderGroupIcon, n as getDisorderIcon };
