const name = "novel_map_links";
import fs from "node:fs";
import path from "node:path";

const description = "解析章节内容中的 {{map/地点名}} 语法，生成地点链接列表。写入章节时自动关联地图标记。";

const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    content: { type: "string", description: "章节正文" },
    chapterId: { type: "string", description: "章节 ID（可选，提供后会自动更新标记关联）" },
  }, required: ["projectId", "content"],
};

async function execute(input) {
  try {
    const { projectId, content, chapterId } = input;const { safeProjectId } = await import("../lib/config.js");const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const mapPath = path.join(dataDir, "projects", projectId, "map.json");

    // 解析 {{map/xxx}} 语法
    const refs = [];
    const regex = /\{\{map\/([^}]+)\}\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      refs.push(match[1].trim());
    }

    if (refs.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, refs: [], message: "未发现地图引用" }, null, 2) }] };
    }

    // 去重
    const uniqueRefs = [...new Set(refs)];

    // 查找匹配的标记
    const mapData = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf-8")) : { markers: [] };
    const matched = [];
    const unmatched = [];

    for (const ref of uniqueRefs) {
      const marker = mapData.markers.find(m =>
        m.name === ref || m.name.includes(ref) || ref.includes(m.name)
      );
      if (marker) {
        matched.push({ ref, markerId: marker.id, markerName: marker.name });
        // 如果提供了 chapterId，自动关联
        if (chapterId && !marker.linkedChapters.includes(chapterId)) {
          marker.linkedChapters.push(chapterId);
        }
      } else {
        unmatched.push(ref);
      }
    }

    // 保存更新后的关联
    if (chapterId && matched.length > 0) {
      fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2), "utf-8");
    }

    return { content: [{ type: "text", text: JSON.stringify({
      ok: true,
      refsFound: uniqueRefs.length,
      matched: matched.length,
      unmatched: unmatched.length,
      locations: matched,
      suggestions: unmatched.map(r => `「${r}」未匹配到地图标记，试试 novel_map create 先创建`),
    }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };
