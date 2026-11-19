/* Your cartoon clip library. Videos are stored in this browser (IndexedDB), never uploaded anywhere. Each clip has a
 * setting (beach, metro, street…), a pose and a description. Claude can watch a clip and fill those in; you can edit them.
 * The Studio then picks clips for the scenes of a script automatically.
 */
(() => {
  "use strict";
  const DB = "reel-studio-clips",
    META = "meta",
    BLOB = "blobs";
  let dbp = null;
  const SETTINGS = [
    "beach",
    "metro",
    "street",
    "bus stand",
    "interview",
    "court",
    "kitchen",
    "office",
    "home",
    "classroom",
    "airport",
    "other",
  ];
  const POSES = ["standing", "sitting", "walking", "mixed"];

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let rq;
      try {
        rq = indexedDB.open(DB, 1);
      } catch (e) {
        rej(new Error("This browser blocks storage for clips."));
        return;
      }
      rq.onupgradeneeded = () => {
        rq.result.createObjectStore(META, { keyPath: "id" });
        rq.result.createObjectStore(BLOB, { keyPath: "id" });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(new Error("Could not open the clip library."));
    });
    return dbp;
  }
  const tx = async (stores, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      let out;
      Promise.resolve(fn(t)).then((v) => (out = v));
      t.oncomplete = () => res(out);
      t.onerror = t.onabort = () =>
        rej(t.error || new Error("Storage failed."));
    });
  };
  const req = (r) =>
    new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });

  let cache = null; // meta kept in memory for synchronous reads
  const urls = new Map(); // id -> object URL

  async function list() {
    if (cache) return cache;
    const all = await tx([META], "readonly", (t) =>
      req(t.objectStore(META).getAll()),
    );
    cache = all.sort((a, b) => a.created - b.created);
    return cache;
  }
  /** Meta already loaded (call list() first). */
  const loaded = () => cache || [];
  const uid = () =>
    "c" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4);

  function guess(name) {
    const n = name.toLowerCase();
    const map = [
      ["beach", /beach|sea|coast/],
      ["metro", /metro|train|station|platform/],
      ["street", /street|auto|rickshaw|road/],
      ["bus stand", /bus/],
      ["interview", /interview|window|embassy|counter|appa|folder/],
      ["court", /court|judge|trial/],
      ["kitchen", /kitchen|amma|since_child|childhood|refund/],
      ["office", /office|agent|sharma|overseas/],
    ];
    const hit = map.find(([, re]) => re.test(n));
    return hit ? hit[0] : "other";
  }
  /** A still from the clip, for the thumbnail, plus its length. */
  function inspect(blob) {
    return new Promise((res) => {
      const url = URL.createObjectURL(blob),
        v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.src = url;
      const done = (o) => {
        URL.revokeObjectURL(url);
        res(o);
      };
      v.onerror = () => done({ duration: 0, thumb: "" });
      v.onloadeddata = () => {
        const dur = isFinite(v.duration) ? v.duration : 0;
        v.currentTime = Math.min(1, Math.max(0, dur * 0.1));
        v.onseeked = () => {
          try {
            const c = document.createElement("canvas");
            c.width = 135;
            c.height = Math.round(
              (135 * (v.videoHeight || 1280)) / (v.videoWidth || 720),
            );
            c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
            done({
              duration: dur,
              thumb: c.toDataURL("image/jpeg", 0.6),
              w: v.videoWidth,
              h: v.videoHeight,
            });
          } catch (e) {
            done({ duration: dur, thumb: "" });
          }
        };
      };
    });
  }
  async function add(file) {
    if (
      !/^video\//.test(file.type) &&
      !/\.(mp4|mov|webm|m4v)$/i.test(file.name)
    )
      throw new Error(file.name + " is not a video file.");
    if (file.size > 150 * 1024 * 1024)
      throw new Error(file.name + " is over 150 MB.");
    const info = await inspect(file);
    if (!info.duration)
      throw new Error(
        "This browser can't read " + file.name + ". Try MP4 (H.264).",
      );
    const meta = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ""),
      type: file.type || "video/mp4",
      size: file.size,
      duration: Math.round(info.duration * 10) / 10,
      w: info.w || 0,
      h: info.h || 0,
      thumb: info.thumb,
      setting: guess(file.name),
      pose: "standing",
      desc: "",
      tags: [],
      trimEnd: /vvisas|v-visa/i.test(file.name) ? 5.5 : 0, // the V-VISAS end card is not scene footage
      trimStart: /vvisas|v-visa/i.test(file.name) ? 4.5 : 0, // a title burnt into the first seconds
      analysed: false,
      created: Date.now(),
    };
    await tx([META, BLOB], "readwrite", (t) => {
      t.objectStore(META).put(meta);
      t.objectStore(BLOB).put({ id: meta.id, blob: file });
    });
    (await list()).push(meta);
    return meta;
  }
  async function update(id, patch) {
    const all = await list(),
      m = all.find((x) => x.id === id);
    if (!m) return null;
    Object.assign(m, patch);
    await tx([META], "readwrite", (t) => t.objectStore(META).put(m));
    return m;
  }
  async function remove(id) {
    await tx([META, BLOB], "readwrite", (t) => {
      t.objectStore(META).delete(id);
      t.objectStore(BLOB).delete(id);
    });
    cache = (await list()).filter((x) => x.id !== id);
    if (urls.has(id)) {
      URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
    }
  }
  async function blob(id) {
    const r = await tx([BLOB], "readonly", (t) =>
      req(t.objectStore(BLOB).get(id)),
    );
    return r ? r.blob : null;
  }
  /** Object URLs for the given clip ids (created once and kept). */
  async function ensure(ids) {
    for (const id of ids) {
      if (urls.has(id)) continue;
      const b = await blob(id);
      if (b) urls.set(id, URL.createObjectURL(b));
    }
  }
  const urlOf = (id) => urls.get(id) || "";
  /** Where a clip's usable footage ends (the end card is cut off). */
  const usable = (m) => Math.max(1, (m.duration || 1) - (m.trimEnd || 0));
  /** Footage starts after any title burnt into the first seconds. */
  const first = (m) =>
    Math.min(Math.max(0, m.trimStart || 0), Math.max(0, usable(m) - 2));

  window.ClipStore = {
    list,
    loaded,
    add,
    update,
    remove,
    blob,
    ensure,
    urlOf,
    usable,
    SETTINGS,
    POSES,
  };
})();
