/* Checks Sign in with OpenRouter and the OpenRouter requests, with a stand-in for OpenRouter.  Run: node tests/openrouter.test.js */
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
global.window = { URL };
global.localStorage = store();
global.sessionStorage = store();
let assigned = "";
global.location = {
  hostname: "studio.workers.dev",
  origin: "https://studio.workers.dev",
  pathname: "/",
  search: "",
  assign: (u) => (assigned = u),
};
global.history = { replaceState: () => {} };
global.Helper = {
  session: async () => ({ available: false }),
  info: () => null,
  call: async () => {
    throw new Error("no helper");
  },
};
const seen = [];
let chat = {
  status: 200,
  body: { choices: [{ message: { content: '{"ok":true,"hook":"A hook"}' } }] },
};
global.fetch = async (url, init = {}) => {
  url = String(url);
  seen.push({ url, init });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
  if (url.endsWith("/api/v1/auth/keys"))
    return JSON.parse(init.body).code_verifier
      ? json({ key: "sk-or-test" })
      : json({ error: "bad" }, 400);
  if (url.endsWith("/api/v1/models"))
    return json({
      data: [
        {
          id: "anthropic/claude-sonnet-4.5",
          name: "Claude Sonnet 4.5",
          created: 200,
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "anthropic/claude-3-haiku",
          name: "Claude 3 Haiku",
          created: 100,
          architecture: { input_modalities: ["text"] },
        },
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          created: 150,
          architecture: { input_modalities: ["text", "image"] },
        },
        {
          id: "someone/unknown",
          name: "Other",
          created: 300,
          architecture: { input_modalities: ["text"] },
        },
      ],
    });
  if (url.endsWith("/api/v1/chat/completions"))
    return json(chat.body, chat.status);
  return json({}, 404);
};
require("../ai.js");
const AI = window.AI;

