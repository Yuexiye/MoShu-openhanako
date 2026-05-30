const name = "merge_chapters";
import fs from "node:fs";
import path from "node:path";

const description = "合并多个章节为一个章节。将选中章节的正文按顺序拼接，生成新章节。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    chapterIds: { type: "array", items: { type: "string" }, description: "要合并的章节 ID 数组（按顺序）" },
    newTitle: { type: "string", description: "合并后的新章节标题" },
    newVolume: { type: "string", description: "所属卷名（可选）" },
  },
  required: ["projectId", "chapterIds", "newTitle"],
};

async function execute(input) {
  try {
    const { safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);
    const idxPath = path.join(projDir, "chapters.json");
    const chDir = path.join(projDir, "chapters");

    if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
    const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));

    // 收集要合并的章节正文
    const bodies = [];
    const mergedIds = [];
    let mergedOrder = Infinity;
    for (const chId of input.chapterIds) {
      const meta = idx.chapters.find(c => c.id === chId);
      if (!meta) continue;
      mergedIds.push(chId);
      if (meta.order < mergedOrder) mergedOrder = meta.order;
      const mdPath = path.join(chDir, `${chId}.md`);
      if (fs.existsSync(mdPath)) {
        const body = fs.readFileSync(mdPath, "utf-8");
        bodies.push(`## ${meta.title}\n\n${body}`);
      }
    }

    if (bodies.length === 0) throw new Error("没有找到可合并的章节内容");

    // 生成新章节 ID
    const nextNum = idx.chapters.length + 1;
    const newId = `ch_${String(nextNum).padStart(2, "0")}`;
    const now = new Date().toISOString();
    const combinedBody = bodies.join("\n\n---\n\n");
    const wordCount = combinedBody.replace(/\s/g, "").length;

    // 写新章节
    fs.mkdirSync(chDir, { recursive: true });
    fs.writeFileSync(path.join(chDir, `${newId}.md`), combinedBody, "utf-8");

    // 更新索引：移除旧章节，添加新章节
    idx.chapters = idx.chapters.filter(c => !input.chapterIds.includes(c.id));
    idx.chapters.push({
      id: newId,
      title: input.newTitle,
      order: mergedOrder,
      volume: input.newVolume || null,
      status: "draft",
      wordCount,
      hooks: [],
      created_at: now,
      updated_at: now,
    });

    fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8");

    // 备份被合并的 md 文件
    for (const chId of mergedIds) {
      const oldMd = path.join(chDir, `${chId}.md`);
      if (fs.existsSync(oldMd)) {
        const bakDir = path.join(chDir, "_merged");
        fs.mkdirSync(bakDir, { recursive: true });
        fs.renameSync(oldMd, path.join(bakDir, `${chId}.md`));
      }
    }

    return { content: [{ type: "text", text: JSON.stringify({ ok: true, newChapterId: newId, mergedCount: mergedIds.length }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: e.message }, null, 2) }] };
  }
}

export { name, description, parameters, execute };