/**
 * 交叉验证引擎 — 四维一致性检查
 * 供 tools/analyze.js 和 routes/page.js 共用
 */
export function crossValidate(cards, facts, chapters, projDir, fs, path) {
  var result = { characterConflicts: [], timelineGaps: [], unrecoveredChekhovs: [], settingConflicts: [] };

  // ① 人物设定冲突
  var charCards = cards.filter(function(c) { return c.type === 'characters'; });
  var allBodies = {};
  chapters.forEach(function(ch) {
    var chp = path.join(projDir, 'chapters', ch.id + '.md');
    if (fs.existsSync(chp)) allBodies[ch.id] = fs.readFileSync(chp, 'utf-8');
  });
  var fullText = Object.values(allBodies).join('\n');

  charCards.forEach(function(card) {
    if (!card.content) return;
    var traits = card.content;
    for (var key in traits) {
      var val = traits[key];
      if (typeof val !== 'string' || val.length < 3) continue;
      var negations = [
        new RegExp('不.*' + escapeRegex(val), 'i'),
        new RegExp('没.*' + escapeRegex(val), 'i'),
        new RegExp('与.*' + escapeRegex(val) + '.*不符', 'i')
      ];
      negations.forEach(function(pat) {
        if (pat.test(fullText)) {
          result.characterConflicts.push({
            character: card.name,
            trait: key,
            expected: val,
            found: '与设定矛盾/否定表述',
            severity: 'high'
          });
        }
      });
    }
  });

  // ② 时间线断层
  var timelineFacts = facts.filter(function(f) { return f.type === 'timeline'; });
  timelineFacts.sort(function(a, b) {
    var da = a.content ? (a.content.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/) || [''])[0] : '';
    var db = b.content ? (b.content.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/) || [''])[0] : '';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  for (var i = 1; i < timelineFacts.length; i++) {
    var prev = timelineFacts[i - 1].content;
    var curr = timelineFacts[i].content;
    var dm = prev.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
    var cm = curr.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
    if (dm && cm) {
      var dy = parseInt(dm[0].slice(0, 4));
      var cy = parseInt(cm[0].slice(0, 4));
      if (cy - dy > 1) {
        result.timelineGaps.push({
          from: timelineFacts[i - 1].content,
          to: curr,
          gap: (cy - dy) + ' 年',
          severity: 'medium'
        });
      }
    }
  }

  // ③ 伏笔未回收
  var plotFacts = facts.filter(function(f) { return f.type === 'plot_event'; });
  plotFacts.forEach(function(f) {
    var chId = f.sourceChapter;
    if (!chId) return;
    var chIdx = chapters.findIndex(function(c) { return c.id === chId; });
    if (chIdx < 0) return;
    var laterText = chapters.slice(chIdx + 1).map(function(c) { return allBodies[c.id] || ''; }).join('\n');
    if (f.content && !laterText.includes(f.content.slice(0, 10))) {
      result.unrecoveredChekhovs.push({
        event: f.content,
        chapter: chId,
        severity: 'medium'
      });
    }
  });

  // ④ 世界观设定冲突
  var worldCards = cards.filter(function(c) { return c.type === 'world'; });
  worldCards.forEach(function(card) {
    if (!card.content) return;
    for (var key in card.content) {
      var val = card.content[key];
      if (typeof val !== 'string' || val.length < 3) continue;
      worldCards.forEach(function(other) {
        if (other.id === card.id) return;
        if (!other.content) return;
        for (var oKey in other.content) {
          var oVal = other.content[oKey];
          if (typeof oVal === 'string' && oVal.length > 2) {
            if (val.toLowerCase().includes(oVal.toLowerCase()) && val !== oVal) {
              result.settingConflicts.push({
                card1: card.name,
                card2: other.name,
                field: key,
                val1: val,
                val2: oVal,
                severity: 'high'
              });
            }
          }
        }
      });
    }
  });

  // ⑤ 信息泄露检测
  result.infoLeakage = detectInfoLeakage(charCards, facts, chapters, allBodies, path);

  // ⑥ 道具/状态追踪 — 检查已消耗物品未回收
  result.propertyStateGaps = detectPropertyStateGaps(facts, chapters, allBodies);

  result.totalIssues = result.characterConflicts.length + result.timelineGaps.length + result.unrecoveredChekhovs.length + result.settingConflicts.length + result.infoLeakage.length + result.propertyStateGaps.length;
  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 信息泄露检测 — 简化版
 * 基于 facts 和角色出场，检查角色是否说出了不该知道的信息
 */
function detectInfoLeakage(charCards, facts, chapters, allBodies, path) {
  var result = [];
  if (!charCards.length) return result;

  // ① 构建角色名字典
  var charMap = {};
  charCards.forEach(function(c) { charMap[c.name] = c; });

  // ② 从 facts 中提取角色相关的事实情报
  //    character_trait 和 relationship 类型的 facts 携带了角色的已知信息
  var charFacts = facts.filter(function(f) {
    return (f.type === 'character_trait' || f.type === 'relationship')
      && f.content && f.content.length > 3;
  });

  // ③ 关联 facts 到角色（通过 sourceChapter → 章节正文匹配角色 → 角色知道该章节内容）
  //    简化：fact 中提到角色名，则该 fact 归为该角色所知
  var charKnowledge = {};
  charCards.forEach(function(c) { charKnowledge[c.name] = { facts: [], chapters: [] }; });

  charFacts.forEach(function(f) {
    var content = (f.content || '').toLowerCase();
    charCards.forEach(function(c) {
      if (content.includes((c.name || '').toLowerCase())) {
        charKnowledge[c.name].facts.push(f);
      }
    });
  });

  // ④ 从章节正文中提取每个角色的出场章节和已知信息
  chapters.forEach(function(ch) {
    var body = allBodies[ch.id] || '';
    if (!body) return;
    charCards.forEach(function(c) {
      if (body.includes(c.name)) {
        charKnowledge[c.name].chapters.push(ch.id);
      }
    });
  });

  // ⑤ 构建每个角色的"已知关键词集合"
  function extractKeywords(text) {
    var cn = (text || '').match(/[\p{Script=Han}]/gu) || [];
    var tokens = new Set();
    for (var len = 2; len <= 4 && len <= cn.length; len++) {
      for (var i = 0; i <= cn.length - len; i++) {
        tokens.add(cn.slice(i, i + len).join(''));
      }
    }
    return tokens;
  }

  var charKeywords = {};
  charCards.forEach(function(c) {
    var kws = new Set();
    // 角色的 facts 内容
    charKnowledge[c.name].facts.forEach(function(f) {
      var tokens = extractKeywords(f.content);
      tokens.forEach(function(t) { kws.add(t); });
    });
    // 角色出场章节中提到的名词/事件（简化：该章节所有 >=3 的 token）
    charKnowledge[c.name].chapters.forEach(function(chId) {
      var body = allBodies[chId] || '';
      var tokens = extractKeywords(body);
      tokens.forEach(function(t) { kws.add(t); });
    });
    charKeywords[c.name] = kws;
  });

  // ⑥ 按章节顺序扫描对话，检查是否有角色说出了不属于自己知识的对话
  //    对话格式：[角色名]对话 或 角色名：对话
  var stopWords = new Set(['说道', '说道:', '回答', '问道', '问', '叹道', '笑道', '道', '说', '说:', '低声道', '冷声道', '淡淡道', '缓缓道', '喃喃道', '哽咽道', '冷笑', '冷笑:', '苦笑', '苦笑:', '笑道:', '怒道', '怒道:', '惊讶', '惊讶:', '沉默', '沉默:', '沉默', '沉默']);

  chapters.forEach(function(ch) {
    var body = allBodies[ch.id] || '';
    if (!body) return;

    // 匹配对话：[角色名]xxx 或 角色名：xxx
    var dialogRegex = /\[([^\]]+)\]|([^：]+)[:：](.+?)(?:\n|$)/g;
    var m;
    while ((m = dialogRegex.exec(body)) !== null) {
      var speaker = m[1] || m[2] || '';
      var speech = (m[3] || m[2] || '').trim();
      if (!speaker || !speech || speech.length < 3) continue;

      // 说话人是否是已知角色
      if (!charMap[speaker]) continue;

      // 检查对话中是否包含不该知道的关键信息
      var speechTokens = extractKeywords(speech);
      var otherSpeakers = charCards.filter(function(c) { return c.name !== speaker; });

      otherSpeakers.forEach(function(other) {
        // 检查对话内容是否涉及其他角色的秘密（不在说话人知识集合中的 token）
        var unknownTokens = [];
        speechTokens.forEach(function(t) {
          if (!charKeywords[speaker].has(t) && charKeywords[other.name] && charKeywords[other.name].has(t) && t.length >= 3) {
            unknownTokens.push(t);
          }
        });

        // 如果找到了说话人不该知道的 >=3 字 token，且该 token 在其他角色的知识中
        if (unknownTokens.length >= 2) {
          var foundSecret = unknownTokens[0].slice(0, 10);
          result.push({
            character: speaker,
            chapter: ch.id,
            chapterTitle: ch.title,
            speech: speech.slice(0, 50) + (speech.length > 50 ? '...' : ''),
            leakedInfo: foundSecret,
            severity: 'medium'
          });
        }
      });
    }
  });

  return result;
}

