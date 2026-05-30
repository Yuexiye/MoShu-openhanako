import { enqueue } from "./wqueue.js";

async function writeJSON(fp, data) {
  return enqueue(async () => {
    const fs = await import("node:fs");
    const p = await import("node:path");
    fs.mkdirSync(p.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
  });
}

async function appendJSONL(fp, obj) {
  return enqueue(async () => {
    const fs = await import("node:fs");
    const p = await import("node:path");
    fs.mkdirSync(p.dirname(fp), { recursive: true });
    fs.appendFileSync(fp, JSON.stringify(obj) + "\n", "utf-8");
  });
}

async function readJSON(fp) {
  try {
    const fs = await import("node:fs");
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch { return null; }
}

async function readJSONL(fp) {
  try {
    const fs = await import("node:fs");
    return fs.readFileSync(fp, "utf-8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
  } catch { return []; }
}

async function listDir(dp) { try { const fs = await import("node:fs"); return fs.readdirSync(dp); } catch { return []; } }
async function exists(fp) { try { const fs = await import("node:fs"); fs.accessSync(fp); return true; } catch { return false; } }

export { writeJSON, appendJSONL, readJSON, readJSONL, listDir, exists };
