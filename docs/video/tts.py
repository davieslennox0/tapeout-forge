# Narration: Kokoro (kokoro-onnx, v1.0 int8 model, voice af_heart). Usage: tts.py <model.onnx> <voices.bin> <dir>
import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
model, voices, d = sys.argv[1:4]
k = Kokoro(model, voices)
for s in json.load(open(f"{d}/scenes.json")):
    samples, sr = k.create(s["text"], voice="af_heart", speed=1.0, lang="en-us")
    sf.write(f"{d}/n{s['id']}.wav", samples, sr)
    print(s["id"], round(len(samples) / sr, 1), flush=True)
