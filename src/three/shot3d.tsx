// Shared 3D core for Remotion (copied from ads/ailab-ai-studio; + per-moment desaturation and extra vignette) (from the AI LAB Comfy 3D hook, ads/ailab-comfy/src/scenes/Hook916.tsx, 2026-10-29).
// A shot is a plain three.js world built once and posed by `update(t)` for any time t; <AccumShot> renders every
// output frame as the average of N sub-frame renders over a forward shutter (real motion blur for every object, and
// sub-pixel jitter = anti-aliasing), then a depth-of-field gather from the middle sample's depth, then a grade.
// Helpers for the kind of chaos the user liked: Body (analytic rigid bodies: ballistic or damped segments, kicks,
// so collisions are placed exactly on sound hits), Tube (a wire whose vertices are rewritten every sample), canvas
// textures for UI, terminals and node cards. Every frame is a pure function of time. README.md next to this file.
import React, { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const quatE = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

// ───────────── rigid bodies as analytic segments (any time can be evaluated directly) ─────────────
export type Seg = { t: number; p: THREE.Vector3; v: THREE.Vector3; g: number; damp: number; q: THREE.Quaternion; w: THREE.Vector3 };
const _q = new THREE.Quaternion();
const _ax = V();
export class Body {
  segs: Seg[] = [];
  show = -99; // visible from
  constructor(public hw = 0.5, public hh = 0.5) {}
  seg(t: number) {
    let s = this.segs[0];
    for (const x of this.segs) if (x.t <= t) s = x;
    return s;
  }
  pos(t: number, out = V()) {
    const s = this.seg(t);
    const a = t - s.t;
    if (s.damp > 0) return out.copy(s.p).addScaledVector(s.v, (1 - Math.exp(-s.damp * a)) / s.damp);
    return out.copy(s.p).addScaledVector(s.v, a).add(_ax.set(0, 0.5 * s.g * a * a, 0));
  }
  vel(t: number) {
    const s = this.seg(t);
    const a = t - s.t;
    return s.damp > 0 ? s.v.clone().multiplyScalar(Math.exp(-s.damp * a)) : s.v.clone().add(V(0, s.g * a, 0));
  }
  quat(t: number, out = new THREE.Quaternion()) {
    const s = this.seg(t);
    const a = t - s.t;
    const L = s.w.length();
    out.copy(s.q);
    if (L > 1e-6) out.multiply(_q.setFromAxisAngle(_ax.copy(s.w).divideScalar(L), L * (s.damp > 0 ? (1 - Math.exp(-s.damp * a)) / s.damp : a)));
    return out;
  }
  // floats in place until something kicks it
  hover(p: THREE.Vector3, q: THREE.Quaternion, w = V()) {
    this.segs = [{ t: -99, p, v: V(), g: 0, damp: 0, q, w }];
  }
  // the state at time te (it extrapolates backwards too: a striker is defined by where it is when it hits)
  at(te: number, p: THREE.Vector3, v: THREE.Vector3, g: number, q: THREE.Quaternion, w = V()) {
    this.segs = [{ t: te, p, v, g, damp: 0, q, w }];
  }
  // from time t on: velocity + dv, a new spin, gravity and damping (the segment before t is kept)
  kick(t: number, dv: THREE.Vector3, w: THREE.Vector3, g: number, damp: number) {
    const s: Seg = { t, p: this.pos(t), v: this.vel(t).add(dv), g, damp, q: this.quat(t), w };
    this.segs = [...this.segs.filter((x) => x.t <= t), s];
  }
}

// a collision placed on a time: A bounces off, B is thrown (and starts to fall unless it is a damped, floating thing)
export const collide = (te: number, A: Body, B: Body, o: { side?: number; power?: number; g?: number; floatB?: boolean; massB?: number; seed?: (k: string) => number }) => {
  const side = o.side ?? 1;
  const power = o.power ?? 1;
  const g = o.g ?? -7.5;
  const m = o.massB ?? 1;
  const fr = (x: number) => x - Math.floor(x);
  const r = o.seed ?? ((k: string) => fr(Math.sin(k.charCodeAt(0) * 12.9898 + te * 78.233) * 43758.5453));
  const sg = (k: string) => r(k) * 2 - 1;
  const vA = A.vel(te);
  A.kick(te, V(-vA.x * 0.55 + side * 1.4 * power, -vA.y * 1.22, -vA.z * 0.4 + 0.5 * power), V(sg("a"), sg("b"), sg("c")).multiplyScalar(6 * power), g, 0);
  B.kick(te, V(vA.x * 0.4 - side * power, vA.y * 0.5, sg("d") * 0.6).multiplyScalar(m), V(sg("e"), sg("f"), sg("g")).multiplyScalar(4 * power * m), o.floatB ? 0 : g, o.floatB ? 2.4 : 0);
  return A.pos(te).lerp(B.pos(te), 0.5);
};

// ───────────── canvas textures and a tube rewritten every sample ─────────────
export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
export const tex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
export const bez = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, u: number) => {
  const m = 1 - u;
  return V().addScaledVector(p0, m * m * m).addScaledVector(p1, 3 * m * m * u).addScaledVector(p2, 3 * m * u * u).addScaledVector(p3, u * u * u);
};
export class Tube {
  mesh: THREE.Mesh;
  pos: Float32Array;
  constructor(public r: number, mat: THREE.Material, public segN = 36, public radN = 5) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((segN + 1) * (radN + 1) * 3);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const idx: number[] = [];
    for (let i = 0; i < segN; i++)
      for (let j = 0; j < radN; j++) {
        const a = i * (radN + 1) + j;
        const b = a + radN + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }
  // a cubic bezier from p0 to p3
  set(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const T = V();
    const N = V();
    const Bn = V();
    for (let i = 0; i <= this.segN; i++) {
      const u = i / this.segN;
      const m = 1 - u;
      const P = bez(p0, p1, p2, p3, u);
      T.set(0, 0, 0).addScaledVector(p1.clone().sub(p0), 3 * m * m).addScaledVector(p2.clone().sub(p1), 6 * m * u).addScaledVector(p3.clone().sub(p2), 3 * u * u).normalize();
      N.crossVectors(T, Math.abs(T.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0)).normalize();
      Bn.crossVectors(T, N);
      for (let j = 0; j <= this.radN; j++) {
        const a = (j / this.radN) * Math.PI * 2;
        const k = (i * (this.radN + 1) + j) * 3;
        this.pos[k] = P.x + this.r * (Math.cos(a) * N.x + Math.sin(a) * Bn.x);
        this.pos[k + 1] = P.y + this.r * (Math.cos(a) * N.y + Math.sin(a) * Bn.y);
        this.pos[k + 2] = P.z + this.r * (Math.cos(a) * N.z + Math.sin(a) * Bn.z);
      }
    }
    (this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ───────────── the shot: world + post (accumulation, depth of field, grade) ─────────────
// what update(t) returns: focus distance (world units along the view), aperture (blur px at 1080 wide per unit of
// relative defocus), and the grade's per-moment values
export type Look = { focus: number; ap: number; flash?: number; ca?: number; glitch?: number; desat?: number; vig?: number };
export type World = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update: (t: number) => Look };
// tint: the colour the mids and shadows go to (linear-ish RGB weights on luma), amount 0..1; whites stay white
export type Grade = { tint?: [number, number, number]; amount?: number; contrast?: number; vignette?: number; flashColor?: [number, number, number] };

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const ACC = `uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, 1.0); }`;
const DOF = `uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far, focus, ap, maxR; varying vec2 vUv;
  float dist(vec2 uv){ float d = texture2D(tDepth, uv).x; return -(near * far) / ((far - near) * d - far); }
  float coc(float z){ return clamp(ap * abs(z - focus) / max(z, 0.05), 0.0, maxR); }
  void main(){
    float zc = dist(vUv); float rc = coc(zc);
    vec3 sum = texture2D(tColor, vUv).rgb; float ws = 1.0;
    if (rc > 0.6) {
      for (int i = 0; i < 40; i++) {
        float fi = float(i) + 0.5; float r = sqrt(fi / 40.0) * rc; float a = fi * 2.39996323;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
        float zt = dist(uv);
        float w = zt < zc - 0.15 ? clamp(coc(zt) / rc, 0.0, 1.0) : 1.0;   // a sharp thing in front must not bleed into the blur behind it
        sum += texture2D(tColor, uv).rgb * w; ws += w;
      }
    }
    gl_FragColor = vec4(sum / ws, 1.0);
  }`;
const GRADE = `uniform sampler2D tColor; uniform float ca, glitch, flash, seed, amount, contrast, vignette, desat, vig; uniform vec3 tint, flashColor; uniform vec2 res; varying vec2 vUv;
  float h(float x){ return fract(sin(x * 91.7 + seed) * 43758.5453); }
  float sh(float x){ return x < 0.75 ? x : 0.75 + 0.25 * (1.0 - exp(-(x - 0.75) / 0.25)); }
  void main(){
    vec2 uv = vUv;
    if (glitch > 0.0) { float band = floor(uv.y * 34.0); if (h(band) < 0.35 * glitch) uv.x += (h(band + 7.0) - 0.5) * 0.12 * glitch; }
    vec2 d = (uv - 0.5) * ca * 0.01;
    vec3 c = vec3(texture2D(tColor, uv + d).r, texture2D(tColor, uv).g, texture2D(tColor, uv - d).b);
    c = vec3(sh(c.r), sh(c.g), sh(c.b));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    vec3 g = gl_FragColor.rgb;
    g = mix(g, vec3(dot(g, vec3(0.299, 0.587, 0.114))), desat);   // bullet-time freezes lose colour
    g += flash * flashColor;   // after sRGB: a flash in linear light lifts the blacks into a wash
    float l = dot(g, vec3(0.299, 0.587, 0.114));
    g = mix(g, l * tint, amount * (1.0 - smoothstep(0.5, 0.95, l)));
    g = clamp((g - 0.5) * contrast + 0.5, 0.0, 1.0);
    g = max(g - 0.018, 0.0) / 0.982;
    vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
    g *= 1.0 - (vignette + vig) * smoothstep(0.25, 0.75, length(q));
    gl_FragColor = vec4(g, 1.0);
  }`;
export const GRADES: Record<string, Grade> = {
  red: { tint: [1.2, 0.3, 0.27], amount: 0.42, contrast: 1.12, vignette: 0.35, flashColor: [0.28, 0.035, 0.025] },
  lime: { tint: [0.62, 1.12, 0.3], amount: 0.3, contrast: 1.1, vignette: 0.35, flashColor: [0.2, 0.26, 0.04] },
  neutral: { tint: [1, 1, 1], amount: 0, contrast: 1.06, vignette: 0.3, flashColor: [0.2, 0.2, 0.2] },
};

const _cc = new THREE.Color();
const halton = (i: number, b: number) => {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
};

// Put inside <ThreeCanvas gl={{ antialias: false, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}>.
// build() runs once (after fonts and textures are ready); samples(frame) may give more samples where the camera shakes.
export const AccumShot: React.FC<{ frame: number; fps?: number; build: () => World; samples?: (frame: number) => number; shutter?: number | ((frame: number) => number); grade?: Grade; prepare?: (world: World, frame: number) => void }> = ({
  frame,
  fps = 60,
  build,
  samples = () => 8,
  shutter = 0.5,
  grade = GRADES.neutral,
  prepare,
}) => {
  const { gl } = useThree();
  const world = useMemo(build, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pp = useMemo(() => {
    const rt = (depth: boolean) =>
      new THREE.WebGLRenderTarget(4, 4, depth ? { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4) } : { type: THREE.HalfFloatType });
    const mk = (fs: string, u: Record<string, THREE.IUniform>, add = false) =>
      new FullScreenQuad(
        new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, transparent: add,
          blending: add ? THREE.CustomBlending : THREE.NoBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation }),
      );
    const G = { ...GRADES.neutral, ...grade };
    return {
      rts: { a: rt(false), mid: rt(true), acc: rt(false), dof: rt(false), w: 0, h: 0 },
      acc: mk(ACC, { tex: { value: null }, w: { value: 1 / 8 } }, true),
      dof: mk(DOF, { tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2() }, near: { value: 0.05 }, far: { value: 80 }, focus: { value: 4 }, ap: { value: 10 }, maxR: { value: 16 } }),
      grade: mk(GRADE, { tColor: { value: null }, ca: { value: 0 }, glitch: { value: 0 }, flash: { value: 0 }, desat: { value: 0 }, vig: { value: 0 }, seed: { value: 0 }, res: { value: new THREE.Vector2() },
        tint: { value: new THREE.Vector3(...G.tint!) }, amount: { value: G.amount }, contrast: { value: G.contrast }, vignette: { value: G.vignette }, flashColor: { value: new THREE.Vector3(...G.flashColor!) } }),
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const px = gl.getDrawingBufferSize(new THREE.Vector2());
    const R = pp.rts;
    if (R.w !== px.x || R.h !== px.y) {
      for (const r of [R.a, R.mid, R.acc, R.dof]) r.setSize(px.x, px.y);
      R.w = px.x;
      R.h = px.y;
    }
    const k = px.x / 1080; // DOF radii are written for a 1080-wide frame
    const auto = gl.autoClear;
    gl.autoClear = false;
    prepare?.(world, frame);   // per-frame inputs (e.g. the frame of a screen recording) before the samples
    const N = samples(frame);
    const sh = typeof shutter === "function" ? shutter(frame) : shutter;
    const MID = N >> 1;
    let mid: Look = { focus: 4, ap: 0 };
    (pp.acc.material as THREE.ShaderMaterial).uniforms.w.value = 1 / N;
    for (let i = 0; i < N; i++) {
      const t = (frame + ((i + 0.5) / N) * sh) / fps;
      const st = world.update(t);
      if (i === MID) mid = st;
      const cam = world.camera;
      cam.projectionMatrix.elements[8] += ((halton(i + 1, 2) - 0.5) * 2) / px.x;
      cam.projectionMatrix.elements[9] += ((halton(i + 1, 3) - 0.5) * 2) / px.y;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      const target = i === MID ? R.mid : R.a;
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(world.scene, cam);
      (pp.acc.material as THREE.ShaderMaterial).uniforms.tex.value = target.texture;
      gl.setRenderTarget(R.acc);
      if (i === 0) {
        // the accumulator must start from black: gl.clear() uses the clear colour that three's background module just
        // set to scene.background, which added the ground colour once more over the whole frame (invisible on graphite,
        // but a lime or paper ground washed everything out to lime / white: the AI LAB intro v1 hook and FOTKY.)
        const cc = gl.getClearColor(_cc), ca = gl.getClearAlpha();
        gl.setClearColor(0x000000, 0);
        gl.clear();
        gl.setClearColor(cc, ca);
      }
      pp.acc.render(gl);
    }
    const du = (pp.dof.material as THREE.ShaderMaterial).uniforms;
    du.tColor.value = R.acc.texture;
    du.tDepth.value = R.mid.depthTexture;
    du.res.value.set(px.x, px.y);
    du.near.value = world.camera.near;
    du.far.value = world.camera.far;
    du.focus.value = mid.focus;
    du.ap.value = mid.ap * k;
    du.maxR.value = 16 * k;
    gl.setRenderTarget(R.dof);
    pp.dof.render(gl);
    const gu = (pp.grade.material as THREE.ShaderMaterial).uniforms;
    gu.tColor.value = R.dof.texture;
    gu.ca.value = mid.ca ?? 0.3;
    gu.glitch.value = mid.glitch ?? 0;
    gu.flash.value = mid.flash ?? 0;
    gu.desat.value = mid.desat ?? 0;
    gu.vig.value = mid.vig ?? 0;
    gu.seed.value = Math.floor(frame / 2) * 1.37;
    gu.res.value.set(px.x, px.y);
    gl.setRenderTarget(null);
    pp.grade.render(gl);
    gl.autoClear = auto;
  }, 1);
  return null;
};
