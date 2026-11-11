// blocks_more.js: blocks from the references ref4–ref6 (2026-10-29), one set per style in STYL.md.
//   A Kinetic (ref6): Words shot styles 'pile' (lines stack up one per beat, the pile recentres), 'punct' (a column of
//     lines and a giant punctuation mark), 'echo' (a word slides in with a trail of outlines that settles into an
//     outline stack), 'serif' (an italic serif word that blurs in, optionally under a sans line; also style B), and
//     XMark (two brush strokes cross out whatever is under them).
//   B Premium 3D (ref5): Sky (painted clouds, day or sunset), Space (stars and the earth's limb at sunrise), Device
//     (a floating laptop; the camera can fly into its screen).
//   C Playful story (ref4): Mascot (glossy blob characters with faces: sleep, blink, shock, happy), Count (a number that
//     adds up step by step over a receipt), Cal (a desk calendar that flips months), Wipe (a colour band, optionally
//     with scissors, sweeps across and cuts to the next block).
//   All styles: UI (an app screen rebuilt as crisp vector cards from a JSON layout, with counters, steps, chips,
//     a cursor, clicks and struck-out rows). Text and numbers come from the client's own screens, never invented.
// Background blocks (Sky, Space, Device, UI, Count, Mascot) take `shots` (Words shots on top), like Screen.
// Every block follows the engine's rule: the frame is a pure function of t, nothing parks.
import { W, H, CX, CY, B, C, E, clamp, lerp, tw, rng, mixc, rgba, el, vis, set, at, type, letters, tumble } from './core.js';
import { Scene, SHOTS, hitFx, counterOf, isLight, typeOn, fitTo, SAFE, cc, punch, svg } from './blocks_base.js';

const dsfNow = () => window.devicePixelRatio || 1;

// Words shots inside a block (same options as Words.shots); they ride on the block's own ground
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
// piecewise value over beats: [[beat, value], ...], eased between keys
function keyed(keys, k, ease = E.outCubic, span = .35) {
  if (!Array.isArray(keys)) return keys;
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a, va] = keys[i - 1], [b2, vb] = keys[i];
    if (k < b2) return va;
    if (i === keys.length - 1 || k < keys[i + 1][0]) return lerp(va, vb, ease(clamp((k - b2) / span)));
  }
  return keys[keys.length - 1][1];
}
const fmtNum = (v, dec = 0, sep = ',') => {   // sep ' ' = Czech: 1 330,50
  const s = Math.abs(v).toFixed(dec), [i, d] = s.split('.');
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? (sep === ',' ? '.' : ',') + d : '');
};
const kOf = t => t / B(1);   // seconds -> beats

