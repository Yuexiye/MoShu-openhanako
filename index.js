export default class MoShuPlugin {
  async onload() {
    const { dataDir, log } = this.ctx;
    process.env.MO_SHU_DIR = dataDir;
    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.mkdirSync(path.join(dataDir, "projects"), { recursive: true });
    log.info("墨述写作插件 loaded");
  }
}
