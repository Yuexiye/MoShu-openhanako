const name = "reorder_chapters";
import fs from "node:fs";
import path from "node:path";

const description = "批量重排章节顺序。接收一个有序的章节ID数组，更新 chapters.json 中的 order 字段。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    orderedIds: { type: "array", items: { type: "string" }, description: "按新顺序排列的章节 ID 数组" },
  },
  required: ["projectId", "orderedIds"],
};

async function execute(input) {
  try {
    const { safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);
    const idxPath = path.join(projDir, "chapters.json");

    if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
    const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));

    // 按 orderedIds 重排 order
    const idOrder = {};
    input.orderedIds.forEach((id, i) => { idOrder[id] = i + 1; });

    idx.chapters.forEach((ch) => {
      if (idOrder[ch.id] !== undefined) {
        ch.order = idOrder[ch.id];
      }
    });

    // 按 order 排序
    idx.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));

    fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8");

    return { content: [{ type: "text", text: JSON.stringify({ ok: true, count: idx.chapters.length }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: e.message }, null, 2) }] };
  }
}

export { name, description, parameters, execute };