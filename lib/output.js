function ok(t) { return { content: [{ type: "text", text: t }] }; }
function json(d) { return ok(JSON.stringify(d, null, 2)); }
function error(m) { return ok(`❌ ${m}`); }
export { ok, json, error };
