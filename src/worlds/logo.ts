// The AI LAB mark (public/img/mark.svg, 64x64: an octagon ring + Λ + a bar), as an extruded 3D mesh (from
// ads/ailab-najdi-chybu w3: the octagon is a stroke, so it is offset both ways into a ring) and as a 2D canvas drawing.
import * as THREE from "three";
import { LIME } from "./common";

function octagon(d: number) {
  const P = [[21.6, 4], [42.4, 4], [58, 19.6], [58, 44.4], [42.4, 60], [21.6, 60], [6, 44.4], [6, 19.6]];
  // move every edge outwards by d along its normal, then intersect neighbours (an exact polygon offset)
  const L = P.map((p, i) => {
    const q = P[(i + 1) % P.length];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len;
    return [p[0] + nx * d, p[1] + ny * d, dx, dy];
  });
  return L.map((a, i) => {
    const b = L[(i + L.length - 1) % L.length];
    const den = a[2] * b[3] - a[3] * b[2];
    const s = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    return new THREE.Vector2(a[0] + a[2] * s, a[1] + a[3] * s);
  });
}

// 2 units wide (-1..1), centred, facing +z
export function markMesh(depth = 0.16) {
  const toW = (v: THREE.Vector2) => new THREE.Vector2((v.x - 32) / 32, (32 - v.y) / 32);
  const ring = new THREE.Shape(octagon(1.6).map(toW).reverse());
  ring.holes.push(new THREE.Path(octagon(-1.6).map(toW)));
  const lam = new THREE.Shape([[17.5, 45], [27.2, 19], [33.6, 19], [43.3, 45], [36.8, 45], [30.4, 27.4], [24, 45]].map(([x, y]) => toW(new THREE.Vector2(x, y))));
  const bar = new THREE.Shape([[45.6, 22.4], [52, 19.8], [52, 38], [45.6, 38]].map(([x, y]) => toW(new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry([ring, lam, bar], { depth, bevelEnabled: true, bevelThickness: depth * 0.22, bevelSize: 0.02, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  const face = new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.75, metalness: 0.25, roughness: 0.3, transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: "#4f6600", emissive: LIME, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3, transparent: true });
  return { mesh: new THREE.Mesh(g, [face, side]), face, side };
}

// the mark on a canvas, `s` px wide, top-left at (x, y)
export function drawMark(c: CanvasRenderingContext2D, x: number, y: number, s: number, color = LIME) {
  c.save();
  c.translate(x, y);
  c.scale(s / 64, s / 64);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineJoin = "round";
  c.lineWidth = 3.2;
  c.stroke(new Path2D("M21.6 4h20.8L58 19.6v24.8L42.4 60H21.6L6 44.4V19.6Z"));
  c.globalAlpha = 0.45;
  c.lineWidth = 1.2;
  c.stroke(new Path2D("M25.6 9h12.8L54 24.6v14.8L38.4 55H25.6L10 39.4V24.6Z"));
  c.globalAlpha = 1;
  c.fill(new Path2D("M17.5 45 27.2 19h6.4L43.3 45h-6.5l-6.4-17.6L24 45Z"));
  c.fill(new Path2D("M45.6 22.4 52 19.8V38h-6.4Z"));
  c.restore();
}
