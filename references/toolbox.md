# 墨述 · 完整工具箱

所有工具通过 `mo-shu_novel_*` 前缀调用。写作开始前先确认工具可用：`mo-shu_novel_ping`。

## 项目层

| 工具 | 用途 |
|------|------|
| `list_projects` | 列出所有写作项目 |
| `create_project` | 创建新项目（名称、类型、世界观概括） |
| `project_info` | 查看项目详情和卡片统计 |
| `guided_init` | 新手三步引导创建项目 |

## 卡片层（人物 / 世界观 / 文风）

| 工具 | 用途 |
|------|------|
| `get_cards` | 列出项目卡片，可按类型过滤 |
| `update_card` | 添加或更新卡片内容 |

## 结构层

| 工具 | 用途 |
|------|------|
| `structure` → `get_all` | 获取完整结构（大纲树 + 剧情弧 + 时间线） |
| `structure` → `add_part / update_part / remove_part / move_part` | 编辑大纲树（幕/卷/章层级） |
| `structure` → `add_arc / update_arc / remove_arc / add_arc_node` | 管理剧情弧（角色/情节弧线） |
| `structure` → `add_timeline / update_timeline / remove_timeline` | 管理时间线事件 |

## 章节层

| 工具 | 用途 |
|------|------|
| `chapter` → `list` | 列出全部章节 |
| `chapter` → `get` | 读取章节正文 |
| `chapter` → `write` | 写新章节 |
| `chapter` → `revise` | 修订已有章节（多版本保留） |
| `chapter` → `rename / split` | 重命名 / 拆分章节 |
| `merge_chapters` | 合并多个章节 |
| `reorder_chapters` | 批量调整章节顺序 |

## 设定层

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

## 上下文引擎

| 工具 | 用途 |
|------|------|
| `get_context` | **写章节前调用**。自动注入世界观、设定卡片、前文摘要、相关事实。支持常驻/优先级/章槛过滤 |

## 分析层

| 工具 | 用途 |
|------|------|
| `analyze` → `consistency` | 一致性校验：事实库与实际描写对照 |
| `analyze` → `hooks` | 悬念钩子检测（13 种模式） |
| `analyze` → `ai_style` | 去 AI 味检测（16 种特征） |
| `analyze` → `cross_validate` | 交叉验证：人物矛盾 + 时间线 + 伏笔未收 |
| `analyze` → `all` | 四项全跑 |

## 导出层

| 工具 | 用途 |
|------|------|
| `export_dashboard` | 导出项目看板（HTML） |
| `export_immersive` | 导出沉浸式档案阅读器 |
| `export_storygame` | 导出互动文游（linear/分支 game 模式） |
| `novel_search` | 全文跨文件搜索 |
