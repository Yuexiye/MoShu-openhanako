const name = "novel_export_storygame";
import fs from "node:fs";
import path from "node:path";

const description = "互动文游导出。将章节导出为线性 JSON 剧本 + HTML 播放器，支持章节导航、阅读进度、主题切换。支持 mode: 'game' 导出分支互动文游——素材包供 AI 生成 JSON，或提供 gameJson 直接打包 HTML。";

const parameters = {
  type: "object", properties: {
    projectId: { type: "string", description: "项目 ID" },
    outputDir: { type: "string", description: "输出目录（可选）" },
    title: { type: "string", description: "游戏标题（可选）" },
    theme: { type: "string", enum: ["terminal", "paper", "dark"], description: "主题（可选，默认 terminal），仅线性模式" },
    mode: { type: "string", enum: ["linear", "game", "twine", "moyu"], description: "导出模式：linear=线性翻页阅读器 / game=互动文游（分支剧情）/ twine=SugarCube 互动小说 / moyu=Moyu 场景脚本。默认 linear" },
    gameJson: { type: "string", description: "互动文游 JSON 剧本（mode=game 时使用，提供后直接打包 HTML）" },
  }, required: ["projectId"],
};

async function execute(input) {
  try {
    const { projectId, theme = "terminal", title, mode = "linear", gameJson } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);
    const projPath = path.join(projDir, "project.json");
    if (!fs.existsSync(projPath)) throw new Error("项目不存在");
    const project = JSON.parse(fs.readFileSync(projPath, "utf-8"));

    // ── 读取章节 ──
    const idxPath = path.join(projDir, "chapters.json");
    if (!fs.existsSync(idxPath)) throw new Error("项目暂无章节");
    const chapters = JSON.parse(fs.readFileSync(idxPath, "utf-8")).chapters || [];
    if (!chapters.length) throw new Error("项目暂无章节");

    const chWithBody = [];
    for (const ch of chapters.sort((a, b) => a.order - b.order)) {
      const cp = path.join(projDir, "chapters", `${ch.id}.md`);
      const body = fs.existsSync(cp) ? fs.readFileSync(cp, "utf-8") : "";
      chWithBody.push({ id: ch.id, order: ch.order, title: ch.title, text: body, volume: ch.volume || "", wordCount: ch.wordCount || 0 });
    }

    const gameTitle = title || project.name;
    const outBase = safeOutputDir(input.outputDir);
    const outDir = path.join(outBase, projectId);

    // ── MODE: twine (SugarCube) ──
    if (mode === "twine") {
      const gameTitle = title || project.name;
      const outBase = safeOutputDir(input.outputDir);
      const outDir = path.join(outBase, projectId);
      fs.mkdirSync(outDir, { recursive: true });

      // 读取角色卡片
      const cardsPath = path.join(projDir, "cards.json");
      const cards = fs.existsSync(cardsPath) ? JSON.parse(fs.readFileSync(cardsPath, "utf-8")).cards || [] : [];
      const charCards = cards.filter(c => c.type === "characters");
      const charMap = {};
      charCards.forEach(c => { charMap[c.name] = c.content; });

      // 构建 passage 列表
      const passages = [];
      // StoryInit: 初始化变量
      const initVars = charCards.map(c => `\t<<set $"${c.name}" to 0>>`).join("\n");
      passages.push({
        name: "StoryInit",
        content: `<<set $chapterOrder to [${chWithBody.map(c => `"${c.id}"`).join(", ")}]>>\n<<set $currentChapterIdx to 0>>\n${initVars}\n<<set $history to []>>`
      });
      // StoryTitle
      passages.push({ name: "StoryTitle", content: gameTitle });
      // StoryInterface (空，用默认样式)
      passages.push({ name: "StoryInterface", content: "" });
      // StorySettings
      passages.push({ name: "StorySettings", content: "<<nobr>>" });

      // 为每个章节生成 passage
      chWithBody.forEach((ch, idx) => {
        const passageId = `ch_${ch.id}`;
        const lines = [];
        // 章节标题
        lines.push(`== ${escHtml(ch.title)} ==`);
        lines.push("");
        // 处理章节正文：按行解析，识别角色对话
        const rawLines = ch.text.split("\n").filter(l => l.trim());
        rawLines.forEach(line => {
          // 匹配角色对话：[角色名] 对话内容 或 角色名：对话内容
          const charMatch = line.match(/^\[([^\]]+)\]\s*(.+)$/);
          const colonMatch = line.match(/^([^：:]+)[：:]\s*(.+)$/);
          if (charMatch) {
            const charName = charMatch[1];
            const dialogue = charMatch[2];
            lines.push(`<<set $speaker to "${escHtml(charName)}">>`);
            lines.push(`「${escHtml(dialogue)}」`);
            lines.push("");
          } else if (colonMatch) {
            const charName = colonMatch[1];
            const dialogue = colonMatch[2];
            lines.push(`<<set $speaker to "${escHtml(charName)}">>`);
            lines.push(`「${escHtml(dialogue)}」`);
            lines.push("");
          } else {
            // 旁白/描述
            lines.push(escHtml(line));
            lines.push("");
          }
        });
        // 章节末尾导航
        if (idx < chWithBody.length - 1) {
          const nextCh = chWithBody[idx + 1];
          lines.push("");
          lines.push(`[[下一章：${escHtml(nextCh.title)}|${passageId}_next]]`);
        } else {
          lines.push("");
          lines.push(`[[回到开头|${passageId}_start]]`);
        }
        // 目录页
        const tocLinks = chWithBody.map((c, i) => {
          const pId = `ch_${c.id}`;
          return `[[${escHtml(c.title)}|${pId}]]`;
        }).join("  \n  ");
        lines.push("");
        lines.push(`---`);
        lines.push("");
        lines.push(`<<link "📑 目录">><<goto "toc">><</link>>`);

        passages.push({ name: passageId, content: lines.join("\n") });

        // 下一章 passage（复用内容 + 导航）
        const nextLines = [];
        nextLines.push(`== ${escHtml(ch.title)} ==`);
        nextLines.push("");
        rawLines.forEach(line => {
          const charMatch = line.match(/^\[([^\]]+)\]\s*(.+)$/);
          const colonMatch = line.match(/^([^：:]+)[：:]\s*(.+)$/);
          if (charMatch) {
            nextLines.push(`<<set $speaker to "${escHtml(charMatch[1])}">>`);
            nextLines.push(`「${escHtml(charMatch[2])}」`);
            nextLines.push("");
          } else if (colonMatch) {
            nextLines.push(`<<set $speaker to "${escHtml(colonMatch[1])}">>`);
            nextLines.push(`「${escHtml(colonMatch[2])}」`);
            nextLines.push("");
          } else {
            nextLines.push(escHtml(line));
            nextLines.push("");
          }
        });
        if (idx < chWithBody.length - 1) {
          const nextCh = chWithBody[idx + 1];
          const nextPId = `ch_${nextCh.id}`;
          nextLines.push("");
          nextLines.push(`[[下一章：${escHtml(nextCh.title)}|${nextPId}]]`);
        } else {
          nextLines.push("");
          nextLines.push(`[[回到开头|${passageId}_start]]`);
        }
        nextLines.push("");
        nextLines.push(`---`);
        nextLines.push("");
        nextLines.push(`<<link "📑 目录">><<goto "toc">><</link>>`);
        passages.push({ name: `${passageId}_next`, content: nextLines.join("\n") });
      });

      // 目录 passage
      const tocLines = ["== 目录 ==", ""];
      chWithBody.forEach((ch, idx) => {
        const pId = `ch_${ch.id}`;
        tocLines.push(`${idx + 1}. [[${escHtml(ch.title)}|${pId}]]`);
      });
      tocLines.push("");
      tocLines.push(`<<link "← 返回">><<back>><</link>>`);
      passages.push({ name: "toc", content: tocLines.join("\n") });

      // 生成完整的 SugarCube HTML
      const html = buildTwineHtml(gameTitle, passages);
      const outFile = path.join(outDir, gameTitle + "·互动小说.html");
      fs.writeFileSync(outFile, html, "utf-8");

      return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: `✅ 已导出 SugarCube 互动小说（${chWithBody.length} 章）`, file: outFile, stats: { mode: "twine", chapters: chWithBody.length, passages: passages.length, characters: charCards.length, totalWords: chWithBody.reduce((s, c) => s + (c.wordCount || 0), 0) } }, null, 2) }] };
    }

    // ── MODE: game ──
    if (mode === "game") {
      // 如果提供了 gameJson，直接打包 HTML
      if (gameJson) {
        fs.mkdirSync(outDir, { recursive: true });
        const { fileURLToPath } = await import("node:url");
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const playerTemplate = path.join(__dirname, "..", "assets", "game-player.html");
        if (!fs.existsSync(playerTemplate)) throw new Error("游戏播放器文件缺失");

        let html = fs.readFileSync(playerTemplate, "utf-8");
        // 找到 </head> 前插入 embed data
        const embed = [
          '<script id="embedded-game-data" type="application/json">',
          gameJson,
          '</script>',
          '<script>',
          '(async function(){',
          '  var el=document.getElementById("embedded-game-data");',
          '  if(el&&el.textContent.trim()){',
          '    try{',
          '      var gameData=JSON.parse(el.textContent);',
          '      loadStory(gameData,{animate:true,cache:false});',
          '      setTimeout(async function(){try{await cacheStory(gameData)}catch(e){}},500);',
          '    }catch(e){console.warn("embedded game load fail:",e)}',
          '  }',
          '})();',
          '</script>',
          '</body>'
        ].join('\n');
        html = html.replace('</body>', embed);

        const outFile = path.join(outDir, gameTitle + "·互动文游.html");
        fs.writeFileSync(outFile, html, "utf-8");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: "✅ 互动文游已打包", file: outFile, stats: { mode: "game", gameJsonSize: gameJson.length } }, null, 2) }] };
      }

      // 没有 gameJson → 收集剧本素材包，返回给 AI 用于生成 JSON
      const cardsPath = path.join(projDir, "cards.json");
      const cards = fs.existsSync(cardsPath) ? JSON.parse(fs.readFileSync(cardsPath, "utf-8")).cards || [] : [];
      const factsPath = path.join(projDir, "facts.jsonl");
      const facts = [];
      if (fs.existsSync(factsPath)) {
        const lines = fs.readFileSync(factsPath, "utf-8").split("\n").filter(Boolean);
        lines.forEach(l => { try { facts.push(JSON.parse(l)); } catch(e) {} });
      }
      const markersPath = path.join(projDir, "markers.json");
      const markers = fs.existsSync(markersPath) ? JSON.parse(fs.readFileSync(markersPath, "utf-8")).markers || [] : [];

      const gamePack = {
        meta: {
          projectId,
          title: gameTitle,
          type: project.type || "未分类",
          summary: project.summary || "",
          totalChapters: chWithBody.length,
          totalWords: chWithBody.reduce((s, c) => s + (c.wordCount || 0), 0),
          timestamp: new Date().toISOString(),
        },
        chapters: chWithBody,
        characters: cards.filter(c => c.type === "characters").map(c => ({ name: c.name, content: c.content, tags: c.tags })),
        worldCards: cards.filter(c => c.type === "world").map(c => ({ name: c.name, content: c.content })),
        styleCards: cards.filter(c => c.type === "style").map(c => ({ name: c.name, content: c.content })),
        facts: facts.map(f => ({ type: f.type, content: f.content, confidence: f.confidence, tags: f.tags })),
        markers: markers.map(m => ({ name: m.name, description: m.description, color: m.color, icon: m.icon })),
        _instruction: `以上是项目「${gameTitle}」的完整剧本素材包。请使用 Story-to-Game 技能，将这些素材改编为分支互动文游 JSON。完成后将 JSON 内容返回给我，我将用它打包 HTML 游戏文件。`,
      };

      // 也写一份到项目目录方便复用
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, gameTitle + "·素材包.json"), JSON.stringify(gamePack, null, 2), "utf-8");

      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, message: "📦 剧本素材包已生成，请用 Story-to-Game 技能改编为互动文游 JSON。完成后告诉我 JSON 内容以打包 HTML。", file: path.join(outDir, gameTitle + "·素材包.json"), stats: { mode: "game", chapters: chWithBody.length, characters: cards.filter(c => c.type === "characters").length, worldCards: cards.filter(c => c.type === "world").length, facts: facts.length, markers: markers.length, totalWords: chWithBody.reduce((s, c) => s + (c.wordCount || 0), 0) } }, null, 2) }],
      };
    }

    // ── MODE: moyu ── 场景脚本适配器
    if (mode === "moyu") {
      // 加载卡片和事实
      const cardsPath = path.join(projDir, "cards");
      var charList = [];
      for (const t of ["characters", "world", "style"]) {
        var cp2 = path.join(cardsPath, t + ".json");
        if (fs.existsSync(cp2)) {
          var cd = JSON.parse(fs.readFileSync(cp2, "utf-8"));
          if (cd.cards) charList = charList.concat(cd.cards.map(function(c) { c.type = t; return c; }));
        }
      }
      var charNames = charList.filter(c => c.type === "characters").map(c => c.name);

      // 将章节转换为场景脚本
      var scenes = [];
      chWithBody.forEach(function(ch, idx) {
        var body = (ch.text || "").replace(/^---[\s\S]*?---\s*/g, "");
        // 按段落分割为对话/旁白
        var lines = body.split(/\n+/).filter(function(l) { return l.trim(); });
        var dialogues = [];
        var narration = "";
        lines.forEach(function(line) {
          // 匹配对话格式：角色名：“文本” 或 角色名：文本
          var dm = line.match(/^[：:】](.+?)[：:]\s*(.+)/);
          if (dm) {
            var speaker = dm[1].trim();
            // 模糊匹配角色名
            var matched = charNames.find(function(n) { return speaker.includes(n) || n.includes(speaker); });
            dialogues.push({
              speaker: matched || speaker,
              text: dm[2].trim().replace(/[“”"]/g, ""),
              narration: false
            });
          } else if (line.match(/^[#【]/)) {
            // 场景描述行
            narration += line.replace(/^[#【】]/g, "").trim() + "\n";
          } else {
            // 旁白/描述
            dialogues.push({ speaker: "", text: line.trim(), narration: true });
          }
        });

        // 检测出场人物
        var presentChars = charNames.filter(function(n) { return body.includes(n); });

        scenes.push({
          id: "scene_" + String(idx + 1).padStart(3, "0"),
          chapterId: ch.id,
          title: ch.title,
          background: narration.trim().slice(0, 200) || ch.title,
          location: ch.volume || "",
          characters: presentChars.map(function(n, i) {
            return { name: n, position: i < 2 ? (i === 0 ? "left" : "right") : "center", expression: "normal" };
          }),
          dialogues: dialogues,
          choices: idx < chWithBody.length - 1 ? [{ text: "继续", nextScene: "scene_" + String(idx + 2).padStart(3, "0") }] : []
        });
      });

      var moyuScript = {
        format: "moyu-scene-v1",
        title: gameTitle,
        projectId: pid,
        summary: project.summary || "",
        totalScenes: scenes.length,
        characters: charList.filter(c => c.type === "characters").map(c => ({
          name: c.name, aliases: c.content ? (c.content["别名"] || "").split(/[、,，]/).filter(Boolean) : [], description: c.content ? c.content["描述"] || c.content["性格"] || "" : ""
        })),
        scenes: scenes,
        _note: "Moyu 场景脚本 v1 骨架格式。当 Moyu 核心文档可用后，可调整字段映射。"
      };

      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, gameTitle + "·Moyu场景.json");
      fs.writeFileSync(outFile, JSON.stringify(moyuScript, null, 2), "utf-8");

      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        message: `✅ 已导出 Moyu 场景脚本（${scenes.length} 场景，${moyuScript.characters.length} 角色）`,
        file: outFile,
        format: "moyu-scene-v1",
        stats: { scenes: scenes.length, characters: moyuScript.characters.length, dialogues: scenes.reduce((s,sc) => s + sc.dialogues.length, 0) }
      }, null, 2) }] };
    }

    // ── MODE: linear ── (原有逻辑)
    // 预处理章节正文：把图片路径转为 base64 data URL
    const processedNodes = chWithBody.map(ch => {
      var body = (ch.text || '').replace(/^---[\s\S]*?---\s*/g, '');
      body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, src) {
        if (src.startsWith('data:')) return match;
        try {
          var imgPath = path.join(projDir, 'chapters', src);
          if (fs.existsSync(imgPath)) {
            var data = fs.readFileSync(imgPath);
            var ext = src.split('.').pop().toLowerCase();
            var mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext] || 'image/png';
            return '![' + alt + '](data:' + mime + ';base64,' + data.toString('base64') + ')';
          }
        } catch(e) {}
        return match;
      });
      return { id: ch.id, order: ch.order, title: ch.title, text: body, wordCount: ch.wordCount || 0 };
    });
    const nodes = processedNodes;
    const totalWords = nodes.reduce((s, n) => s + n.wordCount, 0);
    const jsonData = { title: gameTitle, projectId, chapters: nodes, totalWords };

    fs.mkdirSync(outDir, { recursive: true });

    const themes = {
      terminal: { bg: "#0a0e17", text: "#c8d6e5", accent: "#4a9eff", card: "#0f1a2e", border: "#1a3a5c", headerBg: "#0a0e17", font: "'Courier New', monospace", fontNorm: "'Courier New', monospace" },
      paper: { bg: "#faf6f0", text: "#3a3028", accent: "#b85a3a", card: "#fffcf7", border: "#e0d8d0", headerBg: "#f5ede4", font: "'Georgia', serif", fontNorm: "'Georgia', serif" },
      dark: { bg: "#1a1a2e", text: "#e0e0e0", accent: "#d49a6a", card: "#16213e", border: "#2a2a4a", headerBg: "#1a1a2e", font: "system-ui, sans-serif", fontNorm: "system-ui, sans-serif" },
    };
    const t = themes[theme] || themes.terminal;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(gameTitle)} · 互动阅读</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${t.bg};color:${t.text};font-family:${t.fontNorm};font-size:15px;line-height:1.9;min-height:100vh}
