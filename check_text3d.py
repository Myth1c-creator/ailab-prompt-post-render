"""Text rules for the words that live inside the 3D picture of "prompt -> post" (cdp.mjs check only sees the DOM: the
captions). Every 3D word is screen-anchored (src/worlds/common.ts place()): its centre and width in px are set in the code,
so the margins are exact; this mirrors those numbers (hook.ts, boards.ts, photo.ts, cta.ts) and checks, for each word,
  EDGE  >= 170 px from the side edges at rest (with the push-ins, the punches and the sway at their worst) and at the
        peak of its slam (the user's rule: never at the edge, never across the whole width);
  SIZE  no word wider than 640 px at rest (FOLLOW <= 560), labels <= 260 px;
  DUP   no caption (capwords.json) while the same word is big on screen.
Words flying out of frame on a transition (JAK, the pile into the cut, the whips, the rushes) are motion, not rest
(sim_layout.mjs measures the projected boxes of every frame and exempts the same windows).
python check_text3d.py  ->  CHECK PASS / FAIL (and logs/text3d_check.json)
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
BPM, FPS, FRAMES = 104.11, 60, 1107
END = FRAMES / FPS
FONT = json.loads((HERE / "public/fonts/unbounded_800_clean.typeface.json").read_text(encoding="utf-8"))
G = FONT["glyphs"]
adv = lambda s: sum(G[c]["ha"] for c in s) / FONT["resolution"]  # noqa: E731


def gbox(ch):
    """the outline's box of one glyph (typeface.json 'o': m/l x y, q x y cx cy, b x y c1x c1y c2x c2y)"""
    nums = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", G[ch]["o"])]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), max(xs), min(ys), max(ys)


def aspect(ch):
    x0, x1, y0, y1 = gbox(ch)
    return (x1 - x0) / (y1 - y0)


f = lambda fr: fr / FPS  # noqa: E731
W = json.loads((HERE / "audio/vo-words.json").read_text(encoding="utf-8"))
ws = lambda w, n=0: [x for x in W if x["word"] == w][n]["start"]  # noqa: E731

# times (timing.ts)
LOCKUP, LAB, END_PUSH = f(840), f(867), 1 + 0.015 * (END - f(840))   # cta.ts PUSH at the last frame
two = lambda a, b, w: (w * adv(a) / max(adv(a), adv(b)), w * adv(b) / max(adv(a), adv(b)))  # noqa: E731
PV, PAI, PLAB = (480 * adv(x) / adv("LAB?") for x in ("V", "AI", "LAB?"))       # hook.ts: the pile on LAB?'s scale
NAP, PRO = two("NAPÍŠEŠ", "PROMPT", 520)
HOT, FOT = two("HOTOVÁ", "FOTKA", 520)
ZJ, PTU = two("Z JEDNOHO", "PROMPTU", 560)
BEZ = 480 * adv("BEZ") / adv("FOCENÍ")
ST, PN = two("STAČÍ JI", "POSTNOUT", 540)
W_DEJ, W_FOLLOW, W_PRO = 290, 500, 560   # cta.ts CTA.dej / follow / pro

