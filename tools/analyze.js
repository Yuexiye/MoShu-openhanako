const name = "novel_analyze";
import fs from "node:fs";
import path from "node:path";

const description = "章节分析工具：一致性校验、悬念钩子检测、去AI味检测、交叉验证、文风分析。分析已写章节的内容质量。";

const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["consistency", "hooks", "ai_style", "cross_validate", "style_analysis", "all"],
      description: "分析类型：consistency(一致性)/hooks(悬念钩子)/ai_style(去AI味)/cross_validate(交叉验证：人物冲突+时间线+伏笔未收)/all(全部)" },
    projectId: { type: "string", description: "项目 ID" },
    chapterId: { type: "string", description: "章节 ID。不填则分析所有章节。" },
  },
  required: ["action", "projectId"],
};

// ── 悬念钩子模式库（13种） ──
const HOOK_PATTERNS = [
  { id: "unanswered_question", name: "未解答的疑问", desc: "留下未回答的问题",
    patterns: [/为什么/i, /到底/i, /难道/i, /究竟/i, /怎么回事/i, /什么原因/i] },
  { id: "unfinished_action", name: "中断的行动", desc: "角色行动被打断",
    patterns: [/还没说完/i, /话音未落/i, /就在这时/i, /突然/i] },
  { id: "revealed_secret", name: "部分揭露的秘密", desc: "透露部分信息但隐藏关键",
    patterns: [/其实/i, /真相是/i, /事实上/i, /但.*不知道/i] },
  { id: "cliffhanger", name: "章末悬念", desc: "章节末尾留下紧急事态",
    patterns: [/门开了/i, /身后传来/i, /枪声/] },
  { id: "foreboding", name: "不祥预感", desc: "暗示将有坏事发生",
    patterns: [/不详的预感/i, /总觉得/i, /好像要出事/i, /不安/] },
  { id: "hidden_identity", name: "隐藏身份", desc: "角色隐瞒真实身份",
    patterns: [/不像是.*的人/i, /身份可疑/i, /另有隐情/i] },
  { id: "countdown", name: "倒计时", desc: "时间紧迫的暗示",
    patterns: [/只剩下.*时间/i, /必须在.*之前/i, /倒计时/i, /来不及了/i] },
  { id: "mysterious_object", name: "神秘物品", desc: "出现意义不明的物件",
    patterns: [/不知名的/i, /来历不明/i, /看不懂的/i, /奇怪的.*东西/i] },
  { id: "unsolved_case", name: "未解的谜团", desc: "案件/谜题未解决",
    patterns: [/未解之谜/i, /仍然是一个谜/i, /没有答案/i, /查不清/i] },
  { id: "broken_relationship", name: "破裂的关系", desc: "角色关系出现裂痕",
    patterns: [/不再信任/i, /怀疑/i, /背叛/i, /隐瞒/i] },
  { id: "price_of_power", name: "力量的代价", desc: "使用能力付出代价",
    patterns: [/代价/i, /副作用/i, /反噬/i, /消耗.*生命/i] },
  { id: "false_safety", name: "虚假的安全", desc: "看似安全实则危险",
    patterns: [/看似安全/i, /暂时安全/i, /松了一口气/i, /应该没事/i] },
  { id: "unreliable_narrator", name: "不可靠的叙述", desc: "叙述者信息不可靠",
    patterns: [/也许是这样/i, /大概是/i, /听人说/i, /据说/i] },
];

// ── AI 风格特征模式 ──
const AI_PATTERNS = [
  { type: "对称排比", patterns: [/既.*又.*既.*又/i, /不仅.*而且.*更/i, /是.*也是.*更是/i] },
  { type: "过渡模板", patterns: [/值得一提的是/i, /值得注意的是/i, /不可忽视的是/i, /需要指出的是/i] },
  { type: "陈词滥调", patterns: [/在这个.*的.*中/i, /对于.*而言/i, /可以说/i, /实际上/i] },
  { type: "冗余修饰", patterns: [/毫无疑问/i, /毋庸置疑/i, /显而易见/i, /不可否认/i] },
  { type: "总结句式", patterns: [/总的来说/i, /综上所述/i, /总而言之/i, /从.*角度来看/i] },
  { type: "极致表述", patterns: [/极致/i, /绝佳/i, /无以伦比/i, /令人叹为观止/i] },
  { type: "万能连接", patterns: [/然而/i, /但是/i, /不过/i, /却/] },
];

