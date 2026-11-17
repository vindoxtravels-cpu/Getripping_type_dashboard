/* Get Ripping – video automation dashboard. No build step, no dependencies. */
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRADS = [['#0b1020', '#1d3fe0'], ['#0f1a12', '#2f7d4f'], ['#e7e7ea', '#9aa0aa'], ['#f1ecfb', '#6d4bd8']];

const defaultState = () => ({
  handle: 'getripping',
  stage: 0,
  saved: [],
  selectedSaved: null,
  skipped: [],
  history: [],
  script: null,
  prod: { steps: [0, 0, 0, 0], render: 0, status: 'idle', log: [], videoUrl: null },
  schedule: null,
  settings: { webhook: '', auth: '' },
  range: 30,
});
let S;
try { S = Object.assign(defaultState(), JSON.parse(localStorage.getItem('gr_state') || '{}')); } catch { S = defaultState(); }
const save = () => { try { localStorage.setItem('gr_state', JSON.stringify(S)); } catch {} };

const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (t) => (t.trim().match(/\S+/g) || []);
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };

/* seeded RNG so charts are stable between reloads */
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------- script helpers ---------- */
function newScriptFrom(item) {
  const t = item ? item.title : 'Stop giving out free trials';
  return {
    title: t, duration: '1:01', source: item ? 'From Research' : 'Blank',
    blocks: [
      { type: 'hook', text: "If you're giving out a free trial in 2026, you might as well be lighting money on fire." },
      { type: 'body', text: 'Do this instead.' },
      { type: 'body', text: 'Most of us are building with AI now, which means every free trial user costs real money in tokens and compute.' },
      { type: 'body', text: "So that's not a free trial. You're paying THEM to use your product." },
      { type: 'comment', text: 'And if you want the free $50k per month playbook, comment "PLAYBOOK" and follow for more bangers.' },
    ],
  };
}
function checks(sc) {
  const hook = sc.blocks.find((b) => b.type === 'hook');
  const body = sc.blocks.filter((b) => b.type === 'body');
  const cm = sc.blocks.find((b) => b.type === 'comment');
  return [
    ['Hook in the first 3 s', !!hook && words(hook.text).length > 0 && words(hook.text).length <= 20],
    ['One idea a line', body.length > 0 && body.every((b) => words(b.text).length <= 24)],
    ['Ends on a comment', !!cm && /comment/i.test(cm.text)],
    ['Same words on screen', sc.blocks.length > 0 && sc.blocks.every((b) => b.text.trim())],
  ];
}
const scriptWords = (sc) => sc.blocks.flatMap((b) => words(b.text));

/* ---------- shell ---------- */
function renderChrome() {
  $('#stages').innerHTML = STAGES.map((s, i) =>
    `<button class="stage ${i === S.stage ? 'active' : i < S.stage ? 'done' : ''}" data-i="${i}"><span class="n">${s.n}</span>${s.name}</button>`).join('');
  $('#tabs').innerHTML = STAGES.map((s, i) =>
    `<button class="tab ${i === S.stage ? 'active' : ''}" role="tab" data-i="${i}">${s.tab}</button>`).join('');
  $('#stageLabel').textContent = `Stage ${S.stage + 1} of 6`;
  const nx = STAGES[S.stage + 1];
  const nb = $('#nextBtn');
  nb.style.visibility = nx ? 'visible' : 'hidden';
  nb.innerHTML = nx ? `Next: <b>${nx.name}</b> ›` : '';
}
function go(i) { S.stage = Math.max(0, Math.min(5, i)); save(); render(); }
function render() { renderChrome(); VIEWS[STAGES[S.stage].id](); }

