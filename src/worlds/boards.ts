// The app world (film 132-414): the three steps as REAL pieces of the AI LAB recording (prep_screens.py: frame
// sequences, prices / credits / other models cut away or filled) on tilted 3D boards, each with its big 3D word on
// Jana's word, then the tunnel of light into the drop (public/seq tun_###: Higgsfield atmosphere, not an AI LAB output).
//   2.200 (kick) FLY-IN with motion blur: the prompt board out of the depth; NAPÍŠEŠ slams · 2.300 landed (shake)
//         the prompt types itself (the recording ~10x faster) · 2.750 (kick) MACRO push-in onto the field · 2.767 PROMPT
//         · 2.883 landed, sweep · 3.167 a small punch
//   3.450 (beat) WHIP to the resolution board (Pomer strán / Rozlíšenie) · 3.767 (kick) punch · 3.967 4K slams lime
//         · 4.033 (beat) the recording's click on the 4K chip: tap ring, the chip glows · 4.317 punch · 4.617 (kick)
//         macro punch onto the chip · 4.900 sweep
//   5.183 (beat) GLITCH to the Generovať button (macro) · 5.233 (kick) lands · 5.767 (beat) the recording's click, tap
//         ring · 5.783 GENEROVAT slams · 5.800 the camera DIVES THROUGH the lime button
//   5.883 the TUNNEL of lime light over the whole frame, accelerating (speed ramp; punch on the kick 6.350); GENEROVAT
//         rides it and is pulled into the light at 6.550 (the song's gap); the tunnel's white builds into the DROP 6.917
// Words and boards are screen-anchored (common.ts place); their px sizes are below and in check_text3d.py.
import * as THREE from "three";
import type { World } from "../three/shot3d";
import { BG, LIME, PAPER, V, aim, clamp, env, inCubic, lerp, outBack, outCubic, place, placeCam, pulse, streak, type Imp } from "./common";
import { S, T } from "./timing";
import { BM, Src, type Box, type Key, type Media } from "./media";
import { bokeh, hudGrid, lightShards, plateTex, ringTex } from "./shapes";
import { D, mkBoard, mkFull, outline, word3, wordTilt, type BoardObj, type W3 } from "./kit";

// the words: centre y and the width of the widest line at rest (px)
export const WORDS = {
  napis: { y: 560, y2: 700, w: 520 }, // NAPÍŠEŠ / PROMPT on one scale (NAPÍŠEŠ is the widest)
  k4: { y: 600, w: 340 },
  gen: { y: 690, y2: 900, w: 560 }, // GENEROVAT above the button, then in the middle of the tunnel
};
// the boards at rest: centre (px) and width (px); macro = the push-in's factor
export const BOARDS = {
  typ: { x: 540, y: 1060, w: 880, macro: 1.6 },
  res: { x: 540, y: 1040, w: 900, macro: 1.45 },
  gen: { y: 1010, w: 1300 }, // a macro from the start: the button in the middle of the frame
};
const BGc = new THREE.Color(BG);
export const smooth = (u: number) => {
  const x = clamp(u);
  return x * x * (3 - 2 * x);
};
export const punchK = (t: number, t0: number, k: number) => k * pulse(t, t0, 8) * clamp((t - t0) * 60);

export function bstage(ground: THREE.Color) {
  const scene = new THREE.Scene();
  scene.background = ground.clone();
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 80);
  const base = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 80);
  scene.add(new THREE.HemisphereLight("#eef2f6", "#08090b", 0.75));
  const key = new THREE.DirectionalLight("#fff4ea", 1.1);
  key.position.set(-3, 4, 6);
  const rimL = new THREE.DirectionalLight("#e2ffa0", 0.9);
  rimL.position.set(4, -1, 2);
  scene.add(key, rimL);
  const grid = hudGrid(240);
  scene.add(grid.mesh);
  const BK = bokeh(40, [3.4, 6, 2], V(0, 0, -3), V(0.5, 0.8, 0), 0.3, "bs", 0.45);
  scene.add(BK.points);
  return { scene, camera, base, grid, BK };
}
// a word: slams in at t0, punches, sways; returns whether it is visible
export function showWord(w: W3, base: THREE.PerspectiveCamera, t: number, t0: number, t1: number, x: number, y: number, wpx: number, o: { from?: number; punch?: number[]; dx?: number; seed?: number; k?: number } = {}) {
  const a = t - t0;
  w.g.visible = a >= 0 && t < t1;
  if (!w.g.visible) return false;
  const slam = lerp(o.from ?? 1.3, 1, outBack(clamp(a / (7 / 60)), 1.25));
  const p = (o.punch ?? []).reduce((m, tp) => m + punchK(t, tp, 0.05), 0);
  place(w.g, base, x + (o.dx ?? 0), y, wpx * slam * (1 + p) * (1 + 0.02 * a) * (o.k ?? 1), w.w, D, wordTilt(t, o.seed ?? y * 0.01));
  return true;
}
export function showBoard(B: BoardObj, base: THREE.PerspectiveCamera, x: number, y: number, wpx: number, tilt: [number, number, number]) {
  place(B.g, base, x, y, wpx, 1, D + 0.6, tilt);
}
// a box on a board as a child plane (outline, ring): local centre in board units
function onBoard(B: BoardObj, o: THREE.Object3D, b: Box, z = 0.006) {
  o.position.copy(B.boxC(b, z));
  B.g.add(o);
}
const boxW = (B: BoardObj, b: Box) => (b[2] - b[0]) / B.px[0];
const boxH = (B: BoardObj, b: Box) => ((b[3] - b[1]) / B.px[1]) * B.H;
const tapRing = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));

