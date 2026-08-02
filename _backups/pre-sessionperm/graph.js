const name = "novel_graph";
import path from "node:path";
import fs from "node:fs";

const description = "实体关系图查询。基于人物关系卡自动建图，支持邻居查询、最短路径、全局关系。触发词：人物关系、关系图、谁和谁是什么关系";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: ["sync", "neighbors", "path", "entity", "stats", "rebuild", "sync_plot", "sync_facts"],
      description: "sync(同步卡片到图)/neighbors(查邻居)/path(最短路径)/entity(某人所有关系)/stats(图统计)/rebuild(重建全图)",
    },
    nodeId: { type: "string", description: "实体 ID（neighbors/path/entity 时使用）" },
    targetId: { type: "string", description: "目标实体 ID（path 时使用）" },
    relationType: { type: "string", description: "关系类型过滤（neighbors 时可选）" },
    maxDepth: { type: "number", description: "最大深度（neighbors/path 时可选，默认 neighbors=1, path=5）" },
  },
  required: ["projectId", "action"],
};

async function execute(input) {
  try {
    const projectId = input.projectId;
    const action = input.action;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();

    const { buildAdjacencyGraph, syncCardsToGraph } = await import("../lib/graph-store.js");
    const { getNeighbors, shortestPath, findAllPaths, getEntityRelations, getGraphStats } = await import("../lib/graph-traverse.js");
    const { readJSON } = await import("../lib/store.js");
    const { json, error } = await import("../lib/output.js");

    // ── sync: 从卡片同步到图 ──
    if (action === "sync" || action === "rebuild") {
      const { readJSON } = await import("../lib/store.js");
      const cardTypes = ["characters", "world", "style"];
      const allCards = [];
      for (const t of cardTypes) {
        const cp = path.join(dataDir, "projects", pid, "cards", `${t}.json`);
        const d = await readJSON(cp);
        if (d?.cards) allCards.push(...d.cards);
      }
      const links = await syncCardsToGraph(dataDir, pid, allCards);
      return json({
        ok: true,
        entityLinks: links.length,
        message: `✅ 已从 ${allCards.length} 张卡片中提取 ${links.length} 条关系边`,
        links: links.map(l => ({
          source: l.sourceName, target: l.targetName, relation: l.relation, description: l.description || l.dynamic,
        })),
      });
    }

    // 构建内存图
    const graph = await buildAdjacencyGraph(dataDir, pid);
    if (graph.edges.length === 0) {
      return error("📭 项目中还没有关系数据。请先在人物卡中添加 relationships，然后执行 sync。");
    }

    // ── neighbors: 邻居查询 ──
    if (action === "neighbors") {
      if (!input.nodeId) return error("需要 nodeId");
      const result = getNeighbors(graph, input.nodeId, {
        relationType: input.relationType,
        maxDepth: input.maxDepth || 1,
      });
      if (!result.length) return error("📭 未找到关联实体");
      return json({
        ok: true,
        count: result.length,
        neighbors: result,
        message: `找到 ${result.length} 个关联实体（深度 ${input.maxDepth || 1}）`,
      });
    }

    // ── path: 最短路径 ──
    if (action === "path") {
      if (!input.nodeId || !input.targetId) return error("需要 nodeId 和 targetId");
      const maxDepth = input.maxDepth || 5;
      const result = shortestPath(graph, input.nodeId, input.targetId, maxDepth);
      if (!result) return error(`❌ 在 ${maxDepth} 步内未找到从 ${input.nodeId} 到 ${input.targetId} 的路径`);
      return json({
        ok: true,
        length: result.length - 1,
        path: result,
        message: `路径长度: ${result.length - 1} 步`,
      });
    }

    // ── entity: 某人所有关系 ──
    if (action === "entity") {
      if (!input.nodeId) return error("需要 nodeId");
      const relations = getEntityRelations(graph, input.nodeId);
      if (!relations.length) return error("📭 未找到该实体的关系");
      return json({
        ok: true,
        count: relations.length,
        relations,
        message: `该实体有 ${relations.length} 条关系`,
      });
    }

    // ── stats: 图统计 ──
    if (action === "stats") {
      const stats = getGraphStats(graph);
      // 读章节情节边数
      try {
        const chp = path.join(dataDir, "projects", pid, "graph", "chapter_links.jsonl");
        if (fs.existsSync(chp)) {
          stats.chapterEdges = fs.readFileSync(chp, "utf-8").split("\n").filter(l => l.trim()).length;
        }
      } catch { stats.chapterEdges = 0; }
      return json({ ok: true, ...stats, message: `图统计: ${stats.nodeCount} 节点, ${stats.edgeCount} 条实体边${stats.chapterEdges ? ', ' + stats.chapterEdges + ' 条情节边' : ''}` });
    }

    // ── sync_plot: 从章节同步情节图 ──
    if (action === "sync_plot") {
      const { syncChaptersToGraph } = await import("../lib/chapter-extract.js");
      const links = await syncChaptersToGraph(dataDir, pid);
      return json({
        ok: true,
        plotLinks: links.length,
        message: `✅ 已提取 ${links.length} 条情节关系边`,
        links: links.map(l => ({
          source: l.sourceName, target: l.targetName, relation: l.relation, description: l.description, count: l.count,
        })),
      });
    }

    // ── sync_facts: 从事实同步事实图 ──
    if (action === "sync_facts") {
      const { readJSONL } = await import("../lib/store.js");
      const { syncFactsToGraph } = await import("../lib/graph-store.js");
      const factsPath = path.join(dataDir, "projects", pid, "facts", "facts.jsonl");
      const facts = fs.existsSync(factsPath) ? await readJSONL(factsPath) : [];
      const links = await syncFactsToGraph(dataDir, pid, facts);
      return json({
        ok: true,
        factLinks: links.length,
        factsProcessed: facts.length,
        message: `✅ 已从 ${facts.length} 条事实中提取 ${links.length} 条关系边`,
        links: links.slice(0, 50).map(l => ({
          source: l.sourceName, target: l.targetName, relation: l.relation, description: l.description || l.dynamic,
        })),
      });
    }

    return error("❌ 未知操作");
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };