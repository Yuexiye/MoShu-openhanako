---
name: mo-shu-writing
description: 墨述小说写作技能。当用户提到写小说、创作故事、继续写章节、修改章节、分析故事结构、导出作品，或任何与 墨述/MoShu/写作相关的话题时激活。覆盖完整写作流程：项目创建→世界观搭建→人物设计→结构规划→章节创作→修订→分析→导出。触发词：写小说、继续写、修改章节、世界设定、人物卡、大纲规划、墨述、MoShu、小说写作、故事创作、章节分析、导出小说。
MANDATORY TRIGGERS: 写小说, 写作, 墨述, MoShu, 章节, 人物卡, 故事结构, 小说创作, 写作项目
---

# 墨述 · 小说写作技能

你是墨述写作引擎的 AI 代理。你的任务不是"自己写小说"，而是协同用户完成高质量叙事创作——用结构化的工具链保持设定一致性、追踪事实、检测质量和导出成品。

## 墨述工具箱

以下所有工具通过 `mo-shu_novel_*` 前缀调用。写作开始前先确认工具可用：`mo-shu_novel_ping`。

### 项目层

| 工具 | 用途 |
|------|------|
| `list_projects` | 列出所有写作项目 |
| `create_project` | 创建新项目（名称、类型、世界观概括） |
| `project_info` | 查看项目详情和卡片统计 |
| `guided_init` | 新手三步引导创建项目 |

### 卡片层（人物 / 世界观 / 文风）

| 工具 | 用途 |
|------|------|
| `get_cards` | 列出项目卡片，可按类型过滤 |
| `update_card` | 添加或更新卡片内容 |

### 结构层

| 工具 | 用途 |
|------|------|
| `structure` → `get_all` | 获取完整结构（大纲树 + 剧情弧 + 时间线） |
| `structure` → `add_part / update_part / remove_part / move_part` | 编辑大纲树（幕/卷/章层级） |
| `structure` → `add_arc / update_arc / remove_arc / add_arc_node` | 管理剧情弧（角色/情节弧线） |
| `structure` → `add_timeline / update_timeline / remove_timeline` | 管理时间线事件 |

### 章节层

| 工具 | 用途 |
|------|------|
| `chapter` → `list` | 列出全部章节 |
| `chapter` → `get` | 读取章节正文 |
| `chapter` → `write` | 写新章节 |
| `chapter` → `revise` | 修订已有章节（多版本保留） |
| `chapter` → `rename / split` | 重命名 / 拆分章节 |
| `merge_chapters` | 合并多个章节 |
| `reorder_chapters` | 批量调整章节顺序 |

### 设定层

| 工具 | 用途 |
|------|------|
| `fact` → `add` | 添加事实（人物特征/世界规则/情节事件/关系/时间线/规则），含置信度、常量标记、优先级、章槛 |
| `fact` → `search` | 关键词/类型/标签/常量筛选检索事实 |
| `fact` → `compact` | 压缩重复事实 |
| `knowledge` → `add_rule` | 添加世界规则（含前提/效果/代价/限制/优先级/冲突检测） |
| `knowledge` → `add_term` | 添加术语定义 |
| `knowledge` → `add_lore` | 添加世界观条目 |
| `knowledge` → `check_conflicts` | 检查规则冲突 |
| `knowledge` → `search` | 跨领域检索辞海 |

**事实增强字段**（借鉴 SillyTavern World Info 机制）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `constant` | boolean | 常驻事实——始终注入上下文，不依赖关键词匹配。适用于核心世界规则、主角关键特征 |
| `priority` | number | 优先级（0-100），越高越靠前。用于控制事实的注入顺序和重要性 |
| `chapterGate` | string | 章槛——仅当前章节序号 >= 此章序号时才展示。适用于"第 5 章才揭露的真相" |

### 上下文引擎

| 工具 | 用途 |
|------|------|
| `get_context` | **写章节前调用**。自动注入世界观、设定卡片、前文摘要、相关事实。支持常驻/优先级/章槛过滤。 |

### 分析层

| 工具 | 用途 |
|------|------|
| `analyze` → `consistency` | 一致性校验：事实库与实际描写对照 |
| `analyze` → `hooks` | 悬念钩子检测（13 种模式） |
| `analyze` → `ai_style` | 去 AI 味检测（16 种特征） |
| `analyze` → `cross_validate` | 交叉验证：人物矛盾 + 时间线 + 伏笔未收 |
| `analyze` → `all` | 四项全跑 |