const APP_IMP: Imp[] = [
  { t: S.landed, power: 0.55 }, { t: S.macro, power: 0.3 }, { t: S.prompt, power: 0.35 }, { t: S.macroIn, power: 0.45 }, { t: S.typBeat, power: 0.25 },
  { t: S.whip, power: 0.35 }, { t: S.resPunch, power: 0.45 }, { t: S.k4, power: 0.45 }, { t: S.click4k, power: 0.6 }, { t: S.kaBeat, power: 0.25 }, { t: S.k4Punch, power: 0.5 },
  { t: S.resHalf, power: 0.2 }, { t: S.glitch, power: 0.45 }, { t: S.genPunch, power: 0.5 }, { t: S.clickGen, power: 0.65 }, { t: S.tunnel, power: 0.5 }, { t: S.tunKick, power: 0.7 },
];
export const appSamples = (f: number) => {
  const near = (a: number, r0: number, r1: number) => f >= a - r0 && f <= a + r1;
  if (near(T.flyIn, 0, 8) || near(T.macro, 0, 9) || near(T.whip, 4, 5) || near(T.k4Punch, 0, 9) || near(T.glitch, 0, 3) || f >= T.dive) return 24;
  return 12;
};
// where the tunnel's source frame is at film time t (accelerating: its white lands on the drop)
export const tunnelU = (t: number) => clamp((t - S.tunnel) / (S.drop - S.tunnel));

