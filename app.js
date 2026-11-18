/* Reel Studio: discover → script → make → schedule → insights → remix. No build step. */
(() => {
'use strict';
const RV = window.ReelVideo, IG = window.IG;
const THEMES = RV.THEMES, themeByName = RV.themeByName;

/* ---------- icons ---------- */
const ICON = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  heart: '<path d="M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  camera: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 20a6 6 0 00-2.5-4.9"/>',
  userplus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M19 8v6M16 11h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 .3 1.4 1 2 2 2 0-3-1-5 1-8z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  film2: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const svg = (n, s = 18) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const STAGES = [
  { id: 'feed', name: 'Discover', icon: 'compass', title: 'Find what’s winning', sub: 'Swipe through reels that are working in your niche and keep the best ones.' },
  { id: 'script', name: 'Scripts', icon: 'pen', title: 'Write it your way', sub: 'Rework a winner into your own script. The checks and score update as you type.' },
  { id: 'production', name: 'Studio', icon: 'film', title: 'Make the video', sub: 'Pick a style and a pace, add a voice-over if you have one, then render a real video file.' },
  { id: 'calendar', name: 'Calendar', icon: 'calendar', title: 'Plan your week', sub: 'Schedule each video to your feed or as a trial reel.' },
  { id: 'analytics', name: 'Insights', icon: 'chart', title: 'See what worked', sub: 'Views, reach, followers and a breakdown of every reel.' },
  { id: 'carousels', name: 'Remix', icon: 'layers', title: 'Remix your winners', sub: 'Turn a winning video into a carousel and a batch of fresh hooks.' },
];

const FEED = [
  { id: 1, title: 'Free trials are killing your SaaS', views: '2.4M', mult: 31, g: ['#0f766e', '#052e2b'], why: ['Hook in 1 s', 'Names the enemy', 'A number up front'] },
  { id: 2, title: 'The pricing mistake everyone makes', views: '1.1M', mult: 14, g: ['#8b5cf6', '#2a1260'], why: ['Pattern interrupt', 'Specific mistake', 'Payoff in 10 s'] },
  { id: 3, title: 'I replaced my agency with 3 agents', views: '880K', mult: 11, g: ['#d97706', '#3a1a03'], why: ['Bold claim', 'Concrete number', 'Open loop'] },
  { id: 4, title: 'Stop selling AI tools. Sell the job.', views: '365K', mult: 21, g: ['#475569', '#0b1220'], why: ['Contrarian', 'Clear audience', 'One idea'] },
  { id: 5, title: 'Steal 100 users from your competitor', views: '312K', mult: 18, g: ['#2563eb', '#0b1a4a'], why: ['Number up front', 'Names the enemy', 'Actionable'] },
  { id: 6, title: 'Are vibe coded apps making money?', views: '174K', mult: 9.9, g: ['#be185d', '#2a0a1c'], why: ['Question hook', 'Curiosity gap', 'Timely'] },
];
const PACES = { Calm: 2.2, Balanced: 2.6, Punchy: 3.2 };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRADS = [['#8b5cf6', '#1e1b4b'], ['#059669', '#022c22'], ['#e11d48', '#3b0a16'], ['#0ea5e9', '#082f49']];

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (t) => String(t).trim().match(/\S+/g) || [];
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const slug = (t) => String(t).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'video';
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => new Date(s + 'T00:00:00');
const time12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h || 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2400); }

