# Get Ripping – Video Automation Dashboard

Six-stage workflow: **Swipe → Script → Produce → Post → Analyze → Repurpose**.
Static site, no build step. Open `index.html` (or `npx serve .`).

## Automate video generation
Produce tab → ⚙ Webhook → paste your n8n / Make / Zapier / custom API URL.
"Generate video" POSTs JSON:

```json
{ "handle": "getripping", "title": "...", "duration": "1:01",
  "script": [{"type":"hook|body|comment","text":"..."}],
  "text": "full script", "wordCount": 120, "format": "9:16", "createdAt": "ISO" }
```

Your endpoint may respond with any of:
- `{ "videoUrl": "https://..." }` – finished immediately
- `{ "statusUrl": "https://..." }` – dashboard polls every 2 s for `{ "status", "progress": 0-100, "videoUrl" }`
- nothing / error – built-in simulation runs instead

The endpoint must allow CORS from the dashboard origin.

## Reverse-engineering with REA
Reference UI lives in `reference/`. To analyze a live site or capture with
[REA](https://github.com/morluto/rea): `npx rea-agents setup`, restart your agent, then ask it to
analyze the target URL or a saved network capture.
