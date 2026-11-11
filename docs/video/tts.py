"""Speak every line of narration.py with Kokoro, measure each one, and build:
   timeline.js / timeline.json   the scene and line timings the video is driven by (the visuals follow the voice)
   narration.wav                 ONE continuous voice track, each line placed at its start time (no per-scene cuts)
Run with an environment that has `kokoro-onnx` and `soundfile`:  KOKORO_DIR=<dir with the model files> python tts.py
Model files (kokoro-v1.0.int8.onnx or kokoro-v1.0.onnx, and voices-v1.0.bin):
https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)."""
import json, os, pathlib, wave
import numpy as np
from kokoro_onnx import Kokoro

from narration import GAP, LEAD, SCENES, TAIL

HERE = pathlib.Path(__file__).resolve().parent
MODELS = pathlib.Path(os.environ["KOKORO_DIR"])
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
SPEED = float(os.environ.get("KOKORO_SPEED", "1.08"))   # a touch brisker: reads as a presenter
OUT = HERE / "audio"; OUT.mkdir(exist_ok=True)
model = next(p for p in (MODELS / "kokoro-v1.0.onnx", MODELS / "kokoro-v1.0.int8.onnx", MODELS / "kokoro.onnx") if p.exists())
voices = next(p for p in (MODELS / "voices-v1.0.bin", MODELS / "voices.bin") if p.exists())
kokoro = Kokoro(str(model), str(voices))


def speak(text, path):
    audio, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    audio = np.clip(audio, -1, 1).astype(np.float32)
    # trim dead air, keep a little room, and fade both edges so no line starts or ends with a click
    loud = np.nonzero(np.abs(audio) > 0.004)[0]
    if len(loud):
        audio = audio[max(0, loud[0] - int(.03 * sr)): min(len(audio), loud[-1] + int(.12 * sr))]
    f = int(.012 * sr); g = int(.06 * sr)
    audio[:f] *= np.linspace(0, 1, f); audio[-g:] *= np.linspace(1, 0, g)
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    return pcm, sr, len(pcm) / sr


CFILE = OUT / "cache.json"
CACHE = json.loads(CFILE.read_text()) if CFILE.exists() else {}
t = 0.0
timeline, clips, SR = [], [], None
for sc in SCENES:
    a = t
    cur = a + LEAD
    lines = []
    for i, ln in enumerate(sc["lines"]):
        f = OUT / f"{sc['id']}_{i}.wav"; key = f"{VOICE}|{SPEED}|{ln['say']}"
        if f.exists() and CACHE.get(f.name) == key:      # unchanged line: reuse the clip
            with wave.open(str(f)) as w:
                SR = w.getframerate(); wav = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16); dur = len(wav) / SR
        else:
            wav, SR, dur = speak(ln["say"], f); CACHE[f.name] = key; CFILE.write_text(json.dumps(CACHE, indent=0))
        lines.append({"a": round(cur, 3), "b": round(cur + dur, 3), "dur": round(dur, 3), "show": ln["show"], "ev": ln.get("ev")})
        clips.append((cur, wav))
        cur += dur + GAP
        print(sc["id"], i, round(dur, 1), flush=True)
    b = max(cur - GAP + TAIL, a + sc["min"])
    timeline.append({"id": sc["id"], "a": round(a, 3), "b": round(b, 3), "lines": lines})
    t = b

total = round(t, 3)
track = np.zeros(int(total * SR) + SR // 2, dtype=np.int16)
for start, wav in clips:
    i = int(start * SR)
    track[i:i + len(wav)] = np.clip(track[i:i + len(wav)].astype(np.int32) + wav, -32768, 32767).astype(np.int16)
with wave.open(str(HERE / "narration.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(track.tobytes())

(HERE / "timeline.json").write_text(json.dumps({"total": total, "scenes": timeline}, indent=1))
(HERE / "timeline.js").write_text("window.TL = " + json.dumps({"total": total, "scenes": timeline}) + ";\n")
print(f"voice {VOICE} speed {SPEED}  total {total}s")
