import { readFileSync } from "fs";
const js = readFileSync("C:/Users/Administrator/.hanako/plugins/mo-shu/assets/app.js", "utf-8");
try {
  new Function(js);
  console.log("JS SYNTAX OK");
} catch(e) {
  console.log("JS ERROR:", e.message);
  const lines = js.split("\n");
  const m = e.message.match(/line (\d+)/);
  if (m) {
    const ln = parseInt(m[1]);
    for (let i = Math.max(0,ln-2); i < Math.min(lines.length, ln+1); i++) {
      console.log((i+1) + ": " + (lines[i]||"").substring(0, 120));
    }
  }
}