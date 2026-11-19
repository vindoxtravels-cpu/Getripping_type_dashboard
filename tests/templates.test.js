/* Checks the GitHub template-pack loader with a stand-in for GitHub.  Run: node tests/templates.test.js */
const T = require("../templates.js");
let failed = 0;
const check = (n, ok, d = "") => {
  console.log((ok ? "ok   " : "FAIL ") + n + (ok ? "" : "  " + d));
  if (!ok) failed++;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check(
  "owner/repo",
  eq(T.parseRepo("a/b"), { owner: "a", repo: "b", ref: "", path: "" }),
);
check(
  "full url",
  eq(T.parseRepo("https://github.com/a/b.git"), {
    owner: "a",
    repo: "b",
    ref: "",
    path: "",
  }),
);
check(
  "tree link with folder",
  eq(T.parseRepo("https://github.com/a/b/tree/main/packs/x"), {
    owner: "a",
    repo: "b",
    ref: "main",
    path: "packs/x",
  }),
);
check(
  "rejects junk",
  T.parseRepo("nope") === null &&
    T.parseRepo("a/b c") === null &&
    T.parseRepo("a/../b") === null &&
    T.parseRepo("a/b/tree/main/../../x") === null,
);

const files = {
  "https://api.github.com/repos/a/b/contents/templates": [
    {
      type: "file",
      name: "one.json",
      size: 100,
      download_url:
        "https://raw.githubusercontent.com/a/b/main/templates/one.json",
    },
    {
      type: "file",
      name: "many.json",
      size: 100,
      download_url:
        "https://raw.githubusercontent.com/a/b/main/templates/many.json",
    },
    {
      type: "file",
      name: "evil.json",
      size: 100,
      download_url: "https://evil.example/x.json",
    },
    {
      type: "file",
      name: "big.json",
      size: 999999,
      download_url:
        "https://raw.githubusercontent.com/a/b/main/templates/big.json",
    },
    {
      type: "file",
      name: "bad.json",
      size: 10,
      download_url:
        "https://raw.githubusercontent.com/a/b/main/templates/bad.json",
    },
    {
      type: "file",
      name: "readme.md",
      size: 10,
      download_url:
        "https://raw.githubusercontent.com/a/b/main/templates/readme.md",
    },
    { type: "dir", name: "sub.json" },
  ],
  "https://raw.githubusercontent.com/a/b/main/templates/one.json":
    '{"name":"X"}',
  "https://raw.githubusercontent.com/a/b/main/templates/many.json":
    '{"templates":[{"name":"Y"},{"name":"Z"}]}',
  "https://raw.githubusercontent.com/a/b/main/templates/bad.json": "{nope",
};
const seen = [];
global.fetch = async (url) => {
  seen.push(String(url));
  const k = String(url).split("?")[0];
  if (k in files) {
    const v = files[k];
    return { ok: true, status: 200, json: async () => v, text: async () => v };
  }
  return { ok: false, status: 404 };
};
(async () => {
  const r = await T.fetchPack("a/b");
  check(
    "reads one, many and skips the rest",
    eq(
      r.templates.map((t) => t.name),
      ["X", "Y", "Z"],
    ) && r.files === 2,
    JSON.stringify(r),
  );
  check(
    "never downloads from other hosts",
    !seen.some((u) => u.includes("evil.example")),
  );
  check(
    "reports skipped files",
    r.errors.length === 3,
    JSON.stringify(r.errors),
  );
  let msg = "";
  try {
    await T.fetchPack("a/missing");
  } catch (e) {
    msg = e.message;
  }
  check(
    "missing repo gives a clear error",
    /public repositories/.test(msg),
    msg,
  );
  try {
    await T.fetchPack("??");
  } catch (e) {
    msg = e.message;
  }
  check("bad input gives a clear error", /owner\/repo/.test(msg), msg);
  console.log(
    failed ? `\n${failed} failed` : "\nall template loader checks passed",
  );
  process.exit(failed ? 1 : 0);
})();
