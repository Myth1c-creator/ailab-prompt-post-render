// The "logo as a window" kit of this reel (script.md 6a): the AI LAB octagon as a window, a ring, a shock wave, a plate
// that melts from the clapper's rectangle into the octagon (a morph target), shards of a picture, light shards, radial
// rays and the HUD label. Regular octagons with a flat top, like the mark (public/img/mark.svg).
import * as THREE from "three";
import { V, canvas, imgTex, rnd, sg, LIME, INK } from "./common";

const A8 = (k: number) => Math.PI / 8 + (k * Math.PI) / 4; // vertex angles: flat top and sides
export const octPts = (r: number) => Array.from({ length: 8 }, (_, k) => new THREE.Vector2(r * Math.cos(A8(k)), r * Math.sin(A8(k))));
// the distance from the centre to the octagon's edge along angle a (circumradius r)
export const octRay = (r: number, a: number) => {
  const s = Math.PI / 4;
  const rel = ((((a - Math.PI / 8) % s) + s) % s) - s / 2; // angle from the nearest edge's normal... measured to the edge mid
  return (r * Math.cos(Math.PI / 8)) / Math.cos(rel);
};
export const octShape = (r: number) => new THREE.Shape(octPts(r));

// a flat octagon (radius r) whose UVs cover the square (-r..r)²: a picture window
export function octPlate(r: number) {
  const g = new THREE.ShapeGeometry(octShape(r), 1);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * r) + 0.5, p.getY(i) / (2 * r) + 0.5);
  return g;
}
// an extruded octagonal ring (outer radius r, band b, depth d), centred in depth
export function octRing(r: number, b: number, d: number) {
  const s = octShape(r);
  s.holes.push(new THREE.Path(octPts(r - b).reverse()));
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -d / 2);
  return g;
}

// a plate that melts from a w×h rectangle (the clapper card) into an octagon of radius r (morph target 0), depth d.
// Both outlines are sampled on the same rays from the centre, so every vertex has a partner; UVs stay the rectangle's
// (the picture squeezes into the octagon as it melts).
export function morphPlate(w: number, h: number, r: number, d: number, n = 64) {
  const rect = (a: number) => {
    const c = Math.cos(a), s = Math.sin(a);
    const k = Math.min(Math.abs(c) > 1e-6 ? w / 2 / Math.abs(c) : Infinity, Math.abs(s) > 1e-6 ? h / 2 / Math.abs(s) : Infinity);
    return [c * k, s * k];
  };
  const oct = (a: number) => {
    const k = octRay(r, a);
    return [Math.cos(a) * k, Math.sin(a) * k];
  };
  const pa: number[] = [], pb: number[] = [], uv: number[] = [];
  const push = (A: number[], B: number[], z: number) => {
    pa.push(A[0], A[1], z);
    pb.push(B[0], B[1], z);
    uv.push(A[0] / w + 0.5, A[1] / h + 0.5);
  };
  const ang = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + Math.PI / 8);
  const seg = (i: number) => [rect(ang[i]), rect(ang[(i + 1) % n]), oct(ang[i]), oct(ang[(i + 1) % n])];
  // the caps first (group 0: front fan +z, back fan -z), then the sides (group 1)
  for (let i = 0; i < n; i++) {
    const [R0, R1, O0, O1] = seg(i);
    push([0, 0], [0, 0], d / 2);
    push(R0, O0, d / 2);
    push(R1, O1, d / 2);
    push([0, 0], [0, 0], -d / 2);
    push(R1, O1, -d / 2);
    push(R0, O0, -d / 2);
  }
  for (let i = 0; i < n; i++) {
    const [R0, R1, O0, O1] = seg(i);
    push(R0, O0, d / 2);
    push(R0, O0, -d / 2);
    push(R1, O1, d / 2);
    push(R1, O1, d / 2);
    push(R0, O0, -d / 2);
    push(R1, O1, -d / 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pa, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(pb, 3)];
  g.computeVertexNormals();
  g.addGroup(0, n * 6, 0);
  g.addGroup(n * 6, n * 6, 1);
  return g;
}

// a w×h plane cut into triangles (a jittered grid split on a diagonal), each centred on its centroid, UVs of the plane
export function shardsOf(w: number, h: number, nx: number, ny: number, seed = "sh") {
  const out: { geo: THREE.BufferGeometry; c: THREE.Vector3 }[] = [];
  const P = (a: number, b: number) =>
    V((a / nx - 0.5) * w + (a > 0 && a < nx ? sg(`${seed}x${a}_${b}`) * 0.3 * (w / nx) : 0), (b / ny - 0.5) * h + (b > 0 && b < ny ? sg(`${seed}y${a}_${b}`) * 0.3 * (h / ny) : 0), 0);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
      const tris = (i + j) % 2 ? [[A, B, C], [A, C, D]] : [[A, B, D], [B, C, D]];
      for (const tri of tris) {
        const c = tri[0].clone().add(tri[1]).add(tri[2]).multiplyScalar(1 / 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(tri.flatMap((q) => [q.x - c.x, q.y - c.y, 0]), 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(tri.flatMap((q) => [q.x / w + 0.5, q.y / h + 0.5]), 2));
        g.computeVertexNormals();
        out.push({ geo: g, c });
      }
    }
  return out;
}

