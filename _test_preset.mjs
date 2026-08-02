// P1 Preset 回归测试：多套 style 卡切换 + 编译注入 + fallback + visibility 共存
import { execute as updateCard } from "./tools/update-card.js";
import { execute as getContext } from "./tools/context.js";
import fs from "node:fs";
import path from "node:path";

const TEST_DIR = path.resolve("./_test_data");
process.env.MO_SHU_DIR = TEST_DIR;
fs.rmSync(TEST_DIR, { recursive: true, force: true });

let pass = true;
function check(name, cond) { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) pass = false; }

async function upd(input) { const r = await updateCard(input); return JSON.parse(r.content[0].text); }
async function ctx(input) { const r = await getContext(input); return r.content[0].text; }

const PID = "ptest";

// A: 悬疑风 style 卡，含 dimensions + textBlocks
const rA = await upd({ projectId: PID, type: "style", name: "悬疑冷峻风", content: { pov: "第三人称限知", tense: "过去时", tone: "冷峻", dimensions: { pace: "慢", density: "低" }, textBlocks: ["避免副词堆砌", "对话不解释"] } });
check("创建style卡A成功", rA.ok === true);
const presetA = rA.card.id;

// B: 轻松风 style 卡
const rB = await upd({ projectId: PID, type: "style", name: "轻松日常风", content: { pov: "第一人称", tone: "轻松" } });
check("创建style卡B成功", rB.ok === true);

// C: 人物卡 all
const rC = await upd({ projectId: PID, type: "characters", name: "侦探甲", content: { role: "侦探" } });
check("创建人物卡C成功", rC.ok === true);

// D: 人物卡 developer（回归 visibility）
const rD = await upd({ projectId: PID, type: "characters", name: "神秘人", content: { real_identity: "凶手" }, visibility: "developer" });
check("创建人物卡D(developer)成功", rD.ok === true);

// 场景4: 无 presetId（默认 player）— 向后兼容，全 style 注入设定卡片段
const t4 = await ctx({ projectId: PID });
check("4 无preset: 含A(悬疑冷峻风)在设定卡片段", t4.includes("悬疑冷峻风"));
check("4 无preset: 含B(轻松日常风)", t4.includes("轻松日常风"));
check("4 无preset: 无文风约束段", !t4.includes("文风约束"));
check("4 无preset: C正常显(含侦探)", t4.includes("侦探"));
check("4 无preset: D脱敏(含保密标记)", t4.includes("[设定保密"));
check("4 无preset: D藏秘密(不含凶手)", !t4.includes("凶手"));

// 场景5: presetId=A — A 编译为文风约束段，B 不注入，C/D 不受影响
const t5 = await ctx({ projectId: PID, presetId: presetA });
check("5 presetA: 有文风约束段", t5.includes("文风约束"));
check("5 presetA: 文风约束段含A名(悬疑冷峻风)", t5.includes("悬疑冷峻风"));
check("5 presetA: 编译标签(叙事视角:第三人称限知)", t5.includes("叙事视角：第三人称限知"));
check("5 presetA: dimensions子项(维度/节奏:慢)", t5.includes("维度/节奏：慢"));
check("5 presetA: textBlocks要点(·避免副词堆砌)", t5.includes("· 避免副词堆砌"));
check("5 presetA: B不出现(不含轻松日常风，避免矛盾注入)", !t5.includes("轻松日常风"));
check("5 presetA: C正常显(含侦探)", t5.includes("侦探"));
check("5 presetA: D脱敏共存(含保密标记,不含凶手)", t5.includes("[设定保密") && !t5.includes("凶手"));

// 场景6: presetId 不存在 → graceful fallback 到全 style 注入
const t6 = await ctx({ projectId: PID, presetId: "c_notexist" });
check("6 不存在preset: 无文风约束段(fallback)", !t6.includes("文风约束"));
check("6 不存在preset: 含A(全style注入)", t6.includes("悬疑冷峻风"));
check("6 不存在preset: 含B", t6.includes("轻松日常风"));

console.log("\n=== " + (pass ? "ALL PASS ✅" : "SOME FAILED ❌") + " ===");
try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) { console.log("(skip clean: " + e.message + ")"); }
process.exit(pass ? 0 : 1);
