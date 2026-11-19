const T = require("../tools.js");
const assert = require("assert");
let n = 0;
const ok = (name, fn) => {
  try {
    fn();
    n++;
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, "\n    ", e.message);
    process.exitCode = 1;
  }
};

ok("parseReelUrl accepts reel, p and username paths", () => {
  assert.deepStrictEqual(
    T.parseReelUrl("https://www.instagram.com/reel/DAbC123xYz/?igsh=abc"),
    {
      shortcode: "DAbC123xYz",
      kind: "reel",
      url: "https://www.instagram.com/reel/DAbC123xYz/",
    },
  );
  assert.strictEqual(
    T.parseReelUrl("instagram.com/someuser/reel/ABCDE12345/").shortcode,
    "ABCDE12345",
  );
  assert.strictEqual(
    T.parseReelUrl("https://www.instagram.com/p/CxYz_12-ab/").kind,
    "p",
  );
  assert.strictEqual(T.parseReelUrl("https://example.com/reel/abc12345"), null);
  assert.strictEqual(T.parseReelUrl("just some text"), null);
});

const caption = `Stop giving out free trials. If you're giving out a free trial in 2026, you might as well be lighting money on fire. Most of us are building with AI now, which means every free trial user costs real money in tokens and compute. So that's not a free trial, you're paying THEM to use your product.

Comment "PLAYBOOK" and I'll send you the $50k playbook.
#saas #startup @someone https://example.com/x`;
ok(
  "splitScript: first sentence is the hook, CTA becomes comment, tags removed",
  () => {
    const r = T.splitScript(caption);
    assert.strictEqual(r.hook, "Stop giving out free trials.");
    assert.ok(/PLAYBOOK/.test(r.comment), "comment: " + r.comment);
    assert.ok(r.body.length >= 3, "body lines: " + r.body.length);
    assert.ok(
      !/#|@|http/.test(r.body.join(" ") + r.comment),
      "tags should be gone",
    );
  },
);
ok("splitScript: long sentences are broken to <= 22 words", () => {
  const long =
    "Hook here. " +
    Array.from({ length: 60 }, (_, i) => "word" + i).join(" ") +
    ".";
  const r = T.splitScript(long);
  assert.ok(
    r.body.every((l) => T.words(l).length <= 22),
    r.body.map((l) => T.words(l).length).join(","),
  );
});
ok("splitScript: empty or emoji-only input returns null", () => {
  assert.strictEqual(T.splitScript(""), null);
  assert.strictEqual(T.splitScript("🔥🔥🔥"), null);
});
ok("blocksFrom adds a default CTA only when asked", () => {
  assert.strictEqual(
    T.blocksFrom({ hook: "H", body: ["a"], comment: "" }).length,
    2,
  );
  assert.strictEqual(
    T.blocksFrom(
      { hook: "H", body: ["a"], comment: "" },
      { addCta: true },
    ).slice(-1)[0].type,
    "comment",
  );
});

const base = () => [
  { type: "hook", text: "" },
  { type: "body", text: "old line" },
  { type: "comment", text: "Comment YES." },
];
ok(
  "splitPaste into the hook line: first sentence stays, rest flows into following lines",
  () => {
    const r = T.splitPaste(
      base(),
      0,
      'Free trials are dead. Here is why. Nobody pays after day 7. Comment "GUIDE" for the fix.',
      { start: 0, end: 0 },
    );
    assert.strictEqual(r.blocks[0].type, "hook");
    assert.strictEqual(r.blocks[0].text, "Free trials are dead.");
    assert.strictEqual(r.blocks[1].text, "Here is why.");
    assert.strictEqual(r.blocks[2].text, "Nobody pays after day 7.");
    assert.strictEqual(r.blocks[3].text, "old line");
    assert.strictEqual(
      r.blocks[r.blocks.length - 1].text,
      'Comment "GUIDE" for the fix.',
    );
    assert.strictEqual(r.blocks.filter((b) => b.type === "hook").length, 1);
  },
);
ok(
  "splitPaste into the line below the hook keeps the hook and inserts after it",
  () => {
    const b = base();
    b[0].text = "My hook";
    const r = T.splitPaste(b, 1, "One idea. Another idea. A third idea.", {
      start: 8,
      end: 8,
    });
    assert.strictEqual(r.blocks[0].text, "My hook");
    assert.deepStrictEqual(
      r.blocks.slice(1, 4).map((x) => x.type),
      ["body", "body", "body"],
    );
    assert.strictEqual(r.blocks[1].text, "old lineOne idea.");
  },
);
ok("splitPaste of a single sentence is left to the browser", () => {
  assert.strictEqual(
    T.splitPaste(base(), 0, "Just one sentence", { start: 0, end: 0 }),
    null,
  );
});
ok("splitPaste into the comment line puts lines before it", () => {
  const r = T.splitPaste(
    base(),
    2,
    'First point. Second point. Comment "X" to get it.',
    { start: 0, end: 12 },
  );
  assert.strictEqual(r.blocks[r.blocks.length - 1].type, "comment");
  assert.ok(/Comment "X"/.test(r.blocks[r.blocks.length - 1].text));
  assert.ok(r.blocks.slice(0, -1).some((x) => x.text === "Second point."));
});
ok("splitPaste does not mutate its input", () => {
  const b = base();
  const s = JSON.stringify(b);
  T.splitPaste(b, 0, "A one. B two. C three.", { start: 0, end: 0 });
  assert.strictEqual(JSON.stringify(b), s);
});