.container{max-width:720px;margin:0 auto;padding:24px 20px 100px}
.header{background:${t.headerBg};border-bottom:1px solid ${t.border};padding:16px 20px;position:sticky;top:0;z-index:10}
.header-inner{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:12px}
.header-title{font-size:16px;font-weight:600;color:${t.accent};font-family:${t.font}}
.header-nav{display:flex;gap:4px;margin-left:auto}
.nav-btn{background:${t.card};border:1px solid ${t.border};color:${t.text};padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-family:${t.fontNorm};transition:all .15s}
.nav-btn:hover{background:${t.accent};color:#fff;border-color:${t.accent}}
.nav-btn:disabled{opacity:.3;cursor:not-allowed}
.chapter{margin:24px 0 0}
.chapter-num{font-size:11px;color:${t.accent};letter-spacing:2px;margin-bottom:6px;font-family:${t.font}}
.chapter-title{font-size:20px;font-weight:700;margin-bottom:16px;color:${t.accent};font-family:${t.font}}
.chapter-body{white-space:pre-wrap;font-size:15px;line-height:2;color:${t.text}}
.progress-wrap{position:fixed;bottom:0;left:0;right:0;background:${t.headerBg};border-top:1px solid ${t.border};padding:10px 20px;z-index:10}
.progress-inner{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:12px}
.progress-bar{flex:1;height:3px;background:${t.border};border-radius:2px;overflow:hidden}
.progress-fill{height:100%;background:${t.accent};transition:width .3s;border-radius:2px}
.progress-text{font-size:11px;color:${t.text};opacity:.6;white-space:nowrap;font-family:${t.font}}
.theme-btn{background:none;border:1px solid ${t.border};color:${t.text};padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-family:${t.font}}
.chapter-enter{animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div class="header-title">📖 ${esc(gameTitle)}</div>
    <div class="header-nav">
      <button class="nav-btn" id="prevBtn" disabled>← 上一章</button>
      <button class="nav-btn" id="nextBtn">下一章 →</button>
    </div>
  </div>
</div>

<div class="container" id="chapterContainer"></div>

<div class="progress-wrap">
  <div class="progress-inner">
    <span class="progress-text" id="progressLabel">0 / ${nodes.length}</span>
    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
    <button class="theme-btn" id="themeBtn">🎨</button>
  </div>
</div>

<script>
const STORY = ${JSON.stringify(jsonData)};
let currentIdx = 0;
const container = document.getElementById('chapterContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressLabel = document.getElementById('progressLabel');
const progressFill = document.getElementById('progressFill');
const themeBtn = document.getElementById('themeBtn');
const themes = ${JSON.stringify(themes)};
let currentTheme = '${theme}';

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function renderBody(text){
  if(!text)return'';
  var h=esc(text);
  h=h.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g,function(m,alt,src){
    return '<img src="'+src+'" alt="'+alt+'" style="max-width:100%;height:auto;border-radius:4px;margin:8px 0;display:block">';
  });
  h=h.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g,'<em>$1</em>')
    .replace(/^### (.+)$/gm,'<h4 style="margin:12px 0 6px">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 style="margin:16px 0 8px">$1</h3>')
    .replace(/^# (.+)$/gm,'<h2 style="margin:20px 0 10px">$1</h2>')
    .replace(/\\n\\n/g,'</p><p>')
    .replace(/\\n/g,'<br>');
  return '<p>'+h+'</p>';
}
function renderChapter(idx) {
  const ch = STORY.chapters[idx];
  if (!ch) return;
  container.innerHTML = '<div class="chapter chapter-enter">'
    + '<div class="chapter-num">第 ' + (idx + 1) + ' 章</div>'
    + '<div class="chapter-title">' + esc(ch.title) + '</div>'
    + '<div class="chapter-body">' + renderBody(ch.text) + '</div>'
    + '</div>';
  currentIdx = idx;
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx >= STORY.chapters.length - 1;
  progressLabel.textContent = (idx + 1) + ' / ' + STORY.chapters.length;
  progressFill.style.width = ((idx + 1) / STORY.chapters.length * 100) + '%';
}

function switchTheme(name) {
  const t = themes[name];
  if (!t) return;
  currentTheme = name;
  document.body.style.background = t.bg;
  document.body.style.color = t.text;
  document.body.style.fontFamily = t.fontNorm;
  container.style.color = t.text;
  themeBtn.style.border = '1px solid ' + t.border;
  themeBtn.style.color = t.text;
}

prevBtn.addEventListener('click', function(){if(currentIdx>0)renderChapter(currentIdx-1)});
nextBtn.addEventListener('click', function(){if(currentIdx<STORY.chapters.length-1)renderChapter(currentIdx+1)});
document.addEventListener('keydown', function(e){
  if(e.key==='ArrowLeft'&&currentIdx>0)renderChapter(currentIdx-1);
  if(e.key==='ArrowRight'&&currentIdx<STORY.chapters.length-1)renderChapter(currentIdx+1);
});

const themeList = Object.keys(themes);
let themeIdx = 0;
themeBtn.addEventListener('click', function(){
  themeIdx = (themeIdx + 1) % themeList.length;
  switchTheme(themeList[themeIdx]);
});

renderChapter(0);
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
</script>
</body>
</html>`;

    const outFile = path.join(outDir, "story.html");
    fs.writeFileSync(outFile, html, "utf-8");

    return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: "✅ 已导出互动阅读", file: outFile, stats: { chapters: nodes.length, words: totalWords } }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }


function escHtml(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function buildTwineHtml(title, passages) {
  // 将 passage 内容编码为 JS 对象，用自带轻量播放器渲染（不依赖 SugarCube CDN）
  const passageData = {};
  passages.forEach(p => {
    passageData[p.name] = p.content || "";
  });
  const passageJson = JSON.stringify(passageData);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
:root { --bg: #1a1a2e; --text: #e0e0e0; --accent: #d49a6a; --link: #7eb8da; --link-hover: #a8d4f0; --panel: #16213e; --border: #2a2a4a; }
*{margin:0;padding:0;box-sizing:border-box}
body { background: var(--bg); color: var(--text); font-family: "Songti SC","Noto Serif SC",Georgia,serif; line-height: 1.9; min-height:100vh; }
#story { max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; }
#story h1 { font-size: 24px; color: var(--accent); margin-bottom: 20px; font-weight: 700; }
#story h2 { font-size: 20px; color: var(--accent); margin: 20px 0 12px; }
#story p { margin-bottom: 12px; }
#story a { color: var(--link); text-decoration: none; cursor:pointer; }
#story a:hover { color: var(--link-hover); text-decoration: underline; }
#story .choices { margin: 24px 0; }
#story .choices a { display: inline-block; margin: 4px 8px 4px 0; padding: 8px 18px; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; transition: all .15s; }
#story .choices a:hover { background: var(--accent); color: var(--bg); border-color: var(--accent); }
#story hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
#story .meta { font-size: 11px; color: var(--border); margin-bottom: 16px; letter-spacing:1px; }
.nav { position:fixed; bottom:0; left:0; right:0; background:var(--panel); border-top:1px solid var(--border); padding:10px 24px; z-index:10; }
.nav-inner { max-width:720px; margin:0 auto; display:flex; align-items:center; gap:12px; }
.nav a { font-size:12px; padding:4px 12px; border:1px solid var(--border); border-radius:4px; cursor:pointer; }
.nav a:hover { background:var(--accent); color:var(--bg); }
.fade-in { animation: fadeIn .3s ease; }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
</style>
</head>
<body>
<div id="story"></div>
<div class="nav"><div class="nav-inner"><span id="nav-info" style="font-size:11px;color:var(--border)"></span><span style="flex:1"></span><a id="nav-prev" style="opacity:.3">← 上一章</a><a id="nav-next">下一章 →</a></div></div>
<script>
var PASSAGES = ${passageJson};
var passageNames = Object.keys(PASSAGES).filter(function(n){ return n.indexOf('Story')!==0; });
var currentIdx = 0;
var storyEl = document.getElementById('story');
var navInfo = document.getElementById('nav-info');
var navPrev = document.getElementById('nav-prev');
var navNext = document.getElementById('nav-next');

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderPassage(idx){
  if(idx<0||idx>=passageNames.length) return;
  currentIdx = idx;
  var name = passageNames[idx];
  var raw = PASSAGES[name] || '';
  // 渲染 passage 内容
  // 先清理 SugarCube 宏（在转义前处理，直接匹配原始语法）
  var cleaned = raw
    .replace(/<<set [^>]*?>>/g, '')
    .replace(/<<link "([^"]+?)">><<goto "([^"]+?)">>/g, function(m,txt,target){
      return '[['+txt+'|'+target+']]';
    })
    .replace(/<<link '([^']+?)'>><<goto '([^']+?)'>>/g, function(m,txt,target){
      return '[['+txt+'|'+target+']]';
    })
    .replace(/<<back>>/g, '[[← 返回]]')
    .replace(/<<[^>]+?>>/g, '')
    .replace(/^== (.+?) ==$/gm, '## $1');
  var html = esc(cleaned);
  // SugarCube 链接语法 [[文本->目标]] 和 [[文本|目标]]
  html = html.replace(/\\[\\[([^\\]]+)->([^\\]]+)\\]\\]/g, function(m,txt,target){
    var tIdx = passageNames.indexOf(target);
    if(tIdx<0) return '<a>'+esc(txt)+'</a>';
    return '<a onclick="renderPassage('+tIdx+')">'+esc(txt)+'</a>';
  });
  html = html.replace(/\\[\\[([^\\]|]+)\\|([^\\]]+)\\]\\]/g, function(m,txt,target){
    var tIdx = passageNames.indexOf(target);
    if(tIdx<0) return '<a>'+esc(txt)+'</a>';
    return '<a onclick="renderPassage('+tIdx+')">'+esc(txt)+'</a>';
  });
  // 简单链接 [[目标]]
  html = html.replace(/\\[\\[([^\\]]+)\\]\\]/g, function(m,target){
    var tIdx = passageNames.indexOf(target);
    if(tIdx<0) return '<a>'+esc(target)+'</a>';
    return '<a onclick="renderPassage('+tIdx+')">'+esc(target)+'</a>';
  });
  // Markdown 粗体斜体
  html = html.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>').replace(/\\*(.+?)\\*/g,'<em>$1</em>');
  // 分段
  html = html.replace(/\\n\\n/g,'</p><p>').replace(/\\n/g,'<br>');
  html = '<div class="fade-in"><div class="meta">第 '+(idx+1)+' 章 / '+passageNames.length+'</div><h1>'+esc(name)+'</h1><p>'+html+'</p></div>';
  storyEl.innerHTML = html;
  // 导航
  navInfo.textContent = (idx+1)+' / '+passageNames.length;
  navPrev.style.opacity = idx>0 ? '1' : '.3';
  navPrev.style.pointerEvents = idx>0 ? '' : 'none';
  navNext.style.opacity = idx<passageNames.length-1 ? '1' : '.3';
  navNext.style.pointerEvents = idx<passageNames.length-1 ? '' : 'none';
  window.scrollTo(0,0);
}

navPrev.onclick = function(){ if(currentIdx>0) renderPassage(currentIdx-1); };
navNext.onclick = function(){ if(currentIdx<passageNames.length-1) renderPassage(currentIdx+1); };
document.addEventListener('keydown', function(e){
  if(e.key==='ArrowLeft'&&currentIdx>0) renderPassage(currentIdx-1);
  if(e.key==='ArrowRight'&&currentIdx<passageNames.length-1) renderPassage(currentIdx+1);
});

// 启动：跳到第一个非 Story passage
if(passageNames.length>0) renderPassage(0);
</script>
</body>
</html>`;
}

function safeOutputDir(dir) {
  // 导出统一写到插件数据目录的 export 文件夹
  var dataDir = process.env.MO_SHU_DIR || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "mo-shu");
  if (!dir) return path.join(dataDir, "export");
  if (dir.includes("..")) throw new Error("outputDir 不能包含 ..");
  if (path.isAbsolute(dir)) throw new Error("outputDir 请使用相对路径");
  return path.join(dataDir, dir);
}

export { name, description, parameters, execute };