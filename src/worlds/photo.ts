// The photo worlds (film 415-839): the result of the recording (public/img/r1-r3.jpg: r1 the drop, r2 + r3 the details, r3 the post).
//   buildDrop (415-519) THE DROP "A máš hotovou fotku", the strongest moment: the tunnel's white is the flash (4 f),
//     shake, a lime shock wave, shards and sparks; the photo over the WHOLE frame slams 150 % -> 114 %, then pushes and
//     pans (never still) · 7.383 HOTOVÁ · 7.517 (kick) punch · 7.800 FOTKA slams lime, ring (kick 7.817) · 8.083 (kick)
//     punch + sweep · 8.350 punch
//   buildMorph (520-620) "Z jednoho promptu": 8.667 (kick) a lime band WIPES the photo away, the typed prompt line (the
//     recording's last frame) flies in · 8.867 Z JEDNOHO · 9.233 (kick) the line OPENS INTO THE PHOTO (the crop grows
//     from the field's strip to 4:5 behind a lime scan bar) · 9.467 PROMPTU lime · 9.817 (kick) punch, sweep, brackets
//     · 10.117 (kick) the photo rushes at the camera: zoom-through onto the face
//   buildDetails (621-761) "Bez focení, bez ateliéru": the photo over the whole frame, punch-in details as crop cuts:
//     10.350 the face; BEZ · 10.550 FOCENÍ lime · 10.967 (kick) hard cut tighter (sunglasses, smile) · 11.283 (kick)
//     WHIP pan to the houses and palms · 11.367 BEZ · 11.533 punch · 11.633 ATELIÉRU lime · 12.017 (kick) punch-in cut
//     to the sea · 12.100 punch · 12.433 (kick) the camera pulls back to the whole photo
//   buildPost (762-839) "Stačí ji postnout": 12.700 (kick) the photo drops from the whole frame into the post frame
//     (AI LAB's own card: mark, AI LAB, a 4:5 window, a heart) · 12.717 STAČÍ JI · 12.867 landed (shake) · 13.267 (kick)
//     punch · 13.283 POSTNOUT lime · 13.617 (kick) the HEART pops (a big one over the photo, the small one fills lime,
//     ring, sparks) · 13.833 the card rushes at the camera: through the heart into the lockup
// Words are screen-anchored (common.ts place); their px sizes are below and in check_text3d.py.
import * as THREE from "three";
import type { World } from "../three/shot3d";
import { BG, LIME, V, aim, bursts, clamp, env, inCubic, inOut, lerp, outBack, outCubic, place, placeCam, pulse, screenPoint, streak, type Burst, type Imp } from "./common";
import { F, S, T, fr } from "./timing";
import { BM, FOCUS, Src, type Key, type Media } from "./media";
import { bokeh, lightShards, plateTex, ringTex } from "./shapes";
import { CARD, D, OVER, applyPose, boardBoxPose, flare, heartMesh, mkBoard, mkCard, mkFull, mkPic, screenPose, word3, wordTilt, type W3 } from "./kit";
import { bstage, punchK, showWord, smooth } from "./boards";

// centre y of the two lines and the width of the widest line (px)
export const WORDS = {
  hotova: { y: 1170, y2: 1315, w: 520 }, // HOTOVÁ / FOTKA on one scale (HOTOVÁ is the widest)
  zjed: { y: 540, y2: 680, w: 560 }, // Z JEDNOHO / PROMPTU
  bez1: { y: 1160, y2: 1300, w: 480 }, // BEZ / FOCENÍ
  bez2: { y: 1160, y2: 1300, w: 540 }, // BEZ / ATELIÉRU
  post: { y: 300, y2: 432, w: 540 }, // STAČÍ JI / POSTNOUT
};
export const PHOTO = { y: 1130, w: 600 }; // the grown photo of "Z jednoho promptu" (4:5)
export const POST = { x: 540, y: 1035, w: 640 }; // the post card
const FACE: [number, number] = [0.46, 0.39]; // the face in the photo (0..1 from the top left)
const BGc = new THREE.Color(BG);
const ring0 = () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
const plate0 = (scene: THREE.Scene) => {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: plateTex(), transparent: true, opacity: 0, depthWrite: false }));
  p.renderOrder = -1;
  scene.add(p);
  return p;
};
function pstage() {
  const scene = new THREE.Scene();
  scene.background = BGc.clone();
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 80);
  const base = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 80);
  scene.add(new THREE.HemisphereLight("#eef2f6", "#08090b", 0.75));
  const key = new THREE.DirectionalLight("#fff4ea", 1.1);
  key.position.set(-3, 4, 6);
  const rimL = new THREE.DirectionalLight("#e2ffa0", 0.9);
  rimL.position.set(4, -1, 2);
  scene.add(key, rimL);
  // lime bokeh in front of the picture (parallax)
  const BK = bokeh(26, [3.2, 5.6, 1.0], V(0, 0, 1.6), V(0.7, 0.9, 0), 0.2, "ph", 0.7);
  BK.mat.opacity = 0.32;
  scene.add(BK.points);
  return { scene, camera, base, BK };
}
// two lines on one scale
const scale2 = (a: W3, b: W3, w: number) => w / Math.max(a.w, b.w);