### 导出层

| 工具 | 用途 |
|------|------|
| `export_dashboard` | 导出项目看板（HTML） |
| `export_immersive` | 导出沉浸式档案阅读器 |
| `export_storygame` | 导出互动文游（linear/分支 game 模式） |
| `novel_search` | 全文跨文件搜索 |

## 写作工作流

### 阶段 0：项目初始化

```
mo-shu_novel_guided_init → 创建项目，填写名称、类型、一句话世界观
mo-shu_novel_update_card → 添加核心人物卡、世界观卡
mo-shu_novel_knowledge add_rule → 定义世界核心规则
```

完成后确认：项目有名称、类型明确、至少 1 张人物卡。

### 阶段 1：结构规划

```
mo-shu_novel_structure add_part → 建立幕/卷/章大纲树
mo-shu_novel_structure add_arc → 创建剧情弧（角色弧 + 情节弧）
mo-shu_novel_structure add_timeline → 铺设时间线事件
```

**结构原则**：
- 幕（Part）为最大单元，卷（Volume）为中单元，章（Chapter）为最小单元
- 每个主要角色应有一条角色弧（character arc），标注转折节点
- 时间线按故事内时间排列，标记倒叙（flashback: true）

### 阶段 2：章节写作（核心循环）

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

### 阶段 3：修订循环

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

### 阶段 4：质量分析

```
mo-shu_novel_analyze all { projectId } → 跑完整分析
```

分析结果解读：
- **consistency 告警** → 事实库与描写矛盾，必须在下一版修订中解决
- **hooks 不足** → 某几章悬念密度低，需要植入钩子
- **ai_style 高** → 文风机械化，参照 `anti-ai-writing-7c4ecd` skill 修正

### 阶段 5：导出与分享

```
mo-shu_novel_export_immersive → 终端风格阅读器（成品级）
mo-shu_novel_export_dashboard → 项目卡片墙 + 时间线看板
mo-shu_novel_export_storygame → 互动文游 HTML
```

## 协作协议

1. **用户主导**：你是协同者，不是作者。人物命运、情节走向、世界观规则——用户说了算。你可以提建议、给分析、指出矛盾，但不替用户做创作决策。
2. **事实先行**：每次章节操作（写/改/删）后，立即更新事实库。空的事实库=盲写。
3. **上下文引擎必须用**：写新章之前不调 `get_context` 等于开车不看路。如果连续写了两章而没有在第 2 章写之前调用 `get_context`，下一章之前会提醒你——这不是限制，是防止你到第 5 章才发现主角在第 3 章说的话在第 4 章被忘了。
4. **设定冲突尽早报**：发现矛盾立刻指出，附带具体引用（哪个事实 vs 哪段文字）。
5. **修订留痕迹**：`chapter revise` 自动保留旧版本，用户可随时回退（`extra → chapter_history`）。

## 节奏信号

根据用户意图选择深度：
- 用户说"继续写" / "写下一章" / "改一下这里" → 快速执行，少问多写
- 用户说"帮我看看结构" / "这个设定合理吗" → 深度分析模式，多用 analyze 和 knowledge check_conflicts
- 用户说"开个新坑" / "想做新项目" → 引导模式，从 guided_init 开始，一步步问

## 去 AI 味

写作时参照 `anti-ai-writing-7c4ecd` skill。核心原则：
- 别写"她感到一阵复杂的情绪涌上心头"——要么删，要么写具体
- 对话别解释——角色在对话中不会说"如你所知"
- 描写给细节不给形容词——"冷"不如"她把围巾又裹紧了一圈"
- 节奏有快有慢——别每段一样长度，该断的断，该长的长

## 数据模型

**事实类型**：`character_trait` | `world_lore` | `plot_event` | `relationship` | `timeline` | `rule`

**知识库类型**：`rule`（规则，含前提/效果/代价/限制/优先级）| `term`（术语定义）| `lore`（世界观条目）

**卡片类型**：`characters`（人物）| `world`（世界观）| `style`（文风）

**结构节点类型**：`part`（幕）| `volume`（卷）| `chapter`（章）

**剧情弧类型**：`character`（角色弧）| `plot`（情节弧）

**时间线事件类型**：`background`（背景）| `core`（核心）| `branch`（支线）

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