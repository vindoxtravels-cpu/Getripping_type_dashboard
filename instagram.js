/* Instagram professional-account insights through Meta's official Graph API.
 * Read-only: the page only sends GET requests, directly from your browser to Meta.
 * The access token you paste is kept in this browser (sessionStorage, or localStorage if you tick "remember").
 */
(() => {
'use strict';
const KEY = 'rs_ig', DAY = 86400;
const DEFAULTS = { host: 'graph.instagram.com', version: 'v24.0', userId: '', token: '' };

class IGError extends Error {
  constructor(message, info) { super(message); this.name = 'IGError'; Object.assign(this, info || {}); }
}

/* ---------- config storage ---------- */
function readCfg() {
  for (const store of [sessionStorage, localStorage]) {
    try { const s = store.getItem(KEY); if (s) return { cfg: Object.assign({}, DEFAULTS, JSON.parse(s)), remembered: store === localStorage }; } catch (e) { /* storage blocked */ }
  }
  return null;
}
function writeCfg(cfg, remember) {
  clearCfg();
  try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage blocked */ }
}
function clearCfg() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } }

/* ---------- HTTP ---------- */
function friendly(err) {
  const code = err.code, msg = err.message || 'Unknown error';
  if (code === 190) return 'Your access token is invalid or has expired. Generate a new one in the Meta app dashboard and reconnect.';
  if (code === 10 || code === 200 || code === 3) return `Instagram refused access: ${msg}. Check the token has the insights permission (instagram_business_manage_insights).`;
  if (code === 4 || code === 17 || code === 32 || code === 613) return 'Instagram rate limit reached. Wait a few minutes and refresh.';
  return msg;
}
async function call(cfg, path, params) {
  const u = new URL(`https://${cfg.host}/${cfg.version}/${path}`);
  Object.entries(Object.assign({}, params, { access_token: cfg.token })).forEach(([k, v]) => { if (v !== undefined && v !== '') u.searchParams.set(k, v); });
  let res; try { res = await fetch(u); } catch (e) { throw new IGError('Could not reach Instagram. Check your connection and try again.', { network: true }); }
  let j; try { j = await res.json(); } catch (e) { throw new IGError(`Unexpected reply from Instagram (HTTP ${res.status}).`, { http: res.status }); }
  if (j.error) throw new IGError(friendly(j.error), { code: j.error.code, type: j.error.type, raw: j.error.message });
  return j;
}
const nodeId = (cfg) => cfg.host === 'graph.instagram.com' ? (cfg.userId || 'me') : cfg.userId;

