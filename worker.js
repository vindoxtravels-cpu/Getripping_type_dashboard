/* Cloudflare Worker for the deployed Reel Studio.
 * It serves the static app and a small, read-only Instagram proxy that talks to Composio, so the Composio API key never
 * reaches the browser.
 *
 * Secrets (set with `npx wrangler secret put NAME`):
 *   COMPOSIO_API_KEY   required, your Composio project API key
 *   APP_PASSCODE       strongly recommended, anyone who has this site's link can read your Instagram insights without it
 *   COMPOSIO_USER_ID   optional, the Composio user id used when adding a new Instagram account (default "reel-studio")
 */
const COMPOSIO = "https://backend.composio.dev/api/v3.1";
/* Only these read-only Instagram tools can be run through the proxy. */
const TOOLS = new Set([
  "INSTAGRAM_GET_USER_INFO",
  "INSTAGRAM_GET_IG_USER_MEDIA",
  "INSTAGRAM_GET_USER_INSIGHTS",
  "INSTAGRAM_GET_IG_MEDIA_INSIGHTS",
]);
const ID = /^[A-Za-z0-9_-]{3,100}$/;
const USER = /^[A-Za-z0-9_.@+-]{1,128}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

async function same(a, b) {
  const enc = new TextEncoder(),
    [x, y] = await Promise.all(
      [a, b].map(
        async (s) =>
          new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))),
      ),
    );
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function composio(env, path, init) {
  const r = await fetch(COMPOSIO + path, {
    ...init,
    headers: {
      "x-api-key": env.COMPOSIO_API_KEY,
      "content-type": "application/json",
    },
  });
  let body = null;
  try {
    body = await r.json();
  } catch (e) {
    /* not json */
  }
  return { ok: r.ok, status: r.status, body };
}
const why = (b, fallback) =>
  (b && b.error && (b.error.message || b.error)) ||
  (b && b.message) ||
  fallback;

async function handle(req, env) {
  const url = new URL(req.url),
    path = url.pathname;
  if (!path.startsWith("/api/composio/"))
    return json({ error: "Not found" }, 404);

  /* only this site's own pages may call the proxy */
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Forbidden" }, 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return json({ error: "Forbidden" }, 403);

  if (!env.COMPOSIO_API_KEY)
    return json({
      configured: false,
      accounts: [],
      help: "Add your Composio API key to the Worker: npx wrangler secret put COMPOSIO_API_KEY",
    });

  if (env.APP_PASSCODE) {
    const given = req.headers.get("x-app-passcode") || "";
    if (!(await same(given, env.APP_PASSCODE)))
      return json(
        {
          error: given ? "Wrong passcode." : "Enter the passcode.",
          needsPasscode: true,
        },
        401,
      );
  }

  if (path === "/api/composio/status" && req.method === "GET") {
    const r = await composio(
      env,
      "/connected_accounts?toolkit_slugs=instagram&statuses=ACTIVE&limit=50",
    );
    if (!r.ok)
      return json({ error: why(r.body, "Composio refused the request.") }, 502);
    return json({
      configured: true,
      protected: !!env.APP_PASSCODE,
      accounts: ((r.body && r.body.items) || []).map((a) => ({
        id: a.id,
        alias: a.alias || "",
        userId: a.user_id || "",
        status: a.status,
      })),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try {
    const text = await req.text();
    if (text.length > 20000) return json({ error: "Request too large." }, 413);
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    return json({ error: "Bad request." }, 400);
  }

  if (path === "/api/composio/link") {
    const cfg = await composio(
      env,
      "/auth_configs?toolkit_slug=instagram&limit=20",
    );
    const item =
      cfg.ok &&
      cfg.body &&
      (cfg.body.items || []).find((c) => c.status !== "DISABLED");
    if (!item)
      return json(
        {
          error:
            "Your Composio project has no Instagram auth config yet. In the Composio dashboard open Auth Configs, add Instagram (Composio managed), then try again.",
        },
        409,
      );
    const r = await composio(env, "/connected_accounts/link", {
      method: "POST",
      body: JSON.stringify({
        auth_config_id: item.id,
        user_id: env.COMPOSIO_USER_ID || "reel-studio",
        callback_url: url.origin + "/",
      }),
    });
    if (!r.ok || !r.body || !r.body.redirect_url)
      return json(
        { error: why(r.body, "Could not start the connection.") },
        502,
      );
    return json({ url: r.body.redirect_url });
  }

  if (path === "/api/composio/execute") {
    const { tool, account, userId, arguments: args } = body;
    if (!TOOLS.has(tool))
      return json({ error: "That tool is not allowed." }, 400);
    if (!ID.test(String(account || "")))
      return json({ error: "Choose an Instagram account first." }, 400);
    if (userId && !USER.test(String(userId)))
      return json({ error: "Bad user id." }, 400);
    if (!args || typeof args !== "object" || Array.isArray(args))
      return json({ error: "Bad arguments." }, 400);
    const payload = { connected_account_id: account, arguments: args };
    if (userId) payload.user_id = userId;
    const r = await composio(env, "/tools/execute/" + tool, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!r.ok)
      return json(
        { error: why(r.body, "Composio refused the request.") },
        r.status === 429 ? 429 : 502,
      );
    const b = r.body || {};
    if (b.successful === false)
      return json({ error: why(b, "Instagram returned an error.") }, 502);
    return json({ data: b.data });
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname.startsWith("/api/")) {
      try {
        return await handle(req, env);
      } catch (e) {
        return json({ error: "The proxy failed. Try again." }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
