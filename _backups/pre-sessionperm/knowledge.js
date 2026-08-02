const name = "novel_knowledge";
import path from "node:path";

const description = "辞海管理：世界规则、术语定义、世界观知识。支持规则冲突检测和跨领域检索。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: [
        "list_all",
        "add_rule", "update_rule", "remove_rule", "list_rules", "check_conflicts",
        "add_term", "list_terms",
        "add_lore", "list_lore",
        "search",
      ],
      description: "操作类型",
    },
    // Rule params
    ruleId: { type: "string", description: "规则 ID" },
    ruleName: { type: "string", description: "规则名称" },
    category: { type: "string", description: "分类" },
    priority: { type: "number", description: "优先级（数字越大越高）" },
    premise: { type: "string", description: "前提条件" },
    effect: { type: "string", description: "效果" },
    cost: { type: "string", description: "代价/消耗" },
    limitation: { type: "string", description: "限制" },
    conflicts: { type: "array", items: { type: "string" }, description: "冲突规则 ID 列表" },
    sourceChapter: { type: "string", description: "来源章节 ID" },
    tags: { type: "array", items: { type: "string" }, description: "标签" },
    // Term params
    termId: { type: "string", description: "术语 ID" },
    term: { type: "string", description: "术语名" },
    definition: { type: "string", description: "定义" },
    aliases: { type: "array", items: { type: "string" }, description: "别名" },
    firstAppearance: { type: "string", description: "首次出现章节" },
    relatedTerms: { type: "array", items: { type: "string" }, description: "关联术语 ID" },
    // Lore params
    loreId: { type: "string", description: "条目 ID" },
    title: { type: "string", description: "标题" },
    content: { type: "string", description: "内容" },
    // Search
    keyword: { type: "string", description: "搜索关键词" },
  },
  required: ["projectId", "action"],
};

async function execute(input) {
  try {
    const { projectId, action } = input;
    const { safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(projectId);
    if (!pid) throw new Error("无效项目 ID");

    const { getDataDir } = await import("../lib/config.js");
    const dataDir = await getDataDir();

    // 确保 knowledge.json 存在
    const { read, write, EMPTY } = await import("../lib/knowledge.js");

    switch (action) {
      case "list_all": {
        const { getAll } = await import("../lib/knowledge.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...getAll(dataDir, projectId) }, null, 2) }] };
      }
      // ── 规则 ──
      case "add_rule": {
        const { addRule } = await import("../lib/knowledge.js");
        const r = addRule(dataDir, projectId, {
          id: input.ruleId, name: input.ruleName, category: input.category, priority: input.priority,
          premise: input.premise, effect: input.effect, cost: input.cost, limitation: input.limitation,
          conflicts: input.conflicts, sourceChapter: input.sourceChapter, tags: input.tags,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "update_rule": {
        const { updateRule } = await import("../lib/knowledge.js");
        const r = updateRule(dataDir, projectId, input.ruleId, {
          name: input.ruleName, category: input.category, priority: input.priority,
          premise: input.premise, effect: input.effect, cost: input.cost, limitation: input.limitation,
          conflicts: input.conflicts, sourceChapter: input.sourceChapter, tags: input.tags,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "remove_rule": {
        const { removeRule } = await import("../lib/knowledge.js");
        const r = removeRule(dataDir, projectId, input.ruleId);
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_rules": {
        const { listRules } = await import("../lib/knowledge.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, rules: listRules(dataDir, projectId) }, null, 2) }] };
      }
      case "check_conflicts": {
        const { checkRuleConflicts } = await import("../lib/knowledge.js");
        const conflicts = checkRuleConflicts(dataDir, projectId);
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, conflictCount: conflicts.length, conflicts }, null, 2) }] };
      }
      // ── 术语 ──
      case "add_term": {
        const { addTerm } = await import("../lib/knowledge.js");
        const r = addTerm(dataDir, projectId, {
          id: input.termId, term: input.term, definition: input.definition, category: input.category,
          aliases: input.aliases, firstAppearance: input.firstAppearance, relatedTerms: input.relatedTerms, tags: input.tags,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_terms": {
        const { listTerms } = await import("../lib/knowledge.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, terms: listTerms(dataDir, projectId) }, null, 2) }] };
      }
      // ── Lore ──
      case "add_lore": {
        const { addLore } = await import("../lib/knowledge.js");
        const r = addLore(dataDir, projectId, {
          id: input.loreId, title: input.title, content: input.content, category: input.category,
          sourceChapter: input.sourceChapter, tags: input.tags,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_lore": {
        const { listLore } = await import("../lib/knowledge.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, lore: listLore(dataDir, projectId) }, null, 2) }] };
      }
      // ── 搜索 ──
      case "search": {
        if (!input.keyword) throw new Error("需要 keyword");
        const { searchKnowledge } = await import("../lib/knowledge.js");
        const r = searchKnowledge(dataDir, projectId, input.keyword);
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...r }, null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: `❌ 未知操作: ${action}` }] };
    }
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };