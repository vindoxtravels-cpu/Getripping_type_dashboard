/* Instagram professional accounts through Meta's official Graph API. Read-only: only GET requests, sent from your browser to Meta.
 * Several accounts can be connected. Each token is kept in this browser (sessionStorage, or localStorage if you tick "remember").
 */
(() => {
'use strict';
const META = 'rs_ig_accounts', ACTIVE = 'rs_ig_active', TOK = 'rs_ig_tok_', SNAP = 'rs_ig_snap_', DAY = 86400;
const DEFAULTS = { host: 'graph.instagram.com', version: 'v24.0', userId: '' };

class IGError extends Error { constructor(m, info) { super(m); this.name = 'IGError'; Object.assign(this, info || {}); } }

/* ---------- storage ---------- */
const jget = (store, key) => { try { const s = store.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const jset = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
const accounts = new Map();
let activeId = null;
function persist() {
  jset(localStorage, META, [...accounts.values()].map((a) => ({ id: a.id, host: a.host, version: a.version, userId: a.userId, username: a.username, remember: a.remember })));
  try { if (activeId) localStorage.setItem(ACTIVE, activeId); else localStorage.removeItem(ACTIVE); } catch (e) { /* storage blocked */ }
}
function writeToken(a) {
  try { sessionStorage.removeItem(TOK + a.id); localStorage.removeItem(TOK + a.id); (a.remember ? localStorage : sessionStorage).setItem(TOK + a.id, a.token); } catch (e) { /* storage blocked */ }
}
function loadAll() {
  (jget(localStorage, META) || []).forEach((m) => {
    let token = ''; try { token = (m.remember ? localStorage : sessionStorage).getItem(TOK + m.id) || ''; } catch (e) { /* storage blocked */ }
    accounts.set(m.id, Object.assign({}, DEFAULTS, m, { token, profile: null, status: token ? 'idle' : 'notoken', error: token ? null : 'The token was not remembered. Paste it again to reconnect.', data: null, fetchedAt: 0 }));
  });
  try { const act = localStorage.getItem(ACTIVE); activeId = accounts.has(act) ? act : (accounts.keys().next().value || null); } catch (e) { activeId = accounts.keys().next().value || null; }
  try { sessionStorage.removeItem('rs_ig'); localStorage.removeItem('rs_ig'); } catch (e) { /* old single-account key */ }
}
loadAll();

/* ---------- HTTP ---------- */
function friendly(err) {
  const code = err.code, msg = err.message || 'Unknown error';
  if (code === 190) return 'Your access token is invalid or has expired. Generate a new one in the Meta app dashboard and reconnect.';
  if (code === 10 || code === 200 || code === 3) return `Instagram refused access: ${msg}. Check the token has the insights permission (instagram_business_manage_insights).`;
  if (code === 4 || code === 17 || code === 32 || code === 613) return 'Instagram rate limit reached. Wait a few minutes and refresh.';
  return msg;
}
async function call(a, path, params, base) {
  const u = new URL(`https://${base || a.host}/${a.version}/${path}`);
  Object.entries(Object.assign({}, params, { access_token: a.token })).forEach(([k, v]) => { if (v !== undefined && v !== '') u.searchParams.set(k, v); });
  let res; try { res = await fetch(u); } catch (e) { throw new IGError('Could not reach Instagram. Check your connection and try again.', { network: true }); }
  let j; try { j = await res.json(); } catch (e) { throw new IGError(`Unexpected reply from Instagram (HTTP ${res.status}).`, { http: res.status }); }
  if (j.error) throw new IGError(friendly(j.error), { code: j.error.code, type: j.error.type, raw: j.error.message });
  return j;
}
const nodeId = (a) => a.host === 'graph.instagram.com' ? (a.userId || 'me') : a.userId;

/* ---------- API calls ---------- */
async function fetchProfile(a) {
  if (!nodeId(a)) throw new IGError('Facebook Login needs your Instagram user ID. Enter it in the connect form.');
  const j = await call(a, nodeId(a), { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' });
  return { username: j.username || '', name: j.name || '', avatar: j.profile_picture_url || '', followers: j.followers_count || 0, follows: j.follows_count || 0, mediaCount: j.media_count || 0 };
}
async function totalMetric(a, id, metric, since, until, breakdown) {
  const base = { metric, period: 'day', metric_type: 'total_value', since, until };
  let j;
  try { j = await call(a, `${id}/insights`, breakdown ? Object.assign({ breakdown }, base) : base); }
  catch (e) { if (!breakdown || e.network || e.code === 190) throw e; j = await call(a, `${id}/insights`, base); }
  const tv = j.data && j.data[0] && j.data[0].total_value; if (!tv) return null;
  const parts = {};
  ((tv.breakdowns && tv.breakdowns[0] && tv.breakdowns[0].results) || []).forEach((r) => { parts[String((r.dimension_values || [])[0]).toUpperCase()] = r.value; });
  return { value: tv.value || 0, parts };
}
async function followerSeries(a, id, since, until) {
  const j = await call(a, `${id}/insights`, { metric: 'follower_count', period: 'day', since, until });
  return ((j.data && j.data[0] && j.data[0].values) || []).map((v) => ({ date: v.end_time, delta: v.value || 0 }));
}
async function fetchMedia(a, id) {
  const j = await call(a, `${id}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count', limit: 50 });
  return j.data || [];
}
async function mediaInsights(a, m) {
  const sets = [
    ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'],
    ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'],
    ['reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'],
  ];
  for (const set of sets) {
    try {
      const j = await call(a, `${m.id}/insights`, { metric: set.join(',') }); const out = {};
      (j.data || []).forEach((d) => { out[d.name] = d.values ? d.values[0] && d.values[0].value : d.total_value && d.total_value.value; });
      return out;
    } catch (e) { if (e.network || e.code === 190) throw e; }
  }
  return {};
}
async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/* ---------- shaping ---------- */
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function buildHeat(media) {
  const counts = {}; media.forEach((m) => { const k = dayKey(new Date(m.timestamp)); counts[k] = (counts[k] || 0) + 1; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() - 28);
  const cells = []; let daysWith = 0, daysTotal = 0;
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > today) { cells.push(null); continue; }
    const n = counts[dayKey(d)] || 0; cells.push(n); daysTotal++; if (n) daysWith++;
  }
  let streak = 0; const d = new Date(today); if (!counts[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (counts[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
  return { cells, daysWith, daysTotal, streak };
}
function shape(m, x, acct) {
  x = x || {};
  const caption = m.caption || '';
  return { id: m.id, acct, caption, title: (caption.split('\n')[0] || 'Untitled').slice(0, 90), thumb: m.thumbnail_url || m.media_url || '', mediaUrl: m.media_url || '', permalink: m.permalink || '', ts: m.timestamp,
    type: m.media_product_type === 'REELS' ? 'reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : m.media_type === 'VIDEO' ? 'video' : 'post',
    views: x.views || 0, reach: x.reach || 0, likes: x.likes != null ? x.likes : (m.like_count || 0), comments: x.comments != null ? x.comments : (m.comments_count || 0),
    shares: x.shares || 0, saves: x.saved || 0, interactions: x.total_interactions || 0, avgWatch: x.ig_reels_avg_watch_time ? x.ig_reels_avg_watch_time / 1000 : 0 };
}
function snapshots(a, followers) {
  const key = SNAP + a.id, s = jget(localStorage, key) || {};
  if (followers) s[dayKey(new Date())] = followers;
  const keys = Object.keys(s).sort().slice(-400), out = {}; keys.forEach((k) => { out[k] = s[k]; });
  jset(localStorage, key, out);
  return keys.map((k) => ({ date: k, followers: out[k] }));
}

/* ---------- public: accounts ---------- */
const view = (a) => ({ id: a.id, username: a.username, avatar: (a.profile && a.profile.avatar) || '', followers: a.profile ? a.profile.followers : 0, status: a.status, error: a.error, remembered: a.remember, hasData: !!a.data, fetchedAt: a.fetchedAt });
const list = () => [...accounts.values()].map(view);
const get = (id) => accounts.get(id) || null;
const active = () => accounts.get(activeId) || null;
function setActive(id) { if (accounts.has(id)) { activeId = id; persist(); } }
async function connect(cfg, remember) {
  const a = Object.assign({}, DEFAULTS, cfg, { remember: !!remember });
  if (!a.token) throw new IGError('Paste an access token first.');
  const profile = await fetchProfile(a);
  a.id = (profile.username || a.userId || 'account' + accounts.size).toLowerCase(); a.username = profile.username; a.profile = profile;
  Object.assign(a, { status: 'idle', error: null, data: null, fetchedAt: 0 });
  accounts.set(a.id, a); writeToken(a); if (!activeId) activeId = a.id; persist();
  return { profile, id: a.id };
}
function disconnect(id) {
  const a = accounts.get(id); if (!a) return;
  try { sessionStorage.removeItem(TOK + id); localStorage.removeItem(TOK + id); localStorage.removeItem(SNAP + id); } catch (e) { /* storage blocked */ }
  accounts.delete(id); if (activeId === id) activeId = accounts.keys().next().value || null; persist();
}

/* ---------- public: data ---------- */
async function refresh(id, days) {
  const a = accounts.get(id); if (!a) throw new IGError('Account not found.');
  if (!a.token) throw new IGError(a.error || 'No token for this account. Reconnect it.');
  days = Math.min(30, Math.max(1, days || 30)); // Meta limits these insight windows to 30 days
  a.status = 'loading'; a.error = null;
  try {
    const nid = nodeId(a), now = Math.floor(Date.now() / 1000), since = now - days * DAY, notes = [];
    const profile = await fetchProfile(a); a.profile = profile; a.username = profile.username || a.username;
    const safe = async (label, p) => { try { return await p; } catch (e) { if (e.network || e.code === 190) throw e; notes.push(`${label}: ${e.message}`); return null; } };
    const quiet = async (p) => { try { return await p; } catch (e) { if (e.network || e.code === 190) throw e; return null; } };
    const [views, reach, inter, fser, media, pViews, pReach, pInter] = await Promise.all([
      safe('Views', totalMetric(a, nid, 'views', since, now, 'follow_type')),
      safe('Reach', totalMetric(a, nid, 'reach', since, now)),
      safe('Interactions', totalMetric(a, nid, 'total_interactions', since, now)),
      safe('Followers', followerSeries(a, nid, since, now)),
      safe('Media', fetchMedia(a, nid)),
      quiet(totalMetric(a, nid, 'views', since - days * DAY, since)),
      quiet(totalMetric(a, nid, 'reach', since - days * DAY, since)),
      quiet(totalMetric(a, nid, 'total_interactions', since - days * DAY, since)),
    ]);
    const list2 = media || [];
    const reelsRaw = list2.filter((m) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO').slice(0, 24);
    const carRaw = list2.filter((m) => m.media_type === 'CAROUSEL_ALBUM').slice(0, 12);
    const fetchIns = (m) => mediaInsights(a, m).catch((e) => { if (e.network || e.code === 190) throw e; return {}; });
    const [rIns, cIns] = await Promise.all([pool(reelsRaw, 5, fetchIns), pool(carRaw, 5, fetchIns)]);
    const reels = reelsRaw.map((m, i) => shape(m, rIns[i], a.id)).sort((x, y) => y.views - x.views);
    const carousels = carRaw.map((m, i) => shape(m, cIns[i], a.id)).sort((x, y) => (y.reach || y.likes) - (x.reach || x.likes));
    const sorted = reels.map((r) => r.views).filter(Boolean).sort((x, y) => x - y), med = sorted.length ? sorted[sorted.length >> 1] : 0;
    reels.forEach((r) => { r.mult = med && r.views ? Math.round(r.views / med * 10) / 10 : 0; });
    let series = null, gain = 0;
    if (fser && fser.length) {
      gain = fser.reduce((s, v) => s + v.delta, 0); let running = profile.followers; const back = [];
      for (let i = fser.length - 1; i >= 0; i--) { back.unshift(running); running -= fser[i].delta; }
      series = back;
    }
    const aud = views && views.parts ? { followers: views.parts.FOLLOWER || 0, non: views.parts.NON_FOLLOWER || 0 } : null;
    a.data = {
      days, profile, notes, views: views ? views.value : null, reach: reach ? reach.value : null, interactions: inter ? inter.value : null,
      prev: { views: pViews ? pViews.value : null, reach: pReach ? pReach.value : null, interactions: pInter ? pInter.value : null },
      newFollowers: fser ? gain : null, series, audience: aud && (aud.followers + aud.non) ? aud : null,
      heat: buildHeat(list2), reels, carousels, media: list2.map((m) => shape(m, null, a.id)), snapshots: snapshots(a, profile.followers),
    };
    a.status = 'ok'; a.fetchedAt = Date.now(); persist();
    return a.data;
  } catch (e) { a.status = 'error'; a.error = e.message || String(e); a.data = null; throw e; }
}
/** Find one of your own posts from a pasted link. */
function findByUrl(id, url) {
  const a = accounts.get(id), m = String(url).match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/); if (!a || !a.data || !m) return null;
  const all = [...a.data.reels, ...a.data.carousels, ...a.data.media];
  return all.find((r) => r.permalink && r.permalink.includes('/' + m[1] + '/')) || null;
}
/** Embed details for any public reel, through Meta's oEmbed (needs the right app feature; may be refused). */
async function oembed(url) {
  const a = active(); if (!a || !a.token) return null;
  const j = await call(a, 'instagram_oembed', { url, omitscript: 'true' }, 'graph.facebook.com');
  let caption = '';
  if (j.html) {
    try {
      const bq = new DOMParser().parseFromString(j.html, 'text/html').querySelector('blockquote');
      caption = bq ? bq.innerText || bq.textContent : '';
      caption = caption.split('\n').map((l) => l.trim()).filter((l) => l && !/^(view this post on instagram|a post shared by|a reel shared by)/i.test(l)).join('\n');
    } catch (e) { /* html not parseable */ }
  }
  return { author: j.author_name || '', thumb: j.thumbnail_url || '', caption };
}

window.IG = { list, get, active, activeId: () => activeId, setActive, connect, disconnect, refresh, findByUrl, oembed, connected: () => accounts.size > 0, IGError };
})();
