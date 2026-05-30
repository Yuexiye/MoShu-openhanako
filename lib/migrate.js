/**
 * migrate.js — 墨述 v0.2.x → v0.3.0 数据迁移
 * 在 plugin onload 时调用，自动检测并迁移旧项目
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * 检查项目是否需要迁移
 * @returns {boolean} 如果 structure.json 存在且版本 >= 1，则不需要迁移
 */
function needsMigration(dataDir, projectId) {
  const sp = path.join(dataDir, "projects", projectId, "structure.json");
  if (!fs.existsSync(sp)) return true;
  const s = JSON.parse(fs.readFileSync(sp, "utf-8"));
  return !s.version || s.version < 1;
}

/**
 * 迁移单个项目
 * @returns {{ ok: boolean, migrated: string[], skipped: string[] }}
 */
function migrateProject(dataDir, projectId) {
  const projDir = path.join(dataDir, "projects", projectId);
  if (!fs.existsSync(projDir)) return { ok: false, error: "项目目录不存在" };

  const result = { ok: true, migrated: [], skipped: [] };

  // ── 1. 迁移 structure.json ──
  const volumesPath = path.join(projDir, "volumes.json");
  const chaptersPath = path.join(projDir, "chapters.json");
  const structurePath = path.join(projDir, "structure.json");

  if (!fs.existsSync(structurePath)) {
    const structure = buildStructure(projDir, volumesPath, chaptersPath);
    fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2), "utf-8");
    result.migrated.push("structure.json");
    // 备份旧文件
    backupFile(volumesPath);
    // chapters.json 保留但标记（精简为纯索引）
  } else {
    result.skipped.push("structure.json");
  }

  // ── 2. 迁移 cards.json ──
  const cardsDir = path.join(projDir, "cards");
  const cardsPath = path.join(projDir, "cards.json");
  if (!fs.existsSync(cardsPath) && fs.existsSync(cardsDir)) {
    const cards = buildCards(projDir);
    fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2), "utf-8");
    result.migrated.push("cards.json");
    // 备份旧卡片目录
    backupDir(cardsDir);
  } else {
    result.skipped.push("cards.json");
  }

  // ── 3. 迁移 knowledge.json ──
  const knowledgePath = path.join(projDir, "knowledge.json");
  const factsPath = path.join(projDir, "facts.jsonl");
  if (!fs.existsSync(knowledgePath) && fs.existsSync(factsPath)) {
    const { knowledge, remainingFacts } = buildKnowledge(projDir);
    fs.writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2), "utf-8");
    // 写回精简后的 facts
    fs.writeFileSync(factsPath, remainingFacts.map(f => JSON.stringify(f)).join("\n") + (remainingFacts.length ? "\n" : ""), "utf-8");
    result.migrated.push("knowledge.json");
  } else {
    result.skipped.push("knowledge.json");
  }

  // ── 4. 更新 project.json 版本号 ──
  const projectPath = path.join(projDir, "project.json");
  if (fs.existsSync(projectPath)) {
    const proj = JSON.parse(fs.readFileSync(projectPath, "utf-8"));
    proj.schemaVersion = 1;
    proj.updated_at = new Date().toISOString();
    fs.writeFileSync(projectPath, JSON.stringify(proj, null, 2), "utf-8");
  }

  return result;
}

/**
 * 批量迁移所有项目
 */
function migrateAll(dataDir) {
  const projDir = path.join(dataDir, "projects");
  if (!fs.existsSync(projDir)) return { ok: true, migrated: 0, skipped: 0, details: [] };

  const details = [];
  const ids = fs.readdirSync(projDir).filter(d => {
    const stat = fs.statSync(path.join(projDir, d));
    return stat.isDirectory() && fs.existsSync(path.join(projDir, d, "project.json"));
  });

  for (const id of ids) {
    try {
      const r = migrateProject(dataDir, id);
      details.push({ projectId: id, ...r });
    } catch (e) {
      details.push({ projectId: id, ok: false, error: e.message });
    }
  }

  return {
    ok: true,
    total: ids.length,
    migrated: details.filter(d => (d.migrated || []).length > 0).length,
    details,
  };
}

// ── 内部构建函数 ──

