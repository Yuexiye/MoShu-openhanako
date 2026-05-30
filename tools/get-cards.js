const name = "novel_get_cards";
const description = "获取项目卡片列表，可选按类型过滤";
const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    type: { type: "string", enum: ["characters", "world", "style", ""], description: "卡片类型（可选）" },
  }, required: ["projectId"],
};

async function execute(input) {
  try {
    const { getDataDir, safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
    const { listCards, TYPE_LABELS } = await import("../lib/cards.js");
    const { ok, json, error } = await import("../lib/output.js");
    const cards = await listCards(await getDataDir(), input.projectId, input.type || null);
    if (!cards.length) return ok(`📭 暂无${input.type ? TYPE_LABELS[input.type] : "卡片"}`);
    return json({ ok: true, count: cards.length, cards: cards.map(c => ({ id: c.id, name: c.name, type: c.type, tags: c.tags, updated_at: c.updated_at })) });
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
