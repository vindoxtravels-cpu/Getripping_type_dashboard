# Reel Studio

A short-video workflow in six steps: **Discover → Scripts → Studio → Calendar → Insights → Remix**.
It imports scripts from reel links, makes real animated video files in your browser, reads real numbers from one or many Instagram accounts, and learns which styles earn more.

No build step. Start the **helper**, which serves the app and switches on Sign in with Claude and free Edge voices:

```bash
./bridge/start.sh
```

then open **http://localhost:5174**. The first run installs the small `edge-tts` voice package if it is missing. (Python 3 is the only requirement.) You can still serve the folder with `python3 -m http.server 5174`, but Claude sign-in and Edge voices then stay off.

Everything you create is stored in the browser (`localStorage`). On a phone, use _Add to Home Screen_ to run it like an app.

## The six steps

| Step         | What you do                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discover** | Paste a reel link to turn it into a script, or drag reels right to save and left to skip. See why a reel works and draft a script from it.                                        |
| **Scripts**  | A library of scripts. Paste a whole caption into the hook line (or the line below it) and it splits across the lines. A timeline, checks and a virality score update as you type. |
| **Studio**   | Pick one of 25 styles, a pace and a set of effects, let Claude direct the scenes, and **render a real video**.                                                                    |
| **Calendar** | Week view. Schedule a video, mark it posted, then link it to its live reel so Studio learns from the result.                                                                      |
| **Insights** | Live numbers from one or many Instagram accounts, compared with the previous period, plus carousels and what your best hooks have in common.                                      |
| **Remix**    | The best posted video becomes a carousel (PNG export, 1080×1350) and a batch of new hooks.                                                                                        |

## Import a script from a reel (Claude watches it)

Paste an Instagram reel link in **Discover** (or into any script line), or open **Import from reel link** in Scripts. With Claude connected and the helper running, Studio:

1. **Finds the reel in your connected accounts.** If it is yours, it downloads the video straight from Instagram's servers (the helper only ever downloads from Instagram's own video addresses) and starts straight away.
2. **Cuts it into frames** with `ffmpeg`: one at every scene change plus evenly spaced ones, up to 30. You see them appear in a strip.
3. **Listens**, if you installed speech-to-text: the helper transcribes the audio on your computer (`./bridge/start.sh --speech`, one time, about 190 MB plus a 145 MB speech model).
4. **Claude looks at every frame** together with the speech and caption, copies the on-screen text, describes each frame, writes the script (hook, lines, comment call-to-action) and picks a matching style.

The result is a new script with a collapsible **Reel breakdown**: each frame's time, what it shows, and its on-screen text. Tick _Rewrite in my own words_ for a new script with original wording (the default), or untick it to reconstruct what the video actually says. I tested this on a 14-second reel rendered by Studio itself: faithful mode reproduced all four lines exactly and picked the style it had been made in.

**Other people's reels.** Instagram does not let apps download other people's reels, and Studio does not scrape them. For those you can **drop the video file** into the importer yourself (a video you own, one you have permission to use, or a screen recording) and the same frame-by-frame analysis runs. Without a video, paste the caption or what they say and it is split into a hook, lines and a call-to-action (or rewritten by Claude).

Needs: `ffmpeg` (`brew install ffmpeg`), the helper, and Claude connected. Videos up to 10 minutes and 300 MB. Everything stays on your computer except the cut frames, caption and transcript, which go to Claude.

Pasting several sentences into a script line spreads them over the following lines: into the hook line, the first sentence stays as the hook; into a body line, they become consecutive body lines; a "Comment …" sentence replaces the call-to-action.

## Video generation

Studio draws every frame itself and records it with the browser's `MediaRecorder`. The live preview and the file come from the same renderer, so they match.

- **25 styles**, each with its own animated background.
- **Effects**, all optional, with four one-click presets (Clean, Hype, Cinematic, Glitch):
  - _Captions:_ pop, typewriter, slide, bounce, glitch
  - _Transitions:_ ring, zoom, slide, flash, glitch
  - _Camera:_ push-in, drift, shake, still
  - _Particles:_ sparkles, confetti, bokeh
  - _Toggles:_ scene icons, glow, color fringe, film grain
- **Scene icons:** animated chart, coin, flame, bolt, target, clock, heart and check icons chosen from the words in each line (or by Claude).
- Output is **720×1280 (9:16) at 30 fps**: MP4 in Chrome, Edge and Safari, WebM where MP4 recording isn't available. Convert WebM for Instagram with
  `ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -c:a aac out.mp4`.
