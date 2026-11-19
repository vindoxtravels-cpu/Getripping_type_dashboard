/* Loads template packs from a public GitHub repository. A pack is one or more .json files, each holding a template
 * object, an array of them, or { "templates": [...] }. Templates are data only (colours, a background style, a built-in
 * look, a font): nothing from the repository is ever run as code. Files are read from raw.githubusercontent.com.
 */
(() => {
  "use strict";
  const NAME = /^(?!\.{1,2}$)[A-Za-z0-9._-]+$/;
  const MAX_FILES = 80,
    MAX_BYTES = 60000;

  /** "owner/repo", "github.com/owner/repo", or ".../tree/branch/folder" → { owner, repo, ref, path } */
  function parseRepo(input) {
    let t = String(input || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^(www\.)?github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "");
    const p = t.split("/").filter(Boolean);
    if (p.length < 2) return null;
    const [owner, repo] = p;
    if (!NAME.test(owner) || !NAME.test(repo)) return null;
    let ref = "",
      path = "";
    if (p[2] === "tree" && p[3]) {
      ref = p[3];
      path = p.slice(4).join("/");
    } else if (p.length > 2) path = p.slice(2).join("/");
    if (ref && !NAME.test(ref)) return null;
    if (path && !path.split("/").every((s) => NAME.test(s))) return null;
    return { owner, repo, ref, path };
  }

  async function getJson(url) {
    let r;
    try {
      r = await fetch(url, {
        headers: { accept: "application/vnd.github+json" },
      });
    } catch (e) {
      throw new Error("Could not reach GitHub. Check your connection.");
    }
    if (r.status === 404)
      throw Object.assign(new Error("not found"), { notFound: true });
    if (r.status === 403 || r.status === 429)
      throw new Error(
        "GitHub's request limit was reached. Wait a few minutes and try again.",
      );
    if (!r.ok) throw new Error(`GitHub answered ${r.status}.`);
    return r.json();
  }

  /** Read every template file in a repo folder. Resolves { templates: [raw], files: n, errors: [text] }. */
  async function fetchPack(input) {
    const loc = parseRepo(input);
    if (!loc)
      throw new Error(
        "Enter a GitHub repository like owner/repo or https://github.com/owner/repo.",
      );
    const base = `https://api.github.com/repos/${loc.owner}/${loc.repo}/contents/`;
    const q = loc.ref ? `?ref=${encodeURIComponent(loc.ref)}` : "";
    const tries = loc.path ? [loc.path] : ["templates", ""];
    let listing = null;
    for (const dir of tries) {
      try {
        listing = await getJson(base + dir + q);
        break;
      } catch (e) {
        if (!e.notFound) throw e;
      }
    }
    if (!listing)
      throw new Error(
        "Could not find that repository or folder. Only public repositories work, and templates go in a templates/ folder (or the folder you linked).",
      );
    const entries = (Array.isArray(listing) ? listing : [listing])
      .filter((f) => f && f.type === "file" && /\.json$/i.test(f.name))
      .slice(0, MAX_FILES);
    if (!entries.length)
      throw new Error("No .json template files were found there.");
    const out = { templates: [], files: 0, errors: [] };
    for (const f of entries) {
      if (f.size > MAX_BYTES) {
        out.errors.push(`${f.name}: file is too large`);
        continue;
      }
      if (
        typeof f.download_url !== "string" ||
        !f.download_url.startsWith("https://raw.githubusercontent.com/")
      ) {
        out.errors.push(`${f.name}: could not be downloaded`);
        continue;
      }
      try {
        const r = await fetch(f.download_url);
        if (!r.ok) throw new Error("download failed");
        const j = JSON.parse(await r.text());
        const list = Array.isArray(j)
          ? j
          : j && Array.isArray(j.templates)
            ? j.templates
            : [j];
        out.templates.push(...list);
        out.files++;
      } catch (e) {
        out.errors.push(`${f.name}: not valid JSON`);
      }
    }
    return out;
  }

  const API = { parseRepo, fetchPack };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else window.Templates = API;
})();
