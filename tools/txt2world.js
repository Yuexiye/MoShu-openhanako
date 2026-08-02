const name = "novel_txt2world";
import fs from "node:fs";
import path from "node:path";

const description = "TXT → 世界观导入向导。上传长文本自动分块，为每块生成提取指令（人物/势力/物品/关系），Agent 处理后写入墨述卡片+事实+关系图。支持生成独立世界观 Wiki 页面。";

export const sessionPermission = { kind: "plugin_output" };
const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: ["chunk", "extract", "wiki", "status"],
      description: "chunk=分块并返回提取指令 / extract=写入提取结果到卡片+事实 / wiki=生成Wiki HTML / status=查看导入状态",
    },
    text: { type: "string", description: "action=chunk 时的原始文本（可选，不传则从已保存的文件读取）" },
    chunkIndex: { type: "number", description: "action=extract 时指定处理第几块" },
    extractedData: {
      type: "object",
      description: "action=extract 时的提取结果，格式：{characters:[{name,aliases,gender,description}],world:[{name,type,description}],facts:[{type,content,tags}],relationships:[{from,to,relation}]}",
    },
  },
  required: ["projectId", "action"],
};

const CHUNK_SIZE = 1500;

async function execute(input) {
  try {
    const { projectId, action } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);

    switch (action) {
      case "chunk": {
        const text = input.text || "";
        if (!text || text.length < 10) throw new Error("文本太短（至少 10 字符）");

        // 保存原始文本
        const txtPath = path.join(projDir, "import-source.txt");
        fs.writeFileSync(txtPath, text, "utf-8");

        // 分块（按段落边界）
        const chunks = chunkText(text, CHUNK_SIZE);

        // 保存分块状态
        const statePath = path.join(projDir, "import-state.json");
        fs.writeFileSync(statePath, JSON.stringify({
          totalChunks: chunks.length,
          processed: [],
          createdAt: new Date().toISOString(),
        }, null, 2), "utf-8");

        return { content: [{ type: "text", text: JSON.stringify({
          ok: true,
          message: `已分块为 ${chunks.length} 段。请逐块处理：调用 extract action 并传入 chunkIndex 和提取结果。`,
          totalChunks: chunks.length,
          chunks: chunks.map((c, i) => ({
            index: i,
            preview: c.slice(0, 80) + "...",
            length: c.length,
            extracted: false,
          })),
          extractionGuide: {
            characters: "提取人物：name(名称), aliases(别名数组), gender, description(简述)",
            world: "提取世界观设定：name, type(地理/势力/文化/历史/规则), description",
            facts: "提取事实：type(character_trait/world_lore/plot_event/relationship/timeline), content, tags",
            relationships: "提取关系：from(人物名), to(人物名), relation(关系描述)",
          },
        }, null, 2) }] };
      }

      case "extract": {
        const { chunkIndex, extractedData } = input;
        const txtPath = path.join(projDir, "import-source.txt");
        if (!fs.existsSync(txtPath)) throw new Error("未找到导入文本，请先调用 chunk");

        // 读取原始文本获取当前块
        const text = fs.readFileSync(txtPath, "utf-8");
        const chunks = chunkText(text, CHUNK_SIZE);
        if (chunkIndex < 0 || chunkIndex >= chunks.length) throw new Error(`chunkIndex 超出范围 (0-${chunks.length - 1})`);

        // 写入提取结果到卡片
        let added = { characters: 0, world: 0, facts: 0, relationships: 0 };
        if (extractedData) {
          // 人物卡片
          if (extractedData.characters) {
            for (const c of extractedData.characters) {
              if (!c.name) continue;
              await addCard(projDir, "characters", c.name, {
                姓名: c.name,
                别名: (c.aliases || []).join("、"),
                性别: c.gender || "",
                描述: c.description || "",
              });
              added.characters++;
            }
          }
          // 世界观卡片
          if (extractedData.world) {
            for (const w of extractedData.world) {
              if (!w.name) continue;
              await addCard(projDir, "world", w.name, {
                名称: w.name,
                类别: w.type || "",
                描述: w.description || "",
              });
              added.world++;
            }
          }
          // 事实
          if (extractedData.facts) {
            const factsPath = path.join(projDir, "facts.jsonl");
            for (const f of extractedData.facts) {
              if (!f.content) continue;
              const fact = {
                id: "fact_" + crypto.randomUUID(),
                type: f.type || "world_lore",
                content: f.content,
                source_chapter: null,
                confidence: 0.8,
                tags: f.tags || ["txt2world"],
                created_at: new Date().toISOString(),
                deprecated_at: null,
                overridden_by: null,
              };
              fs.appendFileSync(factsPath, JSON.stringify(fact) + "\n", "utf-8");
              added.facts++;
            }
          }
        }

        // 更新状态
        const statePath = path.join(projDir, "import-state.json");
        if (fs.existsSync(statePath)) {
          const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
          if (!state.processed.includes(chunkIndex)) state.processed.push(chunkIndex);
          fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
        }

        return { content: [{ type: "text", text: JSON.stringify({
          ok: true,
          chunkIndex,
          added,
          message: `第 ${chunkIndex} 块已处理：添加 ${added.characters} 人物、${added.world} 设定、${added.facts} 事实`,
        }, null, 2) }] };
      }

      case "wiki": {
        const wikiHTML = generateWikiHTML(projDir, pid);
        const outBase = path.join(dataDir, "export");
        fs.mkdirSync(outBase, { recursive: true });
        const outFile = path.join(outBase, pid + "-wiki.html");
        fs.writeFileSync(outFile, wikiHTML, "utf-8");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, file: outFile, message: "Wiki 页面已生成" }, null, 2) }] };
      }

      case "status": {
        const statePath = path.join(projDir, "import-state.json");
        if (!fs.existsSync(statePath)) return { content: [{ type: "text", text: JSON.stringify({ ok: true, status: "无导入任务" }) }] };
        const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...state, remaining: state.totalChunks - state.processed.length }) }] };
      }

      default:
        throw new Error("未知 action: " + action);
    }
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

