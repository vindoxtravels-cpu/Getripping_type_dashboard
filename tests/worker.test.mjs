/* Checks the Cloudflare Worker's Instagram proxy with a stand-in for Composio.  Run: node tests/worker.test.mjs */
import worker from "../worker.js";

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  " + detail));
  if (!ok) failed++;
};
const seen = [];
globalThis.fetch = async (url, init) => {
  seen.push({ url: String(url), init });
  const u = String(url);
  const reply = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (u.includes("/connected_accounts?"))
    return reply({
      items: [
        { id: "ca_abc123", alias: "me_ig", user_id: "u1", status: "ACTIVE" },
      ],
    });
  if (u.includes("/auth_configs"))
    return reply({ items: [{ id: "ac_1", status: "ENABLED" }] });
  if (u.includes("/connected_accounts/link"))
    return reply({
      redirect_url: "https://connect.composio.dev/link/x",
      connected_account_id: "ca_login",
    });
  if (u.includes("/tools/execute/GMAIL_GET_PROFILE"))
    return reply({
      successful: true,
      data: { emailAddress: globalThis.GMAIL || "me@gmail.com" },
    });
  if (u.includes("/connected_accounts/ca_login"))
    return reply({ status: "ACTIVE" });
  if (u.includes("/tools/execute/"))
    return reply({ successful: true, data: { data: [], followers_count: 5 } });
  return new Response("{}", { status: 404 });
};
const ASSETS = { fetch: async () => new Response("<html>app</html>") };
const call = (env, path, init = {}) =>
  worker.fetch(new Request("https://studio.example" + path, init), {
    ASSETS,
    ...env,
  });
const post = (env, path, body, headers = {}) =>
  call(env, path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const KEY = { COMPOSIO_API_KEY: "ck_test" };

let r = await call({}, "/");
check("static pages come from the assets", (await r.text()).includes("app"));
r = await call({}, "/api/session");
check("the local helper's session route is a 404 here", r.status === 404);
r = await call({}, "/api/composio/status");
check(
  "without a key the status says not configured",
  (await r.json()).configured === false,
);

r = await call(KEY, "/api/composio/status");
let j = await r.json();
check(
  "status lists accounts",
  j.configured && j.accounts[0].id === "ca_abc123",
);
check(
  "the Composio key is sent to Composio only",
  seen.at(-1).init.headers["x-api-key"] === "ck_test" &&
    !JSON.stringify(j).includes("ck_test"),
);

const PASS = { ...KEY, APP_PASSCODE: "open-sesame" };
r = await call(PASS, "/api/composio/status");
check(
  "a passcode is required when set",
  r.status === 401 && (await r.json()).needsPasscode === true,
);
r = await call(PASS, "/api/composio/status", {
  headers: { "x-app-passcode": "nope" },
});
check("a wrong passcode is refused", r.status === 401);
r = await call(PASS, "/api/composio/status", {
  headers: { "x-app-passcode": "open-sesame" },
});
check("the right passcode works", r.status === 200);

const ok = {
  tool: "INSTAGRAM_GET_USER_INFO",
  account: "ca_abc123",
  userId: "u1",
  arguments: { ig_user_id: "me" },
};
r = await post(KEY, "/api/composio/execute", ok);
j = await r.json();
check(
  "an allowed read-only tool runs",
  r.status === 200 && j.data.followers_count === 5,
);
const sent = JSON.parse(seen.at(-1).init.body);
check(
  "the account is passed to Composio",
  sent.connected_account_id === "ca_abc123" && sent.user_id === "u1",
);
for (const tool of [
  "INSTAGRAM_CREATE_MEDIA_CONTAINER",
  "INSTAGRAM_DELETE_COMMENT",
  "GMAIL_SEND_EMAIL",
]) {
  r = await post(KEY, "/api/composio/execute", { ...ok, tool });
  check("refuses " + tool, r.status === 400);
}
r = await post(KEY, "/api/composio/execute", { ...ok, account: "../x" });
check("refuses a bad account id", r.status === 400);
r = await post(KEY, "/api/composio/execute", { ...ok, arguments: ["me"] });
check("refuses bad arguments", r.status === 400);
r = await post(KEY, "/api/composio/link", {});
check(
  "link returns Composio's hosted sign-in",
  (await r.json()).url.startsWith("https://connect.composio.dev/"),
);

r = await post(KEY, "/api/composio/execute", ok, {
  origin: "https://evil.example",
});
check("refuses another website's origin", r.status === 403);
r = await call(KEY, "/api/composio/status", {
  headers: { "sec-fetch-site": "cross-site" },
});
check("refuses cross-site requests", r.status === 403);
r = await call(KEY, "/api/composio/execute");
check("execute is POST only", r.status === 405);

/* Gmail sign-in */
const GM = { ...KEY, ALLOWED_EMAILS: "Me@Gmail.com, other@gmail.com" };
r = await call(GM, "/api/composio/status");
j = await r.json();
check(
  "with ALLOWED_EMAILS the proxy needs a Gmail sign-in",
  r.status === 401 && j.needsLogin === true,
);
r = await call(GM, "/api/auth/status");
j = await r.json();
check(
  "auth status says sign-in is required",
  j.required === true && j.email === null,
);
r = await post(GM, "/api/auth/start", {});
j = await r.json();
check(
  "start returns Composio's Gmail link and a pending token",
  r.status === 200 &&
    j.url.startsWith("https://connect.composio.dev/") &&
    !!j.pending,
);
const pending = j.pending;
r = await post(GM, "/api/auth/finish", { pending: pending + "x" });
check("a tampered pending token is refused", r.status === 400);
r = await post(GM, "/api/auth/finish", { pending });
j = await r.json();
const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
check(
  "an allowed Gmail address signs in",
  r.status === 200 &&
    j.email === "me@gmail.com" &&
    cookie.startsWith("rs_session="),
);
check(
  "the cookie is HttpOnly, Secure and SameSite=Strict",
  /HttpOnly/.test(r.headers.get("set-cookie")) &&
    /Secure/.test(r.headers.get("set-cookie")) &&
    /SameSite=Strict/.test(r.headers.get("set-cookie")),
);
check(
  "the temporary Gmail connection is deleted",
  seen.some(
    (x) => x.init && x.init.method === "DELETE" && x.url.includes("ca_login"),
  ),
);
r = await call(GM, "/api/composio/status", { headers: { cookie } });
check("the cookie unlocks the proxy", r.status === 200);
r = await call(GM, "/api/composio/status", {
  headers: { cookie: cookie.slice(0, -2) + "xx" },
});
check("a forged cookie is refused", r.status === 401);
r = await call(
  { ...GM, ALLOWED_EMAILS: "someone@else.com" },
  "/api/composio/status",
  { headers: { cookie } },
);
check(
  "a cookie for an address that is no longer allowed is refused",
  r.status === 401,
);
globalThis.GMAIL = "stranger@gmail.com";
r = await post(GM, "/api/auth/finish", { pending });
check("a Gmail address that is not allowed is refused", r.status === 403);
globalThis.GMAIL = undefined;
r = await post(KEY, "/api/auth/start", {});
check("Gmail sign-in is off without ALLOWED_EMAILS", r.status === 409);

console.log(failed ? `\n${failed} failed` : "\nall worker checks passed");
process.exit(failed ? 1 : 0);
