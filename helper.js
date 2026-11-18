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
async function request(path, init, expect) {
  const s = await session();
  if (!s.available) throw new HelperError('The helper is not running. In the project folder run ./bridge/start.sh and open the app from http://localhost:5174.', { offline: true });
  init.headers = Object.assign({ 'X-Studio-Token': s.token }, init.headers);
  let r;
  try { r = await fetch(path, init); }
  catch (e) { sess = null; throw new HelperError('Lost the connection to the helper. Is it still running?', { offline: true }); }
  if (!r.ok) {
    let msg = 'Helper error ' + r.status; try { msg = (await r.json()).error || msg; } catch (e) { /* not json */ }
    if (r.status === 401) sess = null; // the helper restarted: fetch a new token next time
    throw new HelperError(msg, { status: r.status });
  }
  return expect === 'bytes' ? r.arrayBuffer() : r.json();
}
const call = (path, o = {}) => request(path, {
  method: o.method || 'GET', headers: o.body !== undefined ? { 'content-type': 'application/json' } : {}, body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
}, o.expect);
/** Send a file (such as a video) as the raw request body. */
const upload = (path, blob) => request(path, { method: 'POST', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob });

window.Helper = { session, call, upload, HelperError, info: () => sess, available: async () => (await session()).available };
})();