// ───────────────────────── A · Kinetic shot styles (ref6) ─────────────────────────
Object.assign(SHOTS, {
  // lines land one per `every` beats and stack; the pile shrinks to fit and stays centred
  pile(b, s) {
    const every = s.every ?? .5, y0 = s.y || CY, g = el('div', b.root, 'abs full');
    const L = s.text.map((tx, i) => {
      const size = s.sizes?.[i] || s.size || 300, col = cc(s.colors?.[i]) || s.col;
      const l = letters(g, tx, { size, wdth: s.wdth || 100, color: col, grad: s.grads?.[i], cls: 'abs' });
      const fit = fitTo(l.e.offsetWidth);
      return { ...l, fit, h: size * .9 * fit, t: B(s.at + i * every) };
    });
    L.forEach((l, i) => { if (i) { b.f.shake(l.t, 9); b.f.bump(l.t, .035); b.f.fast(l.t, l.t + .12, 8); b.f.cue(l.t, 'hit', .6); } });
    return { g, update(t) {
      const hs = L.map(l => (t >= l.t - .01 ? l.h * tw(t, l.t, l.t + .16, E.outExpo) : 0));
      const tot = hs.reduce((a, h) => a + h, 0), k = Math.min(1, 1150 / Math.max(1, tot));
      let y = y0 - tot * k / 2;
      L.forEach((l, i) => {
        vis(l.e, t >= l.t - .01);
        if (t < l.t - .01) return;
        const u = tw(t, l.t, l.t + .16, E.outExpo), hh = hs[i] * k, yc = y + hh / 2;
        y += hh;
        set(l.e, 'transform', at(CX, yc, `scale(${(lerp(1.6, 1, u) * l.fit * k * (1 + .03 * Math.min(t - l.t, 1))).toFixed(4)})`));
        set(l.e, 'opacity', clamp(u * 3).toFixed(3));
        tumble(l.spans, t, l.t, { stagger: .015, dur: .18, rot: 20, dy: -60, seed: 31 + i, from: .7 });
      });
    } };
  },
  // a column of lines on the left (small kicker, then big words) and a giant tilted mark on the right
  punct(b, s) {
    const every = s.every ?? .35, X0 = 200, y0 = s.y || CY, mc = cc(s.markColor) || C.hot, g = el('div', b.root, 'abs full');
    const tm = B(s.at + (s.markAt ?? s.text.length * every)), msz = s.markSize || 760;
    const M = type(g, s.mark || '?', { size: msz, wdth: 100, color: mc, cls: 'abs' });
    const mw = M.offsetWidth;
    M.style.zIndex = '0';   // the lines read over the mark
    const L = s.text.map((tx, i) => {
      const size = s.sizes?.[i] || (i ? 230 : 110), col = cc(s.colors?.[i]) || s.col;
      const e = type(g, tx, { size, wdth: s.wdth || 100, color: col, cls: 'abs' });
      e.style.transformOrigin = '0 50%'; e.style.zIndex = '2';
      const fit = fitTo(e.offsetWidth, 430);
      return { e, fit, h: size * .9 * fit, t: B(s.at + i * every) };
    });
    const rr = rng(77 + s.i), minis = Array.from({ length: s.minis ?? 3 }, (_, i) => ({
      e: type(g, s.mark || '?', { size: 170 + 60 * (i % 2), wdth: 100, color: i % 2 ? mc : s.col, cls: 'abs' }),
      x: 520 + rr() * 220, y: y0 + 160 + rr() * 220, t: tm + B(.25 + .3 * i), r: (rr() - .5) * 50 }));
    L.forEach((l, i) => i && b.f.cue(l.t, 'hit', .5));
    b.f.shake(tm, 12); b.f.bump(tm, .05); b.f.fast(tm, tm + .2, 10); b.f.cue(tm, 'impact', .8);
    minis.forEach(m => b.f.cue(m.t, 'pop', .3));
    const tot = L.reduce((a, l) => a + l.h, 0);
    return { g, update(t) {
      let y = y0 - tot / 2;
      L.forEach(l => {
        const u = tw(t, l.t, l.t + .18, E.outExpo);
        vis(l.e, t >= l.t - .01);
        set(l.e, 'transform', `translate(${(X0 - 140 * (1 - u)).toFixed(1)}px, ${(y + l.h / 2).toFixed(1)}px) translateY(-50%) scale(${l.fit.toFixed(4)})`);
        set(l.e, 'opacity', clamp(u * 3).toFixed(3));
        y += l.h;
      });
      const u = tw(t, tm, tm + .35, E.outBack), wob = Math.sin((t - tm) * 4.2) * 5 * clamp((t - tm) * 3);
      vis(M, t >= tm - .01);
      set(M, 'transform', at(W - 160 - (mw * .985 + msz * .26) * 1.08 / 2, y0 - 60, `rotate(${(lerp(40, 10, u) + wob).toFixed(2)}deg) scale(${lerp(.2, 1, u).toFixed(4)})`));
      for (const m of minis) {
        const v = tw(t, m.t, m.t + .25, E.outBack);
        vis(m.e, t >= m.t - .01);
        set(m.e, 'transform', at(m.x, m.y, `rotate(${(m.r + 6 * Math.sin((t - m.t) * 6)).toFixed(2)}deg) scale(${v.toFixed(4)})`));
      }
    } };
  },
  // the word slides in with a trail of outlines; the trail settles into an outline stack under it
  echo(b, s) {
    const size = s.size || 320, y = s.y || CY, dir = s.dir || -1, g = el('div', b.root, 'abs full');
    const trails = Array.from({ length: s.trail || 6 }, (_, i) => type(g, s.text, { size, wdth: s.wdth || 100, stroke: 2.5, color: rgba(s.col, .55 - i * .07), cls: 'abs' }));
    const L = letters(g, s.text, { size, wdth: s.wdth || 100, color: s.col, grad: s.grad, cls: 'abs' });
    const fit = fitTo(L.e.offsetWidth);
    return { g, counter: i => counterOf(L, i, CX, y, size * fit), update(t) {
      const a = t - s.t, u = tw(t, s.t, s.t + .3, E.outExpo);
      set(L.e, 'transform', at(CX + dir * 900 * (1 - u), y, `scale(${(fit * (1 + .03 * Math.min(a, 1))).toFixed(4)}) skewX(${(dir * 16 * (1 - u)).toFixed(2)}deg)`));
      trails.forEach((e, i) => {
        const ul = tw(t - (i + 1) * .035, s.t, s.t + .3, E.outExpo), settle = tw(t, s.t + .25, s.t + .6, E.outCubic);
        set(e, 'transform', at(CX + dir * 900 * (1 - ul), y + (i + 1) * size * .21 * fit * settle, `scale(${(fit * (1 + .03 * Math.min(a, 1))).toFixed(4)})`));
        set(e, 'opacity', (ul * lerp(1, .6, settle)).toFixed(3));
      });
    } };
  },
  // an italic serif word that blurs in and rises (ref5 "Watch.", "Animates."); [sans, serif] puts a sans line above
  serif(b, s) {
    const y = s.y || CY, size = s.size || 230, g = el('div', b.root, 'abs full');
    const [p0, p1] = Array.isArray(s.text) ? s.text : [null, s.text];
    const A = p0 ? type(g, p0, { size: size * .6, wdth: 100, wght: 800, color: s.col, cls: 'abs' }) : null;
    const S = type(g, p1, { font: 'Serif', size, weight: 400, color: cc(s.color2) || s.col, cls: 'abs' });
    S.style.fontStyle = 'italic'; S.style.letterSpacing = '-.01em'; S.style.textShadow = '0 10px 40px rgba(10,20,60,.28)';
    const fa = A ? fitTo(A.offsetWidth) : 1, fs = fitTo(S.offsetWidth), t2 = B(s.at + (s.second ?? (A ? .4 : 0)));
    return { g, update(t) {
      const a = t - s.t;
      if (A) {
        const u = tw(t, s.t, s.t + .35, E.outCubic);
        set(A, 'transform', at(CX, y - size * .45, `translateY(${(30 * (1 - u)).toFixed(1)}px) scale(${(fa * (1 + .02 * Math.min(a, 1))).toFixed(4)})`));
        set(A, 'opacity', u.toFixed(3)); set(A, 'filter', `blur(${(12 * (1 - u)).toFixed(1)}px)`);
      }
      const v = tw(t, t2, t2 + .45, E.outCubic);
      vis(S, t >= t2 - .01);
      set(S, 'transform', at(CX, A ? y + size * .22 : y, `translateY(${(40 * (1 - v)).toFixed(1)}px) scale(${(fs * (1 + .025 * Math.min(a, 1))).toFixed(4)})`));
      set(S, 'opacity', v.toFixed(3)); set(S, 'filter', `blur(${(18 * (1 - v)).toFixed(1)}px)`);
    } };
  },
});

