/* Instagram professional accounts through Composio, signed in the same way you sign in to Claude: no API key.
 * "Sign in with Composio" is Composio's own OAuth 2.1 sign-in (PKCE, public client, dynamic registration). The
 * browser then talks to Composio's MCP server (connect.composio.dev/mcp) with your access token, and Composio runs
 * read-only Instagram tools for the Instagram account you connected there. Nothing passes through any server of ours.
 */
(() => {
  "use strict";
  const ACTIVE = "rs_ig_active",
    TOKEN = "rs_composio",
    CLIENT = "rs_composio_client",
    PENDING = "rs_composio_pending",
    SNAP = "rs_ig_snap_",
    DAY = 86400;
  const ISSUER = "https://connect.composio.dev";
  const MCP = "https://connect.composio.dev/mcp";
  const SCOPE = "openid profile email offline_access";
  /* The only tools this page will ever ask Composio to run. All read-only. */
  const READ_ONLY = new Set([
    "INSTAGRAM_GET_USER_INFO",
    "INSTAGRAM_GET_IG_USER_MEDIA",
    "INSTAGRAM_GET_USER_INSIGHTS",
    "INSTAGRAM_GET_IG_MEDIA_INSIGHTS",
  ]);

  class IGError extends Error {
    constructor(m, info) {
      super(m);
      this.name = "IGError";
      Object.assign(this, info || {});
    }
  }

  /* ---------- storage ---------- */
  const jget = (store, key) => {
    try {
      const s = store.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  };
  const jset = (store, key, v) => {
    try {
      store.setItem(key, JSON.stringify(v));
    } catch (e) {
      /* storage blocked */
    }
  };
  const jdel = (store, key) => {
    try {
      store.removeItem(key);
    } catch (e) {
      /* storage blocked */
    }
  };
  const accounts = new Map();
  let activeId = null,
    mcpSession = null,
    tokens = jget(localStorage, TOKEN),
    setup = { signedIn: !!tokens, connected: null, note: "" };
  try {
    activeId = localStorage.getItem(ACTIVE);
  } catch (e) {
    /* storage blocked */
  }
  const saveActive = () => {
    try {
      if (activeId) localStorage.setItem(ACTIVE, activeId);
      else localStorage.removeItem(ACTIVE);
    } catch (e) {
      /* storage blocked */
    }
  };

  /* ---------- sign in with Composio (OAuth 2.1 + PKCE) ---------- */
  const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const redirectUri = () => location.origin + "/";
  let meta = null;
  async function metadata() {
    if (meta) return meta;
    const r = await fetch(ISSUER + "/.well-known/oauth-authorization-server");
    if (!r.ok) throw new IGError("Could not reach Composio's sign-in.");
    return (meta = await r.json());
  }
  /** Composio's sign-in server doesn't let browsers read its replies, so these two calls go through this site's own
   * relay (worker.js when deployed, the helper on your computer). The relay holds no secret. */
  async function relay(kind, contentType, body) {
    const headers = { "content-type": contentType };
    try {
      const h = window.Helper ? await window.Helper.session() : null;
      if (h && h.available) headers["X-Studio-Token"] = h.token;
    } catch (e) {
      /* no helper */
    }
    try {
      return await fetch("/api/oauth/" + kind, {
        method: "POST",
        headers,
        body,
      });
    } catch (e) {
      throw new IGError(
        "Could not reach the sign-in relay. Check your connection.",
      );
    }
  }
  async function registerClient(m) {
    const key = CLIENT + ":" + redirectUri(),
      have = jget(localStorage, key);
    if (have && have.client_id) return have.client_id;
    const r = await relay(
      "register",
      "application/json",
      JSON.stringify({
        client_name: "Reel Studio",
        redirect_uris: [redirectUri()],
      }),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.client_id)
      throw new IGError("Composio did not accept this app's sign-in request.");
    jset(localStorage, key, { client_id: j.client_id });
    return j.client_id;
  }
  /** Sends the browser to Composio's sign-in page. Comes back to this page with ?code=…, which init() finishes. */
  async function signIn() {
    const m = await metadata(),
      client = await registerClient(m),
      verifier = rand(48),
      state = rand(16);
    const challenge = b64url(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    );
    jset(sessionStorage, PENDING, { verifier, state, client });
    const u = new URL(m.authorization_endpoint);
    Object.entries({
      response_type: "code",
      client_id: client,
      redirect_uri: redirectUri(),
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: MCP,
    }).forEach(([k, v]) => u.searchParams.set(k, v));
    location.assign(u.toString());
  }
  async function tokenRequest(params) {
    const r = await relay(
      "token",
      "application/x-www-form-urlencoded",
      new URLSearchParams(params).toString(),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token)
      throw new IGError(j.error_description || "Composio sign-in failed.", {
        needsLogin: true,
      });
    return j;
  }
  function keep(j, client) {
    tokens = {
      access: j.access_token,
      refresh: j.refresh_token || (tokens && tokens.refresh) || "",
      exp: Date.now() + (j.expires_in || 3600) * 1000 - 30000,
      client,
    };
    jset(localStorage, TOKEN, tokens);
    setup.signedIn = true;
  }
  /** Finishes a sign-in when the page was opened by Composio's redirect. Returns true if it handled one. */
  async function init() {
    const q = new URLSearchParams(location.search);
    const code = q.get("code"),
      state = q.get("state");
    if (!code || !state) return false;
    const p = jget(sessionStorage, PENDING);
    if (!p || p.state !== state) return false; // not ours
    jdel(sessionStorage, PENDING);
    history.replaceState(null, "", location.pathname);
    keep(
      await tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
        client_id: p.client,
        code_verifier: p.verifier,
      }),
      p.client,
    );
    return true;
  }
  async function freshToken() {
    if (!tokens)
      throw new IGError("Sign in with Composio first.", { needsLogin: true });
    if (Date.now() < tokens.exp) return tokens.access;
    if (!tokens.refresh) throw signedOut();
    try {
      keep(
        await tokenRequest({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh,
          client_id: tokens.client,
        }),
        tokens.client,
      );
    } catch (e) {
      throw signedOut();
    }
    return tokens.access;
  }
  function signedOut() {
    tokens = null;
    mcpSession = null;
    jdel(localStorage, TOKEN);
    setup.signedIn = false;
    return new IGError("Your Composio sign-in expired. Sign in again.", {
      needsLogin: true,
    });
  }
  function signOut() {
    tokens = null;
    mcpSession = null;
    jdel(localStorage, TOKEN);
    accounts.clear();
    setup.signedIn = false;
    setup.connected = null;
  }

  /* ---------- Composio's MCP server (JSON-RPC over HTTP) ---------- */
  let rpcId = 0;
  async function post(body, withSession) {
    const doFetch = async () => {
      const headers = {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer " + (await freshToken()),
        "mcp-protocol-version": "2025-06-18",
      };
      if (withSession && mcpSession && mcpSession !== "stateless")
        headers["mcp-session-id"] = mcpSession;
      return fetch(MCP, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    };
    let res;
    try {
      res = await doFetch();
      if (res.status === 401) {
        if (tokens) tokens.exp = 0; // force a refresh, then try once more
        res = await doFetch();
      }
    } catch (e) {
      if (e instanceof IGError) throw e;
      throw new IGError("Could not reach Composio. Check your connection.", {
        network: true,
      });
    }
    if (res.status === 401) throw signedOut();
    return res;
  }
  /** Reads either a plain JSON reply or a server-sent-events stream and returns the JSON-RPC message with this id. */
  async function readRpc(res, id) {
    const text = await res.text();
    const type = res.headers.get("content-type") || "";
    let msgs = [];
    if (type.includes("text/event-stream")) {
      text.split(/\r?\n\r?\n/).forEach((chunk) => {
        const data = chunk
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (data) {
          try {
            msgs.push(JSON.parse(data));
          } catch (e) {
            /* not json */
          }
        }
      });
    } else {
      try {
        const j = JSON.parse(text);
        msgs = Array.isArray(j) ? j : [j];
      } catch (e) {
        /* not json */
      }
    }
    const msg = msgs.find((m) => m && m.id === id) || msgs[0];
    if (!msg)
      throw new IGError(`Unexpected reply from Composio (HTTP ${res.status}).`);
    if (msg.error)
      throw new IGError(msg.error.message || "Composio returned an error.");
    return msg.result;
  }
  async function openSession() {
    if (mcpSession) return;
    const id = ++rpcId;
    const res = await post(
      {
        jsonrpc: "2.0",
        id,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "Reel Studio", version: "1.0" },
        },
      },
      false,
    );
    if (!res.ok) throw new IGError(`Composio answered ${res.status}.`);
    await readRpc(res, id);
    mcpSession = res.headers.get("mcp-session-id") || "stateless";
    const note = await post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      true,
    );
    if (note.body) await note.text().catch(() => {});
  }
  /** Calls one Composio tool and returns what it printed, parsed from JSON. */
  async function callTool(name, args) {
    await openSession();
    const id = ++rpcId;
    let res = await post(
      {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      },
      true,
    );
    if (res.status === 404 || res.status === 400) {
      mcpSession = null; // the session went away: start a new one and retry once
      await openSession();
      res = await post(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        },
        true,
      );
    }
    const result = await readRpc(res, id);
    const text = ((result && result.content) || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    let out = null;
    try {
      out = JSON.parse(text);
    } catch (e) {
      /* plain text */
    }
    if (result && result.isError)
      throw new IGError(
        (out && out.error) || text || "Composio could not do that.",
      );
    return out || { raw: text };
  }
  /** Runs several read-only Instagram tools in one request. Resolves [{ ok, data, error }] in the same order. */
  async function runMany(calls) {
    calls.forEach((c) => {
      if (!READ_ONLY.has(c.tool))
        throw new IGError("That tool is not allowed: " + c.tool);
    });
    const out = await callTool("COMPOSIO_MULTI_EXECUTE_TOOL", {
      tools: calls.map((c) => ({ tool_slug: c.tool, arguments: c.args })),
      sync_response_to_workbench: false,
      memory: {},
      thought: "Read Instagram insights for the dashboard",
    });
    const body = out.data || out,
      results = body.results || [];
    if (out.successful === false && !results.length)
      throw new IGError(errText(out.error) || "Composio could not run that.");
    return calls.map((_, i) => {
      const r =
        (results.find((x) => x.index === i) || results[i] || {}).response || {};
      return {
        ok: r.successful !== false && !r.error,
        data: r.data || {},
        error: errText(r.error),
      };
    });
  }
  const errText = (e) =>
    !e ? "" : typeof e === "string" ? e : e.message || JSON.stringify(e);

  /* ---------- Instagram calls ---------- */
  const spec = {
    profile: () => ({
      tool: "INSTAGRAM_GET_USER_INFO",
      args: {
        ig_user_id: "me",
        fields:
          "id,username,name,profile_picture_url,followers_count,follows_count,media_count",
      },
    }),
    totals: (metrics, since, until, breakdown) => ({
      tool: "INSTAGRAM_GET_USER_INSIGHTS",
      args: Object.assign(
        {
          ig_user_id: "me",
          metric: metrics,
          period: "day",
          metric_type: "total_value",
          since,
          until,
        },
        breakdown ? { breakdown } : {},
      ),
    }),
    followers: (since, until) => ({
      tool: "INSTAGRAM_GET_USER_INSIGHTS",
      args: {
        ig_user_id: "me",
        metric: ["follower_count"],
        period: "day",
        since,
        until,
      },
    }),
    media: () => ({
      tool: "INSTAGRAM_GET_IG_USER_MEDIA",
      args: {
        ig_user_id: "me",
        limit: 50,
        fields:
          "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count,insights.metric(views,reach,saved,shares,total_interactions)",
      },
    }),
  };
  function parseTotals(data) {
    const out = {};
    ((data && data.data) || []).forEach((d) => {
      const tv = d.total_value;
      if (!tv) return;
      const parts = {};
      (
        (tv.breakdowns && tv.breakdowns[0] && tv.breakdowns[0].results) ||
        []
      ).forEach((r) => {
        parts[String((r.dimension_values || [])[0]).toUpperCase()] = r.value;
      });
      out[d.name] = { value: tv.value || 0, parts };
    });
    return out;
  }
  const insightsOf = (m) => {
    const out = {};
    ((m.insights && m.insights.data) || []).forEach((d) => {
      out[d.name] = d.values && d.values[0] ? d.values[0].value : undefined;
    });
    return out;
  };

  /* ---------- shaping ---------- */
  const dayKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function buildHeat(media) {
    const counts = {};
    media.forEach((m) => {
      const k = dayKey(new Date(m.timestamp));
      counts[k] = (counts[k] || 0) + 1;
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - 28);
    const cells = [];
    let daysWith = 0,
      daysTotal = 0;
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > today) {
        cells.push(null);
        continue;
      }
      const n = counts[dayKey(d)] || 0;
      cells.push(n);
      daysTotal++;
      if (n) daysWith++;
    }
    let streak = 0;
    const d = new Date(today);
    if (!counts[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (counts[dayKey(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return { cells, daysWith, daysTotal, streak };
  }
  function shape(m, x, acct) {
    x = x || {};
    const caption = m.caption || "";
    return {
      id: m.id,
      acct,
      caption,
      title: (caption.split("\n")[0] || "Untitled").slice(0, 90),
      thumb: m.thumbnail_url || m.media_url || "",
      mediaUrl: m.media_url || "",
      permalink: m.permalink || "",
      ts: m.timestamp,
      type:
        m.media_product_type === "REELS"
          ? "reel"
          : m.media_type === "CAROUSEL_ALBUM"
            ? "carousel"
            : m.media_type === "VIDEO"
              ? "video"
              : "post",
      views: x.views || 0,
      reach: x.reach || 0,
      likes: x.likes != null ? x.likes : m.like_count || 0,
      comments: x.comments != null ? x.comments : m.comments_count || 0,
      shares: x.shares || 0,
      saves: x.saved || 0,
      interactions: x.total_interactions || 0,
      avgWatch: x.ig_reels_avg_watch_time
        ? x.ig_reels_avg_watch_time / 1000
        : 0,
    };
  }
  function snapshots(a, followers) {
    const key = SNAP + a.id,
      s = jget(localStorage, key) || {};
    if (followers) s[dayKey(new Date())] = followers;
    const keys = Object.keys(s).sort().slice(-400),
      out = {};
    keys.forEach((k) => {
      out[k] = s[k];
    });
    jset(localStorage, key, out);
    return keys.map((k) => ({ date: k, followers: out[k] }));
  }

  /* ---------- public: accounts ---------- */
  const view = (a) => ({
    id: a.id,
    username: a.username || a.alias || a.id,
    avatar: (a.profile && a.profile.avatar) || "",
    followers: a.profile ? a.profile.followers : 0,
    status: a.status,
    error: a.error,
    hasData: !!a.data,
    fetchedAt: a.fetchedAt,
  });
  const list = () => [...accounts.values()].map(view);
  const get = (id) => accounts.get(id) || null;
  const active = () => accounts.get(activeId) || null;
  function setActive(id) {
    if (accounts.has(id)) {
      activeId = id;
      saveActive();
    }
  }
  /** Ask Composio which Instagram account is connected to you. */
  async function sync() {
    if (!tokens) {
      setup.signedIn = false;
      throw new IGError("Sign in with Composio first.", { needsLogin: true });
    }
    const out = await callTool("COMPOSIO_SEARCH_TOOLS", {
      queries: [{ use_case: "Read Instagram account insights and media" }],
      session: { generate_id: true },
    });
    const body = out.data || out,
      st = (body.toolkit_connection_statuses || []).find(
        (t) => String(t.toolkit).toLowerCase() === "instagram",
      );
    setup.signedIn = true;
    const found = ((st && st.accounts) || []).filter(
      (a) => !a.status || a.status === "ACTIVE",
    );
    /* Composio's tools act on your default Instagram account, so that is the one shown */
    const a = found.find((x) => x.is_default) || found[0];
    accounts.clear();
    if (a)
      accounts.set(a.id, {
        id: a.id,
        alias: a.alias || "",
        username: (a.user_info && a.user_info.username) || a.alias || "",
        profile: null,
        status: "idle",
        error: null,
        data: null,
        fetchedAt: 0,
      });
    setup.connected = !!a;
    setup.note =
      found.length > 1
        ? "Composio uses your default Instagram account. Change the default in Composio to switch."
        : "";
    if (!accounts.has(activeId))
      activeId = accounts.keys().next().value || null;
    saveActive();
    return list();
  }
  /** A link that connects Instagram to your Composio account (Instagram's own sign-in). */
  async function link() {
    const out = await callTool("COMPOSIO_MANAGE_CONNECTIONS", {
      toolkits: ["instagram"],
    });
    const url = findUrl(out);
    if (!url)
      throw new IGError(
        "Instagram is already connected, or Composio gave no link. Press Check again.",
      );
    return url;
  }
  function findUrl(o, depth = 0) {
    if (!o || depth > 6) return "";
    if (typeof o === "string")
      return /^https:\/\/[^\s]+$/.test(o) &&
        /composio|instagram|facebook/.test(o)
        ? o
        : "";
    if (typeof o !== "object") return "";
    if (typeof o.redirect_url === "string") return o.redirect_url;
    for (const v of Object.values(o)) {
      const f = findUrl(v, depth + 1);
      if (f) return f;
    }
    return "";
  }

  /** Step-by-step connection check, so a failure says exactly where it stopped. Resolves [{ label, ok, detail }]. */
  async function diagnose() {
    const out = [];
    const step = async (label, fn) => {
      try {
        out.push({ label, ok: true, detail: (await fn()) || "" });
        return true;
      } catch (e) {
        out.push({ label, ok: false, detail: e.message || String(e) });
        return false;
      }
    };
    if (
      !(await step("Reach Composio's sign-in", async () => {
        await metadata();
      }))
    )
      return out;
    if (
      !(await step("Signed in with Composio", async () => {
        if (!tokens) throw new IGError("Not signed in yet.");
        await freshToken();
        return "token valid";
      }))
    )
      return out;
    if (
      !(await step("Open a Composio session", async () => {
        await openSession();
        return mcpSession === "stateless" ? "stateless" : "session started";
      }))
    )
      return out;
    let a = null;
    if (
      !(await step("Find your Instagram account", async () => {
        await sync();
        a = active();
        if (!a)
          throw new IGError(
            "Composio has no active Instagram account for you. Press Connect Instagram.",
          );
        return "@" + (a.username || a.alias || a.id);
      }))
    )
      return out;
    await step("Read the Instagram profile", async () => {
      const [r] = await runMany([spec.profile()]);
      if (!r.ok) throw new IGError(r.error || "Instagram refused the request.");
      return `${r.data.username || "?"} · ${r.data.followers_count || 0} followers`;
    });
    return out;
  }

  /* ---------- public: data ---------- */
  async function refresh(id, days) {
    const a = accounts.get(id);
    if (!a) throw new IGError("Account not found.");
    days = Math.min(30, Math.max(1, days || 30)); // Instagram limits these insight windows to 30 days
    a.status = "loading";
    a.error = null;
    try {
      const now = Math.floor(Date.now() / 1000),
        since = now - days * DAY,
        notes = [];
      const res = await runMany([
        spec.profile(),
        spec.totals(["views"], since, now, "follow_type"),
        spec.totals(["reach", "total_interactions"], since, now),
        spec.followers(since, now),
        spec.media(),
        spec.totals(["views"], since - days * DAY, since),
        spec.totals(["reach", "total_interactions"], since - days * DAY, since),
      ]);
      const [rProfile, rViews, rOther, rFol, rMedia, rpViews, rpOther] = res;
      if (!rProfile.ok)
        throw new IGError(
          rProfile.error ||
            "Could not read the Instagram profile. Is the account a Business or Creator account?",
        );
      const note = (label, r) => {
        if (!r.ok) notes.push(`${label}: ${r.error || "unavailable"}`);
      };
      note("Views", rViews);
      note("Reach", rOther);
      note("Followers", rFol);
      note("Media", rMedia);
      const pd = rProfile.data;
      const profile = {
        username: pd.username || a.alias || "",
        name: pd.name || "",
        avatar: pd.profile_picture_url || "",
        followers: pd.followers_count || 0,
        follows: pd.follows_count || 0,
        mediaCount: pd.media_count || 0,
      };
      a.profile = profile;
      a.username = profile.username || a.username;
      const views = rViews.ok ? parseTotals(rViews.data).views : null,
        other = rOther.ok ? parseTotals(rOther.data) : {},
        reach = other.reach,
        inter = other.total_interactions,
        pViews = rpViews.ok ? parseTotals(rpViews.data).views : null,
        pOther = rpOther.ok ? parseTotals(rpOther.data) : {};
      const fser = rFol.ok
        ? (
            (rFol.data.data && rFol.data.data[0] && rFol.data.data[0].values) ||
            []
          ).map((v) => ({ date: v.end_time, delta: v.value || 0 }))
        : null;
      const list2 = rMedia.ok ? rMedia.data.data || [] : [];
      const reelsRaw = list2
        .filter(
          (m) => m.media_product_type === "REELS" || m.media_type === "VIDEO",
        )
        .slice(0, 24);
      const carRaw = list2
        .filter((m) => m.media_type === "CAROUSEL_ALBUM")
        .slice(0, 12);
      const reels = reelsRaw
        .map((m) => shape(m, insightsOf(m), a.id))
        .sort((x, y) => y.views - x.views);
      const carousels = carRaw
        .map((m) => shape(m, insightsOf(m), a.id))
        .sort((x, y) => (y.reach || y.likes) - (x.reach || x.likes));
      const sorted = reels
          .map((r) => r.views)
          .filter(Boolean)
          .sort((x, y) => x - y),
        med = sorted.length ? sorted[sorted.length >> 1] : 0;
      reels.forEach((r) => {
        r.mult = med && r.views ? Math.round((r.views / med) * 10) / 10 : 0;
      });
      let series = null,
        gain = 0;
      if (fser && fser.length) {
        gain = fser.reduce((s2, x) => s2 + x.delta, 0);
        let running = profile.followers;
        const back = [];
        for (let i = fser.length - 1; i >= 0; i--) {
          back.unshift(running);
          running -= fser[i].delta;
        }
        series = back;
      }
      const aud =
        views && views.parts
          ? {
              followers: views.parts.FOLLOWER || 0,
              non: views.parts.NON_FOLLOWER || 0,
            }
          : null;
      a.data = {
        days,
        profile,
        notes,
        views: views ? views.value : null,
        reach: reach ? reach.value : null,
        interactions: inter ? inter.value : null,
        prev: {
          views: pViews ? pViews.value : null,
          reach: pOther.reach ? pOther.reach.value : null,
          interactions: pOther.total_interactions
            ? pOther.total_interactions.value
            : null,
        },
        newFollowers: fser && fser.length ? gain : null,
        series,
        audience: aud && aud.followers + aud.non ? aud : null,
        heat: buildHeat(list2),
        reels,
        carousels,
        media: list2.map((m) => shape(m, insightsOf(m), a.id)),
        snapshots: snapshots(a, profile.followers),
      };
      a.status = "ok";
      a.fetchedAt = Date.now();
      return a.data;
    } catch (e) {
      a.status = "error";
      a.error = e.message || String(e);
      a.data = null;
      throw e;
    }
  }
  /** Find one of your own posts from a pasted link. */
  function findByUrl(id, url) {
    const a = accounts.get(id),
      m = String(url).match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (!a || !a.data || !m) return null;
    const all = [...a.data.reels, ...a.data.carousels, ...a.data.media];
    return (
      all.find((r) => r.permalink && r.permalink.includes("/" + m[1] + "/")) ||
      null
    );
  }

  window.IG = {
    list,
    get,
    active,
    activeId: () => activeId,
    setActive,
    init,
    signIn,
    signOut,
    sync,
    diagnose,
    link,
    refresh,
    findByUrl,
    setup: () => setup,
    connected: () => accounts.size > 0,
    IGError,
  };
})();
