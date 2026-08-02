async function getDataDir() {
  if (process.env.MO_SHU_DIR) return process.env.MO_SHU_DIR;
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const home = process.env.USERPROFILE || process.env.HOME || "";
  // 检测是否为 dev 插件运行模式
  const __filename = fileURLToPath(import.meta.url);
  const isDev = __filename.includes("plugins-dev") || __filename.includes("dev-plugins");
  const subDir = isDev ? path.join("dev", "mo-shu") : "mo-shu";
  return home ? path.join(home, ".hanako", "plugin-data", subDir) : path.join(process.cwd(), "mo-shu-data");
}
function safeProjectId(id) {
  if (!id || typeof id !== "string") return null;
  if (!/^[a-zA-Z0-9\u4e00-\u9fff_-]+$/.test(id)) return null;
  if (id.includes("..") || id.includes("/") || id.includes("\\")) return null;
  if (id.length > 64) return null;
  return id;
}
export { getDataDir, safeProjectId };