/* ---------- 01 My Feed ---------- */
function viewFeed() {
  const rest = FEED.filter((f) => !S.saved.includes(f.id) && !S.skipped.includes(f.id));
  const top = rest[0], back = rest[1];
  const sel = FEED.find((f) => f.id === (S.selectedSaved ?? S.saved[S.saved.length - 1]));
  $('#view').innerHTML = `
  <div class="bar"><h2>My Feed</h2><span class="pill">SaaS founders</span><span class="pill orange">🔥 Winning in your niche</span><span class="spacer"></span><span class="muted">♡ Saved ${S.saved.length}</span></div>
  <div class="feed">
    <div class="deck">
      ${back ? `<div class="reel back" style="background:linear-gradient(160deg,${back.g[0]},${back.g[1]})"><div class="t">${esc(back.title)}</div></div>` : ''}
      ${top ? `<div class="reel" id="topReel" style="background:linear-gradient(160deg,${top.g[0]},${top.g[1]})"><div class="stamp">SAVE</div><div class="t">${esc(top.title)}</div><div class="m"><span class="mult">${top.mult}×</span> ${top.views}</div></div>`
            : `<div class="card">You've swiped everything. <button class="btn" id="reset">Reload feed</button></div>`}
      <div class="deck-btns">
        <button class="round skip" id="skip" title="Skip">✕</button>
        <button class="round" id="undo" title="Undo">↶</button>
        <button class="round save" id="saveReel" title="Save">♥</button>
      </div>
    </div>
    <aside class="side">
      <div class="lab">SAVED</div>
      ${sel ? `<div class="saved-item"><b>${esc(sel.title)}</b>👁 ${sel.views} · <span style="color:var(--orange)">🔥 ${sel.mult}× usual</span></div>
      <div class="lab">WHY IT WORKS</div>
      <div class="chips">${sel.why.map((w) => `<span class="chip">${w}</span>`).join('')}</div>` : '<div class="muted">Swipe right (♥) on a reel to save it.</div>'}
      ${S.saved.length > 1 ? `<div class="saved-list">${S.saved.map((id) => { const f = FEED.find((x) => x.id === id); return `<button data-sel="${id}" class="${sel && sel.id === id ? 'sel' : ''}">${esc(f.title)}</button>`; }).join('')}</div>` : ''}
      <button class="btn dark" id="revoice" ${sel ? '' : 'disabled'}>✨ ReVoice</button>
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
  $('#undo').onclick = () => {
    const h = S.history.pop(); if (!h) return;
    S.saved = S.saved.filter((x) => x !== h.id); S.skipped = S.skipped.filter((x) => x !== h.id); save(); viewFeed();
  };
  const r = $('#reset'); if (r) r.onclick = () => { S.saved = []; S.skipped = []; S.history = []; save(); viewFeed(); };
  document.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => { S.selectedSaved = +b.dataset.sel; save(); viewFeed(); });
  $('#revoice').onclick = () => { S.script = newScriptFrom(sel); S.prod = defaultState().prod; save(); go(1); };
}

/* ---------- 02 Scripts ---------- */
function viewScript() {
  if (!S.script) S.script = newScriptFrom(null);
  const sc = S.script;
  const draw = () => {
    $('#view').innerHTML = `
    <div class="bar"><input class="title-in" id="sTitle" value="${esc(sc.title)}"><span class="pill">${sc.duration}</span><span class="pill blue">⛓ ${esc(sc.source)}</span><span class="spacer"></span><span class="muted">Saved</span></div>
    <div class="script">
      <div id="blocks">${sc.blocks.map((b, i) => `
        <div class="blk ${b.type}">${b.type !== 'body' ? `<span class="tag">${b.type === 'hook' ? 'Hook' : 'Comment'}</span>` : ''}
          <textarea data-i="${i}" rows="1">${esc(b.text)}</textarea>
          ${b.type === 'body' ? `<button class="x" data-del="${i}" title="Remove">✕</button>` : ''}</div>`).join('')}
        <button class="btn" id="addLine">+ Add line</button>
      </div>
      <aside class="side"><div class="lab">CHECKS</div><ul class="checks" id="checks"></ul>
        <button class="btn dark" id="toProd" style="margin-top:auto">Produce →</button></aside>
    </div>`;
    const upd = () => { $('#checks').innerHTML = checks(sc).map(([l, ok]) => `<li><span class="ck ${ok ? '' : 'bad'}">${ok ? '✓' : ''}</span>${l}</li>`).join(''); };
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    document.querySelectorAll('#blocks textarea').forEach((t) => {
      grow(t);
      t.oninput = () => { sc.blocks[+t.dataset.i].text = t.value; grow(t); upd(); save(); };
    });
    document.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { sc.blocks.splice(+b.dataset.del, 1); save(); draw(); });
    $('#addLine').onclick = () => { const ci = sc.blocks.findIndex((b) => b.type === 'comment'); sc.blocks.splice(ci < 0 ? sc.blocks.length : ci, 0, { type: 'body', text: '' }); save(); draw(); };
    $('#sTitle').oninput = (e) => { sc.title = e.target.value; save(); };
    $('#toProd').onclick = () => go(2);
    upd();
  };
  draw();
}

