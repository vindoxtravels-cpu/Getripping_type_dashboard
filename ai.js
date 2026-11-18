/* Claude API client. Your key stays in this browser and requests go straight to Anthropic.
 * Powers: script import, scene direction and "make one like this".
 */
(() => {
'use strict';
const KEY = 'rs_ai', URL = 'https://api.anthropic.com/v1/messages';
const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5: balanced (recommended)'], ['claude-haiku-5-5', 'Haiku 5.5: fastest and cheapest'], ['claude-opus-5-5', 'Opus 5.5: best quality, costs more']];
const MOTIFS = ['chart', 'coin', 'flame', 'bolt', 'target', 'clock', 'heart', 'check'];
const state = { key: '', model: MODELS[0][0], remembered: false };

class AIError extends Error { constructor(m, info) { super(m); this.name = 'AIError'; Object.assign(this, info || {}); } }

function load() {
  for (const store of [sessionStorage, localStorage]) {
    try { const s = store.getItem(KEY); if (s) { const j = JSON.parse(s); state.key = j.key || ''; state.model = j.model || state.model; state.remembered = store === localStorage; return; } } catch (e) { /* storage blocked */ }
  }
}
function persist() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); if (state.key) (state.remembered ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ key: state.key, model: state.model })); } catch (e) { /* storage blocked */ }
}
load();

function friendly(status, msg) {
  if (status === 401) return 'Claude rejected the API key. Check that you copied it fully (it starts with sk-ant-).';
  if (status === 403) return 'This API key is not allowed to use that model.';
  if (status === 404) return 'That model name was not found for your account. Pick another model.';
  if (status === 429) return 'Claude says you are sending too many requests. Wait a minute and try again.';
  if (status === 529 || status === 503) return 'Claude is busy right now. Try again in a moment.';
  if (status === 400 && /credit|balance/i.test(msg)) return 'Your Anthropic account is out of credit. Add credit at console.anthropic.com.';
  return msg || ('Claude returned an error (HTTP ' + status + ').');
}
function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new AIError('Claude replied in an unexpected format. Try again.');
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { throw new AIError('Claude replied in an unexpected format. Try again.'); }
}
async function ask({ system, user, max = 1500, json = false }) {
  if (!state.key) throw new AIError('Add your Claude API key first.', { nokey: true });
  let res;
  try {
    res = await fetch(URL, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': state.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: state.model, max_tokens: max, system, messages: [{ role: 'user', content: user }] }) });
  } catch (e) { throw new AIError('Could not reach Claude. Check your connection.', { network: true }); }
  let j; try { j = await res.json(); } catch (e) { throw new AIError('Unexpected reply from Claude (HTTP ' + res.status + ').'); }
  if (!res.ok || j.type === 'error') throw new AIError(friendly(res.status, j.error && j.error.message), { status: res.status });
  const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return json ? extractJson(text) : text;
}

const arr = (v) => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const SYS = 'You are a short-form video scriptwriter. You reply with only a JSON object, no prose and no code fences.';

/** Turn a caption or transcript into a fresh script in the creator's own words. */
async function scriptFromText({ text, niche }) {
  const j = await ask({ json: true, max: 1400, system: SYS, user:
`Rewrite this reel's caption or transcript as a spoken script for a short vertical video${niche ? ' for ' + niche : ''}. Keep the same idea and structure but use completely original wording; do not copy sentences.
Rules: the hook is ONE line, under 12 words, with a number or a bold claim. Each body line is ONE idea, under 20 words. End with one comment call-to-action line (for example: Comment "GUIDE" and follow for more). 4 to 7 body lines. Plain text only, no emojis or hashtags.
Return {"title": "...", "hook": "...", "body": ["..."], "comment": "..."}.

SOURCE TEXT:
${String(text).slice(0, 6000)}` });
  if (!j.hook) throw new AIError('Claude did not return a hook. Try again.');
  return { title: String(j.title || '').trim(), hook: String(j.hook).trim(), body: arr(j.body), comment: String(j.comment || '').trim() };
}

/** Choose icons, emphasis words, style and effects for each scene. */
async function direct({ title, blocks, themes, fx }) {
  const scenes = blocks.map((b, i) => `${i}. [${b.type}] ${b.text}`).join('\n');
  const j = await ask({ json: true, max: 1200, system: SYS, user:
`Direct the visuals for this short video titled "${title}".
For each scene pick ONE icon that matches its meaning from: ${MOTIFS.join(', ')} (or "none"), and 1 to 3 emphasis words that should be highlighted. Then pick the overall look.
Allowed themes: ${themes.join(' | ')}
Allowed pace: Calm | Balanced | Punchy
Allowed effects: ${JSON.stringify(fx)}
SCENES:
${scenes}
Return {"scenes":[{"motif":"...","emphasis":["..."]}], "theme":"...", "pace":"...", "fx":{"caption":"...","transition":"...","camera":"...","particles":"..."}} with exactly ${blocks.length} scenes in order.`});
  return { scenes: Array.isArray(j.scenes) ? j.scenes : [], theme: j.theme, pace: j.pace, fx: j.fx || {} };
}

/** Write a new script that follows the structure of a reel that performed well. */
async function fromReference({ reference, topic, niche }) {
  const r = reference, stats = ['views', 'likes', 'comments', 'shares', 'saves'].filter((k) => r[k]).map((k) => `${k}: ${r[k]}`).join(', ');
  const j = await ask({ json: true, max: 1500, system: SYS, user:
`A reel did well${niche ? ' in the niche "' + niche + '"' : ''}. Study its structure (how the hook works, the pacing, how it ends) and write a NEW script on ${topic ? 'the topic "' + topic + '"' : 'a closely related new topic'} that uses the same structure with completely original wording. Do not reuse its sentences.
REFERENCE CAPTION: ${String(r.caption || r.title || '').slice(0, 3000)}
REFERENCE RESULTS: ${stats || 'unknown'}${r.why && r.why.length ? '\nWHY IT WORKED: ' + r.why.join('; ') : ''}
Rules: ONE-line hook under 12 words; 4 to 7 body lines of one idea each (under 20 words); a final comment call-to-action. Plain text, no emojis.
Return {"title":"...","hook":"...","body":["..."],"comment":"...","rationale":"one sentence on what structure you reused"}.`});
  if (!j.hook) throw new AIError('Claude did not return a hook. Try again.');
  return { title: String(j.title || '').trim(), hook: String(j.hook).trim(), body: arr(j.body), comment: String(j.comment || '').trim(), rationale: String(j.rationale || '').trim() };
}

async function test() { const t = await ask({ system: 'Reply with the single word OK.', user: 'ping', max: 10 }); return /ok/i.test(t); }

window.AI = {
  MODELS, MOTIFS, AIError,
  configured: () => !!state.key, model: () => state.model, remembered: () => state.remembered,
  setKey(key, model, remember) { state.key = String(key || '').trim(); state.model = model || state.model; state.remembered = !!remember; persist(); },
  setOptions(model, remember) { state.model = model || state.model; state.remembered = !!remember; persist(); },
  clear() { state.key = ''; state.remembered = false; persist(); },
  ask, scriptFromText, direct, fromReference, test,
};
})();
