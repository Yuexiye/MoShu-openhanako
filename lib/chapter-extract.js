// ═══════════════════════════════════
//  墨述 · 章节情节提取引擎
//  从章节文本中提取人物互动 → 情节关系边
// ═══════════════════════════════════

import fs from "node:fs";
import path from "node:path";

/**
 * 从章节文本中提取人物互动关系。
 * 策略：
 * 1. 用所有人物卡名字做全文匹配，记录每段出现的人物
 * 2. 同一段/同一句中出现 ≥2 人 → 产生一条互动边
 * 3. 边带权重（出现次数）、最近互动章节、互动类型（对话/行动/同框）
 */

async function extractChapterInteractions(dataDir, projectId, chapterId, chapterBody, characterCards) {
  const charNames = [...new Set(characterCards
    .filter(c => c.type === "characters" && c.name)
    .map(c => c.name.trim()))]
    .sort((a, b) => b.length - a.length); // 长名优先，避免短名误匹配

  if (charNames.length === 0) return [];

  // 按段落切分（双换行 + 中文句号结束的段）
  const paragraphs = chapterBody.split(/\n\n+|[。！？!?](?=\n)/).filter(s => s.trim().length > 0);

  const interactions = new Map();

  for (const para of paragraphs) {
    const mentioned = [...new Set(charNames.filter(name => para.includes(name)))];
    if (mentioned.length < 2) continue;

    // 判断互动类型
    const hasQuote = /[""'']/.test(para);
    const type = hasQuote ? "dialogue" : "co_present";

    // 两两配对
    for (let i = 0; i < mentioned.length; i++) {
      for (let j = i + 1; j < mentioned.length; j++) {
        const key = [mentioned[i], mentioned[j]].sort().join("|");
        const existing = interactions.get(key);
        if (existing) {
          existing.count++;
          existing.lastChapter = chapterId;
          if (type === "dialogue") existing.type = type; // 对话优先级更高
        } else {
          interactions.set(key, {
            source: mentioned[i],
            target: mentioned[j],
            count: 1,
            type,
            lastChapter: chapterId,
          });
        }
      }
    }
  }

  return [...interactions.values()];
}

/**
 * 为项目所有章节批量提取情节互动，写入 chapter_links.jsonl
 */
async function syncChaptersToGraph(dataDir, projectId) {
  const { safeProjectId } = await import("./config.js");
  const pid = safeProjectId(projectId);
  if (!pid) throw new Error("无效项目 ID");
  const projDir = path.join(dataDir, "projects", pid);
  const chaptersPath = path.join(projDir, "chapters.json");
  if (!fs.existsSync(chaptersPath)) return [];

  const chaptersIdx = JSON.parse(fs.readFileSync(chaptersPath, "utf-8"));
  const charCards = await _loadCharacterCards(dataDir, projectId);

  const graphDir = path.join(projDir, "graph");
  fs.mkdirSync(graphDir, { recursive: true });
  const linksPath = path.join(graphDir, "chapter_links.jsonl");

  const allLinks = [];

  for (const ch of (chaptersIdx.chapters || [])) {
    const chPath = path.join(projDir, "chapters", ch.id + ".md");
    if (!fs.existsSync(chPath)) continue;
    const body = fs.readFileSync(chPath, "utf-8");
    const interactions = await extractChapterInteractions(dataDir, projectId, ch.id, body, charCards);

    for (const inter of interactions) {
      allLinks.push({
        id: `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        source: inter.source,
        sourceName: inter.source,
        sourceType: "characters",
        target: inter.target,
        targetName: inter.target,
        targetType: "characters",
        relation: inter.type === "dialogue" ? "对话" : "同框",
        description: ch.title,
        count: inter.count,
        lastChapter: inter.lastChapter,
        createdAt: new Date().toISOString(),
        deprecatedAt: null,
      });
    }
  }

  // 聚合：相同人物对的多次互动合并
  const merged = new Map();
  for (const link of allLinks) {
    const key = [link.source, link.target].sort().join("|");
    const existing = merged.get(key);
    if (existing) {
      existing.count += link.count;
      existing.lastChapter = link.lastChapter;
      existing.description = link.description;
    } else {
      merged.set(key, link);
    }
  }

  // 写文件（串行化防止并发写冲突）
  const { enqueue } = await import("./wqueue.js");
  await enqueue(async () => {
    const lines = [...merged.values()].map(l => JSON.stringify(l));
    fs.writeFileSync(linksPath, lines.join("\n") + "\n", "utf-8");
  });

  return [...merged.values()];
}

// 防抖：1 秒内多次调用只执行最后一次
let _plotSyncTimer = null;
async function syncChaptersToGraphDebounced(dataDir, projectId) {
  return new Promise(resolve => {
    clearTimeout(_plotSyncTimer);
    _plotSyncTimer = setTimeout(async () => {
      try {
        const links = await syncChaptersToGraph(dataDir, projectId);
        resolve(links);
      } catch (e) {
        resolve([]);
      }
    }, 1000);
  });
}

async function _loadCharacterCards(dataDir, projectId) {
  const { safeProjectId } = await import("./config.js");
  const pid = safeProjectId(projectId);
  if (!pid) return [];
  const fp = path.join(dataDir, "projects", pid, "cards", "characters.json");
  if (!fs.existsSync(fp)) return [];
  const d = JSON.parse(fs.readFileSync(fp, "utf-8"));
  return d.cards || [];
}

export { extractChapterInteractions, syncChaptersToGraph, syncChaptersToGraphDebounced };