// soft textures: a ring (shock wave), an octagonal outline glow, a filled soft octagon (bokeh), a radial ray
export function ringTex(color = "230,255,170") {
  const c = canvas(256, 256);
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 88, 128, 128, 128);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.72, `rgba(${color},0.85)`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return imgTex(c);
}
export function octOutlineTex(color = "rgba(214,255,90,1)", blur = 10, lw = 10) {
  const c = canvas(512, 512);
  const x = c.getContext("2d")!;
  x.filter = `blur(${blur}px)`;
  x.strokeStyle = color;
  x.lineWidth = lw;
  x.lineJoin = "round";
  x.beginPath();
  octPts(200).forEach((p, i) => (i ? x.lineTo(256 + p.x, 256 - p.y) : x.moveTo(256 + p.x, 256 - p.y)));
  x.closePath();
  x.stroke();
  x.filter = "none";
  x.lineWidth = lw * 0.35;
  x.strokeStyle = "rgba(255,255,255,0.9)";
  x.stroke();
  return imgTex(c);
}
export function octSpriteTex() {
  const c = canvas(128, 128);
  const x = c.getContext("2d")!;
  x.filter = "blur(5px)";
  x.fillStyle = "rgba(255,255,255,1)";
  x.beginPath();
  octPts(48).forEach((p, i) => (i ? x.lineTo(64 + p.x, 64 - p.y) : x.moveTo(64 + p.x, 64 - p.y)));
  x.closePath();
  x.fill();
  return imgTex(c);
}
export function rayTex() {
  const c = canvas(64, 512);
  const x = c.getContext("2d")!;
  const v = x.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, "rgba(255,255,255,0)");
  v.addColorStop(0.15, "rgba(255,255,255,1)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = v;
  x.fillRect(0, 0, 64, 512);
  x.globalCompositeOperation = "destination-in";
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(255,255,255,0)");
  h.addColorStop(0.5, "rgba(255,255,255,1)");
  h.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = h;
  x.fillRect(0, 0, 64, 512);
  return imgTex(c);
}

// radial rays fanning from the group's origin in its XY plane (the charge, the light burst, behind the logo)
export function rayFan(n: number, len: number, width: number, color = "#efffcf", seed = "rf") {
  const tx = rayTex();
  const g = new THREE.Group();
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ map: tx, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(width * (0.5 + rnd(`${seed}w${i}`)), len * (0.6 + 0.6 * rnd(`${seed}l${i}`)));
    geo.translate(0, geo.parameters.height / 2, 0);
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.z = (i / n) * Math.PI * 2 + sg(`${seed}a${i}`) * 0.12;
    g.add(mesh);
    mats.push(m);
  }
  return { group: g, mats };
}

// light shards: thin additive triangles thrown out from a point at a time (pure functions of time since the throw)
export function lightShards(n: number, seed = "ls", zSign = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#f2ffd0", transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const items = Array.from({ length: n }, (_, i) => {
    const L = 0.08 + rnd(`${seed}L${i}`) * 0.22, Wd = 0.012 + rnd(`${seed}W${i}`) * 0.02;
    const geo = new THREE.BufferGeometry().setFromPoints([V(-Wd, 0, 0), V(Wd, 0, 0), V(0, L, 0)]);
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    const a = rnd(`${seed}a${i}`) * Math.PI * 2;
    const sp = 1.4 + rnd(`${seed}s${i}`) * 3.2;
    // zSign -1: they fly away from the camera (behind the word they burst from, which then stays readable)
    return { m, dir: V(Math.cos(a), Math.sin(a), zSign * (0.2 + rnd(`${seed}z${i}`) * 0.9)).normalize(), sp, spin: sg(`${seed}r${i}`) * 9, lime: rnd(`${seed}c${i}`) < 0.5 };
  });
  const lime = new THREE.Color(LIME), white = new THREE.Color("#ffffff");
  // throw from `at` (world) at t0, `power` scales the reach; hidden outside 0..life
  const update = (t: number, t0: number, at: THREE.Vector3, power = 1, life = 0.6) => {
    const a = t - t0;
    g.visible = a >= 0 && a < life;
    if (!g.visible) return;
    const k = (1 - Math.exp(-4 * a)) / 4;
    for (const it of items) {
      it.m.position.copy(at).addScaledVector(it.dir, it.sp * k * power);
      it.m.rotation.set(0, 0, Math.atan2(it.dir.y, it.dir.x) - Math.PI / 2 + it.spin * a);
      it.m.scale.setScalar(1 - 0.6 * (a / life));
    }
    mat.color.copy(white).lerp(lime, 0.35);
    mat.opacity = Math.exp(-3.2 * a);
  };
  return { group: g, update };
}

