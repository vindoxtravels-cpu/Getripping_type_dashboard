/* Cuts a video file into key frames inside the browser, so reel analysis works on the deployed site
 * without the local helper or ffmpeg. The video never leaves this device; only the chosen frames go to Claude.
 */
(() => {
  "use strict";
  const SAMPLES = 36, // frames looked at to find scene changes
    KEEP = 10, // frames kept
    OUT_W = 480; // width of the frames sent to Claude
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const seek = (v, t) =>
    new Promise((res, rej) => {
      const done = () => {
        clearTimeout(timer);
        v.removeEventListener("seeked", done);
        res();
      };
      const timer = setTimeout(() => {
        v.removeEventListener("seeked", done);
        rej(new Error("The video stopped responding while reading it."));
      }, 8000);
      v.addEventListener("seeked", done);
      v.currentTime = t;
    });

  async function cut(file, opts = {}) {
    const keep = opts.keep || KEEP;
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    v.src = url;
    try {
      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = () =>
          rej(
            new Error(
              "This browser can’t read that video. Try an MP4 (H.264) or WebM file.",
            ),
          );
      });
      /* WebM files made by a browser recorder report an infinite length until the end is reached once */
      if (v.duration === Infinity) {
        await seek(v, 1e7).catch(() => {});
        await seek(v, 0).catch(() => {});
      }
      const dur = v.duration;
      if (!isFinite(dur) || dur <= 0)
        throw new Error("Could not read the length of that video.");
      if (dur > 180)
        throw new Error("That video is over 3 minutes. Use a shorter clip.");
      const vw = v.videoWidth || 720,
        vh = v.videoHeight || 1280,
        small = document.createElement("canvas"),
        big = document.createElement("canvas");
      small.width = 32;
      small.height = Math.max(8, Math.round((32 * vh) / vw));
      big.width = OUT_W;
      big.height = Math.round((OUT_W * vh) / vw);
      const sc = small.getContext("2d", { willReadFrequently: true }),
        bc = big.getContext("2d");
      const n = Math.max(2, Math.min(SAMPLES, Math.floor(dur * 3)));
      const times = Array.from({ length: n }, (_, i) =>
        clamp((dur * (i + 0.5)) / n, 0, Math.max(0, dur - 0.05)),
      );
      const grabs = [];
      let prev = null;
      for (let i = 0; i < times.length; i++) {
        await seek(v, times[i]);
        sc.drawImage(v, 0, 0, small.width, small.height);
        const px = sc.getImageData(0, 0, small.width, small.height).data;
        let diff = 0;
        if (prev) {
          for (let k = 0; k < px.length; k += 4)
            diff +=
              Math.abs(px[k] - prev[k]) +
              Math.abs(px[k + 1] - prev[k + 1]) +
              Math.abs(px[k + 2] - prev[k + 2]);
          diff /= px.length / 4 / 3;
        } else diff = Infinity;
        grabs.push({ t: times[i], diff });
        prev = px;
        if (opts.onProgress) opts.onProgress((i + 1) / times.length);
      }
      /* the biggest changes, plus the first frame, spread out in time */
      const chosen = new Set([0]);
      [...grabs]
        .map((g, i) => ({ i, d: g.diff }))
        .filter((x) => x.i > 0)
        .sort((a, b) => b.d - a.d)
        .forEach((x) => {
          if (chosen.size >= keep) return;
          chosen.add(x.i);
        });
      /* pad with evenly spaced frames if the clip has few clear cuts */
      for (let s = 0; chosen.size < Math.min(keep, n) && s < n; s++)
        chosen.add(Math.floor((s * n) / Math.min(keep, n)));
      const picks = [...chosen].sort((a, b) => a - b).slice(0, keep);
      const frames = [];
      for (const i of picks) {
        await seek(v, grabs[i].t);
        bc.drawImage(v, 0, 0, big.width, big.height);
        frames.push({
          t: Math.round(grabs[i].t * 10) / 10,
          jpeg: big.toDataURL("image/jpeg", 0.72).split(",")[1],
        });
      }
      return {
        frames,
        duration: Math.round(dur * 10) / 10,
        hasAudio: null,
        speechAvailable: false,
        transcript: null,
        local: true,
      };
    } finally {
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
    }
  }

  window.Frames = { cut };
})();
