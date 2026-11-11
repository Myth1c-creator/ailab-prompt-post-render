// The hook (film 0-131): "JAK VZNIKÁ POST V AI LAB?" as 3D words on Jana's words over the full-frame notebook shot
// (public/seq hook_###: hands typing in lime light; Higgsfield atmosphere, not an AI LAB output). Every word change is
// also a cut of the shot (a crop jump: the keys, the screen, wide), every beat and kick a punch.
//   0.000 JAK already landing on frame 0 (125 % -> 100 %), a shock ring, light shards, CA; the shot slams from 160 %
//   0.317 VZNIKÁ WHIPS in from the right (JAK flies at the camera); cut to the keys; punch on the kick 0.450 and the beat
//         0.583, a glitch tick on the kick 0.733
//   0.883 POST slams lime with a FLASH; cut to the screen; punch on the beat 1.150
//   1.200 GLITCH: the pile builds (ref6): V (1.200) / AI (1.333) / LAB? (1.700, lime, 140 % -> 100 %); the shot goes
//         wide and pushes in; punch on the beat 1.733 (the "?" overshoots)
//   1.983 speed ramp: the pile rushes at the camera, the shot zoom-blurs into the cut on the kick 2.200
// The words are screen-anchored (common.ts place): their widths in px are below (check_text3d.py mirrors them).
import * as THREE from "three";
import type { World } from "../three/shot3d";
import { LIME, V, aim, clamp, env, inCubic, lerp, outBack, outCubic, place, placeCam, pulse, type Imp } from "./common";
import { F, S, T, fr } from "./timing";
import { Src, type Key, type Media } from "./media";
import { D, mkFull, word3, type W3 } from "./kit";
import { bokeh, lightShards, plateTex, ringTex } from "./shapes";

export const CX = 540, CY = 900; // the type's centre on screen (frame px)
// widths at rest (px): never across the whole width, >= 170 px from the edges with the push and the punches
export const W_HOOK = { jak: 380, vznika: 560, post: 440, lab: 480 }; // LAB? is the pile's widest line (V and AI on its scale)
export const PILE = { y: [750, 890, 1040] }; // V / AI / LAB? (centre y of each line)

const punchK = (t: number, t0: number, k: number) => k * pulse(t, t0, 8) * clamp((t - t0) * 60);
const HOOK_IMP: Imp[] = [
  { t: -0.03, power: 1.1 }, { t: S.vznika, power: 0.45 }, { t: S.vznikaPunch, power: 0.5 }, { t: S.hookBeat, power: 0.35 }, { t: S.hookKick, power: 0.3 },
  { t: S.post, power: 0.55 }, { t: S.postPunch, power: 0.4 }, { t: S.v, power: 0.3 }, { t: S.ai, power: 0.4 }, { t: S.lab, power: 0.55 }, { t: S.labPunch, power: 0.5 },
];
export const hookSamples = (f: number) =>
  f < 8 || (f >= T.vznika - 1 && f <= T.vznika + 5) || (f >= T.post - 1 && f <= T.post + 3) || (f >= T.v - 1 && f <= T.v + 3) || (f >= T.lab - 1 && f <= T.lab + 4) || f >= T.ramp0 ? 24 : 12;

// the shot's crop at time t: [zoom, focus x, focus y] (the picture is 9:16; a focus drift of 0.1/s at zoom 1.5 = 2.7 px/frame)
export function hookShot(t: number): [number, number, number] {
  if (t < S.vznika) return [lerp(1.6, 1.28, outCubic(t / (6 / 60))) + 0.3 * t, 0.4 + 0.12 * t, 0.5 - 0.05 * t];
  if (t < S.post) {
    const a = t - S.vznika;
    return [1.9 + 0.22 * a + punchK(t, S.vznikaPunch, 0.1) + punchK(t, S.hookBeat, 0.08), 0.42 + 0.16 * a, 0.66 - 0.04 * a];
  }
  if (t < S.v) {
    const a = t - S.post;
    return [lerp(1.75, 1.6, outCubic(a / (5 / 60))) + 0.25 * a + punchK(t, S.postPunch, 0.08), 0.74 - 0.14 * a, 0.22 + 0.06 * a];
  }
  const a = t - S.v;
  const ramp = clamp((t - S.ramp0) / (fr(F.app) - S.ramp0));
  return [(1.14 + 0.16 * a + punchK(t, S.ai, 0.06) + punchK(t, S.lab, 0.05) + punchK(t, S.labPunch, 0.08)) * (1 + 2.2 * Math.pow(ramp, 2.2)), 0.5 + 0.03 * a, 0.47 + 0.06 * a];
}

