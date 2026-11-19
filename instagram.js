/* Instagram professional accounts through Composio. Read-only.
 * Studio never holds an Instagram token. Composio holds the connection; a small proxy (worker.js when deployed,
 * bridge/server.py on your computer) keeps the Composio API key on the server and only runs four read-only Instagram tools.
 */
(() => {
  "use strict";
  const ACTIVE = "rs_ig_active",
    PASS = "rs_app_pass",
    SNAP = "rs_ig_snap_",
    DAY = 86400;

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
  const accounts = new Map();
  let activeId = null,
    setup = {
      configured: null,
      help: "",
      protected: false,
      needsPasscode: false,
    };
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
  const passcode = () => {
    try {
      return sessionStorage.getItem(PASS) || "";
    } catch (e) {
      return "";
    }
  };

  /* ---------- the proxy ---------- */
  async function api(path, body) {
    const headers = {},
      s = window.Helper ? await Helper.session() : { available: false };
    if (s.available) headers["X-Studio-Token"] = s.token;
    const pc = passcode();
    if (pc) headers["X-App-Passcode"] = pc;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res;
    try {
      res = await fetch(path, {
        method: body !== undefined ? "POST" : "GET",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (e) {
      throw new IGError("Could not reach the server. Check your connection.", {
        network: true,
      });
    }
    let j = null;
    try {
      j = await res.json();
    } catch (e) {
      /* not json */
    }
    if (res.status === 401 && j && j.needsPasscode) {
      setup.needsPasscode = true;
      throw new IGError(j.error || "Enter the passcode.", {
        needsPasscode: true,
      });
    }
    if (res.status === 404 && !j)
      throw new IGError(
        "Instagram through Composio needs the Worker (deployed) or the local helper (./bridge/start.sh).",
        { noProxy: true },
      );
    if (!res.ok || !j || j.error)
      throw new IGError((j && j.error) || `Server error ${res.status}.`, {
        http: res.status,
      });
    return j;
  }
  /** Run one read-only Instagram tool for an account and return the Graph API body. */
  async function run(a, tool, args) {
    const j = await api("/api/composio/execute", {
      tool,
      account: a.id,
      userId: a.userId || undefined,
      arguments: args,
    });
    return j.data || {};
  }

  /* ---------- API calls ---------- */
  async function fetchProfile(a) {
    const j = await run(a, "INSTAGRAM_GET_USER_INFO", {
      ig_user_id: "me",
      fields:
        "id,username,name,profile_picture_url,followers_count,follows_count,media_count",
    });
    return {
      username: j.username || a.alias || "",
      name: j.name || "",
      avatar: j.profile_picture_url || "",
      followers: j.followers_count || 0,
      follows: j.follows_count || 0,
      mediaCount: j.media_count || 0,
    };
  }
  /** Totals over a window for one or more account metrics → { metric: { value, parts } }. */
  async function totals(a, metrics, since, until, breakdown) {
    const base = {
      ig_user_id: "me",
      metric: metrics,
      period: "day",
      metric_type: "total_value",
      since,
      until,
    };
    let j;
    try {
      j = await run(
        a,
        "INSTAGRAM_GET_USER_INSIGHTS",
        breakdown ? Object.assign({ breakdown }, base) : base,
      );
    } catch (e) {
      if (!breakdown || e.network || e.needsPasscode) throw e;
      j = await run(a, "INSTAGRAM_GET_USER_INSIGHTS", base);
    }
    const out = {};
    (j.data || []).forEach((d) => {
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
  async function followerSeries(a, since, until) {
    const j = await run(a, "INSTAGRAM_GET_USER_INSIGHTS", {
      ig_user_id: "me",
      metric: ["follower_count"],
      period: "day",
      since,
      until,
    });
    return ((j.data && j.data[0] && j.data[0].values) || []).map((v) => ({
      date: v.end_time,
      delta: v.value || 0,
    }));
  }
  /** Posts with their lifetime insights in one call (Instagram nests them per post). */
  async function fetchMedia(a) {
    const j = await run(a, "INSTAGRAM_GET_IG_USER_MEDIA", {
      ig_user_id: "me",
      limit: 50,
      fields:
        "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count,insights.metric(views,reach,saved,shares,total_interactions)",
    });
    return j.data || [];
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
  /** Ask the server which Instagram accounts are connected in Composio. */
  async function sync() {
    let j;
    try {
      j = await api("/api/composio/status");
    } catch (e) {
      setup.configured = null;
      if (e.needsPasscode) setup.configured = true;
      throw e;
    }
    setup.configured = !!j.configured;
    setup.help = j.help || "";
    setup.protected = !!j.protected;
    setup.needsPasscode = false;
    const seen = new Set();
    (j.accounts || []).forEach((c) => {
      seen.add(c.id);
      const old = accounts.get(c.id);
      accounts.set(
        c.id,
        Object.assign(
          {
            profile: null,
            status: "idle",
            error: null,
            data: null,
            fetchedAt: 0,
          },
          old || {},
          { id: c.id, alias: c.alias, userId: c.userId },
        ),
      );
    });
    [...accounts.keys()].forEach((k) => {
      if (!seen.has(k)) accounts.delete(k);
    });
    if (!accounts.has(activeId))
      activeId = accounts.keys().next().value || null;
    saveActive();
    return list();
  }
  /** Start Composio's own hosted sign-in for Instagram. Returns the URL to open. */
  async function link() {
    const j = await api("/api/composio/link", {});
    return j.url;
  }
  function setPasscode(v) {
    try {
      if (v) sessionStorage.setItem(PASS, v);
      else sessionStorage.removeItem(PASS);
    } catch (e) {
      /* storage blocked */
    }
  }
  function forget(id) {
    const a = accounts.get(id);
    if (!a) return;
    try {
      localStorage.removeItem(SNAP + id);
    } catch (e) {
      /* storage blocked */
    }
    a.data = null;
    a.profile = null;
    a.status = "idle";
    a.fetchedAt = 0;
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
      const profile = await fetchProfile(a);
      a.profile = profile;
      a.username = profile.username || a.username;
      const safe = async (label, p) => {
        try {
          return await p;
        } catch (e) {
          if (e.network || e.needsPasscode) throw e;
          notes.push(`${label}: ${e.message}`);
          return null;
        }
      };
      const quiet = async (p) => {
        try {
          return await p;
        } catch (e) {
          if (e.network || e.needsPasscode) throw e;
          return null;
        }
      };
      const [views, other, fser, media, pViews, pOther] = await Promise.all([
        safe("Views", totals(a, ["views"], since, now, "follow_type")),
        safe("Reach", totals(a, ["reach", "total_interactions"], since, now)),
        safe("Followers", followerSeries(a, since, now)),
        safe("Media", fetchMedia(a)),
        quiet(totals(a, ["views"], since - days * DAY, since)),
        quiet(
          totals(a, ["reach", "total_interactions"], since - days * DAY, since),
        ),
      ]);
      const v = views && views.views,
        reach = other && other.reach,
        inter = other && other.total_interactions;
      const list2 = media || [];
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
        v && v.parts
          ? { followers: v.parts.FOLLOWER || 0, non: v.parts.NON_FOLLOWER || 0 }
          : null;
      a.data = {
        days,
        profile,
        notes,
        views: v ? v.value : null,
        reach: reach ? reach.value : null,
        interactions: inter ? inter.value : null,
        prev: {
          views: pViews && pViews.views ? pViews.views.value : null,
          reach: pOther && pOther.reach ? pOther.reach.value : null,
          interactions:
            pOther && pOther.total_interactions
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
    sync,
    link,
    forget,
    refresh,
    findByUrl,
    setPasscode,
    setup: () => setup,
    connected: () => accounts.size > 0,
    IGError,
  };
})();
