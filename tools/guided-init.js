const name = "novel_guided_init";
import fs from "node:fs";
import path from "node:path";

const description = "🎯 新手引导 — 三步完成项目创建：1.输入名称 2.填写类型和世界观 3.开始写作。首次使用墨述时推荐先试试这个。";

const parameters = {
  type: "object",
  properties: {
    name: { type: "string", description: "项目名称" },
    type: { type: "string", description: "小说类型，如 赛博朋克/奇幻/悬疑/都市（可选，默认 未分类）" },
    summary: { type: "string", description: "世界观一句话概括（可选）" },
    skipCards: { type: "boolean", description: "是否跳过卡片引导（可选，默认 false）" },
  },
  required: ["name"],
};

async function execute(input) {
  try {
    const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const { enqueue } = await import("../lib/wqueue.js");

    // 安全校验：防止 path traversal
    const safeId = input.name.replace(/[^a-z0-9\u4e00-\u9fff]/gi, "-").toLowerCase().slice(0, 32) || "proj";
    const projDir = path.resolve(dataDir, "projects", safeId);
    if (!projDir.startsWith(path.resolve(dataDir, "projects"))) {
      throw new Error("非法项目名称");
    }

    // 检查是否已存在
    if (fs.existsSync(projDir)) {
      throw new Error(`项目「${input.name}」已存在。试试 novel_open_project id=${safeId}`);
    }

    // 创建项目（通过写入队列）
    await enqueue(async () => {
      const now = new Date().toISOString();
      const proj = { id: safeId, name: input.name, type: input.type || "未分类", summary: input.summary || "", created_at: now, updated_at: now, cardCount: 0, chapterCount: 0 };

      fs.mkdirSync(path.join(projDir, "chapters"), { recursive: true });
      fs.mkdirSync(path.join(projDir, "cards"), { recursive: true });

      fs.writeFileSync(path.join(projDir, "project.json"), JSON.stringify(proj, null, 2), "utf-8");
      fs.writeFileSync(path.join(projDir, "volumes.json"), JSON.stringify({ volumes: [{ id: "v1", title: "第一卷", order: 1, summary: "", chapters: [] }] }), "utf-8");
      fs.writeFileSync(path.join(projDir, "chapters.json"), JSON.stringify({ chapters: [] }), "utf-8");
      fs.writeFileSync(path.join(projDir, "cards", "characters.json"), JSON.stringify({ cards: [] }), "utf-8");
      fs.writeFileSync(path.join(projDir, "cards", "world.json"), JSON.stringify({ cards: [] }), "utf-8");
      fs.writeFileSync(path.join(projDir, "cards", "style.json"), JSON.stringify({ cards: [] }), "utf-8");
      fs.writeFileSync(path.join(projDir, "facts.jsonl"), "", "utf-8");
    });

    // 生成引导消息
    const steps = [
      `✅ 项目「${input.name}」已创建（ID: ${safeId}）`,
      "",
      "📋 下一步建议：",
    ];

    if (!input.skipCards) {
      steps.push("1️⃣  添加人物卡 →  novel_update_card projectId=" + safeId + " type=characters name=角色名 content={\"年龄\":25,\"职业\":\"...\"}");
      steps.push("2️⃣  添加世界观卡 →  novel_update_card projectId=" + safeId + " type=world name=世界名 content={\"背景\":\"...\"}");
    }
    steps.push("3️⃣  写第一章 →  novel_chapter action=write projectId=" + safeId + " title=第一章 content=...");
    steps.push("4️⃣  查看上下文 →  novel_get_context projectId=" + safeId);
    steps.push("");
    steps.push("📤 完成后导出：");
    steps.push("  · 档案终端 → novel_export_immersive projectId=" + safeId);
    steps.push("  · 项目看板  → novel_export_dashboard projectId=" + safeId);
    steps.push("  · 互动阅读  → novel_export_storygame projectId=" + safeId);

    return {
      content: [{ type: "text", text: steps.join("\n") }],
    };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };
