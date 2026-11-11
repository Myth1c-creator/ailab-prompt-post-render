// blocks.js: scene blocks on a native 9:16 stage (1080x1920), from the AI LAB Comfy film (2026-10-28/29).
// Words and its shots come from the scenario-kinetic-film engine (blocks_base.js). Here: Seq3D (a pre-rendered 3D shot
// played full frame), Screen (a screen recording as a time-mapped frame sequence in a floating panel, with cut-ins and
// click rings), Num (a number that lands with echo rings and flies through its own counter), Reel (half-beat picture
// cuts with stacked words) and Logo9 (an end card laid out for a phone). More blocks from the references: blocks_more.js.
// Every block follows the engine's rule: the frame is a pure function of t, nothing parks.
import { W, H, CX, CY, B, BPM, FPS, C, E, clamp, lerp, tw, rgba, el, vis, set, at, type, letters, tumble } from './core.js';
import { Scene, Words, SHOTS, hitFx, zoomThrough, counterOf, isLight, typeOn, fitTo, SAFE, cc, punch, sheen } from './blocks_base.js';

export { Words };

const pad3 = i => String(i).padStart(3, '0');
// piecewise-linear map from film beats to frames of a recording: [[beat, frame], ...]
function mapSeq(pts, k) {
  if (k <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (k <= pts[i][0]) { const [a, fa] = pts[i - 1], [b, fb] = pts[i]; return fa + (fb - fa) * (k - a) / (b - a); }
  return pts[pts.length - 1][1];
}

// Words shots inside another block (same options as Words.shots); they ride on the block's own ground
function makeShots(b, list, kEnd) {
  const f = b.f;
  return list.map((s, i) => {
    s = { ...s, t: B(s.at), te: B(s.until ?? (i < list.length - 1 ? list[i + 1].at : kEnd)), i };
    s.col = cc(s.color) || typeOn(s.ground ?? b.o.ground);
    const sh = SHOTS[s.style || 'slam'](b, s);
    const fx = s.fx || 'hit', ht = sh.hitT ?? s.t;
    if (fx === 'beat') { f.shake(ht, 10); f.bump(ht, .04); f.fast(ht, ht + .12, 8); }
    else hitFx(f, ht, { hit: fx === 'punch' ? 2 : fx === 'hit' ? 1 : 0, ground: b.o.ground, at: sh.hitAt || [CX, s.y || CY] });
    if (fx !== 'none') f.cue(ht, s.cue || (fx === 'punch' ? (s.big ? 'impact_big' : 'impact') : 'hit'), s.gain ?? (fx === 'punch' ? 1 : .8));
    return { s, ...sh };
  });
}
function updShots(shots, t) {
  for (const sh of shots) {
    const on = t >= sh.s.t - .01 && t < sh.s.te;
    vis(sh.g, on);
    if (on) sh.update(t);
  }
}

// ---------- Seq3D: a pre-rendered 3D shot (Remotion + three.js, src/scenes/Hook916.tsx) played full frame ----------
// { seq: frame path prefix, n: frames, cuts: [s], cues: [[s, name, gain]], exit: { at } }
// The picture is frame floor(t·fps): every motion-blur sub-sample of one output frame shows the same picture (the 3D
// render has its own shutter), and the camera rig stays still because the shot shakes itself.
export class Seq3D extends Scene {
  build() {
    const f = this.f, o = this.o;
    this.img = el('img', this.root, 'seq3d', { width: W + 'px', height: H + 'px' });
    this.img.decoding = 'sync';
    this.cur = -1;
    for (const t of o.cuts || []) f.cut(t);
    for (const [t, name, gain] of o.cues || []) f.cue(t, name, gain);
    if (o.exit) {
      // the same white flash out as the Words exit it replaces
      this.exT = B(o.exit.at);
      f.flash({ t0: this.exT, dur: this.t1 - this.exT, rise: (this.t1 - this.exT) / 2, color: '#FFFFFF', peak: 1 }); f.cut(this.exT); f.cue(this.exT, 'whoosh_big', .6);
    }
  }
  cam() { return { s: 1, r: 0 }; }
  update(t) {
    const i = clamp(Math.floor(t * FPS + 1e-3), 0, this.o.n - 1);
    if (i !== this.cur) { this.cur = i; this.img.src = `${this.o.seq}${pad3(i)}.jpg`; window.__pending?.push(this.img.decode().catch(() => {})); }
  }
}

// ---------- Screen: the app itself, a time-mapped screen recording in a floating 3D panel ----------
// { seq: '../public/seq/click_', n: 109, map: [[beat, frame], ...], sw: 1920, sh: 1030 (source size in px),
//   crop: [x0, y0, x1, y1] (the part of the source the panel shows), pw: 980 (panel width), y (panel centre),
//   views: [[beat, [sx, sy] | null, zoom, cue]] (hard cut-ins to a detail, in source px; null = the whole crop),
//   rings: [[beat, [sx, sy]]] (a click pulse on a point of the source), shots: [...] (Words shots over the block),
//   ground, enter: 1 | 2 (entrance hit), charge: [beat0, beat1] (speed lines converge into the panel before the next block) }
export class Screen extends Scene {
  build() {
    const f = this.f, o = this.o, r = this.root;
    r.classList.add('persp');
    const [x0, y0, x1, y1] = o.crop;
    this.cw = x1 - x0; this.pw = o.pw || 980; this.ph = Math.round(this.pw * (y1 - y0) / this.cw); this.py = o.y || CY + 40;
    this.base = { t: this.t0, c: [(x0 + x1) / 2, (y0 + y1) / 2], z: 1 };
    // ghost rows: outlined words scrolling behind the panel (top, middle, bottom), so the frame never parks
    const gc = isLight(o.ground) ? rgba(C.ink, .16) : rgba(C.paper, .13);
    this.ghost = o.ghost ? [190, this.py, 1730].map((y, i) => ({ y, i, e: type(r, Array(6).fill(o.ghost).join('  '), { size: 230, wdth: 90, stroke: 3, color: gc, cls: 'abs' }) })) : [];
    this.wrap = el('div', r, 'abs p3d', { left: CX + 'px', top: this.py + 'px' });
    this.panel = el('div', this.wrap, 'spanel' + (isLight(o.ground) ? ' lt' : ''), { width: this.pw + 'px', height: this.ph + 'px' });
    this.img = el('img', this.panel, '', { width: (o.sw || 1920) + 'px', height: (o.sh || 1030) + 'px' });
    this.img.decoding = 'sync';
    this.cur = -1;
    this.rings = (o.rings || []).map(([k, p]) => ({ t: B(k), p, e: el('div', this.panel, 'sring') }));
    if (o.ground) f.ground(this.t0, this.t1, cc(o.ground));
    const hit = o.enter ?? 1;
    hitFx(f, this.t0, { hit, ground: o.ground, at: [CX, this.py] });
    f.cue(this.t0, hit > 1 ? 'impact_big' : 'impact', hit > 1 ? 1.1 : .85);
    f.fast(this.t0, this.t0 + .4, 10);
    this.views = (o.views || []).map(([k, c, z, cue]) => {
      const t = B(k);
      f.cut(t); f.shake(t, 10); f.bump(t, .035); f.fast(t, t + .2, 8); f.cue(t, cue || 'hit', .7);
      f.flash({ t0: t, dur: .1, rise: .005, color: '#FFFFFF', peak: .16 });
      return { t, c: c || this.base.c, z: z || 1 };
    });
    this.rings.forEach(q => { f.cue(q.t, 'click', 1); f.fast(q.t, q.t + .3, 8); });
    this.shots = makeShots(this, o.shots || [], this.k1);
    if (o.charge) {
      const [a, b] = o.charge.map(B);
      f.ray({ t0: a, dur: b - a, inward: true, color: isLight(o.ground) ? C.ink : C.accent, n: 90, r0: 30, r1: 1300, w: 2.2, rate: 2.6, screen: true, seed: 5, cx: CX, cy: this.py });
      f.fast(a, b, 8); f.cue(a, 'suck', .7, { end: b });
    }
  }
  view(t) { let v = this.base; for (const q of this.views) if (t >= q.t) v = q; return v; }
  cam(t) { const u = clamp((t - this.t0) / (this.t1 - this.t0)); return { s: 1 + .08 * E.inOutCubic(u), r: this.dir * lerp(-1.4, 1.4, u), x: lerp(-40, 40, u), y: 18 * Math.sin((t - this.t0) * 2.2) }; }
  update(t) {
    const o = this.o, k = t * BPM / 60;
    const i = clamp(Math.round(mapSeq(o.map, k)), 0, o.n - 1);
    if (i !== this.cur) { this.cur = i; this.img.src = `${o.seq}${pad3(i)}.jpg`; window.__pending?.push(this.img.decode().catch(() => {})); }
    const e = tw(t, this.t0, this.t0 + .32, E.outExpo), u = clamp((t - this.t0) / (this.t1 - this.t0)), d = this.dir;
    const sw = Math.sin((t - this.t0) * 1.7);
    set(this.wrap, 'transform', `translateZ(${lerp(-1100, 0, e).toFixed(1)}px) rotateX(${(lerp(16, 0, e) + lerp(6, -5, u) + 2 * sw).toFixed(3)}deg) rotateY(${((lerp(-20, 0, e) + lerp(-10, 10, u)) * d).toFixed(3)}deg) rotateZ(${(1.2 * sw * d).toFixed(3)}deg)`);
    set(this.wrap, 'opacity', clamp(e * 3).toFixed(3));
    set(this.panel, 'transform', `translate(${-this.pw / 2}px,${-this.ph / 2}px)`);
    for (const g of this.ghost) set(g.e, 'transform', at(CX + (g.i % 2 ? -1 : 1) * (380 * (t - this.t0) - 600), g.y));
    // inside each view the picture keeps pushing in (16 %/s) and drifts sideways
    const v = this.view(t), z = v.z * (1 + .16 * (t - v.t)) * (1 + .06 * punch(t, v.t, 10));
    const sc = this.pw / this.cw * z, cx = v.c[0] + 60 * (t - v.t) * d, cy = v.c[1];
    set(this.img, 'transform', `translate(${(this.pw / 2 - cx * sc).toFixed(2)}px,${(this.ph / 2 - cy * sc).toFixed(2)}px) scale(${sc.toFixed(5)})`);
    this.rings.forEach(q => {
      const a = (t - q.t) / .55, on = a >= 0 && a < 1;
      vis(q.e, on);
      if (!on) return;
      set(q.e, 'transform', `translate(${(this.pw / 2 + (q.p[0] - cx) * sc).toFixed(1)}px,${(this.ph / 2 + (q.p[1] - cy) * sc).toFixed(1)}px) scale(${lerp(.35, 2.4, E.outCubic(a)).toFixed(3)})`);
      set(q.e, 'opacity', (1 - a * a).toFixed(3));
    });
    updShots(this.shots, t);
  }
}

// ---------- Num: a number lands with echo rings, its label and sub line stack under it, then the camera flies through its counter ----------
// { number: '26', label: 'GRAFŮ', sub: 'S INSTALÁTOREM', ground, color, y, labelAt: .5, subAt: 1, portal: { at: beat, char: 1, fy: .6 } }
export class Num extends Scene {
  build() {
    const f = this.f, o = this.o, r = this.root;
    const gr = o.ground || 'bg', light = isLight(gr), ink = light ? C.ink : C.paper, col = cc(o.color) || C.accent;
    if (o.ground) f.ground(this.t0, this.t1, cc(gr));
    this.g = el('div', r, 'abs full');
    this.size = o.size || 820; this.ny = o.y || CY - 250;
    this.echo = [0, 1, 2].map(() => type(this.g, o.number, { size: this.size, wdth: 100, stroke: 3, color: rgba(col, .5), cls: 'abs' }));
    this.L = letters(this.g, o.number, { size: this.size, wdth: 100, color: col, glow: light ? 0 : 30, cls: 'abs' });
    this.fit = fitTo(this.L.e.offsetWidth);
    this.lab = letters(this.g, o.label, { size: o.labelSize || 220, wdth: 100, color: ink, cls: 'abs' });
    this.lfit = fitTo(this.lab.e.offsetWidth);
    this.sub = type(this.g, o.sub || '', { size: o.subSize || 104, wdth: 76, color: ink, cls: 'abs' });
    this.sfit = fitTo(this.sub.offsetWidth);
    vis(this.sub, !!o.sub);
    this.tL = B(this.k0 + (o.labelAt ?? .5)); this.tS = B(this.k0 + (o.subAt ?? 1));
    hitFx(f, this.t0, { hit: 2, ground: gr, at: [CX, this.ny] }); f.cue(this.t0, 'impact_big', 1);
    f.shake(this.tL, 10); f.bump(this.tL, .035); f.cue(this.tL, 'hit', .8); f.fast(this.tL, this.tL + .2, 8);
    if (o.sub) { f.shake(this.tS, 8); f.bump(this.tS, .03); f.cue(this.tS, 'hit', .7); f.fast(this.tS, this.tS + .2, 8); }
    if (o.portal) {
      this.tX = B(o.portal.at);
      this.zP = counterOf(this.L, o.portal.char ?? 1, CX, this.ny, this.size * this.fit, o.portal.fy ?? .6);
      f.smear(this.tX + .05, this.t1, 2.2); f.fast(this.tX, this.t1, 12); f.cue(this.tX, 'whoosh_big', .85);
    }
  }
  cam(t) {
    const base = super.cam(t);
    if (this.zP) { const z = zoomThrough(t, this.tX, this.t1, this.zP, base); if (z) return z; }
    return base;
  }
  update(t) {
    const z = tw(t, this.t0, this.t0 + .22, E.outExpo), d = t - this.t0, fit = this.fit, s = this.size;
    set(this.L.e, 'transform', at(CX, this.ny, `scale(${(lerp(2.6, 1, z) * (1 + .035 * d) * fit).toFixed(4)})`));
    set(this.L.e, 'opacity', tw(t, this.t0 - .01, this.t0 + .05).toFixed(3));
    this.echo.forEach((e, i) => {
      const p0 = this.t0 + i * B(.5), q = clamp((t - p0) / .55);
      set(e, 'transform', at(CX, this.ny, `scale(${(lerp(1, 1.75, E.outCubic(q)) * fit).toFixed(4)})`));
      set(e, 'opacity', (t >= p0 ? (1 - q) * .9 : 0).toFixed(3));
    });
    const ly = this.ny + s * fit * .5 + 70, a = tw(t, this.tL, this.tL + .16, E.outExpo);
    vis(this.lab.e, t >= this.tL - .01);
    set(this.lab.e, 'transform', at(CX, ly, `scale(${(lerp(1.4, 1, a) * (1 + .04 * (t - this.tL)) * this.lfit).toFixed(4)})`));
    tumble(this.lab.spans, t, this.tL, { stagger: .02, dur: .22, rot: 30, dy: -90, seed: 31, from: .6 });
    const b = tw(t, this.tS, this.tS + .2, E.outExpo);
    vis(this.sub, !!this.o.sub && t >= this.tS - .01);
    set(this.sub, 'transform', at(CX + 520 * (1 - b), ly + 175, `scaleX(${lerp(1.4, 1, b).toFixed(3)}) scale(${this.sfit.toFixed(4)})`));
    set(this.sub, 'opacity', tw(t, this.tS - .01, this.tS + .04).toFixed(3));
  }
}

// ---------- Reel: half-beat picture cuts (photos full bleed, cards as glowing panels), words stack up over them ----------
// { items: [[beat, src, 'photo' | 'card', [fx, fy]], ...], words: [[beat, text, color], ...], wy: [y1, y2], whip: true }
export class Reel extends Scene {
  build() {
    const f = this.f, o = this.o, r = this.root;
    r.classList.add('persp');
    this.items = o.items.map(([k, src, kind, foc], i) => {
      const t = B(k), card = kind === 'card';
      const g = el('div', r, 'abs full');
      const e = card ? el('div', g, 'rcard', { width: '920px', height: Math.round(920 * (o.cardRatio || 162 / 294)) + 'px', backgroundImage: `url("${src}")` })
                     : el('div', g, 'rimg', { backgroundImage: `url("${src}")`, backgroundPosition: `${((foc || [.5, .3])[0] * 100).toFixed(0)}% ${((foc || [.5, .3])[1] * 100).toFixed(0)}%` });
      if (!card) el('div', g, 'abs full', { background: `linear-gradient(180deg, ${rgba(C.bg, .05)} 30%, ${rgba(C.bg, .55)} 62%, ${rgba(C.bg, .7)})` });
      if (i > 0) {
        if (o.whip && i % 2) f.whip(t, i % 4 === 1 ? 1100 : -1100, 0, .1, i % 4 === 1 ? 2 : -2);
        else { f.cut(t); f.cue(t, 'hit', .55); f.flash({ t0: t, dur: .08, rise: .005, color: '#FFFFFF', peak: .14 }); }
      }
      f.shake(t, 9); f.bump(t, .035); f.fast(t, t + .18, 8);
      return { t, g, e, card, i };
    });
    this.items.forEach((it, i) => { it.te = i < this.items.length - 1 ? this.items[i + 1].t : this.t1 + this.post; });
    this.words = (o.words || []).map(([k, text, c], i) => {
      const L = letters(r, text, { size: o.size || 200, wdth: 84, color: cc(c) || C.paper, glow: cc(c) === C.accent ? 22 : 0, cls: 'abs' });
      L.e.style.textShadow = `0 10px 50px ${rgba(C.bg, .75)}`;
      const t = B(k), fit = fitTo(L.e.offsetWidth);
      f.shake(t, 12); f.bump(t, .04); f.cue(t, 'impact', .8); f.fast(t, t + .2, 8);
      f.flash({ t0: t, dur: .14, rise: .01, color: C.accent, peak: .12 });
      return { L, t, fit, i, y: (o.wy || [CY + 200, CY + 360])[i] };
    });
  }
  cam(t) { const u = tw(t, this.t0, this.t1, E.lin); return { s: 1 + .08 * E.inOutCubic(u), r: lerp(1, -1, u) }; }
  update(t) {
    for (const it of this.items) {
      const on = t >= it.t - .001 && t < it.te;
      vis(it.g, on);
      if (!on) continue;
      const a = t - it.t, u = clamp(a / Math.max(.2, it.te - it.t)), pk = punch(t, it.t, 9);
      if (it.card) set(it.e, 'transform', at(CX, CY - 210, `perspective(1400px) rotateY(${lerp(-12, 10, u) * (it.i % 2 ? -1 : 1)}deg) rotateX(${lerp(6, -3, u)}deg) scale(${(lerp(1.22, 1.06, E.outExpo(clamp(a / .25))) + .1 * u + .06 * pk).toFixed(4)})`));
      else set(it.e, 'transform', `scale(${(1.04 + .14 * E.inOutCubic(u) + .07 * pk).toFixed(4)}) translateY(${lerp(18, -18, u).toFixed(1)}px)`);
    }
    for (const w of this.words) {
      const on = t >= w.t - .01;
      vis(w.L.e, on);
      if (!on) continue;
      const sl = tw(t, w.t, w.t + .16, E.outExpo);
      set(w.L.e, 'transform', at(CX, w.y, `scale(${(lerp(1.45, 1, sl) * (1 + .03 * (t - w.t)) * w.fit).toFixed(4)})`));
      tumble(w.L.spans, t, w.t, { stagger: .02, dur: .22, rot: 30, dy: -90, seed: 220 + w.i, from: .6 });
    }
  }
}

// ---------- Logo9: the AI LAB end card for a phone: slash hit, the mark drops in, the wordmark tumbles in, url and the bio line ----------
// { hit: beat offset of the logo hit, word: 'AI LAB', url, small, mark: 330 (px) }
export class Logo9 extends Scene {
  build() {
    const f = this.f, o = this.o, r = this.root;
    this.tS = B(this.k0 + (o.hit ?? 0));
    this.line = el('div', r, 'abs lline');
    this.ms = o.mark || 330;
    this.mk = el('div', r, 'abs lmark'); this.mk.innerHTML = f.logo;
    const sv = this.mk.querySelector('svg');
    if (sv) { sv.setAttribute('width', this.ms); sv.setAttribute('height', this.ms); sv.style.display = 'block'; }
    this.wm = letters(r, o.word || 'AI LAB', { size: o.wsize || 250, wdth: 100, color: C.paper, cls: 'abs' });
    this.wfit = fitTo(this.wm.e.offsetWidth, SAFE - 80);
    this.sh = type(r, o.word || 'AI LAB', { size: o.wsize || 250, wdth: 100, cls: 'abs' }); sheen(this.sh, 'rgba(0,0,0,0)');
    this.url = el('div', r, 'abs lurl'); this.url.textContent = o.url || '';
    this.small = el('div', r, 'abs lsmall'); this.small.textContent = o.small || '';
    this.my = CY - 270; this.wy = CY + 60;
    f.slash({ t0: this.tS, x1: 60, y1: this.wy + 14, x2: 1020, y2: this.wy - 14, dur: .1, hold: .1, fade: .3, w: 5 });
    f.burst({ t0: this.tS + .04, x: CX, y: this.my, n: 36, speed: 1250, life: .6, seed: 141 });
    f.ring({ t0: this.tS, dur: .55, cx: CX, cy: this.my, r0: 40, r1: 950, w: 14, screen: true });
    f.flash({ t0: this.tS, dur: .3, rise: .02, color: '#FFFFFF', peak: .16 });
    f.bokeh({ t0: this.tS + .2, t1: this.t1 + 1, n: 90, color: C.accent, size: 2.4, vy: -26, alpha: .35, seed: 142 });
    f.fast(this.tS - .02, this.tS + .6, 10); f.shake(this.tS, 14); f.bump(this.tS, .05);
    f.cue(this.tS, 'logo_hit', 1.1);
    this.tU = this.tS + B(1.1); this.tM = this.tS + B(1.5); this.tSh = this.tS + B(1.9);
    f.cue(this.tU, 'pop', .45); f.cue(this.tM, 'pop', .35);
  }
  cam(t) { return { s: 1 + .08 * E.outCubic(tw(t, this.tS, this.t1, E.lin)), r: lerp(-.5, .5, tw(t, this.t0, this.t1, E.lin)) }; }
  update(t) {
    const tS = this.tS, l = tw(t, tS - .02, tS + .16, E.outExpo), lo = tw(t, tS + .14, tS + .45, E.inCubic);
    vis(this.line, t >= tS - .02);
    set(this.line, 'width', (lerp(4, 960, l) * (1 - lo * .6)).toFixed(1) + 'px');
    set(this.line, 'transform', at(CX, this.wy)); set(this.line, 'opacity', (1 - lo).toFixed(3));
    const m = tw(t, tS + .04, tS + .5, E.outBack), d = Math.max(0, t - tS);
    vis(this.mk, t >= tS);
    set(this.mk, 'transform', at(CX, this.my - 120 * (1 - m), `rotate(${lerp(-25, 0, m).toFixed(2)}deg) scale(${(lerp(.4, 1, m) * (1 + .02 * d)).toFixed(4)})`));
    set(this.mk, 'opacity', clamp(m * 2).toFixed(3));
    vis(this.wm.e, t >= tS + .1);
    set(this.wm.e, 'transform', at(CX, this.wy, `scale(${(this.wfit * (1 + .015 * d)).toFixed(4)})`));
    tumble(this.wm.spans, t, tS + .1, { stagger: .04, dur: .3, rot: 40, dy: -120, seed: 9, from: .4 });
    const sw = tw(t, this.tSh, this.tSh + .9, E.inOutCubic);
    vis(this.sh, sw > 0 && sw < 1);
    set(this.sh, 'transform', at(CX, this.wy, `scale(${(this.wfit * (1 + .015 * d)).toFixed(4)})`));
    set(this.sh, 'backgroundPosition', `${lerp(100, 0, sw).toFixed(2)}% 0`);
    const u1 = tw(t, this.tU, this.tU + .35, E.outCubic), u2 = tw(t, this.tM, this.tM + .35, E.outCubic);
    set(this.url, 'transform', at(CX, this.wy + 190 + 16 * (1 - u1))); set(this.url, 'opacity', u1.toFixed(3));
    set(this.small, 'transform', at(CX, this.wy + 275 + 12 * (1 - u2))); set(this.small, 'opacity', (u2 * .85).toFixed(3));
  }
}
