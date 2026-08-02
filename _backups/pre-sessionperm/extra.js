const name = "novel_extra";
import fs from "node:fs";
import path from "node:path";

const description = "额外工具：章节历史查看/回退、搜索归档事实、章节 diff 对比。";

const parameters = {
  type: "object", properties: {
    action: { type: "string", enum: ["chapter_history", "chapter_revert", "fact_archived", "diff"],
      description: "chapter_history(章节版本历史)/chapter_revert(回退到指定版本)/fact_archived(查看归档事实)/diff(章节修订 diff 对比)" },
    revisionNumber: { type: "number", description: "版本号（chapter_revert 时必填，1=第一个旧版本；diff 时可选，默认最新修订）" },
    projectId: { type: "string", description: "项目 ID" },
    chapterId: { type: "string", description: "章节 ID（chapter_history/chapter_revert/diff 时必填）" },
    type: { type: "string", description: "事实类型过滤（fact_archived 时可选）" },
    limit: { type: "number", description: "返回条数（可选，默认 20）" },
  }, required: ["action", "projectId"],
};

async function execute(input) {
  var truncate = (str, maxLen) => { if (!str) return ''; return str.length <= maxLen ? str : str.substring(0, maxLen) + '…(' + str.length + '字)'; };
  try {
    const { action, projectId } = input;
    const { safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);

    // ── 章节版本历史 ──
    if (action === "chapter_history") {
      if (!input.chapterId) throw new Error("需要 chapterId");
      const chDir = path.join(projDir, "chapters");
      const versions = [];
      const current = path.join(chDir, input.chapterId + ".md");
      if (fs.existsSync(current)) {
        const body = fs.readFileSync(current, "utf-8");
        versions.push({ revision: "current", title: "当前版本", wordCount: body.replace(/\s/g, "").length });
      }
      let rev = 1;
      while (true) {
        const rp = path.join(chDir, input.chapterId + "_rev_" + rev + ".md");
        if (!fs.existsSync(rp)) break;
        const body = fs.readFileSync(rp, "utf-8");
        versions.push({ revision: rev, title: "修订 v" + rev, wordCount: body.replace(/\s/g, "").length });
        rev++;
      }
      if (versions.length <= 1) {
        return { content: [{ type: "text", text: "📭 该章节没有历史版本" }] };
      }
      const lines = [`📜 章节「${input.chapterId}」版本历史`, ""];
      versions.forEach(v => lines.push(`  ${v.revision === "current" ? "▶" : " "} v${v.revision}: ${v.title} (${v.wordCount}字)`));
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    // ── 章节回退 ──
    if (action === "chapter_revert") {
      if (!input.chapterId || !input.revisionNumber) throw new Error("需要 chapterId 和 revisionNumber");
      const chDir = path.join(projDir, "chapters");
      const src = path.join(chDir, input.chapterId + "_rev_" + input.revisionNumber + ".md");
      if (!fs.existsSync(src)) throw new Error("版本 v" + input.revisionNumber + " 不存在");
      const content = fs.readFileSync(src, "utf-8");
      const current = path.join(chDir, input.chapterId + ".md");
      if (fs.existsSync(current)) {
        let nextRev = 1;
        while (fs.existsSync(path.join(chDir, input.chapterId + "_rev_" + nextRev + ".md"))) nextRev++;
        fs.renameSync(current, path.join(chDir, input.chapterId + "_rev_" + nextRev + ".md"));
      }
      fs.writeFileSync(current, content, "utf-8");
      return { content: [{ type: "text", text: `✅ 已回退到 v${input.revisionNumber}` }] };
    }

    // ── 查看归档事实 ──
    if (action === "fact_archived") {
      const factsPath = path.join(projDir, "facts.jsonl");
      const archivePath = path.join(projDir, "facts_archive.jsonl");
      const limit = input.limit || 20;
      let archived = [];
      if (fs.existsSync(factsPath)) {
        const all = fs.readFileSync(factsPath, "utf-8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
        archived = all.filter(f => f.deprecated_at || f.overridden_by);
      }
      if (fs.existsSync(archivePath)) {
        const archivedLines = fs.readFileSync(archivePath, "utf-8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
        archived.push(...archivedLines);
      }
      if (input.type) archived = archived.filter(f => f.type === input.type);
      if (archived.length === 0) {
        return { content: [{ type: "text", text: "📭 暂无归档事实" }] };
      }
      archived = archived.slice(0, limit);
      const lines = [`📦 归档事实 (${archived.length}条)`];
      archived.forEach(f => {
        lines.push(`  [${f.type}] ${f.content}${f.overridden_by ? " (被覆盖)" : ""}${f.deprecated_at ? " (废弃)" : ""}`);
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    // ── 章节 diff 对比 ──
    if (action === "diff") { // 找修订版本
      const revNum = input.revisionNumber || 1;
      const oldMd = path.join(chDir, input.chapterId + "_rev_" + revNum + ".md");
      if (!fs.existsSync(oldMd)) {
        let available = [];
        let r = 1;
        while (fs.existsSync(path.join(chDir, input.chapterId + "_rev_" + r + ".md"))) { available.push(r); r++; }
        return { content: [{ type: "text", text: available.length > 0
          ? "📭 修订 v" + revNum + " 不存在。可用版本：" + available.join(", ") + "（用 revisionNumber 指定）"
          : "📭 该章节没有修订历史记录，无需 diff" }] };
      }
      const oldBody = fs.readFileSync(oldMd, "utf-8");
      const newBody = fs.readFileSync(newMd, "utf-8");
      const oldLines = oldBody.split("
");
      const newLines = newBody.split("
");
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
      out.push("【新代码v2】📖 章节「" + chapterTitle + "」修订对比 (v" + revNum + " → 当前)");
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
      return { content: [{ type: "text", text: out.join("
") }] };
      console.log('[DEBUG] truncate:', typeof truncate, truncate.toString().substring(0, 50));
      if (!input.chapterId) throw new Error("需要 chapterId");
      const chDir = path.join(projDir, "chapters");
      const newMd = path.join(chDir, input.chapterId + ".md");
      if (!fs.existsSync(newMd)) throw new Error(`章节文件不存在：${input.chapterId}.md`);

      // 获取章节标题
      const idxPath = path.join(projDir, "chapters.json");
      let chapterTitle = input.chapterId;
      if (fs.existsSync(idxPath)) {
        const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
        const meta = idx.chapters.find(c => c.id === input.chapterId);
        if (meta) chapterTitle = meta.title;
      }

      // 找修订版本
      const revNum = input.revisionNumber || 1;
      const oldMd = path.join(chDir, input.chapterId + "_rev_" + revNum + ".md");
      if (!fs.existsSync(oldMd)) {
        let available = [];
        let r = 1;
        while (fs.existsSync(path.join(chDir, input.chapterId + "_rev_" + r + ".md"))) { available.push(r); r++; }
        return { content: [{ type: "text", text: available.length > 0
          ? `📭 修订 v${revNum} 不存在。可用版本：${available.join(", ")}（用 revisionNumber 指定）`
          : "📭 该章节没有修订历史记录，无需 diff" }] };
      }

      const oldBody = fs.readFileSync(oldMd, "utf-8");
      const newBody = fs.readFileSync(newMd, "utf-8");

      // 逐行 diff
      const oldLines = oldBody.split("\n");
      const newLines = newBody.split("\n");
      const oldSet = new Set(oldLines);
      const newSet = new Set(newLines);

      const modifications = [];
      const removed = [];
      const added = [];
      for (const line of oldLines) { if (!newSet.has(line)) removed.push(line); }
      for (const line of newLines) { if (!oldSet.has(line)) added.push(line); }

      // 匹配修改（相似度 > 40%）
      const usedR = new Set();
      const usedA = new Set();
      for (let i = 0; i < removed.length; i++) {
        for (let j = 0; j < added.length; j++) {
          if (usedR.has(i) || usedA.has(j)) continue;
          const rA = [...removed[i]], aA = [...added[j]];
          const maxLen = Math.max(rA.length, aA.length);
          if (maxLen === 0 || Math.min(rA.length, aA.length) < 2) continue;
          const overlap = rA.filter((c, k) => c === aA[k]).length;
          if (overlap / maxLen > 0.4) {
            modifications.push({ removed: removed[i], added: added[j], similarity: Math.round(overlap / maxLen * 100) });
            usedR.add(i); usedA.add(j); break;
          }
        }
      }

      const finalRemoved = removed.filter((_, i) => !usedR.has(i));
      const finalAdded = added.filter((_, i) => !usedA.has(i));

      const out = [];
      out.push("【新代码v2】📖 章节「" + chapterTitle + "」修订对比 (v" + revNum + " → 当前)");
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

    return { content: [{ type: "text", text: "❌ 未知操作" }] };
  } catch (e) {
    return { content: [{ type: "text", text: "❌ " + e.message }] };
  }
}

export { name, description, parameters, execute };
