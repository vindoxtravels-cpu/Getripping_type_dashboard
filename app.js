/* Reel Studio – short-form video workflow dashboard. No build step, no dependencies. */
(() => {
const STAGES = [
  { id: 'feed',       n: '01', name: 'Swipe',     tab: 'My Feed' },
  { id: 'script',     n: '02', name: 'Script',    tab: 'Scripts' },
  { id: 'production', n: '03', name: 'Produce',   tab: 'Production' },
  { id: 'calendar',   n: '04', name: 'Post',      tab: 'Calendar' },
  { id: 'analytics',  n: '05', name: 'Analyze',   tab: 'Analytics' },
  { id: 'carousels',  n: '06', name: 'Repurpose', tab: 'Carousels' },
];

const FEED = [
  { id: 1, title: 'Free trials are killing your SaaS', views: '2.4M', mult: 31, g: ['#0f3d2e', '#08130f'], why: ['Hook in 1 s', 'Names the enemy', 'A number up front'] },
  { id: 2, title: 'The pricing mistake everyone makes', views: '1.1M', mult: 14, g: ['#8b5cf6', '#2a1260'], why: ['Pattern interrupt', 'Specific mistake', 'Payoff in 10 s'] },
  { id: 3, title: 'I replaced my agency with 3 agents', views: '880K', mult: 11, g: ['#b45309', '#2a1303'], why: ['Bold claim', 'Concrete number', 'Open loop'] },
  { id: 4, title: 'Stop selling AI tools. Sell the job.', views: '365K', mult: 21, g: ['#111', '#222'], why: ['Contrarian', 'Clear audience', 'One idea'] },
  { id: 5, title: 'Steal 100 users from your competitor', views: '312K', mult: 18, g: ['#1d4ed8', '#0b1a4a'], why: ['Number up front', 'Names the enemy', 'Actionable'] },
  { id: 6, title: 'Are vibe coded apps making money?', views: '174K', mult: 9.9, g: ['#374151', '#0b0f19'], why: ['Question hook', 'Curiosity gap', 'Timely'] },
];

/* [name, background, text, accent] */
const THEMES = [
  ['Software / SaaS', '#0b1020', '#ffffff', '#3b5bff'], ['Minimal', '#f5f5f4', '#111111', '#1d3fe0'],
  ['Neon', '#07000f', '#ffffff', '#ff2bd6'], ['Sci-fi HUD', '#020b12', '#bff7ff', '#00b8d4'],
  ['Comic book', '#fff3c4', '#111111', '#e5372b'], ['Blueprint', '#0b3b8c', '#ffffff', '#4aa8ff'],
  ['Retro 80s', '#1a0633', '#ffffff', '#ff7a00'], ['Chalkboard', '#1f2b24', '#f1f1e6', '#c9a400'],
  ['Whiteboard', '#fafafa', '#1b1b1b', '#2563eb'], ['Pixel art', '#14141f', '#ffffff', '#17a34a'],
  ['Claymation', '#f3d9c4', '#3b2416', '#c2410c'], ['Paper cutouts', '#efe6d6', '#2a2118', '#c0392b'],
  ['Markers and pencils', '#fffdf6', '#222222', '#ea580c'], ['Editorial', '#f4f1ea', '#111111', '#b91c1c'],
  ['Glossy 3D', '#0d1b2a', '#ffffff', '#0284c7'], ['Cinematic 3D', '#050505', '#f5f5f5', '#d97706'],
  ['Luxury', '#0c0a08', '#f3e7c9', '#a8841a'], ['Brutalist', '#ffffff', '#000000', '#ff3b00'],
  ['Collage', '#f0e9df', '#1e1e1e', '#2b9348'], ['Watercolour', '#f6f1fb', '#2d2340', '#8b5cf6'],
  ['Newsroom', '#0f172a', '#ffffff', '#dc2626'], ['Vaporwave', '#2b0f3a', '#ffffff', '#0d9488'],
  ['Hand-drawn', '#fbfaf5', '#222222', '#0284c7'], ['Cartoon', '#ffe8f0', '#1a1a1a', '#e11d48'],
  ['UI', '#f8fafc', '#0f172a', '#6366f1'],
];
const FORMATS = ['Basic Motion', 'Presenter (avatar)', 'Talking head + B-roll'];
const WPS = 2.6; // spoken words per second

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRADS = [['#0b1020', '#1d3fe0'], ['#0f1a12', '#2f7d4f'], ['#e7e7ea', '#9aa0aa'], ['#f1ecfb', '#6d4bd8']];

const defaultProd = () => ({ steps: [0, 0, 0, 0], render: 0, status: 'idle', log: [], videoUrl: null });
const defaultState = () => ({
  v: 2, handle: 'yourbrand', stage: 0,
  saved: [], selectedSaved: null, skipped: [], history: [], customReels: [],
  scripts: [], activeId: null,
  posts: null, weekOffset: 0, selPost: null, statsPost: null,
  settings: { webhook: '', auth: '' }, range: 30,
});

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (t) => (String(t).trim().match(/\S+/g) || []);
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => new Date(s + 'T00:00:00');
const time12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
/* seeded RNG so charts are stable between reloads */
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h || 1; };

/* ---------- state ---------- */
let S;
try { S = Object.assign(defaultState(), JSON.parse(localStorage.getItem('gr_state') || '{}')); } catch { S = defaultState(); }
// migrate v1 (single script) into the library
if (S.script) { S.scripts.push(Object.assign({ id: uid(), style: { format: FORMATS[0], theme: THEMES[0][0] }, prod: S.prod || defaultProd() }, S.script)); S.activeId = S.scripts[S.scripts.length - 1].id; }
delete S.script; delete S.prod; delete S.schedule;
if (S.handle === 'getripping') S.handle = 'yourbrand';
const save = () => { try { localStorage.setItem('gr_state', JSON.stringify(S)); } catch {} };
save(); // persist any migration immediately

const allReels = () => [...S.customReels, ...FEED];
const themeOf = (sc) => THEMES.find((t) => t[0] === sc.style.theme) || THEMES[0];

/* ---------- script library ---------- */
function newScript(item) {
  const t = item ? item.title : 'Stop giving out free trials';
  return {
    id: uid(), title: t, source: item ? 'From Research' : 'Blank',
    style: { format: FORMATS[0], theme: THEMES[0][0] }, prod: defaultProd(),
    blocks: [
      { type: 'hook', text: "If you're giving out a free trial in 2026, you might as well be lighting money on fire." },
      { type: 'body', text: 'Do this instead.' },
      { type: 'body', text: 'Most of us are building with AI now, which means every free trial user costs real money in tokens and compute.' },
      { type: 'body', text: "So that's not a free trial. You're paying THEM to use your product." },
      { type: 'comment', text: 'And if you want the free $50k per month playbook, comment "PLAYBOOK" and follow for more.' },
    ],
  };
}
function addScript(sc) { S.scripts.unshift(sc); S.activeId = sc.id; save(); return sc; }
function active() {
  let sc = S.scripts.find((x) => x.id === S.activeId);
  if (!sc) sc = S.scripts[0] || addScript(newScript(null));
  S.activeId = sc.id;
  return sc;
}
const scriptWords = (sc) => sc.blocks.flatMap((b) => words(b.text));
const seconds = (sc) => scriptWords(sc).length / WPS;
function checks(sc) {
  const hook = sc.blocks.find((b) => b.type === 'hook');
  const body = sc.blocks.filter((b) => b.type === 'body');
  const cm = sc.blocks.find((b) => b.type === 'comment');
  return [
    ['Hook in the first 3 s', sc.blocks[0] === hook && !!hook && words(hook.text).length > 0 && words(hook.text).length <= 20],
    ['One idea a line', body.length > 0 && body.every((b) => words(b.text).length <= 24)],
    ['Ends on a comment', !!cm && /comment/i.test(cm.text)],
    ['Same words on screen', sc.blocks.length > 0 && sc.blocks.every((b) => b.text.trim())],
  ];
}

/** Score a script out of 100 and pin each fix to the second it happens. */
function virality(sc) {
  let score = 100; const fixes = []; let t = 0; const at = [];
  sc.blocks.forEach((b) => { at.push(t); t += words(b.text).length / WPS; });
  const fix = (sec, pts, msg) => { score -= pts; fixes.push({ t: sec, pts, msg }); };
  const hi = sc.blocks.findIndex((b) => b.type === 'hook');
  if (hi !== 0) fix(0, 25, 'Open on the hook. The first line decides the swipe.');
  else {
    const h = sc.blocks[0].text, hs = words(h).length / WPS;
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
  const bodyCount = sc.blocks.filter((b) => b.type === 'body').length;
  if (bodyCount > 0 && !sc.blocks.some((b) => b.type === 'body' && /\b(instead|but|so|because|here's)\b/i.test(b.text))) fix(at[1] || 0, 4, 'Add a turn ("instead", "but", "so") to keep people watching.');
  return { score: Math.max(5, Math.min(100, Math.round(score))), fixes: fixes.sort((a, b) => a.t - b.t), length: t };
}

/* ---------- shell ---------- */
function renderChrome() {
  $('#stages').innerHTML = STAGES.map((s, i) =>
    `<button class="stage ${i === S.stage ? 'active' : i < S.stage ? 'done' : ''}" data-i="${i}"><span class="n">${s.n}</span>${s.name}</button>`).join('');
  $('#tabs').innerHTML = STAGES.map((s, i) =>
    `<button class="tab ${i === S.stage ? 'active' : ''}" role="tab" aria-selected="${i === S.stage}" data-i="${i}">${s.tab}</button>`).join('');
  $('#stageLabel').textContent = `Stage ${S.stage + 1} of 6`;
  const nx = STAGES[S.stage + 1], nb = $('#nextBtn');
  nb.style.visibility = nx ? 'visible' : 'hidden';
  nb.innerHTML = nx ? `Next: <b>${nx.name}</b> ›` : '';
}
let capTimer = null;
function go(i) { S.stage = Math.max(0, Math.min(5, i)); save(); render(); }
function render() { clearInterval(capTimer); renderChrome(); VIEWS[STAGES[S.stage].id](); }

/* ---------- 01 My Feed ---------- */
function viewFeed() {
  const reels = allReels();
  const rest = reels.filter((f) => !S.saved.includes(f.id) && !S.skipped.includes(f.id));
  const top = rest[0], back = rest[1];
  const sel = reels.find((f) => f.id === (S.selectedSaved ?? S.saved[S.saved.length - 1]));
  $('#view').innerHTML = `
  <div class="bar"><h2>My Feed</h2><span class="pill">SaaS founders</span><span class="pill orange">🔥 Winning in your niche</span><span class="spacer"></span>
    <button class="btn" id="addReelBtn">+ Add reel</button><span class="muted">♡ Saved ${S.saved.length}</span></div>
  <form class="addreel" id="addReel" hidden>
    <input name="title" placeholder="What the reel says, e.g. Your landing page is too long" required>
    <input name="url" type="url" placeholder="instagram.com/reel/… (optional)">
    <input name="views" placeholder="Views, e.g. 420K">
    <input name="mult" type="number" step="0.1" min="0" placeholder="× usual">
    <button class="btn dark">Add to feed</button>
  </form>
  <div class="feed">
    <div class="deck">
      ${back ? `<div class="reel back" style="background:linear-gradient(160deg,${back.g[0]},${back.g[1]})"><div class="t">${esc(back.title)}</div></div>` : ''}
      ${top ? `<div class="reel" id="topReel" style="background:linear-gradient(160deg,${top.g[0]},${top.g[1]})"><div class="stamp">SAVE</div><div class="t">${esc(top.title)}</div><div class="m">${top.mult ? `<span class="mult">${top.mult}×</span>` : ''} ${esc(top.views)}</div></div>`
            : `<div class="card">You've swiped everything. <button class="btn" id="reset">Reload feed</button></div>`}
      <div class="deck-btns">
        <button class="round skip" id="skip" title="Skip (←)" aria-label="Skip">✕</button>
        <button class="round" id="undo" title="Undo" aria-label="Undo">↶</button>
        <button class="round save" id="saveReel" title="Save" aria-label="Save">♥</button>
      </div>
    </div>
    <aside class="side">
      <div class="lab">SAVED</div>
      ${sel ? `<div class="saved-item"><b>${esc(sel.title)}</b>👁 ${esc(sel.views)}${sel.mult ? ` · <span style="color:var(--orange)">🔥 ${sel.mult}× usual</span>` : ''}${sel.url ? ` · <a href="${esc(sel.url)}" target="_blank" rel="noopener">open ↗</a>` : ''}</div>
      <div class="lab">WHY IT WORKS</div>
      <div class="chips">${sel.why.map((w) => `<span class="chip">${esc(w)}</span>`).join('')}</div>` : '<div class="muted">Swipe right (♥) on a reel to save it.</div>'}
      ${S.saved.length > 1 ? `<div class="saved-list">${S.saved.map((id) => { const f = reels.find((x) => x.id === id); return f ? `<button data-sel="${esc(id)}" class="${sel && sel.id === id ? 'sel' : ''}">${esc(f.title)}</button>` : ''; }).join('')}</div>` : ''}
      <button class="btn dark" id="revoice" ${sel ? '' : 'disabled'}>✨ ReVoice into a script</button>
    </aside>
  </div>`;
  const act = (kind) => {
    const el = $('#topReel'); if (!el || !top) return;
    el.classList.add(kind === 'save' ? 'saving' : 'skipping');
    setTimeout(() => {
      S.history.push({ id: top.id, kind });
      if (kind === 'save') { S.saved.push(top.id); S.selectedSaved = top.id; } else S.skipped.push(top.id);
      save(); viewFeed();
    }, 320);
  };
  $('#saveReel').onclick = () => act('save');
  $('#skip').onclick = () => act('skip');
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
function viewScript() {
  const sc = active();
  const draw = () => {
    $('#view').innerHTML = `
    <div class="bar"><input class="title-in" id="sTitle" value="${esc(sc.title)}" aria-label="Script title"><span class="pill" id="dur">${mmss(seconds(sc))}</span><span class="pill blue">⛓ ${esc(sc.source)}</span><span class="spacer"></span><span class="muted">Saved</span></div>
    <div class="script">
      <aside class="lib">
        <button class="btn dark" id="newScript">+ New script</button>
        ${S.scripts.map((x) => `<div class="libitem ${x.id === sc.id ? 'sel' : ''}"><button data-open="${x.id}"><b>${esc(x.title || 'Untitled')}</b><span class="muted">${mmss(seconds(x))} · ${x.prod.status === 'done' ? 'rendered' : 'draft'}</span></button>${S.scripts.length > 1 ? `<button class="x" data-rm="${x.id}" title="Delete script" aria-label="Delete script">✕</button>` : ''}</div>`).join('')}
      </aside>
      <div id="blocks">${sc.blocks.map((b, i) => `
        <div class="blk ${b.type}">${b.type !== 'body' ? `<span class="tag">${b.type === 'hook' ? 'Hook' : 'Comment'}</span>` : ''}
          <textarea data-i="${i}" rows="1" aria-label="${b.type} line">${esc(b.text)}</textarea>
          ${b.type === 'body' ? `<button class="x" data-del="${i}" title="Remove line" aria-label="Remove line">✕</button>` : ''}</div>`).join('')}
        <button class="btn" id="addLine">+ Add line</button>
      </div>
      <aside class="side"><div class="lab">CHECKS</div><ul class="checks" id="checks"></ul>
        <div class="lab">VIRALITY</div><div id="vscore"></div>
        <button class="btn dark" id="toProd" style="margin-top:auto">Produce →</button></aside>
    </div>`;
    const upd = () => {
      $('#checks').innerHTML = checks(sc).map(([l, ok]) => `<li><span class="ck ${ok ? '' : 'bad'}">${ok ? '✓' : ''}</span>${l}</li>`).join('');
      const v = virality(sc); $('#vscore').innerHTML = `<div class="vmini"><b class="${v.score >= 80 ? 'good' : v.score >= 60 ? 'ok' : 'bad'}">${v.score}</b>/100 · ${v.fixes.length} fix${v.fixes.length === 1 ? '' : 'es'}</div>`;
      $('#dur').textContent = mmss(seconds(sc));
    };
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    $$('#blocks textarea').forEach((t) => { grow(t); t.oninput = () => { sc.blocks[+t.dataset.i].text = t.value; sc.prod = sc.prod.status === 'done' ? defaultProd() : sc.prod; grow(t); upd(); save(); }; });
    $$('[data-del]').forEach((b) => b.onclick = () => { sc.blocks.splice(+b.dataset.del, 1); save(); draw(); });
    $$('[data-open]').forEach((b) => b.onclick = () => { S.activeId = b.dataset.open; save(); viewScript(); });
    $$('[data-rm]').forEach((b) => b.onclick = () => { if (!confirm('Delete this script?')) return; S.scripts = S.scripts.filter((x) => x.id !== b.dataset.rm); if (S.activeId === b.dataset.rm) S.activeId = null; save(); viewScript(); });
    $('#newScript').onclick = () => { const n = newScript(null); n.title = 'Untitled script'; n.blocks = [{ type: 'hook', text: '' }, { type: 'body', text: '' }, { type: 'comment', text: '' }]; addScript(n); viewScript(); };
    $('#addLine').onclick = () => { const ci = sc.blocks.findIndex((b) => b.type === 'comment'); sc.blocks.splice(ci < 0 ? sc.blocks.length : ci, 0, { type: 'body', text: '' }); save(); draw(); };
    $('#sTitle').oninput = (e) => { sc.title = e.target.value; save(); };
    $('#toProd').onclick = () => go(2);
    upd();
  };
  draw();
}

/* ---------- 03 Production (the automation core) ---------- */
const PSTEPS = [['📄', 'Script'], ['🎙', 'Voice'], ['🧩', 'Visuals'], ['🎬', 'Edit']];
let runTimer = null;
function phoneHtml(sc, big = true) {
  const [, bg, fg, ac] = themeOf(sc);
  return `<div class="phone${big ? '' : ' small'}" style="background:${bg};color:${fg}"><div class="tag">${esc(sc.style.format)}</div>
    <svg viewBox="0 0 260 460" aria-hidden="true"><path d="M0 380 C80 380 120 350 160 260 S210 130 235 110" stroke="${ac}" stroke-width="4" fill="none"/><path d="M0 380 C80 380 120 350 160 260 S210 130 235 110 V460 H0Z" fill="${ac}22"/><circle cx="235" cy="110" r="6" fill="none" stroke="${ac}" stroke-width="2"/><line x1="0" y1="400" x2="260" y2="400" stroke="${fg}" stroke-opacity=".25" stroke-width="1"/></svg>
    <div class="cap" style="--ac:${ac};color:${fg}">${big ? '' : esc(words(sc.blocks[0]?.text || sc.title).slice(0, 7).join(' '))}</div>${big ? '<div class="prog"><i></i></div>' : ''}</div>`;
}
function viewProduction() {
  const sc = active(), P = sc.prod, total = scriptWords(sc).length, v = virality(sc);
  const detail = (i) => i === 0 ? 'Locked, word for word' : i === 1 ? '<span class="wave">' + Array.from({ length: 24 }, (_, k) => `<i style="height:${6 + Math.abs(Math.sin(k * 1.7)) * 16}px"></i>`).join('') + '</span>'
    : i === 2 ? `${Math.max(6, Math.round(total / 5))} scenes, drawn to the words` : `${esc(sc.style.theme)} · captions · cuts`;
  $('#view').innerHTML = `
  <div class="bar"><h2>${esc(sc.title)}</h2><span class="pill">${mmss(seconds(sc))}</span>
    <select id="fmt" aria-label="Format">${FORMATS.map((f) => `<option ${f === sc.style.format ? 'selected' : ''}>${f}</option>`).join('')}</select>
    <select id="theme" aria-label="Style">${THEMES.map((t) => `<option ${t[0] === sc.style.theme ? 'selected' : ''}>${t[0]}</option>`).join('')}</select>
    <span class="spacer"></span>
    <button class="btn" id="cfg">⚙ Webhook${S.settings.webhook ? ' ✓' : ''}</button>
    <button class="btn orange" id="run" ${P.status === 'running' ? 'disabled' : ''}>${P.status === 'done' ? '↻ Re-run' : '▶ Generate video'}</button></div>
  <div class="prod">
    <div id="phoneWrap">${phoneHtml(sc)}</div>
    <div><div id="steps">${PSTEPS.map((s, i) => `<div class="step"><div class="ic">${s[0]}</div><b>${s[1]}</b><div class="d">${detail(i)}</div><div class="st"></div></div>`).join('')}</div>
      <div class="renderbox"><div class="top">Render <span id="rp">${P.render}%</span></div><div class="meter"><i id="rm" style="width:${P.render}%"></i></div>
        <div class="row" style="justify-content:space-between"><span class="muted" id="rs"></span>
          <button class="btn dark" id="sched" ${P.status === 'done' ? '' : 'disabled'}>Schedule post →</button></div>
        ${P.videoUrl ? `<div style="margin-top:10px"><a href="${esc(P.videoUrl)}" target="_blank" rel="noopener">Open rendered video ↗</a></div>` : ''}
        <div class="log" id="log">${P.log.map(esc).join('<br>')}</div></div>
      <div class="card vcard">
        <div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Virality score</h3><span class="score ${v.score >= 80 ? 'good' : v.score >= 60 ? 'ok' : 'bad'}">${v.score}<small>/100</small></span></div>
        ${v.fixes.length ? `<ul class="fixes">${v.fixes.map((f) => `<li><span class="at">${mmss(f.t)}</span>${esc(f.msg)}<span class="muted">−${f.pts}</span></li>`).join('')}</ul><button class="btn" id="editFix">Fix in script</button>` : '<p class="muted">No fixes. Ready to post.</p>'}
      </div>
    </div></div>`;
  // live caption preview, word by word
  const ws = scriptWords(sc); let k = 0;
  const cap = $('#phoneWrap .cap'), pbar = $('#phoneWrap .prog i');
  const tick = () => { if (!ws.length) return; const w = ws.slice(k, k + 3); cap.innerHTML = w.map((x, j) => j === 1 ? `<em>${esc(x)}</em>` : esc(x)).join(' '); pbar.style.width = ((k + 3) / ws.length * 100) + '%'; k = k + 3 >= ws.length ? 0 : k + 3; };
  tick(); capTimer = setInterval(tick, 650);
  $('#fmt').onchange = (e) => { sc.style.format = e.target.value; save(); viewProduction(); };
  $('#theme').onchange = (e) => { sc.style.theme = e.target.value; save(); viewProduction(); };
  $('#cfg').onclick = openSettings;
  $('#run').onclick = () => runPipeline(sc);
  $('#sched').onclick = () => openSchedule(sc.id, null);
  const ef = $('#editFix'); if (ef) ef.onclick = () => go(1);
  paint(sc);
}
function log(sc, m) { sc.prod.log.push(new Date().toLocaleTimeString() + '  ' + m); sc.prod.log = sc.prod.log.slice(-30); if (onProd(sc)) { const l = $('#log'); l.innerHTML = sc.prod.log.map(esc).join('<br>'); l.scrollTop = 1e9; } }
const onProd = (sc) => STAGES[S.stage].id === 'production' && S.activeId === sc.id && $('#steps');
function paint(sc) {
  if (!onProd(sc)) return; const P = sc.prod;
  $$('#steps .step').forEach((el, i) => { const st = i === 0 ? 2 : P.steps[i]; el.className = 'step ' + (st === 2 ? 'done' : st === 1 ? 'run' : ''); $('.st', el).textContent = st === 2 ? '✓' : ''; });
  $('#rp').textContent = P.render + '%'; $('#rm').style.width = P.render + '%';
  $('#rs').textContent = P.status === 'done' ? '→ Ready to post' : P.status === 'running' ? 'Working…' : 'Not started';
}
/** Build the payload sent to your automation. Keep in sync with README.md → "Webhook contract". */
function buildPayload(sc) {
  const [theme, bg, fg, accent] = themeOf(sc);
  return { handle: S.handle, title: sc.title, duration: mmss(seconds(sc)), script: sc.blocks, text: sc.blocks.map((b) => b.text).join('\n'),
    wordCount: scriptWords(sc).length, format: '9:16', style: { format: sc.style.format, theme, colors: { bg, fg, accent } },
    virality: virality(sc).score, createdAt: new Date().toISOString() };
}
async function runPipeline(sc) {
  const P = sc.prod; if (P.status === 'running') return;
  Object.assign(P, defaultProd(), { status: 'running' }); save();
  if (onProd(sc)) { $('#run').disabled = true; $('#sched').disabled = true; }
  log(sc, 'Pipeline started · ' + sc.style.format + ' · ' + sc.style.theme);
  const finish = (url) => { Object.assign(P, { status: 'done', render: 100, steps: [2, 2, 2, 2] }); if (url) P.videoUrl = url; log(sc, 'Render complete, ready to post'); save(); if (onProd(sc)) viewProduction(); };
  const sim = (done) => {
    let step = 1, pct = 0; P.steps[1] = 1; paint(sc); log(sc, 'Voice: generating');
    const names = ['', 'Voice', 'Visuals', 'Edit'];
    clearInterval(runTimer);
    runTimer = setInterval(() => {
      pct += 4; P.render = Math.min(99, Math.round((((step - 1) * 100) + pct) / 3));
      if (pct >= 100) { P.steps[step] = 2; log(sc, `${names[step]}: done`); pct = 0; step++; if (step > 3) { clearInterval(runTimer); done(); return; } P.steps[step] = 1; log(sc, `${names[step]}: running`); }
      paint(sc);
    }, 120);
  };
  const { webhook, auth } = S.settings;
  if (!webhook) { log(sc, 'No webhook set, running built-in simulation'); sim(() => finish(null)); return; }
  try {
    log(sc, 'POST ' + webhook);
    P.steps[1] = 1; paint(sc);
    const res = await fetch(webhook, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: auth } : {}), body: JSON.stringify(buildPayload(sc)) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let data = {}; try { data = await res.json(); } catch {}
    log(sc, 'Webhook accepted' + (data.jobId ? ' · job ' + data.jobId : ''));
    if (data.videoUrl) { finish(data.videoUrl); return; }
    if (data.statusUrl) { pollStatus(sc, data.statusUrl, finish); return; }
    sim(() => finish(null));
  } catch (e) {
    log(sc, 'Webhook failed: ' + e.message + ' (CORS or network). Falling back to simulation.');
    sim(() => finish(null));
  }
}
function pollStatus(sc, url, finish) {
  const P = sc.prod; let n = 0;
  const t = setInterval(async () => {
    try {
      const d = await (await fetch(url)).json();
      P.render = Math.round(d.progress || 0); P.steps = [2, P.render > 5 ? 2 : 1, P.render > 40 ? 2 : P.render > 5 ? 1 : 0, P.render > 80 ? 1 : 0]; paint(sc);
      log(sc, 'Status: ' + (d.status || P.render + '%'));
      if (d.status === 'done' || d.videoUrl || P.render >= 100) { clearInterval(t); finish(d.videoUrl || null); return; }
    } catch (e) { log(sc, 'Poll error: ' + e.message); }
    if (++n > 300) { clearInterval(t); log(sc, 'Gave up polling'); P.status = 'idle'; save(); }
  }, 2000);
}

/* ---------- 04 Calendar ---------- */
function weekStart(offset) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + offset * 7); return d; }
/** Week offset (0 = this week) containing a YYYY-MM-DD date; rounding absorbs DST hour shifts. */
const weekOf = (day) => Math.floor(Math.round((parseDay(day) - weekStart(0)) / 864e5) / 7);
function ensurePosts() {
  if (S.posts) return;
  const ws = weekStart(0);
  S.posts = ['Stop giving out free trials', 'Do you guys wanna get way more users', 'You can now run Claude on autopilot', '10 lazy marketing tips that work'].map((title, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + 3 + i);
    return { id: uid(), scriptId: null, title, date: ymd(d), time: i === 0 ? '07:51' : '08:00', status: i === 0 ? 'posted' : 'scheduled', feed: true, trial: false, theme: THEMES[[0, 3, 1, 2][i]][0] };
  });
  S.selPost = S.posts[0].id;
}
function viewCalendar() {
  ensurePosts();
  const ws = weekStart(S.weekOffset), days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
  const inWeek = S.posts.filter((p) => days.some((d) => ymd(d) === p.date));
  const posted = inWeek.filter((p) => p.status === 'posted').length;
  let sel = S.posts.find((p) => p.id === S.selPost && inWeek.includes(p)) || inWeek[0];
  const today = ymd(new Date());
  const side = sel ? (() => {
    const sc = S.scripts.find((x) => x.id === sel.scriptId);
    const cap = sc ? sc.blocks.map((b) => b.text).filter(Boolean) : [sel.title];
    return `<div class="who"><span class="avatar">${esc((S.handle[0] || 'y').toUpperCase())}</span>${esc(S.handle)}</div>
      <p style="margin-bottom:10px">${esc(cap[0])}</p>
      ${cap.length > 1 ? `<p class="muted" style="margin-bottom:16px;font-size:14px">${esc(cap[cap.length - 1].slice(0, 110))}${cap[cap.length - 1].length > 110 ? '…' : ''}</p>` : ''}
      <div class="row" style="justify-content:space-between;margin-bottom:12px"><span>Feed</span><button class="toggle ${sel.feed ? 'on' : ''}" id="tFeed" aria-label="Post to feed" aria-pressed="${sel.feed}"></button></div>
      <div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="muted">Trial reel</span><button class="toggle ${sel.trial ? 'on' : ''}" id="tTrial" aria-label="Post as trial reel" aria-pressed="${sel.trial}"></button></div>
      ${sel.status === 'posted' ? '' : `<label class="row" style="justify-content:space-between;margin-bottom:16px"><span class="muted">When</span><span><input type="date" id="pDate" value="${sel.date}"> <input type="time" id="pTime" value="${sel.time}"></span></label>`}
      <button class="postbtn ${sel.status === 'posted' ? '' : 'go'}" id="postNow">${sel.status === 'posted' ? '✓ Posted ' + DAY_NAMES[parseDay(sel.date).getDay()] + ' ' + time12(sel.time) : 'Post now'}</button>
      <button class="linkbtn" id="rmPost">Remove from calendar</button>`;
  })() : `<p class="muted" style="margin-bottom:16px">Nothing scheduled this week.</p><button class="btn dark" id="schedHere">Schedule the active script</button>`;
  $('#view').innerHTML = `
  <div class="bar"><button class="round sm" id="prevW" aria-label="Previous week">‹</button><h2>Week of ${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2><button class="round sm" id="nextW" aria-label="Next week">›</button>
    ${posted ? `<span class="pill green">${posted} posted</span>` : ''}<span class="pill">${inWeek.length - posted} scheduled</span>
    <span class="spacer"></span>${S.weekOffset ? '<button class="btn" id="thisW">This week</button>' : ''}</div>
  <div class="cal">
    <div class="week">${days.map((d) => {
      const ps = inWeek.filter((p) => p.date === ymd(d)).sort((a, b) => a.time.localeCompare(b.time));
      return `<div class="day ${ps.some((p) => sel && p.id === sel.id) ? 'sel' : ''} ${ymd(d) === today ? 'today' : ''}" data-day="${ymd(d)}"><div class="h">${DAY_NAMES[d.getDay()]} <span>${d.getDate()}</span></div>
        ${ps.map((p) => { const sc = S.scripts.find((x) => x.id === p.scriptId); const th = sc ? themeOf(sc) : (THEMES.find((t) => t[0] === p.theme) || THEMES[0]);
          return `<button class="slot" data-post="${p.id}"><div class="thumb" style="background:${th[1]};color:${th[2]};border-color:${th[3]}">${esc(p.title)}</div>
          <div class="muted">${time12(p.time)}</div><span class="pill ${p.status === 'posted' ? 'green' : ''}">${p.status === 'posted' ? '✓ Posted' : 'Scheduled'}</span></button>`; }).join('') || '<button class="slot empty" data-add="' + ymd(d) + '">+</button>'}
      </div>`; }).join('')}</div>
    <aside class="card">${side}</aside>
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
  $('#postNow').onclick = () => { if (sel.status === 'posted') return; const n = new Date(); sel.status = 'posted'; sel.date = ymd(n); sel.time = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; S.weekOffset = 0; S.statsPost = sel.id; save(); toast('Marked as posted'); viewCalendar(); };
  $('#rmPost').onclick = () => { S.posts = S.posts.filter((p) => p.id !== sel.id); S.selPost = null; save(); viewCalendar(); };
}

/* schedule dialog */
const sdlg = $('#schedule');
let schedFor = null;
function openSchedule(scriptId, date) {
  const sc = S.scripts.find((x) => x.id === scriptId) || active(); schedFor = sc.id;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('#schTitle').textContent = sc.title;
  $('#schDate').value = date || ymd(tomorrow); $('#schTime').value = '08:00';
  $('#schFeed').checked = true; $('#schTrial').checked = false;
  $('#schWarn').hidden = sc.prod.status === 'done';
  sdlg.showModal();
}
sdlg.addEventListener('close', () => {
  if (sdlg.returnValue !== 'save' || !schedFor) return;
  const sc = S.scripts.find((x) => x.id === schedFor); if (!sc) return;
  ensurePosts();
  const p = { id: uid(), scriptId: sc.id, title: sc.title, date: $('#schDate').value, time: $('#schTime').value || '08:00', status: 'scheduled', feed: $('#schFeed').checked, trial: $('#schTrial').checked };
  S.posts.push(p); S.selPost = p.id;
  S.weekOffset = weekOf(p.date);
  save(); toast(`Scheduled ${DAY_NAMES[parseDay(p.date).getDay()]} ${time12(p.time)}`); go(3);
});

/* ---------- 05 Analytics ---------- */
function series(days, seed, end) {
  const r = rng(seed); let v = end * 0.08; const out = [];
  for (let i = 0; i < days; i++) { const t = i / (days - 1); v += (end - v) * (0.05 + 0.04 * r()) + (t > .55 && t < .62 ? end * .02 : 0); out.push(v); }
  out[days - 1] = end; return out;
}
function areaPath(vals, w, h, max, close) {
  const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - v / max * h]);
  const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  return close ? d + ` L${w} ${h} L0 ${h}Z` : d;
}
function postStats(p) {
  const r = rng(hash(p.title)), views = Math.round(8000 + r() * 40000), vs = virality(S.scripts.find((x) => x.id === p.scriptId) || { blocks: [{ type: 'hook', text: p.title }] }).score;
  const v = Math.round(views * (0.6 + vs / 160));
  const d1 = Math.round(v * (0.62 + r() * 0.1)), d3 = Math.round(v * (0.8 + r() * 0.08));
  return { views: v, likes: Math.round(v * (0.02 + r() * 0.02)), comments: Math.round(v * (0.004 + r() * 0.005)), shares: Math.round(v * (0.012 + r() * 0.01)), saves: Math.round(v * (0.03 + r() * 0.02)), d1, d3, watch: (15 + r() * 15).toFixed(1) };
}
function viewAnalytics() {
  ensurePosts();
  const days = S.range, f = Math.round(15057 * days / 30);
  const followers = series(days, 42 + days, Math.max(f, 1200)), views = days === 7 ? 540000 : days === 90 ? 8100000 : 2900000;
  const max = Math.ceil(followers[followers.length - 1] / 5000) * 5000 || 5000;
  const W = 900, H = 260, r = rng(7);
  const heat = Array.from({ length: 31 }, (_, i) => i < 26 ? [3, 2, 1][Math.floor(r() * 3)] : 0);
  const reels = FEED.map((x, i) => ({ ...x, v: ['475K', '365K', '312K', '174K', '150K', '107K'][i], m: ['27', '21', '18', '9.9', '8.6', '6.1'][i] }));
  const posted = S.posts.filter((p) => p.status === 'posted');
  const sp = posted.find((p) => p.id === S.statsPost) || posted[posted.length - 1];
  const st = sp && postStats(sp);
  $('#view').innerHTML = `
  <div class="bar"><span class="avatar">${esc((S.handle[0] || 'y').toUpperCase())}</span><h2>@${esc(S.handle)}</h2><span class="spacer"></span>
    <select id="range" aria-label="Date range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
  <p class="demo-note">Sample numbers. Connect your account through the webhook to show real insights.</p>
  <div class="kpis">
    ${[['👁 Views', fmt(views)], ['👥 Accounts reached', fmt(Math.round(views * .336))], ['➕ New followers', '+' + (13358 * days / 30 | 0).toLocaleString()], ['♡ Interactions', fmt(Math.round(views * .12))]]
      .map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>
  <div class="an">
    <div class="card"><h3>Followers</h3><div><span class="big">${Math.round(followers[followers.length - 1]).toLocaleString()}</span><span class="delta">+${(13752 * days / 30 | 0).toLocaleString()}</span></div>
      <svg viewBox="0 0 ${W} ${H + 10}" style="width:100%;margin-top:10px" role="img" aria-label="Follower growth">
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="${W}" y1="${H - i * H / 4}" y2="${H - i * H / 4}" stroke="#eee"/><text x="0" y="${H - i * H / 4 - 4}" font-size="11" fill="#999">${fmt(max / 4 * i)}</text>`).join('')}
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3fe0" stop-opacity=".18"/><stop offset="1" stop-color="#1d3fe0" stop-opacity="0"/></linearGradient></defs>
        <path d="${areaPath(followers, W, H, max, true)}" fill="url(#g)"/><path d="${areaPath(followers, W, H, max)}" fill="none" stroke="#1d3fe0" stroke-width="3"/></svg></div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card"><h3>Who's watching</h3><div class="donutwrap">
        <svg width="140" height="140" viewBox="0 0 42 42" role="img" aria-label="95% non-followers"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#dce4ff" stroke-width="4"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#1d3fe0" stroke-width="4" stroke-dasharray="95 5" transform="rotate(-90 21 21)" stroke-linecap="round"/><text x="21" y="24" text-anchor="middle" font-size="8" font-weight="700" fill="#1d3fe0">95%</text></svg>
        <div class="legend"><div><span><i style="background:#1d3fe0"></i>Non-followers</span><b>${fmt(views * .93)}</b></div><div><span><i style="background:#cdd8ff"></i>Followers</span><b>${fmt(views * .053)}</b></div></div></div></div>
      <div class="card"><h3>Posting</h3><div class="row" style="gap:24px;align-items:flex-start"><div class="heat">${heat.map((h) => `<i style="background:${['#eceef5', '#c0ccff', '#6f8bf0', '#1d3fe0'][h]}"></i>`).join('')}</div>
        <div><div class="big" style="font-size:30px">26<span class="muted">/31</span></div><div class="muted">days with a reel</div><div class="big" style="font-size:30px;margin-top:10px">3</div><div class="muted">day streak</div></div></div></div>
    </div></div>
  <div class="pad" style="padding-top:0"><h3 style="margin-bottom:12px;font-size:18px">Top reels</h3></div>
  <div class="top-reels">${reels.map((x) => `<div class="tr" style="background:linear-gradient(170deg,${x.g[0]},${x.g[1]})"><span class="mult">${x.m}×</span><div>${esc(x.title)}<div class="v">▶ ${x.v}</div></div></div>`).join('')}</div>
  ${st ? `<div class="bar" style="border-top:1px solid #eee"><select id="statsPost" aria-label="Video">${posted.map((p) => `<option value="${p.id}" ${p.id === sp.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select><span class="pill">7 days</span><span class="spacer"></span><span class="muted">Posted ${parseDay(sp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
  <div class="analyze-grid">${[['👁 Views', st.views], ['♡ Likes', st.likes], ['💬 Comments', st.comments], ['➤ Shares', st.shares], ['🔖 Saves', st.saves]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v.toLocaleString()}</div></div>`).join('')}</div>
  <div class="pad"><div class="card"><div class="row" style="justify-content:space-between"><b>↗ Views since posting</b><span class="muted">Avg. watch ${st.watch} s</span></div>
    <svg viewBox="0 0 900 180" style="width:100%" role="img" aria-label="Views since posting"><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3fe0" stop-opacity=".2"/><stop offset="1" stop-color="#1d3fe0" stop-opacity="0"/></linearGradient></defs>
      <path d="M0 170 C80 80 140 40 260 32 S700 24 900 10 V180 H0Z" fill="url(#g2)"/><path d="M0 170 C80 80 140 40 260 32 S700 24 900 10" fill="none" stroke="#1d3fe0" stroke-width="3"/></svg>
    <div class="row" style="justify-content:space-between;font-size:13px;color:#666"><span>Posted</span><span>Day 1 · ${st.d1.toLocaleString()}</span><span>Day 3 · ${st.d3.toLocaleString()}</span><span>Day 7 · ${st.views.toLocaleString()}</span></div></div></div>`
  : '<div class="pad"><div class="card muted">Post a video from the Calendar to see its stats here.</div></div>'}`;
  $('#range').value = String(S.range);
  $('#range').onchange = (e) => { S.range = +e.target.value; save(); viewAnalytics(); };
  const sp2 = $('#statsPost'); if (sp2) sp2.onchange = (e) => { S.statsPost = e.target.value; save(); viewAnalytics(); };
}

/* ---------- 06 Carousels ---------- */
function slidesFor(sc) {
  const body = sc.blocks.filter((b) => b.type === 'body' && b.text.trim()).slice(0, 6);
  return [{ cover: true, text: sc.title }, ...body.map((b, i) => ({ n: i + 1, text: b.text }))];
}
function hooksFor(sc) {
  const t = sc.title.replace(/[.!?]+$/, ''), hook = sc.blocks.find((b) => b.type === 'hook')?.text || t;
  const num = ((hook.match(/\$?\d[\d,.]*[k%]?/i) || [])[0] || '').replace(/[,.]+$/, '');
  return [
    `${t}. Here's what to do instead.`,
    num ? `${num}: the number nobody in your niche talks about.` : `Nobody in your niche talks about this.`,
    `I tried "${t.toLowerCase()}" so you don't have to.`,
    `The mistake behind "${t.toLowerCase()}" (and the fix).`,
  ];
}
function drawSlide(slide, sc, total) {
  const [, bg, fg, ac] = themeOf(sc), c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const x = c.getContext('2d'), cover = slide.cover;
  x.fillStyle = cover ? '#1c1c1f' : bg; x.fillRect(0, 0, 1080, 1350);
  const ink = cover ? '#ffffff' : fg;
  x.fillStyle = cover ? '#999' : ac; x.font = cover ? '500 34px ui-monospace,Menlo,monospace' : '800 140px Inter,system-ui,sans-serif';
  x.fillText(cover ? 'SWIPE →' : String(slide.n), 90, cover ? 140 : 230);
  x.fillStyle = ink; const size = cover ? 96 : 72; x.font = `800 ${size}px Inter,system-ui,sans-serif`;
  const lines = []; let line = '';
  for (const w of words(slide.text)) { const tst = line ? line + ' ' + w : w; if (x.measureText(tst).width > 900 && line) { lines.push(line); line = w; } else line = tst; }
  if (line) lines.push(line);
  const lh = size * 1.15; let y = 1350 - 150 - (lines.length - 1) * lh;
  lines.forEach((l) => { x.fillText(l, 90, y); y += lh; });
  x.fillStyle = cover ? '#777' : fg; x.globalAlpha = .6; x.font = '500 30px Inter,system-ui,sans-serif';
  x.fillText(`@${S.handle}`, 90, 1290); x.textAlign = 'right'; x.fillText(`${(slide.n || 0) + 1}/${total}`, 990, 1290);
  return c;
}
function viewCarousels() {
  ensurePosts();
  const withScript = S.posts.filter((p) => p.status === 'posted' && S.scripts.some((x) => x.id === p.scriptId));
  const winner = withScript.map((p) => ({ p, s: postStats(p) })).sort((a, b) => b.s.views - a.s.views)[0];
  const sc = winner ? S.scripts.find((x) => x.id === winner.p.scriptId) : active();
  const slides = slidesFor(sc), hooks = hooksFor(sc);
  const short = (t) => { const w = words(t); return w.length > 9 ? w.slice(0, 9).join(' ') + '…' : t; };
  $('#view').innerHTML = `
  <div class="bar"><span class="pill orange">🔥 ${winner ? 'Winner' : 'Active script'}</span><h2>${esc(sc.title)}</h2><span class="spacer"></span>${winner ? `<span class="muted">👁 ${winner.s.views.toLocaleString()}</span>` : '<span class="muted">Post a video to pick a winner automatically</span>'}</div>
  <div class="car">
    <div>${phoneHtml(sc, false)}</div>
    <div>
      <div class="card" style="border:2px solid var(--blue-mid);background:#f6f8ff;margin-bottom:16px">
        <div class="row" style="justify-content:space-between;margin-bottom:14px"><span><b>Carousel</b> <span class="muted">${slides.length} slides</span></span>
          <span class="row"><span class="pill green">✓ Ready</span><button class="btn dark" id="dl">⬇ Download PNGs</button></span></div>
        <div class="slides">${slides.map((s) => s.cover ? `<div class="slide cover"><span class="sw">SWIPE</span>${esc(s.text)}</div>` : `<div class="slide"><span class="num">${s.n}</span>${esc(short(s.text))}</div>`).join('')}</div></div>
      <div class="card hooks"><h3>New hooks <span class="muted" style="font-weight:400">from the ${winner ? 'winner' : 'script'}</span></h3>
        ${hooks.map((h, i) => `<div>✨ ${esc(h)}<button class="use" data-h="${i}">New video from this</button></div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn orange" id="again">Start the next video ›</button></div>
    </div></div>`;
  $('#dl').onclick = async () => {
    for (const [i, s] of slides.entries()) {
      const a = document.createElement('a'); a.href = drawSlide(s, sc, slides.length).toDataURL('image/png');
      a.download = `${sc.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}-${i + 1}.png`; a.click();
      await new Promise((r) => setTimeout(r, 250));
    }
    toast(`Downloaded ${slides.length} slides`);
  };
  $$('[data-h]').forEach((b) => b.onclick = () => {
    const n = JSON.parse(JSON.stringify(sc)); Object.assign(n, { id: uid(), source: 'Repurposed', prod: defaultProd() });
    n.blocks[n.blocks.findIndex((x) => x.type === 'hook')].text = hooks[+b.dataset.h]; n.title = hooks[+b.dataset.h].replace(/[.:].*$/, '');
    addScript(n); toast('New script created from the hook'); go(1);
  });
  $('#again').onclick = () => go(0);
}

const VIEWS = { feed: viewFeed, script: viewScript, production: viewProduction, calendar: viewCalendar, analytics: viewAnalytics, carousels: viewCarousels };

/* ---------- settings ---------- */
const dlg = $('#settings');
function openSettings() { $('#setWebhook').value = S.settings.webhook; $('#setAuth').value = S.settings.auth; $('#setHandle').value = S.handle; dlg.showModal(); }
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  S.settings.webhook = $('#setWebhook').value.trim(); S.settings.auth = $('#setAuth').value.trim();
  S.handle = ($('#setHandle').value.trim() || 'yourbrand').replace(/^@/, ''); save(); render(); toast('Settings saved');
});
$('#openSettings').onclick = openSettings;
$('#resetAll').onclick = () => { if (confirm('Clear all scripts, posts and settings on this device?')) { localStorage.removeItem('gr_state'); location.reload(); } };

/* ---------- wiring ---------- */
$('#stages').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
$('#nextBtn').onclick = () => go(S.stage + 1);
document.addEventListener('keydown', (e) => { if (/TEXTAREA|INPUT|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return; if (e.key === 'ArrowRight') go(S.stage + 1); if (e.key === 'ArrowLeft') go(S.stage - 1); });
S.scripts.forEach((sc) => { if (sc.prod.status === 'running') sc.prod = defaultProd(); });
render();
})();
