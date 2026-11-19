/* Pure helpers with no DOM: reel-link parsing, script splitting, paste handling, hook analysis and the learning loop. */
(() => {
  "use strict";
  const words = (t) =>
    String(t == null ? "" : t)
      .trim()
      .match(/\S+/g) || [];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hasText = (s) => /[\p{L}\p{N}]/u.test(s);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const CTA =
    /\b(comment|follow|link in (my )?bio|dm me|dm us|save this|share this|subscribe|turn on notifications|tap the link)\b/i;

  /* ---------- reel links ---------- */
  function parseReelUrl(input) {
    const m = String(input || "")
      .trim()
      .match(
        /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,})/i,
      );
    if (!m) return null;
    const k = m[1].toLowerCase(),
      kind = k === "p" ? "p" : k === "tv" ? "tv" : "reel";
    return {
      shortcode: m[2],
      kind,
      url: `https://www.instagram.com/${kind}/${m[2]}/`,
    };
  }

  /* ---------- script splitting ---------- */
  function clean(text, keepTags) {
    let t = String(text == null ? "" : text)
      .replace(/\r/g, "")
      .replace(/https?:\/\/\S+/g, "");
    if (!keepTags)
      t = t
        .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1")
        .replace(/(^|\s)@[\w.]+/g, "$1");
    return t;
  }
  function sentences(text, keepTags) {
    const out = [];
    clean(text, keepTags)
      .split(/\n+/)
      .forEach((line) => {
        const l = line.trim();
        if (!l || !hasText(l)) return;
        l.split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"“'(¿¡])/u).forEach((s) => {
          s = s.trim();
          if (s && hasText(s)) out.push(s);
        });
      });
    return out;
  }
  /** Split an over-long line at a comma near the middle (or the middle word) until each part is short enough. */
  function breakLong(s, max = 22) {
    const w = words(s);
    if (w.length <= max) return [s];
    const mid = w.length / 2;
    let best = -1,
      bd = 1e9;
    w.forEach((x, i) => {
      if (i > 3 && i < w.length - 3 && /[,;:—–]$/.test(x)) {
        const d = Math.abs(i - mid);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    const at = best >= 0 ? best + 1 : Math.ceil(mid);
    return [
      ...breakLong(w.slice(0, at).join(" "), max),
      ...breakLong(w.slice(at).join(" "), max),
    ];
  }
  /** Turn a caption or transcript into { hook, body[], comment }. */
  function splitScript(text, o = {}) {
    const ss = sentences(text, false);
    if (!ss.length) return null;
    let comment = "";
    if (ss.length > 1 && CTA.test(ss[ss.length - 1])) comment = ss.pop();
    const hook = ss.shift();
    const body = ss.flatMap((s) => breakLong(s)).slice(0, o.maxBody || 14);
    return { hook, body, comment };
  }
  function blocksFrom(parts, o = {}) {
    const b = [{ type: "hook", text: parts.hook || "" }];
    (parts.body || []).forEach((t) => b.push({ type: "body", text: t }));
    const c =
      parts.comment || (o.addCta ? 'Comment "YES" and follow for more.' : "");
    if (c) b.push({ type: "comment", text: c });
    return b;
  }
  /** Pasting several sentences into one line spreads them over the following lines. Returns null for a normal single-line paste. */
  function splitPaste(blocks, i, text, sel) {
    const ss = sentences(text, true).flatMap((s) => breakLong(s));
    const cur = blocks[i];
    if (ss.length < 2 || !cur) return null;
    const s0 = sel ? sel.start : cur.text.length,
      s1 = sel ? sel.end : cur.text.length;
    const before = cur.text.slice(0, s0),
      after = cur.text.slice(s1).trim();
    const out = blocks.map((b) => ({ type: b.type, text: b.text }));
    let cta = "";
    if (ss.length > 2 && CTA.test(ss[ss.length - 1])) cta = ss.pop();
    if (cur.type === "comment") {
      const last = cta || ss.pop(),
        lines = ss.map((t) => ({ type: "body", text: t }));
      out[i].text = (before + last + (after ? " " + after : "")).trim();
      out.splice(i, 0, ...lines);
      return { blocks: out, focus: i + lines.length };
    }
    out[i].text = (before + ss[0]).trim();
    const rest = ss.slice(1);
    if (after) {
      if (rest.length)
        rest[rest.length - 1] = (rest[rest.length - 1] + " " + after).trim();
      else out[i].text = (out[i].text + " " + after).trim();
    }
    const lines = rest.map((t) => ({ type: "body", text: t }));
    out.splice(i + 1, 0, ...lines);
    if (cta) {
      const ci = out.findIndex((b) => b.type === "comment");
      if (ci >= 0) out[ci].text = cta;
      else out.push({ type: "comment", text: cta });
    }
    return { blocks: out, focus: i + lines.length };
  }

  /* ---------- what makes a hook work ---------- */
  function firstLine(text) {
    return sentences(text, true)[0] || "";
  }
  function hookFeatures(text) {
    const t = String(text || ""),
      w = words(t);
    return {
      number: /\d/.test(t),
      question: /\?/.test(t),
      you: /\b(you|your|you're|you’ll|you'll)\b/i.test(t),
      short: w.length > 0 && w.length <= 8,
      dollar: /[$€£]/.test(t),
      negative:
        /\b(stop|don't|dont|never|mistake|wrong|killing|worst|fail|lose|losing)\b/i.test(
          t,
        ),
    };
  }
  const FEATURES = [
    ["number", "Has a number"],
    ["question", "Asks a question"],
    ["you", "Talks to “you”"],
    ["short", "Short (8 words or fewer)"],
    ["dollar", "Mentions money"],
    ["negative", "Names a problem"],
  ];
  const median = (a) => {
    const s = a.filter((x) => isFinite(x)).sort((x, y) => x - y);
    return s.length
      ? s.length % 2
        ? s[s.length >> 1]
        : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
      : 0;
  };
  /** Weighted engagement per 100 views: shares and saves count more than likes. */
  function engagement(r) {
    const base = r.views || r.reach || 0;
    if (!base) return 0;
    return (
      (((r.likes || 0) +
        3 * (r.comments || 0) +
        5 * (r.shares || 0) +
        4 * (r.saves || 0)) /
        base) *
      100
    );
  }
  function featureLift(rows, getText) {
    const get = getText || ((r) => r.caption || r.title || "");
    const scored = rows
      .map((r) => ({ f: hookFeatures(firstLine(get(r))), s: engagement(r) }))
      .filter((x) => x.s > 0);
    if (scored.length < 4) return [];
    return FEATURES.map(([k, label]) => {
      const w = scored.filter((x) => x.f[k]),
        wo = scored.filter((x) => !x.f[k]);
      if (w.length < 2 || wo.length < 2) return null;
      const a = avg(w.map((x) => x.s)),
        b = avg(wo.map((x) => x.s));
      return {
        key: k,
        label,
        withN: w.length,
        withoutN: wo.length,
        withAvg: a,
        withoutAvg: b,
        lift: b ? a / b : 0,
      };
    })
      .filter(Boolean)
      .sort((a, b) => b.lift - a.lift);
  }

  /* ---------- learning loop: a bandit over creative choices, rewarded by real engagement ---------- */
  function rewardFrom(score, med) {
    return clamp(med ? score / (2 * med) : score / 5, 0, 1);
  }
  function learn(arms, picks, reward) {
    Object.entries(picks).forEach(([dim, opt]) => {
      if (!opt) return;
      arms[dim] = arms[dim] || {};
      const a = (arms[dim][opt] = arms[dim][opt] || { n: 0, sum: 0 });
      a.n++;
      a.sum += reward;
    });
    return arms;
  }
  /** UCB1 with a neutral prior: proven options rise, untried ones keep a small exploration bonus. */
  function rank(dim, options) {
    const N = options.reduce((a, o) => a + (dim && dim[o] ? dim[o].n : 0), 0);
    return options
      .map((o) => {
        const a = dim && dim[o],
          n = a ? a.n : 0,
          mean = ((a ? a.sum : 0) + 1) / (n + 2),
          bonus = 0.12 * Math.sqrt(Math.log(N + 2) / (n + 1));
        return { option: o, n, mean, score: mean + bonus };
      })
      .sort((x, y) => y.score - x.score);
  }
  const totalResults = (arms) =>
    Object.values((arms && arms.theme) || {}).reduce((a, x) => a + x.n, 0);

  const API = {
    words,
    parseReelUrl,
    sentences,
    breakLong,
    splitScript,
    blocksFrom,
    splitPaste,
    hookFeatures,
    firstLine,
    FEATURES,
    median,
    engagement,
    featureLift,
    rewardFrom,
    learn,
    rank,
    totalResults,
    CTA,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.Tools = API;
})();
