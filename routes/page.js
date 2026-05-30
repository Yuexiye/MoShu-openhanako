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
  app.get("/api/project/:id/chapters", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json"); if (!fs.existsSync(ip)) return c.json([]); const idx = JSON.parse(fs.readFileSync(ip, "utf-8")); for (const ch of (idx.chapters || [])) { const cp = path.join(p2, "chapters", ch.id + ".md"); ch.body = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : ""; } return c.json(idx.chapters || []); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/chapters", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json"); const idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, "utf-8")) : { chapters: [] }; const now = new Date().toISOString(); if (b && b._delete && b.id) { const di = idx.chapters.findIndex(c2 => c2.id === b.id); if (di >= 0) { idx.chapters.splice(di, 1); try { fs.unlinkSync(path.join(p2, "chapters", b.id + ".md")); } catch(e) {} } } else if (b && b.id) { const i = idx.chapters.findIndex(c2 => c2.id === b.id); if (i >= 0) { idx.chapters[i].title = b.title || idx.chapters[i].title; idx.chapters[i].wordCount = (b.content || "").replace(/\s/g, "").length; idx.chapters[i].updated_at = now; if (b.volume !== undefined) idx.chapters[i].volume = b.volume || null; if (b.status) idx.chapters[i].status = b.status; if (b.content) fs.writeFileSync(path.join(p2, "chapters", b.id + ".md"), b.content, "utf-8"); } } else if (b) { const nid = "ch_" + String(idx.chapters.length + 1).padStart(2, "0"); fs.mkdirSync(path.join(p2, "chapters"), { recursive: true }); fs.writeFileSync(path.join(p2, "chapters", nid + ".md"), b.content || "", "utf-8"); idx.chapters.push({ id: nid, title: b.title || "new", order: idx.chapters.length + 1, status: "draft", wordCount: (b.content || "").replace(/\s/g, "").length, hooks: [], created_at: now, updated_at: now }); } fs.writeFileSync(ip, JSON.stringify(idx, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/cards", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const cd = path.join(dd, "projects", id, "cards"); const r = []; for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (fs.existsSync(fp)) { const d = JSON.parse(fs.readFileSync(fp, "utf-8")); if (d.cards) r.push(...d.cards); } } return c.json(r); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/card-meta", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const cid = c.req.query("cid"); const fs = await import("node:fs"), path = await import("node:path"); const cd = path.join(dd, "projects", id, "cards"); for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const d = JSON.parse(fs.readFileSync(fp, "utf-8")); if (d.cards) { const idx = d.cards.findIndex(c2 => c2.id === cid); if (idx >= 0) return c.json({ type: t, file: fp }); } } return c.json({ type: null }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/cards", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const cd = path.join(dd, "projects", id, "cards"); fs.mkdirSync(cd, { recursive: true }); if (b && b.id && b._delete) { for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const data = JSON.parse(fs.readFileSync(fp, "utf-8")); const di = data.cards.findIndex(c2 => c2.id === b.id); if (di >= 0) { data.cards.splice(di, 1); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } } return c.json({ ok: false, error: "not found" }, 404); } else if (b && b.id) { var oldFile = null, oldData = null, oldIndex = -1; for (const t of ["characters", "world", "style"]) { const fp = path.join(cd, t + ".json"); if (!fs.existsSync(fp)) continue; const data = JSON.parse(fs.readFileSync(fp, "utf-8")); const idx = data.cards.findIndex(c2 => c2.id === b.id); if (idx >= 0) { oldFile = fp; oldData = data; oldIndex = idx; break; } } if (oldFile) { oldData.cards.splice(oldIndex, 1); fs.writeFileSync(oldFile, JSON.stringify(oldData, null, 2), "utf-8"); } const t = b.type || "characters"; const fp = path.join(cd, t + ".json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { cards: [] }; const card = { id: b.id, name: b.name || "", type: t, content: b.content !== undefined ? b.content : {}, tags: b.tags || [], updated_at: new Date().toISOString() }; data.cards.push(card); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } else { const t = b.type || "characters"; const fp = path.join(cd, t + ".json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { cards: [] }; var card = { id: "card_" + Date.now().toString(36), name: b.name || "", type: t, content: b.content || {}, tags: b.tags || [], created_at: new Date().toISOString() }; data.cards.push(card); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/markers", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const mid = c.req.query("map") || ""; const fp = path.join(dd, "projects", id, "maps.json"); if (!fs.existsSync(fp)) return c.json([]); const data = JSON.parse(fs.readFileSync(fp, "utf-8")); if (mid && data.maps) { var m = data.maps.find(function(x) { return x.id === mid; }); return c.json(m ? (m.markers || []) : []); } if (data.maps && data.maps.length > 0) return c.json(data.maps[0].markers || []); return c.json([]); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/markers", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const mid = b._mapId || ""; const fp = path.join(dd, "projects", id, "maps.json"); var data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { maps: [{ id: "map_default", name: "默认地图", markers: [] }] }; if (!data.maps || data.maps.length === 0) data.maps = [{ id: "map_default", name: "默认地图", markers: [] }]; var mi = mid ? data.maps.findIndex(function(x) { return x.id === mid; }) : 0; if (mi < 0) mi = 0; data.maps[mi].markers = b.markers || b; fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  // 多地图管理
  app.get("/api/project/:id/maps", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fp = path.join(dd, "projects", id, "maps.json"); if (!fs.existsSync(fp)) return c.json({ maps: [] }); return c.json(JSON.parse(fs.readFileSync(fp, "utf-8"))); } catch(e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/maps", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const b = await c.req.json(); const fp = path.join(dd, "projects", id, "maps.json"); var data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { maps: [{ id: "map_default", name: "默认地图", markers: [] }] }; if (!data.maps) data.maps = [{ id: "map_default", name: "默认地图", markers: [] }]; if (b.action === "create") { data.maps.push({ id: "map_" + Date.now().toString(36), name: b.name || "新地图", markers: [] }); } else if (b.action === "update") { var m = data.maps.find(function(x) { return x.id === b.id; }); if (m) { if (b.name !== undefined) m.name = b.name; } } else if (b.action === "delete") { data.maps = data.maps.filter(function(x) { return x.id !== b.id; }); } fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json(data); } catch(e) { return c.json({ error: e.message }, 500); } });
  app.get("/api/project/:id/facts", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "projects", id, "facts.jsonl"); if (!fs.existsSync(fp)) return c.json([]); const lines = fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()); return c.json(lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/facts", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "projects", id, "facts.jsonl"); const crypto = await import("node:crypto"); const fact = { id: b.id || ('fact_' + crypto.randomUUID()), type: b.type || 'world_lore', content: b.content, source_chapter: b.sourceChapter || null, confidence: b.confidence !== undefined ? b.confidence : 1.0, tags: b.tags || [], created_at: b.created_at || new Date().toISOString(), deprecated_at: null, overridden_by: null }; const lines = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()) : []; const existing = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); const idx = existing.findIndex(f => f.id === fact.id); if (idx >= 0) { existing[idx] = fact; } else { existing.push(fact); } fs.writeFileSync(fp, existing.map(f => JSON.stringify(f)).join("\n") + "\n", "utf-8"); return c.json({ ok: true, fact: fact }); } catch (e) { return c.json({ error: e.message }, 500); } });
  // 大纲 API
  app.get("/api/project/:id/outline", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "projects", id, "outline.json"); if (!fs.existsSync(fp)) return c.json({ arcs: [] }); return c.json(JSON.parse(fs.readFileSync(fp, "utf-8"))); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/project/:id/outline", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "projects", id, "outline.json"); fs.writeFileSync(fp, JSON.stringify(b, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  // 章节排序 API
  app.post("/api/project/:id/reorder", async c => { const id = safeProjectId(c.req.param("id")); if (!id) return c.json({ error: "bad id" }, 400); try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const p2 = path.join(dd, "projects", id), ip = path.join(p2, "chapters.json"); if (!fs.existsSync(ip)) return c.json({ ok: false, error: "no chapters" }, 404); const idx = JSON.parse(fs.readFileSync(ip, "utf-8")); const idOrder = {}; b.orderedIds.forEach((cid, i) => { idOrder[cid] = i + 1; }); idx.chapters.forEach(ch => { if (idOrder[ch.id] !== undefined) ch.order = idOrder[ch.id]; }); idx.chapters.sort((a, b) => (a.order || 0) - (b.order || 0)); fs.writeFileSync(ip, JSON.stringify(idx, null, 2), "utf-8"); return c.json({ ok: true, count: idx.chapters.length }); } catch (e) { return c.json({ error: e.message }, 500); } });

  // 世界地图
  app.get("/api/world/locations", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const fp = path.join(dd, "world.json"); return c.json(fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")).locations || [] : []); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.post("/api/world/locations", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const b = await c.req.json(); const fp = path.join(dd, "world.json"); const data = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : { locations: [] }; if (b.id) { const i = data.locations.findIndex(l => l.id === b.id); if (i >= 0) { Object.assign(data.locations[i], b); data.locations[i].updated_at = new Date().toISOString(); } } else { data.locations.push({ id: 'loc_' + Date.now().toString(36), name: b.name || '', type: b.type || 'default', worldId: b.worldId || 'default', lat: b.lat || 35, lng: b.lng || 105, description: b.description || '', projectId: b.projectId || null, tags: b.tags || [], created_at: new Date().toISOString() }); } fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true, count: data.locations.length }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.delete("/api/world/locations/:locId", async c => { try { const fs = await import("node:fs"), path = await import("node:path"); const lid = c.req.param("locId"); const fp = path.join(dd, "world.json"); if (!fs.existsSync(fp)) return c.json({ ok: false, error: "not found" }); const data = JSON.parse(fs.readFileSync(fp, "utf-8")); data.locations = data.locations.filter(l => l.id !== lid); fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8"); return c.json({ ok: true }); } catch (e) { return c.json({ error: e.message }, 500); } });
  app.get("/app", (c) => {
    const token = c.req.query("token") || "", hcss = c.req.query("hana-css") || "", base = "/api/plugins/" + pid;
    return c.html('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>墨述</title>' + (hcss ? '<link rel="stylesheet" href="' + hcss + '">' : "") + '<style>' + APPCSS + '</style></head><body><div id=root></div><script>var API=' + JSON.stringify(base) + ',TOKEN=' + JSON.stringify(token) + ';' + VIEW_UTILS + VIEW_WRITING + VIEW_MAP + VIEW_DASH + VIEW_TLVIZ + '</script><script>' + APPJS + '</script></body></html>');
  });
  app.get("/world", async (c) => {
    const token = c.req.query("token") || "", hcss = c.req.query("hana-css") || "", base = "/api/plugins/" + pid;
    // 动态读取 world-map.js，保证每次请求都是最新的
    const wmjs = fs.readFileSync(path.join(pd, 'assets', 'world-map.js'), 'utf-8');
    var head = '';
    if (hcss) head += '<link rel="stylesheet" href="' + hcss + '">';
    head += '<style>' + APPCSS + 'html,body{margin:0;padding:0;height:100%;overflow:hidden}#wm{width:100%;height:100%}button:focus{outline:none}</style>';
    head += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
    return c.html('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>墨述 · 世界地图</title>' + head + '</head><body><div id="wm"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var API=' + JSON.stringify(base) + ',TOKEN=' + JSON.stringify(token) + ';' + wmjs + '</script></body></html>');
  });
  // 向后兼容旧路由
  app.get("/workbench", (c) => { return c.html('<!DOCTYPE html><html><head><meta charset=UTF-8><title>墨述</title></head><body><h1>墨述</h1><p>请更新侧栏入口</p><script>try{parent.postMessage({type:"ready"},"*")}catch(e){}</script></body></html>'); });
  app.get("/dashboard", (c) => { return c.html('<!DOCTYPE html><html><head><meta charset=UTF-8><title>墨述</title></head><body><h1>墨述</h1><p>请更新侧栏入口</p><script>try{parent.postMessage({type:"ready"},"*")}catch(e){}</script></body></html>'); });
  app.get("/map", (c) => { return c.html('<!DOCTYPE html><html><head><meta charset=UTF-8><title>墨述</title></head><body><h1>墨述</h1><p>请更新侧栏入口</p><script>try{parent.postMessage({type:"ready"},"*")}catch(e){}</script></body></html>'); });

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
      const { execute } = await import("file://" + storygamePath.replace(/\\/g, "/"));
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
      const { execute } = await import("file://" + storygamePath.replace(/\\/g, "/"));
      const result = await execute({ projectId: id, mode: "linear", outputDir: "export" });
      const data = JSON.parse(result.content[0].text);
      if (!data.ok) return c.json({ error: data.message }, 500);
      return c.json({ ok: true, file: data.file, stats: data.stats });
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
        edges.push({ id: l.id, source: l.source, target: l.target, relation: l.relation, description: l.description || l.dynamic || '', count: l.count });
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
      edges.push({ id: l.id, source: l.source, target: l.target, relation: l.relation, description: l.description || l.dynamic || '', count: l.count });
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
      const { execute } = await import("file://" + analyzePath.replace(/\\/g, "/"));
      const body = await c.req.json();
      const result = await execute(body);
      return c.json(JSON.parse(result.content[0].text));
    } catch(e) { return c.json({ error: e.message }, 500); }
  });
}