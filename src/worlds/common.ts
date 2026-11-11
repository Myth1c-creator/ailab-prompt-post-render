// Shared pieces of the 3D worlds (copied from ads/ailab-ai-studio): eases, 3D type (whole words and letter by letter),
// photo slabs, round-sprite dust, god rays with soft sides, camera + shake, screen-anchored placement. Times: timing.ts.
import * as THREE from "three";
import { random } from "remotion";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { V, clamp, lerp } from "../three/shot3d";

export { FPS, fr } from "./timing";
export const rnd = (k: string) => random(`st-${k}`);
export const sg = (k: string) => rnd(k) * 2 - 1;
export const outCubic = (u: number) => 1 - Math.pow(1 - clamp(u), 3);
export const outQuad = (u: number) => 1 - Math.pow(1 - clamp(u), 2);
export const inOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const inCubic = (u: number) => Math.pow(clamp(u), 3);
export const outExpo = (u: number) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(u)));
export const outBack = (u: number, c = 1.7) => {
  const x = clamp(u) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};
export const tw = (t: number, a: number, b: number, e = outCubic) => e(clamp((t - a) / (b - a)));
export const pulse = (t: number, t0: number, k = 10) => (t < t0 ? 0 : Math.exp(-k * (t - t0)));

export const LIME = "#C6FF00";
export const PAPER = "#ECEEF0"; // ink of the AI LAB design (face of the 3D type)
export const INK = "#0A0C08";
export const BG = "#0B0D10"; // graphite
export const PANEL = "#171B21";
export const INK2 = "#A4AAB2";

export const imgTex = (img: TexImageSource | HTMLCanvasElement, srgb = true) => {
  const t = new THREE.Texture(img as HTMLImageElement);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};
export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// extruded type, centred; face and side materials (TextGeometry groups: 0 caps, 1 sides)
export function text3D(font: Font, s: string, o: { size?: number; depth?: number; face?: string; side?: string; faceEmissive?: number; sideEmissive?: number } = {}) {
  const size = o.size ?? 1;
  const depth = o.depth ?? 0.3 * size;
  const g = new TextGeometry(s, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: size * 0.022, bevelSegments: 3 });
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -depth / 2);
  const face = new THREE.MeshStandardMaterial({ color: o.face ?? PAPER, emissive: o.face ?? PAPER, emissiveIntensity: o.faceEmissive ?? 0.25, metalness: 0.1, roughness: 0.32 });
  const side = new THREE.MeshStandardMaterial({ color: o.side ?? LIME, emissive: o.side ?? LIME, emissiveIntensity: o.sideEmissive ?? 0.45, metalness: 0.3, roughness: 0.35 });
  const m = new THREE.Mesh(g, [face, side]);
  return { mesh: m, w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, mats: [face, side] };
}

// extruded type letter by letter, laid out with the font's advances exactly as TextGeometry does; a group centred on
// the word, each letter its own mesh (for staggered slams and for letters sucked into a point)
export function letters3D(font: Font, s: string, o: { size?: number; depth?: number; face?: string; side?: string; faceEmissive?: number; sideEmissive?: number } = {}) {
  const size = o.size ?? 1;
  const depth = o.depth ?? 0.3 * size;
  const data = (font as unknown as { data: { resolution: number; glyphs: Record<string, { ha: number }> } }).data;
  const k = size / data.resolution;
  const face = new THREE.MeshStandardMaterial({ color: o.face ?? PAPER, emissive: o.face ?? PAPER, emissiveIntensity: o.faceEmissive ?? 0.25, metalness: 0.1, roughness: 0.32 });
  const side = new THREE.MeshStandardMaterial({ color: o.side ?? LIME, emissive: o.side ?? LIME, emissiveIntensity: o.sideEmissive ?? 0.45, metalness: 0.3, roughness: 0.35 });
  const group = new THREE.Group();
  const items: { mesh: THREE.Mesh; home: THREE.Vector3; ch: string }[] = [];
  let x = 0;
  let minY = Infinity, maxY = -Infinity;
  for (const ch of s) {
    const gl = data.glyphs[ch] ?? data.glyphs["?"];
    if (ch !== " ") {
      const g = new TextGeometry(ch, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: size * 0.022, bevelSegments: 3 });
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      minY = Math.min(minY, bb.min.y);
      maxY = Math.max(maxY, bb.max.y);
      // each letter turns around its own centre
      const cx = (bb.min.x + bb.max.x) / 2;
      g.translate(-cx, 0, -depth / 2);
      const m = new THREE.Mesh(g, [face, side]);
      items.push({ mesh: m, home: V(x + cx, 0, 0), ch });
      group.add(m);
    }
    x += gl.ha * k;
  }
  const w = x, cy = (minY + maxY) / 2;
  for (const it of items) {
    it.home.x -= w / 2;
    it.home.y -= cy;
    it.mesh.position.copy(it.home);
  }
  return { group, items, w, h: maxY - minY, mats: [face, side] };
}

