const name = "novel_fact";
import fs from "node:fs";
import path from "node:path";

const description = "事实库管理：添加、检索、压缩事实。项目的事实（facts）存储在 facts.jsonl 中，支持覆盖和关键词检索。支持 constant(常驻)/priority(优先级)/chapterGate(章槛) 增强字段。";

const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["add", "search", "compact", "stats"],
      description: "操作：add(添加)/search(检索)/compact(压缩)/stats(统计)" },
    projectId: { type: "string", description: "项目 ID" },
    type: { type: "string", enum: ["character_trait","world_lore","plot_event","relationship","timeline","rule","property_state",""],
      description: "事实类型（add/search 时使用）" },
    content: { type: "string", description: "事实内容（add 时必填）" },
    sourceChapter: { type: "string", description: "来源章节 ID（add 时可选）" },
    confidence: { type: "number", description: "置信度 0~1（add 时可选，默认 1.0）" },
    tags: { type: "array", items: { type: "string" }, description: "标签列表（add/search 时可选）" },
    overriddenFactId: { type: "string", description: "要覆盖的旧事实 ID（add + action=add 时可选）" },
    keyword: { type: "string", description: "检索关键词（search 时可选）" },
    tag: { type: "string", description: "标签关键词过滤（search 时可选）" },
    minConfidence: { type: "number", description: "最低置信度（search 时可选）" },
    limit: { type: "number", description: "返回条数上限（search 时可选）" },
    // 增强字段
    constant: { type: "boolean", description: "是否常驻（始终在上下文中，不依赖关键词。add 时可选，默认 false）" },
    priority: { type: "number", description: "优先级（0-100，越大越靠前。add/search 时可选，默认 0）" },
    chapterGate: { type: "string", description: "章槛——仅当前章节序号 >= 此章时才展示（add 时可选）" },
    constantOnly: { type: "boolean", description: "只返回常驻事实（search 时可选）" },
  },
  required: ["action", "projectId"],
};

async function execute(input) {
  try {
    const { action } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();

    const { addFact, searchFacts, compactFacts, stats, FACT_TYPES } = await import("../lib/facts.js");
    const { json, error } = await import("../lib/output.js");

    // ── 添加事实 ──
    if (action === "add") {
      if (!input.content) throw new Error("需要 content");
      const fact = await addFact(dataDir, pid, {
        type: input.type,
        content: input.content,
        sourceChapter: input.sourceChapter,
        confidence: input.confidence,
        tags: input.tags,
        overriddenFactId: input.overriddenFactId,
        constant: input.constant,
        priority: input.priority,
        chapterGate: input.chapterGate,
      });
      return json({ ok: true, fact, message: `✅ 事实已添加（${fact.type}）` });
    }

    // ── 检索事实 ──
    if (action === "search") {
      const facts = await searchFacts(dataDir, pid, {
        keyword: input.keyword,
        type: input.type,
        tag: input.tag,
        minConfidence: input.minConfidence,
        limit: input.limit,
        constantOnly: input.constantOnly,
      });
      if (!facts.length) return error("📭 未找到匹配事实");
      return json({ ok: true, count: facts.length, facts: facts.map(f => ({
        id: f.id, type: f.type, content: f.content.slice(0, 200),
        confidence: f.confidence, tags: f.tags
      })) });
    }

    // ── 压缩 ──
    if (action === "compact") {
      const result = await compactFacts(dataDir, pid);
      return json({ ok: true, ...result });
    }

    // ── 统计 ──
    if (action === "stats") {
      const result = await stats(dataDir, pid);
      return json({ ok: true, ...result });
    }

    return error("❌ 未知操作");
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
