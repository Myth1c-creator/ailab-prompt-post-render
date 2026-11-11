// Pieces shared by the worlds (from ads/ailab-co-umi; + the full-frame picture, the post card and the heart of "prompt ->
// post"): the app board (a real crop of the AI LAB recording on a tilted 3D slab, prep_screens.py), 3D words with ref9's soft shadow, lime highlight outlines and corner brackets, small canvas labels,
// a picture slab whose crop follows its changing aspect, and pose blending between a board-local and a screen pose.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BG, INK, LIME, PAPER, V, canvas, clamp, imgTex, place, softShadow, text3D } from "./common";
import { fitRect, FOCUS, type Media, type Src } from "./media";
import { glowTex, glowSprite } from "./common";
import { drawMark } from "./logo";

export const D = 5; // the distance of the screen-anchored layer from the base camera

// ── the app board: dark slab, the recording crop on its face (unlit: the UI keeps its own colours), a lime rim glow ──
export type BoardObj = {
  g: THREE.Group;
  face: THREE.Mesh;
  faceMat: THREE.MeshBasicMaterial;
  rim: THREE.MeshBasicMaterial;
  H: number; // height in board units (width is 1)
  px: [number, number]; // the texture's size in px
  local: (bx: number, by: number, z?: number) => THREE.Vector3; // board px (from the top left) -> board units
  boxC: (b: [number, number, number, number], z?: number) => THREE.Vector3; // the centre of a px box
};
export function mkBoard(scene: THREE.Scene, src: Src, size: [number, number], o: { depth?: number; glow?: number } = {}): BoardObj {
  const a = size[0] / size[1];
  const H = 1 / a;
  const d = o.depth ?? 0.035;
  const g = new THREE.Group();
  g.name = `board:${src.key}`;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1 + 0.03, H + 0.03, d, 3, Math.min(0.012, d * 0.45)),
    new THREE.MeshStandardMaterial({ color: "#14171c", metalness: 0.7, roughness: 0.25, emissive: LIME, emissiveIntensity: 0.08 }));
  body.position.z = -d / 2;
  g.add(body);
  const faceMat = new THREE.MeshBasicMaterial({ map: src.view(a, 1, [0.5, 0.5]) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, H), faceMat);
  face.position.z = 0.002;
  g.add(face);
  // the rim: a soft lime glow just outside the slab (additive, behind it)
  const rimMat = new THREE.MeshBasicMaterial({ map: rimTex(), color: LIME, transparent: true, opacity: o.glow ?? 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(1.12, H + 0.12), rimMat);
  rim.position.z = -d - 0.01;
  g.add(rim);
  g.visible = false;
  scene.add(g);
  const local = (bx: number, by: number, z = 0.004) => V(bx / size[0] - 0.5, (0.5 - by / size[1]) * H, z);
  const boxC = (b: [number, number, number, number], z = 0.004) => local((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z);
  return { g, face, faceMat, rim: rimMat, H, px: size, local, boxC };
}
let _rim: THREE.Texture | null = null;
function rimTex() {
  if (_rim) return _rim;
  const c = canvas(256, 256);
  const x = c.getContext("2d")!;
  x.filter = "blur(10px)";
  x.strokeStyle = "rgba(255,255,255,1)";
  x.lineWidth = 12;
  x.strokeRect(22, 22, 212, 212);
  _rim = imgTex(c);
  return _rim;
}

// a lime rounded outline (a highlight around a UI element), w x h board units, additive
export function outline(w: number, h: number, color = LIME) {
  const c = canvas(512, 256);
  const x = c.getContext("2d")!;
  x.shadowColor = "rgba(198,255,0,1)";
  x.shadowBlur = 18;
  x.strokeStyle = "rgba(220,255,120,1)";
  x.lineWidth = 9;
  x.beginPath();
  x.roundRect(24, 24, 464, 208, 26);
  x.stroke();
  const mat = new THREE.MeshBasicMaterial({ map: imgTex(c), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  // the stroke sits at 24/512 and 24/256 inside the canvas: the plane is a little larger than the box
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * (512 / 464), h * (256 / 208)), mat);
  return { mesh: m, mat };
}

// lime corner brackets (the app's format frames), a canvas of aspect a, transparent between
export function cornersTex(a: number) {
  const W = 512, H = Math.round(512 / a);
  const c = canvas(W, H);
  const x = c.getContext("2d")!;
  x.strokeStyle = LIME;
  x.lineWidth = 10;
  const L = Math.min(W, H) * 0.16, p = 8;
  for (const [cx, cy, sx, sy] of [[p, p, 1, 1], [W - p, p, -1, 1], [p, H - p, 1, -1], [W - p, H - p, -1, -1]]) {
    x.beginPath();
    x.moveTo(cx + sx * L, cy);
    x.lineTo(cx, cy);
    x.lineTo(cx, cy + sy * L);
    x.stroke();
  }
  return imgTex(c);
}

// a one-line label on a canvas (Geist Mono, lime or paper); returns the texture and the text's width fraction
export function labelTex(s: string, o: { css?: string; color?: string; w?: number; h?: number; bg?: string } = {}) {
  const W = o.w ?? 512, H = o.h ?? 96;
  const c = canvas(W, H);
  const x = c.getContext("2d")!;
  if (o.bg) {
    x.fillStyle = o.bg;
    x.beginPath();
    x.roundRect(6, 6, W - 12, H - 12, (H - 12) / 2);
    x.fill();
  }
  x.font = o.css ?? "500 34px 'Geist Mono'";
  x.fillStyle = o.color ?? LIME;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(s, W / 2, H / 2 + 2);
  return { tex: imgTex(c), frac: x.measureText(s).width / W, a: W / H };
}
export function labelMesh(s: string, o: Parameters<typeof labelTex>[1] = {}) {
  const L = labelTex(s, o);
  const mat = new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / L.a), mat);
  mesh.name = `label:${s}`;
  return { mesh, mat, frac: L.frac };
}