- **Rendering runs in real time.** A 30-second reel takes about 30 seconds and the tab must stay open.
- **Audio:** a synthesized beat (optional) and a voice-over from any of three sources (see _Voice-over_ below).
- Rendered videos live in the tab. Download the file to keep it.

## Connect Claude (optional, unlocks the AI tools)

Click **Connect Claude** in the sidebar. There are two ways:

- **Sign in (no API key).** The helper runs **your own Claude Code**, signed in to your Claude account, so usage comes from your Claude plan. The dialog shows whether the helper and Claude Code are found, and a **Sign in with Claude** button starts Claude Code's own sign-in (it opens your browser). Every request runs with all of Claude Code's tools switched off in an empty folder, so it can only answer text. This is meant for your own personal use on your own computer. It needs [Claude Code](https://claude.com/claude-code) installed (the Claude desktop app's built-in copy is found automatically).
- **API key.** Paste a key from console.anthropic.com. It stays in this browser and requests go straight to Anthropic. Add a little credit and set a spend limit on the key.

**Why not a "Sign in with Claude" button in the web page itself?** Anthropic provides account sign-in for Claude Code and its own apps, and asks other apps to use API keys. So the page never touches your sign-in token: the real Claude Code does the signing in, on your machine. For anything shared, hosted or commercial, use an API key.

With Claude connected, Studio can:

- **Import a reel** as a script written in your own words.
- **Direct the video:** per-scene icons and highlighted words, plus the style, pace and effects.
- **Make one like this:** study a high-performing reel and write a new script on your topic with the same structure and original wording.

## Voice-over

Studio's **Voice-over** panel has three sources. Edge and ElevenLabs speak **each script line separately**, so every scene is exactly as long as its line and the captions stay in sync. I checked this in the recorded file: speech starts at each scene's start and is silent at its end.

- **Edge voice (free).** Microsoft's neural read-aloud voices (318 voices, 140+ languages and regions) through the helper, using the open-source `edge-tts` package. Pick a voice and speed. These voices are **unofficial**: Microsoft publishes no public API for them, so they could change or stop working, and quality and limits are not guaranteed.
- **ElevenLabs.** Add your ElevenLabs API key (Connect Claude dialog, _Voice_ section), pick one of your account's voices and a model, and generate. It uses your plan's credits (about one per character). The key stays in this browser.
- **Upload.** Your own recording (MP3, WAV or M4A); the scenes are scaled to its length.

Every generated voice-over has a player and a WAV download.

## The helper (`bridge/`)

`./bridge/start.sh` runs `bridge/server.py`, a small program that stays on your computer. It serves the app and adds Claude through your Claude Code (text and images), Edge speech, reel video analysis (frames and speech-to-text) and a status check for each. Optional packages are installed into `bridge/.venv`, never your system Python. It is locked down: it listens on `127.0.0.1` only; it refuses requests whose Host or Origin isn't this app; it needs a random token that changes every time it starts; and it serves only the app's own files (not `bridge/`, `tests/`, `.git` or dotfiles). `python3 tests/helper_check.py` checks all of this with a stand-in for Claude Code, without touching your real account.

## Instagram insights (sign in with Composio)

Insights reads your Instagram professional account through [Composio](https://composio.dev), signed in the same way you sign in to Claude: **no API key and no secret**. It is read-only: Studio only asks Composio to run four Instagram _read_ tools (profile, media, account insights, media insights), never posts, and never sees an Instagram password or token.

1. The account must be a **Business or Creator** account.
2. Click **Connect Instagram → Sign in with Composio**. Composio's own page opens (sign in or create a free account) and sends you straight back. This is a standard OAuth 2.1 sign-in with PKCE; Studio registers itself as a public client, so there is no secret to store.
3. Press **Connect Instagram**. Composio opens Instagram's own sign-in. Then press **Check again**.

Your Composio sign-in token stays in this browser (`localStorage`); **Sign out** removes it. Composio's sign-in server doesn't let browsers read its replies, so the two sign-in calls (register this site, exchange the code for a token) go through a tiny relay: `worker.js` when deployed, the helper on your computer. It holds no key or secret and only forwards a fixed set of fields to Composio. After that, Studio talks to Composio's MCP server (`connect.composio.dev/mcp`) directly from the browser, with your token. Every Instagram account connected in Composio is listed; pick one with **Use**, or view all together in Insights (each call names its account, so several accounts work).

What you get: views, accounts reached, new followers and interactions **compared with the previous period**, follower growth (and the change since you connected, from snapshots saved each time you refresh), the follower / non-follower split, a posting streak, top reels with thumbnails, **carousel** reach, saves and shares, and per-reel likes, comments, shares, saves and reach.

- Instagram limits these windows to **30 days**, so the ranges are 7, 14 and 30 days.
- Some metrics aren't available under 100 followers. Anything Instagram refuses is listed as _metrics unavailable_.
- Posting to Instagram from here is not included.

## Deploying to Cloudflare

`wrangler.jsonc` serves the app as static assets and runs `worker.js` for `/api/oauth/*` (the sign-in relay). There are no secrets to set. `.assetsignore` keeps `bridge/`, `tests/`, `reference/` and the screenshots out of the public files.

```bash
npx wrangler deploy
```

What works on the deployed site, and what needs your computer:

| Feature                             | Deployed                                                                                       | Local helper                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| Render videos (MP4/WebM, 9:16)      | Yes, in your browser                                                                           | Yes                             |
| Templates, formats, effects         | Yes                                                                                            | Yes                             |
| Claude (scripts, direction, vision) | Sign in with Claude **through your own computer** (pair with the helper, below), or an API key | Sign in with Claude, or API key |
| Watch a reel video                  | Yes: frames cut in the browser (no speech-to-text)                                             | ffmpeg frames + speech-to-text  |
| Voice-over                          | ElevenLabs key                                                                                 | Edge voices or ElevenLabs       |
| Instagram insights                  | Yes: sign in with Composio                                                                     | Yes: sign in with Composio      |

### Sign in with Claude on the deployed site

A website can't sign in to Claude by itself: Anthropic's sign-in is for Claude Code and its own apps, and a hosted page must use an API key. What does work is your own Claude Code on your own computer, reached through the helper:

1. On your computer, in the project folder: `./bridge/start.sh --allow https://your-site.workers.dev` (once; the site is remembered in `bridge/.sites`).
2. The helper prints a **pairing code**. Open the deployed site, go to **Claude → Sign in**, enter the code and press **Pair**.
3. Claude Code, Edge voices, ffmpeg frames and speech-to-text now work from the deployed site, using your Claude plan. No API key.

Safety: only sites you allow can reach the helper; a site gets no token until you enter the code (a new random code every time the helper starts, five wrong tries lock it); everything else still needs that token; and the helper still listens on `127.0.0.1` only. The token lives in that tab's `sessionStorage`. It needs the helper running whenever you use it, and it works in Chrome, Edge and Firefox (Chrome may ask to allow access to devices on your network); Safari blocks a secure page from reaching the helper. With no helper, use an API key.

## Effects and credits

Studio has a **Film look** row (1-bit dither, halftone, risograph, pixel mosaic, thermal camera, duotone, X-ray), 12 caption, 11 transition, 10 camera and 11 particle styles, 12 on/off screen effects and 14 one-click presets (Dreamy, Retro VHS, Epic, Silent Film, Zine, Terminal, Pop Print, 1-bit, Thermal and more).

Motion styles worth knowing: **Stamp** (slams in with a shake), **Slice** (a word closes from two halves), **Scramble** (decodes from random glyphs), **Spring** (overshoots and settles), **Wave**, **Blur**, **Flip**; transitions **Iris**, **Whip**, **Burn**, **Wipe**, **Spin**, **Blinds**; cameras **Handheld**, **Dutch tilt**, **Breathe**, **Orbit**; particles **Matrix rain**, **Dust**, **Flow lines**, **Embers**, **Snow**, **Rain**, **Stars**.

Where it comes from:

- The **film looks** (`post.js`) and the new motions are my own implementations of techniques seen in the film styles of [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar) by Lemomo (LemoLab); no code from it is used in them.
- **CRT screen** and **VHS tape** (`crt.js`) and the **Spring** caption and **Handheld** camera helpers are adapted from that project's MIT-licensed code (`core/post/crt.js`, `core/lib.js`). If WebGL2 isn't available the CRT, VHS and film-look passes switch themselves off. Its docs and style prompts are CC BY-NC and are not included. See `THIRD_PARTY.md`.

## Video formats and templates

Pick **What kind of video?** (Faceless, Comic & cartoon, Explainer, Cinematic, News & editorial, Collage & craft, Retro & neon) in Discover, the importer or Studio. It narrows the template list, and Claude only chooses a template from that format.

Templates live in `THEMES` in `video.js`. Add one with a single line, for example `T("Name", background, text, accent, second accent, "orbs", { look: "hud", face: ["700", MONO] })`. A template with a `look` gets its own decoration (frames, tickers, stamps, tape and so on); add a `case` for it in `drawLook()`. List it under one or more formats in `FORMATS`. Included looks: Minimal, Luxury, Brutalist, Collage, Watercolour, Newsroom, Sci-fi HUD and Vaporwave. Each one has its own centrepiece (a live countdown clock, stamp, window or card), and numbers in a scene ("312 sign-ups at $29") become stat tiles styled for that template.

## Learning from results

Studio learns which creative choices earn more, in a simple loop:

1. Make and post a video. On the **Calendar**, mark it posted and **link it to its live reel** (pick it from your accounts or paste the link).
2. Studio scores the reel by **engagement per view**, counting shares and saves more than likes, relative to your median reel. That score (0 to 100) is the reward.
3. The reward is credited to the choices you used: style, pace, caption animation and transition.
4. Studio suggests the best-scoring choices (**Use these** in Studio) and applies them automatically to scripts it generates from a reel. Untried options keep a small chance, so it keeps exploring.

Separately, **Insights → What's working in your hooks** compares your reels' first lines (a number, a question, "you", short, money, a problem) and shows how much more engagement each trait earned.

This is a bandit-style learning loop over a few choices, not a model that edits videos. It needs several linked posts before its suggestions mean much, and engagement depends on much more than style. _Reset_ clears it.

## Hand rendering to your own pipeline (optional)

Settings → paste an n8n / Make / Zapier / custom API URL. _Render video_ then POSTs:

```json
{
  "handle": "yourbrand",
  "title": "...",
  "duration": "0:27",
  "script": [{ "type": "hook|body|comment", "text": "..." }],
  "text": "full script",
  "wordCount": 70,
  "format": "9:16",
  "style": {
    "theme": "Neon",
    "pace": "Balanced",
    "effects": {
      "caption": "bounce",
      "transition": "flash",
      "camera": "shake",
      "particles": "confetti",
      "glow": true,
      "grain": false,
      "chroma": true,
      "motifs": true
    },
    "colors": { "bg": "#07000f", "fg": "#ffffff", "accent": "#ff2bd6" }
  },
  "scenes": [{ "motif": "chart", "emphasis": ["numbers"] }],
  "virality": 86,
  "createdAt": "ISO"
}
```

Your endpoint may answer with `{ "videoUrl": "https://..." }` (done), `{ "statusUrl": "https://..." }` (polled every 2 s for `{ "status", "progress": 0-100, "videoUrl" }`), or fail, in which case Studio renders in the browser. The endpoint must allow CORS from the page's origin.

## The virality score

A rule-based score out of 100, not a trained model. It starts at 100 and loses points for a hook that isn't first or takes over 3.5 s to say, no number or "you" in the hook, lines over 24 words, empty lines, no comment call-to-action, a length under 12 s or over 75 s, and no turn word ("instead", "but", "so"). Each fix is pinned to the second it applies to. Speaking speed is 2.2, 2.6 or 3.2 words per second for Calm, Balanced and Punchy.

## Files

- `index.html`, `styles.css`: the interface
- `app.js`: the six screens, dialogs and app logic
- `video.js`: the video engine (scene planner, animated renderer, effects, recorder, beat synthesizer)
- `instagram.js`: Composio sign-in (OAuth with PKCE) and the Instagram client
- `worker.js`, `wrangler.jsonc`, `.assetsignore`: the Cloudflare deployment and its Composio proxy
- `post.js`: the film-look shader (dither, halftone, riso, pixel, thermal, duotone, X-ray)
- `crt.js`, `THIRD_PARTY.md`: the CRT / VHS post-process adapted from Lemo-Opuscar (MIT) and its licence
- `frames.js`: cuts a video into key frames in the browser (used when the helper isn't running)
- `ai.js`: the Claude client (sign-in through the helper, or an API key)
- `voice.js`: voice-over generation (Edge, ElevenLabs), joining, WAV export
- `helper.js`: how the page talks to the helper
- `bridge/server.py`, `bridge/start.sh`: the helper
- `tools.js`: pure logic with no page code: link parsing, script splitting, paste handling, hook analysis and the learning loop
- `tests/tools.test.js`: unit tests for `tools.js`. Run `node tests/tools.test.js`
- `tests/helper_check.py`: checks the helper's security, sign-in plumbing and OAuth relay. Run `python3 tests/helper_check.py`
- `tests/helper.test.js`: checks how a deployed site pairs with the helper. Run `node tests/helper.test.js`
- `tests/worker.test.mjs`: checks the Worker's sign-in relay. Run `node tests/worker.test.mjs`
- `tests/instagram.test.js`: checks the Composio sign-in and Instagram client against a stand-in for Composio. Run `node tests/instagram.test.js`

Research on the reference landing page is on the [`rea-output` branch](../../tree/rea-output/2026-11-18-getripping-landing).