// ═════════════════════════ THE DROP ═════════════════════════
// the photo's crop while it fills the frame: [zoom, focus x, focus y]; a pan of 0.06/s = 3.3 px/frame
export function dropShot(t: number): [number, number, number] {
  const a = t - S.drop;
  return [lerp(1.5, 1.14, outCubic(a / (8 / 60))) + 0.05 * a + punchK(t, S.hotovaPunch, 0.05) + punchK(t, S.fotkaPunch, 0.06) + punchK(t, S.dropBeat, 0.05) + punchK(t, S.dropHalf, 0.035), 0.53 + 0.06 * a, FOCUS.r1[1]];
}
const DROP_IMP: Imp[] = [{ t: S.drop, power: 1.3 }, { t: S.hotova, power: 0.45 }, { t: S.hotovaPunch, power: 0.5 }, { t: S.fotka, power: 0.7 }, { t: S.fotkaPunch, power: 0.5 }, { t: S.dropBeat, power: 0.45 }, { t: S.dropHalf, power: 0.3 }];
export const dropSamples = (f: number) => {
  const near = (a: number, r0: number, r1: number) => f >= a - r0 && f <= a + r1;
  return near(T.drop, 0, 12) || near(T.hotova, 0, 6) || near(T.fotka, 0, 8) || near(T.dropBeat, 0, 5) ? 24 : 12;
};

export function buildDrop(M: Media, SR: Record<Key, Src>): World {
  const { scene, camera, base, BK } = pstage();
  const full = mkFull(scene, SR.r1);
  const plate = plate0(scene);
  const hot = word3(M, scene, "HOTOVÁ");
  const fot = word3(M, scene, "FOTKA", LIME, "#4f6600", 0.85, 0.35);
  const sH = scale2(hot, fot, WORDS.hotova.w);
  const ring = ring0();
  scene.add(ring);
  const LS = lightShards(70, "dp", 1);
  scene.add(LS.group);
  const LS2 = lightShards(40, "dk", 1);
  scene.add(LS2.group);
  const BL: Burst[] = [{ t: S.drop, at: V(0, -0.2, 1.4), power: 2.2, lime: 0.6, up: 1.3 }, { t: S.fotka, at: V(0, -1.0, 1.4), power: 1.0, lime: 0.7 }];
  const BU = bursts(BL, 110, 0.022, "dr");
  scene.add(BU.points);
  const sweep = streak(1, 0.32);
  scene.add(sweep.mesh);

  const update = (t: number) => {
    const a = t - S.drop;
    const roll = 0.02 * Math.sin(t * 1.3);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0.05 * Math.sin(t * 0.9), 0.04 * Math.sin(t * 0.7), 6), V(0, 0, 0), 36, roll, t, DROP_IMP, 0.009);
    const [z, fx, fy] = dropShot(t);
    full.set(base, z, fx, fy, { bright: 1 + 0.6 * pulse(t, S.drop, 7), roll: -0.5 * roll });
    BK.update(t);
    place(plate, base, 540, (WORDS.hotova.y + WORDS.hotova.y2) / 2, 1400, 1, D + 0.5);
    (plate.material as THREE.MeshBasicMaterial).opacity = 0.8 * clamp((t - S.hotova) / (5 / 60));
    showWord(hot, base, t, S.hotova, 99, 540, WORDS.hotova.y, hot.w * sH, { from: 1.28, punch: [S.hotovaPunch, S.dropBeat], seed: 1.3 });
    showWord(fot, base, t, S.fotka, 99, 540, WORDS.hotova.y2, fot.w * sH, { from: 1.45, punch: [S.fotkaPunch, S.dropBeat], seed: 2.6 });
    {
      // the shock wave on the drop and on FOTKA
      const r = [S.drop, S.fotkaPunch].map((h) => t - h).find((d) => d >= 0 && d < 0.45);
      ring.visible = r !== undefined;
      if (r !== undefined) {
        place(ring, base, 540, t >= S.fotkaPunch ? WORDS.hotova.y2 : 960, 300 + 2800 * outCubic(r / 0.45), 1, D + 0.3);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - r / 0.45);
      }
      LS.update(t, S.drop, V(0, -0.1, 1.2), 2.2, 0.8);
      LS2.update(t, S.fotka, V(0, -0.9, 1.2), 1.1, 0.5);
      BU.update(t);
      const sa = t - S.dropBeat;
      sweep.mesh.visible = sa >= 0 && sa < 0.26;
      if (sweep.mesh.visible) {
        const k = sa / 0.26;
        place(sweep.mesh, base, lerp(120, 960, k), lerp(1420, 1080, k), 900, 1, D - 0.6, [0, 0, 0.5]);
        sweep.mat.opacity = 0.8 * Math.sin(k * Math.PI);
      }
    }
    // the tunnel's white hands over: 4 frames of flash falling away
    const fl = a < 4 / 60 ? [1.0, 0.75, 0.45, 0.2][Math.max(0, Math.min(3, Math.floor(a * 60)))] : 0;
    return {
      focus: D,
      ap: 2.6,
      flash: Math.max(fl, t >= S.fotka && t < S.fotka + 1 / 60 ? 0.3 : 0, env(t, DROP_IMP, 30) * 0.06),
      ca: 0.3 + env(t, DROP_IMP, 14) * 1.2 + (a < 3 / 60 ? 3.2 : 0) + (t >= S.fotka && t < S.fotka + 2 / 60 ? 2.4 : 0),
      glitch: 0,
    };
  };
  return { scene, camera, update };
}