(async () => {
  check(
    "starts not connected to OpenRouter",
    AI.orConnected() === false &&
      AI.configured() === (AI.mode() === "signin" ? false : false),
  );
  await AI.orSignIn();
  const u = new URL(assigned);
  check(
    "sign-in goes to OpenRouter's auth page",
    u.origin + u.pathname === "https://openrouter.ai/auth",
  );
  check(
    "it is a PKCE request that comes back to this site",
    u.searchParams.get("code_challenge_method") === "S256" &&
      u.searchParams.get("code_challenge").length >= 43 &&
      u.searchParams.get("callback_url") === "https://studio.workers.dev/",
  );
  const st = u.searchParams.get("state");

  location.search = "?code=abc&state=WRONG";
  check(
    "a return with the wrong state is ignored",
    (await AI.orInit()) === false && !AI.orConnected(),
  );
  location.search = "?code=abc&state=" + st;
  check(
    "the right state completes the sign-in",
    (await AI.orInit()) === true &&
      AI.orConnected() &&
      AI.mode() === "openrouter",
  );
  const ex = seen.find((x) => x.url.endsWith("/auth/keys"));
  const exb = JSON.parse(ex.init.body);
  check(
    "the code is exchanged with the PKCE verifier",
    exb.code === "abc" &&
      exb.code_verifier.length >= 43 &&
      exb.code_challenge_method === "S256",
  );
  check(
    "the key is kept in this browser",
    localStorage.getItem("rs_or_key") === "sk-or-test",
  );

  const models = await AI.orModels();
  check(
    "models list: only the main vendors, Claude first, with picture support noted",
    models.length === 3 &&
      models[0].id === "anthropic/claude-sonnet-4.5" &&
      models[0].vision === true &&
      models.find((m) => m.id === "anthropic/claude-3-haiku").vision === false,
  );
  check(
    "the default model is a Claude that can see pictures",
    AI.pickDefaultModel(models) === "anthropic/claude-sonnet-4.5",
  );

  let err;
  try {
    await AI.ask({ system: "s", user: "u", json: true });
  } catch (e) {
    err = e;
  }
  check(
    "asking without a model says to pick one",
    err && /Pick a model/.test(err.message),
  );
  AI.setOrModel("anthropic/claude-sonnet-4.5");
  check(
    "OpenRouter counts as configured once there is a key",
    AI.configured() === true && /OpenRouter/.test(AI.label()),
  );
  const r = await AI.ask({
    system: "SYS",
    user: "hello",
    max: 200,
    json: true,
  });
  const req = seen.filter((x) => x.url.endsWith("/chat/completions")).at(-1);
  const body = JSON.parse(req.init.body);
  check(
    "a text request uses the key, the model and a system message",
    r.hook === "A hook" &&
      req.init.headers.authorization === "Bearer sk-or-test" &&
      body.model === "anthropic/claude-sonnet-4.5" &&
      body.messages[0].role === "system" &&
      body.messages[1].content === "hello" &&
      body.max_tokens === 200,
  );
  await AI.askVision({
    system: "S",
    user: "look",
    images: ["AAAA", "BBBB"],
    json: true,
  });
  const vb = JSON.parse(
    seen.filter((x) => x.url.endsWith("/chat/completions")).at(-1).init.body,
  );
  check(
    "pictures are sent as image data addresses",
    vb.messages[1].content.filter((p) => p.type === "image_url").length === 2 &&
      vb.messages[1].content[0].image_url.url ===
        "data:image/jpeg;base64,AAAA" &&
      vb.messages[1].content.at(-1).text === "look",
  );
  chat = {
    status: 200,
    body: {
      choices: [
        {
          message: {
            content:
              'Here you go: {"scenes":[{"motif":"coin","emphasis":["money"]}],"theme":"Neon","pace":"Punchy","fx":{"caption":"stamp"},"switches":["glow"],"styleNote":"Loud and fast."}',
          },
        },
      ],
    },
  };
  const dir = await AI.direct({
    title: "T",
    blocks: [{ type: "hook", text: "Money talks" }],
    themes: ["Neon"],
    fx: {},
    catalog: { motifs: ["coin"], switches: ["glow"], notes: "" },
    presets: [],
    format: "All styles",
    clips: null,
    frames: null,
    refNote: "",
  });
  check(
    "the AI director works through OpenRouter (reads the model's JSON)",
    dir.theme === "Neon" &&
      dir.fx.caption === "stamp" &&
      dir.scenes[0].motif === "coin" &&
      dir.styleNote === "Loud and fast.",
  );
  const dv = await AI.direct({
    title: "T",
    blocks: [{ type: "hook", text: "x" }],
    themes: ["Neon"],
    fx: {},
    catalog: { motifs: [], switches: [], notes: "" },
    presets: [],
    format: "",
    clips: null,
    frames: [{ jpeg: "ZZ", t: 1 }],
    refNote: "ref.mp4",
  });
  const dvb = JSON.parse(
    seen.filter((x) => x.url.endsWith("/chat/completions")).at(-1).init.body,
  );
  check(
    "a reference video's frames reach the model as pictures",
    dv.theme === "Neon" && dvb.messages[1].content[0].type === "image_url",
  );

  chat = { status: 402, body: { error: { message: "Insufficient credits" } } };
  try {
    await AI.ask({ system: "s", user: "u" });
    err = null;
  } catch (e) {
    err = e;
  }
  check(
    "out of credits is explained",
    err && /credits/.test(err.message) && err.status === 402,
  );
  chat = { status: 401, body: { error: { message: "No auth" } } };
  try {
    await AI.ask({ system: "s", user: "u" });
    err = null;
  } catch (e) {
    err = e;
  }
  check(
    "a rejected key asks to sign in again",
    err && /Sign in with OpenRouter again/.test(err.message),
  );
  chat = {
    status: 200,
    body: {
      choices: [{ message: { content: [{ type: "text", text: '{"a":1}' }] } }],
    },
  };
  check(
    "array-style answers are read too",
    (await AI.ask({ system: "s", user: "u", json: true })).a === 1,
  );
  chat = { status: 200, body: { choices: [{ message: { content: "" } }] } };
  try {
    await AI.ask({ system: "s", user: "u" });
    err = null;
  } catch (e) {
    err = e;
  }
  check("an empty answer is an error, not silence", !!err);

  AI.orSignOut();
  check(
    "sign out removes the key",
    !AI.orConnected() &&
      localStorage.getItem("rs_or_key") === null &&
      AI.mode() !== "openrouter",
  );

  console.log(failed ? `\n${failed} failed` : "\nall OpenRouter checks passed");
  process.exit(failed ? 1 : 0);
})();