function buildStructure(projDir, volumesPath, chaptersPath) {
  const structure = { version: 1, parts: [], arcs: [], timeline: [] };

  // 先尝试从 volumes.json 读取层级
  if (fs.existsSync(volumesPath)) {
    try {
      const volumes = JSON.parse(fs.readFileSync(volumesPath, "utf-8"));
      if (volumes.volumes) {
        structure.parts = volumes.volumes.map(v => ({
          id: v.id || genId("p"),
          title: v.title || "未命名卷",
          type: "volume",
          order: v.order || 1,
          summary: v.summary || "",
          children: [], // chapters 稍后挂入
        }));
      }
    } catch {} // 忽略损坏的 volumes.json
  }

  // 从 chapters.json 读取章节列表
  if (fs.existsSync(chaptersPath)) {
    try {
      const chapters = JSON.parse(fs.readFileSync(chaptersPath, "utf-8"));
      if (chapters.chapters) {
        if (structure.parts.length === 0) {
          // 没有 volumes，创建一个默认卷
          structure.parts.push({
            id: "v1",
            title: "第一卷",
            type: "volume",
            order: 1,
            summary: "",
            children: [],
          });
        }

        const sorted = [...chapters.chapters].sort((a, b) => a.order - b.order);
        for (const ch of sorted) {
          const chNode = {
            id: ch.id,
            title: ch.title || "未命名",
            type: "chapter",
            order: ch.order || 1,
          };

          // 按 chapter.volume 挂到对应卷下
          if (ch.volume) {
            const vol = structure.parts.find(p => p.id === ch.volume || p.title === ch.volume);
            if (vol) {
              vol.children.push(chNode);
              continue;
            }
          }

          // 默认挂第一个卷
          structure.parts[0].children.push(chNode);
        }
      }
    } catch {} // 忽略损坏的 chapters.json
  }

  return structure;
}

function buildCards(projDir) {
  const cards = { version: 1, characters: [], world: [], style: [] };
  const types = ["characters", "world", "style"];

  for (const t of types) {
    const fp = path.join(projDir, "cards", `${t}.json`);
    if (fs.existsSync(fp)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp, "utf-8"));
        if (d.cards) {
          cards[t] = d.cards.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type || t,
            content: normalizeCardContent(t, c.content || {}),
            tags: c.tags || [],
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || c.created_at || new Date().toISOString(),
          }));
        }
      } catch {} // 忽略损坏
    }
  }

  return cards;
}

function normalizeCardContent(type, content) {
  if (type === "characters") {
    return {
      basic: {
        name: content.name || content.basic?.name || "",
        age: content.age || content.basic?.age || "",
        gender: content.gender || content.basic?.gender || "",
        appearance: content.appearance || content.basic?.appearance || "",
        identity: content.identity || content.basic?.identity || "",
      },
      personality: {
        traits: content.traits || content.personality?.traits || [],
        description: content.personality_description || content.personality?.description || "",
        quirks: content.quirks || content.personality?.quirks || [],
      },
      background: {
        origin: content.origin || content.background?.origin || "",
        history: content.history || content.background?.history || "",
        motivation: content.motivation || content.background?.motivation || "",
      },
      relationships: content.relationships || [],
      arc: content.arc || [],
      abilities: content.abilities || [],
      notes: content.notes || "",
    };
  }
  if (type === "world") return {
    era: content.era || "",
    geography: content.geography || "",
    society: content.society || "",
    technology: content.technology || "",
    culture: content.culture || "",
  };
  if (type === "style") return {
    pov: content.pov || "",
    tense: content.tense || "",
    tone: content.tone || "",
    pacing: content.pacing || "",
    forbidden: content.forbidden || [],
  };
  return content;
}

function buildKnowledge(projDir) {
  const factsPath = path.join(projDir, "facts.jsonl");
  const knowledge = { version: 1, rules: [], terms: [], lore: [] };
  const remainingFacts = [];

  if (fs.existsSync(factsPath)) {
    const allFacts = fs.readFileSync(factsPath, "utf-8")
      .split("\n").filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    for (const f of allFacts) {
      // rule → knowledge.rules
      if (f.type === "rule") {
        knowledge.rules.push({
          id: f.id || genId("rule"),
          name: f.content || "未知规则",
          category: "general",
          priority: 1,
          premise: "",
          effect: f.content || "",
          cost: "",
          limitation: "",
          conflicts: [],
          sourceChapter: f.source_chapter || null,
          tags: f.tags || [],
        });
      }
      // world_lore → knowledge.lore
      else if (f.type === "world_lore") {
        knowledge.lore.push({
          id: f.id || genId("lore"),
          title: f.content?.slice(0, 50) || "未知条目",
          content: f.content || "",
          category: "general",
          sourceChapter: f.source_chapter || null,
          tags: f.tags || [],
        });
      }
      // timeline → structure.timeline (这里不处理，由 structure 构建时处理)
      // 其他类型保留
      else {
        remainingFacts.push(f);
      }
    }
  }

  return { knowledge, remainingFacts };
}

// ── 备份 ──

function backupFile(fp) {
  if (!fs.existsSync(fp)) return;
  const bak = fp + ".v0.bak";
  if (fs.existsSync(bak)) return; // 已经备份过
  fs.renameSync(fp, bak);
}

function backupDir(dir) {
  if (!fs.existsSync(dir)) return;
  const bak = dir + "_v0.bak";
  if (fs.existsSync(bak)) return;
  fs.renameSync(dir, bak);
}

export { needsMigration, migrateProject, migrateAll };