export function buildHook(M: Media, S0: Record<Key, Src>): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050806");
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 60);
  const base = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 60);
  scene.add(new THREE.HemisphereLight("#eef2f6", "#0b0d10", 0.75));
  const key = new THREE.DirectionalLight("#fff4e8", 1.15);
  key.position.set(-3, 4, 6);
  const rim = new THREE.DirectionalLight("#e8ffb0", 0.7);
  rim.position.set(4, -2, 2);
  scene.add(key, rim);
  const full = mkFull(scene, S0.hook);
  // a soft dark plate behind the type (keeps it readable over the moving shot)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: plateTex(), transparent: true, opacity: 0.7, depthWrite: false }));
  plate.renderOrder = -1;
  scene.add(plate);

  const jak = word3(M, scene, "JAK");
  const vzn = word3(M, scene, "VZNIKÁ");
  const post = word3(M, scene, "POST", LIME, "#4f6600", 0.85, 0.35);
  const pv = word3(M, scene, "V");
  const pai = word3(M, scene, "AI");
  const plab = word3(M, scene, "LAB?", LIME, "#4f6600", 0.85, 0.35);
  const sP = W_HOOK.lab / plab.w; // the pile's scale: px per word unit
  const tilt = (t: number, k = 1, roll = 0): [number, number, number] => [0.16 + 0.05 * Math.sin(t * 2.3) * k, -0.2 + 0.13 * Math.sin(t * 1.9 + 0.5) * k, roll];
  const put = (w: W3, x: number, y: number, wpx: number, t: number, k = 1, roll = 0) => place(w.g, base, x, y, wpx, w.w, D, tilt(t, k, roll));

  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(ring);
  const LS = lightShards(46, "hk", 1);
  scene.add(LS.group);
  const LS2 = lightShards(34, "hk2", 1);
  scene.add(LS2.group);
  const BK = bokeh(30, [3.2, 5.5, 1.2], V(0, 0, 1.4), V(-1.2, 0.5, 0), 0.2, "hk", 0.7);
  BK.mat.opacity = 0.4;
  scene.add(BK.points);

  const update = (t: number) => {
    const roll = 0.03 * Math.sin(t * 1.3);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0, 0, 6), V(0, 0, 0), 36, roll, t, HOOK_IMP, 0.006);
    // the shot: plays from frame 0 at its own 24 fps, its crop cuts with the words
    S0.hook.play(t, 0, 1, 24);
    const [z, fx, fy] = hookShot(t);
    const tick = t >= S.hookKick && t < S.hookKick + 2 / 60 ? 1 : 0;
    full.set(base, z, fx + 0.02 * tick, fy, { bright: 1 + 0.5 * pulse(t, S.post, 9) * (t >= S.post ? 1 : 0), roll: -0.4 * roll });
    const push = 1 + 0.05 * t;
    const ramp = clamp((t - S.ramp0) / (fr(F.app) - S.ramp0));
    place(plate, base, CX, CY, 1500, 1, D + 0.5);
    (plate.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ramp);

    // JAK: already landing on f0 (125 % -> 100 % by f6), flies at the camera as VZNIKÁ whips in
    {
      const out = clamp((t - S.vznika) / (4 / 60));
      jak.g.visible = t < S.vznika + 4 / 60;
      if (jak.g.visible) {
        const slam = lerp(1.25, 1, outCubic(clamp(t / (6 / 60))));
        put(jak, CX + 24 * Math.sin(t * 4), CY + lerp(0, 40, out), W_HOOK.jak * slam * push * (1 + 6 * out * out), t);
      }
    }
    // VZNIKÁ: WHIP in from the right in 4 frames (130 % -> 100 %), punches on the kick and the beat
    {
      const a = t - S.vznika;
      vzn.g.visible = a >= 0 && t < S.post;
      if (vzn.g.visible) {
        const inn = outCubic(clamp(a / (4 / 60)));
        const slam = lerp(1.3, 1, outBack(clamp(a / (8 / 60)), 1.3));
        put(vzn, lerp(1600, CX, inn) - 40 * a + (tick ? 22 : 0), CY, W_HOOK.vznika * slam * (1 + 0.03 * a) * (1 + punchK(t, S.vznikaPunch, 0.05) + punchK(t, S.hookBeat, 0.04)), t);
      }
    }
    // POST: FLASH + slam 140 % -> 100 %, lime, punch on the beat
    {
      const a = t - S.post;
      post.g.visible = a >= 0 && t < S.v;
      if (post.g.visible) {
        const slam = lerp(1.4, 1, outBack(clamp(a / (7 / 60)), 1.3));
        put(post, CX - 30 * a, CY, W_HOOK.post * slam * (1 + 0.04 * a) * (1 + punchK(t, S.postPunch, 0.06)), t);
      }
    }
    // the pile V / AI / LAB? (one scale), then the rush at the camera
    {
      const Z = Math.exp(Math.log(9) * Math.pow(ramp, 2.4)); // grows 9x into the cut
      const lines: [W3, number, number, number][] = [[pv, S.v, PILE.y[0], 1.2], [pai, S.ai, PILE.y[1], 1.3], [plab, S.lab, PILE.y[2], 1.4]];
      lines.forEach(([w, t0, y, from], i) => {
        const a = t - t0;
        w.g.visible = a >= 0;
        if (!w.g.visible) return;
        const slam = lerp(from, 1, outBack(clamp(a / (7 / 60)), 1.25));
        const gx = i === 0 && a < 3 / 60 ? 26 * Math.sin(a * 900) : 0; // the glitch cut shakes the first line in
        const wpx = w.w * sP * slam * (1 + 0.025 * (t - S.v)) * (1 + punchK(t, S.labPunch, 0.05)) * Z;
        put(w, CX + gx + (i - 1) * 8 * Math.sin(t * 2 + i), CY + (y - CY) * Z + 60 * (Z - 1), wpx, t, 1 - ramp, 0);
        w.g.scale.z = w.g.scale.x / Math.sqrt(Z);
      });
    }
    // effects
    {
      const a = t + 0.035; // the shock ring: mid-expansion on f0 (the hit was 2 frames earlier)
      const r2 = t - S.lab;
      ring.visible = a < 0.42 || (r2 >= 0 && r2 < 0.4);
      if (a < 0.42) {
        place(ring, base, CX, CY, 260 + 2600 * outCubic(a / 0.42), 1, D + 0.4);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - a / 0.42);
      } else if (ring.visible) {
        place(ring, base, CX, PILE.y[2], 240 + 1700 * outCubic(r2 / 0.4), 1, D + 0.4);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - r2 / 0.4);
      }
      LS.update(t, -0.05, V(0, 0.2, 0.5), 1.3, 0.7);
      LS2.update(t, S.post, V(0, 0.2, 0.5), 1.0, 0.5);
      BK.update(t);
    }
    const gl = (t >= S.v && t < S.v + 3 / 60) || tick ? 1 : 0;
    return {
      focus: D,
      ap: 2.5,
      flash: t >= S.post && t < S.post + 1 / 60 ? 0.5 : t >= S.post + 1 / 60 && t < S.post + 2 / 60 ? 0.2 : 0.5 * inCubic(clamp((t - (fr(F.app) - 4 / 60)) / (4 / 60))),
      ca: 0.3 + env(t, HOOK_IMP, 14) * 1.1 + (t < 3 / 60 ? 2.4 : 0) + gl * 3 + inCubic(ramp) * 3.5,
      glitch: gl ? (tick ? 0.6 : 1) : 0,
    };
  };
  return { scene, camera, update };
}