// two brush strokes that draw on in 0.12 s each
function brushX(parent, x, y, w, h, color, width = 46) {
  const s = svg('svg', parent, { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'abs' });
  const path = (x0, y0, x1, y1, bend) => { const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2 - bend * .4; return `M${x0},${y0} Q${mx},${my} ${x1},${y1}`; };
  const P = [path(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 40), path(x + w / 2, y - h / 2 + 20, x - w / 2 + 10, y + h / 2, -50)].map(d => {
    const p = svg('path', s, { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' });
    const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return { p, L };
  });
  // hidden until it draws: a round cap leaves a dot on a zero-length dash
  return (t, t0) => P.forEach(({ p, L }, i) => { const u = tw(t, t0 + i * .14, t0 + i * .14 + .12, E.outCubic); set(p, 'visibility', u > 0 ? 'visible' : 'hidden'); set(p, 'strokeDashoffset', (L * (1 - u)).toFixed(1)); });
}
// XMark: crosses out what is under it (list it after the block it marks; the camera stays that block's)
export class XMark extends Scene {
  build() {
    const o = this.o;
    this.draw = brushX(this.root, o.x || CX, o.y || CY, o.w || 760, o.h || 520, cc(o.color) || C.hot, o.width || 46);
    this.f.cue(this.t0, 'whoosh', .5); this.f.cue(this.t0 + .14, 'whoosh', .45);
    this.f.shake(this.t0 + .12, 10); this.f.shake(this.t0 + .26, 12); this.f.bump(this.t0 + .26, .04);
  }
  update(t) { this.draw(t, this.t0); }
}

// ───────────────────────── B · Premium 3D (ref5) ─────────────────────────
// painted sky: gradient, sun glow and three cloud layers drifting at different speeds (puffs drawn once per layer)
const SKIES = {
  day: { top: '#2A58C8', mid: '#76A2EC', low: '#E7F0FF', sun: [.72, .18], sunCol: '#FFFFFF', shade: '#9FB3D9' },
  sunset: { top: '#2C3E92', mid: '#B9A6E0', low: '#FFD2B8', sun: [.3, .55], sunCol: '#FFE2C4', shade: '#B68FB5' },
};
// the painter is shared: Sky draws it full frame, Device can float its laptop in it ({ sky: 'day'|'sunset' })
class SkyPaint {
  constructor(root, o = {}) {
    const d = dsfNow();
    this.k = SKIES[o.mood || 'day']; this.d = d;
    this.c = el('canvas', root, 'abs full'); this.c.width = W * d; this.c.height = H * d; this.x = this.c.getContext('2d');
    // layers: [height band, drift px/s, puff scale, seed]; each puff = a shaded underside and a soft white top
    this.layers = [[.62, 14, .55, 1], [.74, 26, .8, 2], [.9, 46, 1.15, 3]].map(([yb, sp, sc, seed]) => {
      const lw = 2600, lh = 900, cv = el('canvas'); cv.width = lw * d; cv.height = lh * d;
      const x = cv.getContext('2d'); x.scale(d, d);
      const r = rng(seed * 101 + (o.seed || 0));
      const puff = (px, py, rad, j) => {
        for (const ox of [-lw, 0, lw]) {   // 3 copies across the seam, so the layer tiles
          const gx = x.createRadialGradient(px + ox, py - rad * .35, rad * .05, px + ox, py, rad);
          if (j === 0) { gx.addColorStop(0, rgba(this.k.shade, .5)); gx.addColorStop(1, rgba(this.k.shade, 0)); }
          else { gx.addColorStop(0, 'rgba(255,255,255,.96)'); gx.addColorStop(.5, 'rgba(255,255,255,.7)'); gx.addColorStop(1, 'rgba(255,255,255,0)'); }
          x.fillStyle = gx; x.beginPath(); x.arc(px + ox, py, rad, 0, 7); x.fill();
        }
      };
      for (let i = 0; i < 16; i++) {
        // one cumulus: small puffs piled in a dome over a flat, shaded base
        const cx = r() * lw, base = lh * (.55 + r() * .3), wid = (220 + r() * 380) * sc, hgt = wid * (.35 + r() * .35), P = [];
        for (let j = 0; j < 46; j++) {
          const u = r() * 2 - 1, dome = Math.sqrt(Math.max(0, 1 - u * u));
          P.push([cx + u * wid, base - dome * hgt * r(), (30 + r() * 70) * sc * (.6 + dome * .8)]);
        }
        P.sort((A, Bq) => Bq[1] - A[1]);
        for (const [px, py, rad] of P) puff(px, py + rad * .35, rad * 1.1, 0);   // shaded underside first
        for (const [px, py, rad] of P) puff(px, py, rad, 1);
      }
      // a soft haze along the base, so the layer reads as a sea of clouds
      const hz = x.createLinearGradient(0, lh * .6, 0, lh);
      hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(.5, 'rgba(255,255,255,.55)'); hz.addColorStop(1, 'rgba(255,255,255,.85)');
      x.fillStyle = hz; x.fillRect(0, lh * .6, lw, lh * .4);
      return { cv, lw, lh, yb, sp };
    });
  }
  draw(a) {
    const x = this.x, k = this.k, d = this.d;
    x.setTransform(d, 0, 0, d, 0, 0);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, k.top); g.addColorStop(.55, k.mid); g.addColorStop(1, k.low);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const sx = k.sun[0] * W, sy = k.sun[1] * H, sg = x.createRadialGradient(sx, sy, 0, sx, sy, 900);
    sg.addColorStop(0, rgba(k.sunCol, .9)); sg.addColorStop(.2, rgba(k.sunCol, .35)); sg.addColorStop(1, rgba(k.sunCol, 0));
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    for (const L of this.layers) {
      const off = ((a * L.sp) % L.lw + L.lw) % L.lw;
      for (const ox of [-off, L.lw - off]) x.drawImage(L.cv, ox - 400, L.yb * H - L.lh * .55, L.lw, L.lh);
    }
  }
}
export class Sky extends Scene {
  build() {
    this.noGrid = true;
    this.p = new SkyPaint(this.root, this.o);
    this.shots = makeShots(this, this.o.shots || [], this.k1);
  }
  cam(t) { const u = clamp((t - this.t0) / (this.t1 - this.t0)); return { s: 1 + .05 * E.inOutCubic(u), r: lerp(-.4, .4, u), y: lerp(10, -10, u) }; }
  update(t) { this.p.draw(t - this.t0); updShots(this.shots, t); }
}

// space: stars, the earth's limb with its blue atmosphere and a sunrise flare on the rim
export class Space extends Scene {
  build() {
    const o = this.o, d = dsfNow();
    this.noGrid = true;
    this.c = el('canvas', this.root, 'abs full'); this.c.width = W * d; this.c.height = H * d; this.x = this.c.getContext('2d'); this.d = d;
    const r = rng(o.seed || 5);
    this.stars = Array.from({ length: 420 }, () => [r() * W, r() * H * .8, r() * 1.6 + .3, r() * 6]);
    this.shots = makeShots(this, o.shots || [], this.k1);
    if (o.rise != null) this.f.cue(B(o.rise), 'whoosh_big', .5);
  }
  cam(t) { const u = clamp((t - this.t0) / (this.t1 - this.t0)); return { s: 1 + .06 * E.inOutCubic(u), r: lerp(.3, -.3, u) }; }
  update(t) {
    const x = this.x, d = this.d, a = t - this.t0, o = this.o;
    x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = '#02040A'; x.fillRect(0, 0, W, H);
    for (const [sx, sy, sr, ph] of this.stars) { x.fillStyle = `rgba(255,255,255,${(.45 + .35 * Math.sin(a * 2 + ph)).toFixed(3)})`; x.fillRect(sx, sy - a * 6, sr, sr); }
    // the limb rises a little (or from below, with `rise`)
    const rise = o.rise != null ? tw(t, B(o.rise), B(o.rise) + .9, E.outCubic) : 1;
    const R = H * 1.35, cx = CX, cy = (o.limb ?? .72) * H + R - 120 * a - 500 * (1 - rise);
    const glow = x.createRadialGradient(cx, cy, R * .97, cx, cy, R * 1.08);
    glow.addColorStop(0, 'rgba(70,150,255,0)'); glow.addColorStop(.35, 'rgba(90,170,255,.85)'); glow.addColorStop(.5, 'rgba(150,210,255,.55)'); glow.addColorStop(1, 'rgba(60,120,255,0)');
    x.fillStyle = glow; x.beginPath(); x.arc(cx, cy, R * 1.08, 0, 7); x.fill();
    const body = x.createRadialGradient(cx, cy - R * .9, R * .1, cx, cy, R);
    body.addColorStop(0, '#0E1C3A'); body.addColorStop(.85, '#061026'); body.addColorStop(1, '#2A5CB8');
    x.fillStyle = body; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
    // sunrise flare on the rim
    const fy = cy - R, fl = x.createRadialGradient(cx, fy, 0, cx, fy, 520);
    fl.addColorStop(0, `rgba(255,255,255,${.95 * rise})`); fl.addColorStop(.12, `rgba(200,230,255,${.6 * rise})`); fl.addColorStop(1, 'rgba(80,140,255,0)');
    x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = fl; x.fillRect(0, 0, W, H);
    x.fillStyle = `rgba(220,240,255,${.5 * rise})`; x.fillRect(0, fy - 2, W, 4); x.restore();
    updShots(this.shots, t);
  }
}

// a floating laptop (CSS 3D lid + keyboard base), optionally in a painted sky (`sky`); `screen`: { img } or { color, title } shown on it; `fly`: { at, to }
// flies the camera into the screen until it fills the frame (cut to a full-frame block of the same picture)
export class Device extends Scene {
  build() {
    const o = this.o, sw = o.sw || 820, sh = Math.round(sw * .64);
    this.sw = sw; this.sh = sh; this.py = o.y || CY - 60; this.noGrid = true;
    if (o.sky) this.bg = new SkyPaint(this.root, { mood: o.sky, seed: o.seed });
    this.root.classList.add('persp');
    this.wrap = el('div', this.root, 'abs p3d', { left: CX + 'px', top: this.py + 'px' });
    this.lid = el('div', this.wrap, 'abs dev-lid p3d', { width: sw + 40 + 'px', height: sh + 40 + 'px', left: -(sw + 40) / 2 + 'px', top: -(sh + 40) + 'px' });
    this.scr = el('div', this.lid, 'abs dev-scr', { width: sw + 'px', height: sh + 'px', left: '20px', top: '20px' });
    if (o.screen?.img) el('div', this.scr, 'abs full', { width: sw + 'px', height: sh + 'px', backgroundImage: `url(${o.screen.img})`, backgroundSize: 'cover', backgroundPosition: 'center' });
    else {
      set(this.scr, 'background', cc(o.screen?.color) || '#05070A');
      if (o.screen?.title) { const tt = type(this.scr, o.screen.title, { size: 70, wdth: 125, wght: 600, color: C.paper, ls: .35, cls: 'abs' }); tt.style.left = '50%'; tt.style.top = '50%'; tt.style.transform = 'translate(-50%,-50%)'; }
    }
    el('div', this.scr, 'abs dev-glare', { width: sw + 'px', height: sh + 'px' });
    this.base = el('div', this.wrap, 'abs dev-base', { width: sw + 120 + 'px', height: Math.round(sh * .72) + 'px', left: -(sw + 120) / 2 + 'px', top: '0px' });
    this.shadow = el('div', this.root, 'abs dev-shadow');
    if (o.fly) { this.fa = B(o.fly.at); this.f.cue(this.fa, 'whoosh_big', .7); this.f.fast(this.fa, this.t1, 10); this.f.smear(this.fa + .1, this.t1, 2); }
    this.shots = makeShots(this, o.shots || [], this.k1);
  }
  cam(t) {
    const u = clamp((t - this.t0) / (this.t1 - this.t0)), base = { s: 1 + .05 * E.inOutCubic(u), r: lerp(-.6, .6, u) };
    if (this.fa == null || t < this.fa) return base;
    // fly into the screen: scale about its centre until the screen is `to` x the frame width
    const z = tw(t, this.fa, this.t1, E.inOutCubic), S = lerp(base.s, (this.o.fly.to || 1.2) * W / this.sw, z), py = this.py - this.sh / 2 - 20;
    return { s: S, r: base.r * (1 - z), x: 0, y: (py - CY) * z };
  }
  update(t) {
    const a = t - this.t0, e = tw(t, this.t0, this.t0 + .6, E.outCubic), fz = this.fa != null ? tw(t, this.fa, this.t1, E.inOutCubic) : 0;
    if (this.bg) this.bg.draw(a);
    const ry = ((this.o.ry ?? -14) + 6 * Math.sin(a * .9)) * (1 - fz) ** 2, rx = 8 * (1 - fz) ** 2;
    set(this.wrap, 'transform', `translateY(${(10 * Math.sin(a * 1.3) + 120 * (1 - e)).toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`);
    set(this.wrap, 'opacity', clamp(e * 2).toFixed(3));
    set(this.lid, 'transform', `rotateX(${(-6 * (1 - fz)).toFixed(2)}deg)`);
    set(this.base, 'transform', `rotateX(${(78 - 4 * Math.sin(a * .9)).toFixed(2)}deg)`);
    set(this.base, 'opacity', (1 - fz).toFixed(3));
    set(this.shadow, 'transform', `translate(${CX}px, ${this.py + 260}px) translate(-50%,-50%) scale(${(1 - .05 * Math.sin(a * 1.3)).toFixed(3)})`);
    set(this.shadow, 'opacity', (.5 * e * (1 - fz)).toFixed(3));
    updShots(this.shots, t);
  }
}

// ───────────────────────── C · Playful story (ref4) ─────────────────────────
// glossy blob characters: { shape: 'squircle'|'ball'|'tag', color, x, y, size, enter: beat, moods: [[beat, 'sleep'|
// 'open'|'shock'|'happy']], look: [[beat, -1..1]], prop: 'coin'|'band', label (on a tag) }
function blobPath(shape, r) {
  if (shape === 'ball') return `M0,${-r} A${r},${r} 0 1 1 0,${r} A${r},${r} 0 1 1 0,${-r}Z`;
  if (shape === 'tag') { const w = r * 1.1, h = r * 1.3; return `M${-w},${-h + 40} Q${-w},${-h} ${-w + 40},${-h} L${w - 40},${-h} Q${w},${-h} ${w},${-h + 40} L${w},${h - 40} Q${w},${h} ${w - 40},${h} L${-w + 40},${h} Q${-w},${h} ${-w},${h - 40}Z`; }
  const k = r * .92;   // squircle
  return `M0,${-r} C${k},${-r} ${r},${-k} ${r},0 C${r},${k} ${k},${r} 0,${r} C${-k},${r} ${-r},${k} ${-r},0 C${-r},${-k} ${-k},${-r} 0,${-r}Z`;
}
let gradN = 0;
class Character {
  constructor(parent, c) {
    this.c = c; const r = 100, id = 'mg' + (gradN++);
    this.root = el('div', parent, 'abs masc');
    const s = svg('svg', this.root, { width: 360, height: 400, viewBox: '-180 -200 360 400', class: 'abs', style: 'left:-180px;top:-200px;overflow:visible' });
    const defs = svg('defs', s);
    const rg = svg('radialGradient', defs, { id, cx: '35%', cy: '28%', r: '80%' });
    [[0, mixc(c.color, '#FFFFFF', .45)], [.55, c.color], [1, mixc(c.color, '#000000', .3)]].forEach(([o, col]) => svg('stop', rg, { offset: o, 'stop-color': col }));
    const fb = svg('filter', defs, { id: id + 'b', x: '-50%', y: '-50%', width: '200%', height: '200%' }); svg('feGaussianBlur', fb, { stdDeviation: 7 });
    this.shadow = svg('ellipse', s, { cx: 0, cy: r * 1.18, rx: r * .9, ry: r * .16, fill: 'rgba(0,0,0,.22)', filter: `url(#${id}b)` });
    this.body = svg('g', s);
    if (c.shape === 'tag') svg('line', this.body, { x1: 0, y1: -r * 1.3, x2: -30, y2: -r * 1.9, stroke: '#555', 'stroke-width': 4 });
    svg('path', this.body, { d: blobPath(c.shape || 'squircle', r), fill: `url(#${id})` });
    svg('ellipse', this.body, { cx: -r * .38, cy: -r * .55, rx: r * .32, ry: r * .18, fill: 'rgba(255,255,255,.55)', filter: `url(#${id}b)`, transform: 'rotate(-25)' });
    if (c.shape === 'tag') svg('circle', this.body, { cx: 0, cy: -r * 1.05, r: 12, fill: 'rgba(0,0,0,.35)' });
    if (c.label) { const tl = svg('text', this.body, { x: 0, y: r * .62, 'text-anchor': 'middle', 'font-family': 'Archivo', 'font-size': 46, 'font-weight': 900, fill: '#FFFFFF' }); tl.textContent = c.label; }
    if (c.prop === 'band') svg('rect', this.body, { x: -r * .98, y: -r * .62, width: r * 1.96, height: r * .2, rx: 8, fill: '#FF5A5A' });
    if (c.prop === 'coin') { this.coin = svg('g', this.body); svg('circle', this.coin, { cx: 0, cy: -r * 1.22, r: r * .3, fill: '#F2A93B' }); svg('circle', this.coin, { cx: -r * .08, cy: -r * 1.3, r: r * .1, fill: 'rgba(255,255,255,.6)' }); }
    this.face = svg('g', this.body, { transform: `translate(0,${c.shape === 'tag' ? -r * .12 : r * .05})` });
    const eye = sx => ({ open: svg('g', this.face), sx });
    this.eyes = [-1, 1].map(sx => {
      const e = eye(sx);
      e.white = svg('ellipse', e.open, { cx: sx * r * .36, cy: -r * .12, rx: r * .2, ry: r * .24, fill: '#FFFFFF' });
      e.pupil = svg('ellipse', e.open, { cx: sx * r * .36, cy: -r * .08, rx: r * .11, ry: r * .13, fill: '#1C1530' });
      e.dot = svg('circle', e.open, { cx: sx * r * .36 - 5, cy: -r * .14, r: 5, fill: '#FFFFFF' });
      e.shut = svg('path', this.face, { d: `M${sx * r * .36 - r * .17},${-r * .1} Q${sx * r * .36},${r * .02} ${sx * r * .36 + r * .17},${-r * .1}`, fill: 'none', stroke: '#1C1530', 'stroke-width': 7, 'stroke-linecap': 'round' });
      e.happy = svg('path', this.face, { d: `M${sx * r * .36 - r * .17},${-r * .04} Q${sx * r * .36},${-r * .26} ${sx * r * .36 + r * .17},${-r * .04}`, fill: 'none', stroke: '#1C1530', 'stroke-width': 7, 'stroke-linecap': 'round' });
      return e;
    });
    [-1, 1].forEach(sx => svg('ellipse', this.face, { cx: sx * r * .55, cy: r * .2, rx: r * .14, ry: r * .08, fill: 'rgba(255,110,150,.5)' }));
    this.mSmile = svg('path', this.face, { d: `M${-r * .14},${r * .26} Q0,${r * .4} ${r * .14},${r * .26}`, fill: 'none', stroke: '#1C1530', 'stroke-width': 7, 'stroke-linecap': 'round' });
    this.mO = svg('ellipse', this.face, { cx: 0, cy: r * .33, rx: r * .09, ry: r * .12, fill: '#1C1530' });
    this.zz = type(this.root, 'z z', { size: 46, wdth: 100, color: rgba('#3A3060', .7), cls: 'abs' });
  }
  update(t, k) {
    const c = this.c, ta = B(c.enter ?? 0), a = t - ta;
    vis(this.root, a >= -.01);
    if (a < -.01) return;
    const mood = keyed(c.moods || [[0, 'open']], k, E.lin), look = keyed(c.look || [[0, 0]], k, E.outCubic, .3);
    // drop in, land with a squash, then a slow breathing bob
    const fall = tw(t, ta, ta + .32, E.inQuad), land = a - .32;
    const y = (c.y || CY) - 900 * (1 - fall) + (land > 0 ? 8 * Math.sin(land * 3) : 0);
    const sq = land > 0 ? .16 * Math.exp(-land * 7) * Math.cos(land * 22) : -.08 * fall;
    const sz = (c.size || 360) / 200;
    set(this.root, 'transform', `translate(${(c.x || CX).toFixed(1)}px, ${y.toFixed(1)}px) scale(${(sz * (1 + sq)).toFixed(4)}, ${(sz * (1 - sq)).toFixed(4)}) rotate(${(3 * Math.sin(a * 1.4)).toFixed(2)}deg)`);
    // blink every ~2.6 s (deterministic), sleep closes the eyes
    const blink = ((a + (c.phase || 0)) % 2.6) < .12, shut = mood === 'sleep' || blink, happy = mood === 'happy', shock = mood === 'shock';
    for (const e of this.eyes) {
      vis(e.open, !shut && !happy); vis(e.shut, shut && !happy); vis(e.happy, happy);
      e.white.setAttribute('ry', 100 * (shock ? .3 : .24)); e.white.setAttribute('rx', 100 * (shock ? .25 : .2));
      const px = e.sx * 36 + look * 16;
      e.pupil.setAttribute('cx', px.toFixed(1)); e.pupil.setAttribute('rx', 100 * (shock ? .07 : .11));
      e.dot.setAttribute('cx', (px - 5).toFixed(1));
    }
    vis(this.mSmile, mood !== 'shock' && mood !== 'sleep'); vis(this.mO, mood === 'shock' || mood === 'sleep');
    this.mO.setAttribute('ry', 100 * (shock ? .14 : .06));
    vis(this.zz, mood === 'sleep');
    set(this.zz, 'transform', `translate(${(90 + 10 * Math.sin(a * 2)).toFixed(1)}px, ${(-150 - (a * 30) % 40).toFixed(1)}px)`);
    if (this.coin) this.coin.setAttribute('transform', `translate(0,${(-6 * Math.abs(Math.sin(a * 2.2))).toFixed(1)})`);
  }
}
export class Mascot extends Scene {
  build() {
    const o = this.o;
    if (o.ground) this.f.ground(this.t0, this.t1, cc(o.ground));
    this.chars = (o.chars || []).map(c => new Character(this.root, c));
    for (const c of o.chars || []) {
      const tl = B(c.enter ?? 0) + .32;
      this.f.cue(tl, 'pop', .6); this.f.shake(tl, 7); this.f.bump(tl, .025);
      (c.moods || []).forEach(([k, m]) => { if (m === 'shock') { this.f.cue(B(k), 'hit', .5); this.f.shake(B(k), 9); } });
    }
    this.shots = makeShots(this, o.shots || [], this.k1);
  }
  update(t) { const k = kOf(t); for (const c of this.chars) c.update(t, k); updShots(this.shots, t); }
}

// a number that adds up in steps (`values`: [[beat, n]]), a pill under it, a receipt drifting behind
export class Count extends Scene {
  build() {
    const o = this.o, f = this.f, size = o.size || 250;
    this.y = o.y || CY;
    if (o.ground) f.ground(this.t0, this.t1, cc(o.ground));
    const ink = cc(o.color) || typeOn(o.ground);
    if (o.list) {
      this.rc = el('div', this.root, 'abs rcpt');
      for (const [a, v] of o.list) { const r = el('div', this.rc, 'rrow'); el('span', r).textContent = a; el('span', r).textContent = v; }
    }
    this.label = o.label ? type(this.root, o.label, { size: 70, wdth: 100, wght: 800, color: ink, cls: 'abs' }) : null;
    this.num = type(this.root, (o.prefix || '') + fmtNum(o.values[o.values.length - 1][1], o.dec || 0, o.sep) + (o.suffix || ''), { size, wdth: 100, color: ink, cls: 'abs' });
    this.num.style.fontVariantNumeric = 'tabular-nums';
    this.fit = fitTo(this.num.offsetWidth);
    this.pill = o.pill ? el('div', this.root, 'abs pill') : null;
    if (this.pill) { this.pill.textContent = o.pill; set(this.pill, 'background', cc(o.pillColor) || C.ink); set(this.pill, 'color', o.pillColor ? C.ink : C.paper); }
    o.values.forEach(([k], i) => { if (i) { f.cue(B(k), 'pop', .55); f.bump(B(k), .03); f.shake(B(k), 6); } });
    if (o.pill) f.cue(B(o.pillAt ?? this.k0 + .5), 'pop', .5);
    this.shots = makeShots(this, o.shots || [], this.k1);
  }
  update(t) {
    const o = this.o, k = kOf(t), v = keyed(o.values, k, E.outCubic, o.span || .3);
    this.num.textContent = (o.prefix || '') + fmtNum(v, o.dec || 0, o.sep) + (o.suffix || '');
    const last = o.values.filter(([kk]) => kk <= k).pop(), p = last ? punch(t, B(last[0]), 10) : 0;
    set(this.num, 'transform', at(CX, this.y, `scale(${(this.fit * (1 + .08 * p)).toFixed(4)})`));
    set(this.num, 'filter', p > .3 ? `blur(${(4 * (p - .3)).toFixed(1)}px)` : 'none');
    if (this.label) { const u = tw(t, this.t0, this.t0 + .3); set(this.label, 'transform', at(CX, this.y - (o.size || 250) * .72, `translateY(${(20 * (1 - u)).toFixed(1)}px)`)); set(this.label, 'opacity', u.toFixed(3)); }
    if (this.pill) {
      const tp = B(o.pillAt ?? this.k0 + .5), u = tw(t, tp, tp + .3, E.outBack);
      vis(this.pill, t >= tp - .01);
      set(this.pill, 'transform', at(CX + 140, this.y + (o.size || 250) * .55, `rotate(-3deg) scale(${u.toFixed(4)})`));
    }
    if (this.rc) set(this.rc, 'transform', `translate(${110}px, ${(this.y - 520 - 60 * (t - this.t0)).toFixed(1)}px) rotate(-4deg)`);
    updShots(this.shots, t);
  }
}

// a desk calendar that flips its month page down: { x, y, scale, year, months: [[beat, 'JUL'], ...] }
export class Cal extends Scene {
  build() {
    const o = this.o;
    this.card = el('div', this.root, 'abs cal p3d');
    el('div', this.card, 'cal-year').textContent = o.year || '';
    this.pages = o.months.map(([k, m]) => { const p = el('div', this.card, 'cal-page'); p.textContent = m; return { p, t: B(k) }; });
    el('div', this.card, 'cal-rings');
    this.pages.forEach((q, i) => i && this.f.cue(q.t, 'whoosh', .35));
  }
  update(t) {
    const o = this.o, a = t - this.t0, e = tw(t, this.t0, this.t0 + .3, E.outBack);
    set(this.card, 'transform', `translate(${o.x || CX}px, ${o.y || 520}px) translate(-50%,-50%) scale(${((o.scale || 1) * e).toFixed(4)}) rotate(${(2 * Math.sin(a * 1.2)).toFixed(2)}deg)`);
    // page i shows until page i+1 flips over it (rotateX about the top edge)
    this.pages.forEach((q, i) => {
      const nxt = this.pages[i + 1], fl = nxt ? tw(t, nxt.t, nxt.t + .28, E.inOutCubic) : 0;
      vis(q.p, t >= q.t - .01 && fl < 1);
      set(q.p, 'transform', `rotateX(${(-100 * fl).toFixed(2)}deg)`);
      set(q.p, 'zIndex', String(100 - i));
    });
  }
}

// a colour band sweeps across and cuts to the next block at its middle; scissors snip at its edge
// [Wipe, k - .35, k + .35, { color, angle, scissors }]; list it after both blocks so it draws on top
export class Wipe extends Scene {
  build() {
    const o = this.o;
    this.tc = (this.t0 + this.t1) / 2;
    this.f.cut(this.tc); this.f.cue(this.t0, 'whoosh', .7); this.f.fast(this.t0, this.t1, 8);
    this.band = el('div', this.root, 'abs wipe', { background: cc(o.color) || C.accent });
    if (o.scissors) {
      this.sc = el('div', this.root, 'abs');
      const s = svg('svg', this.sc, { width: 260, height: 260, viewBox: '-130 -130 260 260', class: 'abs', style: 'left:-130px;top:-130px' });
      this.blades = [1, -1].map(sg => {
        const gg = svg('g', s);
        svg('path', gg, { d: 'M-6,0 L120,-10 L124,0 L120,6Z', fill: '#E8ECEF', stroke: '#9AA3AB', 'stroke-width': 2 });
        svg('circle', gg, { cx: -52, cy: 22 * sg, r: 30, fill: 'none', stroke: cc(o.handle) || '#D6F000', 'stroke-width': 16 });
        svg('line', gg, { x1: -26, y1: 12 * sg, x2: -2, y2: 0, stroke: cc(o.handle) || '#D6F000', 'stroke-width': 16, 'stroke-linecap': 'round' });
        return { gg, sg };
      });
      svg('circle', s, { cx: 0, cy: 0, r: 7, fill: '#6B747C' });
      [.3, .6].forEach(q => this.f.cue(lerp(this.t0, this.t1, q), 'click', .5));
    }
  }
  cam() { return { s: 1, r: 0 }; }
  update(t) {
    const o = this.o, ang = o.angle ?? -24, u = tw(t, this.t0, this.t1, E.inOutCubic), D = 3200;
    // band centre travels from far left to far right through the stage centre at the cut
    const x = lerp(-D * .62, W + D * .62, u) - CX;
    set(this.band, 'transform', `translate(${CX}px, ${CY}px) rotate(${ang}deg) translate(${x.toFixed(1)}px, 0) translate(-50%,-50%)`);
    set(this.band, 'width', D + 'px'); set(this.band, 'height', '4200px');
    if (this.sc) {
      const lead = x + D / 2, rad = ang * Math.PI / 180, ex = CX + Math.cos(rad) * lead, ey = CY + Math.sin(rad) * lead;
      set(this.sc, 'transform', `translate(${ex.toFixed(1)}px, ${(ey + 120).toFixed(1)}px) rotate(${ang}deg)`);
      const open = 14 + 14 * Math.sin((t - this.t0) * 34);
      this.blades.forEach(({ gg, sg }) => gg.setAttribute('transform', `rotate(${(sg * open).toFixed(2)})`));
    }
  }
}

// ───────────────────────── all styles · UI rebuilt as vector cards ─────────────────────────
// { theme: 'dark'|'light', w, x, y, title, brand (accent dot colour), rows: [...], cursor: [[beat, rowIndex|[x, y]]],
//   strike: beat (an X over the card), shots }   rows (each may take `at`: beat it appears):
//   { kind: 'stat', label, value: n | [[beat, n]], prefix, suffix, dec }   { kind: 'item', icon, text, sub, value, pill,
//   pillColor, strike: beat }   { kind: 'progress', label, value: 0..1 | [[beat, v]] }   { kind: 'steps', items,
//   done: [beat per step] }   { kind: 'chips', items, active: [[beat, index]] }   { kind: 'button', text, press: beat }
//   { kind: 'text', text, size }
export class UI extends Scene {
  build() {
    const o = this.o, f = this.f, w = o.w || 900;
    if (o.ground) f.ground(this.t0, this.t1, cc(o.ground));
    this.root.classList.add('persp');
    this.wrap = el('div', this.root, 'abs p3d', { left: (o.x || CX) + 'px', top: (o.y || CY) + 'px' });
    this.card = el('div', this.wrap, `abs ui ui-${o.theme || 'dark'}`, { width: w + 'px' });
    if (o.title) {
      const hd = el('div', this.card, 'ui-head');
      el('span', hd, 'ui-dot', { background: cc(o.brand) || C.accent });
      el('span', hd, 'ui-title').textContent = o.title;
    }
    this.rows = (o.rows || []).map((r, i) => {
      const e = el('div', this.card, 'ui-row ui-' + r.kind), q = { r, e, t: B(r.at ?? this.k0 + .15 * i) };
      if (r.kind === 'stat') { el('div', e, 'ui-lbl').textContent = r.label || ''; q.v = el('div', e, 'ui-big'); }
      if (r.kind === 'item') {
        el('span', e, 'ui-ico', { background: cc(r.icon) || C.accent });
        const tx = el('span', e, 'ui-txt'); el('b', tx).textContent = r.text || ''; if (r.sub) el('i', tx).textContent = r.sub;
        if (r.pill) { const p = el('span', e, 'ui-pill', { background: cc(r.pillColor) || C.accent }); p.textContent = r.pill; }
        el('span', e, 'ui-val').textContent = r.value || '';
        if (r.strike != null) { q.line = el('div', e, 'ui-strike'); q.ts = B(r.strike); f.cue(q.ts, 'whoosh', .4); }
      }
      if (r.kind === 'progress') { el('div', e, 'ui-lbl').textContent = r.label || ''; const tr = el('div', e, 'ui-track'); q.bar = el('div', tr, 'ui-fill', { background: cc(o.brand) || C.accent }); }
      if (r.kind === 'steps') q.st = r.items.map((s, j) => { const d = el('span', e, 'ui-step'); const n = el('i', d); n.textContent = j + 1; el('span', d).textContent = s; return { d, n, t: r.done?.[j] != null ? B(r.done[j]) : 1e9 }; });
      if (r.kind === 'chips') q.ch = r.items.map(s => { const c = el('span', e, 'ui-chip'); c.textContent = s; return c; });
      if (r.kind === 'button') { e.textContent = r.text || ''; set(e, 'background', cc(o.brand) || C.accent); if (r.press != null) { q.tp = B(r.press); f.cue(q.tp, 'click', 1); f.shake(q.tp, 6); } }
      if (r.kind === 'text') { e.textContent = r.text || ''; e.style.fontSize = (r.size || 26) + 'px'; }
      (q.st || []).forEach(s => s.t < 1e8 && f.cue(s.t, 'pop', .4));
      f.cue(q.t, 'pop', .25);
      return q;
    });
    this.cur = o.cursor ? el('div', this.root, 'abs ui-cursor') : null;
    if (this.cur) this.cur.innerHTML = '<svg width="44" height="56" viewBox="0 0 22 28"><path d="M1 1 L1 22 L7 17 L11 26 L15 24 L11 15 L19 15 Z" fill="#fff" stroke="#111" stroke-width="1.6"/></svg>';
    this.ring = el('div', this.root, 'abs ui-ring');
    if (o.strike != null) this.xdraw = brushX(this.root, o.x || CX, o.y || CY, w * .9, 560, cc(o.strikeColor) || C.hot);
    if (o.strike != null) { f.cue(B(o.strike), 'whoosh', .5); f.shake(B(o.strike) + .26, 12); }
    f.cue(this.t0, 'whoosh', .5); f.fast(this.t0, this.t0 + .35, 8);
    this.shots = makeShots(this, o.shots || [], this.k1);
  }
  cam(t) { const u = clamp((t - this.t0) / (this.t1 - this.t0)); return { s: 1 + .05 * E.inOutCubic(u), r: lerp(-.8, .8, u), x: lerp(-20, 20, u) }; }
  // stage position of a row's centre (cursor targets)
  rowAt(i) {
    const q = this.rows[i], o = this.o, h = this.card.offsetHeight;
    return [(o.x || CX) - (o.w || 900) / 2 + q.e.offsetLeft + q.e.offsetWidth * .62, (o.y || CY) - h / 2 + q.e.offsetTop + q.e.offsetHeight * .55];
  }
  update(t) {
    const o = this.o, k = kOf(t), a = t - this.t0, e = tw(t, this.t0, this.t0 + .45, E.outExpo);
    set(this.wrap, 'transform', `translateZ(${lerp(-1300, 0, e).toFixed(1)}px) rotateX(${(lerp(18, 0, e) + (o.tilt?.[0] ?? 4) + 1.5 * Math.sin(a * 1.6)).toFixed(3)}deg) rotateY(${(lerp(-22, 0, e) + (o.tilt?.[1] ?? -6) + 3 * Math.sin(a * 1.1)).toFixed(3)}deg)`);
    set(this.wrap, 'opacity', clamp(e * 3).toFixed(3));
    set(this.card, 'transform', `translate(-50%,-50%)`);
    for (const q of this.rows) {
      const u = tw(t, q.t, q.t + .3, E.outCubic);
      set(q.e, 'opacity', u.toFixed(3)); set(q.e, 'transform', `translateY(${(26 * (1 - u)).toFixed(1)}px)`);
      if (q.v) q.v.textContent = (q.r.prefix || '') + fmtNum(keyed(q.r.value, k, E.outCubic, q.r.span || .5), q.r.dec || 0, o.sep) + (q.r.suffix || '');
      if (q.bar) set(q.bar, 'width', (100 * clamp(keyed(q.r.value, k, E.inOutCubic, q.r.span || 1))).toFixed(1) + '%');
      if (q.line) { const s = tw(t, q.ts, q.ts + .25, E.outCubic); set(q.line, 'width', (100 * s).toFixed(1) + '%'); set(q.e, 'filter', s > .9 ? 'grayscale(1)' : 'none'); set(q.e, 'opacity', (u * (1 - .55 * tw(t, q.ts + .25, q.ts + .6))).toFixed(3)); }
      if (q.st) q.st.forEach(s => s.d.classList.toggle('on', t >= s.t));
      if (q.ch) { const ai = keyed(q.r.active || [[0, -1]], k, E.lin); q.ch.forEach((c, j) => c.classList.toggle('on', j === Math.round(ai))); }
      if (q.tp != null) set(q.e, 'transform', `translateY(${(26 * (1 - u)).toFixed(1)}px) scale(${(1 - .06 * Math.exp(-14 * Math.max(0, t - q.tp)) * (t >= q.tp ? 1 : 0)).toFixed(4)})`);
    }
    // cursor glides between targets; the last press rings
    if (this.cur) {
      const keys = o.cursor.map(([kk, tg]) => [kk, Array.isArray(tg) ? tg : this.rowAt(tg)]);
      const xs = keys.map(([kk, p]) => [kk, p[0]]), ys = keys.map(([kk, p]) => [kk, p[1]]);
      const cx = keyed(xs, k + .45, E.inOutCubic, .45), cy = keyed(ys, k + .45, E.inOutCubic, .45);   // arrives on its key beat
      vis(this.cur, k >= o.cursor[0][0] - .01);
      set(this.cur, 'transform', `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`);
      const presses = this.rows.filter(q => q.tp != null && t >= q.tp).map(q => q.tp), lp = presses.length ? Math.max(...presses) : null;
      const rp = lp != null ? clamp((t - lp) / .45) : 1;
      vis(this.ring, rp < 1);
      if (rp < 1) { set(this.ring, 'transform', `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%,-50%) scale(${lerp(.3, 2.2, E.outCubic(rp)).toFixed(3)})`); set(this.ring, 'opacity', (1 - rp).toFixed(3)); set(this.ring, 'borderColor', cc(o.brand) || C.accent); }
    }
    if (this.xdraw) this.xdraw(t, B(o.strike));
    updShots(this.shots, t);
  }
}
