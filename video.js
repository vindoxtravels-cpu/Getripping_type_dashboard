/* Reel Studio video engine.
 * One canvas renderer draws every frame, so the live preview and the recorded file always match.
 * record() captures the canvas (and an optional voice-over + synthesized beat) with MediaRecorder.
 */
(() => {
'use strict';
const W = 720, H = 1280;
const FONT = 'Inter, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

/* name, background, text, accent, second accent, motion style */
const T = (name, bg, fg, ac, ac2, style) => ({ name, bg, fg, ac, ac2, style });
const THEMES = [
  T('Aurora', '#0b0b1a', '#ffffff', '#8b5cf6', '#22d3ee', 'orbs'),
  T('Software / SaaS', '#0b1020', '#ffffff', '#3b5bff', '#22d3ee', 'grid'),
  T('Neon', '#07000f', '#ffffff', '#ff2bd6', '#22d3ee', 'scan'),
  T('Sci-fi HUD', '#020b12', '#bff7ff', '#00b8d4', '#7cffcb', 'grid'),
  T('Comic book', '#fff3c4', '#111111', '#e5372b', '#2563eb', 'dots'),
  T('Blueprint', '#0b3b8c', '#ffffff', '#4aa8ff', '#ffffff', 'grid'),
  T('Retro 80s', '#1a0633', '#ffffff', '#ff7a00', '#ff2bd6', 'rays'),
  T('Chalkboard', '#1f2b24', '#f1f1e6', '#c9a400', '#9be3b6', 'dots'),
  T('Whiteboard', '#fafafa', '#1b1b1b', '#2563eb', '#e11d48', 'waves'),
  T('Pixel art', '#14141f', '#ffffff', '#22c55e', '#f59e0b', 'confetti'),
  T('Claymation', '#f3d9c4', '#3b2416', '#c2410c', '#2563eb', 'orbs'),
  T('Paper cutouts', '#efe6d6', '#2a2118', '#c0392b', '#0f766e', 'confetti'),
  T('Markers and pencils', '#fffdf6', '#222222', '#ea580c', '#2563eb', 'waves'),
  T('Editorial', '#f4f1ea', '#111111', '#b91c1c', '#111111', 'dots'),
  T('Glossy 3D', '#0d1b2a', '#ffffff', '#0ea5e9', '#a78bfa', 'orbs'),
  T('Cinematic 3D', '#050505', '#f5f5f5', '#d97706', '#ef4444', 'rays'),
  T('Luxury', '#0c0a08', '#f3e7c9', '#c9a227', '#f3e7c9', 'rays'),
  T('Brutalist', '#ffffff', '#000000', '#ff3b00', '#000000', 'scan'),
  T('Collage', '#f0e9df', '#1e1e1e', '#16a34a', '#e11d48', 'confetti'),
  T('Watercolour', '#f6f1fb', '#2d2340', '#8b5cf6', '#f472b6', 'orbs'),
  T('Newsroom', '#0f172a', '#ffffff', '#dc2626', '#f8fafc', 'scan'),
  T('Vaporwave', '#2b0f3a', '#ffffff', '#14b8a6', '#f472b6', 'waves'),
  T('Hand-drawn', '#fbfaf5', '#222222', '#0284c7', '#f59e0b', 'dots'),
  T('Cartoon', '#ffe8f0', '#1a1a1a', '#e11d48', '#2563eb', 'confetti'),
  T('UI', '#f8fafc', '#0f172a', '#6366f1', '#ec4899', 'grid'),
];
const themeByName = (n) => THEMES.find((t) => t.name === n) || null;

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const frac = (x) => x - Math.floor(x);
const rnd = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const words = (t) => String(t).trim().match(/\S+/g) || [];
const hashStr = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h || 1; };
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- plan: turn a script into timed scenes ---------- */
function plan(sc, o = {}) {
  const theme = themeByName(sc.style && sc.style.theme) || THEMES[0];
  const wps = o.wps || 2.6;
  const blocks = sc.blocks.filter((b) => b.text.trim());
  let scenes = blocks.map((b) => { const ws = words(b.text); return { type: b.type, text: b.text.trim(), ws, dur: Math.max(1.5, ws.length / wps + 0.5) }; });
  if (!scenes.length) { const t = sc.title || 'Your idea'; scenes = [{ type: 'hook', text: t, ws: words(t), dur: 2.5 }]; }
  const base = scenes.reduce((a, s) => a + s.dur, 0);
  const target = o.audioDuration ? Math.max(o.audioDuration, 1) : base * 1.04;
  const k = target / base;
  scenes.forEach((s) => { s.dur *= k; });
  const handle = o.handle || 'yourbrand';
  scenes.push({ type: 'outro', text: `Follow @${handle}`, ws: words(`Follow @${handle}`), dur: 1.5 });
  let t = 0, bodyN = 0;
  scenes.forEach((s, i) => {
    s.index = i; s.start = t; t += s.dur;
    if (s.type === 'body') s.n = ++bodyN;
    const lead = 0.1, tail = s.type === 'outro' ? 0.25 : 0.3, span = Math.max(0.4, s.dur - lead - tail);
    const chars = s.ws.map((w) => w.length + 2), sum = chars.reduce((a, c) => a + c, 0);
    let acc = 0; s.at = chars.map((c) => { const a = lead + span * acc / sum; acc += c; return a; });
    const m = s.type === 'comment' && s.text.match(/comment\s+["“”']?([A-Za-z0-9]+)/i);
    s.keyword = m ? m[1].toUpperCase() : null;
  });
  return { theme, scenes, duration: t, handle, title: sc.title, seed: hashStr(sc.title) };
}

/* ---------- text layout (cached per scene) ---------- */
function layout(ctx, s) {
  if (s.layout) return s.layout;
  const maxW = W - 130;
  let size = s.type === 'hook' || s.type === 'outro' ? 100 : 84, lines, lh, space;
  for (;;) {
    ctx.font = `800 ${size}px ${FONT}`; space = ctx.measureText(' ').width;
    lines = []; let cur = [], curW = 0;
    s.ws.forEach((w, i) => {
      const ww = ctx.measureText(w).width;
      if (cur.length && curW + space + ww > maxW) { lines.push({ items: cur, w: curW }); cur = []; curW = 0; }
      curW += (cur.length ? space : 0) + ww; cur.push({ i, w, ww });
    });
    if (cur.length) lines.push({ items: cur, w: curW });
    lh = size * 1.16;
    if ((lines.length * lh <= 800 && lines.length <= 9) || size <= 40) break;
    size -= 4;
  }
  const blockH = lines.length * lh, y0 = H * 0.46 - blockH / 2 + size * 0.9;
  lines.forEach((ln, li) => { let x = (W - ln.w) / 2; ln.items.forEach((it) => { it.x = x; it.y = y0 + li * lh; x += it.ww + space; }); });
  return (s.layout = { size, lh, lines, blockH, y0 });
}

/* ---------- animated backgrounds (all pure functions of time) ---------- */
function drawBg(ctx, p, t, s) {
  const th = p.theme, light = lum(th.bg) > 0.6, tint = s.index % 2 ? th.ac2 : th.ac;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  const a = light ? 0.55 : 1;
  switch (th.style) {
    case 'orbs':
      for (let k = 0; k < 3; k++) {
        const cx = W * (0.15 + 0.7 * frac(k * 0.37 + p.seed * 0.001)) + Math.sin(t * 0.45 + k * 2.1) * 130;
        const cy = H * (0.2 + 0.28 * k) + Math.cos(t * 0.38 + k) * 150, r = 520;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba(k === 1 ? th.ac2 : tint, 0.5 * a)); g.addColorStop(1, rgba(tint, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } break;
    case 'grid': {
      ctx.strokeStyle = rgba(th.fg, 0.07); ctx.lineWidth = 1.5; const off = (t * 50) % 80;
      ctx.beginPath(); for (let y = -80 + off; y < H; y += 80) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      for (let x = 0; x < W; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.stroke();
      const g = ctx.createRadialGradient(W / 2, H * 0.95, 0, W / 2, H * 0.95, 720);
      g.addColorStop(0, rgba(tint, 0.45 * a)); g.addColorStop(1, rgba(tint, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } break;
    case 'rays':
      ctx.save(); ctx.translate(W / 2, H * 0.45);
      for (let i = 0; i < 14; i++) {
        const ang = i * Math.PI * 2 / 14 + t * 0.15; ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * 1700, Math.sin(ang) * 1700); ctx.lineTo(Math.cos(ang + 0.13) * 1700, Math.sin(ang + 0.13) * 1700);
        ctx.closePath(); ctx.fillStyle = rgba(i % 2 ? th.ac2 : tint, 0.13 * a); ctx.fill();
      } ctx.restore(); break;
    case 'dots':
      for (let y = 24; y < H; y += 48) for (let x = 24; x < W; x += 48) {
        const r = 3 + 6 * (0.5 + 0.5 * Math.sin(x * 0.012 + y * 0.009 - t * 1.7));
        ctx.fillStyle = rgba(tint, 0.2 * a); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      } break;
    case 'scan': {
      ctx.fillStyle = rgba(th.fg, 0.035); for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
      const by = (t * 240) % (H + 260) - 130, g = ctx.createLinearGradient(0, by - 130, 0, by + 130);
      g.addColorStop(0, rgba(tint, 0)); g.addColorStop(0.5, rgba(tint, 0.22 * a)); g.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = g; ctx.fillRect(0, by - 130, W, 260);
      const gl = Math.floor(t * 8);
      for (let k = 0; k < 4; k++) { const r = rnd(gl * 7 + k); if (r > 0.55) { ctx.fillStyle = rgba(th.ac2, 0.12 * a); ctx.fillRect(0, r * H, W * (0.2 + rnd(gl + k) * 0.6), 10 + rnd(k + gl * 3) * 26); } }
    } break;
    case 'waves':
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H * 0.72 + k * 64 + Math.sin(x * 0.011 + t * 1.2 + k * 1.3) * (34 + k * 6));
        ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = rgba(k % 2 ? th.ac2 : tint, (0.12 + 0.04 * k) * a); ctx.fill();
      } break;
    case 'confetti':
      for (let i = 0; i < 44; i++) {
        const sx = rnd(i + 1), sy = rnd(i + 50), sp = 40 + rnd(i + 90) * 90, size = 10 + rnd(i + 7) * 14;
        const x = sx * W + Math.sin(t * 0.8 + i) * 36, y = (sy * H + t * sp) % (H + 80) - 40;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * (rnd(i + 3) - 0.5) * 3 + i);
        ctx.fillStyle = rgba(i % 3 === 0 ? th.ac2 : i % 3 === 1 ? tint : th.fg, i % 3 === 2 ? 0.1 : 0.4 * a);
        ctx.fillRect(-size / 2, -size / 4, size, size / 2); ctx.restore();
      } break;
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, light ? 'rgba(0,0,0,.08)' : 'rgba(0,0,0,.4)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

/* ---------- one frame ---------- */
function draw(ctx, p, tt) {
  const t = clamp(tt, 0, p.duration - 0.001);
  const s = p.scenes.find((sc) => t >= sc.start && t < sc.start + sc.dur) || p.scenes[p.scenes.length - 1];
  const st = t - s.start, th = p.theme;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1; // the previous frame leaves these changed
  drawBg(ctx, p, t, s);

  /* ring burst at each scene start */
  if (st < 0.7) {
    const k = easeOutCubic(st / 0.7); ctx.strokeStyle = rgba(th.ac, 0.5 * (1 - k)); ctx.lineWidth = 10 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.46, 80 + k * 520, 0, 6.3); ctx.stroke();
  }

  /* text group: slow push-in, quick exit */
  const L = layout(ctx, s), exit = clamp((st - (s.dur - 0.22)) / 0.22);
  ctx.save();
  const zoom = 1 + 0.035 * (st / s.dur);
  ctx.translate(W / 2, H * 0.46); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.46 - exit * 26);
  ctx.globalAlpha = 1 - exit;
  ctx.font = `800 ${L.size}px ${FONT}`; ctx.textBaseline = 'alphabetic';
  let cur = -1; s.at.forEach((a, i) => { if (st >= a) cur = i; });
  const pillTxt = lum(th.ac) > 0.62 ? '#111' : '#fff';
  L.lines.forEach((ln) => ln.items.forEach((it) => {
    const tw = st - s.at[it.i]; if (tw < 0) return;
    const e = easeOutBack(clamp(tw / 0.3)), sc = 0.7 + 0.3 * e, a = clamp(tw / 0.12);
    const cx = it.x + it.ww / 2, cy = it.y - L.size * 0.34;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy + (1 - e) * 30); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const lastWordFade = it.i === s.ws.length - 1 ? 1 - clamp((st - s.at[it.i] - 0.5) / 0.5) : 1;
    const active = it.i === cur && s.type !== 'outro' ? (it.i === s.ws.length - 1 ? lastWordFade : 1) : 0;
    if (active > 0.01) { ctx.fillStyle = rgba(th.ac, active); rr(ctx, it.x - 14, it.y - L.size * 0.9, it.ww + 28, L.size * 1.08, 18); ctx.fill(); }
    const emph = /^[$€£]?\d[\d,.]*[kKmM%]?[.,!?]?$|^[A-Z]{3,}[.,!?]?$/.test(it.w);
    ctx.fillStyle = active > 0.5 ? pillTxt : (emph || s.type === 'outro') ? th.ac : th.fg;
    ctx.fillText(it.w, it.x, it.y); ctx.restore();
  }));
  ctx.restore();

  /* call-to-action chip */
  if (s.keyword && st > 0.5) {
    const e = easeOutBack(clamp((st - 0.5) / 0.4)), pulse = 1 + 0.04 * Math.sin(st * 6), y = L.y0 + L.blockH - L.lh * 0.4 + 90;
    ctx.save(); ctx.translate(W / 2, Math.min(y, H - 260)); ctx.scale(e * pulse, e * pulse);
    ctx.font = `800 40px ${FONT}`; const label = `Comment “${s.keyword}”`, w = ctx.measureText(label).width + 80;
    ctx.shadowColor = rgba(th.ac, 0.6); ctx.shadowBlur = 36; ctx.fillStyle = th.ac; rr(ctx, -w / 2, -42, w, 84, 42); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = pillTxt; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2); ctx.restore();
  }

  /* chrome: label, handle, progress */
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const label = s.type === 'hook' ? 'HOOK' : s.type === 'body' ? `LINE ${s.n}` : s.type === 'comment' ? 'CALL TO ACTION' : '';
  if (label) {
    ctx.font = `700 24px ${FONT}`; const w = ctx.measureText(label).width + 40, e = easeOutCubic(clamp(st / 0.35));
    ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * -14);
    ctx.fillStyle = rgba(th.ac, 0.2); rr(ctx, 56, 70, w, 52, 26); ctx.fill();
    ctx.strokeStyle = rgba(th.ac, 0.55); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = th.fg; ctx.fillText(label, 76, 97); ctx.restore();
  }
  ctx.font = `600 26px ${FONT}`; ctx.fillStyle = rgba(th.fg, 0.7); ctx.textAlign = 'right'; ctx.fillText(`@${p.handle}`, W - 56, 97);
  const by = H - 96; let x = 56; const total = W - 112, gap = 6;
  p.scenes.forEach((sc) => {
    const w = total * sc.dur / p.duration - gap; ctx.fillStyle = rgba(th.fg, 0.16); rr(ctx, x, by, Math.max(4, w), 8, 4); ctx.fill();
    const f = clamp((t - sc.start) / sc.dur); if (f > 0) { ctx.fillStyle = th.ac; rr(ctx, x, by, Math.max(8, w * f), 8, 4); ctx.fill(); }
    x += w + gap;
  });

  if (t < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- live preview (loops) ---------- */
function preview(canvas, p) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); let raf = 0, alive = true; const t0 = performance.now();
  const loop = () => { if (!alive) return; draw(ctx, p, ((performance.now() - t0) / 1000) % (p.duration + 0.6)); raf = requestAnimationFrame(loop); };
  loop();
  return { stop() { alive = false; cancelAnimationFrame(raf); } };
}

