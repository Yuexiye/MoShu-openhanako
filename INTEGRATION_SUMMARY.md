# 墨述 × Storydex 整合 — 进度总结

> 2026-07-24 | 基于 `03-Storydex功能拆解与墨述整合.md` 报告 + openhanako-moshu 实际仓库 + plugin-dev-guide 规范

## 已完成

| 项 | 改动 | 测试 | 价值 |
|---|---|---|---|
| **P0a** write 覆盖走快照 | `tools/chapter.js` write 分支复用 revise 的 `_rev_N` 归档逻辑（base64 封面提取+还原） | 15 PASS | 堵住 AI/写覆盖丢原文的洞 |
| **P1** 人物卡 visibility | `lib/cards.js` + `update-card` + `get-cards` + `context.js`，卡片级 `all/developer`，`get_context` 默认 `player` 脱敏 | 16 PASS | 防剧透：作者后台看全、AI 写作视角脱敏 |
| **P1** Preset 文风系统 | `tools/context.js`，`presetId` 切换 + 编译"文风约束"段，复用 style 卡不另造数据结构 | 21 PASS | 多套风格切换，解决多套矛盾注入 |

## P2 结论：不做

`graph` 是**纯派生视图**：`sync`/`rebuild`/`sync_plot`/`sync_facts` 全从 cards/chapters/facts 提取边，查询走 `buildAdjacencyGraph` 内存构建，无手工编辑边的入口。给派生图做版本快照冗余——回滚源再 rebuild 即可。要历史图状态，正解是给 **cards 加版本快照**（未来增强），而非给派生图加快照。

## 报告校验修正

- 原"墨述无版本控制"有误：`chapter revise` 已有 `_rev_N` 快照；真痛点是 `write` 覆盖不留版本（P0a 已修）
- 原"墨述无 Preset"不确：已有 `style` 卡，P1 是**升级非新建**
- 原 P0"拆 write 成 draft/apply"与现状不契合：墨述已有 write/revise 区分，该补的是 write 覆盖也走快照

## 改动文件清单（moshu-dev/）

- `tools/chapter.js`（P0a）
- `lib/cards.js`、`tools/update-card.js`、`tools/get-cards.js`、`tools/context.js`（P1 visibility）
- `tools/context.js`（P1 Preset，叠加在 visibility 改动上）
- `PROJECT_LOG.md` — 全程开发日志（缘起/进度/验证清单/经验/备份）
- `_test_p0a.mjs` / `_test_p1.mjs` / `_test_preset.mjs` — 回归测试
- `_backups/*.bak` — 各次改动前备份

## 规范遵循

按 `plugin-dev-guide`：改动前备份到 `_backups/`、维护 `PROJECT_LOG.md`、独立 node 脚本回归（设 `MO_SHU_DIR` 指向临时目录，不依赖 OpenHanako 运行时，可重复跑）。

## 待办

- **合规 gap**：墨述工具普遍未声明 `sessionPermission`（0.341.19+ permission contract）。机械但量大（28 个工具文件），待评估是否补——纯私有数据操作可能非强制，但加了更合规
