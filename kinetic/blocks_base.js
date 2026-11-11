// blocks.js: the scene blocks a kinetic film is assembled from. Each block is a class placed on the beat grid in
// spec.js as [Block, startBeat, endBeat, options]. Blocks with a nominal length (static N, in beats) scale their
// internal timing to the span they are given; sequencing blocks (Words, Strike, Cuts) take absolute beats.
// v2 rule built into every block: nothing parks. The camera always moves, a new idea lands every beat or half
// beat, and transitions are moves (whip, zoom through a letter, slot reel, collapse), not fades.
import { W, H, CX, CY, B, C, DUR, FPS, E, clamp, lerp, tw, env, rng, mixc, rgba, el, vis, set, at, type, styleType, letters, extrude, tumble } from './core.js';

// ---------- helpers (exported for custom blocks) ----------
const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, parent, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
export const qb = (a, b, c, u) => { const v = 1 - u; return [v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], v * v * a[1] + 2 * v * u * b[1] + u * u * c[1]]; };
export const cb = (a, b, c, d, u) => { const v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]; };
// Reparametrise any curve by arc length, so a comet moves at the speed its easing says.
export function arcLen(fn, n = 400) {
  const P = [], L = [0];
  for (let i = 0; i <= n; i++) { P.push(fn(i / n)); if (i) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); }
  const tot = L[n];
  const f = u => {
    const d = clamp(u) * tot; let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
    const s = (d - L[lo]) / ((L[hi] - L[lo]) || 1);
    return [lerp(P[lo][0], P[hi][0], s), lerp(P[lo][1], P[hi][1], s)];
  };
  f.len = tot;
  return f;
}
export const polyline = pts => arcLen(u => {
  const n = pts.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), s = x - i;
  return [lerp(pts[i][0], pts[i + 1][0], s), lerp(pts[i][1], pts[i + 1][1], s)];
}, pts.length * 60);
export const chamferPts = (x, y, w, h, c) => [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c], [x + c, y]];
export const ptsAttr = P => P.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
export const shake = (a, amp = 10, k = 16, w = 64) => a < 0 ? 0 : amp * Math.exp(-k * a) * Math.sin(w * a);
export const GLYPHS = '{}<>/;=()[]*+'.split('');
export const fmt = n => n.toLocaleString('en-US');
export const meas = e => [e.offsetWidth, e.offsetHeight];
// position of an element relative to an ancestor (offsetLeft alone is relative to the nearest transformed parent)
export function relPos(e, root) {
  let x = 0, y = 0;
  for (let n = e; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; if (n.offsetParent === null) break; }
  return [x, y];
}
// {lines}, {frames} and {seconds} in on-screen text are filled from the film itself, so the numbers stay true
export const fillVars = (f, v) => String(v).replace('{lines}', fmt(f.src.lines || 0)).replace('{frames}', fmt(Math.round(DUR * FPS))).replace('{seconds}', String(Math.round(DUR)));
export const punch = (t, t0, k = 9) => t < t0 ? 0 : Math.exp(-k * (t - t0));
// palette names ('bg', 'paper', 'accent', 'hot', 'ink') or any CSS colour
export const cc = c => (c && C[c]) || c;
export const isLight = g => !!g && g !== 'bg' && g !== C.bg;
export const typeOn = g => isLight(g) ? C.ink : C.paper;
export function glowDot(x, cx, cy, r, a = 1, color = C.accent) {
  if (a <= 0) return;
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 3.4);
  g.addColorStop(0, rgba(C.tint, a)); g.addColorStop(.22, rgba(C.tint2, .95 * a)); g.addColorStop(.45, rgba(color, .55 * a)); g.addColorStop(1, rgba(color, 0));
  x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r * 3.4, 0, 7); x.fill(); x.restore();
}
// slot-reel number: every digit is a column of 0-9 that spins down and settles on its target
export function reel(parent, text, o) {
  const row = el('div', parent, 'abs reel');
  styleType(row, o);
  row.cols = [];
  for (const ch of String(text)) {
    if (!/\d/.test(ch)) { el('span', row, 'rch').textContent = ch; continue; }
    const c = el('span', row, 'rcol'), inner = el('span', c, 'rin');
    inner.textContent = Array.from({ length: 30 }, (_, i) => i % 10).join('\n');
    const probe = el('span', row, 'rch'); probe.textContent = ch; c.style.width = probe.offsetWidth + 'px'; probe.remove();
    row.cols.push({ inner, d: +ch });
  }
  return row;
}
export function spinReel(row, t, t0, dur = .7, stagger = .07) {
  row.cols.forEach((c, i) => {
    const u = E.outCubic(clamp((t - t0 - i * stagger) / dur)), pos = (20 + c.d) * u;
    set(c.inner, 'transform', `translateY(${(-pos).toFixed(4)}em)`);
  });
}
// a bright band that sweeps across a face (background-clip text)
export function sheen(face, base) {
  Object.assign(face.style, { backgroundImage: `linear-gradient(100deg, ${base} 40%, #FFFFFF 47%, ${C.tint} 50%, ${base} 57%)`, backgroundSize: '320% 100%', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', backgroundPosition: '100% 0' });
}
// camera that flies through the counter of a glyph: P = the glyph's centre in stage coordinates
export function zoomThrough(t, ta, tb, P, base) {
  const z = tw(t, ta, tb, E.inExpo);
  if (z <= 0) return null;
  const s0 = base.s || 1, S = s0 * Math.exp(Math.log(70) * z), m = E.inOutCubic(clamp(z * 1.5));
  const tx = lerp(CX + s0 * (P[0] - CX), CX, m), ty = lerp(CY + s0 * (P[1] - CY), CY, m);
  return { x: P[0] - CX - (tx - CX) / S, y: P[1] - CY - (ty - CY) / S, s: S, r: (base.r || 0) * (1 - clamp(z * 3)) };
}
// the centre of a glyph's counter (the hole of an O, 0, D...) inside a letters() element placed at (cx, cy)
export function counterOf(L, i, cx, cy, size, fy = .48) {
  const sp = L.spans[i], [w, h] = meas(L.e);
  return [cx - w / 2 + sp.offsetLeft + sp.offsetWidth / 2, cy - h / 2 + fy * size];
}
// punch effects on an entrance: hit 1 = flash and shake, hit 2 = rays, ring and sparks too
export function hitFx(f, t0, o = {}) {
  const hit = o.hit ?? 1, g = o.ground, light = isLight(g);
  if (!hit) return;
  f.shake(t0, 9 + 5 * hit); f.bump(t0, .025 + .02 * hit); f.fast(t0 - .03, t0 + .28, hit > 1 ? 12 : 8);
  if (hit > 1) {
    const rc = light ? C.ink : (o.rayColor ? cc(o.rayColor) : C.paper);
    f.ray({ t0, dur: .55, color: rc, n: 90, r0: 120, r1: 1600, w: 2.6, screen: true, seed: Math.round(t0 * 97), ...(light ? { blend: 'source-over', alpha: .5 } : {}) });
    f.ring({ t0, dur: .5, r0: 40, r1: 1100, w: 16, color: light ? C.ink : C.accent, screen: true, ...(light ? { blend: 'source-over', alpha: .45 } : {}) });
    if (o.at) f.burst({ t0, x: o.at[0], y: o.at[1], n: 44, speed: 1700, life: .55, w: 3.3, seed: Math.round(t0 * 13), ...(light ? { color: C.ink, blend: 'source-over' } : {}) });
    f.flash({ t0, dur: .24, rise: .015, color: C.accent, peak: light ? .12 : .24 });
  } else f.flash({ t0, dur: .12, rise: .01, color: '#FFFFFF', peak: light ? .2 : .3 });
}

// ---------- base ----------
export class Scene {
  static N = 0;
  constructor(f, k0, k1, o = {}) {
    this.f = f; this.k0 = k0; this.k1 = k1; this.o = o; this.t0 = B(k0); this.t1 = B(k1);
    this.sc = this.constructor.N ? (k1 - k0) / this.constructor.N : 1;
    this.pre = o.pre || 0; this.post = o.post || 0; this.dir = o.dir || 1;
    this.root = el('div', f.scenesEl, 'scene');
    this.build();
    // transitions owned by the spec: whipIn: [dx, dy, dur, roll] lands this block, whipOut leaves it
    if (o.whipIn) f.whip(this.t0, ...o.whipIn);
    if (o.whipOut) f.whip(this.t1, ...o.whipOut);
  }
  // a beat offset inside the scene, scaled to its span, as seconds
  k(rel) { return B(this.k0 + rel * this.sc); }
  build() {}
  update() {}
  // default camera: a slow push with a little roll, so no shot is ever locked off
  cam(t) { const u = clamp((t - this.t0) / (this.t1 - this.t0)); return { s: 1 + .06 * E.inOutCubic(u), r: this.dir * lerp(-.7, .7, u) }; }
}

// ---------- Words: kinetic type, one idea per beat ----------
// shots: [{ at, style, text, ground, color, size, wdth, in, fx, ... }]
//   style: 'punch3d' (extruded, flies out of depth) | 'slam' (huge, letters tumble, ghost rows) |
//          'stack' ([kicker, word], word slams half a beat later, accent bar) | 'pair' ([line1, line2] from both sides) |
//          'split' ([small, big] big word slams from the right; scramble, glitch, note, code backdrop) | 'cut' (a hard cut word)
//   in: 'cut' | 'whipX' | 'whipY' | 'whipXr'   fx: 'punch' | 'hit' | 'none'
// charge: true = converging speed lines into a glowing point before the first shot
// exit: { type: 'zoom', at, char } (fly through the counter of a letter of the last shot) | { type: 'collapse', at } | { type: 'flash', at }
export class Words extends Scene {
  build() {
    const f = this.f, o = this.o;
    this.root.classList.add('persp');
    this.shots = o.shots.map((s, i) => {
      s = { ...s, t: B(s.at), te: B(i < o.shots.length - 1 ? o.shots[i + 1].at : this.k1), i };
      const g = s.ground ? cc(s.ground) : null;
      s.tf = s.flip ? B(s.at + s.flip.at) : null;
      if (g) f.ground(s.t, s.tf ?? s.te, g);
      if (s.flip) { if (s.flip.ground) f.ground(s.tf, s.te, cc(s.flip.ground)); f.cut(s.tf); f.shake(s.tf, 10); f.bump(s.tf, .04); }
      s.col = cc(s.color) || typeOn(s.ground);
      const sh = SHOTS[s.style || 'slam'](this, s);
      if (s.in === 'whipX') f.whip(s.t, 1650, 0, .12, 2); else if (s.in === 'whipXr') f.whip(s.t, -1650, 0, .12, -2);
      else if (s.in === 'whipY') f.whip(s.t, 0, 1150, .12); else if (i > 0 || !o.charge) f.cut(s.t);
      const fx = s.fx || 'hit', ht = sh.hitT ?? s.t;
      if (fx === 'beat') { const half = s.at % 1 !== 0; f.shake(ht, half ? 8 : 12); f.bump(ht, half ? .03 : .05); f.fast(ht, ht + .12, 8); }
      else hitFx(f, ht, { hit: fx === 'punch' ? 2 : fx === 'hit' ? 1 : 0, ground: s.ground, at: sh.hitAt || [CX, s.y || CY] });
      if (fx !== 'none') f.cue(ht, s.cue || (fx === 'punch' ? (s.big ? 'impact_big' : 'impact') : 'hit'), s.gain ?? (fx === 'punch' ? 1 : s.at % 1 ? .7 : .9));
      if (fx === 'punch') f.cue(ht + .02, 'sparkle', .4);
      return { s, ...sh };
    });
    if (o.charge) {
      const first = this.shots[0].s.t;
      f.ray({ t0: this.t0, dur: first - this.t0, inward: true, color: C.accent, n: 80, r0: 26, r1: 1150, w: 2, rate: 2.4, screen: true, seed: 2 });
      f.paint((x, t) => { if (t < this.t0 || t > first + .03) return; const q = clamp((t - this.t0) / (first - this.t0)); glowDot(x, CX, CY, 4 + 10 * q * q + Math.sin(t * 46) * 1.5 * q, Math.min(1, (t - this.t0) * 8)); }, true);
      f.cue(first, 'suck', .45, { end: first });
    }
    const ex = o.exit;
    if (ex) {
      this.exT = B(ex.at ?? this.k1 - .9);
      const last = this.shots[this.shots.length - 1];
      if (ex.type === 'zoom') { this.zP = last.counter(ex.char ?? 1); f.smear(this.exT + .1, this.t1, 2.2); f.fast(this.exT, this.t1, 12); f.cue(this.exT, 'whoosh_big', .85); }
      if (ex.type === 'collapse') { this.exE = B(ex.end ?? this.k1 - .4); f.fast(this.exT, this.exE + .05, 10); f.cue(this.exT, 'suck', .7, { end: this.exE }); f.comet({ t0: this.exE - B(.1), t1: this.exE, path: () => [CX, CY], ease: E.lin, tail: .01, size: 11, hold: B(.4), fade: .03 }); }
      if (ex.type === 'flash') { f.flash({ t0: this.exT, dur: this.t1 - this.exT, rise: (this.t1 - this.exT) / 2, color: '#FFFFFF', peak: 1 }); f.cut(this.exT); f.cue(this.exT, 'whoosh_big', .6); }
    }
  }
  cam(t) {
    const base = super.cam(t);
    if (this.zP) { const z = zoomThrough(t, this.exT, this.t1, this.zP, base); if (z) return z; }
    return base;
  }
  update(t) {
    for (const sh of this.shots) {
      const on = t >= sh.s.t - .01 && t < sh.s.te;
      vis(sh.g, on);
      if (on) sh.update(t);
    }
    if (this.o.exit?.type === 'collapse') {
      const last = this.shots[this.shots.length - 1], c = tw(t, this.exT, this.exE, E.inExpo);
      set(last.g, 'transformOrigin', `${CX}px ${CY}px`);
      set(last.g, 'transform', `scale(${lerp(1, 0, c).toFixed(4)})`);
      set(last.g, 'opacity', (1 - clamp((c - .7) / .3)).toFixed(3));
    }
  }
}
// widest a main word may be at rest: 200 px clear on each side, so camera pushes, beat bumps and the slow grow of a word
// still keep it ≥ 150 px from the edges (the user; checked by `cdp.mjs check`; 340 still let Comfy words reach 47 px)
export const SAFE = W - 400;
export const fitTo = (w, max = SAFE) => Math.min(1, max / Math.max(1, w));
export const SHOTS = {
  punch3d(b, s) {
    const size = s.size || 360, wd = s.wdth || 118;
    const g = el('div', b.root, 'abs p3d', { left: CX + 'px', top: (s.y || CY) + 'px' });
    const echo = [3, 2, 1].map(i => type(g, s.text, { size, wdth: wd, stroke: 2.5, color: rgba(s.col, .1 + .1 * (3 - i)), cls: 'abs' }));
    const X = extrude(g, s.text, { size, wdth: wd, layers: 30, depth: size * .3, face: s.col }); X.classList.add('abs');
    const [w, h] = meas(X.face), fit = fitTo(w);
    return { g, update(t) {
      const u = tw(t, s.t, s.t + .3, E.outExpo), dr = clamp((t - s.t) / Math.max(.3, s.te - s.t)), z = lerp(-2600, 0, u) + 160 * dr;
      set(g, 'transform', `translateZ(${z.toFixed(1)}px) rotateX(${lerp(14, 2, u).toFixed(2)}deg) rotateY(${(lerp(-18, 0, u) + 9 * dr).toFixed(2)}deg) scale(${fit})`);
      set(X, 'transform', `translate(${-w / 2}px,${-h / 2}px)`);
      echo.forEach((e, i) => {
        const ul = tw(t - (3 - i) * .05, s.t, s.t + .3, E.outExpo), zl = lerp(-2600, 0, ul) - (3 - i) * 170;
        set(e, 'transform', `translate(${-w / 2}px,${-h / 2}px) translateZ(${(zl - z).toFixed(1)}px)`);
        set(e, 'opacity', tw(t, s.t, s.t + .12).toFixed(3));
      });
    } };
  },
  slam(b, s) {
    const size = s.size || 430, wd = s.wdth || 112, y = s.y || CY;
    const g = el('div', b.root, 'abs full');
    const echo = s.echo === false ? [] : [-2, -1, 1, 2].map(k => ({ k, e: type(g, s.text, { size, wdth: wd, stroke: 3, color: rgba(s.col, Math.abs(k) === 1 ? .32 : .16), cls: 'abs' }) }));
    const L = letters(g, s.text, { size, wdth: wd, color: s.col, cls: 'abs', glow: s.glow });
    if (s.dot) L.spans[L.spans.length - 1].style.color = C.accent;
    const fit = fitTo(L.e.offsetWidth, s.safe), text = [...s.text];   // s.safe: a narrower cap for this shot
    const scr = s.scramble ? [B(s.at + s.scramble[0]), B(s.at + s.scramble[1])] : null;
    (s.inverts || []).forEach(k => { b.f.invert(B(s.at + k) + 1 / 60, 2 / 60); b.f.shake(B(s.at + k), 8); b.f.bump(B(s.at + k), .03); });
    if (scr) b.f.cue(scr[0], 'glitch', .45);
    if (s.glyphs) b.f.burst({ t0: s.t, x: CX + 190, y, n: 20, speed: 1100, life: .9, g: 600, glyphs: GLYPHS, gsize: 40, color: s.col, alpha: .85, seed: 133 + s.i, blend: 'source-over' });
    const fc = s.flip ? cc(s.flip.color) || typeOn(s.flip.ground) : null;
    return { g, counter: i => counterOf(L, i, CX, y, size * fit), update(t) {
      const a = t - s.t, sl = tw(t, s.t, s.t + .16, E.outExpo);
      if (fc) { const col = t >= s.tf ? fc : s.col; set(L.e, 'color', col); echo.forEach(({ k, e }) => styleType(e, { size, wdth: wd, stroke: 3, color: rgba(col, Math.abs(k) === 1 ? .32 : .16) })); }
      if (scr) { const rr = rng(Math.floor(t * 30) + 3); L.spans.forEach((sp, i) => { const turn = t > scr[0] + i * B(.2) && t < scr[1]; const ch = turn && rr() < .7 ? GLYPHS[Math.floor(rr() * GLYPHS.length)] : text[i]; if (sp.textContent !== ch) sp.textContent = ch; }); }
      set(L.e, 'transform', at(CX, y, `scale(${(lerp(s.from ?? 1.3, 1, sl) * (1 + .05 * Math.min(a, 1)) * fit).toFixed(4)})`));   // the grow stops after 1 s (edges)
      if (s.tumble !== false) tumble(L.spans, t, s.t, { stagger: .018, dur: .2, rot: 30, dy: -90, seed: 12 + s.i, from: .6 });
      echo.forEach(({ k, e }) => {
        const dir = (k > 0 ? 1 : -1) * (Math.abs(k) === 1 ? 1 : -1);
        set(e, 'transform', at(CX + dir * (60 + a * 460), y + k * size * .8 * fit, `scale(${fit})`));
        set(e, 'opacity', tw(t, s.t + .03 * Math.abs(k), s.t + .1 + .03 * Math.abs(k)).toFixed(3));
      });
    } };
  },
  stack(b, s) {
    const [k1t, wt] = s.text, size = s.size || 480, ks = s.kickerSize || 170, y = s.y || CY + 60, t2 = B(s.at + (s.second ?? .5));
    const g = el('div', b.root, 'abs full');
    const K = letters(g, k1t, { size: ks, wdth: 125, color: s.col, cls: 'abs' });
    const Wd = letters(g, wt, { size, wdth: s.wdth || 100, color: s.col, cls: 'abs' });
    const fit = fitTo(Wd.e.offsetWidth, s.safe), ww = Wd.e.offsetWidth * fit;
    const bar = el('div', g, 'abs', { background: C.accent, height: '30px', width: '0px' });
    b.f.bump(t2, .045); b.f.shake(t2, 9); b.f.cue(t2, 'hit', .7);
    K.spans.forEach((_, i) => b.f.cue(s.t + .08 + i * .025, 'pop', .1));
    return { g, counter: i => counterOf(Wd, i, CX, y, size * fit), update(t) {
      set(g, 'transform', `rotate(${lerp(-2.5, 1.2, clamp((t - s.t) / Math.max(.3, s.te - s.t))).toFixed(3)}deg)`);
      const kf = Math.min(fitTo(K.e.offsetWidth), Math.max(.55, fit * 1.15));
      set(K.e, 'transform', at(CX, y - size * .5 * fit - ks * .5 * kf - 6, `scale(${kf.toFixed(4)})`));
      tumble(K.spans, t, s.t, { stagger: .025, dur: .26, rot: 80, dy: -160, seed: 13 + s.i });
      const sl = tw(t, t2, t2 + .15, E.outExpo);
      vis(Wd.e, t >= t2 - .01);
      set(Wd.e, 'transform', at(CX, y, `scale(${(lerp(1.7, 1, sl) * (1 + .06 * clamp((t - t2) / .6)) * fit).toFixed(4)})`));
      set(Wd.e, 'opacity', clamp(sl * 3).toFixed(3));
      const bw = tw(t, t2 + B(.3), t2 + B(.7), E.outExpo);
      set(bar, 'width', (ww * bw).toFixed(1) + 'px');
      set(bar, 'transform', `translate(${CX - ww / 2}px, ${y + size * .4 * fit}px)`);
    } };
  },
  pair(b, s) {
    const [l1, l2] = s.text, size = s.size || 320, t2 = B(s.at + (s.second ?? .5)), c2 = cc(s.color2) || C.accent;
    const g = el('div', b.root, 'abs full');
    const echo = [-1, 1].map(() => type(g, `${l1} ${l2}`, { size: size * .68, wdth: 115, stroke: 2, color: rgba(s.col, .2), cls: 'abs' }));
    const A = type(g, l1, { size, wdth: 115, color: s.col, cls: 'abs' });
    const Bw = type(g, l2, { size, wdth: 115, color: c2, glow: isLight(s.ground) ? 0 : 22, cls: 'abs' });
    const fit = Math.min(fitTo(A.offsetWidth), fitTo(Bw.offsetWidth));
    b.f.shake(t2, 12); b.f.bump(t2, .04); b.f.cue(t2, 'hit', .75); b.f.fast(t2, t2 + .25, 10);
    return { g, update(t) {
      const a = tw(t, s.t, s.t + .2, E.outExpo), c = tw(t, t2, t2 + .2, E.outExpo), d = t - s.t;
      set(A, 'transform', at(CX - 700 * (1 - a), (s.y || CY) - size * .47 * fit, `scale(${((1 + .04 * d) * fit).toFixed(4)})`));
      vis(Bw, t >= t2 - .01);
      set(Bw, 'transform', at(CX + 700 * (1 - c), (s.y || CY) + size * .47 * fit, `scale(${((1 + .04 * d) * fit).toFixed(4)})`));
      echo.forEach((e, i) => { const sg = i ? 1 : -1; set(e, 'transform', at(CX + sg * (100 + d * 300), (s.y || CY) + sg * size * 1.3)); set(e, 'opacity', a.toFixed(3)); });
    } };
  },
  split(b, s) {
    const f = b.f, [sm, bg] = s.text, size = s.size || 420, y = s.y || CY + 50;
    const g = el('div', b.root, 'abs full');
    let codebg = null;
    if (s.code) { codebg = el('div', g, 'abs mono codebg'); codebg.textContent = (f.src.code || '').split('\n').slice(40, 100).join('\n'); }
    const small = type(g, sm, { size: s.smallSize || 170, wdth: 110, color: typeOn(s.ground), cls: 'abs' });
    const col = cc(s.color) || C.accent;
    const L = letters(g, bg, { size, wdth: s.wdth || 104, color: col, glow: isLight(s.ground) ? 0 : 26, cls: 'abs' });
    const fit = fitTo(L.e.offsetWidth + small.offsetWidth * .3), [lw, lh] = meas(L.e), sw = small.offsetWidth;
    const note = s.note ? el('div', g, 'abs mono note') : null;
    const scr = s.scramble ? [B(s.at + s.scramble[0]), B(s.at + s.scramble[1])] : null, glt = s.glitch != null ? B(s.at + s.glitch) : null;
    const tb2 = B(s.at + (s.second ?? .5));
    f.burst({ t0: tb2, x: CX + lw * .14, y, n: 18, speed: 1050, life: .9, g: 600, glyphs: GLYPHS, gsize: 38, color: typeOn(s.ground), alpha: .85, seed: 6 + s.i });
    f.dot({ t0: tb2 - .02, dur: .6, cx: CX, cy: y, rx: 500, ry: 700, sp: 22 });
    if (!isLight(s.ground)) f.bokeh({ t0: tb2, t1: s.te, n: 40, color: C.accent, size: 2.6, vy: -40, alpha: .5, seed: 8 + s.i });
    if (glt) f.cue(glt, 'glitch', .6);
    if (note) for (let i = 0; i < 22; i++) f.cue(B(s.at + (s.noteAt ?? 1)) + .42 * i / 22, 'key', .14);
    const text = [...bg], t2 = B(s.at + (s.second ?? .5));
    return { g, hitAt: [CX + lw * .14, y], hitT: t2, counter: i => counterOf(L, i, CX, y, size * fit), update(t) {
      const a = t - s.t;
      if (codebg) { set(codebg, 'transform', `translate(${(140 - a * 60).toFixed(1)}px, ${(-60 - a * 210).toFixed(1)}px) rotate(-8deg)`); set(codebg, 'opacity', (.09 * tw(t, s.t, s.t + .3)).toFixed(3)); }
      const ui = tw(t, s.t + B(.1), s.t + B(.1) + .25, E.outExpo);
      set(small, 'transform', at(CX - lw * fit / 2 + sw * fit / 2 + 14 - 220 * (1 - ui), y - lh * fit / 2 - 30, `scale(${fit})`));
      set(small, 'opacity', clamp(ui * 2).toFixed(3));
      const sl = tw(t, t2, t2 + .2, E.outExpo);
      vis(L.e, t >= t2 - .01);
      set(L.e, 'transform', at(CX + 520 * (1 - sl), y, `scaleX(${lerp(1.45, 1, sl).toFixed(3)}) scale(${fit})`));
      set(L.e, 'opacity', tw(t, t2 - .01, t2 + .03).toFixed(3));
      const rr = rng(Math.floor(t * 30) + 9), gl = glt != null && t >= glt && t < glt + .16;
      L.spans.forEach((sp, i) => {
        const turn = scr && t > scr[0] + i * B(.3) && t < scr[1];
        const ch = turn && rr() < .7 ? GLYPHS[Math.floor(rr() * GLYPHS.length)] : text[i];
        if (sp.textContent !== ch) sp.textContent = ch;
        set(sp, 'transform', gl ? `translate(${((rr() - .5) * 90).toFixed(1)}px, ${((rr() - .5) * 26).toFixed(1)}px)` : 'none');
      });
      if (!isLight(s.ground)) set(L.e, 'textShadow', gl ? `14px 0 rgba(255,40,70,.75), -14px 0 rgba(40,200,255,.6)` : `0 0 26px ${rgba(col, .55)}, 0 0 68px ${rgba(col, .28)}`);
      if (note) {
        const n = Math.floor(tw(t, B(s.at + (s.noteAt ?? 1)), B(s.at + (s.noteAt ?? 1)) + .42, E.lin) * s.note.length);
        note.textContent = s.note.slice(0, n) + (n > 0 && n < s.note.length ? '▍' : '');
        set(note, 'transform', at(CX, y + lh * fit / 2 + 50));
      }
    } };
  },
  cut(b, s) {
    const size = s.size || 400, wd = s.wdth || 104, dy = s.dy || 0, rot = s.rot || 0;
    const g = el('div', b.root, 'abs full');
    const ec = s.col === C.ink ? rgba(C.ink, .25) : rgba(s.col, .22);
    const echo = s.echo === false ? [] : [-1, 1].map(() => type(g, s.text, { size, wdth: wd, stroke: 3, color: ec, cls: 'abs' }));
    const L = letters(g, s.text, { size, wdth: wd, color: s.col, glow: s.col === C.accent && !isLight(s.ground) ? 26 : 0, stroke: s.stroke || 0, cls: 'abs' });
    const fit = fitTo(L.e.offsetWidth);
    if (s.rgb) b.f.invert(s.t + 1 / 60, 2 / 60);
    return { g, counter: i => counterOf(L, i, CX, CY + dy, size * fit), update(t) {
      const a = t - s.t, p = tw(t, s.t, s.t + .14, E.outExpo);
      if (s.rgb) { const v = shake(a, 16, 6, 40); set(L.e, 'textShadow', `${v.toFixed(1)}px 0 rgba(255,40,70,.75), ${(-v).toFixed(1)}px 0 rgba(40,200,255,.65)`); }
      set(L.e, 'transform', at(CX, CY + dy, `scale(${(lerp(1.25, 1, p) * (1 + .08 * Math.min(a, .8)) * fit).toFixed(4)}) rotate(${(rot * (1 + .5 * (1 - p)) + 6 * a * (rot >= 0 ? 1 : -1)).toFixed(2)}deg)`));
      echo.forEach((e, i) => { const sg = i ? 1 : -1; set(e, 'transform', at(CX + sg * (120 + a * 1100), CY + dy + sg * size * .86 * fit, `rotate(${rot}deg) scale(${fit})`)); });
    } };
  },
};
