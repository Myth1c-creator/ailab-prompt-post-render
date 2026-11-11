// cdp.mjs: drive the film in headless Chrome over the DevTools protocol (no Playwright needed: Chrome + Node 22).
// The 9:16 replacement for the skill's browser.mjs / render.mjs / snap.mjs / info.mjs. It serves the project folder
// (the film lives in kinetic/, the pictures in public/), opens kinetic/index.html at 1080x1920 x dsf and:
//   node cdp.mjs info <out.json>                     title, duration, fps, bpm, cuts and every sound cue
//   node cdp.mjs snap <outdir> <dsf> <t|bBeat> ...   stills (JPEG) at seconds or beats
//   node cdp.mjs frames <dsf> <f0> <f1> [maxS] [q]   stream for post.py: per frame u32 k, u32 n, n x (u32 len, jpeg)
//   node cdp.mjs check <out.json> [step] [margin]    text rules (the user): every main word ≥ margin px from the side
//                                                    edges, no one-word caption under the same word on screen
// Motion blur sampling is the skill's: a forward 180° shutter (longer in smear windows), never across a hard cut.
// CHROME overrides the browser binary; ROOT the folder served (default: the folder above kinetic/); SPEC another spec file.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.ROOT || path.join(here, '..', '..'));
const W = 1080, H = 1920;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function chromeBin() {
  if (process.env.CHROME) return process.env.CHROME;
  const c = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  const hit = c.find(p => fs.existsSync(p));
  if (!hit) { console.error('no Chrome found: set CHROME'); process.exit(2); }
  return hit;
}

async function launch(dsf) {
  const prof = fs.mkdtempSync(path.join(process.env.PROFILE_DIR || os.tmpdir(), 'kf-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', '--run-all-compositor-stages-before-draw', '--disable-checker-imaging', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${W},${H + 200}`, `--force-device-scale-factor=${dsf}`];
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu');
  // Chrome picks a free port and prints "DevTools listening on ws://127.0.0.1:<port>/..." on stderr
  const proc = spawn(chromeBin(), [...args, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '', port = null;
  proc.stderr.on('data', d => { log += d; const m = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(log); if (m) port = +m[1]; });
  let ws = null;
  for (let i = 0; i < 400 && !ws; i++) {
    await new Promise(r => setTimeout(r, 150));
    if (!port) continue;
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws = list.find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  }
  if (!ws) { proc.kill(); throw new Error('Chrome did not open a debugging port\n' + log.slice(-1500)); }
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const wait = new Map(), errs = [];
  sock.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { const [r, j] = wait.get(d.id); wait.delete(d.id); d.error ? j(new Error(d.error.message)) : r(d.result); }
    else if (d.method === 'Runtime.exceptionThrown') errs.push('PAGE ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('CONSOLE ' + d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
    else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errs.push('LOG ' + d.params.entry.text.slice(0, 200) + ' ' + (d.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; wait.set(i, [r, j]); sock.send(JSON.stringify({ id: i, method, params })); });
  const close = () => { try { sock.close(); } catch {} proc.kill(); setTimeout(() => fs.rmSync(prof, { recursive: true, force: true }), 500); };
  return { send, errs, close };
}

async function evaluate(send, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function openFilm(dsf) {
  const srv = await serve();
  const b = await launch(dsf);
  const { send } = b;
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: +dsf, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/kinetic/index.html?render=1${process.env.SPEC ? '&spec=' + process.env.SPEC : ''}` });
  for (let i = 0; i < 600; i++) {
    if (await evaluate(send, 'window.__ready === true').catch(() => false)) break;
    if (i === 599) throw new Error('film did not load: ' + JSON.stringify(b.errs.slice(0, 5)));
    await new Promise(r => setTimeout(r, 100));
  }
  return { ...b, srv, close: () => { b.close(); srv.close(); } };
}

