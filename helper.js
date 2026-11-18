/* Talks to the local helper (bridge/server.py). The helper only exists when the app is opened from it,
 * at http://localhost:5174, so every call first checks that it is there.
 */
(() => {
'use strict';
class HelperError extends Error { constructor(m, info) { super(m); this.name = 'HelperError'; Object.assign(this, info || {}); } }
let sess = null, probing = null;

async function session(force) {
  if (sess && !force) return sess;
  if (probing) return probing;
  probing = (async () => {
    try {
      const r = await fetch('/api/session', { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      sess = j && j.token ? Object.assign({ available: true }, j) : { available: false };
    } catch (e) { sess = { available: false }; }
    probing = null; return sess;
  })();
  return probing;
}
async function call(path, o = {}) {
  const s = await session();
  if (!s.available) throw new HelperError('The helper is not running. In the project folder run ./bridge/start.sh and open the app from http://localhost:5174.', { offline: true });
  const headers = { 'X-Studio-Token': s.token };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  let r;
  try { r = await fetch(path, { method: o.method || 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }); }
  catch (e) { sess = null; throw new HelperError('Lost the connection to the helper. Is it still running?', { offline: true }); }
  if (!r.ok) {
    let msg = 'Helper error ' + r.status; try { msg = (await r.json()).error || msg; } catch (e) { /* not json */ }
    if (r.status === 401) sess = null; // the helper restarted: fetch a new token next time
    throw new HelperError(msg, { status: r.status });
  }
  return o.expect === 'bytes' ? r.arrayBuffer() : r.json();
}
window.Helper = { session, call, HelperError, info: () => sess, available: async () => (await session()).available };
})();
