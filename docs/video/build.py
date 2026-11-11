# Builds the title card and the terminal scenes (term1..4.html) from the captured term*.txt files. Usage: build.py <dir>
import html, re, sys
d = sys.argv[1]
CSS = """body{margin:0;background:#0a0a0b;color:#d3d8de;font:22px/1.5 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;width:1280px;height:720px;overflow:hidden}
.wrap{padding:56px 64px}h1{color:#f4f6f9;font-size:60px;line-height:1.08;letter-spacing:-.03em;margin:18px 0}
.eye{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.06);color:#8b929a;font-size:18px}
.dim{color:#8b929a}.brand{font-weight:700;font-size:30px;color:#f4f6f9}
pre{background:#0f1012;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:24px 28px;font:17px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d3d8de;white-space:pre-wrap;word-break:break-all;margin:22px 0 0}
.g{color:#6b9e7d;font-weight:600}.c{color:#f4f6f9}"""
LABEL = {1: "CLI · real output", 2: "FabX replay · committed table, top 7 of 46 rows shown", 3: "Independent verifier · real output, middle rows elided", 4: "Live eth_call against X Layer mainnet"}
HI = r"(verified: true|match: true|beat 22 / tie 11 / lose 13|gates=6 depth=4|Cref=496000 bestC=28672 q=4\.000|22 tasks, 25856 output-bit comparisons, 0 mismatches\.)"
for i in range(1, 5):
    out = []
    for line in open(f"{d}/term{i}.txt", encoding="utf8").read().rstrip("\n").split("\n"):
        e = html.escape(line)
        out.append(f'<span class=c>{e}</span>' if line.startswith("$") else re.sub(HI, r"<span class=g>\1</span>", e))
    open(f"{d}/term{i}.html", "w", encoding="utf8").write(
        f"<!doctype html><meta charset=utf-8><style>{CSS}</style><div class=wrap><span class=eye>{LABEL[i]} · captured 2026-11-11</span><pre>" + "\n".join(out) + "</pre></div>")
open(f"{d}/title.html", "w", encoding="utf8").write(
    f"<!doctype html><meta charset=utf-8><style>{CSS}</style><div class=wrap><div class=brand>ForgeOut</div>"
    "<h1 style='margin-top:120px'>Cheaper TapeOut circuits,<br>checked identical.</h1>"
    "<p class=dim>An optimizer and equivalence checker for TapeOut circuits on X Layer · forgeout.xyz</p>"
    "<p class=dim style='font-size:18px;margin-top:150px'>Recorded from the live site and real terminal output. Narration is synthetic (Kokoro).</p></div>")
