/* Claude client. Two ways to connect, no matter which you pick the tools behave the same:
 *   • Sign in: the local helper runs YOUR signed-in Claude Code (your Claude plan, no API key).
 *   • API key: your key goes straight from this browser to Anthropic.
 * Powers: script import, scene direction and "make one like this".
 */
(() => {
  "use strict";
  const KEY = "rs_ai",
    PREF = "rs_ai_pref",
    URL = "https://api.anthropic.com/v1/messages";
  const MODELS = [
    ["claude-sonnet-5-5", "Sonnet 5.5: balanced (recommended)"],
    ["claude-haiku-5-5", "Haiku 5.5: fastest and cheapest"],
    ["claude-opus-5-5", "Opus 5.5: best quality, costs more"],
  ];
  const ALIASES = [
    ["sonnet", "Sonnet: balanced (recommended)"],
    ["haiku", "Haiku: fastest"],
    ["opus", "Opus: best quality, uses more of your plan"],
  ];
  const MOTIFS = [
    "chart",
    "coin",
    "flame",
    "bolt",
    "target",
    "clock",
    "heart",
    "check",
  ];
  /* "Sign in with Claude" runs Claude Code on your own computer, so it can only work from localhost. */
  const HOSTED = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const state = {
    mode: HOSTED ? "key" : "signin", // a deployed site starts on the API key until it is paired with the helper
    key: "",
    model: MODELS[0][0],
    alias: "sonnet",
    remembered: false,
    ready: false,
    claude: null,
  };

  class AIError extends Error {
    constructor(m, info) {
      super(m);
      this.name = "AIError";
      Object.assign(this, info || {});
    }
  }

  (function load() {
    try {
      const p = JSON.parse(localStorage.getItem(PREF) || "{}");
      if (p.mode) state.mode = p.mode;
      if (p.model) state.model = p.model;
      if (p.alias) state.alias = p.alias;
    } catch (e) {
      /* storage blocked */
    }
    for (const store of [sessionStorage, localStorage]) {
      try {
        const s = store.getItem(KEY);
        if (s) {
          state.key = JSON.parse(s).key || "";
          state.remembered = store === localStorage;
          return;
        }
      } catch (e) {
        /* storage blocked */
      }
    }
  })();
  function persist() {
    try {
      localStorage.setItem(
        PREF,
        JSON.stringify({
          mode: state.mode,
          model: state.model,
          alias: state.alias,
        }),
      );
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
      if (state.key)
        (state.remembered ? localStorage : sessionStorage).setItem(
          KEY,
          JSON.stringify({ key: state.key }),
        );
    } catch (e) {
      /* storage blocked */
    }
  }

  function friendly(status, msg) {
    if (status === 401)
      return "Claude rejected the API key. Check that you copied it fully (it starts with sk-ant-).";
    if (status === 403) return "This API key is not allowed to use that model.";
    if (status === 404)
      return "That model name was not found for your account. Pick another model.";
    if (status === 429)
      return "Claude says you are sending too many requests. Wait a minute and try again.";
    if (status === 529 || status === 503)
      return "Claude is busy right now. Try again in a moment.";
    if (status === 400 && /credit|balance/i.test(msg))
      return "Your Anthropic account is out of credit. Add credit at console.anthropic.com.";
    return msg || "Claude returned an error (HTTP " + status + ").";
  }
  function extractJson(text) {
    const a = text.indexOf("{"),
      b = text.lastIndexOf("}");
    if (a < 0 || b < a)
      throw new AIError("Claude replied in an unexpected format. Try again.");
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch (e) {
      throw new AIError("Claude replied in an unexpected format. Try again.");
    }
  }

  /* ---------- connection state ---------- */
  async function refresh() {
    const s = await Helper.session(true);
    if (!s.available) {
      state.claude = null;
      state.ready = false;
      return status();
    }
    try {
      const c = await Helper.call("/api/claude/status");
      state.claude = c;
      state.ready = !!(c.installed && c.loggedIn);
      /* a deployed site that has just been paired with a signed-in helper uses it unless you chose an API key */
      if (HOSTED && state.ready && !state.key && state.mode === "key")
        state.mode = "signin";
    } catch (e) {
      state.claude = null;
      state.ready = false;
    }
    return status();
  }
  function status() {
    const h = Helper.info();
    return {
      mode: state.mode,
      ready: configured(),
      helper: !!(h && h.available),
      reachable: !!(h && h.reachable),
      paired: !!(h && h.paired),
      claude: state.claude,
      hasKey: !!state.key,
      alias: state.alias,
      model: state.model,
    };
  }
  const configured = () =>
    state.mode === "signin" ? state.ready : !!state.key;
  const label = () =>
    state.mode === "signin"
      ? state.claude && state.claude.email
        ? "Signed in · " + state.alias
        : "Signed in with Claude"
      : state.model;

  /* ---------- one request ---------- */
  async function viaHelper(system, user) {
    try {
      return (
        await Helper.call("/api/claude/ask", {
          method: "POST",
          body: { system, user, model: state.alias },
        })
      ).text;
    } catch (e) {
      throw new AIError(e.message, { offline: e.offline, status: e.status });
    }
  }
  async function viaKey(system, user, max, images) {
    let res;
    const content =
      images && images.length
        ? [
            ...images.map((data) => ({
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data },
            })),
            { type: "text", text: user },
          ]
        : user;
    try {
      res = await fetch(URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": state.key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: state.model,
          max_tokens: max,
          system,
          messages: [{ role: "user", content }],
        }),
      });
    } catch (e) {
      throw new AIError("Could not reach Claude. Check your connection.", {
        network: true,
      });
    }
    let j;
    try {
      j = await res.json();
    } catch (e) {
      throw new AIError(
        "Unexpected reply from Claude (HTTP " + res.status + ").",
      );
    }
    if (!res.ok || j.type === "error")
      throw new AIError(friendly(res.status, j.error && j.error.message), {
        status: res.status,
      });
    return (j.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
  async function ask({ system, user, max = 1500, json = false }) {
    if (state.mode === "signin") {
      if (!state.ready) {
        await refresh();
        if (!state.ready)
          throw new AIError("Sign in with Claude first.", { nokey: true });
      }
    } else if (!state.key)
      throw new AIError("Add your Claude API key first.", { nokey: true });
    const text =
      state.mode === "signin"
        ? await viaHelper(system, user)
        : await viaKey(system, user, max);
    return json ? extractJson(text) : text;
  }

  /** Like ask(), but Claude also sees images (JPEG frames as base64). */
  async function askVision({ system, user, images, max = 3500, json = false }) {
    if (state.mode === "signin") {
      if (!state.ready) {
        await refresh();
        if (!state.ready)
          throw new AIError("Sign in with Claude first.", { nokey: true });
      }
    } else if (!state.key)
      throw new AIError("Connect Claude first.", { nokey: true });
    let text;
    if (state.mode === "signin") {
      try {
        text = (
          await Helper.call("/api/claude/vision", {
            method: "POST",
            body: { system, user, images, model: state.alias },
          })
        ).text;
      } catch (e) {
        throw new AIError(e.message, { offline: e.offline, status: e.status });
      }
    } else text = await viaKey(system, user, max, images);
    return json ? extractJson(text) : text;
  }

  const arr = (v) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  const SYS =
    "You are a short-form video scriptwriter. You reply with only a JSON object, no prose and no code fences.";

  /** Turn a caption or transcript into a fresh script in the creator's own words. */
  /** Scripts written by itself from what has worked: each one follows a hook pattern chosen by the learning loop and comes with
   * several candidate hooks. `plan` = [{ id, label, guide, example }], one per script. */
  async function autoScripts({
    niche,
    docs,
    brand,
    topic,
    plan,
    winners,
    avoid,
  }) {
    const notes = (docs || [])
      .map(
        (d, i) =>
          `### Note ${i + 1}: ${d.title}\n${String(d.text).slice(0, 6000)}`,
      )
      .join("\n\n")
      .slice(0, 20000);
    const n = plan.length;
    const j = await ask({
      json: true,
      max: Math.min(4000, 900 * n + 500),
      system: SYS,
      user: `Write ${n} different spoken scripts for short vertical videos${niche ? " for " + niche : ""}.
${notes ? "Use ONLY the facts in the knowledge base below. Never invent prices, statistics, names, dates or guarantees that are not in the notes; if a number is missing, write the idea without a number.\n" : "There are no notes, so write evergreen, useful advice and do not state any statistic, price or guarantee as a fact.\n"}${brand && brand.audience ? "Audience: " + brand.audience + "\n" : ""}${brand && brand.tone ? "Tone: " + brand.tone + "\n" : ""}${topic ? "Focus on this idea or angle: " + topic + "\n" : ""}
HOOK PATTERNS, one per script (the hook is the most important line, because it decides whether people keep watching):
${plan.map((p, i) => `Script ${i + 1}: ${p.label}. ${p.guide} Shape, not wording: "${p.example}"`).join("\n")}
${winners && winners.length ? "Hooks that earned this creator the most engagement (learn what they have in common; never copy them):\n" + winners.map((h) => "- " + h).join("\n") + "\n" : ""}${avoid && avoid.length ? "Do not repeat or closely resemble these recent hooks:\n" + avoid.map((h) => "- " + h).join("\n") + "\n" : ""}
Rules: for each script give FIVE different candidate hooks, all following that script's pattern, each ONE line under 12 words, concrete, spoken, about the viewer, no filler such as "Hey" or "Today". Body: 4 to 7 lines, each ONE idea under 20 words, building on the strongest hook. End with one comment call-to-action line (for example: Comment "GUIDE" and follow for more). Plain text only, no emojis or hashtags.
Return {"scripts": [{"title": "...", "hooks": ["...","...","...","...","..."], "body": ["..."], "comment": "..."}]}.
${notes ? "\nKNOWLEDGE BASE:\n" + notes : ""}`,
    });
    const list = (Array.isArray(j.scripts) ? j.scripts : []).filter(
      (x) => x && (arr(x.hooks).length || x.hook),
    );
    if (!list.length)
      throw new AIError("Claude did not return any scripts. Try again.");
    return list.slice(0, n).map((x, i) => ({
      pattern: plan[i].id,
      title: String(x.title || "").trim(),
      hooks: arr(x.hooks).length ? arr(x.hooks) : [String(x.hook).trim()],
      body: arr(x.body),
      comment: String(x.comment || "").trim(),
    }));
  }
  /** Scripts written only from the user's own notes (their knowledge base). Resolves an array of { title, hook, body, comment }. */
  async function fromKnowledge({ docs, brand, topic, count, niche }) {
    const notes = docs
      .map(
        (d, i) =>
          `### Note ${i + 1}: ${d.title}\n${String(d.text).slice(0, 8000)}`,
      )
      .join("\n\n")
      .slice(0, 24000);
    const n = Math.max(1, Math.min(5, count || 3));
    const j = await ask({
      json: true,
      max: Math.min(4000, 700 * n + 500),
      system: SYS,
      user: `Write ${n} different spoken scripts for short vertical videos${niche ? " for " + niche : ""}, using ONLY the facts in the knowledge base below. Never invent prices, statistics, names, dates or guarantees that are not in the notes; if a number is missing, write the idea without a number. Each script takes a different angle.
${brand && brand.audience ? "Audience: " + brand.audience + "\n" : ""}${brand && brand.tone ? "Tone: " + brand.tone + "\n" : ""}${topic ? "Focus on this idea or angle: " + topic + "\n" : ""}Rules for each script: the hook is ONE line, under 12 words, with a number from the notes or a bold claim the notes support. Each body line is ONE idea, under 20 words. 4 to 7 body lines. End with one comment call-to-action line (for example: Comment "GUIDE" and follow for more). Plain text only, no emojis or hashtags.
Return {"scripts": [{"title": "...", "hook": "...", "body": ["..."], "comment": "..."}]}.

KNOWLEDGE BASE:
${notes}`,
    });
    const list = (Array.isArray(j.scripts) ? j.scripts : []).filter(
      (x) => x && x.hook,
    );
    if (!list.length)
      throw new AIError("Claude did not return any scripts. Try again.");
    return list.slice(0, n).map((x) => ({
      title: String(x.title || "").trim(),
      hook: String(x.hook).trim(),
      body: arr(x.body),
      comment: String(x.comment || "").trim(),
    }));
  }
  async function scriptFromText({ text, niche }) {
    const j = await ask({
      json: true,
      max: 1400,
      system: SYS,
      user: `Rewrite this reel's caption or transcript as a spoken script for a short vertical video${niche ? " for " + niche : ""}. Keep the same idea and structure but use completely original wording; do not copy sentences.
Rules: the hook is ONE line, under 12 words, with a number or a bold claim. Each body line is ONE idea, under 20 words. End with one comment call-to-action line (for example: Comment "GUIDE" and follow for more). 4 to 7 body lines. Plain text only, no emojis or hashtags.
Return {"title": "...", "hook": "...", "body": ["..."], "comment": "..."}.

SOURCE TEXT:
${String(text).slice(0, 6000)}`,
    });
    if (!j.hook) throw new AIError("Claude did not return a hook. Try again.");
    return {
      title: String(j.title || "").trim(),
      hook: String(j.hook).trim(),
      body: arr(j.body),
      comment: String(j.comment || "").trim(),
    };
  }

  /** Choose icons, emphasis words, style and effects for each scene. */
  async function direct({ title, blocks, themes, fx }) {
    const scenes = blocks
      .map((b, i) => `${i}. [${b.type}] ${b.text}`)
      .join("\n");
    const j = await ask({
      json: true,
      max: 1200,
      system: SYS,
      user: `Direct the visuals for this short video titled "${title}".
For each scene pick ONE icon that matches its meaning from: ${MOTIFS.join(", ")} (or "none"), and 1 to 3 emphasis words that should be highlighted. Then pick the overall look.
Allowed themes: ${themes.join(" | ")}
Allowed pace: Calm | Balanced | Punchy
Allowed effects: ${JSON.stringify(fx)}
SCENES:
${scenes}
Return {"scenes":[{"motif":"...","emphasis":["..."]}], "theme":"...", "pace":"...", "fx":{"caption":"...","transition":"...","camera":"...","particles":"..."}} with exactly ${blocks.length} scenes in order.`,
    });
    return {
      scenes: Array.isArray(j.scenes) ? j.scenes : [],
      theme: j.theme,
      pace: j.pace,
      fx: j.fx || {},
    };
  }

  /** Write a new script that follows the structure of a reel that performed well. */
  async function fromReference({ reference, topic, niche }) {
    const r = reference,
      stats = ["views", "likes", "comments", "shares", "saves"]
        .filter((k) => r[k])
        .map((k) => `${k}: ${r[k]}`)
        .join(", ");
    const j = await ask({
      json: true,
      max: 1500,
      system: SYS,
      user: `A reel did well${niche ? ' in the niche "' + niche + '"' : ""}. Study its structure (how the hook works, the pacing, how it ends) and write a NEW script on ${topic ? 'the topic "' + topic + '"' : "a closely related new topic"} that uses the same structure with completely original wording. Do not reuse its sentences.
REFERENCE CAPTION: ${String(r.caption || r.title || "").slice(0, 3000)}
REFERENCE RESULTS: ${stats || "unknown"}${r.why && r.why.length ? "\nWHY IT WORKED: " + r.why.join("; ") : ""}
Rules: ONE-line hook under 12 words; 4 to 7 body lines of one idea each (under 20 words); a final comment call-to-action. Plain text, no emojis.
Return {"title":"...","hook":"...","body":["..."],"comment":"...","rationale":"one sentence on what structure you reused"}.`,
    });
    if (!j.hook) throw new AIError("Claude did not return a hook. Try again.");
    return {
      title: String(j.title || "").trim(),
      hook: String(j.hook).trim(),
      body: arr(j.body),
      comment: String(j.comment || "").trim(),
      rationale: String(j.rationale || "").trim(),
    };
  }

  /** Watch a reel as frames (plus its speech and caption), write the script and describe every frame. */
  async function reelToScript({
    frames,
    transcript,
    caption,
    duration,
    rewrite,
    themes,
    fx,
    niche,
  }) {
    const times = frames
      .map((f, i) => `${i + 1}) ${Number(f.t).toFixed(1)}s`)
      .join("   ");
    const segs =
      transcript && transcript.segments && transcript.segments.length
        ? transcript.segments
            .map((x) => `[${x.start}s to ${x.end}s] ${x.text}`)
            .join("\n")
        : "";
    const j = await askVision({
      json: true,
      max: 4000,
      images: frames.map((f) => f.jpeg),
      system:
        "You are a short-form video analyst and scriptwriter. You reply with only a JSON object, no prose and no code fences.",
      user: `You are watching a short vertical video (a Reel)${niche ? ' in the niche "' + niche + '"' : ""}, ${duration ? Math.round(duration) + " seconds long, " : ""}shown as ${frames.length} frames in time order. A frame was cut wherever the picture changes, plus evenly spaced ones. The images are in this order, with their times:
${times}
${caption ? "CAPTION: " + String(caption).slice(0, 2500) : "There is no caption."}
${segs ? "SPEECH (auto-transcribed, may contain small errors):\n" + segs.slice(0, 5000) : "No speech was transcribed (the video may have no speech)."}

Do this:
1. "breakdown": one entry per frame, in order: "t" (its time in seconds), "visual" (what is shown, in one short sentence) and "text" (any on-screen text, copied exactly, or "").
2. Write the script a creator would use to make this video: ONE hook line, body lines (one idea each, under 20 words) and ONE final comment call-to-action. If the on-screen text or the speech spells out the script, follow it. Otherwise infer it from the visuals.
3. ${rewrite ? "Use completely original wording: same idea, structure and pacing, but do not copy any sentence from the video." : "Stay faithful to the wording on screen and in the speech."}
4. "style": the look that best matches this video. theme must be one of: ${themes.join(" | ")}. pace is Calm, Balanced or Punchy. effects must use only these values: ${JSON.stringify(fx)}.
Return {"title":"...","hook":"...","body":["..."],"comment":"...","breakdown":[{"t":0,"visual":"...","text":"..."}],"style":{"theme":"...","pace":"...","fx":{"caption":"...","transition":"...","camera":"...","particles":"..."}},"notes":"one sentence on what the video is about"}`,
    });
    if (!j.hook)
      throw new AIError(
        "Claude could not find a script in that video. Try pasting the caption too.",
      );
    const bd = Array.isArray(j.breakdown)
      ? j.breakdown.map((b, i) => ({
          t: Number(b.t) || (frames[i] ? frames[i].t : 0),
          visual: String(b.visual || "").slice(0, 260),
          text: String(b.text || "").slice(0, 260),
        }))
      : [];
    return {
      title: String(j.title || "").trim(),
      hook: String(j.hook).trim(),
      body: arr(j.body),
      comment: String(j.comment || "").trim(),
      breakdown: bd,
      style: j.style || {},
      notes: String(j.notes || "").trim(),
    };
  }

  async function test() {
    const t = await ask({
      system: "Reply with the single word OK.",
      user: "ping",
      max: 10,
    });
    return /ok/i.test(t);
  }

  window.AI = {
    MODELS,
    ALIASES,
    MOTIFS,
    AIError,
    configured,
    label,
    status,
    refresh,
    hosted: HOSTED,
    mode: () => state.mode,
    setMode(m) {
      state.mode = m === "key" ? "key" : "signin";
      persist();
    },
    alias: () => state.alias,
    setAlias(a) {
      state.alias = a;
      persist();
    },
    model: () => state.model,
    remembered: () => state.remembered,
    setKey(key, model, remember) {
      state.key = String(key || "").trim();
      state.model = model || state.model;
      state.remembered = !!remember;
      persist();
    },
    setOptions(model, remember) {
      state.model = model || state.model;
      state.remembered = !!remember;
      persist();
    },
    clear() {
      state.key = "";
      state.remembered = false;
      persist();
    },
    signIn: () =>
      Helper.call("/api/claude/login", { method: "POST", body: {} }),
    ask,
    askVision,
    scriptFromText,
    fromKnowledge,
    autoScripts,
    direct,
    fromReference,
    reelToScript,
    test,
  };
})();