/* ---------- 03 Production (the automation core) ---------- */
const PSTEPS = [['📄', 'Script', 'Locked, word for word'], ['🎙', 'Voice', ''], ['🧩', 'Visuals', ''], ['🎬', 'Edit', '']];
let capTimer = null, runTimer = null;
function viewProduction() {
  clearInterval(capTimer);
  if (!S.script) S.script = newScriptFrom(null);
  const P = S.prod, sc = S.script, total = scriptWords(sc).length;
  const detail = (i) => i === 0 ? 'Locked, word for word' : i === 1 ? '<span class="wave">' + Array.from({ length: 24 }, (_, k) => `<i style="height:${6 + Math.abs(Math.sin(k * 1.7)) * 16}px"></i>`).join('') + '</span>'
    : i === 2 ? `${Math.max(6, Math.round(total / 5))} scenes, drawn to the words` : 'Captions · cuts · motion';
  const stepHtml = () => PSTEPS.map((s, i) => {
    const st = i === 0 ? 2 : P.steps[i];
    return `<div class="step ${st === 2 ? 'done' : st === 1 ? 'run' : ''}"><div class="ic">${s[0]}</div><b>${s[1]}</b><div class="d">${detail(i)}</div><div class="st">${st === 2 ? '✓' : ''}</div></div>`;
  }).join('');
  $('#view').innerHTML = `
  <div class="bar"><h2>${esc(sc.title)}</h2><span class="pill">${sc.duration}</span><span class="pill">Motion</span><span class="spacer"></span>
    <button class="btn" id="cfg">⚙ Webhook${S.settings.webhook ? ' ✓' : ''}</button>
    <button class="btn orange" id="run" ${P.status === 'running' ? 'disabled' : ''}>${P.status === 'done' ? '↻ Re-run' : '▶ Generate video'}</button></div>
  <div class="prod">
    <div class="phone" id="phone"><div class="tag">you</div>
      <svg viewBox="0 0 260 460"><path d="M0 380 C80 380 120 350 160 260 S210 130 235 110" stroke="#2d4cff" stroke-width="4" fill="none"/><path d="M0 380 C80 380 120 350 160 260 S210 130 235 110 V460 H0Z" fill="#1d3fe022"/><circle cx="235" cy="110" r="6" fill="none" stroke="#5b78ff" stroke-width="2"/><line x1="0" y1="400" x2="260" y2="400" stroke="#ddd" stroke-width="1"/></svg>
      <div class="cap" id="cap"></div><div class="prog"><i id="pbar"></i></div></div>
    <div><div id="steps">${stepHtml()}</div>
      <div class="renderbox"><div class="top">Render <span id="rp">${P.render}%</span></div><div class="meter"><i id="rm" style="width:${P.render}%"></i></div>
        <div class="muted" id="rs">${P.status === 'done' ? '→ Ready to Rip' : P.status === 'running' ? 'Working…' : 'Not started'}</div>
        ${P.videoUrl ? `<div style="margin-top:10px"><a href="${esc(P.videoUrl)}" target="_blank" rel="noopener">Open rendered video ↗</a></div>` : ''}
        <div class="log" id="log">${P.log.map(esc).join('<br>')}</div></div>
    </div></div>`;
  // live caption preview, word by word
  const ws = scriptWords(sc); let k = 0;
  const cap = $('#cap'), pbar = $('#pbar');
  const tick = () => { if (!ws.length) return; const w = ws.slice(k, k + 3); cap.innerHTML = w.map((x, j) => j === 1 ? `<em>${esc(x)}</em>` : esc(x)).join(' '); pbar.style.width = ((k + 1) / ws.length * 100) + '%'; k = (k + 3) % ws.length; };
  tick(); capTimer = setInterval(tick, 650);
  $('#cfg').onclick = openSettings;
  $('#run').onclick = runPipeline;
}
function log(m) { S.prod.log.push(new Date().toLocaleTimeString() + '  ' + m); S.prod.log = S.prod.log.slice(-30); const l = $('#log'); if (l) { l.innerHTML = S.prod.log.map(esc).join('<br>'); l.scrollTop = 1e9; } }
function paint() {
  const P = S.prod; if (STAGES[S.stage].id !== 'production') return;
  document.querySelectorAll('#steps .step').forEach((el, i) => { const st = i === 0 ? 2 : P.steps[i]; el.className = 'step ' + (st === 2 ? 'done' : st === 1 ? 'run' : ''); $('.st', el).textContent = st === 2 ? '✓' : ''; });
  $('#rp').textContent = P.render + '%'; $('#rm').style.width = P.render + '%';
  $('#rs').textContent = P.status === 'done' ? '→ Ready to Rip' : P.status === 'running' ? 'Working…' : 'Not started';
}
/** Build the payload sent to your automation. Keep in sync with README.md → "Webhook contract". */
function buildPayload() {
  const sc = S.script;
  return { handle: S.handle, title: sc.title, duration: sc.duration, script: sc.blocks, text: sc.blocks.map((b) => b.text).join('\n'), wordCount: scriptWords(sc).length, format: '9:16', createdAt: new Date().toISOString() };
}
async function runPipeline() {
  const P = S.prod; if (P.status === 'running') return;
  P.status = 'running'; P.steps = [0, 0, 0, 0]; P.render = 0; P.videoUrl = null; P.log = []; save();
  $('#run').disabled = true; log('Pipeline started');
  const finish = (url) => { P.status = 'done'; P.render = 100; P.steps = [2, 2, 2, 2]; if (url) P.videoUrl = url; log('Render complete — ready to post'); save(); paint(); if (STAGES[S.stage].id === 'production') { $('#run').disabled = false; $('#run').textContent = '↻ Re-run'; viewProduction(); } };
  const sim = (done) => {
    let step = 1, pct = 0; P.steps[1] = 1; paint(); log('Voice: generating');
    const names = ['', 'Voice', 'Visuals', 'Edit'];
    runTimer = setInterval(() => {
      pct += 4; P.render = Math.min(99, Math.round((((step - 1) * 100) + pct) / 4));
      if (pct >= 100) { P.steps[step] = 2; log(`${names[step]}: done`); pct = 0; step++; if (step > 3) { clearInterval(runTimer); done(); return; } P.steps[step] = 1; log(`${names[step]}: running`); }
      paint();
    }, 120);
  };
  const { webhook, auth } = S.settings;
  if (!webhook) { log('No webhook set — running built-in simulation'); sim(() => finish(null)); return; }
  try {
    log('POST ' + webhook);
    P.steps[1] = 1; paint();
    const res = await fetch(webhook, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: auth } : {}), body: JSON.stringify(buildPayload()) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let data = {}; try { data = await res.json(); } catch {}
    log('Webhook accepted' + (data.jobId ? ' · job ' + data.jobId : ''));
    if (data.videoUrl) { finish(data.videoUrl); return; }
    if (data.statusUrl) { pollStatus(data.statusUrl, finish); return; }
    sim(() => finish(null));
  } catch (e) {
    log('Webhook failed: ' + e.message + ' (CORS or network). Falling back to simulation.');
    sim(() => finish(null));
  }
}
function pollStatus(url, finish) {
  const P = S.prod; let n = 0;
  const t = setInterval(async () => {
    try {
      const d = await (await fetch(url)).json();
      P.render = Math.round(d.progress || 0); P.steps = [2, P.render > 5 ? 2 : 1, P.render > 40 ? 2 : P.render > 5 ? 1 : 0, P.render > 80 ? 1 : 0]; paint();
      log('Status: ' + (d.status || P.render + '%'));
      if (d.status === 'done' || d.videoUrl || P.render >= 100) { clearInterval(t); finish(d.videoUrl || null); }
    } catch (e) { log('Poll error: ' + e.message); }
    if (++n > 300) { clearInterval(t); log('Gave up polling'); P.status = 'idle'; save(); }
  }, 2000);
}

