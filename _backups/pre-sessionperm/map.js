const name = "novel_map";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const description = "地图标记管理。管理项目地图的标记点，支持添加/编辑/删除/列表，每个标记可关联章节。";

const parameters = {
  type: "object", properties: {
    action: { type: "string", enum: ["create", "list", "edit", "delete", "export"],
      description: "操作: create(创建)/list(列表)/edit(编辑)/delete(删除)/export(导出地图HTML)" },
    projectId: { type: "string", description: "项目 ID" },
    markerId: { type: "string", description: "标记 ID（edit/delete 时必填）" },
    name: { type: "string", description: "地点名称（create/edit 时使用）" },
    x: { type: "number", description: "X 坐标（create/edit 时使用，像素坐标）" },
    y: { type: "number", description: "Y 坐标（create/edit 时使用，像素坐标）" },
    color: { type: "string", description: "标记颜色（create/edit 时可选，默认 #d49a6a）" },
    icon: { type: "string", description: "标记图标 emoji（create/edit 时可选，默认 📍）" },
    linkedChapters: { type: "array", items: { type: "string" }, description: "关联章节 ID 列表（可选）" },
    description: { type: "string", description: "地点描述（可选）" },
  }, required: ["action", "projectId"],
};

async function execute(input) {
  try {
    const { action, projectId } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const mapPath = path.join(dataDir, "projects", projectId, "map.json");

    function readMap() {
      return fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf-8")) : { markers: [] };
    }
    function writeMap(data) {
      fs.writeFileSync(mapPath, JSON.stringify(data, null, 2), "utf-8");
    }

    // ── 创建标记 ──
    if (action === "create") {
      if (input.x == null || input.y == null) throw new Error("需要 x/y 坐标");
      const map = readMap();
      const marker = {
        id: `m_${crypto.randomUUID().slice(0, 8)}`,
        name: input.name || "未命名地点",
        x: input.x, y: input.y,
        color: input.color || "#d49a6a",
        icon: input.icon || "📍",
        linkedChapters: input.linkedChapters || [],
        description: input.description || "",
        created_at: new Date().toISOString(),
      };
      map.markers.push(marker);
      writeMap(map);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, marker, message: `✅ 标记「${marker.name}」已创建` }, null, 2) }] };
    }

    // ── 列表标记 ──
    if (action === "list") {
      const map = readMap();
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, count: map.markers.length, markers: map.markers }, null, 2) }] };
    }

    // ── 编辑标记 ──
    if (action === "edit") {
      if (!input.markerId) throw new Error("需要 markerId");
      const map = readMap();
      const idx = map.markers.findIndex(m => m.id === input.markerId);
      if (idx === -1) throw new Error("标记不存在");
      const m = map.markers[idx];
      if (input.name != null) m.name = input.name;
      if (input.x != null) m.x = input.x;
      if (input.y != null) m.y = input.y;
      if (input.color != null) m.color = input.color;
      if (input.icon != null) m.icon = input.icon;
      if (input.linkedChapters != null) m.linkedChapters = input.linkedChapters;
      if (input.description != null) m.description = input.description;
      writeMap(map);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, marker: m, message: `✅ 标记「${m.name}」已更新` }, null, 2) }] };
    }

    // ── 删除标记 ──
    if (action === "delete") {
      if (!input.markerId) throw new Error("需要 markerId");
      const map = readMap();
      const idx = map.markers.findIndex(m => m.id === input.markerId);
      if (idx === -1) throw new Error("标记不存在");
      const name = map.markers[idx].name;
      map.markers.splice(idx, 1);
      writeMap(map);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: `已删除标记「${name}」` }) }] };
    }

    // ── 导出地图 HTML ──
    if (action === "export") {
      const map = readMap();
      const outBase = safeOutputDir(input.outputDir);
      const outDir = path.join(outBase, projectId);
      fs.mkdirSync(outDir, { recursive: true });

      const markersJSON = JSON.stringify(map.markers);
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(projectId)} · 地图</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0}
#map{width:100vw;height:100vh;background:#16213e}
.info{position:fixed;top:16px;left:16px;z-index:1000;background:rgba(26,26,46,0.9);padding:12px 16px;border-radius:8px;font-size:13px;max-width:280px;border:1px solid rgba(255,255,255,0.1)}
.info h2{font-size:14px;color:#d49a6a;margin-bottom:4px}
.info p{font-size:11px;color:#888;line-height:1.5}
.legend{position:fixed;bottom:24px;right:24px;z-index:1000;background:rgba(26,26,46,0.9);padding:10px 14px;border-radius:8px;font-size:11px;border:1px solid rgba(255,255,255,0.1);color:#888}
</style>
</head>
<body>
<div class="info">
  <h2>🗺 ${esc(projectId)}</h2>
  <p>标记数: ${map.markers.length} · 拖拽移动 · 点击标记查看详情</p>
</div>
<div class="legend">🖱 滚轮缩放 · 拖拽平移</div>
<div id="map"></div>
<script>
const markers = ${markersJSON};
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -3, maxZoom: 5,
  center: [0, 0], zoom: 0,
});
const bounds = [[-500, -500], [500, 500]];
map.fitBounds(bounds);

// Grid
const gridSize = 50;
for (let x = -500; x <= 500; x += gridSize) {
  L.polyline([[x, -500], [x, 500]], { color: 'rgba(255,255,255,0.03)', weight: 1 }).addTo(map);
  L.polyline([[-500, x], [500, x]], { color: 'rgba(255,255,255,0.03)', weight: 1 }).addTo(map);
}

// Markers
markers.forEach(m => {
  const color = m.color || '#d49a6a';
  const icon = L.divIcon({
    className: '',
    html: '<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));cursor:pointer">' + (m.icon || '📍') + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
  const popupContent = '<div style="font-size:13px;line-height:1.6">'
    + '<strong style="color:' + color + '">' + esc(m.name) + '</strong>'
    + (m.description ? '<br><span style="color:#666">' + esc(m.description) + '</span>' : '')
    + '<br><span style="font-size:11px;color:#999">坐标: (' + m.x + ', ' + m.y + ')' + (m.linkedChapters?.length ? ' · 关联: ' + m.linkedChapters.join(', ') : '') + '</span>'
    + '</div>';
  L.marker([m.y, m.x], { icon }).addTo(map)
    .bindPopup(popupContent);
});
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
</script>
</body>
</html>`;

      const outFile = path.join(outDir, "map.html");
      const { enqueue: eq2 } = await import("../lib/wqueue.js");
      await eq2(async () => { fs.writeFileSync(outFile, html, "utf-8"); });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: `✅ 已导出地图`, file: outFile, markers: map.markers.length }, null, 2) }] };
    }

    return { content: [{ type: "text", text: "❌ 未知操作" }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }


function safeOutputDir(dir) {
  if (!dir) return path.join(process.cwd(), "export");
  if (dir.includes("..")) throw new Error("outputDir 不能包含 ..");
  if (path.isAbsolute(dir)) throw new Error("outputDir 请使用相对路径");
  return dir;
}

export { name, description, parameters, execute };
