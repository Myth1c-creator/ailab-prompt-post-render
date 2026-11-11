# ailab-prompt-post (render only)

AI LAB "co všechno umí appka": 1080x1920, 60 fps, 18.450 s (1107 frames). Rendered only in GitHub Actions
(`.github/workflows/kinetic.yml`): the 3D film (Remotion + three.js, `src/`) as frame chunks, the kinetic layer
(captions, local bloom, grain) over it, the mix muxed in, the checks and the stills in the per-run release `run-<id>`.

    gh workflow run kinetic.yml -f res=540     # preview (half size, same checks)
    gh workflow run kinetic.yml -f res=1080    # final Full HD
