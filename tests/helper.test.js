/* Checks how a deployed site pairs with the local helper (stand-in helper).  Run: node tests/helper.test.js */
let failed = 0;
const check = (n, ok, d = "") => {
  console.log((ok ? "ok   " : "FAIL ") + n + (ok ? "" : "  " + d));
  if (!ok) failed++;
};
const store = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
global.window = {};
global.sessionStorage = store();
global.location = {
  hostname: "studio.workers.dev",
  origin: "https://studio.workers.dev",
};
let up = false,
  badToken = false;
const seen = [];
global.fetch = async (url, init = {}) => {
  seen.push({ url, init });
  if (!up) throw new TypeError("Failed to fetch");
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (url.endsWith("/api/session"))
    return j({
      edge: true,
      claudeInstalled: true,
      ffmpeg: true,
      paired: false,
    });
  if (url.endsWith("/api/pair"))
    return JSON.parse(init.body).code === "AAAABBBB"
      ? j({ token: "T1" })
      : j({ error: "That code is not right." }, 403);
  if (init.headers && init.headers["X-Studio-Token"] === "T1" && !badToken)
    return j({ installed: true, loggedIn: true });
  return j({ error: "Missing or wrong helper token." }, 401);
};
require("../helper.js");
const H = window.Helper;

(async () => {
  check(
    "a deployed site talks to the helper on this computer",
    H.base === "http://127.0.0.1:5174" && H.hosted === true,
  );
  let s = await H.session(true);
  check(
    "helper not running: not reachable, not available",
    s.reachable === false && s.available === false,
  );
  let err;
  try {
    await H.call("/api/claude/status");
  } catch (e) {
    err = e;
  }
  check(
    "the error says how to start it for this site",
    err && /--allow https:\/\/studio\.workers\.dev/.test(err.message),
    err && err.message,
  );

  up = true;
  s = await H.session(true);
  check(
    "helper running but not paired: reachable, no token",
    s.reachable && !s.available && !s.paired && !s.token,
  );
  try {
    await H.call("/api/claude/status");
    err = null;
  } catch (e) {
    err = e;
  }
  check(
    "calls before pairing are refused with a clear message",
    err && /Pair this site/.test(err.message),
  );
  try {
    await H.pair("WRONG");
    err = null;
  } catch (e) {
    err = e;
  }
  check("a wrong code is reported", err && /not right/.test(err.message));
  s = await H.pair("AAAABBBB");
  check(
    "the right code pairs: available with a token",
    s.available && s.paired && s.token === "T1",
  );
  const r = await H.call("/api/claude/status");
  const last = seen.at(-1);
  check(
    "calls go to the helper with the token",
    r.loggedIn === true &&
      last.url === "http://127.0.0.1:5174/api/claude/status" &&
      last.init.headers["X-Studio-Token"] === "T1",
  );
  check(
    "the token is kept for this browser session only",
    sessionStorage.getItem("rs_helper_token") === "T1",
  );

  H.unpair();
  s = await H.session(true);
  check(
    "unpairing forgets the token",
    !s.available && sessionStorage.getItem("rs_helper_token") === null,
  );

  await H.pair("AAAABBBB");
  badToken = true; // the helper restarted: the old token no longer works
  try {
    await H.call("/api/claude/status");
    err = null;
  } catch (e) {
    err = e;
  }
  check(
    "a restarted helper means pairing again",
    err &&
      err.status === 401 &&
      sessionStorage.getItem("rs_helper_token") === null,
  );

  /* one-click connect: the helper's own page hands the token back */
  H.unpair();
  const listeners = [];
  window.addEventListener = (t, f) => listeners.push([t, f]);
  window.removeEventListener = (t, f) => {
    const i = listeners.findIndex((l) => l[1] === f);
    if (i >= 0) listeners.splice(i, 1);
  };
  let opened = "";
  window.open = (url) => ((opened = url), { closed: false });
  badToken = false;
  const pending = H.connect();
  check(
    "connect opens the helper's allow page for this site",
    opened ===
      "http://127.0.0.1:5174/authorize?origin=" +
        encodeURIComponent("https://studio.workers.dev"),
    opened,
  );
  const fire = (origin, data) =>
    listeners
      .filter((l) => l[0] === "message")
      .forEach(([, f]) => f({ origin, data }));
  fire("https://evil.example", {
    type: "studio-helper-token",
    token: "STOLEN",
  });
  fire("http://127.0.0.1:5174", { type: "other", token: "X" });
  check(
    "messages from other sites or of other kinds are ignored",
    sessionStorage.getItem("rs_helper_token") === null,
  );
  fire("http://127.0.0.1:5174", { type: "studio-helper-token", token: "T1" });
  const cs = await pending;
  check(
    "the token from the helper's page connects the site",
    cs.available &&
      cs.paired &&
      sessionStorage.getItem("rs_helper_token") === "T1",
  );
  check(
    "the listener is removed afterwards",
    listeners.filter((l) => l[0] === "message").length === 0,
  );
  window.open = () => null;
  let blocked = null;
  try {
    await H.connect();
  } catch (e) {
    blocked = e;
  }
  check("a blocked pop-up is explained", blocked && blocked.popup === true);

  console.log(failed ? `\n${failed} failed` : "\nall pairing checks passed");
  process.exit(failed ? 1 : 0);
})();
