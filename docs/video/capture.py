"""Capture the live site (https://forgeout.xyz) section by section for the demo: real screenshots, 2x so text stays sharp.
Writes assets/shot_*.png and rects.js (where the optimizer's controls sit inside its screenshot, for the pointer).
The optimizer is driven for real: the Area objective is selected and Optimize is clicked in the page."""
import asyncio, base64, json, pathlib, subprocess, tempfile, urllib.request
import websockets

HERE = pathlib.Path(__file__).resolve().parent
(HERE / "assets").mkdir(exist_ok=True)
W, PORT = 1040, 9343
proc = subprocess.Popen(["chromium", "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    f"--remote-debugging-port={PORT}", f"--user-data-dir={tempfile.mkdtemp(dir='/root/tmp')}", "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def main():
    for _ in range(120):
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=2)); break
        except Exception:
            await asyncio.sleep(0.5)
    url = next(t["webSocketDebuggerUrl"] for t in tabs if t["type"] == "page")
    async with websockets.connect(url, max_size=200_000_000) as ws:
        n = 0

        async def send(m, **p):
            nonlocal n; n += 1; i = n
            await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i:
                    return r.get("result", r)

        async def ev(e):
            return (await send("Runtime.evaluate", expression=e, returnByValue=True, awaitPromise=True)).get("result", {}).get("value")

        async def rect(sel):
            return await ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return {{x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}}}})()")

        async def shot(name, sel, pad=0, maxh=None):
            # make the viewport as tall as the page, so the clip is inside it and its coordinates are unambiguous
            await ev("window.scrollTo(0,0)")
            ph = await ev("document.documentElement.scrollHeight")
            await send("Emulation.setDeviceMetricsOverride", width=W, height=ph, deviceScaleFactor=2, mobile=False)
            await asyncio.sleep(.8)
            r = await rect(sel)
            h = min(r["h"], maxh) if maxh else r["h"]
            s = await send("Page.captureScreenshot", format="png",
                           clip={"x": 0, "y": r["y"] - pad, "width": W, "height": h + 2 * pad, "scale": 1})
            (HERE / "assets" / f"shot_{name}.png").write_bytes(base64.b64decode(s["data"]))
            print(name, round(h + 2 * pad)); return r

        await send("Page.enable"); await send("Runtime.enable")
        await send("Emulation.setDeviceMetricsOverride", width=W, height=900, deviceScaleFactor=2, mobile=False)
        await send("Page.navigate", url="https://forgeout.xyz/"); await asyncio.sleep(9)
        await ev("document.fonts.ready.then(()=>1)")
        await shot("how", "#how")
        await shot("gallery", "#checked", maxh=1500)
        await shot("registry", "#registry")
        await shot("silicon", "#silicon")
        o = await shot("opt_a", "#optimizer")
        rects = {"W": W}
        for k, sel in (("input", "#input"), ("obj", "#obj"), ("run", "#run")):
            r = await rect(sel); rects[k] = {"x": r["x"], "y": r["y"] - o["y"], "w": r["w"], "h": r["h"]}
        await ev("(()=>{const o=document.getElementById('obj');o.value='area';o.dispatchEvent(new Event('change',{bubbles:true}))})()")
        await asyncio.sleep(.6); await shot("opt_b", "#optimizer")
        await ev("document.getElementById('run').click()"); await asyncio.sleep(4)
        o2 = await shot("opt_c", "#optimizer")
        r = await rect("#out"); rects["out"] = {"x": r["x"], "y": r["y"] - o2["y"], "w": r["w"], "h": r["h"]}
        rects["result_text"] = await ev("document.getElementById('out').innerText")
        (HERE / "rects.js").write_text("window.RECTS = " + json.dumps(rects) + ";\n")
        print(rects["result_text"][:300])
try:
    asyncio.run(main())
finally:
    proc.terminate()
