"""Automatic quality gates for a finished 9:16 ad (any engine: kinetic, Remotion, three.js).

python tools/qa_gates.py <video.mp4> [--frames N] [--end-card S] [--guides 0,0.5,1,1.5] [--out DIR] [--json report.json]

Technique: resolution 1080x1920 (or 2160x3840), fps, frame count (--frames), size under 1 GB, H.264 level
(4.2 for 1080, 5.2 for 4K), a clean full decode, loudness -14 LUFS +-1 and true peak <= -1 dBTP, no black
stretches over 0.1 s, no frozen stretch over 0.6 s.
Dynamism before the end card (from the scenario-kinetic-film skill, measured at 180x320 on every frame):
still frames (under 1.5 % of the frame changing) 40 % or less, no hold over 0.6 s, median motion
2.5 px/frame or more; cuts per 10 s is reported.
--guides writes stills with the user's text margins drawn on them (150 px from the side edges, caption band)
into --out, for the visual check. Prints ALL GATES PASS or exits 1.
"""
import argparse
import json
import os
import re
import subprocess
import sys

import cv2
import numpy as np


def probe(f, entries):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "json", f], capture_output=True, text=True)
    return (json.loads(r.stdout or "{}").get("streams") or [{}])[0]


def motion(src, t1=None, w=180, h=320):
    """Per-frame changed area, flow (px/frame at 1080 wide) and brightness change."""
    args = ["ffmpeg", "-v", "error", "-i", src]
    if t1:
        args += ["-t", str(t1)]
    p = subprocess.Popen(args + ["-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    prev, A, F, DL = None, [], [], []
    while True:
        b = p.stdout.read(w * h)
        if len(b) < w * h:
            break
        g = np.frombuffer(b, np.uint8).reshape(h, w)
        if prev is not None:
            d = cv2.absdiff(g, prev)
            fl = cv2.calcOpticalFlowFarneback(prev, g, None, .5, 3, 15, 3, 5, 1.2, 0)
            mag = np.hypot(fl[..., 0], fl[..., 1])
            m = (d > 10) | (cv2.Laplacian(g, cv2.CV_16S) != 0)
            A.append(float((d > 24).mean()))
            F.append(float(mag[m].mean() * 1080 / w) if m.any() else 0.0)
            DL.append(abs(float(g.mean()) - float(prev.mean())))
        prev = g
    p.wait()
    return np.array(A), np.array(F), np.array(DL)


def runs(mask):
    out, s0 = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and s0 is None:
            s0 = i
        if not v and s0 is not None:
            out.append((s0, i - s0))
            s0 = None
    return out


def guides(src, times, out):
    """Stills with the margin guides: red = 150 px side margins, blue = caption band (y 1420-1540 at 1080x1920)."""
    os.makedirs(out, exist_ok=True)
    paths = []
    for t in times:
        p = os.path.join(out, f"guide_{t:05.2f}s.jpg")
        vf = ("scale=1080:1920,drawbox=x=150:y=0:w=3:h=1920:color=red@0.9:t=fill,drawbox=x=927:y=0:w=3:h=1920:color=red@0.9:t=fill,"
              "drawbox=x=0:y=1420:w=1080:h=3:color=0x3399ff@0.9:t=fill,drawbox=x=0:y=1540:w=1080:h=3:color=0x3399ff@0.9:t=fill")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", vf, "-q:v", "3", p], check=True)
        paths.append(p)
    return paths


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--frames", type=int, help="expected frame count")
    ap.add_argument("--end-card", type=float, help="seconds where the end card starts (dynamism stops there)")
    ap.add_argument("--guides", help="comma-separated seconds for margin-guide stills")
    ap.add_argument("--out", default=".")
    ap.add_argument("--json")
    a = ap.parse_args()
    f, ok, rep = a.video, True, {}

    def check(label, cond, detail):
        nonlocal ok
        ok &= bool(cond)
        rep[label] = {"pass": bool(cond), "detail": detail}
        print(f"  {'PASS' if cond else 'FAIL'}  {label}: {detail}")

    s = probe(f, "stream=width,height,r_frame_rate,level,codec_name,pix_fmt")
    W, H = int(s.get("width", 0)), int(s.get("height", 0))
    num, den = map(int, s.get("r_frame_rate", "0/1").split("/"))
    fps = num / den if den else 0
    print(os.path.basename(f), f"{W}x{H} {fps:g} fps {s.get('codec_name')} {s.get('pix_fmt')}")
    check("resolution", (W, H) in [(1080, 1920), (2160, 3840)], f"{W}x{H}")
    n = int(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f],
                           capture_output=True, text=True).stdout.strip() or 0)
    check("frames", a.frames is None or n == a.frames, f"{n}" + (f" of {a.frames}" if a.frames else ""))
    sz = os.path.getsize(f)
    check("size", sz < 1e9, f"{sz / 1e6:.0f} MB")
    lvl, top = int(s.get("level") or 0), (52 if H > 2000 else 42)
    check("H.264 level", s.get("codec_name") == "h264" and 0 < lvl <= top, f"{lvl / 10:.1f} (max {top / 10:.1f})")
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "null", "-"], capture_output=True, text=True)
    errs = [l for l in r.stderr.splitlines() if l.strip()]
    check("full decode", not errs, "clean" if not errs else errs[0][:90])
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    m, pk = re.findall(r"I:\s+(-?[\d.]+) LUFS", r), re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
    check("loudness", m and -15 <= float(m[-1]) <= -13, f"{m[-1] if m else '?'} LUFS (target -14 +-1)")
    check("true peak", pk and float(pk[-1]) <= -1.0, f"{pk[-1] if pk else '?'} dBTP (max -1)")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-vf", "blackdetect=d=0.1:pix_th=0.05", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    blk = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r)
    check("black stretches", not blk, "none" if not blk else ", ".join(f"{float(x):.2f}-{float(y):.2f}s" for x, y in blk[:4]))

    A, F, DL = motion(f, a.end_card)
    still = A < .015
    holds = [(s0 / fps, k / fps) for s0, k in runs(still) if k / fps > .6]
    cuts = int(((A > .45) & ((DL > 18) | (A > .6))).sum())
    secs = len(A) / fps if fps else 0
    print("dynamism" + (f" (before the end card at {a.end_card:g} s)" if a.end_card else ""))
    check("still frames", still.mean() <= .4, f"{still.mean() * 100:.0f}% (target 40% or less)")
    check("holds over 0.6 s", not holds, "none" if not holds else "; ".join(f"{t:.2f}s for {d:.2f}s" for t, d in holds[:4]))
    check("median motion", np.median(F) >= 2.5, f"{np.median(F):.2f} px/frame (target 2.5 or more)")
    rep["cuts_per_10s"] = round(cuts / secs * 10, 1) if secs else 0
    print(f"  info  cuts per 10 s: {rep['cuts_per_10s']}, longest still {max([k for _, k in runs(still)] or [0]) / fps:.2f} s")
    if a.guides:
        ps = guides(f, [float(x) for x in a.guides.split(",")], a.out)
        print("  info  margin-guide stills (read them):", ", ".join(ps))
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump(rep, fh, indent=1)
    print("ALL GATES PASS" if ok else "SOME GATES FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
