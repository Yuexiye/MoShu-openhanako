// P1 回归测试：人物卡 visibility 双视角
import { execute as updateCard } from "./tools/update-card.js";
import { execute as getCards } from "./tools/get-cards.js";
import { execute as getContext } from "./tools/context.js";
import fs from "node:fs";
import path from "node:path";

const TEST_DIR = path.resolve("./_test_data");
process.env.MO_SHU_DIR = TEST_DIR;
fs.rmSync(TEST_DIR, { recursive: true, force: true });

let pass = true;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) pass = false;
}

async function upd(input) { const r = await updateCard(input); return JSON.parse(r.content[0].text); }
async function cards(input) { const r = await getCards(input); return JSON.parse(r.content[0].text); }
async function ctx(input) { const r = await getContext(input); return r.content[0].text; }

const PID = "ptest";

// 1. 人物卡 A: visibility=developer，含秘密字段
const rA = await upd({ projectId: PID, type: "characters", name: "神秘人", content: { real_identity: "最终BOSS", appearance: "黑衣人" }, visibility: "developer" });
check("1 创建人物卡A(developer)成功", rA.ok === true);
check("1 A.visibility 存储为 developer", rA.card.visibility === "developer");

// 2. 人物卡 B: 不传 visibility，应默认 all
const rB = await upd({ projectId: PID, type: "characters", name: "侦探甲", content: { role: "侦探", quirk: "抽烟斗" } });
check("2 创建人物卡B成功", rB.ok === true);
check("2 B.visibility 默认 all", rB.card.visibility === "all");

// 3. 世界观卡 C: 传 visibility=developer 应被忽略（仅 characters 生效）
const rC = await upd({ projectId: PID, type: "world", name: "魔法体系", content: { rule: "魔法失效区" }, visibility: "developer" });
check("3 创建世界观卡C成功", rC.ok === true);
check("3 C.visibility 非characters被忽略(无字段)", rC.card.visibility === undefined);

// 4. get_cards characters 返回 visibility
const gc = await cards({ projectId: PID, type: "characters" });
const cardA = gc.cards.find(c => c.name === "神秘人");
const cardB = gc.cards.find(c => c.name === "侦探甲");
check("4 get_cards 返回 A.visibility=developer", cardA.visibility === "developer");
check("4 get_cards 返回 B.visibility=all", cardB.visibility === "all");

// 5. get_cards world：C 的 visibility map 回退 all
const gw = await cards({ projectId: PID, type: "world" });
const cardC = gw.cards.find(c => c.name === "魔法体系");
check("5 get_cards world C.visibility 回退 all", cardC.visibility === "all");

// 6. get_context 默认 viewAs=player：A 脱敏、B 正常、C 正常（world 不受 visibility）
const ctxPlayer = await ctx({ projectId: PID });
check("6 player视角 A 脱敏(含名+保密标记)", ctxPlayer.includes("神秘人") && ctxPlayer.includes("[设定保密"));
check("6 player视角 A 藏秘密(不含最终BOSS)", !ctxPlayer.includes("最终BOSS"));
check("6 player视角 B 正常显(含侦探)", ctxPlayer.includes("侦探"));
check("6 player视角 C 正常显(含魔法失效，world不受visibility)", ctxPlayer.includes("魔法失效"));

// 7. get_context viewAs=developer：A 全显
const ctxDev = await ctx({ projectId: PID, viewAs: "developer" });
check("7 developer视角 A 全显(含最终BOSS)", ctxDev.includes("最终BOSS"));
check("7 developer视角 含 A appearance(黑衣人)", ctxDev.includes("黑衣人"));

// 8. 回归：无 viewAs 参数默认 player
const ctxDefault = await ctx({ projectId: PID });
check("8 默认视角=player(A脱敏)", ctxDefault.includes("[设定保密") && !ctxDefault.includes("最终BOSS"));

console.log("\n=== " + (pass ? "ALL PASS ✅" : "SOME FAILED ❌") + " ===");

try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) { console.log("(skip clean: " + e.message + ")"); }
process.exit(pass ? 0 : 1);
