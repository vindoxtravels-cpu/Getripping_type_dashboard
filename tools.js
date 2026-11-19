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

  /* ---------- hook patterns: the shapes a hook can take, so the learning loop can find which ones win ---------- */
  const HOOK_PATTERNS = [
    {
      id: "number",
      label: "Number-led",
      guide: "Open with a specific number or result that the notes support.",
      example: "I compared 7 visa agencies. Only 2 gave straight answers.",
    },
    {
      id: "question",
      label: "Question",
      guide: "Ask the question the viewer is already asking themselves.",
      example: "Why do 1 in 6 Schengen applications get refused?",
    },
    {
      id: "mistake",
      label: "Mistake or warning",
      guide: "Warn about one costly mistake and hint at the fix.",
      example: "Stop sending your visa file before checking this one page.",
    },
    {
      id: "contrarian",
      label: "Contrarian",
      guide: "Challenge a belief most people in the niche hold.",
      example: "The cheapest country to study in is not the one you think.",
    },
    {
      id: "secret",
      label: "Insider secret",
      guide: "Promise something the usual providers do not say out loud.",
      example: "Your agency will not tell you why files really get refused.",
    },
    {
      id: "story",
      label: "Mini story",
      guide:
        "Drop into the middle of a very short story: a person, a stake, a twist.",
      example:
        "Meera sent her documents on Monday. By Friday she still had no update.",
    },
    {
      id: "promise",
      label: "How-to promise",
      guide: "Promise a clear outcome in a short time.",
      example: "How to check your visa file in five minutes.",
    },
    {
      id: "versus",
      label: "Comparison",
      guide: "Put two options head to head.",
      example: "Germany or Canada: which one really costs less?",
    },
    {
      id: "stat",
      label: "Shock stat",
      guide: "Lead with one surprising figure and what it means.",
      example: "57% of visa clients said they never got a status update.",
    },
    {
      id: "direct",
      label: "Direct callout",
      guide: "Call out exactly who this is for.",
      example: "If you send staff to Europe, read this before the next trip.",
    },
  ];
  const PATTERN_IDS = HOOK_PATTERNS.map((p) => p.id);
  /** Which pattern a hook line follows (a rule of thumb, good enough to count wins per shape). */
  function hookPattern(text) {
    const t = String(text || "").trim(),
      w = words(t);
    if (!t) return "direct";
    if (/\bvs\.?\b|\bversus\b|\bor\b[^?]*\?/i.test(t)) return "versus";
    if (/^how to\b|\bin \d+ (minutes|days|steps|seconds)\b|^how i\b/i.test(t))
      return "promise";
    if (
      /\?\s*$/.test(t) ||
      /^(why|how|what|which|is|are|do|does|can|should|will)\b/i.test(t)
    )
      return "question";
    if (/\d+\s?%|\b\d+\s+(out of|in)\s+\d+\b|\b1 in \d+\b/i.test(t))
      return "stat";
    if (/\b(stop|don'?t|never|mistake|avoid|warning|careful)\b/i.test(t))
      return "mistake";
    if (
      /\b(secret|won'?t tell|nobody tells|hidden|truth about|insider)\b/i.test(
        t,
      )
    )
      return "secret";
    if (
      /\b(isn'?t|not what you think|myth|overrated|wrong about|actually)\b/i.test(
        t,
      )
    )
      return "contrarian";
    if (
      /^if you('| a)?(re)?\b|^(hr|founders?|students?|parents?|agents?|managers?)\b/i.test(
        t,
      )
    )
      return "direct";
    if (
      /^[A-Z][a-z]+ (sent|booked|applied|got|lost|asked|paid|called|wrote)\b/.test(
        t,
      )
    )
      return "story";
    if (/\d/.test(t)) return "number";
    return w.length <= 9 ? "direct" : "story";
  }
  /** A quick quality score (0 to 100) for a hook line: short, concrete, about "you", and the traits that earned lift for this creator. */
  function scoreHook(text, lift) {
    const t = String(text || "").trim(),
      w = words(t),
      f = hookFeatures(t);
    let s = 50;
    if (w.length >= 4 && w.length <= 11) s += 14;
    else if (w.length > 14) s -= 16;
    else if (w.length < 4) s -= 10;
    if (f.number) s += 8;
    if (f.you) s += 6;
    if (f.question) s += 3;
    if (f.dollar) s += 3;
    if (f.negative) s += 3;
    if (/^(so|hey|hi|today|in this video|welcome)\b/i.test(t)) s -= 14;
    if (
      /[!]{2,}|\b(amazing|incredible|unbelievable|game.?changer|revolutionary)\b/i.test(
        t,
      )
    )
      s -= 8;
    (lift || []).forEach((x) => {
      if (f[x.key] && x.lift > 0) s += clamp(Math.log(x.lift) * 14, -10, 10);
    });
    return clamp(Math.round(s), 0, 100);
  }
  /** Choose which hook patterns to write: the best-scoring ones by the bandit, plus one the creator has barely tried. */
  function pickPatterns(armsHook, k) {
    const ranked = rank(armsHook, PATTERN_IDS),
      chosen = ranked.slice(0, Math.max(1, k));
    if (k >= 2) {
      const unexplored = ranked.filter((r) => r.n <= 1 && !chosen.includes(r));
      if (unexplored.length) chosen[chosen.length - 1] = unexplored[0];
    }
    return chosen.map((r) =>
      Object.assign(
        {},
        HOOK_PATTERNS.find((p) => p.id === r.option),
        { mean: r.mean, n: r.n },
      ),
    );
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
    HOOK_PATTERNS,
    hookPattern,
    scoreHook,
    pickPatterns,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.Tools = API;
})();
