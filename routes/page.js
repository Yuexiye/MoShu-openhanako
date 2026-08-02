import { safeProjectId } from "../lib/config.js";
import fs from "node:fs";
import path from "node:path";

const MAX_IMG = 10 * 1024 * 1024;
 
export default function (app, ctx) {
  const pid = ctx.pluginId, dd = ctx.dataDir, pd = ctx.pluginDir;
  // 启动时读取 assets 内嵌到 JS
  var APPJS = "", APPCSS = "", WORLD_MAP_JS = "", VIEW_UTILS = "", VIEW_WRITING = "", VIEW_MAP = "", VIEW_DASH = "", VIEW_TLVIZ = "";
  var jsp = path.join(pd, "assets", "app.js"), csp = path.join(pd, "assets", "app.css"), wmp = path.join(pd, "assets", "world-map.js");
  var vup = path.join(pd, "assets", "views", "utils.js"), vwp = path.join(pd, "assets", "views", "writing.js"), vmp = path.join(pd, "assets", "views", "map.js"), vdp = path.join(pd, "assets", "views", "dashboard.js"), vtp = path.join(pd, "assets", "views", "timeline-viz.js");
  try { if(fs.existsSync(jsp)) APPJS = fs.readFileSync(jsp, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(csp)) APPCSS = fs.readFileSync(csp, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(vup)) VIEW_UTILS = fs.readFileSync(vup, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(vwp)) VIEW_WRITING = fs.readFileSync(vwp, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(vmp)) VIEW_MAP = fs.readFileSync(vmp, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(vdp)) VIEW_DASH = fs.readFileSync(vdp, "utf-8"); } catch(e) {}
  try { if(fs.existsSync(vtp)) VIEW_TLVIZ = fs.readFileSync(vtp, "utf-8"); } catch(e) {}

  app.get("/ping", c => c.json({ ok: true, plugin: pid }));
  app.get("/api/projects", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const p = path.join(dd, "projects"); if (!fs.existsSync(p)) return c.json([]); return c.json(fs.readdirSync(p).map(d => { try { const j = path.join(p, d, "project.json"); return fs.existsSync(j) ? JSON.parse(fs.readFileSync(j, "utf-8")) : null; } catch { return null; } }).filter(Boolean)); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project", async c => { try { const fs = await import("node:fs"), path = await import("node:path"), crypto = await import("node:crypto"); const b = await c.req.json(); const id = b.name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, "_").slice(0, 32) + "_" + Date.now().toString(36); const pp = path.join(dd, "projects", id); fs.mkdirSync(pp, { recursive: true }); const proj = { id, name: b.name, type: b.type || "未分类", summary: b.summary || "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; fs.writeFileSync(path.join(pp, "project.json"), JSON.stringify(proj, null, 2), "utf-8"); fs.writeFileSync(path.join(pp, "chapters.json"), JSON.stringify({ chapters: [] }, null, 2), "utf-8"); fs.mkdirSync(path.join(pp, "chapters"), { recursive: true }); fs.mkdirSync(path.join(pp, "cards"), { recursive: true }); return c.json({ ok: true, project: proj }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.delete("/api/project/:id", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const { join } = await import("node:path"); const pp = join(dd, "projects", id); if (fs.existsSync(pp)) fs.rmSync(pp, { recursive: true, force: true }); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/chapters", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const fs = await import("node:fs"), path = await import("node:path");
      const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json");
      if (!fs.existsSync(ip)) return c.json([]);
      const idx = JSON.parse(fs.readFileSync(ip, "utf-8"));
      var dirty = false;
      for (const ch of (idx.chapters || [])) {
        const cp = path.join(p2, "chapters", ch.id + ".md");
        var rawBody = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : "";
        ch.body = rawBody;
        // wordCount: strip frontmatter before counting
        var bodyWithoutFM = rawBody;
        var fmRegex = /^---[\s\S]*?---\s*/;
        var m;
        while ((m = bodyWithoutFM.match(fmRegex)) !== null) {
          bodyWithoutFM = bodyWithoutFM.substring(m[0].length);
        }
        var newWordCount = bodyWithoutFM.replace(/\s/g, "").length;
        if (ch.wordCount !== newWordCount) {
          ch.wordCount = newWordCount;
          dirty = true;
        }
      }
      if (dirty) fs.writeFileSync(ip, JSON.stringify(idx, null, 2), "utf-8");
      return c.json(idx.chapters || []);
    } catch (e) { return c.json({ error: e.message }, 500); }
  });
  app.post("/api/project/:id/chapters", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json"); const idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, "utf-8")) : { chapters: [] }; const now = new Date().toISOString(); if (b && b._delete && b.id) { const di = idx.chapters.findIndex(c2 => c2.id === b.id); if (di >= 0) { idx.chapters.splice(di, 1); try { fs.unlinkSync(path.join(p2, "chapters", b.id + ".md")); } catch(e) {} } } else if (b && b.id) { const i = idx.chapters.findIndex(c2 => c2.id === b.id); if (i >= 0) { idx.chapters[i].title = b.title || idx.chapters[i].title; idx.chapters[i].wordCount = stripFM(b.content || ""); idx.chapters[i].updated_at = now; if (b.volume !== undefined) idx.chapters[i].volume = b.volume || null; if (b.position !== undefined) idx.chapters[i].position = b.position; if (b.status) idx.chapters[i].status = b.status; if (b.content) { fs.writeFileSync(path.join(p2, "chapters", b.id + ".md"), b.content, "utf-8"); idx.chapters[i].summary = generateChapterSummary(b.content); } } } else if (b) { const nid = "ch_" + String(idx.chapters.length + 1).padStart(2, "0"); fs.mkdirSync(path.join(p2, "chapters"), { recursive: true }); fs.writeFileSync(path.join(p2, "chapters", nid + ".md"), b.content || "", "utf-8"); idx.chapters.push({ id: nid, title: b.title || "new", order: idx.chapters.length + 1, status: "draft", wordCount: stripFM(b.content || ""), position: b.position || null, summary: generateChapterSummary(b.content || ""), hooks: [], created_at: now, updated_at: now }); } fs.writeFileSync(ip, JSON.stringify(idx, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/cards", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const cd = path.join(dd, "projects", id, "cards"); const r = []; for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (fs.existsSync(fp)) { const d = JSON.parse(fs.readFileSync(fp, "utf-8")); if (d.cards) r.push(...d.cards); } } return c.json(r); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/card-meta", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const cid = c.req.query("cid"); const fs = await import("node:fs"), path = await import("node:path"); const cd = path.join(dd, "projects", id, "cards"); for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const d = JSON.parse(fs.readFileSync(fp, "utf-8")); if (d.cards) { const idx = d.cards.findIndex(c2 => c2.id === cid); if (idx >= 0) return c.json({ type: t, file: fp }); } } return c.json({ type: null }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/cards", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const cd = path.join(dd, "projects", id, "cards"); fs.mkdirSync(cd, { recursive: true }); if (b && b.id && b._delete) { for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const data = JSON.parse(fs.readFileSync(fp, "utf-8")); const di = data.cards.findIndex(c2 => c2.id === b.id); if (di >= 0) { data.cards.splice(di, 1); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } } return c.json({ ok: false, error: "not found" }, 404); } else if (b && b.id) { var oldFile = null, oldData = null, oldIndex = -1; for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const data = JSON.parse(fs.readFileSync(fp, "utf-8")); const idx = data.cards.findIndex(c2 => c2.id === b.id); if (idx >= 0) { oldFile = fp; oldData = data; oldIndex = idx; break; } } if (oldFile) { oldData.cards.splice(oldIndex, 1); fs.writeFileSync(oldFile, JSON.stringify(oldData, null, 2), "utf-8"); } const t = b.type || "characters"; const fp = path.join(cd, t + ".json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { cards: [] }; const card = { id: b.id, name: b.name || "", type: t, subtype: b.subtype || null, content: b.content !== undefined ? b.content : {}, tags: b.tags || [], updated_at: new Date().toISOString() }; data.cards.push(card); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } else { const t = b.type || "characters"; const fp = path.join(cd, t + ".json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { cards: [] }; var card = { id: "card_" + Date.now().toString(36), name: b.name || "", type: t, subtype: b.subtype || null, content: b.content || {}, tags: b.tags || [], created_at: new Date().toISOString() }; data.cards.push(card); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/markers", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const mid = c.req.query("map") || ""; const fp = path.join(dd, "projects", id, "maps.json"); if (!fs.existsSync(fp)) return c.json([]); const data = JSON.parse(fs.readFileSync(fp, "utf-8")); if (mid && data.maps) { var m = data.maps.find(function(x) { return x.id === mid; }); return c.json(m ? (m.markers || []) : []); } if (data.maps && data.maps.length > 0) return c.json(data.maps[0].markers || []); return c.json([]); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/markers", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const mid = b._mapId || ""; const fp = path.join(dd, "projects", id, "maps.json"); var data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { maps: [{ id: "map_default", name: "默认地图", markers: [] }] }; if (!data.maps || data.maps.length === 0) data.maps = [{ id: "map_default", name: "默认地图", markers: [] }]; var mi = mid ? data.maps.findIndex(function(x) { return x.id === mid; }) : 0; if (mi < 0) mi = 0; data.maps[mi].markers = b.markers || b; if (b.shapes !== undefined) data.maps[mi].shapes = b.shapes; if (b.backgroundImage !== undefined) data.maps[mi].backgroundImage = b.backgroundImage; fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  // 多地图管理
  app.get("/api/project/:id/maps", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fp = path.join(dd, "projects", id, "maps.json"); if (!fs.existsSync(fp)) return c.json({ maps: [] }); return c.json(JSON.parse(fs.readFileSync(fp, "utf-8"))); } catch(e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/maps", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const b = await c.req.json(); const fp = path.join(dd, "projects", id, "maps.json"); var data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { maps: [{ id: "map_default", name: "默认地图", markers: [] }] }; if (!data.maps) data.maps = [{ id: "map_default", name: "默认地图", markers: [] }]; if (b.action === "create") { data.maps.push({ id: "map_" + Date.now().toString(36), name: b.name || "新地图", markers: [] }); } else if (b.action === "update") { var m = data.maps.find(function(x) { return x.id === b.id; }); if (m) { if (b.name !== undefined) m.name = b.name; } } else if (b.action === "delete") { data.maps = data.maps.filter(function(x) { return x.id !== b.id; }); } fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json(data); } catch(e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/facts", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "projects", id, "facts.jsonl"); if (!fs.existsSync(fp)) return c.json([]); const lines = fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()); return c.json(lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/facts", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "projects", id, "facts.jsonl"); const crypto = await import("node:crypto"); const fact = { id: b.id || ('fact_' + crypto.randomUUID()), type: b.type || 'world_lore', content: b.content, source_chapter: b.sourceChapter || null, confidence: b.confidence !== undefined ? b.confidence : 1.0, tags: b.tags || [], created_at: b.created_at || new Date().toISOString(), deprecated_at: null, overridden_by: null }; const lines = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()) : []; const existing = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); const idx = existing.findIndex(f => f.id === fact.id); if (idx >= 0) { existing[idx] = fact; } else { existing.push(fact); } fs.writeFileSync(fp, existing.map(f => JSON.stringify(f)).join("\n") + "\n", "utf-8"); return c.json({ ok: true, fact: fact }); } catch (e) { return c.json({ error: e.message }, 500); } });
  // 大纲 API
  app.get("/api/project/:id/outline", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "projects", id, "outline.json"); if (!fs.existsSync(fp)) return c.json({ arcs: [] }); return c.json(JSON.parse(fs.readFileSync(fp, "utf-8"))); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/outline", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "projects", id, "outline.json"); fs.writeFileSync(fp, JSON.stringify(b, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
// Strip YAML front matter ---...--- from markdown content, return body only
  function stripFM(content) {
    if (!content) return 0;
    var clean = content;
    var fmRegex = /^---[\s\S]*?---\s*/;
    var m;
    while ((m = clean.match(fmRegex)) !== null) {
      clean = clean.substring(m[0].length);
    }
    return clean.replace(/\s/g, "").length;
  }

  // HTML 属性转义，防注入
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 章节排序 API
  app.post("/api/project/:id/reorder", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json"); if (!fs.existsSync(ip)) return c.json({ ok: false, error: "no chapters" }, 404); const idx = JSON.parse(fs.readFileSync(ip, "utf-8")); const idOrder = {}; b.orderedIds.forEach((cid, i) => { idOrder[cid] = i + 1; }); idx.chapters.forEach(ch => { if (idOrder[ch.id] !== undefined) ch.order = idOrder[ch.id]; }); idx.chapters.sort((a, b) => (a.order || 0) - (b.order || 0)); fs.writeFileSync(ip, JSON.stringify(idx, null, 2), "utf-8"); return c.json({ ok: true, count: idx.chapters.length }); } catch (e) { return c.json({ error: e.message }, 500); } });

  // 世界地图
  app.get("/api/world/locations", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "world.json"); return c.json(fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")).locations || [] : []); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/world/locations", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "world.json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { locations: [] }; if (b.id) { const i = data.locations.findIndex(l => l.id === b.id); if (i >= 0) { Object.assign(data.locations[i], b); data.locations[i].updated_at = new Date().toISOString(); } } else { data.locations.push({ id: 'loc_' + Date.now().toString(36), name: b.name || '', type: b.type || 'default', worldId: b.worldId || 'default', lat: b.lat || 35, lng: b.lng || 105, description: b.description || '', projectId: b.projectId || null, tags: b.tags || [], created_at: new Date().toISOString() }); } fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true, count: data.locations.length }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.delete("/api/world/locations/:locId", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const lid = c.req.param("locId"); const fp = path.join(dd, "world.json"); if (!fs.existsSync(fp)) return c.json({ ok: false, error: "not found" }); const data = JSON.parse(fs.readFileSync(fp, "utf-8")); data.locations = data.locations.filter(l => l.id !== lid); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/app", async (c) => {
    const token = c.req.query("token") || "", hcss = c.req.query("hana-css") || "", base = "/api/plugins/" + pid;
    const theme = c.req.query("hana-theme") || "dark";
    // 每次请求重新读取，确保修改立即生效
    const vwjs = fs.readFileSync(vwp, "utf-8");
    return c.html('<!DOCTYPE html><html data-hana-theme="' + esc(theme) + '"><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>墨述</title>' + (hcss ? '<link rel="stylesheet" href="' + hcss + '">' : "") + '<style>' + APPCSS + '</style></head><body><div id=root></div><script>var API=' + JSON.stringify(base) + ',TOKEN=' + JSON.stringify(token) + ';' + VIEW_UTILS + vwjs + VIEW_MAP + VIEW_DASH + VIEW_TLVIZ + '</script><script>' + APPJS + '</script></body></html>');
  });
  app.get("/world", async (c) => {
    const token = c.req.query("token") || "", hcss = c.req.query("hana-css") || "", base = "/api/plugins/" + pid, theme = c.req.query("hana-theme") || "dark";
    // 动态读取 world-map.js，保证每次请求都是最新的
    const wmjs = fs.readFileSync(path.join(pd, 'assets', 'world-map.js'), 'utf-8');
    var head = '';
    if (hcss) head += '<link rel="stylesheet" href="' + hcss + '">';
    head += '<style>' + APPCSS + 'html,body{margin:0;padding:0;height:100%;overflow:hidden}#wm{width:100%;height:100%}button:focus{outline:none}</style>';
    head += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
    return c.html('<!DOCTYPE html><html data-hana-theme="' + esc(theme) + '"><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>墨述 · 世界地图</title>' + head + '</head><body><div id="wm"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var API=' + JSON.stringify(base) + ',TOKEN=' + JSON.stringify(token) + ';' + wmjs + '</script></body></html>');
  });
  // 向后兼容旧路由 —— 返回「规划中」页面，说明功能与预计上线时间
  function planningPage(c, { title, desc, eta }) {
    const theme = c.req.query("hana-theme") || "dark";
    const style = theme === "light"
      ? "background:#f0f0f5;color:#2a2a3a;--muted:#6a6a80;--accent:#1a9fd0;--card:#fff"
      : "background:#1a1a2e;color:#e6e6f0;--muted:#a0a0c0;--accent:#6366f1;--card:#16213e";
    return c.html('<!DOCTYPE html><html data-hana-theme="' + esc(theme) + '"><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>墨述 · ' + title + '</title>'
      + '<style>body{margin:0;font-family:system-ui,-apple-system,"Microsoft YaHei UI",sans-serif;height:100vh;display:flex;align-items:center;justify-content:center;' + style + '}'
      + '.card{max-width:520px;padding:32px 36px;background:var(--card);border:1px solid rgba(120,120,160,0.25);border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.35)}'
      + 'h1{margin:0 0 6px;font-size:22px;display:flex;align-items:center;gap:8px}'
      + '.badge{display:inline-block;margin-bottom:14px;padding:3px 10px;font-size:12px;border-radius:999px;background:rgba(99,102,241,0.18);color:var(--accent)}'
      + 'p{margin:10px 0;line-height:1.7;color:var(--muted);font-size:14px}'
      + '.eta{margin-top:18px;padding:12px 14px;background:rgba(99,102,241,0.1);border-left:3px solid var(--accent);border-radius:6px;font-size:13px;color:var(--fg,#e6e6f0)}'
      + 'a{color:var(--accent);text-decoration:none}</style></head>'
      + '<body><div class=card><span class=badge>规划中</span><h1>📝 ' + title + '</h1>'
      + '<p>' + desc + '</p>'
      + '<div class=eta>预计上线：' + eta + '</div>'
      + '<p style="margin-top:18px"><a href="/api/plugins/' + pid + '/app">← 返回墨述主界面</a></p>'
      + '<script>try{parent.postMessage({type:"ready"},"*")}catch(e){}</script>'
      + '</div></body></html>');
  }
  app.get("/workbench", (c) => planningPage(c, {
    title: "写作工作台",
    desc: "综合写作界面，整合大纲、正文编辑、角色/世界观卡片与实时上下文联想，并支持多 Agent 协同写作流程。将取代当前分散在各 Tab 的编辑体验。",
    eta: "随 v0.2 写作模块重构，预计 2026 年 8 月内上线。",
  }));
  app.get("/dashboard", (c) => planningPage(c, {
    title: "项目概览仪表盘",
    desc: "项目级看板：总字数 / 日更趋势、章节进度、伏笔回收率、交叉校验告警，以及一键导出（HTML / TXT / 互动小说）入口汇总。",
    eta: "随 v0.3 数据看板模块，预计 2026 年 9 月上线。",
  }));
  app.get("/map", (c) => planningPage(c, {
    title: "世界地图可视化",
    desc: "基于地理位置的设定可视化，在地图上标注地点、势力与关键事件，支持多地图管理。地图能力已在 /world 入口提供，/map 将作为侧栏统一入口并入。",
    eta: "侧栏入口整理随下一迭代，地图功能现已可在「世界地图」中使用。",
  }));

  // 时间线数据
  app.get("/api/project/:id/timeline-data", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const fs = await import("node:fs"), path = await import("node:path");
      const p2 = path.join(dd, "projects", id);
      const sp = path.join(p2, "structure.json");
      const ip = path.join(p2, "chapters.json");
      const timeline = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, "utf-8")).timeline || [] : [];
      const chapters = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, "utf-8")).chapters || [] : [];
      return c.json({ ok: true, timeline, chapters });
    } catch (e) { return c.json({ error: e.message }, 500); }
  });

  // 交叉验证
  app.get("/api/project/:id/cross-validate", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const p2 = path.join(dd, "projects", id);
      const { crossValidate } = await import("../lib/cross-validate.js");

      var cards = [];
      for (let t of ["characters", "world", "style"]) {
        var cp = path.join(p2, "cards", t + ".json");
        if (fs.existsSync(cp)) {
          var d = JSON.parse(fs.readFileSync(cp, "utf-8"));
          if (d.cards) cards = cards.concat(d.cards.map(function(c) { c.type = t; return c; }));
        }
      }
      var facts = [];
      var fp = path.join(p2, "facts.jsonl");
      if (fs.existsSync(fp)) {
        facts = fs.readFileSync(fp, "utf-8").split("\n").filter(function(l) { return l.trim(); }).map(function(l) { return JSON.parse(l); });
      }
      var chapters = [];
      var chp = path.join(p2, "chapters.json");
      if (fs.existsSync(chp)) {
        var idx = JSON.parse(fs.readFileSync(chp, "utf-8"));
        chapters = idx.chapters || [];
        for (var ci = 0; ci < chapters.length; ci++) {
          var bdp = path.join(p2, "chapters", chapters[ci].id + ".md");
          chapters[ci].body = fs.existsSync(bdp) ? fs.readFileSync(bdp, "utf-8") : "";
        }
      }

      return c.json(crossValidate(cards, facts, chapters, p2, fs, path));
    } catch (e) {
      return c.json({ error: e.message }, 500);
    }
  });
  // 伏笔管理 API
  app.get("/api/project/:id/plot-threads", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const { listThreads } = await import("../lib/plot-thread.js");
      return c.json(listThreads(dd, id));
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  app.post("/api/project/:id/plot-threads", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const b = await c.req.json();
      const { addThread, updateThread, removeThread, advanceStatus } = await import("../lib/plot-thread.js");
      if (b._delete && b.id) return c.json(removeThread(dd, id, b.id));
      if (b._advance && b.id) return c.json(advanceStatus(dd, id, b.id));
      if (b.id) return c.json(updateThread(dd, id, b.id, b));
      return c.json(addThread(dd, id, { title: b.title, type: b.type, status: b.status, description: b.description, plantedChapter: b.plantedChapter, echoedChapters: b.echoedChapters, resolvedChapter: b.resolvedChapter }));
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 多 Agent 写作 API
  app.get("/api/project/:id/multi-agent/status", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      var cp = path.join(dd, "projects", id, "workflow-config.json");
      if (!fs.existsSync(cp)) return c.json({ ok: true, status: "未配置", stages: [{stage:"settings",label:"设定",status:"unconfigured"},{stage:"outline",label:"大纲",status:"unconfigured"},{stage:"draft",label:"正文",status:"unconfigured"},{stage:"review",label:"审稿",status:"unconfigured"}] });
      var config = JSON.parse(fs.readFileSync(cp, "utf-8"));
      var STAGES = ["settings","outline","draft","review"];
      var LABELS = {settings:"设定",outline:"大纲",draft:"正文",review:"审稿"};
      var stages = STAGES.map(function(s) { return { stage:s, label:LABELS[s], status:(config.stages&&config.stages[s]?config.stages[s].status:"pending")||"pending", agentId:(config.roles&&config.roles[s]?config.roles[s].agentId:null)||null, model:(config.roles&&config.roles[s]?config.roles[s].model:null)||null }; });
      return c.json({ ok: true, currentStage: config.currentStage||null, stages: stages });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  app.post("/api/project/:id/multi-agent/configure", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const b = await c.req.json();
      var config = {
        roles: b.roles || { settings:{agentId:null,model:null}, outline:{agentId:null,model:null}, draft:{agentId:null,model:null}, review:{agentId:null,model:null} },
        currentStage: null,
        stages: { settings:{status:"pending",startedAt:null,completedAt:null}, outline:{status:"pending",startedAt:null,completedAt:null}, draft:{status:"pending",startedAt:null,completedAt:null}, review:{status:"pending",startedAt:null,completedAt:null} },
        createdAt: new Date().toISOString(),
      };
      var p2 = path.join(dd, "projects", id);
      fs.writeFileSync(path.join(p2, "workflow-config.json"), JSON.stringify(config, null, 2), "utf-8");
      return c.json({ ok: true });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // txt2world API
  app.post("/api/project/:id/txt2world", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const b = await c.req.json();
      const text = b.text || "";
      if (!text || text.length < 10) return c.json({ error: "文本太短" }, 400);
      const p2 = path.join(dd, "projects", id);
      // 保存文本
      fs.writeFileSync(path.join(p2, "import-source.txt"), text, "utf-8");
      // 分块
      var chunks = [];
      var paragraphs = text.split(/\n\s*\n/);
      var current = "";
      for (var pi = 0; pi < paragraphs.length; pi++) {
        if (current.length + paragraphs[pi].length > 1500 && current) {
          chunks.push(current);
          current = paragraphs[pi];
        } else { current += (current ? "\n\n" : "") + paragraphs[pi]; }
      }
      if (current) chunks.push(current);
      // 保存状态
      fs.writeFileSync(path.join(p2, "import-state.json"), JSON.stringify({ totalChunks: chunks.length, processed: [], createdAt: new Date().toISOString() }, null, 2), "utf-8");
      return c.json({ ok: true, totalChunks: chunks.length, chunks: chunks.map(function(c, i) { return { index: i, preview: c.slice(0, 80) + "...", length: c.length }; }) });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  app.get("/api/project/:id/txt2world/status", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      var sp = path.join(dd, "projects", id, "import-state.json");
      if (!fs.existsSync(sp)) return c.json({ ok: true, status: "无导入任务" });
      return c.json(JSON.parse(fs.readFileSync(sp, "utf-8")));
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 上下文预览 — 返回结构化上下文命中数据
  app.get("/api/project/:id/context-preview", async (c) => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const p2 = path.join(dd, "projects", id);
      const chapterId = c.req.query("chapterId") || "";
      const chapterTitle = c.req.query("title") || "";

      // 加载卡片
      var allCards = [];
      for (var t of ["characters", "world", "style"]) {
        var cp = path.join(p2, "cards", t + ".json");
        if (fs.existsSync(cp)) {
          var d = JSON.parse(fs.readFileSync(cp, "utf-8"));
          if (d.cards) allCards = allCards.concat(d.cards.map(function(c) { c.type = t; return c; }));
        }
      }

      // 加载事实
      var allFacts = [];
      var fp = path.join(p2, "facts.jsonl");
      if (fs.existsSync(fp)) {
        allFacts = fs.readFileSync(fp, "utf-8").split("\n").filter(function(l) { return l.trim(); }).map(function(l) { return JSON.parse(l); }).filter(function(f) { return !f.deprecated_at && !f.overridden_by; });
      }

      // 加载章节
      var chapters = [];
      var chp = path.join(p2, "chapters.json");
      if (fs.existsSync(chp)) {
        var idx = JSON.parse(fs.readFileSync(chp, "utf-8"));
        chapters = idx.chapters || [];
      }

      // 当前章节序号
      var currentOrder = Infinity;
      if (chapterId) {
        var cur = chapters.find(function(c) { return c.id === chapterId; });
        if (cur) currentOrder = cur.order;
      }

      // 章槛过滤
      var gatedFacts = allFacts.filter(function(f) {
        return !f.chapter_gate || currentOrder >= (parseInt(f.chapter_gate) || 0);
      });

      var constantFacts = gatedFacts.filter(function(f) { return f.constant === true; });
      var nonConstant = gatedFacts.filter(function(f) { return f.constant !== true; });

      // 关键词匹配
      var keywords = (chapterTitle || "").replace(/[第章节卷部]/g, "").split(/[\s,，、]+/).filter(Boolean);
      var matchedFacts = [];
      var unmatchedFacts = [];
      if (keywords.length > 0) {
        nonConstant.forEach(function(f) {
          var text = (f.content + " " + (f.tags || []).join(" ")).toLowerCase();
          if (keywords.some(function(kw) { return text.includes(kw.toLowerCase()); })) {
            matchedFacts.push(f);
          } else {
            unmatchedFacts.push(f);
          }
        });
      } else {
        unmatchedFacts = nonConstant;
      }

      // 卡片匹配（简化：当前正文/标题中提到的角色/世界观）
      var currentBody = "";
      if (chapterId) {
        var bdp = path.join(p2, "chapters", chapterId + ".md");
        if (fs.existsSync(bdp)) currentBody = fs.readFileSync(bdp, "utf-8");
      }
      var matchedCards = allCards.filter(function(c) {
        return currentBody.includes(c.name) || chapterTitle.includes(c.name);
      });
      var unmatchedCards = allCards.filter(function(c) {
        return !currentBody.includes(c.name) && !chapterTitle.includes(c.name);
      });

      // 前文数
      var prevCount = Math.min(3, chapters.filter(function(c) { return c.order < currentOrder; }).length);

      // 实体关系
      var edgeCount = 0;
      var elp = path.join(p2, "graph", "entity_links.jsonl");
      if (fs.existsSync(elp)) {
        edgeCount = fs.readFileSync(elp, "utf-8").split("\n").filter(function(l) { return l.trim(); }).length;
      }

      return c.json({
        cards: { total: allCards.length, matched: matchedCards.length, unmatched: unmatchedCards.length,
          matchedItems: matchedCards.map(function(c) { return { name: c.name, type: c.type }; }),
          unmatchedItems: unmatchedCards.map(function(c) { return { name: c.name, type: c.type }; }) },
        facts: { total: allFacts.length, constant: constantFacts.length, keywordMatched: matchedFacts.length, unmatched: unmatchedFacts.length,
          matchedItems: matchedFacts.map(function(f) { return { content: f.content, type: f.type, priority: f.priority || 0 }; }),
          constantItems: constantFacts.map(function(f) { return { content: f.content, type: f.type }; }) },
        previousChapters: prevCount,
        graphEdges: edgeCount
      });
    } catch (e) {
      return c.json({ error: e.message }, 500);
    }
  });
  // 导出 HTML（原 EPUB 按钮）
  app.get("/api/project/:id/export/epub", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const pd = path.join(dd, "projects", id);
      const ip = path.join(pd, "chapters.json");
      if (!fs.existsSync(ip)) return c.json({ error: "no chapters" }, 404);
      const idx = JSON.parse(fs.readFileSync(ip, "utf-8"));
      const chList = (idx.chapters || []).slice().sort(function(a,b){return (a.order||0)-(b.order||0)});
      for (var i = 0; i < chList.length; i++) {
        var cp = path.join(pd, "chapters", chList[i].id + ".md");
        chList[i].body = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : "";
      }
      var html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + id + "</title><style>body{font-family:serif;line-height:1.8;max-width:600px;margin:0 auto;padding:20px}h2{page-break-before:always;margin-top:2em}</style></head><body>";
      chList.forEach(function(ch) {
        html += "<h2>" + (ch.title||"无题") + "</h2>\n";
        html += "<div>" + (ch.body||"").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>") + "</div>\n";
      });
      html += "</body></html>";
      var outPath = path.join(dd, "export", id + ".html");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, "utf-8");
      return c.json({ ok: true, path: outPath, format: "html" });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 导出 TXT
  app.get("/api/project/:id/export/txt", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const pd = path.join(dd, "projects", id);
      const ip = path.join(pd, "chapters.json");
      if (!fs.existsSync(ip)) return c.json({ error: "no chapters" }, 404);
      const idx = JSON.parse(fs.readFileSync(ip, "utf-8"));
      const chList = (idx.chapters || []).slice().sort(function(a,b){return (a.order||0)-(b.order||0)});
      for (var i = 0; i < chList.length; i++) {
        var cp = path.join(pd, "chapters", chList[i].id + ".md");
        chList[i].body = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : "";
      }
      var content = "";
      chList.forEach(function(ch) {
        content += "\n\n" + (ch.title||"无题") + "\n\n" + (ch.body||"") + "\n";
      });
      var outPath = path.join(dd, "export", id + ".txt");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, content, "utf-8");
      return c.json({ ok: true, path: outPath, format: "txt" });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 导出 SugarCube 互动小说
  app.get("/api/project/:id/export/twine", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const { join } = await import("node:path");
      const storygamePath = join(pd, "tools", "storygame.js");
      const { execute } = await import("file://" + storygamePath.replace(/\\/g, "/") + "?t=" + Date.now());
      const result = await execute({ projectId: id, mode: "twine", outputDir: "export" });
      const data = JSON.parse(result.content[0].text);
      if (!data.ok) return c.json({ error: data.message }, 500);
      return c.json({ ok: true, file: data.file, stats: data.stats });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 导出线性阅读
  app.get("/api/project/:id/export/linear", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const { join } = await import("node:path");
      const storygamePath = join(pd, "tools", "storygame.js");
      const { execute } = await import("file://" + storygamePath.replace(/\\/g, "/") + "?t=" + Date.now());
      const result = await execute({ projectId: id, mode: "linear", outputDir: "export" });
      const data = JSON.parse(result.content[0].text);
      if (!data.ok) return c.json({ error: data.message }, 500);
      return c.json({ ok: true, file: data.file, stats: data.stats });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 导出互动文游素材包
  app.get("/api/project/:id/export/game", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const { join } = await import("node:path");
      const storygamePath = join(pd, "tools", "storygame.js");
      const { execute } = await import("file://" + storygamePath.replace(/\\/g, "/") + "?t=" + Date.now());
      const result = await execute({ projectId: id, mode: "game", outputDir: "export" });
      const data = JSON.parse(result.content[0].text);
      if (!data.ok) return c.json({ error: data.message }, 500);
      return c.json({ ok: true, file: data.file, stats: data.stats, message: data.message });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 导出地图 HTML
  app.get("/api/project/:id/export/map", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const mid = c.req.query("map") || "";
      const fp = path.join(dd, "projects", id, "maps.json");
      var markers = [];
      var mapName = "地图";
      if (fs.existsSync(fp)) {
        var data = JSON.parse(fs.readFileSync(fp, "utf-8"));
        if (mid && data.maps) {
          var m = data.maps.find(function(x) { return x.id === mid; });
          if (m) { markers = m.markers || []; mapName = m.name || "地图"; }
        } else if (data.maps && data.maps.length > 0) {
          markers = data.maps[0].markers || [];
          mapName = data.maps[0].name || "地图";
        }
      }
      var h = "<!DOCTYPE html><html><head><meta charset=utf-8><title>" + id + " - " + mapName + "</title>";
      h += "<style>body{font-family:system-ui,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#6366f1}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5}</style>";
      h += "</head><body><h1>🗺 " + mapName + "</h1><table><tr><th>名称</th><th>描述</th></tr>";
      markers.forEach(function(m) {
        h += "<tr><td>" + (m.name||"") + "</td><td>" + (m.description||"") + "</td></tr>";
      });
      h += "</table></body></html>";
      var outPath = path.join(dd, "export", id + "_map.html");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, h, "utf-8");
      return c.json({ ok: true, path: outPath, format: "html" });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 实体关系图 + 情节关系图 API
  app.get("/api/project/:id/graph", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const graphType = c.req.query("type") || "entity";
      const fname = graphType === "plot" ? "chapter_links.jsonl" : (graphType === "facts" ? "fact_links.jsonl" : "entity_links.jsonl");
      const fp = path.join(dd, "projects", id, "graph", fname);
      if (!fs.existsSync(fp)) {
        // 如果请求 entity 但 entity_links 不存在，也尝试 fact_links
        if (graphType === "entity") {
          const factFp = path.join(dd, "projects", id, "graph", "fact_links.jsonl");
          if (fs.existsSync(factFp)) {
            // 合并 entity 和 fact
            return mergeGraphApi(c, id);
          }
          return c.json({ nodes: [], edges: [] });
        }
        return c.json({ nodes: [], edges: [] });
      }
      const lines = fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim());
      const links = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const activeLinks = links.filter(l => !l.deprecatedAt);
      const nodes = new Map();
      const edges = [];
      for (const l of activeLinks) {
        if (!nodes.has(l.source)) nodes.set(l.source, { id: l.source, name: l.sourceName, type: l.sourceType });
        if (!nodes.has(l.target)) nodes.set(l.target, { id: l.target, name: l.targetName, type: l.targetType });
        // 羁绊时间线字段
        edges.push({ 
          id: l.id, 
          source: l.source, 
          target: l.target, 
          relation: l.relation, 
          description: l.description || l.dynamic || '', 
          count: l.count,
          // 新字段
          events: l.events || [],
          strength: l.strength || 0.5,
          status: l.status || 'active',
          lastUpdated: l.lastUpdated,
        });
      }
      return c.json({ nodes: [...nodes.values()], edges });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
  // 合并 entity_links + fact_links（人物关系 + 事实关系）
  async function mergeGraphApi(c, id) {
    const p = await import("node:path"), fs = await import("node:fs");
    const { readJSONL } = await import("../lib/store.js");
    const entityLinks = await import("../lib/graph-store.js").then(m => m.readEntityLinks(dd, id)).catch(() => []);
    const factFp = path.join(dd, "projects", id, "graph", "fact_links.jsonl");
    const factLinks = fs.existsSync(factFp) ? await readJSONL(factFp) : [];
    const activeLinks = [...(entityLinks.filter(l => !l.deprecatedAt)), ...factLinks.filter(l => !l.deprecatedAt)];
    const nodes = new Map();
    const edges = [];
    for (const l of activeLinks) {
      if (!nodes.has(l.source)) nodes.set(l.source, { id: l.source, name: l.sourceName, type: l.sourceType });
      if (!nodes.has(l.target)) nodes.set(l.target, { id: l.target, name: l.targetName, type: l.targetType });
      // 羁绊时间线字段
      edges.push({ 
        id: l.id, 
        source: l.source, 
        target: l.target, 
        relation: l.relation, 
        description: l.description || l.dynamic || '', 
        count: l.count,
        events: l.events || [],
        strength: l.strength || 0.5,
        status: l.status || 'active',
        lastUpdated: l.lastUpdated,
      });
    }
    return c.json({ nodes: [...nodes.values()], edges });
  }

  // ── 图谱边操作（增删） ──
  app.post("/api/project/:id/graph/edge", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const body = await c.req.json();
      const action = body.action;
      const graphType = body.graphType || "entity";
      const fname = graphType === "plot" ? "chapter_links.jsonl" : "entity_links.jsonl";
      const fp = path.join(dd, "projects", id, "graph", fname);

      const fs = await import("node:fs");
      let lines = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()) : [];
      let links = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

      if (action === "add") {
        const crypto = await import("node:crypto");
        const newEdge = {
          id: "el_" + crypto.randomUUID().slice(0, 8),
          source: body.source,
          sourceName: body.sourceName,
          sourceType: body.sourceType || "character",
          target: body.target,
          targetName: body.targetName,
          targetType: body.targetType || "character",
          relation: body.relation,
          description: body.description || "",
          dynamic: "",
          createdAt: new Date().toISOString(),
          deprecatedAt: null,
        };
        links.push(newEdge);
      } else if (action === "delete") {
        links = links.filter(l => {
          if (l.id === body.edgeId) {
            l.deprecatedAt = new Date().toISOString();
            return false;
          }
          return true;
        });
      }

      const activeLinks = links.filter(l => !l.deprecatedAt);
      const activeDir = path.join(dd, "projects", id, "graph");
      fs.mkdirSync(activeDir, { recursive: true });
      const lines2 = activeLinks.map(l => JSON.stringify(l)).join("\n") + "\n";
      fs.writeFileSync(fp, lines2, "utf-8");

      return c.json({ ok: true });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 图谱节点删除 ──
  app.post("/api/project/:id/graph/node", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const body = await c.req.json();
      const graphType = body.graphType || "entity";
      const fname = graphType === "plot" ? "chapter_links.jsonl" : "entity_links.jsonl";
      const fp = path.join(dd, "projects", id, "graph", fname);

      const fs = await import("node:fs");
      let lines = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()) : [];
      let links = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

      const nodeId = body.nodeId;
      // 标记所有涉及该节点的边为 deprecated
      links = links.filter(l => {
        if (l.source === nodeId || l.target === nodeId) {
          l.deprecatedAt = new Date().toISOString();
          return false;
        }
        return true;
      });

      // 同时清理卡片中涉及该节点的关系（如果节点类型是 character）
      if (body.nodeType === "character" || !body.nodeType) {
        const cardFp = path.join(dd, "projects", id, "cards.json");
        if (fs.existsSync(cardFp)) {
          const cardsData = JSON.parse(fs.readFileSync(cardFp, "utf-8"));
          cardsData.cards = (cardsData.cards || []).map(card => {
            if (card.name === nodeId || card._id === nodeId) {
              // 移除该卡片中所有 relationships
              if (card.relationships) {
                card.relationships = [];
              }
            }
            return card;
          });
          fs.writeFileSync(cardFp, JSON.stringify(cardsData, null, 2), "utf-8");
        }
      }

      // 清理 facts 中涉及该节点的事实
      const factFp = path.join(dd, "projects", id, "facts.jsonl");
      if (fs.existsSync(factFp)) {
        const factsLines = fs.readFileSync(factFp, "utf-8").split("\n").filter(l => l.trim());
        const filtered = factsLines.filter(l => {
          try {
            const f = JSON.parse(l);
            // 如果 fact 的 label/source 涉及该节点，标记 deprecated
            const label = String(f.label || f.name || f.title || "");
            const sourceChapter = String(f.sourceChapter || "");
            // 只清理 label 完全匹配的情况
            return label !== nodeId;
          } catch { return true; }
        });
        fs.writeFileSync(factFp, filtered.join("\n") + "\n", "utf-8");
      }

      const activeLinks = links.filter(l => !l.deprecatedAt);
      const activeDir = path.join(dd, "projects", id, "graph");
      fs.mkdirSync(activeDir, { recursive: true });
      const lines2 = activeLinks.map(l => JSON.stringify(l)).join("\n") + "\n";
      fs.writeFileSync(fp, lines2, "utf-8");

      return c.json({ ok: true });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 章节分析 ──
  app.post("/api/project/:id/analyze", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const { join } = await import("node:path");
      const analyzePath = join(pd, "tools", "analyze.js");
      const { execute } = await import("file://" + analyzePath.replace(/\\/g, "/") + "?t=" + Date.now());
      const body = await c.req.json();
      const result = await execute(body);
      return c.json(JSON.parse(result.content[0].text));
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 章节配图生成 ──
  app.post("/api/project/:id/generate-cover", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const body = await c.req.json();
      var chapterId = body.chapterId || '';
      var style = body.style || 'cinematic, dark atmosphere, anime style';

      // 读取章节内容
      const chapterPath = path.join(dd, "projects", id, "chapters", chapterId + ".md");
      if (!fs.existsSync(chapterPath)) return c.json({ error: "chapter not found" }, 404);
      var chapterBody = fs.readFileSync(chapterPath, "utf-8");
      var chaptersIdx = JSON.parse(fs.readFileSync(path.join(dd, "projects", id, "chapters.json"), "utf-8"));
      var chapter = (chaptersIdx.chapters || []).find(function(ch){ return ch.id === chapterId; });
      if (!chapter) return c.json({ error: "chapter not in index" }, 404);
      var title = chapter.title || 'Untitled';
      var chDir = path.dirname(chapterPath);

      // 提取正文（去掉 markdown 标题和格式标记）
      var bodyText = chapterBody.replace(/^###?\\s+.+$/gm, '').replace(/\\*\\*/g, '').replace(/===/g, '').slice(0, 600);

      // 构建 AI 生图 prompt
      var prompt = 'A cinematic illustration for a novel chapter titled "' + title + '". Scene: ' + bodyText + '. Style: ' + style + '. High quality, detailed, atmospheric lighting, novel illustration style, no text, no watermark.';

      // 通过 bus 调用生图插件（sessionPath 用项目路径代替，绕过 null 检查）
      var fakeSession = path.join(dd, 'projects', id);
      var result = await ctx.bus.request('media-gen:submit-image', {
        input: { type: 'image', prompt: prompt, ratio: '16:9', resolution: '2k' },
        sessionPath: fakeSession,
        metadata: { chapterId: chapterId, chapterTitle: title, projectId: id },
      });

      if (!result || result.ok === false) {
        return c.json({ ok: false, error: result?.error || 'submit failed' }, 500);
      }

      // 异步等待生图完成后自动写入封面到章节
      (async function waitForComplete() {
        try {
          for (var i = 0; i < 60; i++) {
            await new Promise(function(r) { setTimeout(r, 2000); });
            var st = await ctx.bus.request('media-gen:get-task', { taskId: result.tasks[0].taskId });
            if (!st || !st.task) continue;
            var tk = st.task;
            if ((tk.status === 'done' || tk.status === 'completed') && tk.files && tk.files.length > 0) {
              var imgFile = tk.files[0];
              var imgName = typeof imgFile === 'string' ? imgFile : (imgFile.name || imgFile.path);
              // 从 image-gen generated 目录复制到章节目录/文本附件
              var generatedDir = 'W:\\Games\\Hanako\\.hanako\\plugin-data\\image-gen\\generated';
              var srcFile = path.join(generatedDir, imgName);
              var assetDir = path.join(chDir, '文本附件');
              fs.mkdirSync(assetDir, { recursive: true });
              var dstFile = path.join(assetDir, imgName);
              if (fs.existsSync(srcFile)) {
                fs.copyFileSync(srcFile, dstFile);
              } else {
                // 备用：直接从 files 里找
                dstFile = imgName;
              }
              var imgRelPath = '文本附件/' + imgName;
              // 写入封面 YAML front matter（替换所有前导 front matter 块）
              var coverYaml = '---\ncover:\n  image: ' + imgRelPath + '\n---\n';
              var newBody = chapterBody;
              while (newBody.match(/^---[\s\S]*?---\s*/)) {
                newBody = newBody.replace(/^---[\s\S]*?---\s*/, '');
              }
              newBody = coverYaml + newBody;
              fs.writeFileSync(chapterPath, newBody, 'utf-8');
              break;
            }
            if (tk.status === 'failed') break;
          }
        } catch(e) { /* 静默忽略后台写入错误 */ }
      })();

      return c.json({ ok: true, taskId: result.tasks[0].taskId });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 获取生成结果 ──
  app.get("/api/project/:id/generate-cover/status/:taskId", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    const taskId = c.req.param("taskId");
    try {
      var taskResult = await ctx.bus.request('media-gen:get-task', { taskId: taskId });
      if (!taskResult || !taskResult.task) return c.json({ status: 'not_found' });
      var task = taskResult.task;
      return c.json({
        status: task.status,
        files: task.files || [],
        failReason: task.failReason || null,
      });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // --- 单章路由（所有图片内联为 base64）---
  app.get("/api/project/:id/chapter/:chapterId", async c => {
    const id = safeProjectId(c.req.param("id"));
    const chId = c.req.param("chapterId");
    if (!id || !chId) return c.json({ error: "bad id" }, 400);
    try {
      const fs = await import("node:fs"), path = await import("node:path");
      const cp = path.join(dd, "projects", id, "chapters", chId + ".md");
      if (!fs.existsSync(cp)) return c.json({ error: "not found" }, 404);
      var body = fs.readFileSync(cp, "utf-8");
      // Inline all ![alt](path) references (chapter body images)
      body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, p1) {
        if (p1.startsWith("data:")) return match;
        if (!p1.includes("文本附件")) return match;
        var full = path.join(dd, "projects", id, "chapters", p1);
        var norm = full.replace(/\\/g, "/");
        if (fs.existsSync(norm)) {
          try {
            var data = fs.readFileSync(norm);
            var ext = p1.split(".").pop().toLowerCase();
            var mime = {png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp"}[ext] || "image/png";
            return "![" + alt + "](data:" + mime + ";base64," + data.toString("base64") + ")";
          } catch(e) {}
        }
        return match;
      });
      return c.json({ body: body });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

// --- 附件图片访问路由 ---
  app.get("/api/project/:id/asset/*", async c => {
    const id = safeProjectId(c.req.param("id"));
    if (!id) return c.json({ error: "bad id" }, 400);
    try {
      const assetPath = c.req.param("*");
      // Bun Windows audit check uses POSIX paths. Use path.posix.join.
      const pos = await import("node:path/posix");
      const ddPosix = dd.replace(/\\/g, '/');
      const fullPath = pos.join(ddPosix, 'projects', id, 'chapters', assetPath);
      
      if (!fs.existsSync(fullPath)) {
        return c.json({ error: "not found", ddPosix: ddPosix, fullPath: fullPath }, 404);
      }
      
      const ext = assetPath.split(".").pop().toLowerCase();
      const contentType = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        gif: "image/gif", webp: "image/webp", svg: "image/svg+xml"
      }[ext] || "application/octet-stream";
      const buffer = await fs.promises.readFile(fullPath);
      return c.body(buffer, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000"
      });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 手动插入图片到章节 ──
  app.post('/api/project/:id/insert-image', async c => {
    const id = safeProjectId(c.req.param('id'));
    if (!id) return c.json({ error: 'bad id' }, 400);
    try {
      const body = await c.req.json();
      var chapterId = body.chapterId || '';
      var fileName = body.fileName || 'image.png';
      var imageData = body.imageData || '';
      // 去掉 base64 prefix
      var base64Data = '';
      if (imageData.startsWith('data:')) {
        base64Data = imageData.split(',')[1];
      } else {
        base64Data = imageData;
      }
      const Buffer = await import('node:buffer');
      var imgBuf = Buffer.Buffer.from(base64Data, 'base64');
      // 保存到章节目录的 文本附件 子目录
      const chDir = path.join(dd, 'projects', id, 'chapters');
      const assetDir = path.join(chDir, '文本附件');
      fs.mkdirSync(assetDir, { recursive: true });
      // 生成唯一文件名
      var ext = 'png';
      if (fileName.includes('.')) {
        ext = fileName.split('.').pop().toLowerCase().split('?')[0];
        if (!['jpg','jpeg','png','gif','webp'].includes(ext)) ext = 'png';
      }
      var safeName = (chapterId + '_' + Date.now() + '.' + ext).replace(/[^a-zA-Z0-9_.-]/g, '_');
      var filePath = path.join(assetDir, safeName);
      fs.writeFileSync(filePath, imgBuf);
      var imgRelPath = '文本附件/' + safeName;
      // 只保存图片文件，不在 .md 里追加引用（前端在编辑区插入）
      return c.json({ ok: true, imgPath: imgRelPath, fileName: safeName });
    } catch(e) { return c.json({ error: e.message, stack: e.stack }, 500); }
  });

  // --- 删除图片 ---
  app.post('/api/project/:id/delete-image', async c => {
    const id = safeProjectId(c.req.param('id'));
    if (!id) return c.json({ error: 'bad id' }, 400);
    try {
      const body = await c.req.json();
      var chapterId = body.chapterId || '';
      var imgPath = body.imgPath || '';
      var imgType = body.imgType || '';
      var base64Prefix = body.base64Prefix || '';
      if (!chapterId) return c.json({ ok: true });
      const fs2 = await import('node:fs'), path2 = await import('node:path');

      // 1. Delete file on disk if it's a server image
      if (imgPath) {
        var filePath = path2.join(dd, 'projects', id, 'chapters', imgPath);
        if (fs2.existsSync(filePath)) fs2.unlinkSync(filePath);
      }

      // 2. Remove image markdown from .md file
      var chPath = path2.join(dd, 'projects', id, 'chapters', chapterId + '.md');
      if (fs2.existsSync(chPath)) {
        var content = fs2.readFileSync(chPath, 'utf-8');
        // Remove frontmatter cover image line
        content = content.replace(/image:\s*["']?[^\n'"]+["']?\s*\n?/g, '');
        // Remove ![封面](data:image/...) or ![封面](relative-path) from body
        if (base64Prefix) {
          // Match the exact base64 prefix to remove the right image
          content = content.replace(new RegExp('\\n?!\\[([^\\]]*)\\]\\(' + base64Prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^)]*\\)', 'g'), '');
        }
        // Also remove any remaining ![封面](data:image/...) lines
        content = content.replace(/\n*!\[封面\]\(data:image\/[^)]+\)\n*/g, '\n');
        fs2.writeFileSync(chPath, content, 'utf-8');
      }

      return c.json({ ok: true });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // ── 电影化小说写作 ──
  app.post('/api/project/:id/cinematic', async c => {
    const id = safeProjectId(c.req.param('id'));
    if (!id) return c.json({ error: 'bad id' }, 400);
    try {
      const { join } = await import('node:path');
      const body = await c.req.json();
      var chapterId = body.chapterId || '';
      var depth = body.depth || 'light';
      const { createHash } = await import('node:crypto');
      const taskId = 'cin_' + id + '_' + chapterId + '_' + createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8);

      // 读取章节信息
      const chaptersPath = join(dd, 'projects', id, 'chapters.json');
      if (!fs.existsSync(chaptersPath)) return c.json({ error: 'project not found' }, 404);
      var chaptersIdx = JSON.parse(fs.readFileSync(chaptersPath, 'utf-8'));
      var chapter = (chaptersIdx.chapters || []).find(function(ch){ return ch.id === chapterId; });
      if (!chapter) return c.json({ error: 'chapter not found' }, 404);
      var chapterBody = '';
      var chapterPath = join(dd, 'projects', id, 'chapters', chapterId + '.md');
      if (fs.existsSync(chapterPath)) chapterBody = fs.readFileSync(chapterPath, 'utf-8');

      // 读取项目信息
      var projInfo = { name: id, type: '' };
      var projPath = join(dd, 'projects', id, 'project.json');
      if (fs.existsSync(projPath)) {
        var pj = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
        projInfo.name = pj.name || id;
        projInfo.type = pj.type || '';
      }

      // 写入任务文件
      const taskDir = join(dd, 'tasks');
      fs.mkdirSync(taskDir, { recursive: true });
      const taskFile = join(taskDir, taskId + '.json');
      
      // 提取章节正文（去掉 front matter）
      var bodyText = chapterBody;
      var fmMatch = bodyText.match(/^---[\s\S]*?---/);
      if (fmMatch) bodyText = bodyText.substring(fmMatch[0].length);
      // 截断到 2000 字
      var summary = bodyText.length > 2000 ? bodyText.substring(0, 2000) + '...（已截断，Agent 需读原文）' : bodyText;

      fs.writeFileSync(taskFile, JSON.stringify({
        taskId: taskId,
        type: 'cinematic-rewrite',
        projectId: id,
        projectName: projInfo.name,
        projectType: projInfo.type,
        chapterId: chapterId,
        chapterTitle: chapter.title,
        chapterWordCount: chapter.wordCount || 0,
        depth: depth,
        chapterSummary: summary,
        status: 'pending',
        createdAt: new Date().toISOString()
      }, null, 2));

      return c.json({
        ok: true,
        taskId: taskId,
        instruction: '电影化改写指令已记录。请在聊天窗口说"开始电影化改写"或"继续"，我会自动读取任务并执行。'
      });
    } catch(e) { return c.json({ error: e.message }, 500); }
  });

  // P0.2-A: 自动生成章节摘要
  function generateChapterSummary(content) {
    if (!content) return '';
    // 剥离 frontmatter
    var body = content;
    var fmRegex = /^---[\s\S]*?---\s*/;
    var m;
    while ((m = body.match(fmRegex)) !== null) { body = body.substring(m[0].length); }
    // 取前 200 字作为基础摘要
    var clean = body.replace(/[#*_`>\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean.slice(0, 200) + (clean.length > 200 ? '...' : '');
  }
}