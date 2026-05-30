// ═══════════════════════════════════
//  墨述 · graph-store
//  实体关系图 + 情节关系图 + 事实图谱
// ═══════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const FACT_TYPES = ["character_trait","world_lore","plot_event","relationship","timeline","rule"];

/**
 * 从项目卡片中提取实体关系边（基于 relationships 字段）
 */
async function buildEntityLinks(cards) {
  const crypto = await import("node:crypto");
  const links = [];

  for (const card of cards) {
    if (!card.relationships || !Array.isArray(card.relationships)) continue;
    for (const rel of card.relationships) {
      if (!rel.targetName) continue;
      const targetCard = cards.find(c => c.name === rel.targetName);
      links.push({
        id: `el_${crypto.randomUUID().slice(0, 8)}`,
        source: card.id,
        sourceName: card.name,
        sourceType: card.type || "character",
        target: targetCard?.id || rel.targetName,
        targetName: rel.targetName,
        targetType: targetCard?.type || "character",
        relation: rel.type || "related",
        description: rel.description || "",
        dynamic: rel.dynamic || "",
        createdAt: new Date().toISOString(),
        deprecatedAt: null,
      });
    }
  }
  return links;
}

/**
 * 读取项目的实体关系边
 */
async function readEntityLinks(dataDir, pid) {
  const p = await import("node:path");
  const { readJSONL } = await import("./store.js");
  const fp = p.join(dataDir, "projects", pid, "graph", "entity_links.jsonl");
  const all = await readJSONL(fp);
  return (all || []).filter(l => !l.deprecatedAt);
}

/**
 * 写入实体关系边（增量）
 */
async function writeEntityLinks(dataDir, pid, links) {
  const p = await import("node:path");
  const { enqueue } = await import("./wqueue.js");
  const fs = await import("node:fs");
  const dir = p.join(dataDir, "projects", pid, "graph");
  const fp = p.join(dir, "entity_links.jsonl");

  await enqueue(async () => {
    fs.mkdirSync(dir, { recursive: true });
    const lines = links.map(l => JSON.stringify(l)).join("\n") + "\n";
    fs.writeFileSync(fp, lines, "utf-8");
  });
}

/**
 * 同步卡片到图
 */
async function syncCardsToGraph(dataDir, pid, cards) {
  const links = await buildEntityLinks(cards);
  await writeEntityLinks(dataDir, pid, links);
  return links;
}

/**
 * 构建内存邻接表 — 同时读取 entity_links 和 fact_links
 */
async function buildAdjacencyGraph(dataDir, pid) {
  const entityLinks = await readEntityLinks(dataDir, pid);
  const p = await import("node:path");
  const fs = await import("node:fs");
  const { readJSONL } = await import("./store.js");
  
  const graphDir = p.join(dataDir, "projects", pid, "graph");
  const factLinksPath = p.join(graphDir, "fact_links.jsonl");
  const factLinks = fs.existsSync(factLinksPath)
    ? await readJSONL(factLinksPath)
    : [];
  
  const links = [...entityLinks, ...factLinks];
  const adjList = new Map();
  const nodeMap = new Map();
  const edges = links;

  for (const link of links) {
    const srcId = String(link.source);
    const tgtId = String(link.target);
    if (!nodeMap.has(srcId)) nodeMap.set(srcId, { id: srcId, name: link.sourceName, type: link.sourceType });
    if (!nodeMap.has(tgtId)) nodeMap.set(tgtId, { id: tgtId, name: link.targetName, type: link.targetType });
    if (!adjList.has(srcId)) adjList.set(srcId, []);
    if (!adjList.has(tgtId)) adjList.set(tgtId, []);
    adjList.get(srcId).push({ nodeId: tgtId, edge: link });
    adjList.get(tgtId).push({ nodeId: srcId, edge: link });
  }

  return { adjList, nodeMap, edges };
}

/**
 * 从事实库中提取人物关系边。
 * 4 条建边策略：
 * 1. 人名匹配（RELATED_TO）— 人物卡和事实之间
 * 2. 同章共现（CO_OCCUR）
 * 3. 中文子串相似度（RELATED）
 * 4. 标签关联（RELATED_TO）
 */
