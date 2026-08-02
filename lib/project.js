function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "proj";
}

async function create(dataDir, { name, type, summary }) {
  const p = await import("node:path"), fs = await import("node:fs");
  const { writeJSON, exists } = await import("./store.js");
  const id = slug(name), dir = p.join(dataDir, "projects", id);
  if (await exists(dir)) throw new Error(`项目已存在`);
  const now = new Date().toISOString();
  const proj = { id, name, type: type || "未分类", summary: summary || "", created_at: now, updated_at: now, cardCount: 0, chapterCount: 0 };
  await writeJSON(p.join(dir, "project.json"), proj);
  await writeJSON(p.join(dir, "volumes.json"), { volumes: [{ id: "v1", title: "第一卷", order: 1, summary: "", chapters: [] }] });
  await writeJSON(p.join(dir, "chapters.json"), { chapters: [] });
  fs.mkdirSync(p.join(dir, "chapters"), { recursive: true });
  fs.mkdirSync(p.join(dir, "cards"), { recursive: true });
  await writeJSON(p.join(dir, "cards", "characters.json"), { cards: [] });
  await writeJSON(p.join(dir, "cards", "world.json"), { cards: [] });
  await writeJSON(p.join(dir, "cards", "style.json"), { cards: [] });
  fs.writeFileSync(p.join(dir, "facts.jsonl"), "", "utf-8");
  return proj;
}

async function list(dataDir) {
  const p = await import("node:path");
  const { readJSON, listDir } = await import("./store.js");
  const dir = p.join(dataDir, "projects");
  const items = (await listDir(dir)).map(async (d) => await readJSON(p.join(dir, d, "project.json")));
  const projects = (await Promise.all(items)).filter(Boolean);
  return projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

async function get(dataDir, id) {
  const p = await import("node:path");
  const { readJSON } = await import("./store.js");
  return await readJSON(p.join(dataDir, "projects", id, "project.json"));
}

export { create, list, get };