// ═════════════════════════ Z JEDNOHO PROMPTU ═════════════════════════
const MORPH_IMP: Imp[] = [{ t: S.wipe, power: 0.6 }, { t: S.zjed, power: 0.4 }, { t: S.morph, power: 0.55 }, { t: S.promptu, power: 0.45 }, { t: S.morphed, power: 0.6 }, { t: S.rush, power: 0.4 }];
export const morphSamples = (f: number) => {
  const near = (a: number, r0: number, r1: number) => f >= a - r0 && f <= a + r1;
  return near(T.wipe, 0, 11) || near(T.morph, 0, 22) || near(T.morphed, 0, 5) || f >= T.rush ? 24 : 12;
};
const MORPH_F = 22; // frames the line takes to open into the photo

export function buildMorph(M: Media, SR: Record<Key, Src>): World {
  const { scene, camera, base, grid, BK } = bstage(BGc);
  const full = mkFull(scene, SR.r1);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: LIME }));
  band.visible = false;
  scene.add(band);
  // the typed prompt line: the recording's last frame
  SR.typ.set(BM.typ.n - 1);
  const bL = mkBoard(scene, SR.typ, BM.typ.size, { glow: 0.45 });
  const w1 = word3(M, scene, "Z JEDNOHO");
  const w2 = word3(M, scene, "PROMPTU", LIME, "#4f6600", 0.85, 0.35);
  const sZ = scale2(w1, w2, WORDS.zjed.w);
  const fa = (BM.typ.field[2] - BM.typ.field[0]) / (BM.typ.field[3] - BM.typ.field[1]);
  const pic = mkPic(scene, SR.r2, fa, { corners: true, depth: 0.04, cornersA: 0.8 });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.022), new THREE.MeshBasicMaterial({ color: "#eaffb0", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pic.g.add(scan);
  const fl = flare();
  scene.add(fl);
  const ring = ring0();
  scene.add(ring);
  const sweep = streak(1, 0.3);
  scene.add(sweep.mesh);
  const LS = lightShards(44, "mo", 1);
  scene.add(LS.group);

  const update = (t: number) => {
    const roll = 0.02 * Math.sin(t * 1.2);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0.05 * Math.sin(t * 0.8), 0.04 * Math.sin(t * 0.9), 6), V(0, 0, 0), 36, roll, t, MORPH_IMP, 0.007);
    place(grid.mesh, base, 540, 960, grid.W, 1, D + 3, [0, 0, -0.4 * roll]);
    grid.set(t, 230, -210, "graphite", 1.3);
    BK.update(t);
    BK.mat.opacity = 0.45;
    const rush = clamp((t - S.rush) / (fr(F.det) - S.rush));

    // the WIPE (8.667): the photo leaves behind a lime band running left -> right in 8 frames
    {
      const u = (t - S.wipe) / (8 / 60);
      full.mesh.visible = false;
      band.visible = u < 1.15;
      if (u < 1) {
        const [z, fx, fy] = dropShot(t);
        full.set(base, z, fx, fy, { wipe: smooth(u) });
      }
      if (band.visible) {
        place(band, base, 540 - 540 * OVER + 1080 * OVER * smooth(u), 960, 54, 1, D + 0.85);
        band.scale.y = band.scale.x * 44;
      }
    }
    // the prompt line: slides in behind the band, then sinks back as the photo opens out of it
    const mu = clamp((t - S.morph) / (MORPH_F / 60));
    const e = outBack(mu, 1.1);
    {
      const a = t - S.wipe;
      const inn = outCubic(clamp(a / (10 / 60)));
      const w = 900 * (1 + 0.025 * a) * (1 + punchK(t, S.zjed, 0.03) + punchK(t, S.morph, 0.04)) * (1 - 0.2 * clamp(e)) * (1 + 2 * inCubic(rush));
      place(bL.g, base, lerp(-560, 540, inn) + 8 * Math.sin(t * 1.3), 1010 + 6 * Math.sin(t * 1.7), w, 1, D + 0.6, [0.2 + 0.03 * Math.sin(t * 1.2), -0.14 + 0.07 * Math.sin(t * 0.9), -0.01]);
      bL.g.visible = true;
      bL.faceMat.color.setScalar(1 - 0.55 * clamp(e));
      bL.rim.opacity = 0.45 + 0.5 * pulse(t, S.morph, 5) * (t >= S.morph ? 1 : 0);
    }
    showWord(w1, base, t, S.zjed, 99, 540, WORDS.zjed.y - 900 * inCubic(rush), w1.w * sZ, { punch: [S.morph, S.morphed], seed: 0.7 });
    showWord(w2, base, t, S.promptu, 99, 540, WORDS.zjed.y2 - 900 * inCubic(rush), w2.w * sZ, { from: 1.4, punch: [S.morphed], seed: 1.9 });
    // the line opens into the photo (9.233 -> 9.600), then the photo rushes at the camera onto the face
    {
      pic.g.visible = t >= S.morph;
      if (pic.g.visible) {
        const Z = Math.exp(Math.log(5.9) * Math.pow(rush, 2.2));
        const w = PHOTO.w * (1 + 0.03 * Math.max(0, t - S.morph)) * (1 + punchK(t, S.morphed, 0.05)) * Z;
        const h = w / 0.8;
        // the face (0.37 of the height) travels to where the next world's detail has it (y 637)
        const yFace = lerp(PHOTO.y - (0.5 - FACE[1]) * (PHOTO.w / 0.8), 637, smooth(rush));
        const A = boardBoxPose(bL, BM.typ.field, 0.02);
        const Bp = screenPose(base, 540 - 8 * Math.sin(t) * (1 - rush), yFace + (0.5 - FACE[1]) * h, w, D - 0.4, [0.04 * (1 - rush), (0.2 + 0.06 * Math.sin(t * 1.5)) * (1 - rush), -0.03 * (1 - rush)]);
        applyPose(pic.g, A, Bp, e, 0.6);
        pic.setAspect(Math.exp(lerp(Math.log(fa), Math.log(0.8), clamp(e))), 1.0);
        pic.corners.visible = mu >= 1 && rush === 0;
        scan.visible = mu > 0 && mu < 1;
        scan.position.set(0, (0.5 - mu) / pic.a, 0.012);
      }
      const a = t - S.morph;
      fl.visible = a >= -0.05 && a < 0.35;
      if (fl.visible) {
        fl.position.copy(boardBoxPose(bL, BM.typ.line, 0.1).p);
        fl.quaternion.copy(camera.quaternion);
        fl.scale.setScalar(1.5 * Math.sin(Math.PI * clamp((a + 0.05) / 0.4)));
      }
      const r = t - S.morphed;
      ring.visible = r >= 0 && r < 0.4;
      if (ring.visible) {
        place(ring, base, 540, PHOTO.y, 400 + 1900 * outCubic(r / 0.4), 1, D + 0.2);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - r / 0.4);
      }
      sweep.mesh.visible = r >= 0 && r < 0.24;
      if (sweep.mesh.visible) {
        const k = r / 0.24;
        place(sweep.mesh, base, lerp(200, 900, k), lerp(1450, 850, k), 700, 1, D - 0.7, [0, 0, 0.6]);
        sweep.mat.opacity = 0.8 * Math.sin(k * Math.PI);
      }
      LS.update(t, t >= S.morphed ? S.morphed : S.morph, V(0, -0.45, 1.0), 1.1, 0.5);
    }
    return {
      focus: D,
      ap: 2.6,
      flash: Math.max(t >= S.morph && t < S.morph + 2 / 60 ? 0.2 : 0, t >= S.morphed && t < S.morphed + 1 / 60 ? 0.22 : 0),
      ca: 0.3 + env(t, MORPH_IMP, 14) * 1.1 + (t < S.wipe + 8 / 60 ? 1.6 : 0) + 3 * inCubic(rush),
      glitch: 0,
    };
  };
  return { scene, camera, update };
}

