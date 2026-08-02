// graph-traverse.js — 实体图遍历算法
// 基于内存邻接表的 BFS / 最短路径 / 邻居查询

/**
 * 获取某节点的所有邻居（可按类型/关系过滤）
 */
function getNeighbors(graph, nodeId, options = {}) {
  const { relationType, maxDepth = 1 } = options;
  const adjList = graph.adjList;
  const nodeMap = graph.nodeMap;
  const visited = new Set([String(nodeId)]);
  const result = [];

  let frontier = [String(nodeId)];
  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier = [];
    for (const current of frontier) {
      const neighbors = adjList.get(current) || [];
      for (const { nodeId: nid, edge } of neighbors) {
        if (visited.has(nid)) continue;
        if (relationType && edge.relation !== relationType) continue;
        visited.add(nid);
        const node = nodeMap.get(nid);
        result.push({
          id: nid,
          name: node?.name || nid,
          type: node?.type || "unknown",
          depth: depth + 1,
          relation: edge.relation,
          edgeDescription: edge.description || edge.dynamic || "",
        });
        nextFrontier.push(nid);
      }
    }
    frontier = nextFrontier;
  }
  return result;
}

/**
 * BFS 最短路径
 * 返回路径数组 [{ id, name, type, relation }] 或 null
 */
function shortestPath(graph, sourceId, targetId, maxDepth = 5) {
  const adjList = graph.adjList;
  const nodeMap = graph.nodeMap;
  const src = String(sourceId);
  const tgt = String(targetId);

  if (src === tgt) return [{ id: src, name: nodeMap.get(src)?.name, type: nodeMap.get(src)?.type }];

  const visited = new Set([src]);
  const parent = new Map(); // childId → { parentId, edge }
  const queue = [src];

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjList.get(current) || [];

    for (const { nodeId, edge } of neighbors) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      parent.set(nodeId, { parentId: current, edge });

      if (nodeId === tgt) {
        // 回溯路径
        const path = [];
        let step = tgt;
        while (step) {
          const node = nodeMap.get(step);
          const p = parent.get(step);
          path.unshift({
            id: step,
            name: node?.name || step,
            type: node?.type || "unknown",
            relation: p ? p.edge.relation : null,
            edgeDescription: p ? (p.edge.description || p.edge.dynamic || "") : "",
          });
          step = p ? p.parentId : null;
        }
        if (path.length > maxDepth + 1) return null;
        return path;
      }

      queue.push(nodeId);
    }
  }
  return null;
}

/**
 * 查找两个实体之间的所有路径（最多 maxPaths 条）
 */
function findAllPaths(graph, sourceId, targetId, maxDepth = 5, maxPaths = 5) {
  const adjList = graph.adjList;
  const nodeMap = graph.nodeMap;
  const src = String(sourceId);
  const tgt = String(targetId);
  const paths = [];

  function dfs(current, visited, path) {
    if (paths.length >= maxPaths) return;
    if (path.length > maxDepth) return;

    if (current === tgt) {
      paths.push([...path]);
      return;
    }

    const neighbors = adjList.get(current) || [];
    for (const { nodeId, edge } of neighbors) {
      if (visited.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      visited.add(nodeId);
      path.push({ id: nodeId, name: node?.name, type: node?.type, relation: edge.relation, edgeDescription: edge.description || edge.dynamic || "" });
      dfs(nodeId, visited, path);
      path.pop();
      visited.delete(nodeId);
    }
  }

  const startNode = nodeMap.get(src);
  dfs(src, new Set([src]), [{ id: src, name: startNode?.name, type: startNode?.type }]);
  return paths;
}

/**
 * 获取实体参与的所有关系边
 */
function getEntityRelations(graph, nodeId) {
  const adjList = graph.adjList;
  const nodeMap = graph.nodeMap;
  const id = String(nodeId);
  const neighbors = adjList.get(id) || [];

  return neighbors.map(({ nodeId: nid, edge }) => {
    const node = nodeMap.get(nid);
    return {
      id: edge.id,
      targetId: nid,
      targetName: node?.name || nid,
      targetType: node?.type || "unknown",
      relation: edge.relation,
      description: edge.description,
      dynamic: edge.dynamic,
    };
  });
}

/**
 * 获取图的统计信息
 */
function getGraphStats(graph) {
  return {
    nodeCount: graph.nodeMap.size,
    edgeCount: graph.edges.length,
    nodeTypes: [...new Set([...graph.nodeMap.values()].map(n => n.type))],
    nodes: [...graph.nodeMap.values()].map(n => ({ id: n.id, name: n.name, type: n.type })).slice(0, 50),
  };
}

export { getNeighbors, shortestPath, findAllPaths, getEntityRelations, getGraphStats };