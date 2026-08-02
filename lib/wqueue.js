/**
 * 墨述写入队列 — 串行化文件写入，防止并发写冲突
 *
 * 用法：
 *   import { enqueue } from "../lib/wqueue.js";
 *   await enqueue(async () => { fs.writeFileSync(...); });
 */

let queue = Promise.resolve();

async function enqueue(task) {
  queue = queue.then(task).catch(err => {
    console.error("[wqueue] write failed:", err.message);
    throw err; // 重新抛出，让调用方感知
  });
  return queue;
}

export { enqueue };
