/**
 * knowledge.js — 辞海
 * knowledge.json: rules(规则) + terms(术语) + lore(世界观知识)
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const EMPTY = Object.freeze({ version: 1, rules: [], terms: [], lore: [] });

function read(dataDir, projectId) {
  const fp = path.join(dataDir, "projects", projectId, "knowledge.json");
  if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(EMPTY));
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function write(dataDir, projectId, data) {
  const fp = path.join(dataDir, "projects", projectId, "knowledge.json");
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

// ── 规则 ──

function addRule(dataDir, projectId, { id, name, category, priority, premise, effect, cost, limitation, conflicts, sourceChapter, tags }) {
  const k = read(dataDir, projectId);
  const rule = {
    id: id || genId("rule"),
    name: name || "新规则",
    category: category || "general",
    priority: priority ?? 1,
    premise: premise || "",
    effect: effect || "",
    cost: cost || "",
    limitation: limitation || "",
    conflicts: conflicts || [],
    sourceChapter: sourceChapter || null,
    tags: tags || [],
  };
  k.rules.push(rule);
  write(dataDir, projectId, k);
  return { ok: true, rule };
}

function updateRule(dataDir, projectId, ruleId, updates) {
  const k = read(dataDir, projectId);
  const idx = k.rules.findIndex(r => r.id === ruleId);
  if (idx === -1) throw new Error(`规则 ${ruleId} 不存在`);
  Object.assign(k.rules[idx], updates);
  write(dataDir, projectId, k);
  return { ok: true, rule: k.rules[idx] };
}

function removeRule(dataDir, projectId, ruleId) {
  const k = read(dataDir, projectId);
  k.rules = k.rules.filter(r => r.id !== ruleId);
  write(dataDir, projectId, k);
  return { ok: true };
}

function listRules(dataDir, projectId) {
  return read(dataDir, projectId).rules;
}

// 规则冲突检测
function checkRuleConflicts(dataDir, projectId) {
  const k = read(dataDir, projectId);
  const conflicts = [];
  for (let i = 0; i < k.rules.length; i++) {
    for (let j = i + 1; j < k.rules.length; j++) {
      const a = k.rules[i], b = k.rules[j];
      // 同分类 + 同一前提 → 可能冲突
      if (a.category === b.category && a.premise && b.premise && a.premise === b.premise) {
        if (a.effect !== b.effect || a.limitation !== b.limitation) {
          conflicts.push({
            ruleA: { id: a.id, name: a.name },
            ruleB: { id: b.id, name: b.name },
            type: "same_premise_different_effect",
            severity: "warning",
          });
        }
      }
    }
  }
  return conflicts;
}

// ── 术语 ──

function addTerm(dataDir, projectId, { id, term, definition, category, aliases, firstAppearance, relatedTerms, tags }) {
  const k = read(dataDir, projectId);
  const entry = {
    id: id || genId("term"),
    term: term || "新术语",
    definition: definition || "",
    category: category || "general",
    aliases: aliases || [],
    firstAppearance: firstAppearance || null,
    relatedTerms: relatedTerms || [],
    tags: tags || [],
  };
  k.terms.push(entry);
  write(dataDir, projectId, k);
  return { ok: true, term: entry };
}

function listTerms(dataDir, projectId) {
  return read(dataDir, projectId).terms;
}

// ── Lore ──

function addLore(dataDir, projectId, { id, title, content, category, sourceChapter, tags }) {
  const k = read(dataDir, projectId);
  const lore = {
    id: id || genId("lore"),
    title: title || "新条目",
    content: content || "",
    category: category || "general",
    sourceChapter: sourceChapter || null,
    tags: tags || [],
  };
  k.lore.push(lore);
  write(dataDir, projectId, k);
  return { ok: true, lore };
}

function listLore(dataDir, projectId) {
  return read(dataDir, projectId).lore;
}

// ── 搜索 ──

function searchKnowledge(dataDir, projectId, keyword) {
  const k = read(dataDir, projectId);
  const kw = keyword.toLowerCase();
  const results = { rules: [], terms: [], lore: [] };

  for (const r of k.rules) {
    if (JSON.stringify(r).toLowerCase().includes(kw)) results.rules.push(r);
  }
  for (const t of k.terms) {
    if (JSON.stringify(t).toLowerCase().includes(kw)) results.terms.push(t);
  }
  for (const l of k.lore) {
    if (JSON.stringify(l).toLowerCase().includes(kw)) results.lore.push(l);
  }

  results.total = results.rules.length + results.terms.length + results.lore.length;
  return results;
}

function getAll(dataDir, projectId) {
  const k = read(dataDir, projectId);
  return { rules: k.rules, terms: k.terms, lore: k.lore };
}

export {
  EMPTY, read, write, getAll,
  addRule, updateRule, removeRule, listRules, checkRuleConflicts,
  addTerm, listTerms,
  addLore, listLore,
  searchKnowledge,
  genId,
};