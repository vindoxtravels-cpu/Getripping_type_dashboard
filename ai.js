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
    orKey: "",
    orModel: "",
  };
  const OR_KEY = "rs_or_key",
    OR_PENDING = "rs_or_pending",
    OR_BASE = "https://openrouter.ai";

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
      if (p.orModel) state.orModel = p.orModel;
    } catch (e) {
      /* storage blocked */
    }
    try {
      state.orKey = localStorage.getItem(OR_KEY) || "";
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
          orModel: state.orModel,
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
      orConnected: !!state.orKey,
      orModel: state.orModel,
      alias: state.alias,
      model: state.model,
    };
  }
  const configured = () =>
    state.mode === "signin"
      ? state.ready
      : state.mode === "openrouter"
        ? !!state.orKey
        : !!state.key;
  const label = () =>
    state.mode === "openrouter"
      ? "OpenRouter · " + (state.orModel || "pick a model").split("/").pop()
      : state.mode === "signin"
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
  /** One request through OpenRouter (any model it offers, billed to your OpenRouter credits). */
  async function viaOpenRouter(system, user, max, images) {
    if (!state.orModel)
      throw new AIError("Pick a model for OpenRouter first.", { nokey: true });
    const content =
      images && images.length
        ? [
            ...images.map((data) => ({
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64," + data },
            })),
            { type: "text", text: user },
          ]
        : user;
    let res;
    try {
      res = await fetch(OR_BASE + "/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + state.orKey,
          "X-Title": "Reel Studio",
        },
        body: JSON.stringify({
          model: state.orModel,
          max_tokens: max,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
        }),
      });
    } catch (e) {
      throw new AIError("Could not reach OpenRouter. Check your connection.", {
        network: true,
      });
    }
    let j = null;
    try {
      j = await res.json();
    } catch (e) {
      /* not json */
    }
    if (!res.ok || !j || j.error) {
      const msg = (j && j.error && (j.error.message || j.error)) || "";
      if (res.status === 401)
        throw new AIError(
          "OpenRouter rejected the sign-in. Sign in with OpenRouter again.",
          { status: 401, nokey: true },
        );
      if (res.status === 402)
        throw new AIError(
          "You are out of OpenRouter credits. Add credits at openrouter.ai/credits.",
          { status: 402 },
        );
      if (
        res.status === 404 ||
        /no endpoints|not a valid model/i.test(String(msg))
      )
        throw new AIError(
          "OpenRouter has no available provider for that model right now. Pick another model.",
          { status: 404 },
        );
      if (res.status === 429)
        throw new AIError(
          "OpenRouter says you are sending too many requests. Wait a minute and try again.",
          { status: 429 },
        );
      throw new AIError(
        String(msg).slice(0, 300) ||
          "OpenRouter returned an error (HTTP " + res.status + ").",
        { status: res.status },
      );
    }
    const m = j.choices && j.choices[0] && j.choices[0].message;
    const text = !m
      ? ""
      : Array.isArray(m.content)
        ? m.content.map((p) => p.text || "").join("")
        : String(m.content || "");
    if (!text)
      throw new AIError(
        "The model returned an empty answer. Try again or pick another model.",
      );
    return text;
  }
  async function ask({ system, user, max = 1500, json = false }) {
    if (state.mode === "signin") {
      if (!state.ready) {
        await refresh();
        if (!state.ready)
          throw new AIError("Sign in with Claude first.", { nokey: true });
      }
    } else if (state.mode === "openrouter") {
      if (!state.orKey)
        throw new AIError("Sign in with OpenRouter first.", { nokey: true });
    } else if (!state.key)
      throw new AIError("Add your Claude API key first.", { nokey: true });
    const text =
      state.mode === "signin"
        ? await viaHelper(system, user)
        : state.mode === "openrouter"
          ? await viaOpenRouter(system, user, max)
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
    } else if (state.mode === "openrouter") {
      if (!state.orKey)
        throw new AIError("Sign in with OpenRouter first.", { nokey: true });
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
    } else if (state.mode === "openrouter")
      text = await viaOpenRouter(system, user, max, images);
    else text = await viaKey(system, user, max, images);
    return json ? extractJson(text) : text;
  }

  /* ---------- Sign in with OpenRouter (OAuth PKCE): a key of your own, billed to your OpenRouter credits ---------- */
  const b64u = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  async function orSignIn() {
    const verifier = b64u(crypto.getRandomValues(new Uint8Array(32))),
      st = b64u(crypto.getRandomValues(new Uint8Array(12))),
      challenge = b64u(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      );
    sessionStorage.setItem(OR_PENDING, JSON.stringify({ verifier, state: st }));
    const u = new window.URL(OR_BASE + "/auth"); // (URL is the name of the Anthropic address in this file)
    u.searchParams.set("callback_url", location.origin + "/");
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    u.searchParams.set("state", st);
    u.searchParams.set("key_label", "Reel Studio");
    location.assign(u.toString());
  }
  /** Finish a sign-in when OpenRouter sends the browser back with ?code=… Returns true if it handled one. */
  async function orInit() {
    const q = new URLSearchParams(location.search),
      code = q.get("code"),
      st = q.get("state");
    if (!code || !st) return false;
    let p = null;
    try {
      p = JSON.parse(sessionStorage.getItem(OR_PENDING) || "null");
    } catch (e) {
      p = null;
    }
    if (!p || p.state !== st) return false; // not ours
    sessionStorage.removeItem(OR_PENDING);
    history.replaceState(null, "", location.pathname);
    let res;
    try {
      res = await fetch(OR_BASE + "/api/v1/auth/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          code_verifier: p.verifier,
          code_challenge_method: "S256",
        }),
      });
    } catch (e) {
      throw new AIError("Could not reach OpenRouter to finish signing in.");
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.key)
      throw new AIError(
        (j.error && (j.error.message || j.error)) ||
          "OpenRouter did not give a key. Try signing in again.",
      );
    state.orKey = j.key;
    try {
      localStorage.setItem(OR_KEY, j.key);
    } catch (e) {
      /* storage blocked */
    }
    state.mode = "openrouter";
    persist();
    return true;
  }
  function orSignOut() {
    state.orKey = "";
    try {
      localStorage.removeItem(OR_KEY);
    } catch (e) {
      /* storage blocked */
    }
    if (state.mode === "openrouter") state.mode = HOSTED ? "key" : "signin";
    persist();
  }
  let orList = null;
  /** The models OpenRouter offers: those that can see pictures first (the director can then watch reference videos). */
  async function orModels() {
    if (orList) return orList;
    let j;
    try {
      j = await (await fetch(OR_BASE + "/api/v1/models")).json();
    } catch (e) {
      throw new AIError(
        "Could not load OpenRouter's model list. Check your connection.",
        { network: true },
      );
    }
    const first = [
      "anthropic",
      "openai",
      "google",
      "x-ai",
      "meta-llama",
      "mistralai",
      "deepseek",
      "qwen",
    ];
    const rows = (j.data || [])
      .filter((m) => m && m.id && !/:extended$/.test(m.id))
      .map((m) => {
        const mods = (m.architecture && m.architecture.input_modalities) || [];
        return {
          id: m.id,
          name: m.name || m.id,
          vision: mods.includes("image"),
          created: m.created || 0,
          vendor: m.id.split("/")[0],
        };
      })
      .filter((m) => first.includes(m.vendor))
      .sort(
        (a, b) =>
          first.indexOf(a.vendor) - first.indexOf(b.vendor) ||
          b.created - a.created,
      );
    return (orList = rows);
  }
  const pickDefaultModel = (rows) => {
    const a = rows.filter((m) => m.vendor === "anthropic" && m.vision);
    return (
      a.find((m) => /sonnet/i.test(m.id)) ||
      a[0] ||
      rows.find((m) => m.vision) ||
      rows[0] || { id: "" }
    ).id;
  };

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
  /** Watch a cartoon clip (a handful of frames) and describe it so scenes can be matched to it. */
  async function analyseClip({ frames, name, duration, settings, poses }) {
    const j = await askVision({
      json: true,
      max: 900,
      images: frames.map((f) => f.jpeg),
      system:
        "You describe cartoon video clips for a video editor. You reply with only a JSON object, no prose and no code fences.",
      user: `These ${frames.length} frames come from a cartoon clip called "${name}", ${Math.round(duration)} seconds long, in time order. Frame times in seconds: ${frames.map((f) => f.t).join(", ")}.
Describe it for an editor who will pick it as footage for a script.
- "setting": one of ${settings.join(" | ")}.
- "pose": what the characters mostly do, one of ${poses.join(" | ")}.
- "desc": one sentence: who is there, where, what the joke or situation is. No quotes of on-screen captions.
- "tags": 4 to 8 lowercase keywords an editor might search for (place, objects, mood, topic such as visa, documents, interview, refund).
- "mood": one word (funny, tense, calm, awkward…).
- "hasEndCard": true if the last frames are a logo or call-to-action card instead of the cartoon scene, else false.
- "endCardStart": if hasEndCard, the second where that card starts (use the frame times), else 0.
- "titleUntil": if a big title or caption is burnt into the top of the first frames, the second where it disappears (use the frame times), else 0.
Return {"setting":"...","pose":"...","desc":"...","tags":["..."],"mood":"...","hasEndCard":false,"endCardStart":0,"titleUntil":0}.`,
    });
    return {
      setting: settings.includes(j.setting) ? j.setting : "other",
      pose: poses.includes(j.pose) ? j.pose : "mixed",
      desc: String(j.desc || "").slice(0, 240),
      tags: arr(j.tags)
        .map((t) => String(t).toLowerCase().slice(0, 24))
        .slice(0, 8),
      mood: String(j.mood || "").slice(0, 20),
      trimStart:
        Number(j.titleUntil) > 0 && Number(j.titleUntil) < duration / 2
          ? Math.round(Number(j.titleUntil) * 10) / 10
          : 0,
      trimEnd:
        j.hasEndCard &&
        Number(j.endCardStart) > 1 &&
        Number(j.endCardStart) < duration
          ? Math.round((duration - Number(j.endCardStart)) * 10) / 10
          : 0,
    };
  }
  /** Choose which clip each scene should show, and where in the clip to start. */
  async function pickClips({ scenes, clips, title }) {
    const lib = clips
      .map(
        (c) =>
          `- id ${c.id}: "${c.name}" · setting ${c.setting} · characters ${c.pose} · ${Math.round(c.usable)} s usable · ${c.desc || "no description"} · tags ${(c.tags || []).join(", ")}`,
      )
      .join("\n");
    const j = await ask({
      json: true,
      max: 900 + scenes.length * 60,
      system: SYS,
      user: `You are the editor of a funny cartoon short titled "${title}". Pick the cartoon clip that should play behind each scene of the script. Match the place and situation the line talks about (beach, metro, street or bus stand, interview window, court, kitchen…). Use different clips for neighbouring scenes when the library allows it, but keep a joke's setup and punchline in the same clip. "start" is the second of the clip to start from (between 0 and its usable length minus 2).
CLIP LIBRARY:
${lib}
SCENES:
${scenes.map((t, i) => `${i}. ${t}`).join("\n")}
Return {"scenes":[{"clip":"<id>","start":0,"why":"..."}]} with exactly ${scenes.length} entries in order.`,
    });
    return (Array.isArray(j.scenes) ? j.scenes : []).map((x) => ({
      clip: String((x && x.clip) || ""),
      start: Math.max(0, Number(x && x.start) || 0),
      why: String((x && x.why) || "").slice(0, 120),
    }));
  }

  /** The director: reads the script, and optionally a reference video and the clip library, and sets the whole look.
   * `catalog` describes every effect so Claude can use all of them. */
  async function direct({
    title,
    blocks,
    themes,
    fx,
    catalog,
    presets,
    format,
    clips,
    frames,
    refNote,
  }) {
    const scenes = blocks
      .map((b, i) => `${i}. [${b.type}] ${b.text}`)
      .join("\n");
    const lib =
      clips && clips.length
        ? "CARTOON CLIPS the video can show behind the scenes:\n" +
          clips
            .map(
              (c) =>
                `- id ${c.id}: ${c.setting} · ${c.pose} · ${Math.round(c.usable)} s · ${c.desc || c.name} · ${(c.tags || []).join(", ")}`,
            )
            .join("\n") +
          "\n"
        : "";
    const body = `Direct the visuals for this short vertical video titled "${title}"${format ? ` (format: ${format})` : ""}.
You are the art director and motion designer. Choose a coherent look; do not pick randomly. Make the hook land hardest, keep the middle varied but consistent, and make the last scene feel like a call to action.
${frames && frames.length ? `A REFERENCE VIDEO is shown as ${frames.length} frames in time order${refNote ? " (" + refNote + ")" : ""}. Match its motion style: where the caption sits, how words are emphasised, what graphics move, how scenes change, the colours, light or dark. Describe what you matched in "styleNote".\n` : ""}${refNote && !(frames && frames.length) ? "STYLE NOTE FROM A REFERENCE VIDEO TO MATCH: " + refNote + "\n" : ""}
PER SCENE give: "motif" (an icon from ${catalog.motifs.join(", ")} or "none"), "emphasis" (1 to 3 words from that scene's text to mark), ${clips && clips.length ? `"clip" (a clip id from the library, matching the place the line talks about) and "start" (second to start from), ` : ""}and "why" (a few words).
OVERALL give: "theme" (one of ${themes.join(" | ")}), "pace" (Calm | Balanced | Punchy), "fx" using only these allowed values: ${JSON.stringify(fx)}, and "switches": the on/off effects to turn ON from ${catalog.switches.join(", ")} (the rest stay off).
Notes on the effects:
${catalog.notes}
${presets && presets.length ? "Ready-made presets (you may start from one, then adjust): " + presets.join(", ") + ".\n" : ""}${lib}SCENES:
${scenes}
Return {"scenes":[{"motif":"...","emphasis":["..."],"clip":"","start":0,"why":"..."}],"theme":"...","pace":"...","fx":{"caption":"...","transition":"...","camera":"...","particles":"...","layout":"...","mark":"...","annot":"...","orbit":"...","look":"..."},"switches":["..."],"styleNote":"one or two sentences on the look you chose and why"} with exactly ${blocks.length} scenes in order.`;
    const j =
      frames && frames.length
        ? await askVision({
            json: true,
            max: 2200,
            images: frames.map((f) => f.jpeg),
            system: SYS,
            user: body,
          })
        : await ask({ json: true, max: 2200, system: SYS, user: body });
    return {
      scenes: Array.isArray(j.scenes) ? j.scenes : [],
      theme: j.theme,
      pace: j.pace,
      fx: j.fx || {},
      switches: Array.isArray(j.switches) ? j.switches.map(String) : [],
      styleNote: String(j.styleNote || "").slice(0, 400),
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
      state.mode = m === "key" || m === "openrouter" ? m : "signin";
      persist();
    },
    orSignIn,
    orInit,
    orSignOut,
    orModels,
    pickDefaultModel,
    orModel: () => state.orModel,
    orConnected: () => !!state.orKey,
    setOrModel(id) {
      state.orModel = String(id || "").trim();
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
    analyseClip,
    pickClips,
    fromReference,
    reelToScript,
    test,
  };
})();
