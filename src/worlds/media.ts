// The pictures of the reel as three.js textures (from ads/ailab-co-umi/src/worlds/media.ts):
//   r1, r2, r3   the three result photos (public/img, copied from ailab-co-umi: r3 has its watermark retouched)
//   hook, tun    the two atmosphere shots as JPEG frames (public/seq, prep_video.py; Higgsfield, NOT AI LAB outputs)
//   typ, res, gen  the real app recording as JPEG frames (public/seq, prep_screens.py): the prompt being typed, the click
//                  on 4K, the click on Generovať
// One Src per picture; every surface gets its own cover-fit "view" (a clone sharing the image, so the GPU holds the
// picture once) cropped around the picture's focus. A video Src swaps its image per frame (set / play): every view follows.
import * as THREE from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { clamp } from "../three/shot3d";
import boardsJson from "../../public/scr/boards.json";

export type Key = "r1" | "r2" | "r3" | "hook" | "tun" | "typ" | "res" | "gen";
export const PHOTOS: Key[] = ["r1", "r2", "r3"];
export const CLIPS: Key[] = ["hook", "tun", "typ", "res", "gen"];
export type Media = { font: Font; img: Record<string, HTMLImageElement>; seq: Record<string, HTMLImageElement[]> };
// the boards' sizes and feature boxes in board px (x0, y0, x1, y1 from the top left), the recording's click frames
export type Box = [number, number, number, number];
export const BM = boardsJson as unknown as {
  typ: { size: [number, number]; field: Box; line: Box; n: number };
  res: { size: [number, number]; chip4k: Box; click: number; fps: number; n: number };
  gen: { size: [number, number]; button: Box; click: number; fps: number; n: number };
};

// where each picture's subject is (0..1 from the top left): crops and punch-ins go there
export const FOCUS: Record<Key, [number, number]> = {
  r1: [0.54, 0.43], r2: [0.46, 0.3], r3: [0.5, 0.3], hook: [0.45, 0.45], tun: [0.5, 0.5], typ: [0.5, 0.5], res: [0.5, 0.5], gen: [0.5, 0.5],
};

// cover-fit: the part of a picture of aspect srcA (w/h) that fills a surface of aspect dstA, around focus, zoomed in
export function fitRect(srcA: number, dstA: number, focus: [number, number] = [0.5, 0.5], zoom = 1) {
  let rx = 1, ry = 1;
  if (srcA > dstA) rx = dstA / srcA;
  else ry = srcA / dstA;
  rx /= zoom;
  ry /= zoom;
  // texture v runs bottom-up (flipY): the focus y is measured from the top
  return { rx, ry, ox: clamp(focus[0] - rx / 2, 0, 1 - rx), oy: clamp(1 - focus[1] - ry / 2, 0, 1 - ry) };
}

export class Src {
  base: THREE.Texture;
  views: THREE.Texture[] = [];
  cur = 0;
  aspect: number;
  constructor(public key: Key, public frames: (HTMLImageElement | HTMLCanvasElement)[]) {
    this.base = new THREE.Texture(frames[0]);
    this.base.colorSpace = THREE.SRGBColorSpace;
    this.base.anisotropy = 8;
    this.base.needsUpdate = true;
    const f0 = frames[0];
    this.aspect = f0 instanceof HTMLImageElement ? f0.naturalWidth / f0.naturalHeight : f0.width / f0.height;
  }
  get isClip() {
    return this.frames.length > 1;
  }
  private add(rx: number, ry: number, ox: number, oy: number) {
    const t = this.base.clone();
    t.repeat.set(rx, ry);
    t.offset.set(ox, oy);
    t.needsUpdate = true;
    this.views.push(t);
    return t;
  }
  // the picture cover-fitted to a surface of aspect a (w/h)
  view(a: number, zoom = 1, focus: [number, number] = FOCUS[this.key]) {
    const r = fitRect(this.aspect, a, focus, zoom);
    return this.add(r.rx, r.ry, r.ox, r.oy);
  }
  // a video: show source frame i (every view follows; the GPU uploads the picture once)
  set(i: number) {
    const k = clamp(Math.floor(i), 0, this.frames.length - 1);
    if (k === this.cur) return;
    this.cur = k;
    this.base.image = this.frames[k];
    this.base.needsUpdate = true;
    for (const v of this.views) v.needsUpdate = true;
  }
  // a video used from film time t0 on: a `fps` source at `speed`, held on its last frame
  play(t: number, t0: number, speed = 1, fps = 30) {
    if (this.isClip) this.set(Math.max(0, t - t0) * fps * speed);
  }
}

export function sources(M: Media) {
  const S = {} as Record<Key, Src>;
  for (const k of PHOTOS) S[k] = new Src(k, [M.img[k]]);
  for (const k of CLIPS) S[k] = new Src(k, M.seq[k]);
  return S;
}