// a printed photo as a thick slab: rounded body, the picture on the front, a mirrored copy under the floor
export function slab(tex: THREE.Texture, w: number, h: number, o: { depth?: number; floorY?: number; edge?: string } = {}) {
  const d = o.depth ?? 0.05;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w + 0.02, h + 0.02, d, 3, Math.min(0.04, d * 0.45)),
    new THREE.MeshStandardMaterial({ color: "#15171b", metalness: 0.6, roughness: 0.25, emissive: o.edge ?? "#000000", emissiveIntensity: o.edge ? 0.35 : 0 }));
  g.add(body);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.0, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.55 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
  face.position.z = d / 2 + 0.002;
  g.add(face);
  return { group: g, face, faceMat, w, h, d };
}

// a fake floor reflection: the same picture flipped under the floor, faded (cheap, no second render)
export function reflect(tex: THREE.Texture, w: number, h: number, opacity = 0.22) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.scale.y = -1;
  return { mesh: p, mat: m };
}

export function floor(y = -2, size = 40, color = "#0b0d10") {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55, transparent: true, opacity: 0.86 }));
  f.rotation.x = -Math.PI / 2;
  f.position.y = y;
  return f;
}

// a round soft dot for every point cloud (PointsMaterial draws squares without a map: QA 2026-10-29, the galaxy)
let _dot: THREE.Texture | null = null;
export function roundSprite() {
  if (_dot) return _dot;
  const c = canvas(64, 64);
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(0.7, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _dot = imgTex(c);
  return _dot;
}
// a soft radial glow (cores, flares, floor pools)
export function glowTex(inner = "rgba(255,255,255,1)", mid = "rgba(235,255,190,0.7)", outer = "rgba(198,255,0,0)") {
  const c = canvas(256, 256);
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, mid);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return imgTex(c);
}
export function glowSprite(tex: THREE.Texture, color = "#ffffff") {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
}
// where a sample sits inside its output frame: 0 at the frame's start .. 1 at the shutter's end (AccumShot samples
// (frame + (i + .5) / N * 0.5) / fps); used to stretch frozen motion into hanging trails in bullet time
export const subFrame = (t: number) => clamp(((t * 60) % 1) / 0.5);

// floating dust with a slow drift (positions are pure functions of t)
export function dust(n: number, box: [number, number, number], center: THREE.Vector3, color = "#ffffff", size = 0.012, seed = "d") {
  const g = new THREE.BufferGeometry();
  const base = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    base[i * 3] = center.x + sg(`${seed}x${i}`) * box[0];
    base[i * 3 + 1] = center.y + sg(`${seed}y${i}`) * box[1];
    base[i * 3 + 2] = center.z + sg(`${seed}z${i}`) * box[2];
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: roundSprite(), alphaTest: 0.01, sizeAttenuation: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  const update = (t: number) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.4 + i) * 0.05;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.3 + i * 1.7) * 0.06 - ((t * 0.05) % 1) * 0.1;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 + i * 0.7) * 0.05;
    }
    (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  };
  update(0);
  return { points: pts, mat, update };
}

// soft god rays: additive gradient planes fanning from a point
export function godRays(from: THREE.Vector3, dir: THREE.Vector3, n = 5, len = 9, color = "#fff3d8", opacity = 0.09) {
  const c = canvas(64, 256);
  const x = c.getContext("2d")!;
  const gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(255,255,255,0.9)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 256);
  // soft sides too: without them each ray is a hard-edged board (QA 2026-10-29)
  const hz = x.createLinearGradient(0, 0, 64, 0);
  hz.addColorStop(0, "rgba(255,255,255,0)");
  hz.addColorStop(0.5, "rgba(255,255,255,1)");
  hz.addColorStop(1, "rgba(255,255,255,0)");
  x.globalCompositeOperation = "destination-in";
  x.fillStyle = hz;
  x.fillRect(0, 0, 64, 256);
  const tx = imgTex(c);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + rnd(`gr${i}`) * 0.9, len),
      new THREE.MeshBasicMaterial({ map: tx, color, transparent: true, opacity: opacity * (0.6 + rnd(`go${i}`) * 0.8), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, -len / 2, 0);
    m.position.copy(from);
    m.lookAt(from.clone().add(dir));
    m.rotateX(Math.PI / 2);
    m.rotateZ(sg(`gz${i}`) * 0.35);
    g.add(m);
  }
  return g;
}

