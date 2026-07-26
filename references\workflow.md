# 墨述 · 写作工作流（详细）

## 阶段 0：项目初始化

```
mo-shu_novel_guided_init → 创建项目，填写名称、类型、一句话世界观
mo-shu_novel_update_card → 添加核心人物卡、世界观卡
mo-shu_novel_knowledge add_rule → 定义世界核心规则
```

完成后确认：项目有名称、类型明确、至少 1 张人物卡。

## 阶段 1：结构规划

```
mo-shu_novel_structure add_part → 建立幕/卷/章大纲树
mo-shu_novel_structure add_arc → 创建剧情弧（角色弧 + 情节弧）
mo-shu_novel_structure add_timeline → 铺设时间线事件
```

**结构原则**：
- 幕（Part）为最大单元，卷（Volume）为中单元，章（Chapter）为最小单元
- 每个主要角色应有一条角色弧（character arc），标注转折节点
- 时间线按故事内时间排列，标记倒叙（flashback: true）

## 阶段 2：章节写作（核心循环）

**每次写新章节前必须做的事**：

1. **获取上下文**
```
mo-shu_novel_get_context { projectId, nextChapterTitle, maxFacts: 15, maxPrevChapters: 3 }
```
→ 拿到世界观、前文摘要、相关设定事实。不跳这一步。

2. **写章节**
```
mo-shu_novel_chapter write { projectId, title, content, volume? }
```

3. **提取事实**
```
mo-shu_novel_fact add → 把本章新增的人物特征、事件、关系、规则写进事实库
```

4. **可选：地图标记**
如果章节涉及地点，用 `{{map/地点名}}` 语法标注，写完后调 `mo-shu_novel_map_links` 自动关联。

**写作原则**：
- 每章应有至少 1 个悬念钩子（开篇/中段/章末均可）
- 对话避免信息倾泻（As you know, Bob 句式）
- 叙述与描写比例约 6:4，不要让角色一直站着说话
- 每次写完立即提取事实——拖一章节再补一定会漏

**事实管理最佳实践**：
- 核心世界规则用 `constant: true` 标记——每次写新章自动提醒，不会忘
- 关键角色特征用 `priority: 80`（高于默认 0）——始终排在上下文前面
- 剧透类事实用 `chapterGate`：如"BOSS 的真实身份是XX"设 `chapterGate: "5"`，只在第 5 章后出现
- 检索时用 `constantOnly: true` 快速看哪些设定是常驻的——这些都是世界观基石

**悬疑/推理类型专项**：

写悬疑时，每章的最低悬念要求是：
- 开篇：1 个微型钩子（环境反常、物件异常、对话中的信息缺口）
- 中段：1 个线索推进 + 1 个误导/红鲱鱼
- 章末：1 个未回答的问题（不一定是 cliffhanger，但必须是开放问题）

自检问题：
1. 读者读完这章后，最想问的一个问题是什么？如果这个问题不存在→请加钩子。
2. 这章有没有给了读者一个"我知道答案了"的错觉？如果没有→请加误导。
3. 主角在这章结束时，离真相更近了还是更远了？（悬疑需要有时更近、有时更远）

**卡片最小填充要求**：

创建卡片只是第一步——空卡片等于没建。每次创建后必须完成以下最小填充：
- 人物卡：name + appearance（1句）+ 1 条 personality trait + 1 条 motivation
- 世界观卡：至少 1 条 core trait（该世界的核心规则）
- 文风卡：pov + tense + tone 三项必填

如果不需要某项，应删除该字段而不是留空字符串。留空字段在一致性校验中会被忽略，造成"建了卡等于没建"。

## 阶段 3：修订循环

```
mo-shu_novel_chapter get → 重新阅读目标章节
mo-shu_novel_analyze → 跑 analysis（建议先跑 ai_style，再跑 consistency）
mo-shu_novel_chapter revise → 提交修订（自动保留旧版本）
```

修订检查清单：
- [ ] 与前文事实是否一致？
- [ ] 人物行为是否符合当前阶段的角色弧？
- [ ] 时间线有无冲突？
- [ ] 有无 AI 味特征？（如无情感强度的"她心中涌起一阵复杂的情绪"）
- [ ] 悬念钩子是否有效（不给答案，只给线索）？

## 阶段 4：质量分析

```
mo-shu_novel_analyze all { projectId } → 跑完整分析
```

分析结果解读：
- **consistency 告警** → 事实库与描写矛盾，必须在下一版修订中解决
- **hooks 不足** → 某几章悬念密度低，需要植入钩子
- **ai_style 高** → 文风机械化，参照 `anti-ai-writing-7c4ecd` skill 修正

## 阶段 5：导出与分享

```
mo-shu_novel_export_immersive → 终端风格阅读器（成品级）
mo-shu_novel_export_dashboard → 项目卡片墙 + 时间线看板
mo-shu_novel_export_storygame → 互动文游 HTML
```

## 悬疑类型章节 SOP

写悬疑章节的标准流程（比通用流程多了钩子管理）：

```
1. mo-shu_novel_get_context    → 获取前文设定和事实（建议传 currentChapterId 启章槛过滤）
2. mo-shu_novel_chapter write   → 写正文
3. mo-shu_novel_fact add        → 提取本章新增事实（标记 constant/priority/chapterGate）
4. 手动标记章节 hooks 字段     → 记录本章投放了哪些钩子类型
5. mo-shu_novel_analyze hooks   → 跑悬念密度检测
6. （可选）analyze consistency  → 跑一致性校验
```

悬疑项目的核心死穴：设定写在知识库里，正文中没体现。每写完一章，检查本章有没有用到知识库中的规则/术语——如果一条规则在知识库里但正文里没露过面，它就不是设定，是笔记。

## 角色弧规则

角色弧的转折点必须与情节的关键揭露重合。悬疑不是"主角查案"，是"查案改变主角"。

建弧的标准操作：
```
mo-shu_novel_structure add_arc { arcType: "character", arcTitle: "主角弧", characterId: "角色卡片ID" }
mo-shu_novel_structure add_arc_node { arcId, chapterId, label: "转折点" }
```