// ── 分块逻辑 ──
function chunkText(text, size) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length > size && current) {
      chunks.push(current);
      current = p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── 写入卡片 ──
async function addCard(projDir, type, name, content) {
  const cardsPath = path.join(projDir, "cards", type + ".json");
  fs.mkdirSync(path.dirname(cardsPath), { recursive: true });
  const data = fs.existsSync(cardsPath) ? JSON.parse(fs.readFileSync(cardsPath, "utf-8")) : { cards: [] };
  // 去重：同名卡片不重复添加
  if (data.cards.some(c => c.name === name)) {
    // 合并：更新已有卡片
    const existing = data.cards.find(c => c.name === name);
    Object.assign(existing.content, content);
  } else {
    data.cards.push({
      id: "card_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name, type, content,
      tags: ["txt2world"],
      created_at: new Date().toISOString(),
    });
  }
  fs.writeFileSync(cardsPath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Wiki HTML 生成 ──
function generateWikiHTML(projDir, pid) {
  // 加载所有数据
  const project = JSON.parse(fs.readFileSync(path.join(projDir, "project.json"), "utf-8"));
  const cards = [];
  for (const t of ["characters", "world", "style"]) {
    const cp = path.join(projDir, "cards", t + ".json");
    if (fs.existsSync(cp)) {
      const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
      if (d.cards) cards.push(...d.cards.map(c => { c.type = t; return c; }));
    }
  }
  const facts = [];
  const fp = path.join(projDir, "facts.jsonl");
  if (fs.existsSync(fp)) {
    fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()).forEach(l => {
      try { facts.push(JSON.parse(l)); } catch(e) {}
    });
  }

  // 构建人物卡片 HTML
  const charCards = cards.filter(c => c.type === "characters");
  const worldCards = cards.filter(c => c.type === "world");
  const activeFacts = facts.filter(f => !f.deprecated_at && !f.overridden_by);

  // 关系提取
  const relationships = activeFacts.filter(f => f.type === "relationship");
  const charNames = charCards.map(c => c.name);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(project.name)} · 世界观 Wiki</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#EDE7DA;--panel:#F5F0E6;--ink:#262320;--sub:#615B54;--muted:#9B958B;--accent:#AA5E43;--border:rgba(38,35,32,0.07)}
body{background:var(--bg);color:var(--ink);font-family:'Noto Sans SC','PingFang SC',sans-serif;line-height:1.8;padding:40px 20px}
.wiki{max-width:800px;margin:0 auto}
.wiki h1{font-family:'Noto Serif SC',serif;font-size:28px;margin-bottom:4px;color:var(--ink)}
.wiki .subtitle{color:var(--muted);font-size:13px;margin-bottom:30px}
.section{margin-bottom:36px}
.section h2{font-family:'Noto Serif SC',serif;font-size:18px;color:var(--sub);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:14px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:8px;transition:border-color .2s}
.card:hover{border-color:var(--accent)}
.card .name{font-weight:600;font-size:15px}
.card .type{font-size:11px;color:var(--muted);margin-left:6px}
.card .fields{margin-top:8px;font-size:13px}
.card .field{display:flex;gap:8px;margin-bottom:3px}
.card .fk{color:var(--sub);min-width:50px;flex-shrink:0}
.card .fv{color:var(--ink)}
.fact{padding:6px 12px;border-left:2px solid var(--accent);margin-bottom:4px;font-size:13px;color:var(--sub)}
.fact .ftype{font-size:10px;color:var(--muted);margin-right:6px}
.rel{display:inline-block;padding:2px 10px;margin:2px;font-size:11px;background:var(--panel);border:1px solid var(--border);border-radius:10px}
</style>
</head>
<body>
<div class="wiki">
<h1>${esc(project.name)}</h1>
<div class="subtitle">世界观 Wiki · ${charCards.length} 角色 · ${worldCards.length} 设定 · ${activeFacts.length} 事实 · 自动生成于 ${new Date().toLocaleDateString('zh-CN')}</div>

${charCards.length ? `<div class="section"><h2>👥 人物 (${charCards.length})</h2>
${charCards.map(c => `<div class="card"><span class="name">${esc(c.name)}</span><span class="type">${c.subtype || ''}</span>
<div class="fields">${Object.entries(c.content || {}).map(([k,v]) => `<div class="field"><span class="fk">${esc(k)}</span><span class="fv">${esc(String(v))}</span></div>`).join("")}</div></div>`).join("")}
</div>` : ""}

${worldCards.length ? `<div class="section"><h2>🌍 世界观 (${worldCards.length})</h2>
${worldCards.map(c => `<div class="card"><span class="name">${esc(c.name)}</span><span class="type">${c.subtype || c.type || ''}</span>
<div class="fields">${Object.entries(c.content || {}).map(([k,v]) => `<div class="field"><span class="fk">${esc(k)}</span><span class="fv">${esc(String(v))}</span></div>`).join("")}</div></div>`).join("")}
</div>` : ""}

${relationships.length ? `<div class="section"><h2>🔗 关系 (${relationships.length})</h2>
${relationships.map(r => `<span class="rel">${esc(r.content)}</span>`).join("")}
</div>` : ""}

${activeFacts.filter(f => f.type !== "relationship").length ? `<div class="section"><h2>📋 设定事实 (${activeFacts.filter(f => f.type !== "relationship").length})</h2>
${activeFacts.filter(f => f.type !== "relationship").map(f => `<div class="fact"><span class="ftype">[${f.type}]</span>${esc(f.content)}</div>`).join("")}
</div>` : ""}

</div>
</body>
</html>`;
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export { name, description, parameters, execute };
