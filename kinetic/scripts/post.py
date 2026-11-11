# post.py <dsf> <frame0> <frame1> <out.mp4> [fps]   (one render worker; the workflow runs one per chunk and joins them)
# The skill's post.py on a 9:16 stage: cdp.mjs streams each frame's sub-samples, this averages them (motion blur),
# adds bloom (bright pass at quarter resolution, two radii) and deterministic grain, and encodes.
# ENC overrides the encoder (default: 4K H.264 CRF 12.4 preset slower Level 5.2, 1080 CRF 15 Level 4.2).
import sys, struct, subprocess, os, numpy as np, cv2
dsf, f0, f1, out = float(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
fps = sys.argv[5] if len(sys.argv) > 5 else '60'
W, H = int(1080 * dsf), int(1920 * dsf)
here = os.path.dirname(os.path.abspath(__file__))
level = '5.2' if H > 2000 else '4.2'
enc = os.environ.get('ENC') or (f'-c:v libx264 -crf 12.4 -preset slower -level {level} -rc-lookahead 40' if H > 2000
                                else f'-c:v libx264 -crf 15 -preset slow -level {level}')
node = subprocess.Popen(['node', os.path.join(here, 'cdp.mjs'), 'frames', str(dsf), str(f0), str(f1)], stdout=subprocess.PIPE, bufsize=1 << 24)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', fps, '-i', '-',
                       *enc.split(), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], stdin=subprocess.PIPE)
def rd(n):
    b = node.stdout.read(n)
    return b if b is not None and len(b) == n else None
GRAIN = float(os.environ.get('GRAIN', '2.2'))
# bloom: BLOOM gain (default .75), BLOOM_T threshold (default 175); BLOOM_LOCAL=1 raises the threshold to the local mean
# + 45, so a big bright ground (paper, lime) does not bloom, only highlights brighter than their surroundings do
BLOOM, BLOOM_T, BLOOM_LOCAL = float(os.environ.get('BLOOM', '.75')), float(os.environ.get('BLOOM_T', '175')), os.environ.get('BLOOM_LOCAL', '0') == '1'
grain = [np.random.default_rng(i).normal(0, 1, (H // 2, W // 2)).astype(np.float32) for i in range(8)]
s = dsf / 2
done = 0
while True:
    h = rd(8)
    if h is None: break
    k, n = struct.unpack('<II', h)
    acc = None
    for _ in range(n):
        L = struct.unpack('<I', rd(4))[0]
        img = cv2.imdecode(np.frombuffer(rd(L), np.uint8), cv2.IMREAD_COLOR).astype(np.float32)
        acc = img if acc is None else acc + img
    img = acc / n
    small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    thr = np.maximum(BLOOM_T, cv2.GaussianBlur(small, (0, 0), 30 * s) + 45) if BLOOM_LOCAL else BLOOM_T
    br = np.clip(small - thr, 0, None)
    bl = .6 * cv2.GaussianBlur(br, (0, 0), 5 * s) + .4 * cv2.GaussianBlur(br, (0, 0), 20 * s)
    img += cv2.resize(bl, (W, H), interpolation=cv2.INTER_LINEAR) * BLOOM
    if GRAIN: img += cv2.resize(grain[k % 8], (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * GRAIN
    ff.stdin.write(np.clip(img + .5, 0, 255).astype(np.uint8).tobytes())
    done += 1
ff.stdin.close(); ff.wait(); node.wait()
print(f'{out}: {done} frames (expected {f1 - f0})', flush=True)
sys.exit(0 if done == f1 - f0 and ff.returncode == 0 else 1)
