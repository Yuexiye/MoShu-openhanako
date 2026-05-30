const name = "novel_export_immersive";
import fs from "node:fs";
import path from "node:path";

const description = "沉浸式档案导出。将项目导出为独立 HTML 档案终端风格阅读器，可在浏览器中直接打开。";

const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    outputDir: { type: "string", description: "输出目录（可选，默认 W:/Games/Hanako/Work/小说/export）" },
    title: { type: "string", description: "档案标题（可选，默认项目名）" },
    classification: { type: "string", enum: ["公开", "内部", "机密", "绝密"], description: "保密级别（可选，默认 机密）" },
  }, required: ["projectId"],
};

async function execute(input) {
  try {
    const { projectId, classification = "机密", title } = input;const { safeProjectId } = await import("../lib/config.js");const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);

    // ── 读取项目数据 ──
    const projPath = path.join(projDir, "project.json");
    if (!fs.existsSync(projPath)) throw new Error("项目不存在");
    const project = JSON.parse(fs.readFileSync(projPath, "utf-8"));

    // 章节
    const idxPath = path.join(projDir, "chapters.json");
    const chapters = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, "utf-8")).chapters || [] : [];

    // 卡片
    const cards = [];
    for (const t of ["characters", "world", "style"]) {
      const cp = path.join(projDir, "cards", `${t}.json`);
      if (fs.existsSync(cp)) {
        const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
        if (d.cards) cards.push(...d.cards);
      }
    }

    // 事实
    const factsPath = path.join(projDir, "facts.jsonl");
    const facts = fs.existsSync(factsPath)
      ? fs.readFileSync(factsPath, "utf-8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l)).filter(f => !f.deprecated_at && !f.overridden_by)
      : [];

    // 章节正文
    const chContent = {};
    for (const ch of chapters) {
      const chp = path.join(projDir, "chapters", `${ch.id}.md`);
      chContent[ch.id] = fs.existsSync(chp) ? fs.readFileSync(chp, "utf-8") : "";
    }

    // ── 输出路径 ──
    const outBase = safeOutputDir(input.outputDir);
    const outDir = path.join(outBase, projectId);
    fs.mkdirSync(outDir, { recursive: true });

    const archiveTitle = title || project.name;
    const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0);

    // ── 生成 HTML ──
    const html = buildHTML({
      title: archiveTitle,
      classification,
      project,
      chapters,
      chContent,
      cards,
      facts,
      totalWords,
    });

    const outFile = path.join(outDir, `dossier.html`);
    fs.writeFileSync(outFile, html, "utf-8");

    return { content: [{ type: "text", text: JSON.stringify({
      ok: true,
      message: `✅ 已导出档案模板：${outFile}`,
      file: outFile,
      stats: { chapters: chapters.length, cards: cards.length, facts: facts.length, words: totalWords },
    }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

function buildHTML(data) {
  const { title, classification, project, chapters, chContent, cards, facts, totalWords } = data;
  const now = new Date().toISOString().slice(0, 10);

  // 生成档案元数据
  const metaLines = [
    `档案名称: ${esc(title)}`,
    `项目编号: ${esc(project.id)}`,
    `保密级别: ${classification}`,
    `创建日期: ${now}`,
    `卷宗数量: ${chapters.length}`,
    `档案条目: ${cards.length}`,
    `总字数: ${totalWords}`,
    `状态: ${classification === "绝密" ? "🔒 封存" : "📄 已解禁"}`,
  ];

  // 生成卷宗
  let dossierHTML = "";
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const body = chContent[ch.id] || "";
    const words = ch.wordCount || 0;
    dossierHTML += `
<div class="dossier">
  <div class="dossier-header">
    <span class="dossier-tag">卷宗 #${String(i+1).padStart(2, "0")}</span>
    <span class="dossier-title">${esc(ch.title)}</span>
    <span class="dossier-meta">${words} 字 · ${ch.status}</span>
  </div>
  <div class="dossier-body">${mdToHTML(body)}</div>
</div>`;
  }

  // 生成人物档案
  let cardHTML = "";
  const charCards = cards.filter(c => c.type === "characters");
  const worldCards = cards.filter(c => c.type === "world");
  const styleCards = cards.filter(c => c.type === "style");

  for (const card of charCards) {
    const c = card.content || {};
    const fields = Object.entries(c).map(([k, v]) =>
      `<div class="field"><span class="field-key">${esc(k)}</span><span class="field-val">${esc(String(v))}</span></div>`
    ).join("");
    cardHTML += `
<div class="file-card">
  <div class="file-header">
    <span class="file-icon">👤</span>
    <span class="file-name">${esc(card.name)}</span>
    <span class="file-badge">人物</span>
  </div>
  <div class="file-body">${fields}</div>
  ${card.tags?.length ? `<div class="file-tags">${card.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
</div>`;
  }

  for (const card of worldCards) {
    const c = card.content || {};
    const fields = Object.entries(c).map(([k, v]) =>
      `<div class="field"><span class="field-key">${esc(k)}</span><span class="field-val">${esc(String(v))}</span></div>`
    ).join("");
    cardHTML += `
<div class="file-card">
  <div class="file-header">
    <span class="file-icon">🌍</span>
    <span class="file-name">${esc(card.name)}</span>
    <span class="file-badge" style="background:#4a6fa5">世界</span>
  </div>
  <div class="file-body">${fields}</div>
  ${card.tags?.length ? `<div class="file-tags">${card.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
</div>`;
  }

  // 生成设定事实
  let factHTML = "";
  for (const f of facts.slice(0, 50)) {
    factHTML += `
<div class="evidence">
  <div class="evidence-icon">📎</div>
  <div class="evidence-body">
    <div class="evidence-content">${esc(f.content)}</div>
    <div class="evidence-meta">类型: ${f.type} · 置信度: ${(f.confidence * 100).toFixed(0)}%${f.tags?.length ? ` · 标签: ${f.tags.join(", ")}` : ""}</div>
  </div>
</div>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · 档案终端</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  background:#0a0e17;color:#c8d6e5;
  font-family:'Courier New','Consolas','Source Code Pro',monospace;
  font-size:14px;line-height:1.7;padding:0;min-height:100vh;
}
.container{max-width:860px;margin:0 auto;padding:40px 24px 80px}

/* ── Header ── */
.terminal-header{
  border-bottom:2px solid #1a3a5c;padding-bottom:20px;margin-bottom:32px;
}
.terminal-badge{
  display:inline-block;padding:3px 12px;border:1px solid #1a3a5c;
  font-size:11px;letter-spacing:2px;margin-bottom:12px;color:#4a9eff;
}
.terminal-title{font-size:24px;font-weight:bold;color:#e8eef5;margin-bottom:8px;letter-spacing:1px}
.terminal-sub{font-size:12px;color:#5a7a9a;line-height:1.8}

/* ── Meta Info ── */
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:16px 0 24px;font-size:13px}
.meta-item{display:flex}
.meta-key{color:#4a7a9a;width:90px;flex-shrink:0}
.meta-val{color:#c8d6e5}
.meta-divider{border:none;border-top:1px dashed #1a3a5c;margin:16px 0}

/* ── Stats ── */
.stats{display:flex;gap:16px;margin:16px 0 24px;flex-wrap:wrap}
.stat-box{flex:1;min-width:100px;border:1px solid #1a3a5c;padding:12px;text-align:center}
.stat-num{font-size:24px;color:#4a9eff;font-weight:bold}
.stat-label{font-size:11px;color:#5a7a9a;margin-top:4px}

/* ── Section ── */
.section{margin:32px 0 16px;padding-bottom:8px;border-bottom:1px solid #1a3a5c}
.section-title{font-size:16px;color:#4a9eff;font-weight:bold;letter-spacing:1px}
.section-count{font-size:12px;color:#5a7a9a;margin-left:8px}

/* ── Dossier ── */
.dossier{margin:20px 0;border-left:3px solid #1a3a5c;padding-left:16px}
.dossier-header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.dossier-tag{font-size:11px;color:#4a9eff;letter-spacing:1px}
.dossier-title{font-size:15px;font-weight:bold;color:#e8eef5}
.dossier-meta{font-size:11px;color:#5a7a9a;margin-left:auto}
.dossier-body{font-size:13px;color:#b0c4d8;line-height:1.9;white-space:pre-wrap}

/* ── File Cards ── */
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.file-card{border:1px solid #1a3a5c;padding:14px}
.file-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.file-icon{font-size:18px}
.file-name{font-weight:bold;color:#e8eef5;font-size:14px}
.file-badge{font-size:10px;background:#5a4a8a;color:#d0c8e8;padding:2px 8px;border-radius:2px;margin-left:auto}
.file-body{font-size:12px;line-height:1.8}
.field{display:flex;gap:8px;margin-bottom:2px}
.field-key{color:#4a7a9a;min-width:60px}
.field-val{color:#b0c4d8}
.file-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.tag{font-size:10px;border:1px solid #1a3a5c;padding:1px 6px;color:#5a7a9a}

/* ── Evidence ── */
.evidence{display:flex;gap:10px;padding:10px;margin:6px 0;border:1px dashed #1a3a5c}
.evidence-icon{font-size:16px;padding-top:2px}
.evidence-content{font-size:12px;color:#b0c4d8}
.evidence-meta{font-size:10px;color:#5a7a9a;margin-top:4px}

/* ── Footer ── */
.footer{text-align:center;padding:40px 0 20px;color:#2a4a6a;font-size:11px;letter-spacing:1px}

@media(max-width:600px){
  .meta-grid{grid-template-columns:1fr}
  .card-grid{grid-template-columns:1fr}
  .stats{flex-direction:column}
}
</style>
</head>
<body>
<div class="container">

<div class="terminal-header">
  <div class="terminal-badge">✦ 深井档案 · DOSSIER</div>
  <div class="terminal-title">📁 ${esc(title)}</div>
  <div class="terminal-sub">INV 调查档案系统 · ${classification} · ${now}</div>
  <hr class="meta-divider">
  ${metaLines.map(l => `<div class="meta-item"><span class="meta-key">${l.split(":")[0]}:</span><span class="meta-val">${l.split(":").slice(1).join(":")}</span></div>`).join("")}
</div>

<div class="stats">
  <div class="stat-box"><div class="stat-num">${chapters.length}</div><div class="stat-label">卷宗</div></div>
  <div class="stat-box"><div class="stat-num">${cards.length}</div><div class="stat-label">档案条目</div></div>
  <div class="stat-box"><div class="stat-num">${totalWords}</div><div class="stat-label">总字数</div></div>
  <div class="stat-box"><div class="stat-num">${facts.length}</div><div class="stat-label">证据条目</div></div>
</div>

${chapters.length ? `
<div class="section"><span class="section-title">📜 卷宗目录</span><span class="section-count">${chapters.length} 份</span></div>
${dossierHTML}` : ""}

${cards.length ? `
<div class="section"><span class="section-title">👤 人物档案</span><span class="section-count">${charCards.length} 条</span></div>
<div class="card-grid">${cardHTML}</div>` : ""}

${facts.length ? `
<div class="section"><span class="section-title">🔗 证据附件</span><span class="section-count">${facts.length} 条</span></div>
${factHTML}` : ""}

<div class="footer">
  ─── 墨述 · Ink Narrative 档案导出系统 ───<br>
  双击此文件在浏览器中打开 · 无需网络
</div>

</div>

<script>
// 终端闪烁光标效果
(function(){
  const style=document.createElement('style');
  style.textContent='@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}.terminal-badge::after{content:"▌";animation:blink 1s step-end infinite;margin-left:4px}';
  document.head.appendChild(style);
})();
</script>
</body>
</html>`;
}

// 简易 Markdown → HTML 转换
function mdToHTML(md) {
  return esc(md)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


function safeOutputDir(dir) {
  if (!dir) return path.join(process.cwd(), "export");
  if (dir.includes("..")) throw new Error("outputDir 不能包含 ..");
  if (path.isAbsolute(dir)) throw new Error("outputDir 请使用相对路径");
  return dir;
}

export { name, description, parameters, execute };
