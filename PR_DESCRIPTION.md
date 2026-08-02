# PR：章节覆盖快照 + 人物卡双视角 + Preset 文风系统

> 致月曦夜（@Yuexiye）：基于 B站《Storydex》视频的功能拆解报告（作者洛琪希），对照墨述实际仓库做的整合改动。报告中两处对墨述的判断有偏差，动手前已校验修正。三处功能改动，均向后兼容、有回归测试。

## 改动概述

| # | 改动 | 文件 | 行数 | 测试 |
|---|---|---|---|---|
| 1 | `chapter write` 覆盖走快照 | `tools/chapter.js` | +20 | 15 PASS |
| 2 | 人物卡 visibility 双视角 | `lib/cards.js` + 3 tools | +14/-3 | 16 PASS |
| 3 | Preset 文风系统 | `tools/context.js` | +25 | 21 PASS |

## 报告校验修正（动手前）

报告基于视频做对比，对墨述的判断有两处偏差，已校验：

- ❌ "墨述无版本控制" → ✅ `chapter revise` 已有 `_rev_N` 快照，`extra→chapter_history` 可回退
- ❌ "write 拆 draft/apply" → ✅ 墨述已有 write/revise 区分，真痛点是 **`write` 覆盖已存在章节不留版本**（直接 `writeFileSync` 冲掉原文）
- ❌ "墨述无 Preset" → ✅ 已有 `style` 卡（pov/tense/tone），P1 是**升级非新建**

---

## 改动 1：`chapter write` 覆盖走快照（P0a）

**痛点**：AI/作者用 `novel_chapter write` 带已存在 `chapterId` 覆盖章节时，直接 `writeFileSync` 冲掉原文、无版本保留。只有 `revise` 才留 `_rev_N`。

**改法**：`write` 分支覆盖已存在章节时，复用 `revise` 的快照逻辑——先 `renameSync` 旧 `{id}.md` → `{id}_rev_N.md`（含 base64 封面提取与 `[base64-cover-image]` 还原），再写新内容。

**向后兼容**：新建章节（无 `chapterId` 或 id 不存在）行为不变，直接创建不留快照；`revise` 行为不变。

**测试**：覆盖→生成 `_rev_1` 旧内容进快照；再覆盖→rev 号递增 `_rev_2`；`revise` 回归不破。

---

## 改动 2：人物卡 visibility 双视角（P1）

**痛点**：作者后台与 AI 写作视角无区分，人物卡全字段注入，剧透类设定可能泄露给 AI。

**改法**：人物卡顶层加 `visibility: "all"|"developer"`（默认 `all`，向后兼容老数据）。仅 `characters` 生效，非 characters 传该字段被 `upsert` 静默忽略。`get_context` 加 `viewAs` 参数，**默认 `player`**（安全默认——AI 写章节调默认就脱敏）；player 视角下 developer 卡藏 `content` 只给 `name+type`（不整张藏，避免 AI 凭空编造人物）。

**向后兼容**：无 `visibility` 字段的老卡视为 `all`，行为不变；默认 `viewAs=player` 对无 developer 卡的项目无影响（全 all 时无脱敏）。

**测试**：player 藏秘密 / developer 全显 / 非 characters 忽略 / 默认视角=player。

---

## 改动 3：Preset 文风系统（P1）

**痛点**：所有 style 卡全注入，多套风格会矛盾约束同时注入；style 卡作为"设定卡片"列表一条，无文风强调地位。

**改法**：复用 style 卡作 Preset 载体（每张 style 卡即一套 Preset），不另造数据结构。`get_context` 加 `presetId`：指定时把该 style 卡编译为 `## ✍️ 文风约束` 段（字段→标签语句，object→子项，array→要点，`PRESET_LABELS` 映射常用键中文化），其余 style 卡不注入避免矛盾；未指定 fallback 全 style 注入（向后兼容）。**关键**：设定卡片段跳过整个 `style` 类型（不只选中那张），否则其他 style 卡仍矛盾注入。

**向后兼容**：未传 `presetId` 时行为完全不变。

**测试**：多套切换 / 编译结构（dimensions 子项 + textBlocks 要点）/ graceful fallback（不存在的 presetId）/ 与 visibility 共存。

---

## 不做：P2 graph 快照

`graph` 是纯派生视图（`sync`/`rebuild`/`sync_plot`/`sync_facts` 全从 cards/chapters/facts 提取边，查询走 `buildAdjacencyGraph` 内存构建），给派生图加快照冗余。要历史图状态，正解是给 **cards 加版本快照**（未来增强），而非给派生图加快照。

---

## 文件清单

**改动**：`tools/chapter.js`、`lib/cards.js`、`tools/update-card.js`、`tools/get-cards.js`、`tools/context.js`

**新增（开发资产，可不合并）**：`PROJECT_LOG.md`、`INTEGRATION_SUMMARY.md`、`_test_p0a.mjs`/`_test_p1.mjs`/`_test_preset.mjs`、`_backups/*.bak`

## 规范遵循

按 OpenHanako 插件开发规范：工具命名导出 `name/description/parameters/execute`；返回 `{content:[{type:text,text}]}`；写索引用 `lib/wqueue.js` 的 `enqueue` 串行化；路径走 `lib/config.js` 的 `safeProjectId`；改动前备份；独立 node 脚本回归（设 `MO_SHU_DIR` 指向临时目录，不依赖运行时）。

## 合规 gap（未处理，待你定）

墨述 28 个工具普遍未声明 `sessionPermission`（0.341.19+ permission contract）。纯 `dataDir` 私有数据操作可能非强制，但加了更合规。这是机械量大的任务，未擅自动手，待你评估是否补、补哪些。
