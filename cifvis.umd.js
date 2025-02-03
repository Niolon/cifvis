(function(u,C){typeof exports=="object"&&typeof module<"u"?C(exports,require("three"),require("mathjs")):typeof define=="function"&&define.amd?define(["exports","three","mathjs"],C):(u=typeof globalThis<"u"?globalThis:u||self,C(u.CifVis={},u.THREE,u.math))})(this,function(u,C,x){"use strict";var Dt=Object.defineProperty;var St=(u,C,x)=>C in u?Dt(u,C,{enumerable:!0,configurable:!0,writable:!0,value:x}):u[C]=x;var A=(u,C,x)=>St(u,typeof C!="symbol"?C+"":C,x);function rt(l){const t=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(l){for(const e in l)if(e!=="default"){const o=Object.getOwnPropertyDescriptor(l,e);Object.defineProperty(t,e,o.get?o:{enumerable:!0,get:()=>l[e]})}}return t.default=l,Object.freeze(t)}const d=rt(C);function z(l,t=!0){const e=/([+-]?)(\d+\.?\d*)\((\d{1,2})\)/,o=l.match(e);let s,n;if(t&&o){const[a,i,h,r]=o,p=i==="-"?-1:1;if(h.includes(".")){const c=h.split(".")[1].length;s=Number((p*parseFloat(h)).toFixed(c)),n=Number((Math.pow(10,-c)*parseFloat(r)).toFixed(c))}else s=p*parseInt(h),n=parseInt(r)}else isNaN(l)?/^".*"$/.test(l)||/^'.*'$/.test(l)?s=l.slice(1,-1).replace(/\\([^\\])/g,"$1"):s=l.replace(/\\([^\\])/g,"$1"):s=l.includes(".")?parseFloat(l):parseInt(l),n=NaN;return{value:s,su:n}}function Z(l,t){let e="",o=t+1;for(;o<l.length&&l[o]!==";";)e+=l[o].replace(/\\([^\\])/g,"$1")+`
`,o++;return{value:e.trim(),endIndex:o}}class K{constructor(t,e=!0){this.splitSU=e,this.rawCifBlocks=this.splitCifBlocks(`

`+t),this.blocks=Array(this.rawCifBlocks.length).fill(null)}splitCifBlocks(t){const e=[],o=t.split(/\ndata_/).slice(1);let s=0;for(;s<o.length;){let n=o[s];const a=/^\s*;[\s\w]*$/gm,i=n.match(a);let h=i?i.length:0;for(;h%2===1&&s+1<o.length;){s++,n+=`
data_`+o[s];const r=n.match(a);h=r?r.length:0}e.push(n),s++}return e}getBlock(t=0){return this.blocks[t]||(this.blocks[t]=new J(this.rawCifBlocks[t],this.splitSU)),this.blocks[t]}getAllBlocks(){for(let t=0;t<this.blocks.length;t++)this.blocks[t]||(this.blocks[t]=new J(this.rawCifBlocks[t],this.splitSU));return this.blocks}}class J{constructor(t,e=!0){this.rawText=t,this.splitSU=e,this.data=null,this.dataBlockName=null}parse(){if(this.data!==null)return;this.data={};const t=this.rawText.replace(/\n;([^\n^\s])/,`
;
$1`).split(`
`).map(o=>{const s=/#(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/;return o.split(s)[0]}).map(o=>o.trim()).filter(o=>o.length>0);this.dataBlockName=t[0];let e=1;for(;e<t.length;){if(t[e+1]===";"){const s=Z(t,e+1);this.data[t[e]]=s.value,e=s.endIndex+1;continue}if(t[e].startsWith("loop_")){const s=new U(t.slice(e),this.splitSU);this.data[s.getName()]=s,e+=s.getEndIndex();continue}const o=t[e].match(/^(_\S+)\s+(.*)$/);if(o){const s=o[1],n=z(o[2],this.splitSU);this.data[s]=n.value,isNaN(n.su)||(this.data[s+"_su"]=n.su)}else if(t[e].startsWith("_")&&!t[e+1].startsWith("_")){const s=t[e],n=z(t[e+1],this.splitSU);this.data[s]=n.value,isNaN(n.su)||(this.data[s+"_su"]=n.su),e++}else throw new Error("Could not parse line "+String(e)+": "+t[e]);e++}}get dataBlockName(){return this._dataBlockName||this.parse(),this._dataBlockName}set dataBlockName(t){this._dataBlockName=t}get(t,e=null){this.parse();const o=Array.isArray(t)?t:[t];for(const s of o){const n=this.data[s];if(n!==void 0)return n}if(e!==null)return e;throw new Error(`None of the keys [${o.join(", ")}] found in CIF block`)}}class U{constructor(t,e){this.splitSU=e;let o=1;for(;o<t.length&&t[o].startsWith("_");)o++;this.headerLines=t.slice(1,o);let s=o;for(;s<t.length&&!t[s].startsWith("_")&&!t[s].startsWith("loop_");)s++;this.dataLines=t.slice(o,s),this.endIndex=s,this.headers=null,this.data=null,this.name=null,this.name=this.findCommonStart()}parse(){if(this.data!==null)return;this.headers=[...this.headerLines],this.data={};const t=[];let e=0;for(;e<this.dataLines.length;){const s=this.dataLines[e];if(s===";"){const i=Z(this.dataLines,e);t.push(z(i.value,this.splitSU)),e=i.endIndex+1;continue}const n=/('[^']+'|"[^"]+"|[^\s'"]+)/g,a=s.match(n);if(a)for(const i of a)t.push(z(i,this.splitSU));e++}const o=this.headers.length;if(t.length%o!=0)throw new Error(`Loop ${this.name}: Cannot distribute ${t.length} values evenly into ${o} columns`);if(t.length===0)throw new Error(`Loop ${this.name} has no data values.`);for(let s=0;s<o;s++){const n=this.headers[s],a=t.slice(s).filter((h,r)=>r%o===0);a.some(h=>!isNaN(h.su))?(this.data[n]=a.map(h=>h.value),this.data[n+"_su"]=a.map(h=>h.su),this.headers.push(n+"_su")):this.data[n]=a.map(h=>h.value)}}findCommonStart(){if(this.headerLines.length===1)return this.headerLines[0].trim();const t=this.headerLines[0],e="_"+t.split(/[\.\_]/)[1],o=this.headerLines.filter(n=>n.startsWith(e));let s="";for(let n=0;n<t.length;n++){const a=t[n];if(o.every(i=>i[n]===a))s+=a;else break}return s.slice(0,-1)}get(t,e=null){this.parse();const o=Array.isArray(t)?t:[t];for(const s of o){const n=this.data[s];if(n!==void 0)return n}if(e!==null)return e;throw new Error(`None of the keys [${o.join(", ")}] found in CIF loop ${this.name}`)}getIndex(t,e,o=null){this.parse();const s=Array.isArray(t)?t:[t];if(!s.some(a=>this.headers.includes(a))){if(o!==null)return o;throw new Error(`None of the keys [${s.join(", ")}] found in CIF loop ${this.name}`)}const n=this.get(s);if(e<n.length)return n[e];throw new Error(`Tried to look up value of index ${e} in ${this.name}, but length is only ${n.length}`)}getHeaders(){return this.headers||this.parse(),this.headers}getName(){return this.name}getEndIndex(){return this.endIndex}}const g=x.create(x.all,{});function D(l){const t=g.unit(l.alpha,"deg").toNumber("rad"),e=g.unit(l.beta,"deg").toNumber("rad"),o=g.unit(l.gamma,"deg").toNumber("rad"),s=Math.cos(t),n=Math.cos(e),a=Math.cos(o),i=Math.sin(o),h=Math.sqrt(1-s*s-n*n-a*a+2*s*n*a);return g.matrix([[l.a,l.b*a,l.c*n],[0,l.b*i,l.c*(s-n*a)/i],[0,0,l.c*h/i]])}function Q(l){return g.matrix([[l[0],l[3],l[4]],[l[3],l[1],l[5]],[l[4],l[5],l[2]]])}function ct(l){const t=g.matrix(l);return[t.get([0,0]),t.get([1,1]),t.get([2,2]),t.get([0,1]),t.get([0,2]),t.get([1,2])]}function lt(l,t){const e=g.matrix(l),o=g.transpose(g.inv(e)),s=g.diag(g.matrix(g.transpose(o).toArray().map(h=>g.norm(h)))),n=Q(t),a=g.multiply(g.multiply(s,n),g.transpose(s)),i=g.multiply(g.multiply(e,a),g.transpose(e));return ct(i)}const v=x.create(x.all);class N{constructor(t){const{matrix:e,vector:o}=this.parseSymmetryInstruction(t);this.rotMatrix=e,this.transVector=o}parseSymmetryInstruction(t){const e=Array(3).fill().map(()=>Array(3).fill(0)),o=Array(3).fill(0),s=t.split(",").map(n=>n.trim().toUpperCase());if(s.length!==3)throw new Error("Symmetry operation must have exactly three components");return s.forEach((n,a)=>{const i=/([+-]?\d*\.?\d*(?:\/\d+)?)\*?([XYZ])/g;let h;for(;(h=i.exec(n))!==null;){let c=h[1];const k=h[2];if(!c||c==="+")c="1";else if(c==="-")c="-1";else if(c.includes("/")){const[M,H]=c.split("/");c=parseFloat(M)/parseFloat(H)}c=parseFloat(c);const w=k==="X"?0:k==="Y"?1:2;e[a][w]=c}const p=n.replace(/[+-]?\d*\.?\d*(?:\/\d+)?\*?[XYZ]/g,"").match(/[+-]?\d*\.?\d+(?:\/\d+)?/g)||[];for(const c of p)if(c.includes("/")){const[k,w]=c.split("/");o[a]+=parseFloat(k)/parseFloat(w)}else o[a]+=parseFloat(c)}),{matrix:e,vector:o}}static fromCIF(t,e){let o=t.get(["_space_group_symop","_symmetry_equiv"],"InVaLIdValue");if(o=="InVaLIdValue"){for(const n of Object.entries(t.data))if((n[0].startsWith("_symmetry_equiv")||n[0].startsWith("_space_group_symop"))&&n[1]instanceof U){o=n[1];break}}if(o=="InVaLIdValue")throw new Error("No symmetry operations found in CIF block");const s=o.getIndex(["_space_group_symop.operation_xyz","_space_group_symop_operation_xyz","_symmetry_equiv.pos_as_xyz","_symmetry_equiv_pos_as_xyz"],e);return new N(s)}applyToPoint(t){const e=v.add(v.multiply(this.rotMatrix,t),this.transVector);return Array.isArray(e)?e:e.toArray()}applyToAtom(t){const e=v.add(v.multiply(this.rotMatrix,[t.fractX,t.fractY,t.fractZ]),this.transVector);let o=null;if(t.adp&&t.adp instanceof F){const s=[[t.adp.u11,t.adp.u12,t.adp.u13],[t.adp.u12,t.adp.u22,t.adp.u23],[t.adp.u13,t.adp.u23,t.adp.u33]],n=this.rotMatrix,a=v.transpose(n),i=v.multiply(v.multiply(n,s),a);o=new F(i[0][0],i[1][1],i[2][2],i[0][1],i[0][2],i[1][2])}else t.adp&&t.adp instanceof V&&(o=new V(t.adp.uiso));return new I(t.label,t.atomType,e[0],e[1],e[2],o,t.disorderGroup)}applyToAtoms(t){return t.map(e=>this.applyToAtom(e))}copy(){const t=new N("x,y,z");return t.rotMatrix=v.clone(this.rotMatrix),t.transVector=v.clone(this.transVector),t}}class T{constructor(t,e,o){this.spaceGroupName=t,this.spaceGroupNumber=e,this.symmetryOperations=o}generateEquivalentPositions(t){return this.symmetryOperations.map(e=>e.applyToPoint(t))}applySymmetry(t,e){const[o,s]=t.split("_"),n=parseInt(o)-1;if(n<0||n>=this.symmetryOperations.length)throw new Error(`Invalid symmetry operation number: ${o}`);const a=s.split("").map(r=>parseInt(r)-5),i=this.symmetryOperations[n];if(Array.isArray(e)){const r=i.applyToAtoms(e);return r.forEach(p=>{p.fractX+=a[0],p.fractY+=a[1],p.fractZ+=a[2]}),r}const h=i.applyToAtom(e);return h.fractX+=a[0],h.fractY+=a[1],h.fractZ+=a[2],h}static fromCIF(t){let e,o;e=t.get(["_space_group.name_H-M_full","_symmetry_space_group_name_H-M","_space_group_name_H-M_alt"],"Unknown"),o=t.get(["_space_group.IT_number","_symmetry_Int_Tables_number","_space_group_IT_number"],0);let s=t.get(["_space_group_symop","_symmetry_equiv"],"InVaLIdValue");if(s==="InVaLIdValue"){for(const i of Object.entries(t.data))if((i[0].startsWith("_symmetry_equiv")||i[0].startsWith("_space_group_symop"))&&i[1]instanceof U){s=i[1];break}}if(s=="InVaLIdValue")return console.warn("No symmetry operations found in CIF block, will use P1"),new T("Unknown",0,[new N("x,y,z")]);const a=s.get(["_space_group_symop.operation_xyz","_space_group_symop_operation_xyz","_symmetry_equiv.pos_as_xyz","_symmetry_equiv_pos_as_xyz"]).map((i,h)=>new N(i));return new T(e,o,a)}}class S{constructor(t,e,o=[],s=[],n=null){this.cell=t,this.atoms=e,this.bonds=o,this.hBonds=s,this.recalculateConnectedGroups(),this.symmetry=n||new T("None",0,["x,y,z"])}static fromCIF(t){const e=G.fromCIF(t),s=t.get("_atom_site").get(["_atom_site.label","_atom_site_label"]),n=Array.from({length:s.length},(r,p)=>I.fromCIF(t,p)),a=[];try{const p=t.get("_geom_bond").get(["_geom_bond.atom_site_label_1","_geom_bond_atom_site_label_1"]).length;for(let c=0;c<p;c++)a.push(O.fromCIF(t,c))}catch{console.warn("No bonds found in CIF file")}const i=[];try{const p=t.get("_geom_hbond").get(["_geom_hbond.atom_site_label_d","_geom_hbond_atom_site_label_D"]).length;for(let c=0;c<p;c++)i.push(E.fromCIF(t,c))}catch{console.warn("No hydrogen bonds found in CIF file")}const h=T.fromCIF(t);return new S(e,n,a,i,h)}getAtomByLabel(t){for(const e of this.atoms)if(e.label===t)return e;throw new Error("Could not find atom with label: "+t)}recalculateConnectedGroups(){const t=new Map,e=[],o=n=>{if(t.has(n.label))return t.get(n.label);const a={atoms:new Set,bonds:new Set,hBonds:new Set};return e.push(a),a};for(const n of this.bonds){const a=this.getAtomByLabel(n.atom1Label),i=this.getAtomByLabel(n.atom2Label);if(n.atom2SiteSymmetry!=="."&&n.atom2SiteSymmetry!==null)continue;let h=t.get(a.label),r=t.get(i.label);const p=h||r;if(p){if(p.atoms.add(a),p.atoms.add(i),p.bonds.add(n),t.set(a.label,p),t.set(i.label,p),h&&r&&h!==r){for(const c of r.atoms)h.atoms.add(c),t.set(c.label,h);for(const c of r.bonds)h.bonds.add(c);e.splice(e.indexOf(r),1)}}else{const c=o(a);c.atoms.add(a),c.atoms.add(i),c.bonds.add(n),t.set(a.label,c),t.set(i.label,c)}}for(const n of this.hBonds){const a=this.getAtomByLabel(n.donorAtomLabel);this.getAtomByLabel(n.hydrogenAtomLabel);const i=this.getAtomByLabel(n.acceptorAtomLabel);if(n.acceptorAtomSymmetry!=="."&&n.acceptorAtomSymmetry!==null)continue;o(a).hBonds.add(n),t.has(i.label)&&o(i).hBonds.add(n)}this.atoms.filter(n=>!e.some(a=>a.atoms.has(n))).forEach(n=>{const a={atoms:new Set([n]),bonds:new Set,hBonds:new Set};e.push(a)}),this.connectedGroups=e.map(n=>({atoms:Array.from(n.atoms),bonds:Array.from(n.bonds),hBonds:Array.from(n.hBonds)}))}}class G{constructor(t,e,o,s,n,a){this._a=t,this._b=e,this._c=o,this._alpha=s,this._beta=n,this._gamma=a,this.fractToCartMatrix=D(this)}static fromCIF(t){return new G(t.get(["_cell.length_a","_cell_length_a"]),t.get(["_cell.length_b","_cell_length_b"]),t.get(["_cell.length_c","_cell_length_c"]),t.get(["_cell.angle_alpha","_cell_angle_alpha"]),t.get(["_cell.angle_beta","_cell_angle_beta"]),t.get(["_cell.angle_gamma","_cell_angle_gamma"]))}get a(){return this._a}set a(t){if(t<=0)throw new Error("Cell parameter 'a' must be positive");this._a=t,this.fractToCartMatrix=D(this)}get b(){return this._b}set b(t){if(t<=0)throw new Error("Cell parameter 'b' must be positive");this._b=t,this.fractToCartMatrix=D(this)}get c(){return this._c}set c(t){if(t<=0)throw new Error("Cell parameter 'c' must be positive");this._c=t,this.fractToCartMatrix=D(this)}get alpha(){return this._alpha}set alpha(t){if(t<=0||t>=180)throw new Error("Angle alpha must be between 0 and 180 degrees");this._alpha=t,this.fractToCartMatrix=D(this)}get beta(){return this._beta}set beta(t){if(t<=0||t>=180)throw new Error("Angle beta must be between 0 and 180 degrees");this._beta=t,this.fractToCartMatrix=D(this)}get gamma(){return this._gamma}set gamma(t){if(t<=0||t>=180)throw new Error("Angle gamma must be between 0 and 180 degrees");this._gamma=t,this.fractToCartMatrix=D(this)}}class I{constructor(t,e,o,s,n,a=null,i=0){this.label=t,this.atomType=e,this.fractX=o,this.fractY=s,this.fractZ=n,this.adp=a,this.disorderGroup=i}static fromCIF(t,e=null,o=null){const s=t.get("_atom_site"),n=s.get(["_atom_site.label","_atom_site_label"]);let a=e;if(e===null&&o)a=n.indexOf(o);else if(e===null)throw new Error("either atomIndex or atomLabel need to be provided");const i=n[a],h=s.getIndex(["_atom_site.adp_type","_atom_site_adp_type","_atom_site.thermal_displace_type","_atom_site_thermal_displace_type"],a,"Uiso");let r=null;if(h==="Uiso")r=new V(s.getIndex(["_atom_site.u_iso_or_equiv","_atom_site_U_iso_or_equiv"],a,.02));else if(h==="Uani"){const c=t.get("_atom_site_aniso"),w=c.get(["_atom_site_aniso.label","_atom_site_aniso_label"]).indexOf(i);r=new F(c.getIndex(["_atom_site_aniso.u_11","_atom_site_aniso_U_11"],w),c.getIndex(["_atom_site_aniso.u_22","_atom_site_aniso_U_22"],w),c.getIndex(["_atom_site_aniso.u_33","_atom_site_aniso_U_33"],w),c.getIndex(["_atom_site_aniso.u_12","_atom_site_aniso_U_12"],w),c.getIndex(["_atom_site_aniso.u_13","_atom_site_aniso_U_13"],w),c.getIndex(["_atom_site_aniso.u_23","_atom_site_aniso_U_23"],w))}const p=s.getIndex(["_atom_site.disorder_group","_atom_site_disorder_group"],a,".");return new I(i,s.getIndex(["_atom_site.type_symbol","_atom_site_type_symbol"],a),s.getIndex(["_atom_site.fract_x","_atom_site_fract_x"],a),s.getIndex(["_atom_site.fract_y","_atom_site_fract_y"],a),s.getIndex(["_atom_site.fract_z","_atom_site_fract_z"],a),r,p==="."?0:p)}}class V{constructor(t){this.uiso=t}}class F{constructor(t,e,o,s,n,a){this.u11=t,this.u22=e,this.u33=o,this.u12=s,this.u13=n,this.u23=a}getUCart(t){return lt(t.fractToCartMatrix,[this.u11,this.u22,this.u33,this.u12,this.u13,this.u23])}}class O{constructor(t,e,o=null,s=null,n=null){this.atom1Label=t,this.atom2Label=e,this.bondLength=o,this.bondLengthSU=s,this.atom2SiteSymmetry=n}static fromCIF(t,e){const o=t.get("_geom_bond");return new O(o.getIndex(["_geom_bond.atom_site_label_1","_geom_bond_atom_site_label_1"],e),o.getIndex(["_geom_bond.atom_site_label_2","_geom_bond_atom_site_label_2"],e),o.getIndex(["_geom_bond.distance","_geom_bond_distance"],e),o.getIndex(["_geom_bond.distance_su","_geom_bond_distance_su"],e,NaN),o.getIndex(["_geom_bond.site_symmetry_2","_geom_bond_site_symmetry_2"],e,"."))}}class E{constructor(t,e,o,s,n,a,i,h,r,p,c,k){this.donorAtomLabel=t,this.hydrogenAtomLabel=e,this.acceptorAtomLabel=o,this.donorHydrogenDistance=s,this.donorHydrogenDistanceSU=n,this.acceptorHydrogenDistance=a,this.acceptorHydrogenDistanceSU=i,this.donorAcceptorDistance=h,this.donorAcceptorDistanceSU=r,this.hBondAngle=p,this.hBondAngleSU=c,this.acceptorAtomSymmetry=k}static fromCIF(t,e){const o=t.get("_geom_hbond");return new E(o.getIndex(["_geom_hbond.atom_site_label_d","_geom_hbond_atom_site_label_D"],e),o.getIndex(["_geom_hbond.atom_site_label_h","_geom_hbond_atom_site_label_H"],e),o.getIndex(["_geom_hbond.atom_site_label_a","_geom_hbond_atom_site_label_A"],e),o.getIndex(["_geom_hbond.distance_dh","_geom_hbond_distance_DH"],e),o.getIndex(["_geom_hbond.distance_dh_su","_geom_hbond_distance_DH_su"],e,NaN),o.getIndex(["_geom_hbond.distance_ha","_geom_hbond_distance_HA"],e),o.getIndex(["_geom_hbond.distance_ha_su","_geom_hbond_distance_HA_su"],e,NaN),o.getIndex(["_geom_hbond.distance_da","_geom_hbond_distance_DA"],e),o.getIndex(["_geom_hbond.distance_da_su","_geom_hbond_distance_DA_su"],e,NaN),o.getIndex(["_geom_hbond.angle_dha","_geom_hbond_angle_DHA"],e),o.getIndex(["_geom_hbond.angle_dha_su","_geom_hbond_angle_DHA_su"],e,NaN),o.getIndex(["_geom_hbond.site_symmetry_a","_geom_hbond_site_symmetry_A"],e,"."))}}const f={camera:{minDistance:1,maxDistance:100,zoomSpeed:.1,initialPosition:[0,0,10],fov:45,near:.1,far:1e3},selection:{mode:"multiple",markerMult:1.3,bondMarkerMult:1.7,markerSegments:32,highlightEmissive:11184810,markerColors:[13323581,4895071,7956437,8238390,12671671,13738548,7768263,13854502,4566940,13976426,7050587,12542866,9408315,12741484,12156240]},interaction:{rotationSpeed:5,clickThreshold:200},hydrogenMode:"none",disorderMode:"all",symmetryMode:"bonds-no-hbonds-no",atomDetail:3,atomColorRoughness:.3,atomColorMetalness:.5,atomADPRingWidthFactor:1,atomADPRingHeight:.06,atomADPRingSections:18,atomADPInnerSections:7,bondRadius:.05,bondSections:15,bondColor:"#666666",bondColorRoughness:.3,bondColorMetalness:.1,hbondRadius:.04,hbondColor:"#AAAAAA",hbondColorRoughness:.3,hbondColorMetalness:.1,hbondDashSegmentLength:.3,hbondDashFraction:.6,elementProperties:{H:{radius:.31,atomColor:"#ffffff",ringColor:"#000000"},He:{radius:.28,atomColor:"#d9ffff",ringColor:"#000000"},Li:{radius:1.28,atomColor:"#cc80ff",ringColor:"#000000"},Be:{radius:.96,atomColor:"#c2ff00",ringColor:"#000000"},B:{radius:.85,atomColor:"#ffb5b5",ringColor:"#000000"},C:{radius:.76,atomColor:"#000000",ringColor:"#ffffff"},N:{radius:.71,atomColor:"#3050f8",ringColor:"#ffffff"},O:{radius:.66,atomColor:"#ff0d0d",ringColor:"#ffffff"},F:{radius:.57,atomColor:"#90e050",ringColor:"#000000"},Ne:{radius:.58,atomColor:"#b3e3f5",ringColor:"#000000"},Na:{radius:1.66,atomColor:"#ab5cf2",ringColor:"#ffffff"},Mg:{radius:1.41,atomColor:"#8aff00",ringColor:"#000000"},Al:{radius:1.21,atomColor:"#bfa6a6",ringColor:"#000000"},Si:{radius:1.11,atomColor:"#f0c8a0",ringColor:"#000000"},P:{radius:1.07,atomColor:"#ff8000",ringColor:"#000000"},S:{radius:1.05,atomColor:"#ffff30",ringColor:"#000000"},Cl:{radius:1.02,atomColor:"#1ff01f",ringColor:"#000000"},Ar:{radius:1.06,atomColor:"#80d1e3",ringColor:"#000000"},K:{radius:2.03,atomColor:"#8f40d4",ringColor:"#ffffff"},Ca:{radius:1.76,atomColor:"#3dff00",ringColor:"#000000"},Sc:{radius:1.7,atomColor:"#e6e6e6",ringColor:"#000000"},Ti:{radius:1.6,atomColor:"#bfc2c7",ringColor:"#000000"},V:{radius:1.53,atomColor:"#a6a6ab",ringColor:"#000000"},Cr:{radius:1.39,atomColor:"#8a99c7",ringColor:"#000000"},Mn:{radius:1.39,atomColor:"#9c7ac7",ringColor:"#000000"},Fe:{radius:1.32,atomColor:"#e06633",ringColor:"#ffffff"},Co:{radius:1.26,atomColor:"#f090a0",ringColor:"#000000"},Ni:{radius:1.24,atomColor:"#50d050",ringColor:"#000000"},Cu:{radius:1.32,atomColor:"#c88033",ringColor:"#000000"},Zn:{radius:1.22,atomColor:"#7d80b0",ringColor:"#000000"},Ga:{radius:1.22,atomColor:"#c28f8f",ringColor:"#000000"},Ge:{radius:1.2,atomColor:"#668f8f",ringColor:"#000000"},As:{radius:1.19,atomColor:"#bd80e3",ringColor:"#000000"},Se:{radius:1.2,atomColor:"#ffa100",ringColor:"#000000"},Br:{radius:1.2,atomColor:"#a62929",ringColor:"#ffffff"},Kr:{radius:1.16,atomColor:"#5cb8d1",ringColor:"#000000"},Rb:{radius:2.2,atomColor:"#702eb0",ringColor:"#ffffff"},Sr:{radius:1.95,atomColor:"#00ff00",ringColor:"#000000"},Y:{radius:1.9,atomColor:"#94ffff",ringColor:"#000000"},Zr:{radius:1.75,atomColor:"#94e0e0",ringColor:"#000000"},Nb:{radius:1.64,atomColor:"#73c2c9",ringColor:"#000000"},Mo:{radius:1.54,atomColor:"#54b5b5",ringColor:"#000000"},Tc:{radius:1.47,atomColor:"#3b9e9e",ringColor:"#000000"},Ru:{radius:1.46,atomColor:"#248f8f",ringColor:"#000000"},Rh:{radius:1.42,atomColor:"#0a7d8c",ringColor:"#000000"},Pd:{radius:1.39,atomColor:"#006985",ringColor:"#ffffff"},Ag:{radius:1.45,atomColor:"#c0c0c0",ringColor:"#000000"},Cd:{radius:1.44,atomColor:"#ffd98f",ringColor:"#000000"},In:{radius:1.42,atomColor:"#a67573",ringColor:"#000000"},Sn:{radius:1.39,atomColor:"#668080",ringColor:"#000000"},Sb:{radius:1.39,atomColor:"#9e63b5",ringColor:"#ffffff"},Te:{radius:1.38,atomColor:"#d47a00",ringColor:"#000000"},I:{radius:1.39,atomColor:"#940094",ringColor:"#ffffff"},Xe:{radius:1.4,atomColor:"#429eb0",ringColor:"#000000"},Cs:{radius:2.44,atomColor:"#57178f",ringColor:"#ffffff"},Ba:{radius:2.15,atomColor:"#00c900",ringColor:"#000000"},La:{radius:2.07,atomColor:"#70d4ff",ringColor:"#000000"},Ce:{radius:2.04,atomColor:"#ffffc7",ringColor:"#000000"},Pr:{radius:2.03,atomColor:"#d9ffc7",ringColor:"#000000"},Nd:{radius:2.01,atomColor:"#c7ffc7",ringColor:"#000000"},Pm:{radius:1.99,atomColor:"#a3ffc7",ringColor:"#000000"},Sm:{radius:1.98,atomColor:"#8fffc7",ringColor:"#000000"},Eu:{radius:1.98,atomColor:"#61ffc7",ringColor:"#000000"},Gd:{radius:1.96,atomColor:"#45ffc7",ringColor:"#000000"},Tb:{radius:1.94,atomColor:"#30ffc7",ringColor:"#000000"},Dy:{radius:1.92,atomColor:"#1fffc7",ringColor:"#000000"},Ho:{radius:1.92,atomColor:"#00ff9c",ringColor:"#000000"},Er:{radius:1.89,atomColor:"#00e675",ringColor:"#000000"},Tm:{radius:1.9,atomColor:"#00d452",ringColor:"#000000"},Yb:{radius:1.87,atomColor:"#00bf38",ringColor:"#000000"},Lu:{radius:1.87,atomColor:"#00ab24",ringColor:"#000000"},Hf:{radius:1.75,atomColor:"#4dc2ff",ringColor:"#000000"},Ta:{radius:1.7,atomColor:"#4da6ff",ringColor:"#000000"},W:{radius:1.62,atomColor:"#2194d6",ringColor:"#000000"},Re:{radius:1.51,atomColor:"#267dab",ringColor:"#000000"},Os:{radius:1.44,atomColor:"#266696",ringColor:"#ffffff"},Ir:{radius:1.41,atomColor:"#175487",ringColor:"#ffffff"},Pt:{radius:1.36,atomColor:"#d0d0e0",ringColor:"#000000"},Au:{radius:1.36,atomColor:"#ffd123",ringColor:"#000000"},Hg:{radius:1.32,atomColor:"#b8b8d0",ringColor:"#000000"},Tl:{radius:1.45,atomColor:"#a6544d",ringColor:"#ffffff"},Pb:{radius:1.46,atomColor:"#575961",ringColor:"#ffffff"},Bi:{radius:1.48,atomColor:"#9e4fb5",ringColor:"#ffffff"},Po:{radius:1.4,atomColor:"#ab5c00",ringColor:"#ffffff"},At:{radius:1.5,atomColor:"#754f45",ringColor:"#ffffff"},Rn:{radius:1.5,atomColor:"#428296",ringColor:"#000000"},Fr:{radius:2.6,atomColor:"#420066",ringColor:"#ffffff"},Ra:{radius:2.21,atomColor:"#007d00",ringColor:"#000000"},Ac:{radius:2.15,atomColor:"#70abfa",ringColor:"#000000"},Th:{radius:2.06,atomColor:"#00baff",ringColor:"#000000"},Pa:{radius:2,atomColor:"#00a1ff",ringColor:"#000000"},U:{radius:1.96,atomColor:"#008fff",ringColor:"#000000"},Np:{radius:1.9,atomColor:"#0080ff",ringColor:"#000000"},Pu:{radius:1.87,atomColor:"#006bff",ringColor:"#ffffff"},Am:{radius:1.8,atomColor:"#545cf2",ringColor:"#ffffff"},Cm:{radius:1.69,atomColor:"#785ce3",ringColor:"#ffffff"}}};class R{constructor(t,e,o,s=[]){if(new.target===R)throw new TypeError("Cannot instantiate BaseFilter directly");this.MODES=Object.freeze(t),this.PREFERRED_FALLBACK_ORDER=Object.freeze(s),this.filterName=o,this._mode=null,this.setMode(e)}get mode(){return this._mode}set mode(t){this.setMode(t)}setMode(t){const e=t.toLowerCase().replace(/_/g,"-"),o=Object.values(this.MODES);if(!o.includes(e))throw new Error(`Invalid ${this.filterName} mode: "${t}". Valid modes are: ${o.join(", ")}`);this._mode=e}ensureValidMode(t){const e=this.getApplicableModes(t);if(!e.includes(this.mode)){const o=this.mode;this.mode=this.PREFERRED_FALLBACK_ORDER.find(s=>e.includes(s))||e[0],console.warn(`${this.filterName} mode ${o} was not applicable, chaged to ${this.mode}`)}}apply(t){throw new Error('Method "apply" must be implemented by subclass')}getApplicableModes(t){throw new Error('Method "getApplicableModes" must be implemented by subclass')}cycleMode(t){const e=this.getApplicableModes(t);this.ensureValidMode(t);const o=e.indexOf(this._mode);return this._mode=e[(o+1)%e.length],this._mode}}const b=class b extends R{constructor(t=b.MODES.NONE){super(b.MODES,t,"HydrogenFilter",b.PREFERRED_FALLBACK_ORDER)}apply(t){this.ensureValidMode(t);const e=t.atoms.filter(n=>n.atomType!=="H"||this.mode!==b.MODES.NONE).map(n=>({...n,adp:n.atomType==="H"&&this.mode===b.MODES.CONSTANT?null:n.adp})),o=t.bonds.filter(n=>{if(this.mode===b.MODES.NONE){const a=t.getAtomByLabel(n.atom1Label),i=t.getAtomByLabel(n.atom2Label);return!(a.atomType==="H"||i.atomType==="H")}return!0}).map(n=>({...n})),s=this.mode===b.MODES.NONE?[]:t.hBonds.map(n=>({...n}));return new S(t.cell,e,o,s,t.symmetry)}getApplicableModes(t){const e=[b.MODES.NONE];return t.atoms.some(n=>n.atomType==="H")&&(e.push(b.MODES.CONSTANT),t.atoms.some(n=>{var a;return n.atomType==="H"&&((a=n.adp)==null?void 0:a.constructor.name)==="UAnisoADP"})&&e.push(b.MODES.ANISOTROPIC)),e}};A(b,"MODES",Object.freeze({NONE:"none",CONSTANT:"constant",ANISOTROPIC:"anisotropic"})),A(b,"PREFERRED_FALLBACK_ORDER",[b.MODES.ANISOTROPIC,b.MODES.CONSTANT,b.MODES.NONE]);let $=b;const y=class y extends R{constructor(t=y.MODES.ALL){super(y.MODES,t,"DisorderFilter",y.PREFERRED_FALLBACK_ORDER)}apply(t){this.ensureValidMode(t);const e=t.atoms.filter(n=>!(this.mode===y.MODES.GROUP1&&n.disorderGroup>1||this.mode===y.MODES.GROUP2&&n.disorderGroup===1)),o=t.bonds.filter(n=>{const a=t.getAtomByLabel(n.atom1Label),i=t.getAtomByLabel(n.atom2Label);return!(this.mode===y.MODES.GROUP1&&(a.disorderGroup>1||i.disorderGroup>1)||this.mode===y.MODES.GROUP2&&(a.disorderGroup===1||i.disorderGroup===1))}),s=t.hBonds.filter(n=>{const a=t.getAtomByLabel(n.donorAtomLabel),i=t.getAtomByLabel(n.hydrogenAtomLabel),h=t.getAtomByLabel(n.acceptorAtomLabel);return!(this.mode===y.MODES.GROUP1&&(a.disorderGroup>1||i.disorderGroup>1||h.disorderGroup>1)||this.mode===y.MODES.GROUP2&&(a.disorderGroup===1||i.disorderGroup===1||h.disorderGroup===1))});return new S(t.cell,e,o,s,t.symmetry)}getApplicableModes(t){const e=[y.MODES.ALL];return t.atoms.some(s=>s.disorderGroup>0)&&(t.atoms.some(s=>s.disorderGroup===1)&&e.push(y.MODES.GROUP1),t.atoms.some(s=>s.disorderGroup>1)&&e.push(y.MODES.GROUP2)),e}};A(y,"MODES",Object.freeze({ALL:"all",GROUP1:"group1",GROUP2:"group2"})),A(y,"PREFERRED_FALLBACK_ORDER",[y.MODES.ALL,y.MODES.GROUP1,y.MODES.GROUP2]);let j=y;const m=class m extends R{constructor(t=m.MODES.BONDS_NO_HBONDS_NO){super(m.MODES,t,"SymmetryGrower",m.PREFERRED_FALLBACK_ORDER)}static combineSymOpLabel(t,e){return!e||e==="."?t:`${t}@${e}`}findGrowableAtoms(t){const e=t.bonds.filter(({atom2SiteSymmetry:s})=>s&&s!==".").map(({atom2Label:s,atom2SiteSymmetry:n})=>[s,n]),o=t.hBonds.filter(({acceptorAtomSymmetry:s})=>s&&s!==".").map(({acceptorAtomLabel:s,acceptorAtomSymmetry:n})=>[s,n]);return{bondAtoms:e,hBondAtoms:o}}growAtomArray(t,e,o){for(const[s,n]of e){const a=m.combineSymOpLabel(s,n);if(o.labels.has(a))continue;const i=t.connectedGroups.find(r=>r.atoms.some(p=>p.label===s));if(!i)throw new Error(`Atom ${s} is not in any group. Typo or structure.recalculateConnectedGroups()?`);t.symmetry.applySymmetry(n,i.atoms).forEach(r=>{r.label=m.combineSymOpLabel(r.label,n),o.labels.add(r.label),o.atoms.add(r)}),i.bonds.filter(({atom2SiteSymmetry:r})=>r===".").forEach(r=>{o.bonds.add(new O(m.combineSymOpLabel(r.atom1Label,n),m.combineSymOpLabel(r.atom2Label,n),r.bondLength,r.bondLengthSU,"."))}),i.hBonds.filter(({acceptorAtomSymmetry:r})=>r===".").forEach(r=>{o.hBonds.add(new E(m.combineSymOpLabel(r.donorAtomLabel,n),m.combineSymOpLabel(r.hydrogenAtomLabel,n),m.combineSymOpLabel(r.acceptorAtomLabel,n),r.donorHydrogenDistance,r.donorHydrogenDistanceSU,r.acceptorHydrogenDistance,r.acceptorHydrogenDistanceSU,r.donorAcceptorDistance,r.donorAcceptorDistanceSU,r.hBondAngle,r.hBondAngleSU,"."))})}return o}apply(t){this.ensureValidMode(t);const e=this.findGrowableAtoms(t),o={atoms:new Set(t.atoms),bonds:new Set(t.bonds),hBonds:new Set(t.hBonds),labels:new Set};this.mode.startsWith("bonds-yes")&&this.growAtomArray(t,e.bondAtoms,o),this.mode.includes("hbonds-yes")&&this.growAtomArray(t,e.hBondAtoms,o);const s=Array.from(o.atoms);for(const n of t.bonds){if(n.atom2SiteSymmetry===".")continue;const a=m.combineSymOpLabel(n.atom2Label,n.atom2SiteSymmetry);s.some(i=>i.label===a)&&o.bonds.add(new O(n.atom1Label,a,n.bondLength,n.bondLengthSU,"."))}for(const n of t.hBonds){if(n.acceptorAtomSymmetry===".")continue;const a=m.combineSymOpLabel(n.acceptorAtomLabel,n.acceptorAtomSymmetry);s.some(i=>i.label===a)&&o.hBonds.add(new E(n.donorAtomLabel,n.hydrogenAtomLabel,a,n.donorHydrogenDistance,n.donorHydrogenDistanceSU,n.acceptorHydrogenDistance,n.acceptorHydrogenDistanceSU,n.donorAcceptorDistance,n.donorAcceptorDistanceSU,n.hBondAngle,n.hBondAngleSU,"."))}return new S(t.cell,s,Array.from(o.bonds),Array.from(o.hBonds),t.symmetry)}getApplicableModes(t){const e=this.findGrowableAtoms(t),o=e.bondAtoms.length>0,s=e.hBondAtoms.length>0;return!o&&!s?[m.MODES.BONDS_NONE_HBONDS_NONE]:o?s?[m.MODES.BONDS_YES_HBONDS_YES,m.MODES.BONDS_YES_HBONDS_NO,m.MODES.BONDS_NO_HBONDS_YES,m.MODES.BONDS_NO_HBONDS_NO]:[m.MODES.BONDS_YES_HBONDS_NONE,m.MODES.BONDS_NO_HBONDS_NONE]:[m.MODES.BONDS_NONE_HBONDS_YES,m.MODES.BONDS_NONE_HBONDS_NO]}};A(m,"MODES",Object.freeze({BONDS_YES_HBONDS_YES:"bonds-yes-hbonds-yes",BONDS_YES_HBONDS_NO:"bonds-yes-hbonds-no",BONDS_YES_HBONDS_NONE:"bonds-yes-hbonds-none",BONDS_NO_HBONDS_YES:"bonds-no-hbonds-yes",BONDS_NO_HBONDS_NO:"bonds-no-hbonds-no",BONDS_NO_HBONDS_NONE:"bonds-no-hbonds-none",BONDS_NONE_HBONDS_YES:"bonds-none-hbonds-yes",BONDS_NONE_HBONDS_NO:"bonds-none-hbonds-no",BONDS_NONE_HBONDS_NONE:"bonds-none-hbonds-none"})),A(m,"PREFERRED_FALLBACK_ORDER",[m.MODES.BONDS_NO_HBONDS_NO,m.MODES.BONDS_NO_HBONDS_NONE,m.MODES.BONDS_NONE_HBONDS_NO]);let B=m;const dt={},_=x.create(x.all,dt);function ht(l){if(l.length!==6)throw new Error("This function needs six cartesian Uij parameters.");const t=Q(l),{values:e,eigenvectors:o}=_.eigs(t);o.reverse();const s=_.transpose(_.matrix(o.map(c=>c.vector))),n=_.matrix(o.map(c=>c.value)),a=_.det(s),i=_.diag(n.map(Math.sqrt));let h;if(_.abs(a-1)>1e-10){const c=_.multiply(s,1/a);h=_.multiply(c,i)}else h=_.multiply(s,i);const r=_.matrix(h).toArray();_.diag(_.matrix(h.toArray().map(c=>_.norm(c))));const p=new d.Matrix4;return p.set(r[0][0],r[0][1],r[0][2],0,r[1][0],r[1][1],r[1][2],0,r[2][0],r[2][1],r[2][2],0,0,0,0,1),p}function tt(l,t){const e=t.clone().sub(l),o=e.length(),s=e.divideScalar(o),n=new d.Vector3(0,1,0),a=new d.Vector3().crossVectors(s,n),i=-Math.acos(s.dot(n));return new d.Matrix4().makeScale(1,o,1).premultiply(new d.Matrix4().makeRotationAxis(a.normalize(),i)).setPosition(l.clone().add(t).multiplyScalar(.5))}class et{constructor(t,e={}){this.options={atomDetail:f.atomDetail,atomColorRoughness:f.atomColorRoughness,atomColorMetalness:f.atomColorMetalness,atomADPRingWidthFactor:f.atomADPRingWidthFactor,atomADPRingHeight:f.atomADPRingHeight,atomADPRingSections:f.atomADPRingSections,bondRadius:f.bondRadius,bondSections:f.bondSections,bondColor:f.bondColor,bondColorRoughness:f.bondColorRoughness,bondColorMetalness:f.bondColorMetalness,hbondRadius:f.hbondRadius,hbondColor:f.hbondColor,hbondColorRoughness:f.hbondColorRoughness,hbondColorMetalness:f.hbondColorMetalness,hbondDashSegmentLength:f.hbondDashSegmentLength,hbondDashFraction:f.hbondDashFraction,elementProperties:{...f.elementProperties,...e.elementProperties},...e},this.crystalStructure=t,this.scaling=1.5384,this.createBaseGeometries(),this.createBaseMaterials(),this.colorMaterials={},this.atoms3D=[];const o=this.crystalStructure.atoms.map(a=>a.label);for(const a of this.crystalStructure.atoms){const[i,h]=this.getAtomMaterials(a.atomType);a.adp instanceof F?this.atoms3D.push(new pt(a,this.crystalStructure.cell,this.baseAtom,i,this.baseADPRing,h)):this.atoms3D.push(new ft(a,this.crystalStructure.cell,this.baseAtom,i))}const s=this.crystalStructure.bonds.map(a=>new O(a.atom1Label,B.combineSymOpLabel(a.atom2Label,a.atom2SiteSymmetry),a.bondLength,a.bondLengthSU,".")).filter(a=>o.includes(a.atom2Label));this.bonds3D=[];for(const a of s)this.bonds3D.push(new mt(a,this.crystalStructure,this.baseBond,this.baseBondMaterial));const n=this.crystalStructure.hBonds.map(a=>new E(a.donorAtomLabel,a.hydrogenAtomLabel,B.combineSymOpLabel(a.acceptorAtomLabel,a.acceptorAtomSymmetry),a.donorHydrogenDistance,a.donorHydrogenDistanceSU,a.acceptorHydrogenDistance,a.acceptorHydrogenDistanceSU,a.donorAcceptorDistance,a.donorAcceptorDistanceSU,a.hBondAngle,a.hBondAngleSU,".")).filter(a=>o.includes(a.acceptorAtomLabel));this.hBonds3D=[];for(const a of n)this.hBonds3D.push(new ut(a,this.crystalStructure,this.baseHBond,this.baseHBondMaterial,this.options.hbondDashSegmentLength,this.options.hbondDashFraction))}createBaseGeometries(){this.baseAtom=new d.IcosahedronGeometry(this.scaling,this.options.atomDetail),this.baseADPRing=this.getADPHalfTorus(),this.baseBond=new d.CylinderGeometry(this.options.bondRadius,this.options.bondRadius,.98,this.options.bondSections,1,!0),this.baseHBond=new d.CylinderGeometry(this.options.hbondRadius,this.options.hbondRadius,.98,this.options.bondSections,1,!0)}createBaseMaterials(){this.baseBondMaterial=new d.MeshStandardMaterial({color:this.options.bondColor,roughness:this.options.bondColorRoughness,metalness:this.options.bondColorMetalness}),this.baseHBondMaterial=new d.MeshStandardMaterial({color:this.options.hbondColor,roughness:this.options.hbondColorRoughness,metalness:this.options.hbondColorMetalness})}getADPHalfTorus(){const t=new d.TorusGeometry(this.scaling*this.options.atomADPRingWidthFactor,this.options.atomADPRingHeight,this.options.atomADPInnerSections,this.options.atomADPRingSections),e=t.attributes.position.array,o=t.index.array,s=[],n=[],a=new Set;for(let p=0;p<o.length;p+=3){const c=o[p]*3,k=o[p+1]*3,w=o[p+2]*3,M=Math.sqrt(e[c]*e[c]+e[c+1]*e[c+1]+e[c+2]*e[c+2]),H=Math.sqrt(e[k]*e[k]+e[k+1]*e[k+1]+e[k+2]*e[k+2]),X=Math.sqrt(e[w]*e[w]+e[w+1]*e[w+1]+e[w+2]*e[w+2]);M>=this.scaling&&H>=this.scaling&&X>=this.scaling&&(a.add(o[p]),a.add(o[p+1]),a.add(o[p+2]))}const i=new Map;let h=0;a.forEach(p=>{const c=p*3;s.push(e[c],e[c+1],e[c+2]),i.set(p,h++)});for(let p=0;p<o.length;p+=3)a.has(o[p])&&a.has(o[p+1])&&a.has(o[p+2])&&n.push(i.get(o[p]),i.get(o[p+1]),i.get(o[p+2]));const r=new d.BufferGeometry;return r.setAttribute("position",new d.Float32BufferAttribute(s,3)),r.setIndex(n),r.computeVertexNormals(),r.rotateX(.5*Math.PI),r}getAtomMaterials(t){const e=this.options.elementProperties[t];for(const n of[e.atomColor,e.ringColor])if(!(n in this.colorMaterials)){const a=new d.MeshStandardMaterial({color:n,roughness:this.options.atomColorRoughness,metalness:this.options.atomColorMetalness});this.colorMaterials[n]=a}const o=this.colorMaterials[e.atomColor],s=this.colorMaterials[e.ringColor];return[o,s]}getGroup(){const t=new d.Group;let e=new d.Vector3;for(const o of this.atoms3D)t.add(o.object3D),e.add(o.object3D.position);for(const o of this.bonds3D)t.add(o.object3D);for(const o of this.hBonds3D)t.add(o.object3D);return e.divideScalar(-this.atoms3D.length),t.position.copy(e),t}}class Y{createSelectionMarker(t,e){}}class ot extends Y{constructor(t,e,o,s){super(),this.atom=t;const n=new d.Matrix3().fromArray(e.fractToCartMatrix.toArray().flat()),a=new d.Vector3(t.fractX,t.fractY,t.fractZ);a.applyMatrix3(n),this.object3D=new d.Mesh(o,s),this.object3D.position.copy(a),this.object3D.userData.type="atom",this.object3D.userData.atomData=t}createSelectionMarker(t,e){const o=new d.Mesh(this.object3D.geometry,new d.MeshBasicMaterial({color:t,transparent:!0,opacity:.9,side:d.BackSide}));return o.scale.multiplyScalar(e.selection.markerMult),o.userData.selectable=!1,o}}class pt extends ot{constructor(t,e,o,s,n=null,a=null){super(t,e,o,s);const i=new d.Matrix3().fromArray(_.flatten(e.fractToCartMatrix).toArray()),h=new d.Vector3(t.fractX,t.fractY,t.fractZ);h.applyMatrix3(i);const r=ht(t.adp.getUCart(e));if(r.toArray().includes(NaN))this.object3D=new d.Mesh(new d.TetrahedronGeometry(1),s);else{this.object3D=new d.Mesh(o,s);for(const p of this.adpRingMatrices){const c=new d.Mesh(n,a);c.applyMatrix4(p),c.userData.selectable=!1,this.object3D.add(c)}this.object3D.applyMatrix4(r)}this.object3D.position.copy(h),this.object3D.userData.type="atom",this.object3D.userData.atomData=t,this.object3D.userData.selectable=!0}get adpRingMatrices(){const t=new d.Matrix4;t.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);const e=new d.Matrix4;e.set(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1);const o=new d.Matrix4;return o.set(0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1),[t,e,o]}}class ft extends ot{constructor(t,e,o,s){super(t,e,o,s),this.object3D.scale.multiplyScalar(1/10.53),this.object3D.userData.type="atom",this.object3D.userData.atomData=t,this.object3D.userData.selectable=!0}}class mt extends Y{constructor(t,e,o,s){super();const n=new d.Matrix3().fromArray(e.cell.fractToCartMatrix.toArray().flat()),a=e.getAtomByLabel(t.atom1Label),i=e.getAtomByLabel(t.atom2Label),h=new d.Vector3(a.fractX,a.fractY,a.fractZ);h.applyMatrix3(n);const r=new d.Vector3(i.fractX,i.fractY,i.fractZ);r.applyMatrix3(n);const p=tt(h,r);this.object3D=new d.Mesh(o,s),this.object3D.applyMatrix4(p),this.object3D.userData.type="bond",this.object3D.userData.bondData=t,this.object3D.userData.selectable=!0}createSelectionMarker(t,e){const o=new d.Mesh(this.object3D.geometry,new d.MeshBasicMaterial({color:t,transparent:!0,opacity:.9,side:d.BackSide}));return o.scale.x*=e.selection.bondMarkerMult,o.scale.z*=e.selection.bondMarkerMult,o.userData.selectable=!1,o}}class P extends d.Group{constructor(){super(),this._material=null}get material(){return this.children[0].material.clone()}set material(t){this._material=t,this.traverse(e=>{e instanceof d.Mesh&&(e.material=t)})}dispose(){this._material&&this._material.dispose(),this.traverse(t=>{t instanceof d.Mesh&&t.geometry&&t.geometry.dispose()})}clone(t=!0){const e=new P;return e.copy(this,t),e._material=this._material,e}copy(t,e=!0){return super.copy(t,e),this._material=t._material,this}}class ut extends Y{constructor(t,e,o,s,n,a){super(),this.baseHBond=o;const i=new d.Matrix3().fromArray(e.cell.fractToCartMatrix.toArray().flat()),h=e.getAtomByLabel(t.hydrogenAtomLabel),r=new d.Vector3(h.fractX,h.fractY,h.fractZ);r.applyMatrix3(i);const p=e.getAtomByLabel(t.acceptorAtomLabel),c=new d.Vector3(p.fractX,p.fractY,p.fractZ);c.applyMatrix3(i),this.object3D=new P;const k=r.distanceTo(c),w=Math.floor(k/n),M=Math.max(1,w),X=k/M*a;this.hydrogenPosition=r,this.acceptorPosition=c;for(let q=0;q<M;q++){const it=q/M,_t=it+X/k,Ct=new d.Vector3().lerpVectors(r,c,it),xt=new d.Vector3().lerpVectors(r,c,_t),L=new d.Mesh(o),vt=tt(Ct,xt);L.applyMatrix4(vt),L.userData.type="hbond_segment",L.userData.hbondData=t,L.userData.selectable=!0,L.userData.parentGroup=this.object3D,this.object3D.add(L)}this.object3D.material=s,this.object3D.userData.type="hbond",this.object3D.userData.hbondData=t,this.object3D.userData.selectable=!0}createSelectionMarker(t,e){const o=new P,s=new d.MeshBasicMaterial({color:t,transparent:!0,opacity:.9,side:d.BackSide});return this.object3D.children.forEach(n=>{const a=new d.Mesh(n.geometry,s);a.applyMatrix4(n.matrix),a.scale.x*=e.selection.bondMarkerMult,a.scale.y*=.8*e.selection.bondMarkerMult,a.scale.z*=e.selection.bondMarkerMult,a.userData.selectable=!1,o.add(a)}),o}}function gt(l){const t=new d.Box3;t.setFromObject(l);const e=new d.Vector3;t.getSize(e);const o=new d.Vector3;return t.getCenter(o),{boundingBox:t,size:e,center:o}}function yt(l,t){l.children=l.children.filter(r=>!(r instanceof d.Light));const{size:e,center:o}=t,n=Math.max(e.x,e.y,e.z),a=new d.AmbientLight(16777215,1);l.add(a);const i=new d.SpotLight(16777215,1e3,0,Math.PI*.27,.6);i.position.set(0,-.5,4*n),i.lookAt(new d.Vector3(0,0,0)),l.add(i),[{pos:[-1,-.5,1],intensity:.4},{pos:[1,-.5,1],intensity:.4},{pos:[0,-.5,1],intensity:.3}].forEach(({pos:r,intensity:p})=>{const c=new d.DirectionalLight(16777215,p);c.position.set(r[0]*n,r[1]*n,r[2]*n),l.add(c)})}class wt{constructor(t,e={}){this.viewer=t,this.container=t.container,this.camera=t.camera,this.renderer=t.renderer,this.moleculeContainer=t.moleculeContainer,this.raycaster=t.raycaster,this.options=t.options,this.doubleClickDelay=300,this.state={isDragging:!1,mouse:new d.Vector2,lastClickTime:0,clickStartTime:0,pinchStartDistance:0,lastTouchRotation:0},this.setupEventListeners()}setupEventListeners(){const t=this.renderer.domElement;t.addEventListener("wheel",this.handleWheel.bind(this)),t.addEventListener("mousedown",this.handleMouseDown.bind(this)),t.addEventListener("mousemove",this.handleMouseMove.bind(this)),t.addEventListener("mouseup",this.handleMouseUp.bind(this)),t.addEventListener("mouseleave",this.handleMouseUp.bind(this)),t.addEventListener("click",this.handleClick.bind(this)),t.addEventListener("touchstart",this.handleTouchStart.bind(this)),t.addEventListener("touchmove",this.handleTouchMove.bind(this)),t.addEventListener("touchend",this.handleTouchEnd.bind(this)),window.addEventListener("resize",this.handleResize.bind(this))}updateMouseCoordinates(t,e){const o=this.container.getBoundingClientRect();this.state.mouse.set((t-o.left)/o.width*2-1,-((e-o.top)/o.height)*2+1)}handleTouchStart(t){if(t.preventDefault(),t.touches.length===1){this.state.isDragging=!0,this.state.clickStartTime=Date.now();const e=t.touches[0];this.updateMouseCoordinates(e.clientX,e.clientY)}else if(t.touches.length===2){this.state.isDragging=!1;const e=t.touches[0].clientX-t.touches[1].clientX,o=t.touches[0].clientY-t.touches[1].clientY;this.state.pinchStartDistance=Math.sqrt(e*e+o*o),this.state.lastTouchRotation=Math.atan2(o,e)}}handleTouchMove(t){t.preventDefault();const e=this.container.getBoundingClientRect();if(t.touches.length===1&&this.state.isDragging){const o=t.touches[0],s=new d.Vector2((o.clientX-e.left)/e.width*2-1,-((o.clientY-e.top)/e.height)*2+1),n=s.clone().sub(this.state.mouse);this.rotateStructure(n),this.state.mouse.copy(s)}else if(t.touches.length===2){const o=t.touches[0].clientX-t.touches[1].clientX,s=t.touches[0].clientY-t.touches[1].clientY,n=Math.sqrt(o*o+s*s),a=(this.state.pinchStartDistance-n)*.01;this.handleZoom(a),this.state.pinchStartDistance=n;const i=Math.atan2(s,o),h=i-this.state.lastTouchRotation;this.moleculeContainer.rotateZ(h),this.state.lastTouchRotation=i}}handleTouchEnd(t){t.preventDefault(),t.touches.length===0&&(Date.now()-this.state.clickStartTime<this.options.interaction.clickThreshold&&!this.state.isDragging&&this.handleTap(t.changedTouches[0]),this.state.isDragging=!1)}handleTap(t){const e=Date.now(),o=e-this.state.lastClickTime;this.state.lastClickTime=e,this.updateMouseCoordinates(t.clientX,t.clientY),this.raycaster.setFromCamera(this.state.mouse,this.camera);const s=[];this.moleculeContainer.traverse(a=>{a instanceof d.Mesh&&a.userData.selectable===!0&&s.push(a)});const n=this.raycaster.intersectObjects(s).filter(a=>a.object.userData.selectable!==!1);if(n.length>0){let a=n[0].object;this.viewer.handleSelection(a)}else o<this.doubleClickDelay&&this.viewer.clearSelections()}rotateStructure(t){this.moleculeContainer.applyMatrix4(new d.Matrix4().makeRotationAxis(new d.Vector3(0,1,0),t.x*this.options.interaction.rotationSpeed)),this.moleculeContainer.applyMatrix4(new d.Matrix4().makeRotationAxis(new d.Vector3(1,0,0),-t.y*this.options.interaction.rotationSpeed))}handleZoom(t){const e=this.camera.position.distanceTo(this.viewer.cameraTarget),o=d.MathUtils.clamp(e+t,this.options.camera.minDistance,this.options.camera.maxDistance),s=this.camera.position.clone().sub(this.viewer.cameraTarget).normalize();this.camera.position.copy(s.multiplyScalar(o).add(this.viewer.cameraTarget)),this.camera.lookAt(this.viewer.cameraTarget)}handleResize(){const t=this.container.getBoundingClientRect();this.camera.aspect=t.width/t.height,this.camera.updateProjectionMatrix(),this.renderer.setSize(t.width,t.height)}handleWheel(t){t.preventDefault(),this.handleZoom(t.deltaY*this.options.camera.zoomSpeed)}handleMouseMove(t){if(!this.state.isDragging)return;const e=new d.Vector2,o=this.container.getBoundingClientRect();e.set((t.clientX-o.left)/o.width*2-1,-((t.clientY-o.top)/o.height)*2+1);const s=e.clone().sub(this.state.mouse);this.rotateStructure(s),this.state.mouse.copy(e)}handleMouseDown(t){this.state.isDragging=!0,this.state.clickStartTime=Date.now(),this.updateMouseCoordinates(t.clientX,t.clientY)}handleMouseUp(){this.state.isDragging=!1}handleClick(t){if(Date.now()-this.state.clickStartTime>this.options.interaction.clickThreshold||this.state.isDragging)return;const o=Date.now(),s=o-this.state.lastClickTime;this.state.lastClickTime=o,this.updateMouseCoordinates(t.clientX,t.clientY),this.raycaster.setFromCamera(this.state.mouse,this.camera);const n=[];this.moleculeContainer.traverse(i=>{i instanceof d.Mesh&&i.userData.selectable===!0&&n.push(i)});const a=this.raycaster.intersectObjects(n).filter(i=>i.object.userData.selectable!==!1);if(a.length>0){let i=a[0].object;this.viewer.handleSelection(i)}else s<this.doubleClickDelay&&this.viewer.clearSelections()}dispose(){const t=this.renderer.domElement;t.removeEventListener("wheel",this.handleWheel),t.removeEventListener("mousedown",this.handleMouseDown),t.removeEventListener("mousemove",this.handleMouseMove),t.removeEventListener("mouseup",this.handleMouseUp),t.removeEventListener("mouseleave",this.handleMouseUp),t.removeEventListener("click",this.handleClick),t.removeEventListener("touchstart",this.handleTouchStart),t.removeEventListener("touchmove",this.handleTouchMove),t.removeEventListener("touchend",this.handleTouchEnd),window.removeEventListener("resize",this.handleResize)}}x.create(x.all);class nt{constructor(t,e={}){this.container=t,this.options={camera:{...f.camera,initialPosition:new d.Vector3(...f.camera.initialPosition),...e.camera||{}},selection:{...f.selection,...e.selection||{}},interaction:{...f.interaction,...e.interaction||{}},atomDetail:e.atomDetail||f.atomDetail,atomColorRoughness:e.atomColorRoughness||f.atomColorRoughness,atomColorMetalness:e.atomColorMetalness||f.atomColorMetalness,atomADPRingWidthFactor:e.atomADPRingWidthFactor||f.atomADPRingWidthFactor,atomADPRingHeight:e.atomADPRingHeight||f.atomADPRingHeight,atomADPRingSections:e.atomADPRingSections||f.atomADPRingSections,bondRadius:e.bondRadius||f.bondRadius,bondSections:e.bondSections||f.bondSections,bondColor:e.bondColor||f.bondColor,bondColorRoughness:e.bondColorRoughness||f.bondColorRoughness,bondColorMetalness:e.bondColorMetalness||f.bondColorMetalness,elementProperties:{...f.elementProperties,...e.elementProperties},hydrogenMode:e.hydrogenMode||f.hydrogenMode,disorderMode:e.disorderMode||f.disorderMode,symmetryMode:e.symmetryMode||f.symmetryMode},this.state={selectedObjects:new Set,isDragging:!1,currentCifContent:null,currentStructure:null,currentFloor:null,selectionCallbacks:new Set,baseStructure:null,ortepObjects:new Map},this.modifiers={hydrogen:new $(this.options.hydrogenMode),disorder:new j(this.options.disorderMode),symmetry:new B(this.options.symmetryMode)},this.setupScene(),this.controls=new wt(this),this.animate()}setupScene(){this.scene=new d.Scene,this.camera=new d.PerspectiveCamera(this.options.camera.fov,this.container.clientWidth/this.container.clientHeight,this.options.camera.near,this.options.camera.far),this.renderer=new d.WebGLRenderer({antialias:!0,alpha:!0}),this.renderer.setSize(this.container.clientWidth,this.container.clientHeight),this.container.appendChild(this.renderer.domElement),this.renderer.domElement.style.width="100%",this.renderer.domElement.style.height="100%",this.moleculeContainer=new d.Group,this.scene.add(this.moleculeContainer),this.camera.position.copy(this.options.camera.initialPosition),this.cameraTarget=new d.Vector3(0,0,0),this.camera.lookAt(this.cameraTarget),this.raycaster=new d.Raycaster,this.raycaster.params.Line.threshold=.5,this.raycaster.params.Points.threshold=.5,this.raycaster.params.Mesh.threshold=.1,this.raycaster.near=.1,this.raycaster.far=100}async loadStructure(t=null){try{if(this.clearScene(),t){this.state.currentCifContent=t;const s=new K(t,!0);this.state.baseStructure=S.fromCIF(s.getBlock(0))}const e=this.applyFilters(),o=gt(e);return this.updateCameraBounds(o),yt(this.scene,o),{success:!0}}catch(e){return console.error("Error loading structure:",e),{success:!1,error:e.message}}}applyFilters(){let t=this.state.baseStructure;for(const s of Object.values(this.modifiers))t=s.apply(t);const e=new et(t,this.options);this.state.ortepObjects=new Map,e.atoms3D.forEach(s=>this.state.ortepObjects.set(s.object3D,s)),e.bonds3D.forEach(s=>this.state.ortepObjects.set(s.object3D,s)),e.hBonds3D.forEach(s=>this.state.ortepObjects.set(s.object3D,s));const o=e.getGroup();return this.setupStructureObjects(o),this.moleculeContainer.add(o),this.state.currentStructure=o,o}clearScene(){this.moleculeContainer.clear(),this.state.selectedObjects.clear(),this.state.currentFloor&&this.scene.remove(this.state.currentFloor)}setupStructureObjects(t){t.traverse(e=>{e instanceof d.Mesh&&(e.castShadow=!0,e.receiveShadow=!0)})}updateCameraBounds(t){const e=Math.max(t.size.x,t.size.y,t.size.z);this.options.camera.minDistance=e*.5,this.options.camera.maxDistance=e*5;const o=e*2;this.camera.position.set(0,0,o),this.camera.rotation.set(0,0,0),this.camera.lookAt(this.cameraTarget)}async cycleHydrogenMode(){const t=this.modifiers.hydrogen.cycleMode(this.state.baseStructure);return{...await this.loadStructure(),mode:t}}async cycleDisorderMode(){const t=this.modifiers.disorder.cycleMode(this.state.baseStructure);return{...await this.loadStructure(),mode:t}}async cycleSymmetryMode(){const t=this.modifiers.symmetry.cycleMode(this.state.baseStructure);return{...await this.loadStructure(),mode:t}}hasDisorderGroups(){return this.state.baseStructure?this.modifiers.disorder.getApplicableModes(this.state.baseStructure).length>1:!1}animate(){requestAnimationFrame(this.animate.bind(this)),this.renderer.render(this.scene,this.camera)}handleSelection(t){t.userData.type==="hbond_segment"&&(t=t.userData.parentGroup),this.options.selection.mode==="single"&&(this.state.selectedObjects.forEach(o=>{this.removeSelection(o)}),this.state.selectedObjects.clear());let e;return this.state.selectedObjects.has(t)?(e=t.userData.selectionColor,this.removeSelection(t)):(this.addSelection(t),e=t.userData.selectionColor),this.notifySelectionCallbacks(),e}getNextSelectionColor(){const t=new Map;this.state.selectedObjects.forEach(o=>{const s=o.userData.selectionColor;t.set(s,(t.get(s)||0)+1)});let e=this.options.selection.markerColors.find(o=>!t.has(o));if(!e){const o=Math.min(...t.values());e=this.options.selection.markerColors.find(s=>t.get(s)===o)}return e}addSelection(t){const e=this.getNextSelectionColor();this.state.selectedObjects.add(t);const o=t.material.clone();o.emissive.setHex(this.options.selection.highlightEmissive),t.userData.originalMaterial=t.material,t.material=o;const n=this.state.ortepObjects.get(t).createSelectionMarker(e,this.options);t.add(n),t.userData.marker=n,t.userData.selectionColor=e}removeSelection(t){if(this.state.selectedObjects.delete(t),t.userData.marker){t.remove(t.userData.marker);try{t.userData.marker.geometry.dispose(),t.userData.marker.material.dispose()}catch{t.userData.marker.dispose()}t.userData.marker=null}t.userData.originalMaterial&&(t.material.dispose(),t.material=t.userData.originalMaterial,t.userData.originalMaterial=null)}clearSelections(){this.state.selectedObjects.forEach(t=>{this.removeSelection(t)}),this.notifySelectionCallbacks()}selectAtoms(t){this.clearSelections(),t.forEach(e=>{const o=this.findAtomMeshByLabel(e);o&&this.addSelection(o)}),this.notifySelectionCallbacks()}findAtomMeshByLabel(t){let e=null;return this.moleculeContainer.traverse(o=>{var s,n,a;((s=o.userData)==null?void 0:s.type)==="atom"&&((a=(n=o.userData)==null?void 0:n.atomData)==null?void 0:a.label)===t&&(e=o)}),e}onSelectionChange(t){this.state.selectionCallbacks.add(t)}notifySelectionCallbacks(){const t=Array.from(this.state.selectedObjects).map(e=>({type:e.userData.type,data:e.userData.type==="hbond"?e.userData.hbondData:e.userData.type==="bond"?e.userData.bondData:e.userData.atomData,color:e.userData.selectionColor}));this.state.selectionCallbacks.forEach(e=>e(t))}setSelectionMode(t){var e;if(t!=="single"&&t!=="multiple")throw new Error('Selection mode must be either "single" or "multiple"');if(this.options.selection.mode=t,t==="single"&&((e=this.state.selectedAtoms)==null?void 0:e.size)>1){const o=Array.from(this.state.selectedAtoms),s=o[o.length-1];this.clearSelections(),this.addSelection(s),this.notifySelectionCallbacks()}}dispose(){this.controls.dispose(),this.scene.traverse(t=>{t.geometry&&t.geometry.dispose(),t.material&&(Array.isArray(t.material)?t.material.forEach(e=>e.dispose()):t.material.dispose())}),this.renderer.dispose(),this.renderer.domElement.parentNode&&this.renderer.domElement.parentNode.removeChild(this.renderer.domElement),this.scene=null,this.camera=null,this.renderer=null,this.state=null,this.options=null}}const kt={disorder:{all:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="disorder-all.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.294133"
     inkscape:cx="14.64113"
     inkscape:cy="43.801382"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <g
       id="g8"
       transform="translate(0,-0.09016496)">
      <g
         id="g7"
         transform="translate(0,0.52916667)">
        <g
           id="path2-16"
           transform="rotate(180,28.623599,19.40998)"
           style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.707504,13.775784 -5.401798,11.08337"
             id="path3-6" />
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
             id="path4-1" />
        </g>
        <g
           id="path2-1-2"
           transform="rotate(180,28.623599,19.40998)"
           style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.600535,13.775784 5.401798,11.08337"
             id="path5-7" />
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
             id="path6-5" />
        </g>
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1-9"
           cx="-28.593182"
           cy="-24.863596"
           r="2.3135188"
           transform="scale(-1)" />
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1-2-3"
           cx="-33.888008"
           cy="-14.141389"
           r="2.3135188"
           transform="scale(-1)" />
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1-7-9"
           cx="-23.298351"
           cy="-14.141389"
           r="2.3135188"
           transform="scale(-1)" />
      </g>
      <g
         id="g6"
         transform="translate(0,-0.52916663)">
        <g
           id="path2"
           style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.707504,13.775784 -5.401798,11.08337"
             id="path3" />
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
             id="path4" />
        </g>
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1-2"
           cx="23.35919"
           cy="24.678572"
           r="2.3135188" />
        <g
           id="path2-1"
           style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 28.600535,13.775784 5.401798,11.08337"
             id="path5" />
          <path
             style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
             d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
             id="path6" />
        </g>
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1"
           cx="28.654018"
           cy="13.956366"
           r="2.3135188" />
        <circle
           style="fill:#000000;stroke:#000000;stroke-width:0.564999"
           id="path1-7"
           cx="33.948849"
           cy="24.678572"
           r="2.3135188" />
      </g>
    </g>
  </g>
</svg>
`,group1:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="disorder-only1.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.294133"
     inkscape:cx="14.64113"
     inkscape:cy="43.801382"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <g
       id="path2-16"
       transform="rotate(180,28.623599,19.629481)"
       style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.707504,13.775784 -5.401798,11.08337"
         id="path3-6" />
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
         id="path4-1" />
    </g>
    <g
       id="path2-1-2"
       transform="rotate(180,28.623599,19.629481)"
       style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.600535,13.775784 5.401798,11.08337"
         id="path5-7" />
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
         id="path6-5" />
    </g>
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1-9"
       cx="-28.593182"
       cy="-25.302597"
       r="2.3135188"
       transform="scale(-1)" />
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1-2-3"
       cx="-33.888008"
       cy="-14.580391"
       r="2.3135188"
       transform="scale(-1)" />
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1-7-9"
       cx="-23.298351"
       cy="-14.580391"
       r="2.3135188"
       transform="scale(-1)" />
    <g
       id="g6"
       transform="translate(0,-0.61933159)">
      <g
         id="path2"
         style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
        <path
           style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
           d="m 28.707504,13.775784 -5.401798,11.08337"
           id="path3" />
        <path
           style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
           d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
           id="path4" />
      </g>
      <circle
         style="fill:#000000;stroke:#000000;stroke-width:0.564999"
         id="path1-2"
         cx="23.35919"
         cy="24.678572"
         r="2.3135188" />
      <g
         id="path2-1"
         style="stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
        <path
           style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
           d="m 28.600535,13.775784 5.401798,11.08337"
           id="path5" />
        <path
           style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
           d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
           id="path6" />
      </g>
      <circle
         style="fill:#000000;stroke:#000000;stroke-width:0.564999"
         id="path1"
         cx="28.654018"
         cy="13.956366"
         r="2.3135188" />
      <circle
         style="fill:#000000;stroke:#000000;stroke-width:0.564999"
         id="path1-7"
         cx="33.948849"
         cy="24.678572"
         r="2.3135188" />
    </g>
  </g>
</svg>
`,group2:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="disorder-only2.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.294133"
     inkscape:cx="14.64113"
     inkscape:cy="37.294213"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <g
       id="path2-16"
       transform="rotate(180,28.623599,19.629481)"
       style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.707504,13.775784 -5.401798,11.08337"
         id="path3-6" />
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
         id="path4-1" />
    </g>
    <g
       id="path2-1-2"
       transform="rotate(180,28.623599,19.629481)"
       style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1">
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.600535,13.775784 5.401798,11.08337"
         id="path5-7" />
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
         id="path6-5" />
    </g>
    <circle
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1"
       id="path1-9"
       cx="-28.593182"
       cy="-25.302597"
       r="2.3135188"
       transform="scale(-1)" />
    <circle
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1"
       id="path1-2-3"
       cx="-33.888008"
       cy="-14.580391"
       r="2.3135188"
       transform="scale(-1)" />
    <circle
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.564999;stroke-opacity:1"
       id="path1-7-9"
       cx="-23.298351"
       cy="-14.580391"
       r="2.3135188"
       transform="scale(-1)" />
    <g
       id="path2"
       style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
       transform="translate(0,-0.61933159)">
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.707504,13.775784 -5.401798,11.08337"
         id="path3" />
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.257812,13.556641 -5.402343,11.083984 0.90039,0.4375 5.400391,-11.083984 z"
         id="path4" />
    </g>
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1-2"
       cx="23.35919"
       cy="24.05924"
       r="2.3135188" />
    <g
       id="path2-1"
       style="fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
       transform="translate(0,-0.61933159)">
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 28.600535,13.775784 5.401798,11.08337"
         id="path5" />
      <path
         style="color:#000000;fill:#a4a4a4;fill-opacity:1;stroke:#ffffff;stroke-width:0.2;stroke-dasharray:none;stroke-opacity:1"
         d="m 29.050781,13.556641 -0.90039,0.4375 5.402343,11.083984 0.898438,-0.4375 z"
         id="path6" />
    </g>
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1"
       cx="28.654018"
       cy="13.337034"
       r="2.3135188" />
    <circle
       style="fill:#a4a4a4;fill-opacity:1;stroke:#a4a4a4;stroke-width:0.564999;stroke-opacity:1"
       id="path1-7"
       cx="33.948849"
       cy="24.05924"
       r="2.3135188" />
  </g>
</svg>
`},hydrogen:{anisotropic:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.85038mm"
   height="17.850386mm"
   viewBox="0 0 17.85038 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="hydrogen-anisotropic.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.05051"
     inkscape:cx="33.69152"
     inkscape:cy="33.733012"
     inkscape:window-width="1920"
     inkscape:window-height="1009"
     inkscape:window-x="-8"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-78.600695,-38.873141)">
    <text
       xml:space="preserve"
       style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       x="84.344688"
       y="50.876183"
       id="text3-1-5-9"><tspan
         sodipodi:role="line"
         id="tspan3-4-4-0"
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1"
         x="84.344688"
         y="50.876183">H</tspan></text>
    <ellipse
       style="fill:none;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       id="path7-4"
       cx="41.174881"
       cy="90.830009"
       rx="4.9952669"
       ry="9.7379656"
       transform="rotate(-36.975178)" />
  </g>
</svg>
`,constant:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850388mm"
   height="17.850386mm"
   viewBox="0 0 17.850388 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="hydrogen-constant.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.05051"
     inkscape:cx="33.733012"
     inkscape:cy="33.733012"
     inkscape:window-width="1920"
     inkscape:window-height="1009"
     inkscape:window-x="-8"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-58.39314,-38.873141)">
    <text
       xml:space="preserve"
       style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       x="64.137131"
       y="50.876183"
       id="text3-1-8"><tspan
         sodipodi:role="line"
         id="tspan3-4-1"
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1"
         x="64.137131"
         y="50.876183">H</tspan></text>
    <circle
       style="fill:none;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       id="path6-0"
       cx="67.318336"
       cy="47.798332"
       r="6.8755083" />
  </g>
</svg>
`,none:`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="hydrogen-none.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.05051"
     inkscape:cx="33.69152"
     inkscape:cy="33.733012"
     inkscape:window-width="1920"
     inkscape:window-height="1009"
     inkscape:window-x="-8"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-37.755639,-38.873141)">
    <text
       xml:space="preserve"
       style="font-size:8.46667px;fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.677999;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       x="43.499626"
       y="50.876183"
       id="text3-6"
       inkscape:export-filename="hydrogen-none.svg"
       inkscape:export-xdpi="96"
       inkscape:export-ydpi="96"><tspan
         sodipodi:role="line"
         id="tspan3-5"
         style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.678;stroke-opacity:1"
         x="43.499626"
         y="50.876183">H</tspan></text>
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       d="m 39.917575,41.035079 13.526512,13.52651"
       id="path5-9" />
    <path
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.816;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       d="M 53.444087,41.035079 39.917575,54.561589"
       id="path5-1-0" />
  </g>
</svg>
`},symmetry:{"bonds-no-hbonds-no":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-no-hbonds-no.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <rect
       style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1"
       id="rect25"
       width="1.3572845"
       height="1.1344972"
       x="27.961069"
       y="23.823376" />
    <g
       id="path8"
       style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#808080;fill-opacity:1">
      <path
         style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654019,14.248425 h 10"
         id="path23" />
      <path
         style="color:#000000;fill:#808080;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z"
         id="path22" />
    </g>
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7"
       cx="23.335806"
       cy="14.248425"
       r="2.3135188" />
    <circle
       style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-7"
       cx="33.972233"
       cy="14.248425"
       r="2.3135188" />
    <path
       style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108"
       d="m 23.654019,24.391204 h 10"
       id="path25" />
    <path
       style="color:#000000;fill:#808080;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1"
       d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z"
       id="path24"
       sodipodi:nodetypes="cccccccccccccccccccccccccccccc" />
    <circle
       style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-53"
       cx="33.972233"
       cy="24.391207"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7-5"
       cx="23.335806"
       cy="24.391207"
       r="2.3135188" />
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
  </g>
</svg>
`,"bonds-no-hbonds-none":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-no-hbonds-none.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <g
       id="path8"
       style="fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
       transform="translate(0,5.0717688)">
      <path
         style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
         d="m 23.654019,14.248425 h 10"
         id="path23" />
      <path
         style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
         d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z"
         id="path22" />
    </g>
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7"
       cx="23.335806"
       cy="19.319817"
       r="2.3135188" />
    <circle
       style="fill:#808080;fill-opacity:1;stroke:none;stroke-width:0.564999"
       id="path1-7-7"
       cx="33.972233"
       cy="19.319817"
       r="2.3135188" />
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
  </g>
</svg>
`,"bonds-none-hbonds-no":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-none-hbonds-no.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <rect
       style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1"
       id="rect25"
       width="1.3572845"
       height="1.1344972"
       x="27.961069"
       y="18.752567" />
    <path
       style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108"
       d="m 23.654019,19.319816 h 10"
       id="path25" />
    <path
       style="color:#000000;fill:#808080;fill-opacity:1;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1"
       d="m 23.625124,18.720207 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z"
       id="path24"
       sodipodi:nodetypes="cccccccccccccccccccccccccccccc" />
    <circle
       style="fill:#808080;fill-opacity:1;stroke:none;stroke-width:0.564999"
       id="path1-7-53"
       cx="33.972233"
       cy="19.319817"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7-5"
       cx="23.335806"
       cy="19.319817"
       r="2.3135188" />
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
  </g>
</svg>
`,"bonds-none-hbonds-yes":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-none-hbonds-yes.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
    <rect
       style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1"
       id="rect25"
       width="1.3572845"
       height="1.1344972"
       x="27.961069"
       y="18.752567" />
    <path
       style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108"
       d="m 23.654019,19.319816 h 10"
       id="path25" />
    <path
       style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1"
       d="m 23.625124,18.720207 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z"
       id="path24"
       sodipodi:nodetypes="cccccccccccccccccccccccccccccc" />
    <circle
       style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999"
       id="path1-7-53"
       cx="33.972233"
       cy="19.319817"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7-5"
       cx="23.335806"
       cy="19.319817"
       r="2.3135188" />
  </g>
</svg>
`,"bonds-yes-hbonds-no":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-yes-hbonds-no.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <rect
       style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1"
       id="rect25"
       width="1.3572845"
       height="1.1344972"
       x="27.961069"
       y="23.823376" />
    <path
       style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108"
       d="m 23.654019,24.391204 h 10"
       id="path25" />
    <path
       style="color:#000000;fill:#808080;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1"
       d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z"
       id="path24"
       sodipodi:nodetypes="cccccccccccccccccccccccccccccc" />
    <circle
       style="fill:#808080;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-53"
       cx="33.972233"
       cy="24.391207"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7-5"
       cx="23.335806"
       cy="24.391207"
       r="2.3135188" />
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
    <g
       id="path8"
       style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#000000;fill-opacity:1">
      <path
         style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654019,14.248425 h 10"
         id="path23" />
      <path
         style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z"
         id="path22" />
    </g>
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7"
       cx="23.335806"
       cy="14.248425"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-7"
       cx="33.972233"
       cy="14.248425"
       r="2.3135188" />
  </g>
</svg>
`,"bonds-yes-hbonds-none":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-yes-hbonds-none.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
    <g
       id="path8"
       style="fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
       transform="translate(0,5.0717688)">
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
         d="m 23.654019,14.248425 h 10"
         id="path23" />
      <path
         style="color:#000000;fill:#000000;fill-opacity:1;stroke:#ffffff;stroke-width:0.4;stroke-dasharray:none;stroke-opacity:1"
         d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z"
         id="path22" />
    </g>
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7"
       cx="23.335806"
       cy="19.319817"
       r="2.3135188" />
    <circle
       style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:0.564999"
       id="path1-7-7"
       cx="33.972233"
       cy="19.319817"
       r="2.3135188" />
  </g>
</svg>
`,"bonds-yes-hbonds-yes":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="symmetry-bonds-yes-hbonds-yes.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="8.6932648"
     inkscape:cx="14.091369"
     inkscape:cy="37.097685"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1" />
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <path
       style="fill:#000000;stroke:#000000;stroke-width:0.6;stroke-dasharray:none"
       d="M 28.654019,10.932651 V 27.762155"
       id="path7" />
    <g
       id="path8"
       style="stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill:#000000;fill-opacity:1">
      <path
         style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654019,14.248425 h 10"
         id="path23" />
      <path
         style="color:#000000;fill:#000000;stroke-width:0.4;stroke-dasharray:none;stroke:#ffffff;stroke-opacity:1;fill-opacity:1"
         d="m 23.654297,13.648438 v 1.199218 h 10 v -1.199218 z"
         id="path22" />
    </g>
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7"
       cx="23.335806"
       cy="14.248425"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-7"
       cx="33.972233"
       cy="14.248425"
       r="2.3135188" />
    <rect
       style="fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:0.355503;stroke-dasharray:none;stroke-dashoffset:0.0831496;stroke-opacity:1"
       id="rect25"
       width="1.3572845"
       height="1.1344972"
       x="27.961069"
       y="23.823376" />
    <path
       style="color:#000000;fill:#000000;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.108"
       d="m 23.654019,24.391204 h 10"
       id="path25" />
    <path
       style="color:#000000;fill:#000000;stroke:#ffffff;stroke-width:0.3;stroke-dasharray:none;stroke-dashoffset:0.022;stroke-opacity:1;fill-opacity:1"
       d="m 23.625124,23.791016 v 1.199218 h 1.091797 v -1.199218 z m 1.691406,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800781,0 v 1.199218 h 1.199219 v -1.199218 z m 1.828001,0 v 1.199218 h 1.201172 v -1.199218 z m 1.800782,0 v 1.199218 h 1.199218 v -1.199218 z m 1.800781,0 v 1.199218 h 1.107422 v -1.199218 z"
       id="path24"
       sodipodi:nodetypes="cccccccccccccccccccccccccccccc" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.564999;fill-opacity:1"
       id="path1-7-53"
       cx="33.972233"
       cy="24.391207"
       r="2.3135188" />
    <circle
       style="fill:#000000;stroke:none;stroke-width:0.565;stroke-dasharray:none"
       id="path1-7-5"
       cx="23.335806"
       cy="24.391207"
       r="2.3135188" />
  </g>
</svg>
`},upload:{"":`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="17.850384mm"
   height="17.850386mm"
   viewBox="0 0 17.850384 17.850386"
   version="1.1"
   id="svg1"
   sodipodi:docname="upload.svg"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showguides="false"
     inkscape:zoom="12.294133"
     inkscape:cx="14.6818"
     inkscape:cy="43.801382"
     inkscape:window-width="2560"
     inkscape:window-height="1369"
     inkscape:window-x="1912"
     inkscape:window-y="-8"
     inkscape:window-maximized="1"
     inkscape:current-layer="layer1" />
  <defs
     id="defs1">
    <marker
       style="overflow:visible"
       id="ArrowWide"
       refX="0"
       refY="0"
       orient="auto-start-reverse"
       inkscape:stockid="Wide arrow"
       markerWidth="1"
       markerHeight="1"
       viewBox="0 0 1 1"
       inkscape:isstock="true"
       inkscape:collect="always"
       preserveAspectRatio="xMidYMid">
      <path
         style="fill:none;stroke:context-stroke;stroke-width:1;stroke-linecap:butt"
         d="M 3,-3 0,0 3,3"
         transform="rotate(180,0.125,0)"
         sodipodi:nodetypes="ccc"
         id="path1" />
    </marker>
  </defs>
  <g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-19.728827,-10.394623)">
    <text
       xml:space="preserve"
       style="font-size:7.05556px;fill:#e6e6e6;stroke:none;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none"
       x="22.242813"
       y="28.151989"
       id="text2"><tspan
         sodipodi:role="line"
         id="tspan2"
         style="font-size:7.05556px;fill:#1a1a1a;stroke-width:0.5;stroke-linecap:round;stroke-dasharray:none"
         x="22.242813"
         y="28.151989">CIF</tspan></text>
    <path
       style="fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1"
       d="m 20.714121,18.107197 v 3.07807 h 15.879794 v -3.07807"
       id="path2"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:none;stroke:#000000;stroke-width:0.68;stroke-linecap:butt;stroke-dasharray:none;stroke-opacity:1;marker-end:url(#ArrowWide)"
       d="M 28.654018,19.170064 V 11.045456"
       id="path3" />
  </g>
</svg>
`}};function st(l,t,e=4){if(!isFinite(1/t))return W(l,e).toFixed(e);let o=Math.floor(Math.log10(t));t*Math.pow(10,-o)<2&&(o-=1);const s=W(l,-o);if(o<0){const a=Math.round(t/Math.pow(10,o));return`${s.toFixed(-o)}(${a})`}const n=W(t,o);return`${s}(${n})`}function W(l,t){const e=Math.pow(10,t);return Math.round(l*e)/e}const bt=`
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
`;class at extends HTMLElement{static get observedAttributes(){return["caption","src","data","icons"]}constructor(){if(super(),!document.getElementById("cifview-styles")){const t=document.createElement("style");t.id="cifview-styles",t.textContent=bt,document.head.appendChild(t)}this.viewer=null,this.baseCaption="",this.selections=[],this.customIcons=null}get icons(){return{...{hydrogen:{none:"",constant:"",anisotropic:""},disorder:{all:"",group1:"",group2:""},symmetry:{"bonds-yes-hbonds-yes":"","bonds-yes-hbonds-no":"","bonds-no-hbonds-no":""}},...kt,...this.customIcons}}async connectedCallback(){this.baseCaption=this.getAttribute("caption")||"",this.customIcons=this.parseCustomIcons();const t=document.createElement("div");t.className="crystal-container",this.appendChild(t);const e=document.createElement("div");e.className="button-container",t.appendChild(e);const o=document.createElement("div");o.className="crystal-caption",o.textContent=this.baseCaption,this.appendChild(o),this.captionElement=o,this.viewer=new nt(t),this.viewer.onSelectionChange(a=>{this.selections=a,this.updateCaption()});const s=this.getAttribute("src"),n=this.getAttribute("data");if(s?await this.loadFromUrl(s):n&&await this.loadFromString(n),this.viewer.state.baseStructure){const a=this.viewer.modifiers.hydrogen.getApplicableModes(this.viewer.state.baseStructure).length>1,i=this.viewer.modifiers.disorder.getApplicableModes(this.viewer.state.baseStructure).length>1,h=this.viewer.modifiers.symmetry.getApplicableModes(this.viewer.state.baseStructure).length>1;a&&this.addButton(e,"hydrogen","none","Toggle Hydrogen Display"),i&&this.addButton(e,"disorder","all","Toggle Disorder Display"),h&&this.addButton(e,"symmetry","bonds-no-hbonds-no","Toggle Symmetry Display")}}parseCustomIcons(){try{const t={hydrogen:{src:this.getAttribute("hydrogen-icons"),modes:["none","constant","anisotropic"]},disorder:{src:this.getAttribute("disorder-icons"),modes:["all","group1","group2"]},symmetry:{src:this.getAttribute("symmetry-icons"),modes:["bonds-yes-hbonds-yes","bonds-yes-hbonds-no","bonds-no-hbonds-no"]}},e={};for(const[o,s]of Object.entries(t))if(s.src){const n=s.src.split(",");e[o]={},s.modes.forEach((a,i)=>{n[i]&&(e[o][a]=n[i].trim())})}return Object.keys(e).length?e:null}catch(t){return console.warn("Failed to parse custom icons:",t),null}}parseCustomIcons(){const t=this.getAttribute("icons");if(!t)return null;try{return JSON.parse(t)}catch(e){return console.warn("Failed to parse custom icons:",e),null}}addButton(t,e,o,s){const n=document.createElement("button");n.className=`control-button ${e}-button`,n.innerHTML=this.icons[e][o],n.title=s;const a=n.querySelector("svg");a&&(a.setAttribute("alt",s),a.setAttribute("role","img"),a.setAttribute("aria-label",s)),t.appendChild(n),n.addEventListener("click",async()=>{const i=await this.viewer[`cycle${e.charAt(0).toUpperCase()+e.slice(1)}Mode`]();i.success&&(n.innerHTML=this.icons[e][i.mode])})}async attributeChangedCallback(t,e,o){if(this.viewer)switch(t){case"caption":this.baseCaption=o,this.updateCaption();break;case"src":o&&await this.loadFromUrl(o);break;case"data":o&&await this.loadFromString(o);break;case"icons":this.customIcons=this.parseCustomIcons();break}}async loadFromUrl(t){try{const o=await(await fetch(t)).text();await this.viewer.loadStructure(o)}catch(e){console.error("Error loading structure:",e)}}async loadFromString(t){try{await this.viewer.loadStructure(t)}catch(e){console.error("Error loading structure:",e)}}updateCaption(){let t=this.baseCaption;if(this.selections.length>0){t.endsWith(".")||(t+="."),t+=" Selected Atoms and Bonds: ";const e=this.selections.map(o=>{const s="#"+o.color.toString(16).padStart(6,"0");let n="";if(o.type==="atom")n=`${o.data.label} (${o.data.atomType})`;else if(o.type==="bond"){const a=st(o.data.bondLength,o.data.bondLengthSU);n=`${o.data.atom1Label}-${o.data.atom2Label}: ${a} Å`}return`<span style="color:${s}">${n}</span>`}).join(", ");t+=e+"."}this.captionElement.innerHTML=t}disconnectedCallback(){this.viewer&&this.viewer.dispose()}}customElements.define("cifview-widget",at),u.CIF=K,u.CifViewWidget=at,u.CrystalStructure=S,u.CrystalViewer=nt,u.ORTEP3JsStructure=et,u.formatValueEsd=st,Object.defineProperty(u,Symbol.toStringTag,{value:"Module"})});
