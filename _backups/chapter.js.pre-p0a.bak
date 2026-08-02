const name = "novel_chapter";
import fs from "node:fs";
import path from "node:path";

const description = "章节管理：写作、修订、列出、查看章节内容。支持多版本保留。";

const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["write", "list", "get", "revise", "rename", "split"],
      description: "操作：write(写新章)/list(列出)/get(查看)/revise(修订)/rename(重命名)/split(拆分)" },
    projectId: { type: "string", description: "项目 ID" },
    chapterId: { type: "string", description: "章节 ID（get/revise/rename/split 时必填）" },
    title: { type: "string", description: "章节标题（write/rename 时必填）" },
    content: { type: "string", description: "章节正文（write/revise 时必填）" },
    order: { type: "number", description: "章节顺序（write 时可选，默认追加到末尾）" },
    volume: { type: "string", description: "所属卷名（write 时可选，用于分卷树结构）" },
    status: { type: "string", enum: ["draft", "revising", "complete"], description: "章节状态（write 时可选，默认 draft）" },
    splitPos: { type: "number", description: "拆分位置（字符偏移，split 时必填）" },
    title1: { type: "string", description: "拆分后第一部分标题（split 时必填）" },
    title2: { type: "string", description: "拆分后第二部分标题（split 时必填）" },
  },
  required: ["action", "projectId"],
};