// ═════════════════════════ BEZ FOCENÍ / BEZ ATELIÉRU ═════════════════════════
// the crop cuts: [zoom, focus x, focus y]
const WHIP0 = S.whipBg - 2 / 60, WHIP_F = 6;
function detShot(t: number): [number, number, number] {
  const A = (q: number): [number, number, number] => [1.9 + 0.3 * (q - S.det) + punchK(q, S.foceni, 0.04), FACE[0] + 0.02 * (q - S.det), 0.27];
  const B = (q: number): [number, number, number] => [2.6 + 0.3 * (q - S.det2), 0.46 + 0.02 * (q - S.det2), 0.52];
  const C = (q: number): [number, number, number] => [1.9 + 0.22 * (q - S.whipBg) + punchK(q, S.bgPunch, 0.06) + punchK(q, S.atel, 0.03), 0.52 + 0.03 * (q - S.whipBg), 0.22];
  const Dd = (q: number): [number, number, number] => [2.0 + 0.25 * (q - S.det4) + punchK(q, S.det4Beat, 0.04), 0.62 - 0.03 * (q - S.det4), 0.66];
  if (t < S.det2) return A(t);
  if (t < WHIP0) return B(t);
  if (t < WHIP0 + WHIP_F / 60) {
    // the whip pan: 6 frames from the face to the houses
    const u = smooth((t - WHIP0) / (WHIP_F / 60));
    const b = B(t), c = C(t);
    return [lerp(b[0], c[0], u), lerp(b[1], c[1], u), lerp(b[2], c[2], u)];
  }
  if (t < S.det4) return C(t);
  if (t < S.pull) return Dd(t);
  // the pull back to the whole photo (what the post world starts with)
  const u = inOut(clamp((t - S.pull) / (S.land - S.pull)));
  const d = Dd(t);
  return [Math.exp(lerp(Math.log(d[0]), Math.log(OVER), u)), lerp(d[1], FOCUS.r3[0], u), lerp(d[2], FOCUS.r3[1], u)];
}
const DET_IMP: Imp[] = [
  { t: S.det, power: 0.6 }, { t: S.foceni, power: 0.45 }, { t: S.det2, power: 0.65 }, { t: S.whipBg, power: 0.4 }, { t: S.bez2, power: 0.35 }, { t: S.bgPunch, power: 0.45 },
  { t: S.atel, power: 0.45 }, { t: S.det4, power: 0.6 }, { t: S.det4Beat, power: 0.3 }, { t: S.pull, power: 0.35 },
];
export const detSamples = (f: number) => {
  const near = (a: number, r0: number, r1: number) => f >= a - r0 && f <= a + r1;
  return near(T.det, 0, 5) || near(T.det2, 0, 4) || near(T.whipBg, 3, 6) || near(T.det4, 0, 4) || f >= T.pull ? 24 : 12;
};

