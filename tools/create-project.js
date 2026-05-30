const name = "novel_create_project";
const description = "创建写作项目";
const parameters = {
  type: "object", properties: {
    name: { type: "string", description: "项目名称" },
    type: { type: "string", description: "小说类型（可选）" },
    summary: { type: "string", description: "世界观概括（可选）" },
  }, required: ["name"],
};

async function execute(input) {
  try {
    const { getDataDir } = await import("../lib/config.js");
    const { create } = await import("../lib/project.js");
    const { json, error } = await import("../lib/output.js");
    const proj = await create(await getDataDir(), { name: input.name, type: input.type, summary: input.summary });
    return json({ ok: true, project: proj, message: `✅ 项目「${proj.name}」创建成功` });
  } catch (e) {
    const { error: er } = await import("../lib/output.js");
    return er(e.message);
  }
}

export { name, description, parameters, execute };
