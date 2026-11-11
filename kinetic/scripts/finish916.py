# finish916.py <video.mp4> <master.wav> <info.json> <dest> <name>
# The skill's finish.py for a native 9:16 film: muxes the audio without -shortest, makes a 1080x1920 version from a 4K
# master, and checks every file (frame count, size under 1 GB, H.264 level 5.2 or lower, a clean full decode, loudness
# -16 to -12 LUFS) and the film's dynamism before the end card (still frames 40 % or less, no hold over 0.6 s,
# median motion 2.5 px/frame or more). Prints ALL CHECKS PASS or exits 1.
import sys, os, re, json, subprocess
here = os.path.dirname(os.path.abspath(__file__))
video, audio, info_p, dest, name = sys.argv[1:6]
info = json.load(open(info_p))
os.makedirs(dest, exist_ok=True)
fps = info['fps']; expected = round(info['dur'] * fps)
END_CARD = float(os.environ.get('END_CARD', '12.27'))   # the logo card starts at beat 20.3
probe = lambda f, e: subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', e, '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip()
h = int(probe(video, 'stream=height'))
mux = ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k']
outs = []
master = os.path.join(dest, f'{name}_{"4k" if h > 2000 else str(h) + "p"}{fps}.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, *mux, '-c:v', 'copy', '-movflags', '+faststart', master], check=True)
outs.append(master)
if h > 2000:
    p = os.path.join(dest, f'{name}_1080p{fps}.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, *mux, '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow',
                    '-level', '4.2', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', p], check=True)
    outs.append(p)
ok = True
def check(label, cond, detail):
    global ok
    ok &= bool(cond); print(f"  {'PASS' if cond else 'FAIL'}  {label}: {detail}")
for f in outs:
    print(os.path.basename(f), probe(f, 'stream=width,height,r_frame_rate').replace('\n', ' '))
    n = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip() or 0)
    check('frames', n == expected, f'{n} of {expected}')
    sz = os.path.getsize(f); check('size', sz < 1e9, f'{sz / 1e6:.0f} MB')
    lvl = int(probe(f, 'stream=level') or 0); check('H.264 level', 0 < lvl <= 52, f'{lvl / 10:.1f}')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'null', '-'], capture_output=True, text=True)
    errs = [l for l in r.stderr.splitlines() if l.strip()]
    check('full decode', not errs, 'clean' if not errs else errs[0][:90])
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); pk = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)
    check('loudness', m and -16 <= float(m[-1]) <= -12, f'{m[-1] if m else "?"} LUFS, true peak {pk[-1] if pk else "?"} dBFS')
src = outs[-1]
d = json.loads(subprocess.run([sys.executable, os.path.join(here, 'dyn.py'), src, '0', str(END_CARD), os.path.join(dest, 'dynamism.json')], capture_output=True, text=True).stdout)
print('dynamism (before the end card)')
check('still frames (under 1.5% of the frame changing)', d['still_share'] <= .4, f"{d['still_share'] * 100:.0f}% (target 40% or less)")
hl = subprocess.run([sys.executable, os.path.join(here, 'holds.py'), src, '.5', str(info['bpm'])], capture_output=True, text=True).stdout.splitlines()
long = [l for l in hl if 's (beat' in l and float(l.split(')')[1].split('s')[0]) > .6 and float(l.split('s')[0]) < END_CARD]
check('holds longer than 0.6 s', not long, 'none' if not long else '; '.join(x.strip() for x in long[:4]))
check('median motion', d['median_flow'] >= 2.5, f"{d['median_flow']} px/frame (target 2.5 or more)")
print(f"cuts per 10 s: {d['cuts_per_10s']}, full-frame colour flips: {d['flips']}, longest hold {d['longest_hold_s']} s")
print('\n'.join(hl[-12:]))
print('ALL CHECKS PASS' if ok else 'SOME CHECKS FAILED')
sys.exit(0 if ok else 1)