async function execute(input) {
  try {
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const action = input.action;
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);

    // ── 列出章节 ──
    if (action === "list") {
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) return { content: [{ type: "text", text: "📭 暂无章节" }] };
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      if (!idx.chapters || !idx.chapters.length) return { content: [{ type: "text", text: "📭 暂无章节" }] };
      return { content: [{ type: "text", text: JSON.stringify({
        ok: true, count: idx.chapters.length,
        chapters: idx.chapters.map(c => ({
          id: c.id, title: c.title, order: c.order,
          status: c.status, words: c.wordCount || 0,
          hooks: c.hooks?.length || 0, updated: c.updated_at
        }))
      }, null, 2) }] };
    }

    // ── 查看章节 ──
    if (action === "get") {
      if (!input.chapterId) throw new Error("需要 chapterId");
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const meta = idx.chapters.find(c => c.id === input.chapterId);
      if (!meta) throw new Error(`章节 ${input.chapterId} 不存在`);
      const contentPath = path.join(projDir, "chapters", `${input.chapterId}.md`);
      let body = fs.existsSync(contentPath) ? fs.readFileSync(contentPath, "utf-8") : "";
      // 精简 frontmatter 中的 base64 封面图，避免冗长文本
      body = stripCoverBase64(body);
      return { content: [{ type: "text", text: JSON.stringify({
        ok: true, chapter: { ...meta, body: body.slice(0, 5000) }
      }, null, 2) }] };
    }

    // ── 写新章 ──
    if (action === "write") {
      if (!input.title) throw new Error("需要 title");
      const idxPath = path.join(projDir, "chapters.json");
      const idx = fs.existsSync(idxPath)
        ? JSON.parse(fs.readFileSync(idxPath, "utf-8"))
        : { chapters: [] };

      let chId = input.chapterId;
      if (!chId) {
        // 生成新 ID
        const nextNum = idx.chapters.length + 1;
        chId = `ch_${String(nextNum).padStart(2, "0")}`;
      }

      const now = new Date().toISOString();
      const wordCount = input.content ? input.content.replace(/\s/g, "").length : 0;

      // 更新或新建元数据
      const existing = idx.chapters.findIndex(c => c.id === chId);
      const meta = {
        id: chId,
        title: input.title,
        order: input.order ?? (existing >= 0 ? idx.chapters[existing].order : idx.chapters.length + 1),
        volume: input.volume || null,
        status: input.status || (existing >= 0 ? idx.chapters[existing].status : "draft"),
        wordCount,
        hooks: existing >= 0 ? idx.chapters[existing].hooks || [] : [],
        created_at: existing >= 0 ? idx.chapters[existing].created_at : now,
        updated_at: now,
      };

      if (existing >= 0) {
        idx.chapters[existing] = meta;
      } else {
        idx.chapters.push(meta);
      }
      idx.chapters.sort((a, b) => a.order - b.order);

      // 写内容到 md 文件（write 时内容已经是精简后的，直接写入）
      if (input.content) {
        const chDir = path.join(projDir, "chapters");
        fs.mkdirSync(chDir, { recursive: true });
        fs.writeFileSync(path.join(chDir, `${chId}.md`), input.content, "utf-8");
      }

      // 更新索引（走写入队列）
      const { enqueue } = await import("../lib/wqueue.js");
      await enqueue(async () => { fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8"); });

      // 更新项目统计
      const projPath = path.join(projDir, "project.json");
      if (fs.existsSync(projPath)) {
        const proj = JSON.parse(fs.readFileSync(projPath, "utf-8"));
        proj.chapterCount = idx.chapters.length;
        proj.updated_at = now;
        await enqueue(async () => { fs.writeFileSync(projPath, JSON.stringify(proj, null, 2), "utf-8"); });
      }

      // 自动提取章节情节互动（防抖）
      try {
        const { syncChaptersToGraphDebounced } = await import("../lib/chapter-extract.js");
        await syncChaptersToGraphDebounced(dataDir, pid);
      } catch (syncErr) {
        console.warn("[mo-shu] plot sync failed for chapter:", syncErr.message);
      }

      return { content: [{ type: "text", text: JSON.stringify({
        ok: true, chapter: meta,
        message: `✅ 章节「${meta.title}」${existing >= 0 ? "已更新" : "已创建"}`
      }, null, 2) }] };
    }

    // ── 修订章节 ──
    if (action === "revise") {
      if (!input.chapterId || !input.content) throw new Error("需要 chapterId 和 content");
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const metaIdx = idx.chapters.findIndex(c => c.id === input.chapterId);
      if (metaIdx === -1) throw new Error(`章节 ${input.chapterId} 不存在`);

      const chDir = path.join(projDir, "chapters");
      const now = new Date().toISOString();
      const wordCount = input.content.replace(/\s/g, "").length;

      // 备份当前版本前先提取原始 base64 封面（用于还原）
      const srcMd = path.join(chDir, `${input.chapterId}.md`);
      let originalBase64 = "";
      if (fs.existsSync(srcMd)) {
        const originalContent = fs.readFileSync(srcMd, "utf-8");
        // 提取 cover.image: data:image/...;base64,...
        // 匹配 cover 块中的 image 行：cover:\n  image: data:image/...;base64,...
        const coverBlockMatch = originalContent.match(/cover:\n(\s*)image:\s*(data:image\/\w+;base64,[^\r\n]*)/m);
        // 同时匹配 cover: image: 一行格式
        const coverInlineMatch = originalContent.match(/^\s*cover:\s*image:\s*(data:image\/\w+;base64,[^\r\n]*)/m);
        const coverMatch = coverBlockMatch || coverInlineMatch;
        if (coverMatch) originalBase64 = coverMatch[2] || coverMatch[1];
        // 找下一个可用版本号
        let rev = 1;
        while (fs.existsSync(path.join(chDir, `${input.chapterId}_rev_${rev}.md`))) rev++;
        fs.renameSync(srcMd, path.join(chDir, `${input.chapterId}_rev_${rev}.md`));
      }

      // 还原 base64 封面（如果编辑时被精简过）再写入
      let restoredContent = input.content;
      if (originalBase64 && input.content.includes("[base64-cover-image]")) {
        restoredContent = input.content.replace(/image:\s*\[base64-cover-image\]/, "image: " + originalBase64);
      }
      // 写新版本
      fs.mkdirSync(chDir, { recursive: true });
      fs.writeFileSync(srcMd, restoredContent, "utf-8");

      // 更新元数据
      idx.chapters[metaIdx] = {
        ...idx.chapters[metaIdx],
        wordCount,
        status: "revised",
        updated_at: now,
      };
      const { enqueue: eq } = await import("../lib/wqueue.js");
      await eq(async () => { fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8"); });

      return { content: [{ type: "text", text: JSON.stringify({
        ok: true, chapter: idx.chapters[metaIdx],
        message: `✅ 章节「${idx.chapters[metaIdx].title}」已修订`
      }, null, 2) }] };
    }

    // ── 重命名章节 ──
    if (action === "rename") {
      if (!input.chapterId || !input.title) throw new Error("需要 chapterId 和 title");
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const metaIdx = idx.chapters.findIndex(c => c.id === input.chapterId);
      if (metaIdx === -1) throw new Error(`章节 ${input.chapterId} 不存在`);
      idx.chapters[metaIdx].title = input.title;
      idx.chapters[metaIdx].updated_at = new Date().toISOString();
      const { enqueue: eq2 } = await import("../lib/wqueue.js");
      await eq2(async () => { fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8"); });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, chapter: idx.chapters[metaIdx] }, null, 2) }] };
    }

    // ── 拆分章节 ──
    if (action === "split") {
      if (!input.chapterId || input.splitPos === undefined || !input.title1 || !input.title2) throw new Error("需要 chapterId, splitPos, title1, title2");
      const idxPath = path.join(projDir, "chapters.json");
      if (!fs.existsSync(idxPath)) throw new Error("章节索引不存在");
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
      const metaIdx = idx.chapters.findIndex(c => c.id === input.chapterId);
      if (metaIdx === -1) throw new Error(`章节 ${input.chapterId} 不存在`);
      const chDir = path.join(projDir, "chapters");
      const srcMd = path.join(chDir, `${input.chapterId}.md`);
      if (!fs.existsSync(srcMd)) throw new Error("章节文件不存在");
      const body = fs.readFileSync(srcMd, "utf-8");
      const part1 = body.substring(0, input.splitPos);
      const part2 = body.substring(input.splitPos);
      const now = new Date().toISOString();

      // 生成新 ID
      const nextNum = idx.chapters.length + 1;
      const newId = `ch_${String(nextNum).padStart(2, "0")}`;

      // 更新原章节为 part1
      idx.chapters[metaIdx].title = input.title1;
      idx.chapters[metaIdx].wordCount = part1.replace(/\s/g, "").length;
      idx.chapters[metaIdx].updated_at = now;
      fs.writeFileSync(srcMd, part1, "utf-8");

      // 创建新章节为 part2
      const newMeta = {
        id: newId,
        title: input.title2,
        order: idx.chapters[metaIdx].order + 1,
        volume: idx.chapters[metaIdx].volume || null,
        status: "draft",
        wordCount: part2.replace(/\s/g, "").length,
        hooks: [],
        created_at: now,
        updated_at: now,
      };

      // 调整后面章节的 order
      idx.chapters.forEach(c => {
        if (c.order > idx.chapters[metaIdx].order) c.order++;
      });
      idx.chapters.push(newMeta);
      idx.chapters.sort((a, b) => a.order - b.order);
      const { enqueue: eq3 } = await import("../lib/wqueue.js");
      await eq3(async () => { fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), "utf-8"); });
      fs.writeFileSync(path.join(chDir, `${newId}.md`), part2, "utf-8");

      return { content: [{ type: "text", text: JSON.stringify({ ok: true, chapter1Id: input.chapterId, chapter2Id: newId }, null, 2) }] };
    }

    return { content: [{ type: "text", text: "❌ 未知操作" }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

// ── 封面 base64 精简工具 ──
const COVER_REPLACEMENT = "  image: [base64-cover-image]";

/**
 * stripCoverBase64 - 将 frontmatter 中的 base64 封面图替换为简短标记
 */
function stripCoverBase64(content) {
  if (!content) return content;
  const lines = content.split("\n");
  // 找 frontmatter 结束：第二个 ---
  let fmEnd = 0;
  let dashCount = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].trim() === "---") { dashCount++; }
    if (dashCount === 2) { fmEnd = i + 1; break; }
  }
  // 如果没找到 frontmatter 标记，扫描前 10 行找 image: data:image/
  if (!fmEnd) {
    fmEnd = Math.min(lines.length, 10);
  }
  const fmPart = lines.slice(0, fmEnd).join("\n");
  const bodyPart = lines.slice(fmEnd).join("\n");

  // 在 frontmatter 中查找并替换 base64 行
  const fmLines = fmPart.split("\n");
  let inCoverSection = false;
  const resultLines = fmLines.map(line => {
    // cover 键
    if (/^\s*cover:\s*$/.test(line) || /^\s*cover:$/.test(line)) {
      inCoverSection = true;
      return line;
    }
    // cover 块内的 image: data:image/...
    if (inCoverSection && /^\s*image:\s*data:image\//.test(line)) {
      inCoverSection = false;
      return COVER_REPLACEMENT;
    }
    // cover: image: 同格式
    if (/^\s*cover:\s*image:\s*data:image\//.test(line)) {
      return COVER_REPLACEMENT;
    }
    // cover 块结束
    if (inCoverSection && /^\s*\w/.test(line) && !/^\s*image:/.test(line)) {
      inCoverSection = false;
    }
    return line;
  });

  return resultLines.join("\n") + (bodyPart.length > 0 ? "\n" + bodyPart : "");
}



export { name, description, parameters, execute };
