// spec.js: AI LAB "prompt -> post" as a kinetic film, native 9:16, 60 fps, 104.11 BPM, 1107 frames (18.450 s).
// The picture is one 3D film (src/Film.tsx: hook 0-131, the app + the tunnel 132-414, THE DROP 415-519, Z JEDNOHO
// PROMPTU 520-620, the details 621-761, the post 762-839, CTA + logo 840-1106; rendered as public/hook/hook_###.jpg by
// the workflow's "hook" job) played full frame by Seq3D; every big word (JAK · VZNIKÁ · POST · V AI LAB?, NAPÍŠEŠ PROMPT,
// 4K, GENEROVAT, HOTOVÁ FOTKA, Z JEDNOHO PROMPTU, BEZ FOCENÍ, BEZ ATELIÉRU, STAČÍ JI POSTNOUT, DEJ, FOLLOW, PRO VÍC
// NOVINEK), the app boards, the photo, the post card and the logo are inside the 3D. On top: the one-word captions in a
// white box (ad-captions: ../capwords.json in beats at 104.11 BPM; none under a word that is big on screen, none in the
// CTA). The engine adds bloom and grain (post.py, BLOOM_LOCAL=1). Cuts mirror src/worlds/timing.ts and mix.py; the mix
// itself is kinetic/audio/master.wav (mix.py), the cues here only feed info.json and the checks.
import { Seq3D } from './blocks.js';

const FPS = 60, FRAMES = 1107, BPM = 104.11;
const capWords = await fetch('../capwords.json').then(r => r.json());
// the hard changes (timing.ts T, frames): the hook's word cuts, the fly-in, the whip, the glitch, the tunnel, THE DROP,
// the wipe, the morph, the detail cuts and the whip pan, the landing in the post, the lockup, FOLLOW
const cuts = [19, 53, 72, 132, 207, 311, 353, 415, 520, 554, 621, 658, 677, 721, 762, 840, 867].map(f => f / FPS);

export default {
  title: 'AI LAB – od promptu k postu',
  bpm: BPM, beats: FRAMES * BPM / 3600, fps: FPS,
  palette: { bg: '#0B0D10', paper: '#ECEEF0', accent: '#C6FF00', hot: '#FF2A2A', ink: '#0B0D10' },
  hud: false,
  cues: [],
  scenes: [
    [Seq3D, 0, FRAMES * BPM / 3600, { seq: '../public/hook/hook_', n: FRAMES, cuts }],
  ],
  captions: [],
  // one word at a time in a white box: [[word, beat0, beat1]] (ad-captions, ../capwords.json)
  capWords,
};