export function buildDetails(M: Media, SR: Record<Key, Src>): World {
  const { scene, camera, base, BK } = pstage();
  const full = mkFull(scene, SR.r2);
  const fullB = mkFull(scene, SR.r3);
  const plate = plate0(scene);
  const b1 = word3(M, scene, "BEZ");
  const foc = word3(M, scene, "FOCENÍ", LIME, "#4f6600", 0.85, 0.35);
  const b2 = word3(M, scene, "BEZ");
  const atl = word3(M, scene, "ATELIÉRU", LIME, "#4f6600", 0.85, 0.35);
  // BEZ keeps one size in both pairs (the scale of the wider pair's second line would shrink it)
  const s1 = WORDS.bez1.w / foc.w, s2 = WORDS.bez2.w / atl.w;
  const sweep = streak(1, 0.3);
  scene.add(sweep.mesh);
  const LS = lightShards(36, "de", 1);
  scene.add(LS.group);

  const update = (t: number) => {
    const roll = 0.018 * Math.sin(t * 1.4);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0.05 * Math.sin(t * 0.9), 0.04 * Math.sin(t * 0.8), 6), V(0, 0, 0), 36, roll, t, DET_IMP, 0.009);
    const [z, fx, fy] = detShot(t);
    // r2 (face, then a whip) hands over to r3 at the whip's midpoint; r3 is also the post world's photo
    const fb = t >= WHIP0 + WHIP_F / 120;
    full.mesh.visible = false;
    fullB.mesh.visible = false;
    (fb ? fullB : full).set(base, z, fx, fy, { roll: -0.5 * roll, bright: 1 + 0.35 * (pulse(t, S.det, 9) + (t >= S.det2 ? pulse(t, S.det2, 9) : 0) + (t >= S.det4 ? pulse(t, S.det4, 9) : 0)) });
    BK.update(t);
    const wu = smooth((t - WHIP0) / (WHIP_F / 60));
    const pu = clamp((t - S.pull) / (S.land - S.pull));
    place(plate, base, 540, (WORDS.bez1.y + WORDS.bez1.y2) / 2, 1400, 1, D + 0.5);
    (plate.material as THREE.MeshBasicMaterial).opacity = 0.8 * (t < WHIP0 ? 1 : t < S.bez2 ? 1 - wu : clamp((t - S.bez2) / (4 / 60))) * (1 - pu);
    // BEZ / FOCENÍ ride out with the whip; BEZ / ATELIÉRU shrink away with the pull back
    showWord(b1, base, t, S.det, WHIP0 + WHIP_F / 60, 540, WORDS.bez1.y, b1.w * s1, { punch: [S.det2], dx: -1500 * wu, seed: 0.4 });
    showWord(foc, base, t, S.foceni, WHIP0 + WHIP_F / 60, 540, WORDS.bez1.y2, foc.w * s1, { from: 1.4, punch: [S.det2], dx: -1500 * wu, seed: 1.7 });
    const out = 1 - inCubic(pu);
    showWord(b2, base, t, S.bez2, S.land - 2 / 60, 540, lerp(960, WORDS.bez2.y, out), b2.w * s1, { punch: [S.bgPunch, S.det4], seed: 2.2, k: out });
    showWord(atl, base, t, S.atel, S.land - 2 / 60, 540, lerp(960, WORDS.bez2.y2, out), atl.w * s2, { from: 1.22, punch: [S.det4], seed: 3.1, k: out });
    {
      const sa = t - S.bgPunch;
      sweep.mesh.visible = sa >= 0 && sa < 0.24;
      if (sweep.mesh.visible) {
        const k = sa / 0.24;
        place(sweep.mesh, base, lerp(140, 940, k), lerp(1400, 1050, k), 800, 1, D - 0.6, [0, 0, 0.5]);
        sweep.mat.opacity = 0.7 * Math.sin(k * Math.PI);
      }
      const src = t >= S.atel ? S.atel : t >= S.foceni ? S.foceni : S.det;
      LS.update(t, src, V(0, -0.85, 1.2), 0.9, 0.45);
    }
    const fl = (t0: number, v: number) => (t >= t0 && t < t0 + 1 / 60 ? v : 0);
    return {
      focus: D,
      ap: 2.6,
      flash: Math.max(fl(S.det, 0.3), fl(S.det2, 0.12), fl(S.det4, 0.18)),
      ca: 0.3 + env(t, DET_IMP, 14) * 1.1 + (t >= WHIP0 && t < WHIP0 + WHIP_F / 60 ? 2.2 : 0) + (t < S.det + 3 / 60 ? 2.6 : 0) + 1.5 * Math.sin(Math.PI * pu),
      glitch: 0,
    };
  };
  return { scene, camera, update };
}