export function buildApp(M: Media, SR: Record<Key, Src>): World {
  const { scene, camera, base, grid, BK } = bstage(BGc);
  // ── NAPÍŠEŠ PROMPT ──
  const bP = mkBoard(scene, SR.typ, BM.typ.size);
  const wN = word3(M, scene, "NAPÍŠEŠ");
  const wP = word3(M, scene, "PROMPT", LIME, "#4f6600", 0.85, 0.35);
  const sN = WORDS.napis.w / Math.max(wN.w, wP.w);
  const lineC = (BM.typ.line[0] + BM.typ.line[2]) / 2 / BM.typ.size[0];
  // ── 4K ──
  const bR = mkBoard(scene, SR.res, BM.res.size);
  const w4 = word3(M, scene, "4K", LIME, "#4f6600", 0.85, 0.35);
  const chip = outline(boxW(bR, BM.res.chip4k) * 1.12, boxH(bR, BM.res.chip4k) * 1.12);
  onBoard(bR, chip.mesh, BM.res.chip4k);
  const tap4 = tapRing();
  onBoard(bR, tap4, BM.res.chip4k, 0.01);
  const chipC = [(BM.res.chip4k[0] + BM.res.chip4k[2]) / 2 / BM.res.size[0], (BM.res.chip4k[1] + BM.res.chip4k[3]) / 2 / BM.res.size[1]];
  // ── GENEROVAT ──
  const bG = mkBoard(scene, SR.gen, BM.gen.size, { glow: 0.5 });
  const wG = word3(M, scene, "GENEROVAT");
  const tapG = tapRing();
  onBoard(bG, tapG, BM.gen.button, 0.01);
  const btnC = (BM.gen.button[0] + BM.gen.button[2]) / 2 / BM.gen.size[0];
  // ── the tunnel ──
  const tun = mkFull(scene, SR.tun);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: plateTex(), transparent: true, opacity: 0, depthWrite: false }));
  plate.renderOrder = -1;
  scene.add(plate);
  const sweep = streak(1, 0.3);
  scene.add(sweep.mesh);
  const LS = lightShards(44, "ap", 1);
  scene.add(LS.group);
  const NT = SR.tun.frames.length;

  const update = (t: number) => {
    const roll = 0.02 * Math.sin(t * 1.1);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0.05 * Math.sin(t * 0.8), 0.04 * Math.sin(t * 0.9), 6), V(0, 0, 0), 36, roll, t, APP_IMP, 0.007);
    place(grid.mesh, base, 540, 960, grid.W, 1, D + 3, [0, 0, -0.4 * roll]);
    grid.set(t, -220, 240, "graphite", 1.3);
    BK.update(t);
    BK.mat.opacity = 0.45;
    // the whip (3.450): the prompt board leaves to the left, the resolution board comes from the right, 6 frames
    const wu = smooth((t - (S.whip - 3 / 60)) / (6 / 60));
    const x1 = -1500 * wu, x2 = 1500 * (1 - wu);

    // ── the prompt board: flies in, types, macro ──
    const onP = t < S.whip + 3 / 60;
    bP.g.visible = onP;
    if (onP) {
      const B = BOARDS.typ;
      const u = outCubic(clamp((t - S.flyIn) / (6 / 60)));
      const m = smooth((t - S.macro) / (8 / 60));
      const k = lerp(1, B.macro, m) * (1 + 0.03 * Math.max(0, t - S.macroIn)) * (1 + punchK(t, S.landed, 0.03) + punchK(t, S.macroIn, 0.04) + punchK(t, S.typBeat, 0.035));
      const w = B.w * lerp(0.08, 1, u) * (1 + 0.02 * Math.max(0, t - S.landed)) * k;
      // the macro centres the typed line and then follows the caret
      const x = lerp(B.x, B.x + (0.5 - lineC) * B.w * B.macro, m) - 90 * Math.max(0, t - S.macroIn);
      showBoard(bP, base, x + x1, lerp(1260, B.y, u), w, [lerp(1.1, lerp(0.24, 0.12, m), u), lerp(0.9, lerp(-0.16, -0.06, m), u) + 0.05 * Math.sin(t * 1.3), lerp(0.5, 0.02, u)]);
      SR.typ.set(((t - S.flyIn) / (S.whip - 5 / 60 - S.flyIn)) * (BM.typ.n - 1));
    }
    showWord(wN, base, t, S.flyIn, S.whip + 3 / 60, 540, WORDS.napis.y, wN.w * sN, { punch: [S.landed, S.macroIn], dx: x1 });
    showWord(wP, base, t, S.prompt, S.whip + 3 / 60, 540, WORDS.napis.y2, wP.w * sN, { from: 1.4, punch: [S.macroIn, S.typBeat], dx: x1 });

    // ── the resolution board: the recording's own click on 4K lands on the beat ──
    const onR = t >= S.whip - 3 / 60 && t < S.glitch;
    bR.g.visible = onR;
    if (onR) {
      const B = BOARDS.res;
      const m = smooth((t - S.k4Punch) / (8 / 60));
      const k = lerp(1, B.macro, m) * (1 + 0.025 * Math.max(0, t - S.whip)) * (1 + punchK(t, S.resPunch, 0.04) + punchK(t, S.click4k, 0.035) + punchK(t, S.kaBeat, 0.03) + punchK(t, S.k4Punch, 0.03));
      const w = B.w * k;
      const hpx = (w * BM.res.size[1]) / BM.res.size[0];
      // the macro puts the 4K chip in the middle (x 540) under the big 4K
      showBoard(bR, base, lerp(B.x, 540 + (0.5 - chipC[0]) * w, m) + x2, lerp(B.y, 1020 - (chipC[1] - 0.5) * hpx, m) + 8 * Math.sin(t * 1.2),
        w, [0.24 + 0.03 * Math.sin(t) - 0.08 * m, 0.14 - 0.05 * Math.sin(t * 1.4) - 0.1 * m, 0]);
      SR.res.set(BM.res.click + (t - S.click4k) * BM.res.fps);
      const ca = t - S.click4k;
      chip.mat.opacity = ca >= 0 ? 0.5 + 0.9 * pulse(t, S.click4k, 5) + 0.15 * Math.sin(t * 9) : 0;
      tap4.visible = ca >= 0 && ca < 0.32;
      if (tap4.visible) {
        tap4.scale.setScalar((70 + 330 * outCubic(ca / 0.32)) / BM.res.size[0]);
        (tap4.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - ca / 0.32);
      }
    }
    showWord(w4, base, t, S.k4, S.glitch, 540, WORDS.k4.y, WORDS.k4.w, { from: 1.4, punch: [S.click4k, S.k4Punch], dx: x2 });

    // ── the Generovať button: a macro from the start, the recording's own click, then the dive through it ──
    const dv = clamp((t - S.dive) / (S.tunnel - S.dive));
    const onG = t >= S.glitch && t < S.tunnel + 1 / 60;
    bG.g.visible = onG;
    if (onG) {
      const a = t - S.glitch;
      const B = BOARDS.gen;
      const sl = lerp(1.15, 1, outBack(clamp(a / (7 / 60)), 1.3));
      const Z = Math.exp(Math.log(9) * inCubic(dv));
      const w = B.w * sl * (1 + 0.035 * a) * (1 + punchK(t, S.genPunch, 0.04) + punchK(t, S.clickGen, 0.04)) * Z;
      showBoard(bG, base, 540 + (0.5 - btnC) * w - 14 * a, B.y - 50 * (Z - 1) / 8, w, [(0.2 + 0.03 * Math.sin(t * 1.2)) * (1 - dv), (-0.14 + 0.06 * Math.sin(t * 0.9)) * (1 - dv), -0.01]);
      SR.gen.set(BM.gen.click + (t - S.clickGen) * BM.gen.fps);
      const ca = t - S.clickGen;
      tapG.visible = ca >= 0 && ca < 0.3;
      if (tapG.visible) {
        tapG.scale.setScalar((90 + 420 * outCubic(ca / 0.3)) / BM.gen.size[0]);
        (tapG.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - ca / 0.3);
      }
    }
    // GENEROVAT: above the button, rides the tunnel in the middle, pulled into the light when Jana's word ends
    {
      const a = t - S.gen;
      const out = inCubic(clamp((t - S.genOut) / (14 / 60)));
      wG.g.visible = a >= 0 && out < 1;
      if (wG.g.visible) {
        const mv = smooth((t - S.dive) / (9 / 60));
        const slam = lerp(1.22, 1, outBack(clamp(a / (7 / 60)), 1.25));
        const wpx = WORDS.gen.w * slam * (1 + 0.02 * a) * (1 + punchK(t, S.tunKick, 0.05)) * (1 - 0.97 * out);
        place(wG.g, base, 540, lerp(lerp(WORDS.gen.y, WORDS.gen.y2, mv), 960, out), wpx, wG.w, D, wordTilt(t, 2.1, 1 - out));
      }
      place(plate, base, 540, WORDS.gen.y2, 1300, 1, D + 0.5);
      (plate.material as THREE.MeshBasicMaterial).opacity = t >= S.tunnel ? 0.55 * (1 - out) : 0;
    }

    // ── the tunnel: the source runs faster and faster, its white lands on the drop ──
    const tu = tunnelU(t);
    tun.mesh.visible = false;
    if (t >= S.tunnel) {
      SR.tun.set((NT - 1) * (0.3 * tu + 0.7 * Math.pow(tu, 2.4)));
      tun.set(base, 1.12 + 0.3 * tu + punchK(t, S.tunKick, 0.12), 0.5, 0.5, { roll: 0.6 * tu * tu, bright: 1 + 0.5 * inCubic(tu) });
    }

    // ── light: sweeps, shards on the clicks ──
    {
      const k = [S.macroIn, S.resHalf].map((s, i) => [t - s, i] as [number, number]).find(([d]) => d >= 0 && d < 0.26);
      sweep.mesh.visible = !!k;
      if (k) {
        const u = k[0] / 0.26;
        place(sweep.mesh, base, lerp(160, 920, u), lerp(1250, 880, u), 700, 1, D - 0.6, [0, 0, 0.6]);
        sweep.mat.opacity = 0.8 * Math.sin(u * Math.PI);
      }
      const src = t >= S.clickGen ? S.clickGen : t >= S.click4k ? S.click4k : S.landed;
      LS.update(t, src, V(0, t >= S.clickGen ? -0.15 : -0.3, 1.0), src === S.landed ? 0.8 : 1.1, 0.5);
    }
    const gl = t >= S.glitch && t < S.glitch + 3 / 60 ? 1 : 0;
    const fl = (t0: number, v: number) => (t >= t0 && t < t0 + 1 / 60 ? v : 0);
    return {
      focus: D,
      ap: 2.6,
      flash: Math.max(fl(S.landed, 0.14), fl(S.click4k, 0.22), fl(S.clickGen, 0.25), fl(S.tunnel, 0.5), fl(S.tunnel + 1 / 60, 0.2), inCubic(clamp((t - (S.drop - 7 / 60)) / (7 / 60)))),
      ca: 0.3 + env(t, APP_IMP, 14) * 1.1 + (t >= S.whip - 3 / 60 && t < S.whip + 3 / 60 ? 2 : 0) + (t < S.flyIn + 6 / 60 ? 2.5 * (1 - (t - S.flyIn) / (6 / 60)) : 0) + gl * 3 + 3 * inCubic(dv) * (t < S.tunnel ? 1 : 0)
        + 1.6 * tu * tu,
      glitch: gl,
    };
  };
  void PAPER;
  return { scene, camera, update };
}