ok("hookFeatures", () => {
  const f = T.hookFeatures("Stop losing $5,000 a month?");
  assert.ok(f.number && f.question && f.dollar && f.negative && !f.you);
  assert.ok(T.hookFeatures("You need this").you);
});
ok("featureLift finds that number-hooks win in synthetic data", () => {
  const rows = [];
  for (let i = 0; i < 6; i++)
    rows.push({
      caption: `${i + 3} ways to grow. rest`,
      views: 1000,
      likes: 100,
      comments: 20,
      shares: 30,
      saves: 40,
    });
  for (let i = 0; i < 6; i++)
    rows.push({
      caption: `A quiet thought about growth ${"x".repeat(i)}. rest`,
      views: 1000,
      likes: 20,
      comments: 2,
      shares: 2,
      saves: 4,
    });
  const l = T.featureLift(rows);
  const num = l.find((x) => x.key === "number");
  assert.ok(num && num.lift > 3, JSON.stringify(num));
  assert.strictEqual(l[0].key, "number");
});
ok("featureLift needs enough data", () => {
  assert.deepStrictEqual(
    T.featureLift([{ caption: "a", views: 10, likes: 1 }]),
    [],
  );
});
ok("engagement weights shares and saves above likes", () => {
  assert.ok(
    T.engagement({ views: 100, shares: 10 }) >
      T.engagement({ views: 100, likes: 10 }),
  );
  assert.strictEqual(T.engagement({}), 0);
});
ok("rewardFrom is clamped to 0..1 and relative to the median", () => {
  assert.strictEqual(T.rewardFrom(100, 5), 1);
  assert.strictEqual(T.rewardFrom(0, 5), 0);
  assert.strictEqual(T.rewardFrom(5, 5), 0.5);
});

ok(
  "bandit: the rewarded option wins after a few results, untried ones still get explored",
  () => {
    const arms = {};
    const opts = ["A", "B", "C"];
    for (let i = 0; i < 6; i++) {
      T.learn(arms, { theme: "B" }, 0.9);
      T.learn(arms, { theme: "A" }, 0.1);
    }
    const r = T.rank(arms.theme, opts);
    assert.strictEqual(r[0].option, "B");
    assert.ok(
      r.findIndex((x) => x.option === "B") <
        r.findIndex((x) => x.option === "A"),
    );
    assert.ok(
      r.find((x) => x.option === "C").score >
        r.find((x) => x.option === "A").score,
      "untried should out-rank a proven loser",
    );
    assert.strictEqual(T.totalResults(arms), 12);
  },
);
ok(
  "bandit converges: with many results the best arm ranks first even against an untried arm",
  () => {
    const arms = {};
    for (let i = 0; i < 60; i++) {
      T.learn(arms, { theme: "B" }, 0.9);
      T.learn(arms, { theme: "A" }, 0.1);
    }
    assert.strictEqual(T.rank(arms.theme, ["A", "B", "C"])[0].option, "B");
  },
);
console.log(`\n${n} passed`);
