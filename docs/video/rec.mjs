// Records each scene with Chromium's DevTools screencast at a constant 15 fps (the latest frame is re-emitted on a timer),
// pipes MJPEG into ffmpeg, then muxes that scene's narration (n<id>.wav). Page loading is not recorded.
// Usage: node rec.mjs <dir> [scene id]. Scene fields: url, wait (ms before recording), anchor (element id to start at),
// scroll (px scrolled smoothly during the scene), actions ([{at: ms, js}] run in the page), caption.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const DIR = process.argv[2];
const only = process.argv[3] ? Number(process.argv[3]) : null;
const scenes = JSON.parse(readFileSync(`${DIR}/scenes.json`, 'utf8')).filter((s) => !only || s.id === only);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn('chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9341', '--window-size=1280,720', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${DIR}/.chrome`, 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 120 && !wsUrl; i++) { await sleep(250); try { wsUrl = (await (await fetch('http://127.0.0.1:9341/json/list')).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); let onFrame = null;
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } else if (d.method === 'Page.screencastFrame') { onFrame?.(d.params); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

for (const s of scenes) {
  const audio = `${DIR}/n${s.id}.wav`;
  const seconds = dur(audio) + 0.8;
  await send('Page.navigate', { url: s.url.replace('DOCS_VIDEO_DIR', DIR) });
  await sleep(s.wait);
  const cap = JSON.stringify(s.caption || '');
  await send('Runtime.evaluate', { expression: `(() => { document.documentElement.style.scrollBehavior='auto';
    const a=${JSON.stringify(s.anchor || '')}; const el=a&&document.getElementById(a); window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY : 0);
    const c=${cap}; if (c) { const d=document.createElement('div'); d.textContent=c;
    d.style.cssText='position:fixed;left:24px;bottom:22px;z-index:2147483647;padding:10px 18px;border-radius:999px;background:rgba(10,10,11,.88);color:#f4f6f9;font:600 18px/1.3 ui-sans-serif,system-ui,sans-serif;border:1px solid rgba(255,255,255,.18);box-shadow:0 6px 24px rgba(0,0,0,.5)';
    document.body.appendChild(d); } })()` });
  await sleep(500);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '15', '-c:v', 'mjpeg', '-i', '-', '-i', audio,
    '-filter_complex', '[1:a]aresample=44100,apad[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-t', String(seconds), `${DIR}/scene${s.id}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  let last = null;
  onFrame = (p) => { last = Buffer.from(p.data, 'base64'); send('Page.screencastFrameAck', { sessionId: p.sessionId }); };
  await send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  while (!last) await sleep(20);
  if (s.scroll) send('Runtime.evaluate', { expression: `(() => { const T=${Math.round((seconds - 2) * 1000)}, D=${s.scroll}, y0=window.scrollY, t0=performance.now();
    const ease=(x)=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2; setTimeout(function step(){ const k=Math.min(1,(performance.now()-t0-800)/T);
    if (k>0) window.scrollTo(0, y0+D*ease(k)); if (k<1) requestAnimationFrame(step); }, 0); })()` });
  const t0 = Date.now(); const todo = [...(s.actions || [])];
  const total = Math.ceil(seconds * 15);
  for (let f = 0; f < total; f++) {
    while (todo.length && Date.now() - t0 >= todo[0].at) send('Runtime.evaluate', { expression: todo.shift().js });
    ff.stdin.write(last); await sleep(1000 / 15);
  }
  ff.stdin.end();
  await send('Page.stopScreencast'); onFrame = null;
  await new Promise((r) => ff.on('close', r));
  console.log(`scene ${s.id}: ${seconds.toFixed(1)}s -> scene${s.id}.mp4`);
}
ws.close(); chrome.kill();
