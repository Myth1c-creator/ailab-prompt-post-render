// Every time of the film (PROMPT.md "SCHVÁLENO 2026-11-10"). The film = the song cut A (pyro, 104.11 BPM, doba 0.5763 s,
// DROP 6.916 after a 0.33 s gap; audio/cut.json, 18.442 s) with Jana's ONE continuous take (audio/vo.wav, never moved
// or cut): "Jak vzniká post v AI LAB? Napíšeš prompt. Zvolíš čtyři ká. Klikneš na generovat. A máš hotovou fotku.
// Z jednoho promptu. Bez focení, bez ateliéru. Stačí ji postnout. Dej follow pro víc novinek."
// Two kinds of anchors, both whole frames at 60 fps:
//   - big words come with Jana's words (vo-words.json, the frame nearest the word's start: W()),
//   - hard changes (cuts, flashes, punches, shakes) sit on the song: big hits on `kicks` (K()), the rest on `beats`
//     (Bt()), both rounded to the nearest frame (±1 f). The half beat between two beats is Hb().
// mix.py, kinetic/spec.js and check_text3d.py mirror these frames.
import words from "../../audio/vo-words.json";
import cut from "../../audio/cut.json";

export const FPS = 60;
export const FRAMES = 1107; // 18.450 s (the cut is 18.442 s)
export const BPM = cut.bpm; // 104.11
export const BEAT = 60 / BPM;
export const fr = (f: number) => f / FPS;

type Word = { word: string; start: number; end: number };
const WD = words as Word[];
// the n-th occurrence (0-based) of a word in the take
export const word = (w: string, n = 0) => {
  const x = WD.filter((q) => q.word === w)[n];
  if (!x) throw new Error(`vo-words.json: no "${w}" #${n}`);
  return x;
};
export const W = (w: string, n = 0) => Math.round(word(w, n).start * FPS); // frame of a word's start
export const K = (i: number) => Math.round(cut.kicks[i] * FPS); // frame of kick i
export const Bt = (i: number) => Math.round(cut.beats[i] * FPS); // frame of beat i
export const Hb = (i: number) => Math.round(((cut.beats[i] + cut.beats[i + 1]) / 2) * FPS); // the half beat after beat i
export const DROP = Math.round(cut.drop * FPS); // 415 (6.917; the song's hit 6.916)

// world boundaries (first frame of each): hook | app boards + tunnel | THE DROP | Z JEDNOHO PROMPTU | details | post | CTA
export const F = { app: K(2), drop: DROP, morph: K(12), det: Bt(18) - 1, post: K(21), cta: K(24) }; // 132 415 520 621 762 840