// ═════════════════════════ STAČÍ JI POSTNOUT ═════════════════════════
const POST_IMP: Imp[] = [{ t: S.land, power: 0.5 }, { t: S.landed2, power: 0.7 }, { t: S.cardPunch, power: 0.55 }, { t: S.heart, power: 0.6 }, { t: S.heartBeat, power: 0.4 }];
export const postSamples = (f: number) => {
  const near = (a: number, r0: number, r1: number) => f >= a - r0 && f <= a + r1;
  return near(T.land, 0, 12) || near(T.cardPunch, 0, 5) || near(T.heart, 0, 8) || f >= T.heartBeat ? 24 : 12;
};
const LAND_F = T.landed2 - T.land; // frames of the photo's fall into the frame

export function buildPost(M: Media, SR: Record<Key, Src>): World {
  const { scene, camera, base, grid, BK } = bstage(BGc);
  const card = mkCard(scene);
  const pic = mkPic(scene, SR.r3, 9 / 16, { depth: 0.02 });
  const w1 = word3(M, scene, "STAČÍ JI");
  const w2 = word3(M, scene, "POSTNOUT", LIME, "#4f6600", 0.85, 0.35);
  const sW = scale2(w1, w2, WORDS.post.w);
  const h1 = heartMesh(0.2); // the card's own heart, filled lime on the pop
  h1.mesh.visible = false;
  scene.add(h1.mesh);
  const h2 = heartMesh(0.12); // the big heart over the photo
  h2.mesh.visible = false;
  scene.add(h2.mesh);
  const ring = ring0();
  scene.add(ring);
  const BL: Burst[] = [{ t: S.heart, at: V(), power: 1.2, lime: 0.85, up: 1.2 }, { t: S.landed2, at: V(0, -0.3, 1.0), power: 1.0, lime: 0.5 }];
  const BU = bursts(BL, 90, 0.022, "po");
  scene.add(BU.points);
  const LS = lightShards(44, "po", 1);
  scene.add(LS.group);
  const sweep = streak(1, 0.3);
  scene.add(sweep.mesh);
  const [Wc, Hc] = CARD.px;
  const hx = CARD.heart[0] / Wc - 0.5, hy = CARD.heart[1] / Hc - 0.5; // the heart on the card (fractions from its centre)

  const update = (t: number) => {
    const a = t - S.land;
    const roll = 0.02 * Math.sin(t * 1.1);
    aim(base, V(0, 0, 6), V(0, 0, 0), 36, roll);
    placeCam(camera, V(0.05 * Math.sin(t * 0.8), 0.04 * Math.sin(t * 0.9), 6), V(0, 0, 0), 36, roll, t, POST_IMP, 0.007);
    place(grid.mesh, base, 540, 960, grid.W, 1, D + 3, [0, 0, -0.4 * roll]);
    grid.set(t, -240, 200, "graphite", 1.3);
    BK.update(t);
    BK.mat.opacity = 0.45;
    // the rush through the heart into the lockup (13.833 -> 14.000)
    const rush = clamp((t - S.heartBeat) / (fr(F.cta) - S.heartBeat));
    const Z = Math.exp(Math.log(60) * Math.pow(rush, 2.3));
    // ── the card: slams in from 135 % behind the falling photo ──
    const sl = lerp(1.35, 1, outBack(clamp(a / (9 / 60)), 1.2));
    const w = POST.w * sl * (1 + 0.02 * a) * (1 + punchK(t, S.landed2, 0.03) + punchK(t, S.cardPunch, 0.045) + punchK(t, S.heart, 0.035) + punchK(t, S.heartBeat, 0.03)) * Z;
    const h = (w * Hc) / Wc;
    // the heart stays under the camera's eye as the card rushes (it travels to the middle of the frame)
    const rr = smooth(rush * 1.4);
    const heartAt: [number, number] = [lerp(POST.x + hx * POST.w, 540, rr), lerp(POST.y + hy * ((POST.w * Hc) / Wc), 960, rr)];
    const cx = rush > 0 ? heartAt[0] - hx * w : POST.x + 6 * Math.sin(t * 1.2), cy = rush > 0 ? heartAt[1] - hy * h : POST.y + 5 * Math.sin(t * 1.5);
    card.g.visible = true;
    place(card.g, base, cx, cy, w, 1, D + 0.6, [(0.1 + 0.03 * Math.sin(t * 1.3)) * (1 - rush), (-0.14 + 0.07 * Math.sin(t * 0.9)) * (1 - rush), 0.012 * (1 - rush)]);
    // ── the photo: from the whole frame into the card's window (12.700 -> 12.867), its crop goes 9:16 -> 4:5 ──
    {
      const u = outCubic(clamp(a / (LAND_F / 60)));
      const A = screenPose(base, 540, 960, 1080 * OVER, D + 0.4);
      applyPose(pic.g, A, card.boxPose(CARD.win, 0.014), u, 0.2);
      pic.setAspect(Math.exp(lerp(Math.log(9 / 16), Math.log(0.8), u)), 1.0);
      pic.g.visible = true;
      (pic.face.material as THREE.MeshBasicMaterial).color.setScalar(1 + 0.3 * pulse(t, S.landed2, 8) * (t >= S.landed2 ? 1 : 0));
    }
    showWord(w1, base, t, S.staci, 99, 540, WORDS.post.y - 700 * inCubic(rush), w1.w * sW, { punch: [S.landed2, S.cardPunch], seed: 0.9 });
    showWord(w2, base, t, S.postnout, 99, 540, WORDS.post.y2 - 700 * inCubic(rush), w2.w * sW, { from: 1.22, punch: [S.heart], seed: 2.4 });
    // ── the heart pop (13.617) ──
    {
      const p = t - S.heart;
      card.g.updateMatrixWorld(true);
      const q = card.g.getWorldQuaternion(new THREE.Quaternion());
      const cs = card.g.scale.x;
      h1.mesh.visible = h2.mesh.visible = p >= 0;
      if (p >= 0) {
        const pop = lerp(0, 1, outBack(clamp(p / (7 / 60)), 2.6)) * (1 + 0.12 * pulse(t, S.heartBeat, 8) * (t >= S.heartBeat ? 1 : 0));
        h1.mesh.position.copy(card.g.localToWorld(card.point(CARD.heart[0], CARD.heart[1], 0.03)));
        h1.mesh.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5 * Math.sin(t * 3) * (1 - rush), 0)));
        h1.mesh.scale.setScalar(cs * (CARD.heartW / Wc) * 1.25 * pop);
        h1.face.emissiveIntensity = 0.8 + 1.2 * pulse(t, S.heart, 5);
        // the big one: pops over the photo, floats up and fades in 0.4 s
        const [x0, y0, x1, y1] = CARD.win;
        const big = outBack(clamp(p / (8 / 60)), 2.2);
        h2.mesh.position.copy(card.g.localToWorld(card.point((x0 + x1) / 2, (y0 + y1) / 2 - 60 * p * 60 / 24, 0.06)));
        h2.mesh.quaternion.copy(q);
        h2.mesh.scale.setScalar(cs * 0.36 * big * (1 + 0.5 * clamp((p - 0.2) / 0.2)));
        const fade = 1 - clamp((p - 0.2) / 0.2);
        h2.face.opacity = h2.side.opacity = fade;
        h2.mesh.visible = fade > 0;
        BL[0].at.copy(h1.mesh.position);
      }
      ring.visible = p >= 0 && p < 0.4;
      if (ring.visible) {
        const hp = h1.mesh.position;
        ring.position.copy(hp);
        ring.quaternion.copy(base.quaternion);
        ring.scale.setScalar(0.3 + 3.2 * outCubic(p / 0.4));
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p / 0.4);
      }
      BU.update(t);
      LS.update(t, t >= S.heart ? S.heart : S.landed2, t >= S.heart ? h1.mesh.position : screenPoint(base, 540, POST.y, D - 0.2), 1.0, 0.5);
      const sa = t - S.cardPunch;
      sweep.mesh.visible = sa >= 0 && sa < 0.26;
      if (sweep.mesh.visible) {
        const k = sa / 0.26;
        place(sweep.mesh, base, lerp(180, 900, k), lerp(1400, 700, k), 760, 1, D - 0.6, [0, 0, 0.6]);
        sweep.mat.opacity = 0.75 * Math.sin(k * Math.PI);
      }
    }
    const fl = (t0: number, v: number) => (t >= t0 && t < t0 + 1 / 60 ? v : 0);
    return {
      focus: D,
      ap: 2.6,
      flash: Math.max(fl(S.landed2, 0.2), fl(S.heart, 0.25), 0.7 * inCubic(clamp((t - (fr(F.cta) - 5 / 60)) / (5 / 60)))),
      ca: 0.3 + env(t, POST_IMP, 14) * 1.1 + (a < LAND_F / 60 ? 1.5 : 0) + 3 * inCubic(rush),
      glitch: 0,
    };
  };
  void wordTilt;
  return { scene, camera, update };
}
