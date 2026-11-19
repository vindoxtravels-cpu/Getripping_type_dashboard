/* Talks to the local helper (bridge/server.py), which runs on your computer.
 *  - Opened from the helper itself (http://localhost:5174): same origin, the helper hands the page a token.
 *  - Opened from a deployed site: the page reaches the helper at http://127.0.0.1:5174 and pairs with it using the
 *    code the helper prints in its terminal (start it with ./bridge/start.sh --allow https://your-site).
 */
(() => {
  "use strict";
  const LOCAL_PAGE = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
    location.hostname,
  );
  const BASE = LOCAL_PAGE ? "" : "http://127.0.0.1:5174";
  const TOKEN_KEY = "rs_helper_token";
  class HelperError extends Error {
    constructor(m, info) {
      super(m);
      this.name = "HelperError";
      Object.assign(this, info || {});
    }
  }
  let sess = null,
    probing = null;
  const stored = () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  };
  const store = (t) => {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* storage blocked */
    }
  };

  /** { available, reachable, paired, token, ...flags }. "available" means ready to use (has a token). */
  async function session(force) {
    if (sess && !force) return sess;
    if (probing) return probing;
    probing = (async () => {
      try {
        const r = await fetch(BASE + "/api/session", { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (!j) sess = { available: false, reachable: false, paired: false };
        else if (j.token)
          sess = Object.assign(
            { available: true, reachable: true, paired: true },
            j,
          );
        else {
          const t = stored();
          sess = Object.assign({}, j, {
            reachable: true,
            paired: !!t,
            available: !!t,
            token: t,
          });
        }
      } catch (e) {
        sess = { available: false, reachable: false, paired: false };
      }
      probing = null;
      return sess;
    })();
    return probing;
  }
  /** Hosted site: open the helper's own "Allow this site?" page and wait for it to hand back a token. */
  function connect() {
    return new Promise((resolve, reject) => {
      const win = window.open(
        BASE + "/authorize?origin=" + encodeURIComponent(location.origin),
        "studio-helper",
        "width=520,height=560",
      );
      if (!win) {
        reject(
          new HelperError(
            "The pop-up was blocked. Allow pop-ups for this site and try again.",
            {
              popup: true,
            },
          ),
        );
        return;
      }
      let done = false;
      const finish = (fn, v) => {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMsg);
        clearInterval(timer);
        fn(v);
      };
      const onMsg = (e) => {
        if (
          e.origin !== BASE ||
          !e.data ||
          e.data.type !== "studio-helper-token" ||
          !e.data.token
        )
          return;
        store(e.data.token);
        session(true).then((s) => finish(resolve, s));
      };
      window.addEventListener("message", onMsg);
      const t0 = Date.now();
      const timer = setInterval(() => {
        if (win.closed && Date.now() - t0 > 1500)
          finish(
            reject,
            new HelperError(
              "The window was closed before the site was allowed. If it showed an error page, the helper isn't running: on your computer run ./bridge/start.sh",
              { offline: true },
            ),
          );
        else if (Date.now() - t0 > 120000)
          finish(reject, new HelperError("That took too long. Try again."));
      }, 500);
    });
  }
  /** Pair this deployed site with the helper using the code shown in the helper's terminal. */
  async function pair(code) {
    let r;
    try {
      r = await fetch(BASE + "/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
    } catch (e) {
      throw new HelperError(
        "Could not reach the helper on your computer. Is it running, with --allow for this site?",
        { offline: true },
      );
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token)
      throw new HelperError(j.error || "Pairing failed.", { status: r.status });
    store(j.token);
    return session(true);
  }
  function unpair() {
    store("");
    sess = null;
  }
  async function request(path, init, expect) {
    const s = await session();
    if (!s.available)
      throw new HelperError(
        LOCAL_PAGE
          ? "The helper is not running. In the project folder run ./bridge/start.sh and open the app from http://localhost:5174."
          : s.reachable
            ? "Pair this site with the helper first (use the code shown in the helper's terminal)."
            : "The helper isn't reachable. On your computer run ./bridge/start.sh --allow " +
              location.origin,
        { offline: true },
      );
    init.headers = Object.assign({ "X-Studio-Token": s.token }, init.headers);
    let r;
    try {
      r = await fetch(BASE + path, init);
    } catch (e) {
      sess = null;
      throw new HelperError(
        "Lost the connection to the helper. Is it still running?",
        { offline: true },
      );
    }
    if (!r.ok) {
      let msg = "Helper error " + r.status;
      try {
        msg = (await r.json()).error || msg;
      } catch (e) {
        /* not json */
      }
      if (r.status === 401) {
        if (!LOCAL_PAGE) store(""); // the helper restarted: pair again
        sess = null; // fetch a new token next time
      }
      throw new HelperError(msg, { status: r.status });
    }
    return expect === "bytes" ? r.arrayBuffer() : r.json();
  }
  const call = (path, o = {}) =>
    request(
      path,
      {
        method: o.method || "GET",
        headers:
          o.body !== undefined ? { "content-type": "application/json" } : {},
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      },
      o.expect,
    );
  /** Send a file (such as a video) as the raw request body. */
  const upload = (path, blob) =>
    request(path, {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    });

  window.Helper = {
    session,
    call,
    upload,
    pair,
    connect,
    unpair,
    HelperError,
    base: BASE,
    hosted: !LOCAL_PAGE,
    info: () => sess,
    available: async () => (await session()).available,
  };
})();
