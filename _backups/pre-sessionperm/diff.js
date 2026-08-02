const name = "novel_diff";
import fs from "node:fs";
import path from "node:path";

const description = "章节修订 diff 工具。比对章节新旧版本的差异，生成可读的对比摘要。action=list 列出所有章节的修订版本；action=detect 检测最新修订差异。";

const parameters = {
  type: "object", properties: {
    action: { type: "string", enum: ["detect", "list"],
      description: "detect(检测最新修订差异并返回摘要)/list(列出所有章节的修订版本)" },
    projectId: { type: "string", description: "项目 ID" },
    chapterId: { type: "string", description: "章节 ID（detect 时必填）" },
    revision: { type: "number", description: "修订版本号（detect 时可选，默认1=最近一次修订）" },
  }, required: ["action", "projectId"],
};

async function execute(input) {
  const truncate = (str, maxLen) => { if (!str) return ""; return str.length <= maxLen ? str : str.substring(0, maxLen) + "…(" + str.length + "字)"; };
  try {
    const { safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
    const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);

    if (input.action === "list") {
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const chDir = path.join(projDir, "chapters");
      const result = [];
      for (const ch of idx.chapters) {
        const revs = [];
        let rev = 1;
        while (fs.existsSync(path.join(chDir, ch.id + "_rev_" + rev + ".md"))) { revs.push(rev); rev++; }
        if (revs.length > 0) result.push({ chapterId: ch.id, chapterTitle: ch.title, revisionCount: revs.length, revisions: revs });
      }
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, project: pid, chapters: result }, null, 2) }] };
    }

    if (input.action === "detect") {
      if (!input.chapterId) throw new Error("需要 chapterId");
      const chDir = path.join(projDir, "chapters");
      const newMd = path.join(chDir, input.chapterId + ".md");
      if (!fs.existsSync(newMd)) throw new Error("章节文件不存在：" + input.chapterId + ".md");

      const idxPath = path.join(projDir, "chapters.json");
      let chapterTitle = input.chapterId;
      if (fs.existsSync(idxPath)) {
        const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
        const meta = idx.chapters.find(c => c.id === input.chapterId);
        if (meta) chapterTitle = meta.title;
      }

      const revNum = input.revision || 1;
      const oldMd = path.join(chDir, input.chapterId + "_rev_" + revNum + ".md");
      if (!fs.existsSync(oldMd)) {
        let available = [];
        let r = 1;
        while (fs.existsSync(path.join(chDir, input.chapterId + "_rev_" + r + ".md"))) { available.push(r); r++; }
        return { content: [{ type: "text", text: available.length > 0
          ? "📭 修订 v" + revNum + " 不存在。可用版本：" + available.join(", ")
          : "📭 该章节没有修订历史记录，无需 diff" }] };
      }

      const oldBody = fs.readFileSync(oldMd, "utf-8");
      const newBody = fs.readFileSync(newMd, "utf-8");
      const oldLines = oldBody.split("\n");
      const newLines = newBody.split("\n");
      const oldSet = new Set(oldLines);
      const newSet = new Set(newLines);
      const modifications = [];
      const removed = [];
      const added = [];
      for (const line of oldLines) { if (!newSet.has(line)) removed.push(line); }
      for (const line of newLines) { if (!oldSet.has(line)) added.push(line); }
      const usedR = new Set();
      const usedA = new Set();
      for (let i = 0; i < removed.length; i++) {
        for (let j = 0; j < added.length; j++) {
          if (usedR.has(i) || usedA.has(j)) continue;
          const rA = [...removed[i]], aA = [...added[j]];
          const mLen = Math.max(rA.length, aA.length);
          if (mLen === 0 || Math.min(rA.length, aA.length) < 2) continue;
          const overlap = rA.filter((c, k) => c === aA[k]).length;
          if (overlap / mLen > 0.4) {
            modifications.push({ removed: removed[i], added: added[j], similarity: Math.round(overlap / mLen * 100) });
            usedR.add(i); usedA.add(j); break;
          }
        }
      }
      const finalRemoved = removed.filter((_, i) => !usedR.has(i));
      const finalAdded = added.filter((_, i) => !usedA.has(i));

      const out = [];
      out.push("📖 章节「" + chapterTitle + "」修订对比 (v" + revNum + " → 当前)");
      out.push("  旧版: " + oldBody.replace(/\s/g, "").length + "字 | 新版: " + newBody.replace(/\s/g, "").length + "字");
      out.push("");
      if (modifications.length > 0) {
        out.push("━━ 修改 (" + modifications.length + ")");
        for (const m of modifications) {
          const sim = m.similarity > 80 ? "高度相似" : m.similarity > 50 ? "部分相似" : "低相似";
          out.push("  " + sim + " → " + truncate(m.removed, 100) + " → " + truncate(m.added, 100));
        }
        out.push("");
      }
      if (finalRemoved.length > 0) {
        out.push("━━ 删除 (" + finalRemoved.length + ")");
        for (const r of finalRemoved) { if (r.trim()) out.push("  - " + truncate(r, 100)); }
        out.push("");
      }
      if (finalAdded.length > 0) {
        out.push("━━ 新增 (" + finalAdded.length + ")");
        for (const a of finalAdded) { if (a.trim()) out.push("  + " + truncate(a, 100)); }
        out.push("");
      }
      const total = modifications.length + finalRemoved.length + finalAdded.length;
      if (total === 0) out.push("没有发现差异");
      out.push("━━ 共 " + modifications.length + " 处修改, " + finalRemoved.length + " 处删除, " + finalAdded.length + " 处新增");
      return { content: [{ type: "text", text: out.join("\n") }] };
    }

    return { content: [{ type: "text", text": "❌ 未知操作" }] };
  } catch (e) {
    return { content: [{ type: "text", text": "❌ " + e.message }] };
  }
}

export { name, description, parameters, execute };