// ── 3D words: solid face + lime sides, a soft shadow behind (on light grounds it reads as depth) ──
export type W3 = { g: THREE.Group; w: number; h: number; mats: THREE.Material[] };
export function word3(M: Media, scene: THREE.Scene, s: string, face = PAPER, side = LIME, fe = 0.3, se = 0.5): W3 {
  const w = text3D(M.font, s, { size: 1, depth: 0.3, face, side, faceEmissive: fe, sideEmissive: se });
  const g = new THREE.Group();
  g.name = `word:${s}`;
  g.add(w.mesh);
  const sh = softShadow(s, w.w, w.h);
  sh.mesh.position.set(0.05 * w.h, -0.09 * w.h, -0.5);
  g.add(sh.mesh);
  g.visible = false;
  scene.add(g);
  return { g, w: w.w, h: w.h, mats: w.mats };
}
// the tilt every word gets (shows the extrusion, sways)
export const wordTilt = (t: number, seed: number, k = 1): [number, number, number] => [0.13 + 0.04 * Math.sin(t * 1.6 + seed) * k, -0.16 * Math.sin(t * 1.2 + seed * 0.7) * k, 0];
export function setWordColors(w: W3, face: string, side: string) {
  const [f, s] = w.mats as THREE.MeshStandardMaterial[];
  f.color.set(face);
  f.emissive.set(face);
  s.color.set(side);
  s.emissive.set(side);
}

// ── a picture slab whose crop follows its aspect (cover-fit around the picture's focus), with lime corner brackets ──
export type Pic = { g: THREE.Group; face: THREE.Mesh; tex: THREE.Texture; src: Src; corners: THREE.Mesh; body: THREE.Mesh; setAspect: (a: number, zoom?: number) => void; a: number };
// (the brackets are drawn for the slab's final aspect `cornersA`: a slab that morphs only shows them near its end)
export function mkPic(scene: THREE.Scene, src: Src, a0: number, o: { corners?: boolean; depth?: number; cornersA?: number } = {}): Pic {
  const g = new THREE.Group();
  g.name = `pic:${src.key}`;
  const d = o.depth ?? 0.03;
  const tex = src.view(a0, 1);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.002;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, d), new THREE.MeshStandardMaterial({ color: "#121418", metalness: 0.7, roughness: 0.25, emissive: LIME, emissiveIntensity: 0.1 }));
  body.position.z = -d / 2;
  const corners = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08), new THREE.MeshBasicMaterial({ map: cornersTex(o.cornersA ?? a0), transparent: true, depthWrite: false }));
  corners.position.z = 0.006;
  corners.visible = o.corners ?? false;
  g.add(body, face, corners);
  g.visible = false;
  scene.add(g);
  const P: Pic = {
    g, face, tex, src, corners, body, a: a0,
    // the slab is 1 unit wide; its height follows the aspect, the texture's crop follows too (no stretching)
    setAspect: (a: number, zoom = 1) => {
      P.a = a;
      face.scale.set(1, 1 / a, 1);
      body.scale.set(1, 1 / a, 1);
      corners.scale.set(1, 1 / a, 1);
      const r = fitRect(src.aspect, a, FOCUS[src.key], zoom);
      tex.repeat.set(r.rx, r.ry);
      tex.offset.set(r.ox, r.oy);
    },
  };
  P.setAspect(a0);
  return P;
}

