/* Reel Studio video engine.
 * One canvas renderer draws every frame, so the live preview and the recorded file always match.
 * record() captures the canvas (and an optional voice-over + synthesized beat) with MediaRecorder.
 */
(() => {
  "use strict";
  const W = 720,
    H = 1280;
  const FONT = 'Inter, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  /* name, background, text, accent, second accent, motion style */
  const T = (name, bg, fg, ac, ac2, style, extra) =>
    Object.assign({ name, bg, fg, ac, ac2, style }, extra || {});
  /* Templates add a "look" (drawn decoration) and optionally a typeface. To add a template: append a T(...) line and,
   * if it needs its own decoration, a case in drawLook(). */
  const SERIF = 'Georgia, "Times New Roman", serif';
  const MONO = '"SF Mono", Menlo, Consolas, monospace';
  const THEMES = [
    T("Minimal", "#f6f6f3", "#161616", "#e4572e", "#161616", "dots", {
      look: "minimal",
    }),
    T("Glass", "#0f0c29", "#ffffff", "#8b5cf6", "#22d3ee", "orbs", {
      look: "glass",
    }),
    T("Terminal", "#010409", "#c9d1d9", "#3fb950", "#58a6ff", "grid", {
      look: "term",
      face: ["700", MONO],
    }),
    T("Sticky Notes", "#f4efe6", "#2b2b2b", "#e8590c", "#ff9aa2", "dots", {
      look: "notes",
      face: ["800", '"Bradley Hand", "Comic Sans MS", "Segoe Print", cursive'],
    }),
    T("Aurora", "#0b0b1a", "#ffffff", "#8b5cf6", "#22d3ee", "orbs"),
    T("Software / SaaS", "#0b1020", "#ffffff", "#3b5bff", "#22d3ee", "grid"),
    T("Neon", "#07000f", "#ffffff", "#ff2bd6", "#22d3ee", "scan", {
      look: "neon",
    }),
    T("Sci-fi HUD", "#020b12", "#bff7ff", "#00b8d4", "#7cffcb", "grid", {
      look: "hud",
      face: ["700", MONO],
    }),
    T("Comic book", "#fff3c4", "#111111", "#e5372b", "#2563eb", "dots", {
      look: "comic",
      face: ["900", FONT],
    }),
    T("Blueprint", "#0b3b8c", "#ffffff", "#4aa8ff", "#ffffff", "grid"),
    T("Retro 80s", "#1a0633", "#ffffff", "#ff7a00", "#ff2bd6", "rays"),
    T("Chalkboard", "#1f2b24", "#f1f1e6", "#c9a400", "#9be3b6", "dots"),
    T("Whiteboard", "#fafafa", "#1b1b1b", "#2563eb", "#e11d48", "waves"),
    T("Pixel art", "#14141f", "#ffffff", "#22c55e", "#f59e0b", "confetti"),
    T("Claymation", "#f3d9c4", "#3b2416", "#c2410c", "#2563eb", "orbs"),
    T("Paper cutouts", "#efe6d6", "#2a2118", "#c0392b", "#0f766e", "confetti"),
    T(
      "Markers and pencils",
      "#fffdf6",
      "#222222",
      "#ea580c",
      "#2563eb",
      "waves",
    ),
    T("Editorial", "#f4f1ea", "#111111", "#b91c1c", "#111111", "dots"),
    T("Glossy 3D", "#0d1b2a", "#ffffff", "#0ea5e9", "#a78bfa", "orbs"),
    T("Cinematic 3D", "#050505", "#f5f5f5", "#d97706", "#ef4444", "rays"),
    T("Luxury", "#0c0a08", "#f3e7c9", "#c9a227", "#f3e7c9", "rays", {
      look: "luxury",
      face: ["italic 600", SERIF],
    }),
    T("Brutalist", "#ffffff", "#000000", "#ffe500", "#2b4bff", "scan", {
      look: "brutal",
      face: ["900", FONT],
    }),
    T("Collage", "#d8b98f", "#1e1e1e", "#f5c518", "#e11d48", "confetti", {
      look: "collage",
      face: ["800", SERIF],
    }),
    T("Watercolour", "#f6f1fb", "#2d2340", "#8b5cf6", "#f472b6", "orbs", {
      look: "wash",
      face: ["italic 500", SERIF],
    }),
    T("Newsroom", "#0f172a", "#ffffff", "#dc2626", "#f8fafc", "scan", {
      look: "news",
      face: ["900", FONT],
    }),
    T("Vaporwave", "#2b0f3a", "#ffffff", "#14b8a6", "#f472b6", "waves", {
      look: "vapor",
      face: ["700", FONT],
    }),
    T("Hand-drawn", "#fbfaf5", "#222222", "#0284c7", "#f59e0b", "dots"),
    T("Cartoon", "#ffe8f0", "#1a1a1a", "#e11d48", "#2563eb", "confetti"),
    T("UI", "#f8fafc", "#0f172a", "#6366f1", "#ec4899", "grid"),
  ];
  const themeByName = (n) => THEMES.find((t) => t.name === n) || null;

  /* What kind of video you are making. Each format narrows the template list. */
  const FORMATS = [
    { id: "all", name: "All styles", hint: "Every template", themes: null },
    {
      id: "faceless",
      name: "Faceless",
      hint: "Text and motion only, no presenter",
      themes: [
        "Glass",
        "Terminal",
        "Minimal",
        "Aurora",
        "Software / SaaS",
        "Neon",
        "Glossy 3D",
        "Cinematic 3D",
        "Sci-fi HUD",
        "Luxury",
        "UI",
        "Editorial",
      ],
    },
    {
      id: "comic",
      name: "Comic & cartoon",
      hint: "Bold, drawn and playful",
      themes: [
        "Comic book",
        "Cartoon",
        "Hand-drawn",
        "Markers and pencils",
        "Pixel art",
        "Claymation",
      ],
    },
    {
      id: "explainer",
      name: "Explainer",
      hint: "Teach one idea step by step",
      themes: [
        "Terminal",
        "Sticky Notes",
        "Whiteboard",
        "Blueprint",
        "Chalkboard",
        "Markers and pencils",
        "UI",
        "Software / SaaS",
        "Minimal",
      ],
    },
    {
      id: "cinematic",
      name: "Cinematic",
      hint: "Moody, premium, slow reveals",
      themes: [
        "Glass",
        "Cinematic 3D",
        "Luxury",
        "Glossy 3D",
        "Aurora",
        "Minimal",
      ],
    },
    {
      id: "news",
      name: "News & editorial",
      hint: "Headlines, tickers, hard type",
      themes: ["Newsroom", "Editorial", "Brutalist", "Minimal", "Blueprint"],
    },
    {
      id: "craft",
      name: "Collage & craft",
      hint: "Paper, paint and tape",
      themes: [
        "Sticky Notes",
        "Collage",
        "Paper cutouts",
        "Watercolour",
        "Claymation",
        "Hand-drawn",
        "Chalkboard",
      ],
    },
    {
      id: "retro",
      name: "Retro & neon",
      hint: "Arcade, synth and sci-fi",
      themes: ["Neon", "Retro 80s", "Vaporwave", "Sci-fi HUD", "Pixel art"],
    },
  ];
  const formatById = (id) => FORMATS.find((f) => f.id === id) || FORMATS[0];
  const themesFor = (id) => {
    const f = formatById(id);
    return f.themes
      ? f.themes.map(themeByName).filter(Boolean)
      : THEMES.slice();
  };

  /* ---------- effects ---------- */
  const DEFAULT_FX = {
    caption: "pop",
    transition: "ring",
    camera: "push",
    particles: "sparkles",
    glow: true,
    grain: false,
    chroma: false,
    motifs: true,
    vignette: false,
    scanlines: false,
    leak: false,
    bars: false,
    shine: false,
  };
  const FX_OPTIONS = {
    caption: [
      "pop",
      "type",
      "slide",
      "bounce",
      "glitch",
      "wave",
      "blur",
      "flip",
      "rise",
    ],
    transition: [
      "ring",
      "zoom",
      "slide",
      "flash",
      "glitch",
      "wipe",
      "spin",
      "blinds",
    ],
    camera: ["push", "drift", "shake", "still", "zoomout", "orbit", "pulse"],
    particles: [
      "none",
      "sparkles",
      "confetti",
      "bokeh",
      "rain",
      "snow",
      "stars",
      "embers",
    ],
  };
  /* on/off effects layered over the picture */
  const SWITCHES = [
    ["motifs", "Scene icons"],
    ["glow", "Glow"],
    ["chroma", "Color fringe"],
    ["grain", "Film grain"],
    ["vignette", "Vignette"],
    ["scanlines", "Scan lines"],
    ["leak", "Light leak"],
    ["shine", "Shine sweep"],
    ["bars", "Cinema bars"],
  ];
  const OFF = {
    glow: false,
    grain: false,
    chroma: false,
    motifs: true,
    vignette: false,
    scanlines: false,
    leak: false,
    bars: false,
    shine: false,
  };
  const PRESETS = {
    Clean: Object.assign({}, OFF, {
      caption: "pop",
      transition: "zoom",
      camera: "still",
      particles: "none",
    }),
    Hype: Object.assign({}, OFF, {
      caption: "bounce",
      transition: "flash",
      camera: "shake",
      particles: "confetti",
      glow: true,
      chroma: true,
      shine: true,
    }),
    Cinematic: Object.assign({}, OFF, {
      caption: "type",
      transition: "slide",
      camera: "drift",
      particles: "bokeh",
      glow: true,
      grain: true,
      motifs: false,
    }),
    Glitch: Object.assign({}, OFF, {
      caption: "glitch",
      transition: "glitch",
      camera: "shake",
      particles: "sparkles",
      glow: true,
      grain: true,
      chroma: true,
    }),
    Dreamy: Object.assign({}, OFF, {
      caption: "blur",
      transition: "spin",
      camera: "orbit",
      particles: "bokeh",
      glow: true,
      vignette: true,
      leak: true,
    }),
    "Retro VHS": Object.assign({}, OFF, {
      caption: "wave",
      transition: "blinds",
      camera: "pulse",
      particles: "stars",
      glow: true,
      grain: true,
      chroma: true,
      scanlines: true,
    }),
    Epic: Object.assign({}, OFF, {
      caption: "flip",
      transition: "wipe",
      camera: "zoomout",
      particles: "embers",
      glow: true,
      vignette: true,
      bars: true,
      shine: true,
    }),
    Winter: Object.assign({}, OFF, {
      caption: "rise",
      transition: "wipe",
      camera: "drift",
      particles: "snow",
      vignette: true,
      leak: true,
    }),
  };
  const MOTIFS = [
    "chart",
    "coin",
    "flame",
    "bolt",
    "target",
    "clock",
    "heart",
    "check",
  ];
  const MOTIF_WORDS = [
    [
      "coin",
      /money|\$|cash|price|pricing|paid|pay|profit|cost|dollar|income|revenue|budget|free|expensive|cheap/i,
    ],
    [
      "chart",
      /grow|growth|scale|sales|mrr|users|traffic|views|followers|numbers|data|increase|results|double|triple/i,
    ],
    ["flame", /fire|viral|hot|trend|burn|winning|best|killing|obsessed/i],
    [
      "bolt",
      /fast|instant|quick|speed|minutes|automat|\bai\b|agent|powerful|boost/i,
    ],
    [
      "target",
      /goal|niche|audience|focus|target|customers?|competitor|strategy|aim/i,
    ],
    [
      "clock",
      /time|hour|day|week|month|year|deadline|today|tomorrow|later|wait/i,
    ],
    ["heart", /love|favorite|fans|community|loyal|care|trust|enjoy/i],
    [
      "check",
      /do this|fix|solution|works|proof|instead|steps?|simple|easy|here's/i,
    ],
  ];
  function autoMotif(text, type) {
    if (type === "comment" || type === "outro") return null;
    const hit = MOTIF_WORDS.find(([, re]) => re.test(text));
    if (hit) return hit[0];
    return type === "hook" ? "flame" : null;
  }

  /* ---------- helpers ---------- */
  let HAS_LOOK = false;
  let FACE = ["800", FONT];
  const faceFont = (size) => `${FACE[0]} ${size}px ${FACE[1]}`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const easeOutBack = (x) => {
    const c1 = 1.70158,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const easeOutBounce = (x) => {
    const n = 7.5625,
      d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };
  const frac = (x) => x - Math.floor(x);
  const rnd = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const rgb = (hex) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const rgba = (hex, a) => {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  const lum = (hex) => {
    const [r, g, b] = rgb(hex).map((v) => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const words = (t) => String(t).trim().match(/\S+/g) || [];
  const hashStr = (s) => {
    let h = 7;
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
    return h || 1;
  };
  const wordKey = (w) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  function strokePoly(ctx, pts, prog) {
    let total = 0;
    for (let i = 1; i < pts.length; i++)
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let left = total * prog;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let end = pts[0];
    for (let i = 1; i < pts.length && left > 0; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        len = Math.hypot(bx - ax, by - ay),
        k = Math.min(1, left / len);
      end = [ax + (bx - ax) * k, ay + (by - ay) * k];
      ctx.lineTo(end[0], end[1]);
      left -= len;
    }
    ctx.stroke();
    return end;
  }

  /* ---------- plan: turn a script into timed scenes ---------- */
  function plan(sc, o = {}) {
    const theme = themeByName(sc.style && sc.style.theme) || THEMES[0];
    const fx = Object.assign({}, DEFAULT_FX, (sc.style && sc.style.fx) || {});
    const wps = o.wps || 2.6,
      dir = Array.isArray(sc.dir) ? sc.dir : [];
    const blocks = sc.blocks
      .map((b, i) => ({ type: b.type, text: b.text, i }))
      .filter((b) => b.text.trim());
    let scenes = blocks.map((b) => {
      const ws = words(b.text),
        d = dir[b.i] || {};
      const motif = fx.motifs
        ? MOTIFS.includes(d.motif)
          ? d.motif
          : d.motif === "none"
            ? null
            : autoMotif(b.text, b.type)
        : null;
      return {
        type: b.type,
        text: b.text.trim(),
        ws,
        dur: Math.max(1.5, ws.length / wps + 0.5),
        motif,
        emph: new Set((d.emphasis || []).map((x) => wordKey(String(x)))),
      };
    });
    if (!scenes.length) {
      const t = sc.title || "Your idea";
      scenes = [
        {
          type: "hook",
          text: t,
          ws: words(t),
          dur: 2.5,
          motif: fx.motifs ? "flame" : null,
          emph: new Set(),
        },
      ];
    }
    if (o.sceneDurations && o.sceneDurations.length === scenes.length)
      scenes.forEach((s, i) => {
        s.dur = Math.max(1, o.sceneDurations[i]);
      }); // timed to the real speech
    else {
      const base = scenes.reduce((a, s) => a + s.dur, 0);
      const target = o.audioDuration
          ? Math.max(o.audioDuration, 1)
          : base * 1.04,
        k = target / base;
      scenes.forEach((s) => {
        s.dur *= k;
      });
    }
    const handle = o.handle || "yourbrand";
    scenes.push({
      type: "outro",
      text: `Follow @${handle}`,
      ws: words(`Follow @${handle}`),
      dur: 1.5,
      motif: null,
      emph: new Set(),
    });
    let t = 0,
      bodyN = 0;
    scenes.forEach((s, i) => {
      s.index = i;
      s.start = t;
      t += s.dur;
      if (s.type === "body") s.n = ++bodyN;
      const lead = 0.1,
        tail = s.type === "outro" ? 0.25 : 0.3,
        span = Math.max(0.4, s.dur - lead - tail);
      const chars = s.ws.map((w) => w.length + 2),
        sum = chars.reduce((a, c) => a + c, 0);
      let acc = 0;
      s.at = chars.map((c) => {
        const a = lead + (span * acc) / sum;
        acc += c;
        return a;
      });
      const m =
        s.type === "comment" &&
        s.text.match(/comment\s+["“”']?([A-Za-z0-9]+)/i);
      s.keyword = m ? m[1].toUpperCase() : null;
    });
    return {
      theme,
      fx,
      scenes,
      duration: t,
      handle,
      title: sc.title,
      seed: hashStr(sc.title),
    };
  }

  /* ---------- text layout (cached per scene) ---------- */
  function layout(ctx, s) {
    if (s.layout) return s.layout;
    const maxW = W - 130,
      maxH = s.motif ? 620 : 800,
      cy = s.motif || HAS_LOOK ? H * 0.58 : H * 0.46;
    let size = s.type === "hook" || s.type === "outro" ? 100 : 84,
      lines,
      lh,
      space;
    for (;;) {
      ctx.font = faceFont(size);
      space = ctx.measureText(" ").width;
      lines = [];
      let cur = [],
        curW = 0;
      s.ws.forEach((w, i) => {
        const ww = ctx.measureText(w).width;
        if (cur.length && curW + space + ww > maxW) {
          lines.push({ items: cur, w: curW });
          cur = [];
          curW = 0;
        }
        curW += (cur.length ? space : 0) + ww;
        cur.push({ i, w, ww });
      });
      if (cur.length) lines.push({ items: cur, w: curW });
      lh = size * 1.16;
      if ((lines.length * lh <= maxH && lines.length <= 9) || size <= 40) break;
      size -= 4;
    }
    const blockH = lines.length * lh,
      y0 = cy - blockH / 2 + size * 0.9;
    lines.forEach((ln, li) => {
      let x = (W - ln.w) / 2;
      ln.items.forEach((it) => {
        it.x = x;
        it.y = y0 + li * lh;
        x += it.ww + space;
      });
    });
    return (s.layout = { size, lh, lines, blockH, y0 });
  }

  /* ---------- animated backgrounds (all pure functions of time) ---------- */
  function drawBg(ctx, p, t, s) {
    const th = p.theme,
      light = lum(th.bg) > 0.6,
      tint = s.index % 2 ? th.ac2 : th.ac;
    ctx.fillStyle = th.bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const a = light ? 0.55 : 1;
    switch (th.style) {
      case "orbs":
        for (let k = 0; k < 3; k++) {
          const cx =
            W * (0.15 + 0.7 * frac(k * 0.37 + p.seed * 0.001)) +
            Math.sin(t * 0.45 + k * 2.1) * 130;
          const cy = H * (0.2 + 0.28 * k) + Math.cos(t * 0.38 + k) * 150,
            r = 520;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, rgba(k === 1 ? th.ac2 : tint, 0.5 * a));
          g.addColorStop(1, rgba(tint, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        break;
      case "grid":
        {
          ctx.strokeStyle = rgba(th.fg, 0.07);
          ctx.lineWidth = 1.5;
          const off = (t * 50) % 80;
          ctx.beginPath();
          for (let y = -80 + off; y < H; y += 80) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
          }
          for (let x = 0; x < W; x += 80) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
          }
          ctx.stroke();
          const g = ctx.createRadialGradient(
            W / 2,
            H * 0.95,
            0,
            W / 2,
            H * 0.95,
            720,
          );
          g.addColorStop(0, rgba(tint, 0.45 * a));
          g.addColorStop(1, rgba(tint, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        break;
      case "rays":
        ctx.save();
        ctx.translate(W / 2, H * 0.45);
        for (let i = 0; i < 14; i++) {
          const ang = (i * Math.PI * 2) / 14 + t * 0.15;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * 1700, Math.sin(ang) * 1700);
          ctx.lineTo(Math.cos(ang + 0.13) * 1700, Math.sin(ang + 0.13) * 1700);
          ctx.closePath();
          ctx.fillStyle = rgba(i % 2 ? th.ac2 : tint, 0.13 * a);
          ctx.fill();
        }
        ctx.restore();
        break;
      case "dots":
        for (let y = 24; y < H; y += 48)
          for (let x = 24; x < W; x += 48) {
            const r =
              3 + 6 * (0.5 + 0.5 * Math.sin(x * 0.012 + y * 0.009 - t * 1.7));
            ctx.fillStyle = rgba(tint, 0.2 * a);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 6.3);
            ctx.fill();
          }
        break;
      case "scan":
        {
          ctx.fillStyle = rgba(th.fg, 0.035);
          for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
          const by = ((t * 240) % (H + 260)) - 130,
            g = ctx.createLinearGradient(0, by - 130, 0, by + 130);
          g.addColorStop(0, rgba(tint, 0));
          g.addColorStop(0.5, rgba(tint, 0.22 * a));
          g.addColorStop(1, rgba(tint, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, by - 130, W, 260);
          const gl = Math.floor(t * 8);
          for (let k = 0; k < 4; k++) {
            const r = rnd(gl * 7 + k);
            if (r > 0.55) {
              ctx.fillStyle = rgba(th.ac2, 0.12 * a);
              ctx.fillRect(
                0,
                r * H,
                W * (0.2 + rnd(gl + k) * 0.6),
                10 + rnd(k + gl * 3) * 26,
              );
            }
          }
        }
        break;
      case "waves":
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 12)
            ctx.lineTo(
              x,
              H * 0.72 +
                k * 64 +
                Math.sin(x * 0.011 + t * 1.2 + k * 1.3) * (34 + k * 6),
            );
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fillStyle = rgba(k % 2 ? th.ac2 : tint, (0.12 + 0.04 * k) * a);
          ctx.fill();
        }
        break;
      case "confetti":
        for (let i = 0; i < 44; i++) {
          const sx = rnd(i + 1),
            sy = rnd(i + 50),
            sp = 40 + rnd(i + 90) * 90,
            size = 10 + rnd(i + 7) * 14;
          const x = sx * W + Math.sin(t * 0.8 + i) * 36,
            y = ((sy * H + t * sp) % (H + 80)) - 40;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(t * (rnd(i + 3) - 0.5) * 3 + i);
          ctx.fillStyle = rgba(
            i % 3 === 0 ? th.ac2 : i % 3 === 1 ? tint : th.fg,
            i % 3 === 2 ? 0.1 : 0.4 * a,
          );
          ctx.fillRect(-size / 2, -size / 4, size, size / 2);
          ctx.restore();
        }
        break;
    }
    const v = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.3,
      W / 2,
      H / 2,
      H * 0.75,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, light ? "rgba(0,0,0,.08)" : "rgba(0,0,0,.4)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- particles ---------- */
  /* ---------- template looks: decoration and a live countdown that give each template its look ---------- */
  /* Numbers in a scene's text become stat tiles: "312 sign-ups at $29 a month" → 312 SIGN-UPS, $29 A. */
  function statsOf(s) {
    if (s.stats) return s.stats;
    const out = [],
      re = /([$€£]?\d[\d,]*(?:\.\d+)?(?:\s?%|[kKmMx]\b)?)/g,
      skip = /^(a|an|the|of|per|in|to|and|for|at|on|is|are|was|by)$/i;
    let m;
    while ((m = re.exec(s.text)) && out.length < 3) {
      const rest = s.text
        .slice(m.index + m[1].length)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.replace(/[^A-Za-z-]/g, ""))
        .filter(Boolean);
      const lab = rest.find((w) => !skip.test(w)) || "";
      out.push({ v: m[1].trim(), l: lab.toUpperCase().slice(0, 10) });
    }
    return (s.stats = out);
  }
  const clockText = (sec) => {
    const n = Math.max(0, Math.ceil(sec));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  };
  function num(ctx, text, x, y, size, color, align, family, weight) {
    ctx.save();
    ctx.font = `${weight || "800"} ${size}px ${family || FONT}`;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function halftone(ctx, cx, cy, r, color, step) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.clip();
    ctx.fillStyle = color;
    for (let y = cy - r; y <= cy + r; y += step)
      for (let x = cx - r; x <= cx + r; x += step) {
        const d = Math.hypot(x - cx, y - cy) / r;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.4, (step / 2) * (1 - d * 0.6)), 0, 6.3);
        ctx.fill();
      }
    ctx.restore();
  }
  function ring(ctx, cx, cy, r, color, width, frac0) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * frac0);
    ctx.stroke();
    ctx.restore();
  }
  function label(ctx, text, x, y, size, color, align, font, spacing) {
    ctx.save();
    ctx.font = `700 ${size}px ${font || MONO}`;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    if (spacing && "letterSpacing" in ctx) ctx.letterSpacing = spacing + "px";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function ticker(ctx, text, y, h, t, bg, fg, size, speed) {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, W, h);
    ctx.beginPath();
    ctx.rect(0, y, W, h);
    ctx.clip();
    ctx.font = `700 ${size}px ${MONO}`;
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    const unit = text + "     ",
      w = ctx.measureText(unit).width || 1,
      off = (t * speed) % w;
    for (let x = -off; x < W; x += w) ctx.fillText(unit, x, y + h / 2);
    ctx.restore();
  }
  /* The decoration and centrepiece (a live countdown) that give each template its look. Drawn behind the words. */
  function drawLook(ctx, p, t, s) {
    const th = p.theme,
      look = th.look;
    if (!look) return;
    const n = p.scenes.length,
      idx = s.index,
      no =
        String(idx + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0"),
      handle = "@" + p.handle,
      left = p.duration - t,
      clock = clockText(left),
      done = clamp(t / p.duration),
      stats = statsOf(s),
      cx = W / 2,
      cy = 262;
    ctx.save();
    ctx.textAlign = "left";
    switch (look) {
      case "minimal": {
        num(ctx, clock, cx, cy, 190, rgba(th.fg, 0.92), "center", FONT, "200");
        label(
          ctx,
          "REMAINING",
          cx,
          cy + 112,
          20,
          rgba(th.fg, 0.45),
          "center",
          MONO,
          6,
        );
        ctx.fillStyle = th.ac;
        ctx.fillRect(cx - 28, cy + 134, 56, 5);
        label(ctx, no, 56, H - 150, 22, rgba(th.fg, 0.5), "left", MONO, 3);
        stats.forEach((st, i) => {
          const x = 56 + i * 210;
          ctx.fillStyle = rgba(th.fg, 0.15);
          ctx.fillRect(x, H - 330, 1.5, 90);
          num(ctx, st.v, x + 18, H - 300, 44, th.fg, "left", FONT, "300");
          label(
            ctx,
            st.l,
            x + 18,
            H - 252,
            16,
            rgba(th.fg, 0.5),
            "left",
            MONO,
            3,
          );
        });
        break;
      }
      case "luxury": {
        ctx.strokeStyle = rgba(th.ac, 0.85);
        ctx.lineWidth = 2;
        ctx.strokeRect(34, 34, W - 68, H - 68);
        ctx.strokeStyle = rgba(th.ac, 0.4);
        ctx.lineWidth = 1;
        ctx.strokeRect(50, 50, W - 100, H - 100);
        [
          [34, 34],
          [W - 34, 34],
          [34, H - 34],
          [W - 34, H - 34],
        ].forEach(([x, y]) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = th.ac;
          ctx.fillRect(-7, -7, 14, 14);
          ctx.restore();
        });
        label(
          ctx,
          "· EXCLUSIVE ·",
          cx,
          118,
          22,
          rgba(th.ac, 0.9),
          "center",
          SERIF,
          8,
        );
        /* gold clock face */
        const r = 104;
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
        g.addColorStop(0, "#1a1408");
        g.addColorStop(1, "#0c0a08");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.3);
        ctx.fill();
        ring(ctx, cx, cy, r, th.ac, 4, 1);
        ring(ctx, cx, cy, r - 12, rgba(th.ac, 0.4), 1.5, 1);
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * 6.2832,
            l = i % 5 ? 6 : 14;
          ctx.strokeStyle = rgba(th.ac, i % 5 ? 0.5 : 0.95);
          ctx.lineWidth = i % 5 ? 1 : 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.sin(a) * (r - 14), cy - Math.cos(a) * (r - 14));
          ctx.lineTo(
            cx + Math.sin(a) * (r - 14 - l),
            cy - Math.cos(a) * (r - 14 - l),
          );
          ctx.stroke();
        }
        ring(ctx, cx, cy, r - 6, "#d94b3d", 5, 1 - done);
        num(ctx, clock, cx, cy - 4, 56, th.fg, "center", SERIF, "italic 600");
        label(
          ctx,
          "MINUTES",
          cx,
          cy + 34,
          14,
          rgba(th.ac, 0.85),
          "center",
          SERIF,
          5,
        );
        if (idx > 0) {
          ctx.fillStyle = "#b3261e";
          ctx.beginPath();
          ctx.arc(W - 120, cy + 70, 34, 0, 6.3);
          ctx.fill();
          ctx.strokeStyle = "#f3e7c9";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(W - 136, cy + 70);
          ctx.lineTo(W - 124, cy + 82);
          ctx.lineTo(W - 102, cy + 56);
          ctx.stroke();
        }
        stats.forEach((st, i) => {
          const y = H - 320 + i * 44;
          ctx.strokeStyle = rgba(th.ac, 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(110, y + 12);
          ctx.lineTo(W - 110, y + 12);
          ctx.stroke();
          label(
            ctx,
            st.l || "FIGURE",
            110,
            y,
            22,
            rgba(th.fg, 0.75),
            "left",
            SERIF,
            3,
          );
          label(ctx, st.v, W - 110, y, 28, th.ac, "right", SERIF, 1);
        });
        break;
      }
      case "brutal": {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, 14);
        ctx.fillRect(0, H - 14, W, 14);
        ctx.fillRect(0, 0, 14, H);
        ctx.fillRect(W - 14, 0, 14, H);
        ticker(
          ctx,
          `IDEA_${String(idx + 1).padStart(2, "0")}.TXT /// LIVE TEST /// ${handle.toUpperCase()} ///`,
          14,
          36,
          t,
          th.ac2,
          "#fff",
          18,
          60,
        );
        /* yellow sticky with the hook */
        ctx.save();
        ctx.translate(210, cy + 4);
        ctx.rotate(-0.04);
        ctx.fillStyle = "#000";
        ctx.fillRect(-150 + 8, -80 + 8, 300, 160);
        ctx.fillStyle = th.ac;
        ctx.fillRect(-150, -80, 300, 160);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 5;
        ctx.strokeRect(-150, -80, 300, 160);
        const hook = p.scenes[0].text.toUpperCase().split(/\s+/).slice(0, 8);
        for (let i = 0; i < 4; i++) {
          const line = hook.slice(i * 2, i * 2 + 2).join(" ");
          if (line)
            num(ctx, line, -130, -52 + i * 38, 30, "#000", "left", FONT, "900");
        }
        ctx.restore();
        /* blue countdown box */
        ctx.fillStyle = "#000";
        ctx.fillRect(402 + 8, cy - 40 + 8, 262, 110);
        ctx.fillStyle = "#fff";
        ctx.fillRect(402, cy - 40, 262, 110);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 5;
        ctx.strokeRect(402, cy - 40, 262, 110);
        num(ctx, clock, 533, cy + 16, 84, th.ac2, "center", MONO, "700");
        ctx.fillStyle = th.ac2;
        ctx.fillRect(402, cy + 70, 262 * (1 - done), 6);
        /* data table */
        const rows = stats.length ? stats : [{ v: no, l: "SCENE" }];
        rows.forEach((st, i) => {
          const y = H - 330 + i * 52;
          ctx.fillStyle = "#fff";
          ctx.fillRect(56, y, W - 112, 52);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 4;
          ctx.strokeRect(56, y, W - 112, 52);
          label(ctx, st.l || "VALUE", 76, y + 35, 22, "#000", "left", MONO, 2);
          ctx.fillStyle = i === rows.length - 1 ? "#ff3b00" : "#000";
          ctx.fillRect(W - 230, y, 174, 52);
          label(ctx, st.v, W - 143, y + 36, 28, "#fff", "center", MONO, 1);
        });
        ctx.save();
        ctx.translate(W - 120, H - 400);
        ctx.rotate(0.2 + Math.sin(t * 1.4) * 0.05);
        ctx.fillStyle = th.ac2;
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, 6.3);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.stroke();
        label(ctx, "NO CODE", 0, -4, 20, "#fff", "center", MONO, 1);
        label(ctx, "YET.", 0, 22, 20, "#fff", "center", MONO, 1);
        ctx.restore();
        break;
      }
      case "collage": {
        const wob = Math.sin(t * 0.7) * 0.006;
        ctx.save();
        ctx.translate(cx, H * 0.58);
        ctx.rotate(-0.03 + wob);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(-W * 0.43 + 10, -H * 0.2 + 12, W * 0.86, H * 0.4);
        ctx.fillStyle = "#f7f1e6";
        ctx.fillRect(-W * 0.43, -H * 0.2, W * 0.86, H * 0.4);
        ctx.restore();
        /* halftone circle with the countdown */
        ctx.fillStyle = "#f7f1e6";
        ctx.beginPath();
        ctx.arc(cx, cy, 112, 0, 6.3);
        ctx.fill();
        halftone(ctx, cx, cy, 108, "rgba(30,30,30,0.5)", 9);
        ctx.fillStyle = "#f7f1e6";
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, 6.3);
        ctx.fill();
        ctx.strokeStyle = th.fg;
        ctx.lineWidth = 3;
        ctx.stroke();
        num(ctx, clock, cx, cy + 2, 54, th.fg, "center", SERIF, "800");
        [
          [90, 150, -0.5],
          [W - 90, 150, 0.5],
          [90, H - 170, 0.45],
        ].forEach(([x, y, r]) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(r);
          ctx.fillStyle = "rgba(245,197,24,0.78)";
          ctx.fillRect(-60, -16, 120, 32);
          ctx.restore();
        });
        stats.forEach((st, i) => {
          ctx.save();
          ctx.translate(150 + i * 200, H - 300 + (i % 2) * 14);
          ctx.rotate((i - 1) * 0.07);
          ctx.fillStyle = "#222";
          ctx.fillRect(-88 + 5, -34 + 5, 176, 68);
          ctx.fillStyle = [th.ac, "#fff", th.ac2][i % 3];
          ctx.fillRect(-88, -34, 176, 68);
          num(
            ctx,
            st.v,
            0,
            -6,
            34,
            i % 3 === 2 ? "#fff" : "#1e1e1e",
            "center",
            SERIF,
            "800",
          );
          label(
            ctx,
            st.l,
            0,
            24,
            14,
            i % 3 === 2 ? "#fff" : "#444",
            "center",
            SERIF,
            2,
          );
          ctx.restore();
        });
        label(
          ctx,
          "FIG. " + (idx + 1),
          60,
          H - 100,
          22,
          th.fg,
          "left",
          SERIF,
          2,
        );
        break;
      }
      case "wash": {
        /* stamp ring with the countdown */
        ctx.strokeStyle = rgba(th.ac, 0.65);
        ctx.lineWidth = 4;
        ctx.setLineDash([3, 9]);
        ctx.beginPath();
        ctx.arc(cx, cy, 112, 0, 6.3);
        ctx.stroke();
        ctx.setLineDash([]);
        const wg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 100);
        wg.addColorStop(0, rgba(th.ac2, 0.5));
        wg.addColorStop(1, rgba(th.ac, 0.12));
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(cx, cy, 100, 0, 6.3);
        ctx.fill();
        ring(ctx, cx, cy, 100, rgba(th.ac, 0.85), 5, 1 - done);
        num(ctx, clock, cx, cy, 62, th.fg, "center", SERIF, "italic 500");
        ctx.strokeStyle = rgba(th.ac2, 0.7);
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let x = 80; x <= W - 80; x += 8) {
          const y = H * 0.83 + Math.sin(x * 0.045 + t * 1.3) * 9;
          if (x === 80) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        stats.forEach((st, i) => {
          const x = 120 + i * 220,
            y = H - 320 + (i % 2) * 22;
          num(
            ctx,
            st.v,
            x,
            y,
            40,
            rgba(th.fg, 0.9),
            "center",
            SERIF,
            "italic 500",
          );
          ctx.strokeStyle = rgba(i % 2 ? th.ac2 : th.ac, 0.7);
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x - 60, y + 30);
          ctx.quadraticCurveTo(x, y + 40, x + 60, y + 28);
          ctx.stroke();
          label(
            ctx,
            st.l.toLowerCase(),
            x,
            y + 60,
            18,
            rgba(th.fg, 0.6),
            "center",
            SERIF,
            1,
          );
        });
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = rgba(th.fg, 0.05 + rnd(i) * 0.06);
          ctx.fillRect(rnd(i + 5) * W, rnd(i + 9) * H, 2, 2);
        }
        break;
      }
      case "news": {
        const pulse = 0.55 + 0.45 * Math.sin(t * 5);
        ctx.fillStyle = th.ac;
        ctx.fillRect(48, 128, 124, 46);
        ctx.fillStyle = rgba("#ffffff", pulse);
        ctx.beginPath();
        ctx.arc(72, 151, 7, 0, 6.3);
        ctx.fill();
        label(ctx, "LIVE", 90, 161, 28, "#fff", "left", FONT, 1);
        label(
          ctx,
          "BREAKING",
          W - 48,
          161,
          24,
          rgba("#fff", 0.7),
          "right",
          MONO,
          3,
        );
        /* countdown card */
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(48, 205, 250, 150);
        label(ctx, "COUNTDOWN", 66, 238, 18, "#475569", "left", MONO, 3);
        ctx.fillStyle = th.ac;
        ctx.fillRect(66, 254, 214, 84);
        num(ctx, clock, 173, 297, 70, "#fff", "center", FONT, "900");
        /* stat boxes */
        const boxes = stats.length ? stats : [{ v: no, l: "SCENE" }];
        boxes.forEach((st, i) => {
          const x = 326 + i * 118;
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(x, 205, 108, 150);
          ctx.fillStyle = th.ac;
          ctx.fillRect(x, 205, 108, 6);
          num(
            ctx,
            st.v,
            x + 54,
            280,
            st.v.length > 4 ? 28 : 36,
            "#0f172a",
            "center",
            FONT,
            "900",
          );
          label(ctx, st.l, x + 54, 330, 15, "#475569", "center", MONO, 2);
        });
        ctx.fillStyle = th.ac;
        ctx.fillRect(0, H - 290, W, 64);
        label(
          ctx,
          "BREAKING · " + no,
          40,
          H - 248,
          28,
          "#fff",
          "left",
          FONT,
          2,
        );
        ticker(
          ctx,
          `${handle.toUpperCase()} • FULL STORY IN THE CAPTION • FOLLOW FOR MORE •`,
          H - 226,
          56,
          t,
          "#f8fafc",
          "#0f172a",
          22,
          90,
        );
        break;
      }
      case "hud": {
        ctx.strokeStyle = th.ac;
        ctx.lineWidth = 4;
        const L = 70,
          m = 44;
        [
          [m, m, 1, 1],
          [W - m, m, -1, 1],
          [m, H - m, 1, -1],
          [W - m, H - m, -1, -1],
        ].forEach(([x, y, dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(x + dx * L, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + dy * L);
          ctx.stroke();
        });
        const sy = ((t * 260) % (H - 2 * m)) + m;
        const g = ctx.createLinearGradient(0, sy - 30, 0, sy);
        g.addColorStop(0, rgba(th.ac, 0));
        g.addColorStop(1, rgba(th.ac, 0.22));
        ctx.fillStyle = g;
        ctx.fillRect(m, sy - 30, W - 2 * m, 30);
        label(
          ctx,
          "HUD // " + no,
          72,
          150,
          20,
          rgba(th.ac2, 0.9),
          "left",
          MONO,
          2,
        );
        label(
          ctx,
          "T+" + t.toFixed(1) + "s",
          W - 72,
          150,
          20,
          rgba(th.ac2, 0.9),
          "right",
          MONO,
          2,
        );
        /* T-minus ring */
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = rgba(th.ac, 0.55);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 118, 0, 6.3);
        ctx.stroke();
        ctx.setLineDash([]);
        ring(ctx, cx, cy, 100, rgba(th.ac, 0.25), 8, 1);
        ring(ctx, cx, cy, 100, th.ac2, 8, 1 - done);
        label(
          ctx,
          "T-MINUS",
          cx,
          cy - 34,
          16,
          rgba(th.ac2, 0.9),
          "center",
          MONO,
          4,
        );
        num(ctx, clock, cx, cy + 8, 56, th.fg, "center", MONO, "700");
        label(
          ctx,
          "SEC " + String(Math.ceil(left)).padStart(3, "0"),
          cx,
          cy + 56,
          14,
          rgba(th.ac, 0.9),
          "center",
          MONO,
          3,
        );
        /* signal bars */
        const bars = stats.length ? stats.length * 3 : 8;
        for (let i = 0; i < bars; i++) {
          const h = 30 + 70 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.3 + idx));
          ctx.fillStyle = rgba(i % 3 === 0 ? th.ac2 : th.ac, 0.75);
          ctx.fillRect(90 + i * 26, H - 190 - h, 16, h);
        }
        stats.forEach((st, i) => {
          const x = W - 90 - (stats.length - i) * 150;
          label(
            ctx,
            st.l || "VALUE",
            x,
            H - 250,
            14,
            rgba(th.ac2, 0.8),
            "left",
            MONO,
            2,
          );
          num(ctx, st.v, x, H - 215, 34, th.fg, "left", MONO, "700");
        });
        break;
      }
      case "comic": {
        /* thick panel border, halftone corners, a starburst with the countdown, speech-bubble stats */
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 16;
        ctx.strokeRect(18, 18, W - 36, H - 36);
        halftone(ctx, 0, 0, 260, "rgba(229,55,43,0.35)", 14);
        halftone(ctx, W, H, 300, "rgba(37,99,235,0.3)", 14);
        const spikes = 14,
          pulse = 1 + 0.04 * Math.sin(t * 6);
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * 6.2832 + t * 0.2,
            r = (i % 2 ? 100 : 142) * pulse;
          ctx[i ? "lineTo" : "moveTo"](
            cx + Math.cos(a) * r,
            cy + Math.sin(a) * r,
          );
        }
        ctx.closePath();
        ctx.fillStyle = "#111";
        ctx.save();
        ctx.translate(7, 7);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = th.ac;
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.save();
        ctx.lineWidth = 9;
        ctx.strokeStyle = "#111";
        ctx.font = `900 72px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(clock, cx, cy + 2);
        ctx.fillStyle = "#fff";
        ctx.fillText(clock, cx, cy + 2);
        ctx.restore();
        label(ctx, "TICK TOCK!", cx, cy - 96, 22, "#111", "center", FONT, 3);
        stats.forEach((st, i) => {
          const x = 130 + i * 230,
            y = H - 320 + (i % 2) * 20;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((i - 1) * 0.05);
          ctx.fillStyle = "#111";
          rr(ctx, -92 + 6, -44 + 6, 184, 88, 22);
          ctx.fill();
          ctx.fillStyle = "#fff";
          rr(ctx, -92, -44, 184, 88, 22);
          ctx.fill();
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-30, 44);
          ctx.lineTo(-52, 74);
          ctx.lineTo(-4, 44);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.stroke();
          num(ctx, st.v, 0, -8, 40, "#111", "center", FONT, "900");
          label(ctx, st.l, 0, 30, 16, "#444", "center", FONT, 2);
          ctx.restore();
        });
        break;
      }
      case "neon": {
        /* glowing tube frame, neon digits, outlined pills */
        const glow = (color, blur) => {
          ctx.shadowColor = color;
          ctx.shadowBlur = blur;
        };
        ctx.save();
        glow(th.ac, 24);
        ctx.strokeStyle = th.ac;
        ctx.lineWidth = 6;
        rr(ctx, 40, 40, W - 80, H - 80, 46);
        ctx.stroke();
        glow(th.ac2, 18);
        ctx.strokeStyle = th.ac2;
        ctx.lineWidth = 3;
        rr(ctx, 60, 60, W - 120, H - 120, 34);
        ctx.stroke();
        const flick = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 3.1);
        ctx.globalAlpha = flick;
        glow(th.ac, 30);
        ctx.font = `800 120px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = th.ac;
        ctx.lineWidth = 5;
        ctx.strokeText(clock, cx, cy);
        ctx.fillStyle = rgba("#ffffff", 0.9);
        ctx.fillText(clock, cx, cy);
        ctx.globalAlpha = 1;
        glow(th.ac2, 14);
        ctx.strokeStyle = th.ac2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 120, cy + 86);
        ctx.lineTo(cx - 120 + 240 * (1 - done), cy + 86);
        ctx.stroke();
        stats.forEach((st, i) => {
          const x = 70 + i * 205,
            c = i % 2 ? th.ac2 : th.ac;
          glow(c, 14);
          ctx.strokeStyle = c;
          ctx.lineWidth = 3.5;
          rr(ctx, x, H - 330, 190, 104, 28);
          ctx.stroke();
          ctx.shadowBlur = 0;
          num(ctx, st.v, x + 95, H - 292, 38, "#fff", "center", FONT, "800");
          label(ctx, st.l, x + 95, H - 246, 15, c, "center", MONO, 3);
        });
        ctx.restore();
        break;
      }
      case "glass": {
        /* drifting colour orbs under frosted-glass cards */
        [
          [th.ac, 0.4, 0.28, 280],
          [th.ac2, 0.7, 0.62, 320],
          ["#f472b6", 0.2, 0.82, 240],
        ].forEach(([c, fx, fy, r], i) => {
          const x = W * fx + Math.sin(t * 0.5 + i * 2) * 60,
            y = H * fy + Math.cos(t * 0.4 + i) * 70,
            g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rgba(c, 0.55));
          g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        });
        const card = (x, y, w, h, r, a) => {
          rr(ctx, x, y, w, h, r);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 2;
          ctx.stroke();
          const g = ctx.createLinearGradient(x, y, x, y + h * 0.5);
          g.addColorStop(0, "rgba(255,255,255,0.16)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          rr(ctx, x, y, w, h * 0.5, r);
          ctx.fillStyle = g;
          ctx.fill();
        };
        card(60, 190, W - 120, 140, 40, 0.1);
        num(ctx, clock, cx, 262, 96, "#fff", "center", FONT, "700");
        label(
          ctx,
          "REMAINING",
          cx,
          312,
          16,
          "rgba(255,255,255,0.6)",
          "center",
          MONO,
          6,
        );
        ctx.fillStyle = rgba(th.ac2, 0.9);
        rr(ctx, 100, 336, (W - 200) * (1 - done), 6, 3);
        ctx.fill();
        card(48, 392, W - 96, 560, 54, 0.06);
        stats.forEach((st, i) => {
          const x = 60 + i * 206;
          card(x, H - 330, 190, 110, 30, 0.12);
          num(ctx, st.v, x + 95, H - 290, 40, "#fff", "center", FONT, "700");
          label(
            ctx,
            st.l,
            x + 95,
            H - 244,
            15,
            "rgba(255,255,255,0.65)",
            "center",
            MONO,
            3,
          );
        });
        break;
      }
      case "term": {
        /* a terminal window running the countdown */
        const x0 = 40,
          y0 = 130,
          w0 = W - 80,
          h0 = H - 340;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        rr(ctx, x0 + 8, y0 + 10, w0, h0, 22);
        ctx.fill();
        ctx.fillStyle = "#0d1117";
        rr(ctx, x0, y0, w0, h0, 22);
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#161b22";
        ctx.fillRect(x0 + 1, y0 + 1, w0 - 2, 52);
        ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x0 + 34 + i * 30, y0 + 27, 9, 0, 6.3);
          ctx.fill();
        });
        label(
          ctx,
          "~/studio — zsh",
          cx,
          y0 + 34,
          20,
          "#8b949e",
          "center",
          MONO,
          1,
        );
        label(
          ctx,
          "$ countdown --remaining",
          x0 + 30,
          y0 + 100,
          22,
          "#8b949e",
          "left",
          MONO,
          1,
        );
        num(ctx, clock, x0 + 30, cy + 30, 110, th.ac, "left", MONO, "700");
        label(
          ctx,
          "progress " +
            "█".repeat(Math.round(done * 16)) +
            "░".repeat(16 - Math.round(done * 16)),
          x0 + 30,
          cy + 120,
          20,
          th.ac2,
          "left",
          MONO,
          0,
        );
        stats.forEach((st, i) => {
          label(
            ctx,
            `> ${(st.l || "value").toLowerCase()} = ${st.v}`,
            x0 + 30,
            y0 + h0 - 110 + i * 34,
            24,
            i % 2 ? th.ac2 : th.fg,
            "left",
            MONO,
            0,
          );
        });
        if (Math.floor(t * 2) % 2 === 0) {
          ctx.fillStyle = th.ac;
          ctx.fillRect(x0 + 30, y0 + h0 - 38, 14, 26);
        }
        break;
      }
      case "notes": {
        /* grid paper with pinned sticky notes */
        ctx.strokeStyle = "rgba(60,90,160,0.12)";
        ctx.lineWidth = 1.5;
        for (let x = 0; x <= W; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        for (let y = 0; y <= H; y += 48) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        const note = (x, y, w, h, rot, color) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot + Math.sin(t * 0.8 + x) * 0.006);
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.fillRect(-w / 2 + 6, -h / 2 + 9, w, h);
          ctx.fillStyle = color;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.fillStyle = "rgba(0,0,0,0.05)";
          ctx.fillRect(-w / 2, h / 2 - 22, w, 22);
          ctx.fillStyle = "#e11d48";
          ctx.beginPath();
          ctx.arc(0, -h / 2 + 12, 9, 0, 6.3);
          ctx.fill();
          ctx.restore();
        };
        note(cx, cy + 6, 300, 190, -0.03, "#ffd43b");
        num(
          ctx,
          clock,
          cx,
          cy + 14,
          96,
          th.fg,
          "center",
          th.face ? th.face[1] : FONT,
          "800",
        );
        ctx.strokeStyle = "#e11d48";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy + 14,
          130,
          62,
          -0.04,
          0,
          6.3 * clamp((t - s.start) / 0.8, 0, 1),
        );
        ctx.stroke();
        stats.forEach((st, i) => {
          const colors = [th.ac2, "#8ecae6", "#b5e48c"];
          note(120 + i * 240, H - 290, 200, 130, (i - 1) * 0.07, colors[i % 3]);
          ctx.save();
          ctx.translate(120 + i * 240, H - 290);
          ctx.rotate((i - 1) * 0.07);
          num(
            ctx,
            st.v,
            0,
            -6,
            44,
            "#2b2b2b",
            "center",
            th.face ? th.face[1] : FONT,
            "800",
          );
          label(
            ctx,
            st.l.toLowerCase(),
            0,
            40,
            18,
            "#444",
            "center",
            th.face ? th.face[1] : FONT,
            1,
          );
          ctx.restore();
        });
        break;
      }
      case "vapor": {
        const hy = H * 0.7,
          sg = ctx.createLinearGradient(0, hy - 360, 0, hy);
        sg.addColorStop(0, "#ffd166");
        sg.addColorStop(1, "#f472b6");
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, hy);
        ctx.clip();
        ctx.fillStyle = sg;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(cx, hy - 20, 250, 0, 6.3);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#1b0a28";
        ctx.fillRect(0, hy, W, H - hy);
        ctx.strokeStyle = rgba(th.ac, 0.8);
        ctx.lineWidth = 2;
        for (let i = -8; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 22, hy);
          ctx.lineTo(cx + i * 150, H);
          ctx.stroke();
        }
        for (let k = 0; k < 8; k++) {
          const f = frac(k / 8 + t * 0.18),
            y = hy + f * f * (H - hy);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        /* title bar and the countdown window */
        ctx.fillStyle = "#c0c0d8";
        ctx.fillRect(40, 130, W - 80, 44);
        ctx.fillStyle = th.ac2;
        ctx.fillRect(40, 130, W - 80, 6);
        label(ctx, "validate.exe", 60, 162, 22, "#1b0a28", "left", MONO, 1);
        ["#f472b6", "#14b8a6", "#fde047"].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(W - 60 - i * 30, 142, 20, 20);
        });
        ctx.fillStyle = "#c0c0d8";
        ctx.fillRect(cx - 130, 200, 260, 120);
        ctx.fillStyle = "#1b0a28";
        ctx.fillRect(cx - 120, 212, 240, 96);
        num(ctx, clock, cx, 262, 76, th.ac, "center", MONO, "700");
        /* VALIDATED dialog on later scenes */
        if (idx > 0) {
          const y = hy + 70;
          ctx.fillStyle = "#c0c0d8";
          ctx.fillRect(cx - 190, y, 380, 110);
          ctx.fillStyle = th.ac;
          ctx.fillRect(cx - 190, y, 380, 26);
          label(
            ctx,
            "VALIDATED",
            cx - 176,
            y + 19,
            16,
            "#fff",
            "left",
            MONO,
            2,
          );
          ctx.fillStyle = "#14b8a6";
          ctx.beginPath();
          ctx.arc(cx - 140, y + 68, 22, 0, 6.3);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(cx - 150, y + 68);
          ctx.lineTo(cx - 142, y + 77);
          ctx.lineTo(cx - 128, y + 58);
          ctx.stroke();
          const txt = stats.map((x) => x.v).join(" · ") || "ALL SYSTEMS GO";
          label(
            ctx,
            txt.slice(0, 24),
            cx - 100,
            y + 76,
            20,
            "#1b0a28",
            "left",
            MONO,
            1,
          );
        }
        break;
      }
    }
    ctx.restore();
  }

  function drawParticles(ctx, p, t, st) {
    const th = p.theme,
      kind = p.fx.particles;
    if (kind === "none") return;
    if (kind === "sparkles") {
      for (let i = 0; i < 18; i++) {
        const x = rnd(i + 1) * W,
          y = (((rnd(i + 40) * H - t * (30 + rnd(i + 9) * 50)) % H) + H) % H,
          tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        ctx.fillStyle = rgba(i % 2 ? th.ac2 : th.fg, 0.25 + 0.55 * tw);
        star(ctx, x, y, 5 + rnd(i + 3) * 12 * tw);
      }
    } else if (kind === "confetti") {
      if (st > 1.6) return;
      const e = easeOutCubic(clamp(st / 1.3)),
        fade = 1 - clamp((st - 0.9) / 0.7);
      for (let i = 0; i < 34; i++) {
        const ang = rnd(i + 5) * 6.283,
          dist = (140 + rnd(i + 70) * 420) * e,
          x = W / 2 + Math.cos(ang) * dist,
          y = H * 0.46 + Math.sin(ang) * dist * 0.8 + e * e * 120;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(st * (rnd(i) - 0.5) * 12);
        ctx.fillStyle = rgba([th.ac, th.ac2, th.fg][i % 3], 0.9 * fade);
        ctx.fillRect(-7, -3.5, 14, 7);
        ctx.restore();
      }
    } else if (kind === "rain") {
      ctx.lineCap = "round";
      for (let i = 0; i < 70; i++) {
        const sp = 900 + rnd(i + 3) * 500,
          x = ((rnd(i + 1) * (W + 300) + t * 160) % (W + 300)) - 150,
          y = ((rnd(i + 40) * H + t * sp) % (H + 120)) - 60;
        ctx.strokeStyle = rgba(i % 3 ? th.fg : th.ac2, 0.22 + rnd(i + 9) * 0.2);
        ctx.lineWidth = 2 + rnd(i + 7) * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 14, y + 46);
        ctx.stroke();
      }
    } else if (kind === "snow") {
      for (let i = 0; i < 60; i++) {
        const sp = 40 + rnd(i + 3) * 90,
          x = rnd(i + 1) * W + Math.sin(t * 0.8 + i) * 34,
          y = ((rnd(i + 40) * H + t * sp) % (H + 40)) - 20,
          r = 2.5 + rnd(i + 7) * 6;
        ctx.fillStyle = rgba(th.fg, 0.3 + rnd(i + 5) * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.3);
        ctx.fill();
      }
    } else if (kind === "stars") {
      for (let i = 0; i < 80; i++) {
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (1 + rnd(i + 3) * 2) + i));
        ctx.fillStyle = rgba(i % 4 ? th.fg : th.ac2, 0.2 + 0.6 * tw);
        ctx.beginPath();
        ctx.arc(
          rnd(i + 1) * W,
          rnd(i + 40) * H,
          1.2 + rnd(i + 8) * 2.2,
          0,
          6.3,
        );
        ctx.fill();
      }
      const k = frac(t / 2.4);
      if (k < 0.3) {
        const e = k / 0.3,
          x = W * 0.9 - e * W * 0.7,
          y = H * 0.12 + e * H * 0.22;
        const g = ctx.createLinearGradient(x, y, x + 150, y - 60);
        g.addColorStop(0, rgba(th.fg, 0.9 * (1 - e)));
        g.addColorStop(1, rgba(th.fg, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 150, y - 60);
        ctx.stroke();
      }
    } else if (kind === "embers") {
      for (let i = 0; i < 40; i++) {
        const sp = 50 + rnd(i + 3) * 110,
          y = H - (((rnd(i + 40) * H + t * sp) % (H + 60)) - 30),
          x = rnd(i + 1) * W + Math.sin(t * 1.3 + i * 2) * 40,
          life = clamp(y / H),
          r = 2 + rnd(i + 7) * 5;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, rgba(i % 2 ? th.ac : "#ffb347", 0.9 * life));
        g.addColorStop(1, rgba(th.ac, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, 6.3);
        ctx.fill();
      }
    } else if (kind === "bokeh") {
      for (let i = 0; i < 12; i++) {
        const r = 34 + rnd(i + 2) * 70,
          x = rnd(i + 11) * W + Math.sin(t * 0.3 + i) * 40,
          y =
            ((((rnd(i + 21) * H - t * (12 + rnd(i) * 22)) % (H + 140)) +
              H +
              140) %
              (H + 140)) -
            70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(i % 2 ? th.ac2 : th.ac, 0.2));
        g.addColorStop(1, rgba(th.ac, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.3);
        ctx.fill();
      }
    }
  }

  /* ---------- animated icons that match each scene ---------- */
  function drawMotif(ctx, name, cx, cy, size, st, t, th) {
    const e = easeOutBack(clamp(st / 0.5)),
      a = clamp(st / 0.25),
      r = size / 2,
      prog = clamp((st - 0.12) / 0.8);
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 2) * 8);
    ctx.scale(e, e);
    ctx.globalAlpha *= a;
    ctx.lineWidth = size * 0.065;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
    g.addColorStop(0, rgba(th.ac, 0.35));
    g.addColorStop(1, rgba(th.ac, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = th.ac;
    ctx.fillStyle = th.ac;
    switch (name) {
      case "chart":
        {
          ctx.strokeStyle = rgba(th.fg, 0.45);
          strokePoly(
            ctx,
            [
              [-r, -r * 0.8],
              [-r, r * 0.8],
              [r, r * 0.8],
            ],
            1,
          );
          ctx.strokeStyle = th.ac;
          const pts = [
            [-r * 0.9, r * 0.55],
            [-r * 0.45, r * 0.15],
            [-r * 0.1, r * 0.35],
            [r * 0.35, -r * 0.25],
            [r * 0.85, -r * 0.7],
          ];
          const end = strokePoly(ctx, pts, prog);
          ctx.fillStyle = th.ac2;
          ctx.beginPath();
          ctx.arc(end[0], end[1], size * 0.06, 0, 6.3);
          ctx.fill();
        }
        break;
      case "coin":
        {
          ctx.save();
          ctx.scale(Math.max(0.12, Math.abs(Math.cos(t * 2.4))), 1);
          ctx.fillStyle = th.ac;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.85, 0, 6.3);
          ctx.fill();
          ctx.strokeStyle = rgba("#ffffff", 0.5);
          ctx.lineWidth = size * 0.04;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.68, 0, 6.3);
          ctx.stroke();
          ctx.fillStyle = lum(th.ac) > 0.6 ? "#111" : "#fff";
          ctx.font = `800 ${size * 0.6}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("$", 0, size * 0.03);
          ctx.restore();
        }
        break;
      case "flame":
        {
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.bezierCurveTo(
            r * 0.2,
            -r * 0.5,
            r * 0.9,
            -r * 0.1,
            r * 0.7,
            r * 0.4,
          );
          ctx.bezierCurveTo(
            r * 0.55,
            r * 0.85,
            -r * 0.55,
            r * 0.85,
            -r * 0.7,
            r * 0.4,
          );
          ctx.bezierCurveTo(-r * 0.85, -r * 0.05, -r * 0.25, -r * 0.35, 0, -r);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = th.ac2;
          ctx.save();
          ctx.scale(0.55, 0.55 + 0.04 * Math.sin(t * 9));
          ctx.translate(0, r * 0.45);
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.bezierCurveTo(
            r * 0.2,
            -r * 0.5,
            r * 0.9,
            -r * 0.1,
            r * 0.7,
            r * 0.4,
          );
          ctx.bezierCurveTo(
            r * 0.55,
            r * 0.85,
            -r * 0.55,
            r * 0.85,
            -r * 0.7,
            r * 0.4,
          );
          ctx.bezierCurveTo(-r * 0.85, -r * 0.05, -r * 0.25, -r * 0.35, 0, -r);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      case "bolt":
        ctx.beginPath();
        [
          [r * 0.25, -r],
          [-r * 0.6, r * 0.1],
          [-r * 0.05, r * 0.1],
          [-r * 0.3, r],
          [r * 0.65, -r * 0.2],
          [r * 0.08, -r * 0.2],
        ].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
        break;
      case "target":
        {
          [0.9, 0.6, 0.3].forEach((k, i) => {
            ctx.beginPath();
            ctx.arc(0, 0, r * k * (0.9 + 0.1 * Math.sin(t * 3 - i)), 0, 6.3);
            ctx.strokeStyle = i % 2 ? th.ac2 : th.ac;
            ctx.stroke();
          });
          ctx.fillStyle = th.ac;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.1, 0, 6.3);
          ctx.fill();
        }
        break;
      case "clock":
        {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.85, 0, 6.3);
          ctx.stroke();
          ctx.strokeStyle = th.ac2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(t * 4 - 1.57) * r * 0.6,
            Math.sin(t * 4 - 1.57) * r * 0.6,
          );
          ctx.stroke();
          ctx.strokeStyle = th.ac;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(t * 0.33 - 1.57) * r * 0.38,
            Math.sin(t * 0.33 - 1.57) * r * 0.38,
          );
          ctx.stroke();
        }
        break;
      case "heart":
        {
          const k = 1 + 0.07 * Math.sin(t * 6);
          ctx.scale(k, k);
          ctx.beginPath();
          ctx.moveTo(0, r * 0.8);
          ctx.bezierCurveTo(
            -r * 1.2,
            r * 0.1,
            -r * 0.7,
            -r * 0.9,
            0,
            -r * 0.35,
          );
          ctx.bezierCurveTo(r * 0.7, -r * 0.9, r * 1.2, r * 0.1, 0, r * 0.8);
          ctx.fill();
        }
        break;
      case "check":
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, 0, 6.3);
        ctx.stroke();
        ctx.strokeStyle = th.ac2;
        ctx.lineWidth = size * 0.09;
        strokePoly(
          ctx,
          [
            [-r * 0.4, 0],
            [-r * 0.1, r * 0.32],
            [r * 0.45, -r * 0.3],
          ],
          prog,
        );
        break;
    }
    ctx.restore();
  }

  /* ---------- one frame ---------- */
  function draw(ctx, p, tt) {
    const t = clamp(tt, 0, p.duration - 0.001),
      fx = p.fx,
      th = p.theme,
      light = lum(th.bg) > 0.6;
    HAS_LOOK = !!th.look;
    FACE = th.face || ["800", FONT];
    const s =
      p.scenes.find((sc) => t >= sc.start && t < sc.start + sc.dur) ||
      p.scenes[p.scenes.length - 1];
    const st = t - s.start,
      fnum = Math.floor(t * 30);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0; // the previous frame leaves these changed

    /* camera */
    let zoom = 1,
      tx = 0,
      ty = 0,
      crot = 0;
    if (fx.camera === "zoomout") zoom = 1.08 - 0.06 * (st / s.dur);
    else if (fx.camera === "orbit") {
      crot = Math.sin(t * 0.5) * 0.014;
      tx = Math.sin(t * 0.7) * 10;
      zoom = 1.05;
    } else if (fx.camera === "pulse")
      zoom = 1 + 0.02 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2)), 3);
    else if (fx.camera === "push") zoom = 1 + 0.045 * (st / s.dur);
    else if (fx.camera === "drift") {
      tx = Math.sin(t * 0.6) * 14;
      ty = Math.cos(t * 0.5) * 10;
      zoom = 1.04;
    } else if (fx.camera === "shake") {
      tx = (rnd(fnum) - 0.5) * 7;
      ty = (rnd(fnum + 99) - 0.5) * 7;
      zoom = 1.015;
    }
    /* transition (first moments of each scene) */
    const te = easeOutCubic(clamp(st / 0.45));
    let tzoom = 1,
      tdx = 0,
      trot = 0;
    if (fx.transition === "spin") {
      trot = (1 - te) * 0.22;
      tzoom = 1 + 0.25 * (1 - te);
    } else if (fx.transition === "zoom") tzoom = 1 + 0.32 * (1 - te);
    else if (fx.transition === "slide") tdx = (1 - te) * W * 0.7;
    else if (fx.transition === "glitch" && st < 0.3)
      tdx = (rnd(fnum * 3 + s.index) - 0.5) * 36;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(crot + trot);
    ctx.scale(zoom * (trot ? tzoom : 1), zoom * (trot ? tzoom : 1));
    ctx.translate(-W / 2 + tx, -H / 2 + ty);
    drawBg(ctx, p, t, s);
    drawLook(ctx, p, t, s);
    if (fx.transition === "ring" && st < 0.7) {
      const k = easeOutCubic(st / 0.7);
      ctx.strokeStyle = rgba(th.ac, 0.5 * (1 - k));
      ctx.lineWidth = 10 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.46, 80 + k * 520, 0, 6.3);
      ctx.stroke();
    }
    drawParticles(ctx, p, t, st);
    if (s.motif && !th.look)
      drawMotif(ctx, s.motif, W / 2, H * 0.22, 190, st, t, th);
    ctx.restore();

    /* text group */
    const L = layout(ctx, s),
      exit = clamp((st - (s.dur - 0.22)) / 0.22);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(crot + trot);
    ctx.scale(zoom * tzoom, zoom * tzoom);
    ctx.translate(-W / 2 + tx + tdx, -H / 2 + ty - exit * 26);
    ctx.globalAlpha = 1 - exit;
    ctx.font = faceFont(L.size);
    ctx.textBaseline = "alphabetic";
    let cur = -1;
    s.at.forEach((a, i) => {
      if (st >= a) cur = i;
    });
    const pillTxt = lum(th.ac) > 0.62 ? "#111" : "#fff";
    L.lines.forEach((ln, li) =>
      ln.items.forEach((it) => {
        const tw = st - s.at[it.i];
        if (tw < 0) return;
        let sc = 1,
          sy = 1,
          blurPx = 0,
          ox = 0,
          oy = 0,
          a = clamp(tw / 0.12),
          str = it.w;
        switch (fx.caption) {
          case "type":
            str = it.w.slice(
              0,
              Math.max(1, Math.ceil(it.w.length * clamp(tw / 0.22))),
            );
            a = 1;
            break;
          case "slide":
            ox = (1 - easeOutCubic(clamp(tw / 0.3))) * (li % 2 ? 150 : -150);
            break;
          case "bounce":
            oy = -(1 - easeOutBounce(clamp(tw / 0.55))) * 150;
            break;
          case "glitch":
            break;
          case "wave": {
            const e = easeOutCubic(clamp(tw / 0.35));
            oy = (1 - e) * 60 + Math.sin(t * 4 + it.i * 0.9) * 9;
            break;
          }
          case "blur": {
            const e = easeOutCubic(clamp(tw / 0.45));
            blurPx = (1 - e) * 14;
            sc = 1.12 - 0.12 * e;
            break;
          }
          case "flip": {
            const e = easeOutBack(clamp(tw / 0.4));
            sy = Math.max(0.02, e);
            break;
          }
          case "rise": {
            const e = easeOutCubic(clamp(tw / 0.5));
            oy = (1 - e) * 70;
            a = clamp(tw / 0.3);
            break;
          }
          default: {
            const e = easeOutBack(clamp(tw / 0.3));
            sc = 0.7 + 0.3 * e;
            oy = (1 - e) * 30;
          }
        }
        const cx = it.x + it.ww / 2,
          cy = it.y - L.size * 0.34,
          isLast = it.i === s.ws.length - 1;
        const active =
          it.i === cur && s.type !== "outro"
            ? isLast
              ? 1 - clamp((st - s.at[it.i] - 0.5) / 0.5)
              : 1
            : 0;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(cx + ox, cy + oy);
        ctx.scale(sc, sc * sy);
        ctx.translate(-cx, -cy);
        if (blurPx > 0.3 && "filter" in ctx)
          ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        if (active > 0.01) {
          ctx.fillStyle = rgba(th.ac, active);
          rr(
            ctx,
            it.x - 14,
            it.y - L.size * 0.9,
            it.ww + 28,
            L.size * 1.08,
            18,
          );
          ctx.fill();
        }
        const emph =
          s.emph.has(wordKey(it.w)) ||
          /^[$€£]?\d[\d,.]*[kKmM%]?[.,!?]?$|^[A-Z]{3,}[.,!?]?$/.test(it.w);
        if (fx.chroma || (fx.caption === "glitch" && tw < 0.3)) {
          const j =
            fx.caption === "glitch" && tw < 0.3
              ? (rnd(fnum + it.i * 5) - 0.5) * 16 + 4
              : 3.5;
          ctx.fillStyle = "rgba(255,40,90,.6)";
          ctx.fillText(str, it.x - j, it.y);
          ctx.fillStyle = "rgba(30,220,255,.6)";
          ctx.fillText(str, it.x + j, it.y);
        }
        if (fx.glow && !light) {
          ctx.shadowColor = rgba(th.ac, 0.85);
          ctx.shadowBlur = 22;
        }
        ctx.fillStyle =
          active > 0.5 ? pillTxt : emph || s.type === "outro" ? th.ac : th.fg;
        ctx.fillText(str, it.x, it.y);
        if ("filter" in ctx) ctx.filter = "none";
        ctx.restore();
      }),
    );
    ctx.restore();

    /* call-to-action chip */
    if (s.keyword && st > 0.5) {
      const e = easeOutBack(clamp((st - 0.5) / 0.4)),
        pulse = 1 + 0.04 * Math.sin(st * 6),
        y = L.y0 + L.blockH - L.lh * 0.4 + 90;
      ctx.save();
      ctx.translate(W / 2, Math.min(y, H - 260));
      ctx.scale(e * pulse, e * pulse);
      ctx.font = `800 40px ${FONT}`;
      const label = `Comment “${s.keyword}”`,
        w = ctx.measureText(label).width + 80;
      ctx.shadowColor = rgba(th.ac, 0.6);
      ctx.shadowBlur = 36;
      ctx.fillStyle = th.ac;
      rr(ctx, -w / 2, -42, w, 84, 42);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = pillTxt;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 2);
      ctx.restore();
    }

    /* overlays */
    if (fx.transition === "flash" && st < 0.24) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - st / 0.24)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (fx.transition === "glitch" && st < 0.3)
      for (let k = 0; k < 6; k++) {
        const r = rnd(fnum * 5 + k + s.index);
        ctx.fillStyle = rgba(k % 2 ? th.ac2 : th.ac, 0.45);
        ctx.fillRect(0, r * H, W, 6 + rnd(k + fnum) * 30);
      }
    if (fx.transition === "wipe" && st < 0.5) {
      const k = easeOutCubic(st / 0.5),
        x = -W * 0.4 + k * W * 1.8;
      ctx.save();
      ctx.fillStyle = th.ac;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + W * 0.45, 0);
      ctx.lineTo(x + W * 0.45 - 220, H);
      ctx.lineTo(x - 220, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(th.ac2, 0.9);
      ctx.fillRect(x + W * 0.45 - 40, 0, 0, 0);
      ctx.restore();
    }
    if (fx.transition === "blinds" && st < 0.5) {
      const k = clamp(st / 0.5),
        n = 9,
        h = H / n;
      ctx.fillStyle = th.bg;
      for (let i = 0; i < n; i++) {
        const local = clamp(k * 1.6 - i * 0.06),
          hh = h * (1 - local);
        if (hh > 0.5) ctx.fillRect(0, i * h, W, hh);
      }
    }
    if (fx.leak) {
      const x = ((t * 0.12) % 1.6) * W - W * 0.3;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(x - 260, 0, x + 260, H * 0.6);
      g.addColorStop(0, "rgba(255,150,60,0)");
      g.addColorStop(0.5, "rgba(255,120,80,0.2)");
      g.addColorStop(1, "rgba(255,60,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (fx.shine) {
      const k = clamp(st / 1.2);
      if (k < 1) {
        const x = -300 + k * (W + 600);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,255,255,0.16)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.translate(W / 2, H / 2);
        ctx.rotate(0.35);
        ctx.translate(-W / 2, -H / 2);
        ctx.fillRect(x - 120, -H, 240, H * 3);
        ctx.restore();
      }
    }
    if (fx.scanlines) {
      ctx.fillStyle = "rgba(0,0,0,0.13)";
      for (let y = Math.floor(t * 20) % 4; y < H; y += 4)
        ctx.fillRect(0, y, W, 1.6);
    }
    if (fx.vignette) {
      const g = ctx.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.28,
        W / 2,
        H / 2,
        H * 0.72,
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (fx.bars) {
      const e = easeOutCubic(clamp(t / 0.6)),
        bh = 92 * e;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
    }
    if (fx.grain) {
      const f = Math.floor(t * 24);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.09)";
        ctx.fillRect(rnd(f * 7 + i) * W, rnd(f * 13 + i + 3) * H, 2.5, 2.5);
      }
    }

    /* chrome: label, handle, progress */
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const label =
      s.type === "hook"
        ? "HOOK"
        : s.type === "body"
          ? `LINE ${s.n}`
          : s.type === "comment"
            ? "CALL TO ACTION"
            : "";
    if (label) {
      ctx.font = `700 24px ${FONT}`;
      const w = ctx.measureText(label).width + 40,
        e = easeOutCubic(clamp(st / 0.35));
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(0, (1 - e) * -14);
      ctx.fillStyle = rgba(th.ac, 0.2);
      rr(ctx, 56, 70, w, 52, 26);
      ctx.fill();
      ctx.strokeStyle = rgba(th.ac, 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = th.fg;
      ctx.fillText(label, 76, 97);
      ctx.restore();
    }
    ctx.font = `600 26px ${FONT}`;
    ctx.fillStyle = rgba(th.fg, 0.7);
    ctx.textAlign = "right";
    ctx.fillText(`@${p.handle}`, W - 56, 97);
    const by = H - 96;
    let x = 56;
    const total = W - 112,
      gap = 6;
    p.scenes.forEach((sc) => {
      const w = (total * sc.dur) / p.duration - gap;
      ctx.fillStyle = rgba(th.fg, 0.16);
      rr(ctx, x, by, Math.max(4, w), 8, 4);
      ctx.fill();
      const f = clamp((t - sc.start) / sc.dur);
      if (f > 0) {
        ctx.fillStyle = th.ac;
        rr(ctx, x, by, Math.max(8, w * f), 8, 4);
        ctx.fill();
      }
      x += w + gap;
    });
    if (t < 0.25) {
      ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- live preview (loops) ---------- */
  function preview(canvas, p) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    let raf = 0,
      alive = true;
    const t0 = performance.now();
    const loop = () => {
      if (!alive) return;
      draw(ctx, p, ((performance.now() - t0) / 1000) % (p.duration + 0.6));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return {
      stop() {
        alive = false;
        cancelAnimationFrame(raf);
      },
    };
  }

  /* ---------- synthesized background beat ---------- */
  function scheduleBeat(ac, dest, dur, vol, seed) {
    const master = ac.createGain(),
      now = ac.currentTime;
    master.gain.setValueAtTime(vol, now);
    master.gain.setValueAtTime(vol, now + Math.max(0, dur - 1.2));
    master.gain.linearRampToValueAtTime(0.0001, now + dur);
    master.connect(dest);
    const bpm = 88 + (seed % 4) * 8,
      spb = 60 / bpm,
      t0 = now + 0.08;
    const noise = ac.createBuffer(
        1,
        Math.floor(ac.sampleRate * 0.3),
        ac.sampleRate,
      ),
      d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const root = [110, 98, 123.47, 87.31][seed % 4],
      scale = [1, 1.2, 1.5, 1.8];
    const tone = (time, f0, f1, len, g, type) => {
      const o = ac.createOscillator(),
        gn = ac.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f0, time);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), time + len);
      gn.gain.setValueAtTime(g, time);
      gn.gain.exponentialRampToValueAtTime(0.001, time + len);
      o.connect(gn);
      gn.connect(master);
      o.start(time);
      o.stop(time + len + 0.02);
    };
    const hiss = (time, freq, len, g) => {
      const s = ac.createBufferSource(),
        f = ac.createBiquadFilter(),
        gn = ac.createGain();
      s.buffer = noise;
      f.type = "highpass";
      f.frequency.value = freq;
      gn.gain.setValueAtTime(g, time);
      gn.gain.exponentialRampToValueAtTime(0.001, time + len);
      s.connect(f);
      f.connect(gn);
      gn.connect(master);
      s.start(time);
      s.stop(time + len);
    };
    for (let b = 0; b * spb < dur; b++) {
      const t = t0 + b * spb;
      tone(t, 150, 45, 0.16, 0.9);
      if (b % 2 === 1) hiss(t, 1500, 0.14, 0.35);
      hiss(t + spb / 2, 7000, 0.04, 0.2);
      if (b % 2 === 0) {
        const n = root * scale[((b / 2) | 0) % 4];
        tone(t, n, n * 0.99, spb * 1.8, 0.22, "triangle");
      }
    }
  }

  /* ---------- record to a real video file ---------- */
  function supported() {
    return (
      typeof MediaRecorder !== "undefined" &&
      !!HTMLCanvasElement.prototype.captureStream
    );
  }
  function pickMime() {
    const c = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return c.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  }
  async function record(p, o = {}) {
    if (!supported())
      throw new Error(
        "This browser cannot record video. Use Chrome, Edge, Firefox or Safari 14.1+.",
      );
    const fps = o.fps || 30,
      canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    draw(ctx, p, 0);
    const stream = canvas.captureStream(fps);
    let ac = null,
      dest = null,
      voice = null;
    const wantAudio = !!o.audioBuffer || o.music !== false,
      AC = window.AudioContext || window.webkitAudioContext;
    if (wantAudio && AC) {
      ac = new AC();
      if (ac.resume) await ac.resume();
      dest = ac.createMediaStreamDestination();
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      if (o.audioBuffer) {
        voice = ac.createBufferSource();
        voice.buffer = o.audioBuffer;
        const g = ac.createGain();
        g.gain.value = 1;
        voice.connect(g);
        g.connect(dest);
      }
    }
    const mime = pickMime();
    const rec = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined,
    );
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((res, rej) => {
      rec.onstop = res;
      rec.onerror = (e) => rej(e.error || new Error("Recorder error"));
    });
    let finished = false,
      aborted = false,
      raf = 0,
      iv = 0,
      last = -1e9;
    const t0 = performance.now(),
      frameMs = 1000 / fps;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(iv);
      cancelAnimationFrame(raf);
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch (e) {
        /* already stopped */
      }
    };
    const step = () => {
      if (finished) return;
      const now = performance.now();
      if (now - last < frameMs - 3) return;
      last = now;
      const t = (now - t0) / 1000;
      draw(ctx, p, Math.min(t, p.duration - 0.001));
      if (o.onFrame) o.onFrame(canvas);
      if (o.onProgress) o.onProgress(Math.min(1, t / p.duration), t);
      if (t >= p.duration + 0.15) finish();
    };
    if (o.signal)
      o.signal.addEventListener("abort", () => {
        aborted = true;
        finish();
      });
    rec.start(200);
    if (voice) voice.start(); // same moment as the video clock
    if (ac && dest && o.music !== false)
      scheduleBeat(ac, dest, p.duration, o.audioBuffer ? 0.05 : 0.16, p.seed);
    const loop = () => {
      step();
      if (!finished) raf = requestAnimationFrame(loop);
    };
    loop();
    iv = setInterval(step, Math.floor(frameMs / 2)); // backup clock: keeps full frame rate when requestAnimationFrame is paused
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    if (voice) {
      try {
        voice.stop();
      } catch (e) {
        /* ended */
      }
    }
    if (ac && ac.close) ac.close();
    if (aborted) throw new Error("aborted");
    const type = rec.mimeType || mime || "video/webm";
    return {
      blob: new Blob(chunks, { type }),
      mime: type,
      ext: type.startsWith("video/mp4") ? "mp4" : "webm",
      duration: p.duration,
    };
  }

  window.ReelVideo = {
    THEMES,
    FORMATS,
    formatById,
    themesFor,
    themeByName,
    DEFAULT_FX,
    FX_OPTIONS,
    SWITCHES,
    PRESETS,
    MOTIFS,
    plan,
    draw,
    preview,
    record,
    supported,
    W,
    H,
  };
})();
