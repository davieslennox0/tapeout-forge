# Demo video

`forgeout-demo.mp4` (2:43, 1920×1080, with a voice-over) is attached to the GitHub release `demo-video`:
https://github.com/davieslennox0/tapeout-forge/releases/download/demo-video/forgeout-demo.mp4

It explains the product to a newcomer, an investor and a developer: why gates cost money, the three steps (optimize, prove,
tape out), the FabX replay result, the command line tool, the silicon path, and the limits.

## What is real and what is drawn

- **The website scenes are real screenshots** of https://forgeout.xyz, captured by `capture.py` on 2026-11-11. The optimizer
  is driven for real: the script selects the Area objective and clicks Optimize, and the result shown is what the page returned.
- **The terminal scenes show real output**, captured on 2026-11-11 (`term1.txt` to `term5.txt`). Long lines are cut short on
  screen, and the verifier's middle rows are elided (marked `...`). The `forge ...` prompts stand for
  `pnpm exec tsx packages/cli/src/index.ts ...`.
- **Drawn for the video:** the gate tiles in "Every gate costs you" (marked *Illustration*; 12 and 8 are not measurements),
  the truth table of the 3-input majority, the 100-dot picture of the task bank (counts from `docs/FABX-REPLAY.md`), and the
  GC-012 bars (496,000 and 28,672, drawn to scale).
- **Silicon:** the scene shows the site's own section and the required wording. Tapeout-ready export. We have not ordered
  fabrication. Ordering is a separate paid step that the circuit owner completes on Tiny Tapeout. We do not claim a physical
  chip exists.
- **Narration:** synthetic, generated with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) (v1.0 int8 model, voice
  `af_heart`, speed 1.08). `narration.py` holds the script; names are spelled phonetically in `say` for pronunciation.

## The voice-over and the sync

`tts.py` speaks each line, measures how long it really takes, and writes one continuous `narration.wav` plus `timeline.js`.
The video is driven by those measurements: every frame is a pure function of time (`engine.js`, `setT(t)`), so captions
appear as the words are spoken and each click, tick and bar lands when the voice says it. There are no per-scene audio cuts.

## Rebuild it

```
cd docs/video
python3 capture.py                      # fresh screenshots of the live site (needs chromium, python websockets)
python3 make_terms.py                   # terms.js from term*.txt
KOKORO_DIR=<model dir> python tts.py    # voice and timings (pip install kokoro-onnx soundfile); unchanged lines are reused
python3 render.py video 24              # renders 1080p frames into ffmpeg and writes forgeout-demo.mp4
```

`python3 render.py preview 5 30 60` saves single frames at those seconds. Use a short `TMPDIR`: Chromium refuses long socket paths.