// frames (the comment gives the second and its anchor)
export const T = {
  // ── hook: JAK already landing on frame 0, over the notebook shot ──
  jak: 0, //            0.000  "Jak" 0.028
  vznika: W("vzniká"), // 19  0.317  "vzniká" 0.318 (whip in; the shot cuts to the keys)
  vznikaPunch: K(0), //   27  0.450  kick
  hookBeat: Bt(1), //     35  0.583  beat: punch
  hookKick: K(1), //      44  0.733  kick: a glitch tick on the shot
  post: W("post"), //     53  0.883  "post" 0.876 (lime, flash; the shot cuts to the screen)
  postPunch: Bt(2), //    69  1.150  beat
  v: W("v"), //           72  1.200  "v" 1.201: the pile V / AI / LAB? starts (the shot cuts wide)
  ai: W("AI"), //         80  1.333  "AI" 1.328
  lab: W("LAB"), //      102  1.700  "LAB" 1.700: LAB? slams lime
  labPunch: Bt(3), //    104  1.733  beat: punch, the "?" overshoots
  ramp0: K(2) - 13, //   119  the pile rushes at the camera (speed ramp) into the cut
  // ── the app (real recording on 3D boards) ──
  flyIn: K(2), //        132  2.200  kick: the prompt board flies in out of the depth; NAPÍŠEŠ ("Napíšeš" 2.187)
  landed: Bt(4), //      138  2.300  beat: the board has landed
  macro: K(3), //        165  2.750  kick: macro push-in onto the prompt field
  prompt: W("prompt"), // 166 2.767  "prompt" 2.768: PROMPT
  macroIn: Bt(5), //     173  2.883  beat: the macro has landed, punch
  typBeat: Hb(5), //     190  3.167  half beat: a small punch (the typing runs on)
  whip: Bt(6), //        207  3.450  beat: WHIP to the resolution board ("Zvolíš" 3.395)
  resPunch: K(4), //     226  3.767  kick: punch
  k4: W("čtyři"), //     238  3.967  "čtyři" 3.964: 4K slams lime
  click4k: Bt(7), //     242  4.033  beat: the click on the 4K chip (the recording's own click), tap ring
  kaBeat: Hb(7), //      259  4.317  half beat ("ká" 4.347): a small punch
  k4Punch: K(5), //      277  4.617  kick: macro punch onto the chip + sweep
  resHalf: Hb(8), //     294  4.900  half beat: a sweep over the chips
  glitch: Bt(9), //      311  5.183  beat: GLITCH to the Generovať board ("Klikneš" 5.102)
  genPunch: K(6), //     314  5.233  kick: the board lands
  clickGen: Bt(10), //   346  5.767  beat: the click on Generovať (the recording's own click), tap ring
  gen: W("generovat"), // 347 5.783  "generovat" 5.775: GENEROVAT
  dive: Bt(10) + 2, //   348  the camera dives through the lime button
  tunnel: Bt(10) + 7, // 353  5.883  the tunnel of light, full frame
  tunKick: K(7), //      381  6.350  kick: the tunnel accelerates, punch
  genOut: 393, //             6.550  "generovat" ends 6.553: the word is pulled into the light
  // ── THE DROP: "A máš hotovou fotku" ──
  drop: DROP, //         415  6.917  the tunnel's white = the flash; shake, shock wave; the photo over the whole frame
  hotova: W("hotovou"), // 443 7.383 "hotovou" 7.377: HOTOVÁ
  hotovaPunch: K(9), //  451  7.517  kick: punch
  fotka: W("fotku"), //  468  7.800  "fotku" 7.795: FOTKA slams lime
  fotkaPunch: K(10), //  469  7.817  kick: ring, shake
  dropBeat: K(11), //    485  8.083  kick: punch + sweep
  dropHalf: Hb(14), //   501  8.350  half beat: a small punch
  // ── Z JEDNOHO PROMPTU: the prompt line turns into the photo ──
  wipe: K(12), //        520  8.667  kick: a lime band WIPES the photo away; the typed prompt line flies in
  zjed: W("Z"), //       532  8.867  "Z" 8.863: Z JEDNOHO
  morph: K(13), //       554  9.233  kick: the line opens into the photo (mask + morph)
  promptu: W("promptu"), // 568 9.467 "promptu" 9.467: PROMPTU slams lime
  morphed: K(14), //     589  9.817  kick: fully grown, punch + sweep, brackets
  rush: K(15), //        607  10.117 kick: the photo rushes at the camera (zoom-through into its detail)
  // ── BEZ FOCENÍ / BEZ ATELIÉRU: details of the photo ──
  det: Bt(18) - 1, //    621  10.350 beat (10.374, -1 f): the face detail; BEZ ("Bez" 10.314)
  foceni: W("focení"), // 633 10.550 "focení" 10.558: FOCENÍ slams lime
  det2: K(17), //        658  10.967 kick: hard cut to a tighter detail (sunglasses, smile), shake
  whipBg: K(18), //      677  11.283 kick: WHIP pan to the background (the houses and the palms)
  bez2: W("bez"), //     682  11.367 "bez" 11.371: BEZ
  bgPunch: Bt(20), //    692  11.533 beat: punch
  atel: W("ateliéru"), // 698 11.633 "ateliéru" 11.626: ATELIÉRU slams lime
  det4: K(19), //        721  12.017 kick: punch-in cut to the sea
  det4Beat: Bt(21), //   726  12.100 beat: a small punch
  pull: K(20), //        746  12.433 kick: the camera pulls back to the whole photo (speed ramp)
  // ── STAČÍ JI POSTNOUT: the photo lands in the post frame ──
  land: K(21), //        762  12.700 kick: the photo drops into the post frame (AI LAB's own design)
  staci: W("Stačí"), //  763  12.717 "Stačí" 12.718: STAČÍ JI
  landed2: 772, //            12.867 the photo is in the frame (shake)
  cardPunch: K(22), //   796  13.267 kick: the card punches
  postnout: W("postnout"), // 797 13.283 "postnout" 13.287: POSTNOUT slams lime
  heart: K(23), //       817  13.617 kick: the heart pops
  heartBeat: Bt(24), //  830  13.833 beat: punch; the card starts rushing at the camera
  // ── CTA: DEJ / FOLLOW / PRO VÍC NOVINEK ──
  lockup: K(24), //      840  14.000 kick: the AI LAB lockup slams (flash, ring)
  dej: W("Dej"), //      852  14.200 "Dej" 14.192: DEJ
  ramp1: W("follow") - 6, // 861 anticipation (pull back 2 %), FOLLOW charges
  follow: W("follow"), // 867 14.450 "follow" 14.448 (kick 14.425 = 866): FOLLOW slams lime 130 -> 100 %
  pro: W("pro"), //      891  14.850 "pro" 14.842: a smear writes PRO VÍC NOVINEK
  ctaPunch: K(27), //    900  15.000 kick: small punch
  sweep1: Bt(27), //     934  15.567 beat: a sweep over FOLLOW
  speechEnd: 966, //          16.100 Jana's last word ends 16.096
  sweep2: Bt(28), //     968  16.133 beat: a sweep over the logo (the last new thing)
  calm: 980, //               16.333 nothing new from here (the clean end card, gentle motion to the end)
  fade0: 1089, //             18.150 the music's own 0.3 s fade-out
  end: FRAMES,
};

// the same moments in seconds (what the worlds' update(t) works in)
export const S = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v / FPS])) as Record<keyof typeof T, number>;
export const FS = Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v / FPS])) as Record<keyof typeof F, number>;
