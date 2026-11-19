/* Checks the Worker's sign-in relay with a stand-in for Composio.  Run: node tests/worker.test.mjs */
import worker from "../worker.js";

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  " + detail));
  if (!ok) failed++;
};
const seen = [];
globalThis.fetch = async (url, init) => {
  seen.push({ url: String(url), init });
  if (String(url).endsWith("/oauth2/register"))
    return new Response(JSON.stringify({ client_id: "client_1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  return new Response(
    JSON.stringify({ access_token: "at", refresh_token: "rt" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
const ASSETS = { fetch: async () => new Response("<html>app</html>") };
const O = "https://studio.example";
const call = (path, init = {}) =>
  worker.fetch(new Request(O + path, init), { ASSETS });
const post = (path, body, ct, headers = {}) =>
  call(path, {
    method: "POST",
    headers: { "content-type": ct, origin: O, ...headers },
    body,
  });
const form = (o) => new URLSearchParams(o).toString();

let r = await call("/");
check("static pages come from the assets", (await r.text()).includes("app"));
r = await call("/api/anything");
check("other /api paths are 404", r.status === 404);

r = await post(
  "/api/oauth/register",
  JSON.stringify({
    client_name: "Reel Studio",
    redirect_uris: [O + "/"],
    token_endpoint_auth_method: "client_secret_basic",
    extra: "x",
  }),
  "application/json",
);
check(
  "register returns the client id",
  r.status === 201 && (await r.json()).client_id === "client_1",
);
let sent = JSON.parse(seen.at(-1).init.body);
check(
  "it always registers a public client and forwards only known fields",
  sent.token_endpoint_auth_method === "none" &&
    !("extra" in sent) &&
    seen.at(-1).url === "https://login.composio.dev/oauth2/register",
);
r = await post(
  "/api/oauth/register",
  JSON.stringify({ redirect_uris: ["https://evil.example/"] }),
  "application/json",
);
check("register refuses redirect addresses on other sites", r.status === 400);
r = await post("/api/oauth/register", "{nope", "application/json");
check("register refuses bad JSON", r.status === 400);

r = await post(
  "/api/oauth/token",
  form({
    grant_type: "authorization_code",
    code: "c",
    redirect_uri: O + "/",
    client_id: "client_1",
    code_verifier: "v",
    client_secret: "leak",
    scope: "x",
  }),
  "application/x-www-form-urlencoded",
);
check(
  "token exchange returns the token",
  r.status === 200 && (await r.json()).access_token === "at",
);
const fwd = new URLSearchParams(seen.at(-1).init.body);
check(
  "only the allowed fields are forwarded, to Composio only",
  fwd.get("code") === "c" &&
    !fwd.has("client_secret") &&
    !fwd.has("scope") &&
    seen.at(-1).url === "https://login.composio.dev/oauth2/token",
);
r = await post(
  "/api/oauth/token",
  form({
    grant_type: "refresh_token",
    refresh_token: "rt",
    client_id: "client_1",
  }),
  "application/x-www-form-urlencoded",
);
check("refresh works", r.status === 200);
r = await post(
  "/api/oauth/token",
  form({ grant_type: "password", username: "a", password: "b" }),
  "application/x-www-form-urlencoded",
);
check("other grant types are refused", r.status === 400);
r = await post(
  "/api/oauth/token",
  form({
    grant_type: "authorization_code",
    code: "c",
    redirect_uri: "https://evil.example/",
  }),
  "application/x-www-form-urlencoded",
);
check("a redirect address on another site is refused", r.status === 400);

r = await post(
  "/api/oauth/token",
  form({ grant_type: "refresh_token", refresh_token: "r" }),
  "application/x-www-form-urlencoded",
  { origin: "https://evil.example" },
);
check("another website's origin is refused", r.status === 403);
r = await call("/api/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form({ grant_type: "refresh_token", refresh_token: "r" }),
});
check("a request with no origin is refused", r.status === 403);
r = await call("/api/oauth/token");
check("GET is refused", r.status === 405);

console.log(failed ? `\n${failed} failed` : "\nall worker checks passed");
process.exit(failed ? 1 : 0);
