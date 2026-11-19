/* Checks the Composio sign-in and Instagram client against a stand-in for Composio.  Run: node tests/instagram.test.js */
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
global.localStorage = store();
global.sessionStorage = store();
let assigned = "";
global.location = {
  origin: "https://studio.example",
  pathname: "/",
  search: "",
  assign: (u) => (assigned = u),
};
global.history = { replaceState: () => {} };

const calls = [];
let replyMode = "text",
  tokenOk = true,
  sseMode = true,
  expireAccess = false,
  tokenIssued = 0;
const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const mk = (n, v) => ({ name: n, period: "lifetime", values: [{ value: v }] });
const media = [
  {
    id: "1",
    caption: "Hook one",
    media_type: "VIDEO",
    media_product_type: "REELS",
    permalink: "https://www.instagram.com/reel/AAAAAA1/",
    timestamp: "2026-11-17T05:52:00+0000",
    like_count: 4,
    comments_count: 1,
    insights: {
      data: [
        mk("views", 120),
        mk("reach", 90),
        mk("saved", 2),
        mk("shares", 1),
        mk("total_interactions", 8),
      ],
    },
  },
  {
    id: "3",
    caption: "Slides",
    media_type: "CAROUSEL_ALBUM",
    media_product_type: "FEED",
    permalink: "https://www.instagram.com/p/BBBBBB1/",
    timestamp: "2026-11-15T05:52:00+0000",
    like_count: 3,
    comments_count: 0,
    insights: { data: [mk("reach", 50)] },
  },
];
function execute(t) {
  const a = t.arguments;
  if (replyMode === "allFail")
    return {
      successful: false,
      error: "Permission denied: instagram_business_basic",
    };
  if (replyMode === "meFails" && a.ig_user_id === "me")
    return {
      successful: false,
      error:
        "(#100) Tried accessing nonexisting field (username) on node type (User)",
    };
  let data = {};
  if (t.tool_slug === "INSTAGRAM_GET_USER_INFO")
    data = {
      username: "me_ig",
      followers_count: 5,
      follows_count: 2,
      media_count: 16,
    };
  else if (t.tool_slug === "INSTAGRAM_GET_IG_USER_MEDIA")
    data = { data: media };
  else if (t.tool_slug === "INSTAGRAM_GET_USER_INSIGHTS") {
    if (a.metric[0] === "follower_count")
      return { successful: false, error: "needs 100 followers" };
    if (a.breakdown)
      data = {
        data: [
          {
            name: "views",
            total_value: {
              value: 1971,
              breakdowns: [
                {
                  results: [
                    { dimension_values: ["NON_FOLLOWER"], value: 1781 },
                    { dimension_values: ["FOLLOWER"], value: 190 },
                  ],
                },
              ],
            },
          },
        ],
      };
    else
      data = {
        data: a.metric.map((m) => ({
          name: m,
          total_value: { value: m === "views" ? 900 : 100 },
        })),
      };
  } else return { successful: false, error: "unknown tool" };
  return { successful: true, data };
}
global.fetch = async (url, init = {}) => {
  url = String(url);
  const body = init.body;
  if (url.endsWith("/.well-known/oauth-authorization-server"))
    return json({
      authorization_endpoint: "https://connect.composio.dev/oauth/authorize",
      token_endpoint: "https://login.composio.dev/oauth2/token",
      registration_endpoint: "https://login.composio.dev/oauth2/register",
    });
  if (url === "/api/oauth/register") {
    calls.push({ reg: JSON.parse(body) });
    return json({ client_id: "client_1" }, 201);
  }
  if (url === "/api/oauth/token") {
    const p = new URLSearchParams(body);
    calls.push({ token: Object.fromEntries(p) });
    if (!tokenOk)
      return json(
        { error: "invalid_grant", error_description: "bad code" },
        400,
      );
    tokenIssued++;
    return json({
      access_token: "at" + tokenIssued,
      refresh_token: "rt1",
      expires_in: expireAccess ? 0 : 3600,
    });
  }
  if (url === "https://connect.composio.dev/mcp") {
    const auth = init.headers.authorization;
    if (auth !== "Bearer at" + tokenIssued)
      return new Response("{}", { status: 401 });
    const m = JSON.parse(body);
    calls.push({
      rpc: m.method,
      auth,
      session: init.headers["mcp-session-id"],
    });
    if (m.method === "initialize")
      return json(
        { jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2025-06-18" } },
        200,
        { "mcp-session-id": "S1" },
      );
    if (m.method === "notifications/initialized")
      return new Response(null, { status: 202 });
    let payload;
    const n = m.params.name,
      args = m.params.arguments;
    if (n === "COMPOSIO_SEARCH_TOOLS")
      payload = {
        successful: true,
        data: {
          toolkit_connection_statuses: [
            {
              toolkit: "instagram",
              accounts: [
                {
                  id: "instagram_x",
                  alias: "me_ig",
                  user_info: { username: "me_ig", id: "9999" },
                  status: "ACTIVE",
                  is_default: true,
                },
              ],
            },
          ],
        },
      };
    else if (n === "COMPOSIO_MANAGE_CONNECTIONS")
      payload = {
        successful: true,
        data: {
          results: {
            instagram: {
              redirect_url: "https://connect.composio.dev/link/abc",
            },
          },
        },
      };
    else if (n === "COMPOSIO_MULTI_EXECUTE_TOOL") {
      calls.push({ tools: args.tools.map((t) => t.tool_slug) });
      payload = {
        successful: true,
        data: {
          results: args.tools.map((t, index) => ({
            index,
            tool_slug: t.tool_slug,
            response: execute(t),
          })),
        },
      };
    } else payload = { successful: false, error: "nope" };
    const text = JSON.stringify(payload);
    const result =
      replyMode === "structured"
        ? {
            content: [{ type: "text", text: "Done." }],
            structuredContent: payload,
          }
        : replyMode === "prose"
          ? {
              content: [
                {
                  type: "text",
                  text: "Here is the result:\n" + text + "\nEnd.",
                },
              ],
            }
          : replyMode === "unreadable"
            ? {
                content: [
                  {
                    type: "text",
                    text: "Executed 7 tools. See workbench file /tmp/x.json",
                  },
                ],
              }
            : { content: [{ type: "text", text }] };
    const msg = { jsonrpc: "2.0", id: m.id, result };
    if (sseMode)
      return new Response(`event: message\ndata: ${JSON.stringify(msg)}\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    return json(msg);
  }
  return new Response("not found", { status: 404 });
};

require("../instagram.js");
const IG = window.IG;

(async () => {
  check("starts signed out", IG.setup().signedIn === false);
  let err;
  try {
    await IG.sync();
  } catch (e) {
    err = e;
  }
  check(
    "syncing signed out asks for a Composio sign-in",
    err && err.needsLogin === true,
  );

  await IG.signIn();
  const u = new URL(assigned);
  check(
    "sign-in goes to Composio's authorize page",
    u.origin + u.pathname === "https://connect.composio.dev/oauth/authorize",
  );
  check(
    "it is a PKCE code request with no client secret",
    u.searchParams.get("response_type") === "code" &&
      u.searchParams.get("code_challenge_method") === "S256" &&
      u.searchParams.get("code_challenge").length >= 43 &&
      !u.searchParams.has("client_secret"),
  );
  check(
    "it registers this site through the relay with its own redirect address",
    calls.find((c) => c.reg).reg.redirect_uris[0] ===
      "https://studio.example/" &&
      !("client_secret" in calls.find((c) => c.reg).reg),
  );
  const state = u.searchParams.get("state");

  location.search = "?code=abc&state=WRONG";
  check(
    "a redirect with the wrong state is ignored",
    (await IG.init()) === false && IG.setup().signedIn === false,
  );

  tokenOk = false;
  location.search = `?code=abc&state=${state}`;
  err = null;
  try {
    await IG.init();
  } catch (e) {
    err = e;
  }
  check(
    "a failed code exchange is reported",
    !!err && /bad code/.test(err.message),
  );
  tokenOk = true;
  await IG.signIn();
  const state2 = new URL(assigned).searchParams.get("state");
  location.search = `?code=abc&state=${state2}`;
  check(
    "the right state completes the sign-in",
    (await IG.init()) === true && IG.setup().signedIn === true,
  );
  const ex = calls.filter((c) => c.token).pop().token;
  check(
    "the code is exchanged with the PKCE verifier",
    ex.grant_type === "authorization_code" &&
      ex.code === "abc" &&
      ex.code_verifier.length >= 43 &&
      ex.client_id === "client_1",
  );
  check(
    "tokens are kept in this browser",
    JSON.parse(localStorage.getItem("rs_composio")).access ===
      "at" + tokenIssued,
  );

  const accts = await IG.sync();
  check(
    "sync finds the connected Instagram account",
    accts.length === 1 && accts[0].username === "me_ig",
  );
  const rpcs = calls.filter((c) => c.rpc).map((c) => c.rpc);
  check(
    "it opens an MCP session first",
    rpcs.slice(0, 2).join() === "initialize,notifications/initialized",
  );
  check(
    "the MCP session id is reused and the bearer token is sent",
    calls
      .filter((c) => c.rpc === "tools/call")
      .every((c) => c.session === "S1" && c.auth.startsWith("Bearer at")),
  );

  const d = await IG.refresh(accts[0].id, 30);
  check(
    "insights are read in a single batched request",
    calls.filter((c) => c.tools).pop().tools.length === 7,
  );
  check(
    "only read-only Instagram tools are used",
    calls
      .filter((c) => c.tools)
      .every((c) => c.tools.every((t) => /^INSTAGRAM_GET_/.test(t))),
  );
  check(
    "account totals are parsed (views, split, reach)",
    d.views === 1971 &&
      d.audience.followers === 190 &&
      d.audience.non === 1781 &&
      d.reach === 100 &&
      d.prev.views === 900,
  );
  check(
    "reels and carousels are parsed",
    d.reels.length === 1 &&
      d.reels[0].views === 120 &&
      d.reels[0].saves === 2 &&
      d.carousels.length === 1 &&
      d.carousels[0].reach === 50,
  );
  check(
    "one failed metric becomes a note, not an error",
    d.notes.length === 1 &&
      /Followers/.test(d.notes[0]) &&
      d.newFollowers === null,
  );
  check(
    "a pasted link finds your own post",
    !!IG.findByUrl(accts[0].id, "https://www.instagram.com/reel/AAAAAA1/"),
  );

  const link = await IG.link();
  check(
    "connecting Instagram returns Composio's link",
    link === "https://connect.composio.dev/link/abc",
  );

  sseMode = false;
  check(
    "plain JSON replies work as well as event streams",
    (await IG.sync()).length === 1,
  );

  /* an expired access token is refreshed with the refresh token */
  const before = calls.filter((c) => c.token).length;
  JSON.parse(localStorage.getItem("rs_composio"));
  localStorage.setItem(
    "rs_composio",
    JSON.stringify({
      ...JSON.parse(localStorage.getItem("rs_composio")),
      exp: 0,
    }),
  );
  // the module keeps tokens in memory, so expire it through the 401 path: the stand-in rejects the old token
  tokenIssued++; // the server now only accepts the next token
  const again = await IG.sync();
  const after = calls.filter((c) => c.token);
  check(
    "a rejected token is refreshed and the call retried",
    again.length === 1 &&
      after.length === before + 1 &&
      after.at(-1).token.grant_type === "refresh_token",
  );

  const diag = await IG.diagnose();
  check(
    "diagnostics report each step and succeed when all is well",
    diag.length === 5 &&
      diag.every((x) => x.ok) &&
      /me_ig/.test(diag[3].detail) &&
      /5 followers/.test(diag[4].detail),
    JSON.stringify(diag),
  );

  for (const mode of ["structured", "prose"]) {
    replyMode = mode;
    const dm = await IG.refresh(accts[0].id, 30);
    check(
      `a ${mode} reply is read the same way`,
      dm.views === 1971 && dm.reels.length === 1 && dm.profile.followers === 5,
      JSON.stringify(dm.notes),
    );
  }
  replyMode = "unreadable";
  let bad = null;
  try {
    await IG.refresh(accts[0].id, 30);
  } catch (e) {
    bad = e;
  }
  check(
    "an unreadable reply is an error that shows the reply, not silent zeros",
    !!bad &&
      /could not read/.test(bad.message) &&
      /workbench/.test(bad.message),
    bad && bad.message,
  );
  replyMode = "meFails";
  const viaId = await IG.refresh(accts[0].id, 30);
  check(
    'if "me" is refused, the account\'s own id is tried',
    viaId.profile.followers === 5 &&
      viaId.views === 1971 &&
      IG.get(accts[0].id).igRef === "9999",
  );
  replyMode = "allFail";
  let denied = null;
  try {
    await IG.refresh(accts[0].id, 30);
  } catch (e) {
    denied = e;
  }
  check(
    "the real reason is shown when Instagram refuses",
    !!denied &&
      /Permission denied: instagram_business_basic/.test(denied.message),
    denied && denied.message,
  );
  const dd = await IG.diagnose();
  check(
    "diagnostics show the real reason too",
    dd.length === 5 &&
      dd[4].ok === false &&
      /Permission denied/.test(dd[4].detail),
    JSON.stringify(dd[4]),
  );
  replyMode = "text";

  IG.signOut();
  const out = await IG.diagnose();
  check(
    "diagnostics stop at the step that fails",
    out.length === 2 &&
      out[1].ok === false &&
      /Not signed in/.test(out[1].detail),
    JSON.stringify(out),
  );
  check(
    "sign out clears the token",
    IG.setup().signedIn === false &&
      localStorage.getItem("rs_composio") === null &&
      !IG.connected(),
  );

  console.log(
    failed ? `\n${failed} failed` : "\nall Instagram client checks passed",
  );
  process.exit(failed ? 1 : 0);
})();