/* ---------- synthesized background beat ---------- */
function scheduleBeat(ac, dest, dur, vol, seed) {
  const master = ac.createGain(), now = ac.currentTime;
  master.gain.setValueAtTime(vol, now); master.gain.setValueAtTime(vol, now + Math.max(0, dur - 1.2)); master.gain.linearRampToValueAtTime(0.0001, now + dur);
  master.connect(dest);
  const bpm = 88 + (seed % 4) * 8, spb = 60 / bpm, t0 = now + 0.08;
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const root = [110, 98, 123.47, 87.31][seed % 4], scale = [1, 1.2, 1.5, 1.8];
  const tone = (time, f0, f1, len, g, type) => {
    const o = ac.createOscillator(), gn = ac.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, time); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), time + len);
    gn.gain.setValueAtTime(g, time); gn.gain.exponentialRampToValueAtTime(0.001, time + len);
    o.connect(gn); gn.connect(master); o.start(time); o.stop(time + len + 0.02);
  };
  const hiss = (time, freq, len, g) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = freq;
    gn.gain.setValueAtTime(g, time); gn.gain.exponentialRampToValueAtTime(0.001, time + len);
    s.connect(f); f.connect(gn); gn.connect(master); s.start(time); s.stop(time + len);
  };
  for (let b = 0; b * spb < dur; b++) {
    const t = t0 + b * spb; tone(t, 150, 45, 0.16, 0.9);
    if (b % 2 === 1) hiss(t, 1500, 0.14, 0.35);
    hiss(t + spb / 2, 7000, 0.04, 0.2);
    if (b % 2 === 0) { const n = root * scale[(b / 2 | 0) % 4]; tone(t, n, n * 0.99, spb * 1.8, 0.22, 'triangle'); }
  }
}