/* ---------- 04 Calendar ---------- */
function ensureSchedule() {
  if (S.schedule) return;
  const base = new Date(); const dow = base.getDay(); base.setDate(base.getDate() - dow + 3);
  S.schedule = [0, 1, 2, 3].map((i) => { const d = new Date(base); d.setDate(base.getDate() + i); return { date: d.toISOString().slice(0, 10), time: i === 0 ? '7:51 AM' : '8:00 AM', status: 'scheduled', feed: true, trial: false, title: i === 0 ? (S.script ? S.script.title : 'Stop giving out free trials') : ['Do you guys wanna get way', 'You can now run Claude', '10 lazy marketing tips'][i - 1] }; });
}
let selDay = 0;
function viewCalendar() {
  ensureSchedule();
  const sd = S.schedule, posted = sd.filter((d) => d.status === 'posted').length, sched = sd.length - posted;
  const first = new Date(sd[0].date + 'T00:00:00');
  const d = sd[selDay];
  const caption = S.script ? S.script.blocks[0].text.slice(0, 40) + '…' : d.title;
  $('#view').innerHTML = `
  <div class="bar"><h2>Week of ${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2>${posted ? `<span class="pill green">${posted} posted</span>` : ''}<span class="pill">${sched} scheduled</span></div>
  <div class="cal">
    ${sd.map((x, i) => { const dt = new Date(x.date + 'T00:00:00'); const g = GRADS[i % 4];
      return `<div class="day ${i === selDay ? 'sel' : ''}" data-i="${i}"><div class="h">${DAY_NAMES[dt.getDay()]} <span>${dt.getDate()}</span></div>
      <div class="thumb" style="background:linear-gradient(160deg,${g[0]},${g[1]});${i % 4 === 2 ? 'color:#111' : ''}">${esc(x.title)}</div>
      <div class="muted" style="margin-bottom:8px">${x.time}</div>
      <span class="pill ${x.status === 'posted' ? 'green' : ''}">${x.status === 'posted' ? '✓ Posted' : 'Scheduled'}</span></div>`; }).join('')}
    <aside class="card">
      <div class="who"><span class="avatar">${esc(S.handle[0] || 'g').toUpperCase()}</span>${esc(S.handle)}</div>
      <p style="margin-bottom:12px">${esc(caption)}</p>
      <p class="muted" style="margin-bottom:18px;font-size:14px">${esc(d.title)}</p>
      <div class="row" style="justify-content:space-between;margin-bottom:12px"><span>Feed</span><button class="toggle ${d.feed ? 'on' : ''}" id="tFeed" aria-label="Feed"></button></div>
      <div class="row" style="justify-content:space-between;margin-bottom:18px"><span class="muted">Trial reel</span><button class="toggle ${d.trial ? 'on' : ''}" id="tTrial" aria-label="Trial reel"></button></div>
      <button class="postbtn ${d.status === 'posted' ? '' : 'go'}" id="postNow">${d.status === 'posted' ? '✓ Posted ' + DAY_NAMES[new Date(d.date + 'T00:00:00').getDay()] + ' ' + d.time : 'Post now'}</button>
    </aside>
  </div>`;
  document.querySelectorAll('.day').forEach((el) => el.onclick = () => { selDay = +el.dataset.i; viewCalendar(); });
  $('#tFeed').onclick = () => { d.feed = !d.feed; save(); viewCalendar(); };
  $('#tTrial').onclick = () => { d.trial = !d.trial; save(); viewCalendar(); };
  $('#postNow').onclick = () => { if (d.status === 'posted') return; d.status = 'posted'; d.time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); save(); toast('Marked as posted'); viewCalendar(); };
}

