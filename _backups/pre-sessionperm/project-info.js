const name = "novel_project_info";
const description = "查看项目详情";
const parameters = { type: "object", properties: { projectId: { type: "string", description: "项目 ID" } }, required: ["projectId"] };

async function execute(input) {
  try {
    const { getDataDir, safeProjectId } = await import("../lib/config.js");
    const pid = safeProjectId(input.projectId); if (!pid) throw new Error("无效项目 ID");
    const { get } = await import("../lib/project.js");
    const { json, error } = await import("../lib/output.js");
    const proj = await get(await getDataDir(), pid);
    if (!proj) return error("项目不存在");
    return json({ ok: true, project: proj });
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