/* ---------- record to a real video file ---------- */
function supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; }
function pickMime() {
  const c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return c.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}
async function record(p, o = {}) {
  if (!supported()) throw new Error('This browser cannot record video. Use Chrome, Edge, Firefox or Safari 14.1+.');
  const fps = o.fps || 30, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); draw(ctx, p, 0);
  const stream = canvas.captureStream(fps);
  let ac = null, dest = null, voice = null;
  const wantAudio = !!o.audioBuffer || o.music !== false, AC = window.AudioContext || window.webkitAudioContext;
  if (wantAudio && AC) {
    ac = new AC(); if (ac.resume) await ac.resume(); dest = ac.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    if (o.audioBuffer) { voice = ac.createBufferSource(); voice.buffer = o.audioBuffer; const g = ac.createGain(); g.gain.value = 1; voice.connect(g); g.connect(dest); voice.start(ac.currentTime + 0.05); }
    if (o.music !== false) scheduleBeat(ac, dest, p.duration, o.audioBuffer ? 0.05 : 0.16, p.seed);
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined);
  const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error('Recorder error')); });
  let finished = false, aborted = false, raf = 0, iv = 0, last = -1e9;
  const t0 = performance.now(), frameMs = 1000 / fps;
  const finish = () => {
    if (finished) return; finished = true; clearInterval(iv); cancelAnimationFrame(raf);
    try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* already stopped */ }
  };
  const step = () => {
    if (finished) return;
    const now = performance.now(); if (now - last < frameMs - 3) return; last = now;
    const t = (now - t0) / 1000; draw(ctx, p, Math.min(t, p.duration - 0.001));
    if (o.onFrame) o.onFrame(canvas);
    if (o.onProgress) o.onProgress(Math.min(1, t / p.duration), t);
    if (t >= p.duration + 0.15) finish();
  };
  if (o.signal) o.signal.addEventListener('abort', () => { aborted = true; finish(); });
  rec.start(200);
  const loop = () => { step(); if (!finished) raf = requestAnimationFrame(loop); };
  loop();
  iv = setInterval(step, Math.floor(frameMs / 2)); // backup clock: keeps full frame rate when requestAnimationFrame is paused
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  if (voice) { try { voice.stop(); } catch (e) { /* ended */ } }
  if (ac && ac.close) ac.close();
  if (aborted) throw new Error('aborted');
  const type = rec.mimeType || mime || 'video/webm';
  return { blob: new Blob(chunks, { type }), mime: type, ext: type.startsWith('video/mp4') ? 'mp4' : 'webm', duration: p.duration };
}

window.ReelVideo = { THEMES, themeByName, plan, draw, preview, record, supported, W, H };
})();