// the "AI" tag on every photo card (the cards show AI people; the brief wants it on all of them)
export function aiTag(scale = 1) {
  const c = canvas(256, 128);
  const x = c.getContext("2d")!;
  x.fillStyle = LIME;
  x.beginPath();
  x.roundRect(8, 16, 240, 96, 48);
  x.fill();
  x.fillStyle = INK;
  x.font = "800 64px 'Instrument Sans'";
  x.textAlign = "center";
  x.fillText("AI", 128, 87);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26 * scale, 0.13 * scale), new THREE.MeshBasicMaterial({ map: imgTex(c), transparent: true }));
  return m;
}

// camera from keys + handheld + impact shakes
export type Imp = { t: number; power: number };
export function placeCam(cam: THREE.PerspectiveCamera, pos: THREE.Vector3, look: THREE.Vector3, fov: number, roll: number, t: number, imps: Imp[], hand = 0.012) {
  cam.fov = fov;
  cam.updateProjectionMatrix();
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  let sx = (Math.sin(t * 5.1 + 0.3) * 0.5 + Math.sin(t * 9.7 + 1.1) * 0.3 + Math.sin(t * 15.3 + 2.1) * 0.2) * hand;
  let sy = (Math.sin(t * 4.3 + 2.0) * 0.5 + Math.sin(t * 11.1 + 0.4) * 0.3 + Math.sin(t * 13.7 + 1.7) * 0.2) * hand;
  let rr = roll + Math.sin(t * 6.3 + 0.7) * hand * 0.4;
  for (const I of imps) {
    const a = t - I.t;
    if (a < 0 || a > 0.8) continue;
    const e = I.power * 0.05 * Math.exp(-a * 11);
    sx += e * Math.sin(a * 58 + I.t * 7);
    sy += e * 0.8 * Math.sin(a * 71 + I.t * 3);
    rr += e * 0.3 * Math.sin(a * 47 + I.t);
  }
  cam.translateX(sx);
  cam.translateY(sy);
  cam.rotateZ(rr);
  cam.updateMatrixWorld();
}
export const env = (t: number, imps: Imp[], k: number) => imps.reduce((m, I) => (t >= I.t && t < I.t + 1 ? Math.max(m, I.power * Math.exp(-(t - I.t) * k)) : m), 0);
export const dist = (cam: THREE.Camera, p: THREE.Vector3, look: THREE.Vector3) => Math.max(0.3, p.clone().sub(cam.position).dot(look.clone().sub(cam.position).normalize()));
export { V, clamp, lerp };

// a camera without handheld or shakes (the reference for screen-anchored type: the type then shakes with the world)
export function aim(cam: THREE.PerspectiveCamera, pos: THREE.Vector3, look: THREE.Vector3, fov: number, roll = 0) {
  cam.fov = fov;
  cam.updateProjectionMatrix();
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  cam.rotateZ(roll);
  cam.updateMatrixWorld();
}
// the world point seen at frame pixel (sx, sy) of a 1080x1920 frame, `d` units in front of the camera (along its axis)
export function screenPoint(cam: THREE.PerspectiveCamera, sx: number, sy: number, d: number) {
  const p = V((sx / 1080) * 2 - 1, 1 - (sy / 1920) * 2, 0.5).unproject(cam);
  const dir = p.sub(cam.position).normalize();
  const fwd = V(0, 0, -1).applyQuaternion(cam.quaternion);
  return cam.position.clone().addScaledVector(dir, d / dir.dot(fwd));
}
// world units per frame pixel at distance d
export const pxAt = (cam: THREE.PerspectiveCamera, d: number) => (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / 1920;

// ───────────── added for "Která z nich je AI?" ─────────────
// screen-anchored type and panels: centre at frame pixel (px, py), `widthPx` wide, `d` units in front of the no-shake
// camera `base` (the shaking camera then shakes it with the world); `tilt` is a small 3D turn (rad) so the extrusion shows
export function place(o: THREE.Object3D, base: THREE.PerspectiveCamera, px: number, py: number, widthPx: number, worldW: number, d: number, tilt: [number, number, number] = [0, 0, 0]) {
  o.position.copy(screenPoint(base, px, py, d));
  o.quaternion.copy(base.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt[0], tilt[1], tilt[2])));
  o.scale.setScalar((widthPx * pxAt(base, d)) / worldW);
}

// a rounded pill with a label ("?" before the drop, "AI" after it), lime on graphite or the other way round
export function pillTex(label: string, bg = LIME, fg = INK) {
  const c = canvas(256, 128);
  const x = c.getContext("2d")!;
  x.fillStyle = bg;
  x.beginPath();
  x.roundRect(8, 16, 240, 96, 48);
  x.fill();
  x.fillStyle = fg;
  x.font = "800 66px 'Instrument Sans'";
  x.textAlign = "center";
  x.fillText(label, 128, 89);
  return imgTex(c);
}