/* ---------- API calls ---------- */
async function fetchProfile(cfg) {
  if (!nodeId(cfg)) throw new IGError('Facebook Login needs your Instagram user ID. Enter it in the connect dialog.');
  const j = await call(cfg, nodeId(cfg), { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' });
  return { username: j.username || '', name: j.name || '', avatar: j.profile_picture_url || '', followers: j.followers_count || 0, follows: j.follows_count || 0, mediaCount: j.media_count || 0 };
}
async function totalMetric(cfg, id, metric, since, until, breakdown) {
  const base = { metric, period: 'day', metric_type: 'total_value', since, until };
  let j;
  try { j = await call(cfg, `${id}/insights`, breakdown ? Object.assign({ breakdown }, base) : base); }
  catch (e) { if (!breakdown || e.network || e.code === 190) throw e; j = await call(cfg, `${id}/insights`, base); }
  const tv = j.data && j.data[0] && j.data[0].total_value; if (!tv) return null;
  const parts = {};
  ((tv.breakdowns && tv.breakdowns[0] && tv.breakdowns[0].results) || []).forEach((r) => { parts[String((r.dimension_values || [])[0]).toUpperCase()] = r.value; });
  return { value: tv.value || 0, parts };
}
async function followerSeries(cfg, id, since, until) {
  const j = await call(cfg, `${id}/insights`, { metric: 'follower_count', period: 'day', since, until });
  const vals = (j.data && j.data[0] && j.data[0].values) || [];
  return vals.map((v) => ({ date: v.end_time, delta: v.value || 0 }));
}
async function fetchMedia(cfg, id) {
  const j = await call(cfg, `${id}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count', limit: 50 });
  return j.data || [];
}
async function mediaInsights(cfg, m) {
  const sets = [
    ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'],
    ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'],
    ['reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'],
  ];
  for (const set of sets) {
    try {
      const j = await call(cfg, `${m.id}/insights`, { metric: set.join(',') }); const out = {};
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

/* ---------- shape everything for the UI ---------- */
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

const state = { status: 'idle', error: null, data: null, profile: null, fetchedAt: 0, cfg: null, remembered: false };
const stored = readCfg(); if (stored) { state.cfg = stored.cfg; state.remembered = stored.remembered; }

async function connect(cfg, remember) {
  const next = Object.assign({}, DEFAULTS, cfg);
  const profile = await fetchProfile(next);
  writeCfg(next, !!remember);
  Object.assign(state, { cfg: next, remembered: !!remember, profile, status: 'idle', error: null, data: null, fetchedAt: 0 });
  return profile;
}
function disconnect() { clearCfg(); Object.assign(state, { cfg: null, remembered: false, profile: null, status: 'idle', error: null, data: null, fetchedAt: 0 }); }

async function refresh(days) {
  const cfg = state.cfg; if (!cfg) throw new IGError('Not connected.');
  days = Math.min(30, Math.max(1, days || 30)); // Meta limits these insight windows to 30 days
  state.status = 'loading'; state.error = null;
  try {
    const id = nodeId(cfg), now = Math.floor(Date.now() / 1000), since = now - days * DAY, notes = [];
    const profile = await fetchProfile(cfg); state.profile = profile;
    const safe = async (label, p) => { try { return await p; } catch (e) { if (e.network || e.code === 190) throw e; notes.push(`${label}: ${e.message}`); return null; } };
    const [views, reach, interactions, fseries, media] = await Promise.all([
      safe('Views', totalMetric(cfg, id, 'views', since, now, 'follow_type')),
      safe('Reach', totalMetric(cfg, id, 'reach', since, now)),
      safe('Interactions', totalMetric(cfg, id, 'total_interactions', since, now)),
      safe('Followers', followerSeries(cfg, id, since, now)),
      safe('Media', fetchMedia(cfg, id)),
    ]);
    const list = media || [];
    const reels = list.filter((m) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO').slice(0, 24);
    const ins = await pool(reels, 5, (m) => mediaInsights(cfg, m).catch((e) => { if (e.network || e.code === 190) throw e; return {}; }));
    const rows = reels.map((m, i) => {
      const x = ins[i] || {};
      return { id: m.id, title: (m.caption || 'Untitled reel').split('\n')[0].slice(0, 90), thumb: m.thumbnail_url || m.media_url || '', permalink: m.permalink || '', ts: m.timestamp,
        views: x.views || 0, reach: x.reach || 0, likes: x.likes != null ? x.likes : (m.like_count || 0), comments: x.comments != null ? x.comments : (m.comments_count || 0),
        shares: x.shares || 0, saves: x.saved || 0, interactions: x.total_interactions || 0, avgWatch: x.ig_reels_avg_watch_time ? x.ig_reels_avg_watch_time / 1000 : 0 };
    });
    const sorted = rows.map((r) => r.views).filter(Boolean).sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
    rows.forEach((r) => { r.mult = median && r.views ? Math.round(r.views / median * 10) / 10 : 0; });
    rows.sort((a, b) => b.views - a.views);

    let series = null, gain = 0;
    if (fseries && fseries.length) {
      gain = fseries.reduce((a, v) => a + v.delta, 0);
      let running = profile.followers; const back = [];
      for (let i = fseries.length - 1; i >= 0; i--) { back.unshift(running); running -= fseries[i].delta; }
      series = back;
    }
    const aud = views && views.parts ? { followers: views.parts.FOLLOWER || 0, non: views.parts.NON_FOLLOWER || 0 } : null;
    state.data = {
      days, profile, notes,
      views: views ? views.value : null, reach: reach ? reach.value : null, interactions: interactions ? interactions.value : null,
      newFollowers: fseries ? gain : null, series, audience: aud && (aud.followers + aud.non) ? aud : null,
      heat: buildHeat(list), reels: rows, totalReels: reels.length,
    };
    state.status = 'ok'; state.fetchedAt = Date.now();
    return state.data;
  } catch (e) {
    state.status = 'error'; state.error = e.message || String(e); state.data = null; throw e;
  }
}

window.IG = {
  get status() { return state.status; }, get error() { return state.error; }, get data() { return state.data; },
  get profile() { return state.profile; }, get fetchedAt() { return state.fetchedAt; },
  connected: () => !!(state.cfg && state.cfg.token), config: () => state.cfg, remembered: () => state.remembered,
  connect, disconnect, refresh, IGError,
};
})();