// ── poses: a board-local point seen through its board, blended with a screen-anchored pose ──
export type Pose = { p: THREE.Vector3; q: THREE.Quaternion; s: number };
export const poseOf = (o: THREE.Object3D): Pose => ({ p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.x });
export function screenPose(base: THREE.PerspectiveCamera, px: number, py: number, wpx: number, d = D, tilt: [number, number, number] = [0, 0, 0]): Pose {
  const o = new THREE.Object3D();
  place(o, base, px, py, wpx, 1, d, tilt);
  return poseOf(o);
}
// the world pose of a box on a board (x0 y0 x1 y1 in board px), as a 1-unit-wide object of that box's width
export function boardBoxPose(B: BoardObj, b: [number, number, number, number], z = 0.03): Pose {
  B.g.updateMatrixWorld(true);
  const p = B.g.localToWorld(B.boxC(b, z));
  const q = B.g.getWorldQuaternion(new THREE.Quaternion());
  const s = B.g.getWorldScale(V()).x * ((b[2] - b[0]) / B.px[0]);
  return { p, q, s };
}
export function applyPose(o: THREE.Object3D, A: Pose, Bp: Pose, u: number, lift = 0) {
  const k = clamp(u);
  o.position.copy(A.p).lerp(Bp.p, k);
  // an arc towards the camera between the two (a card lifting off its board)
  if (lift) o.position.z += lift * Math.sin(Math.PI * k);
  o.quaternion.copy(A.q).slerp(Bp.q, k);
  o.scale.setScalar(A.s + (Bp.s - A.s) * k);
}

// a soft white-lime glow (a flare behind a reveal)
export const flare = () => glowSprite(glowTex("rgba(255,255,255,0.9)", "rgba(230,255,170,0.45)", "rgba(198,255,0,0)"));
export { BG, INK, LIME, PAPER };

// ───────────── added for "prompt -> post" ─────────────
// a full-frame picture (a video shot or the photo): a plane that always covers the frame (screen-anchored, overscanned
// 10 % for the shake), whose crop (zoom, focus) is set on every sample: cuts, punch-ins, pans and whips are crop moves,
// blurred by the shot's sub-frame samples. It writes depth and sits just behind the type, so the DOF keeps it sharp.
export const OVER = 1.1;
export type Full = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.Texture; set: (base: THREE.PerspectiveCamera, zoom: number, fx: number, fy: number, o?: { bright?: number; roll?: number; wipe?: number }) => void };
export function mkFull(scene: THREE.Scene, src: Src, d = D + 0.9): Full {
  const tex = src.view(9 / 16, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 16 / 9), mat);
  mesh.name = `full:${src.key}`;
  mesh.visible = false;
  scene.add(mesh);
  // zoom is what the frame sees (>= OVER); wipe 0..1 removes the picture from its left edge (a band wipes it away)
  const set: Full["set"] = (base, zoom, fx, fy, o = {}) => {
    mesh.visible = true;
    place(mesh, base, 540, 960, 1080 * OVER, 1, d, [0, 0, o.roll ?? 0]);
    const r = fitRect(src.aspect, 9 / 16, [fx, fy], Math.max(1, zoom / OVER));
    const u = clamp(o.wipe ?? 0, 0, 0.9999);
    const sx = mesh.scale.x;
    mesh.scale.x = sx * (1 - u);
    mesh.translateX((sx * u) / 2);
    tex.repeat.set(r.rx * (1 - u), r.ry);
    tex.offset.set(r.ox + r.rx * u, r.oy);
    mat.color.setScalar(o.bright ?? 1);
  };
  return { mesh, mat, tex, set };
}

// a heart, 1 unit wide, centred (the classic curve), as a shape / an extruded lime mesh / a canvas path
const heartPts = (n = 48) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector2((16 * Math.pow(Math.sin(a), 3)) / 32, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a) + 2.5) / 32);
  });
