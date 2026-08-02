/**
 * mo-shu — 笔记关联引擎
 *
 * 扫描 Obsidian Vault 的 Markdown 笔记，
 * 提取实体和关系，生成关联建议（Obsidian [[wikilink]] 格式）。
 *
 * 触发词：笔记关联、知识关联、发现隐藏关联、knowledge link
 */

import path from "node:path";
import fs from "node:fs";

const name = "knowledge_link";
const description = "扫描 Obsidian Vault 笔记，提取实体和关系，生成关联建议。输出 Obsidian [[wikilink]] 格式的链接建议，可一键写入笔记。触发词：笔记关联、知识关联、发现隐藏关联、knowledge link。";

export const sessionPermission = { kind: "plugin_output" };
const parameters = {
  type: "object",
  properties: {
    vaultPath: { type: "string", description: "Obsidian Vault 根目录路径（必填）" },
    scanDepth: { type: "number", description: "扫描深度 1-3（默认 2）", default: 2 },
    maxNotes: { type: "number", description: "最大扫描笔记数（默认 100）", default: 100 },
    minConfidence: { type: "number", description: "最低置信度 0-1（默认 0.5）", default: 0.5 },
    entityTypes: {
      type: "array",
      description: "实体类型过滤",
      items: { type: "string", enum: ["人物", "地点", "事件", "概念", "作品", "组织"] },
    },
    action: { type: "string", enum: ["scan", "suggest", "export"], description: "操作类型" },
    outputPath: { type: "string", description: "导出路径（export 时必填）" },
  },
  required: ["vaultPath", "action"],
};

// ---- 扫描 ----