/**
 * 道具/状态追踪 — 检测已消耗/损坏物品未回收
 * 使用 property_state 类型的事实追踪物品状态变更
 */
function detectPropertyStateGaps(facts, chapters, allBodies) {
  var result = [];

  // ① 筛选 property_state facts，按时间排序
  var psFacts = facts.filter(function(f) { return f.type === 'property_state'; });
  if (psFacts.length === 0) return result;

  // ② 解析每个 property_state fact，提取物品名和状态
  //    content 格式："物品名 - 状态描述" 或 "物品名: 状态"
  //    或结构化：{item, status, note} JSON
  var stateHistory = []; // [{itemName, status, sourceChapter, timestamp, note}]

  psFacts.forEach(function(f) {
    var content = f.content || '';
    var item = '';
    var status = '';
    var note = '';

    // 尝试 JSON 解析
    try {
      var parsed = JSON.parse(content);
      item = parsed.item || parsed.name || '';
      status = parsed.status || parsed.state || '';
      note = parsed.note || parsed.desc || parsed.description || '';
    } catch(e) {
      // 尝试 "物品名 - 状态" 格式
      var m = content.match(/^([^\s-]{2,})\s*[-–—]\s*(.*)/);
      if (m) {
        item = m[1].trim();
        status = m[2].trim();
      } else {
        // 尝试 "物品名: 状态"
        var m2 = content.match(/^([^:：]{2,})\s*[:：]\s*(.*)/);
        if (m2) {
          item = m2[1].trim();
          status = m2[2].trim();
        } else {
          return; // 无法解析，跳过
        }
      }
    }

    if (!item || !status) return;
    stateHistory.push({
      itemName: item,
      status: status.toLowerCase(),
      sourceChapter: f.sourceChapter || null,
      timestamp: f.created_at || '',
      note: note
    });
  });

  // ③ 按时间排序
  stateHistory.sort(function(a, b) { return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0; });

  // ④ 构建物品状态机：物品名 → 最新状态
  var itemLatestStatus = {};
  stateHistory.forEach(function(entry) {
    itemLatestStatus[entry.itemName] = entry.status;
  });

  // ⑤ 判断消耗状态（常见消耗关键词）
  var consumedKeywords = new Set(['消耗', '使用', '损坏', '破碎', '丢失', '消失', '耗尽', '用完', '折断', '烧毁', '毁灭', 'dead', 'destroyed', 'lost', 'broken', 'used', 'consumed', '消耗了', '用完了', '破碎了', '损坏了']);
  function isConsumed(status) {
    if (consumedKeywords.has(status)) return true;
    for (var kw of consumedKeywords) {
      if (status.includes(kw)) return true;
    }
    return false;
  }

  // ⑥ 扫描后续章节，检查已消耗物品是否再次出现且未被回收
  //    回收状态关键词
  var recoveredKeywords = new Set(['恢复', '修复', '重生', '重获', '找回', '复活', '重新获得', 'restored', 'repaired', 'recovered', 'replaced', '恢复了', '修复了', '找回了']);
  function isRecovered(status) {
    for (var kw of recoveredKeywords) {
      if (status.includes(kw)) return true;
    }
    return false;
  }

  // 构建章节顺序映射
  var chapterOrder = {};
  chapters.forEach(function(ch, i) { chapterOrder[ch.id] = i; });

  // 按状态变更事件，检查后续章节
  stateHistory.forEach(function(entry) {
    if (!isConsumed(entry.status)) return;
    // 如果不是最新状态（后来被修复/找回），跳过
    if (itemLatestStatus[entry.itemName] && !isConsumed(itemLatestStatus[entry.itemName])) return;

    var sourceIdx = entry.sourceChapter ? (chapterOrder[entry.sourceChapter] || 0) : 0;
    var laterChapters = chapters.filter(function(ch) {
      var idx = chapterOrder[ch.id] || 0;
      return idx > sourceIdx;
    });

    laterChapters.forEach(function(ch) {
      var body = allBodies[ch.id] || '';
      if (!body) return;
      // 检查该物品在后续章节是否出现
      if (body.includes(entry.itemName)) {
        // 找到了，但没有后续的状态变更记录来回收它
        result.push({
          item: entry.itemName,
          status: entry.status,
          chapter: entry.sourceChapter || '未知',
          foundIn: ch.id,
          chapterTitle: ch.title,
          note: entry.note || '',
          severity: 'low'
        });
      }
    });
  });

  return result;
}