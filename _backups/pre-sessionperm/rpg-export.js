const name = "novel_rpg_export";
import fs from "node:fs";
import path from "node:path";

const description = "RPG 场景导出 + 跑团 GM 事件生成。将墨述项目数据（角色/地点/事实/伏笔/关系图）导出为 RPG 场景 JSON，并支持随机生成 GM 事件。";

const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: ["export", "gm_event"],
      description: "export=导出完整 RPG 场景 JSON / gm_event=生成随机 GM 事件",
    },
    outputDir: { type: "string", description: "导出目录（可选）" },
    eventCount: { type: "number", description: "gm_event 生成事件数量（默认 3）" },
  },
  required: ["projectId", "action"],
};

async function execute(input) {
  try {
    const { projectId, action } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);

    // 加载所有数据
    const project = JSON.parse(fs.readFileSync(path.join(projDir, "project.json"), "utf-8"));
    const cards = [];
    for (const t of ["characters", "world", "style"]) {
      const cp = path.join(projDir, "cards", t + ".json");
      if (fs.existsSync(cp)) {
        const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
        if (d.cards) d.cards.forEach(c => { c.type = t; cards.push(c); });
      }
    }
    const facts = [];
    const fp = path.join(projDir, "facts.jsonl");
    if (fs.existsSync(fp)) {
      fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()).forEach(l => {
        try { facts.push(JSON.parse(l)); } catch(e) {}
      });
    }
    const facts_active = facts.filter(f => !f.deprecated_at && !f.overridden_by);

    // 地图标记
    var locations = [];
    const mp = path.join(projDir, "maps.json");
    if (fs.existsSync(mp)) {
      const mapsData = JSON.parse(fs.readFileSync(mp, "utf-8"));
      if (mapsData.maps) {
        mapsData.maps.forEach(m => {
          (m.markers || []).forEach(marker => {
            locations.push({ name: marker.name, x: marker.x, y: marker.y, description: marker.description || "", icon: marker.icon || "📍" });
          });
          // shapes
          (m.shapes || []).forEach(s => {
            locations.push({ name: s.name || s.type, type: s.type, points: s.points, color: s.color });
          });
        });
      }
    }

    // 伏笔
    var plotThreads = [];
    const ptPath = path.join(projDir, "plot-threads.json");
    if (fs.existsSync(ptPath)) {
      plotThreads = JSON.parse(fs.readFileSync(ptPath, "utf-8")).threads || [];
    }

    // 关系
    var relationships = [];
    facts_active.filter(f => f.type === "relationship").forEach(f => {
      const charNames = cards.filter(c => c.type === "characters").map(c => c.name);
      const found = charNames.filter(n => f.content.includes(n));
      if (found.length >= 2) {
        relationships.push({ from: found[0], to: found[1], description: f.content });
      }
    });

    if (action === "export") {
      // 构建 RPG 场景 JSON
      const rpgScene = {
        format: "moshu-rpg-v1",
        title: project.name,
        summary: project.summary || "",
        world: {
          name: project.name,
          type: project.type || "未分类",
          summary: project.summary || "",
        },
        characters: cards.filter(c => c.type === "characters").map(c => {
          const content = c.content || {};
          return {
            name: c.name,
            subtype: c.subtype || "",
            role: c.subtype || "npc",
            stats: {
              str: hashStat(c.name + "str"),
              dex: hashStat(c.name + "dex"),
              int: hashStat(c.name + "int"),
              cha: hashStat(c.name + "cha"),
            },
            traits: content["性格"] || content["性格特征"] || "",
            motivation: content["动机"] || "",
            flaw: content["缺陷"] || "",
            growthArc: content["成长弧"] || "",
            description: content["描述"] || content["背景"] || "",
            aliases: (content["别名"] || "").split(/[、,，]/).filter(Boolean),
          };
        }),
        locations: locations,
        factions: cards.filter(c => c.type === "world" && c.subtype === "faction").map(c => ({
          name: c.name,
          goal: (c.content || {})["目标"] || "",
          resources: (c.content || {})["资源"] || "",
          territory: (c.content || {})["领地"] || "",
        })),
        worldRules: cards.filter(c => c.type === "world" && c.subtype === "rule").map(c => ({
          name: c.name,
          rule: (c.content || {})["规则"] || "",
          limitation: (c.content || {})["限制"] || "",
          cost: (c.content || {})["代价"] || "",
        })),
        timeline: facts_active.filter(f => f.type === "timeline").map(f => ({
          event: f.content, date: f.date || "", timelineId: f.timelineId || "main",
        })),
        plotThreads: plotThreads.map(t => ({
          title: t.title, type: t.type, status: t.status, description: t.description,
          plantedChapter: t.plantedChapter, resolvedChapter: t.resolvedChapter,
        })),
        relationships: relationships,
        events: facts_active.filter(f => f.type === "plot_event").map(f => ({
          event: f.content, tags: f.tags || [],
        })),
        exportTime: new Date().toISOString(),
      };

      const outBase = input.outputDir ? path.resolve(input.outputDir) : path.join(dataDir, "export");
      fs.mkdirSync(outBase, { recursive: true });
      const outFile = path.join(outBase, pid + "-rpg-scene.json");
      fs.writeFileSync(outFile, JSON.stringify(rpgScene, null, 2), "utf-8");

      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        message: `✅ RPG 场景已导出：${rpgScene.characters.length} 角色、${rpgScene.locations.length} 地点、${rpgScene.plotThreads.length} 伏笔、${rpgScene.relationships.length} 关系`,
        file: outFile,
        stats: {
          characters: rpgScene.characters.length,
          locations: rpgScene.locations.length,
          factions: rpgScene.factions.length,
          worldRules: rpgScene.worldRules.length,
          plotThreads: rpgScene.plotThreads.length,
          relationships: rpgScene.relationships.length,
          events: rpgScene.events.length,
        },
      }, null, 2) }] };
    }

    if (action === "gm_event") {
      const count = input.eventCount || 3;
      const events = [];

      // 事件模板池
      const templates = [
        { type: "encounter", weight: 3, gen: function() {
          var c1 = pick(cards.filter(c => c.type === "characters"));
          var c2 = pick(cards.filter(c => c.type === "characters" && c.name !== (c1 ? c1.name : "")));
          var loc = pick(locations.filter(l => l.name));
          return {
            type: "遭遇",
            title: (c1 ? c1.name : "陌生人") + "与" + (c2 ? c2.name : "旅人") + "在" + (loc ? loc.name : "路上") + "相遇",
            description: (c1 ? c1.name : "某人") + "与" + (c2 ? c2.name : "另一人") + "在" + (loc ? loc.name : "某处") + "不期而遇。空气中弥漫着微妙的气氛。",
            characters: [c1 ? c1.name : "", c2 ? c2.name : ""].filter(Boolean),
            location: loc ? loc.name : "未知",
            suggestion: "可触发对话、冲突或合作事件",
          };
        }},
        { type: "discovery", weight: 2, gen: function() {
          var loc = pick(locations.filter(l => l.name));
          var rule = pick(cards.filter(c => c.type === "world" && c.subtype === "rule"));
          return {
            type: "发现",
            title: "在" + (loc ? loc.name : "遗迹") + "发现" + (rule ? rule.name : "未知力量"),
            description: "探索" + (loc ? loc.name : "未知地点") + "时，发现" + (rule ? "了关于「" + rule.name + "」的线索" : "了某种不寻常的痕迹") + "。",
            characters: [],
            location: loc ? loc.name : "未知",
            suggestion: rule ? "可能涉及规则：" + ((rule.content || {})["规则"] || "") : "可展开调查",
          };
        }},
        { type: "plot_trigger", weight: 2, gen: function() {
          var pt = pick(plotThreads.filter(t => t.status === "planned" || t.status === "planted"));
          if (!pt) return null;
          return {
            type: "伏笔触发",
            title: "伏笔「" + pt.title + "」开始浮现",
            description: pt.description || "之前埋下的伏笔开始显现影响。",
            characters: [],
            location: "",
            suggestion: "将伏笔状态推进到「呼应」阶段",
            plotThreadId: pt.id,
          };
        }},
        { type: "tension", weight: 2, gen: function() {
          var rel = pick(relationships);
          if (!rel) return null;
          return {
            type: "关系紧张",
            title: rel.from + "与" + rel.to + "的关系出现裂痕",
            description: rel.description + "——这段关系正面临考验。",
            characters: [rel.from, rel.to],
            location: "",
            suggestion: "可触发冲突或和解剧情",
          };
        }},
        { type: "faction", weight: 1, gen: function() {
          var f = pick(cards.filter(c => c.type === "world" && c.subtype === "faction"));
          if (!f) return null;
          return {
            type: "势力动向",
            title: f.name + "有所行动",
            description: f.name + "正在" + ((f.content || {})["目标"] || "执行某项计划") + "。",
            characters: [],
            location: (f.content || {})["领地"] || "",
            suggestion: "可展开势力博弈剧情",
          };
        }},
      ];

      // 加权随机
      var pool = [];
      templates.forEach(t => { for (var i = 0; i < t.weight; i++) pool.push(t); });

      for (var i = 0; i < count; i++) {
        var tmpl = pick(pool);
        if (!tmpl) continue;
        var evt = tmpl.gen();
        if (evt) events.push(evt);
      }

      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        events: events,
        message: `🎲 生成了 ${events.length} 个 GM 事件`,
      }, null, 2) }] };
    }

    throw new Error("未知 action: " + action);
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashStat(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return 5 + Math.abs(h) % 16; // 5-20 range
}

export { name, description, parameters, execute };