# (text, shown from, to (s), centre x, sway (px), width at rest at its worst (px), width at the slam peak (px), rest cap)
WORDS = [
    ("JAK", 0.0, f(19), 540, 24, 380 * 1.016, 380 * 1.25, 560),
    ("VZNIKÁ", f(19), f(53), 540, 0, 560 * 1.017 * 1.05 + 44, 560 * 1.3, 640),   # +44: the 22 px glitch tick at 0.733 (at rest only)
    ("POST", f(53), f(72), 540, 0, 440 * 1.013 * 1.06, 440 * 1.4, 560),
    ("V", f(72), f(119), 540, 26, PV * 1.02 * 1.05, PV * 1.2, 400),
    ("AI", f(80), f(119), 540, 8, PAI * 1.02 * 1.05, PAI * 1.3, 400),
    ("LAB?", f(102), f(119), 540, 8, PLAB * 1.02 * 1.05, PLAB * 1.4 * 1.013, 560),
    ("NAPÍŠEŠ", f(132), f(204), 540, 0, NAP * 1.025 * 1.05, NAP * 1.3, 560),
    ("PROMPT", f(166), f(204), 540, 0, PRO * 1.014 * 1.05, PRO * 1.4, 560),
    ("4K", f(238), f(311), 540, 0, 340 * 1.025 * 1.05, 340 * 1.4, 400),
    ("GENEROVAT", f(347), f(393), 540, 0, 560 * 1.016 * 1.05, 560 * 1.22, 600),
    ("HOTOVÁ", ws("hotovou"), f(520), 540, 0, HOT * 1.026 * 1.05, HOT * 1.28, 560),
    ("FOTKA", ws("fotku"), f(520), 540, 0, FOT * 1.018 * 1.06, FOT * 1.45, 560),
    ("Z JEDNOHO", ws("Z"), f(607), 540, 0, ZJ * 1.03 * 1.05, ZJ * 1.3, 600),
    ("PROMPTU", ws("promptu"), f(607), 540, 0, PTU * 1.02 * 1.05, PTU * 1.4, 560),
    ("BEZ", f(621), f(675), 540, 0, BEZ * 1.02 * 1.05, BEZ * 1.3, 400),
    ("FOCENÍ", ws("focení"), f(675), 540, 0, 480 * 1.015 * 1.05, 480 * 1.4, 560),
    ("BEZ", ws("bez"), f(746), 540, 0, BEZ * 1.022 * 1.05, BEZ * 1.3, 400),
    ("ATELIÉRU", ws("ateliéru"), f(746), 540, 0, 540 * 1.016 * 1.05, 540 * 1.22, 600),
    ("STAČÍ JI", ws("Stačí"), f(830), 540, 0, ST * 1.023 * 1.05, ST * 1.3, 560),
    ("POSTNOUT", ws("postnout"), f(830), 540, 0, PN * 1.015 * 1.05, PN * 1.22, 600),
    ("DEJ", ws("Dej"), END, 540, 10, W_DEJ * END_PUSH * 1.07, W_DEJ * 1.25, 560),
    ("FOLLOW", LAB, END, 540, 0, W_FOLLOW * END_PUSH * 1.03 * 1.03, W_FOLLOW * 1.3 * (1 + 0.015 * (LAB - LOCKUP)), 560),
    ("PRO VÍC NOVINEK", ws("pro"), END, 540, 0, W_PRO * END_PUSH * 1.03 + 20, W_PRO * 1.012 + 20, 640),
    # the logo lockup: mark 170 px at x 352 (pop 160 %) + the wordmark 330 px at x 632 -> 267..797, pushed in around x 540
    ("AI LAB (logo)", LOCKUP, END, 532, 0, 2 * (540 - 267) * END_PUSH, 2 * (540 - (352 - 0.8 * 170)), 640),
    # the post card's own header (kit.ts mkCard: "AI LAB" 46 px at canvas x 122-262 of 800, the card 640 px wide at x 540)
    ("AI LAB (post)", f(762), f(830), 540 - 320 + 192 * 0.8, 6, 140 * 0.8 * 1.1, 140 * 0.8 * 1.35, 260),
]
norm = lambda s: "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()  # noqa: E731

caps = [(w, a * 60 / BPM, b * 60 / BPM) for w, a, b in json.loads((HERE / "capwords.json").read_text(encoding="utf-8"))]
edge, size, dup, margins = [], [], [], {}
for text, t0, t1, cx, sway, w_rest, w_slam, cap in WORDS:
    for kind, w in (("rest", w_rest), ("slam", w_slam)):
        m = min(cx - sway - w / 2, 1080 - (cx + sway + w / 2))
        margins[f"{text} {kind}"] = round(m)
        if m < 170 - 1e-6:
            edge.append({"text": text, "kind": kind, "margin": round(m), "width": round(w)})
    if w_rest / 1.1 > cap:
        size.append({"text": text, "width": round(w_rest), "cap": cap})
    toks = set(norm(text).replace(".", "").replace("?", "").split())
    for cw, a, b in caps:
        if a < t1 and b > t0 and (norm(cw) in toks or (len(cw) >= 4 and norm(cw) in norm(text))):
            dup.append({"caption": cw, "t": [round(a, 3), round(b, 3)], "word": text})
res = {"end_push": round(END_PUSH, 4), "edge": edge, "size": size, "dup": dup, "margins": margins}
(HERE / "logs").mkdir(exist_ok=True)
(HERE / "logs" / "text3d_check.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
for e in edge:
    print(f"EDGE  {e['text']} ({e['kind']}): {e['margin']} px, {e['width']} px wide (min 170)")
for s in size:
    print(f"SIZE  {s['text']}: {s['width']} px (cap {s['cap']})")
for d in dup:
    print(f"DUP   caption '{d['caption']}' {d['t']} under '{d['word']}'")
print("min margin", min(margins.values()), "px;", "CHECK PASS" if not edge and not dup and not size else "CHECK FAIL")