async function buildEntityLinksFromFacts(facts, characterNames, characters = [], nameToId = new Map()) {
  const crypto = await import("node:crypto");
  const links = [];
  const factSet = new Map();

  for (const f of facts) {
    if (f.type === "chapter_history" || f.deprecated_at) continue;
    factSet.set(f.id, f);
  }

  const factIds = [...factSet.keys()];

  // 策略 1：fact content 中提到的人物
  for (const [fid, f] of factSet) {
    const content = f.content || "";
    for (const name of characterNames) {
      if (content.includes(name)) {
        links.push({
          id: `el_${crypto.randomUUID().slice(0, 8)}`,
          source: fid,
          sourceName: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
          sourceType: "fact",
          target: name,
          targetName: name,
          targetType: "character",
          relation: "RELATED_TO",
          description: f.type || "",
          dynamic: f.tags?.join(", ") || "",
          createdAt: f.created_at || new Date().toISOString(),
          deprecatedAt: null,
        });
      }
    }
  // 策略 2：同 sourceChapter 的 fact → CO_OCCUR（用分组代替 O(n²)）
  const chapterGroups = new Map();
  for (const [fid, f] of factSet) {
    if (f.source_chapter) {
      if (!chapterGroups.has(f.source_chapter)) chapterGroups.set(f.source_chapter, []);
      chapterGroups.get(f.source_chapter).push([fid, f]);
    }
  }
  for (const [chapter, group] of chapterGroups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [fid, f] = group[i], [fid2, f2] = group[j];
        links.push({
          id: `el_${crypto.randomUUID().slice(0, 8)}`,
          source: fid,
          sourceName: (f.content || "").slice(0, 40),
          sourceType: "fact",
          target: fid2,
          targetName: (f2.content || "").slice(0, 40),
          targetType: "fact",
          relation: "CO_OCCUR",
          description: `共享章节 ${chapter}`,
          dynamic: "",
          createdAt: f.created_at || new Date().toISOString(),
          deprecatedAt: null,
        });
      }
    }
  }
}

  // 策略 3：所有非 chapter_history fact 若共享中文子串 → RELATED
  function extractTokens(text) {
    const cn = (text || "").match(/[\p{Script=Han}]/gu) || [];
    const tokens = new Set();
    for (let len = 2; len <= 4 && len <= cn.length; len++) {
      for (let i = 0; i <= cn.length - len; i++) {
        tokens.add(cn.slice(i, i + len).join(""));
      }
    }
    return tokens;
  }
  
  if (factSet.size >= 2) {
    const factArray = [...factSet.entries()];
    const tokenSets = factArray.map(([fid, f]) => ({ id: fid, tokens: extractTokens(f.content) }));
    for (let i = 0; i < tokenSets.length; i++) {
      for (let j = i + 1; j < tokenSets.length; j++) {
        const a = tokenSets[i], b = tokenSets[j];
        // 从长到短检查，找到即停
        const sortedTokens = [...a.tokens].sort((x, y) => y.length - x.length);
        let longestShared = "";
        for (const t of sortedTokens) {
          if (b.tokens.has(t)) {
            longestShared = t;
            break; // 已是最长
          }
        }
        if (longestShared.length >= 3) {
          const fa = factSet.get(a.id), fb = factSet.get(b.id);
          links.push({
            id: `el_${crypto.randomUUID().slice(0, 8)}`,
            source: a.id,
            sourceName: (fa?.content || "").slice(0, 40),
            sourceType: "fact",
            target: b.id,
            targetName: (fb?.content || "").slice(0, 40),
            targetType: "fact",
            relation: "RELATED",
            description: `共享关键词: ${longestShared}`,
            dynamic: `${fa?.type} ↔ ${fb?.type}`,
            createdAt: fa?.created_at || new Date().toISOString(),
            deprecatedAt: null,
          });
        }
      }
    }
  }

  // 策略 4：标签关联 — fact 的 tag 和人物 card 的 tag 有交集 → RELATED_TO
  if (characters.length > 0) {
    for (const [fid, f] of factSet) {
      const factTags = new Set((f.tags || []).map(t => t.toLowerCase()));
      if (factTags.size === 0) continue;
      for (const c of characters) {
        const cardTags = new Set((c.tags || []).map(t => t.toLowerCase()));
        if (cardTags.size === 0) continue;
        const sharedTags = [...factTags].filter(t => cardTags.has(t));
        if (sharedTags.length > 0) {
          links.push({
            id: `el_${crypto.randomUUID().slice(0, 8)}`,
            source: fid,
            sourceName: (f.content || "").slice(0, 40),
            sourceType: "fact",
            target: c.id || c.name,
            targetName: c.name,
            targetType: "character",
            relation: "RELATED_TO",
            description: `共享标签: ${sharedTags.join(", ")}`,
            dynamic: "",
            createdAt: f.created_at || new Date().toISOString(),
            deprecatedAt: null,
          });
        }
      }
    }
  }

  return links;
}

/**
 * 同步事实到图谱：从 facts.jsonl 提取关系边，写入 fact_links.jsonl
 */
async function syncFactsToGraph(dataDir, pid, facts) {
  const p = await import("node:path");
  const { readJSON } = await import("./store.js");

  const characters = [];
  const characterNames = new Set();
  const nameToId = new Map();

  const cardsPath = p.join(dataDir, "projects", pid, "cards", "characters.json");
  if (await (await import("node:fs")).promises.access(cardsPath).then(() => true).catch(() => false)) {
    const cards = await readJSON(cardsPath);
    if (cards?.cards) {
      cards.cards.forEach(c => {
        if (c.type === "characters") {
          characters.push(c);
          characterNames.add(c.name);
          if (c.id) nameToId.set(c.name, c.id);
        }
      });
    }
  }
  const oldCardsPath = p.join(dataDir, "projects", pid, "cards.json");
  if (await (await import("node:fs")).promises.access(oldCardsPath).then(() => true).catch(() => false)) {
    const cards = await readJSON(oldCardsPath);
    if (cards?.characters) {
      cards.characters.forEach(c => {
        characters.push(c);
        characterNames.add(c.name);
        if (c.id) nameToId.set(c.name, c.id);
      });
    }
  }

  const links = await buildEntityLinksFromFacts(facts, [...characterNames], characters, nameToId);

  const fs = await import("node:fs");
  const dir = p.join(dataDir, "projects", pid, "graph");
  const fp = p.join(dir, "fact_links.jsonl");
  fs.mkdirSync(dir, { recursive: true });
  if (links.length > 0) {
    fs.writeFileSync(fp, links.map(l => JSON.stringify(l)).join("\n") + "\n", "utf-8");
  } else {
    try { fs.unlinkSync(fp); } catch {}
  }

  return links;
}

export { buildEntityLinks, buildEntityLinksFromFacts, readEntityLinks, writeEntityLinks, syncCardsToGraph, syncFactsToGraph, FACT_TYPES };
