# getripping.com landing page: REA analysis

**Date:** 2026-11-18
**Target:** saved copy of the public landing page at https://www.getripping.com/ (HTML plus 34 JavaScript bundles and 3 stylesheets, 7.5 MB)
**Tool:** REA 6.9.0, `analyze-javascript-application` (static analysis; nothing was executed)
**Evidence:** [`evidence/js-analysis-summary.json`](evidence/js-analysis-summary.json). The full evidence bundle was 126 MB, which is over GitHub's file limit, so it was not committed.

## Why not Ghidra

Ghidra decompiles native machine code (Mach-O, ELF, PE). This target is a
web app shipped as minified JavaScript, so REA's JavaScript analyzer is the
right tool. Ghidra has nothing to load here.

## Stack

| Layer | Found | How |
|---|---|---|
| Framework | Next.js, built with Turbopack | `turbopack-*.js` chunk and Next.js runtime error links |
| UI runtime | React 19.3 canary (`19.3.0-canary-cbb046ab-20260731`) | version string in bundles |
| Backend | Supabase (auth, storage, realtime), supabase-js 2.116.0 | project URL `vghovaaqnzyngmteyine.supabase.co` and the client library |
| Payments | Stripe (Payment Element) | `stripe.js` and Stripe docs links |
| Monitoring | Sentry, PostHog | library strings |
| Icons | Lucide | library strings |

## Server routes referenced by the page

All of them are for accounts, billing or waitlists. None are for video generation:

```
/api/auth/signup            /api/auth/verify-code       /api/auth/resend-verification
/api/auth/signed-in         /api/auth/agree
/api/billing/subscribe      /api/billing/lifetime
/api/join/account           /api/join/early-access      /api/join/launch     /api/join/sales
/api/errors                 /api/index-design
```

App routes that are linked: `/dashboard`, `/apply`.

## What the product does (from the page)

A six-stage short-form video workflow. The page shows it as an animated demo
of a dashboard with six tabs:

1. **Swipe** (My Feed): swipe through reels doing well in your niche, save them and see "why it works" tags.
2. **Script** (Scripts): turn a saved reel into your own script (hook, body lines, comment call-to-action) with automatic checks.
3. **Produce** (Production): script, voice, visuals, edit and render into a finished 9:16 reel in a chosen **style**.
4. **Post** (Calendar): schedule to the feed or as a trial reel.
5. **Analyze** (Analytics): account KPIs, follower growth, audience split, posting streak, top reels and per-video stats.
6. **Repurpose** (Carousels): turn winners into carousels and new hooks.

Other features described on the page:

- **Styles:** 25 visual themes (Neon, Comic book, Blueprint and others) plus custom styles with dials for elements, theme, pace and text density.
- **Virality score:** scores a finished reel out of 100 and pins fixes to specific seconds.
- **Mobile:** an installable web app (PWA) with Research, Production, Analytics and Settings.
- The heavy work (scripting, video) runs through the user's own **Claude Code**. The site supplies the data, studio UI and posting.

## Limits of this analysis

- Only the public landing page was analyzed. The logged-in `/dashboard` is
  not in the saved files, so the real dashboard's code, data model and
  video pipeline were **not** observed. The six-tab UI is known only from the
  landing-page demo and screenshots.
- REA kept static and module facts for 25 large bundles, but their full
  semantic graphs were over its result budget (see `limitations` in the evidence).
- No network traffic was captured. A HAR capture of a signed-in session would
  be needed to learn the real API.