// the soft shadow of a word (ref9: extruded letters with a soft shadow): the word drawn blurred on a plane behind it.
// The plane is `worldW / 0.8` wide because the text fills 80 % of the canvas width.
export function softShadow(text: string, worldW: number, worldH: number, css = "800 200px Unbounded") {
  const c = canvas(1024, 512);
  const x = c.getContext("2d")!;
  x.font = css;
  const m = x.measureText(text);
  const k = (1024 * 0.8) / m.width;
  x.filter = "blur(18px)";
  x.fillStyle = "rgba(0,0,0,0.85)";
  x.translate(512, 256);
  x.scale(k, k);
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 0, 0);
  const planeW = worldW / 0.8;
  const mat = new THREE.MeshBasicMaterial({ map: imgTex(c), transparent: true, depthWrite: false, opacity: 0.8 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, (planeW * 512) / 1024), mat);
  mesh.renderOrder = -1;
  void worldH;
  return { mesh, mat };
}

// a soft light band (the ref9 "světelná šmouha"): additive, white core, lime fringe, feathered on all sides
export function streakTex() {
  const c = canvas(512, 128);
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, "rgba(198,255,0,0)");
  g.addColorStop(0.38, "rgba(214,255,120,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,1)");
  g.addColorStop(0.62, "rgba(214,255,120,0.35)");
  g.addColorStop(1, "rgba(198,255,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 128);
  x.globalCompositeOperation = "destination-in";
  const v = x.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, "rgba(255,255,255,0)");
  v.addColorStop(0.5, "rgba(255,255,255,1)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = v;
  x.fillRect(0, 0, 512, 128);
  return imgTex(c);
}
export function streak(w: number, h: number, color = "#ffffff") {
  const mat = new THREE.MeshBasicMaterial({ map: streakTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), mat };
}

// a volumetric spotlight cone as a soft billboard (narrow at the top, wide at the floor, soft sides, fading down)
export function coneTex() {
  const c = canvas(256, 512);
  const x = c.getContext("2d")!;
  for (let y = 0; y < 512; y++) {
    const v = y / 511;
    const half = 10 + 118 * v;
    const a = 0.85 * Math.pow(1 - v, 0.6) * (0.35 + 0.65 * v);
    const g = x.createLinearGradient(128 - half, 0, 128 + half, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(128 - half, y, half * 2, 1);
  }
  return imgTex(c);
}

// the dot of an extruded "?" (its lowest separate blob): the centre of the vertices in the bottom 18 % of the glyph
export function dotOf(mesh: THREE.Mesh) {
  const pa = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const lim = bb.min.y + 0.18 * (bb.max.y - bb.min.y);
  const c = V();
  let n = 0;
  for (let i = 0; i < pa.count; i++)
    if (pa.getY(i) < lim) {
      c.x += pa.getX(i);
      c.y += pa.getY(i);
      n++;
    }
  return n ? c.multiplyScalar(1 / n).setZ(0) : V(0, bb.min.y, 0);
}

// particle bursts (dust thrown up by a landing): every burst is a pure function of time since it fired
export type Burst = { t: number; at: THREE.Vector3; power: number; lime?: number; up?: number };
export function bursts(list: Burst[], n = 70, size = 0.02, seed = "b") {
  const N = list.length * n;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: roundSprite(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  pts.frustumCulled = false;
  const lime = new THREE.Color(LIME), warm = new THREE.Color("#fff3e2");
  const v = Array.from({ length: N }, (_, k) => {
    const a = rnd(`${seed}a${k}`) * Math.PI * 2, e = sg(`${seed}e${k}`) * 0.9;
    const sp = 0.4 + rnd(`${seed}s${k}`) * 1.4;
    return [Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + 0.2, Math.sin(a) * Math.cos(e) * sp, rnd(`${seed}l${k}`)];
  });
  const update = (t: number) => {
    list.forEach((B, j) => {
      const a = t - B.t;
      for (let i = 0; i < n; i++) {
        const k = j * n + i, q = v[k];
        const vis = a >= 0 && a < 1.2;
        const s = (1 - Math.exp(-3 * Math.max(0, a))) / 3;
        pos[k * 3] = B.at.x + q[0] * s * B.power;
        pos[k * 3 + 1] = B.at.y + (q[1] * (B.up ?? 1)) * s * B.power - 0.25 * a * a;
        pos[k * 3 + 2] = B.at.z + q[2] * s * B.power;
        const cc = q[3] < (B.lime ?? 0.3) ? lime : warm;
        const br = vis ? Math.exp(-2.6 * a) * (q[3] < (B.lime ?? 0.3) ? 1.3 : 0.6) : 0;
        col[k * 3] = cc.r * br;
        col[k * 3 + 1] = cc.g * br;
        col[k * 3 + 2] = cc.b * br;
      }
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return { points: pts, update };
}
