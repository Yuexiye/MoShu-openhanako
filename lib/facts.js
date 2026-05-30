const FACT_TYPES = ["character_trait","world_lore","plot_event","relationship","timeline","rule","property_state"];

async function createFact({ type, content, sourceChapter, confidence, tags, constant, priority, chapterGate }) {
  const crypto = await import("node:crypto");
  if (!FACT_TYPES.includes(type)) throw new Error(`无效事实类型: ${type}`);
  return {
    id: `fact_${crypto.randomUUID()}`,
    type,
    content,
    source_chapter: sourceChapter || null,
    confidence: Math.min(1, Math.max(0, confidence || 1.0)),
    created_at: new Date().toISOString(),
    deprecated_at: null,
    overridden_by: null,
    tags: tags || [],
    constant: constant || false,
    priority: priority != null ? priority : 0,
    chapter_gate: chapterGate || null,
  };
}

async function addFact(dataDir, pid, factData) {
  const p = await import("node:path");
  const { enqueue } = await import("./wqueue.js");
  const { readJSONL, appendJSONL } = await import("./store.js");
  const fs = await import("node:fs");
  const fp = p.join(dataDir, "projects", pid, "facts.jsonl");
  const fact = await createFact(factData);
  if (factData.overriddenFactId) {
    await enqueue(async () => {
      const all = await readJSONL(fp);
      const updated = all.map(f => {
        if (f.id === factData.overriddenFactId && !f.deprecated_at) {
          f.deprecated_at = new Date().toISOString();
          fact.overridden_by = f.id;
        }
        return f;
      });
      fs.writeFileSync(fp, [...updated, fact].map(f => JSON.stringify(f)).join("\n") + "\n", "utf-8");
    });
  } else {
    await appendJSONL(fp, fact);
  }
  return fact;
}

async function searchFacts(dataDir, pid, { keyword, type, tag, minConfidence, limit, constantOnly }) {
  const p = await import("node:path");
  const { readJSONL } = await import("./store.js");
  let facts = await readJSONL(p.join(dataDir, "projects", pid, "facts.jsonl"));
  facts = facts.filter(f => !f.deprecated_at && !f.overridden_by);
  if (type && FACT_TYPES.includes(type)) facts = facts.filter(f => f.type === type);
  if (tag) facts = facts.filter(f => f.tags && f.tags.some(t => t.includes(tag)));
  if (minConfidence != null) facts = facts.filter(f => (f.confidence || 1.0) >= minConfidence);
  if (constantOnly) facts = facts.filter(f => f.constant === true);
  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase();
    facts = facts.filter(f => (f.content + " " + (f.tags || []).join(" ")).toLowerCase().includes(kw));
  }
  facts.sort((a, b) => {
    const pDiff = (b.priority || 0) - (a.priority || 0);
    if (pDiff !== 0) return pDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  });
  if (limit > 0) facts = facts.slice(0, limit);
  return facts;
}

async function compactFacts(dataDir, pid) {
  const p = await import("node:path");
  const { enqueue } = await import("./wqueue.js");
  const fs = await import("node:fs");
  const fp = p.join(dataDir, "projects", pid, "facts.jsonl");
  const all = await readJSONL(fp);
  if (all.length < 2) return { compacted: false, reason: "事实太少" };
  const active = all.filter(f => !f.deprecated_at && !f.overridden_by);
  if (active.length === all.length) return { compacted: false, reason: "无废弃事实", total: all.length };
  const archived = all.filter(f => f.deprecated_at || f.overridden_by);
  await enqueue(async () => {
    fs.writeFileSync(fp, active.map(f => JSON.stringify(f)).join("\n") + "\n", "utf-8");
    const archive = p.join(dataDir, "projects", pid, "facts_archive.jsonl");
    fs.appendFileSync(archive, archived.map(f => JSON.stringify(f)).join("\n") + "\n", "utf-8");
  });
  return { compacted: true, total: all.length, active: active.length, archived: archived.length };
}

async function stats(dataDir, pid) {
  const p = await import("node:path");
  const { readJSONL } = await import("./store.js");
  const all = await readJSONL(p.join(dataDir, "projects", pid, "facts.jsonl"));
  const active = all.filter(f => !f.deprecated_at && !f.overridden_by);
  const byType = {};
  for (const f of active) byType[f.type] = (byType[f.type] || 0) + 1;
  return { total: all.length, active: active.length, byType };
}

export { addFact, searchFacts, compactFacts, stats, FACT_TYPES };
