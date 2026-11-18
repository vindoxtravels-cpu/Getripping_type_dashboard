/* Voice-over generation.
 *   • Edge voices: free, neural, through the local helper (the edge-tts package).
 *   • ElevenLabs: your own API key, called straight from this browser.
 * Each script line is spoken on its own, so every scene is timed to its real speech.
 */
(() => {
'use strict';
const PREF = 'rs_voice', EL = 'rs_eleven', EL_URL = 'https://api.elevenlabs.io/v1';
const EL_MODELS = [['eleven_multilingual_v2', 'Multilingual v2: best quality'], ['eleven_turbo_v2_5', 'Turbo v2.5: fast'], ['eleven_flash_v2_5', 'Flash v2.5: fastest, cheapest']];
const LEAD = 0.1, TAIL = 0.2; // silence before and after each spoken line; the video's scenes use the same gaps
const prefs = { provider: 'edge', voice: 'en-US-AriaNeural', rate: '+0%', voiceId: '', model: EL_MODELS[0][0] };
const el = { key: '', remembered: false };

class VoiceError extends Error { constructor(m, info) { super(m); this.name = 'VoiceError'; Object.assign(this, info || {}); } }

(function load() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch (e) { /* storage blocked */ }
  for (const store of [sessionStorage, localStorage]) {
    try { const s = store.getItem(EL); if (s) { el.key = JSON.parse(s).key || ''; el.remembered = store === localStorage; return; } } catch (e) { /* storage blocked */ }
  }
})();
const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } };
function persistKey() {
  try { sessionStorage.removeItem(EL); localStorage.removeItem(EL); if (el.key) (el.remembered ? localStorage : sessionStorage).setItem(EL, JSON.stringify({ key: el.key })); } catch (e) { /* storage blocked */ }
}

/* ---------- audio helpers ---------- */
let ctx = null;
const audioCtx = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
const decode = (bytes) => audioCtx().decodeAudioData(bytes.slice(0));
/** Join the spoken lines with the same silences the video's scenes use. */
function join(bufs) {
  const ac = audioCtx(), sr = bufs[0].sampleRate, chans = Math.max(...bufs.map((b) => b.numberOfChannels));
  const lens = bufs.map((b) => Math.round((LEAD + TAIL) * sr) + b.length), out = ac.createBuffer(chans, lens.reduce((a, n) => a + n, 0), sr);
  let at = 0;
  bufs.forEach((b, i) => {
    const off = at + Math.round(LEAD * sr);
    for (let c = 0; c < chans; c++) out.getChannelData(c).set(b.getChannelData(Math.min(c, b.numberOfChannels - 1)), off);
    at += lens[i];
  });
  return { buffer: out, sceneDurations: bufs.map((b) => LEAD + b.duration + TAIL) };
}
/** 16-bit WAV for the preview player and the download button. */
function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c)); let p = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

/* ---------- Edge voices (through the helper) ---------- */
let edgeList = null;
const edge = {
  async voices() { if (!edgeList) edgeList = (await Helper.call('/api/tts/voices')).voices; return edgeList; },
  async speak(text, o) {
    try { return await Helper.call('/api/tts/edge', { method: 'POST', body: { text, voice: o.voice, rate: o.rate || '+0%' }, expect: 'bytes' }); }
    catch (e) { throw new VoiceError(e.message, { offline: e.offline }); }
  },
};

/* ---------- ElevenLabs (your key, direct) ---------- */
function elFriendly(status, d) {
  const msg = (d && (d.message || (typeof d === 'string' && d))) || '';
  if (status === 401) return 'ElevenLabs rejected the API key. Check that you copied it fully.';
  if (status === 402 || /quota|credit|subscription/i.test(msg) || (d && /quota_exceeded|payment/i.test(d.status || ''))) return 'Your ElevenLabs plan is out of credits or does not include this voice. ' + (msg || '');
  if (status === 404) return 'ElevenLabs could not find that voice. Pick another one.';
  if (status === 422) return 'ElevenLabs refused the request: ' + (msg || 'check the voice and model.');
  if (status === 429) return 'ElevenLabs says you are sending too many requests. Wait a moment and try again.';
  return msg || ('ElevenLabs returned an error (HTTP ' + status + ').');
}
async function elFetch(path, init) {
  if (!el.key) throw new VoiceError('Add your ElevenLabs API key first.', { nokey: true });
  let r; try { r = await fetch(EL_URL + path, Object.assign({}, init, { headers: Object.assign({ 'xi-api-key': el.key }, init && init.headers) })); }
  catch (e) { throw new VoiceError('Could not reach ElevenLabs. Check your connection.', { network: true }); }
  if (!r.ok) { let d = null; try { const j = await r.json(); d = j.detail; if (Array.isArray(d)) d = { message: d.map((x) => x.msg).join('; ') }; } catch (e) { /* not json */ } throw new VoiceError(elFriendly(r.status, d), { status: r.status }); }
  return r;
}
const eleven = {
  configured: () => !!el.key, remembered: () => el.remembered,
  setKey(key, remember) { el.key = String(key || '').trim(); el.remembered = !!remember; persistKey(); },
  setRemember(remember) { el.remembered = !!remember; persistKey(); },
  clear() { el.key = ''; el.remembered = false; persistKey(); },
  async voices() { const j = await (await elFetch('/voices')).json(); return (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, category: v.category || '', labels: v.labels || {} })); },
  async speak(text, o) {
    const r = await elFetch(`/text-to-speech/${encodeURIComponent(o.voiceId)}?output_format=mp3_44100_128`, { method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: o.model || EL_MODELS[0][0] }) });
    return r.arrayBuffer();
  },
  test() { return eleven.voices(); },
};

/** Speak every non-empty line and return one audio buffer plus each scene's length. */
async function generate(items, opt, onProgress) {
  const bufs = [];
  for (let i = 0; i < items.length; i++) {
    if (onProgress) onProgress(i, items.length);
    const text = items[i].text.trim();
    const bytes = opt.provider === 'eleven' ? await eleven.speak(text, opt) : await edge.speak(text, opt);
    try { bufs.push(await decode(bytes)); } catch (e) { throw new VoiceError('The voice service returned audio the browser could not read.'); }
  }
  const j = join(bufs);
  return { buffer: j.buffer, sceneDurations: j.sceneDurations, duration: j.buffer.duration, name: opt.provider === 'eleven' ? 'ElevenLabs voice-over' : 'Edge voice-over' };
}

window.Voice = {
  EL_MODELS, VoiceError, prefs, save: (o) => { Object.assign(prefs, o); savePrefs(); },
  edge, eleven, generate, toWav, decode, LEAD, TAIL,
};
})();
