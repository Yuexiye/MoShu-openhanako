const name = "novel_export_dashboard";
import fs from "node:fs";
import path from "node:path";

const description = "导出项目看板。生成独立 HTML 看板，包含项目总览、卡片墙、编年史时间线。";

const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    outputDir: { type: "string", description: "输出目录（可选）" },
  }, required: ["projectId"],
};

async function execute(input) {
  try {
    const { projectId } = input;const { safeProjectId } = await import("../lib/config.js");const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);
    const projPath = path.join(projDir, "project.json");
    if (!fs.existsSync(projPath)) throw new Error("项目不存在");
    const project = JSON.parse(fs.readFileSync(projPath, "utf-8"));

    // 读取数据
    const idxPath = path.join(projDir, "chapters.json");
    const chapters = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, "utf-8")).chapters || [] : [];
    const chContent = {};
    for (const ch of chapters) {
      const cp = path.join(projDir, "chapters", `${ch.id}.md`);
      chContent[ch.id] = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : "";
    }

    const cards = [];
    for (const t of ["characters", "world", "style"]) {
      const cp = path.join(projDir, "cards", `${t}.json`);
      if (fs.existsSync(cp)) {
        const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
        if (d.cards) cards.push(...d.cards);
      }
    }

    const factsPath = path.join(projDir, "facts.jsonl");
    const facts = fs.existsSync(factsPath)
      ? fs.readFileSync(factsPath, "utf-8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l)).filter(f => !f.deprecated_at && !f.overridden_by)
      : [];

    // 输出
    const outBase = safeOutputDir(input.outputDir);
    const outDir = path.join(outBase, projectId);
    fs.mkdirSync(outDir, { recursive: true });

    const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0);
    const doneChapters = chapters.filter(c => c.status === "final" || c.status === "revised").length;
    const progress = chapters.length > 0 ? Math.round(doneChapters / chapters.length * 100) : 0;

    // 编年史时间线（从章节摘要中提取时间信息）
    const timeline = chapters.map((ch, i) => ({
      order: ch.order,
      title: ch.title,
      words: ch.wordCount || 0,
      status: ch.status,
      updated: ch.updated_at,
      summary: (chContent[ch.id] || "").slice(0, 100),
    }));

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(project.name)} · 项目看板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#f5f3f0;color:#2c2c2c;padding:24px;max-width:960px;margin:0 auto}
h1{font-size:20px;font-weight:600;margin-bottom:4px}
.sub{color:#888;font-size:13px;margin-bottom:20px}

/* Stats bar */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px}
.stat{border-radius:8px;padding:14px 16px}
.stat-blue{background:#e8f0fe;color:#1a5cc8}
.stat-green{background:#e6f7e6;color:#2a7a2a}
.stat-amber{background:#fef6e0;color:#8a6a00}
.stat-purple{background:#f0e8fe;color:#5a3a9a}
.stat-num{font-size:24px;font-weight:700}
.stat-label{font-size:12px;opacity:.7;margin-top:2px}

/* Section */
.sec{margin:24px 0 12px;font-size:15px;font-weight:600;color:#444;border-bottom:2px solid #e0d8d0;padding-bottom:6px}

/* Card wall */
.wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.card{border-radius:8px;padding:14px;border:1px solid #e0d8d0;transition:box-shadow .15s}
.card:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.card-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.card-icon{font-size:16px}
.card-name{font-weight:600;font-size:13px;color:#333}
.card-badge{font-size:10px;background:#e0d8d0;color:#666;padding:1px 6px;border-radius:4px;margin-left:auto}
.card-body{font-size:12px;color:#666;line-height:1.6}
.card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.tag{font-size:10px;background:#e0d8d0;padding:1px 6px;border-radius:3px;color:#666}

/* Timeline */
.tl{border-left:2px solid #d49a6a;padding-left:16px;margin-left:8px}
.tl-item{margin-bottom:16px;position:relative}
.tl-item::before{content:'';position:absolute;left:-21px;top:6px;width:8px;height:8px;border-radius:50%;background:#d49a6a}
.tl-title{font-size:13px;font-weight:600;color:#333}
.tl-meta{font-size:11px;color:#999;margin:2px 0 4px}
.tl-summary{font-size:12px;color:#666;line-height:1.5}

/* Progress bar */
.pbar{height:4px;border-radius:2px;background:#e0d8d0;margin:16px 0;overflow:hidden}
.pbar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#d49a6a,#c48454);transition:width .5s}

/* Facts grid */
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.fact-item{font-size:12px;padding:8px 10px;background:#faf8f5;border-radius:6px;border:1px solid #e8e0d8;color:#555}

@media(max-width:600px){
  .wall{grid-template-columns:1fr}
  .facts{grid-template-columns:1fr}
}
</style>
</head>
<body>

<h1>📊 ${esc(project.name)}</h1>
<div class="sub">${esc(project.type || "")} · ${esc(project.summary || "")}</div>

<div class="pbar"><div class="pbar-fill" style="width:${progress}%"></div></div>

<div class="stats">
  <div class="stat stat-blue"><div class="stat-num">${chapters.length}</div><div class="stat-label">章节</div></div>
  <div class="stat stat-green"><div class="stat-num">${doneChapters}</div><div class="stat-label">已完成</div></div>
  <div class="stat stat-amber"><div class="stat-num">${totalWords}</div><div class="stat-label">总字数</div></div>
  <div class="stat stat-purple"><div class="stat-num">${cards.length}</div><div class="stat-label">卡片</div></div>
</div>

${cards.length > 0 ? `<div class="sec">📋 卡片墙 (${cards.length})</div>
<div class="wall">${cards.map(c => {
  const icon = c.type === "characters" ? "👤" : c.type === "world" ? "🌍" : "📝";
  const content = c.content || {};
  const lines = Object.entries(content).slice(0, 4).map(([k,v]) => `<span style="display:inline-block;margin-right:8px">${esc(k)}: ${esc(String(v))}</span>`).join("");
  return `<div class="card"><div class="card-h"><span class="card-icon">${icon}</span><span class="card-name">${esc(c.name)}</span><span class="card-badge">${c.type}</span></div><div class="card-body">${lines}</div>${c.tags?.length ? `<div class="card-tags">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}</div>`;
}).join("")}</div>` : ""}

${timeline.length > 0 ? `<div class="sec">📜 编年史</div>
<div class="tl">${timeline.map(t => `
<div class="tl-item">
  <div class="tl-title">${esc(t.title)}</div>
  <div class="tl-meta">第 ${t.order} 章 · ${t.words} 字 · ${t.status} · ${t.updated?.slice(0,10) || ""}</div>
  ${t.summary ? `<div class="tl-summary">${esc(t.summary)}${t.summary.length >= 100 ? "..." : ""}</div>` : ""}
</div>`).join("")}</div>` : ""}

${facts.length > 0 ? `<div class="sec">🔍 设定事实 (${facts.length})</div>
<div class="facts">${facts.slice(0, 30).map(f => `<div class="fact-item">${esc(f.content.slice(0, 80))}</div>`).join("")}</div>` : ""}

<div style="text-align:center;padding:32px 0 16px;font-size:11px;color:#bbb">
墨述 · Ink Narrative 看板导出
</div>

</body>
</html>`;

    const outFile = path.join(outDir, "dashboard.html");
    fs.writeFileSync(outFile, html, "utf-8");

    return { content: [{ type: "text", text: JSON.stringify({
      ok: true, message: `✅ 已导出看板`, file: outFile,
      stats: { chapters: chapters.length, cards: cards.length, facts: facts.length, words: totalWords, progress },
    }, null, 2) }] };
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
