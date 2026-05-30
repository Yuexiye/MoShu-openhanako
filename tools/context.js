const name = "novel_get_context";
import fs from "node:fs";
import path from "node:path";

const description = "写作上下文引擎。在写章节前调用，自动注入当前设定、相关事实和前文摘要，帮助保持一致性。支持常量事实(always)、优先级排序、章槛过滤。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    nextChapterTitle: { type: "string", description: "即将写的章节标题（可选，用于关键词匹配事实）" },
    maxFacts: { type: "number", description: "返回事实上限（可选，默认 10）" },
    maxPrevChapters: { type: "number", description: "前文章节数（可选，默认 3）" },
    currentChapterId: { type: "string", description: "当前正在写的章节 ID（用于章槛过滤，可选）" },
  },
  required: ["projectId"],
};

async function execute(input) {
  try {
    const { projectId, nextChapterTitle, maxFacts = 10, maxPrevChapters = 3, currentChapterId } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(projectId); if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);

    const ctx = { project: null, cards: [], facts: [], previousChapters: [] };

    // ── 项目信息 ──
    const projPath = path.join(projDir, "project.json");
    if (fs.existsSync(projPath)) {
      ctx.project = JSON.parse(fs.readFileSync(projPath, "utf-8"));
    }

    // ── 卡片 ──
    const cardTypes = ["characters", "world", "style"];
    for (const t of cardTypes) {
      const cp = path.join(projDir, "cards", `${t}.json`);
      if (fs.existsSync(cp)) {
        const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
        if (d.cards) ctx.cards.push(...d.cards);
      }
    }

    // ── 前文章节（距离衰减：最近的在最前面） ──
    const idxPath = path.join(projDir, "chapters.json");
    if (fs.existsSync(idxPath)) {
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const sorted = (idx.chapters || []).sort((a, b) => b.order - a.order);
      const recent = sorted.slice(0, maxPrevChapters);
      for (const ch of recent.reverse()) {
        const chp = path.join(projDir, "chapters", `${ch.id}.md`);
        const body = fs.existsSync(chp) ? fs.readFileSync(chp, "utf-8") : "";
        ctx.previousChapters.push({
          id: ch.id,
          title: ch.title,
          summary: body.slice(0, 500) + (body.length > 500 ? "..." : ""),
        });
      }
    }

    // ── 相关事实 ──
    const factsPath = path.join(projDir, "facts.jsonl");
    if (fs.existsSync(factsPath)) {
      let allFacts = fs.readFileSync(factsPath, "utf-8")
        .split("\n").filter(l => l.trim()).map(l => JSON.parse(l))
        .filter(f => !f.deprecated_at && !f.overridden_by);

      // 计算当前章节序号（用于章槛过滤）
      let currentOrder = Infinity;
      if (currentChapterId) {
        const chIdxPath = path.join(projDir, "chapters.json");
        if (fs.existsSync(chIdxPath)) {
          const chIdx = JSON.parse(fs.readFileSync(chIdxPath, "utf-8"));
          const cur = (chIdx.chapters || []).find(c => c.id === currentChapterId);
          if (cur) currentOrder = cur.order;
        }
      }

      // 分出常量事实（始终注入）
      const constantFacts = allFacts.filter(f => f.constant === true
        && (!f.chapter_gate || currentOrder >= (parseInt(f.chapter_gate) || 0)));

      // 关键词匹配的非常量事实
      const keywords = (nextChapterTitle || ctx.project?.name || "")
        .replace(/[第章节卷部]/g, "")
        .split(/[\s,，、]+/).filter(Boolean);

      let keywordFacts = allFacts.filter(f => f.constant !== true
        && (!f.chapter_gate || currentOrder >= (parseInt(f.chapter_gate) || 0)));

      if (keywords.length > 0) {
        keywordFacts = keywordFacts.filter(f => {
          const text = (f.content + " " + (f.tags || []).join(" ")).toLowerCase();
          return keywords.some(kw => text.includes(kw.toLowerCase()));
        });
      }

      // 合并并排序：常量优先，再按优先级→置信度
      const merged = [...constantFacts, ...keywordFacts];
      merged.sort((a, b) => {
        const pDiff = (b.priority || 0) - (a.priority || 0);
        if (pDiff !== 0) return pDiff;
        return (b.confidence || 0) - (a.confidence || 0);
      });

      ctx.facts = merged.slice(0, maxFacts).map(f => ({
        type: f.type,
        content: f.content,
        confidence: f.confidence,
        priority: f.priority || 0,
        constant: f.constant || false,
        tags: f.tags,
      }));
    }

    // ── 格式化输出 ──
    const output = [`# 写作上下文 — ${ctx.project?.name || projectId}\n`];

    if (ctx.project?.summary) {
      output.push(`## 📖 世界观\n${ctx.project.summary}\n`);
    }

    if (ctx.cards.length > 0) {
      output.push(`## 📋 设定卡片`);
      for (const card of ctx.cards.slice(0, 15)) {
        const c = card.content || {};
        const details = Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(" | ");
        output.push(`- **${card.name}** [${card.type}] ${details ? "— " + details : ""}`);
      }
      output.push("");
    }

    if (ctx.previousChapters.length > 0) {
      output.push(`## 📝 前文回顾`);
      for (const ch of ctx.previousChapters) {
        output.push(`### ${ch.title}\n${ch.summary}\n`);
      }
    }

    if (ctx.facts.length > 0) {
      output.push(`## 🔍 相关设定事实`);
      for (const f of ctx.facts) {
        const marks = [];
        if (f.constant) marks.push("⚓常驻");
        if (f.priority > 0) marks.push(`★${f.priority}`);
        const markStr = marks.length > 0 ? ` [${marks.join(" ")}]` : "";
        output.push(`- [${f.type}] ${f.content} _(置信度: ${f.confidence})${markStr}_`);
      }
      output.push("");
    }

    // ── 实体关系图 ──
    const entityLinksPath = path.join(projDir, "graph", "entity_links.jsonl");
    if (fs.existsSync(entityLinksPath)) {
      const { readJSONL } = await import("../lib/store.js");
      const allLinks = await readJSONL(entityLinksPath);
      const activeLinks = (allLinks || []).filter(l => !l.deprecatedAt);
      if (activeLinks.length > 0) {
        output.push(`## 🔗 实体关系 (${activeLinks.length} 条边)`);
        const seen = new Set();
        for (const l of activeLinks) {
          const key = `${l.sourceName}↔${l.targetName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const desc = l.description || l.dynamic || "";
          output.push(`- **${l.sourceName}** → **${l.targetName}**: ${l.relation}${desc ? ` (${desc})` : ""}`);
        }
        output.push("");
      }
    }

    output.push("---\n*由墨述上下文引擎自动生成*");

    return { content: [{ type: "text", text: output.join("\n") }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };
