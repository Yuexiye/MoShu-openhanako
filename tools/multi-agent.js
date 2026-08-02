const name = "novel_multi_agent";
import fs from "node:fs";
import path from "node:path";

const description = "多 Agent 写作模式。角色驱动的写作流水线：设定→大纲→正文→审稿，每个角色槽位可配置由哪个 Agent 或模型担任。支持对话驱动或后台流水线。";

export const sessionPermission = { kind: "plugin_output" };
const parameters = {
  type: "object",
  properties: {
    projectId: { type: "string", description: "项目 ID" },
    action: {
      type: "string",
      enum: ["configure", "get_config", "start_stage", "advance", "status"],
      description: "configure=设置角色配置 / get_config=读取配置 / start_stage=启动某阶段 / advance=推进到下一阶段 / status=查看工作流状态",
    },
    roles: {
      type: "object",
      description: "configure 时的角色配置：{settings:{agentId,model},outline:{...},draft:{...},review:{...}}",
    },
    stage: { type: "string", enum: ["settings", "outline", "draft", "review"], description: "start_stage 时指定的阶段" },
  },
  required: ["projectId", "action"],
};

const STAGES = ["settings", "outline", "draft", "review"];
const STAGE_LABELS = {
  settings: "设定",
  outline: "大纲",
  draft: "正文",
  review: "审稿",
};
const STAGE_PROMPTS = {
  settings: `你正在为小说项目构建世界观设定。请完成以下任务：
1. 生成世界观草案（地理/势力/文化/历史概述）
2. 创建主要人物卡片（主角/配角/反派，各含动机/缺陷/成长弧）
3. 创建关键世界观设定卡片
4. 添加核心时间线事件
使用墨述的 update_card、fact、structure 工具写入数据。`,
  outline: `你正在为小说项目编写大纲。请完成以下任务：
1. 创建故事弧线（总纲）
2. 每个弧线下创建幕和节拍
3. 为关键节拍添加场景拆解
4. 将节拍关联到章节
使用墨述的 structure 工具写入数据。`,
  draft: `你正在为小说项目撰写正文。请完成以下任务：
1. 调用 get_context 获取写作上下文
2. 基于大纲节拍和场景规划撰写章节正文
3. 调用 chapter write 工具保存章节
4. 保持人物设定一致性，注意伏笔埋设
逐章撰写，每章完成后保存。`,
  review: `你正在审阅小说项目的章节。请完成以下任务：
1. 调用 analyze 工具进行交叉验证（人物冲突/时间线/伏笔）
2. 检查文风一致性和 AI 味
3. 标记需要修改的章节
4. 对有问题的章节调用 chapter revise 修订
输出审阅报告。`,
};

async function execute(input) {
  try {
    const { projectId, action } = input;
    const { safeProjectId, getDataDir } = await import("../lib/config.js");
    const pid = safeProjectId(projectId);
    if (!pid) throw new Error("无效项目 ID");
    const dataDir = await getDataDir();
    const projDir = path.join(dataDir, "projects", pid);
    const cfgPath = path.join(projDir, "workflow-config.json");

    switch (action) {
      case "configure": {
        const config = {
          roles: input.roles || {
            settings: { agentId: null, model: null },
            outline: { agentId: null, model: null },
            draft: { agentId: null, model: null },
            review: { agentId: null, model: null },
          },
          currentStage: null,
          stages: {},
          createdAt: new Date().toISOString(),
        };
        STAGES.forEach(s => { config.stages[s] = { status: "pending", startedAt: null, completedAt: null }; });
        fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, config, message: "角色配置已保存。使用 start_stage 启动某个阶段。" }, null, 2) }] };
      }

      case "get_config": {
        if (!fs.existsSync(cfgPath)) return { content: [{ type: "text", text: JSON.stringify({ ok: true, config: null, message: "尚未配置，请先调用 configure" }) }] };
        const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, config }, null, 2) }] };
      }

      case "start_stage": {
        const stage = input.stage;
        if (!STAGES.includes(stage)) throw new Error("无效阶段: " + stage);
        if (!fs.existsSync(cfgPath)) throw new Error("请先调用 configure 配置角色");
        const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
        const role = config.roles[stage] || {};
        config.currentStage = stage;
        config.stages[stage].status = "in_progress";
        config.stages[stage].startedAt = new Date().toISOString();
        fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");

        // 返回执行指令
        const prompt = STAGE_PROMPTS[stage];
        const agentId = role.agentId || "current";
        const model = role.model || null;
        const instruction = model
          ? `请使用 subagent 工具，agent="${agentId}"，model="${model}"，执行以下任务：\n\n${prompt}`
          : agentId !== "current"
            ? `请使用 subagent 工具，agent="${agentId}"，执行以下任务：\n\n${prompt}`
            : `请执行以下任务：\n\n${prompt}`;

        return { content: [{ type: "text", text: JSON.stringify({
          ok: true,
          stage,
          stageLabel: STAGE_LABELS[stage],
          agentId,
          model,
          instruction,
          message: `${STAGE_LABELS[stage]} 阶段已启动。角色：${agentId}${model ? ' / ' + model : ''}。`,
        }, null, 2) }] };
      }

      case "advance": {
        if (!fs.existsSync(cfgPath)) throw new Error("请先调用 configure 配置角色");
        const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
        if (!config.currentStage) throw new Error("当前无活跃阶段");
        const curIdx = STAGES.indexOf(config.currentStage);
        // 完成当前阶段
        config.stages[config.currentStage].status = "completed";
        config.stages[config.currentStage].completedAt = new Date().toISOString();
        if (curIdx < STAGES.length - 1) {
          const next = STAGES[curIdx + 1];
          config.currentStage = next;
          config.stages[next].status = "pending";
          fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, completed: STAGE_LABELS[STAGES[curIdx]], next: STAGE_LABELS[next], nextStage: next, message: `${STAGE_LABELS[STAGES[curIdx]]} 已完成。下一步：${STAGE_LABELS[next]}。调用 start_stage 启动。` }, null, 2) }] };
        } else {
          config.currentStage = null;
          fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, message: "🎉 全部阶段已完成！" }, null, 2) }] };
        }
      }

      case "status": {
        if (!fs.existsSync(cfgPath)) return { content: [{ type: "text", text: JSON.stringify({ ok: true, status: "未配置", stages: STAGES.map(s => ({ stage: s, label: STAGE_LABELS[s], status: "unconfigured" })) }) }] };
        const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
        const stages = STAGES.map(s => ({
          stage: s,
          label: STAGE_LABELS[s],
          status: config.stages[s]?.status || "pending",
          agentId: config.roles[s]?.agentId || null,
          model: config.roles[s]?.model || null,
        }));
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, currentStage: config.currentStage, stages }) }] };
      }

      default:
        throw new Error("未知 action: " + action);
    }
  } catch (e) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }] };
  }
}

export { name, description, parameters, execute };
