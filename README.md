# Reel Studio: short-form video workflow dashboard

Six-stage workflow: **Swipe → Script → Produce → Post → Analyze → Repurpose**.
Static site with no build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 5174
```

Everything is stored in the browser (`localStorage`). Settings → *Reset all data* clears it.
On a phone, open the page and use *Add to Home Screen*; it runs full-screen like an app.

## What each tab does

| Tab | What you can do |
|---|---|
| **My Feed** | Swipe reels (♥ save, ✕ skip, ↶ undo), see *why it works*, add your own reels with **+ Add reel**, then **ReVoice** a saved reel into a script. |
| **Scripts** | A library of scripts. Edit the hook, body lines and comment call-to-action. Live checks, an estimated duration and a virality score update as you type. |
| **Production** | Pick a format (Basic Motion, Presenter, Talking head) and one of 25 visual styles, then **Generate video**. The virality score lists each fix with the second it applies to. **Schedule post** once it's rendered. |
| **Calendar** | A week view with ‹ › navigation. Schedule onto any day (+), switch Feed or Trial reel, change the date and time, use **Post now** or remove a post. |
| **Analytics** | Account overview plus per-video stats for anything you've posted. These are sample numbers until real insights are wired in. |
| **Carousels** | The best posted video becomes the winner. Its script becomes a carousel; **Download PNGs** exports 1080×1350 slides in the video's style. New hooks turn into new scripts in one click. |

## Automate video generation

Production → ⚙ Webhook → paste your n8n / Make / Zapier / custom API URL.
"Generate video" POSTs JSON:

```json
{ "handle": "yourbrand", "title": "...", "duration": "0:27",
  "script": [{"type":"hook|body|comment","text":"..."}],
  "text": "full script", "wordCount": 70, "format": "9:16",
  "style": { "format": "Basic Motion", "theme": "Neon",
             "colors": { "bg": "#07000f", "fg": "#ffffff", "accent": "#ff2bd6" } },
  "virality": 86, "createdAt": "ISO" }
```

Your endpoint may respond with any of:
- `{ "videoUrl": "https://..." }`: finished immediately
- `{ "statusUrl": "https://..." }`: the dashboard polls it every 2 s for `{ "status", "progress": 0-100, "videoUrl" }`
- nothing, or an error: the built-in simulation runs instead

The endpoint must allow CORS from the dashboard's origin.

## Virality score

This is a heuristic, not a model. It starts at 100 and subtracts points for:
- a hook that isn't first or takes more than 3.5 s to say
- no number or "you" in the hook
- lines over 24 words, and empty lines
- no comment call-to-action
- a total length under 12 s or over 75 s
- no turn word ("instead", "but", "so")

Timings assume 2.6 spoken words per second.

## Research

The REA analysis of the reference landing page is on the
[`rea-output` branch](../../tree/rea-output/2026-11-18-getripping-landing).
Reference screenshots are in `reference/`.
