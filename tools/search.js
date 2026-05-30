const name = "novel_search";
import fs from "node:fs";
import path from "node:path";

const description = "跨文件搜索：在所有章节、卡片、事实中搜索关键词。高频操作如「搜索所有提到'陈砚秋'的内容」。";

const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    keyword: { type: "string", description: "搜索关键词" },
    scope: { type: "string", enum: ["all", "chapters", "cards", "facts", ""], description: "搜索范围（可选，默认 all）" },
    contextLines: { type: "number", description: "上下文行数（可选，默认 0）" },
    limit: { type: "number", description: "每类结果上限（可选，默认 20）" },
  }, required: ["projectId", "keyword"],
};

async function execute(input) {
  try {
    const { projectId, keyword, scope = "all", contextLines = 0, limit = 20 } = input;const { safeProjectId } = await import("../lib/config.js");const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR
      || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);
    const kw = keyword.toLowerCase();
    const results = { chapters: [], cards: [], facts: [], total: 0 };

    function highlight(text) {
      const idx = text.toLowerCase().indexOf(kw);
      if (idx < 0) return null;
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + kw.length + 30);
      let snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
      if (contextLines > 0) {
        const lines = text.split("\n");
        const lineIdx = lines.findIndex(l => l.toLowerCase().includes(kw));
        if (lineIdx >= 0) {
          const lStart = Math.max(0, lineIdx - contextLines);
          const lEnd = Math.min(lines.length, lineIdx + contextLines + 1);
          snippet = lines.slice(lStart, lEnd).join("\n");
        }
      }
      return snippet;
    }

    // ── 章节搜索 ──
    if (scope === "all" || scope === "chapters") {
      const idxPath = path.join(projDir, "chapters.json");
      if (fs.existsSync(idxPath)) {
        const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
        for (const ch of (idx.chapters || [])) {
          const cp = path.join(projDir, "chapters", ch.id + ".md");
          if (!fs.existsSync(cp)) continue;
          const body = fs.readFileSync(cp, "utf-8");
          if (body.toLowerCase().includes(kw)) {
            results.chapters.push({ id: ch.id, title: ch.title, snippet: highlight(body) });
            if (results.chapters.length >= limit) break;
          }
        }
      }
    }

    // ── 卡片搜索 ──
    if (scope === "all" || scope === "cards") {
      const cardsDir = path.join(projDir, "cards");
      for (const t of ["characters", "world", "style"]) {
        const fp = path.join(cardsDir, t + ".json");
        if (!fs.existsSync(fp)) continue;
        const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
        for (const card of (data.cards || [])) {
          const text = JSON.stringify(card).toLowerCase();
          if (text.includes(kw)) {
            results.cards.push({ id: card.id, name: card.name, type: card.type, snippet: highlight(JSON.stringify(card, null, 2)) });
            if (results.cards.length >= limit) break;
          }
        }
      }
    }

    // ── 事实搜索 ──
    if (scope === "all" || scope === "facts") {
      const factsPath = path.join(projDir, "facts.jsonl");
      if (fs.existsSync(factsPath)) {
        const all = fs.readFileSync(factsPath, "utf-8")
          .split("\n").filter(l => l.trim()).map(l => JSON.parse(l))
          .filter(f => !f.deprecated_at && !f.overridden_by);
        for (const f of all) {
          if ((f.content + " " + (f.tags || []).join(" ")).toLowerCase().includes(kw)) {
            results.facts.push({ id: f.id, type: f.type, content: f.content, snippet: highlight(f.content) });
            if (results.facts.length >= limit) break;
          }
        }
      }
    }

    results.total = results.chapters.length + results.cards.length + results.facts.length;
    if (results.total === 0) {
      return { content: [{ type: "text", text: `📭 在项目中未找到包含「${keyword}」的内容` }] };
    }

    const lines = [`🔍 搜索「${keyword}」— 找到 ${results.total} 处`];
    if (results.chapters.length) {
      lines.push(`\n📖 章节 (${results.chapters.length}):`);
      results.chapters.forEach(c => lines.push(`  · ${c.title}: ${c.snippet || ""}`));
    }
    if (results.cards.length) {
      lines.push(`\n📋 卡片 (${results.cards.length}):`);
      results.cards.forEach(c => lines.push(`  · [${c.type}] ${c.name}: ${c.snippet || ""}`));
    }
    if (results.facts.length) {
      lines.push(`\n🔗 事实 (${results.facts.length}):`);
      results.facts.forEach(f => lines.push(`  · [${f.type}] ${f.snippet || f.content}`));
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };
