const name = "novel_update_card";
const description = "添加或更新项目卡片。类型：characters(人物)/world(世界观)/style(文风)";
const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    type: { type: "string", enum: ["characters", "world", "style"], description: "卡片类型" },
    cardId: { type: "string", description: "卡片 ID（更新时）" },
    name: { type: "string", description: "卡片名称" },
    content: { type: "object", description: "卡片内容" },
    tags: { type: "array", items: { type: "string" }, description: "标签" },
  }, required: ["projectId", "type"],
};

async function execute(input) {
  try {
    const { getDataDir, safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
    const { upsert, TYPE_LABELS } = await import("../lib/cards.js");
    const { json, error } = await import("../lib/output.js");
    const dataDir = await getDataDir();
    // 映射参数名
    const cardInput = { ...input, id: input.cardId || input.id };
    const card = await upsert(dataDir, pid, cardInput);

    // 如果是人物卡，自动同步到关系图
    if (input.type === "characters") {
      try {
        const { syncCardsToGraph } = await import("../lib/graph-store.js");
        const { listCards } = await import("../lib/cards.js");
        const cards = await listCards(dataDir, pid, "characters");
        await syncCardsToGraph(dataDir, pid, cards);
      } catch (syncErr) {
        console.warn("[mo-shu] graph sync failed for card update:", syncErr.message);
      }
    }

    return json({ ok: true, card, message: `✅ ${TYPE_LABELS[input.type]}「${card.name}」${input.cardId ? "已更新" : "已创建"}` });
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