function scanMarkdownFiles(dir, maxDepth, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  if (!fs.existsSync(dir)) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        results.push(...scanMarkdownFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

// ---- 实体提取（基于笔记结构，不用脆弱正则）----

function extractEntities(note, entityTypes) {
  const types = entityTypes || ["人物", "地点", "事件", "概念", "作品", "组织"];
  const entities = [];
  const seen = new Set();

  function add(text, type, confidence) {
    const clean = text.trim().replace(/["[\]]/g, "").replace(/[，。、；：！？\n]/g, "");
    if (clean.length < 2 || clean.length > 50) return;
    const key = type + ":" + clean;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ text: clean, type, confidence });
  }

  // 内部链接
  for (const link of (note.internalLinks || [])) {
    add(link, "概念", 0.95);
  }
  // Tags
  for (const tag of (note.tags || [])) {
    add(tag, "概念", 0.9);
  }
  // Frontmatter 字段
  const fm = note.frontmatter || "";
  const titleM = fm.match(/title[\s:]+["']?([^"'\n]+)/i);
  if (titleM) add(titleM[1], "作品", 0.8);
  const authorM = fm.match(/author[\s:]+["']?([^"'\n]+)/i);
  if (authorM) add(authorM[1], "人物", 0.9);
  const dateM = fm.match(/date[\s:]+([\d-]+)/i);
  if (dateM) add(dateM[1], "事件", 0.7);
  // 笔记标题
  add(note.title, "作品", 0.85);
  // 关键词
  if (types.includes("概念")) {
    const keywords = ["Hanako", "Obsidian", "AI", "LLM", "Agent", "插件", "系统", "模型", "数据", "框架", "架构", "设计", "技术", "项目", "产品", "平台", "工具"];
    const content = note.content || "";
    for (const kw of keywords) {
      if (content.includes(kw)) add(kw, "概念", 0.75);
    }
  }
  // 地点
  if (types.includes("地点")) {
    const cities = ["西安", "北京", "上海", "广州", "深圳", "成都", "杭州", "武汉", "南京", "重庆"];
    const content = note.content || "";
    for (const c of cities) {
      if (content.includes(c)) add(c, "地点", 0.85);
    }
  }
  return entities;
}

// ---- 笔记分析 ----

function analyzeNote(filePath, entityTypes, vaultDir) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const title = path.basename(filePath, ".md");
    // frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = fmMatch ? fmMatch[1] : "";
    // tags from frontmatter
    const tags = [];
    const tagMatches = frontmatter.match(/#[a-zA-Z\u4e00-\u9fff]+/g) || [];
    for (const t of tagMatches) tags.push(t.replace(/^#/, ""));
    // 正文
    const body = content.replace(/^---[\s\S]*?---\n?/, "");
    // 内部链接
    const internalLinks = [];
    const linkRe = /\[\[([^\[\]]+)\]\]/g;
    let m;
    while ((m = linkRe.exec(content)) !== null) internalLinks.push(m[1]);
    // 外部链接
    const externalLinks = [];
    const urlRe = /https?:\/\/[^\s)]+/g;
    while ((m = urlRe.exec(content)) !== null) externalLinks.push(m[0]);

    const note = {
      file: path.basename(filePath),
      relativePath: filePath.replace(vaultDir, "").replace(/^\\/, ""),
      title,
      frontmatter,
      tags,
      internalLinks,
      externalLinks,
      content: body.slice(0, 10000),
    };
    note.entities = extractEntities(note, entityTypes);
    return note;
  } catch {
    return null;
  }
}

// ---- 关联建议 ----

function generateSuggestions(notes, minConfidence) {
  const suggestions = [];
  const threshold = minConfidence || 0.5;
  const entityIndex = new Map();
  for (const note of notes) {
    for (const entity of note.entities) {
      if (entity.confidence < threshold) continue;
      const key = entity.text;
      if (!entityIndex.has(key)) entityIndex.set(key, []);
      entityIndex.get(key).push({ note: note.file, confidence: entity.confidence, type: entity.type });
    }
  }
  for (const [entityText, appearances] of entityIndex.entries()) {
    if (appearances.length < 2) continue;
    for (let i = 0; i < appearances.length; i++) {
      for (let j = i + 1; j < appearances.length; j++) {
        const a = appearances[i], b = appearances[j];
        if (a.note === b.note) continue;
        suggestions.push({
          source: a.note,
          target: b.note,
          entity: entityText,
          entityType: a.type,
          confidence: Math.min(a.confidence, b.confidence),
          reason: "两篇笔记都提到了「" + entityText + "」",
          suggestedLink: "[[" + b.note.replace(/\.md$/, "") + "]]",
        });
      }
    }
  }
  const seen = new Set();
  const unique = [];
  for (const s of suggestions) {
    const key = s.source + "|" + s.target + "|" + s.entity;
    if (!seen.has(key)) { seen.add(key); unique.push(s); }
  }
  unique.sort((a, b) => b.confidence - a.confidence);
  return unique;
}

// ---- 主逻辑 ----

export async function execute(input = {}, ctx) {
  const { vaultPath, action, scanDepth = 2, maxNotes = 100, minConfidence = 0.5, entityTypes, outputPath } = input;

  if (!vaultPath) {
    return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "vaultPath 必填" }, null, 2) }] };
  }
  if (!fs.existsSync(vaultPath)) {
    return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "Vault 路径不存在: " + vaultPath }, null, 2) }] };
  }

  const files = scanMarkdownFiles(vaultPath, scanDepth);
  const limitedFiles = files.slice(0, maxNotes);

  // scan
  if (action === "scan") {
    const notes = [];
    for (const file of limitedFiles) {
      const analysis = analyzeNote(file, entityTypes, vaultPath);
      if (analysis) notes.push(analysis);
    }
    const totalEntities = notes.reduce((sum, n) => sum + n.entities.length, 0);
    const typeStats = {};
    for (const note of notes) {
      for (const e of note.entities) {
        typeStats[e.type] = (typeStats[e.type] || 0) + 1;
      }
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true, action: "scan", vaultPath,
          notesScanned: notes.length, totalEntities, typeStats,
          notes: notes.slice(0, 20),
          message: "📊 扫描完成：" + notes.length + " 篇笔记，提取 " + totalEntities + " 个实体",
        }, null, 2),
      }],
    };
  }

  // suggest
  if (action === "suggest") {
    const notes = [];
    for (const file of limitedFiles) {
      const analysis = analyzeNote(file, entityTypes, vaultPath);
      if (analysis) notes.push(analysis);
    }
    const suggestions = generateSuggestions(notes, minConfidence);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true, action: "suggest",
          notesScanned: notes.length,
          suggestionsGenerated: suggestions.length,
          topSuggestions: suggestions.slice(0, 30),
          message: "🔗 发现 " + suggestions.length + " 条关联建议（置信度 ≥ " + minConfidence + "）",
        }, null, 2),
      }],
    };
  }

  // export
  if (action === "export") {
    if (!outputPath) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "action=export 时需要 outputPath" }, null, 2) }] };
    }
    const notes = [];
    for (const file of limitedFiles) {
      const analysis = analyzeNote(file, entityTypes, vaultPath);
      if (analysis) notes.push(analysis);
    }
    const suggestions = generateSuggestions(notes, minConfidence);
    const exportData = {
      generatedAt: new Date().toISOString(),
      vaultPath,
      notesScanned: notes.length,
      suggestionsCount: suggestions.length,
      links: suggestions.map(s => ({
        source: s.source,
        target: s.target,
        entity: s.entity,
        entityType: s.entityType,
        confidence: s.confidence,
        markdown: "\n## 关联笔记\n\n- [[" + s.target.replace(/\.md$/, "") + "]]（通过「" + s.entity + "」关联）\n",
        wikilink: "[[" + s.target.replace(/\.md$/, "") + "|" + s.entity + "]]",
      })),
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf-8");
    const mdOutput = outputPath.replace(/\.json$/, "") + "-links.md";
    let mdContent = "# 笔记关联建议\n\n> 生成时间：" + exportData.generatedAt + "\n> 扫描笔记：" + notes.length + " 篇 | 关联建议：" + suggestions.length + " 条\n\n";
    const bySource = new Map();
    for (const link of exportData.links) {
      if (!bySource.has(link.source)) bySource.set(link.source, []);
      bySource.get(link.source).push(link);
    }
    for (const [source, links] of bySource.entries()) {
      mdContent += "## " + source + "\n\n";
      for (const link of links) {
        mdContent += "- " + link.wikilink + " — " + link.entity + "（置信度 " + (link.confidence * 100).toFixed(0) + "%）\n";
      }
      mdContent += "\n";
    }
    fs.writeFileSync(mdOutput, mdContent, "utf-8");
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true, action: "export", outputPath, markdownPath: mdOutput,
          suggestionsCount: suggestions.length,
          message: "✅ 已导出 " + suggestions.length + " 条关联建议\n📄 " + outputPath + "\n📝 " + mdOutput,
        }, null, 2),
      }],
    };
  }

  return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "未知 action，支持 scan / suggest / export" }, null, 2) }] };
}

export { name, description, parameters };
