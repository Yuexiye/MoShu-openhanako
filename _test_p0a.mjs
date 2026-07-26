// P0a 回归测试：验证 chapter write 覆盖走快照、新建不走快照、revise 仍正常
import { execute } from "./tools/chapter.js";
import fs from "node:fs";
import path from "node:path";

const TEST_DIR = path.resolve("./_test_data");
process.env.MO_SHU_DIR = TEST_DIR;
fs.rmSync(TEST_DIR, { recursive: true, force: true });

async function call(input) {
  const r = await execute(input);
  return JSON.parse(r.content[0].text);
}

function read(f) {
  return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : null;
}

let pass = true;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) pass = false;
}

const projDir = path.join(TEST_DIR, "projects", "ptest");
const chDir = path.join(projDir, "chapters");
const chMd = path.join(chDir, "ch_01.md");
const rev1 = path.join(chDir, "ch_01_rev_1.md");
const rev2 = path.join(chDir, "ch_01_rev_2.md");

// 1. 新建 ch_01 = VERSION_1
const r1 = await call({ action: "write", projectId: "ptest", title: "测试章", content: "VERSION_1 正文" });
check("step1 新建成功", r1.ok === true);
check("step1 新建不走快照（无 _rev_1）", !fs.existsSync(rev1));
check("step1 当前内容 = VERSION_1", read(chMd) === "VERSION_1 正文");

// 2. write 覆盖 ch_01 = VERSION_2（P0a 核心）
const r2 = await call({ action: "write", projectId: "ptest", chapterId: "ch_01", title: "测试章", content: "VERSION_2 正文" });
check("step2 覆盖成功", r2.ok === true);
check("step2 当前内容 = VERSION_2", read(chMd) === "VERSION_2 正文");
check("step2 生成 _rev_1 快照", fs.existsSync(rev1));
check("step2 _rev_1 内容 = VERSION_1（旧内容进快照）", read(rev1) === "VERSION_1 正文");

// 3. write 再覆盖 ch_01 = VERSION_3（验证 rev 号递增）
const r3 = await call({ action: "write", projectId: "ptest", chapterId: "ch_01", title: "测试章", content: "VERSION_3 正文" });
check("step3 覆盖成功", r3.ok === true);
check("step3 当前内容 = VERSION_3", read(chMd) === "VERSION_3 正文");
check("step3 生成 _rev_2 快照（rev 号递增）", fs.existsSync(rev2));
check("step3 _rev_2 内容 = VERSION_2", read(rev2) === "VERSION_2 正文");
check("step3 _rev_1 仍为 VERSION_1", read(rev1) === "VERSION_1 正文");

// 4. 回归：revise 仍正常工作
const r4 = await call({ action: "revise", projectId: "ptest", chapterId: "ch_01", content: "VERSION_4 修订" });
check("step4 revise 成功（回归不破）", r4.ok === true);
check("step4 revise 当前 = VERSION_4", read(chMd) === "VERSION_4 修订");
check("step4 revise 生成 _rev_3", fs.existsSync(path.join(chDir, "ch_01_rev_3.md")));

console.log("\n=== " + (pass ? "ALL PASS ✅" : "SOME FAILED ❌") + " ===");

// 清理临时数据
fs.rmSync(TEST_DIR, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
