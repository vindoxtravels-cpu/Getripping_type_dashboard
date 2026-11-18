# Reel Studio

A short-video workflow in six steps: **Discover → Scripts → Studio → Calendar → Insights → Remix**.
It makes real video files in your browser and reads real numbers from your Instagram professional account.

Static site: no build step and no dependencies. Serve the folder and open it:

```bash
python3 -m http.server 5174
```

Everything you create is stored in the browser (`localStorage`). On a phone, use *Add to Home Screen* to run it like an app.

## The six steps

| Step | What you do |
|---|---|
| **Discover** | Drag a reel right to save it or left to skip it (or press → and ←). See why it works, add your own reels, then draft a script from a saved one. |
| **Scripts** | A library of scripts with a hook, body lines and a comment call-to-action. A scene timeline, checks and a virality score update as you type. |
| **Studio** | Pick one of 25 styles and a pace, optionally upload a voice-over, and **render a real video**. |
| **Calendar** | Week view. Schedule a video to the feed or as a trial reel, change its date and time, and mark it posted. |
| **Insights** | Live numbers from your Instagram account once connected (sample data until then). |
| **Remix** | The best posted video becomes a carousel (PNG export, 1080×1350) and a batch of new hooks. |

## Video generation

Studio draws every frame itself (animated backgrounds, word-by-word kinetic captions, a scene label, a progress bar, a call-to-action chip) and records them with the browser's `MediaRecorder`.

- The live preview and the file come from the same renderer, so they match.
- Output is **720×1280 (9:16), 30 fps**. You get **MP4** in Chrome, Edge and Safari, and **WebM** in browsers that can't record MP4. For WebM, convert for Instagram with:
  `ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -c:a aac out.mp4`
- **Rendering runs in real time.** A 30-second reel takes about 30 seconds, and the tab must stay open.
- **Audio:** a synthesized background beat (switch it off if you like) and, optionally, your own voice-over (MP3, WAV or M4A). With a voice-over, the scenes are re-timed to its length.
- **There is no text-to-speech.** Browsers cannot capture their own speech engine, so for an AI voice use the webhook below.
- Rendered videos live in the tab. Download the file to keep it.

### Hand rendering to your own pipeline (optional)

Studio → ⚙ Settings → paste an n8n / Make / Zapier / custom API URL. *Render video* then POSTs:

```json
{ "handle": "yourbrand", "title": "...", "duration": "0:27",
  "script": [{"type":"hook|body|comment","text":"..."}],
  "text": "full script", "wordCount": 70, "format": "9:16",
  "style": { "theme": "Neon", "pace": "Balanced",
             "colors": { "bg": "#07000f", "fg": "#ffffff", "accent": "#ff2bd6" } },
  "virality": 86, "createdAt": "ISO" }
```

Your endpoint may answer with `{ "videoUrl": "https://..." }` (done), `{ "statusUrl": "https://..." }`
(polled every 2 s for `{ "status", "progress": 0-100, "videoUrl" }`), or fail, in which case Studio renders in the browser instead.
The endpoint must allow CORS from the page's origin.

## Connect your Instagram account

Insights reads your own account through Meta's official **Instagram API**. It is read-only: the page never posts or changes anything.

1. Your Instagram account must be a **Business or Creator** (professional) account.
2. At [developers.facebook.com](https://developers.facebook.com) create an app (type *Business*) and add the **Instagram** product.
3. Under *API setup with Instagram login*, add your account and click **Generate token**. Allow `instagram_business_basic` and `instagram_business_manage_insights`.
4. In Reel Studio click **Connect Instagram** and paste the token. (Facebook Login also works; it needs your Instagram user ID.)

What you get: views, accounts reached, new followers, interactions, follower growth, the follower / non-follower split, a posting calendar and streak, your top reels with thumbnails, and per-reel likes, comments, shares, saves, reach and average watch time.

Things to know:
- Your token is sent only from your browser to Meta. It stays in `sessionStorage` (cleared when the tab closes) unless you tick *Remember on this device*. Anyone with the token can read your insights, so don't remember it on a shared computer. **Disconnect** deletes it.
- Meta limits these insight windows to **30 days**, so the ranges are 7, 14 and 30 days.
- Some metrics are not available on accounts under 100 followers. Anything Meta refuses is listed under *metrics unavailable* instead of breaking the page.
- Tokens expire (about 60 days for long-lived ones). When that happens the page says so and offers *Reconnect*.
- The Graph API has no per-minute "views since posting" curve, so the live reel breakdown shows lifetime numbers instead.
- Posting to Instagram from here is not included: Meta's publishing API needs a public video URL and app review.

## The virality score

A rule-based score out of 100, not a trained model. It starts at 100 and loses points for a hook that isn't first or takes over 3.5 s to say, no number or "you" in the hook, lines over 24 words, empty lines, no comment call-to-action, a total length under 12 s or over 75 s, and no turn word ("instead", "but", "so"). Each fix is pinned to the second it applies to. Speaking speed is 2.2, 2.6 or 3.2 words per second for Calm, Balanced and Punchy.

## Files

- `index.html`, `styles.css`: the interface
- `app.js`: the six screens and app logic
- `video.js`: the video engine (scene planner, animated renderer, recorder, beat synthesizer)
- `instagram.js`: the Instagram client

Research on the reference landing page is on the [`rea-output` branch](../../tree/rea-output/2026-11-18-getripping-landing).