/* ---------- 05 Analytics ---------- */
function series(days, seed, end) {
  const r = rng(seed); let v = end * 0.08; const out = [];
  for (let i = 0; i < days; i++) { const t = i / (days - 1); v += (end - v) * (0.05 + 0.04 * r()) + (t > .55 && t < .62 ? end * .02 : 0); out.push(v); }
  out[days - 1] = end; return out;
}
function areaPath(vals, w, h, max, close) {
  const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - v / max * h]);
  let d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  return close ? d + ` L${w} ${h} L0 ${h}Z` : d;
}
function viewAnalytics() {
  const days = S.range, f = Math.round(15057 * days / 30 / (days === 30 ? 1 : 1.0));
  const followers = series(days, 42 + days, Math.max(f, 1200)), views = days === 7 ? 540000 : days === 90 ? 8100000 : 2900000;
  const max = Math.ceil(followers[followers.length - 1] / 5000) * 5000 || 5000;
  const W = 900, H = 260, r = rng(7);
  const heat = Array.from({ length: 31 }, (_, i) => i < 26 ? [3, 2, 1][Math.floor(r() * 3)] : 0);
  const reels = FEED.map((x, i) => ({ ...x, v: ['475K', '365K', '312K', '174K', '150K', '107K'][i], m: ['27', '21', '18', '9.9', '8.6', '6.1'][i] }));
  $('#view').innerHTML = `
  <div class="bar"><span class="avatar">${esc(S.handle[0] || 'g').toUpperCase()}</span><h2>@${esc(S.handle)}</h2><span class="spacer"></span>
    <select id="range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
  <div class="kpis">
    ${[['👁 Views', fmt(views)], ['👥 Accounts reached', fmt(Math.round(views * .336))], ['➕ New followers', '+' + (13358 * days / 30 | 0).toLocaleString()], ['♡ Interactions', fmt(Math.round(views * .12))]]
      .map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>
  <div class="an">
    <div class="card"><h3>Followers</h3><div><span class="big">${Math.round(followers[followers.length - 1]).toLocaleString()}</span><span class="delta">+${(13752 * days / 30 | 0).toLocaleString()}</span></div>
      <svg viewBox="0 0 ${W} ${H + 10}" style="width:100%;margin-top:10px">
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="${W}" y1="${H - i * H / 4}" y2="${H - i * H / 4}" stroke="#eee"/><text x="0" y="${H - i * H / 4 - 4}" font-size="11" fill="#999">${fmt(max / 4 * i)}</text>`).join('')}
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3fe0" stop-opacity=".18"/><stop offset="1" stop-color="#1d3fe0" stop-opacity="0"/></linearGradient></defs>
        <path d="${areaPath(followers, W, H, max, true)}" fill="url(#g)"/><path d="${areaPath(followers, W, H, max)}" fill="none" stroke="#1d3fe0" stroke-width="3"/></svg></div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card"><h3>Who's watching</h3><div class="donutwrap">
        <svg width="140" height="140" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#dce4ff" stroke-width="4"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#1d3fe0" stroke-width="4" stroke-dasharray="95 5" transform="rotate(-90 21 21)" stroke-linecap="round"/><text x="21" y="24" text-anchor="middle" font-size="8" font-weight="700" fill="#1d3fe0">95%</text></svg>
        <div class="legend"><div><span><i style="background:#1d3fe0"></i>Non-followers</span><b>${fmt(views * .93)}</b></div><div><span><i style="background:#cdd8ff"></i>Followers</span><b>${fmt(views * .053)}</b></div></div></div></div>
      <div class="card"><h3>Posting</h3><div class="row" style="gap:24px;align-items:flex-start"><div class="heat">${heat.map((h) => `<i style="background:${['#eceef5', '#c0ccff', '#6f8bf0', '#1d3fe0'][h]}"></i>`).join('')}</div>
        <div><div class="big" style="font-size:30px">26<span class="muted">/31</span></div><div class="muted">days with a reel</div><div class="big" style="font-size:30px;margin-top:10px">3</div><div class="muted">day streak</div></div></div></div>
    </div></div>
  <div class="pad" style="padding-top:0"><h3 style="margin-bottom:12px;font-size:18px">Top reels</h3></div>
  <div class="top-reels">${reels.map((x) => `<div class="tr" style="background:linear-gradient(170deg,${x.g[0]},${x.g[1]})"><span class="mult">${x.m}×</span><div>${esc(x.title)}<div class="v">▶ ${x.v}</div></div></div>`).join('')}</div>
  <div class="bar" style="border-top:1px solid #eee"><h2 style="font-size:16px">${esc(S.script ? S.script.title : 'Latest video')}</h2><span class="pill">7 days</span></div>
  <div class="analyze-grid">${[['👁 Views', 20069], ['♡ Likes', 567], ['💬 Comments', 133], ['➤ Shares', 385], ['🔖 Saves', 810]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v.toLocaleString()}</div></div>`).join('')}</div>
  <div class="pad"><div class="card"><div class="row" style="justify-content:space-between"><b>↗ Views since posting</b><span class="muted">Avg. watch 23.3 s</span></div>
    <svg viewBox="0 0 900 180" style="width:100%"><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3fe0" stop-opacity=".2"/><stop offset="1" stop-color="#1d3fe0" stop-opacity="0"/></linearGradient></defs>
      <path d="M0 170 C80 80 140 40 260 32 S700 24 900 10 V180 H0Z" fill="url(#g2)"/><path d="M0 170 C80 80 140 40 260 32 S700 24 900 10" fill="none" stroke="#1d3fe0" stroke-width="3"/></svg>
    <div class="row" style="justify-content:space-between;font-size:13px;color:#666"><span>Posted</span><span>Day 1 · 13,960</span><span>Day 3 · 16,715</span><span>Day 7 · 20,069</span></div></div></div>`;
  $('#range').value = String(S.range);
  $('#range').onchange = (e) => { S.range = +e.target.value; save(); viewAnalytics(); };
}