async function execute(input) {
  try {
    const { action, projectId, chapterId } = input;const { safeProjectId } = await import("../lib/config.js");const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
  const dataDir = process.env.MO_SHU_DIR
      || path.join(process.env.USERPROFILE || ".", ".hanako", "plugin-data", "dev", "mo-shu");
    const projDir = path.join(dataDir, "projects", pid);

    // 加载卡片和事实（用于一致性校验）
    const cards = [];
    const cardTypes = ["characters", "world", "style"];
    for (const t of cardTypes) {
      const cp = path.join(projDir, "cards", `${t}.json`);
      if (fs.existsSync(cp)) {
        const d = JSON.parse(fs.readFileSync(cp, "utf-8"));
        if (d.cards) cards.push(...d.cards);
      }
    }

    const facts = [];
    const factsPath = path.join(projDir, "facts.jsonl");
    if (fs.existsSync(factsPath)) {
      facts.push(...fs.readFileSync(factsPath, "utf-8")
        .split("\n").filter(l => l.trim()).map(l => JSON.parse(l))
        .filter(f => !f.deprecated_at && !f.overridden_by));
    }

    // 加载章节
    const idxPath = path.join(projDir, "chapters.json");
    if (!fs.existsSync(idxPath)) throw new Error("项目暂无章节");
    const idx = JSON.parse(fs.readFileSync(idxPath, "utf-8"));
    let chapters = idx.chapters || [];

    let targetChapters = chapterId
      ? chapters.filter(c => c.id === chapterId)
      : chapters;
    if (!targetChapters.length) throw new Error("未找到章节");

    const results = [];

    for (const ch of targetChapters) {
      const chp = path.join(projDir, "chapters", `${ch.id}.md`);
      const body = fs.existsSync(chp) ? fs.readFileSync(chp, "utf-8") : "";
      if (!body) continue;

      const report = { chapterId: ch.id, title: ch.title };

      // ── 一致性校验 ──
      if (action === "consistency" || action === "all") {
        const issues = [];
        // 检查卡片中的角色是否在章节正文中出现
        for (const card of cards) {
          if (card.type === 'characters' && card.name) {
            if (!body.includes(card.name)) {
              issues.push({ type: 'unmentioned_character', msg: `角色「${card.name}」在本章未出现`, severity: 'info' });
            }
          }
        }
        report.consistency = { issues: issues.length, issues };
      }

      // ── 交叉验证（跨所有章节） ──
      if (action === "cross_validate" || action === "all") {
        const { crossValidate } = await import("../lib/cross-validate.js");
        const cv = crossValidate(cards, facts, chapters, projDir, fs, path);
        report.crossValidate = cv;
      }

      // ── 悬念钩子检测 ──
      if (action === "hooks" || action === "all") {
        const found = [];
        for (const hook of HOOK_PATTERNS) {
          for (const pat of hook.patterns) {
            if (pat.test(body)) {
              found.push({ id: hook.id, name: hook.name, desc: hook.desc });
              break;
            }
          }
        }
        report.hooks = { count: found.length, items: found };
      }

      // ── 去 AI 味检测 ──
      if (action === "ai_style" || action === "all") {
        const found = [];
        for (const ai of AI_PATTERNS) {
          const matches = [];
          for (const pat of ai.patterns) {
            const m = body.match(pat);
            if (m) matches.push(m[0]);
          }
          if (matches.length > 0) {
            found.push({ type: ai.type, count: matches.length, examples: matches.slice(0, 3) });
          }
        }
        const totalAI = found.reduce((s, f) => s + f.count, 0);
        const totalWords = body.replace(/\s/g, "").length;
        const aiDensity = totalWords > 0 ? (totalAI / totalWords * 1000).toFixed(1) : "0";
        report.aiStyle = { totalHits: totalAI, densityPer1k: aiDensity, items: found };
      }

      // ── 文风分析 ──
      if (action === "style_analysis" || action === "all") {
        report.styleAnalysis = computeStyleFingerprint(body);
      }

      results.push(report);
    }

    return { content: [{ type: "text", text: JSON.stringify({ ok: true, results }, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

// ── 文风指纹计算 ──
function computeStyleFingerprint(text) {
  // 去除 markdown 格式标记
  var clean = text.replace(/#{1,6}\s/g, '').replace(/\*{1,3}/g, '').replace(/_{1,3}/g, '')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '').replace(/!?\[.*?\]\(.*?\)/g, '');

  // ① 分词统计（中文：>=2字 token）
  var cnChars = (clean.match(/[\p{Script=Han}]/gu) || []);
  var cnTokens = new Map();
  for (var len = 2; len <= 4 && len <= cnChars.length; len++) {
    for (var i = 0; i <= cnChars.length - len; i++) {
      var token = cnChars.slice(i, i + len).join('');
      cnTokens.set(token, (cnTokens.get(token) || 0) + 1);
    }
  }
  // 取 Top 10 高频词
  var topWords = [...cnTokens.entries()]
    .filter(function(e) { return e[1] >= 2; })
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(e) { return { word: e[0], count: e[1] }; });

  // ② 句式结构
  var sentences = clean.split(/[。！？；.!?;]/).filter(function(s) { return s.trim().length > 0; });
  var avgLen = 0;
  var shortCount = 0, longCount = 0;
  sentences.forEach(function(s) {
    var len = s.replace(/\s/g, '').length;
    avgLen += len;
    if (len < 20) shortCount++;
    else if (len > 40) longCount++;
  });
  avgLen = sentences.length > 0 ? Math.round(avgLen / sentences.length) : 0;
  var shortRatio = sentences.length > 0 ? (shortCount / sentences.length * 100).toFixed(1) : 0;
  var longRatio = sentences.length > 0 ? (longCount / sentences.length * 100).toFixed(1) : 0;

  // ③ 标点使用比例
  var totalPunct = 0;
  var punctCount = { '，': 0, '。': 0, '！': 0, '？': 0, '……': 0, '—': 0, '、': 0, '；': 0 };
  for (var ch of clean) {
    if (punctCount.hasOwnProperty(ch)) {
      punctCount[ch]++;
      totalPunct++;
    }
  }

  // ④ 修辞密度
  var metaPhrases = clean.match(/\b(像|如|仿佛|犹如|宛若)\b/g);
  var connectorWords = clean.match(/\b(然而|但是|不过|却|虽然|然而|因此|所以|于是|然而|不但|而且|不仅|况且|况且|况且)\b/g);
  var metaDensity = metaPhrases ? metaPhrases.length / Math.max(1, clean.length / 100) : 0;
  var connDensity = connectorWords ? connectorWords.length / Math.max(1, clean.length / 100) : 0;

  // ⑤ 词汇多样性（hapax legomena 比例）
  var uniqueTokens = cnTokens.size;
  var totalTokens = cnTokens.values().reduce(function(s, v) { return s + v; }, 0);
  var typeTokenRatio = totalTokens > 0 ? (uniqueTokens / totalTokens * 100).toFixed(1) : 0;

  return {
    totalWords: cnChars.length,
    sentences: sentences.length,
    avgSentenceLength: avgLen,
    shortSentenceRatio: shortRatio + '%',
    longSentenceRatio: longRatio + '%',
    punctuation: punctCount,
    metaphorDensity: metaDensity.toFixed(2) + '/百字',
    connectorDensity: connDensity.toFixed(2) + '/百字',
    typeTokenRatio: typeTokenRatio + '%',
    topWords: topWords,
    // 简单打分（0-100，越高越"有个人风格"
    styleScore: Math.round(
      (parseFloat(typeTokenRatio) * 0.4) +
      (parseFloat(shortRatio) * 0.2) +
      (parseFloat(longRatio) * 0.2) +
      (Math.min(10, (10 - parseFloat(metaDensity)) * 5) * 0.2)
    )
  };
}

export { name, description, parameters, execute };