function confetti(x = innerWidth / 2, y = innerHeight / 3) {
  if (reduced()) return;
  const c = $('#confetti'); c.width = innerWidth; c.height = innerHeight; const ctx = c.getContext('2d');
  const cols = ['#8b5cf6', '#ec4899', '#f59e0b', '#22d3ee', '#34d399'];
  const ps = Array.from({ length: 100 }, () => ({ x, y, vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 15 - 4, r: Math.random() * 6 + 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[Math.random() * 5 | 0], life: 1 }));
  let last = performance.now();
  (function f(now) {
    const dt = Math.min(32, now - last) / 16; last = now; ctx.clearRect(0, 0, c.width, c.height); let alive = false;
    ps.forEach((p) => {
      p.vy += 0.35 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.012 * dt;
      if (p.life > 0) { alive = true; ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    });
    if (alive) requestAnimationFrame(f); else ctx.clearRect(0, 0, c.width, c.height);
  })(last);
}

/* ---------- state ---------- */
const defaultProd = () => ({ steps: [0, 0, 0, 0], render: 0, status: 'idle', log: [], videoUrl: null });
const defaultState = () => ({
  v: 3, handle: 'yourbrand', stage: 0,
  saved: [], selectedSaved: null, skipped: [], history: [], customReels: [],
  scripts: [], activeId: null,
  posts: null, weekOffset: 0, selPost: null, statsPost: null,
  settings: { webhook: '', auth: '' }, range: 30, igRange: 30, music: true,
});
let S;
try { S = Object.assign(defaultState(), JSON.parse(localStorage.getItem('gr_state') || '{}')); } catch (e) { S = defaultState(); }
const wps = (sc) => PACES[sc.style.pace] || 2.6;
function normalizeScript(sc) {
  sc.style = sc.style || {};
  if (!PACES[sc.style.pace]) sc.style.pace = 'Balanced';
  delete sc.style.format;
  if (!themeByName(sc.style.theme)) sc.style.theme = THEMES[0].name;
  const keep = sc.prod && sc.prod.status === 'done' && sc.prod.videoUrl;
  sc.prod = keep ? sc.prod : defaultProd();
  return sc;
}
if (S.script) { S.scripts.push(Object.assign({ id: uid(), style: {}, prod: null }, S.script)); S.activeId = S.scripts[S.scripts.length - 1].id; }
delete S.script; delete S.prod; delete S.schedule;
if (S.handle === 'getripping') S.handle = 'yourbrand';
S.scripts.forEach(normalizeScript);
const save = () => { try { localStorage.setItem('gr_state', JSON.stringify(S)); } catch (e) { /* storage blocked */ } };
save();

const RT = new Map();  // script id → { video:{url,ext,size,duration}, abort }
const VO = new Map();  // script id → { buffer, name, duration }
const handle = () => (IG.connected() && IG.profile && IG.profile.username) || S.handle;
const allReels = () => [...S.customReels, ...FEED];
const videoOf = (sc) => { const r = RT.get(sc.id); if (r && r.video) return r.video; return sc.prod.videoUrl ? { url: sc.prod.videoUrl, ext: 'mp4', external: true } : null; };
function revokeVideo(id) { const r = RT.get(id); if (r && r.video && r.video.url) { URL.revokeObjectURL(r.video.url); r.video = null; } }
function invalidate(sc) { revokeVideo(sc.id); sc.prod = defaultProd(); }

/* ---------- script library ---------- */
function newScript(item) {
  const t = item ? item.title : 'Stop giving out free trials';
  return normalizeScript({
    id: uid(), title: t, source: item ? 'From Discover' : 'Blank', style: { theme: THEMES[0].name, pace: 'Balanced' },
    blocks: [
      { type: 'hook', text: "If you're giving out a free trial in 2026, you might as well be lighting money on fire." },
      { type: 'body', text: 'Do this instead.' },
      { type: 'body', text: 'Most of us are building with AI now, which means every free trial user costs real money in tokens and compute.' },
      { type: 'body', text: "So that's not a free trial. You're paying THEM to use your product." },
      { type: 'comment', text: 'And if you want the free $50k per month playbook, comment "PLAYBOOK" and follow for more.' },
    ],
  });
}
function addScript(sc) { S.scripts.unshift(sc); S.activeId = sc.id; save(); return sc; }
function active() {
  let sc = S.scripts.find((x) => x.id === S.activeId);
  if (!sc) sc = S.scripts[0] || addScript(newScript(null));
  S.activeId = sc.id; return sc;
}
const scriptWords = (sc) => sc.blocks.flatMap((b) => words(b.text));
const seconds = (sc) => scriptWords(sc).length / wps(sc);
function checks(sc) {
  const hook = sc.blocks.find((b) => b.type === 'hook'), body = sc.blocks.filter((b) => b.type === 'body'), cm = sc.blocks.find((b) => b.type === 'comment');
  return [
    ['Hook in the first 3 s', sc.blocks[0] === hook && !!hook && words(hook.text).length > 0 && words(hook.text).length <= 20],
    ['One idea per line', body.length > 0 && body.every((b) => words(b.text).length <= 24)],
    ['Ends on a comment', !!cm && /comment/i.test(cm.text)],
    ['Same words on screen', sc.blocks.length > 0 && sc.blocks.every((b) => b.text.trim())],
  ];
}
/** Score a script out of 100 and pin each fix to the second it happens. */
function virality(sc) {
  let score = 100; const fixes = []; let t = 0; const at = [];
  sc.blocks.forEach((b) => { at.push(t); t += words(b.text).length / wps(sc); });
  const fix = (sec, pts, msg) => { score -= pts; fixes.push({ t: sec, pts, msg }); };
  const hi = sc.blocks.findIndex((b) => b.type === 'hook');
  if (hi !== 0) fix(0, 25, 'Open on the hook. The first line decides the swipe.');
  else {
    const h = sc.blocks[0].text, hs = words(h).length / wps(sc);
    if (hs > 3.5) fix(0, Math.min(15, Math.round((hs - 3.5) * 4)), `Hook takes ${hs.toFixed(1)} s to say. Get it under 3.5 s.`);
    if (!/\d/.test(h)) fix(0, 6, 'Put a number in the hook.');
    if (!/\b(you|your|you're)\b/i.test(h)) fix(0, 5, 'Talk to the viewer. Use "you".');
  }
  sc.blocks.forEach((b, i) => {
    if (!b.text.trim()) fix(at[i], 4, 'Empty line. Delete it or fill it.');
    else if (b.type === 'body' && words(b.text).length > 24) fix(at[i], 5, `${words(b.text).length}-word line. Split it so each line is one idea.`);
  });
  const ci = sc.blocks.findIndex((b) => b.type === 'comment');
  if (ci < 0 || !/comment/i.test(sc.blocks[ci].text)) fix(t, 12, 'End with a comment call-to-action, e.g. "comment PLAYBOOK".');
  if (t > 75) fix(60, 10, `Runs ${mmss(t)}. Cut it to under 60 s.`);
  else if (t < 12) fix(t, 8, `Only ${mmss(t)} long. Add a payoff before the call-to-action.`);
  if (sc.blocks.some((b) => b.type === 'body') && !sc.blocks.some((b) => b.type === 'body' && /\b(instead|but|so|because|here's)\b/i.test(b.text))) fix(at[1] || 0, 4, 'Add a turn ("instead", "but", "so") to keep people watching.');
  return { score: Math.max(5, Math.min(100, Math.round(score))), fixes: fixes.sort((a, b) => a.t - b.t), length: t };
}
const scoreClass = (n) => n >= 80 ? 'good' : n >= 60 ? 'ok' : 'bad';
function ringHtml(score, size = 120) {
  const r = 52, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Virality score ${score} out of 100">
    <circle cx="60" cy="60" r="${r}" class="ring-bg"/><circle cx="60" cy="60" r="${r}" class="ring-fg ${scoreClass(score)}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="62" text-anchor="middle" class="ring-n">${score}</text><text x="60" y="84" text-anchor="middle" class="ring-s">/ 100</text></svg>`;
}

/* ---------- shell ---------- */
let previews = [];
const stopPreviews = () => { previews.forEach((p) => p.stop()); previews = []; };
function buildNav() {
  $('#nav').insertAdjacentHTML('beforeend', STAGES.map((s, i) => `<button class="navi" type="button" data-i="${i}"><span class="ic">${svg(s.icon, 18)}</span><span class="nm"><b>${s.name}</b><small>0${i + 1}</small></span><span class="tick">${svg('check', 14)}</span></button>`).join(''));
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
}
function moveGlider() {
  const on = $('.navi.on'), g = $('#glider'); if (!on) return;
  g.style.setProperty('--gx', on.offsetLeft + 'px'); g.style.setProperty('--gy', on.offsetTop + 'px');
  g.style.setProperty('--gw', on.offsetWidth + 'px'); g.style.setProperty('--gh', on.offsetHeight + 'px');
}
function renderIgCard() {
  const c = $('#igCard'), p = IG.profile;
  if (IG.connected()) {
    c.className = 'igcard on';
    c.innerHTML = `<span class="av">${p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : esc((handle()[0] || 'y').toUpperCase())}</span>
      <span class="who"><b>@${esc(handle())}</b><small><i class="dot ${IG.status === 'error' ? 'bad' : ''}"></i>${IG.status === 'error' ? 'Needs attention' : 'Connected'}</small></span>`;
  } else {
    c.className = 'igcard';
    c.innerHTML = `<span class="av ig">${svg('camera', 18)}</span><span class="who"><b>Connect Instagram</b><small>See your real insights</small></span>`;
  }
}
function renderChrome() {
  const st = STAGES[S.stage];
  $$('.navi').forEach((el, i) => { el.classList.toggle('on', i === S.stage); el.classList.toggle('done', i < S.stage); el.setAttribute('aria-current', i === S.stage ? 'step' : 'false'); });
  $('#stageLabel').textContent = `Step ${S.stage + 1} of 6 · ${st.name}`;
  $('#stageTitle').textContent = st.title; $('#stageSub').textContent = st.sub;
  const nx = STAGES[S.stage + 1], nb = $('#nextBtn');
  nb.style.visibility = nx ? 'visible' : 'hidden'; nb.innerHTML = nx ? `${nx.name} ${svg('arrow', 18)}` : '';
  renderIgCard(); moveGlider();
}
function go(i) {
  S.stage = clamp(i, 0, 5); save();
  const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  render(); window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
}
function render() { stopPreviews(); renderChrome(); VIEWS[STAGES[S.stage].id](); }
const onStage = (id) => STAGES[S.stage].id === id;
function countUps() {
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count, kind = el.dataset.kind || 'compact', fm = (v) => (kind === 'plus' ? '+' : '') + (kind === 'int' || kind === 'plus' ? Math.round(v).toLocaleString() : fmt(v));
    if (reduced() || !isFinite(to)) { el.textContent = fm(to || 0); return; }
    const t0 = performance.now(), d = 900;
    (function f(now) { const k = clamp((now - t0) / d, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fm(to * e); if (k < 1) requestAnimationFrame(f); })(t0);
  });
}

/* ---------- 01 Discover ---------- */
function enableDrag(el, decide) {
  let sx = 0, dx = 0, on = false;
  el.addEventListener('pointerdown', (e) => { on = true; sx = e.clientX; try { el.setPointerCapture(e.pointerId); } catch (err) { /* capture unavailable */ } el.style.transition = 'none'; });
  el.addEventListener('pointermove', (e) => {
    if (!on) return; dx = e.clientX - sx; el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    el.style.setProperty('--save', clamp(dx / 110, 0, 1)); el.style.setProperty('--skip', clamp(-dx / 110, 0, 1));
  });
  const end = () => {
    if (!on) return; on = false; el.style.transition = '';
    if (Math.abs(dx) > 100) decide(dx > 0 ? 'save' : 'skip'); else { el.style.transform = ''; el.style.setProperty('--save', 0); el.style.setProperty('--skip', 0); }
    dx = 0;
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
function viewFeed() {
  const reels = allReels(), rest = reels.filter((f) => !S.saved.includes(f.id) && !S.skipped.includes(f.id));
  const top = rest[0], mid = rest[1], low = rest[2];
  const sel = reels.find((f) => f.id === (S.selectedSaved != null ? S.selectedSaved : S.saved[S.saved.length - 1]));
  const card = (f, cls, extra) => `<div class="reel ${cls}" ${cls === 'r1' ? 'id="topReel"' : ''} style="--c1:${f.g[0]};--c2:${f.g[1]}">${extra || ''}<span class="sheen"></span><span class="play">${svg('play', 22)}</span>
    <div class="t">${esc(f.title)}</div><div class="m">${f.mult ? `<span class="mult">${svg('flame', 13)} ${f.mult}× usual</span>` : ''}<span class="views">${svg('eye', 14)} ${esc(f.views)}</span></div></div>`;
  $('#view').innerHTML = `
  <div class="toolbar"><span class="chip">SaaS founders</span><span class="chip hot">${svg('flame', 14)} Winning in your niche</span><span class="spacer"></span>
    <button class="btn" id="addReelBtn" type="button">${svg('plus', 16)} Add reel</button><span class="chip">${svg('heart', 14)} Saved ${S.saved.length}</span></div>
  <form class="addreel panel" id="addReel" hidden>
    <input name="title" placeholder="What the reel says, e.g. Your landing page is too long" required>
    <input name="url" type="url" placeholder="instagram.com/reel/… (optional)">
    <input name="views" placeholder="Views, e.g. 420K"><input name="mult" type="number" step="0.1" min="0" placeholder="× usual">
    <button class="btn primary">Add to feed</button>
  </form>
  <div class="feed">
    <div class="deck-wrap">
      <div class="deck" id="deck">
        ${low ? card(low, 'r3') : ''}${mid ? card(mid, 'r2') : ''}
        ${top ? card(top, 'r1', '<span class="stamp save">SAVE</span><span class="stamp skip">SKIP</span>') : `<div class="panel empty">You've swiped everything.<button class="btn primary" id="reset" type="button">Reload feed</button></div>`}
      </div>
      <div class="deck-btns">
        <button class="round skip" id="skip" type="button" title="Skip (←)" aria-label="Skip">${svg('x', 22)}</button>
        <button class="round sm" id="undo" type="button" title="Undo" aria-label="Undo">${svg('undo', 18)}</button>
        <button class="round save" id="saveReel" type="button" title="Save (→)" aria-label="Save">${svg('heart', 24)}</button>
      </div>
      <p class="hint">Drag the card, or press ← and → on your keyboard</p>
    </div>
    <aside class="panel side">
      <div class="lab">Saved</div>
      ${sel ? `<div class="saved-item"><b>${esc(sel.title)}</b><span>${svg('eye', 14)} ${esc(sel.views)}${sel.mult ? ` · <em>${sel.mult}× usual</em>` : ''}${sel.url ? ` · <a href="${esc(sel.url)}" target="_blank" rel="noopener">open ↗</a>` : ''}</span></div>
      <div class="lab">Why it works</div><div class="chips">${sel.why.map((w, i) => `<span class="chip blue" style="--i:${i}">${esc(w)}</span>`).join('')}</div>`
        : '<p class="muted">Save a reel (♥) and the reason it works shows up here.</p>'}
      ${S.saved.length > 1 ? `<div class="saved-list">${S.saved.map((id) => { const f = reels.find((x) => x.id === id); return f ? `<button type="button" data-sel="${esc(id)}" class="${sel && sel.id === id ? 'sel' : ''}">${esc(f.title)}</button>` : ''; }).join('')}</div>` : ''}
      <button class="btn primary wide" id="revoice" type="button" ${sel ? '' : 'disabled'}>${svg('sparkles', 17)} Draft a script from this</button>
    </aside>
  </div>`;
  const act = (kind) => {
    const el = $('#topReel'); if (!el || !top) return;
    el.style.transition = ''; el.style.opacity = '0';
    el.style.transform = kind === 'save' ? 'translateX(560px) rotate(26deg)' : 'translateX(-560px) rotate(-26deg)';
    el.style.setProperty(kind === 'save' ? '--save' : '--skip', 1);
    setTimeout(() => {
      S.history.push({ id: top.id, kind });
      if (kind === 'save') { S.saved.push(top.id); S.selectedSaved = top.id; } else S.skipped.push(top.id);
      save(); if (onStage('feed')) viewFeed();
    }, 300);
  };
  if (top) enableDrag($('#topReel'), act);
  $('#saveReel').onclick = () => act('save'); $('#skip').onclick = () => act('skip');
  $('#undo').onclick = () => { const h = S.history.pop(); if (!h) return; S.saved = S.saved.filter((x) => x !== h.id); S.skipped = S.skipped.filter((x) => x !== h.id); save(); viewFeed(); };
  const r = $('#reset'); if (r) r.onclick = () => { S.saved = []; S.skipped = []; S.history = []; save(); viewFeed(); };
  $$('[data-sel]').forEach((b) => b.onclick = () => { const id = b.dataset.sel; S.selectedSaved = isNaN(id) ? id : +id; save(); viewFeed(); });
  $('#revoice').onclick = () => { addScript(newScript(sel)); toast('Script drafted from the saved reel'); go(1); };
  $('#addReelBtn').onclick = () => { const f = $('#addReel'); f.hidden = !f.hidden; if (!f.hidden) f.title.focus(); };
  $('#addReel').onsubmit = (e) => {
    e.preventDefault(); const f = e.target, g = GRADS[S.customReels.length % GRADS.length];
    S.customReels.unshift({ id: 'c' + uid(), title: f.title.value.trim(), url: f.url.value.trim(), views: f.views.value.trim() || '—', mult: +f.mult.value || 0, g, why: ['Your pick'] });
    save(); toast('Added to the top of your feed'); viewFeed();
  };
}

/* ---------- 02 Scripts ---------- */
function timelineHtml(sc) {
  const segs = sc.blocks.map((b) => ({ type: b.type, s: Math.max(1.2, words(b.text).length / wps(sc)) })), tot = segs.reduce((a, s) => a + s.s, 0) || 1;
  return segs.map((s) => `<i class="tseg ${s.type}" style="flex:${s.s / tot}" title="${s.type} · ${s.s.toFixed(1)} s"></i>`).join('');
}
function viewScript() {
  const sc = active();
  const draw = () => {
    $('#view').innerHTML = `
    <div class="scripts">
      <aside class="lib">
        <button class="btn primary wide" id="newScript" type="button">${svg('plus', 16)} New script</button>
        ${S.scripts.map((x) => `<div class="libitem ${x.id === sc.id ? 'sel' : ''}"><button type="button" data-open="${x.id}"><b>${esc(x.title || 'Untitled')}</b><span>${mmss(seconds(x))} · ${videoOf(x) ? 'rendered' : 'draft'}</span></button>${S.scripts.length > 1 ? `<button type="button" class="x" data-rm="${x.id}" title="Delete script" aria-label="Delete script">${svg('trash', 15)}</button>` : ''}</div>`).join('')}
      </aside>
      <section class="editor panel">
        <div class="ed-head"><input class="title-in" id="sTitle" value="${esc(sc.title)}" aria-label="Script title"><span class="chip" id="dur">${mmss(seconds(sc))}</span><span class="chip blue">${svg('link', 13)} ${esc(sc.source)}</span></div>
        <div class="timeline" id="timeline" aria-hidden="true">${timelineHtml(sc)}</div>
        <div id="blocks">${sc.blocks.map((b, i) => `
          <div class="blk ${b.type}" style="--i:${i}">${b.type !== 'body' ? `<span class="tag">${b.type === 'hook' ? 'Hook' : 'Comment'}</span>` : ''}
            <textarea data-i="${i}" rows="1" aria-label="${b.type} line">${esc(b.text)}</textarea>
            ${b.type === 'body' ? `<button class="x" type="button" data-del="${i}" title="Remove line" aria-label="Remove line">${svg('x', 15)}</button>` : ''}</div>`).join('')}
          <button class="btn" id="addLine" type="button">${svg('plus', 15)} Add line</button>
        </div>
      </section>
      <aside class="panel insight">
        <div class="lab">Virality score</div><div id="ringWrap"></div>
        <div class="lab">Checks</div><ul class="checks" id="checks"></ul>
        <div class="lab">Fixes</div><ul class="fixes" id="fixes"></ul>
        <button class="btn primary wide" id="toProd" type="button">Make the video ${svg('arrow', 16)}</button>
      </aside>
    </div>`;
    const upd = () => {
      $('#checks').innerHTML = checks(sc).map(([l, ok]) => `<li><span class="ck ${ok ? '' : 'bad'}">${ok ? svg('check', 12) : ''}</span>${l}</li>`).join('');
      const v = virality(sc); $('#ringWrap').innerHTML = ringHtml(v.score, 112);
      $('#fixes').innerHTML = v.fixes.length ? v.fixes.map((f) => `<li><span class="at">${mmss(f.t)}</span><span>${esc(f.msg)}</span></li>`).join('') : '<li class="none">No fixes. Ready to make.</li>';
      $('#dur').textContent = mmss(seconds(sc)); $('#timeline').innerHTML = timelineHtml(sc);
    };
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    $$('#blocks textarea').forEach((t) => { grow(t); t.oninput = () => { sc.blocks[+t.dataset.i].text = t.value; if (videoOf(sc) && !sc.prod.videoUrl) { invalidate(sc); } grow(t); upd(); save(); }; });
    $$('[data-del]').forEach((b) => b.onclick = () => { sc.blocks.splice(+b.dataset.del, 1); invalidate(sc); save(); draw(); });
    $$('[data-open]').forEach((b) => b.onclick = () => { S.activeId = b.dataset.open; save(); viewScript(); });
    $$('[data-rm]').forEach((b) => b.onclick = () => { if (!confirm('Delete this script?')) return; revokeVideo(b.dataset.rm); S.scripts = S.scripts.filter((x) => x.id !== b.dataset.rm); if (S.activeId === b.dataset.rm) S.activeId = null; save(); viewScript(); });
    $('#newScript').onclick = () => { const n = newScript(null); n.title = 'Untitled script'; n.blocks = [{ type: 'hook', text: '' }, { type: 'body', text: '' }, { type: 'comment', text: '' }]; addScript(n); viewScript(); };
    $('#addLine').onclick = () => { const ci = sc.blocks.findIndex((b) => b.type === 'comment'); sc.blocks.splice(ci < 0 ? sc.blocks.length : ci, 0, { type: 'body', text: '' }); invalidate(sc); save(); draw(); };
    $('#sTitle').oninput = (e) => { sc.title = e.target.value; save(); };
    $('#toProd').onclick = () => go(2);
    upd();
  };
  draw();
}

/* ---------- 03 Studio (real video generation) ---------- */
const PSTEPS = [['Script', 'file'], ['Voice', 'mic'], ['Visuals', 'layers'], ['Edit', 'film']];
const planFor = (sc) => { const vo = VO.get(sc.id); return RV.plan(sc, { handle: handle(), wps: wps(sc), audioDuration: vo ? vo.duration : 0 }); };
const onProd = (sc) => onStage('production') && S.activeId === sc.id && $('#steps');
function plog(sc, m) { sc.prod.log.push(new Date().toLocaleTimeString() + '  ' + m); sc.prod.log = sc.prod.log.slice(-30); if (onProd(sc)) { const l = $('#log'); l.innerHTML = sc.prod.log.map(esc).join('<br>'); l.scrollTop = 1e9; } }
function paint(sc, eta) {
  if (!onProd(sc)) return; const P = sc.prod;
  $$('#steps .step').forEach((el, i) => { const st = P.steps[i]; el.className = 'step ' + (st === 2 ? 'done' : st === 1 ? 'run' : ''); });
  $('#rp').textContent = P.render + '%'; $('#rm').style.width = P.render + '%';
  $('#rs').textContent = P.status === 'done' ? 'Ready' : P.status === 'running' ? (eta != null ? `Rendering in real time · about ${Math.max(1, Math.ceil(eta))} s left` : 'Working…') : 'Not started';
}
function viewProduction() {
  const sc = active(), P = sc.prod, vo = VO.get(sc.id), v = videoOf(sc), p = planFor(sc), vir = virality(sc), running = P.status === 'running';
  const canRec = RV.supported();
  $('#view').innerHTML = `
  <div class="studio">
    <div class="stage-phone">
      <div class="phone"><canvas id="pv" width="720" height="1280"></canvas><span class="phone-badge">${running ? 'RENDERING' : 'LIVE PREVIEW'}</span></div>
      <p class="mini">${mmss(p.duration)} · 9:16 · 720×1280</p>
    </div>
    <div class="studio-col">
      <section class="panel">
        <div class="ph"><h3>${esc(sc.title)}</h3><span class="score-pill ${scoreClass(vir.score)}">Virality ${vir.score}</span></div>
        <div class="lab">Style</div>
        <div class="themes" id="themes">${THEMES.map((t) => `<button type="button" class="theme ${t.name === sc.style.theme ? 'on' : ''}" data-theme="${esc(t.name)}" style="--bg:${t.bg};--fg:${t.fg};--ac:${t.ac}" title="${esc(t.name)}" ${running ? 'disabled' : ''}><i></i><span>${esc(t.name)}</span></button>`).join('')}</div>
        <div class="opts">
          <div><div class="lab">Pace</div><div class="seg" id="pace">${Object.keys(PACES).map((k) => `<button type="button" data-pace="${k}" class="${k === sc.style.pace ? 'on' : ''}" ${running ? 'disabled' : ''}>${k}</button>`).join('')}</div></div>
          <label class="switch"><input type="checkbox" id="music" ${S.music ? 'checked' : ''} ${running ? 'disabled' : ''}><span class="knob"></span><span>${svg('music', 15)} Background beat</span></label>
        </div>
      </section>
      <section class="panel">
        <div class="ph"><h3>Voice-over</h3></div>
        ${vo ? `<div class="vo"><span class="vo-ic">${svg('mic', 18)}</span><div><b>${esc(vo.name)}</b><small>${mmss(vo.duration)} · scenes are timed to it</small></div><button type="button" class="btn ghost sm" id="voClear" ${running ? 'disabled' : ''}>Remove</button></div>`
          : `<p class="muted">Add a recording of you reading the script (MP3, WAV or M4A). The scenes will be timed to your voice.</p><label class="btn upload"><input type="file" id="vo" accept="audio/*" hidden ${running ? 'disabled' : ''}>${svg('mic', 16)} Upload voice-over</label>`}
      </section>
      <section class="panel">
        <div class="ph"><h3>Render</h3><div class="row"><button class="btn" id="cfg" type="button">${svg('link', 15)} Webhook${S.settings.webhook ? ' ✓' : ''}</button>
          ${running ? '<button class="btn danger" id="cancel" type="button">Cancel</button>' : `<button class="btn primary" id="run" type="button" ${canRec || S.settings.webhook ? '' : 'disabled'}>${svg('film2', 16)} ${v ? 'Render again' : 'Render video'}</button>`}</div></div>
        <div id="steps">${PSTEPS.map((s, i) => `<div class="step"><span class="dotx"></span><b>${s[0]}</b><span class="d">${i === 0 ? 'Locked, word for word' : i === 1 ? (vo ? 'Your voice-over' : S.music ? 'Synthesized beat' : 'No audio') : i === 2 ? `${p.scenes.length} scenes, ${esc(sc.style.theme)}` : 'Captions, motion and cuts'}</span></div>`).join('')}</div>
        <div class="renderbox"><div class="top"><span id="rs"></span><b id="rp">${P.render}%</b></div><div class="meter"><i id="rm" style="width:${P.render}%"></i></div></div>
        ${canRec || S.settings.webhook ? '' : '<p class="warn">This browser cannot record video. Use Chrome, Edge, Firefox or Safari 14.1+, or set a webhook.</p>'}
        <div class="log" id="log">${P.log.map(esc).join('<br>')}</div>
      </section>
      <section class="panel" id="result">${v ? `
        <div class="ph"><h3>Your video</h3><span class="chip">${(v.ext || 'mp4').toUpperCase()}${v.size ? ' · ' + (v.size / 1e6).toFixed(1) + ' MB' : ''}${v.duration ? ' · ' + mmss(v.duration) : ''}</span></div>
        <div class="res"><video class="result-video" src="${esc(v.url)}" controls playsinline loop></video>
          <div class="res-side"><a class="btn primary wide" href="${esc(v.url)}" download="${slug(sc.title)}.${v.ext || 'mp4'}" ${v.external ? 'target="_blank" rel="noopener"' : ''}>${svg('download', 17)} Download</a>
            <button class="btn wide" id="sched" type="button">${svg('calendar', 16)} Schedule post</button>
            <p class="muted small">${v.ext === 'webm' ? 'Your browser saved WebM. Instagram needs MP4: <code>ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -c:a aac out.mp4</code>' : v.external ? 'Returned by your webhook.' : 'Videos live in this tab. Download it to keep it.'}</p></div></div>`
        : `<div class="ph"><h3>Your video</h3></div><p class="muted">Press <b>Render video</b>. A ${mmss(p.duration)} reel takes about ${mmss(p.duration)} to render, because it is recorded in real time. Keep this tab open.</p>`}</section>
    </div>
  </div>`;
  if (!running) previews.push(RV.preview($('#pv'), p)); else { const c = $('#pv'); c.getContext('2d').fillStyle = '#000'; }
  $$('#themes [data-theme]').forEach((b) => b.onclick = () => { sc.style.theme = b.dataset.theme; invalidate(sc); save(); viewProduction(); });
  $$('#pace [data-pace]').forEach((b) => b.onclick = () => { sc.style.pace = b.dataset.pace; invalidate(sc); save(); viewProduction(); });
  $('#music').onchange = (e) => { S.music = e.target.checked; save(); viewProduction(); };
  const vi = $('#vo'); if (vi) vi.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), buf = await ac.decodeAudioData(await f.arrayBuffer()); if (ac.close) ac.close();
      VO.set(sc.id, { buffer: buf, name: f.name, duration: buf.duration }); invalidate(sc); toast('Voice-over loaded · ' + mmss(buf.duration)); viewProduction();
    } catch (err) { toast('Could not read that audio file'); }
  };
  const vc = $('#voClear'); if (vc) vc.onclick = () => { VO.delete(sc.id); invalidate(sc); viewProduction(); };
  $('#cfg').onclick = openSettings;
  const run = $('#run'); if (run) run.onclick = () => runPipeline(sc);
  const cn = $('#cancel'); if (cn) cn.onclick = () => { const r = RT.get(sc.id); if (r && r.abort) r.abort.abort(); };
  const sh = $('#sched'); if (sh) sh.onclick = () => openSchedule(sc.id, null);
  paint(sc);
}
function buildPayload(sc) {
  const th = themeByName(sc.style.theme);
  return { handle: handle(), title: sc.title, duration: mmss(seconds(sc)), script: sc.blocks, text: sc.blocks.map((b) => b.text).join('\n'), wordCount: scriptWords(sc).length, format: '9:16',
    style: { theme: th.name, pace: sc.style.pace, colors: { bg: th.bg, fg: th.fg, accent: th.ac } }, virality: virality(sc).score, createdAt: new Date().toISOString() };
}
async function renderLocal(sc) {
  const P = sc.prod, vo = VO.get(sc.id), rt = RT.get(sc.id) || {}; RT.set(sc.id, rt);
  rt.abort = new AbortController();
  P.steps = [2, 1, 0, 0]; paint(sc); plog(sc, vo ? 'Voice: using your voice-over' : S.music ? 'Voice: synthesizing a beat' : 'Voice: no audio'); await sleep(180);
  P.steps = [2, 2, 1, 0]; const plan = planFor(sc); plog(sc, `Visuals: ${plan.scenes.length} scenes in ${sc.style.theme}`); paint(sc); await sleep(180);
  P.steps = [2, 2, 2, 1]; plog(sc, `Edit: recording ${mmss(plan.duration)} in real time`); paint(sc);
  const pc = $('#pv'), pctx = pc && pc.getContext('2d');
  const res = await RV.record(plan, {
    audioBuffer: vo ? vo.buffer : null, music: S.music, signal: rt.abort.signal,
    onFrame: (c) => { if (onProd(sc) && pctx) pctx.drawImage(c, 0, 0); },
    onProgress: (f, t) => { P.render = Math.min(99, Math.round(f * 100)); paint(sc, plan.duration - t); },
  });
  revokeVideo(sc.id);
  rt.video = { url: URL.createObjectURL(res.blob), ext: res.ext, size: res.blob.size, duration: res.duration };
  P.steps = [2, 2, 2, 2]; P.render = 100; P.status = 'done'; plog(sc, `Done: ${res.ext.toUpperCase()}, ${(res.blob.size / 1e6).toFixed(1)} MB`);
}
async function runPipeline(sc) {
  const P = sc.prod; if (P.status === 'running') return;
  revokeVideo(sc.id); Object.assign(P, defaultProd(), { status: 'running' }); save();
  if (onProd(sc)) viewProduction();
  plog(sc, `Pipeline started · ${sc.style.theme} · ${sc.style.pace}`);
  const finish = (ok) => { if (!ok) { P.status = 'idle'; P.steps = [0, 0, 0, 0]; } save(); if (onProd(sc)) { viewProduction(); } if (ok) confetti(); };
  const { webhook, auth } = S.settings;
  try {
    if (webhook) {
      try {
        plog(sc, 'POST ' + webhook); P.steps = [2, 1, 0, 0]; paint(sc);
        const res = await fetch(webhook, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: auth } : {}), body: JSON.stringify(buildPayload(sc)) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let data = {}; try { data = await res.json(); } catch (e) { /* no body */ }
        plog(sc, 'Webhook accepted' + (data.jobId ? ' · job ' + data.jobId : ''));
        if (data.videoUrl) { P.videoUrl = data.videoUrl; P.steps = [2, 2, 2, 2]; P.render = 100; P.status = 'done'; plog(sc, 'Video ready'); finish(true); return; }
        if (data.statusUrl) { await pollStatus(sc, data.statusUrl); finish(P.status === 'done'); return; }
        plog(sc, 'Webhook returned no video URL, rendering here instead');
      } catch (e) { plog(sc, 'Webhook failed: ' + e.message + ' (CORS or network). Rendering here instead.'); }
    }
    await renderLocal(sc); finish(true);
  } catch (e) {
    plog(sc, e.message === 'aborted' ? 'Cancelled' : 'Render failed: ' + e.message); finish(false);
  }
}
function pollStatus(sc, url) {
  const P = sc.prod; let n = 0;
  return new Promise((resolve) => {
    const t = setInterval(async () => {
      try {
        const d = await (await fetch(url)).json();
        P.render = Math.round(d.progress || 0); P.steps = [2, P.render > 5 ? 2 : 1, P.render > 40 ? 2 : P.render > 5 ? 1 : 0, P.render > 80 ? 1 : 0]; paint(sc);
        plog(sc, 'Status: ' + (d.status || P.render + '%'));
        if (d.status === 'done' || d.videoUrl || P.render >= 100) { clearInterval(t); if (d.videoUrl) P.videoUrl = d.videoUrl; P.status = 'done'; P.steps = [2, 2, 2, 2]; P.render = 100; resolve(); return; }
      } catch (e) { plog(sc, 'Poll error: ' + e.message); }
      if (++n > 300) { clearInterval(t); plog(sc, 'Gave up polling'); P.status = 'idle'; resolve(); }
    }, 2000);
  });
}

/* ---------- 04 Calendar ---------- */
function weekStart(offset) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + offset * 7); return d; }
const weekOf = (day) => Math.floor(Math.round((parseDay(day) - weekStart(0)) / 864e5) / 7);
function ensurePosts() {
  if (S.posts) return;
  const ws = weekStart(0);
  S.posts = ['Stop giving out free trials', 'Do you guys wanna get way more users', 'You can now run Claude on autopilot', '10 lazy marketing tips that work'].map((title, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + 3 + i);
    return { id: uid(), scriptId: null, title, date: ymd(d), time: i === 0 ? '07:51' : '08:00', status: i === 0 ? 'posted' : 'scheduled', feed: true, trial: false, theme: THEMES[[0, 3, 1, 2][i]].name };
  });
  S.selPost = S.posts[0].id;
}
function viewCalendar() {
  ensurePosts();
  const ws = weekStart(S.weekOffset), days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
  const inWeek = S.posts.filter((p) => days.some((d) => ymd(d) === p.date)), posted = inWeek.filter((p) => p.status === 'posted').length;
  const sel = S.posts.find((p) => p.id === S.selPost && inWeek.includes(p)) || inWeek[0], today = ymd(new Date());
  const side = sel ? (() => {
    const sc = S.scripts.find((x) => x.id === sel.scriptId), cap = sc ? sc.blocks.map((b) => b.text).filter(Boolean) : [sel.title];
    return `<div class="who-row"><span class="av">${esc((handle()[0] || 'y').toUpperCase())}</span><b>@${esc(handle())}</b></div>
      <p class="cap">${esc(cap[0])}</p>
      ${cap.length > 1 ? `<p class="muted small">${esc(cap[cap.length - 1].slice(0, 110))}${cap[cap.length - 1].length > 110 ? '…' : ''}</p>` : ''}
      <div class="trow"><span>Feed</span><button type="button" class="toggle ${sel.feed ? 'on' : ''}" id="tFeed" aria-label="Post to feed" aria-pressed="${sel.feed}"></button></div>
      <div class="trow"><span>Trial reel</span><button type="button" class="toggle ${sel.trial ? 'on' : ''}" id="tTrial" aria-label="Post as trial reel" aria-pressed="${sel.trial}"></button></div>
      ${sel.status === 'posted' ? '' : `<div class="trow"><span>When</span><span class="when"><input type="date" id="pDate" value="${sel.date}"><input type="time" id="pTime" value="${sel.time}"></span></div>`}
      <button type="button" class="postbtn ${sel.status === 'posted' ? 'done' : 'go'}" id="postNow">${sel.status === 'posted' ? '✓ Posted ' + DAY_NAMES[parseDay(sel.date).getDay()] + ' ' + time12(sel.time) : 'Mark as posted'}</button>
      <button type="button" class="linkbtn" id="rmPost">Remove from calendar</button>`;
  })() : `<p class="muted">Nothing scheduled this week.</p><button type="button" class="btn primary wide" id="schedHere">Schedule the active script</button>`;
  $('#view').innerHTML = `
  <div class="toolbar"><button class="round sm" id="prevW" type="button" aria-label="Previous week">‹</button><h2>Week of ${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2><button class="round sm" id="nextW" type="button" aria-label="Next week">›</button>
    ${posted ? `<span class="chip good">${posted} posted</span>` : ''}<span class="chip">${inWeek.length - posted} scheduled</span><span class="spacer"></span>${S.weekOffset ? '<button class="btn" id="thisW" type="button">This week</button>' : ''}</div>
  <div class="cal">
    <div class="week">${days.map((d, di) => {
      const ps = inWeek.filter((p) => p.date === ymd(d)).sort((a, b) => a.time.localeCompare(b.time));
      return `<div class="day ${ps.some((p) => sel && p.id === sel.id) ? 'sel' : ''} ${ymd(d) === today ? 'today' : ''}" style="--i:${di}"><div class="h">${DAY_NAMES[d.getDay()]} <span>${d.getDate()}</span></div>
        ${ps.map((p) => { const sc = S.scripts.find((x) => x.id === p.scriptId), th = themeByName(sc ? sc.style.theme : p.theme) || THEMES[0];
          return `<button type="button" class="slot" data-post="${p.id}"><div class="thumb" style="--bg:${th.bg};--fg:${th.fg};--ac:${th.ac}"><span>${esc(p.title)}</span></div>
          <span class="t">${time12(p.time)}</span><span class="chip ${p.status === 'posted' ? 'good' : ''}">${p.status === 'posted' ? '✓ Posted' : p.trial ? 'Trial reel' : 'Scheduled'}</span></button>`; }).join('') || `<button type="button" class="slot empty" data-add="${ymd(d)}" aria-label="Add post">+</button>`}
      </div>`; }).join('')}</div>
    <aside class="panel side">${side}</aside>
  </div>`;
  $('#prevW').onclick = () => { S.weekOffset--; save(); viewCalendar(); };
  $('#nextW').onclick = () => { S.weekOffset++; save(); viewCalendar(); };
  const tw = $('#thisW'); if (tw) tw.onclick = () => { S.weekOffset = 0; save(); viewCalendar(); };
  $$('[data-post]').forEach((el) => el.onclick = () => { S.selPost = el.dataset.post; save(); viewCalendar(); });
  $$('[data-add]').forEach((el) => el.onclick = () => openSchedule(active().id, el.dataset.add));
  const sh = $('#schedHere'); if (sh) sh.onclick = () => openSchedule(active().id, null);
  if (!sel) return;
  $('#tFeed').onclick = () => { sel.feed = !sel.feed; save(); viewCalendar(); };
  $('#tTrial').onclick = () => { sel.trial = !sel.trial; save(); viewCalendar(); };
  const pd = $('#pDate'), pt = $('#pTime');
  if (pd) pd.onchange = () => { if (!pd.value) return; sel.date = pd.value; S.weekOffset = weekOf(sel.date); save(); viewCalendar(); };
  if (pt) pt.onchange = () => { if (pt.value) { sel.time = pt.value; save(); viewCalendar(); } };
  $('#postNow').onclick = () => { if (sel.status === 'posted') return; const n = new Date(); sel.status = 'posted'; sel.date = ymd(n); sel.time = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; S.weekOffset = 0; S.statsPost = sel.id; save(); toast('Marked as posted'); confetti(); viewCalendar(); };
  $('#rmPost').onclick = () => { S.posts = S.posts.filter((p) => p.id !== sel.id); S.selPost = null; save(); viewCalendar(); };
}
const sdlg = $('#schedule'); let schedFor = null;
function openSchedule(scriptId, date) {
  const sc = S.scripts.find((x) => x.id === scriptId) || active(); schedFor = sc.id;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('#schTitle').textContent = sc.title; $('#schDate').value = date || ymd(tomorrow); $('#schTime').value = '08:00';
  $('#schFeed').checked = true; $('#schTrial').checked = false; $('#schWarn').hidden = !!videoOf(sc);
  sdlg.showModal();
}
sdlg.addEventListener('close', () => {
  if (sdlg.returnValue !== 'save' || !schedFor) return;
  const sc = S.scripts.find((x) => x.id === schedFor); if (!sc) return; ensurePosts();
  const p = { id: uid(), scriptId: sc.id, title: sc.title, date: $('#schDate').value, time: $('#schTime').value || '08:00', status: 'scheduled', feed: $('#schFeed').checked, trial: $('#schTrial').checked };
  S.posts.push(p); S.selPost = p.id; S.weekOffset = weekOf(p.date); save();
  toast(`Scheduled ${DAY_NAMES[parseDay(p.date).getDay()]} ${time12(p.time)}`); go(3);
});

/* ---------- 05 Insights ---------- */
function series(days, seed, end) {
  const r = rng(seed); let v = end * 0.08; const out = [];
  for (let i = 0; i < days; i++) { const t = i / (days - 1); v += (end - v) * (0.05 + 0.04 * r()) + (t > 0.55 && t < 0.62 ? end * 0.02 : 0); out.push(v); }
  out[days - 1] = end; return out;
}
function areaPath(vals, w, h, lo, hi, close) {
  const span = hi - lo || 1, pts = vals.map((v, i) => [i / Math.max(1, vals.length - 1) * w, h - (v - lo) / span * h]);
  const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  return close ? d + ` L${w} ${h} L0 ${h}Z` : d;
}
function postStats(p) {
  const r = rng(hash(p.title)), sc = S.scripts.find((x) => x.id === p.scriptId), vs = virality(sc || { blocks: [{ type: 'hook', text: p.title }], style: { pace: 'Balanced' } }).score;
  const v = Math.round((8000 + r() * 40000) * (0.6 + vs / 160)), d1 = Math.round(v * (0.62 + r() * 0.1)), d3 = Math.round(v * (0.8 + r() * 0.08));
  return { views: v, likes: Math.round(v * (0.02 + r() * 0.02)), comments: Math.round(v * (0.004 + r() * 0.005)), shares: Math.round(v * (0.012 + r() * 0.01)), saves: Math.round(v * (0.03 + r() * 0.02)), d1, d3, watch: (15 + r() * 15).toFixed(1) };
}
function sampleModel(days) {
  const f = Math.round(15057 * days / 30), ser = series(days, 42 + days, Math.max(f, 1200)), views = days === 7 ? 540000 : days === 90 ? 8100000 : 2900000, r = rng(7);
  const cells = Array.from({ length: 35 }, (_, i) => i > 31 ? null : i < 26 ? [3, 2, 1][Math.floor(r() * 3)] : 0);
  return { live: false, ranges: [7, 30, 90], handle: S.handle, avatar: '', series: ser, followers: Math.round(ser[ser.length - 1]), gain: Math.round(13752 * days / 30), views, reach: Math.round(views * 0.336),
    newFollowers: Math.round(13358 * days / 30), interactions: Math.round(views * 0.12), audience: { followers: Math.round(views * 0.053), non: Math.round(views * 0.93) },
    heat: { cells, daysWith: 26, daysTotal: 31, streak: 3 },
    reels: FEED.map((x, i) => ({ id: x.id, title: x.title, g: x.g, views: [475e3, 365e3, 312e3, 174e3, 150e3, 107e3][i], mult: [27, 21, 18, 9.9, 8.6, 6.1][i] })) };
}
function liveModel(d) {
  const cells = d.heat.cells.map((n) => n == null ? null : Math.min(3, n));
  return { live: true, ranges: [7, 14, 30], handle: d.profile.username, avatar: d.profile.avatar, series: d.series, followers: d.profile.followers, gain: d.newFollowers,
    views: d.views, reach: d.reach, newFollowers: d.newFollowers, interactions: d.interactions, audience: d.audience, heat: { cells, daysWith: d.heat.daysWith, daysTotal: d.heat.daysTotal, streak: d.heat.streak }, reels: d.reels, notes: d.notes };
}
let statsReel = null;
function viewAnalytics() {
  ensurePosts();
  const connected = IG.connected();
  if (connected && (IG.status === 'idle' || (IG.status === 'ok' && IG.data && IG.data.days !== S.igRange))) {
    IG.refresh(S.igRange).catch(() => {}).finally(() => { renderIgCard(); if (onStage('analytics')) viewAnalytics(); });
    renderIgCard();
  }
  const loading = connected && (IG.status === 'idle' || IG.status === 'loading');
  const range = connected ? S.igRange : S.range;
  const head = (right) => `<div class="toolbar">${connected ? `<span class="chip live"><i class="dot"></i> Live${IG.fetchedAt ? ' · updated ' + new Date(IG.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>` : '<span class="chip">Sample data</span>'}<span class="spacer"></span>${right}</div>`;
  if (loading) {
    $('#view').innerHTML = head('') + `<div class="kpis">${[0, 1, 2, 3].map(() => '<div class="kpi skel"></div>').join('')}</div><div class="an"><div class="panel skel tall"></div><div class="panel skel tall"></div></div>`; return;
  }
  if (connected && IG.status === 'error') {
    $('#view').innerHTML = head('') + `<div class="panel errbox"><h3>Couldn’t load your Instagram data</h3><p>${esc(IG.error)}</p><div class="row"><button class="btn primary" id="retry" type="button">${svg('refresh', 16)} Try again</button><button class="btn" id="reconnect" type="button">Reconnect</button></div></div>`;
    $('#retry').onclick = () => { IG.refresh(S.igRange).catch(() => {}).finally(() => { renderIgCard(); if (onStage('analytics')) viewAnalytics(); }); viewAnalytics(); };
    $('#reconnect').onclick = openIg; return;
  }
  const M = connected && IG.data ? liveModel(IG.data) : sampleModel(S.range);
  const opts = M.ranges.map((d) => `<option value="${d}" ${d === range ? 'selected' : ''}>Last ${d} days</option>`).join('');
  const val = (v, kind) => v == null ? '<span class="na" title="Not available for this account">n/a</span>' : `<span data-count="${v}" data-kind="${kind || 'compact'}">0</span>`;
  const W = 900, H = 240;
  let chart;
  if (M.series && M.series.length > 1) {
    const lo = Math.min(...M.series), hi = Math.max(...M.series), pad = (hi - lo) * 0.12 || 1, a = lo - pad, b = hi + pad;
    chart = `<svg viewBox="0 0 ${W} ${H + 16}" class="areachart" role="img" aria-label="Follower growth">
      ${[0, 1, 2, 3].map((i) => `<line x1="0" x2="${W}" y1="${H - i * H / 3}" y2="${H - i * H / 3}" class="grid"/><text x="0" y="${H - i * H / 3 - 5}" class="axis">${fmt(a + (b - a) * i / 3)}</text>`).join('')}
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".38"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>
      <linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".6" stop-color="#ec4899"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
      <path class="area" d="${areaPath(M.series, W, H, a, b, true)}" fill="url(#ga)"/><path class="line draw" pathLength="1" d="${areaPath(M.series, W, H, a, b)}" fill="none" stroke="url(#gl)" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  } else chart = '<p class="muted pad">Follower history needs an account with at least 100 followers.</p>';
  const aud = M.audience, pct = aud ? Math.round(aud.non / (aud.non + aud.followers) * 100) : 0, C = 2 * Math.PI * 15.9;
  const cells = M.heat.cells;
  const heat = `<div class="heatwrap"><div class="heat">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<em>${d}</em>`).join('')}${cells.map((n, i) => n == null ? '<i class="off"></i>' : `<i class="l${n}" style="--i:${i}"></i>`).join('')}</div>
    <div class="heatstats"><div><b>${M.heat.daysWith}<small>/${M.heat.daysTotal}</small></b><span>days with a post</span></div><div><b>${M.heat.streak}</b><span>day streak</span></div></div></div>`;
  const reelCards = M.reels.slice(0, 6).map((x, i) => `<${x.permalink ? `a href="${esc(x.permalink)}" target="_blank" rel="noopener"` : 'div'} class="tr" style="--c1:${x.g ? x.g[0] : '#312e81'};--c2:${x.g ? x.g[1] : '#0b0b1a'};--i:${i}">
    ${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="shade"></span>${x.mult ? `<span class="mult">${x.mult}×</span>` : ''}<div class="cap2">${esc(x.title)}<span>${svg('play', 12)} ${fmt(x.views)}</span></div></${x.permalink ? 'a' : 'div'}>`).join('');
  /* per-video stats */
  let stats = '';
  if (M.live) {
    const sr = M.reels.find((r) => r.id === statsReel) || M.reels[0];
    if (sr) {
      const items = [['eye', 'Views', sr.views], ['heart', 'Likes', sr.likes], ['sparkles', 'Comments', sr.comments], ['arrow', 'Shares', sr.shares], ['download', 'Saves', sr.saves], ['users', 'Reach', sr.reach]], mx = Math.max(1, sr.likes, sr.comments, sr.shares, sr.saves);
      stats = `<div class="toolbar"><select id="statsSel" aria-label="Reel">${M.reels.map((r) => `<option value="${esc(r.id)}" ${r.id === sr.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select><span class="spacer"></span><span class="muted">Posted ${new Date(sr.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${sr.avgWatch ? ` · avg. watch ${sr.avgWatch.toFixed(1)} s` : ''}</span></div>
      <div class="kpis six">${items.map(([ic, l, v], i) => `<div class="kpi" style="--i:${i}"><div class="l">${svg(ic, 15)} ${l}</div><div class="v"><span data-count="${v}" data-kind="int">0</span></div></div>`).join('')}</div>
      <div class="panel bars"><h3>Engagement mix</h3>${[['Likes', sr.likes], ['Comments', sr.comments], ['Shares', sr.shares], ['Saves', sr.saves]].map(([l, v]) => `<div class="bar"><span>${l}</span><div><i style="width:${v / mx * 100}%"></i></div><b>${v.toLocaleString()}</b></div>`).join('')}</div>`;
    } else stats = '<div class="panel muted">No reels found in your recent posts.</div>';
  } else {
    const posted = S.posts.filter((p) => p.status === 'posted'), sp = posted.find((p) => p.id === S.statsPost) || posted[posted.length - 1], st = sp && postStats(sp);
    stats = st ? `<div class="toolbar"><select id="statsPost" aria-label="Video">${posted.map((p) => `<option value="${p.id}" ${p.id === sp.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select><span class="spacer"></span><span class="muted">Posted ${parseDay(sp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · sample numbers</span></div>
      <div class="kpis five">${[['eye', 'Views', st.views], ['heart', 'Likes', st.likes], ['sparkles', 'Comments', st.comments], ['arrow', 'Shares', st.shares], ['download', 'Saves', st.saves]].map(([ic, l, v], i) => `<div class="kpi" style="--i:${i}"><div class="l">${svg(ic, 15)} ${l}</div><div class="v"><span data-count="${v}" data-kind="int">0</span></div></div>`).join('')}</div>
      <div class="panel"><div class="ph"><h3>Views since posting</h3><span class="muted">Avg. watch ${st.watch} s</span></div>
        <svg viewBox="0 0 900 170" class="areachart" role="img" aria-label="Views since posting"><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".3"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
        <path d="M0 160 C80 80 140 40 260 32 S700 24 900 10 V170 H0Z" fill="url(#g2)"/><path class="line draw" pathLength="1" d="M0 160 C80 80 140 40 260 32 S700 24 900 10" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round"/></svg>
        <div class="axisrow"><span>Posted</span><span>Day 1 · ${st.d1.toLocaleString()}</span><span>Day 3 · ${st.d3.toLocaleString()}</span><span>Day 7 · ${st.views.toLocaleString()}</span></div></div>`
      : '<div class="panel muted">Mark a post as posted on the Calendar to see its stats here.</div>';
  }
  $('#view').innerHTML = head(`${M.live ? `<button class="btn" id="refresh" type="button">${svg('refresh', 16)} Refresh</button>` : `<button class="btn primary" id="connectCta" type="button">${svg('camera', 16)} Connect Instagram for real numbers</button>`}<select id="range" aria-label="Date range">${opts}</select>`) + `
  ${M.notes && M.notes.length ? `<details class="notes"><summary>${M.notes.length} metric${M.notes.length > 1 ? 's' : ''} unavailable</summary><ul>${M.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
  <div class="kpis">${[['eye', 'Views', M.views, 'compact'], ['users', 'Accounts reached', M.reach, 'compact'], ['userplus', 'New followers', M.newFollowers, 'plus'], ['heart', 'Interactions', M.interactions, 'compact']].map(([ic, l, v, k], i) => `<div class="kpi" style="--i:${i}"><div class="l">${svg(ic, 16)} ${l}</div><div class="v">${val(v, k)}</div></div>`).join('')}</div>
  <div class="an">
    <div class="panel"><h3>Followers</h3><div class="bigrow"><span class="big" data-count="${M.followers}" data-kind="int">0</span>${M.gain != null ? `<span class="delta ${M.gain < 0 ? 'neg' : ''}">${M.gain >= 0 ? '+' : ''}${Math.round(M.gain).toLocaleString()}</span>` : ''}</div>${chart}</div>
    <div class="stack">
      <div class="panel"><h3>Who’s watching</h3>${aud ? `<div class="donutwrap"><svg width="132" height="132" viewBox="0 0 42 42" role="img" aria-label="${pct}% non-followers"><circle cx="21" cy="21" r="15.9" class="d-bg"/><circle cx="21" cy="21" r="15.9" class="d-fg" stroke-dasharray="${C * pct / 100} ${C}" transform="rotate(-90 21 21)"/><text x="21" y="23.5" text-anchor="middle" class="d-n">${pct}%</text></svg>
        <div class="legend"><div><span><i class="a"></i>Non-followers</span><b>${fmt(aud.non)}</b></div><div><span><i class="b"></i>Followers</span><b>${fmt(aud.followers)}</b></div></div></div>` : '<p class="muted">Audience split is not available for this account yet.</p>'}</div>
      <div class="panel"><h3>Posting</h3>${heat}</div>
    </div></div>
  <h3 class="sect">${M.live ? 'Top reels (last 30 days)' : 'Top reels'}</h3>
  ${M.reels.length ? `<div class="top-reels">${reelCards}</div>` : '<div class="panel muted">No reels found in your recent posts.</div>'}
  <h3 class="sect">${M.live ? 'Reel breakdown' : 'Latest video'}</h3>${stats}`;
  $('#range').onchange = (e) => { if (connected) { S.igRange = +e.target.value; } else S.range = +e.target.value; save(); viewAnalytics(); };
  const rf = $('#refresh'); if (rf) rf.onclick = () => { IG.refresh(S.igRange).catch(() => {}).finally(() => { renderIgCard(); if (onStage('analytics')) viewAnalytics(); }); viewAnalytics(); };
  const cc = $('#connectCta'); if (cc) cc.onclick = openIg;
  const ss = $('#statsSel'); if (ss) ss.onchange = (e) => { statsReel = e.target.value; viewAnalytics(); };
  const sp2 = $('#statsPost'); if (sp2) sp2.onchange = (e) => { S.statsPost = e.target.value; save(); viewAnalytics(); };
  countUps();
}

/* ---------- 06 Remix ---------- */
function slidesFor(sc) { const body = sc.blocks.filter((b) => b.type === 'body' && b.text.trim()).slice(0, 6); return [{ cover: true, text: sc.title }, ...body.map((b, i) => ({ n: i + 1, text: b.text }))]; }
function hooksFor(sc) {
  const t = sc.title.replace(/[.!?]+$/, ''), hook = (sc.blocks.find((b) => b.type === 'hook') || {}).text || t;
  const num = ((hook.match(/\$?\d[\d,.]*[k%]?/i) || [])[0] || '').replace(/[,.]+$/, '');
  return [`${t}. Here's what to do instead.`, num ? `${num}: the number nobody in your niche talks about.` : 'Nobody in your niche talks about this.', `I tried "${t.toLowerCase()}" so you don't have to.`, `The mistake behind "${t.toLowerCase()}" (and the fix).`];
}
function drawSlide(slide, sc, total) {
  const th = themeByName(sc.style.theme) || THEMES[0], c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const x = c.getContext('2d'), cover = slide.cover;
  x.fillStyle = cover ? '#14141c' : th.bg; x.fillRect(0, 0, 1080, 1350);
  const g = x.createRadialGradient(900, 150, 0, 900, 150, 700); g.addColorStop(0, th.ac + '55'); g.addColorStop(1, th.ac + '00'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  const ink = cover ? '#ffffff' : th.fg;
  x.fillStyle = cover ? '#9a9ab2' : th.ac; x.font = cover ? '500 34px ui-monospace,Menlo,monospace' : '800 140px Inter,system-ui,sans-serif'; x.fillText(cover ? 'SWIPE →' : String(slide.n), 90, cover ? 140 : 230);
  x.fillStyle = ink; const size = cover ? 96 : 72; x.font = `800 ${size}px Inter,system-ui,sans-serif`;
  const lines = []; let line = '';
  for (const w of words(slide.text)) { const tst = line ? line + ' ' + w : w; if (x.measureText(tst).width > 900 && line) { lines.push(line); line = w; } else line = tst; }
  if (line) lines.push(line);
  const lh = size * 1.15; let y = 1350 - 150 - (lines.length - 1) * lh; lines.forEach((l) => { x.fillText(l, 90, y); y += lh; });
  x.fillStyle = ink; x.globalAlpha = 0.6; x.font = '500 30px Inter,system-ui,sans-serif'; x.fillText(`@${handle()}`, 90, 1290); x.textAlign = 'right'; x.fillText(`${(slide.n || 0) + 1}/${total}`, 990, 1290);
  return c;
}
function viewCarousels() {
  ensurePosts();
  const withScript = S.posts.filter((p) => p.status === 'posted' && S.scripts.some((x) => x.id === p.scriptId));
  const winner = withScript.map((p) => ({ p, s: postStats(p) })).sort((a, b) => b.s.views - a.s.views)[0];
  const sc = winner ? S.scripts.find((x) => x.id === winner.p.scriptId) : active(), slides = slidesFor(sc), hooks = hooksFor(sc), th = themeByName(sc.style.theme);
  const short = (t) => { const w = words(t); return w.length > 9 ? w.slice(0, 9).join(' ') + '…' : t; };
  $('#view').innerHTML = `
  <div class="toolbar"><span class="chip hot">${svg('flame', 14)} ${winner ? 'Winner' : 'Active script'}</span><h2>${esc(sc.title)}</h2><span class="spacer"></span>${winner ? `<span class="chip">${svg('eye', 14)} ${winner.s.views.toLocaleString()}</span>` : '<span class="muted">Mark a video as posted to pick a winner automatically</span>'}</div>
  <div class="remix">
    <div class="stage-phone sm"><div class="phone"><canvas id="pv" width="720" height="1280"></canvas><span class="phone-badge">THE VIDEO</span></div></div>
    <div class="remix-col">
      <section class="panel" style="--ac:${th.ac}">
        <div class="ph"><h3>Carousel <small class="muted">${slides.length} slides</small></h3><div class="row"><span class="chip good">${svg('check', 13)} Ready</span><button class="btn primary" id="dl" type="button">${svg('download', 16)} Download PNGs</button></div></div>
        <div class="slides">${slides.map((s, i) => s.cover ? `<div class="slide cover" style="--i:${i}"><span class="sw">SWIPE →</span>${esc(s.text)}</div>` : `<div class="slide" style="--i:${i};--bg:${th.bg};--fg:${th.fg}"><span class="num">${s.n}</span>${esc(short(s.text))}</div>`).join('')}</div>
      </section>
      <section class="panel hooks"><h3>New hooks <small class="muted">from the ${winner ? 'winner' : 'script'}</small></h3>
        ${hooks.map((h, i) => `<div style="--i:${i}"><span>${svg('sparkles', 16)} ${esc(h)}</span><button class="btn sm" type="button" data-h="${i}">New video from this</button></div>`).join('')}</section>
      <div><button class="btn primary" id="again" type="button">Start the next video ${svg('arrow', 16)}</button></div>
    </div>
  </div>`;
  previews.push(RV.preview($('#pv'), planFor(sc)));
  $('#dl').onclick = async () => {
    for (const [i, s] of slides.entries()) { const a = document.createElement('a'); a.href = drawSlide(s, sc, slides.length).toDataURL('image/png'); a.download = `${slug(sc.title)}-${i + 1}.png`; a.click(); await sleep(250); }
    toast(`Downloaded ${slides.length} slides`);
  };
  $$('[data-h]').forEach((b) => b.onclick = () => {
    const n = JSON.parse(JSON.stringify(sc)); Object.assign(n, { id: uid(), source: 'Remix' }); normalizeScript(n);
    n.blocks[n.blocks.findIndex((x) => x.type === 'hook')].text = hooks[+b.dataset.h]; n.title = hooks[+b.dataset.h].replace(/[.:].*$/, '');
    addScript(n); toast('New script created from the hook'); go(1);
  });
  $('#again').onclick = () => go(0);
}

const VIEWS = { feed: viewFeed, script: viewScript, production: viewProduction, calendar: viewCalendar, analytics: viewAnalytics, carousels: viewCarousels };

/* ---------- dialogs ---------- */
const dlg = $('#settings');
function openSettings() {
  $('#setWebhook').value = S.settings.webhook; $('#setAuth').value = S.settings.auth; $('#setHandle').value = handle();
  $('#setHandle').disabled = IG.connected(); $('#handleNote').textContent = IG.connected() ? 'Taken from your connected Instagram account.' : '';
  dlg.showModal();
}
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  S.settings.webhook = $('#setWebhook').value.trim(); S.settings.auth = $('#setAuth').value.trim();
  if (!IG.connected()) S.handle = ($('#setHandle').value.trim() || 'yourbrand').replace(/^@/, '');
  save(); render(); toast('Settings saved');
});
$('#openSettings').onclick = openSettings;
$('#resetAll').onclick = () => { if (confirm('Clear all scripts, posts and settings on this device?')) { localStorage.removeItem('gr_state'); location.reload(); } };

const igd = $('#igDialog');
function igMsg(text, kind) { const m = $('#igMsg'); m.textContent = text; m.className = 'note ' + (kind || ''); }
function openIg() {
  const c = IG.config() || {};
  $('#igHost').value = c.host || 'graph.instagram.com'; $('#igId').value = c.userId || ''; $('#igToken').value = '';
  $('#igToken').placeholder = c.token ? 'Token saved. Paste a new one to replace it.' : 'Paste your access token';
  $('#igRemember').checked = IG.remembered(); $('#igDisconnect').hidden = !IG.connected();
  igMsg(IG.connected() && IG.profile ? `Connected as @${IG.profile.username}.` : '', IG.connected() ? 'ok' : '');
  if (dlg.open) dlg.close(); igd.showModal();
}
$('#igCard').onclick = openIg;
$('#igTest').onclick = async () => {
  const old = IG.config() || {}, token = $('#igToken').value.trim() || old.token || '';
  if (!token) { igMsg('Paste an access token first.', 'bad'); return; }
  igMsg('Checking with Instagram…', '');
  try {
    const prof = await IG.connect({ host: $('#igHost').value, userId: $('#igId').value.trim(), token }, $('#igRemember').checked);
    igMsg(`Connected as @${prof.username} · ${fmt(prof.followers)} followers`, 'ok');
    S.handle = prof.username || S.handle; save(); $('#igDisconnect').hidden = false; $('#igToken').value = ''; renderIgCard();
    if (onStage('analytics')) viewAnalytics();
  } catch (e) { igMsg(e.message, 'bad'); }
};
$('#igDisconnect').onclick = () => { IG.disconnect(); igMsg('Disconnected. Your token was removed from this browser.', ''); $('#igDisconnect').hidden = true; renderIgCard(); if (onStage('analytics')) viewAnalytics(); };
igd.addEventListener('close', () => { if (onStage('analytics')) viewAnalytics(); });

/* ---------- wiring ---------- */
$('#nextBtn').onclick = () => go(S.stage + 1);
document.addEventListener('keydown', (e) => {
  if (/TEXTAREA|INPUT|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (onStage('feed') && $('#topReel')) { if (e.key === 'ArrowRight') { $('#saveReel').click(); return; } if (e.key === 'ArrowLeft') { $('#skip').click(); return; } }
  if (e.key === 'ArrowRight') go(S.stage + 1); if (e.key === 'ArrowLeft') go(S.stage - 1);
});
addEventListener('resize', moveGlider);
S.scripts.forEach((sc) => { if (sc.prod.status === 'running') sc.prod = defaultProd(); });
buildNav();
{ const v = $('#view'); v.classList.add('enter'); setTimeout(() => v.classList.remove('enter'), 1200); }
render();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveGlider);
})();
