/* Cloudflare Worker for the deployed Reel Studio: it serves the static app and relays Composio's OAuth sign-in
 * requests. Composio's sign-in server doesn't allow browsers to read its replies directly, so these two calls
 * (register this site as a public client, exchange a code for a token) go through here. The relay holds no secret and
 * no API key: it forwards a fixed set of fields to one fixed address, only for this site's own pages.
 */
const UPSTREAM = {
  register: "https://login.composio.dev/oauth2/register",
  token: "https://login.composio.dev/oauth2/token",
};
const TOKEN_FIELDS = [
  "grant_type",
  "code",
  "redirect_uri",
  "client_id",
  "code_verifier",
  "refresh_token",
];

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

async function relay(req, url) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (
    origin !== url.origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return json({ error: "Forbidden" }, 403);
  const text = await req.text();
  if (text.length > 4000) return json({ error: "Request too large" }, 413);
  const kind = url.pathname.replace("/api/oauth/", "");
  let upstream;
  if (kind === "register") {
    let b;
    try {
      b = JSON.parse(text);
    } catch (e) {
      return json({ error: "Bad request" }, 400);
    }
    const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
    if (
      !uris.length ||
      !uris.every((u) => String(u).startsWith(url.origin + "/"))
    )
      return json({ error: "Redirect addresses must be on this site." }, 400);
    upstream = await fetch(UPSTREAM.register, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: String(b.client_name || "Reel Studio").slice(0, 60),
        redirect_uris: uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
  } else if (kind === "token") {
    const p = new URLSearchParams(text),
      out = new URLSearchParams();
    TOKEN_FIELDS.forEach((k) => p.has(k) && out.set(k, p.get(k)));
    if (
      !["authorization_code", "refresh_token"].includes(out.get("grant_type"))
    )
      return json({ error: "unsupported_grant_type" }, 400);
    if (
      out.has("redirect_uri") &&
      !out.get("redirect_uri").startsWith(url.origin + "/")
    )
      return json({ error: "Redirect address must be on this site." }, 400);
    upstream = await fetch(UPSTREAM.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: out,
    });
  } else return json({ error: "Not found" }, 404);
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/oauth/")) {
      try {
        return await relay(req, url);
      } catch (e) {
        return json({ error: "The sign-in relay failed. Try again." }, 502);
      }
    }
    if (url.pathname.startsWith("/api/"))
      return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(req);
  },
};
