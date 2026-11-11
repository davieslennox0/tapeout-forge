"""Build terms.js from the captured terminal output (term*.txt), so the video's terminals show the real text."""
import json, pathlib
H = pathlib.Path(__file__).resolve().parent
L = lambda n: (H / f"term{n}.txt").read_text(encoding="utf8").rstrip("\n").split("\n")
t1, t3, t4, t5 = L(1), L(3), L(4), L(5)
terms = {
    "verify": {"cmd": t3[0][2:], "out": [l for l in t3[1:] if l.strip()]},
    "c1": {"cmd": t1[3][2:], "out": t1[4:7]},
    "c2": {"cmd": t4[0][2:], "out": t4[1:4]},
    "c3": {"cmd": t5[0][2:], "out": t5[1:2]},
}
(H / "terms.js").write_text("window.TERMS = " + json.dumps(terms, ensure_ascii=False) + ";\n", encoding="utf8")
print({k: len(v["out"]) for k, v in terms.items()})
