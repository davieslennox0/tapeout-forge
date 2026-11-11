# Demo video

`forgeout-demo.mp4` (2:25, 1280×720) is attached to the GitHub release `demo-video`:
https://github.com/davieslennox0/tapeout-forge/releases/download/demo-video/forgeout-demo.mp4

- **How it was recorded:** headless Chromium on the **live** site (forgeout.xyz) on 2026-11-11. `rec.mjs` drives the DevTools
  screencast at 15 fps and pipes it to ffmpeg. In scene 3 the script selects the Area objective and clicks Optimize in the page.
- **The terminal scenes:** real output captured on 2026-11-11 (`term1.txt` to `term4.txt`); `build.py` turns them into pages.
  `term2` shows the first 9 lines of `forge replay`, and `term3` elides the middle rows of the verifier's output (marked `...`).
  The `$ forge ...` prompts stand for `pnpm exec tsx packages/cli/src/index.ts ...`.
- **Narration:** synthetic, generated with Kokoro (kokoro-onnx, v1.0 int8 model, voice `af_heart`) from the `text` fields in
  `scenes.json` (`tts.py`). Names are spelled phonetically there ("Forge Out", "Fab X") for pronunciation.
- **Reproduce:** `python3 build.py <dir>`, `python tts.py <model.onnx> <voices.bin> <dir>`, `node rec.mjs <dir>`, then
  concatenate `scene1.mp4` to `scene10.mp4` with ffmpeg. Use a short `TMPDIR`: Chromium refuses long socket paths.