/* ---------- 06 Carousels ---------- */
function viewCarousels() {
  if (!S.script) S.script = newScriptFrom(null);
  const sc = S.script, body = sc.blocks.filter((b) => b.type === 'body' && b.text.trim()).slice(0, 5);
  const short = (t) => { const w = words(t); return w.length > 9 ? w.slice(0, 9).join(' ') + '…' : t; };
  const hooks = (() => {
    const t = sc.title.replace(/[.!?]+$/, '');
    return [`Your ${t.toLowerCase().replace(/^stop giving out /, '')} is lighting money on fire.`, `Stop paying strangers to try your product.`, `${t} — here's what to do instead.`];
  })();
  $('#view').innerHTML = `
  <div class="bar"><span class="pill orange">🔥 Winner</span><h2>${esc(sc.title)}</h2><span class="spacer"></span><span class="muted">👁 20,069</span></div>
  <div class="car">
    <div class="phone" style="width:200px;height:350px"><div class="tag">you</div><div class="cap" style="font-size:18px">${esc(words(sc.blocks[0].text).slice(0, 7).join(' '))}</div></div>
    <div>
      <div class="card" style="border:2px solid var(--blue-mid);background:#f6f8ff;margin-bottom:16px">
        <div class="row" style="justify-content:space-between;margin-bottom:14px"><span><b>Carousel</b> <span class="muted">${body.length + 1} slides</span></span><span class="pill green">✓ Ready</span></div>
        <div class="slides"><div class="slide cover"><span class="sw">SWIPE</span>${esc(sc.title)}</div>
          ${body.map((b, i) => `<div class="slide"><span class="num">${i + 1}</span>${esc(short(b.text))}</div>`).join('')}</div></div>
      <div class="card hooks"><h3>New hooks <span class="muted" style="font-weight:400">from the winner</span></h3>
        ${hooks.map((h) => `<div>✨ ${esc(h)}<button class="use" data-h="${esc(h)}">Use as hook</button></div>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn orange" id="again">Get Ripping ›</button></div>
    </div></div>`;
  document.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { S.script.blocks[0].text = b.dataset.h; S.prod = defaultState().prod; save(); toast('Hook swapped — re-produce to render'); go(1); });
  $('#again').onclick = () => { S.script = null; S.prod = defaultState().prod; S.stage = 0; save(); render(); };
}

const VIEWS = { feed: viewFeed, script: viewScript, production: viewProduction, calendar: viewCalendar, analytics: viewAnalytics, carousels: viewCarousels };

/* ---------- settings ---------- */
const dlg = $('#settings');
function openSettings() { $('#setWebhook').value = S.settings.webhook; $('#setAuth').value = S.settings.auth; $('#setHandle').value = S.handle; dlg.showModal(); }
dlg.addEventListener('close', () => {
  if (dlg.returnValue === 'save') { S.settings.webhook = $('#setWebhook').value.trim(); S.settings.auth = $('#setAuth').value.trim(); S.handle = ($('#setHandle').value.trim() || 'getripping').replace(/^@/, ''); save(); render(); toast('Settings saved'); }
});
$('#openSettings').onclick = openSettings;

/* ---------- wiring ---------- */
$('#stages').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
$('#nextBtn').onclick = () => go(S.stage + 1);
document.addEventListener('keydown', (e) => { if (/TEXTAREA|INPUT|SELECT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') go(S.stage + 1); if (e.key === 'ArrowLeft') go(S.stage - 1); });
if (S.prod.status === 'running') { S.prod = defaultState().prod; }
render();
})();