export function heartMesh(depth = 0.16) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(heartPts()), { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  const face = new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.3, transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: "#4f6600", emissive: LIME, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3, transparent: true });
  const mesh = new THREE.Mesh(g, [face, side]);
  mesh.name = "heart";
  return { mesh, face, side };
}
function heartPath(c: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  c.beginPath();
  heartPts(64).forEach((p, i) => (i ? c.lineTo(cx + p.x * w, cy - p.y * w) : c.moveTo(cx + p.x * w, cy - p.y * w)));
  c.closePath();
}

// the post frame in AI LAB's own design (no other app's UI): a graphite card, the mark + "AI LAB" in its header, a 4:5
// window for the picture with lime corner ticks, a heart outline and two quiet lines under it. Canvas px = CARD.px.
export const CARD = { px: [800, 1180] as [number, number], win: [30, 130, 770, 1055] as [number, number, number, number], heart: [86, 1118] as [number, number], heartW: 64 };
export type CardObj = { g: THREE.Group; H: number; boxPose: (b: [number, number, number, number], z?: number) => Pose; point: (x: number, y: number, z?: number) => THREE.Vector3 };
export function mkCard(scene: THREE.Scene): CardObj {
  const [Wc, Hc] = CARD.px;
  const c = canvas(Wc, Hc);
  const x = c.getContext("2d")!;
  x.fillStyle = "#12151a";
  x.beginPath();
  x.roundRect(0, 0, Wc, Hc, 34);
  x.fill();
  x.strokeStyle = "rgba(198,255,0,0.35)";
  x.lineWidth = 3;
  x.beginPath();
  x.roundRect(2, 2, Wc - 4, Hc - 4, 32);
  x.stroke();
  drawMark(x, 34, 30, 70);
  x.fillStyle = PAPER;
  x.font = "700 46px 'Instrument Sans'";
  x.textBaseline = "middle";
  x.fillText("AI LAB", 122, 67);
  // the window (the picture lands here) and its lime corner ticks
  const [x0, y0, x1, y1] = CARD.win;
  x.fillStyle = "#0b0d10";
  x.fillRect(x0, y0, x1 - x0, y1 - y0);
  x.strokeStyle = LIME;
  x.lineWidth = 6;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    x.beginPath();
    x.moveTo(cx + sx * 54, cy);
    x.lineTo(cx, cy);
    x.lineTo(cx, cy + sy * 54);
    x.stroke();
  }
  // the heart's outline and two quiet lines
  x.strokeStyle = "#A4AAB2";
  x.lineWidth = 5;
  x.lineJoin = "round";
  heartPath(x, CARD.heart[0], CARD.heart[1], CARD.heartW);
  x.stroke();
  x.fillStyle = "rgba(164,170,178,0.35)";
  x.beginPath();
  x.roundRect(150, 1096, 380, 16, 8);
  x.fill();
  x.beginPath();
  x.roundRect(150, 1126, 250, 16, 8);
  x.fill();
  const H = Hc / Wc;
  const g = new THREE.Group();
  g.name = "post:card";
  const d = 0.03;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.012, H + 0.012, d, 3, 0.012), new THREE.MeshStandardMaterial({ color: "#14171c", metalness: 0.7, roughness: 0.25, emissive: LIME, emissiveIntensity: 0.1 }));
  body.position.z = -d / 2;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, H), new THREE.MeshBasicMaterial({ map: imgTex(c), transparent: true }));
  face.position.z = 0.002;
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(1.14, H + 0.14), new THREE.MeshBasicMaterial({ map: glowTex("rgba(198,255,0,0.5)", "rgba(198,255,0,0.16)", "rgba(198,255,0,0)"), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  rim.position.z = -d - 0.01;
  g.add(body, face, rim);
  g.visible = false;
  scene.add(g);
  const point = (px: number, py: number, z = 0.004) => V(px / Wc - 0.5, (0.5 - py / Hc) * H, z);
  const boxPose = (b: [number, number, number, number], z = 0.012): Pose => {
    g.updateMatrixWorld(true);
    return { p: g.localToWorld(point((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, z)), q: g.getWorldQuaternion(new THREE.Quaternion()), s: g.getWorldScale(V()).x * ((b[2] - b[0]) / Wc) };
  };
  return { g, H, boxPose, point };
}
