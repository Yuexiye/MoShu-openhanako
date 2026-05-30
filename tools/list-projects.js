const name = "novel_list_projects";
const description = "列出所有写作项目";
const parameters = { type: "object", properties: {} };

async function execute() {
  try {
    const { getDataDir } = await import("../lib/config.js");
    const { list } = await import("../lib/project.js");
    const { ok, json, error } = await import("../lib/output.js");
    const projects = await list(await getDataDir());
    if (!projects.length) return ok("📭 暂无项目");
    return json({ ok: true, count: projects.length, projects: projects.map(p => ({ id: p.id, name: p.name, type: p.type, cards: p.cardCount, chapters: p.chapterCount })) });
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
