const name = "novel_ping";
const description = "墨述心跳检测";
export const sessionPermission = { readOnly: true };
const parameters = { type: "object", properties: {} };

async function execute() {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, plugin: "mo-shu", name: "墨述", version: "0.1.0", timestamp: new Date().toISOString() }) }] };
}

export { name, description, parameters, execute };
