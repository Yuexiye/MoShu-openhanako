/**
 * structure.js — 故事结构管理
 * structure.json: parts(幕/卷/章) + arcs(人物/剧情弧) + timeline(时间线)
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const EMPTY = Object.freeze({ version: 1, parts: [], arcs: [], timeline: [] });

function read(dataDir, projectId) {
  const fp = path.join(dataDir, "projects", projectId, "structure.json");
  if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(EMPTY));
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function write(dataDir, projectId, data) {
  const fp = path.join(dataDir, "projects", projectId, "structure.json");
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

// ── Parts (幕/卷/章 树结构) ──

function addPart(dataDir, projectId, { id, title, type, order, summary, parentId }) {
  const s = read(dataDir, projectId);
  const entry = {
    id: id || genId("p"),
    title: title || "未命名",
    type: type || "volume",
    order: order ?? 999,
    summary: summary || "",
    children: [],
  };
  if (parentId) {
    const parent = findNode(s.parts, parentId);
    if (!parent) throw new Error(`父节点 ${parentId} 不存在`);
    parent.children.push(entry);
  } else {
    s.parts.push(entry);
  }
  write(dataDir, projectId, s);
  return { ok: true, entry };
}

function listParts(dataDir, projectId) {
  const s = read(dataDir, projectId);
  return s.parts;
}

function updatePart(dataDir, projectId, partId, updates) {
  const s = read(dataDir, projectId);
  const node = findNode(s.parts, partId);
  if (!node) throw new Error(`节点 ${partId} 不存在`);
  if (updates.children) delete updates.children; // 不允许直接修改 children
  Object.assign(node, updates);
  write(dataDir, projectId, s);
  return { ok: true, entry: node };
}

function removePart(dataDir, projectId, partId) {
  const s = read(dataDir, projectId);
  s.parts = removeNode(s.parts, partId);
  write(dataDir, projectId, s);
  return { ok: true };
}

function movePart(dataDir, projectId, partId, { newParentId, newOrder }) {
  const s = read(dataDir, projectId);
  // 从原位置摘除
  const node = detachNode(s.parts, partId);
  if (!node) throw new Error(`节点 ${partId} 不存在`);
  if (newOrder != null) node.order = newOrder;
  // 插入新位置
  if (newParentId) {
    const parent = findNode(s.parts, newParentId);
    if (!parent) throw new Error(`父节点 ${newParentId} 不存在`);
    parent.children.push(node);
  } else {
    s.parts.push(node);
  }
  write(dataDir, projectId, s);
  return { ok: true, entry: node };
}

// ── Arcs (人物/剧情弧) ──

function addArc(dataDir, projectId, { id, title, color, type, characterId, nodes }) {
  const s = read(dataDir, projectId);
  const arc = {
    id: id || genId("arc"),
    title: title || "未命名弧",
    color: color || "#d49a6a",
    type: type || "character",
    characterId: characterId || null,
    nodes: nodes || [],
  };
  s.arcs.push(arc);
  write(dataDir, projectId, s);
  return { ok: true, arc };
}

function updateArc(dataDir, projectId, arcId, updates) {
  const s = read(dataDir, projectId);
  const arc = s.arcs.find(a => a.id === arcId);
  if (!arc) throw new Error(`弧 ${arcId} 不存在`);
  Object.assign(arc, updates);
  write(dataDir, projectId, s);
  return { ok: true, arc };
}

function removeArc(dataDir, projectId, arcId) {
  const s = read(dataDir, projectId);
  s.arcs = s.arcs.filter(a => a.id !== arcId);
  write(dataDir, projectId, s);
  return { ok: true };
}

function addArcNode(dataDir, projectId, arcId, { chapterId, label, nodeType, order }) {
  const s = read(dataDir, projectId);
  const arc = s.arcs.find(a => a.id === arcId);
  if (!arc) throw new Error(`弧 ${arcId} 不存在`);
  arc.nodes.push({
    chapterId,
    label: label || "",
    nodeType: nodeType || "branch",
    order: order ?? arc.nodes.length + 1,
  });
  write(dataDir, projectId, s);
  return { ok: true, arc };
}

function listArcs(dataDir, projectId) {
  return read(dataDir, projectId).arcs;
}

// ── Timeline ──

function addTimelineEvent(dataDir, projectId, { id, label, date, fuzzy, eventType, chapters, flashback, description }) {
  const s = read(dataDir, projectId);
  const evt = {
    id: id || genId("t"),
    label: label || "事件",
    date: date || "",
    fuzzy: fuzzy ?? true,
    eventType: eventType || "background",
    chapters: chapters || [],
    flashback: flashback ?? false,
    description: description || "",
  };
  s.timeline.push(evt);
  // 按时间排序
  s.timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  write(dataDir, projectId, s);
  return { ok: true, event: evt };
}

function updateTimelineEvent(dataDir, projectId, eventId, updates) {
  const s = read(dataDir, projectId);
  const idx = s.timeline.findIndex(e => e.id === eventId);
  if (idx === -1) throw new Error(`事件 ${eventId} 不存在`);
  Object.assign(s.timeline[idx], updates);
  s.timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  write(dataDir, projectId, s);
  return { ok: true, event: s.timeline[idx] };
}

function removeTimelineEvent(dataDir, projectId, eventId) {
  const s = read(dataDir, projectId);
  s.timeline = s.timeline.filter(e => e.id !== eventId);
  write(dataDir, projectId, s);
  return { ok: true };
}

function listTimeline(dataDir, projectId) {
  return read(dataDir, projectId).timeline;
}

// ── 全量获取 ──

function getAll(dataDir, projectId) {
  const s = read(dataDir, projectId);
  return {
    parts: s.parts,
    arcs: s.arcs,
    timeline: s.timeline,
  };
}

// ── 工具函数 ──

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes, id) {
  return nodes.filter(n => {
    if (n.id === id) return false;
    if (n.children) n.children = removeNode(n.children, id);
    return true;
  });
}

// 从树中摘除节点（保留其 children）
function detachNode(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      const [node] = nodes.splice(i, 1);
      return node;
    }
    if (nodes[i].children?.length) {
      const found = detachNode(nodes[i].children, id);
      if (found) return found;
    }
  }
  return null;
}

export {
  EMPTY, read, write, getAll,
  addPart, listParts, updatePart, removePart, movePart,
  addArc, updateArc, removeArc, addArcNode, listArcs,
  addTimelineEvent, updateTimelineEvent, removeTimelineEvent, listTimeline,
  findNode, genId,
};