const seekShot = async (send, t, dsf, q) => {
  await evaluate(send, `window.__seekP(${t}).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))`);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: +q, optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });   // the page's device scale factor already gives dsf x the pixels
  return Buffer.from(data, 'base64');
};

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'info') {
  const f = await openFilm(1);
  const info = await evaluate(f.send, '({ title: __film.title, dur: __film.dur, fps: __film.fps, bpm: __film.bpm, cuts: __film.cuts, cues: __film.cues })');
  if (f.errs.length) console.error('page errors:', f.errs.slice(0, 8));
  const s = JSON.stringify(info);
  if (rest[0]) fs.writeFileSync(rest[0], s); else console.log(s);
  f.close(); process.exit(0);
} else if (cmd === 'snap') {
  const [out, dsf = '1', ...ts] = rest;
  fs.mkdirSync(out, { recursive: true });
  const f = await openFilm(dsf);
  const bpm = await evaluate(f.send, '__film.bpm');
  for (const raw of ts) {
    const t = raw.startsWith('b') ? +raw.slice(1) * 60 / bpm : +raw;
    fs.writeFileSync(path.join(out, `t_${t.toFixed(3).padStart(7, '0')}.jpg`), await seekShot(f.send, t, dsf, 88));
  }
  console.log(f.errs.length ? 'ERRORS ' + JSON.stringify(f.errs.slice(0, 8)) : 'no errors');
  f.close(); process.exit(0);
} else if (cmd === 'frames') {
  const [DSF, F0, F1, MAXS = '99', Q = '95'] = rest;
  const f = await openFilm(DSF);
  const { cuts, fps } = await evaluate(f.send, '({ cuts: __film.cuts, fps: __film.fps })');
  const DT = .5 / fps, out = process.stdout, st = Date.now();
  const write = buf => new Promise(r => out.write(buf) ? r() : out.once('drain', r));
  for (let k = +F0; k < +F1; k++) {
    const t = k / fps;
    const sh = await evaluate(f.send, `window.__shutter(${t})`);
    let st0 = t, end = t + DT * sh;
    for (const c of cuts) if (c > t + 1e-6 && c < end) { end = c - 1e-4; st0 = Math.max(end - DT * sh, t - DT * sh); }
    for (const c of cuts) if (c > st0 && c <= t) st0 = c;
    const n = Math.min(+MAXS, await evaluate(f.send, `window.__samples(${st0}, ${end - st0})`));
    await evaluate(f.send, `window.__frameT = ${t}`);
    const hdr = Buffer.alloc(8); hdr.writeUInt32LE(k, 0); hdr.writeUInt32LE(n, 4); await write(hdr);
    for (let j = 0; j < n; j++) {
      const jb = await seekShot(f.send, n === 1 ? t : st0 + (end - st0) * j / (n - 1), DSF, Q), lb = Buffer.alloc(4);
      lb.writeUInt32LE(jb.length, 0); await write(lb); await write(jb);
    }
    if ((k - F0) % 60 === 0) process.stderr.write(`[${F0}-${F1}] frame ${k} ${((Date.now() - st) / 1000).toFixed(0)}s\n`);
  }
  if (f.errs.length) process.stderr.write('PAGE ERRORS ' + JSON.stringify(f.errs.slice(0, 5)) + '\n');
  await new Promise(r => out.end(r));
  f.close(); process.exit(0);
} else if (cmd === 'eval') {
  // debugging: node cdp.mjs eval <t> "<js expression>"  (seeks to t, prints the value)
  const [t, expr] = rest;
  const f = await openFilm(1);
  await evaluate(f.send, `__seekP(${+t})`);
  console.log(JSON.stringify(await evaluate(f.send, `(async () => (${expr}))()`), null, 1));
  f.close(); process.exit(0);
} else if (cmd === 'check') {
  const [out, step = '0.1', margin = '150'] = rest;
  const f = await openFilm(1);
  const r = await evaluate(f.send, `(async () => {
    const W = 1080, M = ${+margin}, dur = __film.dur, film = __filmObj;
    const norm = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^\\p{L}\\p{N}]/gu, '').toLowerCase();
    const alpha = e => { let a = 1; for (let n = e; n && n !== document.body; n = n.parentElement) a *= +getComputedStyle(n).opacity; return a; };
    const shown = e => e.getClientRects().length > 0 && alpha(e) > .3;
    const edge = [], dup = [];
    for (let t = 0; t < dur; t += ${+step}) {
      await __seekP(t);
      if ((film.camNow?.s || 1) > 1.3) continue;              // flying through a letter: not a resting word
      const big = [...document.querySelectorAll('.stage .type')].filter(e => {
        const cs = getComputedStyle(e);
        return shown(e) && !(cs.webkitTextStroke && parseFloat(cs.webkitTextStrokeWidth) > 0 && cs.color === 'rgba(0, 0, 0, 0)');   // ghost rows
      });
      for (const e of big) {
        const b = e.getBoundingClientRect();
        if (b.right <= 0 || b.left >= W || b.width < 2) continue;  // off stage (flying in)
        const lo = Math.round(Math.min(b.left, W - b.right));
        if (lo < M) edge.push({ t: +t.toFixed(2), text: e.textContent.trim().slice(0, 40), left: Math.round(b.left), right: Math.round(W - b.right) });
      }
      const words = big.map(e => norm(e.textContent)), tokens = new Set(big.flatMap(e => e.textContent.split(/\s+/).map(norm)));
      for (const c of document.querySelectorAll('.wcw')) {
        if (!shown(c)) continue;
        const w = norm(c.textContent);
        // the same word: a whole word on screen, or (4+ letters) inside a bigger line
        if (w && (tokens.has(w) || (w.length >= 4 && words.some(x => x.includes(w))))) dup.push({ t: +t.toFixed(2), caption: c.textContent.trim() });
      }
    }
    return { edge, dup };
  })()`);
  // report runs (a word that crosses the margin for one sample while it flies in is no finding; ≥ 0.2 s is)
  const runs = (list, key) => { const R = []; for (const x of list) { const l = R[R.length - 1]; if (l && l.key === x[key] && x.t - l.t1 <= +step * 1.5) { l.t1 = x.t; l.worst = Math.min(l.worst, x.left ?? 1e9, x.right ?? 1e9); } else R.push({ key: x[key], t0: x.t, t1: x.t, worst: Math.min(x.left ?? 1e9, x.right ?? 1e9) }); } return R.filter(q => q.t1 - q.t0 >= .2 - 1e-6 || key === 'caption'); };
  const res = { margin: +margin, edge: runs(r.edge, 'text'), dup: runs(r.dup, 'caption') };
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  for (const q of res.edge) console.log(`EDGE  ${q.t0.toFixed(2)}–${q.t1.toFixed(2)} s  "${q.key}"  ${q.worst} px from the edge (min ${margin})`);
  for (const q of res.dup) console.log(`DUP   ${q.t0.toFixed(2)}–${q.t1.toFixed(2)} s  caption "${q.key}" repeats a word on screen`);
  console.log(res.edge.length || res.dup.length ? 'CHECK FAIL' : 'CHECK PASS');
  if (f.errs.length) console.error('page errors:', f.errs.slice(0, 5));
  f.close(); process.exit(res.edge.length || res.dup.length ? 3 : 0);
} else {
  console.error('usage: node cdp.mjs info|snap|frames|check ...'); process.exit(1);
}
