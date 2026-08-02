const TYPE_LABELS = { characters: "人物卡", world: "世界观卡", style: "文风卡" };
const TYPES = Object.keys(TYPE_LABELS);

async function upsert(dataDir, pid, { type, id, name, content, tags, relationships }) {
  if (!TYPES.includes(type)) throw new Error(`无效卡片类型`);
  const p = await import("node:path");
  const { readJSON, writeJSON } = await import("./store.js");
  const fp = p.join(dataDir, "projects", pid, "cards", `${type}.json`);
  const d = (await readJSON(fp)) || { cards: [] };
  const now = new Date().toISOString();
  if (id) {
    const i = d.cards.findIndex(c => c.id === id);
    if (i === -1) throw new Error(`卡片不存在`);
    const updates = { name, content, tags, updated_at: now };
    if (relationships !== undefined) updates.relationships = relationships;
    Object.assign(d.cards[i], updates);
  } else {
    const crypto = await import("node:crypto");
    const newCard = { id: `c_${crypto.randomUUID().slice(0, 8)}`, type, name: name || "未命名", content: content || {}, tags: tags || [], created_at: now, updated_at: now };
    if (relationships) newCard.relationships = relationships;
    d.cards.push(newCard);
  }
  await writeJSON(fp, d);
  const { get } = await import("./project.js");
  const proj = await get(dataDir, pid);
  if (proj) { proj.cardCount = d.cards.length; proj.updated_at = now; await writeJSON(p.join(dataDir, "projects", pid, "project.json"), proj); }
  return id ? d.cards.find(c => c.id === id) : d.cards[d.cards.length - 1];
}

async function listCards(dataDir, pid, type) {
  const p = await import("node:path"), { readJSON } = await import("./store.js");
  if (type) return (await readJSON(p.join(dataDir, "projects", pid, "cards", `${type}.json`)))?.cards || [];
  const all = [];
  for (const t of TYPES) { const d = await readJSON(p.join(dataDir, "projects", pid, "cards", `${t}.json`)); if (d?.cards) all.push(...d.cards); }
  return all;
}

export { upsert, listCards, TYPES, TYPE_LABELS };