// octagonal bokeh drifting through a box (not star dust: few, big, soft, out of focus), wrapping around its sides;
// positions are pure functions of t (vel in units/s)
export function bokeh(n: number, box: [number, number, number], center: THREE.Vector3, vel: THREE.Vector3, size = 0.16, seed = "bk", lime = 0.4) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const base = Array.from({ length: n }, (_, i) => [sg(`${seed}x${i}`) * box[0], sg(`${seed}y${i}`) * box[1], sg(`${seed}z${i}`) * box[2], 0.5 + rnd(`${seed}v${i}`)]);
  const L = new THREE.Color(LIME), Wt = new THREE.Color("#ffffff");
  base.forEach((b, i) => {
    const c = rnd(`${seed}c${i}`) < lime ? L : Wt;
    const k = 0.35 + 0.65 * rnd(`${seed}b${i}`);
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  });
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: octSpriteTex(), vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const wrap = (x: number, h: number) => ((((x + h) % (2 * h)) + 2 * h) % (2 * h)) - h;
  const update = (t: number) => {
    base.forEach((b, i) => {
      pos[i * 3] = center.x + wrap(b[0] + vel.x * t * b[3], box[0]);
      pos[i * 3 + 1] = center.y + wrap(b[1] + vel.y * t * b[3], box[1]);
      pos[i * 3 + 2] = center.z + wrap(b[2] + vel.z * t * b[3], box[2]);
    });
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  };
  update(0);
  return { points, mat, update };
}

// the HUD grid behind everything (the brand's "HUD" layer): thin square lines with an octagon in every tile, scrolling.
// A flat ground has no texture, so a camera move over it shows no motion at all (the v1 dynamism gates: holds on the
// lime / paper grounds); the grid gives every ground a moving structure. Lines ~8 px, a tile ~240 px on screen; the
// colour and opacity follow the ground (ink on lime / paper, lime on graphite), so a line differs by >= 30 levels.
export function hudGrid(tilePx = 240) {
  const c = canvas(512, 512);
  const x = c.getContext("2d")!;
  const lw = (8 * 512) / tilePx;
  x.strokeStyle = "rgba(255,255,255,1)";
  x.lineWidth = lw;
  x.strokeRect(0, 0, 512, 512);
  x.lineWidth = lw * 0.75;
  x.lineJoin = "round";
  x.beginPath();
  octPts(150).forEach((p, i) => (i ? x.lineTo(256 + p.x, 256 - p.y) : x.moveTo(256 + p.x, 256 - p.y)));
  x.closePath();
  x.stroke();
  // small ticks at the tile centre (HUD crosshair)
  x.lineWidth = lw * 0.6;
  x.beginPath();
  x.moveTo(236, 256);
  x.lineTo(276, 256);
  x.moveTo(256, 236);
  x.lineTo(256, 276);
  x.stroke();
  const tex = imgTex(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const W = 1500, H = 2600; // px on screen (overscanned for the roll and the shake)
  tex.repeat.set(W / tilePx, H / tilePx);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: INK, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), mat);
  mesh.renderOrder = -2;
  // scroll by (vx, vy) px/s at time t; ground: "lime" | "paper" | "graphite"
  const set = (t: number, vx: number, vy: number, ground: "lime" | "paper" | "graphite", k = 1) => {
    tex.offset.set(((t * vx) / tilePx) % 1, ((t * vy) / tilePx) % 1);
    if (ground === "graphite") {
      mat.color.set(LIME);
      mat.opacity = 0.045 * k;
    } else {
      mat.color.set(INK);
      mat.opacity = (ground === "lime" ? 0.28 : 0.3) * k;
    }
  };
  return { mesh, mat, set, W };
}

// the HUD label: "[ JÍDLO ]" in Geist Mono, lime, with corner ticks (a canvas, 512×96)
export function hudTex(label: string) {
  const c = canvas(512, 96);
  const x = c.getContext("2d")!;
  x.font = "500 38px 'Geist Mono'";
  x.textAlign = "center";
  x.textBaseline = "middle";
  const w = Math.min(470, x.measureText(label).width + 80);
  x.strokeStyle = "rgba(198,255,0,0.95)";
  x.lineWidth = 3;
  const L = 256 - w / 2, R = 256 + w / 2;
  x.beginPath();
  x.moveTo(L + 16, 14);
  x.lineTo(L, 14);
  x.lineTo(L, 82);
  x.lineTo(L + 16, 82);
  x.moveTo(R - 16, 14);
  x.lineTo(R, 14);
  x.lineTo(R, 82);
  x.lineTo(R - 16, 82);
  x.stroke();
  x.fillStyle = LIME;
  x.fillText(label, 256, 50);
  return imgTex(c);
}
// the dark plate behind the CTA type (keeps it readable over the moving pictures)
export function plateTex() {
  const c = canvas(256, 256);
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(11,13,16,0.85)");
  g.addColorStop(0.6, "rgba(11,13,16,0.55)");
  g.addColorStop(1, "rgba(11,13,16,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return imgTex(c);
}
export { INK };
