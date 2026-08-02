const name = "novel_structure";
import path from "node:path";

const description = "故事结构管理：大纲树、剧情弧、时间线事件。支持幕/卷/章层级管理。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: [
        "get_all",
        "add_part", "update_part", "remove_part", "list_parts", "move_part",
        "add_arc", "update_arc", "remove_arc", "add_arc_node", "list_arcs",
        "add_timeline", "update_timeline", "remove_timeline", "list_timeline",
      ],
      description: "操作类型",
    },
    // Part params
    partId: { type: "string", description: "节点 ID" },
    title: { type: "string", description: "标题" },
    type: { type: "string", enum: ["part", "volume", "chapter"], description: "节点类型" },
    order: { type: "number", description: "排序" },
    summary: { type: "string", description: "摘要" },
    parentId: { type: "string", description: "父节点 ID" },
    newParentId: { type: "string", description: "新父节点 ID（move_part 用）" },
    // Arc params
    arcId: { type: "string", description: "弧 ID" },
    arcTitle: { type: "string", description: "弧标题" },
    color: { type: "string", description: "弧颜色" },
    arcType: { type: "string", enum: ["character", "plot"], description: "弧类型" },
    characterId: { type: "string", description: "关联角色 ID" },
    chapterId: { type: "string", description: "章节 ID（弧节点用）" },
    nodeLabel: { type: "string", description: "弧节点标签" },
    nodeType: { type: "string", enum: ["core", "branch", "minor"], description: "弧节点类型" },
    // Timeline params
    eventId: { type: "string", description: "时间线事件 ID" },
    eventLabel: { type: "string", description: "事件标签" },
    date: { type: "string", description: "日期" },
    fuzzy: { type: "boolean", description: "是否模糊时间" },
    eventType: { type: "string", enum: ["background", "core", "branch"], description: "事件类型" },
    flashback: { type: "boolean", description: "是否倒叙标记" },
    eventDescription: { type: "string", description: "事件描述" },
    chapters: { type: "array", items: { type: "string" }, description: "关联章节 ID 列表" },
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

    // 确保 structure.json 存在
    const { read, write, EMPTY } = await import("../lib/structure.js");
    const s = read(dataDir, projectId);
    if (!s.version) {
      write(dataDir, projectId, { ...EMPTY });
    }

    switch (action) {
      case "get_all": {
        const { getAll } = await import("../lib/structure.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...getAll(dataDir, projectId) }, null, 2) }] };
      }
      case "add_part": {
        const { addPart } = await import("../lib/structure.js");
        const r = addPart(dataDir, projectId, {
          id: input.partId, title: input.title, type: input.type, order: input.order, summary: input.summary, parentId: input.parentId,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "update_part": {
        const { updatePart } = await import("../lib/structure.js");
        const r = updatePart(dataDir, projectId, input.partId, { title: input.title, type: input.type, order: input.order, summary: input.summary });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "remove_part": {
        const { removePart } = await import("../lib/structure.js");
        const r = removePart(dataDir, projectId, input.partId);
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_parts": {
        const { listParts } = await import("../lib/structure.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, parts: listParts(dataDir, projectId) }, null, 2) }] };
      }
      case "move_part": {
        const { movePart } = await import("../lib/structure.js");
        const r = movePart(dataDir, projectId, input.partId, { newParentId: input.newParentId, newOrder: input.order });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "add_arc": {
        const { addArc } = await import("../lib/structure.js");
        const r = addArc(dataDir, projectId, {
          id: input.arcId, title: input.arcTitle, color: input.color, type: input.arcType, characterId: input.characterId,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "update_arc": {
        const { updateArc } = await import("../lib/structure.js");
        const r = updateArc(dataDir, projectId, input.arcId, { title: input.arcTitle, color: input.color, type: input.arcType, characterId: input.characterId });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "remove_arc": {
        const { removeArc } = await import("../lib/structure.js");
        const r = removeArc(dataDir, projectId, input.arcId);
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "add_arc_node": {
        const { addArcNode } = await import("../lib/structure.js");
        const r = addArcNode(dataDir, projectId, input.arcId, { chapterId: input.chapterId, label: input.nodeLabel, nodeType: input.nodeType, order: input.order });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_arcs": {
        const { listArcs } = await import("../lib/structure.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, arcs: listArcs(dataDir, projectId) }, null, 2) }] };
      }
      case "add_timeline": {
        const { addTimelineEvent } = await import("../lib/structure.js");
        const r = addTimelineEvent(dataDir, projectId, {
          id: input.eventId, label: input.eventLabel, date: input.date, fuzzy: input.fuzzy, eventType: input.eventType, chapters: input.chapters, flashback: input.flashback, description: input.eventDescription,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "update_timeline": {
        const { updateTimelineEvent } = await import("../lib/structure.js");
        const r = updateTimelineEvent(dataDir, projectId, input.eventId, {
          label: input.eventLabel, date: input.date, fuzzy: input.fuzzy, eventType: input.eventType, chapters: input.chapters, flashback: input.flashback, description: input.eventDescription,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "remove_timeline": {
        const { removeTimelineEvent } = await import("../lib/structure.js");
        const r = removeTimelineEvent(dataDir, projectId, input.eventId);
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "list_timeline": {
        const { listTimeline } = await import("../lib/structure.js");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, timeline: listTimeline(dataDir, projectId) }, null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: `❌ 未知操作: ${action}` }] };
    }
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };