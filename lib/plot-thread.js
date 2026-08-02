/**
 * plot-thread.js — 伏笔全生命周期管理
 * plot-threads.json: threads[]
 * 状态流：planned → planted → echoed → resolved
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

// 10 种伏笔类型
export const THREAD_TYPES = {
  chekhovs_gun: '契诃夫之枪',
  prophecy: '预言',
  symbol: '象征',
  character_thread: '角色伏线',
  dialogue_hint: '对话暗示',
  mcguffin: '麦格芬',
  foreshadow: '前兆',
  red_herring: '红鲱鱼',
  cliffhanger: '悬念钩',
  mystery: '谜团',
};

// 4 个状态
export const THREAD_STATUS = {
  planned: '计划',
  planted: '埋设',
  echoed: '呼应',
  resolved: '回收',
};

// 状态流转顺序
export const STATUS_FLOW = ['planned', 'planted', 'echoed', 'resolved'];

function getFilePath(dataDir, projectId) {
  return path.join(dataDir, "projects", projectId, "plot-threads.json");
}

function read(dataDir, projectId) {
  const fp = getFilePath(dataDir, projectId);
  if (!fs.existsSync(fp)) return { threads: [] };
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function write(dataDir, projectId, data) {
  const fp = getFilePath(dataDir, projectId);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

export function addThread(dataDir, projectId, { title, type, status, description, plantedChapter, echoedChapters, resolvedChapter }) {
  const data = read(dataDir, projectId);
  const thread = {
    id: genId("pt"),
    title: title || "未命名伏笔",
    type: type || "chekhovs_gun",
    status: status || "planned",
    description: description || "",
    plantedChapter: plantedChapter || null,
    echoedChapters: echoedChapters || [],
    resolvedChapter: resolvedChapter || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.threads.push(thread);
  write(dataDir, projectId, data);
  return { ok: true, thread };
}

export function updateThread(dataDir, projectId, threadId, updates) {
  const data = read(dataDir, projectId);
  const thread = data.threads.find(t => t.id === threadId);
  if (!thread) throw new Error(`伏笔 ${threadId} 不存在`);
  delete updates.id;
  Object.assign(thread, updates);
  thread.updatedAt = new Date().toISOString();
  write(dataDir, projectId, data);
  return { ok: true, thread };
}

export function removeThread(dataDir, projectId, threadId) {
  const data = read(dataDir, projectId);
  data.threads = data.threads.filter(t => t.id !== threadId);
  write(dataDir, projectId, data);
  return { ok: true };
}

export function listThreads(dataDir, projectId) {
  return read(dataDir, projectId).threads;
}

export function advanceStatus(dataDir, projectId, threadId) {
  const data = read(dataDir, projectId);
  const thread = data.threads.find(t => t.id === threadId);
  if (!thread) throw new Error(`伏笔 ${threadId} 不存在`);
  const curIdx = STATUS_FLOW.indexOf(thread.status);
  if (curIdx < 0 || curIdx >= STATUS_FLOW.length - 1) return { ok: true, thread };
  thread.status = STATUS_FLOW[curIdx + 1];
  thread.updatedAt = new Date().toISOString();
  write(dataDir, projectId, data);
  return { ok: true, thread };